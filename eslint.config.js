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
    // §54 adds src/bot: traffic scripts hold NO RNG at all by lock (pure
    // state-reads — §55 rollout-compatibility + the no-RNG-in-movement rule).
    files: ['src/sim/**/*.ts', 'src/run/**/*.ts', 'src/bot/**/*.ts'],
    rules: {
      'no-restricted-syntax': [
        'error',
        {
          selector:
            "CallExpression[callee.object.name='Math'][callee.property.name='random']",
          message:
            'Math.random() is forbidden in src/sim, src/run, and src/bot. Use an RNG instance (see src/core/RNG.ts) to keep the simulation deterministic.',
        },
      ],
    },
  },
);
