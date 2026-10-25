# LenxiQ self-hosted voice stack

This stack keeps voice processing local: LiveKit server, Pipecat worker, faster-Whisper STT, and Kokoro TTS. It does not use Deepgram or Cartesia.

## Modal deployment

`agent_modal.py` deploys the same Pipecat pipeline to Modal for LiveKit Cloud. It uses `modal.App("lenxiq-ai-voice")`, pulls the LiveKit credentials and the OpenAI-compatible LLM contract (`LLM_BASE_URL`, `LLM_API_KEY`, `LLM_MODEL`) from the existing Modal Secret named `livekit-credentials`, and schedules a lightweight room poller every 5 seconds. Each active room gets a separate worker with 2 vCPU, 4 GB RAM, a 5-minute idle scale-down window, and a 30-minute maximum lifetime; one poller container stays warm to reduce first-greeting latency. The worker uses Silero VAD for segmented Whisper turns and publishes tutor/learner transcript and interaction-state packets to the browser.

```bash
modal deploy agent_modal.py
```

Keep `LIVEKIT_DISPATCH_MODE=room-poll` in the Next.js environment. The frontend creates the room and token; the Modal poller discovers that same `lensiq-voice-*` room through LiveKit Cloud and joins it as `lensiq-voice-tutor`.

For a Codespace Next.js process, add these variables to the repository-root `.env.local` (`/workspaces/LensiQ/.env.local`), not `pipecat-voice-agent/.env.local`, and restart the Next.js process:

```dotenv
LIVEKIT_PUBLIC_URL=wss://YOUR_LIVEKIT_PROJECT.livekit.cloud
LIVEKIT_URL=wss://YOUR_LIVEKIT_PROJECT.livekit.cloud
LIVEKIT_API_KEY=the_same_key_as_livekit-credentials
LIVEKIT_API_SECRET=the_same_secret_as_livekit-credentials
LIVEKIT_DISPATCH_MODE=room-poll
LIVEKIT_AGENT_NAME=lensiq-voice-tutor
```

Use the exact `LIVEKIT_URL`, `LIVEKIT_API_KEY`, and `LIVEKIT_API_SECRET` values from the Modal `livekit-credentials` secret. Do not use the old `*.app.github.dev` URL, and do not set `LIVEKIT_INTERNAL_URL` for the Modal room-poll deployment.

The Modal worker also needs an OpenAI-compatible LLM endpoint because Pipecat must generate the tutor response before Kokoro can speak it. The referenced `livekit-credentials` secret must include `LLM_BASE_URL`, `LLM_API_KEY`, and `LLM_MODEL`; alternatively `OPENAI_API_KEY` enables the standard OpenAI defaults, or `DEEPSEEK_API_KEY` enables `https://api.deepseek.com/v1` with `deepseek-chat`. Do not use the local Docker default `host.docker.internal:11434` in Modal. Kokoro itself is local and free; it is initialized directly through `kokoro-onnx`.

The worker uses a mobile-safe Silero VAD loudness gate by default (`LIVEKIT_VAD_MIN_VOLUME=0.03`, `LIVEKIT_VAD_CONFIDENCE=0.62`, `LIVEKIT_VAD_START_SECS=0.16`, and `LIVEKIT_VAD_STOP_SECS=0.32`). These may be overridden in the Modal environment if a particular microphone needs tuning; do not raise the volume gate to `0.42`, which can reject ordinary phone speech.

## Run locally

1. Copy the parent project values into a local `.env` file; never commit secrets.
2. Start the stack:

```bash
docker compose up -d --build
```

3. Run Next.js on the same host as the stack. For local development use:

```bash
LIVEKIT_INTERNAL_URL=http://127.0.0.1:7880 \
NEXT_PUBLIC_LIVEKIT_URL=wss://YOUR_PUBLIC_HOST/rtc \
pnpm dev
```

The browser uses the public WebSocket URL. The Next.js token route uses the internal LiveKit URL for server-to-server dispatch. Vercel cannot use `127.0.0.1` to reach this stack; deploy the Next.js server beside this Compose stack or provide a separate public dispatch gateway.

Set `LIVEKIT_DISPATCH_MODE=room-poll` in the colocated Next.js environment. In this mode the API only mints the learner token and the Pipecat worker polls LiveKit's internal RoomService, which avoids the Codespaces public Twirp proxy entirely.

In Codespaces, set `LIVEKIT_AGENT_URL=http://host.docker.internal:7880` if the worker cannot reach the Compose service name directly. The LiveKit port is published on the host, and `host.docker.internal` is provided by Compose for this route.

## Model endpoint

The worker defaults to a local OpenAI-compatible LLM endpoint at `host.docker.internal:11434`. Set `LLM_BASE_URL`, `LLM_MODEL`, and `LLM_API_KEY` for the model server available on the host. Kokoro and Whisper remain local.
