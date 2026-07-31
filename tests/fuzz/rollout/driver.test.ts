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
