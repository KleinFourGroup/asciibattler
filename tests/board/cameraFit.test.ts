import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import {
  DEFAULT_CAMERA_VIEW,
  applyCameraFit,
  fitCameraToBox,
  type CameraView,
} from '../../src/render/cameraFit';
import {
  BOARDS,
  FIT_MARGIN,
  VIEWPORTS,
  XZ_PADDING,
  Y_HALF_EXTENT,
  fitRig,
  gridToWorld,
  type View,
} from './geometry';

/**
 * 105d — THE EYE READS WHAT THE INSTRUMENT MEASURED. 105a's numbers (the lean,
 * the glyph px at fit, the clump overlap) came from `geometry.ts`'s own fit,
 * written a step earlier and importing nothing from `src/render`. The explorer
 * dials the REAL camera through `fitCameraToBox`. If the two disagree, every
 * 105a number is about a camera the user never sees — so this pins the
 * production fit against the instrument's across the whole cross.
 *
 * Two independent derivations (an analytic basis there; three.js's `lookAt`
 * basis here), compared through what matters: the picture. Same world point ⇒
 * same NDC. `geometry.ts` must never be imported INTO src/render — a probe and
 * the code under test may not share a function.
 */

const VIEWS: View[] = [];
for (const projection of [
  { kind: 'perspective', fovDeg: 50 },
  { kind: 'perspective', fovDeg: 20 },
  { kind: 'orthographic' },
] as const) {
  for (const pitchDeg of [30, 45, 60]) {
    for (const yawDeg of [0, 45, -45]) VIEWS.push({ projection, pitchDeg, yawDeg });
  }
}

const toCameraView = (view: View): CameraView => ({
  projection: view.projection.kind,
  fovDeg: view.projection.kind === 'perspective' ? view.projection.fovDeg : 50,
  pitchDeg: view.pitchDeg,
  yawDeg: view.yawDeg,
});

describe('105d — the production fit draws the picture the 105a instrument measured', () => {
  it('every board corner and a lifted point project to the same NDC, across the cross', () => {
    let cases = 0;
    let worst = 0;
    const a = new THREE.Vector3();
    const b = new THREE.Vector3();
    for (const view of VIEWS) {
      for (const board of BOARDS) {
        for (const viewport of VIEWPORTS) {
          const rig = fitRig(view, board, viewport);
          const aspect = viewport.w / viewport.h;
          const cv = toCameraView(view);
          const camera =
            cv.projection === 'perspective'
              ? new THREE.PerspectiveCamera(1, 1, 0.1, 5000)
              : new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 5000);
          const fit = fitCameraToBox(
            cv,
            aspect,
            board.w / 2 + XZ_PADDING,
            Y_HALF_EXTENT,
            board.h / 2 + XZ_PADDING,
            FIT_MARGIN,
          );
          applyCameraFit(camera, cv, fit, aspect, 0, 0);
          camera.updateMatrixWorld(true);
          camera.matrixWorldInverse.copy(camera.matrixWorld).invert();

          for (const [x, y, z] of [
            [board.w / 2, 0, board.h / 2],
            [-board.w / 2, 0, board.h / 2],
            [board.w / 2, 0, -board.h / 2],
            [-board.w / 2, 0, -board.h / 2],
            [0.5, 1, -0.5],
          ] as const) {
            a.set(x, y, z).project(rig.camera);
            b.set(x, y, z).project(camera);
            // x, y = the picture. z (depth) legitimately differs under ortho:
            // the instrument parks its camera at 500, the Renderer nearer.
            worst = Math.max(worst, Math.abs(a.x - b.x), Math.abs(a.y - b.y));
            cases++;
          }
        }
      }
    }
    expect(cases).toBe(VIEWS.length * BOARDS.length * VIEWPORTS.length * 5);
    expect(worst).toBeLessThan(1e-9);
  });

  it('CONTROL — one degree of yaw apart, the two pictures differ', () => {
    const board = BOARDS[0]!;
    const viewport = VIEWPORTS[0]!;
    const rig = fitRig(
      { projection: { kind: 'perspective', fovDeg: 50 }, pitchDeg: 45, yawDeg: 0 },
      board,
      viewport,
    );
    const cv: CameraView = { projection: 'perspective', fovDeg: 50, pitchDeg: 45, yawDeg: 1 };
    const camera = new THREE.PerspectiveCamera(1, 1, 0.1, 5000);
    const aspect = viewport.w / viewport.h;
    applyCameraFit(
      camera,
      cv,
      fitCameraToBox(
        cv,
        aspect,
        board.w / 2 + XZ_PADDING,
        Y_HALF_EXTENT,
        board.h / 2 + XZ_PADDING,
        FIT_MARGIN,
      ),
      aspect,
      0,
      0,
    );
    camera.updateMatrixWorld(true);
    camera.matrixWorldInverse.copy(camera.matrixWorld).invert();
    const a = new THREE.Vector3(board.w / 2, 0, board.h / 2).project(rig.camera);
    const b = new THREE.Vector3(board.w / 2, 0, board.h / 2).project(camera);
    expect(Math.abs(a.x - b.x) + Math.abs(a.y - b.y)).toBeGreaterThan(1e-3);
  });
});

/**
 * §106a — THE LEAN PIN, through the PRODUCTION camera (the Round 7.5 exit's
 * "world-up = screen-up, pinned headless where it holds"). 105a pinned it on
 * the instrument's own rig (geometry.test.ts); the pin above ties that rig to
 * production only transitively. This one asks the camera `fitCameraToBox` +
 * `applyCameraFit` actually build: a world vertical standing on ANY tile draws
 * as a screen vertical — zero NDC-x between its foot and a point above it.
 */
describe('§106a — world-up projects to screen-up through the production camera', () => {
  const cameraFor = (cv: CameraView, board: (typeof BOARDS)[number], aspect: number): THREE.Camera => {
    const camera =
      cv.projection === 'perspective'
        ? new THREE.PerspectiveCamera(1, 1, 0.1, 5000)
        : new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 5000);
    const fit = fitCameraToBox(cv, aspect, board.w / 2 + XZ_PADDING, Y_HALF_EXTENT, board.h / 2 + XZ_PADDING, FIT_MARGIN);
    applyCameraFit(camera, cv, fit, aspect, 0, 0);
    camera.updateMatrixWorld(true);
    camera.matrixWorldInverse.copy(camera.matrixWorld).invert();
    return camera;
  };
  const leanNdc = (camera: THREE.Camera, foot: THREE.Vector3): number => {
    const a = foot.clone().project(camera);
    const b = foot.clone().add(new THREE.Vector3(0, 1, 0)).project(camera);
    return Math.abs(a.x - b.x);
  };

  it('under ortho at pitch 45 and every candidate yaw: zero lean on every tile of every board', () => {
    let tiles = 0;
    let worst = 0;
    for (const yawDeg of [30, 35, 40, 45, -30, -45]) {
      const cv: CameraView = { projection: 'orthographic', fovDeg: 50, pitchDeg: 45, yawDeg };
      for (const board of BOARDS) {
        for (const viewport of [VIEWPORTS[0]!, VIEWPORTS[3]!]) {
          const camera = cameraFor(cv, board, viewport.w / viewport.h);
          for (let gy = 0; gy < board.h; gy++)
            for (let gx = 0; gx < board.w; gx++) {
              worst = Math.max(worst, leanNdc(camera, gridToWorld(board, gx, gy)));
              tiles++;
            }
        }
      }
    }
    expect(tiles).toBe(6 * 2 * BOARDS.reduce((s, b) => s + b.w * b.h, 0));
    expect(worst).toBeLessThan(1e-12);
  });

  it('THE SHIPPED CAMERA: zero lean on every tile of every board, at every viewport', () => {
    let tiles = 0;
    let worst = 0;
    for (const board of BOARDS) {
      for (const viewport of VIEWPORTS) {
        const camera = cameraFor(DEFAULT_CAMERA_VIEW, board, viewport.w / viewport.h);
        for (let gy = 0; gy < board.h; gy++)
          for (let gx = 0; gx < board.w; gx++) {
            worst = Math.max(worst, leanNdc(camera, gridToWorld(board, gx, gy)));
            tiles++;
          }
      }
    }
    expect(tiles).toBe(VIEWPORTS.length * BOARDS.reduce((s, b) => s + b.w * b.h, 0));
    expect(worst).toBeLessThan(1e-12);
  });

  it('CONTROL — the pre-7.5 perspective camera leans at a board corner, through the same path', () => {
    const board = BOARDS[0]!;
    const viewport = VIEWPORTS[0]!;
    const pre75: CameraView = { projection: 'perspective', fovDeg: 50, pitchDeg: 45, yawDeg: 0 };
    const camera = cameraFor(pre75, board, viewport.w / viewport.h);
    expect(leanNdc(camera, gridToWorld(board, 0, 0))).toBeGreaterThan(1e-3);
  });
});
