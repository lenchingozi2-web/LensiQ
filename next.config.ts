import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // Development-only origins must never be trusted for production Server Actions.
  ...(process.env.NODE_ENV === 'development'
    ? { experimental: { serverActions: { allowedOrigins: ['localhost:3000', '*.app.github.dev'] } } }
    : {}),
  async headers() {
    return [{
      source: '/:path*',
      headers: [
        { key: 'X-Content-Type-Options', value: 'nosniff' },
        { key: 'X-Frame-Options', value: 'DENY' },
        { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
        { key: 'Permissions-Policy', value: 'camera=(), geolocation=(), microphone=(self)' },
        { key: 'Strict-Transport-Security', value: 'max-age=31536000' },
      ],
    }];
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'hixvbcrrklyajhkyliay.supabase.co',
        pathname: '/storage/v1/object/**',
      },
      {
        protocol: 'https',
        hostname: 'files.manuscdn.com',
      },
    ],
  },
};

export default nextConfig;
