# ROADMAP — Cluster 5 (Map Content), Phases 73–83

The cluster's PLAN (authored + user-locked 2026-08-05 at the spec
session; it stays a plan for its whole life). The signed design
decisions live in [cluster-5-spec.md](cluster-5-spec.md) §Kickoff
resolutions; audit findings + rationale in [WORKLOG.md](WORKLOG.md)
§Kickoff; live status is HANDOFF's 🧭 Cursor. Sub-steps are cut at
each phase kickoff (AGENTS "The planning stack"), never here.

**Ordering in one breath:** tooling before the long haul (§73);
events before its two consumers (§77 gen-rework, §83 balance); ALL
content movers (§§74–76) before the single re-baseline point (§77);
cosmetic/docs phases where they can't perturb pins (§§78–80); balance
last, on final content (§83, née §82 née §81 — renumbered 2026-08-09
when the procedural-parity phase claimed §81, and again 2026-08-17
when the §82 feel round was inserted: reward-table/weapon feel
changes are CONTENT MOVERS, so they land before the closing board
measures final content). The gambler parity repair was DELIBERATELY
moved from the opener to the closing rebalance (user call,
2026-08-05): repair constants tuned before §§74–76 puree the numbers
would be re-derived anyway; the breach rides meanwhile as the named
sheet rider it already is.

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
  (§83 re-reads) + singleton rule; decisions.csv rows. Worklog §74g.
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
(composition rotated — three riders + the n=120 protocol → §83,
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
  riders + the n=120 protocol → §83 (BALANCE 2026-08-11, worklog §76h)
- [x] 76i — docs close ✅ 2026-08-12 (`e019202`; box flipped late,
  caught at the §77 kickoff)

## Phase 77 — Sector-map generation rework ✅ CLOSED 2026-08-13

**Outcome:** the BRAID generator end to end — the keyed
per-occurrence RNG re-architecture (Run **v41→v42**, World v35 held;
gotcha #125), lanes/split-merge structure + the quota kind layer,
every signed 77c row gated at n=500 (`tests/nodemap-metrics.test.ts`,
0 FAIL), dials + 4 semantics changes user-signed, and the
braid-world stress board **0 FAIL / 4 WARN** (all §83-named; refs
re-signed 2026-08-13 — the sheet's third amendment). Detail:
WORKLOG §§77–77g · BALANCE §77f · gotcha #125.

- [x] 77a — visualizer ✅ 2026-08-12: `tools/nodemap-viz/` live +
  card re-described; parity-probed + DOM-proven (worklog §77a)
- [x] 77b — metrics + baseline ✅ 2026-08-12: `mapMetrics.ts` + CLI +
  overlay; 500 seeds confirm every complaint (worklog §77b = sheet)
- [x] 77c — ✅ DECIDED 2026-08-12: the threshold sheet signed, one
  amendment — events/route ≈3, band 2.5–3.5 (worklog §77c)
- [x] 77d1 — ✅ 2026-08-12: `deriveSeed`/`deriveRng` + the 22-key
  registry + pinned vectors + independence tests (worklog §77d1)
- [x] 77d2 — ✅ 2026-08-12: the Run conversion — **v41→v42**
  (streamRoot + 3 counters replace 10 RNG states); port canary
  re-pinned 3→2 (worklog §77d2)
- [x] 77d3 — ✅ 2026-08-12: battle-side keyed (terrain/spawnSetup/
  campSetup/enemyPull; burn + alignment forks dead; mixSeeds folded
  in); **World v35 HELD**; docs sweep + gotcha #125 (worklog §77d3)
- 77e — RE-SCOPED 2026-08-12 (user-signed design round): the full
  **braid/lane overhaul** replaces the staircase — lanes are the
  primitive, split/merge ops + a per-lane kind state machine w/ a
  per-hop arbiter; the sheet reads natively in path primitives,
  rejection shrinks to a guard (worklog §77e). Cut:
  - [x] 77e1–e3 — ✅ 2026-08-12/13: e1 the braid skeleton (d2 cap
    constructive) · e2 the quota layer + n=500 gates (every signed
    row w/ margin) · e2b the shear instrument + handedness gate
    (per-map drift kept as texture) · e3 dials signed + corridors
    kept + 4 ratifications + the MapScreen lane-pitch rider
    (worklog §§77e–77e3)
- [x] 77f — ✅ 2026-08-13: fuzz pins self-healed in-phase; the full
  15-row board on the box — **0 FAIL / 7 WARN**, the signed
  architecture HELD; stress read → BALANCE §77f; ref re-pins
  await the user's signature (worklog §77f)
- [x] 77g — ✅ 2026-08-13: refs re-signed (sheet amendment 3) ·
  demote · cursor flip (worklog §77g)

## Phase 78 — UI/UX batch ✅ CLOSED 2026-08-14

**Outcome (one breath):** the whole batch user-confirmed — click
semantics remapped (unarmed left=engage / right=focus, arming
survives and outranks) + enlarged pane buttons; HUD enemy-card
targeting via `ObjectiveControls.setOn` (player cards deliberately
inert); the empower per-key widening (`EmpowerStackView` through
Run + 4 payloads + 6 test sites — the merged-hover bug dead, NO
bump as predicted); `EMPOWER_DISPLAY` colors + in-battle markers
(+ the parked-countdown-clock fix); the read-only sector-map
overlay (chip + `M` + clickable close). Tests 2613→2616; Run v42 /
World v35 HELD; ⭐ DESIGN §Input accessibility signed (pure
mouse/touch always sufficient); two TODOs filed (empower naming
collision · color-config hoist); the UI style & robustness audit
slotted as a post-C5 interstitial phase (META-ROADMAP). Detail:
WORKLOG §§78-kickoff–78f + git.

- [x] 78a — ✅ 2026-08-13: click semantics + larger buttons landed to
  plan; all four semantics bus-event-proven; native eyeball rides
  with the user (worklog §78a)
- [x] 78b — ✅ 2026-08-13: `setOn` + enemy-card targeting landed to
  plan; all branches bus-event-proven incl. dead/reaped-card inert;
  native eyeball rides with the user (worklog §78b)
- [x] 78c — ✅ 2026-08-13: `EmpowerStackView[][]` through Run + the 4
  payloads + 6 test sites; per-key chips + un-merged hover
  browser-proven (Empowered/Hyped distinct on one card); no bump,
  as predicted (worklog §78c)
- [x] 78d — ✅ 2026-08-14: EMPOWER_DISPLAY (coverage-pinned ×3) +
  colored chips + the in-battle marker row, browser-proven end to
  end; native eyeball rides with the user (worklog §78d)
- [x] 78e — ✅ 2026-08-14: readOnly MapScreen + SectorMapOverlay +
  `M` + the chrome chip; all scene rules + toggle/Esc/no-dispatch
  browser-proven; native eyeball rides with the user (worklog §78e)
- [x] 78f — ✅ 2026-08-14: docs close, box flipped ON TIME (worklog
  §78f)

## Phase 79 — Glyph targeted fix ✅ CLOSED 2026-08-16

Opened as a targeted fix (camera-up anchor + ink click-boxes),
closed having replaced the anchor CONVENTION, added a
font-provenance guarantee and fixed a live licence breach.
Edge-glyph drift **9.1px → 0.0000px**; **47/47** glyphs now from
JetBrains Mono (was 45/47). Render-only — no snapshot bump. The
§76f font/style-axis rider resolved at 79f: DEFER, trigger not
fired. Detail: WORKLOG §§79-kickoff–79h + git.

- [x] 79a ink clickboxes · [x] 79b the ±9px diagnosis · [x] 79c the
  mechanism (behavior-neutral) · [x] 79d the flip (I2+J3 retired)
- [x] 79d2 the BASELINE stand-line rule + N×N riders (INSERTED)
- [x] 79e the tune pass → went structural (churn killed,
  `FOOTPRINT_LIFT_PX` retired, ink-top anchor reverses 79d2's
  uniform line)
- [x] 79f style-axis scoping → DEFER; §83's real constraint is the
  47/48 atlas grid (~5-line bump)
- [x] 79g self-hosted JBM subset + OFL compliance (INSERTED)
- [x] 79h the exit eyeball, user-signed; TODO #79 + #81 closed
- [x] 79-post fresh-eyes audit (same day): the live-breach overclaim
  corrected (closes at the next hand-uploaded deploy) + the
  every-`npm test` font-coverage guard + `INK_FLOOR_EPSILON` —
  worklog §79-post

## Phase 80 — Feasibility audit docs ✅ CLOSED 2026-08-16

**Outcome:** the five C6 planning docs live in the NEW `plans/`
directory, each closing with a "what Cluster 6 must not break"
section; achievements + tutorial explicitly confirm the C6
persistent-store dependency (the exit criterion) — ONE store, four
consumers, versioned from day one. Headliners: the sound census
correction + the coverage-pin proposal · determinism ⇒ the
scripted tutorial (a pinned RunConfig) and trace-replay telemetry
(build-id = the structural finding) · the music volume-axis split
lands BEFORE the C6 slider. Docs-only; user doc-review rides.
Detail: WORKLOG §§80–80e + plans/.

- [x] 80a — ✅ 2026-08-16: `plans/sound-registry.md` — full census
  (the event-keyed half is 7 closures, NOT the spec's ~30 — the gap
  is the missing coverage guarantee) + the EVENT_SOUNDS/SILENT_EVENTS
  proposal with a coverage pin (worklog §80a)
- [x] 80b — ✅ 2026-08-16: `plans/music.md` — hybrid Web-Audio music
  lane (SFX pooling untouched) · bus/axis split BEFORE the C6
  slider · any-gesture unlock (the map-click assumption is false
  for music) · assets = the long pole, two routes dispositioned
  (worklog §80b)
- [x] 80c — ✅ 2026-08-16: `plans/achievements.md` +
  `plans/tutorial.md` — the C6 store dependency EXPLICITLY confirmed
  in both (the exit criterion); one store, four consumers, versioned
  from day one; the tutorial's strongest fact = determinism makes a
  scripted teaching run a pinned RunConfig, not a hint engine
  (worklog §80c)
- [x] 80d — ✅ 2026-08-16: `plans/telemetry.md` — determinism makes
  the payload a trace (seed+commands+BUILD ID), analysis reuses the
  offline instrument kit; manual export recommended as v1 (the
  always-up ingest is a new ops burden the §62 model avoids); the
  stale-live-build confound is the structural finding (worklog §80d)
- [x] 80e — ✅ 2026-08-16: docs close — ROADMAP demote · HANDOFF
  cursor flip · META-ROADMAP C6 pointer (worklog §80e)

## Phase 81 — Procedural parity ("Uncharted Ground") ✅ CLOSED 2026-08-17

**Outcome (one breath):** procedural boards reached content parity in
ONE day, all user-signed — the per-theme tile envelope (§37 tiles in
gen; volcanic sparse fire REVERTED IN by user call; deep water blocks
+ counts in the cap + drains to shallow in both guards) · per-theme
camp pools + density 35/45/20 + the pair/midBand/rare-free placement
roll (45/45/10; volcanic pool deliberately EMPTY) · the camp dose
structurally terrain-independent (placed last) · + the 81c2 eyeball
insertion (`startGroundLerp` climb-early/descend-late Y — the
low→high ground clip dead, §79 anchor math untouched). NO snapshot
bump (Run v42 / World v35 held, both predicted); the feared
procedural-arm re-pin cost ONE scan-widening + one catapult re-seed.
Detail: WORKLOG §§81-kickoff–81d · DESIGN §Procedural parity · git.

- [x] 81a tile layer ✅ · [x] 81b camps ✅ · [x] 81c design round
  ALL SIGNED ✅ · [x] 81c2 ground-clip fix (INSERTED) ✅ ·
- [x] 81d docs close ✅ 2026-08-17

## Phase 82 — Reward & weapon feel round ✅ CLOSED 2026-08-17

The feel-round insertion, opened and closed in one day, every change
user-signed. Reward tables went SINGLE-TYPE (the mixed-table split:
pure bits/packets/daemons tables, tier-pure wiring, elite/boss
daemons@1 — the signed generosity jumps); `rewardOverride` widened
to a ref list (**Run v42→v43** — the charter's no-bump guard
consciously amended, the stop-and-ask fired as designed); the
catapult gained the release gate (hold fire + speed-scaled re-aim +
the amber drain bar — the wind-up is real counterplay now); halberd/
pistol user-tuned; both editors follow. Detail: WORKLOG §82 + git.

- [x] 82a — bits⇄packets mixed-table split + wiring (`dc34814`)
- [x] 82b — tier-pure split: shared `daemons` / `packets-elite` /
  `packets-boss` / `bits-boss`; daemons@1 on elites+bosses
  (`5ad54f6`)
- [x] 82c — `rewardOverride` → ref list, **Run v42→v43**; the
  hostage-trio third override surfaced + converted (`b6b72e2`)
- [x] 82d — event-editor override ref-list UI (`1b09579`)
- [x] 82e0–e3 — halberd/pistol tuning · the catapult `releaseGate`
  (schema+sim, 8 tests, NO bump) · the amber drain re-aim bar ·
  attack-editor controls (`33925e2`/`be551b2`/`6ec7874`/`2f53cd6`)
- [x] the A design (impact recheck) — ✅ DECIDED NOT NEEDED (user
  playtest verdict; the ~5-line shape stays in the worklog)

## Phase 83 — The closing rebalance + cluster close

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
- **75l riders (user-signed 2026-08-10):** ✅ BOTH RESOLVED — the
  boss-board pull question → decided at 83d (the BOSS EXEMPTION);
  the fire-channel re-read → RETIRED batchless at 83c (the
  discriminate's trigger never fired; worklog §83c).
- **83-pre (user-called 2026-08-12): the BALANCE audit + primer** —
  step zero, before any §83 measurement decision; scope carried by
  the 83-pre1/83-pre2 cut lines below (framing: worklog §76h-close).
- **76h riders (user-signed 2026-08-11):** ✅ ALL RESOLVED/EXECUTED —
  the wall-flip attribution closed by supersession (83c) · the
  negative walk ceilings dissolved at 77f · the gambler premise
  consumed by 83a/83b · ⭐ the n=120 protocol standing since 83a
  (paid off on outing #1; pooling corrected to same-HEAD — worklog
  §83a).

**The cut (2026-08-17 kickoff, shape-locked; audit: worklog §83):**

- [x] 83d0 — the boss design round ✅ RESOLVED BY THE USER: real
  sector-2 bosses user-authored at the kickoff (Generalissimo +
  Witch Hunt at the `-deep` budget skeleton, `15ae164`); the
  measurement half moves to 83d.
- [x] 83-pre1 — BALANCE header audit ✅ 2026-08-17: four fossils
  retired · sandwich flattened · sheet refs renumbered (prose-only) ·
  run-log delimiters uniform (worklog §83-pre1)
- [x] 83-pre2 — the primer ✅ 2026-08-18 (number-free, top of
  BALANCE) + the header cap AND the delimiter guard (worklog §83-pre2)
- [x] 83a — baseline board + n=120 ✅ 2026-08-18: 0 FAIL / 9 WARN —
  economy flood · walls 0.40 above band · fire channel at signed ·
  ⭐ parity INVERTS at n=120 (BALANCE 2026-08-18 + worklog §83a)
- [x] 83b — ✅ CLOSED 2026-08-19 (user-signed): diagnosed to the
  wail-panic × sustain-hand mechanism (Queen fights); TWO levers
  shipped (⭐ `statusImmunities` + healer panic immunity `fe0f17f` ·
  wail perPoint 0.3→0.15 `514ef2b`); regen gap −11.7→−7.5, the
  residual NAMED (exit arm 2) + pre-registered for the 83f verdict;
  Queen-side tuning = the open door (worklog §83b parts 1–5 ·
  BALANCE 2026-08-18/19 ×4)
- [x] 83c — ✅ 2026-08-20: fire alarm retired batchless; the pull
  OUTCOME-IRRELEVANT at n=120 → a design-grounds decision; rider:
  the 83b levers hardened walls +0.10 (worklog §83c · BALANCE 2026-08-20)
- [x] 83d — ✅ CLOSED 2026-08-20, all user-signed: bosses tie 16:16 ·
  the pull's BOSS EXEMPTION (`49b1b00`, **Run v43→v44**) · dose
  SIGNED ×1.075 (`ca4b042`); confirm walls ACCEPTED, "floor-hugging"
  → an 83f watch (worklog §83d · BALANCE 2026-08-20 ×2)
- [x] 83e — ✅ CLOSED 2026-08-21 (user-signed): zero-batch reads ·
  economy ACCEPT · ladder TABULAR (fold + ε-floor → the interstitial) ·
  the camps probe (`sim.campsStartHostile`; forced engagement
  net-negative → DOCUMENTED) · 55pre RE-PIN; the campRaid nominator +
  the vector re-derive = fold riders (worklog §83e · BALANCE 08-20/21)
- [x] 83f — ✅ CLOSED 2026-08-21 (user-signed): the overnight board
  (23/23 at `aa763f0`, n=120 extensions) + the standard amendment
  (⭐ `pre55ReachRef` 0.542; bands unchanged); 0 FAIL / 6 WARN;
  parity regen inside ±5, 55pre breaches ride the re-derive; walls
  ACCEPTED (worklog §83f · BALANCE 2026-08-21 ×3)
- [x] 83f2 — ✅ 2026-08-21: the shared "Immune to" editor row (both
  arms; omit-when-empty) + the NEUTRAL-arm formatter emit (a latent
  83b gap) + the both-arms round-trip test; byte pin untouched;
  browser-driven (worklog §83f2)
- [ ] 83g — the cluster close ritual (demote · archive · scratchpad
  sweep · cursor flip; next = the UI-audit interstitial)
