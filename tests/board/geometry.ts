import * as THREE from 'three';
import census from './inkCensus.json';

/**
 * §105a — THE HEADLESS BOARD-GEOMETRY INSTRUMENT (Round 7.5, the projection
 * spike). Answers, as NUMBERS, what a projection does to the board before
 * anyone looks at it: the lean of a world vertical, glyph pixels at fit, how
 * much a melee clump's ink overlaps, how far a glyph's ink strays off its own
 * tile, and what a lifted ("flyer") unit does to the neighbour behind it.
 *
 * ⚠ INDEPENDENCE (AGENTS "a probe must re-derive its expectation from a
 * surface the code under test does NOT consult"): this file imports NOTHING
 * from `src/render`. The camera is three.js's own; the fit is re-derived here
 * (a basis-projection loop over the frame box's 8 corners — it covers yaw and
 * orthographic, which `Renderer.computeCameraDistance` does not); the billboard
 * is re-stated from `billboard.vert.glsl` (a view-space quad about an anchor);
 * the ink is the dumped census. The fit CONSTANTS are copied (they are design
 * numbers, not logic) — `geometry.test.ts` holds the known answers that would
 * catch a wrong copy: §79b's live-camera measurements (±9.1 / ±5.0 / ±3.2 px
 * and the 26.3 px half-quad, a 15×15 board at 1280×720).
 *
 * The model is FLAT: every tile top at y = 0 (terrain height is ignored) —
 * EXCEPT the §106a N×N slab section at the end, whose bite is a height effect,
 * so its per-cell heights are a test input (`HeightField`).
 */

// Copied from src/render/Renderer.ts (XZ_PADDING / Y_HALF_EXTENT / FIT_MARGIN).
export const XZ_PADDING = 0.5;
export const Y_HALF_EXTENT = 1.0;
export const FIT_MARGIN = 1.05;

/** glyphs.ts INK_FLOOR_EPSILON — the floor-family classifier, restated. */
const INK_FLOOR_EPSILON = 3 / 64;

export type Projection = { kind: 'perspective'; fovDeg: number } | { kind: 'orthographic' };

export interface View {
  projection: Projection;
  /** Camera pitch from horizontal, degrees (today: 45). */
  pitchDeg: number;
  /** Camera yaw about world-Y, degrees (today: 0). */
  yawDeg: number;
}

export interface Viewport {
  name: string;
  /** CSS pixels. */
  w: number;
  h: number;
  dpr: number;
}

export interface Board {
  name: string;
  w: number;
  h: number;
}

export type AnchorMode = 'today' | 'uniform';

export interface Rect {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

export const TODAY: View = { projection: { kind: 'perspective', fovDeg: 50 }, pitchDeg: 45, yawDeg: 0 };

const INKS = census.inks as unknown as Record<string, [number, number, number, number]>;

export function inkOf(glyph: string): [number, number, number, number] {
  const ink = INKS[glyph];
  if (!ink) throw new Error(`glyph ${JSON.stringify(glyph)} is not in tests/board/inkCensus.json`);
  return ink;
}

/** The base-anchor quad-local y. 'today' restates glyphs.ts `baseAnchorYFor`. */
export function anchorYFor(glyph: string, mode: AnchorMode): number {
  if (mode === 'uniform') return -0.5;
  const y0 = inkOf(glyph)[1];
  return (y0 < INK_FLOOR_EPSILON ? 0 : census.baselineY - census.descenderRoom) - 0.5;
}

/** BattleRenderer `gridToWorld`, restated: grid +y runs AWAY from the camera. */
export function gridToWorld(board: Board, gx: number, gy: number): THREE.Vector3 {
  return new THREE.Vector3(gx + 0.5 - board.w / 2, 0, board.h / 2 - gy - 0.5);
}

export interface Rig {
  camera: THREE.Camera;
  viewport: Viewport;
  right: THREE.Vector3;
  up: THREE.Vector3;
  fwd: THREE.Vector3;
}

/** Build a camera looking at the board's centre, FITTED to the board. */
export function fitRig(view: View, board: Board, viewport: Viewport): Rig {
  const aspect = viewport.w / viewport.h;
  const pitch = THREE.MathUtils.degToRad(view.pitchDeg);
  const yaw = THREE.MathUtils.degToRad(view.yawDeg);
  // Unit vector from the look-at point toward the camera.
  const dir = new THREE.Vector3(Math.sin(yaw) * Math.cos(pitch), Math.sin(pitch), Math.cos(yaw) * Math.cos(pitch));

  const camera: THREE.PerspectiveCamera | THREE.OrthographicCamera =
    view.projection.kind === 'perspective'
      ? new THREE.PerspectiveCamera(view.projection.fovDeg, aspect, 0.1, 5000)
      : new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 5000);

  // Orient first (the basis does not depend on the distance).
  camera.position.copy(dir);
  camera.lookAt(0, 0, 0);
  camera.updateMatrixWorld(true);
  const right = new THREE.Vector3().setFromMatrixColumn(camera.matrixWorld, 0);
  const up = new THREE.Vector3().setFromMatrixColumn(camera.matrixWorld, 1);
  const fwd = new THREE.Vector3().setFromMatrixColumn(camera.matrixWorld, 2).negate();

  const hx = board.w / 2 + XZ_PADDING;
  const hz = board.h / 2 + XZ_PADDING;
  let maxRight = 0;
  let maxUp = 0;
  let maxD = 0;
  const tanV = view.projection.kind === 'perspective' ? Math.tan(THREE.MathUtils.degToRad(view.projection.fovDeg) / 2) : 0;
  const tanH = tanV * aspect;
  const p = new THREE.Vector3();
  for (const sx of [-1, 1])
    for (const sy of [-1, 1])
      for (const sz of [-1, 1]) {
        p.set(sx * hx, sy * Y_HALF_EXTENT, sz * hz);
        const r = Math.abs(p.dot(right));
        const u = Math.abs(p.dot(up));
        const along = p.dot(fwd);
        maxRight = Math.max(maxRight, r);
        maxUp = Math.max(maxUp, u);
        if (view.projection.kind === 'perspective') {
          // depth of p = D + along; inside the cone ⇔ |coord| ≤ depth · tan.
          maxD = Math.max(maxD, r / tanH - along, u / tanV - along);
        }
      }

  if (camera instanceof THREE.PerspectiveCamera) {
    camera.position.copy(dir).multiplyScalar(maxD * FIT_MARGIN);
  } else {
    const halfH = Math.max(maxUp, maxRight / aspect) * FIT_MARGIN;
    camera.left = -halfH * aspect;
    camera.right = halfH * aspect;
    camera.top = halfH;
    camera.bottom = -halfH;
    camera.position.copy(dir).multiplyScalar(500);
  }
  camera.lookAt(0, 0, 0);
  camera.updateProjectionMatrix();
  camera.updateMatrixWorld(true);
  camera.matrixWorldInverse.copy(camera.matrixWorld).invert();
  return { camera, viewport, right, up, fwd };
}

const _v = new THREE.Vector3();

/** World point → CSS px (y down). */
export function toPx(rig: Rig, world: THREE.Vector3): { x: number; y: number } {
  _v.copy(world).project(rig.camera);
  return { x: ((_v.x + 1) / 2) * rig.viewport.w, y: ((1 - _v.y) / 2) * rig.viewport.h };
}

/** View-space point → CSS px (y down). */
function viewToPx(rig: Rig, vx: number, vy: number, vz: number): { x: number; y: number } {
  _v.set(vx, vy, vz).applyMatrix4(rig.camera.projectionMatrix);
  return { x: ((_v.x + 1) / 2) * rig.viewport.w, y: ((1 - _v.y) / 2) * rig.viewport.h };
}

/**
 * The lean of a world vertical at `world`, degrees off screen-vertical
 * (+ = leaning screen-right). 0 everywhere ⇔ "world-up projects to screen-up".
 */
export function leanDeg(rig: Rig, world: THREE.Vector3): number {
  const a = toPx(rig, world);
  const b = toPx(rig, world.clone().add(new THREE.Vector3(0, 1e-3, 0)));
  return THREE.MathUtils.radToDeg(Math.atan2(b.x - a.x, -(b.y - a.y)));
}

/** Horizontal px drift of a `lift` along WORLD-Y vs the ground point (§79b). */
export function worldYDriftPx(rig: Rig, world: THREE.Vector3, lift: number): number {
  return toPx(rig, world.clone().add(new THREE.Vector3(0, lift, 0))).x - toPx(rig, world).x;
}

/** Horizontal px drift of a `lift` along CAMERA-up (anchor.ts) — 0 by construction. */
export function cameraUpDriftPx(rig: Rig, world: THREE.Vector3, lift: number): number {
  return toPx(rig, world.clone().addScaledVector(rig.up, lift)).x - toPx(rig, world).x;
}

export interface Sprite {
  glyph: string;
  /** The ground anchor (tile-top centre), world. */
  pos: THREE.Vector3;
  /** Camera-up lift, world units (a fake flyer); 0 = standing. */
  lift?: number;
  /** §106a — the per-instance size (an N×N body's `instanceSize` = N); 1 when absent. */
  size?: number;
}

/**
 * billboard.vert.glsl restated: the quad spans [-0.5, 0.5]² · scale in VIEW
 * space about `instanceAnchor`. Returns the on-screen rect (CSS px, y down) of
 * the quad-local sub-rect [qx0..qx1] × [qy0..qy1] given in 0..1 cell units.
 */
function spriteRectPx(rig: Rig, s: Sprite, scale: number, mode: AnchorMode, cell: [number, number, number, number]): Rect {
  const anchorY = anchorYFor(s.glyph, mode);
  const k = scale * (s.size ?? 1);
  const ground = s.pos.clone().addScaledVector(rig.up, s.lift ?? 0);
  const v = ground.applyMatrix4(rig.camera.matrixWorldInverse);
  const a = viewToPx(rig, v.x + (cell[0] - 0.5) * k, v.y + (cell[1] - 0.5 - anchorY) * k, v.z);
  const b = viewToPx(rig, v.x + (cell[2] - 0.5) * k, v.y + (cell[3] - 0.5 - anchorY) * k, v.z);
  return { x0: Math.min(a.x, b.x), y0: Math.min(a.y, b.y), x1: Math.max(a.x, b.x), y1: Math.max(a.y, b.y) };
}

export function inkRectPx(rig: Rig, s: Sprite, scale: number, mode: AnchorMode): Rect {
  return spriteRectPx(rig, s, scale, mode, inkOf(s.glyph));
}

export function quadRectPx(rig: Rig, s: Sprite, scale: number, mode: AnchorMode): Rect {
  return spriteRectPx(rig, s, scale, mode, [0, 0, 1, 1]);
}

/** Planar view depth — SpriteRenderer.sortByDepth's key, restated. */
function depthOf(rig: Rig, s: Sprite): number {
  return s.pos.dot(rig.fwd);
}

const SAMPLES = 24;

/**
 * For each sprite: the fraction of its INK RECT covered by the ink rects of
 * sprites drawn in front of it (nearer planar depth; ties → later index).
 * ⚠ Ink RECTS, not ink pixels — an upper bound on real ink-over-ink.
 */
export function coveredFractions(rig: Rig, sprites: Sprite[], scale: number, mode: AnchorMode): number[] {
  const rects = sprites.map((s) => inkRectPx(rig, s, scale, mode));
  const depths = sprites.map((s) => depthOf(rig, s));
  return sprites.map((_, i) => {
    const r = rects[i]!;
    let covered = 0;
    for (let ix = 0; ix < SAMPLES; ix++)
      for (let iy = 0; iy < SAMPLES; iy++) {
        const x = r.x0 + ((ix + 0.5) / SAMPLES) * (r.x1 - r.x0);
        const y = r.y0 + ((iy + 0.5) / SAMPLES) * (r.y1 - r.y0);
        for (let j = 0; j < sprites.length; j++) {
          if (j === i) continue;
          const inFront = depths[j]! < depths[i]! - 1e-9 || (Math.abs(depths[j]! - depths[i]!) <= 1e-9 && j > i);
          if (!inFront) continue;
          const o = rects[j]!;
          if (x >= o.x0 && x <= o.x1 && y >= o.y0 && y <= o.y1) {
            covered++;
            break;
          }
        }
      }
    return covered / (SAMPLES * SAMPLES);
  });
}

/** A 3×3 melee clump of mixed glyphs centred on grid cell (gx, gy). */
export const CLUMP_GLYPHS = ['M', 'g', 'a', '@', 'W', 'r', 's', 'h', 'b'] as const;

export function clumpAt(board: Board, gx: number, gy: number): Sprite[] {
  const out: Sprite[] = [];
  let k = 0;
  for (let dy = -1; dy <= 1; dy++)
    for (let dx = -1; dx <= 1; dx++) out.push({ glyph: CLUMP_GLYPHS[k++]!, pos: gridToWorld(board, gx + dx, gy + dy) });
  return out;
}

function pointInConvexQuad(px: number, py: number, quad: { x: number; y: number }[]): boolean {
  let sign = 0;
  for (let i = 0; i < 4; i++) {
    const a = quad[i]!;
    const b = quad[(i + 1) % 4]!;
    const cross = (b.x - a.x) * (py - a.y) - (b.y - a.y) * (px - a.x);
    if (cross !== 0) {
      const s = Math.sign(cross);
      if (sign === 0) sign = s;
      else if (s !== sign) return false;
    }
  }
  return true;
}

/** The on-screen polygon of a tile's top face. */
export function tilePolyPx(rig: Rig, board: Board, gx: number, gy: number): { x: number; y: number }[] {
  const c = gridToWorld(board, gx, gy);
  return [
    [-0.5, -0.5],
    [0.5, -0.5],
    [0.5, 0.5],
    [-0.5, 0.5],
  ].map(([dx, dz]) => toPx(rig, new THREE.Vector3(c.x + dx!, 0, c.z + dz!)));
}

/** Fraction of a standing unit's ink rect that lies over ITS OWN tile's top face. */
export function ownTileFraction(rig: Rig, board: Board, gx: number, gy: number, glyph: string, scale: number, mode: AnchorMode): number {
  const r = inkRectPx(rig, { glyph, pos: gridToWorld(board, gx, gy) }, scale, mode);
  const poly = tilePolyPx(rig, board, gx, gy);
  let inside = 0;
  for (let ix = 0; ix < SAMPLES; ix++)
    for (let iy = 0; iy < SAMPLES; iy++) {
      const x = r.x0 + ((ix + 0.5) / SAMPLES) * (r.x1 - r.x0);
      const y = r.y0 + ((iy + 0.5) / SAMPLES) * (r.y1 - r.y0);
      if (pointInConvexQuad(x, y, poly)) inside++;
    }
  return inside / (SAMPLES * SAMPLES);
}

export interface CellReport {
  /** Quad height, CSS px, at the near / centre / far row of the centre column. */
  glyphPxNear: number;
  glyphPxCentre: number;
  glyphPxFar: number;
  /** The centre tile's on-screen bounding box, CSS px. */
  tileWPx: number;
  tileHPx: number;
  /** |lean| of a world vertical: the board's near corner, and the worst of the four. */
  leanNearCornerDeg: number;
  leanMaxDeg: number;
  /** Clump ink-rect cover, centre of the board and the near-left corner: mean / max. */
  clumpCentreMean: number;
  clumpCentreMax: number;
  clumpCornerMean: number;
  clumpCornerMax: number;
  /** …and at the FAR row's centre — perspective's worst case (far rows see the shallowest effective pitch). */
  clumpFarMean: number;
  clumpFarMax: number;
  /** 'M' at the board centre: the fraction of its ink over its own tile; rows of tiles its ink spans. */
  ownTile: number;
  rowsSpanned: number;
  /**
   * A flyer ('V', camera-up lift) at the centre; the WORST-covered of the three
   * standing 'M's behind it (gy + 1, gx − 1..+1) — under yaw "straight up the
   * screen" lands on a diagonal neighbour, not the grid-north one.
   */
  flyerCoversNeighbour: number;
  flyerShadowGapPx: number;
  /** Does the whole padded frame fit the viewport? (the fit's own self-check) */
  fits: boolean;
}

export const FLYER_LIFT = 1.0;

/** `flyerLift` — §106a re-measures the user's by-eye 0.45 (the §105 verdict); the default stays 105a's worst case. */
export function report(
  view: View,
  board: Board,
  viewport: Viewport,
  scale: number,
  mode: AnchorMode,
  flyerLift: number = FLYER_LIFT,
): CellReport {
  const rig = fitRig(view, board, viewport);
  const cx = Math.floor(board.w / 2);
  const cy = Math.floor(board.h / 2);
  const quadH = (gx: number, gy: number): number => {
    const q = quadRectPx(rig, { glyph: 'M', pos: gridToWorld(board, gx, gy) }, scale, mode);
    return q.y1 - q.y0;
  };

  const poly = tilePolyPx(rig, board, cx, cy);
  const xs = poly.map((p) => p.x);
  const ys = poly.map((p) => p.y);
  const tileWPx = Math.max(...xs) - Math.min(...xs);
  const tileHPx = Math.max(...ys) - Math.min(...ys);

  const corners = [
    [0, 0],
    [board.w - 1, 0],
    [0, board.h - 1],
    [board.w - 1, board.h - 1],
  ] as const;
  const leans = corners.map(([gx, gy]) => Math.abs(leanDeg(rig, gridToWorld(board, gx, gy))));

  const centre = coveredFractions(rig, clumpAt(board, cx, cy), scale, mode);
  const corner = coveredFractions(rig, clumpAt(board, 1, 1), scale, mode);
  const far = coveredFractions(rig, clumpAt(board, cx, board.h - 2), scale, mode);
  const mean = (a: number[]): number => a.reduce((s, v) => s + v, 0) / a.length;

  const ink = inkRectPx(rig, { glyph: 'M', pos: gridToWorld(board, cx, cy) }, scale, mode);

  const flyer: Sprite = { glyph: 'V', pos: gridToWorld(board, cx, cy), lift: flyerLift };
  const flyerCover = Math.max(
    ...[-1, 0, 1].map((dx) => {
      const behind: Sprite = { glyph: 'M', pos: gridToWorld(board, cx + dx, cy + 1) };
      return coveredFractions(rig, [behind, flyer], scale, mode)[0]!;
    }),
  );
  const flyerInk = inkRectPx(rig, flyer, scale, mode);
  const shadow = toPx(rig, flyer.pos);

  // The fit's self-check: every corner of the padded frame box is on screen.
  let fits = true;
  const hx = board.w / 2 + XZ_PADDING;
  const hz = board.h / 2 + XZ_PADDING;
  for (const sx of [-1, 1])
    for (const sy of [-1, 1])
      for (const sz of [-1, 1]) {
        const p = toPx(rig, new THREE.Vector3(sx * hx, sy * Y_HALF_EXTENT, sz * hz));
        if (p.x < -0.5 || p.x > viewport.w + 0.5 || p.y < -0.5 || p.y > viewport.h + 0.5) fits = false;
      }

  return {
    glyphPxNear: quadH(cx, 0),
    glyphPxCentre: quadH(cx, cy),
    glyphPxFar: quadH(cx, board.h - 1),
    tileWPx,
    tileHPx,
    leanNearCornerDeg: leans[0]!,
    leanMaxDeg: Math.max(...leans),
    clumpCentreMean: mean(centre),
    clumpCentreMax: Math.max(...centre),
    clumpCornerMean: mean(corner),
    clumpCornerMax: Math.max(...corner),
    clumpFarMean: mean(far),
    clumpFarMax: Math.max(...far),
    ownTile: ownTileFraction(rig, board, cx, cy, 'M', scale, mode),
    rowsSpanned: (ink.y1 - ink.y0) / tileHPx,
    flyerCoversNeighbour: flyerCover,
    flyerShadowGapPx: shadow.y - flyerInk.y1,
    fits,
  };
}

export const BOARDS: Board[] = [
  { name: '15x15', w: 15, h: 15 },
  { name: '24x24', w: 24, h: 24 },
  { name: '12x32', w: 12, h: 32 },
];

/** The reference set (WORKLOG §Kickoff — from general knowledge, unverified against a survey). */
export const VIEWPORTS: Viewport[] = [
  { name: '2560x1440 (the user)', w: 2560, h: 1440, dpr: 1 },
  { name: '1920x1080', w: 1920, h: 1080, dpr: 1 },
  { name: '1366x768', w: 1366, h: 768, dpr: 1 },
  { name: '1280x720', w: 1280, h: 720, dpr: 1 },
  { name: '960x540', w: 960, h: 540, dpr: 1 },
  { name: '1024x768', w: 1024, h: 768, dpr: 1 },
  { name: '844x390 phone-land', w: 844, h: 390, dpr: 3 },
  { name: '390x844 phone-port', w: 390, h: 844, dpr: 3 },
];

// ─────────────────────────────────────────────────────────────────────────────
// §106a — THE N×N SLAB UNDER YAW (the §105 verdict's finding 2). At yaw 45 a
// rubble slab stood askew on its diamond with its bottom clipped, because R11
// (`BattleRenderer.unitAnchorPos`) anchors an N×N body at its NEAR-ROW centre —
// written for "the camera never rotates". Three measures, each re-derived here
// from the camera and the tile geometry (never from BattleRenderer):
//   - `lateral`   the ink's base midpoint vs the footprint's on-screen centre,
//                 sideways ("askew"), as a fraction of the footprint's width;
//   - `baseInside` both ink base corners inside the footprint's on-screen
//                 polygon (the plane of the footprint's highest tile top);
//   - `occluded`  the fraction of the ink whose ray to the camera passes
//                 through FOOTPRINT terrain — tile prisms and §37b hill mounds.
//                 Terrain OUTSIDE the footprint may occlude a slab legitimately
//                 (a hill in front of it) and is not counted.
// Plus `sortCost`, report-only: the worst ink fraction of a neighbouring unit
// nearer than the footprint's centre that the slab paints OVER (the sort key
// is the instance position, so a rule that moves it moves the sort).
// ─────────────────────────────────────────────────────────────────────────────

/** Copied from TerrainRenderer: the prism bottom, the floor band, the §37b mound constants. */
export const TERRAIN_BOTTOM_Y = -1.5;
export const FLOOR_LO = -0.3;
export const FLOOR_HI = 0.0;
/** A mound's centre: its quadrant offset (±0.22) plus the MAX noise jitter (`jx * 0.1`), pushed
 *  OUTWARD — the worst case, where a max-radius mound overhangs its own tile by 0.08. */
const MOUND_REACH = 0.22 + 0.1;
const MOUND_OFFSETS = [
  [-MOUND_REACH, -MOUND_REACH],
  [MOUND_REACH, -MOUND_REACH],
  [MOUND_REACH, MOUND_REACH],
  [-MOUND_REACH, MOUND_REACH],
] as const;
const MOUND_MAX_H = 0.34;
const MOUND_MAX_R = 0.26;

/** Every N×N body in the catalog today is rubble (`rubble_2x2` / `rubble_3x3`). */
export const SLAB_GLYPH = '▄';

/** Tile-top world Y per grid cell — a TEST INPUT (the real field is TerrainRenderer's noise). */
export type HeightField = (gx: number, gy: number) => number;

export interface SlabCase {
  board: Board;
  /** The canonical corner (`unit.position`: the min-x, min-y cell) and the side. */
  gx: number;
  gy: number;
  n: number;
  heights: HeightField;
  /** Every footprint cell a `hills` tile carrying four MAX-size mounds — the worst case. */
  mounds?: boolean;
}

/** A slab rule: the INSTANCE POSITION — what the billboard shader and the depth sort both read. */
export type SlabRule = (c: SlabCase, rig: Rig) => THREE.Vector3;

function footprintCells(c: SlabCase): [number, number][] {
  const out: [number, number][] = [];
  for (let dy = 0; dy < c.n; dy++) for (let dx = 0; dx < c.n; dx++) out.push([c.gx + dx, c.gy + dy]);
  return out;
}

function footprintTopY(c: SlabCase): number {
  return Math.max(...footprintCells(c).map(([x, y]) => c.heights(x, y)));
}

/** The footprint's outer rectangle in world XZ (grid +y runs toward world −z). */
function footprintBounds(c: SlabCase): { x0: number; x1: number; z0: number; z1: number } {
  const x0 = c.gx - c.board.w / 2;
  const zNear = c.board.h / 2 - c.gy;
  return { x0, x1: x0 + c.n, z0: zNear - c.n, z1: zNear };
}

function mound(cx: number, base: number, cz: number): { apex: THREE.Vector3; corners: THREE.Vector3[] } {
  return {
    apex: new THREE.Vector3(cx, base + MOUND_MAX_H, cz),
    corners: [
      [-1, -1],
      [1, -1],
      [1, 1],
      [-1, 1],
    ].map(([sx, sz]) => new THREE.Vector3(cx + sx! * MOUND_MAX_R, base, cz + sz! * MOUND_MAX_R)),
  };
}

function footprintMounds(c: SlabCase): ReturnType<typeof mound>[] {
  if (!c.mounds) return [];
  return footprintCells(c).flatMap(([gx, gy]) => {
    const centre = gridToWorld(c.board, gx, gy);
    return MOUND_OFFSETS.map(([ox, oz]) => mound(centre.x + ox, c.heights(gx, gy), centre.z + oz));
  });
}

/** Every VERTEX of the footprint's terrain: a linear depth is minimized at one. */
function footprintTerrainVertices(c: SlabCase): THREE.Vector3[] {
  const out: THREE.Vector3[] = [];
  for (const [gx, gy] of footprintCells(c)) {
    const centre = gridToWorld(c.board, gx, gy);
    const h = c.heights(gx, gy);
    for (const sx of [-0.5, 0.5]) for (const sz of [-0.5, 0.5]) out.push(new THREE.Vector3(centre.x + sx, h, centre.z + sz));
  }
  for (const m of footprintMounds(c)) out.push(m.apex, ...m.corners);
  return out;
}

function isOrtho(rig: Rig): boolean {
  return (rig.camera as THREE.OrthographicCamera).isOrthographicCamera === true;
}

/** Unit vector from `p` toward the camera along the ray that draws `p`. */
function towardCamera(rig: Rig, p: THREE.Vector3): THREE.Vector3 {
  if (isOrtho(rig)) return rig.fwd.clone().negate();
  return new THREE.Vector3().setFromMatrixPosition(rig.camera.matrixWorld).sub(p).normalize();
}

/** Today's rule, restated from `unitAnchorPos` (R11): the NEAR-ROW centre, Y = the near row's max. */
export const slabToday: SlabRule = (c) => {
  const p = gridToWorld(c.board, c.gx, c.gy);
  p.x += (c.n - 1) / 2;
  p.y = Math.max(...Array.from({ length: c.n }, (_, i) => c.heights(c.gx + i, c.gy)));
  return p;
};

/** The verdict's shape, part one: the footprint CENTRE, Y = the WHOLE footprint's max (§79d2 rider 2's near-row max, generalized). */
export const slabCentre: SlabRule = (c) => {
  const b = footprintBounds(c);
  return new THREE.Vector3((b.x0 + b.x1) / 2, footprintTopY(c), (b.z0 + b.z1) / 2);
};

/** Part two: `slabCentre` slid along its own view ray until it is nearer than every footprint terrain vertex. */
export const slabCentreSlid: SlabRule = (c, rig) => {
  const p = slabCentre(c, rig);
  const nearest = Math.min(...footprintTerrainVertices(c).map((q) => q.dot(rig.fwd)));
  const gap = p.dot(rig.fwd) - nearest;
  if (gap <= 0) return p;
  const toward = towardCamera(rig, p);
  // Moving s along `toward` changes the planar depth by s · (toward · fwd), which is < 0.
  return p.addScaledVector(toward, (gap + 1e-4) / -toward.dot(rig.fwd));
};

export interface SlabReport {
  lateral: number;
  baseInside: boolean;
  occluded: number;
  sortCost: number;
}

const _ray = new THREE.Ray();
const _box = new THREE.Box3();
const _hit = new THREE.Vector3();

function hitsFootprintTerrain(c: SlabCase, origin: THREE.Vector3, dir: THREE.Vector3): boolean {
  _ray.origin.copy(origin).addScaledVector(dir, 1e-7);
  _ray.direction.copy(dir);
  for (const [gx, gy] of footprintCells(c)) {
    const centre = gridToWorld(c.board, gx, gy);
    _box.min.set(centre.x - 0.5, TERRAIN_BOTTOM_Y, centre.z - 0.5);
    _box.max.set(centre.x + 0.5, c.heights(gx, gy), centre.z + 0.5);
    if (_ray.intersectsBox(_box)) return true;
  }
  for (const m of footprintMounds(c)) {
    for (let i = 0; i < 4; i++) {
      if (_ray.intersectTriangle(m.apex, m.corners[i]!, m.corners[(i + 1) % 4]!, false, _hit)) return true;
    }
  }
  return false;
}

export function slabReport(rig: Rig, c: SlabCase, rule: SlabRule): SlabReport {
  const anchor = rule(c, rig);
  const slab: Sprite = { glyph: SLAB_GLYPH, pos: anchor, size: c.n };
  const ink = inkRectPx(rig, slab, 1, 'today');

  const b = footprintBounds(c);
  const top = footprintTopY(c);
  const poly = [
    [b.x0, b.z1],
    [b.x1, b.z1],
    [b.x1, b.z0],
    [b.x0, b.z0],
  ].map(([x, z]) => toPx(rig, new THREE.Vector3(x!, top, z!)));
  const xs = poly.map((p) => p.x);
  const centre = toPx(rig, new THREE.Vector3((b.x0 + b.x1) / 2, top, (b.z0 + b.z1) / 2));
  const lateral = Math.abs((ink.x0 + ink.x1) / 2 - centre.x) / (Math.max(...xs) - Math.min(...xs));
  const baseInside = pointInConvexQuad(ink.x0, ink.y1, poly) && pointInConvexQuad(ink.x1, ink.y1, poly);

  // The ink, sampled in WORLD space: the quad offsets along the camera's right /
  // up about the anchor (billboard.vert.glsl, view space = the camera basis).
  const [ix0, iy0, ix1, iy1] = inkOf(SLAB_GLYPH);
  const anchorY = anchorYFor(SLAB_GLYPH, 'today');
  let hits = 0;
  const q = new THREE.Vector3();
  for (let i = 0; i < SAMPLES; i++)
    for (let j = 0; j < SAMPLES; j++) {
      const cx = ix0 + ((i + 0.5) / SAMPLES) * (ix1 - ix0);
      const cy = iy0 + ((j + 0.5) / SAMPLES) * (iy1 - iy0);
      q.copy(anchor)
        .addScaledVector(rig.right, (cx - 0.5) * c.n)
        .addScaledVector(rig.up, (cy - 0.5 - anchorY) * c.n);
      if (hitsFootprintTerrain(c, q, towardCamera(rig, q))) hits++;
    }

  const centreDepth = new THREE.Vector3((b.x0 + b.x1) / 2, top, (b.z0 + b.z1) / 2).dot(rig.fwd);
  let sortCost = 0;
  for (let gy = c.gy - 1; gy <= c.gy + c.n; gy++)
    for (let gx = c.gx - 1; gx <= c.gx + c.n; gx++) {
      const inside = gx >= c.gx && gx < c.gx + c.n && gy >= c.gy && gy < c.gy + c.n;
      if (inside || gx < 0 || gy < 0 || gx >= c.board.w || gy >= c.board.h) continue;
      const pos = gridToWorld(c.board, gx, gy);
      pos.y = c.heights(gx, gy);
      if (pos.dot(rig.fwd) >= centreDepth) continue; // not in front of the slab
      sortCost = Math.max(sortCost, coveredFractions(rig, [{ glyph: 'M', pos }, slab], 1, 'today')[0]!);
    }

  return { lateral, baseInside, occluded: hits / (SAMPLES * SAMPLES), sortCost };
}

/** The height patterns the pins sweep, as functions of the offset from the slab's corner. */
export const HEIGHT_PATTERNS: Record<string, (dx: number, dy: number) => number> = {
  flat: () => 0,
  /** The rows today's rule ignores stand TALLER than its near row — the §79d2 bite, re-armed by yaw. */
  farHigh: (_dx, dy) => (dy <= 0 ? FLOOR_LO : FLOOR_HI),
  nearHigh: (_dx, dy) => (dy <= 0 ? FLOOR_HI : FLOOR_LO),
  checker: (dx, dy) => ((((dx + dy) % 2) + 2) % 2 === 0 ? FLOOR_HI : FLOOR_LO),
};

export function slabCase(board: Board, gx: number, gy: number, n: number, pattern: string, mounds = false): SlabCase {
  const f = HEIGHT_PATTERNS[pattern];
  if (!f) throw new Error(`no height pattern ${JSON.stringify(pattern)}`);
  return { board, gx, gy, n, heights: (x, y) => f(x - gx, y - gy), mounds };
}

/** `rubbleQuarry`'s five N×N slabs, cell for cell (config/layouts.json — the §105c fixture). */
export const RUBBLE_QUARRY: Board = { name: 'rubbleQuarry 14x12', w: 14, h: 12 };
export const RUBBLE_QUARRY_SLABS: readonly { gx: number; gy: number; n: number }[] = [
  { gx: 2, gy: 5, n: 3 },
  { gx: 8, gy: 5, n: 2 },
  { gx: 10, gy: 7, n: 2 },
  { gx: 5, gy: 2, n: 3 },
  { gx: 11, gy: 3, n: 3 },
];
