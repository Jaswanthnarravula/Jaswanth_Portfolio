import nextCoreWebVitals from 'eslint-config-next/core-web-vitals';
import nextTypeScript from 'eslint-config-next/typescript';
import { boundaries } from './scripts/eslint-boundaries.mjs';

const accessibility = nextCoreWebVitals.find((entry) => entry.plugins?.['jsx-a11y'])?.plugins['jsx-a11y'];
if (!accessibility) throw new Error('Next ESLint config must register jsx-a11y.');

/** @type {import('eslint').Linter.Config[]} */
const eslintConfig = [
  {
    ignores: [
      '.next/**',
      '.next-original/**',
      '.next-production/**',
      'out/**',
      'node_modules/**',
      '.dist/**',
      'public/decoders/**',
      'next-env.d.ts',
      'coverage/**',
      'playwright-report/**',
      'test-results/**',
      '.lighthouseci/**',
      'assets-inbox/**',
    ],
  },
  ...nextCoreWebVitals,
  ...nextTypeScript,
  {
    // Pinned explicitly: eslint-plugin-react's 'detect' path calls the
    // context.getFilename() API that ESLint 10 removed.
    settings: { react: { version: '19.2' } },
  },
  {
    plugins: { architecture: { rules: { boundaries } } },
    rules: { 'architecture/boundaries': 'error' },
  },
  {
    files: ['**/*.{ts,tsx}'],
    rules: { '@typescript-eslint/no-explicit-any': 'error' },
  },
  {
    files: ['**/*.tsx'],
    rules: {
      ...accessibility.configs.strict.rules,
      // Lists styled without markers lose list semantics in WebKit/VoiceOver; the explicit role restores them.
      'jsx-a11y/no-redundant-roles': ['error', { ul: ['list'], ol: ['list'] }],
    },
  },
  {
    // In-app navigation belongs to the kernel (KernelLink + history). Page-to-page links (reader pages, errors, the
    // skip link) are deliberate full navigations, so an OS layer can never be left mounted over a reader page.
    rules: { '@next/next/no-html-link-for-pages': 'off' },
  },
  {
    files: [
      'app/**/*.{ts,tsx}',
      'components/**/*.{ts,tsx}',
      'hooks/**/*.{ts,tsx}',
      'stores/**/*.{ts,tsx}',
      'data/**/*.ts',
      'lib/**/*.{ts,tsx}',
    ],
    ignores: ['lib/kernel/**', 'lib/audio/**', 'lib/motion/**', 'lib/analytics/**'],
    rules: {
      'no-restricted-globals': [
        'error',
        'history',
        'localStorage',
        'sessionStorage',
        'AudioContext',
        'webkitAudioContext',
        'requestAnimationFrame',
        'cancelAnimationFrame',
      ],
      'no-restricted-syntax': [
        'error',
        {
          selector:
            'MemberExpression[object.name=/^(window|globalThis|self)$/][property.name=/^(history|localStorage|sessionStorage|AudioContext|webkitAudioContext|requestAnimationFrame|cancelAnimationFrame)$/]',
          message: 'Browser side effects belong in kernel, audio, motion, or analytics ports.',
        },
      ],
    },
  },
  {
    rules: {
      '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
    },
  },
  {
    // R3F builds its JSX namespace from three's classes, so lowercase intrinsics
    // like <meshStandardMaterial /> are expected rather than unknown properties.
    files: ['**/*.tsx'],
    rules: {
      'react/no-unknown-property': 'off',
    },
  },
];

export default eslintConfig;
