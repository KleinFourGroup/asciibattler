import { describe, expect, it } from 'vitest';
import { memoryAdapter } from './adapter';
import { BACKUP_FORMAT, BACKUP_MARK, backupFileName, backupOf, readBackup } from './backup';
import { SECTION_NAMES, STORE_VERSION, createStore, storageKey, type StoreDump } from './store';

// 116h — the backup file. Stored text is planted in and read back from the
// adapters' maps, never through the module under test.

const BUILD = '0.1.0+abc1234';
const NOW = Date.UTC(2026, 9, 7, 12, 30, 0, 0);
const KEYS = SECTION_NAMES.map(storageKey);
const envelope = (v: number, data: unknown): string => JSON.stringify({ v, build: BUILD, data });

/** A journal as an export of one holds it: the file a player is most likely
 *  to pick by mistake. */
const JOURNAL = {
  format: 2,
  segments: [{ build: BUILD, configHash: 'deadbeef', openedAt: 0, start: { kind: 'seed', seed: 7, dials: '' }, entries: [], end: null }],
};

const planted = (): Record<string, string> => ({
  'asciibattler:settings': envelope(1, { volumeMaster: 0.25, palette: 'colourblind' }),
  'asciibattler:progress': envelope(1, { creditsSeen: true }),
  'asciibattler:run': envelope(47, { snapshot: { 'a "quoted" key': '\\ and \n' }, dials: 'seed=7', journal: JOURNAL }),
  'asciibattler:journals': envelope(1, [JOURNAL]),
});

describe('116h — the backup file', () => {
  it('holds each section as it is stored, the build and the time, under the mark', () => {
    const adapter = memoryAdapter(planted());
    const dump = createStore({ adapter, build: BUILD }).dump()!;
    const backup = backupOf(dump, BUILD, NOW);
    expect(backup).toEqual({
      backup: 'asciibattler-backup',
      format: 1,
      store: STORE_VERSION,
      build: BUILD,
      exportedAt: NOW,
      sections: {
        meta: adapter.entries.get('asciibattler:meta'),
        settings: planted()['asciibattler:settings'],
        progress: planted()['asciibattler:progress'],
        run: planted()['asciibattler:run'],
        journals: planted()['asciibattler:journals'],
      },
    });
    expect(backupFileName(backup)).toBe('asciibattler-backup-2026-10-07T12-30-00-000Z.json');
  });

  it('exported from one store and imported into an empty one, every section reads back equal', async () => {
    const from = memoryAdapter(planted());
    const file = JSON.stringify(backupOf(createStore({ adapter: from, build: BUILD }).dump()!, BUILD, NOW));

    const read = readBackup(file);
    expect(read.ok).toBe(true);
    if (!read.ok) return;
    expect(read.backup.build).toBe(BUILD);
    expect(read.backup.exportedAt).toBe(NOW);

    const to = memoryAdapter();
    expect(await createStore({ adapter: to, build: BUILD }).restore(read.backup.sections)).toEqual({ ok: true });
    for (const key of KEYS) expect(to.entries.get(key), key).toBe(from.entries.get(key));
    expect([...to.entries.keys()].sort()).toEqual([...from.entries.keys()].sort());
    // The known answer: the planted text itself, not only what the other store holds.
    expect(to.entries.get('asciibattler:run')).toBe(planted()['asciibattler:run']);
  });

  it('refuses a file that is not a backup', () => {
    const sections: StoreDump = { meta: null, settings: null, progress: null, run: null, journals: null };
    const good = backupOf(sections, BUILD, NOW);
    const refused: [string, string][] = [
      ['empty text', ''],
      ['text that is not JSON', 'asciibattler-backup'],
      ['a truncated backup', JSON.stringify(good).slice(0, -1)],
      ['a JSON list', '[]'],
      ['a JSON null', 'null'],
      ["a run's journal", JSON.stringify(JOURNAL)],
      ['a section of the store', envelope(1, {})],
      ['another mark', JSON.stringify({ ...good, backup: 'asciibattler' })],
      ['no sections', JSON.stringify({ ...good, sections: undefined })],
      ['sections that are a list', JSON.stringify({ ...good, sections: [] })],
      ['a section that is not text', JSON.stringify({ ...good, sections: { ...sections, settings: { v: 1, data: {} } } })],
      ['a section that is a number', JSON.stringify({ ...good, sections: { ...sections, run: 7 } })],
      ['no build', JSON.stringify({ ...good, build: undefined })],
      ['no time', JSON.stringify({ ...good, exportedAt: undefined })],
      ['a time that is text', JSON.stringify({ ...good, exportedAt: '2026-10-07' })],
    ];
    for (const [name, text] of refused) expect(readBackup(text), name).toEqual({ ok: false, reason: 'not-a-backup' });
    // The control: the file those were made from is taken.
    expect(readBackup(JSON.stringify(good))).toEqual({ ok: true, backup: good });
  });

  it('refuses a backup at another format or of another store layout, by its own reason', () => {
    const sections: StoreDump = { meta: null, settings: null, progress: null, run: null, journals: null };
    const good = backupOf(sections, BUILD, NOW);
    expect(good.backup).toBe(BACKUP_MARK);
    for (const other of [
      { ...good, format: BACKUP_FORMAT + 1 },
      { ...good, format: String(BACKUP_FORMAT) },
      { ...good, store: STORE_VERSION + 1 },
      { ...good, store: undefined },
    ]) {
      expect(readBackup(JSON.stringify(other))).toEqual({ ok: false, reason: 'other-version' });
    }
  });

  it('drops a section it does not know and reads one the file does not name as empty', () => {
    const file = {
      backup: BACKUP_MARK,
      format: BACKUP_FORMAT,
      store: STORE_VERSION,
      build: BUILD,
      exportedAt: NOW,
      sections: { settings: 'kept as text', achievements: 'from a later build' },
      note: 'a key the file may gain',
    };
    expect(readBackup(JSON.stringify(file))).toEqual({
      ok: true,
      backup: {
        backup: BACKUP_MARK,
        format: BACKUP_FORMAT,
        store: STORE_VERSION,
        build: BUILD,
        exportedAt: NOW,
        sections: { meta: null, settings: 'kept as text', progress: null, run: null, journals: null },
      },
    });
  });
});
