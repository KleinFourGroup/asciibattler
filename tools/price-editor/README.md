# Price editor (50f)

Standalone dev page for authoring `config/prices.json` — the port price book
(unit base × level curve ± jitter, packet/daemon per-id overrides, the sell
fraction, the flat removal fee, the entry stock counts; cluster-3-spec
§Ports).

- **Run it:** `npm run dev`, then <http://localhost:5173/tools/price-editor/>.
  Dev-only — not part of the production build.
- **Validation** re-runs the real `PricesSchema` (src/config/prices.ts) on
  every edit plus `assertPriceRefs` against the live catalogs — every
  DRAFTABLE archetype must carry a base price (port stock rolls from the
  draft pool), and every override key must name a real packet / daemon.
  The form is constrained to make those hard to break (draftable rows can't
  be removed; override ids come from the catalogs), but Save gates on the
  real checks.
- **Display honesty:** the resolved-price preview derives through the same
  `*For` price cores the game charges with (`unitPriceFor` /
  `packetPriceFor` / `daemonPriceFor` / `sellPriceFor`) on the working
  document — never a re-derivation.
- **Save** posts through `formatPricesJson` (tools/price-editor/format.ts —
  byte-faithful, pinned by tests/tools/price-editor.test.ts) to the dev-only
  `/__save-config` endpoint. Copy / Download are the offline fallbacks.

One document, no tabs — unlike the item-catalog editors, `prices.json` is a
single price book.
