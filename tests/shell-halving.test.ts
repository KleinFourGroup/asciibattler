// The backslash guard's model (.claude/skills/context-meter/hooks/halving.ts)
// held to the cases measured on Claude Code 2.1.308 (archive/post-118-worklog.md §130, 130e)
// and again on 2.1.309 (WORKLOG.md §142, 142a): a run of backslashes halves,
// rounding up, unless a double quote follows it, and the guard refuses only
// where bash's reading changed.
import { describe, expect, it } from 'vitest';
import {
  MEASURE_LINE,
  changedLines,
  halve,
  halvingNote,
  halvingRefusal,
} from '../.claude/skills/context-meter/hooks/halving.ts';

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

  it('finds a single-quoted run and a quoted heredoc, both read differently', () => {
    expect(changedLines(`printf '%s' 'a:${B}${B}'`)).toEqual([{ meant: `a:${B}${B}`, got: `a:${B}` }]);
    expect(changedLines(`cat <<'EOF'\nx = '${B}${B}'\nEOF\n`)).toEqual([{ meant: `x = '${B}${B}'`, got: `x = '${B}'` }]);
  });

  it('finds nothing where bash reads the halved command the same', () => {
    // In double quotes a pair reads as one backslash, and one before `.` stays: `\.` either way.
    expect(changedLines(`grep -n "${B}${B}." file`)).toEqual([]);
    expect(changedLines(`echo "X:${B}${B}${B}"Y"`)).toEqual([]);
    expect(changedLines(`echo 'a${B}b'`)).toEqual([]);
  });
});

describe('the backslash guard', () => {
  it.each([
    ['a single-quoted pair', `printf '%s' 'a:${B}${B}' | od -c`],
    ['a run of three, which rounds up to two', `printf '%s' 'd:${B}${B}${B}'`],
    ['a quoted heredoc', `cat > f.txt <<'EOF'\nx = '${B}${B}'\nEOF`],
    ['a pair in a bare word', `echo a${B}${B}b`],
  ])('refuses %s', (_, cmd) => {
    expect(halvingRefusal(cmd, '2.1.309')).toMatch(/^Backslash guard: refused before it ran\./);
  });

  it.each([
    ['a run a double quote follows', `echo "X:${B}${B}${B}"Y"`],
    ['a pair in double quotes that reads the same', `grep -n "${B}${B}." file`],
    ['a single backslash', `echo 'a${B}b'`],
    ['no backslash at all', `git status --short`],
  ])('lets through %s', (_, cmd) => {
    expect(halvingRefusal(cmd, '2.1.309')).toBeUndefined();
  });

  it('names the line as written and as bash gets it, and what to send instead', () => {
    const text = halvingRefusal(`printf '%s' 'a:${B}${B}'`, '2.1.999') ?? '';
    expect(text).toContain('measured on Claude Code 2.1.309; this session runs 2.1.999');
    expect(text).toContain(`  as written: a:${B}${B}\n  bash gets:  a:${B}\n`);
    expect(text).toContain('Write tool');
    expect(text).toContain('PowerShell tool');
    expect(text).toContain('process/shell-and-windows.md');
  });

  it('lets a command that measures the halving run, and notes what bash got', () => {
    const cmd = `${MEASURE_LINE}\nprintf '%s' 'a:${B}${B}' | od -c`;
    expect(halvingRefusal(cmd, '2.1.309')).toBeUndefined();
    expect(halvingNote(cmd, '2.1.309')).toContain(`  as written: a:${B}${B}\n  bash got:   a:${B}\n`);
    // The line counts only as the command's first.
    expect(halvingRefusal(`printf '%s' 'a:${B}${B}'\n${MEASURE_LINE}`, '2.1.309')).toBeDefined();
  });
});
