import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import globals from 'globals';
export default tseslint.config(
  { ignores: ['dist/**','node_modules/**','coverage/**','tests/fixtures/**'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  { files: ['**/*.js','**/*.mjs'], languageOptions: { globals: { ...globals.node, ...globals.mocha } }, rules: { '@typescript-eslint/no-require-imports': 'off' } },
  { files: ['**/*.ts','**/*.tsx'], languageOptions: { globals: { ...globals.browser, ...globals.node } }, rules: { '@typescript-eslint/no-explicit-any': 'off', '@typescript-eslint/no-unused-vars': 'warn' } },
);
