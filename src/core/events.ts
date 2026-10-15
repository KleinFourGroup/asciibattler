/**
 * The event catalog: every event on the bus and its payload. A new event is
 * added here first, so the type system guides every emitter and subscriber,
 * then to ARCHITECTURE.md's "Event catalog (outputs)" and to
 * `src/audio/eventSounds.ts`, as a cue or as silent with a reason. When this
 * file and the doc disagree, this file is right and the doc is fixed in the
 * same commit.
 *
 * Names are `subject:verbed`, past tense and lower case, because the bus
 * carries only what happened. Player intent goes through the command
 * channels instead (`RunCommand` in `src/run/Command.ts`, `WorldCommand` in
 * `src/sim/Command.ts`).
 *
 * Several payload fields are optional only so a test's fake can drive Run
 * without a real World; every real emit sets them.
 */

import type { GridCoord } from './types';
import type { Team, UnitStats, UnitTemplate } from '../sim/Unit';
import type { Archetype } from '../sim/archetypes';
import type { ActionPhaseName } from '../sim/Action';
import type { ObjectiveTeam, TeamObjective } from '../sim/objective';
import type { WorldCommand } from '../sim/Command';
import type { BattleEncounter, FallenRecord } from '../run/Run';
import type { MoveDecisionKind } from '../sim/moveDecision';
import type { TurnGrantView } from '../run/daemon';
import type { EmpowerStackView } from '../run/empower';
import type { RewardPortion } from '../run/rewards';
import type { Theme } from '../sim/layouts';
import type { EncounterKind } from '../config/encounters';
import type { UseContext } from '../config/packets';

/** What moved the run-wide player pool (`run:poolChanged.reason`). */
export type PoolChangeReason = 'chip' | 'heal' | 'damage' | 'rest' | 'seam';

export interface GameEvents extends Record<string, unknown> {
  tick: { tick: number };

  /**
   * `encounter` is the whole battle fixture `beginTurn` assembled (seeds,
   * layout, grid, teams, battle rules), so this event, the `command:applied`
   * stream and the outcome make a replayable trace; the trace and journal
   * recorders begin on it. Only Run emits it, and no sim or run code reads
   * `encounter`.
   */
  'battle:started': { worldSeed: number; encounter: BattleEncounter };
  /**
   * Emitted once per battle by `World.emitBattleEnded`, whoever won.
   * `xpAwards` holds one entry per player unit with a roster slot, survivor
   * or fallen, as `computeXpAwards` (`src/sim/xp.ts`) computes them; Run
   * banks them into the roster.
   */
  'battle:ended': {
    /** 'draw' on a mutual wipe or a capped turn; `reason` says which. */
    winner: 'player' | 'enemy' | 'draw';
    /**
     * Why the battle ended: `'decisive'`, one team wiped
     * (`checkBattleEnd`); `'mutualWipe'`, both teams' last units fell
     * together; `'cap'`, the driver's per-turn tick budget ran out
     * (`World.resolveAsDraw`). The cap penalty (`health.capPenalty`) keys on
     * `'cap'` alone: a mutual wipe is the largest casualty turn there is,
     * never a stall.
     */
    reason?: 'decisive' | 'mutualWipe' | 'cap';
    xpAwards: readonly {
      unitId: number;
      /** The unit's slot in `Run.team`, as `XpAward.rosterIndex` (`src/sim/xp.ts`). */
      rosterIndex: number | null;
      damageDealt: number;
      xpGained: number;
    }[];
    /**
     * Σ`power` over each team's living units on the grid at battle end: what
     * each side chips the opposing pool by under the survivors rule
     * (`health.chipMode`), and what a cap penalty charges. A unit still in
     * the spawn queue is left out, since it never reached the grid, although
     * `checkBattleEnd` counts a non-empty queue as alive.
     */
    survivorPower?: { player: number; enemy: number };
    /**
     * Σ`effectiveStats.power` over each team's combatants reaped this battle,
     * booked by `World.recordFallen`: the casualties rule's input, each side
     * paying its own fallen. A neutral charges nobody, and a summoned unit
     * (the `summonedBy` stamp) books 0 whatever its archetype weighs, since a
     * conjured body is not a loss its side paid for; a fielded one is.
     */
    fallenPower?: { player: number; enemy: number };
    /**
     * The run resources earned in battle by battle-domain daemon rules (the
     * World's serialized tally). Run settles `bits` through `gainBits`, where
     * the `bitsGain` fold applies.
     */
    tallies?: { bits: number };
    /**
     * The camps wiped this battle, with the faction whose blow finished each
     * (the serialized `killedBy` stamp, which counts a drip's units). Run
     * adds a player-killed camp's reward refs to the turn's offer, won or
     * lost; an enemy-killed camp yields nothing. Omitted when no camp was
     * wiped.
     */
    campKills?: readonly { defId: string; killedBy: 'player' | 'enemy' }[];
  };

  /**
   * Fires once per unit placed on the grid, walls and other neutrals
   * included. `instant` is true at battle setup, and false for a unit that
   * joins a battle under way (from the spawn queue, a camp's drip, or a
   * summon); the renderer fades that unit's glyph in over the spawn lockout
   * (`SIM.spawnDurationTicks`).
   */
  'unit:spawned': { unitId: number; instant: boolean };
  'unit:moved': {
    unitId: number;
    from: GridCoord;
    to: GridCoord;
    durationTicks: number;
  };
  /**
   * A position swap (a `SwapAction`): `unitA` moves `cellA → cellB` and
   * `unitB` moves `cellB → cellA` over `durationTicks`. One event rather than
   * two `unit:moved`, since the two moves share their timing and are one
   * mechanic. Consumers: the renderer, which slides both sprites from where
   * they stand, and the pathing metrics (`tests/pathing/metrics.ts`), which
   * count two committed steps.
   */
  'unit:swapped': {
    unitA: number;
    unitB: number;
    cellA: GridCoord;
    cellB: GridCoord;
    durationTicks: number;
  };
  /**
   * A swap under way ended without its flip: the flip found `to` occupied
   * or claimed (`SwapAction`), or a participant was removed before the flip
   * (`World.removeUnit`, a death mid-window). One event rather than two
   * `unit:moveAborted`, because both sprites began sliding at the start and
   * both must settle back, `unitA` to `cellA` and `unitB` to `cellB`; neither
   * moved in the sim. Without it the partner's sprite finished a slide the
   * sim never made and stood on the wrong tile until its next move.
   * Consumers: the renderer, which settles both and skips a missing sprite
   * (a dead participant's belongs to its death animation), and the pathing
   * metrics, which revert both committed steps.
   */
  'unit:swapAborted': {
    unitA: number;
    unitB: number;
    cellA: GridCoord;
    cellB: GridCoord;
  };
  /**
   * A dash: an effect's `move` op in `advance` mode carried the unit from
   * `from` to `to` over `durationTicks`. The op also emits `unit:moved`, and
   * the renderer slides the glyph on that; this event is the dash's own
   * signal, which a `unit:moved` cannot give, since a dash that lands next to
   * an enemy two cells away moves one cell, as a step does. The audio plays
   * the dash cue off it.
   */
  'unit:dashed': {
    unitId: number;
    from: GridCoord;
    to: GridCoord;
    durationTicks: number;
  };
  /**
   * A move aborted as it ran: its destination `to` was occupied or
   * untraversable by then (an earlier unit took the cell this tick). The
   * cooldown is not spent; the unit is still at `from` and tries again next
   * tick. The renderer eases the sprite from wherever it stands back to
   * `from`, which is no motion when the abort came before the slide began.
   */
  'unit:moveAborted': {
    unitId: number;
    from: GridCoord;
    to: GridCoord;
  };
  /**
   * An action held fire at a phase boundary: its def's `releaseGate` found
   * the locked target out of the firing band, or dead, after the wind-up.
   * Nothing fired, and the ability's cooldown was set to `reaimTicks`, the
   * re-aim window, already scaled by speed. The renderer draws a draining
   * amber bar over the window; without it the held unit reads as idle, since
   * an ordinary cooldown has no bar.
   */
  'unit:actionHeld': {
    unitId: number;
    actionId: string;
    reaimTicks: number;
  };
  /**
   * The movement layer's decision for one poll: why the unit moved, or why
   * it did not. Exactly one per `MovementBehavior` or
   * `SupportMovementBehavior` poll; a unit with an action under way is not
   * polled and emits nothing that tick. It records intent: the proposal can
   * still lose the selector to a higher-scoring ability, so `unit:moved`
   * says whether the unit moved. Observational only: no world state, never
   * serialized. The pathing metrics consume it. The kinds are documented in
   * `src/sim/moveDecision.ts`.
   */
  'unit:moveDecision': {
    unitId: number;
    kind: MoveDecisionKind;
  };
  /**
   * A unit's `WaitAction` won the selector and resolved within the tick: a
   * deliberate hold of its cell. `unit:moveDecision` with kind `'wait'`
   * records the intent at propose time, even when a ready attack outranks
   * the wait; this fires only when the wait runs. Observational only, and
   * never serialized, since a wait never becomes the `activeAction`. No game
   * code subscribes; the tests do.
   */
  'unit:waited': { unitId: number };
  /**
   * A unit sharing a cell was pushed off it: `World.shove` moved it from
   * `from` to the nearest free cell `to` over `durationTicks`, and emitted
   * `unit:moved` for the slide. A shove is forced, not chosen, which is why
   * it has its own event. Only tests call `World.shove`.
   */
  'unit:shoved': {
    unitId: number;
    from: GridCoord;
    to: GridCoord;
    durationTicks: number;
  };
  /**
   * A hit landed (`World.applyDamage`). `damage` is what was taken off the
   * target's HP, after the crit factor (`STATS.critMult`, applied when `crit`
   * is true), cover and defense, so a subscriber never multiplies again; on a
   * killing blow it can exceed the HP the target had left. `crit` says
   * whether the damage op's crit roll landed; the hitsplats draw crits in
   * their own colour off it.
   */
  'unit:attacked': {
    attackerId: number;
    targetId: number;
    damage: number;
    crit: boolean;
  };
  /**
   * A strike rolled to hit in `World.applyDamage` and missed: the target's
   * `evasion` beat the attacker's `precision`. No HP moved, no damage was
   * recorded and no crit applies, which is why it is not a `unit:attacked`
   * for 0. Only a damage op authored `evadable` can miss; any other, and
   * a tile's damage, never emits this. The swing and its sound ride
   * `action:phase`, which fires on a hit and a miss alike, so the renderer
   * keys only the "Miss" hitsplat off this event.
   */
  'unit:missed': { attackerId: number; targetId: number };
  /**
   * A heal op restored HP (`interpreter.ts`), emitted after `currentHp`
   * moved. Healing clamps at max HP, so `amount` is the HP gained, and 0
   * when the unit was already full; it still fires. `healerId` is the
   * caster, or null for a heal with no caster, which no shipped source
   * emits; the heal sparkle plays only for a caster's heal. A healing tile
   * does not emit this: it sustains the `rejuvenate` status, whose ticks
   * surface as `status:ticked`.
   */
  'unit:healed': { unitId: number; amount: number; healerId: number | null };
  /**
   * One arc of a chain attack reached a target, on the tick that hop's
   * damage lands, so with `hopDelaySeconds > 0` the renderer draws the
   * lightning jump by jump. `from` and `to` are the arc's cells (`from` is
   * the caster's at `jumpIndex` 0, otherwise the previous victim's);
   * `targetId` is the unit the hop struck, and `casterId` gives the team
   * colour. Render-only: each hop's damage rides its own `unit:attacked`.
   */
  'unit:chained': {
    casterId: number;
    targetId: number;
    from: GridCoord;
    to: GridCoord;
    jumpIndex: number;
  };
  /**
   * Fires once per unit removed from the world, after it has been spliced
   * out of `world.units`. Nothing can look the dead unit up, so the payload
   * carries what subscribers need: `team`, to tell a combatant from a wall
   * or other scenery; `campId`, since the death sound plays for a camp
   * member but not for crumbling scenery; and the fallen ledger's input.
   *
   * `archetype` and `level` are the unit's; `power` is what
   * `World.recordFallen` booked to its side's fallen total, the number the
   * casualties rule charges (0 for a neutral and for a summon), so the
   * deaths of a battle sum to `battle:ended.fallenPower` exactly (the Run
   * ledger's cross-check). `summoned` (the `summonedBy` stamp) says why a
   * power reads 0, so a ledger skips conjured bodies by kind rather than by
   * a zero that a def might one day author. `tick` is the tick the death
   * was reaped on.
   */
  'unit:died': {
    unitId: number;
    team: Team;
    campId: number | null;
    archetype: string;
    level: number;
    power: number;
    summoned: boolean;
    tick: number;
  };

  /**
   * A status (burn, bleed, poison, rejuvenate…) was applied to, ticked on, or
   * expired off a unit. They drive the status display: the renderer resolves
   * the status def's `fx` keys through the FX registry for the apply flash,
   * the tick cue, the expiry fade and the overlay. `sourceUnitId` is the
   * applier, or null for a tile's status (a fire tile's burn). Only a status
   * from the catalog (`config/statuses.json`) emits these; a plain stat
   * effect (empower, fatigue, a dodge buff) does not.
   *
   * `status:ticked` carries the tick's `amount`, the HP the DoT took or the
   * HoT gave after mitigation, so the renderer floats the number off this
   * one event; a status tick emits no `unit:attacked` or `unit:healed`.
   */
  'status:applied': { unitId: number; statusId: string; sourceUnitId: number | null };
  'status:ticked': {
    unitId: number;
    statusId: string;
    sourceUnitId: number | null;
    amount: number;
  };
  'status:expired': { unitId: number; statusId: string; sourceUnitId: number | null };

  /**
   * An action's phase began. Fires once per phase that begins on a tick, in
   * the phases' order, for every action under way; a zero-length phase fires
   * on the same tick as the next. The renderer's FX driver resolves the
   * action's fx key for the phase through the registry
   * (`src/render/fxRegistry.ts`): projectiles, bursts, camera shake, the
   * melee lunge, the bow tracer and their sounds. Driving the strike cue off
   * this event plays it on a miss too, since the phase fires on a hit and a
   * miss alike. It carries no damage; that rides `unit:attacked` and
   * `unit:healed`. `targetId` is set for an action that tracks a unit,
   * `targetCell` for one aimed at a cell; both are omitted for an action
   * with no target (a move, a spawn). No sim or run code subscribes.
   */
  'action:phase': {
    unitId: number;
    actionId: string;
    phase: ActionPhaseName;
    targetId?: number | undefined;
    targetCell?: GridCoord | undefined;
  };

  /**
   * A team's objective was set or replaced through the `setObjective`
   * `WorldCommand`. The renderer and the HUD draw the player team's
   * objective marker off it.
   */
  'objective:set': { team: ObjectiveTeam; objective: TeamObjective };
  /**
   * A team's objective went back to `atWill`: by the `clearObjective`
   * command, or on its own when an `engage` target died
   * (`World.clearResolvedObjectives`). A `tile` target never reverts on its
   * own. The World emits it only on a real change from a non-`atWill`
   * objective to `atWill`.
   */
  'objective:cleared': { team: ObjectiveTeam };

  /**
   * A drained `WorldCommand` took effect: once per command at the drain,
   * after `applyCommand` ran, stamped with its effective tick, the first
   * tick whose unit actions can see it. The drain inside a tick stamps the
   * current tick, since it runs before the units step; a drain while the
   * battle is parked (the countdown, a pause) stamps the next tick, since
   * the frozen tick's units already acted. So a replay injects every
   * command stamped E before tick E (`src/dev/replayTrace.ts`). The trace
   * and journal recorders read it: unlike `objective:set` and
   * `objective:cleared`, it fires only for a real drained command (an
   * objective's own revert emits `objective:cleared` and not this), and it
   * carries the whole command, so a replay enqueues it again verbatim.
   * No sim or run code subscribes.
   */
  'command:applied': { tick: number; command: WorldCommand };

  'run:started': { seed: number };
  'run:victory': Record<string, never>;
  'run:defeated': Record<string, never>;
  /**
   * A sector's terminal (not the sink's) was cleared and the run moved to
   * the next sector. Emitted by `advanceSector` after the state swap, with
   * the phase at `sectorCleared`, so the cleared sector's title rides the
   * payload and `nextSectorTitle` is the live `currentSectorTitle`. Game
   * shows the sector-cleared screen; the `dismissSectorCleared` command
   * returns to the map.
   *
   * `poolBefore` is the run-wide pool the sector ended on, before the seam
   * floor; the fuzz harness records it as `poolAtSectorClears`. `poolAfter`
   * is the pool after `health.seamHealFloor` lifted it, what the next sector
   * opens on. They are equal when the floor did not bite.
   */
  'sector:cleared': {
    clearedSectorTitle: string;
    nextSectorTitle: string;
    poolBefore: number;
    poolAfter: number;
  };

  /**
   * The run's bits balance changed. `bits` is the new balance, so a
   * consumer never sums deltas; `delta` is the change after the clamp at 0.
   * Emitted only on a real change, from `Run.addBits`, which every earn,
   * spend and sale goes through. The bits overlay and the event and port
   * screens read it; no sim or run code does.
   */
  'run:bitsChanged': { bits: number; delta: number };

  /**
   * The run-wide player pool moved. `after` is authoritative; `reason`
   * names the mover (the chip at a turn boundary, an event's heal or damage
   * op, the rest heal, the refill at a sector seam). Emitted only on a real
   * change, from `Run.setPlayerHealth`, which every pool write goes through,
   * so the pool overlay is never stale. The telemetry's turn-boundary
   * source is `pools:chipped`, which carries the encounter pool and the
   * uncapped charges.
   */
  'run:poolChanged': { before: number; after: number; max: number; reason: PoolChangeReason };

  /**
   * The run's cache changed: a packet was added (`Run.addPacket`, from a
   * reward or a port) or discarded (the `discardPacket` command), or a
   * daemon changed the derived capacity (`Run.addDaemon`; a daemon that
   * shrinks the cache can push it into the forced-keep overflow without
   * touching the list). `packetIds` is a copy of the ids (`packetById`
   * resolves a def); `size` is the folded capacity. The cache overlay, the
   * pre-turn scene and the port screen read it; no sim or run code does.
   */
  'run:cacheChanged': { packetIds: string[]; size: number };

  /**
   * A `usePacket` command fired a held packet, which is spent; the
   * `run:cacheChanged` before it carried the smaller cache. `context` is
   * where it fired; `playerHealth` is the pool after the effect (a patch
   * heals it). `grants` and `empowerStacks` are the pre-turn state derived
   * again, since a reroute inserts a grant at the cursor and a hype
   * re-badges the hand; both are empty outside `turn-intro`. The pre-turn
   * scene and the bot's evaluator read it; no sim or run code does.
   */
  'run:packetUsed': {
    packetId: string;
    context: UseContext;
    playerHealth: number;
    grants: TurnGrantView[];
    empowerStacks: EmpowerStackView[][];
    /** The risk bound derived again: a packet that moved the pool moves its
     *  cap (`min(pool, exposure)`), and a packet that changed the hand is
     *  followed by that hand's own event. Meaningful at the pre-turn gate
     *  only. */
    poolAtRisk: number;
  };

  /**
   * The player docked at a port: `enterNode` on a `port` node spent the hop,
   * rolled the stock, and put the run in the serialized `port` phase, where
   * it holds until a `leavePort` command. Game shows the port scene off it.
   */
  'port:entered': { nodeId: number };

  /**
   * The player landed on an event node that did not resolve into combat:
   * the run is in the serialized `event` phase, holding the
   * `{eventId, pageId}` cursor. Game shows the event scene off it.
   */
  'event:entered': { nodeId: number; eventId: string };

  /**
   * The event's cursor moved to another page (a choice whose `next` is a
   * page id). The event screen re-renders off it. A terminal choice emits
   * nothing here: a return to the map is silent, and starting an encounter
   * fires `battle:started`.
   */
  'event:pageChanged': { eventId: string; pageId: string };

  /**
   * The player landed on a rest node: `enterNode` spent the hop and the run
   * entered the serialized `rest` phase, where it holds until a
   * `chooseRestOption` command. Nothing has been healed or banked yet.
   * Game shows the rest scene off it, and `Run.resume()` emits it again for
   * a run loaded at the gate. `nodeId` is the rest node.
   */
  'rest:entered': { nodeId: number };

  'recruit:offered': { units: UnitTemplate[] };

  /**
   * A won encounter's reward offer is ready: the run entered the `reward`
   * phase, which comes before any promotion (battle, rewards, promotion,
   * recruit). The payload is a copy of the rolled portions. The screen
   * resolves them one at a time with the `acceptReward` and `declineReward`
   * commands and reads `run.pendingRewards` again after each (bits through
   * `run.effectiveBits`), since the live offer shrinks as portions resolve.
   */
  'reward:offered': { rewards: readonly RewardPortion[] };

  /**
   * One or more player units crossed an XP threshold as the battle's XP was
   * banked. Game shows the promotion scene, and its dismissal leads to the
   * recruit offer, or to `run:victory` at the run's end. The payload holds
   * everything the scene shows.
   */
  'promotion:pending': { promotions: readonly PromotionInfo[] };

  /**
   * A turn is about to begin: the pre-turn screen's cue. Fired only when
   * `Run.pauseAtTurnGates` is on, the live path; the headless loop never
   * emits it. The screen dismisses with the `advanceTurn` command.
   *
   * `hand` is this turn's drawn cards in draw order, drawn before this fires
   * (`Run.startNextTurn`), so it is the same templates `beginTurn` sends to
   * the World. `map` is the encounter's battlefield, one map per encounter
   * rolled at its start, so a redraw is decided knowing the field; it is an
   * inline shape rather than Run's `EncounterMap`, which keeps this file's
   * imports from `src/run` few, and it leaves out the terrain seed, which
   * the screen does not need. `grants` is this turn's grant queue, one view
   * per granted daemon effect in the order the daemons were acquired; its
   * `active` entry is the cursor the strict finality mode enforces.
   * `empowerStacks` runs parallel to `hand`: each card's badge-eligible buffs
   * on its roster slot, one entry per buff key (empty when unbuffed), so a
   * card empowered on an earlier turn and drawn again keeps its badge.
   */
  'turn:starting': {
    turn: number; // 1-based, within the current encounter
    hop: number;
    playerHealth: number;
    playerHealthMax: number;
    enemyHealth: number;
    enemyHealthMax: number;
    hand: UnitTemplate[];
    /** The encounter deck's other two piles, as templates, for the pre-turn
     *  pile views. In recruitment order, not draw order, so the views show
     *  what a pile holds without revealing the next draw. `hand`, `drawPile`
     *  and `discardPile` together are the whole fielded roster. */
    drawPile: UnitTemplate[];
    discardPile: UnitTemplate[];
    /** The grant queue's views (`Run.grantViews()`): a command names its
     *  grant by `grantIndex`, and strict mode fires only the `active` one. */
    grants: TurnGrantView[];
    /** One stack per hand position (empty when none), one entry per
     *  badge-eligible buff key; see the doc above. */
    empowerStacks: EmpowerStackView[][];
    /** The run's daemons in the order they were acquired (empty when it has
     *  none), for the pre-turn banners. An inline shape, as `map` is. A
     *  turn's grant state is not here, since `grants` says it (a denied flip
     *  is a missing queue entry); `redrawGate` and `empowerGate` say whether
     *  a daemon has each hook at all, so the screen can tell "denied this
     *  turn" from "never grants it". */
    daemons: Array<{
      id: string;
      name: string;
      description: string;
      redrawGate: boolean;
      empowerGate: boolean;
    }>;
    /** The encounter, so the pre-turn screen can name the fight. `name` is the
     *  HUD's enemy-pane title; `kind` lets the screen badge an elite or a
     *  boss. */
    encounter: {
      name: string;
      kind: EncounterKind;
    };
    /** The folded draw amount for the turn (`Run.effectiveDrawAmount`), for
     *  the pre-turn "Draw: N" chip. It can differ from `hand.length`: a
     *  roster smaller than the draw fields everyone, and a packet's draw
     *  grows the hand past it. */
    drawAmount: number;
    map: {
      layoutId: string | null;
      gridW: number;
      gridH: number;
      theme: Theme;
    };
    /** The pre-turn risk line: the most pool this turn can cost the player
     *  under the shipped `health.chipMode`, capped at the pool
     *  (`Run.previewPoolAtRisk`). Under survivors it is the wave's Σ power,
     *  previewed off the keyed stream `beginTurn` rolls the wave from, so it
     *  bounds the wave that is fielded; under casualties it is the hand's Σ
     *  power. Display only; never serialized. */
    poolAtRisk: number;
    /** The encounter's previous turn, for the pre-turn screen's "last turn"
     *  strip: its winner, why it ended, and who fell in it (copies of the
     *  fallen ledger's rows, both sides, in death order). Null on an
     *  encounter's first turn. The Run saves it, so a pre-turn screen resumed
     *  from a save has its strip. */
    lastTurn: {
      winner: 'player' | 'enemy' | 'draw';
      reason: 'decisive' | 'mutualWipe' | 'cap';
      fallen: readonly FallenRecord[];
    } | null;
  };

  /**
   * One card moved into the hand off the draw pile, in `drawCard()`: the
   * deal, a redraw's refill and a Surge all emit here. A presentation cue,
   * not state: the hand events (`turn:starting`, `turn:handRedrawn`) are
   * what the UI reconciles to, and these let the pile chips pulse once per
   * card. Counts are the piles after the card moved. The deck cues draw no
   * RNG and serialize nothing.
   */
  'deck:cardDrawn': {
    drawPile: number;
    discardPile: number;
  };

  /**
   * One card moved to the discard pile (the hand recycled at a turn's start,
   * a redraw's send-off, or a Cull). A cue, as `deck:cardDrawn` is. The
   * recycle fires with no screen up, which is harmless.
   */
  'deck:cardDiscarded': {
    drawPile: number;
    discardPile: number;
  };

  /**
   * The discard pile was shuffled back into the draw pile, inside
   * `drawCard()` when the draw pile runs dry mid-draw. One event for the
   * whole flip, since the shuffle is one action and pulses once. Counts are
   * after the flip and before the card is taken (`discardPile` is always 0).
   */
  'deck:reshuffled': {
    drawPile: number;
    discardPile: number;
  };

  /**
   * The pre-turn hand changed: a `redrawCards` command sent the selected
   * cards to the discard and fresh draws took their places, or a packet's
   * hand op grew it (`drawCards`) or shrank it (`discardCards`).
   * `Run.emitHandChanged` is the one emit site. It carries the whole new
   * hand, in the draw-order contract of `turn:starting`, so the pre-turn
   * screen swaps its card row and controls in place; the hand's length may
   * differ from the drawn size. It fires only in `turn-intro`, since the
   * commands are gated to that phase, so only on the live path.
   * `empowerStacks` runs parallel to the new hand, since a refill can seat an
   * empowered card and the old positions no longer line up.
   */
  'turn:handRedrawn': {
    hand: UnitTemplate[];
    /** The draw and discard piles after the change, in recruitment order, as
     *  `turn:starting` carries them. */
    drawPile: UnitTemplate[];
    discardPile: UnitTemplate[];
    /** The whole queue derived again (the fired grant's budget moved, and
     *  the cursor may have). */
    grants: TurnGrantView[];
    empowerStacks: EmpowerStackView[][];
    /** The risk bound derived again for the new hand (`Run.previewPoolAtRisk`,
     *  as `turn:starting` carries it): under casualties the hand's Σ power is
     *  the bound, so a redraw moves it. */
    poolAtRisk: number;
  };

  /**
   * An `empowerUnit` command landed at the pre-turn gate: the selected card's
   * roster slot gained the configured buff for the rest of the encounter.
   * It carries the queue derived again and the whole stack column, parallel
   * to the unchanged hand, so the pre-turn screen updates its badge and
   * controls in place. It fires only in `turn-intro`, since the command is
   * gated to that phase.
   */
  'turn:unitEmpowered': {
    handIndex: number;
    /** The whole queue derived again, as `turn:starting` carries it. */
    grants: TurnGrantView[];
    empowerStacks: EmpowerStackView[][];
  };

  /**
   * A `passGrant` command closed the active grant unspent. Only strict
   * finality mode emits it. It carries the queue derived again, so the strip
   * arms the new cursor.
   */
  'turn:grantPassed': {
    grants: TurnGrantView[];
  };

  /**
   * A turn just resolved into the pools: the post-turn outcome screen's cue.
   * Fired only under `pauseAtTurnGates`. `winner` is the turn's tactical
   * winner; `result` is the encounter's state after the turn (`ongoing`:
   * the next `turn:starting` follows the `advanceTurn`; `won` or `lost`: the
   * encounter ends instead). The pools are the values after the chip.
   */
  'turn:resolved': {
    turn: number;
    winner: 'player' | 'enemy' | 'draw';
    /** Why the battle ended (`battle:ended.reason`, resolved by Run; a fake
     *  without one maps 'draw' to 'cap', else 'decisive'). The outcome
     *  screen labels its chip lines by the rules this reason paid
     *  (`rulesForTurn`): a capped turn under a cap penalty pays two rules and
     *  says so; a mutual wipe never does. */
    reason: 'decisive' | 'mutualWipe' | 'cap';
    /** The loss each pool took this turn, clamped at the pool ("what you
     *  lost"), whatever the chip rule. The uncapped charge rides
     *  `pools:chipped`. */
    enemyPoolChip: number;
    playerPoolChip: number;
    result: 'won' | 'lost' | 'ongoing';
    playerHealth: number;
    playerHealthMax: number;
    enemyHealth: number;
    enemyHealthMax: number;
    /** The fallen ledger's story for the outcome screen: who fell this turn
     *  (both sides, in death order) and the encounter's record so far, this
     *  turn included. Copies of `Run.fallenLedger` rows; each side's `power`
     *  over `thisTurn` sums to the chip the casualties rule charged, so the
     *  screen can show the rows add up. */
    fallen: {
      thisTurn: readonly FallenRecord[];
      encounter: readonly FallenRecord[];
    };
  };

  /**
   * The pools as `resolveTurn` moved them, fired on the gated and the
   * headless paths alike (unlike `turn:resolved`). `before − after` per side
   * is what the chip rule took, whatever the rule, so the fuzz telemetry
   * records these rather than deriving the chip again: a reader that
   * multiplies survivors by `chipMultiplier` repeats one rule's arithmetic
   * and goes wrong under another. Values are pool HP; `before` is the pool
   * at the turn's battle start (no pool moves mid-battle), `after` the pool
   * after the chip, clamped at 0.
   */
  'pools:chipped': {
    turn: number;
    playerBefore: number;
    playerAfter: number;
    enemyBefore: number;
    enemyAfter: number;
    /** The rule's uncapped charge to each side's pool this turn (pool HP,
     *  `turnCharges`): `before − after` is the loss applied, and this is what
     *  the rule tried to take, which the overkill read needs under any rule.
     *  Under `survivors` it equals the opposing survivors × chipMultiplier. */
    playerCharge: number;
    enemyCharge: number;
  };
}

/**
 * One roster slot's promotion, as the promotion screen shows it: glyph,
 * archetype, old and new level, and both stat blocks whole, so the screen can
 * show a stat's old and new value and not only the change.
 */
export interface PromotionInfo {
  rosterIndex: number;
  archetype: Archetype;
  glyph: string;
  oldLevel: number;
  newLevel: number;
  oldStats: UnitStats;
  newStats: UnitStats;
}
