/**
 * A source file told apart into its comments and its code, for the comment
 * pass: a rewrite that touches comments only is proven by comparing what is
 * left of each file with the comments out, before and after.
 *
 * TypeScript is split by the compiler's own parser, since only the parser
 * knows whether a `//` sits in a regular expression or a template. Every
 * token it yields carries the text before it (its trivia), and trivia is
 * whitespace and comments and nothing else, which `splitTypeScript` checks
 * character by character and throws on. The tokens must also cover the file
 * end to end with no gap. So a comment cannot be taken for code, or code for
 * a comment, without one of the two checks failing.
 *
 * What is left is the tokens in order, each with whether a line break stood
 * before it. That flag is kept because JavaScript reads one: `return` and a
 * value on the next line is a bare return, and a block comment that spans
 * lines counts as a break. Two files with the same pieces are the same
 * program. The reverse does not hold: re-wrapping code moves a break and
 * shows as a difference, which is the safe way round.
 *
 * A comment that a tool reads is code for this purpose and stays in the
 * pieces (`TOOL_READ`).
 *
 * GLSL and CSS are split by a small scanner of their own: neither has
 * regular expressions or templates, and their pieces are the lines left,
 * trimmed, with runs of blanks outside a string made one.
 */

import ts from 'typescript';

export interface SourceComment {
  /** The 1-based line the comment starts on. */
  readonly line: number;
  /** As written, with its delimiters. */
  readonly text: string;
}

export interface CodePiece {
  /** The 1-based line the piece starts on in its own file; not compared. */
  readonly line: number;
  readonly text: string;
  /** Whether a line break stood between the piece before and this one. */
  readonly newline: boolean;
}

export interface SplitSource {
  readonly comments: SourceComment[];
  readonly code: CodePiece[];
}

/**
 * Comments a tool acts on. Deleting or rewording one changes what the type
 * checker, the linter, the bundler, the coverage run or the literal scan
 * does, so they are held as code.
 */
export const TOOL_READ =
  /@ts-(?:expect-error|ignore|nocheck|check)\b|\beslint-(?:disable|enable)|\bprettier-ignore\b|@vite-ignore\b|[@#]__(?:PURE|NO_SIDE_EFFECTS)__|@vitest-environment\b|\b(?:v8|c8|istanbul) ignore\b|\bi18n-ok\b|^\/\/\/\s*</;

// The four characters JavaScript ends a line on; the last two are written by code so that no editor meets them raw.
const LINE_BREAK = new RegExp(`[\\n\\r${String.fromCharCode(0x2028, 0x2029)}]`);

export function splitTypeScript(fileName: string, text: string): SplitSource {
  const source = ts.createSourceFile(fileName, text, ts.ScriptTarget.Latest, false, ts.ScriptKind.TS);
  const comments: SourceComment[] = [];
  const code: CodePiece[] = [];
  const lineOf = (pos: number): number => source.getLineAndCharacterOfPosition(pos).line + 1;
  let covered = 0;

  /** The comments in `text[from, to)`, which must hold nothing else but whitespace. */
  const trivia = (from: number, to: number): boolean => {
    let newline = false;
    let i = from;
    if (i === 0 && text.startsWith('#!')) while (i < to && !LINE_BREAK.test(text[i]!)) i++;
    while (i < to) {
      const two = text.slice(i, i + 2);
      if (two === '//' || two === '/*') {
        let end: number;
        if (two === '//') {
          end = i;
          while (end < to && !LINE_BREAK.test(text[end]!)) end++;
        } else {
          const close = text.indexOf('*/', i + 2);
          end = close === -1 || close + 2 > to ? to : close + 2;
        }
        const comment = { line: lineOf(i), text: text.slice(i, end) };
        comments.push(comment);
        if (LINE_BREAK.test(comment.text)) newline = true;
        if (TOOL_READ.test(comment.text)) code.push({ ...comment, newline });
        i = end;
        continue;
      }
      const ch = text[i]!;
      if (LINE_BREAK.test(ch)) newline = true;
      else if (!/\s/.test(ch)) {
        throw new Error(`${fileName}:${lineOf(i)}: ${JSON.stringify(ch)} between two tokens is neither whitespace nor a comment`);
      }
      i++;
    }
    return newline;
  };

  const visit = (node: ts.Node): void => {
    const children = node.getChildren(source).filter((child) => !ts.isJSDoc(child));
    if (children.length > 0) {
      for (const child of children) visit(child);
      return;
    }
    const end = node.kind === ts.SyntaxKind.EndOfFileToken;
    if (node.pos === node.end && !end) return;
    if (node.pos !== covered) {
      throw new Error(`${fileName}:${lineOf(node.pos)}: the tokens leave a gap or overlap (${covered} to ${node.pos})`);
    }
    const start = node.getStart(source);
    const newline = trivia(node.pos, start);
    if (!end) code.push({ line: lineOf(start), text: text.slice(start, node.end), newline });
    covered = node.end;
  };
  visit(source);
  if (covered !== text.length) throw new Error(`${fileName}: the tokens end at ${covered} of ${text.length} characters`);
  return { comments, code };
}

/**
 * GLSL and CSS. Both have block comments; GLSL has line comments as well,
 * and CSS has strings, where a comment's opening is ordinary text.
 */
export function splitCStyle(text: string, lineComments: boolean): SplitSource {
  const comments: SourceComment[] = [];
  const lines: { line: number; text: string }[] = [];
  let line = 1;
  let current = '';
  let startedOn = 1;
  const endLine = (): void => {
    const trimmed = current.trim();
    if (trimmed !== '') lines.push({ line: startedOn, text: trimmed });
    current = '';
  };
  let i = 0;
  while (i < text.length) {
    const ch = text[i]!;
    const two = text.slice(i, i + 2);
    if (two === '/*' || (lineComments && two === '//')) {
      let end: number;
      if (two === '//') {
        end = i;
        while (end < text.length && text[end] !== '\n') end++;
      } else {
        const close = text.indexOf('*/', i + 2);
        end = close === -1 ? text.length : close + 2;
      }
      const comment = text.slice(i, end);
      comments.push({ line, text: comment.replace(/\r$/, '') });
      line += comment.split('\n').length - 1;
      // A comment separates what stands on either side of it, as a blank does.
      if (!/\s$/.test(current)) current += ' ';
      i = end;
    } else if (!lineComments && (ch === '"' || ch === "'")) {
      let end = i + 1;
      while (end < text.length && text[end] !== ch && text[end] !== '\n') end += text[end] === '\\' ? 2 : 1;
      if (current === '') startedOn = line;
      current += text.slice(i, end + 1);
      i = end + 1;
    } else if (ch === '\n') {
      endLine();
      line++;
      i++;
    } else if (/\s/.test(ch)) {
      if (current !== '' && !/\s$/.test(current)) current += ' ';
      i++;
    } else {
      if (current.trim() === '') startedOn = line;
      current += ch;
      i++;
    }
  }
  endLine();
  return { comments, code: lines.map((l) => ({ ...l, newline: true })) };
}

/** A piece that is a tool-read comment held as code. No token of either language starts this way. */
export const isHeldComment = (piece: CodePiece): boolean => piece.text.startsWith('//') || piece.text.startsWith('/*');

export interface Lengths {
  /** Lines that hold code, with or without a comment beside it. */
  readonly code: number;
  /** Lines that hold comment and no code. */
  readonly comment: number;
  readonly blank: number;
  /** Words in the comments: runs with a letter or a digit, so a ruled line counts for nothing. */
  readonly words: number;
}

/** How much of a file is comment. Words are the measure a re-wrap does not move. */
export function measure(text: string, split: SplitSource): Lengths {
  const lines = text === '' ? 0 : text.split('\n').length - (text.endsWith('\n') ? 1 : 0);
  const holds = new Uint8Array(lines + 2); // by 1-based line: 0 nothing, 1 comment, 2 code
  let words = 0;
  for (const comment of split.comments) {
    const own = comment.text.split('\n');
    own.forEach((_, k) => {
      const at = comment.line + k;
      if (at <= lines && holds[at] === 0) holds[at] = 1;
    });
    for (const line of own) {
      const prose = line.replace(/^\s*(?:\/\/+|\/\*+|\*+\/|\*+)/, ' ').replace(/\*+\/\s*$/, ' ');
      words += prose.match(/\S*[\p{L}\p{N}]\S*/gu)?.length ?? 0;
    }
  }
  for (const piece of split.code) {
    if (isHeldComment(piece)) continue;
    piece.text.split('\n').forEach((_, k) => {
      if (piece.line + k <= lines) holds[piece.line + k] = 2;
    });
  }
  let code = 0;
  let comment = 0;
  for (let at = 1; at <= lines; at++) {
    if (holds[at] === 2) code++;
    else if (holds[at] === 1) comment++;
  }
  return { code, comment, blank: lines - code - comment, words };
}

/** A file's comments and code by its extension, or `null` for a kind this module does not read. */
export function splitSource(fileName: string, text: string): SplitSource | null {
  if (/\.(?:ts|mts|cts)$/.test(fileName)) return splitTypeScript(fileName, text);
  if (fileName.endsWith('.glsl')) return splitCStyle(text, true);
  if (fileName.endsWith('.css')) return splitCStyle(text, false);
  return null;
}
