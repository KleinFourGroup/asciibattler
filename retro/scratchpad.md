# Scratchpad — rolling notes on process, decisions, gotchas

Running notebook of "things worth talking about" — drop short observations here
as you build. **Swept at every round/cluster boundary** by the distillation
ritual (AGENTS.md §"The planning stack"): each entry gets **promoted** (to
AGENTS / GOTCHAS / TESTING / TODO) or **archived** with the round's docs, so
this file holds only undistilled observations from the current round. Keep
entries short; link commits; group by theme.

Prior eras: the MVP→H7 backlog was swept 2026-07-06 (the ritual's first run) →
[archive/retro-scratchpad-mvp-to-h7.md](../archive/retro-scratchpad-mvp-to-h7.md);
the process-audit + Cluster-3 backlog was swept 2026-07-11 (the second run, at
the micro-round kickoff) →
[archive/retro-scratchpad-cluster-3.md](../archive/retro-scratchpad-cluster-3.md);
the MVP-era entries had earlier fed [post-mvp-review.md](post-mvp-review.md).

---

## The micro round (opened 2026-07-11)

*(no entries yet)*

## 57g — background batches survive a harness crash (2026-07-17)

- Claude Code crashed mid-way through the 57g.1 measurement batch. The
  batch — a `run_in_background` Bash child — kept running as an
  orphaned process and completed normally; its stdout kept landing in
  the old session's task output file. Recovery protocol that worked:
  (1) `git status` first — file edits live on disk, not in the
  session; (2) check for orphaned `node` processes BEFORE re-launching
  a "lost" batch (CPU time ≈ wall clock since launch = it never
  stopped); (3) a fresh watcher loop polling for the output artifact
  re-attaches the notification. Determinism made the worst case
  (re-run) a pure time cost — another quiet argument for the
  measurement doctrine.

## §54a — the 45-minute test hang (2026-07-13)

- `World.tick()` NO-OPS once `ended` is set (World.ts ~1022), freezing
  `currentTick`. A test that polls `while (world.currentTick < N)` spins
  FOREVER if anything ends the battle mid-test (killing a team's last
  unit does). Bit 54a for 45 min of wall clock. Rules adopted in the
  test file: (1) never loop on `currentTick` — loop a BOUNDED count of
  steps; (2) assert `world.ended === false` inside the step helper so
  the failure is a red assert, not a hang; (3) crafted worlds keep 2+
  units per team when a test kills one.
- Compounding it: the batch ran via `run_in_background` with no
  timeout, so the hang looked like "still running" instead of failing
  loudly. Long test batches: foreground + explicit `timeout`, or check
  the output file after the expected duration, not on notification
  faith. (The user caught it at 45 min; nothing would have self-
  reported.)
- Also learned: `tests/fuzz/**` is EXCLUDED from the main vitest
  config — harness tests run ONLY under `vitest.fuzz.config.ts`
  (`npm run fuzz:smoke`). A plain `npx vitest run tests/fuzz/x.test.ts`
  reports "No test files found" (exit 1) rather than running it — and
  the pre-commit fuzz trigger does NOT fire for `src/bot/` or
  `tests/fuzz/` paths, so harness-touching commits need a MANUAL
  fuzz:smoke (candidate hook-path addition at the next sweep).

## §54d–g — spot-check discipline (2026-07-13)

- Per-script ATTRIBUTION via explicit script arrays (`trafficScripts:
  [subset]`) pinpointed every regression source this phase (focus-mode
  beeline; reach-4 mage-chasing; unjam-under-fire) — but the 54e
  amendment proved its limit: a 3-cell attribution fix regressed 3
  OTHER cells. Rule adopted: diagnose on the targeted A/B, but every
  fix re-runs the FULL 10-cell board before commit.
- The 54c trace table beat design intuition twice: the human barely
  uses focus-mode (3/197 — their assassination tool is the leashed
  engage), and "artillery" by capability needed reach 6, not 4
  (reach-5 casters are everywhere). Mine the data before hardcoding
  the introspection.

## §56 close (2026-07-16)

- **User feel tests caught TWO bugs the entire gate suite structurally
  could not see** (56e-pre: the mid-window partner re-grab — the chain
  test cleared activeAction at the flip, conflating "flip landed" with
  "window over"; 56e-pre2: the flip-less-swap sprite desync — the render
  layer has no tests BY POLICY). Pattern for test authoring: when an
  action has a WINDOW with an interior boundary (flip), test the state
  BETWEEN boundary and finish, not just before/after. And the eyeball-only
  render policy's cost surfaced as "unreproducible one-glimpse sightings"
  — the TODO reconciliation-sweep (self-heal + dev-warn) is the cheap
  instrument that would convert those into named, logged offsets.
- **Cell boards are volatile at 3-seed granularity under engine changes**
  (the 56e-pre board moved in both directions from a half-window timing
  shift; ~42% of probe seeds flipped outcome). The §55 cell-Goodhart
  doctrine held its second test: probes arbitrate, cells attribute.

## ROADMAP line guards vs a mid-round expansion (2026-07-19, §59)

The §55 reopen grew the round 5→8 phases after the caps were sized, and
the guards have now needed three dated bumps (total 450→500→550→600;
per-phase 60→70 at 59c). User floated suspending the guard or splitting/
early-archiving ROADMAP; both rejected — suspension drops the rot
protection at peak file size, and a split breaks the one-file-one-round
archive ritual + the cross-phase sequencing sections. The dated-bump
mechanism worked as designed each time (cause on record, guard still
armed).

**Proposed for the round-close distillation ritual:** import HANDOFF's
demote-as-you-close rule into ROADMAP — when a phase CLOSES, collapse
its section to a stub (header + one-breath outcome + the checked cut),
since worklog/BALANCE/git already carry the rest. That would make the
caps hold structurally instead of by bump, at the cost of one new legal
mutation kind in the planning stack (AGENTS "Legal ROADMAP mutations").
Weigh at the §60 close; if adopted, re-tighten both caps.
