import { describe, expect, it } from 'vitest';
import { explosionPlacement } from './burstPlacement';
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
    expect(shippedExplosions.length).toBeGreaterThanOrEqual(5);
    for (const [id, d] of shippedExplosions) {
      expect(d.target.kind === 'aoe' && d.target.anchor, id).toBe('targetCell');
      expect(explosionPlacement(d.target, { x: 4, y: 7 }, { x: 1, y: 1 }), id).toEqual({
        cell: { x: 4, y: 7 },
        ringSpread: 1.1,
      });
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
