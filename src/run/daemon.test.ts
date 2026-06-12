import { describe, it, expect } from 'vitest';
import { rollDaemon, resolveTurnGates, disabledTurnGates } from './daemon';
import { DAEMONS, daemonById, type DaemonConfig } from '../config/daemons';
import { DECK } from '../config/deck';
import { RNG } from '../core/RNG';

/**
 * L1 — the pure daemon rules: the run-start roll + the per-turn gate
 * resolution. Bespoke fixture daemons exercise the mechanics (the
 * redraw.test.ts pattern — explicit literals, not the `DAEMONS` singleton);
 * a separate block pins the SHIPPED catalog's design shape, with every
 * expectation derived from the config modules (no hardcoded balance values).
 */

/** A guaranteed full-package daemon (both gates, no coin) — the K3/K4 static
 *  defaults reborn as a daemon, also the Run.test.ts fixture shape. */
const SURE_BOTH: DaemonConfig = {
  id: 'test-sure',
  name: 'Test Sure',
  description: 'both gates, guaranteed',
  redraw: { chance: 1, redrawsPerTurn: 1, maxCardsPerTurn: 6 },
  empower: {
    chance: 1,
    empowersPerTurn: 1,
    buff: { key: 'test-buff', mods: { strength: { add: 2 } }, merge: 'add' },
  },
};

/** A coin-flip redraw daemon (the Mercury shape). */
const COIN_REDRAW: DaemonConfig = {
  id: 'test-coin',
  name: 'Test Coin',
  description: 'coin-flip redraw',
  redraw: { chance: 0.5, redrawsPerTurn: 1, maxCardsPerTurn: 6 },
};

/** A never-grants daemon (chance 0 — the no-draw contract's other edge). */
const NEVER: DaemonConfig = {
  id: 'test-never',
  name: 'Test Never',
  description: 'never grants',
  redraw: { chance: 0, redrawsPerTurn: 1, maxCardsPerTurn: 6 },
};

describe('rollDaemon', () => {
  it('is deterministic per seed', () => {
    expect(rollDaemon(DAEMONS, new RNG(42)).id).toBe(rollDaemon(DAEMONS, new RNG(42)).id);
  });

  it('covers the whole catalog over seeds (uniform roll, no dead entries)', () => {
    const seen = new Set<string>();
    for (let seed = 0; seed < 200; seed++) seen.add(rollDaemon(DAEMONS, new RNG(seed)).id);
    expect([...seen].sort()).toEqual(DAEMONS.map((d) => d.id).sort());
  });
});

describe('resolveTurnGates', () => {
  it('null daemon → both gates disabled, no RNG draw', () => {
    const rng = new RNG(7);
    const before = rng.toJSON();
    expect(resolveTurnGates(null, rng)).toEqual(disabledTurnGates());
    expect(rng.toJSON()).toEqual(before);
  });

  it('a chance-1 gate is granted with the daemon knobs and costs no draw', () => {
    const rng = new RNG(7);
    const before = rng.toJSON();
    const gates = resolveTurnGates(SURE_BOTH, rng);
    expect(gates.redraw).toEqual({
      enabled: true,
      redrawsPerTurn: SURE_BOTH.redraw!.redrawsPerTurn,
      maxCardsPerTurn: SURE_BOTH.redraw!.maxCardsPerTurn,
    });
    expect(gates.empower.enabled).toBe(true);
    expect(gates.empower.empowersPerTurn).toBe(SURE_BOTH.empower!.empowersPerTurn);
    expect(gates.empower.buff).toEqual(SURE_BOTH.empower!.buff);
    expect(rng.toJSON()).toEqual(before);
  });

  it('a chance-0 gate is denied and costs no draw', () => {
    const rng = new RNG(7);
    const before = rng.toJSON();
    expect(resolveTurnGates(NEVER, rng).redraw.enabled).toBe(false);
    expect(rng.toJSON()).toEqual(before);
  });

  it('an ungranted gate kind resolves to the disabled config', () => {
    // COIN_REDRAW carries no empower gate at all — empower must read disabled
    // whatever the coin does.
    const gates = resolveTurnGates(COIN_REDRAW, new RNG(7));
    expect(gates.empower).toEqual(disabledTurnGates().empower);
  });

  it('a coin-flip gate draws exactly once, deterministically, and lands both ways', () => {
    const outcomes = new Set<boolean>();
    for (let seed = 0; seed < 50; seed++) {
      const rng = new RNG(seed);
      const replay = new RNG(seed);
      const flip = resolveTurnGates(COIN_REDRAW, rng).redraw.enabled;
      // Same stream state → same outcome (the determinism the v16 save relies
      // on), and the stream advanced by exactly the one flip draw.
      expect(resolveTurnGates(COIN_REDRAW, replay).redraw.enabled).toBe(flip);
      expect(rng.toJSON()).toEqual(replay.toJSON());
      replay.next();
      outcomes.add(flip);
    }
    expect(outcomes).toEqual(new Set([true, false]));
  });

  it('draw order is redraw-then-empower (the fixed per-turn contract)', () => {
    const both: DaemonConfig = {
      ...SURE_BOTH,
      redraw: { ...SURE_BOTH.redraw!, chance: 0.5 },
      empower: { ...SURE_BOTH.empower!, chance: 0.5 },
    };
    for (let seed = 0; seed < 20; seed++) {
      const gates = resolveTurnGates(both, new RNG(seed));
      const manual = new RNG(seed);
      const redrawFlip = manual.next() < both.redraw!.chance;
      const empowerFlip = manual.next() < both.empower!.chance;
      expect(gates.redraw.enabled).toBe(redrawFlip);
      expect(gates.empower.enabled).toBe(empowerFlip);
    }
  });
});

describe('the shipped catalog (config/daemons.json) — design-shape pins', () => {
  it('ships the four idols of the L design round', () => {
    expect(DAEMONS.map((d) => d.id).sort()).toEqual(['janus', 'mars', 'mercury', 'minerva']);
  });

  it('mars and minerva are empower-only; mercury and janus are redraw-only', () => {
    for (const id of ['mars', 'minerva']) {
      const d = daemonById(id)!;
      expect(d.empower).toBeDefined();
      expect(d.redraw).toBeUndefined();
      // The empower idols grant every turn (no coin) — one pick per turn.
      expect(d.empower!.chance).toBe(1);
    }
    for (const id of ['mercury', 'janus']) {
      const d = daemonById(id)!;
      expect(d.redraw).toBeDefined();
      expect(d.empower).toBeUndefined();
    }
  });

  it('mercury is a genuine coin flip for the FULL redraw', () => {
    const mercury = daemonById('mercury')!;
    expect(mercury.redraw!.chance).toBeGreaterThan(0);
    expect(mercury.redraw!.chance).toBeLessThan(1);
    // "Full" = the whole hand is selectable in the one batch.
    expect(mercury.redraw!.maxCardsPerTurn).toBe(DECK.handSize);
  });

  it('janus is guaranteed but partial — the reliable-but-small face', () => {
    const janus = daemonById('janus')!;
    expect(janus.redraw!.chance).toBe(1);
    expect(janus.redraw!.maxCardsPerTurn).toBeGreaterThanOrEqual(1);
    expect(janus.redraw!.maxCardsPerTurn).toBeLessThan(DECK.handSize);
  });

  it('mars buffs offense, minerva buffs defense (distinct keys, additive mods)', () => {
    const mars = daemonById('mars')!.empower!.buff;
    const minerva = daemonById('minerva')!.empower!.buff;
    expect(mars.key).not.toBe(minerva.key);
    for (const stat of ['strength', 'ranged', 'magic'] as const) {
      expect(mars.mods[stat]?.add).toBeGreaterThan(0);
    }
    expect(mars.mods.defense).toBeUndefined();
    expect(minerva.mods.defense?.add).toBeGreaterThan(0);
    expect(minerva.mods.strength).toBeUndefined();
  });

  it('daemonById misses return undefined', () => {
    expect(daemonById('cthulhu')).toBeUndefined();
  });
});
