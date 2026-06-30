import nextCoreWebVitals from 'eslint-config-next/core-web-vitals';
import prettierConfig from 'eslint-config-prettier';

const typescriptConfig = nextCoreWebVitals.find(
  (config) => config.name === 'next/typescript'
);

const eslintConfig = [
  {
    linterOptions: {
      reportUnusedDisableDirectives: 'off',
    },
  },
  ...nextCoreWebVitals,
  prettierConfig,
  {
    plugins: typescriptConfig?.plugins,
    rules: {
      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          caughtErrorsIgnorePattern: '^_',
        },
      ],
    },
  },
];

export default eslintConfig;
