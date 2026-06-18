import { describe, it, expect } from 'vitest';
import {
  SWEEP_KNOBS,
  TIER_NAMES,
  buildFuzzArgs,
  formatFuzzCommand,
} from './sweepCommand';
import { PRESETS } from './search';
import { DIFFICULTY } from '../../src/config/difficulty';
import { HEALTH } from '../../src/config/health';
import { LEVELING } from '../../src/config/leveling';

describe('sweepCommand — knob enumeration', () => {
  it('covers every numeric key across the three config groups (config-derived, no drift)', () => {
    const numericCount = [DIFFICULTY, HEALTH, LEVELING].reduce(
      (acc, obj) => acc + Object.values(obj).filter((v) => typeof v === 'number').length,
      0,
    );
    expect(SWEEP_KNOBS).toHaveLength(numericCount);
    // Same three groups balanceSweep.ts's KNOB_GROUPS accepts.
    expect(new Set(SWEEP_KNOBS.map((k) => k.group))).toEqual(
      new Set(['difficulty', 'health', 'leveling']),
    );
  });

  it('exposes representative pool / difficulty / leveling knobs', () => {
    const paths = SWEEP_KNOBS.map((k) => k.path);
    expect(paths).toContain('difficulty.budgetFactor');
    expect(paths).toContain('difficulty.swarmMaxMultiplier');
    expect(paths).toContain('health.playerHealthMax');
    expect(paths).toContain('health.enemyHealthMax');
    expect(paths).toContain('leveling.xpPerHealing');
  });

  it('reports each knob’s live configured value (derived, never hardcoded)', () => {
    const byPath = new Map(SWEEP_KNOBS.map((k) => [k.path, k.value]));
    expect(byPath.get('difficulty.budgetFactor')).toBe(DIFFICULTY.budgetFactor);
    expect(byPath.get('health.playerHealthMax')).toBe(HEALTH.playerHealthMax);
    expect(byPath.get('leveling.restXp')).toBe(LEVELING.restXp);
  });
});

describe('sweepCommand — tier names', () => {
  it('matches the search.ts PRESETS keys exactly (so the menu can’t drift)', () => {
    expect([...TIER_NAMES].sort()).toEqual(Object.keys(PRESETS).sort());
  });
});

describe('sweepCommand — balance-sweep args', () => {
  it('builds a one-knob sweep', () => {
    const args = buildFuzzArgs({
      mode: 'balance-sweep',
      knob: 'difficulty.budgetFactor',
      range: '0.25:1.5:6',
      tier: 'quick',
    });
    expect(args[0]).toBe('--balance-sweep');
    expect(args).toContain('--knob=difficulty.budgetFactor');
    expect(args).toContain('--range=0.25:1.5:6');
    expect(args).toContain('--tier=quick');
  });

  it('emits knob2 + range2 only as a pair', () => {
    const both = buildFuzzArgs({
      mode: 'balance-sweep',
      knob: 'difficulty.budgetFactor',
      range: '0.5:0.75:3',
      knob2: 'difficulty.swarmMaxMultiplier',
      range2: '1.5:2.0:3',
    });
    expect(both).toContain('--knob2=difficulty.swarmMaxMultiplier');
    expect(both).toContain('--range2=1.5:2.0:3');

    // A second knob with no second range is dropped (the CLI rejects the pair).
    const lone = buildFuzzArgs({
      mode: 'balance-sweep',
      knob: 'difficulty.budgetFactor',
      range: '0.5:0.75:3',
      knob2: 'difficulty.swarmMaxMultiplier',
    });
    expect(lone.some((a) => a.startsWith('--knob2'))).toBe(false);
    expect(lone.some((a) => a.startsWith('--range2'))).toBe(false);
  });

  it('emits the optional run flags when set', () => {
    const args = buildFuzzArgs({
      mode: 'balance-sweep',
      knob: 'health.enemyHealthMax',
      range: '8:16:5',
      hops: 11,
      roster: 'mercenary,ranged,healer:5',
      jobs: 8,
      samplerSeed: 1,
      dryRun: true,
    });
    expect(args).toContain('--hops=11');
    expect(args).toContain('--roster=mercenary,ranged,healer:5');
    expect(args).toContain('--jobs=8');
    expect(args).toContain('--sampler-seed=1');
    expect(args).toContain('--dry-run');
  });

  it('omits --jobs at the single-process default (1)', () => {
    const args = buildFuzzArgs({
      mode: 'balance-sweep',
      knob: 'difficulty.budgetFactor',
      range: '0.625:0.625:1',
      jobs: 1,
    });
    expect(args.some((a) => a.startsWith('--jobs'))).toBe(false);
  });

  it('drops whitespace-only string fields', () => {
    const args = buildFuzzArgs({
      mode: 'balance-sweep',
      knob: 'difficulty.budgetFactor',
      range: '0.5:1.0:3',
      roster: '   ',
    });
    expect(args.some((a) => a.startsWith('--roster'))).toBe(false);
  });
});

describe('sweepCommand — search args', () => {
  it('builds a search command with preset + overrides', () => {
    const args = buildFuzzArgs({
      mode: 'search',
      preset: 'overnight',
      vectors: 500,
      seeds: 250,
      hops: 11,
      samplerSeed: 7,
    });
    expect(args[0]).toBe('--search');
    expect(args).toContain('--preset=overnight');
    expect(args).toContain('--vectors=500');
    expect(args).toContain('--seeds=250');
    expect(args).toContain('--hops=11');
    expect(args).toContain('--sampler-seed=7');
  });

  it('parallelizes search with --jobs > 1 (vector-level sharding) and omits it at 1', () => {
    expect(buildFuzzArgs({ mode: 'search', preset: 'overnight', jobs: 8 })).toContain('--jobs=8');
    expect(
      buildFuzzArgs({ mode: 'search', preset: 'overnight', jobs: 1 }).some((a) =>
        a.startsWith('--jobs'),
      ),
    ).toBe(false);
  });
});

describe('sweepCommand — formatting', () => {
  it('prefixes the npm passthrough', () => {
    const cmd = formatFuzzCommand(['--search', '--preset=quick']);
    expect(cmd).toBe('npm run fuzz -- --search --preset=quick');
  });
});
