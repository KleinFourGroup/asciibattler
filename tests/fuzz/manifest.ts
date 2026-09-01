/**
 * 86e1 — the per-batch machine manifest (`manifest.json` in every batch
 * out dir). The provenance record the 86-kickoff audit found missing: no
 * output dir said what HEAD or what argv produced it — the box batch-dir
 * name was the only HEAD carrier, local batches carried nothing, and the
 * n=120 SAME-HEAD protocol was enforced by discipline alone. The manifest
 * makes it machine-checkable: the fail-closed verdict board (86e2) FAILs
 * on missing/cross-dir-mismatched provenance, and --merge-stages upgrades
 * its same-arm proxy (the box `args` file) to a real head + arm check.
 *
 * Discipline (the 86a timings.csv precedent): the manifest is a SIDECAR.
 * It carries a wall-clock timestamp and a machine-local HEAD, so it must
 * never ride summary.csv or any byte-identity surface — the 86b perf
 * oracle and the --jobs/--merge-stages parity pins all compare specific
 * artifact files, never whole dirs.
 *
 * `head` is a MACHINE field (a bare commit sha), never free text — the
 * §85g prior-table lesson: a free-text `head` line misled across two
 * rebuilds. `head: null` means git was unavailable at write time; that is
 * recorded honestly here and judged (as a FAIL) by the verdict board, not
 * papered over at capture time.
 */

import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

export const MANIFEST_FILE = 'manifest.json';
export const MANIFEST_VERSION = 1;

/** The repo root (manifest.ts lives at tests/fuzz/) — git runs here, not in
 *  whatever cwd the batch was launched from. */
const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');

/** Flags that only PARTITION a batch across processes/stages — stripped
 *  before any same-arm comparison. The ONE list (86e1): the --jobs parent's
 *  pass-through strip and the --merge-stages same-arm check import it. */
export const PARTITION_FLAG_PREFIXES = [
  '--count',
  '--seed-offset',
  '--out',
  '--jobs',
  '--emit-results',
] as const;

export function stripPartitionFlags(tokens: readonly string[]): string[] {
  return tokens.filter(
    (t) => !PARTITION_FLAG_PREFIXES.some((f) => t === f || t.startsWith(f + '=')),
  );
}

export interface SeedWindow {
  readonly firstSeed: number;
  readonly count: number;
}

export interface GitProvenance {
  /** Commit sha of the tree that ran the batch; null = git unavailable. */
  readonly head: string | null;
  /** Working tree dirty at batch time; null iff head is null. */
  readonly dirty: boolean | null;
}

export interface BatchManifest extends GitProvenance {
  readonly manifestVersion: number;
  readonly kind: 'run' | 'jobs-parent' | 'merge-stages';
  /** The full CLI argv that produced the batch (raw, unstripped). For a
   *  merge-stages manifest this is the MERGE invocation — the certified
   *  arm lives in `armArgv`. */
  readonly argv: readonly string[];
  /** 88d — merge-stages only: the stages' common argv (arm-authoritative;
   *  a stage's raw argv, partition flags and all — consumers compare via
   *  `armSignatureOf`). Absent when any stage ran unmanifested, so a
   *  merged dir without it cannot certify an arm (the verdict fails it
   *  closed). Never written by run/jobs-parent manifests. */
  readonly armArgv?: readonly string[];
  readonly seedWindow: SeedWindow;
  /** Wall clock, informational only — never compared. */
  readonly writtenAt: string;
}

export function captureGitProvenance(cwd: string = REPO_ROOT): GitProvenance {
  const head = spawnSync('git', ['rev-parse', 'HEAD'], { cwd, encoding: 'utf8' });
  if (head.error || head.status !== 0) return { head: null, dirty: null };
  const sha = head.stdout.trim();
  if (!/^[0-9a-f]{40}$/.test(sha)) return { head: null, dirty: null };
  const status = spawnSync('git', ['status', '--porcelain'], { cwd, encoding: 'utf8' });
  // A sha without a readable status is a half-answer — record it as
  // unknown provenance rather than guessing at cleanliness.
  if (status.error || status.status !== 0) return { head: null, dirty: null };
  return { head: sha, dirty: status.stdout.trim().length > 0 };
}

export interface ManifestInputs {
  readonly kind: BatchManifest['kind'];
  readonly argv: readonly string[];
  /** merge-stages only — see BatchManifest.armArgv. */
  readonly armArgv?: readonly string[];
  readonly seedWindow: SeedWindow;
  /** Override for DERIVED provenance (--merge-stages records the STAGES'
   *  head, never the merging machine's). Default: captured from git here. */
  readonly provenance?: GitProvenance;
}

export function writeBatchManifest(outDir: string, inputs: ManifestInputs): BatchManifest {
  const provenance = inputs.provenance ?? captureGitProvenance();
  const manifest: BatchManifest = {
    manifestVersion: MANIFEST_VERSION,
    kind: inputs.kind,
    head: provenance.head,
    dirty: provenance.dirty,
    argv: inputs.argv,
    ...(inputs.armArgv !== undefined ? { armArgv: inputs.armArgv } : {}),
    seedWindow: inputs.seedWindow,
    writtenAt: new Date().toISOString(),
  };
  writeFileSync(join(outDir, MANIFEST_FILE), JSON.stringify(manifest, null, 2) + '\n');
  return manifest;
}

/** Read a dir's manifest: null when absent (pre-86e1 dirs, synthetic
 *  fixtures); THROWS on an unparseable or shape-broken file — a corrupt
 *  provenance record must never quietly read as "no provenance". */
export function readBatchManifest(dir: string): BatchManifest | null {
  const path = join(dir, MANIFEST_FILE);
  if (!existsSync(path)) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(readFileSync(path, 'utf8'));
  } catch (e) {
    throw new Error(`${path}: unparseable manifest (${String(e)})`);
  }
  const m = parsed as Partial<BatchManifest>;
  const shapeOk =
    typeof m === 'object' &&
    m !== null &&
    typeof m.manifestVersion === 'number' &&
    (m.kind === 'run' || m.kind === 'jobs-parent' || m.kind === 'merge-stages') &&
    (m.head === null || typeof m.head === 'string') &&
    (m.dirty === null || typeof m.dirty === 'boolean') &&
    Array.isArray(m.argv) &&
    m.argv.every((t) => typeof t === 'string') &&
    (m.armArgv === undefined ||
      (Array.isArray(m.armArgv) && m.armArgv.every((t) => typeof t === 'string'))) &&
    typeof m.seedWindow === 'object' &&
    m.seedWindow !== null &&
    typeof m.seedWindow.firstSeed === 'number' &&
    typeof m.seedWindow.count === 'number';
  if (!shapeOk) {
    throw new Error(`${path}: manifest is shape-broken — not a ${MANIFEST_FILE} this build wrote`);
  }
  return m as BatchManifest;
}

/** A batch's arm signature: its argv minus the partition flags, order-blind.
 *  Two dirs with equal signatures ran the same arm (the --merge-stages
 *  same-arm rule; 86e2's board-args match uses the same normal form). */
export function armSignatureOf(argv: readonly string[]): string {
  return stripPartitionFlags(argv).slice().sort().join(' ');
}
