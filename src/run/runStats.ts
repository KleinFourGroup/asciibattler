/**
 * The run's stats and their fold. A daemon's `modifier` rule adds to or
 * multiplies one of these keys, and readers take the folded value at use
 * time (`Run.effectiveRunStats`), derived on each call and never cached or
 * saved, so a change of ownership is right at once.
 *
 * The fold is the sim's `foldEffects` (`src/sim/statusEffects.ts`) with two
 * differences:
 * - no rounding: `bitsGain` is a multiplier, so rounding belongs to the
 *   reader (a bits grant rounds the amount, a slot count is floored);
 * - no magnitude: a modifier carries a plain value, and stacking comes from
 *   owning several daemons.
 */

import { RECRUITMENT } from '../config/recruitment';
import { DECK } from '../config/deck';
import { NODE_MAP } from '../config/nodemap';

/** The run-stat keys, a tuple so the daemon schema's enum and this type share
 *  one source. */
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

/** Each stat's value before any modifier. A base that is a config value reads
 *  the config, so it has one source. */
export const RUN_STAT_BASES: Readonly<Record<RunStatKey, number>> = {
  /** The multiplier on every bits grant; 1 changes nothing. */
  bitsGain: 1,
  /** The packet cache's slots. */
  cacheSize: 6,
  /** The post-battle recruit offer's slots (The Cornucopia adds 1). A port's
   *  unit count is not this stat but `PRICES.portStock.units`. */
  recruitOfferSize: RECRUITMENT.defaultOfferSize,
  /** The cards drawn into the hand each turn. A lasting draw modifier lands
   *  here; a packet's one-turn draw puts cards in the hand directly and never
   *  touches the fold. */
  drawAmount: DECK.handSize,
  /** The tier weights of a unit offer. Patrician's Seal multiplies the common
   *  weight by 0, and the fold's floor at 0 keeps a weight legal for the
   *  sampler; the tier roll weighs only the tiers that have units, so a
   *  zeroed tier takes no probability from the others. Both the recruit offer
   *  and the port read the fold. */
  rarityWeightCommon: RECRUITMENT.rarityWeights.common,
  rarityWeightUncommon: RECRUITMENT.rarityWeights.uncommon,
  rarityWeightRare: RECRUITMENT.rarityWeights.rare,
  rarityWeightLegendary: RECRUITMENT.rarityWeights.legendary,
  /** The port unit slots whose tier is forced to legendary (the Idol of
   *  Portunus adds 1). Sources stack, and the reader caps the count at the
   *  slot count. */
  portLegendaryOffers: 0,
  /** The chance an event node resolves to a fight instead, rolled before the
   *  event is picked; the fight draws from the sector's pool. The reader
   *  (`Run.effectiveEventCombatChance`) caps it at 1. */
  eventCombatChance: NODE_MAP.eventCombatChance,
};

/** One passive modifier, as authored by a `modifier` rule. */
export interface RunStatModifier {
  readonly stat: RunStatKey;
  readonly op: 'add' | 'mult';
  readonly value: number;
}

/**
 * Fold the base stats with the active modifiers: per stat,
 * `max(0, (base + Σ adds) × Π mults)`, adds before mults.
 *
 * With no modifiers it returns `base` itself, the same object, which
 * `Run.effectiveRarityWeights` tests for to hand back the config's own
 * record. Only the stats a modifier touches are recomputed.
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
