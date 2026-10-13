'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Participant, Room as LiveKitRoom, Track as LiveKitTrack, TranscriptionSegment } from 'livekit-client';
import PreClassSetup from '@/components/PreClassSetup';
import LiveClassVisualStage from '@/components/LiveClassVisualStage';
import type { PhysiologyPreset } from '@/components/PhysiologySimulator';
import { inferLiveClassVisual, shouldApplyTutorTranscriptVisual, getMoleculeAsset, isApprovedMedicalModelUrl, isApprovedMoleculeModelUrl, type VisualContext } from '@/lib/voice/live-class-visuals';
import type { MaterialProfile } from '@/lib/curriculum/material-profile';

type PermissionState = 'unknown' | 'granted' | 'denied';
type LiveRuntimeState = 'READY' | 'INITIALIZING' | 'SESSION_READY' | 'GREETING' | 'WAITING_FOR_TOPIC' | 'LISTENING' | 'THINKING' | 'TEACHING' | 'INTERRUPTED' | 'ANSWERING' | 'RESUMING' | 'PAUSED' | 'ENDING' | 'ENDED' | 'ERROR';
type Role = 'user' | 'assistant';
type Message = { id?: string; role: Role; content: string; created_at?: string };
type SessionSummary = { topic: string; durationSeconds: number; turns: number; recordingAvailable: boolean };
type Conversation = { id: string; course_name: string; title: string; session_type?: string; is_pinned?: boolean; created_at: string; updated_at: string };
type Quota = { isUnlimited: boolean; usedSessions: number | null; maxSessions: number | null; maxDurationSeconds: number | null; resetsAt: string | null };
type Soundscape = { id: string; label: string; description: string; src: string };
type RecordingBundle = { context: AudioContext; destination: MediaStreamAudioDestinationNode; recorder: MediaRecorder; sources: Map<string, MediaStreamAudioSourceNode>; chunks: Blob[] };
type MicMonitor = { context: AudioContext; source: MediaStreamAudioSourceNode; analyser: AnalyserNode; frame: number; sampleCount: number; lastUiLevel: number };
type AmbienceGraph = { context: AudioContext; source: MediaElementAudioSourceNode; gain: GainNode };

const SOUNDSCAPES: Soundscape[] = [
  { id: 'deep-focus', label: 'Deep Focus', description: 'Low, dark, spacious tones for sustained concentration.', src: '/audio/live-class-deep-focus.wav' },
  { id: 'warm-drift', label: 'Warm Drift', description: 'Soft rounded harmony with a gentle, cosy motion.', src: '/audio/live-class-warm-drift.wav' },
  { id: 'night-library', label: 'Night Library', description: 'Quiet, slow, grounded ambience for reflective learning.', src: '/audio/live-class-night-library.wav' },
];
const COURSES = ['Pharmacology', 'Microbiology', 'Chemical Pathology', 'Anatomical Pathology', 'Haematology / Immunology'];

function permissionHelp() {
  if (typeof navigator === 'undefined') return 'Allow microphone access in your browser, then return to LenxiQ AI.';
  if (/Android/i.test(navigator.userAgent)) return 'Open Android Settings → Apps → your browser → Permissions → Microphone → Allow, then return to LenxiQ AI.';
  if (/iPhone|iPad|iPod/i.test(navigator.userAgent)) return 'Open Settings → Safari → Microphone → Allow, then return to LenxiQ AI.';
  return 'Open the browser site settings for lenxiq.online and set Microphone to Allow.';
}

function friendlyError(error: unknown) {
  const message = error instanceof Error ? error.message : '';
  const name = typeof error === 'object' && error !== null && 'name' in error ? String((error as { name?: string }).name) : '';
  if (name === 'NotAllowedError' || /permission|not allowed/i.test(message)) return 'Microphone permission is needed for Live Class. Allow it in your phone settings, return here, and try again.';
  if (name === 'NotFoundError' || /device not found|requested device/i.test(message)) return 'No microphone was found. Check the phone microphone and browser permission, then try again.';
  if (/limit_reached/i.test(message)) return message;
  if (/Failed to fetch|signal connection|network|websocket/i.test(message)) return 'The live classroom could not reach its voice server. Check your connection and try again.';
  return message || 'The live classroom could not be started.';
}

function formatClock(seconds: number) {
  return `${Math.floor(Math.max(0, seconds) / 60)}:${String(Math.max(0, seconds) % 60).padStart(2, '0')}`;
}

const RUNTIME_COPY: Record<LiveRuntimeState, { label: string; detail: string }> = {
  READY: { label: 'Ready', detail: 'Your private study room is ready.' },
  INITIALIZING: { label: 'Opening study room', detail: 'Connecting the secure voice room…' },
  SESSION_READY: { label: 'Voice room ready', detail: 'Waiting for the microphone signal before greeting you.' },
  GREETING: { label: 'Your tutor is joining', detail: 'LenxiQ AI is preparing your spoken lesson.' },
  WAITING_FOR_TOPIC: { label: 'Your turn', detail: 'Tell LenxiQ AI what you want to understand.' },
  LISTENING: { label: 'Listening to you', detail: 'Your tutor is listening.' },
  THINKING: { label: 'Thinking', detail: 'LenxiQ AI is organising the best explanation.' },
  TEACHING: { label: 'LenxiQ is teaching', detail: 'Follow the explanation and interrupt whenever you need.' },
  INTERRUPTED: { label: 'Go ahead', detail: 'Your tutor has yielded. Finish your question.' },
  ANSWERING: { label: 'Answering', detail: 'LenxiQ AI is answering your question.' },
  RESUMING: { label: 'Continuing', detail: 'Let’s return to the lesson.' },
  PAUSED: { label: 'Paused', detail: 'Your study room is paused.' },
  ENDING: { label: 'Saving class', detail: 'Your transcript and recording are being saved.' },
  ENDED: { label: 'Class complete', detail: 'Your class is ready in History.' },
  ERROR: { label: 'Needs attention', detail: 'The live classroom needs your attention.' },
};

function Waveform({ active, level = 0 }: { active: boolean; level?: number }) {
  const intensity = Math.min(1, Math.max(0, level));
  const baseHeights = [16, 28, 42, 24, 36, 20, 32, 18, 27];
  return <div className={`flex h-10 items-center justify-center gap-1.5 ${active ? 'text-[#E8A23D]' : 'text-white/25'}`} aria-hidden="true">
    {baseHeights.map((height, index) => <span key={index} className="w-1.5 rounded-full transition-[height,opacity] duration-200" style={{ height: `${Math.max(4, height * (0.22 + intensity * 0.78))}px`, opacity: active ? 0.65 + intensity * 0.35 : 0.35 }} />)}
  </div>;
}

function VoiceTutorContent() {
  const searchParams = useSearchParams();
  const topicFocus = searchParams.get('topic')?.trim() ?? '';
  const liveClassMode = true;
  const [visualContext, setVisualContext] = useState<VisualContext>({ type: 'whiteboard', topic: topicFocus || 'Live Class' });
  const [selectedStructure, setSelectedStructure] = useState('');
  const [courseName, setCourseName] = useState(searchParams.get('course')?.trim() || 'Pharmacology');
  const [uploadedFiles, setUploadedFiles] = useState<File[]>([]);
  const [uploadedFileUrls, setUploadedFileUrls] = useState<string[]>([]);
  const [materialProfiles, setMaterialProfiles] = useState<MaterialProfile[]>([]);
  const [focusText, setFocusText] = useState('');
  const [connected, setConnected] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [status, setStatus] = useState('Your private study room is ready.');
  const [error, setError] = useState('');
  const [runtimeState, setRuntimeState] = useState<LiveRuntimeState>('READY');
  const [micLevel, setMicLevel] = useState(0);
  const [agentAudioSubscribed, setAgentAudioSubscribed] = useState(false);
  const [sessionSummary, setSessionSummary] = useState<SessionSummary | null>(null);
  const [permissionState, setPermissionState] = useState<PermissionState>('unknown');
  const [micState, setMicState] = useState<'waiting' | 'live' | 'silent' | 'error'>('waiting');
  const [audioState, setAudioState] = useState<'waiting' | 'ready' | 'playing' | 'blocked'>('waiting');
  const [tutorMuted, setTutorMuted] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [quota, setQuota] = useState<Quota | null>(null);
  const [remainingSeconds, setRemainingSeconds] = useState<number | null>(null);
  const remainingSecondsRef = useRef<number | null>(null);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [voiceActive, setVoiceActive] = useState(false);
  const [micMuted, setMicMuted] = useState(false);
  const [showTranscript, setShowTranscript] = useState(false);
  useEffect(() => {
    const handleMaterials = (event: Event) => {
      const urls = (event as CustomEvent<unknown>).detail;
      if (Array.isArray(urls)) setUploadedFileUrls(urls.filter((value): value is string => typeof value === 'string'));
    };
    window.addEventListener('lensiq:uploaded-materials', handleMaterials);
    return () => window.removeEventListener('lensiq:uploaded-materials', handleMaterials);
  }, []);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [replaying, setReplaying] = useState(false);
  const [ambienceEnabled, setAmbienceEnabled] = useState(false);
  const [ambienceOpen, setAmbienceOpen] = useState(false);
  const [ambienceId, setAmbienceId] = useState('deep-focus');
  const [ambienceNotice, setAmbienceNotice] = useState('');
  const [ambienceVolume, setAmbienceVolume] = useState(0.32);
  const [recordingDownloadUrl, setRecordingDownloadUrl] = useState<string | null>(null);
  const [recordingReady, setRecordingReady] = useState(false);
  const roomRef = useRef<LiveKitRoom | null>(null);
  const conversationIdRef = useRef<string | null>(null);
  const sessionIdRef = useRef<string | null>(null);
  const messagesRef = useRef<Message[]>([]);
  const transcriptIdsRef = useRef(new Set<string>());
  const audioContainerRef = useRef<HTMLDivElement>(null);
  const ambienceAudioRef = useRef<HTMLAudioElement>(null);
  const ambienceGraphRef = useRef<AmbienceGraph | null>(null);
  const playbackContextRef = useRef<AudioContext | null>(null);
  const micMonitorRef = useRef<MicMonitor | null>(null);
  const sessionStartedAtRef = useRef<number | null>(null);
  const elapsedSecondsRef = useRef(0);
  const runtimeStateRef = useRef<LiveRuntimeState>('READY');
  const runtimeStateBeforeReconnectRef = useRef<LiveRuntimeState>('READY');
  const tutorMutedRef = useRef(false);
  const agentAudioSubscribedRef = useRef(false);
  const recordingRef = useRef<RecordingBundle | null>(null);
  const recordingDownloadUrlRef = useRef<string | null>(null);
  const endingRef = useRef(false);
  const endSessionRef = useRef<(message?: string) => Promise<void>>(async () => undefined);
  const uploadedMaterialPathsRef = useRef<string[]>([]);
  const visualContextRef = useRef<VisualContext>(visualContext);
  const explicitVisualThisTurnRef = useRef(false);
  const visualRevisionRef = useRef(0);
  const pendingHighlightRef = useRef<{ structureId: string; color?: string } | null>(null);
  const historyRef = useRef<HTMLDivElement>(null);
  const ambience = useMemo(() => SOUNDSCAPES.find((item) => item.id === ambienceId) ?? SOUNDSCAPES[0], [ambienceId]);

  const updateVisualContext = (next: VisualContext) => {
    visualContextRef.current = next;
    visualRevisionRef.current += 1;
    setVisualContext(next);
  };

  useEffect(() => {
    const handleUploadedMaterials = (event: Event) => {
      const detail = (event as CustomEvent<{ urls?: string[]; paths?: string[]; profiles?: MaterialProfile[] } | string[]>).detail;
      setUploadedFileUrls(Array.isArray(detail) ? detail : detail?.urls ?? []);
      uploadedMaterialPathsRef.current = Array.isArray(detail) ? [] : detail?.paths ?? [];
      setMaterialProfiles(Array.isArray(detail) ? [] : detail?.profiles ?? []);
    };
    window.addEventListener('lensiq:uploaded-materials', handleUploadedMaterials);
    return () => window.removeEventListener('lensiq:uploaded-materials', handleUploadedMaterials);
  }, []);

  useEffect(() => { conversationIdRef.current = conversationId; }, [conversationId]);
  useEffect(() => { runtimeStateRef.current = runtimeState; }, [runtimeState]);
  useEffect(() => { tutorMutedRef.current = tutorMuted; }, [tutorMuted]);
  useEffect(() => { agentAudioSubscribedRef.current = agentAudioSubscribed; }, [agentAudioSubscribed]);
  useEffect(() => { sessionIdRef.current = sessionId; }, [sessionId]);
  useEffect(() => { messagesRef.current = messages; }, [messages]);
  useEffect(() => { recordingDownloadUrlRef.current = recordingDownloadUrl; }, [recordingDownloadUrl]);

  useEffect(() => {
    if (!connected || agentAudioSubscribed) return;
    const timer = window.setTimeout(() => {
      setStatus('Your room and microphone are connected, but the tutor has not published audio yet. Try enabling tutor audio; if this continues, the self-hosted Pipecat agent may need attention.');
      setError('No tutor audio has arrived yet. Your Live Class is still open; you can retry audio or end and start a new class.');
    }, 22000);
    return () => window.clearTimeout(timer);
  }, [agentAudioSubscribed, connected]);

  const loadHistory = useCallback(async () => {
    const response = await fetch('/api/teaching/conversations?sessionType=live_class');
    if (!response.ok) return;
    const data = await response.json();
    setConversations(data.conversations ?? []);
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void fetch('/api/teaching/conversations?sessionType=live_class').then((response) => response.ok ? response.json() : null).then((data) => { if (data) setConversations(data.conversations ?? []); });
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!historyOpen) return;
    const outside = (event: PointerEvent) => { if (historyRef.current && !historyRef.current.contains(event.target as Node)) setHistoryOpen(false); };
    const escape = (event: KeyboardEvent) => { if (event.key === 'Escape') setHistoryOpen(false); };
    document.addEventListener('pointerdown', outside);
    document.addEventListener('keydown', escape);
    return () => { document.removeEventListener('pointerdown', outside); document.removeEventListener('keydown', escape); };
  }, [historyOpen]);

  useEffect(() => {
    if (!connected || !sessionId) return;
    const heartbeat = window.setInterval(() => {
      void fetch('/api/voice/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId, action: 'heartbeat', durationSeconds: elapsedSecondsRef.current }),
      }).then(async (response) => {
        const data = await response.json().catch(() => ({}));
        if (typeof data.remainingVoiceMinutes === 'number') {
          const remaining = Math.max(0, data.remainingVoiceMinutes * 60 - (elapsedSecondsRef.current % 60));
          remainingSecondsRef.current = remaining;
          setRemainingSeconds(remaining);
        }
        if (data.shouldEnd && !endingRef.current) void endSessionRef.current(data.message || 'Your Live Class allowance has ended.');
      }).catch(() => undefined);
    }, 30000);
    return () => window.clearInterval(heartbeat);
  }, [connected, sessionId]);

  useEffect(() => {
    if (!connected) return;
    const timer = window.setInterval(() => {
      if (sessionStartedAtRef.current) {
        elapsedSecondsRef.current += 1;
        setElapsedSeconds(elapsedSecondsRef.current);
      }
    }, 1000);
    return () => window.clearInterval(timer);
  }, [connected]);

  useEffect(() => {
    if (!connected || quota?.isUnlimited || remainingSecondsRef.current === null) return;
    const timer = window.setInterval(() => {
      const next = Math.max(0, (remainingSecondsRef.current ?? 0) - 1);
      remainingSecondsRef.current = next;
      setRemainingSeconds(next);
      if (next === 0 && !endingRef.current) void endSessionRef.current('Your Live Class access time has ended. The session is saved in History.');
    }, 1000);
    return () => window.clearInterval(timer);
  }, [connected, quota?.isUnlimited]);

  const persistMessage = async (id: string, message: Message) => {
    await fetch('/api/teaching/messages', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ conversationId: id, role: message.role, content: message.content }) });
  };

  const publishVisualFeedback = (feedback: Record<string, unknown>) => {
    const room = roomRef.current;
    if (!room) return;
    const payload = new TextEncoder().encode(JSON.stringify({ version: 1, ...feedback }));
    void room.localParticipant.publishData(payload, { reliable: true, topic: 'lensiq.live_class.visual_feedback' }).catch(() => undefined);
  };

  const applyTutorTranscript = (content: string) => {
    const spokenText = content.trim();
    if (explicitVisualThisTurnRef.current) return;
    const visual = inferLiveClassVisual(spokenText, courseName);
    if (!shouldApplyTutorTranscriptVisual(spokenText, visual)) return;
    pendingHighlightRef.current = null;
    updateVisualContext(visual);
  };

  const materialBranches = Array.from(new Set(materialProfiles.flatMap((profile) => profile.detectedBranches)));
  const materialPrimaryBranch = materialProfiles.find((profile) => profile.primaryBranch)?.primaryBranch ?? null;
  const materialContext = materialProfiles.length > 0
    ? { primaryBranch: materialPrimaryBranch, branches: materialBranches, sources: materialProfiles.map((profile) => profile.sourceFileName).slice(0, 20) }
    : null;

  const createConversation = async () => {
    const title = topicFocus ? `Live Class · ${topicFocus}` : `Live Class · ${courseName}`;
    const response = await fetch('/api/teaching/conversations', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ courseName, title, sessionType: 'live_class' }) });
    if (!response.ok) throw new Error('Unable to create the Live Class history.');
    const data = await response.json();
    setConversationId(data.conversation.id);
    conversationIdRef.current = data.conversation.id;
    setConversations((previous) => [data.conversation, ...previous]);
    return data.conversation as Conversation;
  };

  const toggleHistoryPin = async (conversation: Conversation) => {
    const action = conversation.is_pinned ? 'unpin' : 'pin';
    const response = await fetch(`/api/teaching/conversations/${conversation.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action }) });
    if (!response.ok) { setError('Unable to update the pinned state.'); return; }
    const data = await response.json();
    setConversations((previous) => previous.map((item) => item.id === conversation.id ? data.conversation : item).sort((left, right) => Number(Boolean(right.is_pinned)) - Number(Boolean(left.is_pinned)) || new Date(right.updated_at).getTime() - new Date(left.updated_at).getTime()));
  };

  const deleteHistoryConversation = async (conversation: Conversation) => {
    if (!window.confirm(`Delete ${conversation.title}? Its saved transcript will leave History.`)) return;
    const response = await fetch(`/api/teaching/conversations/${conversation.id}`, { method: 'DELETE' });
    if (!response.ok) { setError('Unable to delete this Live Class history.'); return; }
    setConversations((previous) => previous.filter((item) => item.id !== conversation.id));
    if (conversationIdRef.current === conversation.id) { setConversationId(null); conversationIdRef.current = null; setMessages([]); setReplaying(false); setStatus('History item deleted. Start a new Live Class when you are ready.'); }
    setHistoryOpen(false);
  };

  const loadConversation = async (id: string) => {
    if (connected) return;
    const response = await fetch(`/api/teaching/conversations/${id}`);
    if (!response.ok) { setError('Unable to reopen this Live Class history.'); return; }
    const data = await response.json();
    setConversationId(data.conversation.id);
    conversationIdRef.current = data.conversation.id;
    setCourseName(data.conversation.course_name);
    setMessages(data.messages ?? []);
    const recordingResponse = await fetch(`/api/voice/recording?conversationId=${encodeURIComponent(id)}`);
    const recordingData = recordingResponse.ok ? await recordingResponse.json().catch(() => ({})) : {};
    if (recordingData.recording?.signedUrl) { setRecordingDownloadUrl(recordingData.recording.signedUrl); setRecordingReady(true); } else { setRecordingDownloadUrl(null); setRecordingReady(false); }
    setReplaying(true);
    setHistoryOpen(false);
    setStatus('Saved class replay. Start a new room when you want to continue aloud.');
  };

  const addRecordingTrack = (track: LiveKitTrack) => {
    const bundle = recordingRef.current;
    if (!bundle || track.kind !== 'audio') return;
    const mediaTrack = track.mediaStreamTrack;
    if (bundle.sources.has(mediaTrack.id)) return;
    const source = bundle.context.createMediaStreamSource(new MediaStream([mediaTrack]));
    source.connect(bundle.destination);
    bundle.sources.set(mediaTrack.id, source);
  };

  const startRecording = async (localTrack: LiveKitTrack | undefined) => {
    if (typeof MediaRecorder === 'undefined' || recordingRef.current) return;
    const AudioContextConstructor = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextConstructor) return;
    const context = new AudioContextConstructor();
    await context.resume();
    const destination = context.createMediaStreamDestination();
    const mimeType = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4'].find((candidate) => MediaRecorder.isTypeSupported(candidate));
    const recorder = new MediaRecorder(destination.stream, mimeType ? { mimeType } : undefined);
    const bundle: RecordingBundle = { context, destination, recorder, sources: new Map(), chunks: [] };
    recorder.ondataavailable = (event) => { if (event.data.size) bundle.chunks.push(event.data); };
    recordingRef.current = bundle;
    if (localTrack) addRecordingTrack(localTrack);
    roomRef.current?.remoteParticipants.forEach((participant) => participant.audioTrackPublications.forEach((publication) => {
      if (publication.track) addRecordingTrack(publication.track);
    }));
    recorder.start(1000);
  };

  const stopRecording = useCallback(async (): Promise<Blob | null> => {
    const bundle = recordingRef.current;
    if (!bundle) return null;
    recordingRef.current = null;
    await new Promise<void>((resolve) => {
      if (bundle.recorder.state === 'inactive') { resolve(); return; }
      bundle.recorder.addEventListener('stop', () => resolve(), { once: true });
      bundle.recorder.stop();
    });
    bundle.sources.forEach((source) => source.disconnect());
    await bundle.context.close().catch(() => undefined);
    const blob = new Blob(bundle.chunks, { type: bundle.recorder.mimeType || 'audio/webm' });
    if (blob.size) {
      if (recordingDownloadUrlRef.current) URL.revokeObjectURL(recordingDownloadUrlRef.current);
      setRecordingDownloadUrl(URL.createObjectURL(blob));
      setRecordingReady(true);
      return blob;
    }
    return null;
  }, []);

  const stopMicMonitor = () => {
    const monitor = micMonitorRef.current;
    if (!monitor) return;
    cancelAnimationFrame(monitor.frame);
    monitor.source.disconnect();
    void monitor.context.close().catch(() => undefined);
    micMonitorRef.current = null;
    setMicLevel(0);
  };

  useEffect(() => () => {
    roomRef.current?.disconnect();
    stopMicMonitor();
    ambienceAudioRef.current?.pause();
    void ambienceGraphRef.current?.context.close().catch(() => undefined);
    ambienceGraphRef.current = null;
    void playbackContextRef.current?.close().catch(() => undefined);
    if (recordingDownloadUrl) URL.revokeObjectURL(recordingDownloadUrl);
  }, [recordingDownloadUrl]);

  useEffect(() => {
    const gain = ambienceGraphRef.current?.gain;
    if (gain) gain.gain.setTargetAtTime(ambienceEnabled ? ambienceVolume * (voiceActive ? 0.42 : 1) : 0, gain.context.currentTime, 0.08);
  }, [ambienceEnabled, ambienceVolume, voiceActive]);

  const startMicMonitor = async (track: MediaStreamTrack) => {
    stopMicMonitor();
    const AudioContextConstructor = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextConstructor) return;
    const context = new AudioContextConstructor();
    await context.resume();
    const source = context.createMediaStreamSource(new MediaStream([track]));
    const analyser = context.createAnalyser();
    analyser.fftSize = 512;
    source.connect(analyser);
    const data = new Uint8Array(analyser.fftSize);
    const monitor: MicMonitor = { context, source, analyser, frame: 0, sampleCount: 0, lastUiLevel: 0 };
    micMonitorRef.current = monitor;
    clientStage('MIC_SIGNAL_MONITOR_STARTED', { trackId: track.id, contextState: context.state });
    const sample = () => {
      if (micMonitorRef.current !== monitor) return;
      analyser.getByteTimeDomainData(data);
      let sum = 0;
      for (const value of data) { const centered = (value - 128) / 128; sum += centered * centered; }
      const rms = Math.sqrt(sum / data.length);
      const level = Math.min(1, rms * 5);
      monitor.sampleCount += 1;
      if (monitor.sampleCount % 6 === 0 && Math.abs(level - monitor.lastUiLevel) > 0.025) {
        monitor.lastUiLevel = level;
        setMicLevel(level);
      }
      monitor.frame = requestAnimationFrame(sample);
    };
    sample();
  };

  const unlockPlaybackAudio = async () => {
    const AudioContextConstructor = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextConstructor) return null;
    const context = playbackContextRef.current ?? new AudioContextConstructor();
    playbackContextRef.current = context;
    if (context.state === 'suspended') await context.resume();
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    gain.gain.value = 0;
    oscillator.connect(gain).connect(context.destination);
    oscillator.start();
    oscillator.stop(context.currentTime + 0.01);
    return context;
  };

  const startTutorPcmProbe = (track: LiveKitTrack) => {
    const mediaTrack = track.mediaStreamTrack;
    type BrowserAudioFrame = { numberOfFrames: number; numberOfChannels: number; copyTo: (destination: Float32Array, options: { planeIndex: number }) => void; close: () => void };
    type BrowserTrackProcessor = new (options: { track: MediaStreamTrack }) => { readable: ReadableStream<BrowserAudioFrame> };
    const Processor = (window as unknown as { MediaStreamTrackProcessor?: BrowserTrackProcessor }).MediaStreamTrackProcessor;
    if (track.kind !== 'audio' || !mediaTrack || !Processor || (window as typeof window & { __lensiqRemotePcmProbeStarted?: boolean }).__lensiqRemotePcmProbeStarted) return;
    Object.defineProperty(window, '__lensiqRemotePcmProbeStarted', { configurable: true, value: true });
    const clone = mediaTrack.clone();
    const processor = new Processor({ track: clone });
    const reader = processor.readable.getReader();
    let windows = 0;
    let sumRms = 0;
    let maxRms = 0;
    Object.defineProperty(window, '__lensiqRemotePcmProbe', { configurable: true, value: { windows, maxRms, avgRms: 0, nonSilent: false, status: 'running' } });
    void (async () => {
      const started = performance.now();
      try {
        while (performance.now() - started < 7000 && windows < 350) {
          const result = await reader.read();
          if (result.done) break;
          const frame = result.value;
          const buffer = new Float32Array(frame.numberOfFrames * frame.numberOfChannels);
          frame.copyTo(buffer, { planeIndex: 0 });
          let sumSquares = 0;
          for (const sample of buffer) sumSquares += sample * sample;
          const rms = Math.sqrt(sumSquares / Math.max(1, buffer.length));
          windows += 1;
          sumRms += rms;
          maxRms = Math.max(maxRms, rms);
          Object.defineProperty(window, '__lensiqRemotePcmProbe', { configurable: true, value: { windows, maxRms, avgRms: sumRms / windows, nonSilent: maxRms > 0.001, status: 'running' } });
          frame.close();
        }
      } finally {
        await reader.cancel().catch(() => undefined);
        clone.stop();
        Object.defineProperty(window, '__lensiqRemotePcmProbe', { configurable: true, value: { windows, maxRms, avgRms: windows ? sumRms / windows : 0, nonSilent: maxRms > 0.001, status: 'complete' } });
      }
    })();
  };

  const attachAudioTrack = (track: LiveKitTrack) => {
    if (track.kind !== 'audio') return;
    startTutorPcmProbe(track);
    addRecordingTrack(track);
    const element = track.attach();
    clientStage('AGENT_AUDIO_TRACK_SUBSCRIBED', { trackId: track.sid ?? track.mediaStreamTrack.id, elementKind: element.tagName });
    element.autoplay = true;
    element.muted = tutorMutedRef.current;
    element.volume = tutorMutedRef.current ? 0 : 1;
    if ('setVolume' in track && typeof track.setVolume === 'function') track.setVolume(tutorMutedRef.current ? 0 : 1);
    element.setAttribute('playsinline', 'true');
    element.setAttribute('aria-hidden', 'true');
    audioContainerRef.current?.appendChild(element);
    void element.play().then(() => {
      element.muted = tutorMutedRef.current;
      element.volume = tutorMutedRef.current ? 0 : 1;
      clientStage('AGENT_AUDIO_PLAYBACK_STARTED');
      setError('');
      setAudioState(tutorMutedRef.current ? 'ready' : 'playing');
    }).catch((playbackError) => { clientStage('AGENT_AUDIO_PLAYBACK_BLOCKED', { error: String(playbackError) }); setAudioState('blocked'); setRuntimeState('ERROR'); setStatus('Your tutor audio is not connected yet. Tap Enable tutor audio to reconnect it.'); });
  };

  const requestMicrophone = async (): Promise<MediaStreamTrack | null> => {
    try {
      if (!navigator.mediaDevices?.getUserMedia) throw new Error('This browser does not provide microphone access.');
      const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true }, video: false });
      const track = stream.getAudioTracks()[0];
      if (!track) throw new Error('No microphone track was returned by the phone.');
      setPermissionState('granted');
      clientStage('MIC_PERMISSION_GRANTED');
      clientStage('MIC_TRACK_CREATED', { trackId: track.id, enabled: track.enabled, readyState: track.readyState });
      return track;
    } catch (permissionError) {
      setPermissionState('denied');
      setError(friendlyError(permissionError));
      return null;
    }
  };

  const playAmbience = async (selected: Soundscape = ambience) => {
    const audio = ambienceAudioRef.current;
    if (!audio) return;
    audio.pause();
    audio.src = selected.src;
    audio.volume = 1;
    audio.muted = false;
    const AudioContextConstructor = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextConstructor) throw new Error('This browser does not provide a Web Audio output.');
    const ambienceGraph = ambienceGraphRef.current ?? (() => {
      const context = new AudioContextConstructor();
      const source = context.createMediaElementSource(audio);
      const gain = context.createGain();
      source.connect(gain).connect(context.destination);
      const graph = { context, source, gain };
      ambienceGraphRef.current = graph;
      return graph;
    })();
    await ambienceGraph.context.resume();
    ambienceGraph.gain.gain.setTargetAtTime(ambienceVolume, ambienceGraph.context.currentTime, 0.04);
    await audio.play();
    setAmbienceEnabled(true);
    clientStage('AMBIENCE_PLAYBACK_STARTED', { soundscape: selected.id, volume: ambienceVolume });
    setAmbienceNotice(`${selected.label} is on at a gentle volume. It automatically ducks while LenxiQ AI speaks.`);
  };

  const toggleAmbience = async () => {
    const audio = ambienceAudioRef.current;
    if (!audio) return;
    if (ambienceEnabled) {
      audio.pause();
      setAmbienceEnabled(false);
      setAmbienceNotice('Ambience is off.');
      return;
    }
    try { await playAmbience(); } catch (ambienceError) { clientStage('AMBIENCE_PLAYBACK_BLOCKED', { error: String(ambienceError) }); setAmbienceNotice('Ambience could not start. Tap again, then raise phone media volume and check Bluetooth output.'); }
  };

  const selectAmbience = async (id: string) => {
    const selected = SOUNDSCAPES.find((item) => item.id === id) ?? SOUNDSCAPES[0];
    setAmbienceId(selected.id);
    setAmbienceOpen(false);
    try { await playAmbience(selected); } catch { setAmbienceNotice('Tap Ambience again to enable this sound.'); }
  };

  const endSession = useCallback(async (message = 'Live Class ended. Your spoken lesson is saved in History.') => {
    if (endingRef.current) return;
    endingRef.current = true;
    setRuntimeState('ENDING');
    const activeSessionId = sessionIdRef.current;
    const activeConversationId = conversationIdRef.current;
    const durationSeconds = sessionStartedAtRef.current ? Math.max(1, elapsedSecondsRef.current) : 0;
    stopMicMonitor();
    roomRef.current?.disconnect();
    roomRef.current = null;
    const recordingBlob = await stopRecording();
    if (activeConversationId && recordingBlob) {
      const formData = new FormData();
      formData.append('conversationId', activeConversationId);
      formData.append('file', new File([recordingBlob], 'lenxiq-live-class.webm', { type: recordingBlob.type || 'audio/webm' }));
      await fetch('/api/voice/recording', { method: 'POST', body: formData }).catch(() => undefined);
    }
    if (uploadedMaterialPathsRef.current.length > 0) {
      const paths = uploadedMaterialPathsRef.current;
      uploadedMaterialPathsRef.current = [];
      try {
        const { createClient } = await import('@/lib/supabase/client');
        await createClient().storage.from('ephemeral_class_materials').remove(paths);
      } catch (cleanupError) {
        console.warn('Ephemeral Live Class material cleanup failed:', cleanupError);
      }
    }
    setUploadedFileUrls([]);
    window.dispatchEvent(new CustomEvent('lensiq:clear-uploaded-materials'));
    setSessionSummary({ topic: topicFocus || courseName, durationSeconds, turns: messagesRef.current.filter((item) => item.role === 'user').length, recordingAvailable: Boolean(recordingBlob?.size) });
    sessionStartedAtRef.current = null;
    ambienceAudioRef.current?.pause();
    setAmbienceEnabled(false);
    setConnected(false);
    setVoiceActive(false);
    setSessionId(null);
    sessionIdRef.current = null;
    remainingSecondsRef.current = null;
    setRemainingSeconds(null);
    setRuntimeState('ENDED');
    setStatus(message);
    setAgentAudioSubscribed(false);
    if (activeSessionId) await fetch('/api/voice/session', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ sessionId: activeSessionId, action: 'end' }) }).catch(() => undefined);
    await fetch('/api/voice/materials', { method: 'DELETE' }).catch(() => undefined);
    await loadHistory().catch(() => undefined);
    endingRef.current = false;
  }, [courseName, loadHistory, stopRecording, topicFocus]);
  useEffect(() => {
    endSessionRef.current = endSession;
  }, [endSession]);

  const startSession = async () => {
    if (connecting || connected) return;
    setConnecting(true);
    setError('');
    setSessionSummary(null);
    updateVisualContext({ type: 'whiteboard', topic: topicFocus || courseName, ...(focusText.trim() ? { markdown: `### Study focus\n\n${focusText.trim()}` } : {}) });
    setSelectedStructure('');
    explicitVisualThisTurnRef.current = false;
    pendingHighlightRef.current = null;
    elapsedSecondsRef.current = 0;
    setElapsedSeconds(0);
    setRuntimeState('INITIALIZING');
    setRecordingReady(false);
    setRecordingDownloadUrl(null);
    setStatus('Opening your private live classroom…');
    await unlockPlaybackAudio().catch(() => undefined);
    let livekit: typeof import('livekit-client');
    try {
      livekit = await import('livekit-client');
    } catch {
      setError('The voice classroom could not be loaded. Refresh the page and try again.');
      setRuntimeState('ERROR');
      setConnecting(false);
      return;
    }
    const { Room, RoomEvent, Track } = livekit;
    const room = new Room({
      adaptiveStream: true,
      dynacast: true,
      webAudioMix: false,
    });
    Object.defineProperty(window, '__lensiqLiveRoom', { configurable: true, value: room });
    const microphoneTrack = await requestMicrophone();
    if (!microphoneTrack) { room.disconnect(); setRuntimeState('ERROR'); setConnecting(false); return; }
    let activeConversation: Conversation | null = null;
    try {
      await startMicMonitor(microphoneTrack).catch(() => undefined);
      setStatus('Preparing your visual medical workspace…');
      activeConversation = await createConversation();
      const tokenResponse = await fetch('/api/voice/token', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ courseName, topicFocus, focusText, conversationId: activeConversation.id, fileUrls: uploadedFileUrls, materialContext }) });
      const tokenData = await tokenResponse.json().catch(() => ({}));
      if (!tokenResponse.ok) throw new Error(tokenData.message || tokenData.error || 'Unable to create a secure Live Class session.');
      setSessionId(tokenData.sessionId);
      sessionIdRef.current = tokenData.sessionId;
      const conversation = activeConversation;
      if (!conversation) throw new Error('Unable to create Live Class history.');
      const linkResponse = await fetch('/api/voice/session', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ sessionId: tokenData.sessionId, action: 'link', conversationId: activeConversation.id }) });
      if (!linkResponse.ok) throw new Error('Unable to save this Live Class history.');
      setQuota(tokenData.quota ?? null);
      const initialRemainingSeconds = tokenData.quota?.isUnlimited ? null : Math.max(0, Number(tokenData.quota?.maxDurationSeconds ?? 1800));
      remainingSecondsRef.current = initialRemainingSeconds;
      setRemainingSeconds(initialRemainingSeconds);
      setMessages([]);
      messagesRef.current = [];
      transcriptIdsRef.current.clear();
      setReplaying(false);
      room.on(RoomEvent.TrackSubscribed, (track) => { agentAudioSubscribedRef.current = true; setAgentAudioSubscribed(true); attachAudioTrack(track); });
      room.on(RoomEvent.TrackUnsubscribed, (track) => { track.detach(); agentAudioSubscribedRef.current = false; setAgentAudioSubscribed(false); setAudioState('waiting'); });
      room.on(RoomEvent.LocalTrackPublished, (publication) => { if (publication.source === Track.Source.Microphone) { setMicState('live'); clientStage('MIC_TRACK_PUBLISHED_EVENT'); setStatus('Microphone ready. Speak naturally; the tutor will yield when you interrupt.'); } });
      room.on(RoomEvent.LocalAudioSilenceDetected, () => { setMicState('silent'); clientStage('MIC_INPUT_SILENCE_DETECTED'); });
      room.on(RoomEvent.MediaDevicesError, (mediaError) => { setMicState('error'); setError(friendlyError(mediaError)); });
      room.on(RoomEvent.AudioPlaybackStatusChanged, (playing: boolean) => { if (agentAudioSubscribedRef.current) setAudioState(playing && !tutorMutedRef.current ? 'playing' : 'blocked'); });
      room.on(RoomEvent.Reconnecting, () => { runtimeStateBeforeReconnectRef.current = runtimeStateRef.current; setRuntimeState('PAUSED'); setStatus('Connection interrupted. Reconnecting your study room…'); });
      room.on(RoomEvent.Reconnected, () => {
        const nextState = runtimeStateBeforeReconnectRef.current === 'PAUSED' ? 'LISTENING' : runtimeStateBeforeReconnectRef.current;
        const restoredVisual = visualContextRef.current;
        setVisualContext({ ...restoredVisual });
        setRuntimeState(nextState);
        setStatus(nextState === 'TEACHING' ? 'Study room reconnected. LenxiQ AI can continue your lesson.' : 'Study room reconnected. Your lesson visual is synchronized.');
        clientStage('LIVEKIT_VISUAL_STATE_RESYNCED', { revision: visualRevisionRef.current, type: restoredVisual.type });
        void room.startAudio().catch(() => undefined);
        for (const participant of room.remoteParticipants.values()) {
          for (const publication of participant.trackPublications.values()) {
            if (publication.track?.kind === 'audio') {
              agentAudioSubscribedRef.current = true;
              setAgentAudioSubscribed(true);
              attachAudioTrack(publication.track);
            }
          }
        }
      });
      room.on(RoomEvent.DataReceived, (payload, _participant, _kind, topic) => {
        try {
          const data = JSON.parse(new TextDecoder().decode(payload)) as { type?: string; state?: LiveRuntimeState | 'TTS_AUDIO_FRAME' | 'TTS_AUDIO_SUMMARY'; role?: Role; content?: string; id?: string | null; source?: string; modelUrl?: string; structureId?: string; color?: string; mediaUrl?: string; imageUrl?: string; bucket?: string; path?: string; alt?: string; topic?: string; title?: string; markdown?: string; cardId?: string; preset?: PhysiologyPreset; caption?: string; rms?: number; maxAbs?: number; nonSilent?: boolean; providerFrames?: number; providerSamples?: number; providerMaxAbs?: number; providerNonSilent?: boolean; sinkFrames?: number; sinkSamples?: number; sinkMaxAbs?: number; sinkNonSilent?: boolean };
          if (data.type === 'show_3d_model' && data.modelUrl && isApprovedMedicalModelUrl(data.modelUrl)) {
            explicitVisualThisTurnRef.current = true;
            const pendingHighlight = pendingHighlightRef.current;
            pendingHighlightRef.current = null;
            setSelectedStructure(pendingHighlight?.structureId ?? '');
            updateVisualContext({ type: 'model', modelUrl: data.modelUrl, ...(pendingHighlight ? { structureId: pendingHighlight.structureId, highlightColor: pendingHighlight.color } : {}) });
            return;
          }
          if (data.type === 'show_molecular_model' && data.modelUrl && isApprovedMoleculeModelUrl(data.modelUrl)) {
            const molecule = getMoleculeAsset(data.modelUrl);
            if (!molecule) return;
            explicitVisualThisTurnRef.current = true;
            pendingHighlightRef.current = null;
            setSelectedStructure('');
            updateVisualContext({ type: 'molecule', ...molecule });
            return;
          }
          if (data.type === 'highlight_structure' && data.structureId) {
            explicitVisualThisTurnRef.current = true;
            setSelectedStructure(data.structureId);
            const current = visualContextRef.current;
            if (current.type === 'model') updateVisualContext({ ...current, structureId: data.structureId, highlightColor: data.color });
            else pendingHighlightRef.current = { structureId: data.structureId, color: data.color };
            return;
          }
          if (data.type === 'show_physiology_simulation' && data.preset && ['cardiac_output', 'mean_arterial_pressure', 'alveolar_ventilation'].includes(data.preset)) {
            explicitVisualThisTurnRef.current = true;
            pendingHighlightRef.current = null;
            setSelectedStructure('');
            updateVisualContext({ type: 'simulation', preset: data.preset, title: data.title || courseName });
            return;
          }
          if (data.type === 'show_medical_media' || data.type === 'show_supabase_image') {
            explicitVisualThisTurnRef.current = true;
            pendingHighlightRef.current = null;
            const mediaUrl = data.mediaUrl || data.imageUrl;
            if (mediaUrl) updateVisualContext({ type: 'media', mediaUrl, caption: data.caption || data.alt || data.title });
            else if (data.bucket && data.path) {
              const bucket = data.bucket;
              const path = data.path;
              void (async () => {
                try {
                  if (!/^[a-z0-9_-]{1,64}$/i.test(bucket) || path.split('/').includes('..')) return;
                  const { createClient } = await import('@/lib/supabase/client');
                  const storage = createClient().storage.from(bucket);
                  const { data: signedData } = await storage.createSignedUrl(path, 60 * 60);
                  const resolvedUrl = signedData?.signedUrl || storage.getPublicUrl(path).data.publicUrl;
                  if (resolvedUrl) updateVisualContext({ type: 'media', mediaUrl: resolvedUrl, caption: data.caption || data.alt || data.title });
                } catch { /* An unavailable medical image must not interrupt the voice session. */ }
              })();
            }
            return;
          }
          if (data.type === 'show_concept_card' || data.type === 'show_whiteboard') {
            const boardText = [data.title, data.topic, data.markdown].filter(Boolean).join(' ');
            if (!boardText || !shouldApplyTutorTranscriptVisual(boardText, { type: 'whiteboard', topic: data.title || data.topic || courseName, markdown: data.markdown })) return;
            explicitVisualThisTurnRef.current = true;
            pendingHighlightRef.current = null;
            setSelectedStructure('');
            updateVisualContext({ type: 'whiteboard', topic: data.title || data.topic || courseName, markdown: data.markdown });
            return;
          }
          if (topic === 'lensiq.live_class.state') {
            if (data.type !== 'live_class_state' || !data.state) return;
            if (data.state === 'TTS_AUDIO_FRAME' || data.state === 'TTS_AUDIO_SUMMARY') {
              (window as typeof window & { __lensiqAgentTtsPcm?: Record<string, unknown> }).__lensiqAgentTtsPcm = { ...data };
              clientStage(data.state === 'TTS_AUDIO_FRAME' ? 'AGENT_TTS_PCM_MEASURED' : 'AGENT_TTS_PCM_SUMMARY', { ...data });
              return;
            }
            if (!(data.state in RUNTIME_COPY)) return;
            setRuntimeState(data.state);
            setStatus(RUNTIME_COPY[data.state].detail);
            return;
          }
          if (topic !== 'lensiq.live_class.transcript' || data.type !== 'live_class_transcript' || !data.role || !data.content?.trim()) return;
          const content = data.content.trim();
          const key = `content:${data.role}:${content.toLowerCase()}`;
          if (transcriptIdsRef.current.has(key)) return;
          transcriptIdsRef.current.add(key);
          const message: Message = { id: data.id ?? undefined, role: data.role, content };
          if (data.role === 'assistant') applyTutorTranscript(content);
          else explicitVisualThisTurnRef.current = false;
          setMessages((previous) => [...previous, message]);
          messagesRef.current = [...messagesRef.current, message];
          void persistMessage(conversation.id, message);
          setStatus(data.role === 'user' ? 'LenxiQ AI is following your question…' : 'LenxiQ AI is teaching…');
        } catch { /* Ignore malformed diagnostic packets. */ }
      });
      room.on(RoomEvent.ActiveSpeakersChanged, (speakers) => setVoiceActive(speakers.some((speaker) => !speaker.isLocal)));
      room.on(RoomEvent.TranscriptionReceived, (segments: TranscriptionSegment[], participant?: Participant) => {
        for (const segment of segments) {
          if (!segment.final || !segment.text.trim()) continue;
          const message: Message = { role: participant?.isLocal ? 'user' : 'assistant', content: segment.text.trim() };
          if (message.role === 'assistant') applyTutorTranscript(message.content);
          else explicitVisualThisTurnRef.current = false;
          const key = `content:${message.role}:${message.content.toLowerCase()}`;
          if (transcriptIdsRef.current.has(key)) continue;
          transcriptIdsRef.current.add(key);
          setMessages((previous) => [...previous, message]);
          void persistMessage(conversation.id, message);
          setStatus(participant?.isLocal ? 'LenxiQ AI is following your question…' : 'LenxiQ AI is teaching…');
        }
      });
      room.on(RoomEvent.Disconnected, () => { if (!endingRef.current) void endSession(); });
      const livekitUrl = String(tokenData.url || '').trim();
      await room.connect(livekitUrl, tokenData.token);
      clientStage('LIVEKIT_ROOM_CONNECTED', { roomName: tokenData.roomName });
      await room.startAudio().catch((playbackError) => { clientStage('AGENT_AUDIO_PLAYBACK_BLOCKED', { error: String(playbackError) }); setAudioState('blocked'); });
      for (const participant of room.remoteParticipants.values()) {
        for (const publication of participant.trackPublications.values()) {
          if (publication.track?.kind === 'audio') {
            agentAudioSubscribedRef.current = true;
            setAgentAudioSubscribed(true);
            attachAudioTrack(publication.track);
          }
        }
      }
      audioContainerRef.current?.querySelectorAll('audio').forEach((element) => {
        element.muted = tutorMutedRef.current;
        element.volume = tutorMutedRef.current ? 0 : 1;
        void element.play().catch(() => undefined);
      });
      const microphonePublication = await room.localParticipant.publishTrack(microphoneTrack, { source: Track.Source.Microphone, dtx: false, red: true });
      if (!microphonePublication?.track) throw new Error('Live Class could not publish the microphone track.');
      clientStage('MIC_TRACK_PUBLISHED', { trackId: microphonePublication.trackSid, enabled: microphoneTrack.enabled, readyState: microphoneTrack.readyState });
      setMicState('live');
      sessionStartedAtRef.current = 1;
      elapsedSecondsRef.current = 0;
      setElapsedSeconds(0);
      roomRef.current = room;
      try { await startRecording(microphonePublication.track); } catch { setAmbienceNotice('Live Class is active, but this browser cannot record the session locally.'); }
      setConnected(true);
      setMicMuted(false);
      setRuntimeState('INITIALIZING');
      setAudioState(room.canPlaybackAudio ? 'ready' : 'blocked');
      const openingMessage: Message = { role: 'assistant', content: topicFocus ? `Live Class opened for ${topicFocus}. Speak naturally; LenxiQ AI will teach aloud and you can interrupt at any time.` : `Live Class opened. Tell LenxiQ AI what you want to understand, and the tutor will teach aloud.` };
      setMessages([openingMessage]);
      messagesRef.current = [openingMessage];
      await persistMessage(conversation.id, openingMessage);
      setStatus('Your tutor is joining the room. You will hear a greeting before the lesson begins.');
      setAmbienceNotice('Ambience is off by default. Turn it on only if it helps you focus.');
    } catch (sessionError) {
      microphoneTrack.stop();
      setError(friendlyError(sessionError));
      setRuntimeState('ERROR');
      setStatus('The live classroom could not be opened.');
      roomRef.current?.disconnect();
      roomRef.current = null;
      Reflect.deleteProperty(window, '__lensiqLiveRoom');
      const activeSessionId = sessionIdRef.current;
      if (activeSessionId) await fetch('/api/voice/session', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ sessionId: activeSessionId, action: 'end' }) }).catch(() => undefined);
      if (activeConversation && !sessionStartedAtRef.current) {
        await fetch(`/api/teaching/conversations/${activeConversation.id}`, { method: 'DELETE' }).catch(() => undefined);
      }
      setSessionId(null);
      sessionIdRef.current = null;
      remainingSecondsRef.current = null;
      setRemainingSeconds(null);
      setMicState('error');
    } finally {
      setConnecting(false);
    }
  };


  const toggleTutorAudio = async () => {
    const nextMuted = !tutorMutedRef.current;
    tutorMutedRef.current = nextMuted;
    setTutorMuted(nextMuted);
    const elements = Array.from(audioContainerRef.current?.querySelectorAll('audio') ?? []);
    elements.forEach((element) => { element.muted = nextMuted; element.volume = nextMuted ? 0 : 1; });
    roomRef.current?.remoteParticipants.forEach((participant) => participant.audioTrackPublications.forEach((publication) => {
      if (publication.track && 'setVolume' in publication.track && typeof publication.track.setVolume === 'function') publication.track.setVolume(nextMuted ? 0 : 1);
    }));
    if (nextMuted) {
      setAudioState(agentAudioSubscribedRef.current ? 'ready' : 'waiting');
      setStatus('Tutor audio muted. Your microphone remains live.');
      return;
    }
    try {
      await roomRef.current?.startAudio();
      await Promise.all(elements.map((element) => element.play()));
      setAudioState(agentAudioSubscribedRef.current ? 'playing' : 'waiting');
      setStatus(agentAudioSubscribedRef.current ? 'Tutor audio is live again.' : 'Tutor audio is enabled; your tutor is joining the room.');
    } catch {
      setAudioState('blocked');
      setRuntimeState('ERROR');
      setStatus('Your tutor audio is not connected yet. Tap again after the tutor joins.');
    }
  };

  const toggleMicrophone = async () => {
    if (!roomRef.current) return;
    const enabled = !micMuted;
    await roomRef.current.localParticipant.setMicrophoneEnabled(enabled);
    setMicMuted(!enabled);
    setStatus(enabled ? 'Microphone live. Continue speaking naturally.' : 'Microphone muted. Tap again when you want to continue.');
  };

  const clientStage = (stage: string, details: Record<string, unknown> = {}) => {
    console.info(`[LenxiQ Live Class] ${stage}`, details);
  };
  const runtimeCopy = RUNTIME_COPY[runtimeState];
  const tutorAudioLive = agentAudioSubscribed && audioState === 'playing' && !tutorMuted;
  const latestMessage = messages[messages.length - 1];
  const sessionElapsed = elapsedSeconds;

  const sessionActive = connected || replaying;

  return <div data-live-class={liveClassMode ? 'true' : undefined} className={`${liveClassMode ? 'fixed inset-0 z-[60] h-[100dvh] w-full overflow-hidden bg-[#070b13] text-white' : sessionActive ? 'h-screen w-full overflow-hidden' : 'min-h-[calc(100vh-4.5rem)]'} ${liveClassMode ? '' : 'bg-[#F4F1EA] text-[#172033]'}`}>
    <header className={`${liveClassMode || sessionActive ? 'absolute left-0 right-0 top-0 z-30 border-b border-white/10 bg-[#172033]/45 text-white' : 'sticky top-[4.5rem] z-30 border-b border-[#DED9CC] bg-[#F8F6F0]/95'} px-4 py-3 backdrop-blur sm:px-6`}>
      <div className="mx-auto flex max-w-5xl items-center justify-between gap-3">
        <Link href="/teach" className={`text-xs font-black uppercase tracking-[0.14em] ${liveClassMode || sessionActive ? 'text-white/80 hover:text-white' : 'text-[#8B8578] hover:text-[#172033]'}`}>← Text Tutor</Link>
        <div className="text-center"><p className={`text-sm font-black ${liveClassMode || sessionActive ? 'text-white' : 'text-[#172033]'}`}>AI Tutor</p><p className={`text-[11px] font-bold ${liveClassMode || sessionActive ? 'text-white/65' : 'text-[#9A9386]'}`}>{courseName} · medical mastery workspace</p><span className={`mt-2 inline-flex items-center rounded-full border px-3 py-1 text-[10px] font-black uppercase tracking-[0.16em] ${liveClassMode || sessionActive ? 'border-[#E8A23D]/40 bg-[#E8A23D]/10 text-[#FFE2A8]' : 'border-slate-200 bg-white text-slate-600'}`}>Visual Live Class</span></div>
        <div ref={historyRef} className="relative"><button type="button" onClick={() => setHistoryOpen((value) => !value)} className={liveClassMode ? "rounded-xl border border-white/10 bg-[#101827]/70 px-3 py-2 text-xs font-black text-white" : "rounded-xl border border-[#D9D3C5] bg-white px-3 py-2 text-xs font-black text-[#514D45]"} aria-expanded={historyOpen}>History{conversations.length ? ` · ${conversations.length}` : ''}</button>{historyOpen && <div className={liveClassMode ? "absolute right-0 top-11 z-50 max-h-[min(72vh,38rem)] w-[min(92vw,26rem)] overflow-y-auto overscroll-contain rounded-2xl border border-white/10 bg-[#101827]/95 p-2 text-white shadow-2xl backdrop-blur-2xl" : "absolute right-0 top-11 z-50 max-h-[min(72vh,38rem)] w-[min(92vw,26rem)] overflow-y-auto overscroll-contain rounded-2xl border border-[#D9D3C5] bg-white p-2 shadow-2xl"}><div className={liveClassMode ? "sticky top-0 z-10 flex items-center justify-between bg-[#101827]/95 px-3 py-2" : "sticky top-0 z-10 flex items-center justify-between bg-white px-3 py-2"}><p className={liveClassMode ? "text-[11px] font-black uppercase tracking-[0.14em] text-white/45" : "text-[11px] font-black uppercase tracking-[0.14em] text-[#9A9386]"}>Revisit a class</p><button type="button" onClick={() => setHistoryOpen(false)} className={liveClassMode ? "text-xs font-bold text-white/60" : "text-xs font-bold text-[#8B8578]"}>Close</button></div>{conversations.length === 0 && <p className={liveClassMode ? "p-3 text-sm leading-6 text-white/55" : "p-3 text-sm leading-6 text-[#6F6A60]"}>Completed spoken classes will appear here.</p>}{conversations.map((conversation) => <div key={conversation.id} className={liveClassMode ? "flex items-center gap-2 rounded-xl px-2 py-2 hover:bg-white/[0.06]" : "flex items-center gap-2 rounded-xl px-2 py-2 hover:bg-[#F8F6F0]"}><button type="button" onClick={() => void loadConversation(conversation.id)} className="min-w-0 flex-1 text-left"><span className={liveClassMode ? "block truncate text-sm font-black text-white" : "block truncate text-sm font-black text-[#27231D]"}>{conversation.is_pinned ? '★ ' : ''}{conversation.title}</span><span className={liveClassMode ? "mt-1 block text-xs font-bold text-white/40" : "mt-1 block text-xs font-bold text-[#9A9386]"}>{new Date(conversation.updated_at).toLocaleDateString()}</span></button><button type="button" onClick={() => void toggleHistoryPin(conversation)} className="rounded-lg px-2 py-2 text-xs font-black text-[#ffd68d]" aria-label={conversation.is_pinned ? 'Unpin Live Class' : 'Pin Live Class'}>{conversation.is_pinned ? 'Unpin' : 'Pin'}</button><button type="button" onClick={() => void deleteHistoryConversation(conversation)} className="rounded-lg px-2 py-2 text-xs font-black text-rose-300" aria-label="Delete Live Class">Delete</button></div>)}</div>}</div>
      </div>
    </header>

    <main className="relative flex h-full w-full items-center justify-center px-4 pb-8 pt-20 sm:px-8">
      {(connected || replaying || liveClassMode) && <div key={(visualContext.type === 'model' || visualContext.type === 'molecule') ? visualContext.modelUrl : visualContext.type === 'media' ? visualContext.mediaUrl : visualContext.type === 'simulation' ? visualContext.preset : visualContext.topic} className={liveClassMode ? 'absolute inset-0 animate-[lab-reveal_650ms_cubic-bezier(.2,.75,.2,1)_both]' : undefined}><LiveClassVisualStage visualContext={visualContext} selectedStructure={selectedStructure} onStructureSelect={(structureId) => { setSelectedStructure(structureId); const current = visualContextRef.current; if (current.type === 'model') updateVisualContext({ ...current, structureId }); publishVisualFeedback({ type: 'structure_selected', modelUrl: current.type === 'model' ? current.modelUrl : undefined, structureId, interaction: 'touch_or_click' }); }} onConceptSelect={(concept, index) => publishVisualFeedback({ type: 'concept_selected', topic: visualContext.type === 'whiteboard' ? visualContext.topic : courseName, concept: concept.slice(0, 240), index })} /></div>}
      {!connected && !replaying ? <section className={`relative z-20 mx-auto max-h-[min(88dvh,54rem)] w-full max-w-3xl overflow-y-auto rounded-[2rem] border shadow-[0_24px_80px_rgba(0,0,0,0.42)] ${liveClassMode ? 'border-white/15 bg-[#101827]/88 text-white backdrop-blur-2xl animate-[lab-badge-in_720ms_cubic-bezier(.18,.76,.22,1)_both]' : 'border-[#DED9CC] bg-[#FBFAF7]'}`}><div className="bg-gradient-to-br from-[#1E2A3D] via-[#26364C] to-[#3A4B5B] px-6 py-10 text-center text-white sm:px-12 sm:py-14"><div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full border border-[#E8A23D]/50 bg-[#E8A23D]/10 text-2xl font-black text-[#E8A23D] shadow-[0_0_42px_rgba(232,162,61,.18)]">LQ</div><p className="mt-6 text-xs font-black uppercase tracking-[0.22em] text-[#E8A23D]">Medical mastery lab</p><h1 className="mt-3 text-3xl font-black tracking-[-0.05em] sm:text-5xl">Badge in to Live Class.</h1><p className="mx-auto mt-4 max-w-xl text-sm leading-7 text-slate-200">Bring your slides, choose a medical branch, and enter a visual study room. LenxiQ AI will stage anatomy, concept media, or a whiteboard strictly around the concept being taught.</p><Waveform active={false} /></div><div className={`space-y-6 px-6 py-8 sm:px-12 sm:py-10 ${liveClassMode ? 'bg-[#111827]/75' : ''}`}>{sessionSummary && <div className={liveClassMode ? "rounded-2xl border border-[#E8A23D]/20 bg-[#E8A23D]/[0.07] p-5" : "rounded-2xl border border-[#E8D7B7] bg-[#FFF8E9] p-5"}><p className={liveClassMode ? "text-xs font-black uppercase tracking-[0.16em] text-[#ffd68d]" : "text-xs font-black uppercase tracking-[0.16em] text-[#9A5D00]"}>Class complete</p><h2 className={liveClassMode ? "mt-2 text-2xl font-black tracking-[-0.04em] text-white" : "mt-2 text-2xl font-black tracking-[-0.04em] text-[#27231D]"}>Nice work.</h2><p className={liveClassMode ? "mt-2 text-sm leading-6 text-white/65" : "mt-2 text-sm leading-6 text-[#6E501E]"}>You spent {formatClock(sessionSummary.durationSeconds)} on {sessionSummary.topic} and asked {sessionSummary.turns} question{sessionSummary.turns === 1 ? '' : 's'}.</p>{sessionSummary.recordingAvailable && recordingDownloadUrl && <><audio controls preload="metadata" src={recordingDownloadUrl} className="mt-4 w-full" aria-label="Saved Live Class recording" /><a href={recordingDownloadUrl} download="lenxiq-live-class.webm" className="mt-3 inline-flex rounded-xl bg-[#E8A23D] px-4 py-3 text-xs font-black text-[#172033]">Download session audio</a></>}</div>}<PreClassSetup files={uploadedFiles} onFilesChange={setUploadedFiles} onMaterialProfilesChange={setMaterialProfiles} focusText={focusText} onFocusTextChange={setFocusText} /><div><label htmlFor="course" className="text-xs font-black uppercase tracking-[0.16em] text-[#FFE2A8]">Course context</label><select id="course" value={courseName} onChange={(event) => setCourseName(event.target.value)} className={liveClassMode ? "mt-2 w-full rounded-xl border border-white/12 bg-[#080D16]/75 px-4 py-3 font-semibold text-white outline-none focus:border-[#E8A23D]" : "mt-2 w-full rounded-xl border border-[#D9D3C5] bg-white px-4 py-3 font-semibold text-[#27231D] outline-none focus:border-[#E8A23D]"}>{COURSES.map((course) => <option key={course} value={course}>{course}</option>)}</select><p className="mt-2 text-xs leading-5 text-white/55">This helps the tutor prioritise your LenxiQ AI course material while enriching the lesson with broader medical knowledge.</p></div><button type="button" onClick={() => void startSession()} disabled={connecting} className="w-full rounded-xl bg-[#E8A23D] px-5 py-4 text-base font-black text-[#172033] shadow-md hover:bg-amber-500 disabled:cursor-not-allowed disabled:opacity-50">{connecting ? 'Opening your live classroom…' : 'Enter Live Class'}</button><p className="text-center text-xs font-bold text-white/60">Free: 30 Live Class minutes each month. Premium: 6 hours per billing month; administrators: unlimited.</p>{error && <div className={liveClassMode ? "rounded-xl border border-rose-300/20 bg-rose-500/[0.09] p-4 text-sm font-bold leading-6 text-rose-200" : "rounded-xl border border-red-200 bg-red-50 p-4 text-sm font-bold leading-6 text-red-800"}>{error}{error.includes('Sign in') && <Link href={`/login?next=${encodeURIComponent(liveClassMode ? '/voice?mode=class' : '/voice')}`} className="mt-3 inline-flex rounded-lg bg-[#0B1220] px-4 py-2 text-xs font-black text-white">Sign in to continue</Link>}{permissionState === 'denied' && <p className="mt-2 font-medium">{permissionHelp()}</p>}</div>}{recordingReady && recordingDownloadUrl && <div className={liveClassMode ? "mt-5 rounded-2xl border border-white/10 bg-[#101827]/80 p-4" : "mt-5 rounded-2xl border border-[#E8D7B7] bg-[#FFF8E9] p-4"}><p className={liveClassMode ? "text-sm font-black text-white" : "text-sm font-black text-[#5B3B0C]"}>Your spoken class is ready to keep.</p><p className={liveClassMode ? "mt-1 text-xs leading-5 text-white/55" : "mt-1 text-xs leading-5 text-[#6E501E]"}>Download the audio recording now. Your transcript remains available in History.</p><a href={recordingDownloadUrl} download="lenxiq-live-class.webm" className="mt-3 inline-flex rounded-xl bg-[#E8A23D] px-4 py-3 text-xs font-black text-[#172033]">Download session audio</a></div>}</div></section> : <section className={liveClassMode ? "absolute bottom-4 left-1/2 z-20 live-class-dock max-h-[34dvh] w-[calc(100%-1.25rem)] max-w-5xl -translate-x-1/2 overflow-y-auto rounded-[1.75rem] border border-white/15 bg-[#101827]/70 p-3 text-white shadow-[0_24px_90px_rgba(0,0,0,.42)] backdrop-blur-2xl sm:p-4 sm:bottom-6 sm:p-4" : "mx-auto max-w-3xl overflow-hidden rounded-[2rem] border border-[#DED9CC] bg-[#FBFAF7] shadow-[0_24px_80px_rgba(65,57,43,0.11)]"}><div className={liveClassMode ? "bg-transparent px-2 py-1 text-white sm:px-3" : "bg-gradient-to-br from-[#1E2A3D] via-[#26364C] to-[#3A4B5B] px-6 py-8 text-white sm:px-12 sm:py-10"}><div className="flex items-center justify-between gap-3"><div><p className="text-xs font-black uppercase tracking-[0.18em] text-[#E8A23D]">{replaying ? 'SAVED CLASS' : runtimeCopy.label.toUpperCase()}</p><p className="mt-2 text-sm font-bold text-slate-300">{topicFocus || courseName} · {formatClock(sessionElapsed)}</p></div>{connected && <div className="flex items-center gap-2">{quota && !quota.isUnlimited && remainingSeconds !== null && <span className="rounded-full border border-white/15 bg-white/10 px-3 py-2 text-xs font-black text-white">{formatClock(remainingSeconds)}</span>}<button type="button" onClick={() => void endSession()} className="rounded-xl bg-[#B44134] px-3 py-2 text-xs font-black text-white">End class</button></div>}</div><div className={liveClassMode ? "flex flex-wrap items-center justify-center gap-x-5 gap-y-2 px-2 py-2 text-center sm:py-3" : "py-12 text-center sm:py-16"}><div className={`mx-auto flex h-16 w-16 items-center justify-center rounded-full border-2 sm:h-20 sm:w-20 ${voiceActive ? 'border-[#E8A23D] bg-[#E8A23D]/15 shadow-[0_0_0_18px_rgba(232,162,61,0.08)]' : micLevel > 0.04 ? 'border-emerald-300/70 bg-emerald-300/10' : 'border-white/20 bg-white/5'} transition`}><div className="flex h-12 w-12 items-center justify-center rounded-full bg-[#E8A23D] p-1 text-[#172033] sm:h-14 sm:w-14"><Waveform active={voiceActive || micLevel > 0.04} level={voiceActive ? 1 : micLevel} /></div></div><h1 className="mt-2 w-full text-lg font-black tracking-[-0.04em] sm:text-xl">{replaying ? 'Your saved class' : runtimeCopy.label}</h1><p className="mx-auto mt-1 max-w-lg text-xs leading-5 text-slate-200">{status || runtimeCopy.detail}</p><div className="mx-auto mt-4 flex flex-wrap items-center justify-center gap-2 text-[11px] font-black uppercase tracking-[0.12em] text-slate-300"><span className={`rounded-full px-3 py-1.5 ${micLevel > 0.04 ? 'bg-emerald-400/20 text-emerald-200' : micState === 'silent' ? 'bg-amber-400/20 text-amber-200' : 'bg-white/10 text-slate-300'}`}>{micLevel > 0.04 ? 'Mic active' : micState === 'live' ? 'Mic ready' : micState === 'silent' ? 'Mic ready' : micState === 'error' ? 'Mic error' : 'Mic starting'}</span><span className={`rounded-full px-3 py-1.5 ${tutorAudioLive ? 'bg-emerald-400/20 text-emerald-200' : audioState === 'blocked' ? 'bg-red-400/20 text-red-200' : 'bg-white/10 text-slate-300'}`}>{tutorAudioLive ? 'Tutor audio live' : audioState === 'blocked' ? 'Tutor audio blocked' : agentAudioSubscribed ? 'Tutor audio ready' : 'Waiting for tutor audio'}</span><span className="rounded-full bg-[#E8A23D]/20 px-3 py-1.5 text-[#FFE2A8]">Class active</span></div><div className="mt-2 flex items-center justify-center gap-3"><button type="button" onClick={() => void toggleMicrophone()} disabled={!connected} className={`flex h-12 w-12 items-center justify-center rounded-full shadow-lg ${micMuted ? 'bg-white/15 text-white' : 'bg-[#E8A23D] text-[#172033]'}`} aria-label={micMuted ? 'Unmute microphone' : 'Mute microphone'}>{micMuted ? '×' : '●'}</button><span className="text-left text-xs font-bold text-slate-300">{micMuted ? 'Microphone muted' : 'Speak naturally'}<br />Interrupt whenever you need.</span></div></div><div className="flex flex-wrap items-center justify-center gap-2 border-t border-white/10 pt-3"><button type="button" onClick={() => setShowTranscript((value) => !value)} className="rounded-xl border border-white/15 bg-white/10 px-3 py-2 text-xs font-black text-white">{showTranscript ? 'Hide transcript' : 'Show live transcript'}</button><button type="button" onClick={() => void toggleTutorAudio()} className={`rounded-xl border px-3 py-2 text-xs font-black ${tutorMuted ? 'border-white/15 bg-white/10 text-white' : tutorAudioLive ? 'border-emerald-300/30 bg-emerald-300/10 text-emerald-100' : 'border-[#E8A23D]/60 bg-[#E8A23D]/15 text-[#FFE2A8]'}`}>{tutorMuted ? 'Turn tutor audio on' : tutorAudioLive ? 'Tutor audio on' : 'Enable tutor audio'}</button><div className="relative"><button type="button" onClick={() => void toggleAmbience()} className={`rounded-xl border px-3 py-2 text-xs font-black ${ambienceEnabled ? 'border-emerald-300/30 bg-emerald-300/10 text-emerald-100' : 'border-[#E8A23D]/60 bg-[#E8A23D]/15 text-[#FFE2A8]'}`}>{ambienceEnabled ? 'Ambience on · stop' : 'Turn ambience on'}</button><button type="button" onClick={() => setAmbienceOpen((value) => !value)} className="rounded-xl border border-white/15 bg-white/10 px-3 py-2 text-xs font-black text-white">Choose sound</button>{ambienceOpen && <div className="absolute bottom-11 left-1/2 z-20 w-64 -translate-x-1/2 rounded-2xl border border-white/10 bg-[#172033] p-2 text-left shadow-2xl">{SOUNDSCAPES.map((item) => <button key={item.id} type="button" onClick={() => void selectAmbience(item.id)} className={`w-full rounded-xl px-3 py-3 ${item.id === ambienceId ? 'bg-white/10' : 'hover:bg-white/5'}`}><span className="block text-xs font-black text-white">{item.label}</span><span className="mt-1 block text-[11px] leading-4 text-slate-300">{item.description}</span></button>)}<button type="button" onClick={() => void toggleAmbience()} className="mt-1 w-full rounded-xl bg-[#E8A23D] px-3 py-2 text-xs font-black text-[#172033]">{ambienceEnabled ? 'Turn ambience off' : 'Turn ambience on'}</button></div>}</div>{recordingReady && recordingDownloadUrl && <a href={recordingDownloadUrl} download="lenxiq-live-class.webm" className="rounded-xl border border-[#E8A23D]/60 bg-[#E8A23D]/15 px-3 py-2 text-xs font-black text-[#FFF2D4]">Download session audio</a>}{replaying && <button type="button" onClick={() => { setReplaying(false); setMessages([]); setStatus('Ready when you are. Say what you want to understand.'); }} className="rounded-xl border border-white/15 bg-white/10 px-3 py-2 text-xs font-black text-white">Start new class</button>}</div></div>{connected && <div className="border-t border-white/10 px-1 pt-4"><label htmlFor="ambience-volume" className="flex items-center justify-between text-xs font-black text-slate-300"><span>Ambience volume</span><span>{Math.round(ambienceVolume * 100)}%</span></label><input id="ambience-volume" type="range" min="0" max="0.42" step="0.01" value={ambienceVolume} onChange={(event) => setAmbienceVolume(Number(event.target.value))} disabled={!ambienceEnabled} className="mt-3 w-full accent-[#E8A23D]" /></div>}{ambienceNotice && connected && <p className="bg-[#FFF8E9] px-6 py-3 text-center text-xs font-bold text-[#6E501E]">{ambienceNotice} If you cannot hear it, raise phone media volume and check Bluetooth output.</p>}{showTranscript && <div className="max-h-72 space-y-3 overflow-y-auto bg-[#101827]/90 px-5 py-5 sm:px-8">{messages.length === 0 && <p className={liveClassMode ? "text-center text-sm font-bold text-white/45" : "text-center text-sm font-bold text-[#8B8578]"}>Your spoken lesson will appear here as it unfolds.</p>}{messages.map((message, index) => <div key={message.id ?? `${message.role}-${index}`} className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}><div className={`max-w-[88%] rounded-2xl px-4 py-3 text-sm leading-6 ${message.role === 'user' ? 'bg-[#1E2A3D] text-white' : 'border border-white/10 bg-white/[0.06] text-white'}`}>{message.content}</div></div>)}</div>}{!showTranscript && latestMessage && <div className={liveClassMode ? "border-t border-white/10 bg-[#101827]/80 px-6 py-4 text-center text-sm leading-6 text-white/65" : "border-t border-[#E7E2D7] bg-[#FBFAF7] px-6 py-4 text-center text-sm leading-6 text-[#6F6A60]"}><span className={liveClassMode ? "font-black text-[#ffd68d]" : "font-black text-[#9A5D00]"}>Live transcript</span> · {latestMessage.content}</div>}{error && <div className="m-5 rounded-xl border border-red-200 bg-red-50 p-4 text-sm font-bold leading-6 text-red-800">{error}</div>}</section>}
    </main>
    <audio ref={ambienceAudioRef} loop playsInline preload="auto" className="fixed bottom-0 left-0 z-0 h-px w-px opacity-0 pointer-events-none" aria-label="Live Class ambience" />
    <div ref={audioContainerRef} className="fixed bottom-0 left-0 z-0 h-px w-px overflow-visible opacity-0 pointer-events-none" aria-live="polite" />
  </div>;
}

export default function VoicePage() {
  return <Suspense fallback={<div className="min-h-screen bg-[#080d16]" />}><VoiceTutorContent /></Suspense>;
}
