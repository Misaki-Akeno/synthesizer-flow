import path from 'path';
import type { NextConfig } from 'next';
import createNextIntlPlugin from 'next-intl/plugin';

const withNextIntl = createNextIntlPlugin();

const nextConfig: NextConfig = {
  // 强制转译音频处理相关包，解决 Source Map 路径错误和 HMR 循环问题
  transpilePackages: [
    'standardized-audio-context',
    'openai',
    'ai',
    '@langchain/openai',
    '@langchain/core',
    'langchain',
  ],

  // Webpack配置（用于生产构建，如果回退到Webpack则生效）
  webpack: (config) => {
    config.resolve.alias = {
      ...(config.resolve.alias || {}),
      '@': path.resolve(__dirname, 'src'),
    };

    // 解决 LangChain 在客户端使用的 Node.js 模块依赖问题
    if (!config.resolve.fallback) {
      config.resolve.fallback = {};
    }
    config.resolve.fallback = {
      ...config.resolve.fallback,
      fs: false,
      net: false,
      tls: false,
      crypto: false,
      stream: false,
      http: false,
      https: false,
      zlib: false,
      path: false,
      os: false,
      'node:async_hooks': false,
    };

    return config;
  },
  // Turbopack配置
  turbopack: {
    resolveAlias: {
      '@': path.resolve(__dirname, 'src'),
      // Turbopack 不支持 boolean 禁用，此处仅保留路径别名
      // 如果出现模块缺失错误，需通过重定向到 empty 模块处理
    },
  },
  // 暂不开启，修复与现有的 Route Segment Config (runtime, dynamic) 的冲突
  // cacheComponents: true,
};

export default withNextIntl(nextConfig);
