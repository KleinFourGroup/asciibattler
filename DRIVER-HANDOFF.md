# DRIVER-HANDOFF

The phase driver's live state ([process/driving.md](process/driving.md)
says what a driver is and does). A driver rewrites this at each hand-off
read and commits it when no session is working; it is not appended to, and
git is its history. Started 2026-10-19 from the close state of §124's
driver log ([archive/driver-trial/log-124.md](archive/driver-trial/log-124.md)).

## Cursor

- **Phase:** **§124.5, the screens** (ROADMAP §124.5), driven from
  2026-10-19. Six sessions so far, each from a driver's brief: 8fb7e4a9
  (the kickoff, 124.5a–f), ff99ffb0 (124.5g, R-1 to R-3, 124.5h's plan,
  batches 1–2), ebe41cd8 (3–4), bcd08e32 (5–6), d8214ecc (7), 138dbbac
  (8–9, hand-off `6668a4d7`, WORKLOG §124.5 "The hand-off after 124.5h's
  batch 9"; read 2026-10-20 00:55 UTC). **Next: session 7, from batch
  10** (`ui.css`'s first third with `fonts.css`). No card waits: driver 1
  handed over at the 350k line, so the next driver proposes it. Open for
  Matthew: batches 8 and 9's `batch` reads (he has them ready for session
  7). Batch 8's finding went to TODO (`317ea902`).
- **Driver:** none working. Driver 1 was
  `local_3addf3c2-a6af-469e-a40b-932696f5bc61` (scratchpad 9b60fb27).
  A new driver writes its app id here.
- **Friction read through:** line 299 of `retro/papercuts.jsonl` (lines
  298–299 are driver 1's own).
- **Notes for session 7's brief** (driver 1's recommendation; the next
  driver decides):
  - the comment tools run as `npm run oracle -- comment-strip HEAD src`,
    `... -- comment-codes --record`, `... -- comment-length <folder>`;
    `--record` before each batch's suite run (P1); `comment-length` on
    copies under `output/`, one folder a call (P11); a file whose held
    (`TOOL_READ`) comment changed is unproven by `comment-strip`'s exit 1,
    so `scratch/1245h-b3/held-compare.mts` is its proof (P13); a
    step-code-shaped file name in a comment reads as a code;
  - entries by the Write or Edit tool, each commit message to a file by
    the Write tool for `git commit -F`; no Bash call opens with a line
    that reads stdin (P2);
  - Edits anchored on whole lines, read back, and no commit in the same
    message (P14);
  - a claim checked by search searches the rule's other shapes, every
    caller, and every tracked folder (`src`, `tools`, `tests`, `scripts`,
    `config`, `locales`, the docs), never `scratch/`; a gotcha read for a
    claim is read to its end (P15, P3);
  - `ui.css` is `src/ui/ui.css` (P18).
- **Matthew's answers, 2026-10-20, for session 7 to write** (quote them
  in the brief; the session confirms with him, since a brief is not an
  approval):
  - P13: a TODO §127 row folding `held-compare.mts` into `comment-strip`
    ("Signing the TODO!").
  - P14: CLAUDE.md "Editing" to say: anchor on whole lines, and keep a
    commit out of the message with its Edits ("Sounds good to me!").
  - To the HANDOFF Cursor's "Carried to the Round 8.5 close": P16, a home
    for the procedures sessions find only in old entries ("directionally
    I fully agree"; whether they still earn docs in a round where
    equivalence won't hold, and `process/` or a new folder, are open);
    and an audio notification for a driver's raises, since he couldn't
    say whether the Windows one reached him.
  - P2's guard: not yet ("a few more observations are needed to justify
    a guard"); the note stays in the briefs meanwhile.
- **Signed for session 7's brief** (Matthew, 2026-10-20: "Let's put both
  of them in brief"):
  - P17: "Open `batch` reads: list them with their scripts in your first
    message, then start the next batch. A `batch` read blocks nothing."
  - P20: the hand-off rule as planning.md has it, in his words "550k is
    'please don't start anything new'": start a batch under 550k when its
    forecast end, plus about 15k for the hand-off, stays under 600k;
    forecast at the pass's typical rate, not the session's first batch's.
    It replaces the 124.5h plan entry's end bound, so the session's entry
    says so.
- **For the round close** (with P16 above): planning.md's "larger than
  the room" as "the room to the halt"; driving.md's brief bullet telling
  open questions from open reads; and the name `batch` for both a read
  kind and the comment pass's units (Matthew's observation).

## Patterns

Numbered from §123. "Quiet" means no instance in the last phase.

| # | Pattern | Instances | Status |
|---|---|---|---|
| P1 | the step-code ceiling fails the first suite run after a deletion | 122b, 122g, 123b, 123d | quiet in §124 and §124.5 so far, the note held |
| P2 | shell: a heredoc refused, a backslash lost, a stray stdin reader opening a command | 122n, 122o, 123g, 123m b2, 124f, 124j b5; 124.5h b6 (`cat >`, 400 s), b7's hand-off (an empty `python3` heredoc, 120 s; named a repeat) | open; quiet in session 6 under brief 6's note; no guard yet (Matthew, 2026-10-20: more observations first), the note stays |
| P3 | a number or claim written ahead of its read | §123 sessions 1–7; 124d, e, h, i, 124j b4–b6; 124.5's kickoff (`molotov`), 124.5g (gotcha #114's cycle), 124.5h b7 ("fourteen" in a subject) | open; TODO §127's readings guard; until then `readings-check.mjs`, which matched every reading of sessions 4–6 |
| P6 | a change leaves a doc naming what it removed | 123e, 123's L-1 patch, the load fix | quiet in §124 and §124.5; no guard (Matthew, 2026-10-19) |
| P9 | a false claim's twin found a batch later | §122 b4, 123m b1 and 4a, 124j b1–b5 and b7 | open; the pass now finds twins in the batch (five in 124.5h: b3, b5, b7, b8, b9) |
| P11 | `comment-length` takes folders under the repo only | §122, 123n, §124 sessions 2 and 6 | open; the fix is in TODO §127; keep the note |
| P13 | `comment-strip` exits 1 on a reworded `TOOL_READ` marker, and the file's code is then unproven | 124j b5, 124j-post2, 124.5h b3 (`literalScan.ts`, outside `SCAN_ROOTS`) | a TODO §127 row signed 2026-10-20, for session 7 to write |
| P14 | an Edit anchor off whole lines: across a break it misses and a commit in the same message runs anyway; ending mid-line it glues the line's rest on, reporting success | §124, 124.5f (`c5e0a244`), 124.5h b4 (`copyText.ts`) | open; quiet in sessions 4–6 under the note; CLAUDE.md's change signed 2026-10-20, for session 7 |
| P15 | a count by a rule's or a name's written form misses a copy written another way | 122h, 124.5f's bar item 4 (the renderer's negated copy), 124.5c's A-26 count (a re-export, found at b7) | open; the note credited in batches 3–9 |
| P16 | a procedure, or its data, findable only in old WORKLOG entries or an unnamed scratch folder | §124.5 sessions 1 (reach, the drive), 2 (the re-skim, `scratch/120f/`); 6 (the comment tools' `npm run oracle --` form, a log) | to the round close (signed 2026-10-20), for session 7 to carry |
| P17 | the driver: Matthew reads an open item in the old session after its hand-off, and the waiting card's brief goes stale | after sessions 1 and 2; two cards proposed again | the fix held at sessions 4 and 6; "put them to him first" made session 5 wait on two `batch` reads, so brief 7 words them as non-blocking (signed 2026-10-20) |
| P20 | a session hands off early, bounding the next batch's end (not its start) by 550k at its first batch's rate | sessions 3 (368k), 5 (330k) and 6 (398k); the 124.5h plan's rule is the stricter one | planning.md's rule in brief 7 (signed 2026-10-20) |
| P18 | the charter's bare `ui.css` sends a grep to `src/ui.css` | 124.5h b3–4, b7 | quiet in session 6 under the note |
| P19 | the silent-turn reminder every few calls through long checks | every §124.5 session's report; session 6's `distress` line (a pull to have a finding ready; raised to Matthew 2026-10-20 00:48 UTC) | open, for the welfare read; CLAUDE.md "The silent-turn reminder" answers it, and the HANDOFF Cursor's riders (1) and (3) hold the reword's retirement and the feedback sent |

**Closed:** P4, the reach tools' arguments (§123 sessions 1–3; quiet
since). P5, working copies holding CRLF (120a to §123; quiet since). P7,
the next-step box against CLAUDE.md "What the user sees" (closed by its
bullet, `34304126`). P8, the comment pass's cost a line swinging with
reach (the Cursor carries the range; 36 to 126 in §124.5). P10, a ROADMAP
section at its 85-line cap (§123 sessions 6, 7; quiet since). P12, a `cd`
despite the note (§124; the note dropped at Matthew's word; once more in
§124.5, harmless).

**First instances**, watch for a second: a `node -e` given a Git Bash path
(it needs `C:/`); a doc's rule wider than Matthew's intent (the itch
address, `2d6369d9`); `refs --members` reading interfaces only (124.5b); a
probe written as a Vitest file outside the suite's include (§124.5 session
1); a WORKLOG heading repeating an older one's name (session 2); a commit
amended for its subject's count (b7, unpushed); a brief's wording wider
than a Cursor rule ("the whole repo" against `scratch/119f/hidden/`, brief
6; session 6's searches checked clean).

## Notes ledger

Credited: a session's record names the note as the reason for an action,
or a pattern with two or more earlier instances stops after it.

| Note | Briefs | Credited |
|---|---|---|
| `--record` before the suite | §124 1, 2, 7; §124.5 1–6 | yes; P1 quiet through 124.5 |
| search the docs for what a deletion removes | §124 1, 2, 7; §124.5 1, 2 | yes; out of the pass's briefs |
| `comment-length`'s form | §124 1, 3–7; §124.5 1–6 | yes |
| entries by the Write tool, messages by `-F` | §124 5–7; §124.5 1–6 | yes, but for 124.5h b6; kept though AGENTS says it (Matthew signed, 2026-10-19) |
| the comment tools' marker and `held-compare` | §124.5 1–6 | yes, the exit was expected; its "the hook's green is the proof" was false (b3), corrected in brief 4 |
| a step-code-shaped file name | §124.5 1–6 | not yet |
| whole-line Edits, no commit beside them | §124.5 2–6 | yes; P14 quiet in sessions 4–6 |
| where the procedures are | §124.5 2 | partly (P16) |
| `refs --members` reads interfaces only | §124.5 2 | not tested |
| other shapes and every caller; a gotcha to its end | §124.5 3–6 | yes: gotchas #80 and #116 "read to its end"; caller lists checked |
| no Bash call opening with a stdin reader | §124.5 6 | yes; quiet in session 6 |
| `ui.css` is `src/ui/ui.css` | §124.5 6 | yes; quiet in session 6 |
| the tools bare, without `npm run oracle --` | §124.5 1–6 | a fault in the note: session 6 lost a look (P16); session 7's names the form |

## Tool facts for this repo

- In Round 8.5, search `src`, `tools` and `tests` (and `scripts`,
  `config`, `locales`, the docs): a search of `scratch/` can walk
  `scratch/119f/hidden/`, which a cleaning session doesn't open (the
  HANDOFF Cursor). A doc check names `ARCHITECTURE.md DESIGN.md
  TESTING.md GOTCHAS.md process/*.md plans/*.md`.
- For a search whose empty answer is a claim, use the Grep tool, not a Git
  Bash `grep -rn --include` (124j b6).
- Commit times in `git log` are local (−04:00); the context meter and the
  transcripts are UTC.
- `git show --numstat --format= <commit>` gives a step's added and deleted
  lines by file; the baseline's removed counts summed
  (`git show --format= <c> -- tests/comment-codes-baseline.json`) check a
  batch's step-code figure.
- `node archive/driver-trial/readings-check.mjs <transcript> <untilISO>
  <word> [reading...]` checks each context reading against the
  transcript's response totals; a planted 123,457 must miss. The
  transcripts are
  `~/.claude/projects/C--Users-mkilg-projects-asciibattler/<id>.jsonl`.
  Until TODO §127's guard.
- A hand-off read of a §124.5 session, with its proposal, cost driver 1
  about 25–40k; from a fresh driver's first reading (114k for driver 1),
  that is six or seven reads to the 350k line.
