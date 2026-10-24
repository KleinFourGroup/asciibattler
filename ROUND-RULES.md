# ROUND-RULES

Rules the user signed for this round only, read at each session's start.
At the round close each rule is moved to its permanent home or lapses, and
this file moves to `archive/round-N-rules.md` with a fresh one started
from this header ([process/planning.md](process/planning.md), "Round
close"). A rule enters with the date it was signed and a pointer to its
WORKLOG entry.

## Round 8.5

Moved from the HANDOFF Cursor at 132f (signed 2026-10-24, WORKLOG §132).
Each lapses at §133's close; the one rule promoted from this list is
already in `process/measurement.md`.

- **The round's constraints** (META-ROADMAP §Round 8.5, Scope guards):
  deletion first, and reshaping only by trial against a bar written before
  it (the spec's D1 and D2): no behaviour change, no new abstraction, no
  balance number moved, no gotcha undone without its entry read, the
  permanent gates never relaxed. The user signs the census before anything
  is deleted. A deletion in sim, run or config is byte-identical under the
  journal corpus and the fuzz diff (TESTING.md "The oracle map"), or it is
  a change and goes to the user with a board re-run. The save format may
  bump, more than once (resolved 2026-10-11).
- **Step codes** under `src` are 0 in comments and in test titles, held
  by `tests/comment-codes.test.ts`; `tests` and `tools` keep their
  comments and their tests' titles (§125's decision point).
- **A comment change** is made in the seven rules signed at 121i (WORKLOG
  §121, 121i), in sessions on this model with no subagents (signed at
  122n), proven by `comment-strip HEAD src` (or `tests`) with its built-in
  control, which masks a test title's words, and lowered by
  `comment-codes --record` before any suite run. A false claim's twin
  outside the change is corrected with it and flagged, and the drops are
  checked while their files are in context (WORKLOG §124, "The signs after
  batch 7"). The pass cost about 104 tokens a line in §125, 75 in §124.5
  and 84 in §124; 126m's sweep of codes alone 400 to 540 tokens a code,
  and 126n's of titles about 190 to 245.
- **A deletion's proofs,** as §121 ran them: the config dump's diff, the
  corpus, the fuzz diff, a plant at the site, and `reach-diff
  --from=<ref>`, which maps a changed file's lines through its diff.
- **A plant goes in a worktree,** never the live tree, since the user's
  dev server reloads on it (`process/oracles.md`).
- **The `reach` readings** under `output/reach/` for `npm-test` and
  `smoke` are of `d47d1ff3` (Node 26, Vite 8.3.5, Vitest 5; the corpus was
  in both until 130b) and the other three of `a45a7af`; a reading is of
  its toolchain as well as its tree (TESTING.md), so record again before
  quoting one. A `reach` answer for one line is asked again as its
  function's range before it is quoted.
- **`scratch/119f/hidden/` is not opened by a session that cleans the code
  up** (the cold-read probe's answers, run at 119f and 131p).
