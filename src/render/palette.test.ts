import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Palette } from './palette';

// 116f — the palette is chosen by name, once, before the modules that read
// `COLORS` load. Each test takes fresh modules (`vi.resetModules`), since the
// choice and the tables built from it are module state. The planted hexes are
// colours no palette holds, so a match can only be the planted one.

const GREEN = '#010203';
const EMBER = '#040506';
const AMBER = '#070809';

async function freshPalette(): Promise<typeof import('./palette')> {
  vi.resetModules();
  return import('./palette');
}

function planted(base: Palette): ReadonlyMap<string, Palette> {
  return new Map([['planted', { ...base, TERMINAL_GREEN: GREEN, EMBER_ORANGE: EMBER, TERMINAL_AMBER: AMBER }]]);
}

describe('116f — the palette, chosen by name', () => {
  afterEach(() => vi.resetModules());

  it('with no choice made, and for the default name, COLORS is the default palette', async () => {
    const palette = await freshPalette();
    const unchosen = palette.COLORS;
    expect(unchosen.TERMINAL_GREEN).toBe('#33FF00');
    expect(palette.choosePalette(palette.DEFAULT_PALETTE)).toBe(unchosen);
    expect(palette.COLORS).toBe(unchosen);
    expect(palette.chosenPalette()).toBe('default');
  });

  it('116g — the page knows the name it is drawn in: the chosen one, or the default for a name it has no palette for', async () => {
    const palette = await freshPalette();
    expect(palette.chosenPalette()).toBe('default');
    palette.choosePalette('planted', planted(palette.COLORS));
    expect(palette.chosenPalette()).toBe('planted');
    palette.choosePalette('colourblind-of-another-build');
    expect(palette.chosenPalette()).toBe('default');
    palette.choosePalette('colourblind');
    expect(palette.chosenPalette()).toBe('colourblind');
    expect(palette.COLORS.TERMINAL_GREEN).toBe('#46FBAE');
  });

  it("a name this build has no palette for gives the default's colours", async () => {
    const palette = await freshPalette();
    const unchosen = palette.COLORS;
    expect(palette.choosePalette('colourblind-of-another-build')).toBe(unchosen);
    expect(palette.COLORS).toBe(unchosen);
  });

  it('a chosen palette is what COLORS reads from then on, in this module and through an import', async () => {
    const palette = await freshPalette();
    palette.choosePalette('planted', planted(palette.COLORS));
    expect(palette.COLORS.TERMINAL_GREEN).toBe(GREEN);
    // Another importer's view of the binding.
    const { colorForTeam } = await import('./spriteColor');
    expect(colorForTeam('player')).toBe(GREEN);
  });

  it('a module loaded after the choice builds its tables from the chosen palette', async () => {
    const palette = await freshPalette();
    palette.choosePalette('planted', planted(palette.COLORS));
    const status = await import('./statusDisplay');
    expect(status.STATUS_DISPLAY.burn!.color).toBe(EMBER);
    expect(status.statusColor('burn')).toBe(EMBER);
    expect(status.STATUS_DISPLAY.panic!.color).toBe(AMBER);
    // A hue the planted palette left alone is the default's.
    expect(status.STATUS_DISPLAY.bleed!.color).toBe('#D41E3A');
  });

  it('the control: a module loaded before the choice keeps what it read, which is why the boot chooses first', async () => {
    const palette = await freshPalette();
    const status = await import('./statusDisplay');
    palette.choosePalette('planted', planted(palette.COLORS));
    expect(status.STATUS_DISPLAY.burn!.color).toBe('#FF6A00');
    expect(palette.COLORS.EMBER_ORANGE).toBe(EMBER);
  });
});

describe("116f — the stylesheet's tokens from a palette", () => {
  afterEach(() => vi.resetModules());

  it("a name's token is the kebab of the name", async () => {
    const { paletteToken } = await freshPalette();
    expect(paletteToken('TERMINAL_GREEN')).toBe('--color-terminal-green');
    expect(paletteToken('DARK_FLOURESCENT_BLUE')).toBe('--color-dark-flourescent-blue');
    expect(paletteToken('BOSS_RED')).toBe('--color-boss-red');
  });

  it('the default palette sets no token, so the sheet stands as written', async () => {
    const palette = await freshPalette();
    expect(palette.tokenOverrides(palette.COLORS)).toEqual([]);
  });

  it('another palette sets exactly the tokens it changes', async () => {
    const palette = await freshPalette();
    const other = planted(palette.COLORS).get('planted')!;
    expect(palette.tokenOverrides(other)).toEqual([
      ['--color-terminal-green', GREEN],
      ['--color-terminal-amber', AMBER],
      ['--color-ember-orange', EMBER],
    ]);
    // The same hex in another case is no change.
    expect(palette.tokenOverrides({ ...palette.COLORS, TERMINAL_GREEN: '#33ff00' })).toEqual([]);
  });
});
