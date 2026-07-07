# Cluster 3 Specification

## "It's the economy, stupid!"

This specification seeks to flesh out the "economy" feature cluster for ASCIIbattler.

### Naming

Please note that "gold," "consumables," and "inventory" are pending names; I'd like to find ones more fitting with the techy double meanings we have for daemons, sectors, and hops.

### Gold

Gold is the primary currency.  It is tracked across a run, given as a reward for almost every battle, and used to purchase items and services in shops.

* The gold reward for an encounter is now defined as part of the encounter schema.  I'm tentatively thinking it's chosen uniformly at random from a given range.
* I'm thinking it's displayed persistently at the top right.

  * This will need to display both in and out of battle.

Engine notes:

* We'll need hooks for on change gold amounts, so daemons can hook into it.  I.E. a "gain 20% more gold" one, or a "heal on losing gold" one.  (The former is almost certainly happening; the latter is an example I made up off the top of my head.)

### Consumables

Consumables are... Well, consumable items that grant various effects.  They take a target on which they act:

* In battle:

  * A unit, possibly gated by team.
  * A tile.
  * Nothing--it's a battle-wide effect.
* Out of battle:

  * A unit, via the roster
  * A unit via the discard or draw piles
  * Nothing--a run-wide effect

#### Mechanics

Anything a daemon can do a consumable can as well, and vice versa.  So we'll start with some empower ones, and a redraw-2 one.  This will have some knock-on effects for the existing daemons.  Right now, empowers and redraws are very "inline"--they just appear on the pre-turn screen.  We now need them to be able to "fire" at any time on the pre-turn screen, and the daemons' effects just happen to fire right away and automatically.  I'm feeling each one pops up a special window, maybe?  Design round definitely needed.

### Inventory

Every run now carries an inventory.  This is where consumables are stored.  Inventory has a size (I'm thinking six to start), and this size can be changed throughout the run by future daemons and consumables.  Items in the inventory can be discarded.

### Reward Tables

* A reward table is a list of items (consumables or daemons).
* Each item within has a corresponding weight.
* When a reward table is sampled, a random item from the table is chosen with probability proportional to its weight.

  * Daemons the player already has are excluded.

The encounter schema is further modified: an encounter has a list of reward tables, each with an activation trigger.

* When an encounter is won, each is *independently* tested to see if it triggers.
* If the table is triggered, it's sampled, and the result is added to the list of rewards.
* The player is presented with their rewards after winning an encounter but before they recruit.
* They player may decline any portion of their rewards.

I am imagining that there is a separate list of reward tables (plus an associated editor), and the encounter schema merely references them by name.  That way, we avoid redundantly recreating the same few tables for each encounter.

### Shops

Shops are a new type of node in sector maps.  At one, you can:

* Recruit from some number (starting point: 5?) of units, each with a randomly chosen price based on archetype and level.
* Purchase from some number of consumables (starting point: also 5)
* Purchase from some number of daemons (starting point: 2).
* Sell any consumables you have.
* Pay to remove one unit in your roster.

We'll need an editor to tweak prices and such.

