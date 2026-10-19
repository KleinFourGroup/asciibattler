/**
 * The literal scan: finds player-facing prose that is still a string literal
 * in code instead of a `t()` key. Pure (a source text in, a list of
 * offending literals out) over the TypeScript AST, through the compiler API
 * the repo already depends on, so it sees template literals, skips
 * comments, and can tell an `Error` message from a button label.
 *
 * A test and not an ESLint rule, because the pre-commit hook runs typecheck
 * and `npm test`, not lint, and the guard belongs on the path where the
 * mistake happens. tests/i18n-literal-pin.test.ts holds each scanned file to
 * its count in tests/i18n-literal-baseline.json (written by
 * `npm run i18n:baseline`); the baseline is empty, so a new prose literal in
 * a scanned file fails it.
 *
 * What counts as prose (a deliberately simple heuristic):
 * - two letter-words separated by whitespace ("No units", "Level Up"), or a
 *   single capitalized word with optional trailing punctuation ("Buy",
 *   "Defeat!"),
 * - in a string literal, a no-substitution template, or the static parts of
 *   a template expression.
 * A lone lowercase token (a css class, an event name, an id, a key like
 * `roster.button`), an all-caps token, digits, and glyph-only strings
 * ("✕", "▸ ") have no such shape and never match, and a css class list
 * (`CLASS_LIST`) is not counted.
 *
 * What is excluded, as never player-facing:
 * - the message of a `new Error(…)`, `TypeError` or `RangeError`, and the
 *   arguments of a `console.*(…)` call or a developer's check (`fail`,
 *   `invariant`, `assert*`);
 * - the values of the `message`, `fragmentShader` and `vertexShader`
 *   properties;
 * - class and style plumbing: `className =`, `style.* =`,
 *   `style.setProperty`, and a call to a method `CLASS_METHODS` names, on
 *   any receiver;
 * - import and export specifiers, property names, `case` labels, and
 *   string-literal types (`'player' | 'enemy'`);
 * - the `KEYBOARD_CODES` allowlist (DOM codes that happen to be capitalized
 *   words);
 * - a line carrying an `// i18n-ok` marker (an explicit, reviewable opt-out
 *   for a non-prose literal the heuristic misreads), and a whole file with
 *   `i18n-ok-file` in its first five lines.
 *
 * Scope: the presentation layer, `SCAN_ROOTS`. Sim, run, core and config
 * carry no player-facing prose by design; a violation there is a review
 * matter.
 */

import ts from 'typescript';

export const SCAN_ROOTS: readonly string[] = ['src/ui', 'src/scenes', 'src/render', 'src/Game.ts', 'src/main.ts'];

const I18N_OK_MARKER = 'i18n-ok';
/** In a file's first five lines: the whole file is a build or dev table, never player-facing. */
const I18N_OK_FILE_MARKER = 'i18n-ok-file';

/** DOM `KeyboardEvent.code` / `.key` values that are Capitalized words. */
const KEYBOARD_CODES: ReadonlySet<string> = new Set([
  'Escape',
  'Space',
  'Enter',
  'Tab',
  'Backquote',
  'Backspace',
  'Delete',
  'Shift',
  'Control',
  'Alt',
  'Meta',
  'Home',
  'End',
  'Insert',
  'Pause',
  'Slash',
]);

const LETTER_WORD = /\p{L}{2,}/gu;
const CAPITALIZED_WORD = /^\s*\p{Lu}\p{Ll}+[^\p{L}\p{N}]*$/u;
/** A css class list: lowercase hyphen/underscore tokens, at least one hyphenated. */
const CLASS_LIST = /^\s*[a-z][a-z0-9_-]*(\s+[a-z][a-z0-9_-]*)*\s*$/;

export function isProseLike(text: string): boolean {
  if (CAPITALIZED_WORD.test(text)) return true;
  if (!/\s/.test(text)) return false; // ids, keys, event names, class tokens
  if (CLASS_LIST.test(text) && /[-_]/.test(text)) return false;
  const words = text.match(LETTER_WORD);
  return words !== null && words.length >= 2;
}

export interface ProseLiteral {
  readonly file: string;
  readonly line: number;
  readonly text: string;
}

/** Scan one source text. `file` is only echoed into the results. */
export function scanSource(file: string, source: string): ProseLiteral[] {
  const out: ProseLiteral[] = [];
  const lines = source.split('\n');
  if (lines.slice(0, 5).some((l) => l.includes(I18N_OK_FILE_MARKER))) return out;
  const sf = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);

  const lineOf = (node: ts.Node): number => sf.getLineAndCharacterOfPosition(node.getStart(sf)).line + 1;

  const report = (node: ts.Node, text: string): void => {
    if (!isProseLike(text)) return;
    if (KEYBOARD_CODES.has(text.trim())) return;
    if (excluded(node)) return;
    const line = lineOf(node);
    if ((lines[line - 1] ?? '').includes(I18N_OK_MARKER)) return;
    out.push({ file, line, text });
  };

  const visit = (node: ts.Node): void => {
    if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) {
      report(node, node.text);
    } else if (ts.isTemplateExpression(node)) {
      // The static parts carry the prose; `${…}` holes are data.
      const parts = [node.head.text, ...node.templateSpans.map((s) => s.literal.text)];
      const staticText = parts.join('');
      if (isProseLike(staticText) && !excluded(node)) {
        const line = lineOf(node);
        if (!(lines[line - 1] ?? '').includes(I18N_OK_MARKER)) out.push({ file, line, text: staticText.trim() });
      }
      // Still walk the holes: a nested literal inside `${cond ? 'Yes' : 'No'}` counts.
      node.templateSpans.forEach((s) => visit(s.expression));
      return;
    }
    ts.forEachChild(node, visit);
  };
  visit(sf);
  return out;
}

const ERROR_CTORS = new Set(['Error', 'TypeError', 'RangeError']);
/** Object properties whose values are never player-facing: zod / addIssue
 *  messages, shader sources. */
const DEV_PROPERTIES = new Set(['message', 'fragmentShader', 'vertexShader']);
/** Callees that throw or log for developers: `fail(...)`, `assertX(...)`, `invariant(...)`. */
const isDevCallee = (name: string): boolean => name === 'fail' || name === 'invariant' || name.startsWith('assert');
/** DOM class plumbing: `el.className = …`, `el.classList.add(…)`, `querySelector(…)`. */
const CLASS_METHODS = new Set(['add', 'remove', 'toggle', 'contains', 'replace', 'querySelector', 'querySelectorAll', 'closest', 'matches']);

function excluded(node: ts.Node): boolean {
  for (let p: ts.Node | undefined = node.parent; p; p = p.parent) {
    if (ts.isNewExpression(p) && ts.isIdentifier(p.expression) && ERROR_CTORS.has(p.expression.text)) return true;
    if (ts.isCallExpression(p)) {
      const callee = p.expression;
      if (ts.isIdentifier(callee) && isDevCallee(callee.text)) return true;
      if (ts.isPropertyAccessExpression(callee)) {
        if (ts.isIdentifier(callee.expression) && callee.expression.text === 'console') return true;
        if (CLASS_METHODS.has(callee.name.text)) return true;
        if (isDevCallee(callee.name.text)) return true;
      }
    }
    if (
      ts.isBinaryExpression(p) &&
      p.operatorToken.kind === ts.SyntaxKind.EqualsToken &&
      ts.isPropertyAccessExpression(p.left)
    ) {
      // `el.className = …` and `el.style.transform = …` (css values, never prose)
      if (p.left.name.text === 'className') return true;
      if (ts.isPropertyAccessExpression(p.left.expression) && p.left.expression.name.text === 'style') return true;
    }
    if (
      ts.isCallExpression(p) &&
      ts.isPropertyAccessExpression(p.expression) &&
      p.expression.name.text === 'setProperty' &&
      ts.isPropertyAccessExpression(p.expression.expression) &&
      p.expression.expression.name.text === 'style'
    ) {
      return true;
    }
    if (ts.isImportDeclaration(p) || ts.isExportDeclaration(p)) return true;
    if (ts.isLiteralTypeNode(p)) return true;
    if (ts.isCaseClause(p) && p.expression === node) return true;
    if (ts.isPropertyAssignment(p) || ts.isPropertySignature(p)) {
      if (p.name === node) return true;
      if (ts.isIdentifier(p.name) && DEV_PROPERTIES.has(p.name.text)) return true;
    }
  }
  return false;
}
