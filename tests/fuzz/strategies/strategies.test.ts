/**
 * G5 — fuzz strategy policy + registry tests. Opt-in with the rest of the
 * fuzz suite (`npm run fuzz:smoke`). These pin the *decision logic* of the
 * parameterized policies (no full run needed) plus the registry's shape.
 *
 * Balance-proof: expectations derive from the config (ALL_ARCHETYPES, the
 * per-archetype baseStats, STAT_KEYS) — never hardcoded "mage has the most
 * magic" style arithmetic — so a balance/vocabulary edit doesn't churn them.
 */

import { describe, it, expect } from 'vitest';
import { RNG } from '../../../src/core/RNG';
import type { Run } from '../../../src/run/Run';
import type { MapNode } from '../../../src/run/NodeMap';
import type { UnitTemplate } from '../../../src/sim/Unit';
import {
  ALL_ARCHETYPES,
  baseStatsForArchetype,
  type Archetype,
} from '../../../src/sim/archetypes';
import {
  STAT_KEYS,
  PATH_KINDS,
  randomNode,
  randomRecruit,
  balancedArchetype,
  preferArchetype,
  maximizeStat,
  maximizeKind,
  declineBelowPower,
} from './policies';
import {
  STRATEGY_NAMES,
  DEFAULT_STRATEGY_NAMES,
  makeStrategy,
  makeAllStrategies,
} from './registry';

// ---- fixtures -------------------------------------------------------------

/** Level-1 template carrying the archetype's baseStats verbatim. */
function template(archetype: Archetype): UnitTemplate {
  return { archetype, level: 1, stats: { ...baseStatsForArchetype(archetype) }, xp: 0 };
}

function offerOf(...archetypes: Archetype[]): UnitTemplate[] {
  return archetypes.map(template);
}

/** Minimal Run stand-in exposing only the fields a given policy reads. */
function fakeRun(parts: { team?: UnitTemplate[]; nodes?: MapNode[] }): Run {
  return {
    team: parts.team ?? [],
    nodeMap: { nodes: parts.nodes ?? [] },
  } as unknown as Run;
}

const NO_RUN = fakeRun({});

// ---- node policies --------------------------------------------------------

describe('node policies', () => {
  it('randomNode reproduces rng.pick draws exactly (baseline preserved)', () => {
    const frontier = [3, 7, 9, 2];
    const got = new RNG(123);
    const ref = new RNG(123);
    for (let i = 0; i < 5; i++) {
      expect(randomNode(frontier, NO_RUN, got)).toBe(ref.pick(frontier));
    }
  });

  it('maximizeKind enters a matching-kind node when one is on the frontier', () => {
    const nodes: MapNode[] = [
      { id: 1, hop: 2, kind: 'battle' },
      { id: 2, hop: 2, kind: 'rest' },
      { id: 3, hop: 2, kind: 'battle' },
    ];
    const run = fakeRun({ nodes });
    const restPicker = maximizeKind('rest');
    // Only node 2 is a rest → always chosen, regardless of RNG.
    for (let seed = 0; seed < 10; seed++) {
      expect(restPicker([1, 2, 3], run, new RNG(seed))).toBe(2);
    }
  });

  it('maximizeKind falls back to a uniform frontier pick when no node matches', () => {
    const nodes: MapNode[] = [
      { id: 1, hop: 2, kind: 'battle' },
      { id: 2, hop: 2, kind: 'battle' },
    ];
    const run = fakeRun({ nodes });
    const restPicker = maximizeKind('rest');
    const choice = restPicker([1, 2], run, new RNG(1));
    expect([1, 2]).toContain(choice);
  });
});

// ---- recruit policies -----------------------------------------------------

describe('recruit policies', () => {
  it('randomRecruit reproduces rng.int draws exactly (baseline preserved)', () => {
    const offer = offerOf('mercenary', 'archer', 'rogue');
    const got = new RNG(99);
    const ref = new RNG(99);
    for (let i = 0; i < 5; i++) {
      expect(randomRecruit(offer, NO_RUN, got)).toBe(ref.int(0, offer.length - 1));
    }
  });

  it('balancedArchetype prefers the lowest current roster count', () => {
    // team has 2 melee + 1 ranged + 0 rogue → rogue (count 0) is the pick.
    const run = fakeRun({ team: offerOf('mercenary', 'mercenary', 'archer') });
    const offer = offerOf('mercenary', 'archer', 'rogue');
    const rogueIdx = offer.findIndex((t) => t.archetype === 'rogue');
    expect(balancedArchetype(offer, run, new RNG(5))).toBe(rogueIdx);
  });

  it('preferArchetype takes the target archetype when offered', () => {
    const target: Archetype = 'mage';
    const offer = offerOf('mercenary', 'mage', 'archer');
    const expected = offer.findIndex((t) => t.archetype === target);
    for (let seed = 0; seed < 10; seed++) {
      expect(preferArchetype(target)(offer, NO_RUN, new RNG(seed))).toBe(expected);
    }
  });

  it('preferArchetype falls back to a valid in-range index when not offered', () => {
    const offer = offerOf('mercenary', 'archer');
    const choice = preferArchetype('catapult')(offer, NO_RUN, new RNG(2));
    expect(choice).toBeGreaterThanOrEqual(0);
    expect(choice).toBeLessThan(offer.length);
  });

  it('maximizeStat picks an offer whose stat value is the offer-wide max', () => {
    // Config-derived: assert the chosen card carries the maximum of `stat`
    // across the offer, for every stat in the vocabulary. No hardcoded winner.
    const offer = offerOf(...ALL_ARCHETYPES);
    for (const stat of STAT_KEYS) {
      const max = Math.max(...offer.map((t) => t.stats[stat]));
      const idx = maximizeStat(stat)(offer, NO_RUN, new RNG(11));
      expect(idx).not.toBeNull(); // maximizeStat always picks for a non-empty offer
      expect(offer[idx!]!.stats[stat]).toBe(max);
    }
  });

  // H6b — the pass policy. Built with explicit `power` values (config-free) so
  // it pins the decline-below-threshold MECHANIC, not a balance number.
  describe('declineBelowPower (pass policy)', () => {
    const withPower = (p: number): UnitTemplate => ({
      archetype: 'mercenary',
      level: 1,
      stats: { ...baseStatsForArchetype('mercenary'), power: p },
      xp: 0,
    });

    it('returns null (PASS) when every offer is below the threshold, drawing no RNG', () => {
      const offer = [withPower(1), withPower(1)];
      const rng = new RNG(7);
      const ref = new RNG(7);
      expect(declineBelowPower(2)(offer, NO_RUN, rng)).toBeNull();
      expect(rng.toJSON()).toEqual(ref.toJSON()); // pass branch never draws
    });

    it('picks a qualifying (>= threshold) offer when one exists', () => {
      const offer = [withPower(1), withPower(3), withPower(1)];
      for (let seed = 0; seed < 10; seed++) {
        const idx = declineBelowPower(2)(offer, NO_RUN, new RNG(seed));
        expect(idx).not.toBeNull();
        expect(offer[idx!]!.stats.power).toBeGreaterThanOrEqual(2);
      }
    });
  });
});

// ---- registry -------------------------------------------------------------

describe('strategy registry', () => {
  it('registers the full G5 menu, config-derived', () => {
    // 2 baselines + one per archetype + one per stat + one per PATH_KINDS
    // entry + the H6b pass strategy + the H7a scored strategy.
    const expected = 2 + ALL_ARCHETYPES.length + STAT_KEYS.length + PATH_KINDS.length + 1 + 1;
    expect(STRATEGY_NAMES).toHaveLength(expected);
    for (const a of ALL_ARCHETYPES) expect(STRATEGY_NAMES).toContain(`recruit:${a}`);
    for (const s of STAT_KEYS) expect(STRATEGY_NAMES).toContain(`stat:${s}`);
    for (const k of PATH_KINDS) expect(STRATEGY_NAMES).toContain(`path:${k}`);
    expect(STRATEGY_NAMES).toContain('pure-random');
    expect(STRATEGY_NAMES).toContain('greedy');
    expect(STRATEGY_NAMES).toContain('pass:weak'); // H6b — opt-in only
    expect(STRATEGY_NAMES).toContain('scored'); // H7a — opt-in only
  });

  it('default sweep is the two baselines only', () => {
    expect([...DEFAULT_STRATEGY_NAMES]).toEqual(['pure-random', 'greedy']);
  });

  it('makeStrategy stamps the requested name and rejects unknowns', () => {
    for (const name of STRATEGY_NAMES) {
      expect(makeStrategy(name)!.name).toBe(name);
    }
    expect(makeStrategy('not-a-strategy')).toBeUndefined();
  });

  it('makeAllStrategies returns one instance per registered name', () => {
    expect(makeAllStrategies().map((s) => s.name)).toEqual([...STRATEGY_NAMES]);
  });
});
