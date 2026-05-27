# ROADMAP — Post-D

The build order after Phase D (battle-layout expansion) landed. Companion
to [DESIGN.md](DESIGN.md), [ARCHITECTURE.md](ARCHITECTURE.md),
[TODO.md](TODO.md), and the prior roadmaps now at
[archive/mvp-roadmap.md](archive/mvp-roadmap.md),
[archive/post-mvp-roadmap.md](archive/post-mvp-roadmap.md), and
[archive/post-c1-roadmap.md](archive/post-c1-roadmap.md).

Synthesized from [archive/combat-feedback.md](archive/combat-feedback.md),
the unfinished tail of the post-C1 roadmap, and [TODO.md](TODO.md). Once
you've read this, `combat-feedback.md` is fully absorbed and lives in
the archive purely as a historical artifact.

## Where this came from

Phase D shipped variable map sizes, two camera modes, spawn regions +
overflow queues, half-cover, the chasm/fire/healing tile family, and
tile theming — the spatial substrate. Playing on the bigger boards made
it obvious that the combat *mechanics* are now the bottleneck: a single
`{ hp, attackDamage, attackRange, attackCooldown, moveCooldown }` stat
block can't carry the four-dimensional archetype variety the c1-feedback
asked for (mage / rogue / healer were stubbed in C2 but never had the
substrate to be more than re-skins). The combat-feedback pass therefore
sits *between* the layout work and the archetype work — Phase E (this
document's first phase) is the combat-mechanics foundation that lets C2
become more than glyph swaps. C3 onward (recruitment depth, in-battle
commands, longer runs) resumes after.

## Conventions

Same shape as the post-C1 roadmap:

- **Commit per logical change**, not per session.
- **Surface tradeoffs** before non-obvious calls.
- **Browser-verify visual work at native resolution.** Preview MCP
  screenshots are unreliable for sub-pixel detail (see
  [HANDOFF.md](HANDOFF.md) tips).
- **Keep DESIGN.md / ARCHITECTURE.md honest.** Update docs in the same
  commit as the code that invalidates them.
- **Headless-first for sim/run/core/config changes** — write a vitest
  test before reaching for the browser preview. The combat foundation
  work is almost entirely headless-testable; E6 (animations + hitsplats)
  is the only step where eyeball verification is primary.
- **Hoist numbers to config.** Phase E will introduce several new
  multipliers (crit damage, speed/endurance cooldown scaling, growth
  rates, XP curve). Land them in `config/*.json` from day one — see
  HANDOFF gotcha #24 for the A4 pattern. Anything you'd want to tune
  without recompiling belongs in JSON.

"Decision points" flag user-input moments (naming, design tradeoffs,
balance knobs). Stop and ask.

---

## Phase E — Combat foundation

The combat-feedback synthesis. Order is chosen so each step's
infrastructure is in place before the next consumes it: stats →
abilities → archetypes/leveling → balance + difficulty rework →
correctness/legibility fixes → new archetypes that exercise everything.

Pathfinding and visual fixes (E5, E6) could in principle land anywhere,
but they're sequenced *after* the data-model work so the diagnostic
work (eyeballing why a unit backpedals; tuning a hitsplat) happens once,
on the final combat mechanics — not on a mid-refactor state.

### E1 — Stats overhaul

Replace `UnitStats { maxHp, attackDamage, attackRange, attackCooldownTicks,
moveCooldownTicks }` with a richer block of named stats, plus a derived-
values layer that turns stats into the numbers the sim already cares
about.

**New stats** (per combat-feedback): `constitution`, `strength`,
`ranged`, `magic`, `luck`, `speed`, `endurance`. `power` is deferred
(it's the meta-stat for the C-era multi-round-battle idea, which stays
out of scope until C6+ lands).

**Derived values** (consumed by sim + UI):

- `maxHp = HP_PER_CONSTITUTION * constitution` (linear; tunable in
  `config/stats.json`).
- Per-ability damage roll uses the relevant stat:
  - basic melee strike → `strength` (plus weapon-style modifiers later)
  - basic ranged strike → `ranged`
  - basic magic bolt (C2-era mage, E7) → `magic`
- `critChance = min(CRIT_CAP, luck * CRIT_PER_LUCK)`, damage multiplier
  on a crit is `CRIT_MULT` (defaults: perLuck=0.01, cap=0.6, mult=2.0 —
  literal `luck%` per combat-feedback, with a high cap as a safety net
  the practical 0-50 stat range never touches).
- `attackCooldownTicks = round(BASE_ATTACK_CD * cooldownScale(speed))`
- `moveCooldownTicks = round(BASE_MOVE_CD * cooldownScale(endurance))`
  where `cooldownScale(s) = max(MIN_CD_SCALE, 1 - s * CD_PER_STAT)`
  (defaults: perStat=0.01, MIN_SCALE=0.4 — literal `1 - speed%` per
  combat-feedback; the floor is a defensive guard, not a design knob
  the practical 0-50 range hits).

**Implementation notes:**

- `UnitStats` becomes the *new* stat block; derived values live in a
  parallel `UnitDerived` snapshot computed once per stat change (level-
  up, status effect later). Keep them as plain typed fields, NOT a
  `Map<string, number>` — type safety wins, and adding a stat is one
  schema bump in a closed set, not threaded across the codebase.
- `Unit.currentHp` keeps its current shape; only `maxHp` is now derived
  rather than rolled.
- `AttackAction.damage` becomes either pre-computed at propose time
  (capturing the stat × ability multiplier) or computed at start —
  decide during impl. The crit roll happens at start, not propose, so
  the sim's tick determinism stays intact (one RNG draw per action
  start). Crit RNG channel: `world.combatRng` (new — fork from the
  battle RNG at battle setup; keeps stat noise out of the
  pathfinding/setup streams that downstream tests pin).
- WorldSnapshot bumps schema version: UnitSnapshot stats field is
  rewritten. Existing v5 snapshots throw on load (loud-failure A4
  pattern; no shipping save format).

**Headless tests:**

- Stats → derived values: table-driven test in `tests/sim/stats.test.ts`
  covering the documented formulas across edge cases (0-stat unit,
  max-stat unit, crit cap, cooldown floor).
- AttackAction crit determinism: same seed + same combatRng position →
  same crit/no-crit decision.
- Snapshot round-trip with the new stats shape.

**Decision points E1:**

- **Crit formula.** Combat-feedback's literal `crit = luck%` is the
  recommendation — given the user-stated design range of "base stats
  rarely zero, 50 is the practical ceiling and unlikely," literal
  `luck * 0.01` gives a starting unit ~3% crit and a high-luck max-
  level unit ~50% crit. Both endpoints feel right at this range. The
  `CRIT_CAP = 0.6` is a defensive guard for the case where future
  buffs or stat-stacking push beyond the 0-50 band, not a design knob
  the base game touches. (Earlier draft pushed back on this assuming
  a 0-100 stat range — retracted.)
- **Cooldown formula.** Same story as crit. Literal `cooldown = base ×
  (1 - speed × 0.01)` is the recommendation — at stat=50 that's 50%
  reduction, at stat=5 it's 5%, both reasonable. `MIN_CD_SCALE = 0.4`
  is a defensive floor (cooldowns can't drop below 40% of base) only
  load-bearing if a future feature pushes speed beyond 60. Same for
  endurance/move. (Earlier draft also pushed back on the 0→0
  cooldown endpoint; retracted under the 0-50 stat range.)
- **Stat caps.** With the 0-50 design range, a runtime hard cap is
  mostly redundant — growth rates < 1 asymptote naturally below 50
  given a sensible level cap (E4's recommended 20). Recommend no
  runtime hard cap, with the level cap doing the asymptote-enforcement
  job. Add a zod validation cap of 99 on base stats in
  `config/archetypes.json` purely as a typo guard (a designer typing
  500 instead of 5).
- **HP-per-constitution scaling.** Linear (HP = K × constitution) is
  simplest. Curved (HP = K × constitution^1.1 or K × sqrt) gives more
  texture but obscures the contract. Recommend linear.
- **Starting stat ranges for melee + ranged.** Combat-feedback says
  "I just picked reasonable-sounding numbers" — they need to be picked.
  Recommend: melee `constitution=10, strength=8, ranged=0, magic=0,
  luck=3, speed=5, endurance=6`; ranged `constitution=6, strength=2,
  ranged=8, magic=0, luck=3, speed=5, endurance=5`. These keep the
  current melee/ranged balance (melee tougher + harder-hitting, ranged
  fragile + reaches) within the new vocabulary. Tune in E4.

### E2 — Ability primitives ✅ landed

**Status:** complete. See [HANDOFF.md](HANDOFF.md) "E2 landed (ability
primitives)" for the breakdown. Net: `AttackBehavior` → generic
`AbilityBehavior` walking `unit.abilities`; concrete `MeleeStrike` +
`RangedShot` in `src/sim/abilities/strikes.ts`; archetype config
gains `abilities: string[]` validated against the registry at boot;
`ActionProposal.cooldownKey` lets multi-ability units have independent
cooldowns. **Half-cover damage modifier deferred to E4** per the
decision call (tune alongside the rest of the stat curve). WorldSnapshot
v6→v7. 336 tests pass (was 333).

Original design (preserved for the E3+ trail of decisions):

Extract the "attack" behavior into a more general `Ability` concept so
mage spells, rogue burst, healer beams (E7) plug in cleanly. The big
lever combat-feedback names is "the only hard-coded thing is the attack
abilities; archetype-to-ability mapping is config."

**Shape:**

- `Ability` interface: `id`, `targeting` (single-enemy / single-ally /
  self / AoE-tile / etc.), `range`, optional `cooldownOverride`,
  `propose(unit, world): ActionProposal | null`, plus a damage/effect
  resolver invoked by the Action it produces.
- Refactor existing `AttackBehavior` into a generic `AbilityBehavior`
  that walks a list of abilities and proposes the highest-scoring one.
  Unit gains `abilities: Ability[]` (one entry for melee in melee
  archetype, one for ranged in ranged archetype; multi-ability units
  arrive in E7).
- AbilityBehavior's scoring stays at 10 (MovementBehavior remains 1).
  Score-tie handling stays "first proposer wins" (gotcha #8).
- Per-ability cooldown lives in `Unit.actionCooldowns` keyed by ability
  id (same Map A1 already added). Per-action `cooldown` value in the
  proposal == derived attackCooldownTicks UNLESS the ability declares
  an override (mage charge-up will).
- AttackAction stays as the single-tick damage primitive; new ability
  classes (charge-up, AoE) get their own Action subclasses registered
  via the existing registry pattern (gotcha #20).
- Half-cover combat modifier (deferred all the way back from D6, then
  C2-era) lands here: the ability resolver sees the LOS-blocker list +
  the half-cover list, and a shot that passes through a half-cover
  applies `HALF_COVER_DAMAGE_MULT` (default 0.5) to the rolled damage.
  Cheap to plumb now while the resolver path is being touched anyway.

**Headless tests:**

- Existing AttackBehavior tests rewritten against the new shape, all
  green.
- New tests: multi-ability unit (synthetic — used to pin the scoring
  path for E7); half-cover damage attenuation; crit roll respects
  ability damage formula.
- Snapshot round-trip with multi-ability units.

**Decision points E2:**

- **Ability config vs code.** Recommend: ability *behavior* (damage
  formula, targeting predicate, effect resolution) lives in TS; the
  *list of ability ids* per archetype lives in `config/archetypes.json`.
  This matches combat-feedback's "only hardcode the attack abilities"
  framing — the things that can vary by tuning (which abilities, on
  which archetype) move to config; the actual implementation of each
  ability stays in code where it can use the type system.
- **Score model.** The selector currently does fixed scores (movement 1,
  attack 10). With multiple abilities per unit, do we score them
  identically (first proposer wins → ability order matters) or compute
  a context-dependent score? Recommend identical scores within the
  ability pool; archetype config sets `abilities: [a, b, c]` and ties
  go to the head — predictable, mirrors how MVP did it.

### E3 — Archetype config + leveling

Hoist archetype definitions into config and add a level dimension. This
is the step that retires the "balance via %HP buff" pattern and replaces
it with "balance via enemy level."

**Schema (`config/archetypes.json`, breaking change):**

```jsonc
{
  "melee": {
    "glyph": "M",
    "baseStats": { "constitution": 10, "strength": 8, "ranged": 0,
                   "magic": 0, "luck": 3, "speed": 5, "endurance": 6 },
    "growthRates": { "constitution": 0.7, "strength": 0.6, "ranged": 0,
                     "magic": 0, "luck": 0.3, "speed": 0.3, "endurance": 0.4 },
    "abilities": ["melee_strike"]
  },
  "ranged": { /* analogous */ }
}
```

`growthRates` are per-stat in `[0, 1]` — the chance that the stat
increments by 1 on a single level-up. A growth rate of 0 means the stat
never grows (useful for archetype-orthogonal stats: melee's ranged stat
stays 0 forever).

**Level-up math:**

- `simulateLevelUps(baseStats, growthRates, n, rng) → UnitStats`:
  iterates n times, each iteration rolls per-stat against `growthRates`,
  increments on success. Used at recruit time for player units. Stays
  byte-deterministic per fork of the recruit RNG.
- `scaleStats(baseStats, growthRates, n) → UnitStats`:
  `stat += round(growthRate * n)` per stat. Used for enemies — fast,
  no RNG, predictable for difficulty curves.

**Unit changes:**

- `Unit.level: number` field (default 1; serialized in UnitSnapshot
  bump).
- Stat block on the unit is the *post-level-up* stats — the level is
  metadata for display, not a runtime modifier.
- `UnitTemplate` carries the level too, plus a "how were these stats
  produced" tag (recruit / scaled / direct) for snapshot-test
  determinism.

**Difficulty rescaling (companion change):**

- `config/difficulty.json` replaces `enemyHpPerFloor` with
  `enemyLevelPerFloor` (initial: 1 per floor, tunable). Enemies on
  floor N spawn at level `1 + (N-1) * enemyLevelPerFloor`.
- `enemySizeDelta` stays.
- `scaleStats` is the enemy path; player units come in at level 1 from
  recruitment until E4 lands player-side leveling.

**Snapshot bump.** WorldSnapshot version bumps again. v6 → v7. Old
snapshots throw; loud failure (A4).

**Headless tests:**

- `simulateLevelUps`: per-stat distribution over many runs lands within
  expected bounds for a given growth rate.
- `scaleStats`: pure-function correctness across a few growth rate +
  level pairs.
- Enemy level scales with floor depth per `config/difficulty.json`.
- Snapshot round-trips through level + stat block.
- `config/archetypes.json` zod schema rejects out-of-range growth rates
  (must be in `[0, 1]`), unknown ability ids, etc.

**Decision points E3:**

- **Enemy stat path: simulate or scale?** Combat-feedback offers both —
  simulate-N-level-ups for player units (drama, dice rolls) and
  `+= growth × N` for enemies (fast, predictable). Recommend exactly
  that split: enemies use `scaleStats` (deterministic, no
  per-encounter RNG state to plumb), player recruits use
  `simulateLevelUps` (rolls feel rewarding). The two functions are
  shipped in the same module; they don't share state.
- **Initial player-unit level on a new run.** All level 1? Or scale
  starting units to floor 1's enemy level? Recommend level 1 for the
  starting roster — the 3M+2R starting team's identity is "raw
  recruits."
- **Recruit-offered level.** Combat-feedback says drafted units are
  produced by simulating level-ups; how many? Tied to current floor
  depth, or always level 1? Recommend `recruitLevel = currentFloor`
  (so a floor-4 recruit comes in at level 4 simulated rolls — keeps
  pace with enemies). Surfaces in the recruit UI as "Level N
  <archetype>."
- **Crit / cooldown formula re-tune.** E1 picked starting numbers based
  on level-1 stats; with leveling in place, max-level stats will be
  much higher. Revisit `CRIT_CAP` + `MIN_CD_SCALE` + `CD_PER_STAT` in
  E4 once playtesting reveals where the ceiling actually lives.

### E4 — XP + difficulty rebalance

E3 lands the data model and the enemy-side scaling. E4 lands the
player-side leveling path + the post-battle XP loop.

**XP source.** Combat-feedback explicitly leaves this open:

> I'm still not sure what's going to feel best here, but my initial
> thought is units keep a standard XP pool and gain XP proportional to
> damage dealt. But I've also thought about just doing flat rates per
> participation, or even just per battle.

This is the E4 decision point. Each option has a snowball/anti-snowball
texture worth thinking through:

- **Damage-dealt XP.** Aggressive units snowball (the more they hit,
  the harder they hit, the more they hit). Healers/tanks fall behind
  permanently. Reinforces the "carry" archetype but punishes
  specialization.
- **Flat per participation.** Every unit alive at battle end gets
  the same XP. Specialists keep pace; encourages putting low-level
  units in front. No snowball, but no "I earned this" feeling either.
- **Flat per battle, party-wide.** Levels are a team-wide currency,
  applied where the player wants. Cleanest UX, decouples leveling
  from per-unit performance entirely — but loses some of the per-unit
  identity combat-feedback was building toward.
- **Hybrid (recommend).** Small flat per participation + per-damage-
  share bonus. Tunable knobs. Picks up most of the upside of each.

**Implementation (regardless of source):**

- New event `battle:ended` payload extension: `xpAwards: { unitId,
  xpGained }[]` per surviving unit. Run + Game subscribe to bank XP
  into the persistent roster.
- `Unit.xp` + `Unit.xpToNext` (or just `xp` + a global curve from
  `config/leveling.json`) — see decision point.
- When `xp >= xpToNext`, level-up triggers automatically (consume the
  XP, increment level, re-roll growth rates against the unit's
  archetype). This happens on the run side, not in the World — World
  is per-battle, leveling is across-battles.
- Recruit screen + HUD show level + XP bar (decision point on whether
  to surface XP).
- Difficulty: `config/difficulty.json` knobs tuned via fuzz harness.
  Re-run fuzz at 100+ seeds post-E3 to set the baseline; then again
  after E4 to verify the XP curve doesn't create new pathologies (a
  too-steep curve = nothing levels; too-shallow = everything maxes
  by floor 3).

**Headless tests:**

- XP award computed per source rule, fed back into Run, level-up
  triggered when threshold crossed.
- Fuzz integration smoke: a long-run game still resolves (no infinite
  level loops, etc.).
- Recruitment offer carries level + stats per the E3 decision
  (recruitLevel = currentFloor).

**Decision points E4:**

- **XP source.** See the four options above. The hybrid is the
  recommendation but the user explicitly flagged this as open — pick
  one and we tune from there.
- **Curve shape.** Linear (`xpToNext = K * level`)? Exponential
  (`xpToNext = K * level^1.5`)? Table-driven? Recommend table-driven
  in `config/leveling.json` so the curve can be edited without a
  formula tweak; ship a hand-authored 10-entry table covering level
  1→10 to start.
- **XP display.** Floating XP-bar on each unit (would need a third
  BarRenderer lane) vs. number-in-HUD vs. hidden-until-level-up.
  Recommend: number on the recruit screen + HUD roster only; in-
  battle floating bars would be visual clutter on top of HP +
  progress.
- **Difficulty knob defaults.** Set during E4 impl; pin via fuzz
  baseline before declaring E4 done.
- **Level cap.** With no runtime stat cap (E1) and growth rates < 1,
  the level cap is what enforces the asymptote — without it stats
  drift toward the user's "50 is the unlikely ceiling" target and
  past. Recommend an explicit level cap of 20 — at growth ~0.6 most
  stats are well into the 30s-40s by level 15-18, hitting the
  intended ceiling without exceeding it, and a cap stops the
  "infinite XP grind" temptation that doesn't fit a ~1-hour run
  anyway.

### E5 — Pathfinding refresh

Two issues combat-feedback flagged on the long-corridor layouts
(Endless Corridors, Strafing Funnel): "units backpedal and reroute,
seemingly at random." Two theories from the user:

1. **Friendly units block the path** — current pathfinding treats
   allies as soft-cost cells (gotcha #38, MovementBehavior cost rule),
   so an ally one step ahead doesn't block but does inflate cost
   enough to favor a detour. On a wide-open board the detour is fine;
   in a 1-tile corridor the detour is "back up and try another row."
2. **Target switches** — `findTarget` picks the nearest enemy each
   tick. In a long corridor with multiple front-line enemies, the
   "nearest" enemy can flip tick-to-tick as enemies move, sending a
   unit's path bouncing.

Both look real. Fix order:

**E5.A — Target stickiness.** Cheaper change, addresses theory 2
in isolation:

- `Unit.targetId: number | null` (snapshotted). MovementBehavior +
  AttackBehavior consult `unit.targetId` first; if the unit is alive
  and reachable, keep targeting it.
- Re-target rule: switch when (a) target is dead/missing, (b) target
  is much farther than the next-nearest viable target (configurable
  ratio, default 1.5×), or (c) target has been out-of-LOS for N ticks
  for ranged units (default 5 ticks @ 10Hz = 0.5s).
- Audit: this changes the deterministic byte stream for any test that
  pins enemy-team behaviour. Existing range-based tests should still
  pass; integration replay tests will need fresh baselines.

**E5.B — Boids-style nudge for blocked units.** Addresses theory 1:

- When MovementBehavior's chosen `path[1]` is occupied by another unit
  (currently abstain — gotcha #71 region's step collision check), try
  a one-cell sidestep instead of giving up.
- Sidestep candidates: the 2-3 cells perpendicular to the target
  direction, picked closest-to-target. Skip blockers + tile costs as
  normal. If none are viable, fall back to current "abstain" behavior
  so corridor queueing still emerges naturally.
- Worth pinning in a new `tests/integration/corridor-flow.test.ts`:
  five-unit train through Endless Corridors resolves within a
  predictable tick count without anyone backpedaling more than `K`
  cells from peak progress.

**Cleanup folded in:** the long-standing pathfinding directional
tie-break TODO (units crab leftward on equal-cost ties) gets sorted in
E5.B's neighbor-iteration overhaul. Recommend: deterministic tie-break
biased toward the straight line from start to goal, *not* RNG-shuffled
neighbor order (RNG-shuffling would shift the deterministic byte
stream every tick a tie is encountered, and that's a lot of test
churn).

**Decision points E5:**

- **Both fixes, or sequence them?** Recommend both, in the A→B order
  above. Theory 2 (target switching) is the cheaper, more isolated
  change and we can verify the backpedal goes away before adding
  boids; if E5.A turns out to fix the visible symptom, E5.B becomes
  cleanup-only.
- **Target-stickiness re-target ratio + LOS timeout.** Defaults 1.5×
  and 5 ticks; tune during playtest. Both live in `config/sim.json`
  (new file? — could reuse `config/spawn.json`'s pattern: per-
  subsystem tunable JSON).
- **Sidestep candidate count.** 2 cells (left/right perpendicular) or
  3 (left/right + back-step-forward)? Recommend 2 — back-step-forward
  is what the current pathing already does via cost gradient, the
  symptom is precisely that 2 perpendicular options weren't tried.

### E6 — Combat visuals

Three legibility wins combat-feedback flagged. None are gameplay-
critical, but with the bigger boards from Phase D and the higher unit
counts E3+ will allow, the current visual feedback breaks down.

**E6.A — Melee shove animation.** When a melee unit attacks, lerp the
sprite ~0.3 tiles toward the target's cell over the attack windup,
then snap back. Hooks into SpriteAnimator's existing lerp path
(`startLerp`) — should be ~40 lines.

**E6.B — Ranged projectile.** Spawn a small glyph sprite (`*` or `·`)
that lerps from attacker to target over the attack windup. Despawns
on hit. Needs a small projectile-pool renderer akin to BarRenderer
(or extend SpriteRenderer with a dedicated layer); reuse the
`InstancedBufferGeometry` recipe (HANDOFF #30 pattern). Pool size
~64 should be plenty.

**E6.C — Hitsplats.** Replace the current sprite color flash on
`unit:attacked` with floating damage numbers above the hit unit:

- Use the existing FontAtlas glyphs (we already have `0-9`).
- New TextRenderer (or extend BarRenderer's recipe) that draws a
  short-lived text quad per hit, lerps it upward over ~0.5s while
  fading alpha.
- Color-code: white for normal hits, neon-red for crits, optionally
  cyan for heals (sets up E7's healer).
- Cluster-safe: stack adjacent hits vertically (offset Y by ~0.2 per
  active hit on the same target).

**Verification:** eyeball-only per [TESTING.md](TESTING.md). Capture
preview screenshots of a 2v2 battle to A/B against the current
flash-only version before lock-in.

**Decision points E6:**

- **Hitsplat font scale.** Same as sprite glyphs vs ~0.7× smaller?
  Recommend 0.7× — keeps them readable but doesn't compete with the
  unit sprite.
- **Projectile spawn point + arc.** Straight line lerp vs slight
  parabolic arc? Recommend straight line — matches the discrete grid
  feel, no extra math, easier to read.
- **Keep the damage flash as a secondary cue, or fully replace?**
  Recommend fully replace — the flash was a fallback for "no
  hitsplats yet"; once hitsplats land it's redundant and reads as
  noise.

### E7 — New archetypes: mage, rogue, healer

The original C2 step, now mostly config + a few new Ability classes.
Phase E has done all the heavy lifting: stats vocabulary (E1), ability
primitives (E2), archetype config + leveling (E3), legibility (E5/E6).

Sketches — refine during impl, but each archetype has obvious mappings
to the E1 stat block:

- **Mage** — high `magic`, low `constitution` + `endurance`. New
  ability `magic_bolt` with a long charge-up (multi-tick action via
  A1's primitive; B3's dormant action progress bar finally pulls its
  weight) and either AoE or long single-target range. AoE damage
  variant is also the first consumer of C1b's wall destructibility
  plumbing — AoE attacks pass damage through Targeting's neutral
  filter via an ability-level `affectsNeutrals: true` flag.
- **Rogue** — high `speed` + `luck`, low `constitution`. New ability
  `gambit_strike` that adds a post-attack reposition: after the
  strike, the rogue gets a free `MoveAction` step away from the
  target (1 cell, deterministic — picks the cell maximizing distance
  with tie-break toward open space). The "kite" pattern emerges from
  attack→reposition→attack cycles, no extra state needed. High luck
  means the crit math from E1 actually does work here.
- **Healer** — high `magic`, low `strength` + `ranged`. New ability
  `heal_ally` that targets the lowest-HP ally in range; new
  `HealAction` that adds HP rather than subtracting, emitting a
  reused `unit:healed` event (already exists from D7's tile chip-
  heal). Avoids combat via a new targeting mode: pick the friendly
  unit cluster's centroid + (-direction from nearest enemy), step
  toward it if no allies are wounded; abstain otherwise.

**Glyph assignments.** Combat-feedback doesn't pick these but C1a's
gotcha #33 means we MUST add new entries to FontAtlas. Recommend
`m` (lowercase, mage), `r` (rogue), `h` (healer). All three are
lowercase to distinguish from the existing uppercase melee `M`,
mirroring the existing convention (melee `M` + ranged `a` — melee
uppercase, all others lowercase). Must not collide with D6's `╥`
or D7's tile-effect glyphs (chasm `.`, fire `^`, healing `+`).

**Recruitment integration.** Once E7 ships, three new archetypes
become valid recruit offers. The current "guarantee at least one
melee + one ranged" rule from `battleSetup` generalizes to
"guarantee role diversity" — landed in F1 (recruitment refactor).

**Decision points E7:**

- **Mage payload: AoE or single-target?** AoE exercises the
  destructibility plumbing and feels more "mage"-shaped; single-
  target is simpler and chains cleaner with the charge-up bar.
  Recommend AoE, 3×3 around target, with falloff at range edges.
- **Rogue reposition direction.** Always away from target? Away
  from *any* nearest enemy (handles flanking)? Recommend "away from
  attacked target" — predictable, the player learns the dance.
- **Healer combat-avoidance scoring.** "Step toward allies, away from
  enemies" can produce frozen units in mid-board. Recommend: if no
  allies in healing range AND nearest enemy is within `panicRange`,
  retreat priority spikes (score 5 — above movement, below ally
  attack). Otherwise heal/idle.

---

## Phase F — Run depth

The residual C-phase content. None of these need to land before E
finishes; sequence within F is recommendable rather than required.

### F1 — Recruitment refactor: draft from pool + rarity

The c1-feedback ask was "draft from a pool of pre-defined unit types
with rarity tiers." Phase E makes the pool meaningful (archetype +
level + stat texture).

- Recruitment pool grows from `[melee, ranged]` to `[melee, ranged,
  mage, rogue, healer]` (E7 unlocks the variety).
- Rarity tiers in `config/recruitment.json`:
  - common: melee, ranged
  - uncommon: mage, healer
  - rare: rogue (reads as the "specialist" of the three new ones;
    rebalance per playtest)
- Offer composition weighted by floor depth: floor 1 = mostly
  common; floor N = increasing uncommon/rare odds.
- "Guarantee role diversity" generalization: at least one
  damage-dealer + one specialist-or-support in each offer (concrete
  rule pending the C2 mage/rogue/healer landing).
- Recruit cards display archetype, level, abilities, key stats.

**Decision point F1:**

- **Recruit-vs-level-up exclusivity.** When a recruit offer fires,
  should there be an "instead of recruiting, level an existing unit"
  option? Combat-feedback doesn't say. Recommend: keep them
  *separate* (level-ups happen automatically from XP per E4);
  recruit offers stay strictly "add a new unit." Mixing the two
  conflates two different progression dimensions.
- **Pool growth from custom unit definitions?** Punted until
  layouts-editor parity exists for archetypes — far future, not F1.

### F2 — Limited in-battle commands

Enabled by A2 (done). Targetless commands (switch to defensive AI,
retreat) and single-target commands (focus this enemy, hold this
location). The plumbing is in place via the `WorldCommand` channel;
this step is the UI + the command implementations.

**Decision points F2:**

- **How many command uses per battle?** Recommend a small shared
  pool (3-5 per battle, charges refund on victory). Charges-based
  feels tighter than cooldown-based for the autobattler-with-
  steering vibe.
- **Cost gating model.** Charges per battle (recommend), per-run
  resource, or cooldown? Tied to F3's run length — a 40-floor run
  with battle-only charges is very different from per-run charges.

### F3 — Multi-map / longer runs

Expand each map to ~10 floors. Multiple maps per run. Target ~1 hour
per run.

Hard prereqs: A3 (done — fuzz harness; difficulty scaling needs
empirical tuning), E4 (done — XP curve has to hold up across 40+
floors). Natural consumer of D5's overflow queue (team sizes grow
past 8 over a long run) and D3's larger boards.

**Theme migration (carried over from D8).** Multi-map runs are the
moment theme moves up a level — each node map carries a theme,
procedural battles within that map inherit. `rollTheme` exits
`Run.handleEnterNode` at that point. See HANDOFF gotcha #92's flagged
follow-up.

**Decision points F3:**

- **Multi-map terminology.** "Acts"? "Regions"? "Chapters"? Recommend
  "Regions" — neutral, doesn't pre-commit to a narrative frame.
- **Inter-map transitions.** HP carry-over (yes/partial-heal/full-
  heal)? Recruit availability between maps (fresh pool / continued)?
  Punted to F3 impl — these are big design knobs.
- **Save/load UI surfaces here.** A2's plumbing has been waiting;
  long runs are when save matters.

### F4 — (Speculative) Split battles + meta-health

User-flagged in the original c1-feedback. Each combat becomes a
series of smaller battles drawing subsets of the team, with wins/
losses depleting a meta-health pool. Deckbuilder-roguelike
inspiration.

Tabled until F3 ships and we can see whether snowballing is still a
problem at long-run scale. Large design surface — don't build
speculatively.

---

## Cleanup / chores

Not gated; can land any time.

- **`world.findUnit` O(n).** Retro flagged. Add `Map<id, Unit>`
  alongside the array. Didn't bite in Phase D; re-evaluate early in
  Phase E (the ability system will be calling findUnit more often
  across multi-ability units and AoE targeting).
- **Favicon.** [TODO](TODO.md). Inline SVG glyph.
- **`.gitattributes`** to normalize line endings. Stops the CRLF
  warnings on every commit (retro item).
- **Bundle chunk-size warning.** Bump `chunkSizeWarningLimit` in
  [vite.config.ts](vite.config.ts), or code-split three.js if it gets
  noisy.
- **Terrain generator: bias water placement toward unit paths.**
  [TODO](TODO.md) — the generator scatters water uniformly, so the
  shallow-water cost-2 rule rarely gets exercised in practice.
  Probably wants "place water in N clusters of size M" rather than
  per-cell Bernoulli. Lower priority post-D5 since spawn regions can
  be anywhere on the board, not just the rows water used to dodge.

---

## What we're explicitly NOT doing yet

- **`power` stat / multi-round battles.** Combat-feedback explicitly
  deferred. Revisit only if F4 (split battles) lands and exposes a
  use for a persistent across-battle stat.
- **Dodge mechanics.** Combat-feedback explicitly deferred to "after
  we see how dodge-less feels." Phase E is the dodge-less baseline;
  revisit only if playtesting flags the need.
- **Save/load UI.** A2 (done) laid the plumbing; the actual "load
  this saved run" UX is deferred until F3 (long enough runs that
  save matters).
- **Replay system.** Free once A2 (done) lands; build the UI when
  there's a reason (shareable seeds, bug repros).
- **Generic status-effect system.** A1 supports multi-tick effects;
  D7 added per-tick tile effects via a targeted hook; E2's ability
  refactor will add several short-duration effects (charge-up,
  reposition, crit windup). Resist building a generic status system
  until E7 (and possibly F1) reveals what's actually needed beyond
  these.
- **Boss / elite encounters.** Deferred until F1 + F3 stabilize the
  recruit/depth surface.
- **Touch controls** for the camera. Deferred per c1-feedback; D4
  shipped WASD + edge-scroll only and the same scope applies through
  Phase F.
- **Editor "test play" button.** Carried over from C1d.B + the post-
  C1 roadmap. Re-evaluate once Phase E ships — if the combat work
  reveals a layout-tuning bottleneck, the URL-encoded handoff finally
  earns its complexity.
