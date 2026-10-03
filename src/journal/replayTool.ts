/**
 * What `npm run replay -- <file>` does, as a pure function over the file's
 * text (scripts/replay.ts reads the file, asks git for the tree's stamp and
 * prints the lines).
 *
 * THE FILE is a journal as the game exports it, or a probe report that
 * carries one (`journal`, with the page's `stateHash` beside it:
 * shell/electron/probes/drive-run.js).
 *
 * WHICH BUILDS ARE ACCEPTED. A journal replays on the build that recorded
 * it, so each segment's build ID is held against the tree the tool runs in:
 *  - another commit is refused, with the commit to check out;
 *  - a `-dirty` build is refused (Round 8 spec D2): its code is in no commit;
 *  - an ID that names no commit is refused: `unbaked` (nothing stamped it),
 *    `nogit`, or a pinned one;
 *  - `-dev` is accepted: a dev server stamps each page with the commit and
 *    the tree's state as of that page's load.
 * `force` replays past these. Another config hash is `replayJournal`'s own
 * refusal, and nothing forces it. A tree with uncommitted changes of its own
 * is not the build either; that is a warning, since the tool can't tell a
 * changed comment from changed code and the replay itself says if it
 * diverged.
 *
 * EXIT CODES: 0 every segment replayed to what the journal recorded (and to
 * the page's hash, when the file carries one); 1 a divergence, a hash that
 * doesn't match, or a file that isn't a journal; 2 a refusal.
 */

import { UNBAKED_BUILD_ID } from '../buildId';
import { JOURNAL_FORMAT, type JournalSegment, type RunJournal } from './journal';
import { JournalDivergence, JournalRefused, replayJournal } from './replayJournal';

export interface ToolResult {
  readonly code: 0 | 1 | 2;
  readonly lines: readonly string[];
}

const BUILD_ID_SHAPE = /^(.+)\+([0-9a-f]{7})(-dirty)?(-dev)?$/;
const DIRTY = '-dirty';

/**
 * Why a segment recorded on `build` can't be replayed in a tree whose stamp
 * is `tree` (`commitStamp`: the commit, with `-dirty` after it when the tree
 * has uncommitted changes), or null when it can.
 */
export function buildRefusal(build: string, tree: string): string | null {
  if (build === UNBAKED_BUILD_ID) {
    return `its build ID is '${UNBAKED_BUILD_ID}': nothing stamped the code that recorded it`;
  }
  const parts = BUILD_ID_SHAPE.exec(build);
  if (parts === null) return `its build ID '${build}' names no commit`;
  const commit = parts[2]!;
  if (parts[3] !== undefined) {
    return `it was recorded on a build of ${commit} with uncommitted changes ('${build}'), which no commit holds`;
  }
  const here = tree.endsWith(DIRTY) ? tree.slice(0, -DIRTY.length) : tree;
  if (commit !== here) {
    return `it was recorded on commit ${commit} ('${build}') and this tree is at ${here}: git checkout ${commit}, then replay there`;
  }
  return null;
}

function describeStart(segment: JournalSegment): string {
  const { start } = segment;
  const dials = start.dials === '' ? '' : ` (${start.dials})`;
  if (start.kind === 'seed') return `seed ${start.seed}${dials}`;
  if (start.kind === 'snapshot') return `a snapshot in phase ${start.snapshot.phase}${dials}`;
  return `resumed from the segment before at hash ${start.hash}${dials}`;
}

function isJournal(value: unknown): value is RunJournal {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as RunJournal).format === 'number' &&
    Array.isArray((value as RunJournal).segments)
  );
}

export function replayText(text: string, tree: string, options: { force?: boolean } = {}): ToolResult {
  const lines: string[] = [];
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch (err) {
    return { code: 1, lines: [`not JSON: ${err instanceof Error ? err.message : String(err)}`] };
  }
  // A probe report carries the journal beside the page's own hash, in the
  // script's result (`npm run probe` prints `{ result: { script } }`).
  const script = (parsed as { result?: { script?: unknown } } | null)?.result?.script ?? parsed;
  const report = script as { journal?: unknown; stateHash?: unknown } | null;
  const inReport = report !== null && typeof report === 'object' && 'journal' in report;
  const journal = inReport ? report.journal : parsed;
  const pageHash = inReport && typeof report.stateHash === 'string' ? report.stateHash : null;
  if (!isJournal(journal)) {
    return { code: 1, lines: ['not a run journal: no `format` and `segments` (nor a probe report with a `journal`)'] };
  }
  if (journal.format !== JOURNAL_FORMAT) {
    return { code: 2, lines: [`refused: the journal's format is ${journal.format}; this build reads format ${JOURNAL_FORMAT}`] };
  }

  let refused = false;
  journal.segments.forEach((segment, i) => {
    lines.push(
      `segment ${i}: build ${segment.build}, config ${segment.configHash}, ${describeStart(segment)}, ` +
        `${segment.entries.length} entries`,
    );
    const refusal = buildRefusal(segment.build, tree);
    if (refusal === null) return;
    if (options.force) {
      lines.push(`segment ${i}: forced past: ${refusal}`);
    } else {
      lines.push(`segment ${i}: refused: ${refusal}`);
      refused = true;
    }
  });
  if (refused) {
    lines.push('--force replays it on this tree anyway');
    return { code: 2, lines };
  }
  if (tree.endsWith(DIRTY)) {
    lines.push(`warning: this tree has uncommitted changes (${tree}), so it is not exactly the build that recorded the journal`);
  }

  let replay;
  try {
    replay = replayJournal(journal);
  } catch (err) {
    if (err instanceof JournalRefused) return { code: 2, lines: [...lines, `refused: ${err.message}`] };
    if (err instanceof JournalDivergence) return { code: 1, lines: [...lines, `DIVERGED: ${err.message}`] };
    throw err;
  }

  replay.segments.forEach((segment, i) => {
    const end = journal.segments[i]!.end;
    lines.push(
      end === null
        ? `segment ${i}: replayed ${segment.battles} battles; the journal has no end yet, and the replay stands at hash ${segment.hash}`
        : `segment ${i}: replayed ${segment.battles} battles to its end (${end.reason}); hash ${segment.hash} matches the journal's`,
    );
  });
  const last = replay.segments.at(-1);
  if (pageHash !== null && last !== undefined) {
    if (last.hash !== pageHash) {
      lines.push(`DIVERGED: the page reported hash ${pageHash}, and the replay reached ${last.hash}`);
      return { code: 1, lines };
    }
    lines.push(`the page reported hash ${pageHash}: the replay reached the same`);
  }
  return { code: 0, lines };
}
