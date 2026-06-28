/**
 * The ability-definition catalog (`config/abilities.json`) — the single source
 * of truth for every combat verb's data (`AbilityDef`, `src/sim/effects/schema.ts`).
 *
 * Phase-Y history: this began as `config/abilityDefs.json` during the strangler
 * migration, coexisting with the legacy hand-coded `config/abilities.ts`
 * (`AbilityConfig`) while verbs migrated one at a time. Y5e retired that legacy
 * pair and renamed this catalog to the canonical `config/abilities.json` — every
 * verb is now a data-driven `AbilityDef`, so there is exactly one ability config.
 *
 * A4 pattern: parse at module load, throw on malformed JSON. Entries are keyed
 * by id; each value re-declares its `id` (self-contained for the §30 editor +
 * the snapshot/round-trip path), and a key/id mismatch is a loud boot failure.
 */

import { z } from 'zod';
import abilitiesJson from '../../config/abilities.json';
import {
  AbilityDefSchema,
  type AbilityDef,
  type DamageOp,
  type HealOp,
  type EffectOp,
} from '../sim/effects/schema';

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

/**
 * Resolve an ability definition by id, throwing if absent. The registry
 * boot-check guarantees presence for every wired ability, so a throw here means a
 * caller passed an unregistered id — a programming error surfaced loudly rather
 * than silently defaulted.
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
 * heal or a movement verb). Mirrors the retired `attackConfig` accessor's intent
 * — a typed, kind-narrowed read for the display surfaces (UnitCard / the editor)
 * and the balance-proof tests, which key off the damage profile (`might` /
 * `accuracy` / `critBase` + the evadable/critable gates).
 */
export function damageOpOf(id: string): DamageOp | undefined {
  const entry = abilityDef(id).effects.find((e) => e.op.kind === 'damage');
  return entry && entry.op.kind === 'damage' ? entry.op : undefined;
}

/** The first `heal` op of an ability, or undefined (mirrors the retired `healConfig`). */
export function healOpOf(id: string): HealOp | undefined {
  const entry = abilityDef(id).effects.find((e) => e.op.kind === 'heal');
  return entry && entry.op.kind === 'heal' ? entry.op : undefined;
}

/**
 * 34b — the first op of `kind` on an ability, kind-narrowed (the generic sibling
 * of `damageOpOf`/`healOpOf`). The §29 display surfaces (UnitCard, the editor)
 * read the `applyStatus` / `summon` / `chain` ops through this to render a detail
 * line. Pure — reads off the parsed def, no sim state.
 */
export function firstOpOf<K extends EffectOp['kind']>(
  id: string,
  kind: K,
): Extract<EffectOp, { kind: K }> | undefined {
  const entry = abilityDef(id).effects.find((e) => e.op.kind === kind);
  return entry ? (entry.op as Extract<EffectOp, { kind: K }>) : undefined;
}
