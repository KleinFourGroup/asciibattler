import { describe, expect, it } from 'vitest';
import { parse } from 'opentype.js';
import {
  composeGlyphFace,
  glyphFaceBytes,
  GLYPH_FACE_FAMILY,
  type GlyphFaceSources,
} from '../tools/font/glyphFace';
import { parseGlyphTable } from '../tools/font/glyphTable';
import { parseRadicalSvg, GLYPH_BASELINE } from '../tools/font/radicalSvg';
import { DRAWN_FACE, drawnFaceSources, sfntTables, shippedDrawnFace } from './glyphFaceFiles';

// Our drawn face, ASCIIbattler Glyphs: its radicals' SVG format, the build's
// refusals, and the pin that the committed woff2 is the face its sources
// build, so a source edited without `npm run gen:font` fails here instead of
// shipping a face that no longer matches it.

const svg = (body: string, width = 900): string =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} 1320">${body}</svg>`;
const TRIANGLE = '<path d="M 100 520 L 300 520 L 200 240 Z"/>';

/** Signed area of a contour, y up: negative is clockwise. */
const area = (c: readonly (readonly [number, number])[]): number =>
  c.reduce((a, [x0, y0], i) => {
    const [x1, y1] = c[(i + 1) % c.length]!;
    return a + x0 * y1 - x1 * y0;
  }, 0) / 2;

describe('a radical SVG', () => {
  it('reads a straight-segment mark in font units, y up from the baseline', () => {
    const r = parseRadicalSvg(svg(TRIANGLE), 't.svg');
    expect(r.width).toBe(900);
    expect(r.contours).toHaveLength(1);
    const ys = r.contours[0]!.map(([, y]) => y).sort((a, b) => a - b);
    // svg y 520 and 240 are 500 and 780 above the baseline at 1020.
    expect(ys).toEqual([GLYPH_BASELINE - 520, GLYPH_BASELINE - 520, GLYPH_BASELINE - 240]);
    expect(area(r.contours[0]!)).toBeLessThan(0);
  });

  it('reads relative commands, H and V, and polygons', () => {
    const rel = parseRadicalSvg(svg('<path d="m100 520 h200 v-100 H100 z"/>'), 't.svg');
    const poly = parseRadicalSvg(
      svg('<polygon points="100,520 300,520 300,420 100,420"/>'),
      't.svg',
    );
    const sorted = (c: readonly (readonly [number, number])[]) =>
      [...c].map((p) => p.join()).sort();
    expect(sorted(rel.contours[0]!)).toEqual(sorted(poly.contours[0]!));
  });

  it("ignores the guide group, comments and an editor's own elements", () => {
    const r = parseRadicalSvg(
      svg(
        '<!-- a note --><sodipodi:namedview id="v"><inkscape:page/></sodipodi:namedview>' +
          '<g id="guide" fill="none" stroke="#555"><line x1="0" x2="900" y1="1020" y2="1020"/>' +
          '<text>r</text><circle r="4"/></g>' +
          TRIANGLE,
      ),
      't.svg',
    );
    expect(r.contours).toHaveLength(1);
  });

  it('winds a hole against its outline, and outer contours clockwise whichever way drawn', () => {
    // An outer square drawn counter-clockwise on screen, a hole drawn the same way.
    const r = parseRadicalSvg(
      svg(
        '<path d="M 100 600 L 400 600 L 400 300 L 100 300 Z M 200 500 L 300 500 L 300 400 L 200 400 Z"/>',
      ),
      't.svg',
    );
    expect(area(r.contours[0]!)).toBeLessThan(0);
    expect(area(r.contours[1]!)).toBeGreaterThan(0);
  });

  it.each([
    ['a curve', '<path d="M 100 520 C 150 400 250 400 300 520 Z"/>', /'C' is a curve/],
    ['an arc', '<path d="M 100 520 A 50 50 0 0 1 300 520 Z"/>', /'A' is a curve/],
    ['a quadratic', '<path d="M 100 520 Q 200 300 300 520 Z"/>', /'Q' is a curve/],
    ['a circle', '<circle cx="100" cy="100" r="40"/>', /<circle> is not allowed/],
    ['a rect', '<rect x="0" y="0" width="10" height="10"/>', /<rect> is not allowed/],
    [
      'a transform',
      '<path transform="translate(5 0)" d="M 100 520 L 300 520 L 200 240 Z"/>',
      /transform/,
    ],
    ['a transformed group', '<g transform="scale(2)">' + TRIANGLE + '</g>', /transform/],
    ['a stroke', '<path stroke="#000" d="M 100 520 L 300 520 L 200 240 Z"/>', /stroke/],
    [
      'a styled stroke',
      '<path style="fill:#000;stroke:#111" d="M 100 520 L 300 520 L 200 240 Z"/>',
      /stroke/,
    ],
    ['no fill', '<path fill="none" d="M 100 520 L 300 520 L 200 240 Z"/>', /fill="none"/],
    [
      'an even-odd fill',
      '<path fill-rule="evenodd" d="M 100 520 L 300 520 L 200 240 Z"/>',
      /even-odd/,
    ],
    ['an open subpath', '<path d="M 100 520 L 300 520 L 200 240"/>', /open subpath/],
    [
      'crossing contours',
      '<path d="M 100 500 L 300 500 L 300 400 L 100 400 Z M 200 550 L 250 550 L 250 300 L 200 300 Z"/>',
      /cross/,
    ],
    [
      'a self-crossing contour',
      '<path d="M 100 500 L 400 200 L 400 500 L 100 300 Z"/>',
      /crosses itself/,
    ],
    ['ink outside the box', '<path d="M 100 520 L 950 520 L 200 240 Z"/>', /leaves the glyph box/],
    ['no area', '<path d="M 100 520 L 300 520 L 500 520 Z"/>', /no area/],
    ['nothing drawn', '', /draws nothing/],
  ])('refuses %s, naming the file', (_what, body, reason) => {
    expect(() => parseRadicalSvg(svg(body), 'radicals/x.svg')).toThrow(reason);
    expect(() => parseRadicalSvg(svg(body), 'radicals/x.svg')).toThrow(/^radicals\/x\.svg: /);
  });

  it('refuses a box that is not the glyph box', () => {
    const bad =
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 900 1000">' + TRIANGLE + '</svg>';
    expect(() => parseRadicalSvg(bad, 'x.svg')).toThrow(/viewBox must be "0 0 <width> 1320"/);
  });
});

describe('the composition table and the build', () => {
  const sources = drawnFaceSources();
  const withTable = (glyphs: unknown[]): GlyphFaceSources => ({ ...sources, table: { glyphs } });
  const row = { codePoint: 'U+E0F0', name: 't.row', letter: 'r', radicals: ['ears'], width: 900 };

  it('reads the committed table', () => {
    const rows = parseGlyphTable(sources.table);
    expect(rows.length).toBeGreaterThan(0);
    expect(rows[0]).toMatchObject({ codePoint: 0xe000, letter: 'r', width: 900 });
  });

  it.each([
    [
      'a code point outside the Private Use Area',
      [{ ...row, codePoint: 'U+0041' }],
      /outside the Private Use Area/,
    ],
    ['a code point twice', [row, { ...row, name: 't.other' }], /listed twice/],
    ['a name twice', [row, { ...row, codePoint: 'U+E0F1' }], /listed twice/],
    ['a row that draws nothing', [{ ...row, letter: undefined, radicals: [] }], /draws nothing/],
    ['a letter JetBrains Mono lacks', [{ ...row, letter: 'ก' }], /JetBrains Mono has no letter/],
    [
      'a radical with no file',
      [{ ...row, radicals: ['no-such'] }],
      /radicals\/no-such\.svg: no such file/,
    ],
    [
      'a radical drawn for another width',
      [{ ...row, width: 600 }],
      /drawn for a width of 900, the glyph is 600 wide/,
    ],
    ['an unknown key', [{ ...row, colour: 'red' }], /Unrecognized key/],
  ])('refuses %s', (_what, glyphs, reason) => {
    expect(() => composeGlyphFace(withTable(glyphs))).toThrow(reason);
  });

  it('centres the letter in the glyph, under its own family and the primary line', () => {
    const { font } = composeGlyphFace(withTable([row]));
    const face = parse(glyphFaceBytes(font).buffer);
    expect(face.names.fontFamily?.en).toBe(GLYPH_FACE_FAMILY);
    expect(face.names.copyright?.en).toContain('The JetBrains Mono Project Authors');
    expect(face.names.license?.en).toContain('SIL Open Font License, Version 1.1');
    const g = face.charToGlyph('');
    expect(g.advanceWidth).toBe(900);
    // JetBrains Mono's r stem starts at 112 in its 600 cell; centred in 900, at 262.
    const xs = g.path.commands.flatMap((c) => ('x' in c ? [c.x] : []));
    expect(xs).toContain(262);
  });

  it('builds byte-identically twice', () => {
    const a = glyphFaceBytes(composeGlyphFace(sources).font);
    const b = glyphFaceBytes(composeGlyphFace(sources).font);
    expect(Buffer.compare(Buffer.from(a), Buffer.from(b))).toBe(0);
  });
});

/** The tables, with what a woff2's round trip changes masked: the encoder
 *  sets `head`'s flag bit 11 (the font was compressed losslessly) and the
 *  decoder recomputes the whole-font checksum, `head`'s checkSumAdjustment. */
function comparable(bytes: Uint8Array): Map<string, string> {
  const out = new Map<string, string>();
  for (const [tag, data] of sfntTables(bytes)) {
    const copy = Uint8Array.from(data);
    if (tag === 'head') {
      copy.fill(0, 8, 12);
      copy[16] = copy[16]! & ~0x08;
    }
    out.set(tag, Buffer.from(copy).toString('hex'));
  }
  return out;
}

describe('the shipped woff2 is the face its sources build', () => {
  it(`${DRAWN_FACE.out} holds the face composed from glyphs.json and radicals/`, async () => {
    const built = comparable(glyphFaceBytes(composeGlyphFace(drawnFaceSources()).font));
    const shipped = comparable(await shippedDrawnFace());
    expect([...shipped.keys()].sort(), 'the tables').toEqual([...built.keys()].sort());
    const stale = [...built.keys()].filter((tag) => built.get(tag) !== shipped.get(tag));
    expect(stale, "run `npm run gen:font` after changing the drawn face's sources").toEqual([]);
  });

  it('the control: a source changed after the build differs, table by table', async () => {
    const sources = drawnFaceSources();
    const shipped = comparable(await shippedDrawnFace());
    const moved = sources.radicals.get('ears')!.replace('M 15 520', 'M 16 520');
    expect(moved).not.toBe(sources.radicals.get('ears'));
    const rebuilt = comparable(
      glyphFaceBytes(
        composeGlyphFace({ ...sources, radicals: new Map([...sources.radicals, ['ears', moved]]) })
          .font,
      ),
    );
    expect([...rebuilt.keys()].filter((tag) => rebuilt.get(tag) !== shipped.get(tag))).toContain(
      'CFF ',
    );
  });
});

// The atlas draws a glyph at 56 px, centred on its advance, in a 64-px cell
// that clips it. Measured in Chrome from the atlas's ink (the drawn r with
// ears: ink from 17 px to 61 px above the cell's bottom, its baseline at 17
// and its ears' tips at 780 units), the baseline sits 304 units above the
// cell's bottom and 839 below its top, and the cell holds 571 units either
// side of the advance's centre. Firefox's canvas places the `middle`
// baseline by its own rule and is unmeasured.
const ATLAS_ROOM = { below: 304, above: 839, half: 571 };

/** The glyphs whose ink leaves the atlas cell's room, by code point. */
function outsideRoom(bytes: Uint8Array): string[] {
  const face = parse(Uint8Array.from(bytes).buffer);
  const out: string[] = [];
  for (let i = 1; i < face.glyphs.length; i++) {
    const g = face.glyphs.get(i);
    const box = g.getBoundingBox();
    const centre = (g.advanceWidth ?? 0) / 2;
    if (
      box.y1 < -ATLAS_ROOM.below ||
      box.y2 > ATLAS_ROOM.above ||
      box.x1 < centre - ATLAS_ROOM.half ||
      box.x2 > centre + ATLAS_ROOM.half
    )
      out.push(`U+${(g.unicode ?? 0).toString(16).toUpperCase()} ${g.name}`);
  }
  return out;
}

describe("the atlas cell's room", () => {
  it('holds the ink of every glyph the shipped face draws', async () => {
    expect(outsideRoom(await shippedDrawnFace()), 'the atlas would clip these').toEqual([]);
  });

  it("the control: an ear drawn past the cell's top is caught", () => {
    const sources = drawnFaceSources();
    const tall = sources.radicals
      .get('ears')!
      .replace('M 15 520 L 195 520 L 55 240 Z', 'M 15 520 L 195 520 L 55 170 Z');
    expect(tall).not.toBe(sources.radicals.get('ears'));
    const face = composeGlyphFace({
      ...sources,
      radicals: new Map([...sources.radicals, ['ears', tall]]),
    }).font;
    // Every glyph that carries the ears, and no other.
    const eared = parseGlyphTable(sources.table)
      .filter((r) => r.radicals.includes('ears'))
      .map((r) => `U+${r.codePoint.toString(16).toUpperCase()} ${r.name}`);
    expect(eared).toContain('U+E000 r.ears');
    expect(outsideRoom(glyphFaceBytes(face))).toEqual(eared);
  });
});
