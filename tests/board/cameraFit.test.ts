import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { applyCameraFit, fitCameraToBox, type CameraView } from '../../src/render/cameraFit';
import {
  BOARDS,
  FIT_MARGIN,
  VIEWPORTS,
  XZ_PADDING,
  Y_HALF_EXTENT,
  fitRig,
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
