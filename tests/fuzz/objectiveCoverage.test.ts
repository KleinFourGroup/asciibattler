/**
 * O5 — the objective COVERAGE driver. Asserts the debug-only churn bot's job:
 * it emits EVERY typed-objective mode on BOTH teams (variety), it's
 * deterministic per seed (the fuzz contract), and a churned battle always
 * TERMINATES — including under each switchable focus-tile resolution and through
 * the full run harness. NEVER asserts a win rate: a churn bot is a near-certain
 * loss by design, which is exactly why it's kept out of the measurement path.
 */

import { describe, it, expect } from 'vitest';
import { EventBus } from '../../src/core/EventBus';
import { RNG } from '../../src/core/RNG';
import { World } from '../../src/sim/World';
import { scaledUnit } from '../../src/sim/archetypes';
import type { GameEvents } from '../../src/core/events';
import type { WorldCommand } from '../../src/sim/Command';
import type { ObjectiveTeam } from '../../src/sim/objective';
import { OBJECTIVE, FOCUS_TILE_RESOLUTIONS } from '../../src/config/objective';
import {
  CoverageObjectiveDriver,
  COVERAGE_MAX_TICKS,
  COVERAGE_LIFETIME_MAX_TICKS,
} from './objectiveCoverage';
import { runArena } from './arena';
import { runOne } from './harness';
import { makeStrategy } from './strategies/registry';
import { objectiveFromArgs, coverageFromArgs } from './commands/args';

/** A small two-team board so the driver can roll BOTH target kinds (an
 *  enemy-unit target needs a living opponent of the acting team). Deterministic
 *  construction (fixed seed + fixed placements) so a driven battle replays. */
function populatedWorld(): World {
  const world = new World(new EventBus<GameEvents>(), new RNG(1), 12, 12);
  world.spawnUnit(scaledUnit('mercenary', 3), 'player', { x: 1, y: 5 }, null);
  world.spawnUnit(scaledUnit('ranged', 3), 'player', { x: 1, y: 6 }, null);
  world.spawnUnit(scaledUnit('mercenary', 3), 'enemy', { x: 10, y: 5 }, null);
  world.spawnUnit(scaledUnit('ranged', 3), 'enemy', { x: 10, y: 6 }, null);
  return world;
}

/** Drive a fresh populated board with the coverage bot for `ticks` (or until the
 *  battle ends), collecting every command it enqueues. The board construction is
 *  fixed, so two calls with the same seed must produce the identical stream. */
function driveAndCollect(seed: number, ticks: number): WorldCommand[] {
  const world = populatedWorld();
  const driver = new CoverageObjectiveDriver(new RNG(seed).fork());
  const cmds: WorldCommand[] = [];
  for (let i = 0; i < ticks && !world.ended; i++) {
    for (const c of driver.decide(world)) {
      cmds.push(c);
      world.enqueueCommand(c);
    }
    world.tick();
  }
  return cmds;
}

describe('CoverageObjectiveDriver — variety', () => {
  it('rolls every mode, both target kinds, on both teams', () => {
    const modes = new Set<string>();
    const targetKinds = new Set<string>();
    const teams = new Set<ObjectiveTeam>();
    // Tick 0: expiry inits to 0 for both teams, so the first decide rolls a
    // fresh objective for player AND enemy. A fresh driver per seed over a wide
    // seed set samples the uniform mode/target draws to near-certain coverage
    // (deterministic — fixed seeds, so the assertion is stable).
    for (let seed = 1; seed <= 100; seed++) {
      const world = populatedWorld();
      const driver = new CoverageObjectiveDriver(new RNG(seed).fork());
      for (const cmd of driver.decide(world)) {
        expect(cmd.kind).toBe('setObjective');
        if (cmd.kind !== 'setObjective') continue;
        teams.add(cmd.team);
        modes.add(cmd.objective.mode);
        if ('target' in cmd.objective) targetKinds.add(cmd.objective.target.kind);
      }
    }
    expect([...modes].sort()).toEqual(['atWill', 'engage', 'focus', 'hold']);
    expect([...targetKinds].sort()).toEqual(['enemy', 'tile']);
    expect([...teams].sort()).toEqual(['enemy', 'player']);
  });

  it('re-rolls on expiry — a multi-tick drive emits more than the two tick-0 sets', () => {
    // 200 ticks ≫ the max lifetime, so both teams must have expired + re-rolled
    // at least once (proves the churn/transition coverage, not just tick 0).
    const cmds = driveAndCollect(3, 200);
    expect(cmds.length).toBeGreaterThan(2);
  });
});

describe('CoverageObjectiveDriver — determinism', () => {
  it('same seed → byte-identical command stream', () => {
    expect(driveAndCollect(5, 200)).toEqual(driveAndCollect(5, 200));
  });

  it('different seeds → different streams', () => {
    expect(driveAndCollect(5, 200)).not.toEqual(driveAndCollect(6, 200));
  });
});

describe('coverage arena run — termination', () => {
  it('terminates with a valid outcome each seed (no paralysis)', () => {
    for (const seed of [1, 2, 3]) {
      const r = runArena(seed, { coverage: true });
      expect(['player', 'enemy', 'draw']).toContain(r.winner);
      expect(r.ticks).toBeGreaterThan(0);
      expect(r.ticks).toBeLessThanOrEqual(COVERAGE_MAX_TICKS);
    }
  });

  it('is deterministic for the same seed', () => {
    expect(runArena(7, { coverage: true })).toEqual(runArena(7, { coverage: true }));
  });

  it('the coverage cap is generous (longer than one objective lifetime)', () => {
    expect(COVERAGE_MAX_TICKS).toBeGreaterThan(COVERAGE_LIFETIME_MAX_TICKS);
  });
});

describe('coverage terminates under every focus-tile resolution', () => {
  // The risky one is `clearOnArrival` (a tile focus on an unreachable/walled cell
  // is a permanent beeline) — the random expiry must churn the board back out of
  // it. Each strategy is forced via the live config knob (restored after).
  for (const key of FOCUS_TILE_RESOLUTIONS) {
    it(`resolution=${key}`, () => {
      const original = OBJECTIVE.focusTileResolution;
      try {
        OBJECTIVE.focusTileResolution = key;
        for (const seed of [1, 2]) {
          // Bounded cap keeps the smoke suite quick; termination holds at any cap.
          const r = runArena(seed, { coverage: true, maxTicks: 4000 });
          expect(['player', 'enemy', 'draw']).toContain(r.winner);
          expect(r.ticks).toBeGreaterThan(0);
        }
      } finally {
        OBJECTIVE.focusTileResolution = original;
      }
    });
  }
});

describe('coverage through the full run harness', () => {
  it('terminates a short run without a hang', () => {
    const result = runOne(1, makeStrategy('pure-random')!, {
      coverageObjectives: true,
      runConfig: { hopCount: 2 },
      maxTicksPerBattle: 3000,
    });
    expect(result.outcome).not.toBe('hang');
    expect(['complete', 'defeat', 'aborted']).toContain(result.outcome);
    expect(result.battles.length).toBeGreaterThan(0);
  });

  it('is deterministic per seed', () => {
    const opts = {
      coverageObjectives: true,
      runConfig: { hopCount: 2 },
      maxTicksPerBattle: 3000,
    } as const;
    expect(runOne(11, makeStrategy('pure-random')!, opts)).toEqual(
      runOne(11, makeStrategy('pure-random')!, opts),
    );
  });
});

describe('--objective=coverage flag routing', () => {
  it('routes "coverage" to the driver, not the measurement proclivity', () => {
    expect(coverageFromArgs({ objective: 'coverage' })).toBe(true);
    expect(objectiveFromArgs({ objective: 'coverage' })).toBeUndefined();
  });

  it('leaves the measurement proclivity path intact', () => {
    expect(coverageFromArgs({ objective: 'random' })).toBe(false);
    expect(objectiveFromArgs({ objective: 'random' })).toEqual({ kind: 'random' });
    expect(coverageFromArgs({ objective: undefined })).toBe(false);
    expect(objectiveFromArgs({ objective: undefined })).toBeUndefined();
  });
});
