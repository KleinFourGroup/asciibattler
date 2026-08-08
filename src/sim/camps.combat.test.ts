/**
 * §75e — the combat widening: hostility gates targeting in BOTH directions,
 * aggro + kill credit ride the damage chokepoint, and camp fights earn XP
 * (the shape-lock's signed XP-yes call). Pins the worksheet's combat rows:
 * the `hostileCandidate` admit rule (passive camps are scenery to targeting),
 * the confusion-pool design call (chaos is chaos), the drip-aware `killedBy`
 * stamp, the ordered-first-blow guarantee in `currentTarget`, the kite path,
 * AoE targetability, and the two checkBattleEnd invariants (neutral-only
 * boards stay silent; camps never extend a battle).
 */

import { describe, it, expect } from 'vitest';
import { World } from './World';
import type { Unit, UnitStats, Team } from './Unit';
import type { GridCoord } from '../core/types';
import { spawnCamps } from './battleSetup';
import { spawnWall } from './environment';
import { findTarget, updateTarget, currentTarget } from './Targeting';
import { engagementDirective } from './positioning';
import { isCombatTargetable } from './effects/targeting';
import { statusDef } from '../config/statuses';
import { EventBus } from '../core/EventBus';
import { RNG } from '../core/RNG';
import type { GameEvents } from '../core/events';

const BASE: UnitStats = {
  constitution: 100, strength: 0, ranged: 0, magic: 0, luck: 0, defense: 0,
  precision: 0, evasion: 0, speed: 0, mobility: 0, power: 1,
};

function freshWorld(): { world: World; bus: EventBus<GameEvents> } {
  const bus = new EventBus<GameEvents>();
  return { world: new World(bus, new RNG(1)), bus };
}

function spawnAt(world: World, team: Team, pos: GridCoord, archetype = 'mercenary'): Unit {
  return world.spawnUnit({ archetype, level: 1, stats: BASE, xp: 0 }, team, pos);
}

/** Drip BOTH bandit-squatters members out of the portal (ticking a
 *  neutral-only board is silent — combat never began), park them, and shed
 *  the spawn lockouts. Call BEFORE spawning any faction units. */
function dripBoth(world: World, at1: GridCoord, at2: GridCoord): [Unit, Unit] {
  spawnCamps(world, [{ x: 10, y: 10 }], [{ campId: 'bandit-squatters' }], 42);
  world.tick();
  const m1 = world.units.find((u) => u.campId !== null)!;
  m1.position = at1;
  world.tick();
  const m2 = world.units.find((u) => u.campId !== null && u.id !== m1.id)!;
  m2.position = at2;
  m1.activeAction = null;
  m2.activeAction = null;
  return [m1, m2];
}

/** A lethal, unmissable, defense-bypassing blow (attribution-exact). */
function kill(world: World, attacker: Unit, victim: Unit): void {
  world.applyDamage(attacker.id, victim, victim.currentHp, { crit: false, bypassDefense: true });
}

describe('§75e — hostility gates targeting (both directions)', () => {
  it('a passive camp member is scenery to findTarget; a hostile one is admitted per-faction', () => {
    const { world } = freshWorld();
    const [camp] = dripBoth(world, { x: 4, y: 4 }, { x: 9, y: 9 });
    const player = spawnAt(world, 'player', { x: 3, y: 3 });
    const enemy = spawnAt(world, 'enemy', { x: 3, y: 5 });
    // Passive: neither faction sees the camp; they see each other.
    expect(findTarget(player, world)?.id).toBe(enemy.id);
    expect(findTarget(enemy, world)?.id).toBe(player.id);
    world.markCampHostile(1, 'player');
    // Hostile-to-player: the player unit now ranks the closer camp member;
    // the enemy faction (unmarked) still doesn't see it.
    expect(findTarget(player, world)?.id).toBe(camp.id);
    expect(findTarget(enemy, world)?.id).toBe(player.id);
  });

  it('a camp member acquires only the factions its camp is hostile to', () => {
    const { world } = freshWorld();
    const [camp] = dripBoth(world, { x: 4, y: 4 }, { x: 9, y: 9 });
    const player = spawnAt(world, 'player', { x: 1, y: 1 });
    spawnAt(world, 'enemy', { x: 4, y: 5 }); // ADJACENT — nearest would pick it
    updateTarget(camp, world);
    expect(camp.targetId).toBeNull(); // passive camps never target
    world.markCampHostile(1, 'player');
    updateTarget(camp, world);
    expect(camp.targetId).toBe(player.id); // the farther player, not the unmarked enemy
  });

  it('currentTarget honors an ordered commitment on a PASSIVE camp member (the first-blow guarantee)', () => {
    const { world } = freshWorld();
    const [camp] = dripBoth(world, { x: 4, y: 4 }, { x: 9, y: 9 });
    const player = spawnAt(world, 'player', { x: 3, y: 3 });
    player.targetId = camp.id; // what a 75h click-to-engage order resolves to
    expect(currentTarget(player, world)?.id).toBe(camp.id);
  });

  it('confusion admits active neutrals (chaos is chaos), and the mark is honored', () => {
    const { world } = freshWorld();
    const [m1, m2] = dripBoth(world, { x: 4, y: 4 }, { x: 9, y: 9 });
    const player = spawnAt(world, 'player', { x: 4, y: 5 });
    world.applyStatusEffect(player, statusDef('confusion'), null);
    updateTarget(player, world);
    // The only candidates are the two (passive!) camp members — the re-roll
    // must land on one of them, and the neutral mark must be honored.
    expect([m1.id, m2.id]).toContain(player.targetId);
    expect(currentTarget(player, world)?.id).toBe(player.targetId);
  });
});

describe('§75e — aggro + XP ride the damage chokepoint', () => {
  it('striking a camp member marks the WHOLE camp hostile to the attacker faction only, and records XP', () => {
    const { world } = freshWorld();
    const [camp] = dripBoth(world, { x: 4, y: 4 }, { x: 9, y: 9 });
    const player = spawnAt(world, 'player', { x: 3, y: 3 });
    expect(world.campHostileTo(1, 'player')).toBe(false);
    world.applyDamage(player.id, camp, 5, { crit: false, bypassDefense: true });
    expect(world.campHostileTo(1, 'player')).toBe(true);
    expect(world.campHostileTo(1, 'enemy')).toBe(false);
    // XP-yes (signed): the ledger credits damage to active neutrals.
    expect(world.damageDealtBy(player.id)).toBe(5);
  });

  it('damage to an INERT neutral still records nothing', () => {
    const { world } = freshWorld();
    const wall = spawnWall(world, { x: 6, y: 6 });
    const player = spawnAt(world, 'player', { x: 3, y: 3 });
    world.applyDamage(player.id, wall, 5, { crit: false, bypassDefense: true });
    expect(world.damageDealtBy(player.id)).toBe(0);
  });

  it('AoE targetability: camp member yes, wall no', () => {
    const { world } = freshWorld();
    const [camp] = dripBoth(world, { x: 4, y: 4 }, { x: 9, y: 9 });
    const wall = spawnWall(world, { x: 6, y: 6 });
    expect(isCombatTargetable(camp)).toBe(true);
    expect(isCombatTargetable(wall)).toBe(false);
  });
});

describe('§75e — the drip-aware camp-kill stamp', () => {
  it('killedBy stays null while members are pending or alive; the wiping blow stamps the faction', () => {
    const { world } = freshWorld();
    spawnCamps(world, [{ x: 5, y: 5 }], [{ campId: 'bandit-squatters' }], 42);
    world.tick(); // member #1 drips; #2 still pending
    const m1 = world.units.find((u) => u.campId !== null)!;
    const player = spawnAt(world, 'player', { x: 1, y: 1 });
    kill(world, player, m1);
    // Pending non-empty → no stamp yet (the drip-aware half).
    expect(world.campById(1)!.killedBy).toBeNull();
    world.tick(); // #1 reaped, #2 drips onto the freed anchor
    const m2 = world.units.find((u) => u.campId !== null && u.currentHp > 0)!;
    kill(world, player, m2);
    expect(world.campById(1)!.killedBy).toBe('player');
  });

  it('a living-source DoT wipe attributes through the status sourceUnitId', () => {
    const { world } = freshWorld();
    const [m1, m2] = dripBoth(world, { x: 4, y: 4 }, { x: 9, y: 9 });
    const player = spawnAt(world, 'player', { x: 1, y: 1 });
    spawnAt(world, 'enemy', { x: 11, y: 11 }); // keeps the battle running through the ticks
    kill(world, player, m1);
    m2.currentHp = 1;
    world.applyStatusEffect(m2, statusDef('poison'), player.id);
    for (let i = 0; i < 200 && m2.currentHp > 0; i++) world.tick();
    expect(m2.currentHp).toBeLessThanOrEqual(0);
    expect(world.campById(1)!.killedBy).toBe('player');
  });
});

describe('§75e — checkBattleEnd invariants', () => {
  it('camps never extend a battle: last enemy down ends it with camp members still alive', () => {
    const { world, bus } = freshWorld();
    dripBoth(world, { x: 4, y: 4 }, { x: 9, y: 9 });
    spawnAt(world, 'player', { x: 1, y: 1 });
    world.markCampHostile(1, 'player');
    const ended: string[] = [];
    bus.on('battle:ended', (e) => ended.push(e.winner));
    world.tick(); // player alive, no enemy → the battle resolves NOW
    expect(ended).toEqual(['player']);
  });

  it('a neutral-only board stays silent (combat never began)', () => {
    const { world, bus } = freshWorld();
    dripBoth(world, { x: 4, y: 4 }, { x: 9, y: 9 });
    const ended: string[] = [];
    bus.on('battle:ended', (e) => ended.push(e.winner));
    for (let i = 0; i < 5; i++) world.tick();
    expect(ended).toEqual([]);
  });
});

describe('§75e — the engagement protocol treats a hostile camp member as mobile', () => {
  it('a ranged unit gets the real firing-cell path (not the rubble bestEffort corner-charge)', () => {
    const { world } = freshWorld();
    const [camp] = dripBoth(world, { x: 6, y: 6 }, { x: 9, y: 9 });
    const archer = spawnAt(world, 'player', { x: 1, y: 1 }, 'archer');
    world.markCampHostile(1, 'player');
    const directive = engagementDirective(archer, world, camp, 0);
    expect(directive.kind).toBe('approach');
    if (directive.kind === 'approach') {
      // The mobile-target shape: pursued-target exclusion, no bestEffort.
      expect(directive.intent.excludeUnitId).toBe(camp.id);
      expect(directive.intent.bestEffort).not.toBe(true);
    }
  });
});

describe('§75e — a hostile camp member fights (the stats/archetype verify pin)', () => {
  it('an aggroed camp bandit closes and damages a player unit under real ticks', () => {
    const { world } = freshWorld();
    const [m1, m2] = dripBoth(world, { x: 5, y: 5 }, { x: 9, y: 9 });
    const dummy = spawnAt(world, 'player', { x: 3, y: 5 });
    spawnAt(world, 'enemy', { x: 11, y: 11 }); // keeps the battle running
    world.markCampHostile(1, 'player');
    for (let i = 0; i < 200 && dummy.currentHp === dummy.derived.maxHp; i++) world.tick();
    expect(dummy.currentHp).toBeLessThan(dummy.derived.maxHp);
    // Both members still belong to a living camp — no kill stamp.
    expect(world.campById(1)!.killedBy).toBeNull();
    expect(m1.currentHp).toBeGreaterThan(0);
    expect(m2.currentHp).toBeGreaterThan(0);
  });
});
