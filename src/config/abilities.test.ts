import { describe, it, expect } from 'vitest';
import { ABILITY_DEFS, abilityDef, damageOpOf, healOpOf } from './abilities';

/**
 * The ability-definition catalog loader + the catalog-level structural pins.
 *
 * Loader contract: the shipped `config/abilities.json` parses, every entry is
 * keyed by its own id, and the accessor throws loudly on an unknown id.
 *
 * Structural pins (ported from the retired legacy `abilities.ts` test at Y5e,
 * re-expressed on the `AbilityDef` shape): WHICH verbs roll to-hit, WHICH can
 * crit, that the heal carries no combat profile, and that the I6 weapon
 * split/rename landed. They pin STRUCTURE — not the by-feel might/accuracy/
 * critBase VALUES (tuned in the editor + re-swept in Phase N; per BALANCE.md
 * deliberately not pinned). The numeric formulas are mechanic-pinned with
 * explicit literals in `src/sim/stats.test.ts`.
 */

// Single-target damage verbs: roll precision-vs-evasion to-hit + can crit. The
// four melee weapons (sword/club/katana/whip, split from the old `melee_strike`),
// the `bow` (renamed `ranged_shot`), and the rogue's `gambit_strike`.
const BASIC_STRIKES = ['sword', 'club', 'katana', 'whip', 'bow', 'gambit_strike'];
// Damage verbs that are unmissable + non-critable: the AoE blast + the artillery shot.
const UNMISSABLE_ATTACKS = ['magic_bolt', 'catapult_shot'];
// The heal verb: a heal op, no combat profile.
const HEAL_ABILITIES = ['heal_ally'];

describe('abilities loader', () => {
  it('parses the shipped config without throwing', () => {
    expect(ABILITY_DEFS).toBeTypeOf('object');
  });

  it('keys every entry by its own id (the loader invariant)', () => {
    for (const [key, def] of Object.entries(ABILITY_DEFS)) {
      expect(def.id).toBe(key);
    }
  });

  it('throws on an unknown ability id', () => {
    expect(() => abilityDef('nonexistent')).toThrow(/no definition/);
  });

  it('every ability declares a positive cooldown', () => {
    for (const id of Object.keys(ABILITY_DEFS)) {
      expect(abilityDef(id).cooldownSeconds, `${id}.cooldownSeconds`).toBeGreaterThan(0);
    }
  });
});

describe('abilities catalog — combat profile + verb shapes', () => {
  it('the migrated melee verbs resolve as enemyInRange damage defs', () => {
    for (const id of ['sword', 'club', 'katana', 'whip']) {
      expect(abilityDef(id).target.kind).toBe('enemyInRange');
      expect(damageOpOf(id), `${id} has a damage op`).toBeDefined();
    }
  });

  it('every damage verb declares the full combat profile in range', () => {
    for (const id of [...BASIC_STRIKES, ...UNMISSABLE_ATTACKS]) {
      const op = damageOpOf(id);
      expect(op, `${id} has a damage op`).toBeDefined();
      expect(op!.might, `${id}.might`).toBeGreaterThanOrEqual(0);
      expect(op!.accuracy, `${id}.accuracy ≥ 0`).toBeGreaterThanOrEqual(0);
      expect(op!.accuracy, `${id}.accuracy ≤ 1`).toBeLessThanOrEqual(1);
      expect(op!.critBase, `${id}.critBase ≥ 0`).toBeGreaterThanOrEqual(0);
      expect(op!.critBase, `${id}.critBase ≤ 1`).toBeLessThanOrEqual(1);
      expect(typeof op!.evadable, `${id}.evadable`).toBe('boolean');
      expect(typeof op!.critable, `${id}.critable`).toBe('boolean');
    }
  });

  it('the heal verb carries a heal op + no damage profile', () => {
    for (const id of HEAL_ABILITIES) {
      expect(abilityDef(id).target.kind).toBe('lowestHpAlly');
      expect(healOpOf(id), `${id} has a heal op`).toBeDefined();
      // A heal never rolls to-hit/crit: it has no damage op at all (so no
      // accuracy/critBase/evadable/critable to accidentally grow).
      expect(damageOpOf(id), `${id} has no damage op`).toBeUndefined();
    }
  });

  it('evadable gate = the single-target strikes (the I2 carve-out, in data)', () => {
    for (const id of BASIC_STRIKES) expect(damageOpOf(id)!.evadable, id).toBe(true);
    // The AoE blast / artillery shot are unmissable (dodged positionally or not at all).
    for (const id of UNMISSABLE_ATTACKS) expect(damageOpOf(id)!.evadable, id).toBe(false);
  });

  it('critable gate: the strikes crit; the mage bolt & catapult do NOT', () => {
    for (const id of BASIC_STRIKES) expect(damageOpOf(id)!.critable, id).toBe(true);
    for (const id of UNMISSABLE_ATTACKS) expect(damageOpOf(id)!.critable, id).toBe(false);
  });

  it('I6 split/renamed the basic-strike ids', () => {
    const ids = Object.keys(ABILITY_DEFS);
    expect(ids).not.toContain('melee_strike');
    expect(ids).not.toContain('ranged_shot');
    for (const id of BASIC_STRIKES) expect(ids, `${id} registered`).toContain(id);
  });
});
