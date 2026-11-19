"""Exercise the deployed worker's greeting in a short, disposable RTC room.

Only the handshake and audible greeting are measured. The fixture never
reserves learner minutes, creates a Supabase class or supplies study files.
"""
import asyncio
import json
import os
import time
import uuid
from datetime import timedelta

from livekit import api, rtc


async def main():
    room_name = "lensiq-smoke-" + uuid.uuid4().hex
    identity = str(uuid.uuid4())
    session = str(uuid.uuid4())
    room = rtc.Room()
    handshake, audible = asyncio.Event(), asyncio.Event()
    listeners = set()
    heard = set()
    verified = set()
    start = time.monotonic()

    async def listen(track, identity):
        stream = rtc.AudioStream(track, sample_rate=16000, num_channels=1)
        frames = 0
        try:
            async for event in stream:
                if max((abs(value) for value in event.frame.data), default=0) > 200:
                    frames += 1
                if frames >= 5:
                    print(f"Non-silent tutor audio received at {time.monotonic()-start:.2f}s", flush=True)
                    heard.add(identity)
                    if identity in verified:
                        audible.set()
                    return
        finally:
            await stream.aclose()

    @room.on("track_subscribed")
    def track_subscribed(track, publication, participant):
        if track.kind == rtc.TrackKind.KIND_AUDIO and participant.kind == rtc.ParticipantKind.PARTICIPANT_KIND_AGENT:
            task = asyncio.create_task(listen(track, participant.identity))
            listeners.add(task)

    @room.on("data_received")
    def data_received(packet):
        if packet.topic == "lk-lesson-state" and packet.participant and packet.participant.kind == rtc.ParticipantKind.PARTICIPANT_KIND_AGENT:
            data = json.loads(packet.data)
            if data.get("type") == "WORKER_READY" and data.get("session_id") == session and data.get("protocol") == "lensiq-syllabus-v2":
                verified.add(packet.participant.identity)
                handshake.set()
                if packet.participant.identity in heard:
                    audible.set()

    async with api.LiveKitAPI() as cloud:
        await cloud.room.create_room(api.CreateRoomRequest(name=room_name, empty_timeout=30))
        try:
            # No database credentials or valid lesson bearer are involved in the greeting probe.
            metadata = {"userId":identity,"sessionId":session,"voiceGatewayToken":"rtc-greeting-probe",
                        "orchestrateEndpoint":"https://www.lenxiq.online/api/live-class/orchestrate","courseName":"Audio check"}
            await cloud.agent_dispatch.create_dispatch(api.CreateAgentDispatchRequest(
                room=room_name, agent_name="lensiq-syllabus-tutor-v2", metadata=json.dumps(metadata)))
            token = api.AccessToken().with_identity(identity).with_ttl(timedelta(minutes=2)).with_grants(
                api.VideoGrants(room_join=True, room=room_name, can_publish=False, can_subscribe=True, can_publish_data=True))
            await room.connect(os.environ["LIVEKIT_URL"],token.to_jwt())
            async def ask_ready():
                while not handshake.is_set():
                    await room.local_participant.publish_data(json.dumps({"type":"HELLO","session_id":session}).encode(), reliable=True, topic="lk-lesson-state")
                    await asyncio.sleep(0.75)
            listeners.add(asyncio.create_task(ask_ready()))
            await asyncio.wait_for(asyncio.gather(handshake.wait(),audible.wait()),timeout=45)
            print("Verified named worker, session-specific handshake and decoded remote audio")
        finally:
            await room.disconnect()
            for task in listeners:
                task.cancel()
            await asyncio.gather(*listeners,return_exceptions=True)
            await cloud.room.delete_room(api.DeleteRoomRequest(room=room_name))


if __name__ == "__main__":
    asyncio.run(main())
