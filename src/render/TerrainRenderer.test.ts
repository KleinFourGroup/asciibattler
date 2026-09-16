/**
 * 98e — the tile kind → `aAnim.x` mapping, pinned. `animTypeFor` is the ONE
 * place a kind picks its fragment-shader branch (the terrain and the apron
 * each carried a private ternary before 98e); the expected table is a
 * `Record<TileKind, number>` so a new kind fails tsc here until it is
 * placed. The shader side is eyeball-only (TESTING.md's render policy).
 */

import { describe, expect, it } from 'vitest';
import type { TileKind } from '../sim/TileGrid';
import {
  ANIM_DEEP_WATER,
  ANIM_FIRE,
  ANIM_HEALING,
  ANIM_NONE,
  animTypeFor,
} from './TerrainRenderer';

const EXPECTED: Record<TileKind, number> = {
  floor: ANIM_NONE,
  shallow_water: ANIM_NONE,
  chasm: ANIM_NONE,
  fire: ANIM_FIRE,
  healing: ANIM_HEALING,
  deep_water: ANIM_DEEP_WATER, // 98e — the static bands, the passability tell
  hills: ANIM_NONE,
  ice: ANIM_NONE,
  sand: ANIM_NONE,
  mud: ANIM_NONE,
};

describe('98e — animTypeFor', () => {
  it('maps every tile kind to its shader branch', () => {
    for (const [kind, expected] of Object.entries(EXPECTED) as [TileKind, number][]) {
      expect(animTypeFor(kind), kind).toBe(expected);
    }
  });

  it('the branch ids are distinct and ordered as the shader thresholds expect (0 < 1 < 2 < 3)', () => {
    const ids = [ANIM_NONE, ANIM_FIRE, ANIM_HEALING, ANIM_DEEP_WATER];
    expect(ids).toEqual([0, 1, 2, 3]);
  });

  it('deep water is the only kind on the band branch — shallow water stays plain', () => {
    expect(animTypeFor('deep_water')).toBe(ANIM_DEEP_WATER);
    expect(animTypeFor('shallow_water')).toBe(ANIM_NONE);
    const onBands = (Object.keys(EXPECTED) as TileKind[]).filter((k) => animTypeFor(k) === ANIM_DEEP_WATER);
    expect(onBands).toEqual(['deep_water']);
  });
});
