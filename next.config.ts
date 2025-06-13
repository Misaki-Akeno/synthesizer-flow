import path from 'path';
import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // Webpack配置（用于生产构建）
  webpack: (config) => {
    config.resolve.alias = {
      ...(config.resolve.alias || {}),
      '@': path.resolve(__dirname, 'src'),
    };
    return config;
  },
  // Turbopack配置（现已稳定）
  turbopack: {
    resolveAlias: {
      '@': path.resolve(__dirname, 'src'),
    },
  },
};

export default nextConfig;
