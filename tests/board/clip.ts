/**
 * 107d-post — the diagonal-move clip, measured (`npx tsx tests/board/clip.ts`).
 * How much of a glyph's ink terrain hides, moving or standing, under the
 * pre-7.5 camera and the shipped one, for the two depth rules (`card`, as drawn
 * before 107d-post; `upright`, as drawn since) and the lift that was the other
 * candidate (`arc`, `plateau`). The measure is `worstHidden` in geometry.ts;
 * `clip.test.ts` pins the shipped rule. Known answers: a flat patch hides
 * nothing; the §81c2 defect (a straight-line Y onto a higher tile) is caught,
 * and its profile clears it.
 */
import {
  PRE_75,
  VIEWPORTS,
  fitRig,
  gridToWorld,
  worstHidden,
  type Board,
  type ClipMove,
  type HeightField,
  type Rig,
  type View,
} from './geometry';

const SHIPPED: View = { projection: { kind: 'orthographic' }, pitchDeg: 45, yawDeg: 45 };
const BOARD: Board = { name: '15x15', w: 15, h: 15 };
const VP = VIEWPORTS[0]!; // 2560x1440, the user's
const GLYPH = 'B';
const LOW = -0.4; // water; the floor band is [-0.3, 0]
const HIGH = 0.0;
const C = 7; // the patch centre cell

const heightsWith =
  (high: [number, number][], low = LOW): HeightField =>
  (gx, gy) =>
    high.some(([x, y]) => x === gx && y === gy) ? HIGH : low;

/** The deeper and the nearer of two cells, along the camera's view. */
function farNear(rig: Rig, cells: [number, number][]): { far: [number, number]; near: [number, number] } {
  const d = (c: [number, number]) => gridToWorld(BOARD, ...c).dot(rig.fwd);
  const sorted = [...cells].sort((p, q) => d(q) - d(p));
  return { far: sorted[0]!, near: sorted[sorted.length - 1]! };
}

/** Every cell near the path, off it, whose centre is not in front of the path's midpoint. */
function notInFrontOf(rig: Rig, from: [number, number], to: [number, number]): [number, number][] {
  const mid = gridToWorld(BOARD, ...from).lerp(gridToWorld(BOARD, ...to), 0.5).dot(rig.fwd);
  const out: [number, number][] = [];
  for (let gy = C - 3; gy <= C + 3; gy++)
    for (let gx = C - 3; gx <= C + 3; gx++) {
      const onPath = (gx === from[0] && gy === from[1]) || (gx === to[0] && gy === to[1]);
      if (!onPath && gridToWorld(BOARD, gx, gy).dot(rig.fwd) - mid > -0.25) out.push([gx, gy]);
    }
  return out;
}

export function clipCases(rig: Rig): [string, ClipMove][] {
  const here: [number, number] = [C, C];
  const diag: [number, number] = [C + 1, C + 1];
  const corners: [number, number][] = [
    [C + 1, C],
    [C, C + 1],
  ];
  const { far, near } = farNear(rig, corners);
  const diag2: [number, number] = [C + 1, C - 1];
  const sides: [number, number][] = [
    [C + 1, C],
    [C, C - 1],
  ];
  const restAt = (c: [number, number]) => gridToWorld(BOARD, ...c).dot(rig.fwd) - gridToWorld(BOARD, ...here).dot(rig.fwd);
  const neighbours: [number, number][] = [];
  for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) if (dx || dy) neighbours.push([C + dx, C + dy]);
  return [
    ['K1 flat, diagonal', { from: here, to: diag, heights: () => LOW }],
    ['K2 step up, straight-line Y (the §81c2 defect)', { from: here, to: [C, C + 1], heights: heightsWith([[C, C + 1]]), linearY: true }],
    ['K2 step up, the §81c2 profile', { from: here, to: [C, C + 1], heights: heightsWith([[C, C + 1]]) }],
    ['S1 diagonal, far corner high (the bug)', { from: here, to: diag, heights: heightsWith([far]) }],
    ['S2 diagonal, near corner high (feet behind a step)', { from: here, to: diag, heights: heightsWith([near]) }],
    ['S3 diagonal, both corners high', { from: here, to: diag, heights: heightsWith(corners) }],
    ['S4 other diagonal, both side corners high', { from: here, to: diag2, heights: heightsWith(sides) }],
    ['S5 at rest, neighbours not in front high', { from: here, to: here, heights: heightsWith(neighbours.filter((c) => restAt(c) > -0.25)) }],
    ['S6 at rest, neighbours in front high', { from: here, to: here, heights: heightsWith(neighbours.filter((c) => restAt(c) <= -0.25)) }],
    ['S7 straight +x, cells not in front high', { from: here, to: [C + 1, C], heights: heightsWith(notInFrontOf(rig, here, [C + 1, C])) }],
    ['S8 straight +y, cells not in front high', { from: here, to: [C, C + 1], heights: heightsWith(notInFrontOf(rig, here, [C, C + 1])) }],
    ['S9 diagonal, cells not in front high', { from: here, to: diag, heights: heightsWith(notInFrontOf(rig, here, diag)) }],
    ['S10 other diagonal, cells not in front high', { from: here, to: diag2, heights: heightsWith(notInFrontOf(rig, here, diag2)) }],
    ['S1 at the floor band step (0.3)', { from: here, to: diag, heights: heightsWith([far], -0.3) }],
  ];
}

export const CLIP_BOARD = BOARD;
export const CLIP_GLYPH = GLYPH;
export const CLIP_VIEWPORT = VP;
export const CLIP_SHIPPED = SHIPPED;

function main(): void {
  const pct = (v: number) => `${(v * 100).toFixed(1).padStart(5)}%`;
  const cols = ['card', 'arc', 'plateau', 'upright'] as const;
  for (const [camName, view] of [
    ['pre-7.5 (persp 50, yaw 0)', PRE_75],
    ['shipped (ortho, yaw 45)', SHIPPED],
  ] as const) {
    const rig = fitRig(view, BOARD, VP);
    console.log(`\n=== ${camName} @ ${VP.name}, glyph ${GLYPH}: worst hidden ink over the move (at t=0.5) + lift px ===`);
    console.log(`${'case'.padEnd(50)} ${cols.map((c) => c.padStart(20)).join(' ')}`);
    for (const [name, m] of clipCases(rig)) {
      const cells = cols.map((c) => {
        const r =
          c === 'upright'
            ? worstHidden(rig, BOARD, GLYPH, m, 'upright')
            : worstHidden(rig, BOARD, GLYPH, m, 'card', c === 'card' ? 'none' : c);
        // A world lift L draws L·cos(pitch) up the screen; px per world unit from the fit.
        const p0 = gridToWorld(BOARD, C, C).project(rig.camera);
        const p1 = gridToWorld(BOARD, C, C).setY(r.lift).project(rig.camera);
        const px = Math.hypot((p1.x - p0.x) * VP.w, (p1.y - p0.y) * VP.h) / 2;
        const lift = c === 'arc' || c === 'plateau' ? ` ${px.toFixed(0).padStart(3)}px` : '      ';
        return `${pct(r.worst)} (${pct(r.atMid)})${lift}`.padStart(20);
      });
      console.log(`${name.padEnd(50)} ${cells.join(' ')}`);
    }
  }
}

if (process.argv[1]?.replace(/\\/g, '/').endsWith('tests/board/clip.ts')) main();
