import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
  output: 'export',
  basePath: '/app',
  images: {
    unoptimized: true,
  },
};

export default nextConfig;
