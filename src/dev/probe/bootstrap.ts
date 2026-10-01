/**
 * 112a — the probe kit's stand-in, injected into `index.html` by the dev
 * server only (vite.config.ts, `probeBootstrap`; `apply: 'serve'`, so no
 * build carries it).
 *
 * The HTML is up before the page's modules: a freshly started dev server
 * holds them for a moment (40 s until its file watcher stopped covering the
 * fuzz output, vite.config.ts; under a second since), and in that window
 * the kit, the Game and the stylesheets are not there yet. This inline
 * script runs as the HTML parses, so a pane session's
 * first call, `await __probe.ready()`, waits for the real kit instead of
 * throwing a ReferenceError or measuring an unloaded page. The real kit
 * replaces `window.__probe` when it installs (./index.ts), and the stand-in
 * hands the wait over to it. Every other kit call refuses by name until then
 * (the names are the kit's, ./index.ts; page.test.ts checks the two lists
 * match).
 *
 * Plain ES5 in a string: it is injected as it stands, and page.test.ts runs
 * this exact text against a fake window.
 */
export const PROBE_BOOTSTRAP = `(function () {
  if (window.__probe) return;
  var stub = {
    live: false,
    ready: function (opts) {
      var timeoutMs = (opts && opts.timeoutMs) || 30000;
      var until = Date.now() + timeoutMs;
      return new Promise(function (resolve, reject) {
        (function poll() {
          if (window.__probe !== stub) {
            var rest = Math.max(1000, until - Date.now());
            resolve(window.__probe.ready(Object.assign({}, opts, { timeoutMs: rest })));
            return;
          }
          if (Date.now() >= until) {
            reject(new Error('__probe.ready: not live after ' + Math.round(timeoutMs / 1000) + ' s. ' +
              'The page modules have not loaded (is the dev server still starting, or watching ' +
              'more than it should? vite.config.ts server.watch). Call __probe.ready() again.'));
            return;
          }
          setTimeout(poll, 100);
        })();
      });
    }
  };
  ['go', 'check', 'running', 'frame', 'pixels', 'hide', 'drive', 'journal'].forEach(function (name) {
    stub[name] = function () {
      throw new Error('__probe.' + name + ': the page is not live yet; await __probe.ready() first.');
    };
  });
  window.__probe = stub;
})();`;
