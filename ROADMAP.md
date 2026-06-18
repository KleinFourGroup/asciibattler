# ROADMAP — Post-N

The build order after **Phase N** (rogue mobility + the balance closure)
landed and the user's **Phase-N playtest feedback** came in. Companion to
[DESIGN.md](DESIGN.md), [ARCHITECTURE.md](ARCHITECTURE.md),
[BALANCE.md](BALANCE.md), [TODO.md](TODO.md), and the prior roadmaps now in
the archive: [archive/mvp-roadmap.md](archive/mvp-roadmap.md),
[archive/post-mvp-roadmap.md](archive/post-mvp-roadmap.md),
[archive/post-c1-roadmap.md](archive/post-c1-roadmap.md),
[archive/post-d-roadmap.md](archive/post-d-roadmap.md),
[archive/post-e-roadmap.md](archive/post-e-roadmap.md),
[archive/post-f-roadmap.md](archive/post-f-roadmap.md), and
[archive/post-h-roadmap.md](archive/post-h-roadmap.md) (the immediately
preceding roadmap this one supersedes — it carried Phases I → N).

Synthesized from [archive/phase-n-feedback.md](archive/phase-n-feedback.md)
(the user's Phase-N playtest brief, now archived). Once you've read this,
`phase-n-feedback.md` is fully absorbed and lives in the archive purely as a
historical artifact.

## The diagnosis (read this first)

The brief opens with a **single root problem**: fights collapse into a chaotic
center-map melee. Both teams rush the middle and grind; the frontline never
moves, the rest of the board goes unused, and the outcome carries no tactical
variety (the corridor maps are the only exception, and only because the pathing
*accidentally* splits the blob). The user names **three** structural fixes:

1. **More player control over unit AI.**
2. **Side-objectives scattered across the map.**
3. **Dynamic terrain that physically breaks up unit blobs.**

**This brief — and this roadmap — addresses only the first.** Ideas 2 and 3 are
explicitly future rounds (see *What we're NOT doing yet*). So the whole round is
**one cohesive theme: the agency + control layer** that lets the player steer
units away from the blob — built on top of the Phase-J objective system, which
this round substantially **refactors and extends**.

## Vocabulary note

The brief reuses the same word-mapping the prior rounds settled, plus one to
watch:

- the user's **"battle"** (e.g. "every battle starts with a countdown",
  "fast-forwarding battles") = our **turn** (one tactical `World` fight). The
  countdown is therefore **per-turn**, fired at every `BattleScene` mount.
- the user's **"encounter"** (e.g. "enemy encounter health pool") = our
  **encounter** (the multi-turn fight at one map node) — used correctly in the
  brief, no translation needed.
- the user's **"run health pool"** = the `Run`-side player pool.

This doc uses **turn / encounter** throughout.

## Where this came from

Phase N closed the Post-H round: the rogue dash (N1), the difficulty-band
re-sweep against the full post-I–M combat model (N2, band locked at
`budgetFactor 1.25 × swarmMax 1.5`), and the leveling consistency check (N3,
green). N4 (the overnight out-of-sample verify) is **deferred indefinitely to a
VPS** (the local `dwm.exe` leak). See [HANDOFF.md](HANDOFF.md) for the per-step
record — treat it as the source of truth for *what shipped*, this doc for
*what's next*.

The Phase-N playtest then surfaced the blobbing diagnosis above. The work splits
cleanly into:

- **The objective refactor + new modes** (the brief's central proposal): make
  the AI *always* have a typed objective, add **focus** and **hold** modes
  alongside today's attack-move (now **engage**), and give the **enemy team**
  structural objective support (inert for now). Plus the anti-blob **ranged
  minimum-range** tweak.
- **Reaction time**: a pre-battle **countdown** (replacing the mixed-reception
  spawn animation) so the player can issue orders before the sim runs, and an
  **expanded speed control** (add 0.5× + pause; per-speed enable for future
  difficulty levels).
- **A HUD overhaul**: the monolithic HUD is "cumbersome and overwhelming" —
  break it into dedicated panes (objective commands, speed commands, player
  cards, enemy cards) and move the dropped stat detail onto the pre-turn cards.
- **Shared card display + roster/pile views**: the brief asks *three times* for
  one shared card component, plus surfaces to view the roster and the
  draw/discard piles.
- **Small cleanup**: unify the "Uncharted Ground" / "Nowhere" procedural-map
  label.

## What moved (reordering callouts)

The brief is loosely grouped by topic; this roadmap regroups by **build
dependency and testability**, which the user explicitly invited ("feel free to
reorder and rearrange"). The deltas from the brief's ordering:

- **Phase lettering continues the A–N sequence → this round is Phases O, P, Q,
  R.** ("phase-N-feedback" spawns the *post-N* roadmap, exactly as
  "phase-h-feedback" spawned the post-H one.)
- **"Ranged minimum range"** (filed under the brief's *Miscellaneous*) →
  **promoted into the sim phase (O4)**, grouped with the other AI/movement
  changes so a single fuzz-baseline shift covers them all.
- **"Pre-turn full cards"** (filed under the brief's *HUD Overhaul*) → **pulled
  forward into the card-component phase (P3)**, so the dropped stat detail lands
  on the pre-turn screen *before* the HUD strip (Q6) removes it — the stats
  never vanish in between.
- **The shared card component** → **extracted into its own early phase (P)**.
  The brief mentions sharing card code three times; making it a first-class
  foundation (authored once, consumed by the HUD, pre-turn, recruit, promotion,
  roster, and pile views) is the round's biggest *clean/extensible* lever — the
  project ethos of building the reused primitive once, up front.
- **The pacing model** (countdown, 0.5×, pause) → **co-located with its control
  panes in Phase Q**, not split into a separate sim phase. These are the
  textbook case of the user's point #2 ("some mechanics aren't easily testable
  without their UI"): the model and the buttons land together so each commit is
  playtestable.
- **The objective UI** → **in the HUD phase (Q3)**, per the brief (the objective
  pane *is* part of the HUD overhaul), kept separate from the objective *sim*
  (O) so the HUD is restructured in one pass rather than two.

## Sequencing rationale

- **Sim foundation first (Phase O).** The objective refactor + focus/hold +
  ranged min-range are pure sim/fuzz — headless-testable end to end, and the
  architectural keystone the whole round leans on. Landing it first means the
  UI phases build against a settled model, and the one snapshot bump + one
  fuzz-baseline shift happen up front.
- **The shared card next (Phase P).** A UI primitive with no sim dependency,
  and the foundation for both the HUD card panes (Q4/Q5) and the auxiliary
  surfaces (R). Build it once, prove parity against the existing recruit +
  promotion cards, then wire it everywhere.
- **The HUD overhaul + controls + pacing (Phase Q).** The large in-battle UI
  restructure, consuming O (objective modes) and P (cards). The pacing model
  rides here, co-located with its panes (testability). Broken into per-pane
  commits; the old monolithic HUD is dismantled last, once its content has a new
  home.
- **Auxiliary surfaces + cleanup last (Phase R).** Roster view, pile views, the
  naming unification — additive, lower-risk, all consumers of P.

Recommended path is **O → P → Q → R**, with a playtest pause between commits as
usual. The hard ordering constraints are: O1 before the rest of O; O before Q3
(objective UI); P before Q4/Q5 and all of R; the pre-turn full cards (P3) before
the HUD strip (Q6).

## Conventions

Unchanged from the prior roadmaps — they still hold:

- **Commit per logical change**, not per session. **Pause between commits** for
  the user's manual playtest (the established cadence).
- **Surface tradeoffs** before non-obvious calls; stop at "Decision points."
  Several steps carry a **"DESIGN ROUND NEEDED"** marker — lock the shape with
  the user before building, don't infer it.
- **Headless-first** for sim/run/core/config changes — a vitest test before the
  browser. **Browser-verify render changes** and only claim "verified" with
  concrete output. A genuinely new **3D** glyph needs a `glyphs.ts` entry
  ([FontAtlas.test.ts](src/render/FontAtlas.test.ts) guards it); DOM text
  (hitsplats, screen UI, cards) does not.
- **Hoist numbers to config from day one** (A4): every knob this round adds —
  the focus-tile-resolution strategy, ranged `minRange`, the countdown duration,
  the speed steps + per-speed enable flags — lands in `config/*.json` (or an
  isolated render const for pure VFX), never inline.
- **Balance-proof tests derive from the config module**; mechanic/primitive
  tests use explicit literals and never read the shipped JSON.
- **Keep DESIGN.md / ARCHITECTURE.md honest** in the same commit as the code
  that invalidates them.
- **One snapshot bump per shape-contract cluster** — Phase O's objective
  refactor is the round's only expected WorldSnapshot bump; land anything that
  shares it (e.g. a serialized `minRange`, if it turns out to need one) in the
  same phase.

## Cross-phase seams to hold in mind

- **The objective is becoming a first-class, always-present, per-team field on
  `World`** ([objective.ts](src/sim/objective.ts), [World.ts](src/sim/World.ts)).
  Design the typed model (O1) so the *mode* (atWill/engage/focus/hold) and the
  *target* (enemy/tile) are cleanly separated, and so the **enemy team's
  objective is structural, not bolted on** — it ships inert but is the seam the
  future "smarter enemy encounters" hang on.
- **The focus-tile-resolution strategy is a deliberate pluggable switch** (O3).
  The brief is explicit that we don't yet know which of the three behaviors
  feels best, so all three must be easily swappable — build it as one keyed
  resolver function, config-selected, not three forks.
- **The shared `UnitCard` component (P) is the substrate** the HUD panes, the
  pre-turn screen, recruit, promotion, the roster view, and the pile views all
  render through. Get its variant API right once.
- **The speed model + the sim-clock park (Q1/Q2) reuse the M3 machinery** —
  `PlaybackSpeed` ([PlaybackSpeed.ts](src/ui/PlaybackSpeed.ts)) and
  `BattleScene`'s `introRemaining` clock-park (`SPAWN.turnIntroSeconds`). The
  countdown *is* the M3 hold, repurposed; pause *is* a 0× speed. Determinism is
  preserved exactly as I3 + M3 proved (same ticks, fewer/zero per frame; real-dt
  hold).
- **Per-speed enable (Q1) + the focus-tile switch (O3) are difficulty-system
  groundwork.** The difficulty system itself is future; this round just leaves
  the data-driven knobs in place.

---

## Phase O — Objectives: the AI refactor + focus / hold + ranged min-range

The anti-blobbing core (the brief's "first idea"), and the architectural
keystone of the round. All sim + fuzz, **headless-first**. Lands the round's one
expected WorldSnapshot bump.

> **STATUS: O1 + O2 + O3 + O4 + O5 ✅ COMPLETE (2026-06-16) — Phase O sim/fuzz foundation DONE.**
> **O1** — the always-an-objective typed model (`TeamObjective` = `atWill` |
> `engage{target}`; `ObjectiveTarget` = the renamed J1 `BattleObjective`) now lives
> per-team on `World` (`objectives: { player, enemy }`, accessor `objectiveFor(team)`);
> the enemy team is fixed at `atWill` but the storage + the revert-on-death scan are
> symmetric (a future enemy strategy is a data change). `setObjective(team, objective)`
> / `clearObjective(team)` commands; `objective:set`/`:cleared` events carry the team.
> **WorldSnapshot v24 → v25** (reject stale). Byte-identical by construction (every
> consumer gates on `mode === 'engage'` / `!== 'atWill'`).
> **O2** — `hold` mode added to the union: `MovementBehavior` proposes no intent
> under hold (a one-line guard) and `Targeting.updateTarget` picks only an
> ALREADY-in-range enemy (`findInRangeEnemy`, full `attackRange`, no leash) or
> none. Units act in place — a held ranged unit fires what's in reach, a held melee
> only adjacent; the rogue **dash is suppressed for free** (it gates on
> `currentTarget`, which hold keeps in-range-or-null). No snapshot bump (rides O1).
> A fully-held board is a static stalemate the turn cap (N2) draws.
> **O3** — `focus` mode + the switchable tile-resolution. `focus` joins the
> `TeamObjective` union (target = enemy or tile) and COMPLETELY PREEMPTS
> targeting + pathing: an enemy focus beelines to that unit ignoring everything
> (eats hits from non-focused attackers, NO retaliation break-off —
> user-confirmed); a tile focus is steered by the ONE keyed resolver
> (`src/sim/focusTile.ts`) selected by `config/objective.json` →
> `focusTileResolution` (default `leashAtNearest`; `disallow` / `clearOnArrival`
> also ship switchable). The two hard-coded `engage` seams were extended to
> `focus`: `World.clearResolvedObjectives` (focus-enemy death + tile
> arrival-revert per strategy) and `BattleRenderer.onObjectiveSet` (marker shows
> for focus — it carries a target). NO snapshot bump (focus rides O1's v25;
> serialization is generic over the union). Byte-identical baseline preserved
> (fuzz:smoke 191 unchanged — focus is unreachable without the Q3 UI / O5 fuzz).
> **O4** — ranged `minRange` (kiting). `minRange` on the ability `CommonFields`
> (zod `.default(0)`); `minRangeForArchetype` (config-READ, NO `UnitDerived` →
> no snapshot bump). The three attack propose-gates + `MovementBehavior`'s
> in-range abstain became BAND `[minRange, range]` checks (too-close → kite out
> via `nearestActingCell`'s new band predicate). Semantics: fire at `d >= minRange`,
> kite at `d < minRange` (the variant that preserves heal self-target at
> `minRange 0`, user-confirmed). Shipped in two commits: **O4a** the mechanic at
> all-floors-0 (byte-identical) → **O4b** the values **bow 2 / mage 2 / catapult 4**
> (heal + melee 0). ⚠️ catapult 4 on a slow unit may be kept-from-firing by a
> matched-speed chaser — flagged for the balance re-confirmation. Verified:
> typecheck clean / 992 main / 191 fuzz:smoke.
> **O5** — fuzz typed objectives + the new modes. The KEY design call (the user's):
> the **measurement** path and the **coverage** path are SEPARATE bots, because
> they have opposite goals. The measurement `ObjectiveProclivity` is left untouched
> (it only ever emits `engage`-on-an-enemy — the one "always-reasonable steer" — so
> pure-random win rate stays a valid skill-gradient floor; teaching `random` to
> `hold`/`focus` would crater it for non-difficulty reasons). The NEW piece is a
> dev-only **coverage churn bot** (`tests/fuzz/objectiveCoverage.ts` —
> `CoverageObjectiveDriver`): it churns EVERY mode (`atWill`/`engage`/`hold`/`focus`,
> enemy + tile targets) on BOTH teams (so O1's inert-but-symmetric enemy plumbing
> gets its only live exercise), each objective given a random **1–20s lifetime**
> then re-rolled (covers the set→expire→re-set TRANSITIONS, not just static modes),
> tile cells uniformly random incl. unreachable/occupied (pathological coverage).
> Reached via `--objective=coverage` on a plain run / `--arena` (routed SEPARATELY
> from the proclivity union — it's a stateful both-team driver, not a target
> policy; `objectiveFromArgs` excludes it, `coverageFromArgs` selects it); NEVER a
> balance input (the sweep/search never read it). Churn gets a generous
> `COVERAGE_MAX_TICKS` (6× the live turn cap) so combat resolves across the
> re-targeting — the user's call (the constant re-targeting else just paths-and-
> cap-draws; the bigger cap still BACKSTOPS termination, a churn board can't hang).
> Tests (`objectiveCoverage.test.ts`): variety (all modes/targets/teams), per-seed
> determinism (driver stream + arena + harness), termination under EACH focus-tile
> resolution, full-run harness integration, flag routing. Byte-identical baseline
> (coverage off → gated code paths never run). **992 main / 205 fuzz:smoke (191 + 14),
> typecheck + lint clean.** Browser-irrelevant (dev-only tooling).
> **Balance re-confirmation ✅ CLOSED (2026-06-17, BALANCE §O5): band `1.25 × 1.5` STANDS,
> no retune.** best 75% train / +50 grad / rand 25% / greedy 13% at the band (≈ N2's
> 70%/+30 — no material move); 0 hangs / ~0 capped draws across ~700 battles (kiting did
> NOT create stalemate/kite-pin timeouts); duopoly UNCHANGED (merc 59% / ranged 40% vs
> N2's 58%/41%); archers measurably safer post-kiting but not dominant. The
> archer/duopoly/catapult-4 observations fold into the future archetype-balance thread,
> NOT a band change. **Phase P ✅ COMPLETE (2026-06-17) — the shared `UnitCard` + XP bar +
> pre-turn adoption + POW-row rework, UI-only (no snapshot/fuzz change). NEXT = Phase Q
> (the HUD overhaul + pacing model — consumes the card's `compact` variant).**

The brief's "Note on Implementation" is the spine: refactor so there is
**always** an objective, each with a **type and a data payload**, fed into (or
readily accessible by) the per-unit behaviors. Today's no-objective becomes the
default **at-will** type; today's objective becomes **engage**; auto-clearing
becomes "revert to at-will," not "set null."

### O1 — Always-an-objective typed model (refactor; both teams)

**Shape:**
- Replace `World.objective: BattleObjective | null`
  ([objective.ts](src/sim/objective.ts), [World.ts](src/sim/World.ts)) with a
  **non-null, per-team** typed objective. The model separates **mode** from
  **target**:
  - `mode: 'atWill'` — the brief's none/default/at-will (internal name —
    recommend `atWill`). No target. **Behaviorally identical to today's
    `objective === null`** (default nearest-enemy targeting, normal pathing).
  - `mode: 'engage'` — target = enemy or tile. **Behaviorally identical to
    today's set `BattleObjective`** (the RTS attack-move: leash-capped engage
    radius + retaliation, [Targeting.ts](src/sim/Targeting.ts)
    `updateObjectiveTarget`).
  - `mode: 'focus'` — target = enemy or tile (O3).
  - `mode: 'hold'` — no target (O2).
  - The existing enemy/tile `BattleObjective` union becomes the inner **target**
    type (`{ kind: 'enemy', unitId } | { kind: 'tile', cell }`).
- **Both teams carry an objective** — store as `world.objectives: { player,
  enemy }` (or a per-team accessor `objectiveFor(team)`). The **enemy team is
  fixed at `atWill`** for now (the brief: "enemy objective will always be set to
  none/default/at-will") but the plumbing is real, so future enemy strategies
  are a data change, not a refactor. Behaviors read the *acting* unit's team
  objective.
- **Auto-clear → revert to at-will** (the brief): an `engage`/`focus` enemy
  objective whose target dies sets the team back to `atWill` (today's
  `clearObjectiveIfResolved` cleared to null). Same observable behavior, cleaner
  model.
- WorldCommands: `setObjective(team, objective)`; "clear" = set `atWill`. Keep a
  thin `clearObjective` alias if the J3 UI still calls it.

**Cost / blast radius:**
- **One WorldSnapshot bump** (the objective field changes shape + the enemy
  objective is added). Reject stale, no migration (the established rationale).
- **Byte-identical sim outcomes** for at-will (≡ old no-objective) and engage
  (≡ old objective) — prove via the fuzz baseline staying put + an equivalence
  canary. The fuzz `--objective` flag's `none` default maps to `atWill`.

**Headless tests:** at-will targeting/movement ≡ pre-refactor null path
(byte-identical); engage ≡ pre-refactor objective; the enemy team's at-will
objective is inert (enemy AI unchanged); an engage enemy-target death reverts to
at-will (not null); snapshot round-trips both teams' objectives + rejects stale;
determinism.

**Decision points O1:**
- The internal default name (recommend `atWill`).
- Storage shape — recommend the `{ player, enemy }` record so enemy support is
  structural.
- Confirm O1 is a **pure refactor** — engage's leash/retaliation rules unchanged;
  behavior deltas arrive only in O2/O3.

### O2 — Hold mode

**Shape:** `mode: 'hold'` → units **stop moving** (no pathing toward a goal, no
pursuit) but **act in place**: target and attack anything already within their
attack range (the brief). The `MovementBehavior` goal-selector
([MovementBehavior.ts](src/sim/behaviors/MovementBehavior.ts)) yields *no*
movement intent under hold; `updateTarget` still picks an in-range target but the
unit never repositions to close. A held ranged unit fires at anything in reach; a
held melee unit only strikes adjacent enemies.

**Cost:** rides O1's snapshot. Fuzz: hold must still resolve (no paralysis — a
board where both sides hold ends in the turn-cap `cappedDraw`, never a hang).

**Headless tests:** a held unit never changes cell even with an enemy 2 away; a
held unit attacks an in-range enemy; a held ranged unit fires within range
without repositioning; a fully-held board resolves to a capped draw (not a hang);
determinism.

**Decision points O2:** does hold permit the in-place retaliation target-switch
(recommend yes — it *acts*, it just doesn't *move*); face/rotate toward target is
render-only.

### O3 — Focus mode + switchable tile-resolution ✅ DONE (2026-06-16)

**As-built:** shipped exactly per the spec below. The design round was
pre-resolved (default `leashAtNearest`, all three switchable, full preempt); the
user confirmed the full-preempt reading (a focused unit eats hits from
non-focused enemies — no retaliation break-off). Lives as: the `focus` union
member ([objective.ts](src/sim/objective.ts)), the `updateFocusTarget` branch +
the extracted `updateTargetDefault` ([Targeting.ts](src/sim/Targeting.ts)), the
one keyed resolver ([focusTile.ts](src/sim/focusTile.ts) +
`config/objective.json#focusTileResolution`), the MovementBehavior focus-tile
pursuit, and the two extended `engage` seams (`World.clearResolvedObjectives` +
`BattleRenderer.onObjectiveSet`). NO snapshot bump (rides O1's v25). Tests:
`focusTile.test.ts` (per-strategy) + focus blocks in `Targeting` / `Movement` /
`World` / `tests/integration/objective.test.ts`. **984 main / 191 fuzz:smoke**
(baseline byte-identical). No player UI yet — that's Q3; verify headless / via
`__game` until then.

**DESIGN ROUND NEEDED** — the focus-tile behavior has three candidate
resolutions the brief wants all switchable; confirm the default + the switch
shape. **RESOLVED — see the decision points below.**

**Shape:** `mode: 'focus'` → like engage but **completely preempts targeting and
pathing** (the brief). Even a unit mid-fight abandons its current target to chase
the focused enemy / reach the focused tile — i.e. `updateObjectiveTarget`'s
"engaged → not preempted" branch is **skipped** under focus.
- The **focused-tile unreachable/occupied** problem — implement **all three**
  candidate resolutions behind a config switch
  (`config/objective.json` → `focusTileResolution`), per the brief's "ensure all
  can be easily implemented and switched between," as **one keyed resolver
  function** (not three code forks):
  1. `disallow` — focus can't target a tile at all (the resolver rejects a tile
     focus; the UI only arms focus on enemies). Simplest, least control.
  2. `clearOnArrival` — once any player unit reaches the focused tile, the team
     focus reverts to `atWill`. Simple.
  3. `leashAtNearest` — each unit, on reaching the nearest unoccupied cell to the
     focus tile, adopts the standard engage leash *there* (acts like engage
     locally). Most complex, most intuitive (the brief's lean).

**Cost:** rides O1's snapshot. Fuzz baseline shifts when focus is exercised (O5).

**Headless tests:** focus preempts an engaged unit (abandons its current fight);
each of the three tile-resolution strategies behaves per spec (`disallow` rejects
a tile focus; `clearOnArrival` reverts the team to at-will on first arrival;
`leashAtNearest` gives the arrived unit the engage leash); a focused dead enemy
reverts to at-will (mirrors engage); determinism per strategy.

**Decision points O3:** the **default `focusTileResolution`** — **RESOLVED
(2026-06-16): `leashAtNearest`** (the brief's lean, user-confirmed); all three
still ship switchable so playtest can A/B. The boid-around-occupied-tile pathology
the brief describes is precisely why `leashAtNearest` is the default (the other
two stay available for comparison).

### O4 — Ranged minimum range ✅ DONE (2026-06-16)

**As-built:** the engagement-floor mechanic, two commits. `minRange` on the
ability `CommonFields` (zod `.default(0)`); `minRangeForArchetype`
([archetypes.ts](src/sim/archetypes.ts)) is the floor of the longest-range
engaging ability — **config-READ, deliberately NOT in `UnitDerived`, so no
snapshot bump**. The three attack propose-gates ([strikes](src/sim/abilities/strikes.ts)/[magic](src/sim/abilities/magic.ts)/[catapult](src/sim/abilities/catapult.ts))
and `MovementBehavior`'s in-range abstain became BAND `[minRange, range]` checks;
`nearestActingCell` gained an optional `minRange` so a too-close unit's firing
cell is a standoff a step back (the kite). **Semantics: fire at `d >= minRange`,
kite at `d < minRange`** — the user-confirmed variant (it preserves heal
self-target at `minRange 0`; the "name is a bit misleading" but it's strictly
more expressive). O4a landed the mechanic at all-floors-0 (byte-identical); O4b
set **bow 2 / mage 2 / catapult 4** (heal + melee 0). Tests: `nearestActingCell`
band block + `minRangeForArchetype` (config-derived) + propose-gate band tests
(mage/catapult) + a `MovementBehavior` kiting block (the scene helper gained an
`archetype` override). **992 main / 191 fuzz:smoke.** ⚠️ catapult 4 flagged for
the balance re-confirmation (a slow unit may be pinned-from-firing by a chaser).

From the brief's *Miscellaneous* section, but it's a sim AI/movement change
thematically aligned with anti-blobbing — it forces ranged units to **fall back**
off a melee attacker to re-acquire a firing position — so it lands here with the
other movement work (one fuzz-baseline shift).

**Shape:** ranged abilities gain a **`minRange`** field
([config/abilities.ts](src/config/abilities.ts) +
[config/abilities.json](config/abilities.json)). A ranged unit whose target sits
**inside `minRange`** repositions to a cell where the target is in the
`[minRange, attackRange]` band (kiting), and **abstains from firing** while the
target is closer than `minRange`. `minRange 0` (the default for every weapon,
including all melee + the heal) = **today's behavior exactly**. **The authored
values (RESOLVED 2026-06-16): every ranged attack except heal gets a floor — bow
`minRange 1`, mage bolt `minRange 1`, catapult `minRange 2`; heal stays 0.** The
goal change lives in
`MovementBehavior`'s goal-cell selection (the cell must satisfy the band, not just
the max) and rides J2's movement-intent seam — **do not reintroduce the retired
`pickGoalCellInRange` freeze** (the GP4/E5 anti-freeze guarantee).

**Cost:** `minRange` is ability config, **read live** like `range`/`accuracy` —
**confirm it does not need to enter `UnitDerived`** (recommend it stays
config-read, no serialized per-unit copy → **no extra snapshot bump**; if it must
be derived, it rides O1's bump — land it in the same phase). The **plumbing
commit is byte-identical** (`minRange 0` everywhere); the **value commit** (any
weapon > 0) moves the band → the O balance re-confirmation absorbs it.

**Headless tests:** a ranged unit with its target inside `minRange` repositions
out to the band; it fires when the target is in `[minRange, attackRange]`;
`minRange 0` ≡ today (byte-identical canary); the deadlock fixtures still pass (no
freeze); determinism.

**Decision points O4:** which weapons get `minRange > 0` + the values —
**RESOLVED then REVISED at build (2026-06-16): bow 2, mage bolt 2, catapult 4,
heal 0.** The roadmap's first pass said `1/1/2`, but with the implemented
`d < minRange` kite semantics a floor of 1 is a NO-OP (two units are always
≥ 1 cell apart), so `bow/mage 1` would never kite. The user revised to `2/2/4`
so archers + mages actually back off an adjacent attacker; **catapult 4 is
flagged** (a slow unit may be pinned-from-firing by a matched-speed chaser — a
one-number tweak if the playtest/sweep shows it's too fragile). `hold`
interaction: a held ranged unit too close simply can't fire (the propose-gate
floor blocks it; hold never repositions) — as recommended.

### O5 — Fuzz: typed objectives + the new modes ✅ DONE (2026-06-16)

**As-built (the design round REVISED the shape):** the original plan was to extend
the `ObjectiveProclivity` to emit all modes. The user's call instead **split it in
two** — the measurement proclivity stays engage-enemy-only (so pure-random win rate
stays a valid skill-gradient floor; `hold`/`focus` would crater it for
non-difficulty reasons), and a SEPARATE dev-only **coverage churn bot**
([objectiveCoverage.ts](tests/fuzz/objectiveCoverage.ts) `CoverageObjectiveDriver`)
exercises every mode on both teams with random **1–20s lifetimes** (churns the
transitions) + uniform-random (pathological) tile cells. `--objective=coverage`
routes to it separately (`coverageFromArgs`); it gets a generous `COVERAGE_MAX_TICKS`
(6× the turn cap, the user's call — the constant re-targeting otherwise just
paths-and-cap-draws; the bigger cap still backstops termination). NEVER a balance
input. Tests in [objectiveCoverage.test.ts](tests/fuzz/objectiveCoverage.test.ts)
(variety / determinism / per-resolver termination / harness integration / flag
routing). Useful note: the **measurement side needed ZERO change** — O1 already
migrated `decideObjectiveCommand` to emit the typed `{ mode:'engage', target }`, so
the existing baselines were already typed-objective-clean. **992 main / 205
fuzz:smoke, byte-identical baseline (coverage off ≡ pre-O5).**

**Shape (original plan, kept for reference):** extend J4's objective fuzz tooling
([objectiveStrategy.ts](tests/fuzz/objectiveStrategy.ts),
[arena.ts](tests/fuzz/arena.ts)) so the `ObjectiveProclivity` /
`decideObjectiveCommand` machinery + the arena menu + the `--objective` flag
grammar can emit the **typed** objectives (at-will / engage / focus / hold). The
J4 "only after kill / no-thrash" discipline carries over; `none` maps to `atWill`
(byte-identical baseline).

**Headless tests:** each mode is selectable by the fuzz strategy; an arena/short
run with focus and with hold **terminates** (no paralysis — hold resolves via the
turn cap); `atWill`-default ≡ byte-identical baseline; determinism.

**Balance re-confirmation (folded into Cleanup, not a phase):** O3 (focus) + O4
(ranged `minRange` values) + the bots exercising modes (O5) shift the fuzz read.
These are *tactical*, not power, changes — but ranged `minRange` is a real
combat-effectiveness lever. Per the BALANCE.md stable-baseline rule, **re-confirm
the N2 band holds after O** (a light broad→medium sweep, isolating the procedural
maps with `--layout=procedural`); retune only if it moved materially. The
combat-power model is otherwise unchanged this round.

---

## Phase P — The shared unit-card component

> **STATUS: P1 + P2 + P3 ✅ COMPLETE + the POW-display rework (2026-06-17).** One
> `src/ui/UnitCard.ts` builder backs recruit / promotion / pre-turn; XP-to-next bar
> on the full variant; pre-turn renders full cards (scrolls for a tall hand); `POW`
> pulled into its own accented meta row. UI-only — WorldSnapshot v25 / RunSnapshot
> v17 hold, fuzz baselines untouched. Commits `2f36727` (P1) · `e247900` (P2) ·
> `12cae25` (P3) · `06c6c77` (hover fix) · `99f214b` (POW). The decision points below
> resolved as: rarity-accent seam (not per-archetype); M2 reveal stays in
> PromotionScreen; recruit offers hide the XP bar; pre-turn scrolls rather than
> shrinking the cards. **NEXT = Phase Q.**

The round's biggest **clean/extensible** lever (the user's goal #1). The brief
asks for shared card code three times ("the code should probably be shared
between the two screens"; "these should all probably share code / the same card
display type"). Build **one** component now — before the HUD overhaul (Q) and the
auxiliary surfaces (R) consume it — so the card is authored once and every surface
stays consistent.

### P1 — Extract the shared card component

**Shape:** a single `UnitCard` UI module (`src/ui/UnitCard.ts`) that renders a
`Unit` (battle side) or a roster `template` into a card, with display
**variants**:
- `compact` — the in-battle HUD card (Q4/Q5): large glyph, **level** (top-left) +
  **power** (top-right) in small text, a **health bar the width of the glyph**
  below, **grayed out on death**.
- `full` — the recruit-style card: glyph + label + **all stats** + an **ability
  list with relevant derived stats** (P2 completes this + the XP bar).

Consolidate the existing card code into it: RecruitScreen's `renderCard` /
`abilityRow` / the UI-side ability damage-reading
([RecruitScreen.ts](src/ui/RecruitScreen.ts):133–170 — the "ability heals/damages
live HERE" block) and [PromotionScreen.ts](src/ui/PromotionScreen.ts)'s card
markup. **Prove parity** — recruit and promotion render identically after the swap
(the promotion screen's M2 staggered-reveal animation must keep working, so the
component exposes the per-stat / per-level hooks M2 drives).

**Cost:** UI-only — no sim/snapshot/fuzz. Browser-verify parity on recruit +
promotion (incl. the M2 reveal). The **recruit/promotion accent-CSS chore**
([TODO](TODO.md)) folds in here.

**Decision points P1:** the variant API (a `mode` prop + a data adapter that
takes either a `Unit` or a `template`); whether the M2 reveal animation stays in
`PromotionScreen` driving the component, or moves into the component (recommend it
stays in the screen — the component exposes the hooks).

### P2 — Full-detail variant: abilities w/ derived stats + XP-to-next bar

**Shape:** complete the `full` variant per the brief's pre-turn spec — **all
stats**, a **list of abilities each with its relevant derived stats**
(damage/heal, range, cooldown, hit, crit — read from the ability config + the
unit's profile, keeping the recruit card's existing "the card can't disagree with
the unit" guarantee), and an **XP-to-next-level progress bar** (`xpToNext` /
`displayLevel` from [xp.ts](src/sim/xp.ts)).

**Cost:** UI-only. Browser-verify the derived-stat rows match the unit's real
combat profile and the XP bar reflects `xpToNext`.

**Decision points P2:** whether un-owned recruit *offers* show an XP bar (they're
fresh templates — recommend hide the bar / show "Lv 1" for offers, show it for
owned roster units); how the ability rows render multi-ability units (the rogue's
gambit + dash) without overflowing.

### P3 — Pre-turn screen adopts the full card

**Shape:** the `PreTurnScreen` hand cards become the `full` variant — the brief's
"expanded to be the same as the cards shown during recruitment, showing all
stats, … a list of abilities with relevant derived stats, and … an XP-to-next-
level progress bar." This **is** the brief's "pre-turn absorbs the key stats
dropped from the HUD," landed in P **before** Q6 strips the HUD so the detail
never disappears in between. The K3/K4 redraw/empower selection + the empower
badges ride on top of the new card unchanged.

**Cost:** UI-only. Browser-verify the redraw/empower selection highlight, the
`Redraw (N)` / `Empower ▲` buttons, and the K4 empower badges all still work atop
the full card.

**Decision points P3:** the pre-turn layout once the cards grow (the selection
highlight + redraw/empower controls stay; the cards may need to wrap or scroll for
a 6-card hand) — a layout call, browser-tuned.

---

## Phase Q — HUD overhaul + in-battle controls & pacing

The big in-battle UI restructure (the brief's *HUD Overhaul* + *Objectives and
Reaction Time*), consuming O (objective modes) and P (cards). The pacing **model**
(countdown, 0.5×, pause, per-speed enable) lands **co-located with its control
surface** so each commit is playtestable — these are the user's point #2 (not
testable without their UI). The old monolithic HUD is dismantled **last**, once
its content has a new home.

The target layout (the brief):

```
┌─────────────────────────────────────────────────────────┐
│  TOP: map layout · enemy encounter pool · enemy cards     │
│                                          ┌──────────────┐ │
│                                          │ TR: speeds   │ │
│                                          └──────────────┘ │
│                                                           │
│              ┌──────────────────────┐    ┌──────────────┐ │
│              │ BC: player cards +   │    │ BR: objective│ │
│              │     run health pool  │    │     commands │ │
│              └──────────────────────┘    └──────────────┘ │
└─────────────────────────────────────────────────────────┘
```

### Q1 — Speed-command pane (top-right) + expanded speed model

> **STATUS: ✅ DONE (2026-06-17)** — `05b570b` (model + pane) + `b084459` (fix: progress
> bar honors speed/pause + pause-leftmost). `PlaybackSpeed` is set-by-value (0.5×/1×/2×/3×
> + pause; `current`=0 parks the sim, 0.5× rides the Clock accumulator); `config/playback.json`
> → `{value,enabled}[]` + `pauseEnabled`; keybindings retired `fastForward` for
> `speedHalf`/`speed1/2/3`/`togglePause`. Pause sits leftmost (user call). NO snapshot bump
> (page-lifetime state). The 0.5× accumulator + all-on enabled set resolved as recommended.

**Shape:**
- **Model:** extend `PlaybackSpeed` from a cycle-through-steps holder into a
  set-by-value model over `0.5× / 1× / 2× / 3×` + **pause** (0×, the sim clock
  parked). `config/playback.json` declares the steps **and** which are
  **enabled** (the brief's "individually disable pauses and specific speeds … in
  preparation for difficulty levels"). **Resume-at-prior-speed on unpause** (store
  the pre-pause step — the brief).
- **Pane (top-right):** one **button per enabled speed**, arranged left→right in
  increasing order, **only the allowed speeds shown** (the brief); pause is its
  own control. **Hotkeys** via the rebindable `Keybindings` registry —
  `Digit1`=1×, `Digit2`=2×, `Digit3`=3×, `Digit0`=0.5×, `Space`=pause (defaults
  in `config/keybindings.json`). **Replaces I3's single cycle button.**

**Cost:** the model is determinism-safe (0.5× = a fractional accumulator on the
fixed-timestep loop — same ticks, fewer per frame, the mirror of I3's batching;
pause = no ticks advance). **No snapshot/fuzz impact** (presentation, byte-
identical sim). [PlaybackSpeed.test.ts](src/ui/PlaybackSpeed.test.ts) extends.

**Headless tests:** set/get by value; pause parks (no tick advance); unpause
resumes the prior step; a disabled step is unselectable; 0.5× advances at half
rate (the accumulator math). The pane itself = browser-verify.

**Decision points Q1:** the 0.5× implementation (fractional accumulator —
recommend); the default enabled set (all on for now; the difficulty system toggles
them later); button vs segmented-control styling.

### Q2 — Pre-battle countdown (+ disable the spawn-anim materialize)

> **STATUS: ✅ DONE (2026-06-17)** — `af6c6f9` (countdown) + `b0a7ffc` (fix: parked-order
> marker). Combatants appear instantly (materialize retired; `turnIntroSeconds` removed);
> `PreBattleCountdown` (real-dt, default 5s) parks the sim. **The open decision — countdown
> sim-state vs Q1 pause — resolved AGAINST the roadmap's "distinct phase" recommendation, in
> favor of the user's "a countdown IS a pause with an auto-unpause timer":** on mount
> `playback.pause()`, and resuming (Space / ▶ / the Fight-now button / a speed button) is the
> skip signal — so the unified pause control doubles as Fight-now with no double-fire, and a
> speed button launches at that speed. The parked-order fix added `World.drainCommands()` so
> orders set while parked (countdown OR mid-battle pause) apply + show their `X` at once. NO
> snapshot bump.

**Shape:** the brief's reaction-time fix.
- **Disable the M3 turn-intro materialize fade** (the brief: "disable the initial
  spawn animation again … it reads as loading"). Keep the M3 sim-clock-park
  machinery (`BattleScene.introRemaining`) — it's exactly the countdown hook — but
  drop the unit fade-in; combatants appear immediately.
- A **configurable pre-battle countdown** (a new `config` knob; **default 5s**).
  During it the **sim is paused** (no ticks — the M3 clock-park, now a countdown),
  but **objectives may be set** (the Q3 objective UI is live; the player reads the
  board and issues orders). A visible countdown readout, plus a **"Fight now"
  button + hotkey** to skip the remainder and start immediately once orders are
  given (RESOLVED 2026-06-16). **Counts real dt** (fast-forward doesn't shorten
  it — the M3 rule).

**Cost:** presentation/pacing — **no snapshot/fuzz** (the M3 hold already proved
the tick sequence is untouched — it only delays when ticking *starts*).
Browser-verify.

**Headless tests:** no ticks advance during the countdown window (the M3
driven-tick probe, re-homed); the countdown respects real dt; an objective command
issued during the countdown is queued and applied on the first tick.

**Decision points Q2:** the default length (5s, brief); the **"Fight now" skip**
is **confirmed in (2026-06-16)**; whether the countdown's paused
state and the Q1 pause are the same sim state or distinct (recommend: the
countdown is a distinct pre-battle phase that, on completion, starts the sim at
the player's selected speed).

### Q3 — Objective-command pane (bottom-right)

> **STATUS: ✅ DONE (2026-06-17)** — the bottom-right pane: **Engage / Focus /
> Hold / Stop** on O's typed `TeamObjective` model. `ObjectiveController` was
> generalized from J3's single Set-arm into **per-type arming** (`arm('engage'|
> 'focus')` → next left-click sets in that mode) + immediate `hold()` / `stop()`
> (stop = revert to at-will, the old "clear"); right-click the board still
> quick-sets **Engage** (the J3 fast path). The pane reflects the team's live
> mode (`.is-active`, tracked off `objective:set`/`:cleared`) and the armed
> target-pick (`.is-armed` pulse, which the active highlight yields to). The old
> HUD Set/Clear buttons were **removed** (user call — the pane subsumes them; Q6
> now only strips the roster/stat lines). The **marker glyph reads the mode**:
> engage `X`, **focus `!`** (already in the glyph atlas — no grid resize; the
> reused marker sprite swaps glyph in place via `updateSprite`). Keybindings
> reshaped: `setObjective`/`clearObjective` → `engage`/`focus`/`hold`/
> `stopObjective` (defaults **E / F / H / T**, dodging the WASD camera keys).
> **UI/input/render only — no sim/snapshot/fuzz** (1007 main / 205 fuzz:smoke,
> v25/v17 hold). Browser-verified all four modes end-to-end (arm → set → marker
> glyph + active highlight, hold/stop immediate, hotkeys) via dev-preview. Decision
> points resolved as: focus marker = `!` glyph (user — expanding the atlas is
> needed for new archetypes anyway, though `!` happened to already be in it); old
> buttons removed now; abort bounds = re-arm switches mode, hold/stop cancel the
> arm, an off-board click stays armed (the J3 retry behavior). **NEXT = Q4** (the
> player-card pane, bottom-center — first consumer of P's `compact` card variant).

**Shape:** the brief's objective pane, built on O's model + extending J3's
`ObjectiveController` ([ObjectiveController.ts](src/ui/ObjectiveController.ts)).
- A **button per objective type**: **Engage**, **Focus**, **Hold**, and the
  at-will default labeled **"Stop"** (the brief — to the player it reads as
  "clear other objectives").
- **Target-requiring types (Engage, Focus):** click the button → **arm** a "pick
  a target" mode → the next left-click on a **valid** target sets it. The team
  objective does **not** change until the target is specified. An **invalid
  target, or a click elsewhere in the HUD, aborts** the arming (the player must
  reselect the type). This generalizes J3's single Set-arm flow to **per-type
  arming**, routed through `objectiveAtCell`.
- **Hold + Stop:** no target — apply immediately on click.
- **All buttons hotkeyed** via the rebindable `Keybindings` registry (J3).

**Cost:** UI + input on O's model — **no sim/snapshot/fuzz**. The J3 `X`-marker
render extends to distinguish the modes (engage vs focus vs hold). Browser-verify
each mode end-to-end (arm → click → units obey).

**Decision points Q3:** the **right-click** default — **RESOLVED (2026-06-16):
right-click on the board quick-sets an *Engage* objective directly** (no arming —
the J3 fast path preserved), while the buttons arm the richer Focus/Hold modes.
Still open: the marker visuals per mode; the exact abort bounds ("click elsewhere
in the HUD" vs any non-board click).

### Q4 — Player unit pane (bottom-center)

> **STATUS: ✅ DONE (2026-06-17)** — `68adcad`. Built P's `compact` UnitCard variant
> for real (P left the seam unconsumed): `buildCompactCard` (glyph + Lv-TL/POW-TR +
> glyph-width HP bar) via a new `unitCardFromUnit` adapter + `hpFill` handle + `hud`
> skin. The bottom-center pane lives in HUD.ts; cards built on `unit:spawned`, HP on
> attacked/burned/healed, grayed-in-place (not removed) on death; the poolGauge
> relocated beneath. Decision points resolved as recommended (spawn-order ≈ hand-slot,
> wrap, dead cards stay grayed). UI/render only — no snapshot/fuzz change.

**Shape:** the brief's player pane — a grid of `compact` cards (from P) for the
player's fielded units: large glyph, level (top-left) + power (top-right) small,
glyph-width health bar below, **grayed out on death**. Beneath all the cards, the
**player run health-pool bar** (the `poolGauge`
[poolGauge.ts](src/ui/poolGauge.ts), relocated from the old HUD).

**Cost:** UI — consumes P's compact card + the existing pool gauge; live-updates
off the `unit:*` events the HUD already subscribes. Browser-verify HP drain + the
death gray-out.

**Decision points Q4:** card ordering (by hand slot — recommend, for positional
stability across turns); wrapping for a 6-card hand; dead cards stay in place
(recommend yes — grayed, not removed).

### Q5 — Enemy unit pane (top)

> **STATUS: ✅ DONE (2026-06-17)** — `5b12893` + fixes `1032b0b` / `f138dd9`. The
> top-center mirror of Q4: enemy pool gauge above a red-teamed `compact`-card grid
> (a new `team` option → `unit-card--enemy`; the `cards` map + `unit:*` handlers
> generalized to both teams). **Swarm-fit resolved** (the open question): a wide
> pane cap (`min(94vw, 1800px)`) keeps a realistic swarm on one row, a `max-height:
> 30vh` + scroll is the vertical fallback, and `HUD.positionCountdown()` drops the
> countdown below the pane when the cards wrap on a narrow/short screen. Enemy
> content = full parity (resolved 2026-06-16). UI/render only — no snapshot/fuzz.

**Shape:** the brief's expanded top pane — **map layout** at the very top (as
today), then the **enemy encounter health-pool bar**, then an **analogous enemy
card grid** (compact variant), cards graying out on death.

**Cost:** UI — mirrors Q4 for the enemy team. Browser-verify.

**Decision points Q5:** enemy card content — **RESOLVED (2026-06-16): full
parity with player cards** (glyph + level + power + HP). So the `compact` variant
(P1) is **team-agnostic** — it always shows level/power, no enemy-specific mode to
build. Still open: how a large enemy swarm fits (cap / shrink / scroll — the swarm
can be sizeable post-N2).

### Q6 — Dismantle the old monolithic HUD

> **STATUS: ✅ DONE (2026-06-17) — Phase Q COMPLETE.** `5a52962`. Removed the old
> side panel from HUD.ts: both rosters (`makeRoster`/`makeRow`/`updateRow` + the
> `rows` map), the per-unit stat lines (`formatSub`/`formatStats` — the
> stat-crowding + RNG-label chores resolved by deletion), the inline You/Foe pools
> (`renderPools`/`poolRow`), and the "Battle resolving…" status line. The floor
> label relocated to a standalone top-left chip (folds in the per-turn counter);
> the location banner stays centered. The roster-row halves of the `unit:*`
> handlers went, the card-pane halves stayed (browser-verified all four HP paths).
> **Net −325 lines.** UI/render only — no snapshot/fuzz. **NEXT = Phase R.**

**Shape:** remove the old combined roster catalog + key-stat lines from
[HUD.ts](src/ui/HUD.ts) (the brief: it "has gotten cumbersome and overwhelming").
The stat detail now lives on the pre-turn full cards (P3); the in-battle HP lives
in the Q4/Q5 card panes. Reconcile what remains (the floor/location banner stays
or relocates). The **`power` distinct-visual-treatment + HUD stat-line-crowding**
and **`RNG` label-vs-reach ambiguity** chores ([TODO](TODO.md)) resolve here as
the old lines are deleted.

**Cost:** UI cleanup — net **code removal** (the win). Browser-verify nothing
regressed; the HUD is now exactly the four panes + banner.

---

## Phase R — Auxiliary card surfaces & cleanup

The remaining brief items — all consumers of P's shared card. Additive,
lower-risk.

### R1 — Roster view (map / recruit / pre-turn)

> **STATUS: ✅ DONE (2026-06-17).** The shared card-list modal: a top-right
> roster button on the Map / Recruit / pre-turn screens opens a **CardListModal**
> overlay ([src/ui/CardListModal.ts](src/ui/CardListModal.ts) — generalized from
> roster-only to roster + piles in R2) — a dimmed, scrollable
> backdrop of the full roster as `full` UnitCards (a new **`roster` skin** on P's
> component: all stats + abilities + the XP-to-next bar, display-only). Esc, a
> backdrop click, or the ✕ all dismiss; `open()` is idempotent. The order rides a
> **pluggable seam** ([src/ui/rosterOrder.ts](src/ui/rosterOrder.ts) —
> `orderRoster`: `recruited` [default] / `archetype` / `level`, stable on
> recruitment order) per the user's call (recruitment order now, switchable
> later); only `recruited` is wired to the UI. Each scene threads `ctx.run.team`
> into its screen's `show()`; the button is disposed on `hide()` (which also
> closes any open overlay + detaches the Esc handler). **UI-only — no
> snapshot/fuzz change** (v25/v17 hold). **1014 main tests** (1007 + 7 new
> `rosterOrder` tests); typecheck + lint clean. Browser-verified end-to-end on
> all three screens via dev-preview (5191): button present, modal lists all 10
> roster units (distinct from the 6-card hand on pre-turn) with XP bars +
> abilities, all three dismiss paths work, no console errors. ⚠️ subjective feel
> (card size / spacing / modal placement) still wants the native browser, per the
> Q-phase caveat. **NEXT = R2** (draw/discard pile views). Decision points
> resolved as: modal overlay (user); recruitment order via a switchable seam
> (user); a dedicated `roster` skin (shows the XP bar for owned units).

**Shape:** a "view the entire player roster" affordance (**top-right button**, the
brief) on the **Map screen**, the **Recruit screen**, **and** the **pre-turn
screen** — opening a panel of the full roster as shared cards (P's `full`
variant). **One shared roster-view component** reused across the three screens
(the brief: "These should all probably share code").

**Cost:** UI — the shared component + a button wired into three screens.
Browser-verify on each.

**Decision points R1:** modal overlay vs inline panel; sort/group (by archetype?
by level? recommend a stable roster order).

### R2 — Draw-pile / discard-pile view (pre-turn)

> **STATUS: ✅ DONE (2026-06-17).** Two more corner buttons on the pre-turn
> screen — **Draw Pile** (bottom-right) + **Discard Pile** (bottom-left) — open
> the same shared modal as R1 (the R1 `RosterView` was **generalized to
> `CardListModal` + `CardListButton`** so roster + both piles share one
> component, per the brief's "share code"). Each pile lists its units as `full`
> cards, **contents only / unordered** (resolved). The piles ride the existing
> pre-turn event flow: `turn:starting` + `turn:handRedrawn` now carry
> `drawPile`/`discardPile` resolved to templates **in recruitment order** (a new
> `Run.resolvePileForDisplay` sorts ascending-index, so the view never reveals
> the next-draw sequence); the screen stores them and the buttons read the latest
> copy at click time, so a reopened pile view reflects a redraw. Empty piles show
> a message ("The discard pile is empty."). **UI + an event-payload extension —
> no snapshot/fuzz change** (the events fire only on the gated/live path; v25/v17
> hold). **1015 main tests** (+1 R2 Run test covering both emit paths + the
> recruitment-order contract); typecheck + lint clean. Browser-verified via
> dev-preview: all three buttons placed, draw-pile modal lists contents in
> recruitment order (cross-checked vs the run's pile), discard empty at turn 1,
> and a redraw moved a card into the discard which the reopened modal reflected
> ("Discard Pile — 1 unit"); no console errors. ⚠️ subjective placement/feel
> still wants the native browser. **NEXT = R3** (the Uncharted-Ground/Nowhere
> label unify + cleanup chores). Decision points resolved as: modal (matches R1);
> contents-only/unordered enforced at the Run via recruitment-order resolution.

**Shape:** the brief — on the pre-turn screen, a button (**bottom-right**) to view
the **draw pile** and one (**bottom-left**) for the **discard pile**, each listing
those units as shared cards. Reads the `Run`'s H5 deck piles (which hold roster
indices → resolve to templates → render).

**Cost:** UI — reads existing pile state, shared cards. Browser-verify the piles
reflect a redraw/draw.

**Decision points R2:** pile-view detail — **RESOLVED (2026-06-16): contents
only, unordered** (shows which units are in each pile without revealing the
next-draw order, so it informs redraw without trivializing the gamble). Still
open: modal vs slide-out.

### R3 — "Uncharted Ground" / "Nowhere" unification + chores

> **STATUS: ✅ DONE (2026-06-17) — Phase R COMPLETE; the Post-N O→R round is
> closed.** The procedural-map label is unified to **"Uncharted Ground"** via one
> shared constant (`PROCEDURAL_MAP_NAME` in [src/sim/layouts.ts](src/sim/layouts.ts));
> both the pre-turn map line ([PreTurnScreen](src/ui/PreTurnScreen.ts)) and the
> in-battle banner ([BattleScene](src/scenes/BattleScene.ts)) route through it, so
> they can't drift again (pre-R3: "Uncharted ground" vs "Nowhere"). Cleanup
> chores landed (user-selected): **`.gitattributes`** (`* text=auto eol=lf` —
> stops the per-`git add` CRLF warnings; `git add --renormalize` was a no-op, the
> repo was already LF), an **inline-SVG favicon** (the "@" origin marker, green on
> black, in [index.html](index.html) — stops the `/favicon.ico` 404 with no extra
> request), and the **bundle chunk-size** fix ([vite.config.ts](vite.config.ts) —
> `three` split into its own 525 kB vendor chunk via `manualChunks` + the warning
> ceiling lifted to 1000 kB; the build is now quiet, app chunk 273 kB). **Catapult
> SFX deferred** to its own pass (the heaviest chore — an audio asset, not
> config). **No snapshot/fuzz change** (v25/v17 hold). **1015 main tests**;
> typecheck + lint + `npm run build` clean. Browser-verified: favicon link is the
> inline SVG (no 404), and a forced procedural pre-turn map renders "⌖ Uncharted
> Ground". **Phase R is COMPLETE (R1–R3); NEXT major thread = archetype balance**
> (READ [BALANCE.md](BALANCE.md) first).

**Shape:** the brief's naming bug — the pre-turn screen says **"Uncharted ground"**
([PreTurnScreen.ts](src/ui/PreTurnScreen.ts):158) while the in-battle banner says
**"Nowhere"** ([BattleScene.ts](src/scenes/BattleScene.ts):204,
[HUD.ts](src/ui/HUD.ts)). Pick **one** label for procedural maps (recommend
**"Uncharted Ground"** — more evocative) and route **both** sites through a single
shared constant so they can't drift again.
- Fold in the still-open, unblocked **Cleanup chores** that touch this round's
  surfaces.

**Cost:** trivial string/const unification + the chores.

---

## Cleanup / chores

Not gated; land any time (several pair naturally with this round's work).

- **Recruit / promotion accent CSS** ([TODO](TODO.md)) — folds into **P1** (the
  shared card consolidates both screens).
- **`power` distinct visual treatment + HUD stat-line crowding** ([TODO](TODO.md))
  — resolves in **Q6** as the old HUD lines are deleted and `power` gets its
  card slot (top-right of the compact card).
- **`RNG` stat-label vs `rng` reach ambiguity** ([TODO](TODO.md)) — cosmetic; fold
  into the **Q6 / P** card label work.
- **Balance re-confirmation after O** (see O5) — ✅ **DONE (2026-06-17, BALANCE §O5):
  band `1.25 × 1.5` STANDS, no retune** (best 75% train / +50 grad; 0 hangs / ~0 draws;
  duopoly unchanged; archers safer-not-dominant). Archetype-balance observations
  deferred to that thread.
- **Favicon** — ✅ **DONE (R3)**: inline-SVG "@" glyph in index.html; stops the
  per-load `/favicon.ico` 404.
- **Dedicated catapult SFX (+ the F3 launch/impact split)** ([TODO](TODO.md)) —
  still pending (deferred from R3 as the heaviest chore — an audio asset).
- **`.gitattributes`** — ✅ **DONE (R3)**: `* text=auto eol=lf` stops the CRLF
  warnings (renormalize was a no-op; repo was already LF).
- **Bundle chunk-size warning** — ✅ **DONE (R3)**: `three` split into its own
  vendor chunk via `manualChunks` + `chunkSizeWarningLimit` lifted to 1000 kB.
- **N4 — overnight out-of-sample verify** ([HANDOFF.md](HANDOFF.md), the prior
  round's deferred closer) — still **deferred to a VPS** (the local `dwm.exe`
  leak, [archive/dwm-leak-diagnosis.md](archive/dwm-leak-diagnosis.md)). Land
  `--seed-offset` + run it when a VPS is available.

---

## What we're explicitly NOT doing yet

**The other two anti-blob ideas (this round's headline deferrals):**
- **Side-objectives scattered across the map** — the brief's *second* idea. A
  whole mechanic (capturable points / loot / sub-goals that pull units off the
  center). Waits until the objective/control layer this round builds has been
  playtested — it's the natural consumer.
- **Dynamic terrain that breaks up blobs** — the brief's *third* idea
  (destructible / shifting cover, moving hazards). Builds on the M6 procedural
  terrain; a future round.

**Carried from the prior round (still deferred):**
- **Smarter enemy objective AI.** O1 gives the enemy team full objective
  *support*, but it stays `atWill`; enemy objective *strategies* wait for the
  encounter system.
- **A difficulty-level system.** Q1's per-speed enable + O3's focus-tile switch
  are the groundwork; the system itself (and what it toggles) is future.
- **An in-game keybinding-rebind screen.** The rebindable registry + config
  defaults suffice; the UI is a later nicety.
- **Font / non-Latin-script support** for glyph collisions — revisit when the
  next wave of unit types actually collides.
- **Enemy-archetype diversification beyond Bandit** — waits for a proper
  encounter system.
- **Recruit rarity tiers + floor-weighted offers.**
- **Multi-map / "Regions" + theme-per-map migration.** Single long map stands.
- **A daemon economy** (shop / rewards / multiple-daemon builds). One random
  daemon at run start stands.
- **Save/load UI + replay UI.** Plumbing exists (A2); the UX waits until the run
  shape settles.
- **Boss / elite bespoke mechanics.** The boss node is still a tagged regular
  fight (G3).
- **Touch controls** for the camera.
- **Map-aware scored fuzz policy** (the banked K3c3 follow-up — the comp×map
  interaction) and **object-pooling** the sim's per-tick allocations
  ([TODO.md](TODO.md)) — both still parked.
