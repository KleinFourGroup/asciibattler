# Combat Plans

Now that we have the terrain and layout overhaul working reasonably well, it's time to get an actually interesting combat system in place.  Here's what I'm thinking:

### Stats

Right now, units have a very simple stat system: HP, attack strength, attack speed, and move speed, which are randomized within a range.  It's very... Basic.  My proposal is that we switch to a system with the following stats: power, constitution, strength, ranged, magic, luck, speed, and endurance.  These will in turn be keyed into various other abilities and such.  For example, with our current units:

* HP will just be constitution.
* Each unit will have a basic attack ability.  At first pass, our melee units' ability will just hit for strength, ditto archers with range.

  * When we design the basic mage, it'll probably work the same with magic.
  * More advanced units may mix and match these in more complicated ways.
* Luck is a new critical chance.  Probably just \[luck]% for our first pass. Critical hits do 2x damage.
* Each unit's attack ability should have a cooldown.  Speed decreases this, initially pass: by \[speed]%.
* Equivalent for move ability and endurance.
* Power is for when we switch to multi-round battles.  That's out of scope for this next phase of development.

#### Architecture Note

We want this system to be easily extensible, in case we want to later add or remove stats.  For example, I would like to test some sort of dodge mechanics eventually, but I'll want to see how it feels dodge-less first.  Moreover, we probably want to hoist as many constants as we can out to config files--multipliers for the various % buffs, the 2x for critical hits, etc.  I just picked reasonable-sounding numbers, and they'll definitely need balancing.

### Upgrades and Levels

Every unit has a level and can level up, probably numerous times.  Each level-up works as follows:

* Every stat has a growth rate chance.  This is determined by the unit archetype.
* On level up, each stat has an independent chance (equal to the aforementioned growth rate) to grow by one.

Every level 1 unit of a given archetype should have the same base stats.  When asking for a level n+1 unit, we can either simulate n level ups (I imagine this is what we'll do when drafting units), or just increment each stat by the growth rate \* n and then round to the nearest integer (this is what we'll do for enemies).

#### Gaining Levels

I'm still not sure what's going to feel best here, but my initial thought is units keep a standard XP pool and gain XP proportional to damage dealt.  But I've also thought about just doing flate rates per participation, or even just per battle. 

#### Architectural Note

Again, we want to hoist as much as we can about the archetypes to configuration files.  Ideally, they're completely config-defined in terms of base stats, growth rates, and which abilities they have--the only hard code defines the assorted attack abilities.  Moreover, adjusting enemy level becomes our primary balance tool, replacing the current %HP buff system.

### Miscellaneous Changes

#### Pathfinding

On maps with long, narrow paths like Endless Corridors, the pathfinding often leads to strange behaviors such as units starting to backpedal and reroute, seemingly at random.  Two theories why:

* Friendly units farther ahead basically block the way.
* The unit's target is changing.

In the case of the former, I think the solution would involve unit-blind pathfinding with a boids approach on being blocked?  For the latter, we probably want a more sophisticated targeting system.

#### Visual Improvements

Right now, our sprite color flashing system kinda breaks down for more clustered battles--it becomes hard to see who's attacking who.  I want to add proper "animations."  For melee, I'm thinking just a simple shove in the direction of the unit being attacked.  For the ranged attacks, a small projectile.  I'd also like to test replacing the current on-damage flash with proper hitsplats.

