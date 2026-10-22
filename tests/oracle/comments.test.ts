import { describe, expect, it } from 'vitest';
import { measure, splitCStyle, splitSource, splitTypeScript } from './comments';
import { ceilingDrift, ceilingOf, codesInSource, stepCodes } from './stepCodes';
import { compareStripped, controlStripped, firstCodeDifference } from './strippedCompare';

// The comment instruments. Each reader is held against an answer written out
// by hand, and the compare against edits it must pass (comments only) and
// edits it must name (code that looks like a comment, a comment that acts
// as code).

const texts = (pieces: readonly { text: string }[]): string[] => pieces.map((p) => p.text);

/** Every place a "//" or a slash-star is not a comment, beside the places it is. */
const TRICKY = [
  '/** The header. */',
  "import { x } from './x'; // trailing",
  "const url = 'http://example.test/a'; /* after */",
  'const re = /https?:\\/\\//; // a regex with two slashes',
  'const cls = /[/*]/;',
  'const half = a / b / c;',
  'const tpl = `// not a comment ${/* inside */ x} /* nor this */`;',
  "label('Deploy'); // i18n-ok: a dev string",
  'export {};',
  '// the last line',
].join('\n');

/** Test titles in each form a call takes, beside strings that are not titles. */
const TITLES = [
  "describe('74b — the group', () => {",
  "  it('a 53b test', () => {});",
  '  it.skip(`a ${kind} test (K1)`, () => {});',
  "  it.each([1, 2])('case %i of 95e', (n) => {});",
  '  test.todo("later, 117b");',
  "  expect(1, 'a message, 40b').toBe(1);",
  "  check('a helper argument, 41c');",
  "  it(name, () => label('a second argument'));",
  '});',
].join('\n');

describe('splitTypeScript', () => {
  it('finds the comments and only them', () => {
    expect(texts(splitTypeScript('tricky.ts', TRICKY).comments)).toEqual([
      '/** The header. */',
      '// trailing',
      '/* after */',
      '// a regex with two slashes',
      '/* inside */',
      '// i18n-ok: a dev string',
      '// the last line',
    ]);
    expect(splitTypeScript('tricky.ts', TRICKY).comments.map((c) => c.line)).toEqual([1, 2, 3, 4, 7, 8, 10]);
  });

  it('keeps every token of the code, a string or a regex whole', () => {
    const code = texts(splitTypeScript('tricky.ts', TRICKY).code);
    expect(code).toContain("'http://example.test/a'");
    expect(code).toContain('/https?:\\/\\//');
    expect(code).toContain('/[/*]/');
    expect(code).toContain('`// not a comment ${');
    expect(code).toContain('} /* nor this */`');
    expect(code.filter((t) => t === '/')).toHaveLength(2);
    // The one comment a tool reads is held with the code.
    expect(code.filter((t) => t.startsWith('//'))).toEqual(['// i18n-ok: a dev string']);
  });

  it('reads a file that is all comment, or empty', () => {
    expect(splitTypeScript('a.ts', '// only\n/* this */\n')).toEqual({
      comments: [
        { line: 1, text: '// only' },
        { line: 2, text: '/* this */' },
      ],
      code: [],
    });
    expect(splitTypeScript('a.ts', '')).toEqual({ comments: [], code: [] });
  });

  it("flags the literal pieces of a test's title, and no other string", () => {
    const flagged = splitTypeScript('t.ts', TITLES).code.filter((p) => p.title === true);
    expect(flagged.map((p) => `${p.text}@${p.line}`)).toEqual([
      "'74b — the group'@1",
      "'a 53b test'@2",
      '`a ${@3',
      '} test (K1)`@3',
      "'case %i of 95e'@4",
      '"later, 117b"@5',
    ]);
  });
});

describe('the compare with the comments out', () => {
  const pieces = (text: string) => splitTypeScript('f.ts', text).code;
  const differs = (before: string, after: string): string | null => firstCodeDifference(pieces(before), pieces(after));

  it('passes a rewrite of the comments: reworded, deleted, re-wrapped, moved to its own line', () => {
    const rewritten = TRICKY.replace('/** The header. */', '/**\n * The header,\n * on three lines.\n */')
      .replace(' // trailing', '')
      .replace('/* after */', '\n// after, below')
      .replace('// a regex with two slashes', '// 53b: said another way')
      .replace('/* inside */ ', '')
      .replace('// the last line', '');
    // Every one of the six edits landed: these are the comments left.
    expect(texts(splitTypeScript('f.ts', rewritten).comments)).toEqual([
      '/**\n * The header,\n * on three lines.\n */',
      '// after, below',
      '// 53b: said another way',
      '// i18n-ok: a dev string',
    ]);
    expect(differs(TRICKY, rewritten)).toBeNull();
  });

  it('passes a header deleted whole: no break is counted before the first piece, which has no piece before it', () => {
    expect(differs('/** The header. */\n\nexport const a = 1;\n', 'export const a = 1;\n')).toBeNull();
    expect(differs("// i18n-ok-file\nlabel('x');", "\n\n// i18n-ok-file\nlabel('x');")).toBeNull();
  });

  it('names a changed number, and a changed type, which no compiled output would show', () => {
    expect(differs('const heal = 0.25; // a quarter', 'const heal = 0.5; // a quarter')).toBe('line 1 "0.25" → line 1 "0.5"');
    expect(differs('const heal: number = rest();', 'const heal: unknown = rest();')).toBe('line 1 "number" → line 1 "unknown"');
  });

  it('names an edit inside a string, a template or a regex that only looks like a comment', () => {
    expect(differs(TRICKY, TRICKY.replace('http://example.test/a', 'http://example.test/b'))).toContain('example.test/b');
    expect(differs(TRICKY, TRICKY.replace('// not a comment', '// not a comment either'))).toContain('not a comment either');
    expect(differs(TRICKY, TRICKY.replace('/* nor this */', ''))).toContain('line 7');
    expect(differs(TRICKY, TRICKY.replace('/[/*]/', '/[/]/'))).toBe('line 5 "/[/*]/" → line 5 "/[/]/"');
  });

  it('names a line break that came or went, since JavaScript reads one after `return`', () => {
    const bare = 'function f() {\n  return /* the value,\n  below */ 1;\n}';
    const valued = 'function f() {\n  return 1;\n}';
    expect(differs(bare, valued)).toBe('a line break before line 2 "1" went');
    // The same comment on one line is no break, and deleting it is a comment edit.
    expect(differs('function f() {\n  return /* the value */ 1;\n}', valued)).toBeNull();
  });

  it('names a comment a tool reads when it is dropped or reworded', () => {
    expect(differs(TRICKY, TRICKY.replace(' // i18n-ok: a dev string', ''))).toContain('i18n-ok');
    expect(differs('// @ts-expect-error the cast\nconst a: number = b;', '// the cast\nconst a: number = b;')).toContain('@ts-expect-error');
    expect(differs('const a = 1; // eslint-disable-line', 'const a = 1;')).toContain('pieces gone from the end');
  });

  it('names code added or taken from the end', () => {
    expect(differs('a();', 'a();\nb();')).toBe('4 pieces more at the end, the first at line 2 "b"');
  });

  it("masks a test's title: a reworded one passes, and its substitution, its call and any other string are named", () => {
    const reworded = TITLES.replace('74b — the group', 'the group')
      .replace('a 53b test', 'a test that says why')
      .replace(' test (K1)`', ' test`')
      .replace('"later, 117b"', '"later"');
    expect(differs(TITLES, reworded)).toBeNull();
    expect(differs(TITLES, TITLES.replace('${kind}', '${other}'))).toBe('line 3 "kind" → line 3 "other"');
    expect(differs(TITLES, TITLES.replace('it.skip(', 'it.only('))).toBe('line 3 "skip" → line 3 "only"');
    expect(differs(TITLES, TITLES.replace('a message, 40b', 'a message'))).toContain('a message');
    expect(differs(TITLES, TITLES.replace('a helper argument, 41c', 'a helper argument'))).toContain('a helper argument');
    expect(differs(TITLES, TITLES.replace('a second argument', 'another argument'))).toContain('another argument');
  });

  it('over two trees: a comment edit passes, and a code edit, a new file and a file it cannot split are named', () => {
    const before = new Map([
      ['src/a.ts', 'const a = 1; // one\n'],
      ['src/b.ts', 'const b = 2; // two\n'],
      ['src/c.glsl', 'void main() { } // c\n'],
      ['src/notes.md', 'notes\n'],
      ['src/same.ts', 'const s = 0;\n'],
    ]);
    const comments = new Map(before).set('src/a.ts', 'const a = 1;\n').set('src/c.glsl', '// c\nvoid main() { }\n');
    expect(compareStripped(before, comments)).toEqual({ compared: 5, changed: ['src/a.ts', 'src/c.glsl'], differences: [] });

    const code = new Map(before).set('src/b.ts', 'const b = 3; // two\n').set('src/notes.md', 'other notes\n').set('src/new.ts', '');
    code.delete('src/same.ts');
    expect(compareStripped(before, code).differences.map((d) => `${d.file}: ${d.what}`)).toEqual([
      'src/b.ts: code',
      'src/new.ts: added',
      'src/notes.md: unread',
      'src/same.ts: removed',
    ]);
    // A checkout with CRLF is the same file.
    expect(compareStripped(before, new Map(before).set('src/a.ts', 'const a = 1; // one\r\n')).changed).toEqual([]);
  });

  it('carries its own control: each comment-only file is compared again with a code edit made, and one whose code it cannot see is missed', () => {
    const before = new Map([
      ['src/a.ts', 'const a = 1; // one\nif (a > 0) b();\n'],
      ['src/b.ts', 'const b = 2;\n'],
      ['src/f.glsl', 'void main() { } // one\n'],
      ['src/open.css', '.a { color: red; }\n/* a comment left open'],
      ['src/s.css', '.a { color: red; } /* one */\n'],
      ['src/types.ts', '// the shape\nexport interface T { n: number }\n'],
    ]);
    const after = new Map(before)
      .set('src/a.ts', 'const a = 1; // reworded\nif (a > 0) b();\n')
      .set('src/b.ts', 'const b = 3;\n')
      .set('src/f.glsl', 'void main() { } // reworded\n')
      .set('src/open.css', '.a { color: red; }\n/* a comment left open, reworded')
      .set('src/s.css', '.a { color: red; } /* reworded */\n')
      .set('src/types.ts', '// the shape, reworded\nexport interface T { n: number }\n');
    const result = compareStripped(before, after);
    expect(result.differences.map((d) => d.file)).toEqual(['src/b.ts']);
    // The code edit is the middle one of the five the parser finds in a.ts;
    // a file with none takes a line appended. The planted bad case is the
    // open comment, which swallows the appended line, so the compare passes
    // the file whatever its code past the comment's start.
    expect(controlStripped(before, after, result).map((c) => `${c.file}: ${c.caught ? 'named' : 'missed'}, ${c.planted}`)).toEqual([
      'src/a.ts: named, line 2, boundary >  →  >=',
      'src/f.glsl: named, a line of code appended',
      'src/open.css: missed, a line of code appended',
      'src/s.css: named, a line of code appended',
      'src/types.ts: named, a line of code appended',
    ]);
  });
});

describe('splitCStyle', () => {
  const GLSL = ['// The sprite pass.', 'uniform float uFade; // 0 to 1', '#define HALF 0.5 /* a half */', 'void main() {', '  gl_FragColor = vec4(uFade / 2.0); /* two', '  lines */', '}'].join('\n');
  const CSS = ['/* The card. */', '.card::after { content: "/* not a comment */"; }', '.card { background: url(http://example.test/a.png); /* the art */ }', "a[href*='//'] { color: red; }"].join('\n');

  it('GLSL: line and block comments out, the lines left trimmed', () => {
    const split = splitCStyle(GLSL, true);
    expect(texts(split.comments)).toEqual(['// The sprite pass.', '// 0 to 1', '/* a half */', '/* two\n  lines */']);
    expect(split.comments.map((c) => c.line)).toEqual([1, 2, 3, 5]);
    expect(texts(split.code)).toEqual(['uniform float uFade;', '#define HALF 0.5', 'void main() {', 'gl_FragColor = vec4(uFade / 2.0);', '}']);
  });

  it('CSS: a comment opening inside a string is text, and "//" is not a comment', () => {
    const split = splitCStyle(CSS, false);
    expect(texts(split.comments)).toEqual(['/* The card. */', '/* the art */']);
    expect(texts(split.code)).toEqual([
      '.card::after { content: "/* not a comment */"; }',
      '.card { background: url(http://example.test/a.png); }',
      "a[href*='//'] { color: red; }",
    ]);
  });

  it('a comment edit leaves the lines as they were, and a code edit does not', () => {
    const lines = (text: string, glsl: boolean) => splitCStyle(text, glsl).code;
    expect(firstCodeDifference(lines(GLSL, true), lines(GLSL.replace('// The sprite pass.\n', '').replace(' /* a half */', '').replace('/* two\n  lines */', ''), true))).toBeNull();
    expect(firstCodeDifference(lines(GLSL, true), lines(GLSL.replace('2.0', '3.0'), true))).toContain('3.0');
    expect(firstCodeDifference(lines(CSS, false), lines(CSS.replace('/* The card. */\n', '/* The card,\n   on two lines. */\n').replace(' /* the art */', ''), false))).toBeNull();
    expect(firstCodeDifference(lines(CSS, false), lines(CSS.replace('not a comment', 'still not one'), false))).toContain('still not one');
  });

  it('splitSource picks the reader by extension and leaves other kinds alone', () => {
    expect(splitSource('a.glsl', GLSL)?.comments).toHaveLength(4);
    expect(splitSource('a.css', CSS)?.comments).toHaveLength(2);
    expect(splitSource('a.ts', TRICKY)?.comments).toHaveLength(7);
    expect(splitSource('a.md', '// prose')).toBeNull();
  });
});

describe('stepCodes', () => {
  const codes = (text: string): string[] => stepCodes(text).map((c) => c.code);

  it('counts a numbered step, bare or marked, with what is hyphenated onto it', () => {
    expect(codes('74b — the stream; see 96.5b2 and 77e2b, then 117.75a.')).toEqual(['74b', '96.5b2', '77e2b', '117.75a']);
    expect(codes('(§40b, §29, §117.5 and §65-shape-lock)')).toEqual(['§40b', '§29', '§117.5', '§65-shape-lock']);
    expect(codes('the 86c-L2b fix, 96.5b2-post, pre-79d')).toEqual(['86c-L2b', '96.5b2-post', '79d']);
    expect(codes('§79d/79d2 and §96–§100 and §54×K4')).toEqual(['§79d', '79d2', '§96', '§100', '§54', 'K4']);
  });

  it('counts a lettered step and a phase named with "Phase" or "§"', () => {
    expect(codes('K1 migrated this off H6c; GP5.2, D5.C, B1.1 and K3.5 followed (pre-F2).')).toEqual(['K1', 'H6c', 'GP5.2', 'D5.C', 'B1.1', 'K3.5', 'F2']);
    expect(codes('Phase 27 and Phase Y2; the Phase-L daemons; Phase Yb; §Z and §Q1.')).toEqual(['Phase 27', 'Phase Y2', 'Phase-L', 'Phase Yb', '§Z', '§Q1']);
    expect(stepCodes('74b §40b K1 Phase X').map((c) => c.kind)).toEqual(['numbered', 'mark', 'lettered', 'phase']);
  });

  it('does not count a section of a document, a gotcha, a round, or a plain quantity', () => {
    expect(codes('DESIGN §UI idioms; BALANCE §"The derived-artifact tripwire"; Round 7 spec §5; §Ports')).toEqual([]);
    expect(codes('gotcha #114; Round 8; Cluster 2; phase 2 of the load; Phase 1: bare units')).toEqual([]);
    expect(codes('40px wide, 50ms, 30s-40s, 2x2, 16px, 0.25s, 720p, 100vw, 8.5px, 12.5rem')).toEqual([]);
    expect(codes('#33ff00 0x70a1 #27ae60 v36 FNV-1a ES5 WebGL2 E2E Float32 rules 3a/3b, item 7b')).toEqual([]);
  });

  it('miscounts what its header says it does', () => {
    expect(codes('about 40k tokens; the L9 will be strongest')).toEqual(['40k', 'L9']);
  });

  it('reads comments and test titles, not other strings, and gives each code its line in order', () => {
    const source = ["// 53b — the stamp.", "const title = '74b — not a comment';", '/**', ' * Since 95e (and K1).', ' */', "it('the 66a case', () => {});", '// 67b', 'export {};'].join('\n');
    expect(codesInSource('x.ts', source).map((c) => `${c.code}@${c.line}`)).toEqual(['53b@1', '95e@4', 'K1@4', '66a@6', '67b@7']);
    expect(codesInSource('t.ts', TITLES).map((c) => c.code)).toEqual(['74b', '53b', 'K1', '95e', '117b']);
    expect(codesInSource('x.md', '53b')).toEqual([]);
  });

  it('the ceiling is by file, and drift is named either way', () => {
    const live = ceilingOf(codesInSource('src/a.ts', '// 53b 95e\n').concat(codesInSource('src/b.ts', '// K1\n')));
    expect(live).toEqual({ 'src/a.ts': 2, 'src/b.ts': 1 });
    expect(ceilingDrift(live, live)).toEqual({ over: [], under: [] });
    expect(ceilingDrift(live, { 'src/a.ts': 1, 'src/gone.ts': 4 })).toEqual({
      over: [
        { file: 'src/a.ts', now: 2, ceiling: 1 },
        { file: 'src/b.ts', now: 1, ceiling: 0 },
      ],
      under: [{ file: 'src/gone.ts', now: 0, ceiling: 4 }],
    });
  });
});

describe('measure', () => {
  it('counts lines by what they hold, and words in the comments', () => {
    const source = ['/**', ' * Five words in this header.', ' */', '', 'const a = 1; // and three more', '// ────────────', 'const b = `two', 'lines`;', ''].join('\n');
    expect(measure(source, splitTypeScript('m.ts', source))).toEqual({ code: 3, comment: 4, blank: 1, words: 8 });
  });

  it('counts nothing in an empty file', () => {
    expect(measure('', splitTypeScript('m.ts', ''))).toEqual({ code: 0, comment: 0, blank: 0, words: 0 });
  });
});
