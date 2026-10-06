/**
 * 116g — THE COLOURBLIND PALETTE'S GATE (Round 8 spec D7; WORKLOG §116g).
 *
 * The board tells five kinds of body apart by hue: yours, the enemy's, a
 * camp's, stone, and cracked stone (src/render/spriteColor.ts). In the
 * `colourblind` palette no two of those hues may be closer than THE BAR,
 * 0.130 in Oklab, to normal vision or under any simulation the instrument
 * holds (tests/colourVision.ts: protanopia and deuteranopia on two published
 * models, tritanopia on one). The bar is the default palette's own closest
 * such pair to normal vision, so the gate reads: nobody sees two identities
 * closer together than a player with normal vision already sees the two
 * closest.
 *
 * WHAT IS MEASURED. The five hexes are read through the sprite's own colour
 * rule with the palette chosen, not from a list of names kept here. Each is
 * measured twice: as the palette spells it, and as the canvas draws it. The
 * main composer's first pass raises a fragment's saturation to a floor
 * (src/render/shaders/palette-sat-clamped.frag.glsl), which moves a near-grey
 * like stone; `asDrawn` is that rule, with the floor read from PostProcess.ts
 * and the result checked once against pixels sampled in the Browser pane
 * (`#7A7066` is drawn `#7a6d60`).
 *
 * THE CONTROL is built in: the default palette goes through the same check
 * and must fail it on exactly the four pairs measured at 116g's first stop.
 * A gate that passed the default would be measuring nothing.
 *
 * NOT GATED: the status and empower hues, and the cyan. They were re-picked
 * for this palette and reported (WORKLOG §116g); a status's guarantee is its
 * symbol and its name.
 */

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { PALETTE_CHOICES } from '../src/settings/settings';
import { NORMAL, VIEWS, distanceIn, hexToLinear, linearToHex, type Rgb, type View } from './colourVision';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

/** The bar: no two identity hues closer than this, in any view. */
const BAR = 0.13;

const EVERY_VIEW: readonly View[] = [NORMAL, ...VIEWS];

/** The five bodies the board tells apart by hue, as the sprite rule sees them. */
const BODIES = [
  ['yours', { team: 'player', archetype: 'mercenary', campId: null }],
  ['enemy', { team: 'enemy', archetype: 'mercenary', campId: null }],
  ['camp', { team: 'neutral', archetype: 'bandit', campId: 1 }],
  ['stone', { team: 'neutral', archetype: 'wall', campId: null }],
  ['cracked', { team: 'neutral', archetype: 'wall_destructible', campId: null }],
] as const;

type Five = ReadonlyArray<readonly [name: string, hex: string]>;

/** The five identity hexes with `name`'s palette chosen, through the sprite's
 *  colour rule. Fresh modules: the choice is module state. */
async function identityHues(name: string): Promise<Five> {
  vi.resetModules();
  const palette = await import('../src/render/palette');
  if (!palette.PALETTES.has(name)) throw new Error(`no palette named '${name}'`);
  palette.choosePalette(name);
  const { spriteColorForUnit } = await import('../src/render/spriteColor');
  return BODIES.map(([body, unit]) => [body, spriteColorForUnit(unit)] as const);
}

/** The saturation floor the canvas's first pass holds, read from its source. */
function satFloor(): number {
  const source = readFileSync(join(ROOT, 'src/render/PostProcess.ts'), 'utf8');
  const m = /uSatMin:\s*\{\s*value:\s*([0-9.]+)\s*\}/.exec(source);
  if (m === null) throw new Error('PostProcess.ts: no uSatMin uniform; the clamp this gate models has moved');
  return Number(m[1]);
}

/** A hex as the canvas draws it: the shader's rule, on linear values. Black
 *  and a pure grey are left alone; below the floor the hue and the greatest
 *  channel are kept and the others pulled down. */
function asDrawn(hex: string, floor: number): string {
  const rgb = hexToLinear(hex);
  const top = Math.max(...rgb);
  const low = Math.min(...rgb);
  if (top === 0 || top === low) return hex.toLowerCase();
  if ((top - low) / top >= floor) return hex.toLowerCase();
  const newLow = top * (1 - floor);
  return linearToHex(rgb.map((c) => newLow + ((c - low) / (top - low)) * (top - newLow)) as unknown as Rgb);
}

interface Miss {
  readonly pair: string;
  readonly view: string;
  readonly distance: number;
}

/** Every pair of the five that is under the bar in some view. */
function misses(five: Five): Miss[] {
  const out: Miss[] = [];
  for (let i = 0; i < five.length; i++) {
    for (let j = i + 1; j < five.length; j++) {
      for (const view of EVERY_VIEW) {
        const distance = distanceIn(view, five[i]![1], five[j]![1]);
        if (distance < BAR) out.push({ pair: `${five[i]![0]} / ${five[j]![0]}`, view: view.name, distance });
      }
    }
  }
  return out;
}

const say = (list: Miss[]): string => list.map((m) => `${m.pair} is ${m.distance.toFixed(3)} in ${m.view}`).join('\n');

describe('116g — the colourblind palette: the identity gate', () => {
  afterEach(() => vi.resetModules());

  it('the sprite rule gives five different hues, and they are the five names the palette moved or kept for it', async () => {
    const five = await identityHues('colourblind');
    expect(new Set(five.map(([, hex]) => hex.toLowerCase())).size).toBe(5);
    const { PALETTES } = await import('../src/render/palette');
    const cb = PALETTES.get('colourblind')!;
    expect(five.map(([, hex]) => hex)).toEqual([
      cb.TERMINAL_GREEN,
      cb.NEON_RED,
      cb.TERMINAL_AMBER,
      cb.TERMINAL_STONE,
      cb.CRACKED_STONE,
    ]);
  });

  it('no two identity hues are under 0.130 apart, to normal vision or in any simulation', async () => {
    const five = await identityHues('colourblind');
    const found = misses(five);
    expect(found, `under the bar:\n${say(found)}`).toEqual([]);
  });

  it('the same holds for the five as the canvas draws them', async () => {
    const floor = satFloor();
    const five = (await identityHues('colourblind')).map(([name, hex]) => [name, asDrawn(hex, floor)] as const);
    const found = misses(five);
    expect(found, `under the bar as drawn:\n${say(found)}`).toEqual([]);
  });

  it('the control: the default palette fails the same check, on the four pairs that merge', async () => {
    const found = misses(await identityHues('default'));
    expect([...new Set(found.map((m) => m.pair))].sort()).toEqual([
      'enemy / cracked',
      'enemy / stone',
      'stone / cracked',
      'yours / camp',
    ]);
    // None of them fails to normal vision: the default is a good palette for
    // the eye it was drawn with.
    expect(found.filter((m) => m.view === NORMAL.name)).toEqual([]);
    // The worst of them, as first measured: the enemy's red against cracked
    // stone, and yours against the camp's amber, for a deuteranope.
    const worst = (pair: string): number => Math.min(...found.filter((m) => m.pair === pair).map((m) => m.distance));
    expect(worst('enemy / cracked')).toBeCloseTo(0.024, 3);
    expect(worst('yours / camp')).toBeCloseTo(0.05, 3);
  });

  it("the bar is the default palette's own closest identity pair to normal vision", async () => {
    const five = await identityHues('default');
    let closest = Infinity;
    for (let i = 0; i < five.length; i++) {
      for (let j = i + 1; j < five.length; j++) closest = Math.min(closest, distanceIn(NORMAL, five[i]![1], five[j]![1]));
    }
    expect(closest).toBeGreaterThanOrEqual(BAR);
    expect(closest - BAR).toBeLessThan(0.001);
  });
});

describe('116g — the canvas rule the gate measures through', () => {
  it('reads the floor from the pass that holds it', () => {
    expect(satFloor()).toBe(0.4);
  });

  it('leaves a saturated colour, a grey and black alone', () => {
    for (const hex of ['#33ff00', '#f942b2', '#ffb000', '#b5843c', '#808080', '#000000']) {
      expect(asDrawn(hex, 0.4), hex).toBe(hex);
    }
  });

  it("draws the default stone as the pane's pixels showed it, and raises a near-grey exactly to the floor", () => {
    // Sampled from the canvas at 116g: an inert rubble's ink, bloom off.
    expect(asDrawn('#7A7066', 0.4)).toBe('#7a6d60');
    const rgb = hexToLinear('#71675D');
    const top = Math.max(...rgb);
    const drawn = hexToLinear(asDrawn('#71675D', 0.4));
    // The greatest channel is kept, to the hex's rounding, and the saturation is the floor's.
    expect(Math.max(...drawn)).toBeCloseTo(top, 2);
    expect((Math.max(...drawn) - Math.min(...drawn)) / Math.max(...drawn)).toBeCloseTo(0.4, 1);
  });
});

describe('116g — the palettes and the setting that names them', () => {
  afterEach(() => vi.resetModules());

  it("the Palette setting's choices are the palettes this build has, name for name", async () => {
    const { PALETTES } = await import('../src/render/palette');
    expect([...PALETTES.keys()].sort()).toEqual([...PALETTE_CHOICES].sort());
  });

  it('every palette spells every name as a #rrggbb hex', async () => {
    const { PALETTES } = await import('../src/render/palette');
    const names = Object.keys(PALETTES.get('default')!).sort();
    expect(names.length).toBe(30);
    for (const [name, palette] of PALETTES) {
      expect(Object.keys(palette).sort(), name).toEqual(names);
      for (const hex of Object.values(palette)) expect(() => hexToLinear(hex), `${name}: ${hex}`).not.toThrow();
    }
  });

  it('the colourblind palette moves eighteen names and leaves the camp amber and cracked stone where they were', async () => {
    const { PALETTES, tokenOverrides } = await import('../src/render/palette');
    const cb = PALETTES.get('colourblind')!;
    const def = PALETTES.get('default')!;
    expect(tokenOverrides(cb).length).toBe(18);
    expect(cb.TERMINAL_AMBER).toBe(def.TERMINAL_AMBER);
    expect(cb.CRACKED_STONE).toBe(def.CRACKED_STONE);
  });
});
