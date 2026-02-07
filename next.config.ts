import type { NextConfig } from "next";

const nextConfig: NextConfig = {};

// --- Landr Visual Editor: source location injection ---
const __landrOW = nextConfig.webpack;
nextConfig.webpack = (config, ctx) => {
  config.module.rules.push({
    test: /\.(tsx|jsx)$/,
    exclude: /node_modules/,
    enforce: 'pre',
    use: [process.cwd() + '/.landr/source-location-loader.js'],
  });
  return __landrOW ? __landrOW(config, ctx) : config;
};

export default nextConfig;
