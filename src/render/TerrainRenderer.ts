import * as THREE from 'three';
import { createNoise2D } from 'simplex-noise';
import { RNG } from '../core/RNG';
import type { TileGrid, TileKind } from '../sim/TileGrid';
import { COLORS } from './palette';
import { LAYOUT_MAX_SIDE, type Theme } from '../config/layouts';
import VERTEX_SHADER from './shaders/terrain.vert.glsl?raw';
import FRAGMENT_SHADER from './shaders/terrain.frag.glsl?raw';

/**
 * C1c terrain: one faceted prism per tile.
 *
 * Heights come from a fixed-seed simplex field — the visual character
 * is part of the canonical look, not a per-battle roll. Floor tile tops
 * live in [FLOOR_RANGE_LO, FLOOR_RANGE_HI]; water tiles drop to a sunken
 * WATER_TOP_Y so the recess reads at a glance. Top colors lerp
 * DARK_TERMINAL_GREEN → DARK_TERMINAL_AMBER over the floor height range
 * so variance reads both geometrically and chromatically.
 *
 * Geometry is non-indexed (each face owns its normals) for hard-edged
 * faceted shading. Lighting is baked from a fixed direction in the
 * fragment shader — no scene lights, so this material has no spill into
 * the sprite renderers (which are unlit by design).
 *
 * **D3 — variable map sizes.** The renderer is allocated once at the
 * largest D3-allowed grid (`LAYOUT_MAX_SIDE × LAYOUT_MAX_SIDE`) and
 * uses `geometry.setDrawRange` per `setTiles` to expose only the cells
 * the current encounter occupies. Per-encounter dimensions can change
 * freely up to that cap — no reallocation, no GPU re-upload of unused
 * vertex slots. Trade-off: a flat ~1 MB of vertex buffer reserved at
 * boot vs. a frame stall every time the board size changes.
 *
 * `heightAt(cx, cy, kind)` is the public hook into the height field —
 * BattleRenderer uses it to set per-tile sprite Y so units stand on
 * their tile top instead of floating at a fixed plane.
 */

const VERTS_PER_TILE = 30; // 5 quads × 2 tris × 3 verts (top + 4 sides; bottom omitted — never visible from the locked camera pitch)
/** Lowered from -0.7 in D7.C so the chasm prism (top -1.2) still has 0.3
 *  units of side visible. Non-chasm tiles' visible sides are still bounded
 *  at the top by their topY, so the deeper bottom only shows up at the
 *  chasm boundary (and at the literal board edge, which the camera
 *  pitch barely sees). */
const BOTTOM_Y = -1.5;

const WATER_TOP_Y = -0.4;
/** D7.C: chasm top Y. Deep enough (vs water's -0.4) to read as "pit, don't
 *  step here" against the green-amber floor at the locked camera pitch. */
const CHASM_TOP_Y = -1.2;
const FLOOR_RANGE_LO = -0.3;
const FLOOR_RANGE_HI = 0.0;
const NOISE_FREQ = 0.42;
/** Fixed seed: the visual character is canonical, not a per-battle roll. */
const NOISE_SEED = 0xb1c1a1b;

/** Diffuse light direction in world space — view-space `normal · L` is the diffuse term. */
const LIGHT_DIR = new THREE.Vector3(0.4, 0.85, 0.35).normalize();
/** Ambient floor — sides never go fully black. */
const AMBIENT = 0.45;
/** Side-face color multiplier vs top (darker for face-to-face contrast). */
const SIDE_SHADE = 0.7;
/** Top-face grid-line width as a fraction of cell size. */
const GRID_LINE_WIDTH = 0.06;

/** D7.C: per-tile animation type encoded into the `aAnim.x` attribute.
 *  The fragment shader switches on these values to apply a sine flicker
 *  (fire) or a slower pulse (healing). 0 = no animation. */
const ANIM_NONE = 0;
const ANIM_FIRE = 1;
const ANIM_HEALING = 2;

/** Per-renderer-instance vertex capacity. Sized at the largest D3-allowed
 *  grid (32×32) so any per-encounter size fits without reallocating. */
const MAX_TILES = LAYOUT_MAX_SIDE * LAYOUT_MAX_SIDE;

export class TerrainRenderer {
  readonly mesh: THREE.Mesh;

  private gridW: number;
  private gridH: number;
  /** D8: current encounter's theme, captured at `setTiles` time. Drives
   *  the floor-tile palette branch in `topColorFor`. */
  private theme: Theme = 'default';
  private readonly geometry: THREE.BufferGeometry;
  private readonly material: THREE.ShaderMaterial;
  private readonly positions: Float32Array;
  private readonly normals: Float32Array;
  private readonly colors: Float32Array;
  private readonly topUVs: Float32Array;
  /** D7.C: per-vertex (animType, phase). animType drives the fragment-
   *  shader effect branch (fire flicker / healing pulse); phase is a
   *  per-tile offset so neighboring fire tiles don't pulse in unison. */
  private readonly anims: Float32Array;
  private readonly positionAttr: THREE.BufferAttribute;
  private readonly normalAttr: THREE.BufferAttribute;
  private readonly colorAttr: THREE.BufferAttribute;
  private readonly topUVAttr: THREE.BufferAttribute;
  private readonly animAttr: THREE.BufferAttribute;

  private readonly noise2D: (x: number, y: number) => number;
  private readonly tmpTopColor = new THREE.Color();
  private readonly tmpSideColor = new THREE.Color();

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
    // Loose bounding sphere sized at the renderer's max extent. Since the
    // mesh is always centered on the world origin and our camera framing
    // sees the whole arena, frustum culling at this radius costs nothing.
    this.geometry.boundingSphere = new THREE.Sphere(
      new THREE.Vector3(0, BOTTOM_Y / 2, 0),
      LAYOUT_MAX_SIDE,
    );
    // Start with nothing drawn — `setTiles` configures both the content
    // and the draw range. Pre-setTiles renders read an empty mesh.
    this.geometry.setDrawRange(0, 0);

    this.material = new THREE.ShaderMaterial({
      vertexShader: VERTEX_SHADER,
      fragmentShader: FRAGMENT_SHADER,
      uniforms: {
        uLightDir: { value: LIGHT_DIR.clone() },
        uAmbient: { value: AMBIENT },
        uGridLineColor: { value: new THREE.Color(COLORS.TERMINAL_BLACK) },
        uGridLineWidth: { value: GRID_LINE_WIDTH },
        // D7.C: monotonically increasing seconds since this renderer was
        // created (or since the last advanceTime caller wraps it — there's
        // no wrap; fp32 holds a clean second-grain accumulator for ~hours).
        uTime: { value: 0 },
      },
    });

    this.mesh = new THREE.Mesh(this.geometry, this.material);
  }

  /**
   * Top Y of the cell at (cx, cy) given its tile kind. The same function
   * the geometry uses, exposed so other renderers (BattleRenderer for
   * per-tile sprite Y) can stay in sync with the surface without a
   * second source of truth.
   */
  heightAt(cx: number, cy: number, kind: TileKind): number {
    if (kind === 'shallow_water') return WATER_TOP_Y;
    if (kind === 'chasm') return CHASM_TOP_Y;
    // D7.C: fire + healing live on the same noise field as floor — they're
    // surface effects, not elevation changes. Sprites standing on a fire
    // tile still want a tile top to plant on.
    const n = this.noise2D(cx * NOISE_FREQ, cy * NOISE_FREQ); // [-1, 1]
    const t = (n + 1) * 0.5;
    return FLOOR_RANGE_LO + (FLOOR_RANGE_HI - FLOOR_RANGE_LO) * t;
  }

  /**
   * D7.C: advance the shader's `uTime` uniform for per-tile fire/healing
   * animation. Called from BattleScene.tick (only ticks during battle, so
   * non-battle scenes pay nothing). Pure accumulation — no wrap, no
   * modular reduction; fp32 keeps a clean second-grain count for hours.
   */
  advanceTime(dt: number): void {
    const u = this.material.uniforms['uTime']!;
    u.value = (u.value as number) + dt;
  }

  /**
   * Configure the terrain mesh for an encounter of the given dimensions.
   * The renderer's vertex buffers were sized once at construction for
   * the max D3 grid; `setDrawRange` exposes the right slice for this
   * encounter so non-square (or smaller-than-max) boards render
   * correctly without zero-area junk geometry from unused slots.
   */
  setTiles(tileGrid: TileGrid, gridW: number, gridH: number, theme: Theme = 'default'): void {
    if (gridW * gridH > MAX_TILES) {
      throw new Error(
        `TerrainRenderer.setTiles: ${gridW}x${gridH} exceeds capacity ${MAX_TILES}`,
      );
    }
    this.gridW = gridW;
    this.gridH = gridH;
    this.theme = theme;
    this.fillFromKindFn((x, y) => tileGrid.kindAt({ x, y }));
    this.geometry.setDrawRange(0, gridW * gridH * VERTS_PER_TILE);
  }

  clear(): void {
    this.gridW = 0;
    this.gridH = 0;
    this.geometry.setDrawRange(0, 0);
  }

  dispose(): void {
    this.geometry.dispose();
    this.material.dispose();
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
        // D7.C per-tile anim — same value across all 30 verts of the tile.
        // Writing it once per cell after the side/top verts is simpler than
        // threading it through every writeVert call. Phase is a deterministic
        // hash of (cx, cy) so neighboring fire tiles don't pulse in unison;
        // doesn't need to be uniform-distributed, just non-coherent.
        const animType =
          kind === 'fire' ? ANIM_FIRE :
          kind === 'healing' ? ANIM_HEALING :
          ANIM_NONE;
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

        // D7.C per-tile anim. All VERTS_PER_TILE verts of this cell share
        // the same (type, phase).
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
}

/**
 * D8 — per-theme floor-tile palette. Each entry is the (low, high) endpoints
 * of the simplex-height lerp; the same noise field shifts color across
 * adjacent floor tiles within a theme so the surface stays visually varied.
 * Water / chasm / fire / healing keep their fixed D7 palettes regardless of
 * theme — they're functional indicators players need to recognize at a
 * glance, so re-tinting them per theme would risk parsing-load (per the
 * D8 scope decision).
 *
 * - `default`: the canonical DARK_TERMINAL_GREEN → DARK_TERMINAL_AMBER lerp.
 * - `rock`: gray tones. Low end DARK_STONE, high end TERMINAL_STONE — same
 *   neutral-stone family the wall sprite already uses, so a rock-theme
 *   board reads as "stone arena."
 * - `volcanic`: dark red base climbing into amber. The high end shares
 *   DARK_TERMINAL_AMBER with the default palette so fire tiles (D7) blend
 *   organically into a volcanic floor instead of jumping out as alien.
 *
 * Adding a theme: extend `ThemeSchema` in `src/config/layouts.ts`,
 * append an entry here, and the editor + procedural picker pick it up
 * automatically (THEMES is the source of truth).
 */
const FLOOR_PALETTE: Record<Theme, { low: THREE.Color; high: THREE.Color }> = {
  default: {
    low: new THREE.Color(COLORS.DARK_TERMINAL_GREEN),
    high: new THREE.Color(COLORS.DARK_TERMINAL_AMBER),
  },
  rock: {
    // Low end is a stone-dark companion to TERMINAL_STONE (same hue family,
    // ~50% value). High end is TERMINAL_STONE itself — the same color the
    // wall sprite uses, so a rock arena reads as "stone everywhere."
    low: new THREE.Color('#3a342f'),
    high: new THREE.Color(COLORS.TERMINAL_STONE),
  },
  volcanic: {
    low: new THREE.Color('#3a0a04'),
    high: new THREE.Color(COLORS.DARK_TERMINAL_AMBER),
  },
};
const _waterColor = new THREE.Color('#1F5B7A');
/** D7.C chasm: very dark (near-black) so the pit reads as inhospitable
 *  void; the depth difference (CHASM_TOP_Y vs floor) does the heavy
 *  lifting and the color just confirms the read. */
const _chasmColor = new THREE.Color('#0a0a0a');
/** D7.C fire: dim-ember red to bright amber across the floor height range.
 *  The shader flicker (uTime + per-tile phase) is what makes it feel alive;
 *  the lerp adds spatial variance between adjacent fire tiles. */
const _fireLow = new THREE.Color('#aa1c00');
const _fireHigh = new THREE.Color('#ffaa00');
/** D7.C healing: dark teal to FLOURESCENT_BLUE-ish cyan. Deliberately
 *  distinct from TERMINAL_GREEN (ally sprite color) so healing tiles
 *  don't read as "an ally is here." Terrain doesn't render on the bloom
 *  layer (camera layer 0 only), so the bright cyan doesn't trigger the
 *  sprite bloom shader. */
const _healLow = new THREE.Color('#0d4d4a');
const _healHigh = new THREE.Color('#15f4ee');

/**
 * Top-face color. Water gets a flat blue (the recess reads through depth,
 * not color variance). Chasm gets a flat near-black (same reason — depth
 * does the work). Floor / fire / healing tiles share the simplex height
 * field and lerp their respective palette pair across it, so adjacent
 * cells of the same kind show subtle variance as well as the per-tile
 * shader animation. **D8**: only the floor branch consults `theme` —
 * water / chasm / fire / healing keep their fixed D7 palettes so they
 * read the same regardless of the surrounding board's theming.
 */
function topColorFor(topY: number, kind: TileKind, theme: Theme, out: THREE.Color): void {
  if (kind === 'shallow_water') {
    out.copy(_waterColor);
    return;
  }
  if (kind === 'chasm') {
    out.copy(_chasmColor);
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
  const palette = FLOOR_PALETTE[theme];
  out.copy(palette.low).lerp(palette.high, t);
}
