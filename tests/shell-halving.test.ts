// The backslash note's model (.claude/skills/context-meter/hooks/halving.ts)
// held to the cases measured on Claude Code 2.1.308 (WORKLOG §130, 130e): a run
// of backslashes halves, rounding up, unless a double quote follows it, and
// the note fires only where bash's reading changed.
import { describe, expect, it } from 'vitest';
import { changedLines, halve, halvingNote } from '../.claude/skills/context-meter/hooks/halving.ts';

// One backslash, so each case below spells its run's length out.
const B = '\\';

describe('the Bash tool halving', () => {
  it('halves a run, rounding up, and keeps a run a double quote follows', () => {
    expect(halve(`'a:${B}${B}'`)).toBe(`'a:${B}'`);
    expect(halve(`'d:${B}${B}${B}x'`)).toBe(`'d:${B}${B}x'`);
    expect(halve(`"X:${B}${B}${B}"Y"`)).toBe(`"X:${B}${B}${B}"Y"`);
    expect(halve(`'S:${B}${B}${B}"'`)).toBe(`'S:${B}${B}${B}"'`);
    expect(halve(`'a${B}b'`)).toBe(`'a${B}b'`);
  });

  it('notes a single-quoted run and a quoted heredoc, both read differently', () => {
    expect(changedLines(`printf '%s' 'a:${B}${B}'`)).toEqual([{ meant: `a:${B}${B}`, got: `a:${B}` }]);
    expect(changedLines(`cat <<'EOF'\nx = '${B}${B}'\nEOF\n`)).toEqual([{ meant: `x = '${B}${B}'`, got: `x = '${B}'` }]);
  });

  it('stays silent where bash reads the halved command the same', () => {
    // In double quotes a pair reads as one backslash, and one before `.` stays: `\.` either way.
    expect(changedLines(`grep -n "${B}${B}." file`)).toEqual([]);
    expect(changedLines(`echo "X:${B}${B}${B}"Y"`)).toEqual([]);
    expect(changedLines(`echo 'a${B}b'`)).toEqual([]);
    expect(halvingNote(`grep -n "${B}${B}." file`, '2.1.308')).toBeUndefined();
  });

  it('names the version measured on and the one running', () => {
    const note = halvingNote(`printf '%s' 'a:${B}${B}'`, '2.1.999') ?? '';
    expect(note).toContain('measured on Claude Code 2.1.308');
    expect(note).toContain('this session runs 2.1.999');
    expect(note).toContain(`bash got:   a:${B}\n`);
  });
});
