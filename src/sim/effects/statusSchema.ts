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
 *   - `fx?`             — opaque renderer keys (the §Z registry), inert in the
 *                         sim — resolved by the renderer over the `status:*`
 *                         lifecycle events (27e).
 *
 * SCOPE (27, periodic only). Two axes the overall cluster vocabulary lists are
 * deferred to their CONSUMING phase — config is never serialized, so adding
 * either later costs NO snapshot bump:
 *   - `statMods?` (the K1 stat-mod axis — a slow, a defense debuff) → arrives
 *     with its first consumer (§28 behavior-adjacent / §31 content). The runtime
 *     `StatusEffect.mods` already exists; this is only the authoring surface.
 *   - `behavior?` (frozen/blind/confusion/panic as decision-hooks) → §28. The
 *     consumers (selector/targeting/movement) resolve it from the def by the
 *     effect's `key`, so it adds no serialized state either.
 *
 * Authored in SECONDS (canonical, TICK_RATE-independent), converted at apply —
 * the existing convention. Config home: `config/statuses.json`
 * (`src/config/statuses.ts`), mirroring the `config/abilities.json` /
 * `AbilityDef` pair.
 */

import { z } from 'zod';
import { PeriodicOpSchema } from './schema';

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

export const StatusDefSchema = z.object({
  id: z.string().min(1),
  /** Player-facing display name (the status overlay / future tooltip). */
  name: z.string().min(1),
  /** Lifetime in seconds (→ a `ticks` lifetime at apply). */
  durationSeconds: z.number().positive(),
  merge: StatusMergeSchema,
  periodic: PeriodicSchema.optional(),
  fx: StatusFxSchema.optional(),
});

export type StatusMerge = z.infer<typeof StatusMergeSchema>;
export type StatusPeriodic = z.infer<typeof PeriodicSchema>;
export type StatusDef = z.infer<typeof StatusDefSchema>;

/** Parse one status definition, throwing on a malformed shape (the A4 pattern). */
export function parseStatusDef(raw: unknown): StatusDef {
  return StatusDefSchema.parse(raw);
}
