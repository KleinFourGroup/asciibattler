/**
 * §42c — shipped-layout capture for the movement-metrics harness. Mirrors the
 * corridor-flow integration test's battle shape (real archetypes via
 * `rollUnit`, real spawn placement via `spawnEncounter`) so the measured
 * battles are the battles players see — abilities, deaths, kiting and all.
 *
 * Seeds MATTER here (combat rolls perturb paths), unlike the ability-less
 * fixtures — so the CLI reports several seeds per layout. Spawn regions on
 * `both`-availability layouts are seed-picked too: a team may hold either
 * side, which is why the headline drift metric is UNIT-FRAME lateral (side-
 * agnostic); world-frame dx is reported for map-specific reading.
 */

import { EventBus } from '../../src/core/EventBus';
import { RNG } from '../../src/core/RNG';
import { World } from '../../src/sim/World';
import { spawnEncounter } from '../../src/sim/battleSetup';
import { rollUnit } from '../../src/sim/archetypes';
import { getLayout } from '../../src/sim/layouts';
import type { GameEvents } from '../../src/core/events';
import type { BattleEncounter } from '../../src/run/Run';
import { MovementMetricsCollector, type MovementMetrics } from './metrics';

export const CAPTURE_MAX_TICKS = 2000;

/**
 * One measured battle on a shipped layout (`layoutId: null` = procedural
 * terrain). Team composition mirrors corridor-flow: 3 mercenaries + 2 ranged
 * per side, rolled off a seed-derived RNG.
 */
export function measureLayout(layoutId: string | null, seed: number): MovementMetrics {
  const layout = layoutId === null ? null : (getLayout(layoutId) ?? null);
  if (layoutId !== null && layout === null) throw new Error(`unknown layout: ${layoutId}`);
  const bus = new EventBus<GameEvents>();
  const world =
    layout === null ? new World(bus, new RNG(seed)) : new World(bus, new RNG(seed), layout.gridW, layout.gridH);

  const teamRng = new RNG(seed * 31 + 7);
  const team = () => [
    rollUnit('mercenary', teamRng),
    rollUnit('mercenary', teamRng),
    rollUnit('mercenary', teamRng),
    rollUnit('ranged', teamRng),
    rollUnit('ranged', teamRng),
  ];
  const encounter: BattleEncounter = {
    worldSeed: seed,
    terrainSeed: seed,
    layoutId,
    gridW: world.gridW,
    gridH: world.gridH,
    theme: 'grassland', // cosmetic only — no sim effect
    playerTeam: team(),
    enemyTeam: team(),
  };
  spawnEncounter(world, encounter);

  const collector = new MovementMetricsCollector(world, bus);
  for (let i = 0; i < CAPTURE_MAX_TICKS && !world.ended; i++) world.tick();
  return collector.finish();
}

const N = (v: number, digits = 2): string => v.toFixed(digits);

/** One markdown headline row per measured battle. */
export function headlineRow(label: string, seed: number | string, m: MovementMetrics): string {
  const p = m.teams.player;
  const e = m.teams.enemy;
  const tp = m.throughputPer100Ticks;
  return `| ${label} | ${seed} | ${m.ticks} | ${m.timeToFirstContactTicks ?? '—'} | ${N(p.meanNetLateralDrift)} / ${N(e.meanNetLateralDrift)} | ${N(p.meanNetDx)} / ${N(e.meanNetDx)} | ${N(p.oscillationRate, 3)} / ${N(e.oscillationRate, 3)} | ${N(p.zigzagRate, 3)} / ${N(e.zigzagRate, 3)} | ${p.moves} / ${e.moves} | ${N(m.pathfindingCallsPer100Ticks ?? 0, 0)} |${tp === null ? '' : ` ${N(tp)} |`}`;
}

// §45c-pre — two columns joined: zigzag P/E (the flip-flop detector) and
// A*/100t (the repath-count metric §45c must drop measurably).
export const HEADLINE_HEADER = `| map | seed | ticks | ttfc | lat drift P/E | net dx P/E | osc P/E | zigzag P/E | moves P/E | A*/100t |
|---|---|---|---|---|---|---|---|---|---|`;

/** One markdown decision-mix row per team per battle (nonzero kinds only, sorted desc). */
export function mixRows(label: string, seed: number | string, m: MovementMetrics): string[] {
  return (['player', 'enemy'] as const).map((team) => {
    const mix = Object.entries(m.teams[team].decisionMix)
      .filter(([, n]) => n > 0)
      .sort((a, b) => b[1] - a[1])
      .map(([k, n]) => `${k} ${n}`)
      .join(' · ');
    return `| ${label} | ${seed} | ${team} | ${mix} |`;
  });
}

export const MIX_HEADER = `| map | seed | team | decision mix (nonzero, desc) |
|---|---|---|---|`;
