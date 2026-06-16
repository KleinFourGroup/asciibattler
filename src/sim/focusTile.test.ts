import { describe, it, expect } from 'vitest';
import { getFocusTileResolution, focusTileDirective, focusTileResolvedByArrival } from './focusTile';
import { World } from './World';
import { Unit, type Team } from './Unit';
import { EventBus } from '../core/EventBus';
import { RNG } from '../core/RNG';
import { deriveStats } from './stats';
import { ARCHETYPE_CONFIG } from './archetypes';
import { OBJECTIVE } from '../config/objective';
import type { GameEvents } from '../core/events';

/**
 * O3 — the per-strategy focus-tile resolver (mechanic tests, explicit literals).
 * The strategies are exercised DIRECTLY via `getFocusTileResolution(key)` so
 * each one is pinned regardless of which is the shipped default; the live
 * config wiring (`focusTileDirective` / `focusTileResolvedByArrival` →
 * `OBJECTIVE.focusTileResolution`) is asserted separately at the bottom.
 */

const TILE = { x: 10, y: 10 };

function mkUnit(id: number, team: Team, x: number, y: number, hp?: number): Unit {
  const stats = { ...ARCHETYPE_CONFIG.mercenary.baseStats, luck: 0 };
  const u = new Unit({
    id,
    team,
    archetype: team === 'neutral' ? 'environment' : 'mercenary',
    glyph: 'M',
    stats,
    derived: deriveStats(stats, 1),
    position: { x, y },
  });
  if (hp !== undefined) u.currentHp = hp;
  return u;
}

function mkWorld(units: Unit[]): World {
  const world = new World(new EventBus<GameEvents>(), new RNG(1));
  for (const u of units) world.units.push(u);
  return world;
}

describe('focusTile / disallow', () => {
  it('directive is always atWill (the focus is rejected)', () => {
    const r = getFocusTileResolution('disallow');
    expect(r.directive(mkUnit(1, 'player', 10, 10), mkWorld([]), TILE)).toBe('atWill');
    expect(r.directive(mkUnit(1, 'player', 0, 0), mkWorld([]), TILE)).toBe('atWill');
  });

  it('resolvedByArrival is always true (the World reverts it at once)', () => {
    const r = getFocusTileResolution('disallow');
    expect(r.resolvedByArrival('player', TILE, mkWorld([]))).toBe(true);
  });
});

describe('focusTile / clearOnArrival', () => {
  it('directive is always pursue (beeline, ignore enemies)', () => {
    const r = getFocusTileResolution('clearOnArrival');
    expect(r.directive(mkUnit(1, 'player', 0, 0), mkWorld([]), TILE)).toBe('pursue');
    expect(r.directive(mkUnit(1, 'player', 10, 10), mkWorld([]), TILE)).toBe('pursue');
  });

  it('resolvedByArrival is false until a team unit stands on the tile', () => {
    const r = getFocusTileResolution('clearOnArrival');
    const traveller = mkUnit(1, 'player', 8, 8); // not yet on the tile
    expect(r.resolvedByArrival('player', TILE, mkWorld([traveller]))).toBe(false);
  });

  it('resolvedByArrival is true once a LIVING team unit reaches the tile', () => {
    const r = getFocusTileResolution('clearOnArrival');
    const arrived = mkUnit(1, 'player', TILE.x, TILE.y);
    expect(r.resolvedByArrival('player', TILE, mkWorld([arrived]))).toBe(true);
  });

  it('a dead unit on the tile does NOT count as arrival', () => {
    const r = getFocusTileResolution('clearOnArrival');
    const corpse = mkUnit(1, 'player', TILE.x, TILE.y, 0);
    expect(r.resolvedByArrival('player', TILE, mkWorld([corpse]))).toBe(false);
  });

  it('an ENEMY unit on the tile does not resolve the PLAYER team focus (team-relative)', () => {
    const r = getFocusTileResolution('clearOnArrival');
    const enemyOnTile = mkUnit(1, 'enemy', TILE.x, TILE.y);
    expect(r.resolvedByArrival('player', TILE, mkWorld([enemyOnTile]))).toBe(false);
  });
});

describe('focusTile / leashAtNearest (default)', () => {
  const leash = OBJECTIVE.rangedLeashCells;

  it('directive is pursue while farther than the leash from the tile', () => {
    const r = getFocusTileResolution('leashAtNearest');
    const far = mkUnit(1, 'player', TILE.x - (leash + 1), TILE.y); // chebyshev leash+1
    expect(r.directive(far, mkWorld([]), TILE)).toBe('pursue');
  });

  it('directive flips to engageLocal once within the leash of the tile', () => {
    const r = getFocusTileResolution('leashAtNearest');
    const atLeash = mkUnit(1, 'player', TILE.x - leash, TILE.y); // chebyshev == leash
    const onTile = mkUnit(2, 'player', TILE.x, TILE.y); // chebyshev 0
    expect(r.directive(atLeash, mkWorld([]), TILE)).toBe('engageLocal');
    expect(r.directive(onTile, mkWorld([]), TILE)).toBe('engageLocal');
  });

  it('resolvedByArrival is always false (a leashAtNearest tile focus persists)', () => {
    const r = getFocusTileResolution('leashAtNearest');
    const onTile = mkUnit(1, 'player', TILE.x, TILE.y);
    expect(r.resolvedByArrival('player', TILE, mkWorld([onTile]))).toBe(false);
  });
});

describe('focusTile / live config wiring', () => {
  it('the shipped config selects a valid strategy and the helpers delegate to it', () => {
    const live = getFocusTileResolution(OBJECTIVE.focusTileResolution);
    const unit = mkUnit(1, 'player', 0, 0);
    const world = mkWorld([unit]);
    expect(focusTileDirective(unit, world, TILE)).toBe(live.directive(unit, world, TILE));
    expect(focusTileResolvedByArrival('player', TILE, world)).toBe(
      live.resolvedByArrival('player', TILE, world),
    );
  });
});
