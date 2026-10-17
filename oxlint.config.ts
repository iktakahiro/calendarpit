import { defineConfig } from 'oxlint';

export default defineConfig({
  categories: { correctness: 'error' },
  plugins: ['eslint', 'typescript', 'oxc', 'import'],
  env: { builtin: true, browser: true, node: true },
  ignorePatterns: [
    '**/node_modules/**',
    '**/dist/**',
    '**/.output/**',
    '**/.tanstack/**',
    '**/.turbo/**',
    '**/.calendarpit/**',
    '**/coverage/**',
    '**/*.gen.ts',
  ],
  rules: {
    'typescript/no-explicit-any': 'error',
    'no-unused-vars': [
      'error',
      { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
    ],
  },
});
