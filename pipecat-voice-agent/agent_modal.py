"""Deploy the LenxiQ Pipecat voice worker to Modal.

The Next.js route mints the learner token and creates a lensiq-voice-* room.
Modal polls LiveKit Cloud through its server API, then starts one short-lived
Pipecat worker per active room. This avoids a permanently warm Modal container
and keeps the free-tier footprint small.

Deploy:
    modal deploy pipecat-voice-agent/agent_modal.py

The Modal Secret named ``livekit-credentials`` must contain LIVEKIT_URL,
LIVEKIT_API_KEY, LIVEKIT_API_SECRET, and an OpenAI-compatible model contract:
LLM_BASE_URL, LLM_API_KEY, and LLM_MODEL. As a convenience, OPENAI_API_KEY
can replace LLM_API_KEY and supplies the standard OpenAI endpoint/model defaults;
DEEPSEEK_API_KEY supplies the DeepSeek endpoint and ``deepseek-chat`` default.
LIVEKIT_URL may be wss:// or https://; this module normalizes it for the
LiveKit server API and WebRTC transport.
"""
from __future__ import annotations

import os
import sys
from pathlib import Path

import modal

APP_NAME = "lenxiq-ai-voice"
ROOM_PREFIX = "lensiq-voice-"
AGENT_NAME = "lensiq-voice-tutor"

HERE = Path(__file__).resolve().parent

voice_image = (
    modal.Image.debian_slim(python_version="3.11")
    .apt_install("ca-certificates", "espeak-ng", "ffmpeg", "libgl1", "libsndfile1")
    .pip_install(
        "pipecat-ai[livekit,openai,whisper,kokoro]==0.0.108",
        "kokoro-onnx>=0.4.0,<1",
        "soundfile>=0.12.1,<1",
        "livekit-api>=1.0.0,<2",
    )
    .add_local_file(HERE / "agent.py", "/root/lenxiq-agent.py")
)

app = modal.App(APP_NAME)
livekit_credentials = modal.Secret.from_name("livekit-credentials")


def _api_url(value: str) -> str:
    """Convert the shared LiveKit URL to the HTTPS URL expected by RoomService."""
    value = value.strip().rstrip("/")
    if value.startswith("wss://"):
        return "https://" + value[6:]
    if value.startswith("ws://"):
        return "http://" + value[5:]
    return value


@app.function(
    image=voice_image,
    secrets=[livekit_credentials],
    cpu=2.0,
    memory=4096,
    timeout=60 * 30,
    # Keep a warm container with Whisper/Kokoro loaded for the premium
    # experience; otherwise the first greeting waits for a full cold start.
    scaledown_window=300,
    min_containers=1,
    max_containers=20,
)
def run_voice_room(room_name: str, room_metadata: str = "") -> None:
    """Run one Pipecat pipeline until the learner leaves the LiveKit room."""
    import asyncio

    livekit_url = os.environ["LIVEKIT_URL"]
    # agent.py uses the same value for RoomService and RTC; https is accepted by
    # RoomService and agent.py converts it back to wss for the RTC transport.
    os.environ["LIVEKIT_URL"] = _api_url(livekit_url)
    sys.path.insert(0, "/root")
    import importlib.util

    spec = importlib.util.spec_from_file_location("lensiq_agent", "/root/lenxiq-agent.py")
    if spec is None or spec.loader is None:
        raise RuntimeError("Unable to load the Pipecat worker source")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    asyncio.run(module.run_room(room_name, room_metadata))


@app.function(
    image=voice_image,
    secrets=[livekit_credentials],
    cpu=0.25,
    memory=512,
    timeout=45,
    schedule=modal.Period(seconds=5),
    scaledown_window=30,
)
def poll_livekit_rooms() -> None:
    """Find active learner rooms and fan each one out to a short-lived worker."""
    import asyncio
    import json
    import time

    from livekit import api

    async def poll() -> None:
        api_url = _api_url(os.environ["LIVEKIT_URL"])
        api_client = api.LiveKitAPI(
            url=api_url,
            api_key=os.environ["LIVEKIT_API_KEY"],
            api_secret=os.environ["LIVEKIT_API_SECRET"],
        )
        try:
            response = await api_client.room.list_rooms(api.ListRoomsRequest())
            for room in response.rooms:
                if not room.name.startswith(ROOM_PREFIX):
                    continue
                participants = await api_client.room.list_participants(
                    api.ListParticipantsRequest(room=room.name)
                )
                if any(p.identity.startswith(AGENT_NAME) for p in participants.participants):
                    continue
                # A worker can take several seconds to boot Whisper/Kokoro. Claim the
                # room before spawning so the next 10-second poll cannot launch a
                # second worker with the same LiveKit identity. Expire a stale claim
                # after two minutes so a genuinely failed worker can be retried.
                try:
                    metadata = json.loads(room.metadata or "{}")
                except json.JSONDecodeError:
                    metadata = {}
                claimed_at = float(metadata.get("agentLaunchRequestedAt", 0) or 0)
                if time.time() - claimed_at < 120:
                    continue
                metadata["agentLaunchRequestedAt"] = time.time()
                metadata["agentLaunchRequestedBy"] = AGENT_NAME
                claimed_metadata = json.dumps(metadata, separators=(",", ":"))
                await api_client.room.update_room_metadata(
                    api.UpdateRoomMetadataRequest(
                        room=room.name,
                        metadata=claimed_metadata,
                    )
                )
                await run_voice_room.spawn.aio(room.name, claimed_metadata)
        finally:
            await api_client.aclose()

    asyncio.run(poll())


@app.local_entrypoint()
def deploy() -> None:
    """Print the deployment command when invoked with `modal run`."""
    print(f"{APP_NAME} is defined. Deploy with: modal deploy {Path(__file__).name}")
