# ROADMAP — Cluster 5 (Map Content), Phases 73–82

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
- [x] 74j — docs close ✅ 2026-08-07 (box flipped late — the close
  commit landed with the §74 close; caught at the §77 kickoff).

## Phase 75 — Camps ✅ CLOSED 2026-08-10 (the 75l board re-pin: BALANCE 2026-08-10)

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
- [x] 75l — ✅ 2026-08-10: docs close (`014ee9a`) + the board re-pin —
  15/15 on the box, 0 FAIL / 9 WARN, + the overnight `--set` ablation
  decomposition (⭐ walls pull-softened · the pull scales with fight
  length · fire-channel inversion OPEN) — BALANCE 2026-08-10 canonical;
  the signing-session queue lives there (worklog §75l)

## Phase 76 — Unit mechanics & stat identity ✅ CLOSED 2026-08-12

**Outcome (one breath):** the aura engine (World pass + surfaces +
`engagementReach`) with the Officer's Inspire live end to end incl.
the range FX; four weapons + four draftable archetypes + the prc/eva
identity pass; critable-universal + the mobility de-saturation
(exact level-1 equivalence) + luck durations; the promotion
derived-delta display; the amendment board 0 FAIL / 7 WARN
(composition rotated — three riders + the n=120 protocol → §82,
BALANCE 2026-08-11). No snapshot bump, as predicted. Detail:
WORKLOG §§76–76h + DESIGN (§Auras / §Stat identity) + gotcha #124.

Cut at the 2026-08-10 kickoff (audit + shape-lock: WORKLOG §76):

- [x] 76a — aura engine core ✅ 2026-08-10 (`459f4c7`): landed to
  plan, +12 tests, byte-identity held (fuzz pins green); no bump
- [x] 76b — aura surfaces ✅ 2026-08-10: formatter/editor/detail arms
  + STATUS_DISPLAY coverage pin (emboldened entry added); live
  no-op-save byte proof held (2× save, zero diff)
- [x] 76c — the two engine gaps ✅ 2026-08-10: caster-anchored blast
  propose arm (would-it-matter gate, live-centre fire) + anchor
  honored at all 3 interpreter sites + `engagementReach` (nova =
  radius; ally-shout non-engaging); shipped-catalog invariance pinned
- [x] 76d — Molotov/Pistol/Halberd/Cane ✅ 2026-08-10: pure config +
  4 registry lines + fx reuse; identity pinned as RELATIONS to
  reference defs (numbers provisional → 76h); molotov authored at
  the 76e decoupled convention (critable:true/evadable:false)
- [x] 76e — the structural flip ✅ 2026-08-10: critable universal
  (5 ops flipped, law-pinned) + mobility re-anchored as EXACT level-1
  equivalence (rate 0.075/floor 0.3, bases+growths ×2 — pathing
  pins never moved) + luck-seam pin (worklog §76e)
- [x] 76f — DESIGN ROUND ✅ user-signed 2026-08-10: the Officer
  absorbs the cane (kit `[cane, inspire]`) — 4 new archetypes
  (Rioter `f` / Gunslinger `G` / Halberdier `H` / Officer `O`,
  47/48 atlas) + Inspire r4/+2mob/5s + prc/eva pass (11 entries,
  caster prc growth vestigial) + luck durations on hex/wail/molotov;
  mobility re-anchor pre-landed at 76e (worklog §76f)
- [x] 76g — ✅ 2026-08-10: pure `promotionDeltaParts` + 10 headless
  tests + the final-beat card block; the eyeball-caught layout-shift
  fix landed on top (worklog §76g)
- [x] 76g2/g3 — ✅ 2026-08-11: aura-range FX, the eyeball insertion
  (radius was illegible): sprite-anchored boundary-mote ring, then
  the B pulse layered by user call (worklog §§76g2–g3)
- [x] 76g4 — ✅ 2026-08-11: pulse Doppler → the `__auraFx`
  track/fill/fixed switch; track default, fill HELD for a wider jury
  (TODO "Aura-FX mode") (worklog §76g4)
- [x] 76h — ✅ user-signed 2026-08-11: 15/15 on the box at `3a0b48e`,
  0 FAIL / 7 WARN (composition ROTATED — act-1+fire healed, walls
  flipped hardened, walk ceilings negative, gambler flat); three
  riders + the n=120 protocol → §82 (BALANCE 2026-08-11, worklog §76h)
- [x] 76i — docs close ✅ 2026-08-12 (`e019202`; box flipped late,
  caught at the §77 kickoff)

## Phase 77 — Sector-map generation rework 🚧 IN FLIGHT (cut signed 2026-08-12)

**Charter:** visualizer → the three metrics (early availability ·
path-kind coverage · branch divergence) as acceptance tests →
constructive guarantee passes + a min-divergence edge rule → bounded
rejection sampling only for the fuzzy residue; event placement + the
events-to-combat ratio pass (its own signed band — the source-node
stamp is already live since 74i); the deliberate seed-stream break +
the FULL re-baseline + the cluster-5 stress test (the 11-row
doctrine control set). Second Run bump.
**Rider ✅ DECIDED 2026-08-12 (kickoff shape-lock):** the RNG fork
re-architecture is a YES, at the FULL robustness bundle —
per-occurrence keyed derivation (not just keyed streams), the
one-stream-per-consumer split, the single sanctioned door, the
stream-key registry, the independence test; node-anchored outcome
semantics user-signed. Camp identity stays per-encounter (75j
verdict preserved by keying). Rationale + the audit evidence:
worklog §77.

- **Order:** after ALL content movers so the re-pin happens once, on
  final content.
- **Risk:** MEDIUM-HIGH — every seed remaps; the isolation dials
  (`eventChance` etc. + every NEW §77 knob) must land in
  `sectorAdvanceConfig` or probes silently include events.
- **Decision points:** 77c — the metric thresholds + guarantee list
  + the events-to-combat ratio band sign with the user, on 77b's
  measured baseline.
- **Exit:** metrics green over a seed corpus; the visualizer shipped
  (and the tools-index card finally telling the truth); fuzz + board
  fully re-baselined; the stress test recorded in BALANCE.
- **Scope guards:** no rejection loop without a hard max-attempts
  failure; generator passes replaced only where the rework demands
  it, each documented as a deliberate stream break.

Cut at the 2026-08-12 kickoff (audit + shape-lock: WORKLOG §77):

- [x] 77a — visualizer ✅ 2026-08-12: `tools/nodemap-viz/` live +
  card re-described; parity-probed + DOM-proven (worklog §77a)
- [x] 77b — metrics + baseline ✅ 2026-08-12: `mapMetrics.ts` +
  `npm run nodemap:metrics` + overlay; the 500-seed baseline
  confirms every complaint (worklog §77b = the signing sheet)
- [x] 77c — ✅ DECIDED 2026-08-12: the threshold sheet signed, one
  amendment — events/route ≈3, band 2.5–3.5 (worklog §77c)
- [x] 77d1 — ✅ 2026-08-12: `deriveSeed`/`deriveRng` + the 22-key
  registry + pinned vectors + independence tests; additive,
  fork() untouched (worklog §77d1)
- [x] 77d2 — ✅ 2026-08-12: the Run conversion landed to plan —
  **v41→v42** (streamRoot + 3 counters replace 10 RNG states);
  rollout re-seed = ONE field; port canary re-pinned 3→2
  (worklog §77d2)
- [x] 77d3 — ✅ 2026-08-12: battle-side keyed (terrain/spawnSetup/
  campSetup/enemyPull; burn + alignment forks dead; mixSeeds folded
  in); **World v35 HELD**; docs sweep + gotcha #125 (worklog §77d3)
- [ ] 77e — the `generate()` redesign: named sub-streams per pass +
  constructive guarantee passes (port-≥1 generalized) + the
  min-divergence edge rule + the ratio pass w/ battle floor +
  bounded rejection (hard max-attempts throw); metrics become
  permanent gates (`nodemap-metrics.test.ts`, the drift.test.ts
  analog); new knobs join `sectorAdvanceConfig` (#121 rule)
- [ ] 77f — the full re-baseline: fuzz exit pins + fixtures + the
  board re-pin on the box + the 11-row doctrine stress test →
  BALANCE (68h shape trigger — box, not local)
- [ ] 77g — docs close + ROADMAP demote + cursor flip

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
- **§76f rider (user-signed 2026-08-10):** reopen the FONT/STYLE
  AXIS (the archived Phase-I deferral — [archive/post-h-roadmap.md]
  §NOT-doing) — the §76 wave strained the ASCII pool without
  colliding; scope with the §82 boss wave in view. Facts for the
  scoping: only `latin-400` loads (latin-1 already free; a new
  subset import must join FontAtlas's font-ready await or the
  serif fallback bakes into the atlas — FontAtlas.ts:87), and the
  style axis proper = `glyphStyle` on UnitDef + a (char,style)-keyed
  atlas + budget accounting + editor arm.

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
- **75l riders (user-signed 2026-08-10):** the BOSS-BOARD PULL
  question — the walk walls read pull-softened (BALANCE 2026-08-10);
  tentative user lean NO-pull-on-boss, decide on final data alongside
  the dose re-bracket · the FIRE-CHANNEL re-read — inverted at 75l
  (−0.075, statistically weak, 5–2 discordant); discriminate with
  `--event-chance=0` on the doctrine pair, and re-derive the vector
  pair on era content if it stays flat (76h note: it read +0.050
  in-band — the alarm retires to a routine confirm).
- **82-pre (user-called 2026-08-12): the BALANCE audit + primer.**
  Step zero of the phase, before any §82 decision: audit BALANCE.md's
  header layer (current-truth sections vs the append-only run-log;
  retire fossils, consolidate buried amendments) + write the
  plain-English balance primer — CONCEPTS ONLY, numbers/status stay
  in the sheet/BALANCE/ROADMAP (the one-fact-one-home guard);
  consider a docs.test.ts cap on the header (worklog §76h-close).
- **76h riders (user-signed 2026-08-11):** the WALL-FLIP attribution
  — the walk walls moved pull-softened→hardened (0.412/0.481, above
  the signed 30–35); §76's movers are confounded (critable-universal
  / prc-eva / camps-leak) and now entangled with the pull question —
  one `--set` bracket owns both · the NEGATIVE WALK CEILINGS (arb
  −10/−12.5 vs doctrine, paired; plausibly the same wall phenomenon
  via horizon blindness) · the gambler premise UPDATE: §76's organic
  luck movers did not close the gap (regen-shape −22.5) · ⭐ the
  n=120 PROTOCOL (user call, 2026-08-11): §82's decision-feeding
  arms extend 40→120 seeds via `--seed-offset` 41..120 POOLED with
  the 76h batches (determinism makes the first 40 free) — per-arm SE
  ±7.7→±4.5, clears the n=80 per-item floor (worklog §76h).
