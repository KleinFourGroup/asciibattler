/**
 * J4 commit 1 — the arena harness: a single forced World battle drives an
 * objective strategy to resolution. These assert the brief's "arena run
 * terminates (no paralysis) + determinism per seed," plus that the enumeration
 * ranks the proclivity menu. Seed sets are kept small (each entry runs a full
 * battle) so the smoke suite stays quick.
 */

import { describe, it, expect } from 'vitest';
import { runArena, runArenaSearch, DEFAULT_ARENA_ROSTER } from './arena';
import type { MenuEntry, ObjectiveProclivity } from './objectiveStrategy';

const STAT_HI: ObjectiveProclivity = { kind: 'stat', select: 'highest', stat: 'strength' };

describe('runArena', () => {
  it('terminates with a valid outcome under each proclivity (no paralysis)', () => {
    for (const proclivity of [{ kind: 'none' } as const, { kind: 'random' } as const, STAT_HI]) {
      for (const seed of [1, 2]) {
        const r = runArena(seed, { proclivity });
        expect(['player', 'enemy', 'hang']).toContain(r.winner);
        expect(r.ticks).toBeGreaterThan(0);
        // A decisive battle ends before the cap; a hang stops exactly at it.
        if (r.winner !== 'hang') expect(r.ticks).toBeLessThan(3000);
      }
    }
  });

  it('is deterministic for the same seed + proclivity', () => {
    const a = runArena(7, { proclivity: { kind: 'random' } });
    const b = runArena(7, { proclivity: { kind: 'random' } });
    expect(a).toEqual(b);
  });
});

describe('runArenaSearch', () => {
  const seeds = [1, 2, 3];
  const menu: MenuEntry[] = [
    { label: 'none', proclivity: { kind: 'none' } },
    { label: 'random', proclivity: { kind: 'random' } },
    { label: 'stat:strength:highest', proclivity: STAT_HI },
  ];

  it('scores every menu entry and ranks them best-first', () => {
    const result = runArenaSearch(seeds, DEFAULT_ARENA_ROSTER, null, menu);
    expect(result.scores).toHaveLength(menu.length);
    const winRates = result.scores.map((s) => s.winRate);
    const sorted = [...winRates].sort((a, b) => b - a);
    expect(winRates).toEqual(sorted);
    expect(result.best).toBe(result.scores[0]);
    expect(result.best.winRate).toBe(Math.max(...winRates));
  });

  it('is deterministic across repeated searches', () => {
    const a = runArenaSearch(seeds, DEFAULT_ARENA_ROSTER, null, menu);
    const b = runArenaSearch(seeds, DEFAULT_ARENA_ROSTER, null, menu);
    expect(a.scores).toEqual(b.scores);
  });
});
