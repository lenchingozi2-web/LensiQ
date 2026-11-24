"""Real production classroom smoke test using only the saved parser extraction.
Copies it to a disposable owner-scoped syllabus; never re-uploads the medical PDF
or changes the original learner's files. Uses the authenticated /voice pathways.
"""
import asyncio
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
from array import array
from datetime import datetime, timedelta, timezone

from livekit import rtc

APP = "https://www.lenxiq.online"
DB = "https://hixvbcrrklyajhkyliay.supabase.co"
BUCKET = "study-documents"
PROTOCOL = "lensiq-syllabus-v2"
PARSER_VERSION = 2
SOURCE_DOCUMENT_ID = "bef16e4e-afc8-4e46-abd8-80cc4f74a05d"
SOURCE_SYLLABUS_ID = "3c2f9cbd-73da-4277-81e2-486f7d060b93"


class Fixture:
    def __init__(self):
        if os.environ.get("NEXT_PUBLIC_SUPABASE_URL", "").rstrip("/") != DB:
            raise RuntimeError("Wrong project; fixture refused")
        self.key = os.environ["SUPABASE_SERVICE_ROLE_KEY"]
        self.browser = urllib.request.build_opener(
            urllib.request.HTTPCookieProcessor(http.cookiejar.CookieJar()))
        self.user = self.syllabus = self.session = self.room = None
        self.document = None
        self.paths = []
        self.tasks = []
        self.events = []
        self.changed = asyncio.Event()
        self.audible = asyncio.Event()
        self.verified = set()
        self.heard = set()
        self.audible_times = []
        self.report = {"conceptCount": 0, "outlineNodeCount": 0, "chunkCount": 0,
                       "maxChunksPerConcept": 0, "firstTwoConceptIds": [], "timingsSeconds": {}}
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

    async def all_service_rows(self, path, page_size=500):
        rows = []
        offset = 0
        while True:
            separator = '&' if '?' in path else '?'
            page = await self.http(path + separator + f"limit={page_size}&offset={offset}", service=True)
            rows.extend(page)
            if len(page) < page_size:
                return rows
            offset += page_size

    async def setup(self):
        source = await self.http("/rest/v1/study_documents?select=id,syllabus_id,original_name&id=eq." +
                                 SOURCE_DOCUMENT_ID + "&limit=1", service=True)
        if len(source) != 1 or source[0]["syllabus_id"] != SOURCE_SYLLABUS_ID or source[0]["original_name"] != "AnathPathNotes.pdf":
            raise RuntimeError("Expected cached medical-note source was not found in the in-scope project")
        cached = await self.http("/rest/v1/study_document_extractions?select=parser_version,extraction_json&document_id=eq." +
                                 SOURCE_DOCUMENT_ID + "&syllabus_id=eq." + SOURCE_SYLLABUS_ID + "&limit=1", service=True)
        extraction = cached[0].get("extraction_json", {}).get("text", "") if cached else ""
        if len(cached) != 1 or cached[0].get("parser_version") != PARSER_VERSION or len(extraction) < 500_000:
            raise RuntimeError("The saved current-version medical-note extraction is unavailable or incomplete")
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
        self.syllabus = str(uuid.uuid4())
        self.document = str(uuid.uuid4())
        marker = b"Temporary non-medical test marker; cached source text is used for parsing."
        self.marker_path = f"{self.user}/{self.syllabus}/{self.document}.pdf"
        await self.http("/rest/v1/study_syllabi", {
            "id": self.syllabus, "user_id": self.user, "status": "draft",
            "reserved_bytes": len(marker), "used_bytes": len(marker),
            "expires_at": (now + timedelta(minutes=50)).isoformat(),
        }, service=True, headers={"Prefer": "return=representation"})
        await self.http("/rest/v1/study_documents", {
            "id": self.document, "syllabus_id": self.syllabus, "user_id": self.user,
            "original_name": "AnathPathNotes.pdf", "storage_path": self.marker_path,
            "reserved_size_bytes": len(marker), "actual_size_bytes": len(marker), "status": "uploaded",
        }, service=True, headers={"Prefer": "return=representation"})
        await self.http("/storage/v1/object/" + BUCKET + "/" + self.marker_path,
            raw=marker, method="POST", service=True, headers={"Content-Type": "application/pdf", "x-upsert": "false"})
        self.paths.append(self.marker_path)
        await self.http("/rest/v1/study_document_extractions", {
            "document_id": self.document, "syllabus_id": self.syllabus, "user_id": self.user,
            "parser_version": PARSER_VERSION, "extraction_json": {"version": PARSER_VERSION, "text": extraction},
        }, service=True, headers={"Prefer": "return=minimal"})
        async def step(action, **kwargs):
            return await self.http("/api/rag/compile-syllabus", {"syllabusId": self.syllabus, "action": action, **kwargs})
        plan = await step("prepare")
        if len(plan.get("documents", [])) != 1 or plan["documents"][0]["id"] != self.document:
            raise RuntimeError("Temporary source reservation was not owner-scoped")
        first = await step("parse", itemId=self.document, offset=0)
        self.report["firstTwoConceptIds"] = first.get("ids", [])
        if len(first.get("ids", [])) != 2 or first.get("done") or first.get("next") != 2:
            raise RuntimeError("The deterministic parser did not publish exactly Concepts 1–2 first")
        self.report["firstTwoVectorPreparation"] = []
        for concept_id in first["ids"]:
            try:
                await step("node", itemId=concept_id)
                self.report["firstTwoVectorPreparation"].append("prepared")
            except Exception:
                # Semantic vectors are optional; lexical retrieval remains usable.
                self.report["firstTwoVectorPreparation"].append("lexical_fallback")
        offset = first["next"]
        count = len(first["ids"])
        while True:
            part = await step("parse", itemId=self.document, offset=offset)
            count += len(part.get("ids", []))
            if part["done"]:
                break
            offset = part["next"]
        self.report["conceptCount"] = count
        if count < 10 or count > 500 or count > 1000:
            raise RuntimeError("The medical-note consolidated concept count fell outside the expected sane range and 1,000-row cap")
        await step("publish")
        nodes = await self.all_service_rows("/rest/v1/syllabus_concept_nodes?select=id,title&syllabus_id=eq." + self.syllabus +
            "&user_id=eq." + self.user + "&generation=eq.1&node_type=eq.concept&order=sort_order")
        bad_titles = ("editing note", "source lectures", "selected visual references", "foundation to clinical application",
                      "lecture-based, concept-organised revision copy", "system pathology: heart, lung, gut, kidney, cns and reproductive organs")
        if any(any(label in row["title"].strip().lower() for label in bad_titles) for row in nodes):
            raise RuntimeError("Pathology document cover/editorial metadata leaked into teachable concepts")
        self.report["outlineNodeCount"] = len(nodes)
        if len(nodes) != count:
            raise RuntimeError("The persisted deterministic outline differs from the parsed concept count")
        if len(nodes) > 1000:
            raise RuntimeError("The persisted outline exceeded the 1,000-row concept cap")
        chunks = await self.all_service_rows("/rest/v1/document_atomic_chunks?select=concept_node_id&syllabus_id=eq." + self.syllabus +
            "&user_id=eq." + self.user + "&generation=eq.1")
        per_concept = {}
        for chunk in chunks:
            per_concept[chunk["concept_node_id"]] = per_concept.get(chunk["concept_node_id"], 0) + 1
        self.report["chunkCount"] = len(chunks)
        self.report["maxChunksPerConcept"] = max(per_concept.values(), default=0)
        if not chunks or self.report["maxChunksPerConcept"] > 4:
            raise RuntimeError("Compiled source chunks exceeded the four-chunk concept bound")
        status = await self.http("/rest/v1/study_syllabi?select=status,active_generation&id=eq." + self.syllabus +
                                 "&user_id=eq." + self.user + "&limit=1", service=True)
        if not status or status[0]["status"] != "ready" or status[0]["active_generation"] != 1:
            raise RuntimeError("A fully parsed syllabus did not recover into SYLLABUS_READY")
        doc_status = await self.http("/rest/v1/study_documents?select=status&id=eq." + self.document + "&limit=1", service=True)
        if not doc_status or doc_status[0]["status"] != "indexed":
            raise RuntimeError("Cached medical notes were not fully indexed")
        await step("lesson", itemId=self.report["firstTwoConceptIds"][0])
        self.report["firstLessonPrepared"] = True
        print(json.dumps({"check": "cached medical notes compiled", **self.report}, sort_keys=True), flush=True)

    def trusted(self, participant):
        return bool(participant and participant.kind == rtc.ParticipantKind.PARTICIPANT_KIND_AGENT)

    async def wait(self, predicate, timeout=75, after=0):
        deadline = time.monotonic() + timeout
        while time.monotonic() < deadline:
            for event in self.events:
                if event.get("_received_at", 0) < after:
                    continue
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
        class_started = time.monotonic()
        conversation = await self.http("/api/teaching/conversations", {
            "courseName": "Anatomical Pathology", "title": "Temporary syllabus validation", "sessionType": "live_class",
        })
        token = await self.http("/api/voice/token", {
            "courseName": "Anatomical Pathology", "syllabusId": self.syllabus,
            "conversationId": conversation["conversation"]["id"], "inputMode": "press_to_talk",
        })
        self.session = token["sessionId"]
        self.started = class_started
        self.report["timingsSeconds"]["tokenRequest"] = round(time.monotonic() - class_started, 2)
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
            event["_received_at"] = time.monotonic()
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
                        self.audible_times.append(time.monotonic())
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
        self.report["timingsSeconds"]["tokenToFirstCitedVisual"] = round(first["_received_at"] - class_started, 2)
        first_speech = str(first.get("cue", {}).get("spoken_text", "")).strip()
        if len(first_speech) < 60 or not any(mark in first_speech for mark in ".!?\n"):
            raise RuntimeError("The first medical lesson cue was not a complete spoken explanation")
        deadline = time.monotonic() + 25
        first_audio = None
        while time.monotonic() < deadline and first_audio is None:
            first_audio = next((at for at in self.audible_times if at >= first["_received_at"]), None)
            if first_audio is None:
                await asyncio.sleep(0.1)
        if first_audio is None:
            raise RuntimeError("No non-silent speech followed the first cited board cue")
        self.report["timingsSeconds"]["visualToFirstAudibleSpeech"] = round(first_audio - first["_received_at"], 2)
        if self.report["timingsSeconds"]["tokenToFirstCitedVisual"] > 15:
            raise RuntimeError("Prepared medical lesson startup exceeded 15 seconds")
        await self.wait(lambda e: e.get("type") == "SYNC_VISUAL_STAGE" and bool(e.get("cue", {}).get("citations"))
                        and (e.get("concept_node_id"),e.get("cue_index")) != (first.get("concept_node_id"),first.get("cue_index")))
        self.report["checks"] = ["REAL_CACHED_MEDICAL_NOTES", "FAST_PREPARED_CLASS_START", "CITED_VISUAL_SYNCED_TO_AUDIO"]
        print(json.dumps({"check": "real classroom started", "timingsSeconds": self.report["timingsSeconds"]}, sort_keys=True), flush=True)

    async def question(self):
        source = rtc.AudioSource(16000, 1, queue_size_ms=200)
        track = rtc.LocalAudioTrack.create_audio_track("fixture-microphone", source)
        publication = await self.room.local_participant.publish_track(
            track, rtc.TrackPublishOptions(source=rtc.TrackSource.SOURCE_MICROPHONE))
        turn = uuid.uuid4().hex
        try:
            question_started = time.monotonic()
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
            transcript = await self.wait(lambda e: e.get("type") == "live_class_user_transcript", timeout=20, after=question_started)
            if "diapedesis" not in transcript.get("content", "").lower():
                raise RuntimeError("The medical interruption question was not transcribed accurately")
            scratch = await self.wait(lambda e: e.get("type") == "SCRATCHPAD_EVIDENCE" and bool(e.get("question")), timeout=25, after=transcript["_received_at"])
            citations = scratch.get("citations") or []
            if not citations or "anathpathnotes" not in json.dumps(citations).lower():
                raise RuntimeError("The interruption answer did not cite the cached medical notes")
            scratch_stage = await self.wait(lambda e: e.get("type") == "SYNC_VISUAL_STAGE" and
                e.get("cue", {}).get("mode") == "whiteboard_scratchpad", timeout=10, after=transcript["_received_at"])
            answer_start = await self.wait(lambda e: e.get("type") == "ANSWER_STARTED", timeout=20, after=scratch["_received_at"])
            answer = await self.wait(lambda e: e.get("type") == "ANSWER_TEXT" and bool(e.get("content")), timeout=45, after=answer_start["_received_at"])
            answer_text = answer["content"].lower()
            if not (any(term in answer_text for term in ("vessel", "endothelial", "bloodstream")) and
                    any(term in answer_text for term in ("through", "between", "cross", "migrat", "move", "pass"))):
                raise RuntimeError("The medical interruption answer was not grounded in diapedesis through vessel walls")
            if not any(answer_start["_received_at"] <= at <= answer["_received_at"] for at in self.audible_times):
                raise RuntimeError("The tutor's interruption answer was not audibly spoken")
            restored = await self.wait(lambda e: e.get("type") == "RESTORE_VISUAL_STATE", timeout=50, after=answer["_received_at"])
            snapshot = restored.get("snapshot") or {}
            if (snapshot.get("concept_node_id"), snapshot.get("cue_index")) != \
                    (scratch_stage.get("concept_node_id"), scratch_stage.get("cue_index")):
                raise RuntimeError("The original concept/cue checkpoint was not restored exactly")
            previous_cues = [e for e in self.events if e.get("type") == "SYNC_VISUAL_STAGE" and
                e.get("_received_at", 0) < scratch_stage["_received_at"] and
                (e.get("concept_node_id"), e.get("cue_index")) ==
                (snapshot.get("concept_node_id"), snapshot.get("cue_index")) and e.get("cue", {}).get("citations")]
            if not previous_cues or (snapshot.get("active_cue") or {}).get("id") != previous_cues[-1]["cue"].get("id"):
                raise RuntimeError("The restored whiteboard did not match the exact pre-interruption cue")
            resumed = await self.wait(lambda e: e.get("type") == "SYNC_VISUAL_STAGE" and
                (e.get("concept_node_id"), e.get("cue_index")) ==
                (snapshot.get("concept_node_id"), snapshot.get("cue_index")) and e.get("cue", {}).get("citations"),
                timeout=25, after=restored["_received_at"])
            self.report["checks"].extend(["ACCURATE_CITED_MEDICAL_ANSWER", "AUDIBLE_INTERRUPTION_RESPONSE",
                                          "EXACT_CUE_RESTORATION_AND_RESUMPTION"])
            self.report["restoredCueIndex"] = resumed["cue_index"]
            print("PASS real microphone question, cited medical answer, audible response and exact cue restoration", flush=True)
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
                    rows = await self.http("/rest/v1/" + table + "?select=id&syllabus_id=eq." + self.syllabus + "&user_id=eq." + self.user + "&limit=10", service=True)
                    if rows:
                        raise RuntimeError("Fixture index rows remain after purge")
                rows = await self.http("/rest/v1/study_document_extractions?select=document_id&syllabus_id=eq." + self.syllabus + "&user_id=eq." + self.user + "&limit=10", service=True)
                if rows:
                    raise RuntimeError("Copied temporary extraction remains after purge")
                rows = await self.http("/rest/v1/study_syllabi?select=status&id=eq." + self.syllabus + "&user_id=eq." + self.user + "&limit=1", service=True)
                if not rows or rows[0]["status"] != "purged":
                    raise RuntimeError("Fixture syllabus purge state not confirmed")
                objects = await self.http("/storage/v1/object/list/" + BUCKET,
                    {"prefix": self.user + "/" + self.syllabus, "limit": 100}, service=True)
                if objects:
                    raise RuntimeError("Fixture raw uploads remain")
                lesson = await self.http("/rest/v1/live_class_lessons?select=phase,visual_stack_json,nodes_json,delivered_checkpoint_json&session_id=eq." + self.session + "&user_id=eq." + self.user + "&limit=1", service=True)
                if not lesson or lesson[0]["phase"] != "COMPLETED" or lesson[0]["visual_stack_json"] != [] or lesson[0]["nodes_json"] != [] or lesson[0]["delivered_checkpoint_json"] is not None:
                    raise RuntimeError("Saved lesson checkpoint or visual state remains after purge")
                source = await self.http("/rest/v1/study_document_extractions?select=document_id&document_id=eq." + SOURCE_DOCUMENT_ID + "&syllabus_id=eq." + SOURCE_SYLLABUS_ID + "&limit=1", service=True)
                if len(source) != 1:
                    raise RuntimeError("Original cached medical extraction was changed during temporary cleanup")
                self.report["checks"].append("TEMP_RAW_EXTRACTION_CHUNKS_AND_CHECKPOINTS_PURGED")
                print("PASS copied extraction, temporary raw marker, chunks, concept nodes and saved lesson state purged; original cache retained", flush=True)
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
    failure = None
    try:
        await fixture.setup()
        await fixture.start()
        await fixture.question()
    except Exception as error:
        failure = type(error).__name__ + ": " + str(error)
    finally:
        try:
            await fixture.cleanup()
        except Exception as error:
            failure = failure or (type(error).__name__ + ": temporary cleanup verification failed")
        fixture.report["error"] = failure
        Path("syllabus-class-validation.json").write_text(json.dumps(fixture.report, indent=2))
        print(json.dumps({"check": "medical-notes classroom validation", **fixture.report}, sort_keys=True), flush=True)
    if failure:
        raise RuntimeError(failure)

if __name__ == "__main__":
    asyncio.run(main())
