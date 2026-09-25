/**
 * 98e — the tile kind → `aAnim.x` mapping, pinned. `animTypeFor` is the ONE
 * place a kind picks its fragment-shader branch (the terrain and the apron
 * each carried a private ternary before 98e); the expected table is a
 * `Record<TileKind, number>` so a new kind fails tsc here until it is
 * placed. The shader side is eyeball-only (TESTING.md's render policy).
 */

import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as THREE from 'three';
import { THEMES } from '../config/layouts';
import { TileGrid, type TileKind } from '../sim/TileGrid';
import {
  ANIM_DEEP_WATER,
  ANIM_FIRE,
  ANIM_HEALING,
  ANIM_NONE,
  HILL_MOUND_ENVELOPE,
  TerrainRenderer,
  animTypeFor,
  groundMarkShaders,
  topColorFor,
} from './TerrainRenderer';
import { BIN_DEPTH, DEFAULT_MARK_STYLE, MARKS_PER_ROW, type Mark } from './groundMarks';

/**
 * 107b — the mound envelope bounds every drawn mound. The N×N slab rule
 * (`slabAnchor.ts`) clears the hill mounds through `HILL_MOUND_ENVELOPE`
 * without reading the mesh, so a mound that outgrew the envelope would bite a
 * slab again. Read from the bump geometry itself: 12 vertices per mound, four
 * side triangles of (base, base, apex), emitted cell by cell, row-major, four
 * mounds per `hills` cell.
 */
describe('107b — HILL_MOUND_ENVELOPE bounds the drawn mounds', () => {
  const W = 24;
  const H = 24;
  const grid = new TileGrid(W, H);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) grid.setKind({ x, y }, 'hills');
  const terrain = new TerrainRenderer();
  terrain.setTiles(grid, W, H, THEMES[0]!);
  const pos = (terrain as unknown as { bumpsGeometry: THREE.BufferGeometry }).bumpsGeometry.getAttribute('position');

  type Envelope = { reach: number; maxH: number; maxR: number };
  /** The largest amount any mound exceeds each bound by (≤ 0 = inside). */
  const excess = (env: Envelope): Envelope => {
    const out = { reach: -Infinity, maxH: -Infinity, maxR: -Infinity };
    const mounds = pos.count / 12;
    for (let k = 0; k < mounds; k++) {
      const cell = Math.floor(k / 4);
      const cx = cell % W;
      const cy = Math.floor(cell / W);
      const ccx = cx - W / 2 + 0.5;
      const ccz = H / 2 - cy - 0.5;
      const top = terrain.heightAt(cx, cy, 'hills');
      const apex = k * 12 + 2;
      const ax = pos.getX(apex);
      const az = pos.getZ(apex);
      out.reach = Math.max(out.reach, Math.abs(ax - ccx) - env.reach, Math.abs(az - ccz) - env.reach);
      out.maxH = Math.max(out.maxH, pos.getY(apex) - top - env.maxH);
      for (let t = 0; t < 4; t++)
        for (const v of [k * 12 + t * 3, k * 12 + t * 3 + 1]) {
          expect(pos.getY(v)).toBeCloseTo(top, 5);
          out.maxR = Math.max(out.maxR, Math.abs(pos.getX(v) - ax) - env.maxR, Math.abs(pos.getZ(v) - az) - env.maxR);
        }
    }
    return out;
  };

  it('no apex beyond `reach` of its cell centre or `maxH` above its tile top, no base corner beyond `maxR`', () => {
    expect(pos.count).toBe(W * H * 4 * 12);
    const e = excess(HILL_MOUND_ENVELOPE);
    expect(e.reach).toBeLessThanOrEqual(1e-6);
    expect(e.maxH).toBeLessThanOrEqual(1e-6);
    expect(e.maxR).toBeLessThanOrEqual(1e-6);
  });

  it('CONTROL — shrink any one bound by 10 % and some mound exceeds it', () => {
    for (const key of ['reach', 'maxH', 'maxR'] as const) {
      const shrunk = { ...HILL_MOUND_ENVELOPE, [key]: HILL_MOUND_ENVELOPE[key] * 0.9 };
      expect(excess(shrunk)[key], key).toBeGreaterThan(0);
    }
  });
});

/**
 * Hills take the board's theme (the cluster-two spec: a hills tile
 * "otherwise visually conforms to the layout's palette"). They shipped a fixed
 * green on every theme from §37b until 2026-09-23. The look is eyeball-only;
 * these pin that the colour follows the theme at all.
 */
describe('hills follow the board theme', () => {
  it('a hills tile top is its theme’s floor colour, on every theme', () => {
    const hills = new THREE.Color();
    const floor = new THREE.Color();
    for (const theme of THEMES)
      for (const y of [-0.3, -0.2, -0.1, 0]) {
        topColorFor(y, 'hills', theme, hills);
        topColorFor(y, 'floor', theme, floor);
        expect(hills.getHex(), `${theme} @ ${y}`).toBe(floor.getHex());
      }
  });

  it('the mounds change colour with the theme', () => {
    const grid = new TileGrid(3, 3);
    for (let y = 0; y < 3; y++) for (let x = 0; x < 3; x++) grid.setKind({ x, y }, 'hills');
    const moundColours = (theme: (typeof THEMES)[number]): string => {
      const terrain = new TerrainRenderer();
      terrain.setTiles(grid, 3, 3, theme);
      const bumps = (terrain as unknown as { bumpsGeometry: THREE.BufferGeometry }).bumpsGeometry;
      const col = bumps.getAttribute('aColor');
      expect(col.count, theme).toBeGreaterThan(0);
      return Array.from(col.array as Float32Array, (v) => v.toFixed(4)).join(',');
    };
    const seen = new Set(THEMES.map(moundColours));
    expect(seen.size).toBe(THEMES.length);
  });
});

/**
 * 99d — deep water's band drift is ONE constant in two shaders (the board
 * and the apron share the world-space formula so the pattern is continuous
 * across the board edge); a retune that forgets the second file would slide
 * the two halves of a band apart at the edge. Read from the sources, so the
 * shaders stay plain GLSL (no TS-injected define for one number).
 */
const SHADERS = join(dirname(fileURLToPath(import.meta.url)), 'shaders');
const deepDriftOf = (file: string): string => {
  const src = readFileSync(join(SHADERS, file), 'utf8');
  const m = /const\s+float\s+DEEP_DRIFT\s*=\s*([\d.]+)\s*;/.exec(src);
  if (m === null) throw new Error(`${file}: no DEEP_DRIFT constant`);
  return m[1]!;
};

describe('99d — the deep-water drift constant', () => {
  it('is the same number in terrain.frag and apron.frag', () => {
    expect(deepDriftOf('terrain.frag.glsl')).toBe(deepDriftOf('apron.frag.glsl'));
  });
});

const EXPECTED: Record<TileKind, number> = {
  floor: ANIM_NONE,
  shallow_water: ANIM_NONE,
  chasm: ANIM_NONE,
  fire: ANIM_FIRE,
  healing: ANIM_HEALING,
  deep_water: ANIM_DEEP_WATER, // 98e — the static bands, the passability tell
  hills: ANIM_NONE,
  ice: ANIM_NONE,
  sand: ANIM_NONE,
  mud: ANIM_NONE,
};

describe('98e — animTypeFor', () => {
  it('maps every tile kind to its shader branch', () => {
    for (const [kind, expected] of Object.entries(EXPECTED) as [TileKind, number][]) {
      expect(animTypeFor(kind), kind).toBe(expected);
    }
  });

  it('the branch ids are distinct and ordered as the shader thresholds expect (0 < 1 < 2 < 3)', () => {
    const ids = [ANIM_NONE, ANIM_FIRE, ANIM_HEALING, ANIM_DEEP_WATER];
    expect(ids).toEqual([0, 1, 2, 3]);
  });

  it('deep water is the only kind on the band branch — shallow water stays plain', () => {
    expect(animTypeFor('deep_water')).toBe(ANIM_DEEP_WATER);
    expect(animTypeFor('shallow_water')).toBe(ANIM_NONE);
    const onBands = (Object.keys(EXPECTED) as TileKind[]).filter(
      (k) => animTypeFor(k) === ANIM_DEEP_WATER,
    );
    expect(onBands).toEqual(['deep_water']);
  });
});

/**
 * 108b — the ground marks' seam into the terrain shader. The shader's look is
 * read by eye and by the pane's pixel comparison with the §106 mock; pinned
 * here is what a headless test can see: marks off IS today's terrain shader,
 * read straight from the files (the frame-cost bench's before leg); marks on
 * only inserts; the mounds share the marks' uniform objects (their material is
 * a clone, and a clone copies uniforms); a frame uploads once.
 */
describe('108b — the ground marks in the terrain shader', () => {
  const read = (file: string): string => readFileSync(join(SHADERS, file), 'utf8');
  const parts = (t: TerrainRenderer) =>
    t as unknown as { material: THREE.ShaderMaterial; bumpsMaterial: THREE.ShaderMaterial; mesh: THREE.Mesh };
  const draw = (mesh: THREE.Mesh): void =>
    mesh.onBeforeRender({} as never, {} as never, {} as never, {} as never, {} as never, {} as never);
  const MARK: Mark = { x: 0, z: 0, shape: 'circle', extent: 0.275, dashed: false, r: 1, g: 0, b: 0, alpha: 1 };
  const MARK_UNIFORMS = ['uMarks', 'uMarkBins', 'uMarkGrid', 'uMarkCount', 'uContactStyle', 'uPlateStyle', 'uPlateDashGap'];

  it('marks off draws from the two terrain files, byte for byte', () => {
    const terrain = new TerrainRenderer();
    expect(terrain.groundMarksOn).toBe(true); // the shipped default
    terrain.setGroundMarks(false);
    for (const m of [parts(terrain).material, parts(terrain).bumpsMaterial]) {
      expect(m.vertexShader).toBe(read('terrain.vert.glsl'));
      expect(m.fragmentShader).toBe(read('terrain.frag.glsl'));
    }
    terrain.setGroundMarks(true);
    expect(parts(terrain).bumpsMaterial.fragmentShader).toBe(groundMarkShaders().fragmentShader);
  });

  it('marks on only inserts: every line of both files survives, in order', () => {
    const { vertexShader, fragmentShader } = groundMarkShaders();
    const keepsInOrder = (whole: string, part: string): boolean => {
      const lines = whole.split('\n');
      let at = 0;
      for (const line of part.split('\n')) {
        at = lines.indexOf(line, at);
        if (at < 0) return false;
        at++;
      }
      return true;
    };
    expect(keepsInOrder(vertexShader, read('terrain.vert.glsl'))).toBe(true);
    expect(keepsInOrder(fragmentShader, read('terrain.frag.glsl'))).toBe(true);
    expect(fragmentShader.split('base = applyGroundMarks(base);')).toHaveLength(2);
    expect(fragmentShader.indexOf('base = applyGroundMarks(base);')).toBeLessThan(
      fragmentShader.indexOf('gl_FragColor = vec4(base, 1.0);'),
    );
    expect(vertexShader).toContain('vMarkNormal = mat3(modelMatrix) * normal;');
    // The chunk reads the table's layout from the table's own constants.
    expect(fragmentShader).toContain(`#define MARK_BIN_DEPTH ${BIN_DEPTH}\n`);
    expect(fragmentShader).toContain(`#define MARKS_PER_ROW ${MARKS_PER_ROW}\n`);
  });

  it('the mounds share the marks’ uniform objects, where a bare clone would not', () => {
    const { material, bumpsMaterial } = parts(new TerrainRenderer());
    for (const key of MARK_UNIFORMS) expect(bumpsMaterial.uniforms[key], key).toBe(material.uniforms[key]);
    // The control: what the mounds would hold without the re-point.
    expect(material.clone().uniforms['uMarkCount']).not.toBe(material.uniforms['uMarkCount']);
  });

  it('uploads a frame’s marks at the first terrain draw, once', () => {
    const terrain = new TerrainRenderer();
    const { material, mesh, bumpsMaterial } = parts(terrain);
    const marks = material.uniforms['uMarks']!.value as THREE.DataTexture;
    terrain.beginMarks(7, 5);
    terrain.addMark(MARK);
    const before = marks.version;
    draw(mesh);
    expect(marks.version).toBe(before + 1);
    expect(material.uniforms['uMarkCount']!.value).toBe(1);
    expect((bumpsMaterial.uniforms['uMarkGrid']!.value as THREE.Vector2).toArray()).toEqual([7, 5]);
    draw(mesh); // the mounds' draw in the same frame
    expect(marks.version).toBe(before + 1);
    expect(terrain.markStats).toEqual({ count: 1, overflow: 0, maxBin: 1 });
  });

  it('marks off takes no marks; the style reaches the uniforms', () => {
    const terrain = new TerrainRenderer();
    const { material, mesh } = parts(terrain);
    terrain.setGroundMarks(false);
    terrain.beginMarks(7, 5);
    terrain.addMark(MARK);
    draw(mesh);
    expect(material.uniforms['uMarkCount']!.value).toBe(0);
    terrain.setMarkStyle({ ...DEFAULT_MARK_STYLE, plateCorner: 0.2, contactFill: 0.7, plateDashGap: 0 });
    expect((material.uniforms['uPlateStyle']!.value as THREE.Vector4).w).toBeCloseTo(0.2, 12);
    expect((material.uniforms['uContactStyle']!.value as THREE.Vector4).x).toBeCloseTo(0.7, 12);
    expect(material.uniforms['uPlateDashGap']!.value).toBe(0);
  });
});
