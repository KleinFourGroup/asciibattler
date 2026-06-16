import { describe, it, expect } from 'vitest';
import { DashAbility } from './dash';
import { World } from '../World';
import { Unit, type Team, type UnitArchetype, type UnitStats } from '../Unit';
import { EventBus } from '../../core/EventBus';
import { RNG } from '../../core/RNG';
import { deriveStats } from '../stats';
import { secondsToTicks } from '../../config';
import { movementConfig } from '../../config/abilities';
import { MoveAction } from '../actions/MoveAction';
import { chebyshev } from '../movement';
import type { GameEvents } from '../../core/events';
import type { GridCoord } from '../../core/types';

/**
 * N1 — `DashAbility` PROPOSE-path tests (the wiring layer). Range / duration /
 * cooldown expectations derive from `config/abilities.json` via `movementConfig`,
 * per the project convention that wiring tests read the shipped config. The
 * landing-cell geometry (the J2 leap walk + the stop-before-occupied rule) is
 * pinned mechanic-free in `movement.test.ts`; this file pins the dash's own
 * decisions: the aggressive-close gate, the decoupled duration/cooldown, and the
 * `cooldownKey`.
 */

const DASH = movementConfig('dash');
const DASH_DURATION_TICKS = Math.max(1, secondsToTicks(DASH.durationSeconds));
const DASH_COOLDOWN_TICKS = Math.max(1, secondsToTicks(DASH.cooldownSeconds));

const ROGUE_STATS: UnitStats = {
  constitution: 14, strength: 4, ranged: 0, magic: 0, luck: 10, defense: 0, precision: 5, evasion: 5, speed: 9, mobility: 4, power: 1,
};

// `range` here sets `derived.attackRange` = the unit's STRIKE reach (the dash's
// out-of-range gate), independent of the dash's own leap distance.
function makeUnit(
  id: number,
  team: Team,
  pos: GridCoord,
  opts: { archetype?: UnitArchetype; stats?: UnitStats; strikeRange?: number } = {},
): Unit {
  const archetype = opts.archetype ?? 'rogue';
  const stats = opts.stats ?? ROGUE_STATS;
  return new Unit({
    id, team, archetype,
    glyph: archetype === 'rogue' ? 'r' : 'M',
    stats, derived: deriveStats(stats, opts.strikeRange ?? 1),
    position: pos,
  });
}

function world(units: Unit[]): World {
  const w = new World(new EventBus<GameEvents>(), new RNG(1), 16, 16);
  w.units.push(...units);
  return w;
}

function landingOf(proposal: { action: unknown } | null): GridCoord | null {
  if (proposal === null) return null;
  return (proposal.action as MoveAction).toData().to;
}

describe('DashAbility.propose — the aggressive-close gate', () => {
  it('abstains when the target is already within strike range (let the strike fire)', () => {
    const rogue = makeUnit(1, 'player', { x: 5, y: 5 }, { strikeRange: 1 });
    const enemy = makeUnit(2, 'enemy', { x: 6, y: 5 }); // dist 1 == strikeRange
    expect(new DashAbility().propose(rogue, world([rogue, enemy]))).toBeNull();
  });

  it('abstains when there is no target', () => {
    const rogue = makeUnit(1, 'player', { x: 5, y: 5 }, { strikeRange: 1 });
    expect(new DashAbility().propose(rogue, world([rogue]))).toBeNull();
  });

  it('abstains under a hold objective even with a target beyond strike range (O2: hold = no dash)', () => {
    // The canonical dash trigger (enemy beyond strike reach → leap to close),
    // but under hold the rogue holds position: updateTarget's hold branch
    // commits no out-of-range target, so currentTarget is null and the dash —
    // gated on currentTarget — never fires. This is why hold needs no
    // dash-specific guard; suppressing the target suffices.
    const rogue = makeUnit(1, 'player', { x: 5, y: 5 }, { strikeRange: 1 });
    const enemy = makeUnit(2, 'enemy', { x: 5 + DASH.range + 2, y: 5 });
    const w = world([rogue, enemy]);
    w.enqueueCommand({ kind: 'setObjective', team: 'player', objective: { mode: 'hold' } });
    w.tick(); // drain the hold command + run updateTarget (no behaviors → nothing moves)
    expect(new DashAbility().propose(rogue, w)).toBeNull();
  });

  it('leaps toward a target beyond strike range, covering the full dash range', () => {
    const start: GridCoord = { x: 5, y: 5 };
    const rogue = makeUnit(1, 'player', start, { strikeRange: 1 });
    // Enemy 2 cells past the dash's reach so the leap runs to its cap on open
    // ground (the exact landing cell is A*'s tie-broken choice — equal-cost
    // diagonal approaches are valid — so we pin the GEOMETRY: DASH.range cells
    // covered, closer to the enemy than the start).
    const enemy = makeUnit(2, 'enemy', { x: 5 + DASH.range + 2, y: 5 });
    const land = landingOf(new DashAbility().propose(rogue, world([rogue, enemy])));
    expect(land).not.toBeNull();
    expect(chebyshev(land!, start)).toBe(DASH.range);
    expect(chebyshev(land!, enemy.position)).toBeLessThan(chebyshev(start, enemy.position));
  });

  it('lands adjacent to the target (never on it) when the leap reaches it', () => {
    const rogue = makeUnit(1, 'player', { x: 5, y: 5 }, { strikeRange: 1 });
    // Enemy exactly DASH.range away: the route ends on its (soft-blocked) cell
    // and the leap stops the cell before — landing adjacent, ready to strike.
    const enemy = makeUnit(2, 'enemy', { x: 5 + DASH.range, y: 5 });
    const land = landingOf(new DashAbility().propose(rogue, world([rogue, enemy])));
    expect(land).not.toBeNull();
    expect(land).not.toEqual(enemy.position); // never stacks onto the target
    expect(chebyshev(land!, enemy.position)).toBe(1); // adjacent — in strike range next tick
  });
});

describe('DashAbility.propose — the proposal shape', () => {
  it('decouples a short motion duration from the long cooldown, keyed on its own id', () => {
    const rogue = makeUnit(1, 'player', { x: 5, y: 5 }, { strikeRange: 1 });
    const enemy = makeUnit(2, 'enemy', { x: 5 + DASH.range + 2, y: 5 });
    const proposal = new DashAbility().propose(rogue, world([rogue, enemy]))!;

    expect(proposal.cooldownKey).toBe('dash'); // independent of the 'move' cadence
    expect(proposal.cooldown).toBe(DASH_COOLDOWN_TICKS);
    expect(proposal.phases).toEqual([{ phase: 'impact', ticks: DASH_DURATION_TICKS }]);
    // The defining property: the lockout is far shorter than the cooldown.
    expect(DASH_DURATION_TICKS).toBeLessThan(DASH_COOLDOWN_TICKS);
  });

  it('scores between a walk (1) and a strike (10) so the strike preempts but a walk does not', () => {
    const rogue = makeUnit(1, 'player', { x: 5, y: 5 }, { strikeRange: 1 });
    const enemy = makeUnit(2, 'enemy', { x: 5 + DASH.range + 2, y: 5 });
    const proposal = new DashAbility().propose(rogue, world([rogue, enemy]))!;
    expect(proposal.score).toBeGreaterThan(1);
    expect(proposal.score).toBeLessThan(10);
  });
});
