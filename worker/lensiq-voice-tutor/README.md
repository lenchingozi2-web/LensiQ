# LenxiQ LiveKit voice worker (Phase 2)

This directory contains the **source** for the separately hosted agent named `lensiq-voice-tutor`. The web deployment does not host an always-on LiveKit worker.

Use Python 3.11+ and install `requirements.txt`. Provide `LIVEKIT_URL`, `LIVEKIT_API_KEY`, `LIVEKIT_API_SECRET` to the LiveKit agent environment. The worker is dispatched from `/api/voice/token`; its signed per-session gateway credential is carried in private LiveKit dispatch metadata, never the browser. `orchestrateEndpoint` and the matching server-only APIs must be available.

The worker does not use the LiveKit Inference gateway. By default it uses direct Groq `whisper-large-v3-turbo` STT with local Silero VAD and local CPU `espeak-ng` PCM TTS, so classroom audio does not consume gateway credits. Direct Deepgram STT and direct Cartesia TTS are opt-in only when `DEEPGRAM_API_KEY` or `CARTESIA_API_KEY` is explicitly present. Speech text is supplied by Groq with Gemini fallback through the authenticated LenxiQ streaming API.

Local development: `python agent.py dev`. Production deployment must run the agent on a LiveKit-compatible worker host. Do **not** change the production agent dispatch until a new worker has connected and passed an actual voice, barge-in, visual-sync and end-session test.

The ordered `TEACHING_PACKET` and `SYNC_VISUAL_STAGE` messages use reliable topic `lk-lesson-state`; stage transitions occur near the LiveKit `speaking` event rather than a browser timer. No network transport can guarantee zero delay or exactly-once delivery. Missing packets must be reconciled from `/api/live-class/orchestrate` state before continuing.
