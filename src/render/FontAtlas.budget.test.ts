import { describe, it, expect, vi } from 'vitest';

/**
 * `FontAtlas.create`'s budget throw at the grid's size: the build's own guard,
 * apart from the headless test of the real set (FontAtlas.test.ts), since
 * `GLYPHS` is mocked here to a set one past the budget and one at it. The
 * throw comes before any font or canvas work, so it runs without a DOM; a set
 * that fits goes on to the font load, which fails here for want of a
 * `document`, under its own message.
 */
const set = vi.hoisted(() => ({ size: 0 }));

vi.mock('./glyphs', async (importOriginal) => {
  const real = await importOriginal<typeof import('./glyphs')>();
  return {
    ...real,
    get GLYPHS(): readonly string[] {
      return Array.from({ length: set.size }, (_, i) => String.fromCodePoint(0x4e00 + i));
    },
  };
});

const { FontAtlas } = await import('./FontAtlas');
const { ATLAS_CELL_BUDGET } = await import('./glyphs');

describe("FontAtlas.create's budget guard", () => {
  it('throws on one glyph past the 128-cell grid', async () => {
    set.size = ATLAS_CELL_BUDGET + 1;
    await expect(FontAtlas.create()).rejects.toThrow('129 glyphs exceed the 128-cell atlas grid (16 × 8)');
  });

  it('lets a full grid past the guard', async () => {
    set.size = ATLAS_CELL_BUDGET;
    await expect(FontAtlas.create()).rejects.toThrow("the game's font files failed to load");
  });
});
