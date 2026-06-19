import { describe, it, expect } from 'vitest';
import { SELECTION, SELECTION_STRATEGIES } from './selection';

/**
 * V1 — the selection-policy config. Structural checks on the shipped value + the
 * schema default (mechanic-style, no balance arithmetic).
 */
describe('selection config', () => {
  it('ships a valid strategy key', () => {
    expect(SELECTION_STRATEGIES).toContain(SELECTION.strategy);
  });

  it('defaults to the user-locked encounterFirst', () => {
    expect(SELECTION.strategy).toBe('encounterFirst');
  });
});
