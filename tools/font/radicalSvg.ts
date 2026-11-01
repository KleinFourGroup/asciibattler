/**
 * The reader for a radical's SVG source: a mark drawn in place in the glyph
 * box (assets/fonts/asciibattler-glyphs/template.svg), returned as outlines
 * in font units, ready for the face's build (glyphFace.ts) to add to a
 * letter.
 *
 * The format is strict so a file means one thing in an SVG editor and in the
 * font:
 *
 *   - The box is the viewBox, `0 0 <width> 1320`: the glyph's advance wide,
 *     and JetBrains Mono's line tall, the baseline 1020 from the top. A font
 *     unit is a viewBox unit, and y flips: font y = 1020 − svg y.
 *   - Straight segments only. A path may use M, L, H, V and Z (and their
 *     relative forms); a curve or an arc is refused, which keeps the marks
 *     low-res vectors. `<polygon>` is allowed too. Every subpath closes.
 *   - What is drawn is filled, as a font fills it: a stroke, `fill="none"`,
 *     an even-odd fill rule and a `transform` are refused, since each would
 *     look one way in the editor and another in the font. Draw a stroke as an
 *     outline, and flatten transforms into the coordinates.
 *   - Contours may nest but not cross. A contour inside an odd number of
 *     others is a hole; the reader winds each by its nesting, outer
 *     contours clockwise with y up (TrueType's outer direction), so the
 *     mark fills as it looks and unions with the letter's ink. Merge
 *     overlapping shapes into one outline in the editor.
 *   - `<g id="guide">` holds the template's guide lines and is ignored, as are
 *     an editor's own namespaced elements, `<title>`, `<desc>`, `<metadata>`
 *     and `<defs>`. Any other element is refused by name.
 *
 * Pure and free of the DOM and of node, so the build, the tests and the dev
 * radical sheet share it.
 */

/** The box's height, in font units: JetBrains Mono's line, 1020 + 300. */
export const GLYPH_BOX_HEIGHT = 1320;
/** The baseline's distance from the box's top, in font units. */
export const GLYPH_BASELINE = 1020;

/** A closed contour, in font units with y up, its last point joined back to
 *  its first (the first point is not repeated). */
export type Contour = readonly (readonly [x: number, y: number])[];

export interface RadicalOutline {
  /** The box's width: the advance of every glyph that carries this radical. */
  readonly width: number;
  /** Wound by nesting: outer contours clockwise (y up), holes the other way. */
  readonly contours: readonly Contour[];
}

/** A source the format refuses, named by file. */
export class RadicalError extends Error {
  constructor(file: string, reason: string) {
    super(`${file}: ${reason}`);
    this.name = 'RadicalError';
  }
}

interface Tag {
  readonly name: string;
  readonly attrs: ReadonlyMap<string, string>;
  readonly closing: boolean;
  readonly selfClosing: boolean;
}

function tagsOf(svg: string): Tag[] {
  const text = svg
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<\?[\s\S]*?\?>/g, '')
    .replace(/<!DOCTYPE[\s\S]*?>/gi, '')
    .replace(/<!\[CDATA\[[\s\S]*?\]\]>/g, '');
  const tags: Tag[] = [];
  for (const m of text.matchAll(/<(\/?)([A-Za-z_][\w:.-]*)((?:[^>"']|"[^"]*"|'[^']*')*?)(\/?)>/g)) {
    const attrs = new Map<string, string>();
    for (const a of m[3]!.matchAll(/([A-Za-z_][\w:.-]*)\s*=\s*(?:"([^"]*)"|'([^']*)')/g))
      attrs.set(a[1]!, a[2] ?? a[3] ?? '');
    tags.push({ name: m[2]!, attrs, closing: m[1] === '/', selfClosing: m[4] === '/' });
  }
  return tags;
}

/** A presentation property from its attribute or from `style`. */
function property(tag: Tag, name: string): string | undefined {
  const style = tag.attrs.get('style');
  if (style !== undefined) {
    for (const decl of style.split(';')) {
      const cut = decl.indexOf(':');
      if (cut > 0 && decl.slice(0, cut).trim() === name) return decl.slice(cut + 1).trim();
    }
  }
  return tag.attrs.get(name)?.trim();
}

/** Refuses what would draw differently in the editor and in the font. */
function checkPaint(tag: Tag, file: string): void {
  const where = `<${tag.name}${tag.attrs.has('id') ? ` id="${tag.attrs.get('id')}"` : ''}>`;
  if (tag.attrs.has('transform'))
    throw new RadicalError(file, `${where} has a transform: flatten it into the coordinates`);
  if (property(tag, 'fill') === 'none')
    throw new RadicalError(file, `${where} has fill="none": the font fills every outline`);
  const stroke = property(tag, 'stroke');
  if (stroke !== undefined && stroke !== 'none')
    throw new RadicalError(
      file,
      `${where} has a stroke: the font has no strokes, draw it as an outline`,
    );
  if (property(tag, 'fill-rule') === 'evenodd')
    throw new RadicalError(
      file,
      `${where} fills even-odd: the font fills nonzero, wind a hole by nesting`,
    );
}

const DRAWN = new Set(['path', 'polygon']);
const SKIPPED = new Set(['title', 'desc', 'metadata', 'defs']);
const CURVES = 'CcSsQqTtAa';

function numbersOf(text: string, file: string, what: string): number[] {
  const out: number[] = [];
  for (const m of text.matchAll(/[+-]?(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?/g))
    out.push(Number(m[0]));
  if (text.replace(/[+-]?(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?/g, '').replace(/[\s,]/g, '') !== '')
    throw new RadicalError(file, `${what}: unreadable coordinates "${text.trim()}"`);
  return out;
}

/** A path's subpaths, in viewBox coordinates. Straight segments only. */
function pathContours(d: string, file: string): [number, number][][] {
  const curve = [...d].find((c) => CURVES.includes(c));
  if (curve !== undefined)
    throw new RadicalError(
      file,
      `the path command '${curve}' is a curve: radicals are straight segments only`,
    );
  const contours: [number, number][][] = [];
  let current: [number, number][] | null = null;
  let x = 0;
  let y = 0;
  let startX = 0;
  let startY = 0;
  for (const m of d.matchAll(/([MmLlHhVvZz])([^MmLlHhVvZz]*)/g)) {
    const cmd = m[1]!;
    const args = numbersOf(m[2]!, file, `path command '${cmd}'`);
    const rel = cmd === cmd.toLowerCase();
    switch (cmd.toUpperCase()) {
      case 'M':
      case 'L': {
        if (args.length === 0 || args.length % 2 !== 0)
          throw new RadicalError(file, `path command '${cmd}' takes coordinate pairs`);
        for (let i = 0; i < args.length; i += 2) {
          const nx = (rel ? x : 0) + args[i]!;
          const ny = (rel ? y : 0) + args[i + 1]!;
          if (i === 0 && cmd.toUpperCase() === 'M') {
            if (current !== null)
              throw new RadicalError(file, 'an open subpath: close each with Z');
            current = [];
            contours.push(current);
            startX = nx;
            startY = ny;
          }
          if (current === null) throw new RadicalError(file, `path command '${cmd}' before any M`);
          current.push([nx, ny]);
          x = nx;
          y = ny;
        }
        break;
      }
      case 'H':
      case 'V': {
        if (current === null) throw new RadicalError(file, `path command '${cmd}' before any M`);
        if (args.length === 0)
          throw new RadicalError(file, `path command '${cmd}' takes a coordinate`);
        for (const v of args) {
          if (cmd.toUpperCase() === 'H') x = (rel ? x : 0) + v;
          else y = (rel ? y : 0) + v;
          current.push([x, y]);
        }
        break;
      }
      case 'Z':
        if (current === null) throw new RadicalError(file, "path command 'Z' before any M");
        if (args.length > 0) throw new RadicalError(file, "path command 'Z' takes no coordinates");
        current = null;
        x = startX;
        y = startY;
        break;
    }
  }
  if (current !== null) throw new RadicalError(file, 'an open subpath: close each with Z');
  return contours;
}

const signedArea = (c: Contour): number => {
  let a = 0;
  for (let i = 0; i < c.length; i++) {
    const [x0, y0] = c[i]!;
    const [x1, y1] = c[(i + 1) % c.length]!;
    a += x0 * y1 - x1 * y0;
  }
  return a / 2; // positive = counter-clockwise with y up
};

const cross = (o: readonly number[], a: readonly number[], b: readonly number[]): number =>
  (a[0]! - o[0]!) * (b[1]! - o[1]!) - (a[1]! - o[1]!) * (b[0]! - o[0]!);

/** Whether two segments cross at a point inside both (touching is not crossing). */
function crosses(
  a: readonly number[],
  b: readonly number[],
  c: readonly number[],
  d: readonly number[],
): boolean {
  const d1 = cross(c, d, a);
  const d2 = cross(c, d, b);
  const d3 = cross(a, b, c);
  const d4 = cross(a, b, d);
  return ((d1 > 0 && d2 < 0) || (d1 < 0 && d2 > 0)) && ((d3 > 0 && d4 < 0) || (d3 < 0 && d4 > 0));
}

/** -1 outside, 0 on the boundary, 1 inside. */
function locate(p: readonly number[], c: Contour): -1 | 0 | 1 {
  let inside = false;
  for (let i = 0, j = c.length - 1; i < c.length; j = i++) {
    const a = c[i]!;
    const b = c[j]!;
    if (
      cross(a, b, p) === 0 &&
      p[0]! >= Math.min(a[0], b[0]) &&
      p[0]! <= Math.max(a[0], b[0]) &&
      p[1]! >= Math.min(a[1], b[1]) &&
      p[1]! <= Math.max(a[1], b[1])
    )
      return 0;
    if (
      a[1] > p[1]! !== b[1] > p[1]! &&
      p[0]! < ((b[0] - a[0]) * (p[1]! - a[1])) / (b[1] - a[1]) + a[0]
    )
      inside = !inside;
  }
  return inside ? 1 : -1;
}

/** Whether contour `inner` lies inside `outer`, judged by its first vertex off
 *  `outer`'s boundary (contours that don't cross are wholly in or out). */
function inside(inner: Contour, outer: Contour): boolean {
  for (const p of inner) {
    const at = locate(p, outer);
    if (at !== 0) return at === 1;
  }
  return false;
}

/**
 * Reads one radical's SVG source. `file` names it in a refusal. Coordinates
 * round to whole font units.
 */
export function parseRadicalSvg(svg: string, file: string): RadicalOutline {
  const tags = tagsOf(svg);
  const root = tags.find((t) => !t.closing);
  if (root?.name !== 'svg') throw new RadicalError(file, 'not an SVG document');
  const box = numbersOf(root.attrs.get('viewBox') ?? '', file, 'viewBox');
  if (
    box.length !== 4 ||
    box[0] !== 0 ||
    box[1] !== 0 ||
    box[3] !== GLYPH_BOX_HEIGHT ||
    !Number.isInteger(box[2]) ||
    box[2]! <= 0
  )
    throw new RadicalError(
      file,
      `the viewBox must be "0 0 <width> ${GLYPH_BOX_HEIGHT}", the glyph box`,
    );
  const width = box[2]!;
  checkPaint(root, file);

  const raw: [number, number][][] = [];
  // Open elements: a skip depth counts the guide group and ignored elements.
  const stack: { name: string; skip: boolean }[] = [];
  for (const tag of tags) {
    if (tag.closing) {
      const open = stack.pop();
      if (open?.name !== tag.name)
        throw new RadicalError(file, `</${tag.name}> closes nothing open`);
      continue;
    }
    const skipping = stack.some((s) => s.skip);
    const skip =
      skipping ||
      tag.name.includes(':') ||
      SKIPPED.has(tag.name) ||
      (tag.name === 'g' && tag.attrs.get('id') === 'guide');
    if (!skip && tag !== root) {
      if (tag.name !== 'g' && !DRAWN.has(tag.name))
        throw new RadicalError(
          file,
          `<${tag.name}> is not allowed: draw the mark as <path> or <polygon>`,
        );
      checkPaint(tag, file);
      if (tag.name === 'path') raw.push(...pathContours(tag.attrs.get('d') ?? '', file));
      if (tag.name === 'polygon') {
        const pts = numbersOf(tag.attrs.get('points') ?? '', file, '<polygon> points');
        if (pts.length % 2 !== 0) throw new RadicalError(file, '<polygon> points must be pairs');
        const contour: [number, number][] = [];
        for (let i = 0; i < pts.length; i += 2) contour.push([pts[i]!, pts[i + 1]!]);
        raw.push(contour);
      }
    }
    if (!tag.selfClosing) stack.push({ name: tag.name, skip });
  }
  if (stack.length > 0) throw new RadicalError(file, `<${stack.at(-1)!.name}> is never closed`);

  // To font units: y flips about the baseline; points round; repeats drop.
  const contours = raw.map((c) => {
    const out: [number, number][] = [];
    for (const [x, y] of c) {
      const p: [number, number] = [Math.round(x), Math.round(GLYPH_BASELINE - y)];
      const last = out.at(-1);
      if (!last || last[0] !== p[0] || last[1] !== p[1]) out.push(p);
    }
    const first = out[0];
    const last = out.at(-1);
    if (out.length > 1 && first && last && first[0] === last[0] && first[1] === last[1]) out.pop();
    return out;
  });
  if (contours.length === 0) throw new RadicalError(file, 'draws nothing');
  contours.forEach((c, i) => {
    if (c.length < 3 || signedArea(c) === 0)
      throw new RadicalError(file, `contour ${i + 1} encloses no area`);
    for (const [x, y] of c)
      if (x < 0 || x > width || y < GLYPH_BASELINE - GLYPH_BOX_HEIGHT || y > GLYPH_BASELINE)
        throw new RadicalError(
          file,
          `contour ${i + 1} leaves the glyph box at (${x}, ${GLYPH_BASELINE - y})`,
        );
  });

  // No two edges may cross, within a contour or between two.
  const edges = contours.flatMap((c, ci) =>
    c.map((p, i) => ({ ci, i, n: c.length, a: p, b: c[(i + 1) % c.length]! })),
  );
  for (let e = 0; e < edges.length; e++) {
    for (let f = e + 1; f < edges.length; f++) {
      const p = edges[e]!;
      const q = edges[f]!;
      if (crosses(p.a, p.b, q.a, q.b)) {
        throw new RadicalError(
          file,
          p.ci === q.ci
            ? `contour ${p.ci + 1} crosses itself`
            : `contours ${p.ci + 1} and ${q.ci + 1} cross: merge them into one outline`,
        );
      }
    }
  }

  // Wind by nesting: even depth outer (clockwise, negative area), odd a hole.
  const wound = contours.map((c, i) => {
    const depth = contours.filter((o, j) => j !== i && inside(c, o)).length;
    const clockwise = signedArea(c) < 0;
    return clockwise === (depth % 2 === 0) ? c : [...c].reverse();
  });
  return { width, contours: wound };
}
