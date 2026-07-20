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
    path: { battle: 0, rest: 0, elite: 0, port: 0 },
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
  return {
    archetype: 'mercenary',
    level: 1,
    stats: { ...baseStatsForArchetype('mercenary'), power },
    xp: 0,
  };
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
    const w: ScoredWeights = { ...zeroWeights(), path: { battle: 1, rest: 0, elite: 0, port: 0 } };
    expect(scoredStrategy('dp', w).pickNextNode([1, 2], run, ANY_RNG)).toBe(2);
  });

  it('follows the weights: flip the sign and the other branch wins', () => {
    // rest=5, battle=0:  via 1 = r+b+b... rest@1? no — via 1 kinds are
    // battle,rest,rest = 0+5+5 = 10 ; via 2 = rest,battle,battle = 5+0+0 = 5.
    const w: ScoredWeights = { ...zeroWeights(), path: { battle: 0, rest: 5, elite: 0, port: 0 } };
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
    const allMelee = fakeRun({
      team: [template('mercenary'), template('mercenary'), template('mercenary')],
    });
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

// ---- port-purchase scorer (59b) --------------------------------------------

import type { PortStock } from '../../../src/run/Run';
import type { PortWeights } from './scoredWeights';
import { BITS_SCALE } from './scored';
import type { PortBuy } from '../Strategy';

function zeroPort(): PortWeights {
  return { daemonValue: 0, packetValue: 0, priceSensitivity: 0, bankReserve: 0, unitBias: 0 };
}

interface StockSpec {
  daemons?: number[]; // prices
  units?: Array<{ t: UnitTemplate; price: number }>;
  packets?: number[]; // prices
}

function makeStock(spec: StockSpec): PortStock {
  return {
    daemons: (spec.daemons ?? []).map((price, i) => ({ daemonId: `d${i}`, price, sold: false })),
    units: (spec.units ?? []).map(({ t, price }) => ({ template: t, price, sold: false })),
    packets: (spec.packets ?? []).map((price, i) => ({ packetId: `p${i}`, price, sold: false })),
  };
}

/** A Run stub for the port scorer: bits + cacheHasRoom + team are all it
 *  reads. Mutable bits so tests can drive the 59a ask-until-null loop. */
function portRun(parts: { bits: number; cacheHasRoom?: boolean; team?: UnitTemplate[] }): Run {
  return {
    bits: parts.bits,
    cacheHasRoom: parts.cacheHasRoom ?? true,
    team: parts.team ?? [],
    nodeMap: { nodes: [], edges: [] },
  } as unknown as Run;
}

/** Drive the harness's ask-until-null loop against a crafted stock: apply
 *  each proposal (mark sold, spend bits), collect the transaction sequence. */
function driveBuys(strategy: FuzzStrategyWithPort, stock: PortStock, run: Run): PortBuy[] {
  const buys: PortBuy[] = [];
  for (;;) {
    const buy = strategy.pickPortBuy!(stock, run, ANY_RNG);
    if (buy === null) break;
    const lane =
      buy.kind === 'daemon' ? stock.daemons : buy.kind === 'unit' ? stock.units : stock.packets;
    const slot = lane[buy.index]!;
    expect(slot.sold).toBe(false); // a proposal must always be legal
    expect((run as { bits: number }).bits).toBeGreaterThanOrEqual(slot.price);
    slot.sold = true;
    (run as { bits: number }).bits -= slot.price;
    buys.push(buy);
    if (buys.length > 50) throw new Error('driveBuys: runaway loop');
  }
  return buys;
}

type FuzzStrategyWithPort = ReturnType<typeof scoredStrategy>;

function portStrategy(port: PortWeights, base: Partial<ScoredWeights> = {}): FuzzStrategyWithPort {
  return scoredStrategy('port-test', { ...zeroWeights(), ...base, port });
}

describe('scored port-purchase policy (59b)', () => {
  it('absent port group → NO pickPortBuy (old vectors keep the hardwired 50g branch)', () => {
    expect(scoredStrategy('plain', zeroWeights()).pickPortBuy).toBeUndefined();
  });

  it('an ALL-ZERO port group replicates the 50g fixed policy, transaction for transaction', () => {
    // 50g single pass at bits 40: d0(10) ✓, d1(99) skip, u0(15) ✓, p0(5) ✓,
    // p1(8) ✓ → the zero scorer must emit the same sequence (all-equal net
    // scores → lowest-index tiebreak over the daemons→units→packets order).
    const stock = makeStock({
      daemons: [10, 99],
      units: [{ t: template('mercenary'), price: 15 }],
      packets: [5, 8],
    });
    const run = portRun({ bits: 40 });
    expect(driveBuys(portStrategy(zeroPort()), stock, run)).toEqual([
      { kind: 'daemon', index: 0 },
      { kind: 'unit', index: 0 },
      { kind: 'packet', index: 0 },
      { kind: 'packet', index: 1 },
    ]);
    expect((run as { bits: number }).bits).toBe(40 - 10 - 15 - 5 - 8);
  });

  it('bankReserve is a bank floor: a buy that would dip below it never fires', () => {
    const stock = makeStock({ daemons: [20] });
    const port = { ...zeroPort(), daemonValue: 0.5, bankReserve: 0.5 }; // floor = 25 bits
    expect(portStrategy(port).pickPortBuy!(stock, portRun({ bits: 30 }), ANY_RNG)).toBeNull();
    // 45 − 20 = 25 ≥ floor → fires.
    expect(portStrategy(port).pickPortBuy!(stock, portRun({ bits: 45 }), ANY_RNG)).toEqual({
      kind: 'daemon',
      index: 0,
    });
    expect(Math.max(0, port.bankReserve) * BITS_SCALE).toBe(25); // the scale contract
  });

  it('priceSensitivity prefers the cheaper of equal values and stops at negative net', () => {
    const stock = makeStock({ daemons: [10, 30] });
    const port = { ...zeroPort(), daemonValue: 0.5, priceSensitivity: 1 };
    // nets: 0.5 − 10/50 = 0.3 · 0.5 − 30/50 = −0.1 → buy d0, then STOP (d1 < 0).
    const run = portRun({ bits: 100 });
    expect(driveBuys(portStrategy(port), stock, run)).toEqual([{ kind: 'daemon', index: 0 }]);
  });

  it('a full cache excludes the packet lane entirely', () => {
    const stock = makeStock({ packets: [5] });
    const port = { ...zeroPort(), packetValue: 1 };
    expect(
      portStrategy(port).pickPortBuy!(stock, portRun({ bits: 100, cacheHasRoom: false }), ANY_RNG),
    ).toBeNull();
  });

  it('unit slots ride the recruit scorer: the stat-weighted template wins; unitBias can veto', () => {
    const stock = makeStock({
      units: [
        { t: meleeWithPower(5), price: 10 },
        { t: meleeWithPower(10), price: 10 },
      ],
    });
    const statWeights: Partial<ScoredWeights> = {
      stats: { ...zeroWeights().stats, power: 1 },
    };
    // power normalized over {offer ∪ roster}: 0 vs 1 → the higher-power slot
    // wins despite the lowest-index tiebreak favoring index 0.
    expect(
      portStrategy(zeroPort(), statWeights).pickPortBuy!(stock, portRun({ bits: 100 }), ANY_RNG),
    ).toEqual({ kind: 'unit', index: 1 });
    // A deep-negative unitBias drives every unit net below zero → null.
    expect(
      portStrategy({ ...zeroPort(), unitBias: -5 }, statWeights).pickPortBuy!(
        stock,
        portRun({ bits: 100 }),
        ANY_RNG,
      ),
    ).toBeNull();
  });

  it('draws NOTHING from the rng (deterministic argmax, the H7a contract)', () => {
    const rng = new RNG(11);
    const ref = new RNG(11);
    const stock = makeStock({ daemons: [10, 20], packets: [5] });
    portStrategy({ ...zeroPort(), daemonValue: 1, packetValue: 1 }).pickPortBuy!(
      stock,
      portRun({ bits: 100 }),
      rng,
    );
    expect(rng.toJSON()).toEqual(ref.toJSON());
  });

  it('the port group round-trips, strict-rejects unknown fields, and stays optional', () => {
    const withPort: ScoredWeights = { ...zeroWeights(), port: zeroPort() };
    expect(parseWeights(JSON.parse(serializeWeights(withPort)))).toEqual(withPort);
    expect(() => parseWeights({ ...withPort, port: { ...zeroPort(), bogus: 1 } })).toThrow();
    const { daemonValue: _omitted, ...missing } = zeroPort();
    expect(() => parseWeights({ ...withPort, port: missing })).toThrow();
    // The pre-59b shape (no port key) still parses — the anchors story.
    expect(parseWeights(JSON.parse(serializeWeights(zeroWeights()))).port).toBeUndefined();
  });
});

// ---- packet-fire scorer (59c) ----------------------------------------------

import type { FireWeights } from './scoredWeights';
import type { EncounterKind } from '../../../src/config/encounters';
import type { NodeKind } from '../../../src/run/NodeMap';
import { packetById } from '../../../src/config/packets';
import { HEALTH } from '../../../src/config/health';

function zeroFire(): FireWeights {
  return { bias: { normal: 0, elite: 0, boss: 0 }, cachePressure: 0 };
}

/** A Run stub for the fire scorer: current encounter kind, cache + derived
 *  capacity, hand/team for unit targeting, and a one-hop frontier built as
 *  node 0 → nodes 1..n carrying the given kinds. */
function fireRun(parts: {
  kind?: EncounterKind;
  cache?: string[];
  capacity?: number;
  team?: UnitTemplate[];
  hand?: number[];
  frontier?: NodeKind[];
  playerHealth?: number;
}): Run {
  const frontier = parts.frontier ?? [];
  return {
    selectedEncounter: parts.kind !== undefined ? { kind: parts.kind } : null,
    cache: parts.cache ?? [],
    effectiveCacheSize: parts.capacity ?? 4,
    team: parts.team ?? [],
    hand: parts.hand ?? [],
    // Default = a FULLY-DAMAGED pool, so the pre-60c fire tests (which fire
    // patch freely) keep their meaning under the 60c heal guard explicitly
    // rather than by accident.
    playerHealth: parts.playerHealth ?? 0,
    currentNodeId: 0,
    nodeMap: {
      rootId: 0,
      nodes: [{ id: 0, kind: 'battle' }, ...frontier.map((kind, i) => ({ id: i + 1, kind }))],
      edges: frontier.map((_k, i) => ({ from: 0, to: i + 1 })),
    },
  } as unknown as Run;
}

function fireStrategy(fire: FireWeights): FuzzStrategyWithPort {
  return scoredStrategy('fire-test', { ...zeroWeights(), fire });
}

describe('scored packet-fire policy (59c)', () => {
  it('absent fire group → NO pickPacketFire (old vectors never fire, gates stay off)', () => {
    expect(scoredStrategy('plain', zeroWeights()).pickPacketFire).toBeUndefined();
  });

  it('the ALL-ZERO fire group never fires — the fixed-policy point', () => {
    const run = fireRun({ kind: 'boss', cache: ['patch', 'reroute'], capacity: 2 }); // full cache
    expect(fireStrategy(zeroFire()).pickPacketFire!('preTurn', run, ANY_RNG)).toBeNull();
  });

  it('preTurn keys on the CURRENT encounter kind (hoard for the boss, spend at the boss)', () => {
    const fire = { ...zeroFire(), bias: { normal: 0, elite: 0, boss: 1 } };
    const atBoss = fireRun({ kind: 'boss', cache: ['patch'] });
    const atNormal = fireRun({ kind: 'normal', cache: ['patch'] });
    expect(fireStrategy(fire).pickPacketFire!('preTurn', atBoss, ANY_RNG)).toEqual({
      cacheIndex: 0,
    });
    expect(fireStrategy(fire).pickPacketFire!('preTurn', atNormal, ANY_RNG)).toBeNull();
  });

  it('cachePressure makes a full cache overcome a negative bias — and an empty one not', () => {
    const fire: FireWeights = { bias: { normal: -0.5, elite: 0, boss: 0 }, cachePressure: 1 };
    const full = fireRun({
      kind: 'normal',
      cache: ['patch', 'venom', 'miner', 'reroute'],
      capacity: 4,
    });
    const light = fireRun({ kind: 'normal', cache: ['patch'], capacity: 4 });
    expect(fireStrategy(fire).pickPacketFire!('preTurn', full, ANY_RNG)).toEqual({ cacheIndex: 0 });
    expect(fireStrategy(fire).pickPacketFire!('preTurn', light, ANY_RNG)).toBeNull();
  });

  it('selection is acquisition order, filtered to context-usable packets', () => {
    // overclock is outOfBattle-only → preTurn skips it and fires patch at index 1.
    const fire = { ...zeroFire(), bias: { normal: 1, elite: 1, boss: 1 } };
    const run = fireRun({ kind: 'normal', cache: ['overclock', 'patch'] });
    expect(fireStrategy(fire).pickPacketFire!('preTurn', run, ANY_RNG)).toEqual({ cacheIndex: 1 });
  });

  it('unit-target packets aim at the max-power card: hand at preTurn, roster outOfBattle', () => {
    const fire = { ...zeroFire(), bias: { normal: 1, elite: 1, boss: 1 } };
    const team = [meleeWithPower(3), meleeWithPower(9), meleeWithPower(5)];
    // hype (preTurn, unit): hand positions map to team slots — slot 1 has power 9 → handIndex 1.
    const preTurn = fireRun({ kind: 'normal', cache: ['hype'], team, hand: [0, 1, 2] });
    expect(fireStrategy(fire).pickPacketFire!('preTurn', preTurn, ANY_RNG)).toEqual({
      cacheIndex: 0,
      handIndex: 1,
    });
    // overclock (outOfBattle, unit): targets the roster directly → rosterIndex 1.
    const map = fireRun({ cache: ['overclock'], team, frontier: ['battle'] });
    expect(fireStrategy(fire).pickPacketFire!('outOfBattle', map, ANY_RNG)).toEqual({
      cacheIndex: 0,
      rosterIndex: 1,
    });
  });

  it('outOfBattle keys on the frontier WORST battle-kind; no battle ahead → no fire', () => {
    const bossOnly = { ...zeroFire(), bias: { normal: -1, elite: -1, boss: 1 } };
    const bossAhead = fireRun({ cache: ['patch'], frontier: ['rest', 'battle', 'boss'] });
    const restAhead = fireRun({ cache: ['patch'], frontier: ['rest', 'port'] });
    const normalAhead = fireRun({ cache: ['patch'], frontier: ['battle'] });
    expect(fireStrategy(bossOnly).pickPacketFire!('outOfBattle', bossAhead, ANY_RNG)).toEqual({
      cacheIndex: 0,
    });
    expect(fireStrategy(bossOnly).pickPacketFire!('outOfBattle', restAhead, ANY_RNG)).toBeNull();
    expect(fireStrategy(bossOnly).pickPacketFire!('outOfBattle', normalAhead, ANY_RNG)).toBeNull();
  });

  describe('the 60c heal guard (the patch-monopoly breaker)', () => {
    // Balance-proof: amounts derive from the config, never hardcoded.
    const patchHeal = (packetById('patch')!.effect as { amount: number }).amount;
    const max = HEALTH.playerHealthMax;
    const eager = { ...zeroFire(), bias: { normal: 1, elite: 1, boss: 1 } };

    it('a full pool SKIPS patch and the next usable packet gets the slot', () => {
      const team = [meleeWithPower(3), meleeWithPower(9)];
      const run = fireRun({
        kind: 'normal',
        cache: ['patch', 'shield'],
        team,
        hand: [0, 1],
        playerHealth: max,
      });
      expect(fireStrategy(eager).pickPacketFire!('preTurn', run, ANY_RNG)).toEqual({
        cacheIndex: 1,
        handIndex: 1,
      });
    });

    it('pool damage below the heal amount still skips (a partially-clamped heal is banked)', () => {
      const run = fireRun({
        kind: 'normal',
        cache: ['patch'],
        playerHealth: max - (patchHeal - 1),
      });
      expect(fireStrategy(eager).pickPacketFire!('preTurn', run, ANY_RNG)).toBeNull();
    });

    it('pool damage at the heal amount fires patch (fully realized)', () => {
      const run = fireRun({
        kind: 'normal',
        cache: ['patch'],
        playerHealth: max - patchHeal,
      });
      expect(fireStrategy(eager).pickPacketFire!('preTurn', run, ANY_RNG)).toEqual({
        cacheIndex: 0,
      });
    });
  });

  it('draws NOTHING from the rng and the fire group round-trips/strict-rejects', () => {
    const rng = new RNG(13);
    const ref = new RNG(13);
    const run = fireRun({ kind: 'boss', cache: ['patch'] });
    fireStrategy({ ...zeroFire(), bias: { normal: 0, elite: 0, boss: 1 } }).pickPacketFire!(
      'preTurn',
      run,
      rng,
    );
    expect(rng.toJSON()).toEqual(ref.toJSON());

    const withFire: ScoredWeights = { ...zeroWeights(), fire: zeroFire() };
    expect(parseWeights(JSON.parse(serializeWeights(withFire)))).toEqual(withFire);
    expect(() => parseWeights({ ...withFire, fire: { ...zeroFire(), bogus: 1 } })).toThrow();
    expect(() =>
      parseWeights({ ...withFire, fire: { bias: { normal: 0, elite: 0 }, cachePressure: 0 } }),
    ).toThrow(); // missing boss key
  });
});
