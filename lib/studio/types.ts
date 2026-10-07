// lib/studio/types.ts

export type CanvasMode = '3d' | 'image' | 'card' | 'idle';

// Commands sent from the AI Agent to the Client
export type CanvasCommand =
  | {
      version: 1;
      type: 'show_3d_model';
      modelUrl: string; // URL to the Draco-compressed .glb
      assetId?: string;
    }
  | {
      version: 1;
      type: 'highlight_structure';
      structureId: string;
      color?: string;
    }
  | {
      version: 1;
      type: 'show_supabase_image';
      bucket: string;
      path: string;
      alt: string;
      caption?: string;
    }
  | {
      version: 1;
      type: 'show_concept_card';
      title: string;
      markdown: string;
      cardId: string;
    };

// Interactions sent from the Client back to the AI Agent
export type CanvasInteraction =
  | {
      version: 1;
      type: 'structure_selected';
      structureId: string;
    }
  | {
      version: 1;
      type: 'structure_isolated';
      structureId: string;
      isolated: boolean;
    }
  | {
      version: 1;
      type: 'card_selected';
      cardId: string;
    };