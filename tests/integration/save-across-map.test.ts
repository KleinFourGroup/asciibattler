import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { EventBus } from '../../src/core/EventBus';
import type { GameEvents } from '../../src/core/events';
import { RUN_SCHEMA_VERSION, Run, type RunSnapshot } from '../../src/run/Run';
import { memoryAdapter } from '../../src/store/adapter';
import { createStore } from '../../src/store/store';
import { runRejectedMessage, runSlotSection } from '../../src/store/runSlot';

// A v50 save, rejected. The fixture is a save taken on the two-act map,
// recorded once by `scratch/145/record-save.ts` (seed 3, no dials, at the map
// gate before The Start's fifth hop). While RunSnapshot stayed at v50 it was
// the check that such a save loads onto the three-act map and walks to its
// end. The Run bump that narrowed Mars to strength rejects it, as a bump is
// meant to, so it is now the check that a save from `0.3.0`, the build on
// itch at the bump, is refused with the player's message, the stored text
// kept. It is never re-recorded: a fresh save would be at the current version.

const FIXTURE = 'tests/integration/save-across-map.v50.json';
const saved = (): RunSnapshot => JSON.parse(readFileSync(FIXTURE, 'utf8')) as RunSnapshot;
const RUN_KEY = 'asciibattler:run';
/** The store's run slot as a v50 build wrote it: stamped with the save's version. */
const slotText = (v: number, snapshot: RunSnapshot): string =>
  JSON.stringify({ v, build: '0.3.0+273d587d', data: { snapshot, dials: '', journal: null } });

describe('a v50 save, from before Mars was narrowed', () => {
  it('is a v50 save, mid-The Start, and the format has moved past it', () => {
    const snap = saved();
    expect(snap.schemaVersion).toBe(50);
    expect(RUN_SCHEMA_VERSION).toBeGreaterThan(50);
    expect(snap.currentSectorId).toBe('the-start');
  });

  it('Run.fromJSON refuses it', () => {
    expect(() => Run.fromJSON(saved(), new EventBus<GameEvents>())).toThrow(/unsupported schema version 50/);
  });

  it('the run slot rejects it as stale before loading, keeps its text, and the player reads why', () => {
    const text = slotText(50, saved());
    const adapter = memoryAdapter({ [RUN_KEY]: text });
    const store = createStore({ adapter, build: 'b' });
    const read = store.readStrict(runSlotSection(new EventBus<GameEvents>()));
    expect(read).toMatchObject({ status: 'rejected', reason: 'stale', found: 50, raw: text });
    expect(adapter.entries.get(RUN_KEY)).toBe(text);
    expect(runRejectedMessage()).toBe(
      "This run was saved by an older version of the game and can't be continued. Your settings and unlocks are kept.",
    );
  });

  it('the control: the same save stamped at the current version loads', () => {
    const snap = { ...saved(), schemaVersion: RUN_SCHEMA_VERSION } as RunSnapshot;
    const store = createStore({ adapter: memoryAdapter({ [RUN_KEY]: slotText(RUN_SCHEMA_VERSION, snap) }), build: 'b' });
    const read = store.readStrict(runSlotSection(new EventBus<GameEvents>()));
    expect(read.status).toBe('ok');
  });
});
