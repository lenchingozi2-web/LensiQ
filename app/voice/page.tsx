'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useRef, useState } from 'react';
import { createLocalTracks, Room, RoomEvent, Track } from 'livekit-client';

type Mode = 'voice' | 'class';

function VoiceTutorContent() {
  const searchParams = useSearchParams();
  const mode: Mode = searchParams.get('mode') === 'class' ? 'class' : 'voice';
  const [connected, setConnected] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [status, setStatus] = useState('Ready to start a live voice session.');
  const [error, setError] = useState('');
  const roomRef = useRef<Room | null>(null);
  const audioContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => () => {
    roomRef.current?.disconnect();
    roomRef.current = null;
  }, []);

  const attachAudioTrack = (track: Track) => {
    if (!audioContainerRef.current || track.kind !== Track.Kind.Audio) return;
    const element = track.attach();
    element.autoplay = true;
    element.setAttribute('aria-hidden', 'true');
    audioContainerRef.current.appendChild(element);
  };

  const clearAttachedAudio = () => audioContainerRef.current?.replaceChildren();

  const startSession = async () => {
    if (connecting || connected) return;
    setConnecting(true);
    setError('');
    setStatus(mode === 'class' ? 'Opening your live classroom…' : 'Requesting a secure voice room…');
    try {
      const response = await fetch('/api/voice/token', { method: 'POST' });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || 'Unable to start the live learning session.');
      const room = new Room({ adaptiveStream: true, dynacast: true });
      room.on(RoomEvent.TrackSubscribed, (track) => attachAudioTrack(track));
      room.on(RoomEvent.TrackUnsubscribed, (track) => track.detach());
      room.on(RoomEvent.Disconnected, () => {
        roomRef.current = null;
        clearAttachedAudio();
        setConnected(false);
        setStatus('Live session ended.');
      });
      await room.connect(data.url, data.token);
      const localTracks = await createLocalTracks({ audio: true, video: false });
      for (const localTrack of localTracks) await room.localParticipant.publishTrack(localTrack);
      roomRef.current = room;
      setConnected(true);
      setStatus(mode === 'class' ? 'You are connected to the live classroom.' : 'Connected. The voice tutor can now hear your microphone.');
    } catch (sessionError) {
      setError(sessionError instanceof Error ? sessionError.message : 'Unable to start the live learning session.');
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
    setConnected(false);
    setStatus('Live session ended.');
  };

  const isClass = mode === 'class';
  return (
    <div className="min-h-[calc(100vh-4.5rem)] bg-[#F6F8FB] px-4 py-8 sm:px-6 sm:py-12 lg:px-8">
      <div className="mx-auto max-w-6xl">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3"><Link href="/teach" className="text-sm font-black text-slate-500 hover:text-[#0B1220]">← Back to Teaching Room</Link><span className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-black uppercase tracking-[0.14em] text-slate-500">Live learning</span></div>
        <div className="overflow-hidden rounded-[2rem] border border-slate-200 bg-white shadow-xl">
          <div className="grid gap-0 lg:grid-cols-[1.1fr_0.9fr]">
            <section className="bg-[#0B1220] p-7 text-white sm:p-10 lg:p-12">
              <p className="text-xs font-black uppercase tracking-[0.24em] text-[#E8A23D]">LenxiQ realtime</p>
              <h1 className="mt-5 max-w-xl text-4xl font-black leading-tight tracking-[-0.04em] sm:text-5xl">{isClass ? 'A live classroom for guided learning.' : 'A tutor you can speak to.'}</h1>
              <p className="mt-5 max-w-xl text-base leading-8 text-slate-300">{isClass ? 'Enter the Live Class foundation for an examiner-style, classroom-focused session. Keep your microphone ready and learn aloud.' : 'Speak naturally with the LenxiQ medical tutor. Use your voice for explanations, recall, and follow-up questions while your session remains secured by a short-lived room token.'}</p>
              <div className="mt-8 flex flex-wrap gap-3 text-xs font-bold text-slate-300"><span className="rounded-full border border-white/15 bg-white/10 px-3 py-2">LiveKit room</span><span className="rounded-full border border-white/15 bg-white/10 px-3 py-2">Microphone audio</span><span className="rounded-full border border-white/15 bg-white/10 px-3 py-2">Secure session token</span></div>
            </section>
            <section className="p-5 sm:p-8 lg:p-10">
              <div className="grid grid-cols-2 rounded-2xl bg-slate-100 p-1"><Link href="/voice" className={`rounded-xl px-3 py-3 text-center text-sm font-black ${!isClass ? 'bg-white text-[#0B1220] shadow-sm' : 'text-slate-500 hover:text-slate-900'}`}>Voice Tutor</Link><Link href="/voice?mode=class" className={`rounded-xl px-3 py-3 text-center text-sm font-black ${isClass ? 'bg-white text-[#0B1220] shadow-sm' : 'text-slate-500 hover:text-slate-900'}`}>Live Class</Link></div>
              <div className={`mt-6 rounded-2xl border p-5 ${connected ? 'border-emerald-200 bg-emerald-50' : 'border-slate-200 bg-slate-50'}`}><div className="flex items-center gap-3"><span className={`h-3 w-3 rounded-full ${connected ? 'animate-pulse bg-emerald-500' : 'bg-slate-300'}`} /><p className="font-bold text-slate-900">{status}</p></div>{error && <p className="mt-3 text-sm font-medium text-red-700">{error}</p>}</div>
              <div className="mt-5 flex flex-wrap gap-3">{!connected ? <button type="button" onClick={() => void startSession()} disabled={connecting} className="rounded-xl bg-[#E8A23D] px-5 py-3.5 font-black text-[#0B1220] shadow-md hover:bg-amber-500 disabled:cursor-not-allowed disabled:opacity-50">{connecting ? 'Connecting…' : isClass ? 'Enter Live Class' : 'Start Voice Tutor'}</button> : <button type="button" onClick={endSession} className="rounded-xl bg-red-600 px-5 py-3.5 font-black text-white shadow-md hover:bg-red-700">End session</button>}<Link href="/teach" className="rounded-xl border border-slate-300 px-5 py-3.5 font-bold text-slate-700 hover:bg-slate-50">Use text teaching</Link></div>
              <div className="mt-7 grid gap-3 border-t border-slate-200 pt-6 sm:grid-cols-3"><div><p className="text-xs font-black uppercase tracking-wider text-slate-400">01</p><p className="mt-2 text-sm font-bold text-slate-700">Choose a mode</p></div><div><p className="text-xs font-black uppercase tracking-wider text-slate-400">02</p><p className="mt-2 text-sm font-bold text-slate-700">Allow microphone</p></div><div><p className="text-xs font-black uppercase tracking-wider text-slate-400">03</p><p className="mt-2 text-sm font-bold text-slate-700">Learn aloud</p></div></div>
              <div ref={audioContainerRef} className="sr-only" aria-live="polite" />
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function VoiceTutorPage() {
  return <Suspense fallback={<div className="flex min-h-[calc(100vh-4.5rem)] items-center justify-center text-sm font-bold text-slate-500">Loading live learning…</div>}><VoiceTutorContent /></Suspense>;
}
