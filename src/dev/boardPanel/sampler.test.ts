import { describe, expect, it } from 'vitest';
import { ALL_UNIT_DEFS } from '../../config/units';
import { GLYPHS, atlasCellsFor } from '../../render/glyphs';
import { placePose, type PoseBoard } from './fixtures';
import { codePointName, parseSampler, samplerNewGlyphs } from './sampler';

const open = (gridW: number, gridH: number): PoseBoard => ({ gridW, gridH, isClear: () => true });

describe('the glyph sampler', () => {
  it('reads rows by ;, glyphs by , as one character or a U+ code point, and n: as scenery', () => {
    const spec = parseSampler('?bp=pose-sampler&glyphs=w,W;r,U+E000;n:%23,U+2663&glyphFace=/scratch/t.otf');
    expect(spec).toEqual({
      rows: [
        { scenery: false, glyphs: ['w', 'W'] },
        { scenery: false, glyphs: ['r', ''] },
        { scenery: true, glyphs: ['#', '♣'] },
      ],
      face: '/scratch/t.otf',
      badTokens: [],
    });
  });

  it('names a token that is not one glyph, and reads nothing without glyphs=', () => {
    const spec = parseSampler('?glyphs=ab,U+110000,c,,U+e001');
    expect(spec?.badTokens).toEqual(['ab', 'U+110000']);
    expect(spec?.rows).toEqual([{ scenery: false, glyphs: ['c', ''] }]);
    expect(spec?.face).toBeNull();
    expect(parseSampler('?bp=pose-sampler')).toBeNull();
    expect(codePointName('')).toBe('U+E001');
  });

  it("adds each new glyph once, skips the catalog's, and refuses past the atlas's room", () => {
    const spec = parseSampler('?glyphs=w,M,w;p,q,s')!;
    expect(samplerNewGlyphs(spec)).toEqual({ add: ['w', 'p', 'q'], overRoom: [] });
    const nearlyFull = Array.from({ length: 126 }, (_, i) => String.fromCodePoint(0x4e00 + i));
    expect(samplerNewGlyphs(spec, nearlyFull, 128)).toEqual({ add: ['w', 'M'], overRoom: ['p', 'q', 's'] });
  });

  it("leaves the shipped GLYPHS the catalog's glyphs and the static five", () => {
    expect(GLYPHS.length).toBe(atlasCellsFor(Object.values(ALL_UNIT_DEFS).map((d) => d.glyph)));
  });

  it('poses a row on the enemy side and then the player side, and a scenery row once, in stone', () => {
    const spec = parseSampler('?glyphs=w,W;n:%23')!;
    const { placements, notes } = placePose('sampler', open(15, 15), spec.rows);
    expect(notes).toEqual(['enemy 1 y=7, x=6..7', 'player 1 y=6, x=6..7', 'scenery 2 y=5, x=7..7']);
    expect(placements.map((p) => [p.spec.glyph, p.spec.team, p.cell.x, p.cell.y])).toEqual([
      ['w', 'enemy', 6, 7],
      ['W', 'enemy', 7, 7],
      ['w', 'player', 6, 6],
      ['W', 'player', 7, 6],
      ['#', 'neutral', 7, 5],
    ]);
    expect(placements[4]!.spec.destructible).toBe(false);
  });

  it('says when the board has no row left for a run, and poses nothing without rows', () => {
    const { notes } = placePose('sampler', open(3, 1), parseSampler('?glyphs=a,b')!.rows);
    expect(notes).toEqual(['enemy 1 y=0, x=0..1', 'player 1: no row left with 2 dry tiles in a run']);
    expect(placePose('sampler', open(15, 15)).notes).toEqual(['sampler: no glyphs= in the URL']);
  });
});
