'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useRef, useState } from 'react';
import { createLocalTracks, Room, RoomEvent, Track } from 'livekit-client';

type Mode = 'voice' | 'class';
type PermissionState = 'unknown' | 'granted' | 'denied';

type Soundscape = {
  id: string;
  label: string;
  description: string;
  src: string;
};

const SOUNDSCAPES: Soundscape[] = [
  { id: 'deep-focus', label: 'Deep Focus', description: 'Low, dark, spacious tones for sustained concentration.', src: '/audio/live-class-deep-focus.wav' },
  { id: 'warm-drift', label: 'Warm Drift', description: 'Soft rounded harmony with a gentle, cozy motion.', src: '/audio/live-class-warm-drift.wav' },
  { id: 'night-library', label: 'Night Library', description: 'Quiet, slow, grounded ambience for reflective learning.', src: '/audio/live-class-night-library.wav' },
];

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
  if (/Invalid URL|invalid.*url/i.test(message)) return 'The Live Class server address is invalid. The deployment needs a valid LiveKit WebSocket endpoint.';
  if (/Failed to fetch|signal connection|network|websocket/i.test(message)) return 'The LiveKit server could not be reached. Check your connection, then try again. If the problem continues, the LiveKit cloud endpoint needs configuration review.';
  if (/Not authenticated|authenticated/i.test(message)) return 'Sign in to LenxiQ AI before starting Voice Tutor or Live Class.';
  return message || 'Unable to start the live learning session.';
}

function VoiceTutorContent() {
  const searchParams = useSearchParams();
  const mode: Mode = searchParams.get('mode') === 'class' ? 'class' : 'voice';
  const [connected, setConnected] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [status, setStatus] = useState('Ready to start a live voice session.');
  const [error, setError] = useState('');
  const [permissionState, setPermissionState] = useState<PermissionState>('unknown');
  const [ambientEnabled, setAmbientEnabled] = useState(false);
  const [soundscapeId, setSoundscapeId] = useState('deep-focus');
  const [soundscapeStatus, setSoundscapeStatus] = useState('Ambience off');
  const roomRef = useRef<Room | null>(null);
  const ambientAudioRef = useRef<HTMLAudioElement>(null);
  const audioContainerRef = useRef<HTMLDivElement>(null);
  const ambientTrack = SOUNDSCAPES.find((soundscape) => soundscape.id === soundscapeId) ?? SOUNDSCAPES[0];

  useEffect(() => () => {
    roomRef.current?.disconnect();
    roomRef.current = null;
    ambientAudioRef.current?.pause();
  }, []);

  useEffect(() => {
    if (mode !== 'class') ambientAudioRef.current?.pause();
  }, [mode]);

  const attachAudioTrack = (track: Track) => {
    if (!audioContainerRef.current || track.kind !== Track.Kind.Audio) return;
    const element = track.attach();
    element.autoplay = true;
    element.setAttribute('aria-hidden', 'true');
    audioContainerRef.current.appendChild(element);
  };

  const clearAttachedAudio = () => audioContainerRef.current?.replaceChildren();

  const requestMicrophonePermission = async () => {
    if (!navigator.mediaDevices?.getUserMedia) {
      setPermissionState('denied');
      setError(`This browser does not provide microphone access. Open LenxiQ AI in a current Chrome or Safari browser over HTTPS.`);
      return false;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
      stream.getTracks().forEach((track) => track.stop());
      setPermissionState('granted');
      setError('');
      setStatus('Microphone is ready. You can enter the live classroom.');
      return true;
    } catch (permissionError) {
      setPermissionState('denied');
      setStatus('Microphone permission is required before joining.');
      setError(friendlySessionError(permissionError));
      return false;
    }
  };

  useEffect(() => {
    const handleResume = () => {
      if (document.visibilityState === 'visible' && permissionState === 'denied') {
        setStatus('Welcome back to LenxiQ AI. Checking microphone access…');
        void requestMicrophonePermission();
      }
    };
    window.addEventListener('focus', handleResume);
    document.addEventListener('visibilitychange', handleResume);
    return () => {
      window.removeEventListener('focus', handleResume);
      document.removeEventListener('visibilitychange', handleResume);
    };
  }, [permissionState]);

  const openDeviceSettings = () => {
    setStatus(`Open ${platformName()} settings, allow microphone access for your browser, then return to LenxiQ AI.`);
    if (/Android/i.test(navigator.userAgent)) {
      window.location.href = 'intent://settings#Intent;scheme=android-app;package=com.android.settings;end';
    } else if (/iPhone|iPad|iPod/i.test(navigator.userAgent)) {
      window.location.href = 'app-settings:';
    } else {
      setError(permissionHelp());
    }
  };

  const showPermissionHelp = () => {
    setPermissionState('denied');
    setStatus('Allow microphone access in phone settings, return to LenxiQ AI, and check again.');
    setError(permissionHelp());
  };

  const playSoundscape = async (selected: Soundscape) => {
    const audio = ambientAudioRef.current;
    if (!audio) throw new Error('The soundscape player is not available yet.');
    audio.pause();
    audio.src = selected.src;
    audio.load();
    audio.currentTime = 0;
    audio.volume = 0.055;
    await audio.play();
    setAmbientEnabled(true);
    setSoundscapeStatus(`${selected.label} is playing softly`);
  };

  const toggleAmbient = async () => {
    const audio = ambientAudioRef.current;
    if (!audio) return;
    setError('');
    if (ambientEnabled) {
      audio.pause();
      setAmbientEnabled(false);
      setSoundscapeStatus('Ambience off');
      return;
    }
    try {
      await playSoundscape(ambientTrack);
    } catch {
      setAmbientEnabled(false);
      setSoundscapeStatus('Tap a soundscape again to start ambience');
      setError('The soundscape could not start. Tap the selected soundscape again to allow audio.');
    }
  };

  const selectSoundscape = async (id: string) => {
    const selected = SOUNDSCAPES.find((soundscape) => soundscape.id === id) ?? SOUNDSCAPES[0];
    setSoundscapeId(selected.id);
    setError('');
    try {
      await playSoundscape(selected);
    } catch {
      setAmbientEnabled(false);
      setSoundscapeStatus(`${selected.label} selected — tap again to play`);
      setError('The soundscape was selected but did not start. Tap it again to allow audio.');
    }
  };

  const startSession = async () => {
    if (connecting || connected) return;
    setConnecting(true);
    setError('');
    setStatus(mode === 'class' ? 'Preparing your live classroom…' : 'Requesting a secure voice room…');
    try {
      const response = await fetch('/api/voice/token', { method: 'POST' });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || 'Unable to create a secure live session.');
      const microphoneReady = await requestMicrophonePermission();
      if (!microphoneReady) return;
      const room = new Room({ adaptiveStream: true, dynacast: true });
      room.on(RoomEvent.TrackSubscribed, (track) => attachAudioTrack(track));
      room.on(RoomEvent.TrackUnsubscribed, (track) => track.detach());
      room.on(RoomEvent.Disconnected, () => {
        roomRef.current = null;
        clearAttachedAudio();
        setConnected(false);
        setStatus('Live session ended.');
      });
      const livekitUrl = typeof data.url === 'string' ? data.url.trim() : '';
      if (!/^wss?:\/\//i.test(livekitUrl)) throw new Error('Invalid LiveKit server URL returned by the secure session endpoint.');
      await room.connect(livekitUrl, data.token);
      const localTracks = await createLocalTracks({
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
        video: false,
      });
      for (const localTrack of localTracks) await room.localParticipant.publishTrack(localTrack);
      roomRef.current = room;
      setConnected(true);
      if (mode === 'class' && ambientEnabled && ambientAudioRef.current) {
        ambientAudioRef.current.volume = 0.055;
        void ambientAudioRef.current.play().catch(() => {
          setAmbientEnabled(false);
          setSoundscapeStatus('Tap a soundscape to start ambience');
          setError('Live Class connected. Select a soundscape if you want optional background ambience.');
        });
      }
      setStatus(mode === 'class' ? 'You are connected to the live classroom.' : 'Connected. The voice tutor can now hear your microphone.');
    } catch (sessionError) {
      setError(friendlySessionError(sessionError));
      setStatus('The session could not be started.');
      roomRef.current?.disconnect();
      roomRef.current = null;
    } finally {
      setConnecting(false);
    }
  };

  const endSession = () => {
    roomRef.current?.disconnect();
    roomRef.current = null;
    clearAttachedAudio();
    ambientAudioRef.current?.pause();
    if (ambientAudioRef.current) ambientAudioRef.current.currentTime = 0;
    setConnected(false);
    setStatus('Live session ended.');
  };

  const isClass = mode === 'class';
  return <div className="min-h-[calc(100vh-4.5rem)] bg-[#F6F8FB] px-4 py-8 sm:px-6 sm:py-12 lg:px-8"><div className="mx-auto max-w-6xl"><div className="mb-6 flex flex-wrap items-center justify-between gap-3"><Link href="/teach" className="text-sm font-black text-slate-500 hover:text-[#0B1220]">← Back to Teaching Room</Link><span className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-black uppercase tracking-[0.14em] text-slate-500">Live learning</span></div><div className="overflow-hidden rounded-[2rem] border border-slate-200 bg-white shadow-xl"><div className="grid gap-0 lg:grid-cols-[1.1fr_0.9fr]"><section className="bg-[#0B1220] p-7 text-white sm:p-10 lg:p-12"><p className="text-xs font-black uppercase tracking-[0.24em] text-[#E8A23D]">LenxiQ AI realtime</p><h1 className="mt-5 max-w-xl text-4xl font-black leading-tight tracking-[-0.04em] sm:text-5xl">{isClass ? 'A live classroom for guided learning.' : 'A tutor you can speak to.'}</h1><p className="mt-5 max-w-xl text-base leading-8 text-slate-300">{isClass ? 'Enter a guided live session that makes difficult concepts feel understandable and memorable. Exam questions become checkpoints inside a warm, interactive lesson, while your microphone permission is requested before the room opens.' : 'Speak naturally with the LenxiQ AI medical tutor. Use your voice for explanations, recall, and follow-up questions while your session remains secured by a short-lived room token.'}</p><div className="mt-8 flex flex-wrap gap-3 text-xs font-bold text-slate-300"><span className="rounded-full border border-white/15 bg-white/10 px-3 py-2">LiveKit room</span><span className="rounded-full border border-white/15 bg-white/10 px-3 py-2">Phone microphone access</span><span className="rounded-full border border-white/15 bg-white/10 px-3 py-2">Secure session token</span></div></section><section className="p-5 sm:p-8 lg:p-10"><div className="grid grid-cols-2 rounded-2xl bg-slate-100 p-1"><Link href="/voice" className={`rounded-xl px-3 py-3 text-center text-sm font-black ${!isClass ? 'bg-white text-[#0B1220] shadow-sm' : 'text-slate-500 hover:text-slate-900'}`}>Voice Tutor</Link><Link href="/voice?mode=class" className={`rounded-xl px-3 py-3 text-center text-sm font-black ${isClass ? 'bg-white text-[#0B1220] shadow-sm' : 'text-slate-500 hover:text-slate-900'}`}>Live Class</Link></div>{isClass && <div className="mt-5 rounded-2xl border border-indigo-200 bg-indigo-50 p-4"><div className="flex items-start justify-between gap-4"><div><p className="text-sm font-black text-indigo-950">Choose a learning soundscape</p><p className="mt-1 text-xs leading-5 text-indigo-900/70">Optional, deep and low-volume ambience designed to stay beneath the tutor’s voice.</p><p className="mt-2 text-xs font-black text-indigo-900" aria-live="polite">{soundscapeStatus}</p></div><button type="button" onClick={() => void toggleAmbient()} aria-pressed={ambientEnabled} className={`shrink-0 rounded-xl px-3 py-2 text-xs font-black ${ambientEnabled ? 'bg-[#0B1220] text-white' : 'border border-indigo-300 bg-white text-indigo-900'}`}>{ambientEnabled ? 'On' : 'Off'}</button></div><div className="mt-4 grid gap-2 sm:grid-cols-3">{SOUNDSCAPES.map((soundscape) => <button key={soundscape.id} type="button" onClick={() => void selectSoundscape(soundscape.id)} aria-pressed={soundscape.id === soundscapeId} className={`rounded-xl border p-3 text-left transition ${soundscape.id === soundscapeId ? 'border-[#0B1220] bg-white shadow-sm' : 'border-indigo-200 bg-indigo-100/50 hover:bg-white'}`}><span className="block text-xs font-black text-indigo-950">{soundscape.label}</span><span className="mt-1 block text-[11px] leading-4 text-indigo-900/65">{soundscape.description}</span></button>)}</div></div>}<div className={`mt-6 rounded-2xl border p-5 ${connected ? 'border-emerald-200 bg-emerald-50' : 'border-slate-200 bg-slate-50'}`}><div className="flex items-center gap-3"><span className={`h-3 w-3 rounded-full ${connected ? 'animate-pulse bg-emerald-500' : 'bg-slate-300'}`} /><p className="font-bold text-slate-900">{status}</p></div>{error && <div className="mt-3 rounded-xl border border-red-200 bg-red-50 p-3 text-sm font-medium leading-6 text-red-700"><p>{error}</p>{permissionState === 'denied' && <div className="mt-3 rounded-xl border border-red-200 bg-white p-3"><p className="font-black text-red-900">Microphone blocked on this device?</p><p className="mt-1 text-xs leading-5 text-red-800">Open your phone settings, allow microphone access for {platformName()}, return to LenxiQ AI, and tap Check microphone again.</p><div className="mt-3 flex flex-wrap gap-2"><button type="button" onClick={openDeviceSettings} className="rounded-lg bg-red-700 px-3 py-2 text-xs font-black text-white hover:bg-red-800">Open phone settings</button><button type="button" onClick={() => void requestMicrophonePermission()} className="rounded-lg border border-red-300 bg-white px-3 py-2 text-xs font-black text-red-700 hover:bg-red-100">Check microphone again</button><button type="button" onClick={showPermissionHelp} className="rounded-lg border border-red-300 bg-white px-3 py-2 text-xs font-black text-red-700 hover:bg-red-100">Show steps</button></div></div>}</div>}</div><div className="mt-5 flex flex-wrap gap-3">{!connected ? <button type="button" onClick={() => void startSession()} disabled={connecting} className="rounded-xl bg-[#E8A23D] px-5 py-3.5 font-black text-[#0B1220] shadow-md hover:bg-amber-500 disabled:cursor-not-allowed disabled:opacity-50">{connecting ? 'Connecting…' : isClass ? 'Enter Live Class' : 'Start Voice Tutor'}</button> : <button type="button" onClick={endSession} className="rounded-xl bg-red-600 px-5 py-3.5 font-black text-white shadow-md hover:bg-red-700">End session</button>}<Link href="/teach" className="rounded-xl border border-slate-300 px-5 py-3.5 font-bold text-slate-700 hover:bg-slate-50">Use text teaching</Link></div><div className="mt-7 grid gap-3 border-t border-slate-200 pt-6 sm:grid-cols-3"><div><p className="text-xs font-black uppercase tracking-wider text-slate-400">01</p><p className="mt-2 text-sm font-bold text-slate-700">Choose a mode</p></div><div><p className="text-xs font-black uppercase tracking-wider text-slate-400">02</p><p className="mt-2 text-sm font-bold text-slate-700">Allow in phone settings</p></div><div><p className="text-xs font-black uppercase tracking-wider text-slate-400">03</p><p className="mt-2 text-sm font-bold text-slate-700">Return and learn aloud</p></div></div><audio ref={ambientAudioRef} src={ambientTrack.src} loop preload="metadata" className="hidden" aria-label={`${ambientTrack.label} optional learning soundscape`} /><div ref={audioContainerRef} className="sr-only" aria-live="polite" /></section></div></div></div></div>;
}

export default function VoiceTutorPage() {
  return <Suspense fallback={<div className="flex min-h-[calc(100vh-4.5rem)] items-center justify-center text-sm font-bold text-slate-500">Loading live learning…</div>}><VoiceTutorContent /></Suspense>;
}
