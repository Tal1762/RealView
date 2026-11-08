import js from '@eslint/js';
import ts from 'typescript-eslint';
export default ts.config(
  { ignores: ['dist/**', 'dist-electron/**', 'release/**', 'node_modules/**', 'public/**'] },
  js.configs.recommended, ...ts.configs.recommended,
  { languageOptions: { globals: { console: 'readonly', process: 'readonly', URL: 'readonly', fetch: 'readonly', Buffer: 'readonly', setTimeout: 'readonly', window: 'readonly', document: 'readonly', navigator: 'readonly', DOMException: 'readonly', requestAnimationFrame: 'readonly' } }, rules: { '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }] } },
);
