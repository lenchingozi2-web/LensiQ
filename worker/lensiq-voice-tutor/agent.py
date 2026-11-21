"""LiveKit Cloud worker for LenxiQ course- and lecture-grounded classes."""
from __future__ import annotations

import asyncio
import json
import logging
import os
import time
from typing import Any, AsyncIterator

from medical_speech import medical_speech, spoken_sentences

import httpx
from dotenv import load_dotenv
from livekit.agents import Agent, AgentServer, AgentSession, JobContext, cli, inference

load_dotenv()
log = logging.getLogger("lensiq.voice.tutor")
server = AgentServer()
CHANNEL = "lk-lesson-state"


class SyllabusVoiceTutor:
    def __init__(self, ctx: JobContext, session: AgentSession, metadata: dict[str, Any]):
        self.ctx = ctx
        self.session = session
        self.user_id = str(metadata["userId"])
        self.session_id = str(metadata["sessionId"])
        self.base = str(metadata["orchestrateEndpoint"]).rsplit("/api/live-class/orchestrate", 1)[0]
        self.token = str(metadata["voiceGatewayToken"])
        self.http = httpx.AsyncClient(timeout=55.0, follow_redirects=False)
        self.packet: dict[str, Any] | None = None
        self.state_version = 0
        self.cue_index = 0
        self.speech_task: asyncio.Task[None] | None = None
        self.answer_task: asyncio.Task[None] | None = None
        self.speaking = False
        self.interrupting = False
        self.pending_visual: dict[str, Any] | None = None
        self.restoration: dict[str, Any] | None = None
        self._request_lock = asyncio.Lock()
        self._commands = asyncio.Lock()
        self.syllabus_id = metadata.get("syllabusId")
        self.course = metadata.get("courseName") or "Live Class"
        self.focus = metadata.get("focusText") or ""
        self.started = False
        self.ptt = metadata.get("inputMode") == "press_to_talk"
        self.turn_id = None
        self.turn_words: list[str] = []
        self.release_task: asyncio.Task | None = None
        self.last_visual = None
        self.media_ready = False
        self.away_task: asyncio.Task | None = None
        self.selection: dict[str, Any] = {}
        self.previous_title = ""
        self.lookahead_task: asyncio.Task | None = None
        self.visual_focus_until = 0.0
        self.pace = max(0.8, min(1.15, float(metadata.get("teachingPace", 0.94))))

    async def publish(self, data: dict[str, Any]) -> None:
        if data.get("type") == "SYNC_VISUAL_STAGE":
            self.last_visual = data
        await self.ctx.room.local_participant.publish_data(
            json.dumps({**data, "protocol": "lensiq-syllabus-v2", "session_id": self.session_id}, ensure_ascii=False, separators=(",", ":")).encode(),
            reliable=True, topic=CHANNEL,
            destination_identities=[self.user_id],
        )

    async def api(self, route: str, payload: dict[str, Any]) -> dict[str, Any]:
        async with self._request_lock:
            response = await self.http.post(
                self.base + route,
                json={"sessionId": self.session_id, **payload},
                headers={"Authorization": "Bearer " + self.token},
            )
            response.raise_for_status()
            result = response.json()
            if not result.get("ok"):
                raise RuntimeError("Tutor server rejected lesson transition")
            return result

    async def text_stream(self, prompt: str, task: str) -> AsyncIterator[str]:
        async with self.http.stream(
            "POST", self.base + "/api/live-class/stream",
            headers={"Authorization": "Bearer " + self.token},
            json={"sessionId": self.session_id, "packet": prompt[:3400], "task": task},
            timeout=30.0,
        ) as response:
            response.raise_for_status()
            async for line in response.aiter_lines():
                if not line.startswith("data: "):
                    continue
                data = json.loads(line[6:])
                if isinstance(data.get("text"), str):
                    yield data["text"]
                elif data.get("error"):
                    raise RuntimeError("Both tutor speech model providers unavailable")

    async def grounded_speech(self, prompt: str, task: str, fallback: str) -> AsyncIterator[str]:
        """Never restart partial speech or substitute raw lecture text for an explanation."""
        emitted = False
        try:
            async for text in self.text_stream(prompt, task):
                if text:
                    emitted = True
                    yield text
        except asyncio.CancelledError:
            raise
        except Exception:
            if emitted:
                raise
            log.warning("Tutor generation unavailable before first token; using a safe spoken recovery", exc_info=True)
        if not emitted:
            await self.publish({"type":"ANSWER_UNAVAILABLE","reason":"providers_busy"})
            yield fallback

    async def play_packet(self, packet: dict[str, Any], begin: int = 0) -> None:
        if packet.get("teaching_version") != 3:
            await self.publish({"type":"TUTOR_RECOVERY_REQUIRED","reason":"teaching_plan_required","state_version":self.state_version})
            return
        self.packet = packet
        self.state_version = int(packet["state_version"])
        cues = packet.get("visual_cues") or []
        if not isinstance(cues, list):
            return
        if self.lookahead_task and not self.lookahead_task.done():
            self.lookahead_task.cancel()
        self.lookahead_task = asyncio.create_task(self.prepare_next())
        try:
            for index in range(begin, len(cues)):
                if self.interrupting:
                    return
                self.cue_index = index
                cue = cues[index]
                self.pending_visual = {
                    "type": "SYNC_VISUAL_STAGE",
                    "state_version": self.state_version,
                    "concept_node_id": packet["concept_node_id"],
                    "cue_index": index,
                    "cue_count": len(cues),
                    "cue": cue,
                }
                if index == begin:
                    # Keep the wire checkpoint bounded even for a legacy node with many cues.
                    # The worker retains the whole teaching packet and publishes each later beat.
                    if not self.started:
                        await self.publish({
                            "type": "LESSON_OPENED", "state_version": self.state_version,
                            "packet": {**packet, "visual_cues": [cue]},
                            "visual_stack": [{"active_mode": cue["mode"], "cue_index": 0,
                                              "concept_node_id": packet["concept_node_id"]}],
                        })
                # The authored beat has already passed coverage and recitation checks.
                # Synthesize it directly to preserve detail and avoid another model round trip.
                speech = medical_speech(cue["spoken_text"])
                self.started = True
                handle = self.session.say(speech, allow_interruptions=True)
                # Consecutive handles can share a speaking state. In that case
                # stage this checkpoint now; otherwise on_audio_state stages it
                # when synthesized audio actually begins.
                if self.speaking and self.pending_visual:
                    await self.publish(self.pending_visual)
                    self.pending_visual = None
                await handle.wait_for_playout()
                if self.interrupting or handle.interrupted:
                    return
                await asyncio.sleep(0.55 if cue["mode"] == "whiteboard" else 1.8)
                while time.monotonic() < self.visual_focus_until and not self.interrupting:
                    await asyncio.sleep(0.2)
            if not self.interrupting:
                self.previous_title = str(packet.get("title", ""))[:200]
                while True:
                    result = await self.api("/api/live-class/orchestrate", {
                        "action": "node_complete", "stateVersion": self.state_version,
                        "conceptNodeId": packet["concept_node_id"],
                    })
                    if not result.get("waiting"):
                        break
                    await asyncio.sleep(2)
                if result.get("stale"):
                    return
                if result.get("packet"):
                    self.speech_task = asyncio.create_task(self.play_packet(result["packet"]))
                else:
                    await self.publish({"type": "LESSON_COMPLETED", "state_version": result["state"]["state_version"]})
        except asyncio.CancelledError:
            raise
        except Exception:
            log.exception("Could not deliver a complete syllabus cue")
            await self.publish({"type": "TUTOR_RECOVERY_REQUIRED", "state_version": self.state_version})

    async def prepare_next(self) -> None:
        # Plan the following idea during audible teaching. This request must not
        # hold the interaction lock or delay a student's question.
        try:
            response = await self.http.post(self.base + "/api/live-class/orchestrate",
                json={"sessionId":self.session_id,"action":"prepare_next"},
                headers={"Authorization":"Bearer " + self.token}, timeout=55)
            response.raise_for_status()
        except asyncio.CancelledError:
            raise
        except Exception:
            log.info("Next teaching idea will be prepared on demand")

    def on_audio_state(self, state: str) -> None:
        if state == "speaking":
            self.speaking = True
            if self.pending_visual:
                payload, self.pending_visual = self.pending_visual, None
                asyncio.create_task(self.publish(payload))
        else:
            self.speaking = False

    async def interrupt(self) -> None:
        if self.interrupting or not self.packet:
            return
        self.interrupting = True
        try:
            # LiveKit interrupts the actual audio playout, not merely the text generator.
            await self.session.interrupt(force=True)
            if self.speech_task and not self.speech_task.done():
                self.speech_task.cancel()
            cue = self.packet["visual_cues"][self.cue_index]
            snapshot = {
                "active_mode": cue["mode"],
                "concept_node_id": self.packet["concept_node_id"],
                "cue_index": self.cue_index,
                "active_cue": cue,
                "whiteboard_snapshot": [
                    step for item in self.packet["visual_cues"][:self.cue_index + 1]
                    for step in item.get("steps", [])[:8]
                ][:30],
            }
            result = await self.api("/api/live-class/orchestrate", {
                "action": "barge_in", "stateVersion": self.state_version,
                "visualSnapshot": snapshot,
            })
            self.state_version = int(result["state"]["state_version"])
            self.restoration = snapshot
            await self.publish({
                "type": "SYNC_VISUAL_STAGE", "state_version": self.state_version,
                "concept_node_id": snapshot["concept_node_id"], "cue_index": self.cue_index,
                "cue": {"id": "interrupt-scratchpad", "mode": "whiteboard_scratchpad",
                        "title": "Your question", "spoken_text": "I am listening.",
                        "steps": [], "citations": []},
            })
        except Exception:
            log.exception("Could not switch to learner interruption state")
            self.interrupting = False

    async def answer(self, question: str) -> None:
        if not question.strip():
            return
        if not self.packet:
            await self.publish({"type":"ANSWER_UNAVAILABLE","reason":"lesson_not_ready"})
            return
        if not self.interrupting:
            await self.interrupt()
        if not self.interrupting:
            return
        try:
            data = await self.api("/api/live-class/interrupt-rag", {"query": question})
            matches = data.get("matches", [])[:5]
            references = []
            budget = 1500
            for item in matches:
                passage = {"text": item["text"], "citation": item["citation"]}
                size = len(json.dumps(passage, ensure_ascii=False))
                if size <= budget:
                    references.append(passage)
                    budget -= size
            await self.publish({
                "type": "SCRATCHPAD_EVIDENCE", "state_version": self.state_version,
                "question": question, "citations": [item["citation"] for item in references],
            })
            prompt = ("Answer this medical student's specific question clearly and naturally. "
                      "Ground medical claims in these exact retrieved sources; if none were found, "
                      "say the provided files do not address it. Do not invent a citation. "
                      "The selected structure is student interaction context, not evidence of disease. "
                      + json.dumps({"question": question[:600], "sources": references, "selection": self.selection}, ensure_ascii=False))
            source_speech = self.grounded_speech(prompt, "barge_in", "I couldn’t compose that explanation just now. Please ask that question again.") if references else "I couldn't find that answer in the material indexed for this class."
            async def answer_speech():
                parts = []
                if isinstance(source_speech, str):
                    parts.append(source_speech)
                    await self.publish({"type":"ANSWER_STARTED","state_version":self.state_version})
                    yield source_speech
                else:
                    async for text in source_speech:
                        if not parts:
                            await self.publish({"type":"ANSWER_STARTED","state_version":self.state_version})
                        parts.append(text)
                        yield text
                await self.publish({"type":"ANSWER_TEXT","content":"".join(parts)[:3000]})
            handle = self.session.say(spoken_sentences(answer_speech()), allow_interruptions=True)
            await handle.wait_for_playout()
            if handle.interrupted:
                return
            result = await self.api("/api/live-class/orchestrate", {
                "action": "interrupt_done", "stateVersion": self.state_version,
            })
            restored = result.get("restoredVisual") or self.restoration
            await self.publish({"type": "RESTORE_VISUAL_STATE",
                                "state_version": result["state"]["state_version"],
                                "snapshot": restored})
            self.interrupting = False
            self.state_version = int(result["state"]["state_version"])
            if result.get("packet"):
                self.speech_task = asyncio.create_task(
                    self.play_packet(result["packet"], int(restored.get("cue_index", 0)) if restored else 0)
                )
        except asyncio.CancelledError:
            raise
        except Exception:
            log.exception("Tutor interrupted question handling failed")
            await self.publish({"type": "TUTOR_RECOVERY_REQUIRED", "state_version": self.state_version})

    async def deliver(self, syllabus_id: str, force: bool = False) -> None:
        async with self._commands:
            if not self.started and not self.packet:
                result = await self.api("/api/live-class/orchestrate", {"action": "bootstrap", "syllabusId": syllabus_id})
                if result["state"]["phase"] == "SYLLABUS_READY":
                    result = await self.api("/api/live-class/orchestrate", {
                        "action": "start", "stateVersion": result["state"]["state_version"],
                    })
                else:
                    result = await self.api("/api/live-class/orchestrate", {"action": "state"})
            else:
                result = await self.api("/api/live-class/orchestrate", {"action": "state"})
            self.syllabus_id = syllabus_id
            state = result["state"]
            if state["phase"] == "HANDLING_INTERRUPT" and force:
                result = await self.api("/api/live-class/orchestrate", {
                    "action": "interrupt_done", "stateVersion": state["state_version"],
                })
            packet = result.get("packet")
            if not packet:
                return
            if self.packet and packet["state_version"] == self.state_version and self.speech_task and not self.speech_task.done():
                if self.last_visual:
                    await self.publish(self.last_visual)
                return
            if self.speech_task:
                await self.stop_speech()
            self.packet = packet
            self.state_version = packet["state_version"]
            self.interrupting = False
            self.speech_task = asyncio.create_task(self.play_packet(packet))

    async def stop_speech(self) -> None:
        if self.speech_task and not self.speech_task.done():
            self.speech_task.cancel()
            await asyncio.gather(self.speech_task, return_exceptions=True)
        await self.session.interrupt(force=True)

    async def finish_turn(self, turn_id: str, cancelled: bool) -> None:
        if self.turn_id != turn_id:
            return
        try:
            if cancelled:
                self.session.clear_user_turn()
                question = ""
            else:
                await self.publish({"type":"live_class_ptt_state","turnId":turn_id,"phase":"processing"})
                # Reliable data may arrive before the final RTP audio packets.
                await asyncio.sleep(0.1)
                transcript = await self.session.commit_user_turn(skip_reply=True, transcript_timeout=0.45 if self.turn_words else 1.25, stt_flush_duration=0.35)
                question = (transcript or " ".join(self.turn_words)).strip()[:900]
            if self.turn_id != turn_id:
                return
            self.turn_id = None
            # Unlock hold-to-talk as soon as the transcript is accepted. Another
            # press can interrupt the spoken answer and reuse the saved checkpoint.
            await self.publish({"type":"live_class_ptt_state","turnId":turn_id,
                                "phase":"released" if question and not cancelled else "empty"})
            async with self._commands:
                if question and not cancelled:
                    await self.publish({"type":"live_class_user_transcript","content":question})
                    await self.answer(question)
                elif self.interrupting and self.packet:
                    result = await self.api("/api/live-class/orchestrate", {
                        "action": "interrupt_done", "stateVersion": self.state_version,
                    })
                    self.interrupting = False
                    if result.get("packet"):
                        self.speech_task = asyncio.create_task(self.play_packet(result["packet"], self.cue_index))
        except Exception:
            log.exception("Could not finish the learner turn")
            if self.turn_id == turn_id:
                self.turn_id = None
                await self.publish({"type":"live_class_ptt_state","turnId":turn_id,"phase":"empty"})
            await self.publish({"type":"TUTOR_RECOVERY_REQUIRED","state_version":self.state_version})

    async def expire_away(self) -> None:
        await asyncio.sleep(120)
        await self.stop_speech()
        if self.release_task:
            self.release_task.cancel()
        if self.answer_task:
            self.answer_task.cancel()
        response = await self.http.post(self.base + "/api/voice/worker-disconnect",
            json={"reason":"browser_away"}, headers={"Authorization":"Bearer " + self.token})
        response.raise_for_status()

    async def receive_packet(self, packet: dict[str, Any]) -> None:
        if not self.media_ready:
            return
        kind = packet.get("type")
        try:
            if kind == "HELLO" and packet.get("session_id") == self.session_id:
                await self.publish({"type":"WORKER_READY","session_id":self.session_id,"state_version":self.state_version})
                if self.last_visual:
                    await self.publish(self.last_visual)
            elif kind in ("OPEN_LESSON", "DELIVER_CURRENT", "TEACHING_PACKET"):
                if packet.get("session_id") != self.session_id:
                    return
                syllabus = self.syllabus_id or packet.get("syllabus_id")
                if syllabus:
                    await self.deliver(syllabus, bool(packet.get("recover")))
            elif kind in ("PAUSE_LESSON", "END_CLASS"):
                await self.stop_speech()
            elif kind == "ptt_mode":
                self.ptt = bool(packet.get("enabled"))
            elif kind == "teaching_pace":
                pace = float(packet.get("pace", 0.94))
                if not 0.8 <= pace <= 1.15:
                    return
                if abs(pace-self.pace)<0.005:
                    return
                self.pace = pace
                self.session.tts.update_options(extra_kwargs={"speed":pace,"volume":0.88})
                await self.publish({"type":"PACE_UPDATED","pace":pace,"state_version":self.state_version})
            elif kind == "explore_visual":
                self.visual_focus_until = time.monotonic() + 6
            elif kind == "browser_presence":
                if self.away_task:
                    self.away_task.cancel()
                if packet.get("hidden"):
                    self.away_task = asyncio.create_task(self.expire_away())
            elif kind in ("structure_selected", "media_selected", "simulation_state"):
                self.selection = {k:packet[k] for k in ("type","structureId","preset","variables","result","x","y") if k in packet}
                if kind != "simulation_state":
                    await self.publish({"type":"live_class_interaction_ack","awaitingQuestion":True})
            elif kind in ("concept_selected", "simulation_result"):
                self.selection = {k:packet[k] for k in ("type","concept","preset","variables","result") if k in packet}
                await self.publish({"type":"live_class_interaction_ack"})
                question = str(packet.get("concept") or ("Explain this simulation result: " + json.dumps(self.selection)))[:900]
                async with self._commands:
                    await self.answer(question)
            elif kind == "ptt_start":
                if self.release_task and not self.release_task.done():
                    self.release_task.cancel()
                    await asyncio.gather(self.release_task, return_exceptions=True)
                    await self.session.interrupt(force=True)
                self.turn_id = packet.get("turnId")
                self.turn_words = []
                self.session.clear_user_turn()
                await self.publish({"type":"live_class_ptt_state","turnId":self.turn_id,"phase":"listening"})
                async with self._commands:
                    await self.interrupt()
            elif kind in ("ptt_end","ptt_cancel") and self.turn_id == packet.get("turnId"):
                self.release_task = asyncio.create_task(self.finish_turn(self.turn_id, kind == "ptt_cancel"))
            elif kind == "STUDENT_BARGE_IN":
                async with self._commands:
                    await self.interrupt()
            elif kind == "STUDENT_QUESTION" and isinstance(packet.get("question"),str):
                async with self._commands:
                    await self.answer(packet["question"][:900])
        except Exception:
            log.exception("Tutor command failed: %s", kind)
            await self.publish({"type":"TUTOR_RECOVERY_REQUIRED","state_version":self.state_version})

    async def close(self) -> None:
        if self.lookahead_task:
            self.lookahead_task.cancel()
        if self.away_task:
            self.away_task.cancel()
        if self.speech_task:
            self.speech_task.cancel()
        if self.answer_task:
            self.answer_task.cancel()
        if self.release_task:
            self.release_task.cancel()
        await self.http.aclose()


def build_tts(pace: float = 0.94, *, http_session=None):
    return inference.TTS(model="cartesia/sonic-3.6",http_session=http_session,
                          voice="b24f41fd-00a3-4cd8-992a-a0c9f13f3ef1", language="en", sample_rate=24000,
                          extra_kwargs={"speed":pace,
                                        "volume":0.88,"emotion":"calm","max_buffer_delay_ms":400},
                          disable_system_default_fallback=True)


@server.rtc_session(agent_name="lensiq-syllabus-tutor-v2")
async def entrypoint(ctx: JobContext) -> None:
    metadata = json.loads(ctx.job.metadata or "{}")
    expected = ["userId", "sessionId", "voiceGatewayToken", "orchestrateEndpoint"]
    if any(not isinstance(metadata.get(key), str) or not metadata[key] for key in expected):
        raise RuntimeError("Signed LenxiQ lesson worker dispatch metadata missing")
    session = AgentSession(
        vad=None,
        turn_handling={"turn_detection": "manual", "interruption": {"enabled": False},
                       "preemptive_generation": {"enabled": False}},
        stt=inference.STT(model=os.getenv("LENXIQ_STT_MODEL", "deepgram/nova-3"), language="en",extra_kwargs={"interim_results":True,"endpointing":80,"punctuate":True,"smart_format":True,"no_delay":True}),
        tts=build_tts(max(0.8,min(1.15,float(metadata.get("teachingPace",0.94))))),
    )
    tutor = SyllabusVoiceTutor(ctx, session, metadata)

    @ctx.room.on("data_received")
    def on_data(packet: Any) -> None:
        if packet.topic not in (CHANNEL, "lensiq.live_class.lesson_control", "lensiq.live_class.visual_feedback") or not packet.participant or packet.participant.identity != tutor.user_id:
            return
        try:
            payload = json.loads(packet.data.decode("utf-8"))
            if isinstance(payload, dict):
                asyncio.create_task(tutor.receive_packet(payload))
        except (UnicodeDecodeError, json.JSONDecodeError):
            log.warning("Ignoring malformed lesson data packet")

    @session.on("agent_state_changed")
    def on_agent_state(event: Any) -> None:
        tutor.on_audio_state(event.new_state)

    @session.on("user_state_changed")
    def on_user_state(event: Any) -> None:
        if not tutor.ptt and event.new_state == "speaking" and tutor.speaking:
            asyncio.create_task(tutor.interrupt())

    @session.on("user_input_transcribed")
    def on_transcript(event: Any) -> None:
        if not tutor.ptt and tutor.speaking and event.transcript.strip() and not tutor.interrupting:
            asyncio.create_task(tutor.interrupt())
        if event.is_final and event.transcript.strip():
            if tutor.ptt:
                if tutor.turn_id:
                    tutor.turn_words.append(event.transcript.strip())
                return
            if not tutor.answer_task or tutor.answer_task.done():
                tutor.answer_task = asyncio.create_task(tutor.answer(event.transcript.strip()[:900]))

    await ctx.connect()
    await ctx.wait_for_participant(identity=tutor.user_id)
    @session.on("error")
    def on_error(event: Any) -> None:
        log.error("Tutor media error: %s", type(event.error).__name__)
        if not event.error.recoverable:
            asyncio.create_task(tutor.publish({"type":"TUTOR_RECOVERY_REQUIRED","state_version":tutor.state_version}))

    async def shutdown() -> None:
        try:
            if tutor.user_id not in ctx.room.remote_participants:
                await tutor.http.post(tutor.base + "/api/voice/worker-disconnect",
                                      headers={"Authorization": "Bearer " + tutor.token}, timeout=6)
        finally:
            await tutor.close()
    ctx.add_shutdown_callback(shutdown)
    try:
        await session.start(room=ctx.room, agent=Agent(instructions=(
            "Teach from verified lesson packets and retrieved lecture evidence only."
        )))
    except Exception:
        log.exception("Tutor failed during media initialization")
        try:
            await tutor.publish({"type": "TUTOR_RECOVERY_REQUIRED", "state_version": 0})
        except Exception:
            log.warning("Startup diagnostic could not be delivered", exc_info=True)
        raise
    try:
        await ctx.room.local_participant.set_attributes({
            "lensiq.protocol": "lensiq-syllabus-v2", "lensiq.session": tutor.session_id,
        })
    except Exception:
        log.warning("Participant attributes unavailable; using session-scoped packets", exc_info=True)
    tutor.media_ready = True
    await tutor.publish({"type":"WORKER_READY","session_id":tutor.session_id,"state_version":0})
    await tutor.publish({"type":"TUTOR_JOINED","session_id":tutor.session_id,"course":tutor.course})
    await asyncio.sleep(0.45)
    try:
        if not tutor.syllabus_id:
            session.say("Welcome to class. Let's begin.", allow_interruptions=True)
    except Exception:
        log.exception("Opening greeting could not be queued")
    if tutor.syllabus_id:
        try:
            await tutor.deliver(tutor.syllabus_id)
        except Exception:
            log.exception("Could not open the linked syllabus")
            await tutor.publish({"type":"TUTOR_RECOVERY_REQUIRED","state_version":tutor.state_version})


if __name__ == "__main__":
    cli.run_app(server)
