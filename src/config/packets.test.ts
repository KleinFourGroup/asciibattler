import { describe, expect, it } from 'vitest';

import {
  PACKETS,
  PACKET_IDS,
  PACKET_OP_CONTEXTS,
  PACKET_OP_TARGET,
  PACKET_TARGET_KINDS,
  PacketsSchema,
  USE_CONTEXTS,
  assertPacketStatusRefs,
  normalizePacket,
  packetById,
  type PacketConfig,
} from './packets';
import { STATUS_DEFS } from './statuses';

/** Minimal legal file carrying the given packet body over defaults (the
 *  rewards.test.ts `withEntries` fixture shape). */
const withPacket = (overrides: Record<string, unknown>): unknown => ({
  packets: [
    {
      id: 'test',
      name: 'Test',
      description: 'Fixture.',
      usableIn: ['outOfBattle'],
      target: 'none',
      effect: { op: 'healPool', amount: 3 },
      ...overrides,
    },
  ],
});

const parses = (overrides: Record<string, unknown>): boolean =>
  PacketsSchema.safeParse(withPacket(overrides)).success;

/** A legal (target, usableIn) pair for the given op, read from the exported
 *  matrix — never hardcoded (the balance-proof discipline). */
const legalFor = (op: keyof typeof PACKET_OP_TARGET) => ({
  target: PACKET_OP_TARGET[op],
  usableIn: [PACKET_OP_CONTEXTS[op][0]],
});

describe('the packet schema (49a)', () => {
  it('the shipped catalog parses and carries the 49a skeleton packet', () => {
    expect(PACKETS.length).toBeGreaterThanOrEqual(1);
    expect(PACKET_IDS).toContain('patch');
    const skeleton = packetById('patch')!;
    expect(skeleton.effect.op).toBe('healPool');
    expect(skeleton.target).toBe(PACKET_OP_TARGET.healPool);
  });

  it('accepts every launch op in its matrix-legal shape', () => {
    expect(
      parses({
        ...legalFor('applyBuff'),
        effect: {
          op: 'applyBuff',
          buff: { key: 'hyped', mods: { strength: { add: 4 } }, merge: 'add' },
          duration: 'encounter',
        },
      }),
    ).toBe(true);
    expect(
      parses({
        ...legalFor('grantRedraws'),
        effect: { op: 'grantRedraws', redrawsPerTurn: 1, maxCardsPerTurn: 2 },
      }),
    ).toBe(true);
    expect(
      parses({
        ...legalFor('injectRule'),
        effect: {
          op: 'injectRule',
          rule: { on: 'dealHit', effect: { op: 'applyStatus', statusId: 'poison' } },
          duration: 'encounter',
        },
      }),
    ).toBe(true);
    expect(
      parses({
        ...legalFor('healPool'),
        effect: { op: 'healPool', amount: 3 },
      }),
    ).toBe(true);
  });

  it('enforces the op → target matrix (both directions)', () => {
    // applyBuff demands a unit target; none-target ops reject 'unit'.
    expect(
      parses({
        target: 'none',
        usableIn: ['preTurn'],
        effect: {
          op: 'applyBuff',
          buff: { key: 'hyped', mods: { strength: { add: 4 } }, merge: 'add' },
          duration: 'encounter',
        },
      }),
    ).toBe(false);
    expect(parses({ target: 'unit', usableIn: ['outOfBattle'] })).toBe(false);
  });

  it('enforces the op → context matrix', () => {
    // 49e grew healPool to BOTH launch contexts (patch's between-turns
    // heal); grantRedraws / injectRule stay pre-turn only.
    expect(parses({ usableIn: ['preTurn'] })).toBe(true);
    expect(
      parses({
        target: 'none',
        usableIn: ['outOfBattle'],
        effect: { op: 'grantRedraws', redrawsPerTurn: 1, maxCardsPerTurn: 2 },
      }),
    ).toBe(false);
    expect(
      parses({
        target: 'none',
        usableIn: ['outOfBattle'],
        effect: {
          op: 'injectRule',
          rule: { on: 'dealHit', effect: { op: 'gainBits', amount: 1 } },
          duration: 'encounter',
        },
      }),
    ).toBe(false);
  });

  it("restricts applyTo 'target' to dealHit rules (a kill's victim is already dead — 49e)", () => {
    const venomish = (on: string) =>
      parses({
        ...legalFor('injectRule'),
        effect: {
          op: 'injectRule',
          rule: {
            on,
            effect: { op: 'applyStatus', statusId: 'poison', applyTo: 'target' },
          },
          duration: 'encounter',
        },
      });
    expect(venomish('dealHit')).toBe(true);
    expect(venomish('kill')).toBe(false);
  });

  it("rejects the dormant seams for EVERY op — 'tile' targets and 'midBattle' contexts", () => {
    // Derived from the exported matrices: no op admits either value yet
    // (the seam ships, the feature doesn't). If a future op legalizes one,
    // this test self-updates through the matrix.
    expect(Object.values(PACKET_OP_TARGET)).not.toContain('tile');
    for (const contexts of Object.values(PACKET_OP_CONTEXTS)) {
      expect(contexts).not.toContain('midBattle');
    }
    expect(PACKET_TARGET_KINDS).toContain('tile');
    expect(USE_CONTEXTS).toContain('midBattle');
    expect(parses({ target: 'tile' })).toBe(false);
    expect(parses({ usableIn: ['midBattle'] })).toBe(false);
  });

  it('restricts the duration axis to the engine-supported subset per op', () => {
    expect(
      parses({
        ...legalFor('applyBuff'),
        effect: {
          op: 'applyBuff',
          buff: { key: 'hyped', mods: { strength: { add: 4 } }, merge: 'add' },
          duration: 'run',
        },
      }),
    ).toBe(false);
    expect(
      parses({
        ...legalFor('injectRule'),
        effect: {
          op: 'injectRule',
          rule: { on: 'dealHit', effect: { op: 'gainBits', amount: 1 } },
          duration: 'run',
        },
      }),
    ).toBe(true);
    expect(
      parses({
        ...legalFor('injectRule'),
        effect: {
          op: 'injectRule',
          rule: { on: 'dealHit', effect: { op: 'gainBits', amount: 1 } },
          duration: 'battle',
        },
      }),
    ).toBe(false);
  });

  it("pins the crit filter to 'dealHit' inside an injected rule (the 47b matrix)", () => {
    const withTrigger = (on: string): Record<string, unknown> => ({
      ...legalFor('injectRule'),
      effect: {
        op: 'injectRule',
        rule: { on, filter: { crit: true }, effect: { op: 'gainBits', amount: 1 } },
        duration: 'encounter',
      },
    });
    expect(parses(withTrigger('dealHit'))).toBe(true);
    expect(parses(withTrigger('kill'))).toBe(false);
  });

  it('rejects run triggers inside an injected rule (battle-domain only)', () => {
    expect(
      parses({
        ...legalFor('injectRule'),
        effect: {
          op: 'injectRule',
          rule: { on: 'turnStart', effect: { op: 'gainBits', amount: 1 } },
          duration: 'encounter',
        },
      }),
    ).toBe(false);
  });

  it('rejects empty/duplicate usableIn, duplicate ids, and an empty catalog', () => {
    expect(parses({ usableIn: [] })).toBe(false);
    expect(parses({ usableIn: ['outOfBattle', 'outOfBattle'] })).toBe(false);
    const dup = {
      packets: [withPacket({}), withPacket({})].map(
        (f) => (f as { packets: unknown[] }).packets[0],
      ),
    };
    expect(PacketsSchema.safeParse(dup).success).toBe(false);
    expect(PacketsSchema.safeParse({ packets: [] }).success).toBe(false);
  });

  it('normalizePacket builds exact-optional injected rules (no explicit-undefined keys)', () => {
    const raw = PacketsSchema.parse(
      withPacket({
        ...legalFor('injectRule'),
        effect: {
          op: 'injectRule',
          rule: { on: 'dealHit', effect: { op: 'applyStatus', statusId: 'poison' } },
          duration: 'encounter',
        },
      }),
    ).packets[0]!;
    const packet = normalizePacket(raw);
    const effect = packet.effect as Extract<PacketConfig['effect'], { op: 'injectRule' }>;
    expect('chance' in effect.rule).toBe(false);
    expect('filter' in effect.rule).toBe(false);
    expect('magnitude' in effect.rule.effect).toBe(false);
  });

  it('packetById returns undefined on a miss', () => {
    expect(packetById('no-such-packet')).toBeUndefined();
  });
});

describe('assertPacketStatusRefs (the boot check)', () => {
  const packetWith = (statusId: string): PacketConfig => ({
    id: 'synthetic',
    name: 'Synthetic',
    description: 'Fixture.',
    usableIn: ['preTurn'],
    target: 'none',
    effect: {
      op: 'injectRule',
      rule: { on: 'dealHit', effect: { op: 'applyStatus', statusId } },
      duration: 'encounter',
    },
  });

  it('the shipped catalog resolves against the real status registry', () => {
    expect(() => assertPacketStatusRefs(PACKETS, STATUS_DEFS)).not.toThrow();
  });

  it('throws on a dangling status id inside an injected rule', () => {
    expect(() => assertPacketStatusRefs([packetWith('nope')], STATUS_DEFS)).toThrow(
      /unknown status id 'nope'/,
    );
  });
});
