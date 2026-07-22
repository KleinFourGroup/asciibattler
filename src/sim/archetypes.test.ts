import { describe, it, expect } from 'vitest';
import {
  rollUnit,
  glyphForArchetype,
  rangeForArchetype,
  minRangeForArchetype,
  targetingForArchetype,
  abilityIdsForArchetype,
  rarityForArchetype,
  ARCHETYPE_CONFIG,
  ALL_ARCHETYPES,
  DRAFTABLE_ARCHETYPES,
  DRAFTABLE_BY_TIER,
} from './archetypes';
import { RARITY_TIERS } from '../config/units';
import { damageStatFor } from './stats';
import { abilityDef } from '../config/abilities';
import { knownTargetingIds } from './targetingStrategies';
import { RNG } from '../core/RNG';

describe('archetypes / rollUnit (E1: returns baseStats verbatim, no rolls)', () => {
  it('produces a melee template equal to the configured baseStats', () => {
    const rng = new RNG(1);
    const expected = ARCHETYPE_CONFIG.mercenary.baseStats;

    for (let i = 0; i < 5; i++) {
      const t = rollUnit('mercenary', rng);
      expect(t.archetype).toBe('mercenary');
      expect(t.stats).toEqual(expected);
    }
  });

  it('produces a ranged template equal to the configured baseStats', () => {
    const rng = new RNG(1);
    const expected = ARCHETYPE_CONFIG.archer.baseStats;
    const t = rollUnit('archer', rng);
    expect(t.archetype).toBe('archer');
    expect(t.stats).toEqual(expected);
  });

  it('same seed → same template (trivially: no RNG draws today)', () => {
    const a = rollUnit('mercenary', new RNG(42));
    const b = rollUnit('mercenary', new RNG(42));
    expect(a).toEqual(b);
  });

  it('different seeds produce IDENTICAL templates today (rolls land in E3)', () => {
    // Documents the E1 contract: stats come straight from the archetype
    // config, no per-stat randomization yet. E3's `simulateLevelUps`
    // will restore the "different seed → different stats" property.
    const a = rollUnit('mercenary', new RNG(1));
    const b = rollUnit('mercenary', new RNG(2));
    expect(a).toEqual(b);
  });

  it('melee and ranged templates have non-overlapping stat profiles', () => {
    // Smoke check that the JSON wasn't accidentally symmetric.
    const m = rollUnit('mercenary', new RNG(0));
    const r = rollUnit('archer', new RNG(0));
    expect(m.stats.strength).toBeGreaterThan(r.stats.strength);
    expect(r.stats.ranged).toBeGreaterThan(m.stats.ranged);
  });
});

describe('archetypes / lookups', () => {
  it('glyphForArchetype maps to M / a', () => {
    expect(glyphForArchetype('mercenary')).toBe('M');
    expect(glyphForArchetype('archer')).toBe('a');
  });

  it('rangeForArchetype is the max over abilities (melee=1, ranged>1)', () => {
    expect(rangeForArchetype('mercenary')).toBe(1);
    expect(rangeForArchetype('archer')).toBeGreaterThan(1);
  });

  it('minRangeForArchetype is the floor of the longest-range attack (O4, config-derived)', () => {
    // Balance-proof: the engagement floor IS the attack ability's minRangeCells,
    // whether that's 0 (the O4a plumbing commit) or set (the O4b value commit).
    expect(minRangeForArchetype('archer')).toBe(abilityDef('bow').minRangeCells);
    expect(minRangeForArchetype('mage')).toBe(abilityDef('magic_bolt').minRangeCells);
    expect(minRangeForArchetype('catapult')).toBe(abilityDef('catapult_shot').minRangeCells);
    // Melee carries no floor; the rogue's `self`-target dash is excluded, so its
    // floor comes from the gambit strike, not the (longer-range) leap.
    expect(minRangeForArchetype('mercenary')).toBe(abilityDef('sword').minRangeCells);
    expect(minRangeForArchetype('rogue')).toBe(abilityDef('gambit_strike').minRangeCells);
  });
});

describe('archetypes / targeting config', () => {
  it('every archetype declares a registered targeting strategy', () => {
    const known = knownTargetingIds();
    for (const a of ALL_ARCHETYPES) {
      expect(known).toContain(ARCHETYPE_CONFIG[a].targeting);
    }
  });

  // Every archetype currently targets `nearest`. `weakest` ships as
  // dormant-but-tested infrastructure (the registry + the Targeting.test.ts
  // weakest cases): a forced-roster eval showed it HALVES the range-1 rogue's
  // damage — it chases an unreachable backline mark past adjacent enemies it
  // can't strike — so it stays unassigned until a gap-closer/ranged assassin
  // makes "dive the squishies" viable (see TODO.md "Targeting strategies").
  it('every archetype currently targets nearest', () => {
    for (const a of ALL_ARCHETYPES) {
      expect(targetingForArchetype(a)).toBe('nearest');
    }
  });

  it('neutral / unknown archetypes fall back to nearest', () => {
    // §38d — walls / half-cover (neutrals, absent from the COMBATANT catalog) get
    // the harmless default, as does any id not in the catalog (the removed
    // `=== 'environment'` sentinel guard's behavior, now via optional chaining).
    expect(targetingForArchetype('wall')).toBe('nearest');
    expect(targetingForArchetype('half_cover')).toBe('nearest');
    expect(targetingForArchetype('environment')).toBe('nearest');
  });
});

describe('archetypes / I5 melee family', () => {
  // The four melee subclasses share the melee IDENTITY — a basic strike at
  // range 1, damage off `strength` — and diverge in stat VALUES (tuned by feel,
  // NOT pinned here, per BALANCE.md). I6 split the shared `melee_strike` into a
  // per-subclass WEAPON (sword/club/katana/whip), so each now carries its own
  // strike id; this locks that structural contract (which weapon → which class).
  const MELEE_WEAPON = {
    mercenary: 'sword',
    adventurer: 'whip',
    ronin: 'katana',
    bandit: 'club',
  } as const;
  const MELEE_FAMILY = Object.keys(MELEE_WEAPON) as (keyof typeof MELEE_WEAPON)[];

  it('every melee subclass carries its I6 weapon at range 1 and strikes on strength', () => {
    for (const a of MELEE_FAMILY) {
      expect(abilityIdsForArchetype(a)).toContain(MELEE_WEAPON[a]);
      expect(rangeForArchetype(a)).toBe(1);
      const stats = rollUnit(a, new RNG(0)).stats;
      expect(damageStatFor(a, stats)).toBe(stats.strength);
    }
  });

  it('each melee subclass has its own distinct glyph (M/A/R/B)', () => {
    const glyphs = MELEE_FAMILY.map(glyphForArchetype);
    expect(new Set(glyphs).size).toBe(MELEE_FAMILY.length);
    expect(glyphs).toEqual(['M', 'A', 'R', 'B']);
  });
});

describe('archetypes / §38c damageStat (catalog-driven, byte-identical)', () => {
  // Balance-proof: `damageStatFor` now resolves the scaling stat from the
  // `UnitDef.damageStat` catalog field instead of an 18-case switch. Derive the
  // expectation from the SAME catalog the sim reads — so this pins the wiring
  // (function ⇄ config), never a hand-copied number.
  it('resolves each archetype to its configured damageStat (absent ⇒ 0)', () => {
    for (const a of ALL_ARCHETYPES) {
      const stats = rollUnit(a, new RNG(0)).stats;
      const key = ARCHETYPE_CONFIG[a].damageStat;
      expect(damageStatFor(a, stats)).toBe(key ? stats[key] : 0);
    }
  });

  // The two non-strikers carry no `damageStat` (heal / summon only) → 0, exactly
  // the old switch's explicit `return 0` cases. Documents intent, not arithmetic.
  it('non-strikers (healer, shaman) resolve to 0', () => {
    for (const a of ['healer', 'shaman'] as const) {
      expect(ARCHETYPE_CONFIG[a].damageStat).toBeUndefined();
      expect(damageStatFor(a, rollUnit(a, new RNG(0)).stats)).toBe(0);
    }
  });

  it('neutrals never strike (→ 0 via the combatant-catalog optional chain)', () => {
    // §38d — a neutral (wall / half-cover) is absent from the COMBATANT catalog,
    // so `damageStatFor` resolves to 0 for any stat block (the removed
    // `=== 'environment'` sentinel guard's behavior).
    const stats = rollUnit('mercenary', new RNG(0)).stats;
    expect(damageStatFor('wall', stats)).toBe(0);
    expect(damageStatFor('half_cover', stats)).toBe(0);
  });
});

describe('archetypes / config round-trip (every archetype)', () => {
  it('rollUnit returns the configured baseStats verbatim for all archetypes', () => {
    // Generalizes the mercenary/ranged cases above across the whole roster —
    // a level-1 roll is baseStats by reference-equality of values, no RNG draws.
    for (const a of ALL_ARCHETYPES) {
      expect(rollUnit(a, new RNG(0)).stats).toEqual(ARCHETYPE_CONFIG[a].baseStats);
    }
  });
});

describe('§61b — rarityForArchetype + DRAFTABLE_BY_TIER (derived from config)', () => {
  it('resolves every archetype to its configured tier', () => {
    for (const a of ALL_ARCHETYPES) {
      expect(rarityForArchetype(a), a).toBe(ARCHETYPE_CONFIG[a].rarity);
    }
  });

  it('maps a neutral / unknown id to the harmless common default', () => {
    // The `targetingForArchetype` optional-chain convention — never throws.
    expect(rarityForArchetype('wall')).toBe('common');
    expect(rarityForArchetype('no_such_archetype')).toBe('common');
  });

  it('partitions the draft pool: tiers are disjoint and union to DRAFTABLE_ARCHETYPES', () => {
    expect(Object.keys(DRAFTABLE_BY_TIER)).toEqual([...RARITY_TIERS]); // every tier keyed
    const flat = RARITY_TIERS.flatMap((t) => [...DRAFTABLE_BY_TIER[t]]);
    expect(flat.length).toBe(DRAFTABLE_ARCHETYPES.length); // disjoint (no double-counting)
    expect([...flat].sort()).toEqual([...DRAFTABLE_ARCHETYPES].sort()); // exact cover
    for (const t of RARITY_TIERS) {
      for (const a of DRAFTABLE_BY_TIER[t]) {
        expect(ARCHETYPE_CONFIG[a].rarity, `${t}:${a}`).toBe(t); // right bucket
        expect(ARCHETYPE_CONFIG[a].draftable, `${t}:${a}`).toBe(true); // draftable only
      }
    }
  });
});
