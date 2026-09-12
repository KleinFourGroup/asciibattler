/**
 * §91a2 — the chip-rule matrix: {chipMode} × {capPenalty} × {reason}. Every
 * expectation is arithmetic on the injected `health`, never on the shipped
 * config (the pins hold under whichever default ships — survivors until
 * 91e, casualties after).
 */

import { describe, it, expect } from 'vitest';
import {
  rulesForTurn,
  turnCharges,
  playerExposure,
  lossEventsForDeath,
  lossEventsAtEnd,
  bookedImmediateLoss,
  sumLossEvents,
  type TurnEndReason,
} from './chipRule';
import { HEALTH } from '../config/health';

const survivors = { player: 3, enemy: 5 };
const fallen = { player: 2, enemy: 7 };
const h = (chipMode: 'survivors' | 'casualties', capPenalty: 'survivors' | 'casualties', chipMultiplier = 1) => ({
  chipMode,
  capPenalty,
  chipMultiplier,
});
const REASONS: TurnEndReason[] = ['decisive', 'mutualWipe', 'cap'];

describe('chipRule (§91a2)', () => {
  it('survivors: each pool pays the OPPOSING standing power; the fallen are ignored, on every reason', () => {
    for (const reason of REASONS) {
      expect(turnCharges(reason, survivors, fallen, h('survivors', 'survivors'))).toEqual({
        player: survivors.enemy,
        enemy: survivors.player,
      });
    }
  });

  it('casualties: each pool pays its OWN fallen; the survivors are ignored, on decisive + mutual-wipe turns', () => {
    for (const reason of ['decisive', 'mutualWipe'] as const) {
      expect(turnCharges(reason, survivors, fallen, h('casualties', 'casualties'))).toEqual({
        player: fallen.player,
        enemy: fallen.enemy,
      });
      // The cap penalty is never consulted off the cap.
      expect(turnCharges(reason, survivors, fallen, h('casualties', 'survivors'))).toEqual({
        player: fallen.player,
        enemy: fallen.enemy,
      });
    }
  });

  it('a cap turn charges by every rule named in {chipMode, capPenalty} — the surcharge, never a replacement', () => {
    // (casualties, survivors): own fallen PLUS the enemy's standing power.
    expect(turnCharges('cap', survivors, fallen, h('casualties', 'survivors'))).toEqual({
      player: fallen.player + survivors.enemy,
      enemy: fallen.enemy + survivors.player,
    });
    // (survivors, casualties): the mirror oddity — coherent, symmetric.
    expect(turnCharges('cap', survivors, fallen, h('survivors', 'casualties'))).toEqual({
      player: survivors.enemy + fallen.player,
      enemy: survivors.player + fallen.enemy,
    });
    // (casualties, casualties): plain casualties — a free stall is the signed
    // default's known exposure (the searcher is pool-blind; a human stall).
    expect(turnCharges('cap', survivors, fallen, h('casualties', 'casualties'))).toEqual({
      player: fallen.player,
      enemy: fallen.enemy,
    });
  });

  it('(survivors, survivors) on a cap turn is ONE rule — byte-identical to the pre-§91 charge, never doubled', () => {
    expect(rulesForTurn('cap', h('survivors', 'survivors')).size).toBe(1);
    expect(turnCharges('cap', survivors, fallen, h('survivors', 'survivors'))).toEqual({
      player: survivors.enemy,
      enemy: survivors.player,
    });
  });

  it('a mutual wipe never reads capPenalty (the largest casualty turn is not a stall)', () => {
    expect([...rulesForTurn('mutualWipe', h('casualties', 'survivors'))]).toEqual(['casualties']);
    expect([...rulesForTurn('decisive', h('survivors', 'casualties'))]).toEqual(['survivors']);
    expect([...rulesForTurn('cap', h('casualties', 'survivors'))].sort()).toEqual(['casualties', 'survivors']);
  });

  it('chipMultiplier scales every charge (pool-HP, uncapped — the caller clamps)', () => {
    expect(turnCharges('cap', survivors, fallen, h('casualties', 'survivors', 0.5))).toEqual({
      player: (fallen.player + survivors.enemy) * 0.5,
      enemy: (fallen.enemy + survivors.player) * 0.5,
    });
    // A charge past any pool stays uncapped here (the 89d rider: the overkill
    // read needs the pre-clamp number).
    expect(turnCharges('decisive', { player: 0, enemy: 99 }, fallen, h('survivors', 'survivors', 3)).player).toBe(297);
  });

  it('§91d playerExposure: the risk bound reads the WAVE under survivors and the HAND under casualties, × mult, uncapped', () => {
    const fielded = { player: 4, enemy: 9 };
    expect(playerExposure(fielded, { chipMode: 'survivors', chipMultiplier: 1 })).toBe(9);
    expect(playerExposure(fielded, { chipMode: 'casualties', chipMultiplier: 1 })).toBe(4);
    expect(playerExposure(fielded, { chipMode: 'casualties', chipMultiplier: 2.5 })).toBe(10);
    // Never capped here (the caller clamps at the pool); the live default wires HEALTH.
    expect(playerExposure({ player: 0, enemy: 99 }, { chipMode: 'survivors', chipMultiplier: 3 })).toBe(297);
    expect(playerExposure(fielded)).toBe(playerExposure(fielded, HEALTH));
  });

  it('defaults to the LIVE config (the production wiring) — the shipped modes are the two legal literals', () => {
    expect(['survivors', 'casualties']).toContain(HEALTH.chipMode);
    expect(['survivors', 'casualties']).toContain(HEALTH.capPenalty);
    expect(turnCharges('decisive', survivors, fallen)).toEqual(turnCharges('decisive', survivors, fallen, HEALTH));
  });
});

/**
 * 96.5b1 — the loss-event model: the stream the live bar consumes must SUM
 * to what the turn books, whatever the rule pair and reason. Each side's
 * fielded units are fixed; the dead + the standing partition them, so the
 * per-unit rows re-derive the same `survivors` / `fallen` totals the charge
 * reads — the expectation is `turnCharges` itself, never re-typed numbers.
 */
describe('chipRule — the loss-event model (96.5b1)', () => {
  const dead = [
    { unitId: 1, team: 'player' as const, power: 2 },
    { unitId: 2, team: 'enemy' as const, power: 4 },
    { unitId: 3, team: 'enemy' as const, power: 3 },
  ];
  const standing = [
    { unitId: 4, team: 'player' as const, power: 3 },
    { unitId: 5, team: 'enemy' as const, power: 5 },
  ];
  const fallenOf = (rows: typeof dead) => ({
    player: rows.filter((r) => r.team === 'player').reduce((s, r) => s + r.power, 0),
    enemy: rows.filter((r) => r.team === 'enemy').reduce((s, r) => s + r.power, 0),
  });
  const standingOf = (rows: typeof standing) => ({
    player: rows.filter((r) => r.team === 'player').reduce((s, r) => s + r.power, 0),
    enemy: rows.filter((r) => r.team === 'enemy').reduce((s, r) => s + r.power, 0),
  });
  const MODES = ['survivors', 'casualties'] as const;

  it('Σ(immediate events over the dead) + Σ(end events) = turnCharges, for every {chipMode} × {capPenalty} × {reason} × mult', () => {
    for (const chipMode of MODES) {
      for (const capPenalty of MODES) {
        for (const mult of [1, 1.5]) {
          const health = h(chipMode, capPenalty, mult);
          for (const reason of REASONS) {
            const stream = [
              ...dead.flatMap((d) => lossEventsForDeath(d, health)),
              ...lossEventsAtEnd(reason, standing, fallenOf(dead), health),
            ];
            expect(sumLossEvents(stream), `${chipMode}/${capPenalty}/${reason}/×${mult}`).toEqual(
              turnCharges(reason, standingOf(standing), fallenOf(dead), health),
            );
          }
        }
      }
    }
  });

  it('casualties: a death fires ONE immediate event, the dead unit\'s own side pays, the cause is the unit; nothing fires at a decisive end', () => {
    const health = h('casualties', 'survivors', 2);
    expect(lossEventsForDeath(dead[1]!, health)).toEqual([
      { target: 'enemy', amount: 8, phase: 'immediate', cause: { kind: 'unit', unitId: 2, team: 'enemy' } },
    ]);
    expect(lossEventsAtEnd('decisive', standing, fallenOf(dead), health)).toEqual([]);
    expect(lossEventsAtEnd('mutualWipe', [], fallenOf(dead), health)).toEqual([]);
  });

  it('survivors: a death fires nothing; the end fires one event PER STANDING UNIT charged to the OPPOSING pool, cause = the survivor', () => {
    const health = h('survivors', 'survivors', 1);
    for (const d of dead) expect(lossEventsForDeath(d, health)).toEqual([]);
    expect(lossEventsAtEnd('decisive', standing, fallenOf(dead), health)).toEqual([
      { target: 'enemy', amount: 3, phase: 'end', cause: { kind: 'unit', unitId: 4, team: 'player' } },
      { target: 'player', amount: 5, phase: 'end', cause: { kind: 'unit', unitId: 5, team: 'enemy' } },
    ]);
    // (survivors, survivors) on a cap turn is one rule — the stream is not doubled.
    expect(lossEventsAtEnd('cap', standing, fallenOf(dead), health)).toHaveLength(2);
  });

  it('the cap surcharge: under (casualties, survivors) the end adds the survivor rows; under (survivors, casualties) it adds ONE team-cause event per side off the fallen totals', () => {
    expect(lossEventsAtEnd('cap', standing, fallenOf(dead), h('casualties', 'survivors'))).toEqual([
      { target: 'enemy', amount: 3, phase: 'end', cause: { kind: 'unit', unitId: 4, team: 'player' } },
      { target: 'player', amount: 5, phase: 'end', cause: { kind: 'unit', unitId: 5, team: 'enemy' } },
    ]);
    expect(lossEventsAtEnd('cap', standing, fallenOf(dead), h('survivors', 'casualties'))).toEqual([
      { target: 'enemy', amount: 3, phase: 'end', cause: { kind: 'unit', unitId: 4, team: 'player' } },
      { target: 'player', amount: 5, phase: 'end', cause: { kind: 'unit', unitId: 5, team: 'enemy' } },
      { target: 'player', amount: 2, phase: 'end', cause: { kind: 'team', team: 'player' } },
      { target: 'enemy', amount: 7, phase: 'end', cause: { kind: 'team', team: 'enemy' } },
    ]);
  });

  it('a zero booking (a summon), a neutral, and a zero-power survivor emit nothing', () => {
    const health = h('casualties', 'survivors');
    expect(lossEventsForDeath({ unitId: 9, team: 'enemy', power: 0 }, health)).toEqual([]);
    expect(lossEventsForDeath({ unitId: 9, team: 'neutral', power: 5 }, health)).toEqual([]);
    expect(lossEventsAtEnd('cap', [{ unitId: 9, team: 'enemy', power: 0 }], { player: 0, enemy: 0 }, health)).toEqual([]);
  });

  it('bookedImmediateLoss — the mid-battle restore opening: the fallen totals × mult under casualties, nothing under survivors', () => {
    expect(bookedImmediateLoss(fallen, h('casualties', 'survivors', 2))).toEqual({ player: 4, enemy: 14 });
    expect(bookedImmediateLoss(fallen, h('survivors', 'casualties', 2))).toEqual({ player: 0, enemy: 0 });
    // Equal to the immediate stream summed — the restore path and the live path agree.
    const health = h('casualties', 'casualties', 1.5);
    expect(bookedImmediateLoss(fallenOf(dead), health)).toEqual(
      sumLossEvents(dead.flatMap((d) => lossEventsForDeath(d, health))),
    );
  });
});
