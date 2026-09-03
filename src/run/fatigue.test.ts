import { describe, it, expect } from 'vitest';
import { fatigueEffect, FATIGUE_KEY } from './fatigue';
import { foldEffects } from '../sim/statusEffects';
import { deriveStats } from '../sim/stats';
import { Unit } from '../sim/Unit';
import type { UnitStats } from '../sim/Unit';
import { HEALTH } from '../config/health';
import { STATS } from '../config/stats';

function withConstitution(constitution: number, power = 10): UnitStats {
  return {
    constitution,
    strength: 0,
    ranged: 0,
    magic: 0,
    luck: 0,
    defense: 0,
    precision: 0,
    evasion: 0,
    speed: 0,
    mobility: 0,
    power,
  };
}

describe('fatigueEffect (H6c → K1 → §91c: a constitution debuff)', () => {
  it('ships INERT: the default rate seeds NO effect for any stack count', () => {
    // Config-derived inert proof — `fatigueEffect` (no rate arg) reads the
    // shipped HEALTH.fatiguePerStack. Passes iff the default is 0 → null; the
    // canary if a balance pass ever turns fatigue on (the §92 switch-on flips
    // this pin deliberately, as its own paired read).
    for (const stacks of [0, 1, 3, 10, 100]) {
      expect(fatigueEffect(stacks)).toBeNull();
    }
  });

  it('seeds no effect at 0 stacks even at a positive rate (a debut unit)', () => {
    expect(fatigueEffect(0, 0.1)).toBeNull();
  });

  it('reduces effective CONSTITUTION by (1 − rate·stacks) at a positive rate (the curve)', () => {
    const e = fatigueEffect(2, 0.1)!;
    expect(e.key).toBe(FATIGUE_KEY);
    expect(e.magnitude).toBe(2);
    // Folded onto a base constitution of 10 → 10 × (1 − 0.1·2) = 8.
    expect(foldEffects(withConstitution(10), [e]).constitution).toBe(8);
  });

  it('leaves power UNTOUCHED — a tired unit is not cheaper to lose (the §91c retarget)', () => {
    const e = fatigueEffect(3, 0.1)!;
    const folded = foldEffects(withConstitution(10, 7), [e]);
    expect(folded.power).toBe(7);
    expect(Object.keys(e.mods)).toEqual(['constitution']);
  });

  it('lowers starting HP through deriveStats (config-derived hpPerConstitution)', () => {
    const base = withConstitution(10);
    const folded = foldEffects(base, [fatigueEffect(2, 0.1)!]);
    const expectedMaxHp = Math.max(1, Math.round(STATS.hpPerConstitution * folded.constitution));
    expect(deriveStats(folded, 1).maxHp).toBe(expectedMaxHp);
    expect(deriveStats(folded, 1).maxHp).toBeLessThan(deriveStats(base, 1).maxHp);
  });

  it('clamps the stack count at the shipped fatigueMaxStacks (the spec cap)', () => {
    // Magnitude tracks stacks up to the cap, then holds — the debuff is flat past it.
    const cap = HEALTH.fatigueMaxStacks;
    expect(cap).toBeGreaterThan(0);
    for (let s = 1; s <= cap; s++) expect(fatigueEffect(s, 0.1)!.magnitude).toBe(s);
    for (const s of [cap + 1, cap * 2, 100]) expect(fatigueEffect(s, 0.1)!.magnitude).toBe(cap);
    // The total debuff at the cap is rate × maxStacks; at the spec's designed
    // −10%/stack (the §92 switch-on value) that is the documented −50%.
    const atCap = foldEffects(withConstitution(100), [fatigueEffect(100, 0.1)!]).constitution;
    expect(atCap).toBe(Math.round(100 * (1 - 0.1 * cap)));
    expect(atCap).toBe(50);
  });

  it('honours an explicit maxStacks (the test-injection seam)', () => {
    expect(fatigueEffect(10, 0.1, 3)!.magnitude).toBe(3);
    expect(fatigueEffect(2, 0.1, 3)!.magnitude).toBe(2);
  });

  it('is monotone non-increasing in stacks and never drives constitution below 0', () => {
    let prev = Infinity;
    for (let s = 1; s <= 20; s++) {
      // An uncapped rate that would cross zero if the stack clamp were missing.
      const e = fatigueEffect(s, 0.3, 100);
      const con = e ? foldEffects(withConstitution(100), [e]).constitution : 100;
      expect(con).toBeLessThanOrEqual(prev);
      expect(con).toBeGreaterThanOrEqual(0);
      prev = con;
    }
    // 1 − 0.3·20 = −5 → effective constitution clamped to 0 by the fold.
    expect(foldEffects(withConstitution(100), [fatigueEffect(20, 0.3, 100)!]).constitution).toBe(0);
  });

  it('a Unit seeded with the production effect spawns AT its reduced maxHp, never over it', () => {
    // The clamp the K1 constructor comment deferred — landed at §91c. The
    // expectation is re-derived from the fold + deriveStats, not from Unit.
    const stats = withConstitution(20);
    const effect = fatigueEffect(2, 0.1)!;
    const unit = new Unit({
      id: 1,
      team: 'player',
      archetype: 'mercenary',
      glyph: 'M',
      stats,
      derived: deriveStats(stats, 1),
      position: { x: 0, y: 0 },
      effects: [effect],
    });
    const expectedMaxHp = deriveStats(foldEffects(stats, [effect]), 1).maxHp;
    expect(unit.derived.maxHp).toBe(expectedMaxHp);
    expect(expectedMaxHp).toBeLessThan(deriveStats(stats, 1).maxHp);
    expect(unit.currentHp).toBe(expectedMaxHp);
  });
});
