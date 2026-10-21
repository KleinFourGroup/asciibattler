import { describe, it, expect } from 'vitest';
import { RNG } from '../core/RNG';
import { rollUnit } from '../sim/archetypes';
import { abilityDetailParts, abilityDetailPartsForDef } from './abilityDetail';
import { ABILITY_DEFS, damageOpOf } from '../config/abilities';
import { parseAbilityDef } from '../sim/effects/schema';
import { hitChanceFor, critChanceFor } from '../sim/stats';
import type { Archetype, UnitStats } from '../sim/Unit';
import { UNIT_DEFS } from '../config/units';
import abilitiesJson from '../../config/abilities.json';

/**
 * The afflicters', the summoner's and the chain caster's abilities have ops
 * besides heal and damage, and a builder that read only those two would leave
 * their UnitCard ability-detail row blank. These pin a NON-blank,
 * op-appropriate readout for every op kind. They
 * read the shipped `config/abilities.json` (the wording is config-derived), and
 * assert STRUCTURE (labels, op routing, riders) rather than balance arithmetic —
 * damage magnitudes are matched as `/\d+ dmg/`, never a hand-computed number.
 */
function partsFor(archetype: Archetype, id: string): string[] {
  const u = rollUnit(archetype, new RNG(1));
  return abilityDetailParts(id, u.stats);
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
      const text = abilityDetailParts('sword', stats).join(' · ');
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

  it('§76d — the four unwielded weapons render non-blank, op-appropriate details', () => {
    expect(partsFor('mercenary', 'halberd').join(' · ')).toMatch(/\d+ dmg/);
    expect(partsFor('mercenary', 'cane').join(' · ')).toMatch(/\d+ dmg/);
    expect(partsFor('archer', 'pistol').join(' · ')).toMatch(/\d+ dmg/);
    const molotov = partsFor('corrupter', 'molotov').join(' · ');
    expect(molotov).toMatch(/\d+ dmg/);
    expect(molotov).toContain('+burn'); // the damage-afflicter rider
  });
});

describe('abilityDetailPartsForDef (§76b — the aura branch, ahead of shipped content)', () => {
  // One shipped def carries an aura (`inspire`, a pure one) and no shipped
  // weapon radiates one, so these author synthetic parsed defs via the
  // def-taking core (the reason it was split out).
  const stats = rollUnit('mercenary', new RNG(1)).stats;

  const PURE_AURA = parseAbilityDef({
    id: 'test_aura', name: 'Test Aura', cooldownSeconds: 1, rangeCells: 0,
    target: { kind: 'self' },
    timeline: [{ phase: 'recovery', seconds: 'fill' }],
    orphanPolicy: 'commit-at-cast', priority: 0, effects: [],
    aura: { radius: 3, statusId: 'emboldened', affects: 'allies' },
  });

  it('a pure aura reads as its radiated status + the AURA radius, never "dash"', () => {
    const text = abilityDetailPartsForDef(PURE_AURA, stats).join(' · ');
    expect(text).toContain('aura emboldened');
    expect(text).toContain('reach 3'); // aura.radius, NOT the def's inert rangeCells (0)
    expect(text).not.toContain('dash'); // a self-target with no ops would reach the dash branch
  });

  it('a weapon that also radiates keeps its profile and gains the aura rider', () => {
    const radiantSword = parseAbilityDef({
      ...ABILITY_DEFS.sword!,
      aura: { radius: 2, statusId: 'emboldened', affects: 'allies' },
    });
    const text = abilityDetailPartsForDef(radiantSword, stats).join(' · ');
    expect(text).toMatch(/\d+ dmg/);
    expect(text).toContain('+aura emboldened');
  });

  it('the def-taking core matches the id path on a shipped def (no drift)', () => {
    expect(abilityDetailPartsForDef(ABILITY_DEFS.sword!, stats)).toEqual(
      abilityDetailParts('sword', stats),
    );
  });
});

describe("the card's damage and heal number is the one the sim uses", () => {
  // The expectation comes from the raw config, not from the sim's helpers the
  // card calls: an op's `might` plus the caster stat its `scaling` names. The
  // card shows a heal first, then a damage op, then a chain's inner damage.
  type RawOp = { kind: string; might?: number; scaling?: string; ops?: RawOp[] };
  const RAW = abilitiesJson as unknown as Record<string, { effects: { op: RawOp }[] }>;

  function expectedPart(id: string, stats: UnitStats): string | null {
    const value = (op: RawOp): number =>
      op.might! + (op.scaling === 'none' ? 0 : stats[op.scaling as 'strength' | 'ranged' | 'magic']);
    const ops = RAW[id]!.effects.map((e) => e.op);
    const heal = ops.find((o) => o.kind === 'heal');
    if (heal) return `${value(heal)} heal`;
    const damage =
      ops.find((o) => o.kind === 'damage') ?? ops.find((o) => o.kind === 'chain')?.ops?.find((o) => o.kind === 'damage');
    return damage ? `${value(damage)} dmg` : null;
  }

  it('on every unit, with strength, ranged and magic all different', () => {
    const wrong: string[] = [];
    let checked = 0;
    for (const [archetype, def] of Object.entries(UNIT_DEFS)) {
      // Distinct, so a wrong stat cannot hide behind an equal or a zero one.
      const stats: UnitStats = { ...rollUnit(archetype as Archetype, new RNG(1)).stats, strength: 3, ranged: 5, magic: 7 };
      for (const id of def.abilities) {
        const expected = expectedPart(id, stats);
        if (expected === null) continue;
        checked++;
        const shown = abilityDetailParts(id, stats).find((p) => / (dmg|heal)$/.test(p));
        if (shown !== expected) wrong.push(`${archetype} ${id}: shows ${shown}, the sim uses ${expected}`);
      }
    }
    expect(checked).toBeGreaterThan(0);
    expect(wrong).toEqual([]);
  });
});
