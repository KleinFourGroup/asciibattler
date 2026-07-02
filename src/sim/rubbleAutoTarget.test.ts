import { describe, it, expect } from 'vitest';
import { World } from './World';
import { Unit, type Team, type UnitStats } from './Unit';
import { EventBus } from '../core/EventBus';
import { RNG } from '../core/RNG';
import { deriveStats } from './stats';
import { ARCHETYPE_CONFIG, abilityIdsForArchetype } from './archetypes';
import { updateTarget, currentTarget } from './Targeting';
import { MovementBehavior } from './behaviors/MovementBehavior';
import { AbilityBehavior } from './behaviors/AbilityBehavior';
import { createMovementBehavior } from './behaviors/registry';
import { createAbility } from './abilities/registry';
import { spawnRubble, spawnWall } from './environment';
import type { GameEvents } from '../core/events';

/**
 * §40b-② — the rubble AUTO-TARGET hook. A unit WALLED OFF from every hostile by a
 * destructible rubble chips the blocking rubble ("deny access until destroyed");
 * a reachable hostile always outranks rubble, and an indestructible wall is never
 * auto-targeted. The whole overlay is gated on the board holding a live auto-target
 * rubble, so a rubble-free board (every shipped map + all fuzz) is byte-identical.
 *
 * Fixtures hand-place combatants (high ids) but spawn rubble/walls through the REAL
 * spawn path (low ids from World's counter — no collision), so the rubble carries
 * its catalog footprint / hp / `autoTarget`.
 */

const MERC_STATS: UnitStats = { ...ARCHETYPE_CONFIG.mercenary.baseStats, luck: 0 };

function world(gridW: number, gridH: number): World {
  return new World(new EventBus<GameEvents>(), new RNG(1), gridW, gridH);
}

/** A hand-placed melee combatant. `equipped` wires a real strike + AbilityBehavior
 *  (for the chip→reap integration); otherwise just MovementBehavior. */
function place(
  w: World,
  id: number,
  team: Team,
  x: number,
  y: number,
  opts: { moveCd?: number; equipped?: boolean } = {},
): Unit {
  let derived = deriveStats(MERC_STATS, 1); // melee range 1
  if (opts.moveCd !== undefined) derived = { ...derived, moveCooldownTicks: opts.moveCd };
  const u = new Unit({
    id,
    team,
    archetype: 'mercenary',
    glyph: 'M',
    stats: MERC_STATS,
    derived,
    position: { x, y },
  });
  if (opts.equipped) {
    u.behaviors.push(createMovementBehavior('mercenary'), new AbilityBehavior());
    for (const aid of abilityIdsForArchetype('mercenary')) u.abilities.push(createAbility(aid));
  } else {
    u.behaviors.push(new MovementBehavior());
  }
  w.units.push(u);
  return u;
}

describe('§40b — rubble auto-target: selection', () => {
  it('commits to a blocking rubble when the only hostile is unreachable', () => {
    const w = world(5, 1); // a 1-wide corridor: the rubble fully seals it
    const player = place(w, 100, 'player', 0, 0);
    const rubble = spawnRubble(w, { x: 2, y: 0 }, 1);
    place(w, 101, 'enemy', 4, 0);

    updateTarget(player, w);

    expect(player.targetId).toBe(rubble.id);
    expect(currentTarget(player, w)?.archetype).toBe('rubble_1x1');
  });

  it('keeps a REACHABLE hostile and ignores rubble (reachable hostiles outrank rubble)', () => {
    const w = world(5, 3); // 3 tall → a path exists AROUND the rubble
    const player = place(w, 100, 'player', 0, 1);
    spawnRubble(w, { x: 2, y: 1 }, 1); // does not seal the corridor
    const enemy = place(w, 101, 'enemy', 4, 1);

    updateTarget(player, w);

    expect(player.targetId).toBe(enemy.id);
  });

  it('is a no-op when the board holds no auto-target rubble (the byte-identical gate)', () => {
    const w = world(5, 1);
    const player = place(w, 100, 'player', 0, 0);
    spawnWall(w, { x: 2, y: 0 }); // an INDESTRUCTIBLE wall seals it — never auto-targeted
    const enemy = place(w, 101, 'enemy', 4, 0);

    updateTarget(player, w);

    // No rubble on the board → the overlay never runs; the classic pick (the
    // now-unreachable enemy) stands exactly as pre-§40b. The wall is not chipped.
    expect(player.targetId).toBe(enemy.id);
  });

  it('§40c — a DESTRUCTIBLE wall sealing the corridor is still never auto-targeted', () => {
    // A §40c destructible wall is combat-targetable (AoE / manual / focused fire) but
    // carries NO `autoTarget`, so — unlike rubble — a walled-off unit does NOT auto-
    // commit to chipping it. It keeps the (now unreachable) hostile, exactly like the
    // indestructible-wall case above. `autoTarget` (not mere HP-presence) gates the hook.
    const w = world(5, 1);
    const player = place(w, 100, 'player', 0, 0);
    spawnWall(w, { x: 2, y: 0 }, 40); // DESTRUCTIBLE (hp present) but NOT an auto-target
    const enemy = place(w, 101, 'enemy', 4, 0);

    updateTarget(player, w);

    expect(player.targetId).toBe(enemy.id); // the classic pick stands; the wall isn't chipped
  });

  it('prefers a reachable farther hostile over the rubble when the nearest is walled off', () => {
    // A 1-wide corridor sealed by rubble to the RIGHT (enemy A unreachable); the
    // grid opens to a second row on the LEFT where enemy B sits (reachable).
    const w = world(5, 2);
    const player = place(w, 100, 'player', 2, 0);
    // Seal the right half of row 0 with rubble + a wall so enemy A is unreachable.
    spawnRubble(w, { x: 3, y: 0 }, 1);
    spawnWall(w, { x: 3, y: 1 });
    const enemyA = place(w, 101, 'enemy', 4, 0); // sealed behind the rubble
    const enemyB = place(w, 102, 'enemy', 0, 0); // open on the left (reachable)

    updateTarget(player, w);

    expect([enemyA.id, enemyB.id]).toContain(player.targetId); // a hostile, not rubble
    expect(player.targetId).toBe(enemyB.id); // specifically the reachable one
  });
});

describe('§40b — rubble auto-target: currentTarget', () => {
  it('honors a committed destructible rubble but never an indestructible wall', () => {
    const w = world(5, 1);
    const player = place(w, 100, 'player', 0, 0);
    const rubble = spawnRubble(w, { x: 2, y: 0 }, 1);
    const wall = spawnWall(w, { x: 3, y: 0 });

    player.targetId = rubble.id;
    expect(currentTarget(player, w)?.id).toBe(rubble.id);

    player.targetId = wall.id; // an indestructible neutral is never a valid target
    expect(currentTarget(player, w)).toBeNull();
  });
});

describe('§40b — rubble auto-target: movement approach', () => {
  it('bestEffort-approaches a committed rubble, then abstains once body-adjacent', () => {
    const w = world(6, 1);
    const player = place(w, 100, 'player', 0, 0);
    const rubble = spawnRubble(w, { x: 3, y: 0 }, 1);
    player.targetId = rubble.id;
    const mover = new MovementBehavior();

    // Out of reach → proposes a step toward the rubble (the hard-blocker approach).
    expect(mover.proposeAction(player, w)).not.toBeNull();

    // Adjacent to the rubble → abstains (in range → AbilityBehavior fires the strike).
    player.position = { x: 2, y: 0 };
    expect(mover.proposeAction(player, w)).toBeNull();
  });
});

describe('§40b — rubble auto-target: integration', () => {
  it('a walled-off unit paths up to the blocking rubble over ticks', () => {
    const w = world(6, 1);
    const player = place(w, 100, 'player', 0, 0, { moveCd: 1 });
    const rubble = spawnRubble(w, { x: 3, y: 0 }, 1);
    place(w, 101, 'enemy', 5, 0); // behind the rubble, unreachable

    for (let i = 0; i < 8; i++) w.tick();

    expect(player.targetId).toBe(rubble.id);
    expect(player.position).toEqual({ x: 2, y: 0 }); // parked body-adjacent to rubble@3
  });

  it('an equipped unit chips down the blocking rubble, reaps it, then reaches + defeats the sealed enemy', () => {
    // The whole "deny access until destroyed" loop, end to end: the enemy is sealed
    // behind the rubble in a 1-wide corridor, so it can ONLY be reached once the
    // rubble crumbles. The unit's melee has no reach to the enemy until then.
    const w = world(6, 1);
    place(w, 100, 'player', 0, 0, { moveCd: 1, equipped: true });
    const rubble = spawnRubble(w, { x: 2, y: 0 }, 1);
    const enemy = place(w, 101, 'enemy', 5, 0);
    const rubbleStartHp = rubble.currentHp;

    // Run until the sealed enemy is defeated (or a generous cap).
    let i = 0;
    for (; i < 400 && w.units.includes(enemy); i++) w.tick();

    expect(rubble.currentHp).toBeLessThan(rubbleStartHp); // the wall took strike damage…
    expect(w.units.includes(rubble)).toBe(false); // …crumbled at 0 HP (the reap)…
    expect(w.units.includes(enemy)).toBe(false); // …and the freed unit then reached + killed the enemy
  });
});
