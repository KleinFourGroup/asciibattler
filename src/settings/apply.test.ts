import { afterEach, describe, expect, it } from 'vitest';
import { auraFxMode, setAuraFxMode } from '../render/auraFx';
import { getReducedMotionOverride, setReducedMotionOverride } from '../render/motion';
import { memoryAdapter } from '../store/adapter';
import { createStore } from '../store/store';
import { Keybindings } from '../ui/Keybindings';
import { PlaybackSpeed } from '../ui/PlaybackSpeed';
import { getShakePolicy, setShakePolicy } from '../ui/lossFx';
import { applySetting, connectSettings, type SettingsConsumers } from './apply';
import { createSettings, type SettingKey } from './model';
import { SETTINGS_SECTION, type Settings } from './settings';

// 116b — the settings reach what they set. Two kinds of consumer are
// connected: recording stand-ins, to see exactly which call each setting
// makes, and the real modules (the key registry, the playback controller,
// the motion gate, the shake policy, the aura mode), whose state is then
// read back through their own getters, a surface the settings don't touch.
// The audio player's half is AudioPlayer.test.ts.

const KEY = 'asciibattler:settings';
const BUILD = '0.1.0+abc1234';

type Call = [name: keyof SettingsConsumers, ...args: unknown[]];

function recording(): { calls: Call[]; consumers: SettingsConsumers } {
  const calls: Call[] = [];
  return {
    calls,
    consumers: {
      setVolume: (master, sfx) => calls.push(['setVolume', master, sfx]),
      setKeys: (overrides) => calls.push(['setKeys', overrides]),
      setSpeed: (value) => calls.push(['setSpeed', value]),
      setMotion: (override) => calls.push(['setMotion', override]),
      setShake: (policy) => calls.push(['setShake', policy]),
      setAura: (mode) => calls.push(['setAura', mode]),
    },
  };
}

function realConsumers(keys: Keybindings, playback: PlaybackSpeed, volume: number[]): SettingsConsumers {
  return {
    setVolume: (master, sfx) => {
      volume[0] = master;
      volume[1] = sfx;
    },
    setKeys: (overrides) => keys.setOverrides(overrides),
    setSpeed: (value) => {
      playback.select(value);
    },
    setMotion: setReducedMotionOverride,
    setShake: setShakePolicy,
    setAura: setAuraFxMode,
  };
}

const STORED: Partial<Settings> = {
  volumeMaster: 0.8,
  volumeSfx: 0.25,
  keys: { togglePause: 'KeyP' },
  speed: 2,
  motion: 'reduced',
  shake: 'none',
  aura: 'fill',
};

afterEach(() => {
  // The three module-state consumers, back to what a fresh page has.
  setReducedMotionOverride(null);
  setShakePolicy('player');
  setAuraFxMode('track');
});

describe('116b — the settings reach their consumers', () => {
  it('a fresh page: each real consumer already holds what the fallbacks say', () => {
    // The fallbacks are "the game as it was", so they must equal what each
    // consumer starts at on its own. Read before anything is connected.
    const f = SETTINGS_SECTION.fields;
    expect(new Keybindings().overrides()).toEqual(f.keys.fallback);
    expect(new PlaybackSpeed().selectedSpeed).toBe(f.speed.fallback);
    expect(getReducedMotionOverride()).toBeNull();
    expect(f.motion.fallback).toBe('system');
    expect(getShakePolicy()).toBe(f.shake.fallback);
    expect(auraFxMode()).toBe(f.aura.fallback);
  });

  it('connecting hands every consumer its stored value: the boot', () => {
    const adapter = memoryAdapter({ [KEY]: JSON.stringify({ v: 1, build: BUILD, data: STORED }) });
    const { calls, consumers } = recording();
    connectSettings(createSettings(createStore({ adapter, build: BUILD })), consumers);
    const last = (name: keyof SettingsConsumers): unknown[] | undefined =>
      calls.filter(([n]) => n === name).at(-1)?.slice(1);
    expect(last('setVolume')).toEqual([0.8, 0.25]);
    expect(last('setKeys')).toEqual([{ togglePause: 'KeyP' }]);
    expect(last('setSpeed')).toEqual([2]);
    expect(last('setMotion')).toEqual([true]);
    expect(last('setShake')).toEqual(['none']);
    expect(last('setAura')).toEqual(['fill']);
  });

  it('a change makes its one call with the new value: live', () => {
    const model = createSettings(createStore({ adapter: memoryAdapter(), build: BUILD }));
    const { calls, consumers } = recording();
    connectSettings(model, consumers);
    calls.length = 0;
    model.set('volumeSfx', 0.4);
    model.set('volumeMaster', 0.9);
    model.set('keys', { focusObjective: 'KeyG' });
    model.set('speed', 3);
    model.set('motion', 'full');
    model.set('motion', 'system');
    model.set('shake', 'both');
    model.set('aura', 'fill');
    expect(calls).toEqual([
      ['setVolume', 0.5, 0.4],
      ['setVolume', 0.9, 0.4],
      ['setKeys', { focusObjective: 'KeyG' }],
      ['setSpeed', 3],
      ['setMotion', false],
      ['setMotion', null],
      ['setShake', 'both'],
      ['setAura', 'fill'],
    ]);
  });

  it('the four fields with no consumer here make no call', () => {
    const model = createSettings(createStore({ adapter: memoryAdapter(), build: BUILD }));
    const { calls, consumers } = recording();
    connectSettings(model, consumers);
    calls.length = 0;
    model.set('volumeMusic', 0.3);
    model.set('palette', 'colourblind');
    model.set('textScale', 1.25);
    model.set('locale', 'xx');
    expect(calls).toEqual([]);
    // Every field is either routed or one of those four.
    const routed: SettingKey[] = ['volumeMaster', 'volumeSfx', 'keys', 'speed', 'motion', 'shake', 'aura'];
    const unrouted: SettingKey[] = ['volumeMusic', 'palette', 'textScale', 'locale'];
    expect([...routed, ...unrouted].sort()).toEqual(Object.keys(SETTINGS_SECTION.fields).sort());
    for (const key of routed) {
      const one = recording();
      applySetting(key, model.get(), one.consumers);
      expect(one.calls.length, key).toBe(1);
    }
  });

  it('after the unsubscribe a change reaches nothing', () => {
    const model = createSettings(createStore({ adapter: memoryAdapter(), build: BUILD }));
    const { calls, consumers } = recording();
    const off = connectSettings(model, consumers);
    calls.length = 0;
    off();
    model.set('speed', 2);
    expect(calls).toEqual([]);
  });

  it('the real consumers: stored values at the boot, then a change, read through their own getters', () => {
    const adapter = memoryAdapter({ [KEY]: JSON.stringify({ v: 1, build: BUILD, data: STORED }) });
    const model = createSettings(createStore({ adapter, build: BUILD }));
    const keys = new Keybindings();
    const playback = new PlaybackSpeed();
    const volume = [NaN, NaN];
    connectSettings(model, realConsumers(keys, playback, volume));

    expect(volume).toEqual([0.8, 0.25]);
    expect(keys.codeFor('togglePause')).toBe('KeyP');
    expect(playback.selectedSpeed).toBe(2);
    expect(getReducedMotionOverride()).toBe(true);
    expect(getShakePolicy()).toBe('none');
    expect(auraFxMode()).toBe('fill');

    model.set('keys', {});
    model.set('speed', 0.5);
    model.set('motion', 'system');
    model.set('shake', 'enemy');
    model.set('aura', 'track');
    expect(keys.codeFor('togglePause')).toBe('Space');
    expect(playback.selectedSpeed).toBe(0.5);
    expect(getReducedMotionOverride()).toBeNull();
    expect(getShakePolicy()).toBe('enemy');
    expect(auraFxMode()).toBe('track');
  });

  it('a stored speed that is no step, and a stored key set with a reserved key, leave the consumer at its default', () => {
    const data = { speed: 7, keys: { togglePause: 'Escape', dance: 'KeyD' } };
    const adapter = memoryAdapter({ [KEY]: JSON.stringify({ v: 1, build: BUILD, data }) });
    const keys = new Keybindings();
    const playback = new PlaybackSpeed();
    connectSettings(createSettings(createStore({ adapter, build: BUILD })), realConsumers(keys, playback, []));
    expect(playback.selectedSpeed).toBe(1);
    expect(keys.overrides()).toEqual({});
  });
});
