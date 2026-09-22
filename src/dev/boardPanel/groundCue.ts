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
 * colour rule) but carries nothing the shape does not. (⚠ The shapes are
 * WORLD shapes: at yaw 45 the grid axes run diagonally, so the enemy's world
 * diamond draws as a screen RECTANGLE while the tile itself is the screen
 * diamond — the §106 audit, finding 5.)
 *
 * 106c — THE GROUND MARK (the §105 verdict's finding 1: "floaty" is a
 * GROUNDING question — whether a glyph reads as touching the ground). The
 * `ground` dial picks what lies under every combatant:
 *   cue    — the team shape above (its own dials: style, size, opacity) — WHOSE;
 *   shadow — a dark contact disc, smaller, at the feet — TOUCHING;
 *   both   — the two marks, one over the other;
 *   merged — ONE mark with both jobs: the team shape at contact size, filled
 *            dark and outlined in the team colour.
 * A flyer's mark is the same mark on its TILE — the glyph is what leaves; the
 * gap between them is the read. And the `plate` dial marks a static N×N
 * body's whole FOOTPRINT (rubble has no cue — it is scenery — but its one glyph
 * does not say which tiles it holds; the user's 105b read, TODO).
 *
 * A MOCK: a small pool of plain meshes, no instancing, no shader. It ignores
 * spawn fade-ins.
 *
 * The `cueDepth` dial (105b-post) applies to every mark here: tile tops are
 * flat, so a mark never intersects a neighbour — what the 105b read saw as
 * "clipping" is the DEPTH TEST, a taller tile nearer the camera occluding the
 * ground behind it. `overlay` drops the test; glyphs still cover the marks
 * either way (negative renderOrder, sprites don't write depth).
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
/** 105c — the flyer shadow under `ground-cue`: a disc a little smaller than the default cue. */
const SHADOW_SIZE = 0.6;
const SHADOW_OPACITY = 0.5;
/** 106c — the plate: inset from the footprint's edge, and its stroke, world units. */
const PLATE_INSET = 0.06;
const PLATE_STROKE = 0.07;

/** Draw order among the marks (sprites draw at 0 and never write depth). */
const ORDER = { plate: -3, dark: -2, colour: -1 } as const;

const BLACK = 0x000000;

function flat(geometry: THREE.BufferGeometry): THREE.BufferGeometry {
  geometry.rotateX(-Math.PI / 2); // XY → flat on the XZ ground plane
  return geometry;
}

function shapeGeometry(side: CueSide, filled: boolean): THREE.BufferGeometry {
  const { segments, thetaStart } = SHAPE[side];
  return flat(
    filled
      ? new THREE.CircleGeometry(0.5, segments, thetaStart)
      : new THREE.RingGeometry(0.5 * (1 - OUTLINE_STROKE), 0.5, segments, 1, thetaStart),
  );
}

/** An axis-aligned square covering an n×n footprint less the inset — radii are
 *  to the CORNERS, hence √2; the ring's stroke is a constant world width. */
function plateGeometry(n: number, filled: boolean): THREE.BufferGeometry {
  const outer = (n / 2 - PLATE_INSET) * Math.SQRT2;
  return flat(
    filled
      ? new THREE.CircleGeometry(outer, 4, Math.PI / 4)
      : new THREE.RingGeometry(outer - PLATE_STROKE * Math.SQRT2, outer, 4, 1, Math.PI / 4),
  );
}

export class GroundCues {
  private readonly meshes = new Map<string, THREE.Mesh>();
  private readonly geometries = new Map<string, THREE.BufferGeometry>();
  private readonly seen = new Set<string>();

  constructor(private readonly scene: THREE.Scene) {}

  /** Start a frame's sync; every mark not placed before `endFrame` is dropped. */
  beginFrame(): void {
    this.seen.clear();
  }

  /**
   * Put `key`'s ground mark(s) under `subject` at ground point `ground`, per the
   * `ground` dial, scaled by `footprint`. For a 1×1 body `ground` is the
   * sprite's base anchor (it tracks the move lerp); for an N×N body the CALLER
   * passes the footprint's centre (slab.ts `footprintCentre`) — never the
   * sprite anchor, which today's rule puts on the near row and 106b's
   * `slab-centre` slides toward the camera.
   */
  place(
    key: string,
    subject: CueSubject,
    ground: THREE.Vector3,
    footprint: number,
    dials: DialState,
  ): void {
    const side = cueSideOf(subject);
    if (side === null) return;
    const colour = spriteColorForUnit(subject);
    const mode = dials.ground;
    // `ground-cue` is 105b's behaviour exactly: the cue dial decides. Under
    // `both` the cue is drawn whatever that dial says (outline unless `filled`).
    if (mode === 'cue' ? dials.cue !== 'off' : mode === 'both') {
      const filled = dials.cue === 'filled';
      this.mark(`${key}:c`, `${side}:${filled ? 'f' : 'o'}`, () => shapeGeometry(side, filled),
        colour, dials.cueAlpha, dials.cueSize * footprint, ORDER.colour, ground, dials);
    }
    if (mode === 'shadow' || mode === 'both') {
      this.mark(`${key}:s`, 'disc', () => shapeGeometry('player', true),
        BLACK, dials.shadowAlpha, dials.shadowSize * footprint, ORDER.dark, ground, dials);
    }
    if (mode === 'merged') {
      const size = dials.shadowSize * footprint;
      this.mark(`${key}:m`, `${side}:f`, () => shapeGeometry(side, true),
        BLACK, dials.shadowAlpha, size, ORDER.dark, ground, dials);
      this.mark(`${key}:c`, `${side}:o`, () => shapeGeometry(side, false),
        colour, dials.cueAlpha, size, ORDER.colour, ground, dials);
    }
  }

  /**
   * 105c — the fake flyer's SHADOW under `ground-cue`: a dark disc on the tile
   * it is over, the one thing that says "which tile" once the glyph has left
   * it. (Under the other `ground` modes the flyer's `place`d mark does this job
   * — the same mark as everyone's, on its tile.)
   */
  placeShadow(key: string, ground: THREE.Vector3, dials: DialState): void {
    this.mark(key, 'disc', () => shapeGeometry('player', true),
      BLACK, SHADOW_OPACITY, SHADOW_SIZE, ORDER.dark, ground, dials);
  }

  /**
   * 106c — the PLATE: a static N×N body's whole footprint, centred on
   * `centre` (slab.ts `footprintCentre`). `frame` = its outline in the body's
   * colour; `filled` = a dark footprint under that outline.
   */
  placePlate(key: string, subject: CueSubject, centre: THREE.Vector3, n: number, dials: DialState): void {
    if (dials.plate === 'off') return;
    if (dials.plate === 'filled') {
      this.mark(`${key}:pf`, `plate:f:${n}`, () => plateGeometry(n, true),
        BLACK, dials.shadowAlpha, 1, ORDER.plate, centre, dials);
    }
    this.mark(`${key}:po`, `plate:o:${n}`, () => plateGeometry(n, false),
      spriteColorForUnit(subject), dials.cueAlpha, 1, ORDER.plate, centre, dials);
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

  /** One flat mesh, pooled by `key`, its geometry shared by `shapeKey`. */
  private mark(
    key: string,
    shapeKey: string,
    build: () => THREE.BufferGeometry,
    colour: THREE.ColorRepresentation,
    opacity: number,
    scale: number,
    renderOrder: number,
    ground: THREE.Vector3,
    dials: DialState,
  ): void {
    this.seen.add(key);
    let mesh = this.meshes.get(key);
    if (!mesh) {
      mesh = new THREE.Mesh(
        this.geometryFor(shapeKey, build),
        new THREE.MeshBasicMaterial({
          transparent: true,
          depthWrite: false,
          polygonOffset: true,
          polygonOffsetFactor: -2,
          polygonOffsetUnits: -2,
          side: THREE.DoubleSide,
        }),
      );
      mesh.userData.shapeKey = shapeKey;
      this.scene.add(mesh);
      this.meshes.set(key, mesh);
    } else if (mesh.userData.shapeKey !== shapeKey) {
      mesh.geometry = this.geometryFor(shapeKey, build);
      mesh.userData.shapeKey = shapeKey;
    }
    // Sprites are `depthWrite: false` and draw at renderOrder 0 — a mark that
    // sorted AFTER them would paint over the glyph standing on it.
    mesh.renderOrder = renderOrder;
    const material = mesh.material as THREE.MeshBasicMaterial;
    material.color.set(colour);
    material.opacity = opacity;
    material.depthTest = dials.cueDepth === 'world';
    mesh.position.set(ground.x, ground.y + GROUND_EPSILON, ground.z);
    mesh.scale.setScalar(scale);
  }

  private geometryFor(shapeKey: string, build: () => THREE.BufferGeometry): THREE.BufferGeometry {
    let geometry = this.geometries.get(shapeKey);
    if (!geometry) {
      geometry = build();
      this.geometries.set(shapeKey, geometry);
    }
    return geometry;
  }
}
