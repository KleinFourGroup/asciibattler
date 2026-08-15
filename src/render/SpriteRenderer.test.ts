import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { SpriteRenderer } from './SpriteRenderer';
import type { FontAtlas } from './FontAtlas';

// Qb#2 — the depth-sort is pure buffer/camera math (no canvas/WebGL), so the
// REORDER LOGIC is node-testable even though the visual occlusion it fixes
// needs the browser (the FontAtlas is type-only here, so a stub satisfies the
// constructor without baking a real atlas — matching FontAtlas.test.ts's "the
// render layer isn't unit-tested" note, while still pinning the one piece that
// IS checkable headlessly: that the sort orders correctly AND never scrambles
// the handle⇄data association).

// §79d2 — the stub's stand lines: a "block" glyph flush at the quad bottom, a
// "letter" on a fake baseline. Values are arbitrary but distinct (and exact in
// float32, since they round-trip through the attribute buffer), so a
// scrambled/stale anchor shows.
const STUB_BASE_Y: Record<string, number> = { M: -0.5, p: -0.25 };

const stubAtlas = {
  texture: null,
  getGlyphUV: () => ({ u0: 0, v0: 0, u1: 1, v1: 1 }),
  baseAnchorY: (glyph: string) => STUB_BASE_Y[glyph] ?? -0.5,
} as unknown as FontAtlas;

/** A 45°-ish overhead camera like the battle framing (mirrors pick.test.ts). */
function makeCamera(): THREE.PerspectiveCamera {
  const cam = new THREE.PerspectiveCamera(50, 1, 0.1, 1000);
  cam.position.set(0, 10, 10);
  cam.lookAt(0, 0, 0);
  cam.updateMatrixWorld(true);
  return cam;
}

const _dir = new THREE.Vector3();
/** Signed along-view depth of `p` — the same key sortByDepth orders by. Larger
 *  = farther into the scene. */
function depthKey(cam: THREE.Camera, p: THREE.Vector3): number {
  cam.getWorldDirection(_dir);
  return p.dot(_dir);
}

const _slot = new THREE.Vector3();
function slotPos(sprites: SpriteRenderer, slot: number): THREE.Vector3 {
  const attr = sprites.mesh.geometry.getAttribute('instancePosition');
  return _slot.set(attr.getX(slot), attr.getY(slot), attr.getZ(slot));
}

/** Assert the instance buffer is ordered far→near across slots 0..n-1. */
function expectFarToNear(sprites: SpriteRenderer, cam: THREE.Camera, n: number): void {
  let prev = Infinity;
  for (let i = 0; i < n; i++) {
    const d = depthKey(cam, slotPos(sprites, i));
    expect(d).toBeLessThanOrEqual(prev + 1e-6); // non-increasing depth ⇒ farthest first
    prev = d;
  }
}

describe('SpriteRenderer.sortByDepth', () => {
  it('orders the instances far→near so the nearest sprite is drawn last (paints on top)', () => {
    const cam = makeCamera();
    const sprites = new SpriteRenderer(stubAtlas);
    // Add along z in NEAR→far order so the initial slots are the WRONG way round
    // and the sort has real work to do. (Toward +z is toward the camera = near.)
    const zs = [4, 2, 0, -2, -4];
    for (const z of zs) sprites.addSprite('M', '#33ff00', new THREE.Vector3(0, 0.5, z));

    sprites.sortByDepth(cam);

    expectFarToNear(sprites, cam, zs.length);
    // Concretely: slot 0 is the farthest (z = -4), the last slot the nearest (z = 4).
    expect(slotPos(sprites, 0).z).toBeCloseTo(-4);
    expect(slotPos(sprites, zs.length - 1).z).toBeCloseTo(4);
  });

  it('preserves each handle⇄data association through the reorder', () => {
    const cam = makeCamera();
    const sprites = new SpriteRenderer(stubAtlas);
    const want = new Map<number, THREE.Vector3>();
    for (const z of [3, -1, 5, -5, 1, -3]) {
      const p = new THREE.Vector3(z * 0.1, 0.5, z); // distinct x too, so a scramble shows
      want.set(sprites.addSprite('M', '#33ff00', p).id, p.clone());
    }

    sprites.sortByDepth(cam);

    // The buffer moved, but every handle must still resolve to ITS sprite — the
    // reorder is a permutation, not a corruption.
    const out = new THREE.Vector3();
    for (const [id, p] of want) {
      expect(sprites.getPosition({ id }, out)).not.toBeNull();
      expect(out.x).toBeCloseTo(p.x);
      expect(out.y).toBeCloseTo(p.y);
      expect(out.z).toBeCloseTo(p.z);
    }
  });

  it('is idempotent — re-sorting an already-ordered set changes nothing', () => {
    const cam = makeCamera();
    const sprites = new SpriteRenderer(stubAtlas);
    for (const z of [4, 2, 0, -2, -4]) {
      sprites.addSprite('M', '#33ff00', new THREE.Vector3(0, 0.5, z));
    }
    sprites.sortByDepth(cam);
    const after = [0, 1, 2, 3, 4].map((i) => slotPos(sprites, i).clone());

    sprites.sortByDepth(cam);
    for (let i = 0; i < after.length; i++) {
      expect(slotPos(sprites, i).z).toBeCloseTo(after[i]!.z);
    }
  });

  it('stays consistent when a removal precedes the sort', () => {
    const cam = makeCamera();
    const sprites = new SpriteRenderer(stubAtlas);
    const handles = [5, 3, 1, -1, -3, -5].map((z) =>
      sprites.addSprite('M', '#33ff00', new THREE.Vector3(0, 0.5, z)),
    );
    // Remove a middle sprite (exercises removeSprite's swap-with-last) BEFORE sorting.
    const removed = handles[2]!;
    sprites.removeSprite(removed);

    sprites.sortByDepth(cam);

    expect(sprites.count).toBe(5);
    expectFarToNear(sprites, cam, 5);
    // The removed handle is gone; every survivor still resolves to its own pos.
    const out = new THREE.Vector3();
    expect(sprites.getPosition(removed, out)).toBeNull();
    for (const h of handles) {
      if (h === removed) continue;
      expect(sprites.getPosition(h, out)).not.toBeNull();
    }
  });

  it('no-ops below two sprites', () => {
    const cam = makeCamera();
    const sprites = new SpriteRenderer(stubAtlas);
    const h = sprites.addSprite('M', '#33ff00', new THREE.Vector3(1, 0.5, 2));
    sprites.sortByDepth(cam); // must not throw on a single sprite
    const out = new THREE.Vector3();
    expect(sprites.getPosition(h, out)).not.toBeNull();
    expect(out.z).toBeCloseTo(2);
  });
});

// §79c/§79d2 — the per-instance anchor attribute: derived from (mode, glyph)
// at every glyph write, carried through the removeSprite swap-compaction AND
// the depth-sort repack with its instance (a scrambled anchor or a stale mode
// would silently re-line a standing glyph).
describe('SpriteRenderer instance anchor', () => {
  const CENTER = { x: 0, y: 0 };
  const BASE_M = { x: 0, y: STUB_BASE_Y['M']! };
  const BASE_P = { x: 0, y: STUB_BASE_Y['p']! };
  const anchorAtSlot = (sprites: SpriteRenderer, slot: number): { x: number; y: number } => {
    const attr = sprites.mesh.geometry.getAttribute('instanceAnchor');
    return { x: attr.getX(slot), y: attr.getY(slot) };
  };
  const slotOf = (sprites: SpriteRenderer, id: number): number => {
    // getPosition round-trips handle→slot internally; recover the slot by
    // matching the position buffer (positions are distinct in these tests).
    const out = new THREE.Vector3();
    sprites.getPosition({ id }, out);
    const attr = sprites.mesh.geometry.getAttribute('instancePosition');
    for (let s = 0; s < sprites.count; s++) {
      if (attr.getX(s) === out.x && attr.getY(s) === out.y && attr.getZ(s) === out.z) return s;
    }
    throw new Error('slot not found');
  };

  it("defaults to 'center' (0, 0); 'base' derives the glyph's stand line", () => {
    const sprites = new SpriteRenderer(stubAtlas);
    sprites.addSprite('M', '#33ff00', new THREE.Vector3(0, 0, 0));
    sprites.addSprite('M', '#33ff00', new THREE.Vector3(1, 0, 0), 'base');
    sprites.addSprite('p', '#33ff00', new THREE.Vector3(2, 0, 0), 'base');
    expect(anchorAtSlot(sprites, 0)).toEqual(CENTER);
    expect(anchorAtSlot(sprites, 1)).toEqual(BASE_M);
    expect(anchorAtSlot(sprites, 2)).toEqual(BASE_P); // per-glyph, not fixed
  });

  it('a glyph swap on a base sprite re-derives its stand line (§79d2)', () => {
    const sprites = new SpriteRenderer(stubAtlas);
    const h = sprites.addSprite('M', '#33ff00', new THREE.Vector3(0, 0, 0), 'base');
    expect(anchorAtSlot(sprites, 0)).toEqual(BASE_M);
    sprites.updateSprite(h, { glyph: 'p' });
    expect(anchorAtSlot(sprites, 0)).toEqual(BASE_P);
    // A centered sprite's glyph swap stays centered.
    const c = sprites.addSprite('M', '#33ff00', new THREE.Vector3(1, 0, 0));
    sprites.updateSprite(c, { glyph: 'p' });
    expect(anchorAtSlot(sprites, 1)).toEqual(CENTER);
  });

  it('the anchor travels with its instance through removeSprite compaction', () => {
    const sprites = new SpriteRenderer(stubAtlas);
    const doomed = sprites.addSprite('M', '#33ff00', new THREE.Vector3(0, 0, 0));
    const kept = sprites.addSprite('p', '#33ff00', new THREE.Vector3(1, 0, 0), 'base');
    sprites.removeSprite(doomed); // swaps the base-anchored sprite into slot 0
    expect(anchorAtSlot(sprites, 0)).toEqual(BASE_P);
    // And its MODE moved too: a glyph swap after the compaction still re-derives.
    sprites.updateSprite(kept, { glyph: 'M' });
    expect(anchorAtSlot(sprites, 0)).toEqual(BASE_M);
  });

  it('the anchor travels with its instance through the depth-sort repack', () => {
    const cam = makeCamera();
    const sprites = new SpriteRenderer(stubAtlas);
    // Near→far so the sort must reorder; only the near sprite is base-anchored.
    const baseAnchored = sprites.addSprite('p', '#33ff00', new THREE.Vector3(0, 0.5, 4), 'base');
    const centered = sprites.addSprite('M', '#33ff00', new THREE.Vector3(0, 0.5, -4));
    sprites.sortByDepth(cam);
    expect(anchorAtSlot(sprites, slotOf(sprites, baseAnchored.id))).toEqual(BASE_P);
    expect(anchorAtSlot(sprites, slotOf(sprites, centered.id))).toEqual(CENTER);
    // The MODE array rode the permutation: a swap after the sort re-derives.
    sprites.updateSprite(baseAnchored, { glyph: 'M' });
    expect(anchorAtSlot(sprites, slotOf(sprites, baseAnchored.id))).toEqual(BASE_M);
  });
});
