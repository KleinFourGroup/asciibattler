import { existsSync, readdirSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it, vi } from 'vitest';
import { AudioPlayer, SOUND_SOURCES } from './AudioPlayer';

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
