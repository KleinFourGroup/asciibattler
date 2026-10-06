import { describe, expect, it } from 'vitest';
import {
  MACHADO,
  NORMAL,
  VIENOT,
  VIEWS,
  distanceIn,
  hexToLinear,
  linearToHex,
  linearToOklab,
  seenAs,
  simulate,
  type Matrix3,
} from './colourVision';

// 116g — the colour-vision instrument against known answers, before any
// palette is judged by it. The hexes are literals: these are facts about the
// instrument, and a retune of the game's palette must not move them.

const MATRICES: Array<readonly [string, Matrix3]> = [
  ['Machado protan', MACHADO.protan],
  ['Machado deutan', MACHADO.deutan],
  ['Machado tritan', MACHADO.tritan],
  ['Viénot protan', VIENOT.protan],
  ['Viénot deutan', VIENOT.deutan],
];
const view = (name: string) => VIEWS.find((v) => v.name === name)!;
const PROTAN = [view('protan (Machado)'), view('protan (Viénot)')];
const DEUTAN = [view('deutan (Machado)'), view('deutan (Viénot)')];

describe('116g — the instrument: the conversions', () => {
  it('Oklab gives the published values for the primaries and for white', () => {
    const lab = (hex: string): number[] => linearToOklab(hexToLinear(hex)).map((v) => Number(v.toFixed(3)));
    expect(lab('#ff0000')).toEqual([0.628, 0.225, 0.126]);
    expect(lab('#00ff00')).toEqual([0.866, -0.234, 0.179]);
    expect(lab('#0000ff')).toEqual([0.452, -0.032, -0.312]);
    const white = linearToOklab(hexToLinear('#ffffff'));
    expect(white[0]).toBeCloseTo(1, 4);
    expect(Math.abs(white[1])).toBeLessThan(1e-4);
    expect(Math.abs(white[2])).toBeLessThan(1e-4);
  });

  it('a hex survives the trip to linear and back', () => {
    for (const hex of ['#000000', '#ffffff', '#33ff00', '#7a7066', '#010203', '#fefdfc']) {
      expect(linearToHex(hexToLinear(hex))).toBe(hex);
    }
    expect(() => hexToLinear('#fff')).toThrow();
  });
});

describe('116g — the instrument: the simulations', () => {
  it("every matrix's rows sum to one, so a grey stays the grey it was", () => {
    for (const [name, m] of MATRICES) {
      for (const row of m) expect(row[0] + row[1] + row[2], name).toBeCloseTo(1, 5);
      for (const level of [0.02, 0.2, 0.5, 1]) {
        const out = simulate([level, level, level], m);
        for (const channel of out) expect(channel, `${name} at ${level}`).toBeCloseTo(level, 5);
      }
    }
  });

  it('a Viénot result has equal red and green, whatever went in', () => {
    for (const m of [VIENOT.protan, VIENOT.deutan]) {
      for (const hex of ['#33ff00', '#ff3131', '#ffb000', '#15f4ee', '#9d00ff']) {
        const out = simulate(hexToLinear(hex), m);
        expect(out[0]).toBe(out[1]);
      }
    }
  });

  it('normal vision changes nothing', () => {
    expect(seenAs(NORMAL, '#33FF00')).toBe('#33ff00');
    expect(distanceIn(NORMAL, '#33ff00', '#33ff00')).toBe(0);
  });

  it('the two models agree on how far apart a pair is, to 0.04', () => {
    const five = ['#33ff00', '#ff3131', '#ffb000', '#7a7066', '#b5843c'];
    for (const [a, b] of [PROTAN, DEUTAN]) {
      for (let i = 0; i < five.length; i++) {
        for (let j = i + 1; j < five.length; j++) {
          const gap = Math.abs(distanceIn(a!, five[i]!, five[j]!) - distanceIn(b!, five[i]!, five[j]!));
          expect(gap, `${a!.name} against ${b!.name}, ${five[i]} / ${five[j]}`).toBeLessThan(0.04);
        }
      }
    }
  });
});

describe('116g — the instrument: pairs with known answers', () => {
  // The game's default green, amber and red, and its two stones.
  const YOURS = '#33ff00';
  const ENEMY = '#ff3131';
  const CAMP = '#ffb000';
  const STONE = '#7a7066';
  const CRACKED = '#b5843c';

  it('the pairs a red-green deficiency is known to merge come out merged', () => {
    // A yellow-green against an orange-yellow, and a red against an ochre:
    // each differs by its red-to-green balance and little else.
    for (const v of DEUTAN) {
      expect(distanceIn(v, YOURS, CAMP), v.name).toBeLessThan(0.06);
      expect(distanceIn(v, ENEMY, CRACKED), v.name).toBeLessThan(0.03);
    }
    for (const v of PROTAN) expect(distanceIn(v, ENEMY, STONE), v.name).toBeLessThan(0.08);
    // To normal vision the same three pairs are far apart.
    expect(distanceIn(NORMAL, YOURS, CAMP)).toBeGreaterThan(0.25);
    expect(distanceIn(NORMAL, ENEMY, CRACKED)).toBeGreaterThan(0.17);
    expect(distanceIn(NORMAL, ENEMY, STONE)).toBeGreaterThan(0.22);
  });

  it('pure green against pure yellow nearly vanishes for a protanope', () => {
    for (const v of PROTAN) expect(distanceIn(v, '#00ff00', '#ffff00'), v.name).toBeLessThan(0.05);
  });

  it('pairs published as safe stay apart in every view (Okabe and Ito: blue with orange, blue with yellow)', () => {
    for (const v of VIEWS) {
      expect(distanceIn(v, '#0072B2', '#E69F00'), v.name).toBeGreaterThan(0.29);
      expect(distanceIn(v, '#0072B2', '#F0E442'), v.name).toBeGreaterThan(0.38);
    }
  });

  // What step zero measured, against the cut's expectation that this pair
  // would fail: the green is much the lighter, and lightness is kept.
  it('the default green and red stay apart by lightness in every view', () => {
    for (const v of VIEWS) expect(distanceIn(v, YOURS, ENEMY), v.name).toBeGreaterThan(0.2);
  });
});
