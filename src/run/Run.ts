/**
 * Run-level state machine. Owns the meta state that survives across battles:
 * the seeded RNG, the generated NodeMap, the player roster, the current
 * position on the map, and which phase the run is in.
 *
 * Phases:
 *
 *   map ── enterNode (frontier) ──▶ battle
 *   battle ── battle:ended (player win, non-terminal) ──▶ recruit
 *   battle ── battle:ended (player win, terminal)     ──▶ complete
 *   battle ── battle:ended (enemy win)                ──▶ defeat
 *   recruit ── chooseRecruit ──▶ map
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
import { rollOffer, recruitLevelBonus } from './Recruitment';
import { enemyBudgetFor, rollEnemyWave, avgTeamLevel } from './enemyBudget';
import { fatigueEffect } from './fatigue';
import {
  redrawAvailability,
  redrawRejection,
  type RedrawAvailability,
} from './redraw';
import {
  empowerAvailability,
  empowerRejection,
  empowerEffect,
  type EmpowerAvailability,
} from './empower';
import {
  rollDaemon,
  resolveTurnGates,
  disabledTurnGates,
  type TurnGates,
} from './daemon';
import { cloneEffect, mergeEffectInto, type StatusEffect } from '../sim/statusEffects';
import { TriggerDispatcher } from '../sim/triggers';
import type { RunCommand } from './Command';
import { RECRUITMENT } from '../config/recruitment';
import { TERRAIN } from '../config/terrain';
import { HEALTH } from '../config/health';
import { DECK } from '../config/deck';
import { DAEMONS, type DaemonConfig } from '../config/daemons';
import { LAYOUT_IDS, THEMES, getLayout, type Theme } from '../sim/layouts';
import { LEVELING } from '../config/leveling';
import { xpToNext } from '../sim/xp';
import { simulateLevelUps } from '../sim/leveling';
import { growthRatesForArchetype } from '../sim/archetypes';
import type { Archetype } from '../sim/archetypes';

// H4b adds the two TURN-GATE phases (`turn-intro` / `turn-outcome`) — entered
// only when `pauseAtTurnGates` is on, so the pre/post-turn screens can pause the
// encounter loop. The headless loop never enters them (it runs straight through
// `battle`), so existing headless tests + the fuzz harness are unaffected.
export type RunPhase =
  | 'map'
  | 'turn-intro'
  | 'battle'
  | 'turn-outcome'
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
   * procedural encounters roll uniformly off `battleRng` (see
   * `rollTheme` below). The roll always runs even on hand-authored
   * encounters so the RNG stream advances identically across branches
   * (same byte-continuity invariant as `rollLayoutId` /
   * `rollProceduralSide` — gotcha #49).
   */
  readonly theme: Theme;
  readonly playerTeam: readonly UnitTemplate[];
  readonly enemyTeam: readonly UnitTemplate[];
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
 *  XP that v17 code would silently drop → reject. */
const RUN_SCHEMA_VERSION = 19;

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
  /** L1: the run's daemon, stored whole (not by id) — a save survives catalog
   *  edits, and a bespoke (test / future-profile) daemon round-trips. Null =
   *  a daemon-less run (both pre-turn gates permanently disabled). */
  daemon: DaemonConfig | null;
  /** L1: the current turn's resolved pre-turn gates (`resolveTurnGates`
   *  output). Persisted so a save at the gate restores the same chance flips. */
  turnGates: TurnGates;
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
  /** K3: redraw actions taken this turn (vs the L1 `turnGates.redraw` budget).
   *  Reset at every turn start; meaningful only at the pre-turn gate. */
  redrawsUsedThisTurn: number;
  /** K3: total cards redrawn this turn (vs `turnGates.redraw.maxCardsPerTurn`). */
  cardsRedrawnThisTurn: number;
  /** K4: empower actions taken this turn (vs `turnGates.empower.empowersPerTurn`).
   *  Reset at every turn start; meaningful only at the pre-turn gate. */
  empowersUsedThisTurn: number;
  /** H4: the run-wide player health pool (persists across the whole run). */
  playerHealth: number;
  /** H4: the active encounter's enemy pool (reset each encounter). */
  enemyHealth: number;
  /** H4: turns elapsed in the active encounter (drives the max-turns cap). */
  turnIndex: number;
  /** H4: the active encounter's fixed enemy level budget (computed once at
   *  encounter start; the wave composition re-rolls per turn against it). */
  encounterBudget: number;
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
  /** L1: the run's daemon — rolled uniformly over `DAEMONS` at construction,
   *  or forced via `RunConfig.daemon` (a bespoke config, or null = daemon-less,
   *  the fuzz control arm). Daemon-only gates: this is the ONLY source of
   *  redraw/empower availability. */
  readonly daemon: DaemonConfig | null;
  /** L1: the current turn's resolved pre-turn gates — re-resolved at every
   *  turn start (`startNextTurn`, where a chance gate flips its coin), the
   *  config the K3/K4 validators consume in place of the retired static
   *  `DECK.redraw` / `EMPOWER` enables. Round-trips in the save (v16). */
  private turnGates: TurnGates;
  readonly nodeMap: NodeMap;
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
   * checked against the L1 `turnGates.redraw` budget by `handleRedrawCards`.
   * Both reset at every turn start (`startNextTurn`, BEFORE `turn:starting`
   * fires so the payload reads a fresh budget) and round-trip in the Run save
   * (v13) — a save at the pre-turn gate after a redraw must not refresh the
   * budget.
   */
  redrawsUsedThisTurn: number;
  cardsRedrawnThisTurn: number;
  /**
   * K4 — per-turn empower bookkeeping: actions taken this turn, checked
   * against `turnGates.empower.empowersPerTurn` by `handleEmpowerUnit`. Same
   * lifecycle as the K3 redraw counters (reset in `startNextTurn` before the
   * `turn:starting` emit; round-trips in the Run save, v15).
   */
  empowersUsedThisTurn: number;
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
  /** H4 — the active encounter's enemy level budget, computed ONCE at encounter
   *  start via `enemyBudgetFor`. The wave composition re-rolls per turn against
   *  this fixed budget; persisted (not recomputed on resume) so a mid-encounter
   *  restore can't drift if the roster changed since. */
  encounterBudget: number;
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
   * Nodes the player has cleared (entered + survived). Used by MapScreen to
   * draw a visual trail of completed nodes. Root is never added — it's not
   * "completed" in the battle sense, it's just the starting point.
   */
  readonly visitedNodes: Set<number>;

  /**
   * G1 — when set (via `RunConfig.forcedLayoutId`), every battle uses this
   * hand-authored layout instead of `rollLayoutId`; the `FORCE_PROCEDURAL`
   * sentinel forces a fresh procedural map every battle instead (M6). Null =
   * normal procedural/layout roll. Not persisted (RunConfig is a run input,
   * reconstructable from seed); a rehydrated Run resets this to null.
   */
  private readonly forcedLayoutId: string | null;

  private readonly bus: EventBus<GameEvents>;
  private subscriptions: Array<() => void> = [];

  constructor(seed: number, bus: EventBus<GameEvents>, config?: RunConfig) {
    this.bus = bus;
    this.rng = new RNG(seed);
    // Fork order is the determinism invariant (nodeMap → team → levelup). Each
    // override only changes a forked *child* stream's content, never how many
    // times the parent is forked — so the default path stays byte-identical
    // and a configured run keeps the same parent alignment. (G1)
    this.nodeMap = generateNodeMap(this.rng.fork(), config);
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
    this.empowersUsedThisTurn = 0;
    // H4 — the run-wide player pool starts full; the per-encounter state
    // (enemyHealth/turnIndex/encounterBudget) is set when an encounter
    // actually begins (`beginEncounter`).
    this.playerHealth = HEALTH.playerHealthMax;
    this.enemyHealth = 0;
    this.turnIndex = 0;
    this.encounterBudget = 0;
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
    this.daemon =
      config?.daemon !== undefined ? config.daemon : rollDaemon(DAEMONS, this.daemonRng);
    this.turnGates = disabledTurnGates();
    this.forcedLayoutId = resolveForcedLayoutId(config?.forcedLayoutId);
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
      this.bus.on('battle:ended', ({ winner, xpAwards, survivorPower }) =>
        this.handleTurnEnded(winner, xpAwards, survivorPower),
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
      case 'advanceTurn':
        this.handleAdvanceTurn();
        break;
      case 'redrawCards':
        this.handleRedrawCards(command.handIndices);
        break;
      case 'empowerUnit':
        this.handleEmpowerUnit(command.handIndex);
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
    this.enemyHealth = HEALTH.enemyHealthMax;
    this.turnIndex = 0;
    // Budget computed once; the wave composition re-rolls per turn against it.
    this.encounterBudget = enemyBudgetFor(this.team);
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
    // K3.5 — roll the encounter's ONE battlefield (pre-K3.5 these rolls lived
    // in `beginTurn`, re-rolled per turn). A dedicated fork keeps the map draw
    // self-contained, mirroring the per-turn `battleRng` pattern. The roll
    // order + the always-roll-then-override branches are preserved from the
    // old `beginTurn` block (gotcha #49's byte-continuity discipline: every
    // branch consumes the same draws).
    this.encounterMap = this.rollEncounterMap(this.rng.fork());
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
    this.startNextTurn();
  }

  /**
   * K3.5 — one encounter-map roll. The draws (terrain seed → layout id →
   * procedural side → theme) ALWAYS all run so the stream advances identically
   * on every branch (gotcha #49), then a forced layout (G1) overrides the
   * rolled id, hand-authored layouts pin their own dimensions + theme.
   */
  private rollEncounterMap(mapRng: RNG): EncounterMap {
    const terrainSeed = Math.floor(mapRng.next() * 0x1_0000_0000);
    const rolledLayoutId = rollLayoutId(mapRng);
    // forcedLayoutId: null = use the roll; FORCE_PROCEDURAL sentinel = force a
    // procedural map (layoutId null); any other string = that named layout.
    const layoutId =
      this.forcedLayoutId === null
        ? rolledLayoutId
        : this.forcedLayoutId === FORCE_PROCEDURAL
          ? null
          : this.forcedLayoutId;
    const proceduralSide = rollProceduralSide(mapRng);
    const { gridW, gridH } = layoutId === null
      ? { gridW: proceduralSide, gridH: proceduralSide }
      : layoutDimensions(layoutId);
    const proceduralTheme = rollTheme(mapRng);
    const theme = layoutId === null
      ? proceduralTheme
      : (getLayout(layoutId)?.theme ?? proceduralTheme);
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
    // emit below so its payload reads full availability. K4's empower budget
    // resets on the same schedule.
    this.redrawsUsedThisTurn = 0;
    this.cardsRedrawnThisTurn = 0;
    this.empowersUsedThisTurn = 0;
    // L1 — resolve this turn's daemon gates. A chance gate (Mercury) flips its
    // coin off the isolated `daemonRng` exactly HERE, once per turn, on both
    // the gated + headless paths (path-independent draw count).
    this.turnGates = resolveTurnGates(this.daemon, this.daemonRng);
    // K1 — `turnStart` fires before the turn's battle is built (on both the
    // gated + headless paths), so a daemon's encounter effect added here is
    // seeded onto this turn's hand in `beginTurn`. No-op at the default.
    this.fireTrigger('turnStart', { turn: this.turnIndex + 1, hop: this.currentHop });
    if (this.pauseAtTurnGates) {
      this.phase = 'turn-intro';
      // K3.5 — `startNextTurn` only runs mid-encounter, so the map is set.
      const { layoutId, gridW, gridH, theme } = this.encounterMap!;
      this.bus.emit('turn:starting', {
        turn: this.turnIndex + 1,
        hop: this.currentHop,
        playerHealth: this.playerHealth,
        playerHealthMax: HEALTH.playerHealthMax,
        enemyHealth: this.enemyHealth,
        enemyHealthMax: HEALTH.enemyHealthMax,
        hand: this.hand.map((idx) => this.team[idx]!),
        // R2 — the other two piles for the pre-turn pile views (recruitment
        // order; see resolvePileForDisplay).
        drawPile: this.resolvePileForDisplay(this.drawPile),
        discardPile: this.resolvePileForDisplay(this.discardPile),
        redraw: this.redrawAvailability,
        empower: this.empowerAvailability,
        empowerMagnitudes: this.empowerMagnitudes(),
        daemon: this.daemon
          ? {
              id: this.daemon.id,
              name: this.daemon.name,
              description: this.daemon.description,
              redrawGate: this.daemon.redraw !== undefined,
              empowerGate: this.daemon.empower !== undefined,
              empowerBuff: this.daemon.empower?.buff.mods ?? null,
            }
          : null,
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
    // H4 — fresh enemy composition each turn at the encounter's FIXED budget
    // (G4's `buildEnemyTeam` split into budget + wave). Last consumer of
    // `battleRng`, so its now-variable draw count stays downstream-safe.
    const enemyTeam = rollEnemyWave(battleRng, this.team, this.encounterBudget);

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
        enemyHealthMax: HEALTH.enemyHealthMax,
      });
    } else if (this.pendingPromotions) {
      // M1 headless — the promotion pause interposes between the resolved
      // turn and the loop continuing (the gated path does the same from
      // `handleAdvanceTurn`). The harness/test loop dismisses and re-enters.
      this.phase = 'promotion';
      this.bus.emit('promotion:pending', { promotions: this.pendingPromotions });
    } else {
      this.continueAfterTurn(result);
    }
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
      const enemyFrac = this.enemyHealth / HEALTH.enemyHealthMax;
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
      if (this.pendingPromotions) {
        // M1 — surface the turn's level-ups (banked in `handleTurnEnded`)
        // before the loop continues; `handleDismissPromotion` resumes it.
        // AFTER the outcome screen, so the result is read first.
        this.phase = 'promotion';
        this.bus.emit('promotion:pending', { promotions: this.pendingPromotions });
      } else {
        this.continueAfterTurn(this.turnResult());
      }
    }
  }

  /**
   * K3 — this turn's remaining redraw budget (actions + cards), the shape the
   * pre-turn screen renders. L1: reads this turn's daemon-resolved gate —
   * 0/0 when the active daemon grants no redraw this turn.
   */
  get redrawAvailability(): RedrawAvailability {
    return redrawAvailability(
      { redrawsUsed: this.redrawsUsedThisTurn, cardsRedrawn: this.cardsRedrawnThisTurn },
      this.turnGates.redraw,
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
      this.turnGates.redraw,
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
   * renders. L1: reads this turn's daemon-resolved gate — 0 when the active
   * daemon grants no empower this turn.
   */
  get empowerAvailability(): EmpowerAvailability {
    return empowerAvailability({ empowersUsed: this.empowersUsedThisTurn }, this.turnGates.empower);
  }

  /**
   * K4 — the per-hand-position empower stack column (parallel to `hand`,
   * 0 = unbuffed): each card's accumulated empower-buff magnitude on its
   * roster slot's encounter store. Derived (never stored) so it stays correct
   * across redraws and re-draws of an earlier turn's empowered card. L1: the
   * buff key comes from the DAEMON's configured empower gate (not the
   * resolved turn gate, so a chance-denied turn still badges existing
   * stacks); no empower daemon → no key → all zeros.
   */
  private empowerMagnitudes(): number[] {
    const buffKey = this.daemon?.empower?.buff.key;
    return this.hand.map((idx) => {
      const effect = this.encounterEffects[idx]?.find((e) => e.key === buffKey);
      return effect?.magnitude ?? 0;
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
   * resolved `turnGates.empower.buff`) in the K1 encounter-effect store, so
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
  private handleEmpowerUnit(handIndex: number): void {
    if (this.phase !== 'turn-intro') return;
    const rejection = empowerRejection(
      handIndex,
      this.hand.length,
      { empowersUsed: this.empowersUsedThisTurn },
      this.turnGates.empower,
    );
    if (rejection !== null) return;
    this.addEncounterEffect(this.hand[handIndex]!, empowerEffect(this.turnGates.empower));
    this.empowersUsedThisTurn += 1;
    this.bus.emit('turn:unitEmpowered', {
      handIndex,
      empower: this.empowerAvailability,
      empowerMagnitudes: this.empowerMagnitudes(),
    });
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
    // K3.5 — the battlefield is encounter-scoped; drop it with the encounter.
    this.encounterMap = null;
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
      this.phase = 'complete';
      this.bus.emit('run:victory', {});
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
      // L1 — stored by reference (the `nodeMap`/`encounterMap` convention):
      // neither the daemon nor a resolved gate is ever mutated in place
      // (`turnGates` is reassigned whole each turn; `empowerEffect` deep-copies
      // the buff mods at apply time).
      daemon: this.daemon,
      turnGates: this.turnGates,
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
      empowersUsedThisTurn: this.empowersUsedThisTurn,
      playerHealth: this.playerHealth,
      enemyHealth: this.enemyHealth,
      turnIndex: this.turnIndex,
      encounterBudget: this.encounterBudget,
      encounterMap: this.encounterMap,
      currentNodeId: this.currentNodeId,
      phase: this.phase,
      currentEncounter: this.currentEncounter,
      currentOffer: this.currentOffer ? this.currentOffer.slice() : null,
      visitedNodes: Array.from(this.visitedNodes),
      pendingPromotions: this.pendingPromotions
        ? this.pendingPromotions.slice()
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
      runTriggers: TriggerDispatcher<RunTriggerContextMap, Run>;
      turnGates: TurnGates;
    };
    const m = run as unknown as Mut;
    m.bus = bus;
    m.subscriptions = [];
    // RunConfig isn't persisted; a restored run uses normal procedural rolls.
    m.forcedLayoutId = null;
    m.rng = RNG.fromJSON(snap.rng);
    m.levelupRng = RNG.fromJSON(snap.levelupRng);
    m.deckRng = RNG.fromJSON(snap.deckRng);
    m.daemonRng = RNG.fromJSON(snap.daemonRng);
    // L1 — restore the daemon + the CURRENT turn's resolved gates as-is (a
    // save at the pre-turn gate keeps its Mercury flip — never re-rolled).
    m.daemon = snap.daemon;
    m.turnGates = snap.turnGates;
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
    m.empowersUsedThisTurn = snap.empowersUsedThisTurn;
    m.playerHealth = snap.playerHealth;
    m.enemyHealth = snap.enemyHealth;
    m.turnIndex = snap.turnIndex;
    m.encounterBudget = snap.encounterBudget;
    m.encounterMap = snap.encounterMap;
    m.currentNodeId = snap.currentNodeId;
    m.phase = snap.phase;
    m.currentEncounter = snap.currentEncounter;
    m.currentOffer = snap.currentOffer ? snap.currentOffer.slice() : null;
    m.visitedNodes = new Set(snap.visitedNodes);
    m.pendingPromotions = snap.pendingPromotions
      ? snap.pendingPromotions.slice()
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
 * 25% procedural (`null`) / 75% hand-authored layout, chosen uniformly
 * across `LAYOUT_IDS`. Tilted away from procedural at the C1d follow-up
 * since the layout library is now big enough to carry the bulk of
 * encounters — procedural stays in the mix as a "wildcard" variant.
 * Weighting by hop depth or recent picks is a future tuning lever.
 *
 * The `rng.next()` call always runs, so the parent stream advances
 * identically whether we return null or a layout — changing the
 * threshold doesn't shift downstream draws (enemy team, etc.) for
 * existing seeds.
 */
function rollLayoutId(rng: RNG): string | null {
  if (rng.next() < 0.25) return null;
  return rng.pick(LAYOUT_IDS);
}

/**
 * D3: pick the procedural arena's side length, uniformly in
 * `[TERRAIN.proceduralMinSize, TERRAIN.proceduralMaxSize]`. Always
 * consumes one RNG step — including on layout encounters that ignore
 * the result — so the stream advances identically regardless of
 * branch. That mirrors the invariant `rollLayoutId` already maintains
 * for the layoutId roll.
 */
function rollProceduralSide(rng: RNG): number {
  return rng.int(TERRAIN.proceduralMinSize, TERRAIN.proceduralMaxSize);
}

/**
 * D8: pick a visual theme for the procedural side of the encounter. Uniform
 * across `THEMES`. ALWAYS consumes one RNG step — even on hand-authored
 * encounters where the rolled value is discarded for `layout.theme` —
 * so the stream advances identically regardless of branch. Same invariant
 * the layout + size rolls already maintain (gotcha #49).
 *
 * Multi-map runs (C6) will eventually push theme up a level (the node
 * map carries a theme; procedural encounters inherit it). At that point
 * this function moves out of `Run.handleEnterNode` into nodeMap
 * construction; the byte-continuity dance can simplify too. For now,
 * theme rolls per battle.
 */
function rollTheme(rng: RNG): Theme {
  return rng.pick(THEMES);
}

function layoutDimensions(layoutId: string): { gridW: number; gridH: number } {
  const layout = getLayout(layoutId);
  if (!layout) {
    throw new Error(`Run.handleEnterNode: unknown layoutId="${layoutId}"`);
  }
  return { gridW: layout.gridW, gridH: layout.gridH };
}
