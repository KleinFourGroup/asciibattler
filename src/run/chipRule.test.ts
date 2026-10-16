/**
 * §91a2 — the chip rule by {reason}. Every expectation is arithmetic on the
 * injected `health`, never on the shipped config.
 */

import { describe, it, expect } from 'vitest';
import {
  rulesForTurn,
  turnCharges,
  playerExposure,
  enemyExposure,
  lossEventsForDeath,
  lossEventsAtEnd,
  bookedImmediateLoss,
  sumLossEvents,
  type TurnEndReason,
} from './chipRule';
import { HEALTH } from '../config/health';

const survivors = { player: 3, enemy: 5 };
const fallen = { player: 2, enemy: 7 };
const h = (chipMultiplier = 1) => ({ chipMultiplier });
const REASONS: TurnEndReason[] = ['decisive', 'mutualWipe', 'cap'];

describe('chipRule (§91a2)', () => {
  it('each pool pays its OWN fallen; the survivors are ignored, on decisive + mutual-wipe turns', () => {
    for (const reason of ['decisive', 'mutualWipe'] as const) {
      expect(turnCharges(reason, survivors, fallen, h())).toEqual({
        player: fallen.player,
        enemy: fallen.enemy,
      });
    }
  });

  it('a cap turn pays own fallen PLUS the opposing standing power — the surcharge, never a replacement', () => {
    expect(turnCharges('cap', survivors, fallen, h())).toEqual({
      player: fallen.player + survivors.enemy,
      enemy: fallen.enemy + survivors.player,
    });
  });

  it('a mutual wipe never pays the surcharge (the largest casualty turn is not a stall)', () => {
    expect([...rulesForTurn('mutualWipe')]).toEqual(['casualties']);
    expect([...rulesForTurn('decisive')]).toEqual(['casualties']);
    expect([...rulesForTurn('cap')].sort()).toEqual(['casualties', 'survivors']);
  });

  it('chipMultiplier scales every charge (pool-HP, uncapped — the caller clamps)', () => {
    expect(turnCharges('cap', survivors, fallen, h(0.5))).toEqual({
      player: (fallen.player + survivors.enemy) * 0.5,
      enemy: (fallen.enemy + survivors.player) * 0.5,
    });
    // A charge past any pool stays uncapped here (the 89d rider: the overkill
    // read needs the pre-clamp number).
    expect(turnCharges('decisive', survivors, { player: 99, enemy: 0 }, h(3)).player).toBe(297);
  });

  it('§91d playerExposure: the risk bound reads the HAND, × mult, uncapped', () => {
    const fielded = { player: 4, enemy: 9 };
    expect(playerExposure(fielded, h(1))).toBe(4);
    expect(playerExposure(fielded, h(2.5))).toBe(10);
    // Never capped here (the caller clamps at the pool); the live default wires HEALTH.
    expect(playerExposure({ player: 99, enemy: 0 }, h(3))).toBe(297);
    expect(playerExposure(fielded)).toBe(playerExposure(fielded, HEALTH));
  });

  it('96.5c2 enemyExposure: the mirror bound — the WAVE, × mult, uncapped', () => {
    const fielded = { player: 4, enemy: 9 };
    expect(enemyExposure(fielded, h(1))).toBe(9);
    expect(enemyExposure(fielded, h(2))).toBe(18);
    // The two bounds partition the fielded power: what the player can lose
    // plus what the enemy can lose = everything fielded.
    expect(playerExposure(fielded, h(1)) + enemyExposure(fielded, h(1))).toBe(fielded.player + fielded.enemy);
  });

  it('defaults to the LIVE config (the production wiring)', () => {
    expect(turnCharges('decisive', survivors, fallen)).toEqual(turnCharges('decisive', survivors, fallen, HEALTH));
  });
});

/**
 * 96.5b1 — the loss-event model: the stream the live bar consumes must SUM
 * to what the turn books, whatever the reason. Each side's fielded units are
 * fixed; the dead + the standing partition them, so the per-unit rows
 * re-derive the same `survivors` / `fallen` totals the charge reads — the
 * expectation is `turnCharges` itself, never re-typed numbers.
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

  it('Σ(immediate events over the dead) + Σ(end events) = turnCharges, for every {reason} × mult', () => {
    for (const mult of [1, 1.5]) {
      const health = h(mult);
      for (const reason of REASONS) {
        const stream = [
          ...dead.flatMap((d) => lossEventsForDeath(d, health)),
          ...lossEventsAtEnd(reason, standing, health),
        ];
        expect(sumLossEvents(stream), `${reason}/×${mult}`).toEqual(
          turnCharges(reason, standingOf(standing), fallenOf(dead), health),
        );
      }
    }
  });

  it('a death fires ONE immediate event, the dead unit\'s own side pays, the cause is the unit; nothing fires at a decisive end', () => {
    const health = h(2);
    expect(lossEventsForDeath(dead[1]!, health)).toEqual([
      { target: 'enemy', amount: 8, phase: 'immediate', cause: { kind: 'unit', unitId: 2, team: 'enemy' } },
    ]);
    expect(lossEventsAtEnd('decisive', standing, health)).toEqual([]);
    expect(lossEventsAtEnd('mutualWipe', [], health)).toEqual([]);
  });

  it('the cap surcharge: the end adds one event PER STANDING UNIT charged to the OPPOSING pool, cause = the survivor', () => {
    expect(lossEventsAtEnd('cap', standing, h())).toEqual([
      { target: 'enemy', amount: 3, phase: 'end', cause: { kind: 'unit', unitId: 4, team: 'player' } },
      { target: 'player', amount: 5, phase: 'end', cause: { kind: 'unit', unitId: 5, team: 'enemy' } },
    ]);
  });

  it('a zero booking (a summon), a neutral, and a zero-power survivor emit nothing', () => {
    const health = h();
    expect(lossEventsForDeath({ unitId: 9, team: 'enemy', power: 0 }, health)).toEqual([]);
    expect(lossEventsForDeath({ unitId: 9, team: 'neutral', power: 5 }, health)).toEqual([]);
    expect(lossEventsAtEnd('cap', [{ unitId: 9, team: 'enemy', power: 0 }], health)).toEqual([]);
  });

  it('bookedImmediateLoss — the mid-battle restore opening: the fallen totals × mult', () => {
    expect(bookedImmediateLoss(fallen, h(2))).toEqual({ player: 4, enemy: 14 });
    // Equal to the immediate stream summed — the restore path and the live path agree.
    const health = h(1.5);
    expect(bookedImmediateLoss(fallenOf(dead), health)).toEqual(
      sumLossEvents(dead.flatMap((d) => lossEventsForDeath(d, health))),
    );
  });
});
