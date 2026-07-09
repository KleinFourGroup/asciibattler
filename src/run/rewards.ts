/**
 * 48b — the pure reward roller (the `Recruitment.rollOffer` sibling): resolve
 * an encounter's `{table, trigger}` reward refs into the concrete portions the
 * reward screen offers. Pure — all inputs injected (the table lookup too, for
 * synthetic tests); Run owns the state it settles into.
 *
 * Draw discipline (deterministic, the resolveTurnGates lineage):
 * - Each ref's `chance` is tested INDEPENDENTLY on the table stream —
 *   `chance: 1` costs NO draw (the gate-chance discipline, gotcha #115
 *   family); anything below 1 flips once (a `chance: 0` still draws — parse-
 *   legal but pointless authoring, kept simple over special-cased).
 * - Table sampling rides `pickWeighted` (gotcha #111: ZERO draws on a
 *   singleton, one draw otherwise) — so the OWNED-DAEMON EXCLUSION below
 *   makes the draw count filter-dependent, which is exactly why rewards get
 *   their own dedicated streams (never perturbs another consumer).
 * - An EMPTY-after-filter table yields nothing this trigger and MUST
 *   short-circuit before `pickWeighted` (it would both misbehave and burn a
 *   draw on an empty list).
 * - Bits `{min,max}` roll uniformly (integer, inclusive) on the SEPARATE
 *   bits stream; a degenerate range (min == max) costs no draw (the
 *   no-choice-no-entropy property).
 *
 * Exclusion rules:
 * - Daemon entries whose id the run already owns filter out BEFORE sampling
 *   (the spec lock — `addDaemon` never dedupes; exclusion is the caller's
 *   job, and this is the caller). Ids granted EARLIER IN THIS SAME ROLL
 *   accumulate into the exclusion too, so a multi-ref offer can never carry
 *   the same idol twice.
 * - Packet entries have NO exclusion (49c — the wholesale dormancy guard
 *   retired): duplicates are legal (one SLOT each, spec §Cache), and a full
 *   cache resolves at ACCEPT time (decline-or-swap), never at sample time —
 *   a cache-state filter here would make the draw count depend on a UI
 *   concern.
 */

import type { EncounterRewardRef, RewardTable } from '../config/rewards';
import type { RNG } from '../core/RNG';
import { pickWeighted } from './sectorWalk';

/** One rolled, offerable reward portion. Bits carry the ROLLED BASE — the
 *  effective amount derives at display/settle time via `Run.effectiveBits`
 *  (one shared code path, the shape-lock rider), so accepting a bits-fold
 *  daemon EARLIER in the same offer visibly boosts the portions after it.
 *  49c adds the packet member (a catalog id — `Run.addPacket` settles it,
 *  cache-full accepts resolve via the acceptReward swap field). */
export type RewardPortion =
  | { readonly kind: 'bits'; readonly base: number }
  | { readonly kind: 'daemon'; readonly daemonId: string }
  | { readonly kind: 'packet'; readonly packetId: string };

/**
 * Roll an encounter's reward refs into portions (authored ref order — the
 * deterministic evaluation order). `tableById` is the registry lookup
 * (boot-asserted for authored refs, so a miss here is a hard throw, never a
 * silent skip).
 */
export function rollRewards(
  refs: readonly EncounterRewardRef[],
  tableById: (id: string) => RewardTable | undefined,
  ownedDaemonIds: ReadonlySet<string>,
  tableRng: RNG,
  bitsRng: RNG,
): RewardPortion[] {
  const portions: RewardPortion[] = [];
  // Owned ids + ids granted earlier in this same roll (see the header).
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
    } else {
      // 49c — packets sample with no exclusion (see the header) and carry
      // only their id; the settle is `Run.addPacket` at accept time.
      portions.push({ kind: 'packet', packetId: entry.packet });
    }
  }
  return portions;
}
