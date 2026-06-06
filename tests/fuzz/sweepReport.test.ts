/**
 * H7c — sweep-report tests. Opt-in with the fuzz suite (`npm run fuzz:smoke`).
 *
 * Pins the CSV→report pipeline: column-name parsing, the active-archetype
 * filter, and graceful handling of an OLDER CSV that predates a column (e.g.
 * `dmgTaken`) — which must render as `—`, not throw.
 */

import { describe, it, expect } from 'vitest';
import { parseSweepCsv, renderSweepReport, reportFromCsv } from './sweepReport';

const FULL_CSV =
  [
    'difficulty.budgetFactor,bestTrainWin,bestTestWin,pureRandomWin,greedyWin,gradient,meanChipPlayer,meanChipEnemy,' +
      'melee_dmg,melee_dmgTaken,melee_deployments,melee_deathsPerRun,melee_heal,melee_xp,melee_final,' +
      'ranged_dmg,ranged_dmgTaken,ranged_deployments,ranged_deathsPerRun,ranged_heal,ranged_xp,ranged_final',
    '0.625,0.6,0.7,0,0,0.6,4.47,0.99,' +
      '60918,43210,100,21.7,0,210529,96,' +
      '22917,31050,60,16.8,0,86451,60',
  ].join('\n') + '\n';

describe('parseSweepCsv', () => {
  it('splits knob columns from metrics and parses per-archetype fields by name', () => {
    const parsed = parseSweepCsv(FULL_CSV);
    expect(parsed.knobPaths).toEqual(['difficulty.budgetFactor']);
    expect(parsed.rows).toHaveLength(1);
    const row = parsed.rows[0]!;
    expect(row.knobs['difficulty.budgetFactor']).toBe('0.625');
    expect(row.metrics.bestTrainWin).toBe(0.6);
    expect(row.metrics.gradient).toBe(0.6);
    expect(row.archetypes.melee.dmg).toBe(60918);
    expect(row.archetypes.melee.deployments).toBe(100);
    expect(row.archetypes.ranged.final).toBe(60);
  });

  it('throws on a header with no bestTrainWin column', () => {
    expect(() => parseSweepCsv('a,b,c\n1,2,3\n')).toThrow(/bestTrainWin/);
  });
});

describe('renderSweepReport', () => {
  it('renders knobs, win rates, gradient, and PER-DEPLOYMENT archetype values', () => {
    const report = renderSweepReport(parseSweepCsv(FULL_CSV));
    expect(report).toContain('difficulty.budgetFactor=0.625');
    expect(report).toContain('60%'); // best-achievable
    expect(report).toContain('+60pt'); // gradient
    expect(report).toContain('dmg/dep'); // the per-deployment column header
    expect(report).toContain('609'); // melee dmg/dep = 60918 / 100 deployments
    expect(report).toContain('382'); // ranged dmg/dep = 22917 / 60 deployments
    // rogue/healer/mage/catapult never fielded → folded into the inactive note.
    expect(report).toContain('inactive: rogue, healer, mage, catapult');
  });

  it('renders an older CSV missing columns as "—" rather than throwing', () => {
    const oldCsv =
      [
        'difficulty.budgetFactor,bestTrainWin,bestTestWin,pureRandomWin,greedyWin,gradient,meanChipPlayer,meanChipEnemy,' +
          'melee_dmg,melee_deathsPerRun,melee_heal,melee_xp,melee_final',
        '0.625,0.6,0.7,0,0,0.6,4.47,0.99,60918,21.7,0,210529,96',
      ].join('\n') + '\n';
    const report = reportFromCsv(oldCsv); // no melee_deployments / dmgTaken columns
    expect(report).toContain('melee'); // final 96 > 0 → still shown
    expect(report).toContain('96'); // final count parses
    expect(report).toContain('—'); // per-deployment cells absent (no denominator)
  });
});
