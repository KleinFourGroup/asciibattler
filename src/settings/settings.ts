/**
 * THE SETTINGS (Round 8 spec D7): the store's lenient `settings` section,
 * one field per setting, each with its schema and its fallback.
 *
 * Lenient is the store's word (src/store/store.ts): a stored value its
 * schema refuses takes its fallback alone, an unknown key is dropped and a
 * missing one takes its fallback, so no upload wipes a player's settings. A
 * field's name is a key in every player's browser and is permanent; a field
 * whose meaning changes gets a new name. settings.test.ts pins the names.
 *
 * The fallbacks are what the game did before it had settings, so a player
 * with an empty store plays the game as it was.
 *
 * A field here is what is stored, not what a consumer accepts. `keys` holds
 * any action name against any key code and `speed` any positive number: the
 * registry and the playback controller take what they know and leave the
 * rest, which keeps this module clear of the config catalogs. It is
 * evaluated before them (boot.ts), and tests/settings-boot.test.ts holds its
 * import graph.
 */

import { z } from 'zod';
import { DEFAULT_LOCALE } from '../i18n/locale';
import type { LenientSection } from '../store/store';

/** Reduced motion: follow the OS, or the player's word either way. */
export const MOTION_CHOICES = ['system', 'reduced', 'full'] as const;
export type MotionChoice = (typeof MOTION_CHOICES)[number];

/** Whose morale losses shake the view (src/ui/lossFx.ts, the shake policy). */
export const SHAKE_CHOICES = ['player', 'enemy', 'both', 'none'] as const;
export type ShakeChoice = (typeof SHAKE_CHOICES)[number];

/** How an aura shows its range: waves that follow their carrier, or motes
 *  over the whole area (src/render/BattleRenderer.ts). */
export const AURA_CHOICES = ['track', 'fill'] as const;
export type AuraChoice = (typeof AURA_CHOICES)[number];

/** The palette, swapped on reload. */
export const PALETTE_CHOICES = ['default', 'colourblind'] as const;
export type PaletteChoice = (typeof PALETTE_CHOICES)[number];

export interface Settings {
  /** 0 to 1. A sound plays at master × SFX × its own level. */
  volumeMaster: number;
  volumeSfx: number;
  /** Stored from day one; nothing plays music yet, so it has no control. */
  volumeMusic: number;
  /** The player's rebinds, action → `KeyboardEvent.code`, over the config's
   *  defaults. An action that isn't here keeps its default. */
  keys: Readonly<Record<string, string>>;
  /** The speed a battle starts at on a fresh page. */
  speed: number;
  motion: MotionChoice;
  shake: ShakeChoice;
  aura: AuraChoice;
  palette: PaletteChoice;
  /** A multiplier on the UI's text size. */
  textScale: number;
  locale: string;
}

const volume = z.number().min(0).max(1);

export const SETTINGS_SECTION: LenientSection<Settings> = {
  policy: 'lenient',
  name: 'settings',
  version: 1,
  fields: {
    volumeMaster: { schema: volume, fallback: 0.5 },
    volumeSfx: { schema: volume, fallback: 1 },
    volumeMusic: { schema: volume, fallback: 1 },
    keys: { schema: z.record(z.string().min(1), z.string().min(1)), fallback: Object.freeze({}) },
    speed: { schema: z.number().positive(), fallback: 1 },
    motion: { schema: z.enum(MOTION_CHOICES), fallback: 'system' },
    shake: { schema: z.enum(SHAKE_CHOICES), fallback: 'player' },
    aura: { schema: z.enum(AURA_CHOICES), fallback: 'track' },
    palette: { schema: z.enum(PALETTE_CHOICES), fallback: 'default' },
    textScale: { schema: z.number().min(0.5).max(3), fallback: 1 },
    locale: { schema: z.string().min(1), fallback: DEFAULT_LOCALE },
  },
};
