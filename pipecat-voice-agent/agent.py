"""Self-hosted LenxiQ Live Class voice agent.

The service joins one LiveKit room and runs a local audio pipeline:

LiveKit -> Silero VAD -> faster-whisper -> DeepSeek -> Kokoro -> LiveKit

For production, replace the development LiveKit credentials in
docker-compose.yml with credentials managed by your deployment environment.
"""

from __future__ import annotations

from dotenv import load_dotenv

load_dotenv(override=False)

import asyncio
import os

from livekit import api
from loguru import logger

from pipecat.audio.vad.silero import SileroVADAnalyzer
from pipecat.pipeline.pipeline import Pipeline
from pipecat.pipeline.runner import PipelineRunner
from pipecat.pipeline.task import PipelineParams, PipelineTask
from pipecat.processors.aggregators.llm_context import LLMContext
from pipecat.processors.aggregators.llm_response_universal import (
    LLMContextAggregatorPair,
    LLMUserAggregatorParams,
)
from pipecat.services.kokoro.tts import KokoroTTSService
from pipecat.services.openai.llm import OpenAILLMService
from pipecat.services.whisper.stt import WhisperSTTService
from pipecat.transports.livekit.transport import LiveKitParams, LiveKitTransport


def required_env(name: str) -> str:
    value = os.getenv(name)
    if not value:
        raise RuntimeError(f"Missing required environment variable: {name}")
    return value


def create_livekit_token() -> str:
    token = (
        api.AccessToken(
            os.getenv("LIVEKIT_API_KEY", "devkey"),
            os.getenv("LIVEKIT_API_SECRET", "secret"),
        )
        .with_identity(os.getenv("LIVEKIT_AGENT_IDENTITY", "pipecat-agent"))
        .with_name("LenxiQ Pipecat Agent")
        .with_grants(
            api.VideoGrants(
                room_join=True,
                room=os.getenv("LIVEKIT_ROOM", "live-class"),
                can_publish=True,
                can_subscribe=True,
            )
        )
    )
    return token.to_jwt()


async def run_agent() -> None:
    livekit_url = required_env("LIVEKIT_URL")
    room_name = os.getenv("LIVEKIT_ROOM", "live-class")

    transport = LiveKitTransport(
        url=livekit_url,
        token=create_livekit_token(),
        room_name=room_name,
        params=LiveKitParams(
            audio_in_enabled=True,
            audio_out_enabled=True,
            audio_in_sample_rate=16000,
            audio_out_sample_rate=24000,
        ),
    )

    stt = WhisperSTTService(
        model=os.getenv("WHISPER_MODEL", "small.en"),
        device="cpu",
        compute_type="int8",
    )
    llm = OpenAILLMService(
        api_key=required_env("DEEPSEEK_API_KEY"),
        base_url="https://api.deepseek.com/v1",
        model=os.getenv("DEEPSEEK_MODEL", "deepseek-chat"),
    )
    tts = KokoroTTSService(
        settings=KokoroTTSService.Settings(
            voice=os.getenv("KOKORO_VOICE", "af_heart"),
        )
    )

    context = LLMContext(
        messages=[
            {
                "role": "system",
                "content": (
                    "You are LenxiQ, a concise and supportive medical tutor for a live class. "
                    "Explain concepts accurately at the learner's level, ask useful follow-up "
                    "questions, and keep responses natural for speech. Do not use markdown, "
                    "emojis, or visual-only formatting."
                ),
            }
        ]
    )
    context_aggregator = LLMContextAggregatorPair(
        context,
        user_params=LLMUserAggregatorParams(
            vad_analyzer=SileroVADAnalyzer(),
            filter_incomplete_user_turns=True,
        ),
    )

    pipeline = Pipeline(
        [
            transport.input(),
            stt,
            context_aggregator.user(),
            llm,
            tts,
            transport.output(),
            context_aggregator.assistant(),
        ]
    )
    task = PipelineTask(
        pipeline,
        params=PipelineParams(
            audio_in_sample_rate=16000,
            audio_out_sample_rate=24000,
            enable_metrics=True,
            enable_usage_metrics=True,
        ),
    )

    @transport.event_handler("on_client_connected")
    async def on_client_connected(_transport: LiveKitTransport, client: object) -> None:
        logger.info("LiveKit client connected: {}", client)

    @transport.event_handler("on_client_disconnected")
    async def on_client_disconnected(
        _transport: LiveKitTransport, client: object
    ) -> None:
        logger.info("LiveKit client disconnected: {}", client)
        await task.cancel()

    logger.info("Joining LiveKit room '{}' at {}", room_name, livekit_url)
    await PipelineRunner().run(task)


if __name__ == "__main__":
    try:
        asyncio.run(run_agent())
    except KeyboardInterrupt:
        logger.info("Voice agent stopped")
