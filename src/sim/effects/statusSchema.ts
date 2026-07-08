/**
 * Phase 27 — the `StatusDef` vocabulary (the PERIODIC axis of the Cluster-1
 * status system).
 *
 * A `StatusDef` is the CONFIG-authored definition of a named status (burn,
 * bleed, poison, rejuvenate, …). Applying one builds a runtime `StatusEffect`
 * (K1, `statusEffects.ts`) on a unit's `effects[]` — the def is the template,
 * the effect is the live instance. It extends the K1 stat-mod model along the
 * PERIODIC axis: a DoT/HoT that fires an `op` every `everySeconds`.
 *
 * Decomposition (mirrors the `AbilityDef` axes — see `schema.ts`):
 *   - `durationSeconds` — the lifetime (a `ticks` lifetime at apply, 27b).
 *   - `merge`           — how a re-application combines (the brief's vocabulary,
 *                         mapped onto K1's `MergePolicy` at apply time, 27b).
 *   - `periodic?`       — the DoT/HoT: `op` (damage|heal) × the effect's
 *                         magnitude, every `everySeconds`. The §27 headline.
 *   - `behavior?`       — the §28 BEHAVIOR axis: AI decision-overrides
 *                         (frozen/blind/panic/confusion) the existing consumers
 *                         READ. Def-resolved by `key` (see `statusBehavior.ts`),
 *                         so it adds no serialized state (no snapshot bump).
 *   - `fx?`             — opaque renderer keys (the §Z registry), inert in the
 *                         sim — resolved by the renderer over the `status:*`
 *                         lifecycle events (27e) + the held `active` overlay (28).
 *
 * SCOPE (27 periodic + 28 behavior + 47f statMods). The `statMods?` axis —
 * deferred at 27 "until its first consumer" — landed at 47f with exactly
 * that consumer: the Fortuna daemon's crit-buff status (`emboldened`,
 * +1 STR/RNG/MAG for 5s). Config-only as predicted (no snapshot bump —
 * defs are never serialized; the runtime `StatusEffect.mods` existed since
 * K1, this is just the authoring surface). Mods are expressed PER ONE UNIT
 * of magnitude (the K1 contract — `foldEffects` scales them).
 *
 * Authored in SECONDS (canonical, TICK_RATE-independent), converted at apply —
 * the existing convention. Config home: `config/statuses.json`
 * (`src/config/statuses.ts`), mirroring the `config/abilities.json` /
 * `AbilityDef` pair.
 */

import { z } from 'zod';
import { PeriodicOpSchema } from './schema';
import type { StatKey } from '../statusEffects';

/**
 * How a re-applied status (same id) combines with the live instance. The
 * brief's vocabulary; mapped onto K1's `MergePolicy` (`statusEffects.ts`) when
 * the effect is built (27b):
 *   - `refresh`   → `replace`     — reset the duration, magnitude = the base
 *                                   (burn lingers at full while standing in it).
 *   - `add`       → `add`         — stack magnitude (escalating bleed/poison).
 *   - `instances` → `independent` — keep separate copies. RESERVED (no §27
 *                                   consumer); ships in the union for §29+.
 *   - `ignore`    → no-op-if-present. RESERVED (no §27 consumer); the union is
 *                                   closed + future-complete.
 */
export const StatusMergeSchema = z.enum(['refresh', 'add', 'instances', 'ignore']);

/**
 * The DoT/HoT tick: fire `op` (a `damage` DoT or `heal` HoT) every
 * `everySeconds`, its output scaled by the effect's magnitude (27b). The first
 * tick lands one interval AFTER apply (the applying hit doesn't double-dip).
 */
const PeriodicSchema = z.object({
  everySeconds: z.number().positive(),
  op: PeriodicOpSchema,
});

/**
 * §28 — the BEHAVIOR axis: the AI decision-overrides a held status imposes on
 * its host. The status system holds NO logic — these are flags the existing
 * consumers READ at their own decision points (the brief's "decision-hooks, not
 * reach-in"): the action-selector, `MovementBehavior`, `Targeting`. Like
 * `periodic`, the block lives on the DEF and is resolved by the effect's `key`
 * (`statusBehavior.ts` `behaviorFlags`), so it adds no serialized state.
 *
 * The four §28 statuses and the flags each authors:
 *   - frozen    `{preventsAttack, preventsMove}`         — skips its turn entirely
 *   - panic     `{preventsAttack, movement:'flee'}`      — can't attack, flees
 *   - blind     `{movement:'wander', acquisitionRange:1}`— wanders, hits only adjacent
 *   - confusion `{targeting:'random', affects:'all'}`    — random-team, friendly-fire
 *
 * All fields optional (`.partial()`) — a status authors only the flags it needs.
 */
const BehaviorSchema = z
  .object({
    /** The action-selector skips this unit's ATTACK proposals (frozen, panic). */
    preventsAttack: z.boolean(),
    /** `MovementBehavior` proposes no step at all (frozen). Trumps `movement`. */
    preventsMove: z.boolean(),
    /** Overrides the movement GOAL — `flee` the nearest enemy / `wander` to a
     *  random free neighbor. Ignored under `preventsMove`. */
    movement: z.enum(['flee', 'wander']),
    /** Forces target SELECTION to a random unit across ALL teams within
     *  acquisition range — the confusion override (`Targeting` reads it). */
    targeting: z.literal('random'),
    /** Caps the target-ACQUISITION reach in cells (Chebyshev) — blind only
     *  acquires an adjacent enemy (`1`). Unset = the unit's normal acquisition. */
    acquisitionRange: z.number().int().nonnegative(),
    /** Forces this unit's attacks to a friendly-fire `affects` override
     *  (confusion → `all`), regardless of the ability def's authored `affects`. */
    affects: z.literal('all'),
  })
  .partial();

/**
 * Opaque renderer keys per status-lifecycle moment (§Z registry; resolved by
 * the renderer over `status:applied` / `status:ticked` / `status:expired`, with
 * `active` the persistent overlay/tint while the status is held). Inert in the
 * sim — the sim passes them through and never interprets them (27e wires the
 * renderer). All optional — a status may light up some moments and not others.
 */
const StatusFxSchema = z
  .object({
    applied: z.string(),
    ticked: z.string(),
    expired: z.string(),
    active: z.string(),
  })
  .partial();

/** The 11-stat vocabulary as zod keys (the `config/empower.ts` BuffSchema
 *  shape; `satisfies` pins it to `UnitStats` so a stat rename breaks the
 *  build here rather than silently orphaning a config key). */
const STAT_KEYS = [
  'constitution',
  'strength',
  'ranged',
  'magic',
  'luck',
  'defense',
  'precision',
  'evasion',
  'speed',
  'mobility',
  'power',
] as const satisfies readonly StatKey[];

const StatModSchema = z.object({
  add: z.number().optional(),
  mul: z.number().optional(),
});

export const StatusDefSchema = z.object({
  id: z.string().min(1),
  /** Player-facing display name (the status overlay / future tooltip). */
  name: z.string().min(1),
  /** Lifetime in seconds (→ a `ticks` lifetime at apply). */
  durationSeconds: z.number().positive(),
  merge: StatusMergeSchema,
  periodic: PeriodicSchema.optional(),
  behavior: BehaviorSchema.optional(),
  fx: StatusFxSchema.optional(),
  /** 47f — the stat-mod axis: per-stat `add`/`mul`, per one unit of
   *  magnitude (the K1 `StatusEffect.mods` contract). Any subset of the
   *  11-stat vocabulary; absent = a pure periodic/behavior status. */
  statMods: z.partialRecord(z.enum(STAT_KEYS), StatModSchema).optional(),
});

export type StatusMerge = z.infer<typeof StatusMergeSchema>;
export type StatusPeriodic = z.infer<typeof PeriodicSchema>;
export type StatusBehavior = z.infer<typeof BehaviorSchema>;
export type StatusDef = z.infer<typeof StatusDefSchema>;

/** Parse one status definition, throwing on a malformed shape (the A4 pattern). */
export function parseStatusDef(raw: unknown): StatusDef {
  return StatusDefSchema.parse(raw);
}
