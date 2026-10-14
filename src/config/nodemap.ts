/**
 * The node map's shape and where its node kinds go. Source of truth at
 * `config/nodemap.json`; the generator and the rules these keys feed are in
 * `src/run/NodeMap.ts`, and the signed sheet they answer to is
 * `tests/nodemap-metrics.test.ts`.
 *
 * - `hopCount` — the hops in a map, when neither a sector's length nor the
 *   dev `?hops=` gives one.
 * - `middleWidthMin`, `middleWidthMax` — the band of a middle hop's width.
 * - `targetTotalMax` — the node budget the widths are drawn under.
 * - `maxOutDegree` — the most edges out of a node, and the most lanes one
 *   split or merge groups.
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
    /** The `*MinSpacing` keys are cooldowns along a route: two nodes of a
     *  kind sit fewer than that many hops apart on no route. At 2, rests and
     *  elites are never adjacent; at 1, events may follow each other. */
    restMinSpacing: z.number().int().positive(),
    /** `eliteChance`, `portChance` and `eventChance` are the anchors of the
     *  `RunConfig` probe dials: an override `d` scales the kind's route
     *  target by `d / anchor`, so 0 removes the kind and 1 floods it. With
     *  no override the scale is 1. */
    eliteChance: z.number().min(0).max(1),
    eliteMinSpacing: z.number().int().positive(),
    portChance: z.number().min(0).max(1),
    portMinSpacing: z.number().int().positive(),
    eventChance: z.number().min(0).max(1),
    eventMinSpacing: z.number().int().positive(),
    /** The chance an entered event node turns into a combat encounter, the
     *  base of the `eventCombatChance` run stat, so daemons can bend it. It
     *  places nothing. */
    eventCombatChance: z.number().min(0).max(1),
    /** The braid's texture, per hop transition:
     *  - `churnChance` — per draw, the chance of adding a split and merge
     *    pair that leaves the width alone, the source of branching texture.
     *  - `split3Chance`, `merge3Chance` — the chance of fusing two 2-way ops
     *    into one 3-way op.
     *  - `d2RejoinChance` — the chance a merge may close a seam opened on the
     *    hop before (a diamond of depth 2), always under the map's cap of 25%
     *    of sibling pairs. */
    churnChance: z.number().min(0).max(1),
    split3Chance: z.number().min(0).max(1),
    merge3Chance: z.number().min(0).max(1),
    d2RejoinChance: z.number().min(0).max(1),
    /** The kind quotas. The placement order, the battle floor and the port
     *  guarantee are in `NodeMap.ts`.
     *  - `restRouteTarget`, `eliteRouteTarget`, `portRouteTarget` — the
     *    expected count of the kind on a route, summed over route shares on
     *    a model where every route is equally likely; the fuzz walker
     *    measures the routes a player steers.
     *  - `eventsPerRoute`, `eventsBandHalfWidth` — the centre and half-width
     *    of the band of events a route holds.
     *  - `kindMaxAttempts` — the kinds pass's retries before it throws.
     *  - `preEliteRestWeight`, `preBossRestWeight` — how strongly a rest is
     *    favoured on the hops before an elite and before the boss. */
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
