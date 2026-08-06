/**
 * Pure formatter for `config/sectors.json` — the sector editor's Save / Copy /
 * Download AND the layout-editor "add to sector" toggle all emit through here, so
 * a written file is byte-for-byte the shape a hand-edit would produce (no noisy
 * whitespace diffs). Extracted from the editor UI and node-safe (the only runtime
 * import is `ENCOUNTER_KINDS`, the fight-pool key order) so it can be unit-tested
 * against the committed file (tests/tools/sector-editor.test.ts).
 *
 * Mirrors `config/sectors.json` exactly: 2-space indent, the
 * `id / title / description / length / theme / layouts / encounters /
 * events / startingEvents` key order (the last two are 74e; emitted with
 * `"eventId"` entries, `[]` when empty — first-class slots),
 * and each pool entry inline on one line as `{ "layoutId": …[, "minHop": …][,
 * "weight": …] }` (or `"encounterId"` for the fight pool) — `minHop` / `weight`
 * emitted only when present (they're optional in the schema, so an absent one
 * stays absent rather than serializing a default). The `encounters` pool is a
 * per-kind object (Wb4): `{ normal, elite, boss }` in `ENCOUNTER_KINDS` order,
 * each list always emitted (`[]` when empty), since it's a first-class slot.
 */

import type {
  SectorDef,
  SectorLayoutEntry,
  SectorEncounterEntry,
  SectorEventEntry,
} from '../../src/config/sectors';
import { ENCOUNTER_KINDS } from '../../src/config/encounters';

/** One layout-pool entry on a single line; optional fields appear only when set. */
function formatEntry(entry: SectorLayoutEntry): string {
  const parts = [`"layoutId": ${JSON.stringify(entry.layoutId)}`];
  if (entry.minHop !== undefined) parts.push(`"minHop": ${JSON.stringify(entry.minHop)}`);
  if (entry.weight !== undefined) parts.push(`"weight": ${JSON.stringify(entry.weight)}`);
  return `{ ${parts.join(', ')} }`;
}

/** One encounter-pool entry on a single line; mirrors `formatEntry`. */
function formatEncounterEntry(entry: SectorEncounterEntry): string {
  const parts = [`"encounterId": ${JSON.stringify(entry.encounterId)}`];
  if (entry.minHop !== undefined) parts.push(`"minHop": ${JSON.stringify(entry.minHop)}`);
  if (entry.weight !== undefined) parts.push(`"weight": ${JSON.stringify(entry.weight)}`);
  return `{ ${parts.join(', ')} }`;
}

/** 74e — one event-pool entry on a single line; mirrors `formatEncounterEntry`. */
function formatEventEntry(entry: SectorEventEntry): string {
  const parts = [`"eventId": ${JSON.stringify(entry.eventId)}`];
  if (entry.minHop !== undefined) parts.push(`"minHop": ${JSON.stringify(entry.minHop)}`);
  if (entry.weight !== undefined) parts.push(`"weight": ${JSON.stringify(entry.weight)}`);
  return `{ ${parts.join(', ')} }`;
}

/** 74e — one event list (`events` / `startingEvents`), always emitted
 *  (`[]` when empty — both are first-class slots, the fight-pool rule). */
function pushEventList(
  lines: string[],
  key: string,
  list: readonly SectorEventEntry[],
  tail: string,
): void {
  if (list.length === 0) {
    lines.push(`    "${key}": []${tail}`);
    return;
  }
  lines.push(`    "${key}": [`);
  list.forEach((entry, ei) => {
    const etail = ei === list.length - 1 ? '' : ',';
    lines.push(`      ${formatEventEntry(entry)}${etail}`);
  });
  lines.push(`    ]${tail}`);
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
    lines.push('    ],');
    // The fight pool is a per-kind object (Wb4): `{ normal, elite, boss }`, each
    // an entry list (`[]` when empty). Keys emit in `ENCOUNTER_KINDS` order.
    lines.push('    "encounters": {');
    ENCOUNTER_KINDS.forEach((kind, ki) => {
      const ktail = ki === ENCOUNTER_KINDS.length - 1 ? '' : ',';
      const list = sector.encounters[kind];
      if (list.length === 0) {
        lines.push(`      "${kind}": []${ktail}`);
      } else {
        lines.push(`      "${kind}": [`);
        list.forEach((entry, ei) => {
          const etail = ei === list.length - 1 ? '' : ',';
          lines.push(`        ${formatEncounterEntry(entry)}${etail}`);
        });
        lines.push(`      ]${ktail}`);
      }
    });
    lines.push('    },');
    // 74e — the event pool + the startingEvents seam, after `encounters`
    // (the committed-file key order).
    pushEventList(lines, 'events', sector.events, ',');
    pushEventList(lines, 'startingEvents', sector.startingEvents, '');
    lines.push(`  }${tail}`);
  });
  lines.push(']');
  return lines.join('\n');
}
