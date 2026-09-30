import { describe, expect, it } from 'vitest';
import type { Game } from '../../Game';
import { PROBE_BOOTSTRAP } from './bootstrap';
import { installProbe } from './index';
import { canvasProblem, glReadRect, missingPairs, normalizeQuery, summarizePixels } from './page';

describe('canvasProblem (the check on every read)', () => {
  const live = { viewport: [1280, 720], client: [1280, 720], buffer: [1280, 720], dpr: 1 } as const;

  it('passes a sized canvas whose buffer matches its box', () => {
    expect(canvasProblem(live)).toBeNull();
    expect(canvasProblem({ ...live, buffer: [1920, 1080], dpr: 1.5 })).toBeNull();
  });

  it('names a zero-sized page or canvas (a hidden pane)', () => {
    expect(canvasProblem({ ...live, viewport: [0, 0] })).toBe('viewport');
    expect(canvasProblem({ ...live, client: [1280, 0] })).toBe('viewport');
  });

  it('names a canvas box that is not the page (its stylesheet failed to load)', () => {
    // Seen in the pane: ui.css failed, and the canvas kept the HTML default.
    expect(canvasProblem({ ...live, client: [300, 150], buffer: [300, 150] })).toBe('layout');
    // A rounding pixel between the box and the page is not a layout fault.
    expect(canvasProblem({ ...live, client: [1279, 720], buffer: [1279, 720] })).toBeNull();
  });

  it('names a buffer a resize never reached', () => {
    // The HTML default before the Renderer sizes it.
    expect(canvasProblem({ ...live, buffer: [300, 150] })).toBe('buffer');
    expect(canvasProblem({ ...live, dpr: 2 })).toBe('buffer');
  });
});

describe('missingPairs (go() checks the URL it asked for)', () => {
  it('is empty when every asked pair is there, in any order, among others', () => {
    expect(missingPairs('?seed=7&character=soldier&bp=hide-1', 'character=soldier&seed=7')).toEqual([]);
  });

  it('names each pair that is missing or has another value', () => {
    expect(missingPairs('', 'seed=7&character=soldier')).toEqual(['seed=7', 'character=soldier']);
    expect(missingPairs('?seed=8&character=soldier', '?seed=7&character=soldier')).toEqual(['seed=7']);
  });

  it('checks a bare key as a key', () => {
    expect(missingPairs('?spike-deny', 'spike-deny')).toEqual([]);
    expect(missingPairs('?other', 'spike-deny')).toEqual(['spike-deny']);
  });

  it('takes a query with or without its ?', () => {
    expect(normalizeQuery('?a=1')).toBe('a=1');
    expect(normalizeQuery('a=1')).toBe('a=1');
  });
});

describe('glReadRect (a page rect as gl.readPixels takes it)', () => {
  it('counts rows up from the buffer bottom', () => {
    // A 10×4 crop at the page's top-left of a 100×50 canvas is GL rows 46-49.
    expect(glReadRect({ x: 0, y: 0, w: 10, h: 4 }, 1, [100, 50])).toEqual({ x: 0, y: 46, w: 10, h: 4 });
    // At the bottom edge it starts at GL row 0.
    expect(glReadRect({ x: 5, y: 46, w: 3, h: 4 }, 1, [100, 50])).toEqual({ x: 5, y: 0, w: 3, h: 4 });
  });

  it('scales by the pixel ratio', () => {
    expect(glReadRect({ x: 10, y: 10, w: 4, h: 2 }, 2, [200, 100])).toEqual({ x: 20, y: 76, w: 8, h: 4 });
  });

  it('refuses an empty rect or one that leaves the canvas, rather than clip it', () => {
    expect(() => glReadRect({ x: 0, y: 0, w: 0, h: 4 }, 1, [100, 50])).toThrow(/empty/);
    expect(() => glReadRect({ x: 95, y: 0, w: 10, h: 4 }, 1, [100, 50])).toThrow(/leaves the 100x50 canvas/);
    expect(() => glReadRect({ x: 0, y: -1, w: 10, h: 4 }, 1, [100, 50])).toThrow(/leaves/);
  });
});

describe('summarizePixels (a readPixels result, top row first)', () => {
  // 2×2, GL order (bottom row first): bottom = red, green; top = blue, white.
  const bottomUp = new Uint8Array([255, 0, 0, 255, 0, 255, 0, 255, 0, 0, 255, 255, 255, 255, 255, 255]);

  it('lists rows top first, as the page shows them', () => {
    expect(summarizePixels(bottomUp, 2, 2).rows).toEqual([
      ['#0000ff', '#ffffff'],
      ['#ff0000', '#00ff00'],
    ]);
  });

  it('gives the mean, the distinct count and opacity', () => {
    const s = summarizePixels(bottomUp, 2, 2);
    expect(s.mean).toEqual([128, 128, 128]);
    expect(s.distinct).toBe(4);
    expect(s.translucent).toBe(false);
    expect(summarizePixels(new Uint8Array([1, 2, 3, 200]), 1, 1).translucent).toBe(true);
  });

  it('hashes equal crops equally and a one-byte change differently', () => {
    const changed = bottomUp.slice();
    changed[0] = 254;
    expect(summarizePixels(bottomUp.slice(), 2, 2).hash).toBe(summarizePixels(bottomUp, 2, 2).hash);
    expect(summarizePixels(changed, 2, 2).hash).not.toBe(summarizePixels(bottomUp, 2, 2).hash);
  });

  it('leaves the rows out above the cap', () => {
    expect(summarizePixels(new Uint8Array(17 * 16 * 4), 17, 16).rows).toBeNull();
    expect(summarizePixels(new Uint8Array(16 * 16 * 4), 16, 16).rows).toHaveLength(16);
  });
});

describe('the bootstrap stand-in (the exact text the dev server injects)', () => {
  type Stub = { live: boolean; ready: (opts?: { timeoutMs?: number }) => Promise<unknown> };
  const load = (win: { __probe?: unknown }): void => {
    new Function('window', PROBE_BOOTSTRAP)(win);
  };

  it('installs a stand-in that is not live', () => {
    const win: { __probe?: Stub } = {};
    load(win);
    expect(win.__probe?.live).toBe(false);
  });

  it('leaves a kit that is already installed alone', () => {
    const kit = { live: true };
    const win: { __probe?: unknown } = { __probe: kit };
    load(win);
    expect(win.__probe).toBe(kit);
  });

  it('hands the wait to the real kit when it arrives, with the time left', async () => {
    const win: { __probe?: unknown } = {};
    load(win);
    const stub = win.__probe as Stub;
    const seen: { timeoutMs?: number }[] = [];
    const waiting = stub.ready({ timeoutMs: 5000 });
    setTimeout(() => {
      win.__probe = {
        live: true,
        ready: (opts: { timeoutMs?: number }) => {
          seen.push(opts);
          return Promise.resolve('the real report');
        },
      };
    }, 150);
    await expect(waiting).resolves.toBe('the real report');
    expect(seen).toHaveLength(1);
    expect(seen[0]!.timeoutMs).toBeGreaterThan(4000);
    expect(seen[0]!.timeoutMs).toBeLessThanOrEqual(5000);
  });

  it('rejects by name when the modules never arrive', async () => {
    const win: { __probe?: unknown } = {};
    load(win);
    await expect((win.__probe as Stub).ready({ timeoutMs: 250 })).rejects.toThrow(
      /__probe\.ready: not live after 0 s\. The page modules have not loaded/,
    );
  });

  it('refuses every other kit call by name, and knows exactly the kit’s calls', () => {
    const win: Record<string, unknown> = {};
    load(win);
    const stub = win.__probe as Record<string, unknown>;
    // The real kit's own keys: installProbe builds its object without
    // touching the page, over a stand-in window restored afterwards.
    const g = globalThis as { window?: unknown };
    const had = 'window' in g;
    const saved = g.window;
    g.window = {};
    let kitKeys: string[];
    try {
      kitKeys = Object.keys(installProbe({} as Game));
    } finally {
      if (had) g.window = saved;
      else delete g.window;
    }
    expect(Object.keys(stub).sort()).toEqual(kitKeys.sort());
    for (const name of kitKeys.filter((k) => k !== 'live' && k !== 'ready')) {
      expect(() => (stub[name] as () => unknown)()).toThrow(
        `__probe.${name}: the page is not live yet; await __probe.ready() first.`,
      );
    }
  });
});
