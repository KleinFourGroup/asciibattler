/**
 * The pure "add an item to sector pools" operations behind the editor
 * "add to sector" toggles — `addLayoutToSectorPools` (T3, layout editor) and
 * `addEncounterToSectorPools` (V2 placement, encounter editor). Extracted from
 * the editor UI and node-safe (types only) so the append / skip / hop-gate logic
 * is unit-tested headless (tests/tools/sector-pool-edit.test.ts +
 * encounter-pool-edit.test.ts) rather than only exercised through the DOM. The
 * editor handles the fetch (live sectors.json) + the write (through
 * `formatSectorsJson`); this owns only the decision of what changes. The sector
 * owns BOTH pools (sector-owns-both), so both toggles write the SECTOR file.
 */

import type { SectorDef } from '../../src/config/sectors';

export interface PoolAddResult {
  /** Labels (title, falling back to id) of sectors the item was appended to. */
  readonly added: string[];
  /** Labels of sectors that already listed the item (left untouched). */
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

/**
 * Append `encounterId` (with an optional `minHop` gate) to each named sector's
 * ENCOUNTER pool, **mutating the passed `sectors` in place** — the V2 placement
 * mirror of `addLayoutToSectorPools` (same append / skip / hop-gate semantics on
 * the fight pool). A pool that already lists the encounter is skipped (idempotent
 * — never a duplicate entry); an unknown sector id is ignored. Returns which
 * sectors were added-to vs skipped, by label. The caller must ensure
 * `encounterId` is a committed `ENCOUNTER_IDS` member before writing — the sector
 * schema's encounter-ref guard rejects an unknown id at boot.
 */
export function addEncounterToSectorPools(
  sectors: SectorDef[],
  encounterId: string,
  sectorIds: readonly string[],
  minHop?: number,
): PoolAddResult {
  const added: string[] = [];
  const skipped: string[] = [];
  for (const sectorId of sectorIds) {
    const sector = sectors.find((s) => s.id === sectorId);
    if (!sector) continue;
    const label = sector.title || sector.id;
    if (sector.encounters.some((e) => e.encounterId === encounterId)) {
      skipped.push(label);
      continue;
    }
    sector.encounters.push(minHop === undefined ? { encounterId } : { encounterId, minHop });
    added.push(label);
  }
  return { added, skipped };
}
