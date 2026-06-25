/**
 * Phase Y1 — the data-driven attack/effect vocabulary (the Cluster-1 keystone).
 *
 * Every combat verb in the game — the six attack classes plus the rogue dash —
 * decomposes into three orthogonal axes (the design brief,
 * `archive/cluster-one-feedback.md`):
 *
 *   1. Targeting   — `TargetSelector`: WHO/what the verb resolves to.
 *   2. Timeline    — the F2 phase schedule (windup→release→travel→impact→
 *                    recovery) + the per-verb `OrphanPolicy`. Authored in
 *                    SECONDS (canonical, TICK_RATE-independent) and converted to
 *                    ticks at resolve time (see `timeline.ts`).
 *   3. Effect-ops  — `EffectOp`: an ordered list of small typed operations
 *                    slotted onto phases (`effects:[{phase, op}]`).
 *
 * New mechanics are new OPS in the closed, zod-validated discriminated union —
 * never new `Action` classes, never a scripting language. The interpreter
 * (Phase Y2, `EffectAction`) is one `switch` over `op.kind`; this module is the
 * pure DATA + validation, no behavior.
 *
 * SCOPE (Y1): the `damage` / `heal` / `move` ops + the `self` / `enemyInRange` /
 * `aoe` / `lowestHpAlly` selectors are enough to express the existing verbs. The
 * union also DECLARES the reserved seams that later phases build:
 *   - `move` modes `knockback` / `pull` — target-moving, deferred to Cluster 2's
 *     hardened occupancy core (this round ships only caster-reposition).
 *   - the `applyStatus` op — status-on-hit, wired to the §27 status registry in
 *     §29 (its `statusId` is a plain string ref here, boot-validated then).
 * `summon` / `chain` are ADDITIVE variants the closed union grows into in §29 —
 * declared then, not now (they need `SummonSpec` / recursion).
 *
 * Reconciliation with the brief's type sketch (the brief is authoritative for
 * SHAPE; byte-identity dictates the fields it elided):
 *   - the `damage` op carries `accuracy` + `critBase` (every current attack
 *     does — they feed the to-hit / crit rolls); the brief dropped them.
 *   - the `aoe` selector carries `ringMultiplier` (the mage's 0.5 ring); the
 *     brief dropped it.
 *   - `scaling` lives on the op (each verb's id maps to exactly one
 *     `damageStatFor` stat, so op-authored scaling stays byte-identical) — and
 *     `damageStatFor` survives for the display surfaces (HUD/recruit "ATK").
 *
 * The config home is `config/abilities.json` (`src/config/abilities.ts`) — the
 * single ability catalog after Y5e retired the legacy hand-coded ability config.
 * See `src/config/abilities.ts`.
 */

import { z } from 'zod';
import type { ActionPhaseName, OrphanPolicy } from '../Action';

/* -------------------------------------------------------------------------- */
/* Phase + orphan enums — mirrored from Action.ts, drift-guarded.             */
/* -------------------------------------------------------------------------- */

// `satisfies` keeps the zod enums in lockstep with Action.ts's source unions: a
// typo'd / stray literal here is a compile error. (Purely a type guard — no
// runtime emission. The reverse direction — a NEW Action.ts phase without a
// mirror — surfaces when a def references it and the enum rejects it.)
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
  're-home',
] as const satisfies readonly OrphanPolicy[];

export const PhaseSchema = z.enum(PHASE_NAMES);
export const OrphanPolicySchema = z.enum(ORPHAN_POLICIES);

/* -------------------------------------------------------------------------- */
/* Effect ops — the typed operations a verb performs on its resolved targets.  */
/* -------------------------------------------------------------------------- */

/**
 * Which caster stat is ADDED to an op's flat `might` to get its base output.
 * `none` = flat `might` only (a future environmental tick). Each existing verb
 * maps to exactly one stat (sword/club/katana/whip/gambit → strength, bow →
 * ranged, magic_bolt → magic, catapult_shot → ranged), so authoring `scaling`
 * on the op reproduces `damageStatFor` byte-for-byte.
 */
const DamageScalingSchema = z.enum(['strength', 'ranged', 'magic', 'none']);
const HealScalingSchema = z.enum(['magic', 'none']);

/**
 * `damage` — routes through `World.applyDamage` (the single chokepoint). The
 * interpreter computes `round(base × critFactor × damageMultiplier)` where
 * `base = might + scalingStat`, draws the crit off `combatRng`, then hands the
 * to-hit roll to `applyDamage` (when `evadable`). `accuracy` / `critBase` are
 * read only when `evadable` / `critable`. `bypassDefense` skips mitigation
 * (DoTs in §27; FALSE for every migrated strike — they keep defense).
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
 * `heal` — adds HP to a resolved ally, clamped at maxHp. `might` flat + the
 * `scaling` stat (`magic` | `none`). Never rolls to-hit or crit (mirrors
 * `HealAction` / `healAmountFor`).
 */
const HealOpSchema = z.object({
  kind: z.literal('heal'),
  scaling: HealScalingSchema,
  might: z.number().nonnegative(),
});

/**
 * `move` — repositioning. This round ships only the CASTER-reposition modes:
 *   - `advance` — leap toward the action's target (the rogue dash, N1).
 *   - `retreat` — step away from the action's target (the rogue gambit, F4).
 * `knockback` / `pull` move the TARGET; they are a RESERVED seam — declared so
 * the union is closed + future-complete, but boot-/interpreter-rejected until
 * Cluster 2 hardens the occupancy core (the same "declared, no consumer"
 * pattern as F2's `re-home` OrphanPolicy). `cells` = max cells to move.
 */
const MoveOpSchema = z.object({
  kind: z.literal('move'),
  mode: z.enum(['advance', 'retreat', 'knockback', 'pull']),
  cells: z.number().int().positive(),
});

/**
 * `applyStatus` — RESERVED for §29 (status-on-hit). Declared here so the union
 * is closed and the editor (§30) sees the shape; `statusId` is a plain string
 * ref boot-validated once the §27 status registry exists, and the interpreter
 * rejects this op until §29 wires it.
 */
const ApplyStatusOpSchema = z.object({
  kind: z.literal('applyStatus'),
  statusId: z.string().min(1),
  magnitude: z.number().optional(),
  durationSeconds: z.number().positive().optional(),
});

/**
 * §29c — the ops valid as a `chain`'s per-jump payload. A chain arcs to N nearest
 * targets and applies these to each — so `damage` (the bolt) + `applyStatus` (a
 * rider, e.g. a stun-on-each-hop) are the meaningful ones. `move` / `heal` are
 * nonsensical fired at an enemy jump target, and a NESTED `chain` is excluded
 * deliberately: it would need `z.lazy` recursion + raise thorny falloff/geometry
 * semantics no consumer wants. So the inner payload is its own restricted union
 * (the same discipline `PeriodicOpSchema` holds for status ticks) — the chain op
 * stays in the closed `EffectOp` union without making that union self-referential.
 */
export const ChainInnerOpSchema = z.discriminatedUnion('kind', [DamageOpSchema, ApplyStatusOpSchema]);

/**
 * `chain` — arc to up to `maxJumps` targets: start at the committed primary, then
 * hop to the nearest not-yet-hit enemy within `rangeCells` (Chebyshev) of the
 * previous victim, applying `ops` at each with a cumulative `falloff` on damage
 * (`baseDamage × falloff^jumpIndex`; the primary is `falloff^0` = full). The
 * geometry is deterministic (`world.units` order tie-breaks); only the `ops`'
 * own rolls draw RNG. The interpreter recurses over `ops` per jump (the closed
 * vocab's one op that contains other ops). Per-op cast-time scalars are captured
 * once at propose time into `OpResolution.chainOps` (aligned with `ops`) and
 * scaled by `falloff` live per jump — so a charged chain uses its CAST-time
 * stats, exactly like every other op.
 */
const ChainOpSchema = z.object({
  kind: z.literal('chain'),
  maxJumps: z.number().int().positive(),
  rangeCells: z.number().int().positive(),
  falloff: z.number().min(0).max(1),
  ops: z.array(ChainInnerOpSchema).min(1),
});

export const EffectOpSchema = z.discriminatedUnion('kind', [
  DamageOpSchema,
  HealOpSchema,
  MoveOpSchema,
  ApplyStatusOpSchema,
  ChainOpSchema,
]);

/**
 * Phase 27 — the subset of ops valid as a status's PERIODIC tick
 * (`StatusDef.periodic.op`, `statusSchema.ts`): a DoT (`damage`) or HoT
 * (`heal`). `move` / `applyStatus` are meaningless fired every interval, so the
 * periodic union excludes them — the full `EffectOp` union still carries them
 * for the attack timeline. A periodic DoT authors `scaling:'none'` flat `might`
 * with `bypassDefense:true` / `evadable:false` (the burn default); the
 * interpreter scales its output by the effect's magnitude (27b).
 */
export const PeriodicOpSchema = z.discriminatedUnion('kind', [DamageOpSchema, HealOpSchema]);

/* -------------------------------------------------------------------------- */
/* Target selectors — WHO/what a verb resolves to.                            */
/* -------------------------------------------------------------------------- */

/**
 * Friendly-fire filter for an `aoe`, relative to the caster:
 *   - `enemies` — any unit NOT on the caster's team (enemy + neutral; so AoE
 *     chews destructible terrain for free once Cluster 2 gives neutrals HP).
 *   - `allies`  — the caster's team.
 *   - `all`     — both (also the forced filter for a §28 confused caster).
 */
const AffectsSchema = z.enum(['enemies', 'allies', 'all']);

const SelfSelectorSchema = z.object({ kind: z.literal('self') });

/** Single enemy target (the committed `currentTarget`). Affects enemies implicitly. */
const EnemyInRangeSelectorSchema = z.object({ kind: z.literal('enemyInRange') });

/**
 * Area over cells. Only `square` is exercised today (the mage bolt: square
 * radius 1, anchored on the target cell); `line` / `cross` are reserved shapes.
 * `ringMultiplier` is the damage factor on non-center cells (mage 0.5; 1 =
 * uniform). The interpreter resolves cells → units via the `unitsInCells`
 * helper (the Cluster-2 footprint seam, single-cell today).
 */
const AoeSelectorSchema = z.object({
  kind: z.literal('aoe'),
  shape: z.enum(['square', 'line', 'cross']),
  radius: z.number().int().nonnegative(),
  anchor: z.enum(['caster', 'targetCell']),
  affects: AffectsSchema,
  ringMultiplier: z.number().min(0).max(1).default(1),
});

/** Lowest-HP ally within `rangeCells` (the healer). Affects allies implicitly. */
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
/* The ability definition.                                                     */
/* -------------------------------------------------------------------------- */

/**
 * One phase of the busy-window timeline. `seconds` is the phase's authored
 * duration (converted via `secondsToTicks` at resolve), OR the sentinel `'fill'`
 * for the single ELASTIC phase that absorbs the remainder of the (speed-scaled)
 * cadence window — the strike's `recovery`, the charged spell's `windup`. At
 * most one `'fill'` per timeline (refined below). See `resolvePhases`.
 *
 * Phase Yb — `scalesWithSpeed` makes a FIXED (numeric) phase shrink with the
 * caster's `speed`, via the SAME curve the cadence uses (`speedScaledSeconds`):
 * a charged spell's windup then speeds up ALONGSIDE the cadence instead of
 * pinning a constant floor under it (which would waste most of the speed range —
 * e.g. a fixed 1.85 s of phases caps a 2.5 s→1.0 s cadence at 1.85 s, only 26% of
 * the 60% the curve allows). Default `false` = a flat conversion (a projectile's
 * physical travel, an impact boundary). Meaningless on a `'fill'` phase — that
 * already tracks the speed-scaled cadence — so the combo is rejected (refined
 * below) rather than silently ignored.
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

/** Opaque renderer keys per phase (§Z). Inert in Y — declared for the shape. */
const FxSchema = z
  .object({
    windup: z.string(),
    release: z.string(),
    travel: z.string(),
    impact: z.string(),
    recovery: z.string(),
  })
  .partial();

export const AbilityDefSchema = z
  .object({
    id: z.string().min(1),
    /**
     * Player-facing display name (the UnitCard ability row, the archetype
     * editor's ability list). Yb QoL: decoupled from `id` so the surfaces read
     * one source of truth instead of hardcoding labels (the retired `ABILITY_UI`
     * map) or humanizing the raw id. Required — every ability names itself.
     */
    name: z.string().min(1),
    /** Base re-proposal interval, in seconds. */
    cooldownSeconds: z.number().positive(),
    /**
     * Does the cadence (and the `'fill'` phase) scale with the caster's `speed`?
     * `true` = attack cadence (`attackCooldownTicksFor`); `false` = a flat
     * utility cooldown decoupled from the busy window (the dash: ~10 s cooldown,
     * ~0.25 s motion).
     */
    speedScaled: z.boolean().default(true),
    rangeCells: z.number().int().nonnegative(),
    /** Engagement floor (O4 kiting); 0 = no floor (the default). */
    minRangeCells: z.number().int().nonnegative().default(0),
    /**
     * E7.D — an arcing shot that lobs OVER walls (the catapult): the propose-time
     * LOS gate is skipped, and `MovementBehavior`'s in-range abstain reads the
     * same flag off the ability (via `EffectAbility.ignoresLineOfSight`) so it
     * doesn't creep forward to clear a wall it doesn't need cleared. Absent/false
     * on every LOS-gated verb (the strikes / bow / magic bolt).
     */
    ignoresLineOfSight: z.boolean().optional(),
    target: TargetSelectorSchema,
    timeline: z.array(TimelinePhaseSchema).min(1),
    orphanPolicy: OrphanPolicySchema,
    /**
     * The proposal score the action selector ranks on (10 for the strikes /
     * heal, 5 for the dash). Named `priority` per the brief; the §29 selector
     * reads it, equal scores tie-broken by registration order as today.
     */
    priority: z.number(),
    effects: z.array(EffectEntrySchema),
    fx: FxSchema.optional(),
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
  );

/* -------------------------------------------------------------------------- */
/* Inferred types.                                                             */
/* -------------------------------------------------------------------------- */

export type DamageScaling = z.infer<typeof DamageScalingSchema>;
export type Affects = z.infer<typeof AffectsSchema>;
export type EffectOp = z.infer<typeof EffectOpSchema>;
export type PeriodicOp = z.infer<typeof PeriodicOpSchema>;
export type DamageOp = z.infer<typeof DamageOpSchema>;
export type HealOp = z.infer<typeof HealOpSchema>;
export type MoveOp = z.infer<typeof MoveOpSchema>;
export type ApplyStatusOp = z.infer<typeof ApplyStatusOpSchema>;
export type ChainOp = z.infer<typeof ChainOpSchema>;
export type ChainInnerOp = z.infer<typeof ChainInnerOpSchema>;
export type TargetSelector = z.infer<typeof TargetSelectorSchema>;
export type TimelinePhase = z.infer<typeof TimelinePhaseSchema>;
export type EffectEntry = z.infer<typeof EffectEntrySchema>;
export type AbilityDef = z.infer<typeof AbilityDefSchema>;

/** Parse one ability definition, throwing on a malformed shape (A4 style). */
export function parseAbilityDef(raw: unknown): AbilityDef {
  return AbilityDefSchema.parse(raw);
}
