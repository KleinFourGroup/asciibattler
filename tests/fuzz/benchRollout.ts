/**
 * 57d — the clone/tick micro-benchmark that prices the searcher's dials
 * (H · K · cadence · candidate count) against real costs. Re-run whenever
 * the dials are re-derived (57g, the 57f2 box sizing):
 *
 *   npx tsx tests/fuzz/benchRollout.ts
 *
 * Reports: clone cost (ms), clone-tick throughput (ticks/sec), and the
 * projected per-search + per-battle overhead at the §57c v2 local dials.
 */

import { performance } from 'node:perf_hooks';
import { EventBus } from '../../src/core/EventBus';
import type { GameEvents } from '../../src/core/events';
import { RNG } from '../../src/core/RNG';
import { World } from '../../src/sim/World';
import { rollUnit } from '../../src/sim/archetypes';
import { MovementBehavior } from '../../src/sim/behaviors/MovementBehavior';
import { AbilityBehavior } from '../../src/sim/behaviors/AbilityBehavior';
import { createAbility } from '../../src/sim/abilities/registry';
import { cloneForRollout } from '../../src/bot/rollout';

// A representative mid-run battle size (the STANDARD roster is 6-ish a
// side; 8v8 leans conservative) advanced to a mid-battle shape so clones
// carry in-flight actions, claims, and cooldowns.
function midBattle(seed: number): World {
  const world = new World(new EventBus<GameEvents>(), new RNG(seed));
  for (let i = 0; i < 8; i++) {
    const u = world.spawnUnit(rollUnit('mercenary', world.rng), 'player', { x: 2 + i, y: 2 });
    u.behaviors.push(new MovementBehavior(), new AbilityBehavior());
    u.abilities.push(createAbility('sword'));
  }
  for (let i = 0; i < 8; i++) {
    const u = world.spawnUnit(rollUnit('mercenary', world.rng), 'enemy', { x: 2 + i, y: 9 });
    u.behaviors.push(new MovementBehavior(), new AbilityBehavior());
    u.abilities.push(createAbility('sword'));
  }
  for (let i = 0; i < 100 && !world.ended; i++) world.tick();
  return world;
}

const live = midBattle(20260716);

// --- clone cost ---
const CLONES = 200;
{
  cloneForRollout(live, 1); // warm-up (JIT + shape caches)
  const t0 = performance.now();
  for (let i = 0; i < CLONES; i++) cloneForRollout(live, i);
  const ms = (performance.now() - t0) / CLONES;
  console.log(`clone cost: ${ms.toFixed(2)} ms/clone (${CLONES} clones, 16 units mid-battle)`);
}

// --- clone-tick throughput ---
const H = 160; // the §57c v2 local horizon (8s at 20Hz)
const ROLLOUTS = 60;
{
  const t0 = performance.now();
  let ticks = 0;
  for (let k = 0; k < ROLLOUTS; k++) {
    const clone = cloneForRollout(live, 1000 + k);
    for (let i = 0; i < H && !clone.ended; i++) {
      clone.tick();
      ticks++;
    }
  }
  const dt = performance.now() - t0;
  const perSec = (ticks / dt) * 1000;
  console.log(
    `rollout throughput: ${Math.round(perSec)} ticks/sec incl. cloning ` +
      `(${ROLLOUTS} rollouts × H=${H}; ${(dt / ROLLOUTS).toFixed(1)} ms/rollout)`,
  );

  // The projection the dials get priced against (v2 locals: K=2, ~4
  // candidates, ~10 searches per ~500-tick battle).
  const perSearchMs = (dt / ROLLOUTS) * 2 * 4;
  console.log(
    `projected: ~${perSearchMs.toFixed(0)} ms/search (4 candidates × K=2) · ` +
      `~${((perSearchMs * 10) / 1000).toFixed(1)} s/battle (10 searches)`,
  );
}
