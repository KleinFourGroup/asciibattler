# ROADMAP — Post-H

The build order after **Phase H** (the multi-turn "deckbuilder" trial)
landed and the user's **Phase-H playtest feedback** came in. Companion to
[DESIGN.md](DESIGN.md), [ARCHITECTURE.md](ARCHITECTURE.md),
[BALANCE.md](BALANCE.md), [TODO.md](TODO.md), and the prior roadmaps now in
the archive: [archive/mvp-roadmap.md](archive/mvp-roadmap.md),
[archive/post-mvp-roadmap.md](archive/post-mvp-roadmap.md),
[archive/post-c1-roadmap.md](archive/post-c1-roadmap.md),
[archive/post-d-roadmap.md](archive/post-d-roadmap.md),
[archive/post-e-roadmap.md](archive/post-e-roadmap.md), and
[archive/post-f-roadmap.md](archive/post-f-roadmap.md) (the immediately
preceding roadmap this one supersedes — it carried Phases F → H).

Synthesized from [archive/phase-h-feedback.md](archive/phase-h-feedback.md)
(the user's Phase-H playtest brief, now archived), the deferred tail of the
post-F roadmap (the stage-5 overnight verify, the leveling pass, the rogue
salvage), and [TODO.md](TODO.md) + the post-F "Cleanup / chores". Once
you've read this, `phase-h-feedback.md` is fully absorbed and lives in the
archive purely as a historical artifact.

## Vocabulary note (read this first)

The feedback brief and this roadmap use the same words for different
things. **The mapping, confirmed with the user:**

- the user's **"skirmish"** = our **turn** (one tactical `World` battle).
- the user's **"battle"** = our **encounter** (the multi-turn fight resolved
  at one map node).

So "level up between skirmishes, not just battles" = promote **between
turns**, not only at encounter end; "redraw at the start of each skirmish" =
at the start of each **turn**; "pre-/post-skirmish scenes" = the
`PreTurnScene` / `PostTurnScene` turn gates. This doc uses **turn /
encounter** throughout; where it quotes the brief it keeps the brief's word
and annotates it.

## Where this came from

Phase H delivered the multi-turn trial end to end: the `power` meta-stat
(H1), spawn-tile range (H2), the deployment counter / fatigue hook (H3), the
health-pool encounter loop + pre/post-turn screens (H4), the card-drawn hand
+ the `playerTeamLevel` seam swap (H5), the recruit-pass + rest-heal + inert
fatigue hook (H6), and the H7 search-driven balance tooling that set the
difficulty band (`budgetFactor 0.625 × swarmMax 1.75`) and ran the archetype
rebalance. See [HANDOFF.md](HANDOFF.md) for the per-step record — treat it as
the source of truth for *what shipped*, this doc for *what's next*.

The Phase-H playtest then surfaced a broad feedback cluster. The user's three
**most substantive** complaints:

1. **Player agency** — losing even a *turn* early feels awful because the
   player can't influence battles at all.
2. **Foregone conclusions** — once a turn drops to a few units the outcome is
   certain ten to twenty seconds before it resolves. Dead time.
3. **Balance** — still needs an overhaul.

Plus a tail of smaller ones (boring random layouts; water has no mechanical
effect; leveling too rare; revert the `speed → agility` rename — it now reads
as "dodge chance"; level *between* turns; the level-up screen dumps too much
at once + needs juice; kill the auto-progression between turn scenes; turns
start/end too abruptly; the board floats in space) and two dev asks
(auto-editing layouts instead of copy-pasting JSON; an archetype editor).

## What moved (reordering callouts)

This round reshuffles several previously-locked priorities and promotes a
cluster off the old "explicitly NOT doing yet" list. The deltas:

- **Rogue salvage** (the post-F "next focus", a mobility/dash ability) →
  **deferred to the end of this round (Phase N) and made contingent on the
  Phase J pathing overhaul.** The **dodge system is the interim rogue fix**
  ("dodge-tank", re-measured in Phase I). If dodge alone makes the rogue
  viable, the mobility rework may be **repurposed to a future class** rather
  than spent on the rogue (user call). Mobility was always going to disturb
  pathing; Phase J overhauls pathing for the objective system, so building
  mobility *on top of* that seam avoids a double rewrite.
- **Status-effect system** → promoted from "explicitly NOT doing yet"
  (deferred "until a concrete consumer reveals its shape") to a **Phase K
  foundation.** The feedback supplies four consumers at once — empower,
  daemons, timed dodge-buffs, and the already-stubbed H6c "Fatigued status" —
  so the shape is finally revealed. **Build it generic now** (user call),
  migrating the inert fatigue hook as the proof consumer.
- **Dodge mechanics** → promoted from "NOT doing yet" to **Phase I** (it is
  the keystone of *two* top-three complaints — predictability and balance).
- **In-battle controls** (the old "low-level targeting / pathing" deferral) →
  the **objective system, Phase J.** Promoted, and sequenced first among the
  agency work (user call).
- **Enemy-archetype diversification** → a **partial** un-defer: **Bandit
  becomes the default melee enemy** (Phase I). The rest (rogue/healer/mage/
  catapult on the enemy side) stays deferred.
- **Stage-5 overnight verify + the leveling-rate pass** → stay **last (Phase
  O)**, now behind *more* band-movers than just the rogue (dodge, subclasses,
  per-turn leveling, possibly fatigue), reinforcing the BALANCE.md
  "tune against a stable baseline" rule.

## Sequencing rationale

- **Foundation first (Phase I).** Dodge + the `agility → speed` revert is the
  highest-leverage move available: it directly attacks *foregone conclusions*
  (the predictability angle), it is the differentiator the *balance* class-
  split needs (Adventurer/Ronin/dodge-tank-rogue), and it is the lever that
  re-measures the rogue. Two of the three top complaints, plus the rogue
  decision, all turn on it. The `speed` revert + the two new stats are all
  stat-block changes → **one snapshot bump**, done together (the GP1/GP2
  pattern).
- **Objectives next (Phase J — user call).** The biggest single agency item,
  self-contained, and the one the user feels strongest about ("I don't see a
  way around this anymore"). It forces the **pathing overhaul** — surfacing
  that risk early, and producing the seam Phase N's rogue mobility builds on.
- **Status + pre-battle agency (Phase K), then daemons (Phase L).** Empower
  and daemons both ride the status system, so it lands first (with fatigue as
  proof). Redraw needs the roster/hand decoupling but no status system.
  Daemons *gate* the Phase K mechanics, so they come right after.
- **Dev tooling is co-located with the work it serves** (the project ethos),
  not batched into its own phase: the **archetype editor lands in Phase I** (I4,
  right before the subclass authoring it enables) and the **layout auto-editor
  in Phase M** (M5, right before the map redesign it enables). Progression +
  presentation (Phase M) is otherwise lower-risk, mostly eyeballed.
- **Balance closure last (Phase N).** Every structural combat change (dodge,
  subclasses, per-turn leveling, the contingent rogue mobility, any fatigue
  teeth) lands *before* the final sweep + overnight verify, so we tune once
  against a stable baseline (BALANCE.md). The leveling-*rate* pass lives here
  too (the user will experiment on their own throughout; the disciplined tune
  is the closer).

Recommended path is **I → J → K → L → M → N**, with a playtest pause
between commits as usual. The hard ordering constraints (not the full path)
are: I before the rogue re-measure + the subclasses; J before N1 (mobility);
K's status system before empower (K4) + daemon in-battle effects (L); all
combat-structural work before O's sweep.

## Conventions

Unchanged from the prior roadmaps — they still hold:

- **Commit per logical change**, not per session. **Pause between commits**
  for the user's manual playtest (the Phase E/F/G/H cadence).
- **Surface tradeoffs** before non-obvious calls; stop at "Decision points."
- **Headless-first** for sim/run/core/config changes — a vitest test before
  the browser. **Browser-verify render changes** and only claim "verified"
  with concrete output. A genuinely new **3D** glyph needs a `glyphs.ts`
  entry ([FontAtlas.test.ts](src/render/FontAtlas.test.ts) guards it); DOM
  text (hitsplats, map icons, screen UI) does not.
- **Hoist numbers to config from day one** (A4): every knob this round adds —
  precision/evasion scalars, the hit-chance multipliers, subclass stat
  blocks, fast-forward multipliers, status-effect durations, redraw cap,
  daemon effects, per-turn-XP, water-effect magnitude — lands in
  `config/*.json` (or an isolated render const for pure VFX), never inline.
- **Balance-proof tests derive from the config module**; mechanic/primitive
  tests use explicit literals and never read the shipped JSON.
- **Keep DESIGN.md / ARCHITECTURE.md honest** in the same commit as the code
  that invalidates them.
- **One snapshot bump per stat-vocab cluster** — do not bump twice in a phase
  for stat additions that could share a bump (Phase I bundles the revert + 2
  stats).

"Decision points" flag user-input moments. Several Phase K/L/M steps are
**vaguer in the brief and carry a "DESIGN ROUND NEEDED" marker** — stop and
lock the shape with the user before building, don't infer it.

## Cross-phase seams to hold in mind

- **`world.applyDamage`** ([World.ts](src/sim/World.ts), the GP2-consolidated
  single combat-damage site) is where the dodge hit/miss roll slots in — one
  place, all four attack actions covered.
- **The Phase J pathing rework is the seam Phase N's rogue mobility builds
  on.** Design the objective pathing with a clean **movement-intent** hook so
  a dash/leap ability is a new *intent*, not another pathing rewrite.
- **The status-effect system (Phase K) is the substrate** empower, daemons,
  timed dodge-buffs, *and* fatigue ride. Migrating the inert H6c
  `fatigueFactor` hook ([fatigue.ts](src/run/fatigue.ts)) onto it is the proof
  consumer — keep that migration in the same phase so the system isn't built
  speculatively.
- **`handSize` / starting-roster decoupling (K2)** reopens the H5 "cliff"
  analysis (why `handSize 5` == starting roster 5). Redraw is redundant while
  they're equal; adjusting one is a balance lever, not just a UX toggle.
- **Per-turn leveling (M1) is structural; the leveling *rate* (N3) is
  balance.** Do not tune XP rates until O, or we tune them twice.

---

## Phase I — Foregone conclusions & combat identity

The predictability half of "foregone conclusions" + the class-identity half
of the "balance" overhaul + the dodge foundation everything downstream leans
on. All combat-stat-layer work, one cohesive theme, landing the snapshot bump
the rest of the round can assume.

### I1 — `agility → speed` revert + `precision` / `evasion` stats

**Shape:**
- **Revert `agility → speed`** across `UnitStats`, [archetypes.json](config/archetypes.json)
  (`baseStats` + `growthRates`), the zod schema ([archetypes.ts](src/config/archetypes.ts)),
  [leveling.ts](src/sim/leveling.ts), [stats.ts](src/sim/stats.ts)
  (`cooldownScale` callers + `ZERO_STATS`), the `STAT_LABELS` map
  ([statLabels.ts](src/ui/statLabels.ts): `AGI` → `SPD`), the HUD line, and
  every test fixture. **This is the reverse of GP1's `speed → agility`** — the
  diff is a near-mirror; lean on `tsc --noEmit` to find every fixture.
- **Keep `mobility` as-is** (recommended, user to confirm in *Decision
  points*). `mobility` (move cadence) is not confused with dodge, and a real
  `evasion` stat now arriving makes `agility` doubly misleading but leaves
  `mobility` clean. End state — `speed` (attack cadence) + `mobility` (move
  cadence) — is *more* legible than GP1's, not a regression to the pre-GP1
  "two movement-sounding stats" confusion (that only existed when the move
  stat was `endurance`).
- **Add `precision` + `evasion`** to the stat block (the GP1/GP2 "add a stat"
  plumbing, done twice in one pass): `UnitStats` / `ZERO_STATS` / the base +
  growth zod schemas / every archetype in `archetypes.json` / `STAT_KEYS` /
  both `leveling.ts` return objects / `STAT_LABELS` (`PRC`, `EVA`) / the
  recruit + promotion cards (auto-surface via the shared label loop).
  Behavior-neutral until I2 consumes them.
- **Stat order — insert mid-block, NOT appended last** (user call): the dodge
  stats are direct-combat stats, so they read better grouped with the others on
  the recruit card than stranded after `power`. **Canonical order →
  `CON · STR · RNG · MAG · LCK · DEF · PRC · EVA · SPD · MOB · POW`** (combat →
  dodge → cadence → meta) — which also nudges `DEF` up next to `LCK` (GP2's
  append had left it *after* the cadence stats). **Reorder `STAT_KEYS` (draw
  order) and `STAT_LABELS` (card order) in sync** so "draw order == card order"
  stays legible. Safe despite breaking H1's "append last" discipline: that rule
  only existed to *minimize* the draw-sequence shift when bolting one stat onto
  a stable system, but I1 **re-baselines the fuzz output regardless** (Cost,
  below), so the mid-block insert rides the same regen at zero extra cost.
  Snapshots are **name-keyed** (order-independent) and bumped anyway; the
  config-derived tests iterate `STAT_KEYS` — so nothing breaks beyond the
  planned baseline regen.

**Cost / blast radius:**
- **One WorldSnapshot bump + one RunSnapshot bump** (the revert renames two
  keys; the two new stats add two — all in the same shape contract). Reject
  stale versions outright, no migration (the GP1/GP2/H1 rationale).
- **Fuzz / determinism outcome baseline shifts** (two extra per-level RNG
  draws advance `levelupRng`). Regenerate the gitignored `tests/fuzz/output/*`.
- The `scored` fuzz strategy's stat vector auto-grows off `STAT_KEYS`
  (self-correcting, as `power` did at H1) — no manual menu edit.

**Headless tests:** `precision`/`evasion` level per `growthRates` (balance-
proof off `ARCHETYPE_CONFIG`); snapshot round-trips the new block + rejects
stale; the `speed` revert leaves `attackCooldownTicksFor` reading the renamed
stat (a fixture pinning cadence is unchanged in *value*).

**Decision points I1:**
- **Confirm `mobility` stays** (recommend yes — revert only the dodge-
  confused name).
- **Per-archetype `precision`/`evasion` base + growth** — by feel; casters/
  ranged lean precise, rogue/Adventurer lean evasive (locked properly in I4
  alongside the subclass identities).

### I2 — Dodge in combat: hit/miss + the "Miss" hitsplat

**Shape:**
- **One roll at the single damage chokepoint** `world.applyDamage` (GP2):
  before mitigation, roll hit chance from `combatRng` (the same dedicated
  stream crit uses). On a miss, deal **0**, emit a `unit:attacked`-adjacent
  **miss** signal, and skip the HP/`recordDamage` path. Recommended formula
  (**user's lean — Fire-Emblem subtractive**): `hitChance = clamp(base +
  precision×pMult − evasion×eMult, floor, cap)`, all four scalars in
  [config/stats.json](config/stats.json). (The ratio form
  `prc/(prc+eva)` is the documented alternative — *Decision points*.)
- **"Miss" hitsplat** — a DOM overlay (the E3.6 hitsplat channel), distinct
  color/text from a damage number. **No `glyphs.ts` entry** (DOM text).

**Cost:** WorldSnapshot — **no further bump** (shares I1's; land I1+I2 same
session). Fuzz baseline shifts (misses change outcomes). Render surface =
the hitsplat (browser-verify).

**Headless tests:** miss → 0 damage + no HP mutation + the miss signal;
hit-chance honors floor/cap; crit and miss are independent rolls in a defined
order (pin it); environmental fire/chasm damage **never** rolls to-hit
(unmitigated *and* unmissable — mirrors GP2's env-damage carve-out);
determinism per seed.

**Decision points I2:** subtractive vs ratio (recommend subtractive, your
lean); the base/floor/cap so chip/AoE and low-`precision` units aren't gutted
(watch the mage ring, as GP2 did); whether ranged/AoE attacks roll to-hit at
all or only single-target melee/ranged strikes.

### I3 — Fast-forward (2× / 3×)

**Shape:** a HUD button (+ hotkey) cycling **1× / 2× / 3×** sim speed — the
direct antidote to the low-unit dead-time. Implemented as a **tick-batching
multiplier on the fixed-timestep loop** (run N sim ticks per render frame),
*not* by raising `TICK_RATE` (determinism is preserved — same ticks, fewer
frames between them). Multipliers in `config`.

**Cost:** presentation-layer only — **no snapshot bump, no fuzz impact**
(the sim is byte-identical; only how many ticks advance per rAF changes).

**Decision points / watch:** the brief's perf concern — at 3× the renderer
drives ~60 sim-ticks/s and pathing is the cost center. **Profile pathing at
3× on a big board before committing to 3×** (2× may be the safe ceiling;
expose the max as a knob). Pairs with the Phase J pathing perf work — if
objective-thrash recompute lands, re-check 3× after.

### I4 — Archetype editor (schema-driven)

The user's "an archetype editor would be nice" dev ask, **pulled forward into
Phase I to support the subclass split that immediately follows** (I5) — the
round's first real archetype-authoring push, so the editor earns its keep here
rather than in a batched late tooling phase (co-located with the work it
serves, the project ethos). **Sequenced after I1 deliberately:** I1 finalizes
the stat schema (the `agility→speed` revert + `precision`/`evasion`), so the
editor targets the *final* stat block — you author each subclass once, not
before-and-after a schema change.

**Shape:** a dev-only editor (sibling of [tools/layout-editor/](tools/layout-editor/);
Vite-served, never in `dist/`) to author/edit
[archetypes.json](config/archetypes.json) entries, with a **write-to-config
save path** that closes the copy-paste loop (the same auto-edit capability the
layout editor gets in M5). Build it **schema-driven** — enumerate the editable
fields from the zod schema ([archetypes.ts](src/config/archetypes.ts)), the way
the H7d sweep-GUI enumerates knobs and the `scored` strategy auto-tracks
`STAT_KEYS` — so a future stat addition surfaces automatically instead of
needing an editor edit. **Live stat preview** (the derived HP / cadence / crit /
hit-chance from a stat block) is the high-value extra, since the subclass
identities (I5) are tuned by feel.

**Cost:** dev-tooling only — **no `src/` sim/snapshot/fuzz impact** (it edits a
config the game already loads). Eyeball-verified in the standalone tool, like
the layout editor.

**Decision points I4:** editor scope (raw-field editing + schema validation is
the floor; live stat-preview is the worthwhile extra — recommend including it,
since I5 tunes by feel); whether to share scaffolding with the layout editor
(M5).

### I5 — Melee subclasses + Bandit enemy + rogue dodge-tank

**DESIGN ROUND NEEDED** — the brief gives *tentative* identities ("word
vomit"); lock the stat blocks with the user before authoring.

**Shape:**
- **Break the single "melee" archetype into a family**, now that dodge can
  differentiate them (the brief's point: one melee class forced player/enemy
  symmetry). Tentative (brief): **Mercenary** (= today's melee),
  **Adventurer** (lower defense, higher evasion), **Ronin** (high luck),
  **Bandit** (Mercenary with lower growth rates). Each is a new entry in
  [archetypes.json](config/archetypes.json) — mostly data, given the dodge
  stats from I1.
- **Bandit = the default melee *enemy*** (replaces generic melee in
  `rollEnemyWave`, [enemyBudget.ts](src/run/enemyBudget.ts), keeping the
  ~60/40 melee/ranged split) — a contained, partial enemy-archetype un-defer
  "until we design a proper encounter system" (brief).
- **Rogue → dodge-tank** — re-tune the rogue's `evasion` (+ supporting stats)
  so the dodge system gives it the survivability it lacked, then **re-measure
  with the H7 tools** (forced-roster eval + a free search) to answer the
  **rogue decision**: does dodge alone make it viable (→ Phase N mobility
  becomes optional / a future class) or not (→ Phase N mobility stays)?
- **Glyphs:** new player subclasses need distinct glyphs. Recommend
  **`M`/`A`/`R`/`B`** (Mercenary/Adventurer/Ronin/Bandit) — distinct ASCII,
  **no font/script work needed yet** (the brief's font + non-Latin idea is
  deferred until glyphs actually collide; see *What we're NOT doing yet*).
  Any new 3D glyph still needs a `glyphs.ts` entry.

**Cost:** archetype additions are config + a `glyphs.ts` entry each; the
enemy-roll swap shifts the fuzz baseline. New archetypes flow through the
existing recruit pool (generic since F1) and the `scored` strategy's per-
archetype weights (auto-grow off `ALL_ARCHETYPES`).

**Headless tests:** each subclass derives stats per its config; `rollEnemyWave`
fields Bandit (not generic melee) at the configured split; the recruit pool +
fuzz menu pick up the new archetypes; balance-proof off `archetypes.json`.

**Decision points I5:** the four subclass stat identities + growth rates (the
design round); whether Adventurer/Ronin are *recruitable from the start* or
gated; **the rogue decision** (above) — flag the re-measure result to the user
before Phase N; map-redesign dependency (the brief: "I will have to redesign
the maps" — the one-tile corridors are too spawn-dependent; that authoring is
the user's, supported by Phase M's floor-gating + the layout auto-editor (M5)).

### I6 — Per-ability combat profile (might / accuracy / crit)

**✅ DONE (2026-06-09, two commits) — see [HANDOFF.md](HANDOFF.md) for the as-built record.**
Commit 1 = behavior-neutral plumbing (byte-identical; WorldSnapshot v20→v21 for the
per-ability crit move — the predicted "no bump" was wrong, `UnitDerived` IS serialized).
Commit 2 = the weapon rename/split (`melee_strike`→sword/club/katana/whip, `ranged_shot`→`bow`),
the authored first-pass values (Sword +5/60%/5%, Club +2/40%/0%, Katana +4/60%/20%, Whip
+3/70%/5%, Bow +4/70%/5%, gambit +1/85%/10%), mage/catapult `critable:false`, the recruit-card
weapon-profile display, and WorldSnapshot v21→v22 (the ability-id rename). **PHASE I COMPLETE.**

The capstone of Phase I's combat-identity work — and the change that makes I5's
subclass split actually *feel* distinct. Today every attack computes damage, hit
chance, and crit from the SAME formulas, so a unit's stat block is the only
differentiator and two range-1 melee strikes are identical but for stats. This
finishes the per-ability move **E5 started for cadence + range**: the *ability*
(the weapon) carries its own combat profile, the stat scales it. The codebase
anticipated it — [abilities.ts](src/config/abilities.ts) defers "the expressive
damage-formula JSON … a later step, designed when there's a real multi-stat
consumer." I5's four melee subclasses (all sharing `melee_strike`) are it.

**Shape:** five new **required** fields on `AbilitySchema`
([config/abilities.ts](src/config/abilities.ts) + [config/abilities.json](config/abilities.json)) —
three numeric profile values + two boolean **gates** (user call: every ability
declares all of them, so a new attack can't silently lack one). The gates are a
proper **"designate an attack as evadable / crit-able" system** — config, not
hard-coded per call-site — so tweaking or extending it later is a JSON edit:
- **`might`** (flat base damage/heal, ≥ 0): the damage/heal formula becomes
  `might + scalingStat` instead of the bare stat. **Flat** (a weapon constant; the
  wielder's stat is what grows), so might is an early/mid-game texture knob the
  stat outgrows late — the intent. Pre-defense (`max(minDamage, (might+stat)−def)`);
  crit multiplies the whole raw.
- **`accuracy`** (base hit chance, 0–1): **replaces** the global `STATS.hitChanceBase`
  (0.6) in `hitChanceFor` → `clamp(accuracy + precision·k − evasion·k, floor, cap)`.
  Consumed only when **`evadable`** (below); inert otherwise.
- **`critBase`** (base crit chance, 0–1): folds into the luck calc →
  `clamp(critBase + luck·critPerLuck, 0, critCap)`, consumed only when **`critable`**
  (below). Per-ability now, so crit stops being a single `UnitDerived.critChance` and
  is resolved at attack time from the firing ability + the unit's luck. (`critCap`
  still binds — a high-base weapon on a lucky unit caps sooner, e.g. a 20%-crit katana
  on Ronin's luck.)
- **`evadable`** (bool): does this attack roll to-hit (consume `accuracy` vs the
  target's evasion)? **MIGRATES I2's hard-coded per-call-site `evadable`** (`AttackAction`/
  `GambitStrikeAction` passed `true`; `MagicBoltAction`/`CatapultShotAction` passed
  `false`) into config — the action now reads `ability.evadable`. Today's set: the
  melee weapons + bow + gambit `true`; magic-bolt AoE / catapult / heal `false`.
- **`critable`** (bool): can this attack crit (roll `critBase + luck`)? Today's crit
  set preserved at the neutral default (the basic strikes crit; heal doesn't; mage /
  catapult **`false`** — user call). Lets a future attack opt in/out without code.

**Weapons (rename + split):**
- **Split `melee_strike` → per-subclass weapon ids** — `sword` (Mercenary), `club`
  (Bandit), `katana` (Ronin), and the **`whip`** (Adventurer — the *Indiana-Jones*
  adventurer, not the D&D one; optional flavor hook for I6b: give the whip **range 2**
  to lean into its reach, a real melee-family differentiator). Each is a new
  **registered** ability id sharing the basic-strike *behavior* but carrying its own
  config profile (the registry boot-check requires a factory + config entry per id;
  the melee weapons all map to the one melee-strike factory, parameterized by id).
- **Rename `ranged_shot` → `bow`.** `magic_bolt`, `heal_ally`, `catapult_shot`,
  `gambit_strike` **keep their ids** — none are "basic weapons" (the gambit is the
  rogue's *special*; the basic-vs-special-ability distinction the user wants to draw
  later lives at this seam).
- Starting profiles to author by feel (the I2/I5 examples): Club `+2 / 40% / 0%`,
  Sword `+5 / 60% / 5%`, Katana `+4 / 60% / 20%`, gambit `+1 / 85% / 10%`. These
  **compound** with the I5 stat identities (Ronin's luck + the katana's crit both say
  "crit duelist"; Bandit's fodder stats + the weak club both say "fodder"), so weapon
  and stat reinforce one identity rather than fight.

**Rollout (de-risked — the H1/I1 plumbing-then-tune discipline):**
1. **Behavior-neutral plumbing** — add the three fields with defaults that reproduce
   today EXACTLY (`might 0`, `accuracy 0.6`, `critBase 0`) + the formula/threading
   rewrite. Prove byte-identical (fuzz baselines unmoved + a neutral-default canary).
   One commit.
2. **Author the per-weapon values + the rename/split** — config + the registry wiring.
   The band moves here (feeds Phase N's re-sweep).

**Cost / blast radius:**
- **WorldSnapshot bump v20→v21 (RESOLVED 2026-06-09 — the prediction was wrong).**
  The guess was "no bump" pending *"confirm `UnitDerived` isn't serialized"* — it IS
  (`UnitSnapshot.derived` is stored verbatim; E5's **v12** bumped for exactly this kind
  of derived-field removal). Removing `critChance` from `UnitDerived` (crit is per-ability
  now) changes the serialized shape → **one WorldSnapshot bump** (reject stale, no
  migration). **RunSnapshot is NOT bumped** (roster templates carry only `stats`; there's
  no World between turns — only a mid-*battle* save uses WorldSnapshot). User call: remove
  + bump (honest schema) over a vestigial field. The evadable strike actions also gained
  serialized `accuracy`/`evadable` action-data, cleanly covered by the same reject-stale bump.
- Touches the formulas ([stats.ts](src/sim/stats.ts): `hitChanceFor` takes the ability
  accuracy; the damage helpers `basicAttackDamage`/`magicBoltDamage`/`catapultShotDamage`/
  `healAmountFor` take might; crit resolves per-ability), the actions (thread their
  ability profile into `applyDamage`), `applyDamage` ([World.ts](src/sim/World.ts):
  threads accuracy alongside `evadable`), the display surfaces (recruit-card ability
  rows + the I4 archetype-editor preview → read a per-weapon profile), and the ability
  registry (new weapon ids).
- **Fuzz baseline shifts** at step 2. Band-mover → Phase N re-sweep absorbs it; the I2
  whiff-lengthens-battles caveat sharpens (a 40%-accuracy club whiffs a lot — pairs
  with I3 fast-forward + the 150s turn caps).
- **Legibility win** — a recruit card reads "Sword · +5 / 60% / 5%": a real weapon, not
  stat soup (the recurring legibility theme).

**Headless tests:** damage/heal == `might + stat` (balance-proof off the ability config);
hit chance uses the per-ability accuracy (floor/cap honored); crit ==
`clamp(critBase + luck·critPerLuck, 0, critCap)`; the neutral-default plumbing reproduces
current damage/hit/crit EXACTLY (the byte-identical canary, like H1's inert-default tests);
each weapon derives its profile from config; the rename/split leaves every archetype
pointing at a valid registered ability.

**Decision points I6 (resolved with the user 2026-06-09):** weapon names LOCKED —
Sword (Mercenary) / Club (Bandit) / Katana (Ronin) / **Whip** (Adventurer), + `bow`;
the mage bolt / catapult are **`critable: false`** (no crit); the **gambit keeps its
id** (a *special*, not a basic weapon — the basic/special line). Still by-feel in I6b:
the per-weapon `might`/`accuracy`/`critBase` *values* (+ whether the Whip takes range 2).
**Deferred** — revisiting I5's bold stat spreads once the weapon layer shares the
identity load ("see where it lands"). **New TODO logged** — an ability **display-name +
description** system (so a card can read "Whip — long reach, rarely misses" instead of
the raw id; pairs with the I5 archetype display-label TODO, fold together).

**Explicitly deferred (user calls):**
- **Scaling-stat on the ability** (a weapon declaring "scales on strength") — waits for
  the basic-vs-special-ability + multi-stat-scaling distinction the user wants to design
  properly.
- **A weapon / attack-upgrade / loadout system** — out of scope; might stays flat until then.

---

## Phase J — In-battle agency: the objective system

The brief's central agency mechanic, and the largest single item this round.
A **low-intensity** steering layer — explicitly *not* an RTS: the player sets
**one shared objective**, units honor it only when not already engaged. The
brief is unusually concrete here, so this phase is well-specced; the risk is
**pathing + performance**, not design.

### J1 — Objective model + targeting preemption (sim)

**Shape:**
- An **objective** is a **tile** or an **enemy unit**, set on the battle
  (one shared objective for the whole player team — the brief notes this
  enables a shared-path optimization).
- **Preemption rules** (brief): a unit **actively fighting or close to its
  existing target is not preempted**; an **unengaged** unit paths toward the
  objective; a unit en route that comes **within range** of an enemy adopts
  *that* enemy as its target (preempting the objective). "Range" = attack
  range; for **long-range ranged** units, an **upper limit + retaliation
  requirement** so an archer doesn't ignore the objective to plink everything
  in its long reach.
- **Enemy objective:** engage on entering range; on its **death the objective
  clears**. **Tile objective:** an **attractor** — units path as close as
  they can; auto-clear-on-arrival vs persist-until-cleared is a *Decision
  point*.

**Cost:** new battle-level objective state (snapshot it — a mid-battle save
must restore the objective; **WorldSnapshot bump**). Sits on top of the
existing target-selection ([targetingStrategies.ts](src/sim/targetingStrategies.ts)) +
movement behaviors.

**Headless tests:** an engaged unit ignores the objective; an idle unit paths
to it; an enemy entering range preempts a tile objective; an enemy objective
clears on death; the ranged upper-limit/retaliation gate; determinism.

### J2 — Pathing overhaul + performance

**✅ DONE (`feat(J2)`) — seam-first, cache DEFERRED (see HANDOFF J2 entry).** The
decision point ("cache aggressiveness") resolved with the user to **seam-first**:
build the movement-intent hook + a bounded-recompute guard now, defer the cache
behind a pure boundary until a profile demands it. `src/sim/movement.ts` factors
`MovementIntent` + `advance` (the dash hook, `maxCells>1`) + `routeToward` (the
pure `findPath` wrapper = the cache boundary); `MovementBehavior` is now a thin
goal-selector and `SupportMovementBehavior` shares the leaf helpers. Byte-identical
(fuzz:smoke 89 unchanged, no snapshot bump). Worst-case profile (32×32, 60 units,
objective thrash every tick): **~0.10 ms/tick ≈ 1.8% of a 3× frame** → a cache is
premature; `pathfindingStats` + [pathing-perf.test.ts](tests/integration/pathing-perf.test.ts)
guard the per-tick recompute budget so the cache becomes a localized later add
when the guard trips. N1's gap-closer rides the `maxCells>1` hook (validated by a
test, not built).

**Shape:** the brief's flagged risk. A shared objective that the player may
**thrash** (re-set rapidly) means naive per-tick `findPath` per unit is a
perf hazard — especially stacked with I3's 3× fast-forward. Levers (brief):
**cache paths** and recompute only on a boid sidestep / objective change;
exploit the **shared objective** (units converging on one goal can share
flow-field / path data rather than each running an independent search).
**This is the pathing seam Phase N's rogue mobility reuses** — leave a clean
**movement-intent** hook (a dash is "move toward X *now*, ignoring the normal
goal-cell logic").

**Cost:** touches [MovementBehavior.ts](src/sim/behaviors/MovementBehavior.ts) +
[Pathfinding.ts](src/sim/Pathfinding.ts). Fuzz baseline shifts. **Do not
reintroduce the retired `pickGoalCellInRange` freeze** (the GP4/E5 anti-freeze
guarantee — see the MovementBehavior comment block + the layout-deadlock
fixtures).

**Headless tests:** objective-thrash doesn't blow a per-tick path budget
(assert a bounded recompute count); the layout-deadlock fixtures still pass
(no freeze); a forced shared objective resolves identically with/without the
cache (cache correctness); determinism per seed. Profile a worst-case board
at 3× (ties back to I3).

### J3 — Objective UI + rebindable hotkeys

**✅ DONE (2026-06-09, two commits) — see [HANDOFF.md](HANDOFF.md) for the as-built record.**
Commit 1 = the rebindable-hotkey PLUMBING (`config/keybindings.json` + `src/config/keybindings.ts`
+ the `Keybindings` runtime registry: `codeFor`/`actionFor`/`rebind`/`on`/a DOM-free `handleKeyDown`)
+ folding I3's fast-forward `F` into it. Commit 2 = the objective UI: right-click sets directly,
a **Set Objective** button/hotkey arms a "pick a target" mode (next left-click sets), a **Clear**
button/hotkey clears; the capital-`X` marker (the last FontAtlas cell) renders larger on a rally
tile / atop the target enemy's billboard, driven purely off `objective:set`/`cleared`. No
sim/snapshot/fuzz change (presentation + input on J1's model). **PHASE J's first playtestable surface.**

**The middle-ground keybinding call (the J3 decision point, resolved with the user):** build the
runtime-rebindable registry NOW (so a future in-game rebind screen is a one-line `rebind` caller),
but seed it from config defaults this round — no rebind SCREEN yet (it stays on the "NOT doing yet"
list). Defaults `fastForward KeyF` / `setObjective KeyO` / `clearObjective KeyC`.

**Original shape (for reference):** **right-click** sets the objective; a **Set Objective** button
(click → then left-click a target) and a **Clear Objective** button. **Both buttons hotkeyable, and
the hotkeys rebindable** — a small **input-binding layer**, config-backed, *not* tied to Claude
Code's own keybindings. Render + browser-verified.

### J4 — Fuzz strategy for objectives (arena runs)

**✅ DONE (2026-06-10, two commits) — see [HANDOFF.md](HANDOFF.md) for the as-built record.**
Commit 1 = the objective-strategy primitive ([objectiveStrategy.ts](tests/fuzz/objectiveStrategy.ts): a
serializable `ObjectiveProclivity` — none | random | stat:hi/lo per `STAT_KEY` | hp:hi/lo — + the
no-thrash `decideObjectiveCommand`) + the **arena harness** ([arena.ts](tests/fuzz/arena.ts): one
forced `World`, no `Run`; `runArenaSearch` enumerates the menu → writes `best-objective.json`).
Commit 2 = the **`--objective=<json|random|none>` flag** on the full run fuzz + `--search` +
`--balance-sweep` (threaded through the child-process `ShardJob`), default `none` = byte-identical
baselines. Dev-only tooling, **ZERO src change** (main 780 unchanged; fuzz:smoke 89→114). **PHASE J COMPLETE.**

**The Decision points below are RESOLVED:** the fuzz objective targets **units only** + **refills only
on kill** (no thrash — falls out of J1's auto-clear); proclivities are **parameterized per stat key AND
per enemy archetype** ("focus the mage" — the user's reading of the brief's "per-archetype"; a follow-up
commit, live today for `bandit`/`ranged`) (user call); objectives are tuned **in isolation in the arena**, and the arena's saved strategy **feeds
the run fuzz** via the flag (the user's envisioned workflow — tune in the arena, then hold the objective
fixed while sweeping the other knobs). The tile-objective auto-clear / ranged-leash decisions were
already settled in J1; the path-cache aggressiveness in J2.

**Shape:** the brief's testing scheme, so objectives don't paralyze the fuzz
bots. For fuzz: **objectives may only target units**, and **only after the
previous objective's target is killed** (no thrashing). Per-archetype
proclivities: **highest / lowest stat**, **highest / lowest current health**,
and a **no-objective** proclivity. The brief notes these are best tuned in
**"arena" runs** (a single forced battle) — add an **arena harness mode**
(one `World`, no run wrapper) to the fuzz tooling for isolated objective
tuning. A `scored`-strategy objective term can come later; this phase just
needs the mechanic exercised + non-paralyzing.

**Headless tests:** each objective proclivity selects the right unit; the
"only after kill" gate holds; an arena run with objectives terminates (no
paralysis / no freeze); determinism per seed.

**Decision points J:** tile-objective auto-clear vs manual-persist; the
ranged upper-limit + retaliation exact rule; how aggressive the path cache is
(correctness vs recompute frequency).

---

## Phase K — Status effects & pre-battle agency

The status-effect system (the keystone, built generic now) plus the brief's
two pre-battle mechanics — **redraw** and **empower** — that ride on it. Both
mechanics are "optional at the start of each turn"; in this phase they ship
with a **static default enable** (the trial pattern, like H6b's free pass),
and **Phase L's daemons make their availability data-driven**.

### K1 — Generic status-effect system (+ fatigue migration)

**✅ DONE (2 commits, both byte-identical at the default) — see [HANDOFF.md](HANDOFF.md) for the as-built record.**
Commit 1 = the World-side substrate (`StatusEffect` + `foldEffects` + `effectiveStats` + the full
combat/kill/death/spawn trigger set; WorldSnapshot v23→v24). Commit 2 = the Run-side `encounterEffects`
store (the `endOfEncounter` lifetime, re-seeded at deploy) + `addEncounterEffect` + the run triggers
(`encounterStart`/`turnStart`/`deploy`) + the **fatigue migration** (`fatigueFactor` power-bake →
`fatigueEffect` Fatigued status; RunSnapshot v11→v12). **Design-round resolutions (3 AskUserQuestion
rounds):** magnitude + merge-policy primitive (`replace`/`add`/`multiply`/`independent`); the linear-in-
magnitude fold (recovers the exact fatigue curve); live-read stats now + a wired `refreshDerived` seam
for temp-maxHp/move-speed later (only the currentHp clamp deferred); the FULL trigger set incl. kill+death;
the encounter-scoped lifetime pulled into K1. **PHASE K's foundation; K2–K4 ride it.**

**DESIGN ROUND NEEDED** — lock the shape against its four known consumers
before building (the project's anti-speculative-generality rule, now
satisfiable because the consumers exist).

**Shape:** a per-unit collection of **status effects**, each: a **stat
modifier** (additive and/or multiplicative, per stat), a **lifetime**
(duration in seconds → ticks, or "until end of turn / encounter"), and
**stacking** behavior. Applied/expired deterministically in the tick loop;
snapshotted with the unit. The four consumers that define the shape:
- **Empower** (K4): a flat buff on a drawn unit, "lasting until the end of the
  battle [encounter]" (brief).
- **Daemon effects** (L): timed buffs, e.g. "+1 speed for ten seconds" on a
  trigger (brief).
- **Timed dodge-buffs** (L): "on a friendly unit evading an attack, gain +1
  speed for ten seconds" (brief) — needs an **on-evade trigger** hook (ties to
  I2's miss/evade signal).
- **Fatigue** — **migrate the inert H6c `fatigueFactor`**
  ([fatigue.ts](src/run/fatigue.ts)) onto this system as a **stackable
  "Fatigued" debuff** (the eventual shape the H6c entry explicitly names).
  This is the **proof consumer** — it keeps K1 from being speculative and is a
  localized re-wire (H6c was built as a one-site hook for exactly this).

**Cost:** **WorldSnapshot bump** (units carry effects). Keep fatigue **inert
by default** through the migration (the H7/Phase-O sweep decides if it gets
teeth) — a no-op-at-default test guards that.

**Headless tests:** a stat modifier applies + expires on schedule; stacking
math; "until end of turn/encounter" lifetimes clear at the right boundary; the
migrated fatigue debuff is a no-op at the default knob but reduces the target
stat when flipped (the H6c canary, re-homed); snapshot round-trips effects;
determinism.

**Decision points K1:** additive vs multiplicative vs both; stack cap; the
trigger-hook set (on-evade, on-turn-start, on-deploy…) — enumerate from the
known consumers, don't over-generalize; whether effects live on `Unit` (battle
side) or also need a `Run`-side projection.

### K2 — Roster / hand-size decoupling

**✅ DONE (2026-06-10, one commit) — see [HANDOFF.md](HANDOFF.md) + [BALANCE.md](BALANCE.md).**
Starting roster **5 → 10** (6 merc + 4 ranged) and `handSize` **5 → 6** (the user's
call — bigger than the minimal nudge). The decouple exposed a **latent H5 wave-size
bug**: `rollEnemyWave` sized the enemy COUNT off the whole roster, not the fielded
`min(roster, handSize)`, so a 10-roster faced `swarmMax × 10` enemies vs a 6-card hand
(the "massacre"). Fixed + the band re-swept: `enemyArcherRatio` hoisted to config (0.4
→ **0.3**), **`budgetFactor 0.625 → 0.75`**, **`swarmMax 1.75 → 2.0`** (best-achievable
~63%, weak bots ~0%). Coarse + provisional — re-swept in N2. No snapshot bump (existing
fields). **NEXT = K3 redraw** (now meaningful: you bench 4 of 10 each turn).

**Shape:** redraw is **redundant while `handSize` == starting roster** (you
always draw your whole roster — nothing to redraw *into*), which the brief
calls out. Adjust the relationship so a draw is a genuine subset. Recommended:
**raise the starting roster above `handSize 5`** (keeps the H5 "cliff"
reasoning — `handSize 5` flips the deck "on" — and makes redraw immediately
meaningful) rather than shrinking the hand. Knobs already exist
([config/deck.json](config/deck.json) `handSize`; the starting roster is the
run-config / recruitment default).

**Cost:** balance lever (changes draw variance + the `playerTeamLevel` =
`avgLevel × min(roster, handSize)` product) → fuzz baseline shifts; re-confirm
in Phase N's sweep. No snapshot bump (sizes are existing fields).

**Decision points K2:** which dial moves (recommend starting-roster up); the
exact sizes (by feel + the Phase N sweep).

### K3 — Redraw mechanic

**Commit 1 ✅ (2026-06-11) — the Run-side mechanic (headless).** Design locked
with the user: **one batch per turn** (`redrawsPerTurn 1`) with a separate
`maxCardsPerTurn` dial (shipped 6 = `handSize`, i.e. arbitrary selection) so
Phase L daemons can flip EITHER mode; available every turn (`enabled` is the
static gate); pre-turn auto-advance to be REMOVED in commit 2. Shipped: the
`config/deck.json` `redraw` block; pure rules in [redraw.ts](src/run/redraw.ts)
(config-injected so both modes are provable); the `redrawCards` RunCommand
(phase-gated to `turn-intro`, positions refill in-place ascending, discard-first
so the reshuffle cycle preserves hand size); `turn:starting` carries
`RedrawAvailability` + new `turn:handRedrawn` event; RunSnapshot **v12→v13**
(the per-turn budget counters). The deployment-counter rule fell out free as
predicted (redraw resolves before `beginTurn` records the final hand) — pinned
by test. 842 tests (+20), fuzz:smoke 117 unchanged.

**Commit 2 ✅ (2026-06-11) — the PreTurnScreen UI.** Auto-advance REMOVED (the
screen waits for Fight; post-turn keeps its timer); selectable cards + a
`Redraw (N)` button + budget hint; re-renders purely off `turn:handRedrawn`
(scene-scoped subscription). Browser-verified end-to-end by eval (screenshot
capture blocked by the known throttled-tab limitation). 842 unchanged — UI
only.

**Commit 3 ✅ (2026-06-11, the dedicated session) — the fuzz redraw policy +
proof. K3 COMPLETE.** The design round locked four calls (scored objective
variant now; redraw policy = scored-vs-pool-mean + threshold with discrete
baselines; map-awareness = measure first; split the fuzz CLI first), landing
as three dev-only commits (zero `src/`; fuzz:smoke 117→157): the `commands/`
CLI split (`7db5100`), the scored objective proclivity + arena `--vectors`
search (`5043468`), and the redraw policy itself (`b32809e`) —
`none|random:k|level:k|scored` in [redrawPolicy.ts](tests/fuzz/redrawPolicy.ts),
driven through the H4b turn gates by the harness (the `level:0` gates-on
control ≡ headless, pinned), with `--redraw` on run/search/sweep + the
ShardJob. **Proof (BALANCE.md K3c3 entry):** naive-policy lift is small
(`level:2` best at +6 wins/100; `random:2` loses ~1.2 floors — tossing has
real cost); the map-signal experiment found a huge comp×map interaction
(strafingFunnel/spiralFireLife flip to ranged while the rest favor melee) →
**map-aware scored-policy terms are measurement-justified**, banked as a
follow-up (the axis is per-layout, not a simple openness scalar).

**Shape (brief):** at the start of a turn, the player **selects some drawn
units, sends them to the discard, and draws that many fresh units.** Support
**arbitrary selection** *and* an **overall cap** on redraws. Configurable
*when* it's available (every turn / first turn of an encounter / etc.) — that
gating is **daemon-driven (L)**; ship a static default here. A new pre-turn
input on the `PreTurnScreen` (the hand is already shown there since H5b).

**The discard rule (user-confirmed):** a unit discarded via redraw **does not
count toward the deployment counter** (H3's fatigue hook) — it never fought
that turn, so it accrues no deployment count / fatigue stack. Mechanically this
is free: redraw resolves on the pre-turn screen **before** `recordDeployment` +
the H6c spawn-time fatigue bake (the `beginTurn` seam), so only the *final*
fielded hand is counted, and a redrawn-away `rosterIndex` simply isn't in that
hand. (A unit redrawn away this turn stays eligible to be drawn — and then
counted — in a *later* turn.)

**Cost:** deck/discard manipulation on `Run` (the H5 piles); snapshot already
carries the piles (no bump unless redraw adds persistent per-turn state).
Fuzz: a redraw policy (which/when to redraw) — needs a strategy hook + an
arena/short-run proof.

**Headless tests:** redraw moves N cards to discard + draws N (respecting the
draw/reshuffle cycle); the cap is honored; **a redrawn-away unit gets no
deployment count** (its `deploymentCounts[idx]` is unchanged that turn, while a
fielded unit's increments); determinism.

### K3.5 — One map per encounter (+ pre-turn map label)

**✅ DONE (2026-06-11, one commit) — an unplanned step from the K3 commit-2
playtest.** The user's observation: redraw is a **blind guess** when the map is
rolled after the pre-turn screen — and thematically an encounter should be one
continuous fight on one field anyway (the eventual encounter-system direction).
The "easy" fix (just show the layout name) wasn't actually easy: the map roll
lived in `beginTurn`, AFTER the gate, and peeking ahead would break the
fork-at-`beginTurn` determinism invariant — so any label needs the roll hoisted
ahead of the gate, at which point per-encounter is the same work as per-turn.
**Hoisted now rather than waiting** so N2's balance sweep measures the final
map model instead of being invalidated later.

**Shipped:** `rollEncounterMap` rolls layout/size/terrainSeed/theme ONCE in
`beginEncounter` (dedicated `rng` fork; same draw order + always-roll-then-
override branches as the old `beginTurn` block; `forcedLayoutId` still wins) →
stored as `Run.encounterMap` (null outside an encounter; **RunSnapshot
v13→v14** — not re-derivable per turn, so v13 rejects). `beginTurn` keeps only
the per-turn freshness: `worldSeed` + the enemy wave re-roll. `turn:starting`
carries `map` (layoutId/dims/theme); the PreTurnScreen shows `⌖ <name> — W×H`
(authored layout `name`, or "Uncharted ground" for procedural). The scope is
deliberately MAP IDENTITY ONLY — the real encounter system (enemy roster
diversity, bosses) stays Phase L+.

**Cost (measured):** the RNG restructure + map persistence shifted the fuzz
read — see BALANCE.md (K3.5 entry) for the re-measure; the K2 band note now
reads easier-than-target at the same knobs. Band re-tune deferred to N2 as
planned (the K-mechanic buffs were always going to move it).

### K4 — Empower mechanic

**✅ DONE (2026-06-11, three commits) → PHASE K COMPLETE — see
[HANDOFF.md](HANDOFF.md) + [BALANCE.md](BALANCE.md) (K4c3 entry).** Design
round locked four calls, all on the recommended path: **unit-only pick** (the
command is `empowerUnit { handIndex }`; the ACTIVE buff comes from config —
exactly the L-daemon shape, where the daemon supplies the buff), **universal
offense default** (+4 STR / +4 RNG / +4 MAG in one `empowered` effect — each
archetype only reads its own damage stat, so no dead picks), **stacking**
(merge `add`: re-empowering magnitude 2 → +8, the invest-in-a-carry model),
**full K3c3-mirror fuzz policy**.

- **Commit 1 — the Run-side mechanic (headless).** `config/empower.json`
  (`enabled` / `empowersPerTurn 1` / the buff) + pure rules in
  [empower.ts](src/run/empower.ts) (config-injected, both budget modes
  provable); the `empowerUnit` RunCommand at the `turn-intro` gate →
  `addEncounterEffect` (the K1 store — live the turn it's granted, survives
  redraw-away/benching); `turn:starting` gains `empower` availability + the
  `empowerMagnitudes` badge column, new `turn:unitEmpowered` event;
  **RunSnapshot v14→v15** (the per-turn counter). 867 tests (+19).
- **Commit 2 — the PreTurnScreen UI.** Empower shares the K3 card selection
  (exactly-one selected enables **Empower ▲**); per-stack `▲` badge; the hint
  derives from `EMPOWER.buff.mods` (never hardcoded); events-only refresh.
  Browser-verified end-to-end (live World unit folded str 9→13).
- **Commit 3 — the fuzz empower policy + proof.**
  [empowerPolicy.ts](tests/fuzz/empowerPolicy.ts) `none | random | level:hi |
  level:lo | scored` (argmax — empower is free, so the only decision is WHICH
  card; `scored{level:1} ≡ level:hi` pinned by test), `--empower` on
  run/search/sweep + ShardJob, `none ≡ absent` byte-identical pin, the empower
  bot runs AFTER the redraw bot at the gate. **Proof (BALANCE.md K4c3):
  empower is a BAND-MOVING lever** — +21…+27 wins/200 (~4σ) and +1.1…+1.4 avg
  floors on both strategies, an order beyond redraw — and **targeting-
  insensitive** (random ≡ level:lo ≳ level:hi; the stats are the value, not
  the pick; weak evidence carry-stacking saturates). N2 re-sweeps the band
  against it (magnitude/cadence are config data; L can gate it).

**Deferred (logged):** the empowered unit should **stand out more in the UI**
(user playtest call — the card badge is subtle, and the in-battle unit has no
indicator at all). Natural home: the **L/M status-VFX + presentation pass**
(L mints more status effects via daemons; a generic "this unit is buffed"
treatment lands once, there).

**Decision points K3/K4 (resolved):** redraw = one batch/turn + cap 6 (K3);
empower = single config buff, 1/turn, every turn (K4); fuzz = scored-vs-pool-
mean for redraw (K3c3), argmax menu for empower (K4c3).

---

## Phase L — Daemons (relics)

The meta-layer that **gates and configures** the Phase K mechanics — "think
relics from Slay the Spire" (brief).

**L1 ✅ SHIPPED (2026-06-12, 3 commits — DESIGN ROUND LOCKED).** The locked
calls (the design round, 2026-06-12):

- **DAEMON-ONLY GATES** (the user's deliberate roguelite call, *stronger* than
  the original "K defaults as the no-daemon baseline" sketch above): the
  K3/K4 static enables ship **false**; redraw/empower availability is whatever
  the run's daemon grants, full stop. An idol granting neither tool = a run
  without them. "Some runs are just going to be bad… the fun comes from
  adapting your strategy on the fly."
- **The first catalog = FOUR IDOLS** (Roman-statue flavor inside the terminal
  frame — the synthwave blend; unix-daemon naming TABLED as too deep a cut for
  the Windows-only playtesters, revisit with the shop round): **Mars** (+4
  STR/RNG/MAG empower, 1/turn — the K4 buff verbatim), **Minerva** (+2 DEF
  empower, 1/turn, key `warded` — shipped at +4, nerfed same-day after the
  L1c3 measurement found it at +55pp over the control; see BALANCE.md),
  **Mercury** (50%/turn coin → the FULL redraw), **Janus** (guaranteed
  redraw, ≤2 cards/turn — the K3 `maxCards` mode finally shipped live).
- **Acquisition:** one **uniform roll at run start** (a placeholder — the
  user's planned **starting profiles** [roster + daemon] replace pure-random
  later; `RunConfig.daemon` / `?daemon=<id|none>` is that seam).
- **`chance` is a first-class per-turn gate condition** (the user: "a lot of
  daemons will have X% chance to trigger knobs") off a dedicated `daemonRng`
  stream; the current turn's flips persist in the save (**RunSnapshot
  v15→v16** — daemon stored whole + stream + resolved gates).

Commits: (1) headless mechanic (`config/daemons.json` + zod, pure
[daemon.ts](src/run/daemon.ts) `rollDaemon`/`resolveTurnGates` — the K3/K4
validators consume the resolved gates UNCHANGED); (2) the PreTurnScreen
surface (idol banner, daemon-derived empower hint/badge via the extended
`turn:starting` payload, the "idol is silent" chance-denied line — denied ≠
spent); (3) fuzz `--daemon=<id|random|none>` on run/`--search`/
`--balance-sweep` (ShardJob-threaded; `random` ≡ absent pinned) + per-daemon
win/floor buckets (`perDaemonStats`) + the measurement
([BALANCE.md](BALANCE.md) §L1c3).

**Deferred to the daemon-economy round (shop/loot — acquisition first, the
user's call; the sketches are KEPT):**
- The **`battleTrigger` effect vocabulary** (config entries → K1 trigger
  handlers) and the eight banked daemon sketches that exercise it:
  *watchdogd* (evade → +1 SPD 10s — the brief's literal example), *oom-reaper*
  (kill → stacking +2 offense eot), *firewalld* (takeHit → stacking +1 DEF
  eot), *panicd* (friendly death → team +2 POW 15s), *niced* (first
  deploy/encounter → +2 offense that turn), *healthd* (turnStart → +N health
  pool — needs the one NEW primitive, pool mutation), *forkd* (2
  empowers/turn), *bufferd* (redraw as N singles across actions). The K1
  trigger dispatch already exists and is tested; the daemons.json zod union
  just grows a variant. Unix names ship with descriptive subtitles so the
  reference is a bonus, not a prerequisite.
- **Multi-daemon composition** (one daemon per run can't conflict; per-gate
  override semantics don't paint us into a corner).
- **DoT / stun status primitives** (periodic damage + action-denial — the K1
  system is stat-mods only) when their first consumer lands; **roster
  removal** (no plumbing today; deck piles hold roster indices, so the
  between-encounter splice is the cheap seam); the **daemon-LIST HUD** (one
  daemon needs only the banner; the list folds into the Phase M presentation
  pass).

---

## Phase M — Progression & presentation polish

The leveling-cadence change + the cluster of UI/scene/maps feedback. Lower-
risk, mostly independent, several items eyeball-verified.

### M1 — Per-turn leveling cadence

**Shape (brief — "level up between skirmishes, not just battles"):** today XP
banks across an encounter and pops **one** `PromotionScene` at encounter end
(H4a). Change to **promote between turns** — bank a turn's XP and resolve
promotions at the turn boundary (the `turn-outcome` gate is the natural seam,
H4b). Units re-field at full HP each turn (no-attrition model), so a mid-
encounter level-up simply means later turns field stronger units — clean
texture, no attrition conflict.

**Cost:** restructures *when* `bankXpAwards` / `PromotionScene` fire in the
`Run` encounter loop — a real orchestration change, but the H4b turn gates
already exist to hang it on. **The leveling *rate* (how rare levels are) is
NOT touched here — that's N3** (tune-against-stable-baseline). Cadence alone
already helps the "too rare" feel by surfacing levels more often.

**Headless tests:** XP banks + promotes at each turn boundary (not only
encounter end); a multi-turn encounter produces multiple promotion
opportunities; the no-attrition full-HP re-field still holds; determinism;
snapshot mid-encounter with pending per-turn XP round-trips.

### M2 — Level-up screen redesign (juice + less at once) ✅ (2026-06-12)

**Shape (brief):** the `PromotionScreen` "presents too much information at
once" and "needs some juice." Redesign for progressive disclosure (reveal
stat gains with animation/sequencing rather than a wall of deltas) + visual
polish. Render-only; browser-verified. Pairs with M1 (more frequent, so it
must feel good) and M3 (it stops auto-advancing).

**Landed (design round + one playtest revision):** cards pop in staggered
(scale-overshoot entrance), each landing in its PRE-level state — old
level, old stats, all rows dim amber. Reveals are **two-phase,
card-by-card** (the playtest revision — the round originally locked a
cascading pipeline, but cards revealing while others landed drew the eye
to multiple units at once): every card lands first, then cards reveal
**strictly one at a time** — the **level value ticks first** (Lv N → N+1,
stays green), then each grown stat turns green and flips old→new with a
**`+N` chip** (clean resting state — no `6 → 7` arrow; the animation
carries the story), a **healtick blip** per beat; the actively-revealing
card carries a brightened border (`.is-revealing`) so the focal point is
explicit, with a breath (`CARD_HANDOFF_MS`) between cards. The user also
slowed the cadence in playtest (400ms beats). **Click anywhere skips** to
the fully-revealed end state (audio muted on skip); Continue is always
enabled — with M1's per-turn cadence the player is never trapped. Timing
constants live in `PromotionScreen.ts`; the visual states + transitions in
`ui.css`. Render-only — no sim/run/snapshot/fuzz impact; browser-verified
(timestamped DOM traces pinned both the original cascade and the two-phase
revision — at most one card ever `.is-revealing`; skip + end state + zero
console errors).

### M3 — Scene polish: kill auto-progression + turn fade-in/out ✅ (2026-06-12)

**Shape (brief):** (a) **remove the auto-progression** between the pre- and
post-turn (skirmish) scenes — the H4b `PRETURN_AUTO_MS` / `POSTTURN_AUTO_MS`
timers become **player-driven advances** (the "Fight" / "Continue" affordances
already exist; drop the auto-timer). (b) Turns "start and end too abruptly" —
add a **unit fade-in at turn start** and a **brief after-turn pause** before
the scene change (the fade channel exists — the D5.C / `bloomIntensity`
alpha-fade machinery).

**Landed:** (a) the post-turn auto-timer is GONE (`PostTurnScreen` advances
only on Continue; pre-turn lost its timer in K3 — turn pacing is now fully
player-driven). (b) **Turn-intro materialize**: initial combatant placements
ride the D5.C fade channel (walls/neutrals still pop — scenery) over a new
`turnIntroSeconds` knob in `config/spawn.json` (0.8s), while `BattleScene`
holds the sim clock for the same window — units fade in, one breath, THEN
combat starts. The hold counts REAL dt (fast-forward doesn't shorten it) and
only delays when ticking *starts* — the tick sequence is untouched.
**After-turn outro**: Game defers the `turn:resolved` → `PostTurnScene` swap
by `TURN_OUTRO_MS` (900ms, a Game.ts const) so the final board lingers
(death fades + hitsplats drain — `World.tick()` no-ops once ended, so the
clock spins harmlessly); any direct swap cancels the deferred one.
Presentation-only — zero sim/snapshot/fuzz impact; browser-verified
(driven-tick probe: tick 0 through the hold then ticking, all 13 combatant
fades running at mount; outro: scene stays BattleScene through the window,
no auto-advance after 4s, Continue still advances).

### M4 — Battle backdrop (board not floating in space) ✅ (2026-06-13)

**Shape (brief):** "the battle layouts just hanging in space doesn't look
good." Add an environment/backdrop/frame behind the board so it reads as
*placed*, not floating in the void. Render-only; browser-verified. **DESIGN
ROUND** on the look (skybox? framed diorama? ground plane extension?).

**Landed (design round → the user's own apron proposal = the ground-plane
extension branch; commits `24297ab` + the `b86da92` playtest revision):** a
2-tile non-playable **apron** ring continuing the board outward, fog-faded
into a **mist floor**. (1) [ApronRenderer.ts](src/render/ApronRenderer.ts) —
a SEPARATE prism-ring mesh (board buffer + canonical terrain shader
untouched; `pickCell` raycasts the board mesh only, so the ring is
unclickable by construction; render-only, the sim never sees these tiles).
**Clamp-to-edge tile sampling** (the user's call): each ring tile copies the
nearest playable tile's kind, so the river flows out into the mist and fire
keeps flickering — walls don't extend (they're entities; a wall *ending*
looks natural). Heights via the live `TerrainRenderer.heightAt` (the
fixed-seed simplex continues coherently outside the board) + the exported
`topColorFor`/lighting consts → canonical-by-construction. `APRON_TILES = 2`
is THE width knob. (2) The fog is **color math, not transparency** — a
rect-SDF distance fade in the apron's own shader, with a summed-sine
**creep** so the mist edge breathes (`uFadeEnd` shortened by the creep
amplitude so the rim never ghosts); smooth fade is the default (the Bayer
**dither** read out of place — nothing else dithers yet — so it ships off,
`setDither(true)` keeps the A/B). (3) A near-black **edge band** on the
apron's innermost ~0.12 tiles = the strong playable-boundary read. (4)
[BackdropRenderer.ts](src/render/BackdropRenderer.ts) — a 600-unit noise
**mist floor** plane at `BOTTOM_Y` (two-octave value noise calming to the
flat background with distance → no seam at the plane edge or any ultrawide
horizon); the apron's fog target is the shared `fogColorAt`
([shaders/fogcolor.glsl](src/render/shaders/fogcolor.glsl), one copy
TS-concat-prepended to both frags) sampled where the **view ray** meets the
mist plane, so a fully-fogged apron tile is pixel-identical to the mist
behind it — the board dissolves INTO the mist. Zero sim/snapshot/fuzz
impact; pixel-probe verified (screenshots time out under tab-throttle).
**Playtest follow-up (2026-06-13):** the user spotted an intermittent
"double edge" at the mist's outer reach — diagnosed (frozen-sim,
advance-only-`uTime` rim scans) as the **creep** (the only edge that moves;
no static brightness step at the apron→plane boundary = the plane is aligned
by construction, the two `uTime`s advance in lockstep and can't drift) seen
folding at the grazing 45° pitch — benign, kept as-is. Tuning levers if ever
wanted: `MIST_AMPLITUDE` / calm radii / drift coeffs (fogcolor.glsl),
`EDGE_BAND_TILES` (apron.frag.glsl), `APRON_TILES`.

### M5 — Layout-editor auto-edit ✅ (2026-06-13)

**✅ DONE (2026-06-13, three commits `928ad60`+`4496042`+`968f69b`) — see [HANDOFF.md](HANDOFF.md) for the as-built record.**
The layout editor now writes straight into `config/layouts.json` via the dev-only
`/__save-config` endpoint I4 built (it already allowlisted `layouts.json` — zero server
work). Commit 1 = a node-safe [format.ts](tools/layout-editor/format.ts) (whole-array
`formatLayoutsJson` + the single-entry snippet) + a byte-for-byte/schema-round-trip test
([tests/tools/layout-editor.test.ts](tests/tools/layout-editor.test.ts)), with `layouts.json`
normalized to canonical 1-per-line (whitespace-only, data-identical) so one formatter
reproduces it; `LayoutsSchema` exported for the round-trip. Commit 2 = the **Save to config**
button — a new id appends, an existing id overwrites IN PLACE behind a `window.confirm`
(array order preserved); the whole merged file is POSTed through the formatter
(`LayoutsSchema.safeParse` gates it); the Vite-reload-on-save is masked via a sessionStorage
restore so a save feels seamless. Commit 3 = square editor cells for non-square grids (cell
side = `min(width-fit, height-fit)`, user request). Dev-tooling only — no sim/snapshot/fuzz
impact (one `src/` change: the schema export). Browser-verified e2e; clears the way for M6.

**Shape (brief, for reference):** "copying and pasting JSON layouts is slow and cumbersome —
I'd like the tool to automatically edit the layouts." Extend
[tools/layout-editor/](tools/layout-editor/) to **write layouts directly to the
config** (a dev-only save-to-file path — Vite dev-server backed, same dev-only
posture as today; never in `dist/`), eliminating the copy-paste round-trip.
**Do this first within Phase M** — before the M6 map redesign it serves, so the
redesign isn't a copy-paste grind. (Co-located with its consumer rather than in
a batched tooling phase — the project ethos; the archetype editor got the same
treatment in I4, and can share scaffolding with this one.)

### M6 — Maps: floor-gating + water mechanic

**STATUS (2026-06-13 — water ✅ + procedural rework ✅ DEPLOYED + windows ✅; floor-gating DEFERRED):**
- **Water mechanic ✅** (2 commits, the DESIGN ROUND resolved to **"slow + miss
  more"**). `a24f62f` — a **bog-down precision penalty** (`waterPrecisionPenalty`,
  [config/stats.json](config/stats.json)) docks an attacker's `precision` while it
  stands on a `shallow_water` tile, in `World.applyDamage` (occupant-attacker only,
  evadable strikes only; live tile read → no snapshot bump). `a70533d` — the
  **move-duration slow**: a playtest caught that cost-2 water only weighted A\*
  route SELECTION, never the move DURATION; `stepDurationTicks` ([movement.ts](src/sim/movement.ts)
  + the healer's `SupportMovementBehavior`) now scales a step's lockout + render-lerp
  by the destination tile cost (water 2 → 2× the cooldown). Both signed off; both
  shift the water-board fuzz baseline → N2.
- **Floor-gating DEFERRED** (user call): a proper **encounter-system spec** is close
  and will reshape the per-floor difficulty targets, so depth-weighting `rollLayoutId`
  now would just be redone. Revisit after the spec lands.
- **The water *placement* question became a from-scratch PROCEDURAL-MAP REWORK ✅
  DEPLOYED** (user call — "rework procedural maps from the ground up"; 4 commits
  `f2add1c`→`3808657`): the original "puddles on the trunk path" plan couldn't bite
  because procedural walls were a uniform 6%-scatter with no chokepoints. The design
  round **locked a crossbar + divider + noise blend** built around the top/bottom-clash
  topology, prototyped in [tools/mapgen-prototype/](tools/mapgen-prototype/), then ported
  into [proceduralMap.ts](src/sim/proceduralMap.ts) + wired into the procedural path of
  [terrainGen.ts](src/sim/terrainGen.ts) (the uniform scatter is gone):
  - **crossbars** = wavy horizontal walls with fordable gaps (the chokepoint + the M6
    ford); **dividers** = vertical lateral structure; **noise** = SOLID cover clumps +
    low-ground water pools; **point/mirror/none symmetry** for fairness (guards
    symmetry-aware).
  - **Config envelope, not fixed knobs (user design call):** `config/terrain.json#procedural`
    declares per-knob RANGES (uniform, or `center`+`intensity`-biased via a
    uniform↔triangular blend) + weighted discrete choices; each encounter samples a
    `ResolvedMapParams` ([sampling.ts](src/core/sampling.ts) helpers) so maps vary within
    a designer-set envelope.
  - **Half-cover = WINDOWS** (playtest revision): half-cover lives only as `windowChance`
    shoot-through windows in the crossbars/dividers (movement-blocking, LOS-transparent);
    noise cover is solid-only.
  - **`?layout=procedural`** (browser) **/ `--layout=procedural`** (fuzz) force a fresh
    procedural map every battle — the N2 isolate.
  - **NEXT: the N2 band re-sweep** against the final model (terrain strongly moves win
    rates — the K3 comp×map interaction). See [HANDOFF.md](HANDOFF.md) §M6 for the
    as-built detail.

**Shape (ORIGINAL plan — the water half is done above; floor-gating is deferred; the
"give water a real effect, place it where exercised" line grew into the rework above):**
- **Layout floor-gating** (the deferred post-H TODO, now with the brief's
  "random layouts are boring" behind it): `rollLayoutId` picks uniformly
  today, so the hardest open layouts (`junctionAmbush`/`river`/procedural-open
  — ~45% wave-win) can hit a floor-1 roster. **Depth-weight the roll** — ramp
  hard/open layouts in by floor — using the H7c per-layout telemetry as the
  target. Config-driven ([config/nodemap.json](config/nodemap.json) /
  [NodeMap.ts](src/run/NodeMap.ts)).
- **Water gets a mechanical effect** (brief: "water doesn't seem to have any
  mechanical effect"). Today water is decorative (the C1a uniform scatter +
  the unused cost-2 rule, per the TODO). Give it a *real* effect — movement
  slow, an evasion/precision modifier (ties to I1's new stats), or partial
  cover — and place it where it's exercised (cluster toward unit paths, the
  deferred water-bias TODO). **DESIGN ROUND** on the effect.
- The **map *authoring* redesign is the user's** ("I will have to redesign the
  maps" — one-tile corridors are too spawn-dependent); we provide the gating +
  the water mechanic + the layout auto-editor (M5) that makes the redesign painless.

**Headless tests:** floor-gating biases the layout roll by depth
(distribution test over seeds); the water effect fires (movement/combat
modifier applies on a water tile); determinism. Map look = eyeball.

**Decision points M:** how player-driven the scene advance is (M3); the
backdrop look (M4); the water effect + the floor-gating curve (M6).

---

## Phase N — Rogue mobility & balance closure

The "end of round" closers. Everything here either **moves the difficulty
band** (so it must precede the final verify) or **is** the final verify.

### N1 — Rogue mobility ✅ DONE (2026-06-14 — the rogue dash)

**✅ SHIPPED (5 commits `c9520e8`→`6cc7484` + SFX `dc12c9f`→`adebfd2`, playtest signed off.)** The
rogue carries an aggressive-close **dash** — a `movement`-kind ability (the ability config became a
`kind` discriminated union `attack | heal | movement`; the runtime stays flat propose+score,
`AbilityBehavior` never sees `kind`). It leaps up to 2 cells (0.25s motion, DECOUPLED from a 10s
cooldown) toward a target beyond `derived.attackRange`, landing adjacent; rides J2's
`leapLanding`/`walkAlongPath` seam; `rangeForArchetype` EXCLUDES movement so the dash range can't
inflate strike reach; the dash is a first-class `unit:dashed` event (a dedicated `DashAction`,
mirroring `unit:swapped`) so audio + the future VFX hook the leap, not an inferred move distance;
NO snapshot bump (rides the serialized `actionCooldowns`). All knobs are
[config/abilities.json](config/abilities.json)-tunable. **DEFERRED to N2: the rogue re-measure** —
flip it to `weakest` targeting and re-run the H7c forced-roster eval now that the dash makes the
backline reachable. The contingency context below is kept for the record.

**I5 re-measure result (2026-06-09 — [BALANCE.md](BALANCE.md)):** the dodge-tank
re-measure left the rogue **weak**, so the contingency resolves to **build the
gap-closer** (pending the user's standing "repurpose to a future class" option).
The nuance that REFRAMES the ability: dodge *did* fix survivability (the lvl-5
rogue is carry-durable per deployment — `taken/dep` ≈ mercenary's despite far
less CON/DEF), so the rogue is no longer fragile — it's **damage-starved**
(range-1 strike, ~½ the carries' `dmg/dep`, and the free search still won't
recruit it). So **mobility is for REACH, not survival**: close on the squishy
backline so the strike's crit/damage lands, then flip to `weakest` targeting
(disproved for a *range-1* rogue in H7c step 3 precisely because it couldn't
reach). Reconfirm with the user that the ability stays on the rogue.

**Gated on the J2 pathing seam.** Build the dash /
leap / gap-closer **only if** Phase I's dodge-tank re-measure leaves the rogue
weak *and* the user still wants it on the rogue (vs repurposing the ability to
a future class — the user's standing option). It's a new ability + a
**movement-intent** action riding J2's pathing hook; with a gap-closer, flip
the rogue to **`weakest` targeting** ([targetingStrategies.ts](src/sim/targetingStrategies.ts),
the `weakest` strategy already ships dormant) and re-run the forced-roster
eval (the H7c rogue protocol, [BALANCE.md](BALANCE.md)). If the rogue is fine
post-dodge, **N1 drops to a future round** and the band re-sweep (N2) proceeds
without it.

### N2 — Re-sweep the difficulty band

Re-run the H7 sweep (the GUI + `--jobs` search are ready) against the **full
post-I–M combat model** — dodge, subclasses, per-ability profiles, per-turn
leveling, status effects, redraw/empower, **daemons (L1 — the idol roll is the
biggest single lever)**, **the M6 procedural-map rework + windows (terrain
strongly moves win rates — the K3 comp×map interaction)**, and the contingent
rogue change. The current provisional band (`budgetFactor 0.75 × swarmMax 2.0 ×
enemyArcherRatio 0.3`, K2/K3.5-era) **will** have moved; re-find it. Isolate the
new procedural maps with `--layout=procedural`. BALANCE.md's funnel (broad →
medium → heavy) applies. **NB: the leveling curve is now LOCKED at `baseXp 50 /
exp 1.1` (commit `8e37203`) — a playtest-validated feel target, the curve the
band is tuned AROUND. Sweep at 50/1.1; no testing-knob inflation to discount.
N3 (below) is reframed to a consistency check.**

**Cleanup folded in here — unify the turn caps. ✅ DONE (2026-06-15, commits
`cf4913a` fuzz half + `9043cd6` live half).** There were **three independent**
"turn ran too long" caps — the config `maxTurnSeconds` and TWO hardcoded
`secondsToTicks(150)` copies ([harness.ts](tests/fuzz/harness.ts) +
[arena.ts](tests/fuzz/arena.ts)) — AND a discrepancy: the ROADMAP claimed the
in-game cap was "consumed via `Run.resolveAsDraw`," but `resolveAsDraw` had **no
live caller** (BattleScene never enforced it → a stalled live battle soft-locked).
The fix collapsed all three onto the SINGLE config source (`HEALTH.maxTurnSeconds`)
and made the behavior uniform: the harness, the arena, AND the live BattleScene
now all **`resolveAsDraw` at the cap** (chips both pools, the run continues) instead
of the harness alone labeling a cap-hit a run-ending *hang*. The fuzz "hang" now
means **genuine non-termination only** (a World invariant violation; effectively
never produced), and a new `AggregateStats.cappedDraws` (= `winner === 'draw'`)
carries the indecisive-turn signal. **Baseline impact:** byte-identical for any run
that never hits the cap (the common case — hangs were ~0); only formerly-hanging
seeds change (now a draw-and-continue). Browser-verified the live draw end-to-end
(PostTurnScene "SKIRMISH DRAWN", both pools chip, CONTINUE → recruit, no errors).

### N3 — Leveling consistency check (reframed 2026-06-14)

**Reframed from "re-derive the curve from scratch" → a consistency check.** The
curve is now playtest-locked at `baseXp 50 / exp 1.1` (the user raised it `20→50`
off playtest feel; N2 tunes the difficulty band AROUND it). N3 uses the
heavy-stage **XP-flow + levels-by-floor telemetry** to confirm the final N2
difficulty constants didn't distort the level-up cadence — and to catch any
snowball (units out-scaling enemies on deep floors) or fall-behind dynamic. If
the telemetry shows distortion, nudge [config/leveling.json](config/leveling.json)
(XP, thresholds, `xpPerHealing`) and re-confirm the band holds. The rate and the
band can't be cleanly disentangled (each affects the other), so this is a short
feedback loop with N2, not a separate independent pass. (Original framing — the
brief's "leveling is way too rare" at the *rate* level, M1 fixed the cadence —
is now satisfied by the playtest-locked curve.)

### N4 — Overnight verify (+ `--seed-offset`)

> **DEFERRED INDEFINITELY (2026-06-15) — run on a VPS, not locally.** The local box has an environmental `dwm.exe` leak that can fail burst process-spawning over long uptimes ([archive/dwm-leak-diagnosis.md](archive/dwm-leak-diagnosis.md)); we won't risk an unattended overnight run dying partway on a Windows issue we can't control. Hold N4 until a VPS is available.

Land the deferred [TODO.md](TODO.md) **`--seed-offset`** (a true config-overfit
holdout — fresh seed bases never tuned against), then run the **stage-5
overnight verify** (`--search --preset=overnight --jobs=<cores>`) on those
held-out seeds. The skill-gradient target (best-achievable ≈ 2/3, baselines
lower) is BALANCE.md's; confirm the band holds out-of-sample. **This is the
Phase-H/Post-H balance closure.**

---

## Cleanup / chores

Not gated; land any time (several pair naturally with this round's work).

- **Recruit / promotion accent CSS for the new archetypes** ([TODO](TODO.md))
  — now *more* relevant: Phase I adds four melee subclasses, all unstyled
  without it. Fold the recruit + promotion cards together.
- **`power` distinct visual treatment + HUD stat-line crowding** ([TODO](TODO.md))
  — the HUD line (`DEF·MOB·AGI·POW`) gains `PRC`/`EVA` pressure from I1; revisit
  the presentation when the new stats land.
- **`RNG` stat-label vs `rng` reach ambiguity** ([TODO](TODO.md)) — cosmetic;
  may as well resolve during the I1 label churn.
- **Favicon** ([TODO](TODO.md)) — inline-SVG glyph; stops the per-load 404.
- **Dedicated catapult SFX (+ the F3 launch/impact split)** ([TODO](TODO.md)).
- **`.gitattributes`** to normalize line endings (stops CRLF warnings).
- **Bundle chunk-size warning** ([TODO](TODO.md)) — bump the limit or code-
  split three.js if noisy.

---

## What we're explicitly NOT doing yet

- **Font / non-Latin-script support** (the brief's letter-collision fix). The
  four Phase-I subclasses fit distinct ASCII (`M`/`A`/`R`/`B`), so collisions
  don't bite *yet*. **Revisit when the next wave of unit types actually
  collides** — then the brief's "different fonts + non-Latin scripts" (over a
  pre-made sprite sheet, which the user rejects as off-aesthetic) is the plan.
  A FontAtlas/glyph-layer investment, scoped when forced.
- **Enemy-archetype diversification beyond Bandit.** I4 fields Bandit as the
  default melee enemy; rogue/healer/mage/catapult on the enemy side waits for
  "a proper encounter system" (brief) — after the subclass + objective +
  balance work settles.
- **Recruit rarity tiers + floor-weighted offers.** Still parked; the daemon +
  redraw/empower reshape of recruitment lands first, then layer rarity on top.
- **Multi-map / "Regions" + theme-per-map migration.** Single long map stands.
- **A daemon economy** (shop / rewards / multiple-daemon builds). Phase L does
  *one random daemon at run start*; the economy waits.
- **Save/load UI + replay UI.** The plumbing exists (A2); run-loss + long runs
  raise the value, but the load UX waits until the run shape stops moving —
  and it's moving a lot this round.
- **Boss / elite bespoke mechanics.** The boss node is still a tagged regular
  fight (G3).
- **Touch controls** for the camera.
- **An in-game keybinding-rebind *screen*.** J3 ships rebindable hotkeys via a
  config file + defaults; the in-game rebind UI is a later nicety.
