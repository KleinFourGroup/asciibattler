/**
 * §63a — the starting-character catalog. Source of truth at
 * `config/characters.json` (the `config/daemons.json` pattern: parse at
 * module load, throw on malformed JSON).
 *
 * A character is a run's starting configuration (cluster-4-spec §Starting
 * Characters): the roster it opens with, the daemon it carries (replacing
 * the run-start daemon roll — §63c), the archetypes it ADDS to the global
 * draft blacklist (the `draftable` flag stays the global mechanism), and
 * its within-tier weight overrides (default weight 1; the rarity-tier
 * frequencies themselves stay global — `RECRUITMENT.rarityWeights`).
 *
 * Shape decisions (kickoff shape-lock, worklog §63):
 * - `roster` is a flat archetype-id list and its LENGTH is the roster size
 *   (non-empty is the only structural bound); every unit starts at the
 *   global `RECRUITMENT.startingLevel`.
 * - `daemon` is a single id — the round scope guard keeps the field single
 *   until a character needs more.
 * - A blacklisted archetype may NOT also carry a weight override: the spec
 *   notes blacklisting ≡ weight 0, so overrides are strictly positive and
 *   the overlap is a parse-time contradiction.
 * - Reference legality (roster/blacklist/override ids exist in the
 *   combatant catalog; the daemon id resolves) is enforced in the schema's
 *   superRefine; the shipped-catalog invariant that `DEFAULT_CHARACTER_ID`
 *   exists is an args-injected boot assert (the `assertDaemonStatusRefs`
 *   precedent), self-wired below.
 */

import { z } from 'zod';
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
  name: z.string().min(1),
  description: z.string().min(1),
  roster: z.array(z.string().min(1)).min(1),
  daemon: z.string().min(1),
  /** Additions on top of the global `draftable:false` set — never a
   *  replacement of it. Absent = no additions. */
  blacklist: z.array(z.string().min(1)).optional(),
  /** Within-tier weight per archetype (default 1 for everything unlisted).
   *  Strictly positive — weight 0 is spelled `blacklist`. */
  weightOverrides: z.record(z.string(), z.number().positive()).optional(),
});

/** Exported for schema tests (the `DaemonsSchema` precedent). */
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
  /** Starting roster, in deployment order; length = roster size. Every
   *  entry validated against the combatant catalog at parse. */
  roster: readonly Archetype[];
  /** The daemon this character starts with (a `config/daemons.json` id). */
  daemon: string;
  /** Draft-pool exclusions ADDED to the global `draftable:false` set.
   *  Always present post-normalize (empty = no additions). */
  blacklist: readonly Archetype[];
  /** Within-tier draft weights (absent archetype = 1). Always present
   *  post-normalize; disjoint from `blacklist` by parse-time guard. */
  weightOverrides: Readonly<Partial<Record<Archetype, number>>>;
}

const parsed = CharactersSchema.parse(charactersJson);

/** Build always-present-collection configs from the parse (the
 *  `normalizeDaemon` exact-optional discipline). Exported for schema tests
 *  + the §63f character editor. */
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

/** Catalog id list, in file order (harness flag error messages — the
 *  `--daemon` choices-string pattern). */
export const CHARACTER_IDS: readonly string[] = CHARACTERS.map((c) => c.id);

/**
 * Boot check: the shipped catalog must carry `DEFAULT_CHARACTER_ID` — every
 * unconfigured entry point resolves to it, so its absence is a startup
 * error, not a mid-run surprise. Args-injected for synthetic tests (the
 * `assertDaemonStatusRefs` precedent); self-wired below.
 */
export function assertDefaultCharacter(characters: readonly CharacterConfig[]): void {
  if (!characters.some((c) => c.id === DEFAULT_CHARACTER_ID)) {
    throw new Error(
      `characters.json must define the default character '${DEFAULT_CHARACTER_ID}'`,
    );
  }
}

assertDefaultCharacter(CHARACTERS);

/** Catalog lookup by id (`undefined` on a miss — callers decide throw vs
 *  skip, the `daemonById` contract). */
export function characterById(id: string): CharacterConfig | undefined {
  return CHARACTERS.find((c) => c.id === id);
}
