// The friction log's filing tool (scripts/papercut.mjs): the session id it
// finds for itself, the text from a file or stdin kept whole, and what it
// refuses.
import { describe, expect, it } from 'vitest';
import { entryFrom } from '../scripts/papercut.mjs';

const now = new Date('2026-10-25T12:00:00.000Z');
const B = '\\';

describe('npm run papercut', () => {
  it('takes the session id from the desktop app, then the old variable, with --session first', () => {
    const app = { CLAUDE_CODE_SESSION_ID: '96d1ff74-3e6d-49fb-8a5f-677f3023f5b5', CLAUDE_SESSION_ID: '' };
    expect(entryFrom({ argv: ['--who=c', '--phase=1a', 'x'], env: app, now }).entry?.session).toBe('96d1ff74');
    expect(entryFrom({ argv: ['--who=c', '--phase=1a', 'x'], env: { CLAUDE_SESSION_ID: 'abc12345' }, now }).entry?.session).toBe('abc12345');
    expect(entryFrom({ argv: ['--who=c', '--session=ff00ff00', 'x'], env: app, now }).entry?.session).toBe('ff00ff00');
  });

  it('keeps a supplied text whole, quotes, backticks and backslashes, on one line', () => {
    const text = `a "quoted" \`tick\` C:${B}Users${B}x\nsecond line\n`;
    const { entry, warnings } = entryFrom({ argv: ['--who=c', '--phase=1a', '--file=n.txt'], env: {}, text, now });
    expect(entry?.text).toBe(`a "quoted" \`tick\` C:${B}Users${B}x second line`);
    expect(entry?.ts).toBe('2026-10-25T12:00:00.000Z');
    expect(warnings).toEqual([expect.stringContaining('no session id')]);
  });

  it('still takes the text as words', () => {
    const { entry } = entryFrom({ argv: ['--who=c', '--kind=distress', '--phase=1a', 'a', 'b'], env: {}, now });
    expect(entry).toMatchObject({ who: 'c', kind: 'distress', phase: '1a', text: 'a b' });
  });

  it('refuses a filing with no filer, no text, two texts or an unknown kind', () => {
    expect(entryFrom({ argv: ['x'], env: {}, now }).error).toMatch(/usage/);
    expect(entryFrom({ argv: ['--who=c'], env: {}, now }).error).toMatch(/usage/);
    expect(entryFrom({ argv: ['--who=c', '--stdin', 'x'], env: {}, text: 'y', now }).error).toMatch(/once/);
    expect(entryFrom({ argv: ['--who=c', '--kind=gripe', 'x'], env: {}, now }).error).toMatch(/--kind/);
  });
});
