# Volt Platform — Full Technical Documentation

> **Platform renamed to Plaxio on 2026-07-14. See [plaxio platform.md](plaxio%20platform.md) for the up-to-date version.**

---

## 1. What Is Volt?

Volt is a desktop IDE for industrial automation engineers built on three stacked layers:

1. **VS Code OSS 1.99.3** — The Electron shell, file system, terminal, source control, extensions host, and every standard editor service. Electron 34, Node 22, Chromium renderer.
2. **Void** — AI-powered assistant layer by Glass Devtools Inc., providing the Chat panel, LLM model routing (OpenAI, Anthropic, Gemini, Vertex AI, local Ollama), inline autocomplete, and inline diff editing.
3. **Volt PLC Logic Editor + HMI Simulator** — Custom graphical IEC 61131-3 PLC logic editor built inside VS Code's contribution system. Provides Ladder Diagram (LD), Function Block Diagram (FBD), and Sequential Function Chart (SFC) editors with a full pure-JavaScript simulation runtime, real-time animation, tag forcing, LD→ST code generation, **and a fully integrated FUXA SCADA/HMI simulator** — all with zero external hardware required.

Engineers write and visualize PLC programs with AI assistance while retaining the full VS Code toolchain. Everything runs offline within the Electron process.

---

## 2. Tech Stack

| Layer | Technology | Version | Notes |
|---|---|---|---|
| Shell | Electron | 34 | Chromium renderer + Node main process |
| Base IDE | VS Code OSS | 1.99.3 | Full workbench, contribution points, service injection |
| AI layer | Void (Glass Devtools) | 1.4.9 | Chat, autocomplete, inline diff |
| UI framework | React | 18 | Bundled separately from VS Code workbench |
| Type safety | TypeScript | 5.x | Strict mode throughout |
| State management | Immer + custom pub-sub | 11.x | `logicStore.ts`, immutable produce() drafts |
| Undo/redo | Custom snapshot store | — | `undoRedoStore.ts`, 100-item JSON deep-clone stack |
| Graph model | Graphology | 0.26 | Directed multi-graph for CLM; graphology-dag, graphology-traversal |
| Drag and drop | @dnd-kit | 6.x / 10.x | `@dnd-kit/core`, `@dnd-kit/sortable` — rung reordering |
| Reactive flow canvas | @xyflow/react | 12.x | FBD editor canvas |
| HMI / SCADA engine | FUXA | 1.0 | Bundled offline SCADA server (Node.js child process) |
| HMI Angular client | Angular 16 | — | Built from FUXA source, served as static files |
| HMI iframe host | simulatorEditorPane.js | — | FUXA embedded in Electron via iframe |
| Live tag bridge | fuxaTagSync.ts + fuxaProcess.js | — | Volt runtime → FUXA FuxaServer device via REST |
| Build toolchain | tsup + scope-tailwind + node build.js | 8.x | React bundles built separately, synced into `out/` |
| CSS | VS Code design tokens exclusively | — | `--vscode-*` CSS variables, theme-synced to FUXA |
| Export | html-to-image + jsPDF | 1.x / 4.x | PNG and PDF export of diagrams |
| IEC ST output | Custom clmToST transpiler | — | Pure TypeScript, zero dependencies |
| LLM providers | OpenAI, Anthropic, Gemini (Vertex AI express mode), Ollama, Mistral, xAI, Azure, AWS Bedrock, DeepSeek | — | Routed through Void's sendLLMMessage service |

---

## 3. Repository Layout

```
plc-main/
├── src/vs/workbench/contrib/void/browser/
│   ├── logicEditorInput.ts          ← Custom EditorInput (.plc file type)
│   ├── logicEditorPane.ts           ← Custom EditorPane (mounts React canvas)
│   ├── plcEditorPane.ts             ← Activity bar registration: Logic, Simulator, Tags, Console, Runtime
│   ├── plcExplorerPanel.ts          ← DOM injection: two-panel sidebar (Explorer + LIBRARY)
│   ├── simulatorEditorInput.ts      ← EditorInput for .hmi files (editor + runtime modes)
│   ├── simulatorEditorPane.ts       ← EditorPane: hosts FUXA iframe, theme bridge, live tag sync
│   ├── simulatorViewPane.ts         ← Activity bar sidebar pane for Simulator tab
│   ├── exportEditorInput.ts         ← EditorInput for Export tab
│   ├── exportEditorPane.ts          ← EditorPane: hosts Export React panel
│   └── react/
│       └── src/plc-editor-tsx/      ← ALL React source (edit here)
│           ├── index.tsx            ← React entry point, mountPlcEditor / mountPlcNavigator exports
│           ├── logicStore.ts        ← Central Immer state store
│           ├── undoRedoStore.ts     ← Snapshot-based undo/redo
│           ├── LogicTab.tsx         ← Root editor tab (LD/FBD/SFC sub-tabs)
│           ├── PlcNavigator.tsx     ← Left sidebar: POU list, tag browser, palette
│           ├── TagMonitorPanel.tsx  ← Watch list, live values, force dialog
│           ├── ConsolePanel.tsx     ← Timestamped output log
│           ├── RuntimePanel.tsx     ← Engine status, scan rate, tick counter
│           ├── ExportPanel.tsx      ← Export tab: ST code, PNG, PDF
│           ├── ExportSection.tsx    ← Export detail components
│           ├── fuxaTagSync.ts       ← Sync tag schema + live values to FUXA FuxaServer device
│           ├── fuxaLiveBridge.ts    ← Expose window.__fuxaLiveTags for main process polling
│           ├── fuxaViewGenerator.ts ← AI auto-generates FUXA HMI view from tag database
│           ├── ladder/              ← Ladder Diagram editor
│           ├── fbd/                 ← Function Block Diagram editor
│           ├── sfc/                 ← Sequential Function Chart editor
│           ├── simulation/          ← Pure-JS simulation runtime
│           ├── clm/                 ← Canonical Logic Model (graph layer)
│           ├── vendor/              ← Unified import/export service (PLCopenXML, CSV)
│           └── shared/              ← Toolbar, inspector, activity bar, overlays
├── out/vs/workbench/contrib/void/browser/
│   ├── react/out/plc-editor-tsx/index.js   ← Built React bundle (~3.7 MB ESM)
│   ├── fuxaProcess.js                      ← Electron main: spawn/kill FUXA, live-tags HTTP server
│   ├── simulatorEditorPane.js              ← Compiled simulator pane (hand-maintained)
│   ├── simulatorViewPane.js                ← Compiled simulator sidebar pane
│   └── plcEditorPane.js                    ← Activity bar registrations (hand-maintained)
├── out/main.js                             ← Electron main entry: starts FUXA, live-tags server
├── vendor/
│   ├── fuxa-src/                    ← FUXA source (Angular client + Node server)
│   │   └── client/dist/main.js      ← Built Angular client bundle
│   ├── fuxa-client-dist/            ← Static files served by FUXA HTTP server
│   └── fuxa-server/                 ← FUXA Node.js server (runtime, REST API, Socket.IO)
└── src2/                            ← Generated by scope-tailwind (DO NOT EDIT)
```

---

## 4. Build Chain

```
React source:
src/react/src/**/*.tsx
        │
        ▼ scope-tailwind (CSS token scoping)
src2/ (generated, do not edit)
        │
        ▼ tsup (ESM bundler, platform: browser)
out/vs/workbench/contrib/void/browser/react/out/plc-editor-tsx/index.js  (3.7 MB ESM)

FUXA Angular client:
vendor/fuxa-src/client/src/
        │
        ▼ ng build (Angular CLI, outputHashing: none)
vendor/fuxa-src/client/dist/main.js
        │
        ▼ cp
vendor/fuxa-client-dist/main.js  (served by FUXA HTTP server at http://127.0.0.1:1881)

Workbench TS files (outside React): hand-compiled
src/vs/workbench/contrib/void/browser/*.ts  →  out/.../*.js  (written directly)
```

**Commands:**
- React rebuild: `cd src/vs/workbench/contrib/void/browser/react && node build.js`
- FUXA Angular rebuild: `cd vendor/fuxa-src/client && npm run build && cp dist/main.js ../../fuxa-client-dist/`
- Full relaunch: `bash scripts/buildandrun.sh` (rebuild + cache clear + relaunch)

---

## 5. FUXA HMI Simulator Integration

### 5.1 Overview

FUXA is an open-source SCADA/HMI platform (Node.js server + Angular client) embedded directly in Volt as a bundled offline child process. Engineers can design HMI screens in the FUXA visual editor and see live tag values driven by Volt's simulation engine — all within the same desktop app.

The Simulator is exposed as a dedicated **activity bar tab** (icon: dashboard) in the Volt sidebar. The FUXA editor and runtime run inside an `<iframe>` within an `EditorPane`.

### 5.2 Process Architecture

```
Electron main process (out/main.js)
    │
    ├─► startFuxaServer()       — spawns: node vendor/fuxa-server/main.js
    │       PORT=1881, userDir=~/Library/Application Support/Void/fuxa-appdata
    │       polls GET http://127.0.0.1:1881/ every 300ms until ready
    │       broadcasts IPC 'fuxa:ready' to all renderer webContents
    │
    └─► startLiveTagsServer()   — http.createServer on 127.0.0.1:9091
            GET /live-tags → executeJavaScript('JSON.stringify(window.__fuxaLiveTags)')
            on the renderer BrowserWindow webContents
            → returns { tagName: liveValue } JSON for FUXA WebAPI polling (legacy path)

Renderer process (simulatorEditorPane.js)
    │
    ├─► <iframe src="http://127.0.0.1:1881/editor">   ← FUXA editor UI
    │
    ├─► postMessage({ type: 'volt:theme-tokens', tokens })
    │       → FUXA ThemeService maps vscode tokens → FUXA CSS vars
    │       → Sent at load, 1s after load, 3s after load, and on VS Code theme change
    │
    ├─► Direct CSS injection into iframe:
    │       root.style.setProperty('--svgEditWorkareaBackground', '#1e1e1e')
    │       <style id="volt-canvas-override">:root { --svgEditWorkareaBackground: #1e1e1e !important; }</style>
    │
    └─► On file load (setInput):
            reads .hmi project file via IFileService
            patches all view profile.bkcolor to '#ffffff' (white HMI canvas)
            POSTs to http://127.0.0.1:1881/api/project
```

### 5.3 Theme Bridge (vendor/fuxa-src/client/src/app/_services/theme.service.ts)

FUXA's ThemeService was modified to listen for VS Code design tokens posted from the parent frame:

```typescript
window.addEventListener('message', (event) => {
    if (event.data?.type === 'volt:theme-tokens') {
        this._applyVscodeTokens(event.data.tokens);
    }
});
```

Token mapping (VS Code → FUXA CSS vars):

| VS Code token | FUXA var |
|---|---|
| `--vscode-sideBar-background` | `--sidenavBackground` |
| `--vscode-editorGroupHeader-tabsBackground` | `--workPanelBackground` |
| `--vscode-titleBar-activeBackground` | `--headerBackground` |
| `--vscode-button-background` | `--toolboxButton` |
| `--vscode-input-background` | `--formInputBackground` |
| `--vscode-statusBar-background` | `--footZoomBackground` |
| `--vscode-editor-background` | `--svgEditWorkareaBackground` |

After mapping, `_applyOverridesToDom()` writes all vars to `:root`, then `_injectMaterialOverrides()` writes a `<style>` tag to retheme Angular Material components (dialogs, menus, tabs, inputs, buttons, chips, tooltips, scrollbars).

**Canvas color rules:**
- **Outer workarea** (`svgEditWorkareaBackground`): `#1e1e1e` — dark grey, set in `theme.config.ts` dark theme and enforced via CSS injection
- **HMI view background** (`profile.bkcolor`): `#ffffff` — white, patched in project JSON before every POST

### 5.4 Tag Schema Sync (fuxaTagSync.ts)

Runs in the renderer. Subscribes to `logicStore` and keeps FUXA's `FuxaServer` device tag list in sync with Volt's `tagDatabase`.

**Device**: FUXA's built-in `FuxaServer` device (id `"0"`) — an internal memory device. Tags are stored as `FuxaServer^~^<tagName>` keys.

**Schema sync** (debounced 400ms on tagDatabase structural change):
1. `GET /api/project` — fetch current project JSON
2. Merge Volt tags into `project.devices["0"].tags` using key format `FuxaServer^~^<tagName>`
3. Remove stale Volt tags (tag name no longer in logicStore)
4. `POST /api/project` — push updated project back

**Live value push** (throttled to 10 Hz, only when `monitorMode === 'running'`):
```
POST /api/setTagValue
{ "tags": [{ "id": "FuxaServer^~^Tank_Level", "value": "75.5" }, ...] }
```
This calls `FuxaServer.setValue()` which updates the in-memory value and emits `device-value:changed` via Socket.IO to all connected FUXA clients.

**Type mapping:**

| IEC type | FUXA type |
|---|---|
| `BOOL` | `Bool` |
| `REAL`, `LREAL` | `Float32` |
| `STRING`, `WSTRING` | `String` |
| Everything else | `Int32` |

### 5.5 HMI Auto-Generator (fuxaViewGenerator.ts)

When the AI generates a PLC program, it can also auto-generate an HMI view with widgets for each tag. Called via `generateFuxaViewForPOU(pouName, tags)`.

**Role inference** (from tag name substrings):

| Pattern | Role | Widget |
|---|---|---|
| `level/tank/vessel/hopper` | tank | Vertical fill bar with label |
| `motor/run/speed/rpm` | motor | Circular indicator with M label |
| `valve/open/close/gate/damper` | valve | Butterfly valve symbol |
| `pump` | pump | Impeller circle |
| BOOL tags | bool_indicator | LED with label |
| Everything else | number_display | Digital readout box |

All widget SVGs use **light-theme colors** (pastel fills, dark text, dark borders) for visibility on the white HMI canvas background.

**Layout**: 6-column grid, 160×140px cells, 20px left margin, 60px top margin for title.

**Project update**: `POST /api/project` with the new view added to `project.hmi.views`.

### 5.6 File Association (.hmi)

`.hmi` files are JSON project files for the FUXA HMI editor. Opening one in Volt:
1. `simulatorEditorInput.ts` registers the `.hmi` extension
2. `simulatorEditorPane.js` loads the file via `IFileService`
3. Patches all view `profile.bkcolor` → `#ffffff`
4. POSTs the project JSON to `http://127.0.0.1:1881/api/project`
5. Reloads the FUXA iframe to the correct view

**Modes:**
- `editor` → `http://127.0.0.1:1881/editor` — visual HMI authoring
- `runtime` → `http://127.0.0.1:1881/lab` — live runtime view

### 5.7 FUXA REST API Used by Volt

| Endpoint | Method | Purpose |
|---|---|---|
| `/api/version` | GET | Health check / readiness poll |
| `/api/project` | GET | Fetch full project JSON |
| `/api/project` | POST | Push entire project JSON (overwrites) |
| `/api/setTagValue` | POST | Push live tag values during simulation |
| `/api/getTagValue` | GET | (unused currently) Read a single tag value |

---

## 6. State Architecture

### 6.1 logicStore.ts — Central State Store

The entire PLC program lives in one Immer-backed pub/sub store. No Redux, no Context API, no Zustand — a custom minimal reactive store using `produce()` drafts.

**State shape:**

```typescript
interface LogicStoreState {
  pous: POU[];
  activePouId: string;

  ladderProgram: LadderProgram;
  fbdProgram: FBDProgram;
  sfcProgram: SFCProgram;

  activeLanguage: 'LD' | 'FBD' | 'SFC';
  selectedElementIds: Set<string>;
  selectedRungId: string | null;
  zoom: number;
  showGrid: boolean;
  monitorMode: 'stopped' | 'running' | 'paused' | 'stepping';
  scanRate: number;

  tagDatabase: TagEntry[];
  watchedTags: string[];

  clipboard: { rungs?, elements?, fbdNodes?, sfcSteps? };
  consoleLog: ConsoleEntry[];
  crossRef: Map<string, CrossRefEntry[]>;
  fbdBlockPinValues: Record<string, Record<string, string>>;
}
```

**Key types:**

```typescript
interface TagEntry {
  name: string;
  address: string;          // IEC direct address: %I0.0, %Q0.1, %MW100
  dataType: IECDataType;
  description?: string;
  retain?: boolean;
  initialValue?: string;
  forcedValue?: string;     // operator override; shown as orange "F" badge
  liveValue?: string;       // updated every scan by simulation engine
}

interface POU {
  id: string;
  name: string;
  language: 'LD' | 'FBD' | 'SFC';
  ladderProgram: LadderProgram;
  fbdProgram: FBDProgram;
  sfcProgram: SFCProgram;
}
```

**IECDataType union:**
`BOOL | INT | UINT | DINT | UDINT | LINT | ULINT | REAL | LREAL | BYTE | WORD | DWORD | LWORD | STRING | WSTRING | TIME | DATE | TOD | DT | ARRAY_BOOL | ARRAY_INT | ARRAY_REAL | STRUCT`

**Mutation pattern:**
```typescript
setState(recipe: (draft) => void) {
  this._state = produce(this._state, recipe);
  for (const sub of this._subscribers) sub(this._state);
}
```

### 6.2 undoRedoStore.ts — Snapshot Undo/Redo

Stores up to 100 deep-cloned JSON snapshots of `ladderProgram + fbdProgram + sfcProgram`. Every mutation in `ladderCommands.ts` wraps with `withUndo(fn)` which calls `undoRedoStore.push()` before the mutation. Ctrl+Z / Ctrl+Shift+Z keyboard shortcuts wired in `LadderCanvas.tsx`.

---

## 7. Ladder Diagram Editor

### 7.1 Data Model

```typescript
interface LadderProgram { rungs: Rung[] }

interface Rung {
  id: string;
  number: number;
  comment: string;
  elements: LadderElement[];   // main rail, left-to-right series
  branches: Branch[];          // parallel OR paths
}

interface Branch {
  id: string;
  startNodeId: string;
  endNodeId: string;
  elements: LadderElement[];
}

type LadderElement = ContactElement | CoilElement | BlockElement;
```

### 7.2 Rendering

Pure SVG with absolute pixel layout (no ReactFlow). Each rung is a self-contained SVG with computed coordinates.

**Layout constants:** `CONTACT_W=34`, `COIL_W=34`, `BLOCK_W=80`, `GAP=16`, `LEAD_W=20`, `RAIL_W=4`

**Wire colors:** Green `#22c55e` with drop-shadow glow when energized. Grey when not. CSS `transition: 0.2s`.

**Glyphs:** `| |` NO contact, `|/|` NC, `|P|` rising edge, `|N|` falling edge, `()` coil, `(/)` negated, `(S)` set, `(R)` reset, `(L)` latch, `(U)` unlatch, boxed FB with pin lines.

### 7.3 Commands (ladderCommands.ts)

All mutations wrapped in `withUndo()`:

| Function | Action |
|---|---|
| `insertContact / insertCoil / insertBlock` | Insert element at index |
| `deleteElement` | Remove; prune orphan branches |
| `moveElement` | Reorder within rung |
| `addRung / deleteRung / duplicateRung` | Rung management |
| `copyRungs / pasteRungs` | Clipboard |
| `addParallelBranch / deleteBranch` | Branch management |
| `addElementToBranch` | Add to existing branch |

---

## 8. Simulation Runtime

### 8.1 Architecture

Pure JavaScript scan-loop engine on the main thread via `setInterval`. No WebWorkers, no native binaries, no IPC.

```
Run pressed
    │
    ▼  buildCLMFromStore() → CLMGraph
    ▼  simulationEngine.start(clm, scanRate)
    │
Every scan (default 10ms):
    ├─► evaluateLadder()   BFS junction-node graph per rung
    ├─► evaluateFBD()      topological sort + per-block execution
    ├─► evaluateSFC()      step/transition state machine
    ├─► apply forcedValues (shadow all computed results)
    ├─► logicStore.updateEnergizedStates()
    ├─► logicStore.batchUpdateTagValues()
    └─► fuxaTagSync pushLiveValues() → POST /api/setTagValue → FUXA animates
```

### 8.2 SimulationEngine API (engine.ts)

```typescript
start(clm, scanRate, initialTagValues?)
stop()
pause() / resume()
step()                    // single scan
forceTag(name, value)     // override + immediate recompute
releaseForce(name)
setScanRate(ms)           // hot-swap without stop/restart
getTagValues()
```

`_recomputeEnergized()` runs a single evaluation pass even when stopped. Called after every force/release — makes glyph colors update immediately without pressing Run.

### 8.3 Ladder Evaluator (evaluator-ld.ts)

BFS on a junction-node Boolean graph built per rung at evaluation time. Coil edges are sinks — they fire when their source junction is reachable but never propagate power. Pre-evaluates contact conduction, then BFS from SOURCE, then fires coil sinks.

**Coil semantics:**

| Type | IEC | Behavior |
|---|---|---|
| normal | Output coil | `tag = powerIn` every scan |
| negated | Negated coil | `tag = NOT powerIn` |
| set / latch | S coil | Retentive: `if powerIn: tag = TRUE` |
| reset / unlatch | R coil | Retentive: `if powerIn: tag = FALSE` |
| P coil | Positive transition | 1-scan pulse on rising power edge |
| N coil | Negative transition | 1-scan pulse on falling power edge |

### 8.4 Function Block Evaluator (function-blocks.ts)

All 10 IEC 61131-3 standard FBs as pure functions `(inputs, state, ctx) → { outputs, newState }`:

**Timers:** TON (on-delay), TOF (off-delay), TP (pulse — non-retriggerable). T# literal parser: `T#500ms`, `T#2s`, `T#1m`, `T#1h`.

**Counters:** CTU (up), CTD (down), CTUD (up/down).

**Bistable:** SR (set dominant), RS (reset dominant).

**Edge detectors:** RTRIG (rising), FTRIG (falling) — each fires TRUE for exactly one scan.

### 8.5 FBD Evaluator (evaluator-fbd.ts)

Topological sort (Kahn's algorithm) on the wire graph built from CLM, then evaluates each block in dependency order. Logic gates, arithmetic, comparison, selectors, and timer/counter FBs all supported.

### 8.6 SFC Evaluator (evaluator-sfc.ts)

IEC 61131-3 §2.6 compliant. Per scan: execute active step actions (N/S/R/P/P0/P1 qualifiers), evaluate outgoing transition conditions via Pratt expression parser, deactivate source steps, activate target steps.

### 8.7 Expression Evaluator (expression-eval.ts)

Hand-written Pratt parser for IEC 61131-3 boolean and numeric expressions. Handles `AND`, `OR`, `NOT`, `XOR`, `MOD`, all comparison operators, parentheses, numeric literals, T# time literals, and tag name resolution.

---

## 9. Canonical Logic Model (CLM)

Graphology directed multi-graph that is the bridge between editor state and evaluators. Built on every Run via `buildCLMFromStore()`.

**Node types:** `TAG`, `POU`, `RUNG`, `LD_ELEMENT`, `FBD_BLOCK`, `FBD_PIN`, `SFC_STEP`, `SFC_TRANSITION`, `SFC_ACTION`

**Edge types:** `CONTAINS`, `RUNG_ORDER`, `READS`, `WRITES`, `WIRE`, `HAS_PIN`, `SFC_FLOW`, `HAS_ACTION`

**CLM subsystem files:**

| File | Purpose |
|---|---|
| `clm/schema.ts` | Node/edge type definitions |
| `clm/graph.ts` | CLMGraph class (Graphology wrapper) |
| `clm/builder.ts` | logicStore → CLMGraph |
| `clm/projections.ts` | CLMGraph → logicStore flat model |
| `clm/validator.ts` | Cycle detection, dangling refs, double-coil checks |
| `clm/clmToST.ts` | CLMGraph → IEC 61131-3 Structured Text + debug map |
| `clm/clmStore.ts` | CLMStore singleton: CLM-first mutation API |

### ST Code Generator (clmToST.ts)

Emits standards-compliant IEC 61131-3 ST. Two output variants:
- **MatIEC format**: uses external stdlib, emits `CONFIGURATION/RESOURCE/TASK/PROGRAM_CONFIGURATION`
- **STruC++ format**: inlines all standard FB stubs (no stdlib resolver)

RETAIN tags → `VAR_RETAIN ... END_VAR`. Initial values → `: TYPE := value`. Debug map maps `INST0.<TAGNAME>` paths for cross-referencing compiled output.

---

## 10. FBD Editor

Uses **ReactFlow** (`@xyflow/react`) for canvas layout and wire routing. Custom node types in `FBDNodeTypes.tsx`. Live pin values shown as badges on each block. Wire colors animate with energized state.

**Block types (32):** IN_VARIABLE, OUT_VARIABLE, AND, OR, NOT, XOR, NAND, NOR, ADD, SUB, MUL, DIV, MOD, ABS, SQRT, GT, GE, LT, LE, EQ, NE, SEL, MUX, LIMIT, MOVE, CONNECTOR, CONTINUATION, COMMENT, TON, CTU, SR, RS.

---

## 11. SFC Editor

Custom canvas in `SFCCanvas.tsx` (not ReactFlow). Steps and transitions positioned via absolute CSS. Initial steps show double border. Active steps highlight green. `SFCActionEditor.tsx` modal for N/S/R/P/P0/P1 qualifiers.

---

## 12. UI Components

### 12.1 Activity Bar / Sidebar Tabs

Registered in `plcEditorPane.js` as VS Code ViewContainers:

| Tab | Icon | Content |
|---|---|---|
| Logic | Circuit board | LD/FBD/SFC editor canvas |
| Simulator | Dashboard | FUXA HMI editor/runtime iframe |
| Tags | Database | Tag monitor panel |
| Console | Terminal | Timestamped console log |
| Runtime | Pulse | Engine status, tick counter |

### 12.2 LogicToolbar (shared/LogicToolbar.tsx)

| Control | Function |
|---|---|
| ▶ Run / ⏹ Stop | Build CLM, start/stop simulationEngine |
| Scan rate selector | 10ms / 50ms / 100ms / 500ms / 1s (hot-swap) |
| Undo / Redo | undoRedoStore.undo() / redo() |
| Zoom − / + / 1:1 | logicStore.setZoom() |
| Grid toggle | logicStore.setShowGrid() |
| Search | Live tag+element search with match count and Enter-to-cycle |

### 12.3 PlcNavigator (PlcNavigator.tsx)

Left LIBRARY panel. PROGRAMS section with POU list, language badges, element count sub-rows. TAG DATABASE section with live values and type color codes. Full LD/FBD/SFC palette. IEC standard library reference (58+ functions).

Also **starts the FUXA bridges** at module initialization:
```typescript
startFuxaTagSync();
startFuxaLiveBridge();
```

### 12.4 TagMonitorPanel (TagMonitorPanel.tsx)

Watch list with live values updated every scan. Force dialog: Force TRUE, Force FALSE, Release Force, numeric input for non-BOOL. Create Tag modal. Context menu: Force / Release / Jump to cross-ref / Remove.

### 12.5 Multi-POU Support

`logicStore` holds `pous: POU[]` and `activePouId`. Actions: `addPOU`, `setActivePOU`, `deletePOU`, `renamePOU`. `setActivePOU` mirrors the POU's programs into top-level state so all editor code works without modification.

### 12.6 Export (ExportPanel.tsx / ExportSection.tsx)

- **ST export**: `clmToST(clm)` → copy to clipboard or download `.st` file
- **PNG export**: `html-to-image` captures canvas DOM node
- **PDF export**: `jsPDF` embeds captured image into A4 PDF
- **Unified import/export service** (`vendor/unifiedImportService.ts`, `unifiedExportService.ts`): PLCopenXML and CSV tag import/export paths

---

## 13. Tag Database & Forcing

### Tag Schema
`name | address (%I/%Q/%M) | dataType | description | retain | initialValue | forcedValue | liveValue`

### Force flow
`logicStore.forceTag(name, value)` → sets `forcedValue` + `liveValue` → `simulationEngine.forceTag()` → adds to `forcedValues` Map → `_recomputeEnergized()` → immediate UI update (orange "F" badge, glyph lights up).

### Cross-Reference Index
Rebuilt on every structural mutation. `Map<tagName, CrossRefEntry[]>` where each entry has `{ rungId, elementId, elementKind, role: 'reads'|'writes' }`. Used by CrossReferencePanel; click to jump to element.

---

## 14. LLM / AI Integration

### Provider routing (sendLLMMessage.impl.ts)

All AI calls flow through Void's `sendLLMMessage` service in the Electron main process:

| Provider | Auth | Notes |
|---|---|---|
| OpenAI | API key | OpenAI SDK |
| Anthropic | API key | Anthropic SDK (streaming) |
| Gemini (Vertex AI express) | Express API key (`AQ.*`) | `GoogleGenAI({ vertexai: true, apiKey })` — Google's own models only |
| Azure OpenAI | API key + endpoint | `AzureOpenAI` SDK |
| AWS Bedrock | AWS credentials | Custom signing |
| Ollama | Local | OpenAI-compatible endpoint |
| Mistral | API key | Mistral SDK + FIM |
| xAI | API key | OpenAI-compatible |
| DeepSeek | API key | OpenAI-compatible |
| OpenRouter | API key | OpenAI-compatible |

> **Note:** The Vertex AI express-mode API key only works with Google's Gemini models. To use Claude (Sonnet 4.6 etc.) on Vertex AI, a full GCP project with Application Default Credentials is required, using the `AnthropicVertex` client — this is a separate configuration from the existing Gemini setup. Alternatively, a direct Anthropic API key uses the existing `anthropic` provider path with no GCP setup needed.

### AI-assisted PLC programming

The Chat panel (Void layer) can generate PLC programs directly. When the AI creates a new simulation, it:
1. Generates ladder/FBD/SFC logic and tag definitions
2. Calls `generateFuxaViewForPOU()` to auto-create an HMI view in FUXA
3. Widget colors and layout are tuned for the white HMI canvas background

---

## 15. File Index

| File | Purpose |
|---|---|
| `logicStore.ts` | Central Immer store: all PLC program state, tag database, monitor mode, POU list |
| `undoRedoStore.ts` | Snapshot-based undo/redo (100 steps) |
| `LogicTab.tsx` | Root editor tab: sub-tab bar, CLM init, export |
| `PlcNavigator.tsx` | Left LIBRARY panel: POU list, tag browser, palette; starts FUXA bridges |
| `TagMonitorPanel.tsx` | Watch list, live values, force dialog, create tag modal |
| `ConsolePanel.tsx` | Timestamped output log |
| `RuntimePanel.tsx` | Engine status, tick counter |
| `ExportPanel.tsx` / `ExportSection.tsx` | Export tab: ST, PNG, PDF |
| `fuxaTagSync.ts` | Tag schema + live value sync to FUXA FuxaServer device |
| `fuxaLiveBridge.ts` | Writes window.__fuxaLiveTags for main process /live-tags HTTP server |
| `fuxaViewGenerator.ts` | Auto-generates FUXA HMI view from tag database |
| `ladder/LadderCanvas.tsx` | LD canvas: rung list, DnD reorder, keyboard shortcuts |
| `ladder/LadderRung.tsx` | LD rung renderer: SVG layout, power-flow, inspector, force popover |
| `ladder/LadderElementRenderer.tsx` | SVG glyph components |
| `ladder/ladderCommands.ts` | All LD mutation commands with undo wrapping |
| `fbd/FBDCanvas.tsx` | FBD canvas (ReactFlow) |
| `fbd/FBDNodeTypes.tsx` | Custom ReactFlow node type components |
| `fbd/FBDPalette.tsx` | FBD element palette |
| `fbd/FBDWireRenderer.tsx` | Custom wire edge renderer |
| `sfc/SFCCanvas.tsx` | SFC canvas: step/transition layout |
| `sfc/SFCStepNode.tsx` | SFC step node component |
| `sfc/SFCTransitionNode.tsx` | SFC transition node component |
| `sfc/SFCActionEditor.tsx` | Step action editor modal |
| `simulation/engine.ts` | SimulationEngine: scan loop, force API, _recomputeEnergized |
| `simulation/evaluator-ld.ts` | BFS junction-node LD evaluator |
| `simulation/evaluator-fbd.ts` | Topological-sort FBD evaluator |
| `simulation/evaluator-sfc.ts` | IEC SFC step/transition evaluator |
| `simulation/function-blocks.ts` | 10 IEC FBs: TON/TOF/TP/CTU/CTD/CTUD/SR/RS/RTRIG/FTRIG |
| `simulation/expression-eval.ts` | Pratt parser for IEC boolean/numeric expressions |
| `simulation/types.ts` | TagState, FBInstanceState, ScanResult types |
| `clm/schema.ts` | CLM node/edge type definitions |
| `clm/graph.ts` | CLMGraph class (Graphology wrapper) |
| `clm/builder.ts` | logicStore → CLMGraph |
| `clm/projections.ts` | CLMGraph → logicStore flat model |
| `clm/validator.ts` | validateCLM: cycle detection, dangling refs, double-coil |
| `clm/clmToST.ts` | CLMGraph → IEC 61131-3 Structured Text + debug map |
| `clm/clmStore.ts` | CLMStore singleton: CLM-first mutation API |
| `shared/LogicToolbar.tsx` | Run/Stop, scan rate, undo/redo, zoom, grid, search |
| `shared/ActivityBar.tsx` | Narrow icon sidebar: draggable LD/FBD palette icons |
| `shared/TagBindingInput.tsx` | Autocomplete input for tag assignment |
| `shared/MonitorOverlay.tsx` | LiveValueBadge, EnergizedDot, wire color helpers |
| `out/browser/fuxaProcess.js` | Electron main: spawn/kill FUXA server, /live-tags HTTP server on :9091 |
| `out/browser/simulatorEditorPane.js` | Simulator iframe host, theme bridge, bkcolor patch, setTagValue sync |
| `out/browser/simulatorViewPane.js` | Activity bar Simulator sidebar pane |
| `out/browser/plcEditorPane.js` | Activity bar registration for all Volt tabs |
| `vendor/fuxa-server/` | FUXA Node.js server (runtime, REST API, Socket.IO, FuxaServer device) |
| `vendor/fuxa-client-dist/` | Built FUXA Angular client (served at http://127.0.0.1:1881) |

---

## 16. What Is Not Yet Implemented

| Feature | Status |
|---|---|
| PLCopenXML import (full round-trip) | Import service exists; full schema coverage incomplete |
| Hardware download / upload | No compiler invocation, no protocol target |
| IEC direct address I/O mapping | Accepted in tag address field but not validated against hardware |
| Array indexing in LD contacts | toBool() coerces arrays; no index-based comparison |
| STRUCT field definition UI | Type registered but no field editor |
| SFC action body editors (ST language) | Actions are simple one-shot tag assignments |
| Claude / Anthropic on Vertex AI | Requires full GCP project + ADC; current Vertex key is Gemini express-mode only |
| Run/Stop toggle in FUXA Lab view | FUXA runtime (Lab) view has no Volt simulation start/stop button yet |
