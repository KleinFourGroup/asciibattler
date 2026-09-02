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
 7. Idioms ───────┤  i18n + the UI audit → the idiom reference
 8. Foundations ──┤  the store keystone → save/load → menu/settings → ascension
 9. Extensions ───┤  the combat / run-hook / traversal / footprint seams
10. Act 3 ────────┤  the third sector + every orphaned content item
11. Onboarding & Feel ─┤  tutorial · music · achievements · run summary · credits
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
  the Pages build stays the playtest channel). Electron over Tauri because it
  bundles Chromium — the WebGL/Web Audio browser matrix collapses to one
  renderer.
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
+ `archive/round-6-spec.md`. **The encounter feel interstitial (§89+ — a
round; its phases are cut at its spec session; user-called 2026-08-30
at 87d3; ROADMAP) runs BEFORE Round 7.**

---

## Round 7 — Idioms

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
beyond English; no sim/snapshot change.

---

## Round 8 — Foundations

**Charter:** the persistent-store keystone and everything that hangs off it.
The store is to this round what the Rule vocabulary was to Cluster 3:
designed ONCE with its four consumers known (save/load · settings ·
achievements · tutorial seen-flags — `plans/*.md`).

**In scope (keystone-then-consumers order)**

- **The Electron shell spike** (one session, first): the build runs under
  Electron, writes a file under `userData`, reads it back. Informs the store's
  storage adapter BEFORE its shape locks.
- **The persistent store:** versioned, reject-stale, a storage-adapter seam
  (`localStorage` in the Pages build / a file in Electron), the four consumers
  designed in; fuzz/headless never writes it (Game-layer wiring, not Run/World).
  **Version + invalidation policy lands here:** `BUILD_ID`, the store version,
  the reject-stale rule, the player-facing "this save is from another
  version" message.
- **Save/load + mid-run resume** (`devLoadRun` past map-phase; a
  scene-for-phase resolver; a storage trigger; a load entry point) — **with the
  chaos fuzz driver as its oracle**: random legal `RunCommand` dispatch in every
  phase, asserting the occupancy invariant + snapshot round-trip at every phase
  transition (the TODO item, promoted — it is the verification instrument
  save/load needs, and the §69b combination-crash finder).
- **Title / main menu** — the UI hub the consumers hang off (new run ·
  continue · settings · achievements · credits · a seed field).
- **Settings** — **the volume-axis split FIRST** (SFX / music, ± master —
  decided before any slider is coded, `plans/music.md`), then the in-game
  rebind UI (labels from the registry), default playback speed, the
  colorblind-safe palette, the aura-FX mode graduated from the dev switch.
- **Difficulty / ascension** (groundwork: per-speed enable, the focus-tile
  switch, the X1 multipliers) + **the unlock MECHANISM** (cross-run unlocks
  resolve at run creation only; the content MAPPING waits for Round 10).
- **Telemetry tier 1** (`plans/telemetry.md`): the export-run-trace button +
  the baked `BUILD_ID`; no ingest server unless tier 1 provably loses data.
- Closes with a board re-run (ascension is a balance surface).

**Depends on:** Round 7 (the menu/settings build on audited idioms + the
string layer). **Risk:** medium-high (the store is the most-depended-on meta
model left; save/load touches every phase). **Decision points:** 2-vs-3 volume
axes; what ascension levels DO (dose, pool, draw?) — a design round; whether
mid-run save is manual, auto-at-gate, or both. **Exit:** a run saved at any
gate reloads byte-faithfully (the chaos driver green); settings persist across
reloads; the menu is the boot screen.
**Scope guards:** no achievements/tutorial CONTENT (Round 11 — the store's
consumer seams only); no unlock content mapping; no music.

---

## Round 9 — Extensions

**Charter:** the engine seams the third act needs, designed once with all the
2026-08-21 consumers known — the C1/C2 shape again, on a now-mature core. Every
item below was code-reality-audited at the planning session (WORKLOG
§Post-C5 planning); sizes are the audit's.

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
- **Cavalier** (blitz + hit on arrival): `proposeSelfMove` hardcodes
  `targetId:-1`, so a `damage` op after a move has no target — a post-move
  target re-resolve. Everything else is a dash clone + mobility.
- **Fatigue — the design round** (`fatiguePerStack` is 0; H7's power-scale was
  a placeholder). Asymmetric by construction and that's fine — the player's
  hand is a deck, the enemy's "deck" is the wave grammar. The question is only
  *what does rotating your hand buy you*: visible in-fight debuffs
  (mobility/speed, not the invisible `power` meta-stat), a deck-side cost (a
  fielded card to the BOTTOM of the draw pile / skips a draw — the StS exhaust
  idea), or a deployment toll. **Free-form; exit = a playtest verdict; no
  pre-commitment.**

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
  declared-inert marine seam; the flight seam is three inert fields
  (`layer`/`ignoresTerrain`/the one-member plane union) with `planeOf`
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
- **Ice <1 costs** (signed above): `minCost × Chebyshev` with `minCost`
  computed per grid at build (1 on any board without ice ⇒ zero change
  elsewhere), `stepDurationTicks` follows. Same phase, same `CostFn` site.
- **Moving N×N footprints** (non-draftable, encounter-only, layout-legal):
  A* is footprint-correct and the renderer already lerps a footprint walk.
  The 1×1-blind parts: `destinationBlocked` (one cell), `claimCell` (corner
  only), `spawnTeam` + overflow spawn (no fit check — only the camp drip uses
  `anchorFootprint`), sidestep/swap hard-`return null` on N>1 (a decision:
  big units never swap, or yield rules). Layout legality = spawn-region fit
  through `anchorFootprint`. No bump.

**Why this order:** combat/effects first (no serialized-shape changes, fast
to land), run layer second (the three Run bumps land in one window — the
bump-economics note from the C5 spec, now under reject-stale), spatial third
(the highest-risk items, with the flight re-audit as their step zero).
**Depends on:** Round 8 (reject-stale signed; save/load shipped so the bumps
are exercised by the chaos driver). **Risk:** high (the C2-class spatial
work). **Decision points:** named per item above. **Exit:** every seam has a
headless test AND one shipped consumer (a vampire, a special, a marine, a
flyer, a walking 2×2 in one encounter) — seams without a consumer are the C2
"flight" pattern we're closing, not repeating. **Closes with a board re-run.**
**Scope guards:** no act-3 content beyond the one consumer per seam; no
per-unit objectives; no aura stacking policy; no co-location; no draftable
multi-tile units.

---

## Round 10 — Act 3 (Content)

**Charter:** the third sector and every orphaned content item — the first
round whose job is simply *more game*, on the engine Rounds 1–9 finished.

**In scope**

- **Pre-step: the atlas resize** — the glyph atlas has ONE free cell (47/48);
  every new glyph past it forces the grid bump (~5 lines, triple-guarded).
  Do it once, first.
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
- **The final global feel/SFX sweep** (catapult hold-fire creak · launch
  creak · dash VFX · the "queued" stance tell · the fleeing-enemy tell · the
  stalled-battle draw prompt · sparkle placement — the whole TODO feel pile,
  dispositioned in one pass).

**Depends on:** Round 10 (tutorial against final act 1) + Round 8 (the store).
**Risk:** low-medium (render/UI-only; music assets are the unknown-length
tail). **Decision points:** the music sourcing route; achievement rewards
cosmetic vs gating. **Exit:** a new player reaches the act-1 boss unprompted;
the feel pile is empty or explicitly deferred.
**Scope guards:** no sim change; no new content.

---

## Round 12 — Ship

**Charter:** the actual "a way to ship the game," Steam-shaped.

**In scope**

- **Electron packaging + Steamworks** (`steamworks.js` for achievements /
  cloud — or config-only auto-cloud on the save directory) · the build
  pipeline (`electron-builder` + `steamcmd` upload; `BUILD_ID` threads through).
- **The Deck / gamepad call** — a decision, not a pre-commitment ("Deck
  Verified" wants controller; DESIGN's mouse-sufficient rule already covers
  the trackpad).
- **The toolchain bump** (the Vite major + the `npm audit` debt — its own
  verify pass) · object pooling if frame-time measurement says so · browser
  matrix for the Pages build (Safari/Firefox WebGL2 + Web Audio).
- **Human gauntlet #2** — the §53g ~80% baseline predates events, camps,
  rarity, characters, and the braid; re-anchor before ship tuning (closes the
  starting-event-vs-cell TODO). 85h sharpened the gate (2026-08-25,
  tiger-team item 8): the scalar rests on ONE player × 11 cells × 3 seeds on
  the old engine — **no macro band signs against the human anchor until the
  re-record** (WORKLOG §85h).
- Store-page assets · the Pages build as the demo channel · the final deploy
  story (hand-upload retires or is formalized).

**Depends on:** everything. **Decision points:** Deck/gamepad; whether the
Pages build stays public. **Exit:** a Steam build installs, saves, and
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
| Electron shell spike · storage adapter | 2026-08-21 gap | 8 |
| Persistent store (4 consumers) · version + invalidation policy · `BUILD_ID` | v1 C6 / plans/* / decision 1 | 8 |
| Save/load + mid-run resume · chaos fuzz driver | v1 C6 / TODO | 8 |
| Title / main menu · seed field | 2026-08-21 gap | 8 |
| Settings (volume axes · rebind · speed · colorblind · aura-FX) | v1 C6 / plans/music.md | 8 |
| Difficulty / ascension · unlock mechanism | v1 C6 | 8 |
| Telemetry tier 1 (export + build id) | plans/telemetry.md | 8 |
| Lifesteal · specials · camp-aware auras · cavalier · fatigue design | #1 #4 #3 #14 #9 | 9 |
| Deck-event daemons · ability-grant channel · XP rewards · event resume · `extends` | #2 #6 #19 #7 #10 | 9 |
| Traversal (marine + flight + `targetsLayer`) · ice <1 · moving N×N | #11 #12 #15 #5 | 9 |
| Atlas resize · finale design · sector 3 · the orphans · bit sinks · fauna · unlock mapping | #13 / C5 deferrals | 10 |
| Tutorial · music · achievements · run summary · credits · feel sweep | plans/* / TODO | 11 |
| Electron + Steamworks · pipeline · Deck call · toolchain bump · pooling · browser matrix · human gauntlet #2 | v1 C6 / TODO | 12 |
| `--sector-hops` in run-config GUI · chebyshev unify · `pauseAtTurnGates` watch · Mercury watch · runOne/walker watch · `--poll-ceiling` · mapgen empty-pool hint | TODO | stay in TODO; land opportunistically |

## Explicitly deferred / out (signed)

- **Synergies/traits** — OUT (the C4 call; daemons are the channel).
- **Per-unit objectives** — out (a sim-model change with no consumer).
- **Aura stacking policy · constitution auras · co-location for flyers ·
  draftable multi-tile units · the anti-air attack matrix** — out until a
  consumer names them.
- **Telemetry tier 2 (an ingest server)** — only on demonstrated tier-1 loss.
- **Translations beyond English** — the layer ships; content does not.
- **Camera rotation · CRT curvature · chromatic aberration** — hooks only.
- **The ML balancer rung** — CLOSED unless the tabular prior drifts.
