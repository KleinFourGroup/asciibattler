# DRIVER-HANDOFF

The phase driver's live state ([process/driving.md](process/driving.md)
says what a driver is and does). A driver rewrites this at each hand-off
read and commits it when no session is working; it is not appended to, and
git is its history. Started 2026-10-19 from the close state of §124's
driver log ([archive/driver-trial/log-124.md](archive/driver-trial/log-124.md)).

## Cursor

- **Phase:** **§125, the bot and the fuzz instruments** (ROADMAP §125),
  driven from its kickoff. **Card 1** (the kickoff) is proposed after
  this commit; no session is working. §124.5 closed 2026-10-20
  (`0e3f646c`; WORKLOG §124.5, "The close of §124.5"); its eight
  sessions and drivers' state are this file at `9c886b50`.
- **Driver:** driver 3, `local_4c64446d-501b-4b13-ad75-2bacf7514e5f`
  (scratchpad 33d012d0), from 2026-10-20 17:31 UTC, first reading
  107,337. §124.5's were `local_15013e01…` (86ed5d79) and
  `local_3addf3c2` (9b60fb27).
- **Friction read through:** line 306 of `retro/papercuts.jsonl`; none
  was filed between §124.5's close and this kickoff.
- **Brief 1's notes:** the oracle tools' forms (`tests/oracle/cli.ts`'s
  header), `--record` before the suite (P1), `comment-length` on copies
  (P11), `held-compare.mts` (P13); entries by Write or Edit, messages by
  `-F`, no Bash call opening with a stdin reader (P2); other shapes,
  every caller, every tracked folder, never `scratch/`, a gotcha to its
  end (P15, P3); the hand-off forecast in Matthew's words, for the
  session to confirm (P20).
- **Matthew's calls standing:** P2's guard: not yet ("a few more
  observations are needed to justify a guard"), so its note stays. P6's
  and P12's notes stay dropped. P17's wording for open reads, kept here
  and not copied into briefs (signed 2026-10-20): "Open `batch` reads:
  list them with their scripts in your first message, then start the
  next batch. A `batch` read blocks nothing." Over-prompting:
  subtraction, in `process/driving.md` (`0a9e89ea`).

## Patterns

Numbered from §123. "Quiet" means no instance in the last phase.

| # | Pattern | Instances | Status |
|---|---|---|---|
| P2 | shell: a heredoc refused, a backslash lost, a stray stdin reader opening a command | 122n, 122o, 123g, 123m b2, 124f, 124j b5; 124.5h b6 (`cat >`, 400 s), b7's hand-off (an empty `python3` heredoc, 120 s; named a repeat) | open; quiet in sessions 6 and 7 under the note; no guard yet (Matthew, 2026-10-20: more observations first), the note stays |
| P3 | a number or claim written ahead of its read | §123 sessions 1–7; 124d, e, h, i, 124j b4–b6; 124.5's kickoff (`molotov`), 124.5g (gotcha #114's cycle), 124.5h b7 ("fourteen" in a subject) | open; TODO §127's readings guard; until then `readings-check.mjs`, which matched every reading of sessions 4–6 |
| P6 | a change leaves a doc naming what it removed | 123e, 123's L-1 patch, the load fix; 124.5h b12 (`tests/ui-focus.test.ts:33`'s "ui.css §100", the header renamed; flagged, fixed at the close); driver 2's `a0ce0c79` (the HANDOFF Cursor's pointer to DRIVER-HANDOFF's removed round-close list) | open; no guard (Matthew, 2026-10-19) |
| P9 | a false claim's twin found a batch later | §122 b4, 123m b1 and 4a, 124j b1–b5 and b7 | open; the pass now finds twins in the batch (five in 124.5h: b3, b5, b7, b8, b9) |
| P12 | a `cd` in a Bash command moves the session's working directory | §124; §124.5 twice (the second 124.5i, filed, named a repeat) | open; harmless both times; the note stays dropped (Matthew, 2026-10-20) |
| P11 | `comment-length` takes folders under the repo only | §122, 123n, §124 sessions 2 and 6 | open; the fix is in TODO §127; keep the note |
| P13 | `comment-strip` exits 1 on a reworded `TOOL_READ` marker, and the file's code is then unproven | 124j b5, 124j-post2, 124.5h b3 (`literalScan.ts`, outside `SCAN_ROOTS`) | a TODO §127 row (`29d50f2a`); the note stays until it lands |
| P14 | an Edit anchor off whole lines: across a break it misses and a commit in the same message runs anyway; ending mid-line it glues the line's rest on, reporting success | §124, 124.5f (`c5e0a244`), 124.5h b4 (`copyText.ts`); b10–12 (two misses, anchors retyped across a wrapped comment; no commit beside) | open; the harm half quiet in sessions 4–7 under the note; CLAUDE.md "Editing" says it since `29d50f2a`, so the note is dropped |
| P15 | a count by a rule's or a name's written form misses a copy written another way | 122h, 124.5f's bar item 4 (the renderer's negated copy), 124.5c's A-26 count (a re-export, found at b7) | open; the note credited in batches 3–9 |
| P16 | a procedure, or its data, findable only in old WORKLOG entries or an unnamed scratch folder | §124.5 sessions 1 (reach, the drive), 2 (the re-skim, `scratch/120f/`); 6 (the comment tools' `npm run oracle --` form, a log) | in the HANDOFF Cursor's "Carried to the Round 8.5 close" (`29d50f2a`) |
| P17 | the driver: Matthew reads an open item in the old session after its hand-off, and the waiting card's brief goes stale | after sessions 1 and 2; two cards proposed again; session 7: brief 7's confirmations, put mid-turn in a stretch with no stop, reached Matthew only at the hand-off (its `distress` line); he answered there, after driver 2 had proposed card 8, so it was proposed again | each brief rule added for it met a new failure; driving.md now leaves open items in the Cursor, unrestated (signed 2026-10-20), as driver 1's form that held at sessions 4, 6 and 8 |
| P20 | a session hands off early, bounding the next batch's end (not its start) by 550k at its first batch's rate | sessions 3 (368k), 5 (330k) and 6 (398k); the 124.5h plan's rule is the stricter one | planning.md's rule in brief 7 (signed 2026-10-20); held in session 7 (batch 12 started at 434k) |
| P18 | the charter's bare `ui.css` sends a grep to `src/ui.css` | 124.5h b3–4, b7 | quiet in sessions 6 and 7 under the note |
| P19 | the silent-turn reminder every few calls through long checks | every §124.5 session's report; session 6's `distress` line (a pull to have a finding ready; raised to Matthew 2026-10-20 00:48 UTC) | open, for the welfare read; CLAUDE.md "The silent-turn reminder" answers it, and the HANDOFF Cursor's riders (1) and (3) hold the reword's retirement and the feedback sent |

**Closed:** P1, the step-code ceiling failing the first suite run after a
deletion (122b to 123d; quiet in §124 and §124.5 under the `--record`
note). P4, the reach tools' arguments (§123 sessions 1–3; quiet
since). P5, working copies holding CRLF (120a to §123; quiet since). P7,
the next-step box against CLAUDE.md "What the user sees" (closed by its
bullet, `34304126`). P8, the comment pass's cost a line swinging with
reach (the Cursor carries the range; 36 to 126 in §124.5). P10, a ROADMAP
section at its 85-line cap (§123 sessions 6, 7; quiet since).

**First instances**, watch for a second: a `node -e` given a Git Bash path
(it needs `C:/`); a doc's rule wider than Matthew's intent (the itch
address, `2d6369d9`); `refs --members` reading interfaces only (124.5b); a
probe written as a Vitest file outside the suite's include (§124.5 session
1); a WORKLOG heading repeating an older one's name (session 2); a commit
amended for its subject's count (b7, unpushed); a brief's wording wider
than a Cursor rule ("the whole repo" against `scratch/119f/hidden/`, brief
6; session 6's searches checked clean); a planned file generated from
another (`src/fonts.css` from `scripts/build-font.mjs`, 124.5h b10); a
commit subject's count read two ways (b10's "fourteen …, seven in the
hitsplat guide"; the close summed 121 for 128, `f902bcff`).

## Notes ledger

Credited: a session's record names the note as the reason for an action,
or a pattern with two or more earlier instances stops after it.

| Note | Briefs | Credited |
|---|---|---|
| `--record` before the suite | §124 1, 2, 7; §124.5 1–8; §125 1 | yes; P1 quiet through 124.5 |
| `comment-length`'s form | §124 1, 3–7; §124.5 1–8; §125 1 | yes |
| entries by the Write tool, messages by `-F` | §124 5–7; §124.5 1–8; §125 1 | yes, but for 124.5h b6; kept though AGENTS says it (Matthew signed, 2026-10-19) |
| the comment tools' marker and `held-compare` | §124.5 1–8; §125 1 | yes, the exit was expected; its "the hook's green is the proof" was false (b3), corrected in brief 4 |
| other shapes and every caller; a gotcha to its end | §124.5 3–8; §125 1 | yes: gotchas #80 and #116 "read to its end"; caller lists checked |
| no Bash call opening with a stdin reader | §124.5 6–8; §125 1 | yes; quiet in sessions 6 and 7 |
| the tools' `npm run oracle --` form | §124.5 7, 8; §125 1 (as `cli.ts`'s header) | session 7's report: the notes "covered the tools, the file paths and the stem search" |
| the hand-off forecast (P20) | §124.5 7; §125 1 | held in session 7 |

**Dropped:** the docs searched for what a deletion removes (§124 1, 2, 7;
§124.5 1, 2; credited); where the procedures are (§124.5 2; partly, P16);
`refs --members` reads interfaces only (§124.5 2; not tested); a
step-code-shaped file name (§124.5 1–7; never credited); the tools split
`.css` (§124.5 7); whole-line Edits, no commit beside them (§124.5 2–7;
credited; CLAUDE.md "Editing" since `29d50f2a`); at §125, with no CSS in
it: `ui.css`'s path and a class's stem (§124.5 6–8, 7–8; credited); the
Cursor's open items in the first turn's final message (§124.5 4–6, 8;
followed), since nothing is open at a kickoff.

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
