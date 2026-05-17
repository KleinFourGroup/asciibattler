/**
 * Run-level state machine. Owns the meta state that survives across battles:
 * the seeded RNG, the generated NodeMap, the player roster, the current
 * position on the map, and which phase the run is in.
 *
 * Phases follow ROADMAP Step 4.3:
 *
 *   map ── run:nodeEntered (frontier) ──▶ battle
 *   battle ── battle:ended (player win) ──▶ map  (recruit phase comes in 4.4)
 *   battle ── battle:ended (enemy win) ──▶ defeat
 *
 * Run does NOT construct the World. Instead it builds an Encounter snapshot
 * (worldSeed + rolled teams) and fires `battle:started`; Game owns the World
 * lifecycle and reads `run.currentEncounter` to set up the next battle. This
 * keeps Run a pure meta-state object — matches ARCHITECTURE.md's "Game owns
 * the orchestration" principle and keeps the sim/meta split clean.
 *
 * The RNG hierarchy is the load-bearing determinism invariant: one run RNG,
 * forked once per major draw (nodeMap, starting team, each battle). The
 * forked battle stream is independent of the parent, so the run stream stays
 * byte-identical across replays of the same seed — see TESTING.md.
 */

import type { EventBus } from '../core/EventBus';
import type { GameEvents } from '../core/events';
import { RNG } from '../core/RNG';
import type { UnitTemplate, Team } from '../sim/Unit';
import { rollUnit } from '../sim/archetypes';
import { generate as generateNodeMap, type NodeMap } from './NodeMap';
import { rollOffer } from './Recruitment';

export type RunPhase = 'map' | 'battle' | 'recruit' | 'defeat';

export interface BattleEncounter {
  readonly worldSeed: number;
  readonly playerTeam: readonly UnitTemplate[];
  readonly enemyTeam: readonly UnitTemplate[];
}

const STARTING_MELEE = 3;
const STARTING_RANGED = 2;

/**
 * CHECKPOINT 6 difficulty tuning. Enemy team size lags the player by one
 * to give a slight per-battle edge that breaks the snowball: after each
 * recruit the player team grows but so does the enemy. Per-floor HP
 * multiplier compensates by making deeper enemies tougher.
 */
const ENEMY_SIZE_DELTA = -1;
const ENEMY_HP_PER_FLOOR = 0.05;

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
  readonly visitedNodes = new Set<number>();

  private readonly bus: EventBus<GameEvents>;
  private readonly subscriptions: Array<() => void> = [];

  constructor(seed: number, bus: EventBus<GameEvents>) {
    this.bus = bus;
    this.rng = new RNG(seed);
    this.nodeMap = generateNodeMap(this.rng.fork());
    this.team = rollTeam(this.rng.fork());
    this.currentNodeId = this.nodeMap.rootId;

    this.subscriptions.push(
      bus.on('run:nodeEntered', ({ nodeId }) => this.handleNodeEntered(nodeId)),
      bus.on('battle:ended', ({ winner }) => this.handleBattleEnded(winner)),
      bus.on('recruit:chosen', ({ unitTemplate }) => this.handleRecruitChosen(unitTemplate)),
    );

    bus.emit('run:started', { seed });
  }

  /**
   * Detach every bus subscription. Required when replacing a Run on reset
   * (Step 4.5) — otherwise the dead Run keeps responding to events and the
   * new one races against it.
   */
  dispose(): void {
    for (const unsub of this.subscriptions) unsub();
    this.subscriptions.length = 0;
  }

  /**
   * MapScreen → run. Validates the click is a legal frontier hop, builds the
   * battle encounter (deterministic from a forked RNG), and announces the
   * battle so Game can spin up a fresh World.
   */
  private handleNodeEntered(nodeId: number): void {
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
    const enemyTeam = rollEnemyTeam(battleRng, this.team.length, this.floorOf(nodeId));

    this.currentEncounter = {
      worldSeed,
      playerTeam: this.team.slice(),
      enemyTeam,
    };
    this.bus.emit('battle:started', { worldSeed });
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
      this.phase = 'recruit';
      this.currentOffer = rollOffer(this.rng.fork());
      this.bus.emit('recruit:offered', { units: this.currentOffer });
    } else {
      this.phase = 'defeat';
      this.bus.emit('run:defeated', {});
    }
  }

  private handleRecruitChosen(unitTemplate: UnitTemplate): void {
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
}

/**
 * Player starting team: fixed 3 melee + 2 ranged. Doesn't change with run
 * progress — recruits grow the team via Run.handleRecruitChosen.
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
