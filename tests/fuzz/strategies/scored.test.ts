/**
 * H7a — scored-strategy tests. Opt-in with the fuzz suite (`npm run fuzz:smoke`).
 *
 * Balance-proof: the vector dimensions + expectations derive from the live
 * constants (STAT_KEYS / ALL_ARCHETYPES / PATH_KINDS), never hardcoded balance
 * arithmetic. The path-DP + pass tests use explicit, config-free inputs so they
 * pin the MECHANIC, not a shipped number.
 */

import { describe, it, expect } from 'vitest';
import { RNG } from '../../../src/core/RNG';
import type { Run } from '../../../src/run/Run';
import type { MapNode, MapEdge } from '../../../src/run/NodeMap';
import type { UnitStats, UnitTemplate } from '../../../src/sim/Unit';
import { ALL_ARCHETYPES, baseStatsForArchetype, type Archetype } from '../../../src/sim/archetypes';
import { STAT_KEYS } from './policies';
import { scoredStrategy, selectByScore } from './scored';
import {
  parseWeights,
  serializeWeights,
  DEFAULT_SCORED_WEIGHTS,
  type ScoredWeights,
} from './scoredWeights';

// ---- fixtures -------------------------------------------------------------

function zeroWeights(): ScoredWeights {
  return {
    path: { battle: 0, rest: 0, elite: 0 },
    archetype: Object.fromEntries(ALL_ARCHETYPES.map((a) => [a, 0])) as Record<Archetype, number>,
    composition: Object.fromEntries(ALL_ARCHETYPES.map((a) => [a, 0])) as Record<Archetype, number>,
    compWeight: 0,
    level: 0,
    stats: Object.fromEntries(STAT_KEYS.map((k) => [k, 0])) as Record<keyof UnitStats, number>,
    total: 0,
    passBias: 0,
  };
}

function template(archetype: Archetype): UnitTemplate {
  return { archetype, level: 1, stats: { ...baseStatsForArchetype(archetype) }, xp: 0 };
}

function meleeWithPower(power: number): UnitTemplate {
  return { archetype: 'mercenary', level: 1, stats: { ...baseStatsForArchetype('mercenary'), power }, xp: 0 };
}

function fakeRun(parts: { team?: UnitTemplate[]; nodes?: MapNode[]; edges?: MapEdge[] }): Run {
  return {
    team: parts.team ?? [],
    nodeMap: { nodes: parts.nodes ?? [], edges: parts.edges ?? [] },
  } as unknown as Run;
}

const ANY_RNG = new RNG(0);

// ---- selection seam -------------------------------------------------------

describe('selectByScore (the inert selection seam)', () => {
  it('argmax with lowest-index tiebreak, drawing nothing from rng', () => {
    const rng = new RNG(7);
    const ref = new RNG(7);
    expect(selectByScore([1, 5, 5, 3], rng, {})).toBe(1); // first of the tied maxima
    expect(selectByScore([0, 0, 0], rng, {})).toBe(0);
    expect(selectByScore([-3, -1, -2], rng, {})).toBe(1);
    expect(rng.toJSON()).toEqual(ref.toJSON()); // nothing drawn
  });

  it('throws when stochastic selection is requested (reserved, not enabled)', () => {
    expect(() => selectByScore([1, 2], ANY_RNG, { temperature: 0.5 })).toThrow();
    expect(() => selectByScore([1, 2], ANY_RNG, { tiebreak: 'random' })).toThrow();
  });
});

// ---- path policy (full-path backward DP) ----------------------------------

describe('scored path policy — full-path backward DP', () => {
  // Two root→boss paths, each one node per hop. Node 1 is a battle (good
  // immediate weight) but its branch then hits a rest; node 2 is a rest (worse
  // immediate) but its branch then hits TWO battles. With battle>rest the
  // full-path optimum is node 2's branch — a greedy "best immediate kind" pick
  // would wrongly take node 1.
  //   0 ┬ 1(battle) ─ 3(rest)   ─ 5(rest)   ┐
  //     └ 2(rest)   ─ 4(battle) ─ 6(battle) ┴ 7(boss)
  const nodes: MapNode[] = [
    { id: 0, hop: 0, kind: 'battle' },
    { id: 1, hop: 1, kind: 'battle' },
    { id: 2, hop: 1, kind: 'rest' },
    { id: 3, hop: 2, kind: 'rest' },
    { id: 4, hop: 2, kind: 'battle' },
    { id: 5, hop: 3, kind: 'rest' },
    { id: 6, hop: 3, kind: 'battle' },
    { id: 7, hop: 4, kind: 'boss' },
  ];
  const edges: MapEdge[] = [
    { from: 0, to: 1 },
    { from: 0, to: 2 },
    { from: 1, to: 3 },
    { from: 2, to: 4 },
    { from: 3, to: 5 },
    { from: 4, to: 6 },
    { from: 5, to: 7 },
    { from: 6, to: 7 },
  ];
  const run = fakeRun({ nodes, edges });

  it('picks the frontier child leading to the max-total path, not the local max', () => {
    // battle=1, rest=0:  via 1 = b+r+r = 1 ; via 2 = r+b+b = 2  → node 2 wins.
    const w: ScoredWeights = { ...zeroWeights(), path: { battle: 1, rest: 0, elite: 0 } };
    expect(scoredStrategy('dp', w).pickNextNode([1, 2], run, ANY_RNG)).toBe(2);
  });

  it('follows the weights: flip the sign and the other branch wins', () => {
    // rest=5, battle=0:  via 1 = r+b+b... rest@1? no — via 1 kinds are
    // battle,rest,rest = 0+5+5 = 10 ; via 2 = rest,battle,battle = 5+0+0 = 5.
    const w: ScoredWeights = { ...zeroWeights(), path: { battle: 0, rest: 5, elite: 0 } };
    expect(scoredStrategy('dp', w).pickNextNode([1, 2], run, ANY_RNG)).toBe(1);
  });
});

// ---- recruit policy -------------------------------------------------------

describe('scored recruit policy', () => {
  it('is deterministic + RNG-independent with lowest-index ties', () => {
    const s = scoredStrategy('z', zeroWeights());
    const offer = [template('mercenary'), template('ranged'), template('rogue')];
    const run = fakeRun({ team: [template('mercenary')] });
    for (const seed of [1, 2, 3, 99]) {
      expect(s.pickRecruit(offer, run, new RNG(seed))).toBe(0); // all-zero → lowest index
    }
    // path side: lowest node id on an all-zero map, regardless of frontier order
    const pathRun = fakeRun({
      nodes: [
        { id: 1, hop: 1, kind: 'battle' },
        { id: 2, hop: 1, kind: 'battle' },
      ],
    });
    expect(s.pickNextNode([2, 1], pathRun, new RNG(9))).toBe(1);
  });

  it('pass fires iff bestCard continuous score < rosterAvg − passBias', () => {
    // Only the `power` weight is on. Roster power = {0,0}; offer power = {0,10}.
    // Over U = {0,0,0,10}: norm(10)=1, norm(0)=0 → bestCard cont = 1, avg = 0.
    // Pass iff (1 − 0) + passBias < 0  ⇔  passBias < −1.
    const w: ScoredWeights = { ...zeroWeights(), stats: { ...zeroWeights().stats, power: 1 } };
    const run = fakeRun({ team: [meleeWithPower(0), meleeWithPower(0)] });
    const offer = [meleeWithPower(0), meleeWithPower(10)];
    expect(scoredStrategy('p', { ...w, passBias: 0 }).pickRecruit(offer, run, ANY_RNG)).toBe(1);
    expect(scoredStrategy('p', { ...w, passBias: -1 }).pickRecruit(offer, run, ANY_RNG)).toBe(1); // boundary: 0, not < 0
    expect(scoredStrategy('p', { ...w, passBias: -2 }).pickRecruit(offer, run, ANY_RNG)).toBeNull();
  });

  it('generalizes maximizeStat: a single stat weight ranks the offer by that stat', () => {
    const offer = ALL_ARCHETYPES.map(template);
    const run = fakeRun({ team: [template('mercenary')] });
    for (const stat of STAT_KEYS) {
      // passBias huge → never pass, so the pick is purely the argmax-by-stat.
      const w: ScoredWeights = {
        ...zeroWeights(),
        stats: { ...zeroWeights().stats, [stat]: 1 },
        passBias: 1e6,
      };
      const idx = scoredStrategy('g', w).pickRecruit(offer, run, ANY_RNG);
      expect(idx).not.toBeNull();
      expect(offer[idx!]!.stats[stat]).toBe(Math.max(...offer.map((t) => t.stats[stat])));
    }
  });

  it('composition target fills the UNDER-represented archetype (not rich-get-richer)', () => {
    // Equal targets, comp term only (continuous off), passBias huge → never pass
    // so the result is the pure composition argmax. The old `diversity × count`
    // term with diversity>0 would have picked the *most*-stacked archetype here;
    // the fraction-vs-target term picks the one furthest BELOW its target.
    const w: ScoredWeights = {
      ...zeroWeights(),
      compWeight: 1,
      composition: { ...zeroWeights().composition, mercenary: 0.5, rogue: 0.5 },
      passBias: 1e6,
    };
    const offer = [template('mercenary'), template('rogue')];

    // Roster all melee → rogue is at fraction 0 (under target) → take rogue,
    // a count-0 foothold the rich-get-richer term could never give.
    const allMelee = fakeRun({ team: [template('mercenary'), template('mercenary'), template('mercenary')] });
    expect(scoredStrategy('c', w).pickRecruit(offer, allMelee, ANY_RNG)).toBe(1);

    // Roster now over target on rogue (0.75) but under on melee (0.25) → the
    // preference flips: melee is now the under-represented one.
    const heavy = fakeRun({
      team: [template('rogue'), template('rogue'), template('rogue'), template('mercenary')],
    });
    expect(scoredStrategy('c', w).pickRecruit(offer, heavy, ANY_RNG)).toBe(0);
  });

  it('compWeight gates the composition term (0 → no composition influence)', () => {
    // composition wants rogue, but compWeight 0 zeroes the term → all-equal
    // scores fall back to the lowest-index tiebreak (melee at index 0).
    const w: ScoredWeights = {
      ...zeroWeights(),
      compWeight: 0,
      composition: { ...zeroWeights().composition, rogue: 1 },
      passBias: 1e6,
    };
    const offer = [template('mercenary'), template('rogue')];
    const heavyMelee = fakeRun({ team: [template('mercenary'), template('mercenary')] });
    expect(scoredStrategy('c0', w).pickRecruit(offer, heavyMelee, ANY_RNG)).toBe(0);
  });
});

// ---- weight vector config -------------------------------------------------

describe('scored weight vector config', () => {
  it('round-trips through serialize → parse', () => {
    expect(parseWeights(JSON.parse(serializeWeights(DEFAULT_SCORED_WEIGHTS)))).toEqual(
      DEFAULT_SCORED_WEIGHTS,
    );
  });

  it('the shipped default validates and is the neutral all-zero vector', () => {
    expect(DEFAULT_SCORED_WEIGHTS.path.battle).toBe(0);
    expect(DEFAULT_SCORED_WEIGHTS.stats.power).toBe(0);
    expect(DEFAULT_SCORED_WEIGHTS.compWeight).toBe(0);
    for (const a of ALL_ARCHETYPES) expect(DEFAULT_SCORED_WEIGHTS.archetype[a]).toBe(0);
    for (const a of ALL_ARCHETYPES) expect(DEFAULT_SCORED_WEIGHTS.composition[a]).toBe(0);
    for (const k of STAT_KEYS) expect(DEFAULT_SCORED_WEIGHTS.stats[k]).toBe(0);
  });

  it('rejects unknown keys and missing fields', () => {
    const valid = JSON.parse(serializeWeights(DEFAULT_SCORED_WEIGHTS));
    expect(() => parseWeights({ ...valid, bogus: 1 })).toThrow();
    const { passBias: _omitted, ...missing } = valid;
    expect(() => parseWeights(missing)).toThrow();
  });
});
