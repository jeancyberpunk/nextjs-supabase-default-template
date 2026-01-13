import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  cacheComponents: true,
  experimental: {
    turbo: {
      enabled: false,
    },
  },
};

export default nextConfig;
