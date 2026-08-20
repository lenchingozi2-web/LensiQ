import { ServerOptions, cli, defineAgent, inference, voice } from '@livekit/agents';
import * as cartesia from '@livekit/agents-plugin-cartesia';
import * as deepgram from '@livekit/agents-plugin-deepgram';
import * as aiCoustics from '@livekit/plugins-ai-coustics';
import dotenv from 'dotenv';
import { fileURLToPath } from 'node:url';
import { createAgent } from './agent';

dotenv.config({ path: '.env.local' });

export default defineAgent({
  entry: async (ctx) => {
    const session = new voice.AgentSession({
      stt: new deepgram.STT({
        model: 'nova-3',
        language: 'en',
      }),
      tts: new cartesia.TTS({
        model: 'sonic-3',
        voice: 'f786b574-daa5-4673-aa0c-cbe3e8534c02',
      }),
      llm: new inference.LLM({ model: 'google/gemma-4-31b-it' }),
      vad: aiCoustics.vad(),
      turnHandling: {
        turnDetection: new inference.TurnDetector(),
        interruption: { mode: 'adaptive' },
        preemptiveGeneration: { enabled: true },
      },
    });

    await session.start({
      agent: createAgent(),
      room: ctx.room,
      inputOptions: {
        noiseCancellation: aiCoustics.audioEnhancement({ model: 'quailL' }),
      },
    });

    await ctx.connect();

    session.generateReply({
      instructions:
        'Greet the medical student briefly and ask what topic they would like to study.',
    });
  },
});

cli.runApp(
  new ServerOptions({
    agent: fileURLToPath(import.meta.url),
    agentName: 'lensiq-voice-tutor',
  }),
);
