import { describe, expect, it } from 'vitest';
import {
  DIALS,
  DIAL_KEYS,
  barLift,
  coerceDial,
  defaultDials,
  encodeDials,
  parseDials,
  spliceBookmark,
  type DialState,
} from './state';
import { baseAnchorYFor } from '../../render/glyphs';
import census from '../../../tests/board/inkCensus.json';

describe('105b — the board explorer dial table', () => {
  it('the default state is NO bookmark, and no bookmark is the default state', () => {
    expect(encodeDials(defaultDials())).toBe('');
    expect(parseDials(null)).toEqual(defaultDials());
    expect(parseDials('')).toEqual(defaultDials());
  });

  it('every dial key is codec-safe: no pair or key/value separator inside a key', () => {
    for (const key of DIAL_KEYS) expect(key).toMatch(/^[A-Za-z][A-Za-z0-9]*$/);
  });

  it('every non-default value of every dial round-trips through the URL', () => {
    for (const key of DIAL_KEYS) {
      const spec = DIALS[key];
      const values: (string | number | boolean)[] =
        spec.kind === 'enum'
          ? spec.options.filter((o) => o !== spec.def)
          : spec.kind === 'range'
            ? [spec.min, spec.max].filter((v: number) => v !== spec.def)
            : [!spec.def];
      for (const value of values) {
        const state = { ...defaultDials(), [key]: value } as DialState;
        const encoded = encodeDials(state);
        expect(encoded, `${key}=${String(value)}`).not.toBe('');
        expect(parseDials(encoded)).toEqual(state);
        // …and what the address bar holds is what we wrote: nothing escaped.
        expect(new URLSearchParams({ bp: encoded }).toString()).toBe(`bp=${encoded}`);
      }
    }
  });

  it('a whole bookmark round-trips, in table order', () => {
    const state: DialState = {
      ...defaultDials(),
      anchor: 'bottom',
      bar: 'uniform',
      barY: 0.95,
      cue: 'outline',
      row: true,
    };
    expect(encodeDials(state)).toBe('anchor-bottom_bar-uniform_barY-0.95_cue-outline_row-1');
    expect(parseDials(encodeDials(state))).toEqual(state);
  });

  it('a stale bookmark degrades to defaults instead of throwing', () => {
    const parsed = parseDials('anchor-sideways_nope-1_bar_barY-abc_cue-filled_-x_row-yes');
    expect(parsed).toEqual({ ...defaultDials(), cue: 'filled' });
  });

  it('splicing the bookmark leaves every other pair byte-for-byte', () => {
    const typed = '?seed=7&roster=mercenary,archer&layout=river';
    expect(spliceBookmark(typed, 'cue-outline')).toBe(`${typed}&bp=cue-outline`);
    expect(spliceBookmark(`${typed}&bp=row-1`, 'cue-outline')).toBe(`${typed}&bp=cue-outline`);
    expect(spliceBookmark('?bp=row-1&seed=7', '')).toBe('?seed=7');
    expect(spliceBookmark('?bp=row-1', '')).toBe('');
    expect(spliceBookmark('', 'row-1')).toBe('?bp=row-1');
    // a param that merely STARTS with the name is someone else's
    expect(spliceBookmark('?bpm=120', '')).toBe('?bpm=120');
  });

  it('a range value is clamped to the dial and snapped to its step', () => {
    const { min, max } = DIALS.barY;
    expect(coerceDial('barY', String(max + 5))).toBe(max);
    expect(coerceDial('barY', String(min - 5))).toBe(min);
    expect(coerceDial('barY', '0.8949')).toBe(0.89);
    expect(coerceDial('barY', 'NaN')).toBeUndefined();
    expect(coerceDial('barY', '')).toBeUndefined();
  });
});

describe('105b — the bar-line rule', () => {
  // The expectation is re-derived from the DUMPED atlas census + the pure
  // anchor rule — surfaces `barLift` does not consult.
  const inkOf = (glyph: string) => {
    const [x0, y0, x1, y1] = (census.inks as Record<string, number[]>)[glyph]!;
    return { x0: x0!, y0: y0!, x1: x1!, y1: y1! };
  };
  const anchorToday = (glyph: string) =>
    baseAnchorYFor(inkOf(glyph), census.baselineY, census.descenderRoom);
  const ROW = ['g', '▄', '╥', 'M', 'a', 'r'];

  it('ink mode is the atlas answer, untouched', () => {
    expect(barLift({ bar: 'ink', barY: 0.9 }, 0.8281, -0.4375)).toBe(0.8281);
  });

  it('uniform mode puts every glyph of the posed row on ONE line, under either anchor', () => {
    const state = { bar: 'uniform', barY: DIALS.barY.def } as const;
    for (const anchorOf of [anchorToday, () => -0.5]) {
      // anchor (quad-local) + lift = the bar line in quad-local y.
      const lines = ROW.map((g) => anchorOf(g) + barLift(state, Number.NaN, anchorOf(g)));
      for (const line of lines) expect(line).toBeCloseTo(state.barY - 0.5, 10);
    }
  });

  it('the control: ink mode does NOT put the row on one line (the 79e price)', () => {
    const tops = ROW.map((g) => inkOf(g).y1);
    expect(Math.max(...tops) - Math.min(...tops)).toBeGreaterThan(0.25);
  });

  it('the default uniform line clears the tallest ink in the posed row', () => {
    for (const g of ROW) expect(DIALS.barY.def).toBeGreaterThanOrEqual(inkOf(g).y1 - 1e-9);
  });
});
