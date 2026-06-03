import { describe, it, expect } from 'vitest';
import { RNG } from '../core/RNG';
import { rollOffer, recruitLevelBonus } from './Recruitment';
import { ALL_ARCHETYPES, ARCHETYPE_CONFIG } from '../sim/archetypes';
import { RECRUITMENT } from '../config/recruitment';

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

  it('applies a flat numeric level to every card (back-compat / explicit form)', () => {
    const offer = rollOffer(new RNG(1), 3, 4);
    expect(offer.map((u) => u.level)).toEqual([4, 4, 4]);
  });

  it('resolves a level FUNCTION once per card, in order', () => {
    // Post-G5: a function `level` is drawn per card. A deterministic counter
    // (config-free) proves each card gets its own value, in iteration order.
    const seq = [1, 3, 5];
    let i = 0;
    const offer = rollOffer(new RNG(1), 3, () => seq[i++]!);
    expect(offer.map((u) => u.level)).toEqual(seq);
  });

  it('draws the geometric recruit bonus INDEPENDENTLY per card', () => {
    // Reproduce Run's recruit policy (shared base + per-card geometric bonus)
    // with explicit inputs. Under the pre-tweak single-draw-per-offer model
    // every card shared a level, so a mixed-level offer could NEVER occur;
    // seeing one proves the bonus is now per-card. chance=0.9 makes the
    // variation overwhelmingly likely, so the seed scan is a hard assertion.
    const base = 3;
    const chance = 0.9;
    let sawMixedOffer = false;
    for (let s = 0; s < 40 && !sawMixedOffer; s++) {
      const offer = rollOffer(new RNG(s), 3, (r) => base + recruitLevelBonus(r, chance));
      for (const u of offer) expect(u.level).toBeGreaterThanOrEqual(base);
      if (new Set(offer.map((u) => u.level)).size > 1) sawMixedOffer = true;
    }
    expect(sawMixedOffer).toBe(true);
  });
});

describe('recruitLevelBonus (G4 geometric bonus)', () => {
  it('matches P(+k) = (1−c)·c^k over a wide sample (derives c from config)', () => {
    const c = RECRUITMENT.recruitBonusChance;
    const N = 40000;
    const rng = new RNG(12345);
    const counts = new Map<number, number>();
    for (let i = 0; i < N; i++) {
      const b = recruitLevelBonus(rng, c);
      counts.set(b, (counts.get(b) ?? 0) + 1);
    }
    const p = (k: number) => (counts.get(k) ?? 0) / N;
    // toBeCloseTo(_, 1) → within 0.05; comfortably tighter than that at N=40k.
    expect(p(0)).toBeCloseTo(1 - c, 1);
    expect(p(1)).toBeCloseTo((1 - c) * c, 1);
    expect(p(2)).toBeCloseTo((1 - c) * c * c, 1);
  });

  it('is always ≥ 0 and deterministic per seed', () => {
    for (let s = 0; s < 50; s++) {
      const b = recruitLevelBonus(new RNG(s), RECRUITMENT.recruitBonusChance);
      expect(b).toBeGreaterThanOrEqual(0);
      expect(recruitLevelBonus(new RNG(s), RECRUITMENT.recruitBonusChance)).toBe(b);
    }
  });

  it('chance 0 always yields +0', () => {
    for (let s = 0; s < 20; s++) expect(recruitLevelBonus(new RNG(s), 0)).toBe(0);
  });
});
