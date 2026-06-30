import { describe, it, expect } from 'vitest';
import { RNG } from '../../core/RNG';
import {
  getSelectionStrategy,
  selectEncounter,
  encounterKindFor,
  assertSelectionCoverage,
  type EncounterResolver,
} from './selection';
import { SECTORS, PROCEDURAL_LAYOUT_ID, type SectorDef } from '../../config/sectors';
import { getEncounter, type Encounter, type EncounterKind } from '../../config/encounters';

/**
 * V1 — the encounter-selection resolver. Mechanic tests with hand-built fixtures
 * (a fixture sector + a fixture catalog resolver) — never the shipped JSON, per
 * the balance-proof-test policy. Both keyed strategies are exercised against the
 * same fixtures; the resolver is pure, so determinism is per-seed.
 */

// A structurally-valid Encounter; only the fields selection reads matter (id /
// kind / layouts fit-filter). The wave body is an inert placeholder.
const DUMMY_WAVES = [
  {
    kind: 'wave',
    spec: {
      levelBudget: { kind: 'fixed', value: 1 },
      count: { kind: 'fixed', value: 1 },
      units: [{ archetype: 'bandit', count: { kind: 'fixed', value: 1 }, level: { kind: 'fixed', value: 1 } }],
    },
  },
];

function enc(id: string, kind: EncounterKind, layouts?: string[]): Encounter {
  return { id, name: id, healthPool: 8, kind, layouts, waves: DUMMY_WAVES } as unknown as Encounter;
}

interface LayoutEntry {
  layoutId: string;
  minHop?: number;
  weight?: number;
}
interface EncounterEntry {
  encounterId: string;
  minHop?: number;
  weight?: number;
}

// Wb4 — the sector fight pool is per-kind. Tests still pass a flat encounter list
// for readability; this buckets each entry by its catalog kind (an unresolved id,
// e.g. 'ghost', lands in `normal` — the resolver skips it downstream), mirroring
// what the schema's kind-consistency guard would enforce on real content.
function sector(layouts: LayoutEntry[], encounters: EncounterEntry[]): SectorDef {
  const byKind: Record<EncounterKind, EncounterEntry[]> = { normal: [], elite: [], boss: [] };
  for (const e of encounters) byKind[CATALOG[e.encounterId]?.kind ?? 'normal'].push(e);
  return {
    id: 'fix',
    title: 'Fixture',
    description: 'd',
    length: 5,
    theme: 'grassland',
    layouts,
    encounters: byKind,
  } as unknown as SectorDef;
}

const CATALOG: Record<string, Encounter> = {
  a: enc('a', 'normal'),
  b: enc('b', 'normal', ['river']),
  boss1: enc('boss1', 'boss'),
  elite1: enc('elite1', 'elite'),
};
const resolve: EncounterResolver = (id) => CATALOG[id];

const battle = { hop: 0, nodeKind: 'battle' as const };

describe('encounterKindFor', () => {
  it('maps battle → normal, boss → boss (W1), elite → elite (W2)', () => {
    expect(encounterKindFor('battle')).toBe('normal');
    expect(encounterKindFor('boss')).toBe('boss');
    expect(encounterKindFor('elite')).toBe('elite');
  });
});

describe('selectEncounter — boss nodes (W1)', () => {
  const pick = getSelectionStrategy('encounterFirst');
  const bossNode = { hop: 4, nodeKind: 'boss' as const };

  it('selects only a boss-kind encounter at a boss node (normal encounters filtered out)', () => {
    const s = sector([{ layoutId: 'river' }], [{ encounterId: 'a' }, { encounterId: 'boss1' }]);
    for (let seed = 0; seed < 25; seed++) {
      expect(pick(s, bossNode, new RNG(seed), resolve).encounter.id).toBe('boss1');
    }
  });

  it('throws when the boss node has no boss encounter in the pool', () => {
    const s = sector([{ layoutId: 'river' }], [{ encounterId: 'a' }]);
    expect(() => pick(s, bossNode, new RNG(1), resolve)).toThrow(/no 'boss' encounter/);
  });
});

describe('selectEncounter — elite nodes (W2)', () => {
  const pick = getSelectionStrategy('encounterFirst');
  const eliteNode = { hop: 4, nodeKind: 'elite' as const };

  it('selects only an elite-kind encounter at an elite node (normal + boss filtered out)', () => {
    const s = sector(
      [{ layoutId: 'river' }],
      [{ encounterId: 'a' }, { encounterId: 'boss1' }, { encounterId: 'elite1' }],
    );
    for (let seed = 0; seed < 25; seed++) {
      expect(pick(s, eliteNode, new RNG(seed), resolve).encounter.id).toBe('elite1');
    }
  });

  it('throws when the elite node has no elite encounter in the pool', () => {
    const s = sector([{ layoutId: 'river' }], [{ encounterId: 'a' }, { encounterId: 'boss1' }]);
    expect(() => pick(s, eliteNode, new RNG(1), resolve)).toThrow(/no 'elite' encounter/);
  });
});

describe('selectEncounter — encounterFirst', () => {
  const pick = getSelectionStrategy('encounterFirst');

  it('selects a kind-matching encounter and a compatible layout', () => {
    const s = sector([{ layoutId: 'river' }], [{ encounterId: 'a' }]);
    const result = pick(s, battle, new RNG(1), resolve);
    expect(result.encounter.id).toBe('a');
    expect(result.layoutId).toBe('river');
  });

  it('maps the procedural sentinel to a null layout id', () => {
    const s = sector([{ layoutId: PROCEDURAL_LAYOUT_ID }], [{ encounterId: 'a' }]);
    expect(pick(s, battle, new RNG(1), resolve).layoutId).toBeNull();
  });

  it("respects the encounter's layout fit-filter (∩ the sector pool)", () => {
    // Sector offers river + labyrinth; encounter 'b' fits only river.
    const s = sector([{ layoutId: 'river' }, { layoutId: 'labyrinth' }], [{ encounterId: 'b' }]);
    for (let seed = 0; seed < 25; seed++) {
      expect(pick(s, battle, new RNG(seed), resolve).layoutId).toBe('river');
    }
  });

  it('filters out encounters of the wrong kind (a boss encounter at a battle node)', () => {
    const s = sector([{ layoutId: 'river' }], [{ encounterId: 'a' }, { encounterId: 'boss1' }]);
    for (let seed = 0; seed < 25; seed++) {
      expect(pick(s, battle, new RNG(seed), resolve).encounter.id).toBe('a');
    }
  });

  it('honours the per-entry pool weight (a 0-weight entry is never picked)', () => {
    // weight 0 bypasses the positive() schema via the cast — a test-only probe
    // proving the resolver passes entry.weight through to pickWeighted.
    const s = sector(
      [{ layoutId: 'river' }],
      [{ encounterId: 'a', weight: 1 }, { encounterId: 'b', weight: 0 }],
    );
    for (let seed = 0; seed < 30; seed++) {
      expect(pick(s, battle, new RNG(seed), resolve).encounter.id).toBe('a');
    }
  });

  it('is deterministic per seed', () => {
    const s = sector([{ layoutId: 'river' }, { layoutId: 'labyrinth' }], [{ encounterId: 'a' }]);
    const r1 = pick(s, battle, new RNG(7), resolve);
    const r2 = pick(s, battle, new RNG(7), resolve);
    expect(r1).toEqual(r2);
  });

  it('throws when no kind-matching encounter is eligible', () => {
    const s = sector([{ layoutId: 'river' }], [{ encounterId: 'boss1' }]);
    expect(() => pick(s, battle, new RNG(1), resolve)).toThrow(/no 'normal' encounter/);
  });

  it('throws when the chosen encounter has no compatible layout', () => {
    // 'b' fits only river, but the sector offers only labyrinth.
    const s = sector([{ layoutId: 'labyrinth' }], [{ encounterId: 'b' }]);
    expect(() => pick(s, battle, new RNG(1), resolve)).toThrow(/no compatible layout/);
  });

  it('skips pool entries that do not resolve (a retired catalog id)', () => {
    const s = sector([{ layoutId: 'river' }], [{ encounterId: 'ghost' }, { encounterId: 'a' }]);
    expect(pick(s, battle, new RNG(1), resolve).encounter.id).toBe('a');
  });
});

describe('selectEncounter — layoutFirst', () => {
  const pick = getSelectionStrategy('layoutFirst');

  it('rolls a layout, then a kind-matching encounter that fits it', () => {
    const s = sector([{ layoutId: 'river' }], [{ encounterId: 'a' }, { encounterId: 'b' }]);
    const result = pick(s, battle, new RNG(3), resolve);
    expect(result.layoutId).toBe('river');
    expect(['a', 'b']).toContain(result.encounter.id);
  });

  it('excludes an encounter whose fit-filter rejects the rolled layout', () => {
    // Only labyrinth in the pool; 'b' fits only river → only 'a' remains.
    const s = sector([{ layoutId: 'labyrinth' }], [{ encounterId: 'a' }, { encounterId: 'b' }]);
    for (let seed = 0; seed < 25; seed++) {
      const result = pick(s, battle, new RNG(seed), resolve);
      expect(result.layoutId).toBe('labyrinth');
      expect(result.encounter.id).toBe('a');
    }
  });

  it('throws when no encounter fits the rolled layout', () => {
    const s = sector([{ layoutId: 'labyrinth' }], [{ encounterId: 'b' }]);
    expect(() => pick(s, battle, new RNG(1), resolve)).toThrow(/fits layout/);
  });

  it('is deterministic per seed', () => {
    const s = sector([{ layoutId: 'river' }, { layoutId: 'labyrinth' }], [{ encounterId: 'a' }]);
    expect(pick(s, battle, new RNG(9), resolve)).toEqual(pick(s, battle, new RNG(9), resolve));
  });
});

describe('selectEncounter — forced (--encounter, X2)', () => {
  const battleNode = { hop: 0, nodeKind: 'battle' as const };
  const bossNode = { hop: 4, nodeKind: 'boss' as const };

  it('forces a kind-matching encounter, bypassing the sector pool + hop gate', () => {
    // The pool has NO normal encounter — normal selection would throw — yet
    // forcing 'a' (normal) at a battle node still fields it (pool bypassed), and
    // rolls a compatible layout from the sector pool.
    const s = sector([{ layoutId: 'river' }], [{ encounterId: 'boss1' }]);
    for (let seed = 0; seed < 10; seed++) {
      const r = selectEncounter(s, battleNode, new RNG(seed), resolve, 'a');
      expect(r.encounter.id).toBe('a');
      expect(r.layoutId).toBe('river');
    }
  });

  it("rolls the forced encounter's layout from the sector pool ∩ its fit-filter", () => {
    // 'b' fits only river; sector offers river + labyrinth → forced to river.
    const s = sector([{ layoutId: 'river' }, { layoutId: 'labyrinth' }], [{ encounterId: 'a' }]);
    for (let seed = 0; seed < 25; seed++) {
      expect(selectEncounter(s, battleNode, new RNG(seed), resolve, 'b').layoutId).toBe('river');
    }
  });

  it('ignores the force at a node of a different kind (per-kind aware) — normal selection runs', () => {
    const s = sector([{ layoutId: 'river' }], [{ encounterId: 'a' }, { encounterId: 'boss1' }]);
    // Forcing 'a' (normal) at a BOSS node: kind mismatch → the boss pick stands.
    for (let seed = 0; seed < 10; seed++) {
      expect(selectEncounter(s, bossNode, new RNG(seed), resolve, 'a').encounter.id).toBe('boss1');
    }
    // Forcing the boss at a battle node likewise falls back to the normal pick.
    for (let seed = 0; seed < 10; seed++) {
      expect(selectEncounter(s, battleNode, new RNG(seed), resolve, 'boss1').encounter.id).toBe('a');
    }
  });

  it('throws on an unknown forced encounter id', () => {
    const s = sector([{ layoutId: 'river' }], [{ encounterId: 'a' }]);
    expect(() => selectEncounter(s, battleNode, new RNG(1), resolve, 'ghost')).toThrow(
      /forced encounter "ghost" not found/,
    );
  });

  it('throws when the forced encounter has no compatible layout at the hop', () => {
    // 'b' fits only river; the sector offers only labyrinth.
    const s = sector([{ layoutId: 'labyrinth' }], [{ encounterId: 'a' }]);
    expect(() => selectEncounter(s, battleNode, new RNG(1), resolve, 'b')).toThrow(
      /no compatible layout/,
    );
  });
});

describe('assertSelectionCoverage', () => {
  it('passes over the shipped config (every battle node is fillable)', () => {
    expect(() => assertSelectionCoverage(SECTORS, getEncounter)).not.toThrow();
  });

  it('throws when a reachable hop has no eligible encounter', () => {
    const s = sector([{ layoutId: 'river' }], []); // empty fight pool
    expect(() => assertSelectionCoverage([s], resolve)).toThrow(/no selectable encounter/);
  });

  it('throws when the only eligible encounter has no compatible layout', () => {
    // 'b' fits only river; the sector offers only labyrinth → unfillable.
    const s = sector([{ layoutId: 'labyrinth' }], [{ encounterId: 'b' }]);
    expect(() => assertSelectionCoverage([s], resolve)).toThrow(/no selectable encounter/);
  });
});
