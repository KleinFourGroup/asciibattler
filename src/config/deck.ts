/**
 * H5 — deck knobs for the card-drawn hand.
 *
 * An encounter's turns each draw a HAND from a deck built off the roster
 * (draw → hand → discard, reshuffle the discard back in when the draw pile
 * empties). Only the drawn hand fights that turn; the rest sit out.
 *
 * - `handSize` — target cards per turn. Capped by the roster size (a roster
 *                smaller than `handSize` just fields everyone). The deck "turns
 *                on" once the roster outgrows it: K2 raised the starting roster
 *                (10) above `handSize` (6), so draw variance + deck dilution are
 *                live from the FIRST encounter (no longer the H5 "cliff", where
 *                roster == handSize kept the deck dormant until the first
 *                recruit). Redraw (K3) needs this overdraw to mean anything.
 *
 * Also the second half of the G4 difficulty seam: `playerTeamLevel` (in
 * `src/run/enemyBudget.ts`) is `avgLevel × min(rosterSize, handSize)`. With the
 * K2 roster (10) > `handSize` (6) the `min` is pinned at `handSize`, so the
 * enemy budget tracks the *expected hand* level, not the whole roster — and
 * raising `handSize` (5→6) is what moved the band, not the roster bump.
 *
 * K3 — `redraw`: the pre-turn redraw knobs. On the pre-turn screen the player
 * selects drawn cards, sends them to the discard, and draws that many fresh
 * (`Run.handleRedrawCards`). Two dials, BOTH enforced per turn, so Phase L's
 * daemons can express either gating mode without new plumbing:
 *
 * - `redrawsPerTurn`   — redraw ACTIONS allowed per turn. The shipped default
 *                        (1) is the "one batch per turn" mode.
 * - `maxCardsPerTurn`  — total CARDS redrawn per turn across actions. The
 *                        shipped default (6 = `handSize`, i.e. the whole hand)
 *                        makes the batch's selection arbitrary; lowering it
 *                        (with `redrawsPerTurn` raised) is the "N cards per
 *                        turn" mode.
 * - `enabled`          — master switch. L1 flipped this OFF for good: daemons
 *                        own redraw availability now (`Run.turnGates`, resolved
 *                        per turn from the active daemon's gates), so this
 *                        config is the daemon-LESS baseline = disabled. The
 *                        `redraw` block stays as the `RedrawConfig` type anchor
 *                        the daemon gates resolve into.
 *
 * Balance-tuned in H6, decoupled in K2 — a starting point, re-swept in N2.
 * Source of truth at `config/deck.json`.
 */

import { z } from 'zod';
import deckJson from '../../config/deck.json';

const DeckSchema = z.object({
  handSize: z.number().int().positive(),
  redraw: z.object({
    enabled: z.boolean(),
    redrawsPerTurn: z.number().int().nonnegative(),
    maxCardsPerTurn: z.number().int().nonnegative(),
  }),
});

export type DeckConfig = z.infer<typeof DeckSchema>;

export const DECK: DeckConfig = DeckSchema.parse(deckJson);
