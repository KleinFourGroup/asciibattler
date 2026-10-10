import { describe, expect, it } from 'vitest';
import {
  diagnosticsFileName,
  diagnosticsReport,
  diagnosticsText,
  graphicsOf,
  sectionSizes,
  type DiagnosticsSources,
  type GlLike,
} from './report';

// 118f — the player's diagnostics, each part held to an answer planted here.

const SOURCES: DiagnosticsSources = {
  at: '2026-10-10T17:00:00.000Z',
  build: '0.1.0+abc1234',
  page: () => ({
    origin: 'https://html-classic.itch.zone',
    embedded: true,
    userAgent: 'TestBrowser/1.0',
    language: 'en-GB',
    window: '1280x720 @1',
    screen: '2560x1440',
  }),
  graphics: () => ({ renderer: 'Test Card 9000', vendor: 'Test' }),
  settings: () => ({ textScale: 1.25, palette: 'colourblind' }),
  store: () => ({
    adapter: 'web',
    canSave: true,
    error: null,
    previousBuild: '0.0.0+0000000',
    lock: 'held',
    sections: { meta: 31, settings: 120, progress: null, run: 20480, journals: null },
  }),
  run: () => ({ live: true, slot: 'saved' }),
};

describe('118f — the diagnostics report', () => {
  it('is the readings it was given, under a name and a version', () => {
    expect(diagnosticsReport(SOURCES)).toEqual({
      asciibattler: 'diagnostics',
      v: 1,
      at: '2026-10-10T17:00:00.000Z',
      build: '0.1.0+abc1234',
      page: {
        origin: 'https://html-classic.itch.zone',
        embedded: true,
        userAgent: 'TestBrowser/1.0',
        language: 'en-GB',
        window: '1280x720 @1',
        screen: '2560x1440',
      },
      graphics: { renderer: 'Test Card 9000', vendor: 'Test' },
      settings: { textScale: 1.25, palette: 'colourblind' },
      store: {
        adapter: 'web',
        canSave: true,
        error: null,
        previousBuild: '0.0.0+0000000',
        lock: 'held',
        sections: { meta: 31, settings: 120, progress: null, run: 20480, journals: null },
      },
      run: { live: true, slot: 'saved' },
    });
  });

  it('goes on without a reading the browser refuses, and says which', () => {
    const refused = diagnosticsReport({
      ...SOURCES,
      page: () => {
        throw new DOMException('Blocked a frame from accessing a cross-origin frame.', 'SecurityError');
      },
      graphics: () => {
        throw 'context lost';
      },
    });
    expect(refused.page).toBe('not read (SecurityError: Blocked a frame from accessing a cross-origin frame.)');
    expect(refused.graphics).toBe('not read (context lost)');
    expect(refused.store).toEqual(SOURCES.store());
    expect(refused.run).toEqual({ live: true, slot: 'saved' });
    expect(refused.build).toBe('0.1.0+abc1234');
  });

  it('reads as text that parses back to the report', () => {
    const report = diagnosticsReport(SOURCES);
    expect(JSON.parse(diagnosticsText(report))).toEqual(report);
    expect(diagnosticsText(report)).toContain('\n');
  });

  it('names its file by the time, in characters a file name takes', () => {
    expect(diagnosticsFileName('2026-10-10T17:00:00.000Z')).toBe('asciibattler-diagnostics-2026-10-10T17-00-00-000Z.json');
  });
});

describe('118f — a stored section is told by its size alone', () => {
  const SECRET = 'seed-31337-and-every-choice';
  const dump = {
    meta: '{"v":1}',
    settings: '{"v":1,"data":{"textScale":1}}',
    run: `{"v":49,"data":{"journal":"${SECRET}"}}`,
    journals: undefined,
  };
  const names = ['meta', 'settings', 'progress', 'run', 'journals'];

  it('counts characters, and null where nothing is stored', () => {
    expect(sectionSizes(dump, names)).toEqual({
      meta: 7,
      settings: 30,
      progress: null,
      run: dump.run.length,
      journals: null,
    });
  });

  it('is null for a store that cannot read', () => {
    expect(sectionSizes(null, names)).toBeNull();
  });

  it('lets nothing a section holds into the report', () => {
    const report = diagnosticsReport({
      ...SOURCES,
      store: () => ({ ...SOURCES.store(), sections: sectionSizes(dump, names) }),
    });
    const text = diagnosticsText(report);
    expect(text).not.toContain(SECRET);
    expect(text).not.toContain('journal"');
    // The control: the same check sees the secret in a report that carries the dump.
    expect(diagnosticsText({ ...report, settings: dump })).toContain(SECRET);
  });
});

/** A context that answers RENDERER and VENDOR as given, and the extension's
 *  two names when it has one. `asked` counts the extension's requests. */
function fakeGl(plain: { renderer: unknown; vendor: unknown }, unmasked: { renderer: unknown; vendor: unknown } | null) {
  const asked: string[] = [];
  const gl: GlLike = {
    RENDERER: 1,
    VENDOR: 2,
    getParameter: (name) =>
      name === 1 ? plain.renderer : name === 2 ? plain.vendor : name === 11 ? unmasked?.renderer : name === 12 ? unmasked?.vendor : null,
    getExtension: (name) => {
      asked.push(name);
      return unmasked === null ? null : { UNMASKED_RENDERER_WEBGL: 11, UNMASKED_VENDOR_WEBGL: 12 };
    },
  };
  return { gl, asked };
}

describe('118f — the graphics reading', () => {
  it("takes RENDERER where it names the card, and doesn't ask for the extension", () => {
    const { gl, asked } = fakeGl({ renderer: 'ANGLE (Test, Test Card 9000)', vendor: 'Test' }, { renderer: 'other', vendor: 'other' });
    expect(graphicsOf(gl)).toEqual({ renderer: 'ANGLE (Test, Test Card 9000)', vendor: 'Test' });
    expect(asked).toEqual([]);
  });

  it("asks the extension where RENDERER is Chromium's stand-in", () => {
    const { gl, asked } = fakeGl({ renderer: 'WebKit WebGL', vendor: 'WebKit' }, { renderer: 'ANGLE (Test, Test Card 9000)', vendor: 'Google Inc. (Test)' });
    expect(graphicsOf(gl)).toEqual({ renderer: 'ANGLE (Test, Test Card 9000)', vendor: 'Google Inc. (Test)' });
    expect(asked).toEqual(['WEBGL_debug_renderer_info']);
  });

  it('keeps the stand-in where the browser gives no extension', () => {
    const { gl } = fakeGl({ renderer: 'WebKit WebGL', vendor: 'WebKit' }, null);
    expect(graphicsOf(gl)).toEqual({ renderer: 'WebKit WebGL', vendor: 'WebKit' });
  });

  it('reads a lost context, which answers null, as no card', () => {
    const { gl } = fakeGl({ renderer: null, vendor: null }, null);
    expect(graphicsOf(gl)).toEqual({ renderer: null, vendor: null });
  });
});
