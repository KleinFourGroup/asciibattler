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
  hand-off `93711c80`. Session 3 (ebe41cd8): batches 3 and 4, hand-off
  `df90a1c9`. Session 4 (bcd08e32): batches 5 and 6, hand-off
  `c86f79f5`. Session 5 (d8214ecc): batch 7, hand-off `32e20800`
  (WORKLOG §124.5, "The hand-off after 124.5h's batch 7"); read 23:45
  UTC. Next: session 6, from batch 8; its card is proposed after this
  commit. Open for Matthew: batch 7's `batch` read and its two code
  findings (the stars' touch route on two screens; `UnitRarity`'s
  unread re-export).
- **Driver:** `local_3addf3c2-a6af-469e-a40b-932696f5bc61` (scratchpad
  id 9b60fb27), the first under `process/driving.md`.
- **Friction read through:** line 295 of `retro/papercuts.jsonl`
  (d8214ecc, 2026-10-19 23:40 UTC).
- **Notes in the latest brief** (§124.5 session 6; two added: a stray
  stdin reader opening a Bash call, and `ui.css`'s path):
  - the comment tools: `comment-codes --record` before each batch's suite
    run (P1); `comment-length` on copies under `output/`, one folder a
    call (P11); a file whose held (`TOOL_READ`) comment changed is left
    unproven by `comment-strip`'s exit 1, and the literal pin covers
    `SCAN_ROOTS`' markers only, so `scratch/1245h-b3/held-compare.mts`
    is that file's proof (P13, corrected); a step-code-shaped file name
    in a comment reads as a code to `--record`;
  - entries by the Write or Edit tool, and the commit message file by the
    Write tool for `git commit -F`; no Bash call opens with a line that
    reads stdin (P2);
  - Edits anchored on whole lines, read back, and no commit in the same
    message (P14);
  - a claim checked by search searches the rule's other shapes, every
    caller and the whole repo, and a gotcha read for a claim is read to
    its end (P15, P3);
  - `ui.css` is `src/ui/ui.css` (P18).
- **Matthew's open calls:** P2's stdin hang as a guard: a Bash hook that
  refuses a command opening with a stdin reader given no input, with a
  planted case, ahead of the round close's shell audit; P13, revisited:
  the no-guard lean's premise
  missed the unproven file, and folding `held-compare.mts` into
  `comment-strip` would be a TODO §127 row; P14's fix (CLAUDE.md
  "Editing" says the hook catches anything that slips; it caught neither
  shape); P16's fix, a home in `process/` for the procedures sessions
  find only in old entries.

## Patterns

Numbered from §123. "Quiet" means no instance in the last phase.

| # | Pattern | Instances | Status |
|---|---|---|---|
| P1 | the step-code ceiling fails the first suite run after a deletion | 122b, 122g, 123b, 123d | quiet in §124 and 124.5a–f, the note held; keep the note for deletions |
| P2 | shell: a quoted heredoc refused, a backslash lost, a stray stdin reader opening a command | 122n, 122o, 123g, 123m b2, 124f, 124j b5; 124.5h b6 (a stray `cat >` hung a commit 400 s), b7's hand-off (an empty `python3` heredoc hung 120 s; named a repeat) | open; two hangs in two sessions, the second outside the note's words; a note from brief 6 and a guard put to Matthew; the round close's shell audit (HANDOFF Cursor) |
| P3 | a number or claim written ahead of its read | §123 sessions 1–7; 124d, 124e and 124h (typed readings), 124h's numstat, 124i, 124j b4, b5 (47 as "48, full"), b6 (an empty grep read as an absence); 124.5's kickoff (the read script's `molotov`, caught at 124.5e's step zero); 124.5g (gotcha #114's cycle, from its first paragraph, caught at post3); 124.5h b7 ("fourteen" in a subject before counting twenty-one; amended) | open; TODO §127's readings guard; until then `readings-check.mjs` (tool facts) |
| P4 | the reach tools' arguments (`npm-test` against `suite`; files, not folders) | §123 sessions 1–3 | quiet in §124 |
| P5 | working copies holding CRLF | 120a, §122, 123's load fix | quiet in §124 |
| P6 | a change leaves a doc naming what it removed | 123e, 123's L-1 patch, the load fix | quiet in §124 and 124.5a–f; no guard (Matthew, 2026-10-19), the note stays |
| P9 | a false claim's twin found a batch later | §122 b4, 123m b1 and 4a, 124j b1–b5 and b7 | open; search for the twin by its shortest token, docs included |
| P10 | a ROADMAP phase section at its 85-line cap | §123 sessions 6, 7 | quiet in §124 |
| P11 | `comment-length` takes folders under the repo only | §122, 123n, §124 sessions 2 and 6 | open; the fix is in TODO §127; keep the note |
| P13 | `comment-strip` exits 1 on a reworded `TOOL_READ` marker, and the file's code is then unproven | 124j b5, 124j-post2 (`fontSubset.ts`'s `i18n-ok-file`), 124.5h b3 (`literalScan.ts`'s header, outside `SCAN_ROOTS`) | open; no guard signed 2026-10-19 on a premise b3 showed incomplete; revisit put to Matthew |
| P14 | an Edit anchor off whole lines: across a break it misses and a commit in the same message runs anyway; ending mid-line it glues the line's rest on and reports success | §124 (a first instance), 124.5f (`c5e0a244` without its entry), 124.5h b4 (`copyText.ts`, caught on a read-back) | open; the note widened in brief 4; CLAUDE.md's line is Matthew's call |
| P15 | a count by a rule's or a name's written form misses a copy written another way | 122h ("a third copy"), 124.5f's bar item 4 (both found at 124.5g: the renderer's negated copy); 124.5c's A-26 count (`export type { UnitRarity }`, a re-export, found at b7) | open; a note from brief 3, credited in batches 3 to 7 |
| P18 | the charter's bare `ui.css` sends a grep to `src/ui.css` | 124.5h b3–4, b7 | open; a note from brief 6 |
| P17 | the driver: Matthew reads an open item in the old session after its hand-off, and the waiting card's brief goes stale | after sessions 1 (124.5e) and 2 (batches 1 and 2); two cards withdrawn and proposed again | open; a brief now words its open reads "unless the Cursor shows them read", which held at session 4 (batches 3 and 4 read late, the card stood) |
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
heading repeating an older one's name (session 2's report); a commit
amended for its subject's count (b7, unpushed, before anything cited it).

## Notes ledger

Credited: a session's record names the note as the reason for an action,
or a pattern with two or more earlier instances stops after it.

| Note | Briefs | Credited |
|---|---|---|
| `--record` before the suite | §124 1, 2, 7; §124.5 1–6 | yes; P1 quiet through 124.5a–c and R-3; session 2's report names it |
| search the docs for what a deletion removes | §124 1, 2, 7; §124.5 1, 2 | yes; 124.5a and b searched, R-3 corrected GOTCHAS; out of brief 3 (no deletion in the pass) |
| `comment-length`'s form | §124 1, 3–7; §124.5 1–6 | yes; the kickoff ran it a folder a call, `fonts.css` as a copy |
| read a claim's other homes first | §124 2 | yes |
| check a claim at the code it names | §124 3–7 | yes; now in the Cursor's comment-pass line |
| a twin searched by its shortest token | §124 4 | yes |
| entries by the Write tool, messages by `-F` | §124 5–7; §124.5 1–6 | yes until 124.5h b6, whose slip the session named against it; kept though AGENTS says it (Matthew signed, 2026-10-19), since AGENTS said it from `f0e3f150` through P2's slips |
| the `i18n-ok` marker and `comment-strip` | §124.5 1–6 | yes, the exit was expected (b3); but its "the hook's green is the proof" was false for a file outside `SCAN_ROOTS`, so brief 4 names `held-compare.mts` |
| a step-code-shaped file name | §124.5 1–6 | not yet |
| the Cursor's test count one short | §124.5 1 | dropped; the Cursor reads 3725 at `c5e0a244` |
| no commit beside its Edits | §124.5 2–6 | yes for the commit half; widened in brief 4 to whole-line anchors and a read-back; P14 quiet in session 4 |
| where the procedures are | §124.5 2 | partly: session 2 still spent reads on the re-skim's (P16); out of brief 3 |
| `refs --members` reads interfaces only | §124.5 2 | not tested; out of brief 3 |
| other shapes in a search; a gotcha to its end | §124.5 3–6 | yes: batches 3 and 6 record gotchas #80 and #116 "read to its end"; the caller lists checked |
| no Bash call opening with a stdin reader | §124.5 6 | not yet |
| `ui.css` is `src/ui/ui.css` | §124.5 6 | not yet |

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
