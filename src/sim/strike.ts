/**
 * The damage trial's draw: on an arm other than `hit`, an evadable strike
 * lands a share of its damage after defense, drawn from the one uniform hit
 * or miss draws, so the strike's mean is the hit chance's share of that
 * damage (`World.applyDamage`; the arms are `STATS.strikeArms`).
 *
 * The share is the Kumaraswamy's inverse CDF, `(1 − (1 − u)^(1/b))^(1/a)`:
 * one uniform a strike, `b` the arm's spread (smaller is wider), and `a`
 * solved so the share's mean is the hit chance. Its mean is `b·B(1 + 1/a,
 * b)`, which rises with `a`, so `a` is found by bisection and cached per
 * hit chance and `b`.
 *
 * The share times the damage is rounded by chance (`roundByChance`) on a
 * second draw, so the mean is exact at every damage size; a strike that
 * rounds to 0 is a miss.
 *
 * An arm that keeps misses (`missesKept`, `s`) misses whole on the
 * uniform's lowest `m = s·(1 − p)`, and feeds the rest, rescaled, to the
 * share at the mean `p / (1 − m)`, so the strike's mean is still `p`. At
 * `s` 1 that is hit or miss.
 *
 * The math uses `Math.pow`, `Math.exp` and `Math.log`, whose last bits the
 * determinism contract does not fix across engines; a run is the same on
 * one engine.
 */

/** ln Γ(z) for z > 0, by Lanczos (g 7, nine coefficients), good to about
 *  1e-15 over the range the solve uses. */
const LANCZOS = [
  0.99999999999980993, 676.5203681218851, -1259.1392167224028, 771.32342877765313, -176.61503916999185,
  12.507343278686905, -0.13857109526572012, 9.9843695780195716e-6, 1.5056327351493116e-7,
];

function lnGamma(z: number): number {
  if (z < 0.5) return Math.log(Math.PI / Math.sin(Math.PI * z)) - lnGamma(1 - z);
  const x = z - 1;
  let sum = LANCZOS[0]!;
  for (let i = 1; i < LANCZOS.length; i++) sum += LANCZOS[i]! / (x + i);
  const t = x + 7.5;
  return 0.5 * Math.log(2 * Math.PI) + (x + 0.5) * Math.log(t) - t + Math.log(sum);
}

/** The Kumaraswamy(a, b) mean, `b·B(1 + 1/a, b)`. */
function kumaraswamyMean(a: number, b: number): number {
  return b * Math.exp(lnGamma(1 + 1 / a) + lnGamma(b) - lnGamma(1 + 1 / a + b));
}

/** `ln a` is searched over [−20, 20]: at the hit chance's floor (0.1) and
 *  the widest arm the root sits well inside, and 80 halvings leave the
 *  interval below a double's resolution. */
const LN_A_LOW = -20;
const LN_A_HIGH = 20;
const BISECTIONS = 80;

const aCache = new Map<number, Map<number, number>>();

/** The `a` that gives Kumaraswamy(a, b) the mean `mean`, for `mean` in
 *  (0, 1). Cached: it is a pure function of its arguments. */
export function kumaraswamyA(mean: number, b: number): number {
  let byMean = aCache.get(b);
  if (byMean === undefined) {
    byMean = new Map();
    aCache.set(b, byMean);
  }
  const cached = byMean.get(mean);
  if (cached !== undefined) return cached;
  let lo = LN_A_LOW;
  let hi = LN_A_HIGH;
  for (let i = 0; i < BISECTIONS; i++) {
    const mid = (lo + hi) / 2;
    if (kumaraswamyMean(Math.exp(mid), b) < mean) lo = mid;
    else hi = mid;
  }
  const a = Math.exp((lo + hi) / 2);
  byMean.set(mean, a);
  return a;
}

/**
 * The share of its damage a strike lands, from its uniform `u` in [0, 1):
 * the Kumaraswamy's inverse with mean `mean`. A mean of 1 or more lands the
 * whole damage, as a hit chance at the cap always hits.
 */
export function strikeShare(u: number, mean: number, b: number): number {
  if (mean >= 1) return 1;
  const a = kumaraswamyA(mean, b);
  return Math.pow(1 - Math.pow(1 - u, 1 / b), 1 / a);
}

/** `x` rounded up with its fraction as the chance, on the uniform `v`:
 *  the result's mean is `x`, so no damage size loses or gains. */
export function roundByChance(x: number, v: number): number {
  const whole = Math.floor(x);
  return whole + (v < x - whole ? 1 : 0);
}
