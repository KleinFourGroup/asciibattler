/**
 * The hand an encounter's turn draws. Each turn draws a hand from a deck
 * built off the roster, discards it after, and shuffles the discard back in
 * when the draw pile runs out. Only the hand fights that turn. Source of
 * truth at `config/deck.json`.
 *
 * - `handSize` — the cards a turn draws, the base of the `drawAmount` run
 *   stat. A roster no larger fields everyone, so the deck matters, and a
 *   redraw means anything, only once the roster outgrows the hand. Through
 *   `drawAmount` it is also the enemy budget's basis, the player's level
 *   being `avgLevel × min(rosterSize, hand)` (`src/run/enemyBudget.ts`),
 *   so the budget follows the hand that fights, not the roster. A change
 *   to it moves the difficulty band.
 * - `maxHandSize` — the most cards a hand holds. Larger hands favour the
 *   player, and a stack of draw grants has no other brake. It clamps inside
 *   `Run.effectiveDrawAmount`, so the deal and the enemy budget's basis
 *   stay the same number, and stops the `drawCards` packet op. A cap below
 *   `handSize` is legal and clamps the base deal.
 * - `grantQueue.passIsFinal` — on (shipped), the pre-turn grants resolve in
 *   the order they were gained: only the first pending one may fire, and
 *   `passGrant` finalizes it. Off, any pending grant fires in any order and
 *   `passGrant` does nothing. The engine enforces it, so the game and a
 *   headless run agree; `RunConfig.passIsFinal` overrides it per run.
 *
 * Redraws are granted by daemons (`grantRedraws`), each grant carrying its
 * own numbers; nothing here gates them.
 */

import { z } from 'zod';
import deckJson from '../../config/deck.json';

const DeckSchema = z.object({
  handSize: z.number().int().positive(),
  maxHandSize: z.number().int().positive(),
  grantQueue: z.object({
    passIsFinal: z.boolean(),
  }),
});

export type DeckConfig = z.infer<typeof DeckSchema>;

export const DECK: DeckConfig = DeckSchema.parse(deckJson);
