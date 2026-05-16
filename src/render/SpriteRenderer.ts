import * as THREE from 'three';
import type { FontAtlas } from './FontAtlas';

/**
 * Renders all in-scene ASCII sprites in a single draw call. One
 * `InstancedBufferGeometry` quad, four per-instance attributes (position,
 * glyph UV rect, color, alpha), and a tiny custom shader that handles
 * camera-facing billboarding in view space.
 *
 * Gameplay code holds an opaque `SpriteHandle` and never touches three.js
 * directly — the renderer can be replaced (e.g. with WebGPU) without any
 * call-site change. See ARCHITECTURE.md guiding principle 4.
 *
 * Step 2.2 ships add/remove only; Step 2.3 layers updates on top using the
 * same handle.
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

const VERTEX_SHADER = /* glsl */ `
  attribute vec3 instancePosition;
  attribute vec4 instanceGlyphUV;
  attribute vec3 instanceColor;
  attribute float instanceAlpha;

  uniform float uSpriteSize;

  varying vec2 vAtlasUV;
  varying vec3 vColor;
  varying float vAlpha;

  void main() {
    // Billboard: transform the instance's world position into view space,
    // then offset by the quad-local position in view space. In view space
    // the camera looks down -Z, so X/Y are screen-right/up regardless of
    // camera orientation — the quad ends up facing the camera for free.
    vec4 mvPos = modelViewMatrix * vec4(instancePosition, 1.0);
    mvPos.xy += position.xy * uSpriteSize;
    gl_Position = projectionMatrix * mvPos;

    // Interpolate the per-instance glyph UV rect by the quad's local UV:
    // bottom-left of quad (uv=0,0) -> (u0,v0); top-right (uv=1,1) -> (u1,v1).
    vAtlasUV = mix(instanceGlyphUV.xy, instanceGlyphUV.zw, uv);
    vColor = instanceColor;
    vAlpha = instanceAlpha;
  }
`;

const FRAGMENT_SHADER = /* glsl */ `
  precision highp float;

  uniform sampler2D uAtlas;

  varying vec2 vAtlasUV;
  varying vec3 vColor;
  varying float vAlpha;

  void main() {
    vec4 sampled = texture2D(uAtlas, vAtlasUV);
    // Atlas is white glyphs on transparent; the .a channel carries coverage.
    // Tint by per-instance color and modulate by per-instance alpha.
    float a = sampled.a * vAlpha;
    if (a < 0.01) discard;
    gl_FragColor = vec4(vColor, a);
  }
`;

export class SpriteRenderer {
  readonly mesh: THREE.Mesh;

  private readonly geometry: THREE.InstancedBufferGeometry;
  private readonly material: THREE.ShaderMaterial;
  private readonly capacity: number;

  private readonly aPosition: THREE.InstancedBufferAttribute;
  private readonly aGlyphUV: THREE.InstancedBufferAttribute;
  private readonly aColor: THREE.InstancedBufferAttribute;
  private readonly aAlpha: THREE.InstancedBufferAttribute;

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

    for (const attr of [this.aPosition, this.aGlyphUV, this.aColor, this.aAlpha]) {
      attr.setUsage(THREE.DynamicDrawUsage);
    }

    this.geometry.setAttribute('instancePosition', this.aPosition);
    this.geometry.setAttribute('instanceGlyphUV', this.aGlyphUV);
    this.geometry.setAttribute('instanceColor', this.aColor);
    this.geometry.setAttribute('instanceAlpha', this.aAlpha);

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

    this.mesh = new THREE.Mesh(this.geometry, this.material);
    // Bounding-sphere-based frustum culling lies when instances are placed
    // far from the geometry origin. Disable; the sprite count is small.
    this.mesh.frustumCulled = false;
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

    this.slotByHandle.set(id, slot);
    this.handleAtSlot[slot] = id;
    this.activeCount++;
    this.geometry.instanceCount = this.activeCount;

    return { id };
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
  }
}
