import globals from 'globals';
import { baseConfig } from './base.js';

/** NestJS / worker: decorators and DI make a few base rules counterproductive. */
export default [
  ...baseConfig,
  {
    languageOptions: {
      globals: { ...globals.node },
    },
    rules: {
      /**
       * DISABLED DELIBERATELY — do not re-enable for Nest applications.
       *
       * NestJS resolves constructor dependencies from the `design:paramtypes`
       * metadata that TypeScript emits under `emitDecoratorMetadata`. That
       * metadata only contains a runtime class reference for a VALUE import.
       *
       * `consistent-type-imports` sees an injected class used only in a type
       * position and "fixes" it to `import type`, which erases the import at
       * compile time. The result is a runtime failure —
       * "Nest can't resolve dependencies of X" — that no type-check catches.
       *
       * The rule stays ON for every non-Nest package, where it is useful.
       */
      '@typescript-eslint/consistent-type-imports': 'off',

      // Nest uses parameter properties and decorator metadata extensively.
      '@typescript-eslint/no-extraneous-class': 'off',
      '@typescript-eslint/no-empty-object-type': 'off',
    },
  },
];
