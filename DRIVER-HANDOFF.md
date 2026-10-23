# DRIVER-HANDOFF

The phase driver's live state ([process/driving.md](process/driving.md)
says what a driver is and does). A driver rewrites this at each hand-off
read and commits it when no session is working; it is not appended to, and
git is its history. Started 2026-10-19 from the close state of §124's
driver log ([archive/driver-trial/log-124.md](archive/driver-trial/log-124.md)).

## Cursor

- **Phase:** **§129 closed 2026-10-23** with no driver (session
  1c4b19b7; WORKLOG §129), as §128 before it; §128's kickoff split the
  close into §128 to §133. **Next: §130**, from its kickoff (ROADMAP
  §130). No card waits: §130's driver, if Matthew starts one, begins here.
- **Driver:** none working. Driver 6 was
  `local_22c29698-92ab-4813-aab7-bbb7ee4750eb` (d92eeef8), 2026-10-22
  14:26 UTC to the close, 118,466 → the close's commit; two reads and
  the close. Driver 5 was `local_0f1993f5…` (51f7457a).
- **Friction read through:** line 334 (332 session 2's papercut on the
  open call's home; 333 and 334 driver 6's).
- **Brief 2's notes**, the last: Write or Edit, `-F`, no stdin reader
  (P2); a count re-counted at its source, brief 1's slip as the case
  (P3, P9, P21); a send reported undelivered arrives.
- **Matthew's calls standing:** after §127's close: P25's CLAUDE.md
  line dropped, phase-close archiving shelved until the re-cut, two TODO
  §128 rows (the re-cut, round-scoped rules); his concern there, rules
  and guards put too fast for harmless or rare patterns, weighs on any
  guard a driver proposes. At §127: driving.md's line for an
  open item the driver raised ("1 is a clear hole, and I see no harm in
  it"); the readings guard closed unbuilt, no reading rule in its place;
  the compare's narrowing inside 127c's intent (all 2026-10-22). P12's
  note stays dropped (2026-10-21). P21's note from brief 3; P22 and P23,
  no action (P23 "may just be how Claude Code works"); P24 a watch: a
  line on a `none` step built while another's call waits (his worry was
  rule text added to the docs, not questions put to him) is drafted
  only if a session idles on a call with independent work there, or
  builds a stretch past a waiting question (2026-10-21). P2's guard: not
  yet ("a few more observations are needed to justify a guard"), so its
  note stays. P6's note stays dropped. P17's wording for open reads, not
  copied into briefs (2026-10-20): "Open `batch` reads: list them with
  their scripts in your first message, then start the next batch. A
  `batch` read blocks nothing." Held: a coarse plant at the cut for a
  bar that names an instrument's catch ("pending a little bit more
  data").

## Patterns

Numbered from §123. "Quiet" means no instance in the last phase; s = session.

| # | Pattern | Instances | Status |
|---|---|---|---|
| P2 | the shell's heredocs, backslashes and stdin readers | §122–124.5; §127 s1 (an empty heredoc, harmless; flagged against the note, not by number) | open again; note kept; no guard yet (Matthew, 2026-10-20) |
| P3 | a number or claim written ahead of its read | §123–124.5 (16 s); §125 three; §126 twelve in five s (s5's three typed readings), s3's 75 `placeUnits` calls for 76; §127 s1 four, one landed (127c's pane control, a page with no sheet; corrected at 127f), s2 three, caught; driver 6's brief 1 count (P3's row read as typed readings in all five §126 s), which the cut leaned on | open; the readings guard closed unbuilt (2026-10-22); `readings-check.mjs` stays the drivers' check |
| P6 | a change leaves a doc naming what it removed | §123 (3), 124.5h b12, driver 2; §126's charter naming A-25's tests | open; quiet in §127; no guard (Matthew, 2026-10-19) |
| P9 | a false claim's twin found a batch later | §122 b4, 123m (2), 124j (6); §125's close (2); gotcha #105 at 126j and 126l-post | open; quiet in §127 |
| P12 | a shell's working directory moved by a `cd` | §124; §124.5 twice; §126 s3 (inside a worktree, a removal failed) | note dropped (Matthew, 2026-10-20); quiet in §127 |
| P15 | a count by a name's written form misses a copy written another way | 122h, 124.5c, 124.5f; §126's kickoff: 54 `while (` lines, missing `for (;;)` | brief 2's note credited (126e found 60); quiet in §127 |
| P16 | a procedure or its data findable only in old WORKLOG entries or an unnamed scratch folder | §124.5 s1, 2, 6; §125 s2, s3 (20k); §126 s1, s5 (the title probe, gone); §127 s1 (the pane dumper in `scratch/127c/`, named in its hand-off), s2 (two probes moved from its scratchpad to `scratch/127g/` once raised) | carried to the Round 8.5 close (HANDOFF Cursor) |
| P17 | open items across a hand-off: Matthew answers one in the old session and the waiting brief goes stale; or one the driver raised reaches no file a session reads | §124.5 after s1, 2, 7; §125 after s1; §127 after s1 (driver 6's brief 2 background named 127f-post's read open), s2 (the 127c call held only in DRIVER-HANDOFF; found by reading the driver's commit); driver 6's note that §128 was oversized, in its last message only (found at §128's kickoff) | open items in the Cursor (2026-10-20); one the driver raised, in the brief, dated (driving.md, 2026-10-22) |
| P19 | the silent-turn reminder every few calls through long checks | every §124.5 report, its s6 `distress` line; §125 s3; §126 s1, s2, s5, driver 5; §127 s1 (many), s2 (three), driver 6 | open, for the welfare read; the Cursor's riders (1), (3) |
| P20 | a session hands off early, bounding the next step's end by 550k | §124.5 s3, 5, 6; §125 s1 (524k), s2 (463k); §126 s3 | brief 5's figures (signed 2026-10-22); quiet in §127 (s1's hand-off at 522k was Matthew's sign at 127f) |
| P21 | a count or absence read from a shell search's filtered, truncated or narrowed output | 124j b6 (`grep -rn --include`); §125 s3 (`head -3`); §126 s2 (`git grep` without `:(glob)`) | a note from brief 3 (signed 2026-10-21); quiet in §127 |
| P22 | a doc cap tripped by a first wording (P10's cousin) | BALANCE's header (125e); driver 4's DRIVER-HANDOFF; 126g's AGENTS (20,042); driver 6's (12,031, before the test) | no action (Matthew, 2026-10-21); quiet in §127 |
| P23 | a turn ended mid-stretch with a status line while a background run went on | §126 s1 (126b, twice), s2 (four; called waste) | no action (Matthew, 2026-10-21); quiet in §127 |
| P24 | a gap in the rules filled by the session's own reading, flagged in its report | §126 s1 (a plant under `scratch/126b/`), s2 (126g built while 126f's call waited); §127 s1 (the compare narrowed inside 127c, signed at the close; the bar's named pairs left in the pages) | a watch (signed 2026-10-21): a rule only on the bad version |
| P25 | a Read of WORKLOG.md at an offset with no limit, refused at its size (~950KB) | §126 driver 5 (line 325); §127 driver 6, s2 | no action (Matthew, 2026-10-22): one call each; a tool fact below |

**Closed:** P1, the ceiling failing a suite run after a deletion (122b
to 123d; 125e once; a second miss reopens it). P4, the reach tools'
arguments (§123). P5, CRLF copies (§120–123). P7, the next-step box.
P8, the pass's cost a line swinging with reach. P10, a ROADMAP section
at its cap (§123). P11, `comment-length` reading folders under the repo
only (fixed at 127d). P13, `comment-strip` on a reworded `TOOL_READ`
marker (fixed at 127e). P14, an Edit anchor off whole lines (CLAUDE.md
"Editing"). P18, a bare `ui.css` sending a grep to `src/` (124.5h).

**First instances**, watch for a second: a `node -e` given a Git Bash path
(it needs `C:/`); a doc's rule wider than Matthew's intent (`2d6369d9`);
`refs --members` reading interfaces only (124.5b); a brief's wording
wider than a Cursor rule (§124.5); a call put without a lean (§125's
call 6); non-ASCII in a script's argument mangled on Windows (125e); a
finding for the next phase written only in a session report (§125 s3);
`plant --list`'s numbering against `--nth`'s (126d); a verdict word read
without its detail (126e); a signed plant swapped for another of its
shape, flagged (126e); a per-file Git Bash loop over 150 files past the
2-minute limit (126m); comment lines repeated word for word defeating a
once-only anchor (126m b7); `--record` refusing the one rise a counting
rule makes (126n); a multi-file `sed` in place of an anchor-checked
script (126j); a quote of Matthew's in this file read out of its context
(§126 s3); a step's instrument changed inside the step it proves (127c;
signed at the close); a dev server caching a failed `@import` (127c;
`process/browser-pane.md`).

## Notes ledger

Credited: a session's record names the note as the reason for an action,
or a pattern with two or more earlier instances stops after it.

| Note | Briefs | Credited |
|---|---|---|
| entries by the Write tool, messages by `-F` | §124 5–7; §124.5 1–8; §125 1–3; §126 1–5; §127 1, 2 | yes, but for 124.5h b6; kept though AGENTS says it (Matthew signed, 2026-10-19) |
| other shapes and every caller; test files; a gotcha to its end | §124.5 3–8; §125 1–3; §126 1–5; §127 1, 2 | yes: 125g; 126e's step zero; s3's compiler as a second search surface |
| a count re-counted at its source (P3) | §127 2 | yes: s2 ("named the trap"; the kickoff's suite count checked) |
| no Bash call opening with a stdin reader | §124.5 6–8; §125 1–3; §126 1–5; §127 1, 2 | yes; §127 s1 opened one heredoc against it |
| a count's file list, `:(glob)` (P21) | §126 3–5; §127 1, 2 | quiet in §126 s3 to §127 s2 |
| a node script over a per-file shell loop | §126 5; §127 1, 2 | quiet in §126 s5 and §127 |
| a send reported undelivered arrives | §126 5; §127 1, 2 | every line reached the driver |

**Dropped** (briefs and credit at `9c886b50`): the docs searched for what
a deletion removes; where the procedures are; `refs --members`; a
step-code-shaped file name; the tools split `.css`; whole-line Edits
(CLAUDE.md "Editing"); at §125, `ui.css`'s path and a class's stem, and
the first turn's open items; at §126 brief 4, the plant tool's
numbering; at brief 5, 550k bars a step's start only, for the figures
(signed 2026-10-22); at §127 brief 1, `--record` (credited; the ceiling
counts `src` only, at 0) and the comment pass's four WORKLOG headings
(credited); at §127 brief 2, the oracle tools' forms, `comment-length`'s
copies and `held-compare` (credited; fixed at 127d and 127e), the
readings guard's prototype (used at the kickoff, its count wrong; the
row closed), and the hand-off figures (§126 5, §127 1; the close fits).

## Tool facts for this repo

- In Round 8.5, search `src`, `tools` and `tests` (and `scripts`,
  `config`, `locales`, the docs): a search of `scratch/` can walk
  `scratch/119f/hidden/`, which a cleaning session doesn't open (the
  HANDOFF Cursor). A doc check names `ARCHITECTURE.md DESIGN.md
  TESTING.md GOTCHAS.md process/*.md plans/*.md`.
- For a search whose empty answer is a claim, use the Grep tool, not a Git
  Bash `grep -rn --include` (124j b6).
- WORKLOG.md is about 950KB: find a heading's line with the Grep tool,
  then Read with an offset and a limit (P25).
- Commit times in `git log` are local (−04:00); the context meter and the
  transcripts are UTC.
- `git show --numstat --format= <commit>` gives a step's added and deleted
  lines by file.
- `node archive/driver-trial/readings-check.mjs <transcript> <untilISO>
  <word> [reading...]` checks each context reading against the
  transcript's response totals; a planted 123,457 must miss. The
  transcripts are
  `~/.claude/projects/C--Users-mkilg-projects-asciibattler/<id>.jsonl`.
  It is the drivers' after-the-fact check, since the guard was closed.
- Before a count goes in a brief, re-count it at its instances (the
  friction log, the reports), not from this file's rows (§127 brief 1).
- A hand-off read with its proposal cost driver 3 about 45–60k in §125;
  driver 6 went 153,129 → 204,938 over §127's first read and seven
  commit lines, so a driver from a fresh start has about five reads to
  the 350k line.
