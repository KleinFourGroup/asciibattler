# DRIVER-HANDOFF

The phase driver's live state ([process/driving.md](process/driving.md)
says what a driver is and does). A driver rewrites this at each hand-off
read and commits it when no session is working; it is not appended to, and
git is its history. Started 2026-10-19 from the close state of §124's
driver log ([archive/driver-trial/log-124.md](archive/driver-trial/log-124.md)).

## Cursor

- **Phase:** **§126, tests: 126a–126d built**, the cut signed with five
  calls and 126c's decision point signed (every class kept, A-43 and A-44
  deleted). Session 1, `local_4adec7aa…` (314e1038), from brief 1: the
  kickoff to 126d, 101,090 → 425,583, every reading matching its
  transcript; its hand-off at `f68be964` (WORKLOG §126, "The hand-off
  after 126d"). **Next: 126e, the loops**, from brief 2, proposed as a
  card at this file's commit. §125's sessions are in WORKLOG §125 and in
  this file at `f599778c`.
- **Driver:** driver 4,
  `local_e1ae5cfd-6e02-4822-8e2b-241eca97267e` (scratchpad 70e12103), a
  top-level session Matthew started 2026-10-21 12:28 UTC; first reading
  115,477. Driver 3, §125's, was `local_4c64446d…` (33d012d0).
- **Friction read through:** line 314 of `retro/papercuts.jsonl` (313 is
  session 1's, the plant tool's numbering; 314 is driver 4's, P22).
- **Brief 2's notes:** the oracle tools' forms, `--record` before any run
  of the suite (P1), and the plant tool's numbering (126d's papercut);
  Write or Edit, `-F`, no stdin reader (P2); other shapes and every
  caller, with the loops written `for (;;)` that the audit's 54 `while (`
  lines miss, named by file and line (P15, P3); should the session reach
  126m, the comment pass's four WORKLOG headings (P16), `comment-length`
  on copies (P11) and `held-compare` not needed (P13). Not noted: P20
  (planning.md says it) and P21 (AGENTS "A filtered result is not the
  result").
- **Matthew's calls standing:** P2's guard: not yet ("a few more
  observations are needed to justify a guard"), so its note stays. P6's
  and P12's notes stay dropped. P17's wording for open reads, kept here
  and not copied into briefs (signed 2026-10-20): "Open `batch` reads:
  list them with their scripts in your first message, then start the
  next batch. A `batch` read blocks nothing." Over-prompting:
  subtraction, in `process/driving.md` (`0a9e89ea`). Held: a coarse plant
  at the cut for a bar that names an instrument's catch ("pending a
  little bit more data"); driver 3's lean after his question whether it
  generalizes: drop it unless a cut misses the oracles.md rule again.

## Patterns

Numbered from §123. "Quiet" means no instance in the last phase.

| # | Pattern | Instances | Status |
|---|---|---|---|
| P2 | shell: a heredoc refused, a backslash lost, a stray stdin reader opening a command | 122n, 122o, 123g, 123m b2, 124f, 124j b5; 124.5h b6, b7 | open; quiet in §125 under the note; no guard yet (Matthew, 2026-10-20) |
| P3 | a number or claim written ahead of its read | §123 (7 sessions), §124 (6), §124.5 (3); §125: three found later (125e, 125g, 125h), each back to Matthew, and two caught before landing; §126 session 1, three caught before landing (126b's census draft) | open; TODO §127's readings guard; until then `readings-check.mjs`, which matched every reading of §125's three sessions |
| P6 | a change leaves a doc naming what it removed | 123e, 123's L-1 patch, the load fix; 124.5h b12; driver 2's `a0ce0c79`; §126's charter naming A-25's tests after 125f took the last (one search at the kickoff; in the report, not named a repeat) | open; no guard (Matthew, 2026-10-19) |
| P9 | a false claim's twin found a batch later | §122 b4, 123m b1 and 4a, 124j b1–b5 and b7; §125's close (ARCHITECTURE's bot row, batch 1's fork order, by the close's pointer search) | open; the pass finds most twins in the batch (124.5h five, 125k b1 one) |
| P12 | a `cd` in a Bash command moves the session's working directory | §124; §124.5 twice | open; quiet in §125; the note stays dropped (Matthew, 2026-10-20) |
| P13 | `comment-strip` exits 1 on a reworded `TOOL_READ` marker, and the file's code is then unproven | 124j b5, 124j-post2, 124.5h b3 | a TODO §127 row; the note stays until it lands; quiet in §125 (no markers in `src/bot`) |
| P14 | an Edit anchor off whole lines: across a break it misses; ending mid-line it glues the line's rest on, reporting success | §124, 124.5f, 124.5h b4, b10–12 | open; quiet in §125; CLAUDE.md "Editing", so no note |
| P15 | a count by a rule's or a name's written form misses a copy written another way | 122h, 124.5f's bar item 4, 124.5c's A-26 count; §126's kickoff: the loops as 54 `while (` lines (T-90's form), missing `for (;;)` in two test files, `encounter-loop.test.ts:49` unbounded on its `promotion` branch (found by driver 4; the first under its note) | open; brief 2 names the misses; a second miss under the note makes it a guard candidate |
| P16 | a procedure, or its data, findable only in old WORKLOG entries or an unnamed scratch folder | §124.5 sessions 1, 2, 6; §125 sessions 2 (planting on an uncommitted trial, now only in its hand-off entry) and 3 (the comment pass's rules in four entries, about 20k to find); §126 session 1 (120e's per-file runner, found by listing `scratch/120e/`: the census names the method, not the file) | in the HANDOFF Cursor's "Carried to the Round 8.5 close" |
| P17 | the driver: Matthew answers an open item in the old session after its hand-off, and the waiting card's brief goes stale | §124.5 after sessions 1, 2 and 7; §125 after session 1 (call 6, restated in brief 2 against driving.md's rule; driver 3's slip) | driving.md leaves open items in the Cursor, unrestated (signed 2026-10-20) |
| P18 | the charter's bare `ui.css` sends a grep to `src/ui.css` | 124.5h b3–4, b7 | quiet in §125 (no CSS) |
| P19 | the silent-turn reminder every few calls through long checks | every §124.5 session's report; its session 6's `distress` line; §125 session 3 ("came often", status lines, no pull) | open, for the welfare read; CLAUDE.md "The silent-turn reminder"; the Cursor's riders (1), (3) |
| P20 | a session hands off early, bounding the next step's end (not its start) by 550k | §124.5 sessions 3, 5, 6; §125 sessions 1 (524k) and 2 (463k) | call 6 (`3fb2e0d6`), planning.md "the room to the halt" (`cb44065b`); held since: §125 session 3; §126 session 1, which at 126c's stop forecast the stretch against the halt and Matthew chose |
| P21 | an absence read from a shell search's filtered or truncated output | 124j b6 (`grep -rn --include`; the tool fact below); §125 session 3 (`git grep` piped to `head -3` made `CoverageObjectiveDriver` look deleted; filed, caught, not named a repeat) | open; AGENTS "A filtered result is not the result" says it; no note yet |
| P22 | a doc cap tripped by a first wording (P10's cousin) | BALANCE's header (125e); driver 4's read of §126 session 1 (filed) | open; one hook run each |

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
wording wider than a Cursor rule (brief 6, §124.5); a planned file
generated from another (`src/fonts.css`); a commit subject's count read
two ways (`f902bcff`); a call put without a lean, which "signing all of
your leans" did not cover (§125's call 6); non-ASCII in a script's
argument mangled on Windows (125e); a finding for the next phase
written only in a session report (§125 session 3's 686 step codes in
test titles; TODO §126 now has it); `plant --list`'s numbering against
`--nth`'s (126d's papercut; P4's cousin); turns ended mid-stretch with a
status line while a background run went on (126b, twice); the plants'
worktree rule read by its reason, a planted test file under
`scratch/126b/` (both in session 1's report).

## Notes ledger

Credited: a session's record names the note as the reason for an action,
or a pattern with two or more earlier instances stops after it.

| Note | Briefs | Credited |
|---|---|---|
| `--record` before the suite | §124 1, 2, 7; §124.5 1–8; §125 1–3; §126 1, 2 | yes; missed once at 125e (a reach run), named in briefs 2–3; quiet since (126a recorded first) |
| `comment-length`'s form | §124 1, 3–7; §124.5 1–8; §125 1–3; §126 1, 2 (should it reach 126m) | yes; 125k measured copies under `output/` |
| entries by the Write tool, messages by `-F` | §124 5–7; §124.5 1–8; §125 1–3; §126 1, 2 | yes, but for 124.5h b6; kept though AGENTS says it (Matthew signed, 2026-10-19) |
| the comment tools' marker and `held-compare` | §124.5 1–8; §125 1–3; §126 1, 2 (as not needed) | yes in §124.5; 125k's plan checked `src/bot` holds no marker |
| other shapes and every caller; test files; a gotcha to its end | §124.5 3–8; §125 1–3; §126 1 (with shared test helpers), 2 (with the `for (;;)` loops named) | yes; brief 1 named folders, not test files; from brief 2, session 2 credits it with 125g's catch; §126's kickoff counted loops by one form under it (P15) |
| no Bash call opening with a stdin reader | §124.5 6–8; §125 1–3; §126 1, 2 | yes; quiet through §126 session 1 |
| the tools' `npm run oracle --` form | §124.5 7, 8; §125 1–3; §126 1, 2 | yes; §125 session 3 and §126 session 1: the notes "pointed at everything" |
| the comment pass's rules in four WORKLOG headings (P16) | §126 1, 2 (should it reach 126m) | not yet: 126m not reached |
| the plant tool's numbering | §126 2 | |

**Dropped** (briefs and credit at `9c886b50`): the docs searched for what
a deletion removes; where the procedures are; `refs --members`; a
step-code-shaped file name; the tools split `.css`; whole-line Edits
(CLAUDE.md "Editing"); at §125, with no CSS in it, `ui.css`'s path and a
class's stem, and the first turn's open items, none open at a kickoff;
at §126, the hand-off forecast (P20; briefs §124.5 7, §125 1–3; credited:
call 6, then planning.md since `cb44065b`).

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
- A hand-off read with its proposal cost driver 3 about 45–60k in §125
  (from 107k first; the close at 306k), so a driver from a fresh start
  has about five reads to the 350k line.
