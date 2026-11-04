import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
const read = p => readFile(new URL('../'+p, import.meta.url), 'utf8');

test('Text and explanation routes retain auth and paid access without obsolete AI spend gates', async () => {
  for (const file of ['app/api/teach/route.ts','app/api/explain/route.ts']) {
    const code = await read(file);
    assert.match(code,/GEMINI_API_KEY/);
    assert.match(code,/generativelanguage\.googleapis\.com/);
  }
  assert.match(await read('app/api/teach/route.ts'),/checkAccess\('teaching'\)/);
  assert.match(await read('app/api/explain/route.ts'),/checkAccess\('explanation'\)/);
});

test('native Gemini routes and SSE client are paired', async () => {
  assert.match(await read('app/api/teach/route.ts'),/streamGenerateContent\?alt=sse/);
  assert.match(await read('app/teach/page.tsx'),/parsed\.candidates/);
  assert.match(await read('app/api/explain/route.ts'),/:generateContent/);
});

test('Admin Refresh fetches uncached status and requires admin authentication', async () => {
  const view = await read('app/admin/ai-usage/AiUsagePanel.tsx');
  const api = await read('app/api/admin/ai-health/route.ts');
  assert.match(view,/aria-busy=\{loading\}/);
  assert.match(view,/cache: 'no-store'/);
  assert.match(view,/Last checked/);
  assert.match(api,/profile\?\.role !== 'admin'/);
  assert.match(api,/private, no-store/);
  assert.match(api,/await Promise\.all\(\[checkTutor\(\), checkLiveKit\(\)\]\)/);
  assert.match(api,/RoomServiceClient/);
  assert.match(api,/AbortSignal\.timeout\(7000\)/);
});

test('Live Class uses explicit LiveKit Cloud dispatch and a private Gemini gateway', async () => {
  const route = await read('app/api/voice/token/route.ts');
  assert.match(route,/reserve_live_class_session/);
  assert.match(route,/AgentDispatchClient/);
  assert.match(route,/createDispatch\(roomName, agentName/);
  assert.match(route,/sessionExpiresAt/);
  assert.doesNotMatch(route,/room-poll|modal\.App|min_containers/i);
  const gateway = await read('app/api/voice/llm/v1/chat/completions/route.ts');
  assert.match(gateway,/LIVEKIT_API_SECRET/);
  assert.match(gateway,/verifyLiveClassGatewayToken/);
  const auth = await read('lib/voice/live-class-gateway-auth.ts');
  assert.match(auth,/timingSafeEqual/);
  assert.match(gateway,/GEMINI_API_KEY/);
});

test('the unrelated storyboard endpoint and schema are absent from the current application', async () => {
  await assert.rejects(read('app/api/studio/videos/[id]/render/route.ts'), { code: 'ENOENT' });
  await assert.rejects(read('supabase/migrations/0046_video_studio.sql'), { code: 'ENOENT' });
});

test('password sign-in issues Supabase and active-session cookies on the same HTTP response', async () => {
  const login = await read('app/login/page.tsx');
  const route = await read('app/auth/password/route.ts');
  assert.match(login, /action="\/auth\/password" method="post"/);
  assert.match(route, /supabase\.auth\.signInWithPassword/);
  assert.match(route, /supabase\.auth\.signUp/);
  assert.match(route, /response\.cookies\.set\(\{ name, value, \.\.\.options \}\)/);
  assert.match(route, /response\.cookies\.set\('session_token'/);
  assert.match(route, /issueActiveSession\(supabase, data\.user\.id\)/);
});

test('Google OAuth uses Vercel canonical www domain and carries callback session cookies', async () => {
  for (const path of ['app/auth/google/route.ts', 'app/auth/callback/route.ts']) {
    const code = await read(path);
    assert.match(code, /https:\/\/www\.lenxiq\.online/);
    assert.doesNotMatch(code, /NEXT_PUBLIC_SITE_URL/);
  }
  assert.match(await read('app/auth/callback/route.ts'), /response\.cookies\.set\(\{ name, value, \.\.\.options \}\)/);
});

test('Live Class clock and listening begin on real tutor speech, not silent playback', async () => {
  const code = await read('app/voice/page.tsx');
  assert.match(code, /const markFirstTutorSpeech =/);
  assert.match(code, /if \(room\.canPlaybackAudio && !tutorMutedRef\.current\) markFirstTutorSpeech\(\)/);
  assert.match(code, /sessionStartedAtRef\.current = Date\.now\(\)/);
  assert.doesNotMatch(code, /sessionStartedAtRef\.current = 1/);
  assert.match(code, /liveStarted \? formatClock\(elapsedSeconds\) : 'Timer paused'/);
});

test('Google sign-in works after restoring a mobile history page', async () => {
  const button = await read('components/GoogleSignInButton.tsx');
  const middleware = await read('middleware.ts');
  assert.match(button, /href=\{href\}/);
  assert.doesNotMatch(button, /pointer-events-none|setStarting|useState/);
  assert.match(middleware, /hasPkceVerifier/);
  assert.match(middleware, /new URL\('\/auth\/callback'/);
});

test('Google OAuth uses a single allow-list-compatible callback while preserving return path', async () => {
  const google = await read('app/auth/google/route.ts');
  const callback = await read('app/auth/callback/route.ts');
  assert.ok(google.includes('redirectTo: `' + '${origin}/auth/callback' + '`'));
  assert.ok(google.includes('lensiq_oauth_next'));
  assert.ok(callback.includes("request.cookies.get('lensiq_oauth_next')"));
  assert.ok(callback.includes("response.cookies.delete('lensiq_oauth_next')"));
});


test('LiveKit Cloud receives unchanged medical model selection and simulation events', async () => {
  const live = await read('app/voice/page.tsx');
  const stage = await read('components/LiveClassVisualStage.tsx');
  const simulator = await read('components/PhysiologySimulator.tsx');
  const session = await read('app/api/voice/token/route.ts');
  assert.ok(live.includes("topic: 'lensiq.live_class.visual_feedback'"));
  assert.ok(live.includes("type: 'structure_selected'"));
  assert.ok(live.includes("type: 'simulation_result'"));
  assert.ok(live.includes("type: 'simulation_state'"));
  assert.ok(live.includes("data.type === 'live_class_interaction_ack'"));
  assert.ok(live.includes("learnerModelFocusUntilRef.current"));
  assert.ok(stage.includes('onSimulationResult={onSimulationResult}'));
  assert.ok(simulator.includes('onSimulationResult({ preset, variables: { ...values }, result, unit: model.unit })'));
  assert.ok(session.includes('version: 3,'));
  assert.ok(session.includes('approvedModelAssets: LIVE_CLASS_MODEL_ASSETS'));
});

test('3D viewer retains interactive anatomy selection and isolate controls', async () => {
  const viewer = await read('components/AnatomyViewer.tsx');
  assert.ok(viewer.includes('onStructureSelect?.(structureName(event.object))'));
  assert.ok(viewer.includes("viewMode !== 'isolate'"));
});

test('Groq Mouth remains primary, Gemini remains the lesson brain and quota fallback', async () => {
  const gateway = await read('app/api/voice/llm/v1/chat/completions/route.ts');
  const brain = await read('app/api/voice/context/route.ts');
  const token = await read('app/api/voice/token/route.ts');
  const browser = await read('app/voice/page.tsx');

  assert.match(gateway, /process\.env\.GROQ_API_KEY/);
  assert.match(gateway, /https:\/\/api\.groq\.com\/openai\/v1\/chat\/completions/);
  assert.match(gateway, /qwen\/qwen3\.8-27b/);
  assert.match(gateway, /reasoning_effort: 'none'/);
  assert.match(gateway, /provider = 'gemini'/);
  assert.match(gateway, /selectVoiceContext\(messages\)/);
  assert.match(gateway, /systems\.slice\(1\)\.slice\(-6\)/);
  assert.match(brain, /planLessonWithGemini/);
  assert.match(brain, /sourceOutline/);
  assert.match(brain, /Gemini lesson-planning|medical lesson-planning/);
  assert.match(token, /voiceGatewayToken/);
  assert.doesNotMatch(browser, /GROQ_API_KEY|GEMINI_API_KEY/);
});
