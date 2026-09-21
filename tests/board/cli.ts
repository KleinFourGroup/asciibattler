/**
 * §105a — the board-geometry sweep. `npm run board-geometry` prints the
 * condensed tables and writes the full sweep to
 * `tests/board/output/sweep.csv` (gitignored output, regenerable).
 *
 *   npm run board-geometry                      # the condensed read
 *   npm run board-geometry -- --viewport=1280x720 --board=24x24
 *
 * Read `geometry.ts`'s header first: the model is FLAT, and the overlap is
 * over ink RECTS (an upper bound on ink-over-ink).
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  BOARDS,
  TODAY,
  VIEWPORTS,
  fitRig,
  gridToWorld,
  quadRectPx,
  report,
  worldYDriftPx,
  type AnchorMode,
  type CellReport,
  type View,
} from './geometry';

const here = dirname(fileURLToPath(import.meta.url));
const arg = (name: string): string | undefined => process.argv.find((a) => a.startsWith(`--${name}=`))?.split('=')[1];

const PROJECTIONS: { name: string; projection: View['projection'] }[] = [
  { name: 'persp50', projection: { kind: 'perspective', fovDeg: 50 } },
  { name: 'persp20', projection: { kind: 'perspective', fovDeg: 20 } },
  { name: 'ortho', projection: { kind: 'orthographic' } },
];
const PITCHES = [30, 35, 45, 55, 60];
const YAWS = [0, 45];
const SCALES = [0.7, 0.85, 1, 1.15, 1.3, 1.5, 1.75, 2];
const MODE: AnchorMode = 'today';

const f = (v: number, d = 1): string => v.toFixed(d);
const pct = (v: number): string => `${(v * 100).toFixed(0)}%`;

// ── the known answers, printed raw (the tests hold them to ±0.5 px) ─────────
{
  const b15 = BOARDS[0]!;
  const p720 = VIEWPORTS.find((v) => v.name === '1280x720')!;
  const rig = fitRig(TODAY, b15, p720);
  const skew = (gx: number, gy: number): string => f(worldYDriftPx(rig, gridToWorld(b15, gx, gy), 0.5), 2);
  const q = quadRectPx(rig, { glyph: 'M', pos: gridToWorld(b15, 7, 0) }, 1, MODE);
  console.log('KNOWN ANSWERS (79b, live camera, 15x15 @ 1280x720) — expected | this model (flat terrain)');
  console.log(`  world-Y 0.5 skew, near-row edge   ±9.1 | ${skew(14, 0)}`);
  console.log(`  world-Y 0.5 skew, mid-row edge    ±5.0 | ${skew(14, 7)}`);
  console.log(`  world-Y 0.5 skew, far-row edge    ±3.2 | ${skew(14, 14)}`);
  console.log(`  half-quad px, near row            26.3 | ${f((q.y1 - q.y0) / 2, 2)}`);
  console.log('');
}

// ── the full sweep → CSV ────────────────────────────────────────────────────
const header = [
  'projection', 'pitch', 'yaw', 'scale', 'board', 'viewport', 'dpr', 'fits',
  'glyphPxNear', 'glyphPxCentre', 'glyphPxFar', 'glyphDevPxFar', 'glyphPxFarVsToday',
  'tileWPx', 'tileHPx', 'leanNearCornerDeg', 'leanMaxDeg',
  'clumpCentreMean', 'clumpCentreMax', 'clumpCornerMean', 'clumpCornerMax', 'clumpFarMean', 'clumpFarMax',
  'ownTile', 'rowsSpanned', 'flyerCoversNeighbour', 'flyerShadowGapPx',
];
const rows: string[] = [header.join(',')];
const cells = new Map<string, CellReport>();
const key = (p: string, pitch: number, yaw: number, s: number, b: string, v: string): string => [p, pitch, yaw, s, b, v].join('|');

for (const board of BOARDS)
  for (const vp of VIEWPORTS) {
    const today = report(TODAY, board, vp, 1, MODE);
    for (const proj of PROJECTIONS)
      for (const pitch of PITCHES)
        for (const yaw of YAWS)
          for (const scale of SCALES) {
            const r = report({ projection: proj.projection, pitchDeg: pitch, yawDeg: yaw }, board, vp, scale, MODE);
            cells.set(key(proj.name, pitch, yaw, scale, board.name, vp.name), r);
            rows.push(
              [
                proj.name, pitch, yaw, scale, board.name, JSON.stringify(vp.name), vp.dpr, r.fits,
                f(r.glyphPxNear), f(r.glyphPxCentre), f(r.glyphPxFar), f(r.glyphPxFar * vp.dpr), f(r.glyphPxFar / today.glyphPxFar, 3),
                f(r.tileWPx), f(r.tileHPx), f(r.leanNearCornerDeg), f(r.leanMaxDeg),
                f(r.clumpCentreMean, 4), f(r.clumpCentreMax, 4), f(r.clumpCornerMean, 4), f(r.clumpCornerMax, 4), f(r.clumpFarMean, 4), f(r.clumpFarMax, 4),
                f(r.ownTile, 3), f(r.rowsSpanned, 2), f(r.flyerCoversNeighbour, 4), f(r.flyerShadowGapPx),
              ].join(','),
            );
          }
  }

const outDir = join(here, 'output');
mkdirSync(outDir, { recursive: true });
writeFileSync(join(outDir, 'sweep.csv'), rows.join('\n') + '\n');

// ── the condensed read ──────────────────────────────────────────────────────
const vpName = arg('viewport') ?? '2560x1440 (the user)';
const vp = VIEWPORTS.find((v) => v.name.startsWith(vpName));
if (!vp) throw new Error(`no viewport starts with ${JSON.stringify(vpName)}`);
const boards = arg('board') ? BOARDS.filter((b) => b.name === arg('board')) : BOARDS;

for (const board of boards) {
  console.log(`=== ${board.name} @ ${vp.name} — glyph scale 1 (today's), anchor '${MODE}' ===`);
  console.log('projection pitch yaw | glyph px near/ctr/far | tile WxH px | lean° corner | clump ctr mean/max | clump FAR mean/max | own-tile | rows | flyer→nbr | shadow gap');
  for (const proj of PROJECTIONS)
    for (const yaw of YAWS)
      for (const pitch of PITCHES) {
        const r = cells.get(key(proj.name, pitch, yaw, 1, board.name, vp.name))!;
        const isToday = proj.name === 'persp50' && pitch === 45 && yaw === 0;
        console.log(
          `${proj.name.padEnd(8)} ${String(pitch).padStart(3)} ${String(yaw).padStart(3)} ${isToday ? '◀' : ' '}| ` +
            `${f(r.glyphPxNear).padStart(5)}/${f(r.glyphPxCentre).padStart(5)}/${f(r.glyphPxFar).padStart(5)} | ` +
            `${f(r.tileWPx).padStart(5)}x${f(r.tileHPx).padStart(5)} | ${f(r.leanNearCornerDeg).padStart(5)} | ` +
            `${pct(r.clumpCentreMean).padStart(4)}/${pct(r.clumpCentreMax).padStart(4)} | ${pct(r.clumpFarMean).padStart(4)}/${pct(r.clumpFarMax).padStart(4)} | ` +
            `${pct(r.ownTile).padStart(4)} | ${f(r.rowsSpanned, 2).padStart(4)} | ${pct(r.flyerCoversNeighbour).padStart(4)} | ${f(r.flyerShadowGapPx).padStart(6)}`,
        );
      }
  console.log('');
}

// ── the overlap FRONTIER: the largest swept scale whose clump is ≤ today's ──
const worst = (r: CellReport): number => Math.max(r.clumpCentreMean, r.clumpCornerMean, r.clumpFarMean);
console.log(`=== the overlap frontier @ ${vp.name}: largest swept glyph scale whose WORST clump mean (centre / near corner / far row) ≤ today's worst (and the far-row glyph px there vs today's) ===`);
for (const board of boards) {
  const today = cells.get(key('persp50', 45, 0, 1, board.name, vp.name))!;
  console.log(`${board.name}: today's worst clump mean ${pct(worst(today))}, far-row glyph ${f(today.glyphPxFar)} px`);
  for (const proj of PROJECTIONS)
    for (const yaw of YAWS) {
      const parts: string[] = [];
      for (const pitch of PITCHES) {
        let best: number | null = null;
        for (const s of SCALES) {
          const r = cells.get(key(proj.name, pitch, yaw, s, board.name, vp.name))!;
          if (worst(r) <= worst(today) + 1e-9) best = s;
        }
        const at = best === null ? null : cells.get(key(proj.name, pitch, yaw, best, board.name, vp.name))!;
        parts.push(`${pitch}°: ${best === null ? 'NONE' : `${best} (${f(at!.glyphPxFar / today.glyphPxFar, 2)}×)`}`);
      }
      console.log(`  ${proj.name.padEnd(8)} yaw ${String(yaw).padStart(2)} | ${parts.join(' · ')}`);
    }
}
console.log(`\n${rows.length - 1} sweep rows → tests/board/output/sweep.csv`);
