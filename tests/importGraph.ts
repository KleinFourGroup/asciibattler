import { existsSync, readFileSync, statSync } from 'node:fs';
import { posix } from 'node:path';
import ts from 'typescript';

// The run-time import graph of the source, read from its text with the
// TypeScript parser: what a bundler follows, without building anything.
// Shared by the pins that hold a module boundary (store-boot.test.ts,
// store-guard.test.ts). Paths are repo-relative with forward slashes.
//
// A type-only import is erased at build time and doesn't count: `import
// type …`, `export type … from`, and an import whose every name is marked
// `type`. An import that only happens to be used as a type still counts, so
// a boundary is kept by writing `import type`.

export type Read = (path: string) => string | undefined;

/** Reads from the repo (the working directory under Vitest). */
export const repoRead: Read = (path) =>
  existsSync(path) && statSync(path).isFile() ? readFileSync(path, 'utf8') : undefined;

/** The specifiers `source` imports at run time, in order. */
export function runtimeSpecifiers(source: string, fileName: string): string[] {
  const file = ts.createSourceFile(fileName, source, ts.ScriptTarget.ES2022, true);
  const out: string[] = [];
  const visit = (node: ts.Node): void => {
    if (ts.isImportDeclaration(node) && ts.isStringLiteral(node.moduleSpecifier)) {
      const clause = node.importClause;
      const named = clause?.namedBindings;
      const everyNameIsAType =
        clause !== undefined &&
        clause.name === undefined &&
        named !== undefined &&
        ts.isNamedImports(named) &&
        named.elements.length > 0 &&
        named.elements.every((e) => e.isTypeOnly);
      if (!(clause?.isTypeOnly ?? false) && !everyNameIsAType) out.push(node.moduleSpecifier.text);
    } else if (ts.isExportDeclaration(node) && node.moduleSpecifier && ts.isStringLiteral(node.moduleSpecifier)) {
      if (!node.isTypeOnly) out.push(node.moduleSpecifier.text);
    } else if (
      ts.isCallExpression(node) &&
      node.expression.kind === ts.SyntaxKind.ImportKeyword &&
      node.arguments[0] !== undefined &&
      ts.isStringLiteral(node.arguments[0])
    ) {
      out.push(node.arguments[0].text);
    }
    ts.forEachChild(node, visit);
  };
  visit(file);
  return out;
}

/** A relative specifier's file, as the bundler resolves it. */
export function resolveSpecifier(from: string, specifier: string, read: Read): string {
  // A Vite query (`./pass.glsl?raw`) names the same file.
  const base = posix.join(posix.dirname(from), specifier.split('?')[0] ?? specifier);
  for (const candidate of [base, `${base}.ts`, `${base}/index.ts`]) {
    if (read(candidate) !== undefined) return candidate;
  }
  throw new Error(`${from} imports '${specifier}', which resolves to no file`);
}

export interface RuntimeGraph {
  /** Every file reached, the entries included, sorted. */
  readonly files: string[];
  /** Every package imported on the way, sorted. */
  readonly packages: string[];
  /** For a reached file, the file that first imported it (an entry has none). */
  readonly via: ReadonlyMap<string, string>;
}

/** Everything reached at run time from `entries`. */
export function runtimeGraph(entries: string | readonly string[], read: Read): RuntimeGraph {
  const files = new Set<string>();
  const packages = new Set<string>();
  const via = new Map<string, string>();
  const queue: string[] = typeof entries === 'string' ? [entries] : [...entries];
  for (const entry of queue) files.add(entry);
  while (queue.length > 0) {
    const path = queue.shift() as string;
    if (!path.endsWith('.ts')) continue;
    const source = read(path);
    if (source === undefined) throw new Error(`no file ${path}`);
    for (const specifier of runtimeSpecifiers(source, path)) {
      if (!specifier.startsWith('.')) {
        packages.add(specifier);
        continue;
      }
      const target = resolveSpecifier(path, specifier, read);
      if (files.has(target)) continue;
      files.add(target);
      via.set(target, path);
      queue.push(target);
    }
  }
  return { files: [...files].sort(), packages: [...packages].sort(), via };
}

/** How `target` was reached: the chain of files from an entry down to it. */
export function chainTo(target: string, graph: RuntimeGraph): string[] {
  const chain = [target];
  for (let at = graph.via.get(target); at !== undefined; at = graph.via.get(at)) chain.unshift(at);
  return chain;
}
