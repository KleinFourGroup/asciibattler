import { describe, it, expect } from 'vitest';
import { Unit } from './Unit';
import type { UnitStats } from './Unit';
import { deriveStats } from './stats';
import type { StatusEffect } from './statusEffects';

const STATS: UnitStats = {
  constitution: 20,
  strength: 8,
  ranged: 0,
  magic: 0,
  luck: 3,
  defense: 0,
  precision: 5,
  evasion: 5,
  speed: 5,
  mobility: 6,
  power: 10,
};

function makeUnit(over: { stats?: UnitStats; effects?: StatusEffect[] } = {}): Unit {
  const stats = over.stats ?? STATS;
  return new Unit({
    id: 1,
    team: 'player',
    archetype: 'mercenary',
    glyph: 'M',
    stats,
    derived: deriveStats(stats, 1),
    position: { x: 0, y: 0 },
    ...(over.effects ? { effects: over.effects } : {}),
  });
}

function eff(over: Partial<StatusEffect> & Pick<StatusEffect, 'mods'>): StatusEffect {
  return { key: 'test', magnitude: 1, lifetime: { kind: 'endOfTurn' }, merge: 'replace', ...over };
}

describe('Unit', () => {
  it('initializes currentHp to derived.maxHp', () => {
    const derived = deriveStats(STATS, 1);
    const u = makeUnit();
    expect(u.id).toBe(1);
    expect(u.team).toBe('player');
    expect(u.archetype).toBe('mercenary');
    expect(u.glyph).toBe('M');
    expect(u.currentHp).toBe(derived.maxHp);
    expect(u.position).toEqual({ x: 0, y: 0 });
    expect(u.behaviors).toEqual([]);
  });
});

describe('Unit status effects', () => {
  it('effectiveStats is the base block itself when there are no effects', () => {
    const u = makeUnit();
    expect(u.effectiveStats).toBe(u.stats);
    expect(u.effects).toEqual([]);
  });

  it('addEffect folds into effectiveStats without mutating base stats', () => {
    const u = makeUnit();
    u.addEffect(eff({ key: 'empowered', magnitude: 3, mods: { strength: { add: 1 } } }));
    expect(u.effectiveStats.strength).toBe(11); // 8 + 3
    expect(u.stats.strength).toBe(8); // base untouched
    expect(u.effectiveStats).not.toBe(u.stats);
  });

  it('merge=add stacks magnitude on a repeated key', () => {
    const u = makeUnit();
    const fatigued = eff({ key: 'fatigued', merge: 'add', mods: { power: { mul: 0.9 } } });
    u.addEffect(fatigued);
    u.addEffect(fatigued);
    expect(u.effects).toHaveLength(1);
    expect(u.effects[0]!.magnitude).toBe(2);
    expect(u.effectiveStats.power).toBe(8); // round(10 * (1 - 0.1*2))
  });

  it('merge=replace overwrites magnitude; independent keeps separate instances', () => {
    const u = makeUnit();
    u.addEffect(eff({ key: 'buff', magnitude: 2, merge: 'replace', mods: { strength: { add: 1 } } }));
    u.addEffect(eff({ key: 'buff', magnitude: 5, merge: 'replace', mods: { strength: { add: 1 } } }));
    expect(u.effects).toHaveLength(1);
    expect(u.effectiveStats.strength).toBe(13); // 8 + 5 (replaced)

    const u2 = makeUnit();
    const ind = eff({ key: 'ind', merge: 'independent', mods: { strength: { add: 2 } } });
    u2.addEffect(ind);
    u2.addEffect(ind);
    expect(u2.effects).toHaveLength(2);
    expect(u2.effectiveStats.strength).toBe(12); // 8 + 2 + 2
  });

  it('expireEffects removes a ticks effect at its expiry and restores the base identity', () => {
    const u = makeUnit();
    u.addEffect(eff({ lifetime: { kind: 'ticks', expiresAtTick: 10 }, mods: { speed: { add: 3 } } }));
    expect(u.effectiveStats.speed).toBe(8);
    u.expireEffects(9); // not yet
    expect(u.effects).toHaveLength(1);
    u.expireEffects(10); // reached
    expect(u.effects).toHaveLength(0);
    expect(u.effectiveStats).toBe(u.stats); // back to identity fast path
  });

  it('expireEffects never removes an endOfTurn effect', () => {
    const u = makeUnit();
    u.addEffect(eff({ lifetime: { kind: 'endOfTurn' }, mods: { speed: { add: 3 } } }));
    u.expireEffects(99999);
    expect(u.effects).toHaveLength(1);
  });

  it('seeds effects passed at construction', () => {
    const u = makeUnit({ effects: [eff({ magnitude: 2, mods: { strength: { add: 1 } } })] });
    expect(u.effectiveStats.strength).toBe(10); // 8 + 2
  });

  it('refreshDerived recomputes maxHp when an effect modifies constitution (the deferred-consumer seam)', () => {
    // No K1 effect ships a constitution mod, but the recompute path is wired:
    // a +constitution effect must raise derived.maxHp. (currentHp clamp on a
    // maxHp DROP is the deferred policy — only a +CON is exercised here.)
    const u = makeUnit();
    const baseMax = u.derived.maxHp;
    u.addEffect(eff({ magnitude: 5, mods: { constitution: { add: 1 } } }));
    expect(u.effectiveStats.constitution).toBe(25); // 20 + 5
    expect(u.derived.maxHp).toBeGreaterThan(baseMax);
  });
});
