/**
 * 54c — TRACE MINING (`npm run trace-mine`): replay the 53g human fixture
 * with the 54b sensors sampled at every tick, and dump what the sensors read
 * at the exact moments the human issued objective commands vs the battle's
 * background levels. The output is the trigger-threshold table the five
 * traffic scripts (54d–54h) calibrate against — triggers get DERIVED from
 * the human's recorded decisions, not invented a priori (the §54 lock).
 *
 * Join (the 53g ingest method, reproduced): deterministic bot re-runs of
 * each cell's RunConfig anchor `worldSeed → cell` exactly (a human turn's
 * seed matches while the run stream was consumed identically); leftovers
 * fall back to layout + enemy-archetype-multiset matched against anchored
 * traces (the junction-407 / boss-1003 path-divergence case); the rest are
 * excluded and REPORTED — silent drops would misread as coverage.
 *
 * Era-bound like the fixture itself: refuses on a configHash mismatch
 * (replayTrace would anyway) — the first §57 balance change retires the
 * fixture and this miner's usefulness together, by design.
 *
 * Everything here is deterministic (no RNG anywhere in the miner) and
 * observation-only (the replay hook reads, never mutates — the fidelity
 * contract).
 */

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { replayTrace } from '../../src/dev/replayTrace';
import { configHash } from '../../src/dev/configHash';
import type { BattleTrace } from '../../src/dev/TraceRecorder';
import { EventBus } from '../../src/core/EventBus';
import type { GameEvents } from '../../src/core/events';
import type { GridCoord } from '../../src/core/types';
import type { World } from '../../src/sim/World';
import type { WorldCommand } from '../../src/sim/Command';
import { cellKey, distanceBetween } from '../../src/sim/occupancy';
import {
  jamRead,
  unitsApproachingHazard,
  chokeCells,
  attritionRead,
  focusTargetFeatures,
  livingUnits,
} from '../../src/bot/sensors';
import { GAUNTLET_CELLS, cellRunConfig, type GauntletCell } from './cells';
import { makeStrategy } from '../fuzz/strategies/registry';
import { runOne } from '../fuzz/harness';

const HERE = dirname(fileURLToPath(import.meta.url));
const FIXTURE = join(HERE, 'fixtures', '53g-human-traces.json');
const OUT_CSV = join(HERE, 'output', 'trace-mine-commands.csv');

/** Hazard-approach window (Chebyshev steps) — matches the sensor's intended
 *  trigger use; PROVISIONAL like the sensor constants themselves. */
const HAZARD_STEPS = 3;

// ---------------------------------------------------------------------------
// Sensor sampling
// ---------------------------------------------------------------------------

interface SensorSample {
  readonly jamCount: number;
  readonly jamFraction: number;
  readonly hazardApproach: number;
  /** ownPower − enemyPower (positive = winning on attrition). */
  readonly powerDelta: number;
  readonly enemyDot: number;
  readonly playerOnChoke: number;
  readonly enemyNearChoke: number;
  readonly enemyCount: number;
  readonly maxEnemyPower: number;
}

const SENSOR_KEYS = [
  'jamCount',
  'jamFraction',
  'hazardApproach',
  'powerDelta',
  'enemyDot',
  'playerOnChoke',
  'enemyNearChoke',
  'enemyCount',
  'maxEnemyPower',
] as const;

function sampleSensors(world: World, chokes: GridCoord[], chokeSet: Set<string>): SensorSample {
  const jam = jamRead(world, 'player');
  const attr = attritionRead(world, 'player');
  const features = focusTargetFeatures(world, 'player');
  let playerOnChoke = 0;
  for (const u of livingUnits(world, 'player')) {
    if (chokeSet.has(cellKey(u.position))) playerOnChoke++;
  }
  let enemyNearChoke = 0;
  for (const e of livingUnits(world, 'enemy')) {
    if (chokes.some((c) => distanceBetween(c, e.position) <= 1)) enemyNearChoke++;
  }
  return {
    jamCount: jam.jammedUnitIds.length,
    jamFraction: jam.jamFraction,
    hazardApproach: unitsApproachingHazard(world, 'player', HAZARD_STEPS).length,
    powerDelta: attr.ownPower - attr.enemyPower,
    enemyDot: attr.enemyDotCount,
    playerOnChoke,
    enemyNearChoke,
    enemyCount: features.length,
    maxEnemyPower: features.reduce((m, f) => Math.max(m, f.power), 0),
  };
}

// ---------------------------------------------------------------------------
// Join: trace → cell
// ---------------------------------------------------------------------------

interface Anchor {
  readonly cellId: string;
  readonly target: boolean;
}

/** Enemy-comp fingerprint: archetype multiset, order-free. */
function comp(trace: BattleTrace): string {
  const counts = new Map<string, number>();
  for (const u of trace.encounter.enemyTeam) {
    counts.set(u.archetype, (counts.get(u.archetype) ?? 0) + 1);
  }
  return [...counts.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, n]) => `${k}x${n}`)
    .join(',');
}

function buildAnchors(): Map<number, Anchor> {
  const anchors = new Map<number, Anchor>();
  for (const cell of GAUNTLET_CELLS) {
    const strategy = makeStrategy(cell.kind === 'elite' ? 'path:elite' : 'greedy');
    if (!strategy) throw new Error('trace-mine: strategy registry miss');
    for (const seed of cell.seeds) {
      const result = runOne(seed, strategy, { runConfig: cellRunConfig(cell, seed) });
      for (const b of result.battles) {
        anchors.set(b.worldSeed, { cellId: cell.id, target: b.encounterId === cell.encounterId });
      }
    }
  }
  return anchors;
}

interface JoinedTrace {
  readonly trace: BattleTrace;
  readonly cell: GauntletCell;
  readonly how: 'seed' | 'fingerprint';
}

function joinTraces(traces: readonly BattleTrace[]): {
  joined: JoinedTrace[];
  offTarget: number;
  unjoined: BattleTrace[];
} {
  console.log('building worldSeed anchors (33 deterministic bot re-runs)...');
  const anchors = buildAnchors();
  const cellById = new Map(GAUNTLET_CELLS.map((c) => [c.id, c]));

  const joined: JoinedTrace[] = [];
  let offTarget = 0;
  const leftovers: BattleTrace[] = [];
  // Pass 1 — exact worldSeed.
  for (const trace of traces) {
    const anchor = anchors.get(trace.encounter.worldSeed);
    if (!anchor) {
      leftovers.push(trace);
    } else if (anchor.target) {
      joined.push({ trace, cell: cellById.get(anchor.cellId)!, how: 'seed' });
    } else {
      offTarget++; // a non-target battle on the cell's run (e.g. the terminal node)
    }
  }
  // Pass 2 — layout + enemy-comp fingerprint against the seed-joined traces
  // (the human's path diverged the run RNG: junction 407, boss 1003 at 53g).
  const fingerprints = new Map<string, GauntletCell>();
  for (const j of joined) {
    fingerprints.set(`${j.trace.encounter.layoutId}|${comp(j.trace)}`, j.cell);
  }
  const unjoined: BattleTrace[] = [];
  for (const trace of leftovers) {
    const cell = fingerprints.get(`${trace.encounter.layoutId}|${comp(trace)}`);
    if (cell) joined.push({ trace, cell, how: 'fingerprint' });
    else unjoined.push(trace);
  }
  return { joined, offTarget, unjoined };
}

// ---------------------------------------------------------------------------
// Mining
// ---------------------------------------------------------------------------

interface CommandRow extends SensorSample {
  readonly cellId: string;
  readonly traceIndex: number;
  readonly tick: number;
  /** tick / the trace's total ticks — where in the turn the command landed. */
  readonly tickFraction: number;
  readonly command: string;
}

function describeCommand(c: WorldCommand): string {
  if (c.kind === 'setObjective') {
    const target = 'target' in c.objective ? `:${c.objective.target.kind}` : '';
    return `${c.objective.mode}${target}`;
  }
  return c.kind === 'clearObjective' ? 'clear' : c.kind;
}

interface Accumulator {
  n: number;
  sums: Record<(typeof SENSOR_KEYS)[number], number>;
  maxes: Record<(typeof SENSOR_KEYS)[number], number>;
}

function makeAccumulator(): Accumulator {
  return {
    n: 0,
    sums: Object.fromEntries(SENSOR_KEYS.map((k) => [k, 0])) as Accumulator['sums'],
    maxes: Object.fromEntries(SENSOR_KEYS.map((k) => [k, -Infinity])) as Accumulator['maxes'],
  };
}

function accumulate(acc: Accumulator, s: SensorSample): void {
  acc.n++;
  for (const k of SENSOR_KEYS) {
    acc.sums[k] += s[k];
    acc.maxes[k] = Math.max(acc.maxes[k], s[k]);
  }
}

function main(): void {
  const traces = JSON.parse(readFileSync(FIXTURE, 'utf8')) as BattleTrace[];
  const era = configHash();
  if (traces.length === 0 || traces[0]!.configHash !== era) {
    console.error(
      `trace-mine: fixture era ${traces[0]?.configHash ?? '(empty)'} ≠ live config ${era} — ` +
        'the fixture is retired for this config; re-record a session to mine.',
    );
    process.exitCode = 1;
    return;
  }

  const { joined, offTarget, unjoined } = joinTraces(traces);
  console.log(
    `joined ${joined.length}/${traces.length} traces ` +
      `(${joined.filter((j) => j.how === 'seed').length} by seed, ` +
      `${joined.filter((j) => j.how === 'fingerprint').length} by fingerprint); ` +
      `${offTarget} off-target, ${unjoined.length} unjoined${unjoined.length > 0 ? ' ⚠ EXCLUDED' : ''}`,
  );
  for (const t of unjoined) {
    console.log(
      `  ⚠ unjoined: layout=${t.encounter.layoutId} comp=${comp(t)} ` +
        `ticks=${t.outcome.ticks} commands=${t.commands.length}`,
    );
  }

  const rows: CommandRow[] = [];
  const background = new Map<string, Accumulator>();
  const atCommand = new Map<string, Accumulator>();
  const commandMix = new Map<string, Map<string, number>>();

  joined.forEach(({ trace, cell }, i) => {
    let chokes: GridCoord[] | null = null;
    let chokeSet = new Set<string>();
    const bg = background.get(cell.id) ?? makeAccumulator();
    background.set(cell.id, bg);
    const cmd = atCommand.get(cell.id) ?? makeAccumulator();
    atCommand.set(cell.id, cmd);
    const mix = commandMix.get(cell.id) ?? new Map<string, number>();
    commandMix.set(cell.id, mix);

    replayTrace(trace, new EventBus<GameEvents>(), {
      beforeTick: (world, tick, commands) => {
        if (chokes === null) {
          chokes = chokeCells(world);
          chokeSet = new Set(chokes.map(cellKey));
        }
        const s = sampleSensors(world, chokes, chokeSet);
        accumulate(bg, s);
        for (const c of commands) {
          accumulate(cmd, s);
          const label = describeCommand(c);
          mix.set(label, (mix.get(label) ?? 0) + 1);
          rows.push({
            cellId: cell.id,
            traceIndex: i,
            tick,
            tickFraction: tick / trace.outcome.ticks,
            command: label,
            ...s,
          });
        }
      },
    });
  });

  // The per-cell contrast table: background mean|max vs at-command mean.
  const fmt = (v: number) => (Number.isInteger(v) ? String(v) : v.toFixed(2));
  for (const cell of GAUNTLET_CELLS) {
    const bg = background.get(cell.id);
    if (!bg || bg.n === 0) continue;
    const cmd = atCommand.get(cell.id)!;
    const mix = [...(commandMix.get(cell.id) ?? new Map<string, number>()).entries()]
      .sort(([, a], [, b]) => b - a)
      .map(([k, n]) => `${k}×${n}`)
      .join(' ');
    console.log(`\n== ${cell.id} — ${bg.n} bg ticks, ${cmd.n} commands [${mix}]`);
    console.log('  sensor           bg-mean   bg-max    @cmd-mean');
    for (const k of SENSOR_KEYS) {
      const bgMean = bg.sums[k] / bg.n;
      const cmdMean = cmd.n > 0 ? cmd.sums[k] / cmd.n : NaN;
      console.log(
        `  ${k.padEnd(16)} ${fmt(bgMean).padEnd(9)} ${fmt(bg.maxes[k]).padEnd(9)} ${
          Number.isNaN(cmdMean) ? '—' : fmt(cmdMean)
        }`,
      );
    }
  }

  mkdirSync(dirname(OUT_CSV), { recursive: true });
  const header = ['cellId', 'traceIndex', 'tick', 'tickFraction', 'command', ...SENSOR_KEYS];
  const csv = [
    header.join(','),
    ...rows.map((r) =>
      header.map((h) => String(r[h as keyof CommandRow])).join(','),
    ),
  ].join('\n');
  writeFileSync(OUT_CSV, csv + '\n');
  console.log(`\n${rows.length} command rows → ${OUT_CSV}`);
}

main();
