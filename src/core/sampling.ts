/**
 * Deterministic sampling helpers over a seeded `RNG`. Written for the M6
 * procedural map generator (turning config ranges/weights into concrete
 * values), but generic enough for any per-seed sampling.
 *
 * **Fixed draw count.** Every function here consumes EXACTLY ONE `rng.next()`
 * draw, regardless of its arguments (degenerate ranges, zero intensity, etc.
 * still draw once). Callers rely on this: adding or removing a sampled knob
 * shifts the stream by a predictable single draw rather than an unknown amount,
 * which keeps the fuzz-replay re-baselining easy to reason about.
 */
import type { RNG } from './RNG';

const clamp01 = (v: number): number => Math.min(1, Math.max(0, v));

/**
 * Pick a key from a weight map, with probability proportional to its weight.
 * Assumes at least one positive weight (config-validated). Iteration order is
 * sorted by key — numerically when every key parses as a number, else
 * lexicographically — so the result depends only on the weights + seed, never
 * on the JSON's key order.
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
 * Sample a value in `[min, max]` with one uniform draw. Bare → uniform. With
 * `center` + `intensity` (0..1), biases toward `center` by blending the uniform
 * sample with a triangular one peaked at `center`: intensity 0 = uniform, 1 =
 * full triangular peak. `center` is the MODE (the value it clusters around),
 * not the mean — skewing it leaves the mean drifting toward the midpoint. The
 * result is always within `[min, max]`.
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
