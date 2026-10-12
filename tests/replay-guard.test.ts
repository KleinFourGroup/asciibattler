import { describe, expect, it } from 'vitest';
import { chainTo, repoRead, runtimeGraph, type Read } from './importGraph';

// THE GAME REPLAYS NOTHING.
//
// `replayJournal` can be asked to go past a config mismatch
// (`ReplayOptions.ignoreConfig`), which is for tools that hold two trees
// against each other: `npm run replay -- --force-config` and the journal
// corpus. The shipped game must never replay a journal recorded under other
// balance numbers, and the structural way to hold that is that its entry
// can't reach the replay modules at run time, directly or through anything
// it imports.

const ENTRY = 'src/main.ts';
const isReplay = (path: string): boolean => /^src\/journal\/replay\w*\.ts$/.test(path);

/** Each replay module the entry reaches, with the import chain that reaches it. */
function replayReaches(entry: string, read: Read): string[] {
  const graph = runtimeGraph(entry, read);
  return graph.files.filter(isReplay).map((f) => chainTo(f, graph).join(' → '));
}

describe('the game’s entry never reaches the journal replay', () => {
  it('src/main.ts reaches no src/journal/replay*.ts at run time', () => {
    expect(replayReaches(ENTRY, repoRead)).toEqual([]);
  });

  it('the walk reaches the game and the journal’s recorder', () => {
    // Known answers for the instrument: an empty or shallow walk would pass.
    const graph = runtimeGraph(ENTRY, repoRead);
    expect(graph.files).toContain('src/Game.ts');
    expect(graph.files).toContain('src/journal/JournalRecorder.ts');
    expect(graph.files.length).toBeGreaterThan(100);
  });

  it('the pattern names the replay modules that exist', () => {
    for (const path of ['src/journal/replayJournal.ts', 'src/journal/replayTool.ts', 'src/journal/replayDigest.ts']) {
      expect(repoRead(path), path).toBeDefined();
      expect(isReplay(path), path).toBe(true);
    }
    expect(isReplay('src/journal/JournalRecorder.ts')).toBe(false);
  });

  it('a planted import is reported with its chain, direct or through another module', () => {
    const planted = new Map<string, string>([
      ['src/main.ts', "import { Game } from './Game';\nexport const game = Game;"],
      ['src/Game.ts', "import { replayText } from './journal/replayTool';\nexport const Game = replayText;"],
      ['src/journal/replayTool.ts', "import { replayJournal } from './replayJournal';\nexport const replayText = replayJournal;"],
      ['src/journal/replayJournal.ts', 'export const replayJournal = 1;'],
    ]);
    expect(replayReaches(ENTRY, (path) => planted.get(path))).toEqual([
      'src/main.ts → src/Game.ts → src/journal/replayTool.ts → src/journal/replayJournal.ts',
      'src/main.ts → src/Game.ts → src/journal/replayTool.ts',
    ]);
  });
});
