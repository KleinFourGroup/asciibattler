# META-ROADMAP v2 — The road to ship (Post-Cluster-5)

The single source of truth for the **order in which the remaining work gets
built**, and why that order minimizes re-authoring. This is the index above
`ROADMAP.md`: each **round** here becomes its own roadmap + spec when its turn
comes. `DESIGN.md` says *what* we're building; `ARCHITECTURE.md` says *how the
code is shaped*; `ROADMAP.md` is the *current* in-flight round; this file is
the *meta-order* across the rounds still to come.

**Status:** Locked 2026-08-21 at the post-Cluster-5 planning session.
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
 8.5 Housekeeping ┤  NEXT — the oracle map → the census → deletions per subsystem, byte-identical → the source-comment rewrite · the TODO pass  (inserted 2026-09-27)
 9. Extensions ───┤  the combat / run-hook / traversal / footprint seams
10. Act 3 ────────┤  the third sector + every orphaned content item
11. Onboarding & Feel ─┤  tutorial · music · achievements · run summary
12. Ship ─────────┘  Electron + Steamworks · build pipeline · gauntlet #2
```

Dependency edges the order satisfies:

- The fold invalidates every ε-floor and the 55pre vector ⇒ fold before any read (6 first).
- The UI audit sets idioms the menu/settings/tutorial build on; i18n's string
  layer must exist before the audit's per-surface pass (touch each file once) ⇒ 7 before 8, i18n first inside 7.
- Mid-run save makes act-2/3 playtesting possible without replaying act 1 ⇒ Foundations before Content.
- Nine of the 2026-08-21 feature items are mechanisms (effect-op vocabulary,
  run hooks, traversal, footprint commit) that act-3 content would be authored
  against ⇒ Extensions before Act 3 (principle #1, exactly the C1/C2 shape).
- The tutorial is authored against FINAL act-1 content + audited idioms ⇒ Onboarding after Act 3 and after Idioms.
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
- **The finished run = THREE acts.**
- **i18n is IN** — a string layer + locale files + a config-prose convention,
  retrofit before any further content is authored.
- **Save invalidation policy: reject-stale until 1.0.** A save from another
  version is discarded with a message; no migrations. Serialized-shape bumps in
  Rounds 9–10 therefore stay cheap. One build-time `BUILD_ID` (semver + commit)
  is shared by the store, the saves, and the telemetry traces.
- **The §80 `plans/` docs are REVIEWED and signed** with one amendment: the
  tutorial is *deterministic board, reactive callouts* — a pinned seed
  guarantees the teaching material is on the first nodes; callouts are
  condition-triggered (first port, first camp aggro, first empower…), never
  sequence-triggered, and **no control is ever disabled**.
- **Flight and the marine share ONE mechanism** — a per-unit `traversal`
  profile — and the Phase-M flight lock is re-audited at that phase's step zero.
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

## Round 8.5 — Housekeeping

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
signed decisions: `round-8.5-spec.md`.)_

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
  and not assumed (signed 2026-10-12; ROADMAP §120).
- **The deletions, one subsystem per phase** (sim · run · render and UI ·
  the bot and fuzz instruments · tests), each followed by that
  subsystem's comment pass. Sized at the census's close (2026-10-14,
  user-signed): a phase for the dials goes first, a phase for the tools
  after the five, then the close and the dependency phase; ROADMAP §121
  to §129. Within a subsystem the signed deletions come
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
  Listed and signed at §120 (`round-8.5-census.md` section 5, 2026-10-14):
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
line's damage, are signed exceptions, 2026-10-17, WORKLOG §124); no new
abstractions; no gotcha
undone without its entry read; the permanent gates never relaxed; no
balance numbers move.

---

## Round 9 — Extensions

_(What Round 8 built that this round has to respect, from its close's
re-audit, 2026-10-11; the kickoff audits each against the code. Each Run
bump below rejects players' saved runs at the upload that carries it (the
release policy, §Round 8). A new `RunCommand` needs its rows in the chaos
driver's `LEGAL_IN` and the kit's `PHASE_ROWS`; a new phase needs a row in
the resume test's gate table and is a Run bump with no new field. A page
added to a shipped event re-draws the rest of every run that visits it
(gotcha #141). A new status needs a symbol and a colour under the
colourblind gate. The board has an Escalation axis, and the signed sheet's
arbitrated rows reproduce only under the v4 prior table.)_

**Charter:** the engine seams the third act needs, designed once with all the
2026-08-21 consumers known — the C1/C2 shape again, on a now-mature core. Every
item below was code-reality-audited at the planning session
(`archive/post-83-worklog.md` §Post-C5 planning); sizes are the audit's. _(The flyer's presentation, the
render side of a walking N×N and the atlas pre-step were added 2026-09-26
at the Round 7.5 close, user-signed: `archive/post-104-worklog.md` §The
Round 7.5 close, C1.)_

**Pre-step, at the first phase that needs a new glyph: the atlas resize**
(moved from Round 10, 2026-09-26). **Moot unless the round needs more
than 17 new glyphs:** 124j-post took 16 unused non-unit glyphs out on
2026-10-18, so the atlas uses 31 of its 48 cells (5 non-unit + 26
distinct unit glyphs, counted by `GLYPHS.length`), and the five consumers
below fit (WORKLOG §124, "124j-post — step zero, the signs and the
proof"). As written before: the atlas used 47 of its 48 cells (21
non-unit glyphs + 26 distinct unit glyphs, counted), and this round's exit
ships a consumer per seam (a vampire, a special, a marine, a flyer, a
walking 2×2): two new glyphs overflow it. The grid bump is ~5 lines,
triple-guarded. Do it once.

**Early in the round: a scripted run for content work** (the Round 8.5 TODO pass, 2026-10-14, user-signed; TODO "Round 9"). Finer control of what a run loads as content ramps
up: a chain of encounters or boards, an event chain end to end (the
event resume below is its first case), a port's stock. Each forcing
dial takes one value for the whole run today, none takes a list, and a
forced id is not saved. A shape for the kickoff: one list of per-node
entries on `RunConfig`, of which today's single-valued dials are cases,
so the URL's 17 parameters shrink as control grows. Its first consumers
are this round's own: each seam's one consumer, checked on a chosen
board at a chosen hop.

**In scope — combat & effects**

- **Resolved-damage return + lifesteal.** `applyDamage` returns a bare boolean;
  no op can read a prior op's resolved damage. Widen the return, accumulate
  into `FireScratch`, add a `lifesteal` op (ability-native — a vampire
  archetype needs it) AND a `healActor{fraction}` arm on `BattleRule` (~15
  lines — the `dealHit` trigger already carries resolved damage) for
  daemon/packet riders. No bump.
- **Specials** (a stronger ability, priority over strikes, cooldown ≫
  duration): `priority` exists and dash already proves the cooldown/duration
  decoupling. Close the three gaps: a `self`-target **self-buff propose arm**
  (~10 lines; today `self` only knows move/summon), the silent self-`heal`
  no-op, and — optionally — a context score gate for "fire only when it
  matters." Ties to the ability-grant channel below.
- **Camp-aware aura `affects`** (`'enemies'` exists and is test-pinned but is
  pure team-inequality — a player debuff aura reaches passive camps): the
  documented ~10-line widening.
- **The neutral team split in two, as a trial** (census B-02, the user's
  candidate; moved here at Round 8.5's 122f, 2026-10-15, user-signed).
  Camp members on a team of their own, walls and cover keeping `neutral`.
  Round 8.5 listed which question each site asks (WORKLOG §122, 122f): 26
  ask whether a unit is scenery, 10 whether it is a camp member, 18
  whether it is any neutral, and 17 lines plus `affectsMatch` compare two
  units' teams. At seven of those a camp member meets a wall or rubble and
  treats it as its own side today (`MovementBehavior`'s yield probe and
  panic-flee swap, `blockedAlly`, `movement.ts`'s role-order pass, the
  nearest-victim scan and `affectsMatch`, `lowestWoundedAlly`); a clean
  split changes them, which this round may do and Round 8.5 could not.
  Step zero: whether a run reaches each of the seven. Decided beside
  camp-aware `affects`. Its bar is written before the trial; the user's
  pre-registration carries (lines may grow if it reads better; census
  B-02). `team` is in every unit of a World snapshot and on `unit:died`.
  `isActiveNeutral`, read by its own test alone since 122f, is kept for
  this trial to decide (signed at 122m).
- **Cavalier** (blitz + hit on arrival): `proposeSelfMove` hardcodes
  `targetId:-1`, so a `damage` op after a move has no target — a post-move
  target re-resolve. Everything else is a dash clone + mobility.
- **Forced movement and a teleport** (added 2026-10-12 at the Round 8.5
  census, user-signed; not audited or sized). Attacks that knock their
  target back or pull it in, and an ability that teleports its caster.
  The `move` op's `knockback` and `pull` modes and its `cells` field
  were declared for the first two in Cluster 1 and deleted unbuilt in
  Round 8.5 (census A-05, A-07), so the seam is designed here with its
  consumer. A push is a directional shove (§35c's backstop is the
  relocation it wraps, `archive/post-34-roadmap.md:411`), and its
  distance is a number of its own, not the ability's range. A teleport is
  the dash's move with another rule for choosing the landing. The kickoff
  audits both against the occupancy core and says whether each ships in
  this round or waits for a Round 10 consumer.
- **Fatigue — the design round** (`fatiguePerStack` is 0; H7's power-scale was
  a placeholder). Asymmetric by construction and that's fine — the player's
  hand is a deck, the enemy's "deck" is the wave grammar. The question is only
  *what does rotating your hand buy you*: visible in-fight debuffs
  (mobility/speed, not the invisible `power` meta-stat), a deck-side cost (a
  fielded card to the BOTTOM of the draw pile / skips a draw — the StS exhaust
  idea), or a deployment toll. **Free-form; exit = a playtest verdict; no
  pre-commitment.** (2026-09-02: the casualty experiment re-targets the
  `Fatigued` seam to starting HP — −10%/stack, cap 50% — and reads it on
  its own paired arm at §92; this round inherits whatever that decided.)
- **Retreat** (written 2026-09-02 at the casualty-experiment spec): a
  pre-turn withdrawal stance that ends the wave early — coherent ONLY
  under the casualty chip rule (under survivors, withdrawing leaves more
  survivors to chip you). ⚠ The user's anti-exploit constraint: the
  withdrawal is physically walked to the spawn band + despawned, or gated
  behind an unlock timer (~30 s), or both — "field a strong unit, kill
  one, retreat" must not be a valid line, though guerrilla play should be
  directionally legal. The objective system's `hold`/`atWill` stances are
  the seam.
- **Optional deploy** (2026-09-02): bench a drawn card — today Cull is the
  player's only exposure lever, and under casualties exposure = fielded
  power. Sibling of retreat; the pre-turn screen already owns the hand.
- **The port shelf guarantee** (2026-09-02; the user's "rarity" itch,
  reframed): a role tag on `PacketDef` (heal / buff / utility) + a forced
  slot in `rollPortStock` (the Portunus forced-tier precedent; the recruit
  offer's melee+ranged guarantee is the shape) so a workhorse packet is
  ALWAYS stocked. Weights bias, they don't guarantee — tiers come later,
  as weighting only, if ever. Moves the shelf's draw shape → the board.
- **Injuries** (2026-09-02): fallen units return wounded for the next
  fight — the fatigue seam's run-scoped cousin; a design round if the
  casualty rule is KEPT and the pool alone feels too abstract.

**In scope — run layer**

- **Deck-event daemon triggers.** The three `deck:*` events are
  "cue-not-truth" presentation events with zero hook consumers. New trigger
  domain (`cardDrawn` / `cardDiscarded` / `deckReshuffled` / `handRedrawn`),
  legality-matrix rows, fire sites in `drawCard`/`discardCard`, a 4th `daemon`
  RNG site + a serialized per-draw counter if any hook is chance-gated (**Run
  bump**), plus an auto-apply `empowerRandom` op (`grantEmpowers` only queues
  player-spent budget).
- **The ability-grant channel** (packets/events granting a unit an ability —
  typically an aura — for an encounter). Abilities are fixed at FOUR spawn
  sites from the catalog; `encounterEffects` carries stat-keyed
  `StatusEffect`s only. `UnitTemplate.abilities?` + an `encounterAbilities`
  store on Run (**Run bump**) stamped at `beginTurn`, the four sites union it,
  a `grantAbility` packet/event op. World already round-trips ability ids.
- **XP / level-up rewards.** `REWARD_ENTRY_KINDS` has no XP; `bankXpAwards`
  (Run.ts) is the single chokepoint rest nodes already feed. A `grantXp
  {amount | levels}` entry kind + event op + packet op routed there (promotions
  surface at the next gate — the staggered screen works unchanged); a new
  `'levelup'` occurrence SITE (keys are permanent). **Decision point:**
  targeting — "all roster" / "random slot" in v1; a unit picker is a UI item.
- **Event → battle → resume.** `resolveEventNext` nulls the cursor before BOTH
  terminals. `resumePage?` on `start-encounter` (+ the reachability BFS + the
  superRefine), a `pendingEventResume` field (**Run bump**), re-entry at the
  top of `advancePastBattle` — **BEFORE the recruit/sector gates** (signed:
  the resume page is the outcome page), editor round-trip. Harness/walker
  blast radius is small (visit counting already safe).
- **Archetype `extends`** (reskins): no inheritance today — a reskin is a
  38-leaf duplicate. A preprocess-merge field; the seven-place registration
  checklist (units · prices · fuzz-strategies strict record · redraw-fisher
  strict record · `Recruitment.test` EXCLUDED · glyph · `REQUIRED_UNIT_IDS`)
  becomes a documented checklist + a guard where one is missing.

**In scope — spatial**

- **Traversal** (ONE mechanism: the marine AND flight). Passability is global
  (`TILE_DEFS` hardcoded in `TileGrid.ts`); deep water is commented as the
  declared-inert marine seam; the flight seam is two inert fields
  (`layer` and the one-member plane union; `ignoresTerrain` was deleted
  at §121, census A-04) with `planeOf`
  ignoring the unit and `blocksFlight`/`targetsLayer` nonexistent. Because the
  Phase-M lock signed NO co-location, "air" is not a second occupancy plane —
  **flight is a traversal profile** (everything cost 1 except `blocksFlight`),
  the marine is another (deep water passable). A `traversal` field on
  `UnitDef` + `tileCostFor(unit, kind)` substituted at the ONE `CostFn` site
  (`movement.ts`) — **and the add-a-consumer sweep of the ~8 gates that read
  `tileGrid.costAt` directly** (the 75j2 rule). `targetsLayer` ships default
  `both`. Falcons = the existing `summon` op.
  **⚠ Step zero: re-audit the Phase-M flight lock against everything that
  moved since** — camps + per-faction hostility + the pull (ground melee
  ordered at a hovering target), N×N footprints (`unitDistance` for the
  meleeable-adjacent rule), auras (same plane ⇒ flyers receive them — wanted?),
  LOS/half-cover (ignore? grant?), `minRange` kiting, the §45 vacancy-ETA
  queues + swap/sidestep (a flyer must path around a queue, never join it),
  the catapult release gate, and the objective system (an unreachable flyer
  over chasm = the fleeing-enemy tell). No-co-location is expected to
  survive; the attack matrix is the likeliest revisit. Drift gates NEVER
  relax; baselines re-pin on the deliberate change (PATHING.md append).
- **The flyer's presentation**, built to DESIGN "Elevation on the board"
  (handed on by 7.5). No production path lifts a glyph, and the dev posed
  flyer's shape does not carry over: it writes the lift into the sprite
  position (`src/dev/boardPanel/posed.ts`), a 1×1 mark follows the sprite
  position (`BattleRenderer.updateGroundMarks`), and camera-up has a
  horizontal part at pitch 45, so a lift done that way drags the mark off
  its tile (about 0.32 of a tile at a lift of 0.45, derived). The animator
  also writes whole positions on every move. So the lift is a channel kept
  apart from the ground point the mark reads. Also owed: what the bars,
  hitsplats and pick box do under a lift; clause 2's 15 % pinned headless
  (only the geometry CLI measures it, and the dev dial defaults to 1.0, the
  lift known to land on a neighbour); the float (TODO); and, at step zero,
  a flyer and its mark over a chasm and over deep water, never read (a mark
  1.2 down may be hidden by nearer terrain, which would break clause 3;
  inferred).
- **Ice <1 costs** (signed above): `minCost × Chebyshev` with `minCost`
  computed per grid at build (1 on any board without ice ⇒ zero change
  elsewhere), `stepDurationTicks` follows. Same phase, same `CostFn` site.
- **Mud, a rework of unknown shape** (added 2026-10-13 at the Round 8.5
  census, at the user's word; not designed, audited or sized). The user:
  "Mud isn't fun to play with, but I haven't taken the time to really
  figure out why." Today mud is the costliest passable tile (4), takes 12
  off the accuracy of a unit standing in it and poisons on entry
  (`TILE_DEFS`, `TileGrid.ts`); the switch on the poison was deleted in
  Round 8.5 with the behaviour kept (census A-21). Nothing is committed
  here but that a change is coming, and its first step is finding out by
  play what is not fun. It sits with the tile-cost work because traversal
  changes which units cross mud at all; the kickoff says whether it
  belongs in this round.
- **Moving N×N footprints** (non-draftable, encounter-only, layout-legal):
  A* is footprint-correct and the renderer already lerps a footprint walk.
  The 1×1-blind parts: `destinationBlocked` (one cell), `claimCell` (corner
  only), `spawnTeam` + overflow spawn (no fit check — only the camp drip uses
  `anchorFootprint`), sidestep/swap hard-`return null` on N>1 (a decision:
  big units never swap, or yield rules). Layout legality = spawn-region fit
  through `anchorFootprint`. No bump. The render side has its own 1×1-blind
  parts (audited 2026-09-26): an N×N body's mark is fixed at its spawn
  footprint (`BattleRenderer`'s mark spec is set once), and an enemy's pick
  box is not scaled by its footprint (a destructible's is). The slab anchor
  itself is recomputed on every step.

**Riders** (the Round 8.5 TODO pass, 2026-10-14, user-signed; TODO "Round 9"). Before the closing board: the roster table's
coverage guard and its compaction, `box-drive.sh`'s mixed queues, and
the kit and parity watches (the priest's breach, the wall, power
diversity by rarity, the AoE-status enemies' retune, the five kits that
price negative when given), power diversity landing before the board
because it moves every burn a turn and Round 10 authors against it.
With the flyer's presentation, the renderer's position reconciliation.
With XP rewards, the reward ledger's index pin and a `reward:resolved`
event. With the ability-grant channel, a queued unit's seeded effects
in a battle's snapshot (census F-1). Beside Retreat, a won turn's
reward shape. In the first phase, `FX_REGISTRY`'s coverage guard. In
the bump window, power's level-up draw and its growth key, which moves
the recruit stream.

**Why this order:** combat/effects first (no serialized-shape changes, fast
to land), run layer second (the three Run bumps land in one window — the
bump-economics note from the C5 spec, now under reject-stale), spatial third
(the highest-risk items, with the flight re-audit as their step zero).
**Depends on:** Round 8 (reject-stale signed; save/load shipped so the bumps
are exercised by the chaos driver), Round 8.5 (the seams are designed on
the cleaned core) and Round 7.5 (the flyer's PRESENTATION
is built to DESIGN's "Elevation on the board" requirement, written and
proven on a render-only fixture there so the projection is not re-opened
here). **Risk:** high (the C2-class spatial
work). **Decision points:** named per item above. **Exit:** every seam has a
headless test AND one shipped consumer (a vampire, a special, a marine, a
flyer, a walking 2×2 in one encounter) — seams without a consumer are the C2
"flight" pattern we're closing, not repeating. **Closes with a board re-run.**
**Scope guards:** no act-3 content beyond the one consumer per seam; no
per-unit objectives; no aura stacking policy; no co-location; no draftable
multi-tile units.

---

## Round 10 — Act 3 (Content)

_(From the Round 8 close's re-audit, 2026-10-11: this round also owns
Escalation's rule levers (more elites, a boss's extra trick, a tool taken
away), which the Round 8 spec parked here (D8), and the read of level 3,
fewer bits, which waits on bit sinks (TODO "Round 10"). The unlock
mapping hangs on `progress.bestWin` or on a new, permanently named field of
that section; an unlock reaches a run through the snapshot or a dial, and a
dialled run's win is not recorded. Removing a daemon, character or boss id
makes a save unreadable with no bump.)_

**Charter:** the third sector and every orphaned content item — the first
round whose job is simply *more game*, on the engine Rounds 1–9 finished.

**In scope**

- ~~**Pre-step: the atlas resize**~~ — moved to Round 9's pre-step
  (2026-09-26): that round's consumers need the glyphs first.
- **The finale design round FIRST:** what the third sector IS (the identity
  arc "sectors shade darker" has no ending written), its theme (volcanic /
  barren / tundra pools exist unconsumed by any sector), its bosses, what the
  run's ending is. A spec, before any JSON.
- **Sector 3** + its encounters/bosses/layouts/events/camps, authored
  locale-keyed from day one.
- **The orphans:** the rifleman-class archetypes (the §67 deferral) · the
  §76f four as ENEMIES (shipped draftable-only) · the volcanic camp resident ·
  the camp level fork (per-act variants vs a camp-side level budget — measured
  by the board + camp probe before any mechanism signs) · event-gated camp
  encounters (slaver-pen / hostage — open wiring question: can an encounter
  fit-filter reach a layout absent from every sector pool?) · the event
  `art?`/fx seam's first consumers · **bit sinks** (the §83e "dead-currency
  wart") · the §49 shrink flow's missing trigger content · act-3 daemons +
  packets (incl. the Round-9 consumers: deck-trigger daemons, ability-grant
  packets, XP rewards) · fauna · a cavalier · a marine · a falconer · reskins
  via `extends`.
- **Unlock content mapping** (what Round 8's mechanism gates).
- Closes with **the sheet EXTENDED** (act-3 refs; three-act wall/reach bands;
  the rarity protocol on every new archetype).

**Riders** (the Round 8.5 TODO pass, 2026-10-14, user-signed; TODO "Round 10"). The Idol of Dis Pater's `--grant` read at n=80,
after the tithe is rounded on its award, since a read before would be of
an arm about to change. The mapgen tool's empty-camp-pool hint, with the
volcanic resident. Ability descriptions, written with the act's new
abilities. The three deep-end cost residuals, when the extended sheet
touches those rows. Rounded plates for organic scenery, with fauna,
or dropped if none is authored. And whether any layout takes a
`minHop`: the hop-gating lever is built and no layout uses it.

**Depends on:** Round 9 (every mechanism above) + Round 7 (locale-keyed
authoring). **Risk:** medium (content is cheap per item; the three-act
balance extension is the expensive part). **Decision points:** the finale;
how many hops per act at three acts (11/11/? — the run-length question);
whether act 3 changes the hop economics. **Exit:** a three-act run playable
end to end; the extended sheet signed.
**Scope guards:** no new mechanisms — anything that needs one goes back to a
Round-9 sibling phase, explicitly.

---

## Round 11 — Onboarding & Feel

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
  creak · dash VFX · the "queued" stance tell · the fleeing-enemy tell · the
  stalled-battle draw prompt · sparkle placement · the movement polish, then
  the hop reopened once · the rally X as a terrain mark — the whole TODO
  feel pile, dispositioned in one pass).

**Riders** (the Round 8.5 TODO pass, 2026-10-14, user-signed; TODO "Round 11"). First, ahead of the tutorial, whose callouts
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

**Depends on:** Round 10 (tutorial against final act 1) + Round 8 (the store).
**Risk:** low-medium (render/UI-only; music assets are the unknown-length
tail). **Decision points:** the music sourcing route; achievement rewards
cosmetic vs gating. **Exit:** a new player reaches the act-1 boss unprompted;
the feel pile is empty or explicitly deferred.
**Scope guards:** no sim change; no new content.

---

## Round 12 — Ship

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

**Riders** (the Round 8.5 TODO pass, 2026-10-14, user-signed; TODO "Round 12"). With the store-page assets, the recorder's
three open items. With the browser matrix, the device pixel ratio's cap
and the failure plate's three (a shader that fails to compile, the
battle unseen while a lost context is waited for, a long error the
keyboard can't scroll). Which run dials a shipped build answers (the
rest of that work is Round 9's scripted run). A decision point: which
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
| Atlas resize (the pre-step, moved from 10) | #13 / 7.5 close | 9 |
| Lifesteal · specials · camp-aware auras · cavalier · fatigue design | #1 #4 #3 #14 #9 | 9 |
| Forced movement (knockback, pull) · a teleport | the Round 8.5 census, 2026-10-12 (the user) | 9 |
| Mud, a rework of unknown shape | the Round 8.5 census, 2026-10-13 (the user) | 9 |
| The neutral team split in two, as a trial | the Round 8.5 census, B-02 (the user); placed at 122f, 2026-10-15 | 9 |
| Deck-event daemons · ability-grant channel · XP rewards · event resume · `extends` | #2 #6 #19 #7 #10 | 9 |
| Traversal (marine + flight + `targetsLayer`) · the flyer's presentation · ice <1 · moving N×N (+ its render side) | #11 #12 #15 #5 / 7.5 hand-offs | 9 |
| Finale design · sector 3 · the orphans · bit sinks · fauna · unlock mapping | C5 deferrals | 10 |
| Tutorial · music · achievements · the rest of the run summary · feel sweep · an easier setting (the credits were built at 116j) | plans/* / TODO / Round 8 spec D8 | 11 |
| The UI sweep (§117.5) · the rest gate (§117.75), inserted and built | Round 8 | 8 |
| The oracle map · the TODO pass over Round 8's riders · the shell-quoting audit | Round 8 close | 8.5 |
| Escalation's rule levers · level 3's read against bit sinks | Round 8 spec D8 / 118e | 10 |
| The end of no-migrations at 1.0 · the shell's packaging, instance lock and store writes · Chrome proper and Safari | Round 8 spec / Round 8 close | 12 |
| Glyph scale · yaw (the accessibility dials) · the movement polish + the hop · the rally X as a terrain mark | 7.5 hand-offs / TODO | 11 |
| Electron + Steamworks · pipeline · Deck call · toolchain bump · pooling · browser matrix · human gauntlet #2 | v1 C6 / TODO | 12 |
| `--sector-hops` in the run-config tool · chebyshev unify · `pauseAtTurnGates` watch · Mercury watch · runOne/walker watch · `--poll-ceiling` · mapgen empty-pool hint | TODO | placed at the Round 8.5 TODO pass: 9 (the scripted run) · 8.5 (census B-17) · dropped · dropped · 8.5, a lead for §125 (census B-14) · superseded 2026-08-26 · 10 |
| A scripted run for content work | the Round 8.5 TODO pass, 2026-10-13 (the user) | 9 |
| A check of the bot after the content rounds | the Round 8.5 TODO pass, 2026-10-13 (the user: "probably after the content rounds") | placed at Round 10's close |
| Every other open TODO item | the Round 8.5 TODO pass (`round-8.5-census.md` section 5) | 8.5 → 12, by TODO's sections |

## Explicitly deferred / out (signed)

- **Synergies/traits** — OUT (the C4 call; daemons are the channel).
- **Per-unit objectives** — out (a sim-model change with no consumer).
- **Aura stacking policy · constitution auras · co-location for flyers ·
  draftable multi-tile units · the anti-air attack matrix** — out until a
  consumer names them.
- **Telemetry tier 2 (an ingest server)** — only on demonstrated tier-1 loss.
- **Translations beyond English** — the layer ships; content does not.
  Which languages, if any, at the Steam release is a Round 12 decision
  point (the Round 8.5 TODO pass, 2026-10-14).
- **Camera rotation · CRT curvature · chromatic aberration** — hooks only.
  (A player-ROTATABLE camera; a fixed yaw chosen in settings is Round 11's
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
