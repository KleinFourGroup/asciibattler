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
  animTypeFor,
  topColorFor,
} from './TerrainRenderer';
import VERTEX_SHADER from './shaders/apron.vert.glsl?raw';
import FRAGMENT_SHADER from './shaders/apron.frag.glsl?raw';
import FOG_GLSL from './shaders/fogcolor.glsl?raw';

/**
 * The apron: a ring of unplayable prism tiles around the board that carries
 * the terrain outward and dissolves into the mist, so the board reads as
 * placed in a foggy world instead of floating in the void.
 *
 * - **Render-only, generated per battle.** The sim never learns these tiles
 *   exist: no TileKind, no pathing, spawn or snapshot, and unwalkable by
 *   construction. Their kinds are clamp-to-edge samples of the board, so a
 *   river reaching the board's edge flows on into the mist instead of turning
 *   to floor. Walls don't extend: they are spawned bodies, and a wall ending
 *   looks natural where ground changing kind doesn't.
 * - **The board's look by construction.** Heights come from
 *   `TerrainRenderer.heightAt` (the fixed-seed field is a pure function of
 *   grid coordinates, so it continues past the board) and colours from
 *   `topColorFor`, so the ring matches the board until the fog takes it.
 * - **Legibility.** No grid lines out here, and the fade starts at the
 *   ring's first tile, so the playable edge is never in doubt.
 * - **The fog is colour math, not transparency.** A fully fogged pixel
 *   equals the mist behind it (the fragment shader samples the shared
 *   `fogColorAt` where the view ray meets the mist plane), so nothing
 *   alpha-sorts against the billboard sprites and no pass is added. The fade
 *   is a smoothstep, not a stipple: nothing else in the game dithers.
 * - **The edge band**: a crisp near-black outline on the ring's innermost
 *   0.12 tiles, the strong read of the playable edge, darker and wider than
 *   the board's own grid lines.
 *
 * A mesh apart from the terrain's, not a widened board: (a) the board's
 * buffer is sized at LAYOUT_MAX_SIDE², which the largest board plus the ring
 * would overflow; (b) `pickCell` raycasts the surface it is passed, so a
 * separate mesh is unclickable by construction; (c) the fade and creep stay
 * out of the board's shader. On layer 0, so never in the bloom pass.
 */

/** The ring's width in tiles. The buffers' capacity and the fade's width
 *  both derive from it. */
const APRON_TILES = 2;

/** The largest |creep| the fragment shader's summed sines reach (0.18 +
 *  0.14 + 0.13, kept equal to apron.frag.glsl's). The fade is shortened by
 *  this much so the outer rim stays fully fogged at the creep's deepest
 *  inhale; otherwise the rim's cut edge would ghost against the mist. */
const CREEP_MAX_TILES = 0.45;

const VERTS_PER_TILE = 30; // same prism as TerrainRenderer: top + 4 sides

/** The ring's capacity at the largest board: (MAX + 2A)² − MAX² tiles, 272
 *  at A = 2, small enough that resizing per battle isn't worth it; like the
 *  board mesh, it allocates once and sets the draw range per battle. */
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
    // A loose bounding sphere at the largest extent, board and ring, for the
    // board mesh's reason.
    this.geometry.boundingSphere = new THREE.Sphere(
      new THREE.Vector3(0, BOTTOM_Y / 2, 0),
      LAYOUT_MAX_SIDE + 2 * APRON_TILES,
    );
    this.geometry.setDrawRange(0, 0);

    this.material = new THREE.ShaderMaterial({
      vertexShader: VERTEX_SHADER,
      // fogcolor.glsl carries the shared `fogColorAt` (and the precision
      // statement), the snippet BackdropRenderer prepends too, so the fog's
      // target can't drift from the mist it fades into.
      fragmentShader: FOG_GLSL + FRAGMENT_SHADER,
      uniforms: {
        uLightDir: { value: LIGHT_DIR.clone() },
        uAmbient: { value: AMBIENT },
        uTime: { value: 0 },
        uPlayHalf: { value: new THREE.Vector2(0, 0) },
        uFadeEnd: { value: APRON_TILES - CREEP_MAX_TILES },
        // The fog's base colour must be the scene's background
        // (`Renderer.sceneBackground`, TERMINAL_BLACK): the mist's noise
        // swings around it and calms back to it with distance. Based on
        // #000, a dark ring ghosts where the mist meets the void.
        uFogColor: { value: new THREE.Color(COLORS.TERMINAL_BLACK) },
        uMistY: { value: BOTTOM_Y },
      },
    });

    this.mesh = new THREE.Mesh(this.geometry, this.material);
  }

  /**
   * Build the ring for a battle's board. The world mapping is the board's
   * (centred on the origin, halfX and halfZ from the playable size), so the
   * ring's coordinates continue the grid outward into negative and overflow
   * cells, which the height noise and the phase hash both accept.
   */
  setTiles(tileGrid: TileGrid, gridW: number, gridH: number, theme: Theme = 'grassland'): void {
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
        const animType = animTypeFor(kind);
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

  /** As `TerrainRenderer.advanceTime`, for the fog's creep, the mist's drift
   *  and the clamp-sampled tiles' animation. */
  advanceTime(dt: number): void {
    const u = this.material.uniforms['uTime']!;
    u.value = (u.value as number) + dt;
  }

  clear(): void {
    this.geometry.setDrawRange(0, 0);
  }
}
