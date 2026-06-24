import type { Behavior, Unit } from '../Unit';
import type { World } from '../World';
import type { ActionProposal } from '../Action';
import { behaviorFlags } from '../statusBehavior';

/**
 * E2 — replaces the pre-E2 `AttackBehavior`. Polls every entry in
 * `unit.abilities`, returns the highest-scoring proposal. Abstains
 * (returns null) when every ability abstains (no target in range, LOS
 * broken, etc.).
 *
 * **Scoring.** Per the E2 design call, each `Ability.propose` decides
 * its own score (basic strikes return 10; future abilities can return
 * context-dependent values). Ties resolved by config order — the first
 * matching ability in `unit.abilities` wins because the loop here uses
 * a strict-`>` comparison against `best.score`. Movement stays at 1 in
 * `MovementBehavior`, so the selector always prefers any firing
 * ability over a step.
 *
 * **Cooldown isolation.** Each proposal carries `cooldownKey:
 * ability.id` (set by the ability itself); the selector in `World.tick`
 * keys `unit.actionCooldowns` on that. Multi-ability units (E7) get
 * independent cooldowns per ability even when several wrap the same
 * `AttackAction` primitive — the per-ability cd lookup happens
 * INSIDE this scoring loop, not just in the outer selector, so a
 * just-fired ability is filtered out before scoring.
 *
 * **Stateless.** Same contract as the other behaviors: safe to share an
 * instance across units, though `World.fromJSON` creates one per unit
 * for symmetry with future stateful behaviors. Registry key matches
 * the class id ('ability').
 */
export class AbilityBehavior implements Behavior {
  static readonly kind = 'ability';
  readonly kind = AbilityBehavior.kind;

  proposeAction(unit: Unit, world: World): ActionProposal | null {
    // 28 — frozen / panic: the action-selector skips this unit's attacks
    // entirely (a decision-hook off its effects; blind does NOT set this, so a
    // blinded unit still strikes whatever adjacent foe `Targeting` left it).
    if (behaviorFlags(unit.effects).preventsAttack) return null;

    let best: ActionProposal | null = null;
    for (const ability of unit.abilities) {
      const proposal = ability.propose(unit, world);
      if (proposal === null) continue;
      // Per-ability cooldown filter. Without this, two abilities sharing
      // the same `Action.id` (e.g. melee_strike + cleave_strike both
      // wrap AttackAction) would race: the outer selector's
      // `cooldownKey` lookup filters by ability id, but only after
      // scoring — so a just-fired ability could "win" the score loop
      // here and then be filtered out below, leaving the unit idle
      // while a slower-scoring sibling was ready.
      const key = proposal.cooldownKey ?? proposal.action.id;
      const remaining = unit.actionCooldowns.get(key) ?? 0;
      if (remaining > 0) continue;
      if (best === null || proposal.score > best.score) best = proposal;
    }
    return best;
  }
}
