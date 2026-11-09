# HANDOFF — Post-MVP pickup

A fresh-session orientation for ASCIIbattler. Read this first; then dive into the docs only where they're called out.

## 🧭 Cursor

**The ONE home for live status.** Other docs (and the agent memory) point here instead of restating it; when state changes, this section is the single place that updates.

- **NEXT — ROUND 11 (The roster): §154, the kits: the kickoff's audit at `e05ebb04` and the cut put to the user, awaiting the sign (WORKLOG §154, "The kickoff's audit"); on the sign, 154a's six parity rows go to the box first** ([ROADMAP.md](ROADMAP.md) §154; the spec, [round-11-spec.md](round-11-spec.md)). 151f, the units' lines, lands when the user writes them. **Open ◐:** none.
- **In flight:** nothing on the box since 2026-11-08 (153g's three batches, fetched and the box destroyed).
- **The public build:** `0.3.0` (`273d587d`, tag `v0.3.0`), uploaded to itch.io on 2026-11-04; the uploads before it are in Closed rounds below.
- **Snapshots:** WorldSnapshot **v39** (no player keeps one) · RunSnapshot **v51** (a v50 save, `0.3.0`'s, rejects).
- **Tests:** **3957 main** in 271 files, **587 fuzz:smoke** in 60 files and **1 fuzz:jobs-parity** at `614dcf68` (153g's table, its hook); typecheck clean; the journal corpus, run by hand, 38 tests over 34 journals, recorded at 153e and 38 passed at `a03b871d`.
- **Model id: `claude-opus-5-5`** since 2026-09-22. When yours differs, say so at the next stop; at the user's word, review AGENTS.md against the vendor's current prompting guidance and record the new id (the last review: `archive/post-104-worklog.md`, "The new-model tone audit").
- **Last phase: §153**, power by rarity, its growth key, and the pools, 2026-11-07 → 11-08: power at 1/1/2/3 with its growth key out; act 1's five moved fights tuned and baked, every turn target held on the verify read, two costs under their bands on deploy and kept; the prior table v8 (`archive/worklog-phase-153.md`).

## Current state

- **The MVP → Phase X foundation: COMPLETE** — the MVP (CHECKPOINT 7, Pages-deployed) · A–D (selectors/commands/fuzz/config/scenes · palette+bloom · terrain/walls/LOS · camera/spawn/theming) · E–GP (the stat vocabulary + abilities + leveling + run progression) · H–K (the deckbuilder trial · hit/miss · objectives · statuses) · L (daemons) · M (progression + presentation) · N (the rogue dash + the `1.25 × 1.5` band) · O (typed objectives) · P–R (the UI round) · S–W (the encounter system + sectors + the first boss) · Wb · X (the band re-derivation). World → v25 / Run → v23 across it. Detail: [archive/phase-a-e-worklog.md](archive/phase-a-e-worklog.md) · [archive/phase-e-gp-worklog.md](archive/phase-e-gp-worklog.md) · [archive/post-h-roadmap.md](archive/post-h-roadmap.md) · [archive/post-n-roadmap.md](archive/post-n-roadmap.md) · [archive/post-r-roadmap.md](archive/post-r-roadmap.md) + [BALANCE.md](BALANCE.md). _(The twelve per-phase paragraphs this line replaces are in git at `1ebe188`.)_
- **Clusters 1–5, the three interstitials, Rounds 6–10 and THE CASUALTY EXPERIMENT (Y → §147, → 2026-11-04): COMPLETE, every phase user-signed** — under **Closed rounds** below, a line a round, the first plan's in one; the condensed paragraphs in [archive/closed-rounds.md](archive/closed-rounds.md); per-phase detail in each round's archived roadmap + worklog + spec, git, and [BALANCE.md](BALANCE.md).
- **The game's config:** the frozen config of `d9675b6`, converted at 137c and moved at 139b, act 1 tuned at 146e and again at §153, retuned by taste at §152 (`archive/worklog-phase-152.md`, `archive/worklog-phase-153.md`), under the Escalation ladder (`config/escalation.json`; level 0 is that game). Its board state is BALANCE.md's, the named watches under the hit roll 2026-10-10 §118e's, and the riders TODO's, by round. Tags `pre-casualty-experiment` and `casualty-seams` stay as history: the experiment was kept, so they mark the floor the rule was measured against, not a rollback plan.
- **Tests:** live counts are pinned in the 🧭 Cursor (top of this file); 0 `it.todo()`. One known residual — `recruit:healer` has a single spiralFireLife hang (a damage-starved all-healer team, out of GP5 scope). Fuzz sweep `npm run fuzz` (20 seeds default; `--per-hop` for per-hop analysis; `--layout=procedural` to isolate the M6 maps); the `scored` strategy + `--search` (→ `output/best-strategy.json`) drive the balance tuning. Short / forced / leveled runs: `npm run run-config -- --help` or the GUI at `/tools/run-config/`. **READ [BALANCE.md](BALANCE.md) FIRST for any balance work; [PATHING.md](PATHING.md) for movement-quality work (regenerate its tables with `npm run pathing`).** The per-phase test-count history lives in git log + [archive/post-h-roadmap.md](archive/post-h-roadmap.md).
- **Dev server:** `npm run dev` → http://localhost:5173/ (5174 if 5173 is held by a stale process). The user usually has their own dev server on 5173; agents verifying in Claude Code's Browser pane use the `dev-preview` config and [process/browser-pane.md](process/browser-pane.md), which also covers the `window.__game` dev handle.
- **Build:** `npm run build`. `vite.config.ts` uses `base: './'` so the same `dist/` works at any subpath.
- **Canonical references:** [ARCHITECTURE.md](ARCHITECTURE.md) for the project tree + event/command catalogs; [ROADMAP.md](ROADMAP.md) for forward-looking steps; [GOTCHAS.md](GOTCHAS.md) for the hard-won fixes that look weird without context — don't refactor those without understanding why.

## What's next

**The road to ship is [META-ROADMAP.md](META-ROADMAP.md) v2 (locked 2026-08-21) — ordered rounds, 6 → 25, with 7.5 and 8.5 inserted and the old 9 and 10 re-cut into 9 to 23 at §133.** Clusters 1–5 (the v1 plan, archived at [archive/post-x-meta-roadmap.md](archive/post-x-meta-roadmap.md)) are complete & user-signed (see Closed rounds below); **the live NEXT is pinned in the 🧭 Cursor at the top of this file.** Smaller follow-ups live in [TODO.md](TODO.md); each round's charter, dependencies, decision points, and scope guards live in META-ROADMAP, and its Coverage map says where every carried item landed.

Balance numbers live in `config/*.json` (zod-validated by `src/config/*.ts`) -- edit the JSON and refresh for a Vite hot-reload, no recompile.

## Closed rounds — one line each

One line per round (the 2026-09-09 trim, user-signed), the oldest folded
into the last line when the section passes its cap (planning.md "HANDOFF
upkeep"). The condensed
paragraphs — verbatim, with each round's still-load-bearing facts — are in
[archive/closed-rounds.md](archive/closed-rounds.md) (append-only; a close
appends its paragraph there and its line here). Numbers: [BALANCE.md](BALANCE.md).

- **Round 10 — Act 1, the wilds (§141→147, 2026-10-30 → 11-04)** — the scripted run · the board by act · six eared beasts · act 1, The Periphery · act 1's bands · ⭐ `0.3.0` on itch (2026-11-04) · the backticks guard, the Cursor's hand-off pass; no snapshot bump, no gotcha. [post-140-roadmap](archive/post-140-roadmap.md) · [worklogs](archive/worklog-phase-147.md) · [spec](archive/round-10-spec.md) · [sessions](archive/sessions-round-10.md).
- **Round 9 — The frame and the misses (§134→140, 2026-10-26 → 10-30)** — the act design · the board's guards · the damage trial built and rolled back · every strike lands, precision and evasion out · ⭐ `0.2.0` on itch (2026-10-30) · the stdin guard and the hook on the commit · the `slip` kind; World v39, Run v50, no gotcha. [post-133-roadmap](archive/post-133-roadmap.md) · [worklogs](archive/worklog-phase-140.md) · [spec](archive/round-9-spec.md) · [rules](archive/round-9-rules.md) · [sessions](archive/sessions-round-9.md) · [retro-scratchpad](archive/retro-scratchpad-round-9.md).

- **Round 8.5 — Housekeeping (§119→133 + §124.5, 2026-10-11 → 10-26)** — the oracle map · the census, 162 rows signed · the dials, 34 config files → 28 · deletions per subsystem, byte-identical, each with its comment pass · ⭐ `0.1.1` on itch (2026-10-23) · the dependency phase · the shell-quoting audit · AGENTS as a router to `process/` · the re-cut into Rounds 9 to 25; no snapshot bump, no gotcha. [post-118-roadmap](archive/post-118-roadmap.md) · [-worklog](archive/post-118-worklog.md) · [round-8.5-spec](archive/round-8.5-spec.md) · [census](archive/round-8.5-census.md) · [rules](archive/round-8.5-rules.md) · [sessions](archive/sessions-round-8.5.md) · [retro-scratchpad](archive/retro-scratchpad-round-8.5.md).

- **Round 8 — Foundations (§110→118 + §117.5, §117.75, 2026-09-28 → 10-11)** — the shell spike and the spec · the background recorder · the pane probe kit and the Electron runner · the store and the build ID · the run journal and its export · save/load, with the continuation check and the chaos driver · the menu and settings · Escalation and the unlocks · the UI sweep · the rest gate · ⭐ the itch page OPEN at `0.1.0` (2026-10-10); the close kept the reads doctrine and set the release policy (gotchas #140–141; Run v46→v49). [post-109-roadmap](archive/post-109-roadmap.md) · [-worklog](archive/post-109-worklog.md) · [round-8-spec](archive/round-8-spec.md) · [retro-scratchpad](archive/retro-scratchpad-round-8.md).
- **Round 7.5 — The Board (§105→109, 2026-09-21 → 09-27)** — the projection spike, two passes · ortho · pitch 45 · yaw 45 shipped · the ground mark, drawn by the terrain, as the team channel · the elevation clauses · the anchor rules 17 → 14; the close amended Round 8 (the run journal, the public web channel, the pane probe kit) and kept the reads doctrine (gotcha #139; no bump). [post-104-roadmap](archive/post-104-roadmap.md) · [-worklog](archive/post-104-worklog.md) · [round-7.5-spec](archive/round-7.5-spec.md) · [retro-scratchpad](archive/retro-scratchpad-round-7.5.md).
- **Round 7 — Idioms (§95→104 + §96.5, 2026-09-09 → 09-20)** — the i18n layer · the shells + tokens · the live pool bar · tooltips · color / motion / input / layout accessibility · ⭐ DESIGN §UI idioms SIGNED (§103) · the sound registry; the close re-chartered 7.5 as "The Board", ran the first efficacy + welfare reads, and put the reads doctrine on trial (gotchas #134–138; Run v45→v46). [post-94-roadmap](archive/post-94-roadmap.md) · [-worklog](archive/post-94-worklog.md) · [round-7-spec](archive/round-7-spec.md) · [retro-scratchpad](archive/retro-scratchpad-round-7.md).
- **THE CASUALTY EXPERIMENT (§89→94, 2026-09-02 → 09-08)** — the seam floor · the casualty rule KEPT at the pre-registered ⛔ (§93) · the rebalance (pool max 40) · the encounter list + the sheet re-anchored and SIGNED (94h) · the config FROZEN at `d9675b6` · the ARM's dead DP tail deleted (gotchas #131–132). [post-88-roadmap](archive/post-88-roadmap.md) · [-worklog](archive/post-88-worklog.md) · [encounter-feel-spec](archive/encounter-feel-spec.md) · [retro-scratchpad](archive/retro-scratchpad-casualty-experiment.md).
- **Round 6 — Instruments (§84→88, 2026-08-22 → 09-02)** — the long-horizon shadow · the fold (λ=0.5 SIGNED into the ARM) · the perf pass + the FAIL-CLOSED board · roster realism · the rarity protocol + the derived-artifact tripwire (gotchas #126–128). [post-83-roadmap](archive/post-83-roadmap.md) · [-worklog](archive/post-83-worklog.md) · [round-6-spec](archive/round-6-spec.md) · [retro-scratchpad](archive/retro-scratchpad-round-6.md).
- **The first plan: Clusters 1–5 and three interstitials (Y→§83, → 2026-08-21)** — Cluster 1, Combat Depth · Cluster 2, Spatial & Movement · the Pathfinding Audit round · Cluster 3, Economy · the micro/balance-realism round · Cluster 4, Drafting & Identity · the rollout-arbitration interstitial · Cluster 5, Map Content. A paragraph each, with its archived roadmap, worklog and spec, in [archive/closed-rounds.md](archive/closed-rounds.md); the plan is [archive/post-x-meta-roadmap.md](archive/post-x-meta-roadmap.md).

## How we collaborate

The norms are in **[AGENTS.md](AGENTS.md)** (shared by every harness) and
**[CLAUDE.md](CLAUDE.md)** (Claude Code specifics); procedures used on a
trigger are in [process/](process/). See also [TESTING.md](TESTING.md) and
[retro/](retro/).

## Things that bit us — DON'T re-litigate

The hard-won fixes that look weird out of context now live in their own file:
**[GOTCHAS.md](GOTCHAS.md)**. Referenced across the docs as "gotcha #N" (numbering
is permanent; retired ones stay as tombstones). Don't "clean up" anything on that
list without understanding why it exists.

## Browser-verify tips

Moved to [process/browser-pane.md](process/browser-pane.md) on 2026-09-23;
they are specific to Claude Code's Browser pane.

## Project shape

The canonical annotated source tree is in **[ARCHITECTURE.md](ARCHITECTURE.md)**
("Top-level structure") — one copy, kept current there instead of
hand-mirrored across three docs (which is how the snapshot-version + retired-file
drift crept in). ARCHITECTURE also carries the event + command catalogs.

## Pre-flight, pre-commit & toolchain

Pre-flight, for a fresh clone or a check of the tree before work starts:

```bash
git config core.hooksPath .githooks   # once per clone: activates the pre-commit gate
git log --oneline -5
npm test
npm run typecheck
```

The gate itself is in **[AGENTS.md](AGENTS.md)** "Pre-commit"; the
toolchain's versions are in `package.json`. The versioned pre-commit hook runs `npm run typecheck` and
`npm test`, plus `npm run fuzz:smoke` when sim/run/core/config paths are staged,
and only the tests that read docs when docs alone are staged, each on a copy of the staged files when the
working tree holds anything the commit does not (`scripts/commit-copy.mjs`).

## Existing memories

The agent memory lives outside the repo, on one machine. Since 2026-09-23 it
holds only pointers back to these docs plus machine-local facts; anything a
session on another machine (or in another harness) needs is in the repo.
