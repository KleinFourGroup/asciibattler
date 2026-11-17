# Round 12 Spec — Push, pull and blink

**Status: SIGNED 2026-11-14** ("Thank you, Claude! 😁 Signing the spec and
the cut!"), with the phases §158 to §163 (WORKLOG §157, in `archive/worklog-phase-158.md`). The intent is the user's, verbatim where it is
theirs, from the Round 8.5 census (A-07), the re-cut (§133c) and the
casualty verdict (§93); what was signed before the kickoff is listed with
its date. The Open section is what the round still has to settle, with
the session's leans marked as leans. The charter is
[META-ROADMAP.md](META-ROADMAP.md) §"Round 12 — Push, pull and blink";
the record is WORKLOG §157 and §158, in
[archive/worklog-phase-158.md](archive/worklog-phase-158.md); the plan is
[ROADMAP.md](ROADMAP.md).

## Intent (the user's words)

**Forced movement** (2026-10-12, the census's A-07,
[archive/round-8.5-census.md](archive/round-8.5-census.md)): "Attacks
with a knock back or pull effect are also planned, but I admittedly may
never have mentioned that." And, deleting the unbuilt modes: "07, also
cleared, but yes, let's get those into the plan." A push's distance is
designed with the first knockback (the same census, A-05). At 158b
(2026-11-16): "Push and pull should be thought of as the unit, well,
moving involuntarily. […] I also am on-board with optional stuns after
the push or pull."

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
rogue, per se." At 158b (2026-11-16): "my original vision was that
teleport was supposed to be strictly stronger than dash, because teleport
would unlock new pathing possibilities."

**The blade whirlwind** (2026-10-26, the re-cut's third batch): "blade
whirlwind. Melee self-centered AoE."

**The banshees** (2026-09-05, the casualty verdict, item 7a,
`archive/post-88-worklog.md` §93): they "NEED a rework at some point —
'really annoying'". Round 11 retuned the area statuses; the self-centred
burst above is the rework's second half.

**The cavalier** is item #14 of the 2026-08-21 feature list
(META-ROADMAP's Coverage map). No words of the user's for it were found in
the repo, its git history or the session transcripts reachable from
2026-09-27 on; that day's META-ROADMAP v2 (`daff9a08`) read it as "blitz +
hit on arrival … Everything else is a dash clone + mobility" (WORKLOG
§157, "The cavalier previewed"). At 158b (2026-11-16), of that preview:
"What we're describing isn't really a charge, is it? It's more of a
pounce. That'd be great for the animals, but maybe not the cavalier, no?"
The charge signed in its place is below, under tranche 2A.

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

The calls, in tranches, with the session's leans; WORKLOG §157 and 158b
(in `archive/worklog-phase-158.md`) hold the reasons and both arms of
each.

### Tranche 1 (this kickoff), signed 2026-11-14

1. **The spec and the phases:** this spec, and §158 to §163 in the order
   §157 gives (the pre-step and the design; forced movement, the
   seam; the pushers and the bursts; the blink and the charge; the closing
   board; the close), with §158's two steps and their reads.

### Tranche 2A (at 158b, the design stop), signed 2026-11-16

"Signing all of your leans", with forks 5, 11 and 12 and the cavalier
reshaped at the stop (158b, "tranche A signed"). The
forced-movement design:

- *The op:* a new `push` op that moves the targets its selector resolves,
  away from or toward an origin (the caster or the area's centre), by its
  own whole number of cells; `move` keeps moving the caster. The new op,
  over two more `move` modes.
- *Direction:* one of the eight grid directions, fixed at the push's
  start from the origin to the victim; a victim on the centre cell is
  pushed away from the caster; no randomness.
- *What stops a push:* the edge, an impassable tile, a unit (scenery
  included) or another unit's claimed cell; the victim lands on the last
  free cell. Chasm and deep water stop it like a wall, against a
  fall that kills or a carry across the gap.
- *Collision:* nothing more when a push is cut short, against bump
  damage.
- *Timing:* the victim's cell changes when the op fires, and a new action
  holds it busy until the slide ends, at one fast rate per cell for every
  unit (about 0.15 s, a balance number set at §159); a World bump at §159.
  A longer stun is an `applyStatus` after the push, per ability.
- *The victim's action:* a push ends whatever the victim was doing,
  against ending only a step or a swap and letting a strike or a spell run
  on.
- *Who moves:* never scenery and never a body larger than one cell (the
  scope guard); a pushed camp member is not hit by the push alone.
- *Several victims at once:* farthest from the origin first.
- *Landing as an entry:* a push, a pull, a teleport and the dash run the
  landing tile's enter effects, the dash's change moving the corpus with
  the round's content.
- *The pull:* the same walk toward the caster, stopping beside it.
- *The teleport:* its range a straight-line distance and its landing
  blind to what stands between, so it passes what blocks the dash; it
  lands on the free cell beside its target farthest from the caster, on
  its cast tick like the dash, with no claim. While it is ready, the
  ninja walks to the nearest cell with its target in blink range (a
  ranged unit's search for a firing cell, with no sight check); while it
  cools, its reach is melee. The pathfinder does not price blinks into
  its routes.
- *The hit after a leap* (C5): a leap keeps its enemy's id, and a damage
  op after the move hits it only if it is alive and within reach of the
  landing. Its consumer is a pounce (tranche 2B), not the cavalier.
- *The cavalier's charge:* a push the cavalier gives itself, along a
  straight line toward its target, held busy and fast; it stops at the
  first body or impassable tile, and an enemy there takes the hit and a
  knockback. A run-up, so it never charges from two cells away; a small
  damage bonus per cell travelled; melee after the hit until it has room
  again. When the hit lands and how the line is drawn are §161's.
- *`World.shove`:* retired, its `unit:shoved` event kept for the push.

### Tranche 2B (at 158b, the design stop), signed 2026-11-16

"Signing all leans except for 1", then the pounce as revised (158b,
"Tranche B" to "the pounce signed"):

- *The cavalier's body:* one cell, high mobility, a melee weapon, the
  charge on a long cooldown.
- *Which new units are draftable:* all four, each also an enemy in one
  act-2 or act-3 encounter.
- *The blade whirlwind's carrier:* a special on the ronin.
- *N3's flag:* not built, since every planned burst hits enemies alone;
  carried to Round 14's `affects` as flags.
- *The abilities' lines:* the session drafts them, read at each phase's
  stop.
- *The pounce on the beasts,* reopened by the user and signed as revised
  ("Signing call 1 as revised! 😁 We'll keep the charge cooldown,
  though"): the puma alone, a leap and a hit beside its strike, proposed
  only from at least its minimum range (3 or more) and only when the
  landing puts its target within reach, with no cooldown in effect; the
  strike it shares with the fox renamed; the fox keeps its dash.

### Later, at their phases

- *§159:* signed 2026-11-17 (`archive/worklog-phase-159.md`, "The read
  of 159d and 159e"): 0.15 s a cell; the slide a yank, no bar over the
  held unit, the `shove` cue; the Snag's name, line and numbers, and a
  pull firing only when its first cell is free.
- *§160 and §161:* each unit's glyph, numbers, rarity and price, and its
  encounter; the dash's trail and the teleport's blink; the pounce's
  floor; when the charge's hit lands and how its line is drawn.
- *§162:* the box's size and cost; each new draftable's disposition under
  the rarity protocol; any sheet re-sign.
