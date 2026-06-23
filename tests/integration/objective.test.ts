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
import { createAbility } from '../../src/sim/abilities/registry';
import { rollUnit } from '../../src/sim/archetypes';
import { EventBus } from '../../src/core/EventBus';
import { RNG } from '../../src/core/RNG';
import type { GameEvents } from '../../src/core/events';

/**
 * A small symmetric melee battle: 3 player units at y=1, 3 enemies at y=10.
 * Abilities are built via the production registry (`createAbility`) — the same
 * path `World.fromJSON` rehydrates through — so the mid-battle snapshot tests
 * compare one implementation against itself (Phase Y3: 'sword' resolves to the
 * data-driven `EffectAbility`, not the legacy `MeleeStrike`).
 */
function battle(seed: number): World {
  const world = new World(new EventBus<GameEvents>(), new RNG(seed));
  const cols = [2, 4, 6];
  for (const x of cols) {
    const u = world.spawnUnit(rollUnit('mercenary', world.rng), 'player', { x, y: 1 });
    u.behaviors.push(new MovementBehavior(), new AbilityBehavior());
    u.abilities.push(createAbility('sword'));
  }
  for (const x of cols) {
    const u = world.spawnUnit(rollUnit('mercenary', world.rng), 'enemy', { x, y: 10 });
    u.behaviors.push(new MovementBehavior(), new AbilityBehavior());
    u.abilities.push(createAbility('sword'));
  }
  return world;
}

describe('Objective system (J1) — integration determinism', () => {
  it('same seed + same objective commands → byte-identical battle', () => {
    const run = (): string => {
      const w = battle(777);
      w.enqueueCommand({
        kind: 'setObjective',
        team: 'player',
        objective: { mode: 'engage', target: { kind: 'tile', cell: { x: 6, y: 11 } } },
      });
      for (let i = 0; i < 300 && !w.ended; i++) w.tick();
      return JSON.stringify(w.toJSON());
    };
    expect(run()).toEqual(run());
  });

  it('a mid-battle snapshot with an active objective restores + finishes identically', () => {
    const w = battle(2024);
    const firstEnemy = w.units.find((u) => u.team === 'enemy')!;
    w.enqueueCommand({
      kind: 'setObjective',
      team: 'player',
      objective: { mode: 'engage', target: { kind: 'enemy', unitId: firstEnemy.id } },
    });
    for (let i = 0; i < 30; i++) w.tick();

    // Snapshot mid-battle (the objective may still be active or have auto-reverted
    // to atWill if its target already died — either way it rides the round-trip).
    const wire = JSON.parse(JSON.stringify(w.toJSON()));
    const restored = World.fromJSON(wire, new EventBus<GameEvents>());
    expect(restored.objectiveFor('player')).toEqual(w.objectiveFor('player'));
    expect(restored.objectiveFor('enemy')).toEqual(w.objectiveFor('enemy'));

    for (let i = 0; i < 400 && !w.ended; i++) w.tick();
    for (let i = 0; i < 400 && !restored.ended; i++) restored.tick();
    expect(JSON.stringify(restored.toJSON())).toEqual(JSON.stringify(w.toJSON()));
  });
});

describe('Hold mode (O2) — integration', () => {
  it('a fully-held board is a static stalemate (no moves, no deaths — the turn cap draws it)', () => {
    // Both teams hold, spawned far apart (players y=1, enemies y=10): nobody is
    // in anybody's reach, so nobody moves and nobody attacks. World.tick never
    // ENDS such a board (no elimination); the harness / BattleScene turn cap
    // (N2) is what resolves a stalemate as a capped draw. This pins the "no
    // paralysis / no hang" property at the sim level: the board is a fixed point.
    const w = battle(909);
    w.enqueueCommand({ kind: 'setObjective', team: 'player', objective: { mode: 'hold' } });
    w.enqueueCommand({ kind: 'setObjective', team: 'enemy', objective: { mode: 'hold' } });
    const snap = (): unknown =>
      w.units.map((u) => ({ id: u.id, x: u.position.x, y: u.position.y, hp: u.currentHp }));
    const before = snap();
    for (let i = 0; i < 200 && !w.ended; i++) w.tick();
    expect(snap()).toEqual(before); // nobody moved, nobody took damage
    expect(w.ended).toBe(false); // no elimination → only the turn cap can end it
  });

  it('same seed + hold commands → byte-identical battle', () => {
    // Player holds in place while the (atWill) enemies close + attack — real
    // combat, so this exercises hold determinism under fire, not just a stalemate.
    const run = (): string => {
      const w = battle(555);
      w.enqueueCommand({ kind: 'setObjective', team: 'player', objective: { mode: 'hold' } });
      for (let i = 0; i < 300 && !w.ended; i++) w.tick();
      return JSON.stringify(w.toJSON());
    };
    expect(run()).toEqual(run());
  });
});

describe('Focus mode (O3) — integration', () => {
  it('same seed + a focus enemy command → byte-identical battle', () => {
    // All three players focus-fire one enemy (the full preempt drives a real,
    // behavior-driven battle — beeline + engage), under the shipped default config.
    const run = (): string => {
      const w = battle(424);
      const firstEnemy = w.units.find((u) => u.team === 'enemy')!;
      w.enqueueCommand({
        kind: 'setObjective',
        team: 'player',
        objective: { mode: 'focus', target: { kind: 'enemy', unitId: firstEnemy.id } },
      });
      for (let i = 0; i < 300 && !w.ended; i++) w.tick();
      return JSON.stringify(w.toJSON());
    };
    expect(run()).toEqual(run());
  });

  it('a mid-battle snapshot with an active focus TILE objective restores + finishes identically', () => {
    // A tile focus persists (leashAtNearest never reverts), so it's reliably
    // still active at the snapshot point — the focus rides the round-trip.
    const w = battle(2025);
    w.enqueueCommand({
      kind: 'setObjective',
      team: 'player',
      objective: { mode: 'focus', target: { kind: 'tile', cell: { x: 6, y: 11 } } },
    });
    for (let i = 0; i < 30; i++) w.tick();

    const wire = JSON.parse(JSON.stringify(w.toJSON()));
    const restored = World.fromJSON(wire, new EventBus<GameEvents>());
    expect(restored.objectiveFor('player')).toEqual(w.objectiveFor('player'));
    expect(restored.objectiveFor('player').mode).toBe('focus'); // still live across the trip
    expect(restored.objectiveFor('enemy')).toEqual(w.objectiveFor('enemy'));

    for (let i = 0; i < 400 && !w.ended; i++) w.tick();
    for (let i = 0; i < 400 && !restored.ended; i++) restored.tick();
    expect(JSON.stringify(restored.toJSON())).toEqual(JSON.stringify(w.toJSON()));
  });
});
