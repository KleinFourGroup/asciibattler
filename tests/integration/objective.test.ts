/**
 * J1 — objective-system determinism over a real (multi-unit, behavior-driven)
 * battle. The unit-level decisions live in `Targeting.test.ts` /
 * `MovementBehavior.test.ts` / `World.test.ts`; this guards the two
 * sim-contract properties the objective must not break:
 *   1. same seed + same objective commands → byte-identical battle;
 *   2. a mid-battle snapshot with an active objective restores + finishes
 *      identically (the objective rides the round-trip, resume stays
 *      deterministic).
 */

import { describe, it, expect } from 'vitest';
import { World } from '../../src/sim/World';
import { MovementBehavior } from '../../src/sim/behaviors/MovementBehavior';
import { AbilityBehavior } from '../../src/sim/behaviors/AbilityBehavior';
import { MeleeStrike } from '../../src/sim/abilities/strikes';
import { rollUnit } from '../../src/sim/archetypes';
import { EventBus } from '../../src/core/EventBus';
import { RNG } from '../../src/core/RNG';
import type { GameEvents } from '../../src/core/events';

/** A small symmetric melee battle: 3 player units at y=1, 3 enemies at y=10. */
function battle(seed: number): World {
  const world = new World(new EventBus<GameEvents>(), new RNG(seed));
  const cols = [2, 4, 6];
  for (const x of cols) {
    const u = world.spawnUnit(rollUnit('mercenary', world.rng), 'player', { x, y: 1 });
    u.behaviors.push(new MovementBehavior(), new AbilityBehavior());
    u.abilities.push(new MeleeStrike('sword'));
  }
  for (const x of cols) {
    const u = world.spawnUnit(rollUnit('mercenary', world.rng), 'enemy', { x, y: 10 });
    u.behaviors.push(new MovementBehavior(), new AbilityBehavior());
    u.abilities.push(new MeleeStrike('sword'));
  }
  return world;
}

describe('Objective system (J1) — integration determinism', () => {
  it('same seed + same objective commands → byte-identical battle', () => {
    const run = (): string => {
      const w = battle(777);
      w.enqueueCommand({ kind: 'setObjective', objective: { kind: 'tile', cell: { x: 6, y: 11 } } });
      for (let i = 0; i < 300 && !w.ended; i++) w.tick();
      return JSON.stringify(w.toJSON());
    };
    expect(run()).toEqual(run());
  });

  it('a mid-battle snapshot with an active objective restores + finishes identically', () => {
    const w = battle(2024);
    const firstEnemy = w.units.find((u) => u.team === 'enemy')!;
    w.enqueueCommand({ kind: 'setObjective', objective: { kind: 'enemy', unitId: firstEnemy.id } });
    for (let i = 0; i < 30; i++) w.tick();

    // Snapshot mid-battle (the objective may still be active or have auto-cleared
    // if its target already died — either way it rides the round-trip).
    const wire = JSON.parse(JSON.stringify(w.toJSON()));
    const restored = World.fromJSON(wire, new EventBus<GameEvents>());
    expect(restored.objective).toEqual(w.objective);

    for (let i = 0; i < 400 && !w.ended; i++) w.tick();
    for (let i = 0; i < 400 && !restored.ended; i++) restored.tick();
    expect(JSON.stringify(restored.toJSON())).toEqual(JSON.stringify(w.toJSON()));
  });
});
