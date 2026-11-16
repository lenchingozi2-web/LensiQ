"""LenxiQ synchronous spoken-checkpoint worker.

Lives in-repo; deploy it separately as the LiveKit agent named lensiq-voice-tutor.
The existing production worker is unaffected until its deployment is switched.
"""
from __future__ import annotations

import asyncio
import json
import logging
import os
from typing import Any, AsyncIterator

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
        self.http = httpx.AsyncClient(timeout=30.0, follow_redirects=False)
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

    async def publish(self, data: dict[str, Any]) -> None:
        await self.ctx.room.local_participant.publish_data(
            json.dumps(data, ensure_ascii=False, separators=(",", ":")).encode(),
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

    async def play_packet(self, packet: dict[str, Any], begin: int = 0) -> None:
        self.packet = packet
        self.state_version = int(packet["state_version"])
        cues = packet.get("visual_cues") or []
        if not isinstance(cues, list):
            return
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
                    "cue": cue,
                }
                prompt = ("You are a lively, warm clinical lecturer. Explain this section, do not read raw "
                          "JSON or citations. Accurate source evidence follows:\n"
                          + json.dumps({"title": packet.get("title"), "cue": cue}, ensure_ascii=False))
                # The visual stage is sent when the audio state enters 'speaking',
                # not when text generation starts, reducing whiteboard lead.
                handle = self.session.say(self.text_stream(prompt, "teach"), allow_interruptions=True)
                await handle.wait_for_playout()
                if self.interrupting or handle.interrupted:
                    return
            if not self.interrupting:
                result = await self.api("/api/live-class/orchestrate", {
                    "action": "node_complete", "stateVersion": self.state_version,
                    "conceptNodeId": packet["concept_node_id"],
                })
                if result.get("packet"):
                    await self.play_packet(result["packet"])
                else:
                    await self.publish({"type": "LESSON_COMPLETED", "state_version": result["state"]["state_version"]})
        except asyncio.CancelledError:
            raise
        except Exception:
            log.exception("Could not deliver a complete syllabus cue")
            await self.publish({"type": "TUTOR_RECOVERY_REQUIRED", "state_version": self.state_version})

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
        if not question.strip() or not self.packet:
            return
        if not self.interrupting:
            await self.interrupt()
        if not self.interrupting:
            return
        try:
            data = await self.api("/api/live-class/interrupt-rag", {"query": question})
            matches = data.get("matches", [])[:5]
            references = [{"text": item["text"][:650], "citation": item["citation"]} for item in matches]
            await self.publish({
                "type": "SCRATCHPAD_EVIDENCE", "state_version": self.state_version,
                "question": question, "citations": [item["citation"] for item in matches],
            })
            prompt = ("Answer this medical student's specific question clearly and naturally. "
                      "Ground medical claims in these exact retrieved sources; if none were found, "
                      "say the provided files do not address it. Do not invent a citation. "
                      + json.dumps({"question": question, "sources": references}, ensure_ascii=False))
            handle = self.session.say(self.text_stream(prompt, "barge_in"), allow_interruptions=True)
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
            if result.get("packet"):
                self.speech_task = asyncio.create_task(
                    self.play_packet(result["packet"], int(restored.get("cue_index", 0)) if restored else 0)
                )
        except asyncio.CancelledError:
            raise
        except Exception:
            log.exception("Tutor interrupted question handling failed")
            await self.publish({"type": "TUTOR_RECOVERY_REQUIRED", "state_version": self.state_version})

    async def receive_packet(self, packet: dict[str, Any]) -> None:
        if packet.get("type") == "HELLO" and packet.get("session_id") == self.session_id:
            await self.publish({"type": "WORKER_READY", "session_id": self.session_id,
                                "state_version": self.state_version})
        elif packet.get("type") == "TEACHING_PACKET":
            if packet.get("session_id") != self.session_id:
                return
            version = packet.get("state_version")
            if not isinstance(version, int) or version <= self.state_version:
                return
            if self.speech_task and not self.speech_task.done():
                self.speech_task.cancel()
            self.interrupting = False
            self.speech_task = asyncio.create_task(self.play_packet(packet))
        elif packet.get("type") == "STUDENT_BARGE_IN":
            await self.interrupt()
        elif packet.get("type") == "STUDENT_QUESTION" and isinstance(packet.get("question"), str):
            if self.answer_task and not self.answer_task.done():
                return
            self.answer_task = asyncio.create_task(self.answer(packet["question"][:900]))
        elif packet.get("type") == "END_CLASS":
            if self.speech_task:
                self.speech_task.cancel()
            await self.session.interrupt(force=True)
            await self.publish({"type": "TUTOR_STOPPED"})

    async def close(self) -> None:
        if self.speech_task:
            self.speech_task.cancel()
        if self.answer_task:
            self.answer_task.cancel()
        await self.http.aclose()


@server.rtc_session(agent_name="lensiq-voice-tutor")
async def entrypoint(ctx: JobContext) -> None:
    metadata = json.loads(ctx.job.metadata or "{}")
    expected = ["userId", "sessionId", "voiceGatewayToken", "orchestrateEndpoint"]
    if any(not isinstance(metadata.get(key), str) or not metadata[key] for key in expected):
        raise RuntimeError("Signed LenxiQ lesson worker dispatch metadata missing")
    session = AgentSession(
        stt=inference.STT(model=os.getenv("LENXIQ_STT_MODEL", "deepgram/nova-3"), language="en"),
        tts=inference.TTS(model=os.getenv("LENXIQ_TTS_MODEL", "deepgram/aura-2"),
                          voice=os.getenv("LENXIQ_TTS_VOICE", "aura-asteria-en")),
    )
    tutor = SyllabusVoiceTutor(ctx, session, metadata)

    @ctx.room.on("data_received")
    def on_data(packet: Any) -> None:
        if packet.topic != CHANNEL or not packet.participant or packet.participant.identity != tutor.user_id:
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
        if event.new_state == "speaking" and tutor.speaking:
            asyncio.create_task(tutor.interrupt())

    @session.on("user_input_transcribed")
    def on_transcript(event: Any) -> None:
        if event.is_final and event.transcript.strip():
            if not tutor.answer_task or tutor.answer_task.done():
                tutor.answer_task = asyncio.create_task(tutor.answer(event.transcript.strip()[:900]))

    await session.start(
        room=ctx.room,
        agent=Agent(instructions=(
            "You are LenxiQ, a friendly medical lecturer. "
            "All teaching is driven by verified versioned lesson packets. "
            "Do not autonomously start a new lesson on a student utterance."
        )),
    )
    try:
        await ctx.connect()
        await tutor.publish({"type": "WORKER_READY", "session_id": tutor.session_id,
                             "state_version": 0})
        await asyncio.Future()
    finally:
        await tutor.close()


if __name__ == "__main__":
    cli.run_app(server)
