# DESIGN.md

The single source of truth for *what* we're building and *why* it feels the way it feels. Architectural and step-by-step concerns live in `ARCHITECTURE.md` and `ROADMAP.md` respectively.

## High concept

A browser-based autobattler with a Slay-the-Spire-style run structure. The player navigates a procedurally generated node graph, choosing encounters; each encounter resolves as a deterministic, tick-based battle on a square grid populated by billboarded ASCII units. The aesthetic riffs on classic roguelikes — terminal palette, monospace glyphs — but presented in 3D with heavy shader work for a "CRT-diorama" feel. Death ends the run.

## MVP scope

The MVP is **two teams of ASCII units auto-fighting on a 12×12 grid, with a minimal node-map shell wrapping the battles**. The point of including the node map at MVP is to validate the loop, not to deliver a full progression system.

Concretely, the MVP includes:

- A 12×12 grid battle arena rendered on procedurally generated terrain
- Tick-based combat at 10Hz with deterministic resolution from a seeded RNG
- Two unit archetypes — melee and ranged — with randomized stats (HP, speed, damage) drawn within archetype bounds
- Player team of 5 starting units vs. an enemy team sized one below the player (CHECKPOINT 6 tuning — see Run structure for the full difficulty rule)
- Smooth visual lerping of units between grid cells (animation duration = move cooldown)
- Nearest-enemy targeting (Chebyshev distance, ties broken by lowest HP)
- A minimal node-map screen between battles — branching DAG of battle nodes only, no rest/shop nodes
- After each victory, the player is offered a choice of one new unit to add to their team
- Full run reset on player team defeat
- HTML/CSS UI overlay: round state, unit roster, basic node-map view

The MVP **excludes** (deferred to post-MVP): shop/economy, synergies/traits, rest nodes, elite/boss encounters, multiple unit sizes, high-level player commands, audio, persistence/save, camera rotation, line-of-sight, terrain affecting gameplay.

## The loop

1. Run starts. A node map is generated from the seed. Player has a starting team of 5 randomized units.
2. Player selects a node from the currently accessible frontier of the map.
3. Battle resolves on the 12×12 grid. Player watches; no input during battle for MVP.
4. On victory: player is offered a choice of one of N randomly generated units to recruit, then returns to the map.
5. On defeat: run ends; a new run is offered with a fresh seed.
6. Run completes when the player reaches the terminal node(s) of the map.

## Battle mechanics

**Tick rate:** 20Hz (raised from the MVP's 10Hz at E3.5). The simulation is fully deterministic given a seed and an initial unit configuration.

**Authoring convention:** all cooldowns, durations, and timers in gameplay code are authored *in seconds* and converted to ticks via the `secondsToTicks` helper in `src/config.ts`. The simulation runs in ticks; the source of truth for balance is wall-clock seconds. Changing `TICK_RATE` re-discretizes the sim but leaves balance intact — a "0.5 s attack cooldown" stays 0.5 s in wall time regardless of tick rate.

**Grid:** 12×12, square cells, 8-directional adjacency (Chebyshev distance for range checks).

**Units:**
- Single-tile, omnidirectional (no facing).
- Block movement for both allies and enemies.
- **E1 stat vocabulary** (replaces the MVP `{maxHp, attackDamage, attackRange, attackCooldownTicks, moveCooldownTicks}` block — see [ROADMAP.md](ROADMAP.md) Phase E):
  - `constitution` — drives maxHp (linear, `HP_PER_CONSTITUTION × constitution`).
  - `strength` — basic melee strike damage.
  - `ranged` — basic ranged strike damage.
  - `magic` — drives the mage's `magic_bolt` damage and the healer's `heal_ally` amount (E7).
  - `luck` — feeds crit. **I6 made crit per-ability**: resolved at attack time as `critChanceFor(ability.critBase, luck) = clamp(ability.critBase + luck × critPerLuck, 0, critCap)` (gated on `ability.critable`), so the firing *weapon* sets the base and luck adds on top — there is no single per-unit `critChance` anymore. **§76e made `critable` UNIVERSAL across damage ops** (every hit can crit; ends the melee-mostly crit era), with one law-pinned exception: DoT *ticks* stay non-critable chip (critting ticks would double-count luck and add stream draws per carrier — shape-lock res. 1, pinned in statuses.test). **§76f lit luck's second seam — status DURATIONS:** hex/wail/molotov afflictions last longer with the caster's luck (capped). The healer's luck stays deliberately dead pending a HealOp widening (worklog §76f).
  - `precision` / `evasion` (I1) — the dodge pair. **I2 wired the hit/miss roll** at the `world.applyDamage` chokepoint: a single-target strike rolls `combatRng` against `hitChanceFor(ability.accuracy, precision, evasion) = clamp(accuracy + precision × hitChancePerPrecision − evasion × dodgeChancePerEvasion, hitChanceFloor, hitChanceCap)` (Fire-Emblem subtractive), drawn AFTER the caller's crit roll (order: crit → miss); a miss deals 0 and emits `unit:missed`. **Only single-target strikes are `evadable`** (melee/ranged basic + the rogue gambit); the mage AoE blast, the catapult shot, and environmental fire/chasm damage are **unmissable** (dodged positionally / not at all). **I6 moved the base hit chance onto each weapon as `accuracy`** (replacing the retired global `hitChanceBase`); with the I1 uniform prc/eva the terms cancel to the weapon's `accuracy`. Per-archetype dodge identities — the real differentiation — are tuned by feel alongside the I5 subclasses + the I6 per-weapon profiles.
  - `speed` — attack-cadence scaling (I1 reverted the GP1 `speed → agility` rename — `agility` had come to read as "dodge chance" once the real dodge stats arrived) via `cooldownScale(speed, speedCdPerStat, speedMinCdScale) = max(speedMinCdScale, 1 − speed × speedCdPerStat)`.
  - `mobility` — move-cooldown scaling (GP1 rename of `endurance`), the same curve on its own per-axis knobs (`mobilityCdPerStat`/`mobilityMinCdScale`). **Signed**: 0 is the universal move-CD baseline, negative is slower (the floor caps only the fast side), so a heavy unit lands around −7 instead of needing a per-archetype `baseMoveCooldownSeconds` override. **§76e de-saturated the curve** (rate 0.15→0.075, floor 0.4→0.3) and re-anchored every catalog base + growth ×2 as an EXACT level-1 cadence equivalence (pathing pins never moved): the top of the range stretches (the floor now lands at mobility 8+) while a low-end point mutes to ~1–2 ticks — an accepted tradeoff (shape-lock res. 2); identity spread lives in the new units (Officer 6 → Halberdier 2).
  - `defense` (GP2) — flat **subtractive** damage mitigation with a floor: a confirmed combat hit lands `max(STATS.minDamage, rawDamage − defense)`, applied to the post-crit/post-cover number in `world.applyDamage`. Consumed raw (no derived layer). Environmental fire/chasm damage is **unmitigated**. Shipped melee-tanky: melee 4 / ranged 2 / others 0 (subtractive can hard-counter a low-damage attacker — kept modest + the floor honest so chip/AoE isn't gutted).
- **Derived values** (computed once at unit construction time by `deriveStats` in [src/sim/stats.ts](src/sim/stats.ts)): `maxHp`, `moveCooldownTicks`, and `attackRange` (the last is the max over the unit's abilities' ranges, plumbed through verbatim). Attack cadence (E5) and crit (I6) are **per-ability**, not unit-derived — resolved at propose/attack time from `config/abilities.json` + the unit's `speed`/`luck`.
- All stat / derive knobs live in [config/stats.json](config/stats.json) (linear HP-per-constitution, crit cap + multiplier, base cooldowns, scale floor). Archetype baselines live in [config/units.json](config/units.json).
- Archetypes for MVP:
  - **Melee** (`M`): higher constitution + strength, range 1, moderate speed/mobility.
  - **Ranged** (`a`; the archetype id is `archer` since §61a — the *stat* is still `ranged`): lower constitution, no strength, ranged damage on the `ranged` stat, range 3–5, moderate speed/mobility.
- E1 ships every unit at its archetype's exact baseStats (no per-stat randomization). E3 reintroduces variety via `simulateLevelUps` (player recruits) and `scaleStats` (enemies), driven by per-archetype `growthRates`.

**Targeting:** Nearest enemy by Chebyshev distance. Ties broken by lowest current HP. Re-evaluated each time a unit's attack cooldown elapses or its current target dies.

**Movement:** A* pathfinding to a cell within attack range of the current target. Units block pathing. If no path exists, the unit waits (1 tick) and retries. Logical move is instantaneous on the tick it occurs; the *visual* sprite lerps from the previous cell to the new cell over a duration equal to the move cooldown, snapping on arrival.

**Combat:** When a unit's attack cooldown elapses and a valid target is within range, `AttackAction` resolves at action-start: it rolls once against the firing weapon's per-ability crit chance (`critChanceFor(ability.critBase, luck)`, I6) from `world.combatRng` (a dedicated stream forked from the battle RNG, kept separate from spawn-pick / pathfinding noise), multiplies the base damage — the weapon's flat `might` plus the scaling stat (`strength` for melee, `ranged` for archers; I6) — by `STATS.critMult` on a crit, and applies the result through `world.applyDamage` (GP2 — the single combat-damage chokepoint shared by all four attack actions), which (for an `evadable` strike) first rolls the weapon's `accuracy` vs the target's `evasion` to-hit, then subtracts the target's `defense` (`max(STATS.minDamage, raw − defense)`) before mutating HP. The `unit:attacked` event carries the resolved (post-defense) damage plus a `crit` flag for downstream consumers (E6's hitsplats colour-code on it). Death is immediate at HP ≤ 0; the sprite plays a brief fade-out shader effect and is removed.

**Win condition:** One team fully eliminated. (§75g nuance: with `blockCampTurnEnd` — shipped TRUE, a 75j feel verdict — a decisive win doesn't land while the winner still has an uncleared *hostile* camp fight open; the battle runs on until the camp is cleared. A passive camp never extends a battle.)

**Camps (§75):** a THIRD, neutral faction — small authored bands (bandit squatters, a ghoul nest, a toll post…) squatting the battlefield, placed by hand-authored layouts (§75) or rolled onto procedural boards from per-theme pools (§81 — below) and resolved per encounter. The design pillars, all user-signed at the 75j verdicts:

- **Passive until struck.** A camp is scenery to targeting until damage lands on a member — then the WHOLE camp turns hostile to the striking faction only (damage is hostility's single source; there is no pre-marked aggression). Camp members idle on a leash-anchored wander (dripping in through a spawn-portal anchor tile) and fight exactly like combatants once hostile.
- **A tactical wager, not a toll.** Fighting a camp is optional side content inside a battle you're already fighting: the wager is tempo and HP against the camp's reward. Kill credit is per-faction — the enemy can wipe a camp and DENY the player its reward (credit denial is the loss; an enemy-killed camp pays nobody).
- **⭐ The CONTINUOUS-VALUE reward rule:** always-on camps pay bits/packets only — never a run-defining reward. Anything a player would feel *obligated* to clear breaks the optionality; event-gated camp encounters are the home for headline rewards (slaver-pen archived as the first concept).
- **The pull (§75j2):** each turn, at a config chance, the ENEMY team is ordered onto a rolled camp's primed member (`engage{neutral}` — the first consumer of the enemy objective system). The enemy's first blow aggros the camp against the enemy, and the fight cascades naturally — battles stop being static two-line affairs without any scripted "AI seeks camps" special case. Rubble-gated camps auto-break (§75k/k2: the route-gating rubble is chipped, gate by gate). **Boss boards are EXEMPT (§83d, user-signed 2026-08-20): the boss-side wave defends the pool, never diverted — a design-coherence call made free by measurement (the §83c bracket read the pull outcome-irrelevant at n=120 either way).** Camps still spawn and aggro normally on boss boards.
- **Identity per-ENCOUNTER, pull per-TURN:** which camp spawns rides the per-encounter terrain seed (re-fighting a node shows the same camp); whether the enemy is pulled re-rolls each turn. Under 77d3's keyed streams the per-turn-identity option is one key index away (`'campSetup', turn`) but stays dormant by the signed verdict.

**Procedural parity — "Uncharted Ground" (§81):** procedural battlefields carry the same content vocabulary as authored ones, flavored by the SECTOR's theme (all knobs config-envelope-dialable, user-signed 2026-08-17):

- **Per-theme tile palettes:** grassland hills/mud · swamp mud + big pools deepening to impassable deep water · tundra ice/deep/hills · desert sand + sparse oases · barren hills/sand · **volcanic hills/sand + SPARSE FIRE** (a deliberate revert of the "fire stays hand-authored" call — too thematic to skip; kept low, never on a ford, volcanic-only). Deep water counts against the obstacle budget and both generator guards drain it to shallow rather than sealing the crossing.
- **Per-theme camp pools + density:** most procedural boards carry a camp (density 35/45/20 for 0/1/2 sites — procedural maps are rare enough to warrant more spice than authored ones). Pools: bandits/toll-post on grassland/barren/desert, ghoul-nest/banshee-barrow on swamp, frost-coven on tundra; **volcanic deliberately EMPTY** until a thematically appropriate resident exists ("nothing lives here" is coherent for the fire theme).
- **Placement fairness:** camp sites roll a mode — symmetric **pairs** and the neutral **mid-band** split evenly, with free/asymmetric placement as a RARE spice (45/45/10) — and always stand off the spawn bands. Which camp a site becomes stays a per-encounter roll (the §75 identity verdict, unchanged).
- The camp dose is structurally independent of terrain (placed last in the roll), so density tuning never re-shapes maps.

**Auras (§76):** a passive radiating buff — authored on the carrying ability's def (`aura: { radius, statusId, affects }`, [config/abilities.json](config/abilities.json)), either a pure aura (Inspire) or a rider on a weapon. Executed by a World pass each tick: every LIVE carrier sustains the aura's status on every live unit within Chebyshev `radius` (footprint-aware), through the same sustain chokepoint as the 27d tiles — so stepping out of range LINGERS the status for its own authored lifetime (the "warmth fades" feel), and overlapping same-status auras top up to one expiry (carrier-order-proof, replay-stable). Renderer legibility (§76g2–g4): recipient status pips + a boundary-mote ring + a radiating square wavefront (the honest shape of the Chebyshev metric), all in the aura status's pip color; how the range shows is a setting since §116: `track`, the default (waves that follow their carrier), or `fill` (motes over the whole area); `fixed` lost the A/B and was deleted with the `__auraFx` console switch. First carrier: the Officer's `inspire` (r4 → `inspired`, +2 mobility, 5s). Scope guards held: no aura stacking policy, no constitution auras.

**Stat identity (§76e/f):** the prc/eva doctrine replaced the uniform-5 era — snipers aim (archer/luminant prc 7), wild swingers don't (bandit 4, ghoul 3), armor can't dodge (catapult 3 / reaver 4 / halberdier 3), robes dodge (casters eva 6, prc growth vestigial — the unmissable-magic identity deliberately keeps caster precision dead). Four §76f archetypes joined the draft pool: **Rioter** `f` (molotov, squishy/dodgy, luck-flavored) · **Gunslinger** `G` (pistol, archer-shaped) · **Halberdier** `H` (reach-2 wall) · **Officer** `O` (rare support — cane + Inspire, the first composed weapon+aura kit). Draftable-only: enemy-side exposure waits for authored encounters (§83).

## Run structure

**Node map:** A directed acyclic graph generated from the seed. Roughly 7–10 nodes per run, arranged in layered hops (node rows) with branching paths between them. The player begins before the map and **selects the root as their first encounter** (a normal battle node — unless the sector authors a starting event, which stamps the root; The Start does since §74i), then advances one hop at a time, and must reach the single terminal node to complete the run.

For MVP, *every node was a battle node*. Since then: **rest** nodes (G3, a non-combat heal/XP), the terminal **boss** node (G3; W1 gave it an authored `kind:'boss'` encounter with the `stages` grammar), scattered **elite** nodes (W2 — an optional, harder, routable detour, `kind:'elite'`), **port** nodes (§50 — the shop dock), and **event** nodes (§74 — below). A sector that authors a **starting event** opens ON it: its root is stamped `event` and the authored beat always plays (the combat-resolve roll is ignored there) — The Start ships one (§74i, a run-opening boon).

**The encounter loop + the chip rule (H4 → §91, the casualty experiment):** every node is an ENCOUNTER of one or more TURNS; each turn is one tactical battle on a fresh board against that turn's wave. Two health pools decide it — the player's run-wide pool (persists across the run, refilled to a floor at each sector seam, §90) and the encounter's own pool (its authored `healthPool`). After each turn the CHIP RULE charges both pools (`health.chipMode`; `src/run/chipRule.ts`); the encounter ends when the enemy pool empties (a clear) or the player's does (the run is lost), or at the turn cap by pool fraction. Two rules exist and both stay live behind config: **survivors** — the pre-§91 rule: each pool loses the OPPOSING side's standing Σ`power` at battle end (a won turn costs nothing; a lost one costs most of the wave); **casualties** — the shipped default since 91e (2026-09-03): each pool loses the power of ITS OWN fallen, so a Pyrrhic win costs, the enemy pool reads as "their strength — every kill removes some", and a player's per-turn exposure is the power they fielded (the pre-turn risk line is a number they can add up from their own cards). `power` is a HEADCOUNT weight fixed per archetype (91b: 1 everywhere, legendaries 2, no growth) that an encounter may OVERRIDE per wave-unit entry (92e, 2026-09-04: a boss "worth 6" so its fall moves the pool, fodder "worth 0.5" so a wipe burns half — the designer's per-encounter lever, the catalog untouched); a summoned unit is a free body in the ledger (91e2: by the `summonedBy` stamp — a conjured ghoul costs its side nothing, a fielded one is a body like any other). A turn the driver's tick cap force-resolves (`'cap'`) ALSO pays `health.capPenalty`'s rule — shipped `survivors` since 91g (2026-09-04, the surcharge): a stall pays its own fallen PLUS the enemy's standing power, so kiting to the cap is never cheaper than fighting; a mutual wipe is the largest casualty turn there is and never reads it. The rule is an EXPERIMENT (encounter-feel-spec, the round's spec): §93 keeps it or rolls the table + defaults back to the `casualty-seams` tag on the user's five-playtest feel verdict, written before the numbers are read. Pacing under casualties = pool ÷ fallen power per turn, so turns-per-encounter is authored through each encounter's pool relative to its wave (the §92 lever; the user's targets normal 2–3 / elite 4–5 / boss 6+). **The pools are presented to the player as MORALE** (94f, user-signed 2026-09-06 — the §93 verdict's thematic fit): "Your Morale" / "Enemy Morale" on every surface (the turn screens, the HUD, the persistent chip, the chip lines, the power tooltip) — the word for a headcount-weighted will to fight that every fallen body erodes; the config keys (`healthPool`, `playerHealthMax`) and the snapshot fields keep their names, since a rename of serialized keys is churn for nothing.

**Map generation (§77 — the braid):** maps are generated as **lanes that braid** — path strands that split and merge (occasionally three ways) as the map widens and narrows — with node kinds placed by per-route quotas rather than per-hop dice. The guarantees are design commitments, signed at 77c and enforced by a permanent 500-seed gate suite: branches don't instantly rejoin (≤25% of pairs per map; measures ~2%) and nearly always offer different content either side; **every first choice keeps shop access** (a port in its cone by hop 5); every map carries ≥1 rest, elite, port, and event; every middle hop keeps a battle; spacing is per-ROUTE (no route sees back-to-back elites; back-to-back events are legal by design); and route composition holds **≈3 events per route** at a ~55–65% combat share. Two accepted quirks, both "occasional wonky map" calls (77e3): rare minimum-width corridor maps run event-light (~2.3), and individual maps may drift visibly left or right — the ensemble is unbiased (the shear gate holds it there) and the flow reads organic.

**Events (§74):** FTL-lineage narrative beats on a flat page map — an event is pages of text + choices; a choice rolls a weighted outcome (effects + a `next`: another page, return to the map, or a `start-encounter` fight, optionally with a pinned reward table). Entering an event node combat-resolves into a normal fight at a fold-routed chance (base 25%) — "sometimes the static is just bandits." Conditions gate choices SHOWN-DISABLED with the requirement visible (a strategy game — players plan). Two authored conventions (user-signed, §74i): **the outcome page** — an event ends on a terminal page that narrates what happened, whose single acknowledging choice carries the effects (a decisive beat, not a silent map-drop; sometimes deliberately broken, but not often) — and **per-run no-repeat by default** — the engine marks `visited:<eventId>` when a page opens and the pool roll skips seen events unless the def opts in `repeatable: true` (light flavor beats). Flag-gated chains ride the run-lifetime flag store (`chainId:key`; eligibility conditions read it — the cadre arc is the shipped three-parter), and `visited:*` itself is readable as a cross-event gate.

**Recruitment:** After each victory, the player is offered a choice between 3 randomly generated units (within the existing archetypes). Each offer is guaranteed to contain at least one melee and at least one ranged option, so the choice is never "stat reroll only." The player picks one to add to their team. Skipping is not an option in MVP.

**Difficulty curve (CHECKPOINT 6, retuned at E1):** The enemy team in every battle is sized at `playerTeam.length - 1`, with composition ~60% melee / 40% ranged. The first battle is therefore 5v4 in the player's favor, but every recruit grows the enemy too, so the team-size advantage stays a constant +1 and doesn't snowball. Enemy `constitution` is scaled by `1 + 0.05 × destinationFloor` — E1 moved the scaling knob from post-derive `maxHp` to the stat itself, so `deriveStats` continues to be the single source of truth for HP. Player and enemy stat baselines otherwise share the same archetype config. E3 replaces this with per-floor `enemyLevelPerFloor` driving a full `scaleStats` pass.

**Starting characters (§63):** three characters — Soldier / Priest / Gambler — each owning a starting roster, a starting daemon, draft-blacklist additions, and within-tier draft weights. The character is the *playstyle* axis of a run. **Design principle (user-signed 2026-07-27, §68d): characters are similar in DIFFICULTY, differing in PLAYSTYLE** — a measured cross-character win-rate gap beyond paired noise (~±5pt at 40 seeds) is a tuning defect to close, never a "hard mode" to embrace. (The Gambler's −6/−5 read is the open case, pending the §68f ronin/reaver buff.)

**Defeat:** Full run reset. A new seed is rolled and a fresh map is generated.

**Saving (§115; Round 8 spec D3):** roguelike saving. There is one run and one slot, and no manual save. The game saves on its own after every choice made outside a battle and when a run starts, because closing the tab is how a web player quits and only an autosave survives that. Opening the game again offers **Continue**, which returns to the screen that was left with the same team, bits and morale; a run's end empties the slot. A battle is never saved in the middle: a tab closed during a fight comes back at the pre-turn screen before it, with that fight already seen. Nothing can be re-rolled by reloading, since the random streams are keyed per occurrence and the same choices give the same results; the edge a reload gives is knowledge only, and it is accepted. A save is refused only when the save format has changed or the save can't be loaded, not on every new build, so a hotfix keeps the runs in progress; a refused save shows a message, and settings and unlocks are kept (no migrations before 1.0). With the game open in two tabs, the first to open owns the saved run; the second says so, can't continue it, and plays unsaved. Where the browser refuses storage the game plays on and says it can't save: a notice on the menu at boot, and a chip (`⚠ can't save`, §UI idioms) on every screen for as long as it is so, which is also how a write that fails in mid-run is told. Two things a load does not bring back, both presentation: the order the deal animated in on the pre-turn screen, and a reward's already-taken rows. Continue and these notices are on the title menu, the boot screen. Quit to menu, in the settings during a run, is a closed tab by another route: the slot is left as it is, so a fight in progress comes back at its pre-turn screen, and a run that can't be saved is lost, which the button's own line says. **The backup (§116; spec D1, D5).** The web store is best-effort, so Settings › Data gives the player the whole of it as one file (Export everything: the settings, the unlocks, the saved run, the finished runs' journals) and takes such a file back (Import a backup), which replaces everything saved here and reloads the game; a second tab can't import, since the saved run is the first tab's. A file that isn't a backup, or is one from another store layout, is refused with nothing changed. The same section exports the journal of the last run that ended (Last run), which is the end screen's Export run for a player who has left that screen. A refused save's run counts as that last run: its journal is exported from the slot while the save sits there, and it joins the finished journals when a new run takes the slot.

**Credits (§116; spec D6):** a static panel, opened from the menu's Credits row: the developer, Claude, the two fonts and the three bundled libraries each with its licence's name, the tools, the two sound tools, and the playtesters thanked without names. Nothing in it moves, so it has no reduced-motion form. The licences' full texts ship beside the build in `THIRD-PARTY-LICENSES.txt`, and the panel's last line says so. A run's end goes to the menu, a defeat and a win alike; the first won run goes there by way of the credits, which open over the menu once (the `progress` section's `creditsSeen`), since a first win is the moment the genre rolls them. A page booted by a run dial ends a run as it did before the menu and shows none.

## Aesthetic

**World identity (locked at the §67 kickoff, 2026-07-26): dark fantasy on a
haunted terminal.** The three threads that felt like a tug are one identity:
fantasy-units-on-a-CRT is the roguelike lineage's native look (Rogue/NetHack
heritage, modernized with synthwave neon), and the run layer's vocabulary —
*sectors, ports, packets, daemons, bits, cache* — is computing language, so
the run reads as a voyage through a machine. The nautical resonance ("port,"
sector charts as sea maps) is a deliberate pun, kept. Sectors shade darker as
the run goes: act 1 is mundane brigand country, act 2 ("The Deep End," swamp)
turns occult — the cosmic-horror *mood* without period technology. Named
deferrals: 1920s-register archetypes (riflemen etc.) are Cluster-5 sector-
identity content, not a rider; the Roman daemon naming keeps fading out.
Rationale: WORKLOG §67-shape-lock.

**Reference palette** (from the user's previous game; serves as the starting vocabulary, not a hard constraint):

| Color | Use |
|---|---|
| `TERMINAL_BLACK` | Background, scene clear color, base terrain |
| `TERMINAL_GREEN` | Player units, friendly UI elements |
| `DARK_TERMINAL_GREEN` | Dimmed/idle player states, terrain tint |
| `TERMINAL_AMBER` | Primary UI (gold, timers, important callouts) |
| `DARK_TERMINAL_AMBER` | Secondary UI, dimmed states |
| `FLOURESCENT_BLUE` | Status effects, ability flashes, neutral highlights |
| `DARK_FLOURESCENT_BLUE` | Cooldown indicators, dimmed FX |
| `NEON_RED` | Enemy units, damage indicators |
| `DARK_NEON_RED` | Low-HP enemy states, defeated states |
| `NEON_PURPLE` | Elite map-nodes (the `*` glyph, W2); rare/elite content |

The palette is **enforced at art-direction time**, not by the shader. The `COLORS` table is the canonical color vocabulary code reaches for (`team === 'enemy' ? NEON_RED : TERMINAL_GREEN`); rendering doesn't post-quantize. The MVP shipped a strict palette-quant pass; B1 swapped it for a vibrancy-clamp + bloom chain after side-by-side testing — it gave smooth glow gradients (which the strict quant fought) without losing the terminal-palette identity.

**Sprites:** ASCII glyphs rendered to a monospace texture atlas at startup, then sampled per-instance on billboarded quads. The shader handles billboarding in the vertex stage. Each unit instance picks its glyph via an instanced attribute.

**Glyphs:**
- `M` `A` `R` `B` — the melee family (I5): Mercenary / Adventurer / Ronin / Bandit
- `a` — ranged unit (lowercase, classic roguelike convention)
- `r` `h` `m` `c` — rogue / healer / mage / catapult (E7)
- `@` — reserved for the player-protagonist concept post-MVP

Color + bloomIntensity per instance are instanced attributes so a single draw call covers all units of all teams (B1.1 selective bloom renders sprites twice — once at natural color into the main framebuffer, once at `color × bloomIntensity` into a separate bloom buffer that's blurred and additively mixed back in — but both draws share the same per-instance buffers). `bloomIntensity` (default 1.0) is a bloom-buffer multiplier *decoupled from visible color*: 0 = no halo (sprite still visible at natural color), 1 = natural halo (blooms iff color crosses the high-pass threshold), >1 = forced glow. Used for attack flashes, charge-ups, elite tier, etc. Lerping 0↔1 smoothly fades the halo without changing the sprite's visible color — future systems (B3 HP bars going from full-glow to dim as health drops, C2 mage charge windup ramping the halo as the ability spools up) reach for this channel.

**Terrain:** One faceted prism per tile, its top at the tile's height (`TerrainRenderer.heightAt`, the one source every sprite stands on). Floor and its variants (hills, ice, sand, fire, healing) share a seeded noise band 0.3 deep; mud sits at −0.25, water at −0.4 (deep water is coplanar with shallow and told by its diagonal bands), a chasm at −1.2. Hills carry low-poly mounds, fire and healing tiles animate in the fragment shader, and a thin grid line outlines every tile. The heights are presentation: movement and combat read a tile's kind, never its height (Battle mechanics). **The terrain draws the ground marks** (Round 7.5, spec D3): each frame, a small per-tile table of marks, one under every body, evaluated as shapes in the terrain's own shader. So a mark lies on tile tops, hangs down the step faces the camera sees, and covers the hill mounds, with the terrain's own depth. The marks are the team-identity channel (**Team identity on the board**, under UI idioms).

**Post-processing:** `EffectComposer` chain — RenderPass → saturation-clamp → bloom (UnrealBloomPass with a max-channel high-pass) → scanlines → OutputPass. CRT curvature and chromatic aberration are future hooks (drop-in additions).

**Camera:** Orthographic, pitched 45° down and turned 45° about the vertical, so the board reads as a diamond (Round 7.5, spec D1; shipped at 107d). Parallel rays make a world vertical draw as a screen vertical on every tile, so a billboard stands upright wherever it is, and the far rows don't shrink: the smallest glyph at fit measured about 1.28× the old perspective camera's (§105). Yaw 0 is out: a pitched board then projects to a rectangle and reads as top-down against upright glyphs. The view is fixed for players: no rotation, pan or zoom. **Fit is the only production view** (spec D7): the whole board framed at any aspect. Scroll mode stays dev-only (Ctrl+Alt+C), and a windowed view, with the minimap and the drag, wheel and touch pan it needs, belongs to the round that builds mobile, its consumer. Yaw and glyph scale are Round 11 accessibility candidates, not settings yet.

## Input accessibility (78e, user-signed 2026-08-14; extended §100, 2026-09-17)

**Keyboard is the fast path; a pure mouse (and eventually touch) must always
be *sufficient*.** Every UI surface needs a clickable route for everything a
hotkey does — a keyboard-only affordance is an accelerator, never the sole
exit. (The rule was signed when the 78e sector-map overlay shipped with only
`M`/Esc to close — an opaque full-viewport view with no clickable way out;
the ✕ button is the corrective precedent.) Audit candidates against this rule
whenever a new modal, overlay, or hotkey lands.

**§100 extends it to the other two channels.** *Hover* is never the sole
carrier of information — every hover read (a tooltip, a hint) also opens on
keyboard focus and on a tap or long-press (the §97 tooltip's three routes);
*keyboard focus* reaches every control: a control is a real `<button>` or,
when it carries interactive children (the cards), a `pressable()` (`role=
"button"` + a tab stop + Enter / Space → its own click, so mouse, touch and
keyboard run ONE code path); an inert control leaves the Tab order by
`aria-disabled`, never `disabled` (a disabled element swallows the hover its
tooltip needs); every `<select>` has an accessible name; every screen takes
focus on present so Tab enters it first, and the chrome column sits AFTER
the screens in the tree so the walk reaches the chips before the browser's
own UI. **The Space rule:** in a battle the registry's hotkeys WIN over a
focused control — Space is pause everywhere, Enter is every control's route
(gotcha #135); yielding Space to a focused button would re-fire the last
clicked one instead of pausing. A rebind (§116) moves the rule with the
key: whichever key an action holds wins, Enter can never be bound, and
Space, once no action holds it, presses the focused control as it does
outside a battle. The one exception is the settings modal
(§116): while it is open the battle is held and the registry is suspended,
so Space presses the focused control, as it does outside a battle. A camera mode is dev-only (Ctrl+Alt+C; fit
is the only production view, "Camera" above) — a shipped binding with no
click route is a bug.
The focus ring is the "Focus (100)" idiom below.

**The per-surface checklist (the Round 7 spec's exit; every row ticked
2026-09-17; re-audited and every row ticked again 2026-09-18, §103, with the 102d run-end body):** *click* =
every action has a clickable control; *keys* = every control is
Tab-reachable and Enter-activatable (Space where no hotkey claims it);
*touch* = every hover read has a tap / long-press route; *hover-only* =
information carried by hover alone; *morale* = the surface's ONE read of
the run pool ("The live bar" below — the chip, the two full gauges, or
none where no run is live).

| Surface | Controls | Click | Keys | Touch | Hover-only | Morale |
|---|---|---|---|---|---|---|
| Menu (§116) | Continue, New run, Settings, Credits (`button()`; Credits is §116j's, read by the user 2026-10-07), the seed field (an `<input>` named by the word Seed; Enter in it is New run), the word Seed (a tooltip text site) | ✓ | ✓ the user's Firefox read 2026-10-04 (the word's tab stop came after it, 116c-post) | ✓ (the word's tooltip: a tap) | none | none (no run) |
| Character select | the three cards (`button`), Back (`button()`, §116) | ✓ | ✓ | ✓ | none | none (no run) |
| Map | frontier nodes (`button`; inert nodes `aria-disabled`), the roster button | ✓ | ✓ 100c1 | ✓ (the boss node's long-press, 97f) | none | chip |
| Pre-turn | the pile + roster buttons, the hand cards (pressable, a toggle), the grant chips, Pass, Fight, the five text sites | ✓ | ✓ 100c2 | ✓ | none | gauges |
| Battle HUD | speed / pause, the four objectives, Fight now, the enemy cards (pressable; an armed pick honoured) | ✓ | ✓ 100c2 (Space = pause) | ✓ (a tap acts; arm Focus then tap) | none | gauges (live) |
| Promotion · Recruit · Reward · Port · Event · Sector cleared | `button()` controls, the recruit cards (pressable), the two swap `<select>`s (`aria-label`) | ✓ | ✓ 100c2 / 100d | ✓ | none | chip (the Event screen too — the spec's §9 question, answered by 96.5) |
| Game over (both variants) | the way out (`button()`: Main menu, or New Run on a page booted by a run dial), Export run; under them the run's seed (the word Seed, a tooltip text site as on the menu, and the number as selectable text); "The fallen": each glyph run with a breakdown is a focusable text site, the table a scroll box | ✓ | ✓ 100d (New Run) · ✓ the table walk, the user's Firefox read 2026-09-18 (every row holds a tab stop, so focus scrolls it) | ✓ (a tap toggles; the table scrolls natively) | none | none (the chip leaves at run end) |
| The cache modal · the roster / picker modal · the sector-map overlay | the 96f shell (✕, Esc, backdrop, the trap + restore), the picker cards (pressable, a toggle) | ✓ | ✓ | ✓ | none | the host's |
| The settings modal (§116) | the 96f shell; a choice's toggles (`button()`, `aria-pressed`), a level's − and + (`button()`) and its slider (a range `<input>` named by `aria-label`), a key per action and Reset to defaults (`button()`; a key waits for a press, and Esc, Enter, Tab or a click calls the wait off), the Palette's two toggles and Reload now (`button()`, disabled while the page is drawn in the palette chosen), the four data buttons (§116h; `button()`: Export everything, Choose file… which opens the browser's file dialog through a file `<input>` that is never shown, Import and reload, Export run; each disabled while it has nothing to do, its row's line saying why), Quit to menu during a run | ✓ | ✓ the user's Firefox read 2026-10-04 (the data rows are unread until the §116 sitting) | ✓ (no hover read; a slider drags natively) | none | the host's |
| The credits panel (§116j) | the 96f shell (✕, Esc, backdrop, the trap + restore); the list is a scroll box with one tab stop, so the keyboard scrolls it on a short window | ✓ | wiring only, in the pane (unread until the §116 sitting) | ✓ (no hover read; the list scrolls natively) | none | none (no run) |
| The chrome column | bits (a read), cache chip (`button`), settings chip (`button()`, §116), map chip (`button`), the pool bar (a read), the can't-save chip (§116i; a read with a tooltip, a text site with its own tab stop, shown only while the store can't save) | ✓ | ✓ 100c1 · 100e2 (the can't-save chip's tab stop is unread until the §116 sitting) | ✓ (the can't-save chip's tooltip: a tap) | none | is the chip |

The pins that hold the rows: `tests/ui-tooltips.test.ts` (zero native
`title=`), `tests/ui-focus.test.ts` (every hover twin + the ring),
`src/ui/pressable.test.ts` (the Space rule's premise), and the literal pin's
empty baseline. A new control is a `button()` or a `pressable()` — a
clickable `<div>` is the one shape this rule forbids.

## UI idioms (Round 7 — the reference; SIGNED 2026-09-18, §103)

The shared shapes every UI surface is built from, and the artifact Rounds
8 (Foundations — the menu + settings) and 11 (Onboarding & Feel — the
tutorial) are checked against. A new surface
reaches for these first; a surface that needs something none of them give
is a reason to extend the idiom, not to hand-roll a second one. Each rule
was written at the close of the phase that built it and the number in its
title is that phase (the narrative: the Round 7 WORKLOG §N); §103 read the
whole against the tree and signed it. The code homes are in
ARCHITECTURE's `src/ui/` tree. With "Input accessibility" above, these are
the spec's seven: the color rule + its grey test (98) · the tooltip rule
(97) · the hysteresis class (101 — the spec's word for layout stability)
· the shells (96) · the input rule extended to hover and focus (§Input
accessibility + 100) · the string rule (Strings) · the team-identity
requirement (103).

**Checking a surface against this.** A rule with a pin is held by `npm
test` — a new surface cannot break it quietly. A rule without one is a
READ, and the read is named here so it is the same read every time:

| Rule | Held by | The read (what no test can see) |
|---|---|---|
| Tokens | `tests/ui-tokens.test.ts` | — |
| Screens · Buttons · Chips · Modals | no pin (`src/ui` is eyeball-only, TESTING.md) | does the surface use the shell, or hand-roll one? a modal: Esc = backdrop = ✕, focus returns to the opener |
| The live bar | `src/run/chipRule.test.ts` · `src/ui/lossFx.test.ts` | morale reads ONCE (the checklist's Morale column) |
| Tooltips | `tests/ui-tooltips.test.ts` · `src/ui/tooltip.test.ts` | is any tooltip the SOLE channel for something to act on? |
| Color redundancy | `rarityDisplay.test.ts` · `statusDisplay.test.ts` | **the grey read:** Ctrl+Alt+G, before and after |
| The colourblind palette | `tests/palette-colourblind.test.ts` (the five identity hues 0.130 apart in every view, as hexes and as drawn; the default palette must fail it) | **the eye,** in the palette: a battle, the map, a camp fight. No test sees a hue, and a simulation is not a colour-deficient player's report |
| Team identity | `groundMarks.test.ts` (the shape per identity) | the grey read on a live board, clause 1 |
| Reduced motion | `tests/ui-motion.test.ts` · `motion.test.ts` · `fxRegistry.test.ts` · `TerrainRenderer.test.ts` | Ctrl+Alt+A: does information survive, does anything still sway? |
| Focus | `tests/ui-focus.test.ts` · `src/ui/pressable.test.ts` | the Tab walk in FIREFOX (the pane wraps where Firefox exits) |
| Layout stability | `tests/font-coverage.test.ts` | the same-run toggle + the box oracle; step zero is a measurement |
| A cast FLIES | `fxRegistry.test.ts` | how the flight looks |
| The fallen GROUP | `fallenSide.test.ts` · `src/run/fallenStats.test.ts` | size the form on a REAL run |
| Strings | `tests/i18n-literal-pin.test.ts` · `tests/i18n-ui-keys.test.ts` | — |
| Input accessibility | the four pins under its checklist | a new surface adds its ROW; a clickable `<div>` is the forbidden shape |
| Sound (104) | `src/audio/eventSounds.test.ts` (every bus event is cued or silent WITH A REASON) · `src/audio/AudioPlayer.test.ts` (every key has its file) | **the ear:** no test hears a cue — is it the right sound, at the right loudness, for the moment? a `candidate` row is an open question, not a decision |

**Tokens (96a/96b).** Every color in `ui.css` is a `--color-*` token from
the `:root` block; the palette's names mirror `COLORS` (`src/render/palette.ts`,
the source of truth — a test pins them equal) at the default palette's
hexes, and the rest are neutral role names (the grays by level, the miss
whites). The palette holds every hue with a name: the thirteen of 96a, the
shades the sheet once kept as its own (`--color-amber-hover`), and the
status and empower hues (§116). An alpha tint is
`rgb(from var(--color-x) r g b / a)`, never a literal triplet, so one
token serves every tint and a second palette is one table: it is chosen by
name at boot, before any module reads `COLORS`, and the tokens it changes
are set on the root element over the sheet's, so the Palette setting
applies on reload. A new hue is a palette name first, with a value in each
palette. Every
`font-size` is a `--text-<px>` token authored in rem against the browser's
16px; a Round 8 text-scale setting sets the html font-size and the ladder
follows. The pins: zero raw hexes and zero literal font-sizes below
`:root`.

**Screens (96c).** A full-viewport DOM screen extends `Screen`: it keeps
its own `show(...)` signature, opens with an explicit `this.hide()`,
builds its root, and `present(el)`s it (the 180ms `screen-fade`); a
screen with its own teardown overrides `hide()` and ends in
`super.hide()`. The HUD is seven independently faded panes, not a Screen.

**Buttons (96d).** `button(label, {className, onClick, tooltip?})` mints
every `<button>` (type · class · label · click; `tooltip` attaches the §97
tooltip with the control's long-press route — never a native `title`); the
audio cue stays in the handler. `.btn--primary` is the walk-on action's look; its three
modifiers name a deliberate delta (`btn--dim` a pass, `btn--exit` the
controls of an end screen, where nothing else can be acted on — the hover
fills it; sector cleared has one, game over two side by side since §114:
the way out (the menu since §116; a new run on a page booted by a run
dial), and the run's journal as a file — `btn--corner` a
viewport-pinned corner control). The menu's rows are bare `.btn--primary`
in one column of one width, and character select's Back is a pass
(`btn--dim`). A site's POSITION stays on its own class.
Secondary buttons keep their own classes until an idiom for them earns
its place.

**Chips (96e).** A page-lifetime chip is `.chip` (the plate) + its own
class, pulses through `chipPulse`, and mounts into the chrome column
(`createChromeColumn`), whose order is CSS `order` (bits · cache ·
settings · map · pool · can't-save). **A hidden chip collapses** — the ones below move
up; bits never moves, cache never hides, the settings chip (§116) is third
and shows whenever a run is live, the map chip is always fourth when
present, the pool chip is display-only, so no click target ever shifts. A chip's modal
or overlay mounts on the page, never in the column. The column passes
clicks through its gaps; the chips take them.

**The can't-save chip (116i).** A fact about the page that the player has
to be told and that can arrive at any moment, on any screen, is a chip:
last in the column, so its coming and going moves no other chip, and shown
for exactly as long as the fact holds. The first is `⚠ can't save`, shown
while the store's last write failed or its storage is refused, at boot and
in mid-run alike; it goes again when a write lands. It says the fact in
words and carries the consequence as its tooltip, so it is a text site (a
tab stop, hover, a tap), a read and not a control, in the destructive red
with the glyph and the words as the channels that survive the grey read.
A write that fails is never a dialog and never stops the run. The settings'
own writes show through the same chip.

**Modals (96f).** `openModal(mount, opts)` is the one shell: a `panel`
(backdrop › bordered panel › title + ✕) or a `viewport` (an opaque
full-viewport host + a pinned ✕). **Esc, the backdrop and the ✕ are one
gate** (`setDismissable`) — a modal is dismissable or it is not, never
half. `onClose` fires exactly once from any route; all teardown lives
there. The modal takes focus on open, Tab cycles inside it, and focus
returns to the opener on close; `role="dialog"` + `aria-modal` are set.
A modal's sounds are its own (`onCloseClick` is the ✕ only; Esc and the
backdrop are silent). **The settings modal holds the battle behind it**
(§116): while it is open the sim and the pre-battle countdown stand still
(`PlaybackSpeed.hold`, apart from the player's own pause, which is as it
was when the modal closes) and no hotkey fires (`Keybindings.suspend`). A
pause would not do: the countdown runs on real time through one and then
starts the fight. The cache modal and the sector map do neither, as before.

**The live bar (96.5).** Morale reads ONCE per screen: the persistent
chip everywhere except the pre-turn screen and the battle, where the two
full gauges are the read and the chip hides (the column collapses). In
battle the gauges are LIVE, driven by a stream of LOSS EVENTS (the model
beside the chip rule's arithmetic, never a re-derivation): a loss fires
at the moment the rule makes it a fact — a casualties loss at the death,
a survivors loss per standing enemy in an end-of-battle sequence, the
cap surcharge as more end events — and each is an ORB (`●` in the paying
side's hue, sized by the loss) flown from the causing unit's card to the
gauge that pays. The bar reacts on the LANDING: the fill stays the booked
pool and a hatched GHOST grows over its leading edge (`33 (−7) / 40`), the
gauge pulses, the landing cue plays scaled with the loss (gain up, pitch
down), and the view shakes for a loss to YOUR pool at or above a fraction
of the max (whose losses shake it is the Screen shake setting, §116: yours by
default, theirs, both, or off). A breathing NOTCH cut from each fill marks the turn's
bound — the pre-turn "at risk" line's number and its enemy mirror — the
most the ghost can reach on an ordinary turn. When the last orb has
landed, a settle beat, then the ghost COMMITS into the fill and the notch
leaves; the after-turn outro is the longer of the fixed beat and that.
No post-turn screen: Game advances the gate itself, and the next pre-turn
screen carries a one-line "last turn" strip (the result, each side's
fallen as glyphs, the loss). Under reduced motion nothing flies or shakes
— the ghost ticks at the event. Every timing and threshold is a UI
constant; a death's card fades to gray as its orb leaves.

**Tooltips (97).** One component, ONE live element (`attachTooltip(el,
content, {touch})`, src/ui/tooltip.ts), the terminal plate at the small
text size, fixed and out of flow so it never shifts layout: above the
trigger's center, flipped below when the top would clip, clamped to the
viewport with the caret kept on the trigger. Four routes: hover (a short
delay, none inside the warm window after a close), keyboard focus when
`:focus-visible` holds, touch, and the `showTooltip` key (`/`, on the
rebindable registry: it PINS the open one so a pointer can leave, closes
a pinned one, or opens pinned on the focused else hovered trigger). Esc,
pointer-leave (unpinned), focus-out, a pointerdown elsewhere, and a
trigger leaving the document close it; the trigger carries
`aria-describedby` while open. **Touch splits by what the element IS:** a
text site (a number, a chip, a strip) TAP-toggles; a control (a button, a
clickable card or node) LONG-PRESSES, since its tap must keep acting, and
the trailing click is swallowed; text nested inside a control inherits the
control's route. Content is a string or a thunk read at every open (a live
label, a rebound key), rich content is a node; `keyedTooltip(text, key)`
ends a hint in `[key]` in the amber accent; a line break in content is a
line. **A tooltip is never the sole channel for information the player
must act on** (the spec's rule): the compact card reads `LV 5` / `1 POW`
in a persistent hint, the `▲` empower chip carries its key's name beside
the triangles, the boss node's copy is on the map banner. Tab stops on
tooltip-only text live where the player has time to Tab (the pre-turn
screen, the run-end table); in a battle the CARDS are the tab stops
(100c2) and the text inside one stays a hover and key read — the
alternative is ~30 stops per fight, and the compact card's persistent
hint shows the numbers; the tooltip only explains them. The board status pip has NO tooltip — the overlay takes no pointer
events, and the compact card's status row is its read; on a unit with no
card (a camp's), the pip's own symbol is (Color redundancy, below). Zero native
`title=` in `src/ui` + `src/render` (a tripwire test).

**Color redundancy (98).** "Never color alone": anything the player must
act on with few categories carries a SECOND channel beside its hue —
shape, text, count, position or border — so the palette is comfort, not
correctness. **The audit is a desaturated screenshot:** a surface that
survives grey survives every colour-vision deficiency; Ctrl+Alt+G (a dev
key, `src/dev/devKeys.ts`) puts `filter: grayscale(1)` on the root so the
canvas and the DOM desaturate together, and every §98 surface was read
under it before and after. The channels as built: **rarity is a count** —
a fixed-width star run on every full-card header (`★☆☆☆` common →
`★★★★` legendary, its own line, the tier name on a tooltip; the compact
battle card has no room and the battle never acts on rarity). **Map node
STATE is a ring shape** — here = a filled disc, reachable = a double
ring, visited = dashed, locked = dotted, none touching layout — and
**node KIND is named** in a bottom-left legend whose swatches share the
board's own selectors (the key cannot drift from the board); the legend
rides the read-only overlay too. **A DoT number carries its kind** — a
prefix glyph (`~` burn · `‡` bleed · `☠` poison · `+` heal, bare strikes)
and the hue from the status table, so pip, card swatch and floating
number draw from one source. **A status is a symbol** — one character per
status, kept in the status table beside its hue and drawn in that hue over
the board pip, in the card's row and before a DoT's number (`~` burn ·
`‡` bleed · `☠` poison · `+` rejuvenate · `*` frozen · `!` panic ·
`⊘` blind · `?` confusion · `↑` emboldened · `»` inspired), so a pip
reads in grey and without a card; a new status picks a symbol no other
holds (`statusDisplay.test.ts`). **Deep water is a surface pattern** — one
static diagonal band per tile in world space across the board and the
apron (the plane stays coplanar with shallow water, §37b); the bands are the
tell, and whether they drift is §99's (below). The five empower hues
satisfy the rule through their TEXT channel (the `▲` chip's name), not a
shape of their own. Team
identity on the board is the ground mark's since §108 (the next paragraph,
as built). Of its two residuals, the panic / blind held tints on the camp /
neutral team colours are answered by the mark's shape (clause 3), and a
card-less camp unit's status pip, hue-only until 116g, by the status's
symbol.

**The colourblind palette (116g).** The Palette setting offers one
alternate palette, and its promise is a number, held by
`tests/palette-colourblind.test.ts`: the five hues the board tells its
bodies apart by (yours, the enemy's, a camp's, stone, cracked stone) are
at least 0.130 apart in Oklab, pair by pair, to normal vision and under
simulated protanopia, deuteranopia and tritanopia, as the palette spells
them and as the canvas draws them (its saturation floor moves a near-grey).
0.130 is the default palette's own closest such pair to normal vision. The
default fails that on four pairs: a deuteranope sees your green and a
camp's amber 0.050 apart, which is why the ground mark's shape, and not
the hue, is the team channel in every palette. Three names carry the
promise: yours is a mint, the enemy's a hot pink, and stone a step darker;
amber stays, since it is also the UI's own colour. Beside them, and not
gated, the cyan moves toward blue (the mint landed on it), seven status
and empower hues are re-picked so that no two of a kind sit closer than
0.070 in any view, and the dark and dim shades follow their hues. A
status's promise is not its hue in either palette: it is its symbol and
its name. The palette applies on a reload, which its row offers.

**Team identity on the board — the requirement Round 7.5 must satisfy
(103).** The one place "never color alone" does not hold yet. Both sides
draw from one glyph pool — a camp bandit wears the enemy bandit's glyph,
`spriteColor.ts` — so on the board the hue is the ONLY tell, and the HUD
card is a second channel only for a unit that has one. The rework is done
when all five hold; the channel's SHAPE is that round's decision, this
says what it must do:

1. *The grey read.* Under Ctrl+Alt+G, in a live battle, a player can say
   whose any unit is from the board alone — no card, no hover. This is the
   §98 audit applied to the sprite layer, and it is the acceptance test.
2. *Per instance, for every identity.* The channel belongs to the unit
   instance, never to its archetype or glyph (the same glyph fights on
   both sides), and it separates all FOUR identities the board draws from
   the sim's three teams: yours, the enemy's, an active camp (a `neutral`
   with a `campId`) and inert scenery — not only the first two.
3. *It survives the held tints.* A held status tint recolours a body for
   its duration, and two of them (panic's amber, blind's stone) ARE other
   identities' hues. The channel reads through any held tint, so it is not
   hue and is nothing a tint can wash out.
4. *Card-less units carry it.* A camp unit has no HUD card (§75h); the
   board is its only surface, so the channel lives on the sprite. (Its
   status pip was the same residual, hue-only until every status got a
   symbol at 116g.)
5. *It does not spend the atlas per team.* The glyph atlas is budgeted
   (`ATLAS_CELL_BUDGET` = 48, 47 cells used at this writing); a per-team
   copy of each glyph is not the route.

The standing idioms bind it like any surface: render-only, never sim; not
motion alone (99); a channel that is a shape passes the grey read by
construction (the 100 ring's argument).

**As built (§108, spec D5): the ground mark.** Every body has one mark on
the ground under it, drawn by the terrain: a circle under yours, a diamond
under the enemy's, a triangle under an active camp's, and a square plate
under inert scenery (walls, cover, rubble). A contact mark is filled dark
and outlined in the body's colour; a plate is a darker square framed in
the body's colour, and its frame is dashed on a destructible wall or
cover, so that tell, until then a stone hue alone, now has a shape too.
Against the five clauses:

1. *The grey read*, the acceptance test, passed: the user, in a live
   battle at §108's second stop (2026-09-25), "incredibly clear". A shape
   survives the grey filter by construction.
2. *Per instance.* The shape comes from the body's team and camp id
   (`markShapeOf`, pinned in `groundMarks.test.ts`), never from its glyph
   or archetype, so a camp bandit and an enemy bandit wear different
   marks, and all four identities have one.
3. *Held tints.* The identity is the shape. The outline's colour is
   `spriteColorForUnit` (team, archetype, camp), which no held tint writes.
4. *Card-less units.* A camp unit's triangle is on the board.
5. *No atlas cost.* The marks are shader shapes; no glyph cell is spent.

A mark fades with its glyph: out with a death, in with a reinforcement.
It stays on the ground when its glyph lifts or hops (the next paragraph).

**Elevation on the board — the requirement a lifted unit must satisfy
(§108, spec D6; signed 2026-09-25).** No unit leaves the ground yet. Round 9's flyer is the
first consumer, and until then the explorer's posed flyer (`pose-flyer`)
is the proof.

1. A lifted unit's glyph rises camera-up, which under the projection is
   screen-up (the lean pin, `tests/board/cameraFit.test.ts`). Its ground mark stays on
   its tile.
2. The gap between glyph and mark is the read. The lift must say
   "elevated" without landing the glyph on a neighbour's: at yaw 45, no
   more than about 15 % of any neighbour's ink covered (13 % measured at a
   lift of 0.45, §106a).
3. The mark alone says which tile.
4. It passes the grey read, because the mark is a shape.

Terrain height is not elevation. A unit on a higher tile stands on its
top, and a move between heights keeps its anchor at or above the surface
it is over (§81c2's profile). A standing glyph is depth-tested upright, so
no terrain behind it cuts into it (gotcha #139). A diagonal move past a
higher corner does not hop over it: at §108's stop 2 the hop fired on a
third of diagonals, mostly by a few pixels, for one case's gain (the
squeeze between two higher side tiles, where upright depth still hides a
little). The movement polish reopens the question once, together with
smoothing the step's vertical motion (TODO).

**Reduced motion (99).** ONE gate, `reducedMotion()` in
src/render/motion.ts — the OS `prefers-reduced-motion` query or an
override (the Motion setting, §116; Ctrl+Alt+A cycles it dev-only) —
stamped on the root as `data-motion="reduced"`, so the stylesheet and
the JS read the same answer; never a `@media` block (a setting could not
flip one). The rule for what goes: **vestibular and decorative motion
stops, information stays.** In the sheet every `animation:` has its
reduced twin under the attribute (a pin fails a new keyframe that lacks
one): an animation something waits on keeps its duration and only fades
(the hitsplat, the exit ghost — a bare `none` never ends and leaks
them); pure-motion one-shots and the infinite pulses go to `none`; a
pulse that means something keeps its colour flash without the movement
(the pile chips). In the fx registry the resolver strips `shake`,
`burst` and `sparkle` and keeps sound, the hitsplat, the held tint and
the projectile / tracer / shove that show WHO hits WHOM. The view shake
and the orb flight are lossFx's own checks of the same gate. The shader
clock HOLDS under the gate (BattleScene's one `advanceShaderTime` site),
so the fire flicker, the healing shimmer, the mist and deep water's
band drift stand still with no shader branch — the diorama goes still
and the units are the only things that move. Deep water DRIFTS for
motion-on players (0.6 rad/s along its diagonal, the same constant in
both shaders, pinned equal): the static bands are the tell, the drift is
the flair. A new motion picks its reduced form when it is authored; the
pins are the forgetful-path guard.

**Focus (100).** The focus state IS the hover state, plus ONE ring. Every
`X:hover` rule in `ui.css` carries `X:focus-visible` in the same selector
list (a pin fails a hover rule without its twin), and one zero-specificity
ring — `:where(button, select, input, [role='button'], [tabindex='0'])
:focus-visible`, 2px solid WHITE at a 2px offset — paints on every control
under keyboard focus only (a click or a tap never shows it; a text field
is the exception, ringed on a click too, since typing follows). White because
it is nobody's state hue (amber is hover, blue is frontier / selection,
green is active), and a ring is a shape, so the 98a grey read passes by
construction. A control whose own `outline` means something (98c's frontier
double ring, the enemy card's hover outline) outranks the ring by design;
the map node's ring rides `box-shadow` instead. `outline: none` is legal on
CONTAINERS only (the 96f modals, the screen root a `Screen` focuses on
present) — never on a control. Controls: a real `<button>` (`button()`, or
inline with `type="button"`), or `pressable()` for one that carries
interactive children; a toggle mirrors its selected class as
`aria-pressed`; an inert one is `aria-disabled` + out of the Tab order.

**Fields (116).** A text field is a native `<input>` named by the word
beside it (`aria-labelledby`). Where the field needs explaining, the word
is a §97 text site and the explanation is its tooltip, with a dotted
underline to say it has one: a line of explanation under the field read as
clutter on the menu (the user's read, 116c-post), and the placeholder
already says what an empty field does, so the tooltip is not the only
channel. Its text is
cleaned as it is typed, so a field has no refused state and nothing appears
under it to say so (the seed field keeps digits; `cleanSeedText`). The ring
covers it, the hover twin is its border, and a key typed in it fires no
hotkey (`isTextEntry`, with the key rules in `Keybindings.ts`). Enter in a
field is the action the field feeds. The first is the menu's seed field.
What a field takes is shown elsewhere in the form the field takes it: a
run's end screen shows its seed under the same word, as text to select.
**A settings row** is a name on the left, with one line under it where the
name alone doesn't say what the row does, and its control on the right. A
CHOICE is a group of toggles (`role="group"`, named for its row), the
chosen one FILLED and mirrored as `aria-pressed`: a fill survives the grey
read, where a green border among amber ones would not. A LEVEL is a native
range `<input>` named by `aria-label`, with a − and a + beside it so every
value is a click away, and its value in a readout of fixed width (the
widest live form, `100%`). A control writes its setting as it changes, the
setting reaches what it sets through `connectSettings`, and a level plays
the click when a move ends, so the new loudness is heard. A KEY is a
button of fixed width that shows an action's key; a click makes it wait,
filled amber and reading "Press a key…", and the next key pressed is the
action's. A key another action holds swaps places with it, and a line
under the rows says what the last change did, since a swap moves a row the
player didn't click. The key rows sit in two columns where the panel has
room, so both rows of a swap are in view. The PALETTE is the one choice
that waits: a palette is chosen as the page boots, so its row stores the
choice and a second row, Apply palette, offers the reload and says what a
reload costs a run in progress; its button is disabled while there is
nothing to apply, and its line keeps two lines' height so no row under it
moves. A DATA row (116h) is an action, not a setting: its control is one
button, and its line says what the button hands over or, while the button
is disabled, why (nothing stored to export, no run ended yet). IMPORT is
the second thing that waits, and it follows the palette: a first row picks
a backup file through the browser's own dialog, and a second, Chosen file,
says what was picked and what importing it costs (everything saved here is
replaced, a run in progress included, and the game reloads) and holds the
button that does it, live only for a file that reads as a backup. A file
that doesn't is refused in that line, with nothing changed; the line keeps
three lines' height. The rows live in the settings modal, a section per
kind.

**Layout stability (101).** A control must not move across its own click.
(The spec and the older notes call this "the hysteresis class" / "the
Y-coordinate hysteresis"; the tooltip is its first member — fixed and out
of flow, so opening one never shifts the page.) The class has three
mechanisms and `tabular-nums` is none of them (both
faces are monospace; it stays on `html, body` as a belt for a future face):

1. *A fallback glyph grows the line box.* Every non-ASCII codepoint the UI
   can render is inside the SHIPPED subset of a SHIPPED face — JetBrains
   Mono, then DejaVu Sans Mono, the ONE fallback (`FACES` / `FONT_STACK`,
   `src/render/fontSubset.ts`); an OS fallback is never the plan. A
   fallback face must fit INSIDE the primary's line (ascent, descent and
   normal line ≤ the primary's in hhea, OS/2 typo and OS/2 win) and keep
   its cell. Both rules are pins in `tests/font-coverage.test.ts`; a glyph
   the primary draws wrong goes in `PRIMARY_EXCLUDES` (gotcha #136). No
   global `line-height` — browsers round `normal` per font-size, a
   multiplier does not.
2. *A value grows by a character.* Reserve the WIDEST LIVE FORM: a fixed
   plate (`--chip-w`), `min-width: Nch` right-aligned (the gauge value), or
   `space-between` with the value pinned to the far edge. Whatever follows
   an element's bottom edge for its life re-measures instead (the battle
   countdown: a `ResizeObserver` + the window `resize`).
3. *A block comes and goes above a click target* — worst on a centered
   column, where a removed child re-centers everything. **The reservation
   idiom:** the block keeps its slot and hides by `visibility`
   (`reserveSlot()`, `.is-reserved`), carrying its REAL content so the slot
   is sized by construction; **a state badge wears the box of the button it
   replaces** (`.reward-taken`, `.port-sold` — same font-size, vertical
   padding, border width); alternatives share ONE grid cell so the tallest
   sizes it (the Event pages, `.event-stack`); a resolved list row the
   player will click BELOW stays, dimmed (the Reward ledger); a panel whose
   body is a list the player deletes from is TOP-ANCHORED, not centered
   (the cache modal). Never a measured `min-height`. A reserved element is
   out of hit-testing and the Tab order by itself, but a hand-rolled focus
   walk must skip `.is-reserved` (the modal trap does).

Deliberately NOT reserved: a disclosure that opens UNDER its trigger, a
whole card row wrapping, the promotion delta chip (a slot would spoil which
stats grow), and a list row leaving from under the pointer that removed it
(Sell, Discard, a fired packet chip — repeat-click-to-clear is the
gesture). The two swap `<select>`s keep `aria-label`: a visible `<label>`
would wrap the row. The proof shape is the same-run toggle + the box
oracle, and step zero is a MEASUREMENT — three of five steps shrank at it.

**A cast that lands at range FLIES (102).** An effect that appears on a
cell away from its caster says whose it is by travelling there: a
projectile on the ability's `release` boundary, its flight the `travel`
phase (the renderer reads the caster's live phase — one clock with the
sim). `travel` is real ticks, carved out of the windup so the impact tick
does not move; a 0-length travel lands the glyph AFTER its burst, so
"launches a projectile ⇒ has travel time" is a catalog-walking pin
(`fxRegistry.test.ts`). One fx key per ability, so a look can change
without touching config. A timeline is SIM config: a carve is proven
byte-identical against a pinned baseline, with a control that fails.

**A list of the fallen GROUPS (102).** One glyph per fallen fits a single
turn (the pre-turn strip); an encounter is many waves and a run is many
encounters, so anything wider groups by archetype (`M×22 a×13`) and puts
the finer grain — per turn, per group — in the tooltip. The cell is ONE
helper for every surface (`fallenSide.ts`): the side in words, the hue
second. The run-end body ("The fallen", both GameOverScreen variants)
words itself as what the ledger records — deaths — never as "the
fights"; its table scrolls inside its own box and the New Run button
does not move (the §101 rule on a list of unknown length).

**Strings.** Anything a shell or factory carries goes through `t()` at
the touch that rewrites the line (the touch-once rule for a shell phase,
§96 kickoff decision C); glyph prefixes and suffixes (`◈ ▤ ◎ ▸ ⚠ ✕`) stay
outside the locale value. Since 100e the literal baseline is EMPTY: every
presentation file is at zero and the pin's absent-means-zero clause holds
the whole layer; a dev console line takes `// i18n-ok`, never a key.

## Determinism

A single seeded RNG instance is threaded through everything that involves randomness: map generation, unit stat rolls, recruitment offers, target tie-breaking. The same seed produces the same run, byte-for-byte. This is non-negotiable from day one — it makes replays, bug reports, and shareable seeds trivial to add later, and it keeps "deterministic spectacle" actually deterministic.

The RNG is *not* shared with anything visual (post-process noise, shader randomness) — those can use whatever they want, since they don't affect simulation state.

## Action timing — the phase system (F2)

Combat actions separate **logical timing** (deterministic, counted in ticks — the sim owns it, authoritative) from **presentation timing** (animation, in seconds — the renderer owns it, free to lead or lag). Each action declares an ordered **phase timeline** — `windup → release → travel → impact → recovery`, all optional / zero-length — and the effect lands on the `impact` phase, not at cast. `World.tick` emits a transient `action:phase` event at every boundary that begins on a tick; the renderer schedules VFX/SFX against it (a projectile launches on `release`, the hitsplat lands on `impact`) without ever driving simulation state. The "locked target died before the effect lands" case is a declared per-action **`OrphanPolicy`** (`commit-at-cast` / `fizzle` / `ground-target` / `re-home`), so elaborate multi-phase attacks become *data*, not new event plumbing.

This is the *timing substrate* for abilities — deliberately **not** a generic status-effect system. Cross-unit persistent buffs/debuffs are a different axis, deferred until a concrete consumer reveals its shape (see [ROADMAP.md](ROADMAP.md)).

## Out of scope (post-MVP backlog)

Captured here so we can confidently say "not now" during the jam without losing the idea:

- Shop and economy (gold, buying units, rerolls)
- Unit synergies and traits
- ~~Rest, elite, shop, event node types~~ ✅ ALL BUILT (rest G3; elite W2; port §50; event §74 — see "Events" under Run structure).
- ~~Boss encounters at hop ends~~ ✅ BUILT (the terminal boss node, G3; W1 gave it an authored `stages`-grammar encounter)
- Larger units (2×2 or 2×1 footprints)
- High-level player commands during battle (focus-fire, avoid area, etc.)
- Audio and SFX
- ~~Save/load and persistence~~ ✅ BUILT (§113 the store; §115 the autosave and Continue — see "Saving" under Run structure)
- Camera rotation and larger maps
- Line-of-sight for ranged units
- Terrain affecting movement or combat
- Status effects and abilities beyond basic attacks
- ~~Replay system~~ ✅ BUILT for a whole run (§114: the run journal replays headless, `npm run replay`, and as a clip, `npm run record -- --journal`)
