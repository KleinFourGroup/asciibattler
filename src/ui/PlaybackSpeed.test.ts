import { describe, it, expect } from 'vitest';
import { PlaybackSpeed } from './PlaybackSpeed';
import type { SpeedStep } from '../config/playback';

// Mechanic test — explicit literal steps, never the shipped config (the
// balance-proof rule's converse: primitive/mechanic tests pin literals).

const STEPS: SpeedStep[] = [
  { value: 0.5, enabled: true },
  { value: 1, enabled: true },
  { value: 2, enabled: true },
  { value: 3, enabled: true },
];

describe('PlaybackSpeed', () => {
  it('starts at the home speed (1×), running', () => {
    const p = new PlaybackSpeed(STEPS);
    expect(p.current).toBe(1);
    expect(p.selectedSpeed).toBe(1);
    expect(p.isPaused).toBe(false);
    expect(p.label).toBe('1×');
  });

  it('exposes the enabled steps ascending (filtering disabled)', () => {
    const p = new PlaybackSpeed([
      { value: 3, enabled: true },
      { value: 1, enabled: true },
      { value: 2, enabled: false }, // disabled — not offered
      { value: 0.5, enabled: true },
    ]);
    expect(p.steps).toEqual([0.5, 1, 3]);
  });

  it('selects a speed by value and reflects it in current + label', () => {
    const p = new PlaybackSpeed(STEPS);
    expect(p.setSpeed(2)).toBe(true);
    expect(p.current).toBe(2);
    expect(p.selectedSpeed).toBe(2);
    expect(p.label).toBe('2×');

    expect(p.setSpeed(0.5)).toBe(true);
    expect(p.current).toBe(0.5);
    expect(p.label).toBe('0.5×');
  });

  it('ignores a disabled / unknown speed (no-op, returns false)', () => {
    const p = new PlaybackSpeed([
      { value: 1, enabled: true },
      { value: 2, enabled: false },
    ]);
    p.setSpeed(1);
    expect(p.setSpeed(2)).toBe(false); // disabled
    expect(p.setSpeed(5)).toBe(false); // unknown
    expect(p.current).toBe(1); // unchanged
  });

  it('pauses to speed 0 while keeping the selected speed', () => {
    const p = new PlaybackSpeed(STEPS);
    p.setSpeed(3);
    p.togglePause();
    expect(p.isPaused).toBe(true);
    expect(p.current).toBe(0); // sim parks
    expect(p.selectedSpeed).toBe(3); // selection survives
    expect(p.label).toBe('Paused');
  });

  it('resumes at the prior speed on unpause', () => {
    const p = new PlaybackSpeed(STEPS);
    p.setSpeed(3);
    p.togglePause(); // paused
    p.togglePause(); // resumed
    expect(p.isPaused).toBe(false);
    expect(p.current).toBe(3);
  });

  it('selecting a speed while paused resumes at that speed', () => {
    const p = new PlaybackSpeed(STEPS);
    p.pause();
    expect(p.current).toBe(0);
    p.setSpeed(2);
    expect(p.isPaused).toBe(false);
    expect(p.current).toBe(2);
  });

  it('honors a disabled pause (toggle/pause are no-ops)', () => {
    const p = new PlaybackSpeed(STEPS, /* pauseEnabled */ false);
    expect(p.pauseEnabled).toBe(false);
    p.togglePause();
    expect(p.isPaused).toBe(false);
    p.pause();
    expect(p.isPaused).toBe(false);
    expect(p.current).toBe(1);
  });

  it('resume() is always safe even with pause disabled', () => {
    const p = new PlaybackSpeed(STEPS, false);
    p.resume();
    expect(p.isPaused).toBe(false);
    expect(p.current).toBe(1);
  });
});
