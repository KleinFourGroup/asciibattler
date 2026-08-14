import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { aboveAnchor } from './anchor';

// §79d — the shared above-the-anchor helper is pure camera math, so the pin
// that kills the off-axis class lives here headlessly: a camera-up lift NEVER
// moves the projected screen X, at any board position (the property the §79b
// probe measured live as exactly 0 across every cell — vs ±9px for the world-Y
// lift this replaces).

function makeCamera(): THREE.PerspectiveCamera {
  // The battle framing: pitched 45°-ish overhead perspective.
  const cam = new THREE.PerspectiveCamera(50, 16 / 9, 0.1, 1000);
  cam.position.set(0, 10, 10);
  cam.lookAt(0, 0, 0);
  cam.updateMatrixWorld(true);
  cam.updateProjectionMatrix();
  return cam;
}

const ndc = (p: THREE.Vector3, cam: THREE.Camera): THREE.Vector3 => p.clone().project(cam);

describe('aboveAnchor (§79d camera-up stacking)', () => {
  const cam = makeCamera();
  const out = new THREE.Vector3();

  it('projects to the SAME screen X as the anchor, everywhere on the board', () => {
    // Far-edge and near-corner anchors — where the world-Y lift skewed worst.
    for (const [x, z] of [
      [0, 0], [7, 7], [-7, 7], [7, -7], [-7, -7], [3, -5],
    ] as const) {
      const anchor = new THREE.Vector3(x, 0.2, z);
      const lifted = aboveAnchor(anchor, 0.5, cam, out).clone();
      const a = ndc(anchor, cam);
      const l = ndc(lifted, cam);
      expect(l.x).toBeCloseTo(a.x, 10); // exactly no horizontal drift
      expect(l.y).toBeGreaterThan(a.y); // and genuinely UP the screen
    }
  });

  it('a world-Y lift does NOT have that property off-center (the class this kills)', () => {
    const anchor = new THREE.Vector3(7, 0.2, 7);
    const worldLifted = anchor.clone().setY(anchor.y + 0.5);
    expect(ndc(worldLifted, cam).x).not.toBeCloseTo(ndc(anchor, cam).x, 3);
  });

  it('lift scales linearly and 0 is the identity', () => {
    const anchor = new THREE.Vector3(2, 0.5, -3);
    expect(aboveAnchor(anchor, 0, cam, out).clone()).toEqual(anchor);
    const one = aboveAnchor(anchor, 1, cam, new THREE.Vector3()).sub(anchor);
    const two = aboveAnchor(anchor, 2, cam, new THREE.Vector3()).sub(anchor);
    expect(two.length()).toBeCloseTo(2 * one.length(), 10);
  });

  it('out may alias anchor', () => {
    const p = new THREE.Vector3(1, 0, 1);
    const expected = aboveAnchor(p, 0.7, cam, new THREE.Vector3()).clone();
    aboveAnchor(p, 0.7, cam, p);
    expect(p.x).toBeCloseTo(expected.x, 12);
    expect(p.y).toBeCloseTo(expected.y, 12);
    expect(p.z).toBeCloseTo(expected.z, 12);
  });
});
