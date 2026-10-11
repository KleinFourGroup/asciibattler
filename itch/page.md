# ASCIIbattler

ASCIIbattler is a roguelite, deckbuilding autobattler, with the aesthetic of a traditional roguelike re-imagined in 3D.  You lead a band of units across a series of branching maps ("sectors"), along the way recruiting new units, finding special items, and coming across random events.

## How to play

### Runs

Choose "NEW RUN," and then select a character.  Right now, there are three: The Soldier, The Priest, and The Gambler, each with a unique starting roster and passive item ("daemon").  From there, you can begin to traverse each sector one node ("hop") at a time.  Each hop comes in six flavors:

- Battles, which should be self-explanatory;
- Elites, which are longer and harder fights;
- Rests, which allow your men to recover morale and gain additional XP;
- Ports, which allow you to spend money ("bits") on units, consumables ("packets") and daemons;
- Events, which are small choose-your-own-adventure text encounters; and
- Bosses, which are the longest and hardest fights.

A run consists of two sectors, and each sector ends with a boss.  Throughout the run, your team maintains a health pool ("morale").  Should your morale hit zero, you lose, and the run is over.

### Battles

Each Battle consists of one or more turns, rounds of autobattler combat against a wave of enemy units.

**Before a turn** begins, you are dealt a hand of units from your roster.  These are the units that will fight for you in the upcoming turn.  However, some daemons may grant you the ability to modify your hand, by allowing you to either buff ("empower") or discard and redraw units.  Packets give similar abilities.  Once you are satisfied with your hand, press FIGHT to begin combat.

**During a turn,** units broadly fight on their own.  However, you may issue one of four types of general orders to shape the battle:

- Engage: loosely target an enemy or location, engaging with hostiles along the way.  This is roughly the equivalent of an attack move in a traditional RTS.
- Focus: ignore any other hostiles and attack the target unit or move to the targeted location.  This is roughly the equivalent of a right click in a traditional RTS.
- Hold: hold position and engage only those hostiles immediately in range.
- Stop: belay the current order and engage at will.

Left-click an enemy unit or location to Engage, and right-click to Focus.  (All four orders also may be issued via UI buttons and keyboard shortcuts.)  Combat can be paused, sped up, and slowed down via UI buttons and keyboard shortcuts.

Every unit of yours that falls during a turn costs you morale, and every enemy that falls likewise costs the enemy morale.

**Battles are won** when the enemy's morale hits zero.  This grants you bits and packets and lets you recruit a new unit.

### Additional Mechanics

- Winning a run unlocks higher difficulties ("escalations") for the selected character.  The escalation level of a run is chosen at character selection.
- A run's progress is saved automatically on any decision outside of battle.  No more than one save can exist at once, and a save may be resumed from the main menu.

### Settings

The game's settings may be accessed from the main menu or from the in-game settings button.  You can do any of the following:

- Set the volume.
- Change the text size (larger sizes need a larger window).
- Toggle reduced motion.
- Toggle a colorblind palette (requires a reload).
- Rebind key shortcuts.

## Feedback

Feedback is both welcomed and encouraged!  While we've done our best, ASCIIbattler currently lacks extensive playtesting.  I'd love to know what's fun, what isn't, what's unintuitive, what you think is missing--really, anything!  To report a bug, clicking EXPORT RUN under settings saves a file with the latest completed run's seed and every choice you made.  If you wish to report a bug mid-run, use EXPORT EVERYTHING, which includes all data.  Upload your data to your file sharing website of choice and post it along with both a description of your setup (which clicking COPY DIAGNOSTICS under Settings copies to your clipboard) and a description of the bug in the comments below.  Alternatively, you can open an issue on [GitHub](https://github.com/KleinFourGroup/asciibattler/issues), where the file can be attached directly.

## Requirements and Limitations

- ASCIIbattler has been tested in Firefox and Edge on desktop.  Chrome *should* work, as we have a functional Electron-based internal build.  Safari has not been tested and is not formally supported.
- ASCIIbattler's minimum supported resolution is 1280×720.  If that doesn’t fit your screen, use the fullscreen button in the frame’s corner.  Larger text sizes are only recommended on larger screens.
- Progress is saved locally in your browser's storage.  There is no cloud storage.
- Expect save compatibility to break as the game is updated.  The main menu will warn you of an incompatible save.  Only run progress will be lost; settings and unlocks should persist.
- ASCIIbattler is neither feature nor content complete!  Among other things, we intend to add the following:
  - A third sector per run.
  - Variant versions of each sector.
  - Flying units.
  - Special attacks.
  - A slew of additional events, enemy encounters, maps, daemons, packets, and units.
  - Additional meta-progression.
  - Support for non-English locales.
  - A proper Steam release, if you all like this!

## Source Code

The source code for ASCIIbattler is available [on GitHub](https://github.com/KleinFourGroup/asciibattler).

## AI Disclosure

ASCIIbattler was developed with AI coding assistance (full setup and history on GitHub), including some functional text such as menu buttons, tooltips, and error messages.  Some sound effects were programmatically synthesized, with AI assistance writing the generator code.  The game’s design, prose, and art direction are human-authored.