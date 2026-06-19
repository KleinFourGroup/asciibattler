/**
 * Pure formatter for `config/sectors.json` — the sector editor's Save / Copy /
 * Download AND the layout-editor "add to sector" toggle all emit through here, so
 * a written file is byte-for-byte the shape a hand-edit would produce (no noisy
 * whitespace diffs). Extracted from the editor UI and node-safe (types only) so
 * it can be unit-tested against the committed file (tests/tools/sector-editor.test.ts).
 *
 * Mirrors `config/sectors.json` exactly: 2-space indent, the
 * `id / title / description / length / theme / layouts` key order, and each
 * layout-pool entry inline on one line as `{ "layoutId": …[, "minHop": …][,
 * "weight": …] }` — `minHop` / `weight` emitted only when present (they're
 * optional in the schema, so an absent one stays absent rather than serializing a
 * default).
 */

import type { SectorDef, SectorLayoutEntry } from '../../src/config/sectors';

/** One pool entry on a single line; optional fields appear only when set. */
function formatEntry(entry: SectorLayoutEntry): string {
  const parts = [`"layoutId": ${JSON.stringify(entry.layoutId)}`];
  if (entry.minHop !== undefined) parts.push(`"minHop": ${JSON.stringify(entry.minHop)}`);
  if (entry.weight !== undefined) parts.push(`"weight": ${JSON.stringify(entry.weight)}`);
  return `{ ${parts.join(', ')} }`;
}

/**
 * Format a full sectors config (the whole file) to a JSON string matching
 * `config/sectors.json`'s layout. No trailing newline — the save endpoint
 * appends one (matching every other editor's emit convention).
 */
export function formatSectorsJson(sectors: readonly SectorDef[]): string {
  const lines: string[] = ['['];
  sectors.forEach((sector, si) => {
    const tail = si === sectors.length - 1 ? '' : ',';
    lines.push('  {');
    lines.push(`    "id": ${JSON.stringify(sector.id)},`);
    lines.push(`    "title": ${JSON.stringify(sector.title)},`);
    lines.push(`    "description": ${JSON.stringify(sector.description)},`);
    lines.push(`    "length": ${JSON.stringify(sector.length)},`);
    lines.push(`    "theme": ${JSON.stringify(sector.theme)},`);
    lines.push('    "layouts": [');
    sector.layouts.forEach((entry, ei) => {
      const etail = ei === sector.layouts.length - 1 ? '' : ',';
      lines.push(`      ${formatEntry(entry)}${etail}`);
    });
    lines.push('    ]');
    lines.push(`  }${tail}`);
  });
  lines.push(']');
  return lines.join('\n');
}
