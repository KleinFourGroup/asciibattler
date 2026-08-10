/**
 * §75k — the ordered-engage destructible-gate FREEZE (caught live on the
 * revised rubbleQuarry placement, worklog §75j-close): a melee unit whose
 * `engage{neutral}` objective (the §75j2 pull / the 75h click-to-engage) sat
 * behind auto-target rubble FROZE instead of auto-breaking through. The
 * ordered pursue branch re-committed the unreachable mark every tick and
 * never consulted the §40b rubble overlay — that overlay rides only the
 * atWill acquisition path — so MovementBehavior's path came back empty and
 * the unit proposed nothing, forever.
 *
 * These pin the fix (`applyOrderedRubbleFallback`): the pursue branches of
 * BOTH ordered modes (engage AND focus — the same latent class) fall back to
 * the nearest approachable auto-target rubble when the ordered target is
 * unreachable, the full loop (chip → breach → ordered first blow → camp-wide
 * aggro) completes under real ticks on both the player arm (click-to-engage)
 * and the enemy arm (the §75j2 pull rails), and a deliberate focus ON an
 * inert destructible is left alone (no re-rank onto a nearer rubble).
 */

import { describe, it, expect } from 'vitest';
import { World } from './World';
import type { Unit, UnitStats, Team } from './Unit';
import type { GridCoord } from '../core/types';
import { spawnCamps } from './battleSetup';
import { spawnWall, spawnRubble } from './environment';
import { updateTarget } from './Targeting';
import { AbilityBehavior } from './behaviors/AbilityBehavior';
import { createMovementBehavior } from './behaviors/registry';
import { createAbility } from './abilities/registry';
import { abilityIdsForArchetype } from './archetypes';
import { EventBus } from '../core/EventBus';
import { RNG } from '../core/RNG';
import type { GameEvents } from '../core/events';

const BASE: UnitStats = {
  constitution: 100, strength: 30, ranged: 0, magic: 0, luck: 0, defense: 0,
  precision: 0, evasion: 0, speed: 0, mobility: 0, power: 1,
};

// A healthy chip→breach→blow loop completes in well under this; the freeze
// (pre-fix) idles straight through it.
const MAX_TICKS = 600;

function freshWorld(): World {
  return new World(new EventBus<GameEvents>(), new RNG(1));
}

/** A COMBAT-EQUIPPED mercenary — behaviors + abilities wired the way
 *  battleSetup does it (a bare `spawnUnit` template carries neither). */
function spawnAt(world: World, team: Team, pos: GridCoord): Unit {
  const u = world.spawnUnit({ archetype: 'mercenary', level: 1, stats: BASE, xp: 0 }, team, pos);
  u.behaviors.push(createMovementBehavior('mercenary'), new AbilityBehavior());
  for (const aid of abilityIdsForArchetype('mercenary')) u.abilities.push(createAbility(aid));
  return u;
}

/** Drip both bandit-squatters members (ticking a neutral-only board is
 *  silent), park m1 at (6,6) — the pocket anchor — and m2 out of the way. */
function dripMembers(world: World): [Unit, Unit] {
  spawnCamps(world, [{ x: 10, y: 10 }], [{ campId: 'bandit-squatters' }], 42, 1);
  world.tick();
  const m1 = world.units.find((u) => u.campId !== null)!;
  m1.position = { x: 6, y: 6 };
  world.tick();
  const m2 = world.units.find((u) => u.campId !== null && u.id !== m1.id)!;
  m2.position = { x: 11, y: 2 };
  m1.activeAction = null;
  m2.activeAction = null;
  return [m1, m2];
}

/**
 * The rubbleQuarry shape, distilled: camp member m1 walled into a pocket at
 * (6,6) whose ONLY breach is an auto-target rubble gate at (6,7) — or, with
 * `sealed`, an eighth WALL there instead (no breach at all, the §75k2
 * genuinely-unreachable case; `gate` is then the wall, never chippable).
 */
function buildEnclosure(world: World, opts: { sealed?: boolean } = {}): { m1: Unit; gate: Unit } {
  const [m1] = dripMembers(world);
  for (const [x, y] of [[5, 5], [6, 5], [7, 5], [5, 6], [7, 6], [5, 7], [7, 7]] as const) {
    spawnWall(world, { x, y });
  }
  const gate =
    opts.sealed === true ? spawnWall(world, { x: 6, y: 7 }) : spawnRubble(world, { x: 6, y: 7 }, 1, 15);
  return { m1, gate };
}

function orderEngage(world: World, team: 'player' | 'enemy', unitId: number): void {
  world.enqueueCommand({
    kind: 'setObjective',
    team,
    objective: { mode: 'engage', target: { kind: 'neutral', unitId } },
  });
  world.tick(); // drain the command
}

/** Keep the battle genuinely open (both factions on the board, like every
 *  real encounter — one faction alone ends decisively at tick 1, the camp
 *  still being PASSIVE so blockCampTurnEnd doesn't hold it). The dummy is
 *  parked far away under a `hold` objective so it never interferes. */
function parkOpposingDummy(world: World, team: 'player' | 'enemy'): void {
  spawnAt(world, team, { x: 0, y: 11 });
  world.enqueueCommand({ kind: 'setObjective', team, objective: { mode: 'hold' } });
}

describe('§75k — the ordered-engage rubble auto-break (the destructible-gate freeze)', () => {
  it('engage{neutral} on an unreachable camp member redirects the mark onto the gate rubble', () => {
    const world = freshWorld();
    const { m1, gate } = buildEnclosure(world);
    const attacker = spawnAt(world, 'player', { x: 6, y: 10 });
    orderEngage(world, 'player', m1.id);
    updateTarget(attacker, world);
    // Pre-fix: the pursue branch held the unreachable m1 mark and the unit froze.
    expect(attacker.targetId).toBe(gate.id);
  });

  it('focus{neutral} on an unreachable camp member shares the fallback (the class, closed)', () => {
    const world = freshWorld();
    const { m1, gate } = buildEnclosure(world);
    const attacker = spawnAt(world, 'player', { x: 6, y: 10 });
    world.enqueueCommand({
      kind: 'setObjective',
      team: 'player',
      objective: { mode: 'focus', target: { kind: 'neutral', unitId: m1.id } },
    });
    world.tick();
    updateTarget(attacker, world);
    expect(attacker.targetId).toBe(gate.id);
  });

  it('a deliberate focus ON an inert destructible is NOT re-ranked onto nearer rubble', () => {
    const world = freshWorld();
    const attacker = spawnAt(world, 'player', { x: 1, y: 1 });
    spawnRubble(world, { x: 2, y: 2 }, 1, 15); // nearer — must not steal the mark
    const far = spawnRubble(world, { x: 8, y: 8 }, 1, 15);
    world.enqueueCommand({
      kind: 'setObjective',
      team: 'player',
      objective: { mode: 'focus', target: { kind: 'neutral', unitId: far.id } },
    });
    world.tick();
    updateTarget(attacker, world);
    expect(attacker.targetId).toBe(far.id);
  });

  it('player arm (click-to-engage): chip → breach → ordered first blow → aggro, under real ticks', () => {
    const world = freshWorld();
    const { m1, gate } = buildEnclosure(world);
    spawnAt(world, 'player', { x: 6, y: 10 });
    parkOpposingDummy(world, 'enemy');
    orderEngage(world, 'player', m1.id);
    for (let i = 0; i < MAX_TICKS && !world.campHostileTo(1, 'player'); i++) world.tick();
    // Pre-fix: the unit froze at spawn — the gate untouched, the camp never aggroed.
    expect(gate.currentHp).toBeLessThanOrEqual(0);
    expect(world.campHostileTo(1, 'player')).toBe(true);
  });

  it('enemy arm (the §75j2 pull rails): the pulled team breaks through identically', () => {
    const world = freshWorld();
    const { m1, gate } = buildEnclosure(world);
    spawnAt(world, 'enemy', { x: 6, y: 10 });
    parkOpposingDummy(world, 'player');
    orderEngage(world, 'enemy', m1.id);
    for (let i = 0; i < MAX_TICKS && !world.campHostileTo(1, 'enemy'); i++) world.tick();
    expect(gate.currentHp).toBeLessThanOrEqual(0);
    expect(world.campHostileTo(1, 'enemy')).toBe(true);
  });
});

describe('§75k2 — the ROUTE-AWARE gate pick (the labyrinth two-camp catch)', () => {
  it('chips the gate on the route to the ordered target, NOT the nearest rubble on the board', () => {
    const world = freshWorld();
    const { m1, gate } = buildEnclosure(world);
    // The labyrinth shape distilled: an OFF-ROUTE rubble nearer to the
    // attacker than the pocket's gate — 75k's nearest-pick chipped this one.
    const decoy = spawnRubble(world, { x: 8, y: 10 }, 1, 15);
    const attacker = spawnAt(world, 'player', { x: 6, y: 10 });
    orderEngage(world, 'player', m1.id);
    updateTarget(attacker, world);
    expect(attacker.targetId).toBe(gate.id);
    expect(decoy.currentHp).toBe(15);
  });

  it('double gate: a sequentially-gated corridor is chipped nearest-first, gate by gate, to the breach', () => {
    const world = freshWorld();
    const { m1, gate } = buildEnclosure(world); // gate1 at (6,7)
    // Extend the corridor one cell south: a second rubble gate at (6,8),
    // walled to one-wide, so the route crosses BOTH gates in sequence.
    spawnWall(world, { x: 5, y: 8 });
    spawnWall(world, { x: 7, y: 8 });
    const gate2 = spawnRubble(world, { x: 6, y: 8 }, 1, 15);
    const attacker = spawnAt(world, 'player', { x: 6, y: 10 });
    parkOpposingDummy(world, 'enemy');
    orderEngage(world, 'player', m1.id);
    updateTarget(attacker, world);
    expect(attacker.targetId).toBe(gate2.id); // first-on-route = the NEAR gate
    for (let i = 0; i < MAX_TICKS && !world.campHostileTo(1, 'player'); i++) world.tick();
    expect(gate2.currentHp).toBeLessThanOrEqual(0);
    expect(gate.currentHp).toBeLessThanOrEqual(0);
    expect(world.campHostileTo(1, 'player')).toBe(true);
  });

  it('a target sealed by WALLS holds the ordered mark — no futile chip of off-route rubble', () => {
    const world = freshWorld();
    const { m1 } = buildEnclosure(world, { sealed: true });
    const decoy = spawnRubble(world, { x: 8, y: 10 }, 1, 15);
    const attacker = spawnAt(world, 'player', { x: 6, y: 10 });
    parkOpposingDummy(world, 'enemy');
    orderEngage(world, 'player', m1.id);
    updateTarget(attacker, world);
    expect(attacker.targetId).toBe(m1.id); // held, not redirected — 75k chipped the decoy
    for (let i = 0; i < 100; i++) world.tick();
    expect(attacker.targetId).toBe(m1.id);
    expect(decoy.currentHp).toBe(15); // never touched
  });

  it('a multi-tile (2x2) gate resolves through its body cells', () => {
    const world = freshWorld();
    const [m1] = dripMembers(world);
    // A pocket whose whole south mouth is one 2x2 rubble body (corner 6,7 →
    // cells (6,7)(7,7)(6,8)(7,8)); walls seal the remaining ring.
    for (const [x, y] of [[5, 5], [6, 5], [7, 5], [5, 6], [7, 6], [5, 7]] as const) {
      spawnWall(world, { x, y });
    }
    const gate = spawnRubble(world, { x: 6, y: 7 }, 2, 20);
    const attacker = spawnAt(world, 'player', { x: 6, y: 10 });
    orderEngage(world, 'player', m1.id);
    updateTarget(attacker, world);
    expect(attacker.targetId).toBe(gate.id);
  });
});
