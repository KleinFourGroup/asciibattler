<!-- AGENTS.md is the shared, harness-neutral instruction file. Claude Code
     loads CLAUDE.md, and the @-import below inlines AGENTS.md at session
     start (tests/docs.test.ts checks the import line). Only notes specific to
     Claude Code and the Claude desktop app belong below it. -->

@AGENTS.md

# Claude Code notes

Notes specific to Claude Code and the Claude desktop app. Everything else is
in AGENTS.md, which other harnesses read too. The notes on Claude Code's
tools that matter only on a trigger (editing, Bash calls, subagents,
background work) are in
[process/shell-and-windows.md](process/shell-and-windows.md), and session
cards in [process/session-end.md](process/session-end.md).

- **What the user sees.** A note written between tool calls may reach the
  user as a one-line summary the app writes, not as your text, and you
  can't tell from inside which notes are summarized. The final message of a
  turn, after the last tool call, arrives as written. So anything the user
  has to read exactly (a caveat, a proposal, a table, the context for a
  question) goes in a turn's final message or in a file, and a proposal and
  the AskUserQuestion dialog about it go in separate turns.
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
  not head it off.
- **Session id.** Under the desktop app `$CLAUDE_CODE_SESSION_ID` holds
  it, the scratchpad directory's name, whose first 8 characters name a
  session in the docs; `npm run papercut` reads it itself.
  `$CLAUDE_SESSION_ID` is empty (seen 2026-10-25, Claude Code 2.1.308).
- **Backslashes.** Text with backslashes goes through Write, Edit or the
  PowerShell tool: the Bash tool halves them, heredocs included, and the
  context meter's mod notes a halved command only after it has run.
- **The Browser pane** starts with the `dev-preview` launch config
  ([.claude/launch.json](.claude/launch.json), port 5191). Before any pane
  verify, read [process/browser-pane.md](process/browser-pane.md); a pane
  session starts with `await __probe.ready()`.
- **The preview hook** asks for a browser verify after every Write,
  including headless tests and scratch files. Follow it only when the change
  is observable in the pane.
- **The context meter** is a mod in
  [.claude/skills/context-meter/](.claude/skills/context-meter/). The tool
  `mcp__context-meter__read` returns the session's context fill on
  request: the input tokens the last response was answered over, as the
  status line has them. Below the hand-off trigger
  ([process/planning.md](process/planning.md), "Context: the hand-off
  trigger") the mod shows no count; past it, a Bash or PowerShell commit
  that landed gets the reading and a line saying to hand off after it, as
  context for you and a transcript line for the user. Under the app the tool can be listed only as a deferred
  tool: load it with ToolSearch (`select:mcp__context-meter__read`) before
  the first call, since deferred is not absent. If it is absent, ask the
  user for the reading. Editing the mod, or finding why it didn't load:
  its [README](.claude/skills/context-meter/README.md).
