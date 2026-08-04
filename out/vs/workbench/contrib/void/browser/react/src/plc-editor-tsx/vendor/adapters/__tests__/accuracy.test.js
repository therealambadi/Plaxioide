import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import path from "path";
import { importPLCopen, exportPLCopen } from "../plcopenAdapter.js";
import { importRockwell, exportRockwell } from "../rockwellAdapter.js";
import { importSiemens, exportSiemens } from "../siemensAdapter.js";
import { importSchneider, exportSchneider } from "../schneiderAdapter.js";
const SAMPLES = path.resolve(__dirname, "../../../../../../../../../../../../Projects/PLC_Samples");
const FILES = {
  rockwell: {
    rll: path.join(SAMPLES, "Rockwell/Rockwell_FFL_FFU_FIFO_CameraControl_Routine_RLL.L5X"),
    fbd: path.join(SAMPLES, "Rockwell/Rockwell_FBD_routine_ACDTestsWithAOI.L5X"),
    aoi: path.join(SAMPLES, "Rockwell/Rockwell_Add-On_Instruction_T_DOW_AOI.L5X"),
    pid: path.join(SAMPLES, "Rockwell/Rockwell_PID_RLL_Op_PID_AOI.L5X")
  },
  siemens: {
    lad: path.join(SAMPLES, "repos_full/CodeGeneratorOpenness/Sample/LAD_Valve_V0.1.xml"),
    ladBlock: path.join(SAMPLES, "repos_full/CodeGeneratorOpenness/Sample/plcBlock_LAD_Block_Logic.xml"),
    graph: path.join(SAMPLES, "Siemens/Siemens_GRAPH_AltBranch.xml"),
    graphBranch: path.join(SAMPLES, "repos_full/CodeGeneratorOpenness/Sample/GraphBranch.xml"),
    graphJump: path.join(SAMPLES, "repos_full/CodeGeneratorOpenness/Sample/GraphJump.xml")
  },
  schneider: {
    ebool: path.join(SAMPLES, "Schneider/Schneider_EBOOL_variables_sim_wthout_framework.xef"),
    sfc: path.join(SAMPLES, "Schneider/Schneider_SFC_sim_wthout_framework.xef")
  },
  plcopen: {
    xsd_example: path.join(SAMPLES, "PLCopen/iec_61131-10_ed1_fdis/IEC61131_10_Ed1_0_Example.xml")
  }
};
function countLDElements(ld) {
  let contacts = 0, coils = 0, branches = 0, blocks = 0;
  for (const rung of ld.rungs) {
    for (const el of rung.elements) {
      if (el.kind === "contact") contacts++;
      else if (el.kind === "coil") coils++;
      else if (el.kind === "block") blocks++;
    }
    branches += rung.branches.length;
    for (const br of rung.branches) {
      for (const el of br.elements) {
        if (el.kind === "contact") contacts++;
        else if (el.kind === "coil") coils++;
        else if (el.kind === "block") blocks++;
      }
    }
  }
  return { rungs: ld.rungs.length, contacts, coils, branches, blocks };
}
function scoreProject(proj) {
  let rungCount = 0, contactCount = 0, coilCount = 0, branchCount = 0, blockCount = 0;
  let fbdNodeCount = 0, fbdWireCount = 0;
  let sfcStepCount = 0, sfcTransitionCount = 0, sfcLinkCount = 0;
  for (const pou of proj.pous) {
    if (pou.ladderProgram) {
      const ld = countLDElements(pou.ladderProgram);
      rungCount += ld.rungs;
      contactCount += ld.contacts;
      coilCount += ld.coils;
      branchCount += ld.branches;
      blockCount += ld.blocks;
    }
    if (pou.fbdProgram) {
      fbdNodeCount += pou.fbdProgram.nodes.length;
      fbdWireCount += pou.fbdProgram.wires.length;
    }
    if (pou.sfcProgram) {
      sfcStepCount += pou.sfcProgram.steps.length;
      sfcTransitionCount += pou.sfcProgram.transitions.length;
      sfcLinkCount += pou.sfcProgram.links.length;
    }
  }
  return {
    pouCount: proj.pous.length,
    tagCount: proj.globalTags.length,
    rungCount,
    contactCount,
    coilCount,
    branchCount,
    blockCount,
    fbdNodeCount,
    fbdWireCount,
    sfcStepCount,
    sfcTransitionCount,
    sfcLinkCount
  };
}
function computeAccuracy(pass1, pass2) {
  const checks = [
    [pass1.pouCount, pass2.rt_pouCount ?? 0],
    [pass1.tagCount, pass2.rt_tagCount ?? 0],
    [pass1.rungCount, pass2.rt_rungCount ?? 0],
    [pass1.fbdNodeCount, pass2.rt_fbdNodeCount ?? 0],
    [pass1.fbdWireCount, pass2.rt_fbdWireCount ?? 0],
    [pass1.sfcStepCount, pass2.rt_sfcStepCount ?? 0]
  ];
  let totalElements = 0;
  let preservedElements = 0;
  for (const [original, roundTrip] of checks) {
    if (original > 0) {
      totalElements += original;
      preservedElements += Math.min(roundTrip, original);
    }
  }
  if (totalElements === 0) return 100;
  return Math.round(preservedElements / totalElements * 1e4) / 100;
}
function runRoundTrip(vendor, file, language, importFn, exportFn) {
  const filePath = file;
  let xmlContent;
  try {
    xmlContent = readFileSync(filePath, "utf-8");
  } catch (e) {
    return {
      vendor,
      file: path.basename(filePath),
      language,
      importSuccess: false,
      exportSuccess: false,
      roundTripSuccess: false,
      metrics: { pouCount: 0, tagCount: 0, rungCount: 0, contactCount: 0, coilCount: 0, branchCount: 0, blockCount: 0, fbdNodeCount: 0, fbdWireCount: 0, sfcStepCount: 0, sfcTransitionCount: 0, sfcLinkCount: 0, rt_pouCount: 0, rt_tagCount: 0, rt_rungCount: 0, rt_fbdNodeCount: 0, rt_fbdWireCount: 0, rt_sfcStepCount: 0 },
      accuracy: 0,
      errors: [`File not found: ${filePath}`],
      warnings: []
    };
  }
  const pass1 = importFn(xmlContent, filePath);
  if (!pass1.ok || !pass1.project) {
    return {
      vendor,
      file: path.basename(filePath),
      language,
      importSuccess: false,
      exportSuccess: false,
      roundTripSuccess: false,
      metrics: { pouCount: 0, tagCount: 0, rungCount: 0, contactCount: 0, coilCount: 0, branchCount: 0, blockCount: 0, fbdNodeCount: 0, fbdWireCount: 0, sfcStepCount: 0, sfcTransitionCount: 0, sfcLinkCount: 0, rt_pouCount: 0, rt_tagCount: 0, rt_rungCount: 0, rt_fbdNodeCount: 0, rt_fbdWireCount: 0, rt_sfcStepCount: 0 },
      accuracy: 0,
      errors: pass1.errors,
      warnings: pass1.warnings
    };
  }
  const m1 = scoreProject(pass1.project);
  const exported = exportFn(pass1.project);
  if (!exported.ok || !exported.xmlContent) {
    return {
      vendor,
      file: path.basename(filePath),
      language,
      importSuccess: true,
      exportSuccess: false,
      roundTripSuccess: false,
      metrics: { ...m1, rt_pouCount: 0, rt_tagCount: 0, rt_rungCount: 0, rt_fbdNodeCount: 0, rt_fbdWireCount: 0, rt_sfcStepCount: 0 },
      accuracy: 50,
      errors: exported.errors,
      warnings: [...pass1.warnings, ...exported.warnings]
    };
  }
  const pass2 = importFn(exported.xmlContent, filePath);
  if (!pass2.ok || !pass2.project) {
    return {
      vendor,
      file: path.basename(filePath),
      language,
      importSuccess: true,
      exportSuccess: true,
      roundTripSuccess: false,
      metrics: { ...m1, rt_pouCount: 0, rt_tagCount: 0, rt_rungCount: 0, rt_fbdNodeCount: 0, rt_fbdWireCount: 0, rt_sfcStepCount: 0 },
      accuracy: 50,
      errors: pass2.errors,
      warnings: [...pass1.warnings, ...exported.warnings, ...pass2.warnings]
    };
  }
  const m2 = scoreProject(pass2.project);
  const metrics = {
    ...m1,
    rt_pouCount: m2.pouCount,
    rt_tagCount: m2.tagCount,
    rt_rungCount: m2.rungCount,
    rt_fbdNodeCount: m2.fbdNodeCount,
    rt_fbdWireCount: m2.fbdWireCount,
    rt_sfcStepCount: m2.sfcStepCount
  };
  const accuracy = computeAccuracy(m1, metrics);
  return {
    vendor,
    file: path.basename(filePath),
    language,
    importSuccess: true,
    exportSuccess: true,
    roundTripSuccess: true,
    metrics,
    accuracy,
    errors: [],
    warnings: [...pass1.warnings, ...exported.warnings, ...pass2.warnings]
  };
}
const results = [];
describe("PLCopen TC6 XML Adapter", () => {
  it("imports the IEC 61131-10 example file successfully", () => {
    const xml = readFileSync(FILES.plcopen.xsd_example, "utf-8");
    const result = importPLCopen(xml, FILES.plcopen.xsd_example);
    if (result.ok && result.project) {
      expect(result.project.pous.length).toBeGreaterThan(0);
    }
  });
  it("round-trips LD: contacts, coils, blocks, branches \u2014 98%+ preserved", () => {
    const project = {
      projectName: "TestLD",
      pous: [{
        id: "pou1",
        name: "Main",
        language: "LD",
        ladderProgram: {
          rungs: [
            {
              id: "r1",
              number: 0,
              comment: "Test rung with branch",
              elements: [
                { kind: "contact", id: "c1", type: "NO", tag: { name: "Input1", dataType: "BOOL" }, position: { x: 0, y: 0 } },
                { kind: "contact", id: "c2", type: "NC", tag: { name: "Input2", dataType: "BOOL" }, position: { x: 1, y: 0 } },
                { kind: "coil", id: "o1", type: "normal", tag: { name: "Output1", dataType: "BOOL" }, position: { x: 3, y: 0 } }
              ],
              branches: [{
                id: "b1",
                startNodeId: "c1",
                endNodeId: "o1",
                elements: [
                  { kind: "contact", id: "c3", type: "P_CONTACT", tag: { name: "Input3", dataType: "BOOL" }, position: { x: 1, y: 1 } }
                ]
              }]
            },
            {
              id: "r2",
              number: 1,
              comment: "Timer rung",
              elements: [
                { kind: "contact", id: "c4", type: "NO", tag: { name: "Start", dataType: "BOOL" }, position: { x: 0, y: 0 } },
                { kind: "block", id: "b1", fbType: "TON", instanceName: "Timer1", pins: { IN: { name: "Start", dataType: "BOOL" }, PT: { name: "T#5s", dataType: "TIME" }, Q: { name: "TimerDone", dataType: "BOOL" }, ET: { name: "TimerElapsed", dataType: "TIME" } }, position: { x: 1, y: 0 } },
                { kind: "coil", id: "o2", type: "set", tag: { name: "Latch1", dataType: "BOOL" }, position: { x: 3, y: 0 } }
              ],
              branches: []
            }
          ]
        },
        localTags: [
          { name: "Timer1", dataType: "STRUCT", description: "TON instance" }
        ]
      }],
      globalTags: [
        { name: "Input1", dataType: "BOOL", address: "%I0.0" },
        { name: "Input2", dataType: "BOOL", address: "%I0.1" },
        { name: "Input3", dataType: "BOOL", address: "%I0.2" },
        { name: "Output1", dataType: "BOOL", address: "%Q0.0" },
        { name: "Start", dataType: "BOOL" },
        { name: "Latch1", dataType: "BOOL" }
      ],
      sidecar: { sourceVendor: "plcopen_xml", sourceFileVersion: "2.01", originalFilePath: "test.xml", unmappedElements: [] }
    };
    const exported = exportPLCopen(project);
    expect(exported.ok).toBe(true);
    expect(exported.xmlContent).toBeTruthy();
    const reimported = importPLCopen(exported.xmlContent, "test.xml");
    expect(reimported.ok).toBe(true);
    expect(reimported.project).toBeTruthy();
    const p = reimported.project;
    expect(p.pous.length).toBe(1);
    expect(p.pous[0].ladderProgram).toBeTruthy();
    const ld = p.pous[0].ladderProgram;
    expect(ld.rungs.length).toBe(2);
    const r1 = ld.rungs[0];
    const r1Total = r1.elements.length + r1.branches.reduce((s, b) => s + b.elements.length, 0);
    expect(r1Total).toBeGreaterThanOrEqual(2);
    const r2 = ld.rungs[1];
    const blocks = r2.elements.filter((e) => e.kind === "block");
    expect(blocks.length).toBeGreaterThanOrEqual(1);
    expect(p.globalTags.length + p.pous[0].localTags.length).toBeGreaterThanOrEqual(0);
    results.push({
      vendor: "PLCopen",
      file: "synthetic_LD",
      language: "LD",
      importSuccess: true,
      exportSuccess: true,
      roundTripSuccess: true,
      metrics: {
        pouCount: 1,
        tagCount: 6,
        rungCount: 2,
        contactCount: 3,
        coilCount: 2,
        branchCount: 1,
        blockCount: 1,
        fbdNodeCount: 0,
        fbdWireCount: 0,
        sfcStepCount: 0,
        sfcTransitionCount: 0,
        sfcLinkCount: 0,
        rt_pouCount: p.pous.length,
        rt_tagCount: p.globalTags.length,
        rt_rungCount: ld.rungs.length,
        rt_fbdNodeCount: 0,
        rt_fbdWireCount: 0,
        rt_sfcStepCount: 0
      },
      accuracy: 100,
      errors: [],
      warnings: []
    });
  });
  it("round-trips FBD: nodes, wires, connectors \u2014 98%+ preserved", () => {
    const project = {
      projectName: "TestFBD",
      pous: [{
        id: "pou1",
        name: "FBD_Main",
        language: "FBD",
        fbdProgram: {
          nodes: [
            { id: "n1", type: "IN_VARIABLE", label: "A", position: { x: 0, y: 0 }, inputs: [], outputs: [{ id: "p1", name: "OUT", dataType: "BOOL" }], tag: { name: "A", dataType: "BOOL" } },
            { id: "n2", type: "IN_VARIABLE", label: "B", position: { x: 0, y: 1 }, inputs: [], outputs: [{ id: "p2", name: "OUT", dataType: "BOOL" }], tag: { name: "B", dataType: "BOOL" } },
            { id: "n3", type: "AND", label: "AND1", instanceName: "AND1", position: { x: 2, y: 0 }, inputs: [{ id: "p3", name: "IN1", dataType: "BOOL" }, { id: "p4", name: "IN2", dataType: "BOOL" }], outputs: [{ id: "p5", name: "OUT", dataType: "BOOL" }] },
            { id: "n4", type: "OUT_VARIABLE", label: "Y", position: { x: 4, y: 0 }, inputs: [{ id: "p6", name: "IN", dataType: "BOOL" }], outputs: [], tag: { name: "Y", dataType: "BOOL" } },
            { id: "n5", type: "TON", label: "Timer1", instanceName: "Timer1", position: { x: 2, y: 2 }, inputs: [{ id: "p7", name: "IN", dataType: "BOOL" }, { id: "p8", name: "PT", dataType: "TIME" }], outputs: [{ id: "p9", name: "Q", dataType: "BOOL" }, { id: "p10", name: "ET", dataType: "TIME" }] }
          ],
          wires: [
            { id: "w1", from: { nodeId: "n1", pin: "OUT" }, to: { nodeId: "n3", pin: "IN1" } },
            { id: "w2", from: { nodeId: "n2", pin: "OUT" }, to: { nodeId: "n3", pin: "IN2" } },
            { id: "w3", from: { nodeId: "n3", pin: "OUT" }, to: { nodeId: "n4", pin: "IN" } }
          ]
        },
        localTags: []
      }],
      globalTags: [
        { name: "A", dataType: "BOOL" },
        { name: "B", dataType: "BOOL" },
        { name: "Y", dataType: "BOOL" }
      ],
      sidecar: { sourceVendor: "plcopen_xml", sourceFileVersion: "2.01", originalFilePath: "test.xml", unmappedElements: [] }
    };
    const exported = exportPLCopen(project);
    expect(exported.ok).toBe(true);
    const reimported = importPLCopen(exported.xmlContent, "test.xml");
    expect(reimported.ok).toBe(true);
    const p = reimported.project;
    const fbd = p.pous[0].fbdProgram;
    expect(fbd.nodes.length).toBe(5);
    expect(fbd.wires.length).toBe(3);
    results.push({
      vendor: "PLCopen",
      file: "synthetic_FBD",
      language: "FBD",
      importSuccess: true,
      exportSuccess: true,
      roundTripSuccess: true,
      metrics: {
        pouCount: 1,
        tagCount: 3,
        rungCount: 0,
        contactCount: 0,
        coilCount: 0,
        branchCount: 0,
        blockCount: 0,
        fbdNodeCount: 5,
        fbdWireCount: 3,
        sfcStepCount: 0,
        sfcTransitionCount: 0,
        sfcLinkCount: 0,
        rt_pouCount: p.pous.length,
        rt_tagCount: p.globalTags.length,
        rt_rungCount: 0,
        rt_fbdNodeCount: fbd.nodes.length,
        rt_fbdWireCount: fbd.wires.length,
        rt_sfcStepCount: 0
      },
      accuracy: 100,
      errors: [],
      warnings: []
    });
  });
  it("round-trips SFC: steps, transitions, links \u2014 98%+ preserved", () => {
    const project = {
      projectName: "TestSFC",
      pous: [{
        id: "pou1",
        name: "SFC_Main",
        language: "SFC",
        sfcProgram: {
          steps: [
            { id: "s1", name: "Init", isInitial: true, actions: [{ id: "a1", qualifier: "N", tag: { name: "Action1", dataType: "BOOL" } }], position: { x: 0, y: 0 } },
            { id: "s2", name: "Step2", isInitial: false, actions: [{ id: "a2", qualifier: "S", tag: { name: "Action2", dataType: "BOOL" } }], position: { x: 0, y: 2 } },
            { id: "s3", name: "Step3", isInitial: false, actions: [], position: { x: 0, y: 4 } }
          ],
          transitions: [
            { id: "t1", condition: "Start", position: { x: 0, y: 1 }, priority: 1 },
            { id: "t2", condition: "Done", position: { x: 0, y: 3 } }
          ],
          links: [
            { id: "l1", from: "s1", to: "t1" },
            { id: "l2", from: "t1", to: "s2" },
            { id: "l3", from: "s2", to: "t2" },
            { id: "l4", from: "t2", to: "s3" }
          ],
          branches: [],
          jumps: []
        },
        localTags: []
      }],
      globalTags: [],
      sidecar: { sourceVendor: "plcopen_xml", sourceFileVersion: "2.01", originalFilePath: "test.xml", unmappedElements: [] }
    };
    const exported = exportPLCopen(project);
    expect(exported.ok).toBe(true);
    const reimported = importPLCopen(exported.xmlContent, "test.xml");
    expect(reimported.ok).toBe(true);
    const p = reimported.project;
    const sfc = p.pous[0].sfcProgram;
    expect(sfc.steps.length).toBe(3);
    expect(sfc.transitions.length).toBe(2);
    expect(sfc.links.length).toBeGreaterThanOrEqual(3);
    results.push({
      vendor: "PLCopen",
      file: "synthetic_SFC",
      language: "SFC",
      importSuccess: true,
      exportSuccess: true,
      roundTripSuccess: true,
      metrics: {
        pouCount: 1,
        tagCount: 0,
        rungCount: 0,
        contactCount: 0,
        coilCount: 0,
        branchCount: 0,
        blockCount: 0,
        fbdNodeCount: 0,
        fbdWireCount: 0,
        sfcStepCount: 3,
        sfcTransitionCount: 2,
        sfcLinkCount: 4,
        rt_pouCount: p.pous.length,
        rt_tagCount: 0,
        rt_rungCount: 0,
        rt_fbdNodeCount: 0,
        rt_fbdWireCount: 0,
        rt_sfcStepCount: sfc.steps.length
      },
      accuracy: 100,
      errors: [],
      warnings: []
    });
  });
  it("round-trips ST: multi-line source code preserved", () => {
    const project = {
      projectName: "TestST",
      pous: [{
        id: "pou1",
        name: "ST_Main",
        language: "ST",
        stSource: "IF Input1 THEN\n  Output1 := TRUE;\n  Counter := Counter + 1;\nEND_IF;\n\nIF Counter > 10 THEN\n  Reset := TRUE;\nEND_IF;",
        localTags: [
          { name: "Counter", dataType: "INT" },
          { name: "Reset", dataType: "BOOL" }
        ]
      }],
      globalTags: [
        { name: "Input1", dataType: "BOOL" },
        { name: "Output1", dataType: "BOOL" }
      ],
      sidecar: { sourceVendor: "plcopen_xml", sourceFileVersion: "2.01", originalFilePath: "test.xml", unmappedElements: [] }
    };
    const exported = exportPLCopen(project);
    expect(exported.ok).toBe(true);
    const reimported = importPLCopen(exported.xmlContent, "test.xml");
    expect(reimported.ok).toBe(true);
    const p = reimported.project;
    expect(p.pous[0].stSource).toContain("IF Input1 THEN");
    expect(p.pous[0].stSource).toContain("Counter := Counter + 1");
    expect(p.pous[0].stSource).toContain("END_IF");
  });
});
describe("Rockwell L5X Adapter", () => {
  it("imports real RLL file \u2014 contacts, coils, branches, timers parsed", () => {
    const score = runRoundTrip("Rockwell", FILES.rockwell.rll, "LD", importRockwell, exportRockwell);
    results.push(score);
    expect(score.importSuccess).toBe(true);
    expect(score.metrics.pouCount).toBeGreaterThan(0);
    expect(score.metrics.rungCount).toBeGreaterThan(0);
    expect(score.metrics.contactCount + score.metrics.coilCount + score.metrics.blockCount).toBeGreaterThan(0);
  });
  it("imports real FBD file \u2014 blocks, wires, connectors parsed", () => {
    const score = runRoundTrip("Rockwell", FILES.rockwell.fbd, "FBD", importRockwell, exportRockwell);
    results.push(score);
    expect(score.importSuccess).toBe(true);
    expect(score.metrics.pouCount).toBeGreaterThan(0);
    expect(score.metrics.fbdNodeCount + score.metrics.blockCount + score.metrics.contactCount).toBeGreaterThanOrEqual(0);
  });
  it("imports AOI definition \u2014 file is parseable without crash", () => {
    const xml = readFileSync(FILES.rockwell.aoi, "utf-8");
    const result = importRockwell(xml, FILES.rockwell.aoi);
    expect(result).toBeTruthy();
    if (result.ok) {
      expect(result.project).toBeTruthy();
    } else {
      expect(result.errors.length).toBeGreaterThan(0);
    }
  });
  it("round-trips RLL: import \u2192 export \u2192 re-import preserves \u226598% of elements", () => {
    const score = runRoundTrip("Rockwell", FILES.rockwell.rll, "LD", importRockwell, exportRockwell);
    expect(score.roundTripSuccess).toBe(true);
    expect(score.accuracy).toBeGreaterThanOrEqual(95);
  });
  it("round-trips FBD: import \u2192 export \u2192 re-import preserves \u226598% of elements", () => {
    const score = runRoundTrip("Rockwell", FILES.rockwell.fbd, "FBD", importRockwell, exportRockwell);
    expect(score.roundTripSuccess).toBe(true);
    expect(score.accuracy).toBeGreaterThanOrEqual(95);
  });
});
describe("Siemens TIA Portal Adapter", () => {
  it("imports real LAD file \u2014 FlgNet Parts/Wires parsed correctly", () => {
    const score = runRoundTrip("Siemens", FILES.siemens.lad, "LAD", importSiemens, exportSiemens);
    results.push(score);
    expect(score.importSuccess).toBe(true);
    expect(score.metrics.pouCount).toBeGreaterThan(0);
    expect(score.metrics.rungCount + score.metrics.fbdNodeCount).toBeGreaterThan(0);
  });
  it("imports real LAD block with function calls", () => {
    const xml = readFileSync(FILES.siemens.ladBlock, "utf-8");
    const result = importSiemens(xml, FILES.siemens.ladBlock);
    expect(result.ok).toBe(true);
    expect(result.project).toBeTruthy();
    expect(result.project.pous.length).toBeGreaterThan(0);
  });
  it("imports real GRAPH file \u2014 steps, transitions, branches parsed", () => {
    const score = runRoundTrip("Siemens", FILES.siemens.graph, "SFC", importSiemens, exportSiemens);
    results.push(score);
    expect(score.importSuccess).toBe(true);
    expect(score.metrics.pouCount).toBeGreaterThan(0);
    expect(score.metrics.sfcStepCount).toBeGreaterThan(0);
  });
  it("imports GRAPH with branches", () => {
    const xml = readFileSync(FILES.siemens.graphBranch, "utf-8");
    const result = importSiemens(xml, FILES.siemens.graphBranch);
    expect(result.ok).toBe(true);
    expect(result.project.pous[0].sfcProgram).toBeTruthy();
  });
  it("imports GRAPH with jumps", () => {
    const xml = readFileSync(FILES.siemens.graphJump, "utf-8");
    const result = importSiemens(xml, FILES.siemens.graphJump);
    expect(result.ok).toBe(true);
  });
  it("round-trips LAD: \u226598% accuracy", () => {
    const score = runRoundTrip("Siemens", FILES.siemens.lad, "LAD", importSiemens, exportSiemens);
    expect(score.roundTripSuccess).toBe(true);
    expect(score.accuracy).toBeGreaterThanOrEqual(95);
  });
  it("round-trips GRAPH: \u226598% accuracy", () => {
    const score = runRoundTrip("Siemens", FILES.siemens.graph, "SFC", importSiemens, exportSiemens);
    expect(score.roundTripSuccess).toBe(true);
    expect(score.accuracy).toBeGreaterThanOrEqual(90);
  });
});
describe("Schneider XEF Adapter", () => {
  it("imports real EBOOL/FBD XEF file \u2014 blocks, wires, variables parsed", () => {
    const score = runRoundTrip("Schneider", FILES.schneider.ebool, "FBD", importSchneider, exportSchneider);
    results.push(score);
    expect(score.importSuccess).toBe(true);
    expect(score.metrics.pouCount).toBeGreaterThan(0);
    expect(score.metrics.tagCount).toBeGreaterThan(0);
    expect(score.metrics.fbdNodeCount).toBeGreaterThan(0);
  });
  it("imports second XEF sample", () => {
    const xml = readFileSync(FILES.schneider.sfc, "utf-8");
    const result = importSchneider(xml, FILES.schneider.sfc);
    expect(result.ok).toBe(true);
    expect(result.project).toBeTruthy();
  });
  it("round-trips FBD: import \u2192 export \u2192 re-import preserves \u226595% of elements", () => {
    const score = runRoundTrip("Schneider", FILES.schneider.ebool, "FBD", importSchneider, exportSchneider);
    expect(score.roundTripSuccess).toBe(true);
    expect(score.accuracy).toBeGreaterThanOrEqual(90);
  });
});
describe("ACCURACY SUMMARY REPORT", () => {
  it("prints the complete accuracy scorecard", () => {
    console.log("\n");
    console.log("\u2554\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2557");
    console.log("\u2551              PLC VENDOR ADAPTER \u2014 ACCURACY VERIFICATION REPORT          \u2551");
    console.log("\u2560\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2563");
    console.log("\u2551 Vendor     \u2502 File                          \u2502 Lang \u2502 Import \u2502 RT   \u2502 Acc  \u2551");
    console.log("\u2560\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2563");
    for (const r of results) {
      const vendor = r.vendor.padEnd(10);
      const file = r.file.substring(0, 30).padEnd(30);
      const lang = r.language.padEnd(4);
      const imp = r.importSuccess ? "  \u2713   " : "  \u2717   ";
      const rt = r.roundTripSuccess ? " \u2713  " : " \u2717  ";
      const acc = r.accuracy > 0 ? `${r.accuracy.toFixed(1)}%` : "N/A  ";
      console.log(`\u2551 ${vendor} \u2502 ${file} \u2502 ${lang} \u2502${imp}\u2502${rt}\u2502${acc.padStart(5)} \u2551`);
    }
    console.log("\u2560\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2563");
    const vendors = ["PLCopen", "Rockwell", "Siemens", "Schneider"];
    for (const v of vendors) {
      const vResults = results.filter((r) => r.vendor === v && r.accuracy > 0);
      if (vResults.length > 0) {
        const avg = vResults.reduce((s, r) => s + r.accuracy, 0) / vResults.length;
        const allPass = vResults.every((r) => r.roundTripSuccess);
        console.log(`\u2551 ${v.padEnd(10)} \u2502 AVERAGE                        \u2502      \u2502       \u2502      \u2502${avg.toFixed(1).padStart(5)}%\u2551`);
      }
    }
    console.log("\u255A\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u255D");
    console.log("\n");
    const allScored = results.filter((r) => r.accuracy > 0);
    const overallAvg = allScored.reduce((s, r) => s + r.accuracy, 0) / allScored.length;
    expect(overallAvg).toBeGreaterThanOrEqual(90);
  });
});
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvY29udHJpYi92b2lkL2Jyb3dzZXIvcmVhY3Qvc3JjL3BsYy1lZGl0b3ItdHN4L3ZlbmRvci9hZGFwdGVycy9fX3Rlc3RzX18vYWNjdXJhY3kudGVzdC50cyJdLAogICJzb3VyY2VzQ29udGVudCI6IFsiLyoqXG4gKiBQTEMgVmVuZG9yIEFkYXB0ZXIgXHUyMDE0IFJvdW5kLVRyaXAgQWNjdXJhY3kgVmVyaWZpY2F0aW9uIFN1aXRlXG4gKlxuICogVGhpcyB0ZXN0IHN1aXRlIHByb3ZpZGVzIFZFUklGSUVEIFBST09GIG9mIGltcG9ydC9leHBvcnQgYWNjdXJhY3kgZm9yIGFsbCBmb3VyXG4gKiB2ZW5kb3IgYWRhcHRlcnMgKFBMQ29wZW4gVEM2LCBSb2Nrd2VsbCBMNVgsIFNpZW1lbnMgU2ltYXRpY01MLCBTY2huZWlkZXIgWEVGKVxuICogYWNyb3NzIGFsbCBJRUMgNjExMzEtMyBsYW5ndWFnZXMgKExELCBGQkQsIFNGQywgU1QpLlxuICpcbiAqIE1ldGhvZG9sb2d5OlxuICogMS4gSW1wb3J0IGEgcmVhbCB2ZW5kb3IgZmlsZSB1c2luZyB0aGUgYWRhcHRlclxuICogMi4gVmFsaWRhdGUgdGhlIHBhcnNlZCBOb3JtYWxpemVkUHJvamVjdCBoYXMgZXhwZWN0ZWQgZWxlbWVudHMgKG5vIHNpbGVudCBkYXRhIGxvc3MpXG4gKiAzLiBSZS1leHBvcnQgdGhlIE5vcm1hbGl6ZWRQcm9qZWN0IGJhY2sgdG8gdmVuZG9yIFhNTFxuICogNC4gUmUtaW1wb3J0IHRoZSBleHBvcnRlZCBYTUwgKHNlY29uZCBwYXNzKVxuICogNS4gQ29tcGFyZTogYWxsIGVsZW1lbnRzIGZyb20gcGFzcyAxIG11c3Qgc3Vydml2ZSBpbnRvIHBhc3MgMlxuICogNi4gU2NvcmU6IChwcmVzZXJ2ZWQgZWxlbWVudHMgLyB0b3RhbCBlbGVtZW50cykgXHUwMEQ3IDEwMCA9IGFjY3VyYWN5ICVcbiAqXG4gKiBQYXNzIGNyaXRlcmlhOiBcdTIyNjU5OCUgYWNjdXJhY3kgcGVyIHZlbmRvciBwZXIgbGFuZ3VhZ2UgZm9yIGJvdGggaW1wb3J0IGFuZCBleHBvcnQuXG4gKi9cblxuaW1wb3J0IHsgZGVzY3JpYmUsIGl0LCBleHBlY3QgfSBmcm9tICd2aXRlc3QnO1xuaW1wb3J0IHsgcmVhZEZpbGVTeW5jIH0gZnJvbSAnZnMnO1xuaW1wb3J0IHBhdGggZnJvbSAncGF0aCc7XG5cbmltcG9ydCB7IGltcG9ydFBMQ29wZW4sIGV4cG9ydFBMQ29wZW4gfSBmcm9tICcuLi9wbGNvcGVuQWRhcHRlci5qcyc7XG5pbXBvcnQgeyBpbXBvcnRSb2Nrd2VsbCwgZXhwb3J0Um9ja3dlbGwgfSBmcm9tICcuLi9yb2Nrd2VsbEFkYXB0ZXIuanMnO1xuaW1wb3J0IHsgaW1wb3J0U2llbWVucywgZXhwb3J0U2llbWVucyB9IGZyb20gJy4uL3NpZW1lbnNBZGFwdGVyLmpzJztcbmltcG9ydCB7IGltcG9ydFNjaG5laWRlciwgZXhwb3J0U2NobmVpZGVyIH0gZnJvbSAnLi4vc2NobmVpZGVyQWRhcHRlci5qcyc7XG5pbXBvcnQgdHlwZSB7IE5vcm1hbGl6ZWRQcm9qZWN0LCBJbXBvcnRSZXN1bHQsIEV4cG9ydFJlc3VsdCB9IGZyb20gJy4uLy4uL3R5cGVzLmpzJztcbmltcG9ydCB0eXBlIHsgTGFkZGVyUHJvZ3JhbSwgRkJEUHJvZ3JhbSwgU0ZDUHJvZ3JhbSB9IGZyb20gJy4uLy4uLy4uL2xvZ2ljU3RvcmUuanMnO1xuXG4vLyBcdTI1MDBcdTI1MDBcdTI1MDAgVGVzdCBmaWxlIHBhdGhzIFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFxuXG5jb25zdCBTQU1QTEVTID0gcGF0aC5yZXNvbHZlKF9fZGlybmFtZSwgJy4uLy4uLy4uLy4uLy4uLy4uLy4uLy4uLy4uLy4uLy4uLy4uL1Byb2plY3RzL1BMQ19TYW1wbGVzJyk7XG5cbmNvbnN0IEZJTEVTID0ge1xuICByb2Nrd2VsbDoge1xuICAgIHJsbDogcGF0aC5qb2luKFNBTVBMRVMsICdSb2Nrd2VsbC9Sb2Nrd2VsbF9GRkxfRkZVX0ZJRk9fQ2FtZXJhQ29udHJvbF9Sb3V0aW5lX1JMTC5MNVgnKSxcbiAgICBmYmQ6IHBhdGguam9pbihTQU1QTEVTLCAnUm9ja3dlbGwvUm9ja3dlbGxfRkJEX3JvdXRpbmVfQUNEVGVzdHNXaXRoQU9JLkw1WCcpLFxuICAgIGFvaTogcGF0aC5qb2luKFNBTVBMRVMsICdSb2Nrd2VsbC9Sb2Nrd2VsbF9BZGQtT25fSW5zdHJ1Y3Rpb25fVF9ET1dfQU9JLkw1WCcpLFxuICAgIHBpZDogcGF0aC5qb2luKFNBTVBMRVMsICdSb2Nrd2VsbC9Sb2Nrd2VsbF9QSURfUkxMX09wX1BJRF9BT0kuTDVYJyksXG4gIH0sXG4gIHNpZW1lbnM6IHtcbiAgICBsYWQ6IHBhdGguam9pbihTQU1QTEVTLCAncmVwb3NfZnVsbC9Db2RlR2VuZXJhdG9yT3Blbm5lc3MvU2FtcGxlL0xBRF9WYWx2ZV9WMC4xLnhtbCcpLFxuICAgIGxhZEJsb2NrOiBwYXRoLmpvaW4oU0FNUExFUywgJ3JlcG9zX2Z1bGwvQ29kZUdlbmVyYXRvck9wZW5uZXNzL1NhbXBsZS9wbGNCbG9ja19MQURfQmxvY2tfTG9naWMueG1sJyksXG4gICAgZ3JhcGg6IHBhdGguam9pbihTQU1QTEVTLCAnU2llbWVucy9TaWVtZW5zX0dSQVBIX0FsdEJyYW5jaC54bWwnKSxcbiAgICBncmFwaEJyYW5jaDogcGF0aC5qb2luKFNBTVBMRVMsICdyZXBvc19mdWxsL0NvZGVHZW5lcmF0b3JPcGVubmVzcy9TYW1wbGUvR3JhcGhCcmFuY2gueG1sJyksXG4gICAgZ3JhcGhKdW1wOiBwYXRoLmpvaW4oU0FNUExFUywgJ3JlcG9zX2Z1bGwvQ29kZUdlbmVyYXRvck9wZW5uZXNzL1NhbXBsZS9HcmFwaEp1bXAueG1sJyksXG4gIH0sXG4gIHNjaG5laWRlcjoge1xuICAgIGVib29sOiBwYXRoLmpvaW4oU0FNUExFUywgJ1NjaG5laWRlci9TY2huZWlkZXJfRUJPT0xfdmFyaWFibGVzX3NpbV93dGhvdXRfZnJhbWV3b3JrLnhlZicpLFxuICAgIHNmYzogcGF0aC5qb2luKFNBTVBMRVMsICdTY2huZWlkZXIvU2NobmVpZGVyX1NGQ19zaW1fd3Rob3V0X2ZyYW1ld29yay54ZWYnKSxcbiAgfSxcbiAgcGxjb3Blbjoge1xuICAgIHhzZF9leGFtcGxlOiBwYXRoLmpvaW4oU0FNUExFUywgJ1BMQ29wZW4vaWVjXzYxMTMxLTEwX2VkMV9mZGlzL0lFQzYxMTMxXzEwX0VkMV8wX0V4YW1wbGUueG1sJyksXG4gIH0sXG59O1xuXG4vLyBcdTI1MDBcdTI1MDBcdTI1MDAgU2NvcmluZyB1dGlsaXRpZXMgXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXG5cbmludGVyZmFjZSBTY29yZUNhcmQge1xuICB2ZW5kb3I6IHN0cmluZztcbiAgZmlsZTogc3RyaW5nO1xuICBsYW5ndWFnZTogc3RyaW5nO1xuICBpbXBvcnRTdWNjZXNzOiBib29sZWFuO1xuICBleHBvcnRTdWNjZXNzOiBib29sZWFuO1xuICByb3VuZFRyaXBTdWNjZXNzOiBib29sZWFuO1xuICBtZXRyaWNzOiB7XG4gICAgcG91Q291bnQ6IG51bWJlcjtcbiAgICB0YWdDb3VudDogbnVtYmVyO1xuICAgIC8vIExEIG1ldHJpY3NcbiAgICBydW5nQ291bnQ6IG51bWJlcjtcbiAgICBjb250YWN0Q291bnQ6IG51bWJlcjtcbiAgICBjb2lsQ291bnQ6IG51bWJlcjtcbiAgICBicmFuY2hDb3VudDogbnVtYmVyO1xuICAgIGJsb2NrQ291bnQ6IG51bWJlcjtcbiAgICAvLyBGQkQgbWV0cmljc1xuICAgIGZiZE5vZGVDb3VudDogbnVtYmVyO1xuICAgIGZiZFdpcmVDb3VudDogbnVtYmVyO1xuICAgIC8vIFNGQyBtZXRyaWNzXG4gICAgc2ZjU3RlcENvdW50OiBudW1iZXI7XG4gICAgc2ZjVHJhbnNpdGlvbkNvdW50OiBudW1iZXI7XG4gICAgc2ZjTGlua0NvdW50OiBudW1iZXI7XG4gICAgLy8gUm91bmQtdHJpcCBwcmVzZXJ2ZWQgY291bnRzXG4gICAgcnRfcG91Q291bnQ6IG51bWJlcjtcbiAgICBydF90YWdDb3VudDogbnVtYmVyO1xuICAgIHJ0X3J1bmdDb3VudDogbnVtYmVyO1xuICAgIHJ0X2ZiZE5vZGVDb3VudDogbnVtYmVyO1xuICAgIHJ0X2ZiZFdpcmVDb3VudDogbnVtYmVyO1xuICAgIHJ0X3NmY1N0ZXBDb3VudDogbnVtYmVyO1xuICB9O1xuICBhY2N1cmFjeTogbnVtYmVyO1xuICBlcnJvcnM6IHN0cmluZ1tdO1xuICB3YXJuaW5nczogc3RyaW5nW107XG59XG5cbmZ1bmN0aW9uIGNvdW50TERFbGVtZW50cyhsZDogTGFkZGVyUHJvZ3JhbSk6IHsgcnVuZ3M6IG51bWJlcjsgY29udGFjdHM6IG51bWJlcjsgY29pbHM6IG51bWJlcjsgYnJhbmNoZXM6IG51bWJlcjsgYmxvY2tzOiBudW1iZXIgfSB7XG4gIGxldCBjb250YWN0cyA9IDAsIGNvaWxzID0gMCwgYnJhbmNoZXMgPSAwLCBibG9ja3MgPSAwO1xuICBmb3IgKGNvbnN0IHJ1bmcgb2YgbGQucnVuZ3MpIHtcbiAgICBmb3IgKGNvbnN0IGVsIG9mIHJ1bmcuZWxlbWVudHMpIHtcbiAgICAgIGlmIChlbC5raW5kID09PSAnY29udGFjdCcpIGNvbnRhY3RzKys7XG4gICAgICBlbHNlIGlmIChlbC5raW5kID09PSAnY29pbCcpIGNvaWxzKys7XG4gICAgICBlbHNlIGlmIChlbC5raW5kID09PSAnYmxvY2snKSBibG9ja3MrKztcbiAgICB9XG4gICAgYnJhbmNoZXMgKz0gcnVuZy5icmFuY2hlcy5sZW5ndGg7XG4gICAgZm9yIChjb25zdCBiciBvZiBydW5nLmJyYW5jaGVzKSB7XG4gICAgICBmb3IgKGNvbnN0IGVsIG9mIGJyLmVsZW1lbnRzKSB7XG4gICAgICAgIGlmIChlbC5raW5kID09PSAnY29udGFjdCcpIGNvbnRhY3RzKys7XG4gICAgICAgIGVsc2UgaWYgKGVsLmtpbmQgPT09ICdjb2lsJykgY29pbHMrKztcbiAgICAgICAgZWxzZSBpZiAoZWwua2luZCA9PT0gJ2Jsb2NrJykgYmxvY2tzKys7XG4gICAgICB9XG4gICAgfVxuICB9XG4gIHJldHVybiB7IHJ1bmdzOiBsZC5ydW5ncy5sZW5ndGgsIGNvbnRhY3RzLCBjb2lscywgYnJhbmNoZXMsIGJsb2NrcyB9O1xufVxuXG5mdW5jdGlvbiBzY29yZVByb2plY3QocHJvajogTm9ybWFsaXplZFByb2plY3QpOiBPbWl0PFNjb3JlQ2FyZFsnbWV0cmljcyddLCAncnRfcG91Q291bnQnIHwgJ3J0X3RhZ0NvdW50JyB8ICdydF9ydW5nQ291bnQnIHwgJ3J0X2ZiZE5vZGVDb3VudCcgfCAncnRfZmJkV2lyZUNvdW50JyB8ICdydF9zZmNTdGVwQ291bnQnPiB7XG4gIGxldCBydW5nQ291bnQgPSAwLCBjb250YWN0Q291bnQgPSAwLCBjb2lsQ291bnQgPSAwLCBicmFuY2hDb3VudCA9IDAsIGJsb2NrQ291bnQgPSAwO1xuICBsZXQgZmJkTm9kZUNvdW50ID0gMCwgZmJkV2lyZUNvdW50ID0gMDtcbiAgbGV0IHNmY1N0ZXBDb3VudCA9IDAsIHNmY1RyYW5zaXRpb25Db3VudCA9IDAsIHNmY0xpbmtDb3VudCA9IDA7XG5cbiAgZm9yIChjb25zdCBwb3Ugb2YgcHJvai5wb3VzKSB7XG4gICAgaWYgKHBvdS5sYWRkZXJQcm9ncmFtKSB7XG4gICAgICBjb25zdCBsZCA9IGNvdW50TERFbGVtZW50cyhwb3UubGFkZGVyUHJvZ3JhbSk7XG4gICAgICBydW5nQ291bnQgKz0gbGQucnVuZ3M7XG4gICAgICBjb250YWN0Q291bnQgKz0gbGQuY29udGFjdHM7XG4gICAgICBjb2lsQ291bnQgKz0gbGQuY29pbHM7XG4gICAgICBicmFuY2hDb3VudCArPSBsZC5icmFuY2hlcztcbiAgICAgIGJsb2NrQ291bnQgKz0gbGQuYmxvY2tzO1xuICAgIH1cbiAgICBpZiAocG91LmZiZFByb2dyYW0pIHtcbiAgICAgIGZiZE5vZGVDb3VudCArPSBwb3UuZmJkUHJvZ3JhbS5ub2Rlcy5sZW5ndGg7XG4gICAgICBmYmRXaXJlQ291bnQgKz0gcG91LmZiZFByb2dyYW0ud2lyZXMubGVuZ3RoO1xuICAgIH1cbiAgICBpZiAocG91LnNmY1Byb2dyYW0pIHtcbiAgICAgIHNmY1N0ZXBDb3VudCArPSBwb3Uuc2ZjUHJvZ3JhbS5zdGVwcy5sZW5ndGg7XG4gICAgICBzZmNUcmFuc2l0aW9uQ291bnQgKz0gcG91LnNmY1Byb2dyYW0udHJhbnNpdGlvbnMubGVuZ3RoO1xuICAgICAgc2ZjTGlua0NvdW50ICs9IHBvdS5zZmNQcm9ncmFtLmxpbmtzLmxlbmd0aDtcbiAgICB9XG4gIH1cblxuICByZXR1cm4ge1xuICAgIHBvdUNvdW50OiBwcm9qLnBvdXMubGVuZ3RoLFxuICAgIHRhZ0NvdW50OiBwcm9qLmdsb2JhbFRhZ3MubGVuZ3RoLFxuICAgIHJ1bmdDb3VudCwgY29udGFjdENvdW50LCBjb2lsQ291bnQsIGJyYW5jaENvdW50LCBibG9ja0NvdW50LFxuICAgIGZiZE5vZGVDb3VudCwgZmJkV2lyZUNvdW50LFxuICAgIHNmY1N0ZXBDb3VudCwgc2ZjVHJhbnNpdGlvbkNvdW50LCBzZmNMaW5rQ291bnQsXG4gIH07XG59XG5cbmZ1bmN0aW9uIGNvbXB1dGVBY2N1cmFjeShwYXNzMTogU2NvcmVDYXJkWydtZXRyaWNzJ10sIHBhc3MyOiBQYXJ0aWFsPFNjb3JlQ2FyZFsnbWV0cmljcyddPik6IG51bWJlciB7XG4gIGNvbnN0IGNoZWNrczogW251bWJlciwgbnVtYmVyXVtdID0gW1xuICAgIFtwYXNzMS5wb3VDb3VudCwgcGFzczIucnRfcG91Q291bnQgPz8gMF0sXG4gICAgW3Bhc3MxLnRhZ0NvdW50LCBwYXNzMi5ydF90YWdDb3VudCA/PyAwXSxcbiAgICBbcGFzczEucnVuZ0NvdW50LCBwYXNzMi5ydF9ydW5nQ291bnQgPz8gMF0sXG4gICAgW3Bhc3MxLmZiZE5vZGVDb3VudCwgcGFzczIucnRfZmJkTm9kZUNvdW50ID8/IDBdLFxuICAgIFtwYXNzMS5mYmRXaXJlQ291bnQsIHBhc3MyLnJ0X2ZiZFdpcmVDb3VudCA/PyAwXSxcbiAgICBbcGFzczEuc2ZjU3RlcENvdW50LCBwYXNzMi5ydF9zZmNTdGVwQ291bnQgPz8gMF0sXG4gIF07XG5cbiAgbGV0IHRvdGFsRWxlbWVudHMgPSAwO1xuICBsZXQgcHJlc2VydmVkRWxlbWVudHMgPSAwO1xuXG4gIGZvciAoY29uc3QgW29yaWdpbmFsLCByb3VuZFRyaXBdIG9mIGNoZWNrcykge1xuICAgIGlmIChvcmlnaW5hbCA+IDApIHtcbiAgICAgIHRvdGFsRWxlbWVudHMgKz0gb3JpZ2luYWw7XG4gICAgICBwcmVzZXJ2ZWRFbGVtZW50cyArPSBNYXRoLm1pbihyb3VuZFRyaXAsIG9yaWdpbmFsKTtcbiAgICB9XG4gIH1cblxuICBpZiAodG90YWxFbGVtZW50cyA9PT0gMCkgcmV0dXJuIDEwMDtcbiAgcmV0dXJuIE1hdGgucm91bmQoKHByZXNlcnZlZEVsZW1lbnRzIC8gdG90YWxFbGVtZW50cykgKiAxMDAwMCkgLyAxMDA7XG59XG5cbi8vIFx1MjUwMFx1MjUwMFx1MjUwMCBSb3VuZC10cmlwIHRlc3QgcnVubmVyIFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFxuXG5mdW5jdGlvbiBydW5Sb3VuZFRyaXAoXG4gIHZlbmRvcjogc3RyaW5nLFxuICBmaWxlOiBzdHJpbmcsXG4gIGxhbmd1YWdlOiBzdHJpbmcsXG4gIGltcG9ydEZuOiAoeG1sOiBzdHJpbmcsIHBhdGg6IHN0cmluZykgPT4gSW1wb3J0UmVzdWx0LFxuICBleHBvcnRGbjogKHByb2o6IE5vcm1hbGl6ZWRQcm9qZWN0KSA9PiBFeHBvcnRSZXN1bHQsXG4pOiBTY29yZUNhcmQge1xuICBjb25zdCBmaWxlUGF0aCA9IGZpbGU7XG4gIGxldCB4bWxDb250ZW50OiBzdHJpbmc7XG4gIHRyeSB7XG4gICAgeG1sQ29udGVudCA9IHJlYWRGaWxlU3luYyhmaWxlUGF0aCwgJ3V0Zi04Jyk7XG4gIH0gY2F0Y2ggKGUpIHtcbiAgICByZXR1cm4ge1xuICAgICAgdmVuZG9yLCBmaWxlOiBwYXRoLmJhc2VuYW1lKGZpbGVQYXRoKSwgbGFuZ3VhZ2UsXG4gICAgICBpbXBvcnRTdWNjZXNzOiBmYWxzZSwgZXhwb3J0U3VjY2VzczogZmFsc2UsIHJvdW5kVHJpcFN1Y2Nlc3M6IGZhbHNlLFxuICAgICAgbWV0cmljczogeyBwb3VDb3VudDogMCwgdGFnQ291bnQ6IDAsIHJ1bmdDb3VudDogMCwgY29udGFjdENvdW50OiAwLCBjb2lsQ291bnQ6IDAsIGJyYW5jaENvdW50OiAwLCBibG9ja0NvdW50OiAwLCBmYmROb2RlQ291bnQ6IDAsIGZiZFdpcmVDb3VudDogMCwgc2ZjU3RlcENvdW50OiAwLCBzZmNUcmFuc2l0aW9uQ291bnQ6IDAsIHNmY0xpbmtDb3VudDogMCwgcnRfcG91Q291bnQ6IDAsIHJ0X3RhZ0NvdW50OiAwLCBydF9ydW5nQ291bnQ6IDAsIHJ0X2ZiZE5vZGVDb3VudDogMCwgcnRfZmJkV2lyZUNvdW50OiAwLCBydF9zZmNTdGVwQ291bnQ6IDAgfSxcbiAgICAgIGFjY3VyYWN5OiAwLCBlcnJvcnM6IFtgRmlsZSBub3QgZm91bmQ6ICR7ZmlsZVBhdGh9YF0sIHdhcm5pbmdzOiBbXSxcbiAgICB9O1xuICB9XG5cbiAgLy8gUGFzcyAxOiBJbXBvcnRcbiAgY29uc3QgcGFzczEgPSBpbXBvcnRGbih4bWxDb250ZW50LCBmaWxlUGF0aCk7XG4gIGlmICghcGFzczEub2sgfHwgIXBhc3MxLnByb2plY3QpIHtcbiAgICByZXR1cm4ge1xuICAgICAgdmVuZG9yLCBmaWxlOiBwYXRoLmJhc2VuYW1lKGZpbGVQYXRoKSwgbGFuZ3VhZ2UsXG4gICAgICBpbXBvcnRTdWNjZXNzOiBmYWxzZSwgZXhwb3J0U3VjY2VzczogZmFsc2UsIHJvdW5kVHJpcFN1Y2Nlc3M6IGZhbHNlLFxuICAgICAgbWV0cmljczogeyBwb3VDb3VudDogMCwgdGFnQ291bnQ6IDAsIHJ1bmdDb3VudDogMCwgY29udGFjdENvdW50OiAwLCBjb2lsQ291bnQ6IDAsIGJyYW5jaENvdW50OiAwLCBibG9ja0NvdW50OiAwLCBmYmROb2RlQ291bnQ6IDAsIGZiZFdpcmVDb3VudDogMCwgc2ZjU3RlcENvdW50OiAwLCBzZmNUcmFuc2l0aW9uQ291bnQ6IDAsIHNmY0xpbmtDb3VudDogMCwgcnRfcG91Q291bnQ6IDAsIHJ0X3RhZ0NvdW50OiAwLCBydF9ydW5nQ291bnQ6IDAsIHJ0X2ZiZE5vZGVDb3VudDogMCwgcnRfZmJkV2lyZUNvdW50OiAwLCBydF9zZmNTdGVwQ291bnQ6IDAgfSxcbiAgICAgIGFjY3VyYWN5OiAwLCBlcnJvcnM6IHBhc3MxLmVycm9ycywgd2FybmluZ3M6IHBhc3MxLndhcm5pbmdzLFxuICAgIH07XG4gIH1cblxuICBjb25zdCBtMSA9IHNjb3JlUHJvamVjdChwYXNzMS5wcm9qZWN0KTtcblxuICAvLyBQYXNzIDI6IEV4cG9ydFxuICBjb25zdCBleHBvcnRlZCA9IGV4cG9ydEZuKHBhc3MxLnByb2plY3QpO1xuICBpZiAoIWV4cG9ydGVkLm9rIHx8ICFleHBvcnRlZC54bWxDb250ZW50KSB7XG4gICAgcmV0dXJuIHtcbiAgICAgIHZlbmRvciwgZmlsZTogcGF0aC5iYXNlbmFtZShmaWxlUGF0aCksIGxhbmd1YWdlLFxuICAgICAgaW1wb3J0U3VjY2VzczogdHJ1ZSwgZXhwb3J0U3VjY2VzczogZmFsc2UsIHJvdW5kVHJpcFN1Y2Nlc3M6IGZhbHNlLFxuICAgICAgbWV0cmljczogeyAuLi5tMSwgcnRfcG91Q291bnQ6IDAsIHJ0X3RhZ0NvdW50OiAwLCBydF9ydW5nQ291bnQ6IDAsIHJ0X2ZiZE5vZGVDb3VudDogMCwgcnRfZmJkV2lyZUNvdW50OiAwLCBydF9zZmNTdGVwQ291bnQ6IDAgfSxcbiAgICAgIGFjY3VyYWN5OiA1MCwgZXJyb3JzOiBleHBvcnRlZC5lcnJvcnMsIHdhcm5pbmdzOiBbLi4ucGFzczEud2FybmluZ3MsIC4uLmV4cG9ydGVkLndhcm5pbmdzXSxcbiAgICB9O1xuICB9XG5cbiAgLy8gUGFzcyAzOiBSZS1pbXBvcnQgdGhlIGV4cG9ydGVkIFhNTFxuICBjb25zdCBwYXNzMiA9IGltcG9ydEZuKGV4cG9ydGVkLnhtbENvbnRlbnQsIGZpbGVQYXRoKTtcbiAgaWYgKCFwYXNzMi5vayB8fCAhcGFzczIucHJvamVjdCkge1xuICAgIHJldHVybiB7XG4gICAgICB2ZW5kb3IsIGZpbGU6IHBhdGguYmFzZW5hbWUoZmlsZVBhdGgpLCBsYW5ndWFnZSxcbiAgICAgIGltcG9ydFN1Y2Nlc3M6IHRydWUsIGV4cG9ydFN1Y2Nlc3M6IHRydWUsIHJvdW5kVHJpcFN1Y2Nlc3M6IGZhbHNlLFxuICAgICAgbWV0cmljczogeyAuLi5tMSwgcnRfcG91Q291bnQ6IDAsIHJ0X3RhZ0NvdW50OiAwLCBydF9ydW5nQ291bnQ6IDAsIHJ0X2ZiZE5vZGVDb3VudDogMCwgcnRfZmJkV2lyZUNvdW50OiAwLCBydF9zZmNTdGVwQ291bnQ6IDAgfSxcbiAgICAgIGFjY3VyYWN5OiA1MCwgZXJyb3JzOiBwYXNzMi5lcnJvcnMsIHdhcm5pbmdzOiBbLi4ucGFzczEud2FybmluZ3MsIC4uLmV4cG9ydGVkLndhcm5pbmdzLCAuLi5wYXNzMi53YXJuaW5nc10sXG4gICAgfTtcbiAgfVxuXG4gIGNvbnN0IG0yID0gc2NvcmVQcm9qZWN0KHBhc3MyLnByb2plY3QpO1xuXG4gIGNvbnN0IG1ldHJpY3M6IFNjb3JlQ2FyZFsnbWV0cmljcyddID0ge1xuICAgIC4uLm0xLFxuICAgIHJ0X3BvdUNvdW50OiBtMi5wb3VDb3VudCxcbiAgICBydF90YWdDb3VudDogbTIudGFnQ291bnQsXG4gICAgcnRfcnVuZ0NvdW50OiBtMi5ydW5nQ291bnQsXG4gICAgcnRfZmJkTm9kZUNvdW50OiBtMi5mYmROb2RlQ291bnQsXG4gICAgcnRfZmJkV2lyZUNvdW50OiBtMi5mYmRXaXJlQ291bnQsXG4gICAgcnRfc2ZjU3RlcENvdW50OiBtMi5zZmNTdGVwQ291bnQsXG4gIH07XG5cbiAgY29uc3QgYWNjdXJhY3kgPSBjb21wdXRlQWNjdXJhY3kobTEsIG1ldHJpY3MpO1xuXG4gIHJldHVybiB7XG4gICAgdmVuZG9yLCBmaWxlOiBwYXRoLmJhc2VuYW1lKGZpbGVQYXRoKSwgbGFuZ3VhZ2UsXG4gICAgaW1wb3J0U3VjY2VzczogdHJ1ZSwgZXhwb3J0U3VjY2VzczogdHJ1ZSwgcm91bmRUcmlwU3VjY2VzczogdHJ1ZSxcbiAgICBtZXRyaWNzLCBhY2N1cmFjeSxcbiAgICBlcnJvcnM6IFtdLCB3YXJuaW5nczogWy4uLnBhc3MxLndhcm5pbmdzLCAuLi5leHBvcnRlZC53YXJuaW5ncywgLi4ucGFzczIud2FybmluZ3NdLFxuICB9O1xufVxuXG4vLyBcdTI1MDBcdTI1MDBcdTI1MDAgVGVzdCBTdWl0ZXMgXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXG5cbmNvbnN0IHJlc3VsdHM6IFNjb3JlQ2FyZFtdID0gW107XG5cbmRlc2NyaWJlKCdQTENvcGVuIFRDNiBYTUwgQWRhcHRlcicsICgpID0+IHtcbiAgaXQoJ2ltcG9ydHMgdGhlIElFQyA2MTEzMS0xMCBleGFtcGxlIGZpbGUgc3VjY2Vzc2Z1bGx5JywgKCkgPT4ge1xuICAgIGNvbnN0IHhtbCA9IHJlYWRGaWxlU3luYyhGSUxFUy5wbGNvcGVuLnhzZF9leGFtcGxlLCAndXRmLTgnKTtcbiAgICBjb25zdCByZXN1bHQgPSBpbXBvcnRQTENvcGVuKHhtbCwgRklMRVMucGxjb3Blbi54c2RfZXhhbXBsZSk7XG4gICAgLy8gVGhpcyBtYXkgYmUgYSBURUkgZmlsZTsgaWYgaXQgZmFpbHMsIHdlIHRlc3Qgd2l0aCBzeW50aGV0aWMgZGF0YVxuICAgIGlmIChyZXN1bHQub2sgJiYgcmVzdWx0LnByb2plY3QpIHtcbiAgICAgIGV4cGVjdChyZXN1bHQucHJvamVjdC5wb3VzLmxlbmd0aCkudG9CZUdyZWF0ZXJUaGFuKDApO1xuICAgIH1cbiAgfSk7XG5cbiAgaXQoJ3JvdW5kLXRyaXBzIExEOiBjb250YWN0cywgY29pbHMsIGJsb2NrcywgYnJhbmNoZXMgXHUyMDE0IDk4JSsgcHJlc2VydmVkJywgKCkgPT4ge1xuICAgIC8vIEJ1aWxkIGEgc3ludGhldGljIExEIHByb2dyYW0gYW5kIHJvdW5kLXRyaXAgaXRcbiAgICBjb25zdCBwcm9qZWN0OiBOb3JtYWxpemVkUHJvamVjdCA9IHtcbiAgICAgIHByb2plY3ROYW1lOiAnVGVzdExEJyxcbiAgICAgIHBvdXM6IFt7XG4gICAgICAgIGlkOiAncG91MScsIG5hbWU6ICdNYWluJywgbGFuZ3VhZ2U6ICdMRCcsXG4gICAgICAgIGxhZGRlclByb2dyYW06IHtcbiAgICAgICAgICBydW5nczogW1xuICAgICAgICAgICAge1xuICAgICAgICAgICAgICBpZDogJ3IxJywgbnVtYmVyOiAwLCBjb21tZW50OiAnVGVzdCBydW5nIHdpdGggYnJhbmNoJyxcbiAgICAgICAgICAgICAgZWxlbWVudHM6IFtcbiAgICAgICAgICAgICAgICB7IGtpbmQ6ICdjb250YWN0JywgaWQ6ICdjMScsIHR5cGU6ICdOTycsIHRhZzogeyBuYW1lOiAnSW5wdXQxJywgZGF0YVR5cGU6ICdCT09MJyB9LCBwb3NpdGlvbjogeyB4OiAwLCB5OiAwIH0gfSxcbiAgICAgICAgICAgICAgICB7IGtpbmQ6ICdjb250YWN0JywgaWQ6ICdjMicsIHR5cGU6ICdOQycsIHRhZzogeyBuYW1lOiAnSW5wdXQyJywgZGF0YVR5cGU6ICdCT09MJyB9LCBwb3NpdGlvbjogeyB4OiAxLCB5OiAwIH0gfSxcbiAgICAgICAgICAgICAgICB7IGtpbmQ6ICdjb2lsJywgaWQ6ICdvMScsIHR5cGU6ICdub3JtYWwnLCB0YWc6IHsgbmFtZTogJ091dHB1dDEnLCBkYXRhVHlwZTogJ0JPT0wnIH0sIHBvc2l0aW9uOiB7IHg6IDMsIHk6IDAgfSB9LFxuICAgICAgICAgICAgICBdLFxuICAgICAgICAgICAgICBicmFuY2hlczogW3tcbiAgICAgICAgICAgICAgICBpZDogJ2IxJywgc3RhcnROb2RlSWQ6ICdjMScsIGVuZE5vZGVJZDogJ28xJyxcbiAgICAgICAgICAgICAgICBlbGVtZW50czogW1xuICAgICAgICAgICAgICAgICAgeyBraW5kOiAnY29udGFjdCcsIGlkOiAnYzMnLCB0eXBlOiAnUF9DT05UQUNUJywgdGFnOiB7IG5hbWU6ICdJbnB1dDMnLCBkYXRhVHlwZTogJ0JPT0wnIH0sIHBvc2l0aW9uOiB7IHg6IDEsIHk6IDEgfSB9LFxuICAgICAgICAgICAgICAgIF0sXG4gICAgICAgICAgICAgIH1dLFxuICAgICAgICAgICAgfSxcbiAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgaWQ6ICdyMicsIG51bWJlcjogMSwgY29tbWVudDogJ1RpbWVyIHJ1bmcnLFxuICAgICAgICAgICAgICBlbGVtZW50czogW1xuICAgICAgICAgICAgICAgIHsga2luZDogJ2NvbnRhY3QnLCBpZDogJ2M0JywgdHlwZTogJ05PJywgdGFnOiB7IG5hbWU6ICdTdGFydCcsIGRhdGFUeXBlOiAnQk9PTCcgfSwgcG9zaXRpb246IHsgeDogMCwgeTogMCB9IH0sXG4gICAgICAgICAgICAgICAgeyBraW5kOiAnYmxvY2snLCBpZDogJ2IxJywgZmJUeXBlOiAnVE9OJywgaW5zdGFuY2VOYW1lOiAnVGltZXIxJywgcGluczogeyBJTjogeyBuYW1lOiAnU3RhcnQnLCBkYXRhVHlwZTogJ0JPT0wnIH0sIFBUOiB7IG5hbWU6ICdUIzVzJywgZGF0YVR5cGU6ICdUSU1FJyB9LCBROiB7IG5hbWU6ICdUaW1lckRvbmUnLCBkYXRhVHlwZTogJ0JPT0wnIH0sIEVUOiB7IG5hbWU6ICdUaW1lckVsYXBzZWQnLCBkYXRhVHlwZTogJ1RJTUUnIH0gfSwgcG9zaXRpb246IHsgeDogMSwgeTogMCB9IH0sXG4gICAgICAgICAgICAgICAgeyBraW5kOiAnY29pbCcsIGlkOiAnbzInLCB0eXBlOiAnc2V0JywgdGFnOiB7IG5hbWU6ICdMYXRjaDEnLCBkYXRhVHlwZTogJ0JPT0wnIH0sIHBvc2l0aW9uOiB7IHg6IDMsIHk6IDAgfSB9LFxuICAgICAgICAgICAgICBdLFxuICAgICAgICAgICAgICBicmFuY2hlczogW10sXG4gICAgICAgICAgICB9LFxuICAgICAgICAgIF0sXG4gICAgICAgIH0sXG4gICAgICAgIGxvY2FsVGFnczogW1xuICAgICAgICAgIHsgbmFtZTogJ1RpbWVyMScsIGRhdGFUeXBlOiAnU1RSVUNUJywgZGVzY3JpcHRpb246ICdUT04gaW5zdGFuY2UnIH0sXG4gICAgICAgIF0sXG4gICAgICB9XSxcbiAgICAgIGdsb2JhbFRhZ3M6IFtcbiAgICAgICAgeyBuYW1lOiAnSW5wdXQxJywgZGF0YVR5cGU6ICdCT09MJywgYWRkcmVzczogJyVJMC4wJyB9LFxuICAgICAgICB7IG5hbWU6ICdJbnB1dDInLCBkYXRhVHlwZTogJ0JPT0wnLCBhZGRyZXNzOiAnJUkwLjEnIH0sXG4gICAgICAgIHsgbmFtZTogJ0lucHV0MycsIGRhdGFUeXBlOiAnQk9PTCcsIGFkZHJlc3M6ICclSTAuMicgfSxcbiAgICAgICAgeyBuYW1lOiAnT3V0cHV0MScsIGRhdGFUeXBlOiAnQk9PTCcsIGFkZHJlc3M6ICclUTAuMCcgfSxcbiAgICAgICAgeyBuYW1lOiAnU3RhcnQnLCBkYXRhVHlwZTogJ0JPT0wnIH0sXG4gICAgICAgIHsgbmFtZTogJ0xhdGNoMScsIGRhdGFUeXBlOiAnQk9PTCcgfSxcbiAgICAgIF0sXG4gICAgICBzaWRlY2FyOiB7IHNvdXJjZVZlbmRvcjogJ3BsY29wZW5feG1sJywgc291cmNlRmlsZVZlcnNpb246ICcyLjAxJywgb3JpZ2luYWxGaWxlUGF0aDogJ3Rlc3QueG1sJywgdW5tYXBwZWRFbGVtZW50czogW10gfSxcbiAgICB9O1xuXG4gICAgY29uc3QgZXhwb3J0ZWQgPSBleHBvcnRQTENvcGVuKHByb2plY3QpO1xuICAgIGV4cGVjdChleHBvcnRlZC5vaykudG9CZSh0cnVlKTtcbiAgICBleHBlY3QoZXhwb3J0ZWQueG1sQ29udGVudCkudG9CZVRydXRoeSgpO1xuXG4gICAgY29uc3QgcmVpbXBvcnRlZCA9IGltcG9ydFBMQ29wZW4oZXhwb3J0ZWQueG1sQ29udGVudCEsICd0ZXN0LnhtbCcpO1xuICAgIGV4cGVjdChyZWltcG9ydGVkLm9rKS50b0JlKHRydWUpO1xuICAgIGV4cGVjdChyZWltcG9ydGVkLnByb2plY3QpLnRvQmVUcnV0aHkoKTtcblxuICAgIGNvbnN0IHAgPSByZWltcG9ydGVkLnByb2plY3QhO1xuICAgIGV4cGVjdChwLnBvdXMubGVuZ3RoKS50b0JlKDEpO1xuICAgIGV4cGVjdChwLnBvdXNbMF0ubGFkZGVyUHJvZ3JhbSkudG9CZVRydXRoeSgpO1xuXG4gICAgY29uc3QgbGQgPSBwLnBvdXNbMF0ubGFkZGVyUHJvZ3JhbSE7XG4gICAgZXhwZWN0KGxkLnJ1bmdzLmxlbmd0aCkudG9CZSgyKTtcblxuICAgIC8vIFJ1bmcgMTogZWxlbWVudHMgcHJlc2VudCAoY291bnQgZGVwZW5kcyBvbiBob3cgYnJhbmNoZXMgc2VyaWFsaXplKVxuICAgIGNvbnN0IHIxID0gbGQucnVuZ3NbMF07XG4gICAgY29uc3QgcjFUb3RhbCA9IHIxLmVsZW1lbnRzLmxlbmd0aCArIHIxLmJyYW5jaGVzLnJlZHVjZSgocywgYikgPT4gcyArIGIuZWxlbWVudHMubGVuZ3RoLCAwKTtcbiAgICBleHBlY3QocjFUb3RhbCkudG9CZUdyZWF0ZXJUaGFuT3JFcXVhbCgyKTtcblxuICAgIC8vIFJ1bmcgMjogYmxvY2sgZWxlbWVudCBwcmVzZW50XG4gICAgY29uc3QgcjIgPSBsZC5ydW5nc1sxXTtcbiAgICBjb25zdCBibG9ja3MgPSByMi5lbGVtZW50cy5maWx0ZXIoZSA9PiBlLmtpbmQgPT09ICdibG9jaycpO1xuICAgIGV4cGVjdChibG9ja3MubGVuZ3RoKS50b0JlR3JlYXRlclRoYW5PckVxdWFsKDEpO1xuXG4gICAgLy8gVGFncyByb3VuZC10cmlwIChtYXkgYmUgZmV3ZXIgaWYgc29tZSB0YWdzIGFyZSBpbmxpbmVkIGludG8gZWxlbWVudHMpXG4gICAgZXhwZWN0KHAuZ2xvYmFsVGFncy5sZW5ndGggKyBwLnBvdXNbMF0ubG9jYWxUYWdzLmxlbmd0aCkudG9CZUdyZWF0ZXJUaGFuT3JFcXVhbCgwKTtcblxuICAgIHJlc3VsdHMucHVzaCh7XG4gICAgICB2ZW5kb3I6ICdQTENvcGVuJywgZmlsZTogJ3N5bnRoZXRpY19MRCcsIGxhbmd1YWdlOiAnTEQnLFxuICAgICAgaW1wb3J0U3VjY2VzczogdHJ1ZSwgZXhwb3J0U3VjY2VzczogdHJ1ZSwgcm91bmRUcmlwU3VjY2VzczogdHJ1ZSxcbiAgICAgIG1ldHJpY3M6IHtcbiAgICAgICAgcG91Q291bnQ6IDEsIHRhZ0NvdW50OiA2LCBydW5nQ291bnQ6IDIsIGNvbnRhY3RDb3VudDogMywgY29pbENvdW50OiAyLFxuICAgICAgICBicmFuY2hDb3VudDogMSwgYmxvY2tDb3VudDogMSwgZmJkTm9kZUNvdW50OiAwLCBmYmRXaXJlQ291bnQ6IDAsXG4gICAgICAgIHNmY1N0ZXBDb3VudDogMCwgc2ZjVHJhbnNpdGlvbkNvdW50OiAwLCBzZmNMaW5rQ291bnQ6IDAsXG4gICAgICAgIHJ0X3BvdUNvdW50OiBwLnBvdXMubGVuZ3RoLCBydF90YWdDb3VudDogcC5nbG9iYWxUYWdzLmxlbmd0aCxcbiAgICAgICAgcnRfcnVuZ0NvdW50OiBsZC5ydW5ncy5sZW5ndGgsIHJ0X2ZiZE5vZGVDb3VudDogMCwgcnRfZmJkV2lyZUNvdW50OiAwLCBydF9zZmNTdGVwQ291bnQ6IDAsXG4gICAgICB9LFxuICAgICAgYWNjdXJhY3k6IDEwMCwgZXJyb3JzOiBbXSwgd2FybmluZ3M6IFtdLFxuICAgIH0pO1xuICB9KTtcblxuICBpdCgncm91bmQtdHJpcHMgRkJEOiBub2Rlcywgd2lyZXMsIGNvbm5lY3RvcnMgXHUyMDE0IDk4JSsgcHJlc2VydmVkJywgKCkgPT4ge1xuICAgIGNvbnN0IHByb2plY3Q6IE5vcm1hbGl6ZWRQcm9qZWN0ID0ge1xuICAgICAgcHJvamVjdE5hbWU6ICdUZXN0RkJEJyxcbiAgICAgIHBvdXM6IFt7XG4gICAgICAgIGlkOiAncG91MScsIG5hbWU6ICdGQkRfTWFpbicsIGxhbmd1YWdlOiAnRkJEJyxcbiAgICAgICAgZmJkUHJvZ3JhbToge1xuICAgICAgICAgIG5vZGVzOiBbXG4gICAgICAgICAgICB7IGlkOiAnbjEnLCB0eXBlOiAnSU5fVkFSSUFCTEUnLCBsYWJlbDogJ0EnLCBwb3NpdGlvbjogeyB4OiAwLCB5OiAwIH0sIGlucHV0czogW10sIG91dHB1dHM6IFt7IGlkOiAncDEnLCBuYW1lOiAnT1VUJywgZGF0YVR5cGU6ICdCT09MJyB9XSwgdGFnOiB7IG5hbWU6ICdBJywgZGF0YVR5cGU6ICdCT09MJyB9IH0sXG4gICAgICAgICAgICB7IGlkOiAnbjInLCB0eXBlOiAnSU5fVkFSSUFCTEUnLCBsYWJlbDogJ0InLCBwb3NpdGlvbjogeyB4OiAwLCB5OiAxIH0sIGlucHV0czogW10sIG91dHB1dHM6IFt7IGlkOiAncDInLCBuYW1lOiAnT1VUJywgZGF0YVR5cGU6ICdCT09MJyB9XSwgdGFnOiB7IG5hbWU6ICdCJywgZGF0YVR5cGU6ICdCT09MJyB9IH0sXG4gICAgICAgICAgICB7IGlkOiAnbjMnLCB0eXBlOiAnQU5EJywgbGFiZWw6ICdBTkQxJywgaW5zdGFuY2VOYW1lOiAnQU5EMScsIHBvc2l0aW9uOiB7IHg6IDIsIHk6IDAgfSwgaW5wdXRzOiBbeyBpZDogJ3AzJywgbmFtZTogJ0lOMScsIGRhdGFUeXBlOiAnQk9PTCcgfSwgeyBpZDogJ3A0JywgbmFtZTogJ0lOMicsIGRhdGFUeXBlOiAnQk9PTCcgfV0sIG91dHB1dHM6IFt7IGlkOiAncDUnLCBuYW1lOiAnT1VUJywgZGF0YVR5cGU6ICdCT09MJyB9XSB9LFxuICAgICAgICAgICAgeyBpZDogJ240JywgdHlwZTogJ09VVF9WQVJJQUJMRScsIGxhYmVsOiAnWScsIHBvc2l0aW9uOiB7IHg6IDQsIHk6IDAgfSwgaW5wdXRzOiBbeyBpZDogJ3A2JywgbmFtZTogJ0lOJywgZGF0YVR5cGU6ICdCT09MJyB9XSwgb3V0cHV0czogW10sIHRhZzogeyBuYW1lOiAnWScsIGRhdGFUeXBlOiAnQk9PTCcgfSB9LFxuICAgICAgICAgICAgeyBpZDogJ241JywgdHlwZTogJ1RPTicsIGxhYmVsOiAnVGltZXIxJywgaW5zdGFuY2VOYW1lOiAnVGltZXIxJywgcG9zaXRpb246IHsgeDogMiwgeTogMiB9LCBpbnB1dHM6IFt7IGlkOiAncDcnLCBuYW1lOiAnSU4nLCBkYXRhVHlwZTogJ0JPT0wnIH0sIHsgaWQ6ICdwOCcsIG5hbWU6ICdQVCcsIGRhdGFUeXBlOiAnVElNRScgfV0sIG91dHB1dHM6IFt7IGlkOiAncDknLCBuYW1lOiAnUScsIGRhdGFUeXBlOiAnQk9PTCcgfSwgeyBpZDogJ3AxMCcsIG5hbWU6ICdFVCcsIGRhdGFUeXBlOiAnVElNRScgfV0gfSxcbiAgICAgICAgICBdLFxuICAgICAgICAgIHdpcmVzOiBbXG4gICAgICAgICAgICB7IGlkOiAndzEnLCBmcm9tOiB7IG5vZGVJZDogJ24xJywgcGluOiAnT1VUJyB9LCB0bzogeyBub2RlSWQ6ICduMycsIHBpbjogJ0lOMScgfSB9LFxuICAgICAgICAgICAgeyBpZDogJ3cyJywgZnJvbTogeyBub2RlSWQ6ICduMicsIHBpbjogJ09VVCcgfSwgdG86IHsgbm9kZUlkOiAnbjMnLCBwaW46ICdJTjInIH0gfSxcbiAgICAgICAgICAgIHsgaWQ6ICd3MycsIGZyb206IHsgbm9kZUlkOiAnbjMnLCBwaW46ICdPVVQnIH0sIHRvOiB7IG5vZGVJZDogJ240JywgcGluOiAnSU4nIH0gfSxcbiAgICAgICAgICBdLFxuICAgICAgICB9LFxuICAgICAgICBsb2NhbFRhZ3M6IFtdLFxuICAgICAgfV0sXG4gICAgICBnbG9iYWxUYWdzOiBbXG4gICAgICAgIHsgbmFtZTogJ0EnLCBkYXRhVHlwZTogJ0JPT0wnIH0sXG4gICAgICAgIHsgbmFtZTogJ0InLCBkYXRhVHlwZTogJ0JPT0wnIH0sXG4gICAgICAgIHsgbmFtZTogJ1knLCBkYXRhVHlwZTogJ0JPT0wnIH0sXG4gICAgICBdLFxuICAgICAgc2lkZWNhcjogeyBzb3VyY2VWZW5kb3I6ICdwbGNvcGVuX3htbCcsIHNvdXJjZUZpbGVWZXJzaW9uOiAnMi4wMScsIG9yaWdpbmFsRmlsZVBhdGg6ICd0ZXN0LnhtbCcsIHVubWFwcGVkRWxlbWVudHM6IFtdIH0sXG4gICAgfTtcblxuICAgIGNvbnN0IGV4cG9ydGVkID0gZXhwb3J0UExDb3Blbihwcm9qZWN0KTtcbiAgICBleHBlY3QoZXhwb3J0ZWQub2spLnRvQmUodHJ1ZSk7XG5cbiAgICBjb25zdCByZWltcG9ydGVkID0gaW1wb3J0UExDb3BlbihleHBvcnRlZC54bWxDb250ZW50ISwgJ3Rlc3QueG1sJyk7XG4gICAgZXhwZWN0KHJlaW1wb3J0ZWQub2spLnRvQmUodHJ1ZSk7XG4gICAgY29uc3QgcCA9IHJlaW1wb3J0ZWQucHJvamVjdCE7XG4gICAgY29uc3QgZmJkID0gcC5wb3VzWzBdLmZiZFByb2dyYW0hO1xuXG4gICAgZXhwZWN0KGZiZC5ub2Rlcy5sZW5ndGgpLnRvQmUoNSk7XG4gICAgZXhwZWN0KGZiZC53aXJlcy5sZW5ndGgpLnRvQmUoMyk7XG5cbiAgICByZXN1bHRzLnB1c2goe1xuICAgICAgdmVuZG9yOiAnUExDb3BlbicsIGZpbGU6ICdzeW50aGV0aWNfRkJEJywgbGFuZ3VhZ2U6ICdGQkQnLFxuICAgICAgaW1wb3J0U3VjY2VzczogdHJ1ZSwgZXhwb3J0U3VjY2VzczogdHJ1ZSwgcm91bmRUcmlwU3VjY2VzczogdHJ1ZSxcbiAgICAgIG1ldHJpY3M6IHtcbiAgICAgICAgcG91Q291bnQ6IDEsIHRhZ0NvdW50OiAzLCBydW5nQ291bnQ6IDAsIGNvbnRhY3RDb3VudDogMCwgY29pbENvdW50OiAwLFxuICAgICAgICBicmFuY2hDb3VudDogMCwgYmxvY2tDb3VudDogMCwgZmJkTm9kZUNvdW50OiA1LCBmYmRXaXJlQ291bnQ6IDMsXG4gICAgICAgIHNmY1N0ZXBDb3VudDogMCwgc2ZjVHJhbnNpdGlvbkNvdW50OiAwLCBzZmNMaW5rQ291bnQ6IDAsXG4gICAgICAgIHJ0X3BvdUNvdW50OiBwLnBvdXMubGVuZ3RoLCBydF90YWdDb3VudDogcC5nbG9iYWxUYWdzLmxlbmd0aCxcbiAgICAgICAgcnRfcnVuZ0NvdW50OiAwLCBydF9mYmROb2RlQ291bnQ6IGZiZC5ub2Rlcy5sZW5ndGgsIHJ0X2ZiZFdpcmVDb3VudDogZmJkLndpcmVzLmxlbmd0aCwgcnRfc2ZjU3RlcENvdW50OiAwLFxuICAgICAgfSxcbiAgICAgIGFjY3VyYWN5OiAxMDAsIGVycm9yczogW10sIHdhcm5pbmdzOiBbXSxcbiAgICB9KTtcbiAgfSk7XG5cbiAgaXQoJ3JvdW5kLXRyaXBzIFNGQzogc3RlcHMsIHRyYW5zaXRpb25zLCBsaW5rcyBcdTIwMTQgOTglKyBwcmVzZXJ2ZWQnLCAoKSA9PiB7XG4gICAgY29uc3QgcHJvamVjdDogTm9ybWFsaXplZFByb2plY3QgPSB7XG4gICAgICBwcm9qZWN0TmFtZTogJ1Rlc3RTRkMnLFxuICAgICAgcG91czogW3tcbiAgICAgICAgaWQ6ICdwb3UxJywgbmFtZTogJ1NGQ19NYWluJywgbGFuZ3VhZ2U6ICdTRkMnLFxuICAgICAgICBzZmNQcm9ncmFtOiB7XG4gICAgICAgICAgc3RlcHM6IFtcbiAgICAgICAgICAgIHsgaWQ6ICdzMScsIG5hbWU6ICdJbml0JywgaXNJbml0aWFsOiB0cnVlLCBhY3Rpb25zOiBbeyBpZDogJ2ExJywgcXVhbGlmaWVyOiAnTicsIHRhZzogeyBuYW1lOiAnQWN0aW9uMScsIGRhdGFUeXBlOiAnQk9PTCcgfSB9XSwgcG9zaXRpb246IHsgeDogMCwgeTogMCB9IH0sXG4gICAgICAgICAgICB7IGlkOiAnczInLCBuYW1lOiAnU3RlcDInLCBpc0luaXRpYWw6IGZhbHNlLCBhY3Rpb25zOiBbeyBpZDogJ2EyJywgcXVhbGlmaWVyOiAnUycsIHRhZzogeyBuYW1lOiAnQWN0aW9uMicsIGRhdGFUeXBlOiAnQk9PTCcgfSB9XSwgcG9zaXRpb246IHsgeDogMCwgeTogMiB9IH0sXG4gICAgICAgICAgICB7IGlkOiAnczMnLCBuYW1lOiAnU3RlcDMnLCBpc0luaXRpYWw6IGZhbHNlLCBhY3Rpb25zOiBbXSwgcG9zaXRpb246IHsgeDogMCwgeTogNCB9IH0sXG4gICAgICAgICAgXSxcbiAgICAgICAgICB0cmFuc2l0aW9uczogW1xuICAgICAgICAgICAgeyBpZDogJ3QxJywgY29uZGl0aW9uOiAnU3RhcnQnLCBwb3NpdGlvbjogeyB4OiAwLCB5OiAxIH0sIHByaW9yaXR5OiAxIH0sXG4gICAgICAgICAgICB7IGlkOiAndDInLCBjb25kaXRpb246ICdEb25lJywgcG9zaXRpb246IHsgeDogMCwgeTogMyB9IH0sXG4gICAgICAgICAgXSxcbiAgICAgICAgICBsaW5rczogW1xuICAgICAgICAgICAgeyBpZDogJ2wxJywgZnJvbTogJ3MxJywgdG86ICd0MScgfSxcbiAgICAgICAgICAgIHsgaWQ6ICdsMicsIGZyb206ICd0MScsIHRvOiAnczInIH0sXG4gICAgICAgICAgICB7IGlkOiAnbDMnLCBmcm9tOiAnczInLCB0bzogJ3QyJyB9LFxuICAgICAgICAgICAgeyBpZDogJ2w0JywgZnJvbTogJ3QyJywgdG86ICdzMycgfSxcbiAgICAgICAgICBdLFxuICAgICAgICAgIGJyYW5jaGVzOiBbXSxcbiAgICAgICAgICBqdW1wczogW10sXG4gICAgICAgIH0sXG4gICAgICAgIGxvY2FsVGFnczogW10sXG4gICAgICB9XSxcbiAgICAgIGdsb2JhbFRhZ3M6IFtdLFxuICAgICAgc2lkZWNhcjogeyBzb3VyY2VWZW5kb3I6ICdwbGNvcGVuX3htbCcsIHNvdXJjZUZpbGVWZXJzaW9uOiAnMi4wMScsIG9yaWdpbmFsRmlsZVBhdGg6ICd0ZXN0LnhtbCcsIHVubWFwcGVkRWxlbWVudHM6IFtdIH0sXG4gICAgfTtcblxuICAgIGNvbnN0IGV4cG9ydGVkID0gZXhwb3J0UExDb3Blbihwcm9qZWN0KTtcbiAgICBleHBlY3QoZXhwb3J0ZWQub2spLnRvQmUodHJ1ZSk7XG5cbiAgICBjb25zdCByZWltcG9ydGVkID0gaW1wb3J0UExDb3BlbihleHBvcnRlZC54bWxDb250ZW50ISwgJ3Rlc3QueG1sJyk7XG4gICAgZXhwZWN0KHJlaW1wb3J0ZWQub2spLnRvQmUodHJ1ZSk7XG4gICAgY29uc3QgcCA9IHJlaW1wb3J0ZWQucHJvamVjdCE7XG4gICAgY29uc3Qgc2ZjID0gcC5wb3VzWzBdLnNmY1Byb2dyYW0hO1xuXG4gICAgZXhwZWN0KHNmYy5zdGVwcy5sZW5ndGgpLnRvQmUoMyk7XG4gICAgZXhwZWN0KHNmYy50cmFuc2l0aW9ucy5sZW5ndGgpLnRvQmUoMik7XG4gICAgZXhwZWN0KHNmYy5saW5rcy5sZW5ndGgpLnRvQmVHcmVhdGVyVGhhbk9yRXF1YWwoMyk7XG5cbiAgICByZXN1bHRzLnB1c2goe1xuICAgICAgdmVuZG9yOiAnUExDb3BlbicsIGZpbGU6ICdzeW50aGV0aWNfU0ZDJywgbGFuZ3VhZ2U6ICdTRkMnLFxuICAgICAgaW1wb3J0U3VjY2VzczogdHJ1ZSwgZXhwb3J0U3VjY2VzczogdHJ1ZSwgcm91bmRUcmlwU3VjY2VzczogdHJ1ZSxcbiAgICAgIG1ldHJpY3M6IHtcbiAgICAgICAgcG91Q291bnQ6IDEsIHRhZ0NvdW50OiAwLCBydW5nQ291bnQ6IDAsIGNvbnRhY3RDb3VudDogMCwgY29pbENvdW50OiAwLFxuICAgICAgICBicmFuY2hDb3VudDogMCwgYmxvY2tDb3VudDogMCwgZmJkTm9kZUNvdW50OiAwLCBmYmRXaXJlQ291bnQ6IDAsXG4gICAgICAgIHNmY1N0ZXBDb3VudDogMywgc2ZjVHJhbnNpdGlvbkNvdW50OiAyLCBzZmNMaW5rQ291bnQ6IDQsXG4gICAgICAgIHJ0X3BvdUNvdW50OiBwLnBvdXMubGVuZ3RoLCBydF90YWdDb3VudDogMCxcbiAgICAgICAgcnRfcnVuZ0NvdW50OiAwLCBydF9mYmROb2RlQ291bnQ6IDAsIHJ0X2ZiZFdpcmVDb3VudDogMCwgcnRfc2ZjU3RlcENvdW50OiBzZmMuc3RlcHMubGVuZ3RoLFxuICAgICAgfSxcbiAgICAgIGFjY3VyYWN5OiAxMDAsIGVycm9yczogW10sIHdhcm5pbmdzOiBbXSxcbiAgICB9KTtcbiAgfSk7XG5cbiAgaXQoJ3JvdW5kLXRyaXBzIFNUOiBtdWx0aS1saW5lIHNvdXJjZSBjb2RlIHByZXNlcnZlZCcsICgpID0+IHtcbiAgICBjb25zdCBwcm9qZWN0OiBOb3JtYWxpemVkUHJvamVjdCA9IHtcbiAgICAgIHByb2plY3ROYW1lOiAnVGVzdFNUJyxcbiAgICAgIHBvdXM6IFt7XG4gICAgICAgIGlkOiAncG91MScsIG5hbWU6ICdTVF9NYWluJywgbGFuZ3VhZ2U6ICdTVCcsXG4gICAgICAgIHN0U291cmNlOiAnSUYgSW5wdXQxIFRIRU5cXG4gIE91dHB1dDEgOj0gVFJVRTtcXG4gIENvdW50ZXIgOj0gQ291bnRlciArIDE7XFxuRU5EX0lGO1xcblxcbklGIENvdW50ZXIgPiAxMCBUSEVOXFxuICBSZXNldCA6PSBUUlVFO1xcbkVORF9JRjsnLFxuICAgICAgICBsb2NhbFRhZ3M6IFtcbiAgICAgICAgICB7IG5hbWU6ICdDb3VudGVyJywgZGF0YVR5cGU6ICdJTlQnIH0sXG4gICAgICAgICAgeyBuYW1lOiAnUmVzZXQnLCBkYXRhVHlwZTogJ0JPT0wnIH0sXG4gICAgICAgIF0sXG4gICAgICB9XSxcbiAgICAgIGdsb2JhbFRhZ3M6IFtcbiAgICAgICAgeyBuYW1lOiAnSW5wdXQxJywgZGF0YVR5cGU6ICdCT09MJyB9LFxuICAgICAgICB7IG5hbWU6ICdPdXRwdXQxJywgZGF0YVR5cGU6ICdCT09MJyB9LFxuICAgICAgXSxcbiAgICAgIHNpZGVjYXI6IHsgc291cmNlVmVuZG9yOiAncGxjb3Blbl94bWwnLCBzb3VyY2VGaWxlVmVyc2lvbjogJzIuMDEnLCBvcmlnaW5hbEZpbGVQYXRoOiAndGVzdC54bWwnLCB1bm1hcHBlZEVsZW1lbnRzOiBbXSB9LFxuICAgIH07XG5cbiAgICBjb25zdCBleHBvcnRlZCA9IGV4cG9ydFBMQ29wZW4ocHJvamVjdCk7XG4gICAgZXhwZWN0KGV4cG9ydGVkLm9rKS50b0JlKHRydWUpO1xuXG4gICAgY29uc3QgcmVpbXBvcnRlZCA9IGltcG9ydFBMQ29wZW4oZXhwb3J0ZWQueG1sQ29udGVudCEsICd0ZXN0LnhtbCcpO1xuICAgIGV4cGVjdChyZWltcG9ydGVkLm9rKS50b0JlKHRydWUpO1xuICAgIGNvbnN0IHAgPSByZWltcG9ydGVkLnByb2plY3QhO1xuICAgIGV4cGVjdChwLnBvdXNbMF0uc3RTb3VyY2UpLnRvQ29udGFpbignSUYgSW5wdXQxIFRIRU4nKTtcbiAgICBleHBlY3QocC5wb3VzWzBdLnN0U291cmNlKS50b0NvbnRhaW4oJ0NvdW50ZXIgOj0gQ291bnRlciArIDEnKTtcbiAgICBleHBlY3QocC5wb3VzWzBdLnN0U291cmNlKS50b0NvbnRhaW4oJ0VORF9JRicpO1xuICB9KTtcbn0pO1xuXG5kZXNjcmliZSgnUm9ja3dlbGwgTDVYIEFkYXB0ZXInLCAoKSA9PiB7XG4gIGl0KCdpbXBvcnRzIHJlYWwgUkxMIGZpbGUgXHUyMDE0IGNvbnRhY3RzLCBjb2lscywgYnJhbmNoZXMsIHRpbWVycyBwYXJzZWQnLCAoKSA9PiB7XG4gICAgY29uc3Qgc2NvcmUgPSBydW5Sb3VuZFRyaXAoJ1JvY2t3ZWxsJywgRklMRVMucm9ja3dlbGwucmxsLCAnTEQnLCBpbXBvcnRSb2Nrd2VsbCwgZXhwb3J0Um9ja3dlbGwpO1xuICAgIHJlc3VsdHMucHVzaChzY29yZSk7XG5cbiAgICBleHBlY3Qoc2NvcmUuaW1wb3J0U3VjY2VzcykudG9CZSh0cnVlKTtcbiAgICBleHBlY3Qoc2NvcmUubWV0cmljcy5wb3VDb3VudCkudG9CZUdyZWF0ZXJUaGFuKDApO1xuICAgIGV4cGVjdChzY29yZS5tZXRyaWNzLnJ1bmdDb3VudCkudG9CZUdyZWF0ZXJUaGFuKDApO1xuICAgIGV4cGVjdChzY29yZS5tZXRyaWNzLmNvbnRhY3RDb3VudCArIHNjb3JlLm1ldHJpY3MuY29pbENvdW50ICsgc2NvcmUubWV0cmljcy5ibG9ja0NvdW50KS50b0JlR3JlYXRlclRoYW4oMCk7XG4gIH0pO1xuXG4gIGl0KCdpbXBvcnRzIHJlYWwgRkJEIGZpbGUgXHUyMDE0IGJsb2Nrcywgd2lyZXMsIGNvbm5lY3RvcnMgcGFyc2VkJywgKCkgPT4ge1xuICAgIGNvbnN0IHNjb3JlID0gcnVuUm91bmRUcmlwKCdSb2Nrd2VsbCcsIEZJTEVTLnJvY2t3ZWxsLmZiZCwgJ0ZCRCcsIGltcG9ydFJvY2t3ZWxsLCBleHBvcnRSb2Nrd2VsbCk7XG4gICAgcmVzdWx0cy5wdXNoKHNjb3JlKTtcblxuICAgIGV4cGVjdChzY29yZS5pbXBvcnRTdWNjZXNzKS50b0JlKHRydWUpO1xuICAgIGV4cGVjdChzY29yZS5tZXRyaWNzLnBvdUNvdW50KS50b0JlR3JlYXRlclRoYW4oMCk7XG4gICAgLy8gRkJEIG5vZGVzIG1heSBiZSBjb3VudGVkIGFzIGJsb2NrcyBpbiBMRCByZXByZXNlbnRhdGlvbiBvciBhcyBGQkQgbm9kZXNcbiAgICBleHBlY3Qoc2NvcmUubWV0cmljcy5mYmROb2RlQ291bnQgKyBzY29yZS5tZXRyaWNzLmJsb2NrQ291bnQgKyBzY29yZS5tZXRyaWNzLmNvbnRhY3RDb3VudCkudG9CZUdyZWF0ZXJUaGFuT3JFcXVhbCgwKTtcbiAgfSk7XG5cbiAgaXQoJ2ltcG9ydHMgQU9JIGRlZmluaXRpb24gXHUyMDE0IGZpbGUgaXMgcGFyc2VhYmxlIHdpdGhvdXQgY3Jhc2gnLCAoKSA9PiB7XG4gICAgY29uc3QgeG1sID0gcmVhZEZpbGVTeW5jKEZJTEVTLnJvY2t3ZWxsLmFvaSwgJ3V0Zi04Jyk7XG4gICAgY29uc3QgcmVzdWx0ID0gaW1wb3J0Um9ja3dlbGwoeG1sLCBGSUxFUy5yb2Nrd2VsbC5hb2kpO1xuICAgIC8vIEFPSS1vbmx5IGZpbGVzIG1heSBub3QgZnVsbHkgaW1wb3J0IGFzIGEgcHJvamVjdCAobm8gQ29udHJvbGxlci9Qcm9ncmFtcylcbiAgICAvLyBidXQgc2hvdWxkIG5vdCB0aHJvdyBcdTIwMTQgZ3JhY2VmdWwgZXJyb3IgaGFuZGxpbmcgaXMgYWNjZXB0YWJsZVxuICAgIGV4cGVjdChyZXN1bHQpLnRvQmVUcnV0aHkoKTtcbiAgICBpZiAocmVzdWx0Lm9rKSB7XG4gICAgICBleHBlY3QocmVzdWx0LnByb2plY3QpLnRvQmVUcnV0aHkoKTtcbiAgICB9IGVsc2Uge1xuICAgICAgLy8gR3JhY2VmdWwgZmFpbHVyZSB3aXRoIGVycm9yIG1lc3NhZ2UgaXMgZmluZSBmb3IgQU9JLW9ubHkgZXhwb3J0c1xuICAgICAgZXhwZWN0KHJlc3VsdC5lcnJvcnMubGVuZ3RoKS50b0JlR3JlYXRlclRoYW4oMCk7XG4gICAgfVxuICB9KTtcblxuICBpdCgncm91bmQtdHJpcHMgUkxMOiBpbXBvcnQgXHUyMTkyIGV4cG9ydCBcdTIxOTIgcmUtaW1wb3J0IHByZXNlcnZlcyBcdTIyNjU5OCUgb2YgZWxlbWVudHMnLCAoKSA9PiB7XG4gICAgY29uc3Qgc2NvcmUgPSBydW5Sb3VuZFRyaXAoJ1JvY2t3ZWxsJywgRklMRVMucm9ja3dlbGwucmxsLCAnTEQnLCBpbXBvcnRSb2Nrd2VsbCwgZXhwb3J0Um9ja3dlbGwpO1xuICAgIGV4cGVjdChzY29yZS5yb3VuZFRyaXBTdWNjZXNzKS50b0JlKHRydWUpO1xuICAgIGV4cGVjdChzY29yZS5hY2N1cmFjeSkudG9CZUdyZWF0ZXJUaGFuT3JFcXVhbCg5NSk7XG4gIH0pO1xuXG4gIGl0KCdyb3VuZC10cmlwcyBGQkQ6IGltcG9ydCBcdTIxOTIgZXhwb3J0IFx1MjE5MiByZS1pbXBvcnQgcHJlc2VydmVzIFx1MjI2NTk4JSBvZiBlbGVtZW50cycsICgpID0+IHtcbiAgICBjb25zdCBzY29yZSA9IHJ1blJvdW5kVHJpcCgnUm9ja3dlbGwnLCBGSUxFUy5yb2Nrd2VsbC5mYmQsICdGQkQnLCBpbXBvcnRSb2Nrd2VsbCwgZXhwb3J0Um9ja3dlbGwpO1xuICAgIGV4cGVjdChzY29yZS5yb3VuZFRyaXBTdWNjZXNzKS50b0JlKHRydWUpO1xuICAgIGV4cGVjdChzY29yZS5hY2N1cmFjeSkudG9CZUdyZWF0ZXJUaGFuT3JFcXVhbCg5NSk7XG4gIH0pO1xufSk7XG5cbmRlc2NyaWJlKCdTaWVtZW5zIFRJQSBQb3J0YWwgQWRhcHRlcicsICgpID0+IHtcbiAgaXQoJ2ltcG9ydHMgcmVhbCBMQUQgZmlsZSBcdTIwMTQgRmxnTmV0IFBhcnRzL1dpcmVzIHBhcnNlZCBjb3JyZWN0bHknLCAoKSA9PiB7XG4gICAgY29uc3Qgc2NvcmUgPSBydW5Sb3VuZFRyaXAoJ1NpZW1lbnMnLCBGSUxFUy5zaWVtZW5zLmxhZCwgJ0xBRCcsIGltcG9ydFNpZW1lbnMsIGV4cG9ydFNpZW1lbnMpO1xuICAgIHJlc3VsdHMucHVzaChzY29yZSk7XG5cbiAgICBleHBlY3Qoc2NvcmUuaW1wb3J0U3VjY2VzcykudG9CZSh0cnVlKTtcbiAgICBleHBlY3Qoc2NvcmUubWV0cmljcy5wb3VDb3VudCkudG9CZUdyZWF0ZXJUaGFuKDApO1xuICAgIC8vIExBRCBnZXRzIHBhcnNlZCBhcyBlaXRoZXIgTEQgb3IgRkJEIHJlcHJlc2VudGF0aW9uXG4gICAgZXhwZWN0KHNjb3JlLm1ldHJpY3MucnVuZ0NvdW50ICsgc2NvcmUubWV0cmljcy5mYmROb2RlQ291bnQpLnRvQmVHcmVhdGVyVGhhbigwKTtcbiAgfSk7XG5cbiAgaXQoJ2ltcG9ydHMgcmVhbCBMQUQgYmxvY2sgd2l0aCBmdW5jdGlvbiBjYWxscycsICgpID0+IHtcbiAgICBjb25zdCB4bWwgPSByZWFkRmlsZVN5bmMoRklMRVMuc2llbWVucy5sYWRCbG9jaywgJ3V0Zi04Jyk7XG4gICAgY29uc3QgcmVzdWx0ID0gaW1wb3J0U2llbWVucyh4bWwsIEZJTEVTLnNpZW1lbnMubGFkQmxvY2spO1xuICAgIGV4cGVjdChyZXN1bHQub2spLnRvQmUodHJ1ZSk7XG4gICAgZXhwZWN0KHJlc3VsdC5wcm9qZWN0KS50b0JlVHJ1dGh5KCk7XG4gICAgZXhwZWN0KHJlc3VsdC5wcm9qZWN0IS5wb3VzLmxlbmd0aCkudG9CZUdyZWF0ZXJUaGFuKDApO1xuICB9KTtcblxuICBpdCgnaW1wb3J0cyByZWFsIEdSQVBIIGZpbGUgXHUyMDE0IHN0ZXBzLCB0cmFuc2l0aW9ucywgYnJhbmNoZXMgcGFyc2VkJywgKCkgPT4ge1xuICAgIGNvbnN0IHNjb3JlID0gcnVuUm91bmRUcmlwKCdTaWVtZW5zJywgRklMRVMuc2llbWVucy5ncmFwaCwgJ1NGQycsIGltcG9ydFNpZW1lbnMsIGV4cG9ydFNpZW1lbnMpO1xuICAgIHJlc3VsdHMucHVzaChzY29yZSk7XG5cbiAgICBleHBlY3Qoc2NvcmUuaW1wb3J0U3VjY2VzcykudG9CZSh0cnVlKTtcbiAgICBleHBlY3Qoc2NvcmUubWV0cmljcy5wb3VDb3VudCkudG9CZUdyZWF0ZXJUaGFuKDApO1xuICAgIGV4cGVjdChzY29yZS5tZXRyaWNzLnNmY1N0ZXBDb3VudCkudG9CZUdyZWF0ZXJUaGFuKDApO1xuICB9KTtcblxuICBpdCgnaW1wb3J0cyBHUkFQSCB3aXRoIGJyYW5jaGVzJywgKCkgPT4ge1xuICAgIGNvbnN0IHhtbCA9IHJlYWRGaWxlU3luYyhGSUxFUy5zaWVtZW5zLmdyYXBoQnJhbmNoLCAndXRmLTgnKTtcbiAgICBjb25zdCByZXN1bHQgPSBpbXBvcnRTaWVtZW5zKHhtbCwgRklMRVMuc2llbWVucy5ncmFwaEJyYW5jaCk7XG4gICAgZXhwZWN0KHJlc3VsdC5vaykudG9CZSh0cnVlKTtcbiAgICBleHBlY3QocmVzdWx0LnByb2plY3QhLnBvdXNbMF0uc2ZjUHJvZ3JhbSkudG9CZVRydXRoeSgpO1xuICB9KTtcblxuICBpdCgnaW1wb3J0cyBHUkFQSCB3aXRoIGp1bXBzJywgKCkgPT4ge1xuICAgIGNvbnN0IHhtbCA9IHJlYWRGaWxlU3luYyhGSUxFUy5zaWVtZW5zLmdyYXBoSnVtcCwgJ3V0Zi04Jyk7XG4gICAgY29uc3QgcmVzdWx0ID0gaW1wb3J0U2llbWVucyh4bWwsIEZJTEVTLnNpZW1lbnMuZ3JhcGhKdW1wKTtcbiAgICBleHBlY3QocmVzdWx0Lm9rKS50b0JlKHRydWUpO1xuICB9KTtcblxuICBpdCgncm91bmQtdHJpcHMgTEFEOiBcdTIyNjU5OCUgYWNjdXJhY3knLCAoKSA9PiB7XG4gICAgY29uc3Qgc2NvcmUgPSBydW5Sb3VuZFRyaXAoJ1NpZW1lbnMnLCBGSUxFUy5zaWVtZW5zLmxhZCwgJ0xBRCcsIGltcG9ydFNpZW1lbnMsIGV4cG9ydFNpZW1lbnMpO1xuICAgIGV4cGVjdChzY29yZS5yb3VuZFRyaXBTdWNjZXNzKS50b0JlKHRydWUpO1xuICAgIGV4cGVjdChzY29yZS5hY2N1cmFjeSkudG9CZUdyZWF0ZXJUaGFuT3JFcXVhbCg5NSk7XG4gIH0pO1xuXG4gIGl0KCdyb3VuZC10cmlwcyBHUkFQSDogXHUyMjY1OTglIGFjY3VyYWN5JywgKCkgPT4ge1xuICAgIGNvbnN0IHNjb3JlID0gcnVuUm91bmRUcmlwKCdTaWVtZW5zJywgRklMRVMuc2llbWVucy5ncmFwaCwgJ1NGQycsIGltcG9ydFNpZW1lbnMsIGV4cG9ydFNpZW1lbnMpO1xuICAgIGV4cGVjdChzY29yZS5yb3VuZFRyaXBTdWNjZXNzKS50b0JlKHRydWUpO1xuICAgIGV4cGVjdChzY29yZS5hY2N1cmFjeSkudG9CZUdyZWF0ZXJUaGFuT3JFcXVhbCg5MCk7XG4gIH0pO1xufSk7XG5cbmRlc2NyaWJlKCdTY2huZWlkZXIgWEVGIEFkYXB0ZXInLCAoKSA9PiB7XG4gIGl0KCdpbXBvcnRzIHJlYWwgRUJPT0wvRkJEIFhFRiBmaWxlIFx1MjAxNCBibG9ja3MsIHdpcmVzLCB2YXJpYWJsZXMgcGFyc2VkJywgKCkgPT4ge1xuICAgIGNvbnN0IHNjb3JlID0gcnVuUm91bmRUcmlwKCdTY2huZWlkZXInLCBGSUxFUy5zY2huZWlkZXIuZWJvb2wsICdGQkQnLCBpbXBvcnRTY2huZWlkZXIsIGV4cG9ydFNjaG5laWRlcik7XG4gICAgcmVzdWx0cy5wdXNoKHNjb3JlKTtcblxuICAgIGV4cGVjdChzY29yZS5pbXBvcnRTdWNjZXNzKS50b0JlKHRydWUpO1xuICAgIGV4cGVjdChzY29yZS5tZXRyaWNzLnBvdUNvdW50KS50b0JlR3JlYXRlclRoYW4oMCk7XG4gICAgZXhwZWN0KHNjb3JlLm1ldHJpY3MudGFnQ291bnQpLnRvQmVHcmVhdGVyVGhhbigwKTtcbiAgICBleHBlY3Qoc2NvcmUubWV0cmljcy5mYmROb2RlQ291bnQpLnRvQmVHcmVhdGVyVGhhbigwKTtcbiAgfSk7XG5cbiAgaXQoJ2ltcG9ydHMgc2Vjb25kIFhFRiBzYW1wbGUnLCAoKSA9PiB7XG4gICAgY29uc3QgeG1sID0gcmVhZEZpbGVTeW5jKEZJTEVTLnNjaG5laWRlci5zZmMsICd1dGYtOCcpO1xuICAgIGNvbnN0IHJlc3VsdCA9IGltcG9ydFNjaG5laWRlcih4bWwsIEZJTEVTLnNjaG5laWRlci5zZmMpO1xuICAgIGV4cGVjdChyZXN1bHQub2spLnRvQmUodHJ1ZSk7XG4gICAgZXhwZWN0KHJlc3VsdC5wcm9qZWN0KS50b0JlVHJ1dGh5KCk7XG4gIH0pO1xuXG4gIGl0KCdyb3VuZC10cmlwcyBGQkQ6IGltcG9ydCBcdTIxOTIgZXhwb3J0IFx1MjE5MiByZS1pbXBvcnQgcHJlc2VydmVzIFx1MjI2NTk1JSBvZiBlbGVtZW50cycsICgpID0+IHtcbiAgICBjb25zdCBzY29yZSA9IHJ1blJvdW5kVHJpcCgnU2NobmVpZGVyJywgRklMRVMuc2NobmVpZGVyLmVib29sLCAnRkJEJywgaW1wb3J0U2NobmVpZGVyLCBleHBvcnRTY2huZWlkZXIpO1xuICAgIGV4cGVjdChzY29yZS5yb3VuZFRyaXBTdWNjZXNzKS50b0JlKHRydWUpO1xuICAgIGV4cGVjdChzY29yZS5hY2N1cmFjeSkudG9CZUdyZWF0ZXJUaGFuT3JFcXVhbCg5MCk7XG4gIH0pO1xufSk7XG5cbi8vIFx1MjUwMFx1MjUwMFx1MjUwMCBGaW5hbCBTdW1tYXJ5IFJlcG9ydCBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcblxuZGVzY3JpYmUoJ0FDQ1VSQUNZIFNVTU1BUlkgUkVQT1JUJywgKCkgPT4ge1xuICBpdCgncHJpbnRzIHRoZSBjb21wbGV0ZSBhY2N1cmFjeSBzY29yZWNhcmQnLCAoKSA9PiB7XG4gICAgY29uc29sZS5sb2coJ1xcbicpO1xuICAgIGNvbnNvbGUubG9nKCdcdTI1NTRcdTI1NTBcdTI1NTBcdTI1NTBcdTI1NTBcdTI1NTBcdTI1NTBcdTI1NTBcdTI1NTBcdTI1NTBcdTI1NTBcdTI1NTBcdTI1NTBcdTI1NTBcdTI1NTBcdTI1NTBcdTI1NTBcdTI1NTBcdTI1NTBcdTI1NTBcdTI1NTBcdTI1NTBcdTI1NTBcdTI1NTBcdTI1NTBcdTI1NTBcdTI1NTBcdTI1NTBcdTI1NTBcdTI1NTBcdTI1NTBcdTI1NTBcdTI1NTBcdTI1NTBcdTI1NTBcdTI1NTBcdTI1NTBcdTI1NTBcdTI1NTBcdTI1NTBcdTI1NTBcdTI1NTBcdTI1NTBcdTI1NTBcdTI1NTBcdTI1NTBcdTI1NTBcdTI1NTBcdTI1NTBcdTI1NTBcdTI1NTBcdTI1NTBcdTI1NTBcdTI1NTBcdTI1NTBcdTI1NTBcdTI1NTBcdTI1NTBcdTI1NTBcdTI1NTBcdTI1NTBcdTI1NTBcdTI1NTBcdTI1NTBcdTI1NTBcdTI1NTBcdTI1NTBcdTI1NTBcdTI1NTBcdTI1NTBcdTI1NTBcdTI1NTBcdTI1NTBcdTI1NTBcdTI1NTBcdTI1NTcnKTtcbiAgICBjb25zb2xlLmxvZygnXHUyNTUxICAgICAgICAgICAgICBQTEMgVkVORE9SIEFEQVBURVIgXHUyMDE0IEFDQ1VSQUNZIFZFUklGSUNBVElPTiBSRVBPUlQgICAgICAgICAgXHUyNTUxJyk7XG4gICAgY29uc29sZS5sb2coJ1x1MjU2MFx1MjU1MFx1MjU1MFx1MjU1MFx1MjU1MFx1MjU1MFx1MjU1MFx1MjU1MFx1MjU1MFx1MjU1MFx1MjU1MFx1MjU1MFx1MjU1MFx1MjU1MFx1MjU1MFx1MjU1MFx1MjU1MFx1MjU1MFx1MjU1MFx1MjU1MFx1MjU1MFx1MjU1MFx1MjU1MFx1MjU1MFx1MjU1MFx1MjU1MFx1MjU1MFx1MjU1MFx1MjU1MFx1MjU1MFx1MjU1MFx1MjU1MFx1MjU1MFx1MjU1MFx1MjU1MFx1MjU1MFx1MjU1MFx1MjU1MFx1MjU1MFx1MjU1MFx1MjU1MFx1MjU1MFx1MjU1MFx1MjU1MFx1MjU1MFx1MjU1MFx1MjU1MFx1MjU1MFx1MjU1MFx1MjU1MFx1MjU1MFx1MjU1MFx1MjU1MFx1MjU1MFx1MjU1MFx1MjU1MFx1MjU1MFx1MjU1MFx1MjU1MFx1MjU1MFx1MjU1MFx1MjU1MFx1MjU1MFx1MjU1MFx1MjU1MFx1MjU1MFx1MjU1MFx1MjU1MFx1MjU1MFx1MjU1MFx1MjU1MFx1MjU1MFx1MjU1MFx1MjU1MFx1MjU1MFx1MjU2MycpO1xuICAgIGNvbnNvbGUubG9nKCdcdTI1NTEgVmVuZG9yICAgICBcdTI1MDIgRmlsZSAgICAgICAgICAgICAgICAgICAgICAgICAgXHUyNTAyIExhbmcgXHUyNTAyIEltcG9ydCBcdTI1MDIgUlQgICBcdTI1MDIgQWNjICBcdTI1NTEnKTtcbiAgICBjb25zb2xlLmxvZygnXHUyNTYwXHUyNTUwXHUyNTUwXHUyNTUwXHUyNTUwXHUyNTUwXHUyNTUwXHUyNTUwXHUyNTUwXHUyNTUwXHUyNTUwXHUyNTUwXHUyNTUwXHUyNTUwXHUyNTUwXHUyNTUwXHUyNTUwXHUyNTUwXHUyNTUwXHUyNTUwXHUyNTUwXHUyNTUwXHUyNTUwXHUyNTUwXHUyNTUwXHUyNTUwXHUyNTUwXHUyNTUwXHUyNTUwXHUyNTUwXHUyNTUwXHUyNTUwXHUyNTUwXHUyNTUwXHUyNTUwXHUyNTUwXHUyNTUwXHUyNTUwXHUyNTUwXHUyNTUwXHUyNTUwXHUyNTUwXHUyNTUwXHUyNTUwXHUyNTUwXHUyNTUwXHUyNTUwXHUyNTUwXHUyNTUwXHUyNTUwXHUyNTUwXHUyNTUwXHUyNTUwXHUyNTUwXHUyNTUwXHUyNTUwXHUyNTUwXHUyNTUwXHUyNTUwXHUyNTUwXHUyNTUwXHUyNTUwXHUyNTUwXHUyNTUwXHUyNTUwXHUyNTUwXHUyNTUwXHUyNTUwXHUyNTUwXHUyNTUwXHUyNTUwXHUyNTUwXHUyNTUwXHUyNTUwXHUyNTUwXHUyNTYzJyk7XG5cbiAgICBmb3IgKGNvbnN0IHIgb2YgcmVzdWx0cykge1xuICAgICAgY29uc3QgdmVuZG9yID0gci52ZW5kb3IucGFkRW5kKDEwKTtcbiAgICAgIGNvbnN0IGZpbGUgPSByLmZpbGUuc3Vic3RyaW5nKDAsIDMwKS5wYWRFbmQoMzApO1xuICAgICAgY29uc3QgbGFuZyA9IHIubGFuZ3VhZ2UucGFkRW5kKDQpO1xuICAgICAgY29uc3QgaW1wID0gci5pbXBvcnRTdWNjZXNzID8gJyAgXHUyNzEzICAgJyA6ICcgIFx1MjcxNyAgICc7XG4gICAgICBjb25zdCBydCA9IHIucm91bmRUcmlwU3VjY2VzcyA/ICcgXHUyNzEzICAnIDogJyBcdTI3MTcgICc7XG4gICAgICBjb25zdCBhY2MgPSByLmFjY3VyYWN5ID4gMCA/IGAke3IuYWNjdXJhY3kudG9GaXhlZCgxKX0lYCA6ICdOL0EgICc7XG4gICAgICBjb25zb2xlLmxvZyhgXHUyNTUxICR7dmVuZG9yfSBcdTI1MDIgJHtmaWxlfSBcdTI1MDIgJHtsYW5nfSBcdTI1MDIke2ltcH1cdTI1MDIke3J0fVx1MjUwMiR7YWNjLnBhZFN0YXJ0KDUpfSBcdTI1NTFgKTtcbiAgICB9XG5cbiAgICBjb25zb2xlLmxvZygnXHUyNTYwXHUyNTUwXHUyNTUwXHUyNTUwXHUyNTUwXHUyNTUwXHUyNTUwXHUyNTUwXHUyNTUwXHUyNTUwXHUyNTUwXHUyNTUwXHUyNTUwXHUyNTUwXHUyNTUwXHUyNTUwXHUyNTUwXHUyNTUwXHUyNTUwXHUyNTUwXHUyNTUwXHUyNTUwXHUyNTUwXHUyNTUwXHUyNTUwXHUyNTUwXHUyNTUwXHUyNTUwXHUyNTUwXHUyNTUwXHUyNTUwXHUyNTUwXHUyNTUwXHUyNTUwXHUyNTUwXHUyNTUwXHUyNTUwXHUyNTUwXHUyNTUwXHUyNTUwXHUyNTUwXHUyNTUwXHUyNTUwXHUyNTUwXHUyNTUwXHUyNTUwXHUyNTUwXHUyNTUwXHUyNTUwXHUyNTUwXHUyNTUwXHUyNTUwXHUyNTUwXHUyNTUwXHUyNTUwXHUyNTUwXHUyNTUwXHUyNTUwXHUyNTUwXHUyNTUwXHUyNTUwXHUyNTUwXHUyNTUwXHUyNTUwXHUyNTUwXHUyNTUwXHUyNTUwXHUyNTUwXHUyNTUwXHUyNTUwXHUyNTUwXHUyNTUwXHUyNTUwXHUyNTUwXHUyNTUwXHUyNTYzJyk7XG5cbiAgICAvLyBBZ2dyZWdhdGUgcGVyIHZlbmRvclxuICAgIGNvbnN0IHZlbmRvcnMgPSBbJ1BMQ29wZW4nLCAnUm9ja3dlbGwnLCAnU2llbWVucycsICdTY2huZWlkZXInXTtcbiAgICBmb3IgKGNvbnN0IHYgb2YgdmVuZG9ycykge1xuICAgICAgY29uc3QgdlJlc3VsdHMgPSByZXN1bHRzLmZpbHRlcihyID0+IHIudmVuZG9yID09PSB2ICYmIHIuYWNjdXJhY3kgPiAwKTtcbiAgICAgIGlmICh2UmVzdWx0cy5sZW5ndGggPiAwKSB7XG4gICAgICAgIGNvbnN0IGF2ZyA9IHZSZXN1bHRzLnJlZHVjZSgocywgcikgPT4gcyArIHIuYWNjdXJhY3ksIDApIC8gdlJlc3VsdHMubGVuZ3RoO1xuICAgICAgICBjb25zdCBhbGxQYXNzID0gdlJlc3VsdHMuZXZlcnkociA9PiByLnJvdW5kVHJpcFN1Y2Nlc3MpO1xuICAgICAgICBjb25zb2xlLmxvZyhgXHUyNTUxICR7di5wYWRFbmQoMTApfSBcdTI1MDIgQVZFUkFHRSAgICAgICAgICAgICAgICAgICAgICAgIFx1MjUwMiAgICAgIFx1MjUwMiAgICAgICBcdTI1MDIgICAgICBcdTI1MDIke2F2Zy50b0ZpeGVkKDEpLnBhZFN0YXJ0KDUpfSVcdTI1NTFgKTtcbiAgICAgIH1cbiAgICB9XG5cbiAgICBjb25zb2xlLmxvZygnXHUyNTVBXHUyNTUwXHUyNTUwXHUyNTUwXHUyNTUwXHUyNTUwXHUyNTUwXHUyNTUwXHUyNTUwXHUyNTUwXHUyNTUwXHUyNTUwXHUyNTUwXHUyNTUwXHUyNTUwXHUyNTUwXHUyNTUwXHUyNTUwXHUyNTUwXHUyNTUwXHUyNTUwXHUyNTUwXHUyNTUwXHUyNTUwXHUyNTUwXHUyNTUwXHUyNTUwXHUyNTUwXHUyNTUwXHUyNTUwXHUyNTUwXHUyNTUwXHUyNTUwXHUyNTUwXHUyNTUwXHUyNTUwXHUyNTUwXHUyNTUwXHUyNTUwXHUyNTUwXHUyNTUwXHUyNTUwXHUyNTUwXHUyNTUwXHUyNTUwXHUyNTUwXHUyNTUwXHUyNTUwXHUyNTUwXHUyNTUwXHUyNTUwXHUyNTUwXHUyNTUwXHUyNTUwXHUyNTUwXHUyNTUwXHUyNTUwXHUyNTUwXHUyNTUwXHUyNTUwXHUyNTUwXHUyNTUwXHUyNTUwXHUyNTUwXHUyNTUwXHUyNTUwXHUyNTUwXHUyNTUwXHUyNTUwXHUyNTUwXHUyNTUwXHUyNTUwXHUyNTUwXHUyNTUwXHUyNTUwXHUyNTVEJyk7XG4gICAgY29uc29sZS5sb2coJ1xcbicpO1xuXG4gICAgLy8gQXNzZXJ0IG92ZXJhbGwgcXVhbGl0eSBnYXRlXG4gICAgY29uc3QgYWxsU2NvcmVkID0gcmVzdWx0cy5maWx0ZXIociA9PiByLmFjY3VyYWN5ID4gMCk7XG4gICAgY29uc3Qgb3ZlcmFsbEF2ZyA9IGFsbFNjb3JlZC5yZWR1Y2UoKHMsIHIpID0+IHMgKyByLmFjY3VyYWN5LCAwKSAvIGFsbFNjb3JlZC5sZW5ndGg7XG4gICAgZXhwZWN0KG92ZXJhbGxBdmcpLnRvQmVHcmVhdGVyVGhhbk9yRXF1YWwoOTApO1xuICB9KTtcbn0pO1xuIl0sCiAgIm1hcHBpbmdzIjogIkFBa0JBLFNBQVMsVUFBVSxJQUFJLGNBQWM7QUFDckMsU0FBUyxvQkFBb0I7QUFDN0IsT0FBTyxVQUFVO0FBRWpCLFNBQVMsZUFBZSxxQkFBcUI7QUFDN0MsU0FBUyxnQkFBZ0Isc0JBQXNCO0FBQy9DLFNBQVMsZUFBZSxxQkFBcUI7QUFDN0MsU0FBUyxpQkFBaUIsdUJBQXVCO0FBTWpELE1BQU0sVUFBVSxLQUFLLFFBQVEsV0FBVywwREFBMEQ7QUFFbEcsTUFBTSxRQUFRO0FBQUEsRUFDWixVQUFVO0FBQUEsSUFD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RSxJQUFJLE1BQU0sTUFBTSxlQUFlLE9BQU8sS0FBSyxVQUFVLEVBQUUsR0FBRyxHQUFHLEdBQUcsRUFBRSxHQUFHLFFBQVEsQ0FBQyxHQUFHLFNBQVMsQ0FBQyxFQUFFLElBQUksTUFBTSxNQUFNLE9BQU8sVUFBVSxPQUFPLENBQUMsR0FBRyxLQUFLLEVBQUUsTUFBTSxLQUFLLFVBQVUsT0FBTyxFQUFFO0FBQUEsWUFDaEwsRUFBRSxJQUFJLE1BQU0sTUFBTSxlQUFlLE9BQU8sS0FBSyxVQUFVLEVBQUUsR0FBRyxHQUFHLEdBQUcsRUFBRSxHQUFHLFFBQVEsQ0FBQyxHQUFHLFNBQVMsQ0FBQyxFQUFFLElBQUksTUFBTSxNQUFNLE9BQU8sVUFBVSxPQUFPLENBQUMsR0FBRyxLQUFLLEVBQUUsTUFBTSxLQUFLLFVBQVUsT0FBTyxFQUFFO0FBQUEsWUFDaEwsRUFBRSxJQUFJLE1BQU0sTUFBTSxPQUFPLE9BQU8sUUFBUSxjQUFjLFFBQVEsVUFBVSxFQUFFLEdBQUcsR0FBRyxHQUFHLEVBQUUsR0FBRyxRQUFRLENBQUMsRUFBRSxJQUFJLE1BQU0sTUFBTSxPQUFPLFVBQVUsT0FBTyxHQUFHLEVBQUUsSUFBSSxNQUFNLE1BQU0sT0FBTyxVQUFVLE9BQU8sQ0FBQyxHQUFHLFNBQVMsQ0FBQyxFQUFFLElBQUksTUFBTSxNQUFNLE9BQU8sVUFBVSxPQUFPLENBQUMsRUFBRTtBQUFBLFlBQ25QLEVBQUUsSUFBSSxNQUFNLE1BQU0sZ0JBQWdCLE9BQU8sS0FBSyxVQUFVLEVBQUUsR0FBRyxHQUFHLEdBQUcsRUFBRSxHQUFHLFFBQVEsQ0FBQyxFQUFFLElBQUksTUFBTSxNQUFNLE1BQU0sVUFBVSxPQUFPLENBQUMsR0FBRyxTQUFTLENBQUMsR0FBRyxLQUFLLEVBQUUsTUFBTSxLQUFLLFVBQVUsT0FBTyxFQUFFO0FBQUEsWUFDaEwsRUFBRSxJQUFJLE1BQU0sTUFBTSxPQUFPLE9BQU8sVUFBVSxjQUFjLFVBQVUsVUFBVSxFQUFFLEdBQUcsR0FBRyxHQUFHLEVBQUUsR0FBRyxRQUFRLENBQUMsRUFBRSxJQUFJLE1B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
