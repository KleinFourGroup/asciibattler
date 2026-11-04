// The backticks guard's model (.claude/skills/context-meter/hooks/backticks.ts)
// held to the shapes that lost text to a command substitution in Round 10
// (144c, 145g and 146g; archive/worklog-phase-147.md, 147d), and to the
// places a backtick is only a character, which it must let through.
import { describe, expect, it } from 'vitest';
import {
  backtickBashRuns,
  backticksRefusal,
  substitutedBacktick,
} from '../.claude/skills/context-meter/hooks/backticks.ts';

describe('the backticks guard refuses a backtick bash would run as a command substitution', () => {
  it.each([
    ['a markdown code span in a double-quoted node -e (146g)', 'node -e "fs.writeFileSync(f, s.replace(a, \'the `board.test.ts` line\'))"', 1],
    ['a JS template literal in a double-quoted node -e (144c)', 'node -e "const x = `a${b}`; console.log(x)"', 1],
    ['a code span appended to a file from node -e (145g)', 'cd /c/repo && node -e "fs.appendFileSync(\'retro/sessions.md\', \'the `npm test` run\')"', 1],
    ['a commit message in double quotes', 'git commit -m "docs: the `foo` row"', 1],
    ['an unquoted heredoc body', "cat > f.md <<EOF\nthe `x` line\nEOF", 2],
    ['a bare substitution', 'echo `date`', 1],
    ['a single quote inside double quotes, which quotes nothing', 'echo "it\'s `x`"', 1],
    ['an apostrophe closing a single-quoted node -e (142b)', 'node -e \'const a = "142b\'s row (`stop`)"\'', 1],
    ['the second line', 'cd /c/repo\nnode -e "console.log(`a`)"', 2],
  ])('%s', (_, cmd, line) => {
    expect(substitutedBacktick(cmd)).toMatchObject({ line });
  });

  it('reads the command as bash gets it after the halving (144c)', () => {
    // Written as three backslashes and a backtick in double quotes, which bash
    // reads as a backslash and a literal backtick; halved to two, it reads a
    // backslash and a bare one.
    const cmd = 'node -e "const a = \\\\\\`x\\\\\\`; console.log(a)"';
    expect(substitutedBacktick(cmd)).toBeUndefined();
    expect(backtickBashRuns(cmd)).toMatchObject({ line: 1, halved: true });
    expect(backticksRefusal(backtickBashRuns(cmd)!)).toContain('after the Bash tool halves its backslashes');
  });

  it('names the line, what to send instead and the doc', () => {
    const text = backticksRefusal(substitutedBacktick('git commit -m "the `x` row"')!);
    expect(text).toContain('Line 1: git commit -m "the `x` row"');
    expect(text).toContain('Write or Edit tool');
    expect(text).toContain('$( )');
    expect(text).toContain('process/shell-and-windows.md');
  });
});

describe('the backticks guard lets through a backtick that is only a character', () => {
  it.each([
    ['single quotes', "node -e 'const x = `a${b}`; console.log(x)'"],
    ['a quoted heredoc', "cat > f.md <<'EOF'\nthe `x` line\nEOF"],
    ['a double-quoted heredoc delimiter', 'cat > f.md <<"EOF"\nthe `x` line\nEOF'],
    ['a tab-stripped quoted heredoc', "cat > f.md <<-'EOF'\n\tthe `x` line\n\tEOF"],
    ['a substitution written as $( )', 'echo "today $(date)"'],
    ['an escaped backtick in double quotes', 'echo "a \\` b"'],
    ['an escaped backtick in a bare word', 'echo a\\`b'],
    ['ANSI-C quoting', "echo $'a`b'"],
    ['a comment', '# the `x` note\necho ok'],
    ['a here-string in single quotes', "cat <<< 'the `x` line'"],
    ['no backtick at all', 'git status --short'],
  ])('%s', (_, cmd) => {
    expect(substitutedBacktick(cmd)).toBeUndefined();
  });

  it('passes one escaped backtick, which the halving leaves whole', () => {
    expect(backtickBashRuns('echo "a \\` b"')).toBeUndefined();
  });

  it('reads past a quoted heredoc to a substitution after it', () => {
    expect(substitutedBacktick("cat > f.md <<'EOF'\nthe `x` line\nEOF\necho `date`")).toMatchObject({ line: 4 });
  });
});
