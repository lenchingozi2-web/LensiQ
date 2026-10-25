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
import urllib.error
import urllib.request
import uuid
from typing import Any, AsyncGenerator
from urllib.parse import urlparse

from livekit import api
from pipecat.frames.frames import ErrorFrame, Frame, InputTextRawFrame, LLMContextFrame, TTSAudioRawFrame, TTSSpeakFrame, TextFrame, TranscriptionFrame
from pipecat.pipeline.pipeline import Pipeline
from pipecat.pipeline.runner import PipelineRunner
from pipecat.pipeline.task import PipelineParams, PipelineTask
from pipecat.processors.frame_processor import FrameDirection, FrameProcessor
from pipecat.processors.aggregators.openai_llm_context import OpenAILLMContext, OpenAILLMContextFrame
from pipecat.audio.vad.silero import SileroVADAnalyzer
from pipecat.audio.vad.vad_analyzer import VADParams
from pipecat.services.kokoro.tts import KokoroTTSService
from pipecat.services.openai.llm import OpenAILLMService
from pipecat.services.whisper.stt import WhisperSTTService
from pipecat.transports.livekit.transport import LiveKitParams, LiveKitTransport
from pipecat.runner.livekit import generate_token_with_agent
from pipecat.utils.tracing.service_decorators import traced_tts

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
        "Use a normal, lively conversational pace: answer directly in a few clear sentences, avoid long pauses and lecture-length monologues, and invite follow-up naturally. "
        f"You are teaching in room {room_name}. Speak naturally, pause for interruption, "
        "and never claim a visual that is not available. The browser synchronizes the teaching board "
        "from your natural explanation, so do not output JSON, XML, markdown code fences, slash commands, "
        "screen commands, tool calls, labels such as 'screen detected', or stage directions. Never read "
        "the visual protocol aloud. Use only natural spoken sentences, with no backslashes or raw markup. "
        "Use a whiteboard concept, approved model, or simulation only by explaining the concept naturally. "
        "This is education, not clinical decision support."
        + metadata_context
    )


def _provider_for_endpoint(base_url: str, model: str) -> str:
    host = (urlparse(base_url).hostname or "").lower()
    normalized_model = model.strip().lower()
    if host == "generativelanguage.googleapis.com":
        if not normalized_model.startswith("gemini-"):
            raise RuntimeError("The Google Live Class endpoint must use a Gemini model.")
        return "gemini"
    if host == "api.groq.com":
        if "gpt" in normalized_model:
            raise RuntimeError("GPT models are not permitted for Live Class.")
        return "groq"
    raise RuntimeError("Live Class accepts only Gemini or Groq model endpoints; GPT/OpenAI fallback is disabled.")


def _select_live_class_llm() -> tuple[str, str, str, str]:
    requested_provider = os.getenv("LIVE_CLASS_LLM_PROVIDER", "").strip().lower()
    if requested_provider not in ("", "gemini", "groq"):
        raise RuntimeError("LIVE_CLASS_LLM_PROVIDER must be either 'gemini' or 'groq'.")

    # Prefer provider-specific keys over the legacy generic contract. The
    # existing Modal secret still contains an old Manus/GPT proxy URL and
    # model, but a provisioned GROQ_API_KEY is the approved active path.
    gemini_key = (os.getenv("GEMINI_API_KEY") or os.getenv("GOOGLE_API_KEY") or "").strip()
    groq_key = os.getenv("GROQ_API_KEY", "").strip()
    provider = requested_provider or ("gemini" if gemini_key else "groq" if groq_key else "")
    if provider:
        if provider == "gemini":
            api_key = gemini_key
            base_url = os.getenv(
                "GEMINI_BASE_URL",
                "https://generativelanguage.googleapis.com/v1beta/openai/",
            ).strip()
            model = (os.getenv("GEMINI_MODEL") or "").strip()
            if not model or "gpt" in model.lower():
                model = "gemini-2.0-flash"
        else:
            api_key = groq_key
            base_url = os.getenv("GROQ_BASE_URL", "https://api.groq.com/openai/v1").strip()
            model = (os.getenv("GROQ_MODEL") or "").strip()
            if not model or "gpt" in model.lower():
                model = "qwen/qwen3.8-27b"
        if not api_key:
            raise RuntimeError(f"The selected {provider} Live Class provider is missing its API key.")
        if _provider_for_endpoint(base_url, model) != provider:
            raise RuntimeError("The selected Live Class provider does not match its configured endpoint/model.")
        return provider, api_key, base_url, model

    explicit = {
        "base_url": os.getenv("LLM_BASE_URL", "").strip(),
        "api_key": os.getenv("LLM_API_KEY", "").strip(),
        "model": os.getenv("LLM_MODEL", "").strip(),
    }
    if explicit["base_url"] or explicit["api_key"]:
        missing = [name for name, value in explicit.items() if not value]
        if missing:
            raise RuntimeError("Voice worker requires a complete LLM_BASE_URL, LLM_API_KEY, and LLM_MODEL contract.")
        provider = _provider_for_endpoint(explicit["base_url"], explicit["model"])
        if requested_provider and requested_provider != provider:
            raise RuntimeError("LIVE_CLASS_LLM_PROVIDER does not match the configured Gemini or Groq endpoint.")
        return provider, explicit["api_key"], explicit["base_url"], explicit["model"]

    raise RuntimeError("Configure a Gemini or Groq API key and model for Live Class; GPT fallback is disabled.")


class AiBudgetGate(FrameProcessor):
    """Reserve shared global spend capacity before each paid LLM generation."""

    def __init__(self, transport: LiveKitTransport, user_id: str, endpoint: str, token: str):
        super().__init__(name="ai-budget-gate")
        self.transport = transport
        self.user_id = user_id
        self.endpoint = endpoint
        self.token = token

    def _reserve_sync(self) -> tuple[bool, str]:
        missing = [name for name, value in (
            ("user_id", self.user_id),
            ("endpoint", self.endpoint),
            ("shared_token", self.token),
        ) if not value]
        if missing:
            logger.error("Voice AI budget gate missing required settings: %s", ", ".join(missing))
            return False, "This class is missing its secure tutor session context. Please end and restart the class."
        payload = json.dumps({
            "userId": self.user_id,
            "requestId": str(uuid.uuid4()),
            "feature": "voice",
        }).encode("utf-8")
        request = urllib.request.Request(
            self.endpoint,
            data=payload,
            headers={
                "Content-Type": "application/json",
                "Authorization": f"Bearer {self.token}",
            },
            method="POST",
        )
        try:
            with urllib.request.urlopen(request, timeout=4) as response:
                result = json.loads(response.read(4096).decode("utf-8"))
                if response.status == 200 and result.get("allowed") is True:
                    logger.info("Voice AI budget reservation authorized")
                    return True, ""
                reason = result.get("reason")
                if reason in ("user_daily_spend_limit", "user_monthly_spend_limit", "global_daily_spend_limit", "global_monthly_spend_limit", "user_minute_limit", "user_hour_limit", "user_day_limit", "global_minute_limit", "global_hour_limit", "global_day_limit"):
                    return False, "The AI usage allowance has been reached. Please try again later."
                if reason in ("ai_globally_paused", "provider_calls_not_approved"):
                    return False, "AI voice responses are temporarily paused. Please try again later."
                return False, "The tutor could not authorize this response. Please try again shortly."
        except urllib.error.HTTPError as error:
            logger.error("Voice AI budget service rejected reservation (HTTP %s)", error.code)
            if error.code == 429:
                return False, "The AI usage allowance has been reached. Please try again later."
            if error.code == 401:
                return False, "The tutor authorization check failed. Please reload the class and try again."
            return False, "The tutor budget service is temporarily unavailable. Please try again shortly."
        except (urllib.error.URLError, TimeoutError, ValueError, json.JSONDecodeError) as error:
            logger.error("Voice AI budget service unavailable (%s); blocking provider call", type(error).__name__)
            return False, "The tutor budget service is temporarily unavailable. Please try again shortly."

    def _bound_context(self, frame) -> None:
        context = getattr(frame, "context", None)
        messages = getattr(context, "messages", None)
        if not isinstance(messages, list):
            return
        system_message = next((message for message in messages if isinstance(message, dict) and message.get("role") == "system"), None)
        recent = messages[-20:]
        bounded = ([system_message] if system_message else []) + [message for message in recent if message is not system_message]
        for message in bounded:
            if not isinstance(message, dict):
                continue
            content = message.get("content")
            if isinstance(content, str) and len(content) > 6000:
                message["content"] = content[-6000:]
        while len(bounded) > 1 and sum(len(message.get("content", "")) for message in bounded if isinstance(message, dict) and isinstance(message.get("content"), str)) > 30000:
            removable = next((index for index, message in enumerate(bounded) if message is not system_message and isinstance(message, dict)), None)
            if removable is None:
                break
            bounded.pop(removable)
        set_messages = getattr(context, "set_messages", None)
        if callable(set_messages):
            set_messages(bounded)
        else:
            messages[:] = bounded

    async def process_frame(self, frame, direction: FrameDirection):
        await super().process_frame(frame, direction)
        if isinstance(frame, (LLMContextFrame, OpenAILLMContextFrame)):
            self._bound_context(frame)
            allowed, denial_message = await asyncio.to_thread(self._reserve_sync)
            if not allowed:
                client = getattr(self.transport, "_client", None)
                if client is not None:
                    message = {
                        "type": "live_class_state",
                        "state": "ERROR",
                        "message": denial_message,
                    }
                    await client.send_data(json.dumps(message).encode("utf-8"))
                return
        await self.push_frame(frame, direction)

class ConversationalKokoroTTSService(KokoroTTSService):
    """Use a clear, natural discussion pace slightly quicker than Kokoro's default."""

    @traced_tts
    async def run_tts(self, text: str, context_id: str) -> AsyncGenerator[Frame, None]:
        import numpy as np

        try:
            logger.info("Live Class tutor speech synthesis started (characters=%d)", len(text.strip()))
            await self.start_tts_usage_metrics(text)
            stream = self._kokoro.create_stream(
                text, voice=self._settings.voice, lang=self._settings.language, speed=1.08
            )
            async for samples, sample_rate in stream:
                await self.stop_ttfb_metrics()
                audio_int16 = (samples * 32767).astype(np.int16).tobytes()
                audio_data = await self._resampler.resample(audio_int16, sample_rate, self.sample_rate)
                yield TTSAudioRawFrame(
                    audio=audio_data,
                    sample_rate=self.sample_rate,
                    num_channels=1,
                    context_id=context_id,
                )
        except Exception as error:
            yield ErrorFrame(error=f"Unknown error occurred: {error}")
        finally:
            await self.stop_ttfb_metrics()


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
            logger.info("Live Class %s transcription received (characters=%d)", self.role, len(frame.text.strip()))
            # Learner speech is input to the tutor, not part of the answer transcript.
            if self.role == "assistant":
                await self.publish({"type": "live_class_transcript", "role": "assistant", "content": frame.text.strip(), "final": True})
            else:
                await self.publish({"type": "live_class_state", "state": "THINKING"})
        elif isinstance(frame, TextFrame) and frame.text.strip() and self.role == "assistant":
            logger.info("Live Class tutor response text generated (characters=%d)", len(frame.text.strip()))
            await self.publish({"type": "live_class_transcript", "role": "assistant", "content": frame.text.strip(), "final": True})
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
                params=VADParams(
                    confidence=float(os.getenv("LIVEKIT_VAD_CONFIDENCE", "0.50")),
                    start_secs=float(os.getenv("LIVEKIT_VAD_START_SECS", "0.08")),
                    stop_secs=float(os.getenv("LIVEKIT_VAD_STOP_SECS", "0.28")),
                    # Pipecat's volume is normalized EBU-R128 loudness, not
                    # microphone peak amplitude. A 0.42 gate rejects ordinary
                    # phone speech; keep this mobile-safe and tunable.
                    min_volume=float(os.getenv("LIVEKIT_VAD_MIN_VOLUME", "0.03")),
                )
            ),
        ),
    )
    stt = WhisperSTTService(
        # Base English is a better accuracy/latency balance than tiny.en for
        # medical terms and short phone utterances.
        model=os.getenv("WHISPER_MODEL", "base.en"),
        device=os.getenv("WHISPER_DEVICE", "cpu"),
        compute_type=os.getenv("WHISPER_COMPUTE_TYPE", "int8"),
    )
    # KokoroTTSService embeds kokoro-onnx and downloads its model files into
    # the Modal image cache. It is not an HTTP/OpenAI-compatible service.
    tts = ConversationalKokoroTTSService(
        settings=KokoroTTSService.Settings(
            voice=os.getenv("KOKORO_VOICE", "af_heart"),
        ),
        model_path=os.getenv("KOKORO_MODEL_PATH") or None,
        voices_path=os.getenv("KOKORO_VOICES_PATH") or None,
    )
    llm_provider, llm_api_key, llm_base_url, llm_model = _select_live_class_llm()
    logger.info("Live Class LLM provider configured (%s/%s)", llm_provider, llm_model)
    # Pipecat's OpenAILLMService is used only as an OpenAI-compatible protocol
    # adapter; the endpoint guard above restricts the actual provider to Gemini/Groq.
    llm = OpenAILLMService(
        api_key=llm_api_key,
        base_url=llm_base_url,
        model=llm_model,
        params=OpenAILLMService.InputParams(max_completion_tokens=800, temperature=0.2),
        max_retries=0,
        timeout=20,
    )
    context = OpenAILLMContext(messages=[{"role": "system", "content": _system_prompt(room_name, room_metadata)}])
    context_aggregators = llm.create_context_aggregator(context)
    user_aggregator = context_aggregators.user()
    assistant_aggregator = context_aggregators.assistant()
    user_bridge = LiveClassDataBridge(transport, "user")
    assistant_bridge = LiveClassDataBridge(transport, "assistant")
    try:
        room_data = json.loads(room_metadata or "{}")
    except (TypeError, ValueError, json.JSONDecodeError):
        room_data = {}
    budget_gate = AiBudgetGate(
        transport,
        str(room_data.get("userId") or ""),
        os.getenv("AI_BUDGET_ENDPOINT", "https://www.lenxiq.online/api/internal/ai-budget").strip(),
        os.getenv("AI_BUDGET_INTERNAL_TOKEN", "").strip(),
    )
    pipeline = Pipeline([
        transport.input(), stt, user_bridge, user_aggregator, budget_gate, llm,
        assistant_bridge, tts, transport.output(), assistant_aggregator,
    ])
    task = PipelineTask(pipeline, params=PipelineParams(allow_interruptions=True, enable_metrics=True))

    @task.event_handler("on_pipeline_error")
    async def on_pipeline_error(_task: PipelineTask, frame: ErrorFrame):
        message = str(frame.error or "The tutor could not complete that response.")
        if "402" in message or "Insufficient Balance" in message:
            message = "The tutor service is temporarily unavailable. Please try again in a moment."
        logger.error("Live Class pipeline error: %s", frame.error)
        await assistant_bridge.publish({"type": "live_class_state", "state": "ERROR", "message": message})

    @transport.event_handler("on_data_received")
    async def on_data_received(_transport: LiveKitTransport, payload: bytes, _participant_id: str):
        try:
            data = json.loads(payload.decode())
        except (UnicodeDecodeError, json.JSONDecodeError):
            return
        if data.get("type") != "structure_selected" and data.get("type") != "concept_selected":
            return
        if data.get("type") == "structure_selected":
            model_url = str(data.get("modelUrl") or "the current approved anatomy model")[:400]
            structure_id = str(data.get("structureId") or "an unlabeled structure")[:180]
            focus = (
                f"The learner pointed to and selected '{structure_id}' in the active 3D medical model ({model_url}). "
                "Treat this selection as the learner's intended anatomical target. Explain what that structure is, "
                "where it sits in the displayed model, its function and relevant clinical/physiology context. "
                "If the mesh name is generic or the exact structure cannot be identified confidently from the model "
                "and label, say so clearly and ask the learner to select a clearer labelled part; do not invent anatomy."
            )
        else:
            focus = f"The learner selected this concept on the teaching board: {str(data.get('concept', ''))[:400]}. Explain it interactively and connect it to the current lesson."
        await assistant_bridge.publish({"type": "live_class_state", "state": "THINKING"})
        await task.queue_frame(InputTextRawFrame(text=focus))

    greeting_queued = False

    async def queue_initial_greeting(source: str) -> None:
        nonlocal greeting_queued
        if greeting_queued:
            return
        greeting_queued = True
        # The room poller launches workers only after a learner is present.
        # Queueing at pipeline start avoids relying on an event that can be
        # missed when the worker joins an already-created room.
        logger.info("Queueing Live Class greeting for %s (%s)", room_name, source)
        await assistant_bridge.publish({"type": "live_class_state", "state": "GREETING"})
        await task.queue_frame(
            TTSSpeakFrame(
                "Hello, I am your LenxiQ medical tutor. Tell me which concept you would like to master."
            )
        )

    @transport.event_handler("on_first_participant_joined")
    async def on_first_participant_joined(_transport: LiveKitTransport, _participant_id: str):
        await queue_initial_greeting("first_participant")

    await queue_initial_greeting("pipeline_start")
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
