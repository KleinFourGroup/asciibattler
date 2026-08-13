/**
 * NodeMap generation parameters. Hop count, per-hop width bands,
 * total-node target, and out-degree cap drive the DAG shape produced by
 * `src/run/NodeMap.ts`. Source of truth at `config/nodemap.json`.
 *
 * G3 — node-kind scatter: `restChance` is the per-eligible-hop probability
 * of hosting a rest node; `restMinSpacing` is the minimum hop gap between
 * two rests (>= 2 = never on adjacent hops). Eligible hops are the middle
 * band only (never the first battle hop or the boss). The terminal is always
 * the boss; these knobs only govern rest placement.
 *
 * W2 — elite scatter: `eliteChance` / `eliteMinSpacing` mirror the rest knobs
 * for the (optional, harder) elite node. Elites scatter over the same middle
 * band, in a pass AFTER the rest scatter (so rest placement is unchanged), and
 * never overwrite a rest. Middle hops are always >= 2 wide, so an elite always
 * leaves a non-elite sibling — taking the elite is a route choice.
 *
 * 50c — port scatter: `portChance` / `portMinSpacing` mirror the elite knobs
 * for the port (shop) node. A third pass AFTER elites (rest + elite placement
 * unchanged); never overwrites either; and unlike elites, ≥1 port per map is
 * GUARANTEED via a fallback placement when the scatter rolls none (maps with
 * no eligible middle hop — dev hopCount overrides ≤ 3 — are exempt).
 *
 * 74e — event scatter: `eventChance` / `eventMinSpacing` mirror the pattern
 * for the event node, a FOURTH pass after ports. Deliberately dense
 * (chance 0.5, spacing 1 = back-to-back hops legal): events are a major
 * run component, ~half as frequent as battles on a path (user feel call,
 * §74e) — not an elite-style rare detour. LAUNCH-ROUGH: §81 re-reads the
 * density with the rest of the event-era balance; §77's constructive
 * generator replaces this scatter with a real events-to-combat ratio pass
 * (the one-node-per-hop ceiling is this interim pass's known limit).
 */

import { z } from 'zod';
import nodeMapJson from '../../config/nodemap.json';

const NodeMapSchema = z
  .object({
    hopCount: z.number().int().positive(),
    middleWidthMin: z.number().int().positive(),
    middleWidthMax: z.number().int().positive(),
    targetTotalMax: z.number().int().positive(),
    maxOutDegree: z.number().int().positive(),
    /** 77e2 — the *MinSpacing knobs are PATH-WINDOW cooldowns since the
     *  quota placement rework (worklog §77e): two same-kind nodes may not
     *  sit within `minSpacing` hops of each other ALONG ANY ROUTE (the old
     *  semantics were per-hop map-global). Values carried unchanged:
     *  rest/elite 2 (never adjacent on a route — "back-to-back elites
     *  discouraged", signed), port 3, event 1 (back-to-back events LEGAL —
     *  the 74e feel call, re-signed at the 77e design round). */
    restMinSpacing: z.number().int().positive(),
    /** 77e2 — eliteChance/portChance/eventChance are the RunConfig PROBE
     *  DIALS' anchor values (72e/74e semantics preserved through the quota
     *  rework): an override `d` scales the kind's route target by
     *  `d / anchor`, so 0 still kills the kind (the isolation arms) and 1
     *  still floods it. Absent override = scale 1 (authored density).
     *  `restChance` had no dial and is retired. */
    eliteChance: z.number().min(0).max(1),
    eliteMinSpacing: z.number().int().positive(),
    portChance: z.number().min(0).max(1),
    portMinSpacing: z.number().int().positive(),
    eventChance: z.number().min(0).max(1),
    eventMinSpacing: z.number().int().positive(),
    /** 74b — the chance an entered event node resolves straight into a
     *  combat encounter (spec §Events; base of the `eventCombatChance` run
     *  stat — folded, not read raw, so daemons can bend it). NOT a scatter
     *  knob — placement is `eventChance`/`eventMinSpacing` above. */
    eventCombatChance: z.number().min(0).max(1),
    /** 77e1 — the braid structure dials (worklog §77e). `churnChance`:
     *  per-draw chance of adding a Δ-neutral split+merge pair to a
     *  transition (the braid's branch-texture source; geometric, capacity
     *  bounded). `split3Chance`/`merge3Chance`: per-transition chance of
     *  fusing two 2-ops into one rare 3-op. `d2RejoinChance`: chance a
     *  transition may deliberately close an age-1 seam (an instant-d2
     *  diamond), always subject to the ≤25%-of-pairs map budget. */
    churnChance: z.number().min(0).max(1),
    split3Chance: z.number().min(0).max(1),
    merge3Chance: z.number().min(0).max(1),
    d2RejoinChance: z.number().min(0).max(1),
    /** 77e2 — the kind-layer quotas (worklog §77e; thresholds = the signed
     *  77c sheet). `*RouteTarget`: expected per-route count for the kind
     *  (exact route-share accounting, uniform-route model — the fuzz
     *  walker measures the steered reality). `eventsPerRoute`: the signed
     *  ratio band center (≈3, band ±`eventsBandHalfWidth`). Placement is
     *  quota-driven with a per-hop battle floor (≥1 battle per middle
     *  hop), constructive port-cone coverage (every first choice keeps
     *  shop access by h5), and bounded rejection (`kindMaxAttempts`,
     *  hard-throw — the §77 scope guard). The weight knobs are the signed
     *  pacing rules: `preEliteRestWeight` (rests before elites),
     *  `preBossRestWeight` (rests before the boss, stronger); the first
     *  rest/elite ride a HARD early window (hops ≤5), not a weight. */
    restRouteTarget: z.number().min(0),
    eliteRouteTarget: z.number().min(0),
    portRouteTarget: z.number().min(0),
    eventsPerRoute: z.number().min(0),
    eventsBandHalfWidth: z.number().min(0),
    kindMaxAttempts: z.number().int().positive(),
    preEliteRestWeight: z.number().min(1),
    preBossRestWeight: z.number().min(1),
  })
  .refine((c) => c.middleWidthMin <= c.middleWidthMax, {
    message: 'middleWidthMin must be <= middleWidthMax',
  });

export type NodeMapConfig = z.infer<typeof NodeMapSchema>;

export const NODE_MAP: NodeMapConfig = NodeMapSchema.parse(nodeMapJson);
