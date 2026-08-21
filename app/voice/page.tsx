'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Room, RoomEvent, Track, type Participant, type TranscriptionSegment } from 'livekit-client';

type PermissionState = 'unknown' | 'granted' | 'denied';
type Role = 'user' | 'assistant';
type Message = { id?: string; role: Role; content: string; created_at?: string };
type Conversation = { id: string; course_name: string; title: string; session_type?: string; is_pinned?: boolean; created_at: string; updated_at: string };
type Quota = { isUnlimited: boolean; usedSessions: number | null; maxSessions: number | null; maxDurationSeconds: number | null; resetsAt: string | null };
type Soundscape = { id: string; label: string; description: string; src: string };
type RecordingBundle = { context: AudioContext; destination: MediaStreamAudioDestinationNode; recorder: MediaRecorder; sources: Map<string, MediaStreamAudioSourceNode>; chunks: Blob[] };

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

function Waveform({ active }: { active: boolean }) {
  return <div className={`flex h-10 items-center justify-center gap-1.5 ${active ? 'text-[#E8A23D]' : 'text-white/25'}`} aria-hidden="true">
    {[16, 28, 42, 24, 36, 20, 32, 18, 27].map((height, index) => <span key={index} className={`w-1.5 rounded-full ${active ? 'animate-pulse' : ''}`} style={{ height, animationDelay: `${index * 80}ms` }} />)}
  </div>;
}

function VoiceTutorContent() {
  const searchParams = useSearchParams();
  const topicFocus = searchParams.get('topic')?.trim() ?? '';
  const [courseName, setCourseName] = useState(searchParams.get('course')?.trim() || 'Pharmacology');
  const [connected, setConnected] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [status, setStatus] = useState('Ready when you are. Say what you want to understand and LenxiQ AI will teach it aloud.');
  const [error, setError] = useState('');
  const [permissionState, setPermissionState] = useState<PermissionState>('unknown');
  const [micState, setMicState] = useState<'waiting' | 'live' | 'silent' | 'error'>('waiting');
  const [audioState, setAudioState] = useState<'waiting' | 'playing' | 'blocked'>('waiting');
  const [messages, setMessages] = useState<Message[]>([]);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [quota, setQuota] = useState<Quota | null>(null);
  const [remainingSeconds, setRemainingSeconds] = useState<number | null>(null);
  const [voiceActive, setVoiceActive] = useState(false);
  const [micMuted, setMicMuted] = useState(false);
  const [showTranscript, setShowTranscript] = useState(false);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [replaying, setReplaying] = useState(false);
  const [ambienceEnabled, setAmbienceEnabled] = useState(false);
  const [ambienceOpen, setAmbienceOpen] = useState(false);
  const [ambienceId, setAmbienceId] = useState('deep-focus');
  const [ambienceNotice, setAmbienceNotice] = useState('');
  const [recordingDownloadUrl, setRecordingDownloadUrl] = useState<string | null>(null);
  const [recordingReady, setRecordingReady] = useState(false);
  const roomRef = useRef<Room | null>(null);
  const conversationIdRef = useRef<string | null>(null);
  const sessionIdRef = useRef<string | null>(null);
  const messagesRef = useRef<Message[]>([]);
  const transcriptIdsRef = useRef(new Set<string>());
  const audioContainerRef = useRef<HTMLDivElement>(null);
  const ambienceAudioRef = useRef<HTMLAudioElement>(null);
  const playbackContextRef = useRef<AudioContext | null>(null);
  const recordingRef = useRef<RecordingBundle | null>(null);
  const recordingDownloadUrlRef = useRef<string | null>(null);
  const endingRef = useRef(false);
  const endSessionRef = useRef<(message?: string) => Promise<void>>(async () => undefined);
  const historyRef = useRef<HTMLDivElement>(null);
  const ambience = useMemo(() => SOUNDSCAPES.find((item) => item.id === ambienceId) ?? SOUNDSCAPES[0], [ambienceId]);

  useEffect(() => { conversationIdRef.current = conversationId; }, [conversationId]);
  useEffect(() => { sessionIdRef.current = sessionId; }, [sessionId]);
  useEffect(() => { messagesRef.current = messages; }, [messages]);
  useEffect(() => { recordingDownloadUrlRef.current = recordingDownloadUrl; }, [recordingDownloadUrl]);

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
      void fetch('/api/voice/session', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ sessionId, action: 'heartbeat' }) });
    }, 30000);
    return () => window.clearInterval(heartbeat);
  }, [connected, sessionId]);

  useEffect(() => {
    if (!connected || quota?.isUnlimited || remainingSeconds === null) return;
    const timer = window.setInterval(() => {
      setRemainingSeconds((previous) => {
        const next = Math.max(0, (previous ?? 0) - 1);
        if (next === 0 && !endingRef.current) void endSessionRef.current('Your 10-minute free Live Class has ended. The session is saved in History.');
        return next;
      });
    }, 1000);
    return () => window.clearInterval(timer);
  }, [connected, quota?.isUnlimited, remainingSeconds]);

  useEffect(() => () => {
    roomRef.current?.disconnect();
    ambienceAudioRef.current?.pause();
    if (recordingDownloadUrl) URL.revokeObjectURL(recordingDownloadUrl);
  }, [recordingDownloadUrl]);

  const persistMessage = async (id: string, message: Message) => {
    await fetch('/api/teaching/messages', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ conversationId: id, role: message.role, content: message.content }) });
  };

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

  const addRecordingTrack = (track: Track) => {
    const bundle = recordingRef.current;
    if (!bundle || track.kind !== Track.Kind.Audio) return;
    const mediaTrack = track.mediaStreamTrack;
    if (bundle.sources.has(mediaTrack.id)) return;
    const source = bundle.context.createMediaStreamSource(new MediaStream([mediaTrack]));
    source.connect(bundle.destination);
    bundle.sources.set(mediaTrack.id, source);
  };

  const startRecording = async (localTrack: Track | undefined) => {
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

  const attachAudioTrack = (track: Track) => {
    if (track.kind !== Track.Kind.Audio) return;
    addRecordingTrack(track);
    const element = track.attach();
    element.autoplay = true;
    element.muted = false;
    element.setAttribute('playsinline', 'true');
    element.setAttribute('aria-hidden', 'true');
    audioContainerRef.current?.appendChild(element);
    void element.play().then(() => setAudioState('playing')).catch(() => { setAudioState('blocked'); setStatus('Tutor audio is ready. Tap the live room once to enable playback.'); });
  };

  const requestMicrophone = async (): Promise<MediaStreamTrack | null> => {
    try {
      if (!navigator.mediaDevices?.getUserMedia) throw new Error('This browser does not provide microphone access.');
      const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true }, video: false });
      const track = stream.getAudioTracks()[0];
      if (!track) throw new Error('No microphone track was returned by the phone.');
      setPermissionState('granted');
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
    audio.currentTime = 0;
    audio.volume = 0.42;
    audio.muted = false;
    audio.controls = true;
    await audio.play();
    setAmbienceEnabled(true);
    setAmbienceNotice(`${selected.label} is audible in the class. Use the native player below if your phone requires a second tap.`);
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
    try { await playAmbience(); } catch { setAmbienceNotice('Tap again to enable the class ambience, then raise phone media volume if needed.'); }
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
    const activeSessionId = sessionIdRef.current;
    const activeConversationId = conversationIdRef.current;
    roomRef.current?.disconnect();
    roomRef.current = null;
    const recordingBlob = await stopRecording();
    if (activeConversationId && recordingBlob) {
      const formData = new FormData();
      formData.append('conversationId', activeConversationId);
      formData.append('file', new File([recordingBlob], 'lenxiq-live-class.webm', { type: recordingBlob.type || 'audio/webm' }));
      await fetch('/api/voice/recording', { method: 'POST', body: formData }).catch(() => undefined);
    }
    ambienceAudioRef.current?.pause();
    setAmbienceEnabled(false);
    setConnected(false);
    setVoiceActive(false);
    setSessionId(null);
    sessionIdRef.current = null;
    setRemainingSeconds(null);
    setStatus(message);
    if (activeSessionId) await fetch('/api/voice/session', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ sessionId: activeSessionId, action: 'end' }) }).catch(() => undefined);
    await loadHistory().catch(() => undefined);
    endingRef.current = false;
  }, [loadHistory, stopRecording]);
  useEffect(() => {
    endSessionRef.current = endSession;
  }, [endSession]);

  const startSession = async () => {
    if (connecting || connected) return;
    setConnecting(true);
    setError('');
    setRecordingReady(false);
    setRecordingDownloadUrl(null);
    setStatus('Opening your private live classroom…');
    const playbackContext = await unlockPlaybackAudio().catch(() => null);
    const room = new Room({
      adaptiveStream: true,
      dynacast: true,
      webAudioMix: playbackContext ? { audioContext: playbackContext } : true,
    });
    await room.startAudio().catch(() => setAudioState('blocked'));
    const microphoneTrack = await requestMicrophone();
    if (!microphoneTrack) { room.disconnect(); setConnecting(false); return; }
    try {
      const tokenResponse = await fetch('/api/voice/token', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ courseName, topicFocus }) });
      const tokenData = await tokenResponse.json().catch(() => ({}));
      if (!tokenResponse.ok) throw new Error(tokenData.message || tokenData.error || 'Unable to create a secure live session.');
      const activeConversation = await createConversation();
      const linkResponse = await fetch('/api/voice/session', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ sessionId: tokenData.sessionId, action: 'link', conversationId: activeConversation.id }) });
      if (!linkResponse.ok) throw new Error('Unable to save this Live Class history.');
      setSessionId(tokenData.sessionId);
      sessionIdRef.current = tokenData.sessionId;
      setQuota(tokenData.quota ?? null);
      setMessages([]);
      messagesRef.current = [];
      transcriptIdsRef.current.clear();
      setReplaying(false);
      room.on(RoomEvent.TrackSubscribed, (track) => attachAudioTrack(track));
      room.on(RoomEvent.TrackUnsubscribed, (track) => track.detach());
      room.on(RoomEvent.LocalTrackPublished, (publication) => { if (publication.source === Track.Source.Microphone) { setMicState('live'); setStatus('Microphone live. Speak naturally; the tutor will yield when you interrupt.'); } });
      room.on(RoomEvent.LocalAudioSilenceDetected, () => { setMicState('silent'); setStatus('Your microphone is published but no signal is reaching LiveKit. Check the phone microphone permission and input route.'); });
      room.on(RoomEvent.MediaDevicesError, (mediaError) => { setMicState('error'); setError(friendlyError(mediaError)); });
      room.on(RoomEvent.AudioPlaybackStatusChanged, (playing: boolean) => setAudioState(playing ? 'playing' : 'blocked'));
      room.on(RoomEvent.ActiveSpeakersChanged, (speakers) => setVoiceActive(speakers.some((speaker) => !speaker.isLocal)));
      room.on(RoomEvent.TranscriptionReceived, (segments: TranscriptionSegment[], participant?: Participant) => {
        for (const segment of segments) {
          if (!segment.final || !segment.text.trim()) continue;
          const key = `${participant?.identity ?? 'unknown'}:${segment.id}`;
          if (transcriptIdsRef.current.has(key)) continue;
          transcriptIdsRef.current.add(key);
          const message: Message = { role: participant?.isLocal ? 'user' : 'assistant', content: segment.text.trim() };
          setMessages((previous) => [...previous, message]);
          void persistMessage(activeConversation.id, message);
          setStatus(participant?.isLocal ? 'LenxiQ AI is following your question…' : 'LenxiQ AI is teaching…');
        }
      });
      room.on(RoomEvent.Disconnected, () => { if (!endingRef.current) void endSession(); });
      const livekitUrl = String(tokenData.url || '').trim();
      await room.connect(livekitUrl, tokenData.token);
      await room.startAudio().catch(() => setAudioState('blocked'));
      for (const participant of room.remoteParticipants.values()) {
        for (const publication of participant.trackPublications.values()) {
          if (publication.track?.kind === Track.Kind.Audio) attachAudioTrack(publication.track);
        }
      }
      const microphonePublication = await room.localParticipant.publishTrack(microphoneTrack, { source: Track.Source.Microphone });
      if (!microphonePublication?.track) throw new Error('Live Class could not publish the microphone track.');
      setMicState('live');
      try { await startRecording(microphonePublication.track); } catch { setAmbienceNotice('Live Class is active, but this browser cannot record the session locally.'); }
      roomRef.current = room;
      setConnected(true);
      setMicMuted(false);
      setAudioState(room.canPlaybackAudio ? 'playing' : 'blocked');
      const openingMessage: Message = { role: 'assistant', content: topicFocus ? `Live Class opened for ${topicFocus}. Speak naturally; LenxiQ AI will teach aloud and you can interrupt at any time.` : `Live Class opened. Tell LenxiQ AI what you want to understand, and the tutor will teach aloud.` };
      setMessages([openingMessage]);
      messagesRef.current = [openingMessage];
      await persistMessage(activeConversation.id, openingMessage);
      setRemainingSeconds(tokenData.quota?.isUnlimited ? null : tokenData.quota?.maxDurationSeconds ?? 600);
      setStatus(topicFocus ? `LenxiQ AI is ready to teach ${topicFocus}. Speak naturally.` : 'LenxiQ AI is listening. Say a topic, question, or learning goal aloud.');
      setAmbienceNotice('Tap Test ambience speaker once to start the class sound on your phone.');
    } catch (sessionError) {
      microphoneTrack.stop();
      setError(friendlyError(sessionError));
      setStatus('The live classroom could not be opened.');
      roomRef.current?.disconnect();
      roomRef.current = null;
      const activeSessionId = sessionIdRef.current;
      if (activeSessionId) await fetch('/api/voice/session', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ sessionId: activeSessionId, action: 'end' }) }).catch(() => undefined);
      setSessionId(null);
      sessionIdRef.current = null;
      setMicState('error');
    } finally { setConnecting(false); }
  };

  const resumeTutorAudio = async () => {
    const room = roomRef.current;
    if (!room) return;
    try {
      await room.startAudio();
      audioContainerRef.current?.querySelectorAll('audio').forEach((element) => { element.muted = false; void element.play(); });
      setAudioState('playing');
      setStatus('Tutor audio is live. Speak naturally whenever you are ready.');
    } catch {
      setAudioState('blocked');
      setStatus('The phone has blocked tutor audio. Raise media volume and tap this control again.');
    }
  };

  const toggleMicrophone = async () => {
    if (!roomRef.current) return;
    const enabled = !micMuted;
    await roomRef.current.localParticipant.setMicrophoneEnabled(enabled);
    setMicMuted(!enabled);
    setStatus(enabled ? 'Microphone live. Continue speaking naturally.' : 'Microphone muted. Tap again when you want to continue.');
  };

  const liveLabel = replaying ? 'Saved session' : connected ? voiceActive ? 'Tutor speaking' : 'Listening for you' : 'Live Class';
  const latestMessage = messages[messages.length - 1];

  return <div className="min-h-[calc(100vh-4.5rem)] bg-[#F4F1EA] text-[#172033]">
    <header className="sticky top-[4.5rem] z-30 border-b border-[#DED9CC] bg-[#F8F6F0]/95 px-4 py-3 backdrop-blur sm:px-6">
      <div className="mx-auto flex max-w-5xl items-center justify-between gap-3">
        <Link href="/teach" className="text-xs font-black uppercase tracking-[0.14em] text-[#8B8578] hover:text-[#172033]">← Teaching Room</Link>
        <div className="text-center"><p className="text-sm font-black text-[#172033]">LenxiQ AI Live Class</p><p className="text-[11px] font-bold text-[#9A9386]">{courseName} · spoken learning</p></div>
        <div ref={historyRef} className="relative"><button type="button" onClick={() => setHistoryOpen((value) => !value)} className="rounded-xl border border-[#D9D3C5] bg-white px-3 py-2 text-xs font-black text-[#514D45]" aria-expanded={historyOpen}>History{conversations.length ? ` · ${conversations.length}` : ''}</button>{historyOpen && <div className="absolute right-0 top-11 z-50 w-[min(88vw,22rem)] overflow-hidden rounded-2xl border border-[#D9D3C5] bg-white p-2 shadow-2xl"><div className="flex items-center justify-between px-3 py-2"><p className="text-[11px] font-black uppercase tracking-[0.14em] text-[#9A9386]">Revisit a class</p><button type="button" onClick={() => setHistoryOpen(false)} className="text-xs font-bold text-[#8B8578]">Close</button></div>{conversations.length === 0 && <p className="p-3 text-sm leading-6 text-[#6F6A60]">Completed spoken classes will appear here.</p>}{conversations.slice(0, 12).map((conversation) => <div key={conversation.id} className="flex items-center gap-2 rounded-xl px-2 py-2 hover:bg-[#F8F6F0]"><button type="button" onClick={() => void loadConversation(conversation.id)} className="min-w-0 flex-1 text-left"><span className="block truncate text-sm font-black text-[#27231D]">{conversation.is_pinned ? '★ ' : ''}{conversation.title}</span><span className="mt-1 block text-xs font-bold text-[#9A9386]">{new Date(conversation.updated_at).toLocaleDateString()}</span></button><button type="button" onClick={() => void toggleHistoryPin(conversation)} className="rounded-lg px-2 py-2 text-xs font-black text-[#9A5D00]" aria-label={conversation.is_pinned ? 'Unpin Live Class' : 'Pin Live Class'}>{conversation.is_pinned ? 'Unpin' : 'Pin'}</button><button type="button" onClick={() => void deleteHistoryConversation(conversation)} className="rounded-lg px-2 py-2 text-xs font-black text-[#B44134]" aria-label="Delete Live Class">Delete</button></div>)}</div>}</div>
      </div>
    </header>

    <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:py-12">
      {!connected && !replaying ? <section className="mx-auto max-w-3xl overflow-hidden rounded-[2rem] border border-[#DED9CC] bg-[#FBFAF7] shadow-[0_24px_80px_rgba(65,57,43,0.11)]"><div className="bg-gradient-to-br from-[#1E2A3D] via-[#26364C] to-[#3A4B5B] px-6 py-10 text-center text-white sm:px-12 sm:py-14"><div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full border border-[#E8A23D]/50 bg-[#E8A23D]/10 text-2xl font-black text-[#E8A23D]">LQ</div><p className="mt-6 text-xs font-black uppercase tracking-[0.22em] text-[#E8A23D]">A real spoken class</p><h1 className="mt-3 text-3xl font-black tracking-[-0.05em] sm:text-5xl">Talk to your tutor.</h1><p className="mx-auto mt-4 max-w-xl text-sm leading-7 text-slate-200">Say, “Teach me inflammation,” or ask any question aloud. LenxiQ AI will build the lesson around your goal, teach it in a natural voice, and adapt whenever you interrupt.</p><Waveform active={false} /></div><div className="space-y-6 px-6 py-8 sm:px-12 sm:py-10"><div><label htmlFor="course" className="text-xs font-black uppercase tracking-[0.16em] text-[#9A5D00]">Course context</label><select id="course" value={courseName} onChange={(event) => setCourseName(event.target.value)} className="mt-2 w-full rounded-xl border border-[#D9D3C5] bg-white px-4 py-3 font-semibold text-[#27231D] outline-none focus:border-[#E8A23D]">{COURSES.map((course) => <option key={course} value={course}>{course}</option>)}</select><p className="mt-2 text-xs leading-5 text-[#8B8578]">This helps the tutor prioritise your LenxiQ AI course material while enriching the lesson with broader medical knowledge.</p></div><button type="button" onClick={() => void startSession()} disabled={connecting} className="w-full rounded-xl bg-[#E8A23D] px-5 py-4 text-base font-black text-[#172033] shadow-md hover:bg-amber-500 disabled:cursor-not-allowed disabled:opacity-50">{connecting ? 'Opening your live classroom…' : 'Enter Live Class'}</button><p className="text-center text-xs font-bold text-[#8B8578]">Free access: 3 live classes each month, up to 10 minutes each. Paid and admin access is unlimited.</p>{error && <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm font-bold leading-6 text-red-800">{error}{permissionState === 'denied' && <p className="mt-2 font-medium">{permissionHelp()}</p>}</div>}{recordingReady && recordingDownloadUrl && <div className="mt-5 rounded-2xl border border-[#E8D7B7] bg-[#FFF8E9] p-4"><p className="text-sm font-black text-[#5B3B0C]">Your spoken class is ready to keep.</p><p className="mt-1 text-xs leading-5 text-[#6E501E]">Download the audio recording now. Your transcript remains available in History.</p><a href={recordingDownloadUrl} download="lenxiq-live-class.webm" className="mt-3 inline-flex rounded-xl bg-[#E8A23D] px-4 py-3 text-xs font-black text-[#172033]">Download session audio</a></div>}</div></section> : <section className="mx-auto max-w-3xl overflow-hidden rounded-[2rem] border border-[#DED9CC] bg-[#FBFAF7] shadow-[0_24px_80px_rgba(65,57,43,0.11)]"><div className="bg-gradient-to-br from-[#1E2A3D] via-[#26364C] to-[#3A4B5B] px-6 py-8 text-white sm:px-12 sm:py-10"><div className="flex items-center justify-between gap-3"><div><p className="text-xs font-black uppercase tracking-[0.18em] text-[#E8A23D]">{liveLabel}</p><p className="mt-2 text-sm font-bold text-slate-300">{courseName} · no typing required</p></div>{connected && <div className="flex items-center gap-2">{quota && !quota.isUnlimited && remainingSeconds !== null && <span className="rounded-full border border-white/15 bg-white/10 px-3 py-2 text-xs font-black text-white">{formatClock(remainingSeconds)}</span>}<button type="button" onClick={() => void endSession()} className="rounded-xl bg-[#B44134] px-3 py-2 text-xs font-black text-white">End class</button></div>}</div><div className="py-12 text-center sm:py-16"><div className={`mx-auto flex h-32 w-32 items-center justify-center rounded-full border-4 ${voiceActive ? 'border-[#E8A23D] bg-[#E8A23D]/15 shadow-[0_0_0_18px_rgba(232,162,61,0.08)]' : 'border-white/20 bg-white/5'} transition`}><div className="h-20 w-20 rounded-full bg-[#E8A23D] p-5 text-[#172033]"><Waveform active={voiceActive || connected} /></div></div><h1 className="mt-8 text-2xl font-black tracking-[-0.04em] sm:text-4xl">{replaying ? 'Your saved class' : voiceActive ? 'LenxiQ AI is speaking' : 'I’m listening.'}</h1><p className="mx-auto mt-3 max-w-lg text-sm leading-7 text-slate-200">{status}</p><div className="mx-auto mt-4 flex flex-wrap items-center justify-center gap-2 text-[11px] font-black uppercase tracking-[0.12em] text-slate-300"><span className={`rounded-full px-3 py-1.5 ${micState === 'live' ? 'bg-emerald-400/20 text-emerald-200' : micState === 'silent' ? 'bg-amber-400/20 text-amber-200' : 'bg-white/10 text-slate-300'}`}>{micState === 'live' ? 'Mic live' : micState === 'silent' ? 'Mic silent' : micState === 'error' ? 'Mic error' : 'Mic starting'}</span><span className={`rounded-full px-3 py-1.5 ${audioState === 'playing' ? 'bg-emerald-400/20 text-emerald-200' : 'bg-white/10 text-slate-300'}`}>{audioState === 'playing' ? 'Tutor audio live' : audioState === 'blocked' ? 'Tutor audio blocked' : 'Tutor audio starting'}</span><span className="rounded-full bg-[#E8A23D]/20 px-3 py-1.5 text-[#FFE2A8]">Class active</span></div><div className="mt-8 flex items-center justify-center gap-3"><button type="button" onClick={() => void toggleMicrophone()} disabled={!connected} className={`flex h-16 w-16 items-center justify-center rounded-full shadow-lg ${micMuted ? 'bg-white/15 text-white' : 'bg-[#E8A23D] text-[#172033]'}`} aria-label={micMuted ? 'Unmute microphone' : 'Mute microphone'}>{micMuted ? '×' : '●'}</button><span className="text-left text-xs font-bold text-slate-300">{micMuted ? 'Microphone muted' : 'Speak naturally'}<br />Interrupt whenever you need.</span></div></div><div className="flex flex-wrap items-center justify-center gap-2 border-t border-white/10 pt-5"><button type="button" onClick={() => setShowTranscript((value) => !value)} className="rounded-xl border border-white/15 bg-white/10 px-3 py-2 text-xs font-black text-white">{showTranscript ? 'Hide transcript' : 'Show live transcript'}</button><button type="button" onClick={() => void resumeTutorAudio()} className={`rounded-xl border px-3 py-2 text-xs font-black ${audioState === 'playing' ? 'border-emerald-300/30 bg-emerald-300/10 text-emerald-100' : 'border-[#E8A23D]/60 bg-[#E8A23D]/15 text-[#FFE2A8]'}`}>{audioState === 'playing' ? 'Tutor sound on' : 'Enable tutor sound'}</button><div className="relative"><button type="button" onClick={() => void toggleAmbience()} className={`rounded-xl border px-3 py-2 text-xs font-black ${ambienceEnabled ? 'border-emerald-300/30 bg-emerald-300/10 text-emerald-100' : 'border-[#E8A23D]/60 bg-[#E8A23D]/15 text-[#FFE2A8]'}`}>{ambienceEnabled ? 'Ambience on · stop' : 'Test ambience speaker'}</button><button type="button" onClick={() => setAmbienceOpen((value) => !value)} className="rounded-xl border border-white/15 bg-white/10 px-3 py-2 text-xs font-black text-white">Choose sound</button>{ambienceOpen && <div className="absolute bottom-11 left-1/2 z-20 w-64 -translate-x-1/2 rounded-2xl border border-white/10 bg-[#172033] p-2 text-left shadow-2xl">{SOUNDSCAPES.map((item) => <button key={item.id} type="button" onClick={() => void selectAmbience(item.id)} className={`w-full rounded-xl px-3 py-3 ${item.id === ambienceId ? 'bg-white/10' : 'hover:bg-white/5'}`}><span className="block text-xs font-black text-white">{item.label}</span><span className="mt-1 block text-[11px] leading-4 text-slate-300">{item.description}</span></button>)}<button type="button" onClick={() => void toggleAmbience()} className="mt-1 w-full rounded-xl bg-[#E8A23D] px-3 py-2 text-xs font-black text-[#172033]">{ambienceEnabled ? 'Turn ambience off' : 'Turn ambience on'}</button></div>}</div>{recordingReady && recordingDownloadUrl && <a href={recordingDownloadUrl} download="lenxiq-live-class.webm" className="rounded-xl border border-[#E8A23D]/60 bg-[#E8A23D]/15 px-3 py-2 text-xs font-black text-[#FFF2D4]">Download session audio</a>}{replaying && <button type="button" onClick={() => { setReplaying(false); setMessages([]); setStatus('Ready when you are. Say what you want to understand.'); }} className="rounded-xl border border-white/15 bg-white/10 px-3 py-2 text-xs font-black text-white">Start new class</button>}</div></div>{ambienceNotice && connected && <p className="bg-[#FFF8E9] px-6 py-3 text-center text-xs font-bold text-[#6E501E]">{ambienceNotice} If you cannot hear it, raise phone media volume and check Bluetooth output.</p>}{showTranscript && <div className="max-h-72 space-y-3 overflow-y-auto bg-[#F6F4EE] px-5 py-5 sm:px-8">{messages.length === 0 && <p className="text-center text-sm font-bold text-[#8B8578]">Your spoken lesson will appear here as it unfolds.</p>}{messages.map((message, index) => <div key={message.id ?? `${message.role}-${index}`} className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}><div className={`max-w-[88%] rounded-2xl px-4 py-3 text-sm leading-6 ${message.role === 'user' ? 'bg-[#1E2A3D] text-white' : 'border border-[#E1DDD2] bg-white text-[#27231D]'}`}>{message.content}</div></div>)}</div>}{!showTranscript && latestMessage && <div className="border-t border-[#E7E2D7] bg-[#FBFAF7] px-6 py-4 text-center text-sm leading-6 text-[#6F6A60]"><span className="font-black text-[#9A5D00]">Live transcript</span> · {latestMessage.content}</div>}{error && <div className="m-5 rounded-xl border border-red-200 bg-red-50 p-4 text-sm font-bold leading-6 text-red-800">{error}</div>}</section>}
    </main>
    <audio ref={ambienceAudioRef} loop playsInline preload="auto" controls className={connected ? 'mx-auto mt-3 h-10 w-full max-w-sm rounded-xl' : 'hidden'} aria-label="Live Class ambience speaker test" />
    <div ref={audioContainerRef} className="fixed bottom-0 left-0 z-0 h-px w-px overflow-visible opacity-0 pointer-events-none" aria-live="polite" />
  </div>;
}

export default function VoicePage() {
  return <Suspense fallback={<div className="min-h-screen bg-[#F4F1EA]" />}><VoiceTutorContent /></Suspense>;
}
