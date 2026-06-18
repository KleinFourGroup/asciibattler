# Phase R Feedback

In the last road map, we implemented one of three suggestions to address the problem of blob-heavy battles.  While the changes, in particular the minimum range change to ranged units, have had a greater than expected effect on the static blob battles, they also surfaced numerous latent bugs.  This leads us to believe that the game as-is needs greater coverage of combat scenarios.  As such, we are deferring the additional two anti-blob strategies in favor of a proper encounter system.

### Seam for Future Use: Zones

A zone is one node/encounter DAG map, such as the 11-floor one we currently generate.  Each run now consists of a series of fighting through a series of zones.  Our goal is eventually three, though for this initial specification, it will just be one.  Zones have:

* A title
* A description
* A length
* A theme (for procedural layouts)
* A list of layouts that may appear within the zone, with an optional floor gate.

Zone selection for a run will be specified by its own DAG, with each node consisting of a list of layouts.

* A run randomly selects a source node to start.  It then randomly selects a zone from the node's list.
* After a node's zone is completed, a random successor node is chosen.
* A run is completed when a sink node is reached.

Even though this is quite a general system, our initial implementation will just have one node, containing one zone.  The initial zone will be called "The Start" (very creative, I know), will have theme default, and will have all layouts.

#### Dev Tooling

* We'll definitely want a small dev tool to assist with creating and editing zones.
* The zone selection schema for runs can probably stay pure JSON for now.
* We'll want a toggle in the layout editor to add new layouts to (possibly many) zones.

#### Miscellaneous

* Right now, the root node of the map is not selectable.  We'll want to make it a normal node.
* Zone doesn't really carry the connotation of verticality that Floor does.  While I will continue referring to floors in this document, I think we'll need to rename them.

### Encounters

An encounter replaces our current system of random enemy waves.  An encounter consists of the following:

* A name

  * This replaces "Foe" in the new in-battle HUD.
* A health pool.
* A list of layouts that this encounter might appear on.
* A list of zones this encounter might appear on.
* An optional minimum floor gate.
* A list of waves of enemies.

A wave takes the following arguments:

* A total level budget, either a fixed number or a multiplier of mean or median player roster level
* A total unit count, either a fixed number or a multiplier of hand size
* A list of units.  Each unit comes with:

  * Archetype
  * Count, either a fixed number or a weight
  * Level, also either a fixed number or a weight

When a weight is given, a value is assigned from the corresponding level / unit count budget, minus fixed values, in proportion to the other corresponding weights.  For example, if a unit count of ten is given, two catapults are called for, bandits with weight three, and archers with weight one, we'll get a wave of two catapults, six bandits, and two archers.  If the fixed values exceed the corresponding budget, unit counts of zero are possible.  Level, however, must be positive.

The wave list obeys the following grammar:

* Each entry is either a wave specification, a list of wave specifications and weights for random selection, or a loop block.
* Loop blocks have a repeat count, which may either be a positive number or forever.
* If a list is finite (due to having no forever loops), we specify if the entire list loops or the find wave repeats.

Initially, we just want a dirt simple encounter duplicating as closely as possible the current random ones.

## Dev Tooling

* Again, we'll definitely want a dev tool to assist in writing these.
* We're going to want to update our fuzz/balance telemetry to report on per-specific-encounter data.

