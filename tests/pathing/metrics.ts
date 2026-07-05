/**
 * §42b — the movement-metrics collector: the Pathfinding-Audit round's
 * measuring instrument. Subscribes to a battle's event bus and aggregates the
 * five v1 movement-quality metrics:
 *
 *   1. **Mean signed lateral drift** (per team) — net displacement orthogonal
 *      to the team's forward axis, averaged per unit. The River symptom,
 *      quantified: on a symmetric board a fair mover nets ≈ 0.
 *   2. **Corridor throughput** — committed moves crossing a caller-supplied
 *      gate, normalized per 100 ticks (fixture maps define the gate; shipped
 *      layouts usually run without one).
 *   3. **Oscillation rate** (per team) — backtracks (a move landing on a cell
 *      the unit occupied within the last `oscillationWindowMoves` moves)
 *      divided by moves. The crab-walk detector.
 *   4. **Time-to-first-contact** — the tick of the first attack attempt
 *      (`unit:attacked` / `unit:missed`).
 *   5. **Decision mix** (per team) — the `unit:moveDecision` histogram §42a
 *      made possible.
 *
 * Frames and signs: each team's `forward` is derived at attach time from the
 * initial team centroids (own → opposing), unless overridden. `lateral` is
 * forward rotated 90° CCW in grid coordinates — so POSITIVE drift means the
 * same body-relative side for BOTH teams, and a mirror-symmetric sim reads
 * ≈ 0 for each. World-frame net dx/dy are reported alongside for
 * interpretation against a specific map ("left on River" is a world-frame
 * claim).
 *
 * Position tracking follows COMMITTED moves (`unit:moved` fires at move
 * start; §36b's deferred flip timing is irrelevant to step geometry):
 *   - `unit:swapped` = two committed steps (one per participant);
 *   - `unit:dashed` / `unit:shoved` are IGNORED — both also emit `unit:moved`
 *     for the slide, which is the single source counted;
 *   - `unit:moveAborted` REVERTS the matching committed step (the §35b/§36c
 *     abort means the unit never left).
 *
 * The collector holds no RNG and touches no world state — a run measured
 * twice from the same seed produces identical metrics (pinned in tests).
 */

import type { EventBus } from '../../src/core/EventBus';
import type { GameEvents } from '../../src/core/events';
import type { GridCoord } from '../../src/core/types';
import type { World } from '../../src/sim/World';
import { MOVE_DECISION_KINDS, type MoveDecisionKind } from '../../src/sim/moveDecision';

export type MetricTeam = 'player' | 'enemy';

export interface MetricsConfig {
  /**
   * Per-team forward-axis override (unnormalized is fine). Omitted → derived
   * from the initial team centroids (own → opposing). Fixtures with a known
   * axis should pass it explicitly so an asymmetric roster can't skew the
   * frame.
   */
  forward?: Partial<Record<MetricTeam, { x: number; y: number }>>;
  /**
   * Backtrack window, in MOVES: a step landing on a cell this unit occupied
   * within its last N moves counts as an oscillation. Default 3 (catches
   * A→B→A and the A→B→C→A shuffle loop).
   */
  oscillationWindowMoves?: number;
  /** Throughput gate: return true when a committed `from→to` step crosses it. */
  gate?: (from: GridCoord, to: GridCoord) => boolean;
}

export interface TeamMovementMetrics {
  /** Units ever tracked for this team (initial + mid-battle spawns). */
  unitCount: number;
  /** Committed steps (swap = one step per participant; aborts reverted). */
  moves: number;
  /** Net lateral displacement per unit, averaged (unit-frame; + = 90° CCW of forward). */
  meanNetLateralDrift: number;
  /** World-frame net displacement per unit, averaged. */
  meanNetDx: number;
  meanNetDy: number;
  backtracks: number;
  /** backtracks / moves (0 when the team never moved). */
  oscillationRate: number;
  decisionMix: Record<MoveDecisionKind, number>;
}

export interface MovementMetrics {
  ticks: number;
  timeToFirstContactTicks: number | null;
  gateCrossings: number;
  /** gateCrossings normalized per 100 ticks; null without a gate or ticks. */
  throughputPer100Ticks: number | null;
  teams: Record<MetricTeam, TeamMovementMetrics>;
}

interface TrackedUnit {
  team: MetricTeam;
  /** Committed position (last committed destination). */
  position: GridCoord;
  /** Recently-vacated cells, most recent last: [cellKey, moveIndex]. */
  recentCells: [string, number][];
  moves: number;
  netDx: number;
  netDy: number;
  backtracks: number;
  /** The last committed step, for the abort revert. */
  lastStep: { from: GridCoord; to: GridCoord; wasBacktrack: boolean; crossedGate: boolean } | null;
}

function zeroDecisionMix(): Record<MoveDecisionKind, number> {
  return Object.fromEntries(MOVE_DECISION_KINDS.map((k) => [k, 0])) as Record<
    MoveDecisionKind,
    number
  >;
}

function key(c: GridCoord): string {
  return `${c.x},${c.y}`;
}

export class MovementMetricsCollector {
  private readonly units = new Map<number, TrackedUnit>();
  private readonly decisionMix: Record<MetricTeam, Record<MoveDecisionKind, number>> = {
    player: zeroDecisionMix(),
    enemy: zeroDecisionMix(),
  };
  private readonly lateral: Record<MetricTeam, { x: number; y: number }>;
  private readonly windowMoves: number;
  private readonly gate: ((from: GridCoord, to: GridCoord) => boolean) | undefined;

  private ticks = 0;
  private firstContactTick: number | null = null;
  private gateCrossings = 0;

  constructor(
    private readonly world: World,
    bus: EventBus<GameEvents>,
    config: MetricsConfig = {},
  ) {
    this.windowMoves = config.oscillationWindowMoves ?? 3;
    this.gate = config.gate;

    // Register the units already on the board and derive the team frames from
    // their starting centroids (before any motion).
    for (const u of this.world.units) this.register(u.id);
    const forward = {
      player: config.forward?.player ?? this.derivedForward('player'),
      enemy: config.forward?.enemy ?? this.derivedForward('enemy'),
    };
    this.lateral = {
      player: rotate90ccwUnit(forward.player),
      enemy: rotate90ccwUnit(forward.enemy),
    };

    bus.on('tick', (p) => {
      this.ticks = p.tick;
    });
    bus.on('unit:spawned', (p) => this.register(p.unitId));
    bus.on('unit:moved', (p) => this.recordStep(p.unitId, p.from, p.to));
    bus.on('unit:swapped', (p) => {
      this.recordStep(p.unitA, p.cellA, p.cellB);
      this.recordStep(p.unitB, p.cellB, p.cellA);
    });
    bus.on('unit:moveAborted', (p) => this.revertStep(p.unitId, p.from, p.to));
    bus.on('unit:moveDecision', (p) => {
      const t = this.units.get(p.unitId);
      if (t !== undefined) this.decisionMix[t.team][p.kind]++;
    });
    const contact = (): void => {
      if (this.firstContactTick === null) this.firstContactTick = this.ticks;
    };
    bus.on('unit:attacked', contact);
    bus.on('unit:missed', contact);
  }

  private register(unitId: number): void {
    if (this.units.has(unitId)) return;
    const u = this.world.units.find((w) => w.id === unitId);
    if (u === undefined || u.team === 'neutral') return;
    this.units.set(unitId, {
      team: u.team,
      position: { ...u.position },
      recentCells: [],
      moves: 0,
      netDx: 0,
      netDy: 0,
      backtracks: 0,
      lastStep: null,
    });
  }

  private derivedForward(team: MetricTeam): { x: number; y: number } {
    const own = this.centroid(team);
    const opp = this.centroid(team === 'player' ? 'enemy' : 'player');
    if (own === null || opp === null) return { x: 0, y: 0 };
    return { x: opp.x - own.x, y: opp.y - own.y };
  }

  private centroid(team: MetricTeam): { x: number; y: number } | null {
    let sx = 0;
    let sy = 0;
    let n = 0;
    for (const t of this.units.values()) {
      if (t.team !== team) continue;
      sx += t.position.x;
      sy += t.position.y;
      n++;
    }
    return n === 0 ? null : { x: sx / n, y: sy / n };
  }

  private recordStep(unitId: number, from: GridCoord, to: GridCoord): void {
    const t = this.units.get(unitId);
    if (t === undefined) return;
    const moveIndex = t.moves;
    // Backtrack: the destination is a cell this unit vacated within the window.
    const toKey = key(to);
    const wasBacktrack = t.recentCells.some(
      ([cell, idx]) => cell === toKey && moveIndex - idx <= this.windowMoves,
    );
    if (wasBacktrack) t.backtracks++;
    const crossedGate = this.gate !== undefined && this.gate(from, to);
    if (crossedGate) this.gateCrossings++;

    t.recentCells.push([key(from), moveIndex]);
    while (t.recentCells.length > this.windowMoves) t.recentCells.shift();
    t.moves++;
    t.netDx += to.x - from.x;
    t.netDy += to.y - from.y;
    t.position = { ...to };
    t.lastStep = { from: { ...from }, to: { ...to }, wasBacktrack, crossedGate };
  }

  /**
   * §35b/§36c — an aborted relocation never happened: undo the matching
   * committed step (the abort event always follows the move event it cancels;
   * a mismatch means the abort was selection-time, before any counted step —
   * ignore it).
   */
  private revertStep(unitId: number, from: GridCoord, to: GridCoord): void {
    const t = this.units.get(unitId);
    if (t === undefined || t.lastStep === null) return;
    const s = t.lastStep;
    if (s.from.x !== from.x || s.from.y !== from.y || s.to.x !== to.x || s.to.y !== to.y) return;
    t.moves--;
    t.netDx -= to.x - from.x;
    t.netDy -= to.y - from.y;
    t.position = { ...from };
    if (s.wasBacktrack) t.backtracks--;
    if (s.crossedGate) this.gateCrossings--;
    t.recentCells.pop();
    t.lastStep = null;
  }

  finish(): MovementMetrics {
    const teams = {
      player: this.teamMetrics('player'),
      enemy: this.teamMetrics('enemy'),
    };
    return {
      ticks: this.ticks,
      timeToFirstContactTicks: this.firstContactTick,
      gateCrossings: this.gateCrossings,
      throughputPer100Ticks:
        this.gate === undefined || this.ticks === 0
          ? null
          : (this.gateCrossings / this.ticks) * 100,
      teams,
    };
  }

  private teamMetrics(team: MetricTeam): TeamMovementMetrics {
    const lateral = this.lateral[team];
    let unitCount = 0;
    let moves = 0;
    let backtracks = 0;
    let sumLateral = 0;
    let sumDx = 0;
    let sumDy = 0;
    for (const t of this.units.values()) {
      if (t.team !== team) continue;
      unitCount++;
      moves += t.moves;
      backtracks += t.backtracks;
      sumLateral += t.netDx * lateral.x + t.netDy * lateral.y;
      sumDx += t.netDx;
      sumDy += t.netDy;
    }
    return {
      unitCount,
      moves,
      meanNetLateralDrift: unitCount === 0 ? 0 : sumLateral / unitCount,
      meanNetDx: unitCount === 0 ? 0 : sumDx / unitCount,
      meanNetDy: unitCount === 0 ? 0 : sumDy / unitCount,
      backtracks,
      oscillationRate: moves === 0 ? 0 : backtracks / moves,
      decisionMix: this.decisionMix[team],
    };
  }
}

/** Forward rotated 90° CCW (grid coords), normalized to unit length. */
function rotate90ccwUnit(forward: { x: number; y: number }): { x: number; y: number } {
  const len = Math.hypot(forward.x, forward.y);
  if (len === 0) return { x: 0, y: 0 };
  return { x: -forward.y / len, y: forward.x / len };
}
