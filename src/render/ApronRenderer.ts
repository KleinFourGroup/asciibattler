import * as THREE from 'three';
import type { TileGrid, TileKind } from '../sim/TileGrid';
import { COLORS } from './palette';
import { LAYOUT_MAX_SIDE, type Theme } from '../config/layouts';
import {
  TerrainRenderer,
  BOTTOM_Y,
  SIDE_SHADE,
  AMBIENT,
  LIGHT_DIR,
  ANIM_NONE,
  ANIM_FIRE,
  ANIM_HEALING,
  topColorFor,
} from './TerrainRenderer';
import VERTEX_SHADER from './shaders/apron.vert.glsl?raw';
import FRAGMENT_SHADER from './shaders/apron.frag.glsl?raw';

/**
 * M4 — the battle-backdrop apron. A ring of non-playable prism tiles
 * around the board that continues the terrain outward and dissolves into
 * the scene background, so the board reads as *placed in a foggy world*
 * instead of floating in the void.
 *
 * Design calls (M4 design round, 2026-06-12):
 * - **Render-only & dynamically generated.** The sim never learns these
 *   tiles exist — no TileKind, no pathfinding/spawn/snapshot impact, and
 *   "non-traversable" is true by construction. Tile kinds are
 *   clamp-to-edge samples of the playable grid (the user's call: a river
 *   hitting the board edge flows out into the mist instead of abruptly
 *   turning into floor). Walls don't extend — they're spawned entities,
 *   and a wall *ending* looks natural where ground changing type doesn't.
 * - **Canonical look by construction.** Heights come from the live
 *   `TerrainRenderer.heightAt` (the fixed-seed simplex field is a pure
 *   function of grid coords, so it continues coherently outside the
 *   board) and colors from the exported `topColorFor`, so the ring is
 *   pixel-matched to the board until the fog term kicks in.
 * - **Legibility cues**: no grid lines out here (the apron shader has no
 *   grid stamp) and the fade starts at tile one, so the playable edge
 *   stays unambiguous.
 * - **The fog is color math, not transparency** — fully fogged pixels
 *   equal the scene background, so there's nothing to alpha-sort against
 *   the billboard sprites and no extra render pass. Style is
 *   runtime-flippable between Bayer-stipple dissolve and smooth
 *   smoothstep via `setDither` (console: `__game.apron.setDither(false)`).
 *
 * Separate from TerrainRenderer (not a widened board mesh) because:
 * (a) the board's buffer is sized at LAYOUT_MAX_SIDE² and a 32×32 board
 * +2/side wouldn't fit; (b) `pickCell` raycasts an explicitly-passed
 * surface, so a separate mesh is unclickable by construction; (c) the
 * fade/creep/dither shader stays out of the canonical terrain look.
 * Stays on layer 0 → never rendered into the bloom pass.
 */

/** Apron width in tiles — THE M4 knob. Buffer capacity and the fade
 *  width both derive from it, so widening to 3 is a one-line change. */
export const APRON_TILES = 2;

/** Max |creep| the fragment shader's summed sines reach
 *  (0.18 + 0.14 + 0.13 — keep in sync with apron.frag.glsl). The fade is
 *  shortened by this much so the outer rim stays fully fogged even at the
 *  creep's deepest inhale — otherwise the rim's cut edge would ghost
 *  against the void once a second. */
const CREEP_MAX_TILES = 0.45;

const VERTS_PER_TILE = 30; // same prism as TerrainRenderer: top + 4 sides

/** Ring capacity at the largest board: (MAX+2A)² − MAX² tiles. 272 at
 *  A=2 — small enough that resizing per encounter isn't worth it; like
 *  the board mesh, allocate once and setDrawRange per encounter. */
const MAX_APRON_TILES =
  (LAYOUT_MAX_SIDE + 2 * APRON_TILES) ** 2 - LAYOUT_MAX_SIDE ** 2;

export class ApronRenderer {
  readonly mesh: THREE.Mesh;

  private readonly geometry: THREE.BufferGeometry;
  private readonly material: THREE.ShaderMaterial;
  private readonly positions: Float32Array;
  private readonly normals: Float32Array;
  private readonly colors: Float32Array;
  private readonly anims: Float32Array;
  private readonly positionAttr: THREE.BufferAttribute;
  private readonly normalAttr: THREE.BufferAttribute;
  private readonly colorAttr: THREE.BufferAttribute;
  private readonly animAttr: THREE.BufferAttribute;

  private readonly tmpTopColor = new THREE.Color();
  private readonly tmpSideColor = new THREE.Color();

  constructor(private readonly terrain: TerrainRenderer) {
    const totalVerts = MAX_APRON_TILES * VERTS_PER_TILE;
    this.positions = new Float32Array(totalVerts * 3);
    this.normals = new Float32Array(totalVerts * 3);
    this.colors = new Float32Array(totalVerts * 3);
    this.anims = new Float32Array(totalVerts * 2);

    this.geometry = new THREE.BufferGeometry();
    this.positionAttr = new THREE.BufferAttribute(this.positions, 3);
    this.normalAttr = new THREE.BufferAttribute(this.normals, 3);
    this.colorAttr = new THREE.BufferAttribute(this.colors, 3);
    this.animAttr = new THREE.BufferAttribute(this.anims, 2);
    this.positionAttr.setUsage(THREE.DynamicDrawUsage);
    this.normalAttr.setUsage(THREE.DynamicDrawUsage);
    this.colorAttr.setUsage(THREE.DynamicDrawUsage);
    this.animAttr.setUsage(THREE.DynamicDrawUsage);
    this.geometry.setAttribute('position', this.positionAttr);
    this.geometry.setAttribute('normal', this.normalAttr);
    this.geometry.setAttribute('aColor', this.colorAttr);
    this.geometry.setAttribute('aAnim', this.animAttr);
    // Loose bounding sphere at the apron's max extent (board + ring),
    // same rationale as the board mesh: always origin-centered, camera
    // frames the whole arena, so culling at this radius costs nothing.
    this.geometry.boundingSphere = new THREE.Sphere(
      new THREE.Vector3(0, BOTTOM_Y / 2, 0),
      LAYOUT_MAX_SIDE + 2 * APRON_TILES,
    );
    this.geometry.setDrawRange(0, 0);

    this.material = new THREE.ShaderMaterial({
      vertexShader: VERTEX_SHADER,
      fragmentShader: FRAGMENT_SHADER,
      uniforms: {
        uLightDir: { value: LIGHT_DIR.clone() },
        uAmbient: { value: AMBIENT },
        uTime: { value: 0 },
        uPlayHalf: { value: new THREE.Vector2(0, 0) },
        uFadeEnd: { value: APRON_TILES - CREEP_MAX_TILES },
        // Fog color MUST be the scene background (Renderer.sceneBackground,
        // TERMINAL_BLACK) — fade to #000 instead and a dark ring ghosts
        // where the apron meets the void.
        uFogColor: { value: new THREE.Color(COLORS.TERMINAL_BLACK) },
        uDither: { value: 1 },
      },
    });

    this.mesh = new THREE.Mesh(this.geometry, this.material);
  }

  /**
   * Build the ring for an encounter. Same world mapping as the board
   * (centered on the origin, halfX/halfZ from the PLAYABLE dims), so ring
   * coordinates simply continue the grid outward into negative/overflow
   * cells — which the height noise and the anim-phase hash both accept.
   */
  setTiles(tileGrid: TileGrid, gridW: number, gridH: number, theme: Theme = 'default'): void {
    const a = APRON_TILES;
    const halfX = gridW / 2;
    const halfZ = gridH / 2;
    const pos = this.positions;
    const norm = this.normals;
    const col = this.colors;
    const anim = this.anims;
    let vi = 0;

    const writeVert = (
      px: number, py: number, pz: number,
      nx: number, ny: number, nz: number,
      color: THREE.Color,
    ): void => {
      const pi = vi * 3;
      pos[pi] = px; pos[pi + 1] = py; pos[pi + 2] = pz;
      norm[pi] = nx; norm[pi + 1] = ny; norm[pi + 2] = nz;
      col[pi] = color.r; col[pi + 1] = color.g; col[pi + 2] = color.b;
      vi++;
    };

    for (let cy = -a; cy < gridH + a; cy++) {
      for (let cx = -a; cx < gridW + a; cx++) {
        // Ring cells only — the board mesh owns the interior.
        if (cx >= 0 && cx < gridW && cy >= 0 && cy < gridH) continue;

        // Clamp-to-edge sampling: the nearest playable tile's kind, so a
        // river/chasm/fire field at the board edge continues outward.
        const kind: TileKind = tileGrid.kindAt({
          x: Math.min(Math.max(cx, 0), gridW - 1),
          y: Math.min(Math.max(cy, 0), gridH - 1),
        });
        const topY = this.terrain.heightAt(cx, cy, kind);
        topColorFor(topY, kind, theme, this.tmpTopColor);
        this.tmpSideColor.copy(this.tmpTopColor).multiplyScalar(SIDE_SHADE);
        const top = this.tmpTopColor;
        const side = this.tmpSideColor;
        const animType =
          kind === 'fire' ? ANIM_FIRE :
          kind === 'healing' ? ANIM_HEALING :
          ANIM_NONE;
        const animPhase = (cx * 13 + cy * 7) * 0.43;
        const tileVertStart = vi;

        // World coords: identical mapping to TerrainRenderer.fillFromKindFn.
        const x0 = cx - halfX;
        const x1 = cx + 1 - halfX;
        const zHi = halfZ - cy;
        const zLo = halfZ - cy - 1;

        // Top face.
        writeVert(x0, topY, zHi, 0, 1, 0, top);
        writeVert(x1, topY, zHi, 0, 1, 0, top);
        writeVert(x1, topY, zLo, 0, 1, 0, top);
        writeVert(x0, topY, zHi, 0, 1, 0, top);
        writeVert(x1, topY, zLo, 0, 1, 0, top);
        writeVert(x0, topY, zLo, 0, 1, 0, top);

        // Side: zHi face (+Z).
        writeVert(x0, topY, zHi, 0, 0, 1, side);
        writeVert(x0, BOTTOM_Y, zHi, 0, 0, 1, side);
        writeVert(x1, BOTTOM_Y, zHi, 0, 0, 1, side);
        writeVert(x0, topY, zHi, 0, 0, 1, side);
        writeVert(x1, BOTTOM_Y, zHi, 0, 0, 1, side);
        writeVert(x1, topY, zHi, 0, 0, 1, side);

        // Side: zLo face (-Z).
        writeVert(x1, topY, zLo, 0, 0, -1, side);
        writeVert(x1, BOTTOM_Y, zLo, 0, 0, -1, side);
        writeVert(x0, BOTTOM_Y, zLo, 0, 0, -1, side);
        writeVert(x1, topY, zLo, 0, 0, -1, side);
        writeVert(x0, BOTTOM_Y, zLo, 0, 0, -1, side);
        writeVert(x0, topY, zLo, 0, 0, -1, side);

        // Side: x1 face (+X).
        writeVert(x1, topY, zHi, 1, 0, 0, side);
        writeVert(x1, BOTTOM_Y, zHi, 1, 0, 0, side);
        writeVert(x1, BOTTOM_Y, zLo, 1, 0, 0, side);
        writeVert(x1, topY, zHi, 1, 0, 0, side);
        writeVert(x1, BOTTOM_Y, zLo, 1, 0, 0, side);
        writeVert(x1, topY, zLo, 1, 0, 0, side);

        // Side: x0 face (-X).
        writeVert(x0, topY, zLo, -1, 0, 0, side);
        writeVert(x0, BOTTOM_Y, zLo, -1, 0, 0, side);
        writeVert(x0, BOTTOM_Y, zHi, -1, 0, 0, side);
        writeVert(x0, topY, zLo, -1, 0, 0, side);
        writeVert(x0, BOTTOM_Y, zHi, -1, 0, 0, side);
        writeVert(x0, topY, zHi, -1, 0, 0, side);

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
    this.animAttr.needsUpdate = true;
    this.geometry.setDrawRange(0, vi);
    (this.material.uniforms['uPlayHalf']!.value as THREE.Vector2).set(halfX, halfZ);
  }

  /** Same uTime accumulation as TerrainRenderer.advanceTime — drives the
   *  fog creep plus any clamp-extended fire/healing tile animation. */
  advanceTime(dt: number): void {
    const u = this.material.uniforms['uTime']!;
    u.value = (u.value as number) + dt;
  }

  /** Flip between the Bayer-stipple dissolve (true, default) and a smooth
   *  smoothstep fade. Runtime so the look can be A/B'd live from the
   *  console during a playtest: `__game.apron.setDither(false)`. */
  setDither(on: boolean): void {
    this.material.uniforms['uDither']!.value = on ? 1 : 0;
  }

  clear(): void {
    this.geometry.setDrawRange(0, 0);
  }

  dispose(): void {
    this.geometry.dispose();
    this.material.dispose();
  }
}
