/**
 * 142g — `--run-script` and `--act`, the scripted run on the fuzz CLI:
 * read through the URL's parse, loudly; run mode only; and with
 * `--arbitrate`, only the entries a rollout clone keeps (the starting act,
 * and the kinds stamped in it) pass.
 */

import { describe, it, expect } from 'vitest';
import { parseArgs, scriptFromArgs } from './args';

describe('--run-script and --act (142g)', () => {
  it('read into the config as the URL reads them', () => {
    const args = parseArgs(['--run-script=3:encounter=brigands;5:port=rogue:3/mars', '--act=2', '--hops=11']);
    expect(scriptFromArgs(args)).toEqual({
      script: [
        { hop: 3, encounter: 'brigands' },
        { hop: 5, port: [{ kind: 'unit', archetype: 'rogue', level: 3 }, { kind: 'daemon', id: 'mars' }] },
      ],
      startAct: 2,
    });
    expect(scriptFromArgs(parseArgs(['--count=5']))).toEqual({});
  });

  it('fail on any part the URL parse would drop', () => {
    expect(() => parseArgs(['--run-script=3:encounter=no-such'])).toThrow(/no such encounter/);
    expect(() => parseArgs(['--act=9'])).toThrow(/act: dropped "9"/);
  });

  it('are run mode only', () => {
    expect(() => parseArgs(['--search', '--act=2'])).toThrow(/run mode only/);
  });

  it('with --arbitrate, keep the starting act and the kinds stamped in it', () => {
    expect(() => parseArgs(['--arbitrate', '--act=2', '--hops=11'])).not.toThrow();
    expect(() => parseArgs(['--arbitrate', '--act=2', '--hops=11', '--run-script=1:elite;2.4:rest'])).not.toThrow();
    // The control: every other entry is refused, by name.
    expect(() => parseArgs(['--arbitrate', '--hops=11', '--run-script=3:encounter=brigands'])).toThrow(
      /refused with --run-script entries 3:encounter=brigands/,
    );
    expect(() => parseArgs(['--arbitrate', '--hops=11', '--run-script=*:layout=river;2.3:rest'])).toThrow(
      /entries \*:layout=river;2\.3:rest/,
    );
  });
});
