/**
 * §95a — the prose marker + the two walkers the i18n layer rests on.
 *
 * THE DECLARATION IS THE MANIFEST. A config loader marks a user-facing
 * string field with `prose()` instead of `z.string()`; nothing else is
 * declared anywhere. `prosePatterns(schema)` derives the field paths by
 * walking the zod def tree (zod 4: `schema._zod.def.type` + `shape` /
 * `element` / `valueType` / `innerType` / `options`), and
 * `proseSites(family, schema, data)` walks the PARSED data along those
 * patterns to yield one site per prose value with a stable ADDRESS:
 *
 *   `<family>.<entity id>.<field path…>` — e.g. `events.corrupted-shrine.pages.start.text`
 *
 * Arrays are keyed by the element's string `id` when it has one, else by
 * index (an index address is a positional joint — the 95a spec gave event
 * choices an `id` for exactly this reason); records by key. The walker
 * throws on a zod shape it does not know (a new def type must be
 * dispositioned here, never silently skipped), on an address segment
 * containing the separator, and on an address collision.
 *
 * Consumers: `applyLocale` (locale.ts — resolves each site at catalog
 * load), the extract (extract.ts — `locales/en/<family>.json`), and the
 * sidecar pins (tests/i18n-en-extract.test.ts). Round 7 spec §5.
 */

import { z } from 'zod';

export const PROSE_META_KEY = 'prose';
export const ARRAY_STEP = '[]';
export const RECORD_STEP = '*';
export const ADDRESS_SEPARATOR = '.';

/** A user-facing prose string field: non-empty, and marked for the walkers. */
export function prose(): z.ZodString {
  return z.string().min(1).meta({ [PROSE_META_KEY]: true });
}

export function isProseSchema(schema: z.ZodType): boolean {
  const meta = z.globalRegistry.get(schema) as Record<string, unknown> | undefined;
  return meta?.[PROSE_META_KEY] === true;
}

/** The subset of zod 4's def shape the walker reads (internal API, pinned by the tests). */
interface ZodDefLike {
  readonly type: string;
  readonly shape?: Readonly<Record<string, z.ZodType>>;
  readonly element?: z.ZodType;
  readonly valueType?: z.ZodType;
  readonly innerType?: z.ZodType;
  readonly options?: readonly z.ZodType[];
  readonly in?: z.ZodType;
  readonly getter?: () => z.ZodType;
}

function defOf(schema: z.ZodType): ZodDefLike {
  return (schema as unknown as { _zod: { def: ZodDefLike } })._zod.def;
}

/** Path patterns (segment arrays) to every `prose()` leaf under `schema`. */
export function prosePatterns(schema: z.ZodType): readonly (readonly string[])[] {
  const out: string[][] = [];
  walkSchema(schema, [], out);
  return out;
}

function walkSchema(schema: z.ZodType, path: readonly string[], out: string[][]): void {
  const def = defOf(schema);
  switch (def.type) {
    case 'string':
      if (isProseSchema(schema)) out.push([...path]);
      return;
    case 'object':
      for (const [key, child] of Object.entries(def.shape ?? {})) walkSchema(child, [...path, key], out);
      return;
    case 'array':
      if (def.element) walkSchema(def.element, [...path, ARRAY_STEP], out);
      return;
    case 'record':
      if (def.valueType) walkSchema(def.valueType, [...path, RECORD_STEP], out);
      return;
    case 'optional':
    case 'nullable':
    case 'default':
    case 'nonoptional':
    case 'readonly':
    case 'catch':
      if (def.innerType) walkSchema(def.innerType, path, out);
      return;
    case 'union':
      for (const option of def.options ?? []) walkSchema(option, path, out);
      return;
    case 'pipe':
      if (def.in) walkSchema(def.in, path, out);
      return;
    case 'lazy':
      if (def.getter) walkSchema(def.getter(), path, out);
      return;
    case 'number':
    case 'boolean':
    case 'literal':
    case 'enum':
    case 'null':
    case 'undefined':
    case 'any':
    case 'unknown':
    case 'int':
    case 'bigint':
      return;
    default:
      throw new Error(
        `i18n: prosePatterns met an unknown zod def type '${def.type}' at '${path.join(ADDRESS_SEPARATOR) || '<root>'}' — disposition it in src/i18n/prose.ts (walk into it, or list it as a leaf)`,
      );
  }
}

/** One prose value in a parsed catalog: its address, its current (inline) value, and a setter. */
export interface ProseSite {
  readonly address: string;
  readonly value: string;
  set(next: string): void;
}

/** Every prose site in `data` (a parsed catalog), addressed `<family>.<…>`. */
export function proseSites(family: string, schema: z.ZodType, data: unknown): readonly ProseSite[] {
  const sites: ProseSite[] = [];
  const seen = new Set<string>();
  for (const pattern of prosePatterns(schema)) {
    walkData(data, pattern, 0, [family], (parent, key, address) => {
      const value: unknown = (parent as Record<string, unknown>)[key];
      if (value === undefined) return; // an absent optional prose field
      if (typeof value !== 'string') {
        throw new Error(`i18n: prose site '${address}' holds a ${typeof value}, not a string`);
      }
      if (seen.has(address)) {
        throw new Error(`i18n: prose address collision '${address}' — two sites resolve to one address (a duplicate id inside one array?)`);
      }
      seen.add(address);
      sites.push({
        address,
        value,
        set(next: string): void {
          (parent as Record<string, unknown>)[key] = next;
        },
      });
    });
  }
  return sites;
}

function segmentOf(raw: string, context: string): string {
  if (raw.includes(ADDRESS_SEPARATOR)) {
    throw new Error(`i18n: address segment '${raw}' (${context}) contains the separator '${ADDRESS_SEPARATOR}'`);
  }
  return raw;
}

function walkData(
  node: unknown,
  pattern: readonly string[],
  depth: number,
  address: readonly string[],
  visit: (parent: object, key: string, address: string) => void,
): void {
  if (node === null || typeof node !== 'object') return;
  const step = pattern[depth];
  if (step === undefined) return;
  const last = depth === pattern.length - 1;

  if (step === ARRAY_STEP) {
    if (!Array.isArray(node)) return;
    node.forEach((element: unknown, index) => {
      const id = elementId(element);
      const seg = segmentOf(id ?? String(index), `array element ${index} under '${address.join(ADDRESS_SEPARATOR)}'`);
      if (last) {
        throw new Error(`i18n: a prose pattern cannot end on an array step ('${address.join(ADDRESS_SEPARATOR)}')`);
      }
      walkData(element, pattern, depth + 1, [...address, seg], visit);
    });
    return;
  }

  if (step === RECORD_STEP) {
    for (const [key, child] of Object.entries(node as Record<string, unknown>)) {
      const seg = segmentOf(key, `record key under '${address.join(ADDRESS_SEPARATOR)}'`);
      if (last) {
        throw new Error(`i18n: a prose pattern cannot end on a record step ('${address.join(ADDRESS_SEPARATOR)}')`);
      }
      walkData(child, pattern, depth + 1, [...address, seg], visit);
    }
    return;
  }

  const next = [...address, segmentOf(step, 'schema key')];
  if (last) {
    visit(node, step, next.join(ADDRESS_SEPARATOR));
    return;
  }
  walkData((node as Record<string, unknown>)[step], pattern, depth + 1, next, visit);
}

function elementId(element: unknown): string | undefined {
  if (element === null || typeof element !== 'object' || Array.isArray(element)) return undefined;
  const id = (element as { id?: unknown }).id;
  return typeof id === 'string' && id.length > 0 ? id : undefined;
}
