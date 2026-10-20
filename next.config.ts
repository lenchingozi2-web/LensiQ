import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  experimental: { serverActions: { allowedOrigins: ["localhost:3000", "*.app.github.dev"] } },
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
