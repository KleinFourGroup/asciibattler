# ROADMAP — Cluster 5 (Map Content), Phases 73–81

The cluster's PLAN (authored + user-locked 2026-08-05 at the spec
session; it stays a plan for its whole life). The signed design
decisions live in [cluster-5-spec.md](cluster-5-spec.md) §Kickoff
resolutions; audit findings + rationale in [WORKLOG.md](WORKLOG.md)
§Kickoff; live status is HANDOFF's 🧭 Cursor. Sub-steps are cut at
each phase kickoff (AGENTS "The planning stack"), never here.

**Ordering in one breath:** tooling before the long haul (§73);
events before its two consumers (§77 gen-rework, §81 balance); ALL
content movers (§§74–76) before the single re-baseline point (§77);
cosmetic/docs phases where they can't perturb pins (§§78–80); balance
last, on final content (§81). The gambler parity repair was
DELIBERATELY moved from the opener to §81 (user call, 2026-08-05):
repair constants tuned before §§74–76 puree the numbers would be
re-derived anyway; the breach rides meanwhile as the named sheet
rider it already is.

## Phase 73 — Hook speedup + quick fixes

**Charter:** cut the measured ~5.6-min pre-commit hook down (the main
suite does ~19s of real test CPU under ~140s of per-file module
re-import — `isolate:false`/shared-pool is the top lever; the fuzz
half is under-parallelized at 5.5× on 32 cores) and clear the shipped
quick-fix debt so the whole cluster runs on fast tooling.

- **Order:** first — every later phase's commits pay the hook cost.
- **Risk:** LOW. `isolate:false` can surface hidden test-state
  coupling — if the suite goes flaky, fall back to a shared-registry
  pool or revert (the hook stays correct, just slow).
- **Exit:** docs-only commit path well under 2 min, all suites green
  AND honest; the maxHandSize-10 density bug fixed (pinned Fight ▸ /
  strip / packet row, balanced wrap) + the user's native eyeball
  taken; Stop button never highlighted; AGENTS fuzz-count + tools
  map-gen-card doc fixes landed.
- **Scope guards:** no CI setup; no test rewrites beyond splitting
  oversized fuzz files; no vitest projects-merge unless it falls out
  free.

**The cut (2026-08-05 kickoff):**

- [x] 73a — main-suite `isolate: false` + the honesty protocol (double
  run + shuffled file order + exact counts) → **162s → ~33s**, all
  green (worklog §73)
- [x] 73b — fuzz-suite rebalancing: FOUR tail files split (not one —
  the timing pass reframed it) + the audit-cleared isolate flip →
  **~175s → ~114s**, 386 tests preserved exactly (worklog §73)
- [ ] 73c — hand-density fix (pinned Fight ▸ / strip / packet row +
  balanced wrap) + the user's native maxHandSize-10 eyeball
- [ ] 73d — Stop never highlighted (an atWill sentinel matching no
  button)
- [ ] 73e — doc fixes (AGENTS fuzz count · tools map-gen card)
- [ ] 73f — CONTINGENCY, not cut: `vitest related` on staged paths,
  only if the docs-path hook still exceeds ~2 min after a+b

## Phase 74 — Events (the keystone)

**Charter:** the event-node system end to end per the signed spec:
the flat page-map grammar + config/loader, the `'event'` NodeKind +
RunPhase + EventScene (the port model), the effect-op executor
widening (incl. the removal paths + `unit`/`poolHealth` reward
kinds), the fold-routed global combat-resolve chance, run-lifetime
chain flags, `eventRng` (+ the cloneForRollout re-seed), the
harness/walker `'event'` arms, the event editor, the demo-catalog
design round, and the `startingEvents` sector seam.

- **Order:** before §77 (gen consumes the seam + placement) and §81
  (balance reads event-era runs).
- **Risk:** HIGH — a new serialized phase + two union widenings
  (**RunSnapshot v40→v41**) + the PATH_KINDS weight-vector
  re-baseline + mandatory bot-arm parity. Gets a DEDICATED planning
  session at kickoff (the proportionality rule).
- **Decision points:** the demo-catalog design round (content, not
  shape — the shape is signed).
- **Exit:** an event node playable end to end in the browser; a fuzz
  run traversing events green; the editor round-trips byte-faithful;
  decisions.csv shows event choices arbitrated.
- **Scope guards:** art/FX seam only (no implementation); no
  sector-scoped flags; no grammar recursion; `devLoadRun` stays
  map-phase-only (Cluster 6).

## Phase 75 — Camps

**Charter:** neutral camps per the signed spec: the World camp
registry (campId / per-faction hostility / leash anchors —
**WorldSnapshot v34→v35**), the active-neutral predicate widening
(~40 sites incl. the movement.ts immovable-blocker correctness fix),
overlap spawn + leash wander, kill credit + reward portions
(win-or-lose), renderer/HUD third-faction treatment, the camp catalog
editor + the layout camp-spawn paint tool, the demo-catalog design
round.

- **Order:** after events (both are content movers ahead of §77;
  events first because two later phases consume it).
- **Risk:** HIGH-ish — sim-wide widening; byte-identity on camp-free
  layouts is an EXIT GATE, not a nicety (presence-gating everywhere;
  dedicated RNG forks).
- **Decision points:** the two feel verdicts — `enemyPullChance`
  enable and block-turn-end — at this phase's playtest; the
  demo-catalog design round.
- **Exit:** camps playable (wander/aggro/kill/loot) in the browser;
  the two headless invariants green (leash bound; spawn vacated ≤N
  ticks); full fuzz byte-identical on camp-free layouts; feel
  verdicts recorded in the worklog.
- **Scope guards:** no cross-turn camp state; no fourth team value;
  bot camp-seeking stays out (the probe arm is §81's).

## Phase 76 — Unit mechanics & stat identity

**Charter:** auras (AbilityDef-authored / World-pass-executed + the
two engine gaps) with Inspire as the demo; Molotov / Pistol / Halberd
/ Cane; the new-archetypes design round incl. the roster prc/eva
identity pass; the stat-feel structural changes
(critable-everywhere, the luck-ScaledValue seam, the mobility
de-saturation) with constants locked against an in-phase board run;
the promotion-screen derived-delta display.

- **Order:** last content mover before the §77 re-baseline; feeds §81
  (the gambler is the luck character — this phase may move the parity
  breach organically, either direction).
- **Risk:** MEDIUM — no snapshot bump predicted (aura state =
  refresh-lifetime statuses; abilities/archetypes are config); the
  board WILL move (the critable flip) — an amendment board run is
  in-phase, per the standing law.
- **Decision points:** the archetype design round; mobility/crit
  constants sign against the board.
- **Exit:** aura buffs visibly apply + linger in the browser; new
  units draftable with prices + glyphs inside the atlas budget; the
  board re-run green with re-signed refs where deliberately moved.
- **Scope guards:** no constitution auras; no aura stacking policy;
  no evadable-flip on the unmissable-magic identity ops.

## Phase 77 — Sector-map generation rework

**Charter:** visualizer → the three metrics (early availability ·
path-kind coverage · branch divergence) as acceptance tests →
constructive guarantee passes + a min-divergence edge rule → bounded
rejection sampling only for the fuzzy residue; event placement + the
source-node stamp (consuming §74's `startingEvents` seam); the
deliberate seed-stream break + the FULL re-baseline + the cluster-5
stress test (the 11-row doctrine control set). Second Run bump.

- **Order:** after ALL content movers so the re-pin happens once, on
  final content.
- **Risk:** MEDIUM-HIGH — every seed remaps; the isolation dials
  (`eventChance` etc.) must land in `sectorAdvanceConfig` or probes
  silently include events.
- **Decision points:** the metric thresholds sign with the user (what
  "balanced enough" means is a design call).
- **Exit:** metrics green over a seed corpus; the visualizer shipped
  (and the tools-index card finally telling the truth); fuzz + board
  fully re-baselined; the stress test recorded in BALANCE.
- **Scope guards:** no rejection loop without a hard max-attempts
  failure; generator passes replaced only where the rework demands
  it, each documented as a deliberate stream break.

## Phase 78 — UI/UX batch

**Charter:** objective click semantics (left=engage / right=focus +
HUD-card targeting via a widened `ObjectiveControls`) + larger
buttons; the empower payload widening (per-slot per-key) + color
coding + in-battle markers; the sector-map overlay (page-lifetime,
readOnly MapScreen, `M`).

- **Order:** after the sim-heavy phases; nothing here moves a pin.
- **Risk:** LOW-MEDIUM (the empower payload touches 4 event payloads
  + Run + 6 test sites — the one non-cheap item).
- **Decision points:** arming semantics; player-card click meaning
  (drop vs define — per-unit objectives are OUT of cluster scope).
- **Exit:** user-confirmed in the native browser (render/ui = the
  eyeball policy).
- **Scope guards:** no per-unit objective model; no focusTile runtime
  switcher unless it falls out free.

## Phase 79 — Glyph targeted fix

**Charter:** the camera-up anchor offset (the J3/I2 pattern applied
to the sprite anchor) + atlas-derived ink click-boxes; then the
native-browser eyeball.

- **Order:** any time after §76 (wants the final unit set on screen);
  render-only.
- **Risk:** LOW.
- **Decision point:** the eyeball verdict — the billboarding design
  round opens ONLY on failure.
- **Exit:** edge-of-viewport glyphs sit their tiles at native
  resolution, user-confirmed; TODO #79 + #81 closed.
- **Scope guards:** no depth-write/alpha-test rework; no 3D-quad
  redesign unless the round opens.

## Phase 80 — Feasibility audit docs

**Charter:** the five planning docs — the event-keyed sound registry
proposal · music · achievements · tutorial · online balance
telemetry — each closing with a "what Cluster 6 must not break" note.

- **Order:** anywhere late; docs-only.
- **Risk:** LOW.
- **Exit:** five docs in the repo; achievements/tutorial explicitly
  confirm the Cluster-6 persistent-store dependency.
- **Scope guards:** ZERO implementation — audits and plans only.

## Phase 81 — The closing rebalance + cluster close

**Charter:** the balance agenda on final content: the gambler
diagnosis→repair (confirm-the-deficit FIRST — mechanism vs numbers);
real sector-2 bosses (design round + dose re-bracket per protocol,
retiring the `-deep` provisional clones); the measured-terminal-prior
ladder judgment on event-era data; the 55pre-twin re-read; the camps
forced-engagement probe arm; the event-ratio economy read; the full
closing board + the re-signed sheet; then the close ritual
(demotions, archives, scratchpad sweep, cursor flip).

- **Order:** last, by definition.
- **Risk:** MEDIUM — measurement-heavy (box batches; the 68h shape
  trigger applies).
- **Decision points:** the boss design round; every re-signed band;
  the ladder verdict (the ML question re-opens ONLY if the tabular
  prior stops converging).
- **Exit:** board green (0 FAIL; WARNs pre-registered only); parity
  restored inside ±5; sheet re-signed; cluster closed, all phases
  user-signed.
- **Scope guards:** no new content in this phase; repairs price
  against REALIZED value; the n=80 floor for per-item signals.
