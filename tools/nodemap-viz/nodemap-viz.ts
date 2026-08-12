/**
 * Node-Map Visualizer (77a). The sector-DAG sandbox the tools index promised
 * since M6 and never had — wired to the LIVE `NodeMap.generate`, so what it
 * draws is exactly what a run rolls for the same seed + knobs. Dev-only;
 * visit http://localhost:5173/tools/nodemap-viz/ (or the dev-preview port).
 *
 * Scope (the §77 cut): pure visualization — seed sandbox, the G1/72e/74e
 * RunConfig dials, kind coloring mirroring the in-game map screen, a
 * variety strip. The three metrics land at 77b as an overlay here; the
 * generator itself is untouched (77e's job).
 *
 * Knob honesty: the dial sliders always pass an explicit RunConfig, which is
 * byte-identical to the authored default whenever the values match (the G1
 * `??` contract in `generate`). `firstNodeKind` mirrors the production dial's
 * restricted union ('elite' | 'event') — the startingEvents stamp path is the
 * 'event' case.
 */

import { RNG } from '../../src/core/RNG';
import { generate, type NodeMap, type NodeKind } from '../../src/run/NodeMap';
import { NODE_MAP } from '../../src/config/nodemap';
import type { RunConfig } from '../../src/run/RunConfig';

/** Kind glyphs + hues, mirroring MapScreen.ts KIND_GLYPH + ui.css .map-node
 *  accents (G3) — the tool should read like the in-game map. */
const KIND: Record<NodeKind, { glyph: string; color: string }> = {
  battle: { glyph: 'X', color: '#c9c2ea' },
  rest: { glyph: 'Z', color: '#33ff00' },
  boss: { glyph: '!', color: '#ff3131' },
  elite: { glyph: '*', color: '#9d00ff' },
  port: { glyph: '$', color: '#ffb000' },
  event: { glyph: '?', color: '#3d7bff' },
};
const ROOT_RING = '#ffb000';

const el = <T extends HTMLElement>(id: string): T => {
  const e = document.getElementById(id);
  if (!e) throw new Error(`#${id} missing`);
  return e as T;
};

const seedInput = el<HTMLInputElement>('seed');
const hopCountInput = el<HTMLInputElement>('hopCount');
const mapMaxWidthInput = el<HTMLInputElement>('mapMaxWidth');
const eliteChanceInput = el<HTMLInputElement>('eliteChance');
const portChanceInput = el<HTMLInputElement>('portChance');
const eventChanceInput = el<HTMLInputElement>('eventChance');
const firstNodeKindSelect = el<HTMLSelectElement>('firstNodeKind');
const board = el<HTMLElement>('board');
const stats = el<HTMLElement>('stats');
const thumbs = el<HTMLElement>('thumbs');

const SLIDERS: ReadonlyArray<[HTMLInputElement, string]> = [
  [hopCountInput, 'hopCount-o'],
  [mapMaxWidthInput, 'mapMaxWidth-o'],
  [eliteChanceInput, 'eliteChance-o'],
  [portChanceInput, 'portChance-o'],
  [eventChanceInput, 'eventChance-o'],
];

function setAuthoredDefaults(): void {
  hopCountInput.value = String(NODE_MAP.hopCount);
  mapMaxWidthInput.value = String(NODE_MAP.middleWidthMax);
  eliteChanceInput.value = String(NODE_MAP.eliteChance);
  portChanceInput.value = String(NODE_MAP.portChance);
  eventChanceInput.value = String(NODE_MAP.eventChance);
  firstNodeKindSelect.value = '';
}

function currentConfig(): RunConfig {
  const stamp = firstNodeKindSelect.value;
  return {
    hopCount: Number(hopCountInput.value),
    mapMaxWidth: Number(mapMaxWidthInput.value),
    eliteChance: Number(eliteChanceInput.value),
    portChance: Number(portChanceInput.value),
    eventChance: Number(eventChanceInput.value),
    ...(stamp === 'elite' || stamp === 'event' ? { firstNodeKind: stamp } : {}),
  };
}

function currentSeed(): number {
  return Number(seedInput.value) >>> 0;
}

/** Render a NodeMap as an SVG string. Hops are columns left→right; the
 *  cross-axis order is the `hops[f]` array index — the same fixed ordering
 *  the planarity guarantee (and the game's map screen) is stated against,
 *  so non-crossing maps draw without crossings here too. */
function renderSvg(
  map: NodeMap,
  opts: { colW: number; rowH: number; r: number; margin: number; glyphs: boolean },
): string {
  const { colW, rowH, r, margin, glyphs } = opts;
  const maxWidth = Math.max(...map.hops.map((h) => h.length));
  const w = margin * 2 + (map.hops.length - 1) * colW;
  const h = margin * 2 + (maxWidth - 1) * rowH;

  const pos = new Map<number, { x: number; y: number }>();
  for (let f = 0; f < map.hops.length; f++) {
    const ids = map.hops[f]!;
    const yOffset = ((maxWidth - ids.length) * rowH) / 2;
    for (let i = 0; i < ids.length; i++) {
      pos.set(ids[i]!, { x: margin + f * colW, y: margin + yOffset + i * rowH });
    }
  }

  const parts: string[] = [];
  parts.push(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">`,
  );
  for (const e of map.edges) {
    const a = pos.get(e.from)!;
    const b = pos.get(e.to)!;
    parts.push(
      `<line x1="${a.x}" y1="${a.y}" x2="${b.x}" y2="${b.y}" stroke="#4a3f73" stroke-width="${glyphs ? 1.5 : 1}" />`,
    );
  }
  for (const node of map.nodes) {
    const p = pos.get(node.id)!;
    const kind = KIND[node.kind];
    parts.push(`<g>`);
    if (glyphs) parts.push(`<title>#${node.id} · hop ${node.hop} · ${node.kind}</title>`);
    parts.push(
      `<circle cx="${p.x}" cy="${p.y}" r="${r}" fill="#1b1530" stroke="${kind.color}" stroke-width="${glyphs ? 1.5 : 1}" />`,
    );
    if (node.id === map.rootId) {
      parts.push(
        `<circle cx="${p.x}" cy="${p.y}" r="${r + (glyphs ? 4 : 2)}" fill="none" stroke="${ROOT_RING}" stroke-width="1" stroke-dasharray="3 2" />`,
      );
    }
    if (glyphs) {
      parts.push(
        `<text x="${p.x}" y="${p.y}" fill="${kind.color}" font-size="${r}" font-weight="700" text-anchor="middle" dominant-baseline="central" font-family="ui-monospace, Consolas, monospace">${kind.glyph}</text>`,
      );
    } else {
      parts.push(`<circle cx="${p.x}" cy="${p.y}" r="${Math.max(1.5, r - 1)}" fill="${kind.color}" />`);
    }
    parts.push(`</g>`);
  }
  parts.push(`</svg>`);
  return parts.join('');
}

function renderStats(map: NodeMap): string {
  const kindCounts = new Map<NodeKind, number>();
  for (const n of map.nodes) kindCounts.set(n.kind, (kindCounts.get(n.kind) ?? 0) + 1);
  const outDeg = new Map<number, number>();
  for (const e of map.edges) outDeg.set(e.from, (outDeg.get(e.from) ?? 0) + 1);
  const nonTerminal = map.nodes.filter((n) => n.id !== map.terminalId);
  const branching = nonTerminal.filter((n) => (outDeg.get(n.id) ?? 0) > 1).length;
  const avgOut =
    nonTerminal.reduce((s, n) => s + (outDeg.get(n.id) ?? 0), 0) / Math.max(1, nonTerminal.length);

  const widths = map.hops.map((h) => h.length).join(' · ');
  const kinds = (Object.keys(KIND) as NodeKind[])
    .filter((k) => (kindCounts.get(k) ?? 0) > 0)
    .map((k) => `<span style="color:${KIND[k].color}">${KIND[k].glyph}&hairsp;${kindCounts.get(k)}</span>`)
    .join(' &nbsp; ');

  return (
    `<b>${map.nodes.length}</b> nodes / <b>${map.edges.length}</b> edges &nbsp;·&nbsp; widths ${widths}<br>` +
    `kinds: ${kinds}<br>` +
    `avg out-degree <b>${avgOut.toFixed(2)}</b> &nbsp;·&nbsp; branching nodes <b>${branching}</b>` +
    `<span class="sub"> (the three §77 metrics land here at 77b)</span>`
  );
}

function generateFor(seed: number): NodeMap {
  return generate(new RNG(seed), currentConfig());
}

function redraw(): void {
  const seed = currentSeed();
  const map = generateFor(seed);
  board.innerHTML = renderSvg(map, { colW: 92, rowH: 54, r: 15, margin: 34, glyphs: true });
  stats.innerHTML = renderStats(map);

  thumbs.innerHTML = '';
  for (let i = 1; i <= 8; i++) {
    const s = (seed + i) >>> 0;
    const div = document.createElement('div');
    div.className = 'thumb';
    div.innerHTML =
      renderSvg(generateFor(s), { colW: 22, rowH: 13, r: 3, margin: 10, glyphs: false }) +
      `<div class="cap">${s}</div>`;
    div.addEventListener('click', () => {
      seedInput.value = String(s);
      redraw();
    });
    thumbs.appendChild(div);
  }

  for (const [input, outId] of SLIDERS) el<HTMLOutputElement>(outId).value = input.value;
  const url = new URL(window.location.href);
  url.searchParams.set('seed', String(seed));
  window.history.replaceState(null, '', url);
}

// --- wiring ---

setAuthoredDefaults();
const urlSeed = new URL(window.location.href).searchParams.get('seed');
if (urlSeed !== null && Number.isFinite(Number(urlSeed))) seedInput.value = urlSeed;

for (const [input] of SLIDERS) input.addEventListener('input', redraw);
firstNodeKindSelect.addEventListener('change', redraw);
seedInput.addEventListener('change', redraw);
el<HTMLButtonElement>('seed-prev').addEventListener('click', () => {
  seedInput.value = String(Math.max(0, currentSeed() - 1));
  redraw();
});
el<HTMLButtonElement>('seed-next').addEventListener('click', () => {
  seedInput.value = String(currentSeed() + 1);
  redraw();
});
el<HTMLButtonElement>('reroll').addEventListener('click', () => {
  seedInput.value = String(Math.floor(Math.random() * 0xffff_ffff) >>> 0);
  redraw();
});
el<HTMLButtonElement>('reset').addEventListener('click', () => {
  setAuthoredDefaults();
  redraw();
});

redraw();
