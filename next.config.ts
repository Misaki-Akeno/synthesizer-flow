import type { NextConfig } from 'next';
import createNextIntlPlugin from 'next-intl/plugin';

const withNextIntl = createNextIntlPlugin();

const nextConfig: NextConfig = {
  // 音频上下文包需要由 Next.js 转译，避免开发态 Source Map 与 HMR 问题。
  transpilePackages: ['standardized-audio-context'],
  // 暂不开启，修复与现有的 Route Segment Config (runtime, dynamic) 的冲突
  // cacheComponents: true,
};

export default withNextIntl(nextConfig);
