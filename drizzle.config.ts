import { loadEnvConfig } from '@next/env';
import type { Config } from 'drizzle-kit';

// 加载 .env.local 等环境变量
const projectDir = process.cwd();
loadEnvConfig(projectDir);

const config: Config = {
  schema: 'src/db/schema.ts',
  out: 'src/db/migrations',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
};

export default config;
