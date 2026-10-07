import { describe, expect, it } from 'vitest';
import type { RunLock } from '../store/runLock';
import { cantSaveReason } from './cantSave';

describe("116i — why a page can't save", () => {
  const locks = ['held', 'none', 'elsewhere'] satisfies RunLock[];

  it('a store that cannot save is the reason on every screen, whatever the lock', () => {
    for (const lock of locks) {
      for (const runOnScreen of [true, false]) {
        expect(cantSaveReason(false, lock, runOnScreen), `${lock} ${runOnScreen}`).toBe('storage');
      }
    }
  });

  it("a second tab's run is unsaved while it is on screen, and only then", () => {
    expect(cantSaveReason(true, 'elsewhere', true)).toBe('elsewhere');
    // The menu, and a run's end screen: no run to lose.
    expect(cantSaveReason(true, 'elsewhere', false)).toBeNull();
  });

  it('the control: the first tab, and a page with no lock, save their runs', () => {
    for (const lock of ['held', 'none'] satisfies RunLock[]) {
      expect(cantSaveReason(true, lock, true), lock).toBeNull();
      expect(cantSaveReason(true, lock, false), lock).toBeNull();
    }
  });
});
