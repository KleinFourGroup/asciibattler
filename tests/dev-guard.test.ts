import { afterAll, describe, expect, it } from 'vitest';
import { mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import ts from 'typescript';
import { DEV_MARKERS, devLeaks } from '../scripts/dev-scan.mjs';
import { repoRead, resolveSpecifier, type Read } from './importGraph';

// 117.5j — DEV CODE DOES NOT SHIP.
//
// Two things hold that. The rule, pinned here on the source text: a file
// outside `src/dev` reaches into it only by a dynamic import inside a DEV
// gate, which a production build folds away with everything behind it. A
// static import would leave it to the tree-shaker to prove each dev module's
// top level pure, and one such import once shipped part of a fixture table.
// And the scan (scripts/dev-scan.mjs), which reads a build for the strings
// dev code carries: `npm run build` and the itch zip run it, and its list of
// markers is held to the folder here, so a new dev module can't go unlisted.

const DEV_DIR = 'src/dev/';

/** The conditions a reach into src/dev may stand under; `only` names the one
 *  module the gate is for. */
const GATES: ReadonlyArray<{ readonly test: string; readonly only?: string }> = [
  { test: 'import.meta.env.DEV' },
  // The diagnostics panel: a production build made with VITE_DIAG=1 has it.
  { test: "import.meta.env.VITE_DIAG === '1'", only: 'src/dev/diag/index.ts' },
];

interface DevReach {
  readonly target: string;
  readonly kind: 'static' | 'dynamic';
  /** Every condition the reach stands under, innermost first. */
  readonly under: readonly string[];
}

/** A file's run-time reaches into src/dev, read from its text. */
function devReaches(path: string, source: string, read: Read): DevReach[] {
  const file = ts.createSourceFile(path, source, ts.ScriptTarget.ES2022, true);
  const reaches: DevReach[] = [];
  const target = (specifier: string): string | null => {
    if (!specifier.startsWith('.')) return null;
    const resolved = resolveSpecifier(path, specifier, read);
    return resolved.startsWith(DEV_DIR) ? resolved : null;
  };
  // The `if (X)` whose then-branch, and the `X ? … : …` whose first arm, holds the node.
  const conditionsOver = (node: ts.Node): string[] => {
    const out: string[] = [];
    for (let child = node, parent = node.parent; parent !== undefined; child = parent, parent = parent.parent) {
      if (ts.isIfStatement(parent) && parent.thenStatement === child) out.push(parent.expression.getText(file));
      else if (ts.isConditionalExpression(parent) && parent.whenTrue === child) out.push(parent.condition.getText(file));
    }
    return out;
  };
  const visit = (node: ts.Node): void => {
    if (ts.isImportDeclaration(node) && ts.isStringLiteral(node.moduleSpecifier)) {
      const clause = node.importClause;
      const named = clause?.namedBindings;
      const typesOnly =
        (clause?.isTypeOnly ?? false) ||
        (clause !== undefined &&
          clause.name === undefined &&
          named !== undefined &&
          ts.isNamedImports(named) &&
          named.elements.length > 0 &&
          named.elements.every((e) => e.isTypeOnly));
      const to = typesOnly ? null : target(node.moduleSpecifier.text);
      if (to !== null) reaches.push({ target: to, kind: 'static', under: [] });
    } else if (ts.isExportDeclaration(node) && node.moduleSpecifier && ts.isStringLiteral(node.moduleSpecifier)) {
      const to = node.isTypeOnly ? null : target(node.moduleSpecifier.text);
      if (to !== null) reaches.push({ target: to, kind: 'static', under: [] });
    } else if (
      ts.isCallExpression(node) &&
      node.expression.kind === ts.SyntaxKind.ImportKeyword &&
      node.arguments[0] !== undefined &&
      ts.isStringLiteral(node.arguments[0])
    ) {
      const to = target(node.arguments[0].text);
      if (to !== null) reaches.push({ target: to, kind: 'dynamic', under: conditionsOver(node) });
    }
    ts.forEachChild(node, visit);
  };
  visit(file);
  return reaches;
}

/** What is wrong with a file's reaches into src/dev; empty when each is a
 *  dynamic import under a gate that is for it. */
function devReachFaults(path: string, source: string, read: Read): string[] {
  return devReaches(path, source, read).flatMap((reach) => {
    if (reach.kind === 'static') return [`${path}: a static import of ${reach.target}`];
    const gated = GATES.some((g) => reach.under.includes(g.test) && (g.only === undefined || g.only === reach.target));
    return gated ? [] : [`${path}: a dynamic import of ${reach.target} outside a DEV gate`];
  });
}

/** Every shipped source file: `src/**.ts` outside src/dev, tests left out. */
function shippedSources(): string[] {
  const out: string[] = [];
  const walk = (dir: string): void => {
    for (const name of readdirSync(dir)) {
      const path = `${dir}/${name}`;
      if (statSync(path).isDirectory()) {
        if (`${path}/` !== DEV_DIR) walk(path);
      } else if (name.endsWith('.ts') && !name.endsWith('.test.ts') && !name.endsWith('.d.ts')) {
        out.push(path);
      }
    }
  };
  walk('src');
  return out.sort();
}

describe('117.5j — src/dev is reached only through DEV-gated dynamic imports', () => {
  const planted = (body: string): string[] => {
    const files = new Map<string, string>([
      ['src/main.ts', body],
      ['src/dev/devEntry.ts', 'export const dev = 1;'],
      ['src/dev/diag/index.ts', 'export const diag = 1;'],
      ['src/Game.ts', 'export const Game = 1;'],
    ]);
    return devReachFaults('src/main.ts', body, (path) => files.get(path));
  };
  const STATIC = 'src/main.ts: a static import of src/dev/devEntry.ts';
  const UNGATED = 'src/main.ts: a dynamic import of src/dev/devEntry.ts outside a DEV gate';

  it('reads planted files: a static import, a re-export, and each ungated dynamic import are faults', () => {
    expect(planted("import { dev } from './dev/devEntry';\nexport { dev };")).toEqual([STATIC]);
    expect(planted("import './dev/devEntry';")).toEqual([STATIC]);
    expect(planted("export * from './dev/devEntry';")).toEqual([STATIC]);
    expect(planted("const m = await import('./dev/devEntry');")).toEqual([UNGATED]);
    // The wrong arm, the wrong test, and a test that only mentions DEV.
    expect(planted("if (import.meta.env.DEV) {} else { await import('./dev/devEntry'); }")).toEqual([UNGATED]);
    expect(planted("const m = import.meta.env.DEV ? null : await import('./dev/devEntry');")).toEqual([UNGATED]);
    expect(planted("if (!import.meta.env.DEV) { await import('./dev/devEntry'); }")).toEqual([UNGATED]);
    expect(planted("if (import.meta.env.DEV || true) { await import('./dev/devEntry'); }")).toEqual([UNGATED]);
    // The diagnostics gate is the diagnostics panel's alone.
    expect(planted("if (import.meta.env.VITE_DIAG === '1') { await import('./dev/devEntry'); }")).toEqual([UNGATED]);
  });

  it('reads planted files: a gated dynamic import and a type-only import are not', () => {
    expect(planted("if (import.meta.env.DEV) { (await import('./dev/devEntry')).dev; }")).toEqual([]);
    expect(planted("const m = import.meta.env.DEV ? await import('./dev/devEntry') : null;")).toEqual([]);
    expect(planted("if (import.meta.env.DEV) { if (location.search) { void import('./dev/devEntry'); } }")).toEqual([]);
    expect(planted("if (import.meta.env.VITE_DIAG === '1') { await import('./dev/diag'); }")).toEqual([]);
    expect(planted("import type { dev } from './dev/devEntry';\nimport { type dev as d } from './dev/devEntry';")).toEqual([]);
    expect(planted("import { Game } from './Game';\nexport { Game };")).toEqual([]);
  });

  it('the reader sees main.ts reach the dev entry and the diagnostics panel, each under its gate', () => {
    // The known answer on the real file: a reader that saw nothing would pass the pin below.
    const reaches = devReaches('src/main.ts', repoRead('src/main.ts') ?? '', repoRead);
    expect(reaches).toEqual([
      { target: 'src/dev/devEntry.ts', kind: 'dynamic', under: ['import.meta.env.DEV'] },
      { target: 'src/dev/diag/index.ts', kind: 'dynamic', under: ["import.meta.env.VITE_DIAG === '1'"] },
    ]);
  });

  it('no shipped source file reaches src/dev any other way', () => {
    const sources = shippedSources();
    expect(sources.length).toBeGreaterThan(100);
    expect(sources).toContain('src/main.ts');
    expect(sources.some((path) => path.startsWith(DEV_DIR))).toBe(false);
    const faults = sources.flatMap((path) => devReachFaults(path, readFileSync(path, 'utf8'), repoRead));
    expect(
      faults,
      'Reach src/dev by `import.meta.env.DEV ? await import(…) : null` or inside `if (import.meta.env.DEV) { … }`, through src/dev/devEntry.ts',
    ).toEqual([]);
  });
});

/** A source's text: a file's, or every non-test file's under a folder. */
function sourceText(source: string): string {
  if (!statSync(source).isDirectory()) return readFileSync(source, 'utf8');
  return readdirSync(source)
    .filter((name) => !name.endsWith('.test.ts'))
    .map((name) => sourceText(`${source}/${name}`))
    .join('\n');
}

describe("117.5j — the build scan's markers cover src/dev", () => {
  it('every entry of src/dev has a row', () => {
    const entries = readdirSync('src/dev')
      .filter((name) => !name.endsWith('.test.ts'))
      .map((name) => `src/dev/${name}`);
    expect(entries.length).toBeGreaterThan(5);
    const listed = DEV_MARKERS.map((row) => row.source);
    expect(
      entries.filter((entry) => !listed.includes(entry)),
      'Give the new dev module a row in DEV_MARKERS (scripts/dev-scan.mjs): a string its code carries into a build',
    ).toEqual([]);
  });

  it('every marker is in its source, and long enough to mean something', () => {
    for (const row of DEV_MARKERS) {
      expect(row.markers.length, row.source).toBeGreaterThan(0);
      const text = sourceText(row.source);
      for (const marker of row.markers) {
        expect(marker.length, `${row.source}: "${marker}"`).toBeGreaterThanOrEqual(7);
        expect(text.includes(marker), `${row.source} no longer holds its marker "${marker}"`).toBe(true);
      }
    }
  });
});

describe('117.5j — the build scan finds a planted leak', () => {
  const root = mkdtempSync(join(tmpdir(), 'asciibattler-dev-scan-'));
  afterAll(() => rmSync(root, { recursive: true, force: true }));
  const build = (name: string, files: Record<string, string>): string => {
    const dir = join(root, name);
    for (const [file, text] of Object.entries(files)) {
      mkdirSync(join(dir, file, '..'), { recursive: true });
      writeFileSync(join(dir, file), text);
    }
    return dir;
  };
  const CLEAN = 'const a=document.getElementById(`boot-line`);a?.remove();console.warn("[store] can\'t save:",a);';

  it('passes a build with no marker in it', () => {
    expect(devLeaks(build('clean', { 'index.html': '<div id="ui"></div>', 'assets/index.js': CLEAN }))).toEqual([]);
  });

  it('finds a marker in a script, in a second chunk, and in the page, and names the module', () => {
    const dir = build('leaky', {
      'index.html': '<script>window.__probe = stub;</script>',
      'assets/index.js': `${CLEAN}console.info(\`[dev-keys] camera mode\`);`,
      'assets/chunk.js': 'throw new Error(`planted by ?fail=${e}`)',
    });
    expect(devLeaks(dir)).toEqual([
      { file: 'assets/chunk.js', marker: 'planted by ?fail=', source: 'src/dev/failPlant.ts' },
      { file: 'assets/chunk.js', marker: 'planted by ?', source: 'src/store/choose.ts' },
      { file: 'assets/index.js', marker: '[dev-keys]', source: 'src/dev/devKeys.ts' },
      { file: 'index.html', marker: '__probe = ', source: 'src/dev/probe' },
    ]);
  });

  it('passes the diagnostics panel in a build made with it, and nothing else', () => {
    const dir = build('diag', { 'assets/index.js': `${CLEAN}el.className="diag-panel";localStorage.getItem("asciibattler:traces:v1")` });
    expect(devLeaks(dir).map((leak) => leak.marker)).toEqual(['asciibattler:traces', 'diag-panel']);
    expect(devLeaks(dir, { diag: true }).map((leak) => leak.marker)).toEqual(['asciibattler:traces']);
  });

  it('refuses a folder with nothing to read, so an empty scan is never a pass', () => {
    expect(() => devLeaks(build('empty', { 'assets/font.woff2': 'x' }))).toThrow(/nothing was scanned/);
  });
});
