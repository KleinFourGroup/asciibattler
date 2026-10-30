/**
 * RunConfig: the dials of one run (a short run, a forced layout or
 * encounter, a measurement arm), read by the browser (`Game.ts`) and by the
 * headless paths (the fuzz harness and the `tools/run-config` CLI).
 *
 * A RunConfig is a run's input, not its state, so the snapshot does not
 * carry it. A save keeps the dials that have a URL form as query text beside
 * the snapshot (`runConfigToQueryString`), and a load hands them back
 * (`Run.fromJSON`'s `config`); a dial with no URL form is not saved, so a
 * load falls back to its default. A load applies only the inputs read after
 * construction; the rest shaped the snapshot, which wins (`Run.fromJSON`).
 *
 * Every dial takes effect only when its field is set, so a run with no
 * config is the shipped run. The run's streams are derived per occurrence by
 * key (`Run.streamRng`), so a dial that changes one consumer's draws never
 * shifts another's.
 */

import { ALL_ARCHETYPES, type Archetype } from '../sim/archetypes';
import { LAYOUT_IDS } from '../sim/layouts';
import { LEVELING } from '../config/leveling';
import { daemonById, type DaemonConfig } from '../config/daemons';
import { characterById, type CharacterConfig } from '../config/characters';
import { ENCOUNTER_IDS, getEncounter } from '../config/encounters';
import { ESCALATION_MAX } from '../config/escalation';
import type { SectorMap } from '../config/sectorMap';
import { EVENT_IDS, type EventDef } from '../config/events';
import {
  SCRIPT_KINDS,
  dialEntries,
  scriptConflicts,
  scriptToString,
  type EncounterKindOf,
  type PortGood,
  type ScriptEntry,
  type ScriptKind,
} from './RunScript';
import { packetById } from '../config/packets';
import { PRICES } from '../config/prices';
import { SECTOR_MAP } from '../config/sectorMap';
import { sectorsAtAct } from './sectorWalk';

/** One starting-roster slot: an archetype at a level (at least 1, capped). */
export interface RosterEntry {
  readonly archetype: Archetype;
  readonly level: number;
}

/**
 * Each dial says its URL form if it has one; one without is set only by
 * code (the fuzz harness, a test, a tool), so a save does not keep it (the
 * header).
 */
export interface RunConfig {
  /**
   * The run seed. Unset, the caller picks one (the browser takes
   * `Date.now()`). Any integer; the RNG takes it `>>> 0`. URL form: `seed=N`.
   */
  readonly seed?: number;
  /**
   * The hops of the run's sector, root and terminal included; unset, each
   * sector's authored `length`. Setting it makes the run a single-sector
   * probe: the sector's terminal is the run's terminal and the sector walk
   * never advances, which is what every `SHORT` harness fixture means. For a
   * shortened run that still walks the whole sector map, use `sectorHops`;
   * the two together throw at construction. URL form: `hops=N`.
   */
  readonly hopCount?: number;
  /**
   * The shortened full walk: every sector's map is exactly this many hops,
   * in place of each sector's authored `length` (not a cap), while the walk
   * still goes on to the map's real sink, so `sectorHops: 4` on the shipped
   * two-sector map is a 4 + 4 hop run in two acts. The cheap shape for a
   * multi-sector read. URL form: `sectorHops=4`.
   */
  readonly sectorHops?: number;
  /**
   * Replace the starting roster with these archetypes, each at a chosen
   * level. URL form: `roster=rogue:3,healer:2,melee`, where `:level` is
   * optional (1 when absent).
   */
  readonly startingRoster?: readonly RosterEntry[];
  /** Force every battle onto a named layout (a `LAYOUT_IDS` member), or with
   *  `FORCE_PROCEDURAL` (`'procedural'`) onto a fresh procedural map. URL
   *  form: `layout=river` or `layout=procedural`. */
  readonly forcedLayoutId?: string;
  /**
   * Force an authored encounter (a catalog `Encounter.id`) at every node
   * whose kind matches its kind (`selectEncounter`'s force-select), past the
   * sector's pool and hop gate, for a clean sample of one encounter. A node
   * of another kind keeps its usual selection (boss and elite nodes still
   * draw their own). Checked loudly at construction. URL form:
   * `encounter=artillery`, case-sensitive, an unknown id dropped as for
   * `layout=`. With `hops`, `layout`, `seed`, `roster` and `daemon=none`
   * it pins the whole battle for the browser and the headless CLI alike;
   * `encounter=` alone does not pin the board, since the layout still rolls.
   */
  readonly forcedEncounterId?: string;
  /**
   * Stamp the first sector's root node with this kind after generation. The
   * stamp draws nothing, so the map and every other node's kind are as they
   * would be without it, and only the first sector's map takes it (a sector
   * advance regenerates without the config, gotcha #121). Ignored when the
   * root is the terminal (`hopCount: 1`), where the boss wins. URL form:
   * `firstNode=elite`, `=event` or `=rest`.
   * - `elite` — with `hopCount: 2` and `forcedEncounterId`, the run's first
   *   fight is the forced elite met at a full pool, so its pool reading
   *   measures the encounter and not the pool the run arrived with.
   * - `event` — the run opens on an event (with `forcedEventId`, a named one).
   * - `rest` — the run opens on the rest gate, so its page is one URL away.
   */
  readonly firstNodeKind?: 'elite' | 'event' | 'rest';
  /**
   * Force every event node to open this event (a `config/events.json` id),
   * past the eligibility-filtered pick; checked loudly at construction. The
   * roll that turns an event node into a fight still comes first, so on some
   * seeds the node is a fight and no page opens. URL form: `event=<id>`,
   * which with `firstNode=event` opens a run on a named event; an unknown id
   * is dropped.
   */
  readonly forcedEventId?: string;
  /**
   * The run's script (`RunScript.ts`): per-hop entries, each an address and
   * what it sets there, of which the four dials above are cases. A numbered
   * hop's entry stamps its kind on the hop's nodes and holds there; a starred
   * one applies wherever its kind fits, as the dials do. Checked at
   * construction: a contradiction, or a numbered hop past its act's end,
   * throws. URL form: `script=3:event=cadre-1;6:encounter=brigands,layout=river;8:port=rogue:3/overclock/mars`
   * (`;` between entries, `:` after the address, `,` between items, `/`
   * between a port's goods), an entry the parse can't read dropped with a
   * warning.
   */
  readonly script?: readonly ScriptEntry[];
  /**
   * The act the run opens at, from 1: the sector walk's Nth sector, entered
   * at the sector index a full walk has there, so its map, its boss and every
   * stream keyed to it are a full walk's. With `hopCount` that act is played
   * alone; without, the walk goes on to the map's end. A bare numbered hop
   * in the script is in this act. It is spent at construction, and the
   * snapshot holds where the run is, so a rollout clone stays in the act. An
   * act past the map's end throws. URL form: `act=2`, one past the shipped
   * map's end dropped with a warning.
   */
  readonly startAct?: number;
  /**
   * What the URL parse dropped from `script=` and `act=`, one line each; the run
   * reports them with its own (`Run.scriptWarnings`). Not a dial: no URL
   * form writes it back.
   */
  readonly scriptWarnings?: readonly string[];
  /**
   * Replace the event catalog, for headless tests. Its defs live in memory
   * only: a save taken mid-event under it is rejected by a load that does
   * not pass the same catalog.
   */
  readonly eventCatalog?: readonly EventDef[];
  /**
   * The middle hops' maximum width; unset, `middleWidthMax` in
   * `config/nodemap.json`. The generator raises it to a hop's minimum width,
   * so a value too small pins to the minimum. URL form: `width=N`.
   */
  readonly mapMaxWidth?: number;
  /**
   * The map's elite, port and event scatter chances; unset, `eliteChance`,
   * `portChance` and `eventChance` in `config/nodemap.json`. The probe dials
   * for a read of one node kind: `eliteChance: 1` offers an elite on every
   * hop the spacing allows (one elite a hop, so taking it is still the
   * walker's choice; pair with `firstNodeKind` to force it taken), and
   * `eventChance: 0` is the event-free control arm. Unlike the other map
   * dials they shape every sector's map (`sectorAdvanceConfig`).
   * `eventMinSpacing` is set in the JSON only, as the elite and port
   * spacings are.
   */
  readonly eliteChance?: number;
  readonly portChance?: number;
  readonly eventChance?: number;
  /**
   * The run's daemon: a `DaemonConfig` (a catalog entry, or one built for a
   * test), or `null` for a run that starts with none (the fuzz's control
   * arm); a reward, a port or an event can still add one. Unset, the
   * character's starting daemon.
   * URL form: `daemon=mars` (a catalog id) or `daemon=none`.
   */
  readonly daemon?: DaemonConfig | null;
  /**
   * The run's starting character (a resolved `config/characters.json` def);
   * unset, `DEFAULT_CHARACTER_ID` (the Soldier), so a bare headless
   * construction works. It gives the starting roster, the starting daemon,
   * and the draft pools (its blacklist and its weights within a tier). An
   * explicit `startingRoster` or `daemon` beats the character's own, so a
   * measurement arm keeps its isolation (`--character=priest --daemon=none`
   * is the Priest without Minerva). The snapshot keeps the resolved
   * `characterId`. URL form: `character=<id>`, an unknown id dropped as for
   * `layout=`; the harness's flag is `--character`.
   */
  readonly character?: CharacterConfig;
  /**
   * Replace the sector map (`SECTOR_MAP` unset), for headless multi-sector
   * tests. A load without it falls back to the shipped map, so a snapshot
   * taken under a fixture map loads onto node ids the shipped map does not
   * know; the game's own saves always come from the shipped map.
   */
  readonly sectorMap?: SectorMap;
  /**
   * The per-run difficulty multipliers on every authored encounter's waves,
   * applied as a wave resolves: `waveSizeMultiplier` scales the resolved
   * count, `levelBudgetMultiplier` the resolved level budget (which a wave's
   * `levelCap` still bounds). Unset, the `config/difficulty.json` defaults
   * (1, no scaling; `resolveDifficultyMultipliers`, `config/difficulty.ts`).
   */
  readonly waveSizeMultiplier?: number;
  readonly levelBudgetMultiplier?: number;
  /**
   * The per-run bits multiplier: scales every bits earn where `Run.gainBits`
   * settles it, times the folded `bitsGain` stat, so reward rolls, battle
   * tallies and daemon hooks all scale alike. Applied in the run, never in
   * `WaveContext`. Unset, the `config/difficulty.json` default (1).
   */
  readonly bitsMultiplier?: number;
  /**
   * The per-run enemy-morale multiplier: scales every encounter's enemy pool
   * where the run reads it, to the nearest whole (`scaledEnemyPool`,
   * `config/difficulty.ts`). Applied in the run, never in `WaveContext`.
   * Unset, the `config/difficulty.json` default (1, the authored pool).
   */
  readonly enemyMoraleMultiplier?: number;
  /**
   * The run's Escalation level (`config/escalation.ts`), 1 to
   * `ESCALATION_MAX`; unset is 0, Escalation off. The level's factors
   * multiply onto the four difficulty multipliers above. The snapshot keeps
   * the level and a load reads it from there, so a rollout clone, which
   * loads with no config, plays at the live run's level. URL form:
   * `escalation=3`, a value outside 1 to the maximum dropped as for
   * `layout=`; a journal's seed start spells the level so for its replay.
   * Code may pass 0; anything else off the ladder throws at construction.
   */
  readonly escalation?: number;
  /**
   * The run's starting bits; unset, `startingBits` in
   * `config/difficulty.json`. Draws nothing; the constructor floors it at
   * 0. URL form: `bits=100`.
   */
  readonly startingBits?: number;
  /**
   * A per-run amount added to `drawAmount`, the dial for an A/B read of the
   * hand's size: `Run.effectiveRunStats` folds it as it would a daemon's
   * `modifier` rule, so the turn's deal and the enemy budget's draw basis
   * both see it, as a lasting fold and unlike a packet's one-turn draw. The
   * fuzz flag is `--draw-add=<n>` (run mode). Unset or 0 injects no
   * modifier, so the fold keeps its no-modifier path.
   */
  readonly drawAmountAdd?: number;
  /**
   * Override the grant queue's strict mode (`grantQueue.passIsFinal` in
   * `config/deck.json`) for this run, so tests and the fuzz can play both
   * modes without a config edit. Draws nothing.
   */
  readonly passIsFinal?: boolean;
  /**
   * Hand the run these items free at construction, so a same-seed pair with
   * and without one reads the item's value. Each id resolves as a daemon, a
   * packet or a unit archetype, in that order, and an id that is none of
   * them throws at construction. Applied in order, so a cache-size daemon
   * granted before packets raises the capacity they are checked against.
   * Duplicates are legal: a second copy is a probe of a stacking rule.
   * Daemon and packet grants draw nothing; a unit grant draws its level-ups
   * from the team stream after the roster. The fuzz flag is `--grant` (run
   * mode). What a grant adds is saved as the run's own daemons, cache and
   * team.
   */
  readonly grants?: readonly string[];
}

/**
 * The slice of a RunConfig that survives a sector advance. `advanceSector`
 * regenerates the map without the config, so `hopCount`'s single-sector
 * probe does not reach the second sector, but the scatter dials are meant
 * to shape every sector's map (gotcha #121). Returns `undefined` when none
 * is set, so the call without dials is the call without a config.
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
 * The URL query names, one source for the browser's parser and the
 * `tools/run-config` CLI, which takes each as a `--<name>` flag.
 */
export const RUN_CONFIG_PARAMS = {
  seed: 'seed',
  hops: 'hops',
  sectorHops: 'sectorHops',
  roster: 'roster',
  layout: 'layout',
  encounter: 'encounter',
  firstNode: 'firstNode',
  event: 'event',
  script: 'script',
  act: 'act',
  width: 'width',
  daemon: 'daemon',
  character: 'character',
  bits: 'bits',
  escalation: 'escalation',
} as const;

type MutableRunConfig = { -readonly [K in keyof RunConfig]: RunConfig[K] };

/** Any integer, 0 and negatives included (the RNG normalizes them);
 *  undefined when absent or not an integer. */
function parseIntStrict(raw: string | null): number | undefined {
  if (raw === null || raw.trim() === '') return undefined;
  const n = Number(raw);
  return Number.isInteger(n) ? n : undefined;
}

/** An integer above 0 (hops, widths); undefined when absent or invalid. */
function parsePositiveInt(raw: string | null): number | undefined {
  const n = parseIntStrict(raw);
  return n !== undefined && n > 0 ? n : undefined;
}

/** Clamp a roster level into `[1, levelCap]`. */
function clampLevel(level: number): number {
  return Math.min(Math.max(1, level), LEVELING.levelCap);
}

/**
 * Comma-separated `archetype[:level]` tokens. An archetype not in
 * `ALL_ARCHETYPES` drops its token; `:level` is optional, 1 when missing or
 * not above 0, and capped at the level cap. Undefined when no token is
 * valid.
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

/** The `forcedLayoutId` that forces a procedural map in every battle, where
 *  a layout id forces that authored layout. Not `undefined`, which leaves
 *  the usual roll. */
export const FORCE_PROCEDURAL = 'procedural';

/** A known layout id, or `procedural`; undefined when absent or unknown. */
function parseLayout(raw: string | null): string | undefined {
  if (!raw) return undefined;
  if (raw.trim().toLowerCase() === FORCE_PROCEDURAL) return FORCE_PROCEDURAL;
  return LAYOUT_IDS.includes(raw) ? raw : undefined;
}

/** A known encounter id, case-sensitive since the catalog mixes kebab and
 *  camel case. Unknown or absent is undefined (the pool's usual pick):
 *  dropped, as `parseLayout` drops, not thrown. */
function parseEncounter(raw: string | null): string | undefined {
  if (!raw) return undefined;
  const token = raw.trim();
  return ENCOUNTER_IDS.includes(token) ? token : undefined;
}

/** A known event id, as written in the catalog. Unknown or absent is
 *  undefined (the node's own pick), as `parseEncounter` drops and does not
 *  throw. */
function parseEvent(raw: string | null): string | undefined {
  if (!raw) return undefined;
  const token = raw.trim();
  return EVENT_IDS.includes(token) ? token : undefined;
}

const encounterKind: EncounterKindOf = (id) => getEncounter(id)?.kind;

/**
 * `port=`'s goods, `/` between them: each id a daemon, a packet or an
 * archetype, in that order (as `grants` resolves), a unit's `:level` clamped
 * as `roster=`'s is. A good no catalog holds, a level on a daemon or a
 * packet, and a good past the shipped slots of its kind (`PRICES.portStock`)
 * are dropped, each through `drop`.
 */
export function parsePortGoods(raw: string, drop: (why: string) => void): PortGood[] {
  const goods: PortGood[] = [];
  const count = { unit: 0, packet: 0, daemon: 0 };
  const slots = { unit: PRICES.portStock.units, packet: PRICES.portStock.packets, daemon: PRICES.portStock.daemons };
  for (const token of raw.split('/').map((t) => t.trim())) {
    if (token === '') continue;
    const [idPart, levelPart] = token.split(':');
    const id = (idPart ?? '').trim();
    const good: PortGood | undefined =
      daemonById(id) !== undefined
        ? { kind: 'daemon', id }
        : packetById(id) !== undefined
          ? { kind: 'packet', id }
          : (ALL_ARCHETYPES as readonly string[]).includes(id.toLowerCase())
            ? levelPart === undefined
              ? { kind: 'unit', archetype: id.toLowerCase() }
              : { kind: 'unit', archetype: id.toLowerCase(), level: clampLevel(parsePositiveInt(levelPart) ?? 1) }
            : undefined;
    if (good === undefined) {
      drop(`port good "${token}" is no daemon, packet or archetype`);
    } else if (good.kind !== 'unit' && levelPart !== undefined) {
      drop(`port good "${token}": only a unit takes a level`);
    } else if (count[good.kind] >= slots[good.kind]) {
      drop(`port good "${token}": a port holds ${slots[good.kind]} of its kind`);
    } else {
      count[good.kind]++;
      goods.push(good);
    }
  }
  return goods;
}

/** An entry's address: a hop, `act.hop`, `*` or `act.*`, each number 1 up. */
const ADDRESS = /^(?:(\d+)\.)?(\d+|\*)$/;

type MutableScriptEntry = { -readonly [K in keyof ScriptEntry]: ScriptEntry[K] };

/**
 * `script=`'s value as entries (the grammar is `RunConfig.script`'s), with
 * a warning for each part dropped: an address it can't read, an item with an
 * unknown id or no meaning, a kind on a starred address, and an entry that
 * contradicts the dials or the entries kept before it (`scriptConflicts`).
 * `dials` are the old dials' entries, which a script entry may not
 * contradict either; `startAct` is the act a bare hop is in.
 */
export function parseScript(
  raw: string | null,
  dials: readonly ScriptEntry[],
  startAct = 1,
): { entries: ScriptEntry[]; warnings: string[] } {
  const entries: ScriptEntry[] = [];
  const warnings: string[] = [];
  if (!raw) return { entries, warnings };
  for (const text of raw.split(';').map((t) => t.trim())) {
    if (text === '') continue;
    const colon = text.indexOf(':');
    const address = ADDRESS.exec(colon < 0 ? '' : text.slice(0, colon).trim());
    const act = address?.[1] === undefined ? undefined : Number(address[1]);
    const hopText = address?.[2];
    const hop = hopText === undefined ? undefined : hopText === '*' ? 'all' : Number(hopText);
    if (hop === undefined || hop === 0 || act === 0) {
      warnings.push(`script: dropped "${text}": no address (a hop, act.hop, * or act.*, from 1) before a ":"`);
      continue;
    }
    const entry: MutableScriptEntry = { hop };
    if (act !== undefined) entry.act = act;
    for (const item of text.slice(colon + 1).split(',').map((t) => t.trim())) {
      if (item === '') continue;
      const eq = item.indexOf('=');
      const name = eq < 0 ? item : item.slice(0, eq);
      const value = eq < 0 ? null : item.slice(eq + 1);
      const drop = (why: string): void => {
        warnings.push(`script: dropped "${item}" from "${text}": ${why}`);
      };
      if (eq < 0 && (SCRIPT_KINDS as readonly string[]).includes(name)) {
        if (hop === 'all') drop('a kind needs a numbered hop');
        else entry.kind = name as ScriptKind;
      } else if (name === 'encounter') {
        const id = parseEncounter(value);
        if (id === undefined) drop('no such encounter');
        else entry.encounter = id;
      } else if (name === 'layout') {
        const id = parseLayout(value);
        if (id === undefined) drop('no such layout');
        else entry.layout = id;
      } else if (name === 'event') {
        const id = parseEvent(value);
        if (id === undefined) drop('no such event');
        else entry.event = id;
      } else if (name === 'port') {
        const port = parsePortGoods(value ?? '', (why) => drop(why));
        if (port.length === 0) drop('no good it names is in a catalog');
        else entry.port = port;
      } else {
        drop('not a kind (battle, elite, event, rest, port) or an item (encounter=, layout=, event=, port=)');
      }
    }
    if (Object.keys(entry).every((k) => k === 'act' || k === 'hop')) {
      warnings.push(`script: dropped "${text}": nothing left to set`);
      continue;
    }
    // A bare hop is in the starting act, as at the run's own check.
    const before = scriptConflicts([...dials, ...entries], startAct, encounterKind);
    const after = scriptConflicts([...dials, ...entries, entry], startAct, encounterKind);
    if (after.length > before.length) {
      warnings.push(`script: dropped "${text}": ${after.slice(before.length).join('; ')}`);
      continue;
    }
    entries.push(entry);
  }
  return { entries, warnings };
}

/** `none` is null (no daemon), a catalog id that daemon, and anything else,
 *  absent or unknown, undefined: no override, so the character's daemon. */
function parseDaemon(raw: string | null): DaemonConfig | null | undefined {
  if (!raw) return undefined;
  const token = raw.trim().toLowerCase();
  if (token === 'none') return null;
  return daemonById(token);
}

/** A catalog character id resolves to its def; absent or unknown is
 *  undefined, dropped as `parseLayout` drops. In the browser undefined means
 *  the character-select screen shows; a headless caller gets the Soldier. */
function parseCharacter(raw: string | null): CharacterConfig | undefined {
  if (!raw) return undefined;
  return characterById(raw.trim().toLowerCase());
}

/**
 * Build a RunConfig from `URLSearchParams`. Unset and invalid fields are
 * left out, so the result carries only explicit dials. Pure, with no DOM,
 * so the CLI and a load call it on params they build.
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
  // The stamps are 'elite', 'event' and 'rest'; any other value is dropped,
  // as `layout=` drops an unknown one.
  const firstNode = params.get(RUN_CONFIG_PARAMS.firstNode);
  if (firstNode === 'elite' || firstNode === 'event' || firstNode === 'rest') {
    config.firstNodeKind = firstNode;
  }
  const forcedEventId = parseEvent(params.get(RUN_CONFIG_PARAMS.event));
  if (forcedEventId !== undefined) config.forcedEventId = forcedEventId;
  // The starting act, then the script after the dials, so an entry that
  // contradicts one drops and a bare hop is in the starting act.
  const warnings: string[] = [];
  const actRaw = params.get(RUN_CONFIG_PARAMS.act);
  const startAct = parsePositiveInt(actRaw);
  if (startAct !== undefined && sectorsAtAct(SECTOR_MAP, startAct).length > 0) {
    config.startAct = startAct;
  } else if (actRaw !== null) {
    warnings.push(`act: dropped "${actRaw}": the map has no such act`);
  }
  const script = parseScript(params.get(RUN_CONFIG_PARAMS.script), dialEntries(config), config.startAct ?? 1);
  if (script.entries.length > 0) config.script = script.entries;
  warnings.push(...script.warnings);
  if (warnings.length > 0) config.scriptWarnings = warnings;
  const mapMaxWidth = parsePositiveInt(params.get(RUN_CONFIG_PARAMS.width));
  if (mapMaxWidth !== undefined) config.mapMaxWidth = mapMaxWidth;
  const daemon = parseDaemon(params.get(RUN_CONFIG_PARAMS.daemon));
  if (daemon !== undefined) config.daemon = daemon;
  const character = parseCharacter(params.get(RUN_CONFIG_PARAMS.character));
  if (character !== undefined) config.character = character;
  // An integer of at least 0; 0 is a dial too, a run that starts broke
  // whatever the config's default.
  const startingBits = parseIntStrict(params.get(RUN_CONFIG_PARAMS.bits));
  if (startingBits !== undefined && startingBits >= 0) config.startingBits = startingBits;
  // A level of the ladder, 1 up. `escalation=0` says what no dial says, so it
  // parses to nothing and a page carrying it alone is a plain boot.
  const escalation = parsePositiveInt(params.get(RUN_CONFIG_PARAMS.escalation));
  if (escalation !== undefined && escalation <= ESCALATION_MAX) config.escalation = escalation;
  return config;
}

/**
 * The browser's entry: parse `location.search`, or a query string passed in.
 * Without a `location` global (a headless import) the config is empty.
 */
export function parseRunConfigFromURL(search?: string): RunConfig {
  const query = search ?? (typeof location !== 'undefined' ? location.search : '');
  return parseRunConfig(new URLSearchParams(query));
}

/**
 * Write a RunConfig back as a query string (no leading `?`), the inverse of
 * `parseRunConfig` for the fields it reads. `Game` keeps a run's dials in
 * this form for its save and its journal, and the CLI prints a browser URL
 * for the same run with it.
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
  if (config.forcedEventId !== undefined) {
    params.set(RUN_CONFIG_PARAMS.event, config.forcedEventId);
  }
  // The dials above keep their own names, so a URL without a script writes
  // back as it always did.
  if (config.script !== undefined && config.script.length > 0) {
    params.set(RUN_CONFIG_PARAMS.script, scriptToString(config.script));
  }
  if (config.startAct !== undefined) {
    params.set(RUN_CONFIG_PARAMS.act, String(config.startAct));
  }
  if (config.mapMaxWidth !== undefined) {
    params.set(RUN_CONFIG_PARAMS.width, String(config.mapMaxWidth));
  }
  if (config.daemon !== undefined) {
    // A daemon built outside the catalog comes back by id only if the
    // catalog knows the id; the URL form is for a dev or playtest run.
    params.set(RUN_CONFIG_PARAMS.daemon, config.daemon === null ? 'none' : config.daemon.id);
  }
  if (config.character !== undefined) {
    params.set(RUN_CONFIG_PARAMS.character, config.character.id);
  }
  if (config.startingBits !== undefined) {
    params.set(RUN_CONFIG_PARAMS.bits, String(config.startingBits));
  }
  // Level 0 is spelled by no dial, so a run with Escalation off has the
  // dials it had before the ladder.
  if (config.escalation !== undefined && config.escalation > 0) {
    params.set(RUN_CONFIG_PARAMS.escalation, String(config.escalation));
  }
  return params.toString();
}
