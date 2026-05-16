import { describe, it, expect } from 'vitest';
import { TICK_RATE, secondsToTicks, ticksToSeconds } from './config';

describe('config: seconds <-> ticks conversion', () => {
  it('at 10Hz, 1 second is 10 ticks', () => {
    expect(TICK_RATE).toBe(10);
    expect(secondsToTicks(1)).toBe(10);
  });

  it('rounds to nearest tick', () => {
    expect(secondsToTicks(0.05)).toBe(1); // 0.5 -> 1
    expect(secondsToTicks(0.04)).toBe(0); // 0.4 -> 0
    expect(secondsToTicks(0.5)).toBe(5);
  });

  it('ticksToSeconds is the inverse for tick-aligned values', () => {
    for (const s of [0.1, 0.5, 1.0, 2.3, 5.0]) {
      const ticks = secondsToTicks(s);
      expect(ticksToSeconds(ticks)).toBeCloseTo(s, 10);
    }
  });

  it('handles zero', () => {
    expect(secondsToTicks(0)).toBe(0);
    expect(ticksToSeconds(0)).toBe(0);
  });
});
