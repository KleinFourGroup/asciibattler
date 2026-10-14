/**
 * The neutral camps. Source of truth at `config/camps.json`, a flat array.
 *
 * A camp is a fixed group of combatant units that spawns on team `neutral`
 * at a camp-spawn tile, wanders within `leashRadius` of it while passive,
 * and when struck turns hostile, the whole camp at once, toward the faction
 * that struck it. Killing the whole camp pays its `rewards`.
 *
 * Where a camp goes belongs to the placing side: a layout's `campSpawns`
 * tiles and weighted `camps` list (layouts.ts), or a theme's procedural
 * pool (`terrain.json#procedural.camps.pools`). A camp def holds only its
 * own content: roster, leash and rewards.
 *
 * `units` entries name combatant archetypes (`UNIT_DEFS`, the combatant-only
 * view): a camp unit is a combatant def spawned onto team `neutral`. The caps
 * on `count` and `leashRadius` catch typos; they are not design limits.
 */

import { z } from 'zod';
import campsJson from '../../config/camps.json';
import { UNIT_DEFS } from './units';
import { LAYOUTS, type LayoutDef, type CampRef } from './layouts';
import { TERRAIN } from './terrain';
import {
  EncounterRewardRefSchema,
  REWARD_TABLE_IDS,
  type EncounterRewardRef,
} from './rewards';
import type { Archetype } from '../sim/Unit';

// `UNIT_DEFS` is the combatant-only view, so a neutral def (a wall, rubble)
// is refused with no check of its own.
const ARCHETYPE_IDS = new Set(Object.keys(UNIT_DEFS));
const ArchetypeSchema = z.custom<Archetype>(
  (v) => typeof v === 'string' && ARCHETYPE_IDS.has(v),
  { message: 'unknown combatant archetype' },
);

/** Typo guard on one entry's `count`: a camp spawns through one tile, so a
 *  double-digit stack is almost surely a slip. */
export const CAMP_UNIT_MAX_COUNT = 8;

/** Typo guard on `leashRadius` — half the max layout side (32); a leash that
 *  spans the whole arena isn't a leash. */
export const CAMP_MAX_LEASH_RADIUS = 16;

export interface CampUnit {
  readonly archetype: Archetype;
  /** How many of this archetype spawn (default 1). */
  readonly count?: number;
  /** The spawned units' level (default 1). */
  readonly level?: number;
}

export interface CampDef {
  readonly id: string;
  readonly name: string;
  readonly description?: string;
  /** The Chebyshev radius around the camp's spawn tile that passive members
   *  wander within; the passive behaviour keeps its steps inside it. A
   *  hostile member in pursuit may leave it: the leash bounds idling, not
   *  retaliation. */
  readonly leashRadius: number;
  readonly units: readonly CampUnit[];
  /** Reward refs, in the encounter's `rewards` shape: rolled when the
   *  player kills the camp, and granted when the turn completes, whatever
   *  its outcome. Omitted, the camp pays nothing. */
  readonly rewards?: readonly EncounterRewardRef[];
}

// Cast at the zod boundary: `.optional()` emits `T | undefined`, which
// `exactOptionalPropertyTypes` refuses against exact-optional fields. The
// runtime check is the same.
const CampUnitSchema = z.object({
  archetype: ArchetypeSchema,
  count: z.number().int().positive().max(CAMP_UNIT_MAX_COUNT).optional(),
  level: z.number().int().positive().optional(),
}) as z.ZodType<CampUnit>;

const CampDefSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  description: z.string().min(1).optional(),
  leashRadius: z.number().int().positive().max(CAMP_MAX_LEASH_RADIUS),
  units: z.array(CampUnitSchema).min(1),
  rewards: z.array(EncounterRewardRefSchema).optional(),
}) as z.ZodType<CampDef>;

/** The whole-file schema, exported for the camp editor's round trip. An
 *  empty catalog is legal: a game without camps is coherent. */
export const CampsSchema = z.array(CampDefSchema);

const CAMPS_LIST: readonly CampDef[] = CampsSchema.parse(campsJson);

const seenIds = new Set<string>();
for (const camp of CAMPS_LIST) {
  if (seenIds.has(camp.id)) {
    throw new Error(`camps.json: duplicate camp id "${camp.id}"`);
  }
  seenIds.add(camp.id);
}

/**
 * Boot check: every camp reward ref names a real reward table. Its arguments
 * let a test pass synthetic catalogs; it runs below on the live ones.
 */
export function assertCampRewardRefs(
  camps: readonly CampDef[],
  tableIds: readonly string[],
): void {
  const ids = new Set(tableIds);
  for (const camp of camps) {
    for (const ref of camp.rewards ?? []) {
      if (!ids.has(ref.table)) {
        throw new Error(
          `camps.json: camp "${camp.id}" references unknown reward table "${ref.table}"`,
        );
      }
    }
  }
}

/**
 * Boot check for the layout side: every layout's `camps[].campId` resolves
 * in this catalog. It lives here because camps.ts imports layouts.ts and
 * never the reverse, so the check runs as soon as either loads through this
 * module.
 */
export function assertLayoutCampRefs(
  layouts: readonly LayoutDef[],
  campIds: readonly string[],
): void {
  const ids = new Set(campIds);
  for (const layout of layouts) {
    for (const ref of layout.camps ?? []) {
      if (!ids.has(ref.campId)) {
        throw new Error(
          `layouts.json: layout "${layout.id}" references unknown camp "${ref.campId}"`,
        );
      }
    }
  }
}

assertCampRewardRefs(CAMPS_LIST, REWARD_TABLE_IDS);

export const CAMPS: readonly CampDef[] = CAMPS_LIST;
export const CAMP_IDS: readonly string[] = CAMPS_LIST.map((c) => c.id);

const CAMPS_BY_ID: Record<string, CampDef> = {};
for (const camp of CAMPS_LIST) CAMPS_BY_ID[camp.id] = camp;

export function getCamp(id: string): CampDef | undefined {
  return CAMPS_BY_ID[id];
}

assertLayoutCampRefs(LAYOUTS, CAMP_IDS);

/**
 * Boot check for the procedural side: every camp in
 * `terrain.json#procedural.camps.pools` resolves in this catalog. camps.ts
 * imports terrain.ts, never the reverse.
 */
export function assertProceduralCampRefs(
  pools: Readonly<Record<string, readonly CampRef[]>>,
  campIds: readonly string[],
): void {
  const ids = new Set(campIds);
  for (const [theme, pool] of Object.entries(pools)) {
    for (const ref of pool) {
      if (!ids.has(ref.campId)) {
        throw new Error(
          `terrain.json: procedural camp pool for theme "${theme}" references unknown camp "${ref.campId}"`,
        );
      }
    }
  }
}

assertProceduralCampRefs(TERRAIN.procedural.camps.pools, CAMP_IDS);
