import { describe, it, expect } from 'vitest';
import { PlaybackSpeed } from './PlaybackSpeed';
import type { SpeedStep } from '../config/playback';
import { t } from '../i18n/ui';

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
    expect(p.label).toBe(t('playback.paused')); // 100e — the table's word, not restated
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

  it('116b — select takes a starting speed and leaves pause as it is', () => {
    const p = new PlaybackSpeed(STEPS);
    expect(p.select(2)).toBe(true);
    expect(p.selectedSpeed).toBe(2);
    expect(p.current).toBe(2);
    // Paused behind the settings: the speed changes, the battle stays paused.
    p.pause();
    expect(p.select(3)).toBe(true);
    expect(p.isPaused).toBe(true);
    expect(p.current).toBe(0);
    p.resume();
    expect(p.current).toBe(3);
    // The control: setSpeed, the battle's own button, does unpause.
    p.pause();
    p.setSpeed(1);
    expect(p.isPaused).toBe(false);
  });

  it('116b — select refuses a speed that is not an enabled step', () => {
    const p = new PlaybackSpeed([{ value: 1, enabled: true }, { value: 2, enabled: false }]);
    expect(p.select(2)).toBe(false);
    expect(p.select(7)).toBe(false);
    expect(p.selectedSpeed).toBe(1);
  });

  it('116d — a hold stops the sim and leaves the pause as the player had it', () => {
    const p = new PlaybackSpeed(STEPS);
    p.setSpeed(2);
    // Held while running: stopped, and not paused.
    const release = p.hold();
    expect([p.current, p.isHeld, p.isPaused]).toEqual([0, true, false]);
    release();
    expect([p.current, p.isHeld, p.isPaused]).toEqual([2, false, false]);
    // Held while paused: still paused afterwards.
    p.pause();
    const again = p.hold();
    again();
    expect([p.current, p.isHeld, p.isPaused]).toEqual([0, false, true]);
  });

  it('116d — a hold works where pause is disabled, since it is not the pause', () => {
    const p = new PlaybackSpeed(STEPS, false);
    p.pause();
    expect(p.current).toBe(1); // the control: pause is off
    const release = p.hold();
    expect(p.current).toBe(0);
    release();
    expect(p.current).toBe(1);
  });

  it('116d — holds count, and a release called twice releases once', () => {
    const p = new PlaybackSpeed(STEPS);
    const first = p.hold();
    const second = p.hold();
    first();
    first();
    expect(p.isHeld).toBe(true);
    second();
    expect(p.isHeld).toBe(false);
    expect(p.current).toBe(1);
  });

  it('116d — a change of the selected speed tells its listeners, by either route', () => {
    const p = new PlaybackSpeed(STEPS);
    let calls = 0;
    const off = p.onSelect(() => {
      calls++;
    });
    p.select(2);
    p.setSpeed(3);
    expect(calls).toBe(2);
    p.select(3); // no change
    p.select(7); // refused
    p.togglePause(); // not a speed
    expect(calls).toBe(2);
    off();
    p.select(1);
    expect(calls).toBe(2);
  });
});
