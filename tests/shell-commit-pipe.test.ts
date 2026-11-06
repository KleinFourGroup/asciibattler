// The commit-pipe guard's model (.claude/skills/context-meter/hooks/commitpipe.ts)
// held to the shapes that hid a pre-commit hook's failure (132d, 136f and
// 151c; archive/worklog-phase-151.md, "§151 closed"), and to the commits and
// pipes it must let through.
import { describe, expect, it } from 'vitest';
import { commitPipeRefusal, pipedCommit } from '../.claude/skills/context-meter/hooks/commitpipe.ts';

describe('the commit-pipe guard refuses a git commit whose output goes into a pipe', () => {
  it.each([
    ['the hook through tail (151c)', 'git commit -m "feat: x" 2>&1 | tail -4', 1, 'tail'],
    ['a pipe to tail chained to a push (136f)', 'git add -A && git commit -m "x" 2>&1 | tail -3 && git push', 1, 'tail'],
    ['a heredoc message, the pipe on its line', "git commit -F - <<'EOF' | tail -3\nfeat: x\n\nbody\nEOF", 1, 'tail'],
    ['a grep for the verdict', 'git commit -q -F msg.txt 2>&1 | grep -E "green|FAIL"', 1, 'grep'],
    ['git -C and -c before the subcommand', 'git -C /c/repo -c core.hooksPath=.githooks commit -m x | head -20', 1, 'head'],
    ['tee, which keeps the text but not the exit code', 'git commit -m x 2>&1 | tee log && git push', 1, 'tee'],
    ['pipe-and-stderr', 'git commit -m x |& tail -2', 1, 'tail'],
    ['under a wrapper', 'timeout 600 git commit -m x | tail', 1, 'tail'],
    ['the second line', 'cd /c/repo\ngit commit -m x | tail -5', 2, 'tail'],
    ['inside an if', 'if true; then git commit -m x | tail; fi', 1, 'tail'],
    ['a subshell ending in the commit', '( cd /c/repo && git commit -m x ) | tail -3', 1, 'tail'],
  ])('%s', (_, cmd, line, into) => {
    expect(pipedCommit(cmd)).toMatchObject({ line, into });
  });

  it('names the line, what it was piped into, what to send instead and the doc', () => {
    const text = commitPipeRefusal(pipedCommit('git commit -m x 2>&1 | tail -4')!);
    expect(text).toContain('Line 1: git commit -m x 2>&1 (piped into tail)');
    expect(text).toContain('> log 2>&1; echo "exit $?"');
    expect(text).toContain('process/shell-and-windows.md');
  });
});

describe('the commit-pipe guard lets through a commit whose output is not piped, and other pipes', () => {
  it.each([
    ['the commit logged to a file, then read', "git commit -F - > log 2>&1 <<'EOF'\nfeat: x\nEOF\necho \"exit $?\"; tail -3 log"],
    ['a pipe inside the message', 'git commit -m "a | b"'],
    ['a pipe after a later command', 'git commit -m x && git log --oneline -1 | head -1'],
    ['an or-list, not a pipe', 'git commit -m x || echo failed'],
    ['git log through head', 'git log --oneline | head -5'],
    ['commit-tree, another subcommand', 'git commit-tree HEAD^{tree} -m x | cat'],
    ['a commit named in an echo', 'echo "git commit -m x | tail"'],
    ['a comment', '# git commit -m x | tail\ngit status'],
    ['a commit inside $( )', 'echo "$(git commit -m x | tail -1)"'],
    ['a group with a later command', '( git commit -m x; echo done ) | tail -3'],
    ['git status', 'git status --short'],
  ])('%s', (_, cmd) => {
    expect(pipedCommit(cmd)).toBeUndefined();
  });
});
