/**
 * 94d — the fallen-ledger CROSS-CHECK on a real run: over every battle of a
 * short headless run, Σ `unit:died.power` per side (the identity the death
 * event now carries — the Run ledger's input) equals `battle:ended.fallenPower`
 * per side (the casualty rule's own accumulator). Two bookkeepings, one
 * truth, both death sites (the step-1 check + `reapDead` share `reapUnit`),
 * summons and neutrals included as zeros. Non-vacuous: the run must have
 * recorded deaths and battles.
 *
 * Balance-proof: no shipped number appears — the pin is an identity between
 * two instruments on the same events.
 */

import { describe, it, expect } from 'vitest';
import { runOne } from './harness';
import { makeStrategy } from './strategies/registry';
import type { GameEvents } from '../../src/core/events';
import type { EventBus } from '../../src/core/EventBus';

describe('94d — unit:died.power sums to battle:ended.fallenPower per side on every battle of a real run', () => {
  it.each([3, 11])('seed %i, a short run', (seed) => {
    type Side = { player: number; enemy: number };
    let summed: Side = { player: 0, enemy: 0 };
    let deaths = 0;
    const checks: { summed: Side; booked: Side }[] = [];
    const observe = (bus: EventBus<GameEvents>): void => {
      bus.on('battle:started', () => {
        summed = { player: 0, enemy: 0 };
      });
      bus.on('unit:died', (d) => {
        if (d.team === 'player' || d.team === 'enemy') {
          summed[d.team] += d.power;
          deaths++;
        }
      });
      bus.on('battle:ended', ({ fallenPower }) => {
        checks.push({ summed: { ...summed }, booked: fallenPower ?? { player: 0, enemy: 0 } });
      });
    };
    const result = runOne(seed, makeStrategy('pure-random')!, { runConfig: { hopCount: 2 }, observe });
    expect(['complete', 'defeat']).toContain(result.outcome);
    expect(checks.length).toBeGreaterThan(0);
    expect(deaths).toBeGreaterThan(0);
    for (const c of checks) expect(c.summed).toEqual(c.booked);
  });
});
