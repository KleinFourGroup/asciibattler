/**
 * T1 (Post-R "Encounter System" round): the **Sector** — a run's container,
 * loaded as validated config. A run hops through a sector's node-map, then on
 * to the next (the sector-selection DAG lands in T2). Source of truth at
 * `config/sectors.json`.
 *
 * A sector owns:
 *   - `id` / `title` / `description` — identity + flavor (title/desc surface in
 *     UI; e.g. a between-sector banner).
 *   - `length` — the sector's node-map hop count (feeds `NodeMap.generate`'s
 *     `hopCount`; the old `floorCount` post-S1 rename).
 *   - `theme` — the procedural-layout theme for this sector (reuses the layout
 *     `Theme` union; procedural battlefields in this sector inherit it).
 *   - `layouts` — the sector's battlefield POOL: a list of `{ layoutId, minHop?,
 *     weight? }`. Each entry is one board the sector can roll, optionally gated
 *     to `hop >= minHop` (the deferred M6 hop-gated layout roll). `weight` is a
 *     reserved seam — uniform selection ships now (T1 decision: sentinel +
 *     uniform), `weight` lets a future tuning pass bias the pool without a
 *     schema migration.
 *
 * **Procedural is a reserved `layoutId` sentinel** (`PROCEDURAL_LAYOUT_ID`)
 * sitting in the pool alongside real layout ids — no special-casing in the pool
 * shape (`layoutId` stays a plain string). It carries the SAME literal value as
 * `RunConfig.FORCE_PROCEDURAL` (a cross-check test guards the two against drift);
 * when T2 rolls a board, the sentinel resolves to a procedural map exactly like
 * the `null` layoutId the encounter map already uses.
 *
 * Validation runs at module load (the loud-failure mode A4 settled on for
 * balance configs). Two sector-specific guards beyond zod's structural checks:
 *   1. every `layoutId` is a real `LAYOUT_ID` or the procedural sentinel;
 *   2. the hop-gated pool is non-empty at every reachable hop `[0, length)` —
 *      so the board roll never faces an empty pool. (Availability is monotone in
 *      hop — an entry live at hop `d` is live at every hop `> d` — so this binds
 *      at hop 0, but the guard checks every hop for clarity + future weighting.)
 *
 * Adding a sector: append to `config/sectors.json` (or use the T3 sector editor);
 * `id` must be unique; validate with `npm test`.
 */

import { z } from 'zod';
import sectorsJson from '../../config/sectors.json';
import { LAYOUT_IDS, ThemeSchema } from './layouts';

/**
 * The reserved pool sentinel that means "roll a procedural battlefield" — the
 * authored counterpart of the encounter map's `layoutId: null`. Deliberately
 * the same literal as `RunConfig.FORCE_PROCEDURAL` ('procedural'); kept as its
 * own constant here so `config/` owns no dependency on `run/`, with a drift
 * cross-check in the test. No real layout may claim this id (the dup-id guard +
 * the layout-exists guard together forbid it).
 */
export const PROCEDURAL_LAYOUT_ID = 'procedural';

const SectorLayoutEntrySchema = z.object({
  /** A real `LAYOUT_ID` or `PROCEDURAL_LAYOUT_ID`. Validated below. */
  layoutId: z.string().min(1),
  /** Hop gate: this board is eligible only at `hop >= minHop`. Omitted = 0
   *  (eligible from hop 0). */
  minHop: z.number().int().nonnegative().optional(),
  /** Reserved seam — relative roll weight within the eligible pool. Unread this
   *  round (uniform selection); positive when present so a future weighted roll
   *  never divides by zero. */
  weight: z.number().positive().optional(),
});

export type SectorLayoutEntry = z.infer<typeof SectorLayoutEntrySchema>;

const SectorSchema = z
  .object({
    id: z.string().min(1),
    title: z.string().min(1),
    description: z.string().min(1),
    /** Node-map hop count for this sector (NodeMap.generate `hopCount`). */
    length: z.number().int().positive(),
    /** Procedural-side theme for this sector (reuses the layout Theme union). */
    theme: ThemeSchema,
    layouts: z.array(SectorLayoutEntrySchema).min(1),
  })
  .superRefine((sector, ctx) => {
    // Guard 1 — every pool entry references a real layout or the procedural
    // sentinel. (A real layout can't be named the sentinel — the layouts loader
    // would have to ship an id 'procedural', which the pool-exists check below
    // would then accept; that collision is owned by the CLI sentinel and never
    // authored.)
    const valid = new Set<string>([...LAYOUT_IDS, PROCEDURAL_LAYOUT_ID]);
    sector.layouts.forEach((entry, idx) => {
      if (!valid.has(entry.layoutId)) {
        ctx.addIssue({
          code: 'custom',
          path: ['layouts', idx, 'layoutId'],
          message: `sector "${sector.id}": unknown layoutId "${entry.layoutId}" (not a LAYOUT_ID or "${PROCEDURAL_LAYOUT_ID}")`,
        });
      }
    });

    // Guard 2 — the hop-gated pool is non-empty at every reachable hop. An entry
    // is eligible at hop `d` when `(minHop ?? 0) <= d`; the board roll must
    // always have at least one candidate.
    for (let hop = 0; hop < sector.length; hop++) {
      const eligible = sector.layouts.some((e) => (e.minHop ?? 0) <= hop);
      if (!eligible) {
        ctx.addIssue({
          code: 'custom',
          path: ['layouts'],
          message: `sector "${sector.id}": no eligible layout at hop ${hop} (every pool entry is gated above it)`,
        });
      }
    }
  });

/** The whole-file array schema. Exported so the T3 sector editor's formatter can
 *  round-trip its emitted JSON through the real loader schema (the M5 pattern). */
export const SectorsSchema = z.array(SectorSchema).min(1);

export type SectorDef = z.infer<typeof SectorSchema>;

const SECTORS_LIST: readonly SectorDef[] = SectorsSchema.parse(sectorsJson);

const seenIds = new Set<string>();
for (const sector of SECTORS_LIST) {
  if (seenIds.has(sector.id)) {
    throw new Error(`sectors.json: duplicate sector id "${sector.id}"`);
  }
  seenIds.add(sector.id);
}

export const SECTORS: readonly SectorDef[] = SECTORS_LIST;
export const SECTOR_IDS: readonly string[] = SECTORS_LIST.map((s) => s.id);

const SECTORS_BY_ID: Record<string, SectorDef> = {};
for (const sector of SECTORS_LIST) SECTORS_BY_ID[sector.id] = sector;

export function getSector(id: string): SectorDef | undefined {
  return SECTORS_BY_ID[id];
}

/**
 * The sector's hop-gated layout pool at a given hop: the entries eligible at
 * `hop` (gate `minHop ?? 0 <= hop`). The board roll (T2) draws from this; in T1
 * it's the queryable surface the schema guarantees is non-empty for every
 * reachable hop.
 */
export function layoutPoolAtHop(sector: SectorDef, hop: number): readonly SectorLayoutEntry[] {
  return sector.layouts.filter((e) => (e.minHop ?? 0) <= hop);
}
