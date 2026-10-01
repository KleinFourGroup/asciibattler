import { expect, it } from 'vitest';
import { expectSameReplay } from '../journalDrive';

// The phase's exit at the shipped length: a whole recorded run replays to the
// same bytes. In its own file because it is the slowest journal test by far,
// and files run side by side (journal-replay.test.ts holds the rest).

it('a run at the shipped length (seed 5, character=soldier) replays to the same bytes', () => {
  const { battles, discards } = expectSameReplay({ kind: 'seed', seed: 5, dials: 'character=soldier' });
  expect(battles).toBeGreaterThan(10);
  // Its mid-battle discards were real ones (a packet was held).
  expect(discards).toBeGreaterThan(0);
}, 30_000);
