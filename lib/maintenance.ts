import type { SupabaseClient } from '@supabase/supabase-js';
import { createServiceClient } from './supabase/service';

export async function runBillingMaintenance(client?: SupabaseClient) {
  const supabase = client ?? createServiceClient();
  const { data: resetCount, error: resetError } = await supabase.rpc('reset_due_wallets');
  if (resetError) throw resetError;

  const now = new Date().toISOString();
  const { data: expired, error: expiredError } = await supabase
    .from('teaching_conversations')
    .select('id, recording_path')
    .not('recording_path', 'is', null)
    .not('recording_expires_at', 'is', null)
    .lte('recording_expires_at', now)
    .limit(100);
  if (expiredError) throw expiredError;

  let deletedRecordings = 0;
  for (const recording of expired ?? []) {
    if (!recording.recording_path) continue;
    const { error: storageError } = await supabase.storage.from('live-class-recordings').remove([recording.recording_path]);
    if (storageError) continue;
    const { error: clearError } = await supabase
      .from('teaching_conversations')
      .update({ recording_path: null, recording_mime_type: null, recording_size_bytes: null, recording_created_at: null, recording_expires_at: null })
      .eq('id', recording.id)
      .eq('recording_path', recording.recording_path);
    if (!clearError) deletedRecordings += 1;
  }

  return { walletsReset: Number(resetCount ?? 0), recordingsDeleted: deletedRecordings, recordingsSeen: expired?.length ?? 0 };
}
