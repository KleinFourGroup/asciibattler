import { describe, it, expect } from 'vitest';
import {
  rollDaemon,
  resolveTurnGrants,
  disabledTurnGrants,
  daemonRedrawHook,
  daemonEmpowerHook,
} from './daemon';
import { DAEMONS, daemonById, type DaemonConfig, type HookRule } from '../config/daemons';
import { DECK } from '../config/deck';
import { RNG } from '../core/RNG';

/**
 * L1→47c — the pure daemon rules: the run-start roll + the per-turn grant
 * resolution (`turnStart` hooks → this turn's effective configs). Bespoke
 * fixture daemons exercise the mechanics (the redraw.test.ts pattern —
 * explicit literals, not the `DAEMONS` singleton); a separate block pins the
 * SHIPPED catalog's design shape, with every expectation derived from the
 * config modules (no hardcoded balance values).
 */

const redrawHook = (chance: number | undefined, maxCards: number): HookRule => ({
  kind: 'hook',
  on: 'turnStart',
  ...(chance !== undefined ? { chance } : {}),
  effect: { op: 'grantRedraws', redrawsPerTurn: 1, maxCardsPerTurn: maxCards },
});

const empowerHook = (chance: number | undefined): HookRule => ({
  kind: 'hook',
  on: 'turnStart',
  ...(chance !== undefined ? { chance } : {}),
  effect: {
    op: 'grantEmpowers',
    empowersPerTurn: 1,
    buff: { key: 'test-buff', mods: { strength: { add: 2 } }, merge: 'add' },
  },
});

/** A guaranteed full-package daemon (both grants, no coin) — the K3/K4 static
 *  defaults reborn as a daemon. Redraw hook FIRST (the L1 draw-order
 *  discipline, now the authored-rule-order contract). */
const SURE_BOTH: DaemonConfig = {
  id: 'test-sure',
  name: 'Test Sure',
  description: 'both grants, guaranteed',
  rules: [redrawHook(undefined, 6), empowerHook(undefined)],
};

/** A coin-flip redraw daemon (the Mercury shape). */
const COIN_REDRAW: DaemonConfig = {
  id: 'test-coin',
  name: 'Test Coin',
  description: 'coin-flip redraw',
  rules: [redrawHook(0.5, 6)],
};

/** A never-grants daemon (chance 0 — the no-draw contract's other edge). */
const NEVER: DaemonConfig = {
  id: 'test-never',
  name: 'Test Never',
  description: 'never grants',
  rules: [redrawHook(0, 6)],
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

describe('resolveTurnGrants', () => {
  it('null daemon → both grants disabled, no RNG draw', () => {
    const rng = new RNG(7);
    const before = rng.toJSON();
    expect(resolveTurnGrants(null, rng)).toEqual(disabledTurnGrants());
    expect(rng.toJSON()).toEqual(before);
  });

  it('a rule-less daemon → both grants disabled, no RNG draw', () => {
    const rng = new RNG(7);
    const before = rng.toJSON();
    const inert: DaemonConfig = { id: 'inert', name: 'Inert', description: 'no rules' };
    expect(resolveTurnGrants(inert, rng)).toEqual(disabledTurnGrants());
    expect(rng.toJSON()).toEqual(before);
  });

  it('a chance-less hook is granted with the authored knobs and costs no draw', () => {
    const rng = new RNG(7);
    const before = rng.toJSON();
    const grants = resolveTurnGrants(SURE_BOTH, rng);
    const [redraw, empower] = SURE_BOTH.rules! as [HookRule, HookRule];
    expect(grants.redraw).toEqual({
      enabled: true,
      redrawsPerTurn: (redraw.effect as { redrawsPerTurn: number }).redrawsPerTurn,
      maxCardsPerTurn: (redraw.effect as { maxCardsPerTurn: number }).maxCardsPerTurn,
    });
    expect(grants.empower.enabled).toBe(true);
    expect(grants.empower.empowersPerTurn).toBe(
      (empower.effect as { empowersPerTurn: number }).empowersPerTurn,
    );
    expect(grants.empower.buff).toEqual((empower.effect as { buff: object }).buff);
    expect(rng.toJSON()).toEqual(before);
  });

  it('a chance-0 hook is denied and costs no draw', () => {
    const rng = new RNG(7);
    const before = rng.toJSON();
    expect(resolveTurnGrants(NEVER, rng).redraw.enabled).toBe(false);
    expect(rng.toJSON()).toEqual(before);
  });

  it('an ungranted kind resolves to the disabled config', () => {
    // COIN_REDRAW authors no empower hook at all — empower must read disabled
    // whatever the coin does.
    const grants = resolveTurnGrants(COIN_REDRAW, new RNG(7));
    expect(grants.empower).toEqual(disabledTurnGrants().empower);
  });

  it('a coin-flip hook draws exactly once, deterministically, and lands both ways', () => {
    const outcomes = new Set<boolean>();
    for (let seed = 0; seed < 50; seed++) {
      const rng = new RNG(seed);
      const replay = new RNG(seed);
      const flip = resolveTurnGrants(COIN_REDRAW, rng).redraw.enabled;
      // Same stream state → same outcome (the determinism the save relies
      // on), and the stream advanced by exactly the one flip draw.
      expect(resolveTurnGrants(COIN_REDRAW, replay).redraw.enabled).toBe(flip);
      expect(rng.toJSON()).toEqual(replay.toJSON());
      replay.next();
      outcomes.add(flip);
    }
    expect(outcomes).toEqual(new Set([true, false]));
  });

  it('draws in authored rule order (the L1 redraw-then-empower contract, generalized)', () => {
    const both: DaemonConfig = {
      ...SURE_BOTH,
      rules: [redrawHook(0.5, 6), empowerHook(0.5)],
    };
    for (let seed = 0; seed < 20; seed++) {
      const grants = resolveTurnGrants(both, new RNG(seed));
      const manual = new RNG(seed);
      const redrawFlip = manual.next() < 0.5;
      const empowerFlip = manual.next() < 0.5;
      expect(grants.redraw.enabled).toBe(redrawFlip);
      expect(grants.empower.enabled).toBe(empowerFlip);
    }
  });

  it('multiple granted redraw hooks ACCUMULATE (the 47d multi-daemon fold)', () => {
    const stacked: DaemonConfig = {
      id: 'test-stack',
      name: 'Test Stack',
      description: 'two redraw hooks',
      rules: [redrawHook(undefined, 2), redrawHook(undefined, 6)],
    };
    const grants = resolveTurnGrants(stacked, new RNG(7));
    expect(grants.redraw).toEqual({ enabled: true, redrawsPerTurn: 2, maxCardsPerTurn: 8 });
  });

  it('non-grant turnStart ops are skipped here (fire-site execution, not the grant fold)', () => {
    const withInstant: DaemonConfig = {
      id: 'test-instant',
      name: 'Test Instant',
      description: 'a gainBits turnStart hook',
      rules: [
        { kind: 'hook', on: 'turnStart', effect: { op: 'gainBits', amount: 5 } },
        redrawHook(undefined, 6),
      ],
    };
    const rng = new RNG(7);
    const before = rng.toJSON();
    const grants = resolveTurnGrants(withInstant, rng);
    expect(grants.redraw.enabled).toBe(true);
    expect(grants.empower.enabled).toBe(false);
    // The chance-less gainBits hook still costs no draw.
    expect(rng.toJSON()).toEqual(before);
  });
});

describe('daemonRedrawHook / daemonEmpowerHook (the authored-hook lookups)', () => {
  it('finds the authored grant effects; undefined for null / missing kinds', () => {
    expect(daemonRedrawHook(SURE_BOTH)?.op).toBe('grantRedraws');
    expect(daemonEmpowerHook(SURE_BOTH)?.op).toBe('grantEmpowers');
    expect(daemonRedrawHook(null)).toBeUndefined();
    expect(daemonEmpowerHook(COIN_REDRAW)).toBeUndefined();
    expect(daemonRedrawHook(daemonById('mars')!)).toBeUndefined();
    expect(daemonEmpowerHook(daemonById('mars')!)?.op).toBe('grantEmpowers');
  });
});

describe('the shipped catalog (config/daemons.json) — design-shape pins', () => {
  it('ships the four idols of the L design round', () => {
    expect(DAEMONS.map((d) => d.id).sort()).toEqual(['janus', 'mars', 'mercury', 'minerva']);
  });

  it('mars and minerva are empower-only; mercury and janus are redraw-only', () => {
    for (const id of ['mars', 'minerva']) {
      const d = daemonById(id)!;
      expect(daemonEmpowerHook(d)).toBeDefined();
      expect(daemonRedrawHook(d)).toBeUndefined();
      // The empower idols grant every turn (no coin) — one pick per turn.
      const hook = d.rules!.find((r) => r.kind === 'hook' && r.effect.op === 'grantEmpowers')!;
      expect(hook.kind === 'hook' && (hook.chance ?? 1)).toBe(1);
    }
    for (const id of ['mercury', 'janus']) {
      const d = daemonById(id)!;
      expect(daemonRedrawHook(d)).toBeDefined();
      expect(daemonEmpowerHook(d)).toBeUndefined();
    }
  });

  it('mercury is a genuine coin flip for the FULL redraw', () => {
    const mercury = daemonById('mercury')!;
    const hook = mercury.rules!.find((r): r is HookRule => r.kind === 'hook')!;
    expect(hook.chance).toBeGreaterThan(0);
    expect(hook.chance).toBeLessThan(1);
    // "Full" = the whole hand is selectable in the one batch.
    expect(daemonRedrawHook(mercury)!.maxCardsPerTurn).toBe(DECK.handSize);
  });

  it('janus is guaranteed but partial — the reliable-but-small face', () => {
    const janus = daemonById('janus')!;
    const hook = janus.rules!.find((r): r is HookRule => r.kind === 'hook')!;
    expect(hook.chance ?? 1).toBe(1);
    expect(daemonRedrawHook(janus)!.maxCardsPerTurn).toBeGreaterThanOrEqual(1);
    expect(daemonRedrawHook(janus)!.maxCardsPerTurn).toBeLessThan(DECK.handSize);
  });

  it('mars buffs offense, minerva buffs defense (distinct keys, additive mods)', () => {
    const mars = daemonEmpowerHook(daemonById('mars')!)!.buff;
    const minerva = daemonEmpowerHook(daemonById('minerva')!)!.buff;
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
