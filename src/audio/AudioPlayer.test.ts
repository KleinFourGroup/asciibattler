import { existsSync, readdirSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it, vi } from 'vitest';
import { AudioPlayer, DEFAULT_MASTER_VOLUME, SOUND_SOURCES, soundVolume } from './AudioPlayer';
import { SETTINGS_SECTION } from '../settings/settings';

/**
 * §104c — THE ASSET PIN. `AudioPlayer.play` swallows a failed playback (the
 * autoplay policy makes that necessary), so a key whose file is missing, or
 * misnamed, ships SILENT with no error anywhere. The check is against the
 * directory listing, never a path the player itself resolved.
 */
const publicDir = fileURLToPath(new URL('../../public/', import.meta.url));

describe('the sound assets', () => {
  it('every SoundKey has a non-empty file under public/', () => {
    const offenders = Object.entries(SOUND_SOURCES)
      .filter(([, rel]) => !existsSync(publicDir + rel) || statSync(publicDir + rel).size === 0)
      .map(([key, rel]) => `${key} → ${rel}`);
    expect(offenders, 'a SoundKey with no sample plays nothing, silently').toEqual([]);
  });

  it('every file in public/audio/ is a key (no orphaned sample ships)', () => {
    const used = new Set(Object.values(SOUND_SOURCES));
    const orphans = readdirSync(publicDir + 'audio').filter((f) => !used.has(`audio/${f}`));
    expect(orphans, 'delete the file, or give it a SoundKey').toEqual([]);
  });
});

/**
 * §111a — THE RECORDER'S SEAM. The recorder records any development-mode build
 * by reaching into the live AudioPlayer from outside
 * (shell/electron/probes/record-page.js): it routes every element of `pools`
 * into its recording and wraps `play` to log each cue. Nothing typechecks that
 * script, so the shape it needs is pinned here, where a refactor of this class
 * runs into it. (It checks the same names at record time and fails loudly.)
 */
describe("the recorder's seam", () => {
  it('`pools` holds each key its own <audio> elements, and `play` is a method', () => {
    class FakeAudio {
      preload = '';
      volume = 1;
      constructor(readonly src: string) {}
    }
    vi.stubGlobal('Audio', FakeAudio);
    try {
      const pools = new AudioPlayer()['pools'];
      expect(Object.keys(pools).sort()).toEqual(Object.keys(SOUND_SOURCES).sort());
      for (const pool of Object.values(pools)) {
        expect(pool.length).toBeGreaterThan(0);
        for (const el of pool) expect(el).toBeInstanceOf(FakeAudio);
      }
      expect(typeof AudioPlayer.prototype.play).toBe('function');
    } finally {
      vi.unstubAllGlobals();
    }
  });
});

/**
 * 116b — THE VOLUME AXES (Round 8 spec D7): a sound plays at master × SFX ×
 * its own level. The expected numbers are worked by hand from that sentence
 * and the levels in the table (melee 1.0, click 0.7).
 */
describe('the volume axes', () => {
  it('soundVolume is the product, times a per-play gain, clamped to 0..1', () => {
    expect(soundVolume(0.5, 1, 1)).toBe(0.5);
    expect(soundVolume(0.8, 0.5, 0.7)).toBeCloseTo(0.28, 10);
    expect(soundVolume(0.5, 1, 0.85, 0.5)).toBeCloseTo(0.2125, 10);
    expect(soundVolume(1, 1, 1, 3)).toBe(1);
    expect(soundVolume(0, 1, 1)).toBe(0);
    expect(soundVolume(1, 0, 1)).toBe(0);
  });

  it("the settings' master fallback is the loudness the game had", () => {
    expect(DEFAULT_MASTER_VOLUME).toBe(0.5);
    expect(SETTINGS_SECTION.fields.volumeMaster.fallback).toBe(DEFAULT_MASTER_VOLUME);
    expect(SETTINGS_SECTION.fields.volumeSfx.fallback).toBe(1);
  });

  it('setVolume reaches every element at once, and a play uses both levels', () => {
    class FakeAudio {
      preload = '';
      volume = 1;
      playbackRate = 1;
      currentTime = 0;
      constructor(readonly src: string) {}
      play(): Promise<void> {
        return Promise.resolve();
      }
    }
    vi.stubGlobal('Audio', FakeAudio);
    try {
      const player = new AudioPlayer();
      const pools = player['pools'];
      // A fresh player sounds as the game did: master 0.5, SFX 1.
      expect(pools.melee[0]!.volume).toBe(0.5);
      expect(pools.click[0]!.volume).toBeCloseTo(0.35, 10);
      player.setVolume(0.8, 0.5);
      for (const el of pools.melee) expect(el.volume).toBeCloseTo(0.4, 10);
      for (const el of pools.click) expect(el.volume).toBeCloseTo(0.28, 10);
      player.play('melee', { gain: 0.5 });
      expect(pools.melee[0]!.volume).toBeCloseTo(0.2, 10);
      // Out-of-range levels are clamped, not stored as given.
      player.setVolume(4, -1);
      expect(pools.melee[1]!.volume).toBe(0);
    } finally {
      vi.unstubAllGlobals();
    }
  });
});
