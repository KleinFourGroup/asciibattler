// The context meter's hand-off line (.claude/skills/context-meter/hooks/handoff.ts):
// which commands are commits, the trigger, and a commit that didn't land. The
// mod's wiring in register.ts is checked by the plugin type-check and live.
import { describe, expect, it } from 'vitest';
import { HAND_OFF_AT, commitIn, landed, pastTrigger } from '../.claude/skills/context-meter/hooks/handoff.ts';

describe('the hand-off line', () => {
  it('finds a commit, with the folder a -C names', () => {
    expect(commitIn('git commit -q -F msg.txt')).toEqual({});
    expect(commitIn('cd /c/repo && git add a && git commit -m x')).toEqual({});
    expect(commitIn('git -C ../tree commit -m x')).toEqual({ dir: '../tree' });
    expect(commitIn('git -c user.name=x commit --amend')).toEqual({});
    expect(commitIn('git -C "C:/a b" -c k=v commit')).toEqual({ dir: 'C:/a b' });
  });

  it('finds none in commit-tree, a grep for the word, or another command', () => {
    expect(commitIn('git commit-tree HEAD^{tree}')).toBeUndefined();
    expect(commitIn('git log --grep=commit')).toBeUndefined();
    expect(commitIn('git status')).toBeUndefined();
  });

  it('is past the trigger only over 500k', () => {
    expect(HAND_OFF_AT).toBe(500_000);
    expect(pastTrigger(undefined)).toBe(false);
    expect(pastTrigger(499_999)).toBe(false);
    expect(pastTrigger(500_000)).toBe(false);
    expect(pastTrigger(500_001)).toBe(true);
  });

  it('counts a commit as landed only when HEAD moved, or git could not say', () => {
    expect(landed('abc', 'abc')).toBe(false);
    expect(landed('abc', 'def')).toBe(true);
    expect(landed(undefined, 'def')).toBe(true);
    expect(landed('abc', undefined)).toBe(true);
  });
});
