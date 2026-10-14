/**
 * The sectors, a run's containers: a run hops through a sector's node map,
 * then moves to the next (sectorMap.ts). Source of truth at
 * `config/sectors.json`, which the sector editor also writes.
 *
 * - `id`, `title`, `description` — identity and flavour. The title is shown
 *   in the UI; the description is editor metadata, never shown.
 * - `length` — the sector's hop count (`NodeMap.generate`'s `hopCount`).
 * - `theme` — the theme of its procedural battlefields (the layouts'
 *   `Theme`).
 * - `layouts` — the battlefield pool: `{ layoutId, minHop?, weight? }`
 *   entries, each a board the sector can roll.
 * - `encounters` — the fight pool, the placement half of the encounter
 *   model, split by kind into `{ normal, elite, boss }` lists of
 *   `{ encounterId, minHop?, weight? }`. Selection draws from the list of
 *   the node's kind (`encounterKindFor`), then filters by the encounter's
 *   layout fit. An absent key, or kind, is empty.
 * - `events` — the pool an event node draws from on entry. Empty, an event
 *   node becomes a fight.
 * - `startingEvents` — non-empty, the sector's root node is an event drawn
 *   from this list instead.
 *
 * In every pool an entry is eligible from hop `minHop` on (omitted, 0), and
 * `weight` is its relative roll weight (omitted, 1), positive so the draw
 * never divides by zero.
 *
 * The procedural battlefield is a reserved `layoutId`, `PROCEDURAL_LAYOUT_ID`,
 * in the pool beside real layout ids, so the pool's shape has no special
 * case. When the board roll lands on it, it resolves to a procedural map as a
 * `null` layoutId does.
 *
 * Beyond zod's structural checks, the parse refuses a `layoutId` that is
 * neither a `LAYOUT_ID` nor the sentinel, a layout pool empty at any hop in
 * `[0, length)`, an encounter or event ref that names nothing, and an
 * encounter pooled under a kind not its own. Per-kind encounter coverage is
 * checked in selection (`assertSelectionCoverage`). A new sector's `id` must
 * be unique.
 */

import { z } from 'zod';
import { prose } from '../i18n/prose';
import { loadProse } from '../i18n/locale';
import sectorsJson from '../../config/sectors.json';
import { LAYOUT_IDS, ThemeSchema } from './layouts';
import { ENCOUNTER_KINDS, getEncounter, type EncounterKind } from './encounters';
import { getEvent } from './events';

/**
 * The pool's sentinel for "roll a procedural battlefield", the authored
 * counterpart of the encounter map's `layoutId: null`. The same literal as
 * `RunConfig.FORCE_PROCEDURAL`, kept as its own constant so `config/` does
 * not depend on `run/`; a test checks the two agree. A layout named
 * `procedural` could not be told from it, so none may be authored.
 */
export const PROCEDURAL_LAYOUT_ID = 'procedural';

const SectorLayoutEntrySchema = z.object({
  /** A real `LAYOUT_ID` or `PROCEDURAL_LAYOUT_ID`, checked below. */
  layoutId: z.string().min(1),
  minHop: z.number().int().nonnegative().optional(),
  weight: z.number().positive().optional(),
});

export type SectorLayoutEntry = z.infer<typeof SectorLayoutEntrySchema>;

/** The encounter-pool entry: the layout entry's shape, keyed by
 *  `encounterId`. */
const SectorEncounterEntrySchema = z.object({
  /** A catalog encounter id, checked below. */
  encounterId: z.string().min(1),
  minHop: z.number().int().nonnegative().optional(),
  weight: z.number().positive().optional(),
});

export type SectorEncounterEntry = z.infer<typeof SectorEncounterEntrySchema>;

/**
 * The event-pool entry, keyed by `eventId`, used by both `events` and
 * `startingEvents`. The hop gate applies to both; the root is hop 0, so a
 * starting entry with `minHop > 0` is never eligible. An event's own
 * `eligibility` conditions read live run state when the pool is rolled, so
 * they cannot be checked here.
 */
const SectorEventEntrySchema = z.object({
  /** A catalog event id, checked below. */
  eventId: z.string().min(1),
  minHop: z.number().int().nonnegative().optional(),
  weight: z.number().positive().optional(),
});

export type SectorEventEntry = z.infer<typeof SectorEventEntrySchema>;

/** Empty pools for every kind, the default when a sector omits `encounters`.
 *  An exhaustive literal, so a new `EncounterKind` must add its list here. */
function emptyEncounterPools(): Record<EncounterKind, SectorEncounterEntry[]> {
  return { normal: [], elite: [], boss: [] };
}

/**
 * The fight pool, one entry list per `EncounterKind`, built from
 * `ENCOUNTER_KINDS` so a new kind must add its list. Each list defaults to
 * empty, and so does the whole object, so a partial or absent key parses.
 */
const SectorEncounterPoolsSchema = z
  .object(
    Object.fromEntries(
      ENCOUNTER_KINDS.map((k) => [k, z.array(SectorEncounterEntrySchema).default([])]),
    ) as Record<EncounterKind, z.ZodDefault<z.ZodArray<typeof SectorEncounterEntrySchema>>>,
  )
  .default(() => emptyEncounterPools());

export type SectorEncounterPools = z.infer<typeof SectorEncounterPoolsSchema>;

const SectorSchema = z
  .object({
    id: z.string().min(1),
    title: prose(),
    description: z.string().min(1),
    length: z.number().int().positive(),
    theme: ThemeSchema,
    layouts: z.array(SectorLayoutEntrySchema).min(1),
    encounters: SectorEncounterPoolsSchema,
    events: z.array(SectorEventEntrySchema).default([]),
    startingEvents: z.array(SectorEventEntrySchema).default([]),
  })
  .superRefine((sector, ctx) => {
    // Guard 1 — every layout entry names a real layout or the sentinel.
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

    // Guard 2 — the layout pool is non-empty at every reachable hop, so the
    // board roll always has a candidate.
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

    // Guards 3 and 4 — every encounter-pool entry names a catalog encounter and
    // sits in the list of its kind (a boss cannot be pooled under `normal`).
    // Per kind, so an issue's path names the list.
    for (const kind of ENCOUNTER_KINDS) {
      sector.encounters[kind].forEach((entry, idx) => {
        const enc = getEncounter(entry.encounterId);
        if (!enc) {
          ctx.addIssue({
            code: 'custom',
            path: ['encounters', kind, idx, 'encounterId'],
            message: `sector "${sector.id}": unknown encounterId "${entry.encounterId}" (no such encounter in the catalog)`,
          });
        } else if (enc.kind !== kind) {
          ctx.addIssue({
            code: 'custom',
            path: ['encounters', kind, idx, 'encounterId'],
            message: `sector "${sector.id}": encounter "${entry.encounterId}" is kind '${enc.kind}', pooled under '${kind}'`,
          });
        }
      });
    }

    // Guard 5 — every event-pool entry, in both lists, names a catalog event.
    for (const listKey of ['events', 'startingEvents'] as const) {
      sector[listKey].forEach((entry, idx) => {
        if (!getEvent(entry.eventId)) {
          ctx.addIssue({
            code: 'custom',
            path: [listKey, idx, 'eventId'],
            message: `sector "${sector.id}": unknown eventId "${entry.eventId}" (no such event in the catalog)`,
          });
        }
      });
    }
  });

/** The whole-file schema, exported for the sector editor's round trip. */
export const SectorsSchema = z.array(SectorSchema).min(1);

export type SectorDef = z.infer<typeof SectorSchema>;

const SECTORS_LIST: readonly SectorDef[] = SectorsSchema.parse(sectorsJson);
// `title` is prose; `description` is editor metadata, never shown, and stays plain.
export const SECTORS_PROSE = loadProse('sectors', SectorsSchema, SECTORS_LIST);

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
 * The layout entries eligible at `hop`. The board roll draws from it, and the
 * schema guarantees it non-empty at every reachable hop.
 */
export function layoutPoolAtHop(sector: SectorDef, hop: number): readonly SectorLayoutEntry[] {
  return sector.layouts.filter((e) => (e.minHop ?? 0) <= hop);
}

/**
 * The entries of `sector.encounters[kind]` eligible at `hop`; selection passes
 * the node's kind (`encounterKindFor`).
 */
export function encounterPoolAtHop(
  sector: SectorDef,
  hop: number,
  kind: EncounterKind,
): readonly SectorEncounterEntry[] {
  return sector.encounters[kind].filter((e) => (e.minHop ?? 0) <= hop);
}

/**
 * The event entries eligible at `hop`. Run's entry roll filters them by each
 * event's `eligibility` against live run state, then draws one by cumulative
 * weight. Unlike the layout pool, an empty result is legal, since the node
 * becomes a fight, so events have no coverage check.
 */
export function eventPoolAtHop(sector: SectorDef, hop: number): readonly SectorEventEntry[] {
  return sector.events.filter((e) => (e.minHop ?? 0) <= hop);
}
