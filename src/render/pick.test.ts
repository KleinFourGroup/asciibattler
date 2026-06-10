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
