"""Real production classroom smoke test. Creates only a disposable paid fixture
account and its own tiny notes; never touches a real learner's files or minutes.
Uses the same authenticated upload/token APIs and LiveKit packets as /voice.
"""
import asyncio
import http.cookiejar
import io
import json
import os
import secrets
import subprocess
import time
import urllib.error
import urllib.parse
import urllib.request
import uuid
import wave
from array import array
from datetime import datetime, timedelta, timezone

from livekit import rtc

APP = "https://www.lenxiq.online"
DB = "https://hixvbcrrklyajhkyliay.supabase.co"
BUCKET = "study-documents"
PROTOCOL = "lensiq-syllabus-v2"
FIXTURE = (
    "# Acute inflammation\nAcute inflammation is an early protective response to tissue injury.\n"
    "# Vascular changes\nVasodilation increases local blood flow. Increased permeability permits plasma proteins to enter injured tissue.\n"
    "# Leukocyte recruitment\nNeutrophils adhere to endothelium and migrate into injured tissue. Diapedesis is passage through the vessel wall.\n"
    "# Resolution\nRemoval of the cause and inflammatory mediators permits tissue repair.\n"
).encode()


class Fixture:
    def __init__(self):
        if os.environ.get("NEXT_PUBLIC_SUPABASE_URL", "").rstrip("/") != DB:
            raise RuntimeError("Wrong project; fixture refused")
        self.key = os.environ["SUPABASE_SERVICE_ROLE_KEY"]
        self.browser = urllib.request.build_opener(
            urllib.request.HTTPCookieProcessor(http.cookiejar.CookieJar()))
        self.user = self.syllabus = self.session = self.room = None
        self.paths = []
        self.tasks = []
        self.events = []
        self.changed = asyncio.Event()
        self.audible = asyncio.Event()
        self.verified = set()
        self.heard = set()
        self.started = time.monotonic()

    def request(self, path, body=None, *, service=False, method=None, raw=None, headers=None):
        url = path if path.startswith("https://") else (DB if service else APP) + path
        if service and not url.startswith(DB + "/"):
            raise RuntimeError("Service request target refused")
        hdr = {"Origin": APP, "User-Agent": "LenxiQ syllabus smoke test", **(headers or {})}
        if service:
            hdr.update({"apikey": self.key, "Authorization": "Bearer " + self.key})
        if body is not None:
            raw = json.dumps(body).encode()
            hdr["Content-Type"] = "application/json"
        req = urllib.request.Request(url, data=raw, method=method or ("POST" if raw is not None else "GET"), headers=hdr)
        try:
            opener = urllib.request.urlopen if service else self.browser.open
            with opener(req, timeout=40) as response:
                data = response.read()
                return json.loads(data) if data and "json" in response.headers.get("content-type", "") else data
        except urllib.error.HTTPError as error:
            raise RuntimeError("HTTP " + str(error.code) + " at " + urllib.parse.urlsplit(url).path) from None

    async def http(self, *args, **kwargs):
        return await asyncio.to_thread(self.request, *args, **kwargs)

    async def setup(self):
        email = "lenxiq-syllabus-check-" + uuid.uuid4().hex + "@example.invalid"
        password = secrets.token_urlsafe(40)
        user = await self.http("/auth/v1/admin/users", {
            "email": email, "password": password, "email_confirm": True,
            "app_metadata": {"lenxiq_live_validation": True},
        }, service=True)
        self.user = user.get("id") or user.get("user", {}).get("id")
        if not self.user:
            raise RuntimeError("Temporary user was not created")
        now = datetime.now(timezone.utc)
        await self.http("/rest/v1/profiles?on_conflict=id", {
            "id": self.user, "email": email, "name": "Temporary syllabus validation", "role": "user",
            "plan": "intensive", "plan_duration": 1, "plan_expires_at": (now+timedelta(hours=3)).isoformat(),
            "wallet_reset_at": (now+timedelta(days=30)).isoformat(), "voice_minutes_balance": 360,
            "text_teaching_balance": 600, "quiz_attempts_used": 0,
        }, service=True, headers={"Prefer": "resolution=merge-duplicates,return=representation"})
        form = urllib.parse.urlencode({"email": email, "password": password, "next": "/voice"}).encode()
        await self.http("/auth/password", raw=form, headers={"Content-Type": "application/x-www-form-urlencoded"})
        prepared = await self.http("/api/rag/ingest-batch", {
            "action": "prepare", "files": [{"name": "inflammation-fixture.txt", "size": len(FIXTURE), "type": "text/plain"}],
        })
        self.syllabus = prepared["syllabusId"]
        upload = prepared["uploads"][0]
        path = upload["path"]
        if not path.startswith(self.user + "/" + self.syllabus + "/"):
            raise RuntimeError("Upload path is not owned by fixture")
        self.paths.append(path)
        url = DB + "/storage/v1/object/upload/sign/" + BUCKET + "/" + urllib.parse.quote(path, safe="/") + "?token=" + urllib.parse.quote(upload["token"], safe="")
        await self.http(url, method="PUT", raw=FIXTURE, headers={"Content-Type": "text/plain", "x-upsert": "false"})
        await self.http("/api/rag/ingest-batch", {"action": "confirm", "documentId": upload["documentId"]})
        async def step(action, **kwargs):
            return await self.http("/api/rag/compile-syllabus", {"syllabusId": self.syllabus, "action": action, **kwargs})
        plan = await step("prepare")
        offset = 0
        count = 0
        while True:
            part = await step("parse", itemId=plan["documents"][0]["id"], offset=offset)
            count += len(part.get("ids", []))
            if part["done"]:
                break
            offset = part["next"]
        if count < 3:
            raise RuntimeError("Expected multiple real lecture concepts")
        await step("publish")
        print("PASS real authenticated source upload and syllabus index", flush=True)

    def trusted(self, participant):
        return bool(participant and participant.kind == rtc.ParticipantKind.PARTICIPANT_KIND_AGENT)

    async def wait(self, predicate, timeout=75):
        deadline = time.monotonic() + timeout
        while time.monotonic() < deadline:
            for event in self.events:
                if event.get("type") == "TUTOR_RECOVERY_REQUIRED":
                    raise RuntimeError("Worker reported lesson recovery required")
                if predicate(event):
                    return event
            self.changed.clear()
            try:
                await asyncio.wait_for(self.changed.wait(), min(1, max(0.01, deadline-time.monotonic())))
            except asyncio.TimeoutError:
                pass
        raise RuntimeError("Timed out waiting for verified syllabus event")

    async def send(self, data):
        await self.room.local_participant.publish_data(
            json.dumps({"session_id": self.session, **data}).encode(), reliable=True, topic="lk-lesson-state")

    async def start(self):
        conversation = await self.http("/api/teaching/conversations", {
            "courseName": "Anatomical Pathology", "title": "Temporary syllabus validation", "sessionType": "live_class",
        })
        token = await self.http("/api/voice/token", {
            "courseName": "Anatomical Pathology", "syllabusId": self.syllabus,
            "conversationId": conversation["conversation"]["id"], "inputMode": "press_to_talk",
        })
        self.session = token["sessionId"]
        if urllib.parse.urlsplit(token["url"]).hostname != urllib.parse.urlsplit(os.environ["LIVEKIT_URL"]).hostname:
            raise RuntimeError("Production token chose a different LiveKit project than worker deployment")
        self.room = rtc.Room()

        @self.room.on("data_received")
        def data_received(packet):
            if packet.topic != "lk-lesson-state" or not self.trusted(packet.participant):
                return
            try:
                event = json.loads(packet.data)
            except (ValueError, UnicodeError):
                return
            if event.get("protocol") != PROTOCOL or event.get("session_id") != self.session:
                return
            self.verified.add(packet.participant.identity)
            if packet.participant.identity in self.heard:
                self.audible.set()
            self.events.append(event)
            self.changed.set()

        async def listen(track, identity):
            stream = rtc.AudioStream(track, sample_rate=16000, num_channels=1)
            try:
                async for event in stream:
                    if max((abs(value) for value in event.frame.data), default=0) > 200:
                        self.heard.add(identity)
                        if identity in self.verified:
                            self.audible.set()
            finally:
                await stream.aclose()

        @self.room.on("track_subscribed")
        def track_subscribed(track, _publication, participant):
            if track.kind == rtc.TrackKind.KIND_AUDIO and self.trusted(participant):
                self.tasks.append(asyncio.create_task(listen(track, participant.identity)))

        await self.room.connect(token["url"], token["token"])
        async def hello():
            while True:
                await self.send({"type": "HELLO"})
                await asyncio.sleep(0.75)
        poll = asyncio.create_task(hello())
        self.tasks.append(poll)
        try:
            await self.wait(lambda e: e.get("type") == "WORKER_READY" and e.get("session_id") == self.session, timeout=35)
        finally:
            poll.cancel()
        await self.send({"type": "OPEN_LESSON", "syllabus_id": self.syllabus})
        first = await self.wait(lambda e: e.get("type") == "SYNC_VISUAL_STAGE" and bool(e.get("cue", {}).get("citations")))
        await asyncio.wait_for(self.audible.wait(), 25)
        await self.wait(lambda e: e.get("type") == "SYNC_VISUAL_STAGE" and bool(e.get("cue", {}).get("citations"))
                        and (e.get("concept_node_id"),e.get("cue_index")) != (first.get("concept_node_id"),first.get("cue_index")))
        print("PASS real token targets deployed worker; remote audio and automatic cited visual progression", flush=True)

    async def question(self):
        source = rtc.AudioSource(16000, 1, queue_size_ms=200)
        track = rtc.LocalAudioTrack.create_audio_track("fixture-microphone", source)
        publication = await self.room.local_participant.publish_track(
            track, rtc.TrackPublishOptions(source=rtc.TrackSource.SOURCE_MICROPHONE))
        turn = uuid.uuid4().hex
        try:
            await self.send({"type": "ptt_start", "turnId": turn})
            await self.wait(lambda e: e.get("type") == "live_class_ptt_state" and e.get("turnId") == turn and e.get("phase") == "listening", timeout=10)
            output = await asyncio.to_thread(subprocess.run, ["espeak-ng", "--stdout", "-s", "145", "What is diapedesis?"], capture_output=True, check=True)
            with wave.open(io.BytesIO(output.stdout), "rb") as recording:
                assert recording.getsampwidth() == 2 and recording.getnchannels() == 1
                rate = recording.getframerate()
                samples = array("h", recording.readframes(recording.getnframes()))
            # Convert mono fixture to the published 16 kHz sample rate.
            pcm = array("h", (samples[min(len(samples)-1, int(i*rate/16000))] for i in range(int(len(samples)*16000/rate)))).tobytes()
            for offset in range(0, len(pcm), 640):
                await source.capture_frame(rtc.AudioFrame(pcm[offset:offset+640].ljust(640, b"\0"), 16000, 1, 320))
            await source.wait_for_playout()
            for _ in range(8):
                await source.capture_frame(rtc.AudioFrame(bytes(640), 16000, 1, 320))
            await source.wait_for_playout()
            await self.send({"type": "ptt_end", "turnId": turn})
            await self.wait(lambda e: e.get("type") == "live_class_ptt_state" and e.get("turnId") == turn and e.get("phase") == "released", timeout=15)
            await self.wait(lambda e: e.get("type") == "SCRATCHPAD_EVIDENCE" and bool(e.get("question")), timeout=20)
            await self.wait(lambda e: e.get("type") == "RESTORE_VISUAL_STATE", timeout=50)
            print("PASS press, real microphone transcription, release, question and lesson restoration", flush=True)
        finally:
            await self.room.local_participant.unpublish_track(publication.sid)
            await source.aclose()

    async def cleanup(self):
        failed = False
        if self.session:
            try:
                result = await self.http("/api/voice/session", {"sessionId": self.session, "action": "end",
                    "durationSeconds": min(180, int(time.monotonic()-self.started))})
                if result.get("cleanupPending"):
                    raise RuntimeError("Server reported pending purge")
            except Exception:
                failed = True
        if self.room:
            await self.room.disconnect()
        for task in self.tasks:
            task.cancel()
        await asyncio.gather(*self.tasks, return_exceptions=True)
        if self.syllabus and self.user:
            try:
                await self.http("/api/rag/cleanup", {"action": "purge-syllabus", "syllabusId": self.syllabus})
                for table in ("study_documents", "document_atomic_chunks", "syllabus_concept_nodes"):
                    rows = await self.http("/rest/v1/" + table + "?select=id&syllabus_id=eq." + self.syllabus + "&user_id=eq." + self.user, service=True)
                    if rows:
                        raise RuntimeError("Fixture index rows remain after purge")
                rows = await self.http("/rest/v1/study_syllabi?select=status&id=eq." + self.syllabus + "&user_id=eq." + self.user, service=True)
                if not rows or rows[0]["status"] != "purged":
                    raise RuntimeError("Fixture syllabus purge state not confirmed")
                objects = await self.http("/storage/v1/object/list/" + BUCKET,
                    {"prefix": self.user + "/" + self.syllabus, "limit": 100}, service=True)
                if objects:
                    raise RuntimeError("Fixture raw uploads remain")
                print("PASS actual ephemeral storage and source index purge", flush=True)
            except Exception:
                failed = True
        if self.user:
            if failed and self.paths:
                owned = [p for p in self.paths if p.startswith(self.user + "/")]
                if owned:
                    await self.http("/storage/v1/object/" + BUCKET, {"prefixes": owned}, service=True, method="DELETE")
            await self.http("/auth/v1/admin/users/" + self.user, service=True, method="DELETE")
        if failed:
            raise RuntimeError("Fixture cleanup verification failed")


async def main():
    fixture = Fixture()
    try:
        await fixture.setup()
        await fixture.start()
        await fixture.question()
    finally:
        await fixture.cleanup()

if __name__ == "__main__":
    asyncio.run(main())
