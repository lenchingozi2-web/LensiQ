'use client';

import { useCallback } from 'react';
import AnatomyCanvas from '@/components/studio/canvas/AnatomyCanvas';
import ConceptCardCanvas from '@/components/studio/canvas/ConceptCardCanvas';
import MedicalMediaViewer from '@/components/studio/canvas/MedicalMediaViewer';
import { useLiveKitDataChannel } from '@/components/studio/hooks/useLiveKitDataChannel';

export default function CanvasStateRenderer() {
  const handleDataChannelError = useCallback((error: Error) => {
    console.error('Studio canvas data-channel error:', error);
  }, []);
  const { commands } = useLiveKitDataChannel(handleDataChannelError);
  const command = commands[commands.length - 1];

  if (!command) {
    return (
      <div className="flex h-full w-full items-center justify-center bg-[radial-gradient(circle_at_50%_35%,#233955_0%,#101827_46%,#070b13_100%)] p-8 text-center text-white/60">
        <div>
          <div className="mx-auto flex h-28 w-28 items-center justify-center rounded-full border border-[#E8A23D]/40 bg-[#E8A23D]/10 text-2xl font-black text-[#E8A23D] shadow-[0_0_80px_rgba(232,162,61,0.14)]">LQ</div>
          <p className="mt-5 text-xs font-black uppercase tracking-[0.24em]">Studio canvas</p>
          <p className="mt-2 max-w-xs text-sm">Your anatomy model, medical image, or concept card will appear here.</p>
        </div>
      </div>
    );
  }

  switch (command.type) {
    case 'show_3d_model':
      return <AnatomyCanvas modelUrl={command.modelUrl} />;
    case 'show_supabase_image':
      return <MedicalMediaViewer bucket={command.bucket} path={command.path} alt={command.alt} caption={command.caption} />;
    case 'show_concept_card':
      return <ConceptCardCanvas title={command.title} markdown={command.markdown} />;
    case 'highlight_structure':
      return (
        <div className="flex h-full w-full items-center justify-center bg-[#101827] p-8 text-center text-white/70">
          <p className="max-w-md text-sm">Structure highlight requested for <span className="font-black text-[#E8A23D]">{command.structureId}</span>. Load a 3D model to inspect it.</p>
        </div>
      );
  }
}
