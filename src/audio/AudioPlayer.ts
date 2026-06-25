/**
 * Audio playback layer (B6). Preloads a fixed set of SFX/music clips and
 * exposes overlap-safe `play(key)`. HTMLAudioElement is enough for our
 * scope; revisit Web Audio API if we ever need spatialization, precise
 * scheduling, or fade curves.
 *
 * Overlap: each sound has a small ring of cloned `<audio>` nodes. play()
 * picks the next slot, rewinds it, and plays. With POOL_SIZE=4 we can
 * absorb four simultaneous triggers (e.g. multi-unit attacks on the same
 * tick) before stealing the oldest.
 *
 * Browsers block audio playback until the first user gesture. The first
 * trigger in this game is a map-node click — itself a gesture — so the
 * unlock happens transparently. play() rejections from the autoplay
 * policy are swallowed: gameplay should not break when audio is blocked.
 *
 * Assets live in `public/audio/` and are referenced by relative path so
 * the same build works under any deploy subpath (vite.config.ts uses
 * `base: './'`).
 */

export type SoundKey =
  | 'burn'
  | 'chain'
  | 'click'
  | 'dash'
  | 'death'
  | 'healtick'
  | 'lose'
  | 'magicboom'
  | 'melee'
  | 'recruit'
  | 'shoot'
  | 'win';

const SOURCES: Record<SoundKey, string> = {
  burn: 'audio/burn.wav',
  // §29c — the stormcaller's chain-lightning arc. Plays per HOP (off the
  // `chain_arc` fx key on `unit:chained`), so a 3-jump cast crackles zap-zap-zap.
  chain: 'audio/chain.wav',
  click: 'audio/click.wav',
  // N1 — the rogue's dash-leap whoosh (off a >1-cell `unit:moved`).
  dash: 'audio/dash.wav',
  death: 'audio/death.wav',
  healtick: 'audio/healtick.wav',
  lose: 'audio/lose.wav',
  // E7.C — the mage bolt's detonation. One per cast (§Z: played via the FX
  // registry's `magic_bolt_burst` cue on `action:phase{impact}`).
  magicboom: 'audio/magicboom.wav',
  melee: 'audio/melee.wav',
  recruit: 'audio/recruit.wav',
  shoot: 'audio/shoot.wav',
  win: 'audio/win.wav',
};

/**
 * Per-sound volume relative to master. SFX play loud (1.0); the longer
 * fanfares are softer so they don't dominate when win/lose lands at the
 * same loudness as the impact sounds that preceded them. D7.C burn +
 * healtick are quieter — they fire on a tick cadence (every 0.5s for
 * fire, every 1.0s for healing) so the sustained beat would dominate at
 * full SFX volume.
 */
const VOLUMES: Record<SoundKey, number> = {
  burn: 0.6,
  // §29c — fires per hop (up to 3 rapid plays per cast), so kept just under the
  // mage's signature `magicboom` (0.9) to keep a multi-hop crackle from dominating.
  chain: 0.8,
  click: 0.7,
  // N1 — a movement whoosh; just under the 1.0 impact cues so it reads as
  // motion, not a hit.
  dash: 0.9,
  death: 1.0,
  healtick: 0.55,
  lose: 0.7,
  // E7.C — the mage's signature impact. Slightly under the melee/shoot 1.0 so
  // a two-mage barrage (~one cast each per 2s) doesn't dominate the mix.
  magicboom: 0.9,
  melee: 1.0,
  recruit: 0.8,
  shoot: 1.0,
  win: 0.7,
};

/**
 * Per-sound pitch variance. On each play() the playbackRate is jittered
 * to `1 ± variance` (uniform), which shifts pitch AND tempo together —
 * exactly what you want for repeated impact SFX so the ear doesn't lock
 * onto a single tone. Capped at ~0.1 (±10%): beyond that the variation
 * is perceptible as a "broken sample" rather than just a different hit.
 * One-shot cues (click, recruit, fanfares) stay at 0 — variation on
 * something you only hear once reads as inconsistency, not life.
 *
 * D7.C — burn fires on a 5-tick cadence (every 0.5s) and many units may
 * burn the same tick if a fire band spans the board, so its jitter is
 * pushed up to 0.12 to break up the rhythm aggressively. healtick fires
 * on a 10-tick cadence and is much rarer, but a single healing tile can
 * still hold one unit for many ticks; ±0.08 keeps the heal cue feeling
 * organic without losing the "I'm being healed" identity.
 */
const PITCH_VARIANCE: Record<SoundKey, number> = {
  burn: 0.12,
  // §29c — the hops of one cast fire ~0.1s apart, so push the jitter up (±12%)
  // to break the rapid repeat into a crackle rather than a stuttered single tone.
  chain: 0.12,
  click: 0,
  // N1 — light jitter so several rogues dashing the same tick don't sound like
  // one stuttered sample (dashes are rare per-unit at a 10s cooldown).
  dash: 0.08,
  death: 0.08,
  healtick: 0.08,
  lose: 0,
  // E7.C — subtle jitter so repeated booms don't sound identical, but kept
  // low (±8%): too much tempo shift makes an explosion read as a broken sample.
  magicboom: 0.08,
  melee: 0.1,
  recruit: 0,
  shoot: 0.1,
  win: 0,
};

const POOL_SIZE = 4;
const DEFAULT_MASTER_VOLUME = 0.5;

export class AudioPlayer {
  private masterVolume = DEFAULT_MASTER_VOLUME;
  private muted = false;
  private readonly pools: Record<SoundKey, HTMLAudioElement[]>;
  private readonly cursors: Record<SoundKey, number>;

  constructor() {
    this.pools = {} as Record<SoundKey, HTMLAudioElement[]>;
    this.cursors = {} as Record<SoundKey, number>;
    for (const key of Object.keys(SOURCES) as SoundKey[]) {
      const pool: HTMLAudioElement[] = [];
      for (let i = 0; i < POOL_SIZE; i++) {
        const audio = new Audio(SOURCES[key]);
        audio.preload = 'auto';
        audio.volume = this.masterVolume * VOLUMES[key];
        pool.push(audio);
      }
      this.pools[key] = pool;
      this.cursors[key] = 0;
    }
  }

  play(key: SoundKey): void {
    if (this.muted) return;
    const pool = this.pools[key];
    const cursor = this.cursors[key];
    const audio = pool[cursor]!;
    this.cursors[key] = (cursor + 1) % POOL_SIZE;
    const variance = PITCH_VARIANCE[key];
    audio.playbackRate = variance > 0 ? 1 + (Math.random() * 2 - 1) * variance : 1;
    audio.currentTime = 0;
    audio.play().catch(() => {
      // Autoplay policy may reject before any user gesture, and stolen
      // playback can throw an AbortError. Neither should break the game.
    });
  }

  setMasterVolume(v: number): void {
    this.masterVolume = Math.max(0, Math.min(1, v));
    for (const key of Object.keys(this.pools) as SoundKey[]) {
      const target = this.masterVolume * VOLUMES[key];
      for (const audio of this.pools[key]) {
        audio.volume = target;
      }
    }
  }

  setMuted(muted: boolean): void {
    this.muted = muted;
  }

  get isMuted(): boolean {
    return this.muted;
  }
}
