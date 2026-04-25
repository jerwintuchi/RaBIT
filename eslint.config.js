// @ts-check
import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import importPlugin from 'eslint-plugin-import';
import reactPlugin from 'eslint-plugin-react';
import reactHooks from 'eslint-plugin-react-hooks';
import globals from 'globals';

/**
 * Layer import rules enforcing architecture.md §4 "no upward imports".
 *
 * Dependency direction (one-way only):
 *   UI -> State -> Core -> Bridge -> (Tauri IPC -> Rust)
 *              -> Render
 *
 * `no-restricted-paths` semantics: { target, from } means
 * "files in `target` are forbidden from importing from `from`".
 */
const layerZones = [
  // UI can only reach lower layers through state/bridge.
  { target: './src/ui', from: './src/core' },
  { target: './src/ui', from: './src/render' },

  // State may depend on core/render/bridge, but never on UI.
  { target: './src/state', from: './src/ui' },

  // Core is pure — no dependencies on the UI world or the reactive state layer.
  { target: './src/core', from: './src/ui' },
  { target: './src/core', from: './src/state' },

  // Render is pure — no UI/state deps either.
  { target: './src/render', from: './src/ui' },
  { target: './src/render', from: './src/state' },

  // Bridge is IPC plumbing; it knows nothing about the layers above it.
  { target: './src/bridge', from: './src/ui' },
  { target: './src/bridge', from: './src/state' },
  { target: './src/bridge', from: './src/core' },
  { target: './src/bridge', from: './src/render' },
];

/** React is only allowed inside src/ui/. */
const nonUiLayers = ['src/core/**/*.{ts,tsx}', 'src/state/**/*.{ts,tsx}', 'src/render/**/*.{ts,tsx}', 'src/bridge/**/*.{ts,tsx}'];

export default tseslint.config(
  {
    ignores: ['dist/**', 'node_modules/**', 'src-tauri/**', '*.config.{js,ts}', 'coverage/**', 'playwright-report/**', 'scripts/**'],
  },

  js.configs.recommended,
  ...tseslint.configs.recommendedTypeChecked,

  {
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: {
        ...globals.browser,
        ...globals.es2022,
      },
      parserOptions: {
        project: './tsconfig.json',
        tsconfigRootDir: import.meta.dirname,
      },
    },

    plugins: {
      import: importPlugin,
      react: reactPlugin,
      'react-hooks': reactHooks,
    },

    settings: {
      react: { version: 'detect' },
      'import/resolver': {
        typescript: { project: './tsconfig.json' },
      },
    },

    rules: {
      // Layer-enforcement rule (architecture §4).
      'import/no-restricted-paths': ['error', { zones: layerZones }],

      // Prefer type-only imports where applicable — keeps runtime deps honest.
      '@typescript-eslint/consistent-type-imports': ['error', { prefer: 'type-imports' }],

      // React rules
      'react/react-in-jsx-scope': 'off', // not needed with jsx: 'react-jsx'
      'react/jsx-uses-react': 'off',
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',

      // General hygiene
      'no-console': ['warn', { allow: ['warn', 'error'] }],
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
    },
  },

  // Non-UI layers may not import React. (Use no-restricted-imports for package-level restriction.)
  {
    files: nonUiLayers,
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['react', 'react-dom', 'react/*', 'react-dom/*'],
              message: 'React imports are forbidden outside src/ui/. Only the UI layer may depend on React.',
            },
          ],
        },
      ],
    },
  },

  // Test files can relax a few rules.
  {
    files: ['**/*.test.{ts,tsx}', '**/*.spec.{ts,tsx}', 'tests/**/*.{ts,tsx}'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-non-null-assertion': 'off',
    },
  },
);
