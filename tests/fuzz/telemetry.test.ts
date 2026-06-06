/**
 * H7c — telemetry tests. Opt-in with the fuzz suite (`npm run fuzz:smoke`).
 *
 * Two layers: the `TelemetryAccumulator` unit (player-side gating, the recorded
 * tallies, the recruit/composition fold-in) + `aggregateTelemetry`, pinned with
 * hand-fed data; and an integration run that proves telemetry is collected from
 * a real headless run AND is pure observation — a telemetry-on run is
 * byte-identical in OUTCOME to a telemetry-off run (the fuzz-baseline guard).
 *
 * Balance-proof: the integration asserts STRUCTURAL relations (final-count sums
 * to roster size; combat produced damage; pool chips exist) — never a hardcoded
 * damage/HP number that a balance edit would churn.
 */

import { describe, it, expect } from 'vitest';
import { TelemetryAccumulator, aggregateTelemetry, type RunTelemetry } from './telemetry';
import { ALL_ARCHETYPES } from '../../src/sim/archetypes';
import { runOne } from './harness';
import { makeStrategy } from './strategies/registry';

describe('TelemetryAccumulator', () => {
  it('tallies player-side combat and ignores enemies', () => {
    const acc = new TelemetryAccumulator();
    acc.registerUnit(1, 'player', 'melee');
    acc.registerUnit(2, 'enemy', 'melee');
    acc.registerUnit(3, 'player', 'healer');

    acc.recordAttack(1, 7); // player melee
    acc.recordAttack(2, 99); // enemy — ignored
    acc.recordDamageTaken(1, 4); // player melee absorbs a hit
    acc.recordDamageTaken(2, 50); // enemy absorbs — ignored
    acc.recordHeal(3, 5); // player healer
    acc.recordDeath(1);
    acc.recordXp(1, 40);
    acc.recordTurnChip(2, 3, 1);

    const t = acc.finish(['melee'], ['melee', 'healer']);
    expect(t.perArchetype.melee.damageDealt).toBe(7); // enemy's 99 excluded
    expect(t.perArchetype.melee.damageTaken).toBe(4); // enemy's 50 excluded
    // Deployments count player fieldings only (unit 1 melee, unit 3 healer; the
    // enemy melee unit 2 is excluded).
    expect(t.perArchetype.melee.deployments).toBe(1);
    expect(t.perArchetype.healer.deployments).toBe(1);
    expect(t.perArchetype.healer.healingDone).toBe(5);
    expect(t.perArchetype.melee.deaths).toBe(1);
    expect(t.perArchetype.melee.xpEarned).toBe(40);
    expect(t.perArchetype.melee.recruitPicks).toBe(1);
    expect(t.perArchetype.melee.finalCount).toBe(1);
    expect(t.perArchetype.healer.finalCount).toBe(1);
    expect(t.poolChips).toEqual([{ floor: 2, player: 3, enemy: 1 }]);
  });

  it('skips units it never registered (non-fatal)', () => {
    const acc = new TelemetryAccumulator();
    expect(() => acc.recordAttack(999, 5)).not.toThrow();
    const t = acc.finish([], []);
    expect(t.perArchetype.melee.damageDealt).toBe(0);
  });
});

describe('aggregateTelemetry', () => {
  it('zero-fills an empty set', () => {
    const agg = aggregateTelemetry([]);
    expect(agg.runs).toBe(0);
    expect(agg.meanPoolChip).toEqual({ player: 0, enemy: 0, turns: 0 });
    for (const a of ALL_ARCHETYPES) expect(agg.perArchetype[a].damageDealt).toBe(0);
  });

  it('sums run totals and means deaths-per-run + pool chips', () => {
    const mk = (dmg: number, deaths: number, chip: number): RunTelemetry => {
      const acc = new TelemetryAccumulator();
      acc.registerUnit(1, 'player', 'melee');
      acc.recordAttack(1, dmg);
      for (let i = 0; i < deaths; i++) acc.recordDeath(1);
      acc.recordTurnChip(1, chip, chip + 1);
      return acc.finish([], []);
    };
    const agg = aggregateTelemetry([mk(10, 1, 2), mk(6, 3, 4)]);
    expect(agg.runs).toBe(2);
    expect(agg.perArchetype.melee.damageDealt).toBe(16);
    expect(agg.perArchetype.melee.deployments).toBe(2); // one fielding per run
    expect(agg.perArchetype.melee.deaths).toBe(4);
    expect(agg.perArchetype.melee.deathsPerRun).toBe(2); // 4 / 2 runs
    // chips: player {2,4} enemy {3,5} over 2 turns → means 3 and 4.
    expect(agg.meanPoolChip).toEqual({ player: 3, enemy: 4, turns: 2 });
  });
});

describe('telemetry integration (real headless run)', () => {
  const SEED = 1;
  const opts = { runConfig: { floorCount: 3 } } as const;

  it('collects mechanism telemetry that is structurally consistent', () => {
    const res = runOne(SEED, makeStrategy('greedy')!, { ...opts, telemetry: true });
    expect(res.telemetry).toBeDefined();
    const t = res.telemetry!;

    // The run fought at least one turn → at least one pool chip.
    expect(t.poolChips.length).toBeGreaterThan(0);
    // Combat happened → some player archetype dealt AND took damage.
    const totalDamage = ALL_ARCHETYPES.reduce((s, a) => s + t.perArchetype[a].damageDealt, 0);
    expect(totalDamage).toBeGreaterThan(0);
    const totalTaken = ALL_ARCHETYPES.reduce((s, a) => s + t.perArchetype[a].damageTaken, 0);
    expect(totalTaken).toBeGreaterThan(0);
    // Deployments are tracked → per-deployment normalization is computable for
    // any archetype that dealt damage (its denominator is non-zero).
    for (const a of ALL_ARCHETYPES) {
      if (t.perArchetype[a].damageDealt > 0) expect(t.perArchetype[a].deployments).toBeGreaterThan(0);
    }
    // Final composition is exactly the roster.
    const totalFinal = ALL_ARCHETYPES.reduce((s, a) => s + t.perArchetype[a].finalCount, 0);
    expect(totalFinal).toBe(res.finalTeamSize);
    // Recruit picks reconcile with the recruit log.
    const picks = ALL_ARCHETYPES.reduce((s, a) => s + t.perArchetype[a].recruitPicks, 0);
    expect(picks).toBe(res.recruits.length);
  });

  it('is pure observation — outcome is identical with telemetry off (baseline guard)', () => {
    const off = runOne(SEED, makeStrategy('greedy')!, opts);
    const on = runOne(SEED, makeStrategy('greedy')!, { ...opts, telemetry: true });
    expect(off.telemetry).toBeUndefined();
    expect(on.outcome).toBe(off.outcome);
    expect(on.finalFloorReached).toBe(off.finalFloorReached);
    expect(on.totalTicks).toBe(off.totalTicks);
    expect(on.battles.length).toBe(off.battles.length);
    expect(on.finalTeamSize).toBe(off.finalTeamSize);
  });
});
