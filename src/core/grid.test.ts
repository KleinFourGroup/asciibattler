import { describe, it, expect } from 'vitest';
import { distanceBetween } from './grid';

describe('distanceBetween — the chebyshev distance seam', () => {
  it('is the 8-connected (Chebyshev) distance', () => {
    expect(distanceBetween({ x: 0, y: 0 }, { x: 0, y: 0 })).toBe(0);
    expect(distanceBetween({ x: 0, y: 0 }, { x: 3, y: 0 })).toBe(3);
    expect(distanceBetween({ x: 0, y: 0 }, { x: 0, y: 5 })).toBe(5);
    expect(distanceBetween({ x: 0, y: 0 }, { x: 4, y: 4 })).toBe(4); // diagonal = 1 step each
    expect(distanceBetween({ x: 1, y: 2 }, { x: 4, y: 8 })).toBe(6); // max(3, 6)
    expect(distanceBetween({ x: 5, y: 5 }, { x: 2, y: 4 })).toBe(3); // order-independent
  });
});
