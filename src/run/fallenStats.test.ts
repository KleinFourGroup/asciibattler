import { describe, it, expect } from 'vitest';
import type { FallenRecord } from './Run';
import { summarizeFallen, type FallenBothSides } from './fallenStats';

const row = (over: Partial<FallenRecord>): FallenRecord => ({
  sector: 0,
  node: 1,
  hop: 1,
  encounterId: 'brigands',
  turn: 1,
  side: 'player',
  archetype: 'mercenary',
  level: 1,
  power: 1,
  tick: 10,
  ...over,
});

/** A three-fight run: a two-turn fight, a one-sided fight, and the FIRST
 *  fight's encounter id recurring in the next sector (a different instance). */
const LEDGER: readonly FallenRecord[] = [
  row({ turn: 1, side: 'player', archetype: 'archer', power: 2, tick: 12 }),
  row({ turn: 1, side: 'enemy', archetype: 'bandit', power: 1, tick: 30 }),
  row({ turn: 1, side: 'enemy', archetype: 'bandit', power: 1, tick: 41 }),
  row({ turn: 3, side: 'player', archetype: 'mercenary', power: 3, tick: 8 }),
  row({ turn: 3, side: 'player', archetype: 'archer', power: 2, tick: 19 }),
  row({ node: 4, hop: 2, encounterId: 'artillery', side: 'enemy', archetype: 'catapult', power: 5, tick: 77 }),
  row({ sector: 1, node: 1, hop: 1, side: 'enemy', archetype: 'rogue', power: 4, tick: 5 }),
  row({ sector: 1, node: 1, hop: 1, turn: 2, side: 'player', archetype: 'mage', power: 6, tick: 50 }),
];

/** The expectation side never calls the module: plain loops over raw rows. */
function rawSum(rows: readonly FallenRecord[], side: string): { count: number; power: number } {
  let count = 0;
  let power = 0;
  for (const r of rows) {
    if (r.side !== side) continue;
    count += 1;
    power += r.power;
  }
  return { count, power };
}

function expectScopeMatchesRows(scope: FallenBothSides, rows: readonly FallenRecord[]): void {
  for (const side of ['player', 'enemy'] as const) {
    const raw = rawSum(rows, side);
    expect(scope[side].count).toBe(raw.count);
    expect(scope[side].power).toBe(raw.power);
    expect(scope[side].rows).toEqual(rows.filter((r) => r.side === side));
    // The archetype split is a partition of the side: it adds back up.
    expect(scope[side].byArchetype.reduce((s, a) => s + a.count, 0)).toBe(raw.count);
    expect(scope[side].byArchetype.reduce((s, a) => s + a.power, 0)).toBe(raw.power);
    expect(new Set(scope[side].byArchetype.map((a) => a.archetype)).size).toBe(
      scope[side].byArchetype.length,
    );
  }
}

describe('102c — summarizeFallen (the run-end stats fold)', () => {
  it('an empty ledger is an empty run: zero totals, no encounters', () => {
    const stats = summarizeFallen([]);
    expect(stats.encounters).toEqual([]);
    for (const side of ['player', 'enemy'] as const) {
      expect(stats[side]).toEqual({ rows: [], count: 0, power: 0, byArchetype: [] });
    }
  });

  it('the run totals are the raw ledger, per side', () => {
    expectScopeMatchesRows(summarizeFallen(LEDGER), LEDGER);
  });

  it('an encounter INSTANCE is sector + node — a recurring encounter id is a separate fight, in fought order', () => {
    const stats = summarizeFallen(LEDGER);
    expect(stats.encounters.map((e) => [e.sector, e.node, e.hop, e.encounterId])).toEqual([
      [0, 1, 1, 'brigands'],
      [0, 4, 2, 'artillery'],
      [1, 1, 1, 'brigands'],
    ]);
    for (const e of stats.encounters) {
      expectScopeMatchesRows(
        e,
        LEDGER.filter((r) => r.sector === e.sector && r.node === e.node),
      );
    }
  });

  it('every row lands in exactly one encounter and one turn (the partitions add back up)', () => {
    const stats = summarizeFallen(LEDGER);
    const inEncounters = stats.encounters.reduce((s, e) => s + e.player.count + e.enemy.count, 0);
    expect(inEncounters).toBe(LEDGER.length);
    for (const e of stats.encounters) {
      const inTurns = e.turns.reduce((s, t) => s + t.player.count + t.enemy.count, 0);
      expect(inTurns).toBe(e.player.count + e.enemy.count);
    }
  });

  it('turns list only the turns somebody fell in, ascending, each matching its raw rows', () => {
    const first = summarizeFallen(LEDGER).encounters[0]!;
    expect(first.turns.map((t) => t.turn)).toEqual([1, 3]); // turn 2 was bloodless — no row, no entry
    for (const t of first.turns) {
      expectScopeMatchesRows(
        t,
        LEDGER.filter((r) => r.sector === 0 && r.node === 1 && r.turn === t.turn),
      );
    }
    // Ascending even if the input is not (the ledger is chronological in
    // production; the fold does not lean on it).
    const shuffled = summarizeFallen([row({ turn: 2 }), row({ turn: 1 })]);
    expect(shuffled.encounters[0]!.turns.map((t) => t.turn)).toEqual([1, 2]);
  });

  it('archetypes keep first-death order within their scope, counted and summed', () => {
    const first = summarizeFallen(LEDGER).encounters[0]!;
    expect(first.player.byArchetype).toEqual([
      { archetype: 'archer', count: 2, power: 4 },
      { archetype: 'mercenary', count: 1, power: 3 },
    ]);
    expect(first.enemy.byArchetype).toEqual([{ archetype: 'bandit', count: 2, power: 2 }]);
  });

  it('does not mutate its input', () => {
    const frozen = LEDGER.map((r) => Object.freeze({ ...r }));
    Object.freeze(frozen);
    expect(() => summarizeFallen(frozen)).not.toThrow();
  });
});
