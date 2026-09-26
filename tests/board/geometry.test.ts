import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { BASE_ANCHOR_Y } from '../../src/render/glyphs';
import {
  BOARDS,
  PRE_75,
  VIEWPORTS,
  ANCHOR_Y,
  cameraUpDriftPx,
  clumpAt,
  coveredFractions,
  fitRig,
  gridToWorld,
  HEIGHT_PATTERNS,
  inkRectPx,
  leanDeg,
  quadRectPx,
  report,
  RUBBLE_QUARRY,
  RUBBLE_QUARRY_SLABS,
  SLAB_GLYPH,
  slabCase,
  slabCentre,
  slabCentreSlid,
  slabReport,
  slabNearRow,
  toPx,
  worldYDriftPx,
  type Board,
  type SlabReport,
  type SlabRule,
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
  const rig = fitRig(PRE_75, B15, P720);

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
    const q = quadRectPx(rig, { glyph: 'M', pos: gridToWorld(B15, 7, 0) }, 1);
    expect((q.y1 - q.y0) / 2).toBeCloseTo(26.3, 0);
  });

  it('a CAMERA-up lift never drifts (anchor.ts, by construction) — under every view', () => {
    for (const view of [PRE_75, ORTHO, ORTHO_YAW, { ...PRE_75, yawDeg: 45 }, { ...PRE_75, pitchDeg: 60 }]) {
      const r = fitRig(view, B15, P720);
      for (const [gx, gy] of [[0, 0], [14, 0], [0, 14], [14, 14]] as const)
        expect(Math.abs(cameraUpDriftPx(r, gridToWorld(B15, gx, gy), 1))).toBeLessThan(1e-6);
    }
  });
});

describe('the closed forms', () => {
  it('perspective: at the centre row the lean is atan(x′·tan pitch), x′ the off-axis tangent (C1\'s derivation)', () => {
    const rig = fitRig(PRE_75, B15, P720);
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
    const rig = fitRig(PRE_75, B15, P720);
    expect(Math.abs(leanDeg(rig, gridToWorld(B15, 0, 0)))).toBeGreaterThan(5);
  });
});

describe('the anchor, restated', () => {
  it("is production's: every base sprite stands on its quad bottom (render/glyphs.ts BASE_ANCHOR_Y)", () => {
    expect(ANCHOR_Y).toBe(BASE_ANCHOR_Y);
  });
});

describe('the fit', () => {
  it('every view × board × viewport keeps the padded frame on screen, and touches an edge (it is a FIT, not a guess)', () => {
    const views: View[] = [PRE_75, { ...PRE_75, yawDeg: 45 }, { projection: { kind: 'perspective', fovDeg: 20 }, pitchDeg: 60, yawDeg: 0 }, ORTHO, ORTHO_YAW];
    for (const view of views)
      for (const board of BOARDS)
        for (const vp of VIEWPORTS) expect(report(view, board, vp, 1).fits, `${JSON.stringify(view)} ${board.name} ${vp.name}`).toBe(true);
  });
});

describe('the overlap measure', () => {
  it('is 0 for units too far apart to touch, and > 0 for a clump under an oversized glyph', () => {
    const rig = fitRig(PRE_75, B15, P720);
    const apart = [
      { glyph: 'M', pos: gridToWorld(B15, 2, 2) },
      { glyph: 'M', pos: gridToWorld(B15, 12, 12) },
    ];
    expect(coveredFractions(rig, apart, 1)).toEqual([0, 0]);
    const big = coveredFractions(rig, clumpAt(B15, 7, 7), 2.5);
    expect(Math.max(...big)).toBeGreaterThan(0.2);
  });

  it('is viewport-independent under orthographic at one aspect (glyph size is world units)', () => {
    const a = report(ORTHO, B15, { name: 'a', w: 1280, h: 720, dpr: 1 }, 1);
    const b = report(ORTHO, B15, { name: 'b', w: 2560, h: 1440, dpr: 1 }, 1);
    expect(a.clumpCentreMean).toBeCloseTo(b.clumpCentreMean, 6);
    expect(b.glyphPxCentre / a.glyphPxCentre).toBeCloseTo(2, 6);
  });
});

// §106a — THE N×N SLAB UNDER YAW (geometry.ts §106a). The §105 verdict's
// screenshot — 2×2 rubble askew on its diamond, off its plot, the bottom
// clipped — is the FAILING CONTROL; the rule 106b builds must pass the same
// three measures. Swept over rubbleQuarry's five real slabs × every tile-height
// pattern, at the user's 2560×1440 (only the fit's px scale depends on it).
describe('§106a — the N×N slab under yaw', () => {
  const vp = VIEWPORTS[0]!;
  const ortho = (yawDeg: number): View => ({ projection: { kind: 'orthographic' }, pitchDeg: 45, yawDeg });
  const lens20 = (yawDeg: number): View => ({ projection: { kind: 'perspective', fovDeg: 20 }, pitchDeg: 45, yawDeg });
  const CANDIDATE_YAWS = [30, 35, 40, 45, -30, -45];

  const sweep = (view: View, rule: SlabRule, mounds = false): (SlabReport & { what: string })[] => {
    const rig = fitRig(view, RUBBLE_QUARRY, vp);
    const out: (SlabReport & { what: string })[] = [];
    for (const s of RUBBLE_QUARRY_SLABS)
      for (const pattern of Object.keys(HEIGHT_PATTERNS)) {
        const r = slabReport(rig, slabCase(RUBBLE_QUARRY, s.gx, s.gy, s.n, pattern, mounds), rule);
        out.push({ ...r, what: `${JSON.stringify(view)} ${s.n}x${s.n}@(${s.gx},${s.gy}) ${pattern}${mounds ? ' +mounds' : ''}` });
      }
    return out;
  };

  it('KNOWN ANSWER — the near-row rule where it was signed: on its plot and unbitten under the pre-7.5 camera; also centred under ortho at yaw 0', () => {
    // Under the pre-7.5 PERSPECTIVE the rule reads ~0.08 lateral — parallax on an
    // off-centre slab (its near row is nearer than its centre), not yaw — so the
    // "not askew" half of the known answer is taken with parallel rays.
    const today = sweep(PRE_75, slabNearRow);
    const orthoY0 = sweep(ortho(0), slabNearRow);
    expect(today.length).toBe(RUBBLE_QUARRY_SLABS.length * Object.keys(HEIGHT_PATTERNS).length);
    for (const r of today) {
      expect(r.baseInside, r.what).toBe(true);
      expect(r.occluded, r.what).toBe(0);
    }
    for (const r of orthoY0) {
      expect(r.lateral, r.what).toBeLessThan(0.02);
      expect(r.baseInside, r.what).toBe(true);
      expect(r.occluded, r.what).toBe(0);
    }
  });

  it('FAILING CONTROL — the screenshot as a test: under yaw, the near-row rule stands every slab askew, overhangs a 3×3, and is bitten by a taller back row', () => {
    for (const yaw of [30, 45, -45]) {
      const rs = sweep(ortho(yaw), slabNearRow);
      for (const r of rs) expect(r.lateral, r.what).toBeGreaterThan(0.05);
      expect(rs.some((r) => !r.baseInside)).toBe(true);
      expect(Math.max(...rs.map((r) => r.occluded))).toBeGreaterThan(0.01);
    }
  });

  it('THE CANDIDATE — the footprint centre at the footprint’s highest tile top: centred, on its plot, unbitten by tile terrain, at every candidate yaw, ortho and the lens-20 fallback', () => {
    for (const view of CANDIDATE_YAWS.flatMap((y) => [ortho(y), lens20(y)])) {
      for (const rule of [slabCentre, slabCentreSlid]) {
        for (const r of sweep(view, rule)) {
          expect(r.lateral, r.what).toBeLessThan(0.02);
          expect(r.baseInside, r.what).toBe(true);
          expect(r.occluded, r.what).toBe(0);
        }
      }
    }
  });

  it('the §37b hill mounds bite an UNSLID slab; the slide clears them at no measured sort price', () => {
    // No shipped rubble stands on hills as far as the §106 audit read — this is
    // the worst case (every footprint tile a hills tile, every mound max-size,
    // jittered outward), and why the verdict's shape carries the slide.
    for (const yaw of [30, 45, -45]) {
      expect(Math.max(...sweep(ortho(yaw), slabCentre, true).map((r) => r.occluded))).toBeGreaterThan(0.1);
      for (const r of sweep(ortho(yaw), slabCentreSlid, true)) {
        expect(r.occluded, r.what).toBe(0);
        expect(r.sortCost, r.what).toBe(0);
      }
    }
  });

  it('under ortho the slide is SCREEN-INVARIANT (it moves only the depth); under the lens it is not', () => {
    const inkAt = (view: View, rule: SlabRule) => {
      const rig = fitRig(view, RUBBLE_QUARRY, vp);
      const s = RUBBLE_QUARRY_SLABS[0]!;
      const c = slabCase(RUBBLE_QUARRY, s.gx, s.gy, s.n, 'checker', true);
      return inkRectPx(rig, { glyph: SLAB_GLYPH, pos: rule(c, rig), size: s.n }, 1);
    };
    for (const yaw of [30, 45]) {
      const a = inkAt(ortho(yaw), slabCentre);
      const b = inkAt(ortho(yaw), slabCentreSlid);
      expect(Math.max(Math.abs(a.x0 - b.x0), Math.abs(a.x1 - b.x1), Math.abs(a.y0 - b.y0), Math.abs(a.y1 - b.y1))).toBeLessThan(1e-6);
    }
    const a = inkAt(lens20(45), slabCentre);
    const b = inkAt(lens20(45), slabCentreSlid);
    expect((b.x1 - b.x0) / (a.x1 - a.x0)).toBeGreaterThan(1.001);
  });
});
