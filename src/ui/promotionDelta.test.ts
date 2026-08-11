import { describe, it, expect } from 'vitest';
import { RNG } from '../core/RNG';
import { rollUnit } from '../sim/archetypes';
import { promotionDeltaParts } from './promotionDelta';
import { abilityDef, damageOpOf } from '../config/abilities';
import {
  attackCooldownTicksFor,
  critChanceFor,
  deriveStats,
  hitChanceFor,
} from '../sim/stats';
import { ticksToSeconds } from '../config';
import type { UnitStats } from '../sim/Unit';

/**
 * §76g — the promotion derived-delta lines. Balance-proof by construction:
 * every expected number runs THROUGH the same sim helpers the builder uses
 * (deriveStats / hitChanceFor / critChanceFor / attackCooldownTicksFor), so
 * config re-tunes can't strand a hand-computed literal. Structure (labels,
 * only-if-changed, the → arrow) is what's pinned.
 */

const base = rollUnit('mercenary', new RNG(1)).stats;
const bump = (over: Partial<UnitStats>): UnitStats => ({ ...base, ...over });

describe('promotionDeltaParts (§76g — derived deltas, only-if-changed)', () => {
  it('identical stats produce no lines', () => {
    expect(promotionDeltaParts(base, base, 'mercenary')).toEqual([]);
  });

  it('a power-only gain produces no lines (POW is raw — the +N chip already covers it)', () => {
    const grown = bump({ power: base.power + 2 });
    expect(promotionDeltaParts(base, grown, 'mercenary')).toEqual([]);
  });

  it('a constitution gain shows the Max HP delta (via deriveStats)', () => {
    const grown = bump({ constitution: base.constitution + 3 });
    const lines = promotionDeltaParts(base, grown, 'mercenary');
    expect(lines).toContain(
      `Max HP ${deriveStats(base, 0).maxHp} → ${deriveStats(grown, 0).maxHp}`,
    );
  });

  it('an evasion gain shows the Dodge delta (vs the 0.6-accuracy reference attacker)', () => {
    const grown = bump({ evasion: base.evasion + 2 });
    const lines = promotionDeltaParts(base, grown, 'mercenary');
    const dodge = (s: UnitStats) => Math.round((1 - hitChanceFor(0.6, 0, s.evasion)) * 100);
    expect(lines).toContain(`Dodge ${dodge(base)}% → ${dodge(grown)}%`);
  });

  it('a mobility gain shows the Move cadence delta in seconds', () => {
    const grown = bump({ mobility: base.mobility + 2 });
    const lines = promotionDeltaParts(base, grown, 'mercenary');
    const cad = (s: UnitStats) =>
      ticksToSeconds(deriveStats(s, 0).moveCooldownTicks).toFixed(2);
    expect(lines).toContain(`Move cadence ${cad(base)}s → ${cad(grown)}s`);
  });

  it('a strength gain shows the per-ability damage delta under the ability name', () => {
    const grown = bump({ strength: base.strength + 2 });
    const lines = promotionDeltaParts(base, grown, 'mercenary');
    const sword = lines.find((l) => l.startsWith(`${abilityDef('sword').name}:`));
    expect(sword).toBeDefined();
    const might = damageOpOf('sword')!.might;
    expect(sword).toContain(`${might + base.strength} dmg → ${might + grown.strength} dmg`);
  });

  it('precision/luck gains show hit/crit deltas through the real sim curves', () => {
    const op = damageOpOf('sword')!;
    expect(op.evadable).toBe(true); // pin the shipped profile the test rides on
    expect(op.critable).toBe(true);
    const grown = bump({ precision: base.precision + 3, luck: base.luck + 3 });
    const line = promotionDeltaParts(base, grown, 'mercenary').find((l) =>
      l.startsWith(`${abilityDef('sword').name}:`),
    )!;
    const hit = (s: UnitStats) => Math.round(hitChanceFor(op.accuracy, s.precision, 0) * 100);
    const crit = (s: UnitStats) => Math.round(critChanceFor(op.critBase, s.luck) * 100);
    expect(line).toContain(`${hit(base)}% hit → ${hit(grown)}% hit`);
    expect(line).toContain(`${crit(base)}% crit → ${crit(grown)}% crit`);
  });

  it('a speed gain shows the ability cadence delta (speed-scaled cooldown)', () => {
    const grown = bump({ speed: base.speed + 3 });
    const def = abilityDef('sword');
    const cad = (s: UnitStats) =>
      ticksToSeconds(attackCooldownTicksFor(def.cooldownSeconds, s.speed)).toFixed(2);
    // Guard the premise: +3 speed must actually move the tick count at current
    // config; if a re-tune makes it sub-tick this test's subject vanishes.
    expect(cad(base)).not.toBe(cad(grown));
    const line = promotionDeltaParts(base, grown, 'mercenary').find((l) =>
      l.startsWith(`${def.name}:`),
    )!;
    expect(line).toContain(`cadence ${cad(base)}s → ${cad(grown)}s`);
  });

  it('stat-independent parts (rng) never emit a delta row', () => {
    const grown = bump({
      constitution: base.constitution + 3,
      strength: base.strength + 3,
      precision: base.precision + 3,
      luck: base.luck + 3,
      speed: base.speed + 3,
      mobility: base.mobility + 3,
      evasion: base.evasion + 3,
    });
    for (const line of promotionDeltaParts(base, grown, 'mercenary')) {
      expect(line).not.toContain('rng');
    }
  });

  it('a magic gain shows the heal delta for a healer (op routing rides abilityDetailParts)', () => {
    const healerBase = rollUnit('healer', new RNG(1)).stats;
    const grown = { ...healerBase, magic: healerBase.magic + 2 };
    const lines = promotionDeltaParts(healerBase, grown, 'healer');
    const heal = lines.find((l) => l.startsWith(`${abilityDef('heal_ally').name}:`));
    expect(heal).toBeDefined();
    expect(heal).toMatch(/\d+ heal → \d+ heal/);
  });
});
