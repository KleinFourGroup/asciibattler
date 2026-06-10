import { describe, it, expect } from 'vitest';
import { objectiveAtCell, type EnemyAtCell } from './objective';

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
