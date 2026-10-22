import { describe, expect, it } from 'vitest';
import { compareSheets, controlCss, describeCss, overlaps, readPage, specificity, type CssDifference } from './cssCompare';

// The stylesheet compare. Each check is held against sheets written out by
// hand: moves it must pass (a hoist into an imported sheet, a base block
// with the page's additions, a reorder across specificities) and edits it
// must name (a changed value, a dropped declaration, an added rule, a
// reorder that can change a winner).

const PAGE = 'tools/a/editor.css';
const tree = (sheets: Record<string, string>): Map<string, string> => new Map(Object.entries(sheets));
const run = (before: Record<string, string>, after: Record<string, string>): readonly CssDifference[] =>
  compareSheets(tree(before), tree(after), [PAGE]).differences;
const kinds = (ds: readonly CssDifference[]): string[] => ds.map((d) => d.what);

const SHEET = `
:root { --bg: #000; --text: #ddd; }
* { box-sizing: border-box; }
body { margin: 0; color: var(--text); }
.bar { display: flex; gap: 14px; }
.bar h1 { font-size: 18px; color: #33ff00; }
#editor-root { padding: 16px; }
.card { padding: 8px; color: #ccc; }
@media (max-width: 880px) {
  .bar { display: block; }
}
`;

describe('css-compare: what it must pass', () => {
  it('holds a page equal to itself, and its comments and layout are not read', () => {
    expect(run({ [PAGE]: SHEET }, { [PAGE]: SHEET })).toEqual([]);
    const relaid = SHEET.replace('.bar { display: flex; gap: 14px; }', '/* the bar */\n.bar {\n  display:   flex;\n  gap: 14px\n}');
    expect(run({ [PAGE]: SHEET }, { [PAGE]: relaid })).toEqual([]);
  });

  it('passes a hoist of the leading rules into a sheet the page imports first', () => {
    const [head, tail] = [SHEET.slice(0, SHEET.indexOf('#editor-root')), SHEET.slice(SHEET.indexOf('#editor-root'))];
    expect(run({ [PAGE]: SHEET }, { 'tools/base.css': head, [PAGE]: `@import '../base.css';\n${tail}` })).toEqual([]);
    expect(run({ [PAGE]: SHEET }, { 'tools/base.css': head, [PAGE]: `@import url("../base.css");\n${tail}` })).toEqual([]);
  });

  it('passes a base block with the page keeping only what it adds or changes', () => {
    const before = { [PAGE]: ':root { --bg: #000; --text: #ddd; --tier: #9d00ff; }\n.row { padding: 4px; color: red; }' };
    const after = {
      'tools/base.css': ':root { --bg: #000; --text: #ddd; }\n.row { padding: 4px; color: blue; }',
      [PAGE]: "@import '../base.css';\n:root { --tier: #9d00ff; }\n.row { color: red; }",
    };
    expect(run(before, after)).toEqual([]);
  });

  it('passes a reorder of two rules that differ in specificity', () => {
    const before = { [PAGE]: '#editor-root .bar { color: red; }\n.card .bar { color: blue; }' };
    const after = { [PAGE]: '.card .bar { color: blue; }\n#editor-root .bar { color: red; }' };
    expect(run(before, after)).toEqual([]);
  });

  it('passes a reorder of two rules whose properties do not overlap, and of two equal declarations', () => {
    expect(run({ [PAGE]: '.a { color: red; }\n.b { padding: 0; }' }, { [PAGE]: '.b { padding: 0; }\n.a { color: red; }' })).toEqual([]);
    expect(run({ [PAGE]: '.a { color: red; }\n.b { color: red; }' }, { [PAGE]: '.b { color: red; }\n.a { color: red; }' })).toEqual([]);
  });

  it('passes the removal of a declaration a later one of the same selector hides', () => {
    expect(run({ [PAGE]: '.a { color: red; }\n.b { padding: 0; }\n.a { color: blue; }' }, { [PAGE]: '.b { padding: 0; }\n.a { color: blue; }' })).toEqual([]);
  });
});

describe('css-compare: what it must name', () => {
  it('names a changed value, with its selector, property and context', () => {
    const ds = run({ [PAGE]: SHEET }, { [PAGE]: SHEET.replace('.bar { display: block; }', '.bar { display: grid; }') });
    expect(kinds(ds)).toEqual(['changed']);
    expect(describeCss(ds[0]!)).toBe('changed  @media (max-width: 880px) / .bar { display }: block -> grid (tools/a/editor.css)');
  });

  it('names a dropped declaration and an added rule', () => {
    expect(kinds(run({ [PAGE]: SHEET }, { [PAGE]: SHEET.replace(' gap: 14px;', '') }))).toEqual(['dropped']);
    expect(kinds(run({ [PAGE]: SHEET }, { [PAGE]: `${SHEET}\n.new { color: red; }` }))).toEqual(['added']);
    expect(kinds(run({ [PAGE]: SHEET }, { [PAGE]: SHEET.replace('color: #ccc;', 'color: #ccc !important;') }))).toEqual(['dropped', 'added']);
  });

  it('names a reorder of two rules at one specificity that set one property', () => {
    const ds = run({ [PAGE]: '.a { color: red; }\n.b { color: blue; }' }, { [PAGE]: '.b { color: blue; }\n.a { color: red; }' });
    expect(kinds(ds)).toEqual(['order']);
    expect(describeCss(ds[0]!)).toBe('order    .a { color }: red came before .b { color }: blue, and now comes after it, at one specificity');
  });

  it('names a hoist that lifts a shared rule above a page rule it can lose to', () => {
    const before = { [PAGE]: '.own { color: red; }\n.shared { color: blue; }' };
    const after = { 'tools/base.css': '.shared { color: blue; }', [PAGE]: "@import '../base.css';\n.own { color: red; }" };
    expect(kinds(run(before, after))).toEqual(['order']);
  });

  it('names a shorthand and its longhand reordered on one selector', () => {
    expect(kinds(run({ [PAGE]: '.a { margin: 0; }\n.a { margin-top: 4px; }' }, { [PAGE]: '.a { margin-top: 4px; }\n.a { margin: 0; }' }))).toEqual(['order']);
  });

  it('names a base declaration the page did not have', () => {
    const after = { 'tools/base.css': ':root { --bg: #000; --accent: #33ff00; }', [PAGE]: "@import '../base.css';" };
    const ds = run({ [PAGE]: ':root { --bg: #000; }' }, after);
    expect(kinds(ds)).toEqual(['added']);
    expect(describeCss(ds[0]!)).toBe('added    :root { --accent }: #33ff00 (tools/base.css)');
  });

  it("names a bare module's import added or dropped", () => {
    expect(kinds(run({ [PAGE]: "@import '@fontsource/x/400.css';\n.a { color: red; }" }, { [PAGE]: '.a { color: red; }' }))).toEqual(['import']);
  });

  it('refuses what its checks do not model, on either side', () => {
    const refused = (sheet: string): string[] => kinds(run({ [PAGE]: '.a { color: red; }' }, { [PAGE]: sheet }));
    expect(refused('@layer base { .a { color: red; } }')).toEqual(['unreadable']);
    expect(refused('.a { color: red; .b { color: blue; } }')).toEqual(['unreadable']);
    expect(refused(".a { color: red; }\n@import '../base.css';")).toEqual(['unreadable']);
    expect(refused("@import '../base.css' screen;\n.a { color: red; }")).toEqual(['unreadable']);
    expect(refused(".a { content: '}'; color: red; }")).toEqual(['unreadable']);
    expect(refused("@import '../missing.css';\n.a { color: red; }")).toEqual(['unreadable']);
  });
});

describe('css-compare: its readers', () => {
  it('reads a selector list as one declaration a selector, in load order through an import', () => {
    const page = readPage(tree({ 'tools/base.css': '.x, .y > a { color: red; }', [PAGE]: "@import '../base.css';\n.z { color: blue; }" }), PAGE);
    expect(page.declarations.map((d) => `${d.selector}:${d.order}:${d.sheet}`)).toEqual([
      '.x:0:tools/base.css',
      '.y > a:1:tools/base.css',
      '.z:2:tools/a/editor.css',
    ]);
  });

  it('computes specificity by Selectors Level 4', () => {
    expect(specificity('*')).toEqual([0, 0, 0]);
    expect(specificity('li')).toEqual([0, 0, 1]);
    expect(specificity('ul li.red')).toEqual([0, 1, 2]);
    expect(specificity('#editor-root .bar > h1:hover::before')).toEqual([1, 2, 2]);
    expect(specificity("input[type='radio']:checked::before")).toEqual([0, 2, 2]);
    expect(specificity('a:before')).toEqual([0, 0, 2]);
    expect(specificity(':where(#a .b) c')).toEqual([0, 0, 1]);
    expect(specificity(':is(#a, .b) c')).toEqual([1, 0, 1]);
    expect(specificity('#editor-root:not(.sus-restricted) .sus-row')).toEqual([1, 2, 0]);
    expect(specificity('li:nth-child(2n + 1 of .x, #y)')).toEqual([1, 1, 1]);
    expect(specificity('li:nth-child(2n+1)')).toEqual([0, 1, 1]);
  });

  it('holds a shorthand against its longhands and a logical property against its physical twin', () => {
    expect(overlaps('margin', 'margin-top')).toBe(true);
    expect(overlaps('width', 'inline-size')).toBe(true);
    expect(overlaps('left', 'inset')).toBe(true);
    expect(overlaps('row-gap', 'gap')).toBe(true);
    expect(overlaps('font', 'line-height')).toBe(true);
    expect(overlaps('place-items', 'align-items')).toBe(true);
    expect(overlaps('all', 'color')).toBe(true);
    expect(overlaps('color', 'background-color')).toBe(false);
    expect(overlaps('align-items', 'justify-content')).toBe(false);
    expect(overlaps('all', '--bg')).toBe(false);
    expect(overlaps('--bg', '--Bg')).toBe(false);
  });
});

describe('css-compare: its control', () => {
  it('names the rule it appends on every page that passed', () => {
    const sheets = tree({ [PAGE]: SHEET, 'tools/b/editor.css': '.only { color: red; }' });
    const result = compareSheets(sheets, sheets, [PAGE, 'tools/b/editor.css']);
    expect(result.differences).toEqual([]);
    expect(controlCss(sheets, sheets, result)).toEqual([
      { page: PAGE, caught: true },
      { page: 'tools/b/editor.css', caught: true },
    ]);
  });
});
