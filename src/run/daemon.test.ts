import { describe, it, expect } from 'vitest';
import {
  rollDaemon,
  resolveTurnGrants,
  resolveInstantHooks,
  battleRulesFor,
  disabledTurnGrants,
  daemonRedrawHook,
  daemonEmpowerHook,
  type TurnGrants,
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

/** 47e — the all-disabled resolution (grants baseline, no instants). */
function disabledResolution(): { grants: TurnGrants; instants: never[] } {
  return { grants: disabledTurnGrants(), instants: [] };
}

describe('resolveTurnGrants', () => {
  it('no daemons → nothing granted, no RNG draw', () => {
    const rng = new RNG(7);
    const before = rng.toJSON();
    expect(resolveTurnGrants([], rng)).toEqual(disabledResolution());
    expect(rng.toJSON()).toEqual(before);
  });

  it('a rule-less daemon → nothing granted, no RNG draw', () => {
    const rng = new RNG(7);
    const before = rng.toJSON();
    const inert: DaemonConfig = { id: 'inert', name: 'Inert', description: 'no rules' };
    expect(resolveTurnGrants([inert], rng)).toEqual(disabledResolution());
    expect(rng.toJSON()).toEqual(before);
  });

  it('a chance-less hook is granted with the authored knobs and costs no draw', () => {
    const rng = new RNG(7);
    const before = rng.toJSON();
    const { grants } = resolveTurnGrants([SURE_BOTH], rng);
    const [redraw, empower] = SURE_BOTH.rules! as [HookRule, HookRule];
    expect(grants.redraw).toEqual({
      enabled: true,
      redrawsPerTurn: (redraw.effect as { redrawsPerTurn: number }).redrawsPerTurn,
      maxCardsPerTurn: (redraw.effect as { maxCardsPerTurn: number }).maxCardsPerTurn,
    });
    expect(grants.empowers).toEqual([
      {
        daemonId: SURE_BOTH.id,
        empowersPerTurn: (empower.effect as { empowersPerTurn: number }).empowersPerTurn,
        buff: (empower.effect as { buff: object }).buff,
      },
    ]);
    expect(rng.toJSON()).toEqual(before);
  });

  it('a chance-0 hook is denied and costs no draw', () => {
    const rng = new RNG(7);
    const before = rng.toJSON();
    expect(resolveTurnGrants([NEVER], rng).grants.redraw.enabled).toBe(false);
    expect(rng.toJSON()).toEqual(before);
  });

  it('an ungranted kind resolves to the disabled baseline', () => {
    // COIN_REDRAW authors no empower hook at all — empowers must read empty
    // whatever the coin does.
    const { grants } = resolveTurnGrants([COIN_REDRAW], new RNG(7));
    expect(grants.empowers).toEqual([]);
  });

  it('a coin-flip hook draws exactly once, deterministically, and lands both ways', () => {
    const outcomes = new Set<boolean>();
    for (let seed = 0; seed < 50; seed++) {
      const rng = new RNG(seed);
      const replay = new RNG(seed);
      const flip = resolveTurnGrants([COIN_REDRAW], rng).grants.redraw.enabled;
      // Same stream state → same outcome (the determinism the save relies
      // on), and the stream advanced by exactly the one flip draw.
      expect(resolveTurnGrants([COIN_REDRAW], replay).grants.redraw.enabled).toBe(flip);
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
      const { grants } = resolveTurnGrants([both], new RNG(seed));
      const manual = new RNG(seed);
      const redrawFlip = manual.next() < 0.5;
      const empowerFlip = manual.next() < 0.5;
      expect(grants.redraw.enabled).toBe(redrawFlip);
      expect(grants.empowers.length === 1).toBe(empowerFlip);
    }
  });

  it('daemons evaluate in OWNERSHIP order (the 47d multi-daemon draw contract)', () => {
    const coinA: DaemonConfig = { ...COIN_REDRAW, id: 'coin-a' };
    const coinB: DaemonConfig = {
      id: 'coin-b',
      name: 'Coin B',
      description: 'coin-flip empower',
      rules: [empowerHook(0.5)],
    };
    for (let seed = 0; seed < 20; seed++) {
      const { grants } = resolveTurnGrants([coinA, coinB], new RNG(seed));
      const manual = new RNG(seed);
      const aFlip = manual.next() < 0.5;
      const bFlip = manual.next() < 0.5;
      expect(grants.redraw.enabled).toBe(aFlip);
      expect(grants.empowers.map((g) => g.daemonId)).toEqual(bFlip ? ['coin-b'] : []);
    }
  });

  it('multiple granted redraw hooks ACCUMULATE into the one summed budget', () => {
    const stacked: DaemonConfig = {
      id: 'test-stack',
      name: 'Test Stack',
      description: 'two redraw hooks',
      rules: [redrawHook(undefined, 2), redrawHook(undefined, 6)],
    };
    const { grants } = resolveTurnGrants([stacked], new RNG(7));
    expect(grants.redraw).toEqual({ enabled: true, redrawsPerTurn: 2, maxCardsPerTurn: 8 });
  });

  it('granted empower hooks stay PER SOURCE (the 47d per-idol model)', () => {
    const marsLike: DaemonConfig = {
      id: 'idol-a',
      name: 'Idol A',
      description: 'empower a',
      rules: [empowerHook(undefined)],
    };
    const minervaLike: DaemonConfig = {
      id: 'idol-b',
      name: 'Idol B',
      description: 'empower b',
      rules: [empowerHook(undefined)],
    };
    const { grants } = resolveTurnGrants([marsLike, minervaLike], new RNG(7));
    expect(grants.empowers.map((g) => g.daemonId)).toEqual(['idol-a', 'idol-b']);
    expect(grants.empowers.map((g) => g.empowersPerTurn)).toEqual([1, 1]);
  });

  it('granted instant ops collect into `instants` in walk order, still costing no draw (47e)', () => {
    const withInstant: DaemonConfig = {
      id: 'test-instant',
      name: 'Test Instant',
      description: 'a gainBits turnStart hook',
      rules: [
        { kind: 'hook', on: 'turnStart', effect: { op: 'gainBits', amount: 5 } },
        redrawHook(undefined, 6),
        { kind: 'hook', on: 'turnStart', effect: { op: 'healPool', amount: 3 } },
      ],
    };
    const rng = new RNG(7);
    const before = rng.toJSON();
    const { grants, instants } = resolveTurnGrants([withInstant], rng);
    expect(grants.redraw.enabled).toBe(true);
    expect(grants.empowers).toEqual([]);
    expect(instants).toEqual([
      { op: 'gainBits', amount: 5 },
      { op: 'healPool', amount: 3 },
    ]);
    // The chance-less instant hooks still cost no draw.
    expect(rng.toJSON()).toEqual(before);
  });

  it('a denied coin-flip instant op stays OUT of `instants` (47e)', () => {
    const coinBits: DaemonConfig = {
      id: 'test-coin-bits',
      name: 'Test Coin Bits',
      description: 'coin-flip gainBits',
      rules: [{ kind: 'hook', on: 'turnStart', chance: 0.5, effect: { op: 'gainBits', amount: 5 } }],
    };
    for (let seed = 0; seed < 20; seed++) {
      const { instants } = resolveTurnGrants([coinBits], new RNG(seed));
      const flip = new RNG(seed).next() < 0.5;
      expect(instants.length === 1).toBe(flip);
    }
  });
});

describe('resolveInstantHooks (47e — the encounterStart/encounterEnd fire sites)', () => {
  const endBits = (
    filter?: { won: boolean },
    chance?: number,
  ): DaemonConfig => ({
    id: 'test-end-bits',
    name: 'Test End Bits',
    description: 'bits at encounter end',
    rules: [
      {
        kind: 'hook',
        on: 'encounterEnd',
        ...(chance !== undefined ? { chance } : {}),
        ...(filter !== undefined ? { filter } : {}),
        effect: { op: 'gainBits', amount: 5 },
      },
    ],
  });

  it('no daemons / no matching trigger → empty, no draw', () => {
    const rng = new RNG(7);
    const before = rng.toJSON();
    expect(resolveInstantHooks([], 'encounterEnd', { won: true }, rng)).toEqual([]);
    // A turnStart-only daemon has nothing at encounterEnd.
    expect(resolveInstantHooks([SURE_BOTH], 'encounterEnd', { won: true }, rng)).toEqual([]);
    expect(rng.toJSON()).toEqual(before);
  });

  it("the `won` filter gates the firing — and a filtered-out firing costs NO draw", () => {
    const daemon = endBits({ won: true }, 0.5);
    const rng = new RNG(7);
    const before = rng.toJSON();
    // Lost encounter: filter fails → no draw, no op (the coin never flips).
    expect(resolveInstantHooks([daemon], 'encounterEnd', { won: false }, rng)).toEqual([]);
    expect(rng.toJSON()).toEqual(before);
    // Won encounter: filter passes → the coin flips (one draw).
    resolveInstantHooks([daemon], 'encounterEnd', { won: true }, rng);
    expect(rng.toJSON()).not.toEqual(before);
  });

  it('an unfiltered hook fires on both outcomes; a chance-less one costs no draw', () => {
    const daemon = endBits();
    const rng = new RNG(7);
    const before = rng.toJSON();
    expect(resolveInstantHooks([daemon], 'encounterEnd', { won: true }, rng)).toEqual([
      { op: 'gainBits', amount: 5 },
    ]);
    expect(resolveInstantHooks([daemon], 'encounterEnd', { won: false }, rng)).toEqual([
      { op: 'gainBits', amount: 5 },
    ]);
    expect(rng.toJSON()).toEqual(before);
  });

  it('encounterStart hooks resolve at their own trigger only', () => {
    const startHeal: DaemonConfig = {
      id: 'test-start-heal',
      name: 'Test Start Heal',
      description: 'heal at encounter start',
      rules: [{ kind: 'hook', on: 'encounterStart', effect: { op: 'healPool', amount: 2 } }],
    };
    const rng = new RNG(7);
    expect(resolveInstantHooks([startHeal], 'encounterStart', {}, rng)).toEqual([
      { op: 'healPool', amount: 2 },
    ]);
    expect(resolveInstantHooks([startHeal], 'encounterEnd', { won: true }, rng)).toEqual([]);
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

describe('battleRulesFor (47f — the battle-domain compile)', () => {
  it('compiles ONLY battle-domain hooks, preserving ownership × authored order', () => {
    const mixed: DaemonConfig = {
      id: 'test-mixed',
      name: 'Test Mixed',
      description: 'run + battle hooks + a modifier',
      rules: [
        { kind: 'modifier', stat: 'bitsGain', op: 'mult', value: 1.5 },
        { kind: 'hook', on: 'turnStart', effect: { op: 'gainBits', amount: 2 } },
        { kind: 'hook', on: 'dealHit', filter: { crit: true }, effect: { op: 'gainBits', amount: 1 } },
        { kind: 'hook', on: 'kill', chance: 0.5, effect: { op: 'gainBits', amount: 5 } },
      ],
    };
    const second: DaemonConfig = {
      id: 'test-second',
      name: 'Test Second',
      description: 'one battle hook',
      rules: [{ kind: 'hook', on: 'dealHit', effect: { op: 'gainBits', amount: 3 } }],
    };
    expect(battleRulesFor([mixed, second])).toEqual([
      { on: 'dealHit', filter: { crit: true }, effect: { op: 'gainBits', amount: 1 } },
      { on: 'kill', chance: 0.5, effect: { op: 'gainBits', amount: 5 } },
      { on: 'dealHit', effect: { op: 'gainBits', amount: 3 } },
    ]);
  });

  it('no daemons / run-only daemons compile to an empty list', () => {
    expect(battleRulesFor([])).toEqual([]);
    expect(battleRulesFor([SURE_BOTH, COIN_REDRAW])).toEqual([]);
  });

  it('the shipped catalog compiles clean: laverna + fortuna are the only battle-hook idols', () => {
    for (const d of DAEMONS) {
      const compiled = battleRulesFor([d]);
      if (d.id === 'laverna' || d.id === 'fortuna') expect(compiled).toHaveLength(1);
      else expect(compiled).toEqual([]);
    }
  });
});

describe('the shipped catalog (config/daemons.json) — design-shape pins', () => {
  it('ships the four L idols + the three 47e/f economy idols', () => {
    expect(DAEMONS.map((d) => d.id).sort()).toEqual([
      'fortuna',
      'janus',
      'laverna',
      'mars',
      'mercury',
      'minerva',
      'moneta',
    ]);
  });

  it('laverna pays a bit per rogue blow (example daemon #1 — battle→run tally)', () => {
    const [rule] = battleRulesFor([daemonById('laverna')!]);
    expect(rule).toEqual({
      on: 'dealHit',
      filter: { archetype: 'rogue' },
      effect: { op: 'gainBits', amount: 1 },
    });
  });

  it('fortuna emboldens the striker on a crit (example daemon #2 — battle→battle status)', () => {
    const [rule] = battleRulesFor([daemonById('fortuna')!]);
    expect(rule).toEqual({
      on: 'dealHit',
      filter: { crit: true },
      effect: { op: 'applyStatus', statusId: 'emboldened' },
    });
    // Neither battle idol grants a pre-turn tool (the catalog-inclusion call).
    for (const id of ['laverna', 'fortuna']) {
      expect(daemonRedrawHook(daemonById(id)!)).toBeUndefined();
      expect(daemonEmpowerHook(daemonById(id)!)).toBeUndefined();
    }
  });

  it('moneta is a pure passive: one bitsGain mult > 1, no hooks (example daemon #3)', () => {
    const moneta = daemonById('moneta')!;
    expect(moneta.rules).toHaveLength(1);
    const rule = moneta.rules![0]!;
    expect(rule.kind).toBe('modifier');
    if (rule.kind === 'modifier') {
      expect(rule.stat).toBe('bitsGain');
      expect(rule.op).toBe('mult');
      expect(rule.value).toBeGreaterThan(1);
    }
    // A pure passive grants NO pre-turn tools — a moneta-only run has
    // neither redraw nor empower (the catalog-inclusion call, 47e).
    expect(daemonRedrawHook(moneta)).toBeUndefined();
    expect(daemonEmpowerHook(moneta)).toBeUndefined();
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
