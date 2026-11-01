/**
 * The build of our glyph face, "ASCIIbattler Glyphs": drawn glyphs in the
 * Private Use Area, each a JetBrains Mono letter with radicals (marks drawn
 * as SVG, radicalSvg.ts) added to it, or radicals alone.
 *
 * The sources are in assets/fonts/asciibattler-glyphs/: `glyphs.json`, one row
 * per glyph (its code point, its letter, its radicals, its width; read by
 * glyphTable.ts), and `radicals/<name>.svg`. `npm run gen:font` composes
 * them into the woff2 that ships (scripts/build-font.mjs);
 * tests/glyph-face.test.ts rebuilds the face from the sources and holds the
 * committed woff2 to it.
 *
 * A glyph's letter is copied from JetBrains Mono's own outline and centred
 * in the glyph's width, so the face is a Modified Version of JetBrains Mono
 * under the SIL Open Font License, shipped with that licence and JetBrains
 * Mono's copyright line under a family name of its own. Its vertical metrics
 * are JetBrains Mono's in all three tables, so a line holding one of its
 * glyphs is as tall as a line without.
 *
 * Pure and free of node, so the dev radical sheet composes in the browser
 * from the same sources.
 */

import { Font, Glyph, Path, parse } from 'opentype.js';
import { PRIMARY_EXCLUDES } from '../../src/render/fontSubset';
import { parseRadicalSvg, RadicalError, type RadicalOutline } from './radicalSvg';
import { codePointLabel, parseGlyphTable, type GlyphRow } from './glyphTable';

export const GLYPH_FACE_FAMILY = 'ASCIIbattler Glyphs';

export interface GlyphFaceSources {
  /** JetBrains Mono's vendored TTF. */
  readonly primary: Uint8Array;
  /** glyphs.json, parsed. */
  readonly table: unknown;
  /** Each radical's SVG text, by file name without `.svg`. */
  readonly radicals: ReadonlyMap<string, string>;
}

/** The licence lines the face carries in its name table, as its OFL.txt
 *  opens. */
const COPYRIGHT =
  'Copyright 2020 The JetBrains Mono Project Authors (https://github.com/JetBrains/JetBrainsMono). ' +
  'The radicals, and the glyphs composed from them: copyright 2026 Matthew Kilgore.';
const LICENSE =
  'This Font Software is licensed under the SIL Open Font License, Version 1.1. ' +
  'It is a Modified Version of JetBrains Mono.';

/** A fixed creation date, 2026-10-31, so a rebuild is byte-identical. */
const CREATED = Date.UTC(2026, 9, 31) / 1000;

function bufferOf(bytes: Uint8Array): ArrayBuffer {
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
}

/**
 * Composes the face from its sources. Throws, naming the row or the file,
 * on a letter JetBrains Mono lacks, a radical file missing, a radical drawn
 * for another width, or a source the radical format refuses.
 */
export function composeGlyphFace(sources: GlyphFaceSources): { font: Font; rows: GlyphRow[] } {
  const rows = parseGlyphTable(sources.table);
  const primary = parse(bufferOf(sources.primary));
  const outlines = new Map<string, RadicalOutline>();
  const radical = (name: string): RadicalOutline => {
    let outline = outlines.get(name);
    if (outline === undefined) {
      const svg = sources.radicals.get(name);
      if (svg === undefined) throw new RadicalError(`radicals/${name}.svg`, 'no such file');
      outline = parseRadicalSvg(svg, `radicals/${name}.svg`);
      outlines.set(name, outline);
    }
    return outline;
  };

  const glyphs = [new Glyph({ name: '.notdef', advanceWidth: 600, path: new Path() })];
  for (const row of rows) {
    const where = `glyphs.json ${codePointLabel(row.codePoint)} ${row.name}`;
    const path = new Path();
    if (row.letter !== null) {
      const cp = row.letter.codePointAt(0)!;
      if (primary.charToGlyphIndex(row.letter) === 0 || PRIMARY_EXCLUDES.includes(cp))
        throw new Error(`${where}: JetBrains Mono has no letter '${row.letter}'`);
      const letter = primary.charToGlyph(row.letter);
      const dx = (row.width - (letter.advanceWidth ?? 600)) / 2;
      for (const c of letter.path.commands) {
        const m = { ...c } as Record<string, unknown>;
        for (const k of ['x', 'x1', 'x2'])
          if (typeof m[k] === 'number') m[k] = (m[k] as number) + dx;
        path.commands.push(m as unknown as (typeof path.commands)[number]);
      }
    }
    for (const name of row.radicals) {
      const outline = radical(name);
      if (outline.width !== row.width)
        throw new Error(
          `${where}: radicals/${name}.svg is drawn for a width of ${outline.width}, the glyph is ${row.width} wide`,
        );
      for (const contour of outline.contours) {
        contour.forEach(([x, y], i) => (i === 0 ? path.moveTo(x, y) : path.lineTo(x, y)));
        path.close();
      }
    }
    glyphs.push(
      new Glyph({ name: row.name, unicode: row.codePoint, advanceWidth: row.width, path }),
    );
  }

  // The primary's weight and width classes, and its line in the Windows
  // table too (opentype.js would write the glyphs' bounding box there) with
  // its USE_TYPO_METRICS bit, so every platform reads one line from both.
  const os2 = primary.tables.os2 as Record<string, number>;
  const font = new Font({
    familyName: GLYPH_FACE_FAMILY,
    styleName: 'Regular',
    unitsPerEm: primary.unitsPerEm,
    ascender: primary.ascender,
    descender: primary.descender,
    copyright: COPYRIGHT,
    license: LICENSE,
    licenseURL: 'https://openfontlicense.org',
    manufacturer: 'ASCIIbattler',
    designer: 'ASCIIbattler (radicals); The JetBrains Mono Project Authors (letters)',
    version: '1.000',
    createdTimestamp: CREATED,
    tables: {
      os2: {
        usWeightClass: os2.usWeightClass,
        usWidthClass: os2.usWidthClass,
        fsSelection: os2.fsSelection,
        usWinAscent: os2.usWinAscent,
        usWinDescent: os2.usWinDescent,
      },
    },
    glyphs,
  } as ConstructorParameters<typeof Font>[0]);
  return { font, rows };
}

const u32 = (dv: DataView, off: number): number => dv.getUint32(off);

function tableSum(dv: DataView, off: number, length: number): number {
  let sum = 0;
  const padded = (length + 3) & ~3;
  for (let i = 0; i < padded; i += 4) {
    const word = off + i + 4 <= dv.byteLength ? u32(dv, off + i) : 0;
    sum = (sum + word) >>> 0;
  }
  return sum;
}

/**
 * The face as OpenType bytes, made deterministic: opentype.js stamps the
 * `head` table's modified date with the clock, so it is set to the created
 * date and the checksums are recomputed. A rebuild from the same sources is
 * then byte-identical, and so is its woff2.
 */
export function glyphFaceBytes(font: Font): Uint8Array<ArrayBuffer> {
  const bytes = new Uint8Array(font.toArrayBuffer());
  const dv = new DataView(bytes.buffer);
  const numTables = dv.getUint16(4);
  let headRec = -1;
  for (let i = 0; i < numTables; i++) {
    const rec = 12 + i * 16;
    if (String.fromCharCode(...bytes.subarray(rec, rec + 4)) === 'head') headRec = rec;
  }
  if (headRec < 0) throw new Error('glyphFaceBytes: no head table');
  const head = u32(dv, headRec + 8);
  const length = u32(dv, headRec + 12);
  bytes.copyWithin(head + 28, head + 20, head + 28); // modified (at 28) = created (at 20)
  dv.setUint32(head + 8, 0); // checkSumAdjustment, summed as zero
  dv.setUint32(headRec + 4, tableSum(dv, head, length));
  dv.setUint32(head + 8, (0xb1b0afba - tableSum(dv, 0, bytes.length)) >>> 0);
  return bytes;
}
