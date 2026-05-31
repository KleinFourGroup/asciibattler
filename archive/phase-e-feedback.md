# Phase E Playtest Feedback

* Attacks do not quite line up with their damage.  Damage is applied on the tick that the attack occurs, but the animation only begins at that exact moment.  While this isn't much of a problem for the attacks of the melee and archer units, as their animations are quite quick, it's more noticeable with the mage (where the explosion SFX sounds immediately), and the catapult, with its more elaborate animation.

  * (Related: the catapult projectile moves too quickly.  Slowing it down, however, will increase the mismatch further.)
  * I'm not sure the best way to handle this, short of breaking attacks into "stages," like "charge," "start," "land," and "finish."  Some of those will definitely need to be optional / have duration zero.  Also, if we ever want some really elaborate multi-phase attacks, the system will need to be more extensible than that.  This also introduces a problem where an attack might fire directed at a unit that dies before the attack lands.  We're already dealing with that with the catapult, but it's something to keep in mind.  Is there an industry standard approach for this?
* The catapult animation occasionally misses the unit it hits.  The animation appears to approach the logical tile of the target, not the sprite.
* The rogue definitely needs to show both the attack and move animation when it does its gambit strike.  Right now, it just looks like it's retreating while damage is mysteriously to adjacent units.
* We need more visual indication around heals.  Maybe some sort of + glyph effect on the healed unit.  I'm unsure if this need apply to the chip healing from the regeneration tiles, but it definitely needs to apply to the healer heals.
* Healing (and really any future utility abilities) needs to award XP.  Maybe an analogous XP per unit of healing knob?
* We need to add the new units to the draft pool immediately, before the Phase F rework.  It's hard for the playtesting to manually gauge balance when the new units only appear in a manner dictated by a URL argument.  I propose we just add them into the recruitment phase with all equal probability, and make the selection choice be three separate unit archetypes.

