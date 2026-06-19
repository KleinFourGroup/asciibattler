/**
 * V1 — encounter SELECTION: choose an `(encounter, layout)` pair for a battle
 * node from the current sector's pools. The authored counterpart of U3's
 * hold-one-encounter — selection among the catalog.
 *
 * ONE keyed resolver (config-selected via `SELECTION.strategy`), mirroring O3's
 * `focusTile` — NOT two hard-coded forks:
 *  - `encounterFirst` (default): draw an encounter from the sector's hop-gated
 *    fight pool, filtered by node kind, then roll a layout from the sector's
 *    hop-gated layout pool ∩ the encounter's optional fit-filter.
 *  - `layoutFirst` (switchable, for the playtest A/B): roll a layout first, then
 *    pick a kind-matching encounter that fits it.
 *
 * Pure: takes the sector + an id→Encounter resolver, so it's headless-testable
 * with fixture catalogs (the production wrapper in `Run` injects `getEncounter`).
 * The per-entry pool `weight` is honoured (uniform today — the V-later weighting
 * seam). A resolver that finds no eligible (encounter, layout) THROWS loudly —
 * the boot/editor guard is meant to make that unreachable in shipped content.
 */

import type { RNG } from '../../core/RNG';
import { getEncounter, type Encounter, type EncounterKind } from '../../config/encounters';
import type { NodeKind } from '../NodeMap';
import {
  SECTORS,
  PROCEDURAL_LAYOUT_ID,
  layoutPoolAtHop,
  encounterPoolAtHop,
  type SectorDef,
  type SectorLayoutEntry,
  type SectorEncounterEntry,
} from '../../config/sectors';
import { SELECTION, type SelectionStrategyKey } from '../../config/selection';
import { pickWeighted } from '../sectorWalk';

export interface SelectionContext {
  readonly hop: number;
  readonly nodeKind: NodeKind;
}

export interface SelectedEncounter {
  readonly encounter: Encounter;
  /** The rolled battlefield: a real layout id, or `null` for a procedural map
   *  (the `PROCEDURAL_LAYOUT_ID` sentinel resolved). */
  readonly layoutId: string | null;
}

/** Resolve a pool `encounterId` to its definition (production: `getEncounter`). */
export type EncounterResolver = (id: string) => Encounter | undefined;

type SelectionStrategy = (
  sector: SectorDef,
  ctx: SelectionContext,
  rng: RNG,
  resolve: EncounterResolver,
) => SelectedEncounter;

/**
 * Which encounter kind a map node fights. V1: every fighting node selects a
 * `normal` encounter — there are no boss encounters until W, which re-maps
 * `boss` → `'boss'`. (`elite` map-nodes → `'elite'` is deferred.) `rest` nodes
 * never fight, so they never reach selection.
 */
const KIND_BY_NODE: Record<NodeKind, EncounterKind> = {
  battle: 'normal',
  boss: 'normal', // TODO(W): 'boss' once boss encounters are authored
  rest: 'normal', // rest nodes never fight; defensive default
};

export function encounterKindFor(nodeKind: NodeKind): EncounterKind {
  return KIND_BY_NODE[nodeKind];
}

interface EligibleEntry {
  readonly entry: SectorEncounterEntry;
  readonly encounter: Encounter;
}

/** The sector's hop-gated fight pool, resolved + kept to encounters of `kind`. */
function eligibleEncounters(
  sector: SectorDef,
  hop: number,
  kind: EncounterKind,
  resolve: EncounterResolver,
): EligibleEntry[] {
  return encounterPoolAtHop(sector, hop)
    .map((entry) => ({ entry, encounter: resolve(entry.encounterId) }))
    .filter((x): x is EligibleEntry => x.encounter !== undefined && x.encounter.kind === kind);
}

/** The sector's hop-gated layout pool ∩ the encounter's fit-filter (an omitted
 *  fit-filter admits everything, incl. the procedural sentinel). */
function compatibleLayouts(sector: SectorDef, hop: number, encounter: Encounter): readonly SectorLayoutEntry[] {
  const fit = encounter.layouts;
  return layoutPoolAtHop(sector, hop).filter((e) => fit === undefined || fit.includes(e.layoutId));
}

/** Roll a layout from `compatibleLayouts`. Returns the resolved layout id (`null`
 *  = procedural). Throws if the intersection is empty (the coverage guard should
 *  preclude this in shipped content). */
function rollLayoutFor(sector: SectorDef, hop: number, encounter: Encounter, rng: RNG): string | null {
  const pool = compatibleLayouts(sector, hop, encounter);
  if (pool.length === 0) {
    throw new Error(
      `selectEncounter: encounter "${encounter.id}" has no compatible layout in sector "${sector.id}" at hop ${hop}`,
    );
  }
  const picked = pickWeighted(pool, (e) => e.weight ?? 1, rng);
  return picked.layoutId === PROCEDURAL_LAYOUT_ID ? null : picked.layoutId;
}

const encounterFirst: SelectionStrategy = (sector, ctx, rng, resolve) => {
  const kind = encounterKindFor(ctx.nodeKind);
  const eligible = eligibleEncounters(sector, ctx.hop, kind, resolve);
  if (eligible.length === 0) {
    throw new Error(
      `selectEncounter(encounterFirst): no '${kind}' encounter in sector "${sector.id}" at hop ${ctx.hop}`,
    );
  }
  const picked = pickWeighted(eligible, (x) => x.entry.weight ?? 1, rng);
  const layoutId = rollLayoutFor(sector, ctx.hop, picked.encounter, rng);
  return { encounter: picked.encounter, layoutId };
};

const layoutFirst: SelectionStrategy = (sector, ctx, rng, resolve) => {
  const kind = encounterKindFor(ctx.nodeKind);
  // Roll the layout from the full hop-gated pool first (geometry-led).
  const layoutEntry = pickWeighted(layoutPoolAtHop(sector, ctx.hop), (e) => e.weight ?? 1, rng);
  const layoutId = layoutEntry.layoutId === PROCEDURAL_LAYOUT_ID ? null : layoutEntry.layoutId;
  // Then a kind-matching encounter whose fit-filter admits the rolled layout (an
  // omitted fit-filter admits anything, incl. the procedural sentinel).
  const eligible = eligibleEncounters(sector, ctx.hop, kind, resolve).filter(
    (x) => x.encounter.layouts === undefined || x.encounter.layouts.includes(layoutEntry.layoutId),
  );
  if (eligible.length === 0) {
    throw new Error(
      `selectEncounter(layoutFirst): no '${kind}' encounter fits layout "${layoutEntry.layoutId}" in sector "${sector.id}" at hop ${ctx.hop}`,
    );
  }
  const picked = pickWeighted(eligible, (x) => x.entry.weight ?? 1, rng);
  return { encounter: picked.encounter, layoutId };
};

const STRATEGIES: Record<SelectionStrategyKey, SelectionStrategy> = {
  encounterFirst,
  layoutFirst,
};

/** The strategy for `key` (mirrors `getFocusTileResolution`) — lets tests
 *  exercise a strategy directly without mutating the shipped config. */
export function getSelectionStrategy(key: SelectionStrategyKey): SelectionStrategy {
  return STRATEGIES[key];
}

/**
 * Select an `(encounter, layout)` for a battle node via the live config strategy
 * (`SELECTION.strategy`, read each call so a hot-reloaded `config/selection.json`
 * applies). `resolve` maps a pool `encounterId` to its definition (`Run` passes
 * `getEncounter`).
 */
export function selectEncounter(
  sector: SectorDef,
  ctx: SelectionContext,
  rng: RNG,
  resolve: EncounterResolver,
): SelectedEncounter {
  return STRATEGIES[SELECTION.strategy](sector, ctx, rng, resolve);
}

/** Map-node kinds that select an encounter (rest nodes never fight). */
const FIGHTING_NODE_KINDS: readonly NodeKind[] = ['battle', 'boss'];

/**
 * Boot/editor guard (the A4 loud-failure pattern): every (sector, reachable hop,
 * fighting node kind) must have ≥ 1 eligible encounter with a non-empty layout
 * intersection — so `selectEncounter` never throws mid-run. Called at module load
 * over the shipped config (below); also exercisable on fixtures in tests. (It is
 * resolution-order-agnostic: feasibility of the eligible set + a compatible layout
 * is necessary for either strategy.)
 */
export function assertSelectionCoverage(
  sectors: readonly SectorDef[],
  resolve: EncounterResolver,
): void {
  for (const sector of sectors) {
    for (let hop = 0; hop < sector.length; hop++) {
      for (const nodeKind of FIGHTING_NODE_KINDS) {
        const kind = encounterKindFor(nodeKind);
        const eligible = eligibleEncounters(sector, hop, kind, resolve);
        const selectable = eligible.some((x) => compatibleLayouts(sector, hop, x.encounter).length > 0);
        if (!selectable) {
          throw new Error(
            `selection coverage: sector "${sector.id}" hop ${hop} kind '${kind}' has no selectable encounter with a compatible layout`,
          );
        }
      }
    }
  }
}

// Boot guard: fail loudly at load if the shipped catalog can't fill every battle
// node (mis-authored content shouldn't surface as a mid-run throw).
assertSelectionCoverage(SECTORS, getEncounter);
