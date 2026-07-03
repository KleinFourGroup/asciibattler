import { describe, it, expect } from 'vitest';
import { objectiveAtCell, type EnemyAtCell, type NeutralAtCell } from './objective';

// Mechanic test — explicit literal cells/units (the pure resolver has no config
// dependency). Both J3 input paths (right-click + armed left-click) funnel
// through objectiveAtCell, so this pins the enemy-vs-tile decision once.

describe('objectiveAtCell', () => {
  const enemies: EnemyAtCell[] = [
    { id: 7, cell: { x: 3, y: 4 } },
    { id: 9, cell: { x: 10, y: 1 } },
  ];

  it('resolves to an enemy objective when a living enemy occupies the cell', () => {
    expect(objectiveAtCell({ x: 3, y: 4 }, enemies)).toEqual({ kind: 'enemy', unitId: 7 });
    expect(objectiveAtCell({ x: 10, y: 1 }, enemies)).toEqual({ kind: 'enemy', unitId: 9 });
  });

  it('resolves to a tile objective when no enemy is on the cell', () => {
    expect(objectiveAtCell({ x: 5, y: 5 }, enemies)).toEqual({
      kind: 'tile',
      cell: { x: 5, y: 5 },
    });
  });

  it('matches on full coordinate, not just one axis', () => {
    // Shares x with enemy 7 but a different y — must be a tile, not enemy 7.
    expect(objectiveAtCell({ x: 3, y: 9 }, enemies)).toEqual({
      kind: 'tile',
      cell: { x: 3, y: 9 },
    });
    // Shares y with enemy 7 but a different x.
    expect(objectiveAtCell({ x: 8, y: 4 }, enemies)).toEqual({
      kind: 'tile',
      cell: { x: 8, y: 4 },
    });
  });

  it('rallies to the cell when the enemy list is empty', () => {
    expect(objectiveAtCell({ x: 3, y: 4 }, [])).toEqual({ kind: 'tile', cell: { x: 3, y: 4 } });
  });
});

// §40e — a DESTRUCTIBLE neutral (rubble / a destructible wall) is manually
// clickable: the resolver admits a neutral target when the click lands on any of
// its footprint cells, ranked after enemies and before the bare-tile fallback.
describe('objectiveAtCell — destructible neutrals (§40e)', () => {
  const enemies: EnemyAtCell[] = [{ id: 7, cell: { x: 3, y: 4 } }];
  // A 1×1 rubble at (6,6) and a 2×2 rubble anchored at (10,10) (cells
  // 10,10 / 11,10 / 10,11 / 11,11 — the §39 N×N block).
  const neutrals: NeutralAtCell[] = [
    { id: 20, cells: [{ x: 6, y: 6 }] },
    {
      id: 21,
      cells: [
        { x: 10, y: 10 },
        { x: 11, y: 10 },
        { x: 10, y: 11 },
        { x: 11, y: 11 },
      ],
    },
  ];

  it('resolves to a neutral objective when a destructible neutral occupies the cell', () => {
    expect(objectiveAtCell({ x: 6, y: 6 }, enemies, neutrals)).toEqual({
      kind: 'neutral',
      unitId: 20,
    });
  });

  it('targets a multi-tile rubble from ANY of its footprint cells', () => {
    for (const c of neutrals[1]!.cells) {
      expect(objectiveAtCell(c, enemies, neutrals)).toEqual({ kind: 'neutral', unitId: 21 });
    }
  });

  it('ranks a hostile in front of rubble ABOVE the rubble (enemy wins)', () => {
    // An enemy sharing a cell with a neutral resolves to the enemy — you attack
    // the unit, not the debris behind it.
    const overlap: NeutralAtCell[] = [{ id: 22, cells: [{ x: 3, y: 4 }] }];
    expect(objectiveAtCell({ x: 3, y: 4 }, enemies, overlap)).toEqual({
      kind: 'enemy',
      unitId: 7,
    });
  });

  it('falls through to a tile when the cell holds no enemy and no destructible neutral', () => {
    // An INDESTRUCTIBLE wall is simply absent from `neutrals` (the caller filters
    // by isDestructibleNeutral), so clicking it rallies to the tile.
    expect(objectiveAtCell({ x: 0, y: 0 }, enemies, neutrals)).toEqual({
      kind: 'tile',
      cell: { x: 0, y: 0 },
    });
  });

  it('is backward-compatible — omitting `neutrals` never yields a neutral target', () => {
    expect(objectiveAtCell({ x: 6, y: 6 }, enemies)).toEqual({ kind: 'tile', cell: { x: 6, y: 6 } });
  });
});
