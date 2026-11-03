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

test('voice worker joins before optional lecture loading', async () => {
  const voice = await read('pipecat-voice-agent/agent.py');
  const join = voice.indexOf('await queue_initial_greeting("pipeline_start")');
  const preload = voice.indexOf('await asyncio.wait_for(material_bridge.preload(), timeout=20)');
  assert.ok(join>=0 && preload>join);
  assert.match(voice,/PipelineRunner\(\)\.run\(task\)/);
  assert.match(voice,/material_bridge, llm,/);
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


test('deployed Live Class tutor selection and numerical simulator feedback use the same protocol', async () => {
  const live = await read('app/voice/page.tsx');
  const stage = await read('components/LiveClassVisualStage.tsx');
  const simulator = await read('components/PhysiologySimulator.tsx');
  const worker = await read('pipecat-voice-agent/agent.py');
  const modal = await read('pipecat-voice-agent/agent_modal.py');
  const session = await read('app/api/voice/token/route.ts');

  assert.ok(live.includes("topic: 'lensiq.live_class.visual_feedback'"));
  assert.ok(live.includes("type: 'structure_selected'"));
  assert.ok(live.includes("type: 'simulation_result'"));
  assert.ok(live.includes("type: 'simulation_state'"));
  assert.ok(live.includes("data.type === 'live_class_interaction_ack'"));
  assert.ok(live.includes("learnerModelFocusUntilRef.current"));
  assert.ok(stage.includes('onSimulationResult={onSimulationResult}'));
  assert.ok(simulator.includes('onSimulationResult({ preset, variables: { ...values }, result, unit: model.unit })'));
  assert.ok(worker.includes('VisualPacer(material_bridge.approved_models, material_bridge.approved_molecules)'));
  assert.ok(worker.includes('focus = interaction_focus(data, material_bridge.approved_models)'));
  assert.ok(worker.includes('"live_class_interaction_ack"'));
  assert.ok(worker.includes('if data.get("type") == "simulation_state":'));
  assert.ok(modal.includes('.add_local_file(HERE / "visual_tutor.py", "/root/visual_tutor.py")'));
  assert.ok(session.includes('version: 3,'));
  assert.ok(session.includes('approvedModelAssets: LIVE_CLASS_MODEL_ASSETS'));
});

test('3D context and audio synthesis remain distinct; model interaction does not replace the voice pipeline', async () => {
  const worker = await read('pipecat-voice-agent/agent.py');
  const visual = await read('pipecat-voice-agent/visual_tutor.py');
  const viewer = await read('components/AnatomyViewer.tsx');
  assert.ok(worker.includes('transport.input(), stt, user_bridge, user_aggregator, material_bridge, llm,'));
  assert.ok(worker.includes('SuppressPrivateControlFrames(), tts, assistant_bridge, transport.output(), assistant_aggregator'));
  assert.ok(worker.includes('allow_interruptions=True'));
  assert.ok(viewer.includes('onStructureSelect?.(structureName(event.object))'));
  assert.ok(viewer.includes("viewMode !== 'isolate'"));
  assert.ok(visual.includes('REFERENCE_KEYS'));
  assert.ok(visual.includes('simulation_snapshot'));
});
