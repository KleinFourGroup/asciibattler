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
import { SPAWN } from '../../src/config/spawn';
import { SPAWN_ACTION_ID } from '../../src/sim/actions/SpawnAction';
import type { GameEvents } from '../../src/core/events';
import type { SpawnRegion } from '../../src/sim/layouts';

function makePlayerRegion(): SpawnRegion {
  // 8 tiles in row y=5, columns 2..9.
  const tiles = Array.from({ length: 8 }, (_, i) => ({ x: i + 2, y: 5 }));
  return { tiles, availability: 'player' };
}

describe('D5.C spawn overflow queue', () => {
  it('queues templates beyond region.tiles capacity and drains them as tiles vacate', () => {
    const bus = new EventBus<GameEvents>();
    const world = new World(bus, new RNG(1));
    const region = makePlayerRegion();
    const rng = new RNG(42);
    const templates = Array.from({ length: 10 }, () => rollUnit('melee', rng));

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
    const templates = Array.from({ length: 10 }, () => rollUnit('melee', rng));

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
      [rollUnit('melee', rng), rollUnit('melee', rng)],
      playerRegion,
      rng,
    );
    // Enemy with a single unit far enough away that nothing fires this tick.
    const enemyRegion: SpawnRegion = {
      tiles: [{ x: 11, y: 11 }],
      availability: 'enemy',
    };
    spawnTeam(world, 'enemy', [rollUnit('melee', rng)], enemyRegion, rng);

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

  it('round-trips queue + regions + abilities + level + damage ledger + xp + roster ids through WorldSnapshot v11', () => {
    const bus = new EventBus<GameEvents>();
    const world = new World(bus, new RNG(1));
    const region = makePlayerRegion();
    const rng = new RNG(42);
    const templates = Array.from({ length: 10 }, () => rollUnit('melee', rng));
    spawnTeam(world, 'player', templates, region, rng);

    const wire = JSON.parse(JSON.stringify(world.toJSON()));
    expect(wire.schemaVersion).toBe(11);
    expect(wire.damageDealt).toEqual([]);
    expect(wire.playerRosterIds).toEqual([]);
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

    // E2: every melee unit on the wire carries `abilities: ['melee_strike']`.
    // E3: every unit on the wire carries `level` (1 for these level-1 rolls).
    for (const us of wire.units) {
      expect(us.abilities).toEqual(['melee_strike']);
      expect(us.level).toBe(1);
    }

    const restored = World.fromJSON(wire, new EventBus<GameEvents>());
    expect(restored.queueLength('player')).toBe(2);
    // Each restored unit gets one MeleeStrike ability back.
    for (const u of restored.units) {
      expect(u.abilities.map((a) => a.id)).toEqual(['melee_strike']);
    }

    // After restore, killing a unit + ticking continues draining the queue.
    const victim = restored.units.find((u) => u.position.x === 2)!;
    victim.currentHp = 0;
    restored.tick();
    expect(restored.queueLength('player')).toBe(1);
  });

  it('rejects v10 snapshots (E4 follow-up playerRosterIds bump is loud)', () => {
    const bus = new EventBus<GameEvents>();
    const world = new World(bus, new RNG(1));
    const wire = JSON.parse(JSON.stringify(world.toJSON()));
    wire.schemaVersion = 10;
    expect(() => World.fromJSON(wire, new EventBus<GameEvents>())).toThrow(
      /unsupported schema version/,
    );
  });
});
