# DRIVER-HANDOFF

The phase driver's live state ([process/driving.md](process/driving.md)
says what a driver is and does). A driver rewrites this at each hand-off
read and commits it when no session is working; it is not appended to, and
git is its history. Started 2026-10-19 from the close state of §124's
driver log ([archive/driver-trial/log-124.md](archive/driver-trial/log-124.md)).

## Cursor

- **Phase:** none being driven. §124 closed 2026-10-18 with two drivers
  (e90c7b67, b390d607). Next: **§124.5, the screens** (ROADMAP §124.5),
  at its kickoff. No card waits and no session is working.
- **Driver:** none. A driver writes its app id here.
- **Friction read through:** line 285 of `retro/papercuts.jsonl` (b390d607
  at §124's close, 2026-10-18 23:27 UTC).
- **Notes for the next brief** (§124's drivers' recommendation; the next
  driver decides):
  - for any deletion step, `comment-codes --record` before the first
    suite run, and a search of the docs for what the deletion removes
    (P1, P6);
  - `comment-length` on copies under `output/`, one folder a call (P11);
  - entries by the Write or Edit tool, commit messages by `git commit -F`
    (P2);
  - a comment holding the `i18n-ok` marker, reworded, makes
    `comment-strip` exit 1 by design; the literal pin in `npm test` is the
    marker's gate, so the hook's green is the proof. §124.5's files hold
    13 marker lines in six files (P13);
  - a file name shaped like a step code, in a comment, reads as a code to
    `comment-codes --record`.
- **Matthew's open calls:** a guard for P13 (driver 2's lean: none, since
  the literal pin already fails a marker that stops working); a guard for
  P6 (never revisited, quiet).

## Patterns

Numbered from §123. "Quiet" means no instance in the last phase.

| # | Pattern | Instances | Status |
|---|---|---|---|
| P1 | the step-code ceiling fails the first suite run after a deletion | 122b, 122g, 123b, 123d | quiet in §124, the note held; keep the note for deletions |
| P2 | shell: a quoted heredoc refused, a backslash lost | 122n, 122o, 123g, 123m b2, 124f, 124j b5 | quiet after the Write-tool note; the round close's shell audit (HANDOFF Cursor) |
| P3 | a number or claim written ahead of its read | §123 sessions 1–7; 124d, 124e and 124h (typed readings), 124h's numstat, 124i, 124j b4, b5 (47 as "48, full"), b6 (an empty grep read as an absence) | open; TODO §127's readings guard; until then `readings-check.mjs` (tool facts) |
| P4 | the reach tools' arguments (`npm-test` against `suite`; files, not folders) | §123 sessions 1–3 | quiet in §124 |
| P5 | working copies holding CRLF | 120a, §122, 123's load fix | quiet in §124 |
| P6 | a change leaves a doc naming what it removed | 123e, 123's L-1 patch, the load fix | quiet in §124, the note held; guard open (cursor) |
| P9 | a false claim's twin found a batch later | §122 b4, 123m b1 and 4a, 124j b1–b5 and b7 | open; search for the twin by its shortest token, docs included |
| P10 | a ROADMAP phase section at its 85-line cap | §123 sessions 6, 7 | quiet in §124 |
| P11 | `comment-length` takes folders under the repo only | §122, 123n, §124 sessions 2 and 6 | open; the fix is in TODO §127; keep the note |
| P13 | `comment-strip` exits 1 on a reworded `TOOL_READ` marker | 124j b5, 124j-post2 (`fontSubset.ts`'s `i18n-ok-file`) | open; guard open (cursor) |

**Closed:** P7, the next-step box against CLAUDE.md "What the user sees"
(§123–§124; closed by CLAUDE.md's bullet, `34304126`). P8, the comment
pass's cost a line swinging with reach (§122–§124; the Cursor carries the
range). P12, a `cd` despite the note (§124, five sessions and a driver;
harmless; a hook declined and the note dropped at Matthew's word).

**First instances**, watch for a second: a `node -e` given a Git Bash path
(it needs `C:/`); an Edit anchor across a line break; a doc's rule wider
than Matthew's intent (the itch address, fixed in `2d6369d9`).

## Notes ledger

Credited: a session's record names the note as the reason for an action,
or a pattern with two or more earlier instances stops after it.

| Note | Briefs | Credited |
|---|---|---|
| `--record` before the suite | §124 1, 2, 7 | yes |
| search the docs for what a deletion removes | §124 1, 2, 7 | yes |
| `comment-length`'s form | §124 1, 3–7 | yes; session 2, whose brief lacked it, lost a call |
| read a claim's other homes first | §124 2 | yes |
| check a claim at the code it names | §124 3–7 | yes; now in the Cursor's comment-pass line |
| a twin searched by its shortest token | §124 4 | yes |
| entries by the Write tool, messages by `-F` | §124 5–7 | yes |
| the next-step box | §124 1, 2 | partly; now CLAUDE.md's bullet |
| no `cd` | §124 1–7 | no; dropped (P12) |

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
