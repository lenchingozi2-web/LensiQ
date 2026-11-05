import { issueLiveClassGatewayToken } from '@/lib/voice/live-class-gateway-auth';
import { NextResponse } from 'next/server';
import { AccessToken, AgentDispatchClient } from 'livekit-server-sdk';
import { createClient } from '../../../../lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { logAuthRequestRejection } from '../../../../lib/auth/request-diagnostics';
import { LIVE_CLASS_MODEL_ASSETS, LIVE_CLASS_MOLECULE_ASSETS } from '@/lib/voice/live-class-visuals';
import { includesLiveClass } from '@/lib/plans';

function normalizeLiveKitUrl(value: string) {
  const trimmed = value.trim().replace(/^['"]|['"]$/g, '').replace(/\/$/, '');
  const withWebSocketProtocol = trimmed.replace(/^https:\/\//i, 'wss://').replace(/^http:\/\//i, 'ws://');
  const candidate = /^wss?:\/\//i.test(withWebSocketProtocol) ? withWebSocketProtocol : `wss://${withWebSocketProtocol}`;
  const parsed = new URL(candidate);
  if (!['ws:', 'wss:'].includes(parsed.protocol)) throw new Error('LIVEKIT_URL must use ws:// or wss://.');

  if (!parsed.hostname.includes('.') && !parsed.hostname.includes(':')) {
    parsed.hostname = `${parsed.hostname}.livekit.cloud`;
  }

  return parsed.toString().replace(/\/$/, '');
}

export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (!user) {
    logAuthRequestRejection(req, 'voice-token', authError);
    return NextResponse.json({ error: 'Not authenticated.', message: 'Sign in to start your Live Class.' }, { status: 401 });
  }

  const {error:refreshError}=await supabase.rpc('refresh_my_subscription');
  if(refreshError)return NextResponse.json({error:'Unable to refresh your subscription. Please retry.'},{status:503});
  const { data: voiceProfile } = await supabase
    .from('profiles')
    .select('role, plan, plan_expires_at')
    .eq('id', user.id)
    .maybeSingle();
  const activePaidPlan = Boolean(voiceProfile?.plan && voiceProfile.plan !== 'free'
    && (!voiceProfile.plan_expires_at || new Date(voiceProfile.plan_expires_at) > new Date()));
  const hasLiveClassEntitlement = voiceProfile?.role === 'admin'
    || (activePaidPlan && includesLiveClass(voiceProfile?.plan));
  if (!hasLiveClassEntitlement) {
    return NextResponse.json({
      error: 'live_class_plan_required',
      message: 'Choose Scholar, Scholar Plus or Mastery to use Live Class. Free accounts have no Live Class access.',
    }, { status: 403 });
  }

  const admin = createAdminClient();
  if (!admin) return NextResponse.json({ error: 'ai_runtime_unavailable', message: 'Live Class is temporarily unavailable. Please try again later.' }, { status: 503 });

  // Both real-time media and the Pipecat tutor are hosted on LiveKit Cloud.
  // One authenticated session reserves a room before explicit agent dispatch.
  const rawLivekitUrl = process.env.LIVEKIT_PUBLIC_URL || process.env.LIVEKIT_URL;
  const apiKey = process.env.LIVEKIT_API_KEY;
  const apiSecret = process.env.LIVEKIT_API_SECRET;

  if (!rawLivekitUrl || !apiKey || !apiSecret) {
    return NextResponse.json({ error: 'Voice tutoring is not configured yet. Please check the LiveKit server settings.' }, { status: 503 });
  }

  const rawLivekitUrls = Array.from(new Set([
    rawLivekitUrl,
    process.env.LIVEKIT_URL,
  ].filter((value): value is string => Boolean(value?.trim()))));
  const livekitUrls: string[] = [];
  for (const candidate of rawLivekitUrls) {
    try {
      const normalized = normalizeLiveKitUrl(candidate);
      if (!livekitUrls.includes(normalized)) livekitUrls.push(normalized);
    } catch {
      // Ignore legacy/invalid fallback values and try the next configured URL.
    }
  }
  if (!livekitUrls.length) {
    return NextResponse.json({ error: 'The LiveKit server URL is invalid. It must be a LiveKit ws:// or wss:// endpoint.' }, { status: 503 });
  }

  // Do not parse arbitrarily large JSON into serverless memory.
  const advertisedLength = Number(req.headers.get('content-length') || 0);
  if (Number.isFinite(advertisedLength) && advertisedLength > 40 * 1024) {
    return NextResponse.json({ error: 'Live Class request is too large.' }, { status: 413 });
  }
  const rawBody = await req.text();
  if (Buffer.byteLength(rawBody, 'utf8') > 40 * 1024) {
    return NextResponse.json({ error: 'Live Class request is too large.' }, { status: 413 });
  }
  let body: Record<string, unknown>;
  try {
    const parsed: unknown = JSON.parse(rawBody);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('Invalid body');
    body = parsed as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: 'Invalid Live Class request.' }, { status: 400 });
  }
  const courseName = typeof body?.courseName === 'string' && body.courseName.trim() ? body.courseName.trim().slice(0, 120) : 'Live Class';
  const topicFocus = typeof body?.topicFocus === 'string' && body.topicFocus.trim() ? body.topicFocus.trim().slice(0, 300) : '';
  const focusText = typeof body?.focusText === 'string' && body.focusText.trim() ? body.focusText.trim().slice(0, 1200) : '';
  const conversationId = typeof body?.conversationId === 'string' && body.conversationId.trim() ? body.conversationId.trim() : null;
  if (conversationId && !/^[0-9a-f]{8}-[0-9a-f-]{27,36}$/i.test(conversationId)) {
    return NextResponse.json({ error: 'Invalid Live Class conversation.' }, { status: 400 });
  }
  const safeUrl = (value: unknown): value is string => {
    if (typeof value !== 'string' || value.length > 4096) return false;
    try {
      const parsed = new URL(value);
      const expected = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://hixvbcrrklyajhkyliay.supabase.co');
      const prefix = '/storage/v1/object/sign/ephemeral_class_materials/' + user.id + '/';
      return parsed.protocol === 'https:' && parsed.origin === expected.origin &&
        parsed.pathname.startsWith(prefix) && parsed.searchParams.has('token');
    } catch { return false; }
  };
  const materialUrls = Array.isArray(body?.fileUrls) ? body.fileUrls.filter(safeUrl).slice(0, 6) : [];
  // Preserve empty map slots so a failed second map cannot become file three.
  const candidates = Array.isArray(body?.materialMapUrls)
    ? body.materialMapUrls.slice(0, materialUrls.length) : [];
  const materialMapUrls: string[] = Array.from({ length: materialUrls.length }, (_, index) => {
    const candidate: unknown = candidates[index];
    return safeUrl(candidate) ? candidate : '';
  });
  const rawMaterialContext = body?.materialContext && typeof body.materialContext === 'object' ? body.materialContext as { primaryBranch?: unknown; branches?: unknown; sources?: unknown } : null;
  const materialContext = rawMaterialContext ? {
    primaryBranch: typeof rawMaterialContext.primaryBranch === 'string' ? rawMaterialContext.primaryBranch.slice(0, 80) : null,
    branches: Array.isArray(rawMaterialContext.branches) ? rawMaterialContext.branches.filter((value): value is string => typeof value === 'string').slice(0, 8).map((value) => value.slice(0, 80)) : [],
    sources: Array.isArray(rawMaterialContext.sources) ? rawMaterialContext.sources.filter((value): value is string => typeof value === 'string').slice(0, 6).map((value) => value.slice(0, 120)) : [],
  } : null;
  const roomName = `lensiq-voice-${user.id.slice(0, 8)}-${crypto.randomUUID()}`;

  const reserveSession = () => supabase.rpc('reserve_live_class_session', {
    p_room_name: roomName,
    p_course_name: courseName,
    p_conversation_id: conversationId,
  });
  const { data: reservation, error: reservationError } = await reserveSession();
  const quota = Array.isArray(reservation) ? reservation[0] : reservation;

  if (reservationError || !quota) {
    console.error('Live Class reservation failed:', reservationError);
    const databaseIssue = reservationError?.code === '42883' || reservationError?.code === '42703' || /does not exist|column|function/i.test(reservationError?.message || '');
    return NextResponse.json({ error: databaseIssue ? 'Live Class backend migration is not active yet. Please contact the administrator to apply the latest database migration.' : 'Unable to reserve a Live Class session right now. Please try again.' }, { status: 503 });
  }

  if (!quota.allowed) {
    const limitMessage = quota.reason === 'premium_required'
      ? 'Live Class is included with paid plans. Upgrade to unlock the interactive voice and visual classroom.'
      : quota.reason === 'free_monthly_exhausted'
        ? 'Live Class is included with paid plans. Upgrade to unlock the interactive voice and visual classroom.'
        : quota.reason === 'voice_balance_empty'
          ? 'Your Premium Live Class allowance is used. Minutes refresh on your next monthly billing date; additional minute purchases are not available.'
          : quota.reason === 'active_session'
            ? 'You already have an active Live Class. End it before starting another one.'
            : quota.reason === 'free_trial_used'
              ? 'Your Live Class quota is still being updated. Please try again shortly.'
              : quota.reason === 'profile_missing'
                ? 'Your account is still being set up. Refresh the page and try again.'
                : quota.reason === 'not_authenticated'
                  ? 'Your sign-in session expired. Sign in again and try again.'
                  : `Live Class could not be started (${quota.reason || 'unknown backend reason'}). Please try again.`;
    return NextResponse.json({
      error: 'live_class_limit',
      message: limitMessage,
      quota: {
        isUnlimited: false,
        usedSessions: quota.used_sessions ?? 0,
        maxSessions: quota.max_sessions ?? 1,
        maxDurationSeconds: quota.max_duration_seconds ?? 1800,
        resetsAt: quota.expires_at,
        reason: quota.reason ?? null,
      },
    }, { status: 403 });
  }

  // Every failed LiveKit start must release its reserved room, otherwise a
  // learner can lose available classroom access without ever connecting.
  const releaseFailedStart = async () => {
    const { error } = await supabase.rpc('charge_live_class_session', {
      p_session_id: quota.session_id,
      p_duration_seconds: 0,
      p_end: true,
    });
    if (error) console.error('Unable to release failed Live Class start', error.code || 'unknown');
  };

  const isUnlimited = Boolean(quota.is_unlimited);
  const maxDurationSeconds = Math.min(90 * 60, Math.max(60, Number(quota.max_duration_seconds ?? 90 * 60)));
  // A reservation's billing expiry may be days away. The voice worker and
  // signed gateway token must expire at the current classroom's 90-minute cap.
  const maxClassExpiry = Date.now() + maxDurationSeconds * 1000;
  const quotaExpiry = typeof quota.expires_at === 'string' ? Date.parse(quota.expires_at) : NaN;
  const sessionExpiresAt = new Date(Math.min(
    maxClassExpiry,
    Number.isFinite(quotaExpiry) ? quotaExpiry : maxClassExpiry,
  )).toISOString();
  const voiceGatewayToken = issueLiveClassGatewayToken(apiSecret, {
    roomName,
    sessionId: String(quota.session_id),
    userId: user.id,
    expiresAt: sessionExpiresAt,
  });
  const dispatchMetadata = JSON.stringify({
    voiceGatewayToken,
    userId: user.id,
    courseName,
    topicFocus,
    focusText,
    sessionType: 'live_class',
    sessionId: quota.session_id,
    sessionExpiresAt,
    contextEndpoint: `${new URL(req.url).origin}/api/voice/context`,
    visualCatalogEndpoint: `${new URL(req.url).origin}/api/voice/models`,
    materialUrls,
    materialMapUrls,
    materialContext,
    // The actual worker is the source of model decisions. Keep metadata small:
    // the browser alone owns the verbose attribution/ontology catalogue.
    visualInstructions: 'Teach beside the real-time medical 3D viewer. The worker stages only approved anatomy, pathology schematics, pharmacology structures and numeric labs as speech is synthesized. Listen to validated structure selections and simulation results; explain changes and clinical significance without inventing visual details. Treat HRA organs as healthy reference anatomy, not diseased specimens. Use the uploaded study material as the primary course evidence; do not mix subjects without acknowledging a transition. Allow students to rotate, isolate, zoom and change lab variables before giving a concise explanation. Do not read source URLs, stage instructions or JSON aloud. Keep the current responsive voice and natural interruption handling unchanged.',
    visualProtocol: {
      version: 3,
      dataChannelTopic: 'lensiq.live_class.visual',
      interactionTopic: 'lensiq.live_class.visual_feedback',
      approvedModelAssets: LIVE_CLASS_MODEL_ASSETS,
      approvedMoleculeAssets: LIVE_CLASS_MOLECULE_ASSETS,
      commands: [
        { type: 'show_3d_model', modelUrl: 'exact HTTPS URL from approvedModelAssets', structureId: 'optional matching structure name', highlightColor: '#E8A23D' },
        { type: 'show_molecular_model', modelUrl: 'exact HTTPS URL from approvedMoleculeAssets' },
        { type: 'highlight_structure', structureId: 'structure name that matches the active GLB mesh', color: '#E8A23D' },
        { type: 'show_physiology_simulation', preset: 'cardiac_output | mean_arterial_pressure | alveolar_ventilation | acid_base_balance | anion_gap | drug_half_life | competitive_antagonism | oxygen_content | renal_clearance', title: 'current concept' },
        { type: 'show_medical_media', mediaUrl: 'URL from supplied study materials only', caption: 'short label' },
        { type: 'show_whiteboard', topic: 'current concept', markdown: 'concise mechanism, sequence, or equations with up to five main points' },
        { type: 'simulation_state', preset: 'approved clinical lab', variables: 'bounded numeric inputs', result: 'calculated value' },
        { type: 'simulation_result', preset: 'approved clinical lab', variables: 'bounded numeric inputs', result: 'request tutor explanation' },
      ],
    },
  });
  
  // Dispatch itself authenticates the Cloud project. A separate listRooms()
  // probe duplicated that network round trip on every classroom start.
  let livekitUrl: string | null = null;
  const agentName = process.env.LIVEKIT_AGENT_NAME?.trim() || 'lensiq-voice-tutor';
  for (const candidateUrl of livekitUrls) {
    const dispatchHost = candidateUrl.replace(/^wss:/i, 'https:').replace(/^ws:/i, 'http:');
    try {
      const dispatchClient = new AgentDispatchClient(dispatchHost, apiKey, apiSecret);
      await dispatchClient.createDispatch(roomName, agentName, { metadata: dispatchMetadata });
      livekitUrl = candidateUrl;
      break;
    } catch (error) {
      const failure = error as { status?: number; code?: string };
      console.warn('LiveKit dispatch failed', {
        host: new URL(dispatchHost).host, status: failure.status, code: failure.code,
      });
    }
  }
  if (!livekitUrl) {
    await releaseFailedStart();
    return NextResponse.json({
      error: 'livekit_tutor_dispatch_failed',
      message: 'The Live Class tutor could not be dispatched. Please try again.',
    }, { status: 503 });
  }

  const token = new AccessToken(apiKey, apiSecret, {
    identity: user.id,
    name: user.email ?? 'LenxiQ AI learner',
    metadata: '{}', // Keep the student token small; private context belongs in room metadata.
    ttl: `${maxDurationSeconds + 45}s`,
  });

  token.addGrant({
    room: roomName,
    roomJoin: true,
    canPublish: true,
    canSubscribe: true,
    canPublishData: true,
  });

  return NextResponse.json({
    token: await token.toJwt(),
    url: livekitUrl,
    roomName,
    sessionId: quota.session_id,
    expiresInSeconds: maxDurationSeconds + 45,
    quota: {
      isUnlimited,
      usedSessions: quota.used_sessions ?? null,
      maxSessions: quota.max_sessions ?? null,
      maxDurationSeconds: quota.max_duration_seconds ?? maxDurationSeconds,
      expiresAt: quota.expires_at ?? null,
      resetsAt: isUnlimited ? null : new Date(new Date().getFullYear(), new Date().getMonth() + 1, 1).toISOString(),
    },
  });
}

