# Plan — Tutorial / onboarding

A **§80 feasibility-audit doc**: audit + plan only, ZERO
implementation. Audited 2026-08-16 at `f776f05`. C6 owns the build
(META-ROADMAP: onboarding + options/settings menu).

## Readiness — friendlier than the other C6 features

The kickoff audit's verdict holds: most of the machinery a tutorial
needs already exists.

- **[Keybindings](../src/ui/Keybindings.ts)** is a registry with
  rebindable actions and a page-lifetime dispatch sink (§78e made
  `toggleSectorMap` the first page-lifetime consumer) — tutorial
  prompts can *derive* key labels from the live bindings.
- **Scene swaps are centralized in `Game`** — a tutorial
  orchestrator has one place to observe/intercept flow.
- **Plain-DOM overlay idioms are established** (`CacheOverlay`,
  `SectorMapOverlay`): full-viewport overlays with clickable close,
  page-lifetime hotkeys — the natural vehicle for contextual
  callouts.
- **Determinism makes a scripted teaching run nearly free** — the
  strongest feasibility fact in this doc. A fixed seed + the
  existing run-config surface (`RunConfig` forced encounters,
  forced layouts, `npm run run-config` / `/tools/run-config/`)
  yields a byte-reproducible first run: the tutorial can be
  *authored against known board states* ("this exact bandit
  approaches on turn 1") instead of writing a reactive hint engine
  — the same property that makes the fuzz harness work, pointed at
  onboarding. The §74 event system's page grammar (pages,
  conditions, hop-gating) is a candidate vehicle for the guided
  beats; evaluate at C6 spec time, don't pre-commit.

## What's missing (both C6)

1. **A seen-flags store** — "has seen the movement hint,"
   "completed the intro run": cross-session state, i.e. the same C6
   persistent store as save/load / achievements / settings
   ([plans/achievements.md](achievements.md) — designed once, four
   consumers). **The C6 dependency is hereby explicitly confirmed**
   (the §80 exit criterion).
2. **A settings surface** — skip tutorial, replay tutorial, reset
   hints: rows in the C6 options menu.

## What Cluster 6 must not break

- **⭐ DESIGN §Input accessibility is the tutorial's curriculum
  law** (user-signed 2026-08-14): the mouse/touch route is the one
  the tutorial *teaches*; hotkeys are presented as accelerators
  ("or press M"), never as the taught path. A tutorial that says
  "press M to view the map" with no clickable alternative violates
  the very rule the game signed.
- **Key labels come from the registry, never hard-coded.** C6 also
  ships the in-game rebind UI — a tutorial string with a literal
  "M" in it goes stale the moment a player rebinds. Prompts render
  `keybindings.labelFor(action)`.
- **Sequencing: the post-C5 UI style & robustness audit lands
  first** (META-ROADMAP §Interstitials, user-raised 2026-08-14) —
  the tutorial points at chrome chips, modals, and buttons; it must
  be authored against the *audited* idioms, not the current mix.
  Building the tutorial before that round means re-shooting every
  callout after it.
- **The scripted run must stay an ordinary run** — a pinned
  `RunConfig`, not a parallel code path. If the tutorial needs a
  bespoke sim mode, that's a design smell; the whole feasibility
  case above rests on determinism making the NORMAL machinery
  sufficient.
