import { describe, it, expect } from 'vitest';
import { Clock } from './Clock';

describe('Clock (fixed-timestep accumulator)', () => {
  it('does not fire before one tick interval has elapsed', () => {
    let ticks = 0;
    const c = new Clock(10, () => ticks++);
    c.advance(0.05); // 50ms at 10Hz = half a tick
    expect(ticks).toBe(0);
  });

  it('fires exactly once when dt equals one tick interval', () => {
    let ticks = 0;
    const c = new Clock(10, () => ticks++);
    c.advance(0.1);
    expect(ticks).toBe(1);
  });

  it('fires N times when dt covers N tick intervals', () => {
    let ticks = 0;
    const c = new Clock(10, () => ticks++);
    c.advance(0.5);
    expect(ticks).toBe(5);
  });

  it('preserves leftover time across calls', () => {
    let ticks = 0;
    const c = new Clock(10, () => ticks++);

    c.advance(0.05); // half tick → no fire, acc = 0.05
    expect(ticks).toBe(0);

    c.advance(0.07); // total since fire = 0.12 → 1 fire, acc ≈ 0.02
    expect(ticks).toBe(1);

    c.advance(0.08); // acc reaches 0.10 → 1 more fire
    expect(ticks).toBe(2);
  });

  it('caps catchup after a long stall to avoid spiral of death', () => {
    let ticks = 0;
    const c = new Clock(10, () => ticks++);
    // 1000 seconds would be 10,000 ticks unguarded. Cap is 250.
    c.advance(1000);
    expect(ticks).toBe(250);
  });

  it('produces the same tick count for the same dt sequence (determinism)', () => {
    const dts = [0.016, 0.017, 0.015, 0.018, 0.5, 0.1, 0.1];
    let a = 0;
    let b = 0;
    const ca = new Clock(10, () => a++);
    const cb = new Clock(10, () => b++);
    for (const dt of dts) ca.advance(dt);
    for (const dt of dts) cb.advance(dt);
    expect(a).toBe(b);
  });

  it('works at non-10Hz rates', () => {
    let ticks = 0;
    const c = new Clock(60, () => ticks++); // 60Hz
    c.advance(1.0);
    expect(ticks).toBe(60);
  });
});
