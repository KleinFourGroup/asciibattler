/**
 * E1 — coverage for `deriveStats`, `basicAttackDamage`, `inertDerived`,
 * and the `world.combatRng` crit-roll determinism contract.
 *
 * Formula-level tests are table-driven against the JSON-authored
 * constants in `config/stats.json` so tuning the knobs doesn't force a
 * separate test churn. Edge cases (constitution=0 → maxHp=1 floor,
 * luck=99 → critCap, high stat → the per-axis min-scale floor) are pinned
 * explicitly so a regression on the guards surfaces loudly.
 *
 * GP1: the move axis (`mobility`) and attack axis (`speed`; I1 reverted the
 * GP1 `agility` name) read SEPARATE cooldown knobs
 * (`mobilityCdPerStat`/`mobilityMinCdScale` vs the speed pair), so the formula
 * tests derive each expectation from its own axis's knobs and a divergence
 * guard pins that the two helpers don't share a knob.
 */

import { describe, it, expect } from 'vitest';
import { RNG } from '../core/RNG';
import { EventBus } from '../core/EventBus';
import { World } from './World';
import { Unit, type UnitStats } from './Unit';
import { AbilityBehavior } from './behaviors/AbilityBehavior';
import { createAbility } from './abilities/registry';
import {
  ZERO_STATS,
  basicAttackDamage,
  critChanceFor,
  deriveStats,
  hitChanceFor,
  inertDerived,
  attackCooldownTicksFor,
} from './stats';
import { abilityDef } from '../config/abilities';
import { STATS } from '../config/stats';
import { ARCHETYPE_CONFIG } from './archetypes';
import { secondsToTicks, ticksToSeconds } from '../config';
import type { GameEvents } from '../core/events';

const TEMPLATE: UnitStats = {
  constitution: 20,
  strength: 8,
  ranged: 0,
  magic: 0,
  luck: 3,
  defense: 0,
  precision: 5,
  evasion: 5,
  speed: 5,
  mobility: 2,
  power: 1,
};

describe('deriveStats — maxHp', () => {
  it('scales linearly with constitution at the configured rate', () => {
    for (const con of [1, 5, 10, 20, 40]) {
      const d = deriveStats({ ...TEMPLATE, constitution: con }, 1);
      expect(d.maxHp).toBe(Math.round(STATS.hpPerConstitution * con));
    }
  });

  it('floors at 1 even when constitution=0', () => {
    const d = deriveStats({ ...TEMPLATE, constitution: 0 }, 1);
    expect(d.maxHp).toBe(1);
  });
});

describe('critChanceFor — I6 per-ability crit (balance-proof off config/stats.json)', () => {
  it('is critBase + luck × critPerLuck below the cap', () => {
    for (const critBase of [0, 0.05, 0.2]) {
      for (const luck of [0, 1, 5, 10, 30]) {
        expect(critChanceFor(critBase, luck)).toBeCloseTo(
          critBase + luck * STATS.critPerLuck,
          10,
        );
      }
    }
  });

  it('clamps at critCap for a high base + lucky unit (a katana on a Ronin caps sooner)', () => {
    // critBase 0.2 + luck 99 × 0.01 = 1.19, well past the cap.
    expect(critChanceFor(0.2, 99)).toBe(STATS.critCap);
  });

  it('critBase 0 reproduces the pre-I6 luck-only crit exactly (byte-identical canary)', () => {
    // The old deriveStats value was min(critCap, luck × critPerLuck); with
    // critBase 0 the new helper must equal it for every luck.
    for (const luck of [0, 3, 12, 50, 99]) {
      expect(critChanceFor(0, luck)).toBe(Math.min(STATS.critCap, luck * STATS.critPerLuck));
    }
  });
});

describe('hitChanceFor — I2/I6 dodge to-hit (balance-proof off config/stats.json)', () => {
  // I6 — accuracy is the firing weapon's per-ability base (no global
  // hitChanceBase anymore). hitChanceFor is a primitive, so these mechanic
  // tests pass an explicit accuracy literal rather than reading the JSON.
  const ACC = 0.6;

  it('equal precision and evasion cancel to exactly the weapon accuracy', () => {
    // The keystone of I1's uniform prc==eva==5 default: with the terms
    // cancelling, every unit sits at the weapon's accuracy until I5 spreads the
    // stats.
    for (const s of [0, 5, 12, 40]) {
      expect(hitChanceFor(ACC, s, s)).toBeCloseTo(ACC, 10);
    }
  });

  it('matches the subtractive formula in the unclamped middle band', () => {
    // Pick prc/eva spreads small enough that the result stays strictly inside
    // (floor, cap), so the clamp is inert and the raw formula is what's tested.
    for (const [prc, eva] of [
      [8, 5],
      [5, 8],
      [10, 2],
      [3, 9],
    ] as const) {
      const expected =
        ACC + prc * STATS.hitChancePerPrecision - eva * STATS.dodgeChancePerEvasion;
      expect(hitChanceFor(ACC, prc, eva)).toBeCloseTo(expected, 10);
    }
  });

  it('a higher weapon accuracy raises the hit chance (the per-weapon base lever)', () => {
    expect(hitChanceFor(0.85, 5, 5)).toBeGreaterThan(hitChanceFor(0.4, 5, 5));
  });

  it('is monotonic: more precision never lowers, more evasion never raises hit chance', () => {
    expect(hitChanceFor(ACC, 20, 5)).toBeGreaterThanOrEqual(hitChanceFor(ACC, 5, 5));
    expect(hitChanceFor(ACC, 5, 20)).toBeLessThanOrEqual(hitChanceFor(ACC, 5, 5));
  });

  it('clamps to the floor when evasion overwhelms precision (chip still pokes through)', () => {
    // A wildly evasive target vs a low-precision attacker bottoms out at the
    // floor, never 0 — the whiff analogue of the minDamage floor.
    expect(hitChanceFor(ACC, 0, 99)).toBe(STATS.hitChanceFloor);
  });

  it('clamps to the cap when precision overwhelms evasion', () => {
    expect(hitChanceFor(ACC, 99, 0)).toBe(STATS.hitChanceCap);
  });

  it('always returns a probability within [floor, cap]', () => {
    for (const prc of [0, 5, 25, 99]) {
      for (const eva of [0, 5, 25, 99]) {
        const p = hitChanceFor(ACC, prc, eva);
        expect(p).toBeGreaterThanOrEqual(STATS.hitChanceFloor);
        expect(p).toBeLessThanOrEqual(STATS.hitChanceCap);
      }
    }
  });
});

describe('deriveStats — move cooldown', () => {
  it('moveCooldownTicks shrinks with positive mobility via cooldownScale', () => {
    const d = deriveStats({ ...TEMPLATE, mobility: 2 }, 1);
    const expectedScale = 1 - 2 * STATS.mobilityCdPerStat;
    const expected = Math.max(
      1,
      secondsToTicks(STATS.baseMoveCooldownSeconds * expectedScale),
    );
    expect(d.moveCooldownTicks).toBe(expected);
  });

  it('negative mobility is SLOWER than the mobility=0 baseline (floor caps only the fast side)', () => {
    const baseline = deriveStats({ ...TEMPLATE, mobility: 0 }, 1).moveCooldownTicks;
    const slow = deriveStats({ ...TEMPLATE, mobility: -7 }, 1).moveCooldownTicks;
    // scale at mobility=0 is exactly 1.0; at -7 it's 1 + 7×rate > 1, and the
    // min-scale floor (a fast-side cap) does NOT clamp it — so the slow unit's
    // move CD strictly exceeds the baseline.
    expect(slow).toBeGreaterThan(baseline);
    const expectedSlow = Math.max(
      1,
      secondsToTicks(STATS.baseMoveCooldownSeconds * (1 - -7 * STATS.mobilityCdPerStat)),
    );
    expect(slow).toBe(expectedSlow);
  });

  it('cooldownScale floors at mobilityMinCdScale for very high mobility', () => {
    // Pick stat so that 1 - stat × mobilityCdPerStat < mobilityMinCdScale.
    const d = deriveStats({ ...TEMPLATE, mobility: 99 }, 1);
    const flooredMove = Math.max(
      1,
      secondsToTicks(STATS.baseMoveCooldownSeconds * STATS.mobilityMinCdScale),
    );
    expect(d.moveCooldownTicks).toBe(flooredMove);
  });

  it('moveCooldownTicks floors at 1 (defense against absurd base/scale combos)', () => {
    // The Math.max(1, ...) wrapping in deriveStats catches future tunings
    // that would otherwise round to 0. Hard to exercise with default
    // config; the test pins the floor so a regression on the wrapping
    // is loud.
    const d = deriveStats({ ...TEMPLATE, mobility: 99 }, 1);
    expect(d.moveCooldownTicks).toBeGreaterThanOrEqual(1);
  });
});

describe('attackCooldownTicksFor — per-ability attack cadence', () => {
  // E5 pre-work: attack cadence left `deriveStats` for the Ability
  // layer. These mirror the old deriveStats attack-CD tests but against
  // the new helper, deriving the base seconds from `config/abilities.json`
  // so a cadence re-tune doesn't churn the test.
  const base = abilityDef('sword').cooldownSeconds;

  it('shrinks with speed via cooldownScale', () => {
    const expectedScale = 1 - 5 * STATS.speedCdPerStat;
    const expected = Math.max(1, secondsToTicks(base * expectedScale));
    expect(attackCooldownTicksFor(base, 5)).toBe(expected);
  });

  it('floors at speedMinCdScale for very high speed', () => {
    const floored = Math.max(1, secondsToTicks(base * STATS.speedMinCdScale));
    expect(attackCooldownTicksFor(base, 99)).toBe(floored);
  });

  it('floors at 1 tick (defense against absurd base/scale combos)', () => {
    expect(attackCooldownTicksFor(0.001, 99)).toBeGreaterThanOrEqual(1);
  });
});

describe('mobility / speed axes are independent (GP1 split guard)', () => {
  it('move CD uses the mobility knobs and attack CD uses the speed knobs', () => {
    // Same +stat through both axes. Each helper must resolve through its OWN
    // axis's knobs — derive both expectations straight from STATS so the
    // assertions survive any future re-tune that keeps the rates distinct.
    const stat = 3;
    const baseSeconds = 1;
    const moveScale = Math.max(STATS.mobilityMinCdScale, 1 - stat * STATS.mobilityCdPerStat);
    const attackScale = Math.max(STATS.speedMinCdScale, 1 - stat * STATS.speedCdPerStat);

    expect(deriveStats({ ...TEMPLATE, mobility: stat }, 1).moveCooldownTicks).toBe(
      Math.max(1, secondsToTicks(STATS.baseMoveCooldownSeconds * moveScale)),
    );
    expect(attackCooldownTicksFor(baseSeconds, stat)).toBe(
      Math.max(1, secondsToTicks(baseSeconds * attackScale)),
    );
    // The shipped config gives the two axes distinct slopes, so the same +stat
    // resolves to different scales. A regression that crosses the wires (one
    // helper reading the other's knob) would collapse them — this catches it.
    expect(moveScale).not.toBeCloseTo(attackScale, 10);
  });
});

describe('catapult move cadence (universal base, no per-archetype override)', () => {
  it('reproduces the heavy ~2.0s walk from its negative mobility alone', () => {
    const mob = ARCHETYPE_CONFIG.catapult.baseStats.mobility;
    const scale = Math.max(STATS.mobilityMinCdScale, 1 - mob * STATS.mobilityCdPerStat);
    const expected = Math.max(1, secondsToTicks(STATS.baseMoveCooldownSeconds * scale));
    const d = deriveStats(ARCHETYPE_CONFIG.catapult.baseStats, 1);
    // GP1 dropped the per-archetype baseMoveCooldownSeconds override; the slow
    // walk now comes from mobility alone under the universal base.
    expect(d.moveCooldownTicks).toBe(expected);
    expect(ticksToSeconds(d.moveCooldownTicks)).toBeGreaterThan(1.5);
    expect(ticksToSeconds(d.moveCooldownTicks)).toBeLessThan(2.5);
  });
});

describe('deriveStats — attackRange', () => {
  it('passes through the per-archetype primitive verbatim', () => {
    expect(deriveStats(TEMPLATE, 1).attackRange).toBe(1);
    expect(deriveStats(TEMPLATE, 3).attackRange).toBe(3);
    expect(deriveStats(TEMPLATE, 7).attackRange).toBe(7);
  });
});

describe('inertDerived', () => {
  it('produces a degenerate derived block with the requested maxHp', () => {
    const d = inertDerived(5);
    expect(d.maxHp).toBe(5);
    expect(d.moveCooldownTicks).toBe(0);
    expect(d.attackRange).toBe(0);
  });
});

describe('basicAttackDamage', () => {
  function makeUnit(arch: 'mercenary' | 'ranged' | 'environment', stats: UnitStats): Unit {
    return new Unit({
      id: 1,
      team: arch === 'environment' ? 'neutral' : 'player',
      archetype: arch,
      glyph: arch === 'mercenary' ? 'M' : arch === 'ranged' ? 'a' : '#',
      stats,
      derived: arch === 'environment' ? inertDerived(1) : deriveStats(stats, 1),
      position: { x: 0, y: 0 },
    });
  }

  it('melee → might + strength', () => {
    const u = makeUnit('mercenary', { ...TEMPLATE, strength: 13 });
    expect(basicAttackDamage(u, 0)).toBe(13); // no might → bare stat
    expect(basicAttackDamage(u, 5)).toBe(18); // I6: weapon might adds on top
  });

  it('ranged → might + ranged stat', () => {
    const u = makeUnit('ranged', { ...TEMPLATE, ranged: 7 });
    expect(basicAttackDamage(u, 0)).toBe(7);
    expect(basicAttackDamage(u, 2)).toBe(9);
  });

  it('environment → might only (walls never strike, 0 scaling stat)', () => {
    const u = makeUnit('environment', ZERO_STATS);
    expect(basicAttackDamage(u, 0)).toBe(0);
  });
});

describe('combatRng determinism', () => {
  it('same seed → same crit decision sequence', () => {
    // Build a minimal "attacker adjacent to a punching-bag target" scene
    // for each of two worlds with identical seeds. Run a fixed number of
    // ticks, compare the `crit` field on every emitted unit:attacked.
    function trace(seed: number): boolean[] {
      const bus = new EventBus<GameEvents>();
      const world = new World(bus, new RNG(seed));
      const out: boolean[] = [];
      bus.on('unit:attacked', (p) => out.push(p.crit));

      // Attacker: high-luck so crits actually fire across the sample.
      const attackerStats: UnitStats = { ...TEMPLATE, luck: 30 };
      const attacker = new Unit({
        id: 1,
        team: 'player',
        archetype: 'mercenary',
        glyph: 'M',
        stats: attackerStats,
        derived: deriveStats(attackerStats, 1),
        position: { x: 0, y: 0 },
      });
      attacker.behaviors.push(new AbilityBehavior());
      attacker.abilities.push(createAbility('sword'));

      // Target: huge HP so it doesn't die before the trace finishes.
      const targetStats: UnitStats = { ...TEMPLATE, constitution: 99 };
      const target = new Unit({
        id: 2,
        team: 'enemy',
        archetype: 'mercenary',
        glyph: 'M',
        stats: targetStats,
        derived: deriveStats(targetStats, 1),
        position: { x: 1, y: 0 },
      });
      world.units.push(attacker, target);

      for (let i = 0; i < 200; i++) world.tick();
      return out;
    }

    const a = trace(42);
    const b = trace(42);
    expect(a).toEqual(b);
    expect(a.some((c) => c)).toBe(true); // at least one crit fired
    expect(a.some((c) => !c)).toBe(true); // and at least one non-crit
  });

  it('different seeds produce different crit sequences (high probability)', () => {
    function trace(seed: number): boolean[] {
      const bus = new EventBus<GameEvents>();
      const world = new World(bus, new RNG(seed));
      const out: boolean[] = [];
      bus.on('unit:attacked', (p) => out.push(p.crit));

      const stats: UnitStats = { ...TEMPLATE, luck: 30, constitution: 99 };
      const derived = deriveStats(stats, 1);
      const a = new Unit({
        id: 1, team: 'player', archetype: 'mercenary', glyph: 'M',
        stats, derived, position: { x: 0, y: 0 },
      });
      a.behaviors.push(new AbilityBehavior());
      a.abilities.push(createAbility('sword'));
      const t = new Unit({
        id: 2, team: 'enemy', archetype: 'mercenary', glyph: 'M',
        stats, derived, position: { x: 1, y: 0 },
      });
      world.units.push(a, t);
      for (let i = 0; i < 200; i++) world.tick();
      return out;
    }
    expect(trace(1)).not.toEqual(trace(2));
  });
});
