"""Disposable paid-student validation through the same HTTPS and RTC routes as the UI.

Uses existing production CI secrets without exporting credentials or real student data.
No payment or email is sent. Usage costs remain in the anonymized usage ledger.
"""
import asyncio
import audioop
from array import array
from collections import Counter
from datetime import datetime,timedelta,timezone
import hashlib
import http.cookiejar
import io
import json
import os
from pathlib import Path
import secrets
import subprocess
import time
import urllib.error
import urllib.parse
import urllib.request
import uuid
import wave
from livekit import rtc

APP='https://www.lenxiq.online'
DB='https://hixvbcrrklyajhkyliay.supabase.co'
BUCKET='ephemeral_class_materials'

class StudentValidation:
    def __init__(self):
        self.key=os.environ.get('SUPABASE_SERVICE_ROLE_KEY','')
        if os.environ.get('SUPABASE_URL','').rstrip('/')!=DB or not self.key:
            raise RuntimeError('Expected Study Hub CI credentials are unavailable')
        self.user=None;self.session=None;self.paths=set();self.room=None
        self.jar=http.cookiejar.CookieJar()
        self.browser=urllib.request.build_opener(urllib.request.HTTPCookieProcessor(self.jar))
        self.events=[];self.changed=asyncio.Event();self.streams=[];self.tasks=[]
        self.report={'checks':[],'timingsSeconds':{},'audioSamples':0,'clippedSamples':0}
        self.connected_at=0
    def check(self,label):
        self.report['checks'].append(label);print('PASS_'+label,flush=True)
    def request(self,path,body=None,*,service=False,method=None,raw=None,headers=None):
        url=path if path.startswith('https://') else (DB if service else APP)+path
        if service and not url.startswith(DB+'/'):raise RuntimeError('Wrong database target')
        h={'Origin':APP,'User-Agent':'LenxiQ controlled classroom validation',**(headers or {})}
        if service:h.update({'apikey':self.key,'Authorization':'Bearer '+self.key})
        if body is not None:raw=json.dumps(body,separators=(',',':')).encode();h['Content-Type']='application/json'
        req=urllib.request.Request(url,data=raw,method=method or ('POST' if raw is not None else 'GET'),headers=h)
        try:
            response=(urllib.request.urlopen(req,timeout=45) if service else self.browser.open(req,timeout=65))
            with response:
                content=response.read();content_type=response.headers.get('content-type','')
                if not content:return None
                return json.loads(content) if 'json' in content_type else content.decode('utf8','replace')
        except urllib.error.HTTPError as error:
            # Never print response bodies, cookies, signed URLs or credentials.
            raise RuntimeError('HTTP '+str(error.code)+' at '+urllib.parse.urlsplit(url).path) from None
    async def http(self,*args,**kwargs):return await asyncio.to_thread(self.request,*args,**kwargs)
    async def wait(self,predicate,*,after=0,timeout=90):
        deadline=time.monotonic()+timeout
        while time.monotonic()<deadline:
            for event in self.events:
                if event['at']>=after and event['data'].get('state')=='ERROR':raise RuntimeError('The classroom worker reported an error')
                if event['at']>=after and predicate(event['data']):return event
            self.changed.clear()
            try:await asyncio.wait_for(self.changed.wait(),min(3,max(.01,deadline-time.monotonic())))
            except asyncio.TimeoutError:pass
        raise RuntimeError('Timed out waiting for classroom event')
    async def send(self,payload):
        await self.room.local_participant.publish_data(json.dumps({'version':1,**payload}),reliable=True,topic='lensiq.live_class.visual_feedback')
    async def speak_question(self):
        # Exercise the actual mic -> VAD -> CPU Whisper -> model -> speech path,
        # using a deterministic English fixture, with no browser speech fallback.
        result=await asyncio.to_thread(subprocess.run,['espeak-ng','--stdout','-s','145','Why do neutrophils arrive early in acute inflammation?'],capture_output=True,check=True)
        with wave.open(io.BytesIO(result.stdout),'rb') as recording:
            pcm=recording.readframes(recording.getnframes())
            if recording.getnchannels()!=1 or recording.getsampwidth()!=2:raise RuntimeError('Unexpected speech fixture format')
            pcm,_=audioop.ratecv(pcm,2,1,recording.getframerate(),16000,None)
        source=rtc.AudioSource(16000,1,queue_size_ms=200)
        track=rtc.LocalAudioTrack.create_audio_track('validation-question',source)
        options=rtc.TrackPublishOptions(source=rtc.TrackSource.SOURCE_MICROPHONE)
        publication=await self.room.local_participant.publish_track(track,options)
        try:
            for offset in range(0,len(pcm),640):
                frame=pcm[offset:offset+640].ljust(640,b'\0')
                await source.capture_frame(rtc.AudioFrame(frame,16000,1,320))
            await source.wait_for_playout()
            ended=time.monotonic()
            for _ in range(35):await source.capture_frame(rtc.AudioFrame(bytes(640),16000,1,320))
            await source.wait_for_playout()
            return ended
        finally:
            await self.room.local_participant.unpublish_track(publication.sid)
            await source.aclose()
    async def bootstrap(self):
        email='lenxiq-check-'+uuid.uuid4().hex+'@example.invalid';password=secrets.token_urlsafe(40)
        result=await self.http('/auth/v1/admin/users',{'email':email,'password':password,'email_confirm':True,'app_metadata':{'lenxiq_live_validation':True}},service=True)
        self.user=result.get('id') or result.get('user',{}).get('id')
        if not self.user:raise RuntimeError('No fixture identity returned')
        now=datetime.now(timezone.utc)
        profile={'id':self.user,'email':email,'name':'Temporary classroom check','role':'user','plan':'intensive','plan_duration':1,'plan_expires_at':(now+timedelta(hours=3)).isoformat(),'wallet_reset_at':(now+timedelta(days=30)).isoformat(),'voice_minutes_balance':360,'text_teaching_balance':600,'quiz_attempts_used':0}
        await self.http('/rest/v1/profiles?on_conflict=id',profile,service=True,headers={'Prefer':'resolution=merge-duplicates,return=representation'})
        form=urllib.parse.urlencode({'email':email,'password':password,'next':'/subscription'}).encode()
        page=await self.http('/auth/password',raw=form,headers={'Content-Type':'application/x-www-form-urlencoded'})
        if 'Subscription active' not in page or 'Mastery' not in page:raise RuntimeError('Paid access did not reflect after actual sign-in')
        self.check('REAL_SIGNIN_AND_ACTIVE_PAID_SUBSCRIPTION')
    async def upload_sources(self):
        self.urls=[];self.maps=[];self.names=[]
        statements=[
            'Acute inflammation is a protective response to tissue injury. Neutrophils are prominent early inflammatory cells. Vascular changes allow plasma proteins and leukocytes to reach injured tissue.',
            'Leukocytes first interact with the vessel wall, then migrate toward injured tissue. Diapedesis refers to leukocyte passage through the vessel wall. Discuss rolling, adhesion and migration as separate steps.',
            'Inflammation removes the cause of injury, clears damaged tissue and supports repair. Explain the relationship between the initial injury and the protective response.',
            'The inflammatory response involves vessels, circulating leukocytes and tissue signals. Keep the sequence of vascular changes and cellular events clear.',
            'A teaching model is a simplified representation. Identify the vessel wall, the lumen and the migrating leukocyte. Explain the represented process without claiming it is a patient specimen.',
            'Resolution and repair follow removal of the injurious stimulus. Persistent injury can sustain an inflammatory response. Explain the scope of the uploaded lecture and do not invent a drug dosing regimen.'
        ]
        for index,statement in enumerate(statements):
            text='\n\n'.join(f'Acute inflammation — section {n+1}\n{statement}' for n in range(22))+'\nFINAL SOURCE PAGE '+str(index+1)
            name=f'validation_source_{index+1}.txt';self.names.append(name)
            prepared=await self.http('/api/voice/materials',{'action':'prepare','fileName':name,'mimeType':'text/plain','fileSize':len(text.encode())})
            self.paths.add(prepared['path'])
            url=DB+'/storage/v1/object/upload/sign/'+BUCKET+'/'+urllib.parse.quote(prepared['path'],safe='/')+'?token='+urllib.parse.quote(prepared['token'])
            await self.http(url,method='PUT',raw=text.encode(),headers={'Content-Type':'text/plain','cache-control':'max-age=0'})
            parsed=await self.http('/api/voice/materials',{'action':'parse','path':prepared['path']})
            self.paths.add(parsed['path']);self.paths.add(parsed['path'].replace('.parsed.txt','.class-map.json'))
            if not parsed.get('materialMapUrl'):raise RuntimeError('The parsed source has no usable navigation map')
            self.urls.append(parsed['signedUrl']);self.maps.append(parsed.get('materialMapUrl') or '')
            saved=await self.http(parsed['signedUrl'])
            mapped=await self.http(parsed['materialMapUrl'])
            if saved!=text or ''.join(c['content'] for c in mapped['chunks'])!=text or mapped['sourceSha256']!=hashlib.sha256(text.encode()).hexdigest():raise RuntimeError('Uploaded source was changed or truncated')
        self.check('SIX_FILES_PARSED_IN_FULL_WITH_INTEGRITY_HASHES')
    async def start(self):
        started=time.monotonic()
        conversation=await self.http('/api/teaching/conversations',{'courseName':'Anatomical Pathology','title':'Temporary validation class','sessionType':'live_class'})
        token=await self.http('/api/voice/token',{'courseName':'Anatomical Pathology','topicFocus':'Acute inflammation and diapedesis','conversationId':conversation['conversation']['id'],'fileUrls':self.urls,'materialMapUrls':self.maps,'materialContext':{'sources':self.names,'branches':['Anatomical Pathology'],'primaryBranch':'Anatomical Pathology'}})
        self.session=token['sessionId'];self.started=started
        self.report['timingsSeconds']['tokenAndDispatch']=round(time.monotonic()-started,2)
        self.room=rtc.Room()
        @self.room.on('data_received')
        def data_received(packet):
            if not packet.participant or not packet.participant.identity.startswith('lensiq-voice-tutor'):return
            try:data=json.loads(packet.data.decode())
            except (ValueError,UnicodeError):return
            self.events.append({'at':time.monotonic(),'data':data});self.changed.set()
        async def inspect(stream):
            async for item in stream:
                samples=array('h');samples.frombytes(bytes(item.frame.data))
                if samples:
                    self.report['audioSamples']+=len(samples)
                    self.report['clippedSamples']+=sum(abs(n)>=32760 for n in samples)
                    if max(abs(n) for n in samples[::max(1,len(samples)//150)])>120 and 'firstAudibleSpeech' not in self.report['timingsSeconds']:
                        self.report['timingsSeconds']['firstAudibleSpeech']=round(time.monotonic()-started,2)
        @self.room.on('track_subscribed')
        def track_subscribed(track,publication,participant):
            if participant.identity.startswith('lensiq-voice-tutor') and track.kind==rtc.TrackKind.KIND_AUDIO:
                stream=rtc.AudioStream.from_track(track=track);self.streams.append(stream);self.tasks.append(asyncio.create_task(inspect(stream)))
        await self.room.connect(token['url'],token['token']);self.connected_at=time.monotonic()
        self.tasks.append(asyncio.create_task(self.heartbeat()))
        event=await self.wait(lambda d:d.get('type')=='live_class_spoken_cue',timeout=150)
        self.report['timingsSeconds']['firstAIExplanation']=round(event['at']-started,2)
        sources=event['data'].get('sources') or {}
        if sources.get('loaded')!=6 or sources.get('missing')!=0:raise RuntimeError('Worker did not confirm all six original sources')
        self.check('REAL_AUTHORIZED_AI_SPEECH_WITH_ALL_SIX_FILES')
    async def heartbeat(self):
        while True:
            await asyncio.sleep(30)
            data=await self.http('/api/voice/session',{'sessionId':self.session,'action':'heartbeat','durationSeconds':int(time.monotonic()-self.started)})
            if data.get('shouldEnd'):return
    async def exercise(self):
        end=await self.wait(lambda d:d.get('type')=='live_class_segment_complete',after=self.connected_at,timeout=140)
        resumed=await self.wait(lambda d:d.get('type')=='live_class_state' and d.get('state')=='RESUMING',after=end['at'],timeout=20)
        await self.wait(lambda d:d.get('type')=='live_class_spoken_cue',after=resumed['at'],timeout=60)
        self.check('AUTOMATIC_CONTINUATION_WITHOUT_STUDENT_CONTINUE')
        sent=time.monotonic()
        speech_ended=await self.speak_question()
        transcript=await self.wait(lambda d:d.get('type')=='live_class_user_transcript',after=sent,timeout=45)
        if 'inflammation' not in transcript['data'].get('content','').lower():raise RuntimeError('Spoken medical question was not recognized')
        answer=await self.wait(lambda d:d.get('type')=='live_class_spoken_cue',after=transcript['at'],timeout=60)
        self.report['timingsSeconds']['questionToFirstSpokenAnswer']=round(answer['at']-speech_ended,2)
        ended=await self.wait(lambda d:d.get('type')=='live_class_segment_complete',after=answer['at'],timeout=120)
        await self.wait(lambda d:d.get('type')=='live_class_state' and d.get('state')=='RESUMING',after=ended['at'],timeout=20)
        self.check('INTERRUPTION_ANSWER_AND_AUTOMATIC_LESSON_RESUMPTION')
        tapped=time.monotonic()
        await self.send({'type':'concept_selected','concept':'Explain leukocyte diapedesis from the uploaded lecture.'})
        await self.wait(lambda d:d.get('type')=='live_class_interaction_ack',after=tapped,timeout=10)
        await self.wait(lambda d:d.get('type')=='live_class_spoken_cue',after=tapped,timeout=60)
        self.check('KEY_NOTE_TAP_RECEIVED_AND_EXPLAINED')
        await self.send({'type':'lesson_policy','autoContinue':False})
        await self.wait(lambda d:d.get('type')=='live_class_segment_complete',after=ended['at'],timeout=140)
        paused=time.monotonic();await asyncio.sleep(4)
        if any(e['at']>paused and e['data'].get('state')=='RESUMING' for e in self.events):raise RuntimeError('Pause failed')
        await self.send({'type':'lesson_policy','autoContinue':True})
        await self.wait(lambda d:d.get('type')=='live_class_spoken_cue',after=paused,timeout=60)
        self.check('PAUSE_AND_RESUME_PRESERVE_THE_LESSON')
        duration=max(8,min(90,int(os.environ.get('VALIDATION_MINUTES','8'))))
        while time.monotonic()-self.connected_at<duration*60:
            await asyncio.sleep(10)
            recent=[e for e in self.events if e['at']>time.monotonic()-90 and e['data'].get('type')=='live_class_spoken_cue']
            errors=[e for e in self.events if e['data'].get('state')=='ERROR']
            if errors or not recent:raise RuntimeError('Continuous teaching stalled or reported an error')
        self.report['durationSeconds']=round(time.monotonic()-self.connected_at)
        self.report['spokenCues']=sum(e['data'].get('type')=='live_class_spoken_cue' for e in self.events)
        notes=[e['data'].get('note') for e in self.events if e['data'].get('note')]
        if any('…' in note for note in notes):raise RuntimeError('The board still contains truncated dictation')
        self.check('CONTINUOUS_TEACHING_AND_COMPLETE_KEY_NOTES')
        if self.report['audioSamples']==0 or self.report['clippedSamples']/self.report['audioSamples']>.001:raise RuntimeError('Audio missing or PCM clipping detected')
        self.check('REAL_AUDIO_WITHOUT_PCM_OVERFLOW')
    async def cleanup(self):
        for task in self.tasks:task.cancel()
        if self.room:
            try:await self.send({'type':'lesson_policy','autoContinue':False})
            except Exception:pass
        if self.session:
            try:
                result=await self.http('/api/voice/session',{'sessionId':self.session,'action':'end','durationSeconds':int(time.monotonic()-self.started)})
                if result.get('chargedMinutes',0)<=0:raise RuntimeError('Voice usage was not charged')
                self.check('STUDENT_MINUTE_ALLOWANCE_CHARGED')
            except Exception:self.report['cleanupSessionWarning']=True
        for stream in self.streams:
            try:await stream.aclose()
            except Exception:pass
        if self.room:
            try:await self.room.disconnect()
            except Exception:pass
        if self.user:
            await self.http('/rest/v1/profiles?id=eq.'+self.user,{'plan':'free','plan_expires_at':None,'voice_minutes_balance':0,'text_teaching_balance':0,'session_token':None},method='PATCH',service=True)
            # Only paths returned for this generated account can be removed.
            owned=[p for p in self.paths if p.startswith(self.user+'/')]
            if owned:await self.http('/storage/v1/object/'+BUCKET,{'prefixes':owned},method='DELETE',service=True)
            await self.http('/auth/v1/admin/users/'+self.user,method='DELETE',service=True)
            self.check('TEMPORARY_ACCOUNT_AND_UPLOADS_REMOVED')

async def main():
    validation=StudentValidation();error=None
    try:
        await validation.bootstrap();await validation.upload_sources();await validation.start();await validation.exercise()
    except Exception as exc:
        error=type(exc).__name__+': '+str(exc)
        validation.report['error']=error
    finally:
        validation.report['classroomStates']=dict(Counter(e['data']['state'] for e in validation.events if e['data'].get('state')))
        try:await validation.cleanup()
        except Exception as exc:
            validation.report['cleanupError']=type(exc).__name__
            error=error or 'Fixture cleanup failed'
        if validation.report.get('cleanupSessionWarning'):
            error=error or 'Session settlement was not verified'
        Path('live-class-validation.json').write_text(json.dumps(validation.report,indent=2))
        print(json.dumps({'checks':validation.report['checks'],'timingsSeconds':validation.report['timingsSeconds'],'error':error}),flush=True)
    if error:raise RuntimeError(error)

if __name__=='__main__':asyncio.run(main())
