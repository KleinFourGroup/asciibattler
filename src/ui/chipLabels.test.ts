/**
 * §91d — the chip rule's player-facing words, pinned by rule set. The
 * wording is free to change; what is pinned is that each rule set names the
 * RIGHT quantity (fallen vs survivors) on each pool, that a two-rule cap
 * turn names both, and that the live labels come from `rulesForTurn`.
 */

import { describe, it, expect } from 'vitest';
import { chipLineLabels, riskLineTitle, powerTooltip } from './chipLabels';
import { rulesForTurn, type ChipRule } from '../run/chipRule';

const set = (...rules: ChipRule[]) => new Set<ChipRule>(rules);

describe('chipLabels (§91d)', () => {
  it('survivors alone: each line names the OPPOSING survivors, never the fallen', () => {
    const l = chipLineLabels(set('survivors'));
    expect(l.toEnemyPool).toMatch(/your survivors/i);
    expect(l.toEnemyPool).toMatch(/enemy pool/i);
    expect(l.toPlayerPool).toMatch(/enemy survivors/i);
    expect(l.toPlayerPool).toMatch(/your pool/i);
    expect(l.toEnemyPool + l.toPlayerPool).not.toMatch(/fallen/i);
  });

  it('casualties alone: each line names the pool\'s OWN fallen, never the survivors', () => {
    const l = chipLineLabels(set('casualties'));
    expect(l.toEnemyPool).toMatch(/enemy fallen/i);
    expect(l.toEnemyPool).toMatch(/enemy pool/i);
    expect(l.toPlayerPool).toMatch(/your fallen/i);
    expect(l.toPlayerPool).toMatch(/your pool/i);
    expect(l.toEnemyPool + l.toPlayerPool).not.toMatch(/survivors/i);
  });

  it('both rules (a cap turn under the surcharge): each line names BOTH quantities', () => {
    const l = chipLineLabels(set('casualties', 'survivors'));
    expect(l.toEnemyPool).toMatch(/enemy fallen/i);
    expect(l.toEnemyPool).toMatch(/your survivors/i);
    expect(l.toPlayerPool).toMatch(/your fallen/i);
    expect(l.toPlayerPool).toMatch(/enemy survivors/i);
  });

  it('composes with rulesForTurn: the same turn reads differently by reason under (casualties, survivors)', () => {
    const h = { chipMode: 'casualties', capPenalty: 'survivors' } as const;
    expect(chipLineLabels(rulesForTurn('decisive', h))).toEqual(chipLineLabels(set('casualties')));
    expect(chipLineLabels(rulesForTurn('mutualWipe', h))).toEqual(chipLineLabels(set('casualties')));
    expect(chipLineLabels(rulesForTurn('cap', h))).toEqual(chipLineLabels(set('casualties', 'survivors')));
    // One rule twice is still one rule.
    const one = { chipMode: 'survivors', capPenalty: 'survivors' } as const;
    expect(chipLineLabels(rulesForTurn('cap', one))).toEqual(chipLineLabels(set('survivors')));
  });

  it('the risk line title counts the wave under survivors and the hand under casualties', () => {
    expect(riskLineTitle('survivors')).toMatch(/every enemy in the wave surviving/i);
    expect(riskLineTitle('casualties')).toMatch(/every unit in your hand falling/i);
    expect(riskLineTitle('casualties')).not.toMatch(/surviving/i);
  });

  it('the power tooltip says what power COSTS under casualties and what it CHIPS under survivors', () => {
    expect(powerTooltip('survivors')).toMatch(/chips the opposing/i);
    expect(powerTooltip('survivors', 'enemy')).toBe(powerTooltip('survivors'));
    expect(powerTooltip('casualties', 'player')).toMatch(/your pool loses/i);
    expect(powerTooltip('casualties', 'enemy')).toMatch(/enemy pool loses/i);
    expect(powerTooltip('casualties')).toMatch(/its side's pool loses/i);
    for (const t of [undefined, 'player', 'enemy'] as const) {
      expect(powerTooltip('casualties', t)).toMatch(/falls/i);
      expect(powerTooltip('casualties', t)).not.toMatch(/chips/i);
    }
  });
});
