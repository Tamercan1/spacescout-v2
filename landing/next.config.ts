import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'apod.nasa.gov',
      },
      {
        protocol: 'https',
        hostname: 'images-assets.nasa.gov',
      },
      {
        protocol: 'https',
        hostname: 'epic.gsfc.nasa.gov',
      },
      {
        protocol: 'https',
        hostname: 'science.nasa.gov',
      },
    ],
  },
};

export default nextConfig;
