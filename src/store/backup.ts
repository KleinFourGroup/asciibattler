/**
 * THE BACKUP (Round 8 spec D1): the whole store as one file, for the player
 * to keep or to carry to another browser. The web store is best-effort (on
 * itch another game on the shared origin can clear or crowd it), so the
 * settings offer an export of everything and an import that puts it back.
 *
 * THE FILE holds each section's text exactly as it is stored, by section
 * name, so an import writes back the bytes that were exported and each
 * section is then read by its own policy, as if this browser had stored it:
 * the settings and progress leniently, and a run saved at another format
 * rejected with its message (runSlot.ts). The file also says which build
 * exported it and when, for the player to tell two backups apart.
 *
 * WHAT IS REFUSED, before anything is written: text that isn't JSON, JSON
 * that isn't this file (a run's journal, picked by mistake, is the likely
 * one), and a backup at another format or of another store layout. Inside a
 * backup a section this build doesn't know is dropped and one the file
 * doesn't name is empty, which is the lenient sections' rule one level up.
 *
 * Game-layer only, and not part of the store's boot graph
 * (tests/store-boot.test.ts).
 */

import { SECTION_NAMES, STORE_VERSION, type SectionName, type StoreDump } from './store';

/** What marks a file as this game's backup. Permanent: it is in every file a
 *  player has kept. */
export const BACKUP_MARK = 'asciibattler-backup';

/** The file's own format. An import refuses any other. */
export const BACKUP_FORMAT = 1;

/** A file larger than this is not read. No store comes near it (the finished
 *  journals, the largest section, are budgeted at 1 MB of text; journals.ts),
 *  and reading a large file picked by mistake should not stall the page. */
export const BACKUP_MAX_BYTES = 16_000_000;

export interface Backup {
  readonly backup: typeof BACKUP_MARK;
  readonly format: number;
  /** `STORE_VERSION` of the store it was taken from. */
  readonly store: number;
  /** `BUILD_ID` of the page that exported it. */
  readonly build: string;
  /** Epoch milliseconds when it was exported. */
  readonly exportedAt: number;
  readonly sections: StoreDump;
}

export function backupOf(dump: StoreDump, build: string, now: number): Backup {
  return { backup: BACKUP_MARK, format: BACKUP_FORMAT, store: STORE_VERSION, build, exportedAt: now, sections: dump };
}

/** The name a backup's file gets: when it was exported, in UTC, in the form
 *  the journal's file uses (`asciibattler-backup-2026-10-07T12-30-00-000Z.json`). */
export function backupFileName(backup: Backup): string {
  return `asciibattler-backup-${new Date(backup.exportedAt).toISOString().replace(/[:.]/g, '-')}.json`;
}

export type BackupRead =
  | { readonly ok: true; readonly backup: Backup }
  /** `not-a-backup`: not JSON, or not this file. `other-version`: a backup at
   *  another format, or of another store layout. */
  | { readonly ok: false; readonly reason: 'not-a-backup' | 'other-version' };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** The backup in `text`, checked whole before any of it is used. */
export function readBackup(text: string): BackupRead {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return { ok: false, reason: 'not-a-backup' };
  }
  if (!isRecord(parsed) || parsed.backup !== BACKUP_MARK) return { ok: false, reason: 'not-a-backup' };
  if (parsed.format !== BACKUP_FORMAT || parsed.store !== STORE_VERSION) return { ok: false, reason: 'other-version' };
  const { build, exportedAt } = parsed;
  if (!isRecord(parsed.sections) || typeof build !== 'string' || typeof exportedAt !== 'number' || !Number.isFinite(exportedAt)) {
    return { ok: false, reason: 'not-a-backup' };
  }
  const sections = {} as Record<SectionName, string | null>;
  for (const name of SECTION_NAMES) {
    const section = parsed.sections[name] ?? null;
    if (section !== null && typeof section !== 'string') return { ok: false, reason: 'not-a-backup' };
    sections[name] = section;
  }
  return {
    ok: true,
    backup: { backup: BACKUP_MARK, format: BACKUP_FORMAT, store: STORE_VERSION, build, exportedAt, sections },
  };
}
