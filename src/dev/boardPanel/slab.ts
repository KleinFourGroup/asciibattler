/**
 * 106b — THE N×N SLAB RULE under a rotated camera (Round 7.5, §106; the §105
 * verdict's finding 2, measured at 106a). Pure — three.js as math only.
 *
 * Today's rule (`BattleRenderer.unitAnchorPos`, R11) stands an N×N body on
 * its NEAR-ROW centre, written for "the camera never rotates". Under yaw the
 * nearest ground is a CORNER, so the slab stands askew on its diamond, off its
 * plot, and a taller back-row tile bites its lower band. This rule:
 *
 *  1. stands the slab on its footprint CENTRE, at the footprint's HIGHEST tile
 *     top (§79d2 rider 2's near-row max, generalized). That alone clears every
 *     tile prism: each ray from the quad above its base climbs from at least
 *     that height, so no footprint tile can sit on it — at any yaw, under either
 *     projection (tests/board: 0 occluded on every case);
 *  2. then SLIDES it along its own view ray until it is nearer than every
 *     footprint terrain vertex — which only matters for the §37b hill MOUNDS,
 *     standing up to 0.34 above the tile top. Under an orthographic camera the
 *     slide is screen-invariant (it moves only the depth test and the sort);
 *     under a lens it draws the slab a little bigger (3.3 % at FOV 20, 106a).
 *
 * The 106a instrument (`tests/board/geometry.ts`) measures this function —
 * its measures, not a copy of this rule, are the spec (`tests/board/slab.test.ts`).
 * If the direction ships, this is the seed of `unitAnchorPos`'s N×N branch;
 * the build decides slide vs a per-instance depth bias in the shader.
 */

import * as THREE from 'three';

/** Copied from TerrainRenderer (§37b): a mound's worst-case reach — its quadrant
 *  offset plus the max noise jitter, pushed outward — its max height and radius.
 *  The live mounds are noise-sized; the envelope is the safe bound, so this
 *  never needs to read the bump mesh. */
const MOUND_REACH = 0.22 + 0.1;
const MOUND_MAX_H = 0.34;
const MOUND_MAX_R = 0.26;
/** How much nearer than the nearest terrain vertex the slide lands. */
const SLIDE_MARGIN = 1e-4;

export interface SlabGround {
  /** Tile-top world Y of a cell (`TerrainRenderer.heightAt` with the cell's kind). */
  heightAt(gx: number, gy: number): number;
  /** Does the cell carry §37b hill mounds (a `hills` tile)? */
  hasMounds(gx: number, gy: number): boolean;
}

export interface SlabView {
  /** Camera forward — INTO the scene — in world space. */
  readonly fwd: THREE.Vector3;
  /** Camera position, world. */
  readonly position: THREE.Vector3;
  /** Parallel rays (along −fwd) rather than rays to `position`. */
  readonly ortho: boolean;
}

/** The view a live camera draws with, read fresh (its world matrix may lag a re-fit until the next render). */
export function slabViewOf(camera: THREE.Camera): SlabView {
  return {
    fwd: camera.getWorldDirection(new THREE.Vector3()),
    position: camera.position.clone(),
    ortho: (camera as THREE.OrthographicCamera).isOrthographicCamera === true,
  };
}

/**
 * The footprint's ground centre: XZ its centre (the grid→world mapping of
 * `gridToWorld` — grid +y runs toward world −z), Y its highest tile top. The
 * ground cue and the 106c plate stand here, whatever the slab rule.
 */
export function footprintCentre(
  gx: number,
  gy: number,
  n: number,
  gridW: number,
  gridH: number,
  heightAt: SlabGround['heightAt'],
): THREE.Vector3 {
  let top = -Infinity;
  for (let dy = 0; dy < n; dy++) for (let dx = 0; dx < n; dx++) top = Math.max(top, heightAt(gx + dx, gy + dy));
  return new THREE.Vector3(gx + n / 2 - gridW / 2, top, gridH / 2 - gy - n / 2);
}

/** The instance position for an N×N body whose canonical (min-x, min-y) corner is (gx, gy). */
export function slabAnchor(
  gx: number,
  gy: number,
  n: number,
  gridW: number,
  gridH: number,
  ground: SlabGround,
  view: SlabView,
): THREE.Vector3 {
  const p = footprintCentre(gx, gy, n, gridW, gridH, ground.heightAt);

  // The nearest footprint terrain vertex (a linear depth is minimized at one):
  // every tile's four top corners, and on a hills tile the mound envelope.
  let nearest = Infinity;
  const depth = (x: number, y: number, z: number): void => {
    const d = x * view.fwd.x + y * view.fwd.y + z * view.fwd.z;
    if (d < nearest) nearest = d;
  };
  for (let dy = 0; dy < n; dy++)
    for (let dx = 0; dx < n; dx++) {
      const cx = gx + dx + 0.5 - gridW / 2;
      const cz = gridH / 2 - (gy + dy) - 0.5;
      const h = ground.heightAt(gx + dx, gy + dy);
      for (const sx of [-0.5, 0.5]) for (const sz of [-0.5, 0.5]) depth(cx + sx, h, cz + sz);
      if (!ground.hasMounds(gx + dx, gy + dy)) continue;
      for (const mx of [-MOUND_REACH, MOUND_REACH])
        for (const mz of [-MOUND_REACH, MOUND_REACH]) {
          depth(cx + mx, h + MOUND_MAX_H, cz + mz);
          for (const rx of [-MOUND_MAX_R, MOUND_MAX_R])
            for (const rz of [-MOUND_MAX_R, MOUND_MAX_R]) depth(cx + mx + rx, h, cz + mz + rz);
        }
    }

  const gap = p.dot(view.fwd) - nearest;
  if (gap <= 0) return p;
  const toward = view.ortho
    ? view.fwd.clone().negate()
    : view.position.clone().sub(p).normalize();
  // Moving s along `toward` changes the depth by s · (toward · fwd), which is < 0.
  return p.addScaledVector(toward, (gap + SLIDE_MARGIN) / -toward.dot(view.fwd));
}
