/**
 * The status catalog, `config/statuses.json`: every named status
 * (`StatusDef`, `src/sim/effects/statusSchema.ts`). As in the ability
 * catalog, entries are keyed by id and each repeats its `id`; a key that
 * differs from its id fails at boot.
 */

import { z } from 'zod';
import statusesJson from '../../config/statuses.json';
import { StatusDefSchema, type StatusDef } from '../sim/effects/statusSchema';
import type { AbilityDef } from '../sim/effects/schema';

import { loadProse } from '../i18n/locale';

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

// `name` is prose, addressed as `statuses.<id>.name`.
export const STATUSES_PROSE = loadProse('statuses', StatusDefsFileSchema, STATUS_DEFS);

/**
 * Resolve a status definition by id, throwing if absent. Its callers check
 * their refs at boot (the `applyStatus` op, auras, a tile's status), so a
 * throw is a programming error rather than a silent default.
 */
export function statusDef(id: string): StatusDef {
  const def = STATUS_DEFS[id];
  if (!def) {
    throw new Error(`statusDef: no definition for status id '${id}'`);
  }
  return def;
}

/**
 * Boot check: every status the ability catalog names exists, so a typo fails
 * at startup rather than at cast time. It takes both maps as arguments so
 * this module never imports `config/abilities.ts`; the ability registry wires
 * the call, which keeps the dependency one-way.
 */
export function assertStatusRefsResolve(
  abilityDefs: Record<string, AbilityDef>,
  statusDefs: Record<string, StatusDef>,
): void {
  const check = (statusId: string, defId: string): void => {
    if (!(statusId in statusDefs)) {
      throw new Error(`ability '${defId}': references unknown status id '${statusId}'`);
    }
  };
  for (const def of Object.values(abilityDefs)) {
    for (const entry of def.effects) {
      if (entry.op.kind === 'applyStatus') check(entry.op.statusId, def.id);
      // A chain op carries its own inner `applyStatus` ops (a stun on each
      // hop). One level is the full depth, since an inner op cannot be a chain.
      if (entry.op.kind === 'chain') {
        for (const inner of entry.op.ops) {
          if (inner.kind === 'applyStatus') check(inner.statusId, def.id);
        }
      }
    }
    // An aura's status is looked up at tick time (`applyAuraStatuses`, through
    // the throwing `statusDef`), so it is checked here, before a carrier spawns.
    if (def.aura) check(def.aura.statusId, def.id);
  }
}
