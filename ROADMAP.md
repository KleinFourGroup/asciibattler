# ROADMAP — Cluster 5 (Map Content), Phases 73–81

The cluster's PLAN (authored + user-locked 2026-08-05 at the spec
session; it stays a plan for its whole life). The signed design
decisions live in [cluster-5-spec.md](cluster-5-spec.md) §Kickoff
resolutions; audit findings + rationale in [WORKLOG.md](WORKLOG.md)
§Kickoff; live status is HANDOFF's 🧭 Cursor. Sub-steps are cut at
each phase kickoff (AGENTS "The planning stack"), never here.

**Ordering in one breath:** tooling before the long haul (§73);
events before its two consumers (§77 gen-rework, §82 balance); ALL
content movers (§§74–76) before the single re-baseline point (§77);
cosmetic/docs phases where they can't perturb pins (§§78–80); balance
last, on final content (§82, née §81 — renumbered 2026-08-09 when
the procedural-parity phase claimed §81). The gambler parity repair
was DELIBERATELY moved from the opener to the closing rebalance
(user call, 2026-08-05):
repair constants tuned before §§74–76 puree the numbers would be
re-derived anyway; the breach rides meanwhile as the named sheet
rider it already is.

## Phase 73 — Hook speedup + quick fixes ✅ CLOSED 2026-08-05 (user-signed)

**Outcome:** the hook's docs/UI path **~5.6 min → ~45s** and the
sim-touching path **→ ~2.7 min** (`isolate:false` ×2 + the four-file
fuzz split, honesty-protocol verified, test counts exact throughout);
the maxHandSize-10 density bug fixed + user-eyeballed; Stop never
highlighted (three-state proof); the two doc drifts fixed. The 73f
contingency was never needed. Detail: WORKLOG §73 + git.

- [x] 73a — main-suite `isolate: false` → **162s → ~33s** (worklog §73)
- [x] 73b — fuzz rebalancing: FOUR tail files split + the
  audit-cleared isolate flip → **~175s → ~114s**, 386 exact (worklog §73)
- [x] 73c — hand-density fix (pinned Fight ▸ + 5+5 balanced wrap) —
  native eyeball PASSED; Surge id-rename TODO filed (worklog §73)
- [x] 73d — Stop never highlighted (atWill sentinel, three-state
  browser-proof) (worklog §73)
- [x] 73e — doc fixes: AGENTS count de-duplicated to the Cursor ·
  the map-gen card describes the real tool (§77 re-describes)
- [x] 73f — CONTINGENCY not cut, not needed (docs path ~45s)

## Phase 74 — Events (the keystone) ✅ CLOSED 2026-08-07

**Outcome:** the event system end to end, user-signed — grammar →
Run phase (v40→v41) → executor → placement (dense dials + the
starting-event root) → scenes → arbitration (the sixth site) →
editor → the ten-event demo catalog + prodigy + both new reward
kinds → the no-repeat default + reachability assert. Every exit
criterion met; every shipped run opens on the authored boon.
Narrative + the correction trail: WORKLOG §74; the signed shapes:
cluster-5-spec §Kickoff resolutions.

- [x] 74a — grammar + loader + catalog stub ✅ 2026-08-05
  (`1d6b042`): the full parse-side grammar + 3 smoke events + the
  termination/ref boot asserts; +15 tests. Detail: git.
- [x] 74b — Run integration, THE **v40→v41** commit ✅ 2026-08-05
  (`32c1726`): landed to plan + the stream-append correction
  (worklog §74b); +14 tests, pins at 41. Exit met minus the
  withdrawn byte-identity clause.
- [x] 74c-pre — INSERTED at the 74c shape-lock (user-signed): the
  `not` condition combinator (the negation-class gap surfaced by the
  addDaemon-dedupe fork; worklog §74c).
- [x] 74c — effect-op execution end to end ✅ 2026-08-05: all six ops
  live to the shape-lock resolutions (honor-the-grant · skip-if-owned
  · level-then-index · offer-time unit roll); reward kinds + editor +
  screen widened; #118 guard → `'event'`; the else → exhaustive
  switch (InstantOp did NOT widen — the step-zero re-judge). No bump.
  Detail: worklog §74c.
- [x] 74d — the Surge rename (`draw-two`→`surge`) ✅ 2026-08-06,
  inside the bump window; TODO line closed. Detail: worklog §74d.
- [x] 74e — placement + sector seams ✅ 2026-08-06: landed to plan +
  the user-signed density flip (eventChance **0.5**/spacing **1** —
  events are major, not rare detours) + the `eventsVisited` counter
  and its fuzz exit pin. Exit met (the pin proves opened pages).
  Detail: worklog §74e.
- [x] 74f — EventScene/EventScreen ✅ 2026-08-06: landed to plan
  (+ `describeEventCondition` in events.ts, the 74h-editor-reusable
  phrase helper). Exit met — all five flows browser-driven (open ·
  shown-disabled+requirement · met-dim · page hop · start-encounter);
  the 74e interim hazard CLOSED. Detail: worklog §74f.
- [x] 74g — arbitration ✅ 2026-08-06: nominator model + MAP-class ε
  (§82 re-reads) + singleton rule; decisions.csv rows. Worklog §74g.
- [x] 74h — the event editor ✅ 2026-08-06: shape landed + the live
  no-op-save byte proof; browser-driven. Detail: worklog §74h.
- [x] 74i — the design round ✅ 2026-08-07 (a/b/c): riders signed ·
  ten events + prodigy · placement + starting event LIVE (the
  scheduled break paid) · reward kinds. Detail: worklog §74i.
- [ ] 74j — docs close: ARCHITECTURE catalogs, DESIGN, cursor flip.

## Phase 75 — Camps ✅ CLOSED 2026-08-09 (75l board re-pin recorded in BALANCE)

**Outcome, one breath:** the neutral third faction shipped end to end
— registry (**v34→v35**) + portal drip + the ~40-site active-neutral
widening + leash wander + damage-sourced hostility/kill credit +
continuous-value rewards + the TERMINAL_AMBER render treatment + both
editors + the signed 5-camp catalog on 4 placements + the per-turn
enemy PULL (the first enemy-objective consumer) + the ordered-engage
rubble auto-break made ROUTE-AWARE; all feel verdicts user-signed;
camp-free byte-identity held every step. Detail: WORKLOG §§75–75k2 ·
DESIGN §Camps · gotchas #122–123 · git.

- [x] 75-pre — fuzz-telemetry stale-guard fix ✅ 2026-08-08 (worklog §75)
- [x] 75a — camps config + layout seams ✅ 2026-08-08 (worklog §75)
- [x] 75b — the World camp registry, **v34→v35** ✅ 2026-08-08 (worklog §75)
- [x] 75c — portal-drip spawn ✅ 2026-08-08 (worklog §75; landing
  note at spawnCampUnit)
- [x] 75d — the spatial widening ✅ 2026-08-08 (worklog §75)
- [x] 75e — the combat widening ✅ 2026-08-08 (worklog §75)
- [x] 75f — `CampWanderBehavior` ✅ 2026-08-08 (worklog §75)
- [x] 75g — run economy ✅ 2026-08-08, NO Run bump (worklog §75)
- [x] 75h — renderer/HUD third faction ✅ 2026-08-08 + the 75h2
  setup-time prime ✅ 2026-08-09 (worklog §75)
- [x] 75i — both editors + byte-faithful formatters + live no-op-save
  proofs ✅ 2026-08-09 (worklog §75i)
- [x] 75j — ✅ CLOSED 2026-08-09 (`a299b77`→`4ae697d`): catalog +
  placements + all verdicts + the 75j2 pull re-author/per-turn seed +
  the user placement pass; the board re-pin MOVED to 75l — one pin,
  after the 75k sim fix (worklog §§75j–75j-close)
- [x] 75k — ✅ 2026-08-09 (`db53957`): the ordered-target rubble
  auto-break — all four ordered pursue arms (engage/focus ×
  enemy/neutral) fall back to the gate rubble; repro-first, both arms
  pinned (worklog §75k) · **+ 75k2** (`4523cc2`): the ROUTE-AWARE gate
  pick — the labyrinth wrong-gate catch; null probe holds the mark
  (worklog §75k2); the rubbleQuarry + labyrinth re-eyeballs ride with
  the user
- [ ] 75l — docs close (was 75k) + the SCHEDULED board re-pin (moved
  from 75j): ARCHITECTURE/DESIGN/GOTCHAS, cursor flip, ROADMAP demote

## Phase 76 — Unit mechanics & stat identity

**Charter:** auras (AbilityDef-authored / World-pass-executed + the
two engine gaps) with Inspire as the demo; Molotov / Pistol / Halberd
/ Cane; the new-archetypes design round incl. the roster prc/eva
identity pass; the stat-feel structural changes
(critable-everywhere, the luck-ScaledValue seam, the mobility
de-saturation) with constants locked against an in-phase board run;
the promotion-screen derived-delta display.

- **Order:** last content mover before the §77 re-baseline; feeds §82
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
**Rider (user-signed 2026-08-08, §75 kickoff):** the RNG fork
re-architecture — keyed stream derivation replacing the positional
ladder — is CONSIDERED at this phase's kickoff, riding the already
scheduled stream break so the global remap is paid once (rationale:
WORKLOG §75 shape-lock). The 75j verdict SIGNED per-encounter camp
identity (worklog §75j-verdicts) — the keyed per-turn camp stream
stays a dormant option here, built only if the call is reopened.

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

## Phase 81 — Procedural parity ("Uncharted Ground" catch-up)

**Charter:** bring the procedural battlefield generator to content
parity with the authored layouts: the five §37 terrain tiles
(deepWater / hills / ice / sand / mud) in gen, and camp support —
procedural maps carry no authored `camps` list, so camps roll from a
per-theme camp pool + a density knob (the sector-owns-both split
extended to themes). Inserted at the 75j close (user-approved
2026-08-09, numbered per the phase-number-letter-is-for-steps
convention; the old §81 renumbered to §82 — worklog §75j2).

- **Order:** after §80, before the §82 rebalance — the closing board
  must measure final content INCLUDING the procedural arm.
- **Risk:** MEDIUM — gen changes shift procedural trajectories (a
  deliberate procedural-arm re-pin); hand-authored layouts untouched.
- **Decision points:** the per-theme camp pools + density (a design
  round); per-tile terrain density knobs.
- **Exit:** procedural maps roll the §37 tiles + camps; same seed →
  same map (determinism holds); the procedural fuzz arm re-pinned;
  user eyeball on a handful of seeds.
- **Scope guards:** this is the BATTLEFIELD generator (§77 owns the
  node-map generator); no new tile kinds; no new camp content —
  pools over the §75 catalog only.

## Phase 82 — The closing rebalance + cluster close

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
