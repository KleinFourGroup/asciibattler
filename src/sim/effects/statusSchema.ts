/**
 * The `StatusDef` vocabulary: the config-authored definition of a named status
 * (burn, bleed, poison, rejuvenate…), in `config/statuses.json`
 * (`src/config/statuses.ts`), as `config/abilities.json` holds the
 * `AbilityDef`s. Applying a def builds a runtime `StatusEffect`
 * (`statusEffects.ts`, by `statusRuntime.ts`) on a unit's `effects`: the def is
 * the template, the effect the live instance. Defs are never serialized, so a
 * new field here is a config change with no snapshot bump.
 *
 * A def's axes:
 *
 * - `durationSeconds` — the lifetime, converted to ticks at apply.
 * - `merge` — how a re-application combines.
 * - `periodic` — a DoT or HoT: an `op` scaled by the effect's magnitude, every
 *   `everySeconds`.
 * - `behavior` — decision overrides that the AI's own decision points read.
 * - `statMods` — stat changes per unit of magnitude, which `foldEffects`
 *   scales.
 * - `fx` — renderer keys, which the sim passes through and never reads.
 *
 * `periodic` and `behavior` are read off the def by the effect's `key` when
 * they are needed, so they add no state to the effect. Durations are authored
 * in seconds and converted at apply.
 */

import { z } from 'zod';
import { prose } from '../../i18n/prose';
import { PeriodicOpSchema } from './schema';
import type { StatKey } from '../statusEffects';

/**
 * How a re-applied status (the same id) combines with the live instance; mapped
 * onto `MergePolicy` when the effect is built (`statusRuntime.ts`):
 *
 * - `refresh` — the duration resets and the magnitude returns to the base (a
 *   burn stays at full while the unit stands in fire).
 * - `add` — the magnitude stacks (an escalating bleed or poison).
 * - `instances` — separate copies are kept.
 * - `ignore` — a re-application does nothing while one is held.
 *
 * No shipped status uses `instances` or `ignore`.
 */
export const StatusMergeSchema = z.enum(['refresh', 'add', 'instances', 'ignore']);

/**
 * A DoT or HoT's tick: `op` (a `damage` or a `heal`) every `everySeconds`, its
 * output scaled by the effect's magnitude. When the first tick lands is
 * `buildStatusEffect`'s.
 */
const PeriodicSchema = z.object({
  everySeconds: z.number().positive(),
  op: PeriodicOpSchema,
});

/**
 * The decision overrides a held status imposes on its host. The status holds
 * no logic: these are flags that the decision points read where they decide
 * (`behaviorFlags` in `statusBehavior.ts`). Every field is optional, so a
 * status authors only the flags it needs.
 */
const BehaviorSchema = z
  .object({
    /** The unit proposes no ability at all, heals included (`AbilityBehavior`). */
    preventsAttack: z.boolean(),
    /** The unit proposes no step at all (`MovementBehavior`, `CampWanderBehavior`).
     *  Overrides `movement`. */
    preventsMove: z.boolean(),
    /** Replaces the movement goal: `flee` the nearest enemy, or `wander` to a
     *  random free neighbour. Ignored under `preventsMove`. */
    movement: z.enum(['flee', 'wander']),
    /** Target selection picks a random unit of any team within
     *  `acquisitionRange` (`Targeting`). */
    targeting: z.literal('random'),
    /** Caps the reach of target acquisition, in cells (Chebyshev), and is the
     *  radius of a `random` pick. Unset, the unit acquires as it normally does. */
    acquisitionRange: z.number().int().nonnegative(),
    /** The unit's area attacks hit every team, whatever the ability def's own
     *  `affects` says (`interpreter.ts`). */
    affects: z.literal('all'),
  })
  .partial();

/**
 * Renderer keys for the moments of a status's life, resolved through the FX
 * registry on `status:applied`, `status:ticked` and `status:expired`, with
 * `active` the overlay held while the status is. The sim passes them through
 * and never reads them. Every key is optional.
 */
const StatusFxSchema = z
  .object({
    applied: z.string(),
    ticked: z.string(),
    expired: z.string(),
    active: z.string(),
  })
  .partial();

/** The stat names as zod keys, as `config/empower.ts`'s `BuffSchema` has them.
 *  `satisfies` pins them to `StatKey`, so a renamed stat breaks the build here
 *  instead of orphaning a config key. */
const STAT_KEYS = [
  'constitution',
  'strength',
  'ranged',
  'magic',
  'luck',
  'defense',
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
  /** The player-facing name (`statusReadout.ts`), a locale address
   *  (`statuses.<id>.name`). */
  name: prose(),
  /** The lifetime in seconds, a `ticks` lifetime once applied. */
  durationSeconds: z.number().positive(),
  merge: StatusMergeSchema,
  periodic: PeriodicSchema.optional(),
  behavior: BehaviorSchema.optional(),
  fx: StatusFxSchema.optional(),
  /** Per-stat `add` and `mul`, per unit of magnitude (`StatusEffect.mods`).
   *  Any subset of the stats; absent on a status that only ticks or only
   *  overrides behaviour. */
  statMods: z.partialRecord(z.enum(STAT_KEYS), StatModSchema).optional(),
});

export type StatusMerge = z.infer<typeof StatusMergeSchema>;
export type StatusDef = z.infer<typeof StatusDefSchema>;

/** One status definition, parsed; throws on a malformed shape. */
export function parseStatusDef(raw: unknown): StatusDef {
  return StatusDefSchema.parse(raw);
}
