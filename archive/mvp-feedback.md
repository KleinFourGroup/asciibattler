# Engine Notes

## Actions

* I want to split up the concepts of cooldown and duration for actions.  Cooldown is simply the number of ticks that must elapse before that same action can be performed again.  Duration is the number of ticks before ANY subsequent action may be performed.  It's intuitively the amount of time the action takes to execute.  For something simple like movement, these should be the same.  For anything else, we shouldn't assume as such.
* On that note, we probably want to allow for actions to have effects on possibly several ticks, not just the tick the action is executed on.  That way, we can have actions that take place after a slight charge / delay, and so on.

## Input

* I mentioned before being able to give limited commands during battles.  Mainly I'd imagine these would be simple commands taking either no target (i.e. switch to the more defensive AI) or one target (focus on this enemy or location).  We should make sure the engine supports input sooner rather than later.
* All input, be it having an in-game effect or just a simple dev toggle, should be callable when running headless for testing purposes.

## Testing

* We need to get a headless fuzz testing system up and running.  This will be both to uncover bugs and to collect balance data.  We'll probably want several different modes, from pure random noise to slightly more strategic thinking.

## Saving and Loading

* We definitely want to add the serialization support necessary for saving and loading sooner rather than later.

## Code Organization

* There are several empty .glsl files in the codebase, all of which are stubs / empty, while all actually used shaders appear to be stored as simple const strings.  We should actually hoist those out to the proper files.
* We should probably begin hoisting out unit stats and other configuration defaults to .json files as well, in preparation for future work.
* Right now, there's really only one "game scene"--BattleRenderer+World.  Everything else appears (after a cursory check) to just be managing the visibility of various DOM menus.  This system will break if we ever add any minigames, convert any DOM menus to something requiring engine rendering, and such.  We should set up a proper scene system.

# Graphics

* One minor issue with the scanlines and dithering effects: they don't apply to the DOM UI.  For the dithering that's fine, but for the scanlines it's a bit incongruous.
* I think the full palette quantization system might actually be too restrictive.  Right now, it seems to be impossible if we want any glow effects, unless we want to lean heavily on some sort of stable dithering.  I think we should probably shift to the palette focusing on the terminal greens and ambers and the various neons, and allow any darker or lighter shades of them, all the way up to black and white.  This will probably shift our vibe to be a bit less "old terminal" and a bit more "Tron," so we should probably prepare some demonstrations.
* Let's also go for a more low-poly style for 3D assets.

# Gameplay and Design

* The "terrain being inconsequential to the grid" isn't working.  We should shift to something more like a traditional tile system, where the arena is built up from a grid of blocks, each corresponding to a different type of terrain (which might have consequences for combat).  We should also expect various obstacles (walls, etc.) scattered throughout the level.

  * Open Question: Should walls be a rendered block, or should we stick to roguelike convention and make them a billboarded "#"?
* The random stats system for recruiting new units is a bit too intensive.  We should transition to a system where we draft from a pool of unit types instead.  We probably want a rarity system for more powerful units.
* Some miscellaneous thoughts on archetypes:

  * Mage!
  * Some sort of rogue with very fast speed, weak but fast attacks, flees between attacks
  * Some sort of healer.  Again, tries to avoid combat.
  * Obviously these are vague starting points, not exhaustive, expect more bespoke variations, etc.
* We'll want some sort of unit upgrade / leveling system too.
* I was correct; we definitely need individual health bars under units.  A bar indicating progress through the current action would be good too.
* While the current difficulty scaling works well for our five-floor runs, I think it will rapidly outpace the player for anything longer.  We probably get around this via tuning from the aforementioned fuzz testing, and more carefully designing enemy encounters.
* I'm thinking that we probably want to expand each map to 10 floors, and go through a few maps per run.  (Terminology pending.)  Aiming for an hour per run.
* Thoughts: maybe, instead of having each combat be one huge battle, we take a page from deckbuilding roguelikes, randomly drawing some number of our units over a series of smaller battles.  Wins and losses deplete some sort of meta health.  Might really help with snowballing.

