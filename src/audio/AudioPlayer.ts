/**
 * The sound player: preloads every clip in `SOUND_SOURCES` and plays one by
 * key, overlap-safe. `HTMLAudioElement` is enough: nothing here needs
 * spatialization, precise scheduling or fade curves, which would take Web
 * Audio.
 *
 * Overlap: each sound has a ring of `POOL_SIZE` `<audio>` elements, and
 * `play` takes the next one, rewinds it and plays it, so four triggers on
 * one tick (several units attacking at once) play before the oldest is
 * stolen.
 *
 * Browsers block audio until the first user gesture. The first sound the
 * game plays is a click on a menu row (a map node, on a page a run dial
 * booted), itself a gesture, so the unlock needs nothing of its own.
 *
 * Assets live in `public/audio/` and are referenced by relative path, so the
 * same build works under any deploy subpath (vite.config.ts sets
 * `base: './'`).
 */

export type SoundKey =
  | 'bleed'
  | 'burn'
  | 'chain'
  | 'click'
  | 'dash'
  | 'death'
  | 'freeze'
  | 'healtick'
  | 'hex'
  | 'lightray'
  | 'lose'
  | 'magicboom'
  | 'melee'
  | 'moraleloss'
  | 'pickup'
  | 'poison'
  | 'recruit'
  | 'sectorwin'
  | 'shoot'
  | 'stattick'
  | 'summon'
  | 'thud'
  | 'vial'
  | 'wail'
  | 'win';

/**
 * Every clip, by key. The ones `scripts/gen-sfx.mjs` makes
 * (`npm run gen:sfx`, deterministic) are listed there; the rest are
 * hand-made files, which a regeneration leaves alone. AudioPlayer.test.ts
 * holds every key to a file and every file to a key.
 */
export const SOUND_SOURCES: Record<SoundKey, string> = {
  burn: 'audio/burn.wav',
  // The stormcaller's chain lightning, once a hop (the `chain_arc` fx key on
  // `unit:chained`), so a three-jump cast crackles three times.
  chain: 'audio/chain.wav',
  click: 'audio/click.wav',
  // The rogue's dash, off `unit:dashed` in the event-sound registry.
  dash: 'audio/dash.wav',
  death: 'audio/death.wav',
  healtick: 'audio/healtick.wav',
  lose: 'audio/lose.wav',
  // The mage bolt's detonation, once a cast (the `magic_bolt_burst` fx key on
  // the impact phase).
  magicboom: 'audio/magicboom.wav',
  melee: 'audio/melee.wav',
  // A coin blip, once per reward portion accepted and per buy or sell at a
  // port.
  pickup: 'audio/pickup.wav',
  recruit: 'audio/recruit.wav',
  shoot: 'audio/shoot.wav',
  win: 'audio/win.wav',
  // `bleed` and `poison` play on each tick of their status; the afflicters'
  // casts (`vial`, `freeze`, `hex`, `lightray`, `wail`) once a cast;
  // `summon` on the shaman's raise; `thud` on the catapult's landing.
  bleed: 'audio/bleed.wav',
  poison: 'audio/poison.wav',
  vial: 'audio/vial.wav',
  freeze: 'audio/freeze.wav',
  hex: 'audio/hex.wav',
  lightray: 'audio/lightray.wav',
  wail: 'audio/wail.wav',
  summon: 'audio/summon.wav',
  thud: 'audio/thud.wav',
  // The pool bar's landing cue, played by the HUD on every orb landing and
  // scaled per play by `lossCue` (src/ui/lossFx.ts): gain up and rate down
  // with the loss's share of the pool max.
  moraleloss: 'audio/morale_loss.wav',
  // The sector-cleared sting, `win`'s little sibling, off `sector:cleared`
  // in the event-sound registry.
  sectorwin: 'audio/sectorwin.wav',
  // The promotion card's reveal tick, played by PromotionScreen's reveal
  // timeline, not by the registry.
  stattick: 'audio/stattick.wav',
};

/**
 * Each sound's own level, under master × SFX (`soundVolume`). Impacts play
 * at 1. The fanfares (`win`, `lose`, `sectorwin`) are softer, so a result
 * doesn't land louder than the hits before it. The status ticks (`burn`,
 * `bleed`, `poison`, `healtick`) are quieter: a status ticks once a second
 * on every unit that holds it, and that sustained beat would dominate at
 * full level.
 */
const VOLUMES: Record<SoundKey, number> = {
  burn: 0.6,
  // Up to three plays a cast, one a hop, so it sits under `magicboom`.
  chain: 0.8,
  click: 0.7,
  // A movement whoosh, under the impacts so it reads as motion, not a hit.
  dash: 0.9,
  death: 1.0,
  healtick: 0.55,
  lose: 0.7,
  // The mage's signature impact, under `melee` and `shoot` so a two-mage
  // barrage doesn't dominate the mix.
  magicboom: 0.9,
  melee: 1.0,
  // A positive chime at the click's level, not an impact.
  pickup: 0.7,
  recruit: 0.8,
  shoot: 1.0,
  win: 0.7,
  // The casts and the raise sit mid; `thud`, the catapult's landing, is a
  // heavy crash.
  bleed: 0.6,
  poison: 0.55,
  vial: 0.75,
  freeze: 0.8,
  hex: 0.7,
  lightray: 0.75,
  wail: 0.75,
  summon: 0.8,
  thud: 0.85,
  // The landing cue's ceiling: `lossCue` scales each play's gain from about
  // half of this at a small loss up to all of it at the shake's ceiling, so
  // a small loss ticks and a big one lands.
  moraleloss: 0.85,
  sectorwin: 0.7,
  // A beat for the level and one per grown stat, in a row; the sample is
  // short, so it sits a touch over `healtick`.
  stattick: 0.6,
};

/**
 * Each sound's pitch jitter. Every play sets the playback rate to
 * `1 ± variance` (uniform), which shifts pitch and tempo together, so a
 * repeated impact doesn't lock the ear onto one tone. An impact stays at 0.1
 * or under: past that it reads as a broken sample rather than a different
 * hit. The cues that fire in crowds (`burn`, `bleed`, `poison`, and
 * `chain`'s hops, which land 0.1 s apart) go to 0.12, so many at once read
 * as a crackle, not a stutter. A one-shot cue (`click`, `recruit`, `pickup`,
 * the fanfares) stays at 0: variation on something heard alone reads as
 * inconsistency, not life.
 */
const PITCH_VARIANCE: Record<SoundKey, number> = {
  burn: 0.12,
  chain: 0.12,
  click: 0,
  // So several rogues dashing on one tick don't sound like one stuttered
  // sample.
  dash: 0.08,
  death: 0.08,
  // A healing tile holds a unit for many ticks; light jitter keeps the cue
  // organic without losing it.
  healtick: 0.08,
  // Can fire in a burst, one a loss; light jitter on top of the rate
  // `lossCue` sets.
  moraleloss: 0.05,
  lose: 0,
  magicboom: 0.08,
  melee: 0.1,
  pickup: 0,
  recruit: 0,
  sectorwin: 0,
  shoot: 0.1,
  // A counter, not an impact: the beats of one tally must match.
  stattick: 0,
  win: 0,
  // The casts, the wail and the raise keep low jitter; `thud` takes a touch,
  // so a siege's crashes don't repeat exactly.
  bleed: 0.12,
  poison: 0.12,
  vial: 0.07,
  freeze: 0.06,
  hex: 0.07,
  lightray: 0.08,
  wail: 0.05,
  summon: 0.05,
  thud: 0.08,
};

const POOL_SIZE = 4;
/** The master level an `AudioPlayer` starts at, before the settings reach
 *  it. The settings' fallback for it (src/settings/settings.ts) is equal,
 *  which AudioPlayer.test.ts holds. */
export const DEFAULT_MASTER_VOLUME = 0.5;

/**
 * One sound's volume: master × SFX × the sound's own level, times a per-play
 * gain, clamped to what an `<audio>` element takes.
 */
export function soundVolume(master: number, sfx: number, own: number, gain = 1): number {
  return Math.max(0, Math.min(1, master * sfx * own * gain));
}

export class AudioPlayer {
  private masterVolume = DEFAULT_MASTER_VOLUME;
  private sfxVolume = 1;
  // The recorder reaches `pools` and wraps `play` from outside
  // (shell/electron/probes/record-page.js) to route every element into its
  // recording; AudioPlayer.test.ts pins that shape. A sound played any other
  // way would be missing from recordings.
  private readonly pools: Record<SoundKey, HTMLAudioElement[]>;
  private readonly cursors: Record<SoundKey, number>;

  constructor() {
    this.pools = {} as Record<SoundKey, HTMLAudioElement[]>;
    this.cursors = {} as Record<SoundKey, number>;
    for (const key of Object.keys(SOUND_SOURCES) as SoundKey[]) {
      const pool: HTMLAudioElement[] = [];
      for (let i = 0; i < POOL_SIZE; i++) {
        const audio = new Audio(SOUND_SOURCES[key]);
        audio.preload = 'auto';
        audio.volume = soundVolume(this.masterVolume, this.sfxVolume, VOLUMES[key]);
        pool.push(audio);
      }
      this.pools[key] = pool;
      this.cursors[key] = 0;
    }
  }

  /**
   * Play one cue. The optional `scale` is per play: `gain` multiplies the
   * key's own level (the product clamped to [0, 1] with the master) and
   * `rate` multiplies the playback rate under the key's jitter; the pool
   * bar's landing cue scales both with the loss (`lossCue`,
   * src/ui/lossFx.ts). Both are set on the element at every play, so a
   * scaled play never leaks into the next unscaled one on the same element.
   */
  play(key: SoundKey, scale?: { readonly gain?: number; readonly rate?: number }): void {
    const pool = this.pools[key];
    const cursor = this.cursors[key];
    const audio = pool[cursor]!;
    this.cursors[key] = (cursor + 1) % POOL_SIZE;
    const variance = PITCH_VARIANCE[key];
    const jitter = variance > 0 ? 1 + (Math.random() * 2 - 1) * variance : 1;
    audio.playbackRate = (scale?.rate ?? 1) * jitter;
    audio.volume = soundVolume(this.masterVolume, this.sfxVolume, VOLUMES[key], scale?.gain ?? 1);
    audio.currentTime = 0;
    audio.play().catch(() => {
      // Autoplay policy may reject before any user gesture, and stolen
      // playback can throw an AbortError. Neither should break the game.
    });
  }

  /** The two levels the settings hold, each 0 to 1. A sound already playing
   *  takes the new level at once; `play` sets it again per play. */
  setVolume(master: number, sfx: number): void {
    this.masterVolume = Math.max(0, Math.min(1, master));
    this.sfxVolume = Math.max(0, Math.min(1, sfx));
    for (const key of Object.keys(this.pools) as SoundKey[]) {
      const target = soundVolume(this.masterVolume, this.sfxVolume, VOLUMES[key]);
      for (const audio of this.pools[key]) {
        audio.volume = target;
      }
    }
  }
}
