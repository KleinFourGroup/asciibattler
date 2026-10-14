/**
 * THE PROOFS, RUN AGAINST A PLANT: a tree to plant in, and each behaviour
 * proof's verdict on the tree as it then stands.
 *
 * A plant goes in a worktree of its own, never the live tree: an edit to a
 * source file reloads every page a dev server has open, and a proof that is
 * running reads the tree it runs in. The worktree is made under
 * `output/plant/`, inside the repo, so it resolves packages from the repo's
 * own `node_modules` (buildHash.ts does the same).
 *
 * A verdict is CAUGHT when the proof failed with the plant in place:
 *   corpus     any stored journal no longer matches, or the replay threw
 *   suite      a test file of `npm test` fails for more than a timeout
 *   smoke      the same, of `npm run fuzz:smoke`
 *   fuzz-diff  either shape of scripts/perf-oracle.sh writes other CSVs than
 *              this tree's own clean run did
 * and also when the proof did not return inside its limit, which is how an
 * edit that makes a loop endless shows. A test that only timed out is not a
 * catch: beside other work a slow test passes its limit with nothing wrong.
 *
 * EACH PROOF IS RUN ON THE CLEAN TREE FIRST (`recordClean`). The corpus must
 * pass there. A test file that fails with nothing planted is set aside and
 * named: `tests/licences.test.ts` reads `node_modules` beside it, which a
 * worktree does not have. The fuzz diff's clean run is what a plant's run is
 * held against.
 *
 * ONE TEST RUN AT A TIME. The suite and the smoke each start a worker for
 * every hardware thread. On the 32-thread, 32 GB machine this was written
 * on, one suite run peaked at 7.4 GB across 34 node processes and one smoke
 * at 8.2 GB across 38; a corpus check peaked at 0.5 GB (2026-10-12). A
 * driver that plants in several worktrees can run the corpus in all of them
 * at once and should run the other two in one.
 */

import { execFileSync, spawn, spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { JOBS_PARITY, fuzzDiffShapes } from './reach';

export const PLANT_PROOFS = ['corpus', 'suite', 'smoke', 'fuzz-diff'] as const;
export type PlantProof = (typeof PLANT_PROOFS)[number];

export interface Verdict {
  readonly caught: boolean;
  readonly detail: string;
  /** What failed: journals for the corpus, test files for the suite and the smoke, shapes for the fuzz diff. */
  readonly failed: readonly string[];
  readonly seconds: number;
}

/** Seconds a proof may take before it is stopped and counted as not returning. */
const LIMIT: Record<PlantProof, number> = { corpus: 240, suite: 900, smoke: 2400, 'fuzz-diff': 900 };
const WORK = 'output/plant';
const FUZZ_FILES = ['summary.csv', 'decisions.csv', 'per-encounter.csv', 'alpha-strike.csv', 'rosters.csv'];

interface Ran {
  readonly code: number | null;
  readonly out: string;
  readonly timedOut: boolean;
  readonly seconds: number;
}

/** Run node with `args` in `cwd`. Past `limit` seconds the whole process tree is stopped. */
function launch(args: readonly string[], cwd: string, limit: number): Promise<Ran> {
  return new Promise((done) => {
    const started = Date.now();
    const child = spawn(process.execPath, args, { cwd, stdio: ['ignore', 'pipe', 'pipe'] });
    let out = '';
    let timedOut = false;
    const keep = (chunk: Buffer): void => {
      if (out.length < 1 << 24) out += chunk.toString('utf8');
    };
    child.stdout.on('data', keep);
    child.stderr.on('data', keep);
    const timer = setTimeout(() => {
      timedOut = true;
      // A test runner's workers outlive it unless the tree is taken down.
      if (process.platform === 'win32') spawnSync('taskkill', ['/pid', String(child.pid), '/T', '/F']);
      else child.kill('SIGKILL');
    }, limit * 1000);
    child.on('close', (code) => {
      clearTimeout(timer);
      done({ code, out, timedOut, seconds: Math.round((Date.now() - started) / 1000) });
    });
  });
}

const notReturned = (proof: PlantProof, ran: Ran): Verdict => ({
  caught: true,
  detail: `did not return in ${LIMIT[proof]} s and was stopped`,
  failed: [],
  seconds: ran.seconds,
});

async function corpus(tree: string): Promise<Verdict> {
  const ran = await launch(['--import', 'tsx', 'tests/fuzz/corpus/cli.ts'], tree, LIMIT.corpus);
  if (ran.timedOut) return notReturned('corpus', ran);
  const lines = ran.out.split(/\r?\n/);
  const failed = lines.filter((l) => /^(DIFF|DIVERGED) /.test(l)).map((l) => l.split(/\s+/)[1]!.replace(/:$/, ''));
  const end = /^(\d+) of (\d+) journals differ/m.exec(ran.out);
  if (end === null) {
    const last = lines.filter((l) => l.trim() !== '' && !/^\s+at /.test(l)).at(-1) ?? '';
    return { caught: true, detail: `the replay threw: ${last.trim().slice(0, 160)}`, failed, seconds: ran.seconds };
  }
  return { caught: failed.length > 0, detail: `${failed.length} of ${end[2]} journals differ`, failed, seconds: ran.seconds };
}

interface JsonReport {
  readonly testResults: readonly { name: string; status: string; assertionResults: readonly { status: string; failureMessages: readonly string[] }[] }[];
}

/** Per proof and tree, the test files that fail with nothing planted. */
const cleanTests = new Map<string, readonly string[]>();

async function tests(proof: 'suite' | 'smoke', tree: string, repo: string, clean = cleanTests.get(`${proof} ${tree}`)): Promise<Verdict> {
  if (clean === undefined) throw new Error(`plant: the ${proof} has no clean run for this tree (recordClean)`);
  const dir = mkdtempSync(join(tmpdir(), 'plant-'));
  const report = join(dir, 'report.json');
  try {
    const ran = await launch(
      [
        join(repo, 'node_modules/vitest/vitest.mjs'),
        'run',
        // The smoke's config carries its own limit. The suite's default five
        // seconds is raised, so that load beside the run is not read as a catch.
        ...(proof === 'smoke' ? ['--config', 'vitest.fuzz.config.ts', '--exclude', JOBS_PARITY] : ['--testTimeout=60000']),
        '--reporter=json',
        `--outputFile=${report}`,
      ],
      tree,
      LIMIT[proof],
    );
    if (ran.timedOut) return notReturned(proof, ran);
    if (!existsSync(report)) return { caught: true, detail: `the run wrote no report (exit ${ran.code})`, failed: [], seconds: ran.seconds };
    const json = JSON.parse(readFileSync(report, 'utf8')) as JsonReport;
    const root = `${tree.split('\\').join('/')}/`.toLowerCase();
    const relative = (name: string): string => {
      const path = name.split('\\').join('/');
      return path.toLowerCase().startsWith(root) ? path.slice(root.length) : path;
    };
    const failed: string[] = [];
    const slow: string[] = [];
    for (const file of json.testResults) {
      if (file.status === 'passed') continue;
      const failures = file.assertionResults.filter((t) => t.status === 'failed');
      const onlyTimedOut = failures.length > 0 && failures.every((t) => t.failureMessages.join(' ').includes('timed out'));
      const name = relative(file.name);
      if (!clean.includes(name)) (onlyTimedOut ? slow : failed).push(name);
    }
    failed.sort();
    const also = slow.length > 0 ? `; ${slow.length} more only timed out` : '';
    return {
      caught: failed.length > 0,
      detail: failed.length === 0 ? `no file of ${json.testResults.length} fails${also}` : `${failed.length} of ${json.testResults.length} files fail${also}`,
      failed,
      seconds: ran.seconds,
    };
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

/** Each fuzz-diff shape's CSVs, hashed: `scored:ab12…,…` per shape. */
async function fuzzHashes(tree: string): Promise<{ hashes: string[]; seconds: number; timedOut: boolean }> {
  const shapes = fuzzDiffShapes(readFileSync(join(tree, 'scripts/perf-oracle.sh'), 'utf8'));
  const dir = mkdtempSync(join(tmpdir(), 'plant-fuzz-'));
  const sha = (path: string): string => (existsSync(path) ? createHash('sha256').update(readFileSync(path)).digest('hex').slice(0, 12) : 'absent');
  const hashes: string[] = [];
  let seconds = 0;
  let timedOut = false;
  try {
    for (const shape of shapes) {
      const out = join(dir, shape.name);
      const ran = await launch(['--import', 'tsx', 'tests/fuzz/cli.ts', ...shape.flags, `--out=${out}`], tree, LIMIT['fuzz-diff']);
      seconds += ran.seconds;
      timedOut ||= ran.timedOut;
      hashes.push(`${shape.name}:${ran.code === 0 ? FUZZ_FILES.map((f) => sha(join(out, f))).join(',') : `exit ${ran.code}`}`);
    }
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
  return { hashes, seconds, timedOut };
}

const cleanFuzz = new Map<string, string[]>();

/**
 * Each of `proofs` run in `tree` with nothing planted, before the first plant
 * there; `runProof` refuses a suite, a smoke or a fuzz diff without it.
 * Returns one line per proof for the report. The fuzz diff is taken twice, so
 * that a difference under a plant is the plant's.
 */
export async function recordClean(tree: string, proofs: readonly PlantProof[], repo = '.'): Promise<string[]> {
  const [at, home] = [resolve(tree), resolve(repo)];
  const lines: string[] = [];
  for (const proof of proofs) {
    if (proof === 'corpus') {
      const verdict = await corpus(at);
      if (verdict.caught) throw new Error(`plant: the corpus fails on the clean tree: ${verdict.detail}`);
      lines.push(`corpus: ${verdict.detail}`);
    } else if (proof === 'fuzz-diff') {
      const first = await fuzzHashes(at);
      const second = await fuzzHashes(at);
      if (first.hashes.join(' ') !== second.hashes.join(' ') || first.hashes.some((h) => h.includes('exit'))) {
        throw new Error(`plant: the fuzz diff does not agree with itself on the clean tree:\n${first.hashes.join(' ')}\n${second.hashes.join(' ')}`);
      }
      cleanFuzz.set(at, first.hashes);
      lines.push(`fuzz-diff: ${first.hashes.length} shapes, the same twice`);
    } else {
      const verdict = await tests(proof, at, home, []);
      if (/^(did not return|the run wrote no report)/.test(verdict.detail)) throw new Error(`plant: the ${proof} on the clean tree ${verdict.detail}`);
      cleanTests.set(`${proof} ${at}`, verdict.failed);
      lines.push(`${proof}: ${verdict.detail}${verdict.failed.length > 0 ? `, set aside: ${verdict.failed.join(', ')}` : ''}`);
    }
  }
  return lines;
}

async function fuzzDiff(tree: string): Promise<Verdict> {
  const clean = cleanFuzz.get(resolve(tree));
  if (clean === undefined) throw new Error('plant: the fuzz diff has no clean run for this tree (recordClean)');
  const now = await fuzzHashes(tree);
  if (now.timedOut) return notReturned('fuzz-diff', { code: null, out: '', timedOut: true, seconds: now.seconds });
  const failed = now.hashes.filter((h, i) => h !== clean[i]).map((h) => h.split(':')[0]!);
  return {
    caught: failed.length > 0,
    detail: failed.length === 0 ? `all ${clean.length} shapes identical` : `differs on ${failed.join(' and ')}${now.hashes.some((h) => h.includes('exit')) ? ' (a run failed)' : ''}`,
    failed,
    seconds: now.seconds,
  };
}

/** One proof's verdict on the tree as it stands. `repo` is where `node_modules` is. */
export function runProof(proof: PlantProof, tree: string, repo = '.'): Promise<Verdict> {
  const [at, home] = [resolve(tree), resolve(repo)];
  if (proof === 'corpus') return corpus(at);
  if (proof === 'fuzz-diff') return fuzzDiff(at);
  return tests(proof, at, home);
}

/**
 * Run `proofs` in `tree` with `file` holding `edited`, and put the file back
 * from the text it held, whatever happens.
 */
export async function withPlant(tree: string, file: string, edited: string, proofs: readonly PlantProof[], repo = '.'): Promise<Partial<Record<PlantProof, Verdict>>> {
  const path = join(tree, file);
  const original = readFileSync(path, 'utf8');
  if (edited === original) throw new Error(`plant: the edit to ${file} changes nothing`);
  const verdicts: Partial<Record<PlantProof, Verdict>> = {};
  try {
    writeFileSync(path, edited);
    for (const proof of proofs) verdicts[proof] = await runProof(proof, tree, repo);
  } finally {
    writeFileSync(path, original);
  }
  return verdicts;
}

/** `git status --porcelain` of a tree: equal before and after means every plant was put back. */
export const treeStatus = (tree: string): string => execFileSync('git', ['status', '--porcelain'], { cwd: tree, encoding: 'utf8' });

/** A detached worktree of `ref` at `output/plant/<name>`, replacing any left there. */
export function makeTree(name: string, ref = 'HEAD', repo = '.'): string {
  const here = resolve(repo);
  const tree = join(here, WORK, name);
  dropTree(name, repo);
  mkdirSync(join(here, WORK), { recursive: true });
  execFileSync('git', ['worktree', 'add', '--detach', tree, ref], { cwd: here, stdio: 'pipe' });
  return tree;
}

export function dropTree(name: string, repo = '.'): void {
  const here = resolve(repo);
  const tree = join(here, WORK, name);
  if (existsSync(tree)) spawnSync('git', ['worktree', 'remove', '--force', tree], { cwd: here });
  execFileSync('git', ['worktree', 'prune'], { cwd: here });
}
