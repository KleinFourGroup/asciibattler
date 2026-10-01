/**
 * THE RUN SLOT: the store's strict section for the one saved run, and the
 * rule for when a save is refused (Round 8 spec D2, D3).
 *
 * A save is rejected when its format changed or when loading it fails, not
 * on every build, so a hotfix upload keeps the runs in progress. The format
 * is `RUN_SCHEMA_VERSION`, and the slot is stamped with it: a slot at any
 * other version is `rejected: stale` before `Run.fromJSON` sees it, and one
 * `fromJSON` throws on (an unknown daemon, character or boss id; damaged
 * data) is `rejected: unreadable`. Either way the stored text stays in
 * place, since a rejected run's journal stays exportable, and the lenient
 * sections beside it are untouched: the player keeps their settings and
 * unlocks.
 *
 * Nothing writes the slot yet; save/load is its first user. This module
 * imports the run model, so the store's boot module must never import it
 * (tests/store-boot.test.ts).
 */

import type { EventBus } from '../core/EventBus';
import type { GameEvents } from '../core/events';
import { t } from '../i18n/ui';
import { RUN_SCHEMA_VERSION, Run, type RunSnapshot } from '../run/Run';
import type { StrictSection } from './store';

/** What the slot stores. The run's journal joins the snapshot here. */
export interface RunSlotWire {
  readonly snapshot: RunSnapshot;
}

/**
 * The slot's section. A loaded run subscribes to `bus`, as `Run.fromJSON`
 * does, so the caller owns it from the read on.
 */
export function runSlotSection(bus: EventBus<GameEvents>): StrictSection<RunSlotWire, Run> {
  return {
    policy: 'strict',
    name: 'run',
    version: RUN_SCHEMA_VERSION,
    load: (wire) => Run.fromJSON(wire.snapshot, bus),
  };
}

/** What the player is told when their saved run is rejected. */
export function runRejectedMessage(): string {
  return t('save.rejected');
}
