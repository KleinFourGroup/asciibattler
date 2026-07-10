/// <reference types="vitest/config" />
import { writeFile } from 'node:fs/promises';
import { join, sep } from 'node:path';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { defineConfig, type Plugin } from 'vite';

/**
 * Dev-only save endpoint for the config editors (the archetype editor in I4;
 * the layout editor inherits it in M5). The editors POST a formatted JSON
 * document to `/__save-config` and this writes it straight to the matching file
 * under `config/`, closing the copy-paste loop the dev-tooling ask was about.
 *
 * `apply: 'serve'` keeps it strictly on the dev server — it never runs during
 * `vite build`, so nothing ships in `dist/`. The write target is constrained to
 * a small ALLOWLIST of config filenames, and the resolved path is re-checked to
 * stay inside `config/` before any write — so a stray/hostile request can't
 * write elsewhere on a developer's machine. Validation that the *content* is a
 * well-formed archetype/layout config is the editor's job (it runs the real zod
 * schema client-side and disables Save when invalid); the server only guards the
 * destination + JSON-parseability.
 */
const SAVABLE_CONFIG_FILES = new Set([
  'units.json',
  'layouts.json',
  'sectors.json',
  'encounters.json',
  'abilities.json',
  'rewards.json', // 48e — the reward-table editor (the first economy-cluster file here)
  'packets.json', // 49g — the packet editor
  'prices.json', // 50f — the price editor (the port price book)
]);

function configSavePlugin(): Plugin {
  return {
    name: 'asciibattler-config-save',
    apply: 'serve',
    configureServer(server) {
      const configDir = join(server.config.root, 'config');
      server.middlewares.use(
        '/__save-config',
        (req: IncomingMessage, res: ServerResponse) => {
          const fail = (code: number, error: string): void => {
            res.statusCode = code;
            res.setHeader('content-type', 'application/json');
            res.end(JSON.stringify({ ok: false, error }));
          };
          if (req.method !== 'POST') {
            fail(405, 'POST only');
            return;
          }
          let body = '';
          req.on('data', (chunk) => {
            body += String(chunk);
          });
          req.on('end', () => {
            void (async () => {
              try {
                const { file, content } = JSON.parse(body) as {
                  file?: unknown;
                  content?: unknown;
                };
                if (typeof file !== 'string' || !SAVABLE_CONFIG_FILES.has(file)) {
                  fail(400, `file must be one of: ${[...SAVABLE_CONFIG_FILES].join(', ')}`);
                  return;
                }
                if (typeof content !== 'string') {
                  fail(400, 'content must be a string');
                  return;
                }
                // Defense in depth on top of the allowlist: confirm the resolved
                // path stays inside config/ before touching disk.
                const target = join(configDir, file);
                if (!target.startsWith(configDir + sep)) {
                  fail(400, 'resolved path escapes config/');
                  return;
                }
                JSON.parse(content); // reject a malformed document before writing
                await writeFile(target, content.endsWith('\n') ? content : `${content}\n`, 'utf8');
                res.statusCode = 200;
                res.setHeader('content-type', 'application/json');
                res.end(JSON.stringify({ ok: true, file }));
              } catch (err) {
                fail(400, err instanceof Error ? err.message : String(err));
              }
            })();
          });
        },
      );
    },
  };
}

export default defineConfig({
  plugins: [configSavePlugin()],
  // Relative asset paths in the built index.html / CSS so the same dist/
  // works under any subpath (GitHub Pages project sites, file://, etc.)
  // without needing a per-deploy `base` value.
  base: './',
  build: {
    // R3 — three.js is the bulk of the bundle. Split it into its own vendor
    // chunk (a long-cached file that app redeploys don't bust) and lift the
    // warning ceiling above three's minified size, so the build stays quiet
    // while still flagging genuine future app-code bloat.
    chunkSizeWarningLimit: 1000,
    rollupOptions: {
      output: {
        // Function form (the record form trips Vite's overload typing): route
        // everything under the `three` package into one vendor chunk.
        manualChunks(id) {
          if (id.includes('node_modules/three')) return 'three';
          return undefined;
        },
      },
    },
  },
  server: {
    open: false,
  },
  test: {
    include: ['src/**/*.test.ts', 'tests/**/*.test.ts'],
    // Fuzz harness lives under tests/fuzz/ — opt-in via `npm run fuzz`
    // (CLI) or `npm run fuzz:smoke` (a small vitest run that asserts
    // the harness still runs). Default `npm test` skips it to keep
    // pre-commit fast.
    exclude: ['node_modules/**', 'dist/**', 'tests/fuzz/**'],
    // Sim/core/run code is pure logic — no DOM needed. Render code is not
    // tested here (visual verification handles that).
    environment: 'node',
  },
});
