import { describe, expect, it } from 'vitest';
import { PRE_75, fitRig, worstHidden } from './geometry';
import { CLIP_BOARD, CLIP_GLYPH, CLIP_SHIPPED, CLIP_VIEWPORT, clipCases } from './clip';

/**
 * 107d-post — UPRIGHT DEPTH, through the instrument's measure. Since 107d-post
 * a standing glyph is depth-tested as a vertical card through its anchor
 * (billboard.vert.glsl), not as the camera-facing card that leans back by the
 * pitch. The rule the shader implements is `worstHidden(..., 'upright')`; the
 * measure (rays from the ink to the camera against the tile prisms) shares no
 * code with src/render. The shader's own lines are checked in the pane (WORKLOG
 * §107d-post).
 */

const rig = fitRig(CLIP_SHIPPED, CLIP_BOARD, CLIP_VIEWPORT);
const cases = new Map(clipCases(rig));
const measure = (name: string, rule: 'card' | 'upright') => {
  const m = cases.get(name);
  if (!m) throw new Error(`no clip case ${JSON.stringify(name)}`);
  return worstHidden(rig, CLIP_BOARD, CLIP_GLYPH, m, rule).worst;
};

describe('107d-post — a standing glyph is depth-tested upright (shipped camera)', () => {
  it('KNOWN ANSWERS: a flat patch hides nothing; the §81c2 defect is caught and its profile clears it', () => {
    expect(measure('K1 flat, diagonal', 'card')).toBe(0);
    expect(measure('K2 step up, straight-line Y (the §81c2 defect)', 'card')).toBeGreaterThan(0.1);
    expect(measure('K2 step up, the §81c2 profile', 'upright')).toBe(0);
  });

  it('CONTROL — the leaning card: a higher far corner hides over half the ink mid-diagonal (the 107d find)', () => {
    expect(measure('S1 diagonal, far corner high (the bug)', 'card')).toBeGreaterThan(0.5);
  });

  it('upright: no terrain behind the path cuts into the glyph, on either diagonal, at either step', () => {
    for (const name of [
      'S1 diagonal, far corner high (the bug)',
      'S9 diagonal, cells not in front high',
      'S1 at the floor band step (0.3)',
      'S5 at rest, neighbours not in front high',
      'S7 straight +x, cells not in front high',
      'S8 straight +y, cells not in front high',
    ])
      expect(measure(name, 'upright'), name).toBe(0);
  });

  it('upright keeps a step IN FRONT hiding the feet, exactly as the card did', () => {
    const card = measure('S2 diagonal, near corner high (feet behind a step)', 'card');
    expect(card).toBeGreaterThan(0);
    expect(measure('S2 diagonal, near corner high (feet behind a step)', 'upright')).toBe(card);
  });

  it('between two higher side tiles, only their front halves hide the glyph (the squeeze read, ≤ 15 %)', () => {
    const upright = measure('S4 other diagonal, both side corners high', 'upright');
    expect(upright).toBeGreaterThan(0);
    expect(upright).toBeLessThanOrEqual(0.15);
    expect(measure('S4 other diagonal, both side corners high', 'card')).toBeGreaterThan(upright);
  });

  it('the pre-7.5 camera had the same clip (the bug predates the projection)', () => {
    const old = fitRig(PRE_75, CLIP_BOARD, CLIP_VIEWPORT);
    const m = new Map(clipCases(old)).get('S1 diagonal, far corner high (the bug)')!;
    expect(worstHidden(old, CLIP_BOARD, CLIP_GLYPH, m, 'card').worst).toBeGreaterThan(0.4);
  });
});
