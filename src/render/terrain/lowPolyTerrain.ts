import { createNoise2D } from 'simplex-noise';
import { RNG } from '../../core/RNG';
import { PrismTerrain } from './PrismTerrain';

/**
 * C1c variant B — faceted low-poly: continuous simplex height variation,
 * water sunk deeper. Heights are pure functions of (cx, cy) so the look
 * is identical between battles — that's deliberate, we're locking the
 * visual direction, not procedural variety.
 */

const WATER_TOP_Y = -0.4;
const FLOOR_RANGE_LO = -0.3;
const FLOOR_RANGE_HI = 0.0;
const NOISE_FREQ = 0.42;
/** Fixed seed: the visual character is part of the variant identity, not a per-battle roll. */
const NOISE_SEED = 0xb1c1a1b;

export function createLowPolyTerrain(gridSize: number): PrismTerrain {
  const rng = new RNG(NOISE_SEED);
  const noise2D = createNoise2D(() => rng.next());

  return new PrismTerrain({
    label: 'Faceted low-poly',
    gridSize,
    heightFn: (cx, cy, kind) => {
      if (kind === 'shallow_water') return WATER_TOP_Y;
      const n = noise2D(cx * NOISE_FREQ, cy * NOISE_FREQ); // [-1, 1]
      const t = (n + 1) * 0.5;
      return FLOOR_RANGE_LO + (FLOOR_RANGE_HI - FLOOR_RANGE_LO) * t;
    },
  });
}
