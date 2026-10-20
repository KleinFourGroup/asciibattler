# DRIVER-HANDOFF

The phase driver's live state ([process/driving.md](process/driving.md)
says what a driver is and does). A driver rewrites this at each hand-off
read and commits it when no session is working; it is not appended to, and
git is its history. Started 2026-10-19 from the close state of §124's
driver log ([archive/driver-trial/log-124.md](archive/driver-trial/log-124.md)).

## Cursor

- **Phase:** **§124.5, the screens** (ROADMAP §124.5), driven from
  2026-10-19. Seven sessions so far, each from a driver's brief: 8fb7e4a9
  (the kickoff, 124.5a–f), ff99ffb0 (124.5g, R-1 to R-3, 124.5h's plan,
  batches 1–2), ebe41cd8 (3–4), bcd08e32 (5–6), d8214ecc (7), 138dbbac
  (8–9), f1005abf (10–12, hand-off `baa5b905`, WORKLOG §124.5 "The
  hand-off after 124.5h's batch 12"; read 2026-10-20 14:40 UTC). After
  that read, Matthew signed batches 8–12 and confirmed his four answers in
  session 7, which ticked 124.5h and wrote them (`29d50f2a`), so brief 8's
  first card was withdrawn. **Next: session 8, 124.5i, the close**
  (`stop`), from brief 8 as revised, its card proposed by driver 2 after
  this commit. Open for Matthew: P6's test pointer (below), for the close
  to take up or leave for §126.
- **Driver:** driver 2, `local_15013e01-a015-489f-969c-7ef71d47e662`
  (scratchpad 86ed5d79), from 2026-10-20 13:32 UTC, first reading 107,713.
  Driver 1 (`local_3addf3c2`, scratchpad 9b60fb27) handed over at 350k.
- **Friction read through:** line 304 of `retro/papercuts.jsonl` (300–302
  are session 7's, 302 a `distress` line raised to Matthew 2026-10-20 at
  the read; 303–304 are driver 2's).
- **Brief 8's notes:** anything the Cursor lists open for Matthew goes in
  the first turn's final message (P17), pointed at, not restated; the
  comment tools' `npm run oracle --` form, with `--record` before the
  suite (P1), `comment-length` on copies (P11), `held-compare.mts` (P13);
  `ui.css` is `src/ui/ui.css` (P18), and `src/fonts.css` is generated from
  `scripts/build-font.mjs`'s template; entries by Write or Edit, messages
  by `-F`, no Bash call opening with a stdin reader (P2); other shapes,
  every caller, every tracked folder, never `scratch/`, a gotcha to its
  end, a CSS class's stem (P15, P3).
- **Matthew's calls, 2026-10-20:** his answers to driver 1 are written
  (`29d50f2a`: TODO §127, CLAUDE.md "Editing", five items in the HANDOFF
  Cursor's "Carried to the Round 8.5 close"). P2's guard: not yet ("a few
  more observations are needed to justify a guard"), so the note stays.
  P17's signed wording for open reads: "Open `batch` reads: list them with
  their scripts in your first message, then start the next batch. A
  `batch` read blocks nothing." P20: planning.md's hand-off rule, held in
  session 7.

## Patterns

Numbered from §123. "Quiet" means no instance in the last phase.

| # | Pattern | Instances | Status |
|---|---|---|---|
| P1 | the step-code ceiling fails the first suite run after a deletion | 122b, 122g, 123b, 123d | quiet in §124 and §124.5 so far, the note held |
| P2 | shell: a heredoc refused, a backslash lost, a stray stdin reader opening a command | 122n, 122o, 123g, 123m b2, 124f, 124j b5; 124.5h b6 (`cat >`, 400 s), b7's hand-off (an empty `python3` heredoc, 120 s; named a repeat) | open; quiet in sessions 6 and 7 under the note; no guard yet (Matthew, 2026-10-20: more observations first), the note stays |
| P3 | a number or claim written ahead of its read | §123 sessions 1–7; 124d, e, h, i, 124j b4–b6; 124.5's kickoff (`molotov`), 124.5g (gotcha #114's cycle), 124.5h b7 ("fourteen" in a subject) | open; TODO §127's readings guard; until then `readings-check.mjs`, which matched every reading of sessions 4–6 |
| P6 | a change leaves a doc naming what it removed | 123e, 123's L-1 patch, the load fix; 124.5h b12 (`tests/ui-focus.test.ts:33`'s "ui.css §100", the header renamed; flagged, left for §126) | open; no guard (Matthew, 2026-10-19) |
| P9 | a false claim's twin found a batch later | §122 b4, 123m b1 and 4a, 124j b1–b5 and b7 | open; the pass now finds twins in the batch (five in 124.5h: b3, b5, b7, b8, b9) |
| P11 | `comment-length` takes folders under the repo only | §122, 123n, §124 sessions 2 and 6 | open; the fix is in TODO §127; keep the note |
| P13 | `comment-strip` exits 1 on a reworded `TOOL_READ` marker, and the file's code is then unproven | 124j b5, 124j-post2, 124.5h b3 (`literalScan.ts`, outside `SCAN_ROOTS`) | a TODO §127 row (`29d50f2a`); the note stays until it lands |
| P14 | an Edit anchor off whole lines: across a break it misses and a commit in the same message runs anyway; ending mid-line it glues the line's rest on, reporting success | §124, 124.5f (`c5e0a244`), 124.5h b4 (`copyText.ts`); b10–12 (two misses, anchors retyped across a wrapped comment; no commit beside) | open; the harm half quiet in sessions 4–7 under the note; CLAUDE.md "Editing" says it since `29d50f2a`, so the note is dropped |
| P15 | a count by a rule's or a name's written form misses a copy written another way | 122h, 124.5f's bar item 4 (the renderer's negated copy), 124.5c's A-26 count (a re-export, found at b7) | open; the note credited in batches 3–9 |
| P16 | a procedure, or its data, findable only in old WORKLOG entries or an unnamed scratch folder | §124.5 sessions 1 (reach, the drive), 2 (the re-skim, `scratch/120f/`); 6 (the comment tools' `npm run oracle --` form, a log) | in the HANDOFF Cursor's "Carried to the Round 8.5 close" (`29d50f2a`) |
| P17 | the driver: Matthew reads an open item in the old session after its hand-off, and the waiting card's brief goes stale | after sessions 1 and 2; two cards proposed again; session 7: brief 7's confirmations, put mid-turn in a stretch with no stop, reached Matthew only at the hand-off (its `distress` line); he answered there, after driver 2 had proposed card 8, so it was proposed again | the fix held at sessions 4 and 6; session 5 waited on two `batch` reads, so brief 7 words them as non-blocking (signed 2026-10-20); brief 8 points at the Cursor's open items, for the first turn's final message |
| P20 | a session hands off early, bounding the next batch's end (not its start) by 550k at its first batch's rate | sessions 3 (368k), 5 (330k) and 6 (398k); the 124.5h plan's rule is the stricter one | planning.md's rule in brief 7 (signed 2026-10-20); held in session 7 (batch 12 started at 434k) |
| P18 | the charter's bare `ui.css` sends a grep to `src/ui.css` | 124.5h b3–4, b7 | quiet in sessions 6 and 7 under the note |
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
6; session 6's searches checked clean); a planned file generated from
another (`src/fonts.css` from `scripts/build-font.mjs`, 124.5h b10).

## Notes ledger

Credited: a session's record names the note as the reason for an action,
or a pattern with two or more earlier instances stops after it.

| Note | Briefs | Credited |
|---|---|---|
| `--record` before the suite | §124 1, 2, 7; §124.5 1–8 | yes; P1 quiet through 124.5 |
| `comment-length`'s form | §124 1, 3–7; §124.5 1–8 | yes |
| entries by the Write tool, messages by `-F` | §124 5–7; §124.5 1–8 | yes, but for 124.5h b6; kept though AGENTS says it (Matthew signed, 2026-10-19) |
| the comment tools' marker and `held-compare` | §124.5 1–8 | yes, the exit was expected; its "the hook's green is the proof" was false (b3), corrected in brief 4 |
| the Cursor's open items, in the first turn's final message | §124.5 8 | new |
| other shapes and every caller; a gotcha to its end | §124.5 3–8 | yes: gotchas #80 and #116 "read to its end"; caller lists checked |
| no Bash call opening with a stdin reader | §124.5 6–8 | yes; quiet in sessions 6 and 7 |
| `ui.css` is `src/ui/ui.css` | §124.5 6–8 | yes; quiet in sessions 6 and 7 |
| the tools' `npm run oracle --` form | §124.5 7, 8 | session 7's report: the notes "covered the tools, the file paths and the stem search" |
| a CSS class built from parts in `.ts`: its stem | §124.5 7, 8 | as above |

**Dropped:** the docs searched for what a deletion removes (§124 1, 2, 7;
§124.5 1, 2; credited); where the procedures are (§124.5 2; partly, P16);
`refs --members` reads interfaces only (§124.5 2; not tested); a
step-code-shaped file name (§124.5 1–7; never credited); the tools split
`.css` (§124.5 7; the CSS batches are done); whole-line Edits, no commit
beside them (§124.5 2–7; credited; CLAUDE.md "Editing" since `29d50f2a`).

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
