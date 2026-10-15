/**
 * Sampling over a seeded `RNG`: a config's ranges and weights turned into
 * values.
 *
 * Every function here takes exactly one `rng.next()`, whatever its
 * arguments; a degenerate range or a zero intensity still draws once.
 * Callers rely on it: adding or removing a sampled knob moves the stream by
 * one draw, not by an amount that depends on the values.
 */
import type { RNG } from './RNG';

const clamp01 = (v: number): number => Math.min(1, Math.max(0, v));

/**
 * A key from a weight map, with probability proportional to its weight.
 * Expects at least one positive weight, which the config's schema ensures.
 * The keys are walked in sorted order, numerically when both keys of a
 * comparison parse as numbers and lexically otherwise, so the result depends
 * on the weights and the seed, never on the JSON's key order.
 */
export function weightedPick<K extends string>(rng: RNG, weights: Record<K, number>): K {
  const entries = orderedEntries(weights as Record<string, number>);
  let total = 0;
  for (const [, w] of entries) total += w;
  let r = rng.next() * total;
  for (const [key, w] of entries) {
    r -= w;
    if (r < 0) return key as K;
  }
  // Float-rounding fallback: the last key carrying positive weight.
  for (let i = entries.length - 1; i >= 0; i--) {
    if (entries[i]![1] > 0) return entries[i]![0] as K;
  }
  return entries[0]![0] as K;
}

function orderedEntries(weights: Record<string, number>): Array<[string, number]> {
  return Object.entries(weights).sort(([a], [b]) => {
    const na = Number(a);
    const nb = Number(b);
    if (a !== '' && b !== '' && Number.isFinite(na) && Number.isFinite(nb)) return na - nb;
    return a < b ? -1 : a > b ? 1 : 0;
  });
}

/**
 * A value in `[min, max]` from one draw, uniform by default. With `center`
 * and `intensity` (0 to 1) the uniform sample is blended toward a
 * triangular one peaked at `center`: 0 is uniform, 1 the full triangle.
 * `center` is the mode, the value samples cluster around, not the mean; an
 * off-centre mode leaves the mean between it and the midpoint.
 */
export function sampleRange(
  rng: RNG,
  min: number,
  max: number,
  center?: number,
  intensity?: number,
): number {
  const u = rng.next();
  if (max <= min) return min;
  if (center === undefined || intensity === undefined || intensity <= 0) {
    return min + u * (max - min);
  }
  const c = clamp01((center - min) / (max - min));
  const s = clamp01(intensity);
  // Inverse-CDF of a triangular distribution peaked at fraction `c`, then
  // lerped back toward the uniform sample by (1 - s).
  const tri = u < c ? Math.sqrt(u * c) : 1 - Math.sqrt((1 - u) * (1 - c));
  const t = u + s * (tri - u);
  return min + t * (max - min);
}

/** As `sampleRange`, rounded to the nearest integer (still one draw). */
export function sampleIntRange(
  rng: RNG,
  min: number,
  max: number,
  center?: number,
  intensity?: number,
): number {
  return Math.round(sampleRange(rng, min, max, center, intensity));
}
