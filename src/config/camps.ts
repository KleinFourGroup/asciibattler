/**
 * §75a — the **Camp** schema: a pre-defined neutral camp (the cluster-5-spec
 * "Camps — LOCKED" shapes). A camp is a fixed GROUP of combatant units that
 * spawns onto `team: 'neutral'` at a layout's camp-spawn tile, wanders within
 * `leashRadius` of it while passive, and turns hostile (camp-wide, per
 * attacking faction) when struck. Killing the whole camp rolls its reward
 * refs — granted at turn completion win-or-lose (the 51a portion rule).
 *
 * Source of truth at `config/camps.json` — a flat array (the encounters.json
 * form; the 75i camp editor copies the encounter-editor shape). The two
 * shipped defs are SMOKE content for tests/editors: no shipped layout lists a
 * camp until the §75j demo-catalog design round deliberately places them
 * (presence-gating — the byte-identity exit gate).
 *
 * Placement lives on the LAYOUT (`campSpawns` tiles + a weighted `camps`
 * list — see layouts.ts), mirroring the sector-owns-both eligibility split:
 * a camp def owns only its intrinsic content (roster, leash, rewards).
 *
 * `units` entries reference COMBATANT archetypes (validated against
 * `UNIT_DEFS`, the combatant-only view — a camp unit is a combatant def
 * spawned onto team 'neutral', per the §75 kickoff audit; the strict
 * `NeutralUnitDefSchema` arm stays untouched). `count` (default 1) and
 * `level` (default 1) are typo-guard-capped, not design-capped.
 */

import { z } from 'zod';
import campsJson from '../../config/camps.json';
import { UNIT_DEFS } from './units';
import { LAYOUTS, type LayoutDef } from './layouts';
import {
  EncounterRewardRefSchema,
  REWARD_TABLE_IDS,
  type EncounterRewardRef,
} from './rewards';
import type { Archetype } from '../sim/Unit';

// Combatant-archetype validation (the encounters.ts pattern): `UNIT_DEFS` is
// the combatant-only catalog view, so neutral defs (wall / rubble / …) are
// rejected for free.
const ARCHETYPE_IDS = new Set(Object.keys(UNIT_DEFS));
const ArchetypeSchema = z.custom<Archetype>(
  (v) => typeof v === 'string' && ARCHETYPE_IDS.has(v),
  { message: 'unknown combatant archetype' },
);

/** Typo guard on a single entry's `count` — a camp drips through ONE tile, so
 *  double-digit stacks are almost certainly a slip, not a design. */
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
  /** Chebyshev radius around the camp's spawn tile that PASSIVE members
   *  wander within (the 75f behavior filters candidate steps to it). A
   *  hostile member pursuing may leave it — the leash bounds idling, not
   *  retaliation. */
  readonly leashRadius: number;
  readonly units: readonly CampUnit[];
  /** Reward refs (the encounter `rewards` shape): rolled when the camp is
   *  killed BY THE PLAYER, granted at turn completion regardless of the
   *  turn's outcome (75g). Omitted = the camp pays nothing. */
  readonly rewards?: readonly EncounterRewardRef[];
}

// Cast at the zod boundary (the encounters.ts StageSchema note): `.optional()`
// emits `T | undefined`, which `exactOptionalPropertyTypes` rejects against
// exact-optional fields. Runtime validation is identical.
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

/** The whole-file array schema (exported for the 75i editor's formatter
 *  round-trip). An EMPTY catalog is legal — a camp-free game is coherent. */
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
 * Boot check (the `assertEncounterRewardRefs` sibling): every camp reward ref
 * must name a real reward table. Args-injected for synthetic tests;
 * self-wired below with the live catalogs.
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
 * Boot check for the LAYOUT side of the seam: every layout `camps[].campId`
 * must resolve in this catalog. Lives here (import direction camps → layouts,
 * cycle-free — layouts.ts never imports camps.ts) so the referential check
 * runs the moment either file loads through this module.
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
