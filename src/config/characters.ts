/**
 * The starting characters. Source of truth at `config/characters.json`.
 *
 * A character is a run's starting configuration: the roster it opens with,
 * the daemon it starts with, the archetypes it adds to the draft's
 * exclusions (the `draftable` flag stays the global one), and its weights
 * within a rarity tier (the tiers' own weights are
 * `RECRUITMENT.rarityWeights`). The fields are documented on
 * `CharacterConfig`.
 *
 * The schema checks that every id names a real combatant archetype or
 * daemon, and that no archetype is both excluded and weighted; a boot check
 * below requires `DEFAULT_CHARACTER_ID` to exist.
 */

import { z } from 'zod';
import { prose } from '../i18n/prose';
import { loadProse } from '../i18n/locale';
import charactersJson from '../../config/characters.json';
import { UNIT_DEFS } from './units';
import { daemonById } from './daemons';
import type { Archetype } from '../sim/archetypes';

/** The character every unconfigured entry point falls back to (bare
 *  `new Run(...)` constructors, the harness default, the URL-less boot
 *  before the select scene confirms). */
export const DEFAULT_CHARACTER_ID = 'soldier';

const isCombatantArchetype = (id: string): boolean => id in UNIT_DEFS;

const CharacterSchema = z.object({
  id: z.string().min(1),
  name: prose(),
  description: prose(),
  roster: z.array(z.string().min(1)).min(1),
  daemon: z.string().min(1),
  blacklist: z.array(z.string().min(1)).optional(),
  weightOverrides: z.record(z.string(), z.number().positive()).optional(),
});

/** Exported for the schema tests. */
export const CharactersSchema = z
  .object({ characters: z.array(CharacterSchema).min(1) })
  .superRefine((cfg, ctx) => {
    if (new Set(cfg.characters.map((c) => c.id)).size !== cfg.characters.length) {
      ctx.addIssue({ code: 'custom', message: 'character ids must be unique' });
    }
    for (const c of cfg.characters) {
      for (const a of c.roster) {
        if (!isCombatantArchetype(a)) {
          ctx.addIssue({
            code: 'custom',
            message: `character '${c.id}': roster references unknown archetype '${a}'`,
          });
        }
      }
      if (daemonById(c.daemon) === undefined) {
        ctx.addIssue({
          code: 'custom',
          message: `character '${c.id}': unknown daemon id '${c.daemon}'`,
        });
      }
      for (const a of c.blacklist ?? []) {
        if (!isCombatantArchetype(a)) {
          ctx.addIssue({
            code: 'custom',
            message: `character '${c.id}': blacklist references unknown archetype '${a}'`,
          });
        }
      }
      const overridden = Object.keys(c.weightOverrides ?? {});
      for (const a of overridden) {
        if (!isCombatantArchetype(a)) {
          ctx.addIssue({
            code: 'custom',
            message: `character '${c.id}': weightOverrides references unknown archetype '${a}'`,
          });
        }
      }
      const blacklisted = new Set(c.blacklist ?? []);
      for (const a of overridden) {
        if (blacklisted.has(a)) {
          ctx.addIssue({
            code: 'custom',
            message: `character '${c.id}': '${a}' is both blacklisted and weight-overridden (blacklist IS weight 0 — pick one)`,
          });
        }
      }
    }
  });

export interface CharacterConfig {
  id: string;
  name: string;
  description: string;
  /** The starting roster in deployment order; its length is the roster
   *  size, and every unit starts at `RECRUITMENT.startingLevel`. */
  roster: readonly Archetype[];
  /** The daemon the character starts with, a `config/daemons.json` id. */
  daemon: string;
  /** Archetypes added to the global `draftable: false` exclusions, never
   *  replacing them; empty for none. */
  blacklist: readonly Archetype[];
  /** Draft weights within a tier, 1 for an unlisted archetype. Positive,
   *  since weight 0 is spelled `blacklist`, and disjoint from it. */
  weightOverrides: Readonly<Partial<Record<Archetype, number>>>;
}

const parsed = CharactersSchema.parse(charactersJson);
// `name` and `description` are prose, resolved on the parsed list before
// `normalizeCharacter` copies the fields, and addressed as `characters.<id>.…`.
export const CHARACTERS_PROSE = loadProse('characters', z.array(CharacterSchema), parsed.characters);

/** The parse with its optional collections made present. Exported for the
 *  schema tests and the character editor. */
export function normalizeCharacter(
  raw: (typeof parsed.characters)[number],
): CharacterConfig {
  return {
    id: raw.id,
    name: raw.name,
    description: raw.description,
    roster: raw.roster as readonly Archetype[],
    daemon: raw.daemon,
    blacklist: (raw.blacklist ?? []) as readonly Archetype[],
    weightOverrides: (raw.weightOverrides ?? {}) as Partial<Record<Archetype, number>>,
  };
}

export const CHARACTERS: readonly CharacterConfig[] = parsed.characters.map(normalizeCharacter);

/** The catalog's ids in file order, for the harness's flag errors. */
export const CHARACTER_IDS: readonly string[] = CHARACTERS.map((c) => c.id);

/**
 * Boot check: the catalog carries `DEFAULT_CHARACTER_ID`, which every
 * unconfigured entry point resolves to, so its absence fails at startup and
 * not mid-run. Its argument lets a test pass a synthetic catalog.
 */
export function assertDefaultCharacter(characters: readonly CharacterConfig[]): void {
  if (!characters.some((c) => c.id === DEFAULT_CHARACTER_ID)) {
    throw new Error(
      `characters.json must define the default character '${DEFAULT_CHARACTER_ID}'`,
    );
  }
}

assertDefaultCharacter(CHARACTERS);

/** Lookup by id, `undefined` on a miss; the caller decides whether to throw
 *  or skip, as with `daemonById`. */
export function characterById(id: string): CharacterConfig | undefined {
  return CHARACTERS.find((c) => c.id === id);
}
