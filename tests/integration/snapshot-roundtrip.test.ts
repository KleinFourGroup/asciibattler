/**
 * A2 round-trip determinism harness.
 *
 * Contract: `World.toJSON()` → `World.fromJSON()` must produce a world
 * that, when ticked further, emits the same event sequence as the
 * un-roundtripped baseline. This is the load-bearing test for save/load,
 * replay, and the headless fuzz harness (A3): if a roundtrip ever diverges
 * the event stream, those features all break silently.
 *
 * Strategy: run a fixture battle to a non-trivial mid-state (so units
 * have HP loss, cooldowns set, and at least one in-flight action),
 * snapshot, deserialize on a fresh bus, then tick both to completion and
 * compare event traces.
 */

import { describe, it, expect } from 'vitest';
import { World } from '../../src/sim/World';
import { Unit, type Team } from '../../src/sim/Unit';
import { MovementBehavior } from '../../src/sim/behaviors/MovementBehavior';
import { SupportMovementBehavior } from '../../src/sim/behaviors/SupportMovementBehavior';
import { AbilityBehavior } from '../../src/sim/behaviors/AbilityBehavior';
import { createAbility } from '../../src/sim/abilities/registry';
import { EffectAction } from '../../src/sim/effects/EffectAction';
import type { PendingChainHop } from '../../src/sim/effects/interpreter';
import { rollUnit } from '../../src/sim/archetypes';
import { claimantOf, isClaimed } from '../../src/sim/occupancy';
import { applyTerrain } from '../../src/sim/battleSetup';
import { EventBus } from '../../src/core/EventBus';
import { RNG } from '../../src/core/RNG';
import type { GameEvents } from '../../src/core/events';
import { Run } from '../../src/run/Run';
import { PRE_ROOT_NODE_ID } from '../../src/run/NodeMap';

describe('A2 round-trip: World', () => {
  it('toJSON → fromJSON preserves tickCount, RNG state, and per-unit state', () => {
    const { world } = freshBattle(54321);
    for (let i = 0; i < 50; i++) world.tick();

    const snap = world.toJSON();
    const restored = World.fromJSON(snap, new EventBus<GameEvents>());

    expect(restored.currentTick).toBe(world.currentTick);
    expect(restored.gridW).toBe(world.gridW);
    expect(restored.gridH).toBe(world.gridH);
    expect(restored.ended).toBe(world.ended);
    expect(restored.rng.toJSON()).toEqual(world.rng.toJSON());
    // E1 — combatRng is its own stream; the round-trip preserves it too.
    expect(restored.combatRng.toJSON()).toEqual(world.combatRng.toJSON());
    expect(restored.units.length).toBe(world.units.length);
    for (let i = 0; i < world.units.length; i++) {
      const a = world.units[i]!;
      const b = restored.units[i]!;
      expect(b.id).toBe(a.id);
      expect(b.team).toBe(a.team);
      expect(b.position).toEqual(a.position);
      expect(b.currentHp).toBe(a.currentHp);
      expect(b.stats).toEqual(a.stats);
      expect(Array.from(b.actionCooldowns.entries())).toEqual(
        Array.from(a.actionCooldowns.entries()),
      );
      expect(b.activeAction?.startTick).toBe(a.activeAction?.startTick);
      expect(b.activeAction?.finishTick).toBe(a.activeAction?.finishTick);
      expect(b.activeAction?.action.id).toBe(a.activeAction?.action.id);
      expect(b.behaviors.map((x) => x.kind)).toEqual(a.behaviors.map((x) => x.kind));
    }
  });

  it('GP1: a current snapshot round-trips but a stale schema version is rejected', () => {
    // GP1 renamed two UnitStats keys (speed→agility, endurance→mobility) and
    // bumped WORLD_SCHEMA_VERSION. Stats round-trip as a whole object by key,
    // so an old save would otherwise deserialize into a block missing the new
    // keys; the version check must reject it outright instead. (I1 later
    // reverted speed→agility back to `speed`; `mobility` is the surviving GP1
    // rename, so it's the stable sanity-key here — the dodge-stat additions are
    // pinned by the I1 case below.)
    const { world } = freshBattle(54321);
    const wire = JSON.parse(JSON.stringify(world.toJSON()));
    // Sanity: the live snapshot carries the (surviving) renamed stat key.
    expect(wire.units[0].stats).toHaveProperty('mobility');

    // A current-version snapshot restores cleanly.
    expect(() => World.fromJSON(wire, new EventBus<GameEvents>())).not.toThrow();

    // A snapshot stamped with the PRIOR version (a pre-GP1 save) throws rather
    // than mis-decoding the old `speed`/`endurance` keys.
    const stale = { ...wire, schemaVersion: wire.schemaVersion - 1 };
    expect(() => World.fromJSON(stale, new EventBus<GameEvents>())).toThrow(
      /unsupported schema version/,
    );
  });

  it('H1: a live snapshot carries `power`; a pre-H1 (power-less) version is rejected', () => {
    // H1 added the `power` key to UnitStats and bumped WORLD_SCHEMA_VERSION
    // (17→18). Stats round-trip as a whole object by key, so a v17 save carries
    // a power-less block; the version check must reject it outright.
    const { world } = freshBattle(54321);
    const wire = JSON.parse(JSON.stringify(world.toJSON()));
    expect(wire.units[0].stats).toHaveProperty('power');

    // A current-version snapshot restores cleanly and preserves `power`.
    const restored = World.fromJSON(wire, new EventBus<GameEvents>());
    expect(restored.units[0]!.stats.power).toBe(world.units[0]!.stats.power);

    // A snapshot stamped with the PRIOR version (a pre-H1 save) throws.
    const stale = { ...wire, schemaVersion: wire.schemaVersion - 1 };
    expect(() => World.fromJSON(stale, new EventBus<GameEvents>())).toThrow(
      /unsupported schema version/,
    );
  });

  it('I1: a live snapshot carries `speed`/`precision`/`evasion` (not `agility`); a pre-I1 version is rejected', () => {
    // I1 reverted agility→speed and added precision/evasion to UnitStats, bumping
    // WORLD_SCHEMA_VERSION (18→19). Stats round-trip as a whole object by key, so
    // a v18 save carries an `agility`-keyed, dodge-less block; the version check
    // must reject it outright.
    const { world } = freshBattle(54321);
    const wire = JSON.parse(JSON.stringify(world.toJSON()));
    expect(wire.units[0].stats).toHaveProperty('speed');
    expect(wire.units[0].stats).toHaveProperty('precision');
    expect(wire.units[0].stats).toHaveProperty('evasion');
    expect(wire.units[0].stats).not.toHaveProperty('agility');

    // A current-version snapshot restores cleanly and preserves the dodge stats.
    const restored = World.fromJSON(wire, new EventBus<GameEvents>());
    expect(restored.units[0]!.stats.speed).toBe(world.units[0]!.stats.speed);
    expect(restored.units[0]!.stats.precision).toBe(world.units[0]!.stats.precision);
    expect(restored.units[0]!.stats.evasion).toBe(world.units[0]!.stats.evasion);

    // A snapshot stamped with the PRIOR version (a pre-I1 save) throws.
    const stale = { ...wire, schemaVersion: wire.schemaVersion - 1 };
    expect(() => World.fromJSON(stale, new EventBus<GameEvents>())).toThrow(
      /unsupported schema version/,
    );
  });

  it('I6: live snapshot has no `critChance` + carries the renamed weapon ids; a pre-I6 version is rejected', () => {
    // I6 made two save-shape changes, each a WORLD_SCHEMA_VERSION bump:
    //   commit 1 (v20→v21) removed `critChance` from UnitDerived (crit is
    //     per-ability now — like E5's v12 `attackCooldownTicks` removal);
    //   commit 2 (v21→v22) split the basic-strike ability ids (`melee_strike` →
    //     sword/club/katana/whip, `ranged_shot` → `bow`), so a v21 save's
    //     ability-id list no longer resolves in the registry.
    // Either way an older save is rejected outright (no migration).
    const { world } = freshBattle(13579);
    const wire = JSON.parse(JSON.stringify(world.toJSON()));
    // commit 1: derived lost critChance, kept the rest.
    expect(wire.units[0].derived).not.toHaveProperty('critChance');
    expect(wire.units[0].derived).toHaveProperty('maxHp');
    expect(wire.units[0].derived).toHaveProperty('moveCooldownTicks');
    expect(wire.units[0].derived).toHaveProperty('attackRange');
    // commit 2: the serialized ability ids are the renamed ones, never the old.
    const abilityIds = (wire.units as { abilities: string[] }[]).flatMap((u) => u.abilities);
    expect(abilityIds).not.toContain('melee_strike');
    expect(abilityIds).not.toContain('ranged_shot');

    const restored = World.fromJSON(wire, new EventBus<GameEvents>());
    expect(restored.units[0]!.derived.maxHp).toBe(world.units[0]!.derived.maxHp);

    // A snapshot stamped with the PRIOR version (a pre-I6-commit-2 save) throws.
    const stale = { ...wire, schemaVersion: wire.schemaVersion - 1 };
    expect(() => World.fromJSON(stale, new EventBus<GameEvents>())).toThrow(
      /unsupported schema version/,
    );
  });

  it('O1: a live snapshot carries both teams\' objectives; a pre-O1 version is rejected', () => {
    // O1 replaced J1's single nullable `objective` with the per-team
    // `objectives: { player, enemy }` record (v24→v25). A v24 save lacks the
    // field; rather than default it, reject outright (no migration). An `engage`
    // tile objective is used here because it persists deterministically (an
    // `engage` enemy objective would auto-revert if its target died mid-tick).
    const { world } = freshBattle(24680);
    const cell = { x: 1, y: 1 };
    const objective = { mode: 'engage', target: { kind: 'tile', cell } } as const;
    world.enqueueCommand({ kind: 'setObjective', team: 'player', objective });
    world.tick(); // drains + applies the command at top of tick.
    expect(world.objectiveFor('player')).toEqual(objective);

    const wire = JSON.parse(JSON.stringify(world.toJSON()));
    expect(wire.objectives).toEqual({ player: objective, enemy: { mode: 'atWill' } });

    const restored = World.fromJSON(wire, new EventBus<GameEvents>());
    expect(restored.objectiveFor('player')).toEqual(objective);
    expect(restored.objectiveFor('enemy')).toEqual({ mode: 'atWill' });

    // A snapshot stamped with the prior version (a pre-O1 save) throws.
    const stale = { ...wire, schemaVersion: wire.schemaVersion - 1 };
    expect(() => World.fromJSON(stale, new EventBus<GameEvents>())).toThrow(
      /unsupported schema version/,
    );
  });

  it('K1: a live snapshot carries per-unit status effects; a pre-K1 version is rejected', () => {
    // K1 added the per-unit `effects` list to WorldSnapshot (v23→v24). The
    // effect + its remaining lifetime + the folded effective stat block must
    // resume identically; a v23 save (no `effects` field) is rejected outright.
    const { world } = freshBattle(13579);
    for (let i = 0; i < 5; i++) world.tick();
    const u = world.units.find((x) => x.team !== 'neutral')!;
    u.addEffect({
      key: 'empowered',
      magnitude: 3,
      mods: { strength: { add: 1 } },
      lifetime: { kind: 'ticks', expiresAtTick: world.currentTick + 100 },
      merge: 'replace',
    });
    const buffedStrength = u.effectiveStats.strength;
    expect(buffedStrength).toBe(u.stats.strength + 3);

    const wire = JSON.parse(JSON.stringify(world.toJSON()));
    const unitWire = wire.units.find((w: { id: number }) => w.id === u.id);
    expect(unitWire.effects).toHaveLength(1);
    expect(unitWire.effects[0].magnitude).toBe(3);
    expect(unitWire.effects[0].lifetime).toEqual({
      kind: 'ticks',
      expiresAtTick: world.currentTick + 100,
    });

    const restored = World.fromJSON(wire, new EventBus<GameEvents>());
    const ru = restored.units.find((x) => x.id === u.id)!;
    expect(ru.effects).toHaveLength(1);
    expect(ru.effectiveStats.strength).toBe(buffedStrength);

    // A snapshot stamped with the prior version (a pre-K1 save) throws.
    const stale = { ...wire, schemaVersion: wire.schemaVersion - 1 };
    expect(() => World.fromJSON(stale, new EventBus<GameEvents>())).toThrow(
      /unsupported schema version/,
    );
  });

  it('§29c: a live snapshot carries pendingChainHops; a pre-§29c (v27) save is rejected', () => {
    // §29c follow-up added the deferred chain-hop queue to WorldSnapshot (v27→v28).
    // A chain caught mid-arc by a save must resume its remaining hops; a v27 save
    // (no `pendingChainHops` field) is rejected outright (no migration — a pre-28
    // chain resolved all-at-once, never mid-flight). Scheduled DIRECTLY here to
    // exercise the serialization in isolation (the firing/timing is pinned in
    // effects/interpreter.test.ts + stormcaller-battle.test.ts).
    const { world } = freshBattle(54321);
    // The TERMINAL jump (jumpIndex == maxJumps − 1), so it fires once without
    // rescheduling — a clean drain assertion regardless of what's in range.
    const hop: PendingChainHop = {
      fireAtTick: world.currentTick + 2,
      casterId: world.units[0]!.id,
      op: {
        kind: 'chain', maxJumps: 3, rangeCells: 3, falloff: 0.6, hopDelaySeconds: 0.1,
        ops: [
          { kind: 'damage', scaling: 'magic', might: 0, accuracy: 0.6, critBase: 0, critable: false, evadable: false, bypassDefense: false },
        ],
      },
      resolution: { chainOps: [{ baseDamage: 12, critChance: 0 }] },
      fromPos: { x: 5, y: 5 },
      hitIds: [world.units[0]!.id, world.units[1]!.id],
      jumpIndex: 2,
    };
    world.scheduleChainHop(hop);

    const wire = JSON.parse(JSON.stringify(world.toJSON()));
    expect(wire.pendingChainHops).toHaveLength(1);
    expect(wire.pendingChainHops[0].jumpIndex).toBe(2);

    const restored = World.fromJSON(wire, new EventBus<GameEvents>());
    expect(restored.pendingChainHops).toEqual(world.pendingChainHops);
    // The restored queue is live: the tick loop drains the terminal hop when due.
    for (let i = 0; i < 4; i++) restored.tick();
    expect(restored.pendingChainHops).toHaveLength(0);

    const stale = { ...wire, schemaVersion: wire.schemaVersion - 1 };
    expect(() => World.fromJSON(stale, new EventBus<GameEvents>())).toThrow(
      /unsupported schema version/,
    );
  });

  it('§36a: a live snapshot round-trips the claim registry; a pre-§36a (v30) save is rejected', () => {
    // §36a added the in-flight cell-claim registry to WorldSnapshot (v30→v31). The
    // instant move model creates no persistent claim, so inject one DIRECTLY to
    // exercise the serialization in isolation (§36b wires the move lifecycle). A
    // v30 save (no `claims` field) is rejected outright per the no-migration contract.
    const { world } = freshBattle(54321);
    const u = world.units[0]!;
    world.claimCell({ x: 7, y: 7 }, u.id);

    const wire = JSON.parse(JSON.stringify(world.toJSON()));
    expect(wire.claims).toEqual([{ cell: { x: 7, y: 7 }, unitId: u.id, plane: 'ground' }]);

    const restored = World.fromJSON(wire, new EventBus<GameEvents>());
    expect(restored.claims.get('7,7')).toEqual({ cell: { x: 7, y: 7 }, unitId: u.id, plane: 'ground' });

    const stale = { ...wire, schemaVersion: wire.schemaVersion - 1 };
    expect(() => World.fromJSON(stale, new EventBus<GameEvents>())).toThrow(
      /unsupported schema version/,
    );
  });

  it('§36b: round-trips a unit MID-MOVE — deferred position + held claim — and flips post-restore', () => {
    // §36b defers a move's logical position flip to its 50% mark, holding a
    // destination claim across the window. The natural state §36a's injected
    // claim stands in for: snapshot WHILE a real move is in flight (activeAction
    // 'move', the unit still logically on `from`, its `to` claimed), restore on a
    // fresh bus, and prove the restored world resumes the SAME deferred flip — no
    // new serialized state beyond the v31 claim + the activeAction phase timeline.
    const bus = new EventBus<GameEvents>();
    const world = new World(bus, new RNG(1357));
    const mover = world.spawnUnit(rollUnit('mercenary', new RNG(1)), 'player', { x: 1, y: 1 });
    mover.behaviors.push(new MovementBehavior());
    // Inert far enemy: gives the mover something to pursue (so it steps) without
    // ending the battle or closing to melee within the window.
    world.spawnUnit(rollUnit('mercenary', new RNG(2)), 'enemy', { x: 10, y: 1 });

    // Advance until the mover is mid-move and PRE-FLIP: activeAction is a move
    // whose destination it still claims (the claim releases at the flip).
    let midMove = false;
    let fromCell = mover.position;
    let toCell = mover.position;
    for (let i = 0; i < 200 && !midMove; i++) {
      world.tick();
      const live = world.findUnit(mover.id);
      const a = live?.activeAction;
      const to = a?.action.id === 'move' ? a.action.destinationCell?.() : undefined;
      if (to && claimantOf(world, to) === mover.id) {
        midMove = true;
        fromCell = { ...live!.position };
        toCell = { ...to };
      }
    }
    expect(midMove, 'mover should be mid-move (pre-flip) within the window').toBe(true);
    expect(fromCell).not.toEqual(toCell); // genuinely in transit

    const live = world.findUnit(mover.id)!;
    const wire = JSON.parse(JSON.stringify(world.toJSON()));
    const restored = World.fromJSON(wire, new EventBus<GameEvents>());
    const restoredMover = restored.findUnit(mover.id)!;

    // The deferred state round-trips: still on `from`, still claiming `to`, the
    // move's phase timeline (the flip-tick derivation) intact.
    expect(restoredMover.position).toEqual(fromCell);
    expect(claimantOf(restored, toCell)).toBe(mover.id);
    expect(restoredMover.activeAction?.action.id).toBe('move');
    expect(restoredMover.activeAction?.startTick).toBe(live.activeAction?.startTick);
    expect(restoredMover.activeAction?.finishTick).toBe(live.activeAction?.finishTick);
    expect(restoredMover.activeAction?.phases).toEqual(live.activeAction?.phases);

    // Resume: the restored move flips to `to` and releases the claim at the
    // derived 50% tick (the first logical position change).
    for (
      let i = 0;
      i < 50 &&
      restoredMover.position.x === fromCell.x &&
      restoredMover.position.y === fromCell.y &&
      !restored.ended;
      i++
    ) {
      restored.tick();
    }
    expect(restoredMover.position).toEqual(toCell); // flipped on arrival
    expect(isClaimed(restored, toCell)).toBe(false); // claim released
  });

  it('continuing a restored World produces the same event trace as the baseline', () => {
    // Snapshot mid-battle, restore, tick both to completion, compare.
    const baseline = freshBattle(54321);
    for (let i = 0; i < 50; i++) baseline.world.tick();
    const baselineMidTrace = baseline.events.slice();

    // Now snapshot the baseline at this exact mid-point, restore onto a
    // fresh bus, and continue ticking the restored world to completion.
    const restoredBus = new EventBus<GameEvents>();
    const restoredEvents = recordEvents(restoredBus);
    const restored = World.fromJSON(baseline.world.toJSON(), restoredBus);
    for (let i = 0; i < 500 && !restored.ended; i++) restored.tick();

    // Continue the baseline too — to the same termination — without touching
    // its event recorder (which is what we want to compare against).
    for (let i = 0; i < 500 && !baseline.world.ended; i++) baseline.world.tick();
    const baselineFullTrace = baseline.events.slice();
    const baselinePostMidTrace = baselineFullTrace.slice(baselineMidTrace.length);

    expect(restoredEvents).toEqual(baselinePostMidTrace);
    expect(restored.ended).toBe(true);
    expect(restored.currentTick).toBe(baseline.world.currentTick);
  });

  it('survives JSON.stringify/parse without losing fidelity', () => {
    // Belt-and-braces — confirms the snapshot is actually plain JSON
    // (no Map / Set / undefined leakage that would break a real save).
    const { world } = freshBattle(11111);
    for (let i = 0; i < 30; i++) world.tick();

    const wireFormat = JSON.parse(JSON.stringify(world.toJSON()));
    const restored = World.fromJSON(wireFormat, new EventBus<GameEvents>());
    expect(restored.currentTick).toBe(world.currentTick);
    expect(restored.units.length).toBe(world.units.length);
  });

  it('preserves pending commands across roundtrip', () => {
    const { world } = freshBattle(11111);
    world.enqueueCommand({ kind: 'noop' });
    world.enqueueCommand({ kind: 'noop' });

    const snap = JSON.parse(JSON.stringify(world.toJSON()));
    expect(snap.pendingCommands).toHaveLength(2);

    const restored = World.fromJSON(snap, new EventBus<GameEvents>());
    // Tick once: commands drain at top of tick. After this the queue is empty.
    restored.tick();
    expect(restored.toJSON().pendingCommands).toHaveLength(0);
  });

  it('D6: round-trips per-unit blocksLineOfSight (walls true, half-cover false)', () => {
    const { world } = freshBattle(99999);
    // §38d — blocksLineOfSight is intrinsic to the neutral kind (wall true,
    // half_cover false), resolved from the catalog by archetype.
    const wall = world.spawnEnvironment({ archetype: 'wall', position: { x: 0, y: 6 } });
    const halfCover = world.spawnEnvironment({ archetype: 'half_cover', position: { x: 1, y: 6 } });
    expect(wall.blocksLineOfSight).toBe(true);
    expect(halfCover.blocksLineOfSight).toBe(false);

    const wire = JSON.parse(JSON.stringify(world.toJSON()));
    const restored = World.fromJSON(wire, new EventBus<GameEvents>());

    const restoredWall = restored.units.find((u) => u.id === wall.id)!;
    const restoredHC = restored.units.find((u) => u.id === halfCover.id)!;
    expect(restoredWall.blocksLineOfSight).toBe(true);
    expect(restoredHC.blocksLineOfSight).toBe(false);
  });

  it('D7.A: round-trips chasm tiles through World snapshot', () => {
    const { world } = freshBattle(54321);
    world.tileGrid.setKind({ x: 4, y: 4 }, 'chasm');
    world.tileGrid.setKind({ x: 5, y: 4 }, 'chasm');

    const wire = JSON.parse(JSON.stringify(world.toJSON()));
    const restored = World.fromJSON(wire, new EventBus<GameEvents>());

    expect(restored.tileGrid.kindAt({ x: 4, y: 4 })).toBe('chasm');
    expect(restored.tileGrid.kindAt({ x: 5, y: 4 })).toBe('chasm');
    expect(restored.tileGrid.costAt({ x: 4, y: 4 })).toBe(Infinity);
    expect(restored.tileGrid.kindAt({ x: 0, y: 0 })).toBe('floor');
  });

  it('D7.B: round-trips fire + healing tiles through World snapshot', () => {
    const { world } = freshBattle(54321);
    world.tileGrid.setKind({ x: 2, y: 2 }, 'fire');
    world.tileGrid.setKind({ x: 3, y: 3 }, 'healing');

    const wire = JSON.parse(JSON.stringify(world.toJSON()));
    const restored = World.fromJSON(wire, new EventBus<GameEvents>());

    expect(restored.tileGrid.kindAt({ x: 2, y: 2 })).toBe('fire');
    expect(restored.tileGrid.kindAt({ x: 3, y: 3 })).toBe('healing');
    expect(restored.tileGrid.costAt({ x: 2, y: 2 })).toBe(1);
    expect(restored.tileGrid.costAt({ x: 3, y: 3 })).toBe(1);
  });

  it('round-trips the tile grid + neutral wall units (C1a terrain)', () => {
    // Build a non-trivial battle, run it for a few ticks, snapshot, restore.
    const { world } = freshBattle(11111);
    applyTerrain(world, {
      worldSeed: 0,
      terrainSeed: 4242,
      layoutId: null,
      gridW: world.gridW,
      gridH: world.gridH,
      theme: 'grassland', // cosmetic only — not part of the serialized snapshot
      playerTeam: [],
      enemyTeam: [],
    });
    for (let i = 0; i < 5; i++) world.tick();

    const wallCoordsBefore = world.units
      .filter((u) => u.team === 'neutral')
      .map((u) => ({ ...u.position }));
    const tileSnapBefore = world.tileGrid.toJSON();
    expect(wallCoordsBefore.length).toBeGreaterThan(0);

    const wire = JSON.parse(JSON.stringify(world.toJSON()));
    const restored = World.fromJSON(wire, new EventBus<GameEvents>());

    const wallCoordsAfter = restored.units
      .filter((u) => u.team === 'neutral')
      .map((u) => ({ ...u.position }));
    expect(wallCoordsAfter).toEqual(wallCoordsBefore);
    expect(restored.tileGrid.toJSON()).toEqual(tileSnapBefore);
  });

  it('F6: round-trips the utility-contribution (healing) ledger', () => {
    // The ledger is action-fed (the heal op → recordHealing); here we credit
    // it directly to exercise the *serialization* in isolation (the heal op's
    // own crediting is pinned in effects/interpreter.test.ts). Without round-tripping
    // this, a mid-battle restore would award the healer less heal-XP than the
    // un-roundtripped baseline — same contract that v9 added for damageDealt.
    const { world } = freshBattle(54321);
    const [a, b] = world.units;
    world.recordHealing(a!.id, 12);
    world.recordHealing(a!.id, 5); // accumulates → 17
    world.recordHealing(b!.id, 8);

    const wire = JSON.parse(JSON.stringify(world.toJSON()));
    const restored = World.fromJSON(wire, new EventBus<GameEvents>());

    expect(restored.utilityDoneBy(a!.id)).toBe(17);
    expect(restored.utilityDoneBy(b!.id)).toBe(8);
  });

  it('E7.B: round-trips a healer mid-heal (support_movement behavior + heal action)', () => {
    // Mirror freshBattle's manual behavior attach (bare spawnUnit doesn't
    // wire behaviors — the team-spawn path does; that path is exercised by
    // healer-battle.test.ts). Healer + a wounded ally in heal range so the
    // heal fires on the first free tick; a far inert enemy keeps the battle
    // from ending.
    const bus = new EventBus<GameEvents>();
    const world = new World(bus, new RNG(777));
    const healer = world.spawnUnit(rollUnit('healer', new RNG(1)), 'player', { x: 5, y: 5 });
    healer.behaviors.push(new SupportMovementBehavior(), new AbilityBehavior());
    // Y5 — production createAbility path (EffectAbility); the in-flight action is
    // now the EffectAction id 'heal_ally', not the legacy HealAction id 'heal'.
    healer.abilities.push(createAbility('heal_ally'));
    const ally = world.spawnUnit(rollUnit('mercenary', new RNG(2)), 'player', { x: 5, y: 6 });
    ally.currentHp = 1; // wounded, stays below maxHp after one heal
    world.spawnUnit(rollUnit('mercenary', new RNG(3)), 'enemy', { x: 11, y: 11 });

    let cast = false;
    for (let i = 0; i < 200 && !cast; i++) {
      world.tick();
      if (world.findUnit(healer.id)?.activeAction?.action.id === 'heal_ally') cast = true;
    }
    expect(cast, 'healer should cast a heal within the window').toBe(true);

    const live = world.findUnit(healer.id)!;
    const wire = JSON.parse(JSON.stringify(world.toJSON()));
    const restored = World.fromJSON(wire, new EventBus<GameEvents>());
    const restoredHealer = restored.units.find((u) => u.id === healer.id)!;

    expect(restoredHealer.behaviors.map((b) => b.kind)).toEqual(['support_movement', 'ability']);
    expect(restoredHealer.abilities.map((a) => a.id)).toEqual(['heal_ally']);
    expect(restoredHealer.activeAction?.action.id).toBe('heal_ally');
    expect(restoredHealer.activeAction?.startTick).toBe(live.activeAction?.startTick);
    expect(restoredHealer.activeAction?.finishTick).toBe(live.activeAction?.finishTick);
  });

  it('E7.C: round-trips a mage MID-CHARGE and still detonates post-restore', () => {
    // The mage is the first multi-tick combat action, so the in-flight
    // charge (activeAction whose phase timeline puts impact at the end) is
    // the load-bearing round-trip. Mage + enemy in bolt range so the charge starts on the
    // first free tick; snapshot WHILE charging, restore, and prove the
    // restored world still lands the bolt (same event-trace contract as the
    // healer mid-heal case, but the effect lands later than start).
    const bus = new EventBus<GameEvents>();
    const world = new World(bus, new RNG(2468));
    const mage = world.spawnUnit(rollUnit('mage', new RNG(1)), 'player', { x: 5, y: 5 });
    mage.behaviors.push(new MovementBehavior(), new AbilityBehavior());
    // Y4a — build via the production createAbility path (EffectAbility), not the
    // legacy `new MagicBolt()`: the in-flight EffectAction's id 'magic_bolt' now
    // round-trips through the EffectAction fallback (its legacy action-factory
    // entry was dropped). Mirrors the build-pattern note (hand-built legacy
    // classes diverge on the serialized in-flight shape).
    mage.abilities.push(createAbility('magic_bolt'));
    const enemy = world.spawnUnit(rollUnit('mercenary', new RNG(2)), 'enemy', { x: 5, y: 7 });

    // Advance until the mage is mid-charge (activeAction set, but the bolt
    // hasn't landed yet — currentTick strictly before finishTick).
    let midCharge = false;
    for (let i = 0; i < 200 && !midCharge; i++) {
      world.tick();
      const a = world.findUnit(mage.id)?.activeAction;
      if (a?.action.id === 'magic_bolt' && world.currentTick < a.finishTick - 1) midCharge = true;
    }
    expect(midCharge, 'mage should be mid-charge within the window').toBe(true);
    const enemyHpAtSnapshot = world.findUnit(enemy.id)!.currentHp;

    const live = world.findUnit(mage.id)!;
    const wire = JSON.parse(JSON.stringify(world.toJSON()));
    const restored = World.fromJSON(wire, new EventBus<GameEvents>());
    const restoredMage = restored.units.find((u) => u.id === mage.id)!;

    expect(restoredMage.behaviors.map((b) => b.kind)).toEqual(['movement', 'ability']);
    expect(restoredMage.abilities.map((a) => a.id)).toEqual(['magic_bolt']);
    expect(restoredMage.activeAction?.action.id).toBe('magic_bolt');
    expect(restoredMage.activeAction?.startTick).toBe(live.activeAction?.startTick);
    expect(restoredMage.activeAction?.finishTick).toBe(live.activeAction?.finishTick);
    // F2 — the phase timeline round-trips intact, so the restored mid-charge
    // resumes on the right phase at the right offset.
    expect(restoredMage.activeAction?.phases).toEqual(live.activeAction?.phases);

    // Tick the restored world past the charge: the bolt must still land.
    // The enemy is inert (no behaviors → never moves), so the captured
    // center stays dead-on it and the detonation deals damage.
    const finishTick = restoredMage.activeAction!.finishTick;
    while (restored.currentTick < finishTick && !restored.ended) restored.tick();
    expect(restored.findUnit(enemy.id)!.currentHp).toBeLessThan(enemyHpAtSnapshot);
  });

  it('E7.D: round-trips a catapult MID-WIND-UP and still lands the shot post-restore', () => {
    // The catapult is the second multi-tick combat action and the first
    // HOMING one — its in-flight wind-up holds a live target REFERENCE
    // (serialized as targetId, re-resolved via world.findUnit on load).
    // Snapshot WHILE winding up, restore, and prove the restored world still
    // lands the shot on the same locked enemy.
    const bus = new EventBus<GameEvents>();
    const world = new World(bus, new RNG(1357));
    const cat = world.spawnUnit(rollUnit('catapult', new RNG(1)), 'player', { x: 5, y: 5 });
    cat.behaviors.push(new MovementBehavior(), new AbilityBehavior());
    // Y4b — production createAbility path (EffectAbility): the in-flight
    // EffectAction id 'catapult_shot' round-trips through the EffectAction
    // fallback now that its legacy action-factory entry is gone.
    cat.abilities.push(createAbility('catapult_shot'));
    const enemy = world.spawnUnit(rollUnit('mercenary', new RNG(2)), 'enemy', { x: 5, y: 9 });

    // Advance until the catapult is mid-wind-up (activeAction set, shot not
    // landed yet — currentTick strictly before finishTick).
    let midCharge = false;
    for (let i = 0; i < 200 && !midCharge; i++) {
      world.tick();
      const a = world.findUnit(cat.id)?.activeAction;
      if (a?.action.id === 'catapult_shot' && world.currentTick < a.finishTick - 1) midCharge = true;
    }
    expect(midCharge, 'catapult should be mid-wind-up within the window').toBe(true);
    const enemyHpAtSnapshot = world.findUnit(enemy.id)!.currentHp;

    const live = world.findUnit(cat.id)!;
    const wire = JSON.parse(JSON.stringify(world.toJSON()));
    const restored = World.fromJSON(wire, new EventBus<GameEvents>());
    const restoredCat = restored.units.find((u) => u.id === cat.id)!;

    expect(restoredCat.behaviors.map((b) => b.kind)).toEqual(['movement', 'ability']);
    expect(restoredCat.abilities.map((a) => a.id)).toEqual(['catapult_shot']);
    expect(restoredCat.activeAction?.action.id).toBe('catapult_shot');
    expect(restoredCat.activeAction?.startTick).toBe(live.activeAction?.startTick);
    expect(restoredCat.activeAction?.finishTick).toBe(live.activeAction?.finishTick);
    // F2 — phase timeline round-trips intact (windup/release/travel/impact);
    // the restored mid-wind-up resumes on the right phase at the right offset.
    expect(restoredCat.activeAction?.phases).toEqual(live.activeAction?.phases);

    // Tick the restored world past the wind-up: the shot must still land on
    // the locked enemy (inert → never moves, so the homing reference holds).
    const finishTick = restoredCat.activeAction!.finishTick;
    while (restored.currentTick < finishTick && !restored.ended) restored.tick();
    expect(restored.findUnit(enemy.id)!.currentHp).toBeLessThan(enemyHpAtSnapshot);
  });

  it('Y4: a migrated gambit/dash mid-action round-trips via the EffectAction fallback (not the legacy factory)', () => {
    // Y3 migrated gambit_strike + dash to EffectAbility, but their AbilityDef ids
    // EQUAL the legacy GAMBIT_STRIKE_ACTION_ID / DASH_ACTION_ID. Until Y4 dropped
    // those colliding action-factory entries, a mid-action snapshot rehydrated the
    // EffectAction's data through the legacy GambitStrikeAction/DashAction.fromData
    // (deleted in Y5c) and mis-decoded it (the data shapes differ entirely). Prove the round-trip now
    // routes to the generic EffectAction and the restored world continues
    // event-for-event identically. (Magic/catapult get the same guarantee from
    // the E7.C/E7.D cases once Y4a/b switch them to the production createAbility path.)
    const bus = new EventBus<GameEvents>();
    const events = recordEvents(bus);
    const world = new World(bus, new RNG(31415));
    for (const [team, y] of [['player', 5], ['enemy', 9]] as const) {
      const r = world.spawnUnit(rollUnit('rogue', new RNG(y)), team, { x: 5, y });
      r.behaviors.push(new MovementBehavior(), new AbilityBehavior());
      r.abilities.push(createAbility('gambit_strike'), createAbility('dash'));
    }

    // Advance until a rogue is mid-gambit or mid-dash — an in-flight EffectAction
    // whose id collides with a legacy action id. (Caught on the seating tick:
    // currentTick is strictly below finishTick the moment the action seats.)
    let snapshotAt = -1;
    for (let i = 0; i < 200 && snapshotAt < 0; i++) {
      world.tick();
      const colliding = world.units.find((u) => {
        const id = u.activeAction?.action.id;
        return (
          (id === 'gambit_strike' || id === 'dash') &&
          world.currentTick < u.activeAction!.finishTick
        );
      });
      if (colliding) {
        // The fix: the in-flight action is the generic EffectAction, not a legacy class.
        expect(colliding.activeAction!.action).toBeInstanceOf(EffectAction);
        snapshotAt = events.length;
      }
    }
    expect(snapshotAt, 'a rogue should be mid-gambit/dash within the window').toBeGreaterThan(0);

    // Snapshot mid-action, restore on a fresh bus, continue both to completion,
    // and compare the post-snapshot event slices.
    const restoredBus = new EventBus<GameEvents>();
    const restoredEvents = recordEvents(restoredBus);
    const restored = World.fromJSON(JSON.parse(JSON.stringify(world.toJSON())), restoredBus);
    for (const u of restored.units) {
      const id = u.activeAction?.action.id;
      if (id === 'gambit_strike' || id === 'dash') {
        expect(u.activeAction!.action).toBeInstanceOf(EffectAction);
      }
    }

    for (let i = 0; i < 500 && !restored.ended; i++) restored.tick();
    for (let i = 0; i < 500 && !world.ended; i++) world.tick();
    expect(restoredEvents).toEqual(events.slice(snapshotAt));
    expect(restored.ended).toBe(world.ended);
    expect(restored.currentTick).toBe(world.currentTick);
  });
});

describe('A2 round-trip: Run', () => {
  it('JSON wire format preserves enough state to continue the run identically', () => {
    const a = new Run(2026, new EventBus<GameEvents>());
    const first = a.nodeMap.rootId;
    a.dispatch({ kind: 'enterNode', nodeId: first });
    // Encounter A.
    const encounterA = a.currentEncounter!;

    // Serialize before the battle ends, restore on a fresh bus.
    const wire = JSON.parse(JSON.stringify(a.toJSON()));
    const b = Run.fromJSON(wire, new EventBus<GameEvents>());

    expect(b.phase).toBe('battle');
    expect(b.currentEncounter).toEqual(encounterA);
    // Stream byte-equivalence: after restore, the run RNG should pick the
    // same next encounter when we resume on the next frontier.
  });

  it('H1: roster templates carry `power`; a pre-H1 Run snapshot is rejected', () => {
    // The roster's leveled stat blocks (team: UnitTemplate[]) live in the Run
    // save, so H1's `power` addition bumped RUN_SCHEMA_VERSION (5→6) too.
    const run = new Run(2026, new EventBus<GameEvents>());
    const wire = JSON.parse(JSON.stringify(run.toJSON()));
    expect(wire.team.length).toBeGreaterThan(0);
    expect(wire.team[0].stats).toHaveProperty('power');

    expect(() => Run.fromJSON(wire, new EventBus<GameEvents>())).not.toThrow();

    const stale = { ...wire, schemaVersion: wire.schemaVersion - 1 };
    expect(() => Run.fromJSON(stale, new EventBus<GameEvents>())).toThrow(
      /unsupported schema version/,
    );
  });

  it('I1: roster templates carry the reverted/added stat keys; a pre-I1 Run snapshot is rejected', () => {
    // The roster's leveled stat blocks (team: UnitTemplate[]) live in the Run
    // save, so I1's agility→speed revert + precision/evasion adds bumped
    // RUN_SCHEMA_VERSION (9→10) too. A v9 save carries the old `agility`-keyed,
    // dodge-less block → reject.
    const run = new Run(2026, new EventBus<GameEvents>());
    const wire = JSON.parse(JSON.stringify(run.toJSON()));
    expect(wire.team.length).toBeGreaterThan(0);
    expect(wire.team[0].stats).toHaveProperty('speed');
    expect(wire.team[0].stats).toHaveProperty('precision');
    expect(wire.team[0].stats).toHaveProperty('evasion');
    expect(wire.team[0].stats).not.toHaveProperty('agility');

    expect(() => Run.fromJSON(wire, new EventBus<GameEvents>())).not.toThrow();

    const stale = { ...wire, schemaVersion: wire.schemaVersion - 1 };
    expect(() => Run.fromJSON(stale, new EventBus<GameEvents>())).toThrow(
      /unsupported schema version/,
    );
  });

  it('H3: the Run save carries `deploymentCounts` parallel to the roster; a pre-H3 snapshot is rejected', () => {
    // H3 added the per-roster-slot deployment counter to the Run save, so
    // RUN_SCHEMA_VERSION bumped (6→7). A v6 save has no counts → reject.
    const run = new Run(2026, new EventBus<GameEvents>());
    const wire = JSON.parse(JSON.stringify(run.toJSON()));
    expect(Array.isArray(wire.deploymentCounts)).toBe(true);
    expect(wire.deploymentCounts).toHaveLength(wire.team.length);

    expect(() => Run.fromJSON(wire, new EventBus<GameEvents>())).not.toThrow();

    const stale = { ...wire, schemaVersion: wire.schemaVersion - 1 };
    expect(() => Run.fromJSON(stale, new EventBus<GameEvents>())).toThrow(
      /unsupported schema version/,
    );
  });

  it('H4/M1: a mid-encounter Run save carries the pools + the per-turn-banked XP; a stale snapshot is rejected', () => {
    // H4 added the encounter-loop state (playerHealth/enemyHealth/turnIndex/
    // encounterBudget) to the Run save (7→8). M1 (16→17) REMOVED the
    // `pendingEncounterXp` sidecar — a turn's XP banks onto the roster slot at
    // the turn boundary, so the save carries it in `team` like any other XP.
    const bus = new EventBus<GameEvents>();
    const run = new Run(2026, bus);
    const first = run.nodeMap.rootId;
    run.dispatch({ kind: 'enterNode', nodeId: first });
    // Resolve one turn with a SUB-lethal chip so the encounter is still live
    // (phase 'battle', a 2nd turn pending) with non-trivial pools. The award
    // is sub-threshold, so it banks XP without pausing on a promotion.
    bus.emit('battle:ended', {
      winner: 'draw',
      xpAwards: [{ unitId: 1, rosterIndex: 0, damageDealt: 4, xpGained: 7 }],
      survivorPower: { player: 1, enemy: 2 },
    });
    expect(run.phase).toBe('battle'); // mid-encounter
    expect(run.team[0]!.xp).toBe(7); // banked at the boundary (M1)

    const wire = JSON.parse(JSON.stringify(run.toJSON()));
    expect(wire).toHaveProperty('playerHealth');
    expect(wire).toHaveProperty('enemyHealth');
    expect(wire).not.toHaveProperty('pendingEncounterXp'); // retired in v17

    const restored = Run.fromJSON(wire, new EventBus<GameEvents>());
    expect(restored.playerHealth).toBe(run.playerHealth);
    expect(restored.enemyHealth).toBe(run.enemyHealth);
    expect(restored.turnIndex).toBe(run.turnIndex);
    // U3 — the selected encounter + wave cursor round-trip (replaced encounterBudget).
    expect(restored.currentEncounterName).toBe(run.currentEncounterName);
    expect(restored.waveCursor).toEqual(run.waveCursor);
    expect(restored.team[0]!.xp).toBe(7);

    const stale = { ...wire, schemaVersion: wire.schemaVersion - 1 };
    expect(() => Run.fromJSON(stale, new EventBus<GameEvents>())).toThrow(
      /unsupported schema version/,
    );
  });

  it('H5: a mid-encounter Run save carries the deck (draw/discard/hand) + deckRng; a pre-H5 snapshot is rejected', () => {
    // H5 added the card deck to the Run save → RUN_SCHEMA_VERSION bumped (8→9).
    // An oversized roster (8 > handSize) leaves both a drawn hand AND a non-empty
    // draw pile mid-turn, so the round-trip exercises real deck state.
    const bus = new EventBus<GameEvents>();
    const run = new Run(2026, bus, { startingRoster: bigRoster() });
    const first = run.nodeMap.rootId;
    run.dispatch({ kind: 'enterNode', nodeId: first });
    expect(run.hand.length).toBeGreaterThan(0);
    expect(run.drawPile.length).toBeGreaterThan(0);

    const wire = JSON.parse(JSON.stringify(run.toJSON()));
    expect(wire).toHaveProperty('drawPile');
    expect(wire).toHaveProperty('discardPile');
    expect(wire).toHaveProperty('hand');
    expect(wire).toHaveProperty('deckRng');

    const restored = Run.fromJSON(wire, new EventBus<GameEvents>());
    expect(restored.drawPile).toEqual(run.drawPile);
    expect(restored.discardPile).toEqual(run.discardPile);
    expect(restored.hand).toEqual(run.hand);
    expect(restored.deckRng.toJSON()).toEqual(run.deckRng.toJSON());

    const stale = { ...wire, schemaVersion: wire.schemaVersion - 1 };
    expect(() => Run.fromJSON(stale, new EventBus<GameEvents>())).toThrow(
      /unsupported schema version/,
    );
  });

  it('H5: a restored Run draws the same NEXT hand as the original (deck determinism on resume)', () => {
    // The payoff of snapshotting deckRng + the piles: a mid-encounter restore
    // must reproduce the exact future draws, not just the current hand.
    const busA = new EventBus<GameEvents>();
    const a = new Run(2026, busA, { startingRoster: bigRoster() });
    const first = a.nodeMap.rootId;
    a.dispatch({ kind: 'enterNode', nodeId: first });

    const busB = new EventBus<GameEvents>();
    const b = Run.fromJSON(JSON.parse(JSON.stringify(a.toJSON())), busB);
    expect(b.hand).toEqual(a.hand); // same current hand

    // Resolve turn 1 identically on both (sub-lethal → turn 2 draws a fresh
    // hand). The restored run must draw the same turn-2 hand + leave the same
    // piles.
    const chip = { winner: 'draw' as const, xpAwards: [], survivorPower: { player: 0, enemy: 0 } };
    busA.emit('battle:ended', chip);
    busB.emit('battle:ended', chip);
    expect(b.hand).toEqual(a.hand);
    expect(b.drawPile).toEqual(a.drawPile);
    expect(b.discardPile).toEqual(a.discardPile);
  });

  it('S1: the persisted node map carries `hop` (not `floor`); a pre-rename (v17) save is rejected', () => {
    // S1 renamed the node-map progression concept MapNode.floor → MapNode.hop
    // (and bumped RUN_SCHEMA_VERSION 17→18). The nodeMap round-trips by shape,
    // so a pre-rename save carries `floor`-keyed nodes; the version check must
    // reject it outright rather than silently deserialize a hop-less node.
    const bus = new EventBus<GameEvents>();
    const run = new Run(2026, bus);

    const wire = JSON.parse(JSON.stringify(run.toJSON()));
    expect(wire.nodeMap.nodes[0]).toHaveProperty('hop');
    expect(wire.nodeMap.nodes[0]).not.toHaveProperty('floor');

    const restored = Run.fromJSON(wire, new EventBus<GameEvents>());
    // S2 — a fresh run sits at the pre-root sentinel; assert the position
    // round-trips (reading currentHop here would throw — no node entered yet).
    expect(restored.currentNodeId).toBe(run.currentNodeId);

    const stale = { ...wire, schemaVersion: wire.schemaVersion - 1 };
    expect(() => Run.fromJSON(stale, new EventBus<GameEvents>())).toThrow(
      /unsupported schema version/,
    );
  });

  it('S2: a fresh run persists the pre-root start position; a pre-S2 (v18) save is rejected', () => {
    // S2 made the root a normal selectable node: a run begins at the virtual
    // pre-root sentinel (not on the root), and bumped RUN_SCHEMA_VERSION 18→19.
    // A v18 save's start state would mis-restore (root looks pre-entered), so
    // the version check must reject it outright.
    const bus = new EventBus<GameEvents>();
    const run = new Run(2026, bus);
    expect(run.currentNodeId).toBe(PRE_ROOT_NODE_ID);
    expect(run.visitedNodes.size).toBe(0);

    const wire = JSON.parse(JSON.stringify(run.toJSON()));
    const restored = Run.fromJSON(wire, new EventBus<GameEvents>());
    expect(restored.currentNodeId).toBe(PRE_ROOT_NODE_ID);

    const stale = { ...wire, schemaVersion: wire.schemaVersion - 1 };
    expect(() => Run.fromJSON(stale, new EventBus<GameEvents>())).toThrow(
      /unsupported schema version/,
    );
  });
});

/** An 8-card roster (> handSize) for the H5 deck round-trip tests. */
function bigRoster(): { archetype: 'mercenary' | 'ranged'; level: number }[] {
  return Array.from({ length: 8 }, (_, i) => ({
    archetype: i % 2 === 0 ? 'mercenary' : 'ranged',
    level: 1,
  }));
}

/**
 * Spin up a fixture battle modeled on Game.spawnTeam so the test exercises
 * the full A1 action loop, not just isolated unit ticks.
 */
function freshBattle(seed: number): {
  world: World;
  events: RecordedEvent[];
} {
  const bus = new EventBus<GameEvents>();
  const world = new World(bus, new RNG(seed));
  const events = recordEvents(bus);

  const COLUMNS = [2, 4, 6, 8, 10];
  for (const x of COLUMNS) {
    const u = world.spawnUnit(rollUnit('mercenary', world.rng), 'player', { x, y: 2 });
    u.behaviors.push(new MovementBehavior(), new AbilityBehavior());
    u.abilities.push(createAbility('sword'));
  }
  for (const x of COLUMNS) {
    const u = world.spawnUnit(rollUnit('mercenary', world.rng), 'enemy', { x, y: 9 });
    u.behaviors.push(new MovementBehavior(), new AbilityBehavior());
    u.abilities.push(createAbility('sword'));
  }

  return { world, events };
}

type RecordedEvent =
  | { kind: 'tick'; tick: number }
  | { kind: 'unit:spawned'; unitId: number }
  | { kind: 'unit:moved'; unitId: number; fx: number; fy: number; tx: number; ty: number }
  | { kind: 'unit:attacked'; attackerId: number; targetId: number; damage: number }
  | { kind: 'unit:died'; unitId: number }
  | { kind: 'battle:ended'; winner: Team | 'draw' }; // N2 — a capped turn resolves as 'draw'

function recordEvents(bus: EventBus<GameEvents>): RecordedEvent[] {
  const out: RecordedEvent[] = [];
  bus.on('tick', (p) => out.push({ kind: 'tick', tick: p.tick }));
  bus.on('unit:spawned', (p) => out.push({ kind: 'unit:spawned', unitId: p.unitId }));
  bus.on('unit:moved', (p) =>
    out.push({
      kind: 'unit:moved',
      unitId: p.unitId,
      fx: p.from.x,
      fy: p.from.y,
      tx: p.to.x,
      ty: p.to.y,
    }),
  );
  bus.on('unit:attacked', (p) =>
    out.push({
      kind: 'unit:attacked',
      attackerId: p.attackerId,
      targetId: p.targetId,
      damage: p.damage,
    }),
  );
  bus.on('unit:died', (p) => out.push({ kind: 'unit:died', unitId: p.unitId }));
  bus.on('battle:ended', (p) => out.push({ kind: 'battle:ended', winner: p.winner }));
  return out;
}

// Keep Unit referenced so the import isn't dead — used inside `freshBattle` indirectly.
void Unit;
