# WORKLOG — Round 11 (The roster)

Per-phase narrative log (AGENTS "The planning stack"; `process/planning.md`
"The artifacts"): findings, decision rationale, rejected alternatives,
scope changes, playtest verdicts and the checks run land here under the
matching `## Phase N`; the ROADMAP stays a plan. The file holds the phase
in progress: at each phase close it moves to `archive/worklog-phase-N.md`
and a fresh one starts. Round 11's phases so far:
[archive/worklog-phase-149.md](archive/worklog-phase-149.md) (the
kickoff, §148, and the stat sheet, §149),
[archive/worklog-phase-150.md](archive/worklog-phase-150.md) (the board's
instruments, §150) and
[archive/worklog-phase-151.md](archive/worklog-phase-151.md) (the
content, §151). Round 10's are `archive/worklog-phase-142.md` to
`archive/worklog-phase-147.md`.

## Phase 152 — the weapons and defense, by taste

The kickoff's inputs, by pointer: the charter, ROADMAP §152;
META-ROADMAP §"Round 11 — The roster"; the stat sheet at
`/tools/stat-sheet/` (archive/worklog-phase-149.md); what §151 hands on,
its close entry (archive/worklog-phase-151.md); `process/planning.md`
"Phase kickoff". 151f, the units' lines, lands here when the user writes
them.

### The kickoff's audit, and the cut put to the user (2026-11-06, session 096110b8)

Read at `9d7cbb4c`. The sheet's numbers below are printed headless
through the sheet's own model by `scratch/152/sheet.ts` (`npx tsx
scratch/152/sheet.ts <sector> <kind> <levels>`). A duel is one unit
standing in range of each fielded enemy in turn, so an area weapon reads
per target.

- *The weapons.* The 16 draftable units carry 14 strike weapons, with the
  heal, the raise, the dash and the inspire beside them. Melee at reach 1
  and 1.5 s: the sword (might 3, the mercenary's and the enemy
  prodigy's), the katana, the whip and the cleaver (2 each); the gambit
  (1, 1.2 s); the halberd (4, reach 2, 2 s); the cane (0, 0.8 s). Ranged:
  the bow (3, reach 3, 2 s), the pistol (1, reach 4, 0.8 s), the
  catapult's shot (0 on 10 ranged, reach 6 from 4, 3 s). Spells at
  2.5 s: the bolt (an area, 0 on 10 magic), the chain (3 jumps at 0.6),
  the vial and the molotov (areas, a flat 2 and their riders). Every
  cooldown shortens with speed. The enemy-only weapons are the club, the
  claw, the light ray, the ice storm, the wail, the hex and the beasts'
  five.
- *The sheet at act 1* (the Periphery, normal fights, level 3, the page's
  default), damage a second dealt, standing: the reaver 9.7, the ronin
  7.4, the rogue 6.7, the mercenary 5.5, the adventurer 5.2, the mage and
  the stormcaller 5.0 each per target, the halberdier 4.3, the catapult
  4.0, the gunslinger 3.9, the archer 3.9, the corrupter 2.9, the rioter
  2.4, the officer 1.9. The fielded mix is the fox, the wolf, the giant
  rat, the bandit and the archer, defense 1 or 2, about 1.4 by share. The
  order holds down the walk but for swaps: the adventurer passes the
  mercenary by act 2's level 8; by act 3's 14 the gunslinger and the
  archer pass the halberdier and the catapult, and the officer the
  rioter.
- *What defense takes.* Defense comes off each strike, floored at 1, so
  its share falls as the strike grows. Of the strike alone (riders left
  out), against act 1's mix at level 3: 13 % of the bolt, the chain and
  the catapult's shot; 16 to 20 % of the katana, the cleaver, the
  halberd, the sword and the bow; 24 and 26 % of the whip and the gambit;
  40 % of the pistol; 18 % of the cane, whose strike the floor holds at
  1; about half of the vial and the molotov, whose damage is mostly their
  riders, which bypass defense. At act 3's level 14 (defense 1 to 4):
  12 to 20 % of the heavy strikes, 38 % of the pistol, 45 % of the cane,
  half of the vial and the molotov. Armour bites the light strikes, by
  the subtractive rule's shape, and not across the board.
- *What the halving gave the spells and the catapult.* With no floor
  binding, a strike is its value at no defense less the defense, so
  against act 1's mix at level 3 the bolt strikes 11.1 − 1.4 = 9.7, and
  8.2 at twice the defense, about what it would meet without the
  conversion's halving (its pooled rate 0.488): a sixth more (1.17), the
  catapult's shot the same (1.18). Act 1's beasts were added after the
  conversion on converted numbers (`ADDED_AFTER` in the strike-conversion
  test), so no play met them at the old defense; the sixth is against the
  weapons the conversion held.
- *Escalation* scales the level budget, the wave and the bits
  (`config/escalation.json`), no stat.
- *"Snipers slow and heavy"* is first written in the charter at
  `9420c651` (136f), beside the user's "The current rates feel good"
  (`archive/worklog-phase-136.md:430`, refusing the lean to divide every
  cooldown by its accuracy). A search of the repo's markdown for "sniper"
  and "slow and heavy" finds the charter's three copies and post-72's
  precision entries, no words of the user's behind it. It was signed with
  the charter.
- *The identity pins* (`src/config/abilities.test.ts:179`): the pistol
  faster and weaker than the bow; the halberd at reach 2, slower and
  mightier than the sword; the cane the pistol's twin in cadence, its
  might at most the pistol's; the molotov the vial's clone with the burn.
  A draft that crosses one amends it, named at the stop.
- *What moving a converted number breaks*, planted in a detached scratch
  worktree at `9d7cbb4c` (the sword's might 3 → 4, the mercenary's base
  defense 2 → 1) and run with `npx vitest run`: 4 of 3959 tests, one in
  each of 4 of 272 files. The strike-conversion test; the halberd's pin
  (the sword's might now equals his); the chaos census
  (`tests/chaos/chaos.test.ts`, a seeded drive); the catapult battle at
  seed 2 (`tests/integration/catapult-battle.test.ts`). With the corpus
  recorded again by hand and the fuzz smoke on the commit, that is a
  draft round's commit shape, as at 146e. The worktree is removed.
- *No snapshot bump.* A saved run carries no config stamp: in `src/`,
  `configHash` is read only by the dev trace replay
  (`src/dev/replayTrace.ts`), so a v51 save loads on new numbers with its
  rolled stats. No RNG stream is added.
- *The tools for tuning in play.* The attack and archetype editors save
  straight to `config/` through the dev server's `/__save-config`
  (`vite.config.ts:46`), and the sheet reads the config live, so on the
  user's dev server an edit shows in the sheet and in the next battle. A
  forced roster and fight by URL:
  `?roster=archer:3,archer:3,mercenary:3&encounter=<id>&seed=<n>`
  (`src/run/RunConfig.ts:347`), or the run-config page.
- *The strike-conversion test* retires at the first commit that moves a
  converted number (its header, line 24), with
  `strike-conversion.before.json`, its `DEPARTURES` and `MOVED_AFTER`.
  Nothing replaces it, since a test pinning tuned numbers would only be
  edited with them; 152a's record keeps the before.
- *Overlaps.* The kit watches (the officer, the mercenary, the
  halberdier, the stormcaller) and the area-status enemies are §154's,
  power by rarity §153's. The board's act-1 refs (150h) stay on today's
  numbers until §155 re-pins them.

**The cut** (no snapshot bump; no RNG stream; no box):

- **152a — the before record** (`none`). By `scratch/152/sheet.ts`, for
  the 16 draftable units: the duel table (hit points, strike, period,
  damage a second dealt and taken, time to kill both ways, the share
  defense takes) at act 1's normal fights at level 3, its elite and boss
  at 5, act 2's normal at 8 and act 3's at 14 (picks: the page's default
  and three points down the walk, not measured hand levels); the weapon
  table; the ranks of strength, ranged, magic and defense, base and
  growth, in both groups. Into BALANCE's run log. Exit: the record, two
  of its rows matched against the page in the Browser pane. Docs only;
  the fuzz smoke does not fire.
- **152b — the draft** (`stop`). Every number the calls below sign,
  drafted through the sheet, in one commit: the strike-conversion test and
  its before-file deleted; a crossed identity pin amended and named; the
  corpus recorded again, each seeded drive that moves re-picked by its own
  rule; the fuzz smoke fires. *At the stop:* the draft as a table beside
  152a's; the user plays act 1 on the dev server, a run as the Soldier
  and a forced roster per group by URL, and changes any number in the
  editors or by naming it. Wrong looks like a group that now wipes or
  steamrolls act 1, or a weapon whose tempo reads off. Each round of
  changes lands as a 152b-post commit with the corpus, until every row is
  signed.
- **152c — the after record** (`none`). 152a's tables on the signed
  numbers, beside the before, in BALANCE: the exit's record. Docs only.

*The stretch the sign opens:* 152a, then 152b's build to its stop.

**The calls, with the session's leans:**

1. *The cut and its reads* as above.
2. *What the draft moves.* Lean: every weapon held where the conversion
   put it, but for the moves signed below and any unit the user names
   from play, so the draft is a small diff whose effect the play can
   attribute. The sheet cannot say a unit is too strong: range, hit
   points, area and kit sit outside a standing duel. Its outliers, for
   the user's eye: the reaver leads at every point (9.7 at act 1's
   level 3, a third above the ronin and three quarters above the
   mercenary); the three ranged units sit together at 3.9 to 4.0 across
   three rarities (the common archer, the uncommon gunslinger, the rare
   catapult); the officer's cane at 1.9, his kit §154's.
3. *The snipers.* Lean: the bow alone, 2.0 → 2.5 s, its might raised so
   its damage a second against act 1's mix holds within a tenth; a
   heavier strike loses less to defense, so it gains where armour is
   higher. The pistol stays fast and light (its pin), and the catapult is
   slow and heavy already. The other arm: no cadence moves, on "the
   current rates feel good".
4. *Defense.* Lean: bases and growth held, since act 1's mix takes 13 to
   20 % of a heavy strike and the light strikes' larger share is the
   rule's shape. If the user's play says armour reads strong, one rule on
   both sides, drafted at 152b, so the enemies' armour moves with the
   company's.
5. *The spells and the catapult.* Lean: held and read in play; nothing
   measured says they are strong, and the sheet reads the bolt and the
   chain per target. The other arm: magic and the catapult's ranged
   trimmed by a sixth, back to their strike at the old defense.
6. *What holds.* The enemy-only units hold their numbers: the beasts,
   tuned to act 1's turn targets at 146e; the bandit; the ghoul; the
   luminant, the ice mage, the warlock and the banshee, the area-status
   ones §154's. A shared weapon moves every wielder (the sword is the
   prodigy's too), and a draftable archetype moves where it fields as an
   enemy (the mercenary, the mage and the archer in acts 2 and 3). §152
   moves a kit-watched unit's weapon only where a call says so; §154
   reads the kits on the result.

§151's candidate guard needs no asking again: the user signed it, it was
built, measured and reverted at the user's call, and the hook's failure
lines replaced it (archive/worklog-phase-151.md, "§151 closed").

### Call 3 answered, and the units' worth at the user's question (2026-11-06, session 096110b8)

The user took call 3 at the lean, the bow 2.0 → 2.5 s with its might
raised so its damage a second holds within a tenth ("I'm on-board with
slowing the archer down as described, to feel a bit more sniper like"),
and placed the charter's line: "snipers slow and heavy" was "primarily
meant … as guidance for future units". Calls 1, 2, 4, 5 and 6 stay open.

The user asked how the units' recruitment numbers look, which need a buff
or a nerf, and whether a later phase handles it. The read is BALANCE's
run log, 2026-11-06, "the draftable units' worth": the rioter clearly low
taken free, the halberdier high free, the gunslinger and the adventurer at
opposite ends bought at one price, the rest not told apart. Where each
could land was put to the user with the session's leans: the rioter in
§152's draft, through its molotov or its defense (both in the charter);
the halberdier and the stormcaller, which read high where 94f's kit watch
read them low, held here and weighed at §153's power scale and §154's
kits; the port pair to §154's list, read on the numbers §152 and §153
leave.

### The cut signed (2026-11-06, session 096110b8)

The user signed the cut and its reads and every lean ("Buffing the rioter
as described sounds good to me! 😁 Signing your leans for everything"):

- *The draft moves two things:* the bow, 2.0 → 2.5 s with its might
  raised so its damage a second against act 1's mix at level 3 holds
  within a tenth (call 3); and the rioter, a modest buff through its
  molotov or its defense, both in the charter, its hit points left out.
  Every other number is held: defense (call 4), the spells and the
  catapult (call 5), the enemy-only units (call 6), with the archer and
  the rioter moving where they field as enemies.
- *The halberdier and the stormcaller* are held here and weighed at
  §153's power scale (TODO's power row); *the kit watches* are re-aimed
  at §154's kickoff, the gunslinger and the adventurer added (TODO's kit
  row), read on the numbers §152 and §153 leave.
- *The charter's "snipers slow and heavy"* is the user's guidance for
  future units, amended so in ROADMAP and META-ROADMAP.

The stretch: 152a, then 152b's build to its stop.

### 152a — the before record (2026-11-06)

BALANCE's run log, 2026-11-06, "the stat sheet's before record": the
duel at the five points, the weapons and both groups' ranks, printed by
`scratch/152/sheet.ts --record scratch/152/before.json` and rendered by
its `--md` mode; `before.json` stays in `scratch/152/` for 152c's
`before → after`. Two rows matched against the page, with a control one
level off that does not. The enemies' ranks are recorded though call 6
holds every enemy-only unit, so 152c shows them unmoved rather than
leaving it to be assumed. No config or code moved.
