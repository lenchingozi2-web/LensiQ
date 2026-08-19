# Voice Integration Research Notes

## Official sources

1. Deepgram live streaming audio: https://developers.deepgram.com/docs/live-streaming-audio
   The official guide shows a server-side Deepgram client created with `DEEPGRAM_API_KEY`, a live transcription connection using a current model such as `nova-3`, event listeners for open, close, message, and error, and streaming media sent into the connection. It also documents keep-alive behavior for streams that pause without closing.

2. Cartesia realtime TTS quickstart: https://docs.cartesia.ai/get-started/realtime-text-to-speech-quickstart
   Cartesia's WebSocket API supports pushing incremental text chunks and receiving audio chunks in real time. The browser must use ephemeral access tokens rather than exposing the permanent API key. The stream uses a context with model, voice, and output format, then pushes continuations and signals completion.

3. LiveKit voice AI quickstart: https://docs.livekit.io/agents/start/voice-ai/
   LiveKit Agents supports browser voice sessions through LiveKit Cloud or self-hosting. The architecture can be a chained STT-LLM-TTS pipeline or a realtime speech model. The official Node.js starter requires Node.js 20 or later and uses a server-side agent process.

4. LiveKit turn detection and interruption handling: https://livekit.com/blog/turn-detection-and-interruption-handling
   LiveKit separates VAD, end-of-turn detection, and interruption handling. Its current guidance recommends the audio-based turn detector for most pipeline agents and adaptive interruption handling where supported. Interruption behavior should pause the agent, distinguish genuine barge-ins from backchannels, and resume after false interruptions.

## Design implications for LensiQ

Permanent Deepgram, Cartesia, and LiveKit secrets must remain server-side. The browser should receive only a short-lived LiveKit token and, where required, a Cartesia ephemeral token. The first production voice slice should be a separate agent service or worker rather than forcing a long-lived audio WebSocket through a Next.js route handler. The LensiQ web app should own authentication, course selection, grounded context, class-session state, and token issuance, while the realtime agent owns microphone audio, VAD, STT, interruptions, TTS playback, and resume-after-question behavior.
