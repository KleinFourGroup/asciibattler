/**
 * 116b — from a setting to the thing it sets. Each consumer is a function the
 * game hands over, so this module names no audio player, registry or
 * renderer, and a test connects recording stand-ins or the real modules.
 *
 * `connectSettings` gives every consumer its stored value at once (the boot)
 * and its new value on every change (live). Three fields have no consumer
 * here: the locale is set before the catalogs load (atBoot.ts), and the
 * palette and the text scale get theirs with their own steps. The music
 * level is stored and nothing plays music yet.
 *
 * Never imported by boot.ts or index.ts: the consumers' modules are the
 * game's, and the settings' boot graph stays clear of them
 * (tests/settings-boot.test.ts).
 */

import type { SettingKey, SettingsModel } from './model';
import { SETTINGS_SECTION, type AuraChoice, type MotionChoice, type Settings, type ShakeChoice } from './settings';

export interface SettingsConsumers {
  /** The master and SFX levels, each 0 to 1. */
  setVolume(master: number, sfx: number): void;
  /** The stored rebinds, over the config's defaults. */
  setKeys(overrides: Readonly<Record<string, string>>): void;
  /** The speed a battle starts at; a value that isn't an enabled step is
   *  the consumer's to refuse. */
  setSpeed(value: number): void;
  /** The reduced-motion override: null follows the OS. */
  setMotion(override: boolean | null): void;
  setShake(policy: ShakeChoice): void;
  setAura(mode: AuraChoice): void;
}

const MOTION_OVERRIDE: Readonly<Record<MotionChoice, boolean | null>> = {
  system: null,
  reduced: true,
  full: false,
};

/** Hand one setting's value to its consumer. */
export function applySetting(key: SettingKey, settings: Settings, to: SettingsConsumers): void {
  switch (key) {
    case 'volumeMaster':
    case 'volumeSfx':
      to.setVolume(settings.volumeMaster, settings.volumeSfx);
      break;
    case 'keys':
      to.setKeys(settings.keys);
      break;
    case 'speed':
      to.setSpeed(settings.speed);
      break;
    case 'motion':
      to.setMotion(MOTION_OVERRIDE[settings.motion]);
      break;
    case 'shake':
      to.setShake(settings.shake);
      break;
    case 'aura':
      to.setAura(settings.aura);
      break;
    case 'volumeMusic':
    case 'palette':
    case 'textScale':
    case 'locale':
      // No consumer here (the header).
      break;
    default:
      // A new field fails to compile until it is routed or listed above.
      key satisfies never;
  }
}

/**
 * Give every consumer its value now, and each its new value on every change.
 * Returns the unsubscribe.
 */
export function connectSettings(model: SettingsModel, to: SettingsConsumers): () => void {
  const now = model.get();
  for (const key of Object.keys(SETTINGS_SECTION.fields) as SettingKey[]) applySetting(key, now, to);
  return model.onChange((key, settings) => applySetting(key, settings, to));
}
