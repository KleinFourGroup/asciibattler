import { describe, it, expect } from 'vitest';
import { RNG } from '../core/RNG';
import { rollUnit } from '../sim/archetypes';
import { abilityDetailParts } from './abilityDetail';
import { damageOpOf } from '../config/abilities';
import { hitChanceFor, critChanceFor } from '../sim/stats';
import type { Archetype } from '../sim/Unit';

/**
 * 34b — the §29 archetypes (afflicters / summoner / chain caster) used to render
 * a blank UnitCard ability-detail row because the builder only handled heal/damage
 * ops. These pin a NON-blank, op-appropriate readout for every new op kind. They
 * read the shipped `config/abilities.json` (the wording is config-derived), and
 * assert STRUCTURE (labels, op routing, riders) rather than balance arithmetic —
 * damage magnitudes are matched as `/\d+ dmg/`, never a hand-computed number.
 */
function partsFor(archetype: Archetype, id: string): string[] {
  const u = rollUnit(archetype, new RNG(1));
  return abilityDetailParts(id, archetype, u.stats);
}

describe('abilityDetailParts (34b — every §29 op kind renders a non-blank detail)', () => {
  it('a summoner shows what it raises, not a "dash" (raise_dead is self-anchored)', () => {
    const text = partsFor('shaman', 'raise_dead').join(' · ');
    expect(text).toContain('summons ghoul');
    expect(text).not.toContain('dash'); // the old self-target branch mislabelled it
  });

  it('a pure afflicter shows the status it applies (hex / wail)', () => {
    expect(partsFor('warlock', 'hex').join(' · ')).toContain('applies confusion');
    expect(partsFor('banshee', 'wail').join(' · ')).toContain('applies panic');
  });

  it('a chain caster surfaces the nested bolt damage + jump count (chain_lightning)', () => {
    const text = partsFor('stormcaller', 'chain_lightning').join(' · ');
    expect(text).toMatch(/\d+ dmg/); // damage is nested in the chain's inner ops
    expect(text).toContain('chains 3');
  });

  it('a damage afflicter surfaces its status rider on top of the hit (cleaver / vial)', () => {
    const cleaver = partsFor('reaver', 'cleaver').join(' · ');
    expect(cleaver).toMatch(/\d+ dmg/);
    expect(cleaver).toContain('+bleed');
    expect(partsFor('corrupter', 'vial').join(' · ')).toContain('+poison');
  });

  it('preserves the existing heal / damage / dash readouts', () => {
    expect(partsFor('healer', 'heal_ally').join(' · ')).toContain('heal');
    expect(partsFor('mercenary', 'sword').join(' · ')).toMatch(/\d+ dmg/);
    expect(partsFor('rogue', 'dash').join(' · ')).toContain('dash');
  });

  it('hit/crit derive from the UNIT (51f — precision/luck fold in, the damage-number convention)', () => {
    // Expectations run THROUGH the same sim helpers the readout uses
    // (balance-proof: no hand-computed arithmetic; floors/caps inherited).
    const op = damageOpOf('sword')!;
    expect(op.evadable).toBe(true); // pin the shipped profile the test rides on
    expect(op.critable).toBe(true);
    const base = rollUnit('mercenary', new RNG(1)).stats;
    const sharp = { ...base, precision: base.precision + 3, luck: base.luck + 3 };
    for (const stats of [base, sharp]) {
      const text = abilityDetailParts('sword', 'mercenary', stats).join(' · ');
      expect(text).toContain(
        `${Math.round(hitChanceFor(op.accuracy, stats.precision, 0) * 100)}% hit`,
      );
      expect(text).toContain(`${Math.round(critChanceFor(op.critBase, stats.luck) * 100)}% crit`);
    }
  });

  it('no §29 archetype ability renders a blank detail', () => {
    const cases: [Archetype, string][] = [
      ['reaver', 'cleaver'],
      ['corrupter', 'vial'],
      ['ice_mage', 'ice_storm'],
      ['warlock', 'hex'],
      ['luminant', 'light_ray'],
      ['banshee', 'wail'],
      ['stormcaller', 'chain_lightning'],
      ['shaman', 'raise_dead'],
    ];
    for (const [archetype, id] of cases) {
      expect(partsFor(archetype, id).length, `${id} detail must not be blank`).toBeGreaterThan(0);
    }
  });
});
