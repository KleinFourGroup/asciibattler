import { existsSync, readdirSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { SOUND_SOURCES } from './AudioPlayer';

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
