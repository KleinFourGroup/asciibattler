/**
 * The reward roller: an encounter's or a camp's reward refs, each a
 * `{ table, trigger }`, resolved into the portions the reward screen offers.
 * Pure, with every input passed in (the table lookup too, so a test can pass
 * its own tables); `Run` settles the portions.
 *
 * Draws:
 * - Each ref's `chance` is tested on its own, on the table stream. A chance
 *   of 1 costs no draw; anything below 1 draws once, a chance of 0 included.
 * - A table is sampled with `pickWeighted`, which draws nothing on a single
 *   entry and once otherwise (gotcha #111). The owned-daemon exclusion below
 *   makes the draw count depend on what the run owns, which is why rewards
 *   draw from streams of their own (`reward` and `rewardBits`, keyed per
 *   turn boundary in `Run`) and never shift another consumer's draws.
 * - A table the exclusion leaves empty yields nothing for its ref, and must
 *   stop before `pickWeighted`, which would draw on an empty list and return
 *   `undefined`.
 * - Bits roll uniformly from `min` to `max` inclusive, on the bits stream; a
 *   range of one value costs no draw.
 *
 * Exclusions:
 * - A daemon entry whose id the run owns is filtered out before sampling,
 *   since `Run.addDaemon` does not check for duplicates. Ids granted earlier
 *   in the same roll join the exclusion, so one offer never holds the same
 *   daemon twice.
 * - Packet entries have none: duplicates are legal, one cache slot each, and
 *   a full cache is resolved when the portion is accepted (decline it, or
 *   swap a packet out), not when it is sampled, so the cache's state never
 *   changes the draw count.
 */

import type { EncounterRewardRef, RewardTable } from '../config/rewards';
import type { RNG } from '../core/RNG';
import type { UnitTemplate } from '../sim/Unit';
import { rollUnit, type Archetype } from '../sim/archetypes';
import { pickWeighted } from './sectorWalk';

/**
 * One rolled portion of a reward offer:
 * - `bits` — the rolled base. The amount granted is `Run.effectiveBits(base)`,
 *   which the reward screen shows too, so a bits-gain daemon accepted earlier
 *   in the same offer raises the portions after it. `source` names the one
 *   source credited with a battle's bits tally, a daemon or an injected
 *   rule's source; `Run.handleTurnEnded` sets it only when exactly one source
 *   earns battle bits, since the tally cannot be split. It is for display:
 *   the settle ignores it, and this roller never sets it.
 * - `daemon` — a catalog id, settled by `Run.addDaemon`.
 * - `packet` — a catalog id, settled by `Run.addPacket`; with the cache full,
 *   the accept names a packet to swap out.
 * - `unit` — the whole template, rolled at offer time on the bits stream, so
 *   it is saved with the pending offer and the screen shows its real stats;
 *   settled by `Run.appendRosterUnit`.
 * - `poolHealth` — settled through the instant ops, which cap the pool at its
 *   maximum.
 */
export type RewardPortion =
  | { readonly kind: 'bits'; readonly base: number; readonly source?: string }
  | { readonly kind: 'daemon'; readonly daemonId: string }
  | { readonly kind: 'packet'; readonly packetId: string }
  | { readonly kind: 'unit'; readonly template: UnitTemplate }
  | { readonly kind: 'poolHealth'; readonly amount: number };

/**
 * Roll reward refs into portions, in the refs' authored order. `tableById` is
 * the registry's lookup; every authored ref's table is checked at load
 * (`config/encounters.ts`, `camps.ts`, `events.ts`), so a miss here throws
 * rather than skipping.
 */
export function rollRewards(
  refs: readonly EncounterRewardRef[],
  tableById: (id: string) => RewardTable | undefined,
  ownedDaemonIds: ReadonlySet<string>,
  tableRng: RNG,
  bitsRng: RNG,
): RewardPortion[] {
  const portions: RewardPortion[] = [];
  // Owned ids, and ids granted earlier in this roll (the header).
  const excluded = new Set(ownedDaemonIds);
  for (const ref of refs) {
    if (ref.trigger.chance < 1 && tableRng.next() >= ref.trigger.chance) continue;
    const table = tableById(ref.table);
    if (table === undefined) {
      throw new Error(`rollRewards: unknown reward table '${ref.table}'`);
    }
    const eligible = table.entries.filter(
      (e) => e.kind !== 'daemon' || !excluded.has(e.daemon),
    );
    if (eligible.length === 0) continue;
    const entry = pickWeighted(eligible, (e) => e.weight, tableRng);
    if (entry.kind === 'bits') {
      const base = entry.min === entry.max ? entry.min : bitsRng.int(entry.min, entry.max);
      portions.push({ kind: 'bits', base });
    } else if (entry.kind === 'daemon') {
      excluded.add(entry.daemon);
      portions.push({ kind: 'daemon', daemonId: entry.daemon });
    } else if (entry.kind === 'unit') {
      // The template rolls now, on the bits stream. `rollUnit` draws only
      // above level 1, as a one-value bits range draws nothing. No
      // exclusion: duplicate recruits are legal.
      portions.push({
        kind: 'unit',
        template: rollUnit(entry.archetype as Archetype, bitsRng, entry.level ?? 1),
      });
    } else if (entry.kind === 'poolHealth') {
      // A flat heal: no draw, no exclusion; the settle caps it.
      portions.push({ kind: 'poolHealth', amount: entry.amount });
    } else {
      // Packets are sampled with no exclusion (the header) and carry only
      // their id; `Run.addPacket` settles them on accept.
      portions.push({ kind: 'packet', packetId: entry.packet });
    }
  }
  return portions;
}
