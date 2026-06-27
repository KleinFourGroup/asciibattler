/**
 * §32b — procedural SFX generator (the chiptone-offload).
 *
 * Synthesizes the §32 status / afflicter / summon sounds straight into
 * `public/audio/` as 16-bit mono WAVs, in a stylized retro/sfxr voice that sits
 * with the hand-made set. Pure Node, zero deps. Run:
 *
 *     npm run gen:sfx
 *
 * Every sound is DETERMINISTIC (a seeded PRNG drives the noise), so re-running
 * produces byte-identical files — no spurious git diffs. To tweak a sound, edit
 * its recipe below and re-run; to replace one with a hand-made file, just drop
 * yours in `public/audio/` and delete its entry from `SOUNDS` so a regen won't
 * clobber it. The catapult impact is the user's `thud.wav` (not generated here).
 *
 * These are stylized approximations — a retro game wants character, not realism.
 * The organic-leaning ones (wail / vial / freeze) are the most "synthy"; swap in
 * a real sample later if you find a better one.
 */

import { writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const SR = 44100;
const OUT_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', 'public', 'audio');

/* --------------------------------- core --------------------------------- */

/** Deterministic PRNG (mulberry32) so noise is reproducible per sound. */
function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const buffer = (durSec) => new Float32Array(Math.ceil(durSec * SR));
const val = (x, t) => (typeof x === 'function' ? x(t) : x);

/** Add an oscillator (phase-integrated, so a frequency function sweeps cleanly).
 *  `vibHz`/`vibDepth` add sinusoidal vibrato. */
function addOsc(buf, { freq, amp, type = 'sine', vibHz = 0, vibDepth = 0 }) {
  let phase = 0;
  for (let i = 0; i < buf.length; i++) {
    const t = i / SR;
    let f = val(freq, t);
    if (vibHz) f += vibDepth * Math.sin(2 * Math.PI * vibHz * t);
    phase += f / SR;
    const ph = phase - Math.floor(phase);
    let s;
    if (type === 'sine') s = Math.sin(2 * Math.PI * phase);
    else if (type === 'square') s = ph < 0.5 ? 1 : -1;
    else if (type === 'saw') s = 2 * ph - 1;
    else s = 4 * Math.abs(ph - 0.5) - 1; // triangle
    buf[i] += val(amp, t) * s;
  }
}

/** Add (optionally low-passed) noise. `lp` in (0,1]: small = darker/wetter,
 *  1 = white. `crackle` (0..1) randomly gates samples for a sparse texture. */
function addNoise(buf, { amp, rng, lp = 1, crackle = 0 }) {
  let y = 0;
  for (let i = 0; i < buf.length; i++) {
    const t = i / SR;
    let white = rng() * 2 - 1;
    if (crackle && rng() > crackle) white = 0;
    y += lp * (white - y); // one-pole low-pass
    buf[i] += val(amp, t) * y;
  }
}

const expDecay = (tau) => (t) => Math.exp(-t / tau);
/** A 0→1→0 hump over `dur` (raised sine) — for swelling whooshes. */
const swell = (dur) => (t) => Math.sin(Math.PI * Math.min(1, Math.max(0, t / dur)));
/** Linear attack ramp to 1 over `atk` seconds, then hold. */
const attack = (atk) => (t) => Math.min(1, t / atk);

/** Normalize to `peak`, then 4 ms in/out fades to kill clicks. */
function finish(buf, peak = 0.9) {
  let max = 0;
  for (const s of buf) max = Math.max(max, Math.abs(s));
  if (max > 0) {
    const g = peak / max;
    for (let i = 0; i < buf.length; i++) buf[i] *= g;
  }
  const fade = Math.floor(0.004 * SR);
  for (let i = 0; i < fade && i < buf.length; i++) {
    const g = i / fade;
    buf[i] *= g;
    buf[buf.length - 1 - i] *= g;
  }
  return buf;
}

/** Encode mono float samples [-1,1] → a 16-bit PCM WAV Buffer. */
function encodeWav(samples) {
  const n = samples.length;
  const buf = Buffer.alloc(44 + n * 2);
  buf.write('RIFF', 0);
  buf.writeUInt32LE(36 + n * 2, 4);
  buf.write('WAVE', 8);
  buf.write('fmt ', 12);
  buf.writeUInt32LE(16, 16);
  buf.writeUInt16LE(1, 20); // PCM
  buf.writeUInt16LE(1, 22); // mono
  buf.writeUInt32LE(SR, 24);
  buf.writeUInt32LE(SR * 2, 28); // byte rate
  buf.writeUInt16LE(2, 32); // block align
  buf.writeUInt16LE(16, 34); // bits
  buf.write('data', 36);
  buf.writeUInt32LE(n * 2, 40);
  for (let i = 0; i < n; i++) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    buf.writeInt16LE(Math.round(s * 32767), 44 + i * 2);
  }
  return buf;
}

/* ------------------------------- recipes -------------------------------- */
// Each entry: filename → a builder returning finished float samples. Seeds are
// fixed constants so output is reproducible.

const SOUNDS = {
  // DoT ticks — short, quiet, fire ~1/sec on an afflicted unit (the AudioPlayer
  // adds ±12% pitch jitter so a board-wide DoT reads as a crackle, not a tone).
  bleed: () => {
    const b = buffer(0.13);
    const rng = mulberry32(1011);
    addNoise(b, { rng, lp: 0.12, amp: (t) => 0.9 * Math.exp(-t / 0.035) }); // wet splat
    addOsc(b, { type: 'sine', freq: (t) => 120 * Math.exp(-t / 0.04), amp: expDecay(0.045) }); // low body
    return finish(b, 0.8);
  },
  poison: () => {
    const b = buffer(0.18);
    const rng = mulberry32(2022);
    // rising "bloop" with a fast wobble (sickly bubble) + a fizz of bright noise
    addOsc(b, {
      type: 'sine',
      freq: (t) => 250 + 520 * (t / 0.18) + 60 * Math.sin(2 * Math.PI * 26 * t),
      amp: (t) => 0.85 * Math.exp(-t / 0.07),
    });
    addNoise(b, { rng, lp: 0.06, amp: (t) => 0.15 * Math.exp(-t / 0.05) });
    return finish(b, 0.78);
  },

  // Afflicter casts — one per cast (on the ability's impact phase).
  vial: () => {
    const b = buffer(0.32);
    const rng = mulberry32(3033);
    // crack: a bright noise transient (the glass breaks)
    addNoise(b, { rng, lp: 0.7, amp: (t) => (t < 0.045 ? 0.9 * Math.exp(-t / 0.012) : 0) });
    // shards: a few high descending pings
    for (const f0 of [2600, 3100, 2150]) {
      addOsc(b, {
        type: 'sine',
        freq: (t) => f0 * Math.exp(-t / 0.3),
        amp: (t) => (t > 0.02 ? 0.16 * Math.exp(-(t - 0.02) / 0.12) : 0),
      });
    }
    // splash tail: wet low-passed noise
    addNoise(b, { rng, lp: 0.08, amp: (t) => (t > 0.04 ? 0.4 * Math.exp(-(t - 0.04) / 0.12) : 0) });
    return finish(b, 0.85);
  },
  freeze: () => {
    const b = buffer(0.34);
    const rng = mulberry32(4044);
    // crystalline shimmer: detuned high sines, slight downward drift + vibrato
    for (const f0 of [1900, 2250, 2650]) {
      addOsc(b, {
        type: 'sine',
        freq: (t) => f0 * (1 - 0.1 * t),
        vibHz: 9,
        vibDepth: 18,
        amp: (t) => 0.22 * attack(0.02)(t) * Math.exp(-t / 0.22),
      });
    }
    // frost crackle: sparse bright noise up front
    addNoise(b, { rng, lp: 0.6, crackle: 0.7, amp: (t) => 0.3 * Math.exp(-t / 0.1) });
    return finish(b, 0.8);
  },
  hex: () => {
    const b = buffer(0.4);
    // dissonant ~tritone of detuned triangles, vibrato, sagging pitch (woozy curse)
    addOsc(b, {
      type: 'triangle',
      freq: (t) => 240 * (1 - 0.18 * t),
      vibHz: 6,
      vibDepth: 14,
      amp: (t) => 0.5 * attack(0.03)(t) * Math.exp(-t / 0.3),
    });
    addOsc(b, {
      type: 'triangle',
      freq: (t) => 339 * (1 - 0.18 * t), // 339/240 ≈ 1.41, a tritone
      vibHz: 5.3,
      vibDepth: 16,
      amp: (t) => 0.45 * attack(0.03)(t) * Math.exp(-t / 0.3),
    });
    return finish(b, 0.78);
  },
  lightray: () => {
    const b = buffer(0.26);
    const rng = mulberry32(6066);
    // laser: saw with a fast downward sweep + a bright sizzle
    addOsc(b, {
      type: 'saw',
      freq: (t) => 1700 * Math.exp(-t / 0.05) + 260,
      amp: (t) => 0.7 * Math.exp(-t / 0.09),
    });
    addNoise(b, { rng, lp: 0.5, amp: (t) => 0.25 * Math.exp(-t / 0.05) });
    return finish(b, 0.85);
  },
  wail: () => {
    const b = buffer(0.6);
    const rng = mulberry32(7077);
    // ghostly cry: heavy-vibrato saw, pitch rises to a peak then falls, airy breath
    addOsc(b, {
      type: 'saw',
      freq: (t) => 380 + 260 * Math.sin(Math.PI * (t / 0.6)),
      vibHz: 7,
      vibDepth: 35,
      amp: (t) => 0.6 * attack(0.08)(t) * (t > 0.4 ? Math.max(0, 1 - (t - 0.4) / 0.2) : 1),
    });
    addNoise(b, { rng, lp: 0.15, amp: (t) => 0.12 * swell(0.6)(t) });
    return finish(b, 0.8);
  },

  // Summon — a necromantic rise (the ghoul claws up out of the ground).
  summon: () => {
    const b = buffer(0.45);
    const rng = mulberry32(8088);
    addOsc(b, {
      type: 'saw',
      freq: (t) => 55 + 150 * (t / 0.45), // rising rumble
      amp: (t) => 0.55 * attack(0.05)(t) * (t > 0.3 ? Math.max(0, 1 - (t - 0.3) / 0.15) : 1),
    });
    addNoise(b, { rng, lp: 0.1, amp: (t) => 0.4 * swell(0.45)(t) }); // swelling whoosh
    addOsc(b, {
      type: 'sine',
      freq: 1400,
      amp: (t) => (t > 0.28 ? 0.12 * Math.exp(-(t - 0.28) / 0.08) : 0), // peak shimmer
    });
    return finish(b, 0.85);
  },
};

/* --------------------------------- main --------------------------------- */

mkdirSync(OUT_DIR, { recursive: true });
let total = 0;
for (const [name, build] of Object.entries(SOUNDS)) {
  const wav = encodeWav(build());
  writeFileSync(join(OUT_DIR, `${name}.wav`), wav);
  total += wav.length;
  console.log(`  ${name}.wav  ${(wav.length / 1024).toFixed(1)} KB`);
}
console.log(`Wrote ${Object.keys(SOUNDS).length} sounds (${(total / 1024).toFixed(1)} KB) → public/audio/`);
