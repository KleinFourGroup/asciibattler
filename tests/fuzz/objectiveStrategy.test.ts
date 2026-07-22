/**
 * J4 commit 1 — the objective-strategy primitives: the proclivity selector, the
 * no-thrash per-tick gate, and the JSON/menu plumbing. Uses explicit literals
 * (not the shipped balance config) for the mechanic checks; the menu-size check
 * derives from `STAT_KEYS` so a new stat doesn't silently leave the menu stale.
 */

import { describe, it, expect } from 'vitest';
import { EventBus } from '../../src/core/EventBus';
import { RNG } from '../../src/core/RNG';
import { World } from '../../src/sim/World';
import { scaledUnit, ALL_ARCHETYPES, type Archetype } from '../../src/sim/archetypes';
import type { GameEvents } from '../../src/core/events';
import type { GridCoord } from '../../src/core/types';
import type { Team, UnitStats, UnitTemplate } from '../../src/sim/Unit';
import {
  selectObjectiveTarget,
  decideObjectiveCommand,
  parseProclivity,
  parseObjectiveFlag,
  serializeProclivity,
  objectiveMenu,
  proclivityLabel,
  type ObjectiveProclivity,
  type ScoredObjectiveWeights,
} from './objectiveStrategy';
import { STAT_KEYS } from './strategies/policies';

/** All-zero weight vector — tests poke individual terms from here. */
function zeroWeights(): {
  stats: Record<keyof UnitStats, number>;
  hp: number;
  archetype: Record<Archetype, number>;
} {
  return {
    stats: Object.fromEntries(STAT_KEYS.map((k) => [k, 0])) as Record<keyof UnitStats, number>,
    hp: 0,
    archetype: Object.fromEntries(ALL_ARCHETYPES.map((a) => [a, 0])) as Record<Archetype, number>,
  };
}

function scored(weights: ScoredObjectiveWeights): ObjectiveProclivity {
  return { kind: 'scored', weights };
}

function makeWorld(): World {
  return new World(new EventBus<GameEvents>(), new RNG(1), 12, 12);
}

const BASE = scaledUnit('archer', 1).stats;

function spawn(
  world: World,
  team: Team,
  cell: GridCoord,
  overrides: Partial<UnitStats> = {},
) {
  const template: UnitTemplate = {
    archetype: 'archer',
    level: 1,
    stats: { ...BASE, ...overrides },
    xp: 0,
  };
  return world.spawnUnit(template, team, cell, null);
}

function spawnArch(world: World, team: Team, cell: GridCoord, archetype: Archetype) {
  return world.spawnUnit(scaledUnit(archetype, 1), team, cell, null);
}

describe('selectObjectiveTarget', () => {
  const rng = () => new RNG(42);

  it('returns null for the `none` proclivity even with enemies present', () => {
    const world = makeWorld();
    spawn(world, 'enemy', { x: 1, y: 1 });
    expect(selectObjectiveTarget(world, { kind: 'none' }, rng())).toBeNull();
  });

  it('returns null when there are no living enemies', () => {
    const world = makeWorld();
    expect(selectObjectiveTarget(world, { kind: 'random' }, rng())).toBeNull();
  });

  it('stat:highest picks the enemy with the greatest stat', () => {
    const world = makeWorld();
    spawn(world, 'enemy', { x: 1, y: 1 }, { strength: 2 });
    const top = spawn(world, 'enemy', { x: 2, y: 1 }, { strength: 9 });
    spawn(world, 'enemy', { x: 3, y: 1 }, { strength: 5 });
    expect(
      selectObjectiveTarget(world, { kind: 'stat', select: 'highest', stat: 'strength' }, rng()),
    ).toBe(top.id);
  });

  it('stat:lowest picks the enemy with the smallest stat', () => {
    const world = makeWorld();
    spawn(world, 'enemy', { x: 1, y: 1 }, { strength: 7 });
    const bottom = spawn(world, 'enemy', { x: 2, y: 1 }, { strength: 1 });
    spawn(world, 'enemy', { x: 3, y: 1 }, { strength: 4 });
    expect(
      selectObjectiveTarget(world, { kind: 'stat', select: 'lowest', stat: 'strength' }, rng()),
    ).toBe(bottom.id);
  });

  it('hp:lowest picks the enemy with the least CURRENT health', () => {
    const world = makeWorld();
    const hurt = spawn(world, 'enemy', { x: 1, y: 1 });
    const healthy = spawn(world, 'enemy', { x: 2, y: 1 });
    hurt.currentHp = 3;
    healthy.currentHp = 20;
    expect(selectObjectiveTarget(world, { kind: 'hp', select: 'lowest' }, rng())).toBe(hurt.id);
    expect(selectObjectiveTarget(world, { kind: 'hp', select: 'highest' }, rng())).toBe(healthy.id);
  });

  it('only considers enemy units (ignores player + neutral)', () => {
    const world = makeWorld();
    spawn(world, 'player', { x: 1, y: 1 }, { strength: 99 }); // huge, but wrong team
    const target = spawn(world, 'enemy', { x: 2, y: 1 }, { strength: 5 });
    expect(
      selectObjectiveTarget(world, { kind: 'stat', select: 'highest', stat: 'strength' }, rng()),
    ).toBe(target.id);
  });

  it('ignores dead enemies (currentHp <= 0)', () => {
    const world = makeWorld();
    const dead = spawn(world, 'enemy', { x: 1, y: 1 }, { strength: 99 });
    const alive = spawn(world, 'enemy', { x: 2, y: 1 }, { strength: 3 });
    dead.currentHp = 0;
    expect(
      selectObjectiveTarget(world, { kind: 'stat', select: 'highest', stat: 'strength' }, rng()),
    ).toBe(alive.id);
  });

  it('random returns one of the living-enemy ids', () => {
    const world = makeWorld();
    const a = spawn(world, 'enemy', { x: 1, y: 1 });
    const b = spawn(world, 'enemy', { x: 2, y: 1 });
    const picked = selectObjectiveTarget(world, { kind: 'random' }, rng());
    expect([a.id, b.id]).toContain(picked);
  });

  it('breaks stat ties by ascending unit id (deterministic, no RNG)', () => {
    const world = makeWorld();
    const first = spawn(world, 'enemy', { x: 1, y: 1 }, { strength: 5 });
    spawn(world, 'enemy', { x: 2, y: 1 }, { strength: 5 });
    expect(
      selectObjectiveTarget(world, { kind: 'stat', select: 'highest', stat: 'strength' }, rng()),
    ).toBe(first.id); // lower id wins the tie
  });

  it('archetype picks a living enemy of that archetype ("focus the X")', () => {
    const world = makeWorld();
    spawnArch(world, 'enemy', { x: 1, y: 1 }, 'archer');
    const bandit = spawnArch(world, 'enemy', { x: 2, y: 1 }, 'bandit');
    expect(selectObjectiveTarget(world, { kind: 'archetype', archetype: 'bandit' }, rng())).toBe(
      bandit.id,
    );
  });

  it('archetype returns null when no living enemy matches', () => {
    const world = makeWorld();
    spawnArch(world, 'enemy', { x: 1, y: 1 }, 'archer');
    expect(
      selectObjectiveTarget(world, { kind: 'archetype', archetype: 'mage' }, rng()),
    ).toBeNull();
  });

  it('archetype breaks ties by ascending unit id', () => {
    const world = makeWorld();
    const first = spawnArch(world, 'enemy', { x: 1, y: 1 }, 'bandit');
    spawnArch(world, 'enemy', { x: 2, y: 1 }, 'bandit');
    expect(selectObjectiveTarget(world, { kind: 'archetype', archetype: 'bandit' }, rng())).toBe(
      first.id,
    );
  });
});

describe('selectObjectiveTarget — scored proclivity', () => {
  const rng = () => new RNG(42);

  it('a one-hot +stat weight reproduces stat:highest (menu-corner equivalence)', () => {
    const world = makeWorld();
    spawn(world, 'enemy', { x: 1, y: 1 }, { strength: 2 });
    spawn(world, 'enemy', { x: 2, y: 1 }, { strength: 9 });
    spawn(world, 'enemy', { x: 3, y: 1 }, { strength: 5 });
    const w = zeroWeights();
    w.stats.strength = 1;
    expect(selectObjectiveTarget(world, scored(w), rng())).toBe(
      selectObjectiveTarget(world, { kind: 'stat', select: 'highest', stat: 'strength' }, rng()),
    );
  });

  it('a one-hot −stat weight reproduces stat:lowest', () => {
    const world = makeWorld();
    spawn(world, 'enemy', { x: 1, y: 1 }, { strength: 7 });
    spawn(world, 'enemy', { x: 2, y: 1 }, { strength: 1 });
    spawn(world, 'enemy', { x: 3, y: 1 }, { strength: 4 });
    const w = zeroWeights();
    w.stats.strength = -1;
    expect(selectObjectiveTarget(world, scored(w), rng())).toBe(
      selectObjectiveTarget(world, { kind: 'stat', select: 'lowest', stat: 'strength' }, rng()),
    );
  });

  it('a one-hot ±hp weight reproduces hp:highest / hp:lowest', () => {
    const world = makeWorld();
    const hurt = spawn(world, 'enemy', { x: 1, y: 1 });
    const healthy = spawn(world, 'enemy', { x: 2, y: 1 });
    hurt.currentHp = 3;
    healthy.currentHp = 20;
    const hi = zeroWeights();
    hi.hp = 1;
    const lo = zeroWeights();
    lo.hp = -1;
    expect(selectObjectiveTarget(world, scored(hi), rng())).toBe(healthy.id);
    expect(selectObjectiveTarget(world, scored(lo), rng())).toBe(hurt.id);
  });

  it('archetype affinity steers between otherwise-equal enemies', () => {
    const world = makeWorld();
    spawnArch(world, 'enemy', { x: 1, y: 1 }, 'archer');
    const bandit = spawnArch(world, 'enemy', { x: 2, y: 1 }, 'bandit');
    const w = zeroWeights();
    w.archetype.bandit = 1;
    expect(selectObjectiveTarget(world, scored(w), rng())).toBe(bandit.id);
  });

  it('expresses the combo the menu cannot: the WOUNDED MAGE (hp:low × archetype)', () => {
    const world = makeWorld();
    const bandit = spawnArch(world, 'enemy', { x: 1, y: 1 }, 'bandit');
    const woundedMage = spawnArch(world, 'enemy', { x: 2, y: 1 }, 'mage');
    const healthyMage = spawnArch(world, 'enemy', { x: 3, y: 1 }, 'mage');
    bandit.currentHp = 1; // the GLOBAL lowest hp — hp:lowest alone would pick it
    woundedMage.currentHp = 5;
    healthyMage.currentHp = 10;
    const w = zeroWeights();
    w.archetype.mage = 2; // dominate: must be a mage…
    w.hp = -1; // …then prefer the wounded one
    expect(selectObjectiveTarget(world, scored(w), rng())).toBe(woundedMage.id);
  });

  it('all-zero weights fall back to the ascending-id tie-break (deterministic)', () => {
    const world = makeWorld();
    const first = spawn(world, 'enemy', { x: 1, y: 1 });
    spawn(world, 'enemy', { x: 2, y: 1 });
    expect(selectObjectiveTarget(world, scored(zeroWeights()), rng())).toBe(first.id);
  });

  it('consumes no RNG (the objective stream advances only for `random`)', () => {
    const world = makeWorld();
    spawn(world, 'enemy', { x: 1, y: 1 }, { strength: 2 });
    spawn(world, 'enemy', { x: 2, y: 1 }, { strength: 9 });
    const w = zeroWeights();
    w.stats.strength = 1;
    const used = new RNG(7);
    selectObjectiveTarget(world, scored(w), used);
    expect(used.next()).toBe(new RNG(7).next()); // stream untouched
  });

  it('feeds the no-thrash gate like any other proclivity', () => {
    const world = makeWorld();
    const target = spawn(world, 'enemy', { x: 1, y: 1 }, { strength: 9 });
    spawn(world, 'enemy', { x: 2, y: 1 }, { strength: 2 });
    const w = zeroWeights();
    w.stats.strength = 1;
    expect(decideObjectiveCommand(world, scored(w), new RNG(1))).toEqual({
      kind: 'setObjective',
      team: 'player',
      objective: { mode: 'engage', target: { kind: 'enemy', unitId: target.id } },
    });
  });
});

describe('decideObjectiveCommand (the no-thrash gate)', () => {
  it('returns null for `none`', () => {
    const world = makeWorld();
    spawn(world, 'enemy', { x: 1, y: 1 });
    expect(decideObjectiveCommand(world, { kind: 'none' }, new RNG(1))).toBeNull();
  });

  it('sets an enemy objective when none is active', () => {
    const world = makeWorld();
    const target = spawn(world, 'enemy', { x: 1, y: 1 }, { strength: 9 });
    const cmd = decideObjectiveCommand(
      world,
      { kind: 'stat', select: 'highest', stat: 'strength' },
      new RNG(1),
    );
    expect(cmd).toEqual({
      kind: 'setObjective',
      team: 'player',
      objective: { mode: 'engage', target: { kind: 'enemy', unitId: target.id } },
    });
  });

  it('does not re-set while an objective is already active (no thrash)', () => {
    const world = makeWorld();
    spawn(world, 'player', { x: 1, y: 1 });
    const enemy = spawn(world, 'enemy', { x: 5, y: 5 });
    world.enqueueCommand({
      kind: 'setObjective',
      team: 'player',
      objective: { mode: 'engage', target: { kind: 'enemy', unitId: enemy.id } },
    });
    world.tick(); // drains the command → objective is now active
    expect(world.objectiveFor('player').mode).toBe('engage');
    expect(decideObjectiveCommand(world, { kind: 'random' }, new RNG(1))).toBeNull();
  });
});

describe('proclivity JSON + flag parsing', () => {
  it('round-trips a stat proclivity through serialize → parse', () => {
    const p = { kind: 'stat', select: 'lowest', stat: 'evasion' } as const;
    expect(parseProclivity(JSON.parse(serializeProclivity(p)))).toEqual(p);
  });

  it('parses the built-in modes and inline forms', () => {
    expect(parseObjectiveFlag('none')).toEqual({ kind: 'none' });
    expect(parseObjectiveFlag('random')).toEqual({ kind: 'random' });
    expect(parseObjectiveFlag('hp:lowest')).toEqual({ kind: 'hp', select: 'lowest' });
    expect(parseObjectiveFlag('stat:strength:highest')).toEqual({
      kind: 'stat',
      select: 'highest',
      stat: 'strength',
    });
    expect(parseObjectiveFlag('archetype:mage')).toEqual({ kind: 'archetype', archetype: 'mage' });
  });

  it('rejects an unknown stat key or archetype (zod)', () => {
    expect(() => parseProclivity({ kind: 'stat', select: 'highest', stat: 'charisma' })).toThrow();
    expect(() => parseProclivity({ kind: 'archetype', archetype: 'wizard' })).toThrow();
  });

  it('round-trips a scored proclivity through serialize → parse', () => {
    const p = scored(zeroWeights());
    expect(parseProclivity(JSON.parse(serializeProclivity(p)))).toEqual(p);
    expect(proclivityLabel(p)).toBe('scored');
  });

  it('rejects a malformed scored weight vector (missing stat / extra field)', () => {
    const missing = zeroWeights() as { stats: Record<string, number> };
    delete missing.stats[String(STAT_KEYS[0])];
    expect(() => parseProclivity({ kind: 'scored', weights: missing })).toThrow();
    expect(() =>
      parseProclivity({ kind: 'scored', weights: { ...zeroWeights(), extra: 1 } }),
    ).toThrow();
  });

  it('rejects a garbage flag value', () => {
    expect(() => parseObjectiveFlag('biggest-nose')).toThrow();
  });
});

describe('objectiveMenu', () => {
  it('covers none + random + hp×2 + 2 per stat key + one per archetype', () => {
    // Config-derived expectation: 4 fixed + 2 per base stat + 1 per archetype.
    expect(objectiveMenu()).toHaveLength(4 + 2 * STAT_KEYS.length + ALL_ARCHETYPES.length);
  });

  it('every menu entry validates and its label matches proclivityLabel', () => {
    for (const entry of objectiveMenu()) {
      expect(parseProclivity(JSON.parse(serializeProclivity(entry.proclivity)))).toEqual(
        entry.proclivity,
      );
      expect(proclivityLabel(entry.proclivity)).toBe(entry.label);
    }
  });

  it('does NOT include scored (not enumerable — the vector search owns it)', () => {
    expect(objectiveMenu().every((e) => e.proclivity.kind !== 'scored')).toBe(true);
  });
});
