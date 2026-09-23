# HANDOFF — Post-MVP pickup

A fresh-session orientation for ASCIIbattler. Read this first; then dive into the docs only where they're called out.

## 🧭 Cursor

**The ONE home for live status.** Other docs (and the agent memory) point here instead of restating it; when state changes, this section is the single place that updates.

- **NEXT — ROUND 7.5 (The Board), §106: the projection spike, pass two + the spec.** Kicked off 2026-09-22; the cut and its reads are user-signed (ROADMAP §106, WORKLOG §106 Kickoff).
  - Done: 106a the instrument · 106b the `slab` dial (read clear) · 106c `ground` + `plate` (read: `merged` wins; the anchor rule R5–R7 + R10 is deletable; the plate is `filled`) · 106c-post marks cut per tile onto the tile tops, `plateScope`, `plateAlpha` (read clear) · 106c-post2 the step-face drape (read clear: on; `cueDepth` world; `plateAlpha` 0.6 kept) · 106d the played read (a full run; all four watches clear; the bookmark signed: `?bp=proj-ortho_yaw-45_cue-outline_cueAlpha-0.3_slab-centre_ground-merged_plate-filled_plateScope-all_anchor-bottom_drape-1_cueDepth-world`).
  - **(1) The two pre-existing bugs from the 106d read** (TODO §106 riders, causes found): hills ignore the layout theme; several empower kinds overflow a compact card. When to fix them is the user's call (proposed 2026-09-23: now, before 106e, as two standalone `batch` commits).
  - **(2) 106e, the spec** (`stop`). It owns the spike code's disposition, the scroll-mode pan under yaw, the terrain-decal question (now with the 106d finding: marks glitch through the hill mounds; the user favours stamping the marks into the terrain's rendering), rounded plate corners (the user, low confidence), the elevation clauses, and the rule deletions (the table: WORKLOG §Kickoff).
  - Pane recipes for this work: WORKLOG §106b and §106c-post, and [process/browser-pane.md](process/browser-pane.md).
- **Constraints on 7.5.** DESIGN §UI idioms and §Input accessibility (signed at §103) are what Rounds 8 and 11 are checked against. DESIGN "Team identity on the board" holds the five clauses 7.5 must satisfy; clause 3's collision is live (a panicked ally is camp-amber). Yaw is not exposed to players (TODO, Round 11).
- **Trials this round** (revisit at the 7.5 close): the reads doctrine (AGENTS "Reads are cut, not improvised"). §105: 3 `batch` reads, all clear, no `-post` from them; 1 `-post` from the 105b stop. §106 so far: 1 `batch` read (106b), clear; 2 `-post`s, one from each of the 106c and 106c-post stops; the 106d stop clear, with two items to the spec. The AGENTS rewrite of 2026-09-23 (the tone audit, WORKLOG) is new too: watch whether sessions follow its "Before you… read…" triggers into `process/`.
- **Riders with dates:**
  - **(1) The reminder reword.** The weekly `friction-scan` check is answered and dropped (2026-09-23). **Open decision, for the 7.5 close or sooner at the user's word:** retire the trial, or pursue it outside the repo (the app's menus have no environment editor, so feedback to the Claude Code developers is the remaining route). **The finding:** sessions are not getting the reworded text (`CLAUDE_CODE_SILENT_TURN_REMINDER_TEXT` in the gitignored `.claude/settings.local.json`); 105b, 105c and the tone-audit session all quoted "…— say in a few words what you're doing, then continue". That wording is in neither claude.exe 2.1.280 (whose own default reads "…As you continue, keep them updated…") nor the desktop app bundle (2.7032), while the app has its own registry entries for all three `SILENT_TURN_REMINDER` variables. Inference, not verified: the app sets the reminder itself and overrides the settings file. The wording sessions do receive is the vendor's own recommended text.
  - **(2) Model id: `claude-opus-5-5`** (changed from `claude-fable-5-1` on 2026-09-22; the tone audit ran 2026-09-23, WORKLOG). If your model id differs, run the audit again (AGENTS "Working with the user").
  - **(3) Harness feedback** was sent by the user 2026-09-20 as two messages (the reminder's timing and wording; the keep-going guidance having no project override; texts in `scratch/claude-code-feedback-1-reminder.txt` and `-2-pauses.txt`). If a Claude Code release documents `CLAUDE_CODE_SILENT_TURN_REMINDER*` or changes either behaviour, note it here and re-read rider (1).
- **Last phase: §105 ✅ closed 2026-09-22.** The projection spike, pass one, named ortho · pitch 45 · yaw [30, 45] (art-directed at 45, 30 the check), with the long lens (FOV 20) as the fallback. Taste read on 2560×1440 and ~1280×720; mobile deferred. WORKLOG §105a–e and §THE VERDICT.
- **Earlier:** Round 7 and everything before it are in Closed rounds below; per-phase detail is in each round's archived roadmap and worklog.
- **In flight: nothing on the box** (the last cohort drained 2026-09-08; every box destroyed). The tree plays the kept casualty game at the frozen config (`d9675b6`: `chipMode: casualties` · `capPenalty: survivors` · pool max 40 · the 92d table + the 94b/94c rows · the 92c2 vector · the 94f price book · prior v5 / roster v3). The named watches ride the signed sheet (the wall 0.459 vs 30–35 · the priest parity +14.2 / +10.0 · the deploy reach 0.508 · the ceilings −0.142 / −0.175 / −0.200), and TODO carries the §92/§94 riders.
- **Branch / tree:** `main`. Push at the user's call, or before a box launch (pre-authorized). Tags `pre-casualty-experiment` and `casualty-seams` stay as history: the experiment was kept, so they mark the floor the rule was measured against, not a rollback plan.
- **Snapshots:** WorldSnapshot **v36** (91a1: the fallen-power ledger + `battle:ended.reason`) · RunSnapshot **v46** (95f: the Mars buff key `honed`; a v45 save rejects).
- **Tests:** **3091 main (0 skipped) + 582 fuzz:smoke**, green; main re-counted 2026-09-23 (106c-post2), fuzz:smoke last run at `a9c16ef`. Typecheck clean. The hook takes ~45 s for docs and UI, ~7 min when the smoke runs.
- **Permanent gates** (never relax): `tests/nodemap-metrics.test.ts` (the signed 77c sheet at n=500) · `src/audio/eventSounds.test.ts` (every bus event has a sound or a silent reason) · `src/audio/AudioPlayer.test.ts` (every sound key has a file, every file a key) · `src/render/fxRegistry.test.ts` (a projectile launch has travel time) · `tests/font-coverage.test.ts` (the UI glyph inventory, fallback coverage, the line-box pin) · `tests/ui-focus.test.ts` (every `:hover` has its `:focus-visible` twin) · `tests/ui-motion.test.ts` (every animation has its reduced-motion twin) · `tests/ui-tooltips.test.ts` (zero native `title=`) · `tests/i18n-literal-pin.test.ts` (the literal baseline stays empty) · `src/render/statusDisplay.test.ts` (every buff key has a colour) · `src/sim/terrainGen.test.ts` (per-theme tiles) · `tests/prior-table-coverage.test.ts` (the derived-artifact tripwire) · `src/config/packets.test.ts` (no run-duration packet) · `tests/fuzz/roster/rosterTable.test.ts` + `tests/fuzz/commands/sampledRosterArg.test.ts` (the roster table and sampled mode) · `tests/docs.test.ts` (the doc caps) · `tests/board/cameraFit.test.ts` (the lean pin, permanent once ortho ships). Pin history per round lives in the archived worklogs, not here.
- **Last closed: ROUND 7 — IDIOMS** (Phases 95→104 + §96.5, 2026-09-09 → 2026-09-20), every phase user-signed; see Closed rounds below.

## Current state

- **The MVP → Phase X foundation: COMPLETE** — the MVP (CHECKPOINT 7, Pages-deployed) · A–D (selectors/commands/fuzz/config/scenes · palette+bloom · terrain/walls/LOS · camera/spawn/theming) · E–GP (the stat vocabulary + abilities + leveling + run progression) · H–K (the deckbuilder trial · hit/miss · objectives · statuses) · L (daemons) · M (progression + presentation) · N (the rogue dash + the `1.25 × 1.5` band) · O (typed objectives) · P–R (the UI round) · S–W (the encounter system + sectors + the first boss) · Wb · X (the band re-derivation). World → v25 / Run → v23 across it. Detail: [archive/phase-a-e-worklog.md](archive/phase-a-e-worklog.md) · [archive/phase-e-gp-worklog.md](archive/phase-e-gp-worklog.md) · [archive/post-h-roadmap.md](archive/post-h-roadmap.md) · [archive/post-n-roadmap.md](archive/post-n-roadmap.md) · [archive/post-r-roadmap.md](archive/post-r-roadmap.md) + [BALANCE.md](BALANCE.md). _(The twelve per-phase paragraphs this line replaces are in git at `1ebe188`.)_
- **Clusters 1–5, the three interstitials, Rounds 6–7 and THE CASUALTY EXPERIMENT (Y → §104, → 2026-09-20): COMPLETE, every phase user-signed** — one line each under **Closed rounds** below; the condensed paragraphs in [archive/closed-rounds.md](archive/closed-rounds.md); per-phase detail in each round's archived roadmap + worklog + spec, git, and [BALANCE.md](BALANCE.md).
- **Tests:** live counts are pinned in the 🧭 Cursor (top of this file); 0 `it.todo()`. One known residual — `recruit:healer` has a single spiralFireLife hang (a damage-starved all-healer team, out of GP5 scope). Fuzz sweep `npm run fuzz` (20 seeds default; `--per-hop` for per-hop analysis; `--layout=procedural` to isolate the M6 maps); the `scored` strategy + `--search` (→ `output/best-strategy.json`) drive the balance tuning. Short / forced / leveled runs: `npm run run-config -- --help` or the GUI at `/tools/run-config/`. **READ [BALANCE.md](BALANCE.md) FIRST for any balance work; [PATHING.md](PATHING.md) for movement-quality work (regenerate its tables with `npm run pathing`).** The per-phase test-count history lives in git log + [archive/post-h-roadmap.md](archive/post-h-roadmap.md).
- **Dev server:** `npm run dev` → http://localhost:5173/ (5174 if 5173 is held by a stale process). The user usually has their own dev server on 5173; agents verifying in Claude Code's Browser pane use the `dev-preview` config and [process/browser-pane.md](process/browser-pane.md), which also covers the `window.__game` dev handle.
- **Build:** `npm run build`. `vite.config.ts` uses `base: './'` so the same `dist/` works at any subpath.
- **Canonical references:** [ARCHITECTURE.md](ARCHITECTURE.md) for the project tree + event/command catalogs; [ROADMAP.md](ROADMAP.md) for forward-looking steps; [GOTCHAS.md](GOTCHAS.md) for the hard-won fixes that look weird without context — don't refactor those without understanding why.

## What's next

**The road to ship is [META-ROADMAP.md](META-ROADMAP.md) v2 (locked 2026-08-21) — seven ordered rounds, 6 → 12.** Clusters 1–5 (the v1 plan, archived at [archive/post-x-meta-roadmap.md](archive/post-x-meta-roadmap.md)) are complete & user-signed (see Closed rounds below); **the live NEXT is pinned in the 🧭 Cursor at the top of this file.** Smaller follow-ups live in [TODO.md](TODO.md); each round's charter, dependencies, decision points, and scope guards live in META-ROADMAP, and its Coverage map says where every carried item landed.

Balance numbers live in `config/*.json` (zod-validated by `src/config/*.ts`) -- edit the JSON and refresh for a Vite hot-reload, no recompile.

## Closed rounds — one line each

One line per round (the 2026-09-09 trim, user-signed). The condensed
paragraphs — verbatim, with each round's still-load-bearing facts — are in
[archive/closed-rounds.md](archive/closed-rounds.md) (append-only; a close
appends its paragraph there and its line here). Numbers: [BALANCE.md](BALANCE.md).

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

In **[AGENTS.md](AGENTS.md)** (`## Pre-flight` / `## Pre-commit` /
`## Toolchain`). The versioned pre-commit hook runs `npm run typecheck` and
`npm test`, plus `npm run fuzz:smoke` when sim/run/core/config paths are staged.

## Existing memories

The agent memory lives outside the repo, on one machine. Since 2026-09-23 it
holds only pointers back to these docs plus machine-local facts; anything a
session on another machine (or in another harness) needs is in the repo.
