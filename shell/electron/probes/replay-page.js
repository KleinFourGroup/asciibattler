// The journal replay's page side (114g): feed one segment of a run journal
// (src/journal/journal.ts) to the live game, so the recorder's clip shows the
// run as it was played. Main installs this function as `window.__replayDriver`
// and the recorder's page script (./record-page.js) makes one driver from it,
// starts it in the go frame and calls it every frame.
//
// It reaches into the game by the dev convention, changing no source file, so
// it replays a journal on the build that recorded it, whichever commit that
// is. Every name it reaches is checked first (`seam moved: ...`).
//
// WHERE EACH ENTRY GOES, the same places src/journal/replayJournal.ts puts
// them headless:
// - a `run` command outside a battle goes through `Game.dispatch`, as a
//   click's would;
// - a `run` command sent during a battle (`tick`) is dispatched once that
//   many ticks have run, and an `order` is enqueued before its tick runs.
//   Both are fed from a wrap on the battle's own `World.tick`, since one
//   frame can run several ticks;
// - a `battle` checkpoint is held against the entry the game's own recorder
//   writes when the battle ends.
//
// WHAT THE GAME SENDS ITSELF. After a battle's outro Game dispatches the
// `advanceTurn` that leaves the turn-outcome gate (no screen shows it), and
// the journal holds that command like any other. The driver leaves it to the
// game: a wrap on `Game.dispatch` sees every command the driver did not send
// and holds it against the journal's next entry.
//
// PACING. The journal times a command (`ms`) and never a tick, and it holds
// neither the playback speed nor a pause. So a command outside a battle waits
// as long after the command before it as it did when the run was played
// (`maxGapMs` caps that wait), and a battle takes what it takes: the whole
// countdown unless `countdown` is `skip`, then the fight at `speed`. An order
// stamped for tick 1 was given during the countdown, so it is enqueued when
// the battle opens and its marker shows through the countdown.
//
// THE CHECK is the game's own journal of the replay (`Game.currentJournal`):
// its start must be the journal's before anything is sent; at the end its
// reason and final snapshot hash must be the journal's, and so must every
// `run` and `battle` entry, in order. Orders are not compared one for one: a
// battle's setup enqueues its own (the camp pull) and the journal's copy is
// enqueued again, which leaves the same state (journal.ts, ENTRIES).
//
// Returns `{ error }` when the journal can't be replayed on this page, or the
// driver: `begin(now)`, `frame(now)`, `done`, `report()`.
export default function replayDriver(game, segment, opts = {}) {
  const moved = (name) => ({ error: `seam moved: ${name}` });
  if (typeof game.dispatch !== 'function') return moved('Game.dispatch');
  if (typeof game.bus?.on !== 'function') return moved('Game.bus.on');
  if (typeof game.currentJournal !== 'function') return moved('Game.currentJournal (a build from before the run journal?)');
  if (typeof game.playback?.setSpeed !== 'function' || !Array.isArray(game.playback.steps)) return moved('Game.playback (setSpeed, steps)');
  if (!game.run || typeof game.run.phase !== 'string') {
    return { error: 'no run at boot: the journal\'s dials name no character, so the page opened on character select' };
  }
  const liveSegment = () => game.currentJournal()?.segments?.[0] ?? null;
  const boot = liveSegment();
  if (boot === null) return { error: 'the page records no journal of its own, so the replay can\'t be checked (Game.currentJournal is null)' };

  const entries = segment.entries;
  const end = segment.end;
  const speed = opts.speed ?? 1;
  const maxGapMs = opts.maxGapMs ?? Infinity;
  const skipCountdown = opts.countdown === 'skip';
  /** How long the game may take to send a command of its own (the outro is
   *  900 ms or the battle's settle, whichever is longer). */
  const GAME_SEND_MS = 30_000;

  // --- what this page can't replay -------------------------------------------
  if (boot.configHash !== segment.configHash) {
    return {
      error:
        `the journal was recorded under config ${segment.configHash} (build ${segment.build}), and this page's config is ` +
        `${boot.configHash} (build ${boot.build}): a replay against other balance numbers would diverge`,
    };
  }
  // The seed rides the URL here, so the page's dials name it where a run
  // started without one doesn't; the Run never reads that dial.
  const dials = (text) => {
    const p = new URLSearchParams(text);
    p.delete('seed');
    p.sort();
    return p.toString();
  };
  if (segment.start.kind !== 'seed' || boot.start.kind !== 'seed') return { error: 'only a segment that starts from a seed is replayed here' };
  if (boot.start.seed !== segment.start.seed || dials(boot.start.dials) !== dials(segment.start.dials)) {
    return {
      error:
        `the page's run started from seed ${boot.start.seed} (${boot.start.dials}), ` +
        `and the journal's from seed ${segment.start.seed} (${segment.start.dials})`,
    };
  }
  if (end === null || (end.reason !== 'defeat' && end.reason !== 'victory')) {
    return { error: `only a run played to its end is replayed here (this journal's end: ${end === null ? 'none' : end.reason})` };
  }
  if (!game.playback.steps.includes(speed)) return { error: `speed ${speed} is not one of the game's (${game.playback.steps.join(', ')})` };

  const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
  const brief = (entry) =>
    entry === undefined
      ? 'nothing more'
      : entry.t === 'run'
        ? `${entry.command.kind}${entry.tick === undefined ? '' : ` after tick ${entry.tick}`}`
        : entry.t === 'order'
          ? `an order for tick ${entry.tick}`
          : `a battle's end (${entry.winner} after ${entry.ticks} ticks)`;

  let i = 0; // the journal's next entry
  let world = null; // the battle in progress
  let sending = false;
  let last = null; // the page time and the journal time of the last `run` entry
  let failure = null;
  let finishedAt = null;
  let awaitingGameSince = null;
  let battleOpenedAt = null;
  const counts = { sent: 0, gameSent: 0, orders: 0, battles: 0, cappedGaps: 0 };
  const battleSeconds = [];

  const fail = (what, at = i) => {
    failure ??= `entry ${at} of ${entries.length}${world ? `, battle ${counts.battles + 1} at tick ${world.currentTick}` : ''}: ${what}`;
  };

  /** Send the journal's next entry, a `run` command, as a click would. */
  const send = (now) => {
    const at = i;
    const entry = entries[i++];
    counts.sent++;
    last = { page: now, ms: entry.ms };
    sending = true;
    try {
      // A copy: a chooseRecruit carries the offered template, which the Run
      // goes on to own.
      game.dispatch(structuredClone(entry.command));
    } catch (err) {
      // The caller is a frame callback or a tick; a throw there would stop
      // the recording's frames.
      fail(`${entry.command.kind} threw: ${err?.message ?? err}`, at);
    } finally {
      sending = false;
    }
  };

  // Every command the driver did not send is the game's own, and the journal
  // must hold it next.
  const dispatch = game.dispatch;
  game.dispatch = function watched(command) {
    if (!sending && failure === null && finishedAt === null) {
      const entry = entries[i];
      if (entry?.t === 'run' && entry.tick === undefined && same(entry.command, command)) {
        i++;
        counts.gameSent++;
        last = { page: performance.now(), ms: entry.ms };
        awaitingGameSince = null;
      } else {
        fail(`the game sent ${command.kind} itself, and the journal has ${brief(entry)}`);
      }
    }
    return dispatch.call(this, command);
  };

  /** Feed the battle what is due now that `world.currentTick` ticks have run:
   *  orders for the next tick, and commands sent after this one. */
  const pump = () => {
    while (world !== null && failure === null) {
      const entry = entries[i];
      const ran = world.currentTick;
      if (entry === undefined) return fail('the journal ends inside a battle');
      if (entry.t === 'battle') return;
      if (entry.t === 'order') {
        if (entry.tick > ran + 1) return;
        if (entry.tick < ran + 1) return fail(`the journal has ${brief(entry)}, and ${ran} ticks have run`);
        i++;
        counts.orders++;
        world.enqueueCommand(structuredClone(entry.command));
      } else {
        if (entry.tick === undefined) return fail(`the journal sends ${entry.command.kind} outside a battle, and the replay is in one`);
        if (entry.tick > ran) return;
        if (entry.tick < ran) return fail(`the journal has ${brief(entry)}, and ${ran} ticks have run`);
        send(performance.now());
      }
    }
  };

  // Game's own handler mounted the battle's scene before this one runs (it
  // subscribed first), so the scene and its World are there to wrap.
  game.bus.on('battle:started', () => {
    if (failure !== null || finishedAt !== null) return;
    const scene = game.activeScene;
    const w = scene?.world;
    if (!w || typeof w.tick !== 'function' || typeof w.enqueueCommand !== 'function' || typeof w.currentTick !== 'number') {
      return fail('seam moved: BattleScene.world (tick, enqueueCommand, currentTick)');
    }
    world = w;
    battleOpenedAt = performance.now();
    const tick = w.tick;
    w.tick = function fed() {
      tick.call(this);
      pump();
    };
    pump();
    if (skipCountdown) {
      if (typeof scene.playback?.resume !== 'function') return fail('seam moved: BattleScene.playback.resume');
      // The unpause is the countdown's skip (BattleScene.tick).
      if (scene.countdown?.active) scene.playback.resume();
    }
  });

  // The game's recorder subscribed before this handler too, so its checkpoint
  // for this battle is already the last entry of the page's own journal.
  game.bus.on('battle:ended', () => {
    if (world === null || failure !== null) return;
    const entry = entries[i];
    const mine = liveSegment()?.entries.at(-1);
    if (mine?.t !== 'battle') return fail('seam moved: the game\'s recorder wrote no checkpoint at the battle\'s end');
    if (entry?.t !== 'battle') {
      return fail(`the replayed battle ended (${mine.winner} after ${mine.ticks} ticks), and the journal has ${brief(entry)}`);
    }
    if (entry.winner !== mine.winner || entry.ticks !== mine.ticks) {
      return fail(`the journal's battle ended ${entry.winner} after ${entry.ticks} ticks, and the replay's ended ${mine.winner} after ${mine.ticks}`);
    }
    battleSeconds.push(Math.round((performance.now() - battleOpenedAt) / 100) / 10);
    world = null;
    i++;
    counts.battles++;
  });

  /** Every entry is in: hold the page's own journal of the replay against it. */
  const finish = (now) => {
    const mine = liveSegment();
    if (mine === null || mine.end === null) {
      return fail(`the journal ends in ${end.reason}, and the replayed run is still going (phase ${game.run?.phase})`);
    }
    if (mine.end.reason !== end.reason) return fail(`the journal ends in ${end.reason}, and the replayed run in ${mine.end.reason}`);
    if (mine.end.hash !== end.hash) {
      return fail(`the journal's final snapshot hash is ${end.hash}, and the page's is ${mine.end.hash}`);
    }
    const key = (e) => (e.t === 'run' ? JSON.stringify(['run', e.tick ?? null, e.command]) : JSON.stringify(['battle', e.winner, e.ticks]));
    const want = entries.filter((e) => e.t !== 'order').map(key);
    const got = mine.entries.filter((e) => e.t !== 'order').map(key);
    const at = want.findIndex((k, n) => k !== got[n]);
    if (at >= 0 || got.length !== want.length) {
      const n = at >= 0 ? at : want.length;
      return fail(`the page's own journal parts from the replayed one at command ${n}: ${got[n] ?? 'nothing'} where the journal has ${want[n] ?? 'nothing'}`);
    }
    finishedAt = now;
  };

  return {
    /** Start the journal's clock: the go frame is the moment the run opened. */
    begin(now) {
      last = { page: now, ms: 0 };
      game.playback.setSpeed(speed);
    },

    /** Once a frame, outside a battle: send what has come due. */
    frame(now) {
      while (failure === null && finishedAt === null && last !== null && world === null) {
        const entry = entries[i];
        if (entry === undefined) return finish(now);
        if (entry.t !== 'run' || entry.tick !== undefined) return fail(`the journal has ${brief(entry)}, and the replay is not in a battle`);
        const atGate = game.run?.phase === 'turn-outcome';
        if (atGate && entry.command.kind === 'advanceTurn') {
          awaitingGameSince ??= now;
          if (now - awaitingGameSince > GAME_SEND_MS) fail(`the game never sent the advanceTurn that follows a battle (${GAME_SEND_MS / 1000} s)`);
          return;
        }
        // During the outro the game's own advance is on a timer, so a command
        // the journal has before it goes at once.
        const gap = entry.ms - last.ms;
        if (!atGate) {
          if (now < last.page + Math.min(gap, maxGapMs)) return;
          if (gap > maxGapMs) counts.cappedGaps++;
        }
        send(now);
      }
    },

    /** True once the replay has reached the journal's end, or failed. */
    get done() {
      return failure !== null || finishedAt !== null;
    },

    report() {
      const mine = liveSegment();
      return {
        ok: failure === null && finishedAt !== null,
        failure,
        finished: finishedAt !== null,
        entries: entries.length,
        at: i,
        ...counts,
        battleSeconds,
        speed,
        countdown: skipCountdown ? 'skip' : 'full',
        maxGapMs: Number.isFinite(maxGapMs) ? maxGapMs : null,
        reason: { journal: end.reason, page: mine?.end?.reason ?? null },
        hash: { journal: end.hash, page: mine?.end?.hash ?? null },
        build: { journal: segment.build, page: mine?.build ?? null },
        configHash: segment.configHash,
        seed: segment.start.seed,
        dials: segment.start.dials,
        playedSeconds: Math.round(end.ms / 100) / 10,
      };
    },
  };
}
