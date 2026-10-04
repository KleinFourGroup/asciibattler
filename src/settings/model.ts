/**
 * The settings as the game holds them: read, change one, hear of a change.
 * Over the store's lenient `settings` section (settings.ts), so a change is
 * saved as it is made and a failed save reports through the store's status.
 *
 * Game-layer only, like the store it writes: the simulation, the run model
 * and the bots never import it. A consumer (the audio player, the key
 * registry, the motion gate) is handed its value by the game and never
 * imports this module either.
 */

import type { Store } from '../store/store';
import { SETTINGS_SECTION, type Settings } from './settings';

export type SettingKey = keyof Settings;
export type SettingsListener = (changed: SettingKey, settings: Settings) => void;

export interface SettingsModel {
  /** Every setting as it is now. A fresh object. */
  get(): Settings;
  /**
   * Change one setting. False when it couldn't be saved; the value still
   * holds for the page's life, as the store keeps it in memory. Throws on a
   * value the field's schema refuses, which is a caller's bug: the controls
   * only offer values a field takes.
   */
  set<K extends SettingKey>(key: K, value: Settings[K]): boolean;
  /** Called after every change with the key that changed. Returns the
   *  unsubscribe. */
  onChange(listener: SettingsListener): () => void;
}

export function createSettings(store: Store): SettingsModel {
  const listeners = new Set<SettingsListener>();
  return {
    get: () => store.read(SETTINGS_SECTION),
    set(key, value) {
      const parsed = SETTINGS_SECTION.fields[key].schema.safeParse(value);
      if (!parsed.success) {
        throw new Error(`settings: '${key}' refuses ${JSON.stringify(value)}: ${parsed.error.issues[0]?.message ?? 'invalid'}`);
      }
      // The field's own schema parsed it, so it is this field's type; the
      // compiler sees only the union over every field.
      const saved = store.patch(SETTINGS_SECTION, { [key]: parsed.data } as Partial<Settings>);
      const now = store.read(SETTINGS_SECTION);
      for (const listener of [...listeners]) listener(key, now);
      return saved;
    },
    onChange(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}
