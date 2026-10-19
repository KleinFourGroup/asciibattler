# DRIVER-HANDOFF

The phase driver's live state ([process/driving.md](process/driving.md)
says what a driver is and does). A driver rewrites this at each hand-off
read and commits it when no session is working; it is not appended to, and
git is its history. Started 2026-10-19 from the close state of §124's
driver log ([archive/driver-trial/log-124.md](archive/driver-trial/log-124.md)).

## Cursor

- **Phase:** **§124.5, the screens** (ROADMAP §124.5), driven from
  2026-10-19. Session 1 (8fb7e4a9) ran the kickoff and 124.5a to 124.5f
  and handed off at `009fd1fa` (WORKLOG §124.5, "The hand-off after
  124.5f"); read 17:25 UTC. 124.5e read by Matthew in session 1 after
  the hand-off (`cded409f`), so no ◐ is open. Next: session 2, from
  124.5g, the re-skim (a stop); its card was proposed again without the
  read. Open for Matthew: the `damageStat` row the re-skim puts.
- **Driver:** `local_3addf3c2-a6af-469e-a40b-932696f5bc61` (scratchpad
  id 9b60fb27), the first under `process/driving.md`.
- **Friction read through:** line 287 of `retro/papercuts.jsonl`
  (8fb7e4a9, 2026-10-19 17:18 UTC).
- **Notes in the latest brief** (§124.5 session 2):
  - for any deletion step, `comment-codes --record` before the first
    suite run, and a search of the docs for what the deletion removes
    (P1, P6);
  - the comment tools: `comment-length` on copies under `output/`, one
    folder a call (P11); `comment-strip` exits 1 on a reworded `i18n-ok`
    marker by design, and the hook's green is the proof (P13); a
    step-code-shaped file name in a comment reads as a code to `--record`;
  - entries by the Write or Edit tool, commit messages by `git commit -F`
    (P2);
  - no commit in the same message as the Edits it commits (P14);
  - where the procedures are: `reach-diff` in WORKLOG §121 "121b-pre",
    the seed-7 drive in "The hand-off after 124f", session 1's tools in
    "The hand-off after 124.5f"; `refs --members` reads interfaces and
    type literals only.
- **Matthew's open calls:** P14's fix, a note now (CLAUDE.md "Editing"
  says the hook catches anything that slips, which a doc Edit belies).

## Patterns

Numbered from §123. "Quiet" means no instance in the last phase.

| # | Pattern | Instances | Status |
|---|---|---|---|
| P1 | the step-code ceiling fails the first suite run after a deletion | 122b, 122g, 123b, 123d | quiet in §124 and 124.5a–f, the note held; keep the note for deletions |
| P2 | shell: a quoted heredoc refused, a backslash lost | 122n, 122o, 123g, 123m b2, 124f, 124j b5 | quiet after the Write-tool note; the round close's shell audit (HANDOFF Cursor) |
| P3 | a number or claim written ahead of its read | §123 sessions 1–7; 124d, 124e and 124h (typed readings), 124h's numstat, 124i, 124j b4, b5 (47 as "48, full"), b6 (an empty grep read as an absence); 124.5's kickoff (the read script's `molotov`, caught at 124.5e's step zero) | open; TODO §127's readings guard; until then `readings-check.mjs` (tool facts) |
| P4 | the reach tools' arguments (`npm-test` against `suite`; files, not folders) | §123 sessions 1–3 | quiet in §124 |
| P5 | working copies holding CRLF | 120a, §122, 123's load fix | quiet in §124 |
| P6 | a change leaves a doc naming what it removed | 123e, 123's L-1 patch, the load fix | quiet in §124 and 124.5a–f; no guard (Matthew, 2026-10-19), the note stays |
| P9 | a false claim's twin found a batch later | §122 b4, 123m b1 and 4a, 124j b1–b5 and b7 | open; search for the twin by its shortest token, docs included |
| P10 | a ROADMAP phase section at its 85-line cap | §123 sessions 6, 7 | quiet in §124 |
| P11 | `comment-length` takes folders under the repo only | §122, 123n, §124 sessions 2 and 6 | open; the fix is in TODO §127; keep the note |
| P13 | `comment-strip` exits 1 on a reworded `TOOL_READ` marker | 124j b5, 124j-post2 (`fontSubset.ts`'s `i18n-ok-file`) | open; no guard (Matthew, 2026-10-19), the note stays |
| P14 | an Edit anchor across a line break misses, and a commit in the same message runs anyway | §124 (a first instance), 124.5f (`c5e0a244` without its entry) | open; flagged and named a repeat; a note from brief 2 |

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
file outside the suite's include, and procedures found only in old
WORKLOG entries (both in §124.5 session 1's report).

## Notes ledger

Credited: a session's record names the note as the reason for an action,
or a pattern with two or more earlier instances stops after it.

| Note | Briefs | Credited |
|---|---|---|
| `--record` before the suite | §124 1, 2, 7; §124.5 1, 2 | yes; P1 quiet through 124.5a–c's deletions |
| search the docs for what a deletion removes | §124 1, 2, 7; §124.5 1, 2 | yes; 124.5a and b searched, `plans/` and ARCHITECTURE corrected |
| `comment-length`'s form | §124 1, 3–7; §124.5 1, 2 | yes; the kickoff ran it a folder a call, `fonts.css` as a copy |
| read a claim's other homes first | §124 2 | yes |
| check a claim at the code it names | §124 3–7 | yes; now in the Cursor's comment-pass line |
| a twin searched by its shortest token | §124 4 | yes |
| entries by the Write tool, messages by `-F` | §124 5–7; §124.5 1, 2 | yes; kept though AGENTS says it (Matthew signed, 2026-10-19), since AGENTS said it from `f0e3f150` through P2's slips |
| the `i18n-ok` marker and `comment-strip` | §124.5 1, 2 | not yet; the kickoff re-counted the 13 lines |
| a step-code-shaped file name | §124.5 1, 2 | not yet |
| the Cursor's test count one short | §124.5 1 | dropped; the Cursor reads 3725 at `c5e0a244` |
| no commit beside its Edits | §124.5 2 | not yet |
| where the procedures are | §124.5 2 | not yet |

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
