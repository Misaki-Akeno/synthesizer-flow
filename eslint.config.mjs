// eslint.config.mjs
import { dirname } from 'path';
import { fileURLToPath } from 'url';
import { FlatCompat } from '@eslint/eslintrc';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const compat = new FlatCompat({
  baseDirectory: __dirname,
});

const eslintConfig = [
  ...compat.extends('next/core-web-vitals', 'next/typescript'),
  ...compat.extends('prettier'),
  {
    // 新增规则配置
    rules: {
      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          argsIgnorePattern: '^_', // 忽略以下划线开头的函数参数
          varsIgnorePattern: '^_', // 忽略以下划线开头的变量
          caughtErrorsIgnorePattern: '^_', // 可选：忽略 catch 的错误变量
        },
      ],
    },
  },
];

export default eslintConfig;
