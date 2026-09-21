import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import {
  BOARDS,
  TODAY,
  VIEWPORTS,
  anchorYFor,
  cameraUpDriftPx,
  clumpAt,
  coveredFractions,
  fitRig,
  gridToWorld,
  leanDeg,
  quadRectPx,
  report,
  toPx,
  worldYDriftPx,
  type Board,
  type View,
  type Viewport,
} from './geometry';

// §105a — the instrument's KNOWN ANSWERS. It reads new data only after it has
// reproduced old data (AGENTS "self-check a new reader against a known answer").
// The strongest are §79b's (archive/post-72-worklog.md:3362-3384): measured on
// the LIVE camera in a real 15×15 battle at 1280×720 — a surface this file
// shares no code with.

const B15: Board = { name: '15x15', w: 15, h: 15 };
const P720: Viewport = { name: '1280x720', w: 1280, h: 720, dpr: 1 };
const ORTHO: View = { projection: { kind: 'orthographic' }, pitchDeg: 45, yawDeg: 0 };
const ORTHO_YAW: View = { projection: { kind: 'orthographic' }, pitchDeg: 45, yawDeg: 45 };

describe("the known answers — §79b's live-camera measurements", () => {
  const rig = fitRig(TODAY, B15, P720);

  it('the grid centre projects to the viewport centre (79b: x = 640 on a 1280 canvas)', () => {
    const c = toPx(rig, new THREE.Vector3(0, 0, 0));
    expect(c.x).toBeCloseTo(640, 6);
  });

  it('a 0.5 world-Y lift skews ±9.1 px at the near-row edges, ±5.0 mid-row, ±3.2 far row; 0 at the centre column', () => {
    // The live probe's tile tops carried terrain height; this model is flat —
    // hence a tolerance, not equality.
    const skew = (gx: number, gy: number): number => worldYDriftPx(rig, gridToWorld(B15, gx, gy), 0.5);
    expect(skew(14, 0)).toBeGreaterThan(0); // sign: outward
    expect(skew(0, 0)).toBeLessThan(0);
    expect(Math.abs(skew(14, 0))).toBeCloseTo(9.1, 0);
    expect(Math.abs(skew(14, 7))).toBeCloseTo(5.0, 0);
    expect(Math.abs(skew(14, 14))).toBeCloseTo(3.2, 0);
    expect(Math.abs(skew(7, 0))).toBeLessThan(1e-6);
  });

  it('the half-quad spans 26.3 px on screen at the near rows', () => {
    const q = quadRectPx(rig, { glyph: 'M', pos: gridToWorld(B15, 7, 0) }, 1, 'today');
    expect((q.y1 - q.y0) / 2).toBeCloseTo(26.3, 0);
  });

  it('a CAMERA-up lift never drifts (anchor.ts, by construction) — under every view', () => {
    for (const view of [TODAY, ORTHO, ORTHO_YAW, { ...TODAY, yawDeg: 45 }, { ...TODAY, pitchDeg: 60 }]) {
      const r = fitRig(view, B15, P720);
      for (const [gx, gy] of [[0, 0], [14, 0], [0, 14], [14, 14]] as const)
        expect(Math.abs(cameraUpDriftPx(r, gridToWorld(B15, gx, gy), 1))).toBeLessThan(1e-6);
    }
  });
});

describe('the closed forms', () => {
  it('perspective: at the centre row the lean is atan(x′·tan pitch), x′ the off-axis tangent (C1\'s derivation)', () => {
    const rig = fitRig(TODAY, B15, P720);
    // A ground point on the look-at row (z = 0 ⇒ view-space y = 0).
    const p = new THREE.Vector3(5, 0, 0);
    const v = p.clone().applyMatrix4(rig.camera.matrixWorldInverse);
    const xPrime = v.x / -v.z;
    const expected = THREE.MathUtils.radToDeg(Math.atan(xPrime * Math.tan(Math.PI / 4)));
    expect(leanDeg(rig, p)).toBeCloseTo(expected, 3);
  });

  it('orthographic: world-up projects to screen-up EVERYWHERE, yawed or not (the future pin)', () => {
    for (const view of [ORTHO, ORTHO_YAW, { ...ORTHO, pitchDeg: 30 }, { ...ORTHO_YAW, pitchDeg: 60 }])
      for (const board of BOARDS) {
        const rig = fitRig(view, board, P720);
        for (const [gx, gy] of [[0, 0], [board.w - 1, 0], [0, board.h - 1], [board.w - 1, board.h - 1]] as const)
          expect(Math.abs(leanDeg(rig, gridToWorld(board, gx, gy)))).toBeLessThan(1e-6);
      }
  });

  it('perspective: it does NOT (the failing control for the pin above)', () => {
    const rig = fitRig(TODAY, B15, P720);
    expect(Math.abs(leanDeg(rig, gridToWorld(B15, 0, 0)))).toBeGreaterThan(5);
  });
});

describe('the anchor, restated', () => {
  it("'today' reproduces the live atlas's two values (measured 2026-09-21: −0.4375 letterforms, −0.5 floor family)", () => {
    for (const g of ['M', 'g', 'a', 'r', '@', '/', 'X', '#']) expect(anchorYFor(g, 'today')).toBeCloseTo(-0.4375, 4);
    for (const g of ['╥', '▄']) expect(anchorYFor(g, 'today')).toBe(-0.5);
  });
});

describe('the fit', () => {
  it('every view × board × viewport keeps the padded frame on screen, and touches an edge (it is a FIT, not a guess)', () => {
    const views: View[] = [TODAY, { ...TODAY, yawDeg: 45 }, { projection: { kind: 'perspective', fovDeg: 20 }, pitchDeg: 60, yawDeg: 0 }, ORTHO, ORTHO_YAW];
    for (const view of views)
      for (const board of BOARDS)
        for (const vp of VIEWPORTS) expect(report(view, board, vp, 1, 'today').fits, `${JSON.stringify(view)} ${board.name} ${vp.name}`).toBe(true);
  });
});

describe('the overlap measure', () => {
  it('is 0 for units too far apart to touch, and > 0 for a clump under an oversized glyph', () => {
    const rig = fitRig(TODAY, B15, P720);
    const apart = [
      { glyph: 'M', pos: gridToWorld(B15, 2, 2) },
      { glyph: 'M', pos: gridToWorld(B15, 12, 12) },
    ];
    expect(coveredFractions(rig, apart, 1, 'today')).toEqual([0, 0]);
    const big = coveredFractions(rig, clumpAt(B15, 7, 7), 2.5, 'today');
    expect(Math.max(...big)).toBeGreaterThan(0.2);
  });

  it('is viewport-independent under orthographic at one aspect (glyph size is world units)', () => {
    const a = report(ORTHO, B15, { name: 'a', w: 1280, h: 720, dpr: 1 }, 1, 'today');
    const b = report(ORTHO, B15, { name: 'b', w: 2560, h: 1440, dpr: 1 }, 1, 'today');
    expect(a.clumpCentreMean).toBeCloseTo(b.clumpCentreMean, 6);
    expect(b.glyphPxCentre / a.glyphPxCentre).toBeCloseTo(2, 6);
  });
});
