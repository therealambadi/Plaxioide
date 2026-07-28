> **Platform renamed to Plaxio on 2026-07-14. All references to "Volt" and "Void" below refer to the same product now called Plaxio.**

I've gone through all three documents. Here's my understanding of what you're building:
volt.diy → Plaxio desktop IDE (formerly Void-based)
You started with volt.diy, a browser-based AI PLC IDE (Remix/React/Vite/Cloudflare Workers, forked from bolt.diy). You've since pivoted to a desktop application called **Plaxio**, built by forking Void (the open-source VS Code fork with a built-in AI agent layer), because your actual users — PLC/automation engineers — work in air-gapped or cloud-restricted factory environments where a browser-only tool doesn't fit. This mirrors Cursor's model: local-first shell, optional cloud AI.
Architecture (3 layers stacked)

VS Code OSS — editor shell, terminal, extensions, source control
Void — AI chat, quick-edit, autocomplete, Apply (fast/slow), all living in one isolated folder (src/vs/workbench/contrib/void)
PLC Logic Editor — your layer on top: Ladder/FBD/SFC graphical editors, backed by a central logicStore.ts (immer-based), with @xyflow/react for the FBD/SFC canvas

You don't copy Void's code directly — you study its patterns (tool taxonomy, checkpoint/diff data model, agent loop stages: Gather → Agent → Fast Apply) and rewire the data layer to your own stores, since Void's components are wired to VS Code/extension APIs.
Where things stand / recent threads in these docs:

UI decisions: hiding Explorer's default Outline/Timeline views to keep the sidebar PLC-focused, keeping your custom Library panel (Programs/Elements/Tag Database/Components)
A big exploration thread on hardware connectivity as a strategic wedge — Modbus TCP/OPC UA live connections aren't just for monitoring; you were working through what this "opens the door" to (pulling live data for simulation, potential code-reading limitations since PLCs are vendor-locked for code retrieval even though live tag data is open)
Concrete build-out already done: hardware-connector microservice, Tag Monitor panel (shared between Preview/Simulation tabs, showing Expected vs Live), ConnectHardwareModal, a "Connections" workbench tab
Known gaps at time of writing: Modbus RTU serial not built, Oscilloscope/trend view not built, Live Debug UI existed but needed write-endpoint wiring
A parallel research thread on virtual PLCs via OpenPLC Runtime in Docker + matiec compiler, positioning your platform as the IT/OT bridge (OT engineers see ladder logic, IT engineers see scan-cycle/watchdog health metrics as deployment guardrails)

This lines up with what I already had context on — the System 1/System 2 verification architecture issue (real MatIEC/ESBMC validation stuck in an unreachable legacy orchestrator) and the LEC-based cross-vendor moat work you've been doing more recently sit on top of this same foundation.
What do you want to do with this next — pick up one of these threads (hardware connectivity build-out, the Explorer UI cleanup, the virtual-PLC/IT-OT bridge), or something else entirely?README.mdmdActually, I think we removed iron plc completely because you don't need that something like that. We removed it completely and like I said we had two compiler that is. matiec and struc++ both are used because we need both to converting different things and for you. I think that is what I think we did. I think this set up this two compiler I think set up is used to for the verification. Also that is OK that we will be doing later but for our graphical editor or the simulator things like that, what should be our compiler and the runtime?Reconciled existing compiler pipeline for graphical editor integrationReconciled existing compiler pipeline for graphical editor integrationThat grounds it exactly — and clears up the confusion. Looking at what volt.diy actually shipped, the "two compilers" aren't MatIEC + IronPLC (my earlier IronPLC suggestion doesn't map onto anything you built) — it's MatIEC + STruC++, and they serve two genuinely different jobs, not two competing choices:

MatIEC (iec2c) — validation only. Fast syntax/semantic check, "does this ST compile cleanly," feeding the "Fix with AI" error-repair loop. It does not feed the runtime.
STruC++ — the actual codegen path: ST → C++ → compiled into something OpenPLC Runtime v4 can execute. This is what makes the simulator/graphical editor actually run.
ESBMC — separate again, and explicitly bypasses MatIEC entirely, doing direct ST→C model translation for formal k-induction verification. This is your later-phase verification work, not relevant to today's question.

So to directly answer what you're asking: for the graphical editor + simulator, right now, the answer is STruC++ → OpenPLC Runtime v4 — the same pairing volt.diy already built, proved, and documented end-to-end (login → STruC++ codegen → upload ZIP → poll compile → start → Socket.IO live debug stream). MatIEC stays in the picture too, but only as the pre-flight validation gate before you bother sending code to STruC++ — exactly the two-tier pattern already proven (Browser-native ST validator → MatIEC).
Why this is the right call for Volt, not just "copy what volt.diy did"

It's already a working, tested pipeline — this isn't a hypothetical architecture choice, it's documented as fully verified live: user message → LLM → tool calls → MatIEC/ESBMC → workbench writes. Porting a proven pipeline is much lower-risk than picking a new one for the exact same job.
STruC++ → OpenPLC Runtime is the actual execution substrate for your Tag Monitor gap. You said Tag Monitor "isn't wired up" because you're missing the compiler/backend behind it — this is precisely that missing piece. OpenPLC Runtime v4 is what would give Tag Monitor real live values to display, the same way volt.diy's OpenPLCRuntimePanel got its Socket.IO debug stream.
It maps cleanly onto CLM. CLM emits ST (per the implementation plan) → that ST goes through MatIEC for fast validation, then STruC++ for real codegen if valid → OpenPLC Runtime executes it → Tag Monitor subscribes to its live debug stream. Nothing about the CLM plan changes; this just fills in what CLM's ST output actually feeds into.

What's different for Volt vs. volt.diy structurally
The one real change: volt.diy ran these as Docker sidecar microservices reachable over HTTP from a browser tab (VITE_MATIEC_URL, VITE_STRUCPP_BASE_URL, VITE_OPENPLC_BASE_URL). In Electron, you have a choice:

Keep them as Docker sidecars (same architecture, just orchestrated by Electron's main process instead of a browser origin) — lowest-risk, fastest to port, since the actual service code is already written and proven.
Or bundle them as local child processes managed directly by Electron (no Docker dependency for the end user) — better for a shipped desktop product where you don't want to require the user to have Docker installed, but more packaging work now.

Given where you are (getting the pipeline wired up at all is the immediate blocker), start with Docker sidecars, ported as-is — same containers, same ports, same client code (matiec-client.ts, openplcClient.ts concepts) — and treat "remove the Docker dependency for end users" as a later packaging-phase concern, not something to solve simultaneously with getting Tag Monitor working.
Concrete next step
Port these three services and their client wiring largely as-is from volt.diy into Volt's Electron main process / backend layer:

matiec-validator (Docker, port 4001) — validation gate
strucpp-codegen (Docker, port 4006) — real codegen
openplc-runtime (Docker, port 8443) — execution + Socket.IO debug stream, which Tag Monitor subscribes to

Want me to write this up as a follow-on implementation-plan .md for Claude Code, in the same style as the CLM one — covering exact service wiring, how CLM's ST output feeds MatIEC→STruC++, and how Tag Monitor subscribes to the OpenPLC Runtime debug stream?OK from what you said I have some doubt so I don't want to be keeping anything as dark. It should be a proper desktop app note or anything what about the thing it should be running the app itself so that is one thing important from moving from now, onwards then then the next step if my doubt is if we have too many things also that is not a good thing and we can't replace some if that is needed so that is always important so what I'm asking is if something is better than something then why we why not we remove the smallest thing or the least important thing becaus the bigger thing will do both all these things or is it better or have all these so that is also we need to look into check and then tell me all that thing and give a detailed plan for plot God to implement this and already volt.diy is placed in the route folder so if you need to copy from that that we can do because that is our platform license or if he want to check the reference or anything we can do that and if we need to improve that or we can do that also and also he need to properly wire up everything that is a thing he need to implement and fully all these things whatever we implemented he needs to connect to that all because we didn't implement many things many tabs or many other sections so but whatever we implemented, we need to make sure that all these things are wired up and connected and workingShow moreEvaluated service consolidation strategy and cross-platform deployment feasibility concernsEvaluated service consolidation strategy and cross-platform deployment feasibility concernsGood questions to push on — and the research actually answers both cleanly.
1. "No Docker, must be a real desktop app" — this is the right call, and here's the actual constraint
OpenPLC Runtime v4 ships prebuilt native binaries for x86_64, ARM64, and ARM32, described as able to run on virtually anything that can run Linux — but that's the key qualifier: the native binary path is Linux-specific (Ubuntu, Debian, Fedora, CentOS, RHEL are the listed supported distributions). Docker is how volt.diy got Windows/macOS support for free, since Docker Desktop abstracts the OS away. For your Electron desktop app, this means:

If you want zero Docker dependency, you need to confirm whether OpenPLC Runtime v4 actually compiles cleanly as a native binary on macOS and Windows, or whether it's Linux-only in practice with Docker as the only cross-platform path today.
This is genuinely uncertain from what I've found — worth having Claude Code verify directly (attempt a native build on your actual dev machine) before committing to "bundle it as a child process," since if it turns out to be Linux-only, you may need to compile your own Windows/macOS-native build of the runtime core, which is a real chunk of extra work, not a packaging afterthought.

2. Your consolidation question — and this is the more interesting finding
You're right to push on this, and the research suggests you may genuinely be running one redundant piece. Look at what OpenPLC Runtime v4's own REST API already does: its documented flow is upload programs, monitor compilation, and control execution — meaning the Runtime itself already has a built-in compile step, historically via MatIEC's iec2c bundled inside the OpenPLC stack (confirmed separately: the MatIEC compiler, included with OpenPLC, converts ST programs into C code for execution on the platform, as part of its own multi-stage compile pipeline).
That raises the real question: what does STruC++ (volt.diy's own bespoke ST→C++ microservice) do that OpenPLC Runtime's own internal compile step doesn't? Two possibilities, and you need to know which before deciding:

(a) STruC++ is genuinely redundant — volt.diy built it themselves rather than just uploading ST directly to OpenPLC Runtime and letting its own internal compiler handle it, possibly just for more visibility/control over the codegen step for the AI's structured-error-repair loop. If so, you could eliminate it and upload ST straight to OpenPLC Runtime's own compile endpoint — one fewer service, and OpenPLC Runtime's built-in compiler becomes your single codegen path.
(b) STruC++ exists because OpenPLC Runtime v4 needs C++ specifically for something its own default C-based iec2c path doesn't support (e.g. certain function block types, or a build target requirement) — in which case it's not redundant, it's a real dependency.

This is exactly the kind of thing Claude Code should investigate by reading volt.diy's actual strucpp-codegen service code (in your root folder) and its own commit history/comments for why it was built, rather than guessing — the answer is sitting right there in code you already have license to read.
Recommendation

MatIEC stays — fast validation gate, clearly a distinct job (checking, not executing).
STruC++ vs. OpenPLC Runtime's built-in compiler — investigate before deciding; don't keep both by default just because volt.diy had both.
ESBMC stays separate — formal verification is a genuinely distinct concern from execution, confirmed by it explicitly bypassing MatIEC entirely for direct ST→C model translation.

Here's the implementation plan doc, including this investigation as an explicit first step Claude Code must resolve before wiring anything permanently.Created a file, read a fileCreated a file, read a fileThis plan makes Phase 0 (the redundancy question and the no-Docker feasibility question) mandatory and blocking — Claude Code has to come back with real evidence from reading volt.diy's actual code and attempting native builds on your machine before it's allowed to wire anything permanently. That directly addresses both your concerns: don't keep a service just because volt.diy had it if something bigger already does the job, and don't let anything run invisibly in the background without you being able to see and control it.
One thing worth flagging honestly: I don't know for certain whether STruC++ is actually redundant — that's exactly why Phase 0.1 exists as a required investigation step rather than something I decided for you. Similarly, whether OpenPLC Runtime v4 truly builds natively on macOS/Windows without Docker is a real open question, not something I could verify from search alone.Runtime integration planDocument · MD volt.diy — Full Investigation Report
Task 1: STruC++ Codegen Service
What it is and what it does
STruC++ is an IEC 61131-3 Structured Text → C++ compiler implemented as an npm package (strucpp), sourced from https://github.com/Autonomy-Logic/STruCpp. The strucpp-codegen microservice wraps it in a tipastedthis is what he gave # Runtime & Compiler Integration — Architecture Document**Scope:** Volt (plc-main), Electron desktop app.
**Status:** Phase 0 complete (investigation with real build evidence). Phases 1–4 pending.---## Phase 0 Findings — Mandatory Investigation### 0.1 — Is STruC++ Redundant With OpenPLC Runtime's Own Compiler?**Verdict: STruC++ is NOT redundant. Keep both. Here is why:**OpenPLC Runtime v4 accepts **only a ZIP of pre-generated C++ source files** at POST /api/upload-file. It does **not** accept raw ST code. Its internal compilation step is g++ compiling the already-generated C++ — not an ST compiler. The pipeline is:ST code → STruC++ (JS) → C++ files + debug table → program.zip → OpenPLC Runtime v4 (g++) → libplc.so**What STruC++ does that OpenPLC's g++ cannot:****ST → C++ compilation.** This is its core job. OpenPLC Runtime v4 has no ST parser — it only accepts C++ source. STruC++ IS the ST compiler in this stack.**Structured parse errors with original ST line/column.** POST /validate returns {line, column, severity, message} keyed to the original ST source. OpenPLC's internal g++ errors reference generated C++ line numbers, not ST. This is the only path for Monaco editor squiggly-line diagnostics.**Debug table generation.** generateDebugTable(ast, projectModel, symbolTables) produces generated_debug.cpp (runtime variable table) and debug-map.json (editor-side index→name lookup). Without this, the Socket.IO debug stream cannot map numeric wire indexes to tag names — the Tag Monitor would receive raw bytes with no way to identify which variable is which.**Pure JavaScript — no native binary required.** The strucpp npm package is 100% JS (confirmed: dist/index.js is a JS bundle). It runs identically on macOS arm64, x86_64, Linux, and Windows — no platform-specific build step. Confirmed working on this machine:$ node -e "const {compile}=require('strucpp'); const r=compile(st,{debug:true}); console.log(r.success, r.cppFiles.map(f=>f.name))"
true [ 'configuration.cpp', 'pou_PROG0.cpp' ]**Recommendation:** Keep STruC++ exactly as-is. In the Electron app, run it as an in-process Node.js module (no HTTP server needed — call compile() directly from the main process), rather than as a separate microservice on port 4006. This eliminates the network round-trip and port management for a pure-JS library that can be require()'d directly.---### 0.2 — Native Build Feasibility Per Platform#### MatIEC (iec2c) — IEC 61131-3 ST validator**macOS arm64: NATIVE BUILD CONFIRMED WORKING**Build steps and result:
bash
git clone --depth 1 https://github.com/thiagoralves/OpenPLC_v3.git
cd OpenPLC_v3/utils/matiec_src
PATH="/opt/homebrew/opt/bison/bin:$PATH" autoreconf -i
PATH="/opt/homebrew/opt/bison/bin:$PATH" ./configure
PATH="/opt/homebrew/opt/bison/bin:$PATH" make -j4
# → produces: iec2c binary (arm64 native)
Confirmed working:
bash
$ iec2c -I ./lib -T /tmp/out /tmp/test.st
# → POUS.c, POUS.h, LOCATED_VARIABLES.h, VARIABLES.csv, Config0.c, Config0.h, Res0.c
# Exit: 0
**Prerequisites on macOS:** bison ≥ 2.4 (system bison is 2.3 — must use brew install bison; autoconf, automake, flex are already present via Homebrew/CLT). Build time: ~15 seconds.**Linux (x86_64 / arm64):** Build is identical, same Dockerfile-proven flow. apt-get install build-essential autoconf automake bison flex — all standard. Docker Dockerfile confirms this works.**Windows:** MatIEC does not build natively on Windows (autoconf/bison toolchain is not available without MSYS2/WSL). **Mitigation:** Bundle a pre-compiled iec2c.exe cross-compiled via MinGW, or use WSL1/WSL2 on Windows. The volt.diy repo already has bin_win32/ in the matiec source tree suggesting this has been done before.#### OpenPLC Runtime v4 — PLC execution engine**macOS: NATIVE BUILD NOT AVAILABLE**Evidence:
- GitHub releases: only OpenPLC_Runtime_4.1.8_Setup.exe (Windows installer) — no macOS binary
- README explicitly states: "Docker (Recommended)" and "Linux Installation (native)" — macOS not mentioned
- The runtime requires SCHED_FIFO real-time scheduling and dlopen() of compiled .so files — these are Linux-specific. The macOS kernel does not support SCHED_FIFO for user processes the same way.
- Docker Desktop IS installed and running on this machine (Docker 29.5.3)**Linux (x86_64):** Native build works per Docker build evidence and README.
**Linux (arm64):** Not explicitly tested in OpenPLC v4, likely works with compilation.
**Windows:** Native installer available (Setup.exe).
**macOS:** Requires Docker (Linux container). This is a hard constraint, not a workaround.#### STruC++ — ST → C++ compiler**All platforms: WORKS NATIVELY (pure JavaScript)**No binary to build. npm install of the strucpp tarball gives you a pure-JS module. Confirmed working on macOS arm64 above. Works identically on all Node.js platforms.---## Platform Support Matrix| Component | macOS arm64 | macOS x86_64 | Linux x86_64 | Linux arm64 | Windows |
|---|---|---|---|---|---|
| STruC++ codegen | ✅ native (JS) | ✅ native (JS) | ✅ native (JS) | ✅ native (JS) | ✅ native (JS) |
| MatIEC (iec2c) | ✅ native binary | ✅ native binary | ✅ native binary | ✅ native binary | ⚠️ bundled exe only |
| OpenPLC Runtime v4 | ⚠️ Docker required | ⚠️ Docker required | ✅ native process | ✅ native process | ✅ native installer |**macOS strategy:** MatIEC runs as a native child process. OpenPLC Runtime runs in a Docker container managed by the Electron main process. Docker Desktop must be installed (it is the standard dev environment on macOS). If Docker is absent, the app surfaces a clear setup step — not a silent failure.---## Phase 1 — Target ArchitectureElectron Main Process
│
├── runtimeProcessManager.ts
│    ├── MatIEC child process  (native arm64 binary, spawned on demand)
│    │    └── stdin/stdout pipe: ST → C files + LOCATED_VARIABLES.h
│    │
│    ├── STruC++ in-process    (require('strucpp') — no child process)
│    │    └── compile(st) → { cppFiles, headerCode, debugMap }
│    │
│    └── OpenPLC Runtime v4
│         ├── macOS/Windows dev: docker start openplc-runtime container
│         └── Linux production: child_process.spawn('./openplc-runtime')
│
└── RuntimeIPC bridge (contextBridge)
     └── exposes to renderer: { validate, compile, run, stop, force, getStatus }

Renderer (React)
│
├── CLM graph → clmToST() → ST code
│
├── runtimeStore.ts  ← process statuses, compilation log, error list
│
└── TagMonitorPanel  ← subscribes to OpenPLC Socket.IO debug stream
     └── live tag values via debug:frame events every 500ms### Key architectural decisions**STruC++ is in-process, not a microservice.** It's pure JS — require('strucpp') in the main process. No port 4006, no HTTP, no child process. Just a function call.**MatIEC is a native child process.** Spawned on demand (not at startup — it's fast enough). Binary bundled as Electron extraResource. Output is parsed for structured errors.**OpenPLC Runtime is Docker-managed on macOS.** runtimeProcessManager calls docker start openplc-runtime and monitors docker logs -f. On Linux it spawns the native binary directly.**All three processes are visible in the Runtime Status panel** (Phase 4). Nothing runs invisibly.**Tag name → debug index mapping** comes from debug-map.json produced by STruC++ generateDebugTable(). This is the join point between CLM tag names and OpenPLC Runtime's wire protocol.---## Phase 2 — Wiring Order### 2.1 — runtimeProcessManager.ts (new file, Electron main process)Owns lifecycle of all backend processes:interface ProcessStatus {
  status: 'stopped' | 'starting' | 'running' | 'error';
  pid?: number;
  port?: number;
  lastError?: string;
  startedAt?: number;
}

interface RuntimeManager {
  // MatIEC
  validateST(stCode: string, tags?: TagEntry[]): Promise<MatIECResult>;

  // STruC++ (in-process)
  compileST(stCode: string, programName: string): Promise<{ zipBuffer: Buffer; debugMap: DebugMap }>;

  // OpenPLC Runtime
  startRuntime(): Promise<void>;
  stopRuntime(): Promise<void>;
  uploadAndRun(zipBuffer: Buffer, debugMap: DebugMap): Promise<void>;
  stopPLC(): Promise<void>;
  forceTag(tagName: string, value: TagValue): void;
  releaseTag(tagName: string): void;

  // Status (consumed by Runtime Status panel)
  onStatusChange(listener: (statuses: ProcessStatuses) => void): () => void;
  getStatuses(): ProcessStatuses;
}**Error recovery:** Auto-restart with exponential backoff (1s, 2s, 4s, max 30s), max 5 retries. After giving up, sets status to 'error' with lastError message shown in Runtime Status panel.**Port conflict detection:** Before starting OpenPLC Runtime, check port 8443 is free. If occupied, surface clear error: "Port 8443 is already in use. Stop any existing OpenPLC Runtime instance and try again."### 2.2 — MatIEC validation wiring**Adapted from volt.diy's matiec-validator/server.js logic, run as native child process (not HTTP):**async function validateWithMatIEC(stCode: string, tags: TagEntry[]): Promise<MatIECResult> {
  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'matiec-'));
  const stFile = path.join(tmpDir, 'program.st');
  await fs.writeFile(stFile, stCode);

  return new Promise((resolve) => {
    const proc = spawn(MATIEC_BINARY, ['-I', MATIEC_LIB, '-T', tmpDir, stFile]);
    let output = '';
    proc.stdout.on('data', d => output += d);
    proc.stderr.on('data', d => output += d);
    proc.on('close', async (code) => {
      const errors = parseMatiecErrors(output);
      const glue = await performGlueCheck(tmpDir, tags);
      await fs.rm(tmpDir, { recursive: true });
      resolve({ success: code === 0 && errors.length === 0, errors, glue });
    });
  });
}The parseMatiecErrors() and performGlueCheck() functions are ported directly from volt.diy/docker/matiec-validator/server.js (same codebase, same license — free to copy).**Wiring trigger:** Fires automatically when the user clicks Run in the toolbar. Gates the STruC++ step — if MatIEC returns errors, the compiler step is skipped and errors are shown in the Runtime Status panel.### 2.3 — STruC++ codegen wiring**In-process call, not a microservice:**import { compile as strucppCompile } from 'strucpp';
import { generateDebugTable } from 'strucpp/dist/backend/debug-table-gen.js';

async function compileToZip(stCode: string, programName: string, cycleMs = 50): Promise<{
  zipBuffer: Buffer;
  debugMap: DebugMap;
  errors: CompileError[];
}> {
  const fullCode = ensureConfiguration(stCode, cycleMs);
  const md5 = crypto.createHash('md5').update(fullCode).digest('hex');

  const result = strucppCompile(fullCode, { debug: true, lineMapping: true, md5, fileName: `${programName}.st` });
  if (!result.success) return { zipBuffer: null, debugMap: null, errors: result.errors };

  const { debugTableCpp, debugMap } = generateDebugTable(result.ast, result.projectModel, result.symbolTables, { md5 });

  const zip = new JSZip();
  zip.file('generated.hpp', result.headerCode);
  for (const f of result.cppFiles) zip.file(f.name, f.content);
  zip.file('generated_debug.cpp', debugTableCpp);
  zip.file('debug-map.json', JSON.stringify(debugMap, null, 2));
  zip.file('program.st', fullCode);
  // strucpp runtime headers...
  zip.file('defines.h', `#pragma once\n#define PROGRAM_MD5 "${md5}"\n`);
  zip.file('c_blocks.h', '// Empty\n');

  const zipBuffer = await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' });
  return { zipBuffer, debugMap, errors: [] };
}ensureConfiguration() is ported directly from volt.diy/docker/strucpp-codegen/server.js.### 2.4 — OpenPLC Runtime integration**Adapted from volt.diy/app/lib/plc/openplcClient.ts:**The full REST + Socket.IO protocol is already reverse-engineered and working in volt.diy. Port it directly into an Electron IPC handler:Main process: OpenPLCRuntimeClient class (adapted from openplcClient.ts)
  - Points at localhost:8443 (Docker container or native process)
  - Handles login → upload → compile poll → start → Socket.IO debug
  - Emits events: auth:success, upload:success, compilation:progress/success/error, plc:started, debug:frame

IPC bridge (contextBridge):
  - ipcMain.handle('runtime:run', ...) → calls client.runProgram()
  - ipcMain.handle('runtime:stop', ...) → calls client.stopPLC()
  - ipcMain.handle('runtime:force', ...) → calls client.forceTag()
  - ipcMain.on('runtime:status', ...) → streams status events to renderer**Binary debug protocol** (from openplcClient.ts):
- GET_LIST (0x44): [0x44, count_lo, count_hi, idx0_lo, idx0_hi, ...] — request values by index
- Response starts with 0x7E (STATUS_OK), then per-variable: [idx_lo, idx_hi, type_tag, value_bytes]
- DEBUG_SET (0x42): [0x42, idx_lo, idx_hi, type_byte, value_bytes] — force a value
- Type bytes: 0x00=BOOL(1B), 0x01=INT(2B), 0x02=DINT(4B), 0x03=REAL(4B float), 0x04=WORD(2B)**Tag name → index mapping** (the critical join point):
- debug-map.json produced by STruC++ generateDebugTable() has the schema: { variables: { "PROG0.MOTOR_RUN": 0, "PROG0.PB_START": 1, ... } }
- Our TagEntry.name values (e.g., "MOTOR_RUN") must match the short-names in this map
- **The CLM TAG node stores name without POU prefix.** The debug map uses "prog0.MOTOR_RUN" format. The mapping is: debugMap.variables["prog0." + tag.name.toLowerCase()] → index
- This mapping must be verified against a real running program (not assumed)### 2.5 — Tag Monitor real wiringReplace the current simulation loop in TagMonitorPanel.tsx with a subscription to the OpenPLC debug stream:// In TagMonitorPanel.tsx — replace setInterval simulation with:
useEffect(() => {
  if (monitorMode !== 'running') return;

  // Subscribe to debug frames from main process via IPC
  const unlisten = window.__voltRuntime?.onDebugFrame((frame: DebugFrame) => {
    Object.entries(frame.tags).forEach(([tagName, value]) => {
      logicStore.updateTagLiveValue(tagName, String(value));
    });
  });

  return () => unlisten?.();
}, [monitorMode]);

// Force via IPC
const forceViaRuntime = (tagName: string, value: string) => {
  window.__voltRuntime?.forceTag(tagName, parseTagValue(tagName, value));
  logicStore.forceTag(tagName, value); // optimistic UI update
};The simulation loop stays as a fallback when monitorMode === 'running' but no runtime is connected (offline/dev mode).---## Phase 3 — Packaging### Bundled resources (Electron extraResources)| Resource | macOS | Linux | Windows |
|---|---|---|---|
| iec2c binary | resources/matiec/darwin-arm64/iec2c + darwin-x64/iec2c | resources/matiec/linux-x64/iec2c | resources/matiec/win32-x64/iec2c.exe |
| MatIEC stdlib | resources/matiec/lib/ | same | same |
| STruC++ npm pkg | bundled in Electron ASAR (Node.js module, no binary) | same | same |
| strucpp-runtime-headers | resources/strucpp-runtime-headers/ | same | same |
| OpenPLC Runtime | N/A — use Docker | resources/openplc-runtime binary | resources/openplc-runtime.exe |
| JSZip | bundled in Electron ASAR (npm module) | same | same |### macOS OpenPLC Runtime pathOn macOS, runtimeProcessManager checks for Docker before attempting to start the runtime:async function startOpenPLCRuntime(): Promise<void> {
  const dockerAvailable = await checkDockerAvailable();
  if (!dockerAvailable) {
    throw new RuntimeError(
      'OpenPLC Runtime requires Docker Desktop on macOS.\n' +
      'Download it at https://docker.com/products/docker-desktop\n' +
      'Then restart Volt.'
    );
  }
  // docker start openplc-runtime, or docker run if not yet created
}This is surfaced in the Runtime Status panel, not silently logged.---## Phase 4 — Runtime Status PanelA new tab in the bottom panel (alongside Console, Tag Monitor, Runtime).The existing **Runtime tab** (currently showing "Runtime status: Stopped.") becomes this panel.### Layout┌──────────────────────────────────────────────────────────────────┐
│  Runtime                                                          │
├──────────────────────────────────────────────────────────────────┤
│  ● MatIEC (iec2c)        [running]  Validated 3 programs today   │
│  ● STruC++ codegen       [in-process]  v0.5.10                   │
│  ● OpenPLC Runtime v4    [running]  Port 8443  prog0.zip (v4.1.8)│
│                                                                    │
│  [▶ Start Backend]  [⏹ Stop Backend]  [↺ Restart Services]       │
│                                                                    │
│  ── Compilation Log ──────────────────────────────────────────   │
│  [12:26:04] MatIEC: PASS (0 errors, 0 warnings)                  │
│  [12:26:04] STruC++: compiled to 2 C++ files, 6 variables        │
│  [12:26:05] Uploading program.zip (14.2 KB)...                   │
│  [12:26:06] Compiling... (g++)                                    │
│  [12:26:08] SUCCESS — PLC running at 50ms cycle                  │
│  [12:26:08] Debug stream connected — monitoring 6 variables      │
└──────────────────────────────────────────────────────────────────┘### ImplementationImplemented as RuntimeStatusPanel.tsx (parallel to TagMonitorPanel.tsx), mounted into the Runtime tab host div in the same IIFE, using the same direct ReactDOM.createRoot pattern (no ServicesAccessor).State consumed from a new runtimeStore.ts (singleton, like logicStore) that receives IPC events from runtimeProcessManager.---## Definition of Done Checklist[ ] **Phase 0.1** — STruC++ redundancy question answered with evidence ✅ (above)[ ] **Phase 0.2** — Native build feasibility answered with evidence ✅ (above)[ ] runtimeProcessManager.ts implemented, all three components managed[ ] Runtime Status panel shows real process states — nothing invisible[ ] MatIEC validation wired: Run button triggers validation, errors appear in Runtime tab[ ] STruC++ in-process compilation produces correct ZIP (not microservice)[ ] OpenPLC Runtime starts, receives the ZIP, compiles it successfully[ ] Tag Monitor receives live values from OpenPLC Socket.IO debug stream[ ] Force tag from Tag Monitor UI changes actual runtime behavior (confirmed by observing rung reaction)[ ] CLM tag names correctly map to OpenPLC debug indexes via debug-map.json (explicitly tested)[ ] No Docker dependency on Linux (confirmed native binary)[ ] macOS Docker requirement surfaced clearly if Docker absent (not silently degraded)[ ] End-to-end: CLM program → validate → compile → upload → run → observe in Tag Monitor ✅ verified---## Open Questions (to resolve in implementation)**Tag name prefix in debug-map.json** — STruC++ generates debug map keys as "prog0.MOTOR_RUN" (POU-qualified). Our logicStore.tagDatabase names are bare ("MOTOR_RUN"). Need to confirm exact format by inspecting a real debug-map.json output and verify the mapping logic works bidirectionally.**CLM → ST codegen** — The clmToST.ts module (Section 15.9 item 5 in volt platform.md) is not yet implemented. This is the upstream dependency for Phase 2.2. ST codegen must be written before MatIEC validation can fire on real CLM data.**Socket.IO dependency** — openplcClient.ts uses socket.io-client. This must be added as a dependency to the Electron main process (currently it's only in volt.diy). The OpenPLC Runtime also exposes a plain WebSocket path (ws://localhost:8443/api/debug) that accepts JSON {command: 'start_watch'} — this may be simpler to use from Electron and avoids the Socket.IO dependency.**OpenPLC Runtime v4 Docker image on arm64** — The Docker image at ghcr.io/autonomy-logic/openplc-runtime:latest is built for linux/amd64. On Apple Silicon, Docker runs it under Rosetta emulation. Need to confirm this works in practice (typically it does but with ~20% CPU overhead).Show moreValidated architecture, flagged critical dependencies, deferred implementation testingValidated architecture, flagged critical dependencies, deferred implementation testingThis is excellent — genuinely evidence-based, not theorized. A few real findings worth calling out, then a clear go/no-go on each phase.
What's good and can be trusted

STruC++ redundancy question: correctly resolved with actual reasoning, not assumption — OpenPLC Runtime literally has no ST parser, so STruC++ isn't optional plumbing, it's the only thing translating ST into anything OpenPLC can compile. Good catch also that it's pure JS, meaning it can become an in-process require() call instead of a microservice — that's a real simplification win from your original "too many things" concern, and a legitimate one (not cutting something needed).
MatIEC native build: actually built and ran iec2c on the real machine with a real exit code and real output files — this is exactly the standard of evidence I asked for, not "should work."
OpenPLC Runtime macOS gap: this is a genuinely important finding, and it's honestly reported rather than glossed over — SCHED_FIFO and dlopen() of a .so really are Linux-specific, so "Docker required on macOS" is a real constraint, not laziness. Good instinct to surface it as an explicit setup step rather than hide it.

Three things to resolve before trusting this as final, not just cosmetic
1. The tag-name mapping (Open Question 1) is the single highest-risk item in the whole plan — resolve it before building anything else on top.
This is precisely the mechanism that was supposed to make Tag Monitor "actually wired up," and it's currently unverified — debugMap.variables["prog0." + tag.name.toLowerCase()] is a guess at the key format, not confirmed against a real generated debug-map.json. Given this was the exact gap you flagged as broken before ("Tag Monitor isn't wired up to the graphical editor"), this needs to be the very first thing tested — generate a real debug-map.json from a real ST program via the in-process STruC++ call, print its actual keys, and confirm the exact format (case, prefix, separator) before writing the mapping function. Guessing this wrong silently breaks the entire monitor with no error, since it'll just show nothing or wrong values — the worst kind of bug to discover later.
2. clmToST.ts doesn't exist yet — this blocks Phase 2.2 entirely.
The report is honest about this (Open Question 2), but it means this whole pipeline currently has no real input at the top. Sequence matters: clmToST.ts must be written and validated against the three existing test files (post-CLM-migration) before MatIEC/STruC++ wiring can be tested with real data — otherwise you're testing the pipeline with hand-written ST strings that don't reflect what your graphical editors actually produce, which risks the same "looks done, isn't actually wired to the real thing" trap you've hit before.
3. Socket.IO vs. plain WebSocket — pick the simpler one, don't carry both by default.
The report correctly notices OpenPLC Runtime exposes both a Socket.IO path and a plain WebSocket path for the same debug stream. Given you're trying to reduce moving pieces, not add them: use the plain WebSocket path (ws://localhost:8443/api/debug, JSON {variables:[{name,value}]}) as primary, skip the socket.io-client dependency and the binary hex-frame protocol entirely, unless there's a concrete reason the Socket.IO path is more reliable (reconnection handling, etc.) — confirm that before deciding, don't default to the more complex one just because volt.diy's "production path" used it.
Recommended next step
Send this back to Claude Code:
Approved: STruC++ in-process, MatIEC native, OpenPLC Docker-on-macOS/native-on-Linux/installer-on-Windows.

Before any Phase 2 wiring code:
1. Write clmToST.ts and validate it against the three existing test files
   (post-CLM-migration) — confirm it produces valid ST that MatIEC accepts.
2. Generate a real debug-map.json from that real ST (via in-process STruC++
   compile) and paste the ACTUAL output here — resolve the tag-name mapping
   format with real evidence, not the guessed "prog0." + lowercase format
   in the current doc. Fix the mapping function to match reality.
3. Confirm whether the plain WebSocket debug path or Socket.IO path should be
   primary — pick whichever is simpler unless you find a concrete reliability
   reason otherwise, and justify the choice in one sentence.

Only after those three are resolved with real output pasted back, proceed to
runtimeProcessManager.ts and the rest of Phase 2.
This keeps you from building the Runtime Status panel and IPC bridge on top of an unverified tag-mapping guess — the part most likely to silently fail exactly the way Tag Monitor already has.# Runtime & Compiler Integration — Architecture Document

**Scope:** Volt (plc-main), Electron desktop app.
**Status:** Phase 0 complete (investigation with real build evidence). Phases 1–4 pending.

---

## Phase 0 Findings — Mandatory Investigation

### 0.1 — Is STruC++ Redundant With OpenPLC RupastedAll three pre-conditions are now met with real evidence. Here is the full report:
Pre-conditions resolved — ready for Phase 2
1. clmToST.ts — written and validated
Both compilers accept it:MatIEC exit 0 — produces POUS.c, POUS.h, LOCATED_VARIABLES.h, Config0.c, Res0.cSTruC++ compile: true — 13 tags in debug-map
Key discovery: two ST variants must be maintained:stCode → MatIEC (no stubs; MatIEC resolves TON/TOF/CTU etc. from its -I lib)stCodeForStrucpp → STruC++ (IEC stdlib stubs prepended — STruC++ is pure JS with no filesystem)Real debug-map.json output pasted above — architecture doc corrected
The guessed "prog0.MOTOR_RUN" format was wrong. Actual format:"INST0.PB_START"   elemIdx=0  BOOL
"INST0.MOTOR_RUN"  elemIdx=3  BOOL
"INST0.RUN_TMR.Q"  elemIdx=6  BOOL   ← FB sub-fields also appearPath = "INST0." + tagName.toUpperCase(). Mapping logic implemented in clmToST.ts::resolveTagDebugLeaf() and buildTagIndexMap().
3. WebSocket vs Socket.IO — Socket.IO
Volt.diy already has a validated Socket.IO client handling auth + reconnect + binary frame parsing. The plain ws:// path requires custom binary protocol parsing we'd have to re-write. Socket.IO with transports: ['websocket'] is identical wire-level but gives us typed events and reconnect for free.
Phase 2 is unblocked. Proceed with runtimeProcessManager.ts?updated runtime architecture md is attachedShow moreValidated preconditions and flagged remaining technical debt before Phase 2Validated preconditions and flagged remaining technical debt before Phase 2Good — this is real progress and the evidence quality is solid (actual JSON output, actual exit codes). Two items are genuinely resolved well; one I'd push back on slightly before signing off, plus one thing still unaddressed from the original list.
What's solid enough to proceed on

Tag mapping — now backed by an actual pasted debug-map.json, not a guess. The INST0. prefix + uppercase discovery is exactly the kind of thing that would've silently broken Tag Monitor if left as the original guess — good that it was caught before building UI on top of it.
clmToST.ts dual-output discovery (stCode for MatIEC, stCodeForStrucpp with stdlib stubs for STruC++) — this is a real, useful finding, but flag it as a maintenance liability going forward: two ST variants generated from one CLM graph means every future language feature (new function block type, new stdlib call) has to be correctly reflected in both variants forever, or they'll silently drift. Worth having Claude Code add a shared golden-test pair (one CLM graph → assert both variants stay semantically equivalent) rather than trusting manual sync over time.

One thing to push back on: Socket.IO justification is weaker than it sounds
"volt.diy already has a validated Socket.IO implementation" is true, but notice the reasoning is entirely about implementation convenience (code already exists), not about which is actually better for this app. The plain WebSocket path returns clean JSON ({variables:[{name,value}]}) — genuinely simpler to consume than Socket.IO's binary hex-frame protocol (GET_LIST/0x44, manual byte parsing for BOOL/INT/DINT/REAL/WORD), which is real complexity you're inheriting either way. Socket.IO doesn't remove that binary parsing — it just wraps the same binary frames in an event emitter. You're not choosing "simple JSON vs. complex binary," you're choosing "complex binary + socket.io-client dependency" vs. "complex binary + raw WebSocket, no extra dependency."
Worth a quick sanity check before locking this in: does the plain WebSocket path also speak the binary hex-frame protocol, or does it actually return the JSON format shown in your own investigation report's tagBridge.ts example? If the plain WS path really does give clean JSON (as your own document showed), that's simpler and has fewer dependencies — the opposite of what was concluded. Have Claude Code confirm which format the plain WebSocket path actually returns before finalizing, since the investigation report you pasted seems to show two different answers depending on which client (openplcClient.ts vs tagBridge.ts) it's read from.
Still open from the original list: Open Question 4 (arm64/Rosetta)
This wasn't addressed in this round — "need to confirm this works in practice" is still just a statement of uncertainty, not evidence. Since your dev machine is presumably Apple Silicon (given the darwin-arm64 build path already confirmed for MatIEC), this is cheap to actually test now: pull and run the OpenPLC Runtime Docker image, confirm it starts under Rosetta emulation, and get a real number for the performance overhead — not "typically it does." Given the runtime is your real-time execution path, "typically works" isn't a strong enough basis to build the rest of Phase 2-4 on top of.
Verdict
Proceed with runtimeProcessManager.ts, with two conditions attached:
Proceed with Phase 2, with two additions:

1. Before finalizing Socket.IO as primary: confirm what data format the plain
   ws://localhost:8443/api/debug path actually returns (JSON per tagBridge.ts,
   or the same binary frames per openplcClient.ts) — these appear to conflict
   in the investigation report. Report the real answer, then keep Socket.IO
   only if it's genuinely not simpler to go without it.

2. Actually pull and run the openplc-runtime Docker image on this arm64 machine,
   start the PLC, and report real measured overhead (not "typically ~20%") —
   this is Open Question 4, still unresolved, and it's cheap to test now before
   building four more phases on top of an assumed-working execution path.

3. Add a note in clmToST.ts (or a small test) flagging that stCode and
   stCodeForStrucpp must be kept semantically in sync — write one golden-file
   test asserting both variants compile successfully from the same CLM input,
   so future schema/language additions can't silently desync them.

Once those three are confirmed, go ahead with runtimeProcessManager.ts.
