import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { EventBus } from '../../src/core/EventBus';
import type { GameEvents } from '../../src/core/events';
import { PHASE_ROWS } from '../../src/dev/probe/drive';
import { RUN_SCHEMA_VERSION, Run, type RunSnapshot } from '../../src/run/Run';

// The save across the map. RunSnapshot stays at v50 when act 1 enters the
// sector map in front of The Start, and the node ids stay with it, so a save
// taken on the two-act map loads onto the map as it is and walks to its end:
// the rest of The Start, then The Deep End. The fixture is such a save,
// recorded once on the two-act map by `scratch/145/record-save.ts` (seed 3,
// no dials, every fight won outright, at the map gate before The Start's
// fifth hop); it is never re-recorded, since a fresh one would be taken on
// the map it is meant to cross. Its fights here are won outright too: the
// question is the walk, not the battles.

const FIXTURE = 'tests/integration/save-across-map.v50.json';
const saved = (): RunSnapshot => JSON.parse(readFileSync(FIXTURE, 'utf8')) as RunSnapshot;

/** Load the save and play it to its end, every fight won; the sectors it
 *  walked, in order, and the phase it ended in. */
function playOut(snap: RunSnapshot): { sectors: string[]; phase: string } {
  const bus = new EventBus<GameEvents>();
  const run = Run.fromJSON(snap, bus);
  const sectors = [run.currentSectorId];
  for (let step = 0; step < 3000; step++) {
    if (sectors[sectors.length - 1] !== run.currentSectorId) sectors.push(run.currentSectorId);
    const row = PHASE_ROWS[run.phase](run, () => 0);
    if (row === 'end') return { sectors, phase: run.phase };
    if (row === 'fight') {
      bus.emit('battle:ended', {
        winner: 'player',
        xpAwards: [],
        survivorPower: { player: 1_000, enemy: 0 },
        fallenPower: { player: 0, enemy: 1_000 },
      });
    } else {
      run.dispatch(row.command);
    }
  }
  throw new Error('save-across-map: 3000 steps without the run ending');
}

describe('a save taken on the two-act map', () => {
  it('is a v50 save, mid-The Start', () => {
    const snap = saved();
    // A Run bump rejects this save by design; this test then becomes the
    // check that it is rejected.
    expect(snap.schemaVersion).toBe(RUN_SCHEMA_VERSION);
    expect(snap.currentSectorId).toBe('the-start');
    expect(snap.currentSectorNodeId).toBe('start');
  });

  it('loads and walks the rest of The Start, then The Deep End, to the win', () => {
    expect(playOut(saved())).toEqual({ sectors: ['the-start', 'the-deep-end'], phase: 'complete' });
  });

  it('fails when its sector-map node is one the map does not have (the control)', () => {
    const snap = saved();
    expect(() => playOut({ ...snap, currentSectorNodeId: 'nowhere' })).toThrow(
      /node "nowhere" has no successor/,
    );
  });
});
