/**
 * PROGRESS (Round 8 spec D1): the store's lenient `progress` section, what a
 * player has done across runs. Its first field is `creditsSeen` (116j); the
 * Escalation unlocks join it at §117.
 *
 * Lenient is the store's word (store.ts): a stored value its schema refuses
 * takes its fallback alone, an unknown key is dropped and a missing one takes
 * its fallback, so no upload wipes what a player has earned. A field's name
 * is a key in every player's browser and is permanent; a field whose meaning
 * changes gets a new name. progress.test.ts pins the names.
 *
 * Game-layer only, and never imported by the store's boot module
 * (tests/store-boot.test.ts): it imports zod.
 */

import { z } from 'zod';
import type { LenientSection } from './store';

export interface Progress {
  /** Whether the credits have been shown after a won run: the first won run
   *  goes to the menu by way of them, once (src/scenes/menuRules.ts). */
  creditsSeen: boolean;
}

export const PROGRESS_SECTION: LenientSection<Progress> = {
  policy: 'lenient',
  name: 'progress',
  version: 1,
  fields: {
    creditsSeen: { schema: z.boolean(), fallback: false },
  },
};
