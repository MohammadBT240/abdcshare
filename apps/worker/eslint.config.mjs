import base from '@abdcshare/config/eslint';

export default [
  ...base,
  {
    rules: {
      // Nest DI relies on emitDecoratorMetadata: classes injected via constructor
      // params must stay VALUE imports. This rule's auto-fix converts them to
      // `import type` (erased at runtime) and breaks injection — keep it off here.
      '@typescript-eslint/consistent-type-imports': 'off',
    },
  },
];
