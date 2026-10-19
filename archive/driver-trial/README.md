# The driver trial's records (§123 and §124)

The phase driver was tried on §123 and §124 and kept by the user on
2026-10-18. The verdicts are in WORKLOG §123 and §124, "The driver trial";
the role's procedure is now [process/driving.md](../../process/driving.md).
These files ran from `scratch/`, ignored by git, and were moved here on
2026-10-19 so the verdicts' sources survive off the machine they ran on.
Where a verdict cites `scratch/123-driver-trial/` or
`scratch/124-driver-trial/`, read this folder.

| File | Was | What it is |
|---|---|---|
| `prompt-v1.md` | `123-driver-trial/driver-prompt-v1.md` | §123's first prompt |
| `prompt-v2.md` | `123-driver-trial/driver-prompt.md` | §123's prompt as run |
| `prompt-v3.md` | `124-driver-trial/driver-prompt-v3.md` | the draft read before §124 |
| `prompt-v4.md` | `124-driver-trial/driver-prompt.md` | §124's prompt as run |
| `prompt-v5.md` | `124.5-driver-trial/driver-prompt.md` | the role kept; never run, superseded by the process doc |
| `log-123.md` | `123-driver-trial/log.md` | §123's driver log, W0 to W63 |
| `log-124.md` | `124-driver-trial/log.md` | §124's two drivers' log, W0 to W15 |
| `findings.md` | `123-driver-trial/findings.md` | the app's session tools as observed, 2026-10-15 to 17 |
| `cache-gaps.mjs` | `123-driver-trial/cache-gaps.mjs` | the cost instrument (cache writes, reads and list price per transcript; `--self-check`) |
| `readings-check.mjs` | `124-driver-trial/readings-check.mjs` | checks a session's context readings against its transcript, until TODO §127's guard |

The cost reading, the per-wake log and the trial's columns were retired
when the role was kept (2026-10-19); `cache-gaps.mjs` is here if a cost
question comes back.
