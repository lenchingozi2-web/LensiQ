'use client';

import Image from 'next/image';

type MedicalMediaViewerProps = {
  bucket: string;
  path: string;
  alt: string;
  caption?: string;
};

function buildSupabaseImageUrl(bucket: string, path: string) {
  const baseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!baseUrl) return '';
  return `${baseUrl.replace(/\/$/, '')}/storage/v1/object/public/${encodeURIComponent(bucket)}/${path.split('/').map(encodeURIComponent).join('/')}`;
}

export default function MedicalMediaViewer({ bucket, path, alt, caption }: MedicalMediaViewerProps) {
  const imageUrl = buildSupabaseImageUrl(bucket, path);

  return (
    <div className="flex h-full w-full items-center justify-center p-4 sm:p-10">
      <figure className="relative h-full w-full max-w-6xl overflow-hidden rounded-[2rem] border border-white/10 bg-black/35 shadow-2xl">
        {imageUrl ? (
          <Image src={imageUrl} alt={alt} fill className="object-contain" sizes="100vw" unoptimized />
        ) : (
          <div className="flex h-full items-center justify-center p-8 text-center text-sm text-white/60">
            Medical media is not configured for this environment.
          </div>
        )}
        {caption && <figcaption className="absolute inset-x-0 bottom-0 bg-black/65 px-5 py-3 text-sm text-white/85 backdrop-blur">{caption}</figcaption>}
      </figure>
    </div>
  );
}
