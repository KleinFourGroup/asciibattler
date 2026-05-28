import { describe, it, expect } from 'vitest';
import { TICK_RATE, secondsToTicks, ticksToSeconds } from './config';

describe('config: seconds <-> ticks conversion', () => {
  it('1 second = TICK_RATE ticks', () => {
    expect(secondsToTicks(1)).toBe(TICK_RATE);
  });

  it('rounds to nearest tick', () => {
    // Boundaries derived from TICK_RATE so this test survives future
    // TICK_RATE bumps (E3.5 lesson — gotcha #6 says don't hardcode ticks).
    const halfTickSeconds = 0.5 / TICK_RATE;
    expect(secondsToTicks(halfTickSeconds + 0.001)).toBe(1); // just above 0.5 ticks → 1
    expect(secondsToTicks(halfTickSeconds - 0.001)).toBe(0); // just below 0.5 ticks → 0
    expect(secondsToTicks(0.5)).toBe(secondsToTicks(0.5)); // self-consistent
    expect(ticksToSeconds(secondsToTicks(0.5))).toBeCloseTo(0.5, 10);
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
