import { NextResponse } from 'next/server';
import { createClient } from '../../../../../lib/supabase/server';

type RouteContext = { params: Promise<{ attachmentId: string }> };

export async function DELETE(_req: Request, { params }: RouteContext) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Not authenticated.' }, { status: 401 });
  const { attachmentId } = await params;

  const { data: attachment, error: attachmentError } = await supabase
    .from('teaching_attachments')
    .select('id, storage_path')
    .eq('id', attachmentId)
    .eq('user_id', user.id)
    .single();
  if (attachmentError || !attachment) return NextResponse.json({ error: 'Teaching attachment not found.' }, { status: 404 });

  const { error: storageError } = await supabase.storage.from('teaching-attachments').remove([attachment.storage_path]);
  if (storageError) return NextResponse.json({ error: 'Unable to remove the stored lecture file.' }, { status: 500 });
  const { error: deleteError } = await supabase.from('teaching_attachments').delete().eq('id', attachmentId).eq('user_id', user.id);
  if (deleteError) return NextResponse.json({ error: 'The file was removed from storage but its metadata could not be cleared. Please contact support.' }, { status: 500 });
  return NextResponse.json({ ok: true, attachmentId });
}
