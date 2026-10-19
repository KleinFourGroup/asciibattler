# DRIVER-HANDOFF

The phase driver's live state ([process/driving.md](process/driving.md)
says what a driver is and does). A driver rewrites this at each hand-off
read and commits it when no session is working; it is not appended to, and
git is its history. Started 2026-10-19 from the close state of §124's
driver log ([archive/driver-trial/log-124.md](archive/driver-trial/log-124.md)).

## Cursor

- **Phase:** **§124.5, the screens** (ROADMAP §124.5), driven from
  2026-10-19. Session 1 (8fb7e4a9): the kickoff and 124.5a to 124.5f,
  hand-off `009fd1fa`. Session 2 (ff99ffb0): 124.5g, the re-skim, its
  three posts (R-1 to R-3) and 124.5h's plan and batches 1 and 2 of 12,
  hand-off `93711c80` (WORKLOG §124.5, "The hand-off after 124.5h's batch
  2"); read 18:55 UTC. Batches 1 and 2 read by Matthew in session 2
  after the hand-off (`cf3aac67`), so no read is open. Next: session 3,
  from batch 3; its card was proposed again after this commit.
- **Driver:** `local_3addf3c2-a6af-469e-a40b-932696f5bc61` (scratchpad
  id 9b60fb27), the first under `process/driving.md`.
- **Friction read through:** line 290 of `retro/papercuts.jsonl` (the
  driver's own, P17, 2026-10-19 20:47 UTC; line 289 was ff99ffb0's).
- **Notes in the latest brief** (§124.5 session 3):
  - the comment tools: `comment-codes --record` before each batch's suite
    run (P1); `comment-length` on copies under `output/`, one folder a
    call (P11); `comment-strip` exits 1 on a reworded `i18n-ok` marker by
    design, and the hook's green is the proof (P13); a step-code-shaped
    file name in a comment reads as a code to `--record`;
  - entries by the Write or Edit tool, commit messages by `git commit -F`
    (P2);
  - no commit in the same message as the Edits it commits (P14);
  - a claim checked by search searches the rule's other shapes (negated,
    split), and a gotcha read for a claim is read to its end (P15, P3).
- **Matthew's open calls:** P14's fix, a note now (CLAUDE.md "Editing"
  says the hook catches anything that slips, which a doc Edit belies);
  P16's fix, a home in `process/` for the procedures sessions find only
  in old entries.

## Patterns

Numbered from §123. "Quiet" means no instance in the last phase.

| # | Pattern | Instances | Status |
|---|---|---|---|
| P1 | the step-code ceiling fails the first suite run after a deletion | 122b, 122g, 123b, 123d | quiet in §124 and 124.5a–f, the note held; keep the note for deletions |
| P2 | shell: a quoted heredoc refused, a backslash lost | 122n, 122o, 123g, 123m b2, 124f, 124j b5 | quiet after the Write-tool note; the round close's shell audit (HANDOFF Cursor) |
| P3 | a number or claim written ahead of its read | §123 sessions 1–7; 124d, 124e and 124h (typed readings), 124h's numstat, 124i, 124j b4, b5 (47 as "48, full"), b6 (an empty grep read as an absence); 124.5's kickoff (the read script's `molotov`, caught at 124.5e's step zero); 124.5g (gotcha #114's cycle, from its first paragraph, caught at post3) | open; TODO §127's readings guard; until then `readings-check.mjs` (tool facts) |
| P4 | the reach tools' arguments (`npm-test` against `suite`; files, not folders) | §123 sessions 1–3 | quiet in §124 |
| P5 | working copies holding CRLF | 120a, §122, 123's load fix | quiet in §124 |
| P6 | a change leaves a doc naming what it removed | 123e, 123's L-1 patch, the load fix | quiet in §124 and 124.5a–f; no guard (Matthew, 2026-10-19), the note stays |
| P9 | a false claim's twin found a batch later | §122 b4, 123m b1 and 4a, 124j b1–b5 and b7 | open; search for the twin by its shortest token, docs included |
| P10 | a ROADMAP phase section at its 85-line cap | §123 sessions 6, 7 | quiet in §124 |
| P11 | `comment-length` takes folders under the repo only | §122, 123n, §124 sessions 2 and 6 | open; the fix is in TODO §127; keep the note |
| P13 | `comment-strip` exits 1 on a reworded `TOOL_READ` marker | 124j b5, 124j-post2 (`fontSubset.ts`'s `i18n-ok-file`) | open; no guard (Matthew, 2026-10-19), the note stays |
| P14 | an Edit anchor across a line break misses, and a commit in the same message runs anyway | §124 (a first instance), 124.5f (`c5e0a244` without its entry) | open; quiet in session 2 under the note; CLAUDE.md's line is Matthew's call |
| P15 | a rule's sites counted by its written form miss a copy written another way | 122h ("a third copy"), 124.5f's bar item 4 (both found at 124.5g: the renderer's negated copy) | open; found, flagged and named by the session; a note from brief 3 |
| P17 | the driver: Matthew reads an open item in the old session after its hand-off, and the waiting card's brief goes stale | after sessions 1 (124.5e) and 2 (batches 1 and 2); two cards withdrawn and proposed again | open; a brief now words its open reads "unless the Cursor shows them read" |
| P16 | a procedure, or its data, findable only in old WORKLOG entries or an unnamed scratch folder | §124.5 session 1 (reach, the drive), session 2 (the re-skim's run, the profile in `scratch/120f/`) | open; a note held the first; a home in `process/` is Matthew's call |

**Closed:** P7, the next-step box against CLAUDE.md "What the user sees"
(§123–§124; closed by CLAUDE.md's bullet, `34304126`). P8, the comment
pass's cost a line swinging with reach (§122–§124; the Cursor carries the
range). P12, a `cd` despite the note (§124, five sessions and a driver;
harmless; a hook declined and the note dropped at Matthew's word; once
more in §124.5 session 1, harmless).

**First instances**, watch for a second: a `node -e` given a Git Bash path
(it needs `C:/`); a doc's rule wider than Matthew's intent (the itch
address, fixed in `2d6369d9`); `refs --members` reading interfaces only,
so class members took a word search (124.5b); a probe written as a Vitest
file outside the suite's include (§124.5 session 1's report); a WORKLOG
heading repeating an older one's name (session 2's report).

## Notes ledger

Credited: a session's record names the note as the reason for an action,
or a pattern with two or more earlier instances stops after it.

| Note | Briefs | Credited |
|---|---|---|
| `--record` before the suite | §124 1, 2, 7; §124.5 1–3 | yes; P1 quiet through 124.5a–c and R-3; session 2's report names it |
| search the docs for what a deletion removes | §124 1, 2, 7; §124.5 1, 2 | yes; 124.5a and b searched, R-3 corrected GOTCHAS; out of brief 3 (no deletion in the pass) |
| `comment-length`'s form | §124 1, 3–7; §124.5 1–3 | yes; the kickoff ran it a folder a call, `fonts.css` as a copy |
| read a claim's other homes first | §124 2 | yes |
| check a claim at the code it names | §124 3–7 | yes; now in the Cursor's comment-pass line |
| a twin searched by its shortest token | §124 4 | yes |
| entries by the Write tool, messages by `-F` | §124 5–7; §124.5 1–3 | yes; kept though AGENTS says it (Matthew signed, 2026-10-19), since AGENTS said it from `f0e3f150` through P2's slips |
| the `i18n-ok` marker and `comment-strip` | §124.5 1–3 | partly: session 2's report names it; its batches held no marker |
| a step-code-shaped file name | §124.5 1–3 | not yet |
| the Cursor's test count one short | §124.5 1 | dropped; the Cursor reads 3725 at `c5e0a244` |
| no commit beside its Edits | §124.5 2, 3 | yes; session 2's report names it, and P14 was quiet |
| where the procedures are | §124.5 2 | partly: session 2 still spent reads on the re-skim's (P16); out of brief 3 |
| `refs --members` reads interfaces only | §124.5 2 | not tested; out of brief 3 |
| other shapes in a search; a gotcha to its end | §124.5 3 | not yet |

## Tool facts for this repo

- In Round 8.5, search `src`, `tools` and `tests`: a repo-wide search
  walks `scratch/119f/hidden/`, which a cleaning session doesn't open (the
  HANDOFF Cursor). A doc check names `ARCHITECTURE.md DESIGN.md
  TESTING.md GOTCHAS.md process/*.md plans/*.md`.
- For a search whose empty answer is a claim, use the Grep tool, not a Git
  Bash `grep -rn --include` (124j b6).
- Commit times in `git log` are local (−04:00); the context meter and the
  transcripts are UTC.
- `git show --numstat --format= <commit>` gives a step's added and deleted
  lines by file, to check a line count.
- `node archive/driver-trial/readings-check.mjs <transcript> <untilISO>
  <word> [reading...]` prints a session's text containing a word and
  checks each context reading against the transcript's response totals; a
  planted 123,457 must miss. The transcripts are
  `~/.claude/projects/C--Users-mkilg-projects-asciibattler/<id>.jsonl`.
  Until TODO §127's guard.
