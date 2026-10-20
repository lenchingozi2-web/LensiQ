"""LenxiQ free/self-hosted LiveKit voice worker.

Pipecat owns the audio pipeline. Whisper STT and Kokoro TTS run locally; the
LLM is any OpenAI-compatible local endpoint configured by LLM_BASE_URL. The
worker polls the internal LiveKit RoomService so it does not depend on a
public Codespaces Twirp proxy for dispatch.
"""
from __future__ import annotations

import asyncio
import logging
import os
from typing import Any

from livekit import api
from pipecat.frames.frames import LLMMessagesFrame
from pipecat.pipeline.pipeline import Pipeline
from pipecat.pipeline.runner import PipelineRunner
from pipecat.pipeline.task import PipelineParams, PipelineTask
from pipecat.processors.aggregators.openai_llm_context import OpenAILLMContext
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


def _system_prompt(room_name: str) -> str:
    return (
        "You are LenxiQ AI Tutor, a concise and warm medical teacher. "
        f"You are teaching in room {room_name}. Speak naturally, pause for interruption, "
        "and never claim a visual that is not available. When the visual stage should change, "
        "emit a compact JSON data-channel command matching the LenxiQ visual protocol before "
        "explaining the concept. Use a whiteboard for mechanisms and an approved model for "
        "pathology, histology, cytology, anatomy, or pharmacology structures. This is education, "
        "not clinical decision support."
    )


async def run_room(room_name: str, room_metadata: str | None = None) -> None:
    token = generate_token_with_agent(room_name, f"{AGENT_NAME}-{room_name[-8:]}", LIVEKIT_API_KEY, LIVEKIT_API_SECRET)
    transport = LiveKitTransport(
        url=_room_ws_url(LIVEKIT_URL),
        token=token,
        room_name=room_name,
        params=LiveKitParams(audio_in_enabled=True, audio_out_enabled=True, camera_in_enabled=False, camera_out_enabled=False),
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
    llm_base_url = os.getenv("LLM_BASE_URL", "").strip()
    llm_api_key = os.getenv("LLM_API_KEY", "").strip()
    llm_model = os.getenv("LLM_MODEL", "").strip()
    if not llm_base_url or not llm_api_key or not llm_model:
        raise RuntimeError(
            "Modal voice worker needs LLM_BASE_URL, LLM_API_KEY, and LLM_MODEL "
            "in its Modal secret/environment; host.docker.internal is local-only."
        )
    llm = OpenAILLMService(
        api_key=llm_api_key,
        base_url=llm_base_url,
        model=llm_model,
    )
    context = OpenAILLMContext(messages=[{"role": "system", "content": _system_prompt(room_name)}])
    user_aggregator, assistant_aggregator = llm.create_context_aggregator(context).pair()
    pipeline = Pipeline([transport.input(), stt, user_aggregator, llm, tts, transport.output(), assistant_aggregator])
    task = PipelineTask(pipeline, params=PipelineParams(allow_interruptions=True, enable_metrics=True))

    @transport.event_handler("on_first_participant_joined")
    async def on_first_participant_joined(_transport: LiveKitTransport, _participant_id: str):
        await task.queue_frames([LLMMessagesFrame([{"role": "user", "content": "Greet the learner and ask what medical concept they want to master."}])])

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
