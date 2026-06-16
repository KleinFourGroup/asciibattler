# Phase N Feedback

We have identified a major flaw with how fights play out.  Namely, right now, the player's units and the enemy units by-and-large just rush to the middle of the map and engage in a chaotic melee.  Excluding maps like Endless Corridors, where the pathing leads to units getting split up, the frontline does not move, the rest of the map is not utilized, and the battle ends with no real tactical variety.  We've identified a few ideas on how to fix this:

* Allowing a greater degree of player control over unit AI.
* Adding additional side-objectives throughout the map.
* Including dynamic terrain features to physically break up unit blobs.

This feedback document addresses the **first** idea.

### Expanding the Objective System

Right now, the objective system sets an objective (either a tile or an enemy unit), and lightly preempts targeting and pathing priority.  This ultimately works out to an equivalent of an RTS attack move: the player units approach the objective, engaging any enemies that they encounter along the way.  We propose two additional objective modes: focus and hold.



Focus works as follows:

* A focus objective works just like a regular objective, except that it completely preempts targeting and pathing.  Player units engaged in combat will abandon that objective in favor of engaging the focused enemy or reaching the focused tile.
* One unresolved point is the behavior of focused tiles that are unreachable and / or occupied.  As things stand above, once the first player unit reaches the focused tile, all other player units will boid around the now-occupied tile, ignoring attacking enemies until either the player remembers to cancel the objective or the player units die.  We see three possible solutions:

  * Simply disallow focus on tiles.  Programmatically simple, but least control.
  * Clear the focused tile objective once any player unit achieves it.  Also simple, but might not be intuitive to players.
  * Give each unit the standard objective attack leash once they have reached the closest unoccupied tile to the objective.  Most complex, probably the most intuitive to players, hardest to code.
* We do not know which of these options will be most satisfying, so we should ensure that all can be easily implemented and switched between.



Hold is a completely different type of objective.  It simply instructs all units to stop moving.  They may act in place, attacking anything that comes into range, but they can neither move to engage nor pursue.

#### A Note on Implementation

While these objectives will hopefully be enough, at least for now, we should refactor the AI system such that there is always an objective, and that objective is fed into (or otherwise readily accessible by) the individual unit behavior systems.  Each objective would have a type and a data payload.  The original objective would become objective type "Engage," and the current no-objective would be type none/default/at-will/etc.  (The name for this one is purely internal, so it doesn't strictly matter.)  An objective auto-clearing would thus amount to changing the player's objective back to this none/default/at-will type, rather than actually setting no objective.



We should also make sure that the enemy team also full support for objectives, to prepare for possibly smarter enemy encounters.  For now, however, the enemy objective will always be set to none/default/at-will.

### Objectives and Reaction Time

Right now, battles start too quickly for players to have enough time to issue thought-out objectives.  Enabling the spawn animation to the initial units was an early attempt to fix this, but this animation is far too short, and also has met with mixed reactions in playtesting (as everything else is static, it reads as loading).  I propose the following new solution:

* Disable the initial spawn animation again.
* Every battle starts with a configurable countdown instead (five seconds seems like a good starting value).
* No ticks should be occurring during this countdown.  Objectives may be given, but the sim is effectively paused.

On that note, I additionally propose that our current scheme for fast-forwarding battles be expanded:

* Include an 0.5x playback option, as well as a pause, during which objectives can be set.
* We should be able to individually disable pauses and specific speeds, in preparation for difficulty levels.

### HUD Overhaul

Right now, objectives and game speed are all located in the singular game HUD, along with a full catalog of the health and a few key stats of all units in a battle, and with the player and enemy health pools.  This has gotten cumbersome and overwhelming.  We propose the following reorganization:

* Objective commands are moved to a new pane in the bottom right.

  * There should be a button for each of the objective types.  The none/default/at-will one is specially labeled "Stop," as it appears (to the player) to clear other objectives.
  * Objectives requiring a target cell or unit (currently engage and focus) should operate on the principle that, once clicked, the next click sets said target.  The actual team objective obviously does not change until said target is specified.  If the player selects an invalid target or clicks somewhere else in the HUD, the target selection mode is aborted, and the player will have to reselect the desired new objective type.
  * All buttons should have a hotkey, routed via the rebindable hotkey system that we started.
* Game speed commands should go to a new pane in the top right.

  * As we have added new speeds and a pause option, cycling through different speeds via a single button is now too cumbersome and imprecise.
  * Each speed should have its own button, arranged from left to right in increasing order, only showing allowed speeds.
  * Once again, these should all have hotkeys via the rebindable hotkey system.  Defaults: 1 for 1x, 2 for 2x, 3 for 3x, 0 for 0.5x, and space bar for pause.
  * When the game is unpaused, play should resume at the speed it was at prior to the pause.
* A new pane in the bottom center contains player unit information and player health pool.

  * Player unit information is displayed via a card system.
  * Each card contains the unit's glyph, displayed in a reasonably large size..
  * Above the glyph is the unit's level and power, in a smaller text.  Level is left-justified and power right-justified.
  * Beneath the glyph is the unit's health bar.  The health bar is the width of the glyph.
  * When a unit dies, their card is grayed out.
  * Beneath all of the player's cards is a health bar displaying the player's run health pool.
* The pane at the top is expanded to show the enemy's units and encounter health pool.

  * At the very top, as is the case now, is the map layout.
  * Beneath that is the enemy encounter health pool bar.
  * And beneath that is an analogous unit card system.
* The pre-turn display which shows the cards that the player has drawn (and allows the redraw and empower mechanics) absorbs the key stats dropped from the HUD.

  * Those cards are expanded to be the same as the cards shown during recruitment, showing all stats, and beneath a list of abilities with relevant derived stats, and somewhere in there an XP-to-next-level progress bar.
  * The code should probably be shared between the two screens.

### Miscellaneous Changes and Cleanup

* Pursuant to this being the anti-blobbing behavior update, I propose that ranged abilities be given a minimum range.  This will force ranged units to fall back when engaging a melee target, in order to find a new tile from which their target is reachable.  This minimum range may be zero, resulting in current behavior.
* On the pre-turn screen, we need a way to see which units are in the draw pile, and which are in the discard pile.  I propose the former have a button in the bottom right, and the latter in the bottom left.
* On the map screen and recruit screen, we need a way to see the player's entire roster. Probably a button in the top right.  It can be there in the pre-turn scene too.
* These should all probably share code / the same card display type.
* The pre-turn screen refers to procedural maps as "Uncharted Ground," but the in-battle banner says "Nowhere."  These need to be unified.

