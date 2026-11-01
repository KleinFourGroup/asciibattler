// The drawn face's files, read from disk for the tests: its sources, as
// gen:font reads them, and its shipped woff2, decompressed, so a test reads
// the file a player is served rather than the table it was built from.

import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { decompress } from 'wawoff2';
import { FACES, type ShippedFace } from '../src/render/fontSubset';
import type { GlyphFaceSources } from '../tools/font/glyphFace';

const FONTS = join(dirname(fileURLToPath(import.meta.url)), '..', 'assets', 'fonts');

export const DRAWN_FACE: ShippedFace = FACES.find((f) => f.role === 'drawn')!;
const PRIMARY_FACE: ShippedFace = FACES.find((f) => f.role === 'primary')!;

/** The drawn face's sources: the primary's TTF, the table, every radical. */
export function drawnFaceSources(): GlyphFaceSources {
  const dir = join(FONTS, DRAWN_FACE.dir);
  return {
    primary: new Uint8Array(readFileSync(join(FONTS, PRIMARY_FACE.dir, PRIMARY_FACE.source))),
    table: JSON.parse(readFileSync(join(dir, DRAWN_FACE.source), 'utf8')) as unknown,
    radicals: new Map(
      readdirSync(join(dir, 'radicals'))
        .filter((name) => name.endsWith('.svg'))
        .map((name) => [name.slice(0, -4), readFileSync(join(dir, 'radicals', name), 'utf8')]),
    ),
  };
}

/** The committed woff2 of the drawn face, decompressed to its OpenType bytes. */
export async function shippedDrawnFace(): Promise<Uint8Array> {
  return new Uint8Array(
    await decompress(readFileSync(join(FONTS, DRAWN_FACE.dir, DRAWN_FACE.out))),
  );
}

/** An sfnt's tables by tag. */
export function sfntTables(bytes: Uint8Array): Map<string, Uint8Array> {
  const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const tables = new Map<string, Uint8Array>();
  for (let i = 0; i < dv.getUint16(4); i++) {
    const rec = 12 + i * 16;
    const tag = String.fromCharCode(...bytes.subarray(rec, rec + 4));
    const off = dv.getUint32(rec + 8);
    tables.set(tag, bytes.subarray(off, off + dv.getUint32(rec + 12)));
  }
  return tables;
}
