# Packet editor (49g)

Standalone dev page for authoring `config/packets.json` — the packet catalog
(one-shot consumables delivering one effect op at a target;
cluster-3-spec §Packets).

- **Run it:** `npm run dev`, then <http://localhost:5173/tools/packet-editor/>.
  Dev-only — not part of the production build.
- **Validation** re-runs the real `PacketsSchema` (src/config/packets.ts) on
  every edit — the (op × target × context) legality matrix, the per-op
  duration restrictions, and the `applyTo`/`crit` dealHit-only guards — plus
  `assertPacketStatusRefs` and the reverse reward-table ref check
  (`assertRewardPacketRefs` would trip at boot if a committed table names a
  renamed/deleted packet). Save is disabled while anything complains.
- **The matrix drives the form:** picking an op swaps in its sub-form, derives
  `target` (`PACKET_OP_TARGET`), and constrains the `usableIn` checkboxes
  (`PACKET_OP_CONTEXTS`). `midBattle` renders disabled — the dormant seam.
- **Save** posts through `formatPacketsJson` (tools/packet-editor/format.ts —
  byte-faithful, pinned by tests/tools/packet-editor.test.ts) to the dev-only
  `/__save-config` endpoint. Copy / Download are the offline fallbacks.
- **Dropped by** lists the committed reward tables carrying the active packet;
  attach entries in the [reward editor](../reward-editor/).
