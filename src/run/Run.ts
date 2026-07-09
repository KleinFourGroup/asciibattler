/**
 * Run-level state machine. Owns the meta state that survives across battles:
 * the seeded RNG, the generated NodeMap, the player roster, the current
 * position on the map, and which phase the run is in.
 *
 * Phases:
 *
 *   map ── enterNode (frontier) ──▶ battle
 *   battle ── battle:ended (player win, non-terminal)        ──▶ recruit
 *   battle ── battle:ended (player win, terminal @ DAG sink) ──▶ complete
 *   battle ── battle:ended (player win, terminal, non-sink)  ──▶ map (next sector)
 *   battle ── battle:ended (enemy win)                       ──▶ defeat
 *   recruit ── chooseRecruit ──▶ map
 *
 * 48b — a winning final turn interposes the gate chain BEFORE the win path
 * above: reward (if the encounter's refs rolled an offer) → promotion (if
 * units leveled) → the recruit/complete fork (`continueFromTurnGate`).
 *
 * T2 — the run is a *sequence of sectors* (a sector = one node-map + its layout
 * pool/theme/length, selected off the sector-selection DAG in `sectorWalk.ts`).
 * Clearing a sector's terminal advances to a successor sector unless that DAG
 * node is a sink (→ run complete). Only "The Start" ships (source == sink), so
 * today every run is a single sector ending in run:victory.
 *
 * Run does NOT construct the World. Instead it builds an Encounter snapshot
 * (worldSeed + rolled teams) and fires `battle:started`; Game owns the World
 * lifecycle and reads `run.currentEncounter` to set up the next battle.
 *
 * **A2 command channel.** Imperative inputs from the UI — entering a node,
 * picking a recruit, resetting the run — come in through `dispatch()` /
 * the `RunDispatcher` interface, not via bus events. Output notifications
 * (run:started, recruit:offered, run:victory, run:defeated) stay on the
 * bus. The split mirrors the inputs (commands) vs outputs (events)
 * distinction the rest of the codebase now keeps.
 *
 * The RNG hierarchy is the load-bearing determinism invariant: one run RNG,
 * forked once per major draw (nodeMap, starting team, each battle). The
 * forked battle stream is independent of the parent, so the run stream stays
 * byte-identical across replays of the same seed — see TESTING.md.
 */

import type { EventBus } from '../core/EventBus';
import type { GameEvents, PromotionInfo } from '../core/events';
import { glyphForArchetype } from '../sim/archetypes';
import { RNG, type RNGSnapshot } from '../core/RNG';
import type { UnitTemplate } from '../sim/Unit';
import { rollUnit } from '../sim/archetypes';
import { generate as generateNodeMap, PRE_ROOT_NODE_ID, type NodeMap, type NodeKind } from './NodeMap';
import { FORCE_PROCEDURAL, type RunConfig } from './RunConfig';
import { getSector, type SectorDef } from '../config/sectors';
import { SECTOR_MAP, type SectorMap } from '../config/sectorMap';
import { pickStartSector, pickNextSector, isSectorSink } from './sectorWalk';
import { rollOffer, recruitLevelBonus } from './Recruitment';
import { avgTeamLevel } from './enemyBudget';
import { fatigueEffect } from './fatigue';
import {
  redrawAvailability,
  redrawRejection,
  type RedrawAvailability,
} from './redraw';
import { empowerRejection, empowerEffect } from './empower';
import {
  rollDaemon,
  resolveTurnGrants,
  resolveInstantHooks,
  battleRulesFor,
  disabledTurnGrants,
  daemonRedrawHook,
  daemonEmpowerHook,
  type TurnGrants,
  type InstantOp,
} from './daemon';
import type { BattleRule } from '../sim/battleRules';
import { foldRunStats, RUN_STAT_BASES, type RunStatKey, type RunStatModifier } from './runStats';
import { ECONOMY } from '../config/economy';
import { cloneEffect, mergeEffectInto, type StatusEffect } from '../sim/statusEffects';
import { TriggerDispatcher } from '../sim/triggers';
import type { RunCommand } from './Command';
import { RECRUITMENT } from '../config/recruitment';
import { TERRAIN } from '../config/terrain';
import { HEALTH } from '../config/health';
import { DECK } from '../config/deck';
import { resolveDifficultyMultipliers, type DifficultyMultipliers } from '../config/difficulty';
import { getEncounter, type Encounter } from '../config/encounters';
import { resolveWave, type WaveContext } from './encounters/wave';
import { waveForTurn, type WaveCursor, type EncounterState } from './encounters/sequencer';
import { selectEncounter } from './encounters/selection';
import { DAEMONS, daemonById, type DaemonConfig } from '../config/daemons';
import { packetById } from '../config/packets';
import { rewardTableById } from '../config/rewards';
import { rollRewards, type RewardPortion } from './rewards';
import { LAYOUT_IDS, getLayout, type Theme } from '../sim/layouts';
import { LEVELING } from '../config/leveling';
import { xpToNext } from '../sim/xp';
import { simulateLevelUps } from '../sim/leveling';
import { growthRatesForArchetype } from '../sim/archetypes';
import type { Archetype } from '../sim/archetypes';

// H4b adds the two TURN-GATE phases (`turn-intro` / `turn-outcome`) — entered
// only when `pauseAtTurnGates` is on, so the pre/post-turn screens can pause the
// encounter loop. The headless loop never enters them (it runs straight through
// `battle`), so existing headless tests + the fuzz harness are unaffected.
// 48b adds `reward` — entered on a WON final turn when the encounter's reward
// refs rolled a non-empty offer (both gated AND headless paths: the offer is a
// real decision, not presentation). The locked ordering: battle → reward →
// promotion → recruit (`continueFromTurnGate`).
export type RunPhase =
  | 'map'
  | 'turn-intro'
  | 'battle'
  | 'turn-outcome'
  | 'reward'
  | 'promotion'
  | 'recruit'
  | 'defeat'
  | 'complete';

export interface BattleEncounter {
  readonly worldSeed: number;
  /**
   * Independent RNG seed for terrain generation (C1a). Forked separately
   * from the combat seed so tweaking obstacle placement doesn't shift
   * unit roll outcomes. Drives wall + shallow-water layout via
   * `generateTerrain` in `src/sim/battleSetup.ts`.
   */
  readonly terrainSeed: number;
  /**
   * Optional hand-authored layout id (C1a plumbed but null-only — the
   * library lands in C1b+). When set, `generateTerrain` bypasses the
   * procedural path and loads a named layout from the library.
   */
  readonly layoutId: string | null;
  /**
   * D3 — battlefield dimensions for this encounter. Procedural encounters
   * roll a square side length in `[TERRAIN.proceduralMinSize,
   * TERRAIN.proceduralMaxSize]` from `battleRng` and set
   * `gridW === gridH`; hand-authored layouts pull from their own
   * `LayoutDef.gridW` / `LayoutDef.gridH`. Threaded into World +
   * TerrainRenderer + camera fit at battle-setup time.
   */
  readonly gridW: number;
  readonly gridH: number;
  /**
   * D8 — visual theme for this encounter's terrain palette. Cosmetic only;
   * no sim effects. Hand-authored layouts pull from `LayoutDef.theme`;
   * T2 — procedural encounters now inherit the **current sector's** theme
   * (no per-battle theme roll), so a sector reads as one consistent place.
   */
  readonly theme: Theme;
  readonly playerTeam: readonly UnitTemplate[];
  readonly enemyTeam: readonly UnitTemplate[];
  /**
   * 47f — the owned daemons' battle-domain hooks, compiled to plain data
   * (`battleRulesFor`) for the World to install at construction (the spec's
   * seam crossing; evaluation semantics in src/sim/battleRules.ts). Riding
   * the encounter is what reaches BOTH construction sites (BattleScene +
   * the fuzz harness) for free. Optional so the integration-test fixtures
   * that hand-build encounters stay untouched (absent = none); `beginTurn`
   * always sets it.
   */
  readonly battleRules?: readonly BattleRule[];
}

/** E4: bumped 3→5 in two steps. v4 added `xp` on UnitTemplate + the
 *  `levelupRng` stream. v5 adds `pendingPromotions` so a snapshot taken
 *  while PromotionScene is up restores in the same phase with the same
 *  per-unit deltas to render. v4 + earlier throw on load.
 *  H1: bumped 5→6. `power` was added to `UnitStats`, which changes the shape
 *  of the roster `team: UnitTemplate[]` (and `currentOffer`) that this
 *  snapshot stores. A v5 save carries `power`-less templates → reject outright
 *  rather than load a roster that NaNs on the next level-up (the World v17→18
 *  stat-shape-contract rationale, applied to the Run save). v5 + earlier throw
 *  on load.
 *  H3: bumped 6→7. Adds `deploymentCounts: number[]` (per-roster-slot
 *  deployment counter, parallel to `team`). A v6 save has no counts → reject
 *  rather than rehydrate a Run whose counter is out of sync with the roster.
 *  H4: bumped 7→8. Adds the encounter-loop state: `playerHealth` (the run-wide
 *  pool), `enemyHealth` + `turnIndex` + `encounterBudget` (the active
 *  encounter), and `pendingEncounterXp` (XP accrued across the encounter's
 *  turns, banked at encounter end). A v7 save has no pools → reject rather than
 *  rehydrate a Run mid-encounter with a missing/`NaN` health pool.
 *  H5: bumped 8→9. Adds the card deck: `drawPile` / `discardPile` / `hand`
 *  (rosterIndex values; the encounter-scoped draw→hand→discard cycle) + the
 *  dedicated `deckRng` stream. A v8 save has no deck → reject rather than
 *  rehydrate a Run mid-encounter with an undrawn (or stale) hand.
 *  I1: bumped 9→10. The roster `team: UnitTemplate[]` embeds `UnitStats`, and
 *  I1 reverted `agility → speed` + added `precision`/`evasion`. A v9 save
 *  carries the old `agility`-keyed, dodge-less stat block → reject rather than
 *  rehydrate a roster that would `NaN` on the next level-up (same stat-shape
 *  contract as the World v19 bump).
 *  I5: bumped 10→11. The roster embeds `archetype` tags, and I5 renamed
 *  `melee → mercenary` (+ new subclasses). A v10 save carries `'melee'`-tagged
 *  roster units that no longer resolve to a config → reject rather than
 *  rehydrate a roster that crashes on the next level-up / re-derive (same
 *  archetype-identity rationale as the World v20 bump).
 *  K1: bumped 11→12. Adds `encounterEffects: StatusEffect[][]` (per-roster-slot
 *  encounter-scoped status effects, parallel to `team`; the `endOfEncounter`
 *  store re-seeded each turn at deploy). A v11 save has no store → reject
 *  rather than rehydrate a Run mid-encounter with a missing buff list. (The
 *  per-turn fatigue + the World-side battle effects are NOT here — fatigue is
 *  recomputed each turn from `deploymentCounts`, and live battle effects live
 *  in the WorldSnapshot.)
 *  K3: bumped 12→13. Adds `redrawsUsedThisTurn` / `cardsRedrawnThisTurn` (the
 *  per-turn redraw budget bookkeeping). A v12 save has neither → reject rather
 *  than rehydrate a pre-turn gate whose redraw budget silently refreshed.
 *  K3.5: bumped 13→14. Adds `encounterMap` (ONE battlefield per encounter —
 *  layout/size/terrain/theme rolled once at encounter start, no longer
 *  re-rolled per turn). It's mid-encounter state that is NOT re-derivable per
 *  turn anymore, so a v13 save → reject rather than rehydrate an encounter
 *  that would re-roll its map.
 *  K4: bumped 14→15. Adds `empowersUsedThisTurn` (the per-turn empower budget
 *  bookkeeping, the redraw-counter analogue). A v14 save has no counter →
 *  reject rather than rehydrate a pre-turn gate whose empower budget silently
 *  refreshed. (The buff itself rides the v12 `encounterEffects` store — no
 *  shape change there.)
 *  L1: bumped 15→16. Adds the daemon layer: `daemon` (the run's rolled/forced
 *  daemon, stored WHOLE so a save survives catalog edits and bespoke test
 *  daemons round-trip), `daemonRng` (the dedicated roll + chance-flip stream),
 *  and `turnGates` (the CURRENT turn's resolved gates — a save taken at the
 *  pre-turn gate must restore the same Mercury flip, never re-roll it). A v15
 *  save has none of these → reject rather than rehydrate a run that would
 *  re-roll its daemon.
 *  M1: bumped 16→17. REMOVES `pendingEncounterXp` — the per-turn promotion
 *  cadence banks each turn's XP at the turn boundary, so no cross-turn XP
 *  accrual state exists anymore. A v16 save can carry accrued-but-unbanked
 *  XP that v17 code would silently drop → reject.
 *  S1: bumped 17→18 (Floor→Hop field rename on the persisted MapNode).
 *  S2: bumped 18→19 (the selectable root via the pre-root sentinel flow).
 *  T2: bumped 19→20. Adds the sector state: `currentSectorId` (the chosen
 *  sector — drives the node-map length, theme, + hop-gated layout pool) and
 *  `currentSectorNodeId` (the run's position on the sector-selection DAG, needed
 *  to pick the next sector on clearing a terminal). A v19 save predates the
 *  sector model → reject rather than rehydrate a run with no sector.
 *  U3: bumped 20→21. The encounter-model swap: retires `encounterBudget` (the
 *  per-encounter budget now lives in the authored wave spec) and adds
 *  `selectedEncounterId` + `waveCursor` (the selected encounter + the wave-list
 *  grammar position). A v20 save has a budget but no encounter/cursor → reject.
 *  V1: bumped 21→22. Encounter SELECTION + the catalog: the code-built
 *  reproduction (`selectedEncounterId: 'reproduction'`) was retired — encounters
 *  are now selected from `config/encounters.json` (ids `brigands`/`highwaymen`/
 *  `deserters`). A v21 save holding `'reproduction'` would resolve to no encounter
 *  → reject rather than rehydrate a broken run.
 *  W2: bumped 22→23. Elite map-nodes: `NodeMap.generate` now scatters `elite`
 *  nodes through the middle hops (a new RNG pass), so the persisted `nodeMap`
 *  for a given seed differs from a v22 map, and a node can now carry the new
 *  `elite` kind. A v22 save's map predates the elite scatter → reject rather
 *  than rehydrate a run whose map disagrees with the current generator.
 *  v24 — §37e renamed the terrain themes (`default → grassland`, `rock →
 *  barren`). `theme` is serialized (this `RunSnapshot`'s `encounterMap` +
 *  `currentEncounter`, both `ThemeSchema`-typed), so a v23 save carries the
 *  old strings, which now fail `ThemeSchema`. Reject-stale (no transform) —
 *  the version gate rejects the v23 save before the theme would be parsed.
 *  47c: bumped 24→25. The rule vocabulary: daemons re-authored from
 *  redraw/empower gate fields to `rules: Rule[]` (the serialized `daemon` is
 *  still stored whole, so its SHAPE changed), and the serialized `turnGates`
 *  (resolved gate configs) became `turnGrants` (the rule-engine fold —
 *  `resolveTurnGrants`). A v24 save carries a gate-shaped daemon + a
 *  `turnGates` field the rule engine can't read → reject.
 *  47d: bumped 25→26. Multi-daemon ownership: `daemon` (one whole object |
 *  null) becomes `daemonIds: string[]` (BY ID, def-resolved on load — an
 *  unknown id hard-rejects; bespoke daemons no longer round-trip, the 47
 *  shape-lock), `turnGrants.empower` becomes the per-source `empowers:
 *  EmpowerGrant[]` (the per-idol model), and `empowersUsedThisTurn` becomes
 *  a per-source array. A v25 save carries the old shapes → reject.
 *  47e: bumped 26→27. The bits substrate: adds `bits` (the run's currency
 *  balance — integer, floored at zero). A v26 save has no bits → reject.
 *  47f: bumped 27→28. The serialized `currentEncounter` (a `BattleEncounter`)
 *  gains `battleRules` (the owned daemons' compiled battle hooks — the World
 *  installs them at construction). A v27 save's mid-battle encounter lacks
 *  them → a resumed battle would silently fight without the run's daemons —
 *  reject.
 *  48b: bumped 28→29. The reward phase: adds the two dedicated reward
 *  streams (`rewardRng` sampling / `rewardBitsRng` bits rolls), the
 *  `pendingRewards` offer, and the `'reward'` member of `phase`. A v28 save
 *  lacks the streams (and could sit in a phase shape this engine routes
 *  differently) → reject.
 *  49b: bumped 29→30. The cache: adds `cache` (owned packet ids, acquisition
 *  order — the daemonIds def-resolved pattern). A v29 save has no cache →
 *  reject rather than rehydrate a run whose packets silently vanished. */
const RUN_SCHEMA_VERSION = 30;

/**
 * V1 — re-resolve a persisted `selectedEncounterId` to its `Encounter` from the
 * authored catalog. A null id (no active encounter) → null; an unknown id (a
 * retired catalog entry) → null too. (U3's code-built reproduction was retired
 * in V1: every encounter, Brigands included, is now `config/encounters.json`.)
 */
function resolveSelectedEncounter(id: string | null): Encounter | null {
  if (id === null) return null;
  return getEncounter(id) ?? null;
}

/**
 * K3.5 — the encounter's battlefield, rolled ONCE in `beginEncounter` (the
 * pre-K3.5 per-turn rolls in `beginTurn` now read from here): one map per
 * encounter, so the pre-turn redraw decision is informed rather than a blind
 * guess, and an encounter reads as one continuous fight on one field. The
 * per-turn variety that remains is the enemy WAVE + the world seed (unit RNG).
 * `gridW`/`gridH` are stored (not re-derived) because a procedural roll's side
 * isn't recoverable from `layoutId: null`.
 */
export interface EncounterMap {
  readonly layoutId: string | null;
  readonly gridW: number;
  readonly gridH: number;
  readonly terrainSeed: number;
  readonly theme: Theme;
}

export interface RunSnapshot {
  schemaVersion: typeof RUN_SCHEMA_VERSION;
  rng: RNGSnapshot;
  /** E4: separate stream for level-up stat rolls, forked from `rng` at
   *  Run construction. Lives independently so adding/removing a level-up
   *  source doesn't shift other run-RNG draws. */
  levelupRng: RNGSnapshot;
  /** H5: dedicated stream for deck shuffles + draws, forked from `rng` at
   *  construction (isolated like `levelupRng`). */
  deckRng: RNGSnapshot;
  /** L1: dedicated stream for the daemon roll + per-turn gate chance flips,
   *  forked from `rng` at construction (isolated like `levelupRng`). */
  daemonRng: RNGSnapshot;
  /** 48b: dedicated stream for reward chance tests + table sampling (the
   *  draw count is filter-dependent — isolation is load-bearing). */
  rewardRng: RNGSnapshot;
  /** 48b: dedicated stream for reward bits `{min,max}` rolls. */
  rewardBitsRng: RNGSnapshot;
  /** L1→47d: the run's owned daemons BY ID, in acquisition order (the
   *  def-resolved pattern — what makes uncapped multi-daemon cheap). An id
   *  missing from the catalog on load is a hard reject (no silent drops);
   *  bespoke non-catalog daemons are in-memory only and don't survive
   *  save/reload (the 47 shape-lock). Empty = a daemon-less run (both
   *  pre-turn tools permanently unavailable). */
  daemonIds: string[];
  /** L1→47c: the current turn's resolved pre-turn grants (`resolveTurnGrants`
   *  output). Persisted so a save at the gate restores the same chance flips. */
  turnGrants: TurnGrants;
  /** T2 — the run's position on the sector-selection DAG: the chosen sector
   *  (`currentSectorId` — its length/theme/layout-pool drive the active map) and
   *  the DAG node it was chosen at (`currentSectorNodeId` — the cursor the walk
   *  advances from on clearing a sector terminal). The `SectorMap` itself isn't
   *  persisted (a RunConfig input; a rehydrate falls back to the shipped map). */
  currentSectorId: string;
  currentSectorNodeId: string;
  nodeMap: NodeMap;
  team: UnitTemplate[];
  /** H3: per-roster-slot deployment counter, parallel to `team`. */
  deploymentCounts: number[];
  /** K1: per-roster-slot encounter-scoped status effects, parallel to `team`.
   *  The `endOfEncounter` store — set via `addEncounterEffect`, re-seeded onto
   *  the unit each turn at deploy, reset at encounter start. Empty per slot at
   *  the default (no daemon adds any), so a default run round-trips `[][]`. */
  encounterEffects: StatusEffect[][];
  /** H5: the encounter-scoped card deck — `rosterIndex` values in three piles.
   *  `drawPile` is the shuffled draw stack (drawn from the end), `discardPile`
   *  collects fought hands, `hand` is the current turn's drawn cards. Rebuilt
   *  from the roster at each encounter start. */
  drawPile: number[];
  discardPile: number[];
  hand: number[];
  /** K3: redraw actions taken this turn (vs the `turnGrants.redraw` budget).
   *  Reset at every turn start; meaningful only at the pre-turn gate. */
  redrawsUsedThisTurn: number;
  /** K3: total cards redrawn this turn (vs `turnGrants.redraw.maxCardsPerTurn`). */
  cardsRedrawnThisTurn: number;
  /** K4→47d: empower actions taken this turn PER GRANT SOURCE (parallel to
   *  `turnGrants.empowers`). Rebuilt at every turn start; meaningful only at
   *  the pre-turn gate. */
  empowersUsedThisTurn: number[];
  /** 47e: the run's bits balance (integer, floored at zero — the spec §Bits
   *  substrate). Persists across the whole run like `playerHealth`. */
  bits: number;
  /** 49b: the cache — owned packet ids in acquisition order (the `daemonIds`
   *  def-resolved pattern: re-resolved against the catalog on load, an
   *  unknown id hard-rejects). MAY legally exceed the derived `cacheSize`
   *  (a shrink daemon drops capacity under current holdings; the overflow is
   *  DERIVED state, never a serialized flag — see `Run.cacheOverflow`). */
  cache: string[];
  /** H4: the run-wide player health pool (persists across the whole run). */
  playerHealth: number;
  /** H4: the active encounter's enemy pool (reset each encounter). */
  enemyHealth: number;
  /** H4: turns elapsed in the active encounter (drives the max-turns cap). */
  turnIndex: number;
  /** V1: the active encounter's id (a catalog id, e.g. `brigands`), or null
   *  outside an encounter. `fromJSON` re-resolves the Encounter from it. */
  selectedEncounterId: string | null;
  /** U3: the wave-list sequencer cursor (the U2 grammar position), or null
   *  before the encounter's first turn. Plain JSON; persisted so a mid-encounter
   *  resume continues the exact wave sequence/stage. */
  waveCursor: WaveCursor | null;
  /** K3.5: the active encounter's battlefield (rolled once at encounter start,
   *  every turn fights on it). Null outside an encounter. */
  encounterMap: EncounterMap | null;
  currentNodeId: number;
  phase: RunPhase;
  currentEncounter: BattleEncounter | null;
  currentOffer: UnitTemplate[] | null;
  visitedNodes: number[];
  /** E4: the promotions awaiting PromotionScene dismissal. Non-null only
   *  while `phase === 'promotion'`. Snapshotted so a save mid-promotion
   *  restores to the same screen with the same deltas. */
  pendingPromotions: PromotionInfo[] | null;
  /** 48b: the rolled-but-unresolved reward portions (the pending offer —
   *  the `currentOffer` pattern). Rolled ONCE at the winning turn boundary;
   *  each accept/decline removes its portion. Snapshotted so a mid-reward
   *  save reproduces the exact offer (the §48 exit-criterion contract). */
  pendingRewards: RewardPortion[] | null;
}

/**
 * K1 — the run-lifecycle trigger vocabulary (the Run-side analogue of the
 * World combat triggers in `src/sim/triggers.ts`). Handlers — Phase-L daemons —
 * typically respond by calling `Run.addEncounterEffect`. `turnStart` fires
 * before the turn's battle is built, so a handler's encounter effect is seeded
 * that same turn; `deploy` fires after a unit is fielded (its effect lands on
 * subsequent turns); `encounterStart` fires once per encounter after the
 * per-encounter reset.
 */
export interface RunTriggerContextMap {
  encounterStart: { hop: number; nodeId: number };
  turnStart: { turn: number; hop: number };
  deploy: { rosterIndex: number; template: UnitTemplate };
}

// Balance constants now live in config/*.json — see src/config/recruitment.ts.
// Bound to locals here just for readability at the call sites. (The G4 enemy
// budget reads `config/difficulty.json` inside `src/run/enemyBudget.ts`.)
const {
  startingMelee: STARTING_MELEE,
  startingRanged: STARTING_RANGED,
  startingLevel: STARTING_LEVEL,
} = RECRUITMENT;

export class Run {
  readonly rng: RNG;
  /** E4: dedicated stream for level-up stat rolls. Forked once at
   *  construction so `simulateLevelUps` draws here, not against the
   *  parent stream that drives nodeMap + battle picks. */
  readonly levelupRng: RNG;
  /** H5: dedicated stream for deck shuffles + draws. Forked once at
   *  construction (isolated like `levelupRng`), so deck draws don't perturb
   *  the per-turn `battleRng` forks off `this.rng`. */
  readonly deckRng: RNG;
  /** L1: dedicated stream for the daemon roll + per-turn gate chance flips
   *  (Mercury's coin). Forked once at construction (isolated like
   *  `levelupRng`), so a chance-gated daemon doesn't perturb any other stream. */
  readonly daemonRng: RNG;
  /** 48b: dedicated stream for reward-ref chance tests + table sampling.
   *  Isolated because the draw count is FILTER-DEPENDENT (owned-daemon
   *  exclusion can collapse a table to a zero-draw singleton — gotcha #111),
   *  so it must never share a stream with anything else. */
  readonly rewardRng: RNG;
  /** 48b: dedicated stream for bits `{min,max}` rolls (the spec's "bits
   *  rolls, table sampling ... EACH get dedicated forked RNG streams"). */
  readonly rewardBitsRng: RNG;
  /** L1→47d: the run's owned daemons, in ACQUISITION order (index 0 = the
   *  run-start roll; §48 rewards / §50 ports append via `addDaemon` —
   *  uncapped, the locked design). Seeded from `RunConfig.daemon` (a bespoke
   *  config, or null = daemon-less, the fuzz control arm) or one uniform
   *  roll over `DAEMONS`. Daemon-only gates: these are the ONLY source of
   *  redraw/empower availability. Serialized BY ID (v26). */
  readonly daemons: DaemonConfig[];
  /** L1→47c: the current turn's resolved pre-turn grants — re-resolved at
   *  every turn start (`startNextTurn`, where a chance hook flips its coin),
   *  the config the K3/K4 validators consume in place of the retired static
   *  `DECK.redraw` / `EMPOWER` enables. Round-trips in the save (v25). */
  private turnGrants: TurnGrants;
  /** T2 — the sector-selection meta-DAG the run walks (default: the shipped
   *  `SECTOR_MAP`; a `RunConfig.sectorMap` overrides it for tests). Not
   *  persisted — a RunConfig input, reconstructable; a rehydrate resets it to
   *  the shipped map (the shipped DAG is a single sink, never mid-walked). */
  private sectorMap: SectorMap;
  /** T2 — the active sector (drives the node-map length, theme, + layout pool)
   *  and the DAG node it was chosen at (the walk cursor). Both persist; both
   *  change only when a sector terminal is cleared (`advanceSector`). */
  currentSectorId: string;
  currentSectorNodeId: string;
  /** T2 — regenerated per sector (was readonly + one-shot at construction). */
  nodeMap: NodeMap;
  team: UnitTemplate[];
  /**
   * H3 — per-unit deployment counter (the fatigue hook). One slot per
   * roster index, parallel to `team`; counts how many turns a unit has
   * been deployed in the CURRENT encounter. **Pure bookkeeping for now**
   * — a future fatigue debuff (deferred to H6 if needed) would read it at
   * deploy time to scale the deployed unit's stats. Reset at encounter
   * start via `resetDeploymentCounts`, bumped per deployment via
   * `recordDeployment` — those two are the stable seam the H4 turn loop
   * drives. Pre-H4 an encounter is a single battle and the whole roster
   * is the "hand", so each battle resets-then-records-once → every count
   * reads 1 mid-battle. Round-trips in the Run save (v7). Stays synced
   * with `team`: a recruit appends a fresh `0`.
   */
  deploymentCounts: number[];
  /**
   * K1 — per-roster-slot encounter-scoped status effects (the `endOfEncounter`
   * store), parallel to `team`. Added via `addEncounterEffect` (the daemon /
   * empower seam, L/K4), re-seeded onto the fielded unit each turn at deploy as
   * `endOfTurn` effects, and reset at encounter start. Empty per slot by
   * default. A recruit appends a fresh `[]` (stays synced with `team`, like
   * `deploymentCounts`). Round-trips in the Run save (v12).
   */
  encounterEffects: StatusEffect[][];
  /**
   * K1 — run-lifecycle trigger dispatch (`encounterStart` / `turnStart` /
   * `deploy`), the Run-side analogue of the World's combat triggers. The
   * Phase-L daemon system registers handlers here (which typically call
   * `addEncounterEffect`); K1 ships the dispatch + fire points + tests with no
   * production handler. NOT snapshotted — re-created on construct / rehydrate.
   */
  private runTriggers!: TriggerDispatcher<RunTriggerContextMap, Run>;
  /**
   * H5 — the card deck (draw → hand → discard), holding `rosterIndex` values.
   * Each turn draws up to `DECK.handSize` cards into `hand` (only the hand
   * fights), reshuffling `discardPile` back into `drawPile` when it empties; the
   * fought hand recycles to `discardPile` at the next turn's start. Encounter-
   * SCOPED: rebuilt + reshuffled from the current roster at every encounter
   * start, so deck state never carries between encounters (the no-carry model).
   * `drawPile` is drawn from the END (pop). Public so the turn loop + tests can
   * inspect the piles; round-trips in the Run save (v9).
   */
  drawPile: number[];
  discardPile: number[];
  hand: number[];
  /**
   * K3 — per-turn redraw bookkeeping: actions taken / cards redrawn this turn,
   * checked against the `turnGrants.redraw` budget by `handleRedrawCards`.
   * Both reset at every turn start (`startNextTurn`, BEFORE `turn:starting`
   * fires so the payload reads a fresh budget) and round-trip in the Run save
   * (v13) — a save at the pre-turn gate after a redraw must not refresh the
   * budget.
   */
  redrawsUsedThisTurn: number;
  cardsRedrawnThisTurn: number;
  /**
   * K4→47d — per-turn empower bookkeeping: actions taken this turn PER
   * GRANT SOURCE (parallel to `turnGrants.empowers`; each granted idol has
   * its own budget), checked by `handleEmpowerUnit`. Same lifecycle as the
   * K3 redraw counters (rebuilt in `startNextTurn` when the grants resolve,
   * before the `turn:starting` emit; round-trips in the Run save, v26).
   */
  empowersUsedThisTurn: number[];
  /**
   * 47e — the run's bits balance (the currency; spec §Bits). Integer,
   * floored at ZERO, mutated only through the private `addBits` chokepoint
   * (which clamps + emits `run:bitsChanged`). Earns go through `gainBits`,
   * which applies the folded `bitsGain` run-stat multiplier at the grant
   * site; spend surfaces arrive with §50 ports. Init: `RunConfig.startingBits`
   * override ?? `config/economy.json`. Round-trips in the Run save (v27).
   */
  bits: number;
  /**
   * 49b — the cache: owned packet ids in acquisition order (defs resolve at
   * read time — the daemons-by-id pattern). Capacity is NOT stored: it
   * derives from the `cacheSize` run-stat fold at read time
   * (`effectiveCacheSize`), so a size-modifier daemon joining is correct for
   * free. The list MAY exceed the derived capacity transiently — a shrink
   * daemon lands under current holdings and the overflow (`cacheOverflow`)
   * stays pending until the forced-keep discards resolve it (49f renders
   * that flow). Mutated only by `addPacket` / `handleDiscardPacket`, both of
   * which emit `run:cacheChanged`. Round-trips in the Run save (v30).
   */
  cache: string[];
  /**
   * H4 — the run-wide player health pool. Persists across the WHOLE run (every
   * encounter chips it; it's never reset between encounters). At ≤ 0 the run is
   * lost. Each turn it's chipped by the enemy survivors' Σ`power`. Init +
   * cap from `HEALTH.playerHealthMax`. Round-trips in the Run save (v8).
   */
  playerHealth: number;
  /**
   * H4 — the ACTIVE encounter's enemy health pool. Reset to
   * `HEALTH.enemyHealthMax` at every encounter start; at ≤ 0 the player wins
   * the encounter. Each turn it's chipped by the player survivors' Σ`power`.
   * Meaningful only while `phase === 'battle'`.
   */
  enemyHealth: number;
  /** H4 — turns elapsed in the active encounter. Incremented once per resolved
   *  turn; drives the `HEALTH.maxTurns` safety cap. Reset at encounter start. */
  turnIndex: number;
  /**
   * U3 — the active encounter (the authored fight selected onto this node).
   * Held for the whole encounter: `beginTurn` resolves each turn's wave from its
   * `waves` grammar, and the pool max comes from its `healthPool`. Null outside
   * an encounter (cleared in `finishEncounter`). NOT serialized directly — the
   * snapshot persists `selectedEncounterId` and `fromJSON` re-resolves it from
   * the authored catalog (`config/encounters.json`).
   */
  selectedEncounter: Encounter | null = null;
  /** U3 — the wave-list sequencer cursor (U2). Null before the first turn; the
   *  sequencer returns a fresh cursor each turn. Persisted for mid-encounter
   *  resume. */
  waveCursor: WaveCursor | null = null;
  /**
   * K3.5 — the active encounter's battlefield: layout/size/terrain/theme rolled
   * ONCE in `beginEncounter` (a dedicated `this.rng` fork); every turn's
   * `beginTurn` fights on it. Null outside an encounter (cleared in
   * `finishEncounter`; rest nodes never set it). Persisted (v14) — it is NOT
   * re-derivable per turn, so a mid-encounter restore must carry it.
   */
  encounterMap: EncounterMap | null;
  currentNodeId: number;
  phase: RunPhase = 'map';
  /**
   * H4b — when true (Game sets it for the live game), the encounter loop PAUSES
   * at turn boundaries: `turn-intro` before each turn (emits `turn:starting`)
   * and `turn-outcome` after each turn resolves (emits `turn:resolved`), each
   * resumed by an `advanceTurn` command from the pre/post-turn screen. When
   * false (the default — headless tests + the fuzz harness), the loop runs
   * straight through, byte-identical to H4a. Presentation-only and
   * reconstructed by Game, so it is deliberately NOT snapshotted (a restore
   * defaults it off).
   */
  pauseAtTurnGates = false;
  currentEncounter: BattleEncounter | null = null;
  /** Recruit offer presented after victory, cleared on choice. */
  currentOffer: UnitTemplate[] | null = null;
  /**
   * E4 — level-ups awaiting PromotionScene dismissal. M1: set at the TURN
   * boundary in `handleTurnEnded` when `bankXpAwards` reports promotions
   * (gated runs stash it across the `turn-outcome` screen — both fields are
   * persisted, so a save there still pops the promotion on resume); cleared
   * when `handleDismissPromotion` re-enters the encounter loop (next turn /
   * finish) or, for a G3 rest, returns to the map.
   */
  pendingPromotions: PromotionInfo[] | null = null;
  /**
   * 48b — the rolled-but-unresolved reward portions (the pending offer, the
   * `currentOffer` pattern). Rolled ONCE in `handleTurnEnded` when the final
   * turn wins; `continueFromTurnGate` interposes the reward phase while it's
   * non-null; each accept/decline removes its portion, and resolving the
   * last one re-enters the gate chain. Persisted (v29) so a mid-reward save
   * reproduces the exact offer.
   */
  pendingRewards: RewardPortion[] | null = null;
  /**
   * Nodes the player has cleared (entered + survived). Used by MapScreen to
   * draw a visual trail of completed nodes. Root is never added — it's not
   * "completed" in the battle sense, it's just the starting point.
   */
  readonly visitedNodes: Set<number>;

  /**
   * G1 — when set (via `RunConfig.forcedLayoutId`), every battle uses this
   * hand-authored layout instead of the sector-pool roll; the `FORCE_PROCEDURAL`
   * sentinel forces a fresh procedural map every battle instead (M6). Null =
   * normal sector-pool roll. Not persisted (RunConfig is a run input,
   * reconstructable from seed); a rehydrated Run resets this to null.
   */
  private readonly forcedLayoutId: string | null;

  /**
   * X2 — when set (via `RunConfig.forcedEncounterId`), the authored encounter
   * forced at every node whose kind matches it (`selectEncounter`'s force-select),
   * for the `--encounter=<id>` balance-isolation sample. Null = normal sector-pool
   * selection. Not persisted (RunConfig is a run input); a rehydrated Run resets
   * this to null.
   */
  private readonly forcedEncounterId: string | null;

  /**
   * X1 — the per-run difficulty multipliers (the future difficulty-system seam),
   * resolved ONCE at construction from the `RunConfig` overrides falling back to
   * the global `difficulty.json` defaults (1.0 = no scaling). Applied to every
   * authored-encounter wave at resolve time via `WaveContext` (`beginTurn`). Not
   * persisted (a RunConfig input, reconstructable); a rehydrated run re-resolves
   * to the shipped defaults.
   */
  private readonly difficultyMultipliers: DifficultyMultipliers;

  private readonly bus: EventBus<GameEvents>;
  private subscriptions: Array<() => void> = [];

  constructor(seed: number, bus: EventBus<GameEvents>, config?: RunConfig) {
    this.bus = bus;
    this.rng = new RNG(seed);
    // Fork order is the determinism invariant (sector+nodeMap → team → levelup).
    // Each override only changes a forked *child* stream's content, never how
    // many times the parent is forked — so the default path stays byte-identical
    // and a configured run keeps the same parent alignment. (G1)
    // T2 — the first fork now picks the run's opening sector off the
    // sector-selection DAG, THEN generates that sector's node-map on the SAME
    // forked stream. `pickStartSector` consumes zero draws when the source +
    // sector lists are singletons (the shipped one-node DAG), so the node-map
    // generation begins at the identical stream position as the pre-T2 run —
    // and "The Start" (length 11 == HOP_COUNT) reproduces the same map.
    this.sectorMap = config?.sectorMap ?? SECTOR_MAP;
    const sectorRng = this.rng.fork();
    const start = pickStartSector(this.sectorMap, sectorRng);
    this.currentSectorNodeId = start.sectorNodeId;
    this.currentSectorId = start.sectorId;
    this.nodeMap = generateNodeMap(sectorRng, config, this.currentSectorLength());
    const teamRng = this.rng.fork();
    this.team = config?.startingRoster
      ? config.startingRoster.map((e) => rollUnit(e.archetype, teamRng, e.level))
      : rollTeam(teamRng);
    // H3 — one deployment slot per roster unit, all zero at run start.
    this.deploymentCounts = new Array(this.team.length).fill(0);
    // K1 — one (empty) encounter-effect list per roster unit + the run-trigger
    // dispatcher (no handler until a daemon registers one in L).
    this.encounterEffects = this.team.map(() => []);
    this.runTriggers = new TriggerDispatcher<RunTriggerContextMap, Run>();
    // H5 — the deck is empty until an encounter builds + shuffles it
    // (`beginEncounter`); piles round-trip but mean nothing between encounters.
    this.drawPile = [];
    this.discardPile = [];
    this.hand = [];
    // K3 — redraw budget bookkeeping; meaningful only at a pre-turn gate.
    this.redrawsUsedThisTurn = 0;
    this.cardsRedrawnThisTurn = 0;
    // K4 — empower budget bookkeeping; same lifecycle.
    this.empowersUsedThisTurn = [];
    // 47e — starting bits: override ?? config/economy.json. Pure of RNG
    // (no draw), so it doesn't perturb the fork alignment; clamped so a
    // programmatic override can't start a run below the zero floor.
    this.bits = Math.max(0, config?.startingBits ?? ECONOMY.startingBits);
    // 49b — the cache starts empty (packets arrive via rewards/ports only;
    // no starting-packet config until content demands one).
    this.cache = [];
    // H4 — the run-wide player pool starts full; the per-encounter state
    // (enemyHealth/turnIndex/selectedEncounter) is set when an encounter
    // actually begins (`beginEncounter`).
    this.playerHealth = HEALTH.playerHealthMax;
    this.enemyHealth = 0;
    this.turnIndex = 0;
    this.encounterMap = null;
    this.levelupRng = this.rng.fork();
    // H5 — fork the deck stream LAST (after levelup), consistent with the
    // append-at-the-end fork convention. This extra construction fork shifts
    // every subsequent `this.rng.fork()` (per-turn waves, recruit offers), so
    // H5 re-baselines the fuzz output — acceptable, since the seam swap + the
    // drawn-hand subset already change battle outcomes wholesale.
    this.deckRng = this.rng.fork();
    // L1 — the daemon stream, appended after deck (same convention, same
    // fuzz-re-baseline note as H5). The roll/skip happens on the CHILD stream,
    // so a forced daemon keeps the parent alignment (the G1 contract); gates
    // stay disabled until the first turn resolves them (`startNextTurn`).
    this.daemonRng = this.rng.fork();
    // 47d — the ownership list. A forced config seeds it without a roll (the
    // G1 parent-alignment contract holds — the roll/skip is on the child).
    this.daemons =
      config?.daemon !== undefined
        ? config.daemon === null
          ? []
          : [config.daemon]
        : [rollDaemon(DAEMONS, this.daemonRng)];
    // 48b — the two reward streams, appended after daemon (the same
    // convention + fuzz-re-baseline note as H5/L1). Sampling and bits rolls
    // are SEPARATE streams because the sampling draw count is
    // filter-dependent (owned-daemon exclusion → zero-draw singletons).
    this.rewardRng = this.rng.fork();
    this.rewardBitsRng = this.rng.fork();
    this.turnGrants = disabledTurnGrants();
    this.forcedLayoutId = resolveForcedLayoutId(config?.forcedLayoutId);
    this.forcedEncounterId = resolveForcedEncounterId(config?.forcedEncounterId);
    // X1/48f — resolve the per-run difficulty lever (override ?? difficulty.json
    // default). Pure of RNG, so it doesn't perturb the fork alignment.
    this.difficultyMultipliers = resolveDifficultyMultipliers({
      waveSize: config?.waveSizeMultiplier,
      levelBudget: config?.levelBudgetMultiplier,
      bits: config?.bitsMultiplier,
    });
    // S2 — the run begins at the virtual pre-root position (no node entered
    // yet); the root is the sole frontier, so it's selected as the first
    // encounter like any other node.
    this.currentNodeId = PRE_ROOT_NODE_ID;
    this.visitedNodes = new Set<number>();
    this.subscribe();
    bus.emit('run:started', { seed });
  }

  private subscribe(): void {
    this.subscriptions.push(
      // H4: a `battle:ended` ends a TURN, not the node. `winner` doesn't route
      // the outcome — the pools do (chipped symmetrically off `survivorPower`)
      // — but H4b surfaces it on the post-turn screen, so it's passed through.
      this.bus.on('battle:ended', ({ winner, xpAwards, survivorPower, tallies }) =>
        this.handleTurnEnded(winner, xpAwards, survivorPower, tallies),
      ),
    );
  }

  /**
   * Detach every bus subscription. Required when replacing a Run on reset —
   * otherwise the dead Run keeps responding to `battle:ended` events and
   * the new one races against it.
   */
  dispose(): void {
    for (const unsub of this.subscriptions) unsub();
    this.subscriptions.length = 0;
  }

  /**
   * Apply a command synchronously. Run isn't tick-driven (its lifecycle is
   * event-driven), so commands are applied immediately rather than queued
   * for a drain point. `resetRun` isn't handled here — Game intercepts it
   * because resetting requires disposing this Run and constructing a new
   * one, which the Run itself can't do for itself.
   */
  dispatch(command: RunCommand): void {
    switch (command.kind) {
      case 'enterNode':
        this.handleEnterNode(command.nodeId);
        break;
      case 'chooseRecruit':
        this.handleChooseRecruit(command.unitTemplate);
        break;
      case 'passRecruit':
        this.handlePassRecruit();
        break;
      case 'dismissPromotion':
        this.handleDismissPromotion();
        break;
      case 'acceptReward':
        this.handleAcceptReward(command.index);
        break;
      case 'declineReward':
        this.handleDeclineReward(command.index);
        break;
      case 'advanceTurn':
        this.handleAdvanceTurn();
        break;
      case 'redrawCards':
        this.handleRedrawCards(command.handIndices);
        break;
      case 'empowerUnit':
        this.handleEmpowerUnit(command.handIndex, command.grantIndex);
        break;
      case 'discardPacket':
        this.handleDiscardPacket(command.cacheIndex);
        break;
      case 'resetRun':
        // No-op at this layer — Game handles reset by disposing this Run
        // and constructing a new one. Falls through silently rather than
        // throwing so a misrouted command doesn't crash a battle.
        break;
    }
  }

  /**
   * MapScreen dispatch → run. Validates the node is a legal frontier hop,
   * builds the battle encounter (deterministic from a forked RNG), and
   * announces the battle so Game can spin up a fresh World.
   */
  private handleEnterNode(nodeId: number): void {
    if (this.phase !== 'map') return;
    if (!this.isFrontier(nodeId)) return;

    // The departing node counts as cleared. At the pre-root start there's no
    // node to mark (the sentinel); the root is a normal battle node now (S2),
    // so it IS marked once the player leaves it.
    if (this.currentNodeId !== PRE_ROOT_NODE_ID) {
      this.visitedNodes.add(this.currentNodeId);
    }
    this.currentNodeId = nodeId;

    // G3 — dispatch on node kind. A rest resolves inline (no battle); battle
    // and boss both build an encounter (boss is a regular fight, just tagged
    // — the terminal-win → run:victory path in `advancePastBattle` already
    // handles it). The frontier check above gates entry the same for all.
    if (this.kindOf(nodeId) === 'rest') {
      this.resolveRest();
      return;
    }

    this.phase = 'battle';
    this.beginEncounter();
  }

  /**
   * H4 — start a fresh encounter at the current node. Resets the per-encounter
   * state (enemy pool full, turn counter zero), fixes the enemy level budget
   * for the whole encounter, zeroes the H3 deployment counts, then kicks off
   * the first turn. The run-wide `playerHealth` is deliberately NOT reset — it
   * persists across encounters.
   */
  private beginEncounter(): void {
    // V1 — select this node's encounter + its battlefield from the current
    // sector's pools via the keyed `selectEncounter` resolver (replaces U3's
    // hold-the-single-reproduction). ONE `mapRng` fork drives BOTH the selection
    // draws (encounter + layout pick) and the map build below — so the parent
    // stream is forked once per encounter, as before. The selected encounter
    // seeds the per-encounter pool + owns the wave grammar; the cursor starts fresh.
    const mapRng = this.rng.fork();
    const selection = selectEncounter(
      this.currentSector(),
      { hop: this.currentHop, nodeKind: this.kindOf(this.currentNodeId) },
      mapRng,
      getEncounter,
      this.forcedEncounterId ?? undefined,
    );
    this.selectedEncounter = selection.encounter;
    this.waveCursor = null;
    this.enemyHealth = this.selectedEncounter.healthPool;
    this.turnIndex = 0;
    // H5 — rebuild + shuffle the draw deck from the CURRENT roster (so a
    // freshly recruited card is in the deck); hand + discard start empty. The
    // deck is per-encounter — last encounter's pile state is discarded here.
    this.drawPile = this.team.map((_, i) => i);
    shuffleInPlace(this.drawPile, this.deckRng);
    this.discardPile = [];
    this.hand = [];
    // H3 — counts reset per ENCOUNTER (was per-battle pre-H4); each turn's
    // `beginTurn` records the deployed hand.
    this.resetDeploymentCounts();
    // K3.5 / V1 — build the encounter's ONE battlefield for the layout chosen by
    // selection above (pre-K3.5 these rolls lived per-turn in `beginTurn`). The
    // terrain-seed + procedural-side draws ride the SAME `mapRng` as selection,
    // contiguous after the encounter/layout picks. Gotcha #49's always-draw
    // discipline (the G1 forced-layout override still consumes the same draws) is
    // preserved in `buildEncounterMap`.
    this.encounterMap = this.buildEncounterMap(selection.layoutId, mapRng);
    // Browser-only diagnostic (moved from `beginTurn`): confirm the layout
    // picker hits the full library across a session. Gated on `typeof window`
    // so the fuzz harness + vitest don't spam.
    if (typeof window !== 'undefined') {
      console.log(
        '[layout]',
        this.encounterMap.layoutId ?? 'procedural',
        `${this.encounterMap.gridW}x${this.encounterMap.gridH}`,
        `hop ${this.currentHop}`,
      );
    }
    // K1 — clear the encounter-effect store + fire `encounterStart` so a daemon
    // can grant fresh encounter buffs for this encounter (no-op at the default,
    // no handler registered → byte-identical). Fired AFTER the map roll so a
    // future daemon can read `encounterMap`.
    this.resetEncounterEffects();
    this.fireTrigger('encounterStart', { hop: this.currentHop, nodeId: this.currentNodeId });
    // 47e — daemon `encounterStart` instant hooks fire alongside the K1
    // trigger (no launch daemon authors one — byte-identical until content
    // does; a chance-gated hook here would draw off `daemonRng`).
    this.executeInstantOps(resolveInstantHooks(this.daemons, 'encounterStart', {}, this.daemonRng));
    this.startNextTurn();
  }

  /**
   * T2 — the active sector definition. Throws if the id ever dangles; the
   * sector-map's load-time guard rejects an unknown sector reference, so this
   * guards against future drift rather than a runtime branch.
   */
  private currentSector(): SectorDef {
    const sector = getSector(this.currentSectorId);
    if (!sector) throw new Error(`Run: active sector "${this.currentSectorId}" not found`);
    return sector;
  }

  /** T2 — the active sector's node-map hop count (NodeMap.generate length). */
  private currentSectorLength(): number {
    return this.currentSector().length;
  }

  /**
   * T2 — the active sector's display title (for the map-scene banner). Always
   * available, including at the pre-root start (a run always has a current
   * sector), unlike `currentHop` which has no node entered yet.
   */
  get currentSectorTitle(): string {
    return this.currentSector().title;
  }

  /**
   * U3 — the active encounter's enemy health-pool MAXIMUM. Per-encounter now
   * (`encounter.healthPool`), replacing the global `HEALTH.enemyHealthMax`; falls
   * back to the global outside an encounter (defensive — readers only consult it
   * mid-battle). The basis for the pool-fraction gauge + the stage conditions.
   */
  get enemyHealthPoolMax(): number {
    return this.selectedEncounter?.healthPool ?? HEALTH.enemyHealthMax;
  }

  /**
   * U3 — the active encounter's display name (the HUD enemy pane, replacing
   * "Foe"). Null outside an encounter.
   */
  get currentEncounterName(): string | null {
    return this.selectedEncounter?.name ?? null;
  }

  /**
   * K3.5 / T2 / V1 — build the encounter's ONE battlefield for `selectedLayoutId`
   * (chosen by `selectEncounter` from the sector's hop-gated layout pool ∩ the
   * encounter's fit-filter; `null` = procedural). The layout PICK moved into
   * selection (V1) — this just realizes the chosen id into a map. The terrain-seed
   * + procedural-side draws ALWAYS run on `mapRng` so the stream advances
   * identically on every branch (gotcha #49): the G1 forced-layout override
   * (`forcedLayoutId`) swaps the id WITHOUT skipping a draw. A procedural board
   * inherits the **sector's** theme; a hand-authored layout keeps its own.
   */
  private buildEncounterMap(selectedLayoutId: string | null, mapRng: RNG): EncounterMap {
    const sector = this.currentSector();
    const terrainSeed = Math.floor(mapRng.next() * 0x1_0000_0000);
    // forcedLayoutId (G1): null = use the selection; FORCE_PROCEDURAL sentinel =
    // force a procedural map (layoutId null); any other string = that named layout
    // (bypassing selection — a dev/test override).
    const layoutId =
      this.forcedLayoutId === null
        ? selectedLayoutId
        : this.forcedLayoutId === FORCE_PROCEDURAL
          ? null
          : this.forcedLayoutId;
    const proceduralSide = rollProceduralSide(mapRng);
    const { gridW, gridH } = layoutId === null
      ? { gridW: proceduralSide, gridH: proceduralSide }
      : layoutDimensions(layoutId);
    const theme = layoutId === null
      ? sector.theme
      : (getLayout(layoutId)?.theme ?? sector.theme);
    return { layoutId, gridW, gridH, terrainSeed, theme };
  }

  /**
   * H4b — enter the next turn through the (optional) pre-turn gate. With
   * `pauseAtTurnGates` on, pause on `turn-intro` + emit `turn:starting` so the
   * pre-turn screen shows (it resumes via `advanceTurn`); off, fall straight
   * into the turn's battle (the H4a path — phase stays `battle`).
   *
   * H5b — the hand is DRAWN here (before the gate), so `turn:starting` can carry
   * it for the pre-turn screen and `beginTurn` simply fields the already-drawn
   * hand. The draw runs on both paths, so the headless loop is unchanged.
   */
  private startNextTurn(): void {
    this.drawTurnHand();
    // K3 — a fresh redraw budget every turn, reset BEFORE the `turn:starting`
    // emit below so its payload reads full availability.
    this.redrawsUsedThisTurn = 0;
    this.cardsRedrawnThisTurn = 0;
    // L1→47c — resolve this turn's daemon grants (the `turnStart` grant
    // hooks). A chance hook (Mercury) flips its coin off the isolated
    // `daemonRng` exactly HERE, once per turn, on both the gated + headless
    // paths (path-independent draw count). 47d: the per-source empower
    // counters rebuild to match this turn's grant list.
    const resolution = resolveTurnGrants(this.daemons, this.daemonRng);
    this.turnGrants = resolution.grants;
    this.empowersUsedThisTurn = this.turnGrants.empowers.map(() => 0);
    // 47e — the walk's granted instant ops (gainBits/healPool) execute NOW,
    // at the fire site — their coins already flipped in the walk above (one
    // walk, one draw; never re-resolve). Applied before the `turn:starting`
    // emit so the gate screen reads post-effect state.
    this.executeInstantOps(resolution.instants);
    // K1 — `turnStart` fires before the turn's battle is built (on both the
    // gated + headless paths), so a daemon's encounter effect added here is
    // seeded onto this turn's hand in `beginTurn`. No-op at the default.
    this.fireTrigger('turnStart', { turn: this.turnIndex + 1, hop: this.currentHop });
    if (this.pauseAtTurnGates) {
      this.phase = 'turn-intro';
      // K3.5 — `startNextTurn` only runs mid-encounter, so the map is set.
      const { layoutId, gridW, gridH, theme } = this.encounterMap!;
      // Wb1 — the selected encounter is held for the whole encounter, so it's
      // always set here (mid-encounter, same as the map above).
      const encounter = this.selectedEncounter!;
      this.bus.emit('turn:starting', {
        turn: this.turnIndex + 1,
        hop: this.currentHop,
        playerHealth: this.playerHealth,
        playerHealthMax: HEALTH.playerHealthMax,
        enemyHealth: this.enemyHealth,
        enemyHealthMax: this.enemyHealthPoolMax,
        hand: this.hand.map((idx) => this.team[idx]!),
        // R2 — the other two piles for the pre-turn pile views (recruitment
        // order; see resolvePileForDisplay).
        drawPile: this.resolvePileForDisplay(this.drawPile),
        discardPile: this.resolvePileForDisplay(this.discardPile),
        redraw: this.redrawAvailability,
        // 47d — one empower control per granted idol (per-source budgets).
        empowers: this.empowerGrants,
        empowerMagnitudes: this.empowerMagnitudes(),
        // 47d — the owned-daemon list (stacked banners). `redrawGate`/
        // `empowerGate` = "does this idol EVER grant it" (authored hooks,
        // not this turn's resolution) — the screen tells "denied this turn"
        // from "never grants it".
        daemons: this.daemons.map((d) => ({
          id: d.id,
          name: d.name,
          description: d.description,
          redrawGate: daemonRedrawHook(d) !== undefined,
          empowerGate: daemonEmpowerHook(d) !== undefined,
        })),
        encounter: { name: encounter.name, kind: encounter.kind },
        map: { layoutId, gridW, gridH, theme },
      });
    } else {
      this.phase = 'battle';
      this.beginTurn();
    }
  }

  /**
   * H5b — discard the previous turn's hand and draw the next, run once per turn
   * from `startNextTurn` (BEFORE the pre-turn gate, so `turn:starting` carries
   * the hand). Split out of `beginTurn` so the draw happens once per turn on
   * both the gated + headless paths. Determinism is unchanged: the lone
   * `deckRng` draw still fires once/turn in the same order, and `this.rng` (the
   * per-turn `battleRng` fork in `beginTurn`) is an independent stream — moving
   * the deck draw earlier in wall-clock doesn't shift it.
   */
  private drawTurnHand(): void {
    this.discardPile.push(...this.hand);
    this.hand = this.drawHand();
  }

  /**
   * 47e — the effective run stats: `RUN_STAT_BASES` folded with every owned
   * daemon's `modifier` rules, derived AT CALL TIME (derive-don't-cache —
   * ownership changes, §49 packet modifiers, and future removal all stay
   * correct for free). Today's only consumer is `gainBits` (`bitsGain`);
   * §49's cache reads `cacheSize` from here.
   */
  private effectiveRunStats(): Readonly<Record<RunStatKey, number>> {
    const mods: RunStatModifier[] = [];
    for (const daemon of this.daemons) {
      for (const rule of daemon.rules ?? []) {
        if (rule.kind === 'modifier') mods.push(rule);
      }
    }
    return foldRunStats(RUN_STAT_BASES, mods);
  }

  /**
   * 48b/48f — the settle math for a bits earn: `base` × the folded `bitsGain`
   * multiplier × the per-run `bitsMultiplier` difficulty lever (48f — the
   * shape-lock's Option B: inside the settle, so reward rolls, battle
   * tallies, and daemon hooks all scale uniformly and the §52 dial reads
   * clean), ROUNDED once to an integer (the runStats.ts contract — the fold
   * itself never rounds). Public and SHARED with the reward screen's display
   * derivation (the shape-lock rider: the screen must show exactly what the
   * settle grants — one code path, drift-impossible; accepting a bits-fold
   * daemon mid-offer visibly re-derives the remaining portions).
   */
  effectiveBits(base: number): number {
    return Math.round(base * this.effectiveRunStats().bitsGain * this.difficultyMultipliers.bits);
  }

  /**
   * 47e — earn bits: the `effectiveBits` settle math, then through the
   * floor-at-zero chokepoint. Every earn surface routes here (daemon hooks,
   * the 47f battle-tally settle, the 48b reward settle), so a bits-gain
   * modifier daemon applies uniformly without per-surface bookkeeping.
   * NB for §50: port SELL proceeds are a refund, not income — they must
   * take the raw `addBits` path, never this one, or a bits fold above
   * 1/sellFraction mints an infinite buy-sell loop (worklog §48).
   */
  gainBits(base: number): void {
    this.addBits(this.effectiveBits(base));
  }

  /**
   * 47e — the single bits mutation chokepoint: clamps the balance at ZERO
   * (spec §Bits — integer, floor at zero) and emits `run:bitsChanged` with
   * the post-clamp applied delta. Emits only on a real change, so a clamped
   * no-op spend or a ×0 grant stays silent. §50's spend surfaces will call
   * this with negative deltas.
   */
  private addBits(delta: number): void {
    const next = Math.max(0, this.bits + delta);
    if (next === this.bits) return;
    const applied = next - this.bits;
    this.bits = next;
    this.bus.emit('run:bitsChanged', { bits: this.bits, delta: applied });
  }

  /**
   * 49b — the effective cache capacity: the `cacheSize` run-stat fold read
   * at call time and FLOORED here (the runStats.ts contract — the fold never
   * rounds; the read site does). Derive-don't-cache: a size-modifier daemon
   * joining is correct with zero bookkeeping.
   */
  get effectiveCacheSize(): number {
    return Math.floor(this.effectiveRunStats().cacheSize);
  }

  /**
   * 49b — packets held beyond the derived capacity (0 = none). Non-zero only
   * after a SHRINK (a cacheSize-lowering daemon landing under current
   * holdings) — acquisition surfaces gate on `cacheHasRoom`, so adds never
   * overflow. DERIVED, never serialized: a save mid-shrink round-trips the
   * cache + daemons and this recomputes (derive-don't-cache). While > 0 the
   * 49f forced-keep flow demands discards.
   */
  get cacheOverflow(): number {
    return Math.max(0, this.cache.length - this.effectiveCacheSize);
  }

  /** 49b — room for one more packet (the acquisition gate: 49c reward
   *  accepts, §50 port buys). */
  get cacheHasRoom(): boolean {
    return this.cache.length < this.effectiveCacheSize;
  }

  /**
   * 49b — append a packet to the cache (the 49c reward / §50 port
   * acquisition seam — `addDaemon`'s sibling). Takes the ID: the cache
   * serializes ids, so a non-catalog packet can never legally exist here
   * (unlike bespoke in-memory daemons) — an unknown id throws, loud beats a
   * poisoned save. Fullness is the CALLER's concern (the addDaemon duplicate
   * discipline): acquisition surfaces gate on `cacheHasRoom` upstream, and
   * the 49c swap flow discards before adding. Duplicate ids are legal — no
   * stacking means one SLOT each, not one copy each (spec §Cache).
   */
  addPacket(packetId: string): void {
    if (packetById(packetId) === undefined) {
      throw new Error(`Run.addPacket: unknown packet id '${packetId}'`);
    }
    this.cache.push(packetId);
    this.emitCacheChanged();
  }

  /**
   * 49b — discard one cache slot (the `discardPacket` command: the at-will
   * discard, and the instrument of the 49f forced-keep shrink flow).
   * Out-of-range / fractional = the silent no-op discipline. Deliberately
   * NOT phase-guarded: the cache is pure run-level state with no sim seam,
   * the modal opens on any screen (49f), and a shrink must be resolvable
   * wherever it landed (the reward phase today, ports at §50).
   */
  private handleDiscardPacket(cacheIndex: number): void {
    if (!Number.isInteger(cacheIndex)) return;
    if (cacheIndex < 0 || cacheIndex >= this.cache.length) return;
    this.cache.splice(cacheIndex, 1);
    this.emitCacheChanged();
  }

  /** 49b — the one `run:cacheChanged` emit site: an authoritative copy of
   *  the ids + the derived capacity, so consumers repaint from the payload
   *  without re-deriving. */
  private emitCacheChanged(): void {
    this.bus.emit('run:cacheChanged', {
      packetIds: this.cache.slice(),
      size: this.effectiveCacheSize,
    });
  }

  /**
   * 47e — execute a firing's resolved instant run-ops at the fire site:
   * `gainBits` through the fold + chokepoint; `healPool` onto the run-wide
   * player pool, capped at max (the rest-node discipline). The resolution
   * (coin flips, filters) already happened in the daemon walk — this only
   * applies effects, so it draws nothing.
   */
  private executeInstantOps(ops: readonly InstantOp[]): void {
    for (const op of ops) {
      if (op.op === 'gainBits') {
        this.gainBits(op.amount);
      } else {
        this.playerHealth = Math.min(HEALTH.playerHealthMax, this.playerHealth + op.amount);
      }
    }
  }

  /**
   * H4 — spin up one turn: roll this turn's battlefield + a fresh enemy wave at
   * the encounter's fixed budget, field this turn's already-drawn hand (H5b
   * draws it in `startNextTurn`), record the deployed hand, publish the per-turn
   * `currentEncounter`, and emit `battle:started` for the driver (BattleScene /
   * the headless harness) to build a World.
   *
   * Determinism: the per-turn `battleRng` is forked from `this.rng` HERE (never
   * looked ahead / stashed), so the snapshotted `this.rng` alone reconstructs
   * every future turn's wave — a mid-encounter save/resume reproduces the same
   * waves. Turn 1 is byte-identical to the pre-H4 single-battle setup
   * (`enemyBudgetFor` draws no RNG, so the fork + draw order is unchanged).
   */
  private beginTurn(): void {
    const battleRng = this.rng.fork();
    const worldSeed = Math.floor(battleRng.next() * 0x1_0000_0000);
    // K3.5 — the battlefield is the ENCOUNTER's (rolled once in
    // `beginEncounter`); only the world seed above and the enemy wave below
    // stay per-turn. The pre-K3.5 per-turn layout/terrain/theme rolls lived
    // right here — see `rollEncounterMap`.
    if (this.encounterMap === null) {
      throw new Error('Run.beginTurn: no encounterMap — beginTurn outside an encounter');
    }
    const { layoutId, gridW, gridH, terrainSeed, theme } = this.encounterMap;
    // U3 — the per-turn enemy team now comes from the selected ENCOUNTER, not the
    // random `rollEnemyWave`: advance the wave-list grammar one turn (`waveForTurn`,
    // U2) to get this turn's spec + cursor, then resolve it to a team (`resolveWave`,
    // U1). Both draw `battleRng` — the last consumer, so their variable draw count
    // stays downstream-safe (as `rollEnemyWave` was). The stage condition reads the
    // live pool fraction at this turn boundary.
    const encounter = this.selectedEncounter;
    if (encounter === null) {
      throw new Error('Run.beginTurn: no selected encounter — beginTurn outside an encounter');
    }
    const encounterState: EncounterState = {
      poolFraction: encounter.healthPool > 0 ? this.enemyHealth / encounter.healthPool : 0,
      turn: this.turnIndex + 1,
    };
    const { spec, cursor } = waveForTurn(encounter.waves, this.waveCursor, encounterState, battleRng);
    this.waveCursor = cursor;
    const waveContext: WaveContext = {
      roster: this.team,
      // The count/budget basis is the FIELDED hand (min(roster, handSize)), as
      // `rollEnemyWave`/`playerTeamLevel` used. The per-instance level cap is now
      // authored per wave (`spec.levelCap`) and resolved against `roster`, so it's
      // no longer computed here.
      handSize: Math.min(this.team.length, DECK.handSize),
      // X1 — the per-run difficulty lever, applied to every wave at resolve time.
      waveSizeMultiplier: this.difficultyMultipliers.waveSize,
      levelBudgetMultiplier: this.difficultyMultipliers.levelBudget,
    };
    const enemyTeam = resolveWave(spec, waveContext, battleRng);

    // E4/H5 — the hand was drawn in `startNextTurn` (`drawTurnHand`) so the
    // pre-turn screen could show it; here we just field it. Stamp each drawn
    // card with its `Run.team` index so `xpAwards` can carry it back at battle
    // end (the stamp is applied at handoff time, never on `this.team`).
    //
    // H6c → K1 — spawn-time fatigue is now a status effect (`fatigueEffect`),
    // seeded onto the fielded unit alongside any persistent encounter effects
    // for its slot. The Fatigued stack count is `deploymentCounts[idx]` PRIOR
    // deployments this encounter (read BEFORE the recordDeployment bump below,
    // so a debut unit reads 0 stacks → no effect). INERT at the shipped knob
    // (`fatigueEffect` returns null) — no effect seeded, byte-identical. The
    // encounter effects are re-seeded each turn as `endOfTurn` (the
    // `endOfEncounter` store). `this.team`'s canonical templates are never
    // touched (the stamp is a transient per-turn copy).
    const stampedPlayerTeam = this.hand.map((idx) => {
      const t = this.team[idx]!;
      const seedEffects: StatusEffect[] = this.encounterEffects[idx]!.map(cloneEffect);
      const fatigue = fatigueEffect(this.deploymentCounts[idx]!);
      if (fatigue) seedEffects.push(fatigue);
      return {
        ...t,
        rosterIndex: idx,
        ...(seedEffects.length > 0 ? { effects: seedEffects } : {}),
      };
    });
    // H3 — record this turn's deployment (the drawn hand). The deployment
    // counter finally varies per turn here (pre-H5 it was the whole roster).
    this.recordDeployment(this.hand);
    // K1 — `deploy` fires once per fielded slot AFTER recordDeployment (a
    // handler's encounter effect lands on subsequent turns). No-op at default.
    for (const idx of this.hand) {
      this.fireTrigger('deploy', { rosterIndex: idx, template: this.team[idx]! });
    }
    this.currentEncounter = {
      worldSeed,
      terrainSeed,
      layoutId,
      gridW,
      gridH,
      theme,
      playerTeam: stampedPlayerTeam,
      enemyTeam,
      // 47f — the owned daemons' battle hooks, compiled fresh each turn
      // (ownership can grow mid-encounter via addDaemon: a §48 reward daemon
      // fights from the NEXT turn, matching the grant-resolution rule).
      battleRules: battleRulesFor(this.daemons),
    };
    this.bus.emit('battle:started', { worldSeed });
  }

  /**
   * Hop index of the current node. Public so UI surfaces (HUD) can label
   * the active battle's depth without duplicating the node-lookup logic.
   */
  get currentHop(): number {
    return this.hopOf(this.currentNodeId);
  }

  private hopOf(nodeId: number): number {
    const node = this.nodeMap.nodes.find((n) => n.id === nodeId);
    if (!node) throw new Error(`Run.hopOf: no node ${nodeId} in map`);
    return node.hop;
  }

  /** G3 — node kind, for the rest/battle dispatch + the post-promotion route. */
  private kindOf(nodeId: number): NodeKind {
    const node = this.nodeMap.nodes.find((n) => n.id === nodeId);
    if (!node) throw new Error(`Run.kindOf: no node ${nodeId} in map`);
    return node.kind;
  }

  /**
   * H4 — a turn's tactical battle just ended (`battle:ended`). Resolve the turn
   * into the health pools, then either start the next turn or finish the
   * encounter. Replaces the pre-H4 single-battle handler: a `battle:ended` no
   * longer ends the node — it ends a TURN.
   */
  private handleTurnEnded(
    winner: GameEvents['battle:ended']['winner'],
    xpAwards: GameEvents['battle:ended']['xpAwards'],
    survivorPower: GameEvents['battle:ended']['survivorPower'],
    tallies: GameEvents['battle:ended']['tallies'],
  ): void {
    if (this.phase !== 'battle') return;
    this.currentEncounter = null;
    // `survivorPower` is absent only from test fakes that drive the phase
    // machine without a real World; treat as a 0/0 (no-chip) turn.
    const sp = survivorPower ?? { player: 0, enemy: 0 };
    this.resolveTurn(sp);
    const result = this.turnResult();
    // M1 — bank THIS turn's XP at the boundary (pre-M1: accrued across the
    // encounter, banked once at the end), so a mid-encounter level-up fields
    // a stronger unit on the very next turn. A losing turn skips the bank:
    // defeat is terminal, so the levels would be dead state, and a level-up
    // pause in front of the defeat screen would be noise.
    if (result !== 'lost') {
      const promotions = this.bankXpAwards(xpAwards);
      if (promotions.length > 0) this.pendingPromotions = promotions;
      // 47f — settle the turn's battle-earned bits (the World's serialized
      // tally, the XP pattern). Through `gainBits`, so the `bitsGain` fold
      // applies at the settle (Laverna stacks with Moneta for free). Mirrors
      // the XP bank's skip-on-lost: a defeat's loot is dead state.
      if (tallies !== undefined && tallies.bits > 0) this.gainBits(tallies.bits);
      // 48b — the winning boundary rolls the encounter's rewards, alongside
      // the XP/tally banking above (rolled HERE, not at the gate, so a save
      // on the turn-outcome screen already carries the exact offer). Empty
      // roll → null → `continueFromTurnGate` skips the phase entirely (the
      // `promotions.length > 0` shape). Draws ride the two dedicated reward
      // streams, so a rewards-less win perturbs nothing.
      if (result === 'won') {
        const portions = rollRewards(
          this.selectedEncounter?.rewards ?? [],
          rewardTableById,
          this.ownedDaemonIds(),
          this.rewardRng,
          this.rewardBitsRng,
        );
        this.pendingRewards = portions.length > 0 ? portions : null;
      }
    }
    if (this.pauseAtTurnGates) {
      // Pause on the post-turn outcome screen; the player's `advanceTurn`
      // resumes into the promotion pause (if any units leveled) and then
      // `continueAfterTurn`.
      this.phase = 'turn-outcome';
      this.bus.emit('turn:resolved', {
        turn: this.turnIndex,
        winner,
        enemyPoolChip: sp.player * HEALTH.chipMultiplier,
        playerPoolChip: sp.enemy * HEALTH.chipMultiplier,
        result,
        playerHealth: this.playerHealth,
        playerHealthMax: HEALTH.playerHealthMax,
        enemyHealth: this.enemyHealth,
        enemyHealthMax: this.enemyHealthPoolMax,
      });
    } else {
      // 48b headless — the gate chain (reward → promotion → continue)
      // interposes between the resolved turn and the loop continuing (the
      // gated path enters the same chain from `handleAdvanceTurn`). The
      // harness/test loop resolves each gate and re-enters.
      this.continueFromTurnGate();
    }
  }

  /**
   * 48b — the post-turn gate chain, the shape-locked ordering: reward (loot
   * while the win is fresh) → promotion → `continueAfterTurn` (next turn /
   * finishEncounter → recruit/victory). Every gate resolution re-enters this
   * chain, so the ordering holds regardless of which gate a save/reload (or
   * the gated vs headless path) lands on. `turnResult` is pure — the pools
   * don't change across the pauses — so re-reading it here routes exactly as
   * the original boundary would have (the H4b `continueAfterTurn` contract).
   * `pendingRewards` is non-null only on a won final turn (`handleTurnEnded`
   * rolls it), so the reward gate can never interpose mid-encounter.
   */
  private continueFromTurnGate(): void {
    if (this.pendingRewards !== null) {
      this.phase = 'reward';
      this.bus.emit('reward:offered', { rewards: this.pendingRewards.slice() });
      return;
    }
    if (this.pendingPromotions !== null) {
      this.phase = 'promotion';
      this.bus.emit('promotion:pending', { promotions: this.pendingPromotions });
      return;
    }
    this.continueAfterTurn(this.turnResult());
  }

  /**
   * H4 — fold one turn's outcome into the pools. Each side's survivors chip the
   * OPPOSING pool by their Σ`power` (× `chipMultiplier`); the per-turn winner is
   * irrelevant to the chip (a draw chips both; a decisive win chips one because
   * the loser's survivor power is 0). XP banking is the caller's job (M1 — at
   * the turn boundary, right after this resolves).
   * Decision + continuation are split out (`turnResult`/`continueAfterTurn`) so
   * H4b's post-turn screen can show the result before the loop acts on it.
   */
  private resolveTurn(survivorPower: { player: number; enemy: number }): void {
    // Unconditional, at the top: even a 0/0 mutual-wipe turn must advance the
    // counter so the max-turns safety cap can terminate the encounter.
    this.turnIndex += 1;
    const chip = HEALTH.chipMultiplier;
    this.enemyHealth = Math.max(0, this.enemyHealth - survivorPower.player * chip);
    this.playerHealth = Math.max(0, this.playerHealth - survivorPower.enemy * chip);
  }

  /**
   * H4 — the encounter's status after the just-resolved turn, WITHOUT acting on
   * it. Precedence is fixed:
   *   1. `playerHealth <= 0` → `lost` (run-loss is terminal — checked FIRST, so
   *      a turn that zeroes BOTH pools is a defeat, not a win).
   *   2. `enemyHealth <= 0` → `won`.
   *   3. `turnIndex >= maxTurns` → safety cap: resolve by remaining pool
   *      fraction (player loses ties). Bounds an all-mutual-wipe encounter that
   *      would otherwise chip 0/0 forever.
   *   4. otherwise → `ongoing`.
   * Pure: re-reads the pools, which don't change across the turn-outcome pause,
   * so `continueAfterTurn` can recompute it at `advanceTurn` time identically.
   */
  private turnResult(): 'won' | 'lost' | 'ongoing' {
    if (this.playerHealth <= 0) return 'lost';
    if (this.enemyHealth <= 0) return 'won';
    if (this.turnIndex >= HEALTH.maxTurns) {
      const playerFrac = this.playerHealth / HEALTH.playerHealthMax;
      const enemyFrac = this.enemyHealth / this.enemyHealthPoolMax;
      return playerFrac > enemyFrac ? 'won' : 'lost';
    }
    return 'ongoing';
  }

  /**
   * H4 — act on a turn result: end the encounter (win / defeat) or roll into
   * the next turn (through the pre-turn gate). Called synchronously in the
   * headless path, or from `advanceTurn` (the post-turn screen) when gated.
   */
  private continueAfterTurn(result: 'won' | 'lost' | 'ongoing'): void {
    if (result === 'lost') {
      this.finishEncounter('defeat');
    } else if (result === 'won') {
      this.finishEncounter('win');
    } else {
      this.startNextTurn();
    }
  }

  /**
   * H4b — resume from a turn gate (the `advanceTurn` command). From
   * `turn-intro` start the turn's battle; from `turn-outcome` continue the
   * encounter (or end it). A no-op in any other phase, so a stray dispatch (a
   * double-click or a fired-then-disposed screen timer) can't corrupt state.
   */
  private handleAdvanceTurn(): void {
    if (this.phase === 'turn-intro') {
      this.phase = 'battle';
      this.beginTurn();
    } else if (this.phase === 'turn-outcome') {
      // 48b — the gate chain (reward → promotion → continue) runs AFTER the
      // outcome screen, so the result is read first (the M1 discipline,
      // generalized from the single promotion gate).
      this.continueFromTurnGate();
    }
  }

  /**
   * K3 — this turn's remaining redraw budget (actions + cards), the shape the
   * pre-turn screen renders. L1→47c: reads this turn's resolved grant —
   * 0/0 when the active daemon grants no redraw this turn.
   */
  get redrawAvailability(): RedrawAvailability {
    return redrawAvailability(
      { redrawsUsed: this.redrawsUsedThisTurn, cardsRedrawn: this.cardsRedrawnThisTurn },
      this.turnGrants.redraw,
    );
  }

  /**
   * K3 — redraw selected hand cards at the pre-turn gate (the `redrawCards`
   * command): send them to the discard, draw replacements into the SAME hand
   * positions. Validation (phase aside) lives in the pure `redrawRejection`;
   * any reject is a silent no-op that consumes no budget (mirrors the other
   * phase-guarded handlers).
   *
   * Order contract: positions are processed in ASCENDING hand order, so the
   * selection's click/dispatch order never changes the outcome (determinism
   * for the fuzz redraw policy). The selected cards are discarded BEFORE the
   * draws, so the piles always hold enough to refill every selected position
   * (the reshuffle cycle may hand a just-discarded card straight back when
   * the draw pile runs dry — the deck's normal H5 recycle, accepted) and the
   * hand size is preserved.
   *
   * The deployment-counter rule (a redrawn-away unit accrues NO deployment
   * count / fatigue stack) needs no code here: `beginTurn` records only the
   * FINAL fielded hand, and this runs strictly before it.
   */
  private handleRedrawCards(handIndices: readonly number[]): void {
    if (this.phase !== 'turn-intro') return;
    const rejection = redrawRejection(
      handIndices,
      this.hand.length,
      { redrawsUsed: this.redrawsUsedThisTurn, cardsRedrawn: this.cardsRedrawnThisTurn },
      this.turnGrants.redraw,
    );
    if (rejection !== null) return;
    const positions = [...handIndices].sort((a, b) => a - b);
    for (const pos of positions) this.discardPile.push(this.hand[pos]!);
    for (const pos of positions) this.hand[pos] = this.drawCard()!;
    this.redrawsUsedThisTurn += 1;
    this.cardsRedrawnThisTurn += positions.length;
    this.bus.emit('turn:handRedrawn', {
      hand: this.hand.map((idx) => this.team[idx]!),
      // R2 — the redraw moved cards between hand/draw/discard; re-send the piles
      // so the pre-turn pile views reflect the swap.
      drawPile: this.resolvePileForDisplay(this.drawPile),
      discardPile: this.resolvePileForDisplay(this.discardPile),
      redraw: this.redrawAvailability,
      // K4 — the refill may seat an already-empowered card (and the old
      // positions no longer line up), so the badge column re-derives here.
      empowerMagnitudes: this.empowerMagnitudes(),
    });
  }

  /**
   * K4 — this turn's remaining empower budget, the shape the pre-turn screen
   * renders. L1→47d: one entry per idol GRANTED this turn (empty when
   * nothing granted — daemon-less, chance-denied, or no empower idols), each
   * with its own remaining budget + buff mods. The fuzz empower bot iterates
   * these; `grantIndex` into this list rides the `empowerUnit` command.
   */
  get empowerGrants(): Array<{
    daemonId: string;
    name: string;
    empowersRemaining: number;
    buff: StatusEffect['mods'];
  }> {
    return this.turnGrants.empowers.map((grant, i) => ({
      daemonId: grant.daemonId,
      name: this.daemons.find((d) => d.id === grant.daemonId)?.name ?? grant.daemonId,
      empowersRemaining: Math.max(0, grant.empowersPerTurn - (this.empowersUsedThisTurn[i] ?? 0)),
      buff: grant.buff.mods,
    }));
  }

  /**
   * K4 — the per-hand-position empower stack column (parallel to `hand`,
   * 0 = unbuffed): each card's accumulated empower-buff magnitude on its
   * roster slot's encounter store. Derived (never stored) so it stays correct
   * across redraws and re-draws of an earlier turn's empowered card. L1: the
   * buff key comes from the DAEMON's authored empower hook (not the
   * resolved turn gate, so a chance-denied turn still badges existing
   * stacks); no empower daemon → no key → all zeros.
   */
  private empowerMagnitudes(): number[] {
    // 47d — one badge column across ALL owned empower idols' buff keys
    // (magnitudes sum; keys are distinct per idol by authoring convention).
    const buffKeys = new Set<string>();
    for (const d of this.daemons) {
      const hook = daemonEmpowerHook(d);
      if (hook !== undefined) buffKeys.add(hook.buff.key);
    }
    return this.hand.map((idx) => {
      let total = 0;
      for (const effect of this.encounterEffects[idx] ?? []) {
        if (buffKeys.has(effect.key)) total += effect.magnitude;
      }
      return total;
    });
  }

  /**
   * R2 — resolve a deck pile (`rosterIndex` values) to templates for the
   * pre-turn pile views, in RECRUITMENT order (ascending index) rather than the
   * stored draw order, so a view shows the pile's CONTENTS without revealing the
   * next-draw sequence (the resolved "contents only, unordered" decision).
   */
  private resolvePileForDisplay(pile: readonly number[]): UnitTemplate[] {
    return [...pile].sort((a, b) => a - b).map((idx) => this.team[idx]!);
  }

  /**
   * K4 — empower one drawn card at the pre-turn gate (the `empowerUnit`
   * command): its roster slot gains the active daemon's buff (L1 — the
   * resolved `turnGrants.empower.buff`) in the K1 encounter-effect store, so
   * the buff lasts the rest of the ENCOUNTER
   * (re-seeded onto the unit each turn at deploy — `beginTurn` runs after
   * this gate, so the buff is live on the very turn it's granted). The store
   * merges by key per the buff's policy: at the shipped `merge: "add"`,
   * re-empowering the same unit on a later turn STACKS (magnitude 2 → double
   * the mods). It lands on the SLOT, not the fielded copy, so it survives
   * the card being redrawn away or benched on later turns.
   *
   * Validation (phase aside) lives in the pure `empowerRejection`; any
   * reject is a silent no-op that consumes no budget (mirrors
   * `handleRedrawCards`).
   */
  private handleEmpowerUnit(handIndex: number, grantIndex: number): void {
    if (this.phase !== 'turn-intro') return;
    // 47d — the command names its grant source (which idol's blessing).
    // An out-of-range source is a silent no-op like every other reject.
    const grant = this.turnGrants.empowers[grantIndex];
    if (grant === undefined) return;
    const cfg = { enabled: true, empowersPerTurn: grant.empowersPerTurn, buff: grant.buff };
    const rejection = empowerRejection(
      handIndex,
      this.hand.length,
      { empowersUsed: this.empowersUsedThisTurn[grantIndex]! },
      cfg,
    );
    if (rejection !== null) return;
    this.addEncounterEffect(this.hand[handIndex]!, empowerEffect(cfg));
    this.empowersUsedThisTurn[grantIndex]! += 1;
    this.bus.emit('turn:unitEmpowered', {
      handIndex,
      empowers: this.empowerGrants,
      empowerMagnitudes: this.empowerMagnitudes(),
    });
  }

  /**
   * 47d — append a daemon to the ownership list (the §48 reward / §50 port
   * acquisition seam). Takes effect at the NEXT turn's grant resolution —
   * a mid-turn acquisition never retro-grants the current turn. Uncapped
   * (the locked design); duplicates are the CALLER's concern (reward tables
   * + port stock exclude owned ids upstream).
   */
  addDaemon(daemon: DaemonConfig): void {
    this.daemons.push(daemon);
    // 49b — ownership feeds the cacheSize fold: a size-modifier idol changes
    // the DERIVED capacity (possibly into overflow — the forced-keep state)
    // without touching the cache list, so the cache surfaces repaint off
    // this emit too.
    this.emitCacheChanged();
  }

  /**
   * 48b — the ids the run currently owns, derived at call time (the only
   * pre-48b expression was `toJSON`'s inline map). The exclusion input for
   * reward-table sampling (and §50's port stock after it).
   */
  ownedDaemonIds(): ReadonlySet<string> {
    return new Set(this.daemons.map((d) => d.id));
  }

  /**
   * 48b — accept one pending reward portion (an index into `pendingRewards`).
   * Bits settle through `gainBits` (the fold applies NOW, at accept time —
   * so a daemon accepted earlier in this same offer already counts); a
   * daemon joins the ownership list immediately, which also means the
   * just-won encounter's `encounterEnd` hooks (fired later, in
   * `finishEncounter`) include it — accepted behavior, the loot fires for
   * the fight it dropped from (worklog §48). Outside the reward phase or
   * out-of-range: the silent no-op discipline (a double-click can't corrupt
   * state). Resolving the last portion re-enters the gate chain.
   */
  private handleAcceptReward(index: number): void {
    const portion = this.takePendingReward(index);
    if (portion === null) return;
    if (portion.kind === 'bits') {
      this.gainBits(portion.base);
    } else {
      const daemon = daemonById(portion.daemonId);
      if (daemon === undefined) {
        // The roller only emits catalog ids (boot-asserted tables) — a miss
        // here is corruption, and loud beats a silently vanished reward.
        throw new Error(`Run.handleAcceptReward: unknown daemon id '${portion.daemonId}'`);
      }
      this.addDaemon(daemon);
    }
    this.afterRewardResolved();
  }

  /** 48b — decline one pending reward portion (the declinable-per-portion
   *  spec lock, `passRecruit`'s sibling). Same no-op guards as accept. */
  private handleDeclineReward(index: number): void {
    if (this.takePendingReward(index) === null) return;
    this.afterRewardResolved();
  }

  /** 48b — pop portion `index` out of the pending offer, or null when the
   *  command is stray (wrong phase / no offer / out-of-range index). */
  private takePendingReward(index: number): RewardPortion | null {
    if (this.phase !== 'reward' || this.pendingRewards === null) return null;
    const portion = this.pendingRewards[index];
    if (portion === undefined) return null;
    this.pendingRewards.splice(index, 1);
    return portion;
  }

  /** 48b — after a portion resolves: wait for the rest, or (offer drained)
   *  clear it and re-enter the gate chain (promotion next, then the
   *  recruit/victory fork via `continueAfterTurn` → `finishEncounter`). */
  private afterRewardResolved(): void {
    if (this.pendingRewards !== null && this.pendingRewards.length > 0) return;
    this.pendingRewards = null;
    this.continueFromTurnGate();
  }

  /**
   * H4 — end the encounter. On a win, bank the encounter's accrued XP ONCE
   * (so a single PromotionScene pops for the whole encounter) then take the
   * existing post-battle path (promotion → recruit, or run:victory at the
   * terminal). On defeat, the pending XP is discarded (the run is over) and we
   * route to game-over.
   *
   * E4 — banking BEFORE rolling the next step means the post-victory screens
   * already reflect updated levels/stats. Level-up rolls advance `levelupRng`;
   * the recruit offer's fork is independent.
   */
  private finishEncounter(outcome: 'win' | 'defeat'): void {
    // 47e — daemon `encounterEnd` instant hooks fire FIRST, on both
    // outcomes, with the outcome as the `won` filter context (the 47b
    // matrix pins `won` to this trigger). A defeat-path heal can leave a
    // lost run with a positive pool — harmless, the run is already over.
    this.executeInstantOps(
      resolveInstantHooks(this.daemons, 'encounterEnd', { won: outcome === 'win' }, this.daemonRng),
    );
    // K3.5 — the battlefield is encounter-scoped; drop it with the encounter.
    this.encounterMap = null;
    // U3 — the selected encounter + its wave cursor are encounter-scoped too.
    this.selectedEncounter = null;
    this.waveCursor = null;
    if (outcome === 'defeat') {
      this.phase = 'defeat';
      this.bus.emit('run:defeated', {});
      return;
    }
    // M1 — nothing left to bank here: each turn's XP (including the winning
    // turn's) was banked at its own boundary, and any final-turn promotion
    // already paused before `continueAfterTurn` routed into this win.
    this.advancePastBattle();
  }

  /**
   * E4 — common tail for "battle just resolved in player's favor and
   * the PromotionScene (if any) is done." Splits run:victory from
   * recruit:offered the same way handleBattleEnded used to.
   */
  private advancePastBattle(): void {
    if (this.currentNodeId === this.nodeMap.terminalId) {
      // T2 — a sector terminal was cleared. At a sector-DAG sink the run is WON;
      // otherwise advance to a successor sector (carrying the player pool +
      // roster — a sector is a chapter of one run, not a fresh run). Only "The
      // Start" ships (its DAG node is both source and sink), so the non-sink
      // branch is built + headless-tested but never reached in shipped play.
      if (isSectorSink(this.sectorMap, this.currentSectorNodeId)) {
        this.phase = 'complete';
        this.bus.emit('run:victory', {});
      } else {
        this.advanceSector();
      }
    } else {
      this.phase = 'recruit';
      // G4 — recruit level tracks the TEAM (round avg + geometric bonus), not
      // the hop, so a fresh draft stays useful on a leveled roster. Post-G5:
      // the geometric bonus is drawn INDEPENDENTLY per card over a shared
      // `round(avgTeamLevel)` base, so a lucky offer shows one over-leveled
      // standout rather than boosting all cards together. Each card's level is
      // clamped to the level cap.
      const offerRng = this.rng.fork();
      const baseLevel = Math.round(avgTeamLevel(this.team));
      this.currentOffer = rollOffer(offerRng, undefined, (cardRng) =>
        Math.min(LEVELING.levelCap, baseLevel + recruitLevelBonus(cardRng, RECRUITMENT.recruitBonusChance)),
      );
      this.bus.emit('recruit:offered', { units: this.currentOffer });
    }
  }

  /**
   * T2 — advance to the next sector after clearing a (non-sink) sector terminal.
   * Picks a successor DAG node + a sector there, regenerates the node-map for
   * the new sector, and returns the run to the pre-root start so the new sector's
   * root is the next pick. The player pool + roster + deck carry across
   * unchanged (the carry-across decision); only the map + sector cursor reset.
   *
   * Built for the future N-sector content — the SHIPPED single-sector run never
   * reaches here (its terminal is a sink → run:victory). The live scene refresh
   * for a mid-run sector swap (a between-sector banner, the map re-render) is
   * deferred with the multi-sector content; headlessly this is a clean
   * battle→map transition onto a fresh map.
   */
  private advanceSector(): void {
    const sectorRng = this.rng.fork();
    const next = pickNextSector(this.sectorMap, this.currentSectorNodeId, sectorRng);
    this.currentSectorNodeId = next.sectorNodeId;
    this.currentSectorId = next.sectorId;
    this.nodeMap = generateNodeMap(sectorRng, undefined, this.currentSectorLength());
    // Back to the pre-root start: the new sector's root is selected like any
    // first encounter. visitedNodes are node ids from the OLD map — clear them.
    this.currentNodeId = PRE_ROOT_NODE_ID;
    this.visitedNodes.clear();
    this.phase = 'map';
  }

  /**
   * G3 — resolve a rest node inline (no battle). Synthesize a flat
   * `LEVELING.restXp` award per roster slot and feed the SAME `bankXpAwards`
   * pipeline a battle win uses (it reads only `rosterIndex` + `xpGained`), so
   * a rest can legitimately level units and pop PromotionScene — no parallel
   * leveling path. A rest never offers a recruit: with promotions we pause on
   * PromotionScene (the dismiss routes back to map via `kindOf`), otherwise we
   * return to the map silently (Game swaps MapScene on `phase === 'map'`).
   */
  private resolveRest(): void {
    // H6a — a rest also heals the run-wide player pool (capped at max).
    // Unconditional + ahead of the XP/promotion branch so a rest that ALSO
    // levels a unit still heals. Placeholder beside the +XP award until the
    // real event system reworks both.
    this.playerHealth = Math.min(
      HEALTH.playerHealthMax,
      this.playerHealth + HEALTH.restHealAmount,
    );
    const awards = this.team.map((_, i) => ({
      unitId: i,
      rosterIndex: i,
      damageDealt: 0,
      xpGained: LEVELING.restXp,
    }));
    const promotions = this.bankXpAwards(awards);
    if (promotions.length > 0) {
      this.phase = 'promotion';
      this.pendingPromotions = promotions;
      this.bus.emit('promotion:pending', { promotions });
    } else {
      this.phase = 'map';
    }
  }

  private handleDismissPromotion(): void {
    if (this.phase !== 'promotion') return;
    this.pendingPromotions = null;
    // M1 — a battle-sourced promotion fires at the TURN boundary, while the
    // encounter is still live (`encounterMap` set — cleared only in
    // `finishEncounter`, and rest nodes never set it, so it cleanly
    // discriminates the turn loop from the G3 rest path below). Re-enter the
    // loop: the recomputed `turnResult` routes to the next turn or into
    // `finishEncounter` (a won final turn → recruit/victory as before).
    if (this.encounterMap !== null) {
      this.continueAfterTurn(this.turnResult());
      return;
    }
    // G3 — a rest-node promotion returns to the map (no recruit). The
    // `advancePastBattle` leg is unreachable post-M1 (battle promotions are
    // turn-boundary-only now), kept as the defensive default.
    if (this.kindOf(this.currentNodeId) === 'rest') {
      this.phase = 'map';
    } else {
      this.advancePastBattle();
    }
  }

  /**
   * E4 — apply an award batch to `this.team`, returning any promotion
   * deltas for PromotionScene. For each award:
   *   1. Find the roster template via `rosterIndex` (skip if null — a
   *      test fixture spawn that didn't stamp the field).
   *   2. Add `xpGained` to the template's banked XP.
   *   3. While banked >= `xpToNext(level)` AND level < cap: spend the
   *      threshold, level up, roll new stats via `simulateLevelUps(1)`
   *      against `levelupRng`. At cap, drain any remaining banked XP
   *      (no infinite-grind overflow).
   *   4. Write the new template back into the roster slot.
   *
   * Deterministic ordering: awards are iterated as received from the
   * event payload, which World produces in unit-iteration order. RNG
   * draws come off `levelupRng` in that same order. So a snapshot at
   * any point round-trips identically.
   */
  private bankXpAwards(
    awards: GameEvents['battle:ended']['xpAwards'],
  ): PromotionInfo[] {
    const promotions: PromotionInfo[] = [];
    for (const award of awards) {
      if (award.rosterIndex === null) continue;
      const idx = award.rosterIndex;
      const template = this.team[idx];
      if (!template) continue;
      const oldLevel = template.level;
      const oldStats = template.stats;
      let xp = template.xp + award.xpGained;
      let level = template.level;
      let stats = template.stats;
      // `xpToNext` returns Infinity at the cap, so the loop naturally
      // exits there — the explicit cap drain below covers the
      // "leftover xp at cap" edge case.
      while (level < LEVELING.levelCap && xp >= xpToNext(level)) {
        xp -= xpToNext(level);
        level += 1;
        stats = simulateLevelUps(
          stats,
          growthRatesForArchetype(template.archetype as Archetype),
          1,
          this.levelupRng,
        );
      }
      if (level >= LEVELING.levelCap) xp = 0;
      this.team[idx] = { ...template, xp, level, stats };
      if (level > oldLevel) {
        promotions.push({
          rosterIndex: idx,
          archetype: template.archetype,
          glyph: glyphForArchetype(template.archetype),
          oldLevel,
          newLevel: level,
          oldStats,
          newStats: stats,
        });
      }
    }
    return promotions;
  }

  private handleChooseRecruit(unitTemplate: UnitTemplate): void {
    if (this.phase !== 'recruit') return;
    this.team.push(unitTemplate);
    // H3 — keep the deployment counter parallel to the roster. A fresh
    // recruit hasn't been deployed in the current encounter yet.
    this.deploymentCounts.push(0);
    // K1 — keep the encounter-effect store synced with `team` (fresh slot, no
    // effects). Parallel to the deploymentCounts append above.
    this.encounterEffects.push([]);
    this.currentOffer = null;
    this.phase = 'map';
  }

  /**
   * H6b — decline the offer. `handleChooseRecruit`'s sibling MINUS the
   * roster/deck mutation: drop the offer and return to the map, leaving the
   * team (and its parallel `deploymentCounts`) untouched.
   */
  private handlePassRecruit(): void {
    if (this.phase !== 'recruit') return;
    this.currentOffer = null;
    this.phase = 'map';
  }

  private isFrontier(nodeId: number): boolean {
    // S2 — at the pre-root start the root is the sole frontier; thereafter the
    // frontier is the current node's outgoing edges.
    if (this.currentNodeId === PRE_ROOT_NODE_ID) return nodeId === this.nodeMap.rootId;
    for (const e of this.nodeMap.edges) {
      if (e.from === this.currentNodeId && e.to === nodeId) return true;
    }
    return false;
  }

  /**
   * H3 — zero every deployment count. Called at encounter start. Public
   * because it's the seam the H4 encounter loop drives (reset once per
   * encounter, before the first turn).
   */
  resetDeploymentCounts(): void {
    this.deploymentCounts.fill(0);
  }

  /**
   * K1 — clear every slot's encounter-effect store. Called at encounter start
   * (alongside `resetDeploymentCounts`) so `endOfEncounter` effects don't leak
   * into the next encounter. A fresh `[]` per slot keeps the array length
   * synced with `team`.
   */
  resetEncounterEffects(): void {
    for (let i = 0; i < this.encounterEffects.length; i++) this.encounterEffects[i] = [];
  }

  /**
   * H3 — bump the deployment count for each deployed roster slot. Called
   * once per turn with the slots that were actually deployed (pre-H5 that's
   * the whole roster; H5 passes the drawn hand). Out-of-range indices are
   * ignored so a stale hand can't write past the array. Public for the
   * same reason as `resetDeploymentCounts` — the H4 turn loop calls it.
   */
  recordDeployment(rosterIndices: readonly number[]): void {
    for (const idx of rosterIndices) {
      if (idx >= 0 && idx < this.deploymentCounts.length) {
        this.deploymentCounts[idx]! += 1;
      }
    }
  }

  /**
   * K1 — add an encounter-scoped status effect to a roster slot (the
   * `endOfEncounter` authoring lifetime). It persists for the rest of the
   * encounter, re-seeded onto the fielded unit each turn at deploy, merged by
   * key per its policy. Pass an `endOfTurn`-lifetime effect (the store re-seeds
   * it per turn). Out-of-range slots are ignored. The daemon / empower seam
   * (K4 / L); reset at encounter start (`resetEncounterEffects`).
   */
  addEncounterEffect(rosterIndex: number, effect: StatusEffect): void {
    const list = this.encounterEffects[rosterIndex];
    if (list === undefined) return;
    mergeEffectInto(list, effect);
  }

  /**
   * K1 — register a run-lifecycle trigger handler (`encounterStart` /
   * `turnStart` / `deploy`). The Phase-L daemon seam; handlers fire in
   * registration order and are not snapshotted (re-register on rehydrate).
   */
  registerTrigger<K extends keyof RunTriggerContextMap>(
    name: K,
    handler: (ctx: RunTriggerContextMap[K], run: Run) => void,
  ): void {
    this.runTriggers.register(name, handler);
  }

  private fireTrigger<K extends keyof RunTriggerContextMap>(
    name: K,
    ctx: RunTriggerContextMap[K],
  ): void {
    this.runTriggers.fire(name, ctx, this);
  }

  /**
   * H5 — draw up to `DECK.handSize` cards from the deck. Pulls from the end of
   * `drawPile`; when it empties mid-draw, the `discardPile` is shuffled back in
   * and drawing continues. Stops early only when BOTH piles are exhausted (a
   * roster smaller than `handSize` simply fields everyone). Returns the drawn
   * `rosterIndex` values; the caller seats them in `this.hand`.
   */
  private drawHand(): number[] {
    const hand: number[] = [];
    while (hand.length < DECK.handSize) {
      const card = this.drawCard();
      if (card === undefined) break; // deck fully dealt this turn
      hand.push(card);
    }
    return hand;
  }

  /**
   * K3 — draw ONE card (factored out of `drawHand`, byte-identical pop +
   * reshuffle order, so the turn draw is unchanged): pop from `drawPile`,
   * reshuffling the discard back in when it's empty (the only RNG draw in the
   * deck cycle, off the isolated `deckRng`). `undefined` only when BOTH piles
   * are exhausted. Shared by the turn draw and the redraw refill.
   */
  private drawCard(): number | undefined {
    if (this.drawPile.length === 0) {
      if (this.discardPile.length === 0) return undefined;
      this.drawPile = this.discardPile;
      this.discardPile = [];
      shuffleInPlace(this.drawPile, this.deckRng);
    }
    return this.drawPile.pop();
  }

  toJSON(): RunSnapshot {
    return {
      schemaVersion: RUN_SCHEMA_VERSION,
      rng: this.rng.toJSON(),
      levelupRng: this.levelupRng.toJSON(),
      deckRng: this.deckRng.toJSON(),
      daemonRng: this.daemonRng.toJSON(),
      rewardRng: this.rewardRng.toJSON(),
      rewardBitsRng: this.rewardBitsRng.toJSON(),
      // 47d — daemons serialize BY ID (def-resolved on load); `turnGrants`
      // by reference (never mutated in place — reassigned whole each turn;
      // `empowerEffect` deep-copies the buff mods at apply time).
      daemonIds: this.daemons.map((d) => d.id),
      turnGrants: this.turnGrants,
      currentSectorId: this.currentSectorId,
      currentSectorNodeId: this.currentSectorNodeId,
      nodeMap: this.nodeMap,
      team: this.team.slice(),
      deploymentCounts: this.deploymentCounts.slice(),
      // K1 — deep-copy each slot's effect list (effects are mutated in place on
      // merge, so the wire image must not share references with the live store).
      encounterEffects: this.encounterEffects.map((slot) => slot.map(cloneEffect)),
      drawPile: this.drawPile.slice(),
      discardPile: this.discardPile.slice(),
      hand: this.hand.slice(),
      redrawsUsedThisTurn: this.redrawsUsedThisTurn,
      cardsRedrawnThisTurn: this.cardsRedrawnThisTurn,
      empowersUsedThisTurn: this.empowersUsedThisTurn.slice(),
      bits: this.bits,
      cache: this.cache.slice(),
      playerHealth: this.playerHealth,
      enemyHealth: this.enemyHealth,
      turnIndex: this.turnIndex,
      selectedEncounterId: this.selectedEncounter?.id ?? null,
      waveCursor: this.waveCursor,
      encounterMap: this.encounterMap,
      currentNodeId: this.currentNodeId,
      phase: this.phase,
      currentEncounter: this.currentEncounter,
      currentOffer: this.currentOffer ? this.currentOffer.slice() : null,
      visitedNodes: Array.from(this.visitedNodes),
      pendingPromotions: this.pendingPromotions
        ? this.pendingPromotions.slice()
        : null,
      // 48b — copy each portion (flat objects, mutated only by splice — the
      // copies keep the wire image independent of the live offer).
      pendingRewards: this.pendingRewards
        ? this.pendingRewards.map((p) => ({ ...p }))
        : null,
    };
  }

  /**
   * Rehydrate a Run from a snapshot. Bypasses the constructor (no
   * `run:started` emit, no nodeMap regeneration) and assigns each field
   * from the snapshot, then subscribes to the bus for the live
   * `battle:ended` event. Caller supplies the bus — typically a fresh one
   * for replay-trace comparison, or the active game bus for save/load.
   */
  static fromJSON(snap: RunSnapshot, bus: EventBus<GameEvents>): Run {
    if (snap.schemaVersion !== RUN_SCHEMA_VERSION) {
      throw new Error(`Run.fromJSON: unsupported schema version ${snap.schemaVersion}`);
    }
    const run = Object.create(Run.prototype) as Run;
    type Mut = { -readonly [K in keyof Run]: Run[K] } & {
      bus: EventBus<GameEvents>;
      subscriptions: Array<() => void>;
      forcedLayoutId: string | null;
      forcedEncounterId: string | null;
      difficultyMultipliers: DifficultyMultipliers;
      runTriggers: TriggerDispatcher<RunTriggerContextMap, Run>;
      turnGrants: TurnGrants;
      sectorMap: SectorMap;
    };
    const m = run as unknown as Mut;
    m.bus = bus;
    m.subscriptions = [];
    // RunConfig isn't persisted; a restored run uses normal procedural rolls.
    m.forcedLayoutId = null;
    // X2 — same: a rehydrated run drops the forced-encounter isolation.
    m.forcedEncounterId = null;
    // X1 — RunConfig isn't persisted either, so re-resolve the difficulty lever
    // to the shipped difficulty.json defaults (an overridden run can't be saved
    // mid-flight today; a future difficulty system would persist its own source).
    m.difficultyMultipliers = resolveDifficultyMultipliers();
    m.rng = RNG.fromJSON(snap.rng);
    m.levelupRng = RNG.fromJSON(snap.levelupRng);
    m.deckRng = RNG.fromJSON(snap.deckRng);
    m.daemonRng = RNG.fromJSON(snap.daemonRng);
    m.rewardRng = RNG.fromJSON(snap.rewardRng);
    m.rewardBitsRng = RNG.fromJSON(snap.rewardBitsRng);
    // 47d — re-resolve owned daemons BY ID from the shipped catalog; an
    // unknown id (retired entry / bespoke daemon) is a hard reject, never a
    // silent drop. The CURRENT turn's resolved grants restore as-is (a save
    // at the pre-turn gate keeps its Mercury flip — never re-rolled).
    m.daemons = snap.daemonIds.map((id) => {
      const daemon = daemonById(id);
      if (daemon === undefined) {
        throw new Error(`Run.fromJSON: unknown daemon id '${id}' (not in the catalog)`);
      }
      return daemon;
    });
    m.turnGrants = snap.turnGrants;
    // T2 — RunConfig (incl. a sectorMap override) isn't persisted; a restored
    // run walks the shipped DAG. The shipped DAG is a single sink, so a save is
    // never taken mid-walk of a multi-node graph — the fallback is exact.
    m.sectorMap = SECTOR_MAP;
    m.currentSectorId = snap.currentSectorId;
    m.currentSectorNodeId = snap.currentSectorNodeId;
    m.nodeMap = snap.nodeMap;
    m.team = snap.team.slice();
    m.deploymentCounts = snap.deploymentCounts.slice();
    // K1 — restore the encounter-effect store (deep copy) + a fresh dispatcher
    // (handlers aren't snapshotted; a daemon layer re-registers on rehydrate).
    m.encounterEffects = snap.encounterEffects.map((slot) => slot.map(cloneEffect));
    m.runTriggers = new TriggerDispatcher<RunTriggerContextMap, Run>();
    m.drawPile = snap.drawPile.slice();
    m.discardPile = snap.discardPile.slice();
    m.hand = snap.hand.slice();
    m.redrawsUsedThisTurn = snap.redrawsUsedThisTurn;
    m.cardsRedrawnThisTurn = snap.cardsRedrawnThisTurn;
    m.empowersUsedThisTurn = snap.empowersUsedThisTurn.slice();
    // 47e — re-clamp on load: the zero floor is an invariant, not a trust
    // in the wire image (a hand-edited save can't restore a negative balance).
    m.bits = Math.max(0, snap.bits);
    // 49b — re-resolve each cached packet id against the catalog (the
    // daemonIds discipline: unknown = hard reject, never a silent drop). An
    // over-capacity cache is legal — the shrink overflow re-derives.
    m.cache = snap.cache.map((id) => {
      if (packetById(id) === undefined) {
        throw new Error(`Run.fromJSON: unknown packet id '${id}' (not in the catalog)`);
      }
      return id;
    });
    m.playerHealth = snap.playerHealth;
    m.enemyHealth = snap.enemyHealth;
    m.turnIndex = snap.turnIndex;
    // V1 — re-resolve the held Encounter from its persisted id (the authored
    // catalog), and restore the wave cursor as-is (plain JSON, never mutated).
    m.selectedEncounter = resolveSelectedEncounter(snap.selectedEncounterId);
    m.waveCursor = snap.waveCursor;
    m.encounterMap = snap.encounterMap;
    m.currentNodeId = snap.currentNodeId;
    m.phase = snap.phase;
    m.currentEncounter = snap.currentEncounter;
    m.currentOffer = snap.currentOffer ? snap.currentOffer.slice() : null;
    m.visitedNodes = new Set(snap.visitedNodes);
    m.pendingPromotions = snap.pendingPromotions
      ? snap.pendingPromotions.slice()
      : null;
    // 48b — restore the pending offer, validating daemon portions against
    // the catalog (the daemonIds discipline: an unknown id is a hard reject,
    // never a silently unacceptable reward).
    m.pendingRewards = snap.pendingRewards
      ? snap.pendingRewards.map((p) => {
          if (p.kind === 'daemon' && daemonById(p.daemonId) === undefined) {
            throw new Error(
              `Run.fromJSON: pending reward references unknown daemon id '${p.daemonId}'`,
            );
          }
          return { ...p };
        })
      : null;
    run['subscribe']();
    return run;
  }
}

/**
 * H5 — Fisher–Yates shuffle in place. Mirrors `battleSetup`'s tile shuffle;
 * kept local rather than shared for one tiny helper (rule-of-three not yet hit
 * — extract a `src/core` util if a third caller appears).
 */
function shuffleInPlace<T>(arr: T[], rng: RNG): void {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = rng.int(0, i);
    [arr[i], arr[j]] = [arr[j]!, arr[i]!];
  }
}

/**
 * Player starting team: fixed 3 melee + 2 ranged at `RECRUITMENT.startingLevel`
 * (default 1 → byte-identical to the pre-knob roll, since rollUnit short-circuits
 * level 1 without drawing). Doesn't change with run progress — recruits grow the
 * team via Run.handleChooseRecruit.
 */
function rollTeam(rng: RNG): UnitTemplate[] {
  const team: UnitTemplate[] = [];
  for (let i = 0; i < STARTING_MELEE; i++) team.push(rollUnit('mercenary', rng, STARTING_LEVEL));
  for (let i = 0; i < STARTING_RANGED; i++) team.push(rollUnit('ranged', rng, STARTING_LEVEL));
  return team;
}

/**
 * G1 — validate a `RunConfig.forcedLayoutId` against the layout library at
 * construction (loud throw, mirroring `layoutDimensions`), so a typo'd layout
 * fails fast at run start rather than silently per-battle. Undefined → null
 * (normal procedural/layout roll); the `FORCE_PROCEDURAL` sentinel passes
 * through (M6 — force a fresh procedural map every battle).
 */
function resolveForcedLayoutId(id: string | undefined): string | null {
  if (id === undefined) return null;
  if (id === FORCE_PROCEDURAL) return FORCE_PROCEDURAL;
  if (!LAYOUT_IDS.includes(id)) {
    throw new Error(`Run: unknown forcedLayoutId="${id}" (not in LAYOUT_IDS)`);
  }
  return id;
}

/**
 * X2 — validate a `RunConfig.forcedEncounterId` against the authored catalog at
 * construction (loud throw, mirroring `resolveForcedLayoutId`), so a typo'd id
 * fails fast at run start rather than mid-run inside selection. Undefined → null
 * (normal sector-pool selection). The balance harness (`--encounter=<id>`) sets
 * it to force one encounter at every matching-kind node.
 */
function resolveForcedEncounterId(id: string | undefined): string | null {
  if (id === undefined) return null;
  if (getEncounter(id) === undefined) {
    throw new Error(`Run: unknown forcedEncounterId="${id}" (not in the encounter catalog)`);
  }
  return id;
}

/**
 * D3: pick the procedural arena's side length, uniformly in
 * `[TERRAIN.proceduralMinSize, TERRAIN.proceduralMaxSize]`. Always
 * consumes one RNG step — including on layout encounters that ignore
 * the result — so the stream advances identically regardless of
 * branch. That mirrors the gotcha #49 byte-continuity invariant the
 * sector-pool roll maintains for the layout pick.
 */
function rollProceduralSide(rng: RNG): number {
  return rng.int(TERRAIN.proceduralMinSize, TERRAIN.proceduralMaxSize);
}

function layoutDimensions(layoutId: string): { gridW: number; gridH: number } {
  const layout = getLayout(layoutId);
  if (!layout) {
    throw new Error(`Run.handleEnterNode: unknown layoutId="${layoutId}"`);
  }
  return { gridW: layout.gridW, gridH: layout.gridH };
}
