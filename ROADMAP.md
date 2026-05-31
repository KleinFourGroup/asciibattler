# ROADMAP — Post-E

The build order after Phase E (combat foundation + the four new
archetypes) landed. Companion to [DESIGN.md](DESIGN.md),
[ARCHITECTURE.md](ARCHITECTURE.md), [TODO.md](TODO.md), and the prior
roadmaps now at [archive/mvp-roadmap.md](archive/mvp-roadmap.md),
[archive/post-mvp-roadmap.md](archive/post-mvp-roadmap.md),
[archive/post-c1-roadmap.md](archive/post-c1-roadmap.md), and
[archive/post-d-roadmap.md](archive/post-d-roadmap.md).

Synthesized from [archive/phase-e-feedback.md](archive/phase-e-feedback.md)
(the Phase E playtest pass), the unfinished tail of the post-D roadmap,
and [TODO.md](TODO.md). Once you've read this, `phase-e-feedback.md` is
fully absorbed and lives in the archive purely as a historical artifact.

## Where this came from

Phase E delivered the combat-mechanics foundation the post-D roadmap
laid out: the stats overhaul (E1), ability primitives (E2), archetype
config + leveling (E3), the XP/promotion loop (E4), pathfinding refresh
(E5), combat visuals (E6), and — the headline — the four new archetypes
(E7: rogue, healer, mage, catapult), each shipped one commit at a time
with a playtest pause between. See [HANDOFF.md](HANDOFF.md) for the full
per-step breakdown; treat it as the source of truth for *what shipped*,
this doc for *what's next*.

Playing the four new archetypes surfaced a tight cluster of feedback,
almost all of it about **legibility** — the combat now *does* more than
the renderer can *show*. Three of the six items turned out to share one
root cause (presentation timing welded to simulation timing), one is a
straight XP-model gap, one is a VFX gap, and one is a playtest-velocity
unblocker. Phase F (this document's first new phase) is that cluster.
The old run-depth work (recruitment rarity, in-battle commands,
multi-map, split battles) is preserved verbatim as **Phase G**.

**Renumber note.** The post-D roadmap's "Phase F — Run depth" is now
**Phase G** here, unchanged in content. The Phase-E playtest response
took priority in front of it and claimed the F slot. Old → new mapping
is 1:1 (F1→G1 recruitment, F2→G2 commands, F3→G3 multi-map, F4→G4 split
battles). HANDOFF's "Next up" pointer is updated to match. No code or
ARCHITECTURE.md text references roadmap phases by letter, so there's
nothing else to renumber; ARCHITECTURE's `Recruitment.ts` description
("rollOffer with archetype-variety guarantee") still describes current
code and gets updated in the F1 commit that changes it.

## Conventions

Same shape as the post-D roadmap:

- **Commit per logical change**, not per session.
- **Pause between commits on multi-commit features** for the user's
  manual playtest run (the E7 cadence — keep it).
- **Surface tradeoffs** before non-obvious calls.
- **Headless-first for sim/run/core/config changes** — write a vitest
  test before reaching for the browser preview. F2 (phase system) and
  F6 (utility XP) are almost entirely headless-testable; F3/F4/F5 are
  the render-timing/VFX steps where eyeball verification is primary.
- **Browser-verify render changes at native resolution**, and only
  claim "verified" with concrete output (see the verify-before-claiming
  + browser-verify-render discipline). New unit glyphs still need a
  `glyphs.ts` GLYPHS entry — the [FontAtlas.test.ts](src/render/FontAtlas.test.ts)
  guard catches a missing one headlessly.
- **Hoist numbers to config.** Phase F introduces phase durations,
  projectile speeds, heal-VFX timings, and an `xpPerHealing` knob — land
  them in `config/*.json` (or isolated render consts for pure-VFX
  values) from day one. A4 pattern.
- **Keep DESIGN.md / ARCHITECTURE.md honest.** Update docs in the same
  commit as the code that invalidates them.

"Decision points" flag user-input moments (naming, design tradeoffs,
balance knobs). Stop and ask.

---

## Phase E — Combat foundation ✅ complete

E1 (stats) → E2 (abilities) → E3 (archetypes + leveling) → E3.5/E3.6
(tick-rate + DOM overlays) → E4 (XP + promotion + half-cover) → E5
(pathfinding) → E6 (combat visuals) → E7 (rogue/healer/mage/catapult).
All landed; 489 tests, fuzz 7/7. Full breakdown in
[HANDOFF.md](HANDOFF.md).

The four new archetypes are **dev-only via `?roster=`** and absent from
the recruit + enemy pools — Phase F (F1) starts to fix that.

---

## Phase F — Combat polish & playtest response

The Phase E playtest cluster. Ordering puts the playtest *unblocker*
first (F1), then the foundation refactor everything else needs (F2),
then the presentation + VFX steps that build on it (F3–F5), then the
XP-model gap (F6). F1 and F6 are independent of the phase system and can
slot anywhere; F3/F4 hard-depend on F2.

**Decisions settled with the user this round** (see per-step decision
points for detail):
- **#1 attack timing → build the full phase system now** (F2), not a
  render-only patch.
- **#5 heal/utility XP → per *effective* HP healed**, as a general
  utility-contribution ledger (F6).
- **#6 draft pool → player recruit pool only for now** (F1); enemy
  diversification + rarity tiers stay in G1.
- **#4 heal VFX → rich healer effect; regen-tile chip-heal keeps the
  existing cyan `+N`** (F5).

### F1 — Draft-pool pull-forward (immediate)

The playtest unblocker. Per the feedback: *"It's hard for the
playtesting to manually gauge balance when the new units only appear in
a manner dictated by a URL argument."* Pull the minimal recruitable
slice of G1 forward now; defer rarity tiers + floor-weighting +
enemy-side diversification to G1 proper.

**Shape:**
- [rollOffer](src/run/Recruitment.ts) pool grows from `['melee',
  'ranged']` to all six archetypes at **uniform weight**.
- Each offer is **three *distinct* archetypes** (the feedback's "three
  separate unit archetypes"). Replace the now-obsolete "guarantee ≥1
  melee + ≥1 ranged" reservation with a "distinct archetypes per offer"
  rule (sample without replacement from the six).
- `rollUnit` already produces any archetype — the four new ones were
  gated *only* by the hardcoded pick-lists, so this is a small, local
  change to `rollOffer` + the two `rng.pick([...])` sites.
- **Recruit-only.** [rollEnemyTeam](src/run/Run.ts) stays 60/40
  melee/ranged. **Accepted tradeoff:** you can draft + field the new
  archetypes (gauge their *offense* and team-fit) but won't *fight*
  them until G1 diversifies the enemy roll. Flagged so it's a known
  limitation, not a surprise.

**Cost / blast radius:**
- Expanding the pool shifts the run RNG draw sequence → **fuzz +
  determinism baselines reset** (one-time, expected — the E7 steps kept
  pools unchanged precisely to avoid this; F1 spends it deliberately).
  Re-run `npm run fuzz` to refresh the baseline.
- Recruit strategies in the fuzz harness
  ([PureRandom](tests/fuzz/strategies/PureRandom.ts) /
  [Greedy](tests/fuzz/strategies/Greedy.ts)) already index offers
  generically — they should survive a wider pool, but verify Greedy's
  archetype-count heuristic still terminates with six archetypes.
- WorldSnapshot/Run snapshot **unchanged** (archetype is already a
  string field; no new persisted state).

**Headless tests:**
- Offer of size 3 always yields 3 distinct archetypes drawn from the
  six (rewrite the melee+ranged-guarantee tests in
  [Recruitment.test.ts](src/run/Recruitment.test.ts)).
- All six archetypes appear across a wide seed sample (uniformity smoke).
- `rollUnit` produces valid stat blocks for each of the four new
  archetypes at recruit level.

**Decision points F1:**
- **Offer size.** User said three. `defaultOfferSize` in
  `config/recruitment.json` — set to 3 if it isn't already.
- **Distinct vs. role-diversity guarantee.** Recommend pure
  distinct-archetype sampling (simplest, and with six archetypes an
  all-same offer is already impossible). A "≥1 damage-dealer" style
  guarantee is a G1 concern once rarity weighting exists — don't
  pre-build it here.
- **Six distinct from a pool that may grow.** Sampling 3-distinct-of-6
  is fine; if the pool ever exceeds offer size this is just
  sample-without-replacement. No special-casing needed now.

### F2 — Action phase system (foundation)

**User call: build the full system now.** Generalize A1's ad-hoc
multi-tick `effectTicks` into a first-class, declared **phase timeline**
per action, so elaborate multi-phase attacks become data, not new
event types — and so the renderer has explicit hooks to animate
*against* instead of welding visuals to the damage tick.

**Why this is the right foundation (industry framing).** Every
deterministic-lockstep game (RTS, autobattler, rollback fighter)
separates **logical timing** (deterministic, in ticks — authoritative,
the sim owns it) from **presentation timing** (animation, in seconds —
the renderer owns it, free to lead or lag). Abilities are modeled as
named phases — fighting games call them *startup → active → recovery*,
MOBAs call it *cast point + projectile travel*, animators call it
*anticipation → contact → follow-through*. The effect lands on the
*active/contact* phase, not frame 0. AAA wires the contact moment via
**animation notifies** (Unreal `AnimNotify`, Unity Animation Events) —
the art timeline carries "apply effect here" markers. We can't let art
drive a deterministic sim, but we reproduce it by giving each phase a
tick duration and emitting a **phase-transition event** the renderer
schedules against.

We already have ~80% of the sim half: A1's `start` (wind-up) +
`applyEffect` at `effectTicks:[duration]` (contact) + cooldown
(recovery) is a three-phase system in disguise. F2 makes it explicit,
named, optional-per-phase, and event-emitting.

**Shape:**
- An action declares an ordered phase list, e.g.
  `[{ phase: 'windup', ticks }, { phase: 'release', ticks: 0 },
  { phase: 'travel', ticks }, { phase: 'impact', ticks: 0 },
  { phase: 'recovery', ticks }]`. Phases are optional / zero-length (a
  basic melee swing is ~all `impact`, near-zero windup).
- Each phase boundary emits a transient event (`action:phase` with
  `{ unitId, actionId, phase, targetCell?/targetId? }`) the renderer
  subscribes to generically. New elaborate attacks = a new phase list,
  no new event plumbing.
- The damage/effect resolver fires on the `impact` phase (was
  `applyEffect` at the effect tick) — logically identical to today for
  the existing actions, just named.
- **Migrate the existing actions** onto the new shape:
  melee/ranged/gambit strikes (trivial — windup 0, impact, recovery),
  `HealAction`, `MagicBoltAction` (windup = charge → impact = detonate),
  `CatapultShotAction` (windup → release → travel → impact). The mage
  and catapult are the ones that visibly benefit.
- **Target-orphan handling becomes a declared per-ability policy.** The
  "attack fired at a unit that dies before it lands" problem has a
  standard menu — make it explicit:
  - `commit-at-cast` — damage locked at the active phase; projectile is
    pure VFX that always lands (on the empty tile if needed).
  - `fizzle` — abort if the locked target dies (catapult's current
    choice; counterplay = kill the slow caster during the telegraph).
  - `ground-target` — hit the tile, whoever's there takes it (mage AoE's
    current behavior).
  - `re-home` — retarget mid-flight (available, not recommended by
    default — reads as unfair).
  Today's behaviors map onto this menu unchanged; F2 just gives them a
  name and extends the "is the target still alive?" check to cover a
  `travel` phase, not only `windup`.

**Snapshot:** `activeAction` gains phase state (current phase + ticks
elapsed) → **WorldSnapshot bump** (old versions throw; loud-failure A4).
Mid-phase round-trip is the key test (a snapshot taken during a
catapult's `travel` resumes on the right phase at the right tick).

**Headless tests:**
- Phase timeline advances tick-by-tick through the declared phases;
  zero-length phases fire-and-advance in the same tick.
- `impact` resolves damage identically to the pre-F2 `applyEffect`
  (regression-pin each migrated action).
- Each orphan policy: target dies in `windup` vs `travel` →
  fizzle/commit/ground-target behaves per the declared policy, with the
  right (or absent) `combatRng` draw.
- Mid-phase snapshot round-trip for a multi-phase action.
- Determinism: same seed → same phase-event stream + same outcomes.

**Decision points F2:**
- **Phase vocabulary.** Recommend the five above
  (`windup/release/travel/impact/recovery`), `release` and `travel`
  present only for projectile actions. Keep the set small + closed
  (a union type, not free strings) — adding a phase is one schema bump,
  same discipline as the stat block.
- **Is `travel` a sim phase or render-only?** Recommend a **sim phase**
  for projectile actions (deterministic arrival tick → the "slow the
  projectile down" knob in F3 is honest and the orphan-during-travel
  check is real). The alternative (render fakes travel by launching
  early) is cheaper but makes travel time a lie the sim can't reason
  about — worse fit for a deterministic sim.
- **Event granularity.** One `action:phase` event per boundary
  (recommend) vs. distinct event names per phase. One generic event
  with a `phase` field keeps the renderer subscription single and the
  catalog small.
- **Overlap with the deferred "generic status system."** The old
  roadmap deferred a generic status-effect system until a consumer
  revealed its shape. F2 is *not* that system — it's per-action phase
  timing, not cross-unit persistent effects. Keep them separate; note
  in DESIGN.md that the phase system is the timing substrate, status
  effects (if ever) are a different axis.

### F3 — Projectile & impact timing (presentation)

Builds on F2's phase events. The actual fix for the felt mismatch in
feedback #1 + the catapult-misses-the-sprite in #2.

- **Launch on `release`, arrive on `impact`.** The renderer starts the
  projectile/charge animation on the `release` phase event, timed so it
  *arrives* exactly on the `impact` tick — so the animation plays
  *during* the wind-up window, not after the damage. This is what lets
  the catapult projectile **slow down** (feedback's explicit wish)
  without adding lag: travel now occupies the windup, so a slower arc
  just fills more of a window that already exists.
- **Move the visual impact to contact.** Hitsplat, HP-bar drop, and
  impact SFX fire on the projectile's *arrival* (the `impact` event as
  the renderer schedules it), not at action start. The mage's boom
  should sound when the bolt lands; right now it sounds at cast.
- **Aim at the sprite, not the tile (feedback #2).** Projectiles target
  the target's *interpolated sprite position* via the same
  `SpriteRenderer.getPosition` the overlays already use, re-read during
  flight for a moving target — instead of the grid-cell center the arc
  currently homes on.
- Reuses the E6.B/E6.C/E7 projectile + explosion + dud lanes; this is
  re-timing + re-aiming them, not new VFX primitives.

**Verification:** eyeball-only per [TESTING.md](TESTING.md) — A/B a
mage cast + a catapult shot before/after, confirming SFX + hitsplat now
land *with* the projectile and the arc reaches the sprite. The dev
`__game.activeScene.world` handle is reachable; the rAF auto-resolve
race is the staging blocker (drive the sim by hand / freeze the world).

**Decision points F3:**
- **Projectile speed knobs.** Catapult slower (feedback); expose
  `*_PROJECTILE_SECONDS` / arc consts (already isolated render consts).
  Tune by feel against the windup length so arrival ≈ impact tick.
- **Off-by-a-tick tolerance.** The renderer lerps in real seconds; the
  sim ticks discretely. Arrival won't be pixel-perfect on the impact
  tick every frame. Recommend snapping the hitsplat/SFX to the `impact`
  event and letting the projectile's final approach visually catch up
  (≤1 tick) rather than chasing sub-tick precision.

### F4 — Rogue gambit sequencing (presentation)

Feedback #3: the gambit *"just looks like it's retreating while damage
is mysteriously applied to adjacent units."* Root cause: E6.A made the
shove and move-lerp channels **mutually exclusive per handle**
(`startLerp` drops any active shove), and `GambitStrikeAction` does
strike + reposition in one tick — so the retreat lerp clobbers the
attack shove and the strike vanishes.

- Sequence the presentation: **strike-contact, then retreat.** With F2's
  phases this is natural — the gambit declares `impact` (strike +
  shove) then a short reposition window the move-lerp plays in, so the
  two no longer fight over the sprite in the same instant.
- Alternatively (or additionally) let shove + move *compose* for this
  one action rather than cancel — but the phase-sequenced version is
  cleaner and is the gambit's first real use of F2.

**Verification:** eyeball — confirm a visible strike (shove/contact +
hitsplat on the struck target) precedes the rogue's kite step.

### F5 — Heal feedback VFX (presentation)

Feedback #4: *"We need more visual indication around heals."* Precise
starting point — healer heals **and** regen-tile chip-heals already emit
`unit:healed` → the E6.C cyan `+N` hitsplat. So this isn't zero→some;
it's "the floating number alone doesn't read." Add presence *on the
healed unit* + make the *source* legible (a cousin of #3's "who did what
to whom").

- **Healer casts:** a target-side green/cyan pulse or `+` aura on the
  healed unit, optionally a short healer→target beam so the source
  reads. Isolated render consts + CSS, same family as the hitsplat.
- **Regen-tile chip-heal:** keeps just the existing `+N` (user call —
  the tile is already an obvious source; a lush effect there would read
  as noise on the per-tick chip).

**Verification:** eyeball — a wounded ally visibly "blooms" on a healer
cast; the beam (if added) makes it obvious *which* healer.

**Decision points F5:**
- **Beam vs. pulse-only.** Recommend trying the target-side pulse first
  (cheapest, fixes "is this unit being healed?"); add the source beam
  only if "which healer?" still reads ambiguously in a crowd.

### F6 — Heal / utility XP (sim + config)

Feedback #5: *"Healing (and really any future utility abilities) needs
to award XP."* **User call: per *effective* HP healed**, as a general
utility-contribution ledger. Symmetric with E4's `xpPerDamage` /
`damageDealt`.

- New per-unit **utility-contribution ledger** in World (a `healingDone`
  / `utilityDone` map, mirror of `damageDealt`), accumulated at the
  point HealAction emits its delta.
- Award `LEVELING.xpPerHealing × effectiveHealing` at battle end,
  folded into the existing `computeXpAwards` alongside the damage share.
  Knob in [config/leveling.json](config/leveling.json).
- **Effective HP only.** HealAction already emits the real, clamped,
  non-overheal delta (0 included) — count that, so healing a full-HP
  ally for spam-XP earns nothing. Kills the degenerate case.
- **General, not heal-specific.** Make the ledger a `utilityContribution`
  axis so E7+/G-era buffs/shields plug in without another snapshot bump.
- This directly resolves E4's old worry that damage-only XP permanently
  starves support archetypes — the healer now earns its keep.

**Snapshot:** World gains the ledger → **WorldSnapshot bump** (can ride
with F2's bump if F6 lands in the same window, or its own otherwise).

**Headless tests:**
- Effective-heal ledger accumulates the clamped delta; overheal
  contributes 0.
- `computeXpAwards` adds `xpPerHealing × healingDone` to the right
  roster slot; a heal-only healer that dealt 0 damage still levels.
- Ledger round-trips through the snapshot.
- Balance-proof: derive the expected XP from `LEVELING.*`, never
  hardcode the arithmetic.

**Decision points F6:**
- **Knob default.** Pick `xpPerHealing` relative to `xpPerDamage` so a
  healer keeps rough pace with a damage-dealer — tune via fuzz/playtest;
  start at parity (1 HP healed ≈ 1 damage dealt) and adjust.
- **Does the per-tick regen tile award XP?** Recommend **no** — chip
  heal is the *tile's* output, not a unit's contribution. Only
  ability-driven heals feed the ledger. (Matches the F5 call to keep
  chip-heal visually minimal too.)

---

## Phase G — Run depth

The residual C-phase content, carried over verbatim from the post-D
roadmap's Phase F (renumbered). None of these need to land before Phase
F finishes; sequence within G is recommendable rather than required.

### G1 — Recruitment refactor: pool rarity + enemy diversity

F1 pulled the *recruitable* slice forward at uniform weight. G1 is the
full version the c1-feedback asked for ("draft from a pool of
pre-defined unit types with rarity tiers"), plus the enemy-side
diversification F1 deferred.

- Rarity tiers in `config/recruitment.json`:
  - common: melee, ranged
  - uncommon: mage, healer, catapult
  - rare: rogue (the "specialist"; rebalance per playtest)
- Offer composition weighted by floor depth: floor 1 = mostly common;
  floor N = increasing uncommon/rare odds. (Replaces F1's flat uniform
  weighting.)
- **Enemy diversification.** [rollEnemyTeam](src/run/Run.ts) grows past
  60/40 melee/ranged to field the new archetypes (weighted by floor) —
  the other half of F1's "recruit-only" deferral. Another fuzz baseline
  reset; bundle it with the rarity change so it's one reset, not two.
- "Guarantee role diversity" generalization: at least one damage-dealer
  + one specialist-or-support in each offer (concrete rule pending
  playtest of the F1 uniform pool).
- Recruit cards display archetype, level, abilities, key stats.

**Decision points G1:**
- **Recruit-vs-level-up exclusivity.** Recommend keeping them separate
  (level-ups are automatic from XP per E4; recruit offers strictly add a
  unit). Mixing conflates two progression dimensions.
- **Pool growth from custom unit definitions.** Punted until a
  layouts-editor-parity for archetypes exists — far future, not G1.

### G2 — Limited in-battle commands

Enabled by A2 (done). Targetless commands (switch to defensive AI,
retreat) and single-target commands (focus this enemy, hold this
location). Plumbing exists via the `WorldCommand` channel; this step is
the UI + the command implementations.

**Decision points G2:**
- **Uses per battle.** Recommend a small shared pool (3–5/battle, refund
  on victory). Charges feel tighter than cooldowns for the
  autobattler-with-steering vibe.
- **Cost gating.** Charges per battle (recommend) vs per-run resource vs
  cooldown — tied to G3's run length.

### G3 — Multi-map / longer runs

Expand each map to ~10 floors; multiple maps per run; target ~1 hour per
run. Hard prereqs done (A3 fuzz harness; E4 XP curve). Natural consumer
of D5's overflow queue + D3's larger boards.

**Theme migration (carried from D8).** Multi-map runs are when theme
moves up a level — each node map carries a theme, procedural battles
within inherit. `rollTheme` exits `Run.handleEnterNode` at that point.

**Decision points G3:**
- **Multi-map terminology.** Recommend "Regions" (neutral).
- **Inter-map transitions.** HP carry-over? Recruit availability between
  maps? Big knobs — punt to impl.
- **Save/load UI surfaces here.** A2's plumbing has been waiting; long
  runs are when save matters.

### G4 — (Speculative) Split battles + meta-health

User-flagged in the original c1-feedback. Each combat becomes a series
of smaller battles drawing subsets of the team, wins/losses depleting a
meta-health pool. Deckbuilder-roguelike inspiration. Tabled until G3
ships and we can see whether snowballing persists at long-run scale.
Large design surface — don't build speculatively.

---

## Cleanup / chores

Not gated; can land any time.

- **`world.findUnit` O(n).** Add `Map<id, Unit>` alongside the array.
  The phase system (F2) + AoE targeting call `findUnit` more often —
  good moment to do it early in Phase F.
- **Favicon.** [TODO](TODO.md). Inline SVG `M`/`@` glyph in
  TERMINAL_GREEN. Stops the per-load 404.
- **`.gitattributes`** to normalize line endings (stops CRLF warnings on
  every commit).
- **Bundle chunk-size warning.** Bump `chunkSizeWarningLimit` in
  [vite.config.ts](vite.config.ts), or code-split three.js if noisy.
- **Terrain generator: bias water toward unit paths.** [TODO](TODO.md) —
  water scatters uniformly so the cost-2 shallow-water rule rarely gets
  exercised. Wants "N clusters of size M" rather than per-cell
  Bernoulli. Lower priority post-D5.

---

## What we're explicitly NOT doing yet

- **`power` stat / multi-round battles.** Deferred since combat-feedback;
  revisit only if G4 (split battles) exposes a use for a persistent
  across-battle stat.
- **Generic status-effect system.** A1 supports multi-tick effects; F2
  formalizes per-action *phase timing* (NOT cross-unit persistent
  effects — a different axis). Resist a generic status system until a
  consumer beyond phase timing + tile effects reveals its shape.
- **Dodge mechanics.** Deferred to "after we see how dodge-less feels."
  Phase E/F is the dodge-less baseline; revisit only if playtest flags
  it.
- **Save/load UI.** A2 laid the plumbing; the load-a-saved-run UX waits
  for G3 (runs long enough that save matters).
- **Replay system.** Free off A2; build the UI when there's a reason
  (shareable seeds, bug repros).
- **Boss / elite encounters.** Deferred until G1 + G3 stabilize the
  recruit/depth surface.
- **Touch controls** for the camera. D4 shipped WASD + edge-scroll only;
  same scope through Phase G.
- **Editor "test play" button.** Carried from C1d.B. Re-evaluate if a
  layout-tuning bottleneck appears.
