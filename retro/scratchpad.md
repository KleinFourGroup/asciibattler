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
