import { describe, expect, it } from 'vitest';

import type { EncounterRewardRef, RewardEntry, RewardTable } from '../config/rewards';
import { RNG } from '../core/RNG';
import { rollRewards } from './rewards';

// ── fixtures ────────────────────────────────────────────────────────────────

const table = (id: string, entries: RewardEntry[]): RewardTable => ({ id, entries });
const lookup =
  (...tables: RewardTable[]) =>
  (id: string): RewardTable | undefined =>
    tables.find((t) => t.id === id);
const ref = (tableId: string, chance = 1): EncounterRewardRef => ({
  table: tableId,
  trigger: { chance },
});
const bitsE = (min: number, max: number, weight = 1): RewardEntry => ({
  kind: 'bits',
  weight,
  min,
  max,
});
const daemonE = (daemon: string, weight = 1): RewardEntry => ({ kind: 'daemon', weight, daemon });
const packetE = (packet: string, weight = 1): RewardEntry => ({ kind: 'packet', weight, packet });
// 74c — real archetype ids: rollUnit resolves against the live combatant
// catalog (a synthetic id would crash it, unlike the pure-id daemon/packet
// fixtures above).
const unitE = (archetype: string, level?: number, weight = 1): RewardEntry =>
  level === undefined ? { kind: 'unit', weight, archetype } : { kind: 'unit', weight, archetype, level };
const poolE = (amount: number, weight = 1): RewardEntry => ({ kind: 'poolHealth', weight, amount });

const NONE = new Set<string>();

/** The stream's serialized position — the draw-count probe. */
const pos = (rng: RNG): number => rng.toJSON().state;

describe('rollRewards (48b — the pure roller)', () => {
  it('a chance-1 ref on a degenerate singleton costs ZERO draws on both streams', () => {
    const tableRng = new RNG(1);
    const bitsRng = new RNG(2);
    const t0 = pos(tableRng);
    const b0 = pos(bitsRng);
    const portions = rollRewards(
      [ref('t')],
      lookup(table('t', [bitsE(7, 7)])),
      NONE,
      tableRng,
      bitsRng,
    );
    expect(portions).toEqual([{ kind: 'bits', base: 7 }]);
    // chance 1 = no flip; singleton entry = no sampling draw (gotcha #111);
    // min === max = no bits draw. The whole roll consumed no entropy.
    expect(pos(tableRng)).toBe(t0);
    expect(pos(bitsRng)).toBe(b0);
  });

  it('a real bits range rolls in [min, max] on the BITS stream only', () => {
    for (let seed = 0; seed < 20; seed++) {
      const tableRng = new RNG(100 + seed);
      const t0 = pos(tableRng);
      const bitsRng = new RNG(200 + seed);
      const portions = rollRewards(
        [ref('t')],
        lookup(table('t', [bitsE(8, 15)])),
        NONE,
        tableRng,
        bitsRng,
      );
      expect(portions).toHaveLength(1);
      const p = portions[0]!;
      if (p.kind !== 'bits') throw new Error('expected bits');
      expect(p.base).toBeGreaterThanOrEqual(8);
      expect(p.base).toBeLessThanOrEqual(15);
      // The singleton-entry table drew nothing on the sampling stream.
      expect(pos(tableRng)).toBe(t0);
    }
  });

  it('a sub-1 chance flips once on the table stream — fire and skip are both one draw', () => {
    // With mulberry32, outcomes vary by seed; assert the CONTRACT: exactly
    // one draw either way, and the portion appears iff the flip passed.
    for (const seed of [1, 2, 3, 4, 5]) {
      const flipProbe = new RNG(seed);
      const fired = flipProbe.next() < 0.5;
      const tableRng = new RNG(seed);
      const portions = rollRewards(
        [ref('t', 0.5)],
        lookup(table('t', [bitsE(3, 3)])),
        NONE,
        tableRng,
        new RNG(0),
      );
      expect(portions.length).toBe(fired ? 1 : 0);
      expect(pos(tableRng)).toBe(pos(flipProbe));
    }
  });

  it('excludes owned daemons before sampling (the floor entry catches the roll)', () => {
    for (let seed = 0; seed < 10; seed++) {
      const portions = rollRewards(
        [ref('t')],
        lookup(table('t', [daemonE('moneta', 1000), bitsE(1, 1, 0.001)])),
        new Set(['moneta']),
        new RNG(seed),
        new RNG(0),
      );
      // The overwhelmingly-weighted daemon entry is owned → filtered → the
      // singleton bits floor lands every time, with no sampling draw.
      expect(portions).toEqual([{ kind: 'bits', base: 1 }]);
    }
  });

  it('a table empty after filtering yields nothing and draws nothing', () => {
    const tableRng = new RNG(9);
    const t0 = pos(tableRng);
    const portions = rollRewards(
      [ref('t')],
      lookup(table('t', [daemonE('moneta')])),
      new Set(['moneta']),
      tableRng,
      new RNG(0),
    );
    expect(portions).toEqual([]);
    expect(pos(tableRng)).toBe(t0);
  });

  it('a daemon granted earlier in the SAME roll is excluded from later refs', () => {
    const daemonOnly = table('t', [daemonE('fortuna')]);
    const portions = rollRewards(
      [ref('t'), ref('t')],
      lookup(daemonOnly),
      NONE,
      new RNG(1),
      new RNG(0),
    );
    // The second ref's table filters to empty — one fortuna, never two.
    expect(portions).toEqual([{ kind: 'daemon', daemonId: 'fortuna' }]);
  });

  it('packet entries sample and carry their id (49c — the dormancy guard retired)', () => {
    const tableRng = new RNG(1);
    const t0 = pos(tableRng);
    const portions = rollRewards(
      [ref('t')],
      lookup(table('t', [packetE('patch')])),
      NONE,
      tableRng,
      new RNG(0),
    );
    expect(portions).toEqual([{ kind: 'packet', packetId: 'patch' }]);
    // A singleton packet entry draws nothing (gotcha #111 parity with bits).
    expect(pos(tableRng)).toBe(t0);
  });

  it('packets have NO exclusion — the same packet can drop from every ref in one roll', () => {
    const portions = rollRewards(
      [ref('t'), ref('t')],
      lookup(table('t', [packetE('patch')])),
      NONE,
      new RNG(1),
      new RNG(0),
    );
    // Contrast the daemon same-roll exclusion test above: duplicates are
    // legal cache content (one SLOT each), so both refs pay out.
    expect(portions).toEqual([
      { kind: 'packet', packetId: 'patch' },
      { kind: 'packet', packetId: 'patch' },
    ]);
  });

  it('refs resolve in authored order (the deterministic evaluation order)', () => {
    const portions = rollRewards(
      [ref('a'), ref('b')],
      lookup(table('a', [bitsE(1, 1)]), table('b', [daemonE('janus')])),
      NONE,
      new RNG(1),
      new RNG(0),
    );
    expect(portions).toEqual([
      { kind: 'bits', base: 1 },
      { kind: 'daemon', daemonId: 'janus' },
    ]);
  });

  it('weighted sampling respects weights (an extreme weight dominates)', () => {
    for (let seed = 0; seed < 20; seed++) {
      const portions = rollRewards(
        [ref('t')],
        lookup(table('t', [bitsE(5, 5, 1_000_000), daemonE('mars', 0.000001)])),
        NONE,
        new RNG(300 + seed),
        new RNG(0),
      );
      expect(portions).toEqual([{ kind: 'bits', base: 5 }]);
    }
  });

  it('same seeds → same portions (pure + deterministic)', () => {
    const tables = lookup(table('t', [bitsE(1, 20), daemonE('mars'), daemonE('minerva')]));
    const refs = [ref('t', 0.9), ref('t'), ref('t', 0.4)];
    const a = rollRewards(refs, tables, NONE, new RNG(7), new RNG(8));
    const b = rollRewards(refs, tables, NONE, new RNG(7), new RNG(8));
    expect(a).toEqual(b);
  });

  it('throws loudly on an unknown table (boot-asserted for authored refs — a miss is corruption)', () => {
    expect(() => rollRewards([ref('ghost')], lookup(), NONE, new RNG(1), new RNG(2))).toThrow(
      /unknown reward table 'ghost'/,
    );
  });

  describe('74c — the unit / poolHealth kinds', () => {
    it('a level-absent unit entry pre-rolls a level-1 template with ZERO draws on both streams', () => {
      const tableRng = new RNG(1);
      const bitsRng = new RNG(2);
      const t0 = pos(tableRng);
      const b0 = pos(bitsRng);
      const portions = rollRewards(
        [ref('t')],
        lookup(table('t', [unitE('archer')])),
        NONE,
        tableRng,
        bitsRng,
      );
      expect(portions).toHaveLength(1);
      const p = portions[0]!;
      if (p.kind !== 'unit') throw new Error('expected unit');
      expect(p.template.archetype).toBe('archer');
      expect(p.template.level).toBe(1);
      expect(p.template.xp).toBe(0);
      // Singleton entry + level ≤ 1 rollUnit fast path: no entropy consumed
      // (the degenerate-bits-range sibling rule).
      expect(pos(tableRng)).toBe(t0);
      expect(pos(bitsRng)).toBe(b0);
    });

    it('a level>1 unit entry rolls its level-ups on the BITS stream only, deterministically', () => {
      const roll = () => {
        const tableRng = new RNG(5);
        const bitsRng = new RNG(6);
        const t0 = pos(tableRng);
        const b0 = pos(bitsRng);
        const portions = rollRewards(
          [ref('t')],
          lookup(table('t', [unitE('healer', 4)])),
          NONE,
          tableRng,
          bitsRng,
        );
        return { portions, tableMoved: pos(tableRng) !== t0, bitsMoved: pos(bitsRng) !== b0 };
      };
      const a = roll();
      const b = roll();
      expect(a.portions).toEqual(b.portions); // pure + deterministic
      const p = a.portions[0]!;
      if (p.kind !== 'unit') throw new Error('expected unit');
      expect(p.template.level).toBe(4);
      expect(a.tableMoved).toBe(false); // singleton — no sampling draw
      expect(a.bitsMoved).toBe(true); // the level-up stat rolls
    });

    it('units have NO exclusion — the same archetype drops from every ref in one roll', () => {
      const portions = rollRewards(
        [ref('t'), ref('t')],
        lookup(table('t', [unitE('mercenary')])),
        NONE,
        new RNG(1),
        new RNG(0),
      );
      expect(portions).toHaveLength(2);
      expect(portions.every((p) => p.kind === 'unit' && p.template.archetype === 'mercenary')).toBe(
        true,
      );
    });

    it('a poolHealth entry passes its amount through with zero draws', () => {
      const tableRng = new RNG(3);
      const t0 = pos(tableRng);
      const portions = rollRewards(
        [ref('t')],
        lookup(table('t', [poolE(5)])),
        NONE,
        tableRng,
        new RNG(0),
      );
      expect(portions).toEqual([{ kind: 'poolHealth', amount: 5 }]);
      expect(pos(tableRng)).toBe(t0);
    });
  });
});
