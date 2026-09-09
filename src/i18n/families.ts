/**
 * §95a — the registry of prose FAMILIES: every config catalog whose schema
 * carries `prose()` fields, with its parsed data. The extract
 * (`npm run i18n:extract` → `locales/en/<family>.json`) and the sidecar
 * pins (tests/i18n-en-extract.test.ts) iterate this list; a loader that
 * marks prose but is not registered here ships no sidecar and no pin —
 * so registering is part of migrating a family (95a events; 95b the rest).
 *
 * Import direction: this module imports the loaders; the loaders import
 * prose.ts / locale.ts only. Nothing under src/i18n/ imports this file
 * except extract.ts.
 */

import type { z } from 'zod';

export interface ProseFamily {
  /** The address prefix — `events`, `daemons`, … (matches the config file stem). */
  readonly family: string;
  readonly schema: z.ZodType;
  /** The parsed catalog the loader exports (post-`applyLocale`). */
  readonly data: unknown;
}

export const PROSE_FAMILIES: readonly ProseFamily[] = [];

export function proseFamily(family: string): ProseFamily | undefined {
  return PROSE_FAMILIES.find((f) => f.family === family);
}
