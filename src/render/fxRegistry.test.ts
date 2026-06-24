import { describe, it, expect } from 'vitest';
import { assertFxKeysResolve, fxDescriptor, FX_REGISTRY } from './fxRegistry';
import { ABILITY_DEFS } from '../config/abilities';

/**
 * Phase Z — the FX registry is pure data (no three.js), so its resolution + the
 * boot assert are headless-testable; only the on-screen pixels are eyeballed.
 */

describe('fxRegistry — resolution', () => {
  it('resolves a known key to its channel set; unknown keys are undefined', () => {
    expect(fxDescriptor('magic_bolt_launch')).toEqual({ projectile: { style: 'straight' } });
    expect(fxDescriptor('magic_bolt_burst')).toMatchObject({ burst: { style: 'explosion' }, sound: 'magicboom' });
    expect(fxDescriptor('catapult_launch')).toEqual({ projectile: { style: 'arc' } });
    expect(fxDescriptor('catapult_burst')).toMatchObject({ burst: { style: 'dud' }, sound: 'shoot' });
    expect(fxDescriptor('no_such_key')).toBeUndefined();
  });
});

describe('fxRegistry — Z3 strike cues', () => {
  it('the melee swing key carries a shove + the melee whoosh', () => {
    expect(fxDescriptor('melee_swing')).toMatchObject({ shove: {}, sound: 'melee' });
  });

  it('the ranged shot key carries a tracer + the shoot whoosh', () => {
    expect(fxDescriptor('ranged_shot')).toMatchObject({ tracer: {}, sound: 'shoot' });
  });
});

describe('fxRegistry — Z2 camera shake', () => {
  it('the impact burst keys carry an authored shake, catapult heavier than the bolt', () => {
    const mage = fxDescriptor('magic_bolt_burst');
    const cat = fxDescriptor('catapult_burst');
    expect(mage?.shake?.intensity).toBeGreaterThan(0);
    expect(cat?.shake?.intensity).toBeGreaterThan(0);
    expect(cat!.shake!.intensity).toBeGreaterThan(mage!.shake!.intensity);
    expect(cat!.shake!.durationSeconds).toBeGreaterThan(0);
  });
});

describe('fxRegistry — boot assert', () => {
  it('passes for the shipped ability catalog (every fx key resolves)', () => {
    expect(() => assertFxKeysResolve(ABILITY_DEFS)).not.toThrow();
  });

  it('throws naming the def, phase, and key when a def references an unknown FxKey', () => {
    const bad = {
      catapult_shot: { ...ABILITY_DEFS.catapult_shot!, fx: { impact: 'no_such_key' } },
    };
    expect(() => assertFxKeysResolve(bad)).toThrow(
      /ability 'catapult_shot' phase 'impact' references unknown FxKey 'no_such_key'/,
    );
  });

  it('tolerates a def with no fx block', () => {
    const noFx = { sword: { ...ABILITY_DEFS.sword!, fx: undefined } };
    expect(() => assertFxKeysResolve(noFx)).not.toThrow();
  });
});

describe('fxRegistry — the Z1 re-home (config-derived)', () => {
  it('the mage + catapult defs carry release+impact fx keys that resolve', () => {
    expect(ABILITY_DEFS.magic_bolt!.fx).toEqual({
      release: 'magic_bolt_launch',
      impact: 'magic_bolt_burst',
    });
    expect(ABILITY_DEFS.catapult_shot!.fx).toEqual({
      release: 'catapult_launch',
      impact: 'catapult_burst',
    });
    for (const key of Object.values(ABILITY_DEFS.magic_bolt!.fx ?? {})) {
      expect(key !== undefined && key in FX_REGISTRY).toBe(true);
    }
  });
});

describe('fxRegistry — the Z3 re-home (config-derived)', () => {
  // The four melee weapons + the rogue gambit all swing; the gambit authors it
  // on `windup` (where it deals damage) instead of `impact`. Deriving the
  // expectations from the def keeps the test honest if a weapon is retuned.
  it('every melee weapon strikes with the shared melee_swing key on impact', () => {
    for (const id of ['sword', 'club', 'katana', 'whip']) {
      expect(ABILITY_DEFS[id]!.fx).toEqual({ impact: 'melee_swing' });
    }
  });

  it('the gambit swings on windup (where it deals its damage)', () => {
    expect(ABILITY_DEFS.gambit_strike!.fx).toEqual({ windup: 'melee_swing' });
  });

  it('the bow flies the ranged_shot tracer on impact', () => {
    expect(ABILITY_DEFS.bow!.fx).toEqual({ impact: 'ranged_shot' });
  });

  it('every strike-cue key the defs reference resolves in the registry', () => {
    for (const id of ['sword', 'club', 'katana', 'whip', 'gambit_strike', 'bow']) {
      for (const key of Object.values(ABILITY_DEFS[id]!.fx ?? {})) {
        expect(key !== undefined && key in FX_REGISTRY).toBe(true);
      }
    }
  });
});
