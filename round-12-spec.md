# Round 12 Spec — Push, pull and blink

**Status: PROPOSED 2026-11-14, for the user's sign** with the phases §158
to §163 (WORKLOG §157). The intent is the user's, verbatim where it is
theirs, from the Round 8.5 census (A-07), the re-cut (§133c) and the
casualty verdict (§93); what was signed before the kickoff is listed with
its date. The Open section is what the round still has to settle, with
the session's leans marked as leans. The charter is
[META-ROADMAP.md](META-ROADMAP.md) §"Round 12 — Push, pull and blink";
the record is [WORKLOG.md](WORKLOG.md) §157; the plan is
[ROADMAP.md](ROADMAP.md).

## Intent (the user's words)

**Forced movement** (2026-10-12, the census's A-07,
[archive/round-8.5-census.md](archive/round-8.5-census.md)): "Attacks
with a knock back or pull effect are also planned, but I admittedly may
never have mentioned that." And, deleting the unbuilt modes: "07, also
cleared, but yes, let's get those into the plan." A push's distance is
designed with the first knockback (the same census, A-05).

**The consumers** (2026-10-25, the re-cut's first batch,
`archive/post-118-worklog.md` §133, 133c):

> A grenadier unit. Throws a grenade, which causes all units near where
> it lands to be knocked back by a tile or two.

> A telekinetic unit, which fires an AoE burst centered on itself that
> does knockback.

> I was also thinking of reworking some units like banshees to work via
> self-centered AoE, so we might need a way to specify AoE that ignores
> its caster.

The pull: "a special attack for the preexisting adventurer unit." The
teleport: "a ninja unit that teleports to its target. An 'upgraded'
rogue, per se."

**The blade whirlwind** (2026-10-26, the re-cut's third batch): "blade
whirlwind. Melee self-centered AoE."

**The banshees** (2026-09-05, the casualty verdict, item 7a,
`archive/post-88-worklog.md` §93): they "NEED a rework at some point —
'really annoying'". Round 11 retuned the area statuses; the self-centred
burst above is the rework's second half.

**The cavalier** is item #14 of the 2026-08-21 feature list
(META-ROADMAP's Coverage map). No words of the user's for it were found in
`archive/post-83-worklog.md`, `plans/` or META-ROADMAP; the audit of that
day read it as damage on arrival after a dash (`archive/post-83-worklog.md`,
"Cavalier").

**Snipers slow and heavy** (the user's guidance for future units, placed
at §152's kickoff, `archive/worklog-phase-152.md`): it applies to any
ranged unit this round adds.

The dash's visual (TODO's row, surfaced at N1), the corpus's trade rows
and the fire channel's read are the sessions' findings, each signed into
the charter or TODO with its date. The units' lines are the user's to
write (151f, asked 2026-11-02).

## Signed before the kickoff

- The charter, scope, decision points, exit and scope guards (133d
  tranche 2a, 2026-10-26), standing as written at Round 11's close (156a,
  signed 2026-11-13: "Signed! 😁").
- How the re-cut's rounds run (133d tranche 1): each round ends in an
  upload with something a player can meet; each seam ships with a
  headless test, its planted failure and a consumer in play; a round that
  changes combat closes with a board read as paired same-seed deltas
  against the round before, here §155's (BALANCE 2026-11-12, "the closing
  board").
- The corpus's trade rows as a pre-step put to this kickoff (156d,
  2026-11-13); the fire channel read at this round's board, before any
  re-sign, which is the user's (156f).
- What Round 11 hands on: every new ability ships a `description` (151e's
  test refuses one without); a new draftable unit needs a prior-table row
  or a PENDING acknowledgment (`tests/prior-table-coverage.test.ts`, rule
  1); a unit's line stays optional until 151f's test lands.

## The code under the round

Read at `b2e9362e`. Nothing under `src`, `config`, `tools`, `scripts` or
`tests` has changed since 156a's read at `e3e22e09`, so its premises
stand with their files and lines (`archive/worklog-phase-156.md`, 156a).
This kickoff read the occupancy core under them; WORKLOG §157 holds the
files and lines. In short:

- The `move` op moves its caster only (`advance`, `retreat`); nothing
  moves a target. `World.shove` sends a unit to the nearest free cell
  with no direction, and only its own test calls it.
- A step claims its destination and flips onto it partway through; a swap
  exchanges two units at its flip. Both flips write the position they
  planned without asking where the unit stands now, so a push that lands
  on a unit mid-step or mid-swap has to end that action, or the flip
  moves the unit a second time from wherever the push left it.
- Chasm and deep water are impassable, and each sector's layout pool
  holds two chasm maps and two deep-water maps. Walls, cover, rubble and
  trees are units, so a push into one is a push into an occupied cell.
- A step runs its landing tile's enter effects (shallow water douses a
  burn, mud poisons); the dash, the gambit's spring-back and the shove do
  not.
- The dash's landing is chosen and taken on its cast tick, so it needs no
  claim; a teleport with a wind-up would hold its landing across it.
- A leap carries no target (`targetId: -1`), so a damage op after the move
  has nothing to hit: the cavalier's gap.
- No shipped ability anchors an area on its caster. `affects: 'enemies'`
  already leaves the caster out, so N3's flag matters only for a burst
  that touches allies; with `allies` or `all` a caster-anchored burst
  counts its caster as a victim and so proposes on every cooldown.
- `unit:dashed` is heard by the sound registry alone.
- 39 units and 29 abilities. The adventurer is draftable (uncommon, the
  whip alone); the rogue carries the gambit and the dash; the banshee is
  not draftable and fights in one act-3 boss fight (the bandit queen) and
  the swamp's barrow camp. The glyph atlas has 128 cells and uses at most
  40.
- Box time, from Round 11: the prior table's rebuild took 4 h 54 min of
  one `cpx42` at v9 (32.3 CPU-hours); a thin draftable row's `--grant`
  arm about 3.7 CPU-hours.

## Open

The calls, in tranches, with the session's leans; WORKLOG §157 holds the
reasons and both arms of each.

### Tranche 1 (this kickoff)

1. **The spec and the phases:** this spec, and §158 to §163 in the order
   WORKLOG §157 gives (the pre-step and the design; forced movement, the
   seam; the pushers and the bursts; the blink and the charge; the closing
   board; the close), with §158's two steps and their reads.

### Tranche 2 (at 158b, the design stop)

The forced-movement design, each fork with its lean:

- *The op:* a new `push` op that moves the targets its selector resolves,
  away from or toward an origin (the caster or the area's centre), by its
  own whole number of cells; `move` keeps moving the caster. Lean: the new
  op, over two more `move` modes.
- *Direction:* one of the eight grid directions, fixed at the push's
  start from the origin to the victim; a victim on the centre cell is
  pushed away from the caster; no randomness.
- *What stops a push:* the edge, an impassable tile, a unit (scenery
  included) or another unit's claimed cell; the victim lands on the last
  free cell. Chasm and deep water stop it like a wall (lean), against a
  fall that kills or a carry across the gap.
- *Collision:* nothing more when a push is cut short (lean), against bump
  damage.
- *Timing:* the victim's position changes when the op fires and the glyph
  slides (lean, no snapshot change), against holding the victim busy for
  the slide (a new action kind and a World bump). A stagger, if play asks
  for one, is an `applyStatus` after the push.
- *The victim's action:* a push ends whatever the victim was doing (lean),
  against ending only a step or a swap and letting a strike or a spell run
  on.
- *Who moves:* never scenery and never a body larger than one cell (the
  scope guard); a pushed camp member is not hit by the push alone.
- *Several victims at once:* farthest from the origin first.
- *Landing as an entry:* a push, a pull, a teleport and the dash run the
  landing tile's enter effects (lean), the dash's change moving the
  corpus with the round's content.
- *The pull:* the same walk toward the caster, stopping beside it.
- *The teleport:* lands on the free cell beside its target farthest from
  the caster, within the def's range, line of sight not needed, on its
  cast tick like the dash (lean, no claim).
- *The cavalier's hit:* a leap keeps its enemy's id, and a damage op after
  the move hits it only if it is alive and within reach of the landing.
- *`World.shove`:* retired, its `unit:shoved` event kept for the push.

With them, since §160's units rest on them: which new units are draftable
(lean: all four, each also an enemy in one act-2 or act-3 encounter); who
carries the blade whirlwind (a new unit, or a special on the ronin); N3's
flag and its consumer (lean: built only if a burst should touch allies,
the telekinetic the natural one; otherwise carried to Round 14 with
`affects` as flags); who drafts the abilities' lines (lean: the session,
read at each phase's stop).

### Later, at their phases

- *§159:* the forced move's look and sound.
- *§160 and §161:* each unit's glyph, numbers, rarity and price, and its
  encounter; the dash's trail and the teleport's blink.
- *§162:* the box's size and cost; each new draftable's disposition under
  the rarity protocol; any sheet re-sign.
