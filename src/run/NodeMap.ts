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
 *  3. **Kinds** — ⚠ e1 BRIDGE: the four G3/W2/50c/74e scatter passes ported
 *     verbatim onto the kinds sub-stream (same eligibility band, spacing,
 *     ≥1-port fallback, candidate filters — so every kind invariant holds).
 *     77e2 REPLACES this bridge with the quota + per-lane state machine +
 *     per-hop arbiter design (worklog §77e); the bridge's placement
 *     distributions are throwaway — do not tune against them.
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
  restChance: REST_CHANCE,
  restMinSpacing: REST_MIN_SPACING,
  eliteChance: ELITE_CHANCE,
  eliteMinSpacing: ELITE_MIN_SPACING,
  portChance: PORT_CHANCE,
  portMinSpacing: PORT_MIN_SPACING,
  eventChance: EVENT_CHANCE,
  eventMinSpacing: EVENT_MIN_SPACING,
  churnChance: CHURN_CHANCE,
  split3Chance: SPLIT3_CHANCE,
  merge3Chance: MERGE3_CHANCE,
  d2RejoinChance: D2_REJOIN_CHANCE,
} = NODE_MAP;

/** The d2 budget: instant-rejoin closures may never exceed this fraction of
 *  the sibling pairs born so far (the 77c signed ≤25% cap, enforced online —
 *  conservative, since pairs born later only grow the denominator). */
const D2_BUDGET_FRACTION = 0.25;

/** Bounded arrangement search per transition (the scope-guard rule: bounded
 *  loops with a deterministic fallback, never an unbounded reroll). */
const ARRANGEMENT_ATTEMPTS = 24;

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
  const eliteChance = config?.eliteChance ?? ELITE_CHANCE;
  const portChance = config?.portChance ?? PORT_CHANCE;
  const eventChance = config?.eventChance ?? EVENT_CHANCE;

  // One draw off the caller's stream defines the LOCAL derivation root for
  // the pass sub-streams (see header). `int(0, 0xffffffff)` recovers the
  // stream's raw u32 exactly (next() is u32 / 2^32).
  const root = rng.int(0, 0xffffffff);
  const widthsRng = deriveRng(root, 'nodemapWidths');
  const opsRng = deriveRng(root, 'nodemapOps');
  const kindsRng = deriveRng(root, 'nodemapKinds');

  // ---- Pass 1: widths ----------------------------------------------------
  const widths: number[] = [];
  {
    let placedSoFar = 0;
    let prevWidth = 1; // hop 0 is the single root node
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
        // braid's feasibility envelope.
        let cap = Math.max(
          MIDDLE_WIDTH_MIN,
          Math.min(maxWidth, budget, prevWidth * MAX_OUT_DEGREE),
        );
        if (f === hopCount - 2) {
          // No growth into the LAST middle hop: a sibling pair born there
          // has only the boss merge ahead of it — an automatic d2 rejoin.
          // (Churn is suppressed on that transition for the same reason.)
          cap = Math.min(cap, Math.max(prevWidth, MIDDLE_WIDTH_MIN));
        }
        const floor = Math.max(MIDDLE_WIDTH_MIN, Math.ceil(prevWidth / MAX_OUT_DEGREE));
        if (floor > cap) {
          // Only reachable via extreme config overrides (e.g. a huge
          // mapMaxWidth against a tiny budget) — fail loud, never quietly
          // emit an infeasible width (the §77 scope guard).
          throw new Error(`NodeMap: hop ${f} width band empty (floor ${floor} > cap ${cap})`);
        }
        width = widthsRng.int(floor, cap);
      }
      widths.push(width);
      placedSoFar += width;
      prevWidth = width;
    }
  }

  // ---- Pass 2: the braid (ops → nodes + edges) ---------------------------
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
      while (laneNeed() + 3 <= m && opsRng.next() < CHURN_CHANCE) {
        s2 += 1;
        m2 += 1;
      }
    }
    // Rare 3-op upgrades (one check per axis per transition — "rare but
    // possible", the signed shape).
    if (s2 >= 2 && opsRng.next() < SPLIT3_CHANCE) {
      s2 -= 2;
      s3 += 1;
    }
    if (m2 >= 2 && opsRng.next() < MERGE3_CHANCE) {
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
    const allowD2 = opsRng.next() < D2_REJOIN_CHANCE;
    let chosen: OpToken[] | undefined;
    let chosenClosures = 0;
    let best: OpToken[] | undefined;
    let bestClosures = Infinity;
    for (let attempt = 0; attempt < ARRANGEMENT_ATTEMPTS && chosen === undefined; attempt++) {
      const cand = shuffle(tokens, opsRng);
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

  // ---- Pass 3: kinds (⚠ e1 BRIDGE — see header; dies at 77e2) ------------
  // The four scatter passes ported verbatim from the staircase generator,
  // all drawing from the kinds sub-stream in their historical order. Same
  // eligibility band [2, hopCount-2], spacing knobs, candidate filters, and
  // ≥1-port fallback — every kind invariant test holds unchanged.
  const bossId = hops[hopCount - 1]![0]!;
  const restIds = new Set<number>();
  let lastRestHop = -Infinity;
  for (let f = 2; f <= hopCount - 2; f++) {
    const roll = kindsRng.next();
    if (roll < REST_CHANCE && f - lastRestHop >= REST_MIN_SPACING) {
      const ids = hops[f]!;
      const pick = ids[kindsRng.int(0, ids.length - 1)]!;
      restIds.add(pick);
      lastRestHop = f;
    }
  }
  const eliteIds = new Set<number>();
  let lastEliteHop = -Infinity;
  for (let f = 2; f <= hopCount - 2; f++) {
    const roll = kindsRng.next();
    if (roll < eliteChance && f - lastEliteHop >= ELITE_MIN_SPACING) {
      const ids = hops[f]!.filter((id) => !restIds.has(id));
      if (ids.length > 0) {
        const pick = ids[kindsRng.int(0, ids.length - 1)]!;
        eliteIds.add(pick);
        lastEliteHop = f;
      }
    }
  }
  const portIds = new Set<number>();
  let lastPortHop = -Infinity;
  for (let f = 2; f <= hopCount - 2; f++) {
    const roll = kindsRng.next();
    if (roll < portChance && f - lastPortHop >= PORT_MIN_SPACING) {
      const ids = hops[f]!.filter((id) => !restIds.has(id) && !eliteIds.has(id));
      if (ids.length > 0) {
        const pick = ids[kindsRng.int(0, ids.length - 1)]!;
        portIds.add(pick);
        lastPortHop = f;
      }
    }
  }
  if (portIds.size === 0) {
    const eligibleHops: number[][] = [];
    for (let f = 2; f <= hopCount - 2; f++) {
      const ids = hops[f]!.filter((id) => !restIds.has(id) && !eliteIds.has(id));
      if (ids.length > 0) eligibleHops.push(ids);
    }
    if (eligibleHops.length > 0) {
      const ids = eligibleHops[kindsRng.int(0, eligibleHops.length - 1)]!;
      portIds.add(ids[kindsRng.int(0, ids.length - 1)]!);
    }
  }
  const eventIds = new Set<number>();
  let lastEventHop = -Infinity;
  for (let f = 2; f <= hopCount - 2; f++) {
    const roll = kindsRng.next();
    if (roll < eventChance && f - lastEventHop >= EVENT_MIN_SPACING) {
      const ids = hops[f]!.filter(
        (id) => !restIds.has(id) && !eliteIds.has(id) && !portIds.has(id),
      );
      if (ids.length > 0) {
        const pick = ids[kindsRng.int(0, ids.length - 1)]!;
        eventIds.add(pick);
        lastEventHop = f;
      }
    }
  }

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
