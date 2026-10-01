/**
 * The build's ID (Round 8 spec D2): `<version>+<commit>`, with `-dirty` when
 * the tree had uncommitted changes and `-dev` when it is served live (the dev
 * server, Vitest), where the tree can change under a running server. Baked by
 * `vite.config.ts`'s `define` from scripts/build-id.mjs, which lists the
 * forms. It is stamped on the store, the saves and the journals.
 *
 * A dev server outlives commits and edits, and it bakes its constant once,
 * when it starts. So it also stamps the ID into the HTML at each page load
 * (`buildIdAtLoad` in vite.config.ts), and a DEV page reads that stamp first:
 * its ID names the commit and the tree's state as they were at the load. A
 * build's page has no stamp and no code that looks for one.
 *
 * Outside Vite (tsx: the fuzz and gauntlet CLIs) nothing bakes it, and it
 * reads `UNBAKED_BUILD_ID`. Node-side code that needs the tree's real ID calls
 * scripts/build-id.mjs itself.
 */
declare const __BUILD_ID__: string | undefined;

export const UNBAKED_BUILD_ID = 'unbaked';

/** The global the dev server's stamp sets on the page. */
export const AT_LOAD_GLOBAL = '__BUILD_ID_AT_LOAD__';

/** The inline script the dev server puts at the top of the HTML it serves.
 *  `<` is escaped so no ID can close the script element. */
export function atLoadScript(id: string): string {
  return `window.${AT_LOAD_GLOBAL} = ${JSON.stringify(id).replaceAll('<', '\\u003c')};`;
}

/** The stamp when the page has one, else the baked constant, else the
 *  fallback's name. */
export function resolveBuildId(baked: unknown, atLoad: unknown): string {
  if (typeof atLoad === 'string' && atLoad !== '') return atLoad;
  return typeof baked === 'string' ? baked : UNBAKED_BUILD_ID;
}

const baked = typeof __BUILD_ID__ === 'string' ? __BUILD_ID__ : UNBAKED_BUILD_ID;
const DEV = typeof import.meta.env !== 'undefined' && import.meta.env.DEV === true;

export const BUILD_ID: string = DEV
  ? resolveBuildId(baked, (globalThis as Record<string, unknown>)[AT_LOAD_GLOBAL])
  : baked;
