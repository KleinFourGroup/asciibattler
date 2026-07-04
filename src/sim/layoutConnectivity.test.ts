/**
 * §40 follow-up — the auto-target-aware connectivity classifier. These pin the
 * three tiers `classifyConnectivity` distinguishes, driving the editor's error/warn
 * and the shipped-layout test guard. The Phase-40 asymmetry under test: rubble is
 * passable (auto-targeted → the AI breaks through), a destructible wall/cover is a
 * SOFT blocker (manual-break only), an indestructible obstacle is a HARD sever.
 */

import { describe, it, expect } from 'vitest';
import {
  classifyConnectivity,
  reachableBetween,
  type ConnectivityRegion,
} from './layoutConnectivity';

// A 5×3 arena with the two spawn regions pinned to the left + right edges; a
// FULL-height column at x=2 severs left from right under king's-move BFS.
const GRID_W = 5;
const GRID_H = 3;
const LEFT: ConnectivityRegion = { tiles: [{ x: 0, y: 0 }, { x: 0, y: 1 }, { x: 0, y: 2 }] };
const RIGHT: ConnectivityRegion = { tiles: [{ x: 4, y: 0 }, { x: 4, y: 1 }, { x: 4, y: 2 }] };
const SEVERING_COLUMN = [{ x: 2, y: 0 }, { x: 2, y: 1 }, { x: 2, y: 2 }];

const query = (hardBlockers: { x: number; y: number }[], destructibleBlockers: { x: number; y: number }[] = []) => ({
  gridW: GRID_W,
  gridH: GRID_H,
  spawns: [LEFT, RIGHT],
  hardBlockers,
  destructibleBlockers,
});

describe('reachableBetween (king-move BFS)', () => {
  it('reaches across an open arena', () => {
    expect(reachableBetween([], GRID_W, GRID_H, LEFT, RIGHT)).toBe(true);
  });

  it('does not reach across a full-height blocker column', () => {
    expect(reachableBetween(SEVERING_COLUMN, GRID_W, GRID_H, LEFT, RIGHT)).toBe(false);
  });
});

describe('classifyConnectivity — the Phase-40 auto-target tiers', () => {
  it('open ground → connected', () => {
    expect(classifyConnectivity(query([]))).toBe('connected');
  });

  it('a full RUBBLE column → connected (rubble is auto-targeted, so passable — it is in NEITHER blocker set)', () => {
    // Rubble never enters hardBlockers or destructibleBlockers, so a rubble-only
    // barrier classifies exactly like open ground.
    expect(classifyConnectivity(query([]))).toBe('connected');
  });

  it('a DESTRUCTIBLE wall column (only path) → destructible-dependent (a manual break, not a sever)', () => {
    // Hard set empty ⇒ pass 1 connects; the column blocks only in pass 2.
    expect(classifyConnectivity(query([], SEVERING_COLUMN))).toBe('destructible-dependent');
  });

  it('an INDESTRUCTIBLE column → severed (no path even if every destructible breaks)', () => {
    expect(classifyConnectivity(query(SEVERING_COLUMN))).toBe('severed');
  });

  it('a destructible wall that does NOT sever (an open path remains) → connected', () => {
    // Only the top two cells of the column are destructible walls; the bottom row
    // (2,2) stays open, so a path threads through even without breaking them.
    expect(
      classifyConnectivity(query([], [{ x: 2, y: 0 }, { x: 2, y: 1 }])),
    ).toBe('connected');
  });

  it('fewer than two regions → connected (transient editor state; schema requires ≥2)', () => {
    expect(
      classifyConnectivity({ gridW: GRID_W, gridH: GRID_H, spawns: [LEFT], hardBlockers: SEVERING_COLUMN, destructibleBlockers: [] }),
    ).toBe('connected');
  });
});
