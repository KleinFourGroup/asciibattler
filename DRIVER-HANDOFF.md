# DRIVER-HANDOFF

The phase driver's live state ([process/driving.md](process/driving.md)
says what a driver is and does). A driver rewrites this at each hand-off
read and commits it when no session is working; it is not appended to, and
git is its history. Started 2026-10-19 from the close state of §124's
driver log ([archive/driver-trial/log-124.md](archive/driver-trial/log-124.md)).

## Cursor

- **Phase:** **§126, tests: 126a–126i built**, no ◐ open. Session 1,
  `local_4adec7aa…` (314e1038), brief 1: the kickoff to 126d, 101,090 →
  425,583. Session 2, `local_a9fd7b26…` (e6ab25e8), brief 2: 126e–126i,
  109,636 → 403,285; its hand-off at `9af370fc` (WORKLOG §126, "The
  hand-off after 126i"). Every reading of both matches its transcript.
  **Next: 126j, B-11's trial**, from brief 3, proposed as a card at this
  file's commit.
- **Driver:** driver 4, `local_e1ae5cfd-6e02-4822-8e2b-241eca97267e`
  (scratchpad 70e12103), started by Matthew 2026-10-21 12:28 UTC; first
  reading 115,477. Driver 3, §125's, was `local_4c64446d…` (33d012d0).
- **Friction read through:** line 315 of `retro/papercuts.jsonl` (session
  2's, P21).
- **Brief 3's notes:** the oracle tools' forms, `--record` (P1), the
  plant tool's numbering; Write or Edit, `-F`, no stdin reader (P2);
  other shapes and every caller, the kickoff's B-11 and R-4 counts each
  by one form (P15, P3); a count's file list, `git grep`'s `:(glob)`
  (P21); should it reach 126m, the comment pass's four WORKLOG headings
  (P16), `comment-length` on copies (P11), `held-compare` not needed
  (P13). Not noted: P20 (planning.md says it).
- **Matthew's calls standing:** at the read of §126 session 2 (signed
  2026-10-21): P21's note, from brief 3; P22 and P23, no action (P23
  "may just be how Claude Code works"); P24 a watch, no rule: the plant
  under `scratch/` stands as read, and the line on a `none` step built
  while another's call waits ("whether or not it's actually necessary";
  "I just don't want to be over-prompting") is drafted only if a session
  idles on a call with independent work there, or builds a stretch past
  a waiting question. P2's guard: not yet ("a few more
  observations are needed to justify a guard"), so its note stays. P6's
  and P12's notes stay dropped. P17's wording for open reads, kept here
  and not copied into briefs (signed 2026-10-20): "Open `batch` reads:
  list them with their scripts in your first message, then start the
  next batch. A `batch` read blocks nothing." Over-prompting:
  subtraction, in `process/driving.md` (`0a9e89ea`). Held: a coarse plant
  at the cut for a bar that names an instrument's catch ("pending a
  little bit more data"); driver 3's lean: drop it unless a cut misses
  the oracles.md rule again.

## Patterns

Numbered from §123. "Quiet" means no instance in the last phase; s = session.

| # | Pattern | Instances | Status |
|---|---|---|---|
| P2 | shell: a heredoc refused, a backslash lost, a stray stdin reader | §122–124 (6); 124.5h b6, b7 | quiet since §124.5 under the note; no guard yet (Matthew, 2026-10-20) |
| P3 | a number or claim written ahead of its read | §123–124.5 (16 s); §125: three found later, each back to Matthew, two caught before landing; §126 s1 three, s2 two, caught before landing | open; TODO §127's readings guard; until then `readings-check.mjs` (every §125 and §126 reading matched) |
| P6 | a change leaves a doc naming what it removed | §123 (3), 124.5h b12, driver 2; §126's charter naming A-25's tests (found at the kickoff; reported, not named a repeat) | open; no guard (Matthew, 2026-10-19) |
| P9 | a false claim's twin found a batch later | §122 b4, 123m (2), 124j (6); §125's close (2) | open; the pass finds most twins in the batch |
| P12 | a `cd` in a Bash command moves the working directory | §124; §124.5 twice | quiet; note dropped (Matthew, 2026-10-20) |
| P13 | `comment-strip` exits 1 on a reworded `TOOL_READ` marker | 124j b5, 124j-post2, 124.5h b3 | a TODO §127 row; note until it lands |
| P14 | an Edit anchor off whole lines | §124, 124.5f, 124.5h b4, b10–12 | quiet; CLAUDE.md "Editing", no note |
| P15 | a count by a name's written form misses a copy written another way | 122h, 124.5c, 124.5f; §126's kickoff: the loops as 54 `while (` lines, missing `for (;;)` (driver 4 found two in test files) | brief 2's note credited: 126e's step zero searched five forms, found 60 |
| P16 | a procedure or its data findable only in old WORKLOG entries or an unnamed scratch folder | §124.5 s1, 2, 6; §125 s2, s3 (20k); §126 s1 (120e's runner, by listing `scratch/120e/`) | carried to the Round 8.5 close (HANDOFF Cursor) |
| P17 | the driver: Matthew answers an open item in the old session after its hand-off; the waiting brief goes stale | §124.5 after s1, 2, 7; §125 after s1 | driving.md leaves open items in the Cursor (signed 2026-10-20) |
| P18 | the charter's bare `ui.css` sends a grep to `src/ui.css` | 124.5h b3–4, b7 | quiet |
| P19 | the silent-turn reminder every few calls through long checks | every §124.5 report, its s6 `distress` line; §125 s3; §126 s1, s2 (status lines, no pull) | open, for the welfare read; the Cursor's riders (1), (3) |
| P20 | a session hands off early, bounding the next step's end by 550k | §124.5 s3, 5, 6; §125 s1 (524k), s2 (463k) | call 6, planning.md's room to the halt (`cb44065b`); held since: §125 s3; §126 s1 (at 126c's stop, Matthew chose), s2 (403k, before 126j: its forecast of the trial's step zero against the halt) |
| P21 | a count or absence read from a shell search's filtered, truncated or narrowed output | 124j b6 (`grep -rn --include`); §125 s3 (`head -3`); §126 s2 (`git grep`'s `tests/**/*.test.ts` without `:(glob)` skips `tests/*.test.ts`; caught, filed) | a note from brief 3 (signed 2026-10-21; AGENTS' line names pipes, not pathspecs) |
| P22 | a doc cap tripped by a first wording (P10's cousin) | BALANCE's header (125e); driver 4's DRIVER-HANDOFF; 126g's AGENTS (20,042) | no action (Matthew, 2026-10-21): the cap test is the guard, one run each |
| P23 | a turn ended mid-stretch with a status line while a background run went on | §126 s1 (126b, twice), s2 (four; called waste) | no action (Matthew, 2026-10-21); the harness resumes the session when its run ends |
| P24 | a gap in the rules filled by the session's own reading, flagged in its report | §126 s1 (a planted test file under `scratch/126b/`, not in a worktree), s2 (126g built while 126f's threshold call waited) | a watch (signed 2026-10-21): a rule only on the bad version (the Cursor) |

**Closed:** P1, the ceiling failing a suite run after a deletion (122b
to 123d; 125e once; a second miss reopens it). P4, the reach tools'
arguments (§123). P5, CRLF copies (§120–123). P7, the next-step box.
P8, the pass's cost a line swinging with reach. P10, a ROADMAP section
at its cap (§123). P11, `comment-length` reading folders under the repo
only (§122–124; its note stays until TODO §127's fix).

**First instances**, watch for a second: a `node -e` given a Git Bash path
(it needs `C:/`); a doc's rule wider than Matthew's intent (`2d6369d9`);
`refs --members` reading interfaces only (124.5b); a probe written as a
Vitest file outside the suite's include; a WORKLOG heading repeating an
older one's name; a commit amended for its subject's count; a brief's
wording wider than a Cursor rule (§124.5); a planned file generated from
another (`src/fonts.css`); a commit subject's count read two ways; a call
put without a lean (§125's call 6); non-ASCII in a script's argument
mangled on Windows (125e); a finding for the next phase written only in a
session report (§125 s3; TODO §126 has it); `plant --list`'s numbering
against `--nth`'s (126d; P4's cousin); a verdict word read without its
detail, the plant tool's CAUGHT for a run stopped at its limit (126e,
caught before writing); a signed plant swapped for another of its shape,
flagged (126e's plant A).

## Notes ledger

Credited: a session's record names the note as the reason for an action,
or a pattern with two or more earlier instances stops after it.

| Note | Briefs | Credited |
|---|---|---|
| `--record` before the suite | §124 1, 2, 7; §124.5 1–8; §125 1–3; §126 1–3 | yes; missed once at 125e; quiet since |
| `comment-length`'s form | §124 1, 3–7; §124.5 1–8; §125 1–3; §126 1–3 (should it reach 126m) | yes; 125k measured copies under `output/` |
| entries by the Write tool, messages by `-F` | §124 5–7; §124.5 1–8; §125 1–3; §126 1–3 | yes, but for 124.5h b6; kept though AGENTS says it (Matthew signed, 2026-10-19) |
| the comment tools' marker and `held-compare` | §124.5 1–8; §125 1–3; §126 1–3 (as not needed) | yes in §124.5 and 125k |
| other shapes and every caller; test files; a gotcha to its end | §124.5 3–8; §125 1–3; §126 1–3 | yes: 125g's catch; 126e's step zero from brief 2's named loops |
| no Bash call opening with a stdin reader | §124.5 6–8; §125 1–3; §126 1–3 | yes; quiet through §126 s2 |
| the tools' `npm run oracle --` form | §124.5 7, 8; §125 1–3; §126 1–3 | yes; "pointed at everything" (§125 s3, §126 s1) |
| the comment pass's four WORKLOG headings (P16) | §126 1–3 (should it reach 126m) | not yet: 126m not reached |
| the plant tool's numbering | §126 2, 3 | not named by s2 |
| a count's file list, `:(glob)` (P21) | §126 3 | |

**Dropped** (briefs and credit at `9c886b50`): the docs searched for what
a deletion removes; where the procedures are; `refs --members`; a
step-code-shaped file name; the tools split `.css`; whole-line Edits
(CLAUDE.md "Editing"); at §125, `ui.css`'s path and a class's stem, and
the first turn's open items; at §126, the hand-off forecast (P20;
credited: call 6, then planning.md since `cb44065b`).

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
- A hand-off read with its proposal cost driver 3 about 45–60k in §125,
  so a driver from a fresh start has about five reads to the 350k line.
