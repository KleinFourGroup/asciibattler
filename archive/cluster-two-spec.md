# Cluster 2: Spatial and Movement

This cluster specifies our goals for Cluster 2 specified in the meta-roadmap document.

### Core Mechanic Hardening

We continue to have intermittent issues with units occupying the same tile.  As such, I propose that we must attack this from several angles:

* Move proposals must all be proactively checked for whether or not their destination is occupied.
* We must add an abort move system for moves in progress which find their destination occupied or untraversable.  (This should largely be a no-op, as moves are resolved instantaneously; see the next section for further details.)
* We must add a shove system to forcibly separate units that do end up on the same tile.
* We must add full occupancy testing during fuzz testing.

### Non-instantaneous Moves

A persistent minor quibble during playtesting is the instantaneous nature of moves.  Particularly with slow units, it can be jarring to see a moving unit attacked at melee range when the unit still appears to primarily be on its prior tile.  We ran into a similar problem when applying tile-initiated status effects.



The naive solution to this is to have the logical tile change occur in the middle of the move action, rather than instantaneously.  However, this creates a pathfinding difficulty.  Namely, two units may both attempt to move to the same vacant tile, with neither being aware of the imminent collision until up to halfway through the lerp.  (Alternatively, dynamic terrain effects might render the destination tile inaccessible, or a non-pathed knockback effect might move another unit to the destination.)  The introduction of a move abort system offers a possible solution, with whichever unit that would resolve the move second being forced to abort.  I foresee two possible issues with this, however:

* It's not immediately clear how to smoothly animate an abort, in particular without it visually colliding with the melee attack animation.
* In crowded melee engagements, the majority of moves may plausibly end up aborted, slowing down combat and otherwise muddling the encounter for the player.



We propose the following solution:

* A unit, upon selecting a destination tile, may "claim" said tile.
* A tile is considered occupied for pathfinding purposes if it is either occupied or claimed.
* A claim is released when the move actually resolves.

This neatly resolves aborts caused by other units' pathing, though aborts caused by future dynamic terrain may still exist.

### Terrain, Palette, and New Tile Mechanics

#### Palettes

Right now, we support three terrain: default, rock, and volcanic.  We propose adding the following new ones:

* Tundra.  Snow aesthetic, with blue-white coloring.
* Desert. Sandy colors.
* Swamp.  Darker, browner greens, and outright browns.

We also propose that "rock" be renamed "barren" or "mountain" (still debating) and "default" be renamed "grassland."

#### New Terrain

We propose the following new tiles:

* Deep water.  Primarily impassable, though we expect a few future unit archetypes (think marine or privateer) to be able to pass it, with the same effects of water, but doubled.
* Hills.  Renders as a handful (3-6, maybe) of small, low-poly hills/mountains.  Slower to walk over but increase evasion.  Otherwise visually conforms to the layout's palette.
* Ice.  Faster to walk over but with a severe accuracy penalty.
* Sand.  Slower to move on and decreases evasion.
* Mud.  Same severe mobility and accuracy penalties as deep water.

#### New Tile Mechanics

We have heard feedback that the DoT status effects need additional differentiation.  We believe that these additional tiles give a good opportunity to begin this process:

* Both water and deep water should remove burn effects.
* I would like to trial having mud apply a light poison effect.  May alternately be a mud variant entitled "mire"; obviously still debating this.

### Multi-tile Units

Right now, all units are occupy exactly one tile.  Originally we planned to merely implement a seam for larger units with future consumers in mind.  We now have identified a consumer within this cluster: destructible objects (see next section).  I propose the following scheme:

* All units now occupy an N-by-N square, for N from 1 to 4.
* The glyph for the unit is appropriately scaled up.
* One of the square's corners is the canonical location of the unit.
* When spawning in, the unit may either spawn in with its canonical location equal to the spawn tile, or it may spawn in anywhere at random with the spawn tile intersecting the unit's footprint.

  * Not sure which plays better; trying to avoid adding new classes of spawns.

### Destructible Terrain

We would like to add a debris/rubble/rocks neutral unit.  Their point is to deny access to areas of the map until destroyed.

* These units may be anywhere from 1x1 to 3x3, and have a configurable health pool.
* We will additionally be finally enabling optional destructibility for walls and half cover.
* Targeting the new destructible units happens automatically, albeit at a lower priority than hostiles.
* Walls and half cover must be manually targeted (or hit by AoE).

### Flight: Deferred and/or Design Round Needed

Honestly, this spec is already far bigger than I expected.  I'm inclined to label this out of scope, as this will probably already be the biggest cluster by far, and there are several key questions I haven't decided on:

* Can flying units land, or are they always flying?
* Can flying units occupy the same tile as a land unit?
* Can flying units pass over all walls, or do we have a new blocks flight property?
* Which attacks are surface to air versus air to air versus air to surface versus surface to surface.

But we should do a design round to discuss the ramifications of these on the other systems.

### Idea: a Fully Data-driven System for Units

The destructible terrain system introduces significant variability in neutral units: different sizes, different health pools, whether or not they even have health pools, different glyphs while otherwise being functionally identical, and so on.  We furthermore already have independent pathing versus line of sight blocking.  And this says nothing about the active units, which require code edits to enable full creation of new unit archetypes.  (Also, as I'm writing this out, we'll probably want destructible units to be burnable, and I can imagine future ones being freezable, but obviously we don't want poisonable walls.)



This system is... A bit complicated.  We propose unifying all units, playable, neutral, static, etc., into a single, unified data-driven system, akin to what we did for abilities.  I don't know how this would look under the hood.  Maybe a "light" ECS?

