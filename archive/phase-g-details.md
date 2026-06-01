# Phase G Details

Phase G is hereby focused on run progression, rather than Individual battles

### Enemy Level Balance

Right now, balance scales by linearly increasing enemy level per floor.  This is not sustainable, as player units do not level linearly.  In fact, we don't know how frequently units gain XP and thus level.  Gathering this information via fuzz testing is challenging, as the rates in turn depend on the level of the enemies that they are facing.  I propose the following:

* The total level of the enemy team (the sum of the levels of the individual units) should equal the total level of the player's team, minus a difficulty delta, tunable via JSON setting knob.  For example, the starting battle should have a player total level of 5, and an enemy total level of 5 - \[total level difficulty delta].
* Levels should be distributed in a random manner among the enemy team such that they're all roughly equal in level, with none having a level higher than that of the highest level unit on the player's team plus a second tunable difficulty delta.
* The total number of enemy units can be anywhere up to twice the size of the player's team, and as low as... Whatever number would have the entire enemy team at the aforementioned level cap. I think that's ceiling((total player level - total level difficulty delta) / (highest player unit level + individual unit difficulty delta)).  On average, we want to be mowing down swarms of weaker units.

  * Note that this will transition us to using the spawn queue system.
* For now, keep enemies as just consisting of melee and archers.
* Recruited units now have level equal to the average level of the player's team, plus a bonus starting at zero following an exponential distribution.  (I.E. 50% +0, 25% +1, 12.5% +2, etc.  Exponent should be JSON configurable.)

### Longer Maps

Right now, a run takes almost no time, as a map consists of only four levels plus the spawn node.  This makes higher level balancing hard to assess.  Moreover, current DAG generation is somewhat unintuitive for playtesters.  I propose the following:

* Increase map size to ten levels plus spawn, and up the maximum width to six nodes.  (This is doable with current knobs, I believe.)
* No node should have more than three successor nodes.
* No edges should cross.

#### Graphical Note

Right now, the map select screen shows a gray screen, with the map occupying a thin strip on the right.  This is an artifact from when the selection screen showed the static terrain between battles.  As we no longer have this, let's make the map selection scene a pure CSS scene, taking up the entire scene.

### Non-combat Nodes

We want certain nodes to be non-combat.  I.E. Healing nodes, event nodes, buff nodes, shops, etc.  Making an entire event system is out of scope for Phase G, so we propose for this step merely adding the plumbing for different types of nodes.  We also propose creating two example types:

* A rest node.  For now, this just gives a flat 200 XP to every player unit.  This will be changed later on, likely in a subsequent phase.
* A boss node.  Right now, this is just a regular fight.  Additional mechanics will come later, again likely in a subsequent phase.

The boss node should be the terminal node, and rest nodes should be scattered infrequently elsewhere.

#### Graphical Note

We want the player to be able to plan out routes, and we thus must make node type visible on the map.  As such, we propose replacing the current map scheme of displaying a node's number with an icon system.  For a first pass, I propose:

* X for combat nodes.
* Z for rest nodes.
* ! For boss nodes.

### Multi-turn Battles

I would like to trial my scheme for multi-turn battles.  Here's what I have in mind:

* The player has a health pool.  This persists throughout the run.  Tentatively we'll start with 20.  (As usual, tunable by JSON settings knob.)  If the player runs out of health, the run is lost.
* Each enemy encounter also has a health pool.  This persists only throughout the combat encounter.  Default 8 for now.  A combat encounter ends when the enemy runs out of health, or the player loses the run.
* Battles now proceed in turns.  Each turn sees a subselection of the player's roster fight a wave of enemies.
* The surviving units deal damage to their opponent's health pool equal to the unit's power stat, which we now need to enable.  (For now, base power for all archetypes is 1, base growth rate 20%.)
* We'll use a card-drawing scheme for choosing the set of the player's roster to fight--draw pile to hand to discard pile, with the discard pile being shuffled back in when the draw pile is empty.  Our target for a hand is 8 units, though obviously for the first few floors we won't actually hit that.
* For the purposes of the aforementioned enemy balance system, the player's total team level is now the expected total level of a hand, which I'm pretty sure is their average unit level times minimum(roster size, 8).
* Recruitment is now overhauled, as it may not always be beneficial to recruit a new unit.  There now must be a pass / no recruitment option.

### Testing Changes

With all of these changes, we're going to need to overhaul the various strategies available to our fuzz tester.  In addition to pure random, we'll want:

* Ones that prioritizes each archetype for recruitment.
* Ones that prioritize each each stat for recruitment.
* Ones that path to maximize each type of node.

We'll also need to make sure that there is a way to play shorter runs and even individual layouts, both headlessly and in the browser, as we don't want each eyeball test to require my playing a 15 minute run.  We probably want to create a small tool that generates the necessary URL parameters for this, CLI for your use plus a GUI wrapper for mine?

