import { describe, it, expect } from 'vitest';
import { GAUNTLET_CELLS, cellRunConfig, cellUrl } from './cells';
import { ENCOUNTERS } from '../../src/config/encounters';
import { LAYOUT_IDS } from '../../src/sim/layouts';
import { parseRunConfig } from '../../src/run/RunConfig';
import { runOne } from '../fuzz/harness';
import { makeStrategy } from '../fuzz/strategies/registry';

/**
 * 53e — catalog integrity for the gauntlet cells (referential checks are
 * cheap; the full sweep is the opt-in `npm run gauntlet`). One live 1-hop
 * drive pins the config→forced-selection plumbing headlessly.
 */

describe('gauntlet cells (53e)', () => {
  it('is the shape-locked 10-cell catalog with unique ids and seeds', () => {
    expect(GAUNTLET_CELLS).toHaveLength(10);
    const ids = GAUNTLET_CELLS.map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
    const seeds = GAUNTLET_CELLS.flatMap((c) => [...c.seeds]);
    expect(new Set(seeds).size).toBe(seeds.length);
  });

  it('every cell references a real encounter, with the matching catalog kind', () => {
    for (const cell of GAUNTLET_CELLS) {
      const encounter = ENCOUNTERS.find((e) => e.id === cell.encounterId);
      expect(encounter, `${cell.id}: unknown encounter ${cell.encounterId}`).toBeDefined();
      expect(encounter!.kind, `${cell.id}: kind drift`).toBe(cell.kind);
    }
  });

  it('every cell references a real layout', () => {
    for (const cell of GAUNTLET_CELLS) {
      expect(LAYOUT_IDS.includes(cell.layoutId), `${cell.id}: unknown layout ${cell.layoutId}`).toBe(
        true,
      );
    }
  });

  it('cell run shapes: normal/boss = 2 hops, elite ≥ 3 (elites are scattered nodes)', () => {
    for (const cell of GAUNTLET_CELLS) {
      if (cell.kind === 'elite') expect(cell.hops, cell.id).toBeGreaterThanOrEqual(3);
      else expect(cell.hops, cell.id).toBe(2);
    }
  });

  it('the cell URL round-trips through the game parser to the exact same RunConfig', () => {
    const cell = GAUNTLET_CELLS[0]!;
    const seed = cell.seeds[0];
    const url = cellUrl(cell, seed);
    const query = url.slice(url.indexOf('?') + 1);
    expect(parseRunConfig(new URLSearchParams(query))).toEqual(cellRunConfig(cell, seed));
  });

  it('a live headless drive of cell #1 fights the forced encounter, on the forced layout, with the standard roster', () => {
    const cell = GAUNTLET_CELLS[0]!;
    const result = runOne(cell.seeds[0], makeStrategy('greedy')!, {
      runConfig: cellRunConfig(cell, cell.seeds[0]),
    });
    const target = result.battles.filter((b) => b.encounterId === cell.encounterId);
    expect(target.length).toBeGreaterThan(0);
    expect(target.every((b) => b.layoutId === cell.layoutId)).toBe(true);
    expect(target[0]?.hop).toBe(0); // a normal cell fires at the root node
    // 53e.2 — the fielded team comes from the STANDARD mid-run roster (levels
    // 7–9), not a seed-rolled fresh team (which would start at level 5).
    for (const level of target[0]?.playerLevels ?? []) {
      expect(level).toBeGreaterThanOrEqual(7);
      expect(level).toBeLessThanOrEqual(9);
    }
  });
});
