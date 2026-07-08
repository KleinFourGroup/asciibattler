import { describe, expect, it } from 'vitest';

import type { StatusDef } from '../sim/effects/statusSchema';
import { STATUS_DEFS } from './statuses';
import {
  DAEMONS,
  DaemonsSchema,
  assertDaemonStatusRefs,
  daemonById,
  normalizeDaemon,
  type DaemonConfig,
} from './daemons';

/** Minimal legal daemon carrying the given rules (47b fixtures). */
const withRules = (rules: unknown[]): unknown => ({
  daemons: [{ id: 'test', name: 'Test', description: 'A test daemon.', rules }],
});

const BUFF = { key: 'empowered', mods: { strength: { add: 4 } }, merge: 'add' };

const parses = (rules: unknown[]): boolean => DaemonsSchema.safeParse(withRules(rules)).success;

describe('the Rule schema (47b — the rule vocabulary)', () => {
  it('the shipped catalog parses and every idol authors rules (47c)', () => {
    expect(DAEMONS.length).toBeGreaterThanOrEqual(4);
    for (const d of DAEMONS) expect(d.rules!.length).toBeGreaterThanOrEqual(1);
  });

  it('accepts a daemon with no rules field (inert but legal)', () => {
    expect(
      DaemonsSchema.safeParse({
        daemons: [{ id: 'bare', name: 'Bare', description: 'No rules.' }],
      }).success,
    ).toBe(true);
  });

  it('accepts every launch op on a legal trigger', () => {
    expect(
      parses([
        { kind: 'modifier', stat: 'bitsGain', op: 'mult', value: 1.2 },
        { kind: 'modifier', stat: 'cacheSize', op: 'add', value: 3 },
        {
          kind: 'hook',
          on: 'turnStart',
          chance: 0.5,
          effect: { op: 'grantRedraws', redrawsPerTurn: 1, maxCardsPerTurn: 6 },
        },
        {
          kind: 'hook',
          on: 'turnStart',
          effect: { op: 'grantEmpowers', empowersPerTurn: 1, buff: BUFF },
        },
        { kind: 'hook', on: 'encounterEnd', filter: { won: true }, effect: { op: 'healPool', amount: 3 } },
        {
          kind: 'hook',
          on: 'dealHit',
          filter: { archetype: 'rogue' },
          effect: { op: 'gainBits', amount: 1 },
        },
        {
          kind: 'hook',
          on: 'dealHit',
          filter: { crit: true },
          effect: { op: 'applyStatus', statusId: 'burn', durationSeconds: 5 },
        },
        { kind: 'hook', on: 'kill', effect: { op: 'applyStatus', statusId: 'burn' } },
      ]),
    ).toBe(true);
  });

  it('rejects unknown stats, triggers, ops, and out-of-range chance', () => {
    expect(parses([{ kind: 'modifier', stat: 'luck', op: 'add', value: 1 }])).toBe(false);
    expect(
      parses([{ kind: 'hook', on: 'unitDied', effect: { op: 'gainBits', amount: 1 } }]),
    ).toBe(false);
    expect(parses([{ kind: 'hook', on: 'turnStart', effect: { op: 'explode' } }])).toBe(false);
    expect(
      parses([{ kind: 'hook', on: 'turnStart', chance: 1.5, effect: { op: 'gainBits', amount: 1 } }]),
    ).toBe(false);
  });

  describe('the (trigger × op) domain matrix', () => {
    it('rejects a battle-domain op on a run trigger', () => {
      expect(
        parses([{ kind: 'hook', on: 'turnStart', effect: { op: 'applyStatus', statusId: 'burn' } }]),
      ).toBe(false);
    });

    it('rejects a run-domain op on a battle trigger', () => {
      expect(
        parses([{ kind: 'hook', on: 'dealHit', effect: { op: 'healPool', amount: 3 } }]),
      ).toBe(false);
    });

    it('rejects a grant off turnStart (grants are per-turn budgets)', () => {
      expect(
        parses([
          {
            kind: 'hook',
            on: 'encounterStart',
            effect: { op: 'grantRedraws', redrawsPerTurn: 1, maxCardsPerTurn: 6 },
          },
        ]),
      ).toBe(false);
    });

    it("allows 'both'-domain gainBits on run AND battle triggers", () => {
      expect(
        parses([{ kind: 'hook', on: 'encounterEnd', effect: { op: 'gainBits', amount: 5 } }]),
      ).toBe(true);
      expect(
        parses([{ kind: 'hook', on: 'kill', effect: { op: 'gainBits', amount: 1 } }]),
      ).toBe(true);
    });
  });

  describe('the filter legality matrix', () => {
    const gain = { op: 'gainBits', amount: 1 };

    it("'crit' only rides dealHit", () => {
      expect(parses([{ kind: 'hook', on: 'dealHit', filter: { crit: true }, effect: gain }])).toBe(true);
      expect(parses([{ kind: 'hook', on: 'kill', filter: { crit: true }, effect: gain }])).toBe(false);
    });

    it("'archetype' only rides battle triggers", () => {
      expect(parses([{ kind: 'hook', on: 'kill', filter: { archetype: 'rogue' }, effect: gain }])).toBe(true);
      expect(
        parses([{ kind: 'hook', on: 'turnStart', filter: { archetype: 'rogue' }, effect: gain }]),
      ).toBe(false);
    });

    it("'won' only rides encounterEnd", () => {
      expect(parses([{ kind: 'hook', on: 'encounterEnd', filter: { won: true }, effect: gain }])).toBe(true);
      expect(parses([{ kind: 'hook', on: 'turnStart', filter: { won: true }, effect: gain }])).toBe(false);
    });
  });

  it('normalizeDaemon builds exact-optional rules (no explicit-undefined keys)', () => {
    const parsed = DaemonsSchema.parse(
      withRules([
        { kind: 'hook', on: 'dealHit', effect: { op: 'applyStatus', statusId: 'burn' } },
        { kind: 'modifier', stat: 'bitsGain', op: 'mult', value: 1.2 },
      ]),
    );
    const daemon = normalizeDaemon(parsed.daemons[0]!);
    const hook = daemon.rules![0]!;
    expect(hook.kind).toBe('hook');
    expect(Object.keys(hook)).not.toContain('chance');
    expect(Object.keys(hook)).not.toContain('filter');
    if (hook.kind === 'hook' && hook.effect.op === 'applyStatus') {
      expect(Object.keys(hook.effect)).not.toContain('magnitude');
      expect(Object.keys(hook.effect)).not.toContain('durationSeconds');
    }
    expect(daemon.rules![1]).toEqual({ kind: 'modifier', stat: 'bitsGain', op: 'mult', value: 1.2 });
  });
});

describe('assertDaemonStatusRefs (the boot check)', () => {
  const daemonWith = (rules: DaemonConfig['rules']): DaemonConfig => ({
    id: 'synthetic',
    name: 'Synthetic',
    description: 'Fixture.',
    ...(rules !== undefined ? { rules } : {}),
  });

  it('the shipped catalog resolves against the real registry — no longer vacuous (47f: fortuna refs emboldened)', () => {
    expect(() => assertDaemonStatusRefs(DAEMONS, STATUS_DEFS)).not.toThrow();
    // The check has a real subject now: strip the registry and fortuna's
    // applyStatus ref must fail loudly at boot.
    expect(() => assertDaemonStatusRefs(DAEMONS, {})).toThrow(
      /daemon 'fortuna': applyStatus references unknown status id 'emboldened'/,
    );
  });

  it('throws on a dangling applyStatus statusId', () => {
    const daemon = daemonWith([
      { kind: 'hook', on: 'dealHit', effect: { op: 'applyStatus', statusId: 'nope' } },
    ]);
    expect(() => assertDaemonStatusRefs([daemon], {})).toThrow(/unknown status id 'nope'/);
  });

  it('passes when every ref resolves', () => {
    const daemon = daemonWith([
      { kind: 'hook', on: 'dealHit', effect: { op: 'applyStatus', statusId: 'burn' } },
    ]);
    const burn = { id: 'burn' } as unknown as StatusDef;
    expect(() => assertDaemonStatusRefs([daemon], { burn })).not.toThrow();
  });
});

describe('catalog lookup (pre-47b behavior holds)', () => {
  it('daemonById still resolves the four idols', () => {
    for (const id of ['mars', 'minerva', 'mercury', 'janus']) {
      expect(daemonById(id)?.id).toBe(id);
    }
  });
});
