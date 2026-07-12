# Cluster 3 Specification

> **🗄️ ARCHIVED 2026-07-11** at the micro-round kickoff, with its round's
> pair ([post-46-roadmap.md](post-46-roadmap.md) +
> [post-46-worklog.md](post-46-worklog.md)) — AGENTS "superseded specs
> archive with their round." The live spec is now
> [micro-round-spec.md](../micro-round-spec.md).

## "It's the economy, stupid!"

This specification fleshes out the "economy" feature cluster for ASCIIbattler.

> **Status:** hardened 2026-07-07. The original draft went through a blind-spot
> pass audited against code reality, then a design conversation that resolved
> the forks. Locked calls are marked **✅ DECIDED**; genuinely open items are
> marked **⚠ OPEN**. Engineering mechanics stay at headline level here — the
> roadmap and phase kickoffs carry the detail.

### Naming ✅ DECIDED — bits · packets · cache · ports

The vocabulary: **bits** (currency), **packets** (consumables), **cache**
(inventory), **ports** (shops). Locked 2026-07-07, and the spec below uses
these names throughout.

The principle that picked them (durable — apply it to future names too):
**the tech double meaning must degrade gracefully.** The lay reading has to
stand entirely on its own — daemon = helpful entity, sector = region, hop =
jump — with the unix/networking layer as an optional Easter egg, never
load-bearing.

- **bits** — lay: small pieces of value ("two bits"); tech: binary. The
  Twitch precedent helps the money-reading. ("tokens" cut for the
  crypto/NFT connotation; "chips" for colliding with the HUD's hop/turn
  chip; "creds" too informal.)
- **packets** — lay: a single-serving packet containing something, used
  once; tech: addressed to a target and delivered — literally the mechanic,
  and it rhymes with hopping a network. Valence-neutral where "patches"
  skewed heal-only and "scripts" had no lay reading.
- **cache** — lay: a cache of treasure/supplies; tech: fixed capacity with
  eviction. ("buffer" failed the lay test — a cushion relative to a demand,
  not storage; "stack" contradicted the no-stacking rule.)
- **ports** — lay: a harbor where travelers dock to buy and sell; tech:
  network port. ("terminal" whispered "the end," and that's the boss's job.)

Code identifiers adopt these names too — nothing exists yet under the old
placeholder names, so one vocabulary costs nothing: `bitsGain`,
`run:bitsChanged`, `PacketDef`, `cacheSize`, `portChance`, …

### The rule vocabulary — the cluster keystone ✅ DECIDED

The blind-spot pass caught that today's daemons only gate redraw/empower —
the general effect system I'd been envisioning doesn't exist yet. It gets
built here, and it's the analogue of Cluster 1's `AbilityDef`: **daemons and
packets share one effect-op pool**; a daemon delivers ops passively, a
packet delivers them actively with a target.

```
DaemonDef = { id, name, description, rules: Rule[] }

Rule =
  | { kind: 'modifier', stat: RunStatKey, op: 'add' | 'mult', value }
  | { kind: 'hook', on: TriggerKey, chance?, filter?, effect: EffectOp }
```

- **Modifiers** are passive folds over a new vocabulary of run-level stats
  (`bitsGain`, `cacheSize`, `redrawsPerTurn`, `empowersPerTurn`, …) —
  the `foldEffects` pattern, derived at read time, never cached
  (derive-don't-cache doctrine). Multi-daemon stacking and removal fall out
  for free.
- **Hooks** fire on triggers, with an optional `chance` (rolled off
  `daemonRng`, the `resolveTurnGates` discipline) and filter
  (`archetype: 'rogue'`, `won: true`).

My motivating examples, which span the full (trigger domain × effect domain)
matrix — the shape must cover all of it:

| Example | Trigger | Effect lands in |
|---|---|---|
| Player rogue deals damage → +1 bit | battle sim | run (via tally) |
| Any crit → +1 str/rng/mag for 5s | battle sim | battle sim |
| +20% bits | — (passive modifier) | run |
| Encounter end → heal 3 pool | run lifecycle | run |
| While owned → +3 cache slots | — (passive modifier) | run |

**The two seam crossings, decided:**

- **Battle-domain hooks compile into the World at battle setup** as data
  (`battleRules[]` — the `encounterEffects` injection precedent), evaluated
  inside the tick at existing chokepoints (`applyDamage`/`dealDamage`).
  First-class sim feature, NOT a bus subscription — sim purity and the fuzz
  oracle stay intact.
- **Battle-trigger → run-effect settles via a tally.** The World accumulates
  deterministic counters (`tallies: { bits, poolHeal, … }`), serialized with
  the WorldSnapshot, folded into the Run at battle end — the XP pattern. The
  HUD may show bits ticking live via events; the tally is authoritative.

**Scope + migration, decided:**

- ✅ **Vocabulary is content-driven**: exactly the triggers/ops the four
  idols + the examples above + launch packets need (~6 triggers, ~7 ops).
  Schema shaped for extension; entries added when content demands.
- ✅ **The four idols re-author into the new schema; legacy gate fields and
  `TurnGates` are deleted** (Mars ⇒ chance-gated `turnStart` hook granting
  redraws). One vocabulary, no parallel legacy path. RunSnapshot bumps.
- ✅ Sim-side effect ops reuse Cluster 1 (def-resolved statuses, durations
  in seconds); run-side ops are new but small (`gainBits`, `healPool`,
  `grantRedraws`, `grantEmpowers`, `grantPacket`).
- ✅ **Multi-daemon ownership, uncapped** (the Phase-L deferral lands here).
  Scarcity comes from port prices + reward-table weights, not a slot cap.
  Owned daemons serialize **by id** (the def-resolved status pattern);
  PreTurnScreen's daemon panel becomes a list.

### Bits

Bits are the primary currency: tracked across a run, rewarded via reward
tables, spent at ports.

- ✅ **Bits are a reward-table entry type, not an encounter-schema field.**
  A bits entry carries a `{min, max}` range, rolled uniformly. One reward
  machinery for everything; an encounter's guaranteed bits is a
  single-entry table at trigger chance 1. (Neater than my original
  per-encounter currency field.)
- ✅ **Declinable like any other reward portion** — uniform rule, no special
  case.
- ✅ Displayed persistently **top-left**, in and out of battle, via a new
  Game-level page-lifetime overlay element (survives scene swaps; net-new
  UI infrastructure) driven by a `run:bitsChanged` event. (Top-right — my
  original instinct — is already claimed by the speed pane in battle and
  the roster button on the map.)
- ✅ Integer, floor at zero. Starting bits is config (default 0).
- ✅ `RunConfig` gains a bits override (fuzz/testing); the X1 difficulty
  multipliers gain a `bitsMultiplier` sibling — the named lever for the
  boss-wall balance rider carried into this cluster.

Engine notes:

- Hooks for bits changes (the "+20% bits" modifier folds at the grant site;
  "heal on losing bits" is an `on: 'bitsSpent'` run-domain hook).
- Bits rolls, table sampling, and port stock each get **dedicated forked RNG
  streams** (the `levelupRng`/`deckRng`/`daemonRng` precedent), serialized.

### Packets (consumables)

Packets are one-shot items delivering effect ops from the shared pool at a
target.

- ✅ **`PacketDef` declares `usableIn` (contexts) + a full `TargetSpec`
  (unit / tile / none) from day one** — the seam.
- ✅ **This cluster builds two contexts: out-of-battle (map/cache, run ops
  on roster/piles/run) and pre-turn (hand units + battle-wide via the
  "inject a battle-scoped rule" op — the empower/redraw generalization).**
- ✅ **Mid-battle pause-to-cast is DEFERRED** — it would be the first
  player→sim input channel (tick-stamped commands + targeting UI + pause
  UX). When it lands later it's an extension reading the same defs.
  Tile-targeted packets wait for it (no battlefield exists pre-turn).
- ✅ **Effect duration axis**: every effect authors one of
  `battle / encounter / run / permanent`; launch content sticks to
  `encounter` and `run`.
- ⚠ OPEN — **the pre-turn "fire" UX**: empowers/redraws stop being inline
  and become fireable at any time on the pre-turn screen; daemon hooks just
  happen to fire automatically. I'm feeling each one pops up a special
  window, maybe? Design round at the relevant phase kickoff.

### Cache (inventory)

Every run carries a cache holding packets.

- ✅ Base size six; **size is a derived run-stat** (base + modifier folds
  from daemons/packets), never serialized.
- ✅ **No stacking — one item per slot.** Six slots mean six things; +slot
  daemons stay valuable.
- Items can be discarded at will.
- ✅ Shrink-below-count rule (a cursed daemon drops size under current
  holdings): the player is immediately forced to choose which packets to
  keep; the rest are discarded.
- Reward-time overflow: the reward screen shows cache state and offers
  decline-or-swap when full.

### Reward Tables

- A reward table is a weighted list of entries: **bits `{min,max}` |
  packet | daemon**. Sampling picks one entry proportional to weight.
- ✅ Daemons the player already owns are **filtered out before sampling**;
  a table empty after filtering yields nothing this trigger. Authoring
  convention (not engine rule): daemon-bearing tables carry a packet/bits
  floor entry so the empty case stays rare.
- ✅ Tables live in their own registry (`config/rewards.json` + editor),
  referenced **by name** from encounters — with a boot-time referential
  integrity assert (the fxRegistry precedent).
- The encounter schema's reserved `rewards?` seam becomes real: a list of
  `{ table, trigger }`. Each is **independently** tested on win; triggered
  tables are sampled and their results join the reward list.
  ✅ Trigger vocabulary at launch: `chance` only; schema shaped for
  predicates later.
- ✅ **Post-battle sequence: battle → rewards → promotion → recruit.** Loot
  lands while the win is fresh. Rewards are a serialized run phase
  (mid-reward save reproduces the pending offer).
- The player may decline any portion of their rewards.
- Rewards hang on *encounters*, so anything that fights one (battle, elite,
  boss, the pre-root sentinel) can reward; rest nodes are unchanged. Elites
  get richer tables — that's authoring, not engine.

### Ports (shops)

Ports are a new node kind in sector maps. At one, you can:

- Recruit from some number (starting point: 5) of units, each with a
  randomly chosen price based on archetype and level.
- Purchase from some number of packets (starting point: 5).
- Purchase from some number of daemons (starting point: 2) — owned daemons
  excluded from stock.
- Sell any packets you have (sell price a config fraction of buy).
- Pay to remove one unit from your roster.

Decided / engine notes:

- ✅ Placement mirrors the elite scatter pass: `portChance` +
  `portMinSpacing` knobs, **guaranteed ≥1 port per sector**, never on the
  boss hop. New `NodeKind` ⇒ glyph entry (`$`?), snapshot bump (generator
  RNG-order change — the W2/v23 precedent).
- ✅ Stock rolls **on node entry** from a dedicated forked stream and is
  serialized (mid-port save keeps the stock).
- Port-recruited units wire into the deck exactly like post-battle recruits.
- ✅ **Unit removal goes through a single `removeRosterUnit` chokepoint**
  fixing up all five rosterIndex-keyed structures (hand / draw / discard /
  `encounterEffects` / `deploymentCounts`) with a co-located test — removal
  is the first feature ever to shrink the roster. (Stable unit ids deferred
  until something actually needs persistent identity.)
- Port is a new serialized `run.phase` ⇒ the fuzz harness needs a
  `case 'port'` immediately (else runs abort at `maxNodeHops`), and
  eventually a purchase-policy arm like redraw/empower.
- We'll need an editor to tweak prices and such.

### Dev tools (built alongside, per META convention)

Reward-table editor, packet editor, port config editor (or one combined
economy editor — shape at phase kickoff). Each new config file joins the
`/__save-config` allowlist. Byte-faithful `format*Json` per file.

### Cross-cutting engine notes

- Expect multiple RunSnapshot bumps (daemons-by-id + rules, bits/cache,
  reward phase, port kind/phase/stock) and a WorldSnapshot bump (tallies +
  `battleRules`). Reject-stale as always.
- New RNG draws and the port scatter pass reset fuzz/determinism baselines —
  fold into the phases that cause them.
- New events follow `subject:verbed` (`run:bitsChanged`, `reward:offered`,
  …) and land in the ARCHITECTURE.md catalog.
- Polish that rides the cluster: SFX for pickups/purchases.
