import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { GroundCues, type CueSubject } from './groundCue';
import { defaultDials, type DialState } from './state';

/** 106c — the `ground` dial's semantics, as mesh counts on a bare scene. */

const PLAYER: CueSubject = { team: 'player', archetype: 'mercenary', campId: null };
const SCENERY: CueSubject = { team: 'neutral', archetype: 'rubble_2x2', campId: null };
const at = new THREE.Vector3(0, 0, 0);

function marks(dials: Partial<DialState>, draw: (cues: GroundCues, d: DialState) => void): number {
  const cues = new GroundCues(new THREE.Scene());
  const d = { ...defaultDials(), ...dials };
  cues.beginFrame();
  draw(cues, d);
  cues.endFrame();
  return cues.count;
}

describe('106c — the ground mark', () => {
  it('an untouched panel draws no mark (ground-cue with the cue off is 105b’s board)', () => {
    expect(marks({}, (c, d) => c.place('u', PLAYER, at, 1, d))).toBe(0);
    expect(marks({}, (c, d) => c.placePlate('n', SCENERY, at, 2, d))).toBe(0);
  });

  it('one mesh per mark: cue 1 · shadow 1 · both 2 · merged 2 (one mark, two layers)', () => {
    const place = (c: GroundCues, d: DialState): void => c.place('u', PLAYER, at, 1, d);
    expect(marks({ ground: 'cue', cue: 'outline' }, place)).toBe(1);
    expect(marks({ ground: 'shadow' }, place)).toBe(1);
    expect(marks({ ground: 'both' }, place)).toBe(2);
    expect(marks({ ground: 'merged' }, place)).toBe(2);
  });

  it('scenery gets no mark in any mode — only the plate marks it', () => {
    for (const ground of ['cue', 'shadow', 'both', 'merged'] as const) {
      expect(marks({ ground, cue: 'outline' }, (c, d) => c.place('u', SCENERY, at, 2, d))).toBe(0);
    }
    expect(marks({ plate: 'frame' }, (c, d) => c.placePlate('n', SCENERY, at, 2, d))).toBe(1);
    expect(marks({ plate: 'filled' }, (c, d) => c.placePlate('n', SCENERY, at, 2, d))).toBe(2);
  });

  it('a mark not placed in a frame is dropped at its end', () => {
    const cues = new GroundCues(new THREE.Scene());
    const d = { ...defaultDials(), ground: 'both' as const };
    cues.beginFrame();
    cues.place('u', PLAYER, at, 1, d);
    cues.endFrame();
    expect(cues.count).toBe(2);
    cues.beginFrame();
    cues.endFrame();
    expect(cues.count).toBe(0);
  });
});
