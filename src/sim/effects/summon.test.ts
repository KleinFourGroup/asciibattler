import { describe, it, expect } from 'vitest';
import { World, type WorldSnapshot } from '../World';
import type { Unit, Team, UnitStats } from '../Unit';
import { EventBus } from '../../core/EventBus';
import { RNG } from '../../core/RNG';
import type { GameEvents } from '../../core/events';
import type { GridCoord } from '../../core/types';
import type { AbilityDef, EffectOp, ScaledValue, SummonSpec, TargetSelector } from './schema';
import { parseAbilityDef } from './schema';
import { executeOp, newFireScratch, type OpFireContext } from './interpreter';
import type { EffectActionData } from './EffectAction';
import { proposeEffectAbility } from './propose';
import { nearestFreeCells } from '../actingPosition';

/**
 * §29d — the `summon` op, its placement BFS (`nearestFreeCells`), and the
 * per-caster `maxLive` cap, in isolation. Mechanic tests on explicit inputs: the
 * SUMMONED archetype is a stable existing one (`bandit`) — these assert WHERE /
 * HOW MANY / the cap / round-trip, never the shipped Ghoul's stats (the
 * balance-proof discipline; the §29d Ghoul/Shaman content is separate).
 *
 * Every unit is created through the World API (`spawnUnit` / `spawnEnvironment` /
 * `spawnSummon`) so the private id allocator stays consistent — the summon path's
 * `addUnit` shares it.
 */

const BASE: UnitStats = {
  constitution: 100, strength: 0, ranged: 0, magic: 0, luck: 0, defense: 0,
  precision: 0, evasion: 0, speed: 0, mobility: 0, power: 1,
};

function setup() {
  const bus = new EventBus<GameEvents>();
  const world = new World(bus, new RNG(1));
  return { world, bus };
}

/** A bare combatant placed via the World API (gets a real id + unitsById entry). */
function spawnAt(world: World, team: Team, pos: GridCoord): Unit {
  return world.spawnUnit({ archetype: 'mercenary', level: 1, stats: BASE, xp: 0 }, team, pos);
}

/** Occupy a cell with a neutral obstacle (a wall), to fence off the BFS. */
function block(world: World, pos: GridCoord): void {
  world.spawnEnvironment({ glyph: '#', position: pos });
}

function ctx(over: Partial<OpFireContext> & Pick<OpFireContext, 'caster' | 'world'>): OpFireContext {
  return {
    orphanPolicy: 'commit-at-cast',
    selector: { kind: 'self' } as TargetSelector,
    target: undefined,
    targetCell: undefined,
    resolution: {},
    phaseTicks: 0,
    remainingTicks: 0,
    fireScratch: newFireScratch(),
    ...over,
  };
}

/** A summon op over a stable existing archetype; `summon`/`at` overridable. */
const summonOp = (
  summon: Partial<SummonSpec> = {},
  at: TargetSelector = { kind: 'self' },
): EffectOp => ({
  kind: 'summon',
  summon: { archetype: 'bandit', level: 1, count: 1, maxLive: 3, radiusCells: 2, ...summon },
  at,
});

const cheb = (a: GridCoord, b: GridCoord): number =>
  Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y));

const minionsOf = (world: World, casterId: number): Unit[] =>
  world.units.filter((u) => u.summonedBy === casterId);

describe('nearestFreeCells — the placement BFS', () => {
  it('returns the nearest free cell when the anchor itself is occupied', () => {
    const { world } = setup();
    const anchor = { x: 5, y: 5 };
    block(world, anchor); // the anchor cell is taken (e.g. the caster stands here)
    const cells = nearestFreeCells(anchor, 1, 2, world);
    expect(cells).toHaveLength(1);
    expect(cheb(cells[0]!, anchor)).toBe(1); // an adjacent free cell
  });

  it('returns up to `count` distinct free cells', () => {
    const { world } = setup();
    const cells = nearestFreeCells({ x: 5, y: 5 }, 3, 2, world);
    expect(cells).toHaveLength(3);
    const keys = new Set(cells.map((c) => `${c.x},${c.y}`));
    expect(keys.size).toBe(3); // distinct
  });

  it('fizzles (returns []) when every cell within the radius is occupied', () => {
    const { world } = setup();
    const anchor = { x: 5, y: 5 };
    // Fill the anchor + all 8 neighbours (radius 1 fully blocked).
    block(world, anchor);
    for (let dx = -1; dx <= 1; dx++) {
      for (let dy = -1; dy <= 1; dy++) {
        if (dx === 0 && dy === 0) continue;
        block(world, { x: anchor.x + dx, y: anchor.y + dy });
      }
    }
    expect(nearestFreeCells(anchor, 1, 1, world)).toEqual([]);
  });

  it('expands THROUGH an occupied (passable) cell to a free cell on the far side', () => {
    const { world } = setup();
    const anchor = { x: 0, y: 5 }; // a wall edge so the only opening is rightward
    block(world, anchor);
    // Ring the anchor with units at radius 1 EXCEPT leave a free cell at radius 2.
    for (let dx = -1; dx <= 1; dx++) {
      for (let dy = -1; dy <= 1; dy++) {
        if (dx === 0 && dy === 0) continue;
        block(world, { x: anchor.x + dx, y: anchor.y + dy });
      }
    }
    const cells = nearestFreeCells(anchor, 1, 2, world); // radius 2 reaches past the ring
    expect(cells).toHaveLength(1);
    expect(cheb(cells[0]!, anchor)).toBe(2); // the far-side free cell
  });

  it('does not traverse an out-of-bounds or infinite-cost cell', () => {
    const { world } = setup();
    // Anchor in the corner: a generous radius must still stay on the board.
    const cells = nearestFreeCells({ x: 0, y: 0 }, 4, 4, world);
    for (const c of cells) {
      expect(c.x).toBeGreaterThanOrEqual(0);
      expect(c.y).toBeGreaterThanOrEqual(0);
      expect(c.x).toBeLessThan(world.gridW);
      expect(c.y).toBeLessThan(world.gridH);
    }
  });
});

describe('executeOp — summon (placement + attribution)', () => {
  it('places a minion in a free cell adjacent to the caster (at:self), attributed + on-team', () => {
    const { world } = setup();
    const caster = spawnAt(world, 'player', { x: 5, y: 5 });
    executeOp(summonOp(), ctx({ caster, world }));
    const minions = minionsOf(world, caster.id);
    expect(minions).toHaveLength(1);
    const m = minions[0]!;
    expect(m.team).toBe('player'); // the caster's team
    expect(m.archetype).toBe('bandit');
    expect(m.summonedBy).toBe(caster.id);
    expect(cheb(m.position, caster.position)).toBe(1); // adjacent (radius-bounded)
  });

  it('count > 1 fills the count nearest free cells', () => {
    const { world } = setup();
    const caster = spawnAt(world, 'player', { x: 5, y: 5 });
    executeOp(summonOp({ count: 3 }), ctx({ caster, world }));
    const minions = minionsOf(world, caster.id);
    expect(minions).toHaveLength(3);
    const cells = new Set(minions.map((m) => `${m.position.x},${m.position.y}`));
    expect(cells.size).toBe(3); // distinct cells, no stacking
    for (const m of minions) expect(cheb(m.position, caster.position)).toBeLessThanOrEqual(2);
  });

  it('fizzles (spawns nothing) when no free cell sits within the radius', () => {
    const { world } = setup();
    const caster = spawnAt(world, 'player', { x: 5, y: 5 });
    // Wall in every cell within radius 1 of the caster → a radius-1 summon fizzles.
    for (let dx = -1; dx <= 1; dx++) {
      for (let dy = -1; dy <= 1; dy++) {
        if (dx === 0 && dy === 0) continue;
        block(world, { x: 5 + dx, y: 5 + dy });
      }
    }
    executeOp(summonOp({ radiusCells: 1 }), ctx({ caster, world }));
    expect(minionsOf(world, caster.id)).toHaveLength(0);
  });

  it('anchors on the live target for a non-self `at` (flank summon)', () => {
    const { world } = setup();
    const caster = spawnAt(world, 'player', { x: 1, y: 1 });
    const target = spawnAt(world, 'enemy', { x: 9, y: 9 });
    executeOp(
      summonOp({}, { kind: 'enemyInRange' }),
      ctx({ caster, world, target }),
    );
    const m = minionsOf(world, caster.id)[0]!;
    expect(cheb(m.position, target.position)).toBeLessThanOrEqual(2); // beside the TARGET
    expect(cheb(m.position, caster.position)).toBeGreaterThan(2); // not beside the caster
  });

  it('placement is deterministic — identical setups summon identical cells (no RNG)', () => {
    const place = (): string[] => {
      const { world } = setup();
      const caster = spawnAt(world, 'player', { x: 5, y: 5 });
      executeOp(summonOp({ count: 3 }), ctx({ caster, world }));
      return minionsOf(world, caster.id).map((m) => `${m.position.x},${m.position.y}`);
    };
    expect(place()).toEqual(place());
  });
});

describe('summon — the per-caster maxLive cap', () => {
  it('stops summoning at maxLive and re-summons once a minion dies', () => {
    const { world } = setup();
    const caster = spawnAt(world, 'player', { x: 5, y: 5 });

    // Fill to the cap of 2.
    executeOp(summonOp({ maxLive: 2, count: 2 }), ctx({ caster, world }));
    expect(world.liveSummonCount(caster.id)).toBe(2);

    // At the cap → another cast spawns nothing.
    executeOp(summonOp({ maxLive: 2, count: 2 }), ctx({ caster, world }));
    expect(world.liveSummonCount(caster.id)).toBe(2);

    // A minion falls → room opens → the next cast refills exactly one slot.
    minionsOf(world, caster.id)[0]!.currentHp = 0;
    expect(world.liveSummonCount(caster.id)).toBe(1); // the dead one no longer counts
    executeOp(summonOp({ maxLive: 2, count: 2 }), ctx({ caster, world }));
    expect(world.liveSummonCount(caster.id)).toBe(2); // clamped to the one open slot
  });

  it('liveSummonCount counts only THIS caster\'s living minions', () => {
    const { world } = setup();
    const a = spawnAt(world, 'player', { x: 2, y: 2 });
    const b = spawnAt(world, 'player', { x: 9, y: 9 });
    executeOp(summonOp({ count: 2 }), ctx({ caster: a, world }));
    executeOp(summonOp({ count: 1 }), ctx({ caster: b, world }));
    expect(world.liveSummonCount(a.id)).toBe(2);
    expect(world.liveSummonCount(b.id)).toBe(1);
    expect(world.liveSummonCount(99999)).toBe(0); // an unrelated id → none
  });
});

describe('summon — propose-time cap gate', () => {
  // A minimal self-target summon ability (no shipped-content coupling).
  const def = parseAbilityDef({
    id: 'test_summon',
    name: 'Test Summon',
    cooldownSeconds: 3,
    rangeCells: 6,
    target: { kind: 'self' },
    timeline: [
      { phase: 'impact', seconds: 0 },
      { phase: 'recovery', seconds: 'fill' },
    ],
    orphanPolicy: 'commit-at-cast',
    priority: 10,
    effects: [
      {
        phase: 'impact',
        op: { kind: 'summon', summon: { archetype: 'bandit', maxLive: 2 }, at: { kind: 'self' } },
      },
    ],
  });

  it('proposes with room and abstains at the cap', () => {
    const { world } = setup();
    const caster = spawnAt(world, 'player', { x: 5, y: 5 });
    expect(proposeEffectAbility(def, caster, world)).not.toBeNull(); // 0 < maxLive 2

    world.spawnSummon('bandit', 1, 'player', { x: 4, y: 5 }, caster.id);
    world.spawnSummon('bandit', 1, 'player', { x: 6, y: 5 }, caster.id);
    expect(world.liveSummonCount(caster.id)).toBe(2);
    expect(proposeEffectAbility(def, caster, world)).toBeNull(); // at the cap → abstain
  });
});

describe('summon — level scaling (§31c)', () => {
  function summonDef(level: number | ScaledValue): AbilityDef {
    return parseAbilityDef({
      id: 'test_summon', name: 'Test Summon', cooldownSeconds: 3, rangeCells: 6,
      target: { kind: 'self' },
      timeline: [{ phase: 'impact', seconds: 0 }, { phase: 'recovery', seconds: 'fill' }],
      orphanPolicy: 'commit-at-cast', priority: 10,
      effects: [{ phase: 'impact', op: { kind: 'summon', summon: { archetype: 'bandit', level, maxLive: 3 }, at: { kind: 'self' } } }],
    });
  }
  function casterAtLevel(world: World, level: number): Unit {
    return world.spawnUnit({ archetype: 'mercenary', level, stats: BASE, xp: 0 }, 'player', { x: 5, y: 5 });
  }
  /** The summon level captured at propose (the def's effects are [summon] → ops[0]). */
  function capturedLevel(world: World, caster: Unit, level: number | ScaledValue): number | undefined {
    const p = proposeEffectAbility(summonDef(level), caster, world);
    expect(p).not.toBeNull();
    return (p!.action.toData() as EffectActionData).ops[0]!.summonLevel;
  }

  it('captures a bare-number level verbatim (byte-identical to today)', () => {
    const { world } = setup();
    expect(capturedLevel(world, casterAtLevel(world, 1), 3)).toBe(3);
  });

  it('scales the minion level off the summoner at cast ({stat:level, perPoint:1})', () => {
    const { world } = setup();
    expect(capturedLevel(world, casterAtLevel(world, 5), { base: 0, stat: 'level', perPoint: 1 })).toBe(5);
  });

  it('int-rounds a fractional scaled level at capture (Math.round, not truncate)', () => {
    const { world } = setup();
    // 0.6 + 1×5 = 5.6 → round → 6 (a floor would give 5)
    expect(capturedLevel(world, casterAtLevel(world, 5), { base: 0.6, stat: 'level', perPoint: 1 })).toBe(6);
  });

  it('clamps the captured level to ≥ 1', () => {
    const { world } = setup();
    // 0 + 0×level = 0 → max(1, round(0)) = 1
    expect(capturedLevel(world, casterAtLevel(world, 1), { base: 0, stat: 'level', perPoint: 0 })).toBe(1);
  });

  it('executeSummon spawns the minion at the captured level (consumes the resolution)', () => {
    const { world } = setup();
    const caster = spawnAt(world, 'player', { x: 5, y: 5 });
    executeOp(summonOp(), ctx({ caster, world, resolution: { summonLevel: 4 } }));
    expect(minionsOf(world, caster.id)[0]!.level).toBe(4);
  });

  it('defaults to level 1 when the resolution lacks summonLevel (defensive)', () => {
    const { world } = setup();
    const caster = spawnAt(world, 'player', { x: 5, y: 5 });
    executeOp(summonOp(), ctx({ caster, world })); // resolution {} → `?? 1`
    expect(minionsOf(world, caster.id)[0]!.level).toBe(1);
  });
});

describe('summon — snapshot round-trip (WorldSnapshot v29)', () => {
  it('preserves summonedBy across toJSON/fromJSON', () => {
    const { world } = setup();
    const caster = spawnAt(world, 'player', { x: 5, y: 5 });
    executeOp(summonOp({ count: 2 }), ctx({ caster, world }));

    const wire = JSON.parse(JSON.stringify(world.toJSON())) as WorldSnapshot;
    const restored = World.fromJSON(wire, new EventBus<GameEvents>());

    const minions = minionsOf(restored, caster.id);
    expect(minions).toHaveLength(2);
    for (const m of minions) expect(m.summonedBy).toBe(caster.id);
    // The non-summoned caster round-trips with a null attribution.
    expect(restored.findUnit(caster.id)!.summonedBy).toBeNull();
  });

  it('rejects a pre-29 (v28) snapshot per the no-migration contract', () => {
    const { world } = setup();
    spawnAt(world, 'player', { x: 5, y: 5 });
    const stale = { ...world.toJSON(), schemaVersion: 28 } as unknown as WorldSnapshot;
    expect(() => World.fromJSON(stale, new EventBus<GameEvents>())).toThrow(/schema version/);
  });
});
