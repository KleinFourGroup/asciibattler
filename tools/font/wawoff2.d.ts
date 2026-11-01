// Types for wawoff2 (Google's woff2 built to WebAssembly), which ships none:
// the two calls the drawn face's build and its test make.
declare module 'wawoff2' {
  /** An OpenType or TrueType font's bytes, as a woff2. */
  export function compress(src: Uint8Array): Promise<Uint8Array>;
  /** A woff2's bytes, as the OpenType or TrueType font it holds. */
  export function decompress(src: Uint8Array): Promise<Uint8Array>;
}
