'use client';

import { useMaybeRoomContext } from '@livekit/components-react';
import { RoomEvent } from 'livekit-client';
import { useCallback, useEffect, useState } from 'react';
import type { CanvasCommand, CanvasInteraction } from '@/lib/studio/types';

export const STUDIO_CANVAS_TOPIC = 'lensiq.studio.canvas';
export const STUDIO_INTERACTION_TOPIC = 'lensiq.studio.interaction';

type StudioDataChannelError = (error: Error) => void;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function isCanvasCommand(value: unknown): value is CanvasCommand {
  if (!isRecord(value) || value.version !== 1 || !isNonEmptyString(value.type)) return false;

  switch (value.type) {
    case 'show_3d_model':
      return isNonEmptyString(value.modelUrl) && (value.assetId === undefined || isNonEmptyString(value.assetId));
    case 'highlight_structure':
      return isNonEmptyString(value.structureId) && (value.color === undefined || isNonEmptyString(value.color));
    case 'show_supabase_image':
      return isNonEmptyString(value.bucket)
        && isNonEmptyString(value.path)
        && isNonEmptyString(value.alt)
        && (value.caption === undefined || typeof value.caption === 'string');
    case 'show_concept_card':
      return isNonEmptyString(value.title)
        && isNonEmptyString(value.markdown)
        && isNonEmptyString(value.cardId);
    default:
      return false;
  }
}

function isCanvasInteraction(value: CanvasInteraction): boolean {
  return value.version === 1 && (
    value.type === 'structure_selected'
      ? isNonEmptyString(value.structureId)
      : value.type === 'structure_isolated'
        ? isNonEmptyString(value.structureId) && typeof value.isolated === 'boolean'
        : isNonEmptyString(value.cardId)
  );
}

function decodeCanvasCommand(payload: Uint8Array): CanvasCommand | null {
  let value: unknown;
  try {
    value = JSON.parse(new TextDecoder().decode(payload));
  } catch {
    return null;
  }
  return isCanvasCommand(value) ? value : null;
}

export function useLiveKitDataChannel(onError?: StudioDataChannelError) {
  const room = useMaybeRoomContext();
  const [commands, setCommands] = useState<CanvasCommand[]>([]);

  useEffect(() => {
    if (!room) return;

    const handleDataReceived = (payload: Uint8Array, _participant: unknown, _kind: unknown, topic?: string) => {
      if (topic !== STUDIO_CANVAS_TOPIC) return;
      const command = decodeCanvasCommand(payload);
      if (!command) {
        onError?.(new Error('Received an invalid Studio canvas command.'));
        return;
      }
      setCommands((current) => [...current, command]);
    };

    room.on(RoomEvent.DataReceived, handleDataReceived);
    return () => {
      room.off(RoomEvent.DataReceived, handleDataReceived);
    };
  }, [onError, room]);

  const publishInteraction = useCallback(async (interaction: CanvasInteraction) => {
    if (!isCanvasInteraction(interaction)) {
      throw new Error('Cannot publish an invalid Studio canvas interaction.');
    }
    if (!room) {
      throw new Error('Cannot publish a Studio interaction before joining a LiveKit room.');
    }

    const payload = new TextEncoder().encode(JSON.stringify(interaction));
    await room.localParticipant.publishData(payload, {
      reliable: true,
      topic: STUDIO_INTERACTION_TOPIC,
    });
  }, [room]);

  const clearCommands = useCallback(() => {
    setCommands([]);
  }, []);

  return { commands, publishInteraction, clearCommands, room };
}
