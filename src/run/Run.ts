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
import type { GameEvents } from '../core/events';
import { RNG, type RNGSnapshot } from '../core/RNG';
import type { UnitTemplate, Team } from '../sim/Unit';
import { rollUnit } from '../sim/archetypes';
import { generate as generateNodeMap, type NodeMap } from './NodeMap';
import { rollOffer } from './Recruitment';
import type { RunCommand } from './Command';
import { RECRUITMENT } from '../config/recruitment';
import { DIFFICULTY } from '../config/difficulty';
import { LAYOUT_IDS } from '../sim/layouts';

export type RunPhase = 'map' | 'battle' | 'recruit' | 'defeat' | 'complete';

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
  readonly playerTeam: readonly UnitTemplate[];
  readonly enemyTeam: readonly UnitTemplate[];
}

const RUN_SCHEMA_VERSION = 1;

export interface RunSnapshot {
  schemaVersion: typeof RUN_SCHEMA_VERSION;
  rng: RNGSnapshot;
  nodeMap: NodeMap;
  team: UnitTemplate[];
  currentNodeId: number;
  phase: RunPhase;
  currentEncounter: BattleEncounter | null;
  currentOffer: UnitTemplate[] | null;
  visitedNodes: number[];
}

// Balance constants now live in config/*.json — see src/config/recruitment.ts
// and src/config/difficulty.ts. Bound to locals here just for readability at
// the call sites.
const { startingMelee: STARTING_MELEE, startingRanged: STARTING_RANGED } = RECRUITMENT;
const { enemySizeDelta: ENEMY_SIZE_DELTA, enemyHpPerFloor: ENEMY_HP_PER_FLOOR } = DIFFICULTY;

export class Run {
  readonly rng: RNG;
  readonly nodeMap: NodeMap;
  team: UnitTemplate[];
  currentNodeId: number;
  phase: RunPhase = 'map';
  currentEncounter: BattleEncounter | null = null;
  /** Recruit offer presented after victory, cleared on choice. */
  currentOffer: UnitTemplate[] | null = null;
  /**
   * Nodes the player has cleared (entered + survived). Used by MapScreen to
   * draw a visual trail of completed nodes. Root is never added — it's not
   * "completed" in the battle sense, it's just the starting point.
   */
  readonly visitedNodes: Set<number>;

  private readonly bus: EventBus<GameEvents>;
  private subscriptions: Array<() => void> = [];

  constructor(seed: number, bus: EventBus<GameEvents>) {
    this.bus = bus;
    this.rng = new RNG(seed);
    this.nodeMap = generateNodeMap(this.rng.fork());
    this.team = rollTeam(this.rng.fork());
    this.currentNodeId = this.nodeMap.rootId;
    this.visitedNodes = new Set<number>();
    this.subscribe();
    bus.emit('run:started', { seed });
  }

  private subscribe(): void {
    this.subscriptions.push(
      this.bus.on('battle:ended', ({ winner }) => this.handleBattleEnded(winner)),
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
    this.phase = 'battle';

    const battleRng = this.rng.fork();
    const worldSeed = Math.floor(battleRng.next() * 0x1_0000_0000);
    const terrainSeed = Math.floor(battleRng.next() * 0x1_0000_0000);
    const layoutId = rollLayoutId(battleRng);
    const enemyTeam = rollEnemyTeam(battleRng, this.team.length, this.floorOf(nodeId));

    // Browser-only diagnostic: confirm the layout picker hits the full
    // library across a session. Gated on `typeof window` so the fuzz
    // harness (tsx, no Vite) and vitest (node environment) don't spam.
    if (typeof window !== 'undefined') {
      console.log('[layout]', layoutId ?? 'procedural');
    }

    this.currentEncounter = {
      worldSeed,
      terrainSeed,
      layoutId,
      playerTeam: this.team.slice(),
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

  private handleBattleEnded(winner: Team): void {
    if (this.phase !== 'battle') return;
    this.currentEncounter = null;
    if (winner === 'player') {
      if (this.currentNodeId === this.nodeMap.terminalId) {
        // Winning the terminal battle ends the run — no recruit offer,
        // straight to the run-complete screen via run:victory.
        this.phase = 'complete';
        this.bus.emit('run:victory', {});
      } else {
        this.phase = 'recruit';
        this.currentOffer = rollOffer(this.rng.fork());
        this.bus.emit('recruit:offered', { units: this.currentOffer });
      }
    } else {
      this.phase = 'defeat';
      this.bus.emit('run:defeated', {});
    }
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
      nodeMap: this.nodeMap,
      team: this.team.slice(),
      currentNodeId: this.currentNodeId,
      phase: this.phase,
      currentEncounter: this.currentEncounter,
      currentOffer: this.currentOffer ? this.currentOffer.slice() : null,
      visitedNodes: Array.from(this.visitedNodes),
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
    };
    const m = run as unknown as Mut;
    m.bus = bus;
    m.subscriptions = [];
    m.rng = RNG.fromJSON(snap.rng);
    m.nodeMap = snap.nodeMap;
    m.team = snap.team.slice();
    m.currentNodeId = snap.currentNodeId;
    m.phase = snap.phase;
    m.currentEncounter = snap.currentEncounter;
    m.currentOffer = snap.currentOffer ? snap.currentOffer.slice() : null;
    m.visitedNodes = new Set(snap.visitedNodes);
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
 * Enemy team for a battle on `floor`, sized relative to the player. Composition
 * stays ~60% melee / 40% ranged via Math.round so the formation reads the same
 * at any team size. Per-floor HP multiplier toughens deeper enemies; size delta
 * keeps the player marginally ahead in unit count.
 */
function rollEnemyTeam(rng: RNG, playerSize: number, floor: number): UnitTemplate[] {
  const size = Math.max(1, playerSize + ENEMY_SIZE_DELTA);
  const meleeCount = Math.round(size * 0.6);
  const rangedCount = size - meleeCount;
  const hpMultiplier = 1 + ENEMY_HP_PER_FLOOR * floor;

  const team: UnitTemplate[] = [];
  for (let i = 0; i < meleeCount; i++) {
    team.push(scaleMaxHp(rollUnit('melee', rng), hpMultiplier));
  }
  for (let i = 0; i < rangedCount; i++) {
    team.push(scaleMaxHp(rollUnit('ranged', rng), hpMultiplier));
  }
  return team;
}

function scaleMaxHp(template: UnitTemplate, multiplier: number): UnitTemplate {
  return {
    archetype: template.archetype,
    stats: {
      ...template.stats,
      maxHp: Math.round(template.stats.maxHp * multiplier),
    },
  };
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
