/**
 * 69e — the arbitration driver's contracts:
 *
 * MECHANISM PINS (injected evaluator — no battles driven; the
 * selectByScore inert-seam precedent):
 * 1. Argmax is strictly-greater first-wins (the 57f tie rule).
 * 2. Ties→NULL + hysteresis in one rule: a challenger must STRICTLY
 *    beat the null arm by ε or the null arm stands.
 * 3. The per-call ε override wins over the config default.
 * 4. An empty candidate set evaluates nothing and logs nothing.
 * 5. The log record: labels[0]='null', chosenIndex/marginVsNull/ε as
 *    documented, (sectorId, hop) context with the pre-root guard.
 *
 * INTEGRATION (real evaluator):
 * 6. ARBITRATION DETERMINISM — the phase exit criterion: same driver
 *    seed + same config + same live state + same candidates ⇒ the same
 *    decision AND a deep-equal log record, across two fresh drivers.
 * 7. An inert challenger loses to the null arm at ε=0 (ties→NULL end to
 *    end — rides 69d's inert≡null pin).
 * 8. The live run is never touched by a decide.
 */

import { describe, expect, it } from 'vitest';
import { EventBus } from '../../../src/core/EventBus';
import type { GameEvents } from '../../../src/core/events';
import { RNG } from '../../../src/core/RNG';
import { Run } from '../../../src/run/Run';
import { RunArbitrationDriver, type RunDecisionCandidate } from './driver';
import type { CandidateApply, RunCandidateResult, RunRolloutSpec } from './evaluator';
import { scoredStrategy } from '../strategies/scored';
import { DEFAULT_SCORED_WEIGHTS } from '../strategies/scoredWeights';

function liveRun(seed: number): Run {
  return new Run(seed, new EventBus<GameEvents>());
}

/** An injected evaluator scoring by a fixed label→score table ('null' =
 *  the null arm). Candidates carry their label ON the apply closure
 *  (test-only smuggling) so the fake can identify them. */
function tableEvaluator(table: Record<string, number>) {
  const calls: string[] = [];
  const evaluate = (
    _live: Run,
    apply: CandidateApply | null,
    _spec: RunRolloutSpec,
  ): RunCandidateResult => {
    const label = apply === null ? 'null' : (apply as unknown as { label: string }).label;
    calls.push(label);
    const score = table[label];
    if (score === undefined) throw new Error(`tableEvaluator: no score for '${label}'`);
    return { score, perSeed: [] };
  };
  return { evaluate, calls };
}

/** A candidate whose no-op apply closure carries its label for the fake. */
function tagged(label: string): RunDecisionCandidate {
  const apply: CandidateApply = Object.assign(() => {}, { label });
  return { label, apply };
}

/** The one real candidate every fresh run supports: enter the root. */
function enterRoot(): RunDecisionCandidate {
  return {
    label: 'enterNode:root',
    apply: (clone) =>
      clone.run.dispatch({ kind: 'enterNode', nodeId: clone.run.nodeMap.rootId }),
  };
}

describe('RunArbitrationDriver — mechanism pins (injected evaluator)', () => {
  it('argmax is strictly-greater first-wins; the winner must beat null by more than ε', () => {
    const { evaluate } = tableEvaluator({ null: 0, a: 5, b: 5 });
    const driver = new RunArbitrationDriver(new RNG(1), { evaluate });
    const chosen = driver.decide('test', liveRun(7), [tagged('a'), tagged('b')]);
    expect(chosen?.label).toBe('a'); // b's equal 5 never displaces the first 5
    expect(driver.decisions[0]!.chosenIndex).toBe(1);
    expect(driver.decisions[0]!.marginVsNull).toBe(5);
  });

  it('ties→NULL: a challenger exactly at the null score is not chosen at ε=0', () => {
    const { evaluate } = tableEvaluator({ null: 3, a: 3 });
    const driver = new RunArbitrationDriver(new RNG(1), { evaluate });
    expect(driver.decide('test', liveRun(7), [tagged('a')])).toBeNull();
    expect(driver.decisions[0]!.chosenIndex).toBe(0);
  });

  it('hysteresis: ε gates the flip; the per-call override wins over the config default', () => {
    const table = { null: 0, a: 0.2 };
    const d1 = new RunArbitrationDriver(new RNG(1), {
      evaluate: tableEvaluator(table).evaluate,
      epsilon: 0.25,
    });
    expect(d1.decide('test', liveRun(7), [tagged('a')])).toBeNull(); // 0.2 ≤ 0 + 0.25
    const d2 = new RunArbitrationDriver(new RNG(1), {
      evaluate: tableEvaluator(table).evaluate,
      epsilon: 0.25,
    });
    expect(d2.decide('test', liveRun(7), [tagged('a')], { epsilon: 0.1 })?.label).toBe('a');
    expect(d2.decisions[0]!.epsilon).toBe(0.1);
  });

  it('an empty candidate set evaluates nothing and logs nothing', () => {
    const { evaluate, calls } = tableEvaluator({ null: 0 });
    const driver = new RunArbitrationDriver(new RNG(1), { evaluate });
    expect(driver.decide('test', liveRun(7), [])).toBeNull();
    expect(calls).toHaveLength(0);
    expect(driver.decisions).toHaveLength(0);
  });

  it('the record carries labels (null first), site, and the pre-root hop guard', () => {
    const { evaluate } = tableEvaluator({ null: 0, a: 1 });
    const driver = new RunArbitrationDriver(new RNG(1), { evaluate });
    const live = liveRun(7); // fresh = pre-root (currentHop would throw — #110)
    driver.decide('portBuy', live, [tagged('a')]);
    const rec = driver.decisions[0]!;
    expect(rec.site).toBe('portBuy');
    expect(rec.labels).toEqual(['null', 'a']);
    expect(rec.hop).toBe(0);
    expect(rec.sectorId).toBe(live.currentSectorId);
  });
});

describe('RunArbitrationDriver — the 71c shadow tier (flip-rate instrument)', () => {
  /** A tier-aware fake: scores keyed by `${label}` per inner tier ('base'
   *  when the spec carries none) — the flip fixture. */
  function tierEvaluator(tables: Record<string, Record<string, number>>) {
    return (
      _live: Run,
      apply: CandidateApply | null,
      spec: RunRolloutSpec,
    ): RunCandidateResult => {
      const label = apply === null ? 'null' : (apply as unknown as { label: string }).label;
      const tier = spec.innerTier ?? 'base';
      const score = tables[tier]?.[label];
      if (score === undefined) throw new Error(`tierEvaluator: no score for '${label}'@${tier}`);
      return { score, perSeed: [] };
    };
  }

  it('records the shadow decision; a tier disagreement is a flip', () => {
    // Primary (base): a wins by 5. Shadow (traffic): a is worthless → null.
    const evaluate = tierEvaluator({
      base: { null: 0, a: 5 },
      traffic: { null: 0, a: 0 },
    });
    const driver = new RunArbitrationDriver(new RNG(1), { evaluate, shadowTier: 'traffic' });
    const chosen = driver.decide('test', liveRun(7), [tagged('a')]);
    // The live decision NEVER reads the shadow (shadow-only telemetry).
    expect(chosen?.label).toBe('a');
    const rec = driver.decisions[0]!;
    expect(rec.chosenIndex).toBe(1);
    expect(rec.shadowChosenIndex).toBe(0); // ≠ chosenIndex — a flip
  });

  it('agreement records the same index; shadow-off records no field', () => {
    const table = { null: 0, a: 5 };
    const shadowed = new RunArbitrationDriver(new RNG(1), {
      evaluate: tierEvaluator({ base: table, traffic: table }),
      shadowTier: 'traffic',
    });
    shadowed.decide('test', liveRun(7), [tagged('a')]);
    expect(shadowed.decisions[0]!.shadowChosenIndex).toBe(1);

    const plain = new RunArbitrationDriver(new RNG(1), {
      evaluate: tierEvaluator({ base: table }),
    });
    plain.decide('test', liveRun(7), [tagged('a')]);
    expect('shadowChosenIndex' in plain.decisions[0]!).toBe(false);
  });

  it('the shadow judges under the SAME ε rule (its own null, hysteresis intact)', () => {
    // Shadow margin 0.2 ≤ ε 0.25 → shadow null stands while primary flips.
    const evaluate = tierEvaluator({
      base: { null: 0, a: 5 },
      traffic: { null: 1, a: 1.2 },
    });
    const driver = new RunArbitrationDriver(new RNG(1), {
      evaluate,
      epsilon: 0.25,
      shadowTier: 'traffic',
    });
    driver.decide('test', liveRun(7), [tagged('a')]);
    expect(driver.decisions[0]!.chosenIndex).toBe(1);
    expect(driver.decisions[0]!.shadowChosenIndex).toBe(0);
  });

  it('shadow evaluation never perturbs the primary stream (byte-equal decide sequence)', () => {
    // Two sequential decides on same-seeded drivers, one shadowed: chosen
    // labels + records must match modulo the shadow field — the pairs are
    // the whole RNG draw and they precede either tier's evaluation.
    const tables = {
      base: { null: 0, a: 5, b: 2 },
      traffic: { null: 9, a: 0, b: 0 },
    };
    const run = <T>(shadow: boolean): { labels: (string | null)[]; records: T[] } => {
      const driver = new RunArbitrationDriver(new RNG(42), {
        evaluate: tierEvaluator(tables),
        ...(shadow ? { shadowTier: 'traffic' as const } : {}),
      });
      const labels = [
        driver.decide('s1', liveRun(7), [tagged('a')])?.label ?? null,
        driver.decide('s2', liveRun(7), [tagged('a'), tagged('b')])?.label ?? null,
      ];
      const records = driver.decisions.map(
        ({ shadowChosenIndex: _s, ...rest }) => rest as T,
      );
      return { labels, records };
    };
    const shadowed = run(true);
    const plain = run(false);
    expect(shadowed.labels).toEqual(plain.labels);
    expect(shadowed.records).toEqual(plain.records);
  });
});

describe('RunArbitrationDriver — the 84a long-horizon shadow (the §84 instrument)', () => {
  /** A horizon-aware fake: scores keyed 'base' for the primary spec and
   *  'run' for a run-end spec (the long-horizon fixture). */
  function horizonEvaluator(tables: Record<'base' | 'run', Record<string, number>>) {
    const calls: string[] = [];
    const evaluate = (
      _live: Run,
      apply: CandidateApply | null,
      spec: RunRolloutSpec,
    ): RunCandidateResult => {
      const label = apply === null ? 'null' : (apply as unknown as { label: string }).label;
      const horizon = Number.isFinite(spec.horizonBattles) ? 'base' : 'run';
      calls.push(`${label}@${horizon}`);
      const score = tables[horizon][label];
      if (score === undefined) throw new Error(`horizonEvaluator: no score for '${label}'@${horizon}`);
      return { score, perSeed: [] };
    };
    return { evaluate, calls };
  }

  it('appends a SEPARATE run-horizon record after the live one; the live record is untouched', () => {
    // Primary: a wins by 5. Run horizon: a is worthless → the long record's null stands.
    const { evaluate, calls } = horizonEvaluator({
      base: { null: 0, a: 5 },
      run: { null: 3, a: 3 },
    });
    const shadowed = new RunArbitrationDriver(new RNG(1), {
      evaluate,
      shadowHorizon: { horizonBattles: 'run' },
    });
    const chosen = shadowed.decide('rewardDaemon', liveRun(7), [tagged('a')]);
    expect(chosen?.label).toBe('a'); // the live decision never reads the shadow
    expect(shadowed.decisions).toHaveLength(2);
    const [live, long] = shadowed.decisions;
    expect('horizon' in live!).toBe(false);
    expect(long!.horizon).toBe('run');
    expect(long!.site).toBe('rewardDaemon');
    expect(long!.labels).toEqual(live!.labels);
    expect(long!.results.map((r) => r.score)).toEqual([3, 3]);
    expect(long!.chosenIndex).toBe(0); // ties→NULL under the same ε rule
    expect(long!.marginVsNull).toBe(0);
    // Every candidate walked once per horizon — no extra evaluations.
    expect(calls).toEqual(['null@base', 'a@base', 'null@run', 'a@run']);

    const plain = new RunArbitrationDriver(new RNG(1), { evaluate });
    plain.decide('rewardDaemon', liveRun(7), [tagged('a')]);
    expect(live).toEqual(plain.decisions[0]);
  });

  it('the long record picks under the same ε rule (its own null, hysteresis intact)', () => {
    const { evaluate } = horizonEvaluator({
      base: { null: 0, a: 0, b: 0 },
      run: { null: 0, a: 0.2, b: 4 },
    });
    const driver = new RunArbitrationDriver(new RNG(1), {
      evaluate,
      epsilon: 0.25,
      shadowHorizon: { horizonBattles: 'run' },
    });
    driver.decide('test', liveRun(7), [tagged('a'), tagged('b')]);
    expect(driver.decisions[0]!.chosenIndex).toBe(0); // live: nothing beats null
    expect(driver.decisions[1]!.chosenIndex).toBe(2); // long: b clears ε, a does not
    expect(driver.decisions[1]!.marginVsNull).toBe(4);
  });

  it('a finite shadow horizon is carried on the record as a number', () => {
    const { evaluate } = horizonEvaluator({ base: { null: 0, a: 1 }, run: { null: 0, a: 1 } });
    // horizonBattles 3 is finite → the fake keys it 'base'; the marker is what's under test.
    const driver = new RunArbitrationDriver(new RNG(1), {
      evaluate,
      shadowHorizon: { horizonBattles: 3 },
    });
    driver.decide('test', liveRun(7), [tagged('a')]);
    expect(driver.decisions[1]!.horizon).toBe(3);
  });

  it('never perturbs the primary stream: labels + live records byte-equal shadow on/off', () => {
    const tables = {
      base: { null: 0, a: 5, b: 2 },
      run: { null: 9, a: 0, b: 0 },
    };
    const run = (shadow: boolean) => {
      const driver = new RunArbitrationDriver(new RNG(42), {
        evaluate: horizonEvaluator(tables).evaluate,
        ...(shadow ? { shadowHorizon: { horizonBattles: 'run' as const } } : {}),
      });
      const labels = [
        driver.decide('s1', liveRun(7), [tagged('a')])?.label ?? null,
        driver.decide('s2', liveRun(7), [tagged('a'), tagged('b')])?.label ?? null,
        driver.decide('s3', liveRun(7), [tagged('b')])?.label ?? null,
      ];
      return { labels, live: driver.decisions.filter((d) => d.horizon === undefined) };
    };
    const shadowed = run(true);
    const plain = run(false);
    expect(shadowed.labels).toEqual(plain.labels);
    expect(shadowed.live).toEqual(plain.live);
  });

  it('the 1-in-m sample is deterministic, consumes no RNG, and defaults to every decision', () => {
    const tables = { base: { null: 0, a: 1 }, run: { null: 0, a: 1 } };
    const longCount = (seed: number, sample?: number): { long: number; live: number } => {
      const driver = new RunArbitrationDriver(new RNG(seed), {
        evaluate: horizonEvaluator(tables).evaluate,
        shadowHorizon: { horizonBattles: 'run', ...(sample !== undefined ? { sample } : {}) },
      });
      for (let i = 0; i < 8; i++) driver.decide(`s${i}`, liveRun(7), [tagged('a')]);
      return {
        long: driver.decisions.filter((d) => d.horizon !== undefined).length,
        live: driver.decisions.filter((d) => d.horizon === undefined).length,
      };
    };
    expect(longCount(5)).toEqual({ long: 8, live: 8 }); // default sample 1
    expect(longCount(5, 1)).toEqual({ long: 8, live: 8 });
    const a = longCount(5, 3);
    const b = longCount(5, 3);
    expect(a).toEqual(b); // same seed ⇒ the same sampled subset
    expect(a.live).toBe(8); // sampling never drops a live record
    expect(a.long).toBeLessThanOrEqual(8);
    // The sampled decisions are the same SET, not just the same count: the
    // live records (and so the pairs) are identical, and the gate reads
    // only the first pair — pinned via the record sequence.
    const seq = (sample: number): string[] => {
      const driver = new RunArbitrationDriver(new RNG(5), {
        evaluate: horizonEvaluator(tables).evaluate,
        shadowHorizon: { horizonBattles: 'run', sample },
      });
      for (let i = 0; i < 8; i++) driver.decide(`s${i}`, liveRun(7), [tagged('a')]);
      return driver.decisions.map((d) => `${d.site}${d.horizon === undefined ? '' : '@run'}`);
    };
    expect(seq(3)).toEqual(seq(3));
  });

  it('rejects a malformed shadow config loud', () => {
    const { evaluate } = horizonEvaluator({ base: { null: 0 }, run: { null: 0 } });
    expect(
      () => new RunArbitrationDriver(new RNG(1), { evaluate, shadowHorizon: { horizonBattles: 0 } }),
    ).toThrow(/horizonBattles/);
    expect(
      () =>
        new RunArbitrationDriver(new RNG(1), {
          evaluate,
          shadowHorizon: { horizonBattles: 'run', sample: 0 },
        }),
    ).toThrow(/sample/);
    expect(
      () =>
        new RunArbitrationDriver(new RNG(1), {
          evaluate,
          shadowHorizon: { horizonBattles: 'run', sample: 1.5 },
        }),
    ).toThrow(/sample/);
  });

  /** 85b — a spec-aware fake: records which walk strategy and which
   *  walkPolicies each evaluation was handed, per horizon (the compose
   *  itself now lives in the EVALUATOR — the driver's job is passing the
   *  merged spec through unchanged). */
  function strategyProbe() {
    const seen: string[] = [];
    const evaluate = (
      _live: Run,
      apply: CandidateApply | null,
      spec: RunRolloutSpec,
    ): RunCandidateResult => {
      const label = apply === null ? 'null' : (apply as unknown as { label: string }).label;
      const horizon = Number.isFinite(spec.horizonBattles) ? 'base' : 'run';
      const s = spec.strategy;
      const p = spec.walkPolicies;
      const tags = `${p?.pickPacketFire !== undefined ? '+fire' : ''}${p?.pickPortBuy !== undefined ? '+port' : ''}`;
      seen.push(`${label}@${horizon}:${s === undefined ? 'default' : s.name}${tags}`);
      return { score: 0, perSeed: [] };
    };
    return { evaluate, seen };
  }

  it('85b — config walkPolicies ride EVERY spec (live and long), untouched by the driver', () => {
    const { evaluate, seen } = strategyProbe();
    const driver = new RunArbitrationDriver(new RNG(1), {
      evaluate,
      rollout: { horizonBattles: 1, walkPolicies: { pickPacketFire: () => null, pickPortBuy: () => null } },
      shadowHorizon: { horizonBattles: 'run' },
    });
    driver.decide('portBuy', liveRun(7), [tagged('a')]);
    // Both horizons carry the config overlay; the strategy slot stays the
    // walker default (the evaluator composes them at walk time).
    expect(seen).toEqual([
      'null@base:default+fire+port',
      'a@base:default+fire+port',
      'null@run:default+fire+port',
      'a@run:default+fire+port',
    ]);
  });

  it('85b — a per-call rollout override replaces walkPolicies (site gating) without touching the site strategy merge', () => {
    const { evaluate, seen } = strategyProbe();
    const driver = new RunArbitrationDriver(new RNG(1), {
      evaluate,
      rollout: { horizonBattles: 1, walkPolicies: { pickPacketFire: () => null, pickPortBuy: () => null } },
      shadowHorizon: { horizonBattles: 'run' },
    });
    const site = scoredStrategy('rollout-site', DEFAULT_SCORED_WEIGHTS);
    // The gated-override shape the port/fire sites use: the per-call
    // walkPolicies REPLACE the config overlay (suppression is expressed in
    // the replacement), while a per-call site strategy rides beside it.
    driver.decide('nodeChoice', liveRun(7), [tagged('a')], {
      rollout: { strategy: site, walkPolicies: { pickPortBuy: () => null } },
    });
    expect(seen).toEqual([
      'null@base:rollout-site+port',
      'a@base:rollout-site+port',
      'null@run:rollout-site+port',
      'a@run:rollout-site+port',
    ]);
  });

  it('85c (12c) — judgeLong STRIPS the prior: long-horizon specs score RAW whatever the live arm runs', () => {
    const seen: { horizon: string; priorLambda: number | undefined; hasTable: boolean }[] = [];
    const evaluate = (
      _live: Run,
      _apply: CandidateApply | null,
      spec: RunRolloutSpec,
    ): RunCandidateResult => {
      seen.push({
        horizon: Number.isFinite(spec.horizonBattles) ? 'base' : 'run',
        priorLambda: spec.priorLambda,
        hasTable: spec.priorTable !== undefined,
      });
      return { score: 0, perSeed: [] };
    };
    const driver = new RunArbitrationDriver(new RNG(1), {
      evaluate,
      rollout: { horizonBattles: 1, priorLambda: 0.5, priorTable: { 'daemon:minerva': 29.58 } },
      shadowHorizon: { horizonBattles: 'run' },
    });
    driver.decide('portBuy', liveRun(7), [tagged('a')]);
    // Live specs carry the fold; the long specs are stripped (the table
    // can never eat its own prior — the de-fold step by construction).
    expect(seen).toEqual([
      { horizon: 'base', priorLambda: 0.5, hasTable: true },
      { horizon: 'base', priorLambda: 0.5, hasTable: true },
      { horizon: 'run', priorLambda: undefined, hasTable: false },
      { horizon: 'run', priorLambda: undefined, hasTable: false },
    ]);
    // The records say so too: live 0.5, long ALWAYS 0.
    expect(driver.decisions).toHaveLength(2);
    expect(driver.decisions[0]!.priorLambda).toBe(0.5);
    expect(driver.decisions[0]!.horizon).toBeUndefined();
    expect(driver.decisions[1]!.priorLambda).toBe(0);
    expect(driver.decisions[1]!.horizon).toBe('run');
  });

  it('85b — walkPolicies change specs only: the driver decides byte-identically on/off (stream untouched)', () => {
    const tables = { base: { null: 0, a: 5, b: 2 }, run: { null: 9, a: 0, b: 0 } };
    const run = (overlay: boolean) => {
      const driver = new RunArbitrationDriver(new RNG(42), {
        evaluate: horizonEvaluator(tables).evaluate,
        ...(overlay
          ? { rollout: { horizonBattles: 1, walkPolicies: { pickPacketFire: () => null } } }
          : { rollout: { horizonBattles: 1 } }),
        shadowHorizon: { horizonBattles: 'run' },
      });
      const labels = [
        driver.decide('s1', liveRun(7), [tagged('a')])?.label ?? null,
        driver.decide('s2', liveRun(7), [tagged('a'), tagged('b')])?.label ?? null,
      ];
      return {
        labels,
        decisions: driver.decisions.map((d) => ({
          site: d.site,
          chosenIndex: d.chosenIndex,
          marginVsNull: d.marginVsNull,
          horizon: d.horizon,
        })),
      };
    };
    expect(run(true)).toEqual(run(false));
  });

  it('INTEGRATION: a run-end shadow walks every pair to complete/defeat on a 1-hop run', () => {
    // hopCount 1 = a one-node map (the root IS the terminal): the long walk
    // reaches a terminal in one node, so the run-end horizon is cheap to pin.
    const live = new Run(20260822, new EventBus<GameEvents>(), { hopCount: 1 });
    const mk = (shadow: boolean) => {
      const driver = new RunArbitrationDriver(new RNG(99), {
        rollout: { horizonBattles: 1 },
        rolloutsPerCandidate: 1,
        ...(shadow ? { shadowHorizon: { horizonBattles: 'run' as const } } : {}),
      });
      const chosen = driver.decide('nodeChoice', live, [enterRoot()]);
      return { chosen: chosen?.label ?? null, decisions: driver.decisions };
    };
    const shadowed = mk(true);
    const plain = mk(false);
    expect(shadowed.chosen).toBe(plain.chosen);
    expect(shadowed.decisions[0]).toEqual(plain.decisions[0]);
    expect(shadowed.decisions).toHaveLength(2);
    const long = shadowed.decisions[1]!;
    expect(long.horizon).toBe('run');
    expect(long.labels).toEqual(['null', 'enterNode:root']);
    for (const r of long.results) {
      expect(r.perSeed).toHaveLength(1);
      for (const p of r.perSeed) expect(p.completed || p.died).toBe(true);
    }
  });
});

describe('RunArbitrationDriver — the 84c shadow-only site (shadowDecide) + hopsRemaining', () => {
  function horizonEvaluator(tables: Record<'base' | 'run', Record<string, number>>) {
    const calls: string[] = [];
    const evaluate = (
      _live: Run,
      apply: CandidateApply | null,
      spec: RunRolloutSpec,
    ): RunCandidateResult => {
      const label = apply === null ? 'null' : (apply as unknown as { label: string }).label;
      const horizon = Number.isFinite(spec.horizonBattles) ? 'base' : 'run';
      calls.push(`${label}@${horizon}`);
      const score = tables[horizon][label];
      if (score === undefined) throw new Error(`horizonEvaluator: no score for '${label}'@${horizon}`);
      return { score, perSeed: [] };
    };
    return { evaluate, calls };
  }
  const PASS = tagged('null').apply; // an explicit baseline the fake reads as the null arm

  it('every record carries hopsRemaining read off the live run', () => {
    const { evaluate } = horizonEvaluator({ base: { null: 0, a: 1 }, run: { null: 0, a: 1 } });
    const driver = new RunArbitrationDriver(new RNG(1), {
      evaluate,
      shadowHorizon: { horizonBattles: 'run' },
    });
    const live = liveRun(7);
    driver.decide('test', live, [tagged('a')]);
    expect(driver.decisions).toHaveLength(2);
    for (const d of driver.decisions) expect(d.hopsRemaining).toBe(live.hopsRemaining);
    expect(live.hopsRemaining).toBeGreaterThan(0);
  });

  it('logs nothing when the shadow is off or the candidate set is empty', () => {
    const { evaluate, calls } = horizonEvaluator({ base: { null: 0 }, run: { null: 0, a: 1 } });
    const off = new RunArbitrationDriver(new RNG(1), { evaluate });
    off.shadowDecide('recruit', liveRun(7), PASS, [tagged('a')]);
    expect(off.decisions).toHaveLength(0);
    const on = new RunArbitrationDriver(new RNG(1), {
      evaluate,
      shadowHorizon: { horizonBattles: 'run', siteRng: new RNG(9) },
    });
    on.shadowDecide('recruit', liveRun(7), PASS, []);
    expect(on.decisions).toHaveLength(0);
    expect(calls).toHaveLength(0);
  });

  it('requires a site stream — throws loud without one', () => {
    const { evaluate } = horizonEvaluator({ base: { null: 0 }, run: { null: 0, a: 1 } });
    const driver = new RunArbitrationDriver(new RNG(1), {
      evaluate,
      shadowHorizon: { horizonBattles: 'run' },
    });
    expect(() => driver.shadowDecide('recruit', liveRun(7), PASS, [tagged('a')])).toThrow(
      /siteRng/,
    );
  });

  it('appends ONE long-horizon record: explicit null arm, labels, ε rule, horizon marker', () => {
    const { evaluate, calls } = horizonEvaluator({
      base: { null: 0 },
      run: { null: 1, a: 1.2, b: 6 },
    });
    const driver = new RunArbitrationDriver(new RNG(1), {
      evaluate,
      epsilon: 0.25,
      shadowHorizon: { horizonBattles: 'run', siteRng: new RNG(9) },
    });
    const live = liveRun(7);
    driver.shadowDecide('recruit', live, PASS, [tagged('a'), tagged('b')]);
    expect(driver.decisions).toHaveLength(1);
    const rec = driver.decisions[0]!;
    expect(rec.site).toBe('recruit');
    expect(rec.horizon).toBe('run');
    expect(rec.labels).toEqual(['null', 'a', 'b']);
    expect(rec.results.map((r) => r.score)).toEqual([1, 1.2, 6]);
    expect(rec.chosenIndex).toBe(2); // b clears ε; a (0.2 ≤ 0.25) would not
    expect(rec.marginVsNull).toBe(5);
    expect(rec.hopsRemaining).toBe(live.hopsRemaining);
    // The explicit baseline was evaluated as the null arm, at the long horizon only.
    expect(calls).toEqual(['null@run', 'a@run', 'b@run']);
  });

  it('never touches the driver stream: live + 84a records byte-equal with shadow-only calls interleaved', () => {
    const tables = { base: { null: 0, a: 5, b: 2 }, run: { null: 9, a: 0, b: 0, c: 3 } };
    const run = (interleave: boolean) => {
      const driver = new RunArbitrationDriver(new RNG(42), {
        evaluate: horizonEvaluator(tables).evaluate,
        shadowHorizon: { horizonBattles: 'run', siteRng: new RNG(9) },
      });
      const labels: (string | null)[] = [];
      labels.push(driver.decide('s1', liveRun(7), [tagged('a')])?.label ?? null);
      if (interleave) driver.shadowDecide('recruit', liveRun(7), PASS, [tagged('c')]);
      labels.push(driver.decide('s2', liveRun(7), [tagged('a'), tagged('b')])?.label ?? null);
      if (interleave) driver.shadowDecide('recruit', liveRun(7), PASS, [tagged('c')]);
      labels.push(driver.decide('s3', liveRun(7), [tagged('b')])?.label ?? null);
      return { labels, records: driver.decisions.filter((d) => d.site !== 'recruit') };
    };
    const with_ = run(true);
    const without = run(false);
    expect(with_.labels).toEqual(without.labels);
    expect(with_.records).toEqual(without.records);
  });

  it('84d — the site allowlist gates both the 84a shadow and shadow-only sites; absent = every site', () => {
    const tables = { base: { null: 0, a: 1 }, run: { null: 0, a: 1, c: 1 } };
    const mk = (sites?: readonly string[]) =>
      new RunArbitrationDriver(new RNG(1), {
        evaluate: horizonEvaluator(tables).evaluate,
        shadowHorizon: {
          horizonBattles: 'run',
          siteRng: new RNG(9),
          ...(sites !== undefined ? { sites } : {}),
        },
      });
    const gated = mk(['rewardDaemon', 'recruit']);
    gated.decide('grant:empower', liveRun(7), [tagged('a')]); // live only
    gated.decide('rewardDaemon', liveRun(7), [tagged('a')]); // live + shadow
    gated.shadowDecide('recruit', liveRun(7), PASS, [tagged('c')]); // shadow
    gated.shadowDecide('somethingElse', liveRun(7), PASS, [tagged('c')]); // nothing
    expect(gated.decisions.map((d) => `${d.site}${d.horizon === undefined ? '' : '@run'}`)).toEqual(
      ['grant:empower', 'rewardDaemon', 'rewardDaemon@run', 'recruit@run'],
    );
    const open = mk();
    open.decide('grant:empower', liveRun(7), [tagged('a')]);
    open.shadowDecide('somethingElse', liveRun(7), PASS, [tagged('c')]);
    expect(open.decisions.map((d) => d.horizon)).toEqual([undefined, 'run', 'run']);
  });

  it('the site stream is deterministic and the sample gate applies', () => {
    const tables = { base: { null: 0 }, run: { null: 0, a: 1 } };
    const mk = (sample?: number) => {
      const driver = new RunArbitrationDriver(new RNG(1), {
        evaluate: horizonEvaluator(tables).evaluate,
        shadowHorizon: {
          horizonBattles: 'run',
          siteRng: new RNG(9),
          ...(sample !== undefined ? { sample } : {}),
        },
      });
      for (let i = 0; i < 8; i++) driver.shadowDecide('recruit', liveRun(7), PASS, [tagged('a')]);
      return driver.decisions;
    };
    expect(mk()).toHaveLength(8);
    expect(mk(1)).toHaveLength(8);
    const a = mk(3);
    expect(a.length).toBeLessThanOrEqual(8);
    expect(a).toEqual(mk(3)); // same site seed ⇒ the same sampled subset
  });
});

describe('RunArbitrationDriver — integration (real evaluator)', () => {
  const CONFIG = { rollout: { horizonBattles: 1 } };

  it('ARBITRATION DETERMINISM (the exit criterion): same seed + config + state ⇒ same decision + log', () => {
    const mk = () => {
      const driver = new RunArbitrationDriver(new RNG(99), CONFIG);
      const chosen = driver.decide('nodeChoice', liveRun(20260730), [enterRoot()]);
      return { chosen: chosen?.label ?? null, record: driver.decisions[0]! };
    };
    const a = mk();
    const b = mk();
    expect(a.chosen).toBe(b.chosen);
    expect(a.record).toEqual(b.record);
  });

  it('an inert challenger loses to the null arm at ε=0 (ties→NULL, end to end)', () => {
    const driver = new RunArbitrationDriver(new RNG(99), CONFIG);
    const chosen = driver.decide('test', liveRun(20260730), [
      { label: 'inert', apply: () => {} },
    ]);
    expect(chosen).toBeNull();
    expect(driver.decisions[0]!.marginVsNull).toBe(0);
  });

  it('a decide never touches the live run', () => {
    const live = liveRun(20260730);
    const before = JSON.stringify(live.toJSON());
    const driver = new RunArbitrationDriver(new RNG(99), CONFIG);
    driver.decide('test', live, [enterRoot()]);
    expect(JSON.stringify(live.toJSON())).toBe(before);
  });
});
