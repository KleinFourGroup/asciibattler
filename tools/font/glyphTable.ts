/**
 * The drawn face's composition table, assets/fonts/asciibattler-glyphs/
 * glyphs.json: one row per glyph, its code point, its letter, its radicals
 * and its width. The face's build reads it (glyphFace.ts), and so does the
 * glyph sampler, to know which code points the shipped face draws; a module
 * of its own, free of the font builder, so the sampler's import graph stays
 * the game's.
 */

import { z } from 'zod';

/** The Private Use Area of the Basic Multilingual Plane, which Unicode
 *  assigns to no character, so a glyph there means only what we draw. */
export const PUA_FIRST = 0xe000;
export const PUA_LAST = 0xf8ff;

const CODE_POINT = /^U\+([0-9A-F]{4})$/;

const GlyphRowSchema = z
  .object({
    codePoint: z.string().regex(CODE_POINT, 'a code point as U+ and four upper-case hex digits'),
    /** A PostScript glyph name: letters, digits, `.` and `_`. */
    name: z
      .string()
      .regex(/^[A-Za-z_][A-Za-z0-9._]{0,62}$/, 'a glyph name of letters, digits, . and _'),
    /** The JetBrains Mono letter the radicals are added to; absent for a
     *  glyph drawn from radicals alone. */
    letter: z.string().optional(),
    radicals: z.array(
      z.string().regex(/^[a-z0-9-]+$/, 'a radical file name, lower-case, without .svg'),
    ),
    /** The advance, in font units; JetBrains Mono's is 600. */
    width: z.number().int().positive(),
  })
  .strict();

export const GlyphTableSchema = z.object({ glyphs: z.array(GlyphRowSchema).min(1) }).strict();

export interface GlyphRow {
  readonly codePoint: number;
  readonly name: string;
  readonly letter: string | null;
  readonly radicals: readonly string[];
  readonly width: number;
}

/** The composition table, checked: each row in the Private Use Area, no
 *  code point or name twice, and something drawn. */
export function parseGlyphTable(json: unknown): GlyphRow[] {
  const table = GlyphTableSchema.parse(json);
  const seenCp = new Set<number>();
  const seenName = new Set<string>();
  return table.glyphs.map((row) => {
    const codePoint = parseInt(CODE_POINT.exec(row.codePoint)![1]!, 16);
    const where = `glyphs.json ${row.codePoint} ${row.name}`;
    if (codePoint < PUA_FIRST || codePoint > PUA_LAST)
      throw new Error(`${where}: outside the Private Use Area (U+E000 to U+F8FF)`);
    if (seenCp.has(codePoint)) throw new Error(`${where}: the code point is listed twice`);
    if (seenName.has(row.name)) throw new Error(`${where}: the name is listed twice`);
    seenCp.add(codePoint);
    seenName.add(row.name);
    if (row.letter !== undefined && [...row.letter].length !== 1)
      throw new Error(`${where}: a letter is one character`);
    if (row.letter === undefined && row.radicals.length === 0)
      throw new Error(`${where}: draws nothing (no letter and no radicals)`);
    return {
      codePoint,
      name: row.name,
      letter: row.letter ?? null,
      radicals: row.radicals,
      width: row.width,
    };
  });
}

/** `U+E000` for a code point, as the table writes it. */
export const codePointLabel = (cp: number): string =>
  `U+${cp.toString(16).toUpperCase().padStart(4, '0')}`;
