"""Exercise the actual worker's commands without calling paid providers."""
import asyncio
from types import SimpleNamespace
from unittest import IsolatedAsyncioTestCase
from unittest.mock import AsyncMock, Mock, patch
from agent import SyllabusVoiceTutor

class WorkerTests(IsolatedAsyncioTestCase):
    def tutor(self):
        session = SimpleNamespace(interrupt=AsyncMock(), clear_user_turn=lambda:None,
            commit_user_turn=AsyncMock(return_value='Why does this happen?'))
        with patch.dict('os.environ',{},clear=True):
            tutor = SyllabusVoiceTutor(SimpleNamespace(), session, {
                'userId':'student', 'sessionId':'session', 'voiceGatewayToken':'fixture',
                'orchestrateEndpoint':'https://fixture.test/api/live-class/orchestrate',
                'inputMode':'press_to_talk'})
        self.addAsyncCleanup(tutor.close)
        tutor.publish = AsyncMock()
        tutor.api = AsyncMock()
        tutor.prepare_next = AsyncMock()
        tutor.media_ready = True
        return tutor

    async def test_hold_release_commits_once_and_answers(self):
        tutor = self.tutor()
        tutor.interrupt = AsyncMock()
        tutor.answer = AsyncMock()
        await tutor.receive_packet({'type':'ptt_start','turnId':'first'})
        await tutor.receive_packet({'type':'ptt_end','turnId':'first'})
        await tutor.release_task
        tutor.session.commit_user_turn.assert_awaited_once()
        tutor.answer.assert_awaited_once_with('Why does this happen?')
        self.assertIsNone(tutor.turn_id)
        phases=[call.args[0].get('phase') for call in tutor.publish.call_args_list]
        self.assertEqual(phases,['listening','processing','released',None])
        await tutor.receive_packet({'type':'ptt_end','turnId':'first'})
        tutor.session.commit_user_turn.assert_awaited_once()

    async def test_cancelled_question_restores_interrupted_lesson(self):
        tutor=self.tutor()
        tutor.turn_id='first';tutor.interrupting=True;tutor.packet={'visual_cues':[]}
        tutor.api.return_value={'state':{'state_version':4},'packet':{'id':'restored'}}
        tutor.play_packet=AsyncMock()
        await tutor.finish_turn('first',True)
        await asyncio.sleep(0)
        tutor.session.commit_user_turn.assert_not_awaited()
        tutor.play_packet.assert_awaited_once_with({'id':'restored'},0,0)
        self.assertFalse(tutor.interrupting)

    async def test_selection_is_retained_without_inventing_a_question(self):
        tutor=self.tutor();tutor.answer=AsyncMock()
        await tutor.receive_packet({'type':'structure_selected','structureId':'Left ventricle'})
        self.assertEqual(tutor.selection['structureId'],'Left ventricle')
        tutor.answer.assert_not_awaited()
        self.assertTrue(tutor.publish.call_args.args[0]['awaitingQuestion'])
        await tutor.receive_packet({'type':'concept_selected','concept':'Explain preload'})
        tutor.answer.assert_awaited_once_with('Explain preload')

    async def test_actual_playout_advances_visuals_and_completes(self):
        tutor=self.tutor()
        async def finished():pass
        tutor.session.say=lambda *args,**kwargs:SimpleNamespace(wait_for_playout=finished,interrupted=False)
        async def source(*args):yield 'Source evidence.'
        tutor.grounded_speech=source;tutor.speaking=True
        tutor.api.return_value={'state':{'state_version':3}}
        packet={'teaching_version':3,'state_version':2,'concept_node_id':'concept','title':'Mechanism','visual_cues':[
            {'id':str(i),'mode':'whiteboard','title':'Mechanism','spoken_text':'Source evidence.','steps':['Evidence'],'citations':[]} for i in range(2)]}
        await tutor.play_packet(packet)
        messages=[c.args[0] for c in tutor.publish.call_args_list]
        self.assertEqual([m['cue_index'] for m in messages if m['type']=='SYNC_VISUAL_STAGE'],[0,1])
        self.assertEqual(messages[-1]['type'],'LESSON_COMPLETED')
        tutor.api.assert_awaited_once_with('/api/live-class/orchestrate',{'action':'node_complete','stateVersion':2,'conceptNodeId':'concept'})

    async def test_returning_to_browser_cancels_server_expiry(self):
        tutor=self.tutor()
        await tutor.receive_packet({'type':'browser_presence','hidden':True})
        task=tutor.away_task
        await tutor.receive_packet({'type':'browser_presence','hidden':False})
        await asyncio.sleep(0)
        self.assertTrue(task.cancelled())

    async def test_away_expiry_closes_room_via_authenticated_endpoint(self):
        tutor=self.tutor();tutor.stop_speech=AsyncMock()
        tutor.http.post=AsyncMock(return_value=SimpleNamespace(raise_for_status=lambda:None))
        with patch('agent.asyncio.sleep',new=AsyncMock()):await tutor.expire_away()
        tutor.stop_speech.assert_awaited_once()
        self.assertEqual(tutor.http.post.call_args.kwargs['json'],{'reason':'browser_away'})

    async def test_raw_legacy_source_is_never_spoken(self):
        tutor=self.tutor();tutor.session.say=Mock()
        await tutor.play_packet({'state_version':2,'visual_cues':[{'spoken_text':'Learning objectives ORIENTATION'}]})
        tutor.session.say.assert_not_called()
        self.assertEqual(tutor.publish.call_args.args[0]['reason'],'teaching_plan_required')

    async def test_pace_updates_native_tts_and_rejects_out_of_bounds(self):
        tutor=self.tutor();tutor.session.tts=SimpleNamespace(update_options=Mock())
        await tutor.receive_packet({'type':'teaching_pace','pace':0.85})
        tutor.session.tts.update_options.assert_called_once_with(extra_kwargs={'speed':0.85,'volume':0.88})
        await tutor.receive_packet({'type':'teaching_pace','pace':0.85})
        await tutor.receive_packet({'type':'teaching_pace','pace':3})
        self.assertEqual(tutor.session.tts.update_options.call_count,1)

    async def test_model_exploration_extends_current_visual(self):
        import time
        tutor=self.tutor()
        await tutor.receive_packet({'type':'explore_visual'})
        self.assertGreater(tutor.visual_focus_until,time.monotonic()+5)

    async def test_question_without_open_lesson_is_explicitly_released(self):
        tutor=self.tutor()
        await tutor.answer('Can you explain this?')
        self.assertEqual(tutor.publish.call_args.args[0],{'type':'ANSWER_UNAVAILABLE','reason':'lesson_not_ready'})

    async def test_no_provider_output_reports_failure_instead_of_silent_wait(self):
        tutor=self.tutor()
        async def unavailable(*args):
            raise RuntimeError('busy')
            yield ''
        tutor.text_stream=unavailable
        output=[part async for part in tutor.grounded_speech('Question','barge_in','Please retry your question.')]
        self.assertEqual(output,['Please retry your question.'])
        self.assertEqual(tutor.publish.call_args.args[0]['type'],'ANSWER_UNAVAILABLE')

    async def test_resume_keeps_sentence_checkpoint_and_rejects_raw_fallback(self):
        tutor=self.tutor();spoken=[]
        async def finished():pass
        def say(text,**kwargs):
            spoken.append(text);return SimpleNamespace(wait_for_playout=finished,interrupted=False)
        tutor.session.say=say;tutor.speaking=True;tutor.started=True
        tutor.api.return_value={'state':{'state_version':3}}
        packet={'teaching_version':3,'state_version':2,'concept_node_id':'concept','title':'Mechanism','visual_cues':[{'id':'c','mode':'whiteboard','title':'Mechanism','spoken_text':'First sentence. Second sentence. Third sentence.','steps':['Evidence'],'citations':[]}]}
        await tutor.play_packet(packet,0,1)
        self.assertEqual(spoken,['Second sentence.','Third sentence.'])
        await tutor.play_packet({**packet,'source_fallback':True})
        self.assertEqual(len(spoken),2)
