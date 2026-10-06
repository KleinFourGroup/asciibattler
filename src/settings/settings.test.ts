import { afterEach, describe, expect, it } from 'vitest';
import { registerLocale, resetLocales, resolveProse, setActiveLocale } from '../i18n/locale';
import { memoryAdapter } from '../store/adapter';
import { createStore } from '../store/store';
import { applyAtBoot } from './atBoot';
import { createSettings, type SettingKey } from './model';
import { SETTINGS_SECTION, type Settings } from './settings';

// 116a — the settings over the memory adapter. Stored text is planted and
// read back through `adapter.entries`, not through the model, so a pin never
// compares the settings with themselves. A second store over the same
// adapter stands for a reload.

const KEY = 'asciibattler:settings';
const BUILD = '0.1.0+abc1234';

const storedData = (adapter: { entries: Map<string, string> }): Record<string, unknown> =>
  (JSON.parse(adapter.entries.get(KEY) ?? '{"data":{}}') as { data: Record<string, unknown> }).data;

/** What an empty store gives: the game as it was before it had settings. */
const FALLBACKS: Settings = {
  volumeMaster: 0.5,
  volumeSfx: 1,
  volumeMusic: 1,
  keys: {},
  speed: 1,
  motion: 'system',
  shake: 'player',
  aura: 'track',
  palette: 'default',
  textScale: 1,
  locale: 'en',
};

/** One value per field that is not its fallback. */
const CHANGED: Settings = {
  volumeMaster: 0.8,
  volumeSfx: 0.25,
  volumeMusic: 0,
  keys: { togglePause: 'KeyP', focusObjective: 'KeyG' },
  speed: 2,
  motion: 'reduced',
  shake: 'none',
  aura: 'fill',
  palette: 'colourblind',
  textScale: 1.25,
  locale: 'xx',
};

const FIELDS = Object.keys(FALLBACKS) as SettingKey[];

function setAll(model: ReturnType<typeof createSettings>, values: Settings): void {
  const set = <K extends SettingKey>(key: K): boolean => model.set(key, values[key]);
  for (const key of FIELDS) expect(set(key), key).toBe(true);
}

describe('116a — the settings section', () => {
  it("the field names are the stored keys, and they don't change", () => {
    // A name is a key in every player's browser. Renaming one orphans what
    // is stored under it, so a rename has to fail here first.
    expect(Object.keys(SETTINGS_SECTION.fields).sort()).toEqual([
      'aura',
      'keys',
      'locale',
      'motion',
      'palette',
      'shake',
      'speed',
      'textScale',
      'volumeMaster',
      'volumeMusic',
      'volumeSfx',
    ]);
    expect(SETTINGS_SECTION.name).toBe('settings');
    expect(FIELDS.length).toBe(11);
  });

  it('an empty store gives every fallback and writes nothing', () => {
    const adapter = memoryAdapter();
    const model = createSettings(createStore({ adapter, build: BUILD }));
    expect(model.get()).toEqual(FALLBACKS);
    expect(adapter.entries.has(KEY)).toBe(false);
  });

  it('every field round-trips: set, stored as text, read back after a reload', () => {
    const adapter = memoryAdapter();
    setAll(createSettings(createStore({ adapter, build: BUILD })), CHANGED);
    // The stored text holds each value under its field's name.
    expect(storedData(adapter)).toEqual(CHANGED);
    // And a second store over the same text reads them all back.
    expect(createSettings(createStore({ adapter, build: BUILD })).get()).toEqual(CHANGED);
    // The test's two tables differ in every field, so no field passed by
    // sitting at its fallback.
    for (const key of FIELDS) expect(CHANGED[key], key).not.toEqual(FALLBACKS[key]);
  });

  it('a stored value its schema refuses falls back alone', () => {
    const data = { ...CHANGED, volumeMaster: 7, motion: 'sideways', keys: 'KeyP', textScale: 40, stray: true };
    const adapter = memoryAdapter({ [KEY]: JSON.stringify({ v: 1, build: BUILD, data }) });
    const got = createSettings(createStore({ adapter, build: BUILD })).get();
    expect(got).toEqual({
      ...CHANGED,
      volumeMaster: FALLBACKS.volumeMaster,
      motion: FALLBACKS.motion,
      keys: FALLBACKS.keys,
      textScale: FALLBACKS.textScale,
    });
    expect('stray' in got).toBe(false);
  });

  it('set refuses a value the field does not take, and stores nothing', () => {
    const adapter = memoryAdapter();
    const model = createSettings(createStore({ adapter, build: BUILD }));
    expect(() => model.set('volumeSfx', 1.5)).toThrow(/volumeSfx/);
    expect(() => model.set('aura', 'fixed' as Settings['aura'])).toThrow(/aura/);
    expect(model.get()).toEqual(FALLBACKS);
    expect(adapter.entries.has(KEY)).toBe(false);
  });

  it('a change is heard once, with its key and the new values; an unsubscribed listener hears nothing', () => {
    const model = createSettings(createStore({ adapter: memoryAdapter(), build: BUILD }));
    const heard: [SettingKey, number][] = [];
    const off = model.onChange((key, now) => heard.push([key, now.volumeSfx]));
    model.set('volumeSfx', 0.4);
    off();
    model.set('volumeSfx', 0.9);
    expect(heard).toEqual([['volumeSfx', 0.4]]);
  });

  it("on a store that can't save, a change holds for the page and set says it wasn't saved", () => {
    const adapter = memoryAdapter();
    const store = createStore({ adapter, build: BUILD, unsaved: 'SecurityError: planted' });
    const model = createSettings(store);
    expect(model.set('speed', 3)).toBe(false);
    expect(model.get().speed).toBe(3);
    expect(adapter.entries.size).toBe(0);
  });
});

describe('116a — the settings at boot', () => {
  afterEach(() => resetLocales());

  const PLANTED = { 'unit.name': 'planted' };
  const setPalette = (): void => {};

  it('a stored locale the build ships is the one a catalog resolves through', () => {
    registerLocale('xx', 'fixture', PLANTED);
    applyAtBoot({ locale: 'xx', palette: 'default' }, { shippedLocales: ['en', 'xx'], setLocale: setActiveLocale, setPalette });
    expect(resolveProse('fixture', 'unit.name', 'inline')).toBe('planted');
  });

  it("a stored locale the build doesn't ship is left alone, and the page keeps the default", () => {
    registerLocale('xx', 'fixture', PLANTED);
    applyAtBoot({ locale: 'zz', palette: 'default' }, { shippedLocales: ['en', 'xx'], setLocale: setActiveLocale, setPalette });
    expect(resolveProse('fixture', 'unit.name', 'inline')).toBe('inline');
    // The same holds for a locale that is registered and not shipped.
    applyAtBoot({ locale: 'xx', palette: 'default' }, { shippedLocales: ['en'], setLocale: setActiveLocale, setPalette });
    expect(resolveProse('fixture', 'unit.name', 'inline')).toBe('inline');
  });

  it('with no boot call the planted locale is not consulted (the control)', () => {
    registerLocale('xx', 'fixture', PLANTED);
    expect(resolveProse('fixture', 'unit.name', 'inline')).toBe('inline');
  });

  it('116f — the stored palette is handed to the chooser by name, whatever the locale did', () => {
    const chosen: string[] = [];
    const seams = { shippedLocales: ['en'], setLocale: setActiveLocale, setPalette: (name: string) => chosen.push(name) };
    applyAtBoot({ locale: 'en', palette: 'colourblind' }, seams);
    applyAtBoot({ locale: 'zz', palette: 'default' }, seams);
    expect(chosen).toEqual(['colourblind', 'default']);
  });
});
