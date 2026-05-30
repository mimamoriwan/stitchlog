import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  transpilePackages: ['@stitchlog/types', '@stitchlog/conversion-engine'],
};

export default nextConfig;
