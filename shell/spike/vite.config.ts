import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';

/**
 * The shell spike's build (§110b): the game behind a boot page that reads the
 * store first. `npm run build:spike` writes `dist-spike/` (gitignored), never
 * `dist/`, and leaves the production config untouched. Disposed of at 110f.
 */
const at = (path: string): string => fileURLToPath(new URL(path, import.meta.url));

export default defineConfig({
  root: at('.'),
  base: './',
  publicDir: at('../../public'),
  build: {
    outDir: at('../../dist-spike'),
    emptyOutDir: true,
    // One chunk, three.js included: the production config's vendor split
    // is not what this build tests.
    chunkSizeWarningLimit: 2000,
  },
});
