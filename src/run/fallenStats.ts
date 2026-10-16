/**
 * The run-end stats: `Run.fallenLedger` folded into what the game-over
 * screen draws, the run's totals and then one entry per encounter instance,
 * each split by side, by archetype and by turn. Pure: rows in, stats out, no
 * `Run`, bus or config.
 *
 * The ledger records deaths and nothing else, so:
 * - an encounter in which nobody fell left no row and has no entry here:
 *   `encounters` is the fights somebody fell in, not every fight;
 * - `turns` likewise lists the turns somebody fell in;
 * - `power` is what the casualty rule charged for each death
 *   (`unit:died.power`), so a side's sum is what its fallen cost its pool,
 *   before `chipMultiplier` and without a capped turn's charge for the
 *   standing side.
 *
 * Order is the ledger's, which is only appended to and so chronological:
 * encounters by first death, turns ascending, archetypes by first death
 * within their scope. Each `rows` array is the input's rows filtered, in
 * death order.
 */

import type { FallenRecord } from './Run';

/** One archetype's share of a side's fallen. */
export interface ArchetypeFallen {
  readonly archetype: string;
  readonly count: number;
  readonly power: number;
}

/** One side's fallen within a scope (the run, an encounter, or a turn). */
export interface FallenSideStats {
  readonly rows: readonly FallenRecord[];
  readonly count: number;
  readonly power: number;
  readonly byArchetype: readonly ArchetypeFallen[];
}

/** Both sides of a scope. */
export interface FallenBothSides {
  readonly player: FallenSideStats;
  readonly enemy: FallenSideStats;
}

/** One turn of an encounter in which somebody fell. */
interface TurnFallen extends FallenBothSides {
  /** 1-based, as the ledger records it. */
  readonly turn: number;
}

/** One encounter instance, named by `sector` and `node`, since an encounter id
 *  recurs across sectors and alone does not name a fight. */
export interface EncounterFallen extends FallenBothSides {
  readonly sector: number;
  readonly node: number;
  readonly hop: number;
  readonly encounterId: string;
  /** The turns somebody fell in, ascending. */
  readonly turns: readonly TurnFallen[];
}

/** The whole run. */
export interface RunFallenStats extends FallenBothSides {
  /** The encounters somebody fell in, in the order they were fought. */
  readonly encounters: readonly EncounterFallen[];
}

function sideStats(rows: readonly FallenRecord[], side: FallenRecord['side']): FallenSideStats {
  const mine = rows.filter((r) => r.side === side);
  const byArchetype = new Map<string, { count: number; power: number }>();
  let power = 0;
  for (const r of mine) {
    power += r.power;
    const entry = byArchetype.get(r.archetype) ?? { count: 0, power: 0 };
    entry.count += 1;
    entry.power += r.power;
    byArchetype.set(r.archetype, entry);
  }
  return {
    rows: mine,
    count: mine.length,
    power,
    byArchetype: [...byArchetype].map(([archetype, e]) => ({ archetype, ...e })),
  };
}

function bothSides(rows: readonly FallenRecord[]): FallenBothSides {
  return { player: sideStats(rows, 'player'), enemy: sideStats(rows, 'enemy') };
}

/** Group `rows` by `keyOf`, keeping first-appearance order (a Map iterates in
 *  insertion order). */
function groupBy<K>(rows: readonly FallenRecord[], keyOf: (r: FallenRecord) => K): Map<K, FallenRecord[]> {
  const groups = new Map<K, FallenRecord[]>();
  for (const r of rows) {
    const key = keyOf(r);
    const group = groups.get(key);
    if (group) group.push(r);
    else groups.set(key, [r]);
  }
  return groups;
}

/** Fold the ledger. Pure; never mutates or retains `ledger` beyond the row
 *  references it hands back. */
export function summarizeFallen(ledger: readonly FallenRecord[]): RunFallenStats {
  const encounters: EncounterFallen[] = [];
  for (const rows of groupBy(ledger, (r) => `${r.sector}:${r.node}`).values()) {
    const first = rows[0]!;
    const turns = [...groupBy(rows, (r) => r.turn)]
      .sort(([a], [b]) => a - b)
      .map(([turn, turnRows]) => ({ turn, ...bothSides(turnRows) }));
    encounters.push({
      sector: first.sector,
      node: first.node,
      hop: first.hop,
      encounterId: first.encounterId,
      turns,
      ...bothSides(rows),
    });
  }
  return { encounters, ...bothSides(ledger) };
}
