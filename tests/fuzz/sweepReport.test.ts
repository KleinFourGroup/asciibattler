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
      'melee_dmg,melee_dmgTaken,melee_deathsPerRun,melee_heal,melee_xp,melee_final,' +
      'ranged_dmg,ranged_dmgTaken,ranged_deathsPerRun,ranged_heal,ranged_xp,ranged_final',
    '0.625,0.6,0.7,0,0,0.6,4.47,0.99,' +
      '60918,43210,21.7,0,210529,96,' +
      '22917,31050,16.8,0,86451,60',
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
    expect(row.archetypes.melee.dmgTaken).toBe(43210);
    expect(row.archetypes.ranged.final).toBe(60);
  });

  it('throws on a header with no bestTrainWin column', () => {
    expect(() => parseSweepCsv('a,b,c\n1,2,3\n')).toThrow(/bestTrainWin/);
  });
});

describe('renderSweepReport', () => {
  it('renders knobs, win rates, gradient, and only the active archetypes', () => {
    const report = renderSweepReport(parseSweepCsv(FULL_CSV));
    expect(report).toContain('difficulty.budgetFactor=0.625');
    expect(report).toContain('60%'); // best-achievable
    expect(report).toContain('+60pt'); // gradient
    expect(report).toContain('melee');
    expect(report).toContain('60.9k'); // humanized melee damage
    expect(report).toContain('ranged');
    // rogue/healer/mage/catapult did nothing here → folded into the inactive note.
    expect(report).toContain('inactive: rogue, healer, mage, catapult');
  });

  it('renders an older CSV missing a column as "—" rather than throwing', () => {
    const oldCsv =
      [
        'difficulty.budgetFactor,bestTrainWin,bestTestWin,pureRandomWin,greedyWin,gradient,meanChipPlayer,meanChipEnemy,' +
          'melee_dmg,melee_deathsPerRun,melee_heal,melee_xp,melee_final',
        '0.625,0.6,0.7,0,0,0.6,4.47,0.99,60918,21.7,0,210529,96',
      ].join('\n') + '\n';
    const report = reportFromCsv(oldCsv); // no melee_dmgTaken column
    expect(report).toContain('melee');
    expect(report).toContain('60.9k'); // damage still parses
    expect(report).toContain('—'); // the absent dmgTaken cell
  });
});
