/**
 * D5.C — per-team overflow queue + post-death spawn scan.
 *
 * Covers the four contract pieces:
 *   1. spawnTeam pushes templates beyond region.tiles.length into the
 *      world's per-team queue.
 *   2. World.tick's runOverflowScan drains the queue as tiles vacate,
 *      walking region.tiles in stored order.
 *   3. checkBattleEnd treats a queue-only team as alive (no premature
 *      victory while reinforcements are still pending).
 *   4. WorldSnapshot v4 round-trips spawnQueues + spawnRegions.
 *
 * Tests construct `SpawnRegion` values directly (TS type) rather than
 * routing through the zod schema in `src/config/layouts.ts`, so the
 * 8-tile-per-region constraint doesn't apply here — sizes are picked
 * to make the test invariants legible.
 */

import { describe, it, expect } from 'vitest';
import { EventBus } from '../../src/core/EventBus';
import { World } from '../../src/sim/World';
import { RNG } from '../../src/core/RNG';
import { spawnTeam } from '../../src/sim/battleSetup';
import { rollUnit } from '../../src/sim/archetypes';
import { buildEnemyTeam } from '../../src/run/enemyBudget';
import { DIFFICULTY } from '../../src/config/difficulty';
import { DECK } from '../../src/config/deck';
import { SPAWN } from '../../src/config/spawn';
import { SPAWN_ACTION_ID } from '../../src/sim/actions/SpawnAction';
import type { GameEvents } from '../../src/core/events';
import type { SpawnRegion } from '../../src/sim/layouts';

function makePlayerRegion(): SpawnRegion {
  // 8 tiles in row y=5, columns 2..9.
  const tiles = Array.from({ length: 8 }, (_, i) => ({ x: i + 2, y: 5 }));
  return { tiles, availability: 'player' };
}

function makeEnemyRegion(tileCount = 8): SpawnRegion {
  // `tileCount` tiles along row y=8, columns 0..tileCount-1 (start at 0 so a
  // large region still fits the 12-wide grid).
  const tiles = Array.from({ length: tileCount }, (_, i) => ({ x: i, y: 8 }));
  return { tiles, availability: 'enemy' };
}

describe('D5.C spawn overflow queue', () => {
  it('queues templates beyond region.tiles capacity and drains them as tiles vacate', () => {
    const bus = new EventBus<GameEvents>();
    const world = new World(bus, new RNG(1));
    const region = makePlayerRegion();
    const rng = new RNG(42);
    const templates = Array.from({ length: 10 }, () => rollUnit('mercenary', rng));

    spawnTeam(world, 'player', templates, region, rng);

    expect(world.units.filter((u) => u.team === 'player')).toHaveLength(8);
    expect(world.queueLength('player')).toBe(2);

    // Kill the unit at the FIRST stored region tile (2,5). The scan
    // walks region.tiles in stored order, so the next overflow spawn
    // lands there.
    const victim = world.units.find((u) => u.position.x === 2 && u.position.y === 5)!;
    expect(victim).toBeDefined();
    victim.currentHp = 0;

    world.tick();

    expect(world.queueLength('player')).toBe(1);
    expect(world.units.filter((u) => u.team === 'player')).toHaveLength(8);

    const fresh = world.units.find(
      (u) => u.team === 'player' && u.position.x === 2 && u.position.y === 5,
    );
    expect(fresh).toBeDefined();
    expect(fresh!.activeAction).not.toBeNull();
    expect(fresh!.activeAction!.action.id).toBe(SPAWN_ACTION_ID);
    expect(fresh!.activeAction!.finishTick - fresh!.activeAction!.startTick).toBe(
      SPAWN.durationTicks,
    );
  });

  it('emits unit:spawned with instant:false for overflow spawns and instant:true otherwise', () => {
    const bus = new EventBus<GameEvents>();
    const world = new World(bus, new RNG(1));
    const events: GameEvents['unit:spawned'][] = [];
    bus.on('unit:spawned', (p) => events.push(p));

    const region = makePlayerRegion();
    const rng = new RNG(42);
    const templates = Array.from({ length: 10 }, () => rollUnit('mercenary', rng));

    spawnTeam(world, 'player', templates, region, rng);

    expect(events).toHaveLength(8);
    expect(events.every((e) => e.instant === true)).toBe(true);

    // Free a tile and tick → one overflow spawn fires with instant:false.
    const victim = world.units.find((u) => u.position.x === 2 && u.position.y === 5)!;
    victim.currentHp = 0;
    world.tick();

    const afterSetup = events.slice(8);
    expect(afterSetup).toHaveLength(1);
    expect(afterSetup[0]!.instant).toBe(false);
  });

  it('queue-only team counts as alive (battle does not end while reinforcements are pending)', () => {
    const bus = new EventBus<GameEvents>();
    const world = new World(bus, new RNG(1));
    const ends: GameEvents['battle:ended'][] = [];
    bus.on('battle:ended', (p) => ends.push(p));

    const rng = new RNG(42);
    // 1-tile player region. 2 templates → 1 placed, 1 queued.
    const playerRegion: SpawnRegion = {
      tiles: [{ x: 0, y: 0 }],
      availability: 'player',
    };
    spawnTeam(
      world,
      'player',
      [rollUnit('mercenary', rng), rollUnit('mercenary', rng)],
      playerRegion,
      rng,
    );
    // Enemy with a single unit far enough away that nothing fires this tick.
    const enemyRegion: SpawnRegion = {
      tiles: [{ x: 11, y: 11 }],
      availability: 'enemy',
    };
    spawnTeam(world, 'enemy', [rollUnit('mercenary', rng)], enemyRegion, rng);

    expect(world.queueLength('player')).toBe(1);

    // Wipe the player's on-board unit. Without queue awareness, the
    // enemy would be declared winner this tick.
    const player = world.units.find((u) => u.team === 'player')!;
    player.currentHp = 0;
    world.tick();

    expect(ends).toHaveLength(0);
    expect(world.queueLength('player')).toBe(0);
    expect(world.units.filter((u) => u.team === 'player')).toHaveLength(1);
  });

  it('G4: a budget swarm larger than the spawn region overflows + fully drains', () => {
    // The G4 brief's "transition enemies onto the spawn queue." Enemy count is
    // `min(round(swarmMax × min(roster, handSize)), budget)` — the count basis is
    // the FIELDED hand (the K2 wave-size fix), so the realistic max swarm is
    // `round(swarmMax × handSize)` no matter how big the roster grows. Size the
    // region just BELOW that ceiling so an overflow is guaranteed independent of
    // the difficulty tuning. A high level makes the budget large enough to afford
    // the full count (so `maxCount` is the swarm cap, not the budget).
    const maxSwarm = Math.round(DIFFICULTY.swarmMaxMultiplier * DECK.handSize);
    const REGION = Math.max(2, maxSwarm - 2);
    const bus = new EventBus<GameEvents>();
    const world = new World(bus, new RNG(1));
    // Roster ≥ handSize so the swarm basis is the hand (min(roster, handSize)).
    const player = Array.from({ length: DECK.handSize }, () => rollUnit('mercenary', new RNG(1), 12));

    // Find a seed whose swarm exceeds the region (most do at the default
    // swarmBias; the loop makes the test independent of the knob).
    let enemyTeam = buildEnemyTeam(new RNG(0), player);
    for (let s = 1; enemyTeam.length <= REGION && s < 200; s++) {
      enemyTeam = buildEnemyTeam(new RNG(s), player);
    }
    expect(enemyTeam.length).toBeGreaterThan(REGION);
    const queued = enemyTeam.length - REGION;

    // A lone, far-away player unit keeps the battle from ending while we drain.
    spawnTeam(world, 'player', [rollUnit('mercenary', new RNG(2))], {
      tiles: [{ x: 0, y: 11 }],
      availability: 'player',
    }, new RNG(2));
    spawnTeam(world, 'enemy', enemyTeam, makeEnemyRegion(REGION), new RNG(7));

    expect(world.units.filter((u) => u.team === 'enemy')).toHaveLength(REGION);
    expect(world.queueLength('enemy')).toBe(queued);

    // §36b — isolate the overflow-DRAIN mechanism from movement. With non-instant
    // moves, a unit holds a CLAIM on its destination across the deferred-flip
    // window, and `runOverflowScan` (correctly) won't reinforce onto a claimed
    // tile — so a moving swarm makes the drain cadence movement-sensitive. This
    // test exercises the queue→region drain, not pathing, so freeze every unit
    // (re-freezing each tick to neutralize a just-spawned reinforcement). The
    // claim-aware reinforcement itself is covered by the §35d fuzz invariant.
    const freeze = () => {
      for (const u of world.units) u.behaviors.length = 0;
    };
    freeze();

    // Free one enemy tile per tick; runOverflowScan pulls one queued unit each
    // time. `queued` frees drain the queue completely.
    for (let i = 0; i < queued; i++) {
      const victim = world.units.find((u) => u.team === 'enemy')!;
      victim.currentHp = 0;
      world.tick();
      freeze();
    }
    expect(world.queueLength('enemy')).toBe(0);
  });

  it('round-trips queue + regions + abilities + level + damage ledger + xp + roster ids + sticky target through WorldSnapshot v31', () => {
    const bus = new EventBus<GameEvents>();
    const world = new World(bus, new RNG(1));
    const region = makePlayerRegion();
    const rng = new RNG(42);
    const templates = Array.from({ length: 10 }, () => rollUnit('mercenary', rng));
    spawnTeam(world, 'player', templates, region, rng);

    // E5: pin sticky-target round-trip with non-default values.
    world.units[0]!.targetId = world.units[1]!.id;
    world.units[0]!.outOfLosTicks = 3;

    const wire = JSON.parse(JSON.stringify(world.toJSON()));
    expect(wire.schemaVersion).toBe(31); // 31 — §36a added the in-flight claim registry
    expect(wire.units[0].targetId).toBe(world.units[1]!.id);
    expect(wire.units[0].outOfLosTicks).toBe(3);
    expect(wire.damageDealt).toEqual([]);
    // §36a: the claim registry serializes (empty on a fresh spawn — the instant
    // move model holds no claim).
    expect(wire.claims).toEqual([]);
    expect(wire.playerRosterIds).toEqual([]);
    // F6: utility-contribution ledger serializes (empty on a fresh spawn).
    expect(wire.utilityDone).toEqual([]);
    // E4: every queued template carries an xp (0 on a fresh roll).
    expect(wire.spawnQueues[0].templates.every((t: { xp: number }) => t.xp === 0)).toBe(true);
    expect(wire.spawnQueues).toHaveLength(1);
    expect(wire.spawnQueues[0].team).toBe('player');
    expect(wire.spawnQueues[0].templates).toHaveLength(2);
    // E3: queued templates carry their level on the wire.
    expect(wire.spawnQueues[0].templates[0].level).toBe(1);
    expect(wire.spawnRegions).toHaveLength(1);
    expect(wire.spawnRegions[0].team).toBe('player');
    expect(wire.spawnRegions[0].region.tiles).toEqual(region.tiles);

    // E2: every melee unit on the wire carries its abilities (I6: the mercenary
    // wields the `sword`). E3: every unit carries `level` (1 for these rolls).
    for (const us of wire.units) {
      expect(us.abilities).toEqual(['sword']);
      expect(us.level).toBe(1);
    }

    const restored = World.fromJSON(wire, new EventBus<GameEvents>());
    expect(restored.queueLength('player')).toBe(2);
    expect(restored.units[0]!.targetId).toBe(world.units[1]!.id);
    expect(restored.units[0]!.outOfLosTicks).toBe(3);
    // Each restored unit gets its strike ability back (mercenary → sword).
    for (const u of restored.units) {
      expect(u.abilities.map((a) => a.id)).toEqual(['sword']);
    }

    // After restore, killing a unit + ticking continues draining the queue.
    const victim = restored.units.find((u) => u.position.x === 2)!;
    victim.currentHp = 0;
    restored.tick();
    expect(restored.queueLength('player')).toBe(1);
  });

  it('rejects pre-current snapshots loudly (v12 E5, v13 pre-F2 — old format dies)', () => {
    const bus = new EventBus<GameEvents>();
    const world = new World(bus, new RNG(1));
    // v13 is the immediately-prior format F2 obsoleted (effectTicks → phases);
    // v12 is older still. Any non-current version must throw, not silently
    // mis-load.
    for (const stale of [12, 13]) {
      const wire = JSON.parse(JSON.stringify(world.toJSON()));
      wire.schemaVersion = stale;
      expect(() => World.fromJSON(wire, new EventBus<GameEvents>())).toThrow(
        /unsupported schema version/,
      );
    }
  });
});
