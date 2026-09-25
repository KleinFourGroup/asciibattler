import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { SpriteAnimator } from '../../src/render/animation/SpriteAnimator';
import type { SpriteHandle, SpriteRenderer } from '../../src/render/SpriteRenderer';
import { diagonalHop } from '../../src/dev/boardPanel/hop';
import { fitRig, gridToWorld, hiddenInk, type ClipMove, type DepthRule } from './geometry';
import { CLIP_BOARD, CLIP_GLYPH, CLIP_SHIPPED, CLIP_VIEWPORT, clipCases } from './clip';

/**
 * 108c — THE HOP, the dev dial's rule driven through the real `SpriteAnimator`
 * and measured by the clip instrument. The rule (`diagonalHop`) picks the arc;
 * the animator adds it to the §81c2 ground profile; the instrument casts rays
 * from the glyph's ink at each sampled position against the tile prisms. The
 * measure shares no code with the rule or the animator.
 */

const rig = fitRig(CLIP_SHIPPED, CLIP_BOARD, CLIP_VIEWPORT);
const cases = new Map(clipCases(rig));
const caseOf = (name: string): ClipMove => {
  const m = cases.get(name);
  if (!m) throw new Error(`no clip case ${JSON.stringify(name)}`);
  return m;
};

const DIAGONALS = [
  'S1 diagonal, far corner high (the bug)',
  'S2 diagonal, near corner high (feet behind a step)',
  'S3 diagonal, both corners high',
  'S4 other diagonal, both side corners high',
  'S9 diagonal, cells not in front high',
  'S10 other diagonal, cells not in front high',
  'S1 at the floor band step (0.3)',
];

const STEPS = 20;

/** The animator's positions over one move, sampled at t = k/20 for k = 1..19 (the instrument's grid). */
function animatedPath(m: ClipMove, hop: boolean): THREE.Vector3[] {
  const written: THREE.Vector3[] = [];
  const stub = {
    updateSprite: (_h: SpriteHandle, patch: { position?: THREE.Vector3 }) => {
      if (patch.position) written.push(patch.position.clone());
    },
  } as unknown as SpriteRenderer;
  const animator = new SpriteAnimator(stub);
  const from = gridToWorld(CLIP_BOARD, ...m.from).setY(m.heights(...m.from));
  const to = gridToWorld(CLIP_BOARD, ...m.to).setY(m.heights(...m.to));
  const arc = hop ? diagonalHop(from, to, CLIP_BOARD.w, CLIP_BOARD.h, m.heights) : 0;
  animator.startGroundLerp({ id: 1 }, from, to, 1, arc);
  for (let k = 1; k < STEPS; k++) animator.update(1 / STEPS);
  return written;
}

/** The worst hidden ink over the animated path, against the 7×7 patch around it. */
function worstAnimated(m: ClipMove, rule: DepthRule, hop: boolean): number {
  const cells: [number, number][] = [];
  for (let gy = Math.min(m.from[1], m.to[1]) - 3; gy <= Math.max(m.from[1], m.to[1]) + 3; gy++)
    for (let gx = Math.min(m.from[0], m.to[0]) - 3; gx <= Math.max(m.from[0], m.to[0]) + 3; gx++) cells.push([gx, gy]);
  let worst = 0;
  for (const p of animatedPath(m, hop)) worst = Math.max(worst, hiddenInk(rig, CLIP_BOARD, CLIP_GLYPH, m.heights, p, rule, cells));
  return worst;
}

describe('108c — the diagonal hop (the dev dial), through the animator and the clip instrument', () => {
  it('the rule: known answers, from world positions', () => {
    const at = (gx: number, gy: number, y: number) => gridToWorld(CLIP_BOARD, gx, gy).setY(y);
    const high = (cells: [number, number][], h: number) => (gx: number, gy: number) =>
      cells.some(([x, y]) => x === gx && y === gy) ? h : 0;
    const { w, h } = CLIP_BOARD;
    // A flat diagonal, and a straight move beside a high cell, never hop.
    expect(diagonalHop(at(7, 7, 0), at(8, 8, 0), w, h, () => 0)).toBe(0);
    expect(diagonalHop(at(7, 7, 0), at(8, 7, 0), w, h, high([[7, 8], [8, 8]], 0.4))).toBe(0);
    // A corner 0.4 above both ends: the arc peaks there. Either corner counts.
    expect(diagonalHop(at(7, 7, 0), at(8, 8, 0), w, h, high([[8, 7]], 0.4))).toBeCloseTo(0.4, 12);
    expect(diagonalHop(at(7, 7, 0), at(8, 8, 0), w, h, high([[7, 8]], 0.4))).toBeCloseTo(0.4, 12);
    // Only the part above the higher end; none when an end is as high.
    expect(diagonalHop(at(7, 7, 0), at(8, 8, 0.25), w, h, high([[8, 7]], 0.4))).toBeCloseTo(0.15, 12);
    expect(diagonalHop(at(7, 7, 0.4), at(8, 8, 0), w, h, high([[8, 7]], 0.4))).toBe(0);
    // The two cells off the path's corner vertex are not corners.
    expect(diagonalHop(at(7, 7, 0), at(8, 8, 0), w, h, high([[6, 8], [8, 6]], 0.4))).toBe(0);
    // A settle-back from mid-move is not a whole-tile diagonal.
    expect(diagonalHop(at(7, 7, 0).lerp(at(8, 8, 0), 0.4), at(8, 8, 0), w, h, high([[8, 7]], 0.4))).toBe(0);
  });

  it('the animator stands the glyph on the higher corner at mid-move', () => {
    const m = caseOf('S1 diagonal, far corner high (the bug)');
    const path = animatedPath(m, true);
    expect(path).toHaveLength(STEPS - 1);
    const corner = Math.max(m.heights(m.to[0], m.from[1]), m.heights(m.from[0], m.to[1]));
    expect(path[STEPS / 2 - 1]!.y).toBeCloseTo(corner, 9);
  });

  it('CONTROLS, without the hop: the card rule hides half the glyph, and upright depth leaves the squeeze', () => {
    expect(worstAnimated(caseOf('S1 diagonal, far corner high (the bug)'), 'card', false)).toBeGreaterThan(0.4);
    expect(worstAnimated(caseOf('S4 other diagonal, both side corners high'), 'upright', false)).toBeGreaterThan(0.1);
    expect(worstAnimated(caseOf('S2 diagonal, near corner high (feet behind a step)'), 'upright', false)).toBeGreaterThan(0);
  });

  it('with the hop, no diagonal hides any ink, under upright depth or the card rule', () => {
    for (const name of DIAGONALS) {
      expect(worstAnimated(caseOf(name), 'upright', true), name).toBe(0);
      expect(worstAnimated(caseOf(name), 'card', true), name).toBe(0);
    }
  });
});
