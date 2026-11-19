import { describe, expect, it } from 'vitest';
import { explosionPlacement, SPIN_SPARKS, spinSparkOffset } from './burstPlacement';
import { fxDescriptor } from './fxRegistry';
import { parseAbilityDef, type AbilityDef } from '../sim/effects/schema';
import abilitiesJson from '../../config/abilities.json';

/**
 * Where the explosion is drawn. The shipped blasts are read from the raw
 * config, and their ring is held to 1.1 world units, its value before the
 * ring was sized by radius, so their look is unchanged; a blast anchored on
 * its caster is drawn on the caster's cell, its ring twice as wide at
 * radius 2.
 */

type RawDef = { target: AbilityDef['target']; fx?: Record<string, string> };
const raw = abilitiesJson as unknown as Record<string, RawDef>;

/** The shipped abilities whose fx draws an explosion, with their selectors. */
const shippedExplosions = Object.entries(raw).filter(([, d]) =>
  Object.values(d.fx ?? {}).some((key) => fxDescriptor(key)?.burst?.style === 'explosion'),
);

function burstOnSelf(radius: number): AbilityDef {
  return parseAbilityDef({
    id: 'test_burst', name: 'Test Burst', description: 'A test.', cooldownSeconds: 2, rangeCells: 0,
    target: { kind: 'aoe', shape: 'square', radius, anchor: 'caster', affects: 'enemies' },
    timeline: [{ phase: 'impact', seconds: 0 }, { phase: 'recovery', seconds: 'fill' }],
    orphanPolicy: 'commit-at-cast', priority: 10,
    effects: [{ phase: 'impact', op: { kind: 'damage', scaling: 'magic', might: 1, critBase: 0, critable: true, evadable: false, bypassDefense: false } }],
  });
}

describe('the explosion, placed', () => {
  it('draws every shipped aimed blast on its surfaced cell, its ring as before', () => {
    const aimed = shippedExplosions.filter(([, d]) => d.target.kind === 'aoe' && d.target.anchor === 'targetCell');
    expect(aimed.length).toBeGreaterThanOrEqual(5);
    for (const [id, d] of aimed) {
      expect(d.target.kind === 'aoe' && d.target.radius, id).toBe(1);
      expect(explosionPlacement(d.target, { x: 4, y: 7 }, { x: 1, y: 1 }), id).toEqual({
        cell: { x: 4, y: 7 },
        ringSpread: 1.1,
      });
    }
  });

  it("draws every shipped blast on its caster on the caster's cell, its ring by the raw radius", () => {
    const onCaster = shippedExplosions.filter(([, d]) => d.target.kind === 'aoe' && d.target.anchor === 'caster');
    expect(onCaster.length).toBeGreaterThanOrEqual(1);
    for (const [id, d] of onCaster) {
      const radius = d.target.kind === 'aoe' ? d.target.radius : NaN;
      const placed = explosionPlacement(d.target, undefined, { x: 3, y: 5 });
      expect(placed?.cell, id).toEqual({ x: 3, y: 5 });
      expect(placed?.ringSpread, id).toBeCloseTo(1.1 * radius, 10);
    }
  });

  it("draws a blast anchored on its caster on the caster's cell, its ring by the radius", () => {
    expect(explosionPlacement(burstOnSelf(1).target, undefined, { x: 3, y: 5 })).toEqual({
      cell: { x: 3, y: 5 },
      ringSpread: 1.1,
    });
    const wide = explosionPlacement(burstOnSelf(2).target, { x: 9, y: 9 }, { x: 3, y: 5 });
    expect(wide?.cell).toEqual({ x: 3, y: 5 });
    expect(wide?.ringSpread).toBeCloseTo(2.2, 10);
  });

  it('draws nothing with no cell to draw on', () => {
    const aimed = shippedExplosions[0]![1].target;
    expect(explosionPlacement(aimed, undefined, { x: 3, y: 5 })).toBeNull();
    expect(explosionPlacement(burstOnSelf(1).target, { x: 4, y: 7 }, undefined)).toBeNull();
  });
});

describe('the spin', () => {
  // The shipped abilities whose fx draws a spin, read from the raw config.
  const shippedSpins = Object.entries(raw).filter(([, d]) =>
    Object.values(d.fx ?? {}).some((key) => fxDescriptor(key)?.burst?.style === 'spin'),
  );

  it("draws the whirlwind alone as a spin, on the ronin's cell at its blast's spread", () => {
    expect(shippedSpins.map(([id]) => id)).toEqual(['whirlwind']);
    const target = raw.whirlwind!.target;
    expect(target).toMatchObject({ kind: 'aoe', anchor: 'caster' });
    const placed = explosionPlacement(target, undefined, { x: 3, y: 5 });
    expect(placed?.cell).toEqual({ x: 3, y: 5 });
    expect(placed?.ringSpread).toBeCloseTo(1.1 * (target.kind === 'aoe' ? target.radius : 1), 10);
  });

  it("starts its eight sparks a turn's eighth apart at the spread, keeps them there, and ends one turn on", () => {
    expect(SPIN_SPARKS).toBe(8);
    const r = 1.1;
    const angleOf = (o: { dx: number; dz: number }) => Math.atan2(o.dz, o.dx);
    for (let i = 0; i < SPIN_SPARKS; i++) {
      for (const t of [0, 0.25, 0.5, 0.75, 1]) {
        const o = spinSparkOffset(i, t, r);
        expect(Math.hypot(o.dx, o.dz), `spark ${i} at ${t}`).toBeCloseTo(r, 10);
      }
      // A quarter of the spin is a quarter turn on; the whole spin a full turn.
      const start = spinSparkOffset(i, 0, r);
      const quarter = spinSparkOffset(i, 0.25, r);
      expect(quarter.dx).toBeCloseTo(-start.dz, 10);
      expect(quarter.dz).toBeCloseTo(start.dx, 10);
      const end = spinSparkOffset(i, 1, r);
      expect(end.dx).toBeCloseTo(start.dx, 10);
      expect(end.dz).toBeCloseTo(start.dz, 10);
    }
    // At the start, neighbours sit an eighth of a turn apart.
    const step = angleOf(spinSparkOffset(1, 0, r)) - angleOf(spinSparkOffset(0, 0, r));
    expect(step).toBeCloseTo((2 * Math.PI) / SPIN_SPARKS, 10);
  });
});
