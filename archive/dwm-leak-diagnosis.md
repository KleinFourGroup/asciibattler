# dwm.exe resource leak — diagnosis & post-mortem

**Status:** environmental (NOT an ASCIIbattler bug). Reboot-reclaimable; no permanent root-cause fix found. Mitigations live in [HANDOFF.md](../HANDOFF.md) + [BALANCE.md](../BALANCE.md) "Parallelism". This file is the full detail — read it only if the mitigations aren't enough.

**TL;DR:** Over multi-day uptime, `dwm.exe` (the Windows Desktop Window Manager) leaks **committed memory** continuously — ~3–10 MB/min depending on how much is being composited. After ~4 days it reached **24 GB committed / ~200K handles**. That doesn't slow normal use, but it shrinks the session's safety margin enough that a **burst of child-process spawns** (`--jobs` balance sweeps) intermittently fails on Windows `0xC0000142` (`STATUS_DLL_INIT_FAILED`). It is **not our code**, and — confirmed this session — **not the GPU driver**. A reboot fully reclaims it.

---

## Symptom

Heavy multi-point `--balance-sweep --jobs=N` runs die mid-sweep when a child process fails to spawn with `0xC0000142`. Single-process (`--jobs=1`, never spawns a child) runs clean. The failure is **probabilistic under load** (which is why commit `d745836` added `SHARD_ATTEMPTS=3` spawn-retries — they help a fresh session, but can't rescue a fully-degraded one).

## What it actually is (measured 2026-06-15)

The headline metric is **committed memory in `dwm.exe`, not handle count** (the earlier theory fixated on handles; they're a co-symptom).

Pre-reboot, 4-day uptime:

| Process | Handles | Committed (private) | Working set |
|---|---|---|---|
| `dwm.exe` | ~202,000 | **24.4 GB** | only ~700 MB |
| `audiodg.exe` | ~182,000 | 124 MB | 48 MB |

System commit was 53.5 / 75.7 GB; healthy DWM is ~100–300 MB / a few thousand handles. The 23+ GB gap between dwm's committed (24 GB) and working set (0.7 GB) is committed-but-never-touched memory — reserved, abandoned, never released. That **is** the leak.

### Leak signature (from time-series monitoring of `dwm` private bytes)

- **Continuous and metronomic**, ~1 MB every 6–12 s, running even at a fully idle desktop.
- **Scales with composition load:** ~3.2 MB/min at a bare desktop → ~9–10 MB/min with browsers / Discord / media open. More accelerated content on screen = more GPU presents = faster leak.
- **Decoupled from the handle count.** Handle jumps were small, spiky, and *event*-driven (e.g. Discord activity, closing a window); the memory ramp ignored them and climbed on its own timer.
- **Focus-independent.** It does not require interacting with any app.

### Bisection — which app feeds it?

Closing apps one at a time while watching the dwm slope:

- Closing **Firefox (Reddit) + Discord** changed the memory slope **not at all** (~9.5 MB/min before *and* after). Closing a window produced only a one-time step-up (dwm recompositing the revealed area and keeping the memory) — the leak in miniature.
- **Bare desktop** (everything closed except Claude for Windows, the session host): still leaked **~3.2 MB/min**. A healthy dwm at a static bare desktop is **flat** — zero. So no single app causes it; it's a baseline compositor leak that all accelerated apps merely accelerate.

## Root cause — what it is and isn't

- **NOT our code.** Our sweep children are headless `node` console processes; they never open dwm composition surfaces or audio sessions. They are the *trigger* (burst spawning) that exposes an already-degraded session, not the leaker.
- **NOT the GPU driver.** Updated NVIDIA **591.74 (Dec 2025) → 610.47 (May 2026)** — a ~5-month jump — and rebooted. The reboot reclaimed everything (dwm back to 475 MB / 3.2K handles), but a 10-minute post-reboot monitor showed **handles plateauing (~5,460, apps done loading) while committed memory kept climbing linearly at ~10 MB/min.** The leak survived the driver update intact.
- **Cross-vendor, cross-machine.** The user reports dwm has had abnormally high RAM since this machine was new, **and on the previous machine, which had an AMD GPU.** A leak spanning AMD → NVIDIA is not a GPU-driver bug.
- **Leading suspect: Windows/dwm itself, or a persistent piece of the user's environment that hooks the compositor** — most plausibly the **accessibility programs** that have followed the user across machines (they tap dwm/UI composition continuously, and are known here to hook dwm deeply enough that they crash when it restarts). Untested because confirming it means closing those programs (and Claude for Windows, the one accelerated app present in 100% of measurements). Not pursued further — the mitigations make it a non-blocker.

## Why a burst of small spawns fails when opening one big app doesn't

`--jobs=8` doesn't add 8 threads — it launches `gridPoints × jobs` separate **processes**, in bursts of `jobs` simultaneous spawns per grid point (see [searchShard.ts](../tests/fuzz/searchShard.ts)). Process *creation* must carve out a fresh chunk of a specific, limited session resource (committed address space / desktop heap / pool). Opening Photoshop is **one** such allocation while the system is calm — one die roll near the edge, almost always fine. A sweep is **hundreds** of allocations, several colliding at once, against a margin the leak has eaten into. Any single spawn usually still squeaks through (so single app-launches work and the sweep gets *partway*), but across hundreds of contended attempts the probability one fails approaches certainty — and one failure aborts the run. Size, not the issue; **burst concurrency against a shrunken margin** is. (Exact kernel resource not definitively pinned; committed memory is the leading magnitude.)

## Mitigations (the part future-us actually needs)

1. **Reboot reclaims it fully.** A fresh session sits at a few hundred MB. At ~10 MB/min it takes **days** to re-reach the pathological state — so a fresh reboot buys hours of clean headroom.
2. **Reboot right before any heavy / overnight `--jobs` sweep** (e.g. N4). This is the standing rule.
3. **`--jobs=1` is immune by construction** (never spawns a child) — the fallback when you can't/won't reboot, just slower (~40–50 min for a heavy run).
4. **Watch it:** `(Get-Process dwm).PrivateMemorySize64 / 1GB`. Multiple GB → reboot before a big parallel run.
5. **Don't restart dwm directly** (`Stop-Process -Name dwm`) on this machine without prep — the accessibility programs don't handle a dwm crash gracefully.
6. **Optional hardening:** a persistent-worker-pool refactor of the sharding (spawn `jobs` workers once, feed them grid points over IPC, instead of respawning `jobs` children per grid point) would cut total spawns from `gridPoints × jobs` to `jobs` and largely sidestep this class of flake. Pure robustness/speed; deliberately deferred — the current design uses fresh processes per point for determinism (clean config re-apply, no shared state; the "processes over worker_threads" call).

## Appendix — measurement method

PowerShell sampling of `(Get-Process dwm).Handles` and `.PrivateMemorySize64` every 2–5 s to a CSV, across controlled conditions (idle / per-app-close / bare desktop / post-reboot). The discriminator that distinguished "settling" from "leaking" post-reboot: **handles plateau when app-loading finishes; a leak keeps committed memory climbing linearly past that point.** Driver/uptime confirmed via `Get-CimInstance Win32_VideoController` + `Win32_OperatingSystem.LastBootUpTime`.
