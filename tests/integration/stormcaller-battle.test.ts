import { describe, it, expect } from 'vitest';
import { World } from '../../src/sim/World';
import { EventBus } from '../../src/core/EventBus';
import { RNG } from '../../src/core/RNG';
import type { GameEvents } from '../../src/core/events';
import { spawnEncounter } from '../../src/sim/battleSetup';
import { rollUnit } from '../../src/sim/archetypes';
import type { BattleEncounter } from '../../src/run/Run';

/**
 * §29c — integration smoke for the stormcaller's CHAIN in a FULL tick loop
 * (selector → MovementBehavior / AbilityBehavior → the chain_lightning charge →
 * applyEffect → the interpreter's `executeChain` → the deferred `pendingChainHops`
 * → World events). The unit-level tests pin the chain geometry / falloff / propose
 * capture / deferred timing in isolation; this proves a stormcaller spawned through
 * the REAL wiring (`abilityIdsForArchetype('stormcaller')` →
 * `createAbility('chain_lightning')`) approaches, charges, and detonates a chain
 * that ARCS — and, with `hopDelaySeconds > 0`, that the hops genuinely TRAVEL over
 * successive ticks (the §29c per-hop delay) rather than all landing at once. A
 * `?roster=stormcaller,...` playtest build must not crash on it.
 */

const TICK_CAP = 3000;

interface ChainHopLog {
  tick: number;
  jumpIndex: number;
}

function runStormcallerBattle(seed: number): {
  resolved: boolean;
  charged: boolean;
  chargeSpannedTicks: boolean;
  hops: ChainHopLog[];
} {
  const bus = new EventBus<GameEvents>();

  const encounter: BattleEncounter = {
    worldSeed: seed,
    terrainSeed: seed,
    layoutId: null,
    gridW: 14,
    gridH: 14,
    theme: 'rock',
    // Melee bodyguards keep the stormcaller alive long enough to cast; a dense
    // enemy melee blob gives the chain adjacent targets to arc between.
    playerTeam: [
      rollUnit('stormcaller', new RNG(seed)),
      rollUnit('mercenary', new RNG(seed + 1)),
      rollUnit('mercenary', new RNG(seed + 2)),
      rollUnit('mercenary', new RNG(seed + 3)),
    ],
    enemyTeam: [
      rollUnit('mercenary', new RNG(seed + 10)),
      rollUnit('mercenary', new RNG(seed + 11)),
      rollUnit('mercenary', new RNG(seed + 12)),
      rollUnit('mercenary', new RNG(seed + 13)),
      rollUnit('mercenary', new RNG(seed + 14)),
    ],
  };

  const world = new World(bus, new RNG(seed));
  spawnEncounter(world, encounter);

  const caster = world.units.find((u) => u.team === 'player' && u.archetype === 'stormcaller');
  expect(caster, 'stormcaller should spawn into the world').toBeDefined();
  const casterId = caster!.id;
  expect(caster!.abilities.map((a) => a.id)).toContain('chain_lightning');
  expect(caster!.behaviors.map((b) => b.kind)).toEqual(['movement', 'ability']);

  // Each chain ARC fires a `unit:chained`; log its tick + jumpIndex. A multi-hop
  // cast is a 0,1,2 run — the jumpIndex proves the arc, the ticks prove the delay.
  const hops: ChainHopLog[] = [];
  bus.on('unit:chained', (p) => {
    if (p.casterId !== casterId) return;
    hops.push({ tick: world.currentTick, jumpIndex: p.jumpIndex });
  });

  let resolved = false;
  bus.on('battle:ended', () => {
    resolved = true;
  });

  let charged = false;
  let chargeSpannedTicks = false;
  let prevChargeStart: number | null = null;
  let ticks = 0;
  while (ticks < TICK_CAP) {
    world.tick();
    ticks++;
    const active = world.findUnit(casterId)?.activeAction;
    if (active?.action.id === 'chain_lightning') {
      charged = true;
      if (prevChargeStart === active.startTick) chargeSpannedTicks = true;
      prevChargeStart = active.startTick;
    } else {
      prevChargeStart = null;
    }
    if (resolved) break;
  }
  return { resolved, charged, chargeSpannedTicks, hops };
}

describe('§29c — stormcaller runs a full battle and its chain arcs hop by hop', () => {
  const seeds = [1, 7, 42];
  const results = seeds.map((s) => ({ seed: s, ...runStormcallerBattle(s) }));

  for (const r of results) {
    it(`charges a chain and the battle resolves (seed ${r.seed})`, () => {
      expect(r.resolved).toBe(true);
      expect(r.charged).toBe(true);
      expect(r.chargeSpannedTicks).toBe(true); // the charge genuinely spans ticks
    });
  }

  it('the chain demonstrably ARCS — at least one cast jumps past the primary', () => {
    const maxJump = Math.max(0, ...results.flatMap((r) => r.hops.map((h) => h.jumpIndex)));
    expect(maxJump).toBeGreaterThanOrEqual(1); // a jumpIndex >= 1 means it hopped
  });

  it('the hops TRAVEL over successive ticks (the per-hop delay, not all at once)', () => {
    // In some cast, a jumpIndex-0 arc is immediately followed by a jumpIndex-1 arc
    // on a STRICTLY LATER tick — the deferred per-hop delay. An instant chain would
    // put both on the same tick.
    const staggered = results.some((r) =>
      r.hops.some((h, i) => {
        const next = r.hops[i + 1];
        return next !== undefined && h.jumpIndex === 0 && next.jumpIndex === 1 && next.tick > h.tick;
      }),
    );
    expect(staggered).toBe(true);
  });
});
