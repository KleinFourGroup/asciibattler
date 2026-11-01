/**
 * The radical sheet: our drawn face's sources on one page, for drawing and
 * checking a radical. Dev-only; visit http://localhost:5173/tools/glyph-sheet/
 * after `npm run dev`. Not in the production build (no rollupOptions.input
 * entry).
 *
 * Each radical is shown alone, as its SVG file draws (guides included), with
 * what the face's reader makes of it or why it refuses it; each glyph of the
 * composition table is composed here from the sources, by the same build
 * gen:font runs (tools/font/glyphFace.ts), and drawn on the glyph box's lines
 * beside the JetBrains Mono letters it could be taken for. Then the shipped
 * face in page text, at the sizes the screens use, and a link to the glyph
 * sampler for the board.
 */

import '../../src/fonts.css';
import './glyph-sheet.css';
import { parse, type Font } from 'opentype.js';
import { FACES, FONT_STACK } from '../../src/render/fontSubset';
import { composeGlyphFace, glyphFaceBytes } from '../font/glyphFace';
import { codePointLabel, parseGlyphTable } from '../font/glyphTable';
import { parseRadicalSvg, GLYPH_BASELINE, GLYPH_BOX_HEIGHT } from '../font/radicalSvg';
import table from '../../assets/fonts/asciibattler-glyphs/glyphs.json';

const RADICAL_FILES = import.meta.glob('../../assets/fonts/asciibattler-glyphs/radicals/*.svg', {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>;
const radicals = new Map(
  Object.entries(RADICAL_FILES).map(([path, svg]) => [path.split('/').pop()!.slice(0, -4), svg]),
);

/** Pixels per font unit on the sheet. */
const SCALE = 0.25;

const el = <T extends HTMLElement>(sel: string): T => {
  const found = document.querySelector<T>(sel);
  if (!found) throw new Error(`glyph-sheet: no ${sel}`);
  return found;
};

function figure(body: Node | string, caption: string, error = false): HTMLElement {
  const fig = document.createElement('figure');
  if (typeof body === 'string') fig.innerHTML = body;
  else fig.appendChild(body);
  const cap = document.createElement('figcaption');
  cap.textContent = caption;
  if (error) cap.className = 'err';
  fig.appendChild(cap);
  return fig;
}

/** One glyph's outline on the glyph box, with the box's lines. */
function glyphSvg(font: Font, ch: string, width: number, color: string): string {
  const w = width * SCALE;
  const h = GLYPH_BOX_HEIGHT * SCALE;
  const y = (v: number): string => ((GLYPH_BASELINE - v) * SCALE).toFixed(1);
  const d = font
    .charToGlyph(ch)
    .getPath(0, GLYPH_BASELINE * SCALE, 1000 * SCALE)
    .toPathData(1);
  const line = (v: number, c: string): string =>
    `<line x1="0" x2="${w}" y1="${y(v)}" y2="${y(v)}" stroke="${c}" stroke-width="1"/>`;
  const slot =
    width > 600
      ? `<rect x="${((width - 600) / 2) * SCALE}" y="0" width="${600 * SCALE}" height="${h}" fill="none" stroke="#2a4034" stroke-dasharray="4 3"/>`
      : '';
  return (
    `<svg width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">` +
    `<rect width="100%" height="100%" fill="#0d1210"/>${slot}` +
    `${line(730, '#2a4034')}${line(550, '#2a4034')}${line(0, '#7a5a30')}${line(-180, '#2a4034')}` +
    `<path d="${d}" fill="${color}"/></svg>`
  );
}

async function main(): Promise<void> {
  const root = el<HTMLElement>('#editor-root');
  root.style.setProperty('--font-glyphs', `${FONT_STACK}, ui-monospace, monospace`);
  const primaryFace = FACES.find((f) => f.role === 'primary')!;
  const res = await fetch(`/assets/fonts/${primaryFace.dir}/${primaryFace.source}`);
  const primaryBytes = new Uint8Array(await res.arrayBuffer());
  const primary = parse(primaryBytes.buffer);

  const radicalsEl = el<HTMLElement>('#radicals');
  for (const [name, svg] of [...radicals].sort(([a], [b]) => a.localeCompare(b))) {
    try {
      const outline = parseRadicalSvg(svg, `radicals/${name}.svg`);
      const scaled = svg.replace(/<svg\b([^>]*?)\swidth="[^"]*"\s+height="[^"]*"/, '<svg$1');
      const fig = figure(
        scaled,
        `${name}.svg: ${outline.contours.length} contours, ${outline.width} wide`,
      );
      fig.classList.add('radical');
      const svgEl = fig.querySelector('svg');
      svgEl?.setAttribute('width', String(outline.width * SCALE));
      svgEl?.setAttribute('height', String(GLYPH_BOX_HEIGHT * SCALE));
      radicalsEl.appendChild(fig);
    } catch (err) {
      radicalsEl.appendChild(figure('', String(err), true));
    }
  }

  const glyphsEl = el<HTMLElement>('#glyphs');
  const textEl = el<HTMLElement>('#text');
  try {
    const { font, rows } = composeGlyphFace({ primary: primaryBytes, table, radicals });
    const face = parse(glyphFaceBytes(font).buffer);
    for (const row of rows) {
      const ch = String.fromCodePoint(row.codePoint);
      const strip = document.createElement('div');
      strip.className = 'row';
      strip.innerHTML = glyphSvg(face, ch, row.width, '#00ff66');
      if (row.letter !== null) {
        const upper = row.letter.toUpperCase();
        for (const l of upper === row.letter ? [row.letter] : [row.letter, upper])
          strip.insertAdjacentHTML('beforeend', glyphSvg(primary, l, 600, '#5f8a70'));
      }
      glyphsEl.appendChild(
        figure(
          strip,
          `${codePointLabel(row.codePoint)} ${row.name}: ${row.letter ?? '(no letter)'} + ` +
            `${row.radicals.join(', ') || '(no radicals)'}, ${row.width} wide`,
        ),
      );
    }
    const shown = rows.map((r) => {
      const ch = String.fromCodePoint(r.codePoint);
      return r.letter === null ? ch : `${r.letter} ${ch} ${r.letter.toUpperCase()}`;
    });
    for (const [size, weight] of [
      [48, 'bold'],
      [34, 'normal'],
      [16, 'bold'],
      [12, 'normal'],
    ] as const) {
      const line = document.createElement('div');
      line.className = 'text-row';
      line.style.fontSize = `${size}px`;
      line.style.fontWeight = weight;
      line.textContent = shown.join('  ·  ');
      textEl.appendChild(line);
    }
    const tokens = parseGlyphTable(table).map((r) => {
      const cp = codePointLabel(r.codePoint);
      return r.letter === null ? cp : `${r.letter},${cp},${r.letter.toUpperCase()}`;
    });
    el<HTMLAnchorElement>('#sampler').href =
      `/?bp=board-open15_pose-sampler&glyphs=${tokens.join(';')}`;
  } catch (err) {
    glyphsEl.appendChild(figure('', String(err), true));
  }
}

void main();
