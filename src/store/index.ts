/**
 * The page's store, made when this module is evaluated. `main.ts` imports it
 * first, ahead of the game's modules, so a stored locale or palette is in
 * hand before a catalog resolves its prose (Round 8 spec D1). Everything this
 * module reaches stays inside `src/store/` and `src/buildId.ts`;
 * tests/store-boot.test.ts holds that.
 *
 * Game-layer only: `src/sim`, `src/run`, `src/bot` and `tests/fuzz` never
 * import it.
 */

import { BUILD_ID } from '../buildId';
import { DENY_QUERY, FULL_QUERY, chooseAdapter, deniedChoice, fullChoice } from './choose';
import { createStore, type Store } from './store';

const host: unknown = typeof window === 'undefined' ? undefined : window;
// The two plants are a DEV page's only; a production build drops their
// branches, and with them the queries and the planted reasons.
const DEV = typeof import.meta.env !== 'undefined' && import.meta.env.DEV === true;
const denied = DEV && typeof location !== 'undefined' && location.search.slice(1).split('&').includes(DENY_QUERY);
const full =
  DEV && typeof location !== 'undefined' && location.search.slice(1).split('&').includes(FULL_QUERY)
    ? fullChoice(chooseAdapter(host))
    : null;
const choice = denied ? deniedChoice() : (full ?? chooseAdapter(host));

export const store: Store = createStore({ adapter: choice.adapter, unsaved: choice.unsaved, build: BUILD_ID });
// Armed once the store has stamped itself: the writes that fail are the game's.
full?.arm();
