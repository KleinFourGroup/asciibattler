import { describe, it, expect } from 'vitest';
import type { UnitStats } from './Unit';
import {
  foldEffects,
  combineMagnitude,
  cloneEffect,
  type StatusEffect,
} from './statusEffects';

// Explicit literal base block (primitive test — never reads shipped config).
function base(overrides: Partial<UnitStats> = {}): UnitStats {
  return {
    constitution: 20,
    strength: 5,
    ranged: 4,
    magic: 6,
    luck: 3,
    defense: 2,
    precision: 5,
    evasion: 5,
    speed: 5,
    mobility: 3,
    power: 10,
    ...overrides,
  };
}

function effect(over: Partial<StatusEffect> & Pick<StatusEffect, 'mods'>): StatusEffect {
  return { key: 'test', magnitude: 1, lifetime: { kind: 'endOfTurn' }, merge: 'replace', ...over };
}

describe('foldEffects', () => {
  it('returns the base object itself when there are no effects (identity fast path)', () => {
    const b = base();
    expect(foldEffects(b, [])).toBe(b);
  });

  it('applies an additive modifier scaled by magnitude', () => {
    const out = foldEffects(base(), [effect({ magnitude: 3, mods: { strength: { add: 1 } } })]);
    expect(out.strength).toBe(8); // 5 + 1*3
    expect(out.ranged).toBe(4); // untouched stats keep base
  });

  it('applies a multiplicative modifier', () => {
    const out = foldEffects(base({ power: 10 }), [effect({ mods: { power: { mul: 0.5 } } })]);
    expect(out.power).toBe(5); // round(10 * 0.5)
  });

  it('recovers the exact fatigue curve (mul delta scales linearly with magnitude)', () => {
    // Fatigued: power × (1 − rate·stacks). rate 0.1, stacks 2 → ×0.8.
    const rate = 0.1;
    const out = foldEffects(base({ power: 10 }), [
      effect({ magnitude: 2, merge: 'add', mods: { power: { mul: 1 - rate } } }),
    ]);
    expect(out.power).toBe(Math.round(10 * (1 - rate * 2))); // = 8
  });

  it('is inert at magnitude 0 / rate 0 (the default-fatigue no-op)', () => {
    const out = foldEffects(base({ power: 10 }), [
      effect({ magnitude: 5, mods: { power: { mul: 1 - 0 } } }),
    ]);
    expect(out.power).toBe(10);
  });

  it('multiplies multiplicative modifiers across separate instances', () => {
    const out = foldEffects(base({ power: 100 }), [
      effect({ key: 'a', mods: { power: { mul: 0.9 } } }),
      effect({ key: 'b', mods: { power: { mul: 0.9 } } }),
    ]);
    expect(out.power).toBe(81); // round(100 * 0.9 * 0.9)
  });

  it('combines add then mul: (base + Σadd) × Πmul', () => {
    const out = foldEffects(base({ strength: 5 }), [
      effect({ key: 'a', mods: { strength: { add: 5 } } }),
      effect({ key: 'b', mods: { strength: { mul: 2 } } }),
    ]);
    expect(out.strength).toBe(20); // (5 + 5) * 2
  });

  it('clamps non-negative stats at 0 but leaves signed mobility negative', () => {
    const out = foldEffects(base({ strength: 5, mobility: 3 }), [
      effect({ key: 'a', mods: { strength: { add: -100 } } }),
      effect({ key: 'b', mods: { mobility: { add: -100 } } }),
    ]);
    expect(out.strength).toBe(0); // clamped
    expect(out.mobility).toBe(-97); // signed — not clamped
  });

  it('does not mutate the base block', () => {
    const b = base();
    foldEffects(b, [effect({ mods: { strength: { add: 99 } } })]);
    expect(b.strength).toBe(5);
  });
});

describe('combineMagnitude', () => {
  it('replace takes the incoming magnitude', () => {
    expect(combineMagnitude('replace', 2, 5)).toBe(5);
  });
  it('add sums magnitudes (the fatigue stack)', () => {
    expect(combineMagnitude('add', 2, 5)).toBe(7);
  });
  it('multiply multiplies magnitudes', () => {
    expect(combineMagnitude('multiply', 2, 5)).toBe(10);
  });
  it('independent returns the incoming magnitude (no merge)', () => {
    expect(combineMagnitude('independent', 2, 5)).toBe(5);
  });
});

describe('cloneEffect', () => {
  it('deep-copies mods + lifetime so the clone is independent', () => {
    const original = effect({
      key: 'k',
      magnitude: 2,
      lifetime: { kind: 'ticks', expiresAtTick: 40 },
      mods: { strength: { add: 1 }, power: { mul: 0.9 } },
    });
    const copy = cloneEffect(original);
    expect(copy).toEqual(original);
    copy.mods.strength!.add = 99;
    (copy.lifetime as { expiresAtTick: number }).expiresAtTick = 1;
    expect(original.mods.strength!.add).toBe(1);
    expect((original.lifetime as { expiresAtTick: number }).expiresAtTick).toBe(40);
  });
});
