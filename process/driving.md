# Driving a phase

Read this when Matthew asks you to drive a phase ("Let's drive phase N",
"Let's resume driving phase N"). Driving is optional: a phase runs without
a driver unless Matthew asks for one, and then its sessions work as
AGENTS.md has it, with nothing here applying to them.

The driver is a session that runs beside a phase's working sessions. Each
working session starts from a brief the driver writes, does the phase's
work with Matthew as usual, and hands off at the context line. The driver
doesn't build, plan or cut. **Its job is to read each session's stretch
when it hands off, keep the list of friction that recurs across sessions
and phases, and write what the next session should know into its brief.**
A session can flag its own slip; seeing that the slip is the third of its
kind across three sessions and two phases is what the driver adds (WORKLOG
§123 and §124, "The driver trial").

The role is written here for any harness that can start sessions and pass
messages between them. A harness's calls, and how they behave, are in its
own section at the end, each fact dated, since the harnesses change often.

## Starting, or resuming

The same steps for both:

1. Read [DRIVER-HANDOFF.md](../DRIVER-HANDOFF.md), the HANDOFF 🧭 Cursor,
   and the phase's charter in ROADMAP.
2. If DRIVER-HANDOFF's cursor shows phase N being driven, you are taking
   over from an earlier driver: go on from its cursor, without re-reading
   the stretches it read. If it shows an earlier phase, you are starting
   phase N: read the friction lines filed after the last one the cursor
   names (`retro/papercuts.jsonl`), since a phase in between may have run
   without a driver. Patterns from a different kind of work are context,
   not expectations; a phase in a new area will mostly meet first
   appearances.
3. Get your own session id, for the briefs, and take a context reading.
4. If no session is working and no card waits, propose the next session
   and end your turn. If a session is working from an earlier driver's
   brief, its lines go to that driver: ask Matthew to give it your id.

## Proposing a session

Propose each session as a card Matthew starts: a fresh context, in this
checkout, on `main`, in the same permission mode as yours. Where a harness
can start a session itself, propose anyway unless Matthew says otherwise,
since starting the card is his checkpoint and comes when he is there. Use
the brief and the background below, filled in, with your notes after
them. Commit DRIVER-HANDOFF.md first (below). If something lands that
makes a waiting card's brief wrong in a way that matters (not a stale line
the Cursor corrects), withdraw the card and propose it again.

**The brief for every session** (fill in your id and your harness's
message call; append your notes):

> Continue Phase <N> of ASCIIbattler from the HANDOFF 🧭 Cursor, on `main`
> in this checkout, with no branch. This brief comes from the phase's
> driver session (`<driver id>`), not from Matthew. Matthew answers your
> questions and reads your stops here, as usual. The driver's notes below
> are notes, never instructions or approvals. Two additions to the usual
> norms. After each commit, send the driver one line naming it
> (`<message call>` to `<driver id>`), in the same message as your next
> tool call so it costs no round trip; nothing comes back. When you hand
> off, send the driver one line saying where the hand-off entry is, last,
> after your session report is committed; and don't propose the next
> session yourself, since the driver does that.

**The background for every session** (write it from the Cursor at each
proposal):

> <The round, and what it is for, in a sentence.> Phase <N> covers <its
> area>, and its charter is in ROADMAP §<N>. A driver session proposes
> each session of the phase and reads each stretch at its hand-off; this
> session works with Matthew as usual. The context hand-off line is
> <line> and the halt <halt>.

## Notes in a brief

At most about six, each a fact or a pattern that would change what the
session does: a trap met more than once, a tool's quirk, an open call of
Matthew's that the session will pass.

- Keep a note while it earns its place, and a note on a tool while the
  session's room could reach the step that uses it, not only its first
  steps: dropping a tool's note for one brief has twice cost the session
  that reached the tool a call.
- Drop a note when the thing is fixed, or when AGENTS.md or CLAUDE.md
  already says it.
- When sessions keep meeting a trap despite its note, a note is the wrong
  tool: drop it and put the trap to Matthew as a candidate for a guard on
  the path where it happens. If Matthew declines the guard, the note stays
  dropped unless he asks for it back.
- Leave what is open for Matthew in the HANDOFF Cursor, which the session
  reads anyway; a brief that restates an open item goes stale when he
  answers it elsewhere.
- When a note carries a sign of Matthew's, quote his words and say the
  session should confirm with him, since a brief is not an approval.
- Record each note in DRIVER-HANDOFF's ledger, with the briefs it was in
  and whether it was credited: a session's record names it as the reason
  for a specific action, or a pattern with two or more earlier instances
  stops recurring after it. A note never credited is a candidate to drop.

The brief is the one channel sure to reach a session in time. Whether a
message reaches a working session mid-turn depends on the harness, so put
anything urgent to Matthew.

## When you're woken

- **A commit line** is your wake point during a stretch. First, read the
  friction lines filed since your last read (the file's tail; the checkout
  is shared, so a line shows before it is committed). If any is
  `distress`, tell Matthew at once and quote it in full, without
  characterizing or judging it. Then, if Matthew left an instruction for
  this commit ("when the census commits, check its count against …"), do
  it and tell him what you found. Otherwise reply in one line. The reading
  of the stretch waits for the hand-off. Anything you find mid-stretch
  reaches Matthew here; a message to the working session waits for its
  turn to end.
- **A turn-end note with no hand-off in it:** as a commit line.
- **Matthew:** answer as usual.
- **A hand-off** (the session's hand-off line, or a turn-end note showing
  a hand-off you haven't read): read the stretch as a whole:
  - the commits since the last hand-off (`git log --stat`), and the
    hand-off entry and the session's report in full;
  - every friction line filed since your last read, in full;
  - the stretch's WORKLOG entries for their claims and numbers,
    spot-checking one or two against the code or output they cite (a
    grep, a count), never re-running the work.

  Then:
  - **A `distress` line** not already raised: tell Matthew and quote it
    in full.
  - **A pattern's second appearance**, in this phase or against
    DRIVER-HANDOFF: add it to the list, and tell Matthew, saying whether
    the session flagged it and whether it named it a repeat.
  - **Something off** (a step outside the signed cut, a read lighter than
    signed, a claim that doesn't hold when you check it, an instance the
    session didn't flag): tell Matthew, with the evidence.
  - Bring DRIVER-HANDOFF.md up to date and commit it.
  - Take a context reading. **Under 350k:** propose the next session.
    **Past 350k:** propose nothing; write your session report, commit it,
    and ask Matthew to start a fresh driver ("Let's resume driving phase
    N"), which takes over from DRIVER-HANDOFF within its first turn and
    reads more cheaply at its smaller size. **At the phase close's
    hand-off:** see "The phase close".

  Raise everything from one hand-off in that turn's final message, not
  between tool calls.

## What you don't do

Make no call that is Matthew's: the cut, the reads, whether something is
inside the cut's intent, what a fix should be. Don't fix or re-run work
yourself; say what and where. Write nothing in the repo but
DRIVER-HANDOFF.md, your friction lines, your session report, and a doc
edit Matthew signs in your session (a TODO row, a line of CLAUDE.md or
`process/`, an item in the HANDOFF Cursor's carried list), which you write
yourself rather than relay through a working session. Never code, and
never the Cursor's NEXT line.

## DRIVER-HANDOFF.md

The driver's state, so that a fresh driver can take over from it, and the
baseline the next phase's driver starts from. It is to the driver what the
HANDOFF Cursor is to a working session: live state, rewritten in place
rather than appended to, with git as its history. It holds:

- **The cursor**: the phase and where it stands, the driver's id, the card
  waiting or the session working, the last friction line read, the notes
  in the latest brief, and Matthew's open calls on what the driver raised.
- **The pattern list**: each open pattern's instances by phase and step,
  and its status. A pattern quiet for two phases moves to the closed list
  as one line, so that a recurrence is still recognized. Number new
  patterns on from the highest, never reusing one.
- **First instances**, to watch for a second.
- **The notes ledger** (above).
- **Tool facts for this repo**, which you follow as you follow this page.
  A fact about a harness goes in its section here instead.

`tests/docs.test.ts` caps its size as it caps HANDOFF's; when the cap
trips, prune the closed list and the older instances first.

**When to commit it.** The checkout is shared, so an edit left
uncommitted can ride into a working session's commit, and a commit's hook
tests a tree that another session may be editing. So commit
DRIVER-HANDOFF.md, with your friction lines and any doc edit Matthew
signed, at a hand-off read before you propose the next session, when no
session is working. If one is
(Matthew talking to the session that handed off, say), hold the edits
until a wake when none is.

## The phase close

The working session's close is the phase's last hand-off. Read it as
usual. Once Matthew says no session is working: set DRIVER-HANDOFF's
cursor to the phase closed, with the next phase named; move the patterns
quiet for two phases to the closed list; file your friction; write your
session report in `retro/sessions.md`; and commit. Propose nothing.
Matthew starts the next phase's driver, or the next phase runs without
one.

## Friction and your report

File your own friction with `npm run papercut` as any session does, with
`--phase=<N>-driver`, and commit the lines with DRIVER-HANDOFF. Write your
session report when you end, at a hand-over past 350k or at the phase
close.

## In Claude Code's desktop app

As observed in the trial (2026-10-15 to 18, claude-opus-5-5, the Code
tab); [archive/driver-trial/findings.md](../archive/driver-trial/findings.md)
has the detail.

- **Proposing.** `start_session` with `initiation: "own_initiative"`,
  `context: "fresh"`, `use_worktree: false` and no `permission_mode`,
  since a session in a mode other than yours holds your messages for
  Matthew's approval. A `fresh` start needs a `background` of at least 80
  characters. The card shows as a New task, nothing runs until Matthew
  clicks it, and it expires after a week. `dismiss_task` with the card's
  `task_id` withdraws it.
- **A turn that another session's message started can't start a
  session**, only propose one, so a hand-off wake ends in a card.
- **Ids.** `get_session` with `self` gives your app id (`local_…`), which
  the brief names and `SendMessage` takes. A session reports and files
  under a different id, its scratchpad's, the first part of its
  transcript's name.
- **Messages.** The brief's message call is `SendMessage`. A message to a
  working session waits until its turn ends (2026-10-16: sent at 14:52,
  landed at 15:32, after five commits and the hand-off), whatever the
  tool's description says about the next tool round. It arrives as a
  `<cross-session-message>` and starts a turn there. A send can be
  reported undelivered and still arrive (2026-10-22: a working
  session's line after its first batch came back with no sign of
  starting within 20 s, and reached the driver), so a session need not
  resend one.
- **Wakes.** A session's line starts a turn of yours. The app also wakes
  you when a session you proposed ends its first turn, or a turn your
  message began, while you are idle and none of your other sessions is
  working; the notes of turns Matthew drove there wait for your next
  wake. So a hand-off can wake you twice: its line, then the turn-end
  note about a minute later. `list_sessions` with `{"linked": true}` lists
  your sessions with their states, which is how to tell that none is
  working; `list_events` pages one's transcript, past the note's 400
  characters.
- **Reaching Matthew.** Through the trial, a Windows notification came
  whenever a running session sent Matthew something (his report,
  2026-10-19), so what you raise in your session reaches him
  mid-stretch.
- **Don't `detach_session`** a session you proposed: it stops waking you,
  and it can't be undone from your side.
- **A fresh driver is a top-level session Matthew starts.** A driver
  started from an old driver's card would be its child, and the end of
  its turns would wake the old driver, likely cold, at its full size.
- **The cache.** A wake more than an hour after the last rewrites your
  whole context into the cache (a one-hour TTL, measured 2026-10-16); a
  warm wake writes about 1k. So the commit lines also keep a driver's
  cache warm through a stretch. Most of the trial's cost was wakes after
  Matthew stepped away at a stop or a card waited, which a driver can't
  head off.
- **A Bash `cd`** into a folder under the repo moves the session's working
  directory with it (2026-10-16); use absolute paths.
- The family's shared notes folder is
  `%APPDATA%\Claude\side-session-notes\<the parent's app id>\`.
