import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { World } from './World';
import { Unit, type Team, type UnitStats } from './Unit';
import { EventBus } from '../core/EventBus';
import { RNG } from '../core/RNG';
import { deriveStats } from './stats';
import { ARCHETYPE_CONFIG } from './archetypes';
import { STATS } from '../config/stats';
import { secondsToTicks } from '../config';
import { STATUS_DEFS } from '../config/statuses';
import { parseStatusDef } from './effects/statusSchema';
import type { GameEvents } from '../core/events';

/**
 * Phase 27b — the periodic (DoT/HoT) engine. The op/interval/duration are
 * def-resolved by `key` from STATUS_DEFS, so these tests register FIXTURE defs
 * into the (file-isolated) registry rather than reading the shipped catalog
 * (empty until 27c). Tick counts are derived from `secondsToTicks` (the existing
 * convention), never hardcoded — TICK_RATE-agnostic.
 */

const E = Math.max(1, secondsToTicks(1)); // ticks per `everySeconds: 1` interval
const D = Math.max(1, secondsToTicks(2.4)); // duration: 2E < D < 3E (always 2 ticks)

function dmgOp(might: number, bypassDefense: boolean) {
  return {
    kind: 'damage' as const,
    scaling: 'none' as const,
    might,
    accuracy: 1,
    critBase: 0,
    critable: false,
    evadable: false,
    bypassDefense,
  };
}

const FIXTURES = {
  t_burn: { durationSeconds: 2.4, merge: 'refresh', periodic: { everySeconds: 1, op: dmgOp(3, true) } },
  t_armor_dot: { durationSeconds: 2.4, merge: 'refresh', periodic: { everySeconds: 1, op: dmgOp(10, false) } },
  t_bleed: { durationSeconds: 2.4, merge: 'add', periodic: { everySeconds: 1, op: dmgOp(2, true) } },
  t_rejuv: {
    durationSeconds: 2.4,
    merge: 'refresh',
    periodic: { everySeconds: 1, op: { kind: 'heal' as const, scaling: 'none' as const, might: 3 } },
  },
  t_mark: { durationSeconds: 2.4, merge: 'ignore' }, // no periodic — reserved-merge probe
} as const;

beforeAll(() => {
  for (const [id, body] of Object.entries(FIXTURES)) {
    STATUS_DEFS[id] = parseStatusDef({ id, name: id, ...body });
  }
});
afterAll(() => {
  for (const id of Object.keys(FIXTURES)) delete STATUS_DEFS[id];
});

interface Probe {
  world: World;
  victim: Unit;
  foe: Unit;
  applied: GameEvents['status:applied'][];
  ticked: GameEvents['status:ticked'][];
  expired: GameEvents['status:expired'][];
  deaths: GameEvents['unit:died'][];
}

/** A lone player VICTIM (no behaviors → inert) at FULL health + a far inert
 *  enemy to keep `checkBattleEnd` from ending the battle. The enemy doubles as a
 *  DoT SOURCE. Tests override `victim.currentHp` directly when they need a
 *  specific HP (a kill, a near-max heal clamp). */
function setup(victimStats: Partial<UnitStats> = {}): Probe {
  const bus = new EventBus<GameEvents>();
  const world = new World(bus, new RNG(1));
  const applied: GameEvents['status:applied'][] = [];
  const ticked: GameEvents['status:ticked'][] = [];
  const expired: GameEvents['status:expired'][] = [];
  const deaths: GameEvents['unit:died'][] = [];
  bus.on('status:applied', (p) => applied.push(p));
  bus.on('status:ticked', (p) => ticked.push(p));
  bus.on('status:expired', (p) => expired.push(p));
  bus.on('unit:died', (p) => deaths.push(p));

  const mk = (id: number, team: Team, x: number, y: number, extra: Partial<UnitStats>) => {
    const stats: UnitStats = { ...ARCHETYPE_CONFIG.mercenary.baseStats, ...extra };
    const u = new Unit({
      id,
      team,
      archetype: 'mercenary',
      glyph: 'M',
      stats,
      derived: deriveStats(stats, 1),
      position: { x, y },
    });
    world.units.push(u); // constructor seats currentHp at maxHp (full health)
    return u;
  };
  const victim = mk(1, 'player', 1, 1, victimStats);
  const foe = mk(2, 'enemy', 11, 11, {});
  return { world, victim, foe, applied, ticked, expired, deaths };
}

describe('27b — periodic DoT', () => {
  it('fires status:applied on apply, then ticks one interval LATER (no double-dip)', () => {
    const p = setup();
    const hp0 = p.victim.currentHp;
    p.world.applyStatusEffect(p.victim, STATUS_DEFS.t_burn!, null);
    expect(p.applied).toEqual([{ unitId: 1, statusId: 't_burn', sourceUnitId: null }]);

    for (let i = 0; i < E - 1; i++) p.world.tick(); // up to one tick before the interval
    expect(p.ticked).toHaveLength(0);
    expect(p.victim.currentHp).toBe(hp0);

    p.world.tick(); // tickCount === E → first tick
    expect(p.ticked).toHaveLength(1);
    expect(p.ticked[0]).toEqual({ unitId: 1, statusId: 't_burn', sourceUnitId: null, amount: 3 });
    expect(p.victim.currentHp).toBe(hp0 - 3);

    for (let i = 0; i < E; i++) p.world.tick(); // tickCount === 2E → second tick
    expect(p.ticked).toHaveLength(2);
    expect(p.victim.currentHp).toBe(hp0 - 6);
  });

  it('expires after its duration: status:expired fires and ticking stops', () => {
    const p = setup();
    p.world.applyStatusEffect(p.victim, STATUS_DEFS.t_burn!, null);
    for (let i = 0; i < D; i++) p.world.tick(); // reach the duration boundary
    expect(p.expired).toEqual([{ unitId: 1, statusId: 't_burn', sourceUnitId: null }]);
    expect(p.ticked).toHaveLength(2); // ticked at E + 2E only; 3E > D, expiry preempts
    const before = p.victim.currentHp;
    for (let i = 0; i < 3 * E; i++) p.world.tick(); // well past — no more ticks
    expect(p.ticked).toHaveLength(2);
    expect(p.victim.currentHp).toBe(before);
  });

  it('damage = round(might × magnitude); bypassDefense honored both ways', () => {
    // bypassDefense:true (burn) ignores armor entirely.
    const burnP = setup({ defense: 4 });
    const burnHp0 = burnP.victim.currentHp;
    burnP.world.applyStatusEffect(burnP.victim, STATUS_DEFS.t_burn!, null);
    for (let i = 0; i < E; i++) burnP.world.tick();
    expect(burnP.victim.currentHp).toBe(burnHp0 - 3); // 3 dealt, defense 4 ignored

    // bypassDefense:false (an armor-respecting DoT) routes through mitigation.
    const armorP = setup({ defense: 4 });
    const armorHp0 = armorP.victim.currentHp;
    armorP.world.applyStatusEffect(armorP.victim, STATUS_DEFS.t_armor_dot!, null);
    for (let i = 0; i < E; i++) armorP.world.tick();
    const expected = Math.max(STATS.minDamage, 10 - 4);
    expect(armorP.victim.currentHp).toBe(armorHp0 - expected);
  });

  it('credits the source for a sourced DoT; environmental (null) credits no one', () => {
    const p = setup();
    p.world.applyStatusEffect(p.victim, STATUS_DEFS.t_burn!, p.foe.id); // enemy → player
    for (let i = 0; i < E; i++) p.world.tick();
    expect(p.ticked[0]!.sourceUnitId).toBe(p.foe.id);
    expect(p.world.damageDealtBy(p.foe.id)).toBe(3);

    const envP = setup();
    envP.world.applyStatusEffect(envP.victim, STATUS_DEFS.t_burn!, null);
    for (let i = 0; i < E; i++) envP.world.tick();
    expect(envP.world.damageDealtBy(1)).toBe(0);
  });

  it('a DoT kill is reaped on the same tick (unit:died, removed from the grid)', () => {
    const p = setup();
    p.victim.currentHp = 2; // burn deals 3 → lethal
    p.world.applyStatusEffect(p.victim, STATUS_DEFS.t_burn!, p.foe.id);
    for (let i = 0; i < E; i++) p.world.tick();
    expect(p.deaths).toContainEqual({ unitId: 1, team: 'player' });
    expect(p.world.findUnit(1)).toBeUndefined();
  });
});

describe('27b — periodic HoT + merge policies', () => {
  it('a HoT heals and clamps at maxHp (status:ticked carries the real delta)', () => {
    const p = setup();
    const max = p.victim.derived.maxHp;
    p.victim.currentHp = max - 2; // 2 below full; rejuvenate heals 3
    p.world.applyStatusEffect(p.victim, STATUS_DEFS.t_rejuv!, p.foe.id);
    for (let i = 0; i < E; i++) p.world.tick();
    expect(p.victim.currentHp).toBe(max); // +3 clamped to +2
    expect(p.ticked[0]!.amount).toBe(2);
    for (let i = 0; i < E; i++) p.world.tick();
    expect(p.victim.currentHp).toBe(max); // already full → +0
    expect(p.ticked[1]!.amount).toBe(0);
  });

  it('`add` merge stacks magnitude → escalating ticks; cadence is preserved', () => {
    const p = setup();
    p.world.applyStatusEffect(p.victim, STATUS_DEFS.t_bleed!, null, 1); // 2/tick
    for (let i = 0; i < E - 2; i++) p.world.tick();
    p.world.applyStatusEffect(p.victim, STATUS_DEFS.t_bleed!, null, 1); // re-hit BEFORE first tick → magnitude 2
    for (let i = 0; i < 2; i++) p.world.tick(); // reach the ORIGINAL anchor (tickCount E)
    expect(p.ticked).toHaveLength(1); // cadence not pushed back by the re-hit
    expect(p.ticked[0]!.amount).toBe(4); // 2 × magnitude 2
  });

  it('`refresh` merge tops up duration without resetting the tick cadence or magnitude', () => {
    const p = setup();
    p.world.applyStatusEffect(p.victim, STATUS_DEFS.t_burn!, null);
    for (let i = 0; i < E; i++) p.world.tick(); // first tick at E
    expect(p.ticked).toHaveLength(1);
    p.world.applyStatusEffect(p.victim, STATUS_DEFS.t_burn!, null); // refresh
    expect(p.victim.effects.find((e) => e.key === 't_burn')!.magnitude).toBe(1); // not stacked
    for (let i = 0; i < E; i++) p.world.tick(); // tickCount 2E → next tick on the original cadence
    expect(p.ticked).toHaveLength(2);
    expect(p.ticked[1]!.amount).toBe(3);
  });

  it('`ignore` merge is a no-op when the status is already present', () => {
    const p = setup();
    p.world.applyStatusEffect(p.victim, STATUS_DEFS.t_mark!, null);
    p.world.applyStatusEffect(p.victim, STATUS_DEFS.t_mark!, null);
    expect(p.victim.effects.filter((e) => e.key === 't_mark')).toHaveLength(1);
  });
});

describe('27b — snapshot round-trip', () => {
  it('a mid-flight DoT round-trips its cursor/source/magnitude and keeps ticking', () => {
    const p = setup();
    p.world.applyStatusEffect(p.victim, STATUS_DEFS.t_burn!, p.foe.id, 2); // sourced, magnitude 2
    p.world.tick();
    p.world.tick(); // tickCount 2, before the first fire (E > 2)

    const snap = JSON.parse(JSON.stringify(p.world.toJSON())) as ReturnType<World['toJSON']>;
    const bus2 = new EventBus<GameEvents>();
    const ticked2: GameEvents['status:ticked'][] = [];
    bus2.on('status:ticked', (e) => ticked2.push(e));
    const w2 = World.fromJSON(snap, bus2);

    const eff = w2.findUnit(1)!.effects.find((e) => e.key === 't_burn')!;
    expect(eff.nextTickAt).toBe(E); // applied at tick 0
    expect(eff.sourceUnitId).toBe(2);
    expect(eff.magnitude).toBe(2);

    const hpBefore = w2.findUnit(1)!.currentHp;
    for (let i = 2; i < E; i++) w2.tick(); // advance the rehydrated world to the interval
    expect(ticked2).toHaveLength(1);
    expect(ticked2[0]!.amount).toBe(6); // might 3 × magnitude 2
    expect(w2.findUnit(1)!.currentHp).toBe(hpBefore - 6);
  });
});
