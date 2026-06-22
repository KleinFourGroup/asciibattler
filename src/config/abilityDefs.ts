/**
 * Phase Y1 — the data-driven ability definitions config (`config/abilityDefs.json`).
 *
 * The new home for the `AbilityDef` vocabulary (`src/sim/effects/schema.ts`),
 * mirroring how `config/abilities.ts` loads the legacy per-ability tunables.
 * During the Phase-Y strangler migration BOTH coexist: the hand-coded ability
 * classes keep reading `config/abilities.json`, while migrated verbs resolve
 * their `AbilityDef` here. At Phase Y5 — when the last verb migrates and the
 * legacy classes/config retire — this file is renamed to `config/abilities.ts`
 * (and `config/abilityDefs.json` → `config/abilities.json`), inheriting the
 * canonical name. Ships EMPTY; the catalog fills one verb at a time in Y3/Y4,
 * each entry proven byte-identical against the determinism oracle.
 *
 * A4 pattern: parse at module load, throw on malformed JSON. Entries are keyed
 * by id; each value re-declares its `id` (self-contained for the §30 editor +
 * the snapshot/round-trip path), and a key/id mismatch is a loud boot failure.
 */

import { z } from 'zod';
import abilityDefsJson from '../../config/abilityDefs.json';
import { AbilityDefSchema, type AbilityDef } from '../sim/effects/schema';

const AbilityDefsFileSchema = z.record(z.string(), AbilityDefSchema);

export const ABILITY_DEFS: Record<string, AbilityDef> = (() => {
  const parsed = AbilityDefsFileSchema.parse(abilityDefsJson);
  for (const [key, def] of Object.entries(parsed)) {
    if (def.id !== key) {
      throw new Error(
        `abilityDefs: entry keyed '${key}' declares id '${def.id}' — key and id must match`,
      );
    }
  }
  return parsed;
})();

/**
 * Resolve an ability definition by id, throwing if absent. The registry
 * boot-check (Phase Y2+) guarantees presence for every wired ability, so a throw
 * here means a caller passed an unregistered id — a programming error surfaced
 * loudly rather than silently defaulted (mirrors `abilityConfig`).
 */
export function abilityDef(id: string): AbilityDef {
  const def = ABILITY_DEFS[id];
  if (!def) {
    throw new Error(`abilityDef: no definition for ability id '${id}'`);
  }
  return def;
}
