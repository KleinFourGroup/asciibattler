/**
 * 85g3 — `--arbitrate` into `--search` + shards (the 59e searcherArgs
 * pattern). The load-bearing guarantee is PARITY BY CONSTRUCTION: one
 * resolver (`arbitratedWrapFromArgs`) turns the flag set into the
 * harness's per-seed `wrapStrategy` for run mode, the search command's
 * serial path, and the `--eval-shard` children (flags via the JSON job
 * file, re-resolved). The run-path RELOCATION (the wrap moving from
 * run.ts into runOne) is proven by the 85g3 byte-identity oracle
 * (WORKLOG §85g3: summary + decisions sha-identical, fold engaged);
 * these tests pin the arg matrix, the resolver, the JSON round-trip,
 * and the harvest + search-vs-run equivalence.
 */

import { describe, it, expect } from 'vitest';
import { arbitratedWrapFromArgs, parseArgs } from './args';
import { harnessEvaluate } from '../search';
import { runMany, runOne, type HarnessOptions } from '../harness';
import { aggregate } from '../reporters';
import { scoredStrategy } from '../strategies/scored';
import { DEFAULT_SCORED_WEIGHTS } from '../strategies/scoredWeights';

const OFF = {
  arbitrate: false,
  searcher: false,
  audition: false,
  kTelemetry: false,
} as const;

describe('the 85g3 arg matrix (mode-by-mode, the 70a discipline relaxed)', () => {
  it('parseArgs admits --arbitrate with --search; sweep/arena still bail', () => {
    expect(() => parseArgs(['--search', '--arbitrate'])).not.toThrow();
    expect(() => parseArgs(['--search', '--arbitrate', '--prior-lambda=0.5'])).not.toThrow();
    expect(() => parseArgs(['--search', '--arbitrate', '--arbitrate-tier=bare'])).not.toThrow();
    expect(() => parseArgs(['--balance-sweep', '--arbitrate'])).toThrow(/run \+ search modes/);
    expect(() => parseArgs(['--arena', '--arbitrate'])).toThrow(/run \+ search modes/);
  });

  it('the run-mode instruments never ride a search', () => {
    expect(() => parseArgs(['--search', '--arbitrate', '--flip-telemetry=bare'])).toThrow(
      /run-mode instrument/,
    );
    expect(() => parseArgs(['--search', '--arbitrate', '--shadow-horizon=run'])).toThrow(
      /run-mode instrument/,
    );
    expect(() => parseArgs(['--search', '--arbitrate', '--grant-epsilon=5'])).toThrow(
      /run-mode ablation/,
    );
  });
});

describe('arbitratedWrapFromArgs (the one shared resolver)', () => {
  it('off → undefined; on → a per-seed factory whose wrap carries the arbitrated name + driver', () => {
    expect(arbitratedWrapFromArgs(OFF)).toBeUndefined();
    const wrap = arbitratedWrapFromArgs({ ...OFF, arbitrate: true });
    expect(wrap).toBeTypeOf('function');
    const base = scoredStrategy('compat-pin', DEFAULT_SCORED_WEIGHTS);
    const wrapped = wrap!(7, base);
    expect(wrapped.name).toBe('arbitrated:compat-pin');
    expect((wrapped as { driver?: { decisions?: unknown[] } }).driver?.decisions).toEqual([]);
  });

  it('the shard-job flag fields survive JSON and re-resolve to the same wrap shape', () => {
    const flags = { arbitrate: true, arbitrateTier: 'bare', priorLambda: 0 };
    const direct = arbitratedWrapFromArgs({ ...OFF, ...flags });
    const wire = JSON.parse(JSON.stringify(flags)) as typeof flags;
    const resolved = arbitratedWrapFromArgs({ ...OFF, ...wire });
    const base = () => scoredStrategy('wire-pin', DEFAULT_SCORED_WEIGHTS);
    expect(resolved!(3, base()).name).toBe(direct!(3, base()).name);
  });
});

describe('search-mode evaluator parity vs run mode (85g3)', () => {
  it(
    'harnessEvaluate with the resolved wrap equals a run-mode drive of the same options, and the harvest lands',
    { timeout: 300_000 },
    () => {
      // Same discipline as the 59e parity pin: the search evaluator IS
      // runMany+aggregate over identical options, so no search-path
      // wrapper may diverge from what `--arbitrate` measures in run mode.
      // The bare inner tier + one hop-2 seed keeps the two arbitrated
      // evals affordable; the fold stays off (λ absent) — the λ path is
      // pinned at evaluator/driver level.
      const wrap = arbitratedWrapFromArgs({
        ...OFF,
        arbitrate: true,
        arbitrateTier: 'bare',
      });
      const options: HarnessOptions = { runConfig: { hopCount: 2 }, wrapStrategy: wrap! };
      const seeds = [1];
      const viaSearch = harnessEvaluate(DEFAULT_SCORED_WEIGHTS, seeds, options);
      const runs = runMany(seeds, scoredStrategy('parity', DEFAULT_SCORED_WEIGHTS), options);
      expect(viaSearch).toBe(aggregate(runs).winRate);
      // The 71a harvest, relocated into runOne: the wrapped arm's decision
      // log rides the RunResult without run.ts's manual attach.
      const one = runOne(seeds[0]!, scoredStrategy('parity', DEFAULT_SCORED_WEIGHTS), options);
      expect(one.strategyName).toBe('arbitrated:parity');
      expect(one.decisions).toBeDefined();
      expect(runs[0]!.decisions).toEqual(one.decisions);
    },
  );
});
