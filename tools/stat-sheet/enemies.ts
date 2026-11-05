/**
 * The stat sheet's enemies: the units a sector's encounters of one kind
 * field against a hand at a level, through the game's own wave code, so
 * they cannot drift from the game's.
 *
 * A fight is played as turns of the kind's signed turn target (the signed
 * sheet's `pacingBands`, the band's midpoint rounded), with the enemy pool
 * falling evenly across them, since a stage advances on the pool. Each
 * turn's wave comes from `waveForTurn` and its units from `resolveWave`,
 * with the sheet's own `RNG` seeds, so it draws on no stream of a run's.
 * An encounter counts by its pool weight, every entry of the kind's pool
 * whatever its `minHop`, and each body fielded counts once.
 */

import { RNG } from '../../src/core/RNG';
import { DECK } from '../../src/config/deck';
import { getEncounter, type EncounterKind } from '../../src/config/encounters';
import { getSector } from '../../src/config/sectors';
import { UNIT_DEFS } from '../../src/config/units';
import { scaledUnit } from '../../src/sim/archetypes';
import { resolveWave, type WaveContext } from '../../src/run/encounters/wave';
import { waveForTurn, type WaveCursor } from '../../src/run/encounters/sequencer';
import type { UnitTemplate } from '../../src/sim/Unit';
import SIGNED_SHEET from '../../tests/fuzz/board/signed-sheet.json';

export interface EnemyOptions {
  readonly handSize?: number;
  readonly seeds?: number;
  readonly levelBudgetMultiplier?: number;
  readonly waveSizeMultiplier?: number;
}

/** A fielded enemy type at one level, with its share of the bodies. */
export interface FieldedEnemy {
  readonly archetype: string;
  readonly level: number;
  readonly share: number;
}

/** Turns a fight of this kind is played as: the signed turn band's
 *  midpoint, rounded. */
export function turnsFor(kind: EncounterKind): number {
  const band = SIGNED_SHEET.pacingBands[kind];
  return Math.round((band.min + band.max) / 2);
}

function contextFor(level: number, opts: EnemyOptions): WaveContext {
  const handSize = opts.handSize ?? DECK.handSize;
  const placeholder = Object.keys(UNIT_DEFS)[0]!;
  return {
    roster: Array.from({ length: handSize }, () => scaledUnit(placeholder, level)),
    handSize,
    ...(opts.waveSizeMultiplier === undefined ? {} : { waveSizeMultiplier: opts.waveSizeMultiplier }),
    ...(opts.levelBudgetMultiplier === undefined ? {} : { levelBudgetMultiplier: opts.levelBudgetMultiplier }),
  };
}

/** One fight's waves, a turn at a time, for a hand at `level`. */
export function fightWaves(
  encounterId: string,
  kind: EncounterKind,
  level: number,
  seed: number,
  opts: EnemyOptions = {},
): UnitTemplate[][] {
  const encounter = getEncounter(encounterId);
  if (!encounter) throw new Error(`fightWaves: no encounter '${encounterId}'`);
  const turns = turnsFor(kind);
  const ctx = contextFor(level, opts);
  const rng = new RNG(seed);
  let cursor: WaveCursor | null = null;
  const out: UnitTemplate[][] = [];
  for (let t = 0; t < turns; t++) {
    const step = waveForTurn(encounter.waves, cursor, { poolFraction: 1 - t / turns }, rng);
    cursor = step.cursor;
    out.push(resolveWave(step.spec, ctx, rng));
  }
  return out;
}

/** The enemy types a sector's encounters of `kind` field against a hand at
 *  `level`, by share of the bodies, largest first. */
export function fieldedEnemies(sectorId: string, kind: EncounterKind, level: number, opts: EnemyOptions = {}): FieldedEnemy[] {
  const sector = getSector(sectorId);
  if (!sector) throw new Error(`fieldedEnemies: no sector '${sectorId}'`);
  const pool = sector.encounters[kind];
  const totalWeight = pool.reduce((s, e) => s + (e.weight ?? 1), 0);
  const seeds = opts.seeds ?? 200;
  const bodies = new Map<string, number>();
  for (const entry of pool) {
    const w = (entry.weight ?? 1) / totalWeight / seeds;
    for (let seed = 1; seed <= seeds; seed++) {
      for (const wave of fightWaves(entry.encounterId, kind, level, seed, opts)) {
        for (const u of wave) {
          const key = `${u.archetype}\t${u.level}`;
          bodies.set(key, (bodies.get(key) ?? 0) + w);
        }
      }
    }
  }
  const total = [...bodies.values()].reduce((s, v) => s + v, 0);
  return [...bodies.entries()]
    .map(([key, v]) => {
      const [archetype, lvl] = key.split('\t');
      return { archetype: archetype!, level: Number(lvl), share: v / total };
    })
    .sort((a, b) => b.share - a.share);
}
