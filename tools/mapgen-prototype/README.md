# Map-Gen Prototype

A dev-only, eyeball-tuned prototype for **reworking procedural map generation**
(the M6 follow-up — "rework procedural maps from the ground up"). Standalone
Vite page; visit `http://localhost:5173/tools/mapgen-prototype/` after
`npm run dev` (or use the `dev-preview` port).

**Not wired into the sim yet.** The point is to nail the *look and feel* of the
generator before it replaces the uniform-scatter path in
[`src/sim/terrainGen.ts`](../../src/sim/terrainGen.ts). When we commit to it,
[`generator.ts`](./generator.ts) ports to `src/sim/proceduralMap.ts` with the
real `GeneratedTerrain` shape + a proper test suite. It already uses the
project `RNG` + `GridCoord`, so the port is mechanical.

## The approach

Grounded in our topology — two 8-wide spawn bands top + bottom, armies marching
to a mid-map clash:

- **Crossbars** — horizontal wall lines *across* the advance axis, each with a
  fordable **gap**. They funnel the vertical advance into a chokepoint; a
  watered gap is an M6 bog-down **ford**. (This is the structure uniform
  scatter never produced — and the reason puddles-on-path alone didn't bite.)
- **Dividers** — vertical partial walls: lateral structure / cover / alternate
  routes (so the objective system has routing decisions).
- **Noise** — one value-noise field textures the open ground: high → cover
  clumps (ranged cover, LOS breaks), low → organic water pools.
- **Mirror** — reflects the top half onto the bottom so neither army gets a
  terrain advantage (fairness for a two-sided clash).

A connectivity guard guarantees a spawn-to-spawn route (carving a central
watered breach if the gaps ever seal), and a wall cap bounds total walls (walls
are neutral *units* in the sim, so the count is a real budget).

## Controls

Size / mirror / seed, plus sliders for crossbar count, gaps-per-bar, gap width,
ford chance, divider count, cover + pool density, noise scale, and the wall cap.
**Reroll** rolls a new seed; the **Variety** strip shows the next 8 seeds at the
current knobs (click one to load it). The stats row reports wall count / wall %
/ water / chokepoints / connectivity / cells carved.

This is a sketchpad — knobs and ranges will change as we converge on the feel.
