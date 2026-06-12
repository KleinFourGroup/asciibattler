/**
 * H4 — the multi-turn encounter loop, driven by REAL tactical Worlds.
 *
 * Run.test.ts pins the loop's pool arithmetic with faked `battle:ended`
 * survivor-power chips. This suite proves the loop actually composes with the
 * tactical layer: each turn builds a real `World` from `run.currentEncounter`
 * (exactly as `BattleScene` does — `new World(worldSeed, gridW, gridH)` +
 * `spawnEncounter`), ticks it to a real decisive end (or the per-turn tick cap
 * → `resolveAsDraw`), and lets the World's real `survivorPower` chip the pools.
 *
 * The driver POLLS `run.currentEncounter` between turns rather than subscribing
 * to `battle:started` — that avoids the synchronous `battle:ended → battle:started`
 * re-entrancy the live H4b screens will break with their async gates.
 */

import { describe, it, expect } from 'vitest';
import { EventBus } from '../../src/core/EventBus';
import { World } from '../../src/sim/World';
import { RNG } from '../../src/core/RNG';
import { spawnEncounter } from '../../src/sim/battleSetup';
import { secondsToTicks } from '../../src/config';
import { HEALTH } from '../../src/config/health';
import type { GameEvents } from '../../src/core/events';
import { Run, type BattleEncounter } from '../../src/run/Run';

const DEFAULT_TURN_TICKS = secondsToTicks(HEALTH.maxTurnSeconds);

/** Build a World for one turn exactly as BattleScene.mount does. */
function buildWorld(enc: BattleEncounter, bus: EventBus<GameEvents>): World {
  const world = new World(bus, new RNG(enc.worldSeed), enc.gridW, enc.gridH);
  spawnEncounter(world, enc);
  return world;
}

interface TurnRecord {
  enc: BattleEncounter;
  pool: { player: number; enemy: number };
}

/**
 * Drive the active encounter to its end, one real World per turn. Returns the
 * per-turn record (the encounter that was fought + the pools after it
 * resolved). `maxTurnTicks` overrides the per-turn cap — pass `1` to force
 * every turn to the tick-cap draw.
 */
function driveEncounter(
  run: Run,
  bus: EventBus<GameEvents>,
  maxTurnTicks: number = DEFAULT_TURN_TICKS,
): TurnRecord[] {
  const turns: TurnRecord[] = [];
  let guard = 0;
  for (;;) {
    // M1 — a level-up pauses the loop at the turn boundary (mid-encounter OR
    // on the final turn); dismiss and re-enter, like the fuzz harness does.
    if (run.phase === 'promotion') {
      run.dispatch({ kind: 'dismissPromotion' });
      continue;
    }
    if (run.phase !== 'battle' || !run.currentEncounter) break;
    if (++guard > HEALTH.maxTurns + 5) {
      throw new Error(`encounter did not terminate (ran ${guard} turns)`);
    }
    const enc = run.currentEncounter;
    const world = buildWorld(enc, bus);
    let t = 0;
    while (!world.ended && t < maxTurnTicks) {
      world.tick();
      t++;
    }
    // Per-turn tick cap → resolve as a draw (both sides chip). On a decisive
    // end this is a no-op (the World already emitted battle:ended). Either
    // way the emit advances `run` synchronously to the next turn / encounter.
    if (!world.ended) world.resolveAsDraw();
    turns.push({ enc, pool: { player: run.playerHealth, enemy: run.enemyHealth } });
  }
  return turns;
}

function firstFrontier(run: Run): number {
  return run.nodeMap.edges.find((e) => e.from === run.nodeMap.rootId)!.to;
}

const LVL1_ROSTER = [
  { archetype: 'mercenary' as const, level: 1 },
  { archetype: 'mercenary' as const, level: 1 },
  { archetype: 'mercenary' as const, level: 1 },
  { archetype: 'ranged' as const, level: 1 },
  { archetype: 'ranged' as const, level: 1 },
];

describe('H4: encounter loop over real battles', () => {
  for (const seed of [1, 2, 3, 4]) {
    it(`seed ${seed}: a real encounter terminates and ends the node`, () => {
      const bus = new EventBus<GameEvents>();
      const run = new Run(seed, bus);
      run.dispatch({ kind: 'enterNode', nodeId: firstFrontier(run) });

      const turns = driveEncounter(run, bus);

      expect(turns.length).toBeGreaterThanOrEqual(1);
      expect(turns.length).toBeLessThanOrEqual(HEALTH.maxTurns);
      expect(run.phase).not.toBe('battle');
      expect(['recruit', 'promotion', 'defeat']).toContain(run.phase);
      expect(run.currentEncounter).toBeNull();
      // The outcome was driven by a pool emptying (decisive) or the turn cap.
      if (run.phase === 'defeat') {
        expect(run.playerHealth === 0 || run.turnIndex === HEALTH.maxTurns).toBe(true);
      } else {
        expect(run.enemyHealth === 0 || run.turnIndex === HEALTH.maxTurns).toBe(true);
      }
      expect(run.playerHealth).toBeGreaterThanOrEqual(0);
      expect(run.enemyHealth).toBeGreaterThanOrEqual(0);
    });
  }

  it('a restored run reproduces the encounter turn-for-turn (resume determinism)', () => {
    const busA = new EventBus<GameEvents>();
    const a = new Run(7, busA);
    a.dispatch({ kind: 'enterNode', nodeId: firstFrontier(a) });

    // Snapshot mid-encounter (turn 1 pending), restore on a fresh bus.
    const wire = JSON.parse(JSON.stringify(a.toJSON()));
    const busB = new EventBus<GameEvents>();
    const b = Run.fromJSON(wire, busB);

    const turnsA = driveEncounter(a, busA);
    const turnsB = driveEncounter(b, busB);

    // Same number of turns, byte-identical encounters (worldSeed + waves), and
    // the same final pools/phase — the snapshotted run RNG alone reconstructed
    // every future turn's freshly-rolled wave.
    expect(turnsB.map((t) => t.enc)).toEqual(turnsA.map((t) => t.enc));
    expect(b.phase).toBe(a.phase);
    expect(b.playerHealth).toBe(a.playerHealth);
    expect(b.enemyHealth).toBe(a.enemyHealth);
  });

  it('a per-turn tick cap resolves as a draw that chips BOTH pools', () => {
    const bus = new EventBus<GameEvents>();
    const run = new Run(1, bus, { startingRoster: LVL1_ROSTER });
    run.dispatch({ kind: 'enterNode', nodeId: firstFrontier(run) });

    // 1-tick cap → no turn resolves decisively; every turn is a draw where
    // both full surviving teams chip. The first turn must dent BOTH pools.
    const turns = driveEncounter(run, bus, 1);

    expect(turns[0]!.pool.enemy).toBeLessThan(HEALTH.enemyHealthMax);
    expect(turns[0]!.pool.player).toBeLessThan(HEALTH.playerHealthMax);
    // Still terminates within the safety cap.
    expect(run.phase).not.toBe('battle');
    expect(run.turnIndex).toBeLessThanOrEqual(HEALTH.maxTurns);
  });

  it('each turn freshly rolls its own battlefield + enemy wave', () => {
    const bus = new EventBus<GameEvents>();
    const run = new Run(2, bus, { startingRoster: LVL1_ROSTER });
    run.dispatch({ kind: 'enterNode', nodeId: firstFrontier(run) });

    // Force a multi-turn encounter (draw every turn) so there are >=2 turns.
    const turns = driveEncounter(run, bus, 1);
    expect(turns.length).toBeGreaterThan(1);

    // Every turn forks a fresh `battleRng`, so each turn's worldSeed is distinct
    // — proof the wave + battlefield are re-rolled per turn, not reused.
    const worldSeeds = turns.map((t) => t.enc.worldSeed);
    expect(new Set(worldSeeds).size).toBe(worldSeeds.length);
  });
});
