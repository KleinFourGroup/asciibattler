# Ending a session

Read this when a session ends: at the hand-off trigger (a commit past 500k;
[planning.md](planning.md), "Context: the hand-off trigger"), at a stop
where the user wants the next stretch in a fresh session, or when the work
the user asked for is done. What a session writes at its end follows what
it leaves open, not its size.

## Every session

- Bring the HANDOFF Cursor's NEXT line up to date if the status changed,
  with every open ◐.
- **The session self-report.** At the end of a session (not of a phase:
  phases span sessions and sessions span phases), append a dated entry to
  [retro/sessions.md](../retro/sessions.md) answering the questions in its
  header. The header says which answers are complete ones; a brief report
  is one.
- **Session id.** Under the desktop app `$CLAUDE_CODE_SESSION_ID` holds
  it, the scratchpad directory's name, whose first 8 characters name a
  session in the docs; `npm run papercut` reads it itself.
  `$CLAUDE_SESSION_ID` is empty (seen 2026-10-25, Claude Code 2.1.308).
- Commit.
- In Claude Code, stop any preview server you started
  ([browser-pane.md](browser-pane.md)).

## A session that leaves something open

Something is open when a ◐ waits for its read, a stop waits for the user's
answer, or a step is half-built. Then the session also writes a hand-off
entry in the WORKLOG ("The hand-off after <step>"): what is done, what is
open (a call the user hasn't answered, a read pending, a step half-built
and where it stands), and the tools or files the next session needs that
no doc names. A session that leaves nothing open writes no hand-off entry:
the commit and the Cursor's NEXT line are its hand-off.

## The next session

When there is a next step, offer it as a card. The brief names the phase,
the step to start and the hand-off entry, and restates nothing that AGENTS,
the Cursor or the entry already holds, so it is about a line long. When a
stop waits on the user's answer, the brief says the new session puts the
stop again, since a session started from a card opens on its brief alone
and the answer can come only in its second turn.

- **Session cards** (Claude Code). Offer the next session with `start_session`,
  `initiation: "own_initiative"`, `context: "fresh"`, `use_worktree: false`
  (the work stays on `main` in this checkout) and no `permission_mode`,
  since a session in another mode holds messages for the user's approval.
  A `fresh` start needs a `background` of at least 80 characters; the card
  runs nothing until the user clicks it, and expires after a week
  (observed 2026-10-15 to 18, `archive/driver-trial/findings.md`).
