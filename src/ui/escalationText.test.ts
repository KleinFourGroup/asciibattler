import { describe, expect, it } from 'vitest';
import { ESCALATION_MAX } from '../config/escalation';
import { UI_EN } from '../i18n/ui';
import { escalationAdds, escalationName, escalationTooltip } from './escalationText';

// 117e — the Escalation levels in words, on the shipped ladder and the
// English table.

describe('117e — a level in words', () => {
  it('says what each level of the shipped ladder adds: these, by hand', () => {
    expect(ESCALATION_MAX).toBe(5);
    expect([0, 1, 2, 3, 4, 5].map(escalationAdds)).toEqual([
      'The standard run.',
      'Enemies are a higher level.',
      'Enemy waves are larger.',
      'You earn fewer bits.',
      'Enemies are a higher level still.',
      'Enemy waves are larger still.',
    ]);
  });

  it('names a level by its number', () => {
    expect(escalationName(0)).toBe('Escalation 0');
    expect(escalationName(5)).toBe('Escalation 5');
  });

  it('holds no percentage and no number in any sentence', () => {
    // The spec's rule: the ladder adds and multiplies, and a percentage in
    // the words would be read as a sum.
    const sentences = Object.entries(UI_EN).filter(([key]) => key.startsWith('escalation.adds.') || key === 'escalation.off');
    expect(sentences.length).toBe(7);
    for (const [key, value] of sentences) {
      expect(typeof value, key).toBe('string');
      expect(value as string, key).not.toMatch(/[%0-9×]/);
    }
    for (const key of ['escalation.tip.keeps', 'escalation.tip.unlock', 'gameover.unlocked']) {
      expect(UI_EN[key] as string, key).not.toMatch(/%/);
    }
  });
});

describe('117e — the picker’s tooltip', () => {
  it('lists every level in effect under the sentence that says they are kept', () => {
    expect(escalationTooltip(3).split('\n')).toEqual([
      'Each level keeps every level under it.',
      '1  Enemies are a higher level.',
      '2  Enemy waves are larger.',
      '3  You earn fewer bits.',
      '',
      'Win a run at your highest level to open the next one for this character. A run from a typed seed opens nothing.',
    ]);
  });

  it('at 0 says only how a level is opened', () => {
    expect(escalationTooltip(0)).toBe(
      'Win a run at your highest level to open the next one for this character. A run from a typed seed opens nothing.',
    );
  });

  it('at the top lists the whole ladder', () => {
    expect(escalationTooltip(ESCALATION_MAX).split('\n')).toHaveLength(ESCALATION_MAX + 3);
  });
});
