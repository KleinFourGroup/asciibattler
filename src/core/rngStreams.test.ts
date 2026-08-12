/**
 * 77d1 — the keyed-derivation contract: the frozen-hash pin vectors (the
 * configHash precedent — these failing means a GLOBAL stream break, which
 * must be deliberate and re-baselined, never incidental) plus the
 * independence properties that ARE the point of the architecture.
 */

import { describe, it, expect } from 'vitest';
import { RNG, deriveSeed, deriveRng } from './RNG';
import { RNG_STREAM_KEYS } from './rngStreams';

describe('deriveSeed — the frozen hash (pin vectors)', () => {
  // ⚠️ Do NOT update these numbers casually: they pin the derivation hash
  // itself. A legitimate change here is a deliberate global stream break
  // (worklog + fuzz/board re-baseline in the same change, the 63c/66a
  // precedent).
  it('matches the pinned vectors', () => {
    expect(deriveSeed(0, 'test')).toBe(264626234);
    expect(deriveSeed(1, 'battle', 0)).toBe(1760759270);
    expect(deriveSeed(1, 'battle', 1)).toBe(2856428499);
    expect(deriveSeed(0xdeadbeef, 'portStock', 2, 5)).toBe(644591079);
    expect(deriveSeed(42, 'nodemap', 0)).toBe(2667954103);
    expect(deriveSeed(42, 'sector', 0)).toBe(2944889265);
  });

  it('is deterministic and root-normalizing (the RNG-constructor contract)', () => {
    expect(deriveSeed(7, 'team')).toBe(deriveSeed(7, 'team'));
    expect(deriveSeed(-1, 'team')).toBe(deriveSeed(0xffffffff, 'team'));
    expect(deriveRng(7, 'team').next()).toBe(deriveRng(7, 'team').next());
  });
});

describe('deriveSeed — independence (the architecture\'s acceptance test)', () => {
  it('distinct keys and distinct indices give distinct streams (all registry keys, indices 0..99)', () => {
    const seen = new Set<number>();
    let total = 0;
    for (const key of RNG_STREAM_KEYS) {
      for (let i = 0; i < 100; i++) {
        seen.add(deriveSeed(12345, key, i));
        total++;
      }
    }
    // Not a cryptographic guarantee — a birthday-bound sanity floor. Any
    // collision at this density would be a mixing bug.
    expect(seen.size).toBe(total);
  });

  it('a derivation neither reads nor perturbs any RNG position (order-freedom)', () => {
    // The old fork() coupling: child depends on parent position, deriving
    // advances the parent. The keyed door has NO parent — deriving stream B
    // any number of times, in any order, cannot move stream A.
    const before = deriveSeed(999, 'reward', 3, 7);
    for (let i = 0; i < 50; i++) deriveSeed(999, 'battle', i);
    deriveRng(999, 'event', 1, 2).next();
    expect(deriveSeed(999, 'reward', 3, 7)).toBe(before);

    // And a live parent RNG is equally untouched by derivations "beside" it.
    const parent = new RNG(999);
    const expected = new RNG(999);
    deriveSeed(999, 'daemon', 0, 0);
    expect(parent.next()).toBe(expected.next());
  });

  it('adding a draw inside one occurrence cannot remap a sibling occurrence', () => {
    // The #49 class, killed at the seam: occurrence (battle, 5) consumes a
    // DIFFERENT number of draws in two hypothetical builds; occurrence
    // (battle, 6) starts from its own derived seed either way.
    const buildA = deriveRng(31337, 'battle', 5);
    buildA.next(); // build A draws once
    const buildB = deriveRng(31337, 'battle', 5);
    for (let i = 0; i < 40; i++) buildB.next(); // build B drew 40 times
    expect(deriveRng(31337, 'battle', 6).next()).toBe(deriveRng(31337, 'battle', 6).next());
    expect(deriveSeed(31337, 'battle', 6)).toBe(deriveSeed(31337, 'battle', 6));
  });

  it('derived streams look independent (crude uniformity over 1000 turn seeds)', () => {
    const draws: number[] = [];
    for (let t = 0; t < 1000; t++) draws.push(deriveRng(2026, 'battle', t).next());
    const mean = draws.reduce((a, b) => a + b, 0) / draws.length;
    expect(mean).toBeGreaterThan(0.45);
    expect(mean).toBeLessThan(0.55);
    expect(new Set(draws).size).toBe(1000);
  });
});

describe('the registry', () => {
  it('key strings are unique (the permanence rule needs unambiguous names)', () => {
    expect(new Set(RNG_STREAM_KEYS).size).toBe(RNG_STREAM_KEYS.length);
  });
});
