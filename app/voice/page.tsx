"use client";

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { createLocalTracks, Room, RoomEvent, Track } from 'livekit-client';

export default function VoiceTutorPage() {
  const [connected, setConnected] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [status, setStatus] = useState('Ready to start a live voice session.');
  const [error, setError] = useState('');
  const roomRef = useRef<Room | null>(null);
  const audioContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    return () => {
      roomRef.current?.disconnect();
      roomRef.current = null;
    };
  }, []);

  const attachAudioTrack = (track: Track) => {
    if (!audioContainerRef.current || track.kind !== Track.Kind.Audio) return;
    const element = track.attach();
    element.autoplay = true;
    element.setAttribute('aria-hidden', 'true');
    audioContainerRef.current.appendChild(element);
  };

  const clearAttachedAudio = () => {
    if (audioContainerRef.current) audioContainerRef.current.replaceChildren();
  };

  const startSession = async () => {
    if (connecting || connected) return;
    setConnecting(true);
    setError('');
    setStatus('Requesting a secure voice room…');

    try {
      const response = await fetch('/api/voice/token', { method: 'POST' });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || 'Unable to start voice tutoring.');

      const room = new Room({ adaptiveStream: true, dynacast: true });
      room.on(RoomEvent.TrackSubscribed, (track) => attachAudioTrack(track));
      room.on(RoomEvent.TrackUnsubscribed, (track) => track.detach());
      room.on(RoomEvent.Disconnected, () => {
        roomRef.current = null;
        clearAttachedAudio();
        setConnected(false);
        setStatus('Voice session ended.');
      });

      await room.connect(data.url, data.token);
      const localTracks = await createLocalTracks({ audio: true, video: false });
      for (const localTrack of localTracks) await room.localParticipant.publishTrack(localTrack);

      roomRef.current = room;
      setConnected(true);
      setStatus('Connected. The voice tutor can now hear your microphone.');
    } catch (sessionError) {
      setError(sessionError instanceof Error ? sessionError.message : 'Unable to start voice tutoring.');
      setStatus('Voice session could not be started.');
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
    setStatus('Voice session ended.');
  };

  return (
    <main className="min-h-[calc(100vh-64px)] bg-slate-50 px-4 py-8 sm:px-6 sm:py-12">
      <div className="mx-auto max-w-4xl">
        <Link href="/teach" className="text-sm font-bold text-slate-500 hover:text-slate-900">← Back to Teaching Room</Link>
        <div className="mt-6 overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-xl">
          <div className="bg-gradient-to-br from-[#0B1220] via-slate-900 to-[#1c2d46] p-8 text-white sm:p-12">
            <p className="text-xs font-black uppercase tracking-[0.24em] text-[#E8A23D]">Live learning</p>
            <h1 className="mt-4 text-4xl font-black tracking-tight sm:text-5xl">Voice Tutor</h1>
            <p className="mt-5 max-w-2xl text-lg leading-8 text-slate-300">Speak naturally with the LenxiQ tutor. Your browser receives only a short-lived room token; provider credentials remain on the server.</p>
          </div>
          <div className="grid gap-8 p-8 sm:p-12 lg:grid-cols-[1fr_280px]">
            <section>
              <div className={`rounded-2xl border p-5 ${connected ? 'border-emerald-200 bg-emerald-50' : 'border-slate-200 bg-slate-50'}`}>
                <div className="flex items-center gap-3">
                  <span className={`h-3 w-3 rounded-full ${connected ? 'bg-emerald-500 animate-pulse' : 'bg-slate-300'}`} />
                  <p className="font-bold text-slate-900">{status}</p>
                </div>
                {error && <p className="mt-3 text-sm font-medium text-red-700">{error}</p>}
              </div>
              <div className="mt-6 flex flex-wrap gap-3">
                {!connected ? (
                  <button type="button" onClick={() => void startSession()} disabled={connecting} className="rounded-xl bg-[#E8A23D] px-6 py-3 font-black text-[#0B1220] shadow-md hover:bg-amber-500 disabled:cursor-not-allowed disabled:opacity-50">
                    {connecting ? 'Connecting…' : 'Start voice session'}
                  </button>
                ) : (
                  <button type="button" onClick={endSession} className="rounded-xl bg-red-600 px-6 py-3 font-black text-white shadow-md hover:bg-red-700">End session</button>
                )}
                <Link href="/teach" className="rounded-xl border border-slate-300 px-6 py-3 font-bold text-slate-700 hover:bg-slate-50">Use text teaching</Link>
              </div>
              <div ref={audioContainerRef} className="sr-only" aria-live="polite" />
            </section>
            <aside className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
              <h2 className="font-black text-slate-900">Voice foundation</h2>
              <ul className="mt-4 space-y-3 text-sm leading-6 text-slate-600">
                <li>Secure LiveKit room transport</li>
                <li>Browser microphone capture</li>
                <li>Remote tutor audio playback</li>
                <li>Server-side STT/TTS agent integration ready</li>
              </ul>
              <p className="mt-5 border-t border-slate-200 pt-4 text-xs leading-5 text-slate-500">The realtime agent must be deployed separately and configured with Deepgram and Cartesia credentials before it can respond with speech.</p>
            </aside>
          </div>
        </div>
      </div>
    </main>
  );
}
