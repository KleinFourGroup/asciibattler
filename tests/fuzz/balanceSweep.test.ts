/**
 * H7c — balance-sweep engine tests. Opt-in with the fuzz suite
 * (`npm run fuzz:smoke`).
 *
 * The pure helpers (parseRange / linspace / buildGrid / resolveKnob) are pinned
 * directly. The orchestration (`runBalanceSweep`) uses an INJECTED `measurePoint`
 * that reads the LIVE config object — so it proves the apply/restore contract
 * (each point sees its knob value; the original is restored afterward, even on
 * throw) WITHOUT running thousands of battles.
 */

import { describe, it, expect } from 'vitest';
import {
  parseRange,
  linspace,
  buildGrid,
  resolveKnob,
  runBalanceSweep,
  type SweepCoord,
  type SweepPoint,
} from './balanceSweep';
import { aggregateTelemetry } from './telemetry';
import { DIFFICULTY } from '../../src/config/difficulty';
import { PRESETS } from './search';

/** A throwaway SweepPoint carrying a zero-filled telemetry — enough for the
 *  orchestration tests, which only care about the knob values + restore. */
function fakePoint(coord: SweepCoord, best = 0): SweepPoint {
  return {
    knobs: coord,
    bestTrainWin: best,
    bestTestWin: best,
    pureRandomWin: 0,
    greedyWin: 0,
    gradient: best,
    telemetry: aggregateTelemetry([]),
  };
}

describe('parseRange', () => {
  it('parses min:max:steps', () => {
    expect(parseRange('0.25:1.5:6')).toEqual({ min: 0.25, max: 1.5, steps: 6 });
  });
  it('rejects a malformed spec', () => {
    expect(() => parseRange('0.25:1.5')).toThrow(/min:max:steps/);
    expect(() => parseRange('a:1:2')).toThrow(/non-numeric/);
    expect(() => parseRange('0:1:0')).toThrow(/steps/);
    expect(() => parseRange('0:1:2.5')).toThrow(/steps/);
    expect(() => parseRange('2:1:3')).toThrow(/max < min/);
  });
});

describe('linspace', () => {
  it('returns inclusive, evenly-spaced, dust-free values', () => {
    expect(linspace({ min: 0.25, max: 1.5, steps: 6 })).toEqual([0.25, 0.5, 0.75, 1.0, 1.25, 1.5]);
  });
  it('pins a single-step axis at min', () => {
    expect(linspace({ min: 0.4, max: 9, steps: 1 })).toEqual([0.4]);
  });
});

describe('buildGrid', () => {
  it('builds a 1-knob axis', () => {
    const grid = buildGrid([{ path: 'difficulty.budgetFactor', range: { min: 0, max: 1, steps: 3 } }]);
    expect(grid).toEqual([
      { 'difficulty.budgetFactor': 0 },
      { 'difficulty.budgetFactor': 0.5 },
      { 'difficulty.budgetFactor': 1 },
    ]);
  });
  it('builds the cartesian product of two knobs, last varying fastest', () => {
    const grid = buildGrid([
      { path: 'a.x', range: { min: 0, max: 1, steps: 2 } },
      { path: 'b.y', range: { min: 10, max: 20, steps: 2 } },
    ]);
    expect(grid).toEqual([
      { 'a.x': 0, 'b.y': 10 },
      { 'a.x': 0, 'b.y': 20 },
      { 'a.x': 1, 'b.y': 10 },
      { 'a.x': 1, 'b.y': 20 },
    ]);
  });
});

describe('resolveKnob', () => {
  it('resolves a live config object + key for each group', () => {
    expect(resolveKnob('difficulty.budgetFactor').obj).toBe(DIFFICULTY);
    expect(resolveKnob('health.enemyHealthMax').key).toBe('enemyHealthMax');
    expect(resolveKnob('leveling.xpPerHealing').group).toBe('leveling');
  });
  it('throws on a malformed or unknown knob', () => {
    expect(() => resolveKnob('budgetFactor')).toThrow(/group.key/);
    expect(() => resolveKnob('nope.x')).toThrow(/unknown knob group/);
    expect(() => resolveKnob('difficulty.nope')).toThrow(/unknown knob/);
  });
});

describe('runBalanceSweep orchestration (injected measurePoint)', () => {
  it('applies each grid point to the live config, then restores the original', () => {
    const original = DIFFICULTY.budgetFactor;
    const seen: number[] = [];
    const result = runBalanceSweep({
      knobs: [{ path: 'difficulty.budgetFactor', range: { min: 0.2, max: 0.6, steps: 3 } }],
      preset: PRESETS.quick,
      samplerSeed: 1,
      // Capture the LIVE config value at measure time — proves the apply landed.
      measurePoint: (coord) => {
        seen.push(DIFFICULTY.budgetFactor);
        return fakePoint(coord);
      },
    });
    expect(seen).toEqual([0.2, 0.4, 0.6]);
    expect(result.points).toHaveLength(3);
    expect(result.gridSize).toBe(3);
    // Restored after the sweep.
    expect(DIFFICULTY.budgetFactor).toBe(original);
  });

  it('restores the original even when measurePoint throws', () => {
    const original = DIFFICULTY.budgetFactor;
    expect(() =>
      runBalanceSweep({
        knobs: [{ path: 'difficulty.budgetFactor', range: { min: 0.9, max: 0.9, steps: 1 } }],
        preset: PRESETS.quick,
        samplerSeed: 1,
        measurePoint: () => {
          throw new Error('boom');
        },
      }),
    ).toThrow('boom');
    expect(DIFFICULTY.budgetFactor).toBe(original);
  });

  it('passes floorOverride through to the measured config', () => {
    let seenFloors: number | undefined = -1;
    runBalanceSweep({
      knobs: [{ path: 'difficulty.budgetFactor', range: { min: 0.5, max: 0.5, steps: 1 } }],
      preset: PRESETS.quick, // its own floorCount is 4
      samplerSeed: 1,
      floorOverride: 11,
      measurePoint: (coord, cfg) => {
        seenFloors = cfg.floorOverride;
        return fakePoint(coord);
      },
    });
    expect(seenFloors).toBe(11);
  });

  it('passes rosterOverride through to the measured config', () => {
    let seen: readonly { archetype: string; level: number }[] | undefined;
    runBalanceSweep({
      knobs: [{ path: 'difficulty.budgetFactor', range: { min: 0.5, max: 0.5, steps: 1 } }],
      preset: PRESETS.quick,
      samplerSeed: 1,
      rosterOverride: [
        { archetype: 'mage', level: 1 },
        { archetype: 'melee', level: 3 },
      ],
      measurePoint: (coord, cfg) => {
        seen = cfg.rosterOverride;
        return fakePoint(coord);
      },
    });
    expect(seen).toEqual([
      { archetype: 'mage', level: 1 },
      { archetype: 'melee', level: 3 },
    ]);
  });

  it('honors maxPoints (the dry-run estimate) while reporting the full grid size', () => {
    const result = runBalanceSweep({
      knobs: [{ path: 'difficulty.budgetFactor', range: { min: 0, max: 1, steps: 5 } }],
      preset: PRESETS.quick,
      samplerSeed: 1,
      maxPoints: 1,
      measurePoint: (coord) => fakePoint(coord),
    });
    expect(result.points).toHaveLength(1);
    expect(result.gridSize).toBe(5);
  });
});

describe('tiers', () => {
  it('exposes the H7c medium + heavy presets', () => {
    expect(PRESETS.medium.floorCount).toBe(6);
    expect(PRESETS.heavy.floorCount).toBeUndefined(); // full-length runs
    expect(PRESETS.heavy.vectors).toBeGreaterThan(PRESETS.medium.vectors);
  });
});
