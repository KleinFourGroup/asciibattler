// The hand-off line on a commit, and which commits earn it.
//
// The trigger (process/planning.md, "Context: the hand-off trigger") is read
// at a commit: past it, a commit that landed tells the session to hand off
// after it. Below it the mod says nothing, since a count shown there informs
// no decision and only presses on the session. A commit the pre-commit hook
// refused leaves HEAD where it was, so it earns no line.

export const HAND_OFF_AT = 500_000

// One `git` option's argument: quoted, or a bare word.
const ARG = String.raw`(?:"[^"]*"|'[^']*'|\S+)`

// `git commit`, with any `-C <dir>` or `-c <key=value>` before it; not
// `git commit-tree`.
const GIT_COMMIT = new RegExp(String.raw`\bgit((?:\s+-[Cc]\s+${ARG})*)\s+commit(?![-\w])`)
const DIR = new RegExp(String.raw`-C\s+(${ARG})`, 'g')

/**
 * The commit a command runs, with the folder its last `-C` names (git reads
 * each `-C` against the one before; the last is enough for the commands run
 * here), or undefined when it runs none.
 */
export function commitIn(command: string): { dir?: string } | undefined {
  const m = GIT_COMMIT.exec(command)
  if (m === null) {
    return undefined
  }

  // Both groups always take part in a match; `?? ''` only satisfies the type.
  const dirs = [...(m[1] ?? '').matchAll(DIR)].map(d => (d[1] ?? '').replace(/^(["'])(.*)\1$/, '$2'))
  return dirs.length === 0 ? {} : { dir: dirs[dirs.length - 1] }
}

/** Past the trigger: a reading over 500k. No reading yet is not past it. */
export const pastTrigger = (tokens: number | undefined): boolean =>
  tokens !== undefined && tokens > HAND_OFF_AT

/**
 * A commit landed when HEAD moved. A HEAD git couldn't read counts as landed,
 * so the line errs toward showing.
 */
export const landed = (before: string | undefined, after: string | undefined): boolean =>
  before === undefined || after === undefined || before !== after
