/**
 * The page's settings, over the page's store. Made when this module is
 * evaluated, which boot.ts makes happen right after the store's own module
 * and before the game's.
 *
 * Game-layer only: `src/sim`, `src/run`, `src/bot` and `tests/fuzz` never
 * import it (it reaches the store; tests/store-guard.test.ts follows the
 * graph).
 */

import { store } from '../store';
import { createSettings, type SettingsModel } from './model';

export const settings: SettingsModel = createSettings(store);
