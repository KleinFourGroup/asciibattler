import { describe, expect, it } from 'vitest';
import { hpFillColor } from './UnitOverlayLayer';

// 116f — the HP gradient's three stops were numbers in the layer's source
// (0x33ff00, 0xffb000, 0xff3131) and are palette names now. The expected
// fills below are worked from those three numbers alone, with the sRGB
// transfer function written out here, and never through the palette or
// three.js: the layer lerps in three's working space and prints the working
// values, so a stop's channel is its linear value times 255.

const linear = (channel8: number): number => {
  const c = channel8 / 255;
  return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
};
const stop = (hex: number): [number, number, number] => [
  linear((hex >> 16) & 0xff),
  linear((hex >> 8) & 0xff),
  linear(hex & 0xff),
];
const css = (a: [number, number, number], b: [number, number, number], t: number): string => {
  const mix = a.map((v, i) => Math.round((v + (b[i]! - v) * t) * 255));
  return `rgb(${mix[0]}, ${mix[1]}, ${mix[2]})`;
};

const HIGH = stop(0x33ff00);
const MID = stop(0xffb000);
const LOW = stop(0xff3131);

describe('116f — the HP gradient keeps its three stops', () => {
  it('full, half and empty are the three stops', () => {
    expect(hpFillColor(1)).toBe(css(HIGH, HIGH, 0));
    expect(hpFillColor(0.5)).toBe(css(MID, MID, 0));
    expect(hpFillColor(0)).toBe(css(LOW, LOW, 0));
    // Written out once, so the helper above is checked against a number too.
    expect(hpFillColor(1)).toBe('rgb(8, 255, 0)');
  });

  it('between the stops it is their mix, and outside the range it holds the end', () => {
    expect(hpFillColor(0.75)).toBe(css(MID, HIGH, 0.5));
    expect(hpFillColor(0.25)).toBe(css(LOW, MID, 0.5));
    expect(hpFillColor(0.9)).toBe(css(MID, HIGH, 0.8));
    expect(hpFillColor(1.5)).toBe(hpFillColor(1));
    expect(hpFillColor(-1)).toBe(hpFillColor(0));
  });

  it('the three stops are three colours (the control for a swapped pair)', () => {
    expect(new Set([hpFillColor(1), hpFillColor(0.5), hpFillColor(0)]).size).toBe(3);
  });

  // A stop one step of one channel off prints the same fill at most points
  // (0x30 and 0x31 both round to 8 in working space), so the stops are held
  // by every thousandth of the range: a neighbouring hex crosses a rounding
  // boundary at a different fraction somewhere along it.
  it('a thousand fractions each print the mix of the three stops', () => {
    const wrong: string[] = [];
    for (let i = 0; i <= 1000; i++) {
      const p = i / 1000;
      const want = p >= 0.5 ? css(MID, HIGH, (p - 0.5) * 2) : css(LOW, MID, p * 2);
      const got = hpFillColor(p);
      if (got !== want) wrong.push(`${p}: ${got}, expected ${want}`);
    }
    expect(wrong).toEqual([]);
  });
});
