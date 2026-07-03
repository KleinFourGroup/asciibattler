/**
 * Pure formatter for `config/layouts.json` — the layout editor's Save / Copy /
 * Download all emit through here so a saved file is byte-for-byte the shape a
 * hand-edit would produce (no noisy whitespace diffs). Extracted from the
 * editor UI and node-safe (a type-only import) so it can be unit-tested against
 * the committed file (tests/tools/layout-editor.test.ts) — the sibling of the
 * I4 archetype-editor formatter.
 *
 * Canonical shape (mirrors the committed file post-M5 normalization): 2-space
 * indent, the `id / name / description / gridW / gridH / theme / walls /
 * [water] / [halfCovers] / [rubble] / [chasms] / [fires] / [healings] /
 * [deepWater] / [hills] / [ice] / [sand] / [mud] / spawns` key order,
 * `walls` always present (empty → an open+close bracket pair), the optional
 * terrain arrays emitted only when non-empty, and **every coord on its own
 * line** (the editor's long-standing emit — the 4-per-line packing some
 * hand-authored entries used to carry was normalized away in M5 so a single
 * deterministic formatter reproduces the whole file).
 */

import type { LayoutDef } from '../../src/config/layouts';

interface Coord {
  readonly x: number;
  readonly y: number;
}

/** One coord per line: `<pad>{ "x": N, "y": M }<sep>`. */
function formatCoords(coords: readonly Coord[], pad: string): string[] {
  return coords.map((c, i) => {
    const sep = i === coords.length - 1 ? '' : ',';
    return `${pad}    { "x": ${c.x}, "y": ${c.y} }${sep}`;
  });
}

/** Emit `<pad>"<key>": [` … coords … `<pad>],` for a terrain coord array. */
function coordArrayBlock(key: string, coords: readonly Coord[], pad: string): string[] {
  return [`${pad}  "${key}": [`, ...formatCoords(coords, pad), `${pad}  ],`];
}

/**
 * §40d — one rubble coord per line, emitting `size` / `hp` only when present so a
 * bare 1×1 default reads as a plain `{ "x": N, "y": M }` (matching the optional-
 * field convention). Key order within a coord: x, y, size, hp.
 */
function formatRubbleCoords(
  coords: readonly { x: number; y: number; size?: number | undefined; hp?: number | undefined }[],
  pad: string,
): string[] {
  return coords.map((c, i) => {
    const sep = i === coords.length - 1 ? '' : ',';
    let body = `"x": ${c.x}, "y": ${c.y}`;
    if (c.size !== undefined) body += `, "size": ${c.size}`;
    if (c.hp !== undefined) body += `, "hp": ${c.hp}`;
    return `${pad}    { ${body} }${sep}`;
  });
}

/**
 * Format one layout object's lines at a given base indent (the indent of the
 * opening `{`). Used both standalone (indent 0 — the editor's export snippet)
 * and as an array element (indent 2 — the whole-file save). The closing `}`
 * carries NO trailing comma; a caller emitting an array adds it for non-last
 * entries.
 */
export function formatLayoutLines(layout: LayoutDef, indent = 0): string[] {
  const pad = ' '.repeat(indent);
  const parts: string[] = [];
  parts.push(`${pad}{`);
  parts.push(`${pad}  "id": ${JSON.stringify(layout.id)},`);
  parts.push(`${pad}  "name": ${JSON.stringify(layout.name)},`);
  parts.push(`${pad}  "description": ${JSON.stringify(layout.description)},`);
  parts.push(`${pad}  "gridW": ${layout.gridW},`);
  parts.push(`${pad}  "gridH": ${layout.gridH},`);
  // theme is REQUIRED in the schema — emit unconditionally.
  parts.push(`${pad}  "theme": ${JSON.stringify(layout.theme)},`);
  // walls is always present (even when empty: an open+close bracket pair).
  parts.push(...coordArrayBlock('walls', layout.walls, pad));
  // The optional terrain arrays, in the committed file's order, only when set.
  if (layout.water && layout.water.length > 0) parts.push(...coordArrayBlock('water', layout.water, pad));
  if (layout.halfCovers && layout.halfCovers.length > 0)
    parts.push(...coordArrayBlock('halfCovers', layout.halfCovers, pad));
  // §40d — rubble, grouped with the other neutral obstacles (after half-cover).
  if (layout.rubble && layout.rubble.length > 0)
    parts.push(`${pad}  "rubble": [`, ...formatRubbleCoords(layout.rubble, pad), `${pad}  ],`);
  if (layout.chasms && layout.chasms.length > 0) parts.push(...coordArrayBlock('chasms', layout.chasms, pad));
  if (layout.fires && layout.fires.length > 0) parts.push(...coordArrayBlock('fires', layout.fires, pad));
  if (layout.healings && layout.healings.length > 0)
    parts.push(...coordArrayBlock('healings', layout.healings, pad));
  // §37f — the five §37b terrain tiles, same optional-when-non-empty convention.
  if (layout.deepWater && layout.deepWater.length > 0)
    parts.push(...coordArrayBlock('deepWater', layout.deepWater, pad));
  if (layout.hills && layout.hills.length > 0)
    parts.push(...coordArrayBlock('hills', layout.hills, pad));
  if (layout.ice && layout.ice.length > 0) parts.push(...coordArrayBlock('ice', layout.ice, pad));
  if (layout.sand && layout.sand.length > 0) parts.push(...coordArrayBlock('sand', layout.sand, pad));
  if (layout.mud && layout.mud.length > 0) parts.push(...coordArrayBlock('mud', layout.mud, pad));
  parts.push(`${pad}  "spawns": [`);
  layout.spawns.forEach((region, i) => {
    const sep = i === layout.spawns.length - 1 ? '' : ',';
    parts.push(`${pad}    {`);
    parts.push(`${pad}      "availability": ${JSON.stringify(region.availability)},`);
    parts.push(`${pad}      "tiles": [`);
    parts.push(
      ...region.tiles.map((c, j) => {
        const tileSep = j === region.tiles.length - 1 ? '' : ',';
        return `${pad}        { "x": ${c.x}, "y": ${c.y} }${tileSep}`;
      }),
    );
    parts.push(`${pad}      ]`);
    parts.push(`${pad}    }${sep}`);
  });
  parts.push(`${pad}  ]`);
  parts.push(`${pad}}`);
  return parts;
}

/**
 * Format a single layout to a standalone JSON object string (indent 0) — the
 * editor's Copy / Download export snippet, ready to paste into the array.
 */
export function formatLayoutJson(layout: LayoutDef): string {
  return formatLayoutLines(layout, 0).join('\n');
}

/**
 * Format the whole layouts array to a string matching `config/layouts.json`.
 * No trailing newline — the dev-server save endpoint appends one (matching
 * every other editor's emit convention).
 */
export function formatLayoutsJson(layouts: readonly LayoutDef[]): string {
  if (layouts.length === 0) return '[]';
  const parts: string[] = ['['];
  layouts.forEach((layout, i) => {
    const lines = formatLayoutLines(layout, 2);
    // The last line is the entry's closing `}`; non-last entries get a comma.
    if (i < layouts.length - 1) lines[lines.length - 1] += ',';
    parts.push(...lines);
  });
  parts.push(']');
  return parts.join('\n');
}
