import test from 'node:test';
import assert from 'node:assert/strict';
import { uploadStudyDocumentToSignedUrl } from '../lib/rag/signed-upload.ts';

test('study-document signed upload preserves the exact bucket, path, and token', async () => {
  const calls = [];
  const client = {
    storage: {
      from(bucket) {
        assert.equal(bucket, 'study-documents');
        return {
          uploadToSignedUrl(...args) {
            calls.push(args);
            return Promise.resolve({ error: null });
          },
        };
      },
    },
  };
  const file = { type: 'application/vnd.openxmlformats-officedocument.presentationml.presentation' };
  const signed = {
    path: '11111111-1111-4111-8111-111111111111/22222222-2222-4222-8222-222222222222/lecture.pptx',
    token: 'opaque-supabase-token-without-reencoding',
  };

  await uploadStudyDocumentToSignedUrl(client, signed, file);

  assert.equal(calls.length, 1);
  assert.equal(calls[0][0], signed.path);
  assert.equal(calls[0][1], signed.token);
  assert.equal(calls[0][2], file);
  assert.deepEqual(calls[0][3], { contentType: file.type, upsert: false });
});

test('study-document signed upload rejects an incomplete signed response', () => {
  const client = { storage: { from: () => ({ uploadToSignedUrl: () => Promise.resolve({ error: null }) }) } };
  assert.throws(
    () => uploadStudyDocumentToSignedUrl(client, { path: '', token: 'token' }, { type: '' }),
    /authorization is incomplete/,
  );
  assert.throws(
    () => uploadStudyDocumentToSignedUrl(client, { path: 'lecture.pptx', token: '' }, { type: '' }),
    /authorization is incomplete/,
  );
});
