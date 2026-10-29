# HANDOFF — Post-MVP pickup

A fresh-session orientation for ASCIIbattler. Read this first; then dive into the docs only where they're called out.

## 🧭 Cursor

**The ONE home for live status.** Other docs (and the agent memory) point here instead of restating it; when state changes, this section is the single place that updates.

- **NEXT — ROUND 9 (The frame and the misses): §139's kickoff** (the board and the user's play, [ROADMAP.md](ROADMAP.md) §139; its inputs by pointer, [WORKLOG.md](WORKLOG.md) §139, the user's first play among them: the encounters against many mercenaries are much harder now; `process/measurement.md` before any batch). The round's re-cut at §136's close: [round-9-spec.md](round-9-spec.md) "Intent"; the conversion's arithmetic, `archive/worklog-phase-136.md`, "The trial rolled back, and the re-cut". **Open ◐:** none.
- **The public build is `0.1.1`** (`7baa695c`, tagged `v0.1.1`), uploaded to itch.io on 2026-10-23 at §128, after `0.1.0` (`d6a834e`) from 2026-10-10; its number follows the user's version rule (META-ROADMAP §Round 8, "The version"). From itch by 2026-10-23, the user's word: a handful of players and no comments. A stranger's finding rides here, as do the 7.5 close's two watches, frame rate on other machines and the overlay stack; none is recorded yet.
- **Model id: `claude-opus-5-5`** (from `claude-fable-5-1` on 2026-09-22; the tone audit ran 2026-09-23, `archive/post-104-worklog.md` §"The new-model tone audit"). When your model id differs from this one, say so at the next stop, and when the user says, review AGENTS.md against the vendor's current prompting guidance and record the new id.
- **Last phase: §138 ✅ closed 2026-10-29** on the user's sign: the screen after the misses read in play, every surface passed; DESIGN's stat list and Combat paragraph as the game is (ROADMAP §138; `archive/worklog-phase-138.md`). Before it, §137 (every strike lands, headless, `archive/worklog-phase-137.md`) and §136, 2026-10-28.
- **Earlier:** Round 8.5 and everything before it are in Closed rounds below; per-phase detail is in each round's archived roadmap and worklog.
- **In flight: nothing on the box** since 2026-10-10. The tree plays the frozen config of `d9675b6` converted at 137c, with every strike landing (`tests/strike-conversion.test.ts`), under the Escalation ladder (`config/escalation.json`; level 0 is that game); its board state and named watches, read under the hit roll, are BALANCE.md's (2026-10-10 §118e), and the riders TODO's, by round, most under "Round 11".
- **Branch / tree:** `main`. Tag `v0.1.1` is the uploaded build, `v0.1.0` the one before it. Tags `pre-casualty-experiment` and `casualty-seams` stay as history: the experiment was kept, so they mark the floor the rule was measured against, not a rollback plan.
- **Snapshots:** WorldSnapshot **v39** (137c: no precision or evasion; no player keeps one) · RunSnapshot **v50** (137c: the roster's stats without precision and evasion; a v49 save, the uploaded `0.1.1`'s, rejects).
- **Tests:** **3767 main (0 skipped)** in 262 files by the hook at 138b-pre and **553 fuzz:smoke** in 58 files at `66d744a9`, green, on 2026-10-28, and **1 fuzz:jobs-parity** at `d50e23f1`, the same day (Vitest 5.0.5, Node 26; the parity test runs when `tests/fuzz/` is staged and before a `--jobs` batch). The journal corpus is outside both since 130b: 34 tests, run by hand (TESTING.md), re-recorded at 137c. Typecheck clean. The hook takes ~15 s for docs alone (132a), ~45 s for UI, ~3 min when the smoke runs; through its copy of the commit, ~25 s and ~90 s. The tests nearest the default 5 s beside the suite carry 15 s since 126f (`archive/post-118-worklog.md` §126).
- **Last closed: ROUND 8.5 — HOUSEKEEPING** (Phases 119→133, with §124.5; 2026-10-11 → 2026-10-26), each phase closed on the user's read, the close's last step included; see Closed rounds below.

## Current state

- **The MVP → Phase X foundation: COMPLETE** — the MVP (CHECKPOINT 7, Pages-deployed) · A–D (selectors/commands/fuzz/config/scenes · palette+bloom · terrain/walls/LOS · camera/spawn/theming) · E–GP (the stat vocabulary + abilities + leveling + run progression) · H–K (the deckbuilder trial · hit/miss · objectives · statuses) · L (daemons) · M (progression + presentation) · N (the rogue dash + the `1.25 × 1.5` band) · O (typed objectives) · P–R (the UI round) · S–W (the encounter system + sectors + the first boss) · Wb · X (the band re-derivation). World → v25 / Run → v23 across it. Detail: [archive/phase-a-e-worklog.md](archive/phase-a-e-worklog.md) · [archive/phase-e-gp-worklog.md](archive/phase-e-gp-worklog.md) · [archive/post-h-roadmap.md](archive/post-h-roadmap.md) · [archive/post-n-roadmap.md](archive/post-n-roadmap.md) · [archive/post-r-roadmap.md](archive/post-r-roadmap.md) + [BALANCE.md](BALANCE.md). _(The twelve per-phase paragraphs this line replaces are in git at `1ebe188`.)_
- **Clusters 1–5, the three interstitials, Rounds 6–8.5 and THE CASUALTY EXPERIMENT (Y → §133, → 2026-10-26): COMPLETE, every phase user-signed** — one line each under **Closed rounds** below; the condensed paragraphs in [archive/closed-rounds.md](archive/closed-rounds.md); per-phase detail in each round's archived roadmap + worklog + spec, git, and [BALANCE.md](BALANCE.md).
- **Tests:** live counts are pinned in the 🧭 Cursor (top of this file); 0 `it.todo()`. One known residual — `recruit:healer` has a single spiralFireLife hang (a damage-starved all-healer team, out of GP5 scope). Fuzz sweep `npm run fuzz` (20 seeds default; `--per-hop` for per-hop analysis; `--layout=procedural` to isolate the M6 maps); the `scored` strategy + `--search` (→ `output/best-strategy.json`) drive the balance tuning. Short / forced / leveled runs: `npm run run-config -- --help` or the GUI at `/tools/run-config/`. **READ [BALANCE.md](BALANCE.md) FIRST for any balance work; [PATHING.md](PATHING.md) for movement-quality work (regenerate its tables with `npm run pathing`).** The per-phase test-count history lives in git log + [archive/post-h-roadmap.md](archive/post-h-roadmap.md).
- **Dev server:** `npm run dev` → http://localhost:5173/ (5174 if 5173 is held by a stale process). The user usually has their own dev server on 5173; agents verifying in Claude Code's Browser pane use the `dev-preview` config and [process/browser-pane.md](process/browser-pane.md), which also covers the `window.__game` dev handle.
- **Build:** `npm run build`. `vite.config.ts` uses `base: './'` so the same `dist/` works at any subpath.
- **Canonical references:** [ARCHITECTURE.md](ARCHITECTURE.md) for the project tree + event/command catalogs; [ROADMAP.md](ROADMAP.md) for forward-looking steps; [GOTCHAS.md](GOTCHAS.md) for the hard-won fixes that look weird without context — don't refactor those without understanding why.

## What's next

**The road to ship is [META-ROADMAP.md](META-ROADMAP.md) v2 (locked 2026-08-21) — ordered rounds, 6 → 25, with 7.5 and 8.5 inserted and the old 9 and 10 re-cut into 9 to 23 at §133.** Clusters 1–5 (the v1 plan, archived at [archive/post-x-meta-roadmap.md](archive/post-x-meta-roadmap.md)) are complete & user-signed (see Closed rounds below); **the live NEXT is pinned in the 🧭 Cursor at the top of this file.** Smaller follow-ups live in [TODO.md](TODO.md); each round's charter, dependencies, decision points, and scope guards live in META-ROADMAP, and its Coverage map says where every carried item landed.

Balance numbers live in `config/*.json` (zod-validated by `src/config/*.ts`) -- edit the JSON and refresh for a Vite hot-reload, no recompile.

## Closed rounds — one line each

One line per round (the 2026-09-09 trim, user-signed). The condensed
paragraphs — verbatim, with each round's still-load-bearing facts — are in
[archive/closed-rounds.md](archive/closed-rounds.md) (append-only; a close
appends its paragraph there and its line here). Numbers: [BALANCE.md](BALANCE.md).

- **Round 8.5 — Housekeeping (§119→133 + §124.5, 2026-10-11 → 10-26)** — the oracle map · the census, 162 rows signed · the dials, 34 config files → 28 · deletions per subsystem, byte-identical, each with its comment pass (`src`'s step codes 6,376 → 0, its comment words −19 %, 684 code lines fewer) · ⭐ `0.1.1` on itch (2026-10-23) · the dependency phase (Node 26, Vitest 5, Vite 8.3, three 0.186) · the shell-quoting audit · AGENTS as a router to `process/`, with ROUND-RULES · the re-cut of the old Rounds 9 and 10 into Rounds 9 to 23, the old 11 and 12 renumbered 24 and 25; no snapshot bump, no gotcha. [post-118-roadmap](archive/post-118-roadmap.md) · [-worklog](archive/post-118-worklog.md) · [round-8.5-spec](archive/round-8.5-spec.md) · [census](archive/round-8.5-census.md) · [rules](archive/round-8.5-rules.md) · [sessions](archive/sessions-round-8.5.md) · [retro-scratchpad](archive/retro-scratchpad-round-8.5.md).

- **Round 8 — Foundations (§110→118 + §117.5, §117.75, 2026-09-28 → 10-11)** — the shell spike and the spec · the background recorder · the pane probe kit and the Electron runner · the store and the build ID · the run journal and its export · save/load, with the continuation check and the chaos driver · the menu and settings (the colourblind palette, the text size) · Escalation and the unlocks · the UI sweep · the rest gate · ⭐ the itch page OPEN at `0.1.0` (2026-10-10); the close kept the reads doctrine and the probe kit, retired the Shell rule to a list of facts and the Pages site, set the release policy, and put an oracle map first in Round 8.5 (gotchas #140–141; Run v46→v49). [post-109-roadmap](archive/post-109-roadmap.md) · [-worklog](archive/post-109-worklog.md) · [round-8-spec](archive/round-8-spec.md) · [retro-scratchpad](archive/retro-scratchpad-round-8.md).
- **Round 7.5 — The Board (§105→109, 2026-09-21 → 09-27)** — the projection spike, two passes · ortho · pitch 45 · yaw 45 shipped · the ground mark, drawn by the terrain, as the team channel · the elevation clauses · the anchor rules 17 → 14; the close amended Round 8 (the run journal, the public web channel, the pane probe kit) and kept the reads doctrine (gotcha #139; no bump). [post-104-roadmap](archive/post-104-roadmap.md) · [-worklog](archive/post-104-worklog.md) · [round-7.5-spec](archive/round-7.5-spec.md) · [retro-scratchpad](archive/retro-scratchpad-round-7.5.md).
- **Round 7 — Idioms (§95→104 + §96.5, 2026-09-09 → 09-20)** — the i18n layer · the shells + tokens · the live pool bar · tooltips · color / motion / input / layout accessibility · ⭐ DESIGN §UI idioms SIGNED (§103) · the sound registry; the close re-chartered 7.5 as "The Board", ran the first efficacy + welfare reads, and put the reads doctrine on trial (gotchas #134–138; Run v45→v46). [post-94-roadmap](archive/post-94-roadmap.md) · [-worklog](archive/post-94-worklog.md) · [round-7-spec](archive/round-7-spec.md) · [retro-scratchpad](archive/retro-scratchpad-round-7.md).
- **THE CASUALTY EXPERIMENT (§89→94, 2026-09-02 → 09-08)** — the seam floor · the casualty rule KEPT at the pre-registered ⛔ (§93) · the rebalance (pool max 40) · the encounter list + the sheet re-anchored and SIGNED (94h) · the config FROZEN at `d9675b6` · the ARM's dead DP tail deleted (gotchas #131–132). [post-88-roadmap](archive/post-88-roadmap.md) · [-worklog](archive/post-88-worklog.md) · [encounter-feel-spec](archive/encounter-feel-spec.md) · [retro-scratchpad](archive/retro-scratchpad-casualty-experiment.md).
- **Round 6 — Instruments (§84→88, 2026-08-22 → 09-02)** — the long-horizon shadow · the fold (λ=0.5 SIGNED into the ARM) · the perf pass + the FAIL-CLOSED board · roster realism · the rarity protocol + the derived-artifact tripwire (gotchas #126–128). [post-83-roadmap](archive/post-83-roadmap.md) · [-worklog](archive/post-83-worklog.md) · [round-6-spec](archive/round-6-spec.md) · [retro-scratchpad](archive/retro-scratchpad-round-6.md).
- **Cluster 5 — Map Content (§73→83, 2026-08-05 → 08-21)** — events · camps · unit mechanics · the braid map · UI/UX (⭐ DESIGN §Input accessibility) · the glyph anchor fix · the C6 `plans/` docs · procedural parity · the feel round · the closing rebalance (gotchas #122–125; Run v40→v44, World v34→v35). [post-72-roadmap](archive/post-72-roadmap.md) · [-worklog](archive/post-72-worklog.md) · [cluster-5-spec](archive/cluster-5-spec.md) · [retro-scratchpad](archive/retro-scratchpad-cluster-5.md).
- **The rollout-arbitration interstitial (§69→72, 2026-07-29 → 08-04)** — the arbitration substrate · all five decision sites · decision-grade telemetry (⭐⭐ the parity table) · the balance agenda + ⭐⭐ the ARBITRATED DEFAULT arm (gotchas #120–121). [post-68-roadmap](archive/post-68-roadmap.md) · [-worklog](archive/post-68-worklog.md) · [rollout-arbitration-spec](archive/rollout-arbitration-spec.md) · [retro-scratchpad](archive/retro-scratchpad-rollout-arbitration.md).
- **Cluster 4 — Drafting & Identity (§61→68, 2026-07-21 → 07-29)** — rarity · the on-demand box · the three characters · the drafting daemons · the draw/packet dials · boss forewarning · The Deep End · protocol v2 + the §68d/f sheet (⭐ character parity ±5); Run v37→v40. [post-60-roadmap](archive/post-60-roadmap.md) · [-worklog](archive/post-60-worklog.md) · [cluster-4-spec](archive/cluster-4-spec.md).
- **The micro/balance-realism round (§53→60, 2026-07-11 → 07-21)** — the trace recorder + the human gauntlet (~80 %) · the audition searcher · the economy strategy layer · the real balance pass + ⭐ the §60e signed sheet + the extended realistic-bot arm. [post-52-roadmap](archive/post-52-roadmap.md) · [-worklog](archive/post-52-worklog.md) · [micro-round-spec](archive/micro-round-spec.md).
- **Cluster 3 — Economy (§47→52, 2026-07-07 → 07-11)** — the Rule vocabulary keystone · rewards · packets & cache · ports · cohesion; Run v24→v37 / World v32→v34; gotchas #116–118 + #133 (the mint guard). [post-46-roadmap](archive/post-46-roadmap.md) · [-worklog](archive/post-46-worklog.md) · [cluster-3-spec](archive/cluster-3-spec.md).
- **The Pathfinding Audit round (§42→46, 2026-07-04 → 07-06)** — bias fixes · the decision protocol ([positioning.ts](src/sim/positioning.ts) + [WaitAction](src/sim/actions/WaitAction.ts)) · cooperation · the School-2/3 gate = NO; **the standing movement rules (never relax a drift gate · derive-don't-cache · no RNG in movement) live in [PATHING.md](PATHING.md)**. [post-41-roadmap](archive/post-41-roadmap.md).
- **Cluster 2 — Spatial & Movement (§35→41)** — the occupancy core · non-instant moves (gotcha #113) · terrain/palettes · the data-driven `UnitDef` keystone (gotcha #114) · N×N footprints · destructibles (World v32) · the no-op balance pass. [post-34-roadmap](archive/post-34-roadmap.md).
- **Cluster 1 — Combat Depth (Y→34)** — the `EffectAbility` keystone · non-stat statuses · status-on-hit / chain / summon · the editors · effect scaling · FX·SFX·status-viz · the §33 re-derive · §34 polish; World v30 / Run v23. [post-x-roadmap](archive/post-x-roadmap.md).

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
