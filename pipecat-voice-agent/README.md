# LenxiQ self-hosted voice stack

This stack keeps voice processing local: LiveKit server, Pipecat worker, faster-Whisper STT, and Kokoro TTS. It does not use Deepgram or Cartesia.

## Modal deployment

`agent_modal.py` deploys the Pipecat pipeline to Modal for LiveKit Cloud. It uses `modal.App("lenxiq-ai-voice")`, reads LiveKit credentials and Gemini/Groq provider settings from the existing Modal secrets, and schedules a lightweight room poller every 5 seconds. Each active room gets a separate worker with 2 vCPU, 4 GB RAM, a 5-minute idle scale-down window, and a 95-minute worker timeout supporting a 90-minute classroom allowance, subject to the learner's server-side allowance; one poller container stays warm to reduce first-greeting latency. The worker uses mobile-safe Silero VAD, responsive Whisper turns, slightly faster Kokoro speech, and publishes tutor/learner transcript and interaction-state packets to the browser.

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

**Live Class provider architecture:** Gemini 3.8 Flash is the lesson planning brain, called through the authenticated Next.js `/api/voice/context` route. Its `GEMINI_API_KEY` is configured in Vercel, and it plans the concept sequence from native past questions and retrieved source excerpts. The Modal worker should have `GROQ_API_KEY` and optionally `GROQ_MODEL=qwen/qwen3.8-27b`; Groq streams the natural spoken explanation, while Kokoro generates the actual audio. The worker defaults to Groq whenever its key is present. Explicit `LIVE_CLASS_LLM_PROVIDER=gemini` is a compatibility option, not the intended split architecture. If Gemini planning fails, the verbalizer continues using verified evidence rather than fabricating a plan. Avoid placing keys in client-side variables.

`LIVE_CLASS_SEGMENT_MAX_TOKENS` defaults to **1400** (configurable from 500–2200 per response), not per lesson. Long classes use successive segments, a rolling teaching memory and on-demand source retrieval; no token setting can guarantee thorough coverage of six giant uploads automatically.

Mobile speech detection defaults: `LIVEKIT_VAD_MIN_VOLUME=0.012`, `LIVEKIT_VAD_CONFIDENCE=0.50`, `LIVEKIT_VAD_START_SECS=0.12`, `LIVEKIT_VAD_STOP_SECS=0.95`; Whisper defaults to `base.en` instead of tiny.en. Tune environmental overrides on Modal only after testing real device input, and check transcription logs for misrecognitions.

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

Use `GEMINI_API_KEY` on the Vercel server for lesson planning and `GROQ_API_KEY` in the Modal worker for fast verbalization. The worker can fall back to Gemini voice text if Groq has not been provisioned, but that is not the preferred two-model design. Alternatively, set the complete `LLM_BASE_URL`, `LLM_API_KEY`, and `LLM_MODEL` contract to one of the supported Gemini/Groq endpoints. There is no automatic retry or silent provider switch. The Live Class session and subscription entitlements are enforced by the Next.js token route.
