# Post-C1 Feedback

* The maps are too small.  We need them to support varying sizes.

  * I propose a minimum of 8 tiles and a maximum of 32.  Length and width need not be the same.
  * Purely random maps should have dimensions chosen at random from between 10 and 20 tiles.  We'll keep them square.
  * As larger maps will break our purely static camera, we'll need a camera that automatically zooms out to show the larger map, and a smaller one that the player moves around.  Tentatively I'm thinking the former would be the default for development, with the latter being the default for playing.  That'll need beta-testing though, so for now, both.
  * We'll need to up our sprite buffer size to 1024 from 256.
* Right now, team spawns are too restrictive.  I propose the following:

  * A team spawn consist of eight tiles.  They need not be contiguous / touching.
  * Units are placed in the tiles of a team spawn at random.  If a team consists of more than 8 units, the extras spawn in as tiles are vacated.
  * A map may contain multiple team spawns.  Each one may be available to the enemy team, your team, or both.
  * At the start of a battle, your team and the enemy team are assigned a random team spawn, chosen among the spawns available respectively.
* We need some additional tiles and static units.

  * UNIT: Some sort of half-cover that blocks pathing but not line of site.  Might have health like walls.
  * TILE: A chasm.  Likewise blocks movement but not LOS.
  * Tile: Fire / embers.  Fully traversable but does chip damage while units are on it.
  * TILE: Healing pool.  Ditto, but does chip healing instead of damage.  Not actually sure if we want it to be a "pool" or not, though.
* Tiles need some visual variety as well.  Some different way of "reskinning" them. Ground tiles could use a gray rock theme and a red volcanic theme.  The other proposed tiles are still pending.
* We'll need the editor to support all of this.

  * I think we'll want to be able to edit separate terrain, neutral unit, and spawn layers rather than the combined system now.
  * It'd be nice if we could drag-paint the contents rather than having to click each tile individually.

After we've got all of this done, we can move on to working on the units / combat mechanics.  With the current constrained maps, I don't think we'll be able to properly assess those changes now.

