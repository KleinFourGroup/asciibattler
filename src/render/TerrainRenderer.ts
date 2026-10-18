import * as THREE from 'three';
import { createNoise2D } from 'simplex-noise';
import { RNG } from '../core/RNG';
import type { TileGrid, TileKind } from '../sim/TileGrid';
import { COLORS } from './palette';
import { LAYOUT_MAX_SIDE, type Theme } from '../config/layouts';
import VERTEX_SHADER from './shaders/terrain.vert.glsl?raw';
import FRAGMENT_SHADER from './shaders/terrain.frag.glsl?raw';
import MARKS_CHUNK from './shaders/terrainMarks.glsl?raw';
import {
  BIN_DEPTH,
  BIN_TEXELS,
  BINS_TEX_H,
  BINS_TEX_W,
  DEFAULT_MARK_STYLE,
  MARKS_PER_ROW,
  MARKS_TEX_H,
  MARKS_TEX_W,
  MarkTable,
  type Mark,
  type MarkStyle,
} from './groundMarks';

/**
 * The terrain: one faceted prism per tile.
 *
 * Heights come from a fixed-seed simplex field, so the look is canonical and
 * not a per-battle roll. Floor tops lie in [FLOOR_RANGE_LO, FLOOR_RANGE_HI];
 * water sinks to WATER_TOP_Y so the recess reads at a glance. A floor top's
 * colour lerps across its theme's palette by the same height
 * (`FLOOR_PALETTE`), so the variance reads in shape and in colour.
 *
 * Geometry is non-indexed (each face owns its normals) for hard-edged
 * faceted shading. The fragment shader lights it from a fixed direction,
 * with no scene lights, so nothing spills onto the sprite renderers, which
 * are unlit.
 *
 * The buffers are allocated once, for the largest board
 * (`LAYOUT_MAX_SIDE × LAYOUT_MAX_SIDE`), and `setTiles` sets the draw range
 * to the cells a battle's board occupies, so no board size reallocates. The
 * cost: about 1.6 MB of vertex data held from boot, all of it uploaded at
 * each `setTiles`.
 *
 * `heightAt(cx, cy, kind)` is the height field's public hook: BattleRenderer
 * stands each sprite on its tile's top with it, and the apron and the slab
 * rule read it too.
 *
 * The ground marks: the terrain draws every body's mark itself, as shapes
 * evaluated per fragment from a table rebuilt each frame and binned per tile
 * (groundMarks.ts, shaders/terrainMarks.glsl), so a mark lies on tile tops,
 * step faces and hill mounds alike, and its depth is the terrain's.
 * `beginMarks` and `addMark` each frame; the table uploads at the frame's
 * first terrain draw.
 */

const VERTS_PER_TILE = 30; // 5 quads × 2 tris × 3 verts (top + 4 sides; bottom omitted — never visible from the locked camera pitch)
/** The prisms' bottom: low enough that the chasm prism (top −1.2) keeps 0.3
 *  of side in view. Other tiles' sides are bounded above by their tops, so
 *  the depth shows only at a chasm's edge and at the board's own edge, which
 *  the camera's pitch barely sees. Exported: the apron's prisms share it, so
 *  the seam has no step, and the mist floor lies at it. */
export const BOTTOM_Y = -1.5;

const WATER_TOP_Y = -0.4;
/** The chasm's top: deep enough, against water's −0.4, to read at the
 *  camera's pitch as a pit to keep out of. */
const CHASM_TOP_Y = -1.2;
const FLOOR_RANGE_LO = -0.3;
const FLOOR_RANGE_HI = 0.0;
/** Mud: a fixed plane near the floor band's low end, below most floor tops,
 *  for a bogged-down read. Not noise-varied, so a mud flat looks uniformly
 *  waterlogged. */
const MUD_TOP_Y = -0.25;
/** Hill mounds. A `hills` tile stays flat ground (the floor band); its relief
 *  is a scatter of low-poly mounds laid over the tile (the `bumpsMesh`
 *  child), placed and sized from the fixed noise field, so the look is
 *  canonical. Each mound is a four-sided pyramid with an open base, which the
 *  camera's pitch never shows. QUAD_OFFSETS holds one base position per
 *  mound. */
const BUMPS_PER_HILL_TILE = 4;
const VERTS_PER_BUMP = 12; // 4 pyramid side-tris × 3 verts
const VERTS_PER_HILL_TILE = BUMPS_PER_HILL_TILE * VERTS_PER_BUMP;
const HILL_BUMP_MIN_H = 0.12;
const HILL_BUMP_MAX_H = 0.34;
const HILL_BUMP_MIN_R = 0.15;
const HILL_BUMP_MAX_R = 0.26;
/** Each mound's base sits ±this from its cell centre on both axes (cell-local,
 *  the cell spans 1 unit), before the jitter. */
const HILL_BUMP_QUAD = 0.22;
/** The noise jitter on a mound's base position, per axis (noise is in [−1, 1]). */
const HILL_BUMP_JITTER = 0.1;
/** Per-mound base position within a cell. */
const QUAD_OFFSETS: ReadonlyArray<readonly [number, number]> = [
  [-HILL_BUMP_QUAD, -HILL_BUMP_QUAD],
  [HILL_BUMP_QUAD, -HILL_BUMP_QUAD],
  [HILL_BUMP_QUAD, HILL_BUMP_QUAD],
  [-HILL_BUMP_QUAD, HILL_BUMP_QUAD],
];

/**
 * The worst-case hill mound, for code that must clear the mounds without
 * reading the bump mesh (the N×N slab rule, `slabAnchor.ts`): a mound's apex
 * is at most `reach` from its cell centre on each axis and at most `maxH`
 * above the tile top, and its base extends at most `maxR` from the apex on
 * each axis.
 */
export const HILL_MOUND_ENVELOPE = {
  reach: HILL_BUMP_QUAD + HILL_BUMP_JITTER,
  maxH: HILL_BUMP_MAX_H,
  maxR: HILL_BUMP_MAX_R,
} as const;
const NOISE_FREQ = 0.42;
/** Fixed seed: the visual character is canonical, not a per-battle roll. */
const NOISE_SEED = 0xb1c1a1b;

/** The diffuse light's direction, in view space: the shaders dot it with the
 *  view-space normal (`normalMatrix`), so the light turns with the camera.
 *  Exported, with AMBIENT and SIDE_SHADE, so the apron lights its ring the
 *  same; each material clones the vector, so neither can change the other's
 *  uniform. */
export const LIGHT_DIR = new THREE.Vector3(0.4, 0.85, 0.35).normalize();
/** Ambient floor — sides never go fully black. */
export const AMBIENT = 0.45;
/** Side-face color multiplier vs top (darker for face-to-face contrast). */
export const SIDE_SHADE = 0.7;
/** Top-face grid-line width as a fraction of cell size. */
const GRID_LINE_WIDTH = 0.06;

/** The per-tile animation id in `aAnim.x`, which both fragment shaders branch
 *  on: fire's flicker, healing's slower pulse, and deep water's bands (the
 *  passable/impassable tell beside the hue). 0 is none. The apron's tiles
 *  carry the same ids, so its clamp-sampled tiles keep animating into the
 *  fog. */
export const ANIM_NONE = 0;
export const ANIM_FIRE = 1;
export const ANIM_HEALING = 2;
export const ANIM_DEEP_WATER = 3;

/** The one kind → `aAnim.x` mapping, shared by the terrain and the apron;
 *  pinned in TerrainRenderer.test.ts so no kind falls to the wrong branch. */
export function animTypeFor(kind: TileKind): number {
  switch (kind) {
    case 'fire':
      return ANIM_FIRE;
    case 'healing':
      return ANIM_HEALING;
    case 'deep_water':
      return ANIM_DEEP_WATER;
    default:
      return ANIM_NONE;
  }
}

/** The buffers' capacity in tiles: the largest board, so any board fits
 *  without reallocating. */
const MAX_TILES = LAYOUT_MAX_SIDE * LAYOUT_MAX_SIDE;

/** Replace the one occurrence of `anchor` in `source`; throw if it is not there
 *  exactly once, so a shader edit that moves an anchor fails loudly. */
function spliceOnce(source: string, anchor: string, replacement: string): string {
  const at = source.indexOf(anchor);
  if (at < 0 || source.indexOf(anchor, at + 1) >= 0) {
    throw new Error(`TerrainRenderer: shader anchor must occur exactly once: ${anchor}`);
  }
  return source.slice(0, at) + replacement + source.slice(at + anchor.length);
}

const VERTEX_MARKS_ANCHOR = '  vWorldPos = (modelMatrix * vec4(position, 1.0)).xyz;'; // i18n-ok — shader source
const FRAGMENT_MARKS_ANCHOR = '  gl_FragColor = vec4(base, 1.0);'; // i18n-ok — shader source

/**
 * The terrain shaders with the ground marks spliced in (the chunk is
 * shaders/terrainMarks.glsl). Only insertions: the world-space normal the
 * tile lookup needs, the chunk and its defines before `main`, and one call
 * before the fragment's write. With the marks off the terrain uses
 * `VERTEX_SHADER` and `FRAGMENT_SHADER` untouched, which is what the
 * frame-cost bench's marks-off legs measure.
 */
export function groundMarkShaders(): { vertexShader: string; fragmentShader: string } {
  const defines =
    `#define MARK_BIN_DEPTH ${BIN_DEPTH}\n` + // i18n-ok — shader source
    `#define MARK_BIN_TEXELS ${BIN_TEXELS}\n` + // i18n-ok — shader source
    `#define MARKS_PER_ROW ${MARKS_PER_ROW}\n`; // i18n-ok — shader source
  let vertexShader = spliceOnce(VERTEX_SHADER, 'void main() {', 'varying vec3 vMarkNormal;\n\nvoid main() {'); // i18n-ok — shader source
  vertexShader = spliceOnce(
    vertexShader,
    VERTEX_MARKS_ANCHOR,
    `${VERTEX_MARKS_ANCHOR}\n  vMarkNormal = mat3(modelMatrix) * normal;`, // i18n-ok — shader source
  );
  let fragmentShader = spliceOnce(FRAGMENT_SHADER, 'void main() {', `${defines}\n${MARKS_CHUNK}\nvoid main() {`); // i18n-ok — shader source
  fragmentShader = spliceOnce(
    fragmentShader,
    FRAGMENT_MARKS_ANCHOR,
    `  base = applyGroundMarks(base);\n${FRAGMENT_MARKS_ANCHOR}`, // i18n-ok — shader source
  );
  return { vertexShader, fragmentShader };
}

/** An unfiltered RGBA32F texture over `data`, for `texelFetch`. */
function dataTexture(data: Float32Array, width: number, height: number): THREE.DataTexture {
  const texture = new THREE.DataTexture(data, width, height, THREE.RGBAFormat, THREE.FloatType);
  texture.needsUpdate = true;
  return texture;
}

export class TerrainRenderer {
  readonly mesh: THREE.Mesh;

  private gridW: number;
  private gridH: number;
  /** The battle's theme, captured at `setTiles`; `topColorFor` reads it for
   *  the floor's palette. */
  private theme: Theme = 'grassland';
  private readonly geometry: THREE.BufferGeometry;
  private readonly material: THREE.ShaderMaterial;
  /** The hill mounds (a child of `mesh`): their own geometry, sized at each
   *  `setTiles` to the hills count, drawn with a DoubleSide clone of the
   *  terrain material. The clone's `uTime` never advances, which mounds,
   *  having no animation, don't need; DoubleSide spares per-face winding. */
  private readonly bumpsGeometry: THREE.BufferGeometry;
  private readonly bumpsMaterial: THREE.ShaderMaterial;
  private readonly bumpsMesh: THREE.Mesh;
  private readonly positions: Float32Array;
  private readonly normals: Float32Array;
  private readonly colors: Float32Array;
  private readonly topUVs: Float32Array;
  /** Per vertex (animType, phase): the id picks the fragment shader's
   *  branch, and the phase, per tile, keeps neighbouring fire tiles out of
   *  unison. */
  private readonly anims: Float32Array;
  private readonly positionAttr: THREE.BufferAttribute;
  private readonly normalAttr: THREE.BufferAttribute;
  private readonly colorAttr: THREE.BufferAttribute;
  private readonly topUVAttr: THREE.BufferAttribute;
  private readonly animAttr: THREE.BufferAttribute;

  private readonly noise2D: (x: number, y: number) => number;
  private readonly tmpTopColor = new THREE.Color();
  private readonly tmpSideColor = new THREE.Color();

  /** This frame's ground marks (groundMarks.ts). BattleRenderer begins and
   *  fills it after the lerps, the board explorer adds its posed marks after
   *  that, and the frame's first terrain draw bins and uploads it. */
  private readonly markTable = new MarkTable();
  private readonly marksTexture: THREE.DataTexture;
  private readonly binsTexture: THREE.DataTexture;
  /** The marks' uniform objects, shared by the prisms' material and the
   *  mounds' clone: `ShaderMaterial.clone()` copies uniforms, so a clone left
   *  alone would draw stale marks or none. */
  private readonly markUniforms: {
    readonly uMarks: THREE.IUniform<THREE.DataTexture>;
    readonly uMarkBins: THREE.IUniform<THREE.DataTexture>;
    readonly uMarkGrid: THREE.IUniform<THREE.Vector2>;
    readonly uMarkCount: THREE.IUniform<number>;
    readonly uContactStyle: THREE.IUniform<THREE.Vector4>;
    readonly uPlateStyle: THREE.IUniform<THREE.Vector4>;
    readonly uPlateDashGap: THREE.IUniform<number>;
  };
  private marksDirty = false;
  private marksOn = true;
  private style: MarkStyle = DEFAULT_MARK_STYLE;

  constructor() {
    this.gridW = 0;
    this.gridH = 0;

    const rng = new RNG(NOISE_SEED);
    this.noise2D = createNoise2D(() => rng.next());

    const totalVerts = MAX_TILES * VERTS_PER_TILE;
    this.positions = new Float32Array(totalVerts * 3);
    this.normals = new Float32Array(totalVerts * 3);
    this.colors = new Float32Array(totalVerts * 3);
    this.topUVs = new Float32Array(totalVerts * 2);
    this.anims = new Float32Array(totalVerts * 2);

    this.geometry = new THREE.BufferGeometry();
    this.positionAttr = new THREE.BufferAttribute(this.positions, 3);
    this.normalAttr = new THREE.BufferAttribute(this.normals, 3);
    this.colorAttr = new THREE.BufferAttribute(this.colors, 3);
    this.topUVAttr = new THREE.BufferAttribute(this.topUVs, 2);
    this.animAttr = new THREE.BufferAttribute(this.anims, 2);
    this.positionAttr.setUsage(THREE.DynamicDrawUsage);
    this.normalAttr.setUsage(THREE.DynamicDrawUsage);
    this.colorAttr.setUsage(THREE.DynamicDrawUsage);
    this.animAttr.setUsage(THREE.DynamicDrawUsage);
    this.geometry.setAttribute('position', this.positionAttr);
    this.geometry.setAttribute('normal', this.normalAttr);
    this.geometry.setAttribute('aColor', this.colorAttr);
    this.geometry.setAttribute('aTopUV', this.topUVAttr);
    this.geometry.setAttribute('aAnim', this.animAttr);
    // A loose bounding sphere at the largest board's extent: the mesh is
    // centred on the origin and the camera frames the whole board, so
    // culling at this radius costs nothing.
    this.geometry.boundingSphere = new THREE.Sphere(
      new THREE.Vector3(0, BOTTOM_Y / 2, 0),
      LAYOUT_MAX_SIDE,
    );
    // Start with nothing drawn — `setTiles` configures both the content
    // and the draw range. Pre-setTiles renders read an empty mesh.
    this.geometry.setDrawRange(0, 0);

    this.marksTexture = dataTexture(this.markTable.marks, MARKS_TEX_W, MARKS_TEX_H);
    this.binsTexture = dataTexture(this.markTable.bins, BINS_TEX_W, BINS_TEX_H);
    this.markUniforms = {
      uMarks: { value: this.marksTexture },
      uMarkBins: { value: this.binsTexture },
      uMarkGrid: { value: new THREE.Vector2(0, 0) },
      uMarkCount: { value: 0 },
      uContactStyle: { value: new THREE.Vector4() },
      uPlateStyle: { value: new THREE.Vector4() },
      uPlateDashGap: { value: 0 },
    };
    this.writeMarkStyle();

    this.material = new THREE.ShaderMaterial({
      ...groundMarkShaders(),
      uniforms: {
        ...this.markUniforms,
        uLightDir: { value: LIGHT_DIR.clone() },
        uAmbient: { value: AMBIENT },
        uGridLineColor: { value: new THREE.Color(COLORS.TERMINAL_BLACK) },
        uGridLineWidth: { value: GRID_LINE_WIDTH },
        // Seconds of shader time, accumulated by `advanceTime`.
        uTime: { value: 0 },
      },
    });

    this.mesh = new THREE.Mesh(this.geometry, this.material);

    // The mound child. Empty until `setTiles` fills it; it rides the parent's
    // transform, and its raycast is a no-op, so a raycast of `mesh` with its
    // children hits only the tiles (`pickCell` doesn't take children).
    this.bumpsGeometry = new THREE.BufferGeometry();
    this.bumpsGeometry.setDrawRange(0, 0);
    this.bumpsMaterial = this.material.clone();
    this.bumpsMaterial.side = THREE.DoubleSide;
    // The clone copied the mark uniforms; point it back at the shared ones.
    Object.assign(this.bumpsMaterial.uniforms, this.markUniforms);
    this.bumpsMesh = new THREE.Mesh(this.bumpsGeometry, this.bumpsMaterial);
    this.bumpsMesh.frustumCulled = false; // small geometry, always in frame
    this.bumpsMesh.raycast = () => {}; // unclickable — picking hits the base tile
    this.mesh.add(this.bumpsMesh);

    // The frame's marks are uploaded by whichever of the two meshes draws
    // first (opaque draw order is three's to choose).
    this.mesh.onBeforeRender = () => this.commitMarks();
    this.bumpsMesh.onBeforeRender = () => this.commitMarks();
  }

  /** The marks' look; the board explorer dials the plates' corner. */
  get markStyle(): MarkStyle {
    return this.style;
  }

  setMarkStyle(style: MarkStyle): void {
    this.style = style;
    this.writeMarkStyle();
  }

  /** Are the ground marks drawn? */
  get groundMarksOn(): boolean {
    return this.marksOn;
  }

  /**
   * Draw the ground marks or not. Off swaps both materials back to the plain
   * terrain shaders (a recompile) and empties the table: the frame-cost
   * bench's marks-off legs, and the board explorer's marks dial.
   */
  setGroundMarks(on: boolean): void {
    if (on === this.marksOn) return;
    this.marksOn = on;
    const shaders = on ? groundMarkShaders() : { vertexShader: VERTEX_SHADER, fragmentShader: FRAGMENT_SHADER };
    for (const material of [this.material, this.bumpsMaterial]) {
      material.vertexShader = shaders.vertexShader;
      material.fragmentShader = shaders.fragmentShader;
      material.needsUpdate = true;
    }
    this.beginMarks(this.markTable.grid.gridW, this.markTable.grid.gridH);
  }

  /**
   * Start this frame's marks for a `gridW × gridH` board; `addMark` each one.
   * The table is binned and uploaded when the terrain next draws, so anything
   * added before the render is in the frame.
   */
  beginMarks(gridW: number, gridH: number): void {
    this.markTable.begin(gridW, gridH);
    this.marksDirty = true;
  }

  addMark(mark: Mark): void {
    if (this.marksOn) this.markTable.add(mark);
  }

  /** The last upload's counts, for probes and the bench. */
  get markStats(): { count: number; overflow: number; maxBin: number } {
    const t = this.markTable;
    return { count: t.count, overflow: t.overflow, maxBin: t.maxBin };
  }

  private commitMarks(): void {
    if (!this.marksDirty) return;
    this.marksDirty = false;
    this.markTable.finish();
    this.marksTexture.needsUpdate = true;
    this.binsTexture.needsUpdate = true;
    const { gridW, gridH } = this.markTable.grid;
    this.markUniforms.uMarkGrid.value.set(gridW, gridH);
    this.markUniforms.uMarkCount.value = this.marksOn ? this.markTable.count : 0;
  }

  private writeMarkStyle(): void {
    const s = this.style;
    this.markUniforms.uContactStyle.value.set(s.contactFill, s.contactOutline, s.contactStroke, 0);
    this.markUniforms.uPlateStyle.value.set(s.plateFill, s.plateOutline, s.plateStroke, s.plateCorner);
    this.markUniforms.uPlateDashGap.value = s.plateDashGap;
  }

  /**
   * The top Y of the cell at (cx, cy), given its kind. The function the
   * geometry uses, exposed so other renderers stand on the surface without a
   * second source of truth.
   */
  heightAt(cx: number, cy: number, kind: TileKind): number {
    // Deep water is level with shallow water: its depth reads through its
    // colour and its bands, since a sunken surface looked wrong against
    // shallow water.
    if (kind === 'shallow_water' || kind === 'deep_water') return WATER_TOP_Y;
    if (kind === 'chasm') return CHASM_TOP_Y;
    if (kind === 'mud') return MUD_TOP_Y;
    // Fire, healing, ice, sand and hills share the floor's noise field: they
    // are surfaces, not elevations (hills' relief is the mound mesh), and a
    // sprite on any of them stands on a tile top.
    const n = this.noise2D(cx * NOISE_FREQ, cy * NOISE_FREQ); // [-1, 1]
    const t = (n + 1) * 0.5;
    return FLOOR_RANGE_LO + (FLOOR_RANGE_HI - FLOOR_RANGE_LO) * t;
  }

  /**
   * Advance the shader's `uTime`, for fire's flicker, healing's pulse and
   * deep water's drift. BattleScene calls it on the battle's scaled time and
   * holds it under reduced motion (`advanceShaderTime`). It accumulates with
   * no wrap; fp32 keeps a clean second-grain count for hours.
   */
  advanceTime(dt: number): void {
    const u = this.material.uniforms['uTime']!;
    u.value = (u.value as number) + dt;
  }

  /**
   * Set the mesh for a `gridW × gridH` board. The buffers were sized at
   * construction for the largest board; the draw range covers this board's
   * cells, so a smaller or non-square board draws no junk from the unused
   * slots.
   */
  setTiles(tileGrid: TileGrid, gridW: number, gridH: number, theme: Theme = 'grassland'): void {
    if (gridW * gridH > MAX_TILES) {
      throw new Error(
        `TerrainRenderer.setTiles: ${gridW}x${gridH} exceeds capacity ${MAX_TILES}`,
      );
    }
    this.gridW = gridW;
    this.gridH = gridH;
    this.theme = theme;
    const kindAt = (x: number, y: number): TileKind => tileGrid.kindAt({ x, y });
    this.fillFromKindFn(kindAt);
    this.geometry.setDrawRange(0, gridW * gridH * VERTS_PER_TILE);
    this.fillHillBumps(kindAt, gridW, gridH);
  }

  clear(): void {
    this.gridW = 0;
    this.gridH = 0;
    this.geometry.setDrawRange(0, 0);
    this.bumpsGeometry.setDrawRange(0, 0);
    this.beginMarks(0, 0);
  }

  /** Walks every cell, computes height + color, writes 30 verts per cell. */
  private fillFromKindFn(kindAt: (x: number, y: number) => TileKind): void {
    const w = this.gridW;
    const h = this.gridH;
    const halfX = w / 2;
    const halfZ = h / 2;
    const pos = this.positions;
    const norm = this.normals;
    const col = this.colors;
    const uv = this.topUVs;
    const anim = this.anims;
    let vi = 0;

    const writeVert = (
      px: number, py: number, pz: number,
      nx: number, ny: number, nz: number,
      color: THREE.Color,
      uvU: number, uvV: number,
    ): void => {
      const pi = vi * 3;
      const ti = vi * 2;
      pos[pi] = px; pos[pi + 1] = py; pos[pi + 2] = pz;
      norm[pi] = nx; norm[pi + 1] = ny; norm[pi + 2] = nz;
      col[pi] = color.r; col[pi + 1] = color.g; col[pi + 2] = color.b;
      uv[ti] = uvU; uv[ti + 1] = uvV;
      vi++;
    };

    for (let cy = 0; cy < h; cy++) {
      for (let cx = 0; cx < w; cx++) {
        const kind = kindAt(cx, cy);
        const topY = this.heightAt(cx, cy, kind);
        topColorFor(topY, kind, this.theme, this.tmpTopColor);
        this.tmpSideColor.copy(this.tmpTopColor).multiplyScalar(SIDE_SHADE);
        const top = this.tmpTopColor;
        const side = this.tmpSideColor;
        // The tile's animation, the same on all 30 of its verts, written once
        // after them rather than through every writeVert call. The phase is
        // a hash of (cx, cy), so neighbouring fire tiles don't pulse in
        // unison; it needs to be incoherent, not uniform.
        const animType = animTypeFor(kind);
        const animPhase = (cx * 13 + cy * 7) * 0.43;
        const tileVertStart = vi; // captured before writes; the 30 verts
                                  // below all land in [tileVertStart, vi)

        // World coords match BattleRenderer.gridToWorld (axes are independent).
        const x0 = cx - halfX;
        const x1 = cx + 1 - halfX;
        const zHi = halfZ - cy;     // close to camera
        const zLo = halfZ - cy - 1; // far from camera

        // Top face. CCW viewed from +Y → normal +Y.
        writeVert(x0, topY, zHi, 0, 1, 0, top, 0, 0);
        writeVert(x1, topY, zHi, 0, 1, 0, top, 1, 0);
        writeVert(x1, topY, zLo, 0, 1, 0, top, 1, 1);
        writeVert(x0, topY, zHi, 0, 1, 0, top, 0, 0);
        writeVert(x1, topY, zLo, 0, 1, 0, top, 1, 1);
        writeVert(x0, topY, zLo, 0, 1, 0, top, 0, 1);

        // Side: zHi face (close to camera, outward normal +Z).
        writeVert(x0, topY, zHi, 0, 0, 1, side, 0, 0);
        writeVert(x0, BOTTOM_Y, zHi, 0, 0, 1, side, 0, 0);
        writeVert(x1, BOTTOM_Y, zHi, 0, 0, 1, side, 0, 0);
        writeVert(x0, topY, zHi, 0, 0, 1, side, 0, 0);
        writeVert(x1, BOTTOM_Y, zHi, 0, 0, 1, side, 0, 0);
        writeVert(x1, topY, zHi, 0, 0, 1, side, 0, 0);

        // Side: zLo face (away from camera, outward normal -Z).
        writeVert(x1, topY, zLo, 0, 0, -1, side, 0, 0);
        writeVert(x1, BOTTOM_Y, zLo, 0, 0, -1, side, 0, 0);
        writeVert(x0, BOTTOM_Y, zLo, 0, 0, -1, side, 0, 0);
        writeVert(x1, topY, zLo, 0, 0, -1, side, 0, 0);
        writeVert(x0, BOTTOM_Y, zLo, 0, 0, -1, side, 0, 0);
        writeVert(x0, topY, zLo, 0, 0, -1, side, 0, 0);

        // Side: x1 face (right, outward normal +X).
        writeVert(x1, topY, zHi, 1, 0, 0, side, 0, 0);
        writeVert(x1, BOTTOM_Y, zHi, 1, 0, 0, side, 0, 0);
        writeVert(x1, BOTTOM_Y, zLo, 1, 0, 0, side, 0, 0);
        writeVert(x1, topY, zHi, 1, 0, 0, side, 0, 0);
        writeVert(x1, BOTTOM_Y, zLo, 1, 0, 0, side, 0, 0);
        writeVert(x1, topY, zLo, 1, 0, 0, side, 0, 0);

        // Side: x0 face (left, outward normal -X).
        writeVert(x0, topY, zLo, -1, 0, 0, side, 0, 0);
        writeVert(x0, BOTTOM_Y, zLo, -1, 0, 0, side, 0, 0);
        writeVert(x0, BOTTOM_Y, zHi, -1, 0, 0, side, 0, 0);
        writeVert(x0, topY, zLo, -1, 0, 0, side, 0, 0);
        writeVert(x0, BOTTOM_Y, zHi, -1, 0, 0, side, 0, 0);
        writeVert(x0, topY, zHi, -1, 0, 0, side, 0, 0);

        for (let i = tileVertStart; i < vi; i++) {
          const ai = i * 2;
          anim[ai] = animType;
          anim[ai + 1] = animPhase;
        }
      }
    }
    this.positionAttr.needsUpdate = true;
    this.normalAttr.needsUpdate = true;
    this.colorAttr.needsUpdate = true;
    this.topUVAttr.needsUpdate = true;
    this.animAttr.needsUpdate = true;
  }

  /**
   * Fill the mound child: a fixed scatter of low-poly mounds on every `hills`
   * tile, whose own top stays flat ground. The buffers are sized to the hills
   * count on each call: `setTiles` runs once per battle, so the allocation is
   * cheap and spares holding the largest board's worth of mound verts. Each
   * mound is a four-sided pyramid; its face normals give the faceted shade,
   * and `aTopUV` is pinned to the cell's interior (0.5, 0.5) so the grid line
   * never paints onto a mound.
   */
  private fillHillBumps(
    kindAt: (x: number, y: number) => TileKind,
    w: number,
    h: number,
  ): void {
    let hillCount = 0;
    for (let cy = 0; cy < h; cy++) {
      for (let cx = 0; cx < w; cx++) {
        if (kindAt(cx, cy) === 'hills') hillCount++;
      }
    }

    const totalVerts = hillCount * VERTS_PER_HILL_TILE;
    const pos = new Float32Array(totalVerts * 3);
    const norm = new Float32Array(totalVerts * 3);
    const col = new Float32Array(totalVerts * 3);
    const uv = new Float32Array(totalVerts * 2);
    const anim = new Float32Array(totalVerts * 2);
    let vi = 0;
    const tmp = new THREE.Color();

    const writeVert = (
      px: number, py: number, pz: number,
      nx: number, ny: number, nz: number,
      c: THREE.Color,
    ): void => {
      const pi = vi * 3;
      const ti = vi * 2;
      pos[pi] = px; pos[pi + 1] = py; pos[pi + 2] = pz;
      norm[pi] = nx; norm[pi + 1] = ny; norm[pi + 2] = nz;
      col[pi] = c.r; col[pi + 1] = c.g; col[pi + 2] = c.b;
      uv[ti] = 0.5; uv[ti + 1] = 0.5; // interior → no grid-line stamp
      anim[ti] = ANIM_NONE; anim[ti + 1] = 0;
      vi++;
    };

    // One pyramid mound: 4 side triangles (apex over a square base). The open
    // base is never visible from the locked camera pitch, so it's omitted.
    const emitMound = (wx: number, wz: number, baseY: number, r: number, hgt: number): void => {
      const apexY = baseY + hgt;
      const cs: ReadonlyArray<readonly [number, number]> = [
        [wx - r, wz - r], [wx + r, wz - r], [wx + r, wz + r], [wx - r, wz + r],
      ];
      const ht = Math.max(0, Math.min(1, (hgt - HILL_BUMP_MIN_H) / (HILL_BUMP_MAX_H - HILL_BUMP_MIN_H)));
      // Taller mounds catch more light: the tile's own top, brighter.
      topColorFor(baseY, 'hills', this.theme, tmp);
      tmp.multiplyScalar(MOUND_BRIGHTEN_MIN + (MOUND_BRIGHTEN_MAX - MOUND_BRIGHTEN_MIN) * ht);
      tmp.setRGB(Math.min(1, tmp.r), Math.min(1, tmp.g), Math.min(1, tmp.b));
      for (let s = 0; s < 4; s++) {
        const a = cs[s]!;
        const b = cs[(s + 1) % 4]!;
        // Face normal from the two base→apex edges; flipped up so the lit side
        // faces the camera (DoubleSide makes winding irrelevant for visibility).
        const e1x = b[0] - a[0], e1z = b[1] - a[1];
        const e2x = wx - a[0], e2y = apexY - baseY, e2z = wz - a[1];
        let nx = -e1z * e2y;
        let ny = e1z * e2x - e1x * e2z;
        let nz = e1x * e2y;
        const len = Math.hypot(nx, ny, nz) || 1;
        nx /= len; ny /= len; nz /= len;
        if (ny < 0) { nx = -nx; ny = -ny; nz = -nz; }
        writeVert(a[0], baseY, a[1], nx, ny, nz, tmp);
        writeVert(b[0], baseY, b[1], nx, ny, nz, tmp);
        writeVert(wx, apexY, wz, nx, ny, nz, tmp);
      }
    };

    const halfX = w / 2;
    const halfZ = h / 2;
    for (let cy = 0; cy < h; cy++) {
      for (let cx = 0; cx < w; cx++) {
        if (kindAt(cx, cy) !== 'hills') continue;
        const ccx = cx - halfX + 0.5; // cell center, matching fillFromKindFn axes
        const ccz = halfZ - cy - 0.5;
        const baseY = this.heightAt(cx, cy, 'hills');
        for (let m = 0; m < BUMPS_PER_HILL_TILE; m++) {
          const q = QUAD_OFFSETS[m]!;
          // Deterministic jitter + size from the fixed noise field.
          const jx = this.noise2D((cx * 2 + m * 1.7 + 11) * NOISE_FREQ, (cy * 2 + 5) * NOISE_FREQ);
          const jz = this.noise2D((cx * 2 + 3) * NOISE_FREQ, (cy * 2 + m * 1.7 + 19) * NOISE_FREQ);
          const sh = this.noise2D((cx * 3 + m * 0.9 + 2) * NOISE_FREQ, (cy * 3 + m * 0.9 + 7) * NOISE_FREQ);
          const sr = this.noise2D((cx * 3 + 13) * NOISE_FREQ, (cy * 3 + m * 0.9 + 1) * NOISE_FREQ);
          const wx = ccx + q[0] + jx * HILL_BUMP_JITTER;
          const wz = ccz + q[1] + jz * HILL_BUMP_JITTER;
          const hgt = HILL_BUMP_MIN_H + (sh * 0.5 + 0.5) * (HILL_BUMP_MAX_H - HILL_BUMP_MIN_H);
          const r = HILL_BUMP_MIN_R + (sr * 0.5 + 0.5) * (HILL_BUMP_MAX_R - HILL_BUMP_MIN_R);
          emitMound(wx, wz, baseY, r, hgt);
        }
      }
    }

    this.bumpsGeometry.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    this.bumpsGeometry.setAttribute('normal', new THREE.BufferAttribute(norm, 3));
    this.bumpsGeometry.setAttribute('aColor', new THREE.BufferAttribute(col, 3));
    this.bumpsGeometry.setAttribute('aTopUV', new THREE.BufferAttribute(uv, 2));
    this.bumpsGeometry.setAttribute('aAnim', new THREE.BufferAttribute(anim, 2));
    this.bumpsGeometry.setDrawRange(0, totalVerts);
  }
}

/**
 * The floor's palette per theme: each entry is the (low, high) ends of the
 * height lerp, so the noise field varies the colour across neighbouring floor
 * tiles. Kinds other than floor and hills keep their fixed colours on every
 * theme: they are signals a player must know at a glance, which a per-theme
 * tint would blur.
 *
 * - `grassland`: DARK_TERMINAL_GREEN → DARK_TERMINAL_AMBER.
 * - `barren`: a stone-dark companion → TERMINAL_STONE, the colour inert walls
 *   are drawn in, so a barren board reads as a stone arena.
 * - `volcanic`: dark red → DARK_TERMINAL_AMBER, grassland's high end, so fire
 *   tiles blend into a volcanic floor instead of standing out.
 *
 * Adding a theme: `ThemeSchema`'s doc in src/config/layouts.ts; the
 * `Record<Theme, …>` type makes its entry here required.
 */
const FLOOR_PALETTE: Record<Theme, { low: THREE.Color; high: THREE.Color }> = {
  grassland: {
    low: new THREE.Color(COLORS.DARK_TERMINAL_GREEN),
    high: new THREE.Color(COLORS.DARK_TERMINAL_AMBER),
  },
  barren: {
    low: new THREE.Color('#3a342f'),
    high: new THREE.Color(COLORS.TERMINAL_STONE),
  },
  volcanic: {
    low: new THREE.Color('#3a0a04'),
    high: new THREE.Color(COLORS.DARK_TERMINAL_AMBER),
  },
  tundra: {
    low: new THREE.Color('#2c3a47'), // cold dark slate
    high: new THREE.Color('#c4d4e0'), // pale ice-white snow
  },
  desert: {
    low: new THREE.Color('#6b5836'), // shadowed tan
    high: new THREE.Color('#d8c188'), // warm sunlit sand
  },
  swamp: {
    low: new THREE.Color('#28301d'), // dark bog
    high: new THREE.Color('#5e6b39'), // murky olive
  },
};
const _waterColor = new THREE.Color('#1F5B7A');
/** Chasm: near-black, so the pit reads as a void; its depth does most of the
 *  work, and the colour confirms it. */
const _chasmColor = new THREE.Color('#0a0a0a');
/** Fire: dim ember red to bright amber across the floor's height range. The
 *  shader's flicker makes it live; the lerp varies neighbouring fire tiles. */
const _fireLow = new THREE.Color('#aa1c00');
const _fireHigh = new THREE.Color('#ffaa00');
/** Healing: dark teal to the palette's cyan, kept off the green yours are
 *  drawn in, so a healing tile doesn't read as an ally standing there. The
 *  cyan is read from `COLORS`, so the colourblind palette, which moves it
 *  away from its mint, moves the tile with it. Terrain draws on layer 0
 *  only, never in the bloom pass, so a bright tile raises no halo. */
const _healLow = new THREE.Color('#0d4d4a');
const _healHigh = new THREE.Color(COLORS.FLOURESCENT_BLUE);
/** Deep water: a darker, colder navy than shallow water. It is level with
 *  shallow water (`heightAt`), so the shader's bands (`ANIM_DEEP_WATER`)
 *  carry the passable/impassable read, and the colour confirms it, flat like
 *  shallow water and chasm. */
const _deepWaterColor = new THREE.Color('#0e3047');
/** Mud: a flat wet brown; with its plane low in the floor band, it reads as
 *  a bog. One height, so every mud tile shares the colour. */
const _mudColor = new THREE.Color('#46361f');
/** Hills take the theme's floor palette, so a hills tile conforms to its
 *  board, and the mounds carry the read by shape. Each mound is its tile's
 *  top colour brightened by this factor, more for a taller mound, so a
 *  cluster reads as lit high ground in the tile's own hue. A lerp toward the
 *  palette's high end would turn grassland's hills brown, its palette running
 *  green to amber. */
const MOUND_BRIGHTEN_MIN = 1.25;
const MOUND_BRIGHTEN_MAX = 1.75;
/** Ice: pale blue-white, flat (the floor band). Bright, but on layer 0 only,
 *  like the healing cyan. */
const _iceLow = new THREE.Color('#9fd0e0');
const _iceHigh = new THREE.Color('#d8f2f8');
/** Sand: warm tan, flat (the floor band). */
const _sandLow = new THREE.Color('#b09a5e');
const _sandHigh = new THREE.Color('#d8c488');

/**
 * A top face's colour. Water, deep water, chasm and mud are flat, their depth
 * or their fixed plane doing the work. Floor, fire, healing, ice and sand
 * lerp their pair across the height field, so neighbouring tiles of one kind
 * vary. Only the floor and hills read `theme`; the other kinds keep their
 * colours on every board. Exported: the apron colours its ring through this
 * function, so it matches the board by construction.
 */
export function topColorFor(topY: number, kind: TileKind, theme: Theme, out: THREE.Color): void {
  if (kind === 'shallow_water') {
    out.copy(_waterColor);
    return;
  }
  if (kind === 'deep_water') {
    out.copy(_deepWaterColor);
    return;
  }
  if (kind === 'chasm') {
    out.copy(_chasmColor);
    return;
  }
  if (kind === 'mud') {
    out.copy(_mudColor);
    return;
  }
  const t = Math.max(0, Math.min(1, (topY - FLOOR_RANGE_LO) / (FLOOR_RANGE_HI - FLOOR_RANGE_LO)));
  if (kind === 'fire') {
    out.copy(_fireLow).lerp(_fireHigh, t);
    return;
  }
  if (kind === 'healing') {
    out.copy(_healLow).lerp(_healHigh, t);
    return;
  }
  if (kind === 'ice') {
    out.copy(_iceLow).lerp(_iceHigh, t);
    return;
  }
  if (kind === 'sand') {
    out.copy(_sandLow).lerp(_sandHigh, t);
    return;
  }
  // Hills fall through: a flat floor-coloured base, the mound mesh carries the relief.
  const palette = FLOOR_PALETTE[theme];
  out.copy(palette.low).lerp(palette.high, t);
}
