/**
 * Run-level node map: a layered DAG the player traverses one hop at a time.
 * Node kinds: the terminal is a `boss` (G3); `rest` nodes scatter through the
 * middle hops (a non-combat XP grant — see `Run.resolveRest`, G3); `elite` nodes
 * also scatter the middle hops (W2 — an optional, harder fight, selected from
 * the sector's elite encounter pool); `port` nodes scatter there too (50c —
 * the shop dock, ≥1 guaranteed per map; see `Run.handleEnterNode`); `event`
 * nodes are the choose-your-own-adventure stops (74b/74e).
 *
 * 77e1 — THE BRAID (worklog §77e; replaces the G2 staircase-interval sweep).
 * Lanes (root→boss path objects) are the first-class primitive: hop width =
 * the number of active lanes, and each hop transition applies split/merge
 * ops between ADJACENT lanes. Planarity, full connectivity, and the degree
 * caps are free by construction — a split is out-degree ≤ 3, a merge is
 * in-degree ≤ 3 (`maxOutDegree` doubles as the op group cap), adjacent-only
 * ops cannot cross, and every node sits on a lane that runs root→boss. The
 * final transition is a merge-all into the boss (in-degree = the penultimate
 * width, matching the old generator's fan-in; group caps exempt).
 *
 * Passes, each on its OWN keyed sub-stream (`nodemapWidths` / `nodemapOps` /
 * `nodemapKinds`, derived off one u32 drawn from the caller's 'nodemap'
 * stream at entry — the §77 keyed architecture; a draw-count change inside
 * one pass can never remap another, which retires the old tail-append
 * byte-discipline):
 *
 *  1. **Widths** — per-hop lane counts, drawn exactly like the old width
 *     loop (budget + growth cap), plus the braid's shrink floor
 *     (`ceil(prev/3)`) and a no-growth clamp into the LAST middle hop (a
 *     pair born there is forced to rejoin at the boss = an automatic d2).
 *  2. **Ops** — per transition: the net width delta is realized as split2 /
 *     merge2 ops, fused into rare 3-ops (`split3Chance`/`merge3Chance`, plus
 *     forced fusing when lane capacity runs short); `churnChance` adds
 *     Δ-neutral split+merge pairs (the branch-texture source — without
 *     churn a width plateau is parallel non-interacting lanes). Op → lane
 *     assignment is a bounded shuffle search under the SEAM RULE: every
 *     split opens a seam between its child lanes; a merge closing an age-1
 *     seam is an instant-d2 diamond, allowed only via `d2RejoinChance` and
 *     a ≤25%-of-sibling-pairs map budget (the 77c signed cap, constructive).
 *  3. **Kinds** — the 77e2 quota layer (targets = the signed 77c sheet).
 *     Placement priority = signedness: (1) the port CONE pass (every hop-1
 *     first choice gets a port in its descendant cone by hop ≤5 — kills
 *     first-choice shop lockout + the by-h5 row at once; guarantee beats
 *     pacing), (2) presence floors (≥1 elite then ≥1 rest, early-biased),
 *     (3) EVENTS to the signed ≈3/route band (share×spread weighting),
 *     (4) the rest/elite/port feel-target top-ups with leftover slots —
 *     so narrow structures under-fill the feel quotas, never the signed
 *     rows. Everything sits under the BATTLE FLOOR (≥1 battle per middle
 *     hop, a hard C row) and PATH-WINDOW cooldowns (no same-kind node
 *     within `minSpacing` hops along any route — per-lane pacing that
 *     composed routes inherit exactly, because braid edges never cross
 *     lanes outside split/merge ops). Quotas are exact route-share sums
 *     against the `*RouteTarget` knobs. The rejection loop re-rolls ONLY
 *     this pass (attempt index on the kinds sub-stream, `kindMaxAttempts`
 *     hard-throw); the sole retryable failure is the cone pass finding no
 *     candidate — capacity shortfalls on tiny/narrow structures are
 *     accepted best-effort (dev shapes must never throw). NB the kinds
 *     share ONE slot pool by design: a probe dial that kills one kind
 *     frees slots the others may claim — the 74e "dial leaves other kinds
 *     byte-identical" contract narrowed to STRUCTURE at 77e2 (worklog).
 *
 * Seed-stability: the seed→map mapping is `hash(root, subStreamKey)` per
 * pass — there is no cross-pass draw order to preserve. Changing a pass
 * remaps ONLY that pass's stream (structure holds under a kinds change;
 * see the eventChance-override contract test).
 */

import { RNG, deriveRng } from '../core/RNG';
import { NODE_MAP } from '../config/nodemap';
import type { RunConfig } from './RunConfig';

// 74b adds 'event' (the choose-your-own-adventure node, spec §Events);
// 74e places them (74e scatter, now the e1 bridge pass); the sector
// `startingEvents` root stamp is `stampRootKind`.
export type NodeKind = 'battle' | 'rest' | 'boss' | 'elite' | 'port' | 'event';

/**
 * S2 — the "pre-root" start position. A run begins here (no node entered yet),
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

// Shape parameters live in config/nodemap.json. Bound to locals here so
// the existing call sites read the same way.
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

/** The port-cone guarantee window (the signed 77c rows "port by h5 = 100%"
 *  + "first-choice port lockout = 0%"): every hop-1 branch's cone gets a
 *  port no later than this hop (clamped to the eligible band on short
 *  maps). A design anchor from the signed sheet, not a tunable. */
const PORT_GUARANTEE_HOP = 5;

/** The d2 budget: instant-rejoin closures may never exceed this fraction of
 *  the sibling pairs born so far (the 77c signed ≤25% cap, enforced online —
 *  conservative, since pairs born later only grow the denominator). */
const D2_BUDGET_FRACTION = 0.25;

/** Bounded arrangement search per transition (the scope-guard rule: bounded
 *  loops with a deterministic fallback, never an unbounded reroll). */
const ARRANGEMENT_ATTEMPTS = 24;

/** Bounded braid re-rolls against the per-map d2 cap (see generate pass 2). */
const OPS_MAX_ATTEMPTS = 20;

/** Width smoothing (77e2): per-transition width change is capped at ±2.
 *  A width sawtooth (2→6→2, seen live at seed 14) FORCES mass split3s
 *  immediately re-merged as merge3s — six d2 closures no ops re-roll can
 *  avoid, busting the signed ≤25% cap structurally. Gentle slopes keep
 *  forced merges rare enough for the seam rule to route around siblings. */
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
  // G1: RunConfig overrides the shape per-run; absent fields fall back to the
  // config/nodemap.json defaults. `hopCount` + `mapMaxWidth` (G1) and
  // `eliteChance` + `portChance` + `eventChance` (72e/74e probe dials) are
  // tunable here; everything else stays on the JSON defaults.
  // T2: `lengthOverride` is the current SECTOR's `length`; precedence
  // `config.hopCount > sector.length > JSON default` keeps the dev `?hops=N`
  // flag authoritative.
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
          // Only reachable via extreme config overrides (e.g. a huge
          // mapMaxWidth against a tiny budget) — fail loud, never quietly
          // emit an infeasible width (the §77 scope guard).
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
  // Bounded structure re-roll (the corpus gate's first red row forced it):
  // the seam rule's online budget can be beaten by capacity-FORCED closures
  // (transitions where no clean lane arrangement exists), so single rolls
  // bust the signed ≤25% per-map d2 cap on ~26% of maps. Re-rolling the
  // ops sub-stream (attempt-indexed) until the FINAL ratio honors the cap
  // makes the C row hold for real (residual ≈ 0.26^20). Deterministic
  // least-bad fallback — structure generation never throws.
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
      // The boss transition: merge-all (see header). Count any age-1 pairs
      // honestly — the width clamp above makes them structurally impossible
      // except at degenerate lengths (hopCount 3, where the root split has
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
    // Forced 3-op fusing when lane capacity runs short (Δ-preserving:
    // two 2-ops = one 3-op on both axes).
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
    // Churn: Δ-neutral split+merge pairs, geometric on churnChance, bounded
    // by lane capacity. Suppressed into the last middle hop (see widths).
    if (childHop !== hopCount - 2) {
      while (laneNeed() + 3 <= m && rng.next() < CHURN_CHANCE) {
        s2 += 1;
        m2 += 1;
      }
    }
    // Rare 3-op upgrades (one check per axis per transition — "rare but
    // possible", the signed shape).
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
      const cand = shuffle(tokens, rng);
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
      // No clean arrangement found (capacity-forced) — take the least-bad
      // candidate and count it. Deterministic, bounded, honest.
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

// ---- Pass 3: kinds — the quota layer (77e2; worklog §77e) -----------------
// Quota-driven placement against the signed 77c sheet (priority order in
// placeKinds — guarantees, then the signed band, then feel top-ups).
// Dial scaling: an eliteChance/portChance/eventChance override `d` scales
// the kind's route target by `d / anchor` (0 kills the kind INCLUDING its
// guarantees — the probe-isolation arms; 1 floods). Rejection is a
// bounded re-roll of this pass only (the attempt index on the kinds
// sub-stream); the throw is the §77 scope guard and should be
// unreachable on feasible configs.
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

  // hopCount === 1 degenerates to root == terminal: `bossId` is the root, so
  // the single node is tagged `boss` — the player's one fight IS the boss.
  // 68e — the first-node stamp: a dev/isolation dial that marks the ROOT as
  // the given kind AFTER every kind pass, with ZERO extra draws. Boss wins
  // on the hopCount===1 degenerate (root == terminal). See
  // RunConfig.firstNodeKind.
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
// 77e2 — the kind-placement engine (worklog §77e; targets = the signed 77c
// sheet). Pure helpers over the finished braid structure; all randomness
// comes from the per-attempt kinds sub-stream passed in.

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
 * One placement attempt. Returns null ONLY on a retryable failure (the
 * port-cone pass finding no candidate); quota shortfalls from genuine
 * capacity exhaustion (narrow/short structures) are accepted best-effort —
 * a re-roll cannot create slots, and dev shapes must never throw.
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
    // The battle floor (77c C row): >= 1 battle per middle hop, always.
    return (specialsAt.get(f) ?? 0) < widthOf(f) - 1;
  };
  /** Path-window cooldown: no same-kind node within `spacing-1` hops along
   *  any route (BFS both directions). The signed pacing rules: rest/elite
   *  spacing 2 = never adjacent on a route; port 3; event 1 = no-op. */
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

  // Placement priority (77e2, capacity-aware — worklog §77e2): HARD
  // guarantees first (port cones, presence floors), then the SIGNED events
  // band, then the feel-target top-ups with whatever slots remain. On
  // narrow structures the feel quotas under-fill, never the signed rows —
  // the probe that forced this ordering found 5% of maps below the events
  // band when top-ups ran first.

  // -- 1. PORT cone coverage (the two hard C rows). Guarantee applies to
  //    real sector maps only (>= 3 band hops); degenerate dev shapes are
  //    quota-only, like the old fallback's "sector-map contract" exemption.
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

  /** The rest top-ups' pacing biases (the signed rules 3a/3b): before
   *  placed elites, and harder before the boss. */
  const restBias = (id: number): number => {
    let w = 1;
    if (nearKind(s, kindAt, id, 'elite')) w *= PRE_ELITE_REST_WEIGHT;
    if (s.hopOf.get(id)! >= s.hopCount - 3) w *= PRE_BOSS_REST_WEIGHT;
    return w;
  };
  /** The presence floor: ONE node of the kind, from a cascading candidate
   *  pool — early+spaced, then spaced, then anything. The hard early
   *  window (hops ≤ 5) is what holds the by-h5 R rows; the corpus gate
   *  proved a soft early WEIGHT insufficient (87% vs the signed ≥90%). */
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
    // No slot at all — capacity-capped (tiny structures); accepted.
  };
  /** Top up toward the share target; spaced only, capacity caps best-effort. */
  const fillTarget = (
    kind: 'rest' | 'elite' | 'port',
    spacing: number,
    target: number,
    weightOf: (id: number) => number,
  ): void => {
    while (shareSum[kind] < target) {
      const cands = bandNodes.filter((id) => slotFree(id) && windowClear(id, kind, spacing));
      if (cands.length === 0) break; // capacity-capped (tiny/narrow structures)
      const weights = cands.map(weightOf);
      place(cands[weightedPick(weights, rng)]!, kind);
    }
  };

  // -- 2. Presence floors. Port FIRST — the ≥1-port "sector-map contract"
  //    predates every other guarantee (50c) and must survive short maps
  //    where the cone pass is skipped (a portless 4-hop map vacuates the
  //    fuzz economy arm — caught by the 50g canary). Then elite before
  //    rest, so the rest top-ups can see placed elites (the signed
  //    before-elite bias). Floors are hard early-window picks.
  if (scales.portScale > 0) placeFloor('port', PORT_MIN_SPACING);
  if (scales.eliteScale > 0) placeFloor('elite', ELITE_MIN_SPACING);
  placeFloor('rest', REST_MIN_SPACING);

  // -- 3. EVENTS to the signed band (back-to-back LEGAL — spacing 1 is a
  //    no-op window). Weight = share × spread: share makes each slot count
  //    on tight maps, the spread term keeps events from clumping.
  if (scales.eventScale > 0) {
    const target = EVENTS_PER_ROUTE * scales.eventScale;
    const ceiling = target + EVENTS_BAND_HALF_WIDTH;
    while (shareSum.event < target) {
      const cands = bandNodes.filter(
        (id) => slotFree(id) && windowClear(id, 'event', EVENT_MIN_SPACING),
      );
      if (cands.length === 0) break; // band full — capacity is physics, not failure
      const fitting = cands.filter((id) => shareSum.event + s.share.get(id)! <= ceiling);
      if (fitting.length > 0) {
        const weights = fitting.map(
          (id) => s.share.get(id)! / (1 + nearKindCount(s, kindAt, id, 'event')),
        );
        place(fitting[weightedPick(weights, rng)]!, 'event');
      } else {
        if (shareSum.event >= target - EVENTS_BAND_HALF_WIDTH) break; // in band — stop clean
        // Below the floor and everything overshoots: take the least overshoot.
        let pick = cands[0]!;
        for (const id of cands) if (s.share.get(id)! < s.share.get(pick)!) pick = id;
        place(pick, 'event');
        break;
      }
    }
  }

  // -- 4. Cone-coverage repair (the ≤10% first-choice lockout R rows): any
  //    first choice locked out of elites or rests gets one — BEFORE the
  //    feel top-ups so the repairs aren't starved of in-cone slots (the
  //    corpus gate measured elite lockout 23.4% with no repair, and rest
  //    lockout 13.8% with the repair running last).
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
      if (cands.length === 0) continue; // no slot in the cone — residual lockout
      place(cands[rng.int(0, cands.length - 1)]!, kind);
    }
  }

  // -- 5. Feel-target top-ups with the leftover slots (port → elite → rest).
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

/** Any `kind` node within 2 hops downstream of `id` (the rest pass's
 *  before-elite bias probe). */
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

/** Fisher–Yates on a copy (the input bag is reused across attempts). */
function shuffle<T>(arr: readonly T[], rng: RNG): T[] {
  const out = arr.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = rng.int(0, i);
    const tmp = out[i]!;
    out[i] = out[j]!;
    out[j] = tmp;
  }
  return out;
}

/**
 * 74e — re-kind a finished map's ROOT node (the sector `startingEvents`
 * stamp; the 68e `firstNodeKind` discipline as a post-generation transform).
 * ZERO extra RNG draws — structure, edges, and every scatter placement are
 * untouched, so a stamped map differs from its unstamped twin in exactly the
 * root's `kind`. Boss wins on the root === terminal degenerate (hopCount 1),
 * matching the in-generate stamp's precedence. Callers resolve WHICH kind
 * wins the root (the `firstNodeKind` dev dial beats the sector stamp —
 * isolation power, the 63c precedence precedent) before calling.
 */
export function stampRootKind(map: NodeMap, kind: NodeKind): NodeMap {
  if (map.rootId === map.terminalId) return map;
  return {
    ...map,
    nodes: map.nodes.map((n) => (n.id === map.rootId ? { ...n, kind } : n)),
  };
}

/** Human-readable dump for eyeball verification of generated maps. */
export function dump(map: NodeMap): string {
  const lines: string[] = [];
  lines.push(`NodeMap (${map.nodes.length} nodes, ${map.hops.length} hops)`);
  for (let f = 0; f < map.hops.length; f++) {
    const labeled = map.hops[f]!.map((id) => {
      if (id === map.rootId) return `${id}(root)`;
      if (id === map.terminalId) return `${id}(boss)`;
      const node = map.nodes.find((n) => n.id === id);
      if (node?.kind === 'rest') return `${id}(rest)`;
      if (node?.kind === 'elite') return `${id}(elite)`;
      if (node?.kind === 'port') return `${id}(port)`;
      if (node?.kind === 'event') return `${id}(event)`;
      return String(id);
    });
    lines.push(`  Hop ${f}: ${labeled.join(', ')}`);
  }
  lines.push('Edges:');
  const byFrom = new Map<number, number[]>();
  for (const e of map.edges) {
    const list = byFrom.get(e.from) ?? [];
    list.push(e.to);
    byFrom.set(e.from, list);
  }
  for (const node of map.nodes) {
    const tos = byFrom.get(node.id);
    if (tos) {
      tos.sort((a, b) => a - b);
      lines.push(`  ${node.id} → ${tos.join(', ')}`);
    }
  }
  return lines.join('\n');
}
