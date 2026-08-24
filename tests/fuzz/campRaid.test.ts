/**
 * 85d — the campRaid order + eligibility gate (campRaid.ts): the shared
 * helper both the live harness and the rollout walker consume, pinned at
 * the unit level (the arbitration-site mechanics are pinned in
 * arbitratedStrategy.test.ts; the traffic tier's foreign-order
 * conservatism in TrafficScriptDriver.test.ts).
 */

import { describe, it, expect } from 'vitest';
import { EventBus } from '../../src/core/EventBus';
import { RNG } from '../../src/core/RNG';
import type { GameEvents } from '../../src/core/events';
import { World } from '../../src/sim/World';
import { scaledUnit } from '../../src/sim/archetypes';
import { spawnCamps } from '../../src/sim/battleSetup';
import { LAYOUTS } from '../../src/config/layouts';
import { campRaidEligible, orderCampRaid } from './campRaid';

describe('85d — campRaidEligible (the rollout-spend gate)', () => {
  it('authored layouts gate on campSpawns; unknown/procedural stays eligible (config-derived)', () => {
    // Balance-proof: derive both cases from the shipped catalog instead of
    // hardcoding ids — the pin survives layout authoring.
    const withCamps = LAYOUTS.filter((l) => (l.campSpawns?.length ?? 0) > 0);
    const without = LAYOUTS.filter((l) => (l.campSpawns?.length ?? 0) === 0);
    expect(withCamps.length).toBeGreaterThan(0); // camps exist since §75
    expect(without.length).toBeGreaterThan(0); // and campless boards too
    for (const l of withCamps) expect(campRaidEligible(l.id)).toBe(true);
    for (const l of without) expect(campRaidEligible(l.id)).toBe(false);
    // The procedural sentinel / a synthetic id / a null-mapped undefined:
    // eligible — camps are theme-rolled at spawn, the order no-ops if not.
    expect(campRaidEligible(undefined)).toBe(true);
    expect(campRaidEligible('no-such-layout')).toBe(true);
  });
});

describe('85d — orderCampRaid (the §75g pull rails, player-side)', () => {
  it('orders an engage on the first living CAMP member (never a null-campId unit); the order SURVIVES the drain', () => {
    const world = new World(new EventBus<GameEvents>(), new RNG(1), 20, 20);
    // A player unit FIRST — the 85d A/B probe's catch: non-camp units carry
    // campId null, and an `!== undefined` filter would target this unit and
    // get silently reverted by clearResolvedObjectives the same tick.
    world.spawnUnit(scaledUnit('mercenary', 1), 'player', { x: 1, y: 1 }, null);
    spawnCamps(world, [{ x: 8, y: 8 }], [{ campId: 'bandit-squatters' }], 123, 456);
    world.primeCampSpawns();
    const primed = world.units.find((u) => u.campId !== null && u.currentHp > 0);
    expect(primed).toBeDefined(); // the prime materializes instantly (§75h)
    expect(primed!.team).toBe('neutral');
    expect(orderCampRaid(world)).toBe(true);
    // The setup-phase door: the order stands IMMEDIATELY (before any tick-0
    // bot decide — the drain-race fix, 85d A/B probe).
    expect(world.objectiveFor('player')).toEqual({
      mode: 'engage',
      target: { kind: 'neutral', unitId: primed!.id },
    });
    world.tick(); // clearResolvedObjectives runs inside — the order must SURVIVE
    // The load-bearing half: still standing post-tick (a bad target id would
    // read atWill here — the silent-revert signature the probe caught).
    expect(world.objectiveFor('player')).toEqual({
      mode: 'engage',
      target: { kind: 'neutral', unitId: primed!.id },
    });
    // Hostility keeps its single source: ordering a raid pre-marks nothing.
    for (const camp of world.campsList()) expect(camp.hostileTo.size).toBe(0);
  });

  it('no-ops on a campless world (returns false, enqueues nothing)', () => {
    const world = new World(new EventBus<GameEvents>(), new RNG(1), 20, 20);
    expect(orderCampRaid(world)).toBe(false);
    world.tick();
    expect(world.objectiveFor('player').mode).toBe('atWill');
  });
});
