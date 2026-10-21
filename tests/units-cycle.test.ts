import { describe, expect, it } from 'vitest';
import { chainTo, repoRead, resolveSpecifier, runtimeGraph, runtimeSpecifiers, type Read } from './importGraph';

// THE UNIT CATALOG SITS IN NO IMPORT CYCLE.
//
// `config/units` checks its rows against the targeting and ability registries
// while it loads, so a module on a path from its imports back to it runs
// before the catalog exists and fails at load, in whichever test file
// reaches it first. The suite's `isolate: false` hides such a path while
// another file in the worker loads the catalog first (gotcha #114). So no
// module the catalog imports may reach it again at run time.

const UNITS = 'src/config/units.ts';

/** The run-time chain from one of the catalog's imports back to it, or null. */
function pathBackToUnits(read: Read): string[] | null {
  const source = read(UNITS);
  if (source === undefined) throw new Error(`no file ${UNITS}`);
  const imports = runtimeSpecifiers(source, UNITS)
    .filter((s) => s.startsWith('.'))
    .map((s) => resolveSpecifier(UNITS, s, read))
    .filter((f) => f.endsWith('.ts'));
  const graph = runtimeGraph(imports, read);
  return graph.files.includes(UNITS) ? chainTo(UNITS, graph) : null;
}

describe('the unit catalog sits in no import cycle', () => {
  it('no module config/units imports reaches it again at run time', () => {
    expect(
      pathBackToUnits(repoRead),
      'a path back to config/units: break it, or have the catalog read at call time (gotcha #114)',
    ).toBeNull();
  });

  it('self-check: an edge planted back to the catalog is found, with its chain', () => {
    // `core/grid.ts` is reached through the targeting registry.
    const planted = 'src/core/grid.ts';
    const read: Read = (path) => {
      const source = repoRead(path);
      return path === planted && source !== undefined ? `import '../config/units';\n${source}` : source;
    };
    const chain = pathBackToUnits(read);
    expect(chain?.slice(-2)).toEqual([planted, UNITS]);
  });
});
