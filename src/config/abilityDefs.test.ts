import { describe, it, expect } from 'vitest';
import { ABILITY_DEFS, abilityDef } from './abilityDefs';

/**
 * Phase Y1 — the loader contract. The shipped `config/abilityDefs.json` parses
 * (it is EMPTY in Y — the catalog fills one verb at a time during the Y3/Y4
 * migration), and the accessor throws loudly on an unknown id.
 */
describe('abilityDefs loader', () => {
  it('parses the shipped config without throwing', () => {
    expect(ABILITY_DEFS).toBeTypeOf('object');
  });

  it('ships an empty catalog in Phase Y (defs land per-verb in Y3/Y4)', () => {
    expect(Object.keys(ABILITY_DEFS)).toHaveLength(0);
  });

  it('throws on an unknown ability id', () => {
    expect(() => abilityDef('nonexistent')).toThrow(/no definition/);
  });
});
