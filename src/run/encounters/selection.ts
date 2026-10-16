/**
 * Encounter selection: an encounter and its battlefield for a fight node,
 * from the current sector's pools. The encounter is drawn first, from the
 * sector's pool of the node's encounter kind at the node's hop; then a
 * layout, from the sector's layout pool at that hop kept to the encounter's
 * `layouts` fit-filter. Both draws weigh each entry by its `weight`
 * (`pickWeighted`).
 *
 * Pure: it takes the sector and an id-to-encounter resolver, so it is tested
 * with fixture catalogs; `Run` passes `getEncounter`. A pool draw with
 * nothing to choose throws, and the coverage guard at the foot of this file
 * fails the shipped sectors at load instead, so a run never meets it.
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
import { pickWeighted } from '../sectorWalk';

interface SelectionContext {
  readonly hop: number;
  readonly nodeKind: NodeKind;
}

interface SelectedEncounter {
  readonly encounter: Encounter;
  /** The rolled battlefield: a layout id, or `null` for a procedural map (the
   *  pool's `PROCEDURAL_LAYOUT_ID` entry). */
  readonly layoutId: string | null;
}

/** Resolve a pool `encounterId` to its definition (production: `getEncounter`). */
export type EncounterResolver = (id: string) => Encounter | undefined;

/**
 * The encounter kind each map node kind fights (the node kinds are in
 * `NodeMap.ts`'s header). Rest and port nodes never fight; they map to
 * `normal` only because the table names every kind. An event node fights
 * when its combat roll comes up or no event is eligible
 * (`Run.enterEventNode`), and draws from the normal pool. An event's
 * start-encounter outcome names its fight, which `selectEncounter` takes
 * only when that fight is `normal`: the event loader does not check the
 * kind, so a named elite or boss would be passed over for a normal draw.
 */
const KIND_BY_NODE: Record<NodeKind, EncounterKind> = {
  battle: 'normal',
  boss: 'boss',
  elite: 'elite',
  rest: 'normal',
  port: 'normal',
  event: 'normal',
};

export function encounterKindFor(nodeKind: NodeKind): EncounterKind {
  return KIND_BY_NODE[nodeKind];
}

interface EligibleEntry {
  readonly entry: SectorEncounterEntry;
  readonly encounter: Encounter;
}

/** The sector's pool of `kind` at `hop`, resolved. An id the resolver does not
 *  know is dropped, and the kind check repeats the sector loader's
 *  (`config/sectors.ts`) for a sector built without it, as a test's fixture
 *  is. */
function eligibleEncounters(
  sector: SectorDef,
  hop: number,
  kind: EncounterKind,
  resolve: EncounterResolver,
): EligibleEntry[] {
  return encounterPoolAtHop(sector, hop, kind)
    .map((entry) => ({ entry, encounter: resolve(entry.encounterId) }))
    .filter((x): x is EligibleEntry => x.encounter !== undefined && x.encounter.kind === kind);
}

/** The sector's layout pool at `hop`, kept to the encounter's fit-filter; with
 *  no filter, every entry, the procedural one included. */
function compatibleLayouts(sector: SectorDef, hop: number, encounter: Encounter): readonly SectorLayoutEntry[] {
  const fit = encounter.layouts;
  return layoutPoolAtHop(sector, hop).filter((e) => fit === undefined || fit.includes(e.layoutId));
}

/** Roll a layout from `compatibleLayouts`: its id, or `null` for a procedural
 *  map. Throws when no layout fits. */
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

function encounterFirst(sector: SectorDef, ctx: SelectionContext, rng: RNG, resolve: EncounterResolver): SelectedEncounter {
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
}

/**
 * The forced encounter (`RunConfig.forcedEncounterId`, or an event's
 * start-encounter), taken at a node whose encounter kind matches its own,
 * past the sector's pool and hop gate. Its layout still rolls from the
 * sector's layout pool at the hop, kept to its fit-filter. At a node of
 * another kind it returns `null` and the pool draw runs, so boss and elite
 * nodes keep their own. An unknown id throws, since a typo should fail the
 * run; the run checks a dial's id at construction, and the event loader a
 * named one.
 */
function applyForcedEncounter(
  sector: SectorDef,
  ctx: SelectionContext,
  rng: RNG,
  resolve: EncounterResolver,
  forcedEncounterId: string,
): SelectedEncounter | null {
  const encounter = resolve(forcedEncounterId);
  if (!encounter) {
    throw new Error(`selectEncounter: forced encounter "${forcedEncounterId}" not found`);
  }
  if (encounter.kind !== encounterKindFor(ctx.nodeKind)) return null;
  return { encounter, layoutId: rollLayoutFor(sector, ctx.hop, encounter, rng) };
}

/**
 * Select an encounter and its layout for a fight node. `resolve` maps a
 * pool's `encounterId` to its definition. A `forcedEncounterId` replaces the
 * draw where its kind matches the node's (`applyForcedEncounter`).
 */
export function selectEncounter(
  sector: SectorDef,
  ctx: SelectionContext,
  rng: RNG,
  resolve: EncounterResolver,
  forcedEncounterId?: string,
): SelectedEncounter {
  if (forcedEncounterId !== undefined) {
    const forced = applyForcedEncounter(sector, ctx, rng, resolve, forcedEncounterId);
    if (forced) return forced;
  }
  return encounterFirst(sector, ctx, rng, resolve);
}

/** The node kinds the coverage guard fills, one for each encounter kind, so a
 *  sector must pool a normal, a boss and an elite encounter. An event node's
 *  fight draws the normal pool, which `battle` covers. */
const FIGHTING_NODE_KINDS: readonly NodeKind[] = ['battle', 'boss', 'elite'];

/**
 * The coverage guard: every sector, at every hop of its `length` and for each
 * fighting node kind, must hold an encounter with a layout that fits it, so a
 * pool draw never throws mid-run. The hop gates only open (`minHop`), so a hop
 * past `length` (a `hopCount` override) is covered by the last one. A forced
 * encounter is outside the guard. Run at module load over the shipped sectors
 * (below), and on fixtures in tests.
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

// Fail at load when the shipped pools cannot fill every fight node, rather
// than mid-run.
assertSelectionCoverage(SECTORS, getEncounter);
