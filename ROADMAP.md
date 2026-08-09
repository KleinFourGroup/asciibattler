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
  (§81 re-reads) + singleton rule; decisions.csv rows. Worklog §74g.
- [x] 74h — the event editor ✅ 2026-08-06: shape landed + the live
  no-op-save byte proof; browser-driven. Detail: worklog §74h.
- [x] 74i — the design round ✅ 2026-08-07 (a/b/c): riders signed ·
  ten events + prodigy · placement + starting event LIVE (the
  scheduled break paid) · reward kinds. Detail: worklog §74i.
- [ ] 74j — docs close: ARCHITECTURE catalogs, DESIGN, cursor flip.

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
- **Decision points:** three feel verdicts at this phase's playtest —
  `enemyPullChance` enable · block-turn-end · camp identity
  (per-encounter as shipped vs per-turn, §75i-post; switch → §77);
  the demo-catalog design round.
- **Exit:** camps playable (wander/aggro/kill/loot) in the browser;
  the two headless invariants green (leash bound; spawn vacated ≤N
  ticks); full fuzz byte-identical on camp-free layouts; feel
  verdicts recorded in the worklog.
- **Scope guards:** no cross-turn camp state; no fourth team value;
  bot camp-seeking stays out (the probe arm is §81's).

**The cut (kickoff shape-lock 2026-08-08 — worklog §75).** World
**v34→v35 at 75b**; NO RunSnapshot bump predicted; every step
through 75i presence-gated + fork-append-free (fuzz byte-identical
until 75j's scheduled content re-pin). Spawn model = PORTAL DRIP
(per-camp pending queues in the registry; user-signed, worklog §75
shape-lock #4).

- [x] 75-pre — fuzz-telemetry stale-guard fix ✅ 2026-08-08: the
  team gate replaces the retired sentinel + the neutral no-tally pin
- [x] 75a — camps config + layout seams ✅ 2026-08-08: catalog +
  loader + both boot asserts + the campSpawns/camps superRefine;
  trace-era cost confirmed dev-replay-only (worklog §75)
- [x] 75b — the World camp registry, **v34→v35** ✅ 2026-08-08:
  registry + campId + presence-gated campRng + the conditional
  rollout re-seed; byte-identity hook-proven (worklog §75)
- [x] 75c — drip spawn ✅ 2026-08-08: spawnCamps rides applyTerrain
  (all four sites free); the drip drain + random-intersect live;
  landing note at spawnCampUnit — 75f swaps behavior slot 0
  (worklog §75)
- [x] 75d — the spatial widening ✅ 2026-08-08: all ten worksheet
  boxes via the `isInertNeutral` flip; LOS stays occluding (census
  call); byte-identity holds (worklog §75)
- [x] 75e — the combat widening ✅ 2026-08-08: all sixteen worksheet
  rows via the shared `hostileCandidate` admit rule; aggro+kill credit
  on the dealDamage chokepoint; chaos-is-chaos recorded (worklog §75)
- [x] 75f — `CampWanderBehavior` ✅ 2026-08-08: slot-0 swap + 'camp'
  registry arm; campRng wander + anchor-vacate rule + MovementBehavior
  delegate; both exit invariants standing as tests (worklog §75)
- [x] 75g — run economy ✅ 2026-08-08: campKills payload + the
  win-or-lose portion branch + both knobs dormant; NO Run bump; the
  pull's per-encounter override deferred to 75j (worklog §75)
- [x] 75h — renderer/HUD third faction ✅ 2026-08-08: TERMINAL_AMBER
  combatant treatment + the browser-caught objective-revert fix;
  NATIVE EYEBALL ✅ 2026-08-09 → one finding, fixed as 75h2: the
  setup-time first-member prime (worklog §75)
- [x] 75i — editors ✅ 2026-08-09: the camp editor (both boot asserts
  live) + the layout-editor camps layer + both byte-faithful
  formatters + both live no-op-save proofs; camps.json normalized
  once, hash-neutral (worklog §75i)
- [ ] 75j — the demo-catalog design round + placements + the feel
  pass (the three decision points above) + the SCHEDULED board re-pin
- [ ] 75k — docs close: ARCHITECTURE/DESIGN/GOTCHAS, cursor flip,
  ROADMAP demote

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
**Rider (user-signed 2026-08-08, §75 kickoff):** the RNG fork
re-architecture — keyed stream derivation replacing the positional
ladder — is CONSIDERED at this phase's kickoff, riding the already
scheduled stream break so the global remap is paid once (rationale:
WORKLOG §75 shape-lock). If 75j's feel verdict wants per-turn camp
composition (today de facto per-encounter — worklog §75i-post), it
lands here as a keyed per-turn stream, not an ad-hoc seed mix.

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
