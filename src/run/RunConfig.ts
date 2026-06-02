/**
 * G1 — RunConfig: a single configurable entry point for *short* runs and
 * *specific* layouts, used by BOTH the browser (Game.ts) and the headless
 * paths (the fuzz harness + the tools/run-config CLI).
 *
 * A RunConfig is a run *input* — fully reconstructable from the seed — so it
 * is deliberately NOT persisted in the Run snapshot (that's a save/load
 * concern, deferred; see ROADMAP §G1). `config/nodemap.json` and
 * `config/recruitment.json` stay the defaults; a RunConfig overrides per-run.
 *
 * Determinism contract: the default path (no config / empty config) must
 * leave the run's RNG draw sequence byte-identical to pre-G1. Every override
 * is opt-in and only takes effect when its field is set — the fork hierarchy
 * (nodeMap / team / levelup forks, in that order) is preserved regardless, so
 * even a configured run keeps the parent stream aligned; only the forked
 * child streams produce different content.
 */

import { ALL_ARCHETYPES, type Archetype } from '../sim/archetypes';
import { LAYOUT_IDS } from '../sim/layouts';
import { LEVELING } from '../config/leveling';

/** One starting-roster slot: an archetype at a chosen level (>= 1, capped). */
export interface RosterEntry {
  readonly archetype: Archetype;
  readonly level: number;
}

export interface RunConfig {
  /**
   * Override the run seed. When unset, the caller picks one (the browser uses
   * `Date.now()`). Any integer is accepted (RNG normalizes via `>>> 0`).
   */
  readonly seed?: number;
  /**
   * Total floors including root + terminal (default
   * `config/nodemap.json#floorCount` = 11). A *playable* run needs >= 2 (root
   * + a terminal boss fight); `floorCount: 2` is the minimal one-battle run.
   */
  readonly floorCount?: number;
  /**
   * Replace the rolled starting roster with these archetypes, each at a chosen
   * level (dev / playtest). Supersedes the old `?roster=` override. URL form:
   * `roster=rogue:3,healer:2,melee` — `:level` is optional (default 1).
   */
  readonly startingRoster?: readonly RosterEntry[];
  /** Force every battle onto a named layout (must be a known `LAYOUT_IDS` member). */
  readonly forcedLayoutId?: string;
  /**
   * Override the middle-floor max width (default
   * `config/nodemap.json#middleWidthMax`). Clamped up to the floor's minimum
   * width by the generator, so a too-small value just pins to the minimum.
   */
  readonly mapMaxWidth?: number;
}

/**
 * URL query / CLI flag names — the single source of truth shared by the
 * browser parser and the CLI (which mirrors these as `--<name>` flags).
 */
export const RUN_CONFIG_PARAMS = {
  seed: 'seed',
  floors: 'floors',
  roster: 'roster',
  layout: 'layout',
  width: 'width',
} as const;

type MutableRunConfig = { -readonly [K in keyof RunConfig]: RunConfig[K] };

/** Any integer (incl. 0 / negative — RNG normalizes). Undefined if absent / non-integer. */
function parseIntStrict(raw: string | null): number | undefined {
  if (raw === null || raw.trim() === '') return undefined;
  const n = Number(raw);
  return Number.isInteger(n) ? n : undefined;
}

/** A strictly-positive integer (floors / widths). Undefined if absent / invalid. */
function parsePositiveInt(raw: string | null): number | undefined {
  const n = parseIntStrict(raw);
  return n !== undefined && n > 0 ? n : undefined;
}

/** Clamp a roster level into `[1, levelCap]`. */
function clampLevel(level: number): number {
  return Math.min(Math.max(1, level), LEVELING.levelCap);
}

/**
 * Comma-separated `archetype[:level]` tokens. Archetype validated against
 * `ALL_ARCHETYPES` (invalid tokens dropped); `:level` optional (default 1,
 * clamped to the level cap; a missing / non-positive level falls back to 1).
 * Undefined if no token is valid.
 */
function parseRoster(raw: string | null): RosterEntry[] | undefined {
  if (!raw) return undefined;
  const entries: RosterEntry[] = [];
  for (const token of raw.split(',')) {
    const [namePart, levelPart] = token.split(':');
    const name = namePart?.trim().toLowerCase() ?? '';
    if (!(ALL_ARCHETYPES as readonly string[]).includes(name)) continue;
    const level = clampLevel(parsePositiveInt(levelPart ?? null) ?? 1);
    entries.push({ archetype: name as Archetype, level });
  }
  return entries.length > 0 ? entries : undefined;
}

/** A known layout id. Undefined if absent or not in `LAYOUT_IDS`. */
function parseLayout(raw: string | null): string | undefined {
  if (!raw) return undefined;
  return LAYOUT_IDS.includes(raw) ? raw : undefined;
}

/**
 * Build a RunConfig from `URLSearchParams`. Unset / invalid fields are
 * omitted, so the result carries only explicit overrides. Pure (no DOM
 * access) so the CLI can call it on a synthetic params object too.
 */
export function parseRunConfig(params: URLSearchParams): RunConfig {
  const config: MutableRunConfig = {};
  const seed = parseIntStrict(params.get(RUN_CONFIG_PARAMS.seed));
  if (seed !== undefined) config.seed = seed;
  const floorCount = parsePositiveInt(params.get(RUN_CONFIG_PARAMS.floors));
  if (floorCount !== undefined) config.floorCount = floorCount;
  const startingRoster = parseRoster(params.get(RUN_CONFIG_PARAMS.roster));
  if (startingRoster !== undefined) config.startingRoster = startingRoster;
  const forcedLayoutId = parseLayout(params.get(RUN_CONFIG_PARAMS.layout));
  if (forcedLayoutId !== undefined) config.forcedLayoutId = forcedLayoutId;
  const mapMaxWidth = parsePositiveInt(params.get(RUN_CONFIG_PARAMS.width));
  if (mapMaxWidth !== undefined) config.mapMaxWidth = mapMaxWidth;
  return config;
}

/**
 * Browser entry: parse from `location.search` (or an explicit query string).
 * Guarded so a headless import without a `location` global gets an empty
 * config. Replaces the old inline `?roster=` parser in Game.ts.
 */
export function parseRunConfigFromURL(search?: string): RunConfig {
  const query = search ?? (typeof location !== 'undefined' ? location.search : '');
  return parseRunConfig(new URLSearchParams(query));
}

/**
 * Serialize a RunConfig back to a query string (no leading `?`) — the inverse
 * of `parseRunConfig` for the fields it sets. Used by the CLI to print a
 * browser launch URL that describes the same run.
 */
export function runConfigToQueryString(config: RunConfig): string {
  const params = new URLSearchParams();
  if (config.seed !== undefined) params.set(RUN_CONFIG_PARAMS.seed, String(config.seed));
  if (config.floorCount !== undefined) {
    params.set(RUN_CONFIG_PARAMS.floors, String(config.floorCount));
  }
  if (config.startingRoster && config.startingRoster.length > 0) {
    params.set(
      RUN_CONFIG_PARAMS.roster,
      config.startingRoster
        .map((e) => (e.level > 1 ? `${e.archetype}:${e.level}` : e.archetype))
        .join(','),
    );
  }
  if (config.forcedLayoutId !== undefined) {
    params.set(RUN_CONFIG_PARAMS.layout, config.forcedLayoutId);
  }
  if (config.mapMaxWidth !== undefined) {
    params.set(RUN_CONFIG_PARAMS.width, String(config.mapMaxWidth));
  }
  return params.toString();
}
