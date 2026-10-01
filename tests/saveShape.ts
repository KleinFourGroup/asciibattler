import { join } from 'node:path';
import ts from 'typescript';

// THE SAVE'S STRUCTURE, read off the types (Round 8 spec D2).
//
// A save is rejected when its format changed, and the format is
// `RUN_SCHEMA_VERSION`. Nothing made a change of shape bump that number, so
// this prints `RunSnapshot` expanded to its leaves by the type checker, and
// tests/save-fingerprint.test.ts holds the print against the pinned copy
// (tests/run-snapshot-shape.txt): a change of shape fails `npm test` until
// the version is bumped and the copy re-pinned (`npm run save:fingerprint`).
//
// Why the types and not shapes taken from driven runs: a run only shows the
// fields it reaches, and a stale save bites in the variants no fixture run
// reaches (a docked port, a mid-event page, a pinned reward). The types name
// every variant. What they can't see is a change of meaning with no change
// of type (a status key renamed inside a string); those bumps stay a
// reviewer's call, as they were.
//
// THE PRINT. A type declared in the repo by name is printed once, as
// `Name = …` with one property a line, and referred to by its name; anything
// else is printed in place. Properties and union members are sorted, so the
// print doesn't move when a declaration is reordered. `?` marks an optional
// property. `readonly` is not printed: it isn't in the save.

export interface SaveShape {
  /** `RUN_SCHEMA_VERSION`, read from the literal type of `RunSnapshot.schemaVersion`. */
  readonly version: number;
  /** The definitions, `RunSnapshot` first, then the named types by name. */
  readonly body: string;
}

const ROOT_FILE = 'src/run/Run.ts';
const ROOT_TYPE = 'RunSnapshot';
const VERSION_PROPERTY = 'schemaVersion';
const VERSION_PLACEHOLDER = '<RUN_SCHEMA_VERSION>';

/** Expand `typeName`, exported from `file`, with the repo's tsconfig. */
export function shapeOfType(repo: string, file: string, typeName: string): SaveShape {
  const configPath = join(repo, 'tsconfig.json');
  const config = ts.parseJsonConfigFileContent(ts.readConfigFile(configPath, ts.sys.readFile).config, ts.sys, repo);
  const program = ts.createProgram({ rootNames: [join(repo, file)], options: { ...config.options, noEmit: true } });
  const checker = program.getTypeChecker();
  const source = program.getSourceFile(join(repo, file));
  const moduleSymbol = source === undefined ? undefined : checker.getSymbolAtLocation(source);
  const symbol = moduleSymbol === undefined ? undefined : checker.getExportsOfModule(moduleSymbol).find((s) => s.name === typeName);
  if (symbol === undefined) throw new Error(`saveShape: ${file} exports no type ${typeName}`);
  const root = checker.getDeclaredTypeOfSymbol(symbol);

  /** Whether a symbol is declared in the repo's own source (not a library's). */
  const declaredHere = (s: ts.Symbol | undefined): boolean =>
    s?.declarations?.some((d) => {
      const f = d.getSourceFile();
      return !program.isSourceFileFromExternalLibrary(f) && !program.isSourceFileDefaultLibrary(f);
    }) ?? false;

  const definitions = new Map<string, string>();
  const labels = new Map<ts.Type, string>();
  const taken = new Map<string, number>();
  let version: number | null = null;

  /** The name a type is printed under, when the repo declares it by one. */
  const nameOf = (type: ts.Type): string | null => {
    if (type.aliasSymbol !== undefined) {
      if (type.aliasTypeArguments !== undefined && type.aliasTypeArguments.length > 0) return null;
      return declaredHere(type.aliasSymbol) ? type.aliasSymbol.name : null;
    }
    const s = type.getSymbol();
    if (s === undefined || !declaredHere(s)) return null;
    if ((s.flags & (ts.SymbolFlags.Interface | ts.SymbolFlags.Class | ts.SymbolFlags.Enum)) === 0) return null;
    const args = checker.getTypeArguments(type as ts.TypeReference);
    return args.length > 0 ? null : s.name;
  };

  const literal = (type: ts.Type): string | null => {
    const f = type.flags;
    if (f & ts.TypeFlags.Any) return 'any';
    if (f & ts.TypeFlags.Unknown) return 'unknown';
    if (f & ts.TypeFlags.StringLiteral) return JSON.stringify((type as ts.StringLiteralType).value);
    if (f & ts.TypeFlags.NumberLiteral) return String((type as ts.NumberLiteralType).value);
    if (f & ts.TypeFlags.BooleanLiteral) return checker.typeToString(type);
    if (f & ts.TypeFlags.String) return 'string';
    if (f & ts.TypeFlags.Number) return 'number';
    if (f & ts.TypeFlags.Boolean) return 'boolean';
    if (f & ts.TypeFlags.BigIntLike) return 'bigint';
    if (f & ts.TypeFlags.Null) return 'null';
    if (f & ts.TypeFlags.Undefined) return 'undefined';
    if (f & ts.TypeFlags.Void) return 'void';
    if (f & ts.TypeFlags.Never) return 'never';
    if (f & ts.TypeFlags.ESSymbolLike) return 'symbol';
    if (f & ts.TypeFlags.TypeParameter) return `<${checker.typeToString(type)}>`;
    return null;
  };

  /** A property list, one a line when `lines`, else in place. */
  const members = (type: ts.Type, lines: boolean, isRoot: boolean): string => {
    const parts: string[] = [];
    for (const info of checker.getIndexInfosOfType(type)) parts.push(`[${print(info.keyType)}]: ${print(info.type)}`);
    const properties = [...checker.getPropertiesOfType(type)].sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
    for (const property of properties) {
      const optional = (property.flags & ts.SymbolFlags.Optional) !== 0 ? '?' : '';
      const propertyType = checker.getTypeOfSymbol(property);
      if (isRoot && property.name === VERSION_PROPERTY) {
        if ((propertyType.flags & ts.TypeFlags.NumberLiteral) === 0) {
          throw new Error(`saveShape: ${typeName}.${VERSION_PROPERTY} is not a number literal type`);
        }
        version = (propertyType as ts.NumberLiteralType).value;
        parts.push(`${property.name}: ${VERSION_PLACEHOLDER}`);
        continue;
      }
      parts.push(`${property.name}${optional}: ${print(propertyType)}`);
    }
    if (parts.length === 0) return '{}';
    return lines ? `{\n${parts.map((p) => `  ${p}`).join('\n')}\n}` : `{ ${parts.join('; ')} }`;
  };

  /** A type's own print, ignoring any name it has. */
  const expand = (type: ts.Type, lines: boolean, isRoot: boolean): string => {
    const simple = literal(type);
    if (simple !== null) return simple;
    if (type.isUnion()) {
      const parts = [...new Set(type.types.map((t) => print(t)))].sort();
      const both = parts.includes('true') && parts.includes('false');
      const merged = both ? [...parts.filter((p) => p !== 'true' && p !== 'false'), 'boolean'].sort() : parts;
      return merged.join(' | ');
    }
    if (checker.isTupleType(type)) return `[${checker.getTypeArguments(type as ts.TypeReference).map((t) => print(t)).join(', ')}]`;
    if (checker.isArrayType(type)) return `Array<${print(checker.getTypeArguments(type as ts.TypeReference)[0] as ts.Type)}>`;
    if (type.getCallSignatures().length > 0 || type.getConstructSignatures().length > 0) return 'function';
    const s = type.getSymbol();
    if (s !== undefined && !declaredHere(s) && (s.flags & (ts.SymbolFlags.Interface | ts.SymbolFlags.Class)) !== 0) {
      // A library's own type (a Map, a Set, a Date): by its name, never its methods.
      const args = checker.getTypeArguments(type as ts.TypeReference);
      return args.length > 0 ? `${s.name}<${args.map((t) => print(t)).join(', ')}>` : s.name;
    }
    return members(type, lines, isRoot);
  };

  function print(type: ts.Type): string {
    const known = labels.get(type);
    if (known !== undefined) return known;
    const name = nameOf(type);
    if (name === null) return expand(type, false, false);
    // Two different types can share a name across files; the second gets a number.
    const count = (taken.get(name) ?? 0) + 1;
    taken.set(name, count);
    const label = count === 1 ? name : `${name}#${count}`;
    // Labelled before it is expanded, so a type that contains itself refers back by name.
    labels.set(type, label);
    definitions.set(label, expand(type, true, false));
    return label;
  }

  labels.set(root, typeName);
  taken.set(typeName, 1);
  const rootBody = expand(root, true, true);
  if (version === null) throw new Error(`saveShape: ${typeName} has no ${VERSION_PROPERTY}`);
  const rest = [...definitions.entries()].sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
  const body = [`${typeName} = ${rootBody}`, ...rest.map(([label, text]) => `${label} = ${text}`)].join('\n\n');
  return { version, body };
}

/** `RunSnapshot`'s structure and `RUN_SCHEMA_VERSION`, from the repo at `repo`. */
export function runSnapshotShape(repo: string = process.cwd()): SaveShape {
  return shapeOfType(repo, ROOT_FILE, ROOT_TYPE);
}

// --- the pinned copy ---------------------------------------------------------

export const PIN_FILE = 'tests/run-snapshot-shape.txt';
const HEADER = [
  "# RunSnapshot's structure, expanded by the type checker (tests/saveShape.ts).",
  '# tests/save-fingerprint.test.ts holds this file against the types: a change of',
  '# shape fails until RUN_SCHEMA_VERSION is bumped and this file is re-pinned with',
  '#   npm run save:fingerprint',
];
const VERSION_LINE = /^RUN_SCHEMA_VERSION (\d+)$/;
const NOTE_PREFIX = '# re-pinned without a bump: ';

export interface Pin extends SaveShape {
  /** Why the shape was re-pinned at this version without a bump, oldest first. */
  readonly notes: readonly string[];
}

export function formatPin(pin: Pin): string {
  return [...HEADER, ...pin.notes.map((n) => `${NOTE_PREFIX}${n}`), `RUN_SCHEMA_VERSION ${pin.version}`, '', pin.body, ''].join('\n');
}

export function parsePin(text: string): Pin {
  const lines = text.split('\n');
  const at = lines.findIndex((l) => VERSION_LINE.test(l));
  if (at < 0) throw new Error(`${PIN_FILE} has no RUN_SCHEMA_VERSION line`);
  const version = Number((VERSION_LINE.exec(lines[at] as string) as RegExpExecArray)[1]);
  const notes = lines.slice(0, at).filter((l) => l.startsWith(NOTE_PREFIX)).map((l) => l.slice(NOTE_PREFIX.length));
  const body = lines.slice(at + 1).join('\n').trim();
  return { version, body, notes };
}

export type Verdict =
  | { readonly kind: 'current' }
  /** The shape moved and the version didn't: the mistake this guard exists for. */
  | { readonly kind: 'shape-changed-without-bump'; readonly message: string }
  /** The version moved (with or without the shape): only the pinned copy is behind. */
  | { readonly kind: 'pin-behind'; readonly message: string };

/** The first line that differs, for the failure message. */
function firstDifference(pinned: string, current: string): string {
  const a = pinned.split('\n');
  const b = current.split('\n');
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    if (a[i] !== b[i]) return `line ${i + 1}:\n  pinned:  ${a[i] ?? '(nothing)'}\n  now:     ${b[i] ?? '(nothing)'}`;
  }
  return 'no line differs';
}

export function judge(pinned: Pin, current: SaveShape): Verdict {
  const sameShape = pinned.body === current.body;
  if (sameShape && pinned.version === current.version) return { kind: 'current' };
  if (!sameShape && pinned.version === current.version) {
    return {
      kind: 'shape-changed-without-bump',
      message:
        `RunSnapshot's structure changed and RUN_SCHEMA_VERSION is still ${current.version}. ` +
        `A save written before this change would load into the new shape, so bump RUN_SCHEMA_VERSION ` +
        `(src/run/Run.ts) and then run \`npm run save:fingerprint\`. If a save from before the change ` +
        `still loads correctly, re-pin without a bump and say why: ` +
        `\`npm run save:fingerprint -- --compatible="<reason>"\`.\nFirst difference, ${firstDifference(pinned.body, current.body)}`,
    };
  }
  return {
    kind: 'pin-behind',
    message:
      `RUN_SCHEMA_VERSION is ${current.version} and ${PIN_FILE} was pinned at ${pinned.version}` +
      `${sameShape ? ' (the structure is unchanged)' : ''}: run \`npm run save:fingerprint\`.`,
  };
}

export type Repin =
  | { readonly kind: 'unchanged' }
  | { readonly kind: 'write'; readonly text: string }
  | { readonly kind: 'refuse'; readonly message: string };

/**
 * What `npm run save:fingerprint` does. It refuses to re-pin a changed shape
 * at an unchanged version unless a reason is given, and the reason is written
 * into the file, where a reviewer sees it; a bump clears the old reasons.
 */
export function repin(pinnedText: string | null, current: SaveShape, compatibleReason: string | null): Repin {
  if (pinnedText === null) return { kind: 'write', text: formatPin({ ...current, notes: [] }) };
  const pinned = parsePin(pinnedText);
  const verdict = judge(pinned, current);
  if (verdict.kind === 'current') return { kind: 'unchanged' };
  if (verdict.kind === 'pin-behind') return { kind: 'write', text: formatPin({ ...current, notes: [] }) };
  if (compatibleReason === null || compatibleReason.trim() === '') return { kind: 'refuse', message: verdict.message };
  return { kind: 'write', text: formatPin({ ...current, notes: [...pinned.notes, compatibleReason.trim()] }) };
}
