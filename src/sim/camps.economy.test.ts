/**
 * §75g — the sim half of the run economy: the `campKills` payload on
 * `battle:ended` (omitted when empty — camp-free byte-identity), the
 * `blockCampTurnEnd` knob (default OFF, pinned at §75e; here the ON
 * behavior), and the dormant `enemyPullChance` seam (hostility pre-mark +
 * the enemy engage{tile} order + the anchor-tile objective auto-revert).
 *
 * SIM knobs are module-level config; the ON-paths mutate the parsed object
 * under try/finally (no shipped path sets them, so the mutation window is
 * the test body only).
 */

import { describe, it, expect } from 'vitest';
import { World } from './World';
import type { Unit, UnitStats, Team } from './Unit';
import type { GridCoord } from '../core/types';
import { spawnCamps } from './battleSetup';
import { SIM } from '../config/sim';
import { EventBus } from '../core/EventBus';
import { RNG } from '../core/RNG';
import type { GameEvents } from '../core/events';

const BASE: UnitStats = {
  constitution: 100, strength: 0, ranged: 0, magic: 0, luck: 0, defense: 0,
  precision: 0, evasion: 0, speed: 0, mobility: 0, power: 1,
};

const ANCHOR: GridCoord = { x: 5, y: 5 };

function freshWorld(): { world: World; bus: EventBus<GameEvents> } {
  const bus = new EventBus<GameEvents>();
  return { world: new World(bus, new RNG(1)), bus };
}

function spawnAt(world: World, team: Team, pos: GridCoord): Unit {
  return world.spawnUnit({ archetype: 'mercenary', level: 1, stats: BASE, xp: 0 }, team, pos);
}

/** Drip both bandit-squatters members (neutral-only ticks are silent), park
 *  them, shed the lockouts. */
function dripBoth(world: World): [Unit, Unit] {
  world.tick();
  const m1 = world.units.find((u) => u.campId !== null)!;
  m1.position = { x: 3, y: 3 };
  world.tick();
  const m2 = world.units.find((u) => u.campId !== null && u.id !== m1.id)!;
  m2.position = { x: 3, y: 4 };
  world.clearActiveAction(m1);
  world.clearActiveAction(m2);
  return [m1, m2];
}

function kill(world: World, attacker: Unit, victim: Unit): void {
  world.applyDamage(attacker.id, victim, victim.currentHp, { crit: false, bypassDefense: true });
}

type Ended = GameEvents['battle:ended'];

describe('§75g — the campKills payload', () => {
  it('a wiped camp rides battle:ended with its killer faction', () => {
    const { world, bus } = freshWorld();
    spawnCamps(world, [ANCHOR], [{ campId: 'bandit-squatters' }], 42, 1);
    const [m1, m2] = dripBoth(world);
    const player = spawnAt(world, 'player', { x: 1, y: 1 });
    const enemy = spawnAt(world, 'enemy', { x: 10, y: 10 });
    const payloads: Ended[] = [];
    bus.on('battle:ended', (e) => payloads.push(e));
    kill(world, player, m1);
    kill(world, player, m2);
    kill(world, player, enemy);
    world.tick();
    expect(payloads).toHaveLength(1);
    expect(payloads[0]!.campKills).toEqual([{ defId: 'bandit-squatters', killedBy: 'player' }]);
  });

  it('a camp-free battle OMITS the field (payload byte-identity)', () => {
    const { world, bus } = freshWorld();
    const player = spawnAt(world, 'player', { x: 1, y: 1 });
    const enemy = spawnAt(world, 'enemy', { x: 10, y: 10 });
    const payloads: Ended[] = [];
    bus.on('battle:ended', (e) => payloads.push(e));
    kill(world, player, enemy);
    world.tick();
    expect(payloads).toHaveLength(1);
    expect('campKills' in payloads[0]!).toBe(false);
  });

  it('an un-wiped camp (members alive or pending) contributes nothing', () => {
    // Killing m1 aggros the camp; with the 75j-shipped blockCampTurnEnd the
    // win would be HELD — inject OFF so this stays the no-stamp pin.
    const mutable = SIM as { blockCampTurnEnd: boolean };
    const original = SIM.blockCampTurnEnd;
    mutable.blockCampTurnEnd = false;
    try {
      const { world, bus } = freshWorld();
      spawnCamps(world, [ANCHOR], [{ campId: 'bandit-squatters' }], 42, 1);
      const [m1] = dripBoth(world);
      const player = spawnAt(world, 'player', { x: 1, y: 1 });
      const enemy = spawnAt(world, 'enemy', { x: 10, y: 10 });
      const payloads: Ended[] = [];
      bus.on('battle:ended', (e) => payloads.push(e));
      kill(world, player, m1); // m2 still alive → no stamp
      kill(world, player, enemy);
      world.tick();
      expect(payloads).toHaveLength(1);
      expect('campKills' in payloads[0]!).toBe(false);
    } finally {
      mutable.blockCampTurnEnd = original;
    }
  });
});

describe('§75g — blockCampTurnEnd (the ON behavior; OFF is the §75e pin)', () => {
  it('a decisive win is HELD while an uncleared hostile camp remains, and lands once cleared', () => {
    const mutable = SIM as { blockCampTurnEnd: boolean };
    const original = SIM.blockCampTurnEnd;
    mutable.blockCampTurnEnd = true;
    try {
      const { world, bus } = freshWorld();
      spawnCamps(world, [ANCHOR], [{ campId: 'bandit-squatters' }], 42, 1);
      const [m1, m2] = dripBoth(world);
      const player = spawnAt(world, 'player', { x: 1, y: 1 });
      const enemy = spawnAt(world, 'enemy', { x: 10, y: 10 });
      world.markCampHostile(1, 'player');
      const payloads: Ended[] = [];
      bus.on('battle:ended', (e) => payloads.push(e));
      kill(world, player, enemy);
      for (let t = 0; t < 3; t++) world.tick();
      expect(payloads).toHaveLength(0); // held open — the camp fight is unfinished
      kill(world, player, m1);
      kill(world, player, m2);
      world.tick();
      expect(payloads).toHaveLength(1);
      expect(payloads[0]!.winner).toBe('player');
      expect(payloads[0]!.campKills).toEqual([
        { defId: 'bandit-squatters', killedBy: 'player' },
      ]);
    } finally {
      mutable.blockCampTurnEnd = original;
    }
  });

  it('a camp hostile to the LOSER never holds the winner hostage', () => {
    const mutable = SIM as { blockCampTurnEnd: boolean };
    const original = SIM.blockCampTurnEnd;
    mutable.blockCampTurnEnd = true;
    try {
      const { world, bus } = freshWorld();
      spawnCamps(world, [ANCHOR], [{ campId: 'bandit-squatters' }], 42, 1);
      dripBoth(world);
      const player = spawnAt(world, 'player', { x: 1, y: 1 });
      const enemy = spawnAt(world, 'enemy', { x: 10, y: 10 });
      world.markCampHostile(1, 'enemy'); // hostile to the side about to lose
      const payloads: Ended[] = [];
      bus.on('battle:ended', (e) => payloads.push(e));
      kill(world, player, enemy);
      world.tick();
      expect(payloads).toHaveLength(1); // the player owes this camp nothing
      expect(payloads[0]!.winner).toBe('player');
    } finally {
      mutable.blockCampTurnEnd = original;
    }
  });
});

describe('§75g — the enemyPullChance seam', () => {
  // 75j — the knob shipped LIVE at 0.15 (the feel-pass trial), so the dormant
  // path is pinned by INJECTING 0 (mutate-then-restore), not by asserting the
  // shipped default. Restores capture the original value — a hardcoded
  // restore would leak the wrong knob under isolate:false.
  it('dormant at 0: no hostility, no objective', () => {
    const mutable = SIM as { enemyPullChance: number };
    const original = SIM.enemyPullChance;
    mutable.enemyPullChance = 0;
    try {
      const { world } = freshWorld();
      spawnCamps(world, [ANCHOR], [{ campId: 'bandit-squatters' }], 42, 1);
      world.tick();
      expect(world.campHostileTo(1, 'enemy')).toBe(false);
      expect(world.objectiveFor('enemy')).toEqual({ mode: 'atWill' });
    } finally {
      mutable.enemyPullChance = original;
    }
  });

  // §75j2 — the pull re-authored to the user's design intent: an ordered
  // engage on the pulled camp's PRIMED member (the first consumer of the
  // enemy objective system), with NO pre-marked hostility — damage stays
  // hostility's single source, so a pulled camp reads passive until struck.
  it('live at 1: the enemy team is ordered onto the pulled camp\'s primed member — no pre-hostility', () => {
    const mutable = SIM as { enemyPullChance: number };
    const original = SIM.enemyPullChance;
    mutable.enemyPullChance = 1;
    try {
      const { world } = freshWorld();
      spawnCamps(world, [ANCHOR], [{ campId: 'bandit-squatters' }], 42, 1);
      const primed = world.units.find((u) => u.campId === 1 && u.currentHp > 0);
      expect(primed).toBeDefined();
      expect(world.campHostileTo(1, 'enemy')).toBe(false);
      expect(world.campHostileTo(1, 'player')).toBe(false);
      world.tick(); // the command drains at tick 1
      expect(world.objectiveFor('enemy')).toEqual({
        mode: 'engage',
        target: { kind: 'neutral', unitId: primed!.id },
      });
    } finally {
      mutable.enemyPullChance = original;
    }
  });

  // 83d — the BOSS EXEMPTION (user-signed 2026-08-20): `pullEligible=false`
  // (what `applyTerrain` passes for a `kind:'boss'` encounter) suppresses the
  // pull even at chance 1 — the boss-side wave defends the pool. Camps still
  // spawn and prime normally; only the ordered engage is withheld.
  it('boss boards: pullEligible=false withholds the order even at chance 1 (83d)', () => {
    const mutable = SIM as { enemyPullChance: number };
    const original = SIM.enemyPullChance;
    mutable.enemyPullChance = 1;
    try {
      const { world } = freshWorld();
      spawnCamps(world, [ANCHOR], [{ campId: 'bandit-squatters' }], 42, 1, false);
      const primed = world.units.find((u) => u.campId === 1 && u.currentHp > 0);
      expect(primed).toBeDefined(); // camps themselves are untouched
      world.tick();
      expect(world.objectiveFor('enemy').mode).not.toBe('engage');
    } finally {
      mutable.enemyPullChance = original;
    }
  });

  it('re-rolls per TURN: the same encounter seed disagrees across world seeds (§75j2)', () => {
    // The fetidPond-caught replay defect's regression pin: under the old
    // terrainSeed-parent fork every worldSeed agreed (0 disagreements in an
    // 800-encounter probe). Scan for a disagreeing pair — self-healing (the
    // openEventAtSeedScan shape), no pinned magic seed.
    const mutable = SIM as { enemyPullChance: number };
    const original = SIM.enemyPullChance;
    mutable.enemyPullChance = 0.25;
    try {
      const pulled = (worldSeed: number): boolean => {
        const { world } = freshWorld();
        spawnCamps(world, [ANCHOR], [{ campId: 'bandit-squatters' }], 42, worldSeed);
        world.tick();
        return world.objectiveFor('enemy').mode === 'engage';
      };
      const first = pulled(1);
      let w = 2;
      while (w < 200 && pulled(w) === first) w++;
      expect(w).toBeLessThan(200);
    } finally {
      mutable.enemyPullChance = original;
    }
  });

  it('the order auto-reverts once the ordered member dies (the standard dead-target rule)', () => {
    const mutable = SIM as { enemyPullChance: number };
    const original = SIM.enemyPullChance;
    mutable.enemyPullChance = 1;
    try {
      const { world } = freshWorld();
      spawnCamps(world, [ANCHOR], [{ campId: 'bandit-squatters' }], 42, 1);
      // §75j2 — the order targets the PRIMED member (dripBoth's m1), so the
      // STANDARD dead-target revert covers it: killing the ordered unit
      // reverts even with m2 still alive (no camp-cleared wait — that was
      // the retired anchor-tile order's rule).
      const [m1, m2] = dripBoth(world);
      const player = spawnAt(world, 'player', { x: 1, y: 1 });
      spawnAt(world, 'enemy', { x: 10, y: 10 });
      world.tick();
      expect(world.objectiveFor('enemy')).toEqual({
        mode: 'engage',
        target: { kind: 'neutral', unitId: m1.id },
      });
      kill(world, player, m1);
      world.tick(); // clearResolvedObjectives sees the dead ordered target
      expect(m2.currentHp).toBeGreaterThan(0);
      expect(world.objectiveFor('enemy')).toEqual({ mode: 'atWill' });
    } finally {
      mutable.enemyPullChance = original;
    }
  });
});
