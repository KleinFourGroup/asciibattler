/**
 * 118f — THE PLAYER'S DIAGNOSTICS: a short report a player copies from
 * Settings › Data and pastes beside a bug report. It says what nobody but
 * the player's own browser can: which build this is, the browser and the
 * window it runs in, the graphics card, the settings, and how the game's
 * storage stands. On itch that storage is partitioned to the page, so there
 * is no other way to look.
 *
 * It is in every build. The diagnostics PANEL (src/dev/diag) is the long
 * form, with the write tally and the two measurements that hold the page,
 * and only a build made with `VITE_DIAG=1` carries it.
 *
 * WHAT IS NOT IN IT: anything a run holds. A stored section is told by its
 * size alone (`sectionSizes`), so no save, journal or seed leaves by this
 * route; Export run and the backup are the rows that hand those over, as
 * files the player chooses to send. The page's address is told by its origin
 * and no more.
 *
 * This file is the pure half: what the report is made of, and how each
 * reading is taken so that one the browser refuses costs the report that
 * field alone. The page's readings are src/diagnostics/page.ts and the
 * `diagnostics` row of `Game`'s settings data.
 */

export interface PageReading {
  readonly origin: string;
  /** Whether the game is in another page's frame, as it is on itch. */
  readonly embedded: boolean;
  readonly userAgent: string;
  readonly language: string;
  /** `1280x720 @1`: the window in CSS pixels and the device pixel ratio. */
  readonly window: string;
  /** `2560x1440`: the screen the window is on. */
  readonly screen: string;
}

export interface GraphicsReading {
  readonly renderer: string | null;
  readonly vendor: string | null;
}

export interface StoreReading {
  readonly adapter: string;
  readonly canSave: boolean;
  readonly error: string | null;
  /** The build that last stamped the store before this page; null for a
   *  store that was empty at boot. */
  readonly previousBuild: string | null;
  /** This tab's side of the two-tab lock (src/store/runLock.ts). */
  readonly lock: string;
  /** Each section's stored characters; null where the store can't read. */
  readonly sections: Readonly<Record<string, number | null>> | null;
}

export interface RunReading {
  /** Whether a run is being played on this page. */
  readonly live: boolean;
  /** What the run slot holds, as the menu reads it (src/store/runSlot.ts):
   *  `empty`, `saved`, `rejected` (a save this build can't load) or
   *  `elsewhere` (another tab's). */
  readonly slot: string;
}

export interface DiagnosticsSources {
  /** The time of the report, as ISO text. */
  readonly at: string;
  readonly build: string;
  readonly page: () => PageReading;
  readonly graphics: () => GraphicsReading;
  readonly settings: () => unknown;
  readonly store: () => StoreReading;
  readonly run: () => RunReading;
}

/** A reading, or the sentence that stands where a refused one would be. */
type Read<T> = T | string;

export interface PlayerDiagnostics {
  readonly asciibattler: 'diagnostics';
  readonly v: 1;
  readonly at: string;
  readonly build: string;
  readonly page: Read<PageReading>;
  readonly graphics: Read<GraphicsReading>;
  readonly settings: unknown;
  readonly store: Read<StoreReading>;
  readonly run: Read<RunReading>;
}

function describe(err: unknown): string {
  if (err instanceof Error) return err.message === '' ? err.name : `${err.name}: ${err.message}`;
  try {
    return String(err);
  } catch {
    return 'a value that has no text';
  }
}

/** One reading. A browser may refuse any of them (a frame's `top`, a lost
 *  context, blocked storage), and the report goes on without it. */
function reading<T>(read: () => T): Read<T> {
  try {
    return read();
  } catch (err) {
    return `not read (${describe(err)})`;
  }
}

export function diagnosticsReport(sources: DiagnosticsSources): PlayerDiagnostics {
  return {
    asciibattler: 'diagnostics',
    v: 1,
    at: sources.at,
    build: sources.build,
    page: reading(sources.page),
    graphics: reading(sources.graphics),
    settings: reading(sources.settings),
    store: reading(sources.store),
    run: reading(sources.run),
  };
}

/** The report as the text a player pastes. */
export function diagnosticsText(report: PlayerDiagnostics): string {
  return JSON.stringify(report, null, 1);
}

/** The file the report is saved as where the browser refuses the clipboard. */
export function diagnosticsFileName(at: string): string {
  return `asciibattler-diagnostics-${at.replace(/[:.]/g, '-')}.json`;
}

/**
 * How many characters each section holds, and nothing of what they are: a
 * dump is the store's whole text, a save and every finished run included.
 * Null for a store that can't read its storage.
 */
export function sectionSizes(
  dump: Readonly<Record<string, string | null | undefined>> | null,
  names: readonly string[],
): Record<string, number | null> | null {
  if (dump === null) return null;
  const sizes: Record<string, number | null> = {};
  for (const name of names) sizes[name] = dump[name]?.length ?? null;
  return sizes;
}

/** The part of a WebGL context the graphics reading asks. */
export interface GlLike {
  readonly RENDERER: number;
  readonly VENDOR: number;
  getParameter(name: number): unknown;
  getExtension(name: string): unknown;
}

/** What Chromium answers for RENDERER in place of the card's name. */
const MASKED_RENDERERS: readonly string[] = ['WebKit WebGL'];

const textOrNull = (value: unknown): string | null => (typeof value === 'string' && value !== '' ? value : null);

/**
 * The graphics card, as the game's own context names it. RENDERER is asked
 * first, and the `WEBGL_debug_renderer_info` extension only where RENDERER
 * is Chromium's stand-in (read in the Browser pane, which is Chromium).
 * Firefox is from memory and not read here: it answers RENDERER with the
 * card, and logs a deprecation warning at a page that asks for the
 * extension, which is why the extension is not asked first.
 */
export function graphicsOf(gl: GlLike): GraphicsReading {
  const renderer = textOrNull(gl.getParameter(gl.RENDERER));
  const vendor = textOrNull(gl.getParameter(gl.VENDOR));
  if (renderer !== null && !MASKED_RENDERERS.includes(renderer)) return { renderer, vendor };
  const info = gl.getExtension('WEBGL_debug_renderer_info') as {
    readonly UNMASKED_RENDERER_WEBGL: number;
    readonly UNMASKED_VENDOR_WEBGL: number;
  } | null;
  if (info === null || info === undefined) return { renderer, vendor };
  return {
    renderer: textOrNull(gl.getParameter(info.UNMASKED_RENDERER_WEBGL)) ?? renderer,
    vendor: textOrNull(gl.getParameter(info.UNMASKED_VENDOR_WEBGL)) ?? vendor,
  };
}
