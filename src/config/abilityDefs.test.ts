import { describe, it, expect } from 'vitest';
import { ABILITY_DEFS, abilityDef } from './abilityDefs';

/**
 * Phase Y1 — the loader contract. The shipped `config/abilityDefs.json` parses,
 * every entry is keyed by its own id, and the accessor throws loudly on an
 * unknown id. The catalog fills one verb at a time across the Y3/Y4 migration;
 * this guards the loader, not the per-verb content (the oracle in
 * tests/integration/effectMigration.test.ts proves each verb byte-identical).
 */
describe('abilityDefs loader', () => {
  it('parses the shipped config without throwing', () => {
    expect(ABILITY_DEFS).toBeTypeOf('object');
  });

  it('keys every entry by its own id (the loader invariant)', () => {
    for (const [key, def] of Object.entries(ABILITY_DEFS)) {
      expect(def.id).toBe(key);
    }
  });

  it('Y3: the migrated melee verbs resolve as enemyInRange damage defs', () => {
    for (const id of ['sword', 'club', 'katana', 'whip']) {
      const def = abilityDef(id);
      expect(def.target.kind).toBe('enemyInRange');
      expect(def.effects.some((e) => e.op.kind === 'damage')).toBe(true);
    }
  });

  it('throws on an unknown ability id', () => {
    expect(() => abilityDef('nonexistent')).toThrow(/no definition/);
  });
});
