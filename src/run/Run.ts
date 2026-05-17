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

  constructor(seed: number, bus: EventBus<GameEvents>) {
    this.bus = bus;
    this.rng = new RNG(seed);
    this.nodeMap = generateNodeMap(this.rng.fork());
    this.team = rollTeam(this.rng.fork());
    this.currentNodeId = this.nodeMap.rootId;

    bus.on('run:nodeEntered', ({ nodeId }) => this.handleNodeEntered(nodeId));
    bus.on('battle:ended', ({ winner }) => this.handleBattleEnded(winner));
    bus.on('recruit:chosen', ({ unitTemplate }) => this.handleRecruitChosen(unitTemplate));

    bus.emit('run:started', { seed });
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
    const enemyTeam = rollTeam(battleRng);

    this.currentEncounter = {
      worldSeed,
      playerTeam: this.team.slice(),
      enemyTeam,
    };
    this.bus.emit('battle:started', { worldSeed });
  }

  private handleBattleEnded(winner: Team): void {
    if (this.phase !== 'battle') return;
    this.currentEncounter = null;
    if (winner === 'player') {
      this.phase = 'recruit';
      this.currentOffer = rollOffer(this.rng.fork());
      this.bus.emit('recruit:offered', { units: this.currentOffer });
    } else {
      // 4.5 will wire reset-to-fresh-run here.
      this.phase = 'defeat';
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
 * Starting / enemy team composition: a fixed 3-melee + 2-ranged formation.
 * Comparable strength for player vs. enemy is enforced by both teams rolling
 * from this shared template — only stat rolls vary. Post-MVP recruitment
 * will let teams diverge in size and composition.
 */
function rollTeam(rng: RNG): UnitTemplate[] {
  const team: UnitTemplate[] = [];
  for (let i = 0; i < STARTING_MELEE; i++) team.push(rollUnit('melee', rng));
  for (let i = 0; i < STARTING_RANGED; i++) team.push(rollUnit('ranged', rng));
  return team;
}
