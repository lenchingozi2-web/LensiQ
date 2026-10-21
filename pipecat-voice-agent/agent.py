"""LenxiQ free/self-hosted LiveKit voice worker.

Pipecat owns the audio pipeline. Whisper STT and Kokoro TTS run locally; the
LLM is any OpenAI-compatible local endpoint configured by LLM_BASE_URL. The
worker polls the internal LiveKit RoomService so it does not depend on a
public Codespaces Twirp proxy for dispatch.
"""
from __future__ import annotations

import asyncio
import json
import logging
import os
from typing import Any

from livekit import api
from pipecat.frames.frames import InputTextRawFrame, TTSSpeakFrame, TextFrame, TranscriptionFrame
from pipecat.pipeline.pipeline import Pipeline
from pipecat.pipeline.runner import PipelineRunner
from pipecat.pipeline.task import PipelineParams, PipelineTask
from pipecat.processors.frame_processor import FrameDirection, FrameProcessor
from pipecat.processors.aggregators.openai_llm_context import OpenAILLMContext
from pipecat.audio.vad.silero import SileroVADAnalyzer
from pipecat.audio.vad.vad_analyzer import VADParams
from pipecat.services.kokoro.tts import KokoroTTSService
from pipecat.services.openai.llm import OpenAILLMService
from pipecat.services.whisper.stt import WhisperSTTService
from pipecat.transports.livekit.transport import LiveKitParams, LiveKitTransport
from pipecat.runner.livekit import generate_token_with_agent

logging.basicConfig(level=os.getenv("LOG_LEVEL", "INFO"))
logger = logging.getLogger("lensiq-pipecat")

LIVEKIT_URL = os.environ["LIVEKIT_URL"]
LIVEKIT_API_KEY = os.environ["LIVEKIT_API_KEY"]
LIVEKIT_API_SECRET = os.environ["LIVEKIT_API_SECRET"]
AGENT_NAME = os.getenv("LIVEKIT_AGENT_NAME", "lensiq-voice-tutor")
ROOM_PREFIX = os.getenv("LIVEKIT_ROOM_PREFIX", "lensiq-voice-")


def _room_ws_url(value: str) -> str:
    value = value.strip().rstrip("/")
    return value.replace("https://", "wss://").replace("http://", "ws://")


def _system_prompt(room_name: str, room_metadata: str | None = None) -> str:
    metadata_context = ""
    if room_metadata:
        try:
            metadata = json.loads(room_metadata)
            if isinstance(metadata, dict):
                context_parts = []
                for label, key in (
                    ("course", "courseName"),
                    ("topic focus", "topicFocus"),
                    ("learner focus", "focusText"),
                    ("material context", "materialContext"),
                ):
                    value = metadata.get(key)
                    if value:
                        context_parts.append(f"{label}: {json.dumps(value, ensure_ascii=False)}")
                if context_parts:
                    metadata_context = " Use this class context as the primary teaching context: " + "; ".join(context_parts) + "."
        except (TypeError, ValueError, json.JSONDecodeError):
            logger.warning("Ignoring malformed Live Class metadata for room %s", room_name)
    return (
        "You are LenxiQ AI Tutor, a concise and warm medical teacher. "
        f"You are teaching in room {room_name}. Speak naturally, pause for interruption, "
        "and never claim a visual that is not available. When the visual stage should change, "
        "emit a compact JSON data-channel command matching the LenxiQ visual protocol before "
        "explaining the concept. Use a whiteboard for mechanisms and an approved model for "
        "pathology, histology, cytology, anatomy, or pharmacology structures. This is education, "
        "not clinical decision support."
        + metadata_context
    )


class LiveClassDataBridge(FrameProcessor):
    """Mirror completed user and tutor turns to the browser data channel."""

    def __init__(self, transport: LiveKitTransport, role: str):
        super().__init__(name=f"live-class-{role}-bridge")
        self.transport = transport
        self.role = role

    async def publish(self, payload: dict[str, Any]) -> None:
        client = getattr(self.transport, "_client", None)
        if client is not None:
            await client.send_data(json.dumps(payload, ensure_ascii=False).encode())

    async def process_frame(self, frame, direction: FrameDirection):
        await super().process_frame(frame, direction)
        if isinstance(frame, TranscriptionFrame) and frame.text.strip():
            await self.publish({"type": "live_class_transcript", "role": self.role, "content": frame.text.strip(), "final": True})
            await self.publish({"type": "live_class_state", "state": "LISTENING"})
        elif isinstance(frame, TextFrame) and frame.text.strip():
            await self.publish({"type": "live_class_transcript", "role": self.role, "content": frame.text.strip(), "final": True})
            await self.publish({"type": "live_class_state", "state": "TEACHING"})
        await self.push_frame(frame, direction)


async def run_room(room_name: str, room_metadata: str | None = None) -> None:
    token = generate_token_with_agent(room_name, f"{AGENT_NAME}-{room_name[-8:]}", LIVEKIT_API_KEY, LIVEKIT_API_SECRET)
    transport = LiveKitTransport(
        url=_room_ws_url(LIVEKIT_URL),
        token=token,
        room_name=room_name,
        params=LiveKitParams(
            audio_in_enabled=True,
            audio_out_enabled=True,
            camera_in_enabled=False,
            camera_out_enabled=False,
            vad_enabled=True,
            vad_analyzer=SileroVADAnalyzer(
                params=VADParams(confidence=0.62, start_secs=0.16, stop_secs=0.32, min_volume=0.42)
            ),
        ),
    )
    stt = WhisperSTTService(
        model=os.getenv("WHISPER_MODEL", "small.en"),
        device=os.getenv("WHISPER_DEVICE", "cpu"),
        compute_type=os.getenv("WHISPER_COMPUTE_TYPE", "int8"),
    )
    # KokoroTTSService embeds kokoro-onnx and downloads its model files into
    # the Modal image cache. It is not an HTTP/OpenAI-compatible service.
    tts = KokoroTTSService(
        settings=KokoroTTSService.Settings(
            voice=os.getenv("KOKORO_VOICE", "af_heart"),
        ),
        model_path=os.getenv("KOKORO_MODEL_PATH") or None,
        voices_path=os.getenv("KOKORO_VOICES_PATH") or None,
    )
    openai_api_key = os.getenv("OPENAI_API_KEY", "").strip()
    deepseek_api_key = os.getenv("DEEPSEEK_API_KEY", "").strip()
    llm_api_key = os.getenv("LLM_API_KEY", "").strip() or openai_api_key or deepseek_api_key
    llm_base_url = os.getenv("LLM_BASE_URL", "").strip()
    if not llm_base_url and openai_api_key:
        llm_base_url = "https://api.openai.com/v1"
    if not llm_base_url and deepseek_api_key:
        llm_base_url = "https://api.deepseek.com/v1"
    llm_model = os.getenv("LLM_MODEL", "").strip()
    if not llm_model and openai_api_key:
        llm_model = "gpt-4o-mini"
    if not llm_model and deepseek_api_key:
        llm_model = "deepseek-chat"
    missing_llm_settings = [
        name for name, value in (
            ("LLM_BASE_URL", llm_base_url),
            ("LLM_API_KEY, OPENAI_API_KEY, or DEEPSEEK_API_KEY", llm_api_key),
            ("LLM_MODEL", llm_model),
        ) if not value
    ]
    if missing_llm_settings:
        raise RuntimeError(
            "Voice worker is missing LLM settings: "
            + ", ".join(missing_llm_settings)
            + ". Add them to the Modal livekit-credentials secret; "
            "host.docker.internal is local-only."
        )
    llm = OpenAILLMService(
        api_key=llm_api_key,
        base_url=llm_base_url,
        model=llm_model,
    )
    context = OpenAILLMContext(messages=[{"role": "system", "content": _system_prompt(room_name, room_metadata)}])
    context_aggregators = llm.create_context_aggregator(context)
    user_aggregator = context_aggregators.user()
    assistant_aggregator = context_aggregators.assistant()
    user_bridge = LiveClassDataBridge(transport, "user")
    assistant_bridge = LiveClassDataBridge(transport, "assistant")
    pipeline = Pipeline([
        transport.input(), stt, user_bridge, user_aggregator, llm,
        assistant_bridge, tts, transport.output(), assistant_aggregator,
    ])
    task = PipelineTask(pipeline, params=PipelineParams(allow_interruptions=True, enable_metrics=True))

    @transport.event_handler("on_data_received")
    async def on_data_received(_transport: LiveKitTransport, payload: bytes, _participant_id: str):
        try:
            data = json.loads(payload.decode())
        except (UnicodeDecodeError, json.JSONDecodeError):
            return
        if data.get("type") != "structure_selected" and data.get("type") != "concept_selected":
            return
        if data.get("type") == "structure_selected":
            focus = f"The learner selected the structure {data.get('structureId', 'an unlabeled structure')} in the current visual. Explain that selected structure in context, then ask whether they want to go deeper."
        else:
            focus = f"The learner selected this concept on the teaching board: {str(data.get('concept', ''))[:400]}. Explain it interactively and connect it to the current lesson."
        await assistant_bridge.publish({"type": "live_class_state", "state": "THINKING"})
        await task.queue_frame(InputTextRawFrame(text=focus))

    @transport.event_handler("on_first_participant_joined")
    async def on_first_participant_joined(_transport: LiveKitTransport, _participant_id: str):
        # Prove the transport/TTS path immediately. This avoids making the
        # first audible response depend on an LLM round trip completing.
        await assistant_bridge.publish({"type": "live_class_state", "state": "GREETING"})
        await asyncio.sleep(1)
        await task.queue_frame(
            TTSSpeakFrame(
                "Hello, I am your LenxiQ medical tutor. Tell me which concept you would like to master."
            )
        )

    logger.info("Joining Live Class room %s", room_name)
    await PipelineRunner().run(task)


async def _list_rooms(client: api.LiveKitAPI) -> list[Any]:
    response = await client.room.list_rooms(api.ListRoomsRequest())
    return list(response.rooms)


async def main() -> None:
    logger.info("%s worker using local Whisper + Kokoro at %s", AGENT_NAME, LIVEKIT_URL)
    active: dict[str, asyncio.Task[None]] = {}
    async with api.LiveKitAPI(url=LIVEKIT_URL, api_key=LIVEKIT_API_KEY, api_secret=LIVEKIT_API_SECRET) as client:
        while True:
            try:
                for room in await _list_rooms(client):
                    if not room.name.startswith(ROOM_PREFIX) or room.name in active:
                        continue
                    participants = await client.room.list_participants(api.ListParticipantsRequest(room=room.name))
                    if any(p.identity.startswith(AGENT_NAME) for p in participants.participants):
                        continue
                    active[room.name] = asyncio.create_task(run_room(room.name, room.metadata))
                for name, task in list(active.items()):
                    if task.done():
                        active.pop(name, None)
                        try:
                            task.result()
                        except Exception:
                            logger.exception("Pipecat room task failed for %s", name)
            except Exception:
                logger.exception("LiveKit room poll failed; retrying")
            await asyncio.sleep(float(os.getenv("ROOM_POLL_SECONDS", "2")))


if __name__ == "__main__":
    asyncio.run(main())
