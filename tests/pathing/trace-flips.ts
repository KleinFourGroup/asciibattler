/**
 * §45c-pre decision-trace tool — attributes route FLIPS (committed moves whose
 * direction inverts an axis vs the unit's previous move — the harness's
 * `zigzag` metric) to their cause, feeding the §45c (a)-serialize vs
 * (b)-derive decision with data instead of vibes. For every flip on the
 * §45c-owned layouts (endlessCorridors, isthmus, labyrinth), the tool
 * re-derives the unit's route under counterfactual cost contexts:
 *
 *   - RETARGET  — the unit's target changed between the two moves: an honest
 *                 re-aim, no hysteresis would (or should) prevent it.
 *   - CLAIM     — with all CLAIMS stripped from the cost context, the route
 *                 agrees with the previous heading: the flip was claim-flicker
 *                 (a peer's transient move reservation re-priced the lane).
 *                 A derivable cost-hysteresis kills these — option (b).
 *   - BODY      — claims kept, but with ALL soft unit costs stripped the
 *                 route agrees with the previous heading: body-shuffle
 *                 flicker (peers stepping in/out of the lane). Also (b)-able
 *                 via margin, though stickier.
 *   - GEOMETRY  — even the terrain-only route disagrees with the previous
 *                 heading: the goal itself moved / the optimum genuinely
 *                 changed. Route memory — option (a) — is the only thing that
 *                 would stop these, and mostly SHOULDN'T (chasing is honest).
 *
 * Caveats (diagnostic tool, not sim): the probe approximates every unit's
 * goal as its target's position (ranged units really path to a firing cell),
 * and it runs inside the `unit:moved` handler mid-tick, so peer state is
 * whatever the execution order left. Read the DISTRIBUTION, not single rows.
 * Probes are pure reads (no RNG, no writes) — the traced battle is identical
 * to the measured one. Kept through the Pathfinding Audit round; delete at
 * §46 close-out alongside trace-no-route.ts.
 *
 * Run: npx tsx tests/pathing/trace-flips.ts
 */

import { EventBus } from '../../src/core/EventBus';
import { RNG } from '../../src/core/RNG';
import { World } from '../../src/sim/World';
import { spawnEncounter } from '../../src/sim/battleSetup';
import { rollUnit } from '../../src/sim/archetypes';
import { getLayout } from '../../src/sim/layouts';
import { currentTarget } from '../../src/sim/Targeting';
import { buildMovementContext, routeToward, type MovementContext } from '../../src/sim/movement';
import type { GameEvents } from '../../src/core/events';
import type { BattleEncounter } from '../../src/run/Run';
import type { GridCoord } from '../../src/core/types';

type Cause = 'retarget' | 'claim' | 'body' | 'geometry';

interface LastMove {
  dir: { dx: number; dy: number };
  targetId: number | null;
}

const dirOf = (from: GridCoord, to: GridCoord) => ({
  dx: Math.sign(to.x - from.x),
  dy: Math.sign(to.y - from.y),
});

const inverts = (a: { dx: number; dy: number }, b: { dx: number; dy: number }) =>
  a.dx * b.dx === -1 || a.dy * b.dy === -1;

/** The context with claims stripped (still soft-blocked by bodies). */
function withoutClaims(ctx: MovementContext): MovementContext {
  const other = new Set(ctx.otherUnitCells);
  const occ = new Set(ctx.occupied);
  for (const k of ctx.claimed.keys()) {
    other.delete(k);
    occ.delete(k);
  }
  return { ...ctx, otherUnitCells: other, occupied: occ, claimed: new Map() };
}

/** The context with EVERY soft unit cost stripped (terrain + walls only). */
function terrainOnly(ctx: MovementContext): MovementContext {
  return {
    ...ctx,
    otherUnitCells: new Set(),
    occupied: new Set(),
    vacatingEta: new Map(),
    claimed: new Map(),
  };
}

function trace(layoutId: string, seed: number): Record<Cause, number> & { moves: number } {
  const layout = getLayout(layoutId);
  if (!layout) throw new Error(`no layout ${layoutId}`);
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
    layoutId,
    gridW: world.gridW,
    gridH: world.gridH,
    theme: 'grassland',
    playerTeam: team(),
    enemyTeam: team(),
  };
  spawnEncounter(world, encounter);

  const last = new Map<number, LastMove>();
  const counts: Record<Cause, number> & { moves: number } = {
    retarget: 0,
    claim: 0,
    body: 0,
    geometry: 0,
    moves: 0,
  };

  bus.on('unit:moved', ({ unitId, from, to }) => {
    const unit = world.units.find((u) => u.id === unitId);
    if (!unit || unit.team === 'neutral') return;
    counts.moves++;
    const dir = dirOf(from, to);
    const target = currentTarget(unit, world);
    const targetId = target?.id ?? null;
    const prev = last.get(unitId);
    last.set(unitId, { dir, targetId });
    if (!prev || !inverts(prev.dir, dir)) return;

    // A flip. Attribute it.
    if (targetId !== prev.targetId) {
      counts.retarget++;
      return;
    }
    if (!target) {
      counts.geometry++; // no goal to probe against — rare; count honestly.
      return;
    }
    const ctx = buildMovementContext(unit, world, { excludeUnitId: target.id });
    const probe = (c: MovementContext): { dx: number; dy: number } | null => {
      const path = routeToward(from, target.position, c, world);
      return path.length < 2 ? null : dirOf(from, path[1]!);
    };
    const noClaims = probe(withoutClaims(ctx));
    if (noClaims !== null && !inverts(prev.dir, noClaims)) {
      counts.claim++;
      return;
    }
    const bare = probe(terrainOnly(ctx));
    if (bare !== null && !inverts(prev.dir, bare)) {
      counts.body++;
      return;
    }
    counts.geometry++;
  });

  for (let i = 0; i < 2000 && !world.ended; i++) world.tick();
  return counts;
}

const LAYOUTS = ['endlessCorridors', 'isthmus', 'labyrinth'];
const SEEDS = [100, 101, 102];

console.log('| layout | seed | moves | flips | retarget | claim | body | geometry |');
console.log('|---|---|---|---|---|---|---|---|');
const total: Record<Cause, number> = { retarget: 0, claim: 0, body: 0, geometry: 0 };
let totalFlips = 0;
for (const layoutId of LAYOUTS) {
  for (const seed of SEEDS) {
    const c = trace(layoutId, seed);
    const flips = c.retarget + c.claim + c.body + c.geometry;
    totalFlips += flips;
    for (const k of ['retarget', 'claim', 'body', 'geometry'] as const) total[k] += c[k];
    console.log(
      `| ${layoutId} | ${seed} | ${c.moves} | ${flips} | ${c.retarget} | ${c.claim} | ${c.body} | ${c.geometry} |`,
    );
  }
}
const pct = (n: number) => (totalFlips === 0 ? '—' : `${((n / totalFlips) * 100).toFixed(0)}%`);
console.log(
  `\nTOTAL flips ${totalFlips}: retarget ${total.retarget} (${pct(total.retarget)}) · ` +
    `claim ${total.claim} (${pct(total.claim)}) · body ${total.body} (${pct(total.body)}) · ` +
    `geometry ${total.geometry} (${pct(total.geometry)})`,
);
