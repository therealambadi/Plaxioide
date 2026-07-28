# Vendor-Neutral Import/Export Layer — Complete Implementation Plan

**Audience:** Claude Code, Volt platform (Void/Electron fork).
**Standard for this task:** Full production implementation. No stubs, no "TODO: handle other vendors later" placeholders that silently pass through unmapped data. Every claim of "this works" must be backed by a real round-trip test against a real sample file, per the Definition of Done at the end.

---

## 0. First — Answering the Core Design Question Directly

**"Since these vendor files are editable, why convert to CLM instead of just letting the AI edit the vendor file directly?"**

Because editing the raw vendor file directly breaks every single thing Volt is built to provide, for reasons specific to what these files actually are:

1. **These export formats are not guaranteed round-trippable by design.** L5X, SimaticML XML, XEF, and PLCopen XML are *interchange* formats vendors generate from their own internal project databases (`.ACD`, `.apXX`, `.STU`) — they are not necessarily complete representations of everything the native tool tracks internally. Hand-editing the XML and re-importing risks the vendor tool rejecting it (ID/checksum mismatches) or silently dropping something the XML didn't fully capture.
2. **None of your existing engines work on raw vendor XML.** Your ladder power-flow engine, your simulator, your Tag Monitor, your formal verification layer (ESBMC/CLM property synthesis) — all of these operate on the CLM graph. If the AI edits a Rockwell L5X file directly, none of that machinery can render it, simulate it, or verify it. You'd be maintaining a second, parallel, un-verified editing path outside your entire platform.
3. **Cross-vendor migration is only possible through a neutral hub.** If AI edits stay "in vendor format," you get single-vendor editing with an AI assist — not a vendor-neutral IDE. The whole point of CLM is that one edit, verified once, can be re-exported to any target vendor.
4. **This mirrors a principle you already established for AI-generated code**: never let the AI freehand-generate or freehand-edit the artifact that actually matters. The same discipline applies to imported files — parse deterministically into CLM, edit CLM, re-export deterministically. The AI never hand-edits a vendor file's raw XML.

**So: yes, converting to CLM immediately on import is correct and non-negotiable — it is what makes every downstream feature (graphical editing, simulation, verification, cross-vendor export) actually work.** The remaining real concern — "will re-exporting back to Rockwell actually work, or will something be lost" — is a legitimate concern, and it's solved by the **vendor metadata sidecar** described in Section 3, not by avoiding CLM.

---

## 1. Architecture Overview

```
TWO IMPORT TRIGGERS
  A) Chat "pin"/import icon -> user selects a file -> import pipeline
  B) Explorer file reference -> user tells AI "convert this file" via
     chat, or AI detects a vendor file already in the open folder ->
     AI calls the SAME import pipeline as a tool -- never edits the
     raw file directly

                    |
                    v
          UNIFIED IMPORT SERVICE
          (single entry point, both triggers call this)

          1. File-format detection (Section 2)
          2. Vendor-specific parser/mapper (Section 4)
          3. CLM graph construction
          4. Vendor metadata sidecar creation (Section 3)
          5. Write new .clm-project file + open in editor

                    |
                    v
      CLM graph (single source of truth,
      as already specced in CLM_IMPLEMENTATION_PLAN.md)

                    |
                    v
          UNIFIED EXPORT SERVICE
          1. Vendor-specific exporter (Section 4, reverse)
          2. Re-merge vendor metadata sidecar (Section 3)
          3. Write target vendor file (.L5X, .xml, .xef, etc)
```

**Key architectural decision — single-runtime, no cross-language bridging.** Every one of your four target vendor interchange formats is XML: Siemens SimaticML, Rockwell L5X, Schneider XEF, Mitsubishi/CODESYS PLCopen XML. This means you do **not** need to bridge into .NET (for L5Sharp) or Python (for hutcheb/acd) — you need **one shared XML parsing foundation, plus four vendor-specific schema-mapping modules**, all in TypeScript, running directly in your existing Electron/Node stack. This avoids repeating the exact category of pain from the OpenPLC/Python/C++ cross-runtime saga earlier in this project. Use the real open-source parsers (L5Sharp, hutcheb/acd, TiaUtilities) as **reference documentation for each schema's shape**, not as runtime dependencies to bridge into.

---

## 2. File Format Detection (works for both import triggers identically)

Build `detectVendorFormat(filePath: string): VendorFormat | null` as a single shared utility, used by both the chat-pin import button and the folder-file-reference path.

Detection logic, in order:

1. **Extension hint** (`.l5x`, `.xef`, `.zef`) — fast first pass, not authoritative alone since some vendors use plain `.xml`.
2. **Root element / namespace sniffing** — read just the first few KB of the file (don't parse the whole thing yet) and check the XML root element and namespace:
   - Rockwell L5X: root `<RSLogix5000Content>`.
   - Siemens SimaticML: root contains `SW.Blocks.CompileUnit` / `Document` with Siemens-specific attribute schema, or the `DocumentInfo`/`SW.CodeBlock` structure described in Section 4.
   - PLCopen XML (Mitsubishi/CODESYS): namespace `http://www.plcopen.org/xml/tc6_0201` — the exact namespace already present in your own `plc.xml`.
   - Schneider XEF: check for Schneider-specific root tags (confirm exact root element name against a real sample .XEF file before finalizing this check — do not assume from documentation alone, verify against a real exported file).
3. If detection is ambiguous or fails: **do not guess.** Surface a picker to the user ("We couldn't automatically identify this file's vendor format — please confirm: Siemens / Rockwell / Schneider / Mitsubishi / Other") rather than attempting a parse with the wrong schema mapper, which could silently produce a corrupted CLM graph.

---

## 3. The Vendor Metadata Sidecar (solves the "will re-export actually work" concern)

When a vendor file is imported, **do not discard anything that doesn't map cleanly into the CLM schema.** Store it in a sidecar structure attached to the CLM project:

```typescript
interface VendorMetadataSidecar {
  sourceVendor: 'siemens' | 'rockwell' | 'schneider' | 'mitsubishi';
  sourceFileVersion: string;          // e.g. TIA Portal V18, L5X schema version
  originalFilePath: string;           // reference only -- never edited in place
  unmappedElements: Array<{
    clmNodeId: string | null;         // which CLM node this relates to, if any
    vendorSpecificData: unknown;      // raw preserved fragment (e.g. a vendor-specific
                                       // system function block XML snippet with no CLM
                                       // equivalent)
    reason: string;                   // why this couldn't be mapped, for the engineer's
                                       // visibility, not hidden
  }>;
  organizerTreeLayout?: unknown;      // vendor-specific project-tree structure/comments/
                                       // folder organization, preserved so re-export can
                                       // reconstruct a familiar-looking project structure,
                                       // not just a flat dump of logic
}
```

**On export**, the vendor-specific exporter reads both the CLM graph AND this sidecar — re-merging preserved vendor-specific fragments back into their original positions where possible, and regenerating the organizer tree layout, so the re-exported file resembles the original project's structure, not a minimal bare-bones reconstruction. This is what actually answers your concern: **exporting back to Rockwell will work correctly for everything CLM represents, and will preserve (not silently lose) anything CLM doesn't natively model**, with the engineer always able to see exactly what's in the "unmapped" list via a Problems Panel-style UI (reuse the existing Problems Panel pattern from your CLM validation layer).

---

## 4. Per-Vendor Adapter Specification

Each adapter is a pair: `import{Vendor}(xmlContent): { clmGraph, sidecar }` and `export{Vendor}(clmGraph, sidecar): xmlContent`.

### 4.1 Mitsubishi / CODESYS-family (PLCopen XML) — build first
- Shared with any CODESYS-based platform, since they use the same schema.
- Reference: PLCopen TC6 schema (public standard, not vendor-proprietary — the easiest of the four to get right, and validates your CLM round-trip before tackling harder proprietary schemas).
- Map PLCopen's `pou`/`body`/`FBD`/`LD`/`SFC` elements directly onto CLM's existing `POU`/`RUNG`/`FBD_BLOCK`/`SFC_STEP` node types (per `CLM_IMPLEMENTATION_PLAN.md` Section 2 — these were deliberately designed to be close to the IEC 61131-3 standard model already).

### 4.2 Rockwell (L5X)
- Reference L5Sharp's object model (tags, routines, rungs, UDTs, AOIs) as documentation for the schema shape — reimplement the parsing in TypeScript against the same schema, do not bridge into .NET.
- Rockwell's `Controller` → `Tags` → `Programs` → `Routines` → `Rungs` hierarchy maps to CLM's `POU` (Program) → `TAG` nodes → `RUNG` nodes.
- Data types: map Rockwell's `BOOL`/`DINT`/`REAL`/`TIMER`/`COUNTER` atomic and structure types directly to CLM `TAG.dataType`.

### 4.3 Siemens (SimaticML XML via TIA Openness)
- Reference TiaUtilities' parsing approach as documentation (note its own admitted scope: Ladder-only, still WIP — budget real time for FBD/SCL coverage beyond that reference).
- Map the `Parts` area (variables/commands used in a network) and `Wires` area (how they're linked, describing program sequence) directly onto CLM's graph edges — this is structurally very close to CLM's own node/edge model already, since SimaticML's Parts/Wires representation is itself graph-shaped.
- Every Siemens object carries a UId — preserve these in the sidecar so re-export can maintain stable identifiers rather than regenerating new ones that might confuse TIA Portal's own version-control/diff tooling.

### 4.4 Schneider (XEF)
- Least separately-documented — plan to reverse-engineer more of the schema directly from real sample `.XEF` files exported from a real Control Expert project than from vendor docs alone.
- Schneider projects may mix FBD, LD, IL, and ST in one project — confirm your CLM's multi-language POU model (already designed for exactly this) handles a single project referencing multiple POUs of different native languages correctly.

---

## 5. UI Implementation — Both Entry Points

### 5.1 Chat "pin"/import icon (Trigger A)
- Add an icon button (paperclip/pin style) directly in the chat input toolbar, next to the existing send controls.
- Clicking it opens a native file picker; on selection, calls the Unified Import Service directly (Section 1).
- While importing: show a progress/status message in the chat itself ("Detected: Rockwell L5X — importing... confirmed 42 tags, 18 rungs imported. Review in the editor.") — the chat is a reasonable place for this status since it's inherently a background/async action the user is watching for.
- After import completes: automatically open the resulting CLM-backed project file in the graphical editor, same as any other file-open action.

### 5.2 Folder-based file reference (Trigger B) — the more subtle one
Two distinct sub-cases, both must be handled without the AI ever editing the raw vendor file:

**Case 1 — proactive detection.** When a folder is opened in Explorer, scan its contents for recognizable vendor file extensions/signatures (reuse `detectVendorFormat` from Section 2) and surface a non-intrusive banner or a chat system message: "We found a Rockwell L5X file (`MotorControl.L5X`) in this folder — would you like to import it into a Volt project?" — with an explicit user confirmation before anything happens. Never auto-import silently.

**Case 2 — user references it conversationally.** User types something like "this file needs fixing, can you check `MotorControl.L5X`" without having used the pin button. The AI agent must recognize (via a tool available to it, e.g. `import_vendor_file(path)`) that this is a vendor file, and **its only valid action is to call the same Unified Import Service** — never to open and edit the raw XML via general file-editing tools. This needs to be an explicit constraint in the agent's tool-use instructions:

```
Add to the agent's system instructions / tool descriptions:

"If a file the user references is a recognized vendor PLC project format
(Rockwell L5X, Siemens SimaticML XML, Schneider XEF, Mitsubishi/CODESYS
PLCopen XML), you must NOT open or edit it directly with general file-editing
tools. Instead, call the `import_vendor_file` tool, which converts it into a
Volt CLM project. Perform all requested logic changes on the resulting CLM
project, not the original vendor file. If the user wants the result back in
vendor format, use the `export_vendor_file` tool at the end, never by hand-
editing the original XML."
```

---

## 6. Tech Stack & Packages

| Purpose | Package | Notes |
|---|---|---|
| XML parsing (all 4 vendors — single shared foundation) | `fast-xml-parser` | Pure JS/TS, no native deps, handles namespaces; confirm it correctly preserves attribute order/whitespace where needed for sidecar fidelity, or supplement with `xmldom` + `xpath` if fine-grained node-level access is needed for preserving unmapped fragments verbatim |
| Schema/shape validation of parsed intermediate structures | `zod` | Validate each vendor's parsed shape against an explicit TypeScript schema before mapping to CLM — catches malformed/unexpected vendor files early with a clear error, rather than a confusing downstream CLM-construction crash |
| Graph construction | `graphology` (already in use for CLM) | No new dependency — import adapters just build CLM graphs using the existing library |
| File type/signature detection | Custom `detectVendorFormat` utility (Section 2) | No need for a generic "file-type" npm package — vendor PLC formats need bespoke root-element/namespace sniffing, not generic MIME detection |

**Deliberately not used**: L5Sharp (.NET), hutcheb/acd (Python) as runtime dependencies — reference only, per Section 1's single-runtime decision.

---

## 7. Phased Build Order

1. **Shared foundation**: `detectVendorFormat`, the `VendorMetadataSidecar` type, and the Unified Import/Export Service scaffolding (Section 1) — build once, all four adapters plug into it.
2. **Mitsubishi/PLCopen XML adapter** (Section 4.1) — proves the pipeline end-to-end against the easiest, standards-based format first.
3. **UI wiring**: chat pin/import icon (Section 5.1) and folder-detection banner + agent tool constraint (Section 5.2) — wire these against the Mitsubishi adapter first so the full user-facing flow is validated before building out the remaining three adapters.
4. **Rockwell L5X adapter** (Section 4.2).
5. **Siemens SimaticML adapter** (Section 4.3).
6. **Schneider XEF adapter** (Section 4.4).
7. **Export adapters**, mirroring each import adapter, in the same vendor order.

---

## 8. Definition of Done (per vendor adapter — do not mark any adapter complete without all of these)

- [ ] Import a real, non-trivial sample project file from that vendor (not a hand-crafted minimal test file) and verify every tag, rung/network/POU, and data type is represented correctly in the resulting CLM graph — checked field-by-field against the source file's own declared data, not visual spot-checking.
- [ ] Any element that could not be cleanly mapped is present in the `unmappedElements` sidecar list and visible to the user via the Problems Panel — never silently dropped.
- [ ] Export the same CLM graph back to that vendor's format and confirm it re-imports cleanly into a validated reference (the vendor's own tool if available, or a trusted open-source parser like L5Sharp/TiaUtilities used purely as a validator, not a runtime dependency) with no data loss.
- [ ] Both import triggers (chat pin button, and folder-detected/agent-referenced file) produce identical CLM output for the same source file — verified by running the same file through both paths and diffing the resulting CLM graphs.
- [ ] Confirm the agent's tool-use constraint (Section 5.2) actually prevents direct vendor-file editing — test by asking the agent to "fix a bug" in a vendor file conversationally, and confirm it calls `import_vendor_file` rather than attempting to open/edit the raw XML with a general file tool.
