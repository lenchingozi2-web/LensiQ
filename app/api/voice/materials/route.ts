import { NextResponse } from 'next/server';
import pdfParse from 'pdf-parse';
import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/service';

const BUCKET = 'ephemeral_class_materials';
const MAX_FILE_BYTES = 10 * 1024 * 1024;

export async function DELETE() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Not authenticated.' }, { status: 401 });
  const service = createServiceClient();
  const { data: objects, error: listError } = await service.storage.from(BUCKET).list(user.id, { limit: 1000 });
  if (listError) return NextResponse.json({ error: 'Unable to clean up temporary class files.' }, { status: 503 });
  const paths = (objects ?? []).map((object) => `${user.id}/${object.name}`);
  if (paths.length) {
    const { error: removeError } = await service.storage.from(BUCKET).remove(paths);
    if (removeError) return NextResponse.json({ error: 'Unable to clean up temporary class files.' }, { status: 503 });
  }
  return NextResponse.json({ ok: true, deleted: paths.length });
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Not authenticated.' }, { status: 401 });

  const formData = await request.formData();
  const file = formData.get('file');
  if (!(file instanceof File) || file.size <= 0 || file.size > MAX_FILE_BYTES) {
    return NextResponse.json({ error: 'Each class file must be between 1 byte and 10 MB.' }, { status: 400 });
  }

  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_').slice(-120) || 'class-material';
  const path = `${user.id}/${crypto.randomUUID()}-${safeName}`;
  const bytes = new Uint8Array(await file.arrayBuffer());
  let extractedText = '';

  if (file.type === 'application/pdf' || safeName.toLowerCase().endsWith('.pdf')) {
    extractedText = (await pdfParse(Buffer.from(bytes))).text;
  } else if (file.type === 'text/plain' || safeName.toLowerCase().endsWith('.txt')) {
    extractedText = new TextDecoder().decode(bytes);
  }

  const service = createServiceClient();
  const { error: uploadError } = await service.storage.from(BUCKET).upload(path, bytes, {
    contentType: file.type || 'application/octet-stream',
    upsert: false,
  });
  if (uploadError) {
    console.error('Ephemeral Live Class upload failed:', uploadError);
    return NextResponse.json({ error: 'Unable to store this temporary class file.' }, { status: 503 });
  }

  return NextResponse.json({
    path,
    name: file.name,
    extractedText: extractedText.replace(/\s+/g, ' ').trim().slice(0, 30000),
  });
}
