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
- **The silent-turn reminder.** The harness sometimes adds "The user hasn't
  heard from you in a while". It never obliges a finding: answer with what
  is true now ("still reading X, no result yet") and continue. A one-line
  status before a long read-only sweep heads it off. A reworded version is
  on trial via `CLAUDE_CODE_SILENT_TURN_REMINDER_TEXT`; its status is a
  rider in the HANDOFF Cursor.
- **Session id.** `$CLAUDE_SESSION_ID` is empty under the desktop app. For
  `npm run papercut -- --session=…`, use the first 8 characters of your
  scratchpad directory's name.
- **Editing.** Batching several Edits to one file in a message is fine when
  the anchors are distinct; each Edit reports its own result, and the
  pre-commit hook catches anything that slips. The Bash tool runs Git Bash:
  multi-line commit messages take several `-m` flags or a file, and
  PowerShell's `@'…'@` here-strings belong to the PowerShell tool only.
- **The Browser pane** (the `preview_*` and browser tools) is Chromium; the
  user plays in Firefox. Start it with the `dev-preview` launch config
  ([.claude/launch.json](.claude/launch.json), port 5191): the user usually
  has their own dev server on 5173, and the preview tools won't attach to a
  server they didn't start. Screenshots smear 1–2 px detail, so sample
  pixels with `getImageData` or ask the user to look natively.
  `window.__game` is the top-level `Game` (`__game.world` is `"none"`);
  during a battle the live sim is `__game.activeScene.world`. For logic,
  a headless test is still the better instrument. Before any pane verify, read
  [process/browser-pane.md](process/browser-pane.md).
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
