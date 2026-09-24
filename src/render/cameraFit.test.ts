import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import {
  DEFAULT_CAMERA_VIEW,
  applyCameraFit,
  fitCameraToBox,
  panToWorld,
  type CameraView,
  type FitCamera,
} from './cameraFit';

/**
 * 105d — THE FIT ORACLE. `fitCameraToBox` replaced `Renderer`'s
 * `computeCameraDistance` inside the phase's one production seam, under the
 * scope guard "pinned unchanged at the default". Three instruments, none of
 * which consults the code under test for its expectation:
 *
 *  1. the FROZEN function — `computeCameraDistance` copied verbatim from
 *     `Renderer.ts` at `fa4f51b` (the last commit before the seam), compared
 *     with `toBe`: bit-identity, boards × aspects, fit AND scroll boxes;
 *  2. its FAILING CONTROLS — one degree of pitch / FOV / yaw must break (1) on
 *     every case, or (1) is a shape that never met the code;
 *  3. a PROPERTY read through three.js's own projection — at margin 1 every
 *     corner of the box lands inside the frame and one touches its edge, under
 *     the whole cross (perspective × a long lens × orthographic; pitch both
 *     ways; yaw). This is the half of the fit no frozen function can vouch for.
 *
 * (The live half — the Renderer's camera matrices before / after the seam, in
 * the browser — and the cross-check against the 105a instrument's independent
 * fit are in WORKLOG §105d and `tests/board/cameraFit.test.ts`.)
 */

/** VERBATIM from src/render/Renderer.ts @ fa4f51b (`this.camera.fov` /
 *  `.aspect` / `CAMERA_PITCH_RAD` lifted to parameters; `FIT_MARGIN` applied by
 *  the caller there, here). Do not "tidy" it — it is the reference. */
function computeCameraDistanceAtHead(
  fovDeg: number,
  aspect: number,
  hx: number,
  hy: number,
  hz: number,
): number {
  const CAMERA_PITCH_RAD = Math.PI / 4;
  const FIT_MARGIN = 1.05;
  const fovV = (fovDeg * Math.PI) / 180;
  const fovH = 2 * Math.atan(Math.tan(fovV / 2) * aspect);
  const sinP = Math.sin(CAMERA_PITCH_RAD);
  const cosP = Math.cos(CAMERA_PITCH_RAD);
  const tanV = Math.tan(fovV / 2);
  const tanH = Math.tan(fovH / 2);

  let maxD = 0;
  for (const sx of [-1, 1] as const) {
    for (const sy of [-1, 1] as const) {
      for (const sz of [-1, 1] as const) {
        const px = sx * hx;
        const py = sy * hy;
        const pz = sz * hz;
        const lateral = py * sinP + pz * cosP;
        const upC = py * cosP - pz * sinP;
        const fromHeight = lateral + Math.abs(upC) / tanV;
        const fromWidth = lateral + Math.abs(px) / tanH;
        if (fromHeight > maxD) maxD = fromHeight;
        if (fromWidth > maxD) maxD = fromWidth;
      }
    }
  }
  return maxD * FIT_MARGIN;
}

const MARGIN = 1.05;

/** The frozen function's view: the default until 107d. */
const PRE_75_VIEW: CameraView = { projection: 'perspective', fovDeg: 50, pitchDeg: 45, yawDeg: 0 };

/** (hx, hy, hz): every authored board size + the procedural extremes, padded
 *  as `Renderer` pads them, and scroll mode's fixed 12-tile window. */
const BOXES: readonly (readonly [string, number, number, number])[] = [
  ...(
    [
      [12, 12],
      [15, 15],
      [14, 12],
      [12, 32],
      [24, 24],
      [32, 12],
    ] as const
  ).map(([w, h]) => [`fit ${w}x${h}`, w / 2 + 0.5, 1, h / 2 + 0.5] as const),
  ['scroll window', 6, 1, 6],
];

const ASPECTS: readonly number[] = [
  16 / 9,
  2560 / 1440,
  1280 / 720,
  4 / 3,
  1024 / 768,
  21 / 9,
  1,
  0.8,
  9 / 16,
  1.2345,
  1919 / 947,
];

describe('fitCameraToBox — the pre-7.5 view is the pre-105d fit, bit for bit', () => {
  it('the shipped default is the signed view (spec D1): ortho · pitch 45 · yaw 45', () => {
    // A tripwire, not a probe: changing the shipped camera is a design call.
    expect(DEFAULT_CAMERA_VIEW).toEqual({ projection: 'orthographic', fovDeg: 50, pitchDeg: 45, yawDeg: 45 });
  });

  it('equals the frozen computeCameraDistance on every box × aspect', () => {
    let cases = 0;
    for (const [name, hx, hy, hz] of BOXES) {
      for (const aspect of ASPECTS) {
        const fit = fitCameraToBox(PRE_75_VIEW, aspect, hx, hy, hz, MARGIN);
        const ref = computeCameraDistanceAtHead(50, aspect, hx, hy, hz);
        expect(fit.distance, `${name} @ ${aspect}`).toBe(ref);
        cases++;
      }
    }
    expect(cases).toBe(BOXES.length * ASPECTS.length);
  });

  it('points the camera where HEAD did: (0, D·sin 45°, D·cos 45°), no ortho frustum', () => {
    const fit = fitCameraToBox(PRE_75_VIEW, 16 / 9, 8, 1, 8, MARGIN);
    expect(fit.dirX).toBe(0);
    expect(fit.dirY).toBe(Math.sin(Math.PI / 4));
    expect(fit.dirZ).toBe(Math.cos(Math.PI / 4));
    expect(fit.orthoHalfHeight).toBe(0);
  });

  it('the applied camera sits exactly where HEAD put it, in fit and in scroll', () => {
    const camera = new THREE.PerspectiveCamera(50, 1, 0.1, 1000);
    const head = new THREE.PerspectiveCamera(50, 1, 0.1, 1000);
    const sinP = Math.sin(Math.PI / 4);
    const cosP = Math.cos(Math.PI / 4);
    for (const [tx, tz] of [
      [0, 0],
      [2.25, -3.5],
    ] as const) {
      for (const aspect of ASPECTS) {
        const fit = fitCameraToBox(PRE_75_VIEW, aspect, 6, 1, 6, MARGIN);
        applyCameraFit(camera, PRE_75_VIEW, fit, aspect, tx, tz);
        // HEAD's fitCameraScroll + handleResize, restated (fit mode is tx = tz = 0).
        const D = computeCameraDistanceAtHead(50, aspect, 6, 1, 6);
        head.aspect = aspect;
        head.updateProjectionMatrix();
        head.position.set(tx, D * sinP, tz + D * cosP);
        head.lookAt(tx, 0, tz);
        expect(camera.position.toArray()).toEqual(head.position.toArray());
        expect(camera.quaternion.toArray()).toEqual(head.quaternion.toArray());
        expect(camera.projectionMatrix.elements).toEqual(head.projectionMatrix.elements);
      }
    }
  });

  it('CONTROL — one degree of pitch, FOV or yaw breaks the identity on every case', () => {
    const nudges: readonly CameraView[] = [
      { ...PRE_75_VIEW, pitchDeg: 46 },
      { ...PRE_75_VIEW, fovDeg: 51 },
      { ...PRE_75_VIEW, yawDeg: 1 },
    ];
    for (const view of nudges) {
      let equal = 0;
      for (const [, hx, hy, hz] of BOXES) {
        for (const aspect of ASPECTS) {
          const fit = fitCameraToBox(view, aspect, hx, hy, hz, MARGIN);
          if (fit.distance === computeCameraDistanceAtHead(50, aspect, hx, hy, hz)) equal++;
        }
      }
      expect(equal, JSON.stringify(view)).toBe(0);
    }
  });
});

describe('fitCameraToBox — the box fills the frame under every view of the cross', () => {
  const VIEWS: CameraView[] = [];
  for (const projection of ['perspective', 'orthographic'] as const) {
    for (const fovDeg of projection === 'perspective' ? [50, 20, 10] : [50]) {
      for (const pitchDeg of [25, 45, 60, 80]) {
        for (const yawDeg of [0, 45, -30, 90]) {
          VIEWS.push({ projection, fovDeg, pitchDeg, yawDeg });
        }
      }
    }
  }

  const cameraFor = (view: CameraView): FitCamera =>
    view.projection === 'perspective'
      ? new THREE.PerspectiveCamera(1, 1, 0.1, 5000)
      : new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 5000);

  /** The largest |NDC x| and |NDC y| over the box's 8 corners, by three's own
   *  projection — the surface `fitCameraToBox` does not consult. */
  const extent = (
    camera: FitCamera,
    hx: number,
    hy: number,
    hz: number,
  ): { x: number; y: number } => {
    camera.updateMatrixWorld(true);
    camera.matrixWorldInverse.copy(camera.matrixWorld).invert();
    const p = new THREE.Vector3();
    let x = 0;
    let y = 0;
    for (const sx of [-1, 1]) {
      for (const sy of [-1, 1]) {
        for (const sz of [-1, 1]) {
          p.set(sx * hx, sy * hy, sz * hz).project(camera);
          x = Math.max(x, Math.abs(p.x));
          y = Math.max(y, Math.abs(p.y));
        }
      }
    }
    return { x, y };
  };

  it('at margin 1 no corner leaves the frame and the binding axis touches its edge', () => {
    let cases = 0;
    for (const view of VIEWS) {
      for (const [, hx, hy, hz] of BOXES) {
        for (const aspect of [16 / 9, 1, 9 / 16]) {
          const camera = cameraFor(view);
          applyCameraFit(camera, view, fitCameraToBox(view, aspect, hx, hy, hz, 1), aspect, 0, 0);
          const e = extent(camera, hx, hy, hz);
          const label = `${JSON.stringify(view)} ${hx}x${hz} @ ${aspect}`;
          expect(e.x, label).toBeLessThanOrEqual(1 + 1e-9);
          expect(e.y, label).toBeLessThanOrEqual(1 + 1e-9);
          expect(Math.max(e.x, e.y), label).toBeCloseTo(1, 9);
          cases++;
        }
      }
    }
    expect(cases).toBe(VIEWS.length * BOXES.length * 3);
  });

  it('CONTROL — a fit made for one yaw does not fill the frame at another', () => {
    // Under a lens: an ortho picture ignores the distance this swaps in.
    const made: CameraView = { ...PRE_75_VIEW, yawDeg: 0 };
    const shown: CameraView = { ...PRE_75_VIEW, yawDeg: 45 };
    const camera = cameraFor(shown);
    const fit = fitCameraToBox(made, 16 / 9, 6.5, 1, 16.5, 1);
    const turned = fitCameraToBox(shown, 16 / 9, 6.5, 1, 16.5, 1);
    applyCameraFit(camera, shown, { ...turned, distance: fit.distance }, 16 / 9, 0, 0);
    const e = extent(camera, 6.5, 1, 16.5);
    expect(Math.abs(Math.max(e.x, e.y) - 1)).toBeGreaterThan(1e-3);
  });

  it('the margin is breathing room: at 1.05 every corner is strictly inside', () => {
    for (const view of VIEWS) {
      const camera = cameraFor(view);
      applyCameraFit(
        camera,
        view,
        fitCameraToBox(view, 16 / 9, 12.5, 1, 12.5, MARGIN),
        16 / 9,
        0,
        0,
      );
      const e = extent(camera, 12.5, 1, 12.5);
      expect(Math.max(e.x, e.y), JSON.stringify(view)).toBeLessThan(1);
    }
  });

  it('orthographic: the ground at the bottom of the screen is in front of the camera plane', () => {
    // An ortho frustum starts AT the camera plane. Unproject the near plane's
    // bottom-centre: if that point is above every glyph top (y > 1), the view
    // ray from it meets the units and the ground further on, inside the slab.
    const p = new THREE.Vector3();
    for (const view of VIEWS.filter((v) => v.projection === 'orthographic')) {
      for (const [, hx, hy, hz] of BOXES) {
        const camera = cameraFor(view);
        applyCameraFit(
          camera,
          view,
          fitCameraToBox(view, 16 / 9, hx, hy, hz, MARGIN),
          16 / 9,
          0,
          0,
        );
        camera.updateMatrixWorld(true);
        p.set(0, -1, -1).unproject(camera);
        expect(p.y, `${JSON.stringify(view)} ${hx}x${hz}`).toBeGreaterThan(1);
      }
    }
  });

  it('CONTROL — without the stand-off a shallow ortho view puts that ground behind the camera', () => {
    const view: CameraView = { ...DEFAULT_CAMERA_VIEW, projection: 'orthographic', pitchDeg: 15 };
    const fit = fitCameraToBox(view, 16 / 9, 12.5, 1, 12.5, MARGIN);
    const bare = fit.distance - fit.orthoHalfHeight / Math.tan((15 * Math.PI) / 180);
    const camera = cameraFor(view);
    applyCameraFit(camera, view, { ...fit, distance: bare }, 16 / 9, 0, 0);
    camera.updateMatrixWorld(true);
    expect(new THREE.Vector3(0, -1, -1).unproject(camera).y).toBeLessThan(1);
  });

  it('orthographic ignores the view’s fovDeg; perspective has no ortho frustum', () => {
    const ortho: CameraView = { ...DEFAULT_CAMERA_VIEW, projection: 'orthographic' };
    expect(fitCameraToBox({ ...ortho, fovDeg: 10 }, 1.5, 8, 1, 8, MARGIN)).toEqual(
      fitCameraToBox(ortho, 1.5, 8, 1, 8, MARGIN),
    );
    expect(fitCameraToBox(ortho, 1.5, 8, 1, 8, MARGIN).orthoHalfHeight).toBeGreaterThan(0);
  });
});

/**
 * 107c — the dev scroll pan moves the picture along the SCREEN's axes at any
 * yaw. Read through three's own projection, which `panToWorld` does not
 * consult: pan the look-at point by `panToWorld(view, 0, 1)` (W) and the point
 * that was at the centre of the screen must now sit straight below it (NDC
 * x = 0, y < 0); pan by `(1, 0)` (D) and it sits straight left (y = 0, x < 0).
 */
describe('panToWorld — a screen pan moves the picture along the screen axes', () => {
  const oldCentreAfterPan = (view: CameraView, dx: number, dz: number): THREE.Vector3 => {
    const camera: FitCamera =
      view.projection === 'perspective'
        ? new THREE.PerspectiveCamera(1, 1, 0.1, 5000)
        : new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 5000);
    applyCameraFit(camera, view, fitCameraToBox(view, 16 / 9, 6, 1, 6, MARGIN), 16 / 9, dx, dz);
    camera.updateMatrixWorld(true);
    camera.matrixWorldInverse.copy(camera.matrixWorld).invert();
    return new THREE.Vector3(0, 0, 0).project(camera);
  };

  it('W leaves the old centre straight below, D straight left — every yaw, both projections', () => {
    let cases = 0;
    for (const projection of ['perspective', 'orthographic'] as const) {
      for (const yawDeg of [0, 30, 45, -45, 90, 135]) {
        const view: CameraView = { projection, fovDeg: 50, pitchDeg: 45, yawDeg };
        const w = panToWorld(view, 0, 1);
        const d = panToWorld(view, 1, 0);
        const afterW = oldCentreAfterPan(view, w.dx, w.dz);
        const afterD = oldCentreAfterPan(view, d.dx, d.dz);
        const label = JSON.stringify(view);
        expect(Math.abs(afterW.x), label).toBeLessThan(1e-9);
        expect(afterW.y, label).toBeLessThan(-1e-3);
        expect(Math.abs(afterD.y), label).toBeLessThan(1e-9);
        expect(afterD.x, label).toBeLessThan(-1e-3);
        expect(Math.hypot(w.dx, w.dz), label).toBeCloseTo(1, 12);
        cases++;
      }
    }
    expect(cases).toBe(12);
  });

  it('at yaw 0 it is the pre-107c world-axis pan: W → −Z, D → +X', () => {
    const view: CameraView = { projection: 'perspective', fovDeg: 50, pitchDeg: 45, yawDeg: 0 };
    const w = panToWorld(view, 0, 1);
    const d = panToWorld(view, 1, 0);
    expect(w.dx).toBeCloseTo(0, 15);
    expect(w.dz).toBe(-1);
    expect(d.dx).toBe(1);
    expect(d.dz).toBeCloseTo(0, 15);
  });

  it('CONTROL — the world-axis pan (W → −Z) moves the picture diagonally at yaw 45', () => {
    const view: CameraView = { projection: 'orthographic', fovDeg: 50, pitchDeg: 45, yawDeg: 45 };
    expect(Math.abs(oldCentreAfterPan(view, 0, -1).x)).toBeGreaterThan(1e-2);
  });
});
