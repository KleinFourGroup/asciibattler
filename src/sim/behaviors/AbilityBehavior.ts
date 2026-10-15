import type { Behavior, Unit } from '../Unit';
import type { World } from '../World';
import type { ActionProposal } from '../Action';
import { behaviorFlags } from '../statusBehavior';

/**
 * Polls every entry in `unit.abilities` and returns the highest-scoring
 * proposal that is off cooldown. Abstains (returns null) when every ability
 * abstains or is cooling down, or when a status forbids attacking.
 *
 * Scoring: each ability scores its own proposal (`Ability`). On a tie the
 * earlier entry in `unit.abilities` wins, which is the archetype's config
 * order, because the loop replaces `best` only on a strictly higher score.
 * Movement proposals score low (a step or wait 1, a threatened support
 * unit's retreat 5), so a ready ability wins over them; the exception is the
 * yield swap (`YIELD_SWAP_SCORE` in `movement.ts`), scored above an attack by
 * design.
 *
 * Cooldowns: the selector in `World.tick` keys `unit.actionCooldowns` on a
 * proposal's `cooldownKey`, the ability's id, and this loop checks the same
 * key before scoring.
 *
 * Stateless, like the other behaviors: one instance could serve every unit,
 * though `World.fromJSON` creates one per unit. Its registry key is
 * `'ability'`.
 */
export class AbilityBehavior implements Behavior {
  static readonly kind = 'ability';
  readonly kind = AbilityBehavior.kind;

  proposeAction(unit: Unit, world: World): ActionProposal | null {
    // A `preventsAttack` status (frozen, panic) stops every ability, heals
    // included. Blind does not set it, so a blinded unit still strikes the
    // adjacent foe `Targeting` left it.
    if (behaviorFlags(unit.effects).preventsAttack) return null;

    let best: ActionProposal | null = null;
    for (const ability of unit.abilities) {
      const proposal = ability.propose(unit, world);
      if (proposal === null) continue;
      // The selector sees only the proposal returned here, so a just-fired
      // ability that won this loop would be dropped by its cooldown check,
      // leaving the unit no ability that tick while a lower-scoring sibling
      // was ready.
      const key = proposal.cooldownKey ?? proposal.action.id;
      const remaining = unit.actionCooldowns.get(key) ?? 0;
      if (remaining > 0) continue;
      if (best === null || proposal.score > best.score) best = proposal;
    }
    return best;
  }
}
