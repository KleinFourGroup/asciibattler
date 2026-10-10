import { describe, expect, it } from 'vitest';
import { copyBy } from './copyText';

// 118f — the two ways a copy is tried, in order, on planted steps.

function steps(clipboard: 'grants' | 'refuses' | 'absent', command: 'grants' | 'refuses' | 'throws') {
  const calls: string[] = [];
  return {
    calls,
    steps: {
      clipboard:
        clipboard === 'absent'
          ? null
          : (text: string): Promise<void> => {
              calls.push(`clipboard:${text}`);
              return clipboard === 'grants' ? Promise.resolve() : Promise.reject(new DOMException('no', 'NotAllowedError'));
            },
      command: (text: string): boolean => {
        calls.push(`command:${text}`);
        if (command === 'throws') throw new Error('no');
        return command === 'grants';
      },
    },
  };
}

describe('118f — copyBy', () => {
  it('stops at the clipboard where it grants', async () => {
    const s = steps('grants', 'grants');
    expect(await copyBy(s.steps, 'x')).toBe(true);
    expect(s.calls).toEqual(['clipboard:x']);
  });

  it('falls to the old command where the clipboard refuses', async () => {
    const s = steps('refuses', 'grants');
    expect(await copyBy(s.steps, 'x')).toBe(true);
    expect(s.calls).toEqual(['clipboard:x', 'command:x']);
  });

  it('goes straight to the old command on a page with no clipboard', async () => {
    const s = steps('absent', 'grants');
    expect(await copyBy(s.steps, 'x')).toBe(true);
    expect(s.calls).toEqual(['command:x']);
  });

  it('says so when both refuse, whether the command answers false or throws', async () => {
    expect(await copyBy(steps('refuses', 'refuses').steps, 'x')).toBe(false);
    expect(await copyBy(steps('refuses', 'throws').steps, 'x')).toBe(false);
    expect(await copyBy(steps('absent', 'refuses').steps, 'x')).toBe(false);
  });
});
