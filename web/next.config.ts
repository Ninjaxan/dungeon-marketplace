import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: 'standalone',
  async rewrites() {
    return [
      {
        source: '/ipfs/:path*',
        destination: 'https://ipfs.io/ipfs/:path*',
      },
    ];
  },
};

export default nextConfig;
