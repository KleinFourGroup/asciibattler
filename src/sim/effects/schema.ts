/**
 * The ability vocabulary: data and validation, no behaviour. Every ability
 * decomposes into three axes:
 *
 * 1. Targeting: the `TargetSelector`, who or what it resolves to.
 * 2. Timeline: the phases (wind-up, release, travel, impact, recovery) and
 *    the `OrphanPolicy`, authored in seconds and converted to ticks when it
 *    resolves (`timeline.ts`).
 * 3. Effect ops: the `EffectOp`s, an ordered list of small typed operations
 *    placed on phases (`effects: [{ phase, op }]`).
 *
 * A new mechanic is a new op in the closed, zod-validated union, never a new
 * `Action` class or a scripting language; the interpreter (`interpreter.ts`) is
 * one `switch` over `op.kind`. The catalog is `config/abilities.json`
 * (`src/config/abilities.ts`).
 */

import { z } from 'zod';
import { prose } from '../../i18n/prose';
import type { ActionPhaseName, OrphanPolicy } from '../Action';

/* -------------------------------------------------------------------------- */
/* Phase and orphan enums, mirrored from Action.ts.                           */
/* -------------------------------------------------------------------------- */

// `satisfies` keeps these in step with Action.ts's unions: a stray literal here
// does not compile. The other direction, a phase added to Action.ts and not
// here, shows when a def names it and the enum refuses it.
const PHASE_NAMES = [
  'windup',
  'release',
  'travel',
  'impact',
  'recovery',
] as const satisfies readonly ActionPhaseName[];
const ORPHAN_POLICIES = [
  'commit-at-cast',
  'fizzle',
  'ground-target',
] as const satisfies readonly OrphanPolicy[];

const PhaseSchema = z.enum(PHASE_NAMES);
const OrphanPolicySchema = z.enum(ORPHAN_POLICIES);

/* -------------------------------------------------------------------------- */
/* Effect ops: what an ability does to the targets it resolved.               */
/* -------------------------------------------------------------------------- */

/**
 * The caster stat added to an op's flat `might` for its base output; `none`
 * adds nothing (the status DoTs and HoTs, and the abilities that deal flat
 * damage).
 */
const DamageScalingSchema = z.enum(['strength', 'ranged', 'magic', 'none']);
const HealScalingSchema = z.enum(['magic', 'none']);

/* -------------------------------------------------------------------------- */
/* Scaled values: magnitudes driven by a stat or the level, with a            */
/* coefficient.                                                               */
/* -------------------------------------------------------------------------- */

/**
 * What a `ScaledValue` scales off. The combat stats are read off
 * `effectiveStats`; `level` is the unit's combatant level, which a summon scales
 * its minions by. `speed` is left out because it already drives the cadence
 * and the phases, so a magnitude scaled off it would count speed twice. There
 * is no `none`: a value that does not scale is a bare number.
 */
export const ScalingStatSchema = z.enum(['strength', 'ranged', 'magic', 'luck', 'level']);

/**
 * A value that grows with a caster stat, `base + perPoint × stat`, evaluated by
 * `evalScaled` (`resolveScalars.ts`) when the ability proposes and frozen to
 * impact, as a damage op's `might + stat` is. A status's magnitude and
 * duration and a summon's level sit on scales a stat does not match, which
 * is why it carries a coefficient. `max` caps the result, so a long duration
 * cannot grow without bound; `base` is required.
 */
const ScaledValueSchema = z.object({
  base: z.number(),
  stat: ScalingStatSchema,
  perPoint: z.number(),
  max: z.number().optional(),
});

/**
 * A magnitude, duration or level: a bare number, read off the def as it is, or
 * a `ScaledValue`, captured at cast.
 */
export const ScalarOrScaledSchema = z.union([z.number(), ScaledValueSchema]);

/**
 * `damage`, through `World.applyDamage`. The interpreter applies the crit
 * factor, rolling the crit on `combatRng`, and hands the to-hit roll to
 * `applyDamage` when the op is `evadable`. `accuracy` is read only when
 * `evadable`, `critBase` only when `critable`. `bypassDefense` skips the
 * defense mitigation, as the status DoTs do; every ability's damage takes it.
 */
const DamageOpSchema = z.object({
  kind: z.literal('damage'),
  scaling: DamageScalingSchema,
  might: z.number().nonnegative(),
  accuracy: z.number().min(0).max(1),
  critBase: z.number().min(0).max(1),
  critable: z.boolean(),
  evadable: z.boolean(),
  bypassDefense: z.boolean(),
});

/**
 * `heal` adds HP to the resolved ally, clamped at max HP: the flat `might` and
 * the `scaling` stat (`magic` or `none`). It never rolls to hit or to crit.
 */
const HealOpSchema = z.object({
  kind: z.literal('heal'),
  scaling: HealScalingSchema,
  might: z.number().nonnegative(),
});

/**
 * `move` repositions the caster:
 *
 * - `advance` — a leap to the landing captured at cast (the dash); how far is
 *   the ability's `rangeCells`.
 * - `retreat` — one step away from the struck cell (the gambit's dart-back).
 */
const MoveOpSchema = z.object({
  kind: z.literal('move'),
  mode: z.enum(['advance', 'retreat']),
});

/**
 * `applyStatus` puts a status from the catalog on the resolved targets.
 * `statusId` is checked against the catalog at boot (`assertStatusRefsResolve`,
 * run by the ability registry).
 */
const ApplyStatusOpSchema = z.object({
  kind: z.literal('applyStatus'),
  statusId: z.string().min(1),
  // Either may scale (`propose.ts` captures it). `durationSeconds` has no
  // positive floor: a scaled value depends on the caster's stats and cannot be
  // checked at parse, so a degenerate one is the author's to avoid.
  magnitude: ScalarOrScaledSchema.optional(),
  durationSeconds: ScalarOrScaledSchema.optional(),
});

/**
 * The ops a `chain` may apply at each hop: `damage`, and `applyStatus` as a
 * rider. A `move` or a `heal` fired at an enemy hop means nothing, and a nested
 * `chain` would need a recursive schema and a meaning for falloff and geometry
 * that nothing wants. So the payload is its own narrow union, as
 * `PeriodicOpSchema` is for status ticks, and `EffectOp` stays non-recursive.
 */
const ChainInnerOpSchema = z.discriminatedUnion('kind', [DamageOpSchema, ApplyStatusOpSchema]);

/**
 * `chain` arcs to up to `maxJumps` targets: from the committed primary, each hop
 * goes to the nearest enemy not yet hit within `rangeCells` (Chebyshev) of the
 * last victim (`nearestChainTarget`), applying `ops` at each, with damage scaled
 * by `falloff^jumpIndex` (the primary takes it whole). The geometry draws no
 * RNG; only the ops' own rolls do. The ops' scalars are captured once at cast
 * (`OpResolution.chainOps`) and scaled per hop, so a charged chain uses its
 * cast-time stats as every other op does.
 *
 * `hopDelaySeconds` spaces the hops over sim ticks, each landing that long after
 * the last, so the arc travels and each hop's number, HP drop and arc show on
 * its own tick; 0 resolves every hop on the impact tick. A hop that waits sits
 * in `World.pendingChainHops`, which is serialized, and finds its target when
 * it fires, so a target that moved or died between hops is handled
 * deterministically.
 */
const ChainOpSchema = z.object({
  kind: z.literal('chain'),
  maxJumps: z.number().int().positive(),
  rangeCells: z.number().int().positive(),
  falloff: z.number().min(0).max(1),
  hopDelaySeconds: z.number().nonnegative().default(0.1),
  ops: z.array(ChainInnerOpSchema).min(1),
});

// `EffectOpSchema`, the whole op union, is declared after the target selectors,
// since `summon`'s `at` anchor is a `TargetSelector`. `PeriodicOpSchema` needs
// no selector, so it stays here.

/**
 * The ops a status may fire as its periodic tick (`StatusDef.periodic.op`,
 * `statusSchema.ts`): a DoT (`damage`) or a HoT (`heal`). A `move` or an
 * `applyStatus` fired every interval means nothing, so they are left out. The
 * shipped DoTs deal flat damage (`scaling: 'none'`) with `bypassDefense` and
 * without `evadable`; the interpreter scales a tick's output by the effect's
 * magnitude.
 */
export const PeriodicOpSchema = z.discriminatedUnion('kind', [DamageOpSchema, HealOpSchema]);

/* -------------------------------------------------------------------------- */
/* Target selectors: who or what an ability resolves to.                      */
/* -------------------------------------------------------------------------- */

/**
 * Which teams an `aoe` or an aura touches, relative to the caster (as
 * `affectsMatch` reads it):
 *
 * - `enemies` — every team but the caster's, neutrals included.
 * - `allies` — the caster's team.
 * - `all` — every team; a confused caster's blasts are forced to it.
 */
const AffectsSchema = z.enum(['enemies', 'allies', 'all']);

const SelfSelectorSchema = z.object({ kind: z.literal('self') });

/** One enemy, the unit's committed `currentTarget`. */
const EnemyInRangeSelectorSchema = z.object({ kind: z.literal('enemyInRange') });

/**
 * An area of cells around an anchor, the caster or the target's cell. Only
 * `square` is built; `line` and `cross` parse and throw when an op fires one
 * (`targeting.ts`). `ringMultiplier` is the damage factor off the centre cell
 * (1, the default, is uniform). Cells become units through `unitsInCells`,
 * which counts a unit's whole footprint.
 */
const AoeSelectorSchema = z.object({
  kind: z.literal('aoe'),
  shape: z.enum(['square', 'line', 'cross']),
  radius: z.number().int().nonnegative(),
  anchor: z.enum(['caster', 'targetCell']),
  affects: AffectsSchema,
  ringMultiplier: z.number().min(0).max(1).default(1),
});

/** The lowest-HP wounded ally within `rangeCells`, the caster included
 *  (`lowestWoundedAlly`). */
const LowestHpAllySelectorSchema = z.object({
  kind: z.literal('lowestHpAlly'),
  rangeCells: z.number().int().positive(),
});

export const TargetSelectorSchema = z.discriminatedUnion('kind', [
  SelfSelectorSchema,
  EnemyInRangeSelectorSchema,
  AoeSelectorSchema,
  LowestHpAllySelectorSchema,
]);

/* -------------------------------------------------------------------------- */
/* Summon: minions placed on the caster's team, around an anchor.             */
/* -------------------------------------------------------------------------- */

/**
 * What a `summon` op places. The minion is its own archetype, a stat block in
 * `config/units.json`, named by `archetype`; an unknown id is refused at boot
 * (`assertSummonRefsResolve`, `src/config/units.ts`). `level` is the minions'
 * level, a bare number or scaled off the summoner at cast and rounded to a
 * whole level of at least 1, since `scaledUnit` needs one; that path draws no
 * RNG for the stats. `count` minions land per cast. `maxLive` caps how many of
 * this caster's summons may be alive at once, which bounds the live unit count;
 * the cap is held at propose (the caster abstains at it and summons again as
 * minions die) and again at fire. `radiusCells` bounds how far from the `at`
 * anchor a minion may land (the search for the nearest free cell); with no free
 * cell in range the cast fizzles, its cooldown spent.
 */
const SummonSpecSchema = z.object({
  archetype: z.string().min(1),
  // Captured and rounded at cast (`propose.ts`).
  level: ScalarOrScaledSchema.default(1),
  count: z.number().int().positive().default(1),
  maxLive: z.number().int().positive(),
  radiusCells: z.number().int().positive().default(2),
});

/**
 * `summon` places `summon.count` minions on the caster's team in the free cells
 * nearest the `at` anchor (the `actingPosition` search), within
 * `summon.radiusCells`. It is anchored where the op says, not in the team's
 * spawn region: `at: self` (the default) is beside the caster, and a target or
 * an `aoe` anchor is a flank or an area summon, through one resolver (anchor,
 * nearest free cells, take `count`). The geometry draws no RNG. It is not a
 * chain or periodic op, since a summon per hop or per tick means nothing.
 */
const SummonOpSchema = z.object({
  kind: z.literal('summon'),
  summon: SummonSpecSchema,
  at: TargetSelectorSchema.default({ kind: 'self' }),
});

/**
 * The closed op union: every operation an ability performs on what it resolved.
 * A new mechanic is a new variant here, never a new action class.
 */
export const EffectOpSchema = z.discriminatedUnion('kind', [
  DamageOpSchema,
  HealOpSchema,
  MoveOpSchema,
  ApplyStatusOpSchema,
  ChainOpSchema,
  SummonOpSchema,
]);

/* -------------------------------------------------------------------------- */
/* The ability definition.                                                     */
/* -------------------------------------------------------------------------- */

/**
 * One phase of the busy window. `seconds` is the phase's duration, converted
 * with `secondsToTicks` when it resolves, or `'fill'` for the one elastic phase
 * that takes what the cadence leaves (every shipped def's `recovery`); a
 * timeline has at most one (refined below). See `resolvePhases`.
 *
 * `scalesWithSpeed` makes a fixed phase shrink with the caster's `speed` on the
 * cadence's curve (`speedScaledSeconds`), so a charged spell's wind-up quickens
 * with the cadence instead of putting a constant floor under it, which would
 * waste most of the speed range. The default, false, is a flat conversion (a
 * projectile's travel, an impact). On a `'fill'` phase, which already follows
 * the cadence, it is refused rather than ignored.
 */
const TimelinePhaseSchema = z
  .object({
    phase: PhaseSchema,
    seconds: z.union([z.number().nonnegative(), z.literal('fill')]),
    scalesWithSpeed: z.boolean().default(false),
  })
  .refine((p) => !(p.seconds === 'fill' && p.scalesWithSpeed), {
    message:
      "a 'fill' phase already scales with the cadence — `scalesWithSpeed` is only meaningful on a fixed (numeric) phase",
    path: ['scalesWithSpeed'],
  });

const EffectEntrySchema = z.object({
  phase: PhaseSchema,
  op: EffectOpSchema,
});

/** Renderer keys per phase, which the FX registry resolves on `action:phase`;
 *  the sim never reads them. */
const FxSchema = z
  .object({
    windup: z.string(),
    release: z.string(),
    travel: z.string(),
    impact: z.string(),
    recovery: z.string(),
  })
  .partial();

/**
 * A passive aura, run by `World.applyAuraStatuses` (a tick pass, as
 * `applyTileStatuses` is), not by the ability pipeline, so the carrier radiates
 * every tick while doing whatever else it does. Each tick the pass sustains
 * `statusId` on every live unit within `radius` (Chebyshev to the footprint,
 * the carrier included when `affects` admits its team), so the effect lingers
 * after a unit leaves for the status's own `durationSeconds`, and the same
 * status never stacks from the aura, whatever its `merge` (`aura.test.ts`).
 *
 * `radius` is the aura's own reach, not the def's `rangeCells`, which is the
 * engagement reach (`rangeForArchetype` leaves the aura out). A def may carry
 * ops and an aura. An aura with no ops must target `self` (refined below), so
 * `derived.attackRange` never grows to the aura's radius, and it never proposes
 * (`proposeEffectAbility`).
 */
const AuraSchema = z.object({
  radius: z.number().int().positive(),
  statusId: z.string().min(1),
  affects: AffectsSchema,
});

export const AbilityDefSchema = z
  .object({
    id: z.string().min(1),
    /**
     * The player-facing name (the unit card's ability row, the archetype
     * editor), a locale address (`abilities.<id>.name`).
     */
    name: prose(),
    /** The base interval before the ability proposes again, in seconds. */
    cooldownSeconds: z.number().positive(),
    /**
     * Whether the cadence, and so the `'fill'` phase, scales with the caster's
     * `speed`: true is the attack cadence (`attackCooldownTicksFor`), false a
     * flat cooldown apart from the busy window (the dash, whose cooldown is far
     * longer than its motion).
     */
    speedScaled: z.boolean().default(true),
    rangeCells: z.number().int().nonnegative(),
    /** The nearest the unit engages from; a closer target makes it kite back to
     *  the band (`positioning.ts`). 0, the default, is no floor. */
    minRangeCells: z.number().int().nonnegative().default(0),
    /** An arcing shot that needs no line of sight; documented on `Ability`. */
    ignoresLineOfSight: z.boolean().optional(),
    target: TargetSelectorSchema,
    timeline: z.array(TimelinePhaseSchema).min(1),
    orphanPolicy: OrphanPolicySchema,
    /** The proposal's score, which `AbilityBehavior` ranks the abilities by. */
    priority: z.number(),
    effects: z.array(EffectEntrySchema),
    fx: FxSchema.optional(),
    /** A passive aura (`AuraSchema`). */
    aura: AuraSchema.optional(),
    /**
     * The release gate. At the `release` boundary, the band and line-of-sight
     * test the propose step ran (`firingBandCell`, positioning.ts) runs again
     * against the target's live position: a dead or out-of-band target stops
     * the shot before the projectile exists (nothing fires, no RNG is drawn),
     * and the cooldown is set to `reaimSeconds` instead of the full cadence, so
     * the unit re-aims rather than winding up again. `scalesWithSpeed` puts the
     * re-aim on the cadence's curve, as the phase flag does. Requires a
     * `release` phase and the `enemyInRange` selector (refined below).
     */
    releaseGate: z
      .object({
        reaimSeconds: z.number().positive(),
        scalesWithSpeed: z.boolean().default(false),
      })
      .optional(),
  })
  .refine((def) => def.timeline.filter((p) => p.seconds === 'fill').length <= 1, {
    message: "a timeline may declare at most one 'fill' phase",
    path: ['timeline'],
  })
  .refine(
    (def) => {
      const phases = new Set(def.timeline.map((p) => p.phase));
      return def.effects.every((e) => phases.has(e.phase));
    },
    {
      message: 'every effect must fire on a phase present in the timeline',
      path: ['effects'],
    },
  )
  .refine((def) => !def.aura || def.effects.length > 0 || def.target.kind === 'self', {
    message:
      "a pure aura (no effect ops) must target 'self' — any other selector would inflate " +
      'derived.attackRange to the aura radius and strand the carrier out of engagement',
    path: ['aura'],
  })
  .refine((def) => !def.releaseGate || def.timeline.some((p) => p.phase === 'release'), {
    message: "releaseGate requires a 'release' phase in the timeline (nothing else fires it)",
    path: ['releaseGate'],
  })
  .refine((def) => !def.releaseGate || def.target.kind === 'enemyInRange', {
    message:
      "releaseGate requires the 'enemyInRange' selector — the gate re-tests a locked " +
      'single target; aoe/self/ally verbs have no band to re-test',
    path: ['releaseGate'],
  });

/* -------------------------------------------------------------------------- */
/* Inferred types.                                                            */
/* -------------------------------------------------------------------------- */

export type DamageScaling = z.infer<typeof DamageScalingSchema>;
export type ScaledValue = z.infer<typeof ScaledValueSchema>;
export type Affects = z.infer<typeof AffectsSchema>;
export type EffectOp = z.infer<typeof EffectOpSchema>;
export type DamageOp = z.infer<typeof DamageOpSchema>;
export type HealOp = z.infer<typeof HealOpSchema>;
export type ChainOp = z.infer<typeof ChainOpSchema>;
export type ChainInnerOp = z.infer<typeof ChainInnerOpSchema>;
export type SummonOp = z.infer<typeof SummonOpSchema>;
export type SummonSpec = z.infer<typeof SummonSpecSchema>;
export type TargetSelector = z.infer<typeof TargetSelectorSchema>;
export type TimelinePhase = z.infer<typeof TimelinePhaseSchema>;
export type EffectEntry = z.infer<typeof EffectEntrySchema>;
export type Aura = z.infer<typeof AuraSchema>;
export type AbilityDef = z.infer<typeof AbilityDefSchema>;

/** One ability definition, parsed; throws on a malformed shape. */
export function parseAbilityDef(raw: unknown): AbilityDef {
  return AbilityDefSchema.parse(raw);
}
