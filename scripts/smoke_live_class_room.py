"""One isolated, disposable LiveKit room checking the *deployed* voice tutor.

No users, account records, recordings, or persistent data are created.
Only uses credentials mounted as a Modal secret; no credentials or tokens logged.
"""
from __future__ import annotations

import modal

app=modal.App("lenxiq-live-class-smoke-test")
image=modal.Image.debian_slim(python_version="3.11").pip_install(
    "livekit>=1.0,<2", "livekit-api>=1.0,<2",
)

@app.function(
    image=image,
    secrets=[modal.Secret.from_name("livekit-credentials")],
    timeout=230,
    memory=512,
    cpu=0.5,
)
def verify_real_room():
    import asyncio
    import json
    import os
    import uuid
    from livekit import api, rtc

    async def run():
        url=os.environ["LIVEKIT_URL"].strip().rstrip("/")
        server_url=("https://"+url[6:] if url.startswith("wss://")
                    else "http://"+url[5:] if url.startswith("ws://") else url)
        socket_url=("wss://"+url[8:] if url.startswith("https://")
                    else "ws://"+url[7:] if url.startswith("http://") else url)
        key=os.environ["LIVEKIT_API_KEY"]
        secret=os.environ["LIVEKIT_API_SECRET"]
        ident=uuid.uuid4().hex[:12]
        room_name="lensiq-voice-smoke-"+ident
        # Synthetic lesson with no personal or paid account context.
        reference="https://hixvbcrrklyajhkyliay.supabase.co/storage/v1/object/public/medical-models/hra-v25/heart.glb"
        metadata=json.dumps({
            "courseName":"Anatomical Pathology",
            "topicFocus":"Heart anatomy: right ventricle",
            "visualProtocol":{"version":3,"approvedModelAssets":{"hraHeart":reference},"approvedMoleculeAssets":{}},
        },separators=(",",":"))
        backend=api.LiveKitAPI(url=server_url,api_key=key,api_secret=secret)
        room=rtc.Room()
        events={"agent":asyncio.Event(),"audio":asyncio.Event(),"ack":asyncio.Event(),
                "audible_pcm":asyncio.Event()}
        streams=[]
        stream_tasks=[]
        transcript_count=0
        ack_type=None

        @room.on("participant_connected")
        def on_join(p):
            if p.identity.startswith("lensiq-voice-tutor"):
                events["agent"].set()
                print("PASS_REAL_MODAL_TUTOR_JOIN")

        async def inspect_audio(stream):
            import numpy as np
            try:
                async for event in stream:
                    # Validate genuine decoded speech audio, not just a track.
                    samples=np.frombuffer(event.frame.data,dtype=np.int16)
                    if samples.size and np.max(np.abs(samples.astype(np.int32)[::max(1,samples.size//500)]))>100:
                        events["audible_pcm"].set()
                        print("PASS_ACTUAL_NONSILENT_TUTOR_PCM")
                        return
            except Exception as exc:
                print("AUDIO_MONITOR_STATUS",type(exc).__name__)

        @room.on("track_subscribed")
        def on_track(track,pub,participant):
            if participant.identity.startswith("lensiq-voice-tutor") and track.kind==rtc.TrackKind.KIND_AUDIO:
                events["audio"].set()
                print("PASS_REAL_TUTOR_AUDIO_TRACK_SUBSCRIBED")
                stream=rtc.AudioStream.from_track(track=track)
                streams.append(stream)
                stream_tasks.append(asyncio.create_task(inspect_audio(stream)))

        @room.on("data_received")
        def on_data(packet):
            nonlocal transcript_count,ack_type
            if not packet.participant or not packet.participant.identity.startswith("lensiq-voice-tutor"):
                return
            try:
                data=json.loads(packet.data.decode())
            except (UnicodeDecodeError,ValueError,TypeError):
                return
            if not isinstance(data,dict):return
            if data.get("type")=="live_class_interaction_ack":
                ack_type=data.get("interaction")
                events["ack"].set()
                print("PASS_VALIDATED_VISUAL_SELECTION_ACK",ack_type)
            if data.get("type")=="live_class_transcript":
                transcript_count+=1

        try:
            await backend.room.create_room(api.CreateRoomRequest(
                name=room_name,metadata=metadata,empty_timeout=120,max_participants=3))
            print("CREATED_ISOLATED_TEST_ROOM")
            jwt=(api.AccessToken(key,secret)
                 .with_identity("lensiq-visual-smoke-learner")
                 .with_grants(api.VideoGrants(
                    room_join=True,room=room_name,can_publish_data=True))
                 .to_jwt())
            await room.connect(socket_url,jwt)
            await asyncio.wait_for(events["agent"].wait(),timeout=125)
            # The room intentionally does not send microphone audio.
            # This checks the control path and the publication of a real audio
            # track, not phoneme recognition or human subjective voice quality.
            await room.local_participant.publish_data(json.dumps({
                "version":1,
                "type":"structure_selected",
                "structureId":"heart right ventricle",
                "modelUrl":reference,
                "interaction":"touch_or_click",
            }),reliable=True,topic="lensiq.live_class.visual_feedback")
            print("SENT_REAL_LIVEKIT_STRUCTURE_INTERACTION")
            await asyncio.wait_for(events["ack"].wait(),timeout=26)
            if ack_type!="structure_selected":
                raise RuntimeError("Received wrong LiveKit interaction acknowledgement")
            try:
                await asyncio.wait_for(events["audio"].wait(),timeout=45)
            except TimeoutError:
                # Do not claim audio was verified if no track subscribed.
                raise RuntimeError("Tutor joined and validated the click but did not publish an audio track")
            await asyncio.wait_for(events["audible_pcm"].wait(),timeout=55)
            print("REAL_ROOM_E2E_OK: modal room joined, 3D selection acknowledged, audible PCM confirmed")
            print("TRANSCRIPT_PACKET_COUNT",transcript_count)
        finally:
            for stream in streams:
                try: await stream.aclose()
                except Exception: pass
            for pending in stream_tasks:
                pending.cancel()
            try: await room.disconnect()
            except Exception: pass
            try: await backend.room.delete_room(api.DeleteRoomRequest(room=room_name))
            except Exception: pass
            await backend.aclose()
            print("ISOLATED_TEST_ROOM_CLEANED")

    asyncio.run(run())

@app.local_entrypoint()
def main():
    verify_real_room.remote()
