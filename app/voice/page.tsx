'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { createLocalTracks, Room, RoomEvent, Track, type Participant, type TranscriptionSegment } from 'livekit-client';

type PermissionState = 'unknown' | 'granted' | 'denied';
type MicHealth = 'idle' | 'checking' | 'capturing' | 'silent' | 'error';
type Role = 'user' | 'assistant';
type Message = { id?: string; role: Role; content: string; created_at?: string };
type Conversation = { id: string; course_name: string; title: string; session_type?: string; created_at: string; updated_at: string };
type Quota = { isUnlimited: boolean; usedSessions: number | null; maxSessions: number | null; maxDurationSeconds: number | null; expiresAt: string | null; resetsAt: string | null };
type Soundscape = { id: string; label: string; description: string; src: string };
type SpeechRecognitionResultEvent = { resultIndex: number; results: { length: number; [index: number]: { 0: { transcript: string }; isFinal: boolean } } };
type SpeechRecognitionInstance = { continuous: boolean; interimResults: boolean; lang: string; onresult: ((event: SpeechRecognitionResultEvent) => void) | null; onerror: ((event: { error?: string }) => void) | null; onend: (() => void) | null; start: () => void; stop: () => void };
type SpeechRecognitionConstructor = new () => SpeechRecognitionInstance;

declare global { interface Window { SpeechRecognition?: SpeechRecognitionConstructor; webkitSpeechRecognition?: SpeechRecognitionConstructor } }

const SOUNDSCAPES: Soundscape[] = [
  { id: 'deep-focus', label: 'Deep Focus', description: 'Low, dark, spacious tones for sustained concentration.', src: '/audio/live-class-deep-focus.wav' },
  { id: 'warm-drift', label: 'Warm Drift', description: 'Soft rounded harmony with a gentle, cosy motion.', src: '/audio/live-class-warm-drift.wav' },
  { id: 'night-library', label: 'Night Library', description: 'Quiet, slow, grounded ambience for reflective learning.', src: '/audio/live-class-night-library.wav' },
];

const COURSES = ['Pharmacology', 'Microbiology', 'Chemical Pathology', 'Anatomical Pathology', 'Haematology / Immunology'];

function MicIcon({ active = false }: { active?: boolean }) {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={`h-5 w-5 ${active ? 'animate-pulse' : ''}`} aria-hidden="true"><rect x="8" y="3" width="8" height="12" rx="4" /><path strokeLinecap="round" strokeLinejoin="round" d="M5 11a7 7 0 0 0 14 0M12 18v3m-3 0h6" /></svg>;
}

function platformName() {
  if (typeof navigator === 'undefined') return 'your browser';
  if (/Android/i.test(navigator.userAgent)) return 'Android browser';
  if (/iPhone|iPad|iPod/i.test(navigator.userAgent)) return 'iPhone or iPad';
  return 'your browser';
}

function permissionHelp() {
  if (typeof navigator === 'undefined') return 'Allow microphone access in your browser, then return to LenxiQ AI and tap Check microphone again.';
  if (/Android/i.test(navigator.userAgent)) return 'Open Android Settings → Apps → your browser → Permissions → Microphone → Allow. Return to LenxiQ AI and tap Check microphone again.';
  if (/iPhone|iPad|iPod/i.test(navigator.userAgent)) return 'Open Settings → Safari → Microphone → Allow, then return to LenxiQ AI and tap Check microphone again.';
  return 'Open your browser site settings for lenxiq.online, set Microphone to Allow, then return to LenxiQ AI and tap Check microphone again.';
}

function friendlySessionError(error: unknown) {
  const message = error instanceof Error ? error.message : '';
  const name = typeof error === 'object' && error !== null && 'name' in error ? String((error as { name?: string }).name) : '';
  if (name === 'NotAllowedError' || /permission|not allowed/i.test(message)) return 'Microphone permission was not granted. Open your phone settings, allow microphone access for the browser, return to LenxiQ AI, and check permission again.';
  if (name === 'NotFoundError' || /device not found|requested device/i.test(message)) return 'No microphone was found. Confirm that your phone has a working microphone, then allow microphone access for the browser and check again.';
  if (/limit_reached/i.test(message)) return message;
  if (/Invalid URL|invalid.*url/i.test(message)) return 'The Live Class server address is invalid. The deployment needs a valid LiveKit WebSocket endpoint.';
  if (/Failed to fetch|signal connection|network|websocket/i.test(message)) return 'The LiveKit server could not be reached. Check your connection, then try again.';
  if (/Not authenticated|authenticated/i.test(message)) return 'Sign in to LenxiQ AI before starting Live Class.';
  return message || 'Unable to start the live learning session.';
}

function formatClock(seconds: number) {
  const safe = Math.max(0, seconds);
  return `${Math.floor(safe / 60)}:${String(safe % 60).padStart(2, '0')}`;
}

function VoiceTutorContent() {
  const searchParams = useSearchParams();
  const topicFocus = searchParams.get('topic')?.trim() ?? '';
  const [courseName, setCourseName] = useState(searchParams.get('course')?.trim() || 'Pharmacology');
  const [connected, setConnected] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [status, setStatus] = useState('Ready when you are. Enter the room and choose what to learn.');
  const [error, setError] = useState('');
  const [permissionState, setPermissionState] = useState<PermissionState>('unknown');
  const [ambientEnabled, setAmbientEnabled] = useState(false);
  const [soundscapeId, setSoundscapeId] = useState('deep-focus');
  const [soundscapeStatus, setSoundscapeStatus] = useState('Ambience is off');
  const [soundscapeVolume, setSoundscapeVolume] = useState(0.32);
  const [soundPlaying, setSoundPlaying] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [currentInput, setCurrentInput] = useState(topicFocus ? `Let’s study ${topicFocus}. Start with the core idea and guide me step by step.` : '');
  const [loading, setLoading] = useState(false);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [showHistory, setShowHistory] = useState(false);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [quota, setQuota] = useState<Quota | null>(null);
  const [sessionEndsAt, setSessionEndsAt] = useState<number | null>(null);
  const [remainingSeconds, setRemainingSeconds] = useState<number | null>(null);
  const [voiceActive, setVoiceActive] = useState(false);
  const [micMuted, setMicMuted] = useState(false);
  const [micHealth, setMicHealth] = useState<MicHealth>('idle');
  const [micLevel, setMicLevel] = useState(0);
  const [interimTranscript, setInterimTranscript] = useState('');
  const [isDictating, setIsDictating] = useState(false);
  const [isRecordingVoice, setIsRecordingVoice] = useState(false);
  const [voiceRecordStatus, setVoiceRecordStatus] = useState('');
  const [replaying, setReplaying] = useState(false);
  const roomRef = useRef<Room | null>(null);
  const ambientAudioRef = useRef<HTMLAudioElement>(null);
  const audioContainerRef = useRef<HTMLDivElement>(null);
  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordingStreamRef = useRef<MediaStream | null>(null);
  const recordingChunksRef = useRef<Blob[]>([]);
  const recordingTimeoutRef = useRef<number | null>(null);
  const historyContainerRef = useRef<HTMLDivElement>(null);
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const shouldAutoScrollRef = useRef(true);
  const conversationIdRef = useRef<string | null>(null);
  const sessionIdRef = useRef<string | null>(null);
  const messagesRef = useRef<Message[]>([]);
  const transcriptIdsRef = useRef(new Set<string>());
  const endingSessionRef = useRef(false);
  const greetingTimerRef = useRef<number | null>(null);
  const micMonitorRef = useRef<{ context: AudioContext; source: MediaStreamAudioSourceNode; analyser: AnalyserNode; frame: number } | null>(null);
  const ambientTrack = useMemo(() => SOUNDSCAPES.find((soundscape) => soundscape.id === soundscapeId) ?? SOUNDSCAPES[0], [soundscapeId]);
  const clearAttachedAudio = () => audioContainerRef.current?.replaceChildren();

  const stopMicMonitor = () => {
    const monitor = micMonitorRef.current;
    if (!monitor) return;
    window.cancelAnimationFrame(monitor.frame);
    monitor.source.disconnect();
    monitor.analyser.disconnect();
    void monitor.context.close().catch(() => undefined);
    micMonitorRef.current = null;
    setMicLevel(0);
  };

  const startMicMonitor = async (mediaTrack: MediaStreamTrack) => {
    stopMicMonitor();
    const AudioContextConstructor = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextConstructor) {
      setMicHealth('error');
      setStatus('Microphone is connected, but this browser cannot measure its input. You can still speak or use the text box.');
      return;
    }
    try {
      const context = new AudioContextConstructor();
      await context.resume();
      const source = context.createMediaStreamSource(new MediaStream([mediaTrack]));
      const analyser = context.createAnalyser();
      analyser.fftSize = 512;
      source.connect(analyser);
      const samples = new Uint8Array(analyser.fftSize);
      const startedAt = performance.now();
      let lastPaint = 0;
      const monitor = { context, source, analyser, frame: 0 };
      const sample = () => {
        analyser.getByteTimeDomainData(samples);
        let sum = 0;
        for (const sampleValue of samples) {
          const normalized = (sampleValue - 128) / 128;
          sum += normalized * normalized;
        }
        const rms = Math.sqrt(sum / samples.length);
        const now = performance.now();
        if (now - lastPaint > 100) {
          const level = Math.min(1, rms * 5);
          setMicLevel(level);
          setMicHealth(rms > 0.018 ? 'capturing' : now - startedAt > 3500 ? 'silent' : 'checking');
          lastPaint = now;
        }
        monitor.frame = window.requestAnimationFrame(sample);
      };
      micMonitorRef.current = monitor;
      setMicHealth('checking');
      monitor.frame = window.requestAnimationFrame(sample);
    } catch {
      setMicHealth('error');
      setStatus('Microphone access exists, but the browser did not expose a readable input signal. Use the text box or check the phone microphone route.');
    }
  };

  useEffect(() => { conversationIdRef.current = conversationId; }, [conversationId]);
  useEffect(() => { sessionIdRef.current = sessionId; }, [sessionId]);
  useEffect(() => { messagesRef.current = messages; }, [messages]);

  useEffect(() => {
    const loadHistory = async () => {
      try {
        const response = await fetch('/api/teaching/conversations?sessionType=live_class');
        if (!response.ok) return;
        const data = await response.json();
        setConversations(data.conversations ?? []);
      } finally { setHistoryLoading(false); }
    };
    void loadHistory();
  }, []);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      if (shouldAutoScrollRef.current && scrollAreaRef.current) scrollAreaRef.current.scrollTop = scrollAreaRef.current.scrollHeight;
    });
    return () => window.cancelAnimationFrame(frame);
  }, [messages, loading]);

  useEffect(() => {
    if (!showHistory) return;
    const closeOnOutside = (event: PointerEvent) => { if (historyContainerRef.current && !historyContainerRef.current.contains(event.target as Node)) setShowHistory(false); };
    const closeOnEscape = (event: KeyboardEvent) => { if (event.key === 'Escape') setShowHistory(false); };
    document.addEventListener('pointerdown', closeOnOutside);
    document.addEventListener('keydown', closeOnEscape);
    return () => { document.removeEventListener('pointerdown', closeOnOutside); document.removeEventListener('keydown', closeOnEscape); };
  }, [showHistory]);

  useEffect(() => {
    if (!connected || !sessionEndsAt || quota?.isUnlimited) return;
    const tick = () => {
      const remaining = Math.max(0, Math.ceil((sessionEndsAt - Date.now()) / 1000));
      setRemainingSeconds(remaining);
      if (remaining === 0 && !endingSessionRef.current) {
        endingSessionRef.current = true;
        const activeSessionId = sessionIdRef.current;
        roomRef.current?.disconnect();
        roomRef.current = null;
        clearAttachedAudio();
        ambientAudioRef.current?.pause();
        setConnected(false);
        setVoiceActive(false);
        setSessionId(null);
        sessionIdRef.current = null;
        setSessionEndsAt(null);
        setStatus('Your 10-minute free Live Class has ended. Your conversation has been saved to History.');
        if (activeSessionId) void fetch('/api/voice/session', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ sessionId: activeSessionId, action: 'end' }) });
        void fetch('/api/teaching/conversations?sessionType=live_class').then((response) => response.ok ? response.json() : null).then((data) => { if (data) setConversations(data.conversations ?? []); }).finally(() => { endingSessionRef.current = false; });
      }
    };
    tick();
    const timer = window.setInterval(tick, 1000);
    return () => window.clearInterval(timer);
  }, [connected, sessionEndsAt, quota?.isUnlimited]);

  useEffect(() => {
    if (!connected || !sessionId) return;
    const timer = window.setInterval(() => {
      void fetch('/api/voice/session', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ sessionId, action: 'heartbeat' }) });
    }, 30_000);
    return () => window.clearInterval(timer);
  }, [connected, sessionId]);

  useEffect(() => () => {
    recognitionRef.current?.stop();
    mediaRecorderRef.current?.stop();
    recordingStreamRef.current?.getTracks().forEach((track) => track.stop());
    if (recordingTimeoutRef.current) window.clearTimeout(recordingTimeoutRef.current);
    stopMicMonitor();
    if (greetingTimerRef.current) window.clearTimeout(greetingTimerRef.current);
    roomRef.current?.disconnect();
    ambientAudioRef.current?.pause();
  }, []);

  const loadHistory = async () => {
    const response = await fetch('/api/teaching/conversations?sessionType=live_class');
    if (!response.ok) return;
    const data = await response.json();
    setConversations(data.conversations ?? []);
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

  const loadConversation = async (id: string) => {
    if (connected || loading) return;
    setError('');
    const response = await fetch(`/api/teaching/conversations/${id}`);
    if (!response.ok) { setError('Unable to reopen this Live Class history.'); return; }
    const data = await response.json();
    setConversationId(data.conversation.id);
    conversationIdRef.current = data.conversation.id;
    setCourseName(data.conversation.course_name);
    setMessages(data.messages ?? []);
    setReplaying(true);
    setShowHistory(false);
    setStatus('This is a saved Live Class. Start a new session when you are ready to continue aloud.');
    shouldAutoScrollRef.current = true;
  };

  const persistMessage = async (id: string, message: Message) => {
    const response = await fetch('/api/teaching/messages', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ conversationId: id, role: message.role, content: message.content }) });
    if (!response.ok) throw new Error('Unable to save this Live Class message.');
  };

  const attachAudioTrack = (track: Track) => {
    if (!audioContainerRef.current || track.kind !== Track.Kind.Audio) return;
    const element = track.attach();
    element.autoplay = true;
    element.setAttribute('aria-hidden', 'true');
    audioContainerRef.current.appendChild(element);
  };

  const requestMicrophonePermission = async () => {
    if (!navigator.mediaDevices?.getUserMedia) {
      setPermissionState('denied');
      setError('This browser does not provide microphone access. Open LenxiQ AI in a current Chrome or Safari browser over HTTPS.');
      return false;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
      stream.getTracks().forEach((track) => track.stop());
      setPermissionState('granted');
      setError('');
      return true;
    } catch (permissionError) {
      setPermissionState('denied');
      setStatus('Microphone permission is required before joining.');
      setError(friendlySessionError(permissionError));
      return false;
    }
  };

  const openDeviceSettings = () => {
    setStatus(`Open ${platformName()} settings, allow microphone access for your browser, then return to LenxiQ AI.`);
    if (/Android/i.test(navigator.userAgent)) window.location.href = 'intent://settings#Intent;scheme=android-app;package=com.android.settings;end';
    else if (/iPhone|iPad|iPod/i.test(navigator.userAgent)) window.location.href = 'app-settings:';
    else setError(permissionHelp());
  };

  const playSoundscape = async (selected: Soundscape) => {
    const audio = ambientAudioRef.current;
    if (!audio) throw new Error('The soundscape player is not available yet.');
    audio.pause();
    audio.src = selected.src;
    audio.load();
    audio.currentTime = 0;
    audio.volume = soundscapeVolume;
    audio.muted = false;
    audio.setAttribute('playsinline', 'true');
    await audio.play();
    await new Promise<void>((resolve, reject) => {
      const startedAt = audio.currentTime;
      const timeout = window.setTimeout(() => {
        cleanup();
        if (audio.paused || audio.currentTime <= startedAt + 0.02) reject(new Error('Audio timeline did not advance.'));
        else resolve();
      }, 350);
      const onTimeUpdate = () => {
        if (audio.currentTime > startedAt + 0.02) {
          cleanup();
          resolve();
        }
      };
      const cleanup = () => {
        window.clearTimeout(timeout);
        audio.removeEventListener('timeupdate', onTimeUpdate);
      };
      audio.addEventListener('timeupdate', onTimeUpdate);
    });
    setAmbientEnabled(true);
    setSoundPlaying(true);
    setSoundscapeStatus(`${selected.label} playback is active · ambient level ${Math.round(soundscapeVolume * 100)}%`);
  };

  const toggleAmbient = async () => {
    const audio = ambientAudioRef.current;
    if (!audio) return;
    setError('');
    if (ambientEnabled) {
      audio.pause();
      setAmbientEnabled(false);
      setSoundPlaying(false);
      setSoundscapeStatus('Ambience is off');
      return;
    }
    try { await playSoundscape(ambientTrack); }
    catch { setAmbientEnabled(false); setSoundPlaying(false); setSoundscapeStatus('Tap Test sound to start ambience'); setError('The phone did not start audio. Tap Test sound after the page has loaded and check media volume.'); }
  };

  const selectSoundscape = async (id: string) => {
    const selected = SOUNDSCAPES.find((soundscape) => soundscape.id === id) ?? SOUNDSCAPES[0];
    setSoundscapeId(selected.id);
    setError('');
    try { await playSoundscape(selected); }
    catch { setAmbientEnabled(false); setSoundPlaying(false); setSoundscapeStatus(`${selected.label} selected · tap Test sound`); setError('The soundscape was selected but did not start. Tap Test sound after the page has loaded to unlock the phone speaker.'); }
  };

  const endSession = async (message = 'Your Live Class has ended. This conversation is saved in History.') => {
    if (endingSessionRef.current) return;
    endingSessionRef.current = true;
    const activeSessionId = sessionIdRef.current;
    roomRef.current?.disconnect();
    roomRef.current = null;
    stopMicMonitor();
    if (greetingTimerRef.current) window.clearTimeout(greetingTimerRef.current);
    clearAttachedAudio();
    ambientAudioRef.current?.pause();
    setConnected(false);
    setVoiceActive(false);
    setSessionId(null);
    sessionIdRef.current = null;
    setSessionEndsAt(null);
    setRemainingSeconds(null);
    setStatus(message);
    if (activeSessionId) await fetch('/api/voice/session', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ sessionId: activeSessionId, action: 'end' }) }).catch(() => undefined);
    await loadHistory().catch(() => undefined);
    endingSessionRef.current = false;
  };

  const startSession = async () => {
    if (connecting || connected) return;
    setConnecting(true);
    endingSessionRef.current = false;
    setError('');
    setStatus('Preparing your cosy Live Class…');
    try {
      const microphoneReady = await requestMicrophonePermission();
      if (!microphoneReady) return;
      const tokenResponse = await fetch('/api/voice/token', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ courseName }) });
      const tokenData = await tokenResponse.json().catch(() => ({}));
      if (!tokenResponse.ok) {
        if (tokenData.error === 'live_class_limit') throw new Error(tokenData.message);
        throw new Error(tokenData.error || 'Unable to create a secure live session.');
      }
      setSessionId(tokenData.sessionId);
      sessionIdRef.current = tokenData.sessionId;
      setQuota(tokenData.quota ?? null);
      const activeConversation = await createConversation();
      const linkResponse = await fetch('/api/voice/session', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ sessionId: tokenData.sessionId, action: 'link', conversationId: activeConversation.id }) });
      if (!linkResponse.ok) throw new Error('Unable to save the Live Class history link.');
      setMessages([]);
      messagesRef.current = [];
      transcriptIdsRef.current.clear();
      setInterimTranscript('');
      setReplaying(false);
      const room = new Room({ adaptiveStream: true, dynacast: true });
      room.on(RoomEvent.TrackSubscribed, (track) => attachAudioTrack(track));
      room.on(RoomEvent.TrackUnsubscribed, (track) => track.detach());
      room.on(RoomEvent.ActiveSpeakersChanged, (speakers) => setVoiceActive(speakers.some((speaker) => !speaker.isLocal)));
      room.on(RoomEvent.TranscriptionReceived, (segments: TranscriptionSegment[], participant?: Participant) => {
        for (const segment of segments) {
          if (!segment.text.trim()) continue;
          if (!segment.final) {
            if (participant?.isLocal) setInterimTranscript(segment.text.trim());
            continue;
          }
          if (participant?.isLocal) setInterimTranscript('');
          const key = `${participant?.identity ?? 'unknown'}:${segment.id}`;
          if (transcriptIdsRef.current.has(key)) continue;
          transcriptIdsRef.current.add(key);
          const message: Message = { role: participant?.isLocal ? 'user' : 'assistant', content: segment.text.trim() };
          setMessages((previous) => [...previous, message]);
          void persistMessage(activeConversation.id, message);
        }
      });
      room.on(RoomEvent.Disconnected, () => {
        roomRef.current = null;
        clearAttachedAudio();
        setConnected(false);
        setVoiceActive(false);
        if (!endingSessionRef.current) void endSession();
      });
      room.on(RoomEvent.AudioPlaybackStatusChanged, (playing: boolean) => setStatus(playing ? 'Your tutor is ready. Speak whenever you want to interrupt or ask a question.' : 'Tap the page once if the tutor audio needs to resume.'));
      const livekitUrl = typeof tokenData.url === 'string' ? tokenData.url.trim() : '';
      if (!/^wss?:\/\//i.test(livekitUrl)) throw new Error('Invalid LiveKit server URL returned by the secure session endpoint.');
      await room.connect(livekitUrl, tokenData.token);
      const localTracks = await createLocalTracks({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true }, video: false });
      for (const localTrack of localTracks) await room.localParticipant.publishTrack(localTrack);
      const localAudioTrack = localTracks.find((localTrack) => localTrack.kind === Track.Kind.Audio);
      if (localAudioTrack) await startMicMonitor(localAudioTrack.mediaStreamTrack);
      roomRef.current = room;
      setConnected(true);
      setMicMuted(false);
      setSessionEndsAt(tokenData.quota?.isUnlimited ? null : Date.now() + (tokenData.quota?.maxDurationSeconds ?? 600) * 1000);
      setStatus('Microphone connected. Your tutor is joining the room…');
      greetingTimerRef.current = window.setTimeout(() => {
        if (messagesRef.current.length > 0 || conversationIdRef.current !== activeConversation.id) return;
        const greeting: Message = { role: 'assistant', content: 'Welcome to LenxiQ AI Live Class. I’m ready to learn with you—what medical topic would you like to study first?' };
        setMessages([greeting]);
        void persistMessage(activeConversation.id, greeting);
        setStatus('Your tutor is ready. Speak naturally, interrupt anytime, or use the text box below.');
      }, 3500);
      if (ambientEnabled && ambientAudioRef.current) { ambientAudioRef.current.volume = soundscapeVolume; void ambientAudioRef.current.play().catch(() => setSoundscapeStatus('Tap Test sound to resume ambience')); }
    } catch (sessionError) {
      setError(friendlySessionError(sessionError));
      setMicHealth('error');
      stopMicMonitor();
      setStatus('The Live Class could not be started.');
      roomRef.current?.disconnect();
      roomRef.current = null;
      const activeSessionId = sessionIdRef.current;
      if (activeSessionId) { await fetch('/api/voice/session', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ sessionId: activeSessionId, action: 'end' }) }).catch(() => undefined); }
      setSessionId(null); sessionIdRef.current = null;
    } finally { setConnecting(false); }
  };

  const toggleMicrophone = async () => {
    if (!roomRef.current) return;
    const enabled = !micMuted;
    await roomRef.current.localParticipant.setMicrophoneEnabled(enabled);
    setMicMuted(!enabled);
    setMicHealth(enabled ? 'checking' : 'idle');
    setStatus(enabled ? 'Microphone on. Your tutor is listening.' : 'Microphone muted. Turn it back on when you are ready.');
  };

  const toggleDictation = async () => {
    if (isRecordingVoice) {
      mediaRecorderRef.current?.stop();
      return;
    }
    if (isDictating) {
      recognitionRef.current?.stop();
      setIsDictating(false);
      return;
    }

    const startBrowserSpeechFallback = () => {
      const Recognition = typeof window !== 'undefined' ? (window.SpeechRecognition || window.webkitSpeechRecognition) : undefined;
      if (!Recognition) {
        setError('Voice typing is unavailable in this browser. You can still speak directly to the Live Class microphone or type your question.');
        return;
      }
      const recognition = new Recognition();
      recognition.continuous = false;
      recognition.interimResults = true;
      recognition.lang = 'en-NG';
      const prefix = currentInput.trim();
      recognition.onresult = (event) => {
        let transcript = '';
        for (let index = event.resultIndex; index < event.results.length; index += 1) transcript += event.results[index][0].transcript;
        setInterimTranscript(transcript);
        setCurrentInput(`${prefix}${prefix && transcript ? ' ' : ''}${transcript}`.trimStart());
      };
      recognition.onerror = () => { setIsDictating(false); setInterimTranscript(''); setError('Browser voice typing did not return speech. Try the tap-to-speak recorder again or type your question.'); };
      recognition.onend = () => { recognitionRef.current = null; setIsDictating(false); setInterimTranscript(''); };
      recognitionRef.current = recognition;
      setError(''); setIsDictating(true); setVoiceRecordStatus('Browser voice typing is listening…'); recognition.start();
    };

    if (typeof MediaRecorder === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
      startBrowserSpeechFallback();
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true }, video: false });
      const mimeType = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4'].find((candidate) => MediaRecorder.isTypeSupported(candidate));
      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      recordingStreamRef.current = stream;
      recordingChunksRef.current = [];
      recorder.ondataavailable = (event) => { if (event.data.size > 0) recordingChunksRef.current.push(event.data); };
      recorder.onerror = () => {
        stream.getTracks().forEach((track) => track.stop());
        recordingStreamRef.current = null;
        mediaRecorderRef.current = null;
        setIsRecordingVoice(false);
        setVoiceRecordStatus('');
        setError('The phone recorder failed. Check microphone permission, then try again or type your question.');
      };
      recorder.onstop = async () => {
        if (recordingTimeoutRef.current) window.clearTimeout(recordingTimeoutRef.current);
        stream.getTracks().forEach((track) => track.stop());
        recordingStreamRef.current = null;
        mediaRecorderRef.current = null;
        setIsRecordingVoice(false);
        const blob = new Blob(recordingChunksRef.current, { type: recorder.mimeType || 'audio/webm' });
        recordingChunksRef.current = [];
        if (blob.size === 0) { setVoiceRecordStatus('No audio was captured. Hold the microphone and speak.'); return; }
        setVoiceRecordStatus('Transcribing your question…');
        try {
          const formData = new FormData();
          formData.append('audio', new File([blob], 'live-class-question.webm', { type: blob.type }));
          const response = await fetch('/api/voice/transcribe', { method: 'POST', body: formData });
          const data = await response.json().catch(() => ({}));
          if (!response.ok) throw new Error(data.error || 'Voice transcription failed.');
          setCurrentInput((previous) => `${previous.trim()}${previous.trim() ? ' ' : ''}${String(data.text).trim()}`);
          setVoiceRecordStatus('Voice question ready — tap Send to ask the tutor.');
          setError('');
        } catch (transcriptionError) {
          setVoiceRecordStatus('');
          setError(transcriptionError instanceof Error ? transcriptionError.message : 'Voice transcription failed. Type your question instead.');
        }
      };
      mediaRecorderRef.current = recorder;
      recorder.start(250);
      setError('');
      setIsRecordingVoice(true);
      setVoiceRecordStatus('Recording… tap the microphone again when you finish.');
      recordingTimeoutRef.current = window.setTimeout(() => { if (recorder.state === 'recording') recorder.stop(); }, 12_000);
    } catch (recordingError) {
      setError(friendlySessionError(recordingError));
      startBrowserSpeechFallback();
    }
  };

  const askByText = async (event?: React.FormEvent) => {
    event?.preventDefault();
    const trimmed = currentInput.trim();
    if (!trimmed || loading || !connected || !sessionId || !conversationId) return;
    setLoading(true); setError(''); shouldAutoScrollRef.current = true;
    const userMessage: Message = { role: 'user', content: trimmed };
    const nextMessages = [...messagesRef.current, userMessage];
    setMessages(nextMessages); setCurrentInput('');
    try {
      await persistMessage(conversationId, userMessage);
      const response = await fetch('/api/teach', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ conversationId, courseName, sessionType: 'live_class', liveClassSessionId: sessionId, messages: nextMessages.map(({ role, content }) => ({ role, content })) }) });
      if (!response.ok) { const data = await response.json().catch(() => ({})); throw new Error(data.error || 'The tutor could not answer that yet.'); }
      setMessages((previous) => [...previous, { role: 'assistant', content: '' }]);
      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      let assistantResponse = '';
      let buffer = '';
      if (reader) {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const events = buffer.split(/\r?\n\r?\n/);
          buffer = events.pop() || '';
          for (const eventChunk of events) {
            const data = eventChunk.split(/\r?\n/).filter((line) => line.startsWith('data:')).map((line) => line.replace(/^data:\s?/, '')).join('\n');
            if (!data || data === '[DONE]') continue;
            try { const parsed = JSON.parse(data); const chunk = parsed.choices?.[0]?.delta?.content || ''; if (chunk) { assistantResponse += chunk; setMessages((previous) => { const updated = [...previous]; updated[updated.length - 1] = { role: 'assistant', content: assistantResponse }; return updated; }); } } catch { /* Buffer incomplete SSE frames. */ }
          }
        }
      }
      if (assistantResponse) await persistMessage(conversationId, { role: 'assistant', content: assistantResponse });
      await loadHistory();
    } catch (teachError) {
      setError(friendlySessionError(teachError));
      setMessages(messagesRef.current.filter((_, index) => index !== messagesRef.current.length - 1));
      setCurrentInput(trimmed);
    } finally { setLoading(false); }
  };

  const handleScroll = () => { const element = scrollAreaRef.current; if (element) shouldAutoScrollRef.current = element.scrollHeight - element.scrollTop - element.clientHeight < 96; };
  const hasRoom = connected || replaying;
  const roomLabel = replaying ? 'Saved Live Class' : connected ? 'Live Class in progress' : 'Live Class';
  const micStatusText = micHealth === 'capturing' ? `Microphone signal detected · ${Math.round(micLevel * 100)}%` : micHealth === 'silent' ? 'Microphone connected but no speech signal detected' : micHealth === 'checking' ? 'Checking microphone signal…' : micHealth === 'error' ? 'Microphone signal needs attention' : 'Microphone ready';

  return <div className="min-h-[calc(100vh-4.5rem)] bg-[#F4F1EA] text-[#172033]">
    <header className="sticky top-[4.5rem] z-30 border-b border-[#DED9CC] bg-[#F8F6F0]/95 px-4 py-3 shadow-sm backdrop-blur sm:px-6">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-3"><div className="flex min-w-0 items-center gap-3"><Link href="/teach" className="hidden text-sm font-black text-[#8B8578] hover:text-[#172033] sm:block">← Teaching Room</Link><span className="hidden h-5 w-px bg-[#D9D3C5] sm:block" /><div className="min-w-0"><p className="truncate text-sm font-black text-[#172033]">LenxiQ AI Live Class</p><p className="truncate text-xs font-bold text-[#8B8578]">{courseName} · conceptual, interactive learning</p></div></div><div ref={historyContainerRef} className="relative flex shrink-0 items-center gap-2"><Link href="/pricing" className="rounded-xl border border-[#E8A23D]/50 bg-[#FFF8E9] px-3 py-2 text-xs font-black text-[#8B5709] hover:bg-[#FFF0CF]">Plans</Link><button type="button" onClick={() => setShowHistory((open) => !open)} className="rounded-xl border border-[#D9D3C5] bg-white px-3 py-2 text-xs font-black text-[#514D45] hover:border-[#A9A294]" aria-expanded={showHistory}>History{conversations.length ? ` · ${conversations.length}` : ''}</button>{showHistory && <div className="absolute right-0 top-12 z-50 w-[min(88vw,23rem)] overflow-hidden rounded-2xl border border-[#D9D3C5] bg-white p-2 shadow-2xl"><div className="flex items-center justify-between px-3 py-2"><p className="text-xs font-black uppercase tracking-[0.15em] text-[#9A9386]">Revisit a live class</p><button type="button" onClick={() => setShowHistory(false)} className="text-xs font-bold text-[#8B8578]">Close</button></div>{historyLoading && <p className="p-3 text-sm text-[#8B8578]">Loading history…</p>}{!historyLoading && conversations.length === 0 && <p className="p-3 text-sm leading-6 text-[#6F6A60]">Your completed Live Classes will appear here.</p>}{conversations.slice(0, 15).map((conversation) => <button key={conversation.id} type="button" onClick={() => void loadConversation(conversation.id)} className="w-full rounded-xl px-3 py-3 text-left hover:bg-[#F8F6F0]"><span className="block truncate text-sm font-black text-[#27231D]">{conversation.title}</span><span className="mt-1 block truncate text-xs font-bold text-[#9A9386]">{conversation.course_name} · {new Date(conversation.updated_at).toLocaleDateString()}</span></button>)}</div>}</div></div>
    </header>
    <main ref={scrollAreaRef} onScroll={handleScroll} className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <section className="overflow-hidden rounded-[2rem] border border-[#DED9CC] bg-[#FBFAF7] shadow-[0_24px_70px_rgba(65,57,43,0.10)]">
          <div className="border-b border-[#E7E2D7] bg-gradient-to-br from-[#1E2A3D] via-[#26364C] to-[#3A4B5B] px-5 py-7 text-white sm:px-8 sm:py-9"><div className="flex flex-wrap items-center justify-between gap-3"><div><p className="text-xs font-black uppercase tracking-[0.22em] text-[#E8A23D]">A quiet room for difficult ideas</p><h1 className="mt-3 max-w-2xl text-3xl font-black tracking-[-0.04em] sm:text-4xl">Let’s understand this together.</h1><p className="mt-3 max-w-2xl text-sm leading-7 text-slate-200">Speak naturally and interrupt whenever you need. You can also type a question below; the tutor will keep the conversation grounded in your course material and past questions.</p></div><div className={`rounded-2xl border px-4 py-3 text-right ${connected ? 'border-emerald-200/30 bg-emerald-300/10' : 'border-white/15 bg-white/10'}`}><p className="text-[11px] font-black uppercase tracking-[0.16em] text-slate-300">{roomLabel}</p><p className="mt-1 text-sm font-black text-white">{connected ? 'Tutor listening' : replaying ? 'Read-only replay' : 'Not started'}</p></div></div><div className="mt-7 flex flex-wrap items-center gap-2 text-xs font-bold text-slate-200"><span className="rounded-full border border-white/15 bg-white/10 px-3 py-2">Interrupt anytime</span><span className="rounded-full border border-white/15 bg-white/10 px-3 py-2">Voice + text</span><span className="rounded-full border border-white/15 bg-white/10 px-3 py-2">Past questions inside the lesson</span></div></div>
          {!hasRoom && <div className="px-5 py-8 sm:px-8 sm:py-10"><div className="grid gap-5 md:grid-cols-[1fr_18rem]"><div><p className="text-xs font-black uppercase tracking-[0.18em] text-[#9A5D00]">Before we begin</p><h2 className="mt-2 text-2xl font-black tracking-[-0.03em] text-[#172033]">Choose the course and enter the room.</h2><p className="mt-3 max-w-xl text-sm leading-7 text-[#6F6A60]">Once connected, the tutor will greet you, ask what you want to learn, and listen for your response. Free users receive 3 Live Class sessions per calendar month, up to 10 minutes each.</p><label htmlFor="course" className="mt-6 block text-sm font-black text-[#27231D]">Course focus</label><select id="course" value={courseName} onChange={(event) => setCourseName(event.target.value)} className="mt-2 w-full max-w-md rounded-xl border border-[#D9D3C5] bg-white px-4 py-3 font-semibold text-[#27231D] outline-none focus:border-[#E8A23D] focus:ring-2 focus:ring-[#E8A23D]/20">{COURSES.map((course) => <option key={course} value={course}>{course}</option>)}</select></div><div className="rounded-3xl border border-[#E8D7B7] bg-[#FFF8E9] p-5"><p className="text-sm font-black text-[#5B3B0C]">How the room works</p><div className="mt-4 space-y-4 text-sm leading-6 text-[#6E501E]"><p><strong>01</strong> Enter and allow your microphone.</p><p><strong>02</strong> Ask by voice or type below.</p><p><strong>03</strong> Interrupt, clarify, and revisit the saved class later.</p></div></div></div><div className="mt-7 flex flex-wrap gap-3"><button type="button" onClick={() => void startSession()} disabled={connecting} className="rounded-xl bg-[#E8A23D] px-5 py-3.5 font-black text-[#172033] shadow-md hover:bg-amber-500 disabled:cursor-not-allowed disabled:opacity-50">{connecting ? 'Preparing the room…' : 'Enter Live Class'}</button><Link href="/teach" className="rounded-xl border border-[#CFC8B9] bg-white px-5 py-3.5 font-bold text-[#514D45] hover:bg-[#F8F6F0]">Use Teaching Room</Link></div>{error && <div className="mt-5 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-bold leading-6 text-red-800">{error}</div>}</div>}
          {hasRoom && <div className="px-4 py-5 sm:px-7 sm:py-7"><div className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[#DDE6E0] bg-[#F0F8F2] px-4 py-3"><div className="flex items-center gap-3"><span className={`h-3 w-3 rounded-full ${connected ? 'animate-pulse bg-emerald-500' : 'bg-slate-400'}`} /><div><p className="text-sm font-black text-[#214A32]">{replaying ? 'Saved conversation' : status}</p><p className="text-xs font-bold text-[#5B7C66]">{connected ? voiceActive ? 'Your tutor is speaking · interrupt whenever you need' : `${micStatusText} · speak naturally or type below` : 'Read-only replay · your messages and tutor responses are preserved'}</p></div></div><div className="flex items-center gap-2">{connected && !quota?.isUnlimited && remainingSeconds !== null && <span className="rounded-xl bg-white px-3 py-2 text-xs font-black text-[#214A32]">{formatClock(remainingSeconds)} left</span>}{connected && <button type="button" onClick={() => void toggleMicrophone()} className="rounded-xl border border-[#BFD4C4] bg-white px-3 py-2 text-xs font-black text-[#214A32]">{micMuted ? 'Unmute mic' : 'Mute mic'}</button>}{connected && <button type="button" onClick={() => void endSession()} className="rounded-xl bg-[#B44134] px-3 py-2 text-xs font-black text-white">End & save</button>}{replaying && !connected && <button type="button" onClick={() => { setReplaying(false); setConversationId(null); conversationIdRef.current = null; setMessages([]); setStatus('Ready to begin a new Live Class.'); }} className="rounded-xl bg-[#E8A23D] px-3 py-2 text-xs font-black text-[#172033]">Start new class</button>}</div></div>{error && <div className="mb-5 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-bold leading-6 text-red-800">{error}{permissionState === 'denied' && <div className="mt-3 flex flex-wrap gap-2"><button type="button" onClick={openDeviceSettings} className="rounded-lg bg-red-700 px-3 py-2 text-xs font-black text-white">Open phone settings</button><button type="button" onClick={() => void requestMicrophonePermission()} className="rounded-lg border border-red-300 bg-white px-3 py-2 text-xs font-black text-red-700">Check microphone again</button><span className="w-full text-xs font-medium text-red-700">{permissionHelp()}</span></div>}</div>}<div className="min-h-[24rem] space-y-5 rounded-3xl bg-[#F6F4EE] p-4 sm:p-6">{messages.length === 0 && <div className="flex min-h-[20rem] items-center justify-center text-center"><div className="max-w-md"><div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-[#1E2A3D] text-lg font-black text-[#E8A23D]">LQ</div><p className="mt-5 text-xs font-black uppercase tracking-[0.18em] text-[#9A5D00]">Your room is open</p><h2 className="mt-2 text-2xl font-black text-[#172033]">What would you like to understand first?</h2><p className="mt-3 text-sm leading-7 text-[#6F6A60]">Speak into the microphone, or type a question below. The tutor will guide the lesson instead of dropping a wall of notes.</p></div></div>}{messages.map((message, index) => <div key={message.id ?? `${message.role}-${index}`} className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}><div className={`max-w-[94%] rounded-3xl p-4 sm:max-w-[82%] sm:p-5 ${message.role === 'user' ? 'rounded-br-md bg-[#1E2A3D] text-white shadow-md' : 'rounded-bl-md border border-[#E1DDD2] bg-white text-[#27231D] shadow-sm'}`}>{message.role === 'assistant' ? <div className="prose prose-sm max-w-none leading-7 prose-headings:text-[#172033] prose-strong:text-[#B17118]"><ReactMarkdown remarkPlugins={[remarkGfm]}>{message.content || 'Listening and thinking…'}</ReactMarkdown></div> : <p className="text-sm font-medium leading-7">{message.content}</p>}</div></div>)}{loading && <div className="flex justify-start"><div className="flex items-center gap-2 rounded-3xl rounded-bl-md border border-[#E1DDD2] bg-white p-4 shadow-sm"><span className="h-2.5 w-2.5 animate-bounce rounded-full bg-[#E8A23D]" /><span className="h-2.5 w-2.5 animate-bounce rounded-full bg-[#E8A23D] [animation-delay:100ms]" /><span className="h-2.5 w-2.5 animate-bounce rounded-full bg-[#E8A23D] [animation-delay:200ms]" /><span className="ml-2 text-xs font-bold text-[#8B8578]">LenxiQ AI is thinking…</span></div></div>}</div>{connected && <><div className="mt-4 flex items-center justify-between gap-3 rounded-xl border border-[#E4DED1] bg-[#FBFAF7] px-3 py-2 text-xs font-bold text-[#6F6A60]"><span>{voiceRecordStatus || (interimTranscript ? `Hearing: ${interimTranscript}` : 'Tap the mic to record a voice question, or type below.')}</span>{micHealth !== 'idle' && <span className={`shrink-0 ${micHealth === 'capturing' ? 'text-emerald-700' : micHealth === 'silent' ? 'text-amber-700' : 'text-[#8B8578]'}`}>{micStatusText}</span>}</div><form onSubmit={askByText} className="mt-3 flex items-end gap-1 rounded-2xl border border-[#CFC8B9] bg-white p-2 shadow-sm focus-within:border-[#E8A23D] focus-within:ring-2 focus-within:ring-[#E8A23D]/20"><button type="button" onClick={() => void toggleDictation()} className={`mb-1 flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${isRecordingVoice || isDictating ? 'bg-red-100 text-red-700' : 'text-[#6F6A60] hover:bg-[#F6F4EE] hover:text-[#172033]'}`} aria-label="Record a voice question" title="Record a voice question"><MicIcon active={isRecordingVoice || isDictating} /></button><textarea value={currentInput} onChange={(event) => setCurrentInput(event.target.value)} placeholder={isRecordingVoice ? 'Recording… tap the mic to stop' : isDictating ? 'Browser voice typing…' : 'Ask a follow-up question by text…'} className="max-h-40 min-h-[44px] w-full resize-none bg-transparent px-3 py-3 text-base font-medium leading-6 text-[#27231D] outline-none placeholder:text-[#9A9386]" rows={1} onKeyDown={(event) => { if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); void askByText(); } }} /><button type="submit" disabled={loading || !currentInput.trim()} className="mb-1 mr-1 flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#E8A23D] font-bold text-[#172033] shadow-sm hover:bg-amber-500 disabled:cursor-not-allowed disabled:opacity-40" aria-label="Ask LenxiQ AI" title="Ask LenxiQ AI"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5"><path d="M3.478 2.404a.75.75 0 0 0-.926.941l2.432 7.905H13.5a.75.75 0 0 1 0 1.5H4.984l-2.432 7.905a.75.75 0 0 0 .926.94 60.519 60.519 0 0 0 18.445-8.986.75.75 0 0 0 0-1.218A60.517 60.517 0 0 0 3.478 2.404Z" /></svg></button></form></>}</div>}
        </section>
        <aside className="space-y-5"><div className="rounded-3xl border border-[#DED9CC] bg-[#FBFAF7] p-5 shadow-sm"><div className="flex items-start justify-between gap-3"><div><p className="text-xs font-black uppercase tracking-[0.18em] text-[#9A5D00]">Learning ambience</p><h2 className="mt-2 text-xl font-black text-[#172033]">A calm background, not noise.</h2></div><button type="button" onClick={() => void toggleAmbient()} aria-pressed={ambientEnabled} className={`rounded-xl px-3 py-2 text-xs font-black ${ambientEnabled ? 'bg-[#1E2A3D] text-white' : 'border border-[#CFC8B9] bg-white text-[#514D45]'}`}>{ambientEnabled ? 'On' : 'Off'}</button></div><p className="mt-3 text-sm leading-6 text-[#6F6A60]">Tap a soundscape after the page loads. The control below is a real speaker test; it reports playback only after the audio element is moving.</p><p className="mt-3 text-xs font-black text-[#5B3B0C]" aria-live="polite">{soundscapeStatus}</p><div className="mt-4 space-y-2">{SOUNDSCAPES.map((soundscape) => <button key={soundscape.id} type="button" onClick={() => void selectSoundscape(soundscape.id)} className={`w-full rounded-2xl border p-3 text-left transition ${soundscape.id === soundscapeId ? 'border-[#1E2A3D] bg-[#F2EEE5] shadow-sm' : 'border-[#E1DDD2] bg-white hover:bg-[#F8F6F0]'}`}><span className="block text-sm font-black text-[#27231D]">{soundscape.label}</span><span className="mt-1 block text-xs leading-5 text-[#8B8578]">{soundscape.description}</span></button>)}</div><div className="mt-4"><div className="flex items-center justify-between text-xs font-bold text-[#8B8578]"><span>Speaker level</span><span>{Math.round(soundscapeVolume * 100)}%</span></div><input aria-label="Soundscape speaker level" type="range" min="0.08" max="0.35" step="0.01" value={soundscapeVolume} onChange={(event) => { const value = Number(event.target.value); setSoundscapeVolume(value); if (ambientAudioRef.current) ambientAudioRef.current.volume = value; setSoundscapeStatus(soundPlaying ? `${ambientTrack.label} is playing · ${Math.round(value * 100)}% volume` : 'Ambience is off'); }} className="mt-2 w-full accent-[#E8A23D]" /></div><button type="button" onClick={() => void toggleAmbient()} className="mt-4 w-full rounded-xl bg-[#E8A23D] px-4 py-3 text-sm font-black text-[#172033] hover:bg-amber-500">{soundPlaying ? 'Pause sound test' : 'Test sound on speaker'}</button></div><div className="rounded-3xl border border-[#DED9CC] bg-[#FBFAF7] p-5 shadow-sm"><p className="text-xs font-black uppercase tracking-[0.18em] text-[#9A5D00]">Your access</p>{quota?.isUnlimited ? <><h2 className="mt-2 text-xl font-black text-[#172033]">Unlimited Live Class</h2><p className="mt-2 text-sm leading-6 text-[#6F6A60]">Your paid or admin access has no monthly Live Class cap.</p></> : <><h2 className="mt-2 text-xl font-black text-[#172033]">3 free rooms each month</h2><p className="mt-2 text-sm leading-6 text-[#6F6A60]">Each free room lasts up to 10 minutes. Your saved conversation remains available in History after you leave.</p></>}</div><div className="rounded-3xl border border-[#DED9CC] bg-[#1E2A3D] p-5 text-white shadow-sm"><p className="text-xs font-black uppercase tracking-[0.18em] text-[#E8A23D]">A tutor who listens</p><p className="mt-3 text-sm leading-7 text-slate-200">The voice tutor is interruption-aware. If you begin speaking while it is explaining, it yields and responds to your question instead of continuing a script.</p></div></aside>
      </div>
    </main>
    <audio ref={ambientAudioRef} src={ambientTrack.src} loop preload="auto" controls playsInline onError={() => { setSoundPlaying(false); setAmbientEnabled(false); setSoundscapeStatus('Audio could not be decoded by this browser. Try Chrome or Safari and check media volume.'); }} className="mx-auto mt-4 h-10 w-full max-w-sm rounded-xl" aria-label={`${ambientTrack.label} learning soundscape`} />
    <div ref={audioContainerRef} className="sr-only" aria-live="polite" />
  </div>;
}

export default function VoiceTutorPage() {
  return <Suspense fallback={<div className="flex min-h-[calc(100vh-4.5rem)] items-center justify-center text-sm font-bold text-slate-500">Loading Live Class…</div>}><VoiceTutorContent /></Suspense>;
}
