/**
 * 75l — the `--set=group.key=value` generic config override: parse-layer pin
 * (repeatable, unset when absent) + the knob-registry application path the run
 * mode routes through (the `sim` group joined the registry for this flag; the
 * first consumer is `sim.enemyPullChance=0`, the camps pull-ablation arm).
 * Mirrors scatterChanceArgs.test.ts; the apply test follows the fuzz config's
 * mutate-then-restore contract (isolate:false — see vitest.fuzz.config.ts).
 */

import { describe, it, expect } from 'vitest';
import { parseArgs } from './args';
import { resolveKnob } from '../balanceSweep';
import { SIM } from '../../../src/config/sim';
import { HEALTH } from '../../../src/config/health';

describe('--set (75l)', () => {
  it('parses one or many specs and stays unset when absent', () => {
    expect(parseArgs(['--set=sim.enemyPullChance=0']).set).toEqual(['sim.enemyPullChance=0']);
    expect(
      parseArgs(['--set=sim.enemyPullChance=0', '--set=difficulty.budgetFactor=1.5']).set,
    ).toEqual(['sim.enemyPullChance=0', 'difficulty.budgetFactor=1.5']);
    expect(parseArgs(['--count=5']).set).toBeUndefined();
    // Bare flag (no value) stays unset — run.ts's applySetOverrides owns
    // bailing on malformed specs at dispatch.
    expect(parseArgs(['--set']).set).toBeUndefined();
  });

  it('the sim knob group resolves to the LIVE config object', () => {
    const knob = resolveKnob('sim.enemyPullChance');
    expect(knob.obj).toBe(SIM as unknown as Record<string, number>);
    const original = SIM.enemyPullChance;
    try {
      knob.obj[knob.key] = 0;
      expect(SIM.enemyPullChance).toBe(0); // the write is what battleSetup reads
    } finally {
      knob.obj[knob.key] = original;
    }
  });

  it('an unknown sim key throws loud (the typo guard)', () => {
    expect(() => resolveKnob('sim.noSuchDial')).toThrow();
  });

  it('§83e — the camps forced-engagement dial is registry-reachable', () => {
    // The 83e design check's resolution: `procedural.camps` (nested weighted
    // records) is NOT addressable, so the probe surface is this flat numeric
    // SIM switch instead — `--set=sim.campsStartHostile=1`.
    const knob = resolveKnob('sim.campsStartHostile');
    expect(knob.obj).toBe(SIM as unknown as Record<string, number>);
    expect(SIM.campsStartHostile).toBe(0); // shipped OFF — never ship > 0
  });
});

describe('--set string modes (91a2)', () => {
  it('the chip modes resolve to the LIVE health object as string-valued knobs', () => {
    for (const key of ['chipMode', 'capPenalty'] as const) {
      const knob = resolveKnob(`health.${key}`);
      expect(knob.obj).toBe(HEALTH as unknown as Record<string, number | string>);
      expect(typeof knob.obj[knob.key]).toBe('string');
      const original = HEALTH[key];
      try {
        knob.obj[knob.key] = original === 'survivors' ? 'casualties' : 'survivors';
        expect(HEALTH[key]).not.toBe(original); // the write is what turnCharges reads
      } finally {
        knob.obj[knob.key] = original;
      }
    }
  });

  it('a non-scalar target still throws loud', () => {
    expect(() => resolveKnob('health.noSuchMode')).toThrow();
  });
});
