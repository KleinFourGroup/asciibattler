# Round 13 Spec — The unit kit

**Status: PROPOSED 2026-11-28**, with the phases §165 to §172 (WORKLOG
§164). The intent is the user's, verbatim where it is theirs, from the
hit roll's verdict (§136), the re-cut (§133c), the officer's study (§154)
and the specials' round (§161.5); what was signed before the kickoff is
listed with its date. The Open section is what the round still has to
settle, with the session's leans marked as leans. The charter is
[META-ROADMAP.md](META-ROADMAP.md) §"Round 13 — The unit kit"; the record
is [WORKLOG.md](WORKLOG.md) §164; the plan is [ROADMAP.md](ROADMAP.md).

## Intent (the user's words)

**Dodge** (2026-10-28, the hit roll's verdict, in
[archive/round-9-spec.md](archive/round-9-spec.md), "Intent"):

> Evasion and precision both go. Dodge is now a passive special ability.
> Honestly, it doesn't even need to be a 1 in n ability; a regular % might
> be fine. It might also be nice to be composable with daemons. Maybe not,
> though. That can all be sorted out when we get to implementing specials.

Signed with it (WORKLOG §136, in
[archive/worklog-phase-136.md](archive/worklog-phase-136.md)): dodge
returns as a passive special in Round 13, its shape (a counted share or a
plain chance) and whether daemons grant it decided there. A guard on a
timer was set aside then, since two fixed cadences can stay in phase and
shut a slow attacker out.

**Lifesteal** (the re-cut's second batch, 2026-10-25 and 10-26,
`archive/post-118-worklog.md` §133, 133c): the vampire, "a melee unit
that does life steal on hit"; and of the two variants put to him, a
daemon's run-wide heal on hit and a packet's for one fight, "we'll
definitely want some variant of those two vampirism examples", the names
and details at the time.

**The specials** (2026-10-26, 133c), on a gate that would let a special
fire only when it matters: "I think we might drop that. I feel like units
doing suboptimal things is part of the autobattler genre. (Early itch
analytics: most of our engagement is from autobattler searches, not
strategy or roguelike or deckbuilding.)" Signed the same day: the gate
dropped, C2's two gaps kept (the self-buff arm, the self-heal), a
condition added only where an ability looks broken without one.

**Global reach** (2026-10-26, the third batch): "Global reach
abilities": "a special that inflicts a global stun, or a alternately a
global heal", composing with the `affects` flags, "the same option for
auras too." Round 14's totems wait on the aura: "one with a global
healing aura keyed only to hostiles, which would lead to a fight where
you have to focus down the totems first".

**`extends` and its reskins** (2026-10-25 and 10-26): "a 'soldier' that's
the same as a mercenary, just when the latter isn't thematically
appropriate." "Commisar. An officer, but buffs speed, not mobility."
"Conscript. A bit weaker than a mercenary; need to figure out what the
appeal is."

**The officer** (2026-11-11, at 154g's sign): "it needs a more detailed
study and / or a total redesign"; then, cutting his base mobility from 6
to 3 the same day, "we'll refine it more in round 13" (TODO, Round 13;
BALANCE 2026-11-11).

**The ranged release** (2026-11-25, at 161.5c's sign), of the jinx's and
the icicle's 0.3 s recovery: "something to experiment with for other
ranged attacks".

**The resume mode** for `box-drive.sh`: agreed 2026-11-27 (TODO, Round
13; WORKLOG 162c).

`knownAbilityIds`'s last reader, the whirlwind's `evadable`, the
redraw-fisher file and the named watches are the sessions' findings, each
signed into the charter or TODO with its date. The units' lines are the
user's to write (151f, asked 2026-11-02).

## Signed before the kickoff

- The charter, scope, decision points, exit and scope guards (133d
  tranche 2a, 2026-10-26), standing at Round 12's close with its
  `extends` parenthetical pointing at 163a's recount (163a, signed
  2026-11-27: "Signing both calls on your leans! 😁").
- How the re-cut's rounds run (133d tranche 1): each round ends in an
  upload with something a player can meet; each seam ships with a
  headless test, its planted failure and a consumer in play; a round that
  changes combat closes with a board read as paired same-seed deltas
  against the round before, here §162's (BALANCE 2026-11-27, "the closing
  board at v10").
- TODO's Round 13 rows, each with its signature: the telekinetic's and
  the cavalier's watches and the Artillery Company's cost (162e); the kit
  watches (§154), the adventurer, the rioter and the rogue held until this
  round gives them back their dodge; the priest's and the gambler's parity
  (156d); the whirlwind's `evadable`, settled with the dodge (163a); the
  redraw-fisher file, decided by `extends`'s checklist (163d); the resume
  mode, before the round's board (163d).
- What Round 12 hands on: every new ability ships a `description` (151e's
  test refuses one without); a new draftable needs a prior-table row or a
  PENDING acknowledgment (`tests/prior-table-coverage.test.ts`); snipers
  slow and heavy, for any ranged unit the round adds (§152).

## The code under the round

Read at `a95f12e2`. Nothing under `src`, `config`, `tools`, `scripts`,
`tests` or `locales` has changed since 163a's read at `6940a92f`, so its
premises stand with their files and lines
(`archive/worklog-phase-163.md`, 163a). This kickoff read the surfaces
under them; WORKLOG §164 holds the files and lines. In short:

- `World.applyDamage` returns true for every strike, and the damage it
  deals (after defense, not clamped at the target's HP) reaches the
  `unit:attacked` event and the `dealHit` trigger, never the op that
  struck. A damage op records its misses on a scratch that one phase
  boundary shares and nothing serializes.
- Before Round 9 deleted evasion, the adventurer carried 11, the rogue and
  the rioter 7, and every other unit 3 to 6. The kit watches hold those
  three for their dodge; the charter names the adventurer, the rogue and
  perhaps the ninja.
- An ability with no ops and an aura proposes nothing; one with no ops and
  no aura would fall into the leap's proposer and leap. So a passive dodge
  needs the aura's skip.
- The crit draws on `combatRng`, which the World serializes. A dodge drawn
  after it adds a draw only where an evadable strike meets a dodger, and
  shifts every combat draw after it in that fight.
- A battle rule's effects are `gainBits` and `applyStatus`. A daemon's
  hook and a packet's `injectRule` both compile to that shape, and the
  shape is in the Run's pinned save format, so `healActor` is a Run bump
  and a World bump, as the charter says.
- A `self` ability with no summon proposes as a leap does, so a self-buff
  fires only when a leap could. A `self` ability's heal heals the leap's
  enemy, by the code; no shipped ability does it.
- An area builds its cells each fire, so a global area is a selector, not
  a radius. The aura pass builds none and already measures every pair,
  so a global aura costs what a small one does. `affects: 'enemies'`
  counts camp members, and a status alone never turns a camp hostile.
- Both editors that save `config/units.json` save it from the parsed
  catalog, so today a save would write a reskin out whole and drop its
  `extends`. One test reads the raw file and skips a record with no
  `abilities`, so it would miss a reskin's inherited kit.
- The officer study read an aura of +2 SPD at 1.4 to 2.0 a fight better
  than the shipped aura at every act, so the commissar's speed and the
  officer's redesign are one question. His new status needs a symbol and
  a hue in both palettes, the colourblind one keeping status hues apart
  in each simulated view.
- The ranged weapons recover by `fill` and the jinx and the icicle by
  0.3 s, so the release experiment is a config line per weapon.
- A unit's power may be 0, so a conscript whose fall costs the pool
  nothing is expressible in config.

## Open

The calls, in tranches, with the session's leans; WORKLOG §164 holds the
reasons and the other arms.

### Tranche 1 (this kickoff)

1. **The spec and the phases:** this spec, and §165 to §172 in the order
   §164 gives: the design; `extends`, the checklist and the mercenary's
   reskins; the dodge; lifesteal; the specials and global reach; the kits
   by taste (the ranged release, the officer, the commissar); the closing
   board; the close. §165 is one step, 165a, the design, a `stop`.

### Tranche 2 (at 165a, the design stop)

Put there with both arms, cost and lean, in two lists (WORKLOG §164 has
them in short):

- *A, the damage path:* the widened return; the dodge's shape, its seat
  and its draw; which strikes it stops, the whirlwind included; what a
  dodge costs the attacker; its carriers; the `lifesteal` op; `healActor`.
- *B, the rest:* the self-buff arm and the self-heal, and the arm's
  consumer; global reach as a selector and as an aura's reach, and the
  camps under a global `enemies`; the global special's kind and carrier;
  `extends`'s merge, the editors' round trip and the checklist with its
  guards; the soldier's id and draft, the conscript's appeal.

### Later, at their phases

- *§166:* the reskins' glyphs, numbers, rarity and price; the
  redraw-fisher file kept or deleted.
- *§167:* each carrier's dodge number; the dodge's look.
- *§168:* the vampire's glyph, kit, rarity and act; the idol's and the
  packet's names and numbers.
- *§169:* the global special's numbers.
- *§170:* the ranged release kept or dropped; the officer's redesign; the
  commissar's status, its hue and symbol.
- *§171:* the box's size and cost; each new draftable's disposition under
  the rarity protocol; any sheet re-sign.
