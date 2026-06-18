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
    restChance: z.number().min(0).max(1),
    restMinSpacing: z.number().int().positive(),
  })
  .refine((c) => c.middleWidthMin <= c.middleWidthMax, {
    message: 'middleWidthMin must be <= middleWidthMax',
  });

export type NodeMapConfig = z.infer<typeof NodeMapSchema>;

export const NODE_MAP: NodeMapConfig = NodeMapSchema.parse(nodeMapJson);
