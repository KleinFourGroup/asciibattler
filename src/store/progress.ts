/**
 * PROGRESS (Round 8 spec D1): the store's lenient `progress` section, what a
 * player has done across runs, and the rules that read and write it.
 *
 * Lenient is the store's word (store.ts): a stored value its schema refuses
 * takes its fallback alone, an unknown key is dropped and a missing one takes
 * its fallback, so no upload wipes what a player has earned. A field's name
 * is a key in every player's browser and is permanent; a field whose meaning
 * changes gets a new name. progress.test.ts pins the names.
 *
 * THE ESCALATION UNLOCKS (spec D8). What is stored is a fact, `bestWin`: the
 * highest Escalation level each character has won a run at. What a player
 * may pick is derived from it and never stored (`escalationCeiling`): the
 * level above the best win, so a character with no win plays at 0 and each
 * win at the ceiling opens the next level, for that character alone. Another
 * reading of the same record (unlocked content, Round 10) changes no stored
 * meaning.
 *
 * A WIN IS RECORDED (`runCounts`) when the run's dials hold a character, at
 * most a level beside it, and nothing else, and its level is within that
 * character's ceiling. A typed seed, a `?bits=` run continued on a plain
 * page, and a level reached by URL without the wins under it are each
 * refused by that one rule, with no flag in the save. A run loaded from a
 * file has no dials at all and is refused with them.
 *
 * The rules are pure. `Game` reads the record when a run is created, to hold
 * the picked level to the ceiling, and writes it at `run:victory`.
 *
 * Game-layer only, and never imported by the store's boot module
 * (tests/store-boot.test.ts): it imports zod and the run's config.
 */

import { z } from 'zod';
import { ESCALATION_MAX } from '../config/escalation';
import { RUN_CONFIG_PARAMS } from '../run/RunConfig';
import type { LenientSection } from './store';

/** The highest Escalation level won, by character id. A character with no
 *  entry has not won a run that counted. */
export type BestWin = Readonly<Record<string, number>>;

export interface Progress {
  /** Whether the credits have been shown after a won run: the first won run
   *  goes to the menu by way of them, once (src/scenes/menuRules.ts). */
  creditsSeen: boolean;
  /** The highest Escalation level each character has won at. */
  bestWin: BestWin;
}

/**
 * The stored record, each entry taken on its own. The store gives a refused
 * field its fallback whole, which for a record would cost every character's
 * wins for one bad entry, so the schema refuses only what is not a record and
 * drops the entries that are not a level won. An id the catalog doesn't hold
 * is kept: no rule reads it, and the build that knows it finds it there.
 * A level above this build's ladder is kept too, and the ceiling stops at the
 * ladder's top.
 */
const BestWinSchema = z.record(z.string(), z.unknown()).transform((stored): BestWin => {
  const kept: Record<string, number> = {};
  for (const [id, level] of Object.entries(stored)) {
    if (typeof level === 'number' && Number.isInteger(level) && level >= 0) kept[id] = level;
  }
  return kept;
});

export const PROGRESS_SECTION: LenientSection<Progress> = {
  policy: 'lenient',
  name: 'progress',
  version: 1,
  fields: {
    creditsSeen: { schema: z.boolean(), fallback: false },
    bestWin: { schema: BestWinSchema, fallback: {} },
  },
};

/** The highest level `characterId` may start a run at: 0 with no win, else
 *  the level above its best win, up to the ladder's top. */
export function escalationCeiling(bestWin: BestWin, characterId: string): number {
  const best = Object.hasOwn(bestWin, characterId) ? bestWin[characterId] : undefined;
  return best === undefined ? 0 : Math.min(best + 1, ESCALATION_MAX);
}

/** The level a run starts at when `picked` was asked for under `ceiling`:
 *  the pick, held to the ceiling. Anything that is not a level is 0. */
export function levelWithinCeiling(picked: number, ceiling: number): number {
  if (!Number.isInteger(picked) || picked < 0) return 0;
  return Math.min(picked, ceiling);
}

/**
 * Whether a won run is recorded. `dials` is the run's dials as URL query
 * text, as its journal's start and its save hold them; `level` is the level
 * it was played at and `ceiling` its character's ceiling now.
 */
export function runCounts(dials: string, level: number, ceiling: number): boolean {
  const params = new URLSearchParams(dials);
  // Every run the game creates names its character in its dials.
  if (!params.has(RUN_CONFIG_PARAMS.character)) return false;
  for (const dial of params.keys()) {
    if (dial !== RUN_CONFIG_PARAMS.character && dial !== RUN_CONFIG_PARAMS.escalation) return false;
  }
  return level <= ceiling;
}

/** The record after `characterId` won at `level`. A win at or under the best
 *  one changes nothing and hands back `bestWin` itself, so a win told twice
 *  is written once. */
export function bestWinAfter(bestWin: BestWin, characterId: string, level: number): BestWin {
  const best = Object.hasOwn(bestWin, characterId) ? bestWin[characterId] : undefined;
  if (best !== undefined && best >= level) return bestWin;
  return { ...bestWin, [characterId]: level };
}
