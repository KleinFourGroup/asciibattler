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
  - `luck` — crit chance via `min(critCap, luck × critPerLuck)`.
  - `precision` / `evasion` (I1) — the dodge pair. **I2 wired the hit/miss roll** at the `world.applyDamage` chokepoint: a single-target strike rolls `combatRng` against `hitChanceFor(precision, evasion) = clamp(hitChanceBase + precision × hitChancePerPrecision − evasion × dodgeChancePerEvasion, hitChanceFloor, hitChanceCap)` (Fire-Emblem subtractive), drawn AFTER the caller's crit roll (order: crit → miss); a miss deals 0 and emits `unit:missed`. **Only single-target strikes are `evadable`** (melee/ranged basic + the rogue gambit); the mage AoE blast, the catapult shot, and environmental fire/chasm damage are **unmissable** (dodged positionally / not at all). Shipped uniform across all archetypes (base 5 / growth 0.2) so the prc/eva terms **cancel to `hitChanceBase` today** (base 0.75 → a flat 25% whiff for swing); per-archetype identities — the real dodge differentiation — are tuned by feel alongside the I5 subclasses.
  - `speed` — attack-cadence scaling (I1 reverted the GP1 `speed → agility` rename — `agility` had come to read as "dodge chance" once the real dodge stats arrived) via `cooldownScale(speed, speedCdPerStat, speedMinCdScale) = max(speedMinCdScale, 1 − speed × speedCdPerStat)`.
  - `mobility` — move-cooldown scaling (GP1 rename of `endurance`), the same curve on its own per-axis knobs (`mobilityCdPerStat`/`mobilityMinCdScale`). **Signed**: 0 is the universal move-CD baseline, negative is slower (the floor caps only the fast side), so a heavy unit lands around −7 instead of needing a per-archetype `baseMoveCooldownSeconds` override.
  - `defense` (GP2) — flat **subtractive** damage mitigation with a floor: a confirmed combat hit lands `max(STATS.minDamage, rawDamage − defense)`, applied to the post-crit/post-cover number in `world.applyDamage`. Consumed raw (no derived layer). Environmental fire/chasm damage is **unmitigated**. Shipped melee-tanky: melee 4 / ranged 2 / others 0 (subtractive can hard-counter a low-damage attacker — kept modest + the floor honest so chip/AoE isn't gutted).
- **Derived values** (computed once at unit construction time by `deriveStats` in [src/sim/stats.ts](src/sim/stats.ts)): `maxHp`, `critChance`, `attackCooldownTicks`, `moveCooldownTicks`, and `attackRange` (the last is a per-archetype primitive, plumbed through verbatim).
- All stat / derive knobs live in [config/stats.json](config/stats.json) (linear HP-per-constitution, crit cap + multiplier, base cooldowns, scale floor). Archetype baselines live in [config/archetypes.json](config/archetypes.json).
- Archetypes for MVP:
  - **Melee** (`M`): higher constitution + strength, range 1, moderate speed/mobility.
  - **Ranged** (`a`): lower constitution, no strength, ranged damage on the `ranged` stat, range 3–5, moderate speed/mobility.
- E1 ships every unit at its archetype's exact baseStats (no per-stat randomization). E3 reintroduces variety via `simulateLevelUps` (player recruits) and `scaleStats` (enemies), driven by per-archetype `growthRates`.

**Targeting:** Nearest enemy by Chebyshev distance. Ties broken by lowest current HP. Re-evaluated each time a unit's attack cooldown elapses or its current target dies.

**Movement:** A* pathfinding to a cell within attack range of the current target. Units block pathing. If no path exists, the unit waits (1 tick) and retries. Logical move is instantaneous on the tick it occurs; the *visual* sprite lerps from the previous cell to the new cell over a duration equal to the move cooldown, snapping on arrival.

**Combat:** When a unit's attack cooldown elapses and a valid target is within range, `AttackAction` resolves at action-start: it rolls once against `derived.critChance` from `world.combatRng` (a dedicated stream forked from the battle RNG, kept separate from spawn-pick / pathfinding noise), multiplies the base damage (`strength` for melee, `ranged` for archers) by `STATS.critMult` on a crit, and applies the result through `world.applyDamage` (GP2 — the single combat-damage chokepoint shared by all four attack actions), which subtracts the target's `defense` (`max(STATS.minDamage, raw − defense)`) before mutating HP. The `unit:attacked` event carries the resolved (post-defense) damage plus a `crit` flag for downstream consumers (E6's hitsplats colour-code on it). Death is immediate at HP ≤ 0; the sprite plays a brief fade-out shader effect and is removed.

**Win condition:** One team fully eliminated.

## Run structure

**Node map:** A directed acyclic graph generated from the seed. Roughly 7–10 nodes per run, arranged in layered "floors" with branching paths between them. Player starts at the single root, advances one layer at a time, and must reach the single terminal node to complete the run.

For MVP, *every node is a battle node*. Rest, shop, elite, and event nodes are deferred.

**Recruitment:** After each victory, the player is offered a choice between 3 randomly generated units (within the existing archetypes). Each offer is guaranteed to contain at least one melee and at least one ranged option, so the choice is never "stat reroll only." The player picks one to add to their team. Skipping is not an option in MVP.

**Difficulty curve (CHECKPOINT 6, retuned at E1):** The enemy team in every battle is sized at `playerTeam.length - 1`, with composition ~60% melee / 40% ranged. The first battle is therefore 5v4 in the player's favor, but every recruit grows the enemy too, so the team-size advantage stays a constant +1 and doesn't snowball. Enemy `constitution` is scaled by `1 + 0.05 × destinationFloor` — E1 moved the scaling knob from post-derive `maxHp` to the stat itself, so `deriveStats` continues to be the single source of truth for HP. Player and enemy stat baselines otherwise share the same archetype config. E3 replaces this with per-floor `enemyLevelPerFloor` driving a full `scaleStats` pass.

**Defeat:** Full run reset. A new seed is rolled and a fresh map is generated.

## Aesthetic

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
| `NEON_PURPLE` | Reserved for rare/elite content post-MVP |

The palette is **enforced at art-direction time**, not by the shader. The `COLORS` table is the canonical color vocabulary code reaches for (`team === 'enemy' ? NEON_RED : TERMINAL_GREEN`); rendering doesn't post-quantize. The MVP shipped a strict palette-quant pass; B1 swapped it for a vibrancy-clamp + bloom chain after side-by-side testing — it gave smooth glow gradients (which the strict quant fought) without losing the terminal-palette identity.

**Sprites:** ASCII glyphs rendered to a monospace texture atlas at startup, then sampled per-instance on billboarded quads. The shader handles billboarding in the vertex stage. Each unit instance picks its glyph via an instanced attribute.

**Glyphs:**
- `M` `A` `R` `B` — the melee family (I5): Mercenary / Adventurer / Ronin / Bandit
- `a` — ranged unit (lowercase, classic roguelike convention)
- `r` `h` `m` `c` — rogue / healer / mage / catapult (E7)
- `@` — reserved for the player-protagonist concept post-MVP

Color + bloomIntensity per instance are instanced attributes so a single draw call covers all units of all teams (B1.1 selective bloom renders sprites twice — once at natural color into the main framebuffer, once at `color × bloomIntensity` into a separate bloom buffer that's blurred and additively mixed back in — but both draws share the same per-instance buffers). `bloomIntensity` (default 1.0) is a bloom-buffer multiplier *decoupled from visible color*: 0 = no halo (sprite still visible at natural color), 1 = natural halo (blooms iff color crosses the high-pass threshold), >1 = forced glow. Used for attack flashes, charge-ups, elite tier, etc. Lerping 0↔1 smoothly fades the halo without changing the sprite's visible color — future systems (B3 HP bars going from full-glow to dim as health drops, C2 mage charge windup ramping the halo as the ability spools up) reach for this channel.

**Terrain:** A subdivided plane with vertex displacement from seeded simplex noise. Colored in the fragment shader by height and slope using dark palette variants (DARK_FLOURESCENT_BLUE → DARK_TERMINAL_GREEN → DARK_TERMINAL_AMBER). Decorative only for MVP — does not affect movement or combat.

**Post-processing:** `EffectComposer` chain — RenderPass → saturation-clamp → bloom (UnrealBloomPass with a max-channel high-pass) → scanlines → OutputPass. CRT curvature and chromatic aberration are future hooks (drop-in additions).

**Camera:** Fixed perspective, tilted ~45° down with a slight angle so the grid reads as a grid but billboards face the camera cleanly. Non-rotatable in MVP. Camera rotation is deferred along with larger maps.

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
- Rest, shop, elite, and event node types
- Boss encounters at floor ends
- Larger units (2×2 or 2×1 footprints)
- High-level player commands during battle (focus-fire, avoid area, etc.)
- Audio and SFX
- Save/load and persistence
- Camera rotation and larger maps
- Line-of-sight for ranged units
- Terrain affecting movement or combat
- Status effects and abilities beyond basic attacks
- Replay system (the determinism work makes this cheap when we want it)
