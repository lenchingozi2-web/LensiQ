export type StudyDocumentSignedUpload = {
  path: string;
  token: string;
};

type SignedUploadClient = {
  storage: {
    from: (bucket: string) => {
      uploadToSignedUrl: (
        path: string,
        token: string,
        file: Blob,
        options?: { contentType?: string; upsert?: boolean },
      ) => Promise<{ error: { message?: string } | null }>;
    };
  };
};

/** Uploads with the exact path/token pair issued by Supabase for study-documents. */
export function uploadStudyDocumentToSignedUrl(
  client: SignedUploadClient,
  signedUpload: StudyDocumentSignedUpload,
  file: Blob & { type?: string },
) {
  if (!signedUpload.path || !signedUpload.token) {
    throw new Error('Signed study-document upload authorization is incomplete');
  }

  return client.storage.from('study-documents').uploadToSignedUrl(
    signedUpload.path,
    signedUpload.token,
    file,
    { contentType: file.type || undefined, upsert: false },
  );
}
