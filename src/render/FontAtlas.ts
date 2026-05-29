import * as THREE from 'three';

/**
 * Generates a monospace glyph atlas at startup. Each glyph occupies a fixed-
 * size cell on a canvas2d, gets uploaded as a single `THREE.CanvasTexture`, and
 * is addressable via `getGlyphUV(glyph)` for the sprite shader (Step 2.2) and
 * any HUD that wants in-canvas text later.
 *
 * Glyphs are drawn white on transparent so per-instance color in the sprite
 * shader can tint freely — the texture is a coverage mask, not a colored image.
 *
 * Construction is async because canvas2d's `ctx.fillText` only respects a
 * web font once the font has actually parsed. `document.fonts.ready` is the
 * portable signal for "every CSS-declared font has settled."
 */

const FONT_FAMILY = 'JetBrains Mono';

/** Pixel size of each square cell in the atlas. */
const CELL_PX = 64;
/** Font size we draw at — leaves a small margin inside the cell. */
const FONT_PX = 56;

const COLS = 8;
const ROWS = 4;
const ATLAS_W = COLS * CELL_PX; // 512
const ATLAS_H = ROWS * CELL_PX; // 256

/**
 * The MVP glyph set. Order is stable — adding a glyph appends to the end so
 * existing UV lookups stay valid. (`M` and `a` are the unit glyphs; `@` is
 * reserved for the post-MVP player-protagonist concept; digits + punctuation
 * are for the HUD.)
 */
const GLYPHS = [
  'M', 'a', '@',
  '0', '1', '2', '3', '4', '5', '6', '7', '8', '9',
  '.', ':', '/', '-', '+', '%', '!', '?',
  '#', // C1a: wall obstacle (neutral-team environment entity).
  '╥', // D6: half-cover (LOS-transparent neutral obstacle). U+2565.
  '*', // E6.B: ranged projectile tracer glyph.
] as const;

/**
 * UV rectangle for one glyph in the atlas, in **GL texture space** (not
 * canvas space): `(u0, v0)` is the bottom-left of the glyph cell, `(u1, v1)`
 * is the top-right. Sampling at these UVs gives the glyph right-side up,
 * which lets the sprite shader do a single `mix(zw, xy, uv)` with no Y flip.
 *
 * The Y-axis flip from canvas convention (top-down) to GL convention
 * (bottom-up) happens once, here, when the atlas is built.
 */
export interface GlyphUV {
  readonly u0: number; // left
  readonly v0: number; // bottom (GL)
  readonly u1: number; // right
  readonly v1: number; // top (GL)
}

export class FontAtlas {
  readonly texture: THREE.CanvasTexture;
  readonly cellSizePx = CELL_PX;
  readonly atlasWidthPx = ATLAS_W;
  readonly atlasHeightPx = ATLAS_H;

  private readonly uvByGlyph: ReadonlyMap<string, GlyphUV>;

  private constructor(texture: THREE.CanvasTexture, uvByGlyph: Map<string, GlyphUV>) {
    this.texture = texture;
    this.uvByGlyph = uvByGlyph;
  }

  static async create(): Promise<FontAtlas> {
    await document.fonts.ready;

    const canvas = document.createElement('canvas');
    canvas.width = ATLAS_W;
    canvas.height = ATLAS_H;

    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('FontAtlas: failed to acquire 2d canvas context');

    // White glyphs on transparent. Per-instance color in the sprite shader
    // multiplies into RGB; the atlas's alpha channel carries glyph coverage.
    ctx.clearRect(0, 0, ATLAS_W, ATLAS_H);
    ctx.fillStyle = '#FFFFFF';
    ctx.font = `${FONT_PX}px '${FONT_FAMILY}'`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    const uvByGlyph = new Map<string, GlyphUV>();
    for (let i = 0; i < GLYPHS.length; i++) {
      const glyph = GLYPHS[i]!;
      const col = i % COLS;
      const row = Math.floor(i / COLS);
      const cx = col * CELL_PX;
      const cy = row * CELL_PX;

      ctx.fillText(glyph, cx + CELL_PX / 2, cy + CELL_PX / 2);

      // Flip the canvas Y axis on the way in so the stored UVs are GL-ready.
      // Canvas top (small canvas-y) becomes GL top (large GL-v); canvas bottom
      // becomes GL bottom. After this transform the sprite shader needs no
      // 1.0-v adjustment.
      uvByGlyph.set(glyph, {
        u0: cx / ATLAS_W,
        v0: 1 - (cy + CELL_PX) / ATLAS_H, // bottom (GL)
        u1: (cx + CELL_PX) / ATLAS_W,
        v1: 1 - cy / ATLAS_H, // top (GL)
      });
    }

    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    // Bilinear filtering plays well with the eventual palette-quantization
    // post-pass: smooth edges in the atlas, sharp silhouettes after quantize.
    texture.magFilter = THREE.LinearFilter;
    texture.minFilter = THREE.LinearFilter;
    texture.generateMipmaps = false;
    texture.needsUpdate = true;

    return new FontAtlas(texture, uvByGlyph);
  }

  getGlyphUV(glyph: string): GlyphUV {
    const uv = this.uvByGlyph.get(glyph);
    if (!uv) {
      throw new Error(
        `FontAtlas: no UV for glyph "${glyph}". Add it to the GLYPHS set in FontAtlas.ts.`,
      );
    }
    return uv;
  }
}
