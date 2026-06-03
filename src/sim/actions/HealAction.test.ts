import { describe, it, expect } from 'vitest';
import { HealAction, HEAL_ACTION_ID } from './HealAction';
import { createAction } from './registry';
import { World } from '../World';
import { EventBus } from '../../core/EventBus';
import { RNG } from '../../core/RNG';
import type { UnitStats, UnitTemplate } from '../Unit';
import type { GameEvents } from '../../core/events';

/**
 * E7.B — HealAction MECHANIC tests. Explicit `amount` passed to the
 * constructor (never config-derived), so re-tuning the healer's `magic`
 * curve can't break them. They pin the primitive: HP is added, the heal
 * clamps at maxHp, the emitted `amount` is the actual delta, a dead target
 * is skipped, the effective delta credits the F6 utility-XP ledger, and the
 * action round-trips through the registry. The *wiring*
 * (amount = `healAmountFor`, target = lowest-HP wounded ally) lives in
 * `abilities/heal.test.ts`.
 */

const STATS_BLOCK: UnitStats = {
  constitution: 100,
  strength: 0,
  ranged: 0,
  magic: 0,
  luck: 0,
  agility: 0,
  mobility: 0,
  defense: 0,
};

function scene(): {
  world: World;
  healer: ReturnType<World['spawnUnit']>;
  ally: ReturnType<World['spawnUnit']>;
  heals: GameEvents['unit:healed'][];
} {
  const bus = new EventBus<GameEvents>();
  const world = new World(bus, new RNG(1));
  const heals: GameEvents['unit:healed'][] = [];
  bus.on('unit:healed', (p) => heals.push(p));
  const tmpl: UnitTemplate = { archetype: 'melee', level: 1, stats: STATS_BLOCK, xp: 0 };
  const healer = world.spawnUnit(tmpl, 'player', { x: 0, y: 0 });
  const ally = world.spawnUnit(tmpl, 'player', { x: 1, y: 0 });
  return { world, healer, ally, heals };
}

describe('HealAction', () => {
  it('restores HP by the explicit amount and emits the delta', () => {
    const { world, healer, ally, heals } = scene();
    ally.currentHp = ally.derived.maxHp - 20;
    new HealAction(ally, 8).start(healer, world);
    expect(ally.currentHp).toBe(ally.derived.maxHp - 12);
    expect(heals[0]).toEqual({ unitId: ally.id, amount: 8, healerId: healer.id });
  });

  it('clamps at maxHp and emits the actual (smaller) delta', () => {
    const { world, healer, ally, heals } = scene();
    ally.currentHp = ally.derived.maxHp - 3;
    new HealAction(ally, 8).start(healer, world);
    expect(ally.currentHp).toBe(ally.derived.maxHp); // not maxHp + 5
    expect(heals[0]).toEqual({ unitId: ally.id, amount: 3, healerId: healer.id });
  });

  it('emits a 0 delta when the target is already full (renderer skips it)', () => {
    const { world, healer, ally, heals } = scene();
    expect(ally.currentHp).toBe(ally.derived.maxHp);
    new HealAction(ally, 8).start(healer, world);
    expect(ally.currentHp).toBe(ally.derived.maxHp);
    expect(heals[0]).toEqual({ unitId: ally.id, amount: 0, healerId: healer.id });
  });

  it('tags the emitted heal with the casting unit as healerId (F5 source)', () => {
    const { world, healer, ally, heals } = scene();
    ally.currentHp = ally.derived.maxHp - 5;
    new HealAction(ally, 8).start(healer, world);
    // healerId = the caster so the renderer fires the F5 sparkle for ability
    // heals only; tile chip-heals emit `healerId: null` (see World.test.ts).
    expect(heals[0]?.healerId).toBe(healer.id);
  });

  it('skips a dead target (no resurrection, no event)', () => {
    const { world, healer, ally, heals } = scene();
    ally.currentHp = 0;
    new HealAction(ally, 8).start(healer, world);
    expect(ally.currentHp).toBe(0);
    expect(heals).toHaveLength(0);
  });

  it('round-trips through the action registry', () => {
    const { world, healer, ally } = scene();
    ally.currentHp = ally.derived.maxHp - 10;
    const data = new HealAction(ally, 6).toData();
    const rehydrated = createAction(HEAL_ACTION_ID, data, world);
    rehydrated.start(healer, world);
    expect(ally.currentHp).toBe(ally.derived.maxHp - 4);
  });

  // F6 — the caster's utility-contribution ledger (read via the test-only
  // World.utilityDoneBy) is credited with the *effective* heal, so
  // computeXpAwards can pay the healer heal-XP at battle end.
  it('credits the caster utility ledger by the effective heal', () => {
    const { world, healer, ally } = scene();
    ally.currentHp = ally.derived.maxHp - 20;
    new HealAction(ally, 8).start(healer, world);
    expect(world.utilityDoneBy(healer.id)).toBe(8);
  });

  it('credits only the clamped delta when a heal overheals', () => {
    const { world, healer, ally } = scene();
    ally.currentHp = ally.derived.maxHp - 3;
    new HealAction(ally, 8).start(healer, world);
    // 3 effective HP restored, not the requested 8 — the overheal earns nothing.
    expect(world.utilityDoneBy(healer.id)).toBe(3);
  });

  it('credits nothing for a heal on a full-HP ally (no spam-XP)', () => {
    const { world, healer, ally } = scene();
    expect(ally.currentHp).toBe(ally.derived.maxHp);
    new HealAction(ally, 8).start(healer, world);
    expect(world.utilityDoneBy(healer.id)).toBe(0);
  });

  it('accumulates across multiple heals by the same caster', () => {
    const { world, healer, ally } = scene();
    ally.currentHp = ally.derived.maxHp - 20;
    new HealAction(ally, 5).start(healer, world);
    new HealAction(ally, 4).start(healer, world);
    expect(world.utilityDoneBy(healer.id)).toBe(9);
  });
});
