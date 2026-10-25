<!-- AGENTS.md is the shared, harness-neutral instruction file. Claude Code
     loads CLAUDE.md, and the @-import below inlines AGENTS.md at session
     start (tests/docs.test.ts checks the import line). Only notes specific to
     Claude Code and the Claude desktop app belong below it. -->

@AGENTS.md

# Claude Code notes

Notes specific to Claude Code and the Claude desktop app. Everything else is
in AGENTS.md, which other harnesses read too.

- **What the user sees.** A note written between tool calls may reach the
  user as a one-line summary the app writes, not as your text, and you
  can't tell from inside which notes are summarized. The final message of a
  turn, after the last tool call, arrives as written. So anything the user
  has to read exactly (a caveat, a proposal, a table, the context for a
  question) goes in a turn's final message or in a file, and a proposal and
  the AskUserQuestion dialog about it go in separate turns. (Observed
  2026-09-23, Claude Code 2.1.280, claude-opus-5-5: the paragraph before a
  dialog arrived paraphrased; of eight notes in one later turn, two arrived
  paraphrased, and one of those dropped its caveat and misstated a result.)
- **The next-step box.** The app's wrap-up box shows a recap and at most
  one short question with buttons. The turn's closing message comes after
  the wrap-up call and arrives as written, and the call's result says
  whether the box shows the question (seen 2026-10-25, Claude Code
  2.1.308). When the user has to read something before answering (a cut,
  rows to sign, calls with their reasons), call wrap_up with the recap
  alone and put the proposal and its question in the closing message.
  Keep the box's question for a decision that stands on its own, such as
  a go-ahead to commit.
- **The silent-turn reminder.** The harness sometimes adds "The user hasn't
  heard from you in a while". It never obliges a finding: answer with what
  is true now ("still reading X, no result yet") and continue. In a long
  stretch it comes every few tool calls, and a status line beforehand does
  not head it off. (A reworded text set
  through `CLAUDE_CODE_SILENT_TURN_REMINDER_TEXT` never reached sessions
  under the app; that trial was retired 2026-09-26.)
- **Session id.** `$CLAUDE_SESSION_ID` is empty under the desktop app. For
  `npm run papercut -- --session=…`, use the first 8 characters of your
  scratchpad directory's name.
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
  2.1.308; WORKLOG §130, 130e). The context meter's mod adds a backslash
  note to a Bash result whose reading the halving changed, with what bash
  got; the command has run by then.
- **Bash calls.** A command whose first line reads stdin (a bare
  `cat > file`, an empty heredoc) waits out the tool's timeout, and
  nothing after it runs. A process spawn costs about 0.2 s in Git Bash
  here, so a loop over hundreds of files passes the 2-minute limit; one
  node script over `git ls-files` does it in about a second.
- **Subagents.** A subagent's transcript is under
  `~/.claude/projects/<repo slug>/`, in a `subagents/` folder, as
  `agent-<id>.jsonl`; the output file its launch result names is empty on
  this machine. An `isolation: "worktree"` agent is cut from
  `origin/main`, not HEAD, so push first or name the ref in its brief
  (seen 2026-10-12 to 15).
- **Session cards.** Offer the next session with `start_session`,
  `initiation: "own_initiative"`, `context: "fresh"`, `use_worktree: false`
  (the work stays on `main` in this checkout) and no `permission_mode`,
  since a session in another mode holds messages for the user's approval.
  A `fresh` start needs a `background` of at least 80 characters; the card
  runs nothing until the user clicks it, and expires after a week
  (observed 2026-10-15 to 18, `archive/driver-trial/findings.md`).
- **The Grep tool** can answer "No matches found" for a brace glob given
  together with a path, when files plainly match. Give a path and no brace
  glob, and don't read that answer as a negative.
- **The Browser pane** (the `preview_*` and browser tools) is Chromium; the
  user plays in Firefox. Start it with the `dev-preview` launch config
  ([.claude/launch.json](.claude/launch.json), port 5191): the user usually
  has their own dev server on 5173, and the preview tools won't attach to a
  server they didn't start. Screenshots smear 1–2 px detail, so sample
  pixels with `getImageData` or ask the user to look natively.
  `window.__game` is the top-level `Game` (`__game.world` is `"none"`);
  during a battle the live sim is `__game.activeScene.world`. For logic,
  a headless test is still the better instrument. Before any pane verify, read
  [process/browser-pane.md](process/browser-pane.md); a pane session starts
  with `await __probe.ready()`.
- **The preview hook** asks for a browser verify after every Write,
  including headless tests and scratch files. Follow it only when the change
  is observable in the pane.
- **Background work.** Give a long batch an explicit timeout, or verify it
  by its output file; a notification alone doesn't prove it finished. After
  `TaskStop`, confirm the npm → tsx → worker process tree is gone
  (`Get-CimInstance Win32_Process` for command lines, kill by PID) before
  launching a successor. Stop any preview server you started
  (`preview_stop`) before ending the session; Vite's child processes
  outlive a killed parent.
- **The context meter** is a mod in
  [.claude/skills/context-meter/](.claude/skills/context-meter/). The tool
  `mcp__context-meter__read` returns the session's context fill: the input
  tokens the last response was answered over, as the status line has them.
  The same reading is added to the result of every Bash or PowerShell
  command that runs `git commit`, as context for you and a transcript line
  for the user. The rule that uses it is in
  [process/planning.md](process/planning.md) ("Context: the hand-off
  trigger"); past it, a commit's reading says so. Under the app it can be listed only as a deferred
  tool: load it with ToolSearch (`select:mcp__context-meter__read`) before
  the first call, since deferred is not absent. If it is absent, ask the
  user for the reading. Editing the mod, or finding why it didn't load:
  its [README](.claude/skills/context-meter/README.md).
