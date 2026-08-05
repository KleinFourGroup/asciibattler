/**
 * The run-level stat vocabulary + fold (Phase 47a — the rule vocabulary).
 *
 * Run stats are the passive-modifier surface of the daemon/packet rule
 * system (cluster-3-spec §"The rule vocabulary"): a `modifier` rule
 * contributes an `add` or `mult` onto one of these keys, and consumers read
 * the folded value at use time — derived, never cached or serialized
 * (the derive-don't-cache doctrine).
 *
 * Mirrors the sim's `foldEffects` (src/sim/statusEffects.ts) with two
 * deliberate divergences:
 *  - **No rounding.** `bitsGain` is a dimensionless multiplier (base 1);
 *    rounding belongs at the read site (a bits grant rounds the final
 *    amount; a cache read floors a slot count).
 *  - **No magnitude axis.** Rule modifiers carry plain values — stacking
 *    comes from owning multiple daemons/packets, not per-instance stacks.
 */

import { RECRUITMENT } from '../config/recruitment';
import { DECK } from '../config/deck';
import { NODE_MAP } from '../config/nodemap';

/** The launch run-stat keys (content-driven — grown when content demands).
 *  A tuple so the config layer's zod enum and this type share one source. */
export const RUN_STAT_KEYS = [
  'bitsGain',
  'cacheSize',
  'recruitOfferSize',
  'drawAmount',
  'rarityWeightCommon',
  'rarityWeightUncommon',
  'rarityWeightRare',
  'rarityWeightLegendary',
  'portLegendaryOffers',
  'eventCombatChance',
] as const;
export type RunStatKey = (typeof RUN_STAT_KEYS)[number];

/** Base values before any modifier folds. §64a: bases may be CONFIG-DERIVED
 *  (recruitOfferSize reads recruitment.json — one source of truth; the import
 *  is cycle-free: recruitment.ts touches only zod/json/type-only units). */
export const RUN_STAT_BASES: Readonly<Record<RunStatKey, number>> = {
  /** Multiplier applied to every bits grant (1 = neutral). */
  bitsGain: 1,
  /** Cache slots (spec: base six). Dormant until §49 builds the cache. */
  cacheSize: 6,
  /** 64a — post-battle recruit-offer slots (The Cornucopia's +1). The PORT
   *  unit count is deliberately NOT this stat (spec: "the post-encounter
   *  pool from three to four" — `PRICES.portStock.units` is untouched). */
  recruitOfferSize: RECRUITMENT.defaultOfferSize,
  /** 65a — cards drawn into the hand each turn (the H5 `DECK.handSize`,
   *  promoted to a foldable stat; base config-derived — one source of
   *  truth). PERSISTENT draw modifiers land here (daemons); the transient
   *  packet draws (65c) mutate the hand directly and never touch this
   *  fold — the Option-B budget-basis split (worklog §65-shape-lock). */
  drawAmount: DECK.handSize,
  /** 64b — the global tier weights, promoted to run stats (the no-commons
   *  shape-lock: Patrician's Seal is a `mult 0` fold on the common weight;
   *  the fold's max(0,·) clamp keeps a folded weight legal for the sampler).
   *  Bases = recruitment.json — the tier roll renormalizes over non-empty
   *  tiers, so a zeroed tier costs no probability mass. BOTH offer sites
   *  (recruit + port) read the fold: the Seal governs drafting everywhere
   *  (spec: ports follow the same mechanics), unlike 64a's
   *  recruit-only scope. */
  rarityWeightCommon: RECRUITMENT.rarityWeights.common,
  rarityWeightUncommon: RECRUITMENT.rarityWeights.uncommon,
  rarityWeightRare: RECRUITMENT.rarityWeights.rare,
  rarityWeightLegendary: RECRUITMENT.rarityWeights.legendary,
  /** 64c — port unit slots whose TIER is forced to legendary (Idol of
   *  Portunus's +1; the shape-lock's count-stat generalization — a second
   *  source stacks to two forced slots, naturally clamped by the slot
   *  count at the read site). Base 0: no guarantee without a source. */
  portLegendaryOffers: 0,
  /** 74b — the global event-node combat-resolve chance (spec §Events: the
   *  roll happens BEFORE the event is picked, StS ?-node style; the fight
   *  draws from the sector's normal pool). Foldable BY CONSTRUCTION —
   *  chance-bending daemons are planned content, so a raw config read is
   *  wrong (the §74 shape-lock). Base config-derived (nodemap.json —
   *  node-entry behavior lives with the node knobs); the read site
   *  (`Run.effectiveEventCombatChance`) clamps to [0,1]. */
  eventCombatChance: NODE_MAP.eventCombatChance,
};

/** One passive modifier, as authored by a `modifier` rule. */
export interface RunStatModifier {
  readonly stat: RunStatKey;
  readonly op: 'add' | 'mult';
  readonly value: number;
}

/**
 * Fold base run stats with active modifiers into the effective block.
 *
 * Per stat: effective = max(0, (base + Σ adds) × Π mults) — adds sum
 * across instances, mults multiply across instances, adds apply before
 * mults.
 *
 * **Identity guarantee:** with no modifiers this returns `base` itself
 * (same object), so the unmodified path is byte-identical and zero-cost.
 * Only the stats a modifier touches are recomputed; the rest keep their
 * base value.
 */
export function foldRunStats(
  base: Readonly<Record<RunStatKey, number>>,
  modifiers: readonly RunStatModifier[],
): Readonly<Record<RunStatKey, number>> {
  if (modifiers.length === 0) return base;

  const adds = new Map<RunStatKey, number>();
  const muls = new Map<RunStatKey, number>();
  for (const mod of modifiers) {
    if (mod.op === 'add') {
      adds.set(mod.stat, (adds.get(mod.stat) ?? 0) + mod.value);
    } else {
      muls.set(mod.stat, (muls.get(mod.stat) ?? 1) * mod.value);
    }
  }

  const out: Record<RunStatKey, number> = { ...base };
  const touched = new Set<RunStatKey>([...adds.keys(), ...muls.keys()]);
  for (const stat of touched) {
    let value = base[stat];
    const add = adds.get(stat);
    if (add !== undefined) value += add;
    const mul = muls.get(stat);
    if (mul !== undefined) value *= mul;
    out[stat] = Math.max(0, value);
  }
  return out;
}
