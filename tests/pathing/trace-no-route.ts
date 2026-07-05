/**
 * §43 decision-trace tool — traces `no_route` decisions in real river battles
 * (the 42c audit finding: 78-poll spam from a kited archer whose only goal sat
 * inside a rubble footprint; fixed in 43-pre). Runs the same battles as
 * capture.ts, records every `no_route` per unit, and dumps rich per-poll
 * context at each spammer's first occurrence. Kept through the Pathfinding
 * Audit round for §43a/§43b trace work; delete at §46 close-out.
 *
 * Run: npx tsx tests/pathing/trace-no-route.ts
 */

import { EventBus } from '../../src/core/EventBus';
import { RNG } from '../../src/core/RNG';
import { World } from '../../src/sim/World';
import { spawnEncounter } from '../../src/sim/battleSetup';
import { rollUnit } from '../../src/sim/archetypes';
import { getLayout } from '../../src/sim/layouts';
import { currentTarget } from '../../src/sim/Targeting';
import { minRangeForArchetype } from '../../src/sim/archetypes';
import { nearestActingCell } from '../../src/sim/actingPosition';
import { SIM } from '../../src/config/sim';
import { chebyshev } from '../../src/sim/movement';
import type { GameEvents } from '../../src/core/events';
import type { BattleEncounter } from '../../src/run/Run';
import type { Unit } from '../../src/sim/Unit';
import type { GridCoord } from '../../src/core/types';

const TILE_CHAR: Record<string, string> = {
  floor: '.',
  deep_water: '~',
  shallow_water: 's',
  chasm: 'X',
  fire: 'f',
  healing: 'h',
  hills: '^',
  ice: 'i',
  sand: ',',
  mud: 'm',
};

function asciiWorld(world: World, highlight?: Unit, mark?: GridCoord): string {
  const rows: string[][] = [];
  for (let y = 0; y < world.gridH; y++) {
    const row: string[] = [];
    for (let x = 0; x < world.gridW; x++) {
      row.push(TILE_CHAR[world.tileGrid.kindAt({ x, y })] ?? '?');
    }
    rows.push(row);
  }
  for (const u of world.units) {
    if (u.currentHp <= 0) continue;
    const { x, y } = u.position;
    let ch: string;
    if (u.archetype === 'wall') ch = '#';
    else if (u.archetype === 'half_cover') ch = '=';
    else ch = u.team === 'player' ? 'P' : 'E';
    if (highlight && u.id === highlight.id) ch = '@';
    rows[y]![x] = ch;
  }
  if (mark) rows[mark.y]![mark.x] = '*';
  return rows.map((r) => r.join('')).join('\n');
}

function describeUnit(u: Unit | undefined | null): string {
  if (!u) return 'null';
  return `${u.id} ${u.team} ${u.archetype} hp${u.currentHp} @ (${u.position.x},${u.position.y}) range ${u.derived.attackRange}`;
}

function trace(seed: number): void {
  const layout = getLayout('river');
  if (!layout) throw new Error('no river layout');
  const bus = new EventBus<GameEvents>();
  const world = new World(bus, new RNG(seed), layout.gridW, layout.gridH);

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
    layoutId: 'river',
    gridW: world.gridW,
    gridH: world.gridH,
    theme: 'grassland',
    playerTeam: team(),
    enemyTeam: team(),
  };
  spawnEncounter(world, encounter);

  // Snapshot spawn metadata so death logs resolve after removal.
  const meta = new Map<number, string>();
  for (const u of world.units) meta.set(u.id, `${u.team} ${u.archetype}`);

  // `World.tickCount` is private — mirror it off the bus like the test suites do.
  let tick = 0;
  bus.on('tick', (p) => {
    tick = p.tick;
  });

  type Rec = { ticks: number[]; positions: Set<string>; firstReport: string };
  const byUnit = new Map<number, Rec>();

  bus.on('unit:moveDecision', ({ unitId, kind }) => {
    if (kind !== 'no_route') return;
    const unit = world.units.find((u) => u.id === unitId);
    if (!unit) return;
    let rec = byUnit.get(unitId);
    if (!rec) {
      // Reconstruct the MovementBehavior goal computation at this instant.
      const target = currentTarget(unit, world);
      const minRange = minRangeForArchetype(unit.archetype);
      const dist = target ? chebyshev(unit.position, target.position) : -1;
      const losBlockers: GridCoord[] = [];
      for (const u2 of world.units) {
        if (u2.id !== unit.id && u2.team === 'neutral' && u2.blocksLineOfSight)
          losBlockers.push(u2.position);
      }
      const ignoresLos = unit.abilities.some((a) => a.ignoresLineOfSight === true);
      let firingCell: GridCoord | null = null;
      if (target && unit.derived.attackRange > 1) {
        firingCell = nearestActingCell(
          unit.position,
          target.position,
          unit.derived.attackRange,
          SIM.actingCellSearchSlack,
          world,
          ignoresLos ? null : losBlockers,
          minRange,
        );
      }
      const lines = [
        `first no_route @ tick ${tick}`,
        `  unit:   ${describeUnit(unit)} minRange ${minRange} ignoresLos ${ignoresLos}`,
        `  target: ${describeUnit(target)} dist ${dist}`,
        `  firingCell: ${firingCell ? `(${firingCell.x},${firingCell.y})` : 'null'}  targetCellGoal: ${dist >= minRange}`,
        asciiWorld(world, unit, firingCell ?? undefined),
      ];
      rec = { ticks: [], positions: new Set(), firstReport: lines.join('\n') };
      byUnit.set(unitId, rec);
    }
    rec.ticks.push(tick);
    rec.positions.add(`${unit.position.x},${unit.position.y}`);
  });

  const deaths: string[] = [];
  bus.on('unit:died', ({ unitId }) => {
    deaths.push(`t${tick} ${unitId} (${meta.get(unitId) ?? '?'})`);
  });

  for (let i = 0; i < 2000 && !world.ended; i++) world.tick();

  console.log(`\n===== river seed ${seed} — ${tick} ticks =====`);
  console.log(`deaths: ${deaths.join(' | ') || 'none'}`);
  const sorted = [...byUnit.entries()].sort((a, b) => b[1].ticks.length - a[1].ticks.length);
  for (const [unitId, rec] of sorted) {
    console.log(
      `\n-- ${unitId} (${meta.get(unitId) ?? '?'}): ${rec.ticks.length} no_route polls, ` +
        `ticks ${rec.ticks[0]}..${rec.ticks[rec.ticks.length - 1]}, ` +
        `from ${rec.positions.size} cell(s): ${[...rec.positions].join(' ')}`,
    );
    if (rec.ticks.length >= 10) console.log(rec.firstReport);
  }
  if (sorted.length === 0) console.log('no no_route decisions at all');
}

for (const seed of [100, 101, 102]) trace(seed);
