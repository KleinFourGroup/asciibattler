import { describe, it, expect } from 'vitest';
import { RNG } from '../core/RNG';
import { rollOffer } from './Recruitment';
import { ALL_ARCHETYPES, ARCHETYPE_CONFIG } from '../sim/archetypes';

describe('rollOffer', () => {
  it('defaults to 3 units', () => {
    expect(rollOffer(new RNG(1))).toHaveLength(3);
  });

  it('respects an explicit size (up to the pool size)', () => {
    expect(rollOffer(new RNG(1), 2)).toHaveLength(2);
    expect(rollOffer(new RNG(1), 5)).toHaveLength(5);
  });

  it('caps the offer at the pool size — never repeats an archetype to fill', () => {
    const offer = rollOffer(new RNG(1), ALL_ARCHETYPES.length + 5);
    expect(offer).toHaveLength(ALL_ARCHETYPES.length);
    const archetypes = offer.map((u) => u.archetype);
    expect(new Set(archetypes).size).toBe(archetypes.length);
  });

  it('produces only known archetypes', () => {
    const offer = rollOffer(new RNG(1), ALL_ARCHETYPES.length);
    for (const u of offer) {
      expect(ALL_ARCHETYPES).toContain(u.archetype);
    }
  });

  it('F1: every offer is distinct archetypes (no duplicates)', () => {
    for (let s = 0; s < 100; s++) {
      const archetypes = rollOffer(new RNG(s)).map((u) => u.archetype);
      expect(new Set(archetypes).size).toBe(archetypes.length);
    }
  });

  it('F1: the four E7 archetypes are reachable in the draft pool', () => {
    // The whole point of F1 — rogue/healer/mage/catapult must actually
    // appear, not just melee/ranged. The union over many fixed seeds is
    // deterministic, so this is a hard assertion, not a probabilistic one.
    const seen = new Set<string>();
    for (let s = 0; s < 200 && seen.size < ALL_ARCHETYPES.length; s++) {
      for (const u of rollOffer(new RNG(s))) seen.add(u.archetype);
    }
    expect([...seen].sort()).toEqual([...ALL_ARCHETYPES].sort());
  });

  it('every offered unit has its archetype baseStats verbatim (level 1)', () => {
    // Recruits default to level 1 → baseStats exactly (E3's per-stat
    // level-up rolls only kick in for level > 1, which Run threads via
    // currentFloor). An exhaustive equality check is the cleanest pin.
    const offer = rollOffer(new RNG(1), ALL_ARCHETYPES.length);
    for (const u of offer) {
      expect(u.stats).toEqual(ARCHETYPE_CONFIG[u.archetype].baseStats);
    }
  });

  it('size=1 yields a single archetype from the pool', () => {
    const offer = rollOffer(new RNG(1), 1);
    expect(offer).toHaveLength(1);
    expect(ALL_ARCHETYPES).toContain(offer[0]!.archetype);
  });

  it('size<=0 yields an empty offer', () => {
    expect(rollOffer(new RNG(1), 0)).toEqual([]);
  });

  it('same seed → same offer', () => {
    expect(rollOffer(new RNG(42))).toEqual(rollOffer(new RNG(42)));
  });
});
