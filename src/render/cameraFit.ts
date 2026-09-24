/**
 * 105d — THE camera fit, pure (three.js as TYPES only, no DOM): how far back — or, under
 * an orthographic projection, how wide — the camera must sit for a box around
 * its look-at point to fill the viewport, under any pitch / yaw / FOV.
 *
 * This is the ONE fit (gotcha #52): `Renderer`'s fit mode and scroll mode both
 * call it, and a projection is a branch inside it, never a second function.
 * It generalizes the pre-105d `computeCameraDistance`, whose derivation
 * hard-coded right = (1, 0, 0) (no yaw) and read `camera.fov` (no ortho). At
 * `DEFAULT_CAMERA_VIEW` the result is BIT-identical to that function —
 * `cameraFit.test.ts` pins it against a frozen copy across boards × aspects,
 * with failing controls.
 *
 * Round 7.5's projection spike (§105) is what drives the non-default views,
 * from the dev-only board explorer; players only ever get the default.
 */

import type * as THREE from 'three';

export type CameraProjection = 'perspective' | 'orthographic';

export interface CameraView {
  readonly projection: CameraProjection;
  /** Vertical field of view, degrees. Ignored under `orthographic`. */
  readonly fovDeg: number;
  /** Pitch from horizontal, degrees — 90 would look straight down. */
  readonly pitchDeg: number;
  /** Yaw about world-Y, degrees — positive swings the camera toward +X. */
  readonly yawDeg: number;
}

/** Today's camera: the 45° diorama framing at a 50° lens, square to the board. */
export const DEFAULT_CAMERA_VIEW: CameraView = {
  projection: 'perspective',
  fovDeg: 50,
  pitchDeg: 45,
  yawDeg: 0,
};

export interface CameraFit {
  /** Unit vector from the look-at point TOWARD the camera. */
  readonly dirX: number;
  readonly dirY: number;
  readonly dirZ: number;
  /** Camera distance from the look-at point along `dir`. Under `orthographic`
   *  the distance does not change the picture: it is the 50° perspective fit's
   *  plus enough stand-off to keep the near ground in front of the camera. */
  readonly distance: number;
  /** Half the orthographic frustum's HEIGHT in world units (its half-width is
   *  this × aspect); 0 under `perspective`. */
  readonly orthoHalfHeight: number;
}

/** The two cameras `Renderer` keeps alive — one per projection. */
export type FitCamera = THREE.PerspectiveCamera | THREE.OrthographicCamera;

/**
 * Point `camera` at (targetX, 0, targetZ) from where `fit` says, and give it
 * the lens / frustum the view asks for. The one place a fit becomes a camera,
 * so the headless pin exercises the same lines the Renderer runs.
 */
export function applyCameraFit(
  camera: FitCamera,
  view: CameraView,
  fit: CameraFit,
  aspect: number,
  targetX: number,
  targetZ: number,
): void {
  if ('isPerspectiveCamera' in camera) {
    camera.fov = view.fovDeg;
    camera.aspect = aspect;
  } else {
    camera.left = -fit.orthoHalfHeight * aspect;
    camera.right = fit.orthoHalfHeight * aspect;
    camera.top = fit.orthoHalfHeight;
    camera.bottom = -fit.orthoHalfHeight;
  }
  camera.position.set(
    targetX + fit.distance * fit.dirX,
    fit.distance * fit.dirY,
    targetZ + fit.distance * fit.dirZ,
  );
  camera.lookAt(targetX, 0, targetZ);
  camera.updateProjectionMatrix();
}

const DEG = Math.PI / 180;

/**
 * 107c — a screen-space pan as a world-XZ move of the look-at point: `right`
 * and `up` are screen amounts (W / mouse-near-top is up = +1), turned by the
 * view's yaw. On the ground, screen-up is the camera's `dir` flattened and
 * reversed, (−sinψ, 0, −cosψ), and screen-right is (cosψ, 0, −sinψ) (the basis
 * under `fitCameraToBox`). At yaw 0 this is the pre-107c world-axis pan.
 */
export function panToWorld(view: CameraView, right: number, up: number): { dx: number; dz: number } {
  const yaw = view.yawDeg * DEG;
  const sinY = Math.sin(yaw);
  const cosY = Math.cos(yaw);
  return { dx: right * cosY - up * sinY, dz: -right * sinY - up * cosY };
}

/**
 * Fit the box of half-extents (hx, hy, hz), centred on the look-at point, into
 * a viewport of `aspect` (w / h), with `margin` of breathing room (> 1).
 *
 * Camera basis at pitch θ, yaw ψ (the camera sits at `dir · D`, looking back):
 *   dir   = ( sinψ·cosθ,  sinθ,  cosψ·cosθ)
 *   right = ( cosψ,       0,    −sinψ)
 *   up    = (−sinψ·sinθ,  cosθ, −cosψ·sinθ)
 * For a corner P of the box: its screen coords are P·right and P·up (D
 * cancels), and its depth is D − P·dir. Perspective: |coord| ≤ depth·tan(fov/2)
 * ⇒ D ≥ P·dir + |coord| / tan — the max over 8 corners × 2 axes. Orthographic:
 * the half-height is the max |P·up|, or the max |P·right| / aspect if the width
 * binds first. Translating the look-at point changes nothing — camera and box
 * shift together — which is why scroll mode shares this.
 */
export function fitCameraToBox(
  view: CameraView,
  aspect: number,
  hx: number,
  hy: number,
  hz: number,
  margin: number,
): CameraFit {
  const pitch = view.pitchDeg * DEG;
  const yaw = view.yawDeg * DEG;
  const sinP = Math.sin(pitch);
  const cosP = Math.cos(pitch);
  const sinY = Math.sin(yaw);
  const cosY = Math.cos(yaw);

  const dirX = sinY * cosP;
  const dirY = sinP;
  const dirZ = cosY * cosP;

  // The perspective lens that sets the distance: the view's own, or the
  // default's when the projection has none.
  const fovDeg = view.projection === 'perspective' ? view.fovDeg : DEFAULT_CAMERA_VIEW.fovDeg;
  const fovV = (fovDeg * Math.PI) / 180;
  const tanV = Math.tan(fovV / 2);
  // Through atan and back, as the pre-105d fit wrote it: `tanV * aspect` is the
  // same number on paper and 1 ulp away at some aspects (1919 / 947 — the pin
  // found it), and "unchanged at the default" means the bits.
  const tanH = Math.tan((2 * Math.atan(tanV * aspect)) / 2);

  let maxD = 0;
  let maxUp = 0;
  let maxRight = 0;
  for (const sx of [-1, 1] as const) {
    for (const sy of [-1, 1] as const) {
      for (const sz of [-1, 1] as const) {
        const px = sx * hx;
        const py = sy * hy;
        const pz = sz * hz;
        const along = px * dirX + py * dirY + pz * dirZ;
        const upC = Math.abs(py * cosP - (px * sinY + pz * cosY) * sinP);
        const rightC = Math.abs(px * cosY - pz * sinY);
        const fromHeight = along + upC / tanV;
        const fromWidth = along + rightC / tanH;
        if (fromHeight > maxD) maxD = fromHeight;
        if (fromWidth > maxD) maxD = fromWidth;
        if (upC > maxUp) maxUp = upC;
        if (rightC > maxRight) maxRight = rightC;
      }
    }
  }

  if (view.projection === 'perspective') {
    return { dirX, dirY, dirZ, distance: maxD * margin, orthoHalfHeight: 0 };
  }
  const orthoHalfHeight = Math.max(maxUp, maxRight / aspect) * margin;
  // An orthographic frustum is a slab that starts AT the camera plane, so the
  // ground at the bottom of the screen — `halfHeight / tan θ` nearer than the
  // look-at point — must not fall behind it at a shallow pitch. Standing that
  // much further back costs nothing: the picture does not depend on it.
  return {
    dirX,
    dirY,
    dirZ,
    distance: maxD * margin + orthoHalfHeight / Math.tan(pitch),
    orthoHalfHeight,
  };
}
