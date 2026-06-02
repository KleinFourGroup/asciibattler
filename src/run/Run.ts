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
import type { UnitTemplate, Team } from '../sim/Unit';
import { rollUnit } from '../sim/archetypes';
import { generate as generateNodeMap, type NodeMap, type NodeKind } from './NodeMap';
import type { RunConfig } from './RunConfig';
import { rollOffer } from './Recruitment';
import { buildEnemyTeam } from './enemyBudget';
import type { RunCommand } from './Command';
import { RECRUITMENT } from '../config/recruitment';
import { TERRAIN } from '../config/terrain';
import { LAYOUT_IDS, THEMES, getLayout, type Theme } from '../sim/layouts';
import { LEVELING } from '../config/leveling';
import { xpToNext } from '../sim/xp';
import { simulateLevelUps } from '../sim/leveling';
import { growthRatesForArchetype } from '../sim/archetypes';
import type { Archetype } from '../sim/archetypes';

export type RunPhase = 'map' | 'battle' | 'promotion' | 'recruit' | 'defeat' | 'complete';

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
 *  per-unit deltas to render. v4 + earlier throw on load. */
const RUN_SCHEMA_VERSION = 5;

export interface RunSnapshot {
  schemaVersion: typeof RUN_SCHEMA_VERSION;
  rng: RNGSnapshot;
  /** E4: separate stream for level-up stat rolls, forked from `rng` at
   *  Run construction. Lives independently so adding/removing a level-up
   *  source doesn't shift other run-RNG draws. */
  levelupRng: RNGSnapshot;
  nodeMap: NodeMap;
  team: UnitTemplate[];
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
const { startingMelee: STARTING_MELEE, startingRanged: STARTING_RANGED } = RECRUITMENT;

export class Run {
  readonly rng: RNG;
  /** E4: dedicated stream for level-up stat rolls. Forked once at
   *  construction so `simulateLevelUps` draws here, not against the
   *  parent stream that drives nodeMap + battle picks. */
  readonly levelupRng: RNG;
  readonly nodeMap: NodeMap;
  team: UnitTemplate[];
  currentNodeId: number;
  phase: RunPhase = 'map';
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
    this.levelupRng = this.rng.fork();
    this.forcedLayoutId = resolveForcedLayoutId(config?.forcedLayoutId);
    this.currentNodeId = this.nodeMap.rootId;
    this.visitedNodes = new Set<number>();
    this.subscribe();
    bus.emit('run:started', { seed });
  }

  private subscribe(): void {
    this.subscriptions.push(
      this.bus.on('battle:ended', ({ winner, xpAwards }) =>
        this.handleBattleEnded(winner, xpAwards),
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
      case 'dismissPromotion':
        this.handleDismissPromotion();
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

    const battleRng = this.rng.fork();
    const worldSeed = Math.floor(battleRng.next() * 0x1_0000_0000);
    const terrainSeed = Math.floor(battleRng.next() * 0x1_0000_0000);
    // G1: always roll (advance the stream — gotcha #49 byte-continuity), then
    // let a forced layout override the result. So `forcedLayoutId` doesn't
    // shift any downstream draw (enemy team, etc.) relative to a normal run.
    const rolledLayoutId = rollLayoutId(battleRng);
    const layoutId = this.forcedLayoutId ?? rolledLayoutId;
    // D3: procedural draws ALWAYS run so the RNG stream advances
    // identically regardless of branch (same invariant as the layoutId
    // roll above — keeps enemy-team byte continuity across seeds when
    // the procedural-size band is later retuned).
    const proceduralSide = rollProceduralSide(battleRng);
    const { gridW, gridH } = layoutId === null
      ? { gridW: proceduralSide, gridH: proceduralSide }
      : layoutDimensions(layoutId);
    // D8 — the theme roll always runs (byte-continuity invariant, gotcha
    // #49). For hand-authored layouts the discrete `layout.theme` wins
    // and the rolled value is discarded; for procedural encounters the
    // rolled value is what gets used. C6's multi-map runs will eventually
    // replace this with a per-map theme that procedural inherits from.
    const proceduralTheme = rollTheme(battleRng);
    const theme = layoutId === null
      ? proceduralTheme
      : (getLayout(layoutId)?.theme ?? proceduralTheme);
    // G4 — enemy team is a level-budget swarm derived from the player roster
    // (replaces the old floor-linear `rollEnemyTeam`). Last consumer of
    // `battleRng`, so its now-variable draw count stays downstream-safe.
    const enemyTeam = buildEnemyTeam(battleRng, this.team);

    // Browser-only diagnostic: confirm the layout picker hits the full
    // library across a session. Gated on `typeof window` so the fuzz
    // harness (tsx, no Vite) and vitest (node environment) don't spam.
    if (typeof window !== 'undefined') {
      console.log('[layout]', layoutId ?? 'procedural', `${gridW}x${gridH}`);
    }

    // E4: stamp each player template with its `Run.team` index so
    // `xpAwards` can carry it back at battle end. The roster itself
    // doesn't store rosterIndex — array position IS the index — so
    // the stamp is applied here at handoff time, never on
    // `this.team`. Enemy templates leave rosterIndex undefined.
    const stampedPlayerTeam = this.team.map((t, i) => ({ ...t, rosterIndex: i }));
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

  private handleBattleEnded(
    winner: Team,
    xpAwards: GameEvents['battle:ended']['xpAwards'],
  ): void {
    if (this.phase !== 'battle') return;
    this.currentEncounter = null;
    if (winner === 'player') {
      // E4 — bank XP into the roster BEFORE rolling the next step
      // so post-victory screens (promotion / recruit) already reflect
      // updated levels + stats. Level-up stat rolls advance
      // `levelupRng`; the recruit offer's RNG fork is independent.
      const promotions = this.bankXpAwards(xpAwards);
      if (promotions.length > 0) {
        // Pause on PromotionScene; the post-promotion step (recruit
        // offer or run:victory) runs from `handleDismissPromotion`.
        this.phase = 'promotion';
        this.pendingPromotions = promotions;
        this.bus.emit('promotion:pending', { promotions });
      } else {
        this.advancePastBattle();
      }
    } else {
      this.phase = 'defeat';
      this.bus.emit('run:defeated', {});
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
      this.currentOffer = rollOffer(this.rng.fork(), undefined, this.currentFloor);
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
    this.currentOffer = null;
    this.phase = 'map';
  }

  private isFrontier(nodeId: number): boolean {
    for (const e of this.nodeMap.edges) {
      if (e.from === this.currentNodeId && e.to === nodeId) return true;
    }
    return false;
  }

  toJSON(): RunSnapshot {
    return {
      schemaVersion: RUN_SCHEMA_VERSION,
      rng: this.rng.toJSON(),
      levelupRng: this.levelupRng.toJSON(),
      nodeMap: this.nodeMap,
      team: this.team.slice(),
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
    m.nodeMap = snap.nodeMap;
    m.team = snap.team.slice();
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
 * Player starting team: fixed 3 melee + 2 ranged. Doesn't change with run
 * progress — recruits grow the team via Run.handleChooseRecruit.
 */
function rollTeam(rng: RNG): UnitTemplate[] {
  const team: UnitTemplate[] = [];
  for (let i = 0; i < STARTING_MELEE; i++) team.push(rollUnit('melee', rng));
  for (let i = 0; i < STARTING_RANGED; i++) team.push(rollUnit('ranged', rng));
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
