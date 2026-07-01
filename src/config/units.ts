/**
 * Validated unit-def catalog accessor (the §38 keystone's `UnitDef` catalog;
 * renamed from `archetypes.json`/`archetypes.ts` in 38b). The JSON source of
 * truth lives at `config/units.json`; this module imports it via Vite's native
 * JSON support, validates it through zod, and re-exports the parsed
 * value with the strict TS types the rest of the codebase expects.
 *
 * Validation runs at module load (effectively boot). A malformed config
 * throws a zod error before any gameplay code runs, which is exactly
 * the failure mode we want — broken balance JSON should be loud, not
 * silently fall back to defaults.
 *
 * E1: schema flipped from the MVP `{hp, attackDamage, attackCooldown,
 * moveCooldown}` ranges to a `baseStats` block in the new stat
 * vocabulary (constitution / strength / ranged / magic / luck / defense /
 * precision / evasion / speed / mobility / power — the I1 canonical order).
 * The `STAT_CAP = 99` cap is a typo guard, not a design knob — the practical
 * range never touches it. GP1 renamed the two cadence stats
 * (`speed → agility`, `endurance → mobility`) and made `mobility` signed;
 * I1 reverted `agility → speed` (it read as "dodge chance" once the real
 * dodge stats `precision`/`evasion` arrived) and reordered to group the
 * direct-combat stats (incl. `defense`) ahead of dodge/cadence/meta.
 *
 * E2: each archetype declares an `abilities: string[]` list of registry
 * ids resolved at module load against `knownAbilityIds()`. Unknown ids
 * fail the parse loudly (A4 pattern) — keeping the JSON tunable while
 * the ability behavior itself stays type-checked in TS.
 *
 * E3: each archetype declares a `growthRates` block parallel to
 * `baseStats`. Each rate is in `[0, 1]` — the probability that the stat
 * increments by 1 on a single simulated level-up (player recruits, via
 * `simulateLevelUps`), and also the per-level deterministic increment
 * for enemies (via `scaleStats`). A rate of 0 means the stat never grows
 * (useful for archetype-orthogonal stats: a melee unit's ranged stat
 * stays 0 forever).
 *
 * GP1: the per-archetype `baseMoveCooldownSeconds` override is gone.
 * There's one universal `STATS.baseMoveCooldownSeconds`; a slow walking
 * pace now comes from low/negative `mobility` (heavy units around −7),
 * which the move-CD curve turns into a scale > 1. Attack-cooldown bases
 * live on ability definitions (a unit can carry several abilities with
 * different timings), scaled per unit by `speed`.
 *
 * E5: `attackRange` left the archetype schema for the same reason —
 * range is now a per-ability tunable in `config/abilities.json`. A
 * unit's effective engagement range is the MAX over its abilities (see
 * `rangeForArchetype` in `src/sim/archetypes.ts`).
 *
 * Adding a new archetype (§38c — now pure DATA, no code edit):
 *   1. Add its key + abilities + baseStats + growthRates (+ any capability
 *      fields: damageStat / movementBehavior / retargetOnLosLoss) to
 *      `config/units.json` (use low/negative `mobility` for a slow walking
 *      pace — there's no per-archetype move-CD override).
 *   2. That's it — the open `z.record` catalog validates it structurally and
 *      the string `Archetype` id resolves everywhere. (Only add a boot-assert to
 *      `REQUIRED_UNIT_IDS` if run/enemy-comp code references the new id by
 *      literal; §38e's editor authors all of this without touching code.)
 */

import { z } from 'zod';
import unitsJson from '../../config/units.json';
import { knownAbilityIds } from '../sim/abilities/registry';
import { knownTargetingIds } from '../sim/targetingStrategies';
import { ABILITY_DEFS } from './abilities';

/** Defensive cap to catch a designer typo (e.g. 500 instead of 5). */
const STAT_CAP = 99;

const BaseStatsSchema = z.object({
  constitution: z.number().int().nonnegative().max(STAT_CAP),
  strength: z.number().int().nonnegative().max(STAT_CAP),
  ranged: z.number().int().nonnegative().max(STAT_CAP),
  magic: z.number().int().nonnegative().max(STAT_CAP),
  luck: z.number().int().nonnegative().max(STAT_CAP),
  // GP2: flat subtractive damage mitigation. Nonnegative like the offensive
  // stats (0 = no armor). I1 reordered it up next to `luck` (combat stats group).
  defense: z.number().int().nonnegative().max(STAT_CAP),
  // I1: dodge stats — `precision` (attacker) vs `evasion` (defender) feed the
  // hit/miss roll in `World.applyDamage`. Nonnegative; behavior-neutral until I2.
  precision: z.number().int().nonnegative().max(STAT_CAP),
  evasion: z.number().int().nonnegative().max(STAT_CAP),
  // I1: `speed` (attack cadence; reverts GP1's `agility` name). Nonnegative.
  speed: z.number().int().nonnegative().max(STAT_CAP),
  // GP1: `mobility` is SIGNED — 0 is the universal move-CD baseline, positive
  // is faster, negative is slower (heavy units land around −7). The other
  // stats stay nonnegative; mobility's lower bound is the typo guard mirrored.
  mobility: z.number().int().min(-STAT_CAP).max(STAT_CAP),
  // H1: Phase-H pool-chip stat — a turn's survivors chip the opposing health
  // pool by their Σ`power`. Nonnegative; behavior-neutral until H4 consumes it.
  power: z.number().int().nonnegative().max(STAT_CAP),
});

const GrowthRatesSchema = z.object({
  constitution: z.number().min(0).max(1),
  strength: z.number().min(0).max(1),
  ranged: z.number().min(0).max(1),
  magic: z.number().min(0).max(1),
  luck: z.number().min(0).max(1),
  defense: z.number().min(0).max(1),
  precision: z.number().min(0).max(1),
  evasion: z.number().min(0).max(1),
  speed: z.number().min(0).max(1),
  mobility: z.number().min(0).max(1),
  power: z.number().min(0).max(1),
});

const ABILITY_IDS = knownAbilityIds();
const AbilityIdSchema = z.string().refine((id) => ABILITY_IDS.includes(id), {
  message: `unknown ability id; known: [${ABILITY_IDS.join(', ')}]`,
});

// Per-archetype target-selection policy, validated against the strategy
// registry (`src/sim/targetingStrategies.ts`) at load — same A4 pattern as
// AbilityIdSchema. A typo'd or unregistered id fails the parse loudly.
const TARGETING_IDS = knownTargetingIds();
const TargetingIdSchema = z.string().refine((id) => TARGETING_IDS.includes(id), {
  message: `unknown targeting id; known: [${TARGETING_IDS.join(', ')}]`,
});

// Exported for the dev-only archetype editor (tools/archetype-editor/), which
// validates an edited config against the SAME schema the game boots on — so the
// editor's "is this valid?" can never drift from the game's load-time parse.
// Dev-tool consumption only; no sim/snapshot/fuzz behavior reads these exports.
export const UnitDefSchema = z.object({
  glyph: z.string().length(1),
  abilities: z.array(AbilityIdSchema).min(1),
  baseStats: BaseStatsSchema,
  growthRates: GrowthRatesSchema,
  // Required — every archetype declares its targeting policy explicitly
  // (default `nearest`); a future archetype that omits it fails at load.
  targeting: TargetingIdSchema,
  // §29-close — whether this archetype appears in the player's post-victory
  // recruit offer (`rollOffer` samples `DRAFTABLE_UNIT_DEFS`, the draftable
  // subset of `ALL_UNIT_DEFS`). Defaults TRUE so a newly-added archetype joins
  // the draft pool automatically (the F1 intent); the §29 enemy disruptors
  // (frozen/confusion/blind/panic afflicters) + the summon-only Ghoul set it
  // FALSE — they exist on the board (cast by enemies / summoned) but are never
  // the player's to draft. Optional in the JSON (absent ⇒ draftable); the editor
  // formatter emits the line only when false, keeping the file diff to the
  // exclusions.
  draftable: z.boolean().default(true),

  // ── §38 fields (planted INERT by 38b) ──────────────────────────────────────
  // All def-resolved by id at spawn (like glyph/targeting), so no WorldSnapshot
  // bump. 38b adds them to the SCHEMA only — every existing entry omits them
  // (the formatter doesn't emit them, so the file stays byte-identical) and the
  // consuming code still runs its old archetype switches. 38c+ populate + wire.
  //
  // §39 footprint — an axis-aligned N×N body (N ∈ 1..4); `position` stays the
  // canonical corner. Default 1 (single-cell). Inert until §39 fills
  // `cellsOccupiedBy`.
  footprint: z.number().int().min(1).max(4).default(1),
  // Flight (deferred build) — the occupancy plane the unit lives on. `ground`
  // today; `air` is the flight fill. Inert until flight builds.
  layer: z.enum(['ground', 'air']).default('ground'),
  // Flight (deferred build) — a flyer skips the §37 tile cost/effect pass. Inert
  // until flight builds.
  ignoresTerrain: z.boolean().default(false),
  // §38d — the status allow-filter the `applyStatus` op will consult: the status
  // ids this unit can receive. Absent ⇒ susceptible to ALL (the behavior-
  // identical default for every combatant); a wall/rubble opts into the few it
  // allows (burn/frozen, not poison/bleed). Inert until 38d wires `applyStatus`.
  statusSusceptibility: z.array(z.string()).optional(),
  // 38a branch-killers — planted optional (absent today; the old switches still
  // run), populated + consumed in 38c. `damageStat`: the stat a basic strike /
  // the display "ATK" reads (absent ⇒ non-striker/0; → `stats.ts` damageStatFor).
  // `movementBehavior`: the movement-behavior selector (absent ⇒ standard;
  // `support` = the healer; → `behaviors/registry.ts`). `retargetOnLosLoss`: drop
  // a too-long-unseen target (the ranged special-case; absent ⇒ false; →
  // `Targeting.ts`).
  damageStat: z.enum(['strength', 'ranged', 'magic']).optional(),
  movementBehavior: z.enum(['standard', 'support']).optional(),
  retargetOnLosLoss: z.boolean().optional(),
});

// §38c — the KEYSTONE relax: an OPEN `string → UnitDef` record, not a fixed
// 18-key object. The closed `Archetype` union is gone (`src/sim/Unit.ts`), so
// the catalog is now the single source of which unit kinds exist — validated
// STRUCTURALLY (every entry is a well-formed `UnitDef`) rather than by an
// enumerated key list. This is what lets §38e's editor author a brand-new unit
// kind as pure data. The ids the game constructs by LITERAL (start team /
// default enemy comp / summon targets) lost their compile-time guarantee with
// the union, so `assertRequiredUnitsPresent` + `assertSummonRefsResolve` (below)
// boot-assert they resolve — a rename/removal fails at load, not at spawn.
// `z.record` preserves JSON key order, so the archetype-editor formatter still
// round-trips (it emits in parsed-shape order).
export const UnitDefsSchema = z.record(z.string(), UnitDefSchema);

export type UnitDef = z.infer<typeof UnitDefSchema>;
export type UnitDefsConfig = Record<string, UnitDef>;
export type GrowthRates = z.infer<typeof GrowthRatesSchema>;

export const UNIT_DEFS: UnitDefsConfig = UnitDefsSchema.parse(unitsJson);

/**
 * §38c boot-assert — the ids the game hard-references by string LITERAL must
 * exist in the catalog. The closed `Archetype` union used to guarantee this at
 * compile time; with the union relaxed to an open string id, a typo/rename/removal
 * would otherwise surface only at spawn. Keep this list in sync with the literal
 * constructions the 38a audit found: `Run.ts` start team (`mercenary`) +
 * `enemyBudget.ts` default enemy comp (`bandit`/`ranged`). Summon targets get
 * their own resolve check in `assertSummonRefsResolve`.
 */
const REQUIRED_UNIT_IDS = ['mercenary', 'bandit', 'ranged'] as const;
(function assertRequiredUnitsPresent(): void {
  for (const id of REQUIRED_UNIT_IDS) {
    if (!(id in UNIT_DEFS)) {
      throw new Error(
        `config/units.json is missing required unit '${id}' (hard-referenced by run/enemy-comp code)`,
      );
    }
  }
})();

/**
 * §29d boot check (the `assertStatusRefsResolve` sibling): every `summon` op
 * referenced in the ability catalog must name an archetype that EXISTS in this
 * catalog — a typo'd / dangling `summon.archetype` fails at startup, not silently
 * at cast. Lives HERE (the archetype catalog owns the valid-id set) rather than in
 * the ability registry's boot IIFE, which runs before this module's `UNIT_DEFS`
 * is built (and importing `UNIT_DEFS` there would cycle through `knownAbilityIds`).
 * Walks `ABILITY_DEFS` directly — config/abilities is already loaded (the
 * `knownAbilityIds` import above pulled it in) and never imports back here, so the
 * dependency stays one-way. `summon` is a top-level op only (never a chain-inner /
 * periodic op), so no recursion is needed.
 */
(function assertSummonRefsResolve(): void {
  const archetypeIds = new Set(Object.keys(UNIT_DEFS));
  for (const def of Object.values(ABILITY_DEFS)) {
    for (const entry of def.effects) {
      if (entry.op.kind !== 'summon') continue;
      const archetype = entry.op.summon.archetype;
      if (!archetypeIds.has(archetype)) {
        throw new Error(`ability '${def.id}': summon references unknown archetype '${archetype}'`);
      }
    }
  }
})();
