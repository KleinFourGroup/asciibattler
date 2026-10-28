# Shell, git and Windows

Read this before a shell command that carries quotes, backslashes or a
heredoc, before reading a count through a pipe, before starting or
stopping a Node, Vite or background process, and before launching a
subagent. The repo lives on Windows; the shells are Git Bash and
PowerShell. The first section holds in any harness; the second is about
Claude Code's own tools.

## Any harness

- **Shell quoting, as facts.** A stray quote ends a command and nothing
  runs: retry. A backslash dropped in transit (below) leaves a regex
  that still runs, so when code with an escape went through the shell,
  read back what landed. Your file-writing tool avoids both, and long quoted heredocs have
  been refused here. A multi-hunk patch is a small script that checks every
  anchor in every file before it writes any. A commit message with a quote goes through
  `git commit -F <file>`.
- Commit with `git commit -q` and read the hash with
  `git log --format=%h -1`; this repo's long subjects otherwise echo back
  twice.
- A filtered result is not the result. npm notices fill a piped tail, some
  CLIs colour their output even when piped (so an anchored grep reads 0),
  and a pipeline reports the exit code of its last command. Read the raw
  tail before trusting a zero; for a one-number probe, a deliberately
  failing `expect()` prints on the first try.
- Put scratch probes in real `.ts` files (`.mts` outside the repo, where
  `tsx` reads `.ts` as CommonJS); an inline `npx tsx -e` can hang at
  spawn on Windows with no output. Throwaways go in your scratch directory:
  files under `tests/fuzz/output/` are typechecked by the pre-commit hook.
- If `:5173` is taken, Vite silently falls back to `:5174`. Vite's child
  Node processes survive `taskkill` on the parent; check with
  `Get-NetTCPConnection -LocalPort 5173`.

## Claude Code's tools

- **Editing.** Batching several Edits to one file in a message is fine when
  the anchors are distinct; each Edit reports its own result, and the
  pre-commit hook catches anything that slips. Anchor each Edit on whole
  lines, copied from the file: an anchor that crosses a line break as
  retyped misses, and one that ends mid-line can glue the line's rest on
  while reporting success. Keep a commit out of any message that holds
  Edits, since a commit beside a missed Edit runs anyway. The Bash tool
  runs Git Bash: multi-line commit messages take several `-m` flags or a
  file, and PowerShell's `@'…'@` here-strings belong to the PowerShell
  tool only. The Bash tool halves a run of backslashes, rounding up,
  unless a double quote follows it, inside single quotes and a quoted
  heredoc too, while the transcript shows the command as written; the
  PowerShell tool passes them whole (measured 2026-10-23, Claude Code
  2.1.308; `../archive/post-118-worklog.md` §130, 130e). The context meter's mod adds a backslash
  note to a Bash result whose reading the halving changed, with what bash
  got; the command has run by then.
- **Bash calls.** The Bash tool runs most commands with stdin on
  `/dev/null`, where a bare `cat > file` writes an empty file and moves
  on. A command holding a heredoc, and some others, reaches the shell
  through a pipe the tool never closes: a step there that reads stdin
  swallows the rest of the script and waits for good, past `timeout`, and
  the tool's limit only moves it to the background, so `TaskStop` it.
  `python` and `python3` wait on an empty script (`-` with nothing fed,
  or an empty heredoc) wherever stdin points; a heredoc with a body runs
  (measured 2026-10-28, Claude Code 2.1.309;
  `../archive/worklog-phase-137.md`, "The stdin hangs, traced"). The
  context meter's mod refuses such a command before it runs, naming the
  line. A process spawn costs about 0.2 s in Git Bash
  here, so a loop over hundreds of files passes the 2-minute limit; one
  node script over `git ls-files` does it in about a second.
- **Subagents.** A subagent's transcript is under
  `~/.claude/projects/<repo slug>/`, in a `subagents/` folder, as
  `agent-<id>.jsonl`; the output file its launch result names is empty on
  this machine. An `isolation: "worktree"` agent is cut from
  `origin/main`, not HEAD, so push first or name the ref in its brief
  (seen 2026-10-12 to 15).
- **Background work.** After `TaskStop`, confirm the npm → tsx → worker
  process tree is gone (`Get-CimInstance Win32_Process` for command lines,
  kill by PID) before launching a successor. A long batch's timeout and its
  output check are in [measurement.md](measurement.md), "Watching a
  batch".
