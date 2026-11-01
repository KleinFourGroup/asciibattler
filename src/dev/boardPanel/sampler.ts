/**
 * The glyph sampler: candidate glyphs drawn on the real board and in page
 * text, for a taste read of a glyph before any unit wears it. Dev only, in
 * the board explorer (`?bp=…_pose-sampler`).
 *
 * The candidates ride their own URL pair, not the `bp` bookmark, whose codec
 * keeps to `-`, `_`, `.` and alphanumerics:
 *
 *   glyphs=w,W;r,U+E000;n:#,U+2663     rows by `;`, glyphs by `,`
 *   glyphFace=/scratch/trial.otf       a face to draw them from (optional)
 *
 * A glyph is one character, or `U+` and its hex code point (a Private Use
 * Area glyph can't be typed). A row is drawn twice on the board, on the
 * enemy's side and then the player's, unless it starts `n:`, scenery, drawn
 * once in stone with no bar. Put a candidate beside the shipped glyphs it
 * could be taken for in its row.
 *
 * The candidates join the atlas past the catalog's glyphs (`FontAtlas.create`'s
 * extras), on this page only: the shipped `GLYPHS` never holds them. The
 * stack they are drawn with is the shipped faces', then the loaded face; the
 * page's `--font-mono` takes the face the same way, so page text draws them
 * too. A glyph the shipped drawn face carries, `U+E000` say, needs no loaded
 * face. A candidate neither a shipped face nor the loaded one carries is
 * refused by name, as is one past the atlas's room: coverage is read from
 * the vendored faces' own character maps and the drawn face's composition
 * table, by the rule tests/font-coverage.test.ts holds (`faceShips`), since
 * a code point no face has draws the same missing-glyph box whatever the
 * fallback, and a test that compares fallbacks passes it. So the loaded face
 * is a TTF or an OTF, whose map can be read.
 *
 * Parsing is pure and headless-tested (sampler.test.ts); loading and the
 * page-text rows need the DOM.
 */

import { GLYPHS, ATLAS_CELL_BUDGET } from '../../render/glyphs';
import { FACES, FONT_STACK, faceShips } from '../../render/fontSubset';
import type { AtlasExtras } from '../../render/FontAtlas';
import { ttfCmapLookup } from '../../../tools/font/ttfCmap';
import { parseGlyphTable } from '../../../tools/font/glyphTable';

export const SAMPLER_GLYPHS_PARAM = 'glyphs';
export const SAMPLER_FACE_PARAM = 'glyphFace';
/** The family a sampler face is registered under. */
export const SAMPLER_FAMILY = 'ASCIIbattler Sampler';

export interface SamplerRow {
  readonly scenery: boolean;
  readonly glyphs: readonly string[];
}

export interface SamplerSpec {
  readonly rows: readonly SamplerRow[];
  /** The face's URL, or null for the shipped faces alone. */
  readonly face: string | null;
  /** Tokens that are not one character or a `U+` code point, as written. */
  readonly badTokens: readonly string[];
}

/** One token as a glyph: a single code point, or `U+XXXX`. */
function glyphOf(token: string): string | null {
  const hex = /^U\+([0-9A-Fa-f]{4,6})$/.exec(token);
  if (hex) {
    const cp = parseInt(hex[1]!, 16);
    return cp <= 0x10ffff ? String.fromCodePoint(cp) : null;
  }
  return [...token].length === 1 ? token : null;
}

/** A pair's value from a raw query, percent-decoded with `+` kept: a
 *  `URLSearchParams` reads `+` as a space, which would turn `U+E000` into
 *  `U E000`. Null when absent or undecodable. */
function rawParam(search: string, key: string): string | null {
  for (const pair of (search.startsWith('?') ? search.slice(1) : search).split('&')) {
    const cut = pair.indexOf('=');
    if (cut < 0 || pair.slice(0, cut) !== key) continue;
    try {
      return decodeURIComponent(pair.slice(cut + 1));
    } catch {
      return null;
    }
  }
  return null;
}

/** The sampler's rows from a raw `location.search`, or null with no `glyphs=`. */
export function parseSampler(search: string): SamplerSpec | null {
  const raw = rawParam(search, SAMPLER_GLYPHS_PARAM);
  if (raw === null || raw.trim() === '') return null;
  const rows: SamplerRow[] = [];
  const badTokens: string[] = [];
  for (const part of raw.split(';')) {
    const scenery = part.startsWith('n:');
    const glyphs: string[] = [];
    for (const token of (scenery ? part.slice(2) : part).split(',')) {
      const t = token.trim();
      if (t === '') continue;
      const glyph = glyphOf(t);
      if (glyph === null) badTokens.push(t);
      else glyphs.push(glyph);
    }
    if (glyphs.length > 0) rows.push({ scenery, glyphs });
  }
  const face = rawParam(search, SAMPLER_FACE_PARAM);
  return { rows, face: face === null || face.trim() === '' ? null : face.trim(), badTokens };
}

/** `U+XXXX` for a glyph, as the refusals name it. */
export function codePointName(glyph: string): string {
  return `U+${glyph.codePointAt(0)!.toString(16).toUpperCase().padStart(4, '0')}`;
}

/** The candidates the atlas must add: every distinct row glyph the catalog's
 *  set lacks, in row order, and those past the atlas's room. Pure. */
export function samplerNewGlyphs(
  spec: SamplerSpec,
  registered: readonly string[] = GLYPHS,
  budget: number = ATLAS_CELL_BUDGET,
): { add: string[]; overRoom: string[] } {
  const known = new Set(registered);
  const add: string[] = [];
  const overRoom: string[] = [];
  for (const row of spec.rows) {
    for (const glyph of row.glyphs) {
      if (known.has(glyph)) continue;
      known.add(glyph);
      if (registered.length + add.length < budget) add.push(glyph);
      else overRoom.push(glyph);
    }
  }
  return { add, overRoom };
}

async function fetchBytes(url: string): Promise<Uint8Array<ArrayBuffer>> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${url}: ${res.status} ${res.statusText}`);
  return new Uint8Array(await res.arrayBuffer());
}

/** Whether the shipped faces carry a code point, as
 *  tests/font-coverage.test.ts reads "shipped": a vendored face by its
 *  source's map inside `SUBSET_RANGES`, the drawn face by its table. */
async function shippedLookup(): Promise<(codePoint: number) => boolean> {
  const faces = await Promise.all(
    FACES.map(async (face) => {
      const bytes = await fetchBytes(`/assets/fonts/${face.dir}/${face.source}`);
      let has: (cp: number) => boolean;
      if (face.role === 'drawn') {
        const drawn = new Set(
          parseGlyphTable(JSON.parse(new TextDecoder().decode(bytes))).map((r) => r.codePoint),
        );
        has = (cp) => drawn.has(cp);
      } else {
        has = ttfCmapLookup(bytes);
      }
      return (cp: number): boolean => faceShips(face, has, cp);
    }),
  );
  return (cp) => faces.some((ships) => ships(cp));
}

/** What the page's sampler loaded: the atlas's extras, and what it refused. */
export interface SamplerLoad {
  readonly spec: SamplerSpec;
  readonly extras: AtlasExtras;
  /** One line per refusal, naming the glyph and why. */
  readonly refused: readonly string[];
}

/**
 * Before the atlas: load the face, if any, put it after the shipped faces in
 * the page's `--font-mono`, and work out the extras. Null with no `glyphs=`.
 */
export async function loadSampler(search: string): Promise<SamplerLoad | null> {
  const spec = parseSampler(search);
  if (spec === null) return null;
  const refused = spec.badTokens.map((t) => `'${t}': not one character or U+ code point`);
  let stack = FONT_STACK;
  let faceHas: (codePoint: number) => boolean = () => false;
  if (spec.face !== null) {
    try {
      const bytes = await fetchBytes(spec.face);
      faceHas = ttfCmapLookup(bytes);
      const face = new FontFace(SAMPLER_FAMILY, bytes);
      await face.load();
      document.fonts.add(face);
      stack = `${FONT_STACK}, '${SAMPLER_FAMILY}'`;
      const root = document.documentElement;
      const pageStack = getComputedStyle(root).getPropertyValue('--font-mono').trim();
      root.style.setProperty(
        '--font-mono',
        pageStack.includes(FONT_STACK)
          ? pageStack.replace(FONT_STACK, stack)
          : `${stack}, monospace`,
      );
    } catch (err) {
      faceHas = () => false;
      refused.push(
        `face ${spec.face} failed to load (${String(err)}): drawing from the shipped faces alone`,
      );
    }
  }
  const { add, overRoom } = samplerNewGlyphs(spec);
  for (const g of overRoom)
    refused.push(`'${g}' ${codePointName(g)}: past the atlas's ${ATLAS_CELL_BUDGET} cells`);
  const shippedHas = await shippedLookup();
  const lacking = new Set(
    add.filter((g) => !shippedHas(g.codePointAt(0)!) && !faceHas(g.codePointAt(0)!)),
  );
  for (const g of lacking)
    refused.push(`'${g}' ${codePointName(g)}: neither a shipped face nor a sampler face has it`);
  const glyphs = add.filter((g) => !lacking.has(g));
  await document.fonts.load(`56px ${stack}`);
  if (refused.length > 0)
    console.warn(`[board-panel] glyph sampler refused:\n${refused.join('\n')}`);
  return { spec, extras: { glyphs, stack }, refused };
}

/**
 * The page-text strip: a column per row, its glyphs as a unit card shows a
 * glyph (48 px, bold, the player's green), as the battle HUD's compact enemy
 * card does (34 px, red), then as a fallen strip's runs (bold, at body size,
 * `g×2`), with the production classes and colour tokens. Fixed along the
 * page's bottom, over the HUD's cards and clear of the explorer's panel; the
 * `glyphText` dial hides it. Under the `sampler` pose the parked countdown's
 * plate is hidden too (`html.bp-sampler`), so the middle rows show.
 */
export function mountSamplerText(
  load: SamplerLoad,
  drawable: (glyph: string) => boolean,
): HTMLElement {
  const root = document.createElement('div');
  root.className = 'board-panel-sampler';
  root.style.cssText =
    'position:fixed;left:8px;bottom:8px;max-width:calc(100% - 340px);z-index:50;pointer-events:none;' +
    'display:flex;flex-wrap:wrap;gap:6px 22px;padding:6px 10px;background:rgba(0,0,0,0.85);' +
    'border:1px solid var(--color-gray-66);font-family:var(--font-mono);';
  const line = (column: HTMLElement): HTMLElement => {
    const el = document.createElement('div');
    el.style.cssText = 'display:flex;align-items:baseline;gap:10px;white-space:nowrap;';
    column.appendChild(el);
    return el;
  };
  const glyphSpan = (g: string, style = ''): HTMLElement => {
    const el = document.createElement('span');
    el.className = 'unit-card__glyph';
    el.style.cssText = style;
    el.textContent = g;
    return el;
  };
  for (const row of load.spec.rows) {
    const glyphs = row.glyphs.filter(drawable);
    if (glyphs.length === 0) continue;
    const column = document.createElement('div');
    const cards = line(column);
    for (const g of glyphs) cards.appendChild(glyphSpan(g));
    const compact = line(column);
    for (const g of glyphs) compact.appendChild(glyphSpan(g, 'font-size:var(--text-34);color:var(--color-neon-red);'));
    for (const side of ['player', 'enemy'] as const) {
      const strip = document.createElement('span');
      strip.className = `fallen-side fallen-side--${side}`;
      const run = document.createElement('span');
      run.className = 'fallen-glyphs';
      run.textContent = glyphs.map((g, i) => `${g}×${i + 1}`).join(' ');
      strip.appendChild(run);
      line(column).appendChild(strip);
    }
    root.appendChild(column);
  }
  document.body.appendChild(root);
  return root;
}

/** Hides the parked countdown's plate while the `sampler` pose is up. */
export function setSamplerPose(on: boolean): void {
  if (!document.getElementById('bp-sampler-style')) {
    const style = document.createElement('style');
    style.id = 'bp-sampler-style';
    style.textContent = 'html.bp-sampler .battle-countdown { visibility: hidden; }';
    document.head.appendChild(style);
  }
  document.documentElement.classList.toggle('bp-sampler', on);
}
