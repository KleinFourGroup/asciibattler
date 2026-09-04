/**
 * 91e — the per-MODE-PAIR harness pin. A short run under EACH {chipMode} ×
 * {capPenalty} pair, the modes set the way the CLI's `--set=health.<key>=<mode>`
 * sets them (`resolveKnob` → the live HEALTH object, written in place), and on
 * every recorded chip the rule's STRUCTURAL identity under that pair:
 * `charge == turnCharges(reason, survivors, fallen)` and
 * `applied == min(charge, poolBefore)`. The shipped default is
 * (casualties, casualties) since 91e; this pins that every pair is drivable
 * end to end and reads by its own rule — not just the default.
 *
 * Balance-proof: no shipped number appears; every expectation is the rule's
 * arithmetic recomputed from the record's own inputs.
 */

import { describe, it, expect, afterEach } from 'vitest';
import { runOne } from './harness';
import { makeStrategy } from './strategies/registry';
import { resolveKnob } from './balanceSweep';
import { HEALTH } from '../../src/config/health';
import { turnCharges, type ChipRule } from '../../src/run/chipRule';

const PAIRS: readonly (readonly [ChipRule, ChipRule])[] = [
  ['survivors', 'survivors'],
  ['casualties', 'casualties'],
  ['casualties', 'survivors'],
  ['survivors', 'casualties'],
];

/** The `--set=health.<key>=<mode>` write, exactly as the CLI performs it. */
function setMode(key: 'chipMode' | 'capPenalty', mode: ChipRule): void {
  const knob = resolveKnob(`health.${key}`);
  knob.obj[knob.key] = mode;
}

describe('91e — the chip modes through the harness, every pair via the --set path', () => {
  const original = { chipMode: HEALTH.chipMode, capPenalty: HEALTH.capPenalty };
  afterEach(() => {
    setMode('chipMode', original.chipMode);
    setMode('capPenalty', original.capPenalty);
  });

  it('the shipped default is (casualties, casualties) — the signed 91e flip', () => {
    expect(HEALTH.chipMode).toBe('casualties');
    expect(HEALTH.capPenalty).toBe('casualties');
  });

  it.each(PAIRS)(
    "(%s, %s): a short run completes and every recorded chip obeys the pair's rule",
    (chipMode, capPenalty) => {
      setMode('chipMode', chipMode);
      setMode('capPenalty', capPenalty);
      // The --set write landed on the LIVE object the rule reads.
      expect(HEALTH.chipMode).toBe(chipMode);
      expect(HEALTH.capPenalty).toBe(capPenalty);

      const result = runOne(3, makeStrategy('pure-random')!, {
        runConfig: { hopCount: 2 },
        telemetry: true,
      });
      expect(['complete', 'defeat']).toContain(result.outcome);
      const chips = result.telemetry!.poolChips;
      expect(chips.length).toBeGreaterThan(0);

      for (const c of chips) {
        // Every 91a2+ record carries the rule's inputs + its uncapped charges.
        expect(c.reason).toBeDefined();
        expect(c.fallenPlayer).toBeDefined();
        expect(c.fallenEnemy).toBeDefined();
        const expected = turnCharges(
          c.reason!,
          { player: c.player, enemy: c.enemy },
          { player: c.fallenPlayer!, enemy: c.fallenEnemy! },
          { chipMode, capPenalty, chipMultiplier: HEALTH.chipMultiplier },
        );
        expect(c.playerCharge).toBe(expected.player);
        expect(c.enemyCharge).toBe(expected.enemy);
        // The APPLIED loss is the charge clamped at the pool.
        expect(c.playerPoolBefore - c.playerPoolAfter).toBe(Math.min(c.playerPoolBefore, expected.player));
        expect(c.enemyPoolBefore - c.enemyPoolAfter).toBe(Math.min(c.enemyPoolBefore, expected.enemy));
      }
    },
  );

  it('the pairs are not interchangeable: the same seed charges differently under survivors vs casualties', () => {
    const drive = (chipMode: ChipRule): number[] => {
      setMode('chipMode', chipMode);
      setMode('capPenalty', chipMode);
      const result = runOne(3, makeStrategy('pure-random')!, {
        runConfig: { hopCount: 2 },
        telemetry: true,
      });
      return result.telemetry!.poolChips.map((c) => c.playerCharge! + c.enemyCharge!);
    };
    // The first battle is seeded identically under both modes (the rule reads
    // AFTER the battle), so a differing first-chip charge is the rule alone.
    const survivors = drive('survivors');
    const casualties = drive('casualties');
    expect(survivors[0]).not.toBe(casualties[0]);
  });
});
