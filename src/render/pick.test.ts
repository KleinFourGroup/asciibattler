import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { pickInstanceAtNdc, type PickCandidate } from './pick';

// The billboard hit-test is pure projection math (no canvas/WebGL), so it IS
// node-testable — set up a real camera and assert clicks resolve. This pins the
// "click the glyph, not the tile behind it" contract the cell-pick can't meet.

function makeCamera(): THREE.PerspectiveCamera {
  // A 45°-ish overhead camera like the battle framing.
  const cam = new THREE.PerspectiveCamera(50, 1, 0.1, 1000);
  cam.position.set(0, 10, 10);
  cam.lookAt(0, 0, 0);
  cam.updateMatrixWorld(true);
  cam.updateProjectionMatrix();
  return cam;
}

/** Where a world point lands in NDC, via the same camera (the "cursor over it"). */
function ndcOf(p: THREE.Vector3, cam: THREE.Camera): { x: number; y: number } {
  const v = p.clone().project(cam);
  return { x: v.x, y: v.y };
}

describe('pickInstanceAtNdc (billboard hit-test)', () => {
  const cam = makeCamera();

  it('selects the candidate the cursor is over', () => {
    const c: PickCandidate = { id: 7, position: new THREE.Vector3(0, 0.5, 0), size: 1 };
    const n = ndcOf(c.position, cam);
    expect(pickInstanceAtNdc([c], n.x, n.y, cam)).toBe(7);
  });

  it('returns null when the cursor is off every billboard', () => {
    const c: PickCandidate = { id: 7, position: new THREE.Vector3(0, 0.5, 0), size: 1 };
    expect(pickInstanceAtNdc([c], 0.97, 0.97, cam)).toBeNull(); // a far screen corner
  });

  it('returns null for an empty candidate list', () => {
    expect(pickInstanceAtNdc([], 0, 0, cam)).toBeNull();
  });

  it('picks the FRONTMOST when two billboards overlap on screen', () => {
    // Two sprites on the same view ray (B placed farther along the ray from the
    // camera through A) project to the same NDC; the nearer one (A) must win.
    const a = new THREE.Vector3(0, 0.5, 0);
    const dir = a.clone().sub(cam.position);
    const b = cam.position.clone().add(dir.multiplyScalar(1.5)); // farther from camera
    const near: PickCandidate = { id: 1, position: a, size: 1 };
    const far: PickCandidate = { id: 2, position: b, size: 1 };
    const n = ndcOf(a, cam);
    // Order the list far-first to prove it's depth, not list order, that decides.
    expect(pickInstanceAtNdc([far, near], n.x, n.y, cam)).toBe(1);
  });

  it('ignores a candidate behind the camera', () => {
    // Same XY as the camera but farther in +Z (behind it, since it looks down -Z).
    const behind: PickCandidate = { id: 9, position: new THREE.Vector3(0, 10, 30), size: 1 };
    // A generous cursor sweep never selects it.
    expect(pickInstanceAtNdc([behind], 0, 0, cam)).toBeNull();
  });
});

// §40e-follow-up — the per-glyph INK rect trims the hit-box to the visible glyph
// (a half-height `▄` rubble slab was clickable a full cell above its ink). An
// ORTHOGRAPHIC camera looking straight down -Z aligns view space with world XY
// (x right, y up), so "top/bottom of the quad" is just world ±y — no perspective
// skew to reason around.
describe('pickInstanceAtNdc — per-glyph ink rect', () => {
  function makeOrthoCamera(): THREE.OrthographicCamera {
    const cam = new THREE.OrthographicCamera(-2, 2, 2, -2, 0.1, 100);
    cam.position.set(0, 0, 10);
    cam.lookAt(0, 0, 0);
    cam.updateMatrixWorld(true);
    cam.updateProjectionMatrix();
    return cam;
  }
  const cam = makeOrthoCamera();
  const at = (x: number, y: number): { x: number; y: number } =>
    ndcOf(new THREE.Vector3(x, y, 0), cam);
  // A size-2 quad at the origin spans world [-1,1] in x and y.
  const base = { id: 1, position: new THREE.Vector3(0, 0, 0), size: 2 } as const;
  const BOTTOM_HALF: PickCandidate = { ...base, ink: { x0: 0, y0: 0, x1: 1, y1: 0.5 } };

  it("a bottom-half ink rect no longer hits the empty TOP of the quad", () => {
    const top = at(0, 0.6); // upper region — inside the quad, above the ink
    // The full quad still hits up there; the bottom-half ink rect does not.
    expect(pickInstanceAtNdc([base], top.x, top.y, cam)).toBe(1);
    expect(pickInstanceAtNdc([BOTTOM_HALF], top.x, top.y, cam)).toBeNull();
  });

  it('a bottom-half ink rect still hits over the visible (bottom) slab', () => {
    const bottom = at(0, -0.6);
    expect(pickInstanceAtNdc([BOTTOM_HALF], bottom.x, bottom.y, cam)).toBe(1);
  });

  it('a width-trimmed ink rect misses the empty side margins but keeps the center', () => {
    const narrow: PickCandidate = { ...base, ink: { x0: 0.25, y0: 0, x1: 0.75, y1: 1 } };
    const side = at(0.9, 0); // near the right edge, outside the trimmed ink
    const center = at(0, 0);
    expect(pickInstanceAtNdc([narrow], side.x, side.y, cam)).toBeNull();
    expect(pickInstanceAtNdc([narrow], center.x, center.y, cam)).toBe(1);
  });

  it('no ink rect (undefined) is identical to the full quad', () => {
    // The default must reproduce the symmetric full-quad box exactly — every
    // corner of a size-2 quad still hits.
    for (const [wx, wy] of [
      [0, 0], [0.9, 0.9], [-0.9, -0.9], [0.9, -0.9], [-0.9, 0.9],
    ] as const) {
      const n = at(wx, wy);
      expect(pickInstanceAtNdc([base], n.x, n.y, cam)).toBe(1);
    }
  });
});
