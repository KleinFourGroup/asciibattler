import { describe, expect, it } from 'vitest';
import { TICK_RATE } from '../config';
import type { StatusDef } from './effects/statusSchema';
import type { StatusEffect } from './statusEffects';
import { readUnitStatuses } from './statusReadout';

/**
 * Hermetic fixtures — explicit literals, NOT the shipped `config/statuses.json`
 * (the mechanic-test discipline). Covers one `add` DoT, one `refresh` HoT, and
 * one behavior status, in a deliberate canonical order so the stable-sort test
 * has something to reorder.
 */
const DEFS: Record<string, StatusDef> = {
  bleed: {
    id: 'bleed',
    name: 'Bleed',
    durationSeconds: 4,
    merge: 'add',
    periodic: {
      everySeconds: 1,
      op: { kind: 'damage', scaling: 'none', might: 2, accuracy: 1, critBase: 0, critable: false, evadable: false, bypassDefense: true },
    },
  },
  rejuvenate: {
    id: 'rejuvenate',
    name: 'Rejuvenate',
    durationSeconds: 4,
    merge: 'refresh',
    periodic: { everySeconds: 2, op: { kind: 'heal', scaling: 'none', might: 3 } },
  },
  frozen: {
    id: 'frozen',
    name: 'Frozen',
    durationSeconds: 2,
    merge: 'refresh',
    behavior: { preventsAttack: true, preventsMove: true },
  },
};

/** Build a `ticks`-lifetime effect expiring at `expiresAtTick`. */
function ticked(key: string, magnitude: number, expiresAtTick: number): StatusEffect {
  return { key, magnitude, mods: {}, lifetime: { kind: 'ticks', expiresAtTick }, merge: 'add' };
}

describe('readUnitStatuses', () => {
  it('projects a periodic DoT — kind, name, remaining, and might×magnitude potency', () => {
    // bleed ×3, 2s of a 4s life left at tick 0 (expires at 2·TICK_RATE).
    const [r] = readUnitStatuses([ticked('bleed', 3, 2 * TICK_RATE)], 0, DEFS);
    expect(r).toMatchObject({
      statusId: 'bleed',
      name: 'Bleed',
      kind: 'damage',
      merge: 'add',
      stacks: 3,
      remainingSeconds: 2,
      durationFraction: 0.5, // 2s remaining / 4s nominal duration
      potencyPerSec: 6, // might 2 × magnitude 3 ÷ everySeconds 1
    });
  });

  it('folds §31 scaling into potency for a refresh status (magnitude is the scaled scalar, not a stack)', () => {
    // rejuvenate scaled to magnitude 2.5 by a high-magic caster: 3 × 2.5 ÷ 2s = 3.75/s.
    const [r] = readUnitStatuses([ticked('rejuvenate', 2.5, 4 * TICK_RATE)], 0, DEFS);
    expect(r.kind).toBe('heal');
    expect(r.potencyPerSec).toBeCloseTo(3.75);
    expect(r.stacks).toBe(3); // round(2.5) — UI suppresses ×N for non-`add` merges
  });

  it('reports a behavior status with no potency', () => {
    const [r] = readUnitStatuses([ticked('frozen', 1, 1 * TICK_RATE)], 0, DEFS);
    expect(r.kind).toBe('behavior');
    expect(r.potencyPerSec).toBeNull();
    expect(r.remainingSeconds).toBe(1);
  });

  it('clamps remaining at 0 for an expired-but-unreaped effect, never negative', () => {
    const [r] = readUnitStatuses([ticked('bleed', 1, 10)], 40, DEFS); // currentTick past expiry
    expect(r.remainingSeconds).toBe(0);
  });

  it('reports null remaining for a persistent endOfTurn lifetime', () => {
    const effect: StatusEffect = { key: 'bleed', magnitude: 1, mods: {}, lifetime: { kind: 'endOfTurn' }, merge: 'add' };
    const [r] = readUnitStatuses([effect], 0, DEFS);
    expect(r.remainingSeconds).toBeNull();
    expect(r.durationFraction).toBe(1); // persistent → full pip
  });

  it('clamps durationFraction into [0,1] (full when fresh, 0 when expired)', () => {
    const fresh = readUnitStatuses([ticked('bleed', 1, 4 * TICK_RATE)], 0, DEFS)[0]!;
    expect(fresh.durationFraction).toBe(1); // 4s / 4s
    const gone = readUnitStatuses([ticked('bleed', 1, 10)], 40, DEFS)[0]!;
    expect(gone.durationFraction).toBe(0); // past expiry → clamped
  });

  it('skips raw K1 stat effects that have no StatusDef (empower / fatigue / daemon)', () => {
    const empower = ticked('empowered', 3, 100);
    const out = readUnitStatuses([empower, ticked('bleed', 1, 100)], 0, DEFS);
    expect(out).toHaveLength(1);
    expect(out[0]!.statusId).toBe('bleed');
  });

  it('returns statuses in stable canonical (defs) order regardless of application order', () => {
    // Applied frozen → rejuvenate → bleed; defs order is bleed, rejuvenate, frozen.
    const out = readUnitStatuses(
      [ticked('frozen', 1, 100), ticked('rejuvenate', 1, 100), ticked('bleed', 1, 100)],
      0,
      DEFS,
    );
    expect(out.map((r) => r.statusId)).toEqual(['bleed', 'rejuvenate', 'frozen']);
  });

  it('returns an empty array for a unit with no effects', () => {
    expect(readUnitStatuses([], 0, DEFS)).toEqual([]);
  });
});
