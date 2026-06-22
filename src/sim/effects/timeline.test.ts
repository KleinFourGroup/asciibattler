import { describe, it, expect } from 'vitest';
import { secondsToTicks } from '../../config';
import { attackCooldownTicksFor } from '../stats';
import { resolveCadenceTicks, resolvePhases } from './timeline';
import { AbilityDefSchema, type AbilityDef } from './schema';
import type { ActionPhase } from '../Action';

/**
 * Phase Y1 — the seconds→ticks timeline conversion reproduces every existing
 * proposal builder's phase array (`strikes.ts` / `magic.ts` / `catapult.ts` /
 * `dash.ts`), for arbitrary caster speed. Expectations are DERIVED from the same
 * primitives the builders use (`attackCooldownTicksFor`, `secondsToTicks`) — not
 * hardcoded tick counts — so this proves the conversion matches the FORMULA, the
 * way the Y3/Y4 determinism oracle then proves it end-to-end. The defs are
 * explicit literals mirroring `config/abilities.json`'s values.
 */

const SPEEDS = [0, 4, 12, -3];

/** A def with `id` injected + defaults filled, from a partial literal. */
function def(partial: Record<string, unknown>): AbilityDef {
  return AbilityDefSchema.parse({ id: 'x', ...partial });
}

const damageOp = (scaling: string) => ({
  kind: 'damage',
  scaling,
  might: 1,
  accuracy: 0.6,
  critBase: 0,
  critable: false,
  evadable: false,
  bypassDefense: false,
});

// --- Expected-shape builders, mirroring the real proposal builders. ----------

/** `strikes.ts` basic strike: `[impact 0, recovery durationTicks]`. */
function strikeShape(cooldownSeconds: number, speed: number): ActionPhase[] {
  const d = attackCooldownTicksFor(cooldownSeconds, speed);
  return [
    { phase: 'impact', ticks: 0 },
    { phase: 'recovery', ticks: d },
  ];
}

/** `strikes.ts` gambit: `[windup R, impact 0, recovery D−R]`, R = min(carve, D). */
function gambitShape(cooldownSeconds: number, retreatSeconds: number, speed: number): ActionPhase[] {
  const d = attackCooldownTicksFor(cooldownSeconds, speed);
  const windup = Math.min(secondsToTicks(retreatSeconds), d);
  return [
    { phase: 'windup', ticks: windup },
    { phase: 'impact', ticks: 0 },
    { phase: 'recovery', ticks: d - windup },
  ];
}

/** `magic.ts`/`catapult.ts`: `[windup D−T, release 0, travel T, impact 0]`. */
function chargedShape(cooldownSeconds: number, travelSeconds: number, speed: number): ActionPhase[] {
  const d = attackCooldownTicksFor(cooldownSeconds, speed);
  const travel = Math.min(secondsToTicks(travelSeconds), d);
  return [
    { phase: 'windup', ticks: d - travel },
    { phase: 'release', ticks: 0 },
    { phase: 'travel', ticks: travel },
    { phase: 'impact', ticks: 0 },
  ];
}

describe('resolvePhases — reproduces the migrated verbs byte-for-byte', () => {
  const strike = (cd: number) =>
    def({
      cooldownSeconds: cd,
      rangeCells: 1,
      target: { kind: 'enemyInRange' },
      timeline: [
        { phase: 'impact', seconds: 0 },
        { phase: 'recovery', seconds: 'fill' },
      ],
      orphanPolicy: 'commit-at-cast',
      priority: 10,
      effects: [{ phase: 'impact', op: damageOp('strength') }],
    });

  const gambit = def({
    cooldownSeconds: 1.2,
    rangeCells: 1,
    target: { kind: 'enemyInRange' },
    timeline: [
      { phase: 'windup', seconds: 0.25 },
      { phase: 'impact', seconds: 0 },
      { phase: 'recovery', seconds: 'fill' },
    ],
    orphanPolicy: 'commit-at-cast',
    priority: 10,
    effects: [
      { phase: 'impact', op: damageOp('strength') },
      { phase: 'recovery', op: { kind: 'move', mode: 'retreat', cells: 1 } },
    ],
  });

  const charged = (cd: number, travel: number) =>
    def({
      cooldownSeconds: cd,
      rangeCells: 5,
      target: { kind: 'aoe', shape: 'square', radius: 1, anchor: 'targetCell', affects: 'enemies' },
      timeline: [
        { phase: 'windup', seconds: 'fill' },
        { phase: 'release', seconds: 0 },
        { phase: 'travel', seconds: travel },
        { phase: 'impact', seconds: 0 },
      ],
      orphanPolicy: 'ground-target',
      priority: 10,
      effects: [{ phase: 'impact', op: damageOp('magic') }],
    });

  for (const speed of SPEEDS) {
    it(`sword/bow/heal (strike shape) @ speed ${speed}`, () => {
      expect(resolvePhases(strike(1.5), speed)).toEqual(strikeShape(1.5, speed)); // sword
      expect(resolvePhases(strike(2.0), speed)).toEqual(strikeShape(2.0, speed)); // bow / heal
    });

    it(`gambit (windup carve) @ speed ${speed}`, () => {
      expect(resolvePhases(gambit, speed)).toEqual(gambitShape(1.2, 0.25, speed));
    });

    it(`magic_bolt / catapult_shot (charged shape) @ speed ${speed}`, () => {
      expect(resolvePhases(charged(2.5, 0.35), speed)).toEqual(chargedShape(2.5, 0.35, speed));
      expect(resolvePhases(charged(3.0, 0.6), speed)).toEqual(chargedShape(3.0, 0.6, speed));
    });
  }

  it('dash — flat cadence, single motion phase, no fill', () => {
    const dash = def({
      cooldownSeconds: 10,
      speedScaled: false,
      rangeCells: 2,
      target: { kind: 'enemyInRange' },
      timeline: [{ phase: 'impact', seconds: 0.25 }],
      orphanPolicy: 'commit-at-cast',
      priority: 5,
      effects: [{ phase: 'impact', op: { kind: 'move', mode: 'advance', cells: 2 } }],
    });
    // Busy window = the fixed 0.25 s motion, decoupled from the 10 s cooldown.
    for (const speed of SPEEDS) {
      expect(resolvePhases(dash, speed)).toEqual([
        { phase: 'impact', ticks: secondsToTicks(0.25) },
      ]);
    }
    // The re-proposal cooldown floors at 1 and ignores speed (mirrors DashAbility).
    expect(resolveCadenceTicks(dash, 0)).toBe(Math.max(1, secondsToTicks(10)));
    expect(resolveCadenceTicks(dash, 99)).toBe(Math.max(1, secondsToTicks(10)));
  });
});

describe('resolvePhases — the fill phase clamps to the cadence window', () => {
  it('a fixed phase longer than the cadence clamps; the fill floors at 0', () => {
    // windup carve (10 s) dwarfs the cadence (cooldown 0.5 s) → windup == cadence,
    // recovery (fill) == 0. Mirrors the builders' `min(carve, duration)`.
    const d = def({
      cooldownSeconds: 0.5,
      rangeCells: 1,
      target: { kind: 'enemyInRange' },
      timeline: [
        { phase: 'windup', seconds: 10 },
        { phase: 'impact', seconds: 0 },
        { phase: 'recovery', seconds: 'fill' },
      ],
      orphanPolicy: 'commit-at-cast',
      priority: 10,
      effects: [{ phase: 'impact', op: damageOp('strength') }],
    });
    const cadence = attackCooldownTicksFor(0.5, 0);
    expect(resolvePhases(d, 0)).toEqual([
      { phase: 'windup', ticks: cadence },
      { phase: 'impact', ticks: 0 },
      { phase: 'recovery', ticks: 0 },
    ]);
  });
});
