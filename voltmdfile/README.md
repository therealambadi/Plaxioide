# volt.diy Platform Documentation

**Version:** 3.5.13  
**Type:** Industrial Automation AI IDE with Formal Verification  
**Stack:** Remix + React + Vite + Cloudflare Workers + Electron  
**License:** MIT (fork of bolt.diy)

---

## Table of Contents

1. [Platform Overview](#platform-overview)
2. [Architecture](#architecture)
3. [AI Engine & LLM Providers](#ai-engine--llm-providers)
4. [Canonical Logic Model (CLM)](#canonical-logic-model-clm)
5. [PLC Programming Engine](#plc-programming-engine)
6. [Workbench Tabs & Views](#workbench-tabs--views)
7. [Compiler & Validation Pipeline](#compiler--validation-pipeline)
8. [Formal Verification Stack (Phases 1–7)](#formal-verification-stack-phases-17)
   - [Phase 1: OpenPLC Runtime v4](#phase-1-openplc-runtime-v4)
   - [Phase 2: CLM Property Synthesizer](#phase-2-clm-property-synthesizer)
   - [Phase 3: ESBMC-PLC+ Verifier](#phase-3-esbmc-plc-verifier)
   - [Phase 4: Multi-Agent Pipeline](#phase-4-multi-agent-pipeline)
   - [Phase 5: VerifyTrust Dashboard](#phase-5-verifytrust-dashboard)
   - [Phase 6: FAT Evidence Package Generator](#phase-6-fat-evidence-package-generator)
   - [Phase 7: Workbench Wiring & Deploy Gate](#phase-7-workbench-wiring--deploy-gate)
9. [Simulation Engine](#simulation-engine)
10. [Ladder Logic Renderer](#ladder-logic-renderer)
11. [HMI Simulation System](#hmi-simulation-system)
12. [SFC Engine](#sfc-sequential-function-chart-engine)
13. [I/O Studio](#io-studio)
14. [FAT Verification System](#fat-verification-system)
15. [Verify Tab & Round-Trip Testing](#verify-tab--round-trip-testing)
16. [Vendor Adapters & Multi-Platform Export](#vendor-adapters--multi-platform-export)
17. [Deploy & Export](#deploy--export)
18. [CLM Graph View](#clm-graph-view)
19. [Migration Wizard](#migration-wizard)
20. [P&ID Vision Parser](#pid-vision-parser)
21. [File Processing Pipeline](#file-processing-pipeline)
22. [File System & Editor](#file-system--editor)
23. [Chat Interface](#chat-interface)
24. [State Management](#state-management)
25. [Backend Services & Docker Stack](#backend-services--docker-stack)
26. [Deployment Targets](#deployment-targets)
27. [Security & Persistence](#security--persistence)
28. [Configuration](#configuration)
29. [Dependencies](#dependencies)
30. [AI Architecture — System 1 (v3.6.0)](#ai-architecture--system-1-v360)
    - [Overview](#ai-overview)
    - [Chat Modes: Plan vs Build](#chat-modes-plan-vs-build)
    - [Full Message Flow](#full-message-flow)
    - [Tool Registry](#tool-registry)
    - [validateST — MatIEC Integration](#validatest--matiec-integration)
    - [verifyProgram — Formal Verification Tool](#verifyprogram--formal-verification-tool)
    - [Agent Trace UI](#agent-trace-ui)
    - [Verification Guardrail](#verification-guardrail)
    - [Store Architecture](#store-architecture)
    - [Backend Services Wiring](#backend-services-wiring)
31. [Known Gaps & Roadmap](#known-gaps--roadmap)

---

## Platform Overview

volt.diy is an AI-powered Industrial Automation IDE that generates, validates, formally verifies, simulates, and exports IEC 61131-3 PLC programs entirely in the browser. It combines a conversational AI assistant with a professional workbench built around a **Canonical Logic Model (CLM)** — a vendor-neutral graph representation of any PLC program — and a complete **Formal Verification Stack** (CLM Property Synthesizer + ESBMC-PLC+) that proves safety properties against generated ST code before any export is allowed.

### Core Capabilities

- **AI Code Generation** — Natural language to Structured Text, Ladder Logic, HMI layouts, and FAT test scripts
- **Canonical Logic Model** — Graphology-backed directed graph; auto-synced from ST files; drives export, visualization, and formal property synthesis
- **Two-tier Validation** — Browser-native ST validator → MatIEC (iec2c via Docker)
- **Formal Verification** — 4-stage multi-agent pipeline: Generate → CLM Property Synth → ESBMC k-induction → Export Gate
- **Live Simulation** — Deterministic IEC 61131-3 scan cycle engine at 50ms intervals with real function block state machines
- **ReactFlow HMI v2** — 18 custom skeuomorphic SVG nodes on ReactFlow (@xyflow/react) canvas with ELK.js auto-layout, physics simulation engine (fluid flow, level accumulation, conveyor belt), Zod-validated scene, and Component Registry (29 types with port/physics/animation specs)
- **OpenPLC Runtime v4** — Real hardware execution via Docker sidecar; STruC++ ST→C++ codegen microservice; Socket.IO live debug stream
- **Multi-Vendor Export** — Rockwell (.L5X), Siemens (.scl), CODESYS (.xml), OpenPLC (.st) generated from CLM, not from AI text; gated on both compiler and formal verification results
- **FAT Evidence PDF** — jsPDF 7-section PDF bundling all proof artifacts, counterexamples, ST code, and optional OpenPLC execution log
- **Round-Trip Testing** — CLM→Export→Re-import consistency verification with per-vendor scoring
- **Factory Acceptance Testing** — Automated FAT script execution against the scan engine with PDF punch-list reports
- **Fix with AI** — Compiler errors automatically injected as structured prompts back into the chat with targeted fix instructions

The platform supports both **PLC/Industrial Automation** and **Embedded Systems** (Arduino, ESP32, Raspberry Pi Pico) workflows.

---

## Architecture

```
┌──────────────────────────────────────────────────────────────────────────────────┐
│                                 BROWSER CLIENT                                    │
├──────────────────────────────────────────────────────────────────────────────────┤
│                                                                                    │
│  Remix (SSR + Client Hydration)                                                   │
│  ├─ Chat Interface (23+ LLM providers, streaming, file attachments)               │
│  ├─ Workbench (13 panels: Code, Preview, HMI, CLM, Verify, Deploy, OpenPLC…)     │
│  │                                                                                 │
│  ├─ Agentic Architecture ★ NEW (v3.4.0)                                           │
│  │   ├─ agentOrchestrator.ts    — routes Standard/Multi-Agent/Autonomous modes    │
│  │   ├─ agents/planningAgent.ts — LLM-powered step decomposition                  │
│  │   ├─ agents/codingAgent.ts   — ST code + file generation                       │
│  │   ├─ agents/validationAgent.ts — MatIEC gated validation                        │
│  │   ├─ agents/debuggingAgent.ts — error repair with LLM                          │
│  │   ├─ agents/autonomousAgent.ts — plan→code→validate→debug loop (max 5)        │
│  │   ├─ stores/agentStore.ts    — nanostores: mode, permission, plan, result      │
│  │   └─ contextManager.ts       — builds AgentContext from CLM + RAG + I/O        │
│  │                                                                                 │
│  ├─ CLM Graph Engine (Graphology)                                                  │
│  │   ├─ graphBuilder.ts      — directed POU/rung/node graphs                      │
│  │   ├─ validator.ts         — IEC 61131-3 semantic type checking                 │
│  │   ├─ stToCLM.ts           — ST text → CLM graph                                │
│  │   ├─ clmToST.ts           — CLM graph → ST text                                │
│  │   ├─ autoSync.ts          — watches .st files, rebuilds CLM reactively         │
│  │   └─ store.ts             — nanostores atoms + undo/redo stack                 │
│  │                                                                                 │
│  ├─ Formal Verification Stack ★ NEW                                               │
│  │   ├─ multiAgentPipeline.ts — 6-stage verification pipeline + nanostores atom  │
│  │   ├─ clmPropertySynthesizer.ts — CLM graph traversal → ESBMC YAML properties  │
│  │   ├─ esbmcClient.ts       — HTTP client for ESBMC-PLC+ Docker service         │
│  │   ├─ fatEvidencePackage.ts — jsPDF 8-section evidence PDF generator           │
│  │   └─ types.ts             — VerificationResult, PropertySet, CounterexampleTrace│
│  │                                                                                 │
│  ├─ OpenPLC Runtime Client ★ NEW                                                  │
│  │   ├─ openplcClient.ts     — login + STruC++ codegen + upload + debug stream   │
│  │   ├─ openplcStore.ts      — nanostores bridge for OpenPLC state               │
│  │                                                                                 │
│  ├─ Validation Pipeline                                                            │
│  │   ├─ st-validator.ts      — browser-native syntax + type checks               │
│  │   ├─ matiec-client.ts     — HTTP client for Docker iec2c compiler             │
│  │   ├─ quality-pipeline.ts  — 3-gate pipeline: syntax, safety, OSCAT           │
│  │   └─ oscat-library.ts     — 500+ OSCAT block reference database               │
│  │                                                                                 │
│  ├─ Scan Engine (IEC 61131-3)                                                     │
│  │   ├─ scanEngine.ts        — Phase A/B/C deterministic 50ms scan loop          │
│  │   ├─ functionBlocks.ts    — TON, TOF, TP, CTU, CTD, R_TRIG, F_TRIG           │
│  │   └─ plcSimulator.ts      — nanostores bridge to React UI                     │
│  │                                                                                 │
│  ├─ HMI System v2 (ReactFlow + ELK) ★ REWRITTEN                                   │
│  │   ├─ HMICanvas.client.tsx — ReactFlow canvas + physics integration             │
│  │   ├─ nodes/ (18 files)    — Custom skeuomorphic SVG node components            │
│  │   ├─ edges/index.tsx      — Custom animated pipe/signal edge rendering         │
│  │   ├─ lib/hmi/componentRegistry.ts — 29 component specs (Zod validated)        │
│  │   ├─ lib/hmi/sceneValidator.ts    — Zod validation + auto-fix pipeline        │
│  │   ├─ lib/hmi/hmiPhysicsEngine.ts  — 100ms tick physics (flow/level/sensor)    │
│  │   ├─ lib/hmi/elkLayout.ts         — ELK.js layered auto-layout                │
│  │   ├─ lib/hmi/types.ts             — HMISceneSpec, ComponentType, etc.          │
│  │   └─ lib/stores/hmiStore.ts       — Nanostores atoms + live tag binding        │
│  │                                                                                 │
│  ├─ Vendor Adapters                                                                │
│  │   ├─ rockwell.ts          — L5X (XML) import/export (fast-xml-parser)         │
│  │   ├─ siemens.ts           — SCL import/export                                  │
│  │   ├─ codesys.ts           — PLCOpenXML import/export                           │
│  │   ├─ openplc.ts           — Standard IEC ST export                             │
│  │   └─ roundTrip.ts         — CLM→Export→Re-import consistency test             │
│  │                                                                                 │
│  └─ Additional Engines                                                             │
│      ├─ sfc/engine.ts        — SFC step/transition/action-qualifier execution    │
│      ├─ pid/parser.ts        — P&ID image → ISA tags + control loops             │
│      ├─ fileProcessingPipeline.ts — image/PDF/CAD/xlsx extraction                │
│      ├─ fatVerification.ts   — FAT test execution + PDF reporting                 │
│      ├─ ioStudio.ts          — I/O tag database + module config                  │
│      ├─ deployExport.ts      — L5X/SCL/XML/XLSX/ZIP generation                  │
│      └─ migration/wizard.ts  — cross-vendor CLM migration                        │
│                                                                                    │
│  WebContainer (Node.js sandbox)                                                   │
│  ├─ Virtual File System                                                            │
│  ├─ Shell / Terminal                                                               │
│                                                                                    │
│  Electron (optional desktop shell)                                                │
│  ├─ Main Process (window, file access, native dialogs)                            │
│  └─ Preload Bridge (contextBridge APIs)                                           │
│                                                                                    │
├──────────────────────────────────────────────────────────────────────────────────┤
│                              BACKEND SERVICES (Docker)                             │
├──────────────────────────────────────────────────────────────────────────────────┤
│                                                                                    │
│  Port  │ Service                │ Technology           │ Role                    │
│  ──────┼────────────────────────┼──────────────────────┼─────────────────────── │
│  4001  │ matiec-validator       │ Node.js + iec2c      │ IEC ST compiler         │
│  4004  │ esbmc-plc-verifier ★   │ Python + ESBMC 8.3.0 │ k-induction Z3 proofs  │
│  4006  │ strucpp-codegen ★      │ Node.js              │ ST → C++ ZIP codegen    │
│  8443  │ openplc-runtime ★      │ OpenPLC v4 (Docker)  │ Real PLC execution      │
│                                                                                    │
│  Cloudflare Workers / Remix Routes                                                 │
│  ├─ /api/chat (LLM proxy, streaming — standard chat mode)                         │
│  ├─ /api/plc-generate ★ (non-streaming LLM for agent pipeline)                    │
│  ├─ /api/agent.execute (POST — stub, returns 501; orchestration runs client-side) │
│  ├─ /api/git (Git proxy)                                                           │
│  └─ /api/deploy                                                                    │
│                                                                                    │
├──────────────────────────────────────────────────────────────────────────────────┤
│                               EXTERNAL SERVICES                                    │
├──────────────────────────────────────────────────────────────────────────────────┤
│  LLM Providers (23+)         │  Git Platforms   │  Deploy Targets                │
│  ├─ Anthropic (Claude 4)     │  ├─ GitHub       │  ├─ Vercel                    │
│  ├─ Google (Gemini 2.0)      │  └─ GitLab       │  ├─ Netlify                   │
│  ├─ OpenAI (GPT-4o)          │                  │  └─ Cloudflare Pages           │
│  ├─ DeepSeek, Mistral, Groq  │  Database        │                                │
│  ├─ Ollama (local)           │  └─ Supabase     │                                │
│  └─ 17+ more                 │                  │                                │
└──────────────────────────────────────────────────────────────────────────────────┘
```

### Directory Structure

```
volt.diy/
├── app/
│   ├── routes/                              # Remix route handlers (30+ routes)
│   ├── components/
│   │   ├── chat/                            # Chat UI, streaming, Fix with AI
│   │   └── workbench/                       # Workbench panel components
│   │       ├── CLMGraphView.client.tsx
│   │       ├── RoundTripPanel.client.tsx
│   │       ├── HMISimulation.client.tsx     # DOM SVG, FUXA symbols
│   │       ├── FATVerification.client.tsx
│   │       ├── DeployExport.client.tsx      # CLM + verification-gated export
│   │       ├── IOStudio.client.tsx
│   │       ├── OpenPLCRuntimePanel.client.tsx   ★ NEW
│   │       ├── VerifyTrustDashboard.client.tsx  ★ NEW
│   │       └── EditorPanel.tsx
│   ├── lib/
│   │   ├── plc/
│   │   │   ├── clm/                         # Canonical Logic Model (core)
│   │   │   ├── vendors/                     # Vendor adapters + profiles
│   │   │   ├── migration/                   # Round-trip + wizard
│   │   │   ├── hmi/                         # HMI symbol system
│   │   │   ├── sfc/                         # Sequential Function Chart
│   │   │   ├── pid/                         # P&ID vision parser
│   │   │   ├── oscat/                       # OSCAT function block catalog
│   │   │   ├── openplcClient.ts             # OpenPLC v4 HTTP + WS client
│   │   │   ├── openplcStore.ts              # nanostores bridge for OpenPLC
│   │   ├── agent/                           ★ Agentic architecture (v3.4.0+)
│   │   │   ├── agentOrchestrator.ts         # Central router: mode → execution engine
│   │   │   ├── contextManager.ts            # Builds AgentContext from CLM+RAG+I/O
│   │   │   ├── useAgentExecution.ts         # React hook bridging chat→orchestrator
│   │   │   ├── types.ts
│   │   │   ├── stores/agentStore.ts         # All nanostores + log event functions
│   │   │   └── agents/
│   │   │       ├── planningAgent.ts
│   │   │       ├── codingAgent.ts           # sanitizeSTCode + ===FILE:=== parser
│   │   │       ├── validationAgent.ts       # MatIEC :4001
│   │   │       ├── debuggingAgent.ts        # 9 MatIEC error pattern fixer
│   │   │       └── autonomousAgent.ts       # 5-iteration loop
│   │   ├── verification/                    ★ NEW (entire directory)
│   │   │   ├── types.ts                     # VerificationResult, PropertySet, etc.
│   │   │   ├── clmPropertySynthesizer.ts    # CLM graph → ESBMC YAML properties
│   │   │   ├── esbmcClient.ts               # HTTP client for ESBMC-PLC+ service
│   │   │   └── fatEvidencePackage.ts        # jsPDF 8-section evidence PDF
│   │   ├── ai/
│   │   │   └── multiAgentPipeline.ts        ★ NEW — 6-stage orchestration pipeline
│   │   ├── validators/
│   │   ├── stores/
│   │   │   └── workbench.ts                 ★ MODIFIED — .st write triggers pipeline
│   │   └── common/prompts/prompts.ts        ★ MODIFIED — HMI JSON schema hardened
│   ├── tests/
│   │   ├── phase2-property-synthesizer.test.ts  ★ NEW
│   │   ├── phase3-esbmc.test.ts                 ★ NEW
│   │   ├── phase4-pipeline.test.ts              ★ NEW
│   │   ├── phase5-verify-dashboard.test.ts      ★ NEW
│   │   ├── phase6-fat-evidence.test.ts          ★ NEW
│   │   └── phase7-e2e-full-pipeline.test.ts     ★ NEW
├── docker/                                  # All Docker build contexts
│   ├── esbmc-plc/
│   │   ├── Dockerfile                       # ubuntu:24.04, ESBMC 8.3.0, Flask
│   │   ├── server.py                        # POST /verify, GET /health
│   │   ├── esbmc_runner.py                  # ST→C translation, k-induction
│   │   └── requirements.txt
│   ├── matiec-validator/                    # iec2c Docker microservice (:4001)
│   └── strucpp-codegen/                     # ST→C++ codegen microservice (:4006)
├── docker-compose.yaml                      # 4 services: matiec, esbmc, strucpp, openplc
└── .env.local                               # Service URLs (un-prefixed for server-side use)
```

---

## AI Engine & LLM Providers

### Default Model

**`claude-sonnet-5`** (Anthropic via Google Cloud Vertex AI) — set in `app/utils/constants.ts`

Uses the **global** Vertex AI endpoint: `https://aiplatform.googleapis.com/v1/projects/{project}/locations/global/publishers/anthropic`

1M token context window, 128k output tokens. Route: `@ai-sdk/anthropic` `createAnthropic()` with `baseURL` pointed at Vertex; auth via `GOOGLE_VERTEX_API_KEY` + `x-goog-api-key` header. Falls back to direct Anthropic API if `GOOGLE_VERTEX_API_KEY`/`GOOGLE_CLOUD_PROJECT` are absent.

### Supported Providers (23+)

| Provider | Models | Use Case |
|----------|--------|----------|
| **Anthropic (via Vertex AI)** | **Claude Sonnet 5** (default), Sonnet 4.6, Opus 4.8, Haiku 4.5 | Primary code gen — 1M context, 128k output |
| **Google (Vertex AI)** | **Gemini 3.5 Flash** (default, 1M context), **Gemini 3.1 Pro** (escalation tier only) | Primary provider — two models only; all others removed |
| **OpenAI** | GPT-4o, GPT-4 Turbo | General purpose |
| **DeepSeek** | DeepSeek V3, Coder | Cost-effective coding |
| **Mistral** | Mistral Large, Codestral | European alternative |
| **Groq** | Llama 3.1 70B, Mixtral | Ultra-fast inference |
| **Cerebras** | Llama 3.1 70B | Fastest inference |
| **Fireworks AI** | Various open models | Scaling |
| **Cohere** | Command R+ | Enterprise |
| **xAI** | Grok | Experimental |
| **Perplexity** | Sonar models | Search-augmented |
| **OpenRouter** | 100+ routed models | Multi-model access |
| **Ollama** | Any local GGUF model | Offline/private |
| **LM Studio** | Local models | Developer private |
| **Together AI** | Open-source models | Batch inference |
| **HuggingFace** | 100+ hosted models | Research |
| **Amazon Bedrock** | Claude, Titan, Llama | Enterprise cloud |
| **Azure OpenAI** | GPT-4 family | Enterprise Microsoft |

### System Prompt Architecture (`app/lib/common/prompts/prompts.ts`)

The AI is instructed via a carefully tuned industrial automation prompt that enforces:

- **Zero disclaimers** — No "not for production use", "consult an engineer"
- **Surgical fixes** — When fixing errors, modify only failing lines
- **Mandatory 3-file output** — Every PLC response generates `.st` + `ladder/logic.json` + `hmi/simulation.json`
- **IEC 61131-3 syntax rules** — Enforced semicolons, balanced parentheses, FOR-loop variable declaration
- **MatIEC compatibility rules** — No multi-line boolean expressions, operators must trail not lead lines
- **Tag binding rules** — `linked_tag` in HMI JSON must be character-for-character copies of tags in `logic.json`
- **HMI canonical key** — Top-level array key must be `hmi_layout` (not `components`, `items`, etc.)
- **HMI component catalog** — Full listing of 25 component types mapped to FUXA P&ID SVG symbols
- **Connections array** — AI generates pipe routing between process components
- **ISA-101 color rules** — No default colors; gray idle, green run, red fault, yellow warn

#### Fix with AI Prompt (`app/components/workbench/EditorPanel.tsx`)

When the compiler reports errors, "Fix with AI" constructs a structured repair prompt:

```
MatIEC COMPILER ERRORS — FIX REQUIRED:
- Line 75, Col 1: invalid control variable defined for ST 'FOR' statement

FIX STRATEGY (follow exactly):
1. NEVER use multi-line boolean expressions — break into intermediate BOOL vars
2. Every ":=" must have ";" on the SAME line
3. Every IF must have exactly one matching END_IF
4. Count all "(" and ")" — must be equal within each statement
5. Declare ALL intermediate variables in VAR block as BOOL
6. FOR loops: control variable (e.g. i, j, idx) MUST be declared in VAR as INT or DINT
```

### RAG System (OSCAT Function Block Retrieval)

| Component | Technology | Details |
|-----------|------------|---------|
| Vector DB | LanceDB v0.30 | Local persistent `.lance-data/` directory |
| Embedding Model | `text-embedding-004` | 768 dimensions, Vertex AI |
| Embedding Auth | `GOOGLE_VERTEX_API_KEY` + `x-goog-api-key` header | Google Cloud API key restricted to `aiplatform.googleapis.com` |
| Embedding Endpoint | Vertex AI Predict REST | `aiplatform.googleapis.com/v1/projects/{project}/locations/{location}/publishers/google/models/text-embedding-004:predict` |
| Batch Size | 32 | Conservative to stay under Vertex QPM quota; auto-retries on 429 with 30s backoff |
| Corpus | 547 OSCAT + 1143 AutoPLC + 68 seed | OSCAT parsed from 21 `plc.st` files; AutoPLC from `autoplc-corpus.jsonl`; seed from `seed-corpus.jsonl` (26 MatIEC-validated + 42 Siemens SCL real-world patterns, all Gemini-described) |
| Index Type | IVF_PQ (16 partitions, 16 sub-vectors) | Falls back to flat scan for <256 records |
| Search API | `searchFBs(query, {topK, category, library})` | Semantic similarity search |
| Autocomplete | `searchForAutocomplete(prefix, {topK})` | Compact signatures for editor |

Implementation: `app/lib/rag/lanceIndex.ts`

#### RAG Seed Corpus Pipeline (`scripts/build-rag-corpus.ts`) ★ v3.5.3

Standalone script that builds `app/lib/rag/seed-corpus.jsonl` — a second corpus of real-world, MatIEC-validated PLC programs with AI-generated descriptions. Loaded by `initOscatRAG()` alongside OSCAT and AutoPLC.

**Sources scanned:**

| Source | Status | Files | Notes |
|--------|--------|-------|-------|
| OpenPLC_Editor-master | Already cloned | — | IDE source; no .st files |
| OpenPLC_v3-master | Already cloned | 2 | Runtime programs |
| oscat/ | Already cloned | 42 | OSCAT BASIC 3.33 + BUILDING 1.00 FBs |
| editor-d18889…/ | Already cloned | 3 | Blink examples |
| OpenPLC_Tutorials | Cloned on first run | 10 | virajdesai0309/OpenPLC_Tutorials |
| Agents4PLC_release | Cloned on first run | 7 | Luoji-zju/Agents4PLC_release benchmark |
| awesome-structured-text | Cloned on first run | 0 | README-only collection |

**Pipeline stages:**

1. **Clone** — `git clone --depth 1` for missing repos; skips already-present dirs
2. **Scan** — Recursive `.st`/`.scl` file scan; skips `node_modules`, `.git`, `.venv`
3. **Extract** — Regex extraction of `PROGRAM`, `FUNCTION_BLOCK`, `FUNCTION` blocks; strips `{{...}}` C-injection blocks; requires >20 chars of actual logic beyond VAR declarations
4. **Dedup** — Cross-checks against `autoplc-corpus.jsonl` (1143 entries) and existing `seed-corpus.jsonl` by `name::library` and `name::*` keys
5. **MatIEC validation** — `docker exec matiec-validator curl -X POST http://localhost:4001/validate` with stdin piping; tempfile fallback if stdin not supported; 6-way concurrent; 12s timeout per unit
6. **Description generation** — Gemini 2.5-flash via Vertex AI OAuth2 (RS256 JWT from service account JSON); 25-word max description focused on what the program controls and how; 3-way concurrent; retries on 429 with 5/10/20s backoff; heuristic fallback if Gemini unavailable
7. **Write** — Appends to `seed-corpus.jsonl` in same format as `autoplc-corpus.jsonl` plus `patternTags[]` and `source` fields
8. **Patch index** — Updates `app/lib/rag/index.ts` to include `seedDocs` in merged array
9. **Clear LanceDB** — Deletes `.lance-data/` so next `pnpm dev` triggers full re-embedding

**Checkpoint/resume:** Every validated unit (pass or fail) is appended to `scripts/.rag-seed-checkpoint.jsonl`. Re-running the script loads the checkpoint and skips already-validated units — only new files are processed.

**Auth:** Same RS256 JWT → token exchange pattern used in `verify-pipeline-e2e.ts`. Service account key at `../videogen-496506-ed4ee8f8ddda.json` (one level above volt.diy) or `GOOGLE_SERVICE_ACCOUNT_KEY_FILE` env var.

**Run:**
```bash
cd volt.diy && npx tsx scripts/build-rag-corpus.ts
# Re-run anytime new repos or .st files are added — checkpoint ensures only new work runs
```

**Why not use the existing autoplc-corpus vendor files?** The 764 CODESYS ST + 167 Siemens SCL vendor case files are already in `autoplc-corpus.jsonl`. The seed pipeline explicitly deduplicates against that corpus — only genuinely new programs (OpenPLC tutorials, Agents4PLC benchmarks, OSCAT function blocks not in the original 547) are added.

**Why not `@ai-sdk/google` for embeddings?** The SDK's `textEmbeddingModel()` routes to `generativelanguage.googleapis.com` (Gemini API / AI Studio billing). The Vertex AI key (`GOOGLE_VERTEX_API_KEY`) is restricted to `aiplatform.googleapis.com` and cannot call the Gemini API endpoint. The Vertex Predict REST API (`/models/text-embedding-004:predict`) accepts the same API key and returns identical 768-dim vectors.

### Model Selection Propagation

When a user changes their model in the UI header, the selection propagates to all AI subsystems:

| Subsystem | Mechanism |
|-----------|-----------|
| Chat streaming | `[Model: X]\n\n[Provider: Y]` tags injected in message text → extracted server-side |
| Create-summary | `extractPropertiesFromMessage()` from last user message |
| Select-context | Same extraction pattern |
| Prompt enhancer | `model`/`provider` sent in request body |
| AI completions (CodeMirror) | Reads `selectedModel`/`selectedProvider` cookies |
| P&ID vision pipeline | Optional override, defaults to `gemini-2.5-pro` (multimodal required) |
| RAG embeddings | Fixed `text-embedding-004` via Vertex AI REST (model-agnostic, not user-selectable) |

Storage: `selectedModel` and `selectedProvider` cookies (30-day expiry).  
Fallback: `DEFAULT_MODEL = 'gemini-3.5-flash'` in `app/utils/constants.ts`.

---

## Canonical Logic Model (CLM)

The CLM is the core abstraction of volt.diy — a vendor-neutral graph representation of any IEC 61131-3 program that acts as the single source of truth for all downstream operations.

### Architecture

```
ST Source Files (.st)
        │
        ▼ stToCLM()  [autoSync: 500ms debounce after file changes]
        │
CLM Project (in-memory + nanostores)
├── Configuration
│   ├── Resources []
│   └── Tasks []
├── POUs (Program Organization Units) []
│   ├── PROGRAM / FUNCTION_BLOCK / FUNCTION
│   ├── Variables [] (IECVariable: name, type, class, qualifier)
│   ├── Rungs []
│   └── Nodes [] (CLMNode)
└── User Types []

        │
        ▼ buildGraphFromPOU()  [Graphology DirectedGraph]
        │
CLMGraph (per-POU directed graph)
├── Nodes: CLMContactNode, CLMCoilNode, CLMFBNode, CLMAssignmentNode…
├── Edges: rung-flow, branch, merge, data-flow
└── Computed: reachability, cycles, unused variables, execution order

        │
        ▼ clmPropertySynthesizer.ts  ★ NEW
        │
PropertySet (ESBMC YAML properties)
├── Safety: no-undefined-output, bounded-counter, no-div-by-zero
├── Liveness: timer-terminates, sequence-completes
└── Invariant: output-coil-stability
```

### CLM Node Types (`app/lib/plc/clm/types.ts`)

| Node Kind | Description |
|-----------|-------------|
| `contact` | NO/NC/P-transition/N-transition contact |
| `coil` | Normal/Set/Reset/Not coil |
| `functionBlock` | TON/TOF/CTU/custom FB instance |
| `function` | IEC standard or user function call |
| `branch` | Parallel OR branch start |
| `merge` | Parallel OR branch end |
| `jump` | JUMP to label |
| `return` | RETURN from POU |
| `assignment` | Variable := expression |
| `comparison` | Comparison in IF condition |
| `arithmetic` | Math operation node |
| `move` | MOV instruction |
| `typeConvert` | Type casting |
| `sfcStep` | SFC step node |
| `sfcTransition` | SFC transition condition |
| `sfcAction` | SFC action (N/R/S/L/D/P qualifiers) |

### CLM Validator (`app/lib/plc/clm/validator.ts`)

916 lines of IEC 61131-3 semantic validation organized into passes:

1. **Reference Integrity** — All `linkedTag` references resolve to declared variables
2. **Type Compatibility** — BOOL contacts on BOOL tags, REAL on REAL, etc. — full IEC type matrix
3. **Execution Safety** — No unreachable nodes, no unconnected coils
4. **Vendor Constraints** — Checks against the current target vendor profile (e.g., Rockwell doesn't support REAL in certain contexts)
5. **SFC Semantics** — Step/transition connectivity, action qualifier legality
6. **Function Block** — All required input ports connected, output port types match

### CLM Store Atoms (`app/lib/plc/clm/store.ts`)

| Atom | Type | Description |
|------|------|-------------|
| `clmProject` | `CLMProject \| null` | Full CLM graph in memory |
| `clmActivePOU` | `string \| null` | Currently selected POU name |
| `clmValidation` | `CLMValidationResult` | Errors + warnings from validator |
| `clmTargetVendor` | `string` | Target platform for export |
| `clmGraphStats` | `CLMGraphStats` | Node/edge/rung counts |
| `clmValidating` | `boolean` | Validation in-progress flag |
| `clmIsValid` | `boolean \| null` | null=no project, true=valid, false=has errors |
| `clmActivePOUData` | `CLMPOU \| null` | Computed: full POU data |
| `clmDiagnosticCounts` | `{errors, warnings, info}` | Computed: diagnostic summary |

Undo/redo stack: up to 50 project snapshots, `undo()` / `redo()` / `canUndo` / `canRedo` exported.

---

## Formal Verification Stack (Phases 1–7)

All seven phases implement the **VOLT_DIY_VERIFICATION_IMPLEMENTATION.md** spec. Together they form a complete formal verification pipeline that runs automatically whenever the AI writes a `.st` file.

```
AI generates .st file
        │
        ▼ workbench.ts — .st file write hook  ★ Phase 7
        │
        ▼ multiAgentPipeline.ts — runMultiAgentPipeline()
        │
Stage 1: LLM Generation  ──→  GenerationResultSchema (ST code + ladder JSON + HMI JSON)
        │                       (4-strategy fallback parser: fenced JSON, bare JSON, fenced ST, bare ST)
Stage 2: CLM Property Synthesis  ──→  PropertySet (YAML)  ★ Phase 2
        │
Stage 3: ESBMC-PLC+ Verification  ──→  VerificationResult[]  ★ Phase 3
        │
Stage 4: Export Gate  ──→  pipelineState.overallStatus = 'proved' | 'violated'  ★ Phase 7
        │
        ▼ VerifyTrustDashboard  (live UI)  ★ Phase 5
        │
        ▼ FAT Evidence Package PDF  ★ Phase 6
```

### Phase 1: OpenPLC Runtime v4

**Files:** `app/lib/plc/openplcClient.ts`, `app/lib/plc/openplcStore.ts`, `app/components/workbench/OpenPLCRuntimePanel.client.tsx`

#### OpenPLC Runtime Client (`openplcClient.ts`)

Full pipeline: `login → STruC++ codegen → upload ZIP → poll compile → start → Socket.IO debug stream`

| API | Method | Description |
|-----|--------|-------------|
| Auth | `POST /api/login` | JWT access_token |
| Upload | `POST /api/upload-file` | multipart/form-data program.zip |
| Compile status | `GET /api/compilation-status` | IDLE/COMPILING/SUCCESS/FAILED |
| Start | `GET /api/start-plc` | Returns `{status:"START:OK"}` |
| Stop | `GET /api/stop-plc` | Returns `{status:"STOP:OK"}` |
| Version | `GET /api/version` | `{version:"v4.1.7"}` |
| Debug | Socket.IO `/api/debug` namespace | auth:{token}, debug_command ↔ debug_response |

**STruC++ codegen microservice (port 4006):**
- `POST /generate` — `{st_code, program_name?, cycle_ms?}` → `application/zip`
- `POST /validate` — `{st_code}` → `{success, errors}`
- `GET /health`

**Browser-compatible EventEmitter:** `openplcClient.ts` includes an inline browser-compatible `EventEmitter` class (replacing the Node.js `events` import) with `Map<string, Array<(...args: any[]) => void>>` listeners. This avoids the "Module 'events' has been externalized for browser compatibility" Vite crash.

**Debug protocol (binary):**
- `buildGetListCommand(indexes)` — builds hex `0x44` + LE16 count + LE16[] indexes
- `parseGetListResponse(hex, tagMap)` — decodes BOOL (1 byte), INT/WORD (2 bytes), DINT/REAL (4 bytes)
- `forceTag(tagName, value)` — sends `0x42` + LE16 index + typed value bytes
- `releaseTag(tagName)` — forces to 0/false

**Full pipeline method:** `runProgram(stCode, programName, tags?)` chains all steps.

#### OpenPLC Runtime Panel (`OpenPLCRuntimePanel.client.tsx`)

- Status display: `STATUS_LABEL` map — `{ uploading: 'UPLOADING (1/3)', compiling: 'COMPILING (2/3)', ... }`
- Fetch error handling: `isFetchError(err)` — amber info box showing Docker start command and TypeScript fallback note, plus "Retry connection" button
- Run button label progression: "Uploading… (step 1/3)" → "Compiling… (step 2/3)" → "Starting PLC"
- Live tag monitor: shows Socket.IO debug stream data in real time

---

### Phase 2: CLM Property Synthesizer

**File:** `app/lib/verification/clmPropertySynthesizer.ts` ★ REWRITTEN v3.5.6

Traverses the CLM graph using Graphology to synthesize formal ESBMC-PLC+ properties without requiring natural language.

#### API

```typescript
class CLMPropertySynthesizer {
  synthesize(programName: string, clmVersion: string): PropertySet
  toYAML(propertySet: PropertySet): string   // key: "program" (not "programName")
}
```

**Node attribute shape (from `graphBuilder`):**
```typescript
interface GraphNodeAttrs {
  node: CLMNode;     // the actual CLM node (kind, variable, typeName, etc.)
  rungIndex: number;
  depth: number;
  reachable: boolean;
}
```

The synthesizer reads `attrs.node.kind` to branch per node type — NOT `attrs.type` (which was the old broken approach that always returned 0 properties).

#### Synthesis Methods

| Method | Node kinds | Properties emitted |
|--------|------------|--------------------|
| `synthesizeCoilMutualExclusion()` | `coil` | `mutual_exclusion` when multiple normal coils drive same variable; `mutual_exclusion` (safety-critical) when negated+normal coil both target same variable |
| `synthesizeContactSafetyInvariants()` | `contact` (NO/P variants) | `invariant`: downstream coil active IMPLIES contact variable TRUE; `safety-critical` severity if variable name matches e-stop/safety/interlock/guard |
| `synthesizeFunctionBlockProperties()` | `functionBlock` | TON/TOF/TONR → PT>0 `invariant`; CTU/CTD/CTUD → Q `reachability`; R_TRIG/F_TRIG → CLK→Q `response` within 1 scan cycle |
| `synthesizeAssignmentInvariants()` | `assignment` | `invariant` (safety-critical) when target variable name matches e-stop/emergency/safety/interlock/fault/alarm/error |
| `synthesizeComparisonProperties()` | `comparison` | `absence` when either operand matches limit/max/min/high/low/trip/setpoint/sp/pv |
| `synthesizeSFCProperties()` | `sfcStep`, `sfcTransition` | `reachability` per step (safety-critical for initial step); `response` per transition (within 100 cycles) |

#### Property Types (`app/lib/verification/types.ts`)

```typescript
type PropertyKind = 'mutual_exclusion' | 'invariant' | 'absence' | 'response' | 'reachability';

interface VerificationProperty {
  id: string;           // e.g. "COIL_CONFLICT_001", "FB_TIMER_002"
  kind: PropertyKind;
  description: string;
  expression: string;   // ESBMC-PLC+ expression (for all kinds except 'response')
  trigger?: string;     // 'response' only — the trigger condition
  response?: string;    // 'response' only — the required response condition
  withinCycles?: number;
  clmSource: {
    nodeId: string;
    nodeType: 'interlock' | 'permissive' | 'sequence' | 'device' | 'alarm' |
              'coil' | 'contact' | 'functionBlock' | 'assignment' | 'comparison';
    description: string;
  };
  severity: 'safety-critical' | 'operational' | 'informational';
}
```

**Manually verified output** (DualPumpWaterLevel ST, 14 nodes): 6 properties synthesized —
- 2 × `FB_TIMER` (TON timers for pump1/pump2)
- 1 × `FB_COUNTER` (CTU counter)
- 1 × `FB_EDGE` (R_TRIG edge detector — response property with CLK→Q within 1 cycle)
- 2 × `ASSIGN_SAFETY` (FAULT_ALARM assignment invariants, safety-critical)

#### Property Types (`app/lib/verification/types.ts`)

```typescript
interface VerificationProperty {
  id: string;
  kind: PropertyKind;           // 'safety' | 'liveness' | 'invariant' | 'reachability'
  description: string;
  formula: string;              // ESBMC property formula
  targetPOU: string;
  targetNode?: string;
}

interface PropertySet {
  programName: string;
  generatedAt: string;          // ISO timestamp
  clmVersion: string;
  properties: VerificationProperty[];
}

interface VerificationResult {
  propertyId: string;
  status: 'proved' | 'violated' | 'unknown' | 'timeout';
  k?: number;                   // k-induction depth
  durationMs: number;
  counterexample?: CounterexampleTrace;
}

interface CounterexampleTrace {
  cycles: CounterexampleCycle[];   // Note: "cycles" not "steps"
  explanation?: string;
  violatingRungs?: string[];
}
```

---

### Phase 3: ESBMC-PLC+ Verifier

**Docker:** `docker/esbmc-plc/`  
**Client:** `app/lib/verification/esbmcClient.ts`  
**Port:** 4004

#### Docker Service

```dockerfile
FROM --platform=linux/amd64 ubuntu:24.04
# Installs ESBMC 8.3.0, Z3 4.12, Python 3, Flask
```

- `server.py` — `POST /verify`, `GET /health`
- `esbmc_runner.py` — Direct ST→C model translation (bypasses MatIEC); k-induction with Z3 solver; parses ESBMC counterexample traces into structured JSON

#### HTTP API

```
POST /verify
  Body: { st_code: string, properties: VerificationProperty[], k?: number }
  Response: { results: VerificationResult[], durationMs: number }

GET /health
  Response: { status: "healthy", esbmc_version: "8.3.0" }
```

#### ESBMC Client (`esbmcClient.ts`)

```typescript
class ESBMCClient {
  async verify(stCode: string, properties: VerificationProperty[]): Promise<VerificationResult[]>
  async health(): Promise<boolean>
}
```

---

### Phase 4: Multi-Agent Pipeline

**Pipeline:** `app/lib/ai/multiAgentPipeline.ts`

#### Multi-Agent Pipeline (`multiAgentPipeline.ts`)

4-stage pipeline with Zod schema validation at every stage:

```typescript
export async function runMultiAgentPipeline(
  stCode: string,
  programName: string,
  llmCallable: LLMCallable,
): Promise<void>
```

**Stage descriptions:**

| Stage | Name | Input | Output | Key action |
|-------|------|-------|--------|------------|
| 1 | Generate | User prompt | `GenerationResultSchema` | LLM generates ST + ladder JSON + HMI JSON |
| 2 | CLM Synthesis | ST + CLM | `PropertySet` | `CLMPropertySynthesizer.synthesize()` → YAML |
| 3 | ESBMC Verify | ST + PropertySet | `VerificationResult[]` | POST `/verify` to esbmc-plc-verifier |
| 4 | Export Gate | VerificationResults | `overallStatus` | `'proved'` if all passed, `'violated'` if any failed |

**pipelineState atom:**

```typescript
export const pipelineState = atom<PipelineState>({
  stages: [],
  currentStage: 0,
  overallStatus: 'idle',   // 'idle' | 'running' | 'proved' | 'violated' | 'error'
  generatedST?: string,
  verificationResults?: VerificationResult[],
  counterexamples?: CounterexampleTrace[],
  propertySet?: PropertySet,
  iteration: number,
})
```

**LLM response parser** (`parseGenerationResult`): 4-strategy fallback:
1. JSON in fenced ` ```json ``` ` block
2. Any `{...}` object in stripped text
3. `PROGRAM...END_PROGRAM` in fenced block → wraps in `{stCode: ...}` 
4. Bare `PROGRAM...END_PROGRAM` anywhere in text

---

### Phase 5: VerifyTrust Dashboard

**File:** `app/components/workbench/VerifyTrustDashboard.client.tsx` (563 lines)

#### Components

| Component | Description |
|-----------|-------------|
| `StageRow` | Single pipeline stage with status icon + elapsed time |
| `VerificationTable` | `@tanstack/react-table` table of all properties + proved/violated/unknown badges |
| `CounterexampleVisualizer` | Renders `CounterexampleTrace.cycles[]` as a timeline with variable values per scan cycle |
| `StatusBadge` | Color-coded badge: green (proved), red (violated), yellow (unknown/timeout), blue (running) |
| Export Gate panel | Amber warning when `overallStatus === 'violated'`; enables evidence download otherwise |

#### Props

```typescript
interface VerifyTrustDashboardProps {
  onDownloadEvidence?: () => void;
  onRequestFix?: (violationId: string) => void;
}
```

#### Data binding

Uses `useStore(pipelineState)` from nanostores for live updates without prop drilling.

#### Phosphor icons used

`CheckCircle`, `XCircle`, `Clock`, `ArrowClockwise`, `DownloadSimple`, `Warning`, `ShieldCheck`

---

### Phase 6: FAT Evidence Package Generator

**File:** `app/lib/verification/fatEvidencePackage.ts`

Generates a multi-section PDF that can be submitted as part of a Factory Acceptance Test package or safety case file.

#### API

```typescript
interface EvidencePackageInput {
  programName: string;
  programVersion: string;
  generatedAt: string;
  generatedBy: string;
  pipelineState: PipelineState;
  propertySet?: PropertySet;
  verificationResults?: VerificationResult[];
  stCode?: string;
  openPlcExecutionLog?: string;     // optional
  roundTripScores?: RoundTripScore[];  // optional
  clmVersion?: string;
}

async function generateFATEvidencePackage(input: EvidencePackageInput): Promise<Blob>

async function downloadEvidencePackage(programName?: string): Promise<void>
// reads pipelineState atom, builds input, calls generateFATEvidencePackage,
// triggers <a> download
```

#### PDF Sections (8 sections)

| Section | Content |
|---------|---------|
| 1. Cover Page | Program name/version, generated date/by, verification status badge |
| 2. Pipeline Summary | Stage table with status, elapsed time, iteration count |
| 3. Formal Verification | Per-property table: ID, kind, formula, status, k-depth, duration |
| 4. Property Specifications | Full YAML property set from CLM synthesizer |
| 5. ST Source Code | Full program source with line numbers |
| 6. Counterexamples | (conditional) Cycle-by-cycle trace for each violated property |
| 8. OpenPLC Execution Log | (conditional) Runtime output from OpenPLC v4 |
| Appendix A | Round-trip scores per vendor (conditional) |

---

### Phase 7: Workbench Wiring & Deploy Gate

**Files modified:** `app/lib/stores/workbench.ts`, `app/components/workbench/Workbench.client.tsx`

#### Auto-trigger on `.st` file write (`workbench.ts`) ★ UPDATED v3.5.6

```typescript
// In the .st file write hook (and runVerification()):
if (!isStreaming) {
  await this.#syncCLMThenPipeline(fullPath, data.action.content);
}
```

**`#syncCLMThenPipeline(filePath, stCode)` — CLM-first pipeline trigger:**

Replaced the direct `#triggerVerificationPipeline` call with a three-step method that ensures the CLM store is always populated before the pipeline reads it:

```typescript
async #syncCLMThenPipeline(filePath: string, stCode: string): Promise<void> {
  // Step 1: Immediate regex parse → CLM store populated synchronously
  try {
    const syncProject = stToCLM(stCode, 'volt_project');
    setProject(syncProject, 'Pre-pipeline sync (regex)');
  } catch (e) {
    console.warn('[CLM] Sync parse failed, pipeline will proceed without CLM:', e);
  }
  // Step 2: Fire the pipeline — CLM store is now ready
  this.#triggerVerificationPipeline(filePath, stCode);
  // Step 3: Tree-sitter async upgrade in background (more accurate parse)
  try {
    await initTreeSitterParser();
    const asyncProject = await stToCLMAsync(stCode, 'volt_project');
    setProject(asyncProject, 'Pre-pipeline sync (tree-sitter)');
  } catch {
    // WASM unavailable — regex result from step 1 is sufficient
  }
}
```

**Why this was needed:** The old `initCLMAutoSync` had a 500ms debounce after file saves. The pipeline fired immediately via `#triggerVerificationPipeline`, so `CLMPropertySynthesizer.synthesize()` ran before `clmProject` was populated — causing the Verify tab to always show "No CLM project loaded — skipping". The new approach synchronously calls `stToCLM` (regex parser, no async) and `setProject` before firing the pipeline, eliminating the race.

`#triggerVerificationPipeline(filePath, stCode)`:
1. Re-entrance guard (`#pipelineRunning` flag)
2. Extracts program name from file path
3. Builds LLM callable using `POST /api/chat` with Vercel AI SDK stream parsing
4. Calls `runMultiAgentPipeline(stCode, programName, llmCallable)`

Public method `resetPipelineGuard()` clears the re-entrance flag (exposed for testing).

#### Workbench.client.tsx wiring

```typescript
const pipeline = useStore(pipelineState);
const pipelineViolations = pipeline.verificationResults?.filter(r => r.status === 'violated') ?? [];
const pipelineBlocksExport = pipeline.overallStatus === 'violated';

const handleDownloadEvidence = useCallback(async () => {
  try {
    await downloadEvidencePackage(/* programName */);
    toast.success('Evidence package downloaded');
  } catch (e) {
    toast.error('Failed to generate evidence package');
  }
}, []);
```

- `<VerifyTrustDashboard onDownloadEvidence={handleDownloadEvidence} />` — rendered with `min-h-0 overflow-hidden`
- Deploy tab: red banner `"Formal verification found violations — export blocked"` when `pipelineBlocksExport === true`
- **Sync button removed** — the "Sync" / cloud-download button that previously appeared in the workbench top bar has been removed (`Workbench.client.tsx` ★ v3.5.6)

#### Deploy gate logic (three conditions)

Export is blocked when **any** of:
1. `compiler.errors.some(e => e.severity === 'error')` — MatIEC compilation failed
2. `clmIsValid === false` — CLM graph has semantic errors
3. `pipelineBlocksExport === true` — ESBMC found violated safety properties

---

## PLC Programming Engine

### IEC 61131-3 Data Types

| Type | Description | Example |
|------|-------------|---------|
| `BOOL` | Boolean (TRUE/FALSE) | Digital I/O |
| `INT` | 16-bit signed integer | Counter values |
| `DINT` | 32-bit signed integer | Large counters, FOR loop vars |
| `REAL` | 32-bit float | Temperature, pressure, 4-20mA |
| `TIME` | Duration (T#5s, T#100ms) | Timer presets |
| `STRING` | Character string | Labels, messages |
| `WORD` | 16-bit unsigned | Analog raw values |

### Standard Function Blocks (`app/lib/plc/functionBlocks.ts`)

| Block | Inputs | Outputs | State |
|-------|--------|---------|-------|
| **TON** | IN, PT | Q, ET | Accumulates elapsed time |
| **TOF** | IN, PT | Q, ET | Delays de-energize |
| **TP** | IN, PT | Q, ET | Fixed-duration pulse |
| **CTU** | CU, R, PV | Q, CV | Count-up, reset on R |
| **CTD** | CD, LD, PV | Q, CV | Count-down, load on LD |
| **CTUD** | CU, CD, R, LD, PV | QU, QD, CV | Bidirectional counter |
| **R_TRIG** | CLK | Q | Rising edge, 1 scan pulse |
| **F_TRIG** | CLK | Q | Falling edge, 1 scan pulse |
| **SR** | S1, R | Q1 | Set-dominant SR flip-flop |
| **RS** | S, R1 | Q1 | Reset-dominant RS flip-flop |

All function blocks maintain state across scan cycles. State is reset only on `resetScan()`.

---

## Workbench Tabs & Views

The workbench provides 13 distinct views:

| Tab | Component | Description |
|-----|-----------|-------------|
| **Code** | `EditorPanel.tsx` | CodeMirror + file tree + compiler console |
| **Diff** | `DiffView.tsx` | Side-by-side file comparison |
| **Preview** | `PLCPreview.client.tsx` | Ladder diagram + tag monitor + scan controls |
| **Simulation** | `HMICanvas.client.tsx` | ReactFlow SCADA HMI with physics engine |
| **I/O Studio** | `IOStudio.client.tsx` | Tag database + CSV import + module config |
| **Verify** | `VerifyTrustDashboard.client.tsx` ★ | Multi-agent pipeline status + formal results + evidence download |
| **FAT** | `FATVerification.client.tsx` | FAT test execution + punch list |
| **Round-Trip** | `RoundTripPanel.client.tsx` | CLM→Export→Re-import consistency per vendor |
| **Deploy** | `DeployExport.client.tsx` | Triple-gated vendor export wizard |
| **CLM Graph** | `CLMGraphView.client.tsx` | Graphology-based POU/rung visualization |
| **SFC** | `SFCEditor` | Sequential Function Chart editor |
| **OpenPLC** | `OpenPLCRuntimePanel.client.tsx` ★ | Real hardware: upload, compile, run, debug stream |
| **Migration** | `MigrationWizard` | Cross-vendor import/migrate |

---

## Compiler & Validation Pipeline

### Three-Gate Quality Pipeline (`app/lib/validators/quality-pipeline.ts`)

```
Gate 1: IEC 61131-3 Syntax & Type Check  (browser-native, always runs)
    ├─ Keyword recognition, block balancing, timer/counter call form
    ├─ Type compatibility matrix (BOOL ↔ BOOL, REAL ↔ REAL)
    └─ Safety checks (NC contact convention, E-stop polarity)

Gate 2: Safety Validation (IEC 62061)  (derived from Gate 1 analysis)
    ├─ E-stop implemented as NC (de-energize-to-trip)
    ├─ Watchdog timer present in safety programs
    └─ Forced outputs properly documented

Gate 3: OSCAT Library Reference  (always passes, advisory only)
    ├─ Detects PID/ramp/scale/motor/valve/alarm patterns in code
    └─ Suggests relevant OSCAT function blocks from 500+ block database
```

### MatIEC Compiler Service (`docker/matiec-validator/`)

- **Port:** 4001 | **Technology:** Node.js + Express + iec2c binary
- `GET /health` — checks iec2c binary availability
- `POST /validate` — writes temp file, runs `iec2c -I <lib> -T <tmpdir>`, parses errors
- **Error formats handled:** with/without column, range format (`6-4..6-9`, `6:4..6:9`, `6:`)
- **Glue check:** Parses `LOCATED_VARIABLES.h` against user tag list

---

## Simulation Engine

### Scan Cycle Architecture (`app/lib/plc/scanEngine.ts`)

```
Tick (every 50ms, configurable)
│
├─ Phase A: Input Snapshot — copy forced tag values into input image
│
├─ Phase B: Program Execution (deterministic)
│   ├─ Evaluate rungs left-to-right, top-to-bottom
│   ├─ Contact evaluation: read tag value → return power state
│   ├─ Coil evaluation: write computed power to output tag
│   ├─ Branch evaluation: OR all parallel paths
│   └─ Function block evaluation (with state persistence)
│
└─ Phase C: Output Write — copy output image to tag store → React re-renders
```

---

## HMI Simulation System (v2 — ReactFlow + ELK)

The HMI system was completely rewritten from a DOM-based inline SVG approach to a **ReactFlow (@xyflow/react)** graph with **ELK.js** auto-layout, custom skeuomorphic component nodes, physics simulation, and a Zod-validated AI output pipeline.

### Architecture

```
hmi/scene.json (AI-generated, HMISceneSpec format)
        │
        ▼ Scene Validator (sceneValidator.ts)
        │   ├─ JSON parse
        │   ├─ Zod schema validation (components, connections)
        │   ├─ Component type validation (against registry)
        │   ├─ Connection reference validation (no dangling)
        │   ├─ Orphan detection
        │   ├─ Auto-remove redundant pushbuttons (all START/STOP except E-STOP)
        │   └─ Connection type compatibility check
        │
        ▼ hmiStore (nanostores)
        │   ├─ hmiSpec: atom<HMISceneSpec | null>
        │   ├─ hmiNodes: atom<HMINode[]>  (ReactFlow nodes)
        │   ├─ hmiEdges: atom<HMIEdge[]>  (ReactFlow edges)
        │   └─ hmiTagValues: map<Record<string, boolean|number|string>>
        │
        ▼ ELK Layout Engine (elkLayout.ts)
        │   ├─ ELK layered algorithm (stress for non-LR)
        │   ├─ Port-based edge routing (FIXED_POS)
        │   ├─ Grid-to-pixel mapping (row/col → x/y)
        │   └─ Orthogonal edge routing with rounded bends
        │
        ▼ HMICanvas.client.tsx (ReactFlow canvas)
        │   ├─ Custom node types (18 skeuomorphic SVG components)
        │   ├─ Custom edge type (animated pipe/signal)
        │   ├─ onToggle injection for interactive components
        │   ├─ Physics engine integration (100ms tick loop)
        │   └─ Live tag value binding (tagValues → node data)
        │
        ▼ Physics Engine (hmiPhysicsEngine.ts)
            ├─ Fluid flow propagation (pump → valve → tank)
            ├─ Tank level accumulation (Qin × Δt)
            ├─ Gravity drain (tank → valve → downstream)
            ├─ Conveyor belt activation (self-driven + VFD speed)
            ├─ Sensor value reflection (level, pressure, temp, flow)
            ├─ Indicator/alarm state derivation
            ├─ VFD ↔ motor speed synchronization
            └─ Pushbutton momentary auto-reset (500ms)
```

### Custom Node Components (`app/components/hmi/nodes/`)

18 skeuomorphic SVG component nodes with industrial-grade visuals:

| Node | File | Visual | Interactive |
|------|------|--------|-------------|
| Pump/Centrifugal | `PumpNode.tsx` | Circular impeller body | Built-in RUN/STOP |
| Motor | `MotorNode.tsx` | Rotor with current display | Built-in RUN/STOP |
| Tank | `TankNode.tsx` | Glass gauge with liquid level fill | Passive (fills from flow) |
| Reactor Vessel | `ReactorNode.tsx` | Conical vessel with level | Passive |
| Valve/Gate/Ball | `ValveNode.tsx` | Butterfly/gate body | Toggle ON/OFF |
| Control Valve | `ControlValveNode.tsx` | Dual-triangle with actuator | Slider 0-100% |
| Conveyor Belt | `ConveyorNode.tsx` | Belt with CSS @keyframes animation | Built-in RUN/STOP |
| Compressor/Blower | `CompressorNode.tsx` | Volute casing with impeller | Built-in RUN/STOP |
| VFD Drive | `VFDNode.tsx` | LCD display with Hz bars | Slider 0-100Hz |
| Sensor (all types) | `SensorNode.tsx` | Circular gauge with live value | Read-only |
| Indicator Light | `IndicatorNode.tsx` | LED glow | Read-only |
| Pushbutton | `PushbuttonNode.tsx` | Green/Red button | Click toggle |
| Hopper | `HopperNode.tsx` | Trapezoidal hopper | Passive |
| Conic Tank | `ConicTankNode.tsx` | Cone vessel | Passive |
| Panel/Zone | `PanelNode.tsx` / `ZoneNode.tsx` | Grouping containers | None |
| Level Panel | `PanelNode.tsx` | Bar graph display | Read-only |
| Tap/Join | `TapNode.tsx` / `JoinNode.tsx` | Pipe routing helpers | None |

### Component Registry (`app/lib/hmi/componentRegistry.ts`)

29 registered components with full specifications:

```typescript
interface ComponentSpec {
  id: string;                    // e.g. 'centrifugal_pump'
  name: string;                  // e.g. 'Centrifugal Pump'
  category: string;              // 'actuator' | 'process' | 'sensor' | 'control' | 'indicator'
  domain: PhysicsDomain;         // FLUID_DYNAMICS, ELECTRICAL, etc.
  role: ComponentRole;           // FLOW_GENERATOR, FLOW_CONTROLLER, etc.
  width: number;
  height: number;
  ports: PortDef[];              // { port_id, type, side, x_offset, y_offset }
  animation: AnimationType;      // ROTATION, BELT_MOVE, PROGRESS_FILL, etc.
  physics: PhysicsDomain;
  has_builtin_controls: boolean; // If true, no external pushbuttons needed
  compatible_connections: string[];
}
```

Exports: `getComponentSpec()`, `getAllComponentSpecs()`, `getValidComponentTypes()`, `hasBuiltinControls()`, `getComponentsWithBuiltinControls()`, `generateAIComponentContext()`

### Scene Validator (`app/lib/hmi/sceneValidator.ts`)

Zod-based validation + auto-fix pipeline:

| Step | Action | Auto-fix? |
|------|--------|-----------|
| 1 | JSON parse | ✗ (fatal) |
| 2 | Zod schema validation | ✗ (fatal) |
| 3 | Component type validation against registry | ✗ (warning) |
| 4 | Connection reference integrity (no dangling) | ✓ removes invalid connections |
| 5 | Orphan component detection | ✗ (warning) |
| 6 | **Redundant pushbutton removal** | ✓ deletes ALL pushbutton_start/stop except E-STOP |
| 7 | Connection type compatibility | ✗ (warning) |

**Critical rule:** ALL `pushbutton_start` and `pushbutton_stop` components are auto-deleted unless labeled as E-STOP/emergency. Every actuator has built-in RUN/STOP controls.

### Physics Engine (`app/lib/hmi/hmiPhysicsEngine.ts`)

100ms tick loop with accumulation-based physics:

| System | Logic |
|--------|-------|
| Pump → Tank fill | `tankLevel += PUMP_FLOW_RATE` per tick when pump ON and path open |
| Gravity drain | `tankLevel -= GRAVITY_DRAIN_RATE` when downstream valve open |
| Tank-to-tank transfer | Pump between tanks moves fluid from source to dest |
| Conveyor activation | Self-driven (built-in controls); VFD drives belt speed |
| Check valve | One-way flow (passes through when forward flow) |
| Control valve | Opening % affects flow rate |
| Sensors | Reflect upstream/downstream values (level, pressure, temp, flow) |
| Indicators | Follow boolean state of connected source |
| Alarms | Trigger on high tank level (>85%) or pump fault |
| VFD ↔ Motor | VFD shows 60Hz when motor running; motor speed = VFD freq |
| Pushbutton reset | Momentary buttons auto-release after 500ms |

Component type sets:
- `PUMP_TYPES`: pump, motor, centrifugal_pump, compressor, blower
- `VALVE_TYPES`: valve, control_valve, gate_valve, ball_valve, check_valve
- `TANK_TYPES`: tank, reactor_vessel, heat_exchanger, hopper, cone_vessel
- `CONVEYOR_TYPES`: conveyor_belt
- `INTERACTIVE_TYPES` (get onToggle): pump, centrifugal_pump, motor, valve, control_valve, gate_valve, ball_valve, conveyor_belt, compressor, blower, vfd_drive, pushbutton_start, pushbutton_stop, selector_switch

### HMI Scene JSON Schema (AI output format)

```json
{
  "process_name": "CIP Circuit",
  "process_description": "Clean-in-place sanitization",
  "process_direction": "LR",
  "components": [
    { "id": "pump1", "type": "centrifugal_pump", "tag": "CIP_PUMP", "group": "process", "label": "CIP Pump", "row": 1, "col": 3 }
  ],
  "connections": [
    { "id": "c1", "from": "pump1", "to": "tank1", "type": "pipe_fluid", "animated": true }
  ]
}
```

**Grid-based layout:** Components use `row`/`col` (not x/y). The ELK layout engine converts grid positions to pixel coordinates with proper spacing, port alignment, and orthogonal edge routing.

### Edge Types (Custom Pipe/Signal Rendering)

| Type | Visual |
|------|--------|
| `pipe_fluid` | 3-layer animated pipe (outer dark, inner light, green liquid dashes flowing) |
| `pipe_gas` | Same as pipe_fluid but blue color |
| `conveyor_path` | Belt-style dashed animation |
| `signal_digital` | Thin dashed line (purple active, gray inactive) |
| `signal_analog` | Same as signal_digital |
| `mechanical` | Thick solid line |
| `electrical` | Orange dashed line |
| `pneumatic` | Blue dashed line |

### AI Prompt Layout Rules

The system prompt enforces strict industrial layout conventions:

1. Primary flow path: LEFT → RIGHT on a single main row
2. Parallel paths: adjacent rows (row N and row N+1)
3. Control panel: col=0, stacked vertically
4. Sensors: same column as monitored equipment, one row above/below
5. Indicators/alarms: rightmost columns
6. VFD drives: adjacent to controlled motor (col-1)
7. Minimum 1 column gap between main-path equipment
8. No floating components — every component must have connections
9. No S-curve piping — pipes flow in one direction
10. **NEVER add pushbutton_start/pushbutton_stop** — validator auto-deletes them

---

## SFC (Sequential Function Chart) Engine

Full IEC 61131-3 Part 3 SFC semantics (961 lines total). All IEC action qualifiers: N, R, S, L, D, P, SD, DS, SL.

---

## I/O Studio

### Multi-Channel File Processing (`app/lib/plc/fileProcessingPipeline.ts`)

| Channel | Input | Processing | Output |
|---------|-------|-----------|--------|
| A | Images (PNG, JPG, P&ID) | Gemini 1.5 Pro Vision | ISA tag list, P&ID topology |
| B | PDFs (datasheets) | Text extraction | Instrument tags |
| C | CAD (DXF, DWG) | Entity parsing | Drawing labels |
| D | Spreadsheets (XLSX, CSV) | Table parsing | I/O tag database |

---

## FAT Verification System

### Architecture (`app/lib/stores/fatVerification.ts`, 745 lines)

```
FAT Test Steps (JSON script)
        │
        ▼ FATRunner.execute(steps, scanEngine)
        ├─ "set" → forceTag(name, value)
        ├─ "scan" → runNScanCycles(n)
        ├─ "assert" → compare tag value → PASS/FAIL
        ├─ "wait" → delay(ms)
        └─ "manual" → prompt user checkbox
        │
        ▼ FAT Results → PDF Report (jsPDF)
```

---

## Verify Tab & Round-Trip Testing

### Verify Tab Layout (updated for v3.0.0)

```
┌─────────────────────────────────────────────────────────────────┐
│  VerifyTrust Dashboard  ★ NEW                                   │
│  ├─ Multi-agent pipeline stages (with live status)              │
│  ├─ Formal verification results table (proved/violated/unknown) │
│  ├─ Counterexample visualizer (cycle trace)                     │
│  ├─ Export gate: blocked if violations found                    │
│  └─ [Download Evidence Package PDF] button                      │
├─────────────────────────────────────────────────────────────────┤
│  FAT Verification (top of previous Verify tab)                  │
│  ├─ Test step list with PASS/FAIL/PENDING badges                │
│  ├─ Run All / Step / Reset controls                             │
│  ├─ Punch list (A/B/C severity items)                           │
│  └─ Export PDF report                                           │
├─────────────────────────────────────────────────────────────────┤
│  Round-Trip Consistency Panel                                   │
│  ├─ [Run All] button (disabled when clmIsValid === false)       │
│  └─ Per-vendor result cards: OpenPLC, Rockwell, Siemens, CODESYS│
└─────────────────────────────────────────────────────────────────┘
```

---

## Vendor Adapters & Multi-Platform Export

All adapters implement `VendorAdapter`: `exportFromCLM(project)` + `importToCLM(code, format)`.

| Adapter | Format | Notes |
|---------|--------|-------|
| Rockwell | L5X XML | Full instruction set: BST/NXB/BND, MOV, EQU/NEQ/GEQ/GTH/LES/LEQ, ADD/SUB/MUL/DIV/MOD, JSR; canonical CLMArithmeticNode shape (inputs[], output) |
| Siemens | SCL | FUNCTION_BLOCK/FUNCTION kinds preserved; arithmetic + comparison nodes with # prefix; TON/TOF/CTU/CTD pass through unchanged |
| CODESYS | PLCOpenXML | Full TC 6.0.201 XML; all variable classes (VAR/VAR_INPUT/VAR_OUTPUT/VAR_IN_OUT/VAR_EXTERNAL/VAR_GLOBAL); initialValues, addresses, comments |
| OpenPLC | IEC ST | Header comment block stripped before import |

### Round-Trip Fidelity (v3.5.2)

Vendor adapter fidelity upgraded from ~40% to 82–90% via CLM shape fixes, parser fixes, and metric improvements.

| Vendor | Score | Key fixes |
|--------|-------|-----------|
| **OpenPLC** | 82% | Strip header comment block before `stToCLM()` parse |
| **Rockwell** | 90% | `rung.Text` fast-xml-parser plain-string fix; tokenizer for nested parens; canonical arithmetic shape |
| **Siemens** | 82% | `normalizeSCL`: FUNCTION_BLOCK/FUNCTION kinds preserved; `lastIndexOf('END_VAR')` body extraction; `mapToSiemensType` preserves timer/counter FBs |
| **CODESYS** | 82% | `parseTagValue: true` plain-string fixes for type, body, ST body; per-section variable class preservation |

**Test:** `pnpm exec tsx tests/vendor-roundtrip.test.ts` — ST fixture (OpenPLC/Siemens/CODESYS) + LD fixture (Rockwell); all pass 75% composite threshold.

### RoundTripMetrics (4-dimensional)

```typescript
interface RoundTripMetrics {
  variableFidelity:  number;  // 35% weight
  nodeFidelity:      number;  // 40% weight
  structureFidelity: number;  // 15% weight — edges by variable-ref signature
  valueFidelity:     number;  // 10% weight
}
// composite = 0.35*var + 0.40*node + 0.15*struct + 0.10*value
```

`getNodeVarRef` extended for `assignment`, `arithmetic`, `comparison` nodes. Timer/counter type changes (TON→INT) and PROGRAM→FUNCTION_BLOCK kind changes downgraded to `info` severity (expected transformations, not fidelity failures).

Per-dimension fidelity bars (Variables/Nodes/Edges/Values) shown in expanded VendorCard in `RoundTripPanel.client.tsx`.

---

## Deploy & Export

### Triple Export Gate (v3.0.0)

Export is blocked when **any** of:
1. `compiler.errors.some(e => e.severity === 'error')` — MatIEC failed
2. `clmIsValid === false` — CLM semantic errors
3. `pipelineState.overallStatus === 'violated'` — ESBMC violations ★ NEW

All three conditions display a persistent banner in the Deploy tab and disable export buttons.

### Export Types

| Export | Format | Generation |
|--------|--------|------------|
| PLC Program | `.l5x` / `.scl` / `.xml` / `.st` | Via vendor adapter from CLM |
| Structured Text | `.st` | `clmProjectToST()` from CLM |
| I/O List | `.xlsx` | XLSX from `ioTags` store |
| FAT Report | `.pdf` | jsPDF from `fatVerification` store |
| Evidence Package | `.pdf` | jsPDF 8-section formal verification PDF ★ NEW |
| Handover ZIP | `.zip` | JSZip bundling all above |

---

## API Routes (Remix)

### `/api/plc-generate` ★ NEW

Dedicated non-streaming LLM endpoint used exclusively by the multi-agent pipeline. Distinct from `/api/chat` which uses streaming for the standard chat interface.

| Parameter | Source | Description |
|-----------|--------|-------------|
| `instructions` / `system` | body | System prompt passed verbatim — no volt.diy prompt injection |
| `messages` | body | `Array<{role, content}>` — filtered to user/assistant only by caller |
| `model` | body → cookie → default | LLM model name |
| `provider` | body → cookie → default | Provider name |
| `apiKeys` | body | User-supplied API keys object |

**Behavior:**
- Uses `generateText()` (Vercel AI SDK) — synchronous, non-streaming
- `temperature: 0` for non-Gemini models — deterministic output for code generation
- Gemini models: temperature NOT set; uses `providerOptions.google.thinkingConfig: { thinkingLevel: 'medium', includeThoughts: true }` instead
- `maxOutputTokens: 32768`
- Returns `{ text: string, reasoning?: string, finishReason: string }`
- Model resolution fallback chain: request body → `selectedModel` cookie → `DEFAULT_MODEL`

**Why separate from `/api/chat`:**  
`/api/chat` injects the full volt.diy system prompt (industrial automation rules, file output format). Agents need to inject their own expert system prompts (coding rules, debugging rules, etc.) without interference.

**Called by `buildCallLLM()` in `Chat.client.tsx`:**
```typescript
const buildCallLLM = useCallback(() => {
  return async (msgs, systemPrompt) => {
    // Filter to user+assistant only, strip <plcArtifact> from history
    // MAX_RETRIES=2 with 1s/2s backoff on 429/5xx
    const res = await fetch('/api/plc-generate', { method: 'POST', body: JSON.stringify({
      instructions: systemPrompt, messages: filteredMsgs, model, provider, apiKeys,
    })});
    return json.text;
  };
}, [model, provider, apiKeys]);
```

---

## Backend Services & Docker Stack

### Full Service Table

| Port | Service | Image | Technology | Role |
|------|---------|-------|------------|------|
| 4001 | matiec-validator | `volt-matiec-validator:latest` | Node.js + iec2c | IEC ST compiler |
| 4004 | esbmc-plc-verifier ★ | `volt-esbmc-plc:latest` | Python + ESBMC 8.3.0 + Z3 | k-induction formal proofs |
| 4006 | strucpp-codegen ★ | `volt-strucpp-codegen:latest` | Node.js | ST → C++ ZIP codegen |
| 8443 | openplc-runtime ★ | `ghcr.io/autonomy-logic/openplc-runtime:latest` | OpenPLC v4 | Real PLC execution |

### docker-compose.yaml (services summary)

```yaml
services:
  matiec-validator:   # :4001  healthcheck: curl /health
  strucpp-codegen:    # :4006  healthcheck: node http check
  openplc-runtime:    # :8443  healthcheck: curl -k /api/version
  esbmc-plc-verifier: # :4004  platform: linux/amd64  healthcheck: curl /health
```

**Start all services:**
```bash
docker-compose up -d
```

**Build individual services:**
```bash
docker build -t volt-esbmc-plc:latest ./docker/esbmc-plc/
docker build -t volt-strucpp-codegen:latest ./docker/strucpp-codegen/
docker build -t volt-matiec-validator:latest ./docker/matiec-validator/
```

---

## Deployment Targets

### Web

- **Cloudflare Pages** — Primary (serverless edge functions)
- **Vercel** — Alternative with API routes
- **Netlify** — Alternative with build plugins

### Desktop (`electron/`)

Build targets: macOS (dmg/zip), Windows (nsis/portable), Linux (AppImage/deb)

---

## Security & Persistence

| Layer | Storage | Data |
|-------|---------|------|
| IndexedDB | Browser | Chat history, file snapshots, file locks |
| localStorage | Browser | API keys (encrypted), user preferences |
| Cookies | Browser | Selected model, provider |

- API keys encrypted via `app/lib/crypto.ts` before storage
- Environment variable masking in CodeMirror editor
- WebContainer provides sandboxed execution
- CORS on all Docker microservices
- ESBMC container runs `--platform=linux/amd64` (requires Rosetta 2 on Apple Silicon)

---

## Configuration

### Environment Variables

```bash
# LLM Providers
ANTHROPIC_API_KEY=sk-ant-...
OPENAI_API_KEY=sk-...
GOOGLE_GENERATIVE_AI_API_KEY=...
GOOGLE_VERTEX_API_KEY=...
GOOGLE_CLOUD_PROJECT=...
GOOGLE_CLOUD_LOCATION=us-central1

# Validation Services (Docker)
VITE_MATIEC_URL=http://localhost:4001

# Formal Verification Services (Docker) ★ NEW
VITE_ESBMC_BASE_URL=http://localhost:4004

# OpenPLC Runtime v4 ★ NEW
VITE_OPENPLC_BASE_URL=https://localhost:8443
VITE_OPENPLC_USERNAME=admin
VITE_OPENPLC_PASSWORD=volt-diy-admin-2026

# STruC++ Codegen ★ NEW
VITE_STRUCPP_BASE_URL=http://localhost:4006

# Local AI
OLLAMA_API_BASE_URL=http://localhost:11434

# Database
SUPABASE_URL=https://...supabase.co
SUPABASE_ANON_KEY=eyJ...
```

---

## Dependencies

### Core PLC / Industrial

| Package | Purpose |
|---------|---------|
| `graphology` | CLM directed graph data structure |
| `graphology-traversal` | BFS/DFS traversal for CLM property synthesis |
| `graphology-shortest-path` | Execution order analysis |
| `fast-xml-parser` | Rockwell L5X + PLCOpenXML parsing |
| `ajv` + `ajv-formats` | JSON schema validation |
| `jszip` | Handover ZIP packaging |
| `xlsx` | I/O list Excel export |
| `jspdf` | FAT report + evidence package PDF |
| `papaparse` | CSV tag list import |
| `dxf-parser` | CAD DXF file import |
| `zod` | Runtime schema validation (scene validator, pipeline stages) |
| `@tanstack/react-table` | VerifyTrust Dashboard verification results table |
| `socket.io-client` | OpenPLC v4 debug stream |
| `js-yaml` | ESBMC property YAML serialization |

### HMI / Visualization

| Package | Purpose |
|---------|---------|
| `@xyflow/react` ^12.11.1 | ReactFlow graph canvas for HMI simulation |
| `reactflow` ^11.11.4 | Legacy ReactFlow (migration in progress) |
| `elkjs` ^0.11.1 | ELK.js layered layout algorithm for auto-positioning |
| `dagre` | Fallback auto-layout for CLM→HMI |

### AI / LLM

| Package | Purpose |
|---------|---------|
| `ai` (Vercel AI SDK) | Unified streaming interface |
| `@ai-sdk/anthropic` | Claude provider |
| `@ai-sdk/openai` | GPT provider |
| `@ai-sdk/google` ^0.0.52 | Gemini provider (Vertex AI, supports Gemini 3.x) |
| `@ai-sdk/mistral` | Mistral provider |
| + 14 more providers | Various |

### Framework & UI

| Package | Purpose |
|---------|---------|
| `react` 18.3.1 | UI framework |
| `@remix-run/react` | Full-stack SSR framework |
| `vite` 5.x | Build tool + dev server |
| `nanostores` | Reactive state management |
| `framer-motion` | Animations |
| `@radix-ui/*` | Accessible UI primitives |
| `react-toastify` | Toast notifications |
| `unocss` | Atomic CSS |
| `@phosphor-icons/react` | Dashboard icons |

---

## AI Architecture — System 1 (v3.6.0)

> **v3.6.0 consolidation:** The legacy multi-agent orchestrator (System 2 — AgentOrchestrator, PlanningAgent, CodingAgent, ValidationAgent, DebuggingAgent, AutonomousAgent, AgentProgressPanel) has been fully removed. The platform now runs a single, unified AI system: the LLM tool-calling loop via AI SDK `streamText`. This is described below.

---

### AI Overview

volt.diy uses a single LLM in a native tool-calling loop. The LLM receives the user's message and a set of tools, reasons about what to do, calls tools in sequence, and streams results back in real-time. There are no separate agents, no orchestration layer, no hidden pipelines.

```
User Message
    │
    ▼
Chat.client.tsx → useChat (AI SDK)
    │
    ▼ POST /api/chat (SSE stream)
api.chat.ts → streamText(model, tools, systemPrompt)
    │
    ├── LLM reasons, calls tools in sequence
    │       ├── listFiles()
    │       ├── readFile()
    │       ├── writeFile()  ──► workbench (file written, shown in editor)
    │       ├── editFile()   ──► workbench
    │       ├── searchCode()
    │       ├── validateST() ──► MatIEC /validate (real IEC 61131-3 compiler)
    │       ├── verifyProgram() → runFormalVerification() → ESBMC /verify
    │       └── createPlan() ──► plan card in chat UI (plan mode only)
    │
    ▼ SSE events (tool-input-available, tool-output-available, text-delta, …)
Chat.client.tsx → AI SDK state → Messages.client.tsx
    │
    ▼
AgentTraceBox.tsx ← deriveAgentSteps() (pure function over message parts)
    │
    └── Renders live step trace: icons, labels, status colors, timing
```

---

### Chat Modes: Plan vs Build

The **ModeSelector** toggle (top of chat input) switches between two modes. This is the active `chatMode` state — it directly determines which tools the LLM can call.

| Mode | `chatMode` value | Tools available | Behavior |
|------|-----------------|-----------------|----------|
| **Plan** | `'discuss'` | `readFile`, `listFiles`, `searchCode`, `createPlan` | LLM analyzes the project and produces a structured plan card. Cannot write or edit files. |
| **Build** | `'build'` | All Plan tools + `writeFile`, `editFile`, `validateST`, `verifyProgram` | LLM builds, edits, validates, and optionally formally verifies code. |

The mode is sent in every chat request body as `chatMode` and read in `api.chat.ts`. `getToolsForMode(mode, ctx)` returns the correct tool set.

---

### Full Message Flow

1. **User types message** → `Chat.client.tsx` `sendMessage()`
2. **`useChat` hook** sends POST to `/api/chat` with:
   - `messages[]` — full conversation history (AI SDK UIMessage format)
   - `chatMode` — `'build'` or `'discuss'`
   - `model`, `provider`, `apiKeys`
   - `files` — current workbench file map (passed in `chatBodyRef`)
3. **`api.chat.ts` action** reads request, calls `streamText()` from AI SDK with:
   - System prompt from `prompts.ts` (build or plan variant)
   - Tool set from `getToolsForMode(chatMode, ctx)`
   - `ToolContext` contains: `files` (FileMap), `dataStream`, `mode`
4. **LLM streams**: reasoning deltas, tool calls, text deltas — all as SSE events
5. **Tool executions** run in the server action:
   - `writeFile`/`editFile`: write to `ctx.files` + emit `toolAction` data annotation → workbench picks it up → file appears in editor
   - `validateST`: calls MatIEC directly at `VITE_MATIEC_URL/validate`
   - `verifyProgram`: calls `runFormalVerification()` → CLM synthesis → ESBMC
   - `createPlan`: emits `plan` data annotation → renders plan card in chat
6. **Client receives SSE stream** → AI SDK reconstructs message parts
7. **`Messages.client.tsx`** renders each message:
   - `AgentTraceBox` for messages with tool parts (live or historical)
   - `AssistantMessage` for final text
8. **`AgentTraceBox`** calls `deriveAgentSteps(parts, isLive, annotations)`:
   - Pure function — reads tool-invocation parts and toolAction annotations
   - Returns `DerivedStep[]` with status, label, icon, timing
   - Renders step list with icons, connecting lines, timers

---

### Tool Registry

**File:** `app/lib/.server/llm/tools.ts`

#### Build-mode tools (`createBuildTools`)

| Tool | Description | Key behavior |
|------|-------------|--------------|
| `readFile` | Read a project file by path | Returns `{ path, content, lines }` |
| `writeFile` | Create or overwrite a file | Emits `toolAction` annotation → workbench; builds `{ path, content }` |
| `editFile` | Targeted search-and-replace in a file | Fails if search string not found |
| `listFiles` | List all project files | Returns `{ files[], count }` |
| `searchCode` | Full-text search across all files | Returns matching lines with line numbers |
| `validateST` | Compile-check ST code with MatIEC | Fast regex pre-check → MatIEC `/validate` → returns `{ status, valid, errors[], warnings[] }` |
| `verifyProgram` | Formal safety verification (ESBMC) | CLM property synthesis → ESBMC k-induction → returns `FormalVerificationResult` |

#### Plan/discuss-mode tools (`createPlanTools`)

| Tool | Description |
|------|-------------|
| `readFile` | Same as build |
| `listFiles` | Same as build |
| `searchCode` | Same as build |
| `createPlan` | Emit structured plan card; LLM stops and waits for user approval |

---

### validateST — MatIEC Integration

**File:** `app/lib/.server/llm/tools.ts` → `validateST.execute()`

The tool runs a two-stage check:

**Stage 1 — Fast regex pre-check (client-side, no network)**
- Detects: missing `PROGRAM`/`FUNCTION_BLOCK`/`FUNCTION` declaration
- Detects: missing `END_PROGRAM`/`END_FUNCTION_BLOCK`/`END_FUNCTION`
- Detects: `VAR`/`END_VAR` count mismatch
- Returns `status: 'errors-found'` immediately if any of these fail — saves a network round-trip for obviously broken code

**Stage 2 — Real MatIEC compiler**
- `POST ${MATIEC_URL}/validate` with `{ code }`
- Env var: `VITE_MATIEC_URL` (falls back to `MATIEC_URL`, then `http://localhost:4001`)
- Returns:
  - `{ status: 'valid', valid: true, errors: [], warnings: [], raw }` — clean compile
  - `{ status: 'errors-found', valid: false, errors: [{line, message, severity}] }` — compiler errors
  - `{ status: 'unverified', reason }` — MatIEC service unreachable (never falsely claims valid)

**Design rule:** The tool NEVER returns `valid: true` on service failure. An honest `unverified` is safer than a false pass.

---

### verifyProgram — Formal Verification Tool

**Files:**
- Tool definition: `app/lib/.server/llm/tools.ts` → `verifyProgram.execute()`
- Shared implementation: `app/lib/verification/runFormalVerification.ts`

**When it runs:** Only when explicitly requested by the user OR when the LLM detects safety-critical logic (E-STOP, interlocks, mutual exclusion) and asks the user first. **Never called automatically.**

**Flow:**

```
verifyProgram(code)
    │
    ▼
runFormalVerification(code)
    │
    ├─ Step 1: CLMPropertySynthesizer.synthesize()
    │          Reads clmProject nanostores atom
    │          → PropertySet { properties: VerificationProperty[] }
    │          If 0 properties → return { status: 'unverified', reason: '...' }
    │
    ├─ Step 2: POST ${ESBMC_URL}/verify
    │          { st_code, properties }
    │          Env var: VITE_ESBMC_BASE_URL → ESBMC_BASE_URL → http://localhost:4004
    │          Timeout: 120s
    │
    └─ Step 3: Map results → FormalVerificationResult
               status: 'proved' | 'violations-found' | 'unverified'
               provedCount, violationCount, unknownCount, totalProperties
               properties[]: { id, description, severity, result, counterexample? }
```

**Return type:** `FormalVerificationResult` — never throws, always returns a valid object.

**Note:** `clmProject` is a nanostores atom (browser state only). When called server-side via the LLM tool, it is always `null`, so CLM synthesis yields 0 properties → `status: 'unverified'`. This is correct and safe behavior — the tool honestly reports it cannot synthesize properties rather than fabricating a false proof.

---

### Agent Trace UI

**Files:**
- `app/lib/agent/deriveAgentSteps.ts` — pure function, derives `DerivedStep[]` from AI SDK message parts
- `app/components/chat/AgentTraceBox.tsx` — renders the step list

**`deriveAgentSteps(parts, isLive, annotations)`**

Pure function — no side effects, no stores. Processes:
- `tool-invocation` parts (from AI SDK streaming)
- `toolAction` data annotations (emitted by writeFile/editFile tool execute)
- Synthesizes a `DerivedStep[]` array with:
  - `tool` — tool name
  - `status` — `'running' | 'done' | 'error' | 'warning'`
  - `label` — human-readable (e.g. "Build passed", "Safety proved")
  - `fileName` — extracted from input path when applicable
  - `startedAt`, `endedAt` — for timing display

**Recognized tools and their statuses:**

| Tool | Running | Done (success) | Done (error) | Done (warning) |
|------|---------|----------------|--------------|----------------|
| `readFile` | Reading file | Read file | — | — |
| `writeFile` | Creating file | Created file | — | — |
| `editFile` | Editing file | Edited file | — | — |
| `listFiles` | Listing files | Listed files | — | — |
| `searchCode` | Searching code | Searched code | — | — |
| `validateST` | Validating build | Build passed | Build failed | — |
| `verifyProgram` | Verifying safety | Safety proved | Violations found | Verification incomplete |
| `createPlan` | Creating plan | Created plan | — | — |

**`INTERNAL_TOOLS` set** — tools that are not shown as user-visible steps in the trace (currently empty for all listed tools; the set exists for filtering internal bookkeeping calls).

**Icons** (from `AgentTraceBox.tsx` `getIconConfig`):

| Tool | Icon class |
|------|-----------|
| `readFile` | `i-ph:file-text` |
| `listFiles` | `i-ph:folder-open` |
| `writeFile` | `i-ph:file-plus` |
| `editFile` | `i-ph:pencil-simple` |
| `searchCode` | `i-ph:magnifying-glass` |
| `createPlan` | `i-ph:list-checks` |
| `validateST` | `i-ph:check-circle` |
| `verifyProgram` | `i-ph:shield-check` |

---

### Verification Guardrail

**File:** `app/lib/common/prompts/prompts.ts` — Rule 6 in "ABSOLUTE OUTPUT RULES"

```
6. VERIFICATION LANGUAGE GUARDRAIL — ABSOLUTE:
   - After validateST alone, you may say "compiles cleanly" or "has no compiler errors".
   - NEVER say "verified", "proven safe", "formally checked" unless verifyProgram tool ran
     and returned proved.
   - Compilation success ≠ formal safety proof.
   - If safety-critical logic detected, offer verification but ask user first.
```

This prevents the LLM from misrepresenting a successful MatIEC compile as a formal safety proof.

---

### Store Architecture

**File:** `app/lib/agent/stores/agentStore.ts`

Stores that remain active (System 1 only):

| Store | Type | Purpose |
|-------|------|---------|
| `agentRunningStore` | `atom<boolean>` | True while LLM is streaming; gates UI inputs |
| `agentLogStore` | `atom<AgentLogEvent[]>` | Live event log for the trace panel |
| `agentStepsStore` | `atom<Step[]>` | Step list for AgentTrace component |

Helper functions: `resetAgentState()`, `clearSteps()`, `addStep()`, `updateStep()`, `pushLog()`, `completeLog()`, `failLog()`, `streamDetailText()`, `appendLogDetail()`, `abortAllRunningLogs()`.

**File:** `app/lib/agent/types.ts`

```typescript
export type StepKind = 'think' | 'tool' | 'subagent' | 'answer';
export type StepStatus = 'pending' | 'running' | 'done' | 'error' | 'awaiting-approval';

export interface Step {
  id: string;
  kind: StepKind;
  tool?: string;
  label: string;
  status: StepStatus;
  parallelGroup?: string;
  parentId?: string;
  input?: unknown;
  output?: unknown;
  startedAt: number;
  endedAt?: number;
}
```

All System 2 types (`AgentMode`, `PermissionLevel`, `AgentContext`, `AgentPlan`, `AgentExecutionResult`, `AgentState`, `VerificationSnapshot`) have been removed.

---

### Backend Services Wiring

All backend microservices are started via Docker Compose (`docker-compose.yaml`).

| Service | Container | Port | Env Var | Used by |
|---------|-----------|------|---------|---------|
| MatIEC validator | `matiec-validator` | 4001 | `VITE_MATIEC_URL` | `validateST` tool, `autoValidateST()` in workbench |
| ESBMC verifier | `esbmc-plc-verifier` | 4004 | `VITE_ESBMC_BASE_URL` | `verifyProgram` tool, Verify tab pipeline |
| STruC++ codegen | `strucpp-codegen` | 4006 | `VITE_STRUCPP_BASE_URL` | ST → C++ compilation |
| OpenPLC runtime | `openplc-runtime` | 8443 | `VITE_OPENPLC_BASE_URL` | Simulation, deploy |
| Hardware connector | `hardware-connector` | 4007 | `VITE_HARDWARE_CONNECTOR_URL` | Modbus/OPC UA gateway |

**Important:** All server-side code (Remix actions, LLM tool executors) must use `process.env.VITE_MATIEC_URL` (not `import.meta.env`) since Vite only exposes `VITE_*` vars to client bundles via `import.meta.env`. Server-side `process.env` receives the full env var name including the `VITE_` prefix.

The `/api/plc-services` route (`app/routes/api.plc-services.ts`) is a **browser-facing proxy** — it handles CORS and is called by client-side components (Verify tab, etc.). The LLM tools (`validateST`, `verifyProgram`) call the microservices **directly** via `process.env` since they run server-side in the Remix action.

#### Start all services

```bash
docker-compose up -d
```

#### Health check

```bash
curl http://localhost:4001/health   # MatIEC
curl http://localhost:4004/health   # ESBMC
curl http://localhost:4006/health   # STruC++
```

#### Verify full pipeline via API

```bash
# 1. Direct MatIEC compile check
curl -X POST http://localhost:4001/validate \
  -H "Content-Type: application/json" \
  -d '{"code": "PROGRAM test\nVAR\n x: BOOL;\nEND_VAR\nx := TRUE;\nEND_PROGRAM"}'

# 2. Full LLM message → tools → MatIEC
curl -X POST http://localhost:5173/api/chat \
  -H "Content-Type: application/json" \
  -d '{
    "messages": [{"id":"1","role":"user","parts":[{"type":"text","text":"[Model: gemini-3.5-flash]\n\n[Provider: Google Vertex AI]\n\nWrite a simple motor PLC program and validate it"}]}],
    "chatMode": "build",
    "model": "gemini-3.5-flash",
    "provider": "Google Vertex AI",
    "apiKeys": {},
    "files": {}
  }'
```

---

### What was removed in v3.6.0

The following files and systems have been **permanently deleted**:

```
# Agent orchestrator + sub-agents
app/lib/agent/agentOrchestrator.ts
app/lib/agent/agents/planningAgent.ts
app/lib/agent/agents/codingAgent.ts
app/lib/agent/agents/validationAgent.ts
app/lib/agent/agents/debuggingAgent.ts
app/lib/agent/agents/autonomousAgent.ts
app/lib/agent/useAgentExecution.ts
app/lib/agent/contextManager.ts
app/lib/agent/checkpointStore.ts
app/lib/agent/editApplier.ts
app/lib/agent/permissionMatrix.ts
app/lib/agent/permissionResolver.ts
app/lib/agent/requestClassifier.ts

# API route
app/routes/api.agent.execute.ts

# UI components
app/components/chat/AgentProgressPanel.tsx
app/components/chat/AgentThinking.tsx
app/components/chat/CheckpointCard.tsx

# Tests (all tested deleted code)
tests/agent/agentOrchestrator.test.ts
tests/agent/autonomousAgent.test.ts
tests/agent/debuggingAgent.test.ts
tests/agent/e2e-pipeline-realllm.test.ts
tests/agent/manual-trigger.test.ts
tests/agent/modePermission.test.ts
tests/agent/planningAgent.test.ts
tests/rag/manual-rag-trigger.test.ts
tests/rag/rag-integration.test.ts
scripts/verify-pipeline-e2e.ts
```

**`app/lib/ai/multiAgentPipeline.ts` was NOT deleted** — it exports `pipelineState` which is used by the Verify tab pipeline (`pipelineOrchestrator.ts`, `Workbench.client.tsx`, `VerifyTrustDashboard.client.tsx`, `fatEvidencePackage.ts`).

---

*v3.6.0 — 2026-07-05: Full AI system consolidation. Deleted System 2 (AgentOrchestrator + multi-agent pipeline). Single unified System 1: LLM tool-calling loop via AI SDK streamText. validateST upgraded to call real MatIEC compiler directly (server-side, VITE_MATIEC_URL). Added verifyProgram tool backed by runFormalVerification.ts (CLM property synthesis + ESBMC k-induction). Added verification language guardrail in system prompt (Rule 6). verifyProgram recognized in deriveAgentSteps.ts + AgentTraceBox with shield icon. agentStore.ts stripped to System 1 only. types.ts reduced to Step/StepKind/StepStatus. Zero TypeScript errors. Full pipeline verified live: user message → LLM → tool calls → MatIEC/ESBMC → workbench writes → AgentTraceBox rendering.*


## Known Gaps & Roadmap

### Known Limitations (as of v3.5.5)

| Area | Status | Notes |
|------|--------|-------|
| CLM pipeline race condition | ✅ Fixed (v3.5.6) | `initCLMAutoSync` 500ms debounce caused `clmProject` to be null when pipeline read it → "No CLM project loaded". Fixed by `#syncCLMThenPipeline`: regex parse + `setProject` runs synchronously before pipeline fires |
| CLMPropertySynthesizer 0 properties | ✅ Fixed (v3.5.6) | Old synthesizer checked `attrs.type === 'interlock'` — this field doesn't exist; graphBuilder stores `attrs.node.kind`. Completely rewritten to use actual node structure. DualPumpWaterLevel now yields 6 properties |
| ModeSelector permission panel behind workbench | ✅ Fixed (v3.5.6) | `z-index: 9999` was clipped by parent stacking contexts. Permission panel now uses `createPortal(_, document.body)` + `position: fixed` + `z-index: 99999` |
| ThoughtBox overflow into workbench | ✅ Fixed (v3.5.6) | ThoughtBox outer div lacked width constraint — added `w-full overflow-hidden`; content div uses `overflow-y-auto` |
| Docker services | ✅ All running | matiec (:4001), ESBMC (:4004), STruC++ (:4006), OpenPLC (:8443) all healthy |
| RAG OSCAT index | ✅ Built | 547 FBs indexed from 21 `plc.st` files in `oscat/OSCAT Library for OpenPLC/`; 2.7MB IVF_PQ LanceDB index |
| Google Embeddings | ✅ Working | Switched to `text-embedding-004` via Vertex AI Predict REST — no AI Studio billing needed; uses `GOOGLE_VERTEX_API_KEY` |
| Agent pipeline stability | ✅ Fixed (v3.5.0) | DebuggingAgent had brittle response parsing causing "did not return fixed code" crash. Now uses 5-strategy parser with graceful fallback — pipeline never throws on debug failure |
| VAR block comments | ✅ Fixed (v3.5.0) | CodingAgent and DebuggingAgent prompts now explicitly forbid `//` comments inside VAR blocks (MatIEC cannot parse them — was causing "invalid variable declaration" on first generation) |
| Chat UI crashes | ✅ Fixed (v3.5.0) | Agent pipeline errors now show a readable message in the assistant bubble instead of removing the placeholder (blank bubble / apparent crash) |
| generatedFiles after debug | ✅ Fixed (v3.5.0) | Orchestrator now updates the `.st` file in `generatedFiles` after each debug iteration so the final artifact contains the fixed code |
| Debug loop discarding fixes | ✅ Fixed (v3.5.3) | Root cause of persistent 19-error loops: CodingAgent was re-called on every orchestrator iteration, overwriting DebuggingAgent's fixes. `needsGeneration` boolean flag now ensures CodingAgent runs once; all subsequent iterations use DebuggingAgent output only. Same fix applied to AutonomousAgent. |
| DebuggingAgent output quality | ✅ Fixed (v3.5.3) | Rebuilt with structured JSON output (DebugResponseSchema Zod), code shown with line numbers + 3-line error context snippets, dual path callLLMStructured (primary) / callLLM (fallback) |
| CodingAgent first-pass errors | ✅ Improved (v3.5.3) | System prompt hardened with NEGATIVE EXAMPLES section (wrong vs correct for VAR blocks, multi-line expressions, FB calls), MANDATORY SELF-CHECK expanded to 10 items including "ZERO comments in ENTIRE program" |
| CodingAgent output quality | ✅ Improved (v3.5.4) | v2.0 rewrite: structured JSON output path (`STGenerationOutput` schema with hidden CoT `reasoning` field); dynamic rules injection gated by complexity detection; safety compliance section; confidence-rated output; `uncertainSections` forwarded to DebuggingAgent; `callLLMStructured` wired through both orchestrator paths |
| Agent mode file creation | ✅ Fixed (v3.5.5) | Files generated by agent mode never appeared in workbench: old path serialized files to `<plcAction>` XML tags, relied on StreamingMessageParser + async WebContainer watcher, and computed wrong relative paths via path-browserify (`nodePath.relative('/home/project', 'src/main.st')` → `../../src/main.st`). Now: `workbenchStore.createFileFromAgent(path, content)` writes directly to WebContainer and updates the files store synchronously. Standard LLM streaming path unchanged. |
| Missing supplementary files (ladder/HMI/FAT) | ✅ Fixed (v3.5.1) | CodingAgent now generates all 5 files in one LLM call using ===FILE:path=== markers; no separate supplementary generation step needed |
| CASE label errors (55 errors) | ✅ Fixed (v3.5.1) | `sanitizeSTCode` strips ALL comments before CASE label processing; CASE_LABEL regex updated to match `0:`, `1, 2:`, `3..5:` patterns |
| File creation box popping in all at once | ✅ Fixed (v3.5.1) | Artifact text now streams line-by-line (12ms/line, 80ms on action boundaries) after 600ms delay for AgentThinking collapse animation |
| Step detail not updating live | ✅ Fixed (v3.5.1) | `streamDetailText` word-by-word at 18ms/word; Understanding + Implementation plan steps show real LLM text as it renders |
| AgentThinking not auto-collapsing | ✅ Fixed (v3.5.1) | Each step auto-collapses 900ms after completion; main container collapses 400ms after all-success |
| "Thought" component in agent mode | ✅ Fixed (v3.5.1) | `suppressThinking` prop passed to AssistantMessage hides ThinkingBlock when AgentThinking events are present |
| Non-accent text color mismatch | ✅ Fixed (v3.5.1) | All cool grays replaced with warm stone palette: `#A8A49E` (secondary), `#8f8b84` (tertiary) — aligned with heading `#C2C0B6` |
| AgentProgressPanel | Dead code | Defined at `app/components/chat/AgentProgressPanel.tsx` but never imported or rendered; superseded by `AgentThinking.tsx` |
| `/api/agent.execute` | Stub (501) | Route exists but returns 501 — agent orchestration intentionally runs client-side; route reserved for future server-side use |
| Code editor background | ✅ Fixed | Dark mode CodeMirror editor background now uses `--volt-elements-terminals-background` (#1e1e1c) matching the compiler console |
| AgentThinking persistence | ✅ Fixed (v3.5.0) | Snapshot logic preserves thinking steps after agent completes; steps don't vanish when store resets |
| ESBMC Apple Silicon | Requires Rosetta | `platform: linux/amd64` emulation via Rosetta 2; performance ~2-3× slower than native |
| Round-trip vendor scores | ✅ Fixed (v3.5.2) | OpenPLC 82%, Rockwell 90%, Siemens 82%, CODESYS 82% — all above 75% threshold |
| HMI AI layout quality | Improving | AI sometimes places components in wrong grid positions for complex prompts (>8 components) |
| HMI Gemini 3.5 Flash | Rate-limited | Google Cloud Vertex AI may rate-limit (429) on heavy use; retry logic handles this |
| LLM pipeline Stage 1 | Requires API key | The auto-trigger in `workbench.ts` calls `/api/chat`; if no LLM API key is configured, Stage 1 fails silently |
| Counterexample visualization | Cycle trace only | Does not yet map cycles back to specific ladder rungs in the CLM graph view |
| OpenPLC health endpoint | Not standard | OpenPLC v4 has no `/health` route; use `/api/version` to confirm liveness |

### Planned Improvements

- **ESBMC native ARM** — Switch to ARM64 ESBMC build when stable release is available
- **Vendor adapter fidelity** — ✅ Achieved 82–90% (v3.5.2); remaining gap is stToCLM fallback parser reconstructing `A := B - C` as `assignment` rather than `arithmetic` — requires tree-sitter parser to fix
- **CLM→counterexample mapping** — Highlight violating rungs directly in CLM Graph view when ESBMC finds a violation
- **HMI Dagre quality** — Better edge routing for dense CLM graphs
- **FRET LLM mode** — Use LLM for NL→FRETish when rule-based confidence is low
- **Offline verification** — WASM build of ESBMC for browser-side verification without Docker

---

## Technology Summary

| Layer | Technology |
|-------|-----------|
| **Frontend Framework** | Remix + React 18 |
| **Build Tool** | Vite 5 |
| **Styling** | UnoCSS (Tailwind-compatible) |
| **State** | Nanostores (atoms + maps) |
| **Editor** | CodeMirror 6 |
| **Core Graph Engine** | Graphology (directed graph) |
| **Terminal** | xterm.js |
| **File System** | WebContainer API |
| **PLC Scan Engine** | Custom TypeScript IEC 61131-3 |
| **Ladder Rendering** | HTML5 Canvas 2D |
| **HMI Canvas** | ReactFlow (@xyflow/react 12.x) — custom nodes + edges |
| **HMI Layout** | ELK.js layered algorithm (grid → pixel) |
| **HMI Physics** | Custom accumulation engine (100ms tick, fluid/conveyor/sensor) |
| **HMI Validation** | Zod schema + Component Registry (29 types) + auto-fixer |
| **HMI Components** | 18 custom skeuomorphic SVG React nodes |
| **Default AI Model** | Gemini 3.5 Flash (Google Cloud Vertex AI) |
| **AI SDK** | Vercel AI SDK (23+ providers, @ai-sdk/google 0.0.52) |
| **RAG Vector DB** | LanceDB v0.30 (local, 768-dim text-embedding-004 via Vertex AI) |
| **RAG Corpus** | 547 OSCAT + 1143 AutoPLC + 68 seed = 1758+ entries; seed: 26 MatIEC-validated (build-rag-corpus.ts) + 42 Siemens SCL real-world (add-siemens-scl-corpus.ts) |
| **CLM → Layout** | Dagre auto-layout (fallback) |
| **Primary Compiler** | MatIEC (iec2c) via Docker (:4001) |
| **Formal Verifier** | ESBMC 8.3.0 + Z3 (Docker :4004) |
| **Real Execution** | OpenPLC Runtime v4 (Docker :8443) |
| **ST→C++ Codegen** | STruC++ microservice (:4006) |
| **Evidence PDF** | jsPDF (7-section formal verification package) |
| **Vendor Export** | Vendor adapters from CLM (not AI text) |
| **Persistence** | IndexedDB + localStorage |
| **Desktop** | Electron |
| **Hosting** | Cloudflare Pages/Workers |
| **Git** | isomorphic-git |

---

## Test Coverage (v3.0.0)

| Test File | Phase | Tests | Status |
|-----------|-------|-------|--------|
| `phase2-property-synthesizer.test.ts` | Phase 2 | 8 | ✅ Passing |
| `phase3-esbmc.test.ts` | Phase 3 | 6 | ✅ Passing |
| `phase4-pipeline.test.ts` | Phase 4 | 9 | ✅ Passing |
| `phase5-verify-dashboard.test.ts` | Phase 5 | 7 | ✅ Passing |
| `phase6-fat-evidence.test.ts` | Phase 6 | 8 | ✅ Passing |
| `phase7-e2e-full-pipeline.test.ts` | Phase 7 | 17 | ✅ Passing |
| `tests/agent/agentOrchestrator.test.ts` | Agent | 3 | ✅ Passing |
| `tests/agent/planningAgent.test.ts` | Agent | 3 | ✅ Passing |
| `tests/agent/autonomousAgent.test.ts` | Agent | 3 | ✅ Passing |
| `tests/agent/modePermission.test.ts` | Agent | 6 | ✅ Passing |
| `tests/agent/e2e-verification.test.ts` | Agent E2E | 18 | ✅ Passing |
| `tests/agent/manual-trigger.test.ts` | Agent Manual | 12 | ✅ Passing |
| `tests/vendor-roundtrip.test.ts` | Vendor Round-Trip | — | ✅ Passing (OpenPLC 82%, Rockwell 90%, Siemens 82%, CODESYS 82%) |

Run all tests:
```bash
pnpm test

# Agent tests only
pnpm vitest run tests/agent/
```

---

---

## UI Design System (v3.3.0)

The platform's visual design is modeled after Claude.ai's design language — warm dark surfaces, flat hierarchy, restrained typography, and a single brand color for all AI-initiated actions.

### Design Principles

| Principle | Rule |
|-----------|------|
| **Flat, not elevated** | No gradients, mesh, glow, or box-shadow on in-flow elements. Clean solid surfaces only. |
| **Restrained motion** | Subtle transitions (150ms ease-out). No particle effects or scattered animations. |
| **Warm dark** | Surfaces use warm-brown-dark rather than cool gray or pure black. |
| **Typography signals speaker** | Sans-serif (Styrene B) for all UI chrome. Serif (Tiempos Text) for AI response text only. Mono (Fira Code) for code/data. Display serif (Copernicus) for heroes. |
| **Two font weights only** | 400 (regular) and 500 (medium). Never 600 or 700 anywhere. |
| **Sentence case everywhere** | All labels, buttons, and tab names use sentence case. No ALL CAPS. |
| **3-tier discrete color hierarchy** | `--text-primary` → `--text-secondary` → `--text-muted` are three distinct token values, not opacity-reduced variants. |
| **0.5px hairline borders** | All panel/card borders are 0.5px. No thick borders except active focus rings. |

### Brand Color

```
--brand-primary-500: #4d8eff   /* primary actions, active tab, send button */
--brand-primary-700: #3a78e8   /* hover state */
--brand-primary-900: #2c63cc   /* active/pressed, send button fill */
--text-on-brand:     #0a0e1a   /* dark text on bright brand bg */
```

Used for: send button, active tab indicator, link color, loader progress bar, accent dot, sidebar "Start new chat" button, Fix with AI button, border-active.

**Never used for:** decorative elements, backgrounds of large areas, or non-interactive elements.

### Surface Hierarchy (Dark Mode)

```
depth-1  #1e1e1c   Page canvas, preview/simulation/diff content bg, terminals
depth-2  #262624   Panels, sidebars, workbench header, toolbar backgrounds
depth-3  #30302e   Active item backgrounds, code surface, hover states
depth-4  rgba(255,255,255,0.04)  Subtle hover tint on depth-3 surfaces
```

Surfaces go lighter as they rise in the stack (depth-1 = darkest visible surface, depth-3 = lightest in-page surface). Borders use `rgba(255,255,255,0.08)` — a single hairline that reads at all depths.

### Warm Stone Palette ★ v3.5.1

The non-accent, non-primary text uses a warm stone hierarchy derived from the page heading color `#C2C0B6`. All cool grays (`#B4B4B4`, `rgba(255,255,255,0.5)`, `#78716c`, `#a8a29e`) have been replaced.

| Token | Value | Usage |
|-------|-------|-------|
| `--volt-elements-textPrimary` | `#f5f5f4` | Active text, selected items, inputs |
| `--volt-elements-textSecondary` | `#A8A49E` | Placeholder text, icon buttons (rest), ModeSelector trigger (rest), sidebar items (rest) |
| `--volt-elements-textTertiary` | `#8f8b84` | Descriptions, permission labels, table headers, form labels |
| `--volt-elements-item-contentDefault` | `#A8A49E` | Default item text (sidebar, lists) |
| `--volt-elements-icon-secondary` | `#A8A49E` | Icon buttons resting state (was `#78716c`) |
| Heading (`#C2C0B6`) | `#C2C0B6` | "Build intelligent PLC programs with AI" — warmest non-white |

**Rule:** Non-hover, non-accent UI text is always `#A8A49E` (secondary) or `#8f8b84` (tertiary). Hover and active states jump to `#f5f5f4` (primary). Never cool gray.

### Typography System

| Surface | Font | Size | Weight | Color |
|---------|------|------|--------|-------|
| Page heading ("Describe your PLC program") | Galaxie Copernicus | 4xl | 400 (Book) | `#C2C0B6` |
| AI chat responses & Thought reasoning | Tiempos Text serif | 16-17px | 400 | `--text-primary` |
| Headings inside AI response (##, ###) | Tiempos Text serif | scaled | 500 | `--text-primary` |
| User message text | Styrene B sans | 16px | 400 | `#f5f5f4` |
| Chatbox textarea input | Styrene B sans | 16px | 400 | `#f5f5f4` |
| Sidebar / nav items | Styrene B sans | 14px | 400 (500 active) | `--text-secondary` / `--text-primary` |
| Workbench tab labels | Styrene B sans | 14px | 400 | `--text-secondary` |
| Button labels | Styrene B sans | 14px | 500 (mandatory) | varies |
| Form labels | Styrene B sans | 13px | 500 | `--text-secondary` |
| Input values | Styrene B sans | 16px | 400 | `--text-primary` |
| Placeholder text & suggestion cards | Styrene B sans | 14-16px | 400 | `--text-muted` / `--text-secondary` |
| Badges / status chips | Styrene B sans | 12px | 500 | white on semantic bg |
| Compiler console / code output | Fira Code mono | 11-14px | 400 | `--text-primary` |
| Inline code & editor content | Fira Code mono | 13-14px | 400/500 | `--text-primary` |
| Table headers (Tag monitor etc.) | Styrene B sans | 11-12px | 500 uppercase | `--text-tertiary` |
| Tooltips | Styrene B sans | 12-13px | 400 | inverted surface |

Fonts loaded locally via `@font-face` in `fonts.scss` (no Google Fonts):
```scss
--font-ui:      'Styrene B', -apple-system, sans-serif;
--font-voice:   'Tiempos Text', Georgia, serif;
--font-display: 'Galaxie Copernicus', Georgia, serif; 
--font-mono:    'Fira Code', monospace;
```

### Component-Specific Rules

#### Send Button (`SendButton.client.tsx`)
- Background: `#2c63cc` (brand-primary-900)
- Icon: white arrow SVG
- Size: 34×34px, `rounded-md`
- Disabled: `opacity-50`

#### Chat Input Box (`ChatBox.tsx`)
- Background: `bg-volt-elements-background-depth-3` (`#30302e`)
- Border: `border-volt-elements-borderColor` (0.08 white alpha)
- `rounded-2xl`
- Textarea: 16px Inter 400, `#f5f5f4`, transparent background
- Volt AI / Industrial Automation Engine header row: **removed**

#### User Message Bubbles (`UserMessage.tsx`)
- Background: `#1a1a18` (slightly darker than depth-1)
- Border: `rgba(255,255,255,0.06)`
- `rounded-2xl`
- Right-aligned for string content, left-aligned for array content
- Font: Styrene B 16px 400 — distinct from AI responses (which are serif)

#### AI Response Text (`Markdown.module.scss`)
- Font family: Tiempos Text serif
- Size: 17px (`voice-lg`)
- Weight: 400 (500 only for bold emphasis — never 600/700)
- Line height: 1.7 (serif needs more vertical room)
- Headings inside response: serif 500, line-height 1.3
- Table cells: `0.5px solid var(--volt-elements-borderColor)`
- Table alt rows: `var(--volt-elements-bg-depth-2)` background

#### Workbench Panel (`Workbench.client.tsx`)
- Outer container: `bg-volt-elements-background-depth-2`, `border-volt-elements-borderColor`, `rounded-xl`
- No `shadow-*` on the panel (flat rule)

#### Header (`Header.tsx`)
- Background: `bg-volt-elements-background-depth-1` (same as page)
- Permanent `border-b border-volt-elements-borderColor`
- Logo: Text logo "Volt" in Styrene B Medium (500)

#### Sidebar (`Menu.client.tsx`, `HistoryItem.tsx`)
- Panel bg: `bg-volt-elements-background-depth-1`
- Header row: `bg-volt-elements-background-depth-2`
- Date/time row, search input, section labels: all use volt theme variables (no hardcoded `gray-*`)
- Chat history items: `text-volt-elements-textSecondary` at rest, `text-volt-elements-textPrimary` on hover/active
- Active item: `bg-volt-elements-item-backgroundActive`
- Edit input, confirm/delete dialogs: all volt theme variables

#### Simulation Canvas bg (`HMICanvas.client.tsx` + `hmi.css`)
- ReactFlow canvas: `background: #1e1e1c` + `--xy-background-color: #1e1e1c`
- Controls panel: `background: #262624`
- Matches preview/diff content box color exactly

#### Ladder/Preview Canvas (`LadderRungRow.tsx`, `ladderRenderer.ts`)
- `C_BODY_BG`: `#1e1e1c` (warm depth-1)
- `C_HDR_BG`: `#262624` (warm depth-2)
- `C_HDR_LINE`: `#30302e` (warm depth-3)
- Function block bg (`FB_BG`): `#262624`
- Function block header (`FB_HEADER_BG`): `#30302e`
- Separator: `#30302e`
- Canvas renderer fills `#1e1e1c` explicitly before drawing

#### Compiler Console (`CompilerConsole.tsx`)
- Font: `font-mono` (inherits Fira Code from global CSS)
- Content area: `text-xs leading-relaxed`
- Raw compiler file output (POUS.c, POUS.h, LOCATED_VARIABLES.h, VARIABLES.csv): **hidden** — never shown in UI
- No-errors state: shows "No compilation errors. Code is semantically valid." (not raw compiler stdout)

### CSS Variables Reference (Dark Theme)

```scss
/* Borders */
--volt-elements-borderColor:        rgba(255, 255, 255, 0.08)
--volt-elements-borderColorActive:  #4d8eff

/* Surfaces */
--volt-elements-bg-depth-1:  #1e1e1c
--volt-elements-bg-depth-2:  #262624
--volt-elements-bg-depth-3:  #30302e
--volt-elements-bg-depth-4:  rgba(255, 255, 255, 0.04)

/* Text */
--volt-elements-textPrimary:    #f5f5f4
--volt-elements-textSecondary:  #A8A49E   /* warm stone — matches heading palette */
--volt-elements-textTertiary:   #8f8b84   /* dimmer warm stone — descriptions, permissions */

/* Brand / Accent */
--volt-elements-button-primary-background:       rgba(77, 142, 255, 0.15)
--volt-elements-button-primary-backgroundHover:  rgba(77, 142, 255, 0.25)
--volt-elements-button-primary-text:             #4d8eff
--volt-elements-item-contentAccent:              #4d8eff
--volt-elements-item-backgroundAccent:           rgba(77, 142, 255, 0.12)
--volt-elements-loader-progress:                 #4d8eff
--volt-elements-messages-linkColor:              #4d8eff
--volt-elements-sidebar-buttonText:              #4d8eff

/* Icons */
--volt-elements-icon-success:   #22c55e
--volt-elements-icon-error:     #ef4444
--volt-elements-icon-primary:   #f5f5f4
--volt-elements-icon-secondary: #78716c   /* warm stone — sidebar/action icons at rest */
--volt-elements-icon-tertiary:  #57534e   /* dimmer — decorative/inactive icons */

/* Terminals */
--volt-elements-terminals-background:        #1e1e1c
--volt-elements-terminals-buttonBackground:  #30302e
```

### UnoCSS Accent Palette

```ts
accent: {
  50:  '#eef4ff',
  100: '#d6e6ff',
  200: '#adccff',
  300: '#84b3ff',
  400: '#6aa3ff',
  500: '#4d8eff',   /* primary */
  600: '#3a78e8',   /* hover */
  700: '#2c63cc',   /* active / send button */
  800: '#1f4fa3',
  900: '#143a7a',
  950: '#0a1e40',
}
```

### Removed / Cleaned Up

| Element | Status |
|---------|--------|
| `PromptEffect` SVG gradient overlay (ChatBox) | Removed |
| `BackgroundRays` component (`_index.tsx`) | Removed |
| `.PromptEffect*` CSS classes (`BaseChat.module.scss`) | Removed |
| Volt AI / Industrial Automation Engine header in chatbox | Removed |
| Raw compiler file output (POUS.c etc.) in console | Hidden |
| `font-bold` / `font-semibold` anywhere in Workbench | Replaced with `font-medium` (500) |
| Hardcoded `gray-*` / `dark:*` classes in sidebar | Replaced with volt theme variables |
| Amber/clay `#c96442` accent color | Replaced with `#4d8eff` |
| Blue-slate `#5a6b8c` (previous brand iteration) | Replaced with `#4d8eff` |
| Table headers in ALL CAPS (TAG NAME, ADDRESS) | Changed to sentence case |
| `box-shadow` on workbench panel | Removed |

---

*Last updated: 2026-07-03 — v3.5.13 (Watch Window, inline tag actions, white button fixes)*

---

## Hardware Connector System (v3.5.9)

The Hardware Connector enables volt.diy to read live register values from real PLC hardware over the network while a project is open in the workbench. It is designed as a lightweight local sidecar — it must never be exposed to the public internet.

### Architecture Overview

```
Browser (React + Nanostores)
        │
        │  HTTP REST  (Vite proxy /api/hardware → localhost:4007)
        │  WebSocket  (Socket.IO /live namespace, same proxy path)
        ▼
hardware-connector  (Node.js, port 4007)
        │
        │  Modbus TCP   jsmodbus
        │  OPC UA       node-opcua-client
        ▼
Real PLC / Hardware device (LAN / VPN only)
```

**Security constraint:** Port 4007 is bound to `localhost` only. The Vite dev-server proxy rewrites `/api/hardware/*` → `http://localhost:4007/*` so the browser never connects to 4007 directly. In production this path is served by a local gateway or VPN tunnel — never a public URL. Credentials entered in the Connect Hardware modal are used for the session only and are never written to `localStorage`, cookies, or any file.

### hardware-connector service (`docker/hardware-connector/`)

| File | Role |
|------|------|
| `server.js` | Express + Socket.IO server, Modbus/OPC UA polling loop |
| `package.json` | Dependencies: `express`, `socket.io`, `jsmodbus`, `node-opcua-client` |

**Endpoints:**

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/health` | Liveness check — `{ status: "ok", version, connections, activePollers, writeCapable, writeAuditEntries }` |
| `POST` | `/connect` | Establish a new Modbus TCP, Modbus RTU, or OPC UA connection. Returns `ConnectionInfo` with discovered tags. |
| `GET` | `/connections` | List all active connections. Returns array of `{ id, deviceName, protocol, host, port, status, tagCount, lastHeartbeat }`. |
| `POST` | `/disconnect` | Tear down a connection by `connectionId`. |
| `GET` | `/tags/:connectionId` | One-shot tag read without Socket.IO. Returns `{ connectionId, tags: Record<name, { value, quality, timestamp }> }`. |
| `POST` | `/scan` | Scan a connected device and return the full discovered tag list. |
| `POST` | `/write` | Write a value to a hardware tag. Body: `{ connectionId, tagName, tagAddress, value, tagType }`. Returns `WriteTagResult`. |
| `GET` | `/audit-log` | Retrieve the in-memory write audit log (newest first, capped at 200 entries). |
| `GET` | `/serial-ports` | Lists available serial ports (Modbus RTU). |

**`POST /write` detail:**

Body fields:
| Field | Type | Description |
|-------|------|-------------|
| `connectionId` | `string` | Active connection to write to |
| `tagName` | `string` | Human-readable tag name (for audit log) |
| `tagAddress` | `string` | Address string, e.g. `coil:4`, `holding:0`, `ns=2;s=Channel1.Device1.Tag1` |
| `value` | `boolean \| number` | Value to write |
| `tagType` | `'coil' \| 'register' \| 'opcua-node'` | Controls which function code is used |

Write routing:
- `coil` → Modbus FC05 `writeSingleCoil` (value coerced to boolean)
- `register` → Modbus FC06 `writeSingleRegister` (value coerced to integer)
- `opcua-node` → OPC UA `session.writeSingleNode()` with DataType inferred from current node value

Response shape:
```json
{ "success": true, "writtenValue": 1, "timestamp": 1751549412000, "auditId": 3 }
{ "success": false, "timestamp": 1751549412000, "error": "FC06 rejected by device" }
```

**Security note:** The write endpoint is only reachable via the Vite proxy (`/api/hardware/write`). Port 4007 must never be exposed to the public internet. Writes are one-shot and do not persist across power cycles — they are not equivalent to a PLC force latch.

**Tag naming convention (Modbus):**

| Register type | Name pattern | Example |
|--------------|--------------|---------|
| Holding register (4x) | `HR000`, `HR001`, … | `HR002 = 12` |
| Input register (3x) | `IR000`, `IR001`, … | `IR003 = -20927` |
| Coil (0x) | `CO000`, `CO001`, … | — |
| Discrete input (1x) | `DI000`, `DI001`, … | — |

**Live tag streaming (Socket.IO):**

1. Client connects to the `/live` namespace via the Vite proxy path.
2. Client emits `subscribe: { connectionId }` → server calls `socket.join("conn:<id>")` and starts polling if not already running.
3. Server polls the device every 500 ms via `pollOnce(connectionId)`.
4. Results are emitted as `tag_update: { connectionId, tags }` on the `liveNs` (`io.of('/live')`) room — **not** the root namespace.
5. Client's `tag_update` handler updates the `liveTagValues` nanostore, triggering a re-render of the Tag Monitor.
6. A `heartbeat` event fires every second with `{ connectionId, ts, tagCount }` to confirm the stream is alive.

**Critical bug fixed in v3.5.9:** `pollOnce()` was calling `io.to(...)` (root namespace) instead of `liveNs.to(...)` (`/live` namespace). Because clients subscribe via the `/live` namespace, tag updates were silently dropped — no values ever reached the browser. Fixed at `server.js` line 226.

### Browser-side store (`app/lib/hardware/`)

| File | Role |
|------|------|
| `hardwareConnectorClient.ts` | Browser EventEmitter client wrapping REST calls + Socket.IO |
| `hardwareStore.ts` | Nanostores atoms + public API functions |

**Atoms:**

| Atom | Type | Description |
|------|------|-------------|
| `hardwareConnectionStatus` | `atom<HardwareConnectionStatus>` | `'disconnected' \| 'connecting' \| 'connected' \| 'error'` |
| `hardwareConnections` | `atom<HardwareConnection[]>` | All known connections this session |
| `liveTagValues` | `map<Record<string, LiveTagValue>>` | Live tag values keyed by tag name |
| `activeConnectionId` | `atom<string \| null>` | The connection currently streaming tags |
| `hardwareLog` | `atom<string[]>` | Timestamped connection log lines |
| `hardwareWriteInProgress` | `atom<Record<string, boolean>>` | Per-tag in-flight write flag (for pending cell state) |
| `hardwareWriteAudit` | `atom<WriteAuditEntry[]>` | Client-side write audit log — session-only, never persisted |

**Public API:**

```ts
connectHardware(options: ConnectOptions): Promise<ConnectionInfo>
disconnectHardware(connectionId?: string): Promise<void>
restoreHardwareConnections(): Promise<void>   // called on page load
getHardwareClient(): HardwareConnectorClient
writeHardwareTag(tagName, tagAddress, value, tagType, connectionId?): Promise<WriteTagResult>
valuesMatch(expected, live, toleranceForReal?): boolean
getTagDisplayMode(connectionStatus, isSimulating): TagDisplayMode
```

**Page-load restore flow (`restoreHardwareConnections`):**

On every workbench mount, `restoreHardwareConnections()` is called. It:
1. Fetches `GET /api/hardware/connections`.
2. Filters for `status === 'connected'` entries.
3. Rebuilds `hardwareConnections` and `hardwareConnectionStatus` atoms.
4. Calls `client.restoreConnection(id)` to set the client's internal `_activeConnectionId` before opening the socket.
5. Calls `client.subscribeToTags(id)` — Socket.IO connects, fires `subscribe` on connect, server starts polling, tag stream begins.

Without step 4, the socket's `connect` handler would emit `subscribe` with a null `connectionId` and the stream would never start.

### Auto-start via Vite plugin

`vite.config.ts` includes `hardwareConnectorProxyPlugin()` which:
1. On dev server start, checks `GET http://localhost:4007/health`.
2. If the service is not running, runs `npm install` in `docker/hardware-connector/` if `node_modules/` is missing, then spawns `node server.js`.
3. Proxies all `/api/hardware/*` HTTP requests to `localhost:4007`.
4. Proxies WebSocket upgrades for the Socket.IO `/live` namespace through the same path.

The plugin uses `new URL('.', import.meta.url).pathname` to resolve the hardware-connector directory — required because `vite.config.ts` uses ESM (`"type": "module"`) where `__dirname` is undefined.

### Connect Hardware Modal (`ConnectHardwareModal.client.tsx`)

The modal has two views controlled by internal `view` state:

**Form view** — shown when no connections exist:
- Protocol selector: Modbus TCP / OPC UA
- Fields: Host, Port, Device name, Slave ID (Modbus) or Username/Password (OPC UA)
- On connect success: transitions to Connected view, does **not** close the modal

**Connected view** — shown when `hardwareConnections.length > 0`:
- Cards for each active connection: status dot, device name, protocol badge, host:port, tag count
- Stats strip: Host / Tags / Status
- Disconnect button per device
- "Add another device" button to return to form view

Depth hierarchy follows platform token rules: dialog=`depth-2`, cards/inputs=`depth-3`, stats strip=`depth-4`.

### Tag Monitor integration (`Workbench.client.tsx` — `PLCBottomPanel`)

The Tag Monitor is the real-time observability panel at the bottom of the Simulation workbench. It has been fully rewritten to unify simulation forcing and hardware writes in a single source-aware context menu.

#### Display modes

The Tag Monitor is always visible when the Tag Monitor tab is active. It renders different column layouts depending on which data sources are available:

**Scenario 1 — Simulation only** (no hardware connected)
- Shows all simulation tags: Tag Name, Address, Type, Value, Force.
- Type badge: `IN` (blue), `OUT` (green), `MEM` (purple).
- "Connect HW" button appears in the toolbar.
- Click any row to toggle the tag value in the simulation engine.
- Right-click → context menu: Force ON / Force OFF / Release Force.

**Scenario 2 — Hardware only** (hardware connected, no sim tags)
- Shows hardware register rows (`HR000`, `IR000`, …) with live values highlighted in blue.
- Type badge: `HW`.
- Right-click → context menu: Write 1 (ON) / Write 0 (OFF).

**Scenario 3 — Both sources active** (sim running + hardware connected)

Three sub-scenarios depending on whether any tag names appear in BOTH sources:

| Section | Condition | Columns |
|---------|-----------|---------|
| **Shared — Expected vs Live** | Tag name in both `plcTags` and `liveTagValues` | Tag, Address, Type, Expected (sim), Live (hw), Match |
| **Simulation Only** | Tag name in sim but not hardware | Tag, Address, Type, Value, Force |
| **Hardware Only** | Tag name in hardware but not sim | Tag, Address, Type, Value (live), SET |

- A **View** toggle row (`Simulation | Hardware | Both`) appears when both sources exist. `Both` is the default.
- The "Expected vs Live" header only shows when `tagView === 'both'` and shared tags exist — the table columns switch layout automatically.
- **Match badge** on shared rows: green `✓` = `valuesMatch()` true (with ±0.5 tolerance for REAL types); amber `≠` = mismatch.
- **Count badge** on the Tag Monitor tab shows the total of all currently visible rows across all sections.

#### Inline Tag Row Actions

Each tag row in the Tag Monitor now has inline action buttons in the **Actions** column (replacing the old Force column). The right-click context menu has been completely removed — all actions are now inline. `onContextMenu` handlers have been removed from all tag rows.

**Simulation tag rows** get three buttons: `● ON` (Force ON), `● OFF` (Force OFF), and when a force is active a `Rel` (Release Force) pill. All are `rounded-full` pills with green/red/amber color states. The active forced state (ON or OFF) is visually highlighted with a filled background. Clicking toggles the simulation tag directly via `forceTag()` / `releaseForce()` — no dialog required.

**Hardware tag rows** get two buttons: `● ON` (Write 1) and `● OFF` (Write 0). Clicking either triggers the hardware write confirmation dialog (same dialog as before). These are one-shot Modbus writes, not persistent forces. `handleForceOrWriteDirect(tagName, source, tagAddress, value)` is the callback used by inline HW buttons; it bypasses the old `contextMenu` state entirely.

**Both row types** also show a **pin button** (push-pin icon, `w-5 h-5` square border) that toggles the tag in/out of the Watch Window. When pinned the button is amber-highlighted; when unpinned it is a faint bordered square.

The source indicator dot is **purple** for simulation tags and **blue** for hardware tags.

**Hardware write confirmation dialog:**
- Shows: tag name, address, device name, value to be written, warning that this is a one-shot Modbus write (not a persistent force).
- "Don't ask again this session" checkbox: sets the module-level `_hwWriteConfirmSkipped = true`. This is a `let` in the module scope — never stored in `localStorage` or cookies.
- On confirm: calls `writeHardwareTag(tagName, tagAddress, value, tagType)`.

**Tag type inference from address:**
- `coil:*` or `discrete:*` prefix → `HardwareTagType = 'coil'` → FC05 write.
- `opc.tcp` or `ns=` prefix → `'opcua-node'` → OPC UA `writeSingleNode`.
- Anything else → `'register'` → FC06 write.

**Per-cell pending and error states:**
- While a write is in flight: cell shows amber `…` (animated pulse) keyed by tag name from `hardwareWriteInProgress` atom.
- On write failure: cell shows red `ERR` with the error message in `title` tooltip.
- Both states clear on the next successful poll or new write attempt.
- Errors also appear as a dismissible notification at bottom-right of the panel.

**Optimistic update:** On successful write, `liveTagValues` is updated immediately with the written value — the UI shows the new value without waiting for the next 500 ms poll tick.

#### Write audit log

Every write attempt (success and failure) is appended to two in-memory audit logs:
1. **Server-side** (`writeAuditLog[]` in `server.js`) — capped at 200 entries, returned by `GET /audit-log`.
2. **Client-side** (`hardwareWriteAudit` atom in `hardwareStore.ts`) — mirrors the server log; populated from write responses. Never persisted to `localStorage` or `IndexedDB`.

Audit entry shape: `{ timestamp, connectionId, tagName, tagAddress, oldValue, newValue, success, error? }`.

#### Tag search

The search box in the toolbar filters all three sections simultaneously (sim-only, hw-only, shared). Empty results show "No matching tags" in the table body. Clearing the search restores all rows without changing the view toggle state.

#### Architecture: atoms involved

| Atom | Type | Description |
|------|------|-------------|
| `plcTags` | `atom<Tag[]>` | Simulation tags from scan engine |
| `liveTagValues` | `map<Record<string, LiveTagValue>>` | Live hardware values, updated every 500 ms |
| `hardwareConnectionStatus` | `atom<HardwareConnectionStatus>` | Controls which display scenario is active |
| `hardwareWriteInProgress` | `atom<Record<string, boolean>>` | Per-tag pending write flag |
| `hardwareWriteAudit` | `atom<WriteAuditEntry[]>` | Client-side write audit, session-only |
| `pinnedTags` | `atom<PinnedTag[]>` | Watch Window pins, project-scoped localStorage |

#### Helper functions (hardwareStore.ts)

```ts
// Compare expected (sim) vs live (hw) values with REAL tolerance
valuesMatch(expected, live, toleranceForReal = 0.5): boolean

// Full write pipeline: in-progress flag → server write → optimistic update → audit append
writeHardwareTag(tagName, tagAddress, value, tagType, connectionId?): Promise<WriteTagResult>

// Determine display mode from current state
getTagDisplayMode(connectionStatus, isSimulating): 'simulated' | 'live' | 'both'
```

**Why sim and hardware tag names may differ:** Simulation tags use IEC 61131-3 symbolic names (`E_STOP`, `P1_OL`) tied to IEC addresses (`I0.0`, `Q0.0`). Hardware Modbus tags default to register-offset names (`HR000`, `IR000`). When a PLC program uses the same symbolic names as the Modbus register map (e.g. after configuring the Modbus register map with matching names in `ConnectOptions.modbusRegisterMap`), they will appear in the Shared — Expected vs Live section.

---

---

## Modbus RTU (Serial) Support (v3.5.10)

Modbus RTU is the serial-line variant of the Modbus protocol family. It uses RS-232/RS-485 physical links instead of TCP/IP, which is common in older industrial hardware, field devices, and PLCs that lack an Ethernet port.

### How it fits into the existing architecture

RTU is handled entirely inside the existing `hardware-connector` service — no new service, no new port. The only differences from Modbus TCP are:

| Aspect | Modbus TCP | Modbus RTU |
|--------|-----------|------------|
| Transport | TCP socket (`net.Socket`) | Serial port (`SerialPort`) |
| jsmodbus client | `Modbus.client.TCP(socket, unitId)` | `Modbus.client.RTU(serialPort, unitId)` |
| Address | host + port | serial port path + baud rate |
| Disconnect | `socket.destroy()` | `serialPort.close()` |
| Tag naming | HR000, IR000, CO000, DI000 | same |
| Polling loop | `pollModbusBatch()` every 500 ms | same |
| Socket.IO stream | same `/live` namespace | same |

### New server endpoints

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/serial-ports` | Lists all available serial ports on the host via `SerialPort.list()`. Returns `[{ path, manufacturer, serialNumber, vendorId, productId }]`. Used by the modal to populate the port dropdown. |

### `POST /connect` — RTU fields

When `protocol: "modbus-rtu"`, the following fields are accepted instead of `host`/`port`:

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `serialPath` | string | **required** | OS path to the serial port, e.g. `/dev/ttyUSB0`, `/dev/tty.usbserial-1410`, `COM3` |
| `baudRate` | number | `9600` | Baud rate. Common values: 9600, 19200, 38400, 57600, 115200 |
| `parity` | `'none'\|'even'\|'odd'` | `'none'` | Parity bit |
| `dataBits` | number | `8` | Data bits |
| `stopBits` | number | `1` | Stop bits (1, 1.5, or 2) |
| `slaveId` | number | `1` | Modbus unit ID (1–247) |
| `deviceName` | string | **required** | Human-readable device name |

### Connect Hardware Modal — Modbus RTU tab

The **Protocol** selector is now a 3-button row: `Modbus TCP | Modbus RTU | OPC UA`.

When **Modbus RTU** is selected:
1. The modal calls `GET /api/hardware/serial-ports` immediately to auto-detect available ports.
2. If ports are found → a dropdown shows `path — Manufacturer` for each port.
3. If no ports detected → a plain text input allows manual entry of the path.
4. Serial configuration fields appear: **Baud Rate** (dropdown: 1200–115200), **Parity** (None/Even/Odd), **Stop Bits** (1/1.5/2).
5. **Unit ID** field (same as Slave ID for TCP) is shown for both Modbus variants.
6. **Host / Port** fields are hidden — replaced entirely by the serial fields.

The `ProtocolBadge` component shows **orange** for Modbus RTU, **blue** for TCP, **purple** for OPC UA.

### TypeScript types updated

```ts
// hardwareConnectorClient.ts
export type HardwareProtocol = 'modbus' | 'modbus-rtu' | 'opcua';

export interface ConnectOptions {
  protocol: HardwareProtocol;
  host?: string;       // TCP protocols only
  port?: number;       // TCP protocols only
  serialPath?: string; // RTU only — /dev/ttyUSB0 or COM3
  baudRate?: number;   // RTU only — default 9600
  parity?: 'none' | 'even' | 'odd'; // RTU only
  dataBits?: number;   // RTU only — default 8
  stopBits?: number;   // RTU only — default 1
  // shared
  deviceName: string;
  slaveId?: number;
  credentials?: { username: string; password: string };
  byteOrder?: 'BE' | 'LE' | 'BE_SWAP' | 'LE_SWAP';
  modbusRegisterMap?: ModbusRegisterDef[];
}
```

### New client method

```ts
// Lists serial ports available on the hardware-connector host machine
client.listSerialPorts(): Promise<SerialPortInfo[]>
```

### Installation

`serialport` v13 is added as a dependency in `docker/hardware-connector/package.json`. It is installed automatically by the Vite `hardwareConnectorProxyPlugin()` auto-start logic (installs npm deps if `node_modules/` is missing before spawning `server.js`).

---

## Live Debugger — What Exists and What Doesn't

**Short answer:** volt.diy has a **live tag monitor** (real-time register values via Socket.IO polling) but **not** a traditional PLC debugger with breakpoints, step-over, or watch windows.

### What is implemented

#### 1. Tag Monitor (hardware-connector + browser)
- Polls the connected PLC every 500 ms via `pollModbusBatch()` or OPC UA read.
- Pushes `tag_update` events over Socket.IO `/live` namespace to the browser.
- Browser `liveTagValues` nanostore updates in real time.
- Tag Monitor table shows live register values (`HR000 = 12`, `IR002 = -20943`, etc.).
- **Actions** column: inline `● ON` / `● OFF` pill buttons for sim force and hw write; push-pin button for Watch Window.

#### 2. OpenPLC Runtime debug stream
- When the PLC program is running on OpenPLC (via Docker sidecar), `openplcClient.ts` opens a Socket.IO connection to `https://localhost:8443/api/debug`.
- Sends `debug_command` events with binary-encoded read/write commands (OpenPLC wire format).
- Receives `debug_response` events with tag values from the running PLC cycle.
- The `OpenPLCRuntimePanel` component shows the scan cycle counter, runtime status (IDLE / RUNNING / ERROR), and current tag values from the live PLC execution.
- This is OpenPLC's own debug protocol — it reflects the actual values inside the running PLC program at each scan cycle.

#### 3. Simulation Tag forcing
- In simulation mode (no hardware), tags can be forced to `0` or `1` via the Tag Monitor inline action buttons.
- Forces are applied synchronously to the simulation scan engine and reflected immediately in the Ladder Logic grid view.

#### 4. Oscilloscope View (v3.5.11)

The Oscilloscope is a live waveform view inside the Preview tab (Grid / Canvas / **Oscilloscope**).

- Auto-creates a channel for every tag seen in either sim or hardware source.
- Continuously buffers up to 500 samples per tag in a rolling window (oldest-first).
- Configurable time window: 5 s / 10 s / 30 s / 60 s.
- Bool tags render as stepped lines (`stepped: 'before'`); numeric tags render as smooth lines.
- **Run / Pause** button: while paused, the x-axis is frozen at the pause moment — data continues buffering in the background. Resuming scrolls to live position.
- **Clear**: removes all samples but keeps channel definitions.
- **Export CSV**: downloads all visible channel data as `oscilloscope_<timestamp>.csv`.
- **Channel sidebar**: toggle individual tag visibility; shows `B` (bool) or `#` (numeric) type indicator.

Architecture:
- `app/lib/hardware/oscilloscopeStore.ts` — rolling-buffer atoms (`oscChannels`, `oscRunning`, `oscTimeWindow`) and `appendSamples()`.
- `appendSamples(tags, source, timestamp?)` is called from two places:
  - `plcSimulator.ts` engine callback — every scan tick (~50 ms) for simulation tags.
  - `hardwareStore.ts` `tags:updated` event handler — every 500 ms for hardware tags.
- Data always buffers regardless of `oscRunning` state (pausing only freezes the visible window).
- `app/components/workbench/OscilloscopeView.client.tsx` — Chart.js `LinearScale` line chart, 60fps RAF loop.

### What is NOT implemented (planned)

| Feature | Status |
|---------|--------|
| Breakpoints in ST/Ladder code | ❌ Not implemented |
| Step-over / step-into scan cycle | ❌ Not implemented |
| Watch window for arbitrary expressions | ❌ Not implemented |
| Online program editing (hot-patch) | ❌ Not implemented |

A full cycle-by-cycle PLC debugger would require either: (a) OpenPLC's debug protocol being extended to support pause/step commands, or (b) a custom simulation engine that can pause mid-scan and expose internal variable state — both are planned but not yet built.

---

## Watch Window (Pinned Tags Panel) (v3.5.13)

The Watch Window is a persistent floating panel anchored to the bottom-right of the workbench. It lets users pin specific tags from the Tag Monitor for continuous monitoring — independent of which part of the table they're scrolled to. It is only shown on the **Preview**, **Simulation**, and **Connections** tabs.

### State layer (`app/lib/plc/watchStore.ts`)

```ts
export type WatchSource = 'simulation' | 'hardware' | 'openplc';

export interface PinnedTag {
  tagName: string;
  source: WatchSource;
  pinnedAt: number;  // Date.now() at pin time
}

export const pinnedTags = atom<PinnedTag[]>(_load());
export const isWatchPanelCollapsed = atom<boolean>(_loadCollapsed());

export function pinTag(tagName: string, source: WatchSource): void
export function unpinTag(tagName: string, source: WatchSource): void
export function isTagPinned(tagName: string, source: WatchSource): boolean
export function clearAllPinned(): void
```

**Storage:**
- Pins are stored in `localStorage` under the key `volt_watch_pins_${window.location.pathname}` — project-scoped so pins from one project don't bleed into another.
- Collapse state is stored under `volt_watch_collapsed`.
- Neither key stores tag values or credentials — only symbolic tag names and source identifiers.
- `pinTag()` is a no-op if the same `tagName + source` combination is already pinned (deduplication).

### Component (`app/components/workbench/WatchPanel.client.tsx`)

The WatchPanel renders as a fixed-width overlay (`w-[520px]`) anchored at the bottom-right of the workbench container with `absolute bottom-0 right-2` positioning.

**Header bar:**
- Title "Watch Window" with a count badge showing the number of pinned tags.
- "Clear all" button — removes all pins via `clearAllPinned()`.
- Chevron collapse/expand button — toggles `isWatchPanelCollapsed`. When collapsed, a summary legend row shows how many Sim/HW/OPC pins are active (coloured dots).

**Tag table columns:** Tag Name (with source dot) | Address | Type | Value | Force/SET | Unpin (×)

**Source dot colours:**
- Purple (`bg-purple-400`) — simulation
- Blue (`bg-blue-400`) — hardware
- Green (`bg-green-400`) — openplc

**Value display:**
- Simulation tags: green highlight when `1`, dimmed when `0`; shows `F` badge if forced.
- Hardware/OPC tags: blue highlight. Shows `offline` in italic when the hardware connection is disconnected.
- Pending write: amber `…` (animated pulse).
- Write error: red `ERR` with error in `title` tooltip.

**Inline actions from Watch Window:**
- Left-clicking a simulation row calls `toggleTag()` directly.
- Right-clicking any row opens a context menu (portalled to `document.body` to escape framer-motion `transform` ancestors) with Force ON / Force OFF / Release Force for sim tags, and Write 1 / Write 0 for HW tags.
- The HW write path shows the same confirmation dialog as the Tag Monitor (portalled to `document.body`, `z-10000`).
- The unpin `×` button is always visible at the right of each row.

**Portalling:** Both the context menu and the HW write confirm dialog are portalled to `document.body` via `createPortal` from `react-dom`. This is required because the workbench uses framer-motion `transform` on an ancestor, which causes `position: fixed` elements inside to behave as `position: absolute` (scoped to the nearest transform parent). Portalling places them outside that ancestor.

**Background token:** All floating surfaces (context menu, confirm dialog, header buttons) use `background: var(--volt-elements-bg-depth-2)` inline style — NOT the Tailwind class `bg-volt-elements-background-depth-2` which maps to the same CSS variable but requires UnoCSS to generate the rule. All native `<button>` elements use `style={{ background: 'transparent' }}` to override the browser's default white fill.

### Placement in Workbench

```tsx
{(selectedView === 'preview' || selectedView === 'simulation' || selectedView === 'hardware') && (
  <div className="absolute bottom-0 right-2 lg:right-4 w-[520px] max-w-[calc(100%-16px)] z-20 shadow-xl rounded-t-lg overflow-hidden border border-volt-elements-borderColor border-b-0">
    <WatchPanel />
  </div>
)}
```

The panel is only mounted on `preview`, `simulation` (`hardware` tab maps to `selectedView === 'hardware'`), and Connections tabs. It does not appear on Code, Diff, I/O Studio, Verify, Deploy, or Migration tabs.

### Pinning from Tag Monitor

The Tag Monitor Actions column includes a pin button (push-pin icon) on every sim and hw tag row. Clicking it calls `pinTag()` or `unpinTag()`. The button reflects pin state reactively via `useStore(pinnedTags)` — it turns amber when pinned.

### Tests (`app/tests/watch-panel.test.ts`)

17 Vitest tests covering:
- `pinTag`: adds entry, deduplicates same name+source, allows same name from different sources, sets `pinnedAt`, persists to localStorage
- `unpinTag`: removes correct entry, leaves other-source entries, no-op for nonexistent, updates localStorage
- `isTagPinned`: true/false/wrong-source checks
- `clearAllPinned`: clears all, clears localStorage
- `isWatchPanelCollapsed`: defaults false, persists to localStorage
- Reactivity: subscription receives correct snapshot sequence `[0, 1, 2, 1]` through pin/unpin cycle

---

*v3.5.13 — Watch Window (Pinned Tags Panel) fully implemented: `watchStore.ts` nanostores atom with project-scoped localStorage persistence (`volt_watch_pins_${pathname}`); `WatchPanel.client.tsx` with header collapse, source dot colours, value/force/pending/error states, context menu and HW write confirm dialog both portalled to `document.body`; 17 Vitest tests all passing. Tag Monitor Actions column: replaced right-click context menu entirely with inline `● ON` / `● OFF` pill buttons for force/write and a push-pin toggle for Watch Window; `handleForceOrWriteDirect` callback; dead context menu code (`openContextMenu`, `handleForceOrWrite`, `contextMenu` state, `ContextMenuState` interface, `onContextMenu` handlers, `createPortal` import) fully removed from Workbench.client.tsx. All button white-background regressions fixed: inline `style={{ background: 'transparent' }}` on all native button elements; portalled surfaces use `background: var(--volt-elements-bg-depth-2)` (correct CSS variable) not the `bg-volt-elements-background-depth-2` Tailwind class.*

*v3.5.12 — Oscilloscope buffering fix: removed `oscRunning` guard from `appendSamples()` so data is always captured regardless of pause state; pausing now only freezes the x-axis window (stored in `pausedAtRef`). Removed Sim+Live status badge from Tag Monitor toolbar per user request.*

*v3.5.11 — Tag Monitor consolidation, hardware write forcing, oscilloscope, and mode-aware display (Phases 0–6):*
*Phase 1: Deleted dead `liveTagStore.ts` and `openplcBridge.ts`; removed `updateTagsFromScanEngine` call from `scanEngine.ts`. Phase 2: Added `POST /write` endpoint to `hardware-connector/server.js` (v1.2.0) with Modbus FC05/FC06 and OPC UA `writeSingleNode` routing, old-value snapshot, in-memory write audit log capped at 200 entries, `GET /audit-log` endpoint, `writeCapable` in `/health`. Phase 3: Extended `hardwareConnectorClient.ts` with `writeTag()` and `getAuditLog()`; extended `hardwareStore.ts` with `hardwareWriteInProgress` atom, `hardwareWriteAudit` atom, `writeHardwareTag()` (sets in-progress flag → writes → optimistic update → audit append), `valuesMatch()`, `getTagDisplayMode()`. Phase 4: Unified source-aware force/write context menu in Tag Monitor; sim tags → immediate `forceTag()` / `releaseForce()`; hw tags → hardware write confirmation dialog with "Don't ask again this session" (`_hwWriteConfirmSkipped` module-level boolean, never persisted); per-cell pending (`…`) and error (`ERR`) states from `hardwareWriteInProgress` atom; dismissible error notification bottom-right. Phase 5: Mode-aware Tag Monitor display — computed `sharedTagNames` (tags in both sim and hardware), rendered as "Shared — Expected vs Live" section with Expected (purple) / Live (blue) / Match (✓/≠) columns using `valuesMatch()`; sim-only and hw-only in labelled subsections; table header switches between 5-column and 6-column layout based on view mode. Phase 6: Search filter covers all three sections; "No matching tags" empty state; cross-view persistence verified. Oscilloscope: `oscilloscopeStore.ts` rolling-buffer store, `OscilloscopeView.client.tsx` Chart.js LinearScale waveform view with Run/Pause/Clear/CSV, 60fps RAF loop, channel sidebar with visibility toggle; `appendSamples()` called from both sim engine callback and hardware `tags:updated` event; Preview tab gains third Oscilloscope view mode.*

*v3.5.10 — Modbus RTU over serial implemented end-to-end. `serialport` v13 added to hardware-connector. New `GET /serial-ports` endpoint auto-detects available ports. `POST /connect` accepts `protocol: "modbus-rtu"` with `serialPath`, `baudRate`, `parity`, `dataBits`, `stopBits`. ConnectHardwareModal protocol selector expanded to 3 buttons (TCP / RTU / OPC UA); RTU view shows auto-detected port dropdown with manual fallback + serial config fields. `HardwareProtocol` type updated to include `'modbus-rtu'` across client, store, and modal. `HardwareConnection.protocol` type updated in store.*

*v3.5.9 — Hardware Connector live tag streaming fixed end-to-end. Root bug: `server.js` `pollOnce()` emitted `tag_update` on the root Socket.IO namespace (`io.to(...)`) but clients subscribe via the `/live` namespace (`liveNs`). Fixed to `liveNs.to(...)`. Page-load restore: `restoreHardwareConnections()` now calls `client.restoreConnection(id)` before `subscribeToTags(id)` so the socket `connect` handler has a non-null `_activeConnectionId` to subscribe with. Tag Monitor rewritten: single `Value` column (removed dual Expected/Live column complexity); Simulation / Hardware / Both view toggle appears only when both sources exist; section dividers with coloured dots; count badge tracks total visible rows; no white-background button regression (all toggle states use CSS variable tokens or inline `background: transparent`).*

*v3.5.8 — OpenPLC Runtime end-to-end pipeline verified and fixed. Root cause of login 401: admin user was inserted with a hardcoded `'PEPPER'` string instead of the actual 64-char hex pepper from `/run/runtime/.env` (generated by OpenPLC's `config.py` via `secrets.token_hex(32)` on first boot). Fixed by reading the real pepper and rehashing the password with werkzeug `pbkdf2:sha256:600000`. Full pipeline manually verified: login → JWT → STruC++ generate 79KB C++ ZIP → `POST /api/upload-file` → g++ C++17 compilation → `libplc.so` built → `GET /api/start-plc` → `STATUS:RUNNING`. Stale README references cleaned: removed IronPLC/FRET references from architecture diagram, ValidationAgent docs, dependencies table, and PipelineState interface; removed duplicate v3.5.7 changelog entry; corrected directory tree (docker/fret-service/ and services/ removed, docker/ now shows actual layout).*

*v3.5.7 — Service cuts: removed IronPLC validator (port 4002), Arduino compile-server (port 3210), and FRET NLP (port 4005). IronPLC: MatIEC covers full IEC 61131-3 compilation; IronPLC only added marginally better error messages at the cost of a full Docker container. Compile-server: arduino-cli is hobbyist/embedded scope creep for a B2B industrial automation platform. FRET NLP: CLMPropertySynthesizer auto-generates ESBMC YAML properties from the code graph; FRET requires users to write FRETish (NASA restricted language); its LTL output was only partially consumed by ESBMC k-induction. Also removed FUXA: volt-svg-loader.ts was written but never imported, volt-hmi-bridge service never wired into app, 78 SVG files in public/volt-symbols/ never loaded. Deleted: docker/ironplc/, docker/fret-service/, docker/fuxa/, services/ (entire dir), public/volt-symbols/, app/lib/validators/ironplc-client.ts, app/lib/plc/ironplcMCPClient.ts, app/lib/plc/hmi/volt-svg-loader.ts, app/lib/plc/hmi/volt-svg-index.ts. Moved: services/matiec-validator/ → docker/matiec-validator/, services/strucpp-codegen/ → docker/strucpp-codegen/. Updated: docker-compose.yaml (7→4 services), multiAgentPipeline.ts (6→4 stages), quality-pipeline.ts (4→3 gates), validationAgent.ts (MatIEC only), pipelineMachine.ts, serviceHealth.ts, fatEvidencePackage.ts (8→7 PDF sections).*

*v3.5.6 — ModeSelector completely rewritten as a two-panel portal layout (ModeSelector.tsx): mode panel is `position: absolute` anchored `bottom: 100%` / `right: 0` directly above the trigger button; permission panel is rendered via `createPortal(_, document.body)` as `position: fixed` using `getBoundingClientRect()` on the mode panel for pixel-accurate placement, `z-index: 99999` to float above the workbench and all other layers. No selected-item background highlight — only the blue checkmark indicates active mode. CLM pipeline race condition fixed (workbench.ts): replaced direct `#triggerVerificationPipeline` call with `#syncCLMThenPipeline` which (1) synchronously calls `stToCLM` + `setProject` before firing the pipeline, eliminating the case where `CLMPropertySynthesizer` ran while `clmProject` was still null (was showing "No CLM project loaded — skipping" in Verify tab); (2) fires the pipeline; (3) upgrades to tree-sitter async parse in background. CLMPropertySynthesizer completely rewritten (clmPropertySynthesizer.ts): old version checked `attrs.type === 'interlock'` which never matched real graphBuilder output (actual field is `attrs.node.kind`). New version uses the real `GraphNodeAttrs { node, rungIndex, depth, reachable }` shape with six synthesis methods (coil mutual exclusion, contact safety invariants, function block properties, assignment invariants, comparison properties, SFC properties). Manually verified with DualPumpWaterLevel: 14 nodes → 6 properties (2 timer invariants, 1 counter reachability, 1 edge-detector response, 2 safety-critical assignment invariants). pipelineMachine.ts stage message corrected: shows "CLM loaded — no verifiable patterns found" vs "No CLM project loaded" based on actual atom state. Sync button removed from workbench top bar (Workbench.client.tsx). ThoughtBox (ThoughtBox.tsx) overflow fixed: added `w-full overflow-hidden` to outer div, `overflow-y-auto` to content div — prevents expanded Thought component from extending into workbench area. Chat/workbench split width confirmed at `--chat-min-width: 533px` (matches old platform — no change made).*

*v3.5.5 — Critical bug fix: agent mode file creation completely rewritten. Root cause of files never appearing in workbench: old pipeline serialized generated files to `<plcAction>` XML tags, streamed them via StreamingMessageParser, routed through action-runner.ts which computed wrong relative paths (path-browserify `nodePath.relative('/home/project', 'src/main.st')` → `../../src/main.st` in browser), and depended on an async WebContainer file watcher for UI store updates. New approach: `workbenchStore.createFileFromAgent(relativePath, content)` writes directly to WebContainer and updates the files store synchronously after agent returns its structured `generatedFiles` array from `Chat.client.tsx`. The `<plcAction>` XML pipeline is unchanged for standard LLM streaming mode. Supporting fixes: `action-runner.ts` path computation (handles workdir-prefixed, absolute, and bare relative paths correctly); `enhanced-message-parser.ts` `_normalizeFilePath` (strips leading `/` instead of adding it); `workbench.ts` `_runAction` fullPath (no double-join for workdir-prefixed paths). Siemens SCL corpus: 42 FB/FC units extracted from Siemens-SCL-Source-Files repo, Gemini-described, added to seed-corpus.jsonl (26 → 68 entries). Categories: timer (17), alarming (8), safety (4), edge_detection (3), valve_control (3), id_validation (2), buffer_management (1), data_persistence (1), recipe_management (1), simulation (1), state_machine (1). PLATFORM.md version → 3.5.5.*

*v3.5.4 — CodingAgent v2.0 rewrite (codingAgent.ts): switched from raw ST text output to structured JSON output path (`STGenerationOutput` schema — `reasoning`, `code`, `confidence`, `uncertainSections`). LLM now populates the hidden `reasoning` field (variablesNeeded, logicFlow, functionBlocksUsed, safetyConsiderations) BEFORE writing `code`, enforcing chain-of-thought planning at the schema layer rather than via verbal instruction. `buildDynamicRulesSection(context)` injects complexity-specific rule blocks at call time based on keyword detection: state machine/CASE rules for sequence logic; PID signature + clamping rules; named intermediate BOOL interlock matrix requirements; explicit CTU/CTD reset rules. New safety compliance section in system prompt: E-STOP NC fail-safe requirement, safe-state fallback documentation, ambiguous safety → safer default interpretation. `callLLMStructured` now threaded through both orchestrator paths (`executeMultiAgent` at line 133 + `autonomousAgent.execute` at line 78). `CodingResult` interface extended with `reasoning`, `confidence`, `uncertainSections`. `AgentContext.ragResults` extended with optional `description` field. `types.ts` updated accordingly. PLATFORM.md version → 3.5.4.*

*v3.5.3 — Critical orchestrator fix: needsGeneration boolean flag prevents CodingAgent from re-running on every loop iteration, so DebuggingAgent fixes are now actually preserved between validation retries (was the root cause of persistent 19-error loops). Same fix applied to AutonomousAgent. DebuggingAgent rebuilt: structured JSON output (DebugResponseSchema Zod), code shown with line numbers and 3-line error context snippets in prompt, dual code-path (callLLMStructured primary / callLLM fallback). CodingAgent system prompt strengthened: NEGATIVE EXAMPLES section for VAR blocks / multi-line expressions / FB calls; MANDATORY SELF-CHECK expanded to 10 items including "ZERO comments in ENTIRE program". RAG seed corpus pipeline (scripts/build-rag-corpus.ts, 841 lines): clones OpenPLC_Tutorials + Agents4PLC_release + awesome-structured-text on first run; scans 7 source directories; extracts PROGRAM/FUNCTION_BLOCK/FUNCTION via regex; deduplicates against autoplc-corpus.jsonl (1143 entries); validates each unit through MatIEC Docker via docker exec + curl on :4001; generates one-sentence Gemini descriptions via Vertex AI OAuth2 (RS256 JWT service account auth); writes to app/lib/rag/seed-corpus.jsonl (26 verified entries, 23 Gemini-described); checkpoint/resume at scripts/.rag-seed-checkpoint.jsonl — re-runs skip already-validated units. initOscatRAG() patched to load seed-corpus.jsonl automatically (docs = [...oscatDocs, ...autoplcDocs, ...seedDocs]). LanceDB .lance-data/ cleared on each pipeline run for clean re-index. Google provider cleaned to production models only: gemini-3.5-flash (default, 1M context) + gemini-3.1-pro (escalation tier). E2E verification standalone script (scripts/verify-pipeline-e2e.ts): OAuth2 bearer token from service account JSON; tests 8 scenarios; all pass. 30 unit tests continue to pass.*

*v3.5.2 — Vendor adapter fidelity 40% → 90%: Rockwell full instruction set + tokenizer + canonical CLMArithmeticNode shape; Siemens normalizeSCL FUNCTION_BLOCK/FUNCTION kind preservation + lastIndexOf END_VAR body extraction + timer/counter type pass-through; CODESYS full PLCOpenXML variable classes + fast-xml-parser plain-string fixes; OpenPLC header strip; stToCLM POU case preservation + VAR_GLOBAL top-level parsing + __GLOBAL__ sentinel; roundTrip 4-dimensional RoundTripMetrics (35/40/15/10 weights) + content-based node comparison; RoundTripPanel per-dimension fidelity bars; tests/vendor-roundtrip.test.ts — all 4 vendors pass 75% threshold*

*v3.5.1 — Agent pipeline hardening: single-LLM multi-file generation with ===FILE:=== markers, sanitizeSTCode 9-fix post-processor, AgentThinking per-step auto-collapse + main container collapse, dynamic title (Thinking→Planning→Implementing→Validating→Fixing→Build Successful), live streamDetailText word-by-word streaming, ThinkingBlock suppression in agent mode, line-by-line artifact streaming with 600ms delay after collapse, warm stone color palette (#A8A49E/#8f8b84) replacing all cool grays, ModeSelector trigger rest color #A8A49E, permission label #8f8b84, PLATFORM.md agentic architecture fully documented*

---

## Logic Tab (PLCPreview) — Unified Toolbar & Multi-Language Views (v3.5.14)

The **Logic** tab (formerly "Preview") is the live diagram workbench inside the volt.diy simulation panel. In v3.5.14 its two separate toolbar rows were merged into one, the diagram-language selector was expanded with full names, and FBD/SFC AI generation was made reliable.

### Single-row combined toolbar

The old PLCPreview rendered two separate `<div>` toolbar rows: one for LD/FBD/SFC language switching, one for Grid/Canvas/Scope view switching. Both rows are now merged into a single `min-h-[36px]` bar:

```
[ Ladder Diagram | Function Block | Sequential Function ]        [ Grid | Canvas | Scope ]
  ← left-aligned pill slider                                       right-aligned pill slider →
```

- **Left pill slider** — `activeDiagramLanguage` atom: Ladder Diagram / Function Block / Sequential Function
- **Right pill slider** — `viewMode` state: Grid / Canvas / Scope (FBD/SFC only show Canvas/Scope; Grid is LD-only)
- Both use the neutral pill container style (`bg-volt-elements-background-depth-1 rounded-full px-1 py-0.5`)

Full names were a deliberate decision: the old abbreviations (LD / FBD / SFC) were cryptic to new users. The expanded labels stay in the `text-xs px-2.5 py-1` size so they fit comfortably in the bar.

#### Toolbar implementation (`PLCPreview.client.tsx`)

```tsx
const langButtons = [
  { value: 'ld',  label: 'Ladder Diagram' },
  { value: 'fbd', label: 'Function Block' },
  { value: 'sfc', label: 'Sequential Function' },
] as const;

const viewButtons = diagLang === 'ld'
  ? [{ value: 'grid', label: 'Grid' }, { value: 'canvas', label: 'Canvas' }, { value: 'scope', label: 'Scope' }]
  : [{ value: 'canvas', label: 'Canvas' }, { value: 'scope', label: 'Scope' }];
```

Active button styles use:
- Active: `bg-volt-elements-item-backgroundActive text-volt-elements-item-contentActive`
- Inactive: `text-volt-elements-item-contentDefault hover:bg-volt-elements-item-backgroundActive ...`
- Native `<button>` inactive state: always add `style={{ background: diagLang === btn.value ? undefined : 'transparent' }}` to override browser default white fill.

### activeDiagramLanguage atom

Defined in `app/lib/stores/plcSimulator.ts`:

```ts
export type DiagramLanguage = 'ld' | 'fbd' | 'sfc';
export const activeDiagramLanguage = atom<DiagramLanguage>('ld');
```

`PLCPreview.client.tsx` reads it with `useStore(activeDiagramLanguage)`.

### FBD Renderer (`app/lib/fbd/fbdRenderer.ts`)

Renders a Function Block Diagram from a JSON schema onto an HTML5 `<canvas>`.

**Schema:**
```json
{
  "blocks": [
    {
      "id": "b1",
      "type": "AND",
      "label": "Safety gate",
      "inputs":  [{ "name": "IN1", "connectedFrom": "b0.OUT" }, { "name": "IN2" }],
      "outputs": [{ "name": "OUT" }]
    }
  ],
  "wires": [
    { "fromBlockId": "b0", "fromOutput": "OUT", "toBlockId": "b1", "toInput": "IN1" }
  ]
}
```

**Block types:** `AND`, `OR`, `NOT`, `XOR`, `ADD`, `SUB`, `MUL`, `DIV`, `GT`, `LT`, `GE`, `LE`, `EQ`, `NE`, `TON`, `TOF`, `CTU`, `CTD`, `SR`, `RS`, `MOVE`, `SEL`, `MUX`, any FB name.

**Layout rules:**
1. Each block is 80 × (max(inputs, outputs) × 20 + 20) px.
2. Blocks are arranged left→right in topological order (wires never go backwards).
3. Input pins on the left edge, output pins on the right edge.
4. Wires are cubic bezier curves (control points offset +60 / -60 on x-axis).
5. `connectedFrom` references are drawn from the source block's output pin.
6. Unconnected input pins render a dashed stub to the left.
7. Block label is drawn in the header row, block type in a smaller sub-label.

### SFC Renderer (`app/lib/sfc/sfcRenderer.ts`)

Renders a Sequential Function Chart from a JSON schema onto `<canvas>`.

**Schema:**
```json
{
  "steps": [
    { "id": "s0", "name": "Idle",     "isInitial": true,  "actions": [{ "qualifier": "N", "variable": "PUMP1", "value": "FALSE" }] },
    { "id": "s1", "name": "Pumping",  "isInitial": false, "actions": [{ "qualifier": "S", "variable": "PUMP1" }] }
  ],
  "transitions": [
    { "id": "t0", "fromStepId": "s0", "toStepId": "s1", "condition": "START_BTN" },
    { "id": "t1", "fromStepId": "s1", "toStepId": "s0", "condition": "LEVEL_HIGH" }
  ]
}
```

**Qualifier meanings:** `N` = non-stored (while active), `S` = set (latch), `R` = reset (unlatch), `P` = pulse on rising edge, `L` = time-limited, `D` = time-delayed.

**Layout rules:**
1. Steps are stacked vertically with 80 px spacing.
2. Transitions are drawn between steps as horizontal bar + condition label.
3. The initial step renders with a double border.
4. Active step (from simulation state) renders with a filled blue background.
5. Back-edges (transitions that go upward) are drawn as right-side arcs.

### AI generation — 7 mandatory files (`prompts.ts` + `codingAgent.ts`)

#### System prompt changes (`app/lib/common/prompts/prompts.ts`)

Rule #0 and Rule #6 were updated to require **7 mandatory files** (was 5). The two new additions:

| File | Purpose |
|------|---------|
| `fbd/diagram.json` | Function Block Diagram for the FBD view |
| `sfc/program.json` | Sequential Function Chart for the SFC view |

Full FBD schema section was added to the system prompt with:
- Block object shape (`id`, `type`, `label?`, `inputs[]`, `outputs[]`)
- `connectedFrom` format: `"blockId.outputName"`
- `wires[]` array shape (`fromBlockId`, `fromOutput`, `toBlockId`, `toInput`)
- 7 generation rules (connected inputs get `connectedFrom`, unconnected omit it, block count ≥ rung count, etc.)

Full SFC schema section was added with:
- `steps[]` shape (`id`, `name`, `isInitial`, `actions[]`)
- `transitions[]` shape (`id`, `fromStepId`, `toStepId`, `condition`)
- 7 generation rules (one initial step, no orphan steps, condition from variable names, etc.)

All references to "Preview tab" were updated to "Logic tab" throughout the prompt.

FINAL REMINDER in the prompt lists all 7 files explicitly.

#### codingAgent.ts changes

- Updated prompt preamble from "5 project files" to "7 project files"
- Added `===FILE:fbd/diagram.json===` marker with example JSON
- Added `===FILE:sfc/program.json===` marker with example JSON
- Added `generateFBDFallback(files)` — derives FBD blocks from `ladder/logic.json` rungs when AI omits the file
- Added `generateSFCFallback(files)` — derives SFC steps/transitions from rung coils and contacts, always closes a cycle back to the initial step
- Both fallback generators are called in `buildFiles()` and in `parseTextResponse()` fallback path so FBD/SFC always exist in the output even if the LLM skips them

---

## UI Design System — Pill Slider Rule (v3.5.14)

### The rule

**Blue** (`item-contentAccent` / `item-backgroundAccent`) is reserved **exclusively** for the top-level Workbench tab navigation strip (Code / Diff / Logic / Simulation / I/O Studio / Verify / Deploy / Migration / Connections). This is the `<Slider>` component's default appearance and must NOT be used anywhere else.

**All nested toggles** within a tab's content area — diagram-language selectors, view-mode selectors, sub-tab bars, filter groups, time-window pickers — use the **neutral active-pill** style:

```tsx
// Container
<div className="flex items-center gap-0.5 bg-volt-elements-background-depth-1 rounded-full px-1 py-0.5">

  // Button (active)
  <button
    style={undefined}  // ← let UnoCSS bg class take effect
    className="... rounded-full bg-volt-elements-item-backgroundActive text-volt-elements-item-contentActive"
  />

  // Button (inactive)
  <button
    style={{ background: 'transparent' }}  // ← override browser white default
    className="... rounded-full text-volt-elements-item-contentDefault hover:bg-volt-elements-item-backgroundActive hover:text-volt-elements-item-contentActive"
  />

</div>
```

The `style={{ background: 'transparent' }}` on inactive native `<button>` elements is mandatory — without it the browser renders its own white background on the button, creating unwanted bright squares inside the dark pill container.

### Components updated in v3.5.14

| Component | Toggle group | Change |
|-----------|-------------|--------|
| `PLCPreview.client.tsx` | LD/FBD/SFC language selector | Replaced Slider + separate row with single pill container, full names |
| `PLCPreview.client.tsx` | Grid/Canvas/Scope view selector | Moved into combined row, pill container |
| `IOStudio.client.tsx` | TABS map (Device Config / Tag Map / …) | Wrapped in pill container, neutral active colors |
| `CompilerConsole.tsx` | Problems / I/O Glue tabs | Wrapped in pill container, `py-1` |
| `OscilloscopeView.client.tsx` | Time window 5s/10s/30s/60s | Wrapped in pill container, neutral active colors |
| `Workbench.client.tsx` — VerifyTabLayout | Pipeline / FAT / Round-Trip sub-tabs | Wrapped in pill container, neutral active |
| `Workbench.client.tsx` — PLCBottomPanel | Tag Monitor / OpenPLC Runtime tabs | Wrapped in pill container, neutral active |
| `Workbench.client.tsx` — tag view filter | Simulation / Hardware / Both | Wrapped in pill container, count `<span>` moved outside pill div as sibling |

The **top Workbench Slider** (Code/Diff/Logic/…) uses the `<Slider>` component with blue accent and was **not changed**.

### JSX structure for the tag view filter (important)

The count badge `<span>` must be a **sibling** of the pill `<div>`, not a child inside it. The correct structure:

```tsx
<div className="flex items-center gap-1 px-3 py-1.5 ...">  {/* outer row */}
  <span className="text-[10px] text-volt-elements-textTertiary mr-1">View:</span>
  <div className="flex items-center gap-0.5 bg-volt-elements-background-depth-1 rounded-full px-1 py-0.5">
    {(['sim', 'hw', 'both']).map((v) => (
      <button ...>{label}</button>
    ))}
  </div>   {/* ← pill closes HERE, before the count span */}
  <span className="ml-auto text-[10px] text-volt-elements-textTertiary">
    {tagView === 'both' ? [...].join(' · ') : ...}
  </span>
</div>
```

Placing the `</div>` after the `map` but before the `span` is what prevents the JSX parse error `"}" is not valid inside a JSX element`.

---

*v3.5.14 — 2026-07-03: PLCPreview single combined toolbar: LD/FBD/SFC pill slider with full names (Ladder Diagram / Function Block / Sequential Function) + Grid/Canvas/Scope sub-slider, both in one `min-h-[36px]` header bar; `activeDiagramLanguage` atom (`DiagramLanguage = 'ld' | 'fbd' | 'sfc'`) in `plcSimulator.ts`; FBD renderer (`fbdRenderer.ts`) cubic-bezier wire layout; SFC renderer (`sfcRenderer.ts`) vertical step stack with back-edge arcs. AI generation: `prompts.ts` expanded from 5 to 7 mandatory files with full FBD schema (blocks/wires) and SFC schema (steps/transitions/qualifiers); `codingAgent.ts` 7-file markers + `generateFBDFallback()` + `generateSFCFallback()` fallback generators invoked when LLM omits either file. Platform-wide neutral pill slider rule applied: IOStudio TABS, CompilerConsole Problems/I/O Glue, OscilloscopeView time window, VerifyTabLayout Pipeline/FAT/Round-Trip, PLCBottomPanel Tag Monitor/OpenPLC Runtime, tag view filter Sim/HW/Both — all wrapped in `bg-volt-elements-background-depth-1 rounded-full px-1 py-0.5` pill containers with `bg-volt-elements-item-backgroundActive` active state and `style={{ background: 'transparent' }}` on inactive buttons. Top workbench Slider unchanged. JSX tag-filter fix: count `<span>` moved outside pill `<div>` as sibling to resolve `"}" is not valid inside a JSX element` build error at line 1083.*

---

## Layout Rules — Chat / Workbench Split (MUST NOT CHANGE)

These rules were established after finding and fixing regressions in v3.6.x. Violating them causes visual gaps, misaligned panels, or broken message widths.

### 1. Message wrapper in `Messages.client.tsx`

The inner div wrapping each message **must use `grid grid-col-1 w-full`**, not a flex trick:

```tsx
// ✅ CORRECT — matches old platform, gives full width to content
<div className="grid grid-col-1 w-full">

// ❌ WRONG — w-0 flex-1 causes incorrect width calculation with gap-4 on parent,
//            making content narrower than intended and pushing the workbench gap wider
<div className="flex flex-col gap-2 min-w-0 w-0 flex-1 overflow-hidden">
```

This applies to BOTH the message loop div and the fallback streaming div at the bottom of `Messages`.

### 2. Workbench container padding in `Workbench.client.tsx`

The workbench inner container **must use symmetric padding `px-2 lg:px-4`** and **fully-rounded corners `rounded-lg`**:

```tsx
// ✅ CORRECT — symmetric padding, all corners rounded
<div className="absolute inset-0 px-2 lg:px-4">
  <div className="h-full flex flex-col ... rounded-lg overflow-hidden">

// ❌ WRONG — right-only padding leaves the left edge of the workbench flush with no gap
<div className="absolute inset-0 pr-2 lg:pr-4">
  <div className="h-full flex flex-col ... rounded-r-lg overflow-hidden">
```

### 3. Chat panel CSS variables (`app/styles/variables.scss`)

These values define the split layout and **must not be changed**:

```scss
--header-height: 54px;
--chat-min-width: 533px;
--chat-max-width: 33rem;           /* 528px — message content width */
--workbench-width: min(calc(100% - var(--chat-min-width)), 2536px);
--workbench-inner-width: var(--workbench-width);
--workbench-left: calc(100% - var(--workbench-width));
```

### 4. Workbench positioning

The workbench is **`position: fixed`** with:
- `top: calc(var(--header-height) + 1.2rem)` — gap below header
- `bottom: 6` (1.5rem) — gap above viewport bottom
- `left: var(--workbench-left)` when visible, `left: 100%` when hidden

**Do not change these offsets** — they match the header height and give consistent breathing room on all edges.

### 5. Assistant message text — only show text AFTER tools

In `Messages.client.tsx`, for assistant messages that contain tool invocations, only text parts that appear **after the last `tool-invocation` part** should be rendered. Text before tools is the model thinking aloud and belongs inside the `AgentTraceBox`, not the chat.

```tsx
// Find last tool index and slice text after it
const lastToolIdx = [...parts].reduce((acc, p, i) => p.type === 'tool-invocation' ? i : acc, -1);
const afterToolParts = parts.slice(lastToolIdx + 1).filter(p => p.type === 'text');
rawContent = afterToolParts.map(p => p.text).join('');
```

### Root cause pattern to watch for

If the chat/workbench gap looks too wide: **check `Messages.client.tsx` first**. A component with fixed or unexpected width (like `AgentTraceBox` at 300px, or a wrapper with wrong flex settings) can push the chat content narrower than `max-w-chat`, which makes the gap appear larger even though the workbench position hasn't changed.
