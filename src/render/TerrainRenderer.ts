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
 *  pitch barely sees). M4: exported — ApronRenderer's ring prisms share
 *  the same bottom so the apron/board seam has no visible step. */
export const BOTTOM_Y = -1.5;

const WATER_TOP_Y = -0.4;
/** D7.C: chasm top Y. Deep enough (vs water's -0.4) to read as "pit, don't
 *  step here" against the green-amber floor at the locked camera pitch. */
const CHASM_TOP_Y = -1.2;
const FLOOR_RANGE_LO = -0.3;
const FLOOR_RANGE_HI = 0.0;
/** §37b — mud is a shallow depression just under the floor band — a bogged-down
 *  read. Fixed (not noise-varied) so a mud flat looks uniformly waterlogged. */
const MUD_TOP_Y = -0.25;
/** §37b — hill bumps. The `hills` BASE tile stays flat ground (the floor band);
 *  the relief comes from a deterministic scatter of low-poly mounds overlaid
 *  per tile (the `bumpsMesh` child), not from raising the tile. Placement +
 *  size are sampled from the fixed noise field, so the look is canonical, not
 *  a per-battle roll. Each mound is a 4-sided pyramid (open base, never seen
 *  from the locked camera pitch). QUAD_OFFSETS must have BUMPS_PER_HILL_TILE
 *  entries (one base position per mound). */
const BUMPS_PER_HILL_TILE = 4;
const VERTS_PER_BUMP = 12; // 4 pyramid side-tris × 3 verts
const VERTS_PER_HILL_TILE = BUMPS_PER_HILL_TILE * VERTS_PER_BUMP;
const HILL_BUMP_MIN_H = 0.12;
const HILL_BUMP_MAX_H = 0.34;
const HILL_BUMP_MIN_R = 0.15;
const HILL_BUMP_MAX_R = 0.26;
/** Per-mound base position within a cell (cell-local, the cell spans 1 unit). */
const QUAD_OFFSETS: ReadonlyArray<readonly [number, number]> = [
  [-0.22, -0.22],
  [0.22, -0.22],
  [0.22, 0.22],
  [-0.22, 0.22],
];
const NOISE_FREQ = 0.42;
/** Fixed seed: the visual character is canonical, not a per-battle roll. */
const NOISE_SEED = 0xb1c1a1b;

/** Diffuse light direction in world space — view-space `normal · L` is the
 *  diffuse term. M4: exported (with AMBIENT/SIDE_SHADE below) so
 *  ApronRenderer lights its ring identically — both materials clone the
 *  vector, so neither can mutate the other's uniform. */
export const LIGHT_DIR = new THREE.Vector3(0.4, 0.85, 0.35).normalize();
/** Ambient floor — sides never go fully black. */
export const AMBIENT = 0.45;
/** Side-face color multiplier vs top (darker for face-to-face contrast). */
export const SIDE_SHADE = 0.7;
/** Top-face grid-line width as a fraction of cell size. */
const GRID_LINE_WIDTH = 0.06;

/** D7.C: per-tile animation type encoded into the `aAnim.x` attribute.
 *  The fragment shader switches on these values to apply a sine flicker
 *  (fire) or a slower pulse (healing). 0 = no animation. M4: exported —
 *  the apron's clamp-sampled fire/healing tiles keep animating into the
 *  fog, so its shader branches on the same encoding. */
export const ANIM_NONE = 0;
export const ANIM_FIRE = 1;
export const ANIM_HEALING = 2;

/** Per-renderer-instance vertex capacity. Sized at the largest D3-allowed
 *  grid (32×32) so any per-encounter size fits without reallocating. */
const MAX_TILES = LAYOUT_MAX_SIDE * LAYOUT_MAX_SIDE;

export class TerrainRenderer {
  readonly mesh: THREE.Mesh;

  private gridW: number;
  private gridH: number;
  /** D8: current encounter's theme, captured at `setTiles` time. Drives
   *  the floor-tile palette branch in `topColorFor`. */
  private theme: Theme = 'grassland';
  private readonly geometry: THREE.BufferGeometry;
  private readonly material: THREE.ShaderMaterial;
  /** §37b — hill-bump overlay (a child of `mesh`): low-poly mounds scattered on
   *  `hills` tiles. Its own geometry, sized per `setTiles` to the hills count,
   *  drawn with a DoubleSide clone of the terrain material (mounds don't
   *  animate, so the clone's frozen `uTime` is harmless; DoubleSide spares us
   *  per-face winding bookkeeping). */
  private readonly bumpsGeometry: THREE.BufferGeometry;
  private readonly bumpsMaterial: THREE.ShaderMaterial;
  private readonly bumpsMesh: THREE.Mesh;
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

    // §37b — the hill-bump child. Empty until `setTiles` populates it; rides
    // the parent's transform so it lands in the scene wherever `mesh` does, and
    // its raycast is a no-op so cell-picking (which raycasts `mesh`) ignores it.
    this.bumpsGeometry = new THREE.BufferGeometry();
    this.bumpsGeometry.setDrawRange(0, 0);
    this.bumpsMaterial = this.material.clone();
    this.bumpsMaterial.side = THREE.DoubleSide;
    this.bumpsMesh = new THREE.Mesh(this.bumpsGeometry, this.bumpsMaterial);
    this.bumpsMesh.frustumCulled = false; // small geometry, always in frame
    this.bumpsMesh.raycast = () => {}; // unclickable — picking hits the base tile
    this.mesh.add(this.bumpsMesh);
  }

  /**
   * Top Y of the cell at (cx, cy) given its tile kind. The same function
   * the geometry uses, exposed so other renderers (BattleRenderer for
   * per-tile sprite Y) can stay in sync with the surface without a
   * second source of truth.
   */
  heightAt(cx: number, cy: number, kind: TileKind): number {
    // §37b: deep water is COPLANAR with shallow water — its greater depth reads
    // through the darker color, not a sunken surface (which looked wrong butted
    // up against regular water).
    if (kind === 'shallow_water' || kind === 'deep_water') return WATER_TOP_Y;
    if (kind === 'chasm') return CHASM_TOP_Y;
    if (kind === 'mud') return MUD_TOP_Y; // §37b — fixed sunken plane
    // D7.C: fire + healing live on the same noise field as floor — they're
    // surface effects, not elevation changes. §37b: ice / sand / hills are
    // flat-ground variants too (hills' relief is the overlaid bump mesh, not a
    // raised tile). Sprites standing on any of these want a tile top to plant on.
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
    this.fillHillBumps(kindAt, gridW, gridH); // §37b
  }

  clear(): void {
    this.gridW = 0;
    this.gridH = 0;
    this.geometry.setDrawRange(0, 0);
    this.bumpsGeometry.setDrawRange(0, 0); // §37b
  }

  dispose(): void {
    this.geometry.dispose();
    this.material.dispose();
    this.bumpsGeometry.dispose(); // §37b
    this.bumpsMaterial.dispose();
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

  /**
   * §37b — populate the hill-bump child: a deterministic scatter of low-poly
   * mounds on every `hills` tile (the base tile itself stays flat ground). The
   * buffers are sized to the EXACT hills count each call — `setTiles` runs once
   * per encounter, so the per-call allocation is cheap and avoids reserving a
   * max-grid's worth of bump verts for boards with few or no hills. Each mound
   * is a 4-sided pyramid; the per-face normals give the faceted low-poly shade,
   * and `aTopUV` is pinned to cell-interior (0.5, 0.5) so the grid-line stamp
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
      tmp.copy(_hillLow).lerp(_hillHigh, ht); // taller mounds catch more light
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
          const wx = ccx + q[0] + jx * 0.1;
          const wz = ccz + q[1] + jz * 0.1;
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
 * D8 — per-theme floor-tile palette. Each entry is the (low, high) endpoints
 * of the simplex-height lerp; the same noise field shifts color across
 * adjacent floor tiles within a theme so the surface stays visually varied.
 * Water / chasm / fire / healing keep their fixed D7 palettes regardless of
 * theme — they're functional indicators players need to recognize at a
 * glance, so re-tinting them per theme would risk parsing-load (per the
 * D8 scope decision).
 *
 * - `grassland`: the canonical DARK_TERMINAL_GREEN → DARK_TERMINAL_AMBER lerp.
 * - `barren`: gray tones. Low end a stone-dark companion, high end TERMINAL_STONE
 *   — same neutral-stone family the wall sprite already uses, so a barren
 *   board reads as "stone arena."
 * - `volcanic`: dark red base climbing into amber. The high end shares
 *   DARK_TERMINAL_AMBER with the grassland palette so fire tiles (D7) blend
 *   organically into a volcanic floor instead of jumping out as alien.
 * - `tundra`: cold slate → pale ice-white (snow). · `desert`: shadowed tan →
 *   warm sand. · `swamp`: dark bog → murky olive. (§37e — fixed identity hex.)
 *
 * Adding a theme: extend `ThemeSchema` in `src/config/layouts.ts`,
 * append an entry here, and the editor + procedural picker pick it up
 * automatically (THEMES is the source of truth).
 */
const FLOOR_PALETTE: Record<Theme, { low: THREE.Color; high: THREE.Color }> = {
  grassland: {
    low: new THREE.Color(COLORS.DARK_TERMINAL_GREEN),
    high: new THREE.Color(COLORS.DARK_TERMINAL_AMBER),
  },
  barren: {
    // Low end is a stone-dark companion to TERMINAL_STONE (same hue family,
    // ~50% value). High end is TERMINAL_STONE itself — the same color the
    // wall sprite uses, so a barren arena reads as "stone everywhere."
    low: new THREE.Color('#3a342f'),
    high: new THREE.Color(COLORS.TERMINAL_STONE),
  },
  volcanic: {
    low: new THREE.Color('#3a0a04'),
    high: new THREE.Color(COLORS.DARK_TERMINAL_AMBER),
  },
  // §37e — three new fixed-identity palettes (theme-independent hex, like
  // volcanic). low = shadowed/recessed floor, high = lit crest (the noise lerp
  // in `topColorFor` walks low→high by the per-cell height field).
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
/** §37b — deep water: a darker, colder navy than shallow water (`#1F5B7A`).
 *  The deeper recess (DEEP_WATER_TOP_Y) carries the "impassable, don't wade"
 *  read; the color just confirms it (flat, like shallow water + chasm). */
const _deepWaterColor = new THREE.Color('#0e3047');
/** §37b — mud: flat wet brown. The slight sink (MUD_TOP_Y) + dark earth read
 *  as a bog. Fixed-height tile, so every mud cell shares this one color. */
const _mudColor = new THREE.Color('#46361f');
/** §37b — hills: grassy ridge lerped lighter toward the crest (by hill height,
 *  not the floor band) so a cluster reads as lit, rolling high ground. */
const _hillLow = new THREE.Color('#3f5a2c');
const _hillHigh = new THREE.Color('#7a9a48');
/** §37b — ice: pale blue-white, slick + cold; flat (floor band). Bright, but
 *  terrain renders on layer 0 only (no sprite bloom), like the healing cyan. */
const _iceLow = new THREE.Color('#9fd0e0');
const _iceHigh = new THREE.Color('#d8f2f8');
/** §37b — sand: warm tan dune; flat (floor band). */
const _sandLow = new THREE.Color('#b09a5e');
const _sandHigh = new THREE.Color('#d8c488');

/**
 * Top-face color. Water gets a flat blue (the recess reads through depth,
 * not color variance). Chasm gets a flat near-black (same reason — depth
 * does the work). Floor / fire / healing tiles share the simplex height
 * field and lerp their respective palette pair across it, so adjacent
 * cells of the same kind show subtle variance as well as the per-tile
 * shader animation. **D8**: only the floor branch consults `theme` —
 * water / chasm / fire / healing keep their fixed D7 palettes so they
 * read the same regardless of the surrounding board's theming.
 * **M4**: exported — ApronRenderer colors its ring through this exact
 * function so the apron is canonical-by-construction, not a lookalike.
 */
export function topColorFor(topY: number, kind: TileKind, theme: Theme, out: THREE.Color): void {
  if (kind === 'shallow_water') {
    out.copy(_waterColor);
    return;
  }
  if (kind === 'deep_water') {
    out.copy(_deepWaterColor); // §37b — flat, depth does the read
    return;
  }
  if (kind === 'chasm') {
    out.copy(_chasmColor);
    return;
  }
  if (kind === 'mud') {
    out.copy(_mudColor); // §37b — flat (fixed-height tile)
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
    out.copy(_iceLow).lerp(_iceHigh, t); // §37b
    return;
  }
  if (kind === 'sand') {
    out.copy(_sandLow).lerp(_sandHigh, t); // §37b
    return;
  }
  if (kind === 'hills') {
    // §37b — flat grassy base; the overlaid mound mesh carries the relief.
    out.copy(_hillLow).lerp(_hillHigh, t);
    return;
  }
  const palette = FLOOR_PALETTE[theme];
  out.copy(palette.low).lerp(palette.high, t);
}
