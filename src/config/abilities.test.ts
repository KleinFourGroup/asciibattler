import { describe, it, expect } from 'vitest';
import { ABILITIES, abilityConfig, attackConfig } from './abilities';

/**
 * I6 — the per-ability combat profile + the evadable/critable DESIGNATION
 * system. N1 — these now also pin the `kind` discriminant: the combat profile
 * lives ONLY on `attack`-kind abilities, and `heal` is its own kind with no
 * to-hit/crit fields at all (the dead weight the old single schema forced on
 * it). They pin STRUCTURAL facts — which abilities are attacks, which roll
 * to-hit, which can crit, and that the I6 weapon split/rename landed — NOT the
 * by-feel might/accuracy/critBase VALUES (those are tuned in the editor and
 * re-swept in Phase N, so per BALANCE.md they're deliberately not pinned). The
 * numeric damage/hit/crit FORMULAS are mechanic-pinned with explicit literals
 * in `src/sim/stats.test.ts`.
 */

// kind `attack`, single-target: roll to-hit + can crit. The four melee weapons
// (sword/club/katana/whip, split from the old `melee_strike`), the `bow`
// (renamed `ranged_shot`), and the rogue's `gambit_strike`.
const BASIC_STRIKES = ['sword', 'club', 'katana', 'whip', 'bow', 'gambit_strike'];
// kind `attack`, but unmissable + non-critable: the AoE blast + the artillery shot.
const UNMISSABLE_ATTACKS = ['magic_bolt', 'catapult_shot'];
// kind `heal`: carries no combat profile at all.
const HEAL_ABILITIES = ['heal_ally'];

describe('abilities config — I6 combat profile + N1 kind discriminant', () => {
  const ids = Object.keys(ABILITIES);

  it('every ability declares positive range + cooldown (the common fields)', () => {
    for (const id of ids) {
      const a = abilityConfig(id);
      expect(a.range, `${id}.range`).toBeGreaterThan(0);
      expect(a.cooldownSeconds, `${id}.cooldownSeconds`).toBeGreaterThan(0);
    }
  });

  it('every attack ability declares the full combat profile within range', () => {
    for (const id of [...BASIC_STRIKES, ...UNMISSABLE_ATTACKS]) {
      const a = attackConfig(id);
      expect(a.might, `${id}.might`).toBeGreaterThanOrEqual(0);
      expect(a.accuracy, `${id}.accuracy ≥ 0`).toBeGreaterThanOrEqual(0);
      expect(a.accuracy, `${id}.accuracy ≤ 1`).toBeLessThanOrEqual(1);
      expect(a.critBase, `${id}.critBase ≥ 0`).toBeGreaterThanOrEqual(0);
      expect(a.critBase, `${id}.critBase ≤ 1`).toBeLessThanOrEqual(1);
      expect(typeof a.evadable, `${id}.evadable`).toBe('boolean');
      expect(typeof a.critable, `${id}.critable`).toBe('boolean');
    }
  });

  it('N1 — heal is its own kind, carrying no combat profile', () => {
    for (const id of HEAL_ABILITIES) {
      const a = abilityConfig(id);
      expect(a.kind, `${id}.kind`).toBe('heal');
      // The dead to-hit/crit fields were dropped from the heal schema (zod
      // strips them even if re-added to the JSON), so a heal can't accidentally
      // grow a combat profile it never rolls.
      expect('evadable' in a, `${id} has no evadable`).toBe(false);
      expect('critable' in a, `${id} has no critable`).toBe(false);
      expect('accuracy' in a, `${id} has no accuracy`).toBe(false);
      expect('critBase' in a, `${id} has no critBase`).toBe(false);
    }
  });

  it('every attack ability declares kind "attack"', () => {
    for (const id of [...BASIC_STRIKES, ...UNMISSABLE_ATTACKS]) {
      expect(abilityConfig(id).kind, id).toBe('attack');
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
    for (const id of BASIC_STRIKES) expect(attackConfig(id).evadable, id).toBe(true);
    // ...the AoE blast / artillery shot are unmissable (dodged positionally or
    // not at all — the I2 carve-out, now in config). A heal isn't an attack kind
    // at all, so it has no evadable flag to roll (asserted above).
    for (const id of UNMISSABLE_ATTACKS) expect(attackConfig(id).evadable, id).toBe(false);
  });

  it('critable gate: the strikes crit; (I6 commit 2) the mage bolt & catapult do NOT', () => {
    for (const id of BASIC_STRIKES) expect(attackConfig(id).critable, id).toBe(true);
    // I6 commit 2 (user call): area-denial / artillery no longer crit, even
    // though pre-I6 they rolled a luck-based crit.
    for (const id of UNMISSABLE_ATTACKS) expect(attackConfig(id).critable, id).toBe(false);
  });
});
