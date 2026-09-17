/**
 * The stylesheet oracles' shared walker — `ui.css` read as `prelude { body }`
 * blocks at one nesting level. Born inline in tests/ui-motion.test.ts (99b);
 * lifted here at 100b when tests/ui-focus.test.ts needed the same walk
 * (rule-of-two for a parser: a second copy is where the two oracles would
 * drift). Comments must be stripped BEFORE the walk (`stripCssComments`) —
 * a `{` inside a comment would unbalance the depth count.
 */

export interface Block {
  readonly prelude: string;
  readonly body: string;
}

/** `/* … *​/` removed — the sheet's prose carries braces and selectors. */
export function stripCssComments(raw: string): string {
  return raw.replace(/\/\*[\s\S]*?\*\//g, '');
}

/** A flat walk over `prelude { body }` blocks at one nesting level. An
 *  `@media` block's body is itself a sheet — walk it again to descend. */
export function blocksOf(src: string): Block[] {
  const out: Block[] = [];
  let depth = 0;
  let prelude = '';
  let body = '';
  for (const ch of src) {
    if (ch === '{') {
      if (depth++ === 0) continue;
    } else if (ch === '}') {
      if (--depth === 0) {
        out.push({ prelude: prelude.trim(), body });
        prelude = '';
        body = '';
        continue;
      }
    }
    if (depth === 0) prelude += ch;
    else body += ch;
  }
  return out;
}

/** Every style rule (never an at-rule), descending into `@media` bodies. */
export function styleRulesOf(src: string): Block[] {
  const out: Block[] = [];
  for (const b of blocksOf(src)) {
    if (b.prelude.startsWith('@media')) out.push(...styleRulesOf(b.body));
    else if (!b.prelude.startsWith('@')) out.push(b);
  }
  return out;
}

/** A prelude's selector list, each entry whitespace-normalized. */
export function selectorsOf(prelude: string): string[] {
  return prelude.split(',').map((s) => s.trim().replace(/\s+/g, ' '));
}
