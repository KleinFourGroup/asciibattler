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
import { DENY_QUERY, chooseAdapter, deniedChoice } from './choose';
import { createStore, type Store } from './store';

const host: unknown = typeof window === 'undefined' ? undefined : window;
// The plant is a DEV page's only; a production build drops the branch, and
// with it the query and the planted reason.
const DEV = typeof import.meta.env !== 'undefined' && import.meta.env.DEV === true;
const denied = DEV && typeof location !== 'undefined' && location.search.slice(1).split('&').includes(DENY_QUERY);

export const store: Store = createStore({ ...(denied ? deniedChoice() : chooseAdapter(host)), build: BUILD_ID });
