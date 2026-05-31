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
 * No `recordDamage` / XP ledger entry: XP is damage-based, so a heal grants
 * the healer no XP beyond the flat survivor/fallen slice. (A heal-XP axis
 * is a deliberate future-phase concern, not E7.B.)
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

  start(_unit: Unit, world: World): void {
    if (!this.target || this.target.currentHp <= 0) return;
    const before = this.target.currentHp;
    this.target.currentHp = Math.min(this.target.derived.maxHp, before + this.amount);
    const healed = this.target.currentHp - before;
    world.emit('unit:healed', { unitId: this.target.id, amount: healed });
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
