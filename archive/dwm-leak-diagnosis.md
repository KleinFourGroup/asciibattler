# dwm.exe resource leak — diagnosis & post-mortem

**Status:** environmental (NOT an ASCIIbattler bug). Reboot-reclaimable; no permanent root-cause fix found. Mitigations live in [HANDOFF.md](../HANDOFF.md) + [BALANCE.md](../BALANCE.md) "Parallelism". This file is the full detail — read it only if the mitigations aren't enough.

**TL;DR:** Over multi-day uptime, `dwm.exe` (the Windows Desktop Window Manager) leaks **committed memory** continuously — ~3–10 MB/min depending on how much is being composited. After ~4 days it reached **24 GB committed / ~200K handles**. That doesn't slow normal use, but it shrinks the session's safety margin enough that a **burst of child-process spawns** (`--jobs` balance sweeps) intermittently fails on Windows `0xC0000142` (`STATUS_DLL_INIT_FAILED`). It is **not our code**, and — confirmed this session — **not the GPU driver**. A reboot fully reclaims it.

---

## System / environment

| | |
|---|---|
| CPU | Intel Core i9-14900KF (24 physical / 32 logical cores) |
| RAM | 32 GB |
| OS | Windows 11 Home, build 26200 |
| GPU | NVIDIA GeForce RTX 4080 SUPER |
| GPU driver | 591.74 (2025-12-29) at first observation → updated to 610.47 (2026-05-18); **leak unchanged by the update** |
| Prior machine | a different box with an **AMD GPU** — same dwm high-RAM behavior (per the owner) |
| Triggering workload | a Node.js fuzz harness that burst-spawns child processes (`node --import tsx`, `--jobs=N` grid sharding) |

## Symptom

Heavy multi-point `--balance-sweep --jobs=N` runs die mid-sweep when a child process fails to spawn with `0xC0000142`. Single-process (`--jobs=1`, never spawns a child) runs clean. The failure is **intermittent across runs but deterministic within a degraded session** — once the session crosses a threshold it fails on *every* subsequent spawn (see "Why the spawns fail" below). Commit `d745836` added `SHARD_ATTEMPTS=3` spawn-retries, which ride out a marginal session but can't rescue a fully-degraded one.

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
- **Leading suspects: Windows/dwm itself, or a persistent piece of the user's environment that composites continuously** — e.g. the user's **eye-tracking software** (gaze overlays / continuous screen-region capture composite through dwm constantly, and it has followed the user across both machines; it also hooks dwm deeply enough that it crashes when dwm restarts). NB the user believes the eye-trackers do **not** inject DLLs into other processes — if so, the spawn-failure DLL is a *system* DLL failing on the exhausted resource, not an injected hook (see below). Untested because confirming means closing those programs (and Claude for Windows, the one GPU-accelerated app present in 100% of measurements). Not pursued further — the mitigations make it a non-blocker.

## Why the spawns fail — a hard threshold, NOT a spawn count

`0xC0000142` is `STATUS_DLL_INIT_FAILED`: a DLL failed to initialize during the child's startup. It is **deterministic, not probabilistic** — the original observation was that once it began, it failed on *every* child, repeatably. So the *number* of spawns is irrelevant: a `--jobs=2` run died at grid point 4 — only ~7 lifetime spawns, in bursts of 2. "Enough spawns to eventually roll a failure" is the wrong model.

The real model is a **hard threshold on a fixed, session-scoped resource** — one *separate* from the 75 GB system commit (which is why ~15 GB free was a red herring). Leading candidate: session paged pool / view space, consumed by dwm's leaked surface objects. Every *new* process needs a slab of that resource to initialize `win32k`/`user32` (and any globally-injected hook DLLs). Once the leak pushes the session past the threshold, that init step fails for the *next* process created — 1st or 7th, alone or in a burst. `--jobs=2` died at point 4 because the session had crossed the line by then (multi-day uptime near the edge + the run's own minutes of ~10 MB/min growth); `J` only changes wall-clock, never *whether* the wall is hit. `--jobs=1` is immune because it never creates a child (the running process is long past its own init). Hand-opening an app still works because a lone lightweight launch fits the last sliver (and closing apps frees some), whereas a heavyweight `node`+`tsx` child-init over the line does not.

**Two flavors fit the error code, both unproven:** (a) **session-resource exhaustion** — a *system* DLL (`user32`/`win32k`) can't obtain its slab of the exhausted session resource and fails `DllMain` (needs no injection; the more likely one if the eye-trackers really don't inject); or (b) a **globally-injected hook DLL** whose `DllMain` fails once the session is degraded — this would make *every* new process die at init while running processes are unaffected, and would explain the cross-machine pattern, but only if something *is* injected. Not pinned: the failures left no Application/System event-log entry (the parent caught each spawn error), so the faulting DLL isn't named. To pin it next time it recurs: Process Monitor on a failing spawn, or check which DLLs are injected into an unrelated process (Process Explorer / `tasklist /m`). (Exact resource/DLL not definitively pinned.)

## Ruled out: the fuzz workload itself

To confirm the harness wasn't adding its own leak, we ran 600 sequential full-length sim runs in **one** process and sampled `heapUsed` **after a forced GC** every 50 runs:

```
start     heapUsed=15.3 MB   rss= 91 MB
50 runs   heapUsed=16.4 MB   rss=228 MB
…
600 runs  heapUsed=16.6 MB   rss=230 MB   (flat the whole way)
```

`heapUsed` (the live retained set) is **flat at ~16.6 MB across all 600 runs** → no per-run retention; the sim/harness does not leak. The ~230 MB RSS is V8 heap *headroom* — reserved for the heavy short-lived allocation churn of running battles and never returned to the OS — not retained objects. So the headless children are an innocent *trigger* for the dwm threshold, not a memory contributor of their own.

## Mitigations (the part future-us actually needs)

1. **Reboot reclaims it fully.** A fresh session sits at a few hundred MB. At ~10 MB/min it takes **days** to re-reach the pathological state — so a fresh reboot buys hours of clean headroom.
2. **Reboot right before any heavy `--jobs` sweep.** (The N2 *overnight* verify, N4, is deferred indefinitely to a VPS — we won't risk an unattended overnight run dying partway on a local Windows issue we can't control.)
3. **`--jobs=1` is immune by construction** (never spawns a child) — the fallback when you can't/won't reboot, just slower (~40–50 min for a heavy run).
4. **Watch it:** `(Get-Process dwm).PrivateMemorySize64 / 1GB`. Multiple GB → reboot before a big parallel run.
5. **Don't restart dwm directly** (`Stop-Process -Name dwm`) on this machine without prep — the accessibility programs don't handle a dwm crash gracefully.
6. **Optional hardening:** a persistent-worker-pool refactor of the sharding (spawn `jobs` workers once, feed them grid points over IPC, instead of respawning `jobs` children per grid point) would cut total spawns from `gridPoints × jobs` to `jobs` and largely sidestep this class of flake. Pure robustness/speed; deliberately deferred — the current design uses fresh processes per point for determinism (clean config re-apply, no shared state; the "processes over worker_threads" call).

## Appendix — measurement method

PowerShell sampling of `(Get-Process dwm).Handles` and `.PrivateMemorySize64` every 2–5 s to a CSV, across controlled conditions (idle / per-app-close / bare desktop / post-reboot). The discriminator that distinguished "settling" from "leaking" post-reboot: **handles plateau when app-loading finishes; a leak keeps committed memory climbing linearly past that point.** Driver/uptime confirmed via `Get-CimInstance Win32_VideoController` + `Win32_OperatingSystem.LastBootUpTime`.

## Open questions (outside insight welcome)

Shared in the hope someone recognizes the pattern. Specific unknowns:

1. **Which session-scoped resource actually gates the spawn?** We inferred session paged pool / view space but never pinned it (the failure left no event-log entry). What's the clean way to watch the *binding* resource on Windows 11 in real time (session pool / desktop heap / per-session GDI-USER)?
2. **What makes `dwm.exe` commit ~24 GB it never touches?** A compositor leaking committed-but-untouched memory on a per-present cadence, scaling with on-screen composition, surviving a GPU-vendor change (AMD→NVIDIA) — is this a known dwm/Windows failure mode? Tied to a particular app/driver/overlay class?
3. **Can a non-injecting overlay (e.g. eye-tracking gaze software) drive a dwm surface leak** purely through continuous composition, without hooking other processes?
4. **Best tool to catch the faulting DLL** at the instant of a `0xC0000142` child-spawn failure (Process Monitor boot logging? a specific ETW provider?), so we can name what fails `DllMain`.
