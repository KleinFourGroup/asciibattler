/**
 * J4 commit 1 — the arena harness: a single forced World battle drives an
 * objective strategy to resolution. These assert the brief's "arena run
 * terminates (no paralysis) + determinism per seed," plus that the enumeration
 * ranks the proclivity menu. Seed sets are kept small (each entry runs a full
 * battle) so the smoke suite stays quick.
 */

import { describe, it, expect } from 'vitest';
import {
  runArena,
  runArenaSearch,
  runArenaVectorSearch,
  generateObjectiveVectors,
  DEFAULT_ARENA_ROSTER,
} from './arena';
import type { MenuEntry, ObjectiveProclivity } from './objectiveStrategy';
import { ALL_ARCHETYPES } from '../../src/sim/archetypes';
import { STAT_KEYS } from './strategies/policies';

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

describe('generateObjectiveVectors (K3c3 scored sampler)', () => {
  it('is reproducible from the sampler seed and covers every weight key in [-1, 1]', () => {
    const a = generateObjectiveVectors(7, 3);
    const b = generateObjectiveVectors(7, 3);
    expect(a).toEqual(b);
    expect(a).toHaveLength(3);
    for (const v of a) {
      expect(Object.keys(v.stats).sort()).toEqual([...STAT_KEYS].map(String).sort());
      expect(Object.keys(v.archetype).sort()).toEqual([...ALL_ARCHETYPES].map(String).sort());
      for (const x of [...Object.values(v.stats), v.hp, ...Object.values(v.archetype)]) {
        expect(x).toBeGreaterThanOrEqual(-1);
        expect(x).toBeLessThanOrEqual(1);
      }
    }
    expect(generateObjectiveVectors(8, 3)).not.toEqual(a); // a different seed proposes differently
  });
});

describe('runArenaVectorSearch (K3c3)', () => {
  const seeds = [1, 2];

  it('evaluates each sampled vector as a scored proclivity, ranked best-first', () => {
    const result = runArenaVectorSearch(seeds, DEFAULT_ARENA_ROSTER, null, {
      samplerSeed: 1,
      vectors: 2,
    });
    expect(result.scores).toHaveLength(2);
    expect(result.scores.map((s) => s.label).sort()).toEqual(['scored#0', 'scored#1']);
    const winRates = result.scores.map((s) => s.winRate);
    expect(winRates).toEqual([...winRates].sort((a, b) => b - a));
    expect(result.best).toBe(result.scores[0]);
    expect(result.best.proclivity.kind).toBe('scored');
  });

  it('is deterministic across repeated searches (same sampler seed)', () => {
    const opts = { samplerSeed: 5, vectors: 2 };
    const a = runArenaVectorSearch(seeds, DEFAULT_ARENA_ROSTER, null, opts);
    const b = runArenaVectorSearch(seeds, DEFAULT_ARENA_ROSTER, null, opts);
    expect(a.scores).toEqual(b.scores);
  });
});
