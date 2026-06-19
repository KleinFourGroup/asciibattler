/**
 * T3 — the pure "add a layout to sector pools" operation behind the layout
 * editor's "add to sector" toggle. Extracted from the editor UI and node-safe
 * (types only) so the append / skip / hop-gate logic is unit-tested headless
 * (tests/tools/sector-pool-edit.test.ts) rather than only exercised through the
 * DOM. The editor handles the fetch (live sectors.json) + the write (through
 * `formatSectorsJson`); this owns only the decision of what changes.
 */

import type { SectorDef } from '../../src/config/sectors';

export interface PoolAddResult {
  /** Labels (title, falling back to id) of sectors the layout was appended to. */
  readonly added: string[];
  /** Labels of sectors that already listed the layout (left untouched). */
  readonly skipped: string[];
}

/**
 * Append `layoutId` (with an optional `minHop` gate) to each named sector's
 * layout pool, **mutating the passed `sectors` in place**. A pool that already
 * lists the layout is skipped (idempotent — never a duplicate entry); an unknown
 * sector id is ignored. Returns which sectors were added-to vs skipped, by label.
 */
export function addLayoutToSectorPools(
  sectors: SectorDef[],
  layoutId: string,
  sectorIds: readonly string[],
  minHop?: number,
): PoolAddResult {
  const added: string[] = [];
  const skipped: string[] = [];
  for (const sectorId of sectorIds) {
    const sector = sectors.find((s) => s.id === sectorId);
    if (!sector) continue;
    const label = sector.title || sector.id;
    if (sector.layouts.some((e) => e.layoutId === layoutId)) {
      skipped.push(label);
      continue;
    }
    sector.layouts.push(minHop === undefined ? { layoutId } : { layoutId, minHop });
    added.push(label);
  }
  return { added, skipped };
}
