/**
 * Phase Y3 — the single generic `Ability` backing every migrated combat verb.
 * Where the legacy model had one class per verb (`MeleeStrike` / `RangedShot` /
 * `HealAlly` / `GambitStrike` / `DashAbility`), the data-driven model has ONE
 * ability class that wraps an `AbilityDef` and delegates to the propose bridge —
 * the verbs differ only in their DATA. The ability registry constructs one per
 * migrated id (`new EffectAbility(abilityDef(id))`).
 *
 * Stateless (the def is immutable, the per-tick proposal is derived live), so —
 * like the legacy abilities — a single instance per unit suffices and `World`
 * rehydrates it from the unit's ability-id list, not from serialized state.
 */

import type { Ability } from '../abilities/Ability';
import type { Unit } from '../Unit';
import type { World } from '../World';
import type { ActionProposal } from '../Action';
import type { AbilityDef } from './schema';
import { proposeEffectAbility } from './propose';

export class EffectAbility implements Ability {
  readonly id: string;

  constructor(private readonly def: AbilityDef) {
    this.id = def.id;
  }

  propose(unit: Unit, world: World): ActionProposal | null {
    return proposeEffectAbility(this.def, unit, world);
  }
}
