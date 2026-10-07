'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { RoomContext } from '@livekit/components-react';
import { Room, RoomEvent, Track, type Participant, type TranscriptionSegment } from 'livekit-client';
import CanvasStateRenderer from '@/components/studio/canvas/CanvasStateRenderer';

type RuntimeState = 'ready' | 'connecting' | 'connected' | 'listening' | 'error' | 'ended';
type TranscriptMessage = { id: string; role: 'user' | 'assistant'; content: string };

const transcriptTopic = 'lensiq.live_class.transcript';

export default function StudioShell() {
  const roomRef = useRef<Room | null>(null);
  const microphoneRef = useRef<MediaStreamTrack | null>(null);
  const transcriptEndRef = useRef<HTMLDivElement>(null);
  const [state, setState] = useState<RuntimeState>('ready');
  const [status, setStatus] = useState('Ready for a multimodal class.');
  const [micMuted, setMicMuted] = useState(false);
  const [audioMuted, setAudioMuted] = useState(false);
  const [transcriptOpen, setTranscriptOpen] = useState(false);
  const [messages, setMessages] = useState<TranscriptMessage[]>([]);
  const [error, setError] = useState('');
  const [room, setRoom] = useState<Room | undefined>();

  const addTranscript = useCallback((role: TranscriptMessage['role'], content: string, id?: string) => {
    const text = content.trim();
    if (!text) return;
    setMessages((current) => {
      if (current.some((message) => message.id === id || (message.role === role && message.content === text))) return current;
      return [...current, { id: id ?? `${role}-${Date.now()}-${current.length}`, role, content: text }];
    });
  }, []);

  const disconnect = useCallback(() => {
    roomRef.current?.disconnect();
    microphoneRef.current?.stop();
    microphoneRef.current = null;
    document.querySelectorAll('audio[data-lensiq-studio-audio="true"]').forEach((audio) => audio.remove());
    roomRef.current = null;
    setRoom(undefined);
    setState('ended');
    setStatus('Studio session ended.');
    setMicMuted(false);
  }, []);

  useEffect(() => {
    transcriptEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => () => {
    roomRef.current?.disconnect();
  }, []);

  const connect = async () => {
    if (roomRef.current || state === 'connecting') return;
    setState('connecting');
    setError('');
    setStatus('Opening your private studio…');

    const room = new Room({ adaptiveStream: true, dynacast: true, webAudioMix: false });
    roomRef.current = room;
    room.on(RoomEvent.TrackSubscribed, (track) => {
      if (track.kind === Track.Kind.Audio) {
        const element = track.attach();
        element.autoplay = true;
        element.muted = audioMuted;
        element.dataset.lensiqStudioAudio = 'true';
        document.body.appendChild(element);
      }
    });
    room.on(RoomEvent.TranscriptionReceived, (segments: TranscriptionSegment[], participant?: Participant) => {
      segments.filter((segment) => segment.final).forEach((segment) => {
        addTranscript(participant?.isLocal ? 'user' : 'assistant', segment.text);
      });
    });
    room.on(RoomEvent.DataReceived, (payload, participant, _kind, topic) => {
      if (topic !== transcriptTopic) return;
      try {
        const data = JSON.parse(new TextDecoder().decode(payload)) as { role?: 'user' | 'assistant'; content?: string; id?: string };
        if (data.role && data.content) addTranscript(data.role, data.content, data.id);
      } catch {
        setError('The studio received an invalid transcript update.');
      }
    });
    room.on(RoomEvent.Reconnecting, () => {
      setStatus('Connection interrupted. Reconnecting…');
      setState('connecting');
    });
    room.on(RoomEvent.Reconnected, () => {
      setState('connected');
      setStatus('Studio reconnected. Your class can continue.');
    });
    room.on(RoomEvent.Disconnected, () => {
      microphoneRef.current?.stop();
      microphoneRef.current = null;
      document.querySelectorAll('audio[data-lensiq-studio-audio="true"]').forEach((audio) => audio.remove());
      roomRef.current = null;
      setRoom(undefined);
      setState('ended');
      setStatus('Studio session disconnected.');
    });

    try {
      const microphone = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
      const microphoneTrack = microphone.getAudioTracks()[0];
      if (!microphoneTrack) throw new Error('No microphone track was returned by the browser.');
      microphoneRef.current = microphoneTrack;
      const tokenResponse = await fetch('/api/voice/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ courseName: 'Live Studio', topicFocus: '' }),
      });
      const tokenData = await tokenResponse.json().catch(() => ({}));
      if (!tokenResponse.ok) throw new Error(tokenData.message || tokenData.error || 'Unable to create a studio session.');
      await room.connect(String(tokenData.url), tokenData.token);
      setRoom(room);
      await room.localParticipant.publishTrack(microphoneTrack, { source: Track.Source.Microphone });
      setState('connected');
      setStatus('Studio connected. Speak naturally to begin.');
    } catch (connectionError) {
      room.disconnect();
      roomRef.current = null;
      setState('error');
      setError(connectionError instanceof Error ? connectionError.message : 'The studio could not be opened.');
      setStatus('Unable to connect.');
    }
  };

  const toggleMicrophone = async () => {
    const room = roomRef.current;
    if (!room) return;
    const enabled = micMuted;
    await room.localParticipant.setMicrophoneEnabled(enabled);
    setMicMuted(!enabled);
    setStatus(enabled ? 'Microphone live.' : 'Microphone muted.');
  };

  const toggleAudio = () => {
    const nextMuted = !audioMuted;
    setAudioMuted(nextMuted);
    document.querySelectorAll('audio[data-lensiq-studio-audio="true"]').forEach((audio) => {
      (audio as HTMLAudioElement).muted = nextMuted;
    });
    setStatus(nextMuted ? 'Tutor audio muted.' : 'Tutor audio enabled.');
  };

  return (
    <RoomContext.Provider value={room}>
      <div className="relative min-h-[100dvh] w-screen overflow-hidden bg-[#070b13] text-white">
        <div className="absolute inset-0 z-0">
          <CanvasStateRenderer />
        </div>

      <div className="pointer-events-none absolute inset-0 z-20">
        <header className="pointer-events-auto absolute left-4 right-4 top-4 flex items-center justify-between gap-3 sm:left-6 sm:right-6">
          <div className="rounded-2xl border border-white/10 bg-slate-950/55 px-4 py-3 shadow-2xl backdrop-blur-xl">
            <p className="text-[10px] font-black uppercase tracking-[0.22em] text-[#E8A23D]">LenxiQ Live Studio</p>
            <p className="mt-1 text-sm font-bold text-white/75">Immersive medical learning</p>
          </div>
          <div className="flex items-center gap-2 rounded-2xl border border-white/10 bg-slate-950/55 px-3 py-2.5 shadow-2xl backdrop-blur-xl">
            <span className={`h-2.5 w-2.5 rounded-full ${state === 'connected' ? 'bg-emerald-400' : state === 'connecting' ? 'animate-pulse bg-amber-400' : state === 'error' ? 'bg-red-400' : 'bg-white/30'}`} />
            <span className="text-xs font-black text-white/75">{state === 'connected' ? 'Live' : state === 'connecting' ? 'Connecting' : state === 'ended' ? 'Ended' : 'Ready'}</span>
          </div>
        </header>

        <aside className="pointer-events-auto absolute bottom-4 left-4 right-4 flex flex-col gap-3 sm:bottom-6 sm:left-6 sm:right-auto sm:max-w-sm">
          <div className="rounded-3xl border border-white/10 bg-slate-950/60 p-4 shadow-2xl backdrop-blur-xl">
            <div className="flex items-center gap-3">
              <div className={`flex h-12 w-12 items-center justify-center rounded-full border ${state === 'connected' ? 'border-[#E8A23D] bg-[#E8A23D]/15' : 'border-white/15 bg-white/5'}`}>
                <span className="text-xs font-black text-[#E8A23D]">LQ</span>
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-black">Voice tutor</p>
                <p className="truncate text-xs text-white/55">{status}</p>
              </div>
            </div>
            {error && <p className="mt-3 rounded-xl border border-red-400/30 bg-red-400/10 p-3 text-xs font-semibold leading-5 text-red-200">{error}</p>}
            <div className="mt-4 flex flex-wrap gap-2">
              {state !== 'connected' ? (
                <button type="button" onClick={() => void connect()} disabled={state === 'connecting'} className="rounded-xl bg-[#E8A23D] px-4 py-2.5 text-xs font-black text-[#172033] disabled:cursor-wait disabled:opacity-60">
                  {state === 'connecting' ? 'Opening studio…' : 'Enter studio'}
                </button>
              ) : (
                <>
                  <button type="button" onClick={() => void toggleMicrophone()} className="rounded-xl border border-white/15 bg-white/10 px-3 py-2.5 text-xs font-black hover:bg-white/15">{micMuted ? 'Unmute mic' : 'Mute mic'}</button>
                  <button type="button" onClick={toggleAudio} className="rounded-xl border border-white/15 bg-white/10 px-3 py-2.5 text-xs font-black hover:bg-white/15">{audioMuted ? 'Unmute tutor' : 'Mute tutor'}</button>
                  <button type="button" onClick={disconnect} className="rounded-xl bg-red-500/80 px-3 py-2.5 text-xs font-black hover:bg-red-500">End class</button>
                </>
              )}
            </div>
          </div>
        </aside>

        <section className="pointer-events-auto absolute bottom-4 right-4 flex max-w-[min(92vw,24rem)] flex-col items-end gap-3 sm:bottom-6 sm:right-6">
          {transcriptOpen && (
            <div className="max-h-[min(60dvh,32rem)] w-full overflow-y-auto rounded-3xl border border-white/10 bg-slate-950/75 p-4 shadow-2xl backdrop-blur-xl">
              <div className="mb-3 flex items-center justify-between gap-4">
                <p className="text-xs font-black uppercase tracking-[0.18em] text-[#E8A23D]">Live transcript</p>
                <button type="button" onClick={() => setTranscriptOpen(false)} className="text-xs font-bold text-white/50 hover:text-white">Close</button>
              </div>
              {messages.length === 0 ? <p className="text-sm text-white/50">Transcript updates will appear here.</p> : messages.map((message) => (
                <p key={message.id} className="mb-3 text-sm leading-6 text-white/80"><span className="mr-2 text-[10px] font-black uppercase tracking-wider text-[#E8A23D]">{message.role}</span>{message.content}</p>
              ))}
              <div ref={transcriptEndRef} />
            </div>
          )}
          <button type="button" onClick={() => setTranscriptOpen((open) => !open)} className="rounded-2xl border border-white/10 bg-slate-950/65 px-4 py-3 text-xs font-black shadow-2xl backdrop-blur-xl hover:bg-slate-900/80">
            {transcriptOpen ? 'Hide transcript' : `Transcript${messages.length ? ` · ${messages.length}` : ''}`}
          </button>
        </section>
      </div>
      </div>
    </RoomContext.Provider>
  );
}
