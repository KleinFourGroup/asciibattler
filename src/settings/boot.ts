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
 *
 * 116f — the stored palette is chosen here too, before any module reads
 * `COLORS` (src/render/palette.ts), and the tokens it changes are set on the
 * root element over the stylesheet's own. The default palette changes none,
 * so the sheet's values stand and the root element gets no inline style.
 */

import { SHIPPED_LOCALES, setActiveLocale } from '../i18n/locale';
import { choosePalette, tokenOverrides } from '../render/palette';
import { applyAtBoot } from './atBoot';
import { settings } from './index';

applyAtBoot(settings.get(), {
  shippedLocales: SHIPPED_LOCALES,
  setLocale: setActiveLocale,
  setPalette: (name) => {
    for (const [token, hex] of tokenOverrides(choosePalette(name))) {
      document.documentElement.style.setProperty(token, hex);
    }
  },
});
