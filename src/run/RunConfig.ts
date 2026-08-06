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
import { daemonById, type DaemonConfig } from '../config/daemons';
import { characterById, type CharacterConfig } from '../config/characters';
import { ENCOUNTER_IDS } from '../config/encounters';
import type { SectorMap } from '../config/sectorMap';
import type { EventDef } from '../config/events';

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
   * Total hops including root + terminal (default
   * `config/nodemap.json#hopCount` = 11). A *playable* run needs >= 2 (root
   * + a terminal boss fight); `hopCount: 2` is the minimal one-battle run.
   *
   * 67c — setting this makes the run a bounded SINGLE-SECTOR probe: the
   * sector's terminal IS the run terminal (the sector walk never advances) —
   * the isolation/smoke semantic every `SHORT` harness fixture means. For a
   * shortened run that still walks the whole sector DAG, use `sectorHops`.
   * Mutually exclusive with `sectorHops` (construction throws on both).
   */
  readonly hopCount?: number;
  /**
   * 67c — the shortened FULL-WALK dial: every sector's node-map is exactly
   * this many hops (an override of each sector's authored `length`, not a
   * cap) while the DAG still walks to its real sink — `sectorHops: 4` on the
   * shipped start → deep-end chain is a 4+4-hop two-act run. The cheap
   * multi-sector balance-read shape. URL form: `sectorHops=4`. Mutually
   * exclusive with `hopCount`; not persisted (a rehydrated run restores
   * authored lengths).
   */
  readonly sectorHops?: number;
  /**
   * Replace the rolled starting roster with these archetypes, each at a chosen
   * level (dev / playtest). Supersedes the old `?roster=` override. URL form:
   * `roster=rogue:3,healer:2,melee` — `:level` is optional (default 1).
   */
  readonly startingRoster?: readonly RosterEntry[];
  /** Force every battle onto a named layout (a known `LAYOUT_IDS` member), or the
   *  `FORCE_PROCEDURAL` sentinel (`'procedural'`) to force every battle onto a
   *  freshly-rolled PROCEDURAL map. URL form: `layout=river` or `layout=procedural`. */
  readonly forcedLayoutId?: string;
  /**
   * X2 — force the authored ENCOUNTER (a catalog `Encounter.id`) at every node
   * whose kind matches the encounter's kind (`selectEncounter`'s force-select),
   * bypassing the sector pool + hop gate for a clean per-encounter balance sample
   * (the `--encounter=<id>` isolation). A kind mismatch leaves that node's normal
   * selection (boss/elite nodes still draw their bucket). 53d — gained the URL
   * form `encounter=artillery` (ids are case-sensitive; unknown ids dropped like
   * `layout=`'s), so a gauntlet cell is a shareable URL: `?hops=2&encounter=X&
   * layout=Y&seed=N&roster=…&daemon=none` pins the whole battle for BOTH the
   * browser (the human) and the headless CLI (the bot) — note `encounter=` alone
   * does NOT pin the board (the layout still rolls; pair it with `layout=`).
   * Validated loud at construction. NOT persisted (a RunConfig input); a
   * rehydrated run resets to normal selection.
   */
  readonly forcedEncounterId?: string;
  /**
   * 68e — stamp the FIRST sector's ROOT node with this kind after generation
   * (dev/isolation dial). The one supported value is `'elite'`: paired with
   * `hopCount: 2` + `forcedEncounterId`, the run's first fight is the forced
   * elite met at FULL pool — the X2d boss-read shape extended to elites,
   * which de-censors the per-instance pool metric (the §68e finding: sparse
   * terminal elite instances record arrival pool, not encounter strength).
   * Zero extra RNG draws (a post-generation stamp), so the map structure and
   * every other kind placement are byte-identical to the dial being absent.
   * Applies to the first sector's map only (sector advances regenerate
   * without the config, by design). Ignored when the root IS the terminal
   * (`hopCount: 1` — boss wins). URL form: `firstNode=elite`. NOT persisted.
   * 74b widens the value set with `'event'` — the event-phase dev/isolation
   * shape (`?hops=2&firstNode=event`, optionally + `forcedEventId`): the
   * stamp itself was always kind-generic, only this type gated it.
   */
  readonly firstNodeKind?: 'elite' | 'event';
  /**
   * 74b — force every event-node entry to open THIS event (a
   * config/events.json id), skipping the eligibility-filtered pick — the
   * `forcedEncounterId` shape for events (validated loud at construction).
   * The combat-resolve roll still happens first (suppress it via a
   * `eventCombatChance` modifier rule, or the §74e isolation dial once it
   * lands). Programmatic-only; NOT persisted.
   */
  readonly forcedEventId?: string;
  /**
   * 74b — override the event catalog for headless tests (the `sectorMap`
   * discipline: programmatic-only, NOT persisted). Bespoke defs are
   * in-memory only — a mid-event save carrying a non-catalog id
   * hard-rejects on load (the bespoke-daemon precedent).
   */
  readonly eventCatalog?: readonly EventDef[];
  /**
   * Override the middle-hop max width (default
   * `config/nodemap.json#middleWidthMax`). Clamped up to the hop's minimum
   * width by the generator, so a too-small value just pins to the minimum.
   */
  readonly mapMaxWidth?: number;
  /**
   * 72e — override the node-map elite/port scatter chances (defaults
   * `config/nodemap.json#eliteChance` / `#portChance`). The forced-shape
   * probe dials for decision-grade per-kind reads: `eliteChance: 1` offers
   * an elite on every spacing-eligible hop (the §55 force-isolate doctrine
   * applied to node SCATTER — the assignment still places one elite per hop,
   * so taking it stays the walker's choice; pair with `firstNodeKind` for a
   * forced-TAKEN read). Same G1 precedence as `mapMaxWidth`; NOT persisted
   * (a rehydrated run falls back to the authored JSON values).
   * 74e — `eventChance` joins as the third sibling (the event-scatter dial;
   * `eventChance: 0` is the event-free control arm, `1` the every-hop probe
   * shape). `eventMinSpacing` stays JSON-only, matching elite/port.
   */
  readonly eliteChance?: number;
  readonly portChance?: number;
  readonly eventChance?: number;
  /**
   * L1 — override the run's daemon: a full `DaemonConfig` (a catalog entry or
   * a bespoke test/profile daemon), or `null` for a daemon-LESS run (the fuzz
   * control arm — both pre-turn gates permanently disabled). Unset → a uniform
   * roll over `DAEMONS` off the run's dedicated daemon stream. The roll/skip
   * happens on the forked CHILD stream, so the parent alignment is preserved
   * either way (the G1 determinism contract). URL form: `daemon=mars` (a
   * catalog id) or `daemon=none`. This is also the future starting-profile
   * seam (a profile = a `startingRoster` + a `daemon`).
   */
  readonly daemon?: DaemonConfig | null;
  /**
   * §63c — the run's starting character (a resolved `config/characters.json`
   * def). Unset → `DEFAULT_CHARACTER_ID` (The Soldier), so every bare
   * headless constructor keeps working. Drives the starting roster, the
   * starting daemon (the run-start daemon ROLL retired here — characters
   * replaced it, the kickoff lock), and the draft pools (blacklist additions
   * + within-tier weight overrides). PRECEDENCE (kickoff fork #2): an
   * explicit `startingRoster` or `daemon` override beats the character's
   * corresponding field, so measurement arms keep their isolation power
   * (`--character=priest --daemon=none` = the Priest minus Minerva).
   * URL form (63d): `character=<id>` (unknown ids dropped, the `layout=`
   * discipline); the harness mirrors it as `--character`. NOT persisted
   * itself — the Run serializes the resolved `characterId` (v38).
   */
  readonly character?: CharacterConfig;
  /**
   * T2 — override the sector-selection meta-DAG (default: the shipped
   * `SECTOR_MAP`). Programmatic-only (a full graph object — no URL form), the
   * seam for headless multi-sector tests + a future fuzz force-select. Like the
   * other overrides it is NOT persisted; a rehydrated run falls back to the
   * shipped map (the shipped DAG is a single sink, so a save never mid-walks a
   * multi-node graph).
   */
  readonly sectorMap?: SectorMap;
  /**
   * X1 — the per-run difficulty multipliers (the future difficulty-system seam),
   * applied to EVERY authored-encounter wave at resolve time: `waveSize` scales
   * the resolved count (action-economy axis), `levelBudget` the resolved level
   * budget (individual-strength axis, saturating against a wave's `levelCap`).
   * Programmatic-only (no URL form yet — the X2 balance sweep sets them per run);
   * unset → the global `config/difficulty.json` defaults (1.0 = no scaling), so
   * the default path stays byte-identical (the G1 determinism contract). NOT
   * persisted (a RunConfig input, reconstructable). A future difficulty level /
   * hop-ramp / ascension sets these per run; `resolveDifficultyMultipliers`
   * (config/difficulty.ts) is the resolution seam.
   */
  readonly waveSizeMultiplier?: number;
  readonly levelBudgetMultiplier?: number;
  /**
   * 48f — the per-run ECONOMY multiplier (the X1 siblings' third axis): scales
   * every bits earn at the `Run.gainBits` settle, multiplicative with the
   * folded `bitsGain` run-stat — reward rolls, battle tallies, and daemon
   * hooks all scale uniformly (the §52 boss-wall lever). Applies at the run
   * layer, never `WaveContext`. Programmatic-only; unset → the
   * `config/difficulty.json` default (1.0 = no scaling); NOT persisted (the
   * X1 discipline above).
   */
  readonly bitsMultiplier?: number;
  /**
   * 47e — override the run's starting bits balance (the spec §Bits testing
   * override, for dev / fuzz / playtest runs). Unset → the
   * `config/economy.json#startingBits` default. Pure of RNG, clamped at the
   * zero floor by the Run constructor. URL form: `bits=100`.
   */
  readonly startingBits?: number;
  /**
   * 65d — a per-run ADDITIVE `drawAmount` override (the max-hand A/B dial):
   * folded into `effectiveRunStats` exactly like a daemon `modifier` rule,
   * so the turn deal AND the enemy-budget basis (Option B) both see it — a
   * FORCED persistent fold, deliberately unlike a transient packet draw.
   * Programmatic + the fuzz `--draw-add=<n>` flag (run mode); no URL form
   * (the bitsMultiplier discipline). Unset / 0 → no modifier is injected,
   * so the default path keeps the fold's identity fast path (byte-identical
   * — the G1 determinism contract). NOT persisted (a RunConfig input).
   */
  readonly drawAmountAdd?: number;
  /**
   * 49d — override the grant-queue finality toggle
   * (`deck.json#grantQueue.passIsFinal`) for this run, so tests/fuzz can
   * exercise BOTH modes without config edits. Programmatic-only; unset → the
   * shipped config. Pure of RNG; NOT persisted (the X1 discipline above).
   */
  readonly passIsFinal?: boolean;
  /**
   * 68b — the kind-agnostic grant seam (the paired marginal-value
   * instrument): hand the run these items FREE at construction, so a
   * same-seed with/without pair reads an item's realized value. Each id
   * resolves by catalog probe — daemon | packet | unit archetype — and an
   * unknown id throws loud at construction. Applied IN ORDER (a cache-size
   * daemon granted before packets raises the capacity those packets are
   * checked against). Duplicates are legal (the addDaemon discipline — a
   * second copy is a meaningful value probe for stacking rules). Daemon and
   * packet grants draw NOTHING (an inert grant leaves the whole run stream
   * byte-identical); a unit grant levels off the abandoned team child
   * stream, so the parent fork alignment holds either way (G1).
   * Programmatic + the fuzz `--grant` flag (run mode); no URL form (the
   * drawAmountAdd discipline). NOT persisted — granted state serializes
   * through the existing daemons/cache/team unions.
   */
  readonly grants?: readonly string[];
}

/**
 * 72e — the slice of a RunConfig that SURVIVES a sector advance. Sector
 * regeneration deliberately drops the config (`advanceSector` passes
 * `undefined` — `hopCount`'s single-sector semantics must not leak into
 * sector 2), but the scatter probe dials are chartered to shape EVERY
 * sector's map (the deep-end elite/port reads are the point; gotcha #121).
 * 74e adds `eventChance` (same charter — an event-density probe that only
 * shaped act 1 would repeat the #121 silent-scope bug). Returns `undefined`
 * when no dial is set, so the no-dial path stays byte-identical to the
 * config-less call.
 */
export function sectorAdvanceConfig(config?: RunConfig): RunConfig | undefined {
  if (
    config?.eliteChance === undefined &&
    config?.portChance === undefined &&
    config?.eventChance === undefined
  ) {
    return undefined;
  }
  const out: { eliteChance?: number; portChance?: number; eventChance?: number } = {};
  if (config.eliteChance !== undefined) out.eliteChance = config.eliteChance;
  if (config.portChance !== undefined) out.portChance = config.portChance;
  if (config.eventChance !== undefined) out.eventChance = config.eventChance;
  return out;
}

/**
 * URL query / CLI flag names — the single source of truth shared by the
 * browser parser and the CLI (which mirrors these as `--<name>` flags).
 */
export const RUN_CONFIG_PARAMS = {
  seed: 'seed',
  hops: 'hops',
  sectorHops: 'sectorHops',
  roster: 'roster',
  layout: 'layout',
  encounter: 'encounter',
  firstNode: 'firstNode',
  width: 'width',
  daemon: 'daemon',
  character: 'character',
  bits: 'bits',
} as const;

type MutableRunConfig = { -readonly [K in keyof RunConfig]: RunConfig[K] };

/** Any integer (incl. 0 / negative — RNG normalizes). Undefined if absent / non-integer. */
function parseIntStrict(raw: string | null): number | undefined {
  if (raw === null || raw.trim() === '') return undefined;
  const n = Number(raw);
  return Number.isInteger(n) ? n : undefined;
}

/** A strictly-positive integer (hops / widths). Undefined if absent / invalid. */
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

/** Sentinel `forcedLayoutId` value that forces a PROCEDURAL map every battle
 *  (vs forcing a named hand-authored layout). Distinct from `undefined`
 *  (absent → normal procedural/layout roll). */
export const FORCE_PROCEDURAL = 'procedural';

/** A known layout id, or the `procedural` sentinel. Undefined if absent or not
 *  a recognized value. */
function parseLayout(raw: string | null): string | undefined {
  if (!raw) return undefined;
  if (raw.trim().toLowerCase() === FORCE_PROCEDURAL) return FORCE_PROCEDURAL;
  return LAYOUT_IDS.includes(raw) ? raw : undefined;
}

/** 53d — a known encounter id (case-sensitive — the catalog mixes kebab and
 *  camelCase ids). Unknown / absent → undefined (normal pool selection),
 *  matching `parseLayout`'s drop-don't-throw discipline. */
function parseEncounter(raw: string | null): string | undefined {
  if (!raw) return undefined;
  const token = raw.trim();
  return ENCOUNTER_IDS.includes(token) ? token : undefined;
}

/** L1 — `none` → null (daemon-less), a catalog id → that daemon, anything
 *  else (absent / unknown id) → undefined (63d: no override → the
 *  character's daemon; the run-start roll retired at 63c). */
function parseDaemon(raw: string | null): DaemonConfig | null | undefined {
  if (!raw) return undefined;
  const token = raw.trim().toLowerCase();
  if (token === 'none') return null;
  return daemonById(token);
}

/** 63d — a catalog character id → the resolved def; absent / unknown →
 *  undefined (the parseLayout drop-don't-throw discipline). In the browser,
 *  undefined means "no URL bypass" — 63e shows the select scene; headless
 *  callers fall through to Run's Soldier default. */
function parseCharacter(raw: string | null): CharacterConfig | undefined {
  if (!raw) return undefined;
  return characterById(raw.trim().toLowerCase());
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
  const hopCount = parsePositiveInt(params.get(RUN_CONFIG_PARAMS.hops));
  if (hopCount !== undefined) config.hopCount = hopCount;
  const sectorHops = parsePositiveInt(params.get(RUN_CONFIG_PARAMS.sectorHops));
  if (sectorHops !== undefined) config.sectorHops = sectorHops;
  const startingRoster = parseRoster(params.get(RUN_CONFIG_PARAMS.roster));
  if (startingRoster !== undefined) config.startingRoster = startingRoster;
  const forcedLayoutId = parseLayout(params.get(RUN_CONFIG_PARAMS.layout));
  if (forcedLayoutId !== undefined) config.forcedLayoutId = forcedLayoutId;
  const forcedEncounterId = parseEncounter(params.get(RUN_CONFIG_PARAMS.encounter));
  if (forcedEncounterId !== undefined) config.forcedEncounterId = forcedEncounterId;
  // 68e→74b — the supported stamps are 'elite' and 'event'; other values
  // dropped (the `layout=` unknown-token discipline).
  const firstNode = params.get(RUN_CONFIG_PARAMS.firstNode);
  if (firstNode === 'elite' || firstNode === 'event') config.firstNodeKind = firstNode;
  const mapMaxWidth = parsePositiveInt(params.get(RUN_CONFIG_PARAMS.width));
  if (mapMaxWidth !== undefined) config.mapMaxWidth = mapMaxWidth;
  const daemon = parseDaemon(params.get(RUN_CONFIG_PARAMS.daemon));
  if (daemon !== undefined) config.daemon = daemon;
  const character = parseCharacter(params.get(RUN_CONFIG_PARAMS.character));
  if (character !== undefined) config.character = character;
  // 47e — a nonnegative integer (0 is meaningful: force a broke run even if
  // the config default ever moves above zero).
  const startingBits = parseIntStrict(params.get(RUN_CONFIG_PARAMS.bits));
  if (startingBits !== undefined && startingBits >= 0) config.startingBits = startingBits;
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
  if (config.hopCount !== undefined) {
    params.set(RUN_CONFIG_PARAMS.hops, String(config.hopCount));
  }
  if (config.sectorHops !== undefined) {
    params.set(RUN_CONFIG_PARAMS.sectorHops, String(config.sectorHops));
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
  if (config.forcedEncounterId !== undefined) {
    params.set(RUN_CONFIG_PARAMS.encounter, config.forcedEncounterId);
  }
  if (config.firstNodeKind !== undefined) {
    params.set(RUN_CONFIG_PARAMS.firstNode, config.firstNodeKind);
  }
  if (config.mapMaxWidth !== undefined) {
    params.set(RUN_CONFIG_PARAMS.width, String(config.mapMaxWidth));
  }
  if (config.daemon !== undefined) {
    // A bespoke (non-catalog) daemon round-trips by id only if the catalog
    // resolves it — acceptable: the URL form is a dev/playtest convenience.
    params.set(RUN_CONFIG_PARAMS.daemon, config.daemon === null ? 'none' : config.daemon.id);
  }
  if (config.character !== undefined) {
    params.set(RUN_CONFIG_PARAMS.character, config.character.id);
  }
  if (config.startingBits !== undefined) {
    params.set(RUN_CONFIG_PARAMS.bits, String(config.startingBits));
  }
  return params.toString();
}
