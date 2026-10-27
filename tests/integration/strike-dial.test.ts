/**
 * The strike dial's path from the run to every World a battle is played in:
 * the Run holds the arm as a config input, `battle:started` carries it off
 * `hit`, `battleWorld` sets it, and the World's snapshot keeps it, so the
 * bot's two clones (the World's, the Run's) play the arm the live battle
 * plays. What an arm does to a strike is pinned where the draw is.
 */

import { describe, it, expect } from 'vitest';
import { EventBus } from '../../src/core/EventBus';
import type { GameEvents } from '../../src/core/events';
import { Run } from '../../src/run/Run';
import type { RunConfig } from '../../src/run/RunConfig';
import { World } from '../../src/sim/World';
import { battleWorld, spawnEncounter } from '../../src/sim/battleSetup';
import { cloneForRollout } from '../../src/bot/rollout';
import { cloneRunForRollout } from '../../src/bot/runRollout';
import { STRIKE_ARMS, type StrikeArm } from '../../src/config/stats';

/** A short run walked to its first battle, an elite at the root, with every
 *  `battle:started` payload it emitted. */
function firstBattle(config: RunConfig): {
  run: Run;
  started: GameEvents['battle:started'][];
} {
  const bus = new EventBus<GameEvents>();
  const started: GameEvents['battle:started'][] = [];
  bus.on('battle:started', (p) => started.push(p));
  const run = new Run(11, bus, { hopCount: 3, firstNodeKind: 'elite', ...config });
  run.pauseAtTurnGates = true;
  run.dispatch({ kind: 'enterNode', nodeId: run.nodeMap.rootId });
  run.dispatch({ kind: 'advanceTurn' });
  return { run, started };
}

/** The first battle's World on `strike`, built as the harness builds it. */
function worldOf(run: Run, strike: StrikeArm | undefined): World {
  const world = battleWorld(new EventBus<GameEvents>(), run.currentEncounter!, strike);
  spawnEncounter(world, run.currentEncounter!);
  return world;
}

const wire = (world: World) => JSON.parse(JSON.stringify(world.toJSON())) as ReturnType<World['toJSON']>;

describe('the strike dial, from the run to the battle', () => {
  it('lists `hit` and the three arms', () => {
    expect(STRIKE_ARMS).toEqual(['hit', 'range-0.25', 'range-1', 'mix']);
  });

  it("a run off `hit` puts its arm on its battle's payload", () => {
    const { run, started } = firstBattle({ strike: 'range-1' });
    expect(run.strike).toBe('range-1');
    expect(started).toHaveLength(1);
    expect(started[0]!.strike).toBe('range-1');
  });

  it('at `hit` the payload has no `strike` key, so it is the one it was before the dial', () => {
    for (const config of [{}, { strike: 'hit' as const }]) {
      const { run, started } = firstBattle(config);
      expect(run.strike).toBe('hit');
      expect(started).toHaveLength(1);
      expect(Object.keys(started[0]!).sort()).toEqual(['encounter', 'worldSeed']);
    }
  });

  it('battleWorld sets the arm it is handed, and undefined is `hit`', () => {
    const { run } = firstBattle({ strike: 'mix' });
    expect(wire(worldOf(run, 'mix')).strike).toBe('mix');
    expect(wire(worldOf(run, undefined)).strike).toBe('hit');
  });

  it("a load takes the arm from its config, since the run's snapshot does not hold it", () => {
    const { run } = firstBattle({ strike: 'range-0.25' });
    const snap = JSON.parse(JSON.stringify(run.toJSON())) as ReturnType<Run['toJSON']>;
    expect(JSON.stringify(snap)).not.toContain('range-0.25');
    expect(Run.fromJSON(snap, new EventBus<GameEvents>(), { strike: 'range-0.25' }).strike).toBe('range-0.25');
    expect(Run.fromJSON(snap, new EventBus<GameEvents>()).strike).toBe('hit');
  });

  it("the run's rollout clone takes the live run's arm, which its battles' payloads carry", () => {
    expect(cloneRunForRollout(firstBattle({ strike: 'range-1' }).run, 5).run.strike).toBe('range-1');
    expect(cloneRunForRollout(firstBattle({}).run, 5).run.strike).toBe('hit');
  });
});

describe("the World's snapshot keeps the arm (WorldSnapshot v37)", () => {
  const { run } = firstBattle({});

  it('round-trips every arm byte-faithful', () => {
    for (const arm of STRIKE_ARMS) {
      const world = worldOf(run, arm);
      world.tick();
      const snap = wire(world);
      expect(snap.schemaVersion).toBe(37);
      expect(snap.strike).toBe(arm);
      const restored = World.fromJSON(snap, new EventBus<GameEvents>());
      expect(JSON.stringify(restored.toJSON())).toBe(JSON.stringify(world.toJSON()));
    }
  });

  it("a battle's rollout clone plays the live battle's arm", () => {
    expect(wire(cloneForRollout(worldOf(run, 'range-0.25'), 9)).strike).toBe('range-0.25');
  });

  it('a v36 snapshot, with no arm, is refused rather than read as `hit`', () => {
    const snap = wire(worldOf(run, 'hit')) as unknown as Record<string, unknown>;
    delete snap['strike'];
    expect(() => World.fromJSON({ ...snap, schemaVersion: 36 } as never, new EventBus<GameEvents>())).toThrow(
      /unsupported schema version/,
    );
  });

  it('an arm the config does not hold is refused', () => {
    const snap = wire(worldOf(run, 'hit'));
    expect(() => World.fromJSON({ ...snap, strike: 'range-2' as StrikeArm }, new EventBus<GameEvents>())).toThrow(
      /unknown strike arm 'range-2'/,
    );
  });
});
