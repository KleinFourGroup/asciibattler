import * as THREE from 'three';
import VERTEX_SHADER from './shaders/bar.vert.glsl?raw';
import FRAGMENT_SHADER from './shaders/bar.frag.glsl?raw';

/**
 * Renders HP / action-progress bars as billboarded quads with a
 * shader-cutoff fill. Same instancing recipe as SpriteRenderer: one
 * `InstancedBufferGeometry` quad, per-instance attributes (position, size,
 * fillPct, bg/fill colors, alpha), opaque `BarHandle` IDs.
 *
 * Single mesh on layer 0 (no bloom mesh). Per B3 design: bars don't
 * contribute to the selective-bloom pass — the visual budget stays on the
 * sprites. If that decision reverses, mirror the SpriteRenderer pattern
 * (second mesh on BLOOM_LAYER sharing the same geometry/buffers).
 *
 * Color is computed at the call site (BattleRenderer picks the
 * green→amber→red gradient based on HP%); this renderer is dumb about
 * what the colors mean.
 */

export interface BarHandle {
  readonly id: number;
}

export interface BarOptions {
  position: THREE.Vector3;
  size: THREE.Vector2;
  fillPct: number;
  bgColor: THREE.ColorRepresentation;
  fillColor: THREE.ColorRepresentation;
  alpha?: number;
}

export interface BarUpdate {
  position?: THREE.Vector3;
  size?: THREE.Vector2;
  fillPct?: number;
  bgColor?: THREE.ColorRepresentation;
  fillColor?: THREE.ColorRepresentation;
  alpha?: number;
}

const DEFAULT_CAPACITY = 256;

const QUAD_POSITIONS = new Float32Array([
  -0.5, -0.5, 0,
  0.5, -0.5, 0,
  0.5, 0.5, 0,
  -0.5, 0.5, 0,
]);

const QUAD_UVS = new Float32Array([0, 0, 1, 0, 1, 1, 0, 1]);

const QUAD_INDICES = new Uint16Array([0, 1, 2, 0, 2, 3]);

export class BarRenderer {
  readonly mesh: THREE.Mesh;

  private readonly geometry: THREE.InstancedBufferGeometry;
  private readonly material: THREE.ShaderMaterial;
  private readonly capacity: number;

  private readonly aPosition: THREE.InstancedBufferAttribute;
  private readonly aSize: THREE.InstancedBufferAttribute;
  private readonly aFillPct: THREE.InstancedBufferAttribute;
  private readonly aBgColor: THREE.InstancedBufferAttribute;
  private readonly aFillColor: THREE.InstancedBufferAttribute;
  private readonly aAlpha: THREE.InstancedBufferAttribute;

  private activeCount = 0;
  private nextHandleId = 1;
  private readonly slotByHandle = new Map<number, number>();
  private readonly handleAtSlot: number[] = [];

  private static readonly _scratchColor = new THREE.Color();

  constructor(capacity = DEFAULT_CAPACITY) {
    this.capacity = capacity;

    this.geometry = new THREE.InstancedBufferGeometry();
    this.geometry.setAttribute('position', new THREE.BufferAttribute(QUAD_POSITIONS, 3));
    this.geometry.setAttribute('uv', new THREE.BufferAttribute(QUAD_UVS, 2));
    this.geometry.setIndex(new THREE.BufferAttribute(QUAD_INDICES, 1));

    this.aPosition = new THREE.InstancedBufferAttribute(new Float32Array(capacity * 3), 3);
    this.aSize = new THREE.InstancedBufferAttribute(new Float32Array(capacity * 2), 2);
    this.aFillPct = new THREE.InstancedBufferAttribute(new Float32Array(capacity * 1), 1);
    this.aBgColor = new THREE.InstancedBufferAttribute(new Float32Array(capacity * 3), 3);
    this.aFillColor = new THREE.InstancedBufferAttribute(new Float32Array(capacity * 3), 3);
    this.aAlpha = new THREE.InstancedBufferAttribute(new Float32Array(capacity * 1), 1);

    for (const attr of [this.aPosition, this.aSize, this.aFillPct, this.aBgColor, this.aFillColor, this.aAlpha]) {
      attr.setUsage(THREE.DynamicDrawUsage);
    }

    this.geometry.setAttribute('instancePosition', this.aPosition);
    this.geometry.setAttribute('instanceSize', this.aSize);
    this.geometry.setAttribute('instanceFillPct', this.aFillPct);
    this.geometry.setAttribute('instanceBgColor', this.aBgColor);
    this.geometry.setAttribute('instanceFillColor', this.aFillColor);
    this.geometry.setAttribute('instanceAlpha', this.aAlpha);

    this.geometry.instanceCount = 0;

    this.material = new THREE.ShaderMaterial({
      vertexShader: VERTEX_SHADER,
      fragmentShader: FRAGMENT_SHADER,
      transparent: true,
      depthWrite: false,
    });

    this.mesh = new THREE.Mesh(this.geometry, this.material);
    this.mesh.frustumCulled = false;
  }

  addBar(opts: BarOptions): BarHandle {
    if (this.activeCount >= this.capacity) {
      throw new Error(`BarRenderer: capacity exhausted (${this.capacity})`);
    }

    const slot = this.activeCount;
    const id = this.nextHandleId++;

    this.writePosition(slot, opts.position);
    this.writeSize(slot, opts.size);
    this.writeFillPct(slot, opts.fillPct);
    this.writeBgColor(slot, opts.bgColor);
    this.writeFillColor(slot, opts.fillColor);
    this.writeAlpha(slot, opts.alpha ?? 1);

    this.slotByHandle.set(id, slot);
    this.handleAtSlot[slot] = id;
    this.activeCount++;
    this.geometry.instanceCount = this.activeCount;

    return { id };
  }

  updateBar(handle: BarHandle, opts: BarUpdate): void {
    const slot = this.slotByHandle.get(handle.id);
    if (slot === undefined) return;

    if (opts.position !== undefined) this.writePosition(slot, opts.position);
    if (opts.size !== undefined) this.writeSize(slot, opts.size);
    if (opts.fillPct !== undefined) this.writeFillPct(slot, opts.fillPct);
    if (opts.bgColor !== undefined) this.writeBgColor(slot, opts.bgColor);
    if (opts.fillColor !== undefined) this.writeFillColor(slot, opts.fillColor);
    if (opts.alpha !== undefined) this.writeAlpha(slot, opts.alpha);
  }

  removeBar(handle: BarHandle): void {
    const slot = this.slotByHandle.get(handle.id);
    if (slot === undefined) return;

    const lastSlot = this.activeCount - 1;
    if (slot !== lastSlot) {
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

  get count(): number {
    return this.activeCount;
  }

  dispose(): void {
    this.geometry.dispose();
    this.material.dispose();
  }

  private writePosition(slot: number, p: THREE.Vector3): void {
    const arr = this.aPosition.array as Float32Array;
    arr[slot * 3] = p.x;
    arr[slot * 3 + 1] = p.y;
    arr[slot * 3 + 2] = p.z;
    this.aPosition.needsUpdate = true;
  }

  private writeSize(slot: number, s: THREE.Vector2): void {
    const arr = this.aSize.array as Float32Array;
    arr[slot * 2] = s.x;
    arr[slot * 2 + 1] = s.y;
    this.aSize.needsUpdate = true;
  }

  private writeFillPct(slot: number, pct: number): void {
    const arr = this.aFillPct.array as Float32Array;
    arr[slot] = pct;
    this.aFillPct.needsUpdate = true;
  }

  private writeBgColor(slot: number, color: THREE.ColorRepresentation): void {
    const c = BarRenderer._scratchColor.set(color);
    const arr = this.aBgColor.array as Float32Array;
    arr[slot * 3] = c.r;
    arr[slot * 3 + 1] = c.g;
    arr[slot * 3 + 2] = c.b;
    this.aBgColor.needsUpdate = true;
  }

  private writeFillColor(slot: number, color: THREE.ColorRepresentation): void {
    const c = BarRenderer._scratchColor.set(color);
    const arr = this.aFillColor.array as Float32Array;
    arr[slot * 3] = c.r;
    arr[slot * 3 + 1] = c.g;
    arr[slot * 3 + 2] = c.b;
    this.aFillColor.needsUpdate = true;
  }

  private writeAlpha(slot: number, alpha: number): void {
    const arr = this.aAlpha.array as Float32Array;
    arr[slot] = alpha;
    this.aAlpha.needsUpdate = true;
  }

  private copyInstance(srcSlot: number, dstSlot: number): void {
    const copyN = (attr: THREE.InstancedBufferAttribute, n: number): void => {
      const arr = attr.array as Float32Array;
      for (let i = 0; i < n; i++) {
        arr[dstSlot * n + i] = arr[srcSlot * n + i]!;
      }
      attr.needsUpdate = true;
    };
    copyN(this.aPosition, 3);
    copyN(this.aSize, 2);
    copyN(this.aFillPct, 1);
    copyN(this.aBgColor, 3);
    copyN(this.aFillColor, 3);
    copyN(this.aAlpha, 1);
  }
}
