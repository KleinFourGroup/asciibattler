/**
 * §91a2 — the chip-rule matrix: {chipMode} × {capPenalty} × {reason}. Every
 * expectation is arithmetic on the injected `health`, never on the shipped
 * config (the pins hold under whichever default ships — survivors until
 * 91e, casualties after).
 */

import { describe, it, expect } from 'vitest';
import { rulesForTurn, turnCharges, playerExposure, type TurnEndReason } from './chipRule';
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
