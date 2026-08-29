/**
 * 86e4 — the fail-closed contract as tests, pinned at the CLI level: every
 * FAIL class must produce a FAIL row AND a non-zero exit through the real
 * `balance:board --report` entry. The exit-code wiring is exactly the part
 * that sat dead for two months (every check `reference`-grade → `fails`
 * always 0), so the pure-layer pins in board.test.ts are not enough — this
 * file proves the plumbing end to end.
 *
 * Kept to four spawns: a happy full-board tree (exit 0), one mega-mutation
 * tree (eight independent per-instrument breakages + the cross-dir head
 * split in a single report — classes are judged per instrument, so they
 * can't mask each other), and the --allow-unmanifested pair.
 */

import { describe, it, expect } from 'vitest';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { tmpdir } from 'node:os';
import { buildBoard, type BoardInstrument } from './board';
import { writeBatchManifest } from '../manifest';

const CLI_PATH = join(dirname(fileURLToPath(import.meta.url)), 'cli.ts');
const HEAD_A = 'a'.repeat(40);

function runReport(dir: string, extra: readonly string[] = []): {
  status: number | null;
  out: string;
} {
  const r = spawnSync(
    process.execPath,
    ['--import', 'tsx', CLI_PATH, '--report', `--dir=${dir}`, ...extra],
    { encoding: 'utf8', timeout: 120_000 },
  );
  return { status: r.status, out: `${r.stdout ?? ''}\n${r.stderr ?? ''}` };
}

const HEADER =
  'seed,strategy,daemon,outcome,finalHop,portPurchases,finalBits,packetsFired,sectorsCleared,poolAtSectorEnd';

interface DirOpts {
  seeds?: readonly number[];
  strategy?: string;
  outcome?: (seed: number) => string;
  head?: string | null;
  dirty?: boolean;
  manifest?: boolean;
  argv?: readonly string[];
  windowCount?: number;
}

/** A healthy instrument dir: 40 rows on the instrument's strategyRow (half
 *  wins so reach/wall/seam all measure), a clean manifest at HEAD_A naming
 *  the instrument's own arm. Every opt breaks exactly one verdict check. */
function writeDir(root: string, inst: BoardInstrument, opts: DirOpts = {}): void {
  const dir = join(root, inst.id);
  mkdirSync(dir, { recursive: true });
  const seeds = opts.seeds ?? Array.from({ length: 40 }, (_, i) => i + 1);
  const strategy = opts.strategy ?? inst.strategyRow;
  const outcome = opts.outcome ?? ((s: number): string => (s % 2 === 0 ? 'complete' : 'defeat'));
  writeFileSync(
    join(dir, 'summary.csv'),
    [HEADER, ...seeds.map((s) => `${s},${strategy},mars,${outcome(s)},10,1,100,2,1,16`)].join('\n') +
      '\n',
  );
  if (opts.manifest === false) {
    // Re-writing a happy dir as unmanifested must REMOVE the earlier
    // manifest, not leave it lying (the exact silent-staleness the
    // verdict exists to catch).
    rmSync(join(dir, 'manifest.json'), { force: true });
    return;
  }
  writeBatchManifest(dir, {
    kind: 'run',
    argv: opts.argv ?? [...inst.args, `--out=${dir}`, '--jobs=8'],
    seedWindow: { firstSeed: seeds[0] ?? 1, count: opts.windowCount ?? seeds.length },
    provenance: {
      head: opts.head === undefined ? HEAD_A : opts.head,
      dirty: opts.dirty ?? (opts.head === null ? null : false),
    },
  });
}

function writeHappyTree(root: string): Map<string, BoardInstrument> {
  const byId = new Map(buildBoard().instruments.map((i) => [i.id, i]));
  for (const inst of byId.values()) writeDir(root, inst);
  return byId;
}

describe('86e4 — the fail-closed contract through the real CLI', () => {
  it('a healthy full-board tree: integrity PASS, exit 0, vs-current WARN (fabricated head ≠ this tree)', () => {
    const root = mkdtempSync(join(tmpdir(), 'board-verdict-'));
    try {
      writeHappyTree(root);
      const r = runReport(root);
      expect(r.out).toContain('integrity PASS');
      expect(r.out).toContain(`measurement HEAD: ${HEAD_A}`);
      // Decision B's WARN half: the measurement head differs from the
      // evaluating tree's — prominent, never a FAIL.
      expect(r.out).toContain('vs-current');
      expect(r.status, r.out).toBe(0);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  }, 120_000);

  it('every FAIL class FAILs and exits 1 — nine breakages, one report, none masking another', () => {
    const root = mkdtempSync(join(tmpdir(), 'board-verdict-'));
    try {
      const byId = writeHappyTree(root);
      // missing: no dir at all.
      rmSync(join(root, 'arb-regen'), { recursive: true, force: true });
      // unparseable: summary.csv without the required columns.
      writeFileSync(join(root, 'arb-deploy', 'summary.csv'), 'not,a,summary\n1,2,3\n');
      // arm-match: rows carry a different strategy name.
      writeDir(root, byId.get('arb-priest-regen')!, { strategy: 'someone-else' });
      // under-n: a 20-seed batch (window honest, still under the floor).
      writeDir(root, byId.get('arb-priest-deploy')!, {
        seeds: Array.from({ length: 20 }, (_, i) => i + 1),
      });
      // dup-seed: seed 3 twice.
      writeDir(root, byId.get('arb-gambler-regen')!, {
        seeds: [1, 2, 3, 3, ...Array.from({ length: 36 }, (_, i) => i + 4)],
      });
      // window: rows at seeds 2..41 while the manifest promises 1..40.
      writeDir(root, byId.get('arb-gambler-deploy')!, {
        seeds: Array.from({ length: 40 }, (_, i) => i + 2),
        windowCount: 40,
      });
      const gd = byId.get('arb-gambler-deploy')!;
      writeBatchManifest(join(root, gd.id), {
        kind: 'run',
        argv: [...gd.args],
        seedWindow: { firstSeed: 1, count: 40 },
        provenance: { head: HEAD_A, dirty: false },
      });
      // provenance/no-manifest.
      writeDir(root, byId.get('regen')!, { manifest: false });
      // provenance/dirty.
      writeDir(root, byId.get('deploy')!, { dirty: true });
      // arm: a manifest whose argv is a DIFFERENT arm (the doctrine batch
      // dropped into an arb dir).
      writeDir(root, byId.get('wall-king')!, { argv: ['--count=40', '--searcher'] });
      // head-split: one dir from another HEAD.
      writeDir(root, byId.get('walk-regen')!, { head: 'b'.repeat(40) });
      // n/a on a checked row: an all-defeat walk batch (reach/wall unknowable).
      writeDir(root, byId.get('arb-walk-regen')!, { outcome: () => 'defeat' });

      const r = runReport(root);
      expect(r.status, r.out).toBe(1);
      for (const needle of [
        'no summary.csv',
        'missing column',
        "matched 0 of",
        'under-n',
        'duplicate seeds',
        'but the manifest promises',
        'no manifest.json',
        'DIRTY tree',
        "not this instrument's arm",
        'different heads',
        'unmeasurable',
        'the board is VOID',
      ]) {
        expect(r.out, `expected the report to name: ${needle}`).toContain(needle);
      }
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  }, 120_000);

  it('decision A end to end: an unmanifested dir FAILs strict (exit 1), WARNs + exits 0 under --allow-unmanifested', () => {
    const root = mkdtempSync(join(tmpdir(), 'board-verdict-'));
    try {
      const byId = writeHappyTree(root);
      writeDir(root, byId.get('anchor-random')!, { manifest: false });
      const strict = runReport(root);
      expect(strict.status, strict.out).toBe(1);
      expect(strict.out).toContain('no manifest.json');
      const lenient = runReport(root, ['--allow-unmanifested']);
      expect(lenient.status, lenient.out).toBe(0);
      expect(lenient.out).toContain('--allow-unmanifested in effect: 1 instrument(s)');
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  }, 120_000);
});
