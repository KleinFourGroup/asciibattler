import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { applyCameraFit, fitCameraToBox, type CameraView } from '../../src/render/cameraFit';
import { footprintCentre, slabAnchor, slabViewOf } from '../../src/render/slabAnchor';
import {
  FIT_MARGIN,
  HEIGHT_PATTERNS,
  RUBBLE_QUARRY,
  RUBBLE_QUARRY_SLABS,
  VIEWPORTS,
  XZ_PADDING,
  Y_HALF_EXTENT,
  fitRig,
  slabCase,
  slabReport,
  type SlabRule,
  type View,
} from './geometry';

/**
 * THE N×N SLAB RULE, through the 106a measures (a permanent gate since 107b,
 * when the rule shipped). `slabAnchor` is what `BattleRenderer.unitAnchorPos`
 * stands every N×N body on; the measures (askew, off its plot, bitten) are the
 * instrument's, which shares no code with it. The spec is the MEASURES, never
 * a restated copy of the rule. The instrument models the mounds with its own
 * copy of their envelope; `TerrainRenderer.test.ts` pins the production
 * envelope against the drawn mesh.
 */

const vp = VIEWPORTS[0]!;
const ortho = (yawDeg: number): View => ({ projection: { kind: 'orthographic' }, pitchDeg: 45, yawDeg });
const lens20 = (yawDeg: number): View => ({ projection: { kind: 'perspective', fovDeg: 20 }, pitchDeg: 45, yawDeg });
const VIEWS = [30, 35, 40, 45, -30, -45].flatMap((y) => [ortho(y), lens20(y)]);

/** The production rule, as a rule the instrument can measure. */
const productionRule: SlabRule = (c, rig) =>
  slabAnchor(
    c.gx,
    c.gy,
    c.n,
    c.board.w,
    c.board.h,
    { heightAt: c.heights, hasMounds: () => c.mounds === true },
    {
      fwd: rig.fwd,
      position: rig.camera.position,
      ortho: (rig.camera as THREE.OrthographicCamera).isOrthographicCamera === true,
    },
  );

/** The control: the same centre with no slide. */
const unslid: SlabRule = (c) => footprintCentre(c.gx, c.gy, c.n, c.board.w, c.board.h, c.heights);

const sweep = (rule: SlabRule, mounds: boolean) =>
  VIEWS.flatMap((view) => {
    const rig = fitRig(view, RUBBLE_QUARRY, vp);
    return RUBBLE_QUARRY_SLABS.flatMap((s) =>
      Object.keys(HEIGHT_PATTERNS).map((p) => ({
        ...slabReport(rig, slabCase(RUBBLE_QUARRY, s.gx, s.gy, s.n, p, mounds), rule),
        what: `${JSON.stringify(view)} ${s.n}x${s.n}@(${s.gx},${s.gy}) ${p}${mounds ? ' +mounds' : ''}`,
      })),
    );
  });

describe('the production slab rule passes the 106a measures', () => {
  it('centred, on its plot, unbitten and sort-clean — every candidate yaw, ortho and the lens, with and without mounds', () => {
    const rs = [...sweep(productionRule, false), ...sweep(productionRule, true)];
    expect(rs.length).toBe(2 * VIEWS.length * RUBBLE_QUARRY_SLABS.length * Object.keys(HEIGHT_PATTERNS).length);
    for (const r of rs) {
      expect(r.lateral, r.what).toBeLessThan(0.02);
      expect(r.baseInside, r.what).toBe(true);
      expect(r.occluded, r.what).toBe(0);
      expect(r.sortCost, r.what).toBe(0);
    }
  });

  it('CONTROL — the same centre without the slide is bitten by the mounds (the sweep can see a missing slide)', () => {
    expect(Math.max(...sweep(unslid, true).map((r) => r.occluded))).toBeGreaterThan(0.1);
  });

  it('slabViewOf reads the camera the production fit just built — no render, no manual matrix update', () => {
    for (const view of [ortho(45), ortho(-30), lens20(45)]) {
      const cv: CameraView = {
        projection: view.projection.kind,
        fovDeg: view.projection.kind === 'perspective' ? view.projection.fovDeg : 50,
        pitchDeg: view.pitchDeg,
        yawDeg: view.yawDeg,
      };
      const camera =
        cv.projection === 'perspective'
          ? new THREE.PerspectiveCamera(1, 1, 0.1, 5000)
          : new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 5000);
      const aspect = vp.w / vp.h;
      const box = [RUBBLE_QUARRY.w / 2 + XZ_PADDING, Y_HALF_EXTENT, RUBBLE_QUARRY.h / 2 + XZ_PADDING] as const;
      applyCameraFit(camera, cv, fitCameraToBox(cv, aspect, ...box, FIT_MARGIN), aspect, 0, 0);
      const seen = slabViewOf(camera);
      const rig = fitRig(view, RUBBLE_QUARRY, vp);
      expect(seen.fwd.distanceTo(rig.fwd)).toBeLessThan(1e-9);
      expect(seen.ortho).toBe(cv.projection === 'orthographic');
    }
  });
});
