/**
 * Two versions of a page's stylesheets held equal by their cascade: the
 * proof for a change that moves rules between sheets and means to change no
 * style. `npm run oracle -- css-compare <ref> [sheet…]`.
 *
 * A page is its entry sheet (`tools/<page>/editor.css`), read with the
 * sheets it `@import`s by a relative path, each in the place of its
 * `@import`, as Vite inlines them. Each style rule is read as one
 * declaration per selector of its list: the `@media` around it, the
 * selector, the property, the value and whether it is `!important`, in the
 * order the page's sheets give them. Values are compared as written, so a
 * renamed variable is a difference.
 *
 * Two checks hold a page equal, and between them they hold for any document
 * the page could show:
 *
 * 1. The declarations in effect are the same. For one selector in one
 *    context, a later declaration of a property hides an earlier one, so
 *    only the last of each context, selector, property and importance is
 *    kept, and the two sides must hold the same ones with the same values.
 * 2. None of them changes order where order decides. The cascade picks a
 *    winner by importance, then specificity, then order, so two
 *    declarations whose order flipped can change a winner only when they set
 *    overlapping properties (a shorthand overlaps its longhands) with the
 *    same importance and specificity, on selectors that can style one box.
 *    Two that name different element types, ids or pseudo-elements cannot;
 *    whether any other two meet cannot be read from the sheets, so every
 *    such pair is named.
 *
 * It reads no document, so it proves the cascade and not that a page loads
 * its sheets in the order assumed here; the browser shows that. An at-rule
 * other than `@media` and `@import` is refused, since a layer or a scope
 * would change the order the second check relies on, and so is a nested
 * rule. A bare module's `@import` (a font package) is held as a line of its
 * own, present on both sides or a difference.
 *
 * Every run carries its failing control (`controlCss`): each page that
 * passed is compared again with one rule appended to its entry sheet, and
 * must be named.
 */

import { posix } from 'node:path';
import { blocksOf, stripCssComments } from '../cssBlocks';
import type { Tree } from './strippedCompare';

export interface Declaration {
  /** The `@media` preludes around the rule, outermost first, joined by ` / `; '' for none. */
  readonly context: string;
  readonly selector: string;
  readonly property: string;
  readonly value: string;
  readonly important: boolean;
  /** The sheet it was read from. */
  readonly sheet: string;
  /** Its place among the page's declarations, in load order. */
  readonly order: number;
}

export interface Page {
  readonly declarations: readonly Declaration[];
  /** `@import`s of anything but a relative path, in the order met. */
  readonly bareImports: readonly string[];
}

export type CssDifference =
  | { readonly page: string; readonly what: 'changed'; readonly before: Declaration; readonly after: Declaration }
  | { readonly page: string; readonly what: 'dropped'; readonly before: Declaration }
  | { readonly page: string; readonly what: 'added'; readonly after: Declaration }
  | { readonly page: string; readonly what: 'import'; readonly detail: string }
  | { readonly page: string; readonly what: 'order'; readonly first: Declaration; readonly second: Declaration }
  | { readonly page: string; readonly what: 'unreadable'; readonly detail: string };

const collapse = (s: string): string => s.trim().replace(/\s+/g, ' ');

/** `text` cut at each `separator` that sits outside quotes, parentheses and brackets. */
function splitTopLevel(text: string, separator: string): string[] {
  const out: string[] = [];
  let depth = 0;
  let quote: string | null = null;
  let start = 0;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i]!;
    if (quote !== null) {
      if (ch === '\\') i++;
      else if (ch === quote) quote = null;
    } else if (ch === '"' || ch === "'") quote = ch;
    else if (ch === '(' || ch === '[') depth++;
    else if (ch === ')' || ch === ']') depth--;
    else if (ch === separator && depth === 0) {
      out.push(text.slice(start, i));
      start = i + 1;
    }
  }
  out.push(text.slice(start));
  return out;
}

/** A value's whitespace collapsed outside its quoted strings. */
function normalizeValue(value: string): string {
  let out = '';
  let quote: string | null = null;
  for (let i = 0; i < value.length; i++) {
    const ch = value[i]!;
    if (quote !== null) {
      out += ch;
      if (ch === '\\' && i + 1 < value.length) out += value[++i];
      else if (ch === quote) quote = null;
    } else if (ch === '"' || ch === "'") {
      quote = ch;
      out += ch;
    } else if (/\s/.test(ch)) {
      if (!out.endsWith(' ')) out += ' ';
    } else out += ch;
  }
  return out.trim();
}

interface ReadRule {
  readonly context: string;
  readonly selectors: readonly string[];
  readonly declarations: readonly { property: string; value: string; important: boolean }[];
}
interface ReadSheet {
  readonly imports: readonly string[];
  readonly rules: readonly ReadRule[];
}

/** A `@import` statement's target: the quoted string or `url(…)` after the keyword. */
function importTarget(statement: string, sheet: string): string {
  const m = /^@import\s+(?:url\(\s*)?(['"])(.*?)\1/i.exec(statement);
  if (m === null) throw new Error(`${sheet}: an @import this reader cannot read: ${statement}`);
  const rest = statement.slice(m[0].length).trim();
  if (rest !== '' && !(m[0].toLowerCase().includes('url(') && rest === ')')) {
    throw new Error(`${sheet}: an @import with a media list or a layer: ${statement}`);
  }
  return m[2]!;
}

/** One sheet's `@import`s and style rules, in order. Refuses what the checks do not model. */
export function readSheet(text: string, sheet: string): ReadSheet {
  const src = stripCssComments(text);
  // blocksOf counts braces without reading strings, so a brace in a string is refused here.
  let depth = 0;
  let quote: string | null = null;
  for (let i = 0; i < src.length; i++) {
    const ch = src[i]!;
    if (quote !== null) {
      if (ch === '\\') i++;
      else if (ch === quote) quote = null;
      else if (ch === '{' || ch === '}') throw new Error(`${sheet}: a brace inside a string`);
    } else if (ch === '"' || ch === "'") quote = ch;
    else if (ch === '{') depth++;
    else if (ch === '}' && --depth < 0) throw new Error(`${sheet}: a "}" with no "{"`);
  }
  if (depth !== 0 || quote !== null) throw new Error(`${sheet}: a block or a string left open`);

  const imports: string[] = [];
  const rules: ReadRule[] = [];
  // Statements (`@import …;`) sit in the text between blocks; blocksOf folds
  // them into the next block's prelude, and drops what follows the last block.
  const statements = (text: string, context: string): string[] => {
    const parts = splitTopLevel(text, ';').map(collapse);
    for (const part of parts.slice(0, -1)) {
      if (part === '') continue;
      if (context !== '' || !/^@import\b/i.test(part)) throw new Error(`${sheet}: a statement this reader does not model: ${part}`);
      if (rules.length > 0) throw new Error(`${sheet}: an @import after a rule, which the browser drops: ${part}`);
      imports.push(importTarget(part, sheet));
    }
    return parts.slice(-1);
  };

  const walk = (body: string, context: string): void => {
    for (const block of blocksOf(body)) {
      const [prelude] = statements(block.prelude, context) as [string];
      if (prelude === '') throw new Error(`${sheet}: a block with no prelude`);
      if (prelude.startsWith('@')) {
        if (!/^@media\b/i.test(prelude)) throw new Error(`${sheet}: an at-rule the checks do not model: ${prelude}`);
        walk(block.body, context === '' ? prelude : `${context} / ${prelude}`);
        continue;
      }
      if (block.body.includes('{')) throw new Error(`${sheet}: a nested rule under ${prelude}`);
      const declarations = splitTopLevel(block.body, ';')
        .map((d) => d.trim())
        .filter((d) => d !== '')
        .map((d) => {
          const colon = d.indexOf(':');
          if (colon < 1) throw new Error(`${sheet}: not a declaration under ${prelude}: ${d}`);
          const raw = d.slice(colon + 1);
          const important = /!\s*important\s*$/i.test(raw);
          const name = d.slice(0, colon).trim();
          return {
            // A custom property's name is case-sensitive; any other is not.
            property: name.startsWith('--') ? name : name.toLowerCase(),
            value: normalizeValue(important ? raw.replace(/!\s*important\s*$/i, '') : raw),
            important,
          };
        });
      rules.push({ context, selectors: splitTopLevel(prelude, ',').map(collapse), declarations });
    }
    const lastClose = body.lastIndexOf('}');
    statements(`${body.slice(lastClose + 1)};`, context);
  };
  walk(src, '');
  return { imports, rules };
}

/** A page: its entry sheet with every sheet it imports by a relative path, in load order. */
export function readPage(tree: Tree, entry: string): Page {
  const declarations: Declaration[] = [];
  const bareImports: string[] = [];
  const open: string[] = [];
  const visit = (path: string): void => {
    if (open.includes(path)) throw new Error(`${entry}: an @import cycle through ${path}`);
    const text = tree.get(path);
    if (text === undefined) throw new Error(`${entry}: ${path} is not in the tree`);
    open.push(path);
    const sheet = readSheet(text, path);
    for (const target of sheet.imports) {
      if (target.startsWith('./') || target.startsWith('../')) visit(posix.normalize(posix.join(posix.dirname(path), target)));
      else bareImports.push(target);
    }
    for (const rule of sheet.rules) {
      for (const selector of rule.selectors) {
        for (const d of rule.declarations) {
          declarations.push({ context: rule.context, selector, ...d, sheet: path, order: declarations.length });
        }
      }
    }
    open.pop();
  };
  visit(entry);
  return { declarations, bareImports };
}

const keyOf = (d: Declaration): string => `${d.context}\u0000${d.selector}\u0000${d.property}\u0000${d.important ? '!' : ''}`;

/** The declarations in effect: the last of each context, selector, property and importance, in load order. */
export function inEffect(page: Page): Map<string, Declaration> {
  const last = new Map<string, Declaration>();
  for (const d of page.declarations) {
    last.delete(keyOf(d));
    last.set(keyOf(d), d);
  }
  return last;
}

export type Specificity = readonly [number, number, number];

const LEGACY_PSEUDO_ELEMENTS = new Set(['before', 'after', 'first-line', 'first-letter']);
const isIdentChar = (ch: string | undefined): boolean => ch !== undefined && /[\w\-\u0080-￿\\]/.test(ch);

function skipIdent(s: string, at: number): number {
  let i = at;
  while (i < s.length && isIdentChar(s[i])) i += s[i] === '\\' ? 2 : 1;
  return i;
}

/** The index just past the bracket or parenthesis that opens at `at`. */
function skipGroup(s: string, at: number): number {
  const open = s[at]!;
  const close = open === '(' ? ')' : ']';
  let depth = 0;
  let quote: string | null = null;
  for (let i = at; i < s.length; i++) {
    const ch = s[i]!;
    if (quote !== null) {
      if (ch === '\\') i++;
      else if (ch === quote) quote = null;
    } else if (ch === '"' || ch === "'") quote = ch;
    else if (ch === open) depth++;
    else if (ch === close && --depth === 0) return i + 1;
  }
  throw new Error(`an unclosed "${open}" in ${s}`);
}

const add = (x: Specificity, y: Specificity): Specificity => [x[0] + y[0], x[1] + y[1], x[2] + y[2]];
const compareSpecificity = (x: Specificity, y: Specificity): number => x[0] - y[0] || x[1] - y[1] || x[2] - y[2];
const mostOf = (list: string): Specificity =>
  splitTopLevel(list, ',')
    .map((s) => specificity(s.trim()))
    .reduce((best, s) => (compareSpecificity(s, best) > 0 ? s : best), [0, 0, 0] as Specificity);

/** A complex selector's specificity (ids, classes and the like, types), by Selectors Level 4. */
export function specificity(selector: string): Specificity {
  let total: Specificity = [0, 0, 0];
  let i = 0;
  while (i < selector.length) {
    const ch = selector[i]!;
    if (ch === '#') {
      total = add(total, [1, 0, 0]);
      i = skipIdent(selector, i + 1);
    } else if (ch === '.') {
      total = add(total, [0, 1, 0]);
      i = skipIdent(selector, i + 1);
    } else if (ch === '[') {
      total = add(total, [0, 1, 0]);
      i = skipGroup(selector, i);
    } else if (ch === ':') {
      const element = selector[i + 1] === ':';
      const nameStart = i + (element ? 2 : 1);
      const nameEnd = skipIdent(selector, nameStart);
      const name = selector.slice(nameStart, nameEnd).toLowerCase();
      let args: string | null = null;
      i = nameEnd;
      if (selector[i] === '(') {
        const end = skipGroup(selector, i);
        args = selector.slice(i + 1, end - 1);
        i = end;
      }
      if (element || (args === null && LEGACY_PSEUDO_ELEMENTS.has(name))) total = add(total, [0, 0, 1]);
      else if (name === 'where') continue;
      else if (args !== null && (name === 'is' || name === 'not' || name === 'has')) total = add(total, mostOf(args));
      else if (args !== null && (name === 'nth-child' || name === 'nth-last-child') && /\sof\s/i.test(args)) {
        total = add(add(total, [0, 1, 0]), mostOf(args.slice(args.search(/\sof\s/i) + 4)));
      } else total = add(total, [0, 1, 0]);
    } else if (ch === '|' || ch === '&') {
      throw new Error(`a namespace or a nesting selector this reader does not model: ${selector}`);
    } else if (isIdentChar(ch) && !/\d/.test(ch)) {
      total = add(total, [0, 0, 1]);
      i = skipIdent(selector, i);
    } else i++; // `*`, a combinator, whitespace
  }
  return total;
}

// A property is held against another by family: the longhands a shorthand
// sets, and the logical properties that land on the same physical one,
// share one. The first word of the name is its family unless listed here.
const FAMILIES: Readonly<Record<string, readonly string[]>> = {
  inset: ['inset'],
  top: ['inset'],
  right: ['inset'],
  bottom: ['inset'],
  left: ['inset'],
  gap: ['gap'],
  'row-gap': ['gap'],
  'column-gap': ['gap', 'column'],
  'grid-gap': ['gap', 'grid'],
  'grid-row-gap': ['gap', 'grid'],
  'grid-column-gap': ['gap', 'grid'],
  'line-height': ['font'],
  width: ['size'],
  height: ['size'],
  'inline-size': ['size'],
  'block-size': ['size'],
  'min-width': ['min-size'],
  'min-height': ['min-size'],
  'min-inline-size': ['min-size'],
  'min-block-size': ['min-size'],
  'max-width': ['max-size'],
  'max-height': ['max-size'],
  'max-inline-size': ['max-size'],
  'max-block-size': ['max-size'],
  columns: ['column'],
  'white-space': ['white', 'text'],
  'word-wrap': ['overflow'],
  all: ['*'],
};

export function familiesOf(property: string): readonly string[] {
  if (property.startsWith('--')) return [property];
  const p = property.replace(/^-(?:webkit|moz|ms|o)-/, '');
  const listed = FAMILIES[p];
  if (listed !== undefined) return listed;
  const first = p.split('-')[0]!;
  // `place-items` sets `align-items` and `justify-items`.
  if (first === 'place') return ['align', 'justify'];
  return [first];
}

/** Whether two properties can set one value: one family in common, or `all` beside any but a custom property. */
export function overlaps(a: string, b: string): boolean {
  const fa = familiesOf(a);
  const fb = familiesOf(b);
  if (fa.includes('*')) return !b.startsWith('--');
  if (fb.includes('*')) return !a.startsWith('--');
  return fa.some((f) => fb.includes(f));
}

/** The last compound of a complex selector: its element type, its id and its pseudo-element, where it names them. */
export function subjectOf(selector: string): { type: string | null; id: string | null; pseudoElement: string | null } {
  let start = 0;
  let depth = 0;
  for (let i = 0; i < selector.length; i++) {
    const ch = selector[i]!;
    if (ch === '(' || ch === '[') depth++;
    else if (ch === ')' || ch === ']') depth--;
    else if (depth === 0 && /[\s>+~]/.test(ch)) start = i + 1;
  }
  const compound = selector.slice(start);
  const type = /^[a-zA-Z][\w-]*/.exec(compound)?.[0].toLowerCase() ?? null;
  const id = /#([\w-]+)/.exec(compound.replace(/\([^)]*\)|\[[^\]]*\]/g, ''))?.[1] ?? null;
  const element = /::([\w-]+)/.exec(compound)?.[1] ?? /:(before|after|first-line|first-letter)\b/i.exec(compound)?.[1] ?? null;
  return { type, id, pseudoElement: element?.toLowerCase() ?? null };
}

/**
 * Whether two selectors can style one box. Two that name different element
 * types, different ids or different pseudo-elements (or a pseudo-element
 * against the element itself) never do; any other two are taken to.
 */
export function canMeet(a: string, b: string): boolean {
  const [x, y] = [subjectOf(a), subjectOf(b)];
  if (x.pseudoElement !== y.pseudoElement) return false;
  if (x.type !== null && y.type !== null && x.type !== y.type) return false;
  if (x.id !== null && y.id !== null && x.id !== y.id) return false;
  return true;
}

/** Two declarations whose order decides between them wherever their selectors meet. */
function orderDecides(a: Declaration, b: Declaration): boolean {
  if (a.important !== b.important || !overlaps(a.property, b.property)) return false;
  if (a.property === b.property && a.value === b.value) return false;
  if (compareSpecificity(specificity(a.selector), specificity(b.selector)) !== 0) return false;
  return canMeet(a.selector, b.selector);
}

/** One page's two readings held equal by the two checks. */
export function comparePage(page: string, before: Page, after: Page): CssDifference[] {
  const out: CssDifference[] = [];
  const counts = (list: readonly string[]): Map<string, number> => {
    const m = new Map<string, number>();
    for (const x of list) m.set(x, (m.get(x) ?? 0) + 1);
    return m;
  };
  const [ib, ia] = [counts(before.bareImports), counts(after.bareImports)];
  for (const target of new Set([...ib.keys(), ...ia.keys()])) {
    if ((ib.get(target) ?? 0) !== (ia.get(target) ?? 0)) {
      out.push({ page, what: 'import', detail: `@import '${target}' ${ib.get(target) ?? 0} times before, ${ia.get(target) ?? 0} after` });
    }
  }

  const [eb, ea] = [inEffect(before), inEffect(after)];
  for (const [key, b] of eb) {
    const a = ea.get(key);
    if (a === undefined) out.push({ page, what: 'dropped', before: b });
    else if (a.value !== b.value) out.push({ page, what: 'changed', before: b, after: a });
  }
  for (const [key, a] of ea) if (!eb.has(key)) out.push({ page, what: 'added', after: a });

  // The second check, over the declarations both sides hold.
  const shared = [...eb.keys()].filter((key) => ea.has(key));
  const byFamily = new Map<string, string[]>();
  for (const key of shared) {
    for (const f of familiesOf(eb.get(key)!.property)) byFamily.set(f, [...(byFamily.get(f) ?? []), key]);
  }
  const candidates = new Set<string>();
  const pairsOf = (keys: readonly string[], others: readonly string[]): void => {
    for (const x of keys) for (const y of others) if (x !== y) candidates.add(x < y ? `${x}\u0001${y}` : `${y}\u0001${x}`);
  };
  for (const [family, keys] of byFamily) {
    if (family === '*') pairsOf(keys, shared.filter((k) => !eb.get(k)!.property.startsWith('--')));
    else pairsOf(keys, keys);
  }
  for (const pair of candidates) {
    const [x, y] = pair.split('\u0001') as [string, string];
    const [bx, by, ax, ay] = [eb.get(x)!, eb.get(y)!, ea.get(x)!, ea.get(y)!];
    if (bx.order < by.order === ax.order < ay.order) continue;
    if (!orderDecides(bx, by)) continue;
    const [first, second] = bx.order < by.order ? [bx, by] : [by, bx];
    out.push({ page, what: 'order', first, second });
  }
  return out;
}

export interface CssCompare {
  readonly pages: readonly string[];
  readonly differences: readonly CssDifference[];
}

/** Each entry sheet's page read from both trees and held equal. */
export function compareSheets(before: Tree, after: Tree, entries: readonly string[]): CssCompare {
  const differences: CssDifference[] = [];
  for (const entry of entries) {
    let pages: [Page, Page];
    try {
      pages = [readPage(before, entry), readPage(after, entry)];
    } catch (e) {
      differences.push({ page: entry, what: 'unreadable', detail: (e as Error).message });
      continue;
    }
    differences.push(...comparePage(entry, ...pages));
  }
  return { pages: entries, differences };
}

/** The rule the control appends; no sheet the tools hold has its selector. */
export const CONTROL_RULE = '.css-compare-control { outline-offset: 7.25px; }';

export interface CssControl {
  readonly page: string;
  readonly caught: boolean;
}

/** Each page that passed, compared again with one rule appended to its entry sheet in memory. */
export function controlCss(before: Tree, after: Tree, result: CssCompare): CssControl[] {
  const failed = new Set(result.differences.map((d) => d.page));
  return result.pages
    .filter((page) => !failed.has(page))
    .map((page) => {
      const planted = new Map(after);
      planted.set(page, `${after.get(page)!}\n${CONTROL_RULE}\n`);
      const named = compareSheets(before, planted, [page]).differences;
      return { page, caught: named.some((d) => d.what === 'added' && d.after.selector === '.css-compare-control') };
    });
}

const where = (d: Declaration): string => `${d.context === '' ? '' : `${d.context} / `}${d.selector} { ${d.property}${d.important ? ' !important' : ''} }`;

/** One line for a difference. */
export function describeCss(d: CssDifference): string {
  switch (d.what) {
    case 'changed':
      return `changed  ${where(d.before)}: ${d.before.value} -> ${d.after.value} (${d.after.sheet})`;
    case 'dropped':
      return `dropped  ${where(d.before)}: ${d.before.value} (was in ${d.before.sheet})`;
    case 'added':
      return `added    ${where(d.after)}: ${d.after.value} (${d.after.sheet})`;
    case 'order':
      return `order    ${where(d.first)}: ${d.first.value} came before ${where(d.second)}: ${d.second.value}, and now comes after it, at one specificity`;
    case 'import':
    case 'unreadable':
      return `${d.what.padEnd(8)} ${d.detail}`;
  }
}
