import * as THREE from 'three';
import type { FontAtlas } from './FontAtlas';
import VERTEX_SHADER from './shaders/billboard.vert.glsl?raw';
import FRAGMENT_SHADER from './shaders/sprite.frag.glsl?raw';
import BLOOM_FRAGMENT_SHADER from './shaders/sprite-bloom.frag.glsl?raw';

/** Three.js layer the bloom-only sprite mesh lives on (B1.1 selective bloom). */
export const BLOOM_LAYER = 1;

/**
 * Renders all in-scene ASCII sprites with selective per-sprite bloom. One
 * `InstancedBufferGeometry` quad, five per-instance attributes (position,
 * glyph UV rect, color, alpha, bloomIntensity), and two camera-facing
 * billboard meshes sharing those buffers:
 *
 *   - `mesh` (default layer 0): renders the visible sprite at its natural
 *     color. Ignores bloomIntensity. This is what the player sees.
 *   - `bloomMesh` (layer BLOOM_LAYER): renders `color * bloomIntensity`
 *     into the bloom-only render target. Multiplier semantics:
 *     0 = no halo, 1 = natural (blooms iff color crosses threshold),
 *     >1 = forced strong glow. The main mesh is unaffected.
 *
 * The bloom mesh is sent to a separate `EffectComposer` (see Renderer.ts)
 * that runs the bloom blur + high-pass, then additively mixes the result
 * back onto the main framebuffer. Decoupling the two means bloomIntensity
 * never darkens the visible sprite.
 *
 * Gameplay code holds an opaque `SpriteHandle` and never touches three.js
 * directly — the renderer can be replaced (e.g. with WebGPU) without any
 * call-site change. See ARCHITECTURE.md guiding principle 4.
 */

export interface SpriteHandle {
  readonly id: number;
}

const DEFAULT_CAPACITY = 256;

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

  private readonly atlas: FontAtlas;

  // Slot management. `slotByHandle` lets removal find a sprite by id; on
  // remove we swap the doomed slot with the last active one so the live
  // range stays packed.
  private activeCount = 0;
  private nextHandleId = 1;
  private readonly slotByHandle = new Map<number, number>();
  private readonly handleAtSlot: number[] = [];

  // Scratch THREE.Vector3 to avoid allocating per addSprite.
  private static readonly _scratchColor = new THREE.Color();

  constructor(atlas: FontAtlas, spriteSize = 1, capacity = DEFAULT_CAPACITY) {
    this.atlas = atlas;
    this.capacity = capacity;

    this.geometry = new THREE.InstancedBufferGeometry();
    this.geometry.setAttribute('position', new THREE.BufferAttribute(QUAD_POSITIONS, 3));
    this.geometry.setAttribute('uv', new THREE.BufferAttribute(QUAD_UVS, 2));
    this.geometry.setIndex(new THREE.BufferAttribute(QUAD_INDICES, 1));

    this.aPosition = new THREE.InstancedBufferAttribute(new Float32Array(capacity * 3), 3);
    this.aGlyphUV = new THREE.InstancedBufferAttribute(new Float32Array(capacity * 4), 4);
    this.aColor = new THREE.InstancedBufferAttribute(new Float32Array(capacity * 3), 3);
    this.aAlpha = new THREE.InstancedBufferAttribute(new Float32Array(capacity * 1), 1);
    this.aBloomIntensity = new THREE.InstancedBufferAttribute(new Float32Array(capacity * 1), 1);

    for (const attr of [this.aPosition, this.aGlyphUV, this.aColor, this.aAlpha, this.aBloomIntensity]) {
      attr.setUsage(THREE.DynamicDrawUsage);
    }

    this.geometry.setAttribute('instancePosition', this.aPosition);
    this.geometry.setAttribute('instanceGlyphUV', this.aGlyphUV);
    this.geometry.setAttribute('instanceColor', this.aColor);
    this.geometry.setAttribute('instanceAlpha', this.aAlpha);
    this.geometry.setAttribute('instanceBloomIntensity', this.aBloomIntensity);

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

    // Separate material for the bloom-only render. Same vertex shader and
    // atlas uniform — only the fragment shader differs (multiplies output
    // by per-instance bloomIntensity). Sharing the uAtlas uniform value
    // would let the textures diverge accidentally; cheap to recreate.
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

  /** Add a sprite. Returns an opaque handle for later removal/update. */
  addSprite(glyph: string, color: THREE.ColorRepresentation, position: THREE.Vector3): SpriteHandle {
    if (this.activeCount >= this.capacity) {
      throw new Error(`SpriteRenderer: capacity exhausted (${this.capacity})`);
    }

    const slot = this.activeCount;
    const id = this.nextHandleId++;

    this.writePosition(slot, position);
    this.writeGlyph(slot, glyph);
    this.writeColor(slot, color);
    this.writeAlpha(slot, 1);
    this.writeBloomIntensity(slot, 0.15);

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
    },
  ): void {
    const slot = this.slotByHandle.get(handle.id);
    if (slot === undefined) return;

    if (opts.position !== undefined) this.writePosition(slot, opts.position);
    if (opts.color !== undefined) this.writeColor(slot, opts.color);
    if (opts.glyph !== undefined) this.writeGlyph(slot, opts.glyph);
    if (opts.alpha !== undefined) this.writeAlpha(slot, opts.alpha);
    if (opts.bloomIntensity !== undefined) this.writeBloomIntensity(slot, opts.bloomIntensity);
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

  /** Dispose the GPU resources. Called when the renderer is torn down. */
  dispose(): void {
    this.geometry.dispose();
    this.material.dispose();
    this.bloomMaterial.dispose();
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
  }
}
