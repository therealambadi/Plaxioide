# Runtime & Compiler Integration Plan — Graphical Editor + Simulator + Tag Monitor

**Audience:** Claude Code, operating on `plc-main` (Volt — VS Code/Void fork).
**Reference material available to you:** `volt.diy` is present in the root folder. It is our own prior platform — same license, same ownership. You may read it, copy logic from it, and adapt it freely. You do not need to reinvent anything it already solved correctly; you do need to question anything that may have been redundant or browser-specific and shouldn't be ported as-is into a native desktop app.
**Standard for this task:** Full production implementation. Every existing feature (Tag Monitor, the graphical LD/FBD/SFC editors, the Code/Diagram toggle) must end up genuinely wired to a real, running compiler + runtime — not stubbed, not "works if you also run X manually." Verify against actual running behavior at each phase, per the Uncertainty Protocol already in `CLAUDE.md`.

---

## Phase 0 — Mandatory investigation before writing any integration code

Do not skip this. Two open questions must be resolved with evidence from the actual `volt.diy` codebase, not assumption:

### 0.1 — Is STruC++ redundant with OpenPLC Runtime's own built-in compiler?

Read `volt.diy`'s `strucpp-codegen` service source in full, plus any comments/commit messages explaining why it exists. Compare against what OpenPLC Runtime v4's own REST API does natively (its documented flow is: upload program → runtime monitors/handles compilation itself → execute). Determine and report:
- Does OpenPLC Runtime v4 already compile ST to a runnable form internally when you upload ST directly to it, with no separate codegen step needed?
- If yes: does STruC++ do anything OpenPLC Runtime's internal compile step doesn't (e.g., a specific C++ target, specific function block support, structured error output needed for the AI repair loop that OpenPLC's own compiler doesn't provide)?
- Report a clear recommendation: keep both, or eliminate STruC++ and upload ST directly to OpenPLC Runtime's own compile/upload endpoint.

**Do not proceed to Phase 2 (codegen wiring) until this is answered with evidence, not assumption.**

### 0.2 — Native (no-Docker) feasibility per platform

For each of macOS, Windows, and Linux (our actual dev/target platforms for this Electron app):
- Attempt to build/run OpenPLC Runtime v4's PLC Runtime Core natively (not via Docker) on this machine. Report exact errors if it fails.
- Attempt the same for MatIEC (`iec2c`) — this is a much smaller, more portable C++ codebase and likely straightforward to bundle natively on all platforms; confirm.
- Report per-platform: "native binary confirmed working" or "requires Docker/WSL/VM — here's why," with actual build logs, not guesses.

This determines the packaging strategy in Phase 3. Do not assume Docker-free is achievable on all platforms until you've actually tried building each component natively on this machine.

---

## Phase 1 — Target Architecture (pending Phase 0 results)

```
┌─────────────────────────────────────────────────────────────┐
│  Volt (Electron main process)                                │
│                                                                │
│  ┌──────────────┐   ┌──────────────────┐   ┌───────────────┐ │
│  │  CLM Graph   │──▶│  ST Codegen       │──▶│  MatIEC       │ │
│  │  (per POU)   │   │  (clmToST.ts)     │   │  (validation) │ │
│  └──────────────┘   └──────────────────┘   └───────┬───────┘ │
│                                                      │ pass    │
│                                                      ▼         │
│                                          ┌───────────────────┐│
│                                          │ [STruC++ OR       ││
│                                          │  OpenPLC Runtime's││
│                                          │  own compile step]││
│                                          │  — per Phase 0.1  ││
│                                          └─────────┬─────────┘│
│                                                      ▼         │
│                                          ┌───────────────────┐│
│                                          │ OpenPLC Runtime   ││
│                                          │ Core (native      ││
│                                          │ child process,    ││
│                                          │ not Docker —      ││
│                                          │ per Phase 0.2)     ││
│                                          └─────────┬─────────┘│
│                                                      ▼         │
│                                          ┌───────────────────┐│
│                                          │ WebSocket/Debug   ││
│                                          │ stream             ││
│                                          └─────────┬─────────┘│
└──────────────────────────────────────────────────┬─┼─────────┘
                                                     ▼ ▼
                                    ┌─────────────────────────────┐
                                    │  Tag Monitor Panel (React)   │
                                    │  — subscribes to live values │
                                    └─────────────────────────────┘
```

Key architectural decisions, explicit and non-negotiable per prior direction:
- **No hidden/background services the user can't see or control.** All processes (MatIEC, [STruC++ or not, per 0.1], OpenPLC Runtime Core) are spawned and managed as child processes of the Electron main process, visible in a "Runtime Status" panel (new, small — see Phase 4) showing each service's running/stopped state, not silently running in the background with no UI surface.
- **No Docker dependency if Phase 0.2 confirms native builds work.** If any component genuinely cannot run natively on a target platform, that must be surfaced to the user honestly (e.g., "Simulation requires [X] — install/enable [Y]") rather than silently degrded or hidden behind a Docker requirement the user didn't ask for.
- Ports/process management: use Electron's `child_process.spawn` with explicit lifecycle management (start on app launch or on first use — decide based on startup-time cost measured in Phase 0 — and clean shutdown on app quit, no orphaned processes).

---

## Phase 2 — Wiring Order

### 2.1 — Process manager (`runtimeProcessManager.ts`, new file)

A single module owning the lifecycle of every native backend process:
- `startMatIEC()`, `startOpenPLCRuntime()`, and conditionally `startStruCPP()` (per Phase 0.1 outcome).
- Each exposes `{status: 'stopped'|'starting'|'running'|'error', port, lastError}` via a small event emitter or store, consumed by the new Runtime Status panel (Phase 4).
- Handles port conflicts (check port free before bind, surface a clear error if not) and process crash recovery (auto-restart with backoff, capped retries, surfaced to the user if it gives up).

### 2.2 — Validation wiring (MatIEC)

Port `matiec-client.ts` concept from `volt.diy` almost directly — the actual HTTP/stdin-piping logic for calling `iec2c` doesn't need to change, only the transport (local child process + local port instead of a Docker container's exposed port). Wire this to fire on CLM→ST codegen output (from the CLM plan's Section 7.1), gating further steps on `valid: true`.

### 2.3 — Real codegen (STruC++ or OpenPLC's own path — per Phase 0.1 result)

If STruC++ stays: port its microservice logic to run as a native local process the same way as MatIEC.
If eliminated: wire ST directly to OpenPLC Runtime's own upload/compile REST endpoint instead, removing the intermediate step entirely.

### 2.4 — Execution (OpenPLC Runtime Core)

Port the `openplcClient.ts` pipeline concept (`login → codegen/upload → poll compile → start → debug stream`) with two changes:
- Point at a locally-spawned native process instead of a Docker container.
- Confirm the WebSocket debug interface (real-time variable inspection/forcing) connects correctly from Volt's Tag Monitor panel — this is the actual missing link you flagged (Tag Monitor built, but not wired to a real backend).

### 2.5 — Tag Monitor wiring (the actual immediate goal)

- Tag Monitor subscribes to the OpenPLC Runtime's WebSocket debug stream once a program is running.
- Each tag row (per the existing Tag Monitor UI: Expected vs Live) maps to a variable name in the running program; confirm the mapping between CLM `TAG` nodes (Section 2.1 of the CLM plan) and OpenPLC Runtime's variable-forcing/inspection identifiers is exact and bidirectional — this is the join point between the two systems and needs explicit testing, not assumption.
- Verify: force a value via Tag Monitor's UI (if that control exists) and confirm it round-trips through the WebSocket interface and actually changes runtime behavior — this is the definition of "genuinely wired up," not just "displays numbers."

---

## Phase 3 — Packaging (only after Phase 0.2 gives a real answer)

- If native builds work everywhere: bundle the compiled MatIEC/OpenPLC Runtime binaries as Electron `extraResources`, spawned by `runtimeProcessManager.ts` from the app's own resources directory — no separate install step for the end user, no Docker.
- If one platform genuinely requires a fallback: document exactly which platform and why in `CLM_ARCHITECTURE.md` (or a new `RUNTIME_ARCHITECTURE.md`), and design the fallback (WSL detection + guidance on Windows, for example) as an explicit, visible setup step — not a silent requirement discovered only when something fails.

---

## Phase 4 — Runtime Status Panel (new, small, but required)

A minimal panel (or an addition to an existing status bar item) showing:
- MatIEC: running/stopped, port
- [STruC++ or OpenPLC's internal compiler]: running/stopped
- OpenPLC Runtime Core: running/stopped, port, connected program name if any
- A manual "Restart backend services" action for recovery without restarting the whole app

This directly answers the "nothing should be hidden/dark" requirement — the user should always be able to see what's actually running.

---

## Definition of Done

- [ ] Phase 0.1 and 0.2 answered with real evidence (build logs, code reading), not assumptions — reported explicitly before Phase 2 work begins.
- [ ] All backend processes are visible and controllable via the Runtime Status panel — nothing runs invisibly.
- [ ] A CLM-authored program (any of the three existing test files, post-CLM-migration) can be: validated (MatIEC) → compiled → uploaded to OpenPLC Runtime → run → observed live in Tag Monitor, end to end, with a screen recording or step-by-step screenshot sequence as proof.
- [ ] Forcing a tag value from the UI (if implemented) changes real running behavior, confirmed by observing the corresponding rung/block/step react in the graphical editor.
- [ ] No component of this pipeline requires Docker unless Phase 0.2 proved it's genuinely unavoidable on a specific platform, and that exception is documented, not silent.
- [ ] Report progress against this checklist phase by phase — do not declare full completion until every box above is independently verified against the running app.
