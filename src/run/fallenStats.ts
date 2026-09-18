/**
 * 102c — the run-end stats fold: a PURE aggregation of `Run.fallenLedger`
 * (94d) into the shape the GameOverScreen draws — the run's totals, then one
 * entry per encounter INSTANCE, each split per side, per archetype and per
 * turn. No Run, no bus, no config: rows in, stats out, so the fuzz harness
 * can call it on a results file as readily as the screen calls it on a live
 * run.
 *
 * What the ledger can and cannot say (it records DEATHS, nothing else):
 *   - an encounter where nobody fell on either side left no row, so it has no
 *     entry here — `encounters` is "the fights somebody fell in", not "the
 *     fights";
 *   - likewise `turns` lists the turns somebody fell in, not the turns fought
 *     (a bloodless turn leaves no row);
 *   - `power` is what the casualty rule BOOKED per death (`unit:died.power`),
 *     so a side's Σ is the pool damage its fallen cost it under `chipMode:
 *     casualties`.
 *
 * Ordering is the ledger's own (append-only, so chronological): encounters by
 * first death, turns ascending, archetypes by first death within their scope.
 * Every `rows` array is a filtered view of the input rows, in death order —
 * the screen's glyph run reads it directly.
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
export interface TurnFallen extends FallenBothSides {
  /** 1-based, as the ledger records it. */
  readonly turn: number;
}

/** One encounter INSTANCE (`sector` + `node` — an encounter id recurs across
 *  sectors, so the id alone does not name a fight). */
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
