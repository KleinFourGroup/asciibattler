import { describe, it, expect } from 'vitest';
import { RNG } from '../core/RNG';
import { rollOffer, rollArchetypeByRarity, recruitLevelBonus } from './Recruitment';
import {
  ALL_ARCHETYPES,
  DRAFTABLE_ARCHETYPES,
  DRAFTABLE_BY_TIER,
  ARCHETYPE_CONFIG,
} from '../sim/archetypes';
import { RECRUITMENT } from '../config/recruitment';
import { RARITY_TIERS, type UnitRarity } from '../config/units';

describe('rollOffer', () => {
  it('defaults to 3 units', () => {
    expect(rollOffer(new RNG(1))).toHaveLength(3);
  });

  it('respects an explicit size', () => {
    expect(rollOffer(new RNG(1), 2)).toHaveLength(2);
    expect(rollOffer(new RNG(1), 5)).toHaveLength(5);
  });

  it('§61c: no longer capped at the pool size — duplicates fill by design', () => {
    // Pigeonhole: more slots than draftable archetypes FORCES a duplicate.
    // (F1's distinct sampler capped here; the §61 kickoff lock allows dupes —
    // rolled levels/growth differentiate, the resample fallback stays unbuilt.)
    const size = DRAFTABLE_ARCHETYPES.length + 5;
    const offer = rollOffer(new RNG(1), size);
    expect(offer).toHaveLength(size);
    const archetypes = offer.map((u) => u.archetype);
    expect(new Set(archetypes).size).toBeLessThan(archetypes.length);
  });

  it('produces only draftable archetypes', () => {
    const offer = rollOffer(new RNG(1), DRAFTABLE_ARCHETYPES.length);
    for (const u of offer) {
      expect(DRAFTABLE_ARCHETYPES).toContain(u.archetype);
    }
  });

  it('F1: every draftable archetype is reachable in the draft pool', () => {
    // The whole point of F1 — rogue/healer/mage/catapult (and the §29 player
    // afflicters) must actually appear, not just melee/ranged. The union over
    // many fixed seeds is deterministic, so this is a hard assertion.
    const seen = new Set<string>();
    for (let s = 0; s < 300 && seen.size < DRAFTABLE_ARCHETYPES.length; s++) {
      for (const u of rollOffer(new RNG(s))) seen.add(u.archetype);
    }
    expect([...seen].sort()).toEqual([...DRAFTABLE_ARCHETYPES].sort());
  });

  it('§29-close: never offers an enemy disruptor or the summon-only Ghoul', () => {
    // The §29-close recruit-pool cleanup. These archetypes EXIST (cast by
    // enemies / raised by the Shaman) but are not the player's to draft. Pinned
    // explicitly — a future archetype added without `draftable:false` that leaks
    // into the offer trips this. Two complementary checks: the flag derivation
    // excludes exactly these five, and a wide deterministic seed scan never
    // surfaces one in an actual offer.
    const EXCLUDED = ['ice_mage', 'warlock', 'luminant', 'banshee', 'ghoul'] as const;
    for (const a of EXCLUDED) expect(DRAFTABLE_ARCHETYPES).not.toContain(a);
    expect(DRAFTABLE_ARCHETYPES.length).toBe(ALL_ARCHETYPES.length - EXCLUDED.length);
    const seen = new Set<string>();
    for (let s = 0; s < 300; s++) {
      for (const u of rollOffer(new RNG(s), DRAFTABLE_ARCHETYPES.length)) seen.add(u.archetype);
    }
    for (const a of EXCLUDED) expect(seen.has(a)).toBe(false);
  });

  it('every offered unit has its archetype baseStats verbatim (level 1)', () => {
    // Recruits default to level 1 → baseStats exactly (E3's per-stat
    // level-up rolls only kick in for level > 1, which Run threads via
    // currentFloor). An exhaustive equality check is the cleanest pin.
    const offer = rollOffer(new RNG(1), DRAFTABLE_ARCHETYPES.length);
    for (const u of offer) {
      expect(u.stats).toEqual(ARCHETYPE_CONFIG[u.archetype].baseStats);
    }
  });

  it('size=1 yields a single archetype from the pool', () => {
    const offer = rollOffer(new RNG(1), 1);
    expect(offer).toHaveLength(1);
    expect(DRAFTABLE_ARCHETYPES).toContain(offer[0]!.archetype);
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

/**
 * §61c — the rarity-weighted sampler. Distribution expectations are DERIVED
 * from the weights/pools passed in (the balance-proof rule — no hardcoded
 * probability arithmetic); synthetic catalogs pin the mechanics independent of
 * the live tier assignment (61d sets it, §68 tunes it).
 */
describe('§61c — rollArchetypeByRarity (pure core, synthetic catalogs)', () => {
  type Pools = Readonly<Record<UnitRarity, readonly string[]>>;
  type Weights = Readonly<Record<UnitRarity, number>>;
  const pools = (p: Partial<Record<UnitRarity, readonly string[]>>): Pools => ({
    common: [],
    uncommon: [],
    rare: [],
    legendary: [],
    ...p,
  });
  /** Expected tier share, derived the same way the sampler weighs: the tier's
   *  weight over the total across NON-EMPTY tiers. */
  const expectedShare = (tier: UnitRarity, p: Pools, w: Weights): number => {
    const nonEmpty = RARITY_TIERS.filter((t) => p[t].length > 0);
    const total = nonEmpty.reduce((acc, t) => acc + w[t], 0);
    return p[tier].length > 0 ? w[tier] / total : 0;
  };
  const W: Weights = { common: 6, uncommon: 3, rare: 2, legendary: 1 };
  const N = 20_000;
  const TOLERANCE = 0.02; // absolute share tolerance at N=20k, seeded (no flake)

  it('tier frequencies track the weights, renormalized over non-empty tiers', () => {
    // `rare` is EMPTY: its weight must drop out of the denominator entirely
    // (the renormalization proof), not dilute the others.
    const P = pools({ common: ['c1', 'c2'], uncommon: ['u1'], legendary: ['l1'] });
    const rng = new RNG(61);
    const tierCount: Record<string, number> = {};
    const archCount: Record<string, number> = {};
    for (let i = 0; i < N; i++) {
      const a = rollArchetypeByRarity(rng, P, W);
      const tier = RARITY_TIERS.find((t) => P[t].includes(a))!;
      tierCount[tier] = (tierCount[tier] ?? 0) + 1;
      archCount[a] = (archCount[a] ?? 0) + 1;
    }
    for (const t of RARITY_TIERS) {
      expect(Math.abs((tierCount[t] ?? 0) / N - expectedShare(t, P, W)), t).toBeLessThan(TOLERANCE);
    }
    expect(tierCount.rare ?? 0).toBe(0); // empty tier: never drawn
    // Within-tier uniformity: the two commons split their tier's share evenly.
    const commonShare = expectedShare('common', P, W);
    for (const a of ['c1', 'c2']) {
      expect(Math.abs((archCount[a] ?? 0) / N - commonShare / 2), a).toBeLessThan(TOLERANCE);
    }
  });

  it('a zero-weight NON-EMPTY tier is never drawn (the §64 no-commons shape)', () => {
    const P = pools({ common: ['c1'], uncommon: ['u1'] });
    const rng = new RNG(7);
    for (let i = 0; i < 2_000; i++) {
      expect(rollArchetypeByRarity(rng, P, { ...W, common: 0 })).toBe('u1');
    }
  });

  it('throws loudly when every non-empty tier has zero weight', () => {
    const P = pools({ legendary: ['l1'] });
    expect(() => rollArchetypeByRarity(new RNG(1), P, { ...W, legendary: 0 })).toThrow(
      /zero weight/,
    );
  });

  it('draws exactly 2 per call regardless of tier occupancy (the stream-shape pin)', () => {
    // One populated tier vs three: the stream must advance identically, so
    // 61d's tier assignments shift WHICH archetypes appear, never draw counts.
    const seed = 424242;
    const one = new RNG(seed);
    const many = new RNG(seed);
    rollArchetypeByRarity(one, pools({ common: ['c1'] }), W);
    rollArchetypeByRarity(many, pools({ common: ['c1'], rare: ['r1'], legendary: ['l1'] }), W);
    const ref = new RNG(seed);
    ref.next();
    ref.next();
    expect(one.toJSON()).toEqual(ref.toJSON());
    expect(many.toJSON()).toEqual(ref.toJSON());
  });

  it('consumes exactly 2 draws per slot through rollOffer at level 1', () => {
    const seed = 1234;
    const rng = new RNG(seed);
    rollOffer(rng, 3, 1); // level 1 ⇒ no bonus/level-up draws
    const ref = new RNG(seed);
    for (let i = 0; i < 3 * 2; i++) ref.next();
    expect(rng.toJSON()).toEqual(ref.toJSON());
  });

  it('the live catalog + weights satisfy the sampler precondition (boot sanity)', () => {
    // Derived entirely from config: some tier must be populated AND carry
    // weight, or every offer roll would throw.
    const nonEmpty = RARITY_TIERS.filter((t) => DRAFTABLE_BY_TIER[t].length > 0);
    const total = nonEmpty.reduce((acc, t) => acc + RECRUITMENT.rarityWeights[t], 0);
    expect(total).toBeGreaterThan(0);
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
