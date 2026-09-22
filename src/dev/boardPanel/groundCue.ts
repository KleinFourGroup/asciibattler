/**
 * 105b — the GROUND-CUE mock: a flat shape lying on a unit's tile, in WORLD
 * space (so it projects correctly under whatever camera 105d dials in — a
 * trapezoid at the flank under perspective, a clean rhombus under ortho; that
 * contrast is one of the things the spike is for).
 *
 * One SHAPE per side, because the cue is auditioning for DESIGN's "Team
 * identity on the board" channel and a shape passes the grey read (Ctrl+Alt+G)
 * by construction: circle = yours · diamond = the enemy's · triangle = an
 * active camp. Inert scenery gets none. The hue rides along (the sprite's own
 * colour rule) but carries nothing the shape does not.
 *
 * A MOCK: a small pool of plain meshes, no instancing, no shader. It ignores
 * spawn fade-ins, and it cues COMBATANTS only — a static multi-tile body
 * (rubble) gets no indicator yet: the user's 105b read asked for one, deferred
 * to §106 because its natural form (a footprint frame) sits on the footprint
 * anchor, which pass two may move (TODO).
 *
 * The `cueDepth` dial (105b-post): tile tops are flat, so a cue never
 * intersects a neighbour — what the 105b read saw as "clipping" is the DEPTH
 * TEST, a taller tile nearer the camera occluding the ground behind it (and a
 * hill's pyramid, and a mid-step boundary crossing). `overlay` drops the test;
 * glyphs still cover the cue either way (renderOrder −1, sprites don't write
 * depth).
 */

import * as THREE from 'three';
import { spriteColorForUnit } from '../../render/spriteColor';
import type { Team } from '../../sim/Unit';
import type { DialState } from './state';

export type CueSide = 'player' | 'enemy' | 'camp';

/** What a cue needs to know about the thing it sits under. */
export interface CueSubject {
  readonly team: Team;
  readonly archetype: string;
  readonly campId: number | null;
}

export function cueSideOf(subject: CueSubject): CueSide | null {
  if (subject.team === 'player') return 'player';
  if (subject.team === 'enemy') return 'enemy';
  return subject.campId !== null ? 'camp' : null;
}

/** Polygon segments + start angle per side: 3 / 4 segments ARE the triangle /
 *  diamond; the diamond starts on a vertex so it points along the grid axes. */
const SHAPE: Record<CueSide, { segments: number; thetaStart: number }> = {
  player: { segments: 40, thetaStart: 0 },
  enemy: { segments: 4, thetaStart: 0 },
  camp: { segments: 3, thetaStart: Math.PI / 2 },
};

/** Outline stroke width, as a fraction of the shape's radius. */
const OUTLINE_STROKE = 0.16;
/** Lift off the tile top — with polygonOffset, enough to never z-fight it. */
const GROUND_EPSILON = 0.012;
/** 105c — the flyer shadow: a disc a little smaller than the default cue. */
const SHADOW_SIZE = 0.6;
const SHADOW_OPACITY = 0.5;

function buildGeometry(side: CueSide, filled: boolean): THREE.BufferGeometry {
  const { segments, thetaStart } = SHAPE[side];
  const geometry = filled
    ? new THREE.CircleGeometry(0.5, segments, thetaStart)
    : new THREE.RingGeometry(0.5 * (1 - OUTLINE_STROKE), 0.5, segments, 1, thetaStart);
  geometry.rotateX(-Math.PI / 2); // XY disc → flat on the XZ ground plane
  return geometry;
}

export class GroundCues {
  private readonly meshes = new Map<string, THREE.Mesh>();
  private readonly geometries = new Map<string, THREE.BufferGeometry>();
  private readonly seen = new Set<string>();

  constructor(private readonly scene: THREE.Scene) {}

  /** Start a frame's sync; every cue not `place`d before `endFrame` is dropped. */
  beginFrame(): void {
    this.seen.clear();
  }

  /**
   * Put `key`'s cue under `subject` at ground point `ground`, scaled by
   * `footprint`. For a 1×1 body `ground` is the sprite's base anchor (it tracks
   * the move lerp); for an N×N body the CALLER passes the footprint's centre
   * (slab.ts `footprintCentre`) — never the sprite anchor, which today's rule
   * puts on the near row and 106b's `slab-centre` slides toward the camera.
   */
  place(
    key: string,
    subject: CueSubject,
    ground: THREE.Vector3,
    footprint: number,
    dials: DialState,
  ): void {
    const side = cueSideOf(subject);
    if (side === null || dials.cue === 'off') return;
    this.seen.add(key);
    const filled = dials.cue === 'filled';
    const shapeKey = `${side}:${filled ? 'f' : 'o'}`;
    let mesh = this.meshes.get(key);
    if (!mesh) {
      mesh = new THREE.Mesh(
        this.geometryFor(shapeKey, side, filled),
        new THREE.MeshBasicMaterial({
          transparent: true,
          depthWrite: false,
          polygonOffset: true,
          polygonOffsetFactor: -2,
          polygonOffsetUnits: -2,
          side: THREE.DoubleSide,
        }),
      );
      // Sprites are `depthWrite: false` and draw at renderOrder 0 — a cue that
      // sorted AFTER them would paint over the glyph standing on it.
      mesh.renderOrder = -1;
      mesh.userData.shapeKey = shapeKey;
      this.scene.add(mesh);
      this.meshes.set(key, mesh);
    } else if (mesh.userData.shapeKey !== shapeKey) {
      mesh.geometry = this.geometryFor(shapeKey, side, filled);
      mesh.userData.shapeKey = shapeKey;
    }
    const material = mesh.material as THREE.MeshBasicMaterial;
    material.color.set(spriteColorForUnit(subject));
    material.opacity = dials.cueAlpha;
    material.depthTest = dials.cueDepth === 'world';
    mesh.position.set(ground.x, ground.y + GROUND_EPSILON, ground.z);
    mesh.scale.setScalar(dials.cueSize * footprint);
  }

  /**
   * 105c — the fake flyer's SHADOW: a dark disc on the tile it is over, the
   * one thing that says "which tile" once the glyph has left it. Same pool,
   * same frame protocol and the same `cueDepth` treatment as the cues; drawn
   * UNDER them (renderOrder −2) so a cue ring stays whole on top of it.
   */
  placeShadow(key: string, ground: THREE.Vector3, dials: DialState): void {
    this.seen.add(key);
    let mesh = this.meshes.get(key);
    if (!mesh) {
      mesh = new THREE.Mesh(
        this.geometryFor('shadow', 'player', true),
        new THREE.MeshBasicMaterial({
          color: 0x000000,
          opacity: SHADOW_OPACITY,
          transparent: true,
          depthWrite: false,
          polygonOffset: true,
          polygonOffsetFactor: -2,
          polygonOffsetUnits: -2,
          side: THREE.DoubleSide,
        }),
      );
      mesh.renderOrder = -2;
      this.scene.add(mesh);
      this.meshes.set(key, mesh);
    }
    (mesh.material as THREE.MeshBasicMaterial).depthTest = dials.cueDepth === 'world';
    mesh.position.set(ground.x, ground.y + GROUND_EPSILON, ground.z);
    mesh.scale.setScalar(SHADOW_SIZE);
  }

  endFrame(): void {
    for (const [key, mesh] of this.meshes) {
      if (this.seen.has(key)) continue;
      this.scene.remove(mesh);
      (mesh.material as THREE.Material).dispose();
      this.meshes.delete(key);
    }
  }

  get count(): number {
    return this.meshes.size;
  }

  private geometryFor(shapeKey: string, side: CueSide, filled: boolean): THREE.BufferGeometry {
    let geometry = this.geometries.get(shapeKey);
    if (!geometry) {
      geometry = buildGeometry(side, filled);
      this.geometries.set(shapeKey, geometry);
    }
    return geometry;
  }
}
