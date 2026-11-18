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

**Signed** ("Signed with all of your leans!"): the cut and its reads as
put, every lean above, and §159's friction candidate on its lean (no new
rule; the `execSync` line added to `process/shell-and-windows.md`, after
a check: `execSync('echo a^b')` printed `ab`). The stretch: 160a's stop
first, then 160b to 160f with their `batch` reads, to 160g's stop.

### 160a — the glyphs, put (2026-11-17)

In the sampler at
`?bp=board-open15_pose-sampler&glyphs=U+00F0,U+00F3,O,n,h,e,c;k,K,h,H,t,U+E004`,
each candidate beside the shipped glyphs it could be taken for (the
officer's `O`, the healer's `h`, the catapult's `c`; the halberdier's `H`,
the tiger's eared `t`, U+E004). All six drew from the shipped faces in the
pane, none refused; the atlas grows by two. **The grenadier:** `ð` (U+00F0,
Latin-1, shipped), a round body with a stroke rising from it, a grenade
and its fuse that is still a letter (the lean); `ó` (U+00F3), the same
idea nearer the officer's `O`; `n` and `e`, plain letters from the name,
near the healer's `h` and the catapult's `c`. **The telekinetic:** `k`,
for kinetic (the lean); `K`, nearer the halberdier's `H`; `t`, rejected
in the lean as the tiger's eared `t` without its ears.

### 160a — the soldiery's radical, drawn (2026-11-17)

**Signed:** `k` for the telekinetic ("I love k for the telekinetic!").
The grenadier's `ð` was turned down as decidedly not ASCII; the user
asked for `g` or `G` with a new radical beside the ears, one that more
units could wear. A hat over the letter was liked and then set aside for
a mark flanking the sides, as the ears do, so any letter in either case
can wear it ("the hat directly above would force us to lowercase only
for all soldiery"). The session's lean, epaulettes at the top corners:
the corner slot then says what kind of unit it is (ears a beast,
epaulettes a soldier), and the two never stack.

**Drawn** in `scratch/160a/` (ignored by git): `radicals/*.svg`, a
`glyphs.json` of trial rows at U+E020 to U+E025, and `build.ts`, which
composes `trial.otf` with the production builder
(`tools/font/glyphFace.ts`); `trial-c.otf` is the copy the sampler
loads. A first pass at a 165-wide, 170-tall board read as quote marks and
dashes at 150 px, much weaker than the ears (180 by 280), so both were
redrawn at the ears' size. The candidates: a flat board with three
strands of fringe (U+E020 `g`, U+E022 `G`), the classic rounded pad with
the same fringe (U+E024, U+E025), and a plain board sloping down and out
(U+E021, U+E023). At 120 px in the pane the sloping board reads as an
acute and a grave accent, rejected in the lean; the flat board reads a
little like a comb. The URL:
`?bp=board-open15_pose-sampler&glyphFace=/scratch/160a/trial-c.otf&glyphs=g,U+E020,U+E024,U+E021,U+E000;G,U+E022,U+E025,U+E023,U+E001`.
The board-size read is the user's: the pane's board was too small to
judge.

**The pick** (2026-11-18): the rounded pad with fringe, on `g` ("I like
the rounded with fringe! And I'm good with g also!"); the trial's U+E024.
The user asked whether the officer should wear it too. Drawn for that
read: the officer's `O` with it (U+E026 in `trial-d.otf`), beside the
plain `O`, `Ö` and `Q`, at
`?bp=board-open15_pose-sampler&glyphFace=/scratch/160a/trial-d.otf&glyphs=O,U+E026,U+00D6,Q;g,U+E024,U+E000`;
at 130 px in the pane the epaulettes sit wide of the letter, beside its
upper half, where the umlaut's dots sit close above it. What a shipped
glyph change touches: the glyph rides in the WorldSnapshot's units (no
player keeps one) and in the promotion screen's event payload
(`src/core/events.ts`), so the corpus's event digests move for runs that
promote an officer; `corpus.ts` allows `--rebaseline` after a replay
mapped back to the old glyph shows nothing else moved.
