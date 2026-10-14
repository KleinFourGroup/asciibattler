/**
 * WHO READS THIS: a name's references, found with types and sorted by the
 * kind of code that makes them.
 *
 * `git grep` finds a word; this finds a symbol. `startingBits` is a key of
 * config/difficulty.json and a field of `RunConfig`, and a grep cannot tell the
 * two apart. The finder asks TypeScript's language service, which follows a
 * key from the zod schema that declares it, through the inferred type, to
 * each place the parsed config is read. A dial with no reader, an export
 * nothing imports and an export only its own test imports are all the same
 * question, asked of a different declaration:
 *
 *   exportsOf   every export a source file declares
 *   schemaKeys  every key of every `z.object({…})` and `.extend({…})` in a file
 *   membersOf   every member of a named interface or type literal
 *
 * A reference is sorted by the file that makes it:
 *
 *   own         the file that declares the name
 *   game        src, outside src/dev and src/bot
 *   dev         src/dev
 *   instrument  src/bot, and the drivers under tests/ (fuzz, gauntlet, pathing, board, chaos, oracle)
 *   tool        tools/
 *   script      scripts/
 *   test        any *.test.ts or *.proof.ts, and the helpers directly under tests/
 *
 * and is a WRITE when it sets the name (an object literal that builds the
 * value, an assignment), a PASS when it only hands the name on (an import or
 * a re-export), and a read otherwise. `const { key } = config` is a read. So
 * is `{ name }` for the variable `name` (for the property it builds, it is a
 * write), and so is a step or a compound assignment whose result is used
 * (`id = ++seq`); `seq++` as a statement only writes. An assignment that
 * unpacks, `({ key } = config)`, is taken for a write.
 *
 * WHAT IT CANNOT SEE. A read by a computed key (`STATS[name]`), a spread or a
 * whole-object use (`{ ...HEALTH }`, `JSON.stringify(config)`), and anything
 * outside the program: the `.mjs` scripts, the shell, the tools' HTML. So a
 * name with no reference is a candidate and not yet a verdict; the read of
 * its site is still owed. `computedReads` lists the first kind, so that its
 * size is known.
 *
 * A SCHEMA TYPED BY A HAND-WRITTEN INTERFACE HIDES ITS KEYS. Where a loader
 * writes `z.ZodType<EventDef>` over its schema, or casts to one, the parsed
 * value has the interface's type, and every read is a read of the
 * interface's member, not of the schema's key. `schemaKeys` then reports the
 * whole schema unread (config/events and config/encounters read so). For
 * those, ask `membersOf` of the interface.
 */

import { readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import ts from 'typescript';

export const READER_KINDS = ['own', 'game', 'dev', 'instrument', 'tool', 'script', 'test'] as const;
export type ReaderKind = (typeof READER_KINDS)[number];

export interface Reference {
  readonly file: string;
  readonly line: number;
  readonly kind: ReaderKind;
  readonly use: 'read' | 'write' | 'pass';
}

export interface Named {
  readonly file: string;
  readonly line: number;
  /** An export's name; a schema key's path (`HealthSchema.restHealFraction`); `RunConfig.seed`. */
  readonly name: string;
  readonly what: string;
  readonly references: readonly Reference[];
}

export interface Project {
  readonly service: ts.LanguageService;
  readonly program: ts.Program;
  /** The source file at a repo-relative path. */
  readonly source: (file: string) => ts.SourceFile;
  readonly relative: (fileName: string) => string;
}

/** Which kind of code `file` is, as a reader of a name declared in `declaredIn`. */
export function readerKind(file: string, declaredIn: string): ReaderKind {
  if (file === declaredIn) return 'own';
  if (/\.(test|proof)\.ts$/.test(file)) return 'test';
  if (file.startsWith('src/bot/')) return 'instrument';
  if (file.startsWith('src/dev/')) return 'dev';
  if (file.startsWith('src/')) return 'game';
  if (file.startsWith('tools/')) return 'tool';
  if (file.startsWith('scripts/')) return 'script';
  if (/^tests\/(fuzz|gauntlet|pathing|board|chaos|oracle)\//.test(file)) return 'instrument';
  return 'test';
}

/**
 * The repo as one program: what tsconfig.json includes, and the `.ts` files
 * under scripts/, which it leaves out. `virtual` adds or replaces files by
 * repo-relative path; with `only`, the program is those files and what they
 * import, which is what a unit test wants.
 */
export function openProject(root = '.', virtual: ReadonlyMap<string, string> = new Map(), only = false): Project {
  const here = resolve(root).split('\\').join('/');
  const abs = (file: string): string => `${here}/${file}`;
  const relative = (fileName: string): string => {
    const path = fileName.split('\\').join('/');
    return path.toLowerCase().startsWith(`${here.toLowerCase()}/`) ? path.slice(here.length + 1) : path;
  };
  const parsed = ts.getParsedCommandLineOfConfigFile(abs('tsconfig.json'), {}, {
    ...ts.sys,
    onUnRecoverableConfigFileDiagnostic: (d) => {
      throw new Error(`refs: ${ts.flattenDiagnosticMessageText(d.messageText, ' ')}`);
    },
  });
  if (parsed === undefined) throw new Error('refs: tsconfig.json did not parse');
  const scripts = only ? [] : readdirSync(abs('scripts')).filter((f) => f.endsWith('.ts') && !f.endsWith('.d.ts')).map((f) => abs(`scripts/${f}`));
  const names = [...(only ? [] : parsed.fileNames), ...scripts, ...[...virtual.keys()].map(abs)];
  const planted = new Map([...virtual].map(([file, text]) => [abs(file).toLowerCase(), text]));
  const read = (fileName: string): string | undefined => planted.get(fileName.split('\\').join('/').toLowerCase()) ?? ts.sys.readFile(fileName);
  // A planted file's folder need not be on disk, and the resolver asks before it looks for the file.
  const plantedFolders = new Set([...planted.keys()].map((path) => path.slice(0, path.lastIndexOf('/'))));
  const isFolder = (path: string): boolean => plantedFolders.has(path.split('\\').join('/').toLowerCase()) || ts.sys.directoryExists(path);
  const host: ts.LanguageServiceHost = {
    getScriptFileNames: () => names,
    getScriptVersion: () => '1',
    getScriptSnapshot: (fileName) => {
      const text = read(fileName);
      return text === undefined ? undefined : ts.ScriptSnapshot.fromString(text);
    },
    getCurrentDirectory: () => here,
    getCompilationSettings: () => parsed.options,
    getDefaultLibFileName: ts.getDefaultLibFilePath,
    fileExists: (fileName) => read(fileName) !== undefined,
    readFile: read,
    readDirectory: ts.sys.readDirectory,
    directoryExists: isFolder,
    getDirectories: ts.sys.getDirectories,
  };
  const service = ts.createLanguageService(host, ts.createDocumentRegistry());
  const program = service.getProgram();
  if (program === undefined) throw new Error('refs: no program');
  const source = (file: string): ts.SourceFile => {
    const found = program.getSourceFile(abs(file));
    if (found === undefined) throw new Error(`refs: ${file} is not in the program`);
    return found;
  };
  return { service, program, source, relative };
}

/** The deepest node that holds `position`. */
function nodeAt(file: ts.SourceFile, position: number): ts.Node {
  let node: ts.Node = file;
  for (;;) {
    const child: ts.Node | undefined = node.forEachChild((c) => (c.getStart(file) <= position && position < c.end ? c : undefined));
    if (child === undefined) return node;
    node = child;
  }
}

const lineOf = (file: ts.SourceFile, position: number): number => file.getLineAndCharacterOfPosition(position).line + 1;

/**
 * Whether the name at `node` is stepped or compound-assigned (`++n`, `n += 1`)
 * where the result is used: `id = ++seq` reads `seq` as well as writing it. As
 * a statement of its own, or as a loop's step, it only writes.
 */
function readsWhatItWrites(node: ts.Node): boolean {
  let operand = node;
  while (operand.parent !== undefined && ts.isPropertyAccessExpression(operand.parent) && operand.parent.name === operand) operand = operand.parent;
  const write = operand.parent;
  if (write === undefined) return false;
  const steps = (ts.isPrefixUnaryExpression(write) || ts.isPostfixUnaryExpression(write)) && (write.operator === ts.SyntaxKind.PlusPlusToken || write.operator === ts.SyntaxKind.MinusMinusToken);
  const compound = ts.isBinaryExpression(write) && write.left === operand && write.operatorToken.kind >= ts.SyntaxKind.FirstCompoundAssignment && write.operatorToken.kind <= ts.SyntaxKind.LastCompoundAssignment;
  if (!steps && !compound) return false;
  let holder = write.parent;
  while (ts.isParenthesizedExpression(holder)) holder = holder.parent;
  return !ts.isExpressionStatement(holder) && !ts.isForStatement(holder);
}

/** Every reference to the name declared at `name`, the declaration itself left out. */
function referencesTo(project: Project, name: ts.Node): Reference[] {
  const declaring = name.getSourceFile();
  const declaredIn = project.relative(declaring.fileName);
  const at = name.getStart(declaring);
  const out: Reference[] = [];
  const seen = new Set<string>();
  // A member is asked by its name in a literal, a signature or a class body; any other name is a variable's, a function's or a type's.
  const owner = name.parent;
  const asksMember = ts.isPropertyAssignment(owner) || ts.isShorthandPropertyAssignment(owner) || ts.isPropertySignature(owner) || ts.isPropertyDeclaration(owner) || ts.isMethodSignature(owner) || ts.isMethodDeclaration(owner) || ts.isAccessor(owner);
  for (const symbol of project.service.findReferences(declaring.fileName, at) ?? []) {
    for (const ref of symbol.references) {
      const file = project.relative(ref.fileName);
      const key = `${file}:${ref.textSpan.start}`;
      if ((file === declaredIn && ref.textSpan.start === at) || seen.has(key)) continue;
      seen.add(key);
      const sourceFile = project.program.getSourceFile(ref.fileName);
      if (sourceFile === undefined) continue;
      const node = nodeAt(sourceFile, ref.textSpan.start);
      const parent = node.parent;
      const passes = parent !== undefined && (ts.isImportSpecifier(parent) || ts.isExportSpecifier(parent) || ts.isImportClause(parent) || ts.isNamespaceImport(parent));
      // `const { key } = config` reads the key, though it writes the local it declares.
      const unpacks = parent !== undefined && ts.isBindingElement(parent);
      // `{ name }` builds a property out of the variable `name`: a read of the variable, and a write of the property.
      const handsOn = !asksMember && parent !== undefined && ts.isShorthandPropertyAssignment(parent);
      const reads = unpacks || handsOn || readsWhatItWrites(node);
      out.push({ file, line: lineOf(sourceFile, ref.textSpan.start), kind: readerKind(file, declaredIn), use: passes ? 'pass' : ref.isWriteAccess && !reads ? 'write' : 'read' });
    }
  }
  return out.sort((a, b) => (a.file < b.file ? -1 : a.file > b.file ? 1 : a.line - b.line));
}

/** The name declared at `name`, with its references: for a caller that found the declaration itself. */
export const named = (project: Project, name: ts.Node, label: string, what: string): Named => {
  const file = name.getSourceFile();
  return { file: project.relative(file.fileName), line: lineOf(file, name.getStart(file)), name: label, what, references: referencesTo(project, name) };
};

const isExported = (node: ts.Node): boolean => ts.canHaveModifiers(node) && (ts.getModifiers(node) ?? []).some((m) => m.kind === ts.SyntaxKind.ExportKeyword);

/** The identifiers a binding declares: `a`, or each name inside `{ a, b: [c] }`. */
function boundNames(name: ts.BindingName): ts.Identifier[] {
  return ts.isIdentifier(name) ? [name] : name.elements.flatMap((element) => (ts.isOmittedExpression(element) ? [] : boundNames(element.name)));
}

/**
 * Every export `file` declares, with its references. A re-export of another
 * module's name (`export { x } from`, `export *`) declares nothing here and is
 * a pass of the name where it is declared. A default export is not followed.
 */
export function exportsOf(project: Project, file: string): Named[] {
  const source = project.source(file);
  const checker = project.program.getTypeChecker();
  const out: Named[] = [];
  for (const statement of source.statements) {
    if (ts.isVariableStatement(statement) && isExported(statement)) {
      const what = statement.declarationList.flags & ts.NodeFlags.Const ? 'const' : 'let';
      for (const declaration of statement.declarationList.declarations) for (const name of boundNames(declaration.name)) out.push(named(project, name, name.text, what));
    } else if (
      (ts.isFunctionDeclaration(statement) || ts.isClassDeclaration(statement) || ts.isInterfaceDeclaration(statement) || ts.isTypeAliasDeclaration(statement) || ts.isEnumDeclaration(statement)) &&
      isExported(statement) &&
      statement.name !== undefined
    ) {
      const what = ts.isFunctionDeclaration(statement) ? 'function' : ts.isClassDeclaration(statement) ? 'class' : ts.isInterfaceDeclaration(statement) ? 'interface' : ts.isTypeAliasDeclaration(statement) ? 'type' : 'enum';
      out.push(named(project, statement.name, statement.name.text, what));
    } else if (ts.isExportDeclaration(statement) && statement.moduleSpecifier === undefined && statement.exportClause !== undefined && ts.isNamedExports(statement.exportClause)) {
      // `export { a, b as c }`: the local declaration is what is read.
      for (const specifier of statement.exportClause.elements) {
        const local = checker.getExportSpecifierLocalTargetSymbol(specifier)?.declarations?.[0];
        const name = ts.getNameOfDeclaration(local);
        if (name !== undefined && name.getSourceFile() === source) out.push(named(project, name, specifier.name.text, 'export list'));
      }
    }
  }
  return out;
}

const SCHEMA_MAKERS = new Set(['object', 'strictObject', 'looseObject', 'extend', 'safeExtend']);
const calls = (node: ts.Node, names: ReadonlySet<string> | string): boolean =>
  ts.isCallExpression(node) && ts.isPropertyAccessExpression(node.expression) && (typeof names === 'string' ? node.expression.name.text === names : names.has(node.expression.name.text));

/**
 * Every key of every `z.object({…})` (or `.extend({…})`) in `file`, by its
 * path from the schema's name: `PricesSchema.units.rarityMultiplier.common`.
 * `[]` marks an array's element and `{}` a record's value.
 */
export function schemaKeys(project: Project, file: string): Named[] {
  return schemaKeyNodes(project, file).map(({ node, path }) => named(project, node, path, 'key'));
}

/** Each schema key's name node with its path: for a caller that asks about the declaration itself. */
export function schemaKeyNodes(project: Project, file: string): { readonly node: ts.Node; readonly path: string }[] {
  const source = project.source(file);
  const out: { node: ts.Node; path: string }[] = [];
  const pathOf = (property: ts.Node): string => {
    const parts: string[] = [];
    for (let node: ts.Node | undefined = property; node !== undefined && !ts.isSourceFile(node); node = node.parent) {
      if ((ts.isPropertyAssignment(node) || ts.isShorthandPropertyAssignment(node)) && (ts.isIdentifier(node.name) || ts.isStringLiteral(node.name))) parts.unshift(node.name.text);
      else if (calls(node, 'array')) parts.unshift('[]');
      else if (calls(node, 'record')) parts.unshift('{}');
      else if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name)) {
        parts.unshift(node.name.text);
        break;
      }
    }
    return parts.join('.');
  };
  const visit = (node: ts.Node): void => {
    if (calls(node, SCHEMA_MAKERS)) {
      const shape = (node as ts.CallExpression).arguments[0];
      if (shape !== undefined && ts.isObjectLiteralExpression(shape)) {
        for (const property of shape.properties) {
          if ((ts.isPropertyAssignment(property) || ts.isShorthandPropertyAssignment(property)) && (ts.isIdentifier(property.name) || ts.isStringLiteral(property.name))) {
            out.push({ node: property.name, path: pathOf(property) });
          }
        }
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
  return out;
}

/** Every member of the interface or type literal called `typeName` in `file`. */
export function membersOf(project: Project, file: string, typeName: string): Named[] {
  const source = project.source(file);
  for (const statement of source.statements) {
    const members = ts.isInterfaceDeclaration(statement) && statement.name.text === typeName ? statement.members : ts.isTypeAliasDeclaration(statement) && statement.name.text === typeName && ts.isTypeLiteralNode(statement.type) ? statement.type.members : undefined;
    if (members === undefined) continue;
    return members.flatMap((member) => (member.name !== undefined && (ts.isIdentifier(member.name) || ts.isStringLiteral(member.name)) ? [named(project, member.name, `${typeName}.${member.name.text}`, 'member')] : []));
  }
  throw new Error(`refs: ${file} declares no interface or type literal named ${typeName}`);
}

export interface ComputedRead {
  readonly file: string;
  readonly line: number;
  /** The type whose declared properties are read by a key the finder cannot follow. */
  readonly of: string;
}

/**
 * Every `x[key]` in `files` where `key` is not a literal and `x` has declared
 * properties of its own: not an array, a tuple, or a type with an index
 * signature. Each is a read that `referencesTo` cannot attribute to a name.
 */
export function computedReads(project: Project, files: readonly string[]): ComputedRead[] {
  const checker = project.program.getTypeChecker();
  const out: ComputedRead[] = [];
  for (const file of files) {
    const source = project.source(file);
    const visit = (node: ts.Node): void => {
      if (ts.isElementAccessExpression(node) && !ts.isStringLiteralLike(node.argumentExpression) && !ts.isNumericLiteral(node.argumentExpression)) {
        const type = checker.getNonNullableType(checker.getTypeAtLocation(node.expression));
        const indexed = checker.isArrayType(type) || checker.isTupleType(type) || checker.getIndexInfosOfType(type).length > 0 || (type.flags & (ts.TypeFlags.Any | ts.TypeFlags.StringLike)) !== 0;
        if (!indexed && checker.getPropertiesOfType(type).length > 0) out.push({ file, line: lineOf(source, node.getStart(source)), of: checker.typeToString(type).slice(0, 60) });
      }
      ts.forEachChild(node, visit);
    };
    visit(source);
  }
  return out;
}

/** How many references of each kind and use a name has: `count(n, 'game', 'read')`. */
export const count = (item: Named, kind: ReaderKind | 'any', use: Reference['use'] | 'any' = 'any'): number =>
  item.references.filter((r) => (kind === 'any' || r.kind === kind) && (use === 'any' || r.use === use)).length;

/**
 * Where a name stands, from its references alone:
 *   unread       nothing reads it, anywhere
 *   own-only     only the file that declares it reads it
 *   test-only    outside its own file, only tests read it
 *   used         the game, the dev build, an instrument, a tool or a script reads it
 * A write or a pass is not a read: a field that tests set and nothing reads
 * is `unread`.
 */
export function standing(item: Named): 'unread' | 'own-only' | 'test-only' | 'used' {
  const reads = (kind: ReaderKind): number => count(item, kind, 'read');
  if (reads('game') + reads('dev') + reads('instrument') + reads('tool') + reads('script') > 0) return 'used';
  if (reads('test') > 0) return 'test-only';
  return reads('own') > 0 ? 'own-only' : 'unread';
}
