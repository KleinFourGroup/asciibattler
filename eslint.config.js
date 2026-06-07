import tseslint from 'typescript-eslint';
import globals from 'globals';

export default tseslint.config(
  {
    ignores: ['dist/**', 'node_modules/**', 'scratch/**', '*.glsl'],
  },
  ...tseslint.configs.recommended,
  {
    languageOptions: {
      globals: {
        ...globals.browser,
        ...globals.node,
      },
    },
    rules: {
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
    },
  },
  {
    // Determinism guard: simulation and run code must never use Math.random().
    // Any randomness must come from an RNG instance threaded through state.
    files: ['src/sim/**/*.ts', 'src/run/**/*.ts'],
    rules: {
      'no-restricted-syntax': [
        'error',
        {
          selector:
            "CallExpression[callee.object.name='Math'][callee.property.name='random']",
          message:
            'Math.random() is forbidden in src/sim and src/run. Use an RNG instance (see src/core/RNG.ts) to keep the simulation deterministic.',
        },
      ],
    },
  },
);
