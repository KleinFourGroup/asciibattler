/**
 * §95a/§95b — the registry of prose FAMILIES: every config catalog whose
 * schema carries `prose()` fields, with its parsed data. Each loader builds
 * its own descriptor with `loadProse` (locale.ts) right after its parse and
 * exports it as `<FAMILY>_PROSE`; this list is the census the extract
 * (`npm run i18n:extract` → `locales/en/<family>.json`) and the sidecar pins
 * (tests/i18n-en-extract.test.ts) iterate. A loader that marks prose but is
 * not listed here ships no sidecar and no pin — listing is part of migrating
 * a family.
 *
 * NOT here, by the Round 7 spec §6: camps (name + description are editor
 * metadata, never rendered) and the encounter / sector / layout
 * `description` fields — all plain strings.
 *
 * Import direction: this module imports the loaders; the loaders import
 * prose.ts / locale.ts only. Nothing under src/i18n/ imports this file
 * except extract.ts.
 */

import type { ProseFamily } from './prose';
import { EVENTS_PROSE } from '../config/events';
import { ENCOUNTERS_PROSE } from '../config/encounters';
import { DAEMONS_PROSE } from '../config/daemons';
import { PACKETS_PROSE } from '../config/packets';
import { CHARACTERS_PROSE } from '../config/characters';
import { SECTORS_PROSE } from '../config/sectors';
import { STATUSES_PROSE } from '../config/statuses';
import { UNITS_PROSE } from '../config/units';
import { ABILITIES_PROSE } from '../config/abilities';
import { LAYOUTS_PROSE } from '../config/layouts';

export type { ProseFamily } from './prose';

export const PROSE_FAMILIES: readonly ProseFamily[] = [
  EVENTS_PROSE, // 95a
  ENCOUNTERS_PROSE, // 95b ↓
  DAEMONS_PROSE,
  PACKETS_PROSE,
  CHARACTERS_PROSE,
  SECTORS_PROSE,
  STATUSES_PROSE,
  UNITS_PROSE,
  ABILITIES_PROSE,
  LAYOUTS_PROSE,
];

export function proseFamily(family: string): ProseFamily | undefined {
  return PROSE_FAMILIES.find((f) => f.family === family);
}
