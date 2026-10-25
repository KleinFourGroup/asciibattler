@AGENTS.md

# Claude Code notes

Notes specific to Claude Code and the Claude desktop app; everything else
is in AGENTS.md, which other harnesses read too.

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
- **The context meter**, a mod in
  [.claude/skills/context-meter/](.claude/skills/context-meter/), is silent
  below the hand-off trigger; past it, a commit that landed gets the
  reading and a line saying to hand off after it
  ([process/session-end.md](process/session-end.md)). Its tool and its
  upkeep: the [README](.claude/skills/context-meter/README.md).
