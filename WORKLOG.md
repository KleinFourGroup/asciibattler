# WORKLOG — Round 12 (Push, pull and blink)

Per-phase narrative log (AGENTS "The planning stack"; `process/planning.md`
"The artifacts"): findings, decision rationale, rejected alternatives,
scope changes, playtest verdicts and the checks run land here under the
matching `## Phase N`; the ROADMAP stays a plan. The file holds the phase
in progress: at each phase close it moves to `archive/worklog-phase-N.md`
and a fresh one starts. Round 12's phases before this one are in
[archive/worklog-phase-158.md](archive/worklog-phase-158.md) (the kickoff,
§157, and the pre-step and the design, §158) and
[archive/worklog-phase-159.md](archive/worklog-phase-159.md) (forced
movement, the seam); Round 11's are
[archive/worklog-phase-149.md](archive/worklog-phase-149.md) to
[archive/worklog-phase-156.md](archive/worklog-phase-156.md).

## Phase 160 — the pushers and the bursts

The kickoff's inputs, by pointer: the signed design, `round-12-spec.md`
"Tranche 2A" and "Tranche 2B" (the four newcomers draftable, each also an
enemy in one act-2 or act-3 encounter; the whirlwind a special on the
ronin; the lines the session's drafts, read at the phase's stop); what
§159 hands on (`archive/worklog-phase-159.md`, "§159's close"); ROADMAP
§160; `process/planning.md` "Phase kickoff".

### The kickoff's audit, and the cut put to the user (2026-11-17)

Read at `d42b717c`.

- *The burst on its caster.* A caster-anchored aoe proposes through
  `proposeCasterAnchoredBlast` (`src/sim/effects/propose.ts`), gated only
  on a victim in the blast now; its reach is its radius
  (`engagementReach`), so its carrier closes to the radius; `affects:
  'enemies'` leaves the caster out. No shipped def uses it; synthetic defs
  pin the propose arm.
- *Its look is missing.* The action surfaces no cell
  (`EffectAction.phaseTarget`), and `spawnBurstFx`'s explosion returns
  without one (`src/render/BattleRenderer.ts`, the `explosion` branch), so
  a self-centred burst would draw nothing; the explosion's ring is sized
  for a 3×3 (`spawnExplosion`).
- *The push from a centre.* `from: 'center'` on the `push` op
  (`schema.ts`), the interpreter's origin the blast's centre and a victim
  on it pushed away from the caster (159c); the slide's look and sound
  are §159's, so a knockback needs no render work.
- *A new unit.* `Archetype` is a string (`src/sim/Unit.ts`), so neither
  snapshot bumps. The beasts' commit (`76232d8c`) names the registrations:
  `config/units.json`, `config/abilities.json`, both records in
  `config/fuzz-strategies.json`, the two locale files, the ability
  registry. A draftable adds a base price (`config/prices.json`), a
  prior-table row or a PENDING acknowledgment
  (`tests/prior-table-coverage.test.ts`, rule 1), and every ability a
  description (151e's test).
- *The draft pool is one pool by rarity* (`DRAFTABLE_BY_TIER`,
  `src/run/Recruitment.ts`), not per act. A draftable newcomer changes the
  picks of its tier, so it moves most of the corpus: `--record` at each.
- *Glyphs.* Free letters include d, e, E, k, K, n, N, t, T, x, X; the
  atlas holds 40 of 128 cells. The glyph sampler (144b) draws candidates
  on the real board: `?bp=board-open15_pose-sampler&glyphs=…`.
- *The banshee:* the Wail, an aoe on a target cell at range 4, radius 1,
  panic; enemy-only, in the Bandit Queen (act 3's boss) and the
  banshee-barrow camp. *The ronin:* the katana alone, uncommon, 30; an
  enemy in the Ronin and the Mages, Brigand Champions and the Witch Hunt
  (act 2) and the Bandit King (act 1's boss), so the whirlwind reaches
  act 1.
- *"Snipers slow and heavy"* (the user's guidance for new units, §152)
  is cadence and might: it applies to the grenadier.

**The cut, put to the user.**

- **160a — the glyphs** (`stop`): two to four candidates each for the
  grenadier and the telekinetic in the sampler, beside the shipped glyphs
  they could be taken for, a lean each. No commit.
- **160b — the burst drawn on its caster** (`none`): a caster-anchored
  blast's explosion at the caster's live cell, its ring sized to the
  radius. Exit: a render pin with its planted failure; no sim touch, the
  smoke silent, the corpus unchanged. Its look read at 160g.
- **160c — the grenadier** (`batch`): a draftable ranged unit; the
  grenade an aoe on its target's cell, radius 1, a knockback of 1 from
  the centre, slow and heavy; a line; an enemy in act 2's Artillery
  Company. Exit: a test from the raw config that the foes around the
  centre land one cell out. Predicted: the smoke fires; most of the
  corpus moves (`--record`). Read: its URL; wrong looks like a grenade
  that moves no one, or a grenadier that walks into melee.
- **160d — the telekinetic** (`batch`): a draftable unit whose one
  ability is a burst on itself, radius 1, a knockback of 2, magic; a
  line; an enemy in act 3's Dark Magic Posse. Exit: a test that the burst
  throws every adjacent foe two cells and never its caster. Predicted as
  160c. Read: its URL; wrong looks like a telekinetic that hangs back, or
  foes that never land.
- **160e — the banshee's burst** (`batch`): the Wail anchored on the
  banshee, radius 2, the panic kept; still enemy-only. Exit: a test that
  it panics foes within two cells of the banshee and no farther.
  Predicted: the corpus moves only where a banshee fights. Read: a URL
  with banshees; wrong looks like a banshee screaming from afar.
- **160f — the ronin's whirlwind** (`batch`): a second ability on the
  ronin, a burst on itself at radius 1, strength, on a longer cooldown
  and over the katana's priority. Exit: a test that it hits every
  adjacent foe and the katana swings between. Predicted: the corpus
  moves where a ronin fights or is drafted. Read: its URL; wrong looks
  like a whirlwind with no one beside it, or no katana between.
- **160g — the play** (`stop`): the four in play, the push's distance and
  feel on units in play, the bursts' look and sound, the drafted names,
  lines and numbers, rarities, prices and encounters.

**Leans built on, listed at the reads:** the grenadier uncommon on the
archer's stat line with the slow, heavy cadence; the telekinetic rare on
the mage's; the whirlwind firing with a single foe beside the ronin (no
minimum count, since the schema has none); sounds reused (the grenade
the catapult's impact, the bursts the bolt's, the whirlwind the melee
swing), a new cue only where 160g asks. The priors: a PENDING
acknowledgment for each newcomer, measured at §162's board.
