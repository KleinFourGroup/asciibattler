// 107d-post step zero (`npx tsx tests/board/clip.ts`) — the diagonal-move clip, measured. How much of a moving
// (or standing) glyph's ink is hidden by terrain, under the pre-7.5 camera and
// the shipped one, for three depth treatments:
//   current  — the billboard as drawn today: a camera-facing card at its
//              anchor's depth (billboard.vert.glsl offsets in view space);
//   hop      — the current card with the anchor lifted over the high corner
//              (arc: 4t(1-t) peak at the corner's height; plateau: the whole
//              move at the corner's height);
//   upright  — same screen position, but each ink point's DEPTH is that of the
//              world-vertical plane through the anchor (a standing body).
// Occlusion: a ray from the ink point toward the camera hits a tile prism
// (top = the cell's height, bottom = TERRAIN_BOTTOM_Y) in a 7x7 patch. The
// geometry is re-derived here and in tests/board/geometry.ts; nothing is read
// from src/render. Known answers: a flat patch hides nothing; the §81c2
// defect (a linear-Y step up) is caught, and its fix clears it.

import * as THREE from 'three';
import {
  PRE_75,
  TERRAIN_BOTTOM_Y,
  VIEWPORTS,
  anchorYFor,
  fitRig,
  gridToWorld,
  inkOf,
  type Board,
  type Rig,
  type View,
} from './geometry';

const SHIPPED: View = { projection: { kind: 'orthographic' }, pitchDeg: 45, yawDeg: 45 };
const BOARD: Board = { name: '15x15', w: 15, h: 15 };
const VP = VIEWPORTS[0]!; // 2560x1440, the user's
const GLYPH = 'B';
const SAMPLES = 24;
const LOW = -0.4; // water / the floor band's bottom is -0.3
const HIGH = 0.0; // the floor band's top
const C = 7; // the patch centre cell

type Heights = (gx: number, gy: number) => number;
type Variant = 'current' | 'arc' | 'plateau' | 'upright';

const ray = new THREE.Ray();
const box = new THREE.Box3();

function occludedAt(rig: Rig, heights: Heights, anchor: THREE.Vector3, upright: boolean): number {
  const [ix0, iy0, ix1, iy1] = inkOf(GLYPH);
  const anchorY = anchorYFor(GLYPH, 'today');
  const ortho = (rig.camera as THREE.OrthographicCamera).isOrthographicCamera === true;
  const camPos = new THREE.Vector3().setFromMatrixPosition(rig.camera.matrixWorld);
  const worldUp = new THREE.Vector3(0, 1, 0);
  // The upright plane: vertical, through the anchor, containing camera-right.
  const n = new THREE.Vector3().crossVectors(rig.right, worldUp).normalize();
  const plane = new THREE.Plane().setFromNormalAndCoplanarPoint(n, anchor);
  let hits = 0;
  const q = new THREE.Vector3();
  const p = new THREE.Vector3();
  for (let i = 0; i < SAMPLES; i++)
    for (let j = 0; j < SAMPLES; j++) {
      const cx = ix0 + ((i + 0.5) / SAMPLES) * (ix1 - ix0);
      const cy = iy0 + ((j + 0.5) / SAMPLES) * (iy1 - iy0);
      q.copy(anchor).addScaledVector(rig.right, cx - 0.5).addScaledVector(rig.up, cy - 0.5 - anchorY);
      p.copy(q);
      if (upright) {
        // The same pixel's ray, met at the upright plane.
        const dir = ortho ? rig.fwd.clone() : q.clone().sub(camPos).normalize();
        const origin = ortho ? q.clone().addScaledVector(rig.fwd, -100) : camPos.clone();
        const hit = new THREE.Ray(origin, dir).intersectPlane(plane, new THREE.Vector3());
        if (hit) p.copy(hit);
      }
      const toward = ortho ? rig.fwd.clone().negate() : camPos.clone().sub(p).normalize();
      ray.origin.copy(p).addScaledVector(toward, 1e-6);
      ray.direction.copy(toward);
      let hidden = false;
      for (let gy = C - 3; gy <= C + 3 && !hidden; gy++)
        for (let gx = C - 3; gx <= C + 3 && !hidden; gx++) {
          const c = gridToWorld(BOARD, gx, gy);
          box.min.set(c.x - 0.5, TERRAIN_BOTTOM_Y, c.z - 0.5);
          box.max.set(c.x + 0.5, heights(gx, gy), c.z + 0.5);
          if (ray.intersectsBox(box)) hidden = true;
        }
      if (hidden) hits++;
    }
  return hits / (SAMPLES * SAMPLES);
}

/** §81c2's Y profile (SpriteAnimator.ts): a climb completes by t = 0.5, a descent starts there. */
function groundY(fromY: number, toY: number, t: number, linear = false): number {
  if (linear || fromY === toY) return fromY + (toY - fromY) * t;
  const yT = toY > fromY ? Math.min(1, 2 * t) : Math.max(0, 2 * t - 1);
  return fromY + (toY - fromY) * yT;
}

interface Move {
  from: [number, number];
  to: [number, number];
  heights: Heights;
  linearY?: boolean;
}

function worstOver(rig: Rig, m: Move, variant: Variant): { worst: number; atMid: number; liftPx: number } {
  const a = gridToWorld(BOARD, ...m.from);
  const b = gridToWorld(BOARD, ...m.to);
  const hA = m.heights(...m.from);
  const hB = m.heights(...m.to);
  // The cells the path touches: from, to, and (diagonal) the two corner cells.
  const cells: [number, number][] = [m.from, m.to];
  if (m.from[0] !== m.to[0] && m.from[1] !== m.to[1]) cells.push([m.to[0], m.from[1]], [m.from[0], m.to[1]]);
  const peak = Math.max(...cells.map(([x, y]) => m.heights(x, y)));
  let worst = 0;
  let atMid = 0;
  let lift = 0;
  const ts = m.from[0] === m.to[0] && m.from[1] === m.to[1] ? [0] : Array.from({ length: 19 }, (_, k) => (k + 1) / 20);
  for (const t of ts) {
    const pos = a.clone().lerp(b, t);
    const base = groundY(hA, hB, t, m.linearY);
    let y = base;
    if (variant === 'arc') y = base + Math.max(0, peak - Math.max(hA, hB)) * 4 * t * (1 - t);
    if (variant === 'plateau') y = Math.max(base, peak);
    lift = Math.max(lift, y - base);
    pos.y = y;
    const f = occludedAt(rig, m.heights, pos, variant === 'upright');
    worst = Math.max(worst, f);
    if (Math.abs(t - 0.5) < 1e-9 || ts.length === 1) atMid = f;
  }
  // World lift → screen px: under either camera a world-up metre is ~cos(pitch) of a screen metre at the centre.
  const p0 = gridToWorld(BOARD, C, C);
  const p1 = p0.clone().setY(lift);
  const px = (v: THREE.Vector3) => {
    const s = v.clone().project(rig.camera);
    return { x: ((s.x + 1) / 2) * VP.w, y: ((1 - s.y) / 2) * VP.h };
  };
  const liftPx = Math.hypot(px(p1).x - px(p0).x, px(p1).y - px(p0).y);
  return { worst, atMid, liftPx };
}

/** Grid offsets: which way is "far" (away from the camera) depends on the yaw. */
function farNear(rig: Rig, cells: [number, number][]): { far: [number, number]; near: [number, number] } {
  const d = (c: [number, number]) => gridToWorld(BOARD, ...c).dot(rig.fwd);
  const sorted = [...cells].sort((p, q) => d(q) - d(p));
  return { far: sorted[0]!, near: sorted[sorted.length - 1]! };
}

const heightsWith = (high: [number, number][], low = LOW): Heights => (gx, gy) =>
  high.some(([x, y]) => x === gx && y === gy) ? HIGH : low;

const VARIANTS: Variant[] = ['current', 'arc', 'plateau', 'upright'];
const pct = (v: number) => `${(v * 100).toFixed(1).padStart(5)}%`;

for (const [camName, view] of [
  ['pre-7.5 (persp 50, yaw 0)', PRE_75],
  ['shipped (ortho, yaw 45)', SHIPPED],
] as const) {
  const rig = fitRig(view, BOARD, VP);
  // The screen-horizontal diagonal: its two corner cells are far / near. At yaw 0
  // no diagonal is screen-horizontal; (+1,+1) is taken for both, and farNear
  // orders its corners by depth either way.
  const diagFrom: [number, number] = [C, C];
  const diagTo: [number, number] = [C + 1, C + 1];
  const corners: [number, number][] = [
    [C + 1, C],
    [C, C + 1],
  ];
  const { far, near } = farNear(rig, corners);
  // The other diagonal (+1,-1): at yaw 45 its corner cells are left / right of the corner point.
  const diag2To: [number, number] = [C + 1, C - 1];
  const sideCorners: [number, number][] = [
    [C + 1, C],
    [C, C - 1],
  ];
  const neighbours: [number, number][] = [];
  for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) if (dx || dy) neighbours.push([C + dx, C + dy]);
  const restDepth = (c: [number, number]) => gridToWorld(BOARD, ...c).dot(rig.fwd) - gridToWorld(BOARD, C, C).dot(rig.fwd);
  const behindOrBeside = neighbours.filter((c) => restDepth(c) > -0.25);
  const inFront = neighbours.filter((c) => restDepth(c) <= -0.25);
  /** Every cell of the 7x7 patch off the path whose centre is not in front of the path's midpoint. */
  const notInFrontOf = (from: [number, number], to: [number, number]): [number, number][] => {
    const mid = gridToWorld(BOARD, ...from).lerp(gridToWorld(BOARD, ...to), 0.5).dot(rig.fwd);
    const out: [number, number][] = [];
    for (let gy = C - 3; gy <= C + 3; gy++)
      for (let gx = C - 3; gx <= C + 3; gx++) {
        const onPath = (gx === from[0] && gy === from[1]) || (gx === to[0] && gy === to[1]);
        if (!onPath && gridToWorld(BOARD, gx, gy).dot(rig.fwd) - mid > -0.25) out.push([gx, gy]);
      }
    return out;
  };

  const cases: [string, Move][] = [
    ['K1 flat, diagonal', { from: diagFrom, to: diagTo, heights: () => LOW }],
    ['K2 step up, LINEAR Y (the §81c2 defect)', { from: [C, C], to: [C, C + 1], heights: heightsWith([[C, C + 1]]), linearY: true }],
    ['K2 step up, §81c2 profile', { from: [C, C], to: [C, C + 1], heights: heightsWith([[C, C + 1]]) }],
    ['S1 diagonal, FAR corner high (the bug)', { from: diagFrom, to: diagTo, heights: heightsWith([far]) }],
    ['S2 diagonal, NEAR corner high (right to hide feet)', { from: diagFrom, to: diagTo, heights: heightsWith([near]) }],
    ['S3 diagonal, BOTH corners high (squeeze)', { from: diagFrom, to: diagTo, heights: heightsWith(corners) }],
    ['S4 other diagonal, both side corners high', { from: diagFrom, to: diag2To, heights: heightsWith(sideCorners) }],
    ['S5 at rest, behind/beside neighbours high', { from: [C, C], to: [C, C], heights: heightsWith(behindOrBeside) }],
    ['S6 at rest, in-front neighbours high', { from: [C, C], to: [C, C], heights: heightsWith(inFront) }],
    ['S7 straight move +x, all not-in-front high', { from: [C, C], to: [C + 1, C], heights: heightsWith(notInFrontOf([C, C], [C + 1, C])) }],
    ['S8 straight move +y, all not-in-front high', { from: [C, C], to: [C, C + 1], heights: heightsWith(notInFrontOf([C, C], [C, C + 1])) }],
    ['S9 diagonal, all not-in-front high', { from: diagFrom, to: diagTo, heights: heightsWith(notInFrontOf(diagFrom, diagTo)) }],
    ['S10 other diagonal, all not-in-front high', { from: diagFrom, to: diag2To, heights: heightsWith(notInFrontOf(diagFrom, diag2To)) }],
    ['S1 at floor-band step 0.3', { from: diagFrom, to: diagTo, heights: heightsWith([far], -0.3) }],
  ];

  console.log(`\n=== ${camName} @ ${VP.name}, glyph ${GLYPH}: worst hidden ink over the move (at t=0.5) — lift px ===`);
  console.log(`${'case'.padEnd(52)} ${VARIANTS.map((v) => v.padStart(17)).join(' ')}`);
  for (const [name, m] of cases) {
    const cols = VARIANTS.map((v) => {
      const r = worstOver(rig, m, v);
      const lift = v === 'arc' || v === 'plateau' ? ` ${r.liftPx.toFixed(0).padStart(3)}px` : '      ';
      return `${pct(r.worst)} (${pct(r.atMid)})${lift}`.padStart(17);
    });
    console.log(`${name.padEnd(52)} ${cols.join(' ')}`);
  }
  console.log(`  (far corner ${JSON.stringify(far)}, near ${JSON.stringify(near)}; behind/beside ${behindOrBeside.length}, in front ${inFront.length})`);
}
