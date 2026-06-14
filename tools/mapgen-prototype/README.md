# Map-Gen Prototype

A dev-only sketchpad for the **reworked procedural map generator** (M6).
Standalone Vite page; visit `http://localhost:5173/tools/mapgen-prototype/`
after `npm run dev` (or use the `dev-preview` port).

**Now wired to the production generator.** The algorithm ported into
[`src/sim/proceduralMap.ts`](../../src/sim/proceduralMap.ts) (replacing the
uniform-scatter path in [`src/sim/terrainGen.ts`](../../src/sim/terrainGen.ts)),
and this tool imports it directly — so what you see here is exactly what the game
generates. The old standalone `generator.ts` copy is gone.

Two modes:

- **Manual** (default): the sliders drive a `ResolvedMapParams` directly; reroll
  varies the structure at fixed knobs.
- **Roll knobs from config**: each seed samples a `ResolvedMapParams` from the
  live `config/terrain.json#procedural` envelope (one RNG, sample-then-generate,
  exactly as the game does at encounter time), so the **Variety** strip shows the
  real seed-to-seed spread. The sampled knobs are reflected into the (disabled)
  sliders so you can read what each map rolled. Tune the envelope in
  `config/terrain.json` and the rolls update on reload.

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
