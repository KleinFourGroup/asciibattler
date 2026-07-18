/**
 * 57f — the searcher's arbitration contracts on crafted worlds:
 *
 * 1. COMMIT — a proposal that objectively beats the null arm lands (1
 *    merc vs 3 CLOSE holding enemies: charging dies well inside the
 *    horizon, holding is a clean stand-off).
 * 2. NULL FLOOR — a worse proposal is rejected outright (3v1 wipe:
 *    holding scores ~0 against a wipe's +WIN_BONUS).
 * 3. CADENCE — no re-search inside the window; expiry re-arms it.
 * 4. DEATH / CONTACT TRIGGERS — either edge re-searches immediately,
 *    inside the cadence window.
 * 5. FOREIGN-ORDER CONSERVATISM — an externally-set objective silences
 *    the searcher entirely (the §54 ownership rule).
 * 6. DETERMINISM — same seeds + same config ⇒ the same command
 *    sequence over a driven battle.
 *
 * Tests drain committed commands into the world (enqueue + tick), the
 * harness placement contract — a committed objective must actually
 * STAND for the follow-up decides to read the real state.
 */

import { describe, expect, it } from 'vitest';
import { EventBus } from '../core/EventBus';
import type { GameEvents } from '../core/events';
import { RNG } from '../core/RNG';
import { World } from '../sim/World';
import { rollUnit } from '../sim/archetypes';
import { MovementBehavior } from '../sim/behaviors/MovementBehavior';
import { AbilityBehavior } from '../sim/behaviors/AbilityBehavior';
import { createAbility } from '../sim/abilities/registry';
import type { WorldCommand } from '../sim/Command';
import type { TrafficScript } from './TrafficScriptDriver';
import { RolloutSearchDriver } from './RolloutSearchDriver';

/** Always-nominating hold — the searcher decides whether it's any good. */
const HOLD_ALWAYS: TrafficScript = {
  id: 'test-hold-always',
  evaluate: () => ({ mode: 'hold' }),
};

function spawnMerc(world: World, team: 'player' | 'enemy', x: number, y: number) {
  const u = world.spawnUnit(rollUnit('mercenary', world.rng), team, { x, y });
  u.behaviors.push(new MovementBehavior(), new AbilityBehavior());
  u.abilities.push(createAbility('sword'));
  return u;
}

/** 1 player merc vs 3 CLOSE holding enemies: a charge engages within a
 *  few tiles and dies 1v3 well inside the horizon; a hold at 3 tiles'
 *  distance is a stable stand-off. The unambiguous commit. */
function outnumbered(seed: number): World {
  const world = new World(new EventBus<GameEvents>(), new RNG(seed));
  spawnMerc(world, 'player', 4, 2);
  spawnMerc(world, 'enemy', 3, 5);
  spawnMerc(world, 'enemy', 4, 5);
  spawnMerc(world, 'enemy', 5, 5);
  world.enqueueCommand({ kind: 'setObjective', team: 'enemy', objective: { mode: 'hold' } });
  world.tick();
  return world;
}

/** 3 players vs 1 holding enemy: the wipe is right there; holding is a
 *  strictly worse idea. */
function overwhelming(seed: number): World {
  const world = new World(new EventBus<GameEvents>(), new RNG(seed));
  spawnMerc(world, 'player', 2, 2);
  spawnMerc(world, 'player', 4, 2);
  spawnMerc(world, 'player', 6, 2);
  spawnMerc(world, 'enemy', 4, 9);
  world.enqueueCommand({ kind: 'setObjective', team: 'enemy', objective: { mode: 'hold' } });
  world.tick();
  return world;
}

const driver = (seed: number, config = {}) =>
  new RolloutSearchDriver('player', new RNG(seed), { scripts: [HOLD_ALWAYS], ...config });

/** decide → enqueue → tick: the harness placement contract. */
function step(world: World, d: RolloutSearchDriver): WorldCommand[] {
  const cmds = d.decide(world);
  for (const c of cmds) world.enqueueCommand(c);
  world.tick();
  return cmds;
}

describe('RolloutSearchDriver (57f — rollout arbitration)', () => {
  it('commits a proposal that beats the null arm (outnumbered: hold > charge)', () => {
    const world = outnumbered(101);
    const d = driver(1);
    expect(d.decide(world)).toEqual([
      { kind: 'setObjective', team: 'player', objective: { mode: 'hold' } },
    ]);
    expect(d.searchCount).toBe(1);
  });

  it('rejects a proposal the null arm beats (overwhelming: wipe > hold)', () => {
    const world = overwhelming(101);
    const d = driver(1);
    expect(d.decide(world)).toEqual([]);
    expect(d.searchCount).toBe(1); // it DID search; the null floor won
  });

  it('does not re-search inside the cadence window; expiry re-arms', () => {
    const world = outnumbered(101);
    const d = driver(1, { cadenceTicks: 20 });
    expect(step(world, d)).toHaveLength(1); // search 1 commits hold; it stands
    expect(d.searchCount).toBe(1);

    // Gated for the window's remainder (everyone holding: no deaths, no
    // contact — only cadence can re-arm), then exactly one re-search.
    let gatedSteps = 0;
    while (d.searchCount === 1 && gatedSteps < 40) {
      step(world, d);
      gatedSteps++;
    }
    expect(d.searchCount).toBe(2);
    expect(gatedSteps).toBeGreaterThanOrEqual(18);
    expect(gatedSteps).toBeLessThanOrEqual(22);
  });

  it('a death re-searches immediately, inside the cadence window', () => {
    const world = outnumbered(101);
    const d = driver(1, { cadenceTicks: 10_000 });
    step(world, d); // commits hold
    step(world, d);
    expect(d.searchCount).toBe(1); // gated

    const enemy = world.units.find((u) => u.team === 'enemy' && u.currentHp > 0)!;
    enemy.currentHp = 0; // the living count drops on the next read
    d.decide(world);
    expect(d.searchCount).toBe(2);
  });

  it('a contact transition re-searches immediately, inside the cadence window', () => {
    const world = outnumbered(101);
    const d = driver(1, { cadenceTicks: 10_000 });
    step(world, d); // commits hold
    step(world, d);
    expect(d.searchCount).toBe(1);

    // A player spawning adjacent to a holding enemy flips armiesInContact
    // (and RAISES the living count — deliberately not a death signal).
    spawnMerc(world, 'player', 4, 4);
    d.decide(world);
    expect(d.searchCount).toBe(2);
  });

  it('a foreign objective silences the searcher (the §54 ownership rule)', () => {
    const world = overwhelming(101);
    world.enqueueCommand({
      kind: 'setObjective',
      team: 'player',
      objective: { mode: 'hold' },
    });
    world.tick();
    const d = driver(1);
    expect(d.decide(world)).toEqual([]);
    expect(d.searchCount).toBe(0); // never even searched
  });

  it('is deterministic: same seeds + config ⇒ the same command sequence', () => {
    const run = (): WorldCommand[] => {
      const world = outnumbered(2024);
      const d = driver(7, { cadenceTicks: 15 });
      const all: WorldCommand[] = [];
      for (let i = 0; i < 60 && !world.ended; i++) {
        all.push(...step(world, d));
      }
      return all;
    };
    expect(JSON.stringify(run())).toBe(JSON.stringify(run()));
  });
});

describe('57g.5 — the K-prefix instrument', () => {
  it('telemetry mode does not change the decision (the mean-aggregation contract, end to end)', () => {
    // Both the commit case and the reject case, at K=8: the instrumented
    // driver's per-seed means must reproduce the batch path's decisions
    // exactly (same-seeded rng ⇒ same CRN seed sets).
    for (const make of [outnumbered, overwhelming]) {
      const plain = driver(1, { rolloutsPerCandidate: 8 });
      const instrumented = driver(1, { rolloutsPerCandidate: 8, kFlipTelemetry: true });
      expect(instrumented.decide(make(101))).toEqual(plain.decide(make(101)));
    }
  });

  it('counts searches, and flips only at sub-K prefixes', () => {
    const d = driver(1, { rolloutsPerCandidate: 8, kFlipTelemetry: true });
    d.decide(outnumbered(101));
    const stats = d.kFlipStats;
    expect(stats.searches).toBe(1);
    for (const [prefix, flips] of stats.byPrefix) {
      expect([2, 4]).toContain(prefix);
      expect(flips).toBeGreaterThanOrEqual(0);
      expect(flips).toBeLessThanOrEqual(stats.searches);
    }
  });

  it('K=2 has no sub-prefixes — the flip map stays empty', () => {
    const d = driver(1, { kFlipTelemetry: true }); // default K = 2
    d.decide(outnumbered(101));
    expect(d.kFlipStats.searches).toBe(1);
    expect(d.kFlipStats.byPrefix.size).toBe(0);
  });
});
