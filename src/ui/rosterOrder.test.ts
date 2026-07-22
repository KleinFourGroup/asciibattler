/**
 * R1 — the pure roster-ordering seam. DOM-free, so it runs under the project's
 * node test env (the DOM `CardListModal` itself is browser-verified). Expectations
 * derive the archetype order from `ALL_ARCHETYPES` (the canonical source) rather
 * than hardcoding it, so a config reorder can't silently break these.
 */

import { describe, it, expect } from 'vitest';
import { orderRoster, orderRosterWithIndices, DEFAULT_ROSTER_ORDER } from './rosterOrder';
import { scaledUnit, ALL_ARCHETYPES } from '../sim/archetypes';
import type { UnitTemplate } from '../sim/Unit';

/** A roster spanning several archetypes + levels, in a deliberately scrambled
 *  recruitment order so each strategy has something to reorder. */
function sampleRoster(): UnitTemplate[] {
  return [
    scaledUnit('mage', 3),
    scaledUnit('mercenary', 1),
    scaledUnit('archer', 5),
    scaledUnit('mercenary', 4),
    scaledUnit('healer', 2),
  ];
}

describe('orderRoster', () => {
  it("defaults to 'recruited'", () => {
    expect(DEFAULT_ROSTER_ORDER).toBe('recruited');
    const roster = sampleRoster();
    expect(orderRoster(roster)).toEqual(roster);
  });

  it("'recruited' preserves order and returns a fresh array (no mutation)", () => {
    const roster = sampleRoster();
    const before = roster.slice();
    const out = orderRoster(roster, 'recruited');
    expect(out).toEqual(before);
    expect(out).not.toBe(roster); // a copy, so callers can't mutate the source
    expect(roster).toEqual(before); // input untouched
  });

  it("'archetype' groups by the canonical ALL_ARCHETYPES order", () => {
    const roster = sampleRoster();
    const out = orderRoster(roster, 'archetype');
    const ranks = out.map((u) => ALL_ARCHETYPES.indexOf(u.archetype));
    // Non-decreasing rank == grouped in canonical archetype order.
    for (let i = 1; i < ranks.length; i++) {
      expect(ranks[i]!).toBeGreaterThanOrEqual(ranks[i - 1]!);
    }
  });

  it("'archetype' is stable on recruitment order within a group", () => {
    const roster = sampleRoster();
    const out = orderRoster(roster, 'archetype');
    const mercs = out.filter((u) => u.archetype === 'mercenary');
    // The two mercenaries keep their recruitment order (lv1 was drafted before lv4).
    expect(mercs.map((u) => u.level)).toEqual([1, 4]);
  });

  it("'level' sorts strongest-first, stable on recruitment order for ties", () => {
    const roster = [
      scaledUnit('mercenary', 2),
      scaledUnit('archer', 5),
      scaledUnit('mage', 2),
      scaledUnit('healer', 5),
    ];
    const out = orderRoster(roster, 'level');
    expect(out.map((u) => u.level)).toEqual([5, 5, 2, 2]);
    // Ties hold recruitment order: ranged(5) drafted before healer(5); merc(2) before mage(2).
    expect(out.map((u) => u.archetype)).toEqual(['archer', 'healer', 'mercenary', 'mage']);
  });

  it('is deterministic (same input → same output)', () => {
    const roster = sampleRoster();
    expect(orderRoster(roster, 'archetype')).toEqual(orderRoster(roster, 'archetype'));
    expect(orderRoster(roster, 'level')).toEqual(orderRoster(roster, 'level'));
  });

  it('handles the empty + single-unit roster', () => {
    expect(orderRoster([], 'archetype')).toEqual([]);
    const one = [scaledUnit('rogue', 3)];
    expect(orderRoster(one, 'level')).toEqual(one);
  });
});

describe('orderRosterWithIndices (51c — the selection mapping)', () => {
  it("'recruited' maps each unit to its own position", () => {
    const roster = sampleRoster();
    const out = orderRosterWithIndices(roster);
    expect(out.map((e) => e.sourceIndex)).toEqual([0, 1, 2, 3, 4]);
    expect(out.map((e) => e.unit)).toEqual(roster);
  });

  it('a sorted order carries every unit back to its SOURCE index', () => {
    const roster = sampleRoster();
    for (const order of ['archetype', 'level'] as const) {
      const out = orderRosterWithIndices(roster, order);
      // Same units, permuted — and each entry's sourceIndex points at the
      // identical object in the input (the mapping a picker confirms with).
      expect(out).toHaveLength(roster.length);
      for (const entry of out) {
        expect(roster[entry.sourceIndex]).toBe(entry.unit);
      }
      expect(new Set(out.map((e) => e.sourceIndex)).size).toBe(roster.length);
    }
  });

  it('agrees with orderRoster (the undecorated view is the same permutation)', () => {
    const roster = sampleRoster();
    for (const order of ['recruited', 'archetype', 'level'] as const) {
      expect(orderRosterWithIndices(roster, order).map((e) => e.unit)).toEqual(
        orderRoster(roster, order) as UnitTemplate[],
      );
    }
  });

  it('never mutates the input', () => {
    const roster = sampleRoster();
    const before = roster.slice();
    orderRosterWithIndices(roster, 'level');
    expect(roster).toEqual(before);
  });
});
