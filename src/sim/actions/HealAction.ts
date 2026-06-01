import type { Action, OrphanPolicy } from '../Action';
import type { Unit } from '../Unit';
import type { World } from '../World';

export const HEAL_ACTION_ID = 'heal';

export interface HealActionData {
  targetId: number;
  amount: number;
}

/**
 * E7.B — the healer's signature. A single-tick action (all work in
 * `start`, mirroring `AttackAction`) that ADDS HP to an ally rather than
 * subtracting it from an enemy. Restores `min(maxHp, currentHp + amount)`
 * and emits the existing `unit:healed` event — the same one D7's healing
 * tile fires — so the E6.C cyan `+N` hitsplat renders the heal with no new
 * render wiring. The emitted `amount` is the ACTUAL delta (clamped at
 * maxHp), and we emit even on a 0 delta so subscribers can debounce; the
 * hitsplat layer already skips `amount <= 0` (gotcha #80).
 *
 * F6 — feeds the World `utilityDone` ledger (`recordHealing`) with the
 * effective, clamped delta, the heal-side analogue of `AttackAction`'s
 * `recordDamage`. `computeXpAwards` then folds `xpPerHealing × healed`
 * into the healer's battle-end XP, so a pure support unit levels off its
 * contribution instead of being starved by the damage-only model. Only
 * the clamped delta is recorded, so healing a full-HP ally earns nothing.
 *
 * The dead-target guard mirrors `AttackAction`: a target that died earlier
 * in the same tick is skipped rather than resurrected. Serialization stores
 * `{ targetId, amount }` and resolves the unit via `world.findUnit` on
 * rehydrate (registered in `actions/registry.ts`).
 */
export class HealAction implements Action {
  readonly id = HEAL_ACTION_ID;
  // F2 — single-tick: heals the ally captured at cast, guarded if it died
  // earlier this tick. Phase list `[{impact,0},{recovery,D}]`; effect in
  // `start`. `targetCell` is omitted (heal isn't a line-of-sight shot).
  readonly orphanPolicy: OrphanPolicy = 'commit-at-cast';

  constructor(
    private readonly target: Unit | undefined,
    private readonly amount: number,
  ) {}

  start(unit: Unit, world: World): void {
    if (!this.target || this.target.currentHp <= 0) return;
    const before = this.target.currentHp;
    this.target.currentHp = Math.min(this.target.derived.maxHp, before + this.amount);
    const healed = this.target.currentHp - before;
    // F6: credit the caster's utility-contribution ledger with the
    // effective delta (World no-ops a 0). The tile chip-heal in
    // `applyTileEffects` deliberately does NOT call this — only ability
    // heals earn XP.
    world.recordHealing(unit.id, healed);
    // F5: tag the SOURCE with the caster id so the renderer can fire the
    // heal-sparkle for ability heals only (tile chip-heals emit `healerId:
    // null` and keep just the `+N`).
    world.emit('unit:healed', { unitId: this.target.id, amount: healed, healerId: unit.id });
  }

  phaseTarget(): { targetId?: number | undefined } {
    return { targetId: this.target?.id };
  }

  toData(): HealActionData {
    return {
      targetId: this.target?.id ?? -1,
      amount: this.amount,
    };
  }

  static fromData(data: HealActionData, world: World): HealAction {
    return new HealAction(world.findUnit(data.targetId), data.amount);
  }
}
