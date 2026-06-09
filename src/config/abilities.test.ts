import { describe, it, expect } from 'vitest';
import { ABILITIES, abilityConfig } from './abilities';

/**
 * I6 — the per-ability combat profile + the evadable/critable DESIGNATION
 * system. These read the shipped `config/abilities.json` (a config-contract
 * test): they pin the STRUCTURAL facts — which attacks roll to-hit, which can
 * crit, and that the I6 weapon split/rename landed — NOT the by-feel
 * might/accuracy/critBase VALUES (those are tuned in the editor and re-swept in
 * Phase N, so per BALANCE.md they're deliberately not pinned). The numeric
 * damage/hit/crit FORMULAS are mechanic-pinned with explicit literals in
 * `src/sim/stats.test.ts`.
 */

// The single-target strikes that roll to-hit + can crit: the four melee weapons
// (sword/club/katana/whip, split from the old `melee_strike`), the `bow`
// (renamed `ranged_shot`), and the rogue's `gambit_strike`.
const BASIC_STRIKES = ['sword', 'club', 'katana', 'whip', 'bow', 'gambit_strike'];
// The unmissable abilities: heal + the AoE blast + the artillery shot.
const NON_STRIKES = ['heal_ally', 'magic_bolt', 'catapult_shot'];

describe('abilities config — I6 combat profile', () => {
  const ids = Object.keys(ABILITIES);

  it('every ability declares the full combat profile within range', () => {
    for (const id of ids) {
      const a = abilityConfig(id);
      expect(a.might, `${id}.might`).toBeGreaterThanOrEqual(0);
      expect(a.accuracy, `${id}.accuracy ≥ 0`).toBeGreaterThanOrEqual(0);
      expect(a.accuracy, `${id}.accuracy ≤ 1`).toBeLessThanOrEqual(1);
      expect(a.critBase, `${id}.critBase ≥ 0`).toBeGreaterThanOrEqual(0);
      expect(a.critBase, `${id}.critBase ≤ 1`).toBeLessThanOrEqual(1);
      expect(typeof a.evadable, `${id}.evadable`).toBe('boolean');
      expect(typeof a.critable, `${id}.critable`).toBe('boolean');
    }
  });

  it('I6 commit 2 split/renamed the basic-strike ids', () => {
    // The shared `melee_strike` became four per-subclass weapons and
    // `ranged_shot` became `bow`; the old ids no longer exist.
    expect(ids).not.toContain('melee_strike');
    expect(ids).not.toContain('ranged_shot');
    for (const id of BASIC_STRIKES) expect(ids, `${id} registered`).toContain(id);
  });

  it('evadable gate = the single-target strikes (migrated from I2 call sites)', () => {
    // Single-target strikes roll precision-vs-evasion to-hit...
    for (const id of BASIC_STRIKES) expect(abilityConfig(id).evadable, id).toBe(true);
    // ...the AoE blast / artillery shot / heal are unmissable (dodged
    // positionally or not at all — the I2 carve-out, now in config).
    for (const id of NON_STRIKES) expect(abilityConfig(id).evadable, id).toBe(false);
  });

  it('critable gate: the strikes crit; heal + (I6 commit 2) the mage bolt & catapult do NOT', () => {
    for (const id of BASIC_STRIKES) expect(abilityConfig(id).critable, id).toBe(true);
    expect(abilityConfig('heal_ally').critable).toBe(false);
    // I6 commit 2 (user call): area-denial / artillery no longer crit, even
    // though pre-I6 they rolled a luck-based crit.
    expect(abilityConfig('magic_bolt').critable).toBe(false);
    expect(abilityConfig('catapult_shot').critable).toBe(false);
  });
});
