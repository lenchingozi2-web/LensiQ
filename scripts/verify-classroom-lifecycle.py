"""Validate real source compilation, RTC visuals, PTT, purge and re-entry.

Uses a disposable paid account. Never logs bearer tokens or lecture contents.
"""
import asyncio
import json
import os
import time
import uuid
from pathlib import Path
from livekit import rtc
from validate_live_class_student import StudentValidation, DB

class ClassroomProbe(StudentValidation):
    async def cleanup(self):
        owned=[path for path in self.paths if self.user and path.startswith(self.user+'/')]
        if owned:
            await self.http('/storage/v1/object/study-documents',{'prefixes':owned},method='DELETE',service=True)
        self.paths=set()
        await super().cleanup()

    async def send_control(self,payload):
        await self.room.local_participant.publish_data(json.dumps(payload).encode(),reliable=True,topic='lensiq.live_class.lesson_control')

    async def upload_sources(self):
        fixtures=json.loads((Path(__file__).resolve().parents[1]/'tests/fixtures/live-class-lessons.json').read_text())
        sources=[('\n\n'.join('# '+chapter['title']+'\n'+paragraph for paragraph in chapter['sections'])).encode() for chapter in fixtures[:2]]
        files=[{'name':f'probe-{i}.txt','size':len(data),'type':'text/plain'} for i,data in enumerate(sources)]
        prepared=await self.http('/api/rag/ingest-batch',{'action':'prepare','files':files})
        self.syllabus=prepared['syllabusId']
        for upload,data in zip(prepared['uploads'],sources):
            self.paths.add(upload['path'])
            url=DB+'/storage/v1/object/upload/sign/study-documents/'+upload['path']+'?token='+upload['token']
            await self.http(url,method='PUT',raw=data,headers={'Content-Type':'text/plain'})
            await self.http('/api/rag/ingest-batch',{'action':'confirm','documentId':upload['documentId']})
        plan=await self.http('/api/rag/compile-syllabus',{'action':'prepare','syllabusId':self.syllabus})
        for doc in plan['documents']:
            offset=0
            while True:
                result=await self.http('/api/rag/compile-syllabus',{'action':'parse','syllabusId':self.syllabus,'itemId':doc['id'],'offset':offset})
                if result['done']:break
                offset=result['next']
        await self.http('/api/rag/compile-syllabus',{'action':'publish','syllabusId':self.syllabus})
        self.check('REAL_SYLLABUS_UPLOAD_COMPILE_AND_PUBLISH')

    async def connect(self,token):
        self.session=token['sessionId'];self.started=time.monotonic();self.room=rtc.Room()
        @self.room.on('data_received')
        def on_data(packet):
            if not packet.participant or packet.participant.kind!=rtc.ParticipantKind.PARTICIPANT_KIND_AGENT:return
            try:data=json.loads(packet.data)
            except (ValueError,UnicodeError):return
            if data.get('session_id')!=self.session or data.get('protocol')!='lensiq-syllabus-v2':return
            self.events.append({'at':time.monotonic(),'data':data});self.changed.set()
        async def listen(track):
            stream=rtc.AudioStream(track,sample_rate=16000,num_channels=1);self.streams.append(stream)
            async for event in stream:
                if max((abs(n) for n in event.frame.data),default=0)>200:self.last_audible_at=time.monotonic()
        @self.room.on('track_subscribed')
        def on_track(track,publication,participant):
            if track.kind==rtc.TrackKind.KIND_AUDIO and participant.kind==rtc.ParticipantKind.PARTICIPANT_KIND_AGENT:
                self.tasks.append(asyncio.create_task(listen(track)))
        await self.room.connect(token['url'],token['token'])
        self.tasks.append(asyncio.create_task(self.heartbeat()))
        await self.wait(lambda d:d.get('type')=='WORKER_READY',timeout=60)
        await self.send_control({'type':'ptt_mode','enabled':True})

    async def start(self):
        token=await self.http('/api/voice/token',{'syllabusId':self.syllabus,'courseName':'Anatomical Pathology','inputMode':'press_to_talk'})
        await self.connect(token)
        await self.room.local_participant.publish_data(json.dumps({'type':'OPEN_LESSON','session_id':self.session,'syllabus_id':self.syllabus}).encode(),reliable=True,topic='lk-lesson-state')
        await self.wait(lambda d:d.get('type')=='SYNC_VISUAL_STAGE',timeout=65)
        deadline=time.monotonic()+45
        while not self.last_audible_at and time.monotonic()<deadline:await asyncio.sleep(.3)
        if not self.last_audible_at:raise RuntimeError('No decoded non-silent tutor audio')
        self.check('SPOKEN_LESSON_AND_SESSION_VERIFIED_VISUAL')

    async def exercise(self):
        sent=time.monotonic();turn=uuid.uuid4().hex
        await self.send_control({'type':'ptt_start','turnId':turn})
        await self.wait(lambda d:d.get('type')=='live_class_ptt_state' and d.get('phase')=='listening',after=sent,timeout=10)
        await self.speak_question()
        released=time.monotonic()
        await self.send_control({'type':'ptt_end','turnId':turn})
        transcript=await self.wait(lambda d:d.get('type')=='live_class_user_transcript',after=released,timeout=25)
        if not transcript['data'].get('content','').strip():raise RuntimeError('Empty microphone transcript')
        self.report['timingsSeconds']['releaseToTranscript']=round(transcript['at']-released,2)
        restored=await self.wait(lambda d:d.get('type')=='RESTORE_VISUAL_STATE',after=released,timeout=120)
        await self.wait(lambda d:d.get('type')=='SYNC_VISUAL_STAGE',after=restored['at'],timeout=45)
        self.check('REAL_MIC_QUESTION_ANSWER_AND_LESSON_RESUMPTION')
        if any(e['data'].get('type')=='TUTOR_RECOVERY_REQUIRED' for e in self.events):raise RuntimeError('Worker requested recovery')
        old=self.session
        result=await self.http('/api/voice/session',{'sessionId':old,'action':'end','durationSeconds':int(time.monotonic()-self.started)})
        if result.get('cleanupPending'):raise RuntimeError('Source purge pending')
        records=await self.http('/rest/v1/study_syllabi?id=eq.'+self.syllabus+'&select=status',service=True)
        if not records or records[0]['status']!='purged':raise RuntimeError('Ended source was retained')
        self.check('ENDED_CLASS_PURGES_SOURCE_AND_COMPILED_NOTES')
        await self.room.disconnect()
        for task in self.tasks:task.cancel()
        token=await self.http('/api/voice/token',{'courseName':'Anatomical Pathology','inputMode':'press_to_talk'})
        if token['sessionId']==old:raise RuntimeError('New class reused old session')
        await self.connect(token)
        self.check('NEW_CLASS_ENTRY_AFTER_COMPLETION')
        await self.send_control({'type':'browser_presence','hidden':True})
        await asyncio.sleep(60)
        await asyncio.sleep(60)
        deadline=time.monotonic()+30
        while time.monotonic()<deadline:
            rows=await self.http('/rest/v1/live_class_sessions?id=eq.'+self.session+'&select=status',service=True)
            if rows and rows[0]['status']=='ended':break
            await asyncio.sleep(3)
        else:raise RuntimeError('Browser-away expiry did not end the class')
        self.check('SERVER_CLOSES_CLASS_AFTER_TWO_MINUTES_AWAY')

async def main():
    probe=ClassroomProbe();failure=None
    try:
        await probe.bootstrap();await probe.upload_sources();await probe.start();await probe.exercise()
    except Exception as exc:failure=type(exc).__name__+': '+str(exc)
    finally:
        # Parent cleanup deletes only this generated account and its objects.
        try:await probe.cleanup()
        except Exception as exc:failure=failure or type(exc).__name__
        report={'checks':probe.report['checks'],'timingsSeconds':probe.report['timingsSeconds'],'error':failure}
        Path('classroom-lifecycle-validation.json').write_text(json.dumps(report,indent=2))
        print(json.dumps(report),flush=True)
    if failure:raise RuntimeError(failure)

if __name__=='__main__':asyncio.run(main())
