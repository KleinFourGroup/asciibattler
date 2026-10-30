# Plan — The acts

The finished run's four acts: what each is, what a win is, and how the
secret act opens. Answered by the user at Round 9's kickoff (2026-10-27,
§134), from the outline in `archive/post-118-worklog.md` §133 (133c's
third batch); the user's words are in [round-9-spec.md](../archive/round-9-spec.md)
"The act design, answered". Rounds 10, 21, 22 and 23 build it
([META-ROADMAP.md](../META-ROADMAP.md)). A line marked *lean* is the
session's, not signed; *open* is still the user's.

## The acts

| | Act 1 — the wilds | Act 2 — the realm in chaos | Act 3 — the plague | Act 4 — the secret act |
|---|---|---|---|---|
| Sector | a new one (Round 10) | The Start, reworked in Round 21 | The Deep End, reworked in Round 22 | a new one (Round 23) |
| Title | The Periphery | The Fragments (the id `start` stays) | The Deep End | The Root ("Root cause of the plague + root account") |
| Theme | forest, a new theme with a tree (signed 2026-10-30) | barren (signed 2026-10-30) | *lean:* swamp, The Deep End's | *lean:* volcanic |
| Hops | 11 | 11 | 11 | about 3, no branching |
| Enemies | ground fauna (wolf, giant rat, fox, puma, tiger; the eagle and the crab with traversal, Round 19), and some bandits | bandits, deserters (the rifle-armed archetypes), the period archetypes (rioter, gunslinger, halberdier, officer), in the warlord-era register | the plague's and the occult's | new |
| Bosses | a bear, 1×1 until moving 2×2s land (Round 20), when it grows under the same id; the Bandit King, from The Start | the Generalissimo, a faction's leader, and the Witch Hunt, both from The Deep End | the dark wizard; until it is built, the Bandit Queen stands in, from The Start | a demon lord |

- **One sector an act** for now; candidate sectors per act come later
  (the sector map already picks one of a node's candidates on arrival).
  A title kept for one: *The Outer Ring*, x86's ring 3, the least
  trusted, so a run climbs to The Root (the user, 2026-10-30: "let's
  keep that idea in mind for when we add alternate acts").
- **The enemies' split:** The Deep End's plague and occult encounters
  stay in act 3, and its human half moves to act 2, in the reworks of
  Rounds 21 and 22.
- **Act 2's register:** the user's inspiration is warlord-era China, the
  1920s register DESIGN.md names for the period archetypes.
- **The Queen as the stand-in** fits her text ("This woman doesn't look
  all that much like a bandit...") and her wave (a banshee, a reaver, a
  mage); whether she turns out to be the wizard's agent is *open*.

## From Round 10

Round 10 adds act 1 before the two shipped sectors, so a run already has
three: they are acts 1 to 3 from that release, with the bosses moved as
the table says (the King to act 1; the Generalissimo and the Witch Hunt
to The Start; the Queen to The Deep End). Each moved boss is re-read on
Round 10's board at its new place in the run. Act 1 is a forest, a new
theme whose procedural cover is drawn as trees, plain scenery that blocks
as a wall does; authored layouts keep their own themes (signed
2026-10-30, `WORKLOG.md` §141 and §142). The Start takes act 2's barren
theme in Round 10 (signed the same day); barren's camp pool is
grassland's, and its ground swaps mud for sand with a few more hills, so
The Start's procedural boards redraw.

## The run's frame

- **Length:** 33 hops to act 3's boss, about 36 with act 4, against 22
  today. The costs: a board's runs take about 1.5 times as long (inferred,
  not measured); a full-run playtest takes longer, which the scripted run
  (Round 10) eases by starting at any act; and rosters reach the level cap
  of 20 more often, which no board has read. Enemy strength follows the
  roster (a wave's level budget is a factor of the roster's mean or median
  level), so a longer run does not outrun the enemies.
- **A win is act 3's boss.** Act 4, when it is open, is offered after that
  boss as a choice; losing in act 4 does not undo the win, and act 4's
  boss is a second record. The credits follow the first win. Today one
  event, `run:victory`, both ends the run and records the win
  (`Run.advancePastBattle`, `src/store/progress.ts`), so this splits them
  and adds a choice at act 3's end (Round 23).
- **Act 4 opens on a condition met during a run,** something found or
  done in acts 1 to 3; it costs a Run field (a Run bump) and content. What
  the condition is, is *open*. *Lean, unconfirmed:* the condition is
  findable only after a first win.
- **The plague's cause** is *open*. The user likes the terminal frame's
  pun: a plague in a machine is a virus, and a demon lord sits beside the
  daemons the player carries. One reading the session offered, not
  signed: the dark wizard spreads the plague, and the demon lord is what
  he spread it for.
