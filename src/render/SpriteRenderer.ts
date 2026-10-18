import * as THREE from 'three';
import type { FontAtlas } from './FontAtlas';
import { BASE_ANCHOR_Y } from './glyphs';
import VERTEX_SHADER from './shaders/billboard.vert.glsl?raw';
import FRAGMENT_SHADER from './shaders/sprite.frag.glsl?raw';
import BLOOM_FRAGMENT_SHADER from './shaders/sprite-bloom.frag.glsl?raw';

/** The three.js layer the bloom-only sprite mesh lives on. */
export const BLOOM_LAYER = 1;

/**
 * Renders every in-scene ASCII sprite, with a bloom chosen per sprite. One
 * `InstancedBufferGeometry` quad, seven per-instance attributes (position,
 * glyph UV rect, colour, alpha, bloomIntensity, size, anchor), and two
 * camera-facing billboard meshes sharing those buffers:
 *
 *   - `mesh` (layer 0): the visible sprite at its own colour, bloomIntensity
 *     ignored. What the player sees.
 *   - `bloomMesh` (layer BLOOM_LAYER): `color * bloomIntensity` into the
 *     bloom-only target. 0 is no halo, 1 the colour's own halo (the bloom's
 *     threshold is 0, so any colour halos), above 1 a stronger glow. The main
 *     mesh is unaffected.
 *
 * The bloom mesh goes to a separate `EffectComposer` (Renderer.ts), which
 * blurs it and adds the result onto the main frame, so bloomIntensity never
 * darkens the visible sprite.
 *
 * Callers hold an opaque `SpriteHandle` and never touch the instanced
 * buffers or the shaders' uniforms, so the implementation can change without
 * touching the sim (ARCHITECTURE's guiding principle 4).
 */

export interface SpriteHandle {
  readonly id: number;
}

/**
 * Where a sprite's quad sits relative to its anchor (`instancePosition`):
 *
 *  - `'center'` — the quad centres on the anchor, for things that float at a
 *    point: projectiles, motes.
 *  - `'base'` — the glyph stands on the anchor: its quad's bottom
 *    (`BASE_ANCHOR_Y`) meets the anchor, for every glyph, and the glyph rises
 *    screen-up from it. The ground mark under the glyph says where it touches
 *    the ground, so no glyph needs a stand line of its own.
 *
 * The vertex shader applies the offset in view space, so a base-anchored
 * glyph rises straight up the screen from its anchor's projection, never
 * along a world-Y lift that a perspective camera would project off-axis.
 * Declared at `addSprite` and fixed for the sprite's life.
 */
type SpriteAnchor = 'center' | 'base';

const DEFAULT_CAPACITY = 1024;

/**
 * Quad in local space: 1×1 centered at origin, in the XY plane.
 * The actual on-screen size is set by `uSpriteSize` and the billboard math
 * in the vertex shader — local Z is unused.
 */
const QUAD_POSITIONS = new Float32Array([
  -0.5, -0.5, 0,
  0.5, -0.5, 0,
  0.5, 0.5, 0,
  -0.5, 0.5, 0,
]);

/**
 * Quad UVs: (0,0) at bottom-left, (1,1) at top-right. The vertex shader
 * uses these to interpolate the per-instance glyph UV rect (stored in GL
 * convention by FontAtlas, so no Y flip is needed here).
 */
const QUAD_UVS = new Float32Array([0, 0, 1, 0, 1, 1, 0, 1]);

const QUAD_INDICES = new Uint16Array([0, 1, 2, 0, 2, 3]);

export class SpriteRenderer {
  readonly mesh: THREE.Mesh;
  readonly bloomMesh: THREE.Mesh;

  private readonly geometry: THREE.InstancedBufferGeometry;
  private readonly material: THREE.ShaderMaterial;
  private readonly bloomMaterial: THREE.ShaderMaterial;
  private readonly capacity: number;

  private readonly aPosition: THREE.InstancedBufferAttribute;
  private readonly aGlyphUV: THREE.InstancedBufferAttribute;
  private readonly aColor: THREE.InstancedBufferAttribute;
  private readonly aAlpha: THREE.InstancedBufferAttribute;
  private readonly aBloomIntensity: THREE.InstancedBufferAttribute;
  private readonly aSize: THREE.InstancedBufferAttribute;
  private readonly aAnchor: THREE.InstancedBufferAttribute;

  /** Public so the billboard builders (BattleRenderer's pick candidates) read
   *  the atlas the glyphs render from: the ink boxes (`getGlyphInk`) must
   *  match the rasterization on screen. */
  readonly atlas: FontAtlas;

  // Slot management. `slotByHandle` lets removal find a sprite by id; on
  // remove we swap the doomed slot with the last active one so the live
  // range stays packed.
  private activeCount = 0;
  private nextHandleId = 1;
  private readonly slotByHandle = new Map<number, number>();
  private readonly handleAtSlot: number[] = [];

  // A scratch colour, so `writeColor` allocates nothing.
  private static readonly _scratchColor = new THREE.Color();

  // The depth sort's scratch, reused across frames so the sort allocates
  // nothing. `_order` holds the live instances'
  // slot indices, sorted far→near by `_depths`; `_repackScratch` gathers one
  // attribute at a time during the in-place reorder; `_handleScratch` snapshots
  // the handle-at-slot map across the overlapping read/write of the rebuild.
  private readonly _camDir = new THREE.Vector3();
  private readonly _order: number[] = [];
  private readonly _depths: Float32Array;
  private readonly _repackScratch: Float32Array;
  private readonly _handleScratch: Int32Array;
  /** Descending by depth: the farthest sprite (largest key) sorts to the lowest
   *  slot so it draws first, and the nearest sprite ends up last and paints on
   *  top — the back-to-front order alpha blending needs. */
  private readonly _depthCompare = (a: number, b: number): number =>
    this._depths[b]! - this._depths[a]!;

  constructor(atlas: FontAtlas, spriteSize = 1, capacity = DEFAULT_CAPACITY) {
    this.atlas = atlas;
    this.capacity = capacity;
    this._depths = new Float32Array(capacity);
    this._repackScratch = new Float32Array(capacity * 4); // max stride (glyphUV) is 4
    this._handleScratch = new Int32Array(capacity);

    this.geometry = new THREE.InstancedBufferGeometry();
    this.geometry.setAttribute('position', new THREE.BufferAttribute(QUAD_POSITIONS, 3));
    this.geometry.setAttribute('uv', new THREE.BufferAttribute(QUAD_UVS, 2));
    this.geometry.setIndex(new THREE.BufferAttribute(QUAD_INDICES, 1));

    this.aPosition = new THREE.InstancedBufferAttribute(new Float32Array(capacity * 3), 3);
    this.aGlyphUV = new THREE.InstancedBufferAttribute(new Float32Array(capacity * 4), 4);
    this.aColor = new THREE.InstancedBufferAttribute(new Float32Array(capacity * 3), 3);
    this.aAlpha = new THREE.InstancedBufferAttribute(new Float32Array(capacity * 1), 1);
    this.aBloomIntensity = new THREE.InstancedBufferAttribute(new Float32Array(capacity * 1), 1);
    this.aSize = new THREE.InstancedBufferAttribute(new Float32Array(capacity * 1), 1);
    this.aAnchor = new THREE.InstancedBufferAttribute(new Float32Array(capacity * 2), 2);

    for (const attr of [
      this.aPosition,
      this.aGlyphUV,
      this.aColor,
      this.aAlpha,
      this.aBloomIntensity,
      this.aSize,
      this.aAnchor,
    ]) {
      attr.setUsage(THREE.DynamicDrawUsage);
    }

    this.geometry.setAttribute('instancePosition', this.aPosition);
    this.geometry.setAttribute('instanceGlyphUV', this.aGlyphUV);
    this.geometry.setAttribute('instanceColor', this.aColor);
    this.geometry.setAttribute('instanceAlpha', this.aAlpha);
    this.geometry.setAttribute('instanceBloomIntensity', this.aBloomIntensity);
    this.geometry.setAttribute('instanceSize', this.aSize);
    this.geometry.setAttribute('instanceAnchor', this.aAnchor);

    this.geometry.instanceCount = 0;

    this.material = new THREE.ShaderMaterial({
      vertexShader: VERTEX_SHADER,
      fragmentShader: FRAGMENT_SHADER,
      transparent: true,
      depthWrite: false, // glyphs blend; depth writes would clip neighbors
      uniforms: {
        uAtlas: { value: atlas.texture },
        uSpriteSize: { value: spriteSize },
      },
    });

    // The bloom-only render's material: the same vertex shader and atlas,
    // with its own uniforms; only the fragment shader differs, multiplying
    // the colour by the per-instance bloomIntensity.
    this.bloomMaterial = new THREE.ShaderMaterial({
      vertexShader: VERTEX_SHADER,
      fragmentShader: BLOOM_FRAGMENT_SHADER,
      transparent: true,
      depthWrite: false,
      uniforms: {
        uAtlas: { value: atlas.texture },
        uSpriteSize: { value: spriteSize },
      },
    });

    this.mesh = new THREE.Mesh(this.geometry, this.material);
    // Bounding-sphere-based frustum culling lies when instances are placed
    // far from the geometry origin. Disable; the sprite count is small.
    this.mesh.frustumCulled = false;

    // Shares geometry (and therefore the per-instance buffers) with `mesh`,
    // so every write to position/color/alpha/bloomIntensity reaches both
    // renders. Lives on BLOOM_LAYER so only the bloomComposer's RenderPass
    // picks it up.
    this.bloomMesh = new THREE.Mesh(this.geometry, this.bloomMaterial);
    this.bloomMesh.frustumCulled = false;
    this.bloomMesh.layers.set(BLOOM_LAYER);
  }

  /** Add a sprite. Returns an opaque handle for later removal or update.
   *  `anchor` declares how the quad sits on `position` (`SpriteAnchor`). */
  addSprite(
    glyph: string,
    color: THREE.ColorRepresentation,
    position: THREE.Vector3,
    anchor: SpriteAnchor = 'center',
  ): SpriteHandle {
    if (this.activeCount >= this.capacity) {
      throw new Error(`SpriteRenderer: capacity exhausted (${this.capacity})`);
    }

    const slot = this.activeCount;
    const id = this.nextHandleId++;

    this.writeAnchor(slot, anchor);
    this.writePosition(slot, position);
    this.writeGlyph(slot, glyph);
    this.writeColor(slot, color);
    this.writeAlpha(slot, 1);
    this.writeBloomIntensity(slot, 0.15);
    this.writeSize(slot, 1);

    this.slotByHandle.set(id, slot);
    this.handleAtSlot[slot] = id;
    this.activeCount++;
    this.geometry.instanceCount = this.activeCount;

    return { id };
  }

  /**
   * Update any subset of a sprite's attributes. Unspecified fields are
   * untouched. Idempotent: updating a removed handle is a silent no-op,
   * matching `removeSprite`'s semantics.
   */
  updateSprite(
    handle: SpriteHandle,
    opts: {
      position?: THREE.Vector3;
      color?: THREE.ColorRepresentation;
      glyph?: string;
      alpha?: number;
      bloomIntensity?: number;
      /** The sprite's size multiplier (1 = a unit glyph's size); tracers are
       *  smaller. */
      size?: number;
    },
  ): void {
    const slot = this.slotByHandle.get(handle.id);
    if (slot === undefined) return;

    if (opts.position !== undefined) this.writePosition(slot, opts.position);
    if (opts.color !== undefined) this.writeColor(slot, opts.color);
    if (opts.glyph !== undefined) this.writeGlyph(slot, opts.glyph);
    if (opts.alpha !== undefined) this.writeAlpha(slot, opts.alpha);
    if (opts.bloomIntensity !== undefined) this.writeBloomIntensity(slot, opts.bloomIntensity);
    if (opts.size !== undefined) this.writeSize(slot, opts.size);
  }

  /** Remove a sprite. Idempotent: removing an already-removed handle is a no-op. */
  removeSprite(handle: SpriteHandle): void {
    const slot = this.slotByHandle.get(handle.id);
    if (slot === undefined) return;

    const lastSlot = this.activeCount - 1;
    if (slot !== lastSlot) {
      // Swap the last active slot into the doomed one so the live range
      // stays a contiguous prefix of [0, capacity).
      this.copyInstance(lastSlot, slot);
      const movedId = this.handleAtSlot[lastSlot]!;
      this.slotByHandle.set(movedId, slot);
      this.handleAtSlot[slot] = movedId;
    }

    this.slotByHandle.delete(handle.id);
    this.handleAtSlot.pop();
    this.activeCount--;
    this.geometry.instanceCount = this.activeCount;
  }

  /** Current number of live sprites. Useful for tests + debug overlays. */
  get count(): number {
    return this.activeCount;
  }

  /**
   * Read a sprite's current world position into `out` and return it. Returns
   * `null` if the handle has been removed. Used by followers (HP/progress
   * bars) that need to track a sprite's position through SpriteAnimator
   * lerps each render frame without coupling to the animator's lerp state.
   */
  getPosition(handle: SpriteHandle, out: THREE.Vector3): THREE.Vector3 | null {
    const slot = this.slotByHandle.get(handle.id);
    if (slot === undefined) return null;
    const arr = this.aPosition.array as Float32Array;
    return out.set(arr[slot * 3]!, arr[slot * 3 + 1]!, arr[slot * 3 + 2]!);
  }

  /** A sprite's current alpha, or `null` once removed. A body's ground
   *  mark reads it, so the mark fades with its glyph (death, a reinforcement's
   *  arrival). */
  getAlpha(handle: SpriteHandle): number | null {
    const slot = this.slotByHandle.get(handle.id);
    if (slot === undefined) return null;
    return (this.aAlpha.array as Float32Array)[slot]!;
  }

  /**
   * Depth-sort the live instances back to front for `camera`, so the
   * painter's-order draw (instances rasterize in slot order, 0 → count)
   * matches camera depth. The glyph billboards write no depth (a transparent
   * blend can't share the one-value depth buffer; see the material's
   * comment), so draw order alone decides which sprite covers which; without
   * the sort a farther sprite in a higher slot paints over a nearer one.
   *
   * Reorders all seven per-instance buffers and the handle ⇄ slot maps in
   * place, with only the preallocated scratch above, so a frame allocates
   * nothing. Cheap: one along-view depth key per instance (a dot product), an
   * O(n log n) index sort and a 15-float gather per instance. Game calls it
   * once a frame, after every sprite position has settled and before the
   * render.
   */
  sortByDepth(camera: THREE.Camera): void {
    const n = this.activeCount;
    if (n < 2) return;

    // The camera's world look direction (−Z). `dot(pos, dir)` is the signed
    // distance along the view axis, larger being farther into the scene. The
    // camera-position term is the same for every instance, so it drops out of
    // the ordering. This planar depth is the right painter's key; a radial
    // distance to the camera mis-orders at the frame's edges.
    // getWorldDirection also refreshes the camera's world matrix, so the key
    // is right before the renderer has rendered.
    camera.getWorldDirection(this._camDir);
    const dx = this._camDir.x;
    const dy = this._camDir.y;
    const dz = this._camDir.z;

    const pos = this.aPosition.array as Float32Array;
    const depths = this._depths;
    const order = this._order;
    order.length = n;
    for (let i = 0; i < n; i++) {
      depths[i] = pos[i * 3]! * dx + pos[i * 3 + 1]! * dy + pos[i * 3 + 2]! * dz;
      order[i] = i;
    }
    order.sort(this._depthCompare);

    // Already in order (nothing moved relative to the camera)? Skip the
    // repack and the seven buffer uploads. The sort is stable, so equal-depth
    // runs keep their order, and this hits often on a still board.
    let changed = false;
    for (let i = 0; i < n; i++) {
      if (order[i] !== i) {
        changed = true;
        break;
      }
    }
    if (!changed) return;

    this.repackByOrder(this.aPosition, 3, n);
    this.repackByOrder(this.aGlyphUV, 4, n);
    this.repackByOrder(this.aColor, 3, n);
    this.repackByOrder(this.aAlpha, 1, n);
    this.repackByOrder(this.aBloomIntensity, 1, n);
    this.repackByOrder(this.aSize, 1, n);
    this.repackByOrder(this.aAnchor, 2, n);

    // Rebuild the handle⇄slot maps to match the new slot order. The read index
    // (old slot `order[j]`) and write index (new slot `j`) overlap, so snapshot
    // the handles in the new order first, then write back.
    const scratch = this._handleScratch;
    for (let j = 0; j < n; j++) scratch[j] = this.handleAtSlot[order[j]!]!;
    for (let j = 0; j < n; j++) {
      const h = scratch[j]!;
      this.handleAtSlot[j] = h;
      this.slotByHandle.set(h, j);
    }
  }

  /**
   * Gather one instanced attribute's live range into the `_order` permutation
   * and write it back in place (via `_repackScratch`). Old data is read from
   * `attr` and the result overwrites it, so callers must not have mutated
   * `attr` for this sort yet; each attribute is independent, so the seven
   * calls in `sortByDepth` are safe in any order.
   */
  private repackByOrder(attr: THREE.InstancedBufferAttribute, stride: number, n: number): void {
    const arr = attr.array as Float32Array;
    const scratch = this._repackScratch;
    const order = this._order;
    for (let j = 0; j < n; j++) {
      const src = order[j]! * stride;
      const dst = j * stride;
      for (let k = 0; k < stride; k++) scratch[dst + k] = arr[src + k]!;
    }
    const total = n * stride;
    for (let i = 0; i < total; i++) arr[i] = scratch[i]!;
    attr.needsUpdate = true;
  }

  // ---- Instance-buffer helpers ----

  private writePosition(slot: number, p: THREE.Vector3): void {
    const arr = this.aPosition.array as Float32Array;
    arr[slot * 3] = p.x;
    arr[slot * 3 + 1] = p.y;
    arr[slot * 3 + 2] = p.z;
    this.aPosition.needsUpdate = true;
  }

  private writeGlyph(slot: number, glyph: string): void {
    const uv = this.atlas.getGlyphUV(glyph);
    const arr = this.aGlyphUV.array as Float32Array;
    arr[slot * 4] = uv.u0;
    arr[slot * 4 + 1] = uv.v0;
    arr[slot * 4 + 2] = uv.u1;
    arr[slot * 4 + 3] = uv.v1;
    this.aGlyphUV.needsUpdate = true;
  }

  /** The anchor offset depends on the mode alone, which is fixed for the
   *  sprite's life, so it is written once, at `addSprite`; compaction and the
   *  depth sort carry it with the instance. */
  private writeAnchor(slot: number, mode: SpriteAnchor): void {
    const arr = this.aAnchor.array as Float32Array;
    arr[slot * 2] = 0;
    arr[slot * 2 + 1] = mode === 'base' ? BASE_ANCHOR_Y : 0;
    this.aAnchor.needsUpdate = true;
  }

  private writeColor(slot: number, color: THREE.ColorRepresentation): void {
    const c = SpriteRenderer._scratchColor.set(color);
    const arr = this.aColor.array as Float32Array;
    arr[slot * 3] = c.r;
    arr[slot * 3 + 1] = c.g;
    arr[slot * 3 + 2] = c.b;
    this.aColor.needsUpdate = true;
  }

  private writeAlpha(slot: number, alpha: number): void {
    const arr = this.aAlpha.array as Float32Array;
    arr[slot] = alpha;
    this.aAlpha.needsUpdate = true;
  }

  private writeBloomIntensity(slot: number, intensity: number): void {
    const arr = this.aBloomIntensity.array as Float32Array;
    arr[slot] = intensity;
    this.aBloomIntensity.needsUpdate = true;
  }

  private writeSize(slot: number, size: number): void {
    const arr = this.aSize.array as Float32Array;
    arr[slot] = size;
    this.aSize.needsUpdate = true;
  }


  /**
   * Copy every per-instance attribute from one slot to another. Used by
   * `removeSprite` to compact the live range.
   */
  private copyInstance(srcSlot: number, dstSlot: number): void {
    const copyN = (attr: THREE.InstancedBufferAttribute, n: number): void => {
      const arr = attr.array as Float32Array;
      for (let i = 0; i < n; i++) {
        arr[dstSlot * n + i] = arr[srcSlot * n + i]!;
      }
      attr.needsUpdate = true;
    };
    copyN(this.aPosition, 3);
    copyN(this.aGlyphUV, 4);
    copyN(this.aColor, 3);
    copyN(this.aAlpha, 1);
    copyN(this.aBloomIntensity, 1);
    copyN(this.aSize, 1);
    copyN(this.aAnchor, 2);
  }
}
