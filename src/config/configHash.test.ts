import { describe, it, expect } from 'vitest';
import { readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { CONFIG_SOURCES, configHash, fnv1a } from './configHash';

const configDir = join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'config');

describe('configHash (53b)', () => {
  it('the registry stays 1:1 with the real config/ directory (the drift guard)', () => {
    const onDisk = readdirSync(configDir)
      .filter((f) => f.endsWith('.json'))
      .sort();
    const registered = Object.keys(CONFIG_SOURCES).sort();
    // One assertion both ways: a file added without a registry entry AND a
    // registry entry whose file was removed/renamed both surface here.
    expect(registered).toEqual(onDisk);
  });

  it('fnv1a matches the standard 32-bit test vectors', () => {
    expect(fnv1a('')).toBe('811c9dc5'); // the offset basis
    expect(fnv1a('a')).toBe('e40c292c');
    expect(fnv1a('foobar')).toBe('bf9cf968');
  });

  it('configHash is stable, 8 lowercase hex chars', () => {
    const h = configHash();
    expect(h).toMatch(/^[0-9a-f]{8}$/);
    expect(configHash()).toBe(h);
  });
});
