/**
 * 116a — THE SETTINGS' BOOT: `main.ts`'s second import, after the store and
 * ahead of `./Game`. Modules evaluate in import order, and the catalogs under
 * `./Game` resolve their prose through the locale as they load, so the stored
 * locale is set here, before any of them (Round 8 spec D1, D7).
 * tests/settings-boot.test.ts holds this module second and holds its import
 * graph clear of every catalog.
 *
 * A second locale lands here: its sidecars are imported and registered in
 * this module (`registerLocale`, `registerUiLocale`), before the call below,
 * and it joins `SHIPPED_LOCALES`. Until then the call can only ever choose
 * the default.
 */

import { SHIPPED_LOCALES, setActiveLocale } from '../i18n/locale';
import { applyAtBoot } from './atBoot';
import { settings } from './index';

applyAtBoot(settings.get(), { shippedLocales: SHIPPED_LOCALES, setLocale: setActiveLocale });
