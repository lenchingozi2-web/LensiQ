import { NextResponse } from 'next/server';
import { AccessToken, AgentDispatchClient } from 'livekit-server-sdk';
import { createClient } from '../../../../lib/supabase/server';
import { LIVE_CLASS_MODEL_ASSETS, LIVE_CLASS_MOLECULE_ASSETS } from '@/lib/voice/live-class-visuals';
import { LIVE_CLASS_MODEL_CATALOG, LIVE_CLASS_MOLECULE_CATALOG } from '@/lib/voice/live-class-model-catalog';

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
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Not authenticated.', message: 'Sign in to start your Live Class.' }, { status: 401 });

  const rawLivekitUrl = process.env.NEXT_PUBLIC_LIVEKIT_URL || process.env.LIVEKIT_SELF_HOSTED_URL || process.env.LIVEKIT_URL;
  const internalLivekitUrl = process.env.LIVEKIT_INTERNAL_URL?.trim();
  const apiKey = process.env.LIVEKIT_API_KEY;
  const apiSecret = process.env.LIVEKIT_API_SECRET;

  if (!rawLivekitUrl || !apiKey || !apiSecret) {
    return NextResponse.json({ error: 'Voice tutoring is not configured yet. Please check the LiveKit server settings.' }, { status: 503 });
  }

  let livekitUrl: string;
  try {
    livekitUrl = normalizeLiveKitUrl(rawLivekitUrl);
  } catch {
    return NextResponse.json({ error: 'The LiveKit server URL is invalid. It must be a LiveKit ws:// or wss:// endpoint.' }, { status: 503 });
  }

  const body = await req.json().catch(() => ({}));
  const courseName = typeof body?.courseName === 'string' && body.courseName.trim() ? body.courseName.trim().slice(0, 120) : 'Live Class';
  const topicFocus = typeof body?.topicFocus === 'string' && body.topicFocus.trim() ? body.topicFocus.trim().slice(0, 300) : '';
  const focusText = typeof body?.focusText === 'string' && body.focusText.trim() ? body.focusText.trim().slice(0, 1200) : '';
  const conversationId = typeof body?.conversationId === 'string' && body.conversationId.trim() ? body.conversationId.trim() : null;
  const materialUrls = Array.isArray(body?.fileUrls) ? body.fileUrls.filter((value: unknown): value is string => typeof value === 'string' && value.startsWith('http')).slice(0, 20) : [];
  const rawMaterialContext = body?.materialContext && typeof body.materialContext === 'object' ? body.materialContext as { primaryBranch?: unknown; branches?: unknown; sources?: unknown } : null;
  const materialContext = rawMaterialContext ? {
    primaryBranch: typeof rawMaterialContext.primaryBranch === 'string' ? rawMaterialContext.primaryBranch.slice(0, 80) : null,
    branches: Array.isArray(rawMaterialContext.branches) ? rawMaterialContext.branches.filter((value): value is string => typeof value === 'string').slice(0, 8) : [],
    sources: Array.isArray(rawMaterialContext.sources) ? rawMaterialContext.sources.filter((value): value is string => typeof value === 'string').slice(0, 20) : [],
  } : null;
  const roomName = `lensiq-voice-${user.id.slice(0, 8)}-${crypto.randomUUID()}`;

  const reserveSession = () => supabase.rpc('reserve_live_class_session', {
    p_room_name: roomName,
    p_course_name: courseName,
    p_conversation_id: conversationId,
  });
  let { data: reservation, error: reservationError } = await reserveSession();
  let quota = Array.isArray(reservation) ? reservation[0] : reservation;

  // Some deployments still expose the pre-monthly quota RPC. Clear its consumed
  // marker once, then retry so an account is not blocked by the stale rule.
  if (!reservationError && quota?.reason === 'free_trial_used') {
    const { error: legacyMarkerError } = await supabase
      .from('profiles')
      .update({ free_live_class_trial_used_at: null })
      .eq('id', user.id);
    if (!legacyMarkerError) {
      ({ data: reservation, error: reservationError } = await reserveSession());
      quota = Array.isArray(reservation) ? reservation[0] : reservation;
    }
  }

  if (reservationError || !quota) {
    console.error('Live Class reservation failed:', reservationError);
    const databaseIssue = reservationError?.code === '42883' || reservationError?.code === '42703' || /does not exist|column|function/i.test(reservationError?.message || '');
    return NextResponse.json({ error: databaseIssue ? 'Live Class backend migration is not active yet. Please contact the administrator to apply the latest database migration.' : 'Unable to reserve a Live Class session right now. Please try again.' }, { status: 503 });
  }

  if (!quota.allowed) {
    const limitMessage = quota.reason === 'premium_required'
      ? 'Your free Live Class allowance is used for this month. It refreshes next month, or upgrade to Hybrid Premium for 6 hours each billing month.'
      : quota.reason === 'free_monthly_exhausted'
        ? 'Your free Live Class allowance is used for this month. It refreshes next month, or upgrade to Hybrid Premium for 6 hours each billing month.'
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

  const isUnlimited = Boolean(quota.is_unlimited);
  const maxDurationSeconds = isUnlimited ? 86400 : Math.max(60, Number(quota.max_duration_seconds ?? 1800));
  const dispatchHost = (internalLivekitUrl || livekitUrl).replace(/^wss:/i, 'https:').replace(/^ws:/i, 'http:').replace(/\/$/, '');
  const dispatchMetadata = JSON.stringify({
    userId: user.id,
    courseName,
    topicFocus,
    focusText,
    sessionType: 'live_class',
    contextEndpoint: `${new URL(req.url).origin}/api/voice/context`,
    materialUrls,
    materialContext,
    visualInstructions: 'You are teaching inside an interactive visual medical classroom, not an audio-only call. The visual stage is a first-class part of the lesson and is already available to you through the LiveKit data channel. Keep it synchronized with the exact concept being explained: before or as a new concept begins, publish the smallest useful approved visual command on lensiq.live_class.visual. The uploaded material is parsed text and is the primary source for this class. If the selected course toggle conflicts with the detected uploaded branch, explicitly say you are switching context and follow the uploaded material for the current lesson; do not blend Pharmacology and Pathology evidence without labelling the switch. If the learner changes subject, ask one short clarifying question or state the new context before continuing. You have a finite model inventory: use only the approved catalog below and be honest when a requested structure is not available. Use the approved 3D anatomy model for renal anatomy; use the labelled drug-target PDB model for its exact pharmacology concept; use the supplied original 3D schematics for pathology, histology, and cytology; use the matching interactive physiology simulation for cardiac output, mean arterial pressure, or alveolar ventilation; use medical media only when an actual supplied URL is relevant. If no suitable model exists for a non-visual mechanism, switch to a concise show_whiteboard mechanism/sequence/equation card, and keep it tied to what you are saying. Do not claim to display a micrograph, image, model, ligand, or simulation that is not in the catalogs. These cytology/histology/pathology schematics are simplified teaching aids, not clinical-grade or diagnostic imagery. For the beta-2 receptor structure, the bound ligand is carazolol (PDB 2RH1); never describe it as propranolol or carvedilol. The acetylcholinesterase model is bound to donepezil (4EY7), and the DHFR model to methotrexate (1U72). Use highlight_structure only with a matching structure name when useful. The learner can rotate/zoom the models and sends selection events on lensiq.live_class.visual_feedback; when a structure_selected event arrives, answer from that selected model/structure before broadening. Continue speaking after each visual change. Treat simulations as simplified education, never clinical decision support.',
    visualProtocol: {
      version: 2,
      dataChannelTopic: 'lensiq.live_class.visual',
      interactionTopic: 'lensiq.live_class.visual_feedback',
      approvedModelAssets: LIVE_CLASS_MODEL_ASSETS,
      approvedModelCatalog: LIVE_CLASS_MODEL_CATALOG,
      approvedMoleculeAssets: LIVE_CLASS_MOLECULE_ASSETS,
      approvedMoleculeCatalog: LIVE_CLASS_MOLECULE_CATALOG,
      commands: [
        { type: 'show_3d_model', modelUrl: 'exact HTTPS URL from approvedModelAssets', structureId: 'optional matching structure name', highlightColor: '#E8A23D' },
        { type: 'show_molecular_model', modelUrl: 'exact HTTPS URL from approvedMoleculeAssets' },
        { type: 'highlight_structure', structureId: 'structure name that matches the active GLB mesh', color: '#E8A23D' },
        { type: 'show_physiology_simulation', preset: 'cardiac_output | mean_arterial_pressure | alveolar_ventilation', title: 'current concept' },
        { type: 'show_medical_media', mediaUrl: 'URL from supplied study materials only', caption: 'short label' },
        { type: 'show_whiteboard', topic: 'current concept', markdown: 'concise mechanism, sequence, or equations with up to five main points' },
      ],
    },
  });
  try {
    const dispatchClient = new AgentDispatchClient(dispatchHost, apiKey, apiSecret);
    const agentName = process.env.LIVEKIT_AGENT_NAME?.trim() || 'lensiq-voice-tutor';
    await dispatchClient.createDispatch(roomName, agentName, { metadata: dispatchMetadata });
  } catch (dispatchError) {
    console.error('Live Class agent dispatch failed:', dispatchError);
    return NextResponse.json({ error: 'The Live Class tutor could not be dispatched. Please try again.' }, { status: 503 });
  }
  const token = new AccessToken(apiKey, apiSecret, {
    identity: user.id,
    name: user.email ?? 'LenxiQ AI learner',
    metadata: dispatchMetadata,
    ttl: isUnlimited ? '24h' : `${maxDurationSeconds}s`,
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
    expiresInSeconds: maxDurationSeconds,
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
