/**
 * Decision interface for headless run drivers. A strategy decides:
 *   - which frontier node to enter from the map screen, and
 *   - which recruit to take from the post-victory offer.
 *
 * Both methods receive a read-only view of the live `Run` so a strategy
 * can inspect team composition, current hop, etc. They must be pure
 * w.r.t. the supplied RNG — that's the determinism contract: same seed
 * + same strategy → same decisions every run. Strategies don't call
 * `run.dispatch`; the harness owns the channel and consumes returned
 * decisions.
 *
 * Future: a `pickBattleCommand` method will join these once C5 fills in
 * `WorldCommand`. Keeping the interface minimal now means harness code
 * doesn't carry a placeholder shape.
 */

import type { RNG } from '../../src/core/RNG';
import type { Run, PortStock } from '../../src/run/Run';
import type { UseContext } from '../../src/config/packets';
import type { UnitTemplate } from '../../src/sim/Unit';

/** 59a — one port-purchase proposal: which stock lane + slot to buy. */
export interface PortBuy {
  readonly kind: 'daemon' | 'unit' | 'packet';
  readonly index: number;
}

/** 59a — one packet-fire proposal (the `usePacket` command minus its kind;
 *  `handIndex` targets a hand position at `preTurn`, `rosterIndex` a team
 *  slot at `outOfBattle` — the 49e targeting contract). */
export interface PacketFire {
  readonly cacheIndex: number;
  readonly handIndex?: number;
  readonly rosterIndex?: number;
}

export interface FuzzStrategy {
  readonly name: string;
  pickNextNode(frontier: readonly number[], run: Run, rng: RNG): number;
  /**
   * Offer index to recruit, or `null` to PASS (H6b — decline the offer).
   * The harness dispatches `passRecruit` on `null`. Existing policies never
   * return `null`, so their draw sequences (and fuzz baselines) are unchanged.
   */
  pickRecruit(offer: readonly UnitTemplate[], run: Run, rng: RNG): number | null;
  /**
   * 59a — OPTIONAL port-purchase decision, asked repeatedly while docked
   * (ask-until-null, the grant-walk idiom): each call proposes ONE buy, the
   * harness dispatches it and asks again against the mutated stock/bits;
   * `null` stops buying and undocks. A proposal that doesn't land (sold /
   * unaffordable / cache full) breaks the loop — never spin. ABSENT = the
   * hardwired 50g buy-all-affordable policy (daemons → units →
   * packets-if-room, slot order); the fixed-policy anchor arms never define
   * this, so their draw sequences and the fuzz baselines are untouched.
   */
  pickPortBuy?(stock: PortStock, run: Run, rng: RNG): PortBuy | null;
  /**
   * 59a — OPTIONAL packet-fire decision, asked ask-until-null at the two
   * legal fire sites (the 49e context contract): `preTurn` (the turn-intro
   * gate — DEFINING this method flips `pauseAtTurnGates` ON, riding the
   * H4b-aligned gated path) and `outOfBattle` (the map screen, before the
   * node pick). Each call proposes one `usePacket`; a rejected dispatch
   * (cache length unchanged) breaks the loop. ABSENT = packets never fire —
   * the pre-§59 harness behavior, and the anchor arms' permanent policy.
   */
  pickPacketFire?(context: UseContext, run: Run, rng: RNG): PacketFire | null;
}
