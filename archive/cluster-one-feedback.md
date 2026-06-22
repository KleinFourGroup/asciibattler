# Combat Depth — the data-driven attack & effect model

*Design model for Cluster 1 of the post-X meta-roadmap.*

## Core decomposition

Every attack is three orthogonal axes:

- **Targeting** — *who/what* it resolves to (the current enemy, an AoE over cells, the lowest-HP ally, self).
- **Timeline** — *when* things happen: the existing F2 phase schedule (`windup → release → travel → impact → recovery`) + the per-action `OrphanPolicy`.
- **Effect-ops** — *what happens* to the resolved targets: an ordered list of small typed operations slotted onto phases.

New mechanics are new *ops in the list*, never new action classes. Statuses are the same effect-ops, applied over time (periodic) or as behavior overrides.

Durations, cooldowns, and phase timings are authored **in seconds** (canonical, `TICK_RATE`-independent) and converted via `secondsToTicks` at load — the same convention as every existing timer. The sim *executes* in ticks; the *definitions* are in seconds.

## Type shapes

```ts
type Phase = 'windup'|'release'|'travel'|'impact'|'recovery';

// 'enemies' = any unit NOT on the caster's team (enemy + neutral — so AoE will chew
//             destructible terrain once Cluster 2 lands). 'allies' = caster's team. 'all' = both.
type Affects = 'enemies'|'allies'|'all';

type EffectOp =
  | { kind:'damage'; scaling:'strength'|'ranged'|'magic'|'none'; might:number;
      critable:boolean; evadable:boolean; bypassDefense:boolean }
  | { kind:'heal';   scaling:'magic'|'none'; amount:number }
  | { kind:'applyStatus'; statusId:string; magnitude?:number; durationSeconds?:number }
  | { kind:'summon'; summon:SummonSpec; at:TargetSelector }
  | { kind:'chain';  maxJumps:number; rangeCells:number; falloff:number; ops:EffectOp[] }  // recursive
  | { kind:'move';   mode:'knockback'|'pull'|'teleport'; cells:number };

type TargetSelector =
  | { kind:'self' }
  | { kind:'enemyInRange' }                                              // affects: enemies (implicit)
  | { kind:'aoe'; shape:'square'|'line'|'cross'; radius:number;
      anchor:'caster'|'targetCell'; affects:Affects }                    // friendly-fire knob
  | { kind:'lowestHpAlly'; rangeCells:number };                          // affects: allies (implicit)

interface AttackDef {
  id:string; cooldownSeconds:number; rangeCells:number; minRangeCells?:number;
  target:TargetSelector; timeline:Record<Phase,number>; orphanPolicy:OrphanPolicy;
  priority:number;                                  // AI scoring seam (see "AI selection")
  effects:{ phase:Phase; op:EffectOp }[];
  fx?:Partial<Record<Phase,FxKey>>;                 // opaque renderer keys — authored on the def
}

interface StatusDef {
  id:string; durationSeconds:number;
  merge:'refresh'|'add'|'instances'|'ignore';
  sourceUnitId?:number;                             // runtime: set on apply, for XP / kill credit
  statMods?:StatMod[];
  periodic?:{ everySeconds:number; op:EffectOp };    // op output × magnitude
  behavior?:{
    preventsAttack?:boolean;                        // panic, frozen
    preventsMove?:boolean;                          // frozen
    movement?:'flee'|'wander';                      // panic | blind
    targeting?:'random';                            // confusion (random among all other units)
    affects?:Affects;                               // confusion → 'all' (overrides the attack def)
    acquisitionRange?:number;                       // blind → 1
  };
  fx?:{ apply?:FxKey; tick?:FxKey; expire?:FxKey; active?:FxKey };  // active = persistent overlay/tint
}
```

**Merge legend** — `refresh`: reset duration, magnitude unchanged · `add`: sum magnitude into one instance + refresh duration · `instances`: independent stacked copies (reserved) · `ignore`: no-op if already present (reserved).

## Status effects

| Status | Mechanism | `StatusDef` | Merge | Duration | Notes |
|---|---|---|---|---|---|
| **burn** | periodic dmg | `periodic:{everySeconds, op:damage(evadable:false, bypassDefense:true)}` | `refresh` | **4 s** | applied/refreshed by the fire tile; lingers off-tile |
| **rejuvenate** | periodic heal | `periodic:{everySeconds, op:heal}` | `refresh` | **1 s** | applied/refreshed by the healing tile; lingers off-tile |
| **bleed** | periodic dmg | as burn | `add` | (content) | magnitude sums on reapply |
| **poison** | periodic dmg | as burn | `add` | (content) | magnitude sums on reapply |
| **blind** | behavior | `{ movement:'wander', acquisitionRange:1 }` | `refresh` | (content) | wanders; only strikes a unit it's adjacent to; enemy-only filter kept → friend/foe preserved |
| **confusion** | behavior | `{ targeting:'random', affects:'all' }` | `refresh` | (content) | targets at random (any team) and hits all — the indiscriminate status |
| **panic** | behavior | `{ preventsAttack:true, movement:'flee' }` | `refresh` | (content) | flees and cannot attack (can still move) |
| **frozen** | behavior | `{ preventsAttack:true, preventsMove:true }` | `refresh` | (content) | cannot act at all |

All DoTs ship `bypassDefense:true` + `evadable:false` for now (revisit after playtest). Periodic effects fire their first tick **one interval after apply** (the applying hit doesn't double-dip). For `add` DoTs, the status `magnitude` multiplies the periodic op's output.

## Attack mechanics

| Mechanic | Ops used | Representation | Migrates |
|---|---|---|---|
| basic strike | `damage` | `effects:[{impact, damage(bypassDefense:false)}]` | MeleeStrike / RangedShot |
| mage blast | `aoe`+`damage` | `target:aoe(square,1,targetCell,affects:'enemies')` · `damage@impact(evadable:false)` | MagicBolt |
| catapult lob | timeline + `aoe`+`damage` | `travel` phase · `aoe damage@impact` · `orphan:ground-target` | CatapultShot |
| heal | `lowestHpAlly`+`heal` | `target:lowestHpAlly` · `heal@impact` | HealAlly |
| rogue gambit | `damage`+`move` | `damage@impact` · `move@recovery` | GambitStrike (proves multi-phase op slotting) |
| **chain** | `chain` | `effects:[{impact, chain{maxJumps,range,falloff, ops:[damage,…]}}]` | new |
| **status-on-hit** | `damage`+`applyStatus` | both `@impact` | new (pure composition) |
| **summon** | `summon` | `effects:[{impact, summon{spec, at}}]` | new — joins caster's team, stats roll off the **battle RNG** |
| knockback | `move` | `move{mode:'knockback', cells}` | general reposition primitive |

## Tile unification

The D7.B per-tick tile pass is **retired**. Fire tiles apply/refresh **burn**; healing tiles apply/refresh **rejuvenate** (both `refresh`, so standing reapplies and the effect lingers after stepping off — burn 4 s, rejuvenate 1 s). All damage — strikes, DoTs, ex-tile — now flows through the single `applyDamage` chokepoint with `{evadable, bypassDefense}` flags; the old tile-damage bypass special-case is deleted.

## Targeting & friendly fire

The `affects` filter on an `aoe` selector decides which teams an area op touches, relative to the caster:

- **Offensive AoE** — `'enemies'` (every unit not on the caster's team → no friendly fire; the default, matching today's mage blast) or `'all'` (everyone in the area).
- **Support AoE** (a future group heal/buff) — `'allies'`.
- **Confusion override** — a confused unit's attacks are forced to `affects:'all'` regardless of the def, and it picks targets at random across all teams.

Single-target selectors carry their team implicitly (`enemyInRange` → enemies, `lowestHpAlly` → allies). Because `'enemies'` means *not the caster's team*, AoE becomes destructible-terrain-correct for free when neutral entities gain HP in Cluster 2.

## Renderer communication

The sim never holds animation or sound data. Defs carry **opaque `FxKey` strings**; the sim passes them through inertly in events and never interprets them. The renderer owns an **FX registry** mapping `FxKey → {animation channels, VFX, SFX}`, built on existing channels (SpriteAnimator shove/arc/fade, the `bloomIntensity` flash channel, transient projectile sprites, hitsplats, `AudioPlayer`).

Scheduling rides the existing `action:phase` boundaries (projectile on `release`, hitsplat + camera-shake on `impact`) plus a new status lifecycle: **`status:applied` / `status:ticked` / `status:expired` `{ unitId, statusId }`**.

Consequences:
- In-battle status display **is** the `status:applied`/`expired` subscription (a feature, not separate polish).
- Camera shake is an fx key on heavy impacts.
- Pause / fast-forward already scale FX — they ride presentation-time (renderer-owned `dt`, which `BattleScene` already scales).

A **boot assert** verifies every `FxKey` / `statusId` referenced in config resolves in the renderer registry (mirrors the ability-registry id check), so a typo'd key fails at startup, not silently.

## Wiring — archetypes reference attacks

Archetypes (and unit templates) carry a list of `AttackDef` **ids**; the registry resolves them, same pattern as today's ability ids. The expanded **archetype editor** is where new archetypes assign their attacks (the join between "create new archetypes" and "create new attacks"). The **attack editor** authors `AttackDef`s — a recursive form builder, sibling to the encounter editor's wave-grammar builder (same philosophy, same tooling).

## AI selection

Keep *what an attack does* as data and *when the AI picks it* as code-thin: a simple default driven by the def's `target` (is a valid target reachable/in range?) + the `priority` field, with a code escape hatch for special-cased scoring. Per-attack heuristics are a roadmap concern; do **not** try to data-drive the AI scoring in this cluster.

## Status source attribution

A status carries `sourceUnitId`, set when applied, so periodic-damage kills credit the right unit's XP / kill ledger (the E4/F6 `damageDealt` path). The source is optional on the *event* (a tile-applied burn has a source unit, but generic environmental effects may not — mirrors `unit:healed`'s `healerId | null`).

## Architectural decisions

1. **Data + interpreter, never deserialized closures.** Ops are plain JSON; one interpreter (`switch` over `kind`, à la the Action/Behavior registries) executes them. In-flight multi-phase actions and periodic statuses serialize as data (`A2 toData/fromData`) and rehydrate through the interpreter — the snapshot / determinism contract holds.
2. **Strangler migration, proven byte-identical.** Build the generic `EffectAction` + interpreter, express MeleeStrike as data, let the determinism test be the equivalence oracle, then migrate the remaining attacks one at a time.
3. **Closed, small, typed vocabulary** — every op / selector / override is a zod-validated discriminated-union variant. New mechanics are new reviewed variants, not a scripting language. The editor renders each as a form.
4. **Effects slot onto phases; `OrphanPolicy` is per-target.** AoE hits whoever's still standing at impact; single-target keeps re-home / fizzle.
5. **Decision-hooks, not reach-in.** Statuses carry flags/params; the existing action selector / targeting / movement consumers read them. The status system contains no AI logic.

## Cross-cluster seam (plant now)

AoE resolves cells → units through a single `unitsInCells(cells)` helper. Cluster 2's footprint seam slots in there, so AoE is multi-tile-correct the moment footprints exist — no retrofit.

## Content dials (locked)

- burn: `refresh`, lingers 4 s, bypass defense.
- rejuvenate: `refresh`, lingers 1 s.
- bleed: `add` magnitude · poison: `add` magnitude.
- blind: wander + adjacency-only acquisition, friend/foe preserved.
- confusion: full-random targeting + `affects:'all'`.
- panic: flee + can't attack (can move).
- frozen: can't act at all.
- periodic first tick: one interval after apply.
- all DoTs bypass defense for now.
- fx keys live on the definition.

## Open at roadmap level (not spec)

Exact snapshot version bumps; per-attack AI scoring heuristics; summon caps / unit-count budget (the object-pooling TODO gets more relevant here); friendly-fire defaults per content; future ops the closed vocab grows into without restructuring (cleanse, shield, resistances / immunities). None of these change the data model — they're values or additive variants.