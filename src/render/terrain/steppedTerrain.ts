import { createNoise2D } from 'simplex-noise';
import { RNG } from '../../core/RNG';
import { PrismTerrain } from './PrismTerrain';

/**
 * C1c variant C — stepped simplex: same height field as variant B, but
 * snapped to a small set of discrete plateaus. Trades organic gradients
 * for crisp terrace silhouettes. Water tiles forced to the lowest step.
 */

const STEPS = [-0.30, -0.20, -0.10, 0.0] as const;
const WATER_TOP_Y = -0.4;
const NOISE_FREQ = 0.35;
const NOISE_SEED = 0xc1c1c1c;

export function createSteppedTerrain(gridSize: number): PrismTerrain {
  const rng = new RNG(NOISE_SEED);
  const noise2D = createNoise2D(() => rng.next());

  return new PrismTerrain({
    label: 'Stepped simplex',
    gridSize,
    heightFn: (cx, cy, kind) => {
      if (kind === 'shallow_water') return WATER_TOP_Y;
      const n = noise2D(cx * NOISE_FREQ, cy * NOISE_FREQ); // [-1, 1]
      const t = (n + 1) * 0.5;
      const idx = Math.min(STEPS.length - 1, Math.floor(t * STEPS.length));
      return STEPS[idx]!;
    },
  });
}
