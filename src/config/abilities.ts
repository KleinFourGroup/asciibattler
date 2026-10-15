/**
 * The ability catalog, `config/abilities.json`: every combat verb's data
 * (`AbilityDef`, `src/sim/effects/schema.ts`). Entries are keyed by id, and
 * each repeats its `id` so it stands alone in the editor and in a snapshot;
 * a key that differs from its id fails at boot.
 */

import { z } from 'zod';
import abilitiesJson from '../../config/abilities.json';
import {
  AbilityDefSchema,
  type AbilityDef,
  type DamageOp,
  type HealOp,
} from '../sim/effects/schema';

import { loadProse } from '../i18n/locale';

const AbilityDefsFileSchema = z.record(z.string(), AbilityDefSchema);

export const ABILITY_DEFS: Record<string, AbilityDef> = (() => {
  const parsed = AbilityDefsFileSchema.parse(abilitiesJson);
  for (const [key, def] of Object.entries(parsed)) {
    if (def.id !== key) {
      throw new Error(
        `abilities: entry keyed '${key}' declares id '${def.id}' — key and id must match`,
      );
    }
  }
  return parsed;
})();

// `name` is prose, addressed as `abilities.<id>.name`.
export const ABILITIES_PROSE = loadProse('abilities', AbilityDefsFileSchema, ABILITY_DEFS);

/**
 * Resolve an ability definition by id, throwing if absent. The registry's
 * boot check covers every wired ability, so a throw means a caller passed an
 * unregistered id, a programming error.
 */
export function abilityDef(id: string): AbilityDef {
  const def = ABILITY_DEFS[id];
  if (!def) {
    throw new Error(`abilityDef: no definition for ability id '${id}'`);
  }
  return def;
}

/**
 * The first `damage` op of an ability, or undefined when it has none (a pure
 * heal or a movement verb): a typed read for the display surfaces (UnitCard,
 * the editor) and the balance tests, which key off the damage profile
 * (`might`, `accuracy`, `critBase`, and the evadable and critable gates).
 */
export function damageOpOf(id: string): DamageOp | undefined {
  const entry = abilityDef(id).effects.find((e) => e.op.kind === 'damage');
  return entry && entry.op.kind === 'damage' ? entry.op : undefined;
}

/** The first `heal` op of an ability, or undefined. */
export function healOpOf(id: string): HealOp | undefined {
  const entry = abilityDef(id).effects.find((e) => e.op.kind === 'heal');
  return entry && entry.op.kind === 'heal' ? entry.op : undefined;
}
