/**
 * The sector map: the graph a run walks to choose its sequence of sectors.
 * Source of truth at `config/sector-map.json`, edited by hand. Each node
 * holds a list of candidate sectors, of which the run picks one on arrival;
 * `sources` are the possible starts and `sinks` the ends of a run.
 *
 * A run starts at a random source and plays a random sector of its list; on
 * clearing that sector's boss it moves to a random successor and one of its
 * sectors, and so on until it clears a sink. The walk is in
 * `src/run/sectorWalk.ts`; this module holds the data and the checks that
 * keep the walk total. The shipped map is two nodes, `start` then
 * `deep-end`, one sector each.
 *
 * Beyond zod's structural checks, the parse refuses:
 * 1. a repeated node id;
 * 2. a candidate that is not a `SECTOR_ID`;
 * 3. an edge, source or sink that names no node;
 * 4. a non-sink node with no outgoing edge, and any cycle, so the walk can
 *    neither stop short of a sink nor loop: every maximal path ends at a
 *    sink.
 */

import { z } from 'zod';
import sectorMapJson from '../../config/sector-map.json';
import { SECTOR_IDS } from './sectors';

const SectorMapNodeSchema = z.object({
  id: z.string().min(1),
  /** Candidate sectors at this DAG node; the run picks one on arrival. */
  sectors: z.array(z.string().min(1)).min(1),
});

const SectorMapEdgeSchema = z.object({
  from: z.string().min(1),
  to: z.string().min(1),
});

const SectorMapSchema = z
  .object({
    nodes: z.array(SectorMapNodeSchema).min(1),
    edges: z.array(SectorMapEdgeSchema),
    sources: z.array(z.string().min(1)).min(1),
    sinks: z.array(z.string().min(1)).min(1),
  })
  .superRefine((map, ctx) => {
    // Guard 1 — unique node ids.
    const nodeIds = new Set<string>();
    map.nodes.forEach((node, idx) => {
      if (nodeIds.has(node.id)) {
        ctx.addIssue({
          code: 'custom',
          path: ['nodes', idx, 'id'],
          message: `duplicate sector-map node id "${node.id}"`,
        });
      }
      nodeIds.add(node.id);
    });

    // Guard 2 — every candidate sector exists.
    const sectorIds = new Set<string>(SECTOR_IDS);
    map.nodes.forEach((node, idx) => {
      node.sectors.forEach((sectorId, sIdx) => {
        if (!sectorIds.has(sectorId)) {
          ctx.addIssue({
            code: 'custom',
            path: ['nodes', idx, 'sectors', sIdx],
            message: `node "${node.id}": unknown sector id "${sectorId}"`,
          });
        }
      });
    });

    // Guard 3 — edges + sources + sinks reference real nodes.
    map.edges.forEach((edge, idx) => {
      if (!nodeIds.has(edge.from)) {
        ctx.addIssue({ code: 'custom', path: ['edges', idx, 'from'], message: `edge from unknown node "${edge.from}"` });
      }
      if (!nodeIds.has(edge.to)) {
        ctx.addIssue({ code: 'custom', path: ['edges', idx, 'to'], message: `edge to unknown node "${edge.to}"` });
      }
    });
    map.sources.forEach((id, idx) => {
      if (!nodeIds.has(id)) {
        ctx.addIssue({ code: 'custom', path: ['sources', idx], message: `source references unknown node "${id}"` });
      }
    });
    map.sinks.forEach((id, idx) => {
      if (!nodeIds.has(id)) {
        ctx.addIssue({ code: 'custom', path: ['sinks', idx], message: `sink references unknown node "${id}"` });
      }
    });

    // Guard 4 — every non-sink has an outgoing edge, and there is no cycle.
    const sinkSet = new Set<string>(map.sinks);
    const out = new Map<string, string[]>();
    for (const node of map.nodes) out.set(node.id, []);
    for (const edge of map.edges) out.get(edge.from)?.push(edge.to);
    for (const node of map.nodes) {
      if (!sinkSet.has(node.id) && (out.get(node.id)?.length ?? 0) === 0) {
        ctx.addIssue({
          code: 'custom',
          path: ['nodes'],
          message: `node "${node.id}" is a non-sink dead-end (no outgoing edge)`,
        });
      }
    }
    // Acyclicity via DFS coloring (white/gray/black). A back-edge to a gray node
    // is a cycle. Only runs over nodes that exist (unknown-edge guard above).
    const color = new Map<string, 0 | 1 | 2>(); // 0 white, 1 gray, 2 black
    let cyclic = false;
    const visit = (id: string): void => {
      color.set(id, 1);
      for (const to of out.get(id) ?? []) {
        const c = color.get(to) ?? 0;
        if (c === 1) cyclic = true;
        else if (c === 0) visit(to);
      }
      color.set(id, 2);
    };
    for (const node of map.nodes) {
      if ((color.get(node.id) ?? 0) === 0) visit(node.id);
    }
    if (cyclic) {
      ctx.addIssue({ code: 'custom', path: ['edges'], message: 'sector-map has a cycle (the walk would never terminate)' });
    }
  });

export type SectorMap = z.infer<typeof SectorMapSchema>;

/** Exported for the tests, which pass hand-built maps through the real
 *  schema. */
export { SectorMapSchema };

export const SECTOR_MAP: SectorMap = SectorMapSchema.parse(sectorMapJson);
