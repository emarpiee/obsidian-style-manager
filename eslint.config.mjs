import eslint from '@eslint/js';
import tseslint from 'typescript-eslint';
import obsidianmd from 'eslint-plugin-obsidianmd';
import globals from 'globals';
import tsparser from '@typescript-eslint/parser';

export default tseslint.config(
  {
    ignores: ['src/test_archive/**', 'src/lib/**', 'coverage/**', 'node_modules/**', 'dist/**', 'temp/**', 'todo/**'],
  },
  eslint.configs.recommended,
  ...tseslint.configs.recommended,
  ...obsidianmd.configs.recommended,
  {
    files: ['**/*.ts', '**/*.tsx'],
    languageOptions: {
      parser: tsparser,
      parserOptions: {
        project: './tsconfig.json',
      },
      ecmaVersion: 2018,
      sourceType: 'module',
      globals: {
        ...globals.browser,
        ...globals.node,
        ...globals.jest,
        ...globals.es2015,
        Atomics: 'readonly',
        SharedArrayBuffer: 'readonly',
      },
    },
    rules: {
      '@typescript-eslint/explicit-function-return-type': 'error',
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-empty-function': 'off',
      '@typescript-eslint/no-var-requires': 'off',
      '@typescript-eslint/no-use-before-define': 'off',
      '@typescript-eslint/explicit-module-boundary-types': 'error',
      '@typescript-eslint/no-this-alias': 'off',
      '@typescript-eslint/no-inferrable-types': 'off',
      '@typescript-eslint/ban-ts-comment': 'off',
      'react/no-unescaped-entities': 'off',
      'react/prop-types': 'off',
      'react/react-in-jsx-scope': 'off',
      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          caughtErrorsIgnorePattern: '^_',
        },
      ],
      'linebreak-style': ['error', 'unix'],
      indent: 'off',
      quotes: 'off',
      'no-mixed-spaces-and-tabs': 'off',
    },
  },
  {
    files: ['src/test/**/*.ts', 'src/test/**/*.tsx'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/explicit-function-return-type': 'off',
      '@typescript-eslint/explicit-module-boundary-types': 'off',
      '@typescript-eslint/no-unused-vars': 'off',
    },
  },
  {
    files: ['src/utils/Logger.ts'],
    rules: {
      'obsidianmd/rule-custom-message': 'off',
    },
  },
  {
    // StyleManagerSettingTab generates settings dynamically from parsed CSS
    // theme stylesheets at runtime — the declarative getSettingDefinitions()
    // API cannot cover this use case.
    files: ['src/ui/StyleManagerSettingTab.ts'],
    rules: {
      'obsidianmd/settings-tab/prefer-setting-definitions': 'off',
    },
  }
);
