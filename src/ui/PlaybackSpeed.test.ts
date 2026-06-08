import { describe, it, expect } from 'vitest';
import { PlaybackSpeed } from './PlaybackSpeed';

// Mechanic test — explicit literal steps, never the shipped config (the
// balance-proof rule's converse: primitive/mechanic tests pin literals).

describe('PlaybackSpeed', () => {
  it('starts at the first step', () => {
    const p = new PlaybackSpeed([1, 2, 3]);
    expect(p.current).toBe(1);
    expect(p.label).toBe('1×');
  });

  it('cycles through the steps in order and returns the new value', () => {
    const p = new PlaybackSpeed([1, 2, 3]);
    expect(p.cycle()).toBe(2);
    expect(p.current).toBe(2);
    expect(p.cycle()).toBe(3);
    expect(p.current).toBe(3);
  });

  it('wraps back to the first step after the last', () => {
    const p = new PlaybackSpeed([1, 2, 3]);
    p.cycle(); // 2
    p.cycle(); // 3
    expect(p.cycle()).toBe(1); // wrap
    expect(p.current).toBe(1);
  });

  it('honors a custom step list (e.g. a 2× ceiling)', () => {
    const p = new PlaybackSpeed([1, 2]);
    expect(p.cycle()).toBe(2);
    expect(p.cycle()).toBe(1); // wraps after two steps
  });

  it('formats the label off the current step', () => {
    const p = new PlaybackSpeed([1, 2, 3]);
    expect(p.label).toBe('1×');
    p.cycle();
    expect(p.label).toBe('2×');
  });
});
