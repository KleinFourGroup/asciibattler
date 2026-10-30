/**
 * The run-config CLI's help (`npm run run-config -- --help`). One line per
 * URL parameter, keyed by `RUN_CONFIG_PARAMS`, so a new parameter fails
 * typecheck here until it has its line; `tests/run-config-help.test.ts`
 * reads the printed text against the same table.
 */
import { RUN_CONFIG_PARAMS } from '../../src/run/RunConfig';

type Param = keyof typeof RUN_CONFIG_PARAMS;

/** A parameter's value as the help shows it, and what it does. */
const PARAM_HELP: Record<Param, { readonly value: string; readonly text: readonly string[] }> = {
  seed: { value: 'N', text: ['run seed (default: Date.now())'] },
  hops: { value: 'N', text: ['the first act alone, N hops incl. root + boss (2 = one battle)'] },
  sectorHops: { value: 'N', text: ['every act N hops, the whole walk still played (not with --hops)'] },
  roster: { value: 'LIST', text: ['archetype[:level],...  e.g. rogue:3,healer:2,mercenary'] },
  layout: { value: 'ID', text: ['every battle on a named layout, or `procedural`'] },
  encounter: {
    value: 'ID',
    text: ['the authored encounter at every node of its kind', '(pair with --layout to pin the whole board)'],
  },
  firstNode: { value: 'KIND', text: ['the first node an elite, an event or a rest'] },
  event: {
    value: 'ID',
    text: ['every event node opens this event (an events.json id;', 'pair with --firstNode=event to open a run on it)'],
  },
  script: {
    value: 'TEXT',
    text: [
      'the scripted run: entries `address:item,item` apart by `;`',
      '(e.g. 3:event=cadre-1;4:encounter=brigands,layout=river;6:port=rogue:3/mars)',
    ],
  },
  act: { value: 'N', text: ['open the run at the walk\'s Nth act (with --hops, that act alone)'] },
  width: { value: 'N', text: ['middle-hop max width'] },
  daemon: {
    value: 'ID',
    text: ['the run\'s daemon (a catalog id, or `none`); default the character\'s'],
  },
  character: { value: 'ID', text: ['the starting character (a characters.json id; default soldier)'] },
  bits: { value: 'N', text: ['starting bits (nonnegative; default config/difficulty.json)'] },
  escalation: { value: 'N', text: ['the Escalation level, 1 to the ladder\'s top (default 0, off)'] },
};

/** A camelCase parameter's hyphenated spelling, which the CLI also takes. */
export const hyphenated = (name: string): string => name.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`);

const flagColumn = (name: string, value: string): string => {
  const flag = `--${name}=${value}`;
  const alias = hyphenated(name) === name ? '' : ` (--${hyphenated(name)})`;
  return `${flag}${alias}`;
};

export function helpText(): string {
  const params = (Object.keys(RUN_CONFIG_PARAMS) as Param[]).map((key) => {
    const name = RUN_CONFIG_PARAMS[key];
    const { value, text } = PARAM_HELP[key];
    const head = flagColumn(name, value);
    const pad = ' '.repeat(Math.max(1, 34 - head.length));
    return [`  ${head}${pad}${text[0]}`, ...text.slice(1).map((t) => `${' '.repeat(36)}${t}`)].join('\n');
  });
  return [
    'run-config — build a RunConfig launch URL and drive a quick headless run.',
    '',
    'The run dials, by their URL names:',
    ...params,
    '',
    'The tool\'s own flags:',
    '  --strategy=NAME                   headless drive strategy (default: pure-random);',
    '                                    e.g. greedy | recruit:mage | stat:constitution | path:rest',
    '  --no-run                          print the launch URL only; skip the headless run',
    '  --help                            show this help',
    '',
  ].join('\n');
}
