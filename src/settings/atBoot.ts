/**
 * What the settings decide before the game's modules load. The catalogs
 * resolve their prose through the active locale as they are evaluated, so
 * the locale is set here, ahead of them; boot.ts, `main.ts`'s second
 * import, calls this. Pure over its seams, so a test hands it a planted
 * locale. The palette is chosen here for the same reason: the render
 * modules read `COLORS` into their own tables as they are evaluated.
 *
 * The other settings are the game's to apply once it exists (apply.ts),
 * since their consumers read a value when they run, not when they load.
 */

import type { Settings } from './settings';

interface BootSeams {
  /** The locales this build ships (src/i18n/locale.ts, `SHIPPED_LOCALES`). */
  readonly shippedLocales: readonly string[];
  /** `setActiveLocale`: takes effect for catalogs loaded after the call. */
  setLocale(lang: string): void;
  /** Choose the palette of this name, for every module loaded after the
   *  call. A name this build has no palette for is the chooser's to answer
   *  (`choosePalette` falls back to the default). */
  setPalette(name: string): void;
}

/**
 * Apply the boot-time settings. A stored locale this build doesn't ship is
 * left alone, and the page keeps the default: an older build's locale, or a
 * hand-edited store, must not leave the catalogs throwing for entries that
 * aren't there.
 */
export function applyAtBoot(settings: Pick<Settings, 'locale' | 'palette'>, seams: BootSeams): void {
  if (seams.shippedLocales.includes(settings.locale)) seams.setLocale(settings.locale);
  seams.setPalette(settings.palette);
}
