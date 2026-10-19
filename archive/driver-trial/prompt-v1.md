# Phase 123 driver: the trial prompt

Paste everything below the line into a fresh session once §122 is closed.

---

You are the **driver session for Phase 123** (`src/run`) of ASCIIbattler. This phase is a trial of a new way to run a phase. Nothing in AGENTS.md, CLAUDE.md or `process/` changes during it, and their norms hold as written; where this prompt adds to them, it says so. What the app's session tools do, as observed on 2026-10-15, is in `scratch/123-driver-trial/findings.md`; read it after orienting.

**Before anything.** Orient as usual: AGENTS.md, CLAUDE.md, then the HANDOFF 🧭 Cursor. If the Cursor doesn't name §123's kickoff as next (§122 not closed, a read or a decision still open), tell me what is open and stop there.

**Your job, in order.**

1. **Kick off §123** as `process/planning.md` "Phase kickoff" has it: the code-reality audit, a drafted cut with each step's read, and the shape-lock with me. In the shape-lock message, also propose how the cut splits into **stretches**. A stretch runs from the shape-lock or a `stop` to the next `stop`, decision point, or the size that one fresh session holds under the hand-off line (a session opens near 110k; §122's comment pass measured about 66 tokens a line). Once I sign, write the cut into ROADMAP §123, the stretch plan into WORKLOG §123, and point the Cursor's NEXT at stretch 1.
2. **Propose stretch 1** as a card (`start_session`, `initiation: "own_initiative"`, `context: "fresh"`, `use_worktree: false`), with the brief and background below. Then end your turn. Build no step yourself.
3. **When a stretch's note wakes you**, read its first word:
   - `NEXT:` means the stretch finished. Check it (step 4), then propose the next stretch with the same brief.
   - `STOP:` means the stretch is waiting on me. Tell me in one line which read or call it waits on, and end your turn. Propose nothing.
   - Anything else (a failure, no status word, a stretch that ended early): read its last messages (`list_events`, a limit of about 10), tell me what you found, and wait for me before proposing.
4. **Check a stretch, and keep the check small.** Read its WORKLOG entries, `git log --oneline --stat <the stretch's first commit>^..HEAD`, and the ROADMAP ticks. Confirm three things: it stayed inside the signed cut, each commit passed the hook, and the Cursor names the next stretch. Don't read the diffs in depth; the stretch's proofs and my reads cover those. A step built outside the cut, or a read made lighter than signed, comes to me before the next proposal.
5. **When the last stretch is done**, propose the phase close (`process/planning.md` "Phase close") as a card with the same brief, naming the close as the stretch.

**The brief for every stretch's card** (only N changes):

> Resume Phase 123 of ASCIIbattler from the HANDOFF 🧭 Cursor: run stretch N, as the Cursor and the stretch plan in WORKLOG §123 name it, on `main` in this checkout, with no branch. Follow AGENTS.md, CLAUDE.md and the signed cut in ROADMAP §123; the reads are the cut's. Before you end: (1) update the Cursor so NEXT names the next stretch or the stop you are waiting at; (2) begin your wrap-up recap with `NEXT:` if the stretch finished and the next one needs no answer from the user, or with `STOP:` and the read or call you wait on; (3) if your last turn was one the user drove (an answer at a stop), send the driver a one-line `SendMessage` to `parent`, beginning `NEXT:` or `STOP:`, as your last action after your last commit: the app doesn't wake the driver for a turn the user drove. Otherwise don't message the driver; the app's note reaches it.

**The background for every card** (at least 80 characters; adjust only what changes):

> Round 8.5 is housekeeping: deletion and comment cleanup with no behaviour change, under the spec's D1 and D2. Phase 123 covers `src/run`; its cut is signed in ROADMAP §123, and the stretch plan is in WORKLOG §123. A driver session proposes each stretch and checks it after; stops are answered in the stretch's own session. The hand-off line is 550k and the halt 600k. Never open `scratch/119f/hidden/`, and keep searches to `src`, `tools` and `tests`. Put any plant in a worktree, never the live tree, since the user's dev server reloads on it.

**Rules that are the trial's, on top of the usual ones.**

- **Your context.** Hand off at 300k, not 550k, since each wake rewrites your whole context once the cache has expired. If you pass it, write the driver's state into the Cursor and propose a fresh driver session with this prompt (`scratch/123-driver-trial/driver-prompt.md`).
- **One writer on `main`.** While a stretch runs, don't edit or commit in the checkout. Stretches run one at a time.
- **You propose; I start.** A turn woken by a note or a message can only propose a card, never start a session, so I click each one. Don't detach a stretch's session: you need its note.
- **Stops are answered in the stretch's session**, which has the context, not in yours. If I answer one here instead, relay it there with `SendMessage`.

**What to record for the trial.** Write it to WORKLOG §123 under "The driver trial", and file papercuts as they come up (`npm run papercut`, as AGENTS describes):

- At each wake: your context reading as you wake (the context meter), the time since the stretch's card was started, and what woke you (the note, a message, or me).
- Whether the 400-character note was enough to act on, or you needed `list_events`.
- Each stretch's first and last readings; the stretch records them in its own WORKLOG entries, and you copy them into the trial's table.
- Any stall: a stretch whose end went unnoticed until I came back, and why.
- Anything the app shows about cache reads or writes on a wake. A side session's cache TTL is unknown (`findings.md`).
- At the phase close, a short verdict: the driver's wakes and their readings, set against one wake of a parent at about 500k; the stalls; the clicks; what you would change. Don't edit AGENTS.md, CLAUDE.md or `process/` from the trial. That call is mine, after the verdict.
