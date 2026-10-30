// The run-config CLI's help names every URL parameter (tools/run-config/
// help.ts), read off the printed text against RUN_CONFIG_PARAMS, which the
// help's table is keyed by but this reader does not consult.
import { describe, expect, it } from 'vitest';
import { RUN_CONFIG_PARAMS } from '../src/run/RunConfig';
import { helpText } from '../tools/run-config/help';

/** The run dials a help text names, by the `--name=` that starts a line. */
const namedIn = (text: string): string[] =>
  [...text.matchAll(/^ {2}--([A-Za-z]+)=/gm)].map((m) => m[1]!).filter((n) => n !== 'strategy');

describe('the run-config help', () => {
  it('names every URL parameter, once', () => {
    const named = namedIn(helpText());
    expect([...named].sort()).toEqual(Object.values(RUN_CONFIG_PARAMS).sort());
    expect(new Set(named).size).toBe(named.length);
  });

  it('gives each camelCase name its hyphenated spelling', () => {
    expect(helpText()).toContain('--sectorHops=N (--sector-hops)');
    expect(helpText()).toContain('--firstNode=KIND (--first-node)');
  });

  it('the control: a help missing a line fails the check', () => {
    const planted = helpText()
      .split('\n')
      .filter((l) => !l.startsWith('  --escalation='))
      .join('\n');
    expect([...namedIn(planted)].sort()).not.toEqual(Object.values(RUN_CONFIG_PARAMS).sort());
  });
});
