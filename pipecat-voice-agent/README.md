# LenxiQ self-hosted voice stack

This stack keeps voice processing local: LiveKit server, Pipecat worker, faster-Whisper STT, and Kokoro TTS. It does not use Deepgram or Cartesia.

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

## Model endpoint

The worker defaults to a local OpenAI-compatible LLM endpoint at `host.docker.internal:11434`. Set `LLM_BASE_URL`, `LLM_MODEL`, and `LLM_API_KEY` for the model server available on the host. Kokoro and Whisper remain local.
