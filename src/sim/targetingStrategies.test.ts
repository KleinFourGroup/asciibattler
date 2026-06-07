import { describe, it, expect } from 'vitest';
import { getTargetingStrategy, knownTargetingIds } from './targetingStrategies';

/**
 * Registry semantics for the targeting-strategy registry (mirrors the
 * abilities-registry contract: resolve a known id, throw on an unknown one,
 * every advertised id resolves). The strategies' actual pick/stickiness
 * behavior is exercised end-to-end through `findTarget` / `updateTarget` in
 * `Targeting.test.ts`.
 */
describe('targetingStrategies registry', () => {
  it('advertises nearest and weakest', () => {
    expect(knownTargetingIds()).toEqual(expect.arrayContaining(['nearest', 'weakest']));
  });

  it('resolves a registered id to a strategy whose id matches the key', () => {
    for (const id of knownTargetingIds()) {
      expect(getTargetingStrategy(id).id).toBe(id);
    }
  });

  it('throws on an unknown targeting id', () => {
    expect(() => getTargetingStrategy('bogus')).toThrow(/no strategy registered/);
  });
});
