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

/** The launch run-stat keys (content-driven — grown when content demands).
 *  A tuple so the config layer's zod enum and this type share one source. */
export const RUN_STAT_KEYS = ['bitsGain', 'cacheSize'] as const;
export type RunStatKey = (typeof RUN_STAT_KEYS)[number];

/** Base values before any modifier folds. */
export const RUN_STAT_BASES: Readonly<Record<RunStatKey, number>> = {
  /** Multiplier applied to every bits grant (1 = neutral). */
  bitsGain: 1,
  /** Cache slots (spec: base six). Dormant until §49 builds the cache. */
  cacheSize: 6,
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
