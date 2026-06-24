/**
 * The status-definition catalog (`config/statuses.json`) — the single source of
 * truth for every named status (`StatusDef`, `src/sim/effects/statusSchema.ts`).
 *
 * Mirrors the `config/abilities.json` / `AbilityDef` pair: parse at module load,
 * throw on malformed JSON (the A4 pattern). Entries are keyed by id; each value
 * re-declares its `id` (self-contained for the §30 editor + boot checks), and a
 * key/id mismatch is a loud boot failure.
 *
 * Ships EMPTY in 27a — Phase 27c authors burn / bleed / poison / rejuvenate. An
 * empty catalog still validates (no `applyStatus` ref exists to dangle, since
 * that op is reserved until §29), so `assertStatusRefsResolve` passes vacuously.
 */

import { z } from 'zod';
import statusesJson from '../../config/statuses.json';
import { StatusDefSchema, type StatusDef } from '../sim/effects/statusSchema';
import type { AbilityDef } from '../sim/effects/schema';

const StatusDefsFileSchema = z.record(z.string(), StatusDefSchema);

export const STATUS_DEFS: Record<string, StatusDef> = (() => {
  const parsed = StatusDefsFileSchema.parse(statusesJson);
  for (const [key, def] of Object.entries(parsed)) {
    if (def.id !== key) {
      throw new Error(
        `statuses: entry keyed '${key}' declares id '${def.id}' — key and id must match`,
      );
    }
  }
  return parsed;
})();

/**
 * Resolve a status definition by id, throwing if absent. Callers that have
 * already boot-validated their refs (the `applyStatus` op, §29; the tile→status
 * map, §27d) get a loud programming-error throw rather than a silent default.
 */
export function statusDef(id: string): StatusDef {
  const def = STATUS_DEFS[id];
  if (!def) {
    throw new Error(`statusDef: no definition for status id '${id}'`);
  }
  return def;
}

/**
 * Boot check (mirrors `assertAbilityDefCoverage` / `assertFxKeysResolve`): every
 * `applyStatus` op referenced anywhere in the ability catalog must name a status
 * that exists in the registry. A typo'd / dangling `statusId` fails at startup,
 * not silently at §29 cast time. Takes both maps as args (so this module never
 * imports `config/abilities.ts` — the ability registry wires the call, keeping
 * the dependency one-way and cycle-free). Vacuous today: no ability authors an
 * `applyStatus` op until §29.
 */
export function assertStatusRefsResolve(
  abilityDefs: Record<string, AbilityDef>,
  statusDefs: Record<string, StatusDef>,
): void {
  for (const def of Object.values(abilityDefs)) {
    for (const entry of def.effects) {
      if (entry.op.kind === 'applyStatus' && !(entry.op.statusId in statusDefs)) {
        throw new Error(
          `ability '${def.id}': applyStatus references unknown status id '${entry.op.statusId}'`,
        );
      }
    }
  }
}
