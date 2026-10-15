/**
 * The `Ability` behind every ability def: it wraps one `AbilityDef` and hands
 * proposing to `proposeEffectAbility` (`propose.ts`), so abilities differ only
 * in their data. The ability registry builds one per def id.
 *
 * Stateless: the def is immutable and each proposal is derived live, so
 * `World` rehydrates a unit's abilities from its list of ids, with no
 * serialized state.
 */

import type { Ability } from '../abilities/Ability';
import type { Unit } from '../Unit';
import type { World } from '../World';
import type { ActionProposal } from '../Action';
import type { AbilityDef, Aura } from './schema';
import { proposeEffectAbility } from './propose';

export class EffectAbility implements Ability {
  readonly id: string;
  /** Copied from the def; documented on `Ability`. */
  readonly ignoresLineOfSight?: boolean;
  /** Copied from the def; documented on `Ability`. */
  readonly aura?: Aura;

  constructor(private readonly def: AbilityDef) {
    this.id = def.id;
    // Set only when the def has it: `exactOptionalPropertyTypes` forbids
    // assigning `undefined` to an optional field.
    if (def.ignoresLineOfSight) this.ignoresLineOfSight = def.ignoresLineOfSight;
    if (def.aura) this.aura = def.aura;
  }

  propose(unit: Unit, world: World): ActionProposal | null {
    return proposeEffectAbility(this.def, unit, world);
  }
}
