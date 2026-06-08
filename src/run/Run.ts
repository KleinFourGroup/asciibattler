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
import { generate as generateNodeMap, type NodeMap, type NodeKind } from './NodeMap';
import type { RunConfig } from './RunConfig';
import { rollOffer, recruitLevelBonus } from './Recruitment';
import { enemyBudgetFor, rollEnemyWave, avgTeamLevel } from './enemyBudget';
import { fatigueFactor } from './fatigue';
import type { RunCommand } from './Command';
import { RECRUITMENT } from '../config/recruitment';
import { TERRAIN } from '../config/terrain';
import { HEALTH } from '../config/health';
import { DECK } from '../config/deck';
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

/** H4: one `battle:ended` XP award entry. Accumulated across an encounter's
 *  turns in `Run.pendingEncounterXp`, then banked once at encounter end. */
type XpAward = GameEvents['battle:ended']['xpAwards'][number];

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
 *  contract as the World v19 bump). */
const RUN_SCHEMA_VERSION = 10;

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
  nodeMap: NodeMap;
  team: UnitTemplate[];
  /** H3: per-roster-slot deployment counter, parallel to `team`. */
  deploymentCounts: number[];
  /** H5: the encounter-scoped card deck — `rosterIndex` values in three piles.
   *  `drawPile` is the shuffled draw stack (drawn from the end), `discardPile`
   *  collects fought hands, `hand` is the current turn's drawn cards. Rebuilt
   *  from the roster at each encounter start. */
  drawPile: number[];
  discardPile: number[];
  hand: number[];
  /** H4: the run-wide player health pool (persists across the whole run). */
  playerHealth: number;
  /** H4: the active encounter's enemy pool (reset each encounter). */
  enemyHealth: number;
  /** H4: turns elapsed in the active encounter (drives the max-turns cap). */
  turnIndex: number;
  /** H4: the active encounter's fixed enemy level budget (computed once at
   *  encounter start; the wave composition re-rolls per turn against it). */
  encounterBudget: number;
  /** H4: XP awards accrued across the active encounter's turns, banked once at
   *  encounter end. Non-empty only mid-encounter. */
  pendingEncounterXp: XpAward[];
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
   * H4 — XP awards accrued across the active encounter's turns (each turn's
   * `battle:ended.xpAwards` appended in order). Banked ONCE at encounter end
   * via `bankXpAwards`, so a single `PromotionScene` pops per encounter, never
   * per turn. Order is preserved so the `levelupRng` draw order is identical
   * with or without a mid-encounter save. Cleared at encounter start + after
   * banking; discarded (unbanked) on defeat.
   */
  pendingEncounterXp: XpAward[];
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
   * E4 — level-ups awaiting PromotionScene dismissal. Set inside
   * `handleBattleEnded` when `bankXpAwards` reports promotions;
   * cleared when `handleDismissPromotion` rolls the next step
   * (recruit offer or run:victory).
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
   * hand-authored layout instead of `rollLayoutId`. Null = normal procedural
   * roll. Not persisted (RunConfig is a run input, reconstructable from seed);
   * a rehydrated Run resets this to null.
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
    // H5 — the deck is empty until an encounter builds + shuffles it
    // (`beginEncounter`); piles round-trip but mean nothing between encounters.
    this.drawPile = [];
    this.discardPile = [];
    this.hand = [];
    // H4 — the run-wide player pool starts full; the per-encounter state
    // (enemyHealth/turnIndex/encounterBudget/pendingEncounterXp) is set when an
    // encounter actually begins (`beginEncounter`).
    this.playerHealth = HEALTH.playerHealthMax;
    this.enemyHealth = 0;
    this.turnIndex = 0;
    this.encounterBudget = 0;
    this.pendingEncounterXp = [];
    this.levelupRng = this.rng.fork();
    // H5 — fork the deck stream LAST (after levelup), consistent with the
    // append-at-the-end fork convention. This extra construction fork shifts
    // every subsequent `this.rng.fork()` (per-turn waves, recruit offers), so
    // H5 re-baselines the fuzz output — acceptable, since the seam swap + the
    // drawn-hand subset already change battle outcomes wholesale.
    this.deckRng = this.rng.fork();
    this.forcedLayoutId = resolveForcedLayoutId(config?.forcedLayoutId);
    this.currentNodeId = this.nodeMap.rootId;
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

    // The departing node counts as cleared — except the very first hop,
    // where we're leaving the root and root isn't a battle node.
    if (this.currentNodeId !== this.nodeMap.rootId) {
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
   * state (enemy pool full, turn counter zero, no pending XP), fixes the enemy
   * level budget for the whole encounter, zeroes the H3 deployment counts, then
   * kicks off the first turn. The run-wide `playerHealth` is deliberately NOT
   * reset — it persists across encounters.
   */
  private beginEncounter(): void {
    this.enemyHealth = HEALTH.enemyHealthMax;
    this.turnIndex = 0;
    this.pendingEncounterXp = [];
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
    this.startNextTurn();
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
    if (this.pauseAtTurnGates) {
      this.phase = 'turn-intro';
      this.bus.emit('turn:starting', {
        turn: this.turnIndex + 1,
        floor: this.currentFloor,
        playerHealth: this.playerHealth,
        playerHealthMax: HEALTH.playerHealthMax,
        enemyHealth: this.enemyHealth,
        enemyHealthMax: HEALTH.enemyHealthMax,
        hand: this.hand.map((idx) => this.team[idx]!),
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
    const terrainSeed = Math.floor(battleRng.next() * 0x1_0000_0000);
    // G1: always roll (advance the stream — gotcha #49 byte-continuity), then
    // let a forced layout override the result.
    const rolledLayoutId = rollLayoutId(battleRng);
    const layoutId = this.forcedLayoutId ?? rolledLayoutId;
    // D3: procedural draws ALWAYS run so the RNG stream advances identically
    // regardless of branch (same invariant as the layoutId roll above).
    const proceduralSide = rollProceduralSide(battleRng);
    const { gridW, gridH } = layoutId === null
      ? { gridW: proceduralSide, gridH: proceduralSide }
      : layoutDimensions(layoutId);
    // D8 — the theme roll always runs (byte-continuity invariant, gotcha #49);
    // hand-authored layouts use `layout.theme`, procedural the rolled value.
    const proceduralTheme = rollTheme(battleRng);
    const theme = layoutId === null
      ? proceduralTheme
      : (getLayout(layoutId)?.theme ?? proceduralTheme);
    // H4 — fresh enemy composition each turn at the encounter's FIXED budget
    // (G4's `buildEnemyTeam` split into budget + wave). Last consumer of
    // `battleRng`, so its now-variable draw count stays downstream-safe.
    const enemyTeam = rollEnemyWave(battleRng, this.team, this.encounterBudget);

    // Browser-only diagnostic: confirm the layout picker hits the full library
    // across a session. Gated on `typeof window` so the fuzz harness + vitest
    // don't spam.
    if (typeof window !== 'undefined') {
      console.log(
        '[layout]',
        layoutId ?? 'procedural',
        `${gridW}x${gridH}`,
        `turn ${this.turnIndex + 1}`,
      );
    }

    // E4/H5 — the hand was drawn in `startNextTurn` (`drawTurnHand`) so the
    // pre-turn screen could show it; here we just field it. Stamp each drawn
    // card with its `Run.team` index so `xpAwards` can carry it back at battle
    // end (the stamp is applied at handoff time, never on `this.team`).
    //
    // H6c — spawn-time fatigue: a unit fielded with `deploymentCounts[idx]`
    // PRIOR deployments this encounter (read here, BEFORE the recordDeployment
    // bump below, so a debut unit reads 0 stacks) is baked with a fatigue
    // factor on its `power`. INERT at the shipped knob (factor 1.0). A fresh
    // `stats` object so `this.team` keeps its canonical, un-fatigued values.
    const stampedPlayerTeam = this.hand.map((idx) => {
      const t = this.team[idx]!;
      const factor = fatigueFactor(this.deploymentCounts[idx]!);
      return {
        ...t,
        rosterIndex: idx,
        stats: { ...t.stats, power: Math.round(t.stats.power * factor) },
      };
    });
    // H3 — record this turn's deployment (the drawn hand). The deployment
    // counter finally varies per turn here (pre-H5 it was the whole roster).
    this.recordDeployment(this.hand);
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
   * Floor index of the current node. Public so UI surfaces (HUD) can label
   * the active battle's depth without duplicating the node-lookup logic.
   */
  get currentFloor(): number {
    return this.floorOf(this.currentNodeId);
  }

  private floorOf(nodeId: number): number {
    const node = this.nodeMap.nodes.find((n) => n.id === nodeId);
    if (!node) throw new Error(`Run.floorOf: no node ${nodeId} in map`);
    return node.floor;
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
    this.resolveTurn(sp, xpAwards);
    const result = this.turnResult();
    if (this.pauseAtTurnGates) {
      // Pause on the post-turn outcome screen; the player's `advanceTurn`
      // resumes into `continueAfterTurn`.
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
    } else {
      this.continueAfterTurn(result);
    }
  }

  /**
   * H4 — fold one turn's outcome into the pools. Each side's survivors chip the
   * OPPOSING pool by their Σ`power` (× `chipMultiplier`); the per-turn winner is
   * irrelevant to the chip (a draw chips both; a decisive win chips one because
   * the loser's survivor power is 0). XP accrues for banking at encounter end.
   * Decision + continuation are split out (`turnResult`/`continueAfterTurn`) so
   * H4b's post-turn screen can show the result before the loop acts on it.
   */
  private resolveTurn(
    survivorPower: { player: number; enemy: number },
    xpAwards: GameEvents['battle:ended']['xpAwards'],
  ): void {
    // Unconditional, at the top: even a 0/0 mutual-wipe turn must advance the
    // counter so the max-turns safety cap can terminate the encounter.
    this.turnIndex += 1;
    const chip = HEALTH.chipMultiplier;
    this.enemyHealth = Math.max(0, this.enemyHealth - survivorPower.player * chip);
    this.playerHealth = Math.max(0, this.playerHealth - survivorPower.enemy * chip);
    this.pendingEncounterXp.push(...xpAwards);
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
      this.continueAfterTurn(this.turnResult());
    }
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
    if (outcome === 'defeat') {
      this.pendingEncounterXp = [];
      this.phase = 'defeat';
      this.bus.emit('run:defeated', {});
      return;
    }
    const promotions = this.bankXpAwards(this.pendingEncounterXp);
    this.pendingEncounterXp = [];
    if (promotions.length > 0) {
      // Pause on PromotionScene; the post-promotion step (recruit offer or
      // run:victory) runs from `handleDismissPromotion`.
      this.phase = 'promotion';
      this.pendingPromotions = promotions;
      this.bus.emit('promotion:pending', { promotions });
    } else {
      this.advancePastBattle();
    }
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
      // the floor, so a fresh draft stays useful on a leveled roster. Post-G5:
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
    // G3 — a promotion can come from a battle/boss win OR a rest node. The
    // current node's kind is the discriminator (no extra persisted state): a
    // rest returns to the map (no recruit), a battle/boss takes the normal
    // post-battle path (recruit or, at the terminal, run:victory).
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
   * H5 — draw up to `DECK.handSize` cards from the deck. Pulls from the end of
   * `drawPile`; when it empties mid-draw, the `discardPile` is shuffled back in
   * and drawing continues. Stops early only when BOTH piles are exhausted (a
   * roster smaller than `handSize` simply fields everyone). Returns the drawn
   * `rosterIndex` values; the caller seats them in `this.hand`.
   */
  private drawHand(): number[] {
    const hand: number[] = [];
    while (hand.length < DECK.handSize) {
      if (this.drawPile.length === 0) {
        if (this.discardPile.length === 0) break; // deck fully dealt this turn
        // Reshuffle the discard back into the draw pile (the only RNG draw in
        // the deck cycle, off the isolated `deckRng`).
        this.drawPile = this.discardPile;
        this.discardPile = [];
        shuffleInPlace(this.drawPile, this.deckRng);
      }
      hand.push(this.drawPile.pop()!);
    }
    return hand;
  }

  toJSON(): RunSnapshot {
    return {
      schemaVersion: RUN_SCHEMA_VERSION,
      rng: this.rng.toJSON(),
      levelupRng: this.levelupRng.toJSON(),
      deckRng: this.deckRng.toJSON(),
      nodeMap: this.nodeMap,
      team: this.team.slice(),
      deploymentCounts: this.deploymentCounts.slice(),
      drawPile: this.drawPile.slice(),
      discardPile: this.discardPile.slice(),
      hand: this.hand.slice(),
      playerHealth: this.playerHealth,
      enemyHealth: this.enemyHealth,
      turnIndex: this.turnIndex,
      encounterBudget: this.encounterBudget,
      pendingEncounterXp: this.pendingEncounterXp.slice(),
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
    };
    const m = run as unknown as Mut;
    m.bus = bus;
    m.subscriptions = [];
    // RunConfig isn't persisted; a restored run uses normal procedural rolls.
    m.forcedLayoutId = null;
    m.rng = RNG.fromJSON(snap.rng);
    m.levelupRng = RNG.fromJSON(snap.levelupRng);
    m.deckRng = RNG.fromJSON(snap.deckRng);
    m.nodeMap = snap.nodeMap;
    m.team = snap.team.slice();
    m.deploymentCounts = snap.deploymentCounts.slice();
    m.drawPile = snap.drawPile.slice();
    m.discardPile = snap.discardPile.slice();
    m.hand = snap.hand.slice();
    m.playerHealth = snap.playerHealth;
    m.enemyHealth = snap.enemyHealth;
    m.turnIndex = snap.turnIndex;
    m.encounterBudget = snap.encounterBudget;
    m.pendingEncounterXp = snap.pendingEncounterXp.slice();
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
  for (let i = 0; i < STARTING_MELEE; i++) team.push(rollUnit('melee', rng, STARTING_LEVEL));
  for (let i = 0; i < STARTING_RANGED; i++) team.push(rollUnit('ranged', rng, STARTING_LEVEL));
  return team;
}

/**
 * G1 — validate a `RunConfig.forcedLayoutId` against the layout library at
 * construction (loud throw, mirroring `layoutDimensions`), so a typo'd layout
 * fails fast at run start rather than silently per-battle. Undefined → null
 * (normal procedural rolls).
 */
function resolveForcedLayoutId(id: string | undefined): string | null {
  if (id === undefined) return null;
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
 * Weighting by floor depth or recent picks is a future tuning lever.
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
