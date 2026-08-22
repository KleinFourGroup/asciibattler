/**
 * 84b — the POST-SEAM pin for `Run.hopsRemaining`: after a sector advance
 * the read must reflect the NEW sector's map + the DAG remainder from the
 * new position (gotcha #120 — hop is per-sector; the read must be
 * sector-aware). Driven with the rollout walker on a shortened full walk
 * (`sectorHops`), reading at the `sector:cleared` emit — state has already
 * swapped there (the 67a gate shape). Seeds are scanned until one clears
 * the first sector (a walk that dies first exercises nothing).
 */

import { describe, it, expect } from 'vitest';
import { EventBus } from '../../../src/core/EventBus';
import type { GameEvents } from '../../../src/core/events';
import { Run } from '../../../src/run/Run';
import { PRE_ROOT_NODE_ID } from '../../../src/run/NodeMap';
import { cloneRunForRollout } from '../../../src/bot/runRollout';
import { remainingSectorHops } from '../../../src/run/sectorWalk';
import { SECTOR_MAP } from '../../../src/config/sectorMap';
import { getSector } from '../../../src/config/sectors';
import { walkToHorizon } from './walker';

const SECTOR_HOPS = 2;

describe('Run.hopsRemaining — post-seam (the walker-driven pin)', () => {
  it('re-reads the new sector + the DAG remainder at sector:cleared', () => {
    let pinned: { atClear: number; expected: number } | null = null;
    for (let seed = 20260822; seed < 20260822 + 40 && pinned === null; seed++) {
      const live = new Run(seed, new EventBus<GameEvents>(), { sectorHops: SECTOR_HOPS });
      const clone = cloneRunForRollout(live, seed + 1);
      clone.bus.on('sector:cleared', () => {
        const run = clone.run;
        // The new sector's whole map is ahead (pre-root), plus whatever the
        // DAG still holds from the NEW node. NB the clone is a wire
        // round-trip and RunConfig is NOT persisted (Run.fromJSON: "a
        // rehydrated run runs unbounded"), so the first sector kept its
        // 2-hop map (already generated) while the NEW sector regenerated at
        // its AUTHORED length — the read must follow the live map, not the
        // original dial. (A §84 instrument fact: a run-end shadow walks
        // future sectors at authored length whatever the batch's dial.)
        const expected =
          run.nodeMap.hops.length +
          remainingSectorHops(SECTOR_MAP, run.currentSectorNodeId, (id) => getSector(id)!.length);
        expect(run.currentNodeId).toBe(PRE_ROOT_NODE_ID);
        expect(run.nodeMap.hops.length).toBe(getSector(run.currentSectorId)!.length);
        pinned = { atClear: run.hopsRemaining, expected };
      });
      walkToHorizon(clone, { horizonBattles: 9999, policySeed: seed + 2, maxHops: 40 });
    }
    expect(pinned, 'no seed in the scan cleared the first sector').not.toBeNull();
    expect(pinned!.atClear).toBe(pinned!.expected);
    // On the shipped linear map the second sector is the sink: exactly its
    // own (authored-length) map remains.
    expect(pinned!.atClear).toBe(getSector(SECTOR_MAP.nodes[1]!.sectors[0]!)!.length);
  });
});
