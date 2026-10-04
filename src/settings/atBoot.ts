/**
 * What the settings decide before the game's modules load. The catalogs
 * resolve their prose through the active locale as they are evaluated, so
 * the locale is set here, ahead of them; boot.ts calls this as `main.ts`'s
 * second import. Pure over its seams, so a test hands it a planted locale.
 *
 * Everything else a setting changes is applied by the game once it exists
 * (the volume, the keys, the speed, the motion override, the shake, the
 * aura mode), since those consumers read their value when they run, not
 * when they load.
 */

import type { Settings } from './settings';

export interface BootSeams {
  /** The locales this build ships (src/i18n/locale.ts, `SHIPPED_LOCALES`). */
  readonly shippedLocales: readonly string[];
  /** `setActiveLocale`: takes effect for catalogs loaded after the call. */
  setLocale(lang: string): void;
}

/**
 * Apply the boot-time settings. A stored locale this build doesn't ship is
 * left alone, and the page keeps the default: an older build's locale, or a
 * hand-edited store, must not leave the catalogs throwing for entries that
 * aren't there.
 */
export function applyAtBoot(settings: Pick<Settings, 'locale'>, seams: BootSeams): void {
  if (seams.shippedLocales.includes(settings.locale)) seams.setLocale(settings.locale);
}
