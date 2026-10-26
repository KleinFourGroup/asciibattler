# META-ROADMAP v2 — The road to ship (Post-Cluster-5)

The single source of truth for the **order in which the remaining work gets
built**, and why that order minimizes re-authoring. This is the index above
`ROADMAP.md`: each **round** here becomes its own roadmap + spec when its turn
comes. `DESIGN.md` says *what* we're building; `ARCHITECTURE.md` says *how the
code is shaped*; `ROADMAP.md` is the *current* in-flight round; this file is
the *meta-order* across the rounds still to come.

**Status:** Locked 2026-08-21 at the post-Cluster-5 planning session; the
old Rounds 9 and 10 re-cut into Rounds 9 to 23 on 2026-10-26 (§133).
**Supersedes** [archive/post-x-meta-roadmap.md](archive/post-x-meta-roadmap.md)
(the six-cluster plan, 2026-06-22 → 2026-08-21 — Clusters 1–5 complete; its
"Cluster 6 — Meta & Ship" and "§Interstitials" sections are dissolved into
Rounds 6–12 below; older docs that cite "META-ROADMAP §Interstitials" or
"Cluster 6" resolve into the archived copy).

---

## How to read this

- **Rounds are ordered.** The order is the product, not the list. "Round"
  replaces the old cluster/interstitial split — every round is a round, with a
  spec, a roadmap, a worklog, and a kickoff (AGENTS §"The planning stack").
  Phase numbering continues from §84.
- Each round carries only its durable parts here: charter, in-scope list,
  why-this-order + hard dependencies, risk, known decision points, exit
  criteria, scope guards. **Sub-steps are cut at the round's kickoff**, never
  here; as-built prose never lands here (the routing table in AGENTS).
- The **Coverage map** at the bottom shows where every carried item landed —
  the old Cluster-6 scope, the §80 `plans/` docs, the TODO watch items, and the
  2026-08-21 feature list. Nothing was dropped; deferrals are named.
- **The one renumbering.** At §133 (2026-10-26) the old Rounds 9 and 10
  were re-cut into Rounds 9 to 23, and the rounds after them renumbered,
  for legibility (the user's call). A reference dated before then to
  Rounds 9 to 12 names an old round:

  | Old round | New rounds |
  |---|---|
  | 9 — Extensions | 9 to 20, by item (the Coverage map) |
  | 10 — Act 3 | 9 to 23, by item: the act design in 9, the acts in 10 and 21 to 23 |
  | 11 — Onboarding & Feel | 24 |
  | 12 — Ship | 25 |

## The ordering principles (carried from v1, one added)

1. **Define a data model before the content that consumes it.** The expensive
   rewrites are re-authoring passes when a schema shifts under shipped content.
2. **Cluster work that touches the same core** — design it once with all
   requirements known.
3. **Seam now, fill later** — a behavior-identical indirection where the
   consumer is still uncertain.
4. **Polish rides its feature.** Only the final global feel sweep waits for ship.
5. **(new) Instruments before the reads that depend on them.** A measurement
   change (the fold, the perf pass, a roster-realism capture) lands BEFORE the
   balance reads it would invalidate — every board run on a soon-superseded arm
   is wasted work. Same shape as #1, applied to the bot.

**Cross-cutting:** every round that touches combat, movement, or the run
economy **closes with a board re-run** against the signed sheet (BALANCE.md);
every amendment re-runs the full board; paired same-seed deltas govern.

## The sequence at a glance

```
 6. Instruments ──┐  ✅ CLOSED 2026-09-02 — the fold + the perf pass + roster realism + the rarity protocol
 §89–94 casualty ┤  ✅ CLOSED 2026-09-08 — the seam floor · the casualty rule KEPT · the rebalance · the sheet re-anchored + signed (the interstitial before 7)
 7. Idioms ───────┤  ✅ CLOSED 2026-09-20 — i18n · the shells · the live bar · tooltips · color / motion / input / layout · the idiom reference SIGNED · the sound registry (§95–§104 + §96.5)
 7.5 The Board ───┤  ✅ CLOSED 2026-09-27 — the projection spike · ortho · pitch 45 · yaw 45 · the ground mark as the team channel · the elevation clauses · the anchor rules 17 → 14 (§105–§109)
 8. Foundations ──┤  ✅ CLOSED 2026-10-11 — the shells · the recorder · the probe kit · the store + the build ID · the run journal · save/load · the menu + settings · Escalation + the unlocks · the itch page OPEN at 0.1.0 (§110–§118 + §117.5, §117.75)
 8.5 Housekeeping ┤  ✅ CLOSED 2026-10-26 — the oracle map · the census · deletions per subsystem, byte-identical · the comment pass · 0.1.1 · the dependency phase · AGENTS as a router · the re-cut (§119–§133 + §124.5)
 9. The frame ────┤  the act design · the board's guards · damage as a range, a trial
10. Act 1 ────────┤  the wilds: ground fauna · the scripted run · the multi-act sheet
11. The roster ───┤  kits · power by rarity · Mars in three · bandits out of the draft
12. Push, pull ───┤  forced movement · the teleport · the cavalier · seven units
13. The unit kit ─┤  lifesteal · specials · global reach · `extends` and its reskins
14. Neutrals ─────┤  the split · `affects` as flags · totems · the aura healer · camp levels
15. The split ────┤  `Run.ts` and `World.ts`, byte-identical
16. The turn ─────┤  fatigue · retreat · optional deploy · injuries · a won turn's reward
17. Deck ─────────┤  deck triggers · three daemons · the port shelf · bit sinks
18. Events ───────┤  event → battle → resume · camp events · ability grants · XP · event art
19. The ground ───┤  traversal profiles · moving 2×2s · ice · mud · swarms
20. The air ──────┤  the second plane · the lift · reach by layer · flyers · the dragon
21. Act 2 ────────┤  the realm in chaos · deserters · the faction leader · dialogue
22. Act 3 ────────┤  the plague · the dark wizard · act-scoped stock
23. Act 4 ────────┤  the secret act · unlocks · Escalation's levers · the bot's check
24. Onboarding & Feel ─┤  tutorial · music · achievements · run summary
25. Ship ─────────┘  Electron + Steamworks · build pipeline · gauntlet #2
```

Dependency edges the order satisfies:

- The fold invalidates every ε-floor and the 55pre vector ⇒ fold before any read (6 first).
- The UI audit sets idioms the menu/settings/tutorial build on; i18n's string
  layer must exist before the audit's per-surface pass (touch each file once) ⇒ 7 before 8, i18n first inside 7.
- Mid-run save makes act-2/3 playtesting possible without replaying act 1 ⇒ Foundations before Content.
- The seams (the effect-op vocabulary, run hooks, traversal, footprints)
  come before the content authored against them, and each seam round
  authors its consumers into the acts already live ⇒ act 1 on built
  mechanisms first (10), the seam rounds (12 to 20), then acts 2 to 4
  (principle #1; the re-cut, 2026-10-26).
- The tutorial is authored against act 1 as last tuned + audited idioms ⇒ Onboarding (24) after the last round that re-reads act 1 (23) and after Idioms.
- Ship is last by definition; telemetry tier 1 is pulled forward to Foundations because round-8/10 playtests want it.

**Signed this session (2026-08-21), standing for every round below:**

- **Ship target = Steam-shaped** (an Electron wrapper over the same `dist/`;
  the Pages build stays the playtest channel; retired 2026-10-11, with itch
  the one public build). Electron over Tauri because it
  bundles Chromium — the WebGL/Web Audio browser matrix collapses to one
  renderer. **Amended 2026-09-26** (the user, at the Round 7.5 close): the
  web build is also the low-friction channel for early players (itch.io,
  from Round 8's close, as an alpha) and stays a supported target until the
  Steam release, because an unsigned EXE is a hard download to ask of a
  stranger. The Electron build stays internal until Steam, so the browser
  matrix it collapses is live until then.
- **The finished run = THREE acts,** and a secret fourth of about three
  hops behind an unlock (amended 2026-10-26 at §133, the user's act
  outline).
- **i18n is IN** — a string layer + locale files + a config-prose convention,
  retrofit before any further content is authored.
- **Save invalidation policy: reject-stale until 1.0.** A save from another
  version is discarded with a message; no migrations. Serialized-shape bumps in
  Rounds 9 to 23 therefore stay cheap. One build-time `BUILD_ID` (semver + commit)
  is shared by the store, the saves, and the telemetry traces.
- **The §80 `plans/` docs are REVIEWED and signed** with one amendment: the
  tutorial is *deterministic board, reactive callouts* — a pinned seed
  guarantees the teaching material is on the first nodes; callouts are
  condition-triggered (first port, first camp aggro, first empower…), never
  sequence-triggered, and **no control is ever disabled**.
- **Flight and the marine share ONE mechanism** — a per-unit `traversal`
  profile — and the Phase-M flight lock is re-audited at that phase's step zero.
  Amended 2026-10-26 at §133: flight adds a second occupancy plane, so a
  flyer may share a tile with a ground unit, if a render spike reads well
  (the lock as signed is the fallback); the profile lands in Round 19 and
  the plane in Round 20.
- **Ice becomes genuinely faster via real <1 tile costs** (the gotcha-#34
  heuristic swap), not a status — so the planner PREFERS ice (a highway with
  an accuracy tax), a legible wager.

---

## Round 6 — Instruments ✅ CLOSED 2026-09-02 (every phase user-signed)

**Charter:** land every measurement change that would invalidate a later
read, then re-sign the sheet ONCE at the end. The balance-instrument round
the Cluster-5 close handed forward, widened by three instrument gaps found
at the planning session.

**In scope**

- **The measured-terminal-prior FOLD** (rung 1 of the 72f ladder, judged
  TABULAR at 83e): fold the decisions.csv per-item aggregates into the
  rollout terminal score. The **ε-floor re-read** rides WITH it (floors tuned
  on the myopic arm would be invalidated). Two signed riders: ⭐ **the
  campRaid nominator** (a sixth searcher script nominating the §75e neutral
  camp objective — the fold's first genuinely NEW consumer and its validation
  case; pointless before the fold, near-free after) and **the 55pre-vector
  re-derive** (the fixed anchor's reach overperformance is measured ceiling
  drift; re-derive AFTER the fold for the same reason). The ML rung stays
  CLOSED unless a future board catches the tabular prior drifting.
- **The balancer performance pass — profile-first.** No CPU profile has ever
  been taken; the two benches on record (57d, 69c) found the JSON-round-trip
  clone negligible at 16 units and "the battle sim ~100% of rollout cost." A
  search is up to 7 arms × K=2 × 160 ticks. Levers in the code's shape, to be
  ranked by the profile: amortize the per-candidate clone (every candidate
  clones the IDENTICAL live state), early-exit decided rollouts / successive
  halving over seeds, and the tick itself (the object-pooling TODO —
  determinism-dangerous, reset discipline airtight). **Byte-identity oracle
  mandatory** (the 47e worktree-pinned fuzz-arm diff); any lever that changes
  a decision is a doctrine change, not a speedup.
- **Roster realism for isolation reads.** Confirmed: `--per-encounter`
  isolation fields the character's STARTING roster at `startingLevel` unless
  `--roster` is hand-typed, and the enemy budget is player-relative — BALANCE
  already flags the instrument "differential only." Build the capture
  (per-hop archetype composition on `BattleResult` beside `playerLevels`; the
  team is already in hand) + a `--roster=sampled:<hop>` mode drawn from the
  recorded distribution, then **re-read the X3 per-kind bands** under it.
- **The rarity verification protocol.** The 5/3/3/2 tiers were a design
  judgment over bot-preference weights ("bot preference ≠ human power"); the
  §76f four were tiered with no read; the shipping checklist's realized-value
  item was never discharged for them; no board row mentions rarity. Build it:
  paired same-seed `--grant=<archetype>` deltas at the n=80 floor for all 23
  archetypes (one overnight box cohort), tiers + prices re-read against
  realized value; **standing for every new archetype from Round 9 on**.
- Closes with **ONE sheet amendment** (the standard ritual, pre-registered at
  83f: the sheet signs at the post-fold arm) — not one per item.

**Why this order inside the round:** fold → perf → roster → rarity. The perf
pass must be byte-identical so it can go anywhere, but running it second means
the rarity cohort (the largest batch) runs on the faster balancer.
**Depends on:** nothing — the C5 sheet rode in at 0 FAIL / 6 WARN.
**Risk:** medium (the fold changes the doctrine arm; the perf pass touches the
hot loop). **Decision points:** the fold's terminal-score weighting; whether
any perf lever that flips decisions is accepted as doctrine. **Exit:** the
amended sheet signed; `pre55ReachRef` retired or re-pinned; rarity tiers
dispositioned per archetype.
**Scope guards:** no balance CONSTANT moves except through the amendment; no
new content; the UI audit waits for Round 7.

At the kickoff: archive ROADMAP.md + WORKLOG.md + cluster-5-spec.md →
`archive/post-72-roadmap.md` / `-worklog.md` / `archive/cluster-5-spec.md`
(the 41→42 / 46→47 / 72→73 precedent) and author the fresh pair.

**Kickoff 2026-08-22 — spec LOCKED ([archive/round-6-spec.md](archive/round-6-spec.md)).**
The in-scope list above is the planning-session draft; the spec
governs where they differ: the prior's source is NOT decisions.csv
(within-horizon, double-counts) and NOT a `--grant` cohort (linear in
content) but a new **long-horizon shadow instrument** (§84 — the
§71c shadow generalized to a run-end horizon on the acquisition
sites); the campRaid rider is a RUN-LAYER decision site (the battle
evaluator can't see its payout); the rarity read consumes §84's unit
rows. Phases renumbered **§84 instrument → §85 fold → §86 perf → §87
roster → §88 rarity + close**.

**Close 2026-09-02 (88e) — every exit criterion met:** the amended sheet
signed (⭑ 2026-09-02, prose-only — every checked ref PASSED at the
85g6d pins on the first fully-MANIFESTED board); `pre55ReachRef`
RETIRED with the 85g5 re-anchor (finalist-56 DEPLOYED, λ=0.5 SIGNED
into the ARM); rarity tiers dispositioned per archetype (halberdier→rare
· rioter→common · janus 40 · the miner DAEMONIZED as Dis Pater) with the
protocol standing. Beyond the charter: the FAIL-CLOSED board split (86e),
the derived-artifact registry + tripwire (88d2), 3.47×/3.32×/2.95× perf.
Condensed record: HANDOFF §Closed rounds; archives `archive/post-83-*`
+ `archive/round-6-spec.md`. **The encounter feel interstitial (§89–§94) ✅ CLOSED 2026-09-08 — ran BEFORE Round 7; spec-locked 2026-09-02 as THE CASUALTY EXPERIMENT, the first experimental round; the verdict KEEP (§93, 2026-09-05), the sheet re-anchored + signed at 94h (2026-09-08); archives `archive/post-88-*` + `archive/encounter-feel-spec.md`** ([encounter-feel-spec.md](archive/encounter-feel-spec.md)):
the §87d3 questions (per-act bands, inter-sector healing) shared one root
— the chip rule's bimodality + act coupling — so the round builds the
seam floor (kept regardless) and the casualty chip rule under a
pre-registered ⛔ keep-or-rollback stop (§93), then lands the original
defect-list charter against whichever rule wins (§94). Under KEEP the
signed sheet re-anchors as a NEW lineage from per-act clear targets
0.6 / 0.5 / (0.4 for act 3). Four Round 9 lines were written at the
spec session (retreat · optional deploy · the port shelf guarantee ·
injuries — below).

---

## Round 7 — Idioms ✅ CLOSED 2026-09-20 (every phase user-signed)

**Charter:** make every user-facing surface translatable and consistent
BEFORE the rounds that author the biggest remaining UI (menu, settings,
tutorial) and the biggest remaining prose (act 3). Ordering principle #1
applied to UI and to text.

**In scope**

- **The i18n layer (first):** a `t(key)` layer + locale files + the
  config-prose convention (events/encounters/daemons/packets/characters/
  sectors/camps/statuses/units/abilities — ~270 prose fields at the planning
  session — resolved through the locale, not inlined) + **a coverage pin that
  fails on a new hardcoded user-facing literal** (the EMPOWER_DISPLAY idiom).
  Migrates the existing 13 events while they're few. English-only ships; the
  layer is what's being bought.
- **The UI style & robustness audit** (user-raised 2026-08-14): every surface
  vs DESIGN §Input accessibility (pure mouse/touch always sufficient) · the
  layout-stability class ("Y-coordinate hysteresis") · idiom unification
  (chrome chips / modals / buttons) · string extraction per surface in the
  same touch · the carried UI riders (empower naming collision · display-color
  hoist · aura-FX jury → "graduate to settings in Round 8" · the
  sector-cleared/win sting · the event screen's pool gauge · the RNG/`rng`
  label · the HUD stat line). **Exit artifact: a written idiom reference**
  (DESIGN §UI idioms) that Rounds 8 and 11 are checked against — the audit
  fixes the class, not instances.
- **The event-keyed sound registry** (`plans/sound-registry.md`): `EVENT_SOUNDS`
  + `SILENT_EVENTS` + the coverage pin; 7 closures retired. Store-independent;
  rides here as the cheap tail.

**Depends on:** Round 6 closed (✅ 2026-09-02) AND the encounter feel interstitial (§89+; its board work must not overlap this round; no board work in flight — this round never
touches sim). **Risk:** low-medium (wide but shallow; the string pin is the
only new gate). **Decision points:** the locale-file shape for config prose
(sidecar `events.en.json` vs `textKey` indirection); 2-vs-3 volume axes is
NOT here (Round 8). **Exit:** the literal pin green; the idiom reference
signed; the accessibility rule audited on every surface.
**Scope guards:** no new screens (the menu is Round 8); no translation work
beyond English; no sim change — **ONE snapshot bump authorized at the
2026-09-09 spec (the empower buff-key rename, Run v45 → v46)**.

**Kicked off 2026-09-09** — the spec [round-7-spec.md](archive/round-7-spec.md)
(twelve resolutions, user-signed) over the code-reality audit
(`archive/post-94-worklog.md` §Kickoff: 297 config prose fields, ≈260 UI literals, the accessibility
state); the cut is ten phases §95–§104 (ROADMAP; **§96.5 — the live pool
bar + the chip rule — inserted 2026-09-10** from the §95 playtest, the `.5`
convention applied to a phase). The locale shape ⛔ →
**the sidecar** (English inline in config; other locales derived, with
per-entry provenance). The team-identity channel and the glyph-alignment
rework were lifted OUT into Round 7.5.

**CLOSED 2026-09-20** — all ten phases + §96.5 user-signed; the exit met (the
literal pin at an EMPTY baseline · the idiom reference signed at §103 · the
accessibility rule audited per surface). The close ritual re-chartered Round
7.5 (below), ran the first efficacy + welfare reads, and put "reads are cut,
not improvised" on trial. Archives: `archive/post-94-roadmap.md` +
`-worklog.md` + `round-7-spec.md` + `retro-scratchpad-round-7.md`.

---

## Round 7.5 — The Board ✅ CLOSED 2026-09-27 (every phase user-signed)

_(Re-chartered 2026-09-20 at the Round 7 close's macro re-audit —
user-signed (the text read and approved the same day); the 2026-09-09 entry, "Units", chartered a glyph-RULE rework
and is superseded. The argument, the three code sweeps and the rejected
alternatives: WORKLOG §The Round 7 close, C1 → `archive/post-94-worklog.md`.
**HARDENED 2026-09-21 at the round's kickoff, user-signed** — the control
can win, the spike is an EXPLORATION under pre-registered constraints, two
premises corrected against code: `archive/post-104-worklog.md` §Kickoff.)_

**Charter:** how the board is PROJECTED and how a unit stands on it. The
glyph-alignment stack (16 rules at the 2026-09-21 audit, 20 with §101's
gates; the table is `archive/post-104-worklog.md` §Kickoff — "too many special rules to get
something that only 90% works, and brittle", the user, 2026-09-09) is a
symptom: glyph quads are axis-aligned in SCREEN space while the ground
lives in perspective WORLD space (a world vertical leans ≈24° at a fitted
board's flank, ≈40° at the screen edge — derived, the spike measures it),
and the glyph's inked foot is the only grounding cue. _(Two corrections at
the kickoff: §79 already made everything that stacks rise CAMERA-up, so a
float no longer drifts and a tether no longer leans under today's camera;
and the ANCHOR is already per-class — two values, 4/64 of a cell apart,
measured — so the per-glyph behaviour lives in the three LIFTS, chiefly the
bar line the user chose at §79e, half of whose motive is perspective.)_
Tuning those rules would not survive flyers. So: **settle the projection
first** (the leading candidate is an ORTHOGRAPHIC camera, under which a
camera-facing billboard IS a world-space rectangle; head-on vs a 45° yaw,
the pitch in BOTH directions and a long lens are open dials, **and today's
perspective camera can win — a tie goes to it**, because a projection
change costs a build), **then** anchor the CELL against a separate ground cue and delete
the ink-anchoring rules that cue makes unnecessary; give team identity its
non-color channel (DESIGN "Team identity on the board", five clauses); write
the **"Elevation on the board"** requirement Round 9's flyer must satisfy;
and re-pose the D4 camera question under the chosen projection.

**In scope**

- **The projection spike (FIRST — the Round 8 Electron-spike shape: it
  informs the spec, which is written after it) — §105 pass one, §106 pass
  two + the spec.** Dev-only, render-only, an EXPLORATION of a presentation
  space rather than a hypothesis test (the user, 2026-09-21: "I expect to
  find one that looks directionally best, and then we'll refine"): a live
  dial panel with its state in the URL, run as a FULL CROSS — every
  treatment on every projection (perspective at 50° AND a long lens,
  re-admitted as a candidate · orthographic; pitch both ways from 45°; yaw
  0 / 45 on each, perspective + yaw included) · the treatments: a
  ground-cue mock, shape per side, read under Ctrl+Alt+G · the anchor mode
  and the BAR LINE (ink-top vs uniform — the §79e reversal re-posed) · a
  camera-up FAKE FLYER with a shadow and a north neighbour · glyph scale ·
  the fixtures (a dense melee clump · a 24×24 by seed hunt ·
  `endlessCorridors` · screen-edge units · `rubbleQuarry` · one seeded LIVE
  battle — it is judged in motion) · a headless geometry instrument (lean,
  glyph px at fit per viewport, overlap) whose lean becomes the pin
  "world-up projects to screen-up". **Taste is explored; the CONSTRAINTS
  are pre-registered** (the identity clauses under Ctrl+Alt+G · 24×24 and
  12×32 fit · a lifted unit reads as above its tile · clump overlap ≤
  today's at SOME legible glyph scale · glyph px at fit ≥ today's camera at
  the same viewport) **with the tie-break: a tie goes to perspective.**
  Budget: two passes — coarse, then refine one point (two at the user's
  word); a third means re-cutting. Taste is read on the user's monitor
  (2560×1440) + a ~1280×720 window; every other viewport is a NUMBER.
- **The projection, built** — the camera + the fit math, picking, the DOM
  overlay projection, shake; the camera gotchas (#17, #51–54, #68–69) and
  DESIGN's Camera paragraph re-audited, not assumed.
- **Cell anchoring + the ground cue** — the rule deletion, gated on the H1
  read (§105b: the anchor mode + the bar line, under today's camera — the
  half of the round that pays whatever the projection does). Ink boxes (click targets) and the font-provenance
  gates stay: **§101's gates (`FACES` roles · `PRIMARY_EXCLUDES` · the
  line-box pin · the UI glyph inventory) are OUT of the "fewer rules"
  goal** — signed, permanent.
- **Team identity** — candidates: the ground mark doubling as the channel
  (per instance, tint-proof, atlas-free) · a shader-drawn per-instance mark
  · the DOM overlay's unused `unit-overlay--<team>` class · a marker sprite
  / a shape suffix against a 47 / 48 atlas; ~~a dedicated enemy glyph set~~
  STRUCK 2026-09-18 at the §103 signing (art direction; DESIGN's clauses
  2 + 4 + 5 rule it out). Clause 3's collision is LIVE today (a panicked
  ally is camp-amber).
- **The "Elevation on the board" requirement** → DESIGN, proven on the
  fake flyer. The flyer MECHANIC stays Round 9 (it is sim).
- **The D4 camera A/B, re-posed** — scroll stays a candidate (the user,
  2026-09-19), but under an orthographic camera fit-vs-scroll is a ZOOM
  level, and the spike's glyph-size number may move the question before it
  is run. Unbuilt at the audit: scroll mode is unreachable in a production
  build (its listeners are DEV-only since 100a) · no drag / wheel / touch
  pan (DESIGN §Input accessibility) · no URL dial for tester assignment ·
  no test of either mode · **no minimap — and the 100a rider stands: if a
  windowed view is to be tested it needs a proper minimap FIRST** (the
  board's shape + unit positions + the window rectangle). The winner gets a
  HUD control + a Round 8 default-mode setting _(superseded 2026-09-26: spec
  D7 made fit the only production view, so there is no mode to set)_. **A third candidate
  (2026-09-21): RESPONSIVE fit→window** — fit until glyph px falls under a
  floor, then window (one zoom number under ortho). Desktop fit is legible
  by the user's own read ("the legibility concern is pure overlap rather
  than size"), so the A/B's real consumer is the small screen, and the
  minimap + touch-pan work may belong where mobile is built rather than
  here. Mobile itself is deferred (the user cannot playtest it); 7.5 owes
  it only that the projection does not foreclose it — the per-viewport
  glyph-px constraint above.

**Depends on:** Round 7 (✅ — the idiom reference's team-identity
requirement; the tooltip + shells the board overlays use; Ctrl+Alt+G).
**Risk:** medium, WIDER than first chartered — render-only (never sim, no
snapshot bump), but the projection touches every screen-space seam, and the
whole surface is eyeball-policy: the spike's instruments come first, and
every probe is re-derived from the asset or the camera math, never from the
helper under test (AGENTS). **Decision points:** the projection (today's
perspective · a long lens · head-on / yaw-45 orthographic · the pitch — a
tie goes to perspective; world-space unit quads stay ranked last, they skew
the letterforms §98 / §101 made legible) · whether the bar line can be
uniform again (§79e re-posed) · the ground cue's shape and whether it IS
the identity channel · the elevation requirement's clauses · the windowed
view's fate (fit · scroll · responsive) once the glyph-size number is in.
**Exit:** the projection chosen by the user's eye INSIDE the pre-registered
constraints, played before it is signed, and built (or today's kept, by
the tie-break); world-up = screen-up pinned headless where it holds; the identity
requirement satisfied and grayscale-verified; the elevation requirement
signed; the special-rule count reduced with the probes re-derived; the
camera question read and dispositioned. **Scope guards:** no sim; no flyer
mechanic; no walking N×N; no palette (Round 8); no new archetypes; no
rotatable camera. **Spike-first, then spec, at its own kickoff** — with its
own code-reality audit of what each rule was defending against.

**CLOSED 2026-09-27** — all five phases (§105–§109) user-signed; the exit
met: the projection chosen by the user's eye inside the pre-registered
constraints, played, and built (ortho · pitch 45 · yaw 45, spec D1);
world-up = screen-up pinned headless (`tests/board/cameraFit.test.ts`); the
identity requirement satisfied by the ground mark's shape and
grayscale-verified (§108's grey read); the elevation clauses signed into
DESIGN; the special rules 17 → 14 with the probes re-derived from the atlas;
the camera question dispositioned (fit is the only production view, spec
D7). The close amended Round 8 (below), moved the atlas resize to Round 9,
and kept the reads doctrine. Archives: `archive/post-104-roadmap.md` +
`-worklog.md` + `round-7.5-spec.md` + `retro-scratchpad-round-7.5.md`.

**The `.5` convention (user-signed 2026-09-09):** an unscheduled round
inserted between two planned ones takes the `.5` number (the
`<phase><letter>` form is already the step address). Round numbers are
charter identities and are never renumbered; the phase counter is the
durable ordering key. The macro re-audit joins the close ritual (AGENTS)
so the next `.5` is a line written at a close, not a surprise at a kickoff.

---

## Round 8 — Foundations ✅ CLOSED 2026-10-11 (every phase user-signed)

_(Re-audited 2026-09-26 at the Round 7.5 close's macro re-audit,
user-signed: the camera row struck, the run journal added, three storage
cases, the public web channel at the round's close. The sweeps and the
calls: `archive/post-104-worklog.md` §The Round 7.5 close, C1.)_

**Charter:** the persistent-store keystone and everything that hangs off it.
The store is to this round what the Rule vocabulary was to Cluster 3:
designed ONCE with its four consumers known (save/load · settings ·
achievements · tutorial seen-flags; `plans/` holds the last two, and the
round's spec writes the first two).

**In scope (keystone-then-consumers order)**

- **The shell spike** (one session, first), in both shells. The build runs
  under Electron, writes a file under `userData` and reads it back; and the
  web build, uploaded as a private itch.io draft, keeps `localStorage`
  across reloads inside itch's iframe (itch serves HTML5 games from its own
  CDN domain, and Safari may clear site storage after a stretch without a
  visit: both unverified). In each shell the store is read at boot, before
  the first module that bakes from it: the locale resolves at catalog load
  and reloads the page to switch (`src/i18n/locale.ts`), and a reload-time
  palette would do the same. Informs the store's storage adapter BEFORE its
  shape locks. One more question for the Electron half: can a hidden window
  (background throttling off) run the game's frame loop and hand a probe's
  result back to a Node script, and on which GPU? If yes, an Electron probe
  runner over the kit below becomes an option this round. Three more checks,
  pre-registered for the recorder below (2026-09-28): (1) a window that is
  never shown runs the frame loop at the target rate on the GPU and records
  it; (2) the file carries the game's sound and nothing else (the control:
  another app plays a sound during the recording, and the file must not
  contain it), and nothing reaches the speakers; (3) a battle recorded at
  1080p30 while the user works normally costs nothing they notice (CPU load
  and dropped frames measured; interference with the user's eye tracking
  judged by the user).
- **The background recorder** (signed 2026-09-28), right after the spike if
  its three checks pass; early though it is not the keystone, because
  before/after clips make the round's UI reads cheaper. An Electron recorder
  writes video files of battles, events and runs in real time from a window
  that is never shown, so it runs while the user works, never takes focus
  and plays nothing aloud. The audio is the game's own, taken inside the
  page: in record mode `AudioPlayer` routes its `<audio>` pools into the
  recording stream instead of the speakers, so no other sound on the machine
  reaches the file (capturing the system's output would record the user's
  eye-tracker keyboard). The video path, Electron's offscreen rendering or a
  hidden window recording its own page, is the spike's pick. Inputs first:
  a board-explorer fixture, a seed, and before/after at two commits side by
  side; full runs, the user's own included, once the run journal lands. It
  records the Chromium render, and a visible difference from Firefox is a
  bug in one of the two builds. Kickoff calls: ffmpeg as an npm dependency
  or a system install; the default size and rate (1080p30 proposed); clips
  to a gitignored folder.
- **The pane probe kit** (signed 2026-09-26), built before the menus and
  settings, the round's pane-heavy work: a dev-only `__probe` in the page
  that puts the Browser pane's known traps into code instead of tips —
  `ready()` (wait until the page is live), `go(query)` (set the URL only
  after that), `frame()` (render synchronously, so a read never sees the
  previous view), `pixels(rect)` (a crop off the canvas, since the pane's
  zoom can't crop), a canvas-size check on every read, and the whole-run
  driver (`process/browser-pane.md` "Fixtures"). A pane session starts
  with `await __probe.ready()`, and an Electron runner would call the same
  kit. **Pre-registered, checked at the round's close:** (1) papercuts
  from a covered trap (not live yet · a URL overwritten by the pane's
  first load · a stale frame · a timed-out script still running · a 0×0
  canvas · a crop) in the sessions after it lands: at most 1 (Round 7.5
  filed 5); (2) adoption, counted from the transcripts with a known
  answer: every session that drives the pane calls the kit; (3) session
  reports' question 4 naming a covered trap: at most 1 across the round.
  It loses if (1) or (3) exceeds its line or most pane sessions skip it;
  the close then fixes it, moves scripted probes to the Electron runner,
  or retires it. Two instruments, because filing is voluntary: a papercut
  drop alone could be a filing drop.
- **The persistent store:** versioned, reject-stale, a storage-adapter seam
  with three cases (`localStorage` on the Pages site · the same inside
  itch's iframe · a file in Electron), the four consumers designed in;
  fuzz/headless never writes it (Game-layer wiring, not Run/World).
  **Version + invalidation policy lands here:** `BUILD_ID` (nothing bakes
  one yet; `package.json` is `0.0.0`), the store version, the reject-stale
  rule, the player-facing "this save is from another version" message.
- **The run journal** (signed 2026-09-26): the seed, every `RunCommand` and
  the battles' command traces, stamped with the `BUILD_ID`. Nothing records
  a run today: `Run.dispatch` keeps no log, and the battle traces are per
  battle and DEV-only (`src/dev/TraceRecorder.ts`). One journal, three
  consumers: telemetry tier 1's export, the chaos driver's repro, and
  save/load's second oracle (below). It lands before save/load.
- **Save/load + mid-run resume** (`devLoadRun` past map-phase; a
  scene-for-phase resolver, which `Game.devLoadRun`'s landing note says is a
  Run-side re-emit of the phase's gate event, and the sector-cleared
  screen's titles ride its payload today; a storage trigger; a load entry
  point) — **with two oracles.** The chaos fuzz driver: random legal
  `RunCommand` dispatch in every phase, asserting the occupancy invariant +
  snapshot round-trip at every phase transition (the TODO item, promoted;
  the §69b combination-crash finder). And the journal's continuation check:
  a run continued live from a gate, and the same run continued from its
  reloaded snapshot, must end the same. A round-trip alone tests the save
  code against the load code, so a field both sides drop passes it; the X1
  multipliers are one today.
- **Title / main menu** — the UI hub the consumers hang off (new run ·
  continue · settings · achievements · credits · a seed field). _(As
  built: no achievements row; the spec left it hidden until Round 11 has
  its content.)_
- **Settings** — **the volume-axis split FIRST** (SFX / music, ± master —
  decided before any slider is coded, `plans/music.md`; today one master
  axis, with no control wired to it), then the in-game rebind UI (labels
  from the registry; the Fight-now button and the sector-map chip read
  theirs once, and `rebind` has no conflict check), default playback speed,
  the colorblind-safe palette (with the camp unit's status pip, deferred
  from §108: TODO), the aura-FX mode graduated from its console switch, and
  the four seams the code already names as Round 8 settings: the locale,
  the reduced-motion override, the shake policy (TODO) and the text scale
  (DESIGN "Tokens"). _(As built: the locale is a stored field and a boot
  seam with no row in Settings; the row comes with a second locale, the
  §116 audit's call 6.)_
- **Difficulty / ascension** (groundwork: ~~per-speed enable, the
  focus-tile switch,~~ the X1 multipliers; the first two STRUCK by the
  spec, D8) + **the unlock MECHANISM** (cross-run unlocks
  resolve at run creation only; the content MAPPING waits for Round 10).
  The level is saved in the RunSnapshot (a Run bump): today `Run.fromJSON`
  re-resolves the X1 multipliers to their defaults, and the focus-tile
  switch and per-speed enable are page-global, not per run.
- **Telemetry tier 1** (`plans/telemetry.md`): the export button over the
  journal; no ingest server unless tier 1 provably loses data.
- **The public web channel** (the user, 2026-09-26): at the round's close
  the web build goes up on itch.io as an alpha, the early-player channel an
  unsigned EXE can't be. The Pages build stays the playtest channel; the
  Electron build stays internal until Steam. Before it goes up: a browser
  smoke (Firefox · Chrome; Safari best-effort and untested, with no Apple
  device to test on), and a how-to-play on the itch page standing in for
  Round 11's tutorial. Strangers' exported journals are raw material for
  the human anchor Round 12 re-records, though not its protocol.
  **The release policy since 2026-10-11** (the user, at the round's
  close): the page opened at `0.1.0` on 2026-10-10 and the Pages site is
  retired, so itch is the one public build. It is updated at each round's
  close, each upload tagged. A critical fix between rounds is a patch
  release built from the last uploaded tag on a short-lived branch, since
  `main` may hold a save-format bump. A bump is expected every round while
  features and content are landing, and a migration system is considered
  only if rejected saves become a problem.
  **The version** (the user, 2026-10-23, replacing Round 8's milestone
  rule): release status . features . fixes. The first number is 0 until
  the Steam release, `1.0`. The middle goes up when a returning player
  would find something new or changed in play (content, mechanics,
  balance, a feature), or when the upload rejects runs saved by the one
  before it. The last goes up for everything else (fixes, performance,
  internal work, dependencies), so an upload that moves only the last
  number keeps a run in progress. `0.1.1`, the Round 8.5 upload, is the
  first under it.
- Closes with a board re-run (ascension is a balance surface).

**Depends on:** Round 7 (the menu/settings build on audited idioms + the
string layer) and Round 7.5 (✅: fit is the only production view, spec D7,
so settings carry no camera-mode row; the colorblind palette lands on a
board whose team channel is the ground mark's shape, not a hue). **Risk:** medium-high (the store is the most-depended-on meta
model left; save/load touches every phase). **Decision points:** 2-vs-3 volume
axes; what ascension levels DO (dose, pool, draw?) — a design round; whether
mid-run save is manual, auto-at-gate, or both; the palette swap, on reload
(as the locale) or live (sprite and mark colours are set at spawn, the FX
table at module load, and the HP gradient and the status hues are raw hex,
so a live swap re-stamps them all); what a save is rejected on, a
snapshot-schema change or any `BUILD_ID` change (the second wipes every run
in progress at each upload, harsher once strangers play). **Exit:** a run
saved at any gate reloads byte-faithfully (the chaos driver and the
continuation check green); settings persist across reloads; the menu is the
boot screen; the public web channel is open.
**Scope guards:** no achievements/tutorial CONTENT (Round 11 — the store's
consumer seams only); no unlock content mapping; no music.

**CLOSED 2026-10-11** — eleven phases (§110–§118, with §117.5 the UI
sweep and §117.75 the rest gate inserted), each closed on the user's read,
the close's last step included. The exit met, clause by clause (the close's C0): a run saved at any gate
reloads byte-faithfully (`tests/integration/resume-gates.test.ts`, total
over the eleven phases a run is saved at; the continuation check and the
chaos driver green on every `npm test`); settings persist across reloads
(`src/settings/settings.test.ts` and the user's reads); the menu is the
boot screen (`src/scenes/menuRules.ts`); the public web channel is open
(the user, 2026-10-10, at `0.1.0`). The board re-run: Escalation off
reproduces the signed sheet byte for byte under the prior table it was
measured under, and the ladder's steps read harder at levels 1, 2, 4 and
5, with level 3 kept as an economy step (the exit as amended, 118e).
**Against the charter:** per-speed enable and the focus-tile switch were
struck by the spec; the locale has no row in Settings; the achievements
row went to Round 11; achievements and seen-flags, two of the store's four
consumers, are a comment and one field (`creditsSeen`), a seam with no
design past it; the continuation check does not use the journal's seam
(the journal's own check across a load is
`tests/integration/journal-across-loads.test.ts`); Edge stood in for
Chrome, and two lines of the smoke are carried (TODO "Round 8.5"). The
chaos driver's every-commit seeds send every command kind and change the
run with thirteen of 21, which is why Round 8.5 opens with an oracle map.
The scope guards held. Outside the charter, each signed as it came: the
UI sweep, the rest gate (Run v49), the first three events' rewrite, the
credits. The close retired the Pages site, set the release policy above,
re-audited Round 8.5 and wrote the notes under Rounds 9 to 12. Archives:
`archive/post-109-roadmap.md` + `-worklog.md` + `round-8-spec.md` +
`retro-scratchpad-round-8.md`.

---

## Round 8.5 — Housekeeping ✅ CLOSED 2026-10-26

_(Inserted 2026-09-27, after the Round 7.5 close, user-signed: the user
raised a broader codebase review, and the tone audit's source-comment
rewrite folds into it. The `.5` convention, applied.)_

_(Re-audited 2026-10-11 at the Round 8 close, user-signed: an oracle map
ahead of the census, save-format bumps allowed, a TODO pass, the comment
rewrite resized, and a shell-quoting audit at the round's close. The sweeps
and the calls: `archive/post-109-worklog.md` "118j — the round close", C1
and C5.)_

_(Amended 2026-10-11 at the kickoff, user-signed: reshaping is let in by
trial beside the deletions, a second form of byte identity covers a change
that renames what is stored, the oracle map gains two proofs, and the
comment pass aims at length. The user's intent, verbatim, and the four
signed decisions: `archive/round-8.5-spec.md`.)_

**Charter:** less code with the same behaviour, before Round 9 builds its
seams on the core, and a code base "in a more approachable format than
when we began" (the user, 2026-10-11). The engine has grown by accretion
for months with little deletion: dials that no longer move, duplicate
implementations, workarounds that could be smoothed, tests that pin
removed code. Deletion first, and reshaping only by trial: what a search
can prove dead is listed, signed and deleted; a unification, a merge or a
split is tried, held against a bar written before it, and reverted if it
falls under (the spec's D1 and D2). No new abstractions (AGENTS), and a
documented no-op is an acceptable outcome.

**In scope**

- **The oracle map (first):** for each part of the code, what proves a
  deletion there changed nothing, each proof shown to fail on a planted
  break, so that every census candidate names the oracle that covers it.
  It builds: a journal corpus recorded at the round's baseline (about
  thirty headless runs, with a count of the gates and commands they
  reach); the chaos census pinned on commands that change the run, for the
  kinds its seeds reach (thirteen of 21 at the Round 8 close; the port
  trades and the sector-cleared gate only if the census wants to delete
  there); a tool-only flag to replay past a config mismatch, so a journal
  can say whether a knob is dead (`configHash()` covers every
  `config/*.json` as authored, so without it one removed key refuses every
  earlier journal; the kickoff's shape-lock confirms the flag); a
  field-by-field diff of the end snapshot, for a deletion that slims the
  save; and a count of step codes in `src` comments that may only fall.
  Two more since the kickoff: a declared mapping back to the old names,
  for a change that renames what is stored, and parsed-config equality,
  for a config move.
- **The census (headless):** the candidates, each with its
  evidence, in two lists since the kickoff: what a search proves dead,
  and the trials, each with what it expects to remove and the proof that
  covers it. Every config knob, `RunConfig` field and URL dial, with
  whether any value but its default is used anywhere (config, tests, the
  balance arms, scripts); duplicate implementations; tests that pin
  removed code or duplicate another's coverage; unused exports. Each
  candidate is checked against GOTCHAS before it is listed, and the user
  signs the list before anything is deleted. Its first step is a drawn
  sample of planted breaks, so that what the proofs notice is measured
  and not assumed (signed 2026-10-12; `archive/post-118-roadmap.md` §120).
- **The deletions, one subsystem per phase** (sim · run · render and UI ·
  the bot and fuzz instruments · tests), each followed by that
  subsystem's comment pass. Sized at the census's close (2026-10-14,
  user-signed): a phase for the dials goes first, a phase for the tools
  after the five, then the close and the dependency phase;
  `archive/post-118-roadmap.md` §121 to §129. Within a subsystem the signed deletions come
  first, then its trials, then one re-skim for what the changes exposed.
- **The source-comment rewrite** (the tone audit's TODO, 2026-09-23): the
  phase codes rewritten out of `src/` comments under AGENTS "Voice",
  about 2,000 `§` marks across 269 files at the 7.5 close (a raw count
  that includes DESIGN section refs). At the Round 8 close the `§` lines
  are where they were (1,972 in 281 files), and Round 8 wrote its own step
  codes bare ("115e —"): about 2,400 in 295 files by a rough count, some
  255 of them that round's. Done per file in the deletion's
  touch, because resolving a code means reading what it justifies, which
  is the census's question; committed apart from the deletions, because
  the two have different oracles (a comment-stripped before/after diff
  with a failing control, against byte-identical runs). Since the kickoff
  the pass aims at the comments' length, and the codes are the part of it
  that can be counted.
- **A dependency phase, after the round's build is tagged** (added
  2026-10-12 at the §119 close, user-signed): the packages brought up to
  date once the cleanup's upload is cut, so that upload stays the same
  game and the new versions get a round of play before they reach anyone.
  Vitest with its coverage tool first; what ships (`three`, `vite`, `zod`)
  with the user's eye and a frame-rate check; each major (TypeScript 7,
  Vitest 5) as its own step with the release notes read first. The state
  on that day: WORKLOG "The close of §119".
- **The TODO pass:** every open rider is done, dropped or given a round.
  Listed and signed at §120 (`archive/round-8.5-census.md` section 5, 2026-10-14):
  of 97 open items, 5 were done, 16 are this round's, 66 went to Rounds
  9 to 12 and 10 were dropped. TODO has one section a round since; this
  round's section is done by the phases.

**Why here:** after Round 8, whose run journal, chaos driver and
continuation check are the strongest oracles for deleting run and sim code
(replay whole runs before and after; principle #5); before Round 9, whose
four seams would otherwise be designed around dead dials (principle #2).
Round 8 mostly adds new code at the Game and UI layers, and reject-stale
keeps a later snapshot slimming cheap. The alternative, before Round 8,
would design the save format on a slimmer Run at the cost of those
oracles. As built (the Round 8 close, C1): a replay on another commit has
to be forced, a config mismatch cannot be, no journal is stored in the
repo, and the chaos driver's every-commit seeds never reach the
sector-cleared gate or a port trade. That is why the oracle map comes
first.

**Depends on:** Round 8 (the journal and the chaos driver). **Risk:**
medium: wide, and in the core, but every deletion is gated on an oracle.
**Decision points:** each dial's fate, per dial (unchanged for months is
not enough: the balance instruments Rounds 10 and 12 lean on may need it);
whether a test is redundant; each trial's verdict against the bar; the
round's size, known only after the census. Resolved 2026-10-11: the save format may bump, more than once
(the itch build is updated at the round's close only, so a player meets
one rejected save a round). **Exit:** the signed census dispositioned (deleted, kept with a
reason, or moved to TODO); each trial kept over the bar or reverted and
recorded; every deletion in sim, run and config
byte-identical under the journal corpus and the fuzz diff, the two proofs
that hold the new tree against something kept from before the change
(corrected at §119: the determinism test and the fuzz smoke's other tests
compare a tree with itself, so they stay green as gates and prove nothing
across a commit; TESTING.md "The oracle map" says which proof reaches which
code); the comment pass done under its oracle; the TODO pass done; and
the shell-quoting audit run (pre-registered with the Shell rule's
retirement: every shell command in the round's transcripts that sent a
backslash through a heredoc or an inline script, held against what landed
in the file, with a planted case the audit must find; a wrong result
found in a commit brings the rule back with a hook). **Scope guards:** no
behaviour change (a deletion that is not byte-identical is a change, and
goes to the user with a board re-run; a save-format bump for a slimmed
snapshot is not one, and neither is a change that renames what is stored
when it is byte-identical after its declared mapping back to the old
names; two display fixes, the battle HUD's enemy notch and the ability
line's damage, are signed exceptions, 2026-10-17, `archive/post-118-worklog.md` §124); no new
abstractions; no gotcha
undone without its entry read; the permanent gates never relaxed; no
balance numbers move.

**CLOSED 2026-10-26** — sixteen phases (§119–§133, with §124.5 the
screens inserted), each closed on the user's read; the close's last step,
the archive, awaits its read as this is written. The exit met, clause by
clause (133f): the census's 162 rows each have an outcome, four of them
placed at the close (A-36's last three members deleted; B-12's and the
sim-and-run leads, B-18 and B-19 to TODO under Rounds 15, 19 and 10);
every trial kept over its bar or reverted, and recorded; every deletion in
sim, run and config byte-identical under the corpus and the fuzz diff, by
the phases' records (§121 to §125), not re-run at the close; the comment
pass under its oracle, `src`'s step codes 6,376 → 0, held by
`tests/comment-codes.test.ts`, with `tests` and `tools` keeping theirs
(§125's decision point); the TODO pass at §120, re-placed by round at
§133; the shell-quoting audit at 130e, whose tripwire fired once (a false
sentence in a record, from a halved grep), its hook settled at §132 as
the context meter's note. The output, by `comment-length` at `5d2cdaf`
and at the close: `src`'s code lines 37,475 → 36,791 and its comment
words 234,033 → 189,570. **Against the charter:** the split of `Run.ts`
and `World.ts` went to a round of its own (Round 15), since a split a
reader gains from moves state and its share of the save; two display
fixes were signed exceptions (§124). The scope guards held: no snapshot
bump (World v36 and Run v49 at the kickoff's tree and at the close), no
gotcha added (141 at both), and no balance number moved, by the phases'
records.
Outside the charter, each signed as it came: the build `0.1.1` (§128,
uploaded 2026-10-23), the dependency phase (§129), the docs and
instruments pass (§130), the reads (§131), the process review that made
AGENTS a router to `process/` (§132), and the re-cut of the old Rounds 9
and 10 into Rounds 9 to 23 (§133). Archives:
`archive/post-118-roadmap.md` + `-worklog.md` + `round-8.5-spec.md` +
`round-8.5-census.md` + `round-8.5-rules.md` + `sessions-round-8.5.md`
+ `retro-scratchpad-round-8.5.md`.

---

## Rounds 9 to 23 — the re-cut

_(Cut at §133 on 2026-10-26 from the old Rounds 9 (Extensions) and 10 (Act
3) and the user's additions; every round signed (`archive/post-118-worklog.md` §133, tranches 1
to 3). The old rounds' text is in git at `5ab97513`. Row ids in the scope
lists, such as C6 or N12, are the re-cut's tables (`archive/post-118-worklog.md` §133, 133b and
133c), which hold each item's premise against the code with its file and
line. What every round below respects, from Round 8's close: each Run bump
rejects players' saved runs at the upload that carries it (the release
policy, §Round 8), and a World bump rejects none, since only the Run is
saved for players. A new `RunCommand` needs its rows in the chaos driver's
`LEGAL_IN` and the kit's `PHASE_ROWS`; a new phase needs a row in the
resume test's gate table and is a Run bump with no new field. A page added
to a shipped event re-draws the rest of every run that visits it (gotcha
#141). A new status needs a symbol and a colour under the colourblind
gate. Removing or renaming a shipped id (a daemon, character, packet,
event, sector, port-stock entry or camp def) makes a saved run unreadable,
so it takes a Run bump; adding one is free. Every new archetype takes an
atlas cell, and a draftable one a prior-table row and the rarity protocol,
since draft pools and ports are run-wide. The board has an Escalation
axis, and the signed sheet's arbitrated rows reproduce only under the v4
prior table.)_

**How these rounds run** (signed in tranche 1). Each round ends in an
upload with something a player can meet, skipped only when nothing a
player sees changed. Each seam round authors its consumers into the live
acts' pools, so its release has them in play, and ships each seam with a
headless test, its planted failure and a consumer in play. A round that
changes combat, movement or the economy closes with a board, read as
paired same-seed deltas against the round before; each act's bands are
re-anchored in the round that lands the act.

---

## Round 9 — The frame and the damage trial

**Charter:** the four acts written down as a spec, the board's instruments
made sound, then damage as a range tried against hit or miss as a
pre-registered trial, in the casualty experiment's shape.

**In scope**

- **The act design** (A6, N20), a spec before any JSON: each act's theme,
  enemies, bosses and length in hops; the plague's cause; the ending, and
  what a win is (act 3's boss or act 4's); act 4's unlock in outline. The
  user's outline: act 1 mainly fauna with some bandits; act 2 a realm in
  chaos (bandits, deserters, a faction's leader as its boss), in the
  1920s register DESIGN names for the period archetypes; act 3 against
  whatever causes the plague, a dark wizard its boss; a secret act 4 of
  about three hops with no branching, against a demon lord. Four themes
  are unused by any sector: barren, volcanic, tundra, desert.
- **The board's instruments:** the roster table's coverage guard (C13) and
  its compaction, measured before it is built (C14); `box-drive.sh`'s
  mixed queues (C15); `FX_REGISTRY`'s coverage guard (R18); the action
  classes deleted at Y5c, still described as live in DESIGN, ARCHITECTURE
  and gotchas #95, #97 and #109 (R17).
- **Damage as a range, a trial** (the user's, at §133): an evadable strike
  deals a draw between 0 and its damage, with the hit chance as the mean
  fraction, in place of hit or miss. A config switch; the roll taken on
  the damage after defense, which keeps today's mean; the range's
  distributions as its arms (one draw a strike keeps `combatRng`'s shape;
  a two-parameter family makes the spread a dial); what bleed, blind and
  the two daemons that hook a hit do when every strike lands; the bot's
  sensors that read a hit chance; the MISS splat and `unit:missed`; paired
  boards against hit or miss; the user's play; a bar written before. The
  arithmetic is in `archive/post-118-worklog.md` §133 ("totems, and the first experiment").
- **The rarity stars' tap on touch** (R22).
- **At the close:** the no-counts trial's read (R9) and the keep test over
  the lines §132 added.

**Why first:** instruments before the reads that depend on them, and a
rule change before anything is balanced on it. **Risk:** medium; the
switch keeps a rollback cheap. **Decision points:** the bar; the
distribution; the spec's open questions. **Exit:** the spec signed; each
guard with its planted failure; the trial kept or rolled back on its bar
and the user's play. **Release:** the damage feel, if kept. **Scope
guards:** no new unit, no act content.

---

## Round 10 — Act 1, the wilds

**Charter:** a first act of beasts and bandits on mechanisms that exist,
with the two shipped sectors moved to act 2's place in the same release.

**In scope**

- **The scripted run** (R2): one list of per-node entries on `RunConfig`,
  of which today's single-valued dials (`layout`, `encounter`, `event`,
  `firstNode`) are cases, so the URL's 17 parameters shrink as control
  grows: a chain of encounters or boards, an event chain end to end, a
  port's stock. A forced id is saved since Round 8 (the slot keeps the
  dials as text, and `Run.fromJSON` applies them), so entries keyed by
  position with a URL form need no save work. Folded in: `--sector-hops`
  (R12; the CLI forwards any flag named as a URL parameter, so
  `--sectorHops` parses already, and the hyphenated spelling and a help
  line are left) and a warning when a forced encounter matches no node
  (R13). First used to author this act.
- **The ground fauna** (A17, N19): wolf, giant rat, fox, puma and tiger,
  enemy-only 1×1 melee archetypes, in encounters and camps; bandits as
  enemies.
- **Act 1's sector** (A7's share): encounters, layouts, events and a boss,
  locale-keyed; a tree as plain scenery if the layouts want one (its
  flight rule is round 20's).
- **The run's shape:** act 1, then the two shipped sectors in act 2's
  place until round 21 reworks them.
- **The sheet's multi-act tooling** (A23's tooling half): the sheet is
  two-act shaped today, one seam band and a wall named for act 2; a seam
  column a sector and a wall band an act, then act 1's bands.
- **The atlas resize** (S1): 31 of the 48 cells are used and the rounds
  ahead name more new units than the 17 free; about five lines,
  triple-guarded (gotcha #33).

**Depends on:** round 9 (the spec). **Risk:** medium: a third sector
lengthens the run and moves every band, and a run saved before it needs
its resume checked or a Run bump (inferred). **Decision points:** act 1's
hops (A24's length half); the act 1 boss. **Exit:** a run from act 1 to
the deep end's boss, playable end to end; act 1's bands signed.
**Release:** a new first act. **Scope guards:** no flyer, swimmer, 2×2 or
swarm (rounds 19 and 20).

---

## Round 11 — The roster

**Charter:** the shipped roster balanced on the trial's arm, the Idol of
Mars split into three, and bandits out of the draft.

**In scope**

- **Power by rarity** (C18): 1/1/1/2 to 1/1/2/3 or 1/2/3/4, the enemy
  pools re-anchored behind it, since it moves every burn a turn. Power's
  level-up draw and its growth key (R19) in the same re-baseline: taking
  the key out moves five run streams.
- **The kit watches** (C20: officer, bandit, mercenary, halberdier,
  stormcaller); the priest's parity (C16); the area-status enemies'
  retune (C19); the blind fix (C12), the kiter's case a stop.
- **Mars as three one-stat idols** (N24): strength, ranged and magic, in
  place of one that empowers all three; a prior-table rebuild.
- **Bandits not draftable** (N28).
- **Dis Pater:** the `--grant` read at n=80 (A31), on the tithe as built,
  rounded once on a turn's total (the user's answer at §133), with his
  sentence rewritten to it (A28).
- **Ability descriptions** (A33): a `description` on the ability schema
  and a line on the card, so each later round writes its abilities' text
  as it authors them.
- **The wall watch** (C17), read on this board.

**Why here:** after the trial, whose arm sets the numbers, and before the
seam rounds tune new units against this roster. **Risk:** low-medium
(config and box time). **Decision points:** power's scale; the kiter under
blind; each kit change; the idols' sizes. **Exit:** the board read and
signed; the prior table rebuilt. **Release:** three idols, reworked units,
ability descriptions. **Save:** a Run bump (`mars` removed). **Scope
guards:** no new mechanism but the description field.

---

## Round 12 — Push, pull and blink

**Charter:** attacks that move their target or their caster, designed once
with their consumers.

**In scope**

- **Forced movement, designed first** (C6), a stop: a push is a
  directional shove whose distance is a number of its own, not the
  ability's range; landings over chasm and water; in-flight moves and
  claims (gotcha #113). The `move` op's `knockback` and `pull` modes were
  declared in Cluster 1 and deleted unbuilt in Round 8.5, so the seam is
  designed here with its consumers. Then knockback from a point, a pull
  toward the caster, and a teleport landing beside its target (the dash's
  move with another rule for the landing); `World.shove`, called by its
  own test alone, used or retired.
- **The cavalier's hit after its move** (C5): `proposeSelfMove` gives the
  move `targetId: -1`, so a damage op after it needs its target resolved
  again.
- **A caster-anchored area that leaves out its caster** (N3): a flag for
  `allies` and `all`, since `enemies` leaves the caster out already.
- **The dash's visual:** a trail or blink-flash on `unit:dashed`, which
  the teleport's blink shares.
- **Consumers,** each in the live acts' pools: the grenadier (N1), the
  telekinetic (N2), the adventurer's pull special (N4), the ninja (N5),
  the blade whirlwind (N27), the banshee's self-centred burst (N3), a
  cavalier (A18).

**Depends on:** round 11's roster. **Risk:** medium-high (the occupancy
core). **Decision points:** the design stop; which new units are
draftable. **Exit:** each seam with a headless test and its planted
failure; the consumers in play; the board. **Release:** seven units and
abilities. **Save:** a World bump if a push captures a cell at cast
(inferred). **Scope guards:** no 2×2 body is pushed until round 19.

---

## Round 13 — The unit kit

**Charter:** lifesteal on a unit and for a team, specials that act on
their caster, reach across the whole board, and archetypes that extend
another.

**In scope**

- **The resolved-damage return and `lifesteal`** (C1): `applyDamage`
  returns a bare boolean, so no op can read a prior op's damage; widen it,
  accumulate into `FireScratch`, add the op. Its consumer, the vampire
  (N11), a melee unit that heals on hit.
- **`healActor`** (C1): a battle rule's effect that heals the unit that
  dealt a hit by a fraction of its damage (the `dealHit` trigger carries
  it), with the user's two variants: a lifesteal idol for the run and a
  packet for one fight.
- **The specials' two gaps** (C2): a `self`-target self-buff arm, and the
  self-heal that does nothing. The score gate is dropped (the user, at
  §133): a condition is added only where an ability looks broken without
  one.
- **Global reach** for abilities and auras (N18): a selector or a flag,
  not a large radius (a radius builds its cells on every fire, an aura's
  every tick); a global stun or heal special as its consumer.
- **`extends`** (R7): a preprocess merge, the editor's round trip, and the
  seven places a new archetype is registered (units, prices, the fuzz
  strategies' strict record, the redraw-fisher's strict record,
  `Recruitment.test`'s EXCLUDED, the glyph, `REQUIRED_UNIT_IDS`) as a
  checklist with a guard where one is missing. Its reskins (A21): the
  soldier (N17), the conscript (N26) and the commissar (N25, a speed
  status under the colourblind gate).
- **`knownAbilityIds`'s last reader** (U6), the archetype editor.

**Depends on:** round 12. **Risk:** medium. **Decision points:** the
idol's and packet's names and numbers; the conscript's appeal; who
carries the global special. **Exit:** as round 12's. **Release:** four
units (the vampire, soldier, conscript and commissar), a global special,
an idol and a packet. **Save:** a Run bump and a World bump (`healActor`
changes the fingerprinted `BattleRuleEffect`).

---

## Round 14 — Neutrals

**Charter:** the neutral team split into the four kinds the game now needs
(the player's units, the enemy's, camp members, and scenery, inert or
carrying an ability), `affects` as flags, and the totems and the aura
healer that use them.

**In scope**

- **The neutral split, a trial** (C4): Round 8.5 listed which question
  each site asks (`archive/post-118-worklog.md` §122, 122f): 26 ask whether a unit is scenery,
  10 whether it is a camp member, 18 whether it is any neutral, and 17
  lines plus `affectsMatch` compare two units' teams; at seven a camp
  member treats a wall or rubble as its own side today. Step zero re-takes
  the sites; the bar is written before; the user's pre-registration
  carries (census B-02); `isActiveNeutral` is decided here.
- **`affects` as flags** (C3, N6): allies, neutrals and hostiles, where
  today it is one of `enemies`, `allies` and `all`, by team alone; a
  neutral is a camp member whose camp is not hostile to the caster's
  team; through every reader and the editors.
- **Totems** (N23): scenery carrying an ability, placed in the layout
  editor, immobile, destructible, not counted toward a battle's end, its
  side set where it is placed; first, whether a unit's own target scan
  picks one or only an order does. A healing totem, and a global one that
  heals its side alone (round 13's global aura).
- **The aura healer** (N6): a second healer whose aura sustains
  `rejuvenate` on allies and neutrals; a sustained status keeps its tick
  cadence (`sustainStatus`).
- **The camp level fork** (A11): per-act variants against a camp-side
  level budget, the board and the camp probe read before a mechanism.
- **The camp-anchor revert** (C21), kept or cut beside `affects`.

**Depends on:** round 13 (a global aura for a global totem). **Risk:**
medium-high: a unit's team is read in the sim, the render, the UI and the
audio. **Decision points:** the trial's bar; a totem's side; camp levels
per act or a budget. **Exit:** the split kept over its bar or reverted;
totems and the aura healer in play; the board. **Release:** totem fights,
the aura healer, camps by level. **Save:** a World bump (`team` on every
unit).

---

## Round 15 — The split

**Charter:** `Run.ts` (4,025 lines) and `World.ts` (2,432) split into
parts a person can walk through, with no behaviour change, before rounds
16 to 18 build on `Run.ts`. A split that helps a reader moves a phase's
state and its share of the save into a second object, which this round
allows.

**In scope:** the split (U5), its first candidates the event phase, whose
six fields are its own, and the deck; §123's comment-pass leads (U4)
where they land in the files it touches. **Proof:** the journal corpus and
the fuzz diff, byte-identical, with a declared mapping if the save's shape
moves, and their planted controls (`process/oracles.md`, fitted to its
size, and this one is large).

**Risk:** medium (wide, but proven). **Decision points:** how far
(`Run.ts` alone, or `World.ts` too); where the boundaries go. **Exit:**
the proofs byte-identical with their controls. **Release:** none, the one
round with nothing for a player. **Save:** a Run bump only if the shape
moves.

---

## Round 16 — The turn

**Charter:** what a player decides around a turn under the casualty rule,
each a design round whose exit is a playtest verdict.

**In scope**

- **Fatigue** (C7; `fatiguePerStack` is 0): what rotating the hand buys,
  whether visible in-fight debuffs (mobility or speed, not the hidden
  `power`), a deck-side cost (a fielded card to the bottom of the draw
  pile, or a skipped draw) or a deployment toll. The casualty experiment
  re-targeted the `Fatigued` seam to starting health (−10 % a stack,
  capped at 50 %) and read it at §92; this round inherits what that
  decided.
- **Retreat** (C8): a pre-turn stance that ends the wave early, coherent
  only under the casualty rule. The user's constraint: the withdrawal is
  walked to the spawn band and despawned, or gated behind a timer (about
  30 s), or both, so "field a strong unit, kill one, retreat" is not a
  valid line while guerrilla play stays legal. The objective system's
  `hold` and `atWill` stances are the seam; a new turn-end reason.
- **Optional deploy** (C9): bench a drawn card, since under casualties
  exposure is fielded power; the pre-turn screen owns the hand.
- **Injuries** (C11): fallen units return wounded for the next fight, on
  `pendingEncounterEffects` unless they outlast a fight.
- **A won turn's reward** (C22): a partial refund on a decisive win, or
  the enemy paying survivors on a loss, through the `poolHealth` portion,
  the feel re-read first.
- Each new command takes its chaos-driver and probe-kit rows and a bot
  decision (gotcha #128).

**Depends on:** round 15. **Risk:** medium-high (design, and a balance
that moves every turn). **Decision points:** each design, a stop;
retreat's exploit guard. **Exit:** each a playtest verdict; what is kept
with its headless tests and the board. **Release:** the turn's new
choices. **Save:** a Run bump and a World bump (retreat's turn-end reason
and objective).

---

## Round 17 — Deck and daemons

**Charter:** daemons that hook the deck, and the economy's spending side.

**In scope**

- **Deck-event triggers** (R3): `cardDrawn`, `cardDiscarded`,
  `deckReshuffled` and `handRedrawn` as a trigger domain, from the three
  `deck:*` events that are cues alone today; their legality rows and fire
  sites in `drawCard` and `discardCard`; a site id on the `daemon` key;
  whether the encounter-start shuffle counts (it emits no
  `deck:reshuffled` today); a serialized per-draw counter if any hook is
  chance-gated.
- **A daemon draw op** (N13), guarded on its chain (the extra card is
  drawn too) and on the hand's cap of 10.
- **The user's three daemons** (N13, N14, N15): an extra draw when a named
  unit is drawn; a small heal on each shuffle; more morale for a smaller
  hand, through a `poolMax` run stat, healed by what it adds when taken
  (20/40 becomes 25/45) and losing as much when it leaves, clamped so the
  loss never ends a run.
- **The port shelf guarantee** (C10): a role tag on `PacketDef` (heal,
  buff, utility) and a forced slot in the port's stock, so a workhorse
  packet is always stocked; weights bias, they don't guarantee.
- **The shrink trigger** (A15): a daemon that shrinks the cache, kept out
  of ports or paired with a boon, since ports stock every unowned daemon.
- **Bit sinks** (A14), designed first: content gated on `bitsAtLeast`, or
  a service (a paid rest, a reroll) as a `RunCommand`.
- **Escalation 3's read** (A2, with its watch A30), on this board, with
  exported journals if any exist by then.

**Depends on:** round 15. **Risk:** medium. **Decision points:** the
sinks; any chance-gated hook. **Exit:** the daemons and the shelf in play
with their headless tests; the board. **Release:** three daemons, the
port's shelf, new ways to spend bits. **Save:** a Run bump if a hook is
chance-gated.

---

## Round 18 — Events and rewards

**Charter:** events that start a fight and pick up after it, and rewards
that grant abilities and XP, authored as events.

**In scope**

- **Event, battle, resume** (R6): `resolveEventNext` nulls the cursor
  before both terminals today. `resumePage` on `start-encounter`, with
  the reachability and termination checks; a `pendingEventResume` Run
  field; re-entry at the top of `advancePastBattle`, before the recruit
  and sector gates (signed: the resume page is the outcome page); the
  editor's round trip. A fight from a resumed page needs a fight counter,
  since a fight's streams are keyed by sector, node and turn, or the
  schema forbids one.
- **Event-gated camp encounters** (A12): a layout named on the event's
  terminal, since today an event names an encounter alone and the layout
  roll throws when none fits, and a boot guard.
- **The ability-grant channel** (R4): `UnitTemplate.abilities`, an
  `encounterAbilities` store on the Run stamped at `beginTurn`, unioned
  where units spawn (every path goes through `World.wireSpawned`), and a
  `grantAbility` op; with a queued unit's seeded effects kept in a
  battle's snapshot (census F-1, R24).
- **XP rewards** (R5): a `grantXp` entry kind and ops routed through
  `bankXpAwards`, a new `levelup` occurrence site, and a promotion route
  outside fights and rests (`handleDismissPromotion` throws there today);
  with the reward ledger's index pin (R20) and a `reward:resolved` event
  (R21).
- **The event screen on `run:cacheChanged`** (R23).
- **The event `art` reader** (A13), what art is decided first.
- **The grants authored as events** (N16).

**Depends on:** round 15. **Risk:** medium. **Decision points:** whether a
resumed page can fight; XP's targeting; what event art is. **Exit:** each
seam with its headless test and planted failure; the events in play.
**Release:** fights inside events, camp events, granted abilities, XP,
event art. **Save:** Run bumps (the resume, the XP portion, the template
field) and a World bump (F-1 with the grant).

---

## Round 19 — The ground

**Charter:** how a body crosses the board on the ground: a traversal
profile per archetype (what each tile costs it) and movement correct for
bodies wider than a tile, built through the movement sites they share,
with water, ice and mud and the bodies that use them. Both change the same
one-cell tests of a tile (`destinationBlocked`, the sidestep, a step's
duration, the flee, the two wanders, `nearestFreeCells`), which is why
they share a round (principle #2).

**In scope**

- **The traversal profile on the one plane** (S3): passability is global
  today (`TILE_DEFS` in `TileGrid.ts`). A `traversal` field and
  `tileCostFor(unit, kind)` at the `CostFn` site, carried on
  `PathCostContext` through its three builders; the direct
  `tileGrid.costAt` reads; the bot's `passable` reads; and a rule for a
  tile's effects under a profile. Designed with the flyer's row in it, so
  round 20 adds a plane, not a new shape. The default profile is
  byte-identical by the fuzz diff and the pathing pins; drift gates never
  relax (PATHING).
- **Moving N×N, the sim** (S8): A* is footprint-correct; the one-cell
  sites are `destinationBlocked`, the claim, the spawn and overflow (no
  fit check), the swaps (null on a footprint over 1), the sidestep, the
  collision check, the leap, both wanders, the flee, `nearestFreeCells`
  and the healer's commit check; a decision: big bodies never swap or
  sidestep, or yield rules. Built footprint-correct throughout, so the
  half-tile grid stays possible. A pushed 2×2 decided with it.
- **Moving N×N, the render** (S9): the mark is fixed at the spawn
  footprint, an enemy's pick box and a combatant's health bar are not
  scaled by its footprint.
- **A guard that a draftable unit is 1×1** (S11), in place of the pin S8
  loosens.
- **Ice under 1** (S6): `minCost × Chebyshev` in the heuristic, `minCost`
  per grid (1 on a board without ice), `stepDurationTicks` following, and
  the arrival bound that assumes every step takes at least a step's ticks.
  The planner then prefers ice, a highway with an accuracy tax.
- **Mud reworked** (S7): the user's word, "Mud isn't fun to play with,
  but I haven't taken the time to really figure out why"; today cost 4,
  −12 accuracy and poison on entry, with its switch deleted in Round 8.5.
  Play first, then a dev dial for the trial.
- **Swarms, plan A** (the user's, at §133): a small body drawn smaller on
  a whole tile; a swarm as one body drawn as a cluster whose damage falls
  with its health.
- **Consumers,** each in the live acts' pools: the crab and a marine
  (N19, A19), the bear (N10), the giant (N21), a swarm.

**Depends on:** round 18. **Risk:** high: the movement core under the
drift gates. **Decision points:** the yield rule; which cell governs a
body's cost and tile effects; mud's shape; the swarm's damage rule.
**Exit:** each seam with a headless test and its planted failure (a marine
crosses deep water and a ground unit is refused; a walking 2×2 under the
overlap detector, with a one-cell `destinationBlocked` planted); the
consumers in play; the board. **Release:** the crab and the marine, ice as
a highway, mud reworked, the bear, the giant, swarms. **Save:** none
predicted (a profile and a footprint come from the def); a World bump if
a claim gains a field. **Scope guards:** no second plane and no lift
(round 20); no draftable 2×2. If the round runs long, mud is the piece
that moves: it needs the profile, not the footprint.

---

## Round 20 — The air

**Charter:** flight: a second occupancy plane, the flyer's presentation,
reach by layer, and the flyers.

**In scope**

- **The render spike first:** a posed flyer over a ground unit, two
  glyphs and two marks on one tile, for the user's eye; the flight lock as
  signed (no co-location) is the fallback.
- **The lock re-audited** (S2) against co-location across planes, and
  against everything that moved since it was signed: camps and their
  hostility, N×N `unitDistance`, auras, sight and half cover, `minRange`
  kiting, the queues with the swap and sidestep, the catapult's release
  gate, the objective system.
- **The plane:** `planeOf` choosing by the unit, path blockers and
  `destinationBlocked` per plane, claims (they carry `plane` already), the
  overlap detector per plane, a tile's effects under a flyer.
- **Reach by layer** (N12), in place of `targetsLayer`: a per-ability
  change of reach against a flyer, so melee hits a flyer above it.
- **The flyer's presentation** (S4), to DESIGN "Elevation on the board":
  the lift as a channel apart from the ground point the mark reads, since
  the animator writes whole positions and a lift written into the sprite
  drags the mark off its tile; the ten position readers each choosing
  ground or lifted; clause 2's 15 % pinned headless, a lift of 1.0 its
  failing control; the mark over chasm and deep water. Then the
  renderer's reconciliation, its cheap tier (S5), and the float (S10: the
  lift kept and the bob dropped under reduced motion, a phase a unit).
- **The tall tree** with `blocksFlight` (N7), and rounded plates for it
  (A35).
- **Consumers,** each in the live acts' pools: the eagle (N19), the
  falcon and the falconer (N8, A20; the falcon through `summon`), and the
  dragon (N9), a 2×2 flyer, where both seams meet.

**Depends on:** round 19 (the profile and the footprint). **Risk:** high:
a second plane in the occupancy core, and the projection. **Decision
points:** the spike's verdict; the lift and the float, by the user's eye;
reach by layer's default; whether the tree blocks sight. **Exit:** as
round 19's, with the lift's pin and its control; the board. **Release:**
the eagle, the falcon and falconer, tall trees, the dragon. **Save:** a
World bump if a unit's plane is kept per instance (inferred). **Scope
guards:** no draftable 2×2.

---

## Round 21 — Act 2, the realm in chaos

**Charter:** the two shipped sectors reworked into one second act, a realm
in chaos in the warlord-era register (bandits, deserters, a faction's
leader as its boss), and lines of dialogue for bosses.

**In scope**

- **Act 2's sector from the shipped two** (A7's share): encounters,
  layouts, events and camps, at the length the spec set.
- **The rioter, gunslinger, halberdier and officer** in normal and elite
  fights (A9); today they fight in the two act-2 bosses alone.
- **The rifle-armed archetypes as the deserters** (A8), enemy-only unless
  signed draftable.
- **The faction leader's fight.**
- **Dialogue** (N22): a locale-keyed `lines` field on an archetype and a
  render overlay over the glyph, at moments the renderer hears or at
  random; render-only, so no board and no stream; the leader the first to
  speak.
- **`minHop` on a layout** where the act wants it (A26).
- **Act 2's bands,** re-anchored, with the deep-end cost residuals (A34)
  on that board.

**Depends on:** round 10 (act 1 and the sheet's multi-act tooling).
**Risk:** medium: a shipped boss, event or sector id removed or renamed
makes a saved run unreadable. **Decision points:** what of the two
sectors is kept; the leader's fight; whether the deserters are draftable.
**Exit:** a run from act 1 through act 2's boss, playable; act 2's bands
signed. **Release:** act 2. **Save:** a Run bump if a shipped id goes.

---

## Round 22 — Act 3, the plague

**Charter:** a third act against whatever causes the plague, with the dark
wizard as its boss, and stock that can be held to an act.

**In scope**

- **Act 3's sector** (A7's share), its theme from the spec; if volcanic,
  the volcanic camp resident (A10), whose pool ships empty, and the
  mapgen tool's empty-pool hint (A32) with it, or the hint dropped.
- **The plague's enemies, and the wizard.**
- **Act-scoped stock** (A16): ports and draft pools draw from the whole
  catalog today, so an "act 3" daemon, packet or draftable would be
  offered in act 1. Ports and pools by act, each item a prior-table row,
  then act 3's daemons and packets on it.
- **Act 3's bands.**

**Depends on:** round 21. **Risk:** medium: the scoping re-draws port
stock. **Decision points:** the wizard's kit; what is held to act 3.
**Exit:** a run through act 3's boss, playable; act 3's bands signed.
**Release:** act 3. **Save:** none predicted for the content; a Run bump
if the scope is saved per run (inferred).

---

## Round 23 — Act 4 and a run's frame

**Charter:** the secret fourth act behind an unlock, the unlock mapping,
Escalation's rule levers with per-act hop economics, and the bot's check
over the whole run.

**In scope**

- **Act 4:** about three hops with no branching, the demon lord, and a
  sector-map edge taken only when unlocked, since an edge is `from` and
  `to` alone.
- **The unlock mapping** (A22), act 4 first. What it builds on (A3):
  `progress` is lenient and a new field's name is permanent; `bestWin` is
  the highest level won per character; a dialled run's win is not
  recorded; unlocks apply at the character's confirm.
- **A win** as the spec defines it, with the credits.
- **Escalation's rule levers** (A1): more elites, a boss's extra trick, a
  tool taken away; with per-act node-map parameters (A24's economy half),
  one seam, since elite, port and event chances are one global block
  today.
- **The bot's check after the content** (A27), on the four-act board, and
  act 4's bands.

**Depends on:** rounds 10 to 22. **Risk:** medium. **Decision points:**
what unlocks act 4; which tool a level takes away; what "working as
intended" means for the bot. **Exit:** a run through all four acts with
act 4 unlocked; the bot's check read; every act's bands signed.
**Release:** the secret act, unlocks, Escalation's new levels. **Save:** a
new permanent `progress` field; a Run bump if an unlock reaches the run
by snapshot.

---

## Round 24 — Onboarding & Feel

_(From the Round 8 close's re-audit, 2026-10-11. Built already: the
credits and the licence file (116j), and of the run summary the seed line,
Export run and the level a run was played at. Not designed in, despite the
Round 8 charter's words: achievements and seen-flags are a comment in
`src/store/store.ts` and one field, `creditsSeen`. Each is a new lenient
field of `progress` with a permanent name, and `plans/achievements.md` is
wrong that reject-stale applies to the store (only the run slot is strict).
`Run.resume()` re-emits a gate's or an end's event on Continue, so a
subscriber that counts events sees repeats. Music has `volumeMusic` stored
with no control and no mute field. Added from the Round 8 spec (D8): an
easier setting as an accessibility candidate. The smallest supported window
is 1280×720.)_

**Charter:** the player-facing meta layer and the final feel pass, on final
content and audited idioms.

**In scope**

- **Tutorial** (`plans/tutorial.md`, amended): deterministic board via a
  pinned `RunConfig`, condition-triggered callouts, registry-derived key
  labels, every control live; seen-flags in the store; skip/replay rows in
  settings.
- **Music** (`plans/music.md`): a Web Audio `MusicPlayer` lane (SFX pooling
  untouched), the state-machine table (map / battle / boss / duck-to-sting),
  first-any-gesture unlock — then **the asset design round** (licensed vs
  procedural undecided; exit = a listening session; licences build-enforced).
- **Achievements** (`plans/achievements.md`): a def table + one page-lifetime
  bus subscriber + the store; unlock rewards resolve at run creation.
- **Run-summary / post-run screen** (seed display · copy seed · the trace
  export button · stats · achievements popped).
- **Credits + the player-facing licence surface** (the §79g OFL obligations
  recommended an in-game credits screen at ship).
- **The board's accessibility dials** (handed on by 7.5, 2026-09-26; TODO):
  glyph scale and yaw as player settings, each decided with a reason. Both
  are new production code, not flags: glyph scale exists only as the dev
  explorer's patches, and a production yaw needs the slab re-stamp on a view
  change, which is DEV-only today.
- **The final global feel/SFX sweep** (catapult hold-fire creak · launch
  creak · the "queued" stance tell · the fleeing-enemy tell · the
  stalled-battle draw prompt · sparkle placement · the movement polish, then
  the hop reopened once · the rally X as a terrain mark — the whole TODO
  feel pile, dispositioned in one pass).

**Riders** (the Round 8.5 TODO pass, 2026-10-14, user-signed; TODO "Round 24"). First, ahead of the tutorial, whose callouts
point at the screens: the layout rework (a window smaller than
1280×720, the battle's unit cards over the board, 150 % text at 720p),
sized at the kickoff; players' reports may bring it forward as a `.5`
round (the user's caveat). Into the feel sweep: one capped turn's end
sequence read live, a hitsplat gallery dev key built first, deep
water's band constants, the hop chip's fade, a tooltip that leaves with
its screen. With yaw, the overlays' one-frame lag. With the tutorial, a
key's label on a non-US keyboard. With the run summary, an export of a
run in progress. Text size at the default, asked at each round's
playtest until then.

**Depends on:** Round 23 (the tutorial against act 1 as last tuned) + Round 8 (the store).
**Risk:** low-medium (render/UI-only; music assets are the unknown-length
tail). **Decision points:** the music sourcing route; achievement rewards
cosmetic vs gating. **Exit:** a new player reaches the act-1 boss unprompted;
the feel pile is empty or explicitly deferred.
**Scope guards:** no sim change; no new content.

---

## Round 25 — Ship

_(From the Round 8 close's re-audit, 2026-10-11. The Electron shell exists
as a development shell (`shell/electron/`, `npm run shell`): no packaging,
the probes and the recorder in its `main.mjs`, one `store.json` rewritten
whole, no single-instance lock. Round 8's browser smoke was Firefox and
Edge, with two lines unread (TODO "Round 8.5"); Chrome proper and Safari
are this round's. The Round 8 spec ends no-migrations at 1.0, and nothing
below names the migration work. A stranger's exported journal replays only
on the commit that recorded it, forced on any other, and never across a
config change; only finished runs are exported.)_

**Charter:** the actual "a way to ship the game," Steam-shaped.

**In scope**

- **Electron packaging + Steamworks** (`steamworks.js` for achievements /
  cloud — or config-only auto-cloud on the save directory) · the build
  pipeline (`electron-builder` + `steamcmd` upload; `BUILD_ID` threads through).
- **The Deck / gamepad call** — a decision, not a pre-commitment ("Deck
  Verified" wants controller; DESIGN's mouse-sufficient rule already covers
  the trackpad).
- **The toolchain bump** (the Vite major + the `npm audit` debt — its own
  verify pass) · object pooling if frame-time measurement says so (the 108d
  bench: the marks' signed +0.19 ms per frame is Firefox on the user's
  machine; Electron ships Chromium, and other hardware is unmeasured) · the
  full browser matrix for the web build (Firefox / Chrome / Safari WebGL2 +
  Web Audio; Round 8 smokes the first two; Safari has no test device as of
  2026-09-26).
- **Human gauntlet #2** — the §53g ~80% baseline predates events, camps,
  rarity, characters, and the braid; re-anchor before ship tuning (closes the
  starting-event-vs-cell TODO). 85h sharpened the gate (2026-08-25,
  tiger-team item 8): the scalar rests on ONE player × 11 cells × 3 seeds on
  the old engine — **no macro band signs against the human anchor until the
  re-record** (WORKLOG §85h).
- Store-page assets · the Pages build as the demo channel · the final deploy
  story (hand-upload retires or is formalized).

**Riders** (the Round 8.5 TODO pass, 2026-10-14, user-signed; TODO "Round 25"). With the store-page assets, the recorder's
three open items. With the browser matrix, the device pixel ratio's cap
and the failure plate's three (a shader that fails to compile, the
battle unseen while a lost context is waited for, a long error the
keyboard can't scroll). Which run dials a shipped build answers (the
rest of that work is Round 10's scripted run). A decision point: which
languages, if any, at the Steam release.

**Depends on:** everything. **Decision points:** Deck/gamepad; the web
build's fate at the Steam release (the user's lean, 2026-09-26: both until
Steam, then probably retired. The caveat: the web TARGET is what keeps
mobile open, and a free web demo can feed Steam wishlists, so retiring the
channel need not retire the target). **Exit:** a Steam build installs, saves, and
records an achievement on a clean machine.

---

## Coverage map — every carried item → round

| Item | Source | Round |
|---|---|---|
| The terminal-prior fold + ε-floor re-read + campRaid nominator + 55pre re-derive | v1 §Interstitials / 83e | 6 |
| Balancer perf pass | 2026-08-21 #16 | 6 |
| Roster-realism isolation instrument + X3 band re-read | #17 | 6 |
| Rarity verification protocol (+ the §76f four) | #18 | 6 |
| i18n layer + config-prose convention + literal pin | 2026-08-21 gap | 7 |
| UI style & robustness audit (+ idiom reference) | v1 §Interstitials | 7 |
| Event screen pool gauge · ice description · RNG/`rng` label · HUD stat line · empower naming · display-color hoist · aura-FX jury · sector-cleared sting · layout-stability sweep | #8 / TODO | 7 |
| Sound registry | plans/sound-registry.md | 7 |
| The shell spike (Electron + the itch iframe) · storage adapter (three cases) | 2026-08-21 gap / 7.5 close | 8 |
| Persistent store (4 consumers) · version + invalidation policy · `BUILD_ID` | v1 C6 / plans/* / decision 1 | 8 |
| The run journal (tier 1's export · the chaos repro · the continuation check) | 7.5 close | 8 |
| The pane probe kit (+ an Electron probe runner, if the spike allows) | 7.5 close | 8 |
| The background recorder (fixtures · seeds · before/after at two commits · full runs after the journal) | 2026-09-27 (the user) | 8 |
| Save/load + mid-run resume · chaos fuzz driver · the continuation check | v1 C6 / TODO / 7.5 close | 8 |
| Title / main menu · seed field | 2026-08-21 gap | 8 |
| Settings (volume axes · rebind · speed · colorblind · aura-FX · locale · reduced motion · shake · text scale) | v1 C6 / plans/music.md / 7.5 close | 8 |
| Difficulty / ascension · unlock mechanism | v1 C6 | 8 |
| Telemetry tier 1 (export + build id) | plans/telemetry.md | 8 |
| The public web channel (itch.io alpha) · the browser smoke | 7.5 close | 8 |
| The codebase review (the census · deletions per subsystem) · the source-comment rewrite | 2026-09-27 (the user) / the tone audit (TODO) | 8.5 |
| Atlas resize (the pre-step, moved from the old 10) | #13 / 7.5 close | 10 |
| Lifesteal · specials · camp-aware auras · cavalier · fatigue design | #1 #4 #3 #14 #9 | 13 · 13 · 14 · 12 · 16 |
| Forced movement (knockback, pull) · a teleport | the Round 8.5 census, 2026-10-12 (the user) | 12 |
| Mud, a rework of unknown shape | the Round 8.5 census, 2026-10-13 (the user) | 19 |
| The neutral team split in two, as a trial | the Round 8.5 census, B-02 (the user); placed at 122f, 2026-10-15 | 14 |
| Deck-event daemons · ability-grant channel · XP rewards · event resume · `extends` | #2 #6 #19 #7 #10 | 17 · 18 · 18 · 18 · 13 |
| Traversal (marine + flight + `targetsLayer`) · the flyer's presentation · ice <1 · moving N×N (+ its render side) | #11 #12 #15 #5 / 7.5 hand-offs | 19 (profiles) and 20 (the plane) · 20 · 19 · 19 |
| Finale design · sector 3 · the orphans · bit sinks · fauna · unlock mapping | C5 deferrals | 9 (the act design) · 10, 21 to 23 (the acts) · by item · 17 · 10, 19, 20 · 23 |
| Tutorial · music · achievements · the rest of the run summary · feel sweep · an easier setting (the credits were built at 116j) | plans/* / TODO / Round 8 spec D8 | 24 |
| The UI sweep (§117.5) · the rest gate (§117.75), inserted and built | Round 8 | 8 |
| The oracle map · the TODO pass over Round 8's riders · the shell-quoting audit | Round 8 close | 8.5 |
| Escalation's rule levers · level 3's read against bit sinks | Round 8 spec D8 / 118e | 23 · 17 |
| The end of no-migrations at 1.0 · the shell's packaging, instance lock and store writes · Chrome proper and Safari | Round 8 spec / Round 8 close | 25 |
| Glyph scale · yaw (the accessibility dials) · the movement polish + the hop · the rally X as a terrain mark | 7.5 hand-offs / TODO | 24 |
| Electron + Steamworks · pipeline · Deck call · toolchain bump · pooling · browser matrix · human gauntlet #2 | v1 C6 / TODO | 25 |
| `--sector-hops` in the run-config tool · chebyshev unify · `pauseAtTurnGates` watch · Mercury watch · runOne/walker watch · `--poll-ceiling` · mapgen empty-pool hint | TODO | placed at the Round 8.5 TODO pass, re-placed at §133: 10 (the scripted run) · 8.5 (census B-17) · dropped · dropped · 8.5, a lead for §125 (census B-14) · superseded 2026-08-26 · 22 |
| A scripted run for content work | the Round 8.5 TODO pass, 2026-10-13 (the user) | 10 |
| A check of the bot after the content rounds | the Round 8.5 TODO pass, 2026-10-13 (the user: "probably after the content rounds") | 23 |
| The user's additions: new units and abilities, three daemons, totems, dialogue, the four acts (N1 to N28) | §133, 133c (the user) | 10 to 23, by item |
| Damage as a range, a trial | §133, 133c (the user) | 9 |
| Euclidean distance · the half-tile grid | §133, 133c (the user) | TODO "Watches" |
| The split of `Run.ts` and `World.ts` · §123's comment-pass leads | TODO, not yet placed until §133 | 15 |
| Every other open TODO item | the Round 8.5 TODO pass (`archive/round-8.5-census.md` section 5), re-placed at §133 (`archive/post-118-worklog.md` §133, tranche 3) | 8.5 → 25, by TODO's sections |

## Explicitly deferred / out (signed)

- **Synergies/traits** — OUT (the C4 call; daemons are the channel).
- **Per-unit objectives** — out (a sim-model change with no consumer).
- **Aura stacking policy · constitution auras · draftable multi-tile
  units** — out until a consumer names them. (Co-location for flyers and
  reach by layer, which the anti-air attack matrix was, are in Round 20
  since §133, behind its render spike.)
- **Telemetry tier 2 (an ingest server)** — only on demonstrated tier-1 loss.
- **Translations beyond English** — the layer ships; content does not.
  Which languages, if any, at the Steam release is a Round 25 decision
  point (the Round 8.5 TODO pass, 2026-10-14).
- **Camera rotation · CRT curvature · chromatic aberration** — hooks only.
  (A player-ROTATABLE camera; a fixed yaw chosen in settings is Round 24's
  question.)
- **Mobile** (the windowed view, the minimap, drag / wheel / touch pan, the
  phone-width map legend) — out until it can be playtested (2026-09-26: no
  Apple device, no mobile playtest). The web build is what keeps it open,
  since a mobile release would be the web build in a phone browser or a
  webview wrapper, so the web target stays healthy through ship. Nothing in
  the projection forecloses it (under ortho a window is one zoom number),
  and the tooltip idiom already has a touch path (`attachTooltip`'s
  `touch` option).
- **The ML balancer rung** — CLOSED unless the tabular prior drifts.
