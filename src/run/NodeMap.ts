/**
 * The run's node map: a layered DAG the player crosses one hop at a time.
 * The terminal is the `boss`. In the middle hops sit `rest` nodes (the pool
 * heals and every unit banks XP, `Run.resolveRest`), `elite` nodes (an
 * optional, harder fight from the sector's elite pool), `port` nodes (the
 * shop, at least one a map unless a dial zeroes them; `Run.handleEnterNode`)
 * and `event` nodes (the choose-your-own-adventure stops); every other node
 * is a `battle`.
 *
 * The map is a braid. Lanes, paths from the root to the boss, are the
 * primitive: a hop's width is its number of lanes, and each transition
 * applies split and merge ops between adjacent lanes. Planarity, full
 * connectivity and the degree caps hold by construction: an op splits into
 * or merges at most 3 lanes, ops between adjacent lanes cannot cross, and
 * every node sits on a lane from the root to the boss. The widths pass bounds
 * growth and shrink by `maxOutDegree` while the ops are 2 or 3 lanes wide, so
 * the caps hold only at its shipped 3. The last transition merges every lane
 * into the boss, whose in-degree is the width before it (no group cap there).
 *
 * Three passes, each on its own keyed stream (`nodemapWidths`, `nodemapOps`,
 * `nodemapKinds`) derived from one u32 drawn from the caller's `nodemap`
 * stream, so a change of draw count in one pass never remaps another:
 *
 * 1. Widths: each hop's lane count, within the node budget and the growth
 *    cap, over the braid's shrink floor (`ceil(prev / 3)`), by steps of at
 *    most 2, with no shrink right after growth and no growth into the last
 *    middle hop, where a pair born would have only the boss merge ahead (an
 *    automatic d2).
 * 2. Ops: per transition, the net width change as split2 and merge2 ops,
 *    fused into the rarer 3-ops (`split3Chance`, `merge3Chance`, and forced
 *    when lanes run short); `churnChance` adds split and merge pairs that
 *    keep the width, the source of branch texture, since without churn a
 *    plateau is parallel lanes that never meet. Ops are assigned to lanes by
 *    a bounded shuffle search under the seam rule: every split opens a seam
 *    between its child lanes, and a merge that closes a seam one hop old is
 *    an instant-d2 diamond, allowed only through `d2RejoinChance` and within
 *    a map budget of 25% of the sibling pairs. A braid over the budget is
 *    rolled again, a bounded number of times.
 * 3. Kinds: quotas against the signed map sheet
 *    (`tests/nodemap-metrics.test.ts`, whose C rows the generator enforces
 *    and whose R rows the quotas push), placed in `placeKinds`'s order of
 *    priority under the battle floor and the path-window spacing (no two
 *    nodes of a kind closer than its `minSpacing` along any route, which
 *    every route inherits from its lanes, since braid edges cross lanes only
 *    at ops). A route target is a sum of route shares. A failed attempt
 *    re-rolls this pass alone, throwing after `kindMaxAttempts`. The kinds
 *    share one pool of slots, so a dial that kills one kind frees slots the
 *    others may take: a dial holds the structure fixed, not the other kinds.
 *
 * A seed's map is `hash(root, pass key)` per pass, with no draw order across
 * passes to keep, so a change to one pass remaps only that pass
 * (`NodeMap.test.ts` holds the structure fixed under a scatter dial).
 */

import { RNG, deriveRng } from '../core/RNG';
import { NODE_MAP } from '../config/nodemap';
import type { RunConfig } from './RunConfig';

export type NodeKind = 'battle' | 'rest' | 'boss' | 'elite' | 'port' | 'event';

/**
 * The pre-root start position. A run begins here (no node entered yet),
 * with the root as its only frontier, so the root is a *selectable* first
 * encounter rather than an inert starting cell. No real node ever carries this
 * id (ids start at 0), so it's an unambiguous sentinel for `Run.currentNodeId`.
 */
export const PRE_ROOT_NODE_ID = -1;

export interface MapNode {
  readonly id: number;
  readonly hop: number;
  readonly kind: NodeKind;
}

export interface MapEdge {
  readonly from: number;
  readonly to: number;
}

export interface NodeMap {
  readonly nodes: readonly MapNode[];
  readonly edges: readonly MapEdge[];
  readonly rootId: number;
  readonly terminalId: number;
  /** Node ids grouped by hop index; `hops[f]` are the ids on hop `f`. */
  readonly hops: readonly (readonly number[])[];
}

// The shape's parameters, from config/nodemap.json.
const {
  hopCount: HOP_COUNT,
  middleWidthMin: MIDDLE_WIDTH_MIN,
  middleWidthMax: MIDDLE_WIDTH_MAX,
  targetTotalMax: TARGET_TOTAL_MAX,
  maxOutDegree: MAX_OUT_DEGREE,
  restMinSpacing: REST_MIN_SPACING,
  eliteChance: ELITE_CHANCE_ANCHOR,
  eliteMinSpacing: ELITE_MIN_SPACING,
  portChance: PORT_CHANCE_ANCHOR,
  portMinSpacing: PORT_MIN_SPACING,
  eventChance: EVENT_CHANCE_ANCHOR,
  eventMinSpacing: EVENT_MIN_SPACING,
  churnChance: CHURN_CHANCE,
  split3Chance: SPLIT3_CHANCE,
  merge3Chance: MERGE3_CHANCE,
  d2RejoinChance: D2_REJOIN_CHANCE,
  restRouteTarget: REST_ROUTE_TARGET,
  eliteRouteTarget: ELITE_ROUTE_TARGET,
  portRouteTarget: PORT_ROUTE_TARGET,
  eventsPerRoute: EVENTS_PER_ROUTE,
  eventsBandHalfWidth: EVENTS_BAND_HALF_WIDTH,
  kindMaxAttempts: KIND_MAX_ATTEMPTS,
  preEliteRestWeight: PRE_ELITE_REST_WEIGHT,
  preBossRestWeight: PRE_BOSS_REST_WEIGHT,
} = NODE_MAP;

/** The port-cone window: every first choice's cone gets a port by this hop
 *  (the sheet's rows for a port by hop 5 and for no first choice locked out
 *  of ports), clamped to the band on short maps. Set by the signed sheet,
 *  not a tunable. */
const PORT_GUARANTEE_HOP = 5;

/** The d2 budget: instant-rejoin closures never exceed this share of the
 *  sibling pairs born so far (the sheet's 25% cap), checked as the braid
 *  grows, which is conservative since later pairs only add to the
 *  denominator. */
const D2_BUDGET_FRACTION = 0.25;

/** The arrangement search per transition: bounded, with a deterministic
 *  fallback, never an open re-roll. */
const ARRANGEMENT_ATTEMPTS = 24;

/** The braid re-rolls against the per-map d2 cap (`generate`, pass 2). */
const OPS_MAX_ATTEMPTS = 20;

/** Width smoothing: a transition changes the width by at most 2. A sawtooth
 *  (2→6→2, seen at seed 14) forces mass split3s merged straight back as
 *  merge3s, six d2 closures no re-roll of the ops can avoid, which breaks
 *  the 25% cap by structure. Gentle slopes keep forced merges rare enough
 *  for the seam rule to route around siblings. */
const WIDTH_MAX_STEP = 2;

/** A lane = one active root→boss path strand. `group`/`bornAt` implement the
 *  seam rule: children of one split share a `group` and record the hop they
 *  were born on; a merge containing two same-group lanes with
 *  `bornAt === <parent hop>` closes an age-1 seam (an instant-d2 diamond). */
interface Lane {
  readonly node: number;
  readonly group: number; // -1 = not a split child (root, merge results)
  readonly bornAt: number;
}

type OpToken = 'c' | 's2' | 's3' | 'm2' | 'm3';

export function generate(rng: RNG, config?: RunConfig, lengthOverride?: number): NodeMap {
  // A RunConfig's `hopCount`, `mapMaxWidth` and three scatter chances
  // override config/nodemap.json; the rest of the shape is the JSON's.
  // `lengthOverride` is the current sector's `length`, and the precedence is
  // the config, then the sector, then the JSON, so `?hops=N` always wins.
  const hopCount = config?.hopCount ?? lengthOverride ?? HOP_COUNT;
  const maxWidth = config?.mapMaxWidth ?? MIDDLE_WIDTH_MAX;
  const eliteChance = config?.eliteChance ?? ELITE_CHANCE_ANCHOR;
  const portChance = config?.portChance ?? PORT_CHANCE_ANCHOR;
  const eventChance = config?.eventChance ?? EVENT_CHANCE_ANCHOR;

  // One draw off the caller's stream defines the LOCAL derivation root for
  // the pass sub-streams (see header). `int(0, 0xffffffff)` recovers the
  // stream's raw u32 exactly (next() is u32 / 2^32).
  const root = rng.int(0, 0xffffffff);
  const widthsRng = deriveRng(root, 'nodemapWidths');
  // (the ops and kinds sub-streams are derived per attempt in passes 2 and 3)

  // ---- Pass 1: widths ----------------------------------------------------
  const widths: number[] = [];
  {
    let placedSoFar = 0;
    let prevWidth = 1; // hop 0 is the single root node
    let prevDelta = 0;
    for (let f = 0; f < hopCount; f++) {
      let width: number;
      if (f === 0 || f === hopCount - 1) {
        width = 1;
      } else {
        const remainingMiddleHops = hopCount - 2 - f;
        const minNodesAfter = remainingMiddleHops * MIDDLE_WIDTH_MIN + 1;
        const budget = TARGET_TOTAL_MAX - placedSoFar - minNodesAfter;
        // Growth cap `prev·D` (every lane can at most D-split) and shrink
        // floor `ceil(prev/D)` (adjacent merge groups cap at D) are the
        // braid's feasibility envelope; ±WIDTH_MAX_STEP smooths the slope.
        let cap = Math.max(
          MIDDLE_WIDTH_MIN,
          Math.min(maxWidth, budget, prevWidth * MAX_OUT_DEGREE, prevWidth + WIDTH_MAX_STEP),
        );
        if (f === hopCount - 2) {
          // No growth into the LAST middle hop: a sibling pair born there
          // has only the boss merge ahead of it — an automatic d2 rejoin.
          // (Churn is suppressed on that transition for the same reason.)
          cap = Math.min(cap, Math.max(prevWidth, MIDDLE_WIDTH_MIN));
        }
        const floorFeasible = Math.max(MIDDLE_WIDTH_MIN, Math.ceil(prevWidth / MAX_OUT_DEGREE));
        if (floorFeasible > cap) {
          // Reachable only through extreme overrides (a huge `mapMaxWidth`
          // against a tiny budget): fail loudly rather than emit a width the
          // braid cannot build.
          throw new Error(`NodeMap: hop ${f} width band empty (floor ${floorFeasible} > cap ${cap})`);
        }
        // No shrink RIGHT AFTER growth: pairs born on a growth transition
        // need ≥1 hop of life before a merge wave, or the merges are
        // forced onto siblings (the seed-14 sawtooth). Soft — the budget
        // cap wins if they conflict.
        let floor = Math.max(floorFeasible, prevWidth - WIDTH_MAX_STEP);
        if (prevDelta > 0) floor = Math.max(floor, prevWidth);
        floor = Math.min(floor, cap);
        width = widthsRng.int(floor, cap);
      }
      widths.push(width);
      placedSoFar += width;
      prevDelta = width - prevWidth;
      prevWidth = width;
    }
  }

  // ---- Pass 2: the braid (ops → nodes + edges) ---------------------------
  // A bounded re-roll of the structure: closures forced by capacity (a
  // transition with no clean arrangement) can beat the seam rule's running
  // budget, and a single roll broke the sheet's 25% d2 cap on about 26% of
  // maps when measured. Re-rolling the ops stream by attempt until the final
  // ratio holds makes the C row hold, leaving about 0.26^20; the fallback is
  // the least bad roll, so structure generation never throws.
  let braid: Braid | undefined;
  let leastBad: Braid | undefined;
  let leastBadRatio = Infinity;
  for (let attempt = 0; attempt < OPS_MAX_ATTEMPTS && braid === undefined; attempt++) {
    const cand = buildBraid(hopCount, widths, deriveRng(root, 'nodemapOps', attempt));
    const ratio = cand.pairsBorn === 0 ? 0 : cand.d2Closed / cand.pairsBorn;
    if (ratio < leastBadRatio) {
      leastBad = cand;
      leastBadRatio = ratio;
    }
    if (ratio <= D2_BUDGET_FRACTION) braid = cand;
  }
  const { nodes, edges, hops } = braid ?? leastBad!;

  // ---- Pass 3 continues below (kinds) ------------------------------------
  return finishMap(hopCount, nodes, edges, hops, root, config, {
    eliteChance,
    portChance,
    eventChance,
  });
}

/** One braid roll: nodes + edges + hops + the d2 bookkeeping the re-roll
 *  loop judges (pairsBorn = sibling pairs opened; d2Closed = pairs closed
 *  at the minimum rejoin distance). */
interface Braid {
  readonly nodes: MapNode[];
  readonly edges: MapEdge[];
  readonly hops: number[][];
  readonly pairsBorn: number;
  readonly d2Closed: number;
}

function buildBraid(hopCount: number, widths: readonly number[], rng: RNG): Braid {
  const nodes: MapNode[] = [];
  const edges: MapEdge[] = [];
  const hops: number[][] = [];
  let nextId = 0;
  const newNode = (hop: number): number => {
    const id = nextId++;
    nodes.push({ id, hop, kind: 'battle' });
    return id;
  };

  hops.push([newNode(0)]);
  let lanes: Lane[] = [{ node: 0, group: -1, bornAt: 0 }];
  let nextGroup = 0;
  let pairsBorn = 0; // sibling pairs opened by splits (split2 = 1, split3 = 3)
  let d2Closed = 0; //  pairs closed at the minimum distance (the budget's numerator)

  for (let f = 0; f + 1 < hopCount; f++) {
    const m = lanes.length;
    const n = widths[f + 1]!;
    const childHop = f + 1;

    if (childHop === hopCount - 1) {
      // The boss transition merges every lane (the header). Pairs a hop old
      // are counted all the same: the width clamp makes them impossible but
      // at degenerate lengths (`hopCount` 3, where the root's split has
      // nowhere else to rejoin).
      for (let a = 0; a < lanes.length; a++) {
        for (let b = a + 1; b < lanes.length; b++) {
          const la = lanes[a]!;
          const lb = lanes[b]!;
          if (la.group >= 0 && la.group === lb.group && la.bornAt === f) d2Closed++;
        }
      }
      const child = newNode(childHop);
      for (const lane of lanes) edges.push({ from: lane.node, to: child });
      hops.push([child]);
      lanes = [{ node: child, group: -1, bornAt: childHop }];
      continue;
    }

    // Op counts: realize the net delta, then fuse/churn.
    let s2 = Math.max(n - m, 0);
    let s3 = 0;
    let m2 = Math.max(m - n, 0);
    let m3 = 0;
    const laneNeed = () => s2 + s3 + 2 * m2 + 3 * m3;
    // Forced 3-op fusing when lanes run short; two 2-ops make one 3-op on
    // either axis, so the width change is kept.
    while (laneNeed() > m && m2 >= 2) {
      m2 -= 2;
      m3 += 1;
    }
    while (laneNeed() > m && s2 >= 2) {
      s2 -= 2;
      s3 += 1;
    }
    if (laneNeed() > m) {
      throw new Error(`NodeMap: transition ${f}→${childHop} infeasible (${m}→${n} lanes)`);
    }
    // Churn: split and merge pairs that keep the width, geometric on
    // `churnChance` and bounded by the lanes. None into the last middle hop
    // (the widths pass).
    if (childHop !== hopCount - 2) {
      while (laneNeed() + 3 <= m && rng.next() < CHURN_CHANCE) {
        s2 += 1;
        m2 += 1;
      }
    }
    // 3-op upgrades, one check per axis per transition, so they stay rare.
    if (s2 >= 2 && rng.next() < SPLIT3_CHANCE) {
      s2 -= 2;
      s3 += 1;
    }
    if (m2 >= 2 && rng.next() < MERGE3_CHANCE) {
      m2 -= 2;
      m3 += 1;
    }

    // Token bag → bounded shuffle search under the seam rule.
    const tokens: OpToken[] = [];
    for (let i = 0; i < s3; i++) tokens.push('s3');
    for (let i = 0; i < s2; i++) tokens.push('s2');
    for (let i = 0; i < m3; i++) tokens.push('m3');
    for (let i = 0; i < m2; i++) tokens.push('m2');
    const nContinue = m - laneNeed();
    for (let i = 0; i < nContinue; i++) tokens.push('c');

    const closuresOf = (order: readonly OpToken[]): number => {
      let lane = 0;
      let closures = 0;
      for (const t of order) {
        const size = t === 'm2' ? 2 : t === 'm3' ? 3 : 1;
        if (t === 'm2' || t === 'm3') {
          for (let a = lane; a < lane + size; a++) {
            for (let b = a + 1; b < lane + size; b++) {
              const la = lanes[a]!;
              const lb = lanes[b]!;
              if (la.group >= 0 && la.group === lb.group && la.bornAt === f) closures++;
            }
          }
        }
        lane += size;
      }
      return closures;
    };

    // One decision per transition: may this one deliberately close an age-1
    // seam (a small diamond, texture)? Always inside the map budget.
    const allowD2 = rng.next() < D2_REJOIN_CHANCE;
    let chosen: OpToken[] | undefined;
    let chosenClosures = 0;
    let best: OpToken[] | undefined;
    let bestClosures = Infinity;
    for (let attempt = 0; attempt < ARRANGEMENT_ATTEMPTS && chosen === undefined; attempt++) {
      // A copy: the bag is reused across attempts.
      const cand = tokens.slice();
      rng.shuffle(cand);
      const closures = closuresOf(cand);
      if (closures < bestClosures) {
        best = cand;
        bestClosures = closures;
      }
      if (closures === 0) {
        chosen = cand;
      } else if (
        allowD2 &&
        d2Closed + closures <= Math.floor(D2_BUDGET_FRACTION * pairsBorn)
      ) {
        chosen = cand;
        chosenClosures = closures;
      }
    }
    if (chosen === undefined) {
      // No clean arrangement (capacity forced it): take the least bad
      // candidate and count its closures.
      chosen = best!;
      chosenClosures = bestClosures;
    }
    d2Closed += chosenClosures;

    // Expand the arrangement left→right: lane order IS x-order, so
    // children land in monotone intervals — planar by construction.
    const children: number[] = [];
    const newLanes: Lane[] = [];
    let lane = 0;
    for (const t of chosen) {
      const src = lanes[lane]!;
      if (t === 'c') {
        const child = newNode(childHop);
        edges.push({ from: src.node, to: child });
        newLanes.push({ node: child, group: src.group, bornAt: src.bornAt });
        children.push(child);
        lane += 1;
      } else if (t === 's2' || t === 's3') {
        const k = t === 's2' ? 2 : 3;
        const group = nextGroup++;
        for (let i = 0; i < k; i++) {
          const child = newNode(childHop);
          edges.push({ from: src.node, to: child });
          newLanes.push({ node: child, group, bornAt: childHop });
          children.push(child);
        }
        pairsBorn += k === 2 ? 1 : 3;
        lane += 1;
      } else {
        const k = t === 'm2' ? 2 : 3;
        const child = newNode(childHop);
        for (let i = 0; i < k; i++) {
          edges.push({ from: lanes[lane + i]!.node, to: child });
        }
        newLanes.push({ node: child, group: -1, bornAt: childHop });
        children.push(child);
        lane += k;
      }
    }
    hops.push(children);
    lanes = newLanes;
  }

  return { nodes, edges, hops, pairsBorn, d2Closed };
}

// ---- Pass 3: kinds, the quota layer --------------------------------------
// Placement by quota against the signed sheet, in `placeKinds`'s order of
// priority. A scatter dial `d` scales its kind's route target by
// `d / anchor`, where the anchor is the JSON's chance: 0 kills the kind,
// its guarantees included (the probe's isolation arms), and 1 floods it.
// A failure re-rolls this pass alone, a bounded number of times; the throw
// should be unreachable on a feasible config.
function finishMap(
  hopCount: number,
  nodes: readonly MapNode[],
  edges: readonly MapEdge[],
  hops: readonly (readonly number[])[],
  root: number,
  config: RunConfig | undefined,
  chances: { eliteChance: number; portChance: number; eventChance: number },
): NodeMap {
  const { eliteChance, portChance, eventChance } = chances;
  const bossId = hops[hopCount - 1]![0]!;
  const structure = analyzeStructure(hops, edges, hopCount);
  const eliteScale = eliteChance / ELITE_CHANCE_ANCHOR;
  const portScale = portChance / PORT_CHANCE_ANCHOR;
  const eventScale = eventChance / EVENT_CHANCE_ANCHOR;
  let placed: KindPlacement | null = null;
  for (let attempt = 0; attempt < KIND_MAX_ATTEMPTS && placed === null; attempt++) {
    placed = placeKinds(
      structure,
      deriveRng(root, 'nodemapKinds', attempt),
      { eliteScale, portScale, eventScale },
    );
  }
  if (placed === null) {
    throw new Error(
      `NodeMap: kind placement failed after ${KIND_MAX_ATTEMPTS} attempts (structure infeasible for the quotas)`,
    );
  }
  const { restIds, eliteIds, portIds, eventIds } = placed;

  // At `hopCount` 1 the root is the terminal, so the one node is the `boss`
  // and the player's one fight is the boss. The first-node stamp
  // (`RunConfig.firstNodeKind`) marks the root after every kind pass and
  // draws nothing; the boss wins where the root is the terminal.
  const rootId = hops[0]![0]!;
  const firstNodeStamp = config?.firstNodeKind;
  const kindedNodes: MapNode[] = nodes.map((n) =>
    n.id === bossId
      ? { ...n, kind: 'boss' }
      : firstNodeStamp !== undefined && n.id === rootId
        ? { ...n, kind: firstNodeStamp }
        : restIds.has(n.id)
          ? { ...n, kind: 'rest' }
          : eliteIds.has(n.id)
            ? { ...n, kind: 'elite' }
            : portIds.has(n.id)
              ? { ...n, kind: 'port' }
              : eventIds.has(n.id)
                ? { ...n, kind: 'event' }
                : n,
  );

  return {
    nodes: kindedNodes,
    edges,
    rootId: hops[0]![0]!,
    terminalId: hops[hopCount - 1]![0]!,
    hops,
  };
}

// ---------------------------------------------------------------------------
// The kind-placement engine: pure helpers over the finished braid, every
// draw from the attempt's kinds stream passed in.

interface MapStructure {
  readonly hopCount: number;
  readonly hops: readonly (readonly number[])[];
  readonly parents: ReadonlyMap<number, readonly number[]>;
  readonly children: ReadonlyMap<number, readonly number[]>;
  readonly hopOf: ReadonlyMap<number, number>;
  /** Fraction of root→boss routes passing through each node (exact DP). */
  readonly share: ReadonlyMap<number, number>;
  /** Descendant cone of each hop-1 node (the first choices), incl. itself. */
  readonly cones: ReadonlyMap<number, ReadonlySet<number>>;
  readonly bandStart: number;
  readonly bandEnd: number;
}

interface KindPlacement {
  readonly restIds: Set<number>;
  readonly eliteIds: Set<number>;
  readonly portIds: Set<number>;
  readonly eventIds: Set<number>;
}

function analyzeStructure(
  hops: readonly (readonly number[])[],
  edges: readonly MapEdge[],
  hopCount: number,
): MapStructure {
  const parents = new Map<number, number[]>();
  const children = new Map<number, number[]>();
  for (const e of edges) {
    (children.get(e.from) ?? children.set(e.from, []).get(e.from)!).push(e.to);
    (parents.get(e.to) ?? parents.set(e.to, []).get(e.to)!).push(e.from);
  }
  const hopOf = new Map<number, number>();
  for (let f = 0; f < hops.length; f++) for (const id of hops[f]!) hopOf.set(id, f);
  // Route counts by DP, forward then backward; share = through-routes / total.
  const fromRoot = new Map<number, number>();
  const toBoss = new Map<number, number>();
  for (let f = 0; f < hops.length; f++) {
    for (const id of hops[f]!) {
      const ps = parents.get(id) ?? [];
      fromRoot.set(id, f === 0 ? 1 : ps.reduce((s, p) => s + fromRoot.get(p)!, 0));
    }
  }
  for (let f = hops.length - 1; f >= 0; f--) {
    for (const id of hops[f]!) {
      const cs = children.get(id) ?? [];
      toBoss.set(id, f === hops.length - 1 ? 1 : cs.reduce((s, c) => s + toBoss.get(c)!, 0));
    }
  }
  const total = fromRoot.get(hops[hops.length - 1]![0]!)!;
  const share = new Map<number, number>();
  for (const [id] of hopOf) share.set(id, (fromRoot.get(id)! * toBoss.get(id)!) / total);
  // First-choice cones: BFS descendants of each hop-1 node.
  const cones = new Map<number, Set<number>>();
  for (const first of hops[1] ?? []) {
    const cone = new Set<number>();
    const stack = [first];
    while (stack.length) {
      const cur = stack.pop()!;
      if (cone.has(cur)) continue;
      cone.add(cur);
      for (const c of children.get(cur) ?? []) stack.push(c);
    }
    cones.set(first, cone);
  }
  return {
    hopCount,
    hops,
    parents,
    children,
    hopOf,
    share,
    cones,
    bandStart: 2,
    bandEnd: hopCount - 2,
  };
}

/**
 * One placement attempt. Returns null only on the retryable failure, the
 * port-cone pass finding no candidate; a quota short for lack of slots (a
 * narrow or short structure) is accepted, since a re-roll cannot make
 * slots and a dev shape must never throw.
 */
function placeKinds(
  s: MapStructure,
  rng: RNG,
  scales: { eliteScale: number; portScale: number; eventScale: number },
): KindPlacement | null {
  const out: KindPlacement = {
    restIds: new Set(),
    eliteIds: new Set(),
    portIds: new Set(),
    eventIds: new Set(),
  };
  if (s.bandEnd < s.bandStart) return out; // no eligible band (hopCount <= 3)

  const kindAt = new Map<number, NodeKind>();
  const specialsAt = new Map<number, number>(); // hop -> specials placed
  const shareSum = { rest: 0, elite: 0, port: 0, event: 0 };
  const widthOf = (f: number): number => s.hops[f]!.length;
  const slotFree = (id: number): boolean => {
    const f = s.hopOf.get(id)!;
    if (f < s.bandStart || f > s.bandEnd) return false;
    if (kindAt.has(id)) return false;
    // The battle floor, a C row: at least one battle on every middle hop.
    return (specialsAt.get(f) ?? 0) < widthOf(f) - 1;
  };
  /** The path-window spacing: no node of the kind within `spacing − 1` hops
   *  along any route, searched both ways. At the shipped spacings a rest or
   *  elite is never next to another on a route (2), a port has two hops
   *  clear (3), and events may sit back to back (1). */
  const windowClear = (id: number, kind: NodeKind, spacing: number): boolean => {
    const depth = spacing - 1;
    if (depth <= 0) return true;
    for (const adj of [s.parents, s.children]) {
      let frontier = [id];
      for (let d = 0; d < depth; d++) {
        const next: number[] = [];
        for (const cur of frontier) {
          for (const nb of adj.get(cur) ?? []) {
            if (kindAt.get(nb) === kind) return false;
            next.push(nb);
          }
        }
        frontier = next;
      }
    }
    return true;
  };
  const place = (id: number, kind: 'rest' | 'elite' | 'port' | 'event'): void => {
    kindAt.set(id, kind);
    const f = s.hopOf.get(id)!;
    specialsAt.set(f, (specialsAt.get(f) ?? 0) + 1);
    shareSum[kind] += s.share.get(id)!;
    out[`${kind}Ids`].add(id);
  };
  /** Band nodes in deterministic (hop, x) order. */
  const bandNodes: number[] = [];
  for (let f = s.bandStart; f <= s.bandEnd; f++) bandNodes.push(...s.hops[f]!);

  // The order of placement: the hard guarantees first (port cones, presence
  // floors), then the signed events band, the cone repair, and the route
  // targets with whatever slots remain. On a narrow structure the targets
  // under-fill, never the signed rows: with the top-ups first, 5% of maps
  // fell below the events band.

  // -- 1. Port cone coverage (two C rows), on a real sector map only (at
  //    least 3 band hops); a degenerate dev shape takes quotas alone.
  if (scales.portScale > 0 && s.bandEnd - s.bandStart >= 2) {
    const windowMax = Math.min(PORT_GUARANTEE_HOP, s.bandEnd);
    const coveredBy = (id: number): number[] =>
      [...s.cones.entries()].filter(([, cone]) => cone.has(id)).map(([c]) => c);
    const uncovered = new Set(s.cones.keys());
    while (uncovered.size > 0) {
      const inWindow = bandNodes.filter(
        (id) => s.hopOf.get(id)! <= windowMax && slotFree(id) &&
          coveredBy(id).some((c) => uncovered.has(c)),
      );
      // Guarantee beats pacing: prefer spaced candidates, fall back to any.
      const spaced = inWindow.filter((id) => windowClear(id, 'port', PORT_MIN_SPACING));
      const pool = spaced.length > 0 ? spaced : inWindow;
      if (pool.length === 0) return null; // retryable: re-rolled picks may cover differently
      let bestCover = 0;
      for (const id of pool) {
        const cover = coveredBy(id).filter((c) => uncovered.has(c)).length;
        if (cover > bestCover) bestCover = cover;
      }
      const best = pool.filter(
        (id) => coveredBy(id).filter((c) => uncovered.has(c)).length === bestCover,
      );
      const pick = best[rng.int(0, best.length - 1)]!;
      place(pick, 'port');
      for (const c of coveredBy(pick)) uncovered.delete(c);
    }
  }

  /** The rest top-ups' pacing biases, two of the signed pacing rules: toward
   *  the hops before a placed elite, and more so before the boss. */
  const restBias = (id: number): number => {
    let w = 1;
    if (nearKind(s, kindAt, id, 'elite')) w *= PRE_ELITE_REST_WEIGHT;
    if (s.hopOf.get(id)! >= s.hopCount - 3) w *= PRE_BOSS_REST_WEIGHT;
    return w;
  };
  /** The presence floor: one node of the kind, from candidate pools tried
   *  in turn, early and spaced, then spaced, then any. The hard early window
   *  (hops up to 5) is what holds the by-hop-5 R rows; a soft early weight
   *  reached 87% against the signed 90%. */
  const placeFloor = (kind: 'rest' | 'elite' | 'port', spacing: number): void => {
    if (out[`${kind}Ids`].size >= 1) return;
    const pools = [
      bandNodes.filter(
        (id) =>
          s.hopOf.get(id)! <= PORT_GUARANTEE_HOP && slotFree(id) && windowClear(id, kind, spacing),
      ),
      bandNodes.filter((id) => slotFree(id) && windowClear(id, kind, spacing)),
      bandNodes.filter((id) => slotFree(id)), // floor beats pacing
    ];
    for (const pool of pools) {
      if (pool.length > 0) {
        place(pool[rng.int(0, pool.length - 1)]!, kind);
        return;
      }
    }
    // No slot at all (a tiny structure): accepted.
  };
  /** Top up toward the share target, spaced only, as far as the slots go. */
  const fillTarget = (
    kind: 'rest' | 'elite' | 'port',
    spacing: number,
    target: number,
    weightOf: (id: number) => number,
  ): void => {
    while (shareSum[kind] < target) {
      const cands = bandNodes.filter((id) => slotFree(id) && windowClear(id, kind, spacing));
      if (cands.length === 0) break; // out of slots (a tiny or narrow structure)
      const weights = cands.map(weightOf);
      place(cands[weightedPick(weights, rng)]!, kind);
    }
  };

  // -- 2. Presence floors. The port first: one port a map must hold on the
  //    short maps where the cone pass is skipped, since a portless 4-hop
  //    map empties the fuzz's economy arm. Then elite before rest, so the
  //    rest top-ups can see the placed elites (the before-elite bias).
  //    Floors are hard picks in the early window.
  if (scales.portScale > 0) placeFloor('port', PORT_MIN_SPACING);
  if (scales.eliteScale > 0) placeFloor('elite', ELITE_MIN_SPACING);
  placeFloor('rest', REST_MIN_SPACING);

  // -- 3. Events to the signed band, back to back allowed (spacing 1 is an
  //    empty window). Weight is share × spread: the share makes each slot
  //    count on a tight map, the spread keeps events from clumping.
  if (scales.eventScale > 0) {
    const target = EVENTS_PER_ROUTE * scales.eventScale;
    const ceiling = target + EVENTS_BAND_HALF_WIDTH;
    while (shareSum.event < target) {
      const cands = bandNodes.filter(
        (id) => slotFree(id) && windowClear(id, 'event', EVENT_MIN_SPACING),
      );
      if (cands.length === 0) break; // the band is full, which is not a failure
      const fitting = cands.filter((id) => shareSum.event + s.share.get(id)! <= ceiling);
      if (fitting.length > 0) {
        const weights = fitting.map(
          (id) => s.share.get(id)! / (1 + nearKindCount(s, kindAt, id, 'event')),
        );
        place(fitting[weightedPick(weights, rng)]!, 'event');
      } else {
        if (shareSum.event >= target - EVENTS_BAND_HALF_WIDTH) break; // in the band: stop
        // Below the floor and everything overshoots: take the least overshoot.
        let pick = cands[0]!;
        for (const id of cands) if (s.share.get(id)! < s.share.get(pick)!) pick = id;
        place(pick, 'event');
        break;
      }
    }
  }

  // -- 4. The cone repair (the R rows holding first-choice lockout to 10%):
  //    a first choice locked out of elites or rests gets one, before the
  //    top-ups so the repair is not starved of slots in the cone (with no
  //    repair elite lockout measured 23.4%, and rest lockout 13.8% with the
  //    repair last).
  const repairs: ReadonlyArray<readonly ['elite' | 'rest', number, boolean]> = [
    ['elite', ELITE_MIN_SPACING, scales.eliteScale > 0],
    ['rest', REST_MIN_SPACING, true],
  ];
  for (const [kind, spacing, enabled] of repairs) {
    if (!enabled) continue;
    for (const cone of s.cones.values()) {
      if ([...out[`${kind}Ids`]].some((id) => cone.has(id))) continue;
      let cands = bandNodes.filter(
        (id) => cone.has(id) && slotFree(id) && windowClear(id, kind, spacing),
      );
      if (cands.length === 0) {
        cands = bandNodes.filter((id) => cone.has(id) && slotFree(id));
      }
      if (cands.length === 0) continue; // no slot in the cone: a lockout left
      place(cands[rng.int(0, cands.length - 1)]!, kind);
    }
  }

  // -- 5. The route-target top-ups with the slots left: port, elite, rest.
  const one = (): number => 1;
  if (scales.portScale > 0) {
    fillTarget('port', PORT_MIN_SPACING, PORT_ROUTE_TARGET * scales.portScale, one);
  }
  if (scales.eliteScale > 0) {
    fillTarget('elite', ELITE_MIN_SPACING, ELITE_ROUTE_TARGET * scales.eliteScale, one);
  }
  fillTarget('rest', REST_MIN_SPACING, REST_ROUTE_TARGET, restBias);

  return out;
}

/** Whether a `kind` node sits within 2 hops downstream of `id` (the rest
 *  pass's before-elite bias). */
function nearKind(
  s: MapStructure,
  kindAt: ReadonlyMap<number, NodeKind>,
  id: number,
  kind: NodeKind,
): boolean {
  let frontier = [id];
  for (let d = 0; d < 2; d++) {
    const next: number[] = [];
    for (const cur of frontier) {
      for (const c of s.children.get(cur) ?? []) {
        if (kindAt.get(c) === kind) return true;
        next.push(c);
      }
    }
    frontier = next;
  }
  return false;
}

/** Count of `kind` nodes within 2 hops in either direction (the event
 *  spread weight's denominator). */
function nearKindCount(
  s: MapStructure,
  kindAt: ReadonlyMap<number, NodeKind>,
  id: number,
  kind: NodeKind,
): number {
  let count = 0;
  for (const adj of [s.parents, s.children]) {
    let frontier = [id];
    for (let d = 0; d < 2; d++) {
      const next: number[] = [];
      for (const cur of frontier) {
        for (const nb of adj.get(cur) ?? []) {
          if (kindAt.get(nb) === kind) count++;
          next.push(nb);
        }
      }
      frontier = next;
    }
  }
  return count;
}

/** Weighted index pick; weights must be positive. */
function weightedPick(weights: readonly number[], rng: RNG): number {
  let total = 0;
  for (const w of weights) total += w;
  let r = rng.next() * total;
  for (let i = 0; i < weights.length; i++) {
    r -= weights[i]!;
    if (r <= 0) return i;
  }
  return weights.length - 1;
}

/**
 * Re-kind a finished map's root node, for a sector's `startingEvents`. It
 * draws nothing and touches neither the structure nor any other node, so a
 * stamped map differs from its unstamped twin in the root's `kind` alone.
 * The boss wins where the root is the terminal (`hopCount` 1), as in
 * `generate`'s own stamp. The caller settles which kind takes the root
 * first: the `firstNodeKind` dial beats the sector's stamp, so a probe keeps
 * its isolation.
 */
export function stampRootKind(map: NodeMap, kind: NodeKind): NodeMap {
  if (map.rootId === map.terminalId) return map;
  return {
    ...map,
    nodes: map.nodes.map((n) => (n.id === map.rootId ? { ...n, kind } : n)),
  };
}
