// A `git commit` whose output goes into a pipe, and the refusal it earns.
//
// The pre-commit hook prints its failures in the commit's output, and a pipe
// after the commit keeps only what the filter lets through (`tail -4` kept the
// last test summary and lost the failing step) and reports the filter's exit
// code, not the commit's, so a `&&` after the pipe runs as if the commit
// landed (a push went up after the hook refused the commit). Seen four times
// before the guard: archive/worklog-phase-151.md, "§151 closed".
//
// The model is the stdin guard's parse (stdin.ts, `commandsIn`): a commit is
// refused when the command after it reads its output through a pipe. A pipe
// inside quotes, `$( )` or backticks is not looked at, and a commit inside a
// subshell or a group is caught only when it is the group's last command, so
// the guard errs toward letting a command run.

import { base, commandsIn, unwrap } from './stdin.ts';

export type Piped = { line: number; text: string; into: string };

// Git's global options that take their argument as the next word.
const TAKES_ARG = new Set(['-C', '-c', '--git-dir', '--work-tree', '--namespace', '--exec-path', '--config-env']);

/** The subcommand a git invocation runs (`commit` in `git -C dir commit`), or undefined. */
function gitSubcommand(words: string[]): string | undefined {
  const w = unwrap(words);
  if (base(w[0] ?? '') !== 'git') return undefined;
  let k = 1;
  while (k < w.length && (w[k] ?? '').startsWith('-')) k += TAKES_ARG.has(w[k] ?? '') ? 2 : 1;
  return w[k];
}

/** The first `git commit` whose output a pipe carries into another command, or undefined. */
export function pipedCommit(cmd: string): Piped | undefined {
  const cmds = commandsIn(cmd);
  for (let k = 0; k + 1 < cmds.length; k++) {
    const c = cmds[k]!;
    const next = cmds[k + 1]!;
    if (next.stdin !== 'pipe' || gitSubcommand(c.words) !== 'commit') continue;
    return {
      line: c.line,
      text: (cmd.slice(c.start, c.end).split('\n')[0] ?? '').trim(),
      into: base(unwrap(next.words)[0] ?? ''),
    };
  }
  return undefined;
}

const clip = (s: string): string => (s.length > 100 ? `${s.slice(0, 97)}...` : s);

/** The refusal's text: the line, why a pipe there hides a failure, and what to send instead. */
export function commitPipeRefusal(p: Piped): string {
  return [
    `Commit-pipe guard: refused before it ran. Line ${p.line}: ${clip(p.text)} (piped into ${p.into || 'a command'})`,
    "A pipe after `git commit` keeps only what the next command lets through, so a pre-commit hook's failing step can be cut from the output, and the pipeline reports that command's exit code, not the commit's, so a `&&` after it runs as if the commit landed.",
    'Log the commit to a file and read the file: `git commit … > log 2>&1; echo "exit $?"`, then `tail` or `grep` the log. (process/shell-and-windows.md, "A filtered result is not the result")',
  ].join('\n');
}
