/**
 * The N×N slab rule: where an N×N body's one scaled glyph stands (107b, the
 * Round 7.5 spec's D2; it replaced the near-row rule, which assumed a camera
 * square to the board). Pure: three.js as math only.
 *
 *  1. The slab stands on its footprint CENTRE, at the footprint's HIGHEST tile
 *     top. That alone clears every tile prism: each ray from the quad above
 *     its base climbs from at least that height, so no footprint tile can sit
 *     in front of it, at any yaw, under either projection.
 *  2. Then it SLIDES along its own view ray until it is nearer than every
 *     footprint terrain vertex, which matters only for the hill mounds, which
 *     stand above the tile top. Under an orthographic camera the slide moves
 *     nothing on screen (only the depth test and the sprite sort); under a
 *     lens it draws the slab slightly bigger (3.3 % at FOV 20).
 *
 * `tests/board/slab.test.ts` pins this function through the board
 * instrument's measures (askew, off its plot, bitten, sort cost), which share
 * no code with it.
 */

import * as THREE from 'three';
import type { World } from '../sim/World';
import { HILL_MOUND_ENVELOPE, type TerrainRenderer } from './TerrainRenderer';

/** How much nearer than the nearest terrain vertex the slide lands. */
const SLIDE_MARGIN = 1e-4;

export interface SlabGround {
  /** Tile-top world Y of a cell (`TerrainRenderer.heightAt` with the cell's kind). */
  heightAt(gx: number, gy: number): number;
  /** Does the cell carry hill mounds (a `hills` tile)? */
  hasMounds(gx: number, gy: number): boolean;
}

export interface SlabView {
  /** Camera forward, INTO the scene, in world space. */
  readonly fwd: THREE.Vector3;
  /** Camera position, world. */
  readonly position: THREE.Vector3;
  /** Parallel rays (along −fwd) rather than rays to `position`. */
  readonly ortho: boolean;
}

/** A battle's live terrain, as the slab rule reads it: the tile-top height a
 *  1×1 body stands on, and whether the cell grows mounds. */
export function slabGroundOf(world: World, terrain: TerrainRenderer): SlabGround {
  return {
    heightAt: (x, y) => terrain.heightAt(x, y, world.tileGrid.kindAt({ x, y })),
    hasMounds: (x, y) => world.tileGrid.kindAt({ x, y }) === 'hills',
  };
}

/** The view a live camera draws with, read fresh (`getWorldDirection` updates
 *  the world matrix, which may lag a re-fit until the next render). */
export function slabViewOf(camera: THREE.Camera): SlabView {
  return {
    fwd: camera.getWorldDirection(new THREE.Vector3()),
    position: camera.position.clone(),
    ortho: (camera as THREE.OrthographicCamera).isOrthographicCamera === true,
  };
}

/**
 * The footprint's ground centre: XZ its centre (the `gridToWorld` mapping, so
 * grid +y runs toward world −z), Y its highest tile top.
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
  const { reach, maxH, maxR } = HILL_MOUND_ENVELOPE;

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
      for (const mx of [-reach, reach])
        for (const mz of [-reach, reach]) {
          depth(cx + mx, h + maxH, cz + mz);
          for (const rx of [-maxR, maxR]) for (const rz of [-maxR, maxR]) depth(cx + mx + rx, h, cz + mz + rz);
        }
    }

  const gap = p.dot(view.fwd) - nearest;
  if (gap <= 0) return p;
  const toward = view.ortho ? view.fwd.clone().negate() : view.position.clone().sub(p).normalize();
  // Moving s along `toward` changes the depth by s · (toward · fwd), which is < 0.
  return p.addScaledVector(toward, (gap + SLIDE_MARGIN) / -toward.dot(view.fwd));
}
