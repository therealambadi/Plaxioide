# PLC Vendor Test File Collection

Publicly sourced PLC export files for import/export regression testing across **Siemens TIA Portal**, **Rockwell Studio 5000**, and **Schneider EcoStruxure Control Expert**, plus **PLCopen TC6** reference files.

**Location:** `~/Projects/plc-vendor-test-files`  
**Total downloaded:** 66 files (~9 MB)  
**Last updated:** 2026-07-15

## Quick start

```bash
# Re-download everything
bash download_all.sh

# Browse by vendor
open 01-siemens-tia-portal
open 02-rockwell-studio5000
open 03-schneider-control-expert
```

See [MANIFEST.md](./MANIFEST.md) for every file with **direct download links**, source repo, and spec mapping.

## Folder structure

```
plc-vendor-test-files/
├── 01-siemens-tia-portal/          # .xml (SimaticML / TIA Openness exports)
│   ├── 01-simple-lad-ob/           # Spec #1 — baseline LAD
│   ├── 02-lad-branches-timers/     # Spec #2 — parallel branches + timers
│   ├── 03-fbd/                     # Spec #3 — FBD wire reconstruction
│   ├── 04-graph-sfc/               # Spec #4 — GRAPH (SFC) — hardest
│   ├── 05-mixed-complexity-fb-db/  # Spec #5 — FB, DB, arrays, structs
│   ├── 06-bonus-scl/               # Spec #6 — Structured Text
│   └── 07-additional-samples/
├── 02-rockwell-studio5000/         # .L5X (Logix5000 XML)
│   ├── 01-simple-rll/              # Spec #1 — baseline ladder
│   ├── 02-branches-seal-in/        # Spec #2 — OR branches + seal-in
│   ├── 03-timers-counters-math/    # Spec #3 — TON, CTU, EQU, ADD
│   ├── 04-fbd/                     # Spec #4 — FBD routines
│   ├── 05-full-project-tags/       # Spec #5 — controller tags + UDTs
│   ├── 06-bonus-aoi/               # Spec #6 — AOIs, SFC, ST
│   └── 07-additional-samples/
├── 03-schneider-control-expert/    # .XEF / .ZEF
│   └── 01-full-projects/           # Full project exports (LD/FBD/SFC inside)
└── 04-plcopen-tc6-reference/      # PLCopen XML (beremiz) — cross-vendor baseline
    ├── beremiz-tests/
    └── beremiz-examples/
```

## Coverage vs. spec

| Vendor | Required | Downloaded | Notes |
|--------|----------|------------|-------|
| Siemens | 5 + 2 bonus | 30 XML | All 5 categories covered; GRAPH, FBD, SCL, mixed DB/FB present |
| Rockwell | 5 + 2 bonus | 25 L5X | All 5 categories covered; FBD, AOI, SFC, ST, full projects present |
| Schneider | 5 + 2 bonus | 7 XEF/ZEF | Full project exports (contain LD/FBD/SFC sections internally); no separate section exports found publicly |
| PLCopen TC6 | reference | 4 XML | Bonus cross-vendor IEC 61131-3 test corpus |

### Known gaps (need vendor software to create)

- **Schneider separate section exports** (`.XLD`, `.XBD`, `.XSF`) — rarely published on GitHub; full `.XEF` projects are the best public substitute
- **Rockwell BST/NXB/BND text** — modern L5X uses bracket `[ branch1 , branch2 ]` neutral text instead; functionally equivalent for branch parsing tests
- **Siemens TIA v18-specific schema** — most public exports are v15–v17/v19 Openness; still valid SimaticML

## Top source repositories

| Repo | Files used | Link |
|------|------------|------|
| kasi09/TIA-Tools | Siemens LAD/FB/DB | https://github.com/kasi09/TIA-Tools |
| gabrieleNaso/PLConversionTool | Siemens GRAPH + LAD | https://github.com/gabrieleNaso/PLConversionTool |
| mking2203/CodeGeneratorOpenness | Siemens LAD/GRAPH samples | https://github.com/mking2203/CodeGeneratorOpenness |
| ns-bhandari/PLC-Exercises | Rockwell ladder exercises | https://github.com/ns-bhandari/PLC-Exercises |
| tnunnink/L5Sharp | Rockwell test corpus | https://github.com/tnunnink/L5Sharp |
| estradege/controlexpert | Schneider XEF/ZEF tests | https://github.com/estradege/controlexpert |
| beremiz/beremiz | PLCopen TC6 tests | https://github.com/beremiz/beremiz |

## License note

These files were exported from third-party GitHub repositories. Check each source repo's license before redistributing. Most are educational/industrial automation projects shared publicly for tooling development.
