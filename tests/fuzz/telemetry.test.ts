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
import { HEALTH } from '../../src/config/health';
import { ALL_ARCHETYPES } from '../../src/sim/archetypes';
import { runOne } from './harness';
import { makeStrategy } from './strategies/registry';

describe('TelemetryAccumulator', () => {
  it('tallies player-side combat and ignores enemies', () => {
    const acc = new TelemetryAccumulator();
    acc.registerUnit(1, 'player', 'mercenary');
    acc.registerUnit(2, 'enemy', 'mercenary');
    acc.registerUnit(3, 'player', 'healer');

    acc.recordAttack(1, 7); // player melee
    acc.recordAttack(2, 99); // enemy — ignored
    acc.recordDamageTaken(1, 4); // player melee absorbs a hit
    acc.recordDamageTaken(2, 50); // enemy absorbs — ignored
    acc.recordHeal(3, 5); // player healer
    acc.recordDeath(1);
    acc.recordXp(1, 40);
    acc.recordTurnChip({
      sector: 0,
      hop: 2,
      encounterId: 'brigands',
      player: 3,
      enemy: 1,
      playerPoolBefore: 20,
      playerPoolAfter: 19,
      enemyPoolBefore: 8,
      enemyPoolAfter: 5,
    });

    const t = acc.finish(['mercenary'], ['mercenary', 'healer']);
    expect(t.perArchetype.mercenary.damageDealt).toBe(7); // enemy's 99 excluded
    expect(t.perArchetype.mercenary.damageTaken).toBe(4); // enemy's 50 excluded
    // Deployments count player fieldings only (unit 1 melee, unit 3 healer; the
    // enemy melee unit 2 is excluded).
    expect(t.perArchetype.mercenary.deployments).toBe(1);
    expect(t.perArchetype.healer.deployments).toBe(1);
    expect(t.perArchetype.healer.healingDone).toBe(5);
    expect(t.perArchetype.mercenary.deaths).toBe(1);
    expect(t.perArchetype.mercenary.xpEarned).toBe(40);
    expect(t.perArchetype.mercenary.recruitPicks).toBe(1);
    expect(t.perArchetype.mercenary.finalCount).toBe(1);
    expect(t.perArchetype.healer.finalCount).toBe(1);
    expect(t.poolChips).toEqual([
      {
        sector: 0,
        hop: 2,
        encounterId: 'brigands',
        player: 3,
        enemy: 1,
        playerPoolBefore: 20,
        playerPoolAfter: 19,
        enemyPoolBefore: 8,
        enemyPoolAfter: 5,
      },
    ]);
  });

  it('a neutral-team unit never moves a tally (75-pre defense-in-depth)', () => {
    // The §75 camp shape: a combatant archetype on team 'neutral'. The harness
    // filters these at the subscription; this pins the accumulator's own team
    // gate so a neutral that slipped past the caller still contributes nothing.
    const acc = new TelemetryAccumulator();
    acc.registerUnit(1, 'neutral', 'mercenary');
    acc.recordAttack(1, 12);
    acc.recordDamageTaken(1, 8);
    acc.recordHeal(1, 5);
    acc.recordDeath(1);
    acc.recordXp(1, 30);
    const t = acc.finish([], []);
    expect(t.perArchetype.mercenary.deployments).toBe(0);
    expect(t.perArchetype.mercenary.damageDealt).toBe(0);
    expect(t.perArchetype.mercenary.damageTaken).toBe(0);
    expect(t.perArchetype.mercenary.healingDone).toBe(0);
    expect(t.perArchetype.mercenary.deaths).toBe(0);
    expect(t.perArchetype.mercenary.xpEarned).toBe(0);
  });

  it('skips units it never registered (non-fatal)', () => {
    const acc = new TelemetryAccumulator();
    expect(() => acc.recordAttack(999, 5)).not.toThrow();
    const t = acc.finish([], []);
    expect(t.perArchetype.mercenary.damageDealt).toBe(0);
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
      acc.registerUnit(1, 'player', 'mercenary');
      acc.recordAttack(1, dmg);
      for (let i = 0; i < deaths; i++) acc.recordDeath(1);
      acc.recordTurnChip({
        sector: 0,
        hop: 1,
        encounterId: 'enc',
        player: chip,
        enemy: chip + 1,
        playerPoolBefore: 20,
        playerPoolAfter: 20 - (chip + 1),
        enemyPoolBefore: 8,
        enemyPoolAfter: 8 - chip,
      });
      return acc.finish([], []);
    };
    const agg = aggregateTelemetry([mk(10, 1, 2), mk(6, 3, 4)]);
    expect(agg.runs).toBe(2);
    expect(agg.perArchetype.mercenary.damageDealt).toBe(16);
    expect(agg.perArchetype.mercenary.deployments).toBe(2); // one fielding per run
    expect(agg.perArchetype.mercenary.deaths).toBe(4);
    expect(agg.perArchetype.mercenary.deathsPerRun).toBe(2); // 4 / 2 runs
    // chips: player {2,4} enemy {3,5} over 2 turns → means 3 and 4.
    expect(agg.meanPoolChip).toEqual({ player: 3, enemy: 4, turns: 2 });
  });
});

describe('telemetry integration (real headless run)', () => {
  const SEED = 1;
  const opts = { runConfig: { hopCount: 3 } } as const;

  it('collects mechanism telemetry that is structurally consistent', () => {
    const res = runOne(SEED, makeStrategy('greedy')!, { ...opts, telemetry: true });
    expect(res.telemetry).toBeDefined();
    const t = res.telemetry!;

    // The run fought at least one turn → at least one pool chip.
    expect(t.poolChips.length).toBeGreaterThan(0);
    // 89a — every chip carries the APPLIED pools, and under the survivors
    // rule the applied delta IS survivor power × chipMultiplier, clamped at 0
    // (the identity §91's casualty rule flips — this pin is the one that
    // must be rewritten with it, never loosened). Independent of the reader:
    // the pools come from Run's `pools:chipped`, the survivors from the
    // World's `battle:ended`.
    const m = HEALTH.chipMultiplier;
    for (const c of t.poolChips) {
      expect(c.playerPoolBefore).toBeGreaterThanOrEqual(0);
      expect(c.playerPoolBefore).toBeLessThanOrEqual(HEALTH.playerHealthMax);
      expect(c.playerPoolAfter).toBe(Math.max(0, c.playerPoolBefore - c.enemy * m));
      expect(c.enemyPoolAfter).toBe(Math.max(0, c.enemyPoolBefore - c.player * m));
    }
    // Every battle produced exactly one whole chip record (the two-event
    // stitch never dropped or doubled one).
    expect(t.poolChips.length).toBe(res.battles.length);
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
    expect(on.finalHopReached).toBe(off.finalHopReached);
    expect(on.totalTicks).toBe(off.totalTicks);
    expect(on.battles.length).toBe(off.battles.length);
    expect(on.finalTeamSize).toBe(off.finalTeamSize);
  });
});
