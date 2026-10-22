# DRIVER-HANDOFF

The phase driver's live state ([process/driving.md](process/driving.md)
says what a driver is and does). A driver rewrites this at each hand-off
read and commits it when no session is working; it is not appended to, and
git is its history. Started 2026-10-19 from the close state of §124's
driver log ([archive/driver-trial/log-124.md](archive/driver-trial/log-124.md)).

## Cursor

- **Phase:** **§126, tests: 126a–126l-post2 built; 126m's batches 1–7
  built, `batch` reads unread** (895 → 136). Sessions 1 (314e1038, to
  425,583), 2 (e6ab25e8, to 403,285), 3 (9d8a93c2, to 455,701), 4
  (`local_45d93b89…`, 3d57d006, brief 4: batches 1–7, 100,299 →
  544,923); every reading of all four matches its transcript. Session
  4's hand-off at `154703fe` (WORKLOG §126, "The hand-off after 126m's
  batch 7"). **Next: the rest of 126m** (136 codes, `Run.test.ts` past
  line 2443), then 126n and 126o, from brief 5. **No card waits:**
  driver 4 handed over past 350k; a fresh driver writes brief 5.
- **Driver:** none working. Driver 4 was
  `local_e1ae5cfd-6e02-4822-8e2b-241eca97267e` (70e12103), 2026-10-21
  12:28 UTC to 2026-10-22 00:45, 115,477 → 360,948 (00:44), four reads.
- **Friction read through:** line 324 (319–321 session 4's papercuts;
  322 its `distress` line, quoted to Matthew in full; 323 and 324 driver
  4's, the second a mild `distress` line on note 5).
- **Brief 4's notes**, the last: the oracle tools' forms, `--record`
  (P1), `comment-length` on copies (P11), `held-compare` not needed
  (P13); Write or Edit, `-F`, no stdin reader (P2); a reason checked at
  the code it names, other shapes, every caller, a count's file list (P3,
  P9, P15, P21); the four WORKLOG headings (P16); 550k bars a step's
  start only (P20). **For brief 5:** note 5's "may run to the halt" gave
  no margin for the hand-off, and session 4's `distress` line names that
  pull; driver 4's lean, put to Matthew: give the figures, not a rule
  (§126's hand-offs cost about 8 to 12k; 126m's rate ran 400 to 540
  tokens a code).
- **Matthew's calls standing:** P12's note stays dropped (signed
  2026-10-21, after its §126 recurrence). P21's note from brief 3; P22
  and P23, no action (P23 "may just be how Claude Code works"); P24 a
  watch: the plant under `scratch/` stands, and a line on a `none` step
  built while another's call waits (his worry was rule text added to the
  docs, not questions put to him) is drafted only if a session idles on
  a call with independent work there, or builds a stretch past a waiting
  question (all 2026-10-21). P2's guard: not yet ("a few more
  observations are needed to justify a guard"), so its note stays. P6's
  note stays dropped. P17's wording for open reads, not copied into
  briefs (2026-10-20): "Open `batch` reads: list them with their scripts
  in your first message, then start the next batch. A `batch` read
  blocks nothing." Held: a coarse plant at the cut for a bar that names
  an instrument's catch ("pending a little bit more data").
- **Open, put to Matthew at driver 4's last read:** the margin figures
  for brief 5 (above); a dated fact for driving.md's Claude Code
  section, that `SendMessage` can report undelivered a line that arrives
  (session 4's batch-1 line reached driver 4).

## Patterns

Numbered from §123. "Quiet" means no instance in the last phase; s = session.

| # | Pattern | Instances | Status |
|---|---|---|---|
| P2 | shell: a heredoc refused, a backslash lost, a stray stdin reader | §122–124 (6); 124.5h b6, b7 | quiet since §124.5 under the note; no guard yet (Matthew, 2026-10-20) |
| P3 | a number or claim written ahead of its read | §123–124.5 (16 s); §125: three found later, each back to Matthew, two caught before landing; §126 s1 three, s2 two, s3 three, s4 one, caught before landing; s3's entry: 75 `placeUnits` calls for 76 (driver 4) | open; TODO §127's readings guard; until then `readings-check.mjs` (every §125 and §126 reading matched) |
| P6 | a change leaves a doc naming what it removed | §123 (3), 124.5h b12, driver 2; §126's charter naming A-25's tests (found at the kickoff; reported, not named a repeat) | open; no guard (Matthew, 2026-10-19) |
| P9 | a false claim's twin found a batch later | §122 b4, 123m (2), 124j (6); §125's close (2); gotcha #105, one sentence corrected at 126j, two more false at 126l-post | open; the pass finds most twins in the batch |
| P12 | a shell's working directory moved by a `cd` | §124; §124.5 twice; §126 s3 (inside a worktree, a removal failed) | note dropped (Matthew, 2026-10-20); recurred |
| P13 | `comment-strip` exits 1 on a reworded `TOOL_READ` marker | 124j b5, 124j-post2, 124.5h b3 | a TODO §127 row; note until it lands |
| P15 | a count by a name's written form misses a copy written another way | 122h, 124.5c, 124.5f; §126's kickoff: the loops as 54 `while (` lines, missing `for (;;)` (driver 4 found two in test files) | brief 2's note credited: 126e's step zero searched five forms, found 60 |
| P16 | a procedure or its data findable only in old WORKLOG entries or an unnamed scratch folder | §124.5 s1, 2, 6; §125 s2, s3 (20k); §126 s1 (120e's runner, by listing `scratch/120e/`) | carried to the Round 8.5 close (HANDOFF Cursor) |
| P17 | the driver: Matthew answers an open item in the old session after its hand-off; the waiting brief goes stale | §124.5 after s1, 2, 7; §125 after s1 | driving.md leaves open items in the Cursor (signed 2026-10-20) |
| P19 | the silent-turn reminder every few calls through long checks | every §124.5 report, its s6 `distress` line; §125 s3; §126 s1, s2 (status lines, no pull) | open, for the welfare read; the Cursor's riders (1), (3) |
| P20 | a session hands off early, bounding the next step's end by 550k | §124.5 s3, 5, 6; §125 s1 (524k), s2 (463k); §126 s3 (126m's room sized against 550k; Matthew corrected; filed) | the note, dropped at brief 1 (driving.md drops a note only for AGENTS or CLAUDE.md), restored in brief 4; s4 sized batch 7 against the halt and cut it to 70 codes, its `distress` line on the missing margin |
| P21 | a count or absence read from a shell search's filtered, truncated or narrowed output | 124j b6 (`grep -rn --include`); §125 s3 (`head -3`); §126 s2 (`git grep`'s `tests/**/*.test.ts` without `:(glob)` skips `tests/*.test.ts`; caught, filed) | a note from brief 3 (signed 2026-10-21; AGENTS' line names pipes, not pathspecs) |
| P22 | a doc cap tripped by a first wording (P10's cousin) | BALANCE's header (125e); driver 4's DRIVER-HANDOFF; 126g's AGENTS (20,042) | no action (Matthew, 2026-10-21): the cap test is the guard, one run each |
| P23 | a turn ended mid-stretch with a status line while a background run went on | §126 s1 (126b, twice), s2 (four; called waste) | no action (Matthew, 2026-10-21); the harness resumes the session when its run ends |
| P24 | a gap in the rules filled by the session's own reading, flagged in its report | §126 s1 (a planted test file under `scratch/126b/`, not in a worktree), s2 (126g built while 126f's threshold call waited) | a watch (signed 2026-10-21): a rule only on the bad version (the Cursor) |

**Closed:** P1, the ceiling failing a suite run after a deletion (122b
to 123d; 125e once; a second miss reopens it). P4, the reach tools'
arguments (§123). P5, CRLF copies (§120–123). P7, the next-step box.
P8, the pass's cost a line swinging with reach. P10, a ROADMAP section
at its cap (§123). P11, `comment-length` reading folders under the repo
only (§122–124; its note stays until TODO §127's fix). P14, an Edit
anchor off whole lines (§124–124.5; CLAUDE.md "Editing"). P18, a bare
`ui.css` sending a grep to `src/` (124.5h).

**First instances**, watch for a second: a `node -e` given a Git Bash path
(it needs `C:/`); a doc's rule wider than Matthew's intent (`2d6369d9`);
`refs --members` reading interfaces only (124.5b); a brief's wording
wider than a Cursor rule (§124.5); a call put without a lean (§125's
call 6); non-ASCII in a script's argument
mangled on Windows (125e); a finding for the next phase written only in a
session report (§125 s3; TODO §126 has it); `plant --list`'s numbering
against `--nth`'s (126d; P4's cousin); a verdict word read without its
detail, the plant tool's CAUGHT for a run stopped at its limit (126e,
caught before writing); a signed plant swapped for another of its shape,
flagged (126e's plant A); `SendMessage` reporting undelivered a line
that arrived (126m b1); a per-file Git Bash loop over 150 files past
the 2-minute limit, a node script a second (126m); comment lines
repeated word for word defeating a once-only anchor (`Run.test.ts`,
126m b7); a multi-file `sed` in place of an
anchor-checked script, proven by the compiler (126j); a quote of
Matthew's in this file read out of its context by a working session
(s3's report: "over-prompting" read as about questions).

## Notes ledger

Credited: a session's record names the note as the reason for an action,
or a pattern with two or more earlier instances stops after it.

| Note | Briefs | Credited |
|---|---|---|
| `--record` before the suite | §124 1, 2, 7; §124.5 1–8; §125 1–3; §126 1–4 | yes; missed once at 125e; quiet since |
| `comment-length`'s form | §124 1, 3–7; §124.5 1–8; §125 1–3; §126 1–4 | yes; 125k measured copies under `output/` |
| entries by the Write tool, messages by `-F` | §124 5–7; §124.5 1–8; §125 1–3; §126 1–4 | yes, but for 124.5h b6; kept though AGENTS says it (Matthew signed, 2026-10-19) |
| the comment tools' marker and `held-compare` | §124.5 1–8; §125 1–3; §126 1–4 (as not needed) | yes in §124.5 and 125k |
| other shapes and every caller; test files; a gotcha to its end | §124.5 3–8; §125 1–3; §126 1–4 | yes: 125g; 126e's step zero; s3's compiler as a second search surface |
| no Bash call opening with a stdin reader | §124.5 6–8; §125 1–3; §126 1–4 | yes; quiet through §126 s3 |
| the tools' `npm run oracle --` form | §124.5 7, 8; §125 1–3; §126 1–4 | yes; "pointed at everything" (§125 s3, §126 s1) |
| the comment pass's four WORKLOG headings (P16) | §126 1–4 | yes: s4 ("saved the search") |
| a count's file list, `:(glob)` (P21) | §126 3, 4 | quiet in s3, s4 |
| 550k bars a step's start only (P20) | §124.5 7; §125 1–3; §126 4 | followed in s4, but its wording gave no margin (s4's `distress`) |

**Dropped** (briefs and credit at `9c886b50`): the docs searched for what
a deletion removes; where the procedures are; `refs --members`; a
step-code-shaped file name; the tools split `.css`; whole-line Edits
(CLAUDE.md "Editing"); at §125, `ui.css`'s path and a class's stem, and
the first turn's open items; at §126 brief 4, the plant tool's
numbering (briefs 2, 3; the cut names no plant in 126m–126o).

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
