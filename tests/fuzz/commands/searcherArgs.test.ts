/**
 * 59e — `--searcher` into `--search` + shards. The load-bearing guarantee is
 * PARITY BY CONSTRUCTION: one resolver (`searcherFromArgs`) turns the flag
 * set into the `rolloutSearch` harness arm for run mode, the search command's
 * serial path, and the `--eval-shard` children (which get the FLAGS via the
 * JSON job file and re-resolve). These tests pin the resolver's shapes, the
 * flags' JSON round-trip, and the evaluator-vs-run-mode equivalence.
 */

import { describe, it, expect } from 'vitest';
import { searcherFromArgs, parseArgs } from './args';
import { AUDITION_SCRIPTS, TRAFFIC_SCRIPTS } from '../../../src/bot/TrafficScriptDriver';
import { harnessEvaluate } from '../search';
import { runMany } from '../harness';
import { aggregate } from '../reporters';
import { scoredStrategy } from '../strategies/scored';
import { DEFAULT_SCORED_WEIGHTS } from '../strategies/scoredWeights';

const OFF = { searcher: false, audition: false, kTelemetry: false } as const;

describe('searcherFromArgs (59e — the one shared resolver)', () => {
  it('resolves each flag combination to the documented arm shape', () => {
    expect(searcherFromArgs(OFF)).toBeUndefined();
    expect(searcherFromArgs({ ...OFF, searcher: true })).toBe(true);
    expect(searcherFromArgs({ ...OFF, searcher: true, audition: true })).toBe(AUDITION_SCRIPTS);
    expect(searcherFromArgs({ ...OFF, searcher: true, k: 2 })).toEqual({
      rolloutsPerCandidate: 2,
    });
    expect(searcherFromArgs({ ...OFF, searcher: true, audition: true, k: 2 })).toEqual({
      scripts: AUDITION_SCRIPTS,
      rolloutsPerCandidate: 2,
    });
    // Spec grammar rides parseScriptsSpec — leave-one-out over the trigger
    // registry drops exactly that script.
    const loo = searcherFromArgs({ ...OFF, searcher: true, searcherSpec: '-unjam' });
    expect(Array.isArray(loo)).toBe(true);
    expect((loo as readonly { id: string }[]).map((s) => s.id)).toEqual(
      TRAFFIC_SCRIPTS.filter((s) => s.id !== 'unjam').map((s) => s.id),
    );
  });

  it('the shard-job flag fields survive JSON and re-resolve identically', () => {
    // What the parent writes is what the child reads: only plain flags cross
    // the boundary, so round-tripped resolution must deep-equal direct
    // resolution for every combination the search command can emit.
    const combos: ReadonlyArray<{
      searcher: boolean;
      audition?: boolean;
      k?: number;
      searcherSpec?: string;
    }> = [
      { searcher: true, audition: true, k: 2 },
      { searcher: true },
      { searcher: true, audition: true, searcherSpec: '-unjam' },
    ];
    for (const flags of combos) {
      const direct = searcherFromArgs({ ...OFF, ...flags });
      const wire = JSON.parse(JSON.stringify(flags)) as typeof flags;
      const resolved = searcherFromArgs({ ...OFF, ...wire });
      expect(resolved).toEqual(direct);
    }
  });

  it('parseArgs admits --searcher with --search and still bails for sweep/arena/k-telemetry', () => {
    expect(() => parseArgs(['--search', '--searcher', '--audition'])).not.toThrow();
    expect(() => parseArgs(['--balance-sweep', '--searcher'])).toThrow(/run \+ search modes/);
    expect(() => parseArgs(['--arena', '--searcher'])).toThrow(/run \+ search modes/);
    expect(() => parseArgs(['--search', '--searcher', '--k-telemetry'])).toThrow(
      /run-mode instrument/,
    );
  });
});

describe('search-mode evaluator parity vs run mode (59e)', () => {
  it(
    'harnessEvaluate with the resolved audition arm equals a run-mode drive of the same options',
    { timeout: 300_000 },
    () => {
      // The search evaluator IS runMany+aggregate over identical options —
      // this pins that no search-path wrapper diverges from what `--searcher
      // --audition` measures in run mode (same seed, same vector, same arm).
      // K=1 + one hop-2 seed keeps the two audition evals affordable;
      // searcher determinism itself is already pinned in harnessSearcher.
      const arm = searcherFromArgs({ ...OFF, searcher: true, audition: true, k: 1 });
      const options = { runConfig: { hopCount: 2 }, rolloutSearch: arm! };
      const seeds = [1];
      const viaSearch = harnessEvaluate(DEFAULT_SCORED_WEIGHTS, seeds, options);
      const viaRun = aggregate(
        runMany(seeds, scoredStrategy('parity', DEFAULT_SCORED_WEIGHTS), options),
      ).winRate;
      expect(viaSearch).toBe(viaRun);
    },
  );
});
