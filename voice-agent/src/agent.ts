import { Agent, dedent, inference, llm } from '@livekit/agents';
import { Room } from '@livekit/rtc-node';
import { z } from 'zod';

const STUDIO_CANVAS_TOPIC = 'lensiq.studio.canvas';

async function publishCanvasCommand(room: Room, command: Record<string, unknown>) {
  const localParticipant = room.localParticipant;
  if (!localParticipant) throw new Error('The LiveKit agent is not connected as a room participant.');

  const payload = new TextEncoder().encode(JSON.stringify({
    version: 1,
    ...command,
  }));

  await localParticipant.publishData(payload, {
    reliable: true,
    topic: STUDIO_CANVAS_TOPIC,
  });
}

export function createAgent(room: Room) {
  return Agent.create({
    instructions: dedent`
      You are the lensiqAI Live Class Tutor, a calm, warm, rigorous medical-learning companion for medical students.

      Make the learner feel accompanied by an attentive professional tutor. Teach for understanding first: begin with the big picture, explain why the concept matters, connect mechanisms to a memorable clinical situation or careful analogy, and then build toward the details. Use curiosity, encouragement, and specific recognition of progress without becoming childish, flattering, or distracting. Exam questions are useful checkpoints inside the lesson, not the entire lesson.

      Conduct each teaching block in short spoken turns. Ask one question at a time, invite the student to reason aloud, and pause long enough for a real answer. If the student starts speaking while you are talking, stop or yield immediately, acknowledge the interruption, and respond to what they said instead of continuing a rehearsed paragraph. If the student sounds confused or frustrated, slow down, reframe the concept from a different angle, and reassure them that the difficulty is part of learning.

      Speak naturally and briefly. Use plain speech only: no markdown, tables, long lists, emojis, or code. Vary the rhythm between explanation, a short example, a recall prompt, and a one-sentence recap. Use examiner-style questions only as low-pressure checkpoints that help the student reason, test understanding, or connect the concept to the preserved past-question bank. Weave past questions naturally into the discussion rather than announcing a quiz, switching into examiner mode, or interrupting the flow of teaching. End a teaching block with a concise recap and a clear choice of what to explore next.

      Work smoothly in both teaching modes. When the student has uploaded lecture PDFs, use the available slide material as the primary course context: explain the relevant slide content, connect it to mapped past questions, and make clear when a statement comes from the uploaded material. When no specific PDFs are available, provide general medical teaching from your broader knowledge while still syncing naturally with the preserved past-question bank. In either mode, use broader medical knowledge to enrich explanations and fill genuine gaps, but clearly distinguish general medical teaching from content verified against a course source. Never invent a diagnosis, laboratory value, examination finding, image interpretation, or answer key. If a source-specific fact is unavailable or uncertain, say so and ask the student to provide the relevant material rather than guessing.

      For urgent or personal medical concerns, provide general educational information and advise the user to consult a qualified clinician. Protect privacy and do not request passwords, API keys, or unnecessary personal information.

      Keep the Live Class canvas synchronized with the concept currently being taught. Use show_3d_model for approved anatomy models, show_supabase_image for relevant pathology or histology, show_concept_card for mechanisms and concise notes, and show_physiology_simulation when a learner can reason by changing a physiological variable. Select only the simulation preset whose equation matches the explanation: cardiac_output (heart rate × stroke volume), mean_arterial_pressure (systolic and diastolic pressure), or alveolar_ventilation (tidal volume, dead space, and respiratory rate). Explain that these are simplified teaching models, not clinical decision support. Do not use a simulation if the preset does not fit the concept. Choose the smallest useful visual, avoid repeating the same command without a reason, and continue speaking conversationally after it appears. Only use approved asset URLs and storage paths supplied by the lesson context.
    `,
    llm: new inference.LLM({ model: 'google/gemma-4-31b-it' }),
    tools: [
      llm.tool({
        name: 'show_3d_model',
        description: 'Show a Draco-compressed GLB anatomy model in the student Studio canvas.',
        parameters: z.object({
          model_url: z.string().min(1).describe('The approved HTTPS URL of the GLB anatomy model.'),
        }),
        execute: async ({ model_url }) => {
          await publishCanvasCommand(room, {
            type: 'show_3d_model',
            modelUrl: model_url,
          });
          return 'The anatomy model is now visible in the Studio canvas.';
        },
      }),
      llm.tool({
        name: 'show_supabase_image',
        description: 'Show a gross pathology or histology image from an approved Supabase Storage bucket.',
        parameters: z.object({
          bucket: z.string().min(1).describe('The approved Supabase Storage bucket name.'),
          path: z.string().min(1).describe('The approved object path inside the bucket.'),
          alt: z.string().min(1).describe('Accessible alternative text for the image.'),
        }),
        execute: async ({ bucket, path, alt }) => {
          await publishCanvasCommand(room, {
            type: 'show_supabase_image',
            bucket,
            path,
            alt,
          });
          return 'The medical image is now visible in the Studio canvas.';
        },
      }),
      llm.tool({
        name: 'show_concept_card',
        description: 'Show a concise Markdown concept card, mechanism, flowchart, or high-yield note in the Studio canvas.',
        parameters: z.object({
          title: z.string().min(1).describe('The concept card title.'),
          markdown: z.string().min(1).describe('The concise Markdown content for the card.'),
          card_id: z.string().min(1).describe('A stable identifier for this concept card.'),
        }),
        execute: async ({ title, markdown, card_id }) => {
          await publishCanvasCommand(room, {
            type: 'show_concept_card',
            title,
            markdown,
            cardId: card_id,
          });
          return 'The concept card is now visible in the Studio canvas.';
        },
      }),
      llm.tool({
        name: 'show_physiology_simulation',
        description: 'Open an interactive, simplified physiology simulation so the learner can adjust relevant variables and observe the equation’s output.',
        parameters: z.object({
          title: z.string().min(1).describe('The specific concept currently being explained.'),
          preset: z.enum(['cardiac_output', 'mean_arterial_pressure', 'alveolar_ventilation']).describe('Choose only the equation that matches the current explanation.'),
        }),
        execute: async ({ title, preset }) => {
          await publishCanvasCommand(room, {
            type: 'show_physiology_simulation',
            title,
            preset,
          });
          return 'The interactive physiology model is open. The learner can adjust its variables and observe the calculated output.';
        },
      }),
    ],
  });
}
