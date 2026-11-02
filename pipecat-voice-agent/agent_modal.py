"""Deploy the LenxiQ Pipecat voice worker to Modal.

The Next.js route mints the learner token and creates a lensiq-voice-* room.
Modal polls LiveKit Cloud through its server API, then starts one short-lived
Pipecat worker per active room. This avoids a permanently warm Modal container
and keeps the free-tier footprint small.

Deploy:
    modal deploy pipecat-voice-agent/agent_modal.py

The mounted ``livekit-credentials`` and ``lensiq-llm-fallback`` secrets must
collectively provide LIVEKIT_URL, LIVEKIT_API_KEY, LIVEKIT_API_SECRET, and
either a complete LLM_BASE_URL / LLM_API_KEY / LLM_MODEL contract pointing to
Gemini or Groq, or a direct GEMINI_API_KEY + GEMINI_MODEL or GROQ_API_KEY +
GROQ_MODEL pair. When both direct keys exist Groq is selected by default;
LIVE_CLASS_LLM_PROVIDER=groq selects Groq. Only the configured Gemini/Groq providers are supported.
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
llm_fallback = modal.Secret.from_name("lensiq-llm-fallback")


def _api_url(value: str) -> str:
    """Convert the shared LiveKit URL to the HTTPS URL expected by RoomService."""
    value = value.strip().rstrip("/")
    if value.startswith("wss://"):
        return "https://" + value[6:]
    if value.startswith("ws://"):
        return "http://" + value[5:]
    return value


def _is_closed_room_error(error: Exception) -> bool:
    """Recognize LiveKit's normal room-close race without hiding other errors."""
    error_text = str(error).lower()
    error_code = str(getattr(error, "code", "")).lower()
    error_status = getattr(error, "status", None)
    return (
        error_status == 409
        or error_code in {"aborted", "not_found", "notfound"}
        or "room has already closed" in error_text
        or "does not exist" in error_text
        or "not_found" in error_text
    )


@app.function(
    image=voice_image,
    secrets=[livekit_credentials, llm_fallback],
    cpu=2.0,
    memory=4096,
    timeout=95 * 60,
    # Keep a warm container with Whisper/Kokoro loaded for the premium
    # experience; otherwise the first greeting waits for a full cold start.
    scaledown_window=300,
    min_containers=1,
    max_containers=5,
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
    secrets=[livekit_credentials, llm_fallback],
    cpu=0.25,
    memory=512,
    timeout=45,
    schedule=modal.Period(seconds=3),
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
                try:
                    participants = await api_client.room.list_participants(
                        api.ListParticipantsRequest(room=room.name)
                    )
                except Exception as error:
                    # LiveKit may close a room after list_rooms returns it. Its
                    # Twirp API reports this normal race as HTTP 409 / aborted
                    # ("room has already closed"), not only as not_found.
                    # Treat known closed-room responses as stale poll results;
                    # one ended class must never fail the scheduled poller.
                    if _is_closed_room_error(error):
                        print(f"Skipping room that closed during polling: {room.name}")
                        continue
                    # Isolate unexpected per-room API errors too, so one bad
                    # room does not prevent other active lessons from starting.
                    print(f"Unable to inspect LiveKit room {room.name}: {type(error).__name__}")
                    continue
                # Token issuance creates rooms ahead of the browser join so it
                # can attach private lesson metadata. Do not start or greet in
                # an empty room; wait until the authenticated learner connects.
                if not any(not p.identity.startswith(AGENT_NAME) for p in participants.participants):
                    continue
                if any(p.identity.startswith(AGENT_NAME) for p in participants.participants):
                    continue
                # Prevent duplicate workers, but recover quickly from failed launches.
                try:
                    metadata = json.loads(room.metadata or "{}")
                except json.JSONDecodeError:
                    metadata = {}
                claimed_at = float(metadata.get("agentLaunchRequestedAt", 0) or 0)
                if time.time() - claimed_at < 75:
                    continue
                original_metadata = dict(metadata)
                metadata["agentLaunchRequestedAt"] = time.time()
                metadata["agentLaunchRequestedBy"] = AGENT_NAME
                claimed_metadata = json.dumps(metadata, separators=(",", ":"))
                try:
                    await api_client.room.update_room_metadata(
                        api.UpdateRoomMetadataRequest(
                            room=room.name,
                            metadata=claimed_metadata,
                        )
                    )
                except Exception as error:
                    if _is_closed_room_error(error):
                        print(f"Skipping room that closed while claiming: {room.name}")
                    else:
                        print(f"Unable to claim LiveKit room {room.name}: {type(error).__name__}")
                    continue
                try:
                    await run_voice_room.spawn.aio(room.name, claimed_metadata)
                except Exception as error:
                    print(f"Unable to start voice worker for {room.name}: {type(error).__name__}")
                    try:
                        await api_client.room.update_room_metadata(
                            api.UpdateRoomMetadataRequest(
                                room=room.name,
                                metadata=json.dumps(original_metadata, separators=(",", ":")),
                            )
                        )
                    except Exception as cleanup_error:
                        print(f"Unable to release failed worker claim: {type(cleanup_error).__name__}")
        finally:
            await api_client.aclose()

    asyncio.run(poll())


@app.local_entrypoint()
def deploy() -> None:
    """Print the deployment command when invoked with `modal run`."""
    print(f"{APP_NAME} is defined. Deploy with: modal deploy {Path(__file__).name}")
