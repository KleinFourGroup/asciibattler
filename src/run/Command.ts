/**
 * The run's commands: every player intent the UI sends a run goes through a
 * `RunDispatcher` as one of these, never through a bus event.
 *
 * The UI holds a dispatcher rather than the `Run`, because a reset replaces
 * the `Run` (`Game.resetRun`) and a screen that kept the old one would send
 * to a run that is gone. `Game` is the dispatcher, and reads its live run at
 * each dispatch.
 *
 * `Run` applies a command at once, unlike `World.tick`, which drains its
 * queue at a tick boundary: a run is not driven by ticks.
 *
 * Every command is checked before anything changes, and one that is out of
 * its phase, names a bad index, or cannot be paid for is a silent no-op.
 */

import type { UnitTemplate } from '../sim/Unit';

export type RunCommand =
  | { readonly kind: 'enterNode'; readonly nodeId: number }
  | { readonly kind: 'chooseRecruit'; readonly unitTemplate: UnitTemplate }
  /**
   * Decline the recruit offer: the roster and deck are untouched and the run
   * goes back to 'map'. Always allowed and free, so the cost of passing is
   * the deck diluting without it, weak for the first recruit or two and
   * growing as the roster outgrows the hand.
   */
  | { readonly kind: 'passRecruit' }
  /**
   * Dismiss the promotion screen. In an encounter the run goes on from the
   * turn's result (the recruit offer, or `run:victory` at the terminal) only
   * once this lands, so the pause between banking the XP and the offer is
   * the screen the player is reading; after a rest it returns to 'map'.
   */
  | { readonly kind: 'dismissPromotion' }
  /**
   * Dismiss the sector-cleared screen. The sector already advanced in
   * `advanceSector`; this returns the run to 'map' on the new sector, before
   * its root. Only in the `sectorCleared` phase.
   */
  | { readonly kind: 'dismissSectorCleared' }
  /**
   * Leave a port. The run holds in the saved `port` phase from `enterNode`
   * on a port until this lands, then returns to 'map'; the hop was spent on
   * entry, so the frontier advances from the port. Only in the `port` phase.
   */
  | { readonly kind: 'leavePort' }
  /**
   * Buy the stocked unit at `index` in `Run.portStock.units`: spends the
   * slot's price, which the stock rolled with a jitter, through `spendBits`,
   * adds the unit by the roster path a recruit takes, and marks the slot
   * sold. Only in the `port` phase, on an unsold slot the player can afford.
   */
  | { readonly kind: 'buyPortUnit'; readonly index: number }
  /**
   * Buy the stocked packet at `index` in `Run.portStock.packets`. With the
   * cache full, `swapCacheIndex` names the held packet to discard, as for
   * `acceptReward`; the price is checked before that discard, so a buy that
   * cannot be paid loses nothing.
   */
  | {
      readonly kind: 'buyPortPacket';
      readonly index: number;
      readonly swapCacheIndex?: number;
    }
  /**
   * Buy the stocked daemon at `index` in `Run.portStock.daemons`. The stock
   * left out owned daemons when it rolled, so a duplicate cannot be bought.
   */
  | { readonly kind: 'buyPortDaemon'; readonly index: number }
  /**
   * Sell a held packet at a port (`cacheIndex` in `Run.cache`): discards it
   * and refunds `⌊buy price × sellFraction⌋` through the raw `addBits`, not
   * `gainBits`, since a bits-gain fold above `1 / sellFraction` would make
   * buying and selling an endless source of bits.
   */
  | { readonly kind: 'sellPacket'; readonly cacheIndex: number }
  /**
   * The port's removal service: spends the flat `unitRemovalPrice`, then
   * removes `rosterIndex` through `removeRosterUnit`, the one place a roster
   * unit is removed. Only in the `port` phase, and never the last unit.
   */
  | { readonly kind: 'payToRemoveUnit'; readonly rosterIndex: number }
  /**
   * Accept one pending reward portion (`index` in `Run.pendingRewards`).
   * Bits settle through `gainBits`, so the fold applies as it is accepted; a
   * daemon is owned at once. Only in the `reward` phase. Resolving the last
   * portion goes on to the next gate (the promotion, then the recruit offer
   * or victory).
   */
  | {
      readonly kind: 'acceptReward';
      readonly index: number;
      /** For a packet portion when the cache is full: the held packet to
       *  discard first. Ignored when the cache has room; a full-cache accept
       *  without a valid one does nothing and leaves the offer as it was. */
      readonly swapCacheIndex?: number;
    }
  /**
   * Decline one pending reward portion; each portion may be declined on its
   * own. Checked as `acceptReward` is.
   */
  | { readonly kind: 'declineReward'; readonly index: number }
  /**
   * Advance past a turn gate. From `turn-intro` it starts the turn's battle;
   * the pre-turn screen sends it on Fight. From `turn-outcome` it goes on to
   * the next turn or ends the encounter; no screen shows that gate, and
   * `Game` sends the advance itself after the battle's outro (the fuzz bot
   * sends it directly). The run enters these phases only with
   * `Run.pauseAtTurnGates` on, so a headless loop has no gate to advance.
   */
  | { readonly kind: 'advanceTurn' }
  /**
   * Redraw picked hand cards at the pre-turn gate: they go to the discard
   * and as many are drawn into their places, by the deck's usual reshuffle.
   * `handIndices` are positions in the current hand, not roster indices.
   * `grantIndex` names one redraw grant in the turn's queue, which in strict
   * mode must be the active one. Only in `turn-intro`, within that grant's
   * budget. Emits `turn:handRedrawn`.
   */
  | {
      readonly kind: 'redrawCards';
      readonly handIndices: readonly number[];
      readonly grantIndex: number;
    }
  /**
   * Empower a drawn card at the pre-turn gate: its roster slot gains the
   * granting source's buff for the rest of the encounter, in the encounter
   * effect store, which re-seeds it onto the unit every turn, so it outlasts
   * the card being redrawn away or benched. `handIndex` is a position in the
   * current hand, as for `redrawCards`. Only in `turn-intro`, within the
   * grant's budget. Emits `turn:unitEmpowered`.
   */
  | {
      readonly kind: 'empowerUnit';
      readonly handIndex: number;
      /** The grant, an index in the turn's grant queue (`Run.grantViews()`);
       *  strict mode requires the active one. */
      readonly grantIndex: number;
    }
  /**
   * Close the active grant unspent (the guided strip's Pass). It does
   * something only in strict mode (`passIsFinal`, from
   * `config/deck.json`'s `grantQueue` unless the run config overrides it);
   * in free mode it does nothing. It takes no index: it closes the first
   * pending grant. Emits `turn:grantPassed`.
   */
  | { readonly kind: 'passGrant' }
  /**
   * Discard one held packet (`cacheIndex` in `Run.cache`), at will, or one
   * of the drops when the cache shrinks below what it holds (the modal sends
   * one for each). Allowed in any phase, since the cache is run state with
   * no part in the sim and its modal opens on every screen. Emits
   * `run:cacheChanged`.
   */
  | { readonly kind: 'discardPacket'; readonly cacheIndex: number }
  /**
   * Use a held packet (`cacheIndex` in `Run.cache`). The context follows the
   * phase, `preTurn` in `turn-intro` and `outOfBattle` in `map`, and the
   * packet's `usableIn` must allow it. A packet that targets a unit takes
   * `handIndex` in `preTurn` (a position in the current hand) or
   * `rosterIndex` in `outOfBattle` (a `Run.team` slot); the other field is
   * ignored, and a missing or invalid one rejects. A use spends the packet
   * at once, with no undo. Emits `run:cacheChanged` and `run:packetUsed`.
   */
  | {
      readonly kind: 'usePacket';
      readonly cacheIndex: number;
      readonly handIndex?: number;
      readonly rosterIndex?: number;
    }
  /**
   * Take a choice on the active event page (`choiceIndex` in
   * `Run.currentEventPage().choices`), if its condition holds. The choice's
   * weighted outcome takes one draw from the event stream, keyed per choice
   * taken, which its effects then draw from as well. Then `next`: a page id
   * moves to that page (`event:pageChanged`), `return-to-map` returns to
   * 'map', and `start-encounter` closes the event and opens the named fight,
   * with its reward refs pinned if the event gives them.
   */
  | { readonly kind: 'chooseEventOption'; readonly choiceIndex: number }
  /**
   * Take an option at the rest gate: the run holds in the saved `rest` phase
   * from `enterNode` on a rest node until this lands. Option 0, the only one,
   * is the rest itself: the pool heals, every unit banks the rest's XP, and
   * the run goes to 'promotion' if anyone levelled, else back to 'map'. Any
   * other index does nothing. Draws nothing.
   */
  | { readonly kind: 'chooseRestOption'; readonly optionIndex: number }
  | { readonly kind: 'resetRun' }
  /**
   * Confirm the starting character on the character-select screen. `Game`
   * handles it, as it does `resetRun`: it constructs the `Run`, since the
   * choice comes before the run exists, so a `Run` sees it only if
   * misrouted, and ignores it. `characterId` is an id in
   * `config/characters.json`, which `Game` checks loudly. `escalation` is
   * the Escalation level picked with the character (0 is off); `Game` holds
   * it to the character's ceiling before making the run
   * (`levelWithinCeiling`, `src/store/progress.ts`), so a level past the
   * ceiling starts the run at the ceiling, and one that is not a whole
   * number of at least 0 starts it at 0.
   */
  | { readonly kind: 'chooseCharacter'; readonly characterId: string; readonly escalation: number };

export interface RunDispatcher {
  dispatch(command: RunCommand): void;
}
