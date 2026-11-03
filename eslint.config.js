import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import jsdoc from 'eslint-plugin-jsdoc';
import globals from 'globals';

export default [
  { ignores: ['node_modules/**', 'dist/**', 'coverage/**', '**/node_modules/**'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['**/*.{js,mjs,ts,tsx}'],
    languageOptions: { globals: { ...globals.browser, ...globals.node } },
    rules: {
      eqeqeq: ['error', 'always'],
      'no-var': 'error',
      'prefer-const': 'error',
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
    },
  },
  {
    files: ['**/*.{ts,tsx}'],
    plugins: { jsdoc },
    settings: { jsdoc: { mode: 'typescript' } },
    rules: {
      '@typescript-eslint/consistent-type-imports': 'error',
      'jsdoc/require-jsdoc': ['error', {
        require: { FunctionDeclaration: true, MethodDefinition: true, ClassDeclaration: false },
        contexts: ['VariableDeclarator > ArrowFunctionExpression', 'VariableDeclarator > FunctionExpression'],
        exemptEmptyFunctions: false,
      }],
      'jsdoc/require-description': 'error',
    },
  },
];
