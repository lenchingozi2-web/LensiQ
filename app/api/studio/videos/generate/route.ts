import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const schema = {
  type: 'OBJECT',
  properties: {
    title: { type: 'STRING' },
    description: { type: 'STRING' },
    bgm_query: { type: 'STRING' },
    scenes: {
      type: 'ARRAY',
      items: {
        type: 'OBJECT',
        properties: {
          scene_number: { type: 'INTEGER' },
          narration: { type: 'STRING' },
          search_queries: { type: 'ARRAY', items: { type: 'STRING' } },
        },
        required: ['scene_number', 'narration', 'search_queries'],
      },
    },
  },
  required: ['title', 'description', 'bgm_query', 'scenes'],
};

function isScene(value: unknown): value is { scene_number: number; narration: string; search_queries: string[] } {
  if (!value || typeof value !== 'object') return false;
  const scene = value as Record<string, unknown>;
  return Number.isInteger(scene.scene_number)
    && typeof scene.narration === 'string' && scene.narration.trim().length > 0
    && Array.isArray(scene.search_queries)
    && scene.search_queries.length > 0
    && scene.search_queries.every((query) => typeof query === 'string' && query.trim().length > 0);
}

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Sign in to create a video.' }, { status: 401 });
    const body = await request.json().catch(() => null) as { prompt?: unknown } | null;
    const prompt = typeof body?.prompt === 'string' ? body.prompt.trim() : '';
    if (prompt.length < 8 || prompt.length > 4000) return NextResponse.json({ error: 'Enter a prompt between 8 and 4,000 characters.' }, { status: 400 });
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) return NextResponse.json({ error: 'Gemini is not configured on the server.' }, { status: 503 });

    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${encodeURIComponent(apiKey)}`, {
      method: 'POST',
      signal: AbortSignal.timeout(30000),
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: 'You are a concise YouTube Shorts producer. Return only the requested JSON. Create 4 to 8 scenes, each with natural narration and 2 to 4 concrete stock-video search queries. Keep the whole concept factual, safe, and engaging.' }] },
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.7, responseMimeType: 'application/json', responseSchema: schema },
      }),
    });
    const provider = await response.json().catch(() => ({}));
    if (!response.ok) {
      console.error('Gemini generation failed', { status: response.status, message: provider?.error?.message });
      return NextResponse.json({ error: 'Gemini could not generate the video plan.' }, { status: 502 });
    }
    const text = provider?.candidates?.[0]?.content?.parts?.[0]?.text;
    let plan: unknown;
    try { plan = JSON.parse(text); } catch { return NextResponse.json({ error: 'Gemini returned invalid JSON. Please try again.' }, { status: 502 }); }
    if (!plan || typeof plan !== 'object') return NextResponse.json({ error: 'Gemini returned an empty plan.' }, { status: 502 });
    const record = plan as Record<string, unknown>;
    const scenes = Array.isArray(record.scenes) ? record.scenes.filter(isScene) : [];
    if (typeof record.title !== 'string' || typeof record.description !== 'string' || typeof record.bgm_query !== 'string' || scenes.length < 1) {
      return NextResponse.json({ error: 'Gemini returned a plan that did not match the required schema.' }, { status: 502 });
    }
    const { data: video, error } = await supabase.from('videos').insert({
      user_id: user.id,
      title: record.title.trim().slice(0, 120),
      description: record.description.trim().slice(0, 5000),
      bgm_query: record.bgm_query.trim().slice(0, 200),
      scenes: scenes.map((scene, index) => ({ ...scene, scene_number: index + 1 })),
      status: 'pending',
    }).select('id,title,description,bgm_query,scenes,status,created_at').single();
    if (error || !video) { console.error('Video insert failed', error?.message); return NextResponse.json({ error: 'The video plan was generated but could not be saved.' }, { status: 503 }); }
    return NextResponse.json({ video }, { status: 201 });
  } catch (error) {
    console.error('Studio generation error', error);
    return NextResponse.json({ error: 'Unable to generate a video plan right now.' }, { status: 500 });
  }
}
