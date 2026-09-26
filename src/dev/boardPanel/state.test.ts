import { describe, expect, it } from 'vitest';
import {
  DIALS,
  DIAL_KEYS,
  KNOWN_ARTEFACTS,
  VIEW_DIALS,
  cameraViewOf,
  coerceDial,
  defaultDials,
  encodeDials,
  parseDials,
  spliceBookmark,
  type DialState,
} from './state';
import { DEFAULT_CAMERA_VIEW } from '../../render/cameraFit';
import { DEFAULT_MARK_STYLE } from '../../render/groundMarks';

describe('108b — the terrain marks’ dials', () => {
  it('their defaults ARE the shipped marks — an untouched panel dials nothing', () => {
    expect(DIALS.plateCorner.def).toBe(DEFAULT_MARK_STYLE.plateCorner);
    expect(DIALS.marks.def).toBe(true);
  });

  it('the signed 106d bookmark now means the defaults: its mock dials left at 108f, its anchor dial at 109a', () => {
    const signed = parseDials(
      'cue-outline_cueAlpha-0.3_ground-merged_plate-filled_plateScope-all_anchor-bottom_drape-1_cueDepth-world',
    );
    expect(signed).toEqual(defaultDials());
    expect(encodeDials(signed)).toBe('');
    // …and so do the look dials and the hop: a stop-2 URL keeps only its board.
    expect(encodeDials(parseDials('board-wade_hop-1_markSize-0.7_plateDash-0'))).toBe('board-wade');
  });
});

describe('105e — the glyph scale + the artefact list', () => {
  it('the scale defaults to 1 (the atlas default — an untouched panel writes no size)', () => {
    expect(DIALS.scale.def).toBe(1);
    expect(DIALS.scale.min).toBeGreaterThan(0);
    expect(coerceDial('scale', '1.5')).toBe(1.5);
  });

  it('every known artefact names the dial that shows it, and none is empty', () => {
    expect(KNOWN_ARTEFACTS.length).toBeGreaterThan(0);
    for (const text of KNOWN_ARTEFACTS) {
      expect(text.trim().length, text).toBeGreaterThan(20);
      expect(/^(yaw|glyph scale|ortho|any dial change)/.test(text), text).toBe(true);
    }
  });
});

describe('105d — the projection dials', () => {
  it('the four defaults ARE the Renderer’s default view — an untouched panel is the shipped camera', () => {
    expect(cameraViewOf(defaultDials())).toEqual(DEFAULT_CAMERA_VIEW);
    // …and the view is exactly those four dials: a fifth field on CameraView
    // must pick a dial (or a reason) here.
    expect(Object.keys(DEFAULT_CAMERA_VIEW).length).toBe(VIEW_DIALS.length);
  });

  it('a projection bookmark round-trips, negative yaw included', () => {
    // `persp`: since 107d the shipped default is ortho, so ortho is never written.
    const state = parseDials('proj-persp_fov-20_pitch-60_yaw--45');
    expect(cameraViewOf(state)).toEqual({
      projection: 'perspective',
      fovDeg: 20,
      pitchDeg: 60,
      yawDeg: -45,
    });
    expect(encodeDials(state)).toBe('proj-persp_fov-20_pitch-60_yaw--45');
  });

  it('the §106 bookmark still means the shipped view: its proj and yaw are now the defaults', () => {
    const state = parseDials('proj-ortho_yaw-45_slab-centre');
    expect(cameraViewOf(state)).toEqual(DEFAULT_CAMERA_VIEW);
    // `slab` left the table at 107b; an unknown key is dropped, never thrown on.
    expect(encodeDials(state)).toBe('');
  });

  it('the pitch dial cannot reach the fit’s two singularities (level, overhead)', () => {
    expect(DIALS.pitch.min).toBeGreaterThan(0);
    expect(DIALS.pitch.max).toBeLessThan(90);
    expect(coerceDial('pitch', '90')).toBe(DIALS.pitch.max);
    expect(coerceDial('pitch', '-5')).toBe(DIALS.pitch.min);
  });
});

describe('105b — the board explorer dial table', () => {
  it('the default state is NO bookmark, and no bookmark is the default state', () => {
    expect(encodeDials(defaultDials())).toBe('');
    expect(parseDials(null)).toEqual(defaultDials());
    expect(parseDials('')).toEqual(defaultDials());
  });

  it('every dial key is codec-safe: no pair or key/value separator inside a key', () => {
    for (const key of DIAL_KEYS) expect(key).toMatch(/^[A-Za-z][A-Za-z0-9]*$/);
  });

  it('every non-default value of every dial round-trips through the URL', () => {
    for (const key of DIAL_KEYS) {
      const spec = DIALS[key];
      const values: (string | number | boolean)[] =
        spec.kind === 'enum'
          ? spec.options.filter((o) => o !== spec.def)
          : spec.kind === 'range'
            ? [spec.min, spec.max].filter((v: number) => v !== spec.def)
            : [!spec.def];
      for (const value of values) {
        const state = { ...defaultDials(), [key]: value } as DialState;
        const encoded = encodeDials(state);
        expect(encoded, `${key}=${String(value)}`).not.toBe('');
        expect(parseDials(encoded)).toEqual(state);
        // …and what the address bar holds is what we wrote: nothing escaped.
        expect(new URLSearchParams({ bp: encoded }).toString()).toBe(`bp=${encoded}`);
      }
    }
  });

  it('a whole bookmark round-trips, in table order', () => {
    const state: DialState = {
      ...defaultDials(),
      yaw: 30,
      scale: 1.5,
      plateCorner: 0.1,
      pose: 'row',
    };
    expect(encodeDials(state)).toBe('yaw-30_scale-1.5_plateCorner-0.1_pose-row');
    expect(parseDials(encodeDials(state))).toEqual(state);
  });

  it('a stale bookmark degrades to defaults instead of throwing', () => {
    const parsed = parseDials(
      'anchor-sideways_nope-1_bar_barY-abc_marks-0_-x_pose-sideways_hide-yes',
    );
    expect(parsed).toEqual({ ...defaultDials(), marks: false });
  });

  it('splicing the bookmark leaves every other pair byte-for-byte', () => {
    const typed = '?seed=7&roster=mercenary,archer&layout=river';
    expect(spliceBookmark(typed, 'yaw-30')).toBe(`${typed}&bp=yaw-30`);
    expect(spliceBookmark(`${typed}&bp=pose-row`, 'yaw-30')).toBe(`${typed}&bp=yaw-30`);
    expect(spliceBookmark('?bp=pose-row&seed=7', '')).toBe('?seed=7');
    expect(spliceBookmark('?bp=pose-row', '')).toBe('');
    expect(spliceBookmark('', 'pose-row')).toBe('?bp=pose-row');
    // a param that merely STARTS with the name is someone else's
    expect(spliceBookmark('?bpm=120', '')).toBe('?bpm=120');
  });

  it('a range value is clamped to the dial and snapped to its step', () => {
    const { min, max } = DIALS.plateCorner;
    expect(coerceDial('plateCorner', String(max + 5))).toBe(max);
    expect(coerceDial('plateCorner', String(min - 5))).toBe(min);
    expect(coerceDial('plateCorner', '0.1249')).toBe(0.12);
    expect(coerceDial('plateCorner', 'NaN')).toBeUndefined();
    expect(coerceDial('plateCorner', '')).toBeUndefined();
  });
});
