# LenxiQ Live Voice Tutor Foundation

The web application now owns authentication and short-lived LiveKit room-token issuance at `/api/voice/token`. The browser receives only the LiveKit URL and a token that expires after ten minutes. Permanent LiveKit, Deepgram, and Cartesia credentials must never be sent to the browser or committed to GitHub.

## Runtime architecture

The production voice agent should run as a separate Node.js or Python service. It joins the room created by the web application, subscribes to the learner’s microphone track, performs turn detection and interruption handling through LiveKit Agents, sends speech to Deepgram Nova-3 for transcription, calls the grounded LenxiQ teaching backend with the learner’s course/session context, and streams the response through Cartesia Sonic-3.5 for playback. The agent should publish only synthesized audio and optional transcript/data tracks back to the room.

The initial web slice intentionally does not put a long-lived audio WebSocket inside a Next.js route handler. This keeps token issuance, user authorization, realtime media, and provider-specific processing separated for operational reliability.

## Required variables

| Variable | Runtime | Purpose |
|---|---|---|
| `LIVEKIT_URL` | Web and agent | LiveKit Cloud or self-hosted server URL |
| `LIVEKIT_API_KEY` | Web and agent | Server-side room-token signing and agent authentication |
| `LIVEKIT_API_SECRET` | Web and agent | Server-side room-token signing and agent authentication |
| `DEEPGRAM_API_KEY` | Agent only | Deepgram Nova-3 streaming speech-to-text |
| `CARTESIA_API_KEY` | Agent only | Cartesia Sonic-3.5 realtime speech synthesis |
| `DEEPGRAM_MODEL` | Agent only | Defaults to `nova-3` |
| `CARTESIA_MODEL` | Agent only | Defaults to `sonic-3.5` |

Set these values in the Vercel/hosting environment dashboard and the agent service’s secret manager. Do not paste them into chat, source files, screenshots, or commit history.

## Production hardening checklist

Before enabling paid voice sessions, the agent service should verify room metadata, use a bounded room lifetime, enforce one active voice room per user, log provider failures without logging audio or credentials, implement reconnect and cleanup behavior, and keep the existing grounded teaching-context builder as the source of academic content. Voice is a transport and modality layer; it must not bypass the platform’s entitlement checks or grounding rules.
