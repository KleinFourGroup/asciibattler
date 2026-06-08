# Phase H Feedback

### Overall Feedback

Right now, here are the most substantive complaints:

* Battles early on need more player agency.  It feels awful to lose even a skirmish early on, due to the player's inability to affect battles at all.
* When a skirmish gets down to a low number of units, the outcome is often certain a solid ten to twenty seconds before the battle ends.  This is dead time.
* Balance in general is still needing an overhaul.

Here are some smaller ones:

* The randomly generated layouts are boring.
* Water doesn't seem to have any mechanical effect.
* Leveling is way too rare.
* We need to revert the speed to agility name change.  Everyone thinks it's a dodge chance now.
* Units do actually need to level up between skirmishes, not just battles.

Here are a few UI / graphics ones

* The level up screen presents too much information at once.  It needs some "juice."
* Get rid of the auto progression between pre- and post-skirmish scenes.
* Skirmishes start and end too abruptly.  They want the unit fade in at the start, and a brief after battle pause before scene change at the end.
* The battle layouts just hanging in space doesn't look good.

And finally, some development notes from me:

* Copying and pasting JSON layouts is slow and cumbersome.  I'd like the tool to automatically edit the layouts.
* An archetype editor would be nice as well.

Some of these are reasonably straightforward one hots for you.  Others are quite vague.  I'll be outlining my ideas for the two major feedback points, and the less urgent vague ones can be back-burnered.

### Player Agency

Fundamentally, I see two main avenues for improving player agency.  We can tackle in-battle agency and pre-battle agency:

#### In-Battle Agency

Up until now, I have vaguely mentioned some sort of low-intensity way of adding player input to skirmishes, mainly via influencing targeting and pathing.  This is challenging for a few reasons:

* This game is primarily an auto-battler.  We do not want to turn it into an RTS.
* This system makes fuzz testing much harder, as a pure random strategy would nonsensically paralyze the player's units with ever-shifting goals, and a more complex strategy might involve a massive increase in the dimensions of our strategy system.
* This system will trample on our pathing system and probably require an overhaul.

That all being said, I don't see a way around this anymore.  I thus propose the following system:

* Players can set an objective.  This may be either a tile or an enemy.
* Units actively fighting or close to their preexisting target will not have their behavior preempted by the objective.
* Units not thus engaged will begin pathing towards the objective.
* If a unit pathing towards the objective comes within range of an enemy unit, this becomes their new target and preempts the objective.

  * When I say "range," I'm generally referring to attack range.  However, for ranged units, particularly ones with a very long range, it might make sense to have an upper limit + retaliation requirement.
* If the objective is an enemy unit, the player units engage it upon it entering their range.  Upon the death of the objective unit, the objective is considered cleared.
* If the objective is a tile, it acts as an attractor, with player units pathing as closely as they can towards the objective.

  * We will have to tune whether or not tile objectives clear automatically or remain active until manually cleared.
* An objective can be set via right-click.  There should additionally be a Set Objective button that, upon being clicked, allows the player to left-click on an objective.
* An objective can be manually cancelled via clicking on a Clear Objective button.
* Both of the buttons should be hotkeyable, and the hotkeys should be rebindable.
* For fuzz testing purposes, objectives may only be set to units.  An objective may only be set after the previous one has been killed.  I'm thinking per-archetype, highest and lowest stat, highest current health, and lowest current health as targeting parameters, as well as a no target proclivity.

  * We can luckily tune this separately in "arena" runs that just simulate one battle.  I think.
* Major concerns: how this interacts with pathing.  Do units cache their path and only recompute after one of the boid sidesteps?  Since we're dealing with a situation where the user might thrash the objective a lot, we'll need to be careful about performance.  We'll also probably be able to optimize around the fact that the units will all be sharing the same objective.

#### Pre-Battle Agency

For pre-battle agency, I'm envisioning two main new mechanics.  Both take place during the pre-skirmish scene showing unit draw.  The first is a redraw mechanic:

* The player may select some number of the units they have drawn for a skirmish, send them to the discard pile, and then draw the same number of new units.
* We'll want support for both arbitrary selection of cards for redraw, but also with a cap on the overall number.
* We'll want to make sure that this is applied optionally at the start of each skirmish.  Some configurations might have it fire every skirmish, others only on the first skirmish of a battle, etc.
* Yes, I am aware that this mechanic is fundamentally redundant if the roster size equals the hand size, as it currently does.  Both might need to be adjusted.
* A unit that is discarded in this manner does not 

The second is empowering:

* The player may select a drawn unit and empower it with a buff.
* The buff should not be hard-coded, and like redraw should be optional at the start of each skirmish.
* Yes, I realize this means implementing a status effect system.

We'll have to hash out fuzz strategies for both of these mechanics, as I don't have clear ideas yet.

##### Daemons

I mentioned both of these being optional at the start of each skirmish.  I'm envisioning control of when these apply being given to yet another new mechanic: daemons.

* A daemon is an item with a passive effect that applies to the player, such as, for example, "every other skirmish, enable redraw up to two," or, "at first skirmish of a battle, enable empower with a \[+4 to strength, lasting until the end of the battle]."

  * Basically, think relics from Slay the Spire.
* Daemons should not be limited to purely out of battle effects.  "On a friendly unit evading an attack, gain a \[+1 speed for ten seconds]" is perfectly valid.
* We'll mock up a few and have a random daemon spawn with the start of a run.

### Foregone Conclusions

I see two main ways to deal with this: straight-up fast-forwarding through the dead time, and making the low-unit fights less predictable.

#### Fast Forward

* Exactly as described.  Have a little button to speed the game up by either 2x or 3x.
* Concern: at 3x, we'd be running at 60 Hz tick rate.  Might run into performance concerns, particularly regarding pathing.

#### Predictability

I propose that, in order to make individual units fighting less predictable, we add a dodge system:

* We add two new stats: precision and evasion.
* The odds of an attack landing are the attacker's precision (times a multiplier) minus the enemy's evasion (times another multiplier).

  * Alternatively, we might go precision divided by precision plus evasion.  We've kinda got a whole fire emblem combat stat system going, so I'm inclined towards the former, but we'll see.
* A miss should cause a "Miss" hitsplat.

### Balance

This is the section about which my thoughts are least organized.  Word vomit:

* I think a major issue we're running into is that there's just one big "melee" class, which forces a large degree of symmetry between the player and the enemy.  Combined with the dodge mechanics, we can now begin to break melee down into different classes with different feels.  Tentatively, I'm thinking a "Mercenary," which is basically the preexisting melee; an "adventurer," which has a lower defense but a higher dodge; a "ronin" with a much higher luck stat; and a "bandit," which is just a Mercenary but with lower growth rates.  Bandits will be the default melee enemy until such time as we design a proper encounter system.
* Getting the dodge system saves the rogue, as it to can become a dodge tank.
* **I** will have to redesign the maps, as the pure one tile corridors make things... Very dependent on spawn.

As we add new unit types, we're going to have letter collisions happening.  My thought on fixing this:

* Add support for different fonts.
* Add support for non-Latin scripts.

The alternative would be switching to a proper pre-made sprite sheet, but that clashes with the roguelike aesthetic.  Also, I'm not ready to pay an artist.

