import { describe, it, expect } from 'vitest';
import { COLORS } from '../src/render/palette';

describe('toolchain smoke', () => {
  it('vitest runs', () => {
    expect(1 + 1).toBe(2);
  });

  it('imports from src/ resolve', () => {
    // Pulls a real value from the source tree to confirm Vite's resolver is wired up.
    expect(COLORS.TERMINAL_BLACK).toBe('#282828');
  });
});
