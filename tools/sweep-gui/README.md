# sweep-gui (dev tool)

A point-and-click **command-builder** for the balance tooling — the GUI sibling
of the fuzz CLI (`tests/fuzz/cli.ts`). The balance sweep / weight search runs in
Node (tsx), not the browser, so this page can't *run* a sweep; it builds the
`npm run fuzz -- …` command for you to copy and paste into a terminal (the way
the run launcher emits a launch URL).

```bash
npm run dev
```

then open <http://localhost:5173/tools/sweep-gui/>. Pick a mode, fill the fields,
**Copy command**, and run it in a terminal at the project root.

## Modes

- **balance-sweep** — sweep a config knob (or a 2-knob grid) and read the
  *best-achievable win rate* + the *skill gradient* (best − baseline) + per-
  archetype telemetry at each grid point. The H7c tuning instrument. Writes
  `tests/fuzz/output/balance-sweep.csv` + `.report.txt`.
- **search** — random-search the scored-strategy weights for the best-achievable
  win rate at the *current* config (the "did my change move balance?" check, and
  the overnight verify). Writes `tests/fuzz/output/best-strategy.json`.

## Single source of truth

The knob menu and the emitted command both come from
`tests/fuzz/sweepCommand.ts`:

- `SWEEP_KNOBS` is enumerated live from the three config objects the sweep tunes
  (`DIFFICULTY` / `HEALTH` / `LEVELING` — the same `KNOB_GROUPS` set
  `tests/fuzz/balanceSweep.ts` accepts), so the menu can't offer a knob the CLI
  rejects, and a newly-added numeric config key auto-appears. Each option shows
  the knob's current value.
- `buildFuzzArgs` assembles the argv, mirroring the CLI's flags (so `--knob2`
  only emits paired with `--range2`, `--jobs` only when > 1, `--dry-run` only in
  balance-sweep mode, etc.). Covered by `tests/fuzz/sweepCommand.test.ts` (`npm
  run fuzz:smoke`).

## Fields

| field        | flag             | notes                                              |
|--------------|------------------|----------------------------------------------------|
| Knob / Range | `--knob` `--range` | `group.key` + `min:max:steps` (steps = point count)|
| 2nd knob     | `--knob2` `--range2` | optional; makes a grid                           |
| Tier         | `--tier`         | `quick` / `medium` / `heavy` / `overnight`         |
| Jobs         | `--jobs`         | child processes (> 1 only); parallelizes both modes |
| Dry run      | `--dry-run`      | time point 1 + project the total, write nothing    |
| Preset       | `--preset`       | search-mode tier                                   |
| Vectors      | `--vectors`      | search vectors (blank = preset default)            |
| Seeds        | `--seeds`        | total, split ~80/20 train/test                     |
| Floors       | `--floors`       | override the tier/preset run length                |
| Roster       | `--roster`       | `archetype[:level],…` forced starting team         |
| Sampler seed | `--sampler-seed` | reproducibility (default 1)                        |

Not part of the production build — `vite build` only bundles the game entry; the
`tools/` tree is served statically by the dev server and never lands in `dist/`.
