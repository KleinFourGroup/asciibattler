import { describe, it, expect } from 'vitest';
import { hasLineOfSight } from './LineOfSight';

describe('hasLineOfSight', () => {
  it('returns true with no blockers', () => {
    expect(hasLineOfSight({ x: 0, y: 0 }, { x: 5, y: 0 }, [])).toBe(true);
  });

  it('returns true when from equals to', () => {
    expect(hasLineOfSight({ x: 3, y: 3 }, { x: 3, y: 3 }, [{ x: 3, y: 3 }])).toBe(true);
  });

  it('blocks a horizontal line with a wall in the middle', () => {
    expect(hasLineOfSight({ x: 0, y: 0 }, { x: 5, y: 0 }, [{ x: 3, y: 0 }])).toBe(false);
  });

  it('blocks a vertical line with a wall in the middle', () => {
    expect(hasLineOfSight({ x: 2, y: 0 }, { x: 2, y: 6 }, [{ x: 2, y: 3 }])).toBe(false);
  });

  it('blocks a diagonal line with a wall on the path', () => {
    // 45-degree line from (0,0) to (4,4) passes through (1,1)/(2,2)/(3,3).
    expect(hasLineOfSight({ x: 0, y: 0 }, { x: 4, y: 4 }, [{ x: 2, y: 2 }])).toBe(false);
  });

  it('passes through when wall is off the line', () => {
    expect(hasLineOfSight({ x: 0, y: 0 }, { x: 5, y: 0 }, [{ x: 3, y: 2 }])).toBe(true);
  });

  it('does not treat the destination cell as a blocker', () => {
    // Even if the target's own cell shows up in the blocker list, LOS to
    // the target shouldn't be blocked by the target.
    expect(hasLineOfSight({ x: 0, y: 0 }, { x: 3, y: 0 }, [{ x: 3, y: 0 }])).toBe(true);
  });

  it('does not treat the source cell as a blocker', () => {
    // Symmetric guard — the attacker is at `from`, and shouldn't block
    // themselves even if they ended up in the blocker list.
    expect(hasLineOfSight({ x: 0, y: 0 }, { x: 5, y: 0 }, [{ x: 0, y: 0 }])).toBe(true);
  });

  it('works in negative directions (right→left, bottom→top)', () => {
    expect(hasLineOfSight({ x: 5, y: 5 }, { x: 0, y: 0 }, [{ x: 2, y: 2 }])).toBe(false);
    expect(hasLineOfSight({ x: 5, y: 5 }, { x: 0, y: 0 }, [])).toBe(true);
  });

  it('is symmetric: blocked one way ⇒ blocked the other way', () => {
    const walls = [{ x: 3, y: 1 }];
    expect(hasLineOfSight({ x: 0, y: 0 }, { x: 6, y: 2 }, walls)).toBe(
      hasLineOfSight({ x: 6, y: 2 }, { x: 0, y: 0 }, walls),
    );
  });

  it('an adjacent target is always visible (no intermediate cells)', () => {
    // Adjacent in all 8 directions; even a packed blocker set on the
    // surrounding cells doesn't matter since the line has no interior.
    const surrounding = [
      { x: 0, y: 1 },
      { x: 1, y: 0 },
      { x: 1, y: 2 },
      { x: 2, y: 1 },
    ];
    expect(hasLineOfSight({ x: 1, y: 1 }, { x: 2, y: 2 }, surrounding)).toBe(true);
    expect(hasLineOfSight({ x: 1, y: 1 }, { x: 0, y: 0 }, surrounding)).toBe(true);
  });
});
