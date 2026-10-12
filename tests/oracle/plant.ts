/**
 * A PLANTED BREAK: one mechanical edit at one line, made through TypeScript's
 * parser.
 *
 * A proof that passes on a change shows nothing until the same proof has
 * failed on a break in the same place (process/oracles.md, "A PASS ships with
 * its failing control"). `edits` lists every edit a file admits, `editsOn`
 * those on one line, and `applyEdit` makes one. `npm run oracle -- plant`
 * makes it in a worktree and runs the proofs named (plantProofs.ts).
 *
 * The edits. Each changes what the code computes and none changes its shape,
 * so the edited file still parses:
 *
 *   negate    the condition of an if, while, do, for or ?: is wrapped in !( )
 *   boundary  < and <=, > and >= trade places
 *   sign      + and -, += and -= trade places (not where + joins a string)
 *   bump      a number is raised by one
 *   drop      a call that stands as a statement is removed
 *
 * AN EDIT CAN CHANGE NOTHING A RUN SEES: a capacity raised by one, a guard
 * that never fires. A proof that passes over such an edit is right to. So an
 * edit no proof notices is a question about the line (dead code, a hole in
 * the proofs, or an edit of no effect), and a read of the site answers it.
 */

import ts from 'typescript';

export const OPERATORS = ['negate', 'boundary', 'sign', 'bump', 'drop'] as const;
export type Operator = (typeof OPERATORS)[number];

export interface Edit {
  readonly operator: Operator;
  /** The line the replaced text starts on, from 1. */
  readonly line: number;
  /** `source.slice(start, end)` is replaced by `text`. */
  readonly start: number;
  readonly end: number;
  readonly text: string;
  /** The text replaced. */
  readonly was: string;
}

const TRADES = new Map<ts.SyntaxKind, readonly [Operator, string]>([
  [ts.SyntaxKind.LessThanToken, ['boundary', '<=']],
  [ts.SyntaxKind.LessThanEqualsToken, ['boundary', '<']],
  [ts.SyntaxKind.GreaterThanToken, ['boundary', '>=']],
  [ts.SyntaxKind.GreaterThanEqualsToken, ['boundary', '>']],
  [ts.SyntaxKind.PlusToken, ['sign', '-']],
  [ts.SyntaxKind.MinusToken, ['sign', '+']],
  [ts.SyntaxKind.PlusEqualsToken, ['sign', '-=']],
  [ts.SyntaxKind.MinusEqualsToken, ['sign', '+=']],
]);

const isText = (node: ts.Node): boolean => ts.isStringLiteralLike(node) || ts.isTemplateExpression(node);

/** The condition a statement or a `?:` branches on, if it has one. */
function conditionOf(node: ts.Node): ts.Expression | undefined {
  if (ts.isIfStatement(node) || ts.isWhileStatement(node) || ts.isDoStatement(node)) return node.expression;
  if (ts.isForStatement(node) || ts.isConditionalExpression(node)) return node.condition;
  return undefined;
}

/** Every edit `source` admits, in the order of the text. */
export function edits(fileName: string, source: string): Edit[] {
  const file = ts.createSourceFile(fileName, source, ts.ScriptTarget.ES2022, true);
  const out: Edit[] = [];
  const add = (operator: Operator, start: number, end: number, text: string): void => {
    out.push({ operator, line: file.getLineAndCharacterOfPosition(start).line + 1, start, end, text, was: source.slice(start, end) });
  };
  const visit = (node: ts.Node): void => {
    // A type computes nothing, and an import or a `declare` has no body to break.
    if (ts.isTypeNode(node) || ts.isImportDeclaration(node) || ts.isInterfaceDeclaration(node) || ts.isTypeAliasDeclaration(node)) return;
    if (ts.canHaveModifiers(node) && (ts.getModifiers(node) ?? []).some((m) => m.kind === ts.SyntaxKind.DeclareKeyword)) return;

    const condition = conditionOf(node);
    if (condition !== undefined) add('negate', condition.getStart(file), condition.end, `!(${condition.getText(file)})`);

    if (ts.isBinaryExpression(node)) {
      const trade = TRADES.get(node.operatorToken.kind);
      const joinsText = node.operatorToken.kind === ts.SyntaxKind.PlusToken || node.operatorToken.kind === ts.SyntaxKind.PlusEqualsToken;
      if (trade !== undefined && !(joinsText && (isText(node.left) || isText(node.right)))) {
        add(trade[0], node.operatorToken.getStart(file), node.operatorToken.end, trade[1]);
      }
    }

    // A number that is a value: not a property's name, not an enum member's
    // own number, and small enough that one more is another number.
    if (ts.isNumericLiteral(node) && !ts.isEnumMember(node.parent) && !(ts.isPropertyAssignment(node.parent) && node.parent.name === node)) {
      const value = Number(node.text);
      if (Number.isFinite(value) && value + 1 !== value) add('bump', node.getStart(file), node.end, String(value + 1));
    }

    if (ts.isExpressionStatement(node)) {
      const call = ts.isAwaitExpression(node.expression) ? node.expression.expression : node.expression;
      if (ts.isCallExpression(call) && call.expression.kind !== ts.SyntaxKind.SuperKeyword) add('drop', node.getStart(file), node.end, ';');
    }

    ts.forEachChild(node, visit);
  };
  visit(file);
  return out.sort((x, y) => x.start - y.start || x.end - y.end);
}

/** The edits whose replaced text starts on `line`. */
export function editsOn(fileName: string, source: string, line: number): Edit[] {
  return edits(fileName, source).filter((edit) => edit.line === line);
}

/** `source` with `edit` made. Refuses an edit that was listed for other text. */
export function applyEdit(source: string, edit: Edit): string {
  if (source.slice(edit.start, edit.end) !== edit.was) throw new Error(`plant: the text at ${edit.start} is not what the edit was listed for`);
  return source.slice(0, edit.start) + edit.text + source.slice(edit.end);
}

/** One line for a report: `negate  if (a > b)  →  !(a > b)`. */
export function describeEdit(edit: Edit): string {
  const short = (text: string): string => (text.length > 60 ? `${text.slice(0, 57)}…` : text).replace(/\s+/g, ' ');
  return `${edit.operator.padEnd(8)} ${short(edit.was)}  →  ${edit.operator === 'drop' ? '(removed)' : short(edit.text)}`;
}
