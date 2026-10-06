/**
 * 116g — THE COLOUR-VISION INSTRUMENT: what a colour looks like to an eye
 * missing one cone type, and how far apart two colours are. Test support
 * only (tests/palette-colourblind.test.ts); nothing in `src` imports it.
 *
 * SIMULATION. A dichromat's view of a colour is a 3×3 matrix applied to its
 * LINEAR sRGB, then clamped to what a screen can show. Two published models
 * are held here, so that a verdict does not rest on one:
 *   - Machado, Oliveira and Fernandes 2009, at severity 1.0, for protanopia,
 *     deuteranopia and tritanopia;
 *   - Viénot, Brettel and Mollon 1999, for protanopia and deuteranopia (the
 *     paper's method gives no tritanopia matrix).
 * A dichromat is the limiting case. The commoner anomalous trichromat (a
 * shifted cone, not a missing one) sees between normal and this.
 *
 * DISTANCE. The Euclidean distance in Oklab (Ottosson 2020) between the two
 * colours: about 0.02 is a just-noticeable difference between patches side
 * by side, and the unit is a share of the black-to-white range.
 *
 * colourVision.test.ts holds each piece against a known answer: a grey stays
 * the grey it was under every matrix, Oklab's published values for the three
 * primaries, and a Viénot result has equal red and green by construction.
 */

export type Rgb = readonly [r: number, g: number, b: number];
export type Matrix3 = readonly [Rgb, Rgb, Rgb];

export const DEFICIENCIES = ['protan', 'deutan', 'tritan'] as const;
export type Deficiency = (typeof DEFICIENCIES)[number];

/** Machado et al. 2009, severity 1.0. Rows give R′, G′, B′ from linear R, G, B. */
export const MACHADO: Readonly<Record<Deficiency, Matrix3>> = {
  protan: [
    [0.152286, 1.052583, -0.204868],
    [0.114503, 0.786281, 0.099216],
    [-0.003882, -0.048116, 1.051998],
  ],
  deutan: [
    [0.367322, 0.860646, -0.227968],
    [0.280085, 0.672501, 0.047413],
    [-0.01182, 0.04294, 0.968881],
  ],
  tritan: [
    [1.255528, -0.076749, -0.178779],
    [-0.078411, 0.930809, 0.147602],
    [0.004733, 0.691367, 0.3039],
  ],
};

/** Viénot et al. 1999, in linear sRGB. */
export const VIENOT: Readonly<Record<'protan' | 'deutan', Matrix3>> = {
  protan: [
    [0.11238, 0.88762, 0],
    [0.11238, 0.88762, 0],
    [0.00401, -0.00401, 1],
  ],
  deutan: [
    [0.29275, 0.70725, 0],
    [0.29275, 0.70725, 0],
    [-0.02234, 0.02234, 1],
  ],
};

/** `#rrggbb` → the three channels, 0 to 1, as sRGB encodes them. */
export function hexToSrgb(hex: string): Rgb {
  const m = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex);
  if (m === null) throw new Error(`colourVision: '${hex}' is not a #rrggbb hex`);
  return [parseInt(m[1]!, 16) / 255, parseInt(m[2]!, 16) / 255, parseInt(m[3]!, 16) / 255];
}

/** The sRGB transfer function, encoded → linear, for one channel. */
export function toLinear(c: number): number {
  return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}

/** Linear → encoded, for one channel. */
export function toEncoded(c: number): number {
  return c <= 0.0031308 ? c * 12.92 : 1.055 * c ** (1 / 2.4) - 0.055;
}

export function hexToLinear(hex: string): Rgb {
  const [r, g, b] = hexToSrgb(hex);
  return [toLinear(r), toLinear(g), toLinear(b)];
}

export function linearToHex(rgb: Rgb): string {
  const part = (c: number): string =>
    Math.round(toEncoded(Math.min(1, Math.max(0, c))) * 255)
      .toString(16)
      .padStart(2, '0');
  return `#${part(rgb[0])}${part(rgb[1])}${part(rgb[2])}`;
}

const clamp01 = (c: number): number => Math.min(1, Math.max(0, c));

/** A linear colour through a simulation matrix, clamped to the screen's range. */
export function simulate(linear: Rgb, matrix: Matrix3): Rgb {
  const row = (m: Rgb): number => clamp01(m[0] * linear[0] + m[1] * linear[1] + m[2] * linear[2]);
  return [row(matrix[0]), row(matrix[1]), row(matrix[2])];
}

/** Linear sRGB → Oklab `[L, a, b]`. */
export function linearToOklab(rgb: Rgb): Rgb {
  const l = Math.cbrt(0.4122214708 * rgb[0] + 0.5363325363 * rgb[1] + 0.0514459929 * rgb[2]);
  const m = Math.cbrt(0.2119034982 * rgb[0] + 0.6806995451 * rgb[1] + 0.1073969566 * rgb[2]);
  const s = Math.cbrt(0.0883024619 * rgb[0] + 0.2817188376 * rgb[1] + 0.6299787005 * rgb[2]);
  return [
    0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
    1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
    0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
  ];
}

/** The Oklab distance between two linear colours. */
export function oklabDistance(a: Rgb, b: Rgb): number {
  const p = linearToOklab(a);
  const q = linearToOklab(b);
  return Math.hypot(p[0] - q[0], p[1] - q[1], p[2] - q[2]);
}

/** A way of seeing: normal vision, or one model's simulation of one deficiency. */
export interface View {
  readonly name: string;
  readonly matrix: Matrix3 | null;
}

export const NORMAL: View = { name: 'normal', matrix: null };

/** Every simulated view the instrument holds, the two models side by side. */
export const VIEWS: readonly View[] = [
  { name: 'protan (Machado)', matrix: MACHADO.protan },
  { name: 'protan (Viénot)', matrix: VIENOT.protan },
  { name: 'deutan (Machado)', matrix: MACHADO.deutan },
  { name: 'deutan (Viénot)', matrix: VIENOT.deutan },
  { name: 'tritan (Machado)', matrix: MACHADO.tritan },
];

/** How far apart two hexes are in a view. */
export function distanceIn(view: View, hexA: string, hexB: string): number {
  const see = (hex: string): Rgb => (view.matrix === null ? hexToLinear(hex) : simulate(hexToLinear(hex), view.matrix));
  return oklabDistance(see(hexA), see(hexB));
}

/** What a hex looks like in a view, as a hex. */
export function seenAs(view: View, hex: string): string {
  return view.matrix === null ? hex.toLowerCase() : linearToHex(simulate(hexToLinear(hex), view.matrix));
}
