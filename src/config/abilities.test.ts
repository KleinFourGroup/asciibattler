import { describe, it, expect } from 'vitest';
import { ABILITIES, abilityConfig } from './abilities';

/**
 * I6 — the per-ability combat profile + the evadable/critable DESIGNATION
 * system. These read the shipped `config/abilities.json` (a config-contract
 * test): they pin which attacks roll to-hit and which can crit — now declared
 * in config rather than hard-coded at each `applyDamage` call site (the I2
 * migration) — plus the commit-1 byte-identical neutral defaults. The numeric
 * to-hit/crit/damage FORMULAS are mechanic-pinned with explicit literals in
 * `src/sim/stats.test.ts`; this file is purely the config side.
 */
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

  it('evadable gate = the single-target strikes (migrated from I2 call sites)', () => {
    // Single-target strikes roll precision-vs-evasion to-hit...
    expect(abilityConfig('melee_strike').evadable).toBe(true);
    expect(abilityConfig('ranged_shot').evadable).toBe(true);
    expect(abilityConfig('gambit_strike').evadable).toBe(true);
    // ...the AoE blast / artillery shot / heal are unmissable (dodged
    // positionally or not at all — the I2 carve-out, now in config).
    expect(abilityConfig('magic_bolt').evadable).toBe(false);
    expect(abilityConfig('catapult_shot').evadable).toBe(false);
    expect(abilityConfig('heal_ally').evadable).toBe(false);
  });

  it('critable gate: the strikes crit, heal never does', () => {
    expect(abilityConfig('melee_strike').critable).toBe(true);
    expect(abilityConfig('ranged_shot').critable).toBe(true);
    expect(abilityConfig('gambit_strike').critable).toBe(true);
    expect(abilityConfig('heal_ally').critable).toBe(false);
    // I6 commit 1 keeps the mage bolt + catapult `critable` (pre-I6 both rolled
    // crit → byte-identical). Commit 2 flips them to `false` (user call); update
    // these two expectations then.
    expect(abilityConfig('magic_bolt').critable).toBe(true);
    expect(abilityConfig('catapult_shot').critable).toBe(true);
  });

  it('commit-1 neutral defaults reproduce the pre-I6 numbers (byte-identical canary)', () => {
    // might 0 → bare scaling stat; accuracy 0.6 == the retired global
    // hitChanceBase; critBase 0 → luck-only crit. Commit 2 replaces these with
    // the authored per-weapon values (Club +2/40%/0%, Sword +5/60%/5%, …).
    for (const id of ids) {
      const a = abilityConfig(id);
      expect(a.might, `${id}.might`).toBe(0);
      expect(a.critBase, `${id}.critBase`).toBe(0);
      expect(a.accuracy, `${id}.accuracy`).toBe(0.6);
    }
  });
});
