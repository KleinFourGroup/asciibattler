import * as THREE from 'three';
import {
  GLYPHS,
  ATLAS_CELL_BUDGET,
  FULL_GLYPH_INK,
  INK_PAD_PX,
  inkRectFromRgba,
  liftToCellY,
  padInk,
  type GlyphInk,
} from './glyphs';
import { FONT_STACK } from './fontSubset';

/**
 * Builds a monospace glyph atlas at startup. Each glyph takes a fixed-size
 * cell on a 2D canvas, uploaded as one `THREE.CanvasTexture`, and is
 * addressed by `getGlyphUV(glyph)` for the sprite shaders.
 *
 * Glyphs are drawn white on transparent so the per-instance colour tints
 * freely: the texture is a coverage mask, not a coloured image.
 *
 * Construction is async because `ctx.fillText` uses a web font only once the
 * font has parsed. `document.fonts.ready` alone is not enough: it settles the
 * fonts that have started loading, and a CSS `@font-face` is fetched only when
 * something first uses it. If the atlas builds before any DOM text starts
 * that fetch, `ready` resolves with the face still absent and `fillText`
 * bakes a serif fallback into the atlas, which shows on a cold load or in a
 * browser without the font installed. So `create` calls `document.fonts.load`
 * on the exact face first, which starts the fetch and resolves once it's
 * ready, then awaits `ready` to settle anything else.
 *
 * The font is FONT_STACK (src/render/fontSubset.ts): the primary face and
 * the one shipped fallback, the chain the sheet's `--font-mono` names, so a
 * glyph the primary lacks rasterizes from a face we ship, never the OS's.
 */

/** Pixel size of each square cell in the atlas. */
const CELL_PX = 64;
/** Font size we draw at — leaves a small margin inside the cell. */
const FONT_PX = 56;

/** The grid. `COLS * ROWS` must equal `ATLAS_CELL_BUDGET` (glyphs.ts), the
 *  budget the headless test and the archetype editor check against. */
const COLS = 8;
const ROWS = 6;
const ATLAS_W = COLS * CELL_PX; // 512
const ATLAS_H = ROWS * CELL_PX; // 384

/**
 * UV rectangle for one glyph in the atlas, in GL texture space (not canvas
 * space): `(u0, v0)` is the bottom-left of the glyph's cell, `(u1, v1)` the
 * top-right. Sampled at these UVs the glyph is right side up, so the
 * billboard vertex shader does a single `mix(xy, zw, uv)` with no Y flip.
 *
 * The flip from canvas convention (top-down) to GL convention (bottom-up)
 * happens once, here, when the atlas is built.
 */
interface GlyphUV {
  readonly u0: number; // left
  readonly v0: number; // bottom (GL)
  readonly u1: number; // right
  readonly v1: number; // top (GL)
}

/**
 * A DEV guard: every registered glyph came from a shipped face (`FONT_STACK`)
 * and not from an OS fallback.
 *
 * A subset that lacks a glyph fails nothing: the atlas builds, the glyph has
 * ink, and the game looks right on the machine that built it. But the ink
 * measured from these cells places the click boxes and the three lifts
 * (bars, FX endpoints, the objective markers), so a fallback's different
 * letterform moves them on someone else's machine only.
 *
 * The check: draw the glyph with the stack backed by `serif`, then by
 * `sans-serif`. If the stack supplied it, both draws are the same glyph and
 * the alpha channels match; if it fell through, the two fallbacks differ.
 * Cheap (one small canvas, a pair per glyph, DEV only), and it needs no glyph
 * table: it asks the rasterizer directly.
 *
 * Warns rather than throws: a missing glyph should be loud in development but
 * must not break the game for a player whose browser did something unexpected.
 * The hard gates are gen:font's own checks and tests/font-coverage.test.ts,
 * which runs on every `npm test`.
 */
function assertGlyphsCameFromFont(atlasCtx: CanvasRenderingContext2D): void {
  const probe = document.createElement('canvas');
  probe.width = CELL_PX;
  probe.height = CELL_PX;
  const ctx = probe.getContext('2d', { willReadFrequently: true });
  if (!ctx) return; // no context in this environment — skip rather than crash boot

  const alphaOf = (glyph: string, backstop: string): Uint8ClampedArray => {
    ctx.clearRect(0, 0, CELL_PX, CELL_PX);
    ctx.fillStyle = '#FFFFFF';
    ctx.font = `${FONT_PX}px ${FONT_STACK}, ${backstop}`;
    ctx.textAlign = atlasCtx.textAlign;
    ctx.textBaseline = atlasCtx.textBaseline;
    ctx.fillText(glyph, CELL_PX / 2, CELL_PX / 2);
    return ctx.getImageData(0, 0, CELL_PX, CELL_PX).data;
  };

  const fellBack = GLYPHS.filter((glyph) => {
    const withSerif = alphaOf(glyph, 'serif');
    const withSans = alphaOf(glyph, 'sans-serif');
    for (let i = 3; i < withSerif.length; i += 4) {
      if (Math.abs(withSerif[i]! - withSans[i]!) > 8) return true;
    }
    return false;
  });

  if (fellBack.length > 0) {
    console.error(
      `[FontAtlas] ${fellBack.length} of ${GLYPHS.length} glyphs did NOT come from ` +
        `a shipped face (${FONT_STACK}) and were rasterized from an OS fallback: ` +
        `${fellBack.map((c) => `${c} (U+${c.codePointAt(0)!.toString(16).toUpperCase().padStart(4, '0')})`).join(', ')}. ` +
        `Their ink metrics — and so their click boxes and every lift derived ` +
        `from them — vary by machine. Fix: widen SUBSET_RANGES in src/render/fontSubset.ts ` +
        `(or add the glyph to a shipped face) and re-run \`npm run gen:font\`.`,
    );
  }
}

export class FontAtlas {
  readonly texture: THREE.CanvasTexture;

  private readonly uvByGlyph: ReadonlyMap<string, GlyphUV>;
  /** Each glyph's raw ink box, measured off its rasterized cell at build (no
   *  padding; `getPaddedGlyphInk` gives the click boxes). */
  private readonly inkByGlyph: ReadonlyMap<string, GlyphInk>;

  private constructor(
    texture: THREE.CanvasTexture,
    uvByGlyph: Map<string, GlyphUV>,
    inkByGlyph: Map<string, GlyphInk>,
  ) {
    this.texture = texture;
    this.uvByGlyph = uvByGlyph;
    this.inkByGlyph = inkByGlyph;
  }

  static async create(): Promise<FontAtlas> {
    // The unit glyphs come from the catalog, so the set grows as units are
    // authored. Guard the grid loudly: an over-budget count would place
    // glyphs off the canvas (row ≥ ROWS) and render blanks without a word.
    if (GLYPHS.length > COLS * ROWS) {
      throw new Error(
        `FontAtlas: ${GLYPHS.length} glyphs exceed the ${COLS * ROWS}-cell atlas grid ` +
          `(ATLAS_CELL_BUDGET=${ATLAS_CELL_BUDGET}). Grow COLS/ROWS here + the budget in glyphs.ts, ` +
          `or trim the unit catalog.`,
      );
    }
    // Fetch the faces (the self-hosted subsets' `@font-face` rules in
    // src/fonts.css, built by gen:font and imported in main.ts) before
    // rasterizing, so the atlas never bakes a serif fallback. `load` takes
    // the size and stack `fillText` uses below and fetches every face in the
    // stack, the fallback too; it resolves with the loaded FontFaces, or an
    // empty array if the family is undeclared, which degrades to a fallback
    // face rather than failing the boot. `await fonts.ready` then settles any
    // stragglers. A declared face whose file fails to load is the other case:
    // `load` rejects with a NetworkError that names nothing, so it is thrown
    // on under a message that says what failed, for the failure plate
    // (src/failure) to show.
    try {
      await document.fonts.load(`${FONT_PX}px ${FONT_STACK}`);
    } catch (cause) {
      throw new Error("FontAtlas: the game's font files failed to load", { cause });
    }
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
    ctx.font = `${FONT_PX}px ${FONT_STACK}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    const uvByGlyph = new Map<string, GlyphUV>();
    const inkByGlyph = new Map<string, GlyphInk>();
    for (let i = 0; i < GLYPHS.length; i++) {
      const glyph = GLYPHS[i]!;
      const col = i % COLS;
      const row = Math.floor(i / COLS);
      const cx = col * CELL_PX;
      const cy = row * CELL_PX;

      // Clipped to the cell: a glyph can ink past it (`╥` reaches six rows
      // below), and what lands in the next cell would show on that cell's
      // glyph and widen its ink box.
      ctx.save();
      ctx.beginPath();
      ctx.rect(cx, cy, CELL_PX, CELL_PX);
      ctx.clip();
      ctx.fillText(glyph, cx + CELL_PX / 2, cy + CELL_PX / 2);
      ctx.restore();

      // Measure the glyph's ink box off the cell just drawn, so the click box
      // hugs the visible glyph (pick.ts) with no hand-measured table to keep.
      // One 64×64 getImageData per glyph at boot.
      inkByGlyph.set(
        glyph,
        inkRectFromRgba(ctx.getImageData(cx, cy, CELL_PX, CELL_PX).data, CELL_PX, CELL_PX),
      );

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

    if (import.meta.env.DEV) assertGlyphsCameFromFont(ctx);

    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    // Bilinear filtering keeps glyph edges smooth when sprites render at
    // other than the cell's size.
    texture.magFilter = THREE.LinearFilter;
    texture.minFilter = THREE.LinearFilter;
    texture.generateMipmaps = false;
    texture.needsUpdate = true;

    return new FontAtlas(texture, uvByGlyph, inkByGlyph);
  }

  /**
   * The glyph's measured raw ink box (normalized, y up; `GlyphInk`), or
   * `FULL_GLYPH_INK` for a glyph the atlas hasn't measured: unlike
   * `getGlyphUV` it falls back rather than throws, a missing box degrading to
   * the full quad. The anchoring and lift math read this; the click boxes
   * read `getPaddedGlyphInk`.
   */
  getGlyphInk(glyph: string): GlyphInk {
    return this.inkByGlyph.get(glyph) ?? FULL_GLYPH_INK;
  }

  /** The ink box widened by `INK_PAD_PX` for the click's feel, for pick
   *  candidates only. */
  getPaddedGlyphInk(glyph: string): GlyphInk {
    return padInk(this.getGlyphInk(glyph), INK_PAD_PX / CELL_PX);
  }

  /** The camera-up lift (world units at size 1; callers scale by footprint)
   *  from a base-anchored sprite's anchor to its ink's visual centre: what
   *  "at the unit" means for FX endpoints and sparkles. */
  inkCenterLift(glyph: string): number {
    const ink = this.getGlyphInk(glyph);
    return liftToCellY((ink.y0 + ink.y1) / 2);
  }

  /** The camera-up lift from a base-anchored sprite's anchor to its ink's
   *  visual top: where a hitsplat floats, just above the visible glyph and
   *  not above the taller empty quad. */
  inkTopLift(glyph: string): number {
    return liftToCellY(this.getGlyphInk(glyph).y1);
  }

  /** The camera-up lift from a base-anchored sprite's anchor to its ink's
   *  visual bottom. A sprite that must stand its ink, not its quad, a fixed
   *  gap above a point (the objective markers) subtracts this from the gap:
   *  a letterform's ink starts at the font baseline, about a quarter-cell
   *  above the quad bottom it stands on. 0 for a block that fills its cell's
   *  floor. */
  inkBottomLift(glyph: string): number {
    return liftToCellY(this.getGlyphInk(glyph).y0);
  }

  getGlyphUV(glyph: string): GlyphUV {
    const uv = this.uvByGlyph.get(glyph);
    if (!uv) {
      throw new Error(
        `FontAtlas: no UV for glyph "${glyph}". A UNIT glyph comes from config/units.json ` +
          `(catalog-derived in glyphs.ts); a non-unit glyph must be added to NON_UNIT_GLYPHS there.`,
      );
    }
    return uv;
  }
}
