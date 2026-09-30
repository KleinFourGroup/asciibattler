import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { SCENE_CLASSES, sceneName } from './scenes';

describe('the kit’s scene names (a build minifies constructor.name)', () => {
  it('names every scene class in src/scenes', () => {
    const dir = join(__dirname, '..', '..', 'scenes');
    const declared = readdirSync(dir)
      .filter((f) => f.endsWith('.ts') && !f.endsWith('.test.ts'))
      .flatMap((f) => [...readFileSync(join(dir, f), 'utf8').matchAll(/^export class (\w+Scene)\b/gm)].map((m) => m[1]!))
      .sort();
    expect(declared.length).toBeGreaterThan(0);
    expect(Object.keys(SCENE_CLASSES).sort()).toEqual(declared);
  });

  it('names a scene by its class, not by constructor.name', () => {
    const scene = Object.create(SCENE_CLASSES.MapScene.prototype) as object;
    expect(sceneName(scene)).toBe('MapScene');
    expect(sceneName({})).toBe('unnamed');
    expect(sceneName(null)).toBeNull();
  });
});
