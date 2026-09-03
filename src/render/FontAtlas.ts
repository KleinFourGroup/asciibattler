import * as THREE from 'three';
import {
  GLYPHS,
  ATLAS_CELL_BUDGET,
  FULL_GLYPH_INK,
  INK_PAD_PX,
  baseAnchorYFor,
  descenderRoomFor,
  DESCENDER_BARRIER_PX,
  inkRectFromRgba,
  padInk,
  type GlyphInk,
} from './glyphs';

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
 * web font once the font has actually parsed. `document.fonts.ready` alone is
 * NOT enough: it resolves once every font that has *started* loading settles,
 * but a CSS-declared `@font-face` is only fetched when something first USES it.
 * If the atlas builds before any DOM text triggers that fetch, `ready` resolves
 * with JetBrains Mono still absent and `fillText` bakes the serif fallback into
 * the atlas (the bug: glyphs render serif on a cold load / in a clean browser
 * where the font isn't a system install). So we explicitly `document.fonts.load`
 * the exact face first — that kicks off the fetch and resolves once it's ready —
 * then await `ready` as a belt-and-suspenders settle.
 */

const FONT_FAMILY = 'JetBrains Mono';

/** Pixel size of each square cell in the atlas. */
const CELL_PX = 64;
/** Font size we draw at — leaves a small margin inside the cell. */
const FONT_PX = 56;

const COLS = 8;
// §29 (gotcha #33) — bumped 4 → 6 to seat the new demo roster's glyphs. The
// J3 'X' filled the old 8×4 = 32; the status-on-hit/chain/summon archetypes
// (reaver/corrupter/…) overflow it, so the grid grew to 8×6 = 48. §38e now
// derives the unit glyphs from the catalog, so the count grows whenever a unit
// is authored — `COLS * ROWS` must stay `=== ATLAS_CELL_BUDGET` (glyphs.ts).
const ROWS = 6;
const ATLAS_W = COLS * CELL_PX; // 512
const ATLAS_H = ROWS * CELL_PX; // 384

// The registered glyph set moved to ./glyphs (a THREE-free module) so the
// headless suite can import it without pulling in the renderer — see
// FontAtlas.test.ts for the archetype-glyph-coverage guard. Append new
// glyphs there (gotcha #33, append-only).

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

/**
 * §79g — DEV guard: prove every registered glyph actually came from
 * `FONT_FAMILY` and not from an OS fallback.
 *
 * The bug this exists to prevent (found at §79f, fixed at §79g): we loaded a
 * font subset that silently lacked `╥` and `▄`, so those two — every wall,
 * half-cover and rubble entity — rasterized from whatever the OS substituted.
 * Nothing failed; the atlas built, the glyphs had ink, the game looked fine on
 * the developer's machine. It matters because `baseAnchorYFor` classifies the
 * stand line off the ink measured from these very cells (floor-family vs
 * baseline, within `INK_FLOOR_EPSILON`), so a fallback font's different
 * letterform geometry silently moves an entity's stand line — a regression
 * reproducible only on someone else's machine.
 *
 * The test: draw the char with the family backed by `serif`, then by
 * `sans-serif`. If the family supplied the glyph, both draws are the SAME glyph
 * and the alpha channels match exactly; if it fell through, the two fallbacks
 * differ. Cheap (one small canvas, ~47 pairs, DEV only) and it needs no glyph
 * table to maintain — it asks the rasterizer the question directly.
 *
 * Warns rather than throws: a missing glyph should be loud during development,
 * but must not brick the game for a player whose browser did something
 * unexpected. The build-time check in `scripts/build-font.mjs` is the hard gate.
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
    ctx.font = `${FONT_PX}px '${FONT_FAMILY}', ${backstop}`;
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
        `'${FONT_FAMILY}' and were rasterized from an OS fallback: ` +
        `${fellBack.map((c) => `${c} (U+${c.codePointAt(0)!.toString(16).toUpperCase().padStart(4, '0')})`).join(', ')}. ` +
        `Their ink metrics — and so their stand line (§79d2) and every lift derived ` +
        `from it — vary by machine. Fix: widen SUBSET_RANGES in src/render/fontSubset.ts ` +
        `and re-run \`npm run gen:font\`.`,
    );
  }
}

export class FontAtlas {
  readonly texture: THREE.CanvasTexture;
  readonly cellSizePx = CELL_PX;
  readonly atlasWidthPx = ATLAS_W;
  readonly atlasHeightPx = ATLAS_H;

  private readonly uvByGlyph: ReadonlyMap<string, GlyphUV>;
  /** §79a/§79d2 — per-glyph RAW ink bboxes measured off the rasterized cells
   *  at build (no padding — see `getPaddedGlyphInk` for the clickbox rects). */
  private readonly inkByGlyph: ReadonlyMap<string, GlyphInk>;
  /** §79d2 — the font's alphabetic baseline as a normalized y-up cell coord
   *  (~0.26 for JetBrains Mono at 56/64): the letterform stand line's reference
   *  for `baseAnchorY`. */
  readonly baselineY: number;
  /** §91-pre2 — how far above the tile the baseline sits (normalized cell
   *  units): the deepest registered descender + `DESCENDER_BARRIER_PX`,
   *  measured off this build's ink (`descenderRoomFor`). Exposed for the
   *  browser probe (re-derive it from `getGlyphInk`, never from here). */
  readonly descenderRoom: number;

  private constructor(
    texture: THREE.CanvasTexture,
    uvByGlyph: Map<string, GlyphUV>,
    inkByGlyph: Map<string, GlyphInk>,
    baselineY: number,
    descenderRoom: number,
  ) {
    this.texture = texture;
    this.uvByGlyph = uvByGlyph;
    this.inkByGlyph = inkByGlyph;
    this.baselineY = baselineY;
    this.descenderRoom = descenderRoom;
  }

  static async create(): Promise<FontAtlas> {
    // §38e — the unit glyphs are catalog-derived, so the set grows as units are
    // authored. Guard the grid capacity loudly: an over-budget count would
    // otherwise place glyphs off-canvas (row ≥ ROWS) and silently render blanks.
    if (GLYPHS.length > COLS * ROWS) {
      throw new Error(
        `FontAtlas: ${GLYPHS.length} glyphs exceed the ${COLS * ROWS}-cell atlas grid ` +
          `(ATLAS_CELL_BUDGET=${ATLAS_CELL_BUDGET}). Grow COLS/ROWS here + the budget in glyphs.ts, ` +
          `or trim the unit catalog.`,
      );
    }
    // Force the JetBrains Mono fetch (the self-hosted subset `@font-face` in
    // src/fonts.css — generated by gen:font since §79g — imported in main.ts)
    // BEFORE rasterizing, so
    // the atlas never bakes the serif fallback. `load` matches the same
    // size/family string `fillText` uses below; it resolves with the loaded
    // FontFace(s), or an empty array if the family is undeclared (it never
    // throws), so a missing font degrades to the old fallback rather than
    // crashing startup. `await fonts.ready` then settles any stragglers.
    await document.fonts.load(`${FONT_PX}px '${FONT_FAMILY}'`);
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
    const inkByGlyph = new Map<string, GlyphInk>();
    for (let i = 0; i < GLYPHS.length; i++) {
      const glyph = GLYPHS[i]!;
      const col = i % COLS;
      const row = Math.floor(i / COLS);
      const cx = col * CELL_PX;
      const cy = row * CELL_PX;

      ctx.fillText(glyph, cx + CELL_PX / 2, cy + CELL_PX / 2);

      // §79a — measure the glyph's ink bbox off the cell just drawn, so the
      // click hit-box hugs the visible glyph (pick.ts) with no hand-measured
      // table to maintain. One 64×64 getImageData per glyph at boot — trivial.
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

    // §79d2 — measure the font's alphabetic baseline once, in the same
    // font/baseline configuration the cells were drawn with. TextMetrics'
    // `alphabeticBaseline` is the signed distance from the 'middle' anchor to
    // the alphabetic baseline (negative = below the anchor in canvas terms),
    // so the baseline's normalized y-up cell coordinate is
    // (CELL/2 + alphabeticBaseline) / CELL (~0.26 for JetBrains Mono 56/64).
    // Fallback for engines without the field: the measured ink bottom of 'X'
    // (a guaranteed NON_UNIT_GLYPHS cap whose ink stands exactly on the
    // baseline) — same number by construction.
    const metrics = ctx.measureText('X');
    const alphabetic = metrics.alphabeticBaseline;
    const baselineY = Number.isFinite(alphabetic)
      ? (CELL_PX / 2 + alphabetic) / CELL_PX
      : (inkByGlyph.get('X') ?? FULL_GLYPH_INK).y0;

    // §91-pre2 — the descender room, off the ink just measured (the deepest
    // letterform bottom below the baseline + the barrier): the line every
    // letterform stands on now sits this far above the tile.
    const descenderRoom = descenderRoomFor(inkByGlyph.values(), baselineY, DESCENDER_BARRIER_PX / CELL_PX);

    if (import.meta.env.DEV) assertGlyphsCameFromFont(ctx);

    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    // Bilinear filtering keeps glyph edges smooth when sprites render at
    // non-native cell sizes. (The original rationale cited the planned
    // palette-quantization post-pass, dropped at B1 — the filtering choice
    // simply outlived it.)
    texture.magFilter = THREE.LinearFilter;
    texture.minFilter = THREE.LinearFilter;
    texture.generateMipmaps = false;
    texture.needsUpdate = true;

    return new FontAtlas(texture, uvByGlyph, inkByGlyph, baselineY, descenderRoom);
  }

  /**
   * §79a — the glyph's measured RAW ink bbox (normalized, y-up — see
   * `GlyphInk`), or `FULL_GLYPH_INK` for a glyph the atlas hasn't measured.
   * Fallback rather than throw (unlike `getGlyphUV`): a missing ink rect
   * degrades to the full quad, not a crash. Anchoring/lift math reads THIS;
   * clickboxes read `getPaddedGlyphInk`.
   */
  getGlyphInk(glyph: string): GlyphInk {
    return this.inkByGlyph.get(glyph) ?? FULL_GLYPH_INK;
  }

  /** §79d2 — the ink bbox widened by `INK_PAD_PX` for click feel (the 79a
   *  rider), for PICK candidates only. */
  getPaddedGlyphInk(glyph: string): GlyphInk {
    return padInk(this.getGlyphInk(glyph), INK_PAD_PX / CELL_PX);
  }

  /**
   * §79d2 → §91-pre2 — the quad-local anchor y a BASE-anchored sprite of
   * `glyph` stands on: for letterforms the point `descenderRoom` below the
   * font baseline (the terminal-cell rule — the baseline floats above the
   * tile by exactly the room a descender needs), the quad bottom for
   * floor-touching blocks (and for unmeasured glyphs, via the
   * `FULL_GLYPH_INK` fallback). The rule itself is the pure `baseAnchorYFor`
   * (glyphs.ts, headless-tested); this just feeds it the measured data.
   * SpriteRenderer derives every base sprite's anchor through here —
   * including on a glyph swap.
   */
  baseAnchorY(glyph: string): number {
    return baseAnchorYFor(this.getGlyphInk(glyph), this.baselineY, this.descenderRoom);
  }

  /** §79d2 — camera-up lift (world units at size 1; callers scale by
   *  footprint) from a base-anchored sprite's ANCHOR to its ink's visual
   *  CENTER. What "at the unit" means for FX endpoints and sparkles. */
  inkCenterLift(glyph: string): number {
    const ink = this.getGlyphInk(glyph);
    return (ink.y0 + ink.y1) / 2 - 0.5 - this.baseAnchorY(glyph);
  }

  /** §79d2 — camera-up lift from a base-anchored sprite's ANCHOR to its ink's
   *  visual TOP. Where a hitsplat floats: just above the visible glyph, not
   *  above the (taller) empty quad. */
  inkTopLift(glyph: string): number {
    const ink = this.getGlyphInk(glyph);
    return ink.y1 - 0.5 - this.baseAnchorY(glyph);
  }

  /** §91-pre2b — camera-up lift from a base-anchored sprite's ANCHOR to its
   *  ink's visual BOTTOM: under the terminal-cell rule a letterform's ink
   *  floats `descenderRoom` (+ any overshoot) above its stand line, so a
   *  sprite that must stand its INK a fixed gap above a point (the objective
   *  markers) subtracts this from the gap. 0 for the floor family. */
  inkBottomLift(glyph: string): number {
    const ink = this.getGlyphInk(glyph);
    return ink.y0 - 0.5 - this.baseAnchorY(glyph);
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
