# ROADMAP — Cluster 1: Combat Depth

> **▶ ACTIVE — the first of the six post-X meta-roadmap clusters
> ([META-ROADMAP.md](META-ROADMAP.md)).** An **engine round**: turn hand-coded
> attack classes into a **data-driven attack/effect model**, then build the depth
> (non-stat status effects, chain / status-on-hit / summon) on top of that model.
> This is the **single most-referenced schema in the whole meta-roadmap** — every
> later cluster (consumables, camps, events) authors against it. **Get it right
> once.** **First task of the *next* cluster's round = archive this file →
> `archive/post-x-roadmap.md` and write a fresh ROADMAP.md** (the same
> archive-and-replace ritual that produced this one — see the prior roadmaps now
> at [archive/post-r-roadmap.md](archive/post-r-roadmap.md) and earlier).

Companion to [DESIGN.md](DESIGN.md), [ARCHITECTURE.md](ARCHITECTURE.md),
[BALANCE.md](BALANCE.md), [TODO.md](TODO.md), [GOTCHAS.md](GOTCHAS.md), and
[META-ROADMAP.md](META-ROADMAP.md) (the meta-order across all six clusters). The
prior roadmaps live in the archive: [mvp](archive/mvp-roadmap.md),
[post-mvp](archive/post-mvp-roadmap.md), [post-c1](archive/post-c1-roadmap.md),
[post-d](archive/post-d-roadmap.md), [post-e](archive/post-e-roadmap.md),
[post-f](archive/post-f-roadmap.md), [post-h](archive/post-h-roadmap.md) (I→N),
[post-n](archive/post-n-roadmap.md) (O→R), and
[post-r](archive/post-r-roadmap.md) (S→X — the encounter-system round this one
follows).

Synthesized from [archive/cluster-one-feedback.md](archive/cluster-one-feedback.md)
(the design model, written collaboratively, now archived). Once you've read this
roadmap, that brief is fully absorbed and lives in the archive as a historical
artifact.

## Where this came from (read this first)

The encounter-system round (Phases S→X) is **content-complete**: authored
encounters, sectors, boss/elite tiers, a re-derived difficulty band. The
[META-ROADMAP.md](META-ROADMAP.md) then planned the road to feature-complete as
**six ordered clusters**, deliberately front-loading the two deepest engine
rounds — **Combat Depth** (this one) and **Spatial & Movement** (next) — *before*
the content clusters pile on top. The order is the product: define a model before
the content that consumes it.

**Combat Depth is #1 because the attack/effect schema is the foundation
everything downstream authors against.** Consumables (Cluster 3) grant effects;
camps (Cluster 5) use attacks/effects; the attack editor needs attacks to *be*
data. Spend the time here; get the schema wrong and every later enemy / camp /
consumable re-authors. So the whole cluster is, at bottom, **one schema decision
plus the depth it unlocks** — and the schema is locked in the feedback brief.

The brief decomposes every attack into **three orthogonal axes**:

1. **Targeting** — *who/what* it resolves to (the current enemy, an AoE over
   cells, the lowest-HP ally, self).
2. **Timeline** — *when* things happen: the existing F2 phase schedule
   (`windup → release → travel → impact → recovery`) + the per-action
   `OrphanPolicy`.
3. **Effect-ops** — *what happens* to the resolved targets: an ordered list of
   small typed operations slotted onto phases.

New mechanics are new **ops in the list**, never new action classes. Statuses are
the same effect-ops, applied over time (periodic) or as behavior overrides. The
whole cluster builds out this vocabulary and the depth it enables.

## The two guiding goals (the user's points, made structural)

1. **Keep the codebase clean, comprehensible, easily extensible.** This is the
   *charter*, not a footnote. It's why the keystone is a **strangler migration
   proven byte-identical** (§Phase Y), a **closed, zod-validated, discriminated-
   union vocabulary** (new mechanics are reviewed variants, never a scripting
   language), a **data + interpreter** split (one `switch` over `kind`, never
   deserialized closures), and **decision-hooks, not reach-in** (statuses carry
   flags; the existing consumers read them — the status system holds no AI logic).
2. **Some mechanics aren't testable without their dev tools.** The *logic* is
   headless-testable (the interpreter, the ops, the status fold — pure functions,
   vitest before the browser). What's *not* easily testable headless is **feel and
   visibility**: a confused unit's wandering, a chain's arcs, a burn's tick. So
   two things are pulled forward out of "polish": **the FX/visualization layer
   rides the mechanic that motivates it** (an effect you can't see is an
   unverifiable effect — §Phase Z, §Phase 27), and **the attack/archetype editors
   land with the content authoring** (§Phase 30), exactly the U-vs-V split the
   encounter round used (pure model headless; authoring + feel in the tool).

## Vocabulary (the new types — full shapes in the brief)

The brief is the authoritative type reference; the canonical home will be
`src/sim/effects/` (new). The headline shapes:

- **`EffectOp`** — a small typed op over resolved targets: `damage` · `heal` ·
  `applyStatus` · `summon` · `chain` (recursive) · `move`. A closed discriminated
  union. `move`'s **caster-reposition** modes ship this round (they port
  GambitStrike + Dash); its **`knockback` / `pull`** (target-moving) modes are a
  **reserved-but-unimplemented seam** — declared in the union, deferred to Cluster
  2's hardened occupancy core (the same "declared, no consumer yet" pattern as the
  F2 `re-home` OrphanPolicy).
- **`TargetSelector`** — `self` · `enemyInRange` · `aoe{shape,radius,anchor,
  affects}` · `lowestHpAlly{range}`. The `affects` knob (`enemies` = *not the
  caster's team* — enemy **and** neutral / `allies` / `all`) is the friendly-fire
  filter.
- **`AttackDef`** — `{ id, cooldownSeconds, rangeCells, minRangeCells?, target,
  timeline:Record<Phase,number>, orphanPolicy, priority, effects:{phase,op}[],
  fx? }`. Authored **in seconds**, converted via `secondsToTicks` at load (the
  existing convention — the sim executes in ticks, definitions are in seconds).
- **`StatusDef`** — `{ id, durationSeconds, merge, statMods?, periodic?{everySeconds,
  op}, behavior?{...}, fx? }`. Extends the K1 stat-mod model along two new axes:
  **periodic** (DoT/HoT) and **behavior overrides** (blind/confusion/panic/frozen).
- **`FxKey`** — an opaque renderer key authored on a def. The sim passes it
  through inertly and never interprets it; the renderer owns the FX registry.
- **`EffectAction`** — the single generic `Action` that interprets an `AttackDef`'s
  ops over the F2 timeline. Replaces `MeleeStrike`/`MagicBolt`/`CatapultShot`/… .

## The phase sequence at a glance

```
Y.  Keystone: schema + interpreter + strangler migration   ─┐ (the engine surgery —
Z.  Renderer communication: FX registry + FxKeys + shake    ┤  data model first, FX seam
                                                            │  cleaned, BEFORE depth)
27. Status effects — periodic axis + visualization + tiles ─┤
28. Status effects — behavior axis (decision-hooks)         ┤ (the depth, on the
29. New attack mechanics — chain / status-on-hit / summon   ┤  now-stable model)
                                                            │
30. Dev tools + new content (attack + archetype editors)   ─┤ (authoring + feel)
31. Effect scaling — stat/level-driven magnitude/dur/level ─┤ (the spec hole, filled)
32. FX · SFX · the status-viz / UI design round            ─┤ (polish rides its feature)
33. The closing balance pass                               ─┘ (cluster closer)
```

Phase lettering continues the A→X sequence: **Y, Z, then numbers — Phase 27, 28,
…** (Z is the 26th letter; we count on past it). Recommended path **Y → Z → 27 →
28 → 29 → 30 → 31 → 32 → 33**, with a **playtest pause between commits** as usual.

> **31/32/33 split (2026-06-26 design session).** What was a single "SFX +
> balance" §31 became **three** phases once playtest feedback surfaced a real
> design hole: the new effects (statuses, summon) had **no way to scale with a
> caster stat** the way normal attacks do. §31 fills that (a `ScaledValue`
> descriptor); §32 absorbs the SFX pass and **expands** it into a broader FX +
> status-visualization / UI design round (the cue shape is still open — a design
> round gates it); §33 is the balance closer, now also tuning §31's scaling dials.

### Sequencing rationale

- **Y first (the keystone).** The interpreter + schema is the dependency root; the
  migration *proves* it byte-identical before anything builds on it. Pure sim,
  headless-first. Nothing else can start until attacks are data.
- **Z second (FX seam), before the depth.** "An effect you can't see is
  unverifiable." Z re-homes the *existing six attacks'* FX onto a proper FX
  registry (proving the registry on known-good FX) and retires the ad-hoc
  `magic:detonated` / `catapult:fired` events. This is the substrate the new
  statuses + mechanics light up against — built before them, not after.
- **27 → 28 (statuses, periodic then behavior).** The periodic axis (DoT/HoT) is a
  near-extension of the existing `unit:burned` tile chip and lands the status
  lifecycle events that *are* the in-battle display. The behavior axis (blind/
  confusion/panic/frozen) is the riskier one — it threads decision-hooks through
  the AI/targeting/movement consumers — so it's isolated in its own phase.
- **29 (new mechanics).** `applyStatus` (status-on-hit) needs 27/28; `chain` /
  `summon` are net-new ops with no migration source (the `move` op already landed
  in §Y for dash/gambit; knockback/pull are its deferred C2 seam). Grouped as "the
  new vocabulary," composed on the stable model.
- **30 (tools + content).** The attack editor + archetype-editor "create" land
  *with* the content authoring (the feel surface), not before — exactly the
  encounter round's V phase.
- **31 (effect scaling).** The schema hole the §30 playtest surfaced — statuses
  and summons can't scale with a caster stat the way `damage`/`heal` do. A small,
  *systematic* gap (one descriptor, three consumers), so it's its own phase rather
  than smuggled into balance: it's a **schema-contract change** (a `WorldSnapshot`
  bump), and the schema is the cluster's whole point — get the scaling shape right
  once, like the rest of the vocabulary.
- **32 (FX · SFX · viz/UI).** The original §31 SFX, **expanded**: the playtest also
  hinted statuses need richer *visual* cues (stacks, timers, magnitude legibility)
  beyond the §27/§28 tick-fx + held tint. The cue shape is genuinely open, so the
  phase opens with a **design round** (this session's sibling) before any build —
  "an effect you can't see is unverifiable," and a *scaled* effect you can't read
  is unverifiable twice over.
- **33 (balance).** The migration is balance-neutral *by construction*
  (byte-identical); only the **new** content + §31's scaling dials move balance, so
  the closing pass is scoped to those, not a full re-derivation.

### Hard ordering constraints

Y before everything (the model). Z before 27 (status visualization rides the FX
registry). 27 before 28 (behavior statuses extend the StatusDef serialized in 27)
and before 29 (`applyStatus` needs statuses). 29 before 30's new-mechanic content.
**31 before 32** (the viz/UI round wants to surface the scaled magnitudes/durations
§31 produces) **before 33** (balance tunes the final content *and* §31's scaling
coefficients). 33 last (balance needs the final content + the scaling dials).

## Conventions (unchanged — they still hold)

- **Commit per logical change**, not per session. **Pause between commits** for the
  user's manual playtest.
- **Surface tradeoffs** before non-obvious calls; stop at "Decision points." Steps
  marked **"DESIGN ROUND NEEDED"** want the shape locked with the user before
  building.
- **Headless-first** for sim/run/core/config — a vitest test before the browser.
  The interpreter, every op, the status fold, the behavior decision-hooks are
  **all pure logic**: unit-test them exhaustively before any UI. **Browser-verify**
  render-observable work (FX, status overlays, camera shake); a genuinely new
  **3D glyph** needs a `glyphs.ts` entry (FontAtlas.test guards it — and the atlas
  is **currently FULL at 32/32**, so new unit glyphs force a grid resize — see §30).
- **Hoist every number to config** (A4): durations, cooldowns, magnitudes, chain
  falloff, summon caps, status timings — all in `config/*.json`, authored in
  seconds, never inline.
- **Balance-proof tests derive from the config module** (never hardcode the
  authored numbers); mechanic/primitive tests use explicit literals and never read
  the shipped JSON.
- **Keep DESIGN.md / ARCHITECTURE.md honest** in the same commit as the code that
  invalidates them — this round adds a new `src/sim/effects/` tree, two config
  files (attacks + statuses), an FX registry, two dev tools, and reshapes the
  action/ability registries, so the ARCHITECTURE source-tree + event/command
  catalogs update as each phase lands.
- **Schema discipline — one snapshot bump per shape-contract cluster.** Expected
  **`WorldSnapshot`** bumps this round: **Y** (the `EffectAction` serialization
  replacing the per-class `toData` payloads + in-flight op state), **27** (the
  `StatusDef`-shaped periodic/behavior fields on the per-unit `effects[]`). 28's
  behavior statuses reuse 27's serialized shape (no bump if 27 reserves it); 29's
  ops are config (defs are referenced by id, not serialized) and `summon` produces
  ordinary units. **29 bumped twice as built** — v27→v28 (the chain per-hop
  `pendingChainHops` queue) and v28→v29 (the summon `Unit.summonedBy` cap). **31
  bumps once** — the cast-time-captured scaling scalars ride a new optional slot on
  the in-flight `OpResolution` (`statusMagnitude` / `statusDurationSeconds` /
  `summonLevel`), and an in-flight `applyStatus`/`summon` action *can* exist in a
  v29 save, so reject-stale per the no-migration rule (v29→v30, landing with 31b and
  reserving all three fields so 31c reuses the shape — the "27 reserves 28" pattern).
  **No `RunSnapshot` bump** is expected — this is all World-side combat. Reject
  stale, no migration (the established rule). The **snapshot-roundtrip + determinism tests are the
  guard** — and in Y, the determinism trace is the *equivalence oracle*.

## Architectural decisions (locked in the brief — the cleanliness guarantees)

1. **Data + interpreter, never deserialized closures.** Ops are plain JSON; one
   interpreter (`switch` over `kind`, à la the Action/Behavior registries) executes
   them. In-flight multi-phase actions + periodic statuses serialize as data
   (A2 `toData`/`fromData`) and rehydrate through the interpreter — the snapshot /
   determinism contract holds.
2. **Strangler migration, proven byte-identical.** Build the generic `EffectAction`
   + interpreter, express MeleeStrike as data, let the determinism test be the
   equivalence oracle, then migrate the rest one at a time.
3. **Closed, small, typed vocabulary.** Every op / selector / override is a
   zod-validated discriminated-union variant. New mechanics are new *reviewed
   variants*, not a scripting language. The editor renders each as a form.
4. **Effects slot onto phases; `OrphanPolicy` is per-target.** AoE hits whoever's
   still standing at impact; single-target keeps re-home / fizzle.
5. **Decision-hooks, not reach-in.** Statuses carry flags/params; the existing
   action-selector / targeting / movement consumers read them. The status system
   contains **no AI logic**.

## Cross-phase seams to hold in mind

- **The Action registry is the migration seam.** Today
  ([registry.ts](src/sim/actions/registry.ts)) factories key off `Action.id`
  (`'attack'`, `'magic_bolt'`, `'catapult_shot'`, …); the ability registry
  ([abilities/registry.ts](src/sim/abilities/registry.ts)) wraps each in an
  `Ability`. The new model keeps **exactly these seams** — `EffectAction` is one
  more registered factory; an `AttackDef` id resolves the same way an ability id
  does today ([config/abilities.ts](src/config/abilities.ts)) — but swaps the
  bodies: the per-class `start`/`applyEffect` become interpreter passes over the
  def's ops. **Mine the existing classes**
  ([AttackAction](src/sim/actions/AttackAction.ts) /
  [MagicBoltAction](src/sim/actions/MagicBoltAction.ts) /
  [CatapultShotAction](src/sim/actions/CatapultShotAction.ts)) — they ARE the
  reference semantics the oracle checks against.
- **`applyDamage` is the single chokepoint, and it stays.**
  ([World.ts](src/sim/World.ts) ~`applyDamage`) Every `damage` op — strikes,
  DoTs, ex-tile chips — routes through it with `{evadable, bypassDefense}` flags.
  The **D7.B per-tick tile-damage bypass is deleted** in §27 (fire→burn,
  healing→rejuvenate, both via statuses).
- **K1 is the status base — extend, don't replace.**
  ([statusEffects.ts](src/sim/statusEffects.ts) +
  [triggers.ts](src/sim/triggers.ts) + `Unit.effects`/`effectiveStats`/
  `addEffect`/`expireEffects`). The periodic + behavior axes are *additions* to
  the existing fold-over-stat-mods model, not a rewrite.
- **The F2 timeline is the scheduling spine.**
  ([Action.ts](src/sim/Action.ts) — `ActionPhaseName`, `ActionPhase`,
  `OrphanPolicy`, `phasesBeginningAt`). Ops slot onto phases exactly where
  `applyEffect` fires today (`impact`), generalized to "any op at any phase."
- **The renderer subscribes; the sim emits inert keys.**
  ([BattleRenderer.ts](src/render/BattleRenderer.ts) +
  [events.ts](src/core/events.ts) + [SpriteAnimator.ts](src/render/animation/SpriteAnimator.ts)
  + [AudioPlayer.ts](src/audio/AudioPlayer.ts)). FX scheduling rides the existing
  `action:phase` boundaries + the new `status:*` lifecycle events. The sim never
  holds animation or sound data.
- **The footprint seam (Cluster 2) is planted now.** AoE resolves cells → units
  through a single `unitsInCells(cells)` helper (§Y). Cluster 2's footprint seam
  slots in there, so AoE is multi-tile-correct the moment footprints exist — no
  retrofit.
- **The dev-save endpoint is the editors' home.** `/__save-config`
  ([vite.config.ts](vite.config.ts) `SAVABLE_CONFIG_FILES`) gains the new config
  files; the attack + archetype-create editors POST the same way the encounter /
  sector / layout / archetype editors already do.

---

## Phase Y — The keystone: data-driven attacks + the strangler migration

The dependency root. Build the interpreter + the `AttackDef` schema + the generic
`EffectAction`, then migrate all existing combat verbs to data **one at a time,
each proven byte-identical** against the determinism oracle — the **six attack
classes plus the Dash movement ability** (porting Dash collapses the ability
`kind: attack|heal|movement` discriminator: every ability becomes an `AttackDef`
with different ops, a net cleanliness win). **Pure sim,
headless-first throughout.** FX is left *exactly* as it is during Y (the migrated
attacks keep emitting their current FX cues — that preservation is what makes the
event-trace byte-identical; the FX seam is then cleaned in §Z). The round's main
`WorldSnapshot` bump lands here.

### Y1 — The op / selector / def vocabulary (`src/sim/effects/`)

**Shape:** the closed, zod-validated discriminated unions from the brief —
`EffectOp`, `TargetSelector`, `AttackDef`, plus the load-time `secondsToTicks`
conversion (defs authored in seconds → ticks). A new `config/attacks.json` +
`src/config/attacks.ts` (zod, mirroring [abilities.ts](src/config/abilities.ts)).
`StatusDef` lands in §27; the `applyStatus` op's `statusId` is a plain string
ref here, boot-validated once the status registry exists. Ship the `damage` /
`heal` / `move` ops (the `move` union also *declares* the `knockback`/`pull` seam
deferred to C2) + the `self` / `enemyInRange` / `aoe` / `lowestHpAlly` selectors
needed to *express the existing combat verbs* (the six attacks + Dash) — the rest
of the vocabulary (`chain`/`summon`/`applyStatus`) is reserved-but-unbuilt until §29.

**Cost:** types + validation only, no behavior. No snapshot touch.

**Headless tests:** the schema parses + rejects malformed ops/selectors; the
seconds→ticks conversion matches the existing timer convention; a def round-trips.

**Decision points Y1:** the canonical id set — do `AttackDef` ids live in their
own `config/attacks.json` (recommend — a clean new home, the editor's target) or
fold into the existing `config/abilities.json`? Confirm `attacks.json` is added
to the `/__save-config` allowlist now (the editor needs it in §30).

### Y2 — The interpreter + the generic `EffectAction`

**Shape:** the single `EffectAction implements Action` that interprets a def's
`effects:{phase,op}[]` over the F2 timeline — ops fire at their authored phase
boundary (generalizing today's "`applyEffect` at `impact`"), the per-target
`OrphanPolicy` decides dead-target handling, `phaseTarget()` surfaces the
renderer's target info. The **op interpreter** is one `switch` over `op.kind`
(`damage` → `world.applyDamage`, `heal` → the heal path, `move` → the
caster-reposition primitive). The `aoe` selector resolves cells → units through the new
**`unitsInCells(cells)`** helper (the Cluster-2 footprint seam — single-cell
today). `toData()`/`fromData()` serialize the in-flight op cursor so a
mid-flight snapshot rehydrates through the interpreter.

**Cost:** the interpreter is the new core; reuses `applyDamage`, the crit roll off
`combatRng`, the heal/ledger paths. The `EffectAction.toData` shape is the new
serialized contract → the **`WorldSnapshot` bump** lands when Y5 flips archetypes
over (keep it one bump). Headless.

**Headless tests:** each op in isolation (damage mitigation + evade + crit
ordering matches `applyDamage`; heal clamps at maxHp; move repositions); ops fire
at the authored phase; `OrphanPolicy` per-target (AoE hits the standing units at
impact, single-target fizzles/commits); `unitsInCells` returns the occupants;
toData/fromData round-trips an in-flight multi-phase action.

**Decision points Y2 — RESOLVED (user).** The `move` op ships **only the
caster-reposition modes** needed to port GambitStrike (F4 dart-back) + Dash (N1
gap-closer) — reuse the proven F4 deferred-reposition + the J2 movement-intent
paths. The **target-moving `knockback` / `pull` modes are a reserved seam**:
declared in the `move` union + boot-rejected-if-authored (an `assertNever`-guarded
arm with no consumer, exactly like F2's `re-home`), **implementation deferred to
Cluster 2** so the occupancy/collision core is touched once, in the round built to
harden it. No `move` work lands in §29.

### Y3 — Migrate the FX-natural attacks (the oracle proof) ✅ DONE

> **Shipped** (`affe68d`→`9ba9588`): MeleeStrike (sword/club/katana/whip) →
> RangedShot (bow) → HealAlly → GambitStrike → Dash, each its own commit,
> oracle-proven byte-identical. The propose bridge ([propose.ts](src/sim/effects/propose.ts)),
> the generic [EffectAbility](src/sim/effects/EffectAbility.ts), and the
> equivalence oracle ([effectMigration.test.ts](tests/integration/effectMigration.test.ts))
> all landed here. The gambit confirmed `damage@windup` + `move-retreat@impact`;
> the dash's selector settled as `self`. No snapshot bump (Y5). 1276 main green.
> **NEXT = Y4.**

**Shape:** express **MeleeStrike** as an `AttackDef` (`effects:[{impact,
damage(bypassDefense:false)}]`) and let the determinism test be the equivalence
oracle — the event trace must be **byte-identical**. Then migrate the other
attacks whose FX rides naturally-firing events: **RangedShot** (same as melee +
the projectile on `release`, which still rides `action:phase`), **HealAlly**
(`lowestHpAlly` + `heal@impact`, drives `unit:healed`), **GambitStrike**
(`damage@impact` + `move@recovery` — **proves multi-phase op slotting**, drives
`unit:moved` + `unit:attacked`), and **Dash** (a pure `move`-op def, no damage —
**proves the standalone caster-reposition** + collapses the movement-ability
discriminator; drives `unit:moved` + `unit:dashed`). One commit per verb,
determinism-proven, with a playtest pause.

**Cost:** each migration deletes a per-class action once proven. Headless
determinism is the gate; browser sanity-check the feel is unchanged.

**Headless tests:** the determinism trace for each migrated attack is byte-
identical to its pre-migration baseline (the oracle); a fixture battle using only
migrated attacks matches event-for-event.

### Y4 — Migrate the FX-cue attacks (AoE + ground-target + travel)

**Shape:** migrate **MagicBolt** (`aoe{square,1,targetCell,affects:'enemies'}` +
`damage@impact(evadable:false)`, `orphan:ground-target`) and **CatapultShot**
(`travel` phase + single-target `damage@impact`, `orphan:fizzle`). These are the
attacks whose FX is cued by the ad-hoc `magic:detonated` / `catapult:fired`
events. **To keep the byte-identical proof intact, Y4 preserves those exact event
emissions** (the interpreter emits them at the same phase the old classes did — a
deliberate, ~2-line **strangler artifact** removed in §Z). Plant the
`affects:'enemies'` filter (= *not the caster's team*) so AoE becomes destructible-
terrain-correct for free when neutral entities gain HP in Cluster 2.

**Cost:** completes the migration; the legacy FX events live one more phase. The
`unitsInCells` + `affects` filter get their first real exercise. Headless +
browser (the boom / lob must look unchanged).

**Headless tests:** MagicBolt's AoE hits the same cells/units with the same crit-
once semantics; CatapultShot fizzles on a dead target with no `combatRng` draw;
both byte-identical against baseline.

**Decision points Y4:** confirm the strangler artifact (preserve `magic:detonated`
/ `catapult:fired` through Y, retire in Z) vs. building the FX registry *first* and
migrating these straight onto it. **Recommend preserve-then-retire** — it keeps Y a
clean, fully-provable event-trace migration and Z a clean render refactor, at the
cost of two throwaway emit lines. (This is the one genuine ordering call in Y.)

### Y5 — Archetypes reference attack ids; retire the dead classes

**Shape:** archetypes (and unit templates) carry a list of `AttackDef` **ids**;
the registry resolves them, exactly as ability ids resolve today
([config/archetypes.ts](src/config/archetypes.ts) +
[battleSetup.ts](src/sim/battleSetup.ts)). Flip every archetype's combat ability
over to its data-driven def; delete the now-dead `AttackAction` /
`MagicBoltAction` / `CatapultShotAction` / `HealAction` / `GambitStrikeAction`
classes + their factory entries. The **`WorldSnapshot` bump** (`EffectAction`
serialization replaces the per-class payloads) lands here, reject-stale.

**Cost:** the net deletion that makes the migration *clean* — the whole point is
fewer classes, not more. Browser-verify a full battle across all archetypes.

**Headless tests:** every archetype spawns with a resolvable def; a full multi-
archetype battle is deterministic + round-trips through the new snapshot; the v-1
reject rides the generic stale-schema test.

**Decision points Y5:** confirm the dead-class deletion is total (no consumer
outside the registry references them — the fuzz arena + spawn-overflow call
`rollEnemyWave`/`buildEnemyTeam`, **not** the attack classes, so they're safe to
delete). Keep `priority` on the def as the AI-scoring seam (read in §29), defaulting
to today's array-order tiebreak.

---

## Phase Z — Renderer communication: the FX registry + opaque FxKeys

Clean the FX seam **before** the new effects need it. Retire the ad-hoc
`magic:detonated` / `catapult:fired` events; defs carry **opaque `FxKey`
strings**; the renderer owns an **FX registry** mapping `FxKey →
{animation channels, VFX, SFX}`, built on the existing channels (SpriteAnimator
shove/arc/fade, the `bloomIntensity` flash, transient projectile sprites,
hitsplats, AudioPlayer). Re-home the **existing six attacks'** FX onto the
registry first — proving it on known-good FX — then it's the substrate §27/§28/§29
light up against. **Render-layer + a small event-shape change; browser-verify. No
snapshot bump** (events aren't serialized).

**Shape:**
- An **FX registry** (renderer-owned) keyed by `FxKey`, resolving to the channels
  above. Scheduling rides the existing `action:phase` boundaries (projectile on
  `release`, hitsplat + camera-shake on `impact`).
- **Camera shake** as an fx key on heavy impacts — a new renderer channel (the
  brief reclassifies it from terminal polish to "rides its feature"); it's the
  proof that the registry can carry a *non-sprite* effect.
- A **boot assert** verifying every `FxKey` referenced in config resolves in the
  registry (mirrors the ability-registry id check) — a typo'd key fails at
  startup, not silently.
- Retire `magic:detonated` / `catapult:fired` (the Y4 strangler artifact); their
  VFX now resolve via the def's `fx` over `action:phase`.

**Cost:** render-only + an `events.ts` shrink (two events removed). The
`bloomIntensity` flash, shove, projectile, and hitsplat channels already exist —
this *organizes* them behind keys, it doesn't invent them. Browser-verify every
existing attack's FX is unchanged + camera shake reads on a heavy hit.

**Headless tests:** the boot assert (an unresolved `FxKey` throws); the registry
resolution is a pure map (unit-testable without three.js). FX *appearance* is
eyeball-verified (render layer — the established policy).

**Decision points Z:** does `fx` ride the `action:phase` event payload (the
renderer reads the key off the event) or does the renderer resolve
`actionId → def → fx` itself (the event stays lean)? **Recommend the def-resolve
path** (the event already carries `actionId`; keeps the payload minimal and the
key authoritative on the def). Confirm camera-shake intensity is an fx-registry
parameter (authored per key), not a sim concern.

---

## Phase 27 — Status effects: the periodic axis + visualization + tile unification

> **27a–27e ✅ ALL SHIPPED & green (1258 main + 210 fuzz). ✅ USER-PLAYTESTED & LOVED** (one tweak applied — the apply flash dropped, below).
> **27a** (`98b29b4`): the `StatusDef` schema + registry + the `applyStatus` ref
> boot-check. **27b** (`940d55e`): the periodic engine — **def-resolved by key**
> (the effect carries only `nextTickAt` + `sourceUnitId`; op/interval/duration live
> on the def, so §28 behavior adds no serialized state → no §28 bump), the
> extracted `dealDamage` chokepoint + `applyDamage.bypassDefense`,
> `applyStatusEffect` / `applyPeriodicEffects`, the `status:applied/ticked/expired`
> events (⭐ `status:ticked` also carries `amount`), **WorldSnapshot v26→v27**.
> **27c**: the four periodic statuses in [config/statuses.json](config/statuses.json)
> — burn (`refresh`, 4 s, 2 dmg/s, `bypassDefense`), bleed (`add`, 4 s, 2/s),
> poison (`add`, 6 s, 1/s), rejuvenate (`refresh` HoT, 4 s, 1/s); DoT ops author
> the locked default; magnitudes/durations are PLACEHOLDERS → §33 (balance); balance-proof
> derives the burn/rejuvenate rates from `tiles.json`.
> **27d+27e** (this commit — the FIRST observable surface, paired so fire damage
> never shows without feedback): **27d** deleted `applyTileEffects` → a tile pass
> that sustains `burn` (fire) / `rejuvenate` (healing) — apply-on-enter then a
> silent per-tick duration top-up (lingers after stepping off), HP change now the
> periodic tick through `dealDamage`/the HoT clamp; **`unit:burned` retired**, all
> consumers re-homed. **27e** the renderer status-fx driver (`onStatusTicked` →
> `driveStatusFx`) resolves `StatusDef.fx.ticked` → the §Z registry (new `hitsplat`
> + `sparkle` channels + 4 `_tick` keys + a boot-check; burn/rejuvenate re-home the
> retired tile SFX). **Playtest tweak:** the apply flash was DROPPED — it fired
> mid-lerp onto a tile (`MoveAction` snaps the logical position on at move-start),
> reading as "burning before arrival"; a status now cues only on its ticks (the
> `applied`/`expired`/`active` fx slots remain in the schema for §28/§29). A
> persistent `active` overlay + an `expired` cue stay DEFERRED (sparkle-height +
> settle-on-arrival apply cue → TODO.md). **NEXT = §28** (the behavior axis).

Extend K1 along the **periodic** axis (DoT/HoT) and land the status lifecycle
that *is* the in-battle display. **`WorldSnapshot` bump** (the StatusDef-shaped
fields on `effects[]`).

**Shape:**
- **`StatusDef` + the status registry** (`config/statuses.json` +
  `src/config/statuses.ts`, zod) — extends the K1 `StatusEffect` with
  `periodic?{everySeconds, op}` (the op output × magnitude) + `merge` semantics
  (`refresh`/`add`/`instances`/`ignore`). Boot-validates the `applyStatus` op's
  `statusId` refs from §Y.
- **The periodic statuses:** **burn** (`refresh`, 4 s, bypass-defense), **bleed** /
  **poison** (`add` magnitude), **rejuvenate** (HoT, `refresh`, 1 s). Periodic
  effects fire their **first tick one interval after apply** (the applying hit
  doesn't double-dip). All DoTs route through the single `applyDamage` chokepoint
  with `{evadable:false, bypassDefense:true}` (revisit after playtest).
- **`sourceUnitId` attribution** — set on apply, so periodic-damage kills credit
  the right unit's XP / kill ledger (the E4/F6 `damageDealt` path); optional on the
  *event* (a generic environmental burn may have none — mirrors `unit:healed`'s
  `healerId | null`).
- **The status lifecycle events:** `status:applied` / `status:ticked` /
  `status:expired` `{ unitId, statusId, sourceUnitId? }` ([events.ts](src/core/events.ts)).
- **Tile unification — retire the D7.B per-tick tile pass.** Fire tiles
  apply/refresh **burn**; healing tiles apply/refresh **rejuvenate** (both
  `refresh`, so standing reapplies and the effect lingers after stepping off). The
  old tile-damage bypass special-case ([World.ts](src/sim/World.ts) ~tile pass) is
  **deleted** — all damage now flows through `applyDamage`.
- **In-battle status visualization = the lifecycle subscription** (a feature, not
  separate polish). The renderer subscribes to `status:applied/ticked/expired` and
  drives apply/tick/expire/`active` fx keys (the persistent overlay/tint) via §Z's
  registry.

**Cost:** the K1 extension + the tile-pass deletion (a *net simplification* — one
damage path, not two). `WorldSnapshot` bump (periodic state on `effects[]`).
Headless for the fold + periodic math + tile→status; browser-verify the burn/heal
overlays + that fire/healing tiles still chip/heal at the same cadence.

**Headless tests:** a periodic op ticks at its interval, first tick one interval
after apply; `add` magnitude sums on reapply, `refresh` resets duration; a DoT
kill credits `sourceUnitId`; fire tile → burn matches the old per-tick chip
**rate** (a balance-proof test deriving from `tiles.json`); rejuvenate matches the
healing tile; DoT routes through `applyDamage` (defense bypass honored); snapshot
round-trips an active burn mid-tick.

**Decision points 27:** the bleed/poison **durations + magnitudes** are content
dials — author placeholder values now, **tune in §33** (balance). Confirm DoTs stay
`bypassDefense:true` + `evadable:false` for the first pass (the brief's locked
default; revisit at playtest). Does the tile→status apply credit a `sourceUnitId`
(recommend `null` — environmental, like today's `healerId:null`)?

---

## Phase 28 — Status effects: the behavior axis (decision-hooks)

> **28a–28c ✅ ALL SHIPPED & green (1296 main + 210 fuzz). ✅ USER-PLAYTESTED & LOVED.**
> **No snapshot bump — WorldSnapshot stays v27** (behavior is DEF-RESOLVED by key,
> exactly like 27's periodic axis — the serialized `StatusEffect` gains no field).
> **28a** (`9dfd7b4`): the `StatusDef.behavior` block ([statusSchema.ts](src/sim/effects/statusSchema.ts))
> + the pure `behaviorFlags` def-resolve fold ([statusBehavior.ts](src/sim/statusBehavior.ts),
> the §27-periodic-resolve analog — OR the prevents/targeting/affects flags, flee>wander
> for movement, MIN for acquisitionRange, a shared frozen NEUTRAL when nothing applies)
> + the four statuses authored in [config/statuses.json](config/statuses.json)
> (durations are §33-balance placeholders). **28b** (`24c4915`): the consumer decision-hooks
> — `AbilityBehavior` skips attacks under `preventsAttack`; `MovementBehavior` roots
> on `preventsMove` / flees via the gambit's `retreatCell` on `movement:'flee'` /
> wanders a random free neighbor (combatRng) on `movement:'wander'`, all checked
> BEFORE the objective/pursuit logic; `Targeting` picks a random any-team mark within
> the confusion radius (`currentTarget` honors a confused ally mark + never falls back
> to the normal enemy pick → the single-target friendly-fire) and caps the blind enemy
> pick to adjacent; the interpreter forces a confused caster's AoE to `affects:'all'`
> (read LIVE at fire time → no serialized state). Confusion gained a bounded
> `acquisitionRange: 5` (a §33-balance dial) so it isn't omniscient. **28c** (`de0b497`): the
> observable surface — a persistent `overlay{tint}` FX channel + the four `_active`
> keys ([fxRegistry.ts](src/render/fxRegistry.ts), frozen ice-cyan / panic fear-amber
> / blind blinded-grey / confusion chaos-purple), the renderer holding the held tint
> off `status:applied`/`status:expired` ([BattleRenderer.ts](src/render/BattleRenderer.ts)
> `statusOverlays`, restore team color on expiry, clear on death/reset), + a DEV-only
> `__game.applyStatus(id, team|unitId)` console hook ([main.ts](src/main.ts)) routing
> through the real `applyStatusEffect` so the lifecycle drives the overlay. **Browser-
> verified** via the sprite color buffer: four distinct tints apply, expiry restores
> the team color, per-status durations elapse correctly. **Playtest it:** open the
> console in a battle and run e.g. `__game.applyStatus('confusion')` (all enemies) or
> `__game.applyStatus('frozen', 'player')`. **NEXT = §29** (status-on-hit / chain /
> summon — the `applyStatus` op is the production applier these statuses were waiting
> for).

The riskier axis — **behavior/AI overrides** threaded through the existing
consumers as **decision-hooks, not reach-in**. The status system stays logic-free;
the action-selector / targeting / movement code *reads* the flags. Likely **no
snapshot bump** (reuses §27's serialized StatusDef shape — confirm).

**Shape:** the `StatusDef.behavior` block + the four statuses, each a flag the
right existing consumer reads:
- **frozen** — `{preventsAttack, preventsMove}`: the action-selector skips a frozen
  unit's turn entirely.
- **panic** — `{preventsAttack, movement:'flee'}`: can't attack, flees (the
  MovementBehavior goal-selector reads `movement`).
- **blind** — `{movement:'wander', acquisitionRange:1}`: wanders; only strikes a
  unit it's adjacent to (Targeting reads `acquisitionRange`); the enemy-only filter
  is preserved (friend/foe intact).
- **confusion** — `{targeting:'random', affects:'all'}`: the indiscriminate status
  — picks targets at random across *all* teams and its attacks are forced to
  `affects:'all'` regardless of the def.
- Visualization rides §27's lifecycle + the `active` overlay (a frozen tint, a
  panic indicator).

**Cost:** the surgery is in the *consumers* ([AbilityBehavior.ts](src/sim/behaviors/AbilityBehavior.ts)
/ [MovementBehavior.ts](src/sim/behaviors/MovementBehavior.ts) /
[Targeting.ts](src/sim/Targeting.ts)), each reading a flag at its existing decision
point — small, surgical, no new control structures. Headless-first (the consumers
are pure given a unit's effects); browser-verify the wander/flee/freeze *read*
(this is a "not testable without seeing it" surface — §point 2).

**Headless tests:** a frozen unit proposes nothing; a panicked unit proposes only
flee-moves; a blind unit only strikes adjacent + wanders otherwise; a confused unit
picks a random-team target + its AoE hits `affects:'all'`; each is deterministic
off the seeded RNG; the friend/foe filter survives blind.

**Decision points 28:** confirm the confusion targeting RNG channel (the
`combatRng` vs a dedicated draw — recommend `combatRng`, where targeting rolls
live). Where does the random-team pick read its candidate set (all units in
acquisition range vs all on the board — recommend acquisition range, so confusion
isn't omniscient)? The behavior-override **durations** are content dials → §33 (balance).

---

## Phase 29 — New attack mechanics: chain / status-on-hit / summon

> **▶ IN PROGRESS — the user chose "full demo archetypes now,"** so §29 absorbs
> §30's content floor: the 3 new ops PLUS a 9-archetype demo roster (user-speced
> stats), built across ~6 commits, each op landing with its first consumer. The
> roster: PLAYER afflicters **Reaver** (bleed/`cleaver`, adventurer stats) ·
> **Corrupter** (poison "Vial", no-windup 3×3 AoE, mage stats) · **Stormcaller**
> (chain, mage stats) · **Shaman** (summon, catapult stats) + **Ghoul** minion
> (½ bandit stats); ENEMY disruptors **Ice mage** (frozen "Ice Storm", instant 3×3
> AoE, ranged stats) · **Warlock** (confusion, mage stats) · **Luminant** (blind
> "Light Ray", archer-style, ranged stats) · **Banshee** (panic AoE, mage stats).
> **✅ 29a + 29b SHIPPED, pending playtest.** **29a status-on-hit:** the reserved
> `applyStatus` op wired end-to-end ([interpreter.ts](src/sim/effects/interpreter.ts)
> resolves targets off the def selector, gated on a LANDED hit via the per-fire
> `missed` scratch; `applyDamage` now returns hit/miss; `applyStatusEffect` gained a
> duration override) + Reaver/`cleaver` + the FontAtlas resize 8×4→8×6. **29b the 5
> afflicters** — pure CONTENT on the proven op: Corrupter (poison "Vial" 3×3 AoE) ·
> Ice mage (frozen "Ice Storm" instant 3×3 AoE) · Warlock (confusion "Hex" AoE
> pure-applier) · Luminant (blind "Light Ray" single-target) · Banshee (panic "Wail"
> AoE pure-applier); 6 FX keys reuse existing channels (SFX → §32). No snapshot bump.
> **✅ 29c SHIPPED (pending playtest):** the recursive **`chain` op** + **Stormcaller**
> (chain_lightning, mage stats, glyph `z`). The op arcs to up to `maxJumps` targets —
> primary = the committed `currentTarget`, then nearest fresh enemy within `rangeCells`
> of the previous victim (no repeats, deterministic `world.units` tie-break) — applying
> its inner `ops` with cumulative `falloff^jump` on damage. The **cast-time-capture
> decision** (the heads-up below) resolved to: capture each nested op's scalars ONCE at
> propose time into a new optional `OpResolution.chainOps[]` (deep-cloned by
> `cloneResolution`) → round-trips, **no snapshot bump**. `ChainInnerOp` is a RESTRICTED
> union (`damage | applyStatus`, no nested chain / `z.lazy`, like `PeriodicOpSchema`);
> the recursion is in the interpreter (`executeChain` → `executeOp` per inner op, fresh
> per-hop scratch). `assertStatusRefsResolve` recurses into `chain.ops`.
> **PER-HOP DELAY follow-up SHIPPED (the chain TRAVELS tick-by-tick; `WorldSnapshot
> v27→v28`):** the user chose real per-hop timing over a render-only stagger. The
> chain resolves hop 0 at impact, then the rest ride a **`World.pendingChainHops`
> deferred queue** (`scheduleChainHop` + `processChainHops` driven per `tick`, beside
> the §27 periodic engine), firing one hop every `hopDelaySeconds` (new `ChainOp`
> field, default 0.1s → 2 ticks; `0` = the original all-at-once). Each hop re-resolves
> its target LIVE, so its arc + damage number + HP drop coincide on that tick. New
 `unit:chained` per-hop event → the renderer's `onUnitChained` flies a `chain_arc`
> tracer per arc (the def `fx.impact` retired). v28 round-trips a chain mid-arc.
> **✅ 29d SHIPPED (pending playtest) — the `summon` op + Shaman + Ghoul; `WorldSnapshot
> v28→v29`:** the last reserved §29 verb. `SummonOp{summon:SummonSpec, at:TargetSelector}`
> placed in the `EffectOp` union AFTER the selectors (its `at` anchor IS a selector).
> `executeSummon` resolves the `at` anchor (default `self`), takes the `count` nearest
> free cells via a new `nearestFreeCells` BFS (the `actingPosition` sibling — same graph,
> but candidates must be UNOCCUPIED, expands THROUGH occupied-but-passable cells; fizzle
> if none in `radiusCells`), and spawns each minion via `World.spawnSummon` (the
> `spawnFromQueue` twin: deterministic `scaledUnit` stats, the shared behaviors/abilities,
> a `SpawnAction` lockout + `unit:spawned{instant:false}` fade — the safe mid-`tick` add,
> since the per-unit loop iterates a `units.slice()`). **The cap = a serialized
> `Unit.summonedBy` (the v29 bump):** `World.liveSummonCount` counts a caster's living
> minions; `proposeSummon` abstains at `maxLive` (re-summoning as they die), the
> interpreter clamps defensively. Reaping drops the count automatically — no ledger.
> A new `assertSummonRefsResolve` (config/archetypes.ts, the `assertStatusRefsResolve`
> sibling) boot-rejects a typo'd `summon.archetype`. Content: **Shaman** (glyph `s`,
> catapult-ish stats, `raise_dead` self-anchored summon, holds at range 6 / no attack)
> raises up to 3 **Ghoul** minions (glyph `g`, `ghoul_claw`, ≈ half a bandit). No FX/SFX
> (the minion fade is the cue; the summon-pop SFX is §32). Browser-verified: a live
> Shaman summons Ghouls capped at 3, both glyphs render. ⚠️ `ALL_ARCHETYPES` auto-makes
> every archetype player-draftable; the user chose to KEEP all §29 archetypes draftable
> through §29's end (for testing), so the enemy-disruptor + summon-only-Ghoul
> recruit-pool exclusion was the **§29-close cleanup — ✅ DONE:** a per-archetype
> `draftable` config flag (default true; `false` on ice_mage/warlock/luminant/banshee +
> ghoul) feeds a derived **`DRAFTABLE_ARCHETYPES`** ([src/sim/archetypes.ts](src/sim/archetypes.ts))
> that `rollOffer` ([Recruitment.ts](src/run/Recruitment.ts)) samples instead of the full
> catalog; `ALL_ARCHETYPES` stays the canonical full list (telemetry/fuzz/roster). The
> archetype-editor formatter emits the line only when false (minimal file diff). **§29 is
> now COMPLETE** — NEXT = §30 (the attack + archetype editors).
>
> **29c heads-up (chain):** the recursive `chain{maxJumps, rangeCells, falloff,
> ops}` arm needs cast-time scalar capture for its NESTED `ops`. Today's
> `OpResolution` model is **per-top-level-`def.effects`-op** (the `propose.ts`
> `resolveOp` runs once per entry, aligned by index) — a chain's inner damage op
> has no resolution slot. So the chain arm must either resolve its inner ops'
> `baseDamage`/`critChance` at cast (and carry them, applying cumulative `falloff`
> per jump) or resolve them live per-jump off the caster's stats. Decide that with
> the determinism/snapshot contract in mind (in-flight chain state must round-trip
> — confirm against `EffectActionData`). The jump geometry (nearest valid target
> within `rangeCells`, no repeats) is deterministic; reuse the targeting helpers.
> Stormcaller = mage stats, glyph `z`; needs a chain-arc FX key (reuse the `tracer`
> channel). Headless-first, as always.

The net-new ops — pure composition + recursion on the now-stable model. No
migration source; these are *additions* to the closed vocabulary. (`move`'s
knockback/pull is **not** here — it's the reserved §Y seam, deferred to Cluster 2;
§29 touches no repositioning.) **No snapshot bump expected** (defs are config;
`summon` makes ordinary units) — confirm against Y's `toData` if an in-flight
`chain`/`summon` carries new state.

**Shape:**
- **status-on-hit** — `damage@impact` + `applyStatus@impact`: pure composition, no
  new op (the `applyStatus` op shipped reserved in §Y, wired to §27/§28's
  registry). The cheapest, highest-value new mechanic.
- **chain** — the recursive `chain{maxJumps, rangeCells, falloff, ops:EffectOp[]}`
  op: jump to the nearest valid target within range, apply `ops` with cumulative
  `falloff`, repeat to `maxJumps`. The interpreter recurses over the op's `ops`
  list (the closed vocab's one recursive variant).
- **summon** — `summon{summon:SummonSpec, at:TargetSelector}`: spawns a unit onto
  the caster's team; stats roll off the **battle RNG**.
  - **Placement (caster-anchored, NOT the team spawn region).** `at` names an
    **anchor** via the existing `TargetSelector` (default **`self`**); the summon op
    places into the **nearest free cell(s) to that anchor**, via the bounded BFS
    that [actingPosition.ts](src/sim/actingPosition.ts) already uses. So `at:self` =
    "adjacent to me," `at:<target selector>` = "next to the target" (the flank
    summon — free, no extra mode), and `at:aoe{anchor:caster}` = multi-summon across
    an area: one resolver — *resolve anchor → nearest free cells → take `count`*.
    Deterministic geometry (only stats use RNG). A per-`SummonSpec` **`radiusCells`
    (default 2)** bounds how far from the anchor a summon may land; **no free cell in
    radius → fizzle** (the cooldown + cap retry next opportunity). The free/valid-cell
    query routes through the same occupancy abstraction Cluster 2's footprint seam
    formalizes (`unitsInCells`) → multi-tile-correct for free later.
  - **Per-caster live cap** — `maxLive` on the `SummonSpec` (single digits): the
    summoner holds ≤ N minions, re-summoning only as they die. Bounds the total unit
    count, which keeps the **object-pooling TODO parked** (see *Decision points 29.2*).

**Cost:** mostly interpreter additions (new `switch` arms) + the caster-anchored
placement resolver (reusing the `actingPosition` BFS) + the cap. Headless for the
op logic; browser-verify chain arcs / a summon popping in beside its summoner (FX
keys via §Z).

**Headless tests:** chain jumps to N nearest targets with falloff, stops at
`maxJumps` or no-target; status-on-hit applies the status on a landed hit (not on a
miss/fizzle); summon places at the nearest free cell to the `at` anchor (`self` →
adjacent to caster; a target anchor → adjacent to target), **fizzles when no free
cell within `radiusCells`**, **stops summoning at `maxLive`** (and re-summons once a
minion dies), multi-summon fills the `count` nearest free cells; each deterministic
+ round-trips.

**Decision points 29:**
1. **`move`/knockback — RESOLVED (user):** caster-reposition ships in §Y (dash +
   gambit); knockback/pull are the reserved §Y union seam, **deferred to Cluster
   2.** §29 builds no repositioning.
2. **Summon cap = per-caster `maxLive` — RESOLVED (user; single digits).** Summon
   stresses two ceilings: *board space* (already handled by D5.C's overflow — but
   summons place **caster-anchored**, see above, not via that team-region path) and
   *total unit count* (unbounded today — the overflow queue just appends, so an
   uncapped summon loop marches toward the `SpriteRenderer` 1024 cap [D1, throws]).
   The per-caster `maxLive` bounds the second directly (≤ N minions, re-summon as
   they die), keeping the live count tiny and — critically — **the object-pool TODO
   parked** (pooling is only forced if counts grow; the cap stops them growing).
   Uncapped was the only option that forces pooling, and swarm-scale summoning isn't
   in scope.
3. **Enemy/encounter AI — RESOLVED (user):** out of scope until camps motivate it
   (Cluster 5). §29 ships only the code-thin `priority`-based selection (the def's
   `target` reachability + the `priority` field + a code escape hatch); **no
   data-driven AI scoring this cluster.**

---

## Phase 30 — Dev tools + new content

> **✅ COMPLETE (30a–30d, pending the user's playtest).** §29 already shipped the
> content floor (the 9-archetype roster + the FontAtlas 8×4→8×6 resize), so §30
> was the **two editors** only — no new content/snapshot. **30a/30b** the
> attack-editor scaffold + the recursive effect-op tree (`tools/attack-editor/`,
> byte-faithful `formatAbilitiesJson`, `abilities.json`→`/__save-config`).
> **30c** (`be6311d`) the timeline editor + a live resolution-outline preview
> SHARING the real resolvers — `resolvePhases`/`resolveCadenceTicks` for the tick
> layout + the EXTRACTED pure `src/sim/effects/resolveScalars.ts` kernel (also
> consumed by `propose.ts`, one source of truth) for the damage/heal/crit/chain
> numbers — vs an editable sample caster with archetype-base-stat presets.
> **30d** (`3204d98`) the archetype-editor "create": + New/Delete (clone-seeded),
> the `draftable` toggle, PER-ENTRY `ArchetypeSchema` validation (the whole-config
> `z.object` would silently strip a new key), an op-scaling per-ability preview
> (correct for any archetype; retired `damageStatFor`/`OUTPUT_LABEL`), and the
> guided **Wire-up panel** — since archetypes are a CLOSED typed union, create/
> delete emit the exact 3 code edits the tool can't perform (the `Archetype`
> union / `ArchetypesSchema` / a `glyphs.ts` glyph + the n/48 atlas budget). Both
> editors no-snapshot-bump, dev-only. **§31 (effect scaling) ✅ COMPLETE &
> user-confirmed (31a–31d, WorldSnapshot v29→v30); NEXT = §32** (FX·SFX·viz/UI —
> opens with the 32a DESIGN ROUND). §33 (balance) follows.

The authoring + feel surface — the editors land *with* the content, not before
(the encounter round's V lesson). **Dev-only `tools/` UIs + config + content; no
snapshot bump.**

**Shape:**
- **The attack editor** (`tools/attack-editor/`, modeled on the encounter
  editor) — a **recursive form builder** over the `EffectOp` / `TargetSelector` /
  `AttackDef` vocabulary (sibling to the encounter editor's wave-grammar builder:
  same philosophy, same tooling). Live zod-validation against the real schema; a
  **resolution/timeline preview** (which op fires at which phase, against a sample
  target) — the "feel" surface that makes attacks tunable without a full battle.
  Save via `/__save-config` (`attacks.json` + `statuses.json` added to the
  allowlist).
- **The archetype-editor "create" expansion** — extend
  [tools/archetype-editor](tools/archetype-editor/) from *edit-only* to **create
  new archetypes** and **assign them attacks** (the join between "new archetypes"
  and "new attacks" — you need new units to carry the new mechanics). Plus the
  `← Tools` home link convention.
- **New content — the demo-consumer set.** Every new mechanic needs ≥ 1 content
  consumer so the editor proves out and §33's balance pass has something to tune.
  The migration + tile-unification already cover several, which keeps the roster
  small (exact archetype design is **deferred to spec time** — these are the slots,
  not the final stat blocks):

  | Mechanic | Demo consumer |
  |---|---|
  | `move` caster-reposition (§Y) · `aoe`+`affects` (§Y) | ✅ Dash/Gambit · MagicBolt — already covered |
  | burn · rejuvenate (§27) | ✅ fire/healing tile → status — already covered |
  | **bleed**, **poison** (§27 periodic) | a bleed-on-hit melee ("Reaver") + a poison-on-hit unit ("Plaguebearer") |
  | **frozen**, **blind**, **confusion**, **panic** (§28 behavior) | a freeze caster + 1–3 "disruptor" archetypes carrying the soft-control family |
  | **status-on-hit** (§29) | ✅ *the vehicle* — every afflicter above proves it, no extra unit |
  | **chain** (§29) | a chain-lightning caster ("Stormcaller") |
  | **summon** (§29) | a **Summoner** + its **summoned minion** |

  Notes: **spread demos across both teams** — player-draftable afflicters (bleed/
  poison = your tools) + enemy-pooled disruptors (freeze/confuse/panic = the threats
  you feel), so §33 balances each status as both wielded and suffered. A **confused
  AoE caster** friendly-fires (forced `affects:'all'`) — confusion × AoE demos itself,
  free. **Every new unit glyph hits the FULL FontAtlas (32/32)** → one **grid resize**
  accommodates the whole roster (the FontAtlas.test guard + the `glyphs.ts` append
  discipline, gotcha #33). Browser-verify each new glyph renders.

**Cost:** dev-only UIs + a one-line allowlist add each; content + the atlas resize.
The resolution preview **must share the pure interpreter module** (never re-
implement it in the tool — the encounter editor's preview-shares-`resolveWave`
lesson). Browser-verify the round-trip (edit → Save → reload → persisted) + every
new glyph.

**Headless tests:** the editor's format emitter is byte-faithful (a parse→emit
round-trip, like `formatEncountersJson`); the shared interpreter preview agrees
with the headless interpreter on fixtures; new archetypes spawn + resolve their
defs.

**Decision points 30:** the attack editor's preview sample (fixed default vs
in-tool roster/target knobs — recommend configurable, mirroring the encounter
editor). The **demo-consumer table above is the content floor** — design those
archetypes' actual stat blocks at spec time; whether to ship anything *beyond* the
floor (vs. leaving it to the anticipated content-authoring bottleneck) is the open
call, and how many "disruptor" archetypes carry the blind/confusion/panic trio
(1 dense vs 2–3 focused).

---

## Phase 31 — Effect scaling: stat/level-driven magnitude, duration & summon level

> **✅ COMPLETE (31a–31d SHIPPED & user-confirmed, 2026-06-26).** All four steps
> green + browser-verified; the summoner's level-scaling played especially well.
> Commits: 31a `5ec62ec` (the `ScaledValue` schema + the pure `evalScaled` kernel,
> taking a structural `ScalingSource` so the editor preview shares it) · 31b
> `e6e9edf` (status magnitude + duration on the `applyStatus` op, captured frozen;
> **WorldSnapshot v29→v30** reserving all 3 `OpResolution` slots; the chained
> applyStatus inherits the capture free; the status rider passes through
> `scaleChainResolution` unscaled) · 31c `eb2e73e` (summon minion level, int-rounded
> ≥1 at capture, reusing the v30 slot — no second bump) · 31d `c871f66` (the
> attack-editor `scaledValueField` toggle widget + the inline-resolved `= N vs
> sample` + the resolution-outline preview resolving scaled mag/dur/level via the
> real `evalScaled`, plus a `level` sample knob). Shipped content stays byte-
> identical (all bare numbers); the magnitudes are placeholders → §33. **⚠️ §33
> caveat:** scaling summon level off the caster's *overall level* may be OP — a
> one-line `perPoint`/`stat` dial-back if the balance pass shows it. **▶ NEXT = §32
> (opens with the 32a design round).** Below is the as-built design.

> **DESIGN LOCKED (2026-06-26 session).** The §30 playtest
> surfaced a hole in the spec: normal attacks scale with a stat (`damage`/`heal` =
> `might + scalingStat`, cast-time captured), but the **new** effects mostly don't.
> Audit of where scaling already reaches: **chain** ✅ already scales (its inner
> `damage` op runs the shared `resolveScalars` kernel); **statuses** ⚠️ have a
> dormant *live-source* seam (`periodicOpBase` reads `source.effectiveStats[scaling]`,
> but every status is authored `scaling:'none'`); **summon** ❌ uses a fixed `level`.
> Three player-facing asks fall out of that: scale **DoT magnitude** (burn/poison/
> bleed), scale **status duration** (panic/blind/confusion — and, per a playtester,
> the DoTs too), and scale **summon level** with the summoner. All three already
> have the *carrier field* + the *runtime plumbing*; what's missing is uniformly the
> **cast-time capture point** + a **scaling descriptor**. This phase fills both.

The schema hole, filled **systematically** — one descriptor, three consumers, the
same wiring three times. **`WorldSnapshot` bump** (the captured scalars ride the
in-flight `OpResolution`).

### The design (locked)

**Commensurate vs scaled.** `damage`/`heal` get `base + stat` (coefficient
implicitly 1) because base and stat are the *same unit* (HP points). The three new
axes are **not** commensurate — magnitude is a multiplier (~1–3), duration is
seconds (~2–6), summon level is an integer (~1–8) — so a raw stat add is nonsense
(+8 s of stun). They need the one thing damage/heal don't: **a coefficient**. The
general form, of which `might + scalingStat` is the `perPoint = 1` special case:

```
value = base + perPoint × stat(caster)        // captured at cast (frozen)
```

**The shared descriptor** (`src/sim/effects/` — the `resolveScalars` sibling):

```ts
// `level` is the meta-property (summon); the rest are combat stats off
// effectiveStats. No 'none' sentinel — absence of scaling = author a plain number.
const ScalingStatSchema = z.enum(['strength', 'ranged', 'magic', 'luck', 'level']);

const ScaledValueSchema = z.object({
  base: z.number(),            // the floor (required — see decision 4)
  stat: ScalingStatSchema,
  perPoint: z.number(),        // contribution per stat point
  max: z.number().optional(),  // optional ceiling (the stun-duration guard)
});

// Opt-in + non-breaking: every existing `magnitude: 2` / `level: 1` still parses.
const ScalarOrScaledSchema = z.union([z.number(), ScaledValueSchema]);
```

**The five locked decisions (2026-06-26):**
1. **Frozen, not live** — captured at cast off the caster's stats (a strong
   Corrupter's burn stays strong even if she dies). The periodic op's existing
   *live-source* `scaling` enum stays a separate, enemy-flavored tool.
2. **`max` clamp included** — duration scaling without a ceiling is a real footgun.
3. **Stat domain `{strength, ranged, magic, luck, level}`** — `speed` excluded
   (it already drives cadence/phase duration, a wholly separate axis we do **not**
   touch here); `none` subsumed by the bare-number arm.
4. **`base` required** on the scaled form — it's all editor-generated (§31d), so no
   excuse for a missing value; the bare-number arm still falls back to the def base.
5. **Summon scales the minion's `level`**, not its individual stats — routes through
   the deterministic `scaledUnit(level)`, reusing the level curve.

⚠️ **Balance caveat (→ §33):** scaling summon level off the caster's *overall level*
may be OP — dial `perPoint` back or switch the stat to `magic` if §33 shows it. The
descriptor makes either a one-line config change.

### 31a — The `ScaledValue` schema + the cast-time evaluator

**Shape:** the `ScalingStatSchema` / `ScaledValueSchema` / `ScalarOrScaledSchema`
unions above + the pure evaluator (the `resolveScalars` sibling, the one genuinely
new logic):

```ts
function evalScaled(v: number | ScaledValue | undefined, caster: Unit): number | undefined {
  if (v === undefined) return undefined;
  if (typeof v === 'number') return v;
  const stat = v.stat === 'level' ? caster.level : caster.effectiveStats[v.stat];
  const raw = v.base + v.perPoint * stat;
  return v.max !== undefined ? Math.min(raw, v.max) : raw;
}
```

**Cost:** types + the pure kernel only, no consumer, no snapshot touch. Headless.

**Headless tests:** the union parses a bare number AND a scaled object, rejects a
malformed descriptor; `evalScaled` computes `base + perPoint × stat`, honors `max`,
reads `level` off the unit and the rest off `effectiveStats`, passes a bare number
through untouched, returns `undefined` for `undefined`.

### 31b — Status magnitude + duration scaling (the `applyStatus` op)

**Shape:** flip the `applyStatus` op's `magnitude` + `durationSeconds` from
`z.number()` to `ScalarOrScaledSchema`; capture both at cast in `propose.ts`
`resolveOp` (today's `applyStatus` arm returns `{}`) into **three new optional
`OpResolution` slots reserved here** — `statusMagnitude`, `statusDurationSeconds`,
**and** `summonLevel` (so 31c reuses the shape, no second bump); consume them in
`executeApplyStatus` (read `ctx.resolution.statusMagnitude ?? 1` /
`statusDurationSeconds` instead of `op.magnitude` / `op.durationSeconds`). Magnitude
and duration stay **float** — the `× magnitude` round + `secondsToTicks` floor are
already downstream. Because `chain` recurses through `resolveOp`, a chained
`applyStatus` inherits this for free. **The `WorldSnapshot` bump lands here**
(v29→v30, reject pre-scaling in-flight saves).

Covers both playtest asks at once: magnitude is the burn/poison/bleed lever;
duration is status-type-agnostic, so the *same* field scales the control statuses
(frozen/panic/blind/confusion — which carry no periodic block) **and** the DoTs' own
lifetime, no extra work.

**Cost:** the schema flip + the capture/consume wiring + the bump. Headless for the
math/capture/round-trip; browser sanity-check a scaled burn/panic reads right.
**Playtest pause.**

**Headless tests:** a scaled `magnitude` produces `round(periodicBase × evalScaled)`
per tick; a scaled `durationSeconds` sets `expiresAtTick` off the captured value
(and clamps at `max`); a bare-number magnitude/duration is byte-identical to today;
the captured scalars round-trip through the v30 snapshot mid-windup; a chained
`applyStatus` carries its captured magnitude/duration per hop; a v29 in-flight save
is reject-stale.

**Decision points 31b — RESOLVED (2026-06-26):** frozen-capture (not live); `max`
clamp in; `base` required. The live-source periodic `scaling` enum is left intact as
the orthogonal enemy-flavored seam.

### 31c — Summon-level scaling (the `summon` op)

**Shape:** flip `SummonSpec.level` to `ScalarOrScaledSchema`; capture in
`resolveOp`'s `summon` arm (today `{}`) into the **already-reserved** `summonLevel`
slot — **int-rounded at capture** (`Math.max(1, Math.round(evalScaled(...)))`, since
`scaledUnit` needs an int level); consume in `executeSummon` (`spawnSummon(archetype,
ctx.resolution.summonLevel, …)` instead of `op.summon.level`). **No second bump** —
the slot was reserved in 31b's v30.

**Cost:** the schema flip + one capture/consume pair. Headless for the rounding +
the deterministic spawn; browser-verify a Shaman's ghouls scale with her level.
**Playtest pause** — and **watch the OP caveat** (the §33 dial).

**Headless tests:** a `{stat:'level', perPoint:1}` summon spawns minions at the
caster's level; rounding floors correctly and clamps ≥ 1; a bare-number `level` is
byte-identical to today; the spawn stays deterministic (geometry + `scaledUnit`).

### 31d — Editor support for `ScaledValue` (the authoring surface)

**Shape:** the attack editor (§30) authors all three fields, so its op forms grow a
**scalar-or-scaled widget** — a toggle between "plain number" and the `{base, stat,
perPoint, max?}` form — on the `applyStatus` magnitude/duration inputs and the
`summon` level input. Byte-faithful round-trip through `formatAbilitiesJson` (a bare
number emits as a number, a scaled value as the object — the parse→emit discipline
§30 already holds). The resolution-outline preview (§30c, sharing the real
resolvers) extends to show the *scaled* number against the sample caster — so a
designer sees "burn 6/tick at magic 8" live.

**Cost:** dev-only UI; the widget + the formatter arm + the preview extension.
Browser-verify the round-trip (author scaled → Save → reload → persisted) and the
live preview number. Authoring works for the bare-number case from 31b onward (the
union default), so this is the authoring *polish*, landing last.

**Decision points 31d:** does the preview show the scaled value inline next to the
op, or only in the resolution outline (recommend inline — it's the whole point of
the scaling form)? Confirm the widget defaults to "plain number" (the non-breaking
default) with an explicit opt-in to the scaled form.

---

## Phase 32 — FX · SFX · the status-visualization / UI design round

> **▶ ACTIVE. ✅ 32a DESIGN ROUND COMPLETE & user-locked (2026-06-26) — see the
> RESOLVED block below.** This is the original §31 SFX pass, **expanded**: the §30
> playtest hinted statuses want richer *visual* cues than the §27/§28 surface
> (tick-fx + the held `active` tint) provides — stacks, remaining duration,
> magnitude legibility, the now-*scaled* numbers from §31. The cue shape was open,
> so the phase opened with a design session; the locked vocabulary is **both
> (board-primary)** — a per-unit board **pip-strip** (graphical, covers everyone) +
> a **card status row** (numeric, where §31's scaled potency reads literally).
> **▶ NEXT = 32c** (the viz build — fully in-hand, headless-first + browser-verify)
> and **32b** (SFX — gated on the user supplying audio assets, the `chain.wav`
> precedent).

Polish that rides its feature. **Config / render / UI; no snapshot bump** (FX keys +
audio assets + UI are not serialized).

### 32a — DESIGN ROUND ✅ COMPLETE & user-locked (2026-06-26)

**The session.** A collaborative design round (no code) locked *how statuses read*
in battle. Grounding: today only the 4 **behavior** statuses get a held body-tint
(28c); the DoTs (burn/bleed/poison/rejuvenate) **vanish between ticks** — and
nothing anywhere shows **stack count**, **remaining duration**, or the **§31 scaled
potency**. All four legibility axes are already readable off `unit.effects[]` (key →
def; `magnitude` = stack count under `add` merge; `lifetime.expiresAtTick` =
remaining; `def.periodic.op.might × magnitude` = scaled per-tick), so 32a was purely
a *presentation* decision.

**LOCKED vocabulary — both surfaces, board-primary:**

1. **Board pip-strip (the held cue, covers EVERY unit).** A thin row of **instanced
   colored cells above each unit's HP bar**, one cell per active status — built on
   the existing `BarRenderer` instancing so it needs **no new FontAtlas glyphs** (the
   atlas is full). This IS the folded-in "held DoT cue": burn/bleed/poison no longer
   disappear between ticks, and because it's board-anchored it covers **summoned
   Ghouls + enemies** (no hand-card needed).
   - **Graphical encoding** (user pick): duration = depleting cell width; stacks =
     brightness (or stacked segments).
   - Shows **all** statuses for one unified readout; behavior statuses **keep their
     body-tint on top** (tint = "controlled" emphasis, pip = the inventory).
   - **Stable canonical ordering** (a status always occupies the same relative slot →
     recognizable); each status carries a **display color** (behavior statuses reuse
     their 28c tints; DoTs get distinct hues — burn ember-orange / bleed crimson /
     poison toxic-green / rejuvenate heal-green, **exact hues eyeball-tuned in 32c**).
2. **Card status row (the precise numbers).** On the in-battle compact UnitCards
   (Q's player-bottom / enemy-top): per status `icon · ×stacks · duration · potency`,
   **numeric** (user pick) — and this is where **§31's scaled potency reads as a
   literal** (`Burn 5/s` from `periodic.might × magnitude ÷ everySeconds`). The row
   renders **only when the unit has ≥1 status** (respects the "HUD getting crowded"
   TODO); duration ticks live on a throttled refresh.
3. **Scaled potency = a number on the card** (user pick) — not a board color-ramp,
   not stacks-as-proxy (which would hide the scaling on the non-stacking `refresh`
   statuses like burn).

**Parked-polish fold-in (→ 32d), user-chosen:** the **held DoT cue** (now core to
32c, above) + **sparkle height/spread tuning** (eyeball-tune during 32c). **Dropped:**
the settle-on-arrival apply cue and the `expired` cue stay parked in
[TODO.md](TODO.md).

**Output:** this locked spec scopes 32c (and confirms 32b/32d). **Cost:** none (design).

### 32b — SFX for the new mechanics

**Shape:** new sound keys in the §Z FX registry + `public/audio/` + AudioPlayer for
the §27/§28/§29 effects that shipped silent (SFX deferred to here by design): **burn
tick**, **freeze**, the **afflicter casts** (poison/confusion/blind/panic apply),
**summon pop**, + the long-deferred **catapult SFX** ([TODO.md](TODO.md)) folded in.
(Chain already has its `chain.wav` per-hop zap from §29c.) One `FxKey` = visual +
SFX (the §Z lock), so each rides the existing fx-resolution path.

**Cost:** light — registry keys + assets + the AudioPlayer wiring. Browser-verify
(audio) each cue fires on its phase/tick. Independent of 32a, so it can land first.

**Headless tests:** the boot assert (`assertFxKeysResolve` / `assertStatusFxKeysResolve`)
covers every new key; SFX *audibility* is eyeball/ear-verified (render+audio layer).

### 32c — The status-visualization / UI build (scope LOCKED by 32a)

> **▶ IN PROGRESS.** ✅ **The selector + board pip-strip + card status row SHIPPED**
> (pending the user's native-browser playtest):
> - **The selector** — [statusReadout.ts](src/sim/statusReadout.ts) `readUnitStatuses`
>   (9 headless tests — `op.might × magnitude` reads BOTH stacks and §31 scaling
>   through one formula).
> - **The board pip-strip** — [statusDisplay.ts](src/render/statusDisplay.ts) (the
>   render-side color map; behavior statuses reuse their 28c tints) + `updateStatuses`
>   on [UnitOverlayLayer.ts](src/render/UnitOverlayLayer.ts) (a DOM row above the HP
>   bar — no Three.js/atlas; width = duration, opacity = stacks), driven by a per-tick
>   gate in [BattleRenderer.ts](src/render/BattleRenderer.ts). Browser-verified: all 8
>   statuses distinct colors, stack-brightness ramp reads (poison ×1 = 0.7 vs bleed
>   ×3 = 1.0).
> - **The card status row** — `updateCardStatusRow` on [UnitCard.ts](src/ui/UnitCard.ts)
>   (a chip per status on the compact card: swatch + name + `×stacks · ±N/s · Ns`),
>   driven by [HUD.ts](src/ui/HUD.ts) `refreshStatuses` (BattleScene-called, per-tick
>   gated). Browser-verified: stacks (Bleed ×3 → 6/s), heal `+1/s`, behavior
>   duration-only, live countdown decrements (4.0→3.0s), swatches match the pips, no
>   console errors.
>
> **NEXT = the sparkle height/spread tune** (the last 32d fold-in — a small render-const
> tweak in [BattleRenderer.ts](src/render/BattleRenderer.ts); subjective, so eyeball with
> the user).

**Shape:** build the two surfaces 32a locked, both fed off `unit.effects[]` + the
`status:applied/ticked/expired` lifecycle:
- **The board pip-strip** — a new instanced cell-row above the HP bar (extend /
  mirror [BarRenderer](src/render/BarRenderer.ts)'s instancing; no new atlas glyph),
  one cell per active status in stable canonical order, status-colored, width =
  remaining duration, brightness/segments = stacks. Held (not transient) — it
  follows the unit. The 28c body-tint stays on top for behavior statuses.
- **The card status row** — render `icon · ×stacks · duration · potency` per status
  on the in-battle [UnitCard](src/ui/UnitCard.ts) compact variant, only when ≥1
  status is active; potency = `def.periodic.op.might × effect.magnitude ÷ everySeconds`
  (the §31 scaled number made literal); throttled live duration refresh.
- A render-side **status→display-color** map (behavior statuses reuse the 28c tint
  colors; the four DoT/HoT hues from 32a) + the **sparkle height/spread eyeball-tune**
  folded in here.

**Cost:** render + UI; the *data* (active statuses + remaining duration + stacks +
scaled potency off `effects[]`) is a pure, headless-testable selector — build it
first. Browser-verify each cue against a live battle (the "not testable without
seeing it" surface — §point 2).

**Headless tests:** the data feeding the cues is unit-testable (active statuses +
their remaining duration + stack count off a unit's `effects[]`); the *appearance*
is eyeball-verified.

### 32d — The deferred FX-feel tail (scoped by 32a)

**Shape:** 32a pulled **two** of the parked §27 feel items in (the rest stay parked):
**(1)** the held DoT cue — absorbed into 32c's board pip-strip (no longer a separate
item); **(2)** the **sparkle height/spread eyeball-tune** ([TODO.md](TODO.md), the
27e `SPARKLE_Y_OFFSET`/`SPARKLE_RISE` consts) — done alongside 32c. **DROPPED by the
design round:** the settle-on-arrival apply cue and the `expired` cue stay parked in
[TODO.md](TODO.md) (revisit later if wanted; the `applied`/`expired` fx slots remain
in the StatusDef schema + `driveStatusFx`).

**Cost:** small render polish, folded into 32c. Browser-verify.

---

## Phase 33 — The closing balance pass

The cluster's balance closer. **Scope: the new content + §31's scaling dials only**
— the migration (Y) is balance-neutral *by construction* (byte-identical), so this
is **not** a band re-derivation. **Config + tests via the BALANCE.md loop; no
snapshot bump. READ [BALANCE.md](BALANCE.md) FIRST.**

### 33a — Baseline + instrumentation

**Shape:** re-read [BALANCE.md](BALANCE.md); establish the current per-encounter
pool-damage baseline with all §29 content + §31 scaling live, via the harness the
encounter round already built (`--per-encounter`, `--encounter=<id>`,
`--seed-offset`). Confirm the new afflicter/summoner/chain archetypes are exercised.
Identify which dials are in play.

**Cost:** a measured baseline run, bounded (new content, not the whole catalog).
Mind the `dwm.exe` leak on heavy `--jobs` runs (reboot first; `--jobs=1` immune).

### 33b — Tune the new content into band

**Shape:** tune into the existing per-kind bands (normal ≈ 3 / elite ≈ 6 / boss ≈ 10
pool-damage/instance): DoT magnitudes/durations, **the §31 scaling coefficients
(`perPoint` / `max`)**, chain falloff, summon budgets (`maxLive` / `count` / the
level-scaling — **the OP caveat from §31c**), and the new archetypes' `might`/cadence.
All config (A4 — hoisted to `config/*.json`).

**Cost:** the measured sweep, driven by the per-encounter harness.

**Headless tests:** balance-proof tests for the new statuses/mechanics derive their
expectations from the config modules (never hardcode the authored numbers).

### 33c — Hold-out verification + the duopoly fold-in

**Shape:** verify the bands hold on **held-out seeds** (`--seed-offset`); decide the
long-open **mercenary+ranged duopoly** thread — fold it in only if the new
archetypes shift it materially (recommend: tune the *new* content into band first;
touch the duopoly only if measurably moved).

**Cost:** the out-of-sample verification run.

**Decision points 33:** how much archetype rebalancing to fold in vs. defer; uniform
DoT tuning vs. per-status curves (a playtest call); whether the summon-level scaling
needs the `perPoint`/`magic`-switch dial-back the §31c caveat flagged.

---

## Cleanup / chores (land any time; several pair with this round)

- **Object-pooling the sim's hot allocators** ([TODO.md](TODO.md)) — surfaces at
  §29 (summon raises the live unit count), but the **per-caster `maxLive` cap keeps
  it parked** (a bounded unit count needs no pool). Revisit only if swarm-scale
  summoning ever enters scope.
- **Dedicated catapult SFX** ([TODO.md](TODO.md)) — folded into §32's SFX pass (32b).
- **Archetype display-label + ability display-name/description pass**
  ([TODO.md](TODO.md)) — the attack editor surfaces attack + status names; a natural
  moment to fold in the display-metadata layer. Optional, cosmetic.
- **`RNG` stat-label vs `rng` reach ambiguity** ([TODO.md](TODO.md)) — cosmetic.
- **The FontAtlas grid resize** — forced at §30 (the atlas is full); the first new
  unit glyph since J3's `X` filled it.

## What we're explicitly NOT doing yet (Cluster 1 scope guard)

**Deferred to later clusters (per the meta-roadmap order):**
- **Consumable items that grant these effects** → Cluster 3 (Economy). C1 builds the
  effects; consumables *consume* them.
- **Neutral encampments using these attacks** → Cluster 5 (Map Content).
- **Terrain that interacts with effects** (destructible terrain chewed by AoE, ice/
  mud/deep-water) → Cluster 2 (Spatial & Movement). The `affects:'enemies'` filter +
  `unitsInCells` seam are planted now so AoE is terrain-correct the moment C2 lands.
- **Multi-tile units / footprints** → Cluster 2 (the seam is planted via
  `unitsInCells`; the fill waits for a concrete consumer).
- **Real encounter / enemy-objective AI** → **Cluster 5 (user-confirmed)** — out of
  scope until camps motivate it. C1 ships only the code-thin `priority`-based
  selection.

**Seamed this round but deliberately NOT built (the future-proofing pass):**
- **The reserved `instances` / `ignore` merge policies** — shipped in the StatusDef
  union, no consumer yet (independent stacked copies / no-op-if-present).
- **Future ops the closed vocab grows into** — cleanse, shield, resistances /
  immunities. Additive variants; they don't change the data model.
- **Knockback / pull** (target-moving `move` modes) — **reserved in the `move`
  union in §Y** (boot-rejected if authored), the implementation **deferred to
  Cluster 2's** hardened occupancy core (user-confirmed). C1's `move` ships only
  caster-reposition (dash + gambit).
- **Data-driven AI scoring** — `priority` + a code escape hatch only; per-attack
  heuristics are a future concern (the brief is firm).

## Open decisions to resolve when expanding / building (the cross-cutting set)

These are the calls worth locking *with the user* before or during the relevant
phase (each is also embedded as a per-phase "Decision points").

**Resolved with the user (2026-06-22):**
- **Y4 FX strangler ordering** = preserve-then-retire. ✅
- **`move`** = caster-reposition (dash + gambit) ships in §Y; **knockback/pull = a
  reserved §Y union seam, deferred to Cluster 2.** ✅
- **Enemy/encounter AI** = out of scope until Cluster 5 (camps). ✅
- **Summon** = caster-anchored placement (`at:TargetSelector` anchor, default
  `self`, nearest-free-cell, per-`SummonSpec` `radiusCells` default 2, fizzle if
  none); **per-caster `maxLive`** (single digits); object-pooling stays parked. ✅
- **Demo consumers** = the §30 floor (summoner + minion · chain caster · bleed/
  poison + behavior-trio afflicters); actual stat blocks designed at spec time. ✅

**Resolved with the user (2026-06-26 — the effect-scaling design session):**
- **The "SFX + balance" §31 splits into three** — §31 effect scaling · §32 FX·SFX·
  the viz/UI design round (SFX *expanded*) · §33 the balance closer. ✅
- **Effect scaling = one `ScaledValue` descriptor** (`base + perPoint × stat`,
  cast-time **frozen**), three consumers (DoT magnitude · status duration · summon
  level), opt-in via a `number | ScaledValue` union. **`max` clamp in; `base`
  required; stat domain `{strength, ranged, magic, luck, level}`** (speed excluded —
  it's the separate cadence axis); **summon scales `level`, not stats**;
  `WorldSnapshot` bump (v29→v30). ✅
- **§32 opens with a DESIGN ROUND (32a)** — the status-viz/UI cue shape is still
  open (the user: "no idea what the shape will be yet"). ✅

**Still open (resolve at the relevant phase):**
- **30:** how much exemplar content ships now vs the anticipated content bottleneck.
- **31:** the per-axis `perPoint`/`max` starting values (placeholders → tuned at §33).
- **32:** the status-viz/UI cue vocabulary (the 32a design round) — sprite- vs
  card-anchored cues, stack/duration indicators, scaled-magnitude legibility.
- **33:** archetype-rebalance fold-in scope; whether summon-level scaling needs the
  §31c OP dial-back (`perPoint` down or switch to `magic`).
