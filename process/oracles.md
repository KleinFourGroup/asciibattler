# Oracles and instruments

Read this before claiming that a refactor changes nothing, or before
building a probe or instrument that decisions will rest on. AGENTS.md
"Evidence" holds the short version.

## Behaviour-equivalence refactors

A refactor that claims to change nothing gets a before/after diff oracle,
with the "before" pinned in a worktree.

- Capture baselines at HEAD before the surgery (per-arm fuzz
  `summary.csv`, or `scripts/perf-oracle.sh` output), re-run after, and
  `diff`. Byte-identity across arms is the cheapest strong proof; it
  catches what tests comparing live code to live code can't, because those
  recompute both sides on the new code.
- Pin the baseline checkout with `git worktree add --detach <tmp> HEAD` and a
  `node_modules` junction. Never capture a baseline in the background
  against the live tree: the CLI compiles imports at run time, so edits
  landing underneath it crash the capture or silently poison it.
- **A PASS ships with its failing control.** Run the same shapes under a
  deliberately non-neutral edit; they must FAIL. Otherwise the PASS may be
  a shape that never reached the code you changed.

## Presentation refactors

A CSS or markup refactor gets a stylesheet oracle instead: parse HEAD's
sheet and the working sheet, resolve `var()`, and compare declaration by
declaration (or element by element through a small cascade when selectors
move). Self-check it HEAD against HEAD first, and give it a negative
control. It proves the cascade, not the box: only the browser shows a hit
test or layout change, such as a new wrapper element (gotcha #137).

## Probes and instruments

- **Re-derive the expectation independently.** A probe computes what it
  expects from a surface the code under test doesn't consult: the asset,
  the shader source, the raw CSV. A render probe that computes the expected
  glyph position with the same helper that positioned the glyph can't fail.
  The quick check: if the probe and the code call the same function, it
  measures self-consistency, not correctness.
- **Build the known answer in.** A new reader must reproduce a known
  result exactly before it reads new data. Better, give it a case it must
  catch: a planted defect, a value known to be out of range. A trusted
  negative rests on one of these.
- **Pool with a script that prints its arm count**, never by reading the
  first rows by eye. A table once quoted one arm's rows as "all six arms
  pooled".
- **Recompute a headline metric** independently from the raw rows. It is
  the strongest check an instrument can get.
- **A paired read with zero discordant seeds and byte-identical artifacts**
  usually means the thing you varied never reached the code, not that it
  has no effect.

## Before blaming new code

- Run the same probe, with the same flags, on the old code path first. A
  "new" crash may be a latent bug that already shipped.
- Before diagnosing a gap against a target, pull the measured baseline for
  the same shape. A mechanism story written against a gap nobody measured
  can be elaborate and wrong.
- When you add a new consumer to an old seam, test the seam's edge branches
  under the new consumer, not just its happy path. Branches that nothing
  exercised before can be broken.

## Outside review

For a new instrument that decisions will rest on, ask the user about a
review by a second model (for example Codex, per
[COMMUNICATION.md](../COMMUNICATION.md)). Have a read-only session confirm
each claimed defect at file:line before anyone acts on it, and hand
ownership of a shared, gitignored instrument back and forth explicitly so
nobody overwrites anyone. This is different from having a subagent
re-verify your own work, which current models already do on their own; a
second model's value is a different blind spot.

Claims from a subagent (file:line references, counts) are second-hand
until you've checked them. Say which ones you checked.
