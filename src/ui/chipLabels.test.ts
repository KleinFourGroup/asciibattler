/**
 * §91d — the chip rule's player-facing words, pinned by rule set. The
 * wording is free to change; what is pinned is that each rule set names the
 * RIGHT quantity (fallen, and survivors on a cap turn) on each pool, that a
 * two-rule cap turn names both, and that the live labels come from
 * `rulesForTurn`.
 */

import { describe, it, expect } from 'vitest';
import { chipLineLabels, riskLineTitle, powerTooltip } from './chipLabels';
import { rulesForTurn, type ChipRule } from '../run/chipRule';

const set = (...rules: ChipRule[]) => new Set<ChipRule>(rules);

describe('chipLabels (§91d)', () => {
  it('casualties alone: each line names the pool\'s OWN fallen, never the survivors', () => {
    const l = chipLineLabels(set('casualties'));
    expect(l.toEnemyPool).toMatch(/enemy fallen/i);
    expect(l.toEnemyPool).toMatch(/enemy morale/i);
    expect(l.toPlayerPool).toMatch(/your fallen/i);
    expect(l.toPlayerPool).toMatch(/your morale/i);
    expect(l.toEnemyPool + l.toPlayerPool).not.toMatch(/survivors/i);
  });

  it('both rules (a cap turn under the surcharge): each line names BOTH quantities', () => {
    const l = chipLineLabels(set('casualties', 'survivors'));
    expect(l.toEnemyPool).toMatch(/enemy fallen/i);
    expect(l.toEnemyPool).toMatch(/your survivors/i);
    expect(l.toPlayerPool).toMatch(/your fallen/i);
    expect(l.toPlayerPool).toMatch(/enemy survivors/i);
  });

  it('composes with rulesForTurn: the same turn reads differently by reason', () => {
    expect(chipLineLabels(rulesForTurn('decisive'))).toEqual(chipLineLabels(set('casualties')));
    expect(chipLineLabels(rulesForTurn('mutualWipe'))).toEqual(chipLineLabels(set('casualties')));
    expect(chipLineLabels(rulesForTurn('cap'))).toEqual(chipLineLabels(set('casualties', 'survivors')));
  });

  it('the risk line title counts the hand', () => {
    expect(riskLineTitle()).toMatch(/every unit in your hand falling/i);
    expect(riskLineTitle()).not.toMatch(/surviving/i);
  });

  it('the power tooltip says what power COSTS', () => {
    expect(powerTooltip('player')).toMatch(/your morale loses/i);
    expect(powerTooltip('enemy')).toMatch(/enemy morale loses/i);
    expect(powerTooltip()).toMatch(/its side's morale loses/i);
    for (const t of [undefined, 'player', 'enemy'] as const) {
      expect(powerTooltip(t)).toMatch(/falls/i);
      expect(powerTooltip(t)).not.toMatch(/chips/i);
    }
  });
});
