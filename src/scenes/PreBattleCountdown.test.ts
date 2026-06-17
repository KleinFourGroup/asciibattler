import { describe, it, expect } from 'vitest';
import { PreBattleCountdown } from './PreBattleCountdown';

// Mechanic test — explicit literal durations, never the shipped config.

describe('PreBattleCountdown', () => {
  it('starts active with the full duration', () => {
    const cd = new PreBattleCountdown(5);
    expect(cd.active).toBe(true);
    expect(cd.remainingSeconds).toBe(5);
    expect(cd.displaySeconds).toBe(5);
  });

  it('counts down by real dt and goes inactive at zero', () => {
    const cd = new PreBattleCountdown(1);
    cd.advance(0.4);
    expect(cd.remainingSeconds).toBeCloseTo(0.6, 5);
    expect(cd.active).toBe(true);
    cd.advance(0.6);
    expect(cd.remainingSeconds).toBe(0);
    expect(cd.active).toBe(false);
  });

  it('clamps at zero — never goes negative on overshoot', () => {
    const cd = new PreBattleCountdown(0.5);
    cd.advance(10);
    expect(cd.remainingSeconds).toBe(0);
    expect(cd.active).toBe(false);
  });

  it('displaySeconds ceils so it reads 5→1 then 0', () => {
    const cd = new PreBattleCountdown(5);
    expect(cd.displaySeconds).toBe(5); // 5.0
    cd.advance(0.5);
    expect(cd.displaySeconds).toBe(5); // 4.5
    cd.advance(0.5);
    expect(cd.displaySeconds).toBe(4); // 4.0
    cd.advance(3.5);
    expect(cd.displaySeconds).toBe(1); // 0.5
    cd.advance(0.5);
    expect(cd.displaySeconds).toBe(0); // 0.0 — battle starts
  });

  it('skip() ends the countdown immediately (Fight now)', () => {
    const cd = new PreBattleCountdown(5);
    cd.skip();
    expect(cd.active).toBe(false);
    expect(cd.remainingSeconds).toBe(0);
  });

  it('a zero-second countdown is inactive from the start (instant battle)', () => {
    const cd = new PreBattleCountdown(0);
    expect(cd.active).toBe(false);
    expect(cd.displaySeconds).toBe(0);
  });

  it('treats a negative configured duration as zero', () => {
    const cd = new PreBattleCountdown(-3);
    expect(cd.active).toBe(false);
    expect(cd.remainingSeconds).toBe(0);
  });
});
