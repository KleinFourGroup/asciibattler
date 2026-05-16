# TODO.md

Small follow-ups that aren't roadmap steps. Add things here when they're worth fixing but would derail the current step. Cross them off as we land them.

## Polish / pre-launch

- [ ] **Favicon.** Browser logs an error on every load because there's no `/favicon.ico`. Add one — could be a tiny inline-SVG `M` or `@` glyph in `TERMINAL_GREEN` matching the aesthetic. (Quick fix: add `<link rel="icon" type="image/svg+xml" href="data:image/svg+xml,..."/>` to `index.html`.)

## Dev affordances to remove before MVP ships (tracked under ROADMAP Step 5.3)

These are already marked with `TODO(roadmap-5.3)` in source; listed here for visibility.

- [ ] `OrbitControls` in `src/render/Renderer.ts` — replace with a fixed camera.
- [ ] `Stats` (FPS panel) in `src/render/Renderer.ts` — remove from production build.

## Bundle / perf

- [ ] Vite reports the production JS chunk is >500KB (essentially all three.js). Fine for an MVP, but worth a `build.chunkSizeWarningLimit` bump or a code-split pass if it gets noisy.
