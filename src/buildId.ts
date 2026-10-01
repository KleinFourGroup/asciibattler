/**
 * The build's ID (Round 8 spec D2): `<version>+<commit>`, with `-dirty` when
 * the tree had uncommitted changes and `-dev` when it is served live (the dev
 * server, Vitest), where the tree can change under a running server. Baked by
 * `vite.config.ts`'s `define` from scripts/build-id.mjs, which lists the
 * forms. It is stamped on the store, the saves and the journals.
 *
 * Outside Vite (tsx: the fuzz and gauntlet CLIs) nothing bakes it, and it
 * reads `UNBAKED_BUILD_ID`. Node-side code that needs the tree's real ID calls
 * scripts/build-id.mjs itself.
 */
declare const __BUILD_ID__: string | undefined;

export const UNBAKED_BUILD_ID = 'unbaked';

export const BUILD_ID: string = typeof __BUILD_ID__ === 'string' ? __BUILD_ID__ : UNBAKED_BUILD_ID;
