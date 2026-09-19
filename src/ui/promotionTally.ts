/**
 * 104d2 — THE RISING TALLY: the promotion card's reveal beats climb in pitch,
 * the arcade score-count — beat 0 (the level) is the sample's own E6, each
 * later beat one step up a MAJOR scale, topping out an octave up. The count
 * restarts per card, so a bigger promotion climbs higher and the last beat
 * (the derived "what this bought you" block) is a card's highest note.
 *
 * Pure: beat index → the playback-rate multiplier `AudioPlayer.play` takes
 * (rate 2^(n/12) = n semitones up; it also shortens the ~30 ms sample a
 * little, inaudibly). Flip `TALLY_RISES` to hear the flat like-for-like tick.
 */
export const TALLY_RISES = true;

/** Semitones above the root for each degree of the major scale, root → octave. */
const MAJOR_STEPS = [0, 2, 4, 5, 7, 9, 11, 12] as const;

export function tallyRate(beat: number, rises: boolean = TALLY_RISES): number {
  if (!rises) return 1;
  // Clamp at the octave: past it a square tick turns shrill (E7 is 2.6 kHz),
  // and a card that long has made its point — it reads as "topped out".
  const degree = Math.max(0, Math.min(MAJOR_STEPS.length - 1, Math.floor(beat)));
  return 2 ** (MAJOR_STEPS[degree]! / 12);
}
