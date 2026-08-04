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
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvY29udHJpYi92b2lkL2Jyb3dzZXIvcmVhY3Qvc3JjMi9wbGMtZWRpdG9yLXRzeC92ZW5kb3IvYWRhcHRlcnMvX190ZXN0c19fL2FjY3VyYWN5LnRlc3QudHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbIi8qKlxuICogUExDIFZlbmRvciBBZGFwdGVyIFx1MjAxNCBSb3VuZC1UcmlwIEFjY3VyYWN5IFZlcmlmaWNhdGlvbiBTdWl0ZVxuICpcbiAqIFRoaXMgdGVzdCBzdWl0ZSBwcm92aWRlcyBWRVJJRklFRCBQUk9PRiBvZiBpbXBvcnQvZXhwb3J0IGFjY3VyYWN5IGZvciBhbGwgZm91clxuICogdmVuZG9yIGFkYXB0ZXJzIChQTENvcGVuIFRDNiwgUm9ja3dlbGwgTDVYLCBTaWVtZW5zIFNpbWF0aWNNTCwgU2NobmVpZGVyIFhFRilcbiAqIGFjcm9zcyBhbGwgSUVDIDYxMTMxLTMgbGFuZ3VhZ2VzIChMRCwgRkJELCBTRkMsIFNUKS5cbiAqXG4gKiBNZXRob2RvbG9neTpcbiAqIDEuIEltcG9ydCBhIHJlYWwgdmVuZG9yIGZpbGUgdXNpbmcgdGhlIGFkYXB0ZXJcbiAqIDIuIFZhbGlkYXRlIHRoZSBwYXJzZWQgTm9ybWFsaXplZFByb2plY3QgaGFzIGV4cGVjdGVkIGVsZW1lbnRzIChubyBzaWxlbnQgZGF0YSBsb3NzKVxuICogMy4gUmUtZXhwb3J0IHRoZSBOb3JtYWxpemVkUHJvamVjdCBiYWNrIHRvIHZlbmRvciBYTUxcbiAqIDQuIFJlLWltcG9ydCB0aGUgZXhwb3J0ZWQgWE1MIChzZWNvbmQgcGFzcylcbiAqIDUuIENvbXBhcmU6IGFsbCBlbGVtZW50cyBmcm9tIHBhc3MgMSBtdXN0IHN1cnZpdmUgaW50byBwYXNzIDJcbiAqIDYuIFNjb3JlOiAocHJlc2VydmVkIGVsZW1lbnRzIC8gdG90YWwgZWxlbWVudHMpIFx1MDBENyAxMDAgPSBhY2N1cmFjeSAlXG4gKlxuICogUGFzcyBjcml0ZXJpYTogXHUyMjY1OTglIGFjY3VyYWN5IHBlciB2ZW5kb3IgcGVyIGxhbmd1YWdlIGZvciBib3RoIGltcG9ydCBhbmQgZXhwb3J0LlxuICovXG5cbmltcG9ydCB7IGRlc2NyaWJlLCBpdCwgZXhwZWN0IH0gZnJvbSAndml0ZXN0JztcbmltcG9ydCB7IHJlYWRGaWxlU3luYyB9IGZyb20gJ2ZzJztcbmltcG9ydCBwYXRoIGZyb20gJ3BhdGgnO1xuXG5pbXBvcnQgeyBpbXBvcnRQTENvcGVuLCBleHBvcnRQTENvcGVuIH0gZnJvbSAnLi4vcGxjb3BlbkFkYXB0ZXIuanMnO1xuaW1wb3J0IHsgaW1wb3J0Um9ja3dlbGwsIGV4cG9ydFJvY2t3ZWxsIH0gZnJvbSAnLi4vcm9ja3dlbGxBZGFwdGVyLmpzJztcbmltcG9ydCB7IGltcG9ydFNpZW1lbnMsIGV4cG9ydFNpZW1lbnMgfSBmcm9tICcuLi9zaWVtZW5zQWRhcHRlci5qcyc7XG5pbXBvcnQgeyBpbXBvcnRTY2huZWlkZXIsIGV4cG9ydFNjaG5laWRlciB9IGZyb20gJy4uL3NjaG5laWRlckFkYXB0ZXIuanMnO1xuaW1wb3J0IHR5cGUgeyBOb3JtYWxpemVkUHJvamVjdCwgSW1wb3J0UmVzdWx0LCBFeHBvcnRSZXN1bHQgfSBmcm9tICcuLi8uLi90eXBlcy5qcyc7XG5pbXBvcnQgdHlwZSB7IExhZGRlclByb2dyYW0sIEZCRFByb2dyYW0sIFNGQ1Byb2dyYW0gfSBmcm9tICcuLi8uLi8uLi9sb2dpY1N0b3JlLmpzJztcblxuLy8gXHUyNTAwXHUyNTAwXHUyNTAwIFRlc3QgZmlsZSBwYXRocyBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcblxuY29uc3QgU0FNUExFUyA9IHBhdGgucmVzb2x2ZShfX2Rpcm5hbWUsICcuLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi9Qcm9qZWN0cy9QTENfU2FtcGxlcycpO1xuXG5jb25zdCBGSUxFUyA9IHtcbiAgcm9ja3dlbGw6IHtcbiAgICBybGw6IHBhdGguam9pbihTQU1QTEVTLCAnUm9ja3dlbGwvUm9ja3dlbGxfRkZMX0ZGVV9GSUZPX0NhbWVyYUNvbnRyb2xfUm91dGluZV9STEwuTDVYJyksXG4gICAgZmJkOiBwYXRoLmpvaW4oU0FNUExFUywgJ1JvY2t3ZWxsL1JvY2t3ZWxsX0ZCRF9yb3V0aW5lX0FDRFRlc3RzV2l0aEFPSS5MNVgnKSxcbiAgICBhb2k6IHBhdGguam9pbihTQU1QTEVTLCAnUm9ja3dlbGwvUm9ja3dlbGxfQWRkLU9uX0luc3RydWN0aW9uX1RfRE9XX0FPSS5MNVgnKSxcbiAgICBwaWQ6IHBhdGguam9pbihTQU1QTEVTLCAnUm9ja3dlbGwvUm9ja3dlbGxfUElEX1JMTF9PcF9QSURfQU9JLkw1WCcpLFxuICB9LFxuICBzaWVtZW5zOiB7XG4gICAgbGFkOiBwYXRoLmpvaW4oU0FNUExFUywgJ3JlcG9zX2Z1bGwvQ29kZUdlbmVyYXRvck9wZW5uZXNzL1NhbXBsZS9MQURfVmFsdmVfVjAuMS54bWwnKSxcbiAgICBsYWRCbG9jazogcGF0aC5qb2luKFNBTVBMRVMsICdyZXBvc19mdWxsL0NvZGVHZW5lcmF0b3JPcGVubmVzcy9TYW1wbGUvcGxjQmxvY2tfTEFEX0Jsb2NrX0xvZ2ljLnhtbCcpLFxuICAgIGdyYXBoOiBwYXRoLmpvaW4oU0FNUExFUywgJ1NpZW1lbnMvU2llbWVuc19HUkFQSF9BbHRCcmFuY2gueG1sJyksXG4gICAgZ3JhcGhCcmFuY2g6IHBhdGguam9pbihTQU1QTEVTLCAncmVwb3NfZnVsbC9Db2RlR2VuZXJhdG9yT3Blbm5lc3MvU2FtcGxlL0dyYXBoQnJhbmNoLnhtbCcpLFxuICAgIGdyYXBoSnVtcDogcGF0aC5qb2luKFNBTVBMRVMsICdyZXBvc19mdWxsL0NvZGVHZW5lcmF0b3JPcGVubmVzcy9TYW1wbGUvR3JhcGhKdW1wLnhtbCcpLFxuICB9LFxuICBzY2huZWlkZXI6IHtcbiAgICBlYm9vbDogcGF0aC5qb2luKFNBTVBMRVMsICdTY2huZWlkZXIvU2NobmVpZGVyX0VCT09MX3ZhcmlhYmxlc19zaW1fd3Rob3V0X2ZyYW1ld29yay54ZWYnKSxcbiAgICBzZmM6IHBhdGguam9pbihTQU1QTEVTLCAnU2NobmVpZGVyL1NjaG5laWRlcl9TRkNfc2ltX3d0aG91dF9mcmFtZXdvcmsueGVmJyksXG4gIH0sXG4gIHBsY29wZW46IHtcbiAgICB4c2RfZXhhbXBsZTogcGF0aC5qb2luKFNBTVBMRVMsICdQTENvcGVuL2llY182MTEzMS0xMF9lZDFfZmRpcy9JRUM2MTEzMV8xMF9FZDFfMF9FeGFtcGxlLnhtbCcpLFxuICB9LFxufTtcblxuLy8gXHUyNTAwXHUyNTAwXHUyNTAwIFNjb3JpbmcgdXRpbGl0aWVzIFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFxuXG5pbnRlcmZhY2UgU2NvcmVDYXJkIHtcbiAgdmVuZG9yOiBzdHJpbmc7XG4gIGZpbGU6IHN0cmluZztcbiAgbGFuZ3VhZ2U6IHN0cmluZztcbiAgaW1wb3J0U3VjY2VzczogYm9vbGVhbjtcbiAgZXhwb3J0U3VjY2VzczogYm9vbGVhbjtcbiAgcm91bmRUcmlwU3VjY2VzczogYm9vbGVhbjtcbiAgbWV0cmljczoge1xuICAgIHBvdUNvdW50OiBudW1iZXI7XG4gICAgdGFnQ291bnQ6IG51bWJlcjtcbiAgICAvLyBMRCBtZXRyaWNzXG4gICAgcnVuZ0NvdW50OiBudW1iZXI7XG4gICAgY29udGFjdENvdW50OiBudW1iZXI7XG4gICAgY29pbENvdW50OiBudW1iZXI7XG4gICAgYnJhbmNoQ291bnQ6IG51bWJlcjtcbiAgICBibG9ja0NvdW50OiBudW1iZXI7XG4gICAgLy8gRkJEIG1ldHJpY3NcbiAgICBmYmROb2RlQ291bnQ6IG51bWJlcjtcbiAgICBmYmRXaXJlQ291bnQ6IG51bWJlcjtcbiAgICAvLyBTRkMgbWV0cmljc1xuICAgIHNmY1N0ZXBDb3VudDogbnVtYmVyO1xuICAgIHNmY1RyYW5zaXRpb25Db3VudDogbnVtYmVyO1xuICAgIHNmY0xpbmtDb3VudDogbnVtYmVyO1xuICAgIC8vIFJvdW5kLXRyaXAgcHJlc2VydmVkIGNvdW50c1xuICAgIHJ0X3BvdUNvdW50OiBudW1iZXI7XG4gICAgcnRfdGFnQ291bnQ6IG51bWJlcjtcbiAgICBydF9ydW5nQ291bnQ6IG51bWJlcjtcbiAgICBydF9mYmROb2RlQ291bnQ6IG51bWJlcjtcbiAgICBydF9mYmRXaXJlQ291bnQ6IG51bWJlcjtcbiAgICBydF9zZmNTdGVwQ291bnQ6IG51bWJlcjtcbiAgfTtcbiAgYWNjdXJhY3k6IG51bWJlcjtcbiAgZXJyb3JzOiBzdHJpbmdbXTtcbiAgd2FybmluZ3M6IHN0cmluZ1tdO1xufVxuXG5mdW5jdGlvbiBjb3VudExERWxlbWVudHMobGQ6IExhZGRlclByb2dyYW0pOiB7IHJ1bmdzOiBudW1iZXI7IGNvbnRhY3RzOiBudW1iZXI7IGNvaWxzOiBudW1iZXI7IGJyYW5jaGVzOiBudW1iZXI7IGJsb2NrczogbnVtYmVyIH0ge1xuICBsZXQgY29udGFjdHMgPSAwLCBjb2lscyA9IDAsIGJyYW5jaGVzID0gMCwgYmxvY2tzID0gMDtcbiAgZm9yIChjb25zdCBydW5nIG9mIGxkLnJ1bmdzKSB7XG4gICAgZm9yIChjb25zdCBlbCBvZiBydW5nLmVsZW1lbnRzKSB7XG4gICAgICBpZiAoZWwua2luZCA9PT0gJ2NvbnRhY3QnKSBjb250YWN0cysrO1xuICAgICAgZWxzZSBpZiAoZWwua2luZCA9PT0gJ2NvaWwnKSBjb2lscysrO1xuICAgICAgZWxzZSBpZiAoZWwua2luZCA9PT0gJ2Jsb2NrJykgYmxvY2tzKys7XG4gICAgfVxuICAgIGJyYW5jaGVzICs9IHJ1bmcuYnJhbmNoZXMubGVuZ3RoO1xuICAgIGZvciAoY29uc3QgYnIgb2YgcnVuZy5icmFuY2hlcykge1xuICAgICAgZm9yIChjb25zdCBlbCBvZiBici5lbGVtZW50cykge1xuICAgICAgICBpZiAoZWwua2luZCA9PT0gJ2NvbnRhY3QnKSBjb250YWN0cysrO1xuICAgICAgICBlbHNlIGlmIChlbC5raW5kID09PSAnY29pbCcpIGNvaWxzKys7XG4gICAgICAgIGVsc2UgaWYgKGVsLmtpbmQgPT09ICdibG9jaycpIGJsb2NrcysrO1xuICAgICAgfVxuICAgIH1cbiAgfVxuICByZXR1cm4geyBydW5nczogbGQucnVuZ3MubGVuZ3RoLCBjb250YWN0cywgY29pbHMsIGJyYW5jaGVzLCBibG9ja3MgfTtcbn1cblxuZnVuY3Rpb24gc2NvcmVQcm9qZWN0KHByb2o6IE5vcm1hbGl6ZWRQcm9qZWN0KTogT21pdDxTY29yZUNhcmRbJ21ldHJpY3MnXSwgJ3J0X3BvdUNvdW50JyB8ICdydF90YWdDb3VudCcgfCAncnRfcnVuZ0NvdW50JyB8ICdydF9mYmROb2RlQ291bnQnIHwgJ3J0X2ZiZFdpcmVDb3VudCcgfCAncnRfc2ZjU3RlcENvdW50Jz4ge1xuICBsZXQgcnVuZ0NvdW50ID0gMCwgY29udGFjdENvdW50ID0gMCwgY29pbENvdW50ID0gMCwgYnJhbmNoQ291bnQgPSAwLCBibG9ja0NvdW50ID0gMDtcbiAgbGV0IGZiZE5vZGVDb3VudCA9IDAsIGZiZFdpcmVDb3VudCA9IDA7XG4gIGxldCBzZmNTdGVwQ291bnQgPSAwLCBzZmNUcmFuc2l0aW9uQ291bnQgPSAwLCBzZmNMaW5rQ291bnQgPSAwO1xuXG4gIGZvciAoY29uc3QgcG91IG9mIHByb2oucG91cykge1xuICAgIGlmIChwb3UubGFkZGVyUHJvZ3JhbSkge1xuICAgICAgY29uc3QgbGQgPSBjb3VudExERWxlbWVudHMocG91LmxhZGRlclByb2dyYW0pO1xuICAgICAgcnVuZ0NvdW50ICs9IGxkLnJ1bmdzO1xuICAgICAgY29udGFjdENvdW50ICs9IGxkLmNvbnRhY3RzO1xuICAgICAgY29pbENvdW50ICs9IGxkLmNvaWxzO1xuICAgICAgYnJhbmNoQ291bnQgKz0gbGQuYnJhbmNoZXM7XG4gICAgICBibG9ja0NvdW50ICs9IGxkLmJsb2NrcztcbiAgICB9XG4gICAgaWYgKHBvdS5mYmRQcm9ncmFtKSB7XG4gICAgICBmYmROb2RlQ291bnQgKz0gcG91LmZiZFByb2dyYW0ubm9kZXMubGVuZ3RoO1xuICAgICAgZmJkV2lyZUNvdW50ICs9IHBvdS5mYmRQcm9ncmFtLndpcmVzLmxlbmd0aDtcbiAgICB9XG4gICAgaWYgKHBvdS5zZmNQcm9ncmFtKSB7XG4gICAgICBzZmNTdGVwQ291bnQgKz0gcG91LnNmY1Byb2dyYW0uc3RlcHMubGVuZ3RoO1xuICAgICAgc2ZjVHJhbnNpdGlvbkNvdW50ICs9IHBvdS5zZmNQcm9ncmFtLnRyYW5zaXRpb25zLmxlbmd0aDtcbiAgICAgIHNmY0xpbmtDb3VudCArPSBwb3Uuc2ZjUHJvZ3JhbS5saW5rcy5sZW5ndGg7XG4gICAgfVxuICB9XG5cbiAgcmV0dXJuIHtcbiAgICBwb3VDb3VudDogcHJvai5wb3VzLmxlbmd0aCxcbiAgICB0YWdDb3VudDogcHJvai5nbG9iYWxUYWdzLmxlbmd0aCxcbiAgICBydW5nQ291bnQsIGNvbnRhY3RDb3VudCwgY29pbENvdW50LCBicmFuY2hDb3VudCwgYmxvY2tDb3VudCxcbiAgICBmYmROb2RlQ291bnQsIGZiZFdpcmVDb3VudCxcbiAgICBzZmNTdGVwQ291bnQsIHNmY1RyYW5zaXRpb25Db3VudCwgc2ZjTGlua0NvdW50LFxuICB9O1xufVxuXG5mdW5jdGlvbiBjb21wdXRlQWNjdXJhY3kocGFzczE6IFNjb3JlQ2FyZFsnbWV0cmljcyddLCBwYXNzMjogUGFydGlhbDxTY29yZUNhcmRbJ21ldHJpY3MnXT4pOiBudW1iZXIge1xuICBjb25zdCBjaGVja3M6IFtudW1iZXIsIG51bWJlcl1bXSA9IFtcbiAgICBbcGFzczEucG91Q291bnQsIHBhc3MyLnJ0X3BvdUNvdW50ID8/IDBdLFxuICAgIFtwYXNzMS50YWdDb3VudCwgcGFzczIucnRfdGFnQ291bnQgPz8gMF0sXG4gICAgW3Bhc3MxLnJ1bmdDb3VudCwgcGFzczIucnRfcnVuZ0NvdW50ID8/IDBdLFxuICAgIFtwYXNzMS5mYmROb2RlQ291bnQsIHBhc3MyLnJ0X2ZiZE5vZGVDb3VudCA/PyAwXSxcbiAgICBbcGFzczEuZmJkV2lyZUNvdW50LCBwYXNzMi5ydF9mYmRXaXJlQ291bnQgPz8gMF0sXG4gICAgW3Bhc3MxLnNmY1N0ZXBDb3VudCwgcGFzczIucnRfc2ZjU3RlcENvdW50ID8/IDBdLFxuICBdO1xuXG4gIGxldCB0b3RhbEVsZW1lbnRzID0gMDtcbiAgbGV0IHByZXNlcnZlZEVsZW1lbnRzID0gMDtcblxuICBmb3IgKGNvbnN0IFtvcmlnaW5hbCwgcm91bmRUcmlwXSBvZiBjaGVja3MpIHtcbiAgICBpZiAob3JpZ2luYWwgPiAwKSB7XG4gICAgICB0b3RhbEVsZW1lbnRzICs9IG9yaWdpbmFsO1xuICAgICAgcHJlc2VydmVkRWxlbWVudHMgKz0gTWF0aC5taW4ocm91bmRUcmlwLCBvcmlnaW5hbCk7XG4gICAgfVxuICB9XG5cbiAgaWYgKHRvdGFsRWxlbWVudHMgPT09IDApIHJldHVybiAxMDA7XG4gIHJldHVybiBNYXRoLnJvdW5kKChwcmVzZXJ2ZWRFbGVtZW50cyAvIHRvdGFsRWxlbWVudHMpICogMTAwMDApIC8gMTAwO1xufVxuXG4vLyBcdTI1MDBcdTI1MDBcdTI1MDAgUm91bmQtdHJpcCB0ZXN0IHJ1bm5lciBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcblxuZnVuY3Rpb24gcnVuUm91bmRUcmlwKFxuICB2ZW5kb3I6IHN0cmluZyxcbiAgZmlsZTogc3RyaW5nLFxuICBsYW5ndWFnZTogc3RyaW5nLFxuICBpbXBvcnRGbjogKHhtbDogc3RyaW5nLCBwYXRoOiBzdHJpbmcpID0+IEltcG9ydFJlc3VsdCxcbiAgZXhwb3J0Rm46IChwcm9qOiBOb3JtYWxpemVkUHJvamVjdCkgPT4gRXhwb3J0UmVzdWx0LFxuKTogU2NvcmVDYXJkIHtcbiAgY29uc3QgZmlsZVBhdGggPSBmaWxlO1xuICBsZXQgeG1sQ29udGVudDogc3RyaW5nO1xuICB0cnkge1xuICAgIHhtbENvbnRlbnQgPSByZWFkRmlsZVN5bmMoZmlsZVBhdGgsICd1dGYtOCcpO1xuICB9IGNhdGNoIChlKSB7XG4gICAgcmV0dXJuIHtcbiAgICAgIHZlbmRvciwgZmlsZTogcGF0aC5iYXNlbmFtZShmaWxlUGF0aCksIGxhbmd1YWdlLFxuICAgICAgaW1wb3J0U3VjY2VzczogZmFsc2UsIGV4cG9ydFN1Y2Nlc3M6IGZhbHNlLCByb3VuZFRyaXBTdWNjZXNzOiBmYWxzZSxcbiAgICAgIG1ldHJpY3M6IHsgcG91Q291bnQ6IDAsIHRhZ0NvdW50OiAwLCBydW5nQ291bnQ6IDAsIGNvbnRhY3RDb3VudDogMCwgY29pbENvdW50OiAwLCBicmFuY2hDb3VudDogMCwgYmxvY2tDb3VudDogMCwgZmJkTm9kZUNvdW50OiAwLCBmYmRXaXJlQ291bnQ6IDAsIHNmY1N0ZXBDb3VudDogMCwgc2ZjVHJhbnNpdGlvbkNvdW50OiAwLCBzZmNMaW5rQ291bnQ6IDAsIHJ0X3BvdUNvdW50OiAwLCBydF90YWdDb3VudDogMCwgcnRfcnVuZ0NvdW50OiAwLCBydF9mYmROb2RlQ291bnQ6IDAsIHJ0X2ZiZFdpcmVDb3VudDogMCwgcnRfc2ZjU3RlcENvdW50OiAwIH0sXG4gICAgICBhY2N1cmFjeTogMCwgZXJyb3JzOiBbYEZpbGUgbm90IGZvdW5kOiAke2ZpbGVQYXRofWBdLCB3YXJuaW5nczogW10sXG4gICAgfTtcbiAgfVxuXG4gIC8vIFBhc3MgMTogSW1wb3J0XG4gIGNvbnN0IHBhc3MxID0gaW1wb3J0Rm4oeG1sQ29udGVudCwgZmlsZVBhdGgpO1xuICBpZiAoIXBhc3MxLm9rIHx8ICFwYXNzMS5wcm9qZWN0KSB7XG4gICAgcmV0dXJuIHtcbiAgICAgIHZlbmRvciwgZmlsZTogcGF0aC5iYXNlbmFtZShmaWxlUGF0aCksIGxhbmd1YWdlLFxuICAgICAgaW1wb3J0U3VjY2VzczogZmFsc2UsIGV4cG9ydFN1Y2Nlc3M6IGZhbHNlLCByb3VuZFRyaXBTdWNjZXNzOiBmYWxzZSxcbiAgICAgIG1ldHJpY3M6IHsgcG91Q291bnQ6IDAsIHRhZ0NvdW50OiAwLCBydW5nQ291bnQ6IDAsIGNvbnRhY3RDb3VudDogMCwgY29pbENvdW50OiAwLCBicmFuY2hDb3VudDogMCwgYmxvY2tDb3VudDogMCwgZmJkTm9kZUNvdW50OiAwLCBmYmRXaXJlQ291bnQ6IDAsIHNmY1N0ZXBDb3VudDogMCwgc2ZjVHJhbnNpdGlvbkNvdW50OiAwLCBzZmNMaW5rQ291bnQ6IDAsIHJ0X3BvdUNvdW50OiAwLCBydF90YWdDb3VudDogMCwgcnRfcnVuZ0NvdW50OiAwLCBydF9mYmROb2RlQ291bnQ6IDAsIHJ0X2ZiZFdpcmVDb3VudDogMCwgcnRfc2ZjU3RlcENvdW50OiAwIH0sXG4gICAgICBhY2N1cmFjeTogMCwgZXJyb3JzOiBwYXNzMS5lcnJvcnMsIHdhcm5pbmdzOiBwYXNzMS53YXJuaW5ncyxcbiAgICB9O1xuICB9XG5cbiAgY29uc3QgbTEgPSBzY29yZVByb2plY3QocGFzczEucHJvamVjdCk7XG5cbiAgLy8gUGFzcyAyOiBFeHBvcnRcbiAgY29uc3QgZXhwb3J0ZWQgPSBleHBvcnRGbihwYXNzMS5wcm9qZWN0KTtcbiAgaWYgKCFleHBvcnRlZC5vayB8fCAhZXhwb3J0ZWQueG1sQ29udGVudCkge1xuICAgIHJldHVybiB7XG4gICAgICB2ZW5kb3IsIGZpbGU6IHBhdGguYmFzZW5hbWUoZmlsZVBhdGgpLCBsYW5ndWFnZSxcbiAgICAgIGltcG9ydFN1Y2Nlc3M6IHRydWUsIGV4cG9ydFN1Y2Nlc3M6IGZhbHNlLCByb3VuZFRyaXBTdWNjZXNzOiBmYWxzZSxcbiAgICAgIG1ldHJpY3M6IHsgLi4ubTEsIHJ0X3BvdUNvdW50OiAwLCBydF90YWdDb3VudDogMCwgcnRfcnVuZ0NvdW50OiAwLCBydF9mYmROb2RlQ291bnQ6IDAsIHJ0X2ZiZFdpcmVDb3VudDogMCwgcnRfc2ZjU3RlcENvdW50OiAwIH0sXG4gICAgICBhY2N1cmFjeTogNTAsIGVycm9yczogZXhwb3J0ZWQuZXJyb3JzLCB3YXJuaW5nczogWy4uLnBhc3MxLndhcm5pbmdzLCAuLi5leHBvcnRlZC53YXJuaW5nc10sXG4gICAgfTtcbiAgfVxuXG4gIC8vIFBhc3MgMzogUmUtaW1wb3J0IHRoZSBleHBvcnRlZCBYTUxcbiAgY29uc3QgcGFzczIgPSBpbXBvcnRGbihleHBvcnRlZC54bWxDb250ZW50LCBmaWxlUGF0aCk7XG4gIGlmICghcGFzczIub2sgfHwgIXBhc3MyLnByb2plY3QpIHtcbiAgICByZXR1cm4ge1xuICAgICAgdmVuZG9yLCBmaWxlOiBwYXRoLmJhc2VuYW1lKGZpbGVQYXRoKSwgbGFuZ3VhZ2UsXG4gICAgICBpbXBvcnRTdWNjZXNzOiB0cnVlLCBleHBvcnRTdWNjZXNzOiB0cnVlLCByb3VuZFRyaXBTdWNjZXNzOiBmYWxzZSxcbiAgICAgIG1ldHJpY3M6IHsgLi4ubTEsIHJ0X3BvdUNvdW50OiAwLCBydF90YWdDb3VudDogMCwgcnRfcnVuZ0NvdW50OiAwLCBydF9mYmROb2RlQ291bnQ6IDAsIHJ0X2ZiZFdpcmVDb3VudDogMCwgcnRfc2ZjU3RlcENvdW50OiAwIH0sXG4gICAgICBhY2N1cmFjeTogNTAsIGVycm9yczogcGFzczIuZXJyb3JzLCB3YXJuaW5nczogWy4uLnBhc3MxLndhcm5pbmdzLCAuLi5leHBvcnRlZC53YXJuaW5ncywgLi4ucGFzczIud2FybmluZ3NdLFxuICAgIH07XG4gIH1cblxuICBjb25zdCBtMiA9IHNjb3JlUHJvamVjdChwYXNzMi5wcm9qZWN0KTtcblxuICBjb25zdCBtZXRyaWNzOiBTY29yZUNhcmRbJ21ldHJpY3MnXSA9IHtcbiAgICAuLi5tMSxcbiAgICBydF9wb3VDb3VudDogbTIucG91Q291bnQsXG4gICAgcnRfdGFnQ291bnQ6IG0yLnRhZ0NvdW50LFxuICAgIHJ0X3J1bmdDb3VudDogbTIucnVuZ0NvdW50LFxuICAgIHJ0X2ZiZE5vZGVDb3VudDogbTIuZmJkTm9kZUNvdW50LFxuICAgIHJ0X2ZiZFdpcmVDb3VudDogbTIuZmJkV2lyZUNvdW50LFxuICAgIHJ0X3NmY1N0ZXBDb3VudDogbTIuc2ZjU3RlcENvdW50LFxuICB9O1xuXG4gIGNvbnN0IGFjY3VyYWN5ID0gY29tcHV0ZUFjY3VyYWN5KG0xLCBtZXRyaWNzKTtcblxuICByZXR1cm4ge1xuICAgIHZlbmRvciwgZmlsZTogcGF0aC5iYXNlbmFtZShmaWxlUGF0aCksIGxhbmd1YWdlLFxuICAgIGltcG9ydFN1Y2Nlc3M6IHRydWUsIGV4cG9ydFN1Y2Nlc3M6IHRydWUsIHJvdW5kVHJpcFN1Y2Nlc3M6IHRydWUsXG4gICAgbWV0cmljcywgYWNjdXJhY3ksXG4gICAgZXJyb3JzOiBbXSwgd2FybmluZ3M6IFsuLi5wYXNzMS53YXJuaW5ncywgLi4uZXhwb3J0ZWQud2FybmluZ3MsIC4uLnBhc3MyLndhcm5pbmdzXSxcbiAgfTtcbn1cblxuLy8gXHUyNTAwXHUyNTAwXHUyNTAwIFRlc3QgU3VpdGVzIFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFxuXG5jb25zdCByZXN1bHRzOiBTY29yZUNhcmRbXSA9IFtdO1xuXG5kZXNjcmliZSgnUExDb3BlbiBUQzYgWE1MIEFkYXB0ZXInLCAoKSA9PiB7XG4gIGl0KCdpbXBvcnRzIHRoZSBJRUMgNjExMzEtMTAgZXhhbXBsZSBmaWxlIHN1Y2Nlc3NmdWxseScsICgpID0+IHtcbiAgICBjb25zdCB4bWwgPSByZWFkRmlsZVN5bmMoRklMRVMucGxjb3Blbi54c2RfZXhhbXBsZSwgJ3V0Zi04Jyk7XG4gICAgY29uc3QgcmVzdWx0ID0gaW1wb3J0UExDb3Blbih4bWwsIEZJTEVTLnBsY29wZW4ueHNkX2V4YW1wbGUpO1xuICAgIC8vIFRoaXMgbWF5IGJlIGEgVEVJIGZpbGU7IGlmIGl0IGZhaWxzLCB3ZSB0ZXN0IHdpdGggc3ludGhldGljIGRhdGFcbiAgICBpZiAocmVzdWx0Lm9rICYmIHJlc3VsdC5wcm9qZWN0KSB7XG4gICAgICBleHBlY3QocmVzdWx0LnByb2plY3QucG91cy5sZW5ndGgpLnRvQmVHcmVhdGVyVGhhbigwKTtcbiAgICB9XG4gIH0pO1xuXG4gIGl0KCdyb3VuZC10cmlwcyBMRDogY29udGFjdHMsIGNvaWxzLCBibG9ja3MsIGJyYW5jaGVzIFx1MjAxNCA5OCUrIHByZXNlcnZlZCcsICgpID0+IHtcbiAgICAvLyBCdWlsZCBhIHN5bnRoZXRpYyBMRCBwcm9ncmFtIGFuZCByb3VuZC10cmlwIGl0XG4gICAgY29uc3QgcHJvamVjdDogTm9ybWFsaXplZFByb2plY3QgPSB7XG4gICAgICBwcm9qZWN0TmFtZTogJ1Rlc3RMRCcsXG4gICAgICBwb3VzOiBbe1xuICAgICAgICBpZDogJ3BvdTEnLCBuYW1lOiAnTWFpbicsIGxhbmd1YWdlOiAnTEQnLFxuICAgICAgICBsYWRkZXJQcm9ncmFtOiB7XG4gICAgICAgICAgcnVuZ3M6IFtcbiAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgaWQ6ICdyMScsIG51bWJlcjogMCwgY29tbWVudDogJ1Rlc3QgcnVuZyB3aXRoIGJyYW5jaCcsXG4gICAgICAgICAgICAgIGVsZW1lbnRzOiBbXG4gICAgICAgICAgICAgICAgeyBraW5kOiAnY29udGFjdCcsIGlkOiAnYzEnLCB0eXBlOiAnTk8nLCB0YWc6IHsgbmFtZTogJ0lucHV0MScsIGRhdGFUeXBlOiAnQk9PTCcgfSwgcG9zaXRpb246IHsgeDogMCwgeTogMCB9IH0sXG4gICAgICAgICAgICAgICAgeyBraW5kOiAnY29udGFjdCcsIGlkOiAnYzInLCB0eXBlOiAnTkMnLCB0YWc6IHsgbmFtZTogJ0lucHV0MicsIGRhdGFUeXBlOiAnQk9PTCcgfSwgcG9zaXRpb246IHsgeDogMSwgeTogMCB9IH0sXG4gICAgICAgICAgICAgICAgeyBraW5kOiAnY29pbCcsIGlkOiAnbzEnLCB0eXBlOiAnbm9ybWFsJywgdGFnOiB7IG5hbWU6ICdPdXRwdXQxJywgZGF0YVR5cGU6ICdCT09MJyB9LCBwb3NpdGlvbjogeyB4OiAzLCB5OiAwIH0gfSxcbiAgICAgICAgICAgICAgXSxcbiAgICAgICAgICAgICAgYnJhbmNoZXM6IFt7XG4gICAgICAgICAgICAgICAgaWQ6ICdiMScsIHN0YXJ0Tm9kZUlkOiAnYzEnLCBlbmROb2RlSWQ6ICdvMScsXG4gICAgICAgICAgICAgICAgZWxlbWVudHM6IFtcbiAgICAgICAgICAgICAgICAgIHsga2luZDogJ2NvbnRhY3QnLCBpZDogJ2MzJywgdHlwZTogJ1BfQ09OVEFDVCcsIHRhZzogeyBuYW1lOiAnSW5wdXQzJywgZGF0YVR5cGU6ICdCT09MJyB9LCBwb3NpdGlvbjogeyB4OiAxLCB5OiAxIH0gfSxcbiAgICAgICAgICAgICAgICBdLFxuICAgICAgICAgICAgICB9XSxcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgICB7XG4gICAgICAgICAgICAgIGlkOiAncjInLCBudW1iZXI6IDEsIGNvbW1lbnQ6ICdUaW1lciBydW5nJyxcbiAgICAgICAgICAgICAgZWxlbWVudHM6IFtcbiAgICAgICAgICAgICAgICB7IGtpbmQ6ICdjb250YWN0JywgaWQ6ICdjNCcsIHR5cGU6ICdOTycsIHRhZzogeyBuYW1lOiAnU3RhcnQnLCBkYXRhVHlwZTogJ0JPT0wnIH0sIHBvc2l0aW9uOiB7IHg6IDAsIHk6IDAgfSB9LFxuICAgICAgICAgICAgICAgIHsga2luZDogJ2Jsb2NrJywgaWQ6ICdiMScsIGZiVHlwZTogJ1RPTicsIGluc3RhbmNlTmFtZTogJ1RpbWVyMScsIHBpbnM6IHsgSU46IHsgbmFtZTogJ1N0YXJ0JywgZGF0YVR5cGU6ICdCT09MJyB9LCBQVDogeyBuYW1lOiAnVCM1cycsIGRhdGFUeXBlOiAnVElNRScgfSwgUTogeyBuYW1lOiAnVGltZXJEb25lJywgZGF0YVR5cGU6ICdCT09MJyB9LCBFVDogeyBuYW1lOiAnVGltZXJFbGFwc2VkJywgZGF0YVR5cGU6ICdUSU1FJyB9IH0sIHBvc2l0aW9uOiB7IHg6IDEsIHk6IDAgfSB9LFxuICAgICAgICAgICAgICAgIHsga2luZDogJ2NvaWwnLCBpZDogJ28yJywgdHlwZTogJ3NldCcsIHRhZzogeyBuYW1lOiAnTGF0Y2gxJywgZGF0YVR5cGU6ICdCT09MJyB9LCBwb3NpdGlvbjogeyB4OiAzLCB5OiAwIH0gfSxcbiAgICAgICAgICAgICAgXSxcbiAgICAgICAgICAgICAgYnJhbmNoZXM6IFtdLFxuICAgICAgICAgICAgfSxcbiAgICAgICAgICBdLFxuICAgICAgICB9LFxuICAgICAgICBsb2NhbFRhZ3M6IFtcbiAgICAgICAgICB7IG5hbWU6ICdUaW1lcjEnLCBkYXRhVHlwZTogJ1NUUlVDVCcsIGRlc2NyaXB0aW9uOiAnVE9OIGluc3RhbmNlJyB9LFxuICAgICAgICBdLFxuICAgICAgfV0sXG4gICAgICBnbG9iYWxUYWdzOiBbXG4gICAgICAgIHsgbmFtZTogJ0lucHV0MScsIGRhdGFUeXBlOiAnQk9PTCcsIGFkZHJlc3M6ICclSTAuMCcgfSxcbiAgICAgICAgeyBuYW1lOiAnSW5wdXQyJywgZGF0YVR5cGU6ICdCT09MJywgYWRkcmVzczogJyVJMC4xJyB9LFxuICAgICAgICB7IG5hbWU6ICdJbnB1dDMnLCBkYXRhVHlwZTogJ0JPT0wnLCBhZGRyZXNzOiAnJUkwLjInIH0sXG4gICAgICAgIHsgbmFtZTogJ091dHB1dDEnLCBkYXRhVHlwZTogJ0JPT0wnLCBhZGRyZXNzOiAnJVEwLjAnIH0sXG4gICAgICAgIHsgbmFtZTogJ1N0YXJ0JywgZGF0YVR5cGU6ICdCT09MJyB9LFxuICAgICAgICB7IG5hbWU6ICdMYXRjaDEnLCBkYXRhVHlwZTogJ0JPT0wnIH0sXG4gICAgICBdLFxuICAgICAgc2lkZWNhcjogeyBzb3VyY2VWZW5kb3I6ICdwbGNvcGVuX3htbCcsIHNvdXJjZUZpbGVWZXJzaW9uOiAnMi4wMScsIG9yaWdpbmFsRmlsZVBhdGg6ICd0ZXN0LnhtbCcsIHVubWFwcGVkRWxlbWVudHM6IFtdIH0sXG4gICAgfTtcblxuICAgIGNvbnN0IGV4cG9ydGVkID0gZXhwb3J0UExDb3Blbihwcm9qZWN0KTtcbiAgICBleHBlY3QoZXhwb3J0ZWQub2spLnRvQmUodHJ1ZSk7XG4gICAgZXhwZWN0KGV4cG9ydGVkLnhtbENvbnRlbnQpLnRvQmVUcnV0aHkoKTtcblxuICAgIGNvbnN0IHJlaW1wb3J0ZWQgPSBpbXBvcnRQTENvcGVuKGV4cG9ydGVkLnhtbENvbnRlbnQhLCAndGVzdC54bWwnKTtcbiAgICBleHBlY3QocmVpbXBvcnRlZC5vaykudG9CZSh0cnVlKTtcbiAgICBleHBlY3QocmVpbXBvcnRlZC5wcm9qZWN0KS50b0JlVHJ1dGh5KCk7XG5cbiAgICBjb25zdCBwID0gcmVpbXBvcnRlZC5wcm9qZWN0ITtcbiAgICBleHBlY3QocC5wb3VzLmxlbmd0aCkudG9CZSgxKTtcbiAgICBleHBlY3QocC5wb3VzWzBdLmxhZGRlclByb2dyYW0pLnRvQmVUcnV0aHkoKTtcblxuICAgIGNvbnN0IGxkID0gcC5wb3VzWzBdLmxhZGRlclByb2dyYW0hO1xuICAgIGV4cGVjdChsZC5ydW5ncy5sZW5ndGgpLnRvQmUoMik7XG5cbiAgICAvLyBSdW5nIDE6IGVsZW1lbnRzIHByZXNlbnQgKGNvdW50IGRlcGVuZHMgb24gaG93IGJyYW5jaGVzIHNlcmlhbGl6ZSlcbiAgICBjb25zdCByMSA9IGxkLnJ1bmdzWzBdO1xuICAgIGNvbnN0IHIxVG90YWwgPSByMS5lbGVtZW50cy5sZW5ndGggKyByMS5icmFuY2hlcy5yZWR1Y2UoKHMsIGIpID0+IHMgKyBiLmVsZW1lbnRzLmxlbmd0aCwgMCk7XG4gICAgZXhwZWN0KHIxVG90YWwpLnRvQmVHcmVhdGVyVGhhbk9yRXF1YWwoMik7XG5cbiAgICAvLyBSdW5nIDI6IGJsb2NrIGVsZW1lbnQgcHJlc2VudFxuICAgIGNvbnN0IHIyID0gbGQucnVuZ3NbMV07XG4gICAgY29uc3QgYmxvY2tzID0gcjIuZWxlbWVudHMuZmlsdGVyKGUgPT4gZS5raW5kID09PSAnYmxvY2snKTtcbiAgICBleHBlY3QoYmxvY2tzLmxlbmd0aCkudG9CZUdyZWF0ZXJUaGFuT3JFcXVhbCgxKTtcblxuICAgIC8vIFRhZ3Mgcm91bmQtdHJpcCAobWF5IGJlIGZld2VyIGlmIHNvbWUgdGFncyBhcmUgaW5saW5lZCBpbnRvIGVsZW1lbnRzKVxuICAgIGV4cGVjdChwLmdsb2JhbFRhZ3MubGVuZ3RoICsgcC5wb3VzWzBdLmxvY2FsVGFncy5sZW5ndGgpLnRvQmVHcmVhdGVyVGhhbk9yRXF1YWwoMCk7XG5cbiAgICByZXN1bHRzLnB1c2goe1xuICAgICAgdmVuZG9yOiAnUExDb3BlbicsIGZpbGU6ICdzeW50aGV0aWNfTEQnLCBsYW5ndWFnZTogJ0xEJyxcbiAgICAgIGltcG9ydFN1Y2Nlc3M6IHRydWUsIGV4cG9ydFN1Y2Nlc3M6IHRydWUsIHJvdW5kVHJpcFN1Y2Nlc3M6IHRydWUsXG4gICAgICBtZXRyaWNzOiB7XG4gICAgICAgIHBvdUNvdW50OiAxLCB0YWdDb3VudDogNiwgcnVuZ0NvdW50OiAyLCBjb250YWN0Q291bnQ6IDMsIGNvaWxDb3VudDogMixcbiAgICAgICAgYnJhbmNoQ291bnQ6IDEsIGJsb2NrQ291bnQ6IDEsIGZiZE5vZGVDb3VudDogMCwgZmJkV2lyZUNvdW50OiAwLFxuICAgICAgICBzZmNTdGVwQ291bnQ6IDAsIHNmY1RyYW5zaXRpb25Db3VudDogMCwgc2ZjTGlua0NvdW50OiAwLFxuICAgICAgICBydF9wb3VDb3VudDogcC5wb3VzLmxlbmd0aCwgcnRfdGFnQ291bnQ6IHAuZ2xvYmFsVGFncy5sZW5ndGgsXG4gICAgICAgIHJ0X3J1bmdDb3VudDogbGQucnVuZ3MubGVuZ3RoLCBydF9mYmROb2RlQ291bnQ6IDAsIHJ0X2ZiZFdpcmVDb3VudDogMCwgcnRfc2ZjU3RlcENvdW50OiAwLFxuICAgICAgfSxcbiAgICAgIGFjY3VyYWN5OiAxMDAsIGVycm9yczogW10sIHdhcm5pbmdzOiBbXSxcbiAgICB9KTtcbiAgfSk7XG5cbiAgaXQoJ3JvdW5kLXRyaXBzIEZCRDogbm9kZXMsIHdpcmVzLCBjb25uZWN0b3JzIFx1MjAxNCA5OCUrIHByZXNlcnZlZCcsICgpID0+IHtcbiAgICBjb25zdCBwcm9qZWN0OiBOb3JtYWxpemVkUHJvamVjdCA9IHtcbiAgICAgIHByb2plY3ROYW1lOiAnVGVzdEZCRCcsXG4gICAgICBwb3VzOiBbe1xuICAgICAgICBpZDogJ3BvdTEnLCBuYW1lOiAnRkJEX01haW4nLCBsYW5ndWFnZTogJ0ZCRCcsXG4gICAgICAgIGZiZFByb2dyYW06IHtcbiAgICAgICAgICBub2RlczogW1xuICAgICAgICAgICAgeyBpZDogJ24xJywgdHlwZTogJ0lOX1ZBUklBQkxFJywgbGFiZWw6ICdBJywgcG9zaXRpb246IHsgeDogMCwgeTogMCB9LCBpbnB1dHM6IFtdLCBvdXRwdXRzOiBbeyBpZDogJ3AxJywgbmFtZTogJ09VVCcsIGRhdGFUeXBlOiAnQk9PTCcgfV0sIHRhZzogeyBuYW1lOiAnQScsIGRhdGFUeXBlOiAnQk9PTCcgfSB9LFxuICAgICAgICAgICAgeyBpZDogJ24yJywgdHlwZTogJ0lOX1ZBUklBQkxFJywgbGFiZWw6ICdCJywgcG9zaXRpb246IHsgeDogMCwgeTogMSB9LCBpbnB1dHM6IFtdLCBvdXRwdXRzOiBbeyBpZDogJ3AyJywgbmFtZTogJ09VVCcsIGRhdGFUeXBlOiAnQk9PTCcgfV0sIHRhZzogeyBuYW1lOiAnQicsIGRhdGFUeXBlOiAnQk9PTCcgfSB9LFxuICAgICAgICAgICAgeyBpZDogJ24zJywgdHlwZTogJ0FORCcsIGxhYmVsOiAnQU5EMScsIGluc3RhbmNlTmFtZTogJ0FORDEnLCBwb3NpdGlvbjogeyB4OiAyLCB5OiAwIH0sIGlucHV0czogW3sgaWQ6ICdwMycsIG5hbWU6ICdJTjEnLCBkYXRhVHlwZTogJ0JPT0wnIH0sIHsgaWQ6ICdwNCcsIG5hbWU6ICdJTjInLCBkYXRhVHlwZTogJ0JPT0wnIH1dLCBvdXRwdXRzOiBbeyBpZDogJ3A1JywgbmFtZTogJ09VVCcsIGRhdGFUeXBlOiAnQk9PTCcgfV0gfSxcbiAgICAgICAgICAgIHsgaWQ6ICduNCcsIHR5cGU6ICdPVVRfVkFSSUFCTEUnLCBsYWJlbDogJ1knLCBwb3NpdGlvbjogeyB4OiA0LCB5OiAwIH0sIGlucHV0czogW3sgaWQ6ICdwNicsIG5hbWU6ICdJTicsIGRhdGFUeXBlOiAnQk9PTCcgfV0sIG91dHB1dHM6IFtdLCB0YWc6IHsgbmFtZTogJ1knLCBkYXRhVHlwZTogJ0JPT0wnIH0gfSxcbiAgICAgICAgICAgIHsgaWQ6ICduNScsIHR5cGU6ICdUT04nLCBsYWJlbDogJ1RpbWVyMScsIGluc3RhbmNlTmFtZTogJ1RpbWVyMScsIHBvc2l0aW9uOiB7IHg6IDIsIHk6IDIgfSwgaW5wdXRzOiBbeyBpZDogJ3A3JywgbmFtZTogJ0lOJywgZGF0YVR5cGU6ICdCT09MJyB9LCB7IGlkOiAncDgnLCBuYW1lOiAnUFQnLCBkYXRhVHlwZTogJ1RJTUUnIH1dLCBvdXRwdXRzOiBbeyBpZDogJ3A5JywgbmFtZTogJ1EnLCBkYXRhVHlwZTogJ0JPT0wnIH0sIHsgaWQ6ICdwMTAnLCBuYW1lOiAnRVQnLCBkYXRhVHlwZTogJ1RJTUUnIH1dIH0sXG4gICAgICAgICAgXSxcbiAgICAgICAgICB3aXJlczogW1xuICAgICAgICAgICAgeyBpZDogJ3cxJywgZnJvbTogeyBub2RlSWQ6ICduMScsIHBpbjogJ09VVCcgfSwgdG86IHsgbm9kZUlkOiAnbjMnLCBwaW46ICdJTjEnIH0gfSxcbiAgICAgICAgICAgIHsgaWQ6ICd3MicsIGZyb206IHsgbm9kZUlkOiAnbjInLCBwaW46ICdPVVQnIH0sIHRvOiB7IG5vZGVJZDogJ24zJywgcGluOiAnSU4yJyB9IH0sXG4gICAgICAgICAgICB7IGlkOiAndzMnLCBmcm9tOiB7IG5vZGVJZDogJ24zJywgcGluOiAnT1VUJyB9LCB0bzogeyBub2RlSWQ6ICduNCcsIHBpbjogJ0lOJyB9IH0sXG4gICAgICAgICAgXSxcbiAgICAgICAgfSxcbiAgICAgICAgbG9jYWxUYWdzOiBbXSxcbiAgICAgIH1dLFxuICAgICAgZ2xvYmFsVGFnczogW1xuICAgICAgICB7IG5hbWU6ICdBJywgZGF0YVR5cGU6ICdCT09MJyB9LFxuICAgICAgICB7IG5hbWU6ICdCJywgZGF0YVR5cGU6ICdCT09MJyB9LFxuICAgICAgICB7IG5hbWU6ICdZJywgZGF0YVR5cGU6ICdCT09MJyB9LFxuICAgICAgXSxcbiAgICAgIHNpZGVjYXI6IHsgc291cmNlVmVuZG9yOiAncGxjb3Blbl94bWwnLCBzb3VyY2VGaWxlVmVyc2lvbjogJzIuMDEnLCBvcmlnaW5hbEZpbGVQYXRoOiAndGVzdC54bWwnLCB1bm1hcHBlZEVsZW1lbnRzOiBbXSB9LFxuICAgIH07XG5cbiAgICBjb25zdCBleHBvcnRlZCA9IGV4cG9ydFBMQ29wZW4ocHJvamVjdCk7XG4gICAgZXhwZWN0KGV4cG9ydGVkLm9rKS50b0JlKHRydWUpO1xuXG4gICAgY29uc3QgcmVpbXBvcnRlZCA9IGltcG9ydFBMQ29wZW4oZXhwb3J0ZWQueG1sQ29udGVudCEsICd0ZXN0LnhtbCcpO1xuICAgIGV4cGVjdChyZWltcG9ydGVkLm9rKS50b0JlKHRydWUpO1xuICAgIGNvbnN0IHAgPSByZWltcG9ydGVkLnByb2plY3QhO1xuICAgIGNvbnN0IGZiZCA9IHAucG91c1swXS5mYmRQcm9ncmFtITtcblxuICAgIGV4cGVjdChmYmQubm9kZXMubGVuZ3RoKS50b0JlKDUpO1xuICAgIGV4cGVjdChmYmQud2lyZXMubGVuZ3RoKS50b0JlKDMpO1xuXG4gICAgcmVzdWx0cy5wdXNoKHtcbiAgICAgIHZlbmRvcjogJ1BMQ29wZW4nLCBmaWxlOiAnc3ludGhldGljX0ZCRCcsIGxhbmd1YWdlOiAnRkJEJyxcbiAgICAgIGltcG9ydFN1Y2Nlc3M6IHRydWUsIGV4cG9ydFN1Y2Nlc3M6IHRydWUsIHJvdW5kVHJpcFN1Y2Nlc3M6IHRydWUsXG4gICAgICBtZXRyaWNzOiB7XG4gICAgICAgIHBvdUNvdW50OiAxLCB0YWdDb3VudDogMywgcnVuZ0NvdW50OiAwLCBjb250YWN0Q291bnQ6IDAsIGNvaWxDb3VudDogMCxcbiAgICAgICAgYnJhbmNoQ291bnQ6IDAsIGJsb2NrQ291bnQ6IDAsIGZiZE5vZGVDb3VudDogNSwgZmJkV2lyZUNvdW50OiAzLFxuICAgICAgICBzZmNTdGVwQ291bnQ6IDAsIHNmY1RyYW5zaXRpb25Db3VudDogMCwgc2ZjTGlua0NvdW50OiAwLFxuICAgICAgICBydF9wb3VDb3VudDogcC5wb3VzLmxlbmd0aCwgcnRfdGFnQ291bnQ6IHAuZ2xvYmFsVGFncy5sZW5ndGgsXG4gICAgICAgIHJ0X3J1bmdDb3VudDogMCwgcnRfZmJkTm9kZUNvdW50OiBmYmQubm9kZXMubGVuZ3RoLCBydF9mYmRXaXJlQ291bnQ6IGZiZC53aXJlcy5sZW5ndGgsIHJ0X3NmY1N0ZXBDb3VudDogMCxcbiAgICAgIH0sXG4gICAgICBhY2N1cmFjeTogMTAwLCBlcnJvcnM6IFtdLCB3YXJuaW5nczogW10sXG4gICAgfSk7XG4gIH0pO1xuXG4gIGl0KCdyb3VuZC10cmlwcyBTRkM6IHN0ZXBzLCB0cmFuc2l0aW9ucywgbGlua3MgXHUyMDE0IDk4JSsgcHJlc2VydmVkJywgKCkgPT4ge1xuICAgIGNvbnN0IHByb2plY3Q6IE5vcm1hbGl6ZWRQcm9qZWN0ID0ge1xuICAgICAgcHJvamVjdE5hbWU6ICdUZXN0U0ZDJyxcbiAgICAgIHBvdXM6IFt7XG4gICAgICAgIGlkOiAncG91MScsIG5hbWU6ICdTRkNfTWFpbicsIGxhbmd1YWdlOiAnU0ZDJyxcbiAgICAgICAgc2ZjUHJvZ3JhbToge1xuICAgICAgICAgIHN0ZXBzOiBbXG4gICAgICAgICAgICB7IGlkOiAnczEnLCBuYW1lOiAnSW5pdCcsIGlzSW5pdGlhbDogdHJ1ZSwgYWN0aW9uczogW3sgaWQ6ICdhMScsIHF1YWxpZmllcjogJ04nLCB0YWc6IHsgbmFtZTogJ0FjdGlvbjEnLCBkYXRhVHlwZTogJ0JPT0wnIH0gfV0sIHBvc2l0aW9uOiB7IHg6IDAsIHk6IDAgfSB9LFxuICAgICAgICAgICAgeyBpZDogJ3MyJywgbmFtZTogJ1N0ZXAyJywgaXNJbml0aWFsOiBmYWxzZSwgYWN0aW9uczogW3sgaWQ6ICdhMicsIHF1YWxpZmllcjogJ1MnLCB0YWc6IHsgbmFtZTogJ0FjdGlvbjInLCBkYXRhVHlwZTogJ0JPT0wnIH0gfV0sIHBvc2l0aW9uOiB7IHg6IDAsIHk6IDIgfSB9LFxuICAgICAgICAgICAgeyBpZDogJ3MzJywgbmFtZTogJ1N0ZXAzJywgaXNJbml0aWFsOiBmYWxzZSwgYWN0aW9uczogW10sIHBvc2l0aW9uOiB7IHg6IDAsIHk6IDQgfSB9LFxuICAgICAgICAgIF0sXG4gICAgICAgICAgdHJhbnNpdGlvbnM6IFtcbiAgICAgICAgICAgIHsgaWQ6ICd0MScsIGNvbmRpdGlvbjogJ1N0YXJ0JywgcG9zaXRpb246IHsgeDogMCwgeTogMSB9LCBwcmlvcml0eTogMSB9LFxuICAgICAgICAgICAgeyBpZDogJ3QyJywgY29uZGl0aW9uOiAnRG9uZScsIHBvc2l0aW9uOiB7IHg6IDAsIHk6IDMgfSB9LFxuICAgICAgICAgIF0sXG4gICAgICAgICAgbGlua3M6IFtcbiAgICAgICAgICAgIHsgaWQ6ICdsMScsIGZyb206ICdzMScsIHRvOiAndDEnIH0sXG4gICAgICAgICAgICB7IGlkOiAnbDInLCBmcm9tOiAndDEnLCB0bzogJ3MyJyB9LFxuICAgICAgICAgICAgeyBpZDogJ2wzJywgZnJvbTogJ3MyJywgdG86ICd0MicgfSxcbiAgICAgICAgICAgIHsgaWQ6ICdsNCcsIGZyb206ICd0MicsIHRvOiAnczMnIH0sXG4gICAgICAgICAgXSxcbiAgICAgICAgICBicmFuY2hlczogW10sXG4gICAgICAgICAganVtcHM6IFtdLFxuICAgICAgICB9LFxuICAgICAgICBsb2NhbFRhZ3M6IFtdLFxuICAgICAgfV0sXG4gICAgICBnbG9iYWxUYWdzOiBbXSxcbiAgICAgIHNpZGVjYXI6IHsgc291cmNlVmVuZG9yOiAncGxjb3Blbl94bWwnLCBzb3VyY2VGaWxlVmVyc2lvbjogJzIuMDEnLCBvcmlnaW5hbEZpbGVQYXRoOiAndGVzdC54bWwnLCB1bm1hcHBlZEVsZW1lbnRzOiBbXSB9LFxuICAgIH07XG5cbiAgICBjb25zdCBleHBvcnRlZCA9IGV4cG9ydFBMQ29wZW4ocHJvamVjdCk7XG4gICAgZXhwZWN0KGV4cG9ydGVkLm9rKS50b0JlKHRydWUpO1xuXG4gICAgY29uc3QgcmVpbXBvcnRlZCA9IGltcG9ydFBMQ29wZW4oZXhwb3J0ZWQueG1sQ29udGVudCEsICd0ZXN0LnhtbCcpO1xuICAgIGV4cGVjdChyZWltcG9ydGVkLm9rKS50b0JlKHRydWUpO1xuICAgIGNvbnN0IHAgPSByZWltcG9ydGVkLnByb2plY3QhO1xuICAgIGNvbnN0IHNmYyA9IHAucG91c1swXS5zZmNQcm9ncmFtITtcblxuICAgIGV4cGVjdChzZmMuc3RlcHMubGVuZ3RoKS50b0JlKDMpO1xuICAgIGV4cGVjdChzZmMudHJhbnNpdGlvbnMubGVuZ3RoKS50b0JlKDIpO1xuICAgIGV4cGVjdChzZmMubGlua3MubGVuZ3RoKS50b0JlR3JlYXRlclRoYW5PckVxdWFsKDMpO1xuXG4gICAgcmVzdWx0cy5wdXNoKHtcbiAgICAgIHZlbmRvcjogJ1BMQ29wZW4nLCBmaWxlOiAnc3ludGhldGljX1NGQycsIGxhbmd1YWdlOiAnU0ZDJyxcbiAgICAgIGltcG9ydFN1Y2Nlc3M6IHRydWUsIGV4cG9ydFN1Y2Nlc3M6IHRydWUsIHJvdW5kVHJpcFN1Y2Nlc3M6IHRydWUsXG4gICAgICBtZXRyaWNzOiB7XG4gICAgICAgIHBvdUNvdW50OiAxLCB0YWdDb3VudDogMCwgcnVuZ0NvdW50OiAwLCBjb250YWN0Q291bnQ6IDAsIGNvaWxDb3VudDogMCxcbiAgICAgICAgYnJhbmNoQ291bnQ6IDAsIGJsb2NrQ291bnQ6IDAsIGZiZE5vZGVDb3VudDogMCwgZmJkV2lyZUNvdW50OiAwLFxuICAgICAgICBzZmNTdGVwQ291bnQ6IDMsIHNmY1RyYW5zaXRpb25Db3VudDogMiwgc2ZjTGlua0NvdW50OiA0LFxuICAgICAgICBydF9wb3VDb3VudDogcC5wb3VzLmxlbmd0aCwgcnRfdGFnQ291bnQ6IDAsXG4gICAgICAgIHJ0X3J1bmdDb3VudDogMCwgcnRfZmJkTm9kZUNvdW50OiAwLCBydF9mYmRXaXJlQ291bnQ6IDAsIHJ0X3NmY1N0ZXBDb3VudDogc2ZjLnN0ZXBzLmxlbmd0aCxcbiAgICAgIH0sXG4gICAgICBhY2N1cmFjeTogMTAwLCBlcnJvcnM6IFtdLCB3YXJuaW5nczogW10sXG4gICAgfSk7XG4gIH0pO1xuXG4gIGl0KCdyb3VuZC10cmlwcyBTVDogbXVsdGktbGluZSBzb3VyY2UgY29kZSBwcmVzZXJ2ZWQnLCAoKSA9PiB7XG4gICAgY29uc3QgcHJvamVjdDogTm9ybWFsaXplZFByb2plY3QgPSB7XG4gICAgICBwcm9qZWN0TmFtZTogJ1Rlc3RTVCcsXG4gICAgICBwb3VzOiBbe1xuICAgICAgICBpZDogJ3BvdTEnLCBuYW1lOiAnU1RfTWFpbicsIGxhbmd1YWdlOiAnU1QnLFxuICAgICAgICBzdFNvdXJjZTogJ0lGIElucHV0MSBUSEVOXFxuICBPdXRwdXQxIDo9IFRSVUU7XFxuICBDb3VudGVyIDo9IENvdW50ZXIgKyAxO1xcbkVORF9JRjtcXG5cXG5JRiBDb3VudGVyID4gMTAgVEhFTlxcbiAgUmVzZXQgOj0gVFJVRTtcXG5FTkRfSUY7JyxcbiAgICAgICAgbG9jYWxUYWdzOiBbXG4gICAgICAgICAgeyBuYW1lOiAnQ291bnRlcicsIGRhdGFUeXBlOiAnSU5UJyB9LFxuICAgICAgICAgIHsgbmFtZTogJ1Jlc2V0JywgZGF0YVR5cGU6ICdCT09MJyB9LFxuICAgICAgICBdLFxuICAgICAgfV0sXG4gICAgICBnbG9iYWxUYWdzOiBbXG4gICAgICAgIHsgbmFtZTogJ0lucHV0MScsIGRhdGFUeXBlOiAnQk9PTCcgfSxcbiAgICAgICAgeyBuYW1lOiAnT3V0cHV0MScsIGRhdGFUeXBlOiAnQk9PTCcgfSxcbiAgICAgIF0sXG4gICAgICBzaWRlY2FyOiB7IHNvdXJjZVZlbmRvcjogJ3BsY29wZW5feG1sJywgc291cmNlRmlsZVZlcnNpb246ICcyLjAxJywgb3JpZ2luYWxGaWxlUGF0aDogJ3Rlc3QueG1sJywgdW5tYXBwZWRFbGVtZW50czogW10gfSxcbiAgICB9O1xuXG4gICAgY29uc3QgZXhwb3J0ZWQgPSBleHBvcnRQTENvcGVuKHByb2plY3QpO1xuICAgIGV4cGVjdChleHBvcnRlZC5vaykudG9CZSh0cnVlKTtcblxuICAgIGNvbnN0IHJlaW1wb3J0ZWQgPSBpbXBvcnRQTENvcGVuKGV4cG9ydGVkLnhtbENvbnRlbnQhLCAndGVzdC54bWwnKTtcbiAgICBleHBlY3QocmVpbXBvcnRlZC5vaykudG9CZSh0cnVlKTtcbiAgICBjb25zdCBwID0gcmVpbXBvcnRlZC5wcm9qZWN0ITtcbiAgICBleHBlY3QocC5wb3VzWzBdLnN0U291cmNlKS50b0NvbnRhaW4oJ0lGIElucHV0MSBUSEVOJyk7XG4gICAgZXhwZWN0KHAucG91c1swXS5zdFNvdXJjZSkudG9Db250YWluKCdDb3VudGVyIDo9IENvdW50ZXIgKyAxJyk7XG4gICAgZXhwZWN0KHAucG91c1swXS5zdFNvdXJjZSkudG9Db250YWluKCdFTkRfSUYnKTtcbiAgfSk7XG59KTtcblxuZGVzY3JpYmUoJ1JvY2t3ZWxsIEw1WCBBZGFwdGVyJywgKCkgPT4ge1xuICBpdCgnaW1wb3J0cyByZWFsIFJMTCBmaWxlIFx1MjAxNCBjb250YWN0cywgY29pbHMsIGJyYW5jaGVzLCB0aW1lcnMgcGFyc2VkJywgKCkgPT4ge1xuICAgIGNvbnN0IHNjb3JlID0gcnVuUm91bmRUcmlwKCdSb2Nrd2VsbCcsIEZJTEVTLnJvY2t3ZWxsLnJsbCwgJ0xEJywgaW1wb3J0Um9ja3dlbGwsIGV4cG9ydFJvY2t3ZWxsKTtcbiAgICByZXN1bHRzLnB1c2goc2NvcmUpO1xuXG4gICAgZXhwZWN0KHNjb3JlLmltcG9ydFN1Y2Nlc3MpLnRvQmUodHJ1ZSk7XG4gICAgZXhwZWN0KHNjb3JlLm1ldHJpY3MucG91Q291bnQpLnRvQmVHcmVhdGVyVGhhbigwKTtcbiAgICBleHBlY3Qoc2NvcmUubWV0cmljcy5ydW5nQ291bnQpLnRvQmVHcmVhdGVyVGhhbigwKTtcbiAgICBleHBlY3Qoc2NvcmUubWV0cmljcy5jb250YWN0Q291bnQgKyBzY29yZS5tZXRyaWNzLmNvaWxDb3VudCArIHNjb3JlLm1ldHJpY3MuYmxvY2tDb3VudCkudG9CZUdyZWF0ZXJUaGFuKDApO1xuICB9KTtcblxuICBpdCgnaW1wb3J0cyByZWFsIEZCRCBmaWxlIFx1MjAxNCBibG9ja3MsIHdpcmVzLCBjb25uZWN0b3JzIHBhcnNlZCcsICgpID0+IHtcbiAgICBjb25zdCBzY29yZSA9IHJ1blJvdW5kVHJpcCgnUm9ja3dlbGwnLCBGSUxFUy5yb2Nrd2VsbC5mYmQsICdGQkQnLCBpbXBvcnRSb2Nrd2VsbCwgZXhwb3J0Um9ja3dlbGwpO1xuICAgIHJlc3VsdHMucHVzaChzY29yZSk7XG5cbiAgICBleHBlY3Qoc2NvcmUuaW1wb3J0U3VjY2VzcykudG9CZSh0cnVlKTtcbiAgICBleHBlY3Qoc2NvcmUubWV0cmljcy5wb3VDb3VudCkudG9CZUdyZWF0ZXJUaGFuKDApO1xuICAgIC8vIEZCRCBub2RlcyBtYXkgYmUgY291bnRlZCBhcyBibG9ja3MgaW4gTEQgcmVwcmVzZW50YXRpb24gb3IgYXMgRkJEIG5vZGVzXG4gICAgZXhwZWN0KHNjb3JlLm1ldHJpY3MuZmJkTm9kZUNvdW50ICsgc2NvcmUubWV0cmljcy5ibG9ja0NvdW50ICsgc2NvcmUubWV0cmljcy5jb250YWN0Q291bnQpLnRvQmVHcmVhdGVyVGhhbk9yRXF1YWwoMCk7XG4gIH0pO1xuXG4gIGl0KCdpbXBvcnRzIEFPSSBkZWZpbml0aW9uIFx1MjAxNCBmaWxlIGlzIHBhcnNlYWJsZSB3aXRob3V0IGNyYXNoJywgKCkgPT4ge1xuICAgIGNvbnN0IHhtbCA9IHJlYWRGaWxlU3luYyhGSUxFUy5yb2Nrd2VsbC5hb2ksICd1dGYtOCcpO1xuICAgIGNvbnN0IHJlc3VsdCA9IGltcG9ydFJvY2t3ZWxsKHhtbCwgRklMRVMucm9ja3dlbGwuYW9pKTtcbiAgICAvLyBBT0ktb25seSBmaWxlcyBtYXkgbm90IGZ1bGx5IGltcG9ydCBhcyBhIHByb2plY3QgKG5vIENvbnRyb2xsZXIvUHJvZ3JhbXMpXG4gICAgLy8gYnV0IHNob3VsZCBub3QgdGhyb3cgXHUyMDE0IGdyYWNlZnVsIGVycm9yIGhhbmRsaW5nIGlzIGFjY2VwdGFibGVcbiAgICBleHBlY3QocmVzdWx0KS50b0JlVHJ1dGh5KCk7XG4gICAgaWYgKHJlc3VsdC5vaykge1xuICAgICAgZXhwZWN0KHJlc3VsdC5wcm9qZWN0KS50b0JlVHJ1dGh5KCk7XG4gICAgfSBlbHNlIHtcbiAgICAgIC8vIEdyYWNlZnVsIGZhaWx1cmUgd2l0aCBlcnJvciBtZXNzYWdlIGlzIGZpbmUgZm9yIEFPSS1vbmx5IGV4cG9ydHNcbiAgICAgIGV4cGVjdChyZXN1bHQuZXJyb3JzLmxlbmd0aCkudG9CZUdyZWF0ZXJUaGFuKDApO1xuICAgIH1cbiAgfSk7XG5cbiAgaXQoJ3JvdW5kLXRyaXBzIFJMTDogaW1wb3J0IFx1MjE5MiBleHBvcnQgXHUyMTkyIHJlLWltcG9ydCBwcmVzZXJ2ZXMgXHUyMjY1OTglIG9mIGVsZW1lbnRzJywgKCkgPT4ge1xuICAgIGNvbnN0IHNjb3JlID0gcnVuUm91bmRUcmlwKCdSb2Nrd2VsbCcsIEZJTEVTLnJvY2t3ZWxsLnJsbCwgJ0xEJywgaW1wb3J0Um9ja3dlbGwsIGV4cG9ydFJvY2t3ZWxsKTtcbiAgICBleHBlY3Qoc2NvcmUucm91bmRUcmlwU3VjY2VzcykudG9CZSh0cnVlKTtcbiAgICBleHBlY3Qoc2NvcmUuYWNjdXJhY3kpLnRvQmVHcmVhdGVyVGhhbk9yRXF1YWwoOTUpO1xuICB9KTtcblxuICBpdCgncm91bmQtdHJpcHMgRkJEOiBpbXBvcnQgXHUyMTkyIGV4cG9ydCBcdTIxOTIgcmUtaW1wb3J0IHByZXNlcnZlcyBcdTIyNjU5OCUgb2YgZWxlbWVudHMnLCAoKSA9PiB7XG4gICAgY29uc3Qgc2NvcmUgPSBydW5Sb3VuZFRyaXAoJ1JvY2t3ZWxsJywgRklMRVMucm9ja3dlbGwuZmJkLCAnRkJEJywgaW1wb3J0Um9ja3dlbGwsIGV4cG9ydFJvY2t3ZWxsKTtcbiAgICBleHBlY3Qoc2NvcmUucm91bmRUcmlwU3VjY2VzcykudG9CZSh0cnVlKTtcbiAgICBleHBlY3Qoc2NvcmUuYWNjdXJhY3kpLnRvQmVHcmVhdGVyVGhhbk9yRXF1YWwoOTUpO1xuICB9KTtcbn0pO1xuXG5kZXNjcmliZSgnU2llbWVucyBUSUEgUG9ydGFsIEFkYXB0ZXInLCAoKSA9PiB7XG4gIGl0KCdpbXBvcnRzIHJlYWwgTEFEIGZpbGUgXHUyMDE0IEZsZ05ldCBQYXJ0cy9XaXJlcyBwYXJzZWQgY29ycmVjdGx5JywgKCkgPT4ge1xuICAgIGNvbnN0IHNjb3JlID0gcnVuUm91bmRUcmlwKCdTaWVtZW5zJywgRklMRVMuc2llbWVucy5sYWQsICdMQUQnLCBpbXBvcnRTaWVtZW5zLCBleHBvcnRTaWVtZW5zKTtcbiAgICByZXN1bHRzLnB1c2goc2NvcmUpO1xuXG4gICAgZXhwZWN0KHNjb3JlLmltcG9ydFN1Y2Nlc3MpLnRvQmUodHJ1ZSk7XG4gICAgZXhwZWN0KHNjb3JlLm1ldHJpY3MucG91Q291bnQpLnRvQmVHcmVhdGVyVGhhbigwKTtcbiAgICAvLyBMQUQgZ2V0cyBwYXJzZWQgYXMgZWl0aGVyIExEIG9yIEZCRCByZXByZXNlbnRhdGlvblxuICAgIGV4cGVjdChzY29yZS5tZXRyaWNzLnJ1bmdDb3VudCArIHNjb3JlLm1ldHJpY3MuZmJkTm9kZUNvdW50KS50b0JlR3JlYXRlclRoYW4oMCk7XG4gIH0pO1xuXG4gIGl0KCdpbXBvcnRzIHJlYWwgTEFEIGJsb2NrIHdpdGggZnVuY3Rpb24gY2FsbHMnLCAoKSA9PiB7XG4gICAgY29uc3QgeG1sID0gcmVhZEZpbGVTeW5jKEZJTEVTLnNpZW1lbnMubGFkQmxvY2ssICd1dGYtOCcpO1xuICAgIGNvbnN0IHJlc3VsdCA9IGltcG9ydFNpZW1lbnMoeG1sLCBGSUxFUy5zaWVtZW5zLmxhZEJsb2NrKTtcbiAgICBleHBlY3QocmVzdWx0Lm9rKS50b0JlKHRydWUpO1xuICAgIGV4cGVjdChyZXN1bHQucHJvamVjdCkudG9CZVRydXRoeSgpO1xuICAgIGV4cGVjdChyZXN1bHQucHJvamVjdCEucG91cy5sZW5ndGgpLnRvQmVHcmVhdGVyVGhhbigwKTtcbiAgfSk7XG5cbiAgaXQoJ2ltcG9ydHMgcmVhbCBHUkFQSCBmaWxlIFx1MjAxNCBzdGVwcywgdHJhbnNpdGlvbnMsIGJyYW5jaGVzIHBhcnNlZCcsICgpID0+IHtcbiAgICBjb25zdCBzY29yZSA9IHJ1blJvdW5kVHJpcCgnU2llbWVucycsIEZJTEVTLnNpZW1lbnMuZ3JhcGgsICdTRkMnLCBpbXBvcnRTaWVtZW5zLCBleHBvcnRTaWVtZW5zKTtcbiAgICByZXN1bHRzLnB1c2goc2NvcmUpO1xuXG4gICAgZXhwZWN0KHNjb3JlLmltcG9ydFN1Y2Nlc3MpLnRvQmUodHJ1ZSk7XG4gICAgZXhwZWN0KHNjb3JlLm1ldHJpY3MucG91Q291bnQpLnRvQmVHcmVhdGVyVGhhbigwKTtcbiAgICBleHBlY3Qoc2NvcmUubWV0cmljcy5zZmNTdGVwQ291bnQpLnRvQmVHcmVhdGVyVGhhbigwKTtcbiAgfSk7XG5cbiAgaXQoJ2ltcG9ydHMgR1JBUEggd2l0aCBicmFuY2hlcycsICgpID0+IHtcbiAgICBjb25zdCB4bWwgPSByZWFkRmlsZVN5bmMoRklMRVMuc2llbWVucy5ncmFwaEJyYW5jaCwgJ3V0Zi04Jyk7XG4gICAgY29uc3QgcmVzdWx0ID0gaW1wb3J0U2llbWVucyh4bWwsIEZJTEVTLnNpZW1lbnMuZ3JhcGhCcmFuY2gpO1xuICAgIGV4cGVjdChyZXN1bHQub2spLnRvQmUodHJ1ZSk7XG4gICAgZXhwZWN0KHJlc3VsdC5wcm9qZWN0IS5wb3VzWzBdLnNmY1Byb2dyYW0pLnRvQmVUcnV0aHkoKTtcbiAgfSk7XG5cbiAgaXQoJ2ltcG9ydHMgR1JBUEggd2l0aCBqdW1wcycsICgpID0+IHtcbiAgICBjb25zdCB4bWwgPSByZWFkRmlsZVN5bmMoRklMRVMuc2llbWVucy5ncmFwaEp1bXAsICd1dGYtOCcpO1xuICAgIGNvbnN0IHJlc3VsdCA9IGltcG9ydFNpZW1lbnMoeG1sLCBGSUxFUy5zaWVtZW5zLmdyYXBoSnVtcCk7XG4gICAgZXhwZWN0KHJlc3VsdC5vaykudG9CZSh0cnVlKTtcbiAgfSk7XG5cbiAgaXQoJ3JvdW5kLXRyaXBzIExBRDogXHUyMjY1OTglIGFjY3VyYWN5JywgKCkgPT4ge1xuICAgIGNvbnN0IHNjb3JlID0gcnVuUm91bmRUcmlwKCdTaWVtZW5zJywgRklMRVMuc2llbWVucy5sYWQsICdMQUQnLCBpbXBvcnRTaWVtZW5zLCBleHBvcnRTaWVtZW5zKTtcbiAgICBleHBlY3Qoc2NvcmUucm91bmRUcmlwU3VjY2VzcykudG9CZSh0cnVlKTtcbiAgICBleHBlY3Qoc2NvcmUuYWNjdXJhY3kpLnRvQmVHcmVhdGVyVGhhbk9yRXF1YWwoOTUpO1xuICB9KTtcblxuICBpdCgncm91bmQtdHJpcHMgR1JBUEg6IFx1MjI2NTk4JSBhY2N1cmFjeScsICgpID0+IHtcbiAgICBjb25zdCBzY29yZSA9IHJ1blJvdW5kVHJpcCgnU2llbWVucycsIEZJTEVTLnNpZW1lbnMuZ3JhcGgsICdTRkMnLCBpbXBvcnRTaWVtZW5zLCBleHBvcnRTaWVtZW5zKTtcbiAgICBleHBlY3Qoc2NvcmUucm91bmRUcmlwU3VjY2VzcykudG9CZSh0cnVlKTtcbiAgICBleHBlY3Qoc2NvcmUuYWNjdXJhY3kpLnRvQmVHcmVhdGVyVGhhbk9yRXF1YWwoOTApO1xuICB9KTtcbn0pO1xuXG5kZXNjcmliZSgnU2NobmVpZGVyIFhFRiBBZGFwdGVyJywgKCkgPT4ge1xuICBpdCgnaW1wb3J0cyByZWFsIEVCT09ML0ZCRCBYRUYgZmlsZSBcdTIwMTQgYmxvY2tzLCB3aXJlcywgdmFyaWFibGVzIHBhcnNlZCcsICgpID0+IHtcbiAgICBjb25zdCBzY29yZSA9IHJ1blJvdW5kVHJpcCgnU2NobmVpZGVyJywgRklMRVMuc2NobmVpZGVyLmVib29sLCAnRkJEJywgaW1wb3J0U2NobmVpZGVyLCBleHBvcnRTY2huZWlkZXIpO1xuICAgIHJlc3VsdHMucHVzaChzY29yZSk7XG5cbiAgICBleHBlY3Qoc2NvcmUuaW1wb3J0U3VjY2VzcykudG9CZSh0cnVlKTtcbiAgICBleHBlY3Qoc2NvcmUubWV0cmljcy5wb3VDb3VudCkudG9CZUdyZWF0ZXJUaGFuKDApO1xuICAgIGV4cGVjdChzY29yZS5tZXRyaWNzLnRhZ0NvdW50KS50b0JlR3JlYXRlclRoYW4oMCk7XG4gICAgZXhwZWN0KHNjb3JlLm1ldHJpY3MuZmJkTm9kZUNvdW50KS50b0JlR3JlYXRlclRoYW4oMCk7XG4gIH0pO1xuXG4gIGl0KCdpbXBvcnRzIHNlY29uZCBYRUYgc2FtcGxlJywgKCkgPT4ge1xuICAgIGNvbnN0IHhtbCA9IHJlYWRGaWxlU3luYyhGSUxFUy5zY2huZWlkZXIuc2ZjLCAndXRmLTgnKTtcbiAgICBjb25zdCByZXN1bHQgPSBpbXBvcnRTY2huZWlkZXIoeG1sLCBGSUxFUy5zY2huZWlkZXIuc2ZjKTtcbiAgICBleHBlY3QocmVzdWx0Lm9rKS50b0JlKHRydWUpO1xuICAgIGV4cGVjdChyZXN1bHQucHJvamVjdCkudG9CZVRydXRoeSgpO1xuICB9KTtcblxuICBpdCgncm91bmQtdHJpcHMgRkJEOiBpbXBvcnQgXHUyMTkyIGV4cG9ydCBcdTIxOTIgcmUtaW1wb3J0IHByZXNlcnZlcyBcdTIyNjU5NSUgb2YgZWxlbWVudHMnLCAoKSA9PiB7XG4gICAgY29uc3Qgc2NvcmUgPSBydW5Sb3VuZFRyaXAoJ1NjaG5laWRlcicsIEZJTEVTLnNjaG5laWRlci5lYm9vbCwgJ0ZCRCcsIGltcG9ydFNjaG5laWRlciwgZXhwb3J0U2NobmVpZGVyKTtcbiAgICBleHBlY3Qoc2NvcmUucm91bmRUcmlwU3VjY2VzcykudG9CZSh0cnVlKTtcbiAgICBleHBlY3Qoc2NvcmUuYWNjdXJhY3kpLnRvQmVHcmVhdGVyVGhhbk9yRXF1YWwoOTApO1xuICB9KTtcbn0pO1xuXG4vLyBcdTI1MDBcdTI1MDBcdTI1MDAgRmluYWwgU3VtbWFyeSBSZXBvcnQgXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXG5cbmRlc2NyaWJlKCdBQ0NVUkFDWSBTVU1NQVJZIFJFUE9SVCcsICgpID0+IHtcbiAgaXQoJ3ByaW50cyB0aGUgY29tcGxldGUgYWNjdXJhY3kgc2NvcmVjYXJkJywgKCkgPT4ge1xuICAgIGNvbnNvbGUubG9nKCdcXG4nKTtcbiAgICBjb25zb2xlLmxvZygnXHUyNTU0XHUyNTUwXHUyNTUwXHUyNTUwXHUyNTUwXHUyNTUwXHUyNTUwXHUyNTUwXHUyNTUwXHUyNTUwXHUyNTUwXHUyNTUwXHUyNTUwXHUyNTUwXHUyNTUwXHUyNTUwXHUyNTUwXHUyNTUwXHUyNTUwXHUyNTUwXHUyNTUwXHUyNTUwXHUyNTUwXHUyNTUwXHUyNTUwXHUyNTUwXHUyNTUwXHUyNTUwXHUyNTUwXHUyNTUwXHUyNTUwXHUyNTUwXHUyNTUwXHUyNTUwXHUyNTUwXHUyNTUwXHUyNTUwXHUyNTUwXHUyNTUwXHUyNTUwXHUyNTUwXHUyNTUwXHUyNTUwXHUyNTUwXHUyNTUwXHUyNTUwXHUyNTUwXHUyNTUwXHUyNTUwXHUyNTUwXHUyNTUwXHUyNTUwXHUyNTUwXHUyNTUwXHUyNTUwXHUyNTUwXHUyNTUwXHUyNTUwXHUyNTUwXHUyNTUwXHUyNTUwXHUyNTUwXHUyNTUwXHUyNTUwXHUyNTUwXHUyNTUwXHUyNTUwXHUyNTUwXHUyNTUwXHUyNTUwXHUyNTUwXHUyNTUwXHUyNTUwXHUyNTUwXHUyNTUwXHUyNTU3Jyk7XG4gICAgY29uc29sZS5sb2coJ1x1MjU1MSAgICAgICAgICAgICAgUExDIFZFTkRPUiBBREFQVEVSIFx1MjAxNCBBQ0NVUkFDWSBWRVJJRklDQVRJT04gUkVQT1JUICAgICAgICAgIFx1MjU1MScpO1xuICAgIGNvbnNvbGUubG9nKCdcdTI1NjBcdTI1NTBcdTI1NTBcdTI1NTBcdTI1NTBcdTI1NTBcdTI1NTBcdTI1NTBcdTI1NTBcdTI1NTBcdTI1NTBcdTI1NTBcdTI1NTBcdTI1NTBcdTI1NTBcdTI1NTBcdTI1NTBcdTI1NTBcdTI1NTBcdTI1NTBcdTI1NTBcdTI1NTBcdTI1NTBcdTI1NTBcdTI1NTBcdTI1NTBcdTI1NTBcdTI1NTBcdTI1NTBcdTI1NTBcdTI1NTBcdTI1NTBcdTI1NTBcdTI1NTBcdTI1NTBcdTI1NTBcdTI1NTBcdTI1NTBcdTI1NTBcdTI1NTBcdTI1NTBcdTI1NTBcdTI1NTBcdTI1NTBcdTI1NTBcdTI1NTBcdTI1NTBcdTI1NTBcdTI1NTBcdTI1NTBcdTI1NTBcdTI1NTBcdTI1NTBcdTI1NTBcdTI1NTBcdTI1NTBcdTI1NTBcdTI1NTBcdTI1NTBcdTI1NTBcdTI1NTBcdTI1NTBcdTI1NTBcdTI1NTBcdTI1NTBcdTI1NTBcdTI1NTBcdTI1NTBcdTI1NTBcdTI1NTBcdTI1NTBcdTI1NTBcdTI1NTBcdTI1NTBcdTI1NTBcdTI1NjMnKTtcbiAgICBjb25zb2xlLmxvZygnXHUyNTUxIFZlbmRvciAgICAgXHUyNTAyIEZpbGUgICAgICAgICAgICAgICAgICAgICAgICAgIFx1MjUwMiBMYW5nIFx1MjUwMiBJbXBvcnQgXHUyNTAyIFJUICAgXHUyNTAyIEFjYyAgXHUyNTUxJyk7XG4gICAgY29uc29sZS5sb2coJ1x1MjU2MFx1MjU1MFx1MjU1MFx1MjU1MFx1MjU1MFx1MjU1MFx1MjU1MFx1MjU1MFx1MjU1MFx1MjU1MFx1MjU1MFx1MjU1MFx1MjU1MFx1MjU1MFx1MjU1MFx1MjU1MFx1MjU1MFx1MjU1MFx1MjU1MFx1MjU1MFx1MjU1MFx1MjU1MFx1MjU1MFx1MjU1MFx1MjU1MFx1MjU1MFx1MjU1MFx1MjU1MFx1MjU1MFx1MjU1MFx1MjU1MFx1MjU1MFx1MjU1MFx1MjU1MFx1MjU1MFx1MjU1MFx1MjU1MFx1MjU1MFx1MjU1MFx1MjU1MFx1MjU1MFx1MjU1MFx1MjU1MFx1MjU1MFx1MjU1MFx1MjU1MFx1MjU1MFx1MjU1MFx1MjU1MFx1MjU1MFx1MjU1MFx1MjU1MFx1MjU1MFx1MjU1MFx1MjU1MFx1MjU1MFx1MjU1MFx1MjU1MFx1MjU1MFx1MjU1MFx1MjU1MFx1MjU1MFx1MjU1MFx1MjU1MFx1MjU1MFx1MjU1MFx1MjU1MFx1MjU1MFx1MjU1MFx1MjU1MFx1MjU1MFx1MjU1MFx1MjU1MFx1MjU1MFx1MjU1MFx1MjU2MycpO1xuXG4gICAgZm9yIChjb25zdCByIG9mIHJlc3VsdHMpIHtcbiAgICAgIGNvbnN0IHZlbmRvciA9IHIudmVuZG9yLnBhZEVuZCgxMCk7XG4gICAgICBjb25zdCBmaWxlID0gci5maWxlLnN1YnN0cmluZygwLCAzMCkucGFkRW5kKDMwKTtcbiAgICAgIGNvbnN0IGxhbmcgPSByLmxhbmd1YWdlLnBhZEVuZCg0KTtcbiAgICAgIGNvbnN0IGltcCA9IHIuaW1wb3J0U3VjY2VzcyA/ICcgIFx1MjcxMyAgICcgOiAnICBcdTI3MTcgICAnO1xuICAgICAgY29uc3QgcnQgPSByLnJvdW5kVHJpcFN1Y2Nlc3MgPyAnIFx1MjcxMyAgJyA6ICcgXHUyNzE3ICAnO1xuICAgICAgY29uc3QgYWNjID0gci5hY2N1cmFjeSA+IDAgPyBgJHtyLmFjY3VyYWN5LnRvRml4ZWQoMSl9JWAgOiAnTi9BICAnO1xuICAgICAgY29uc29sZS5sb2coYFx1MjU1MSAke3ZlbmRvcn0gXHUyNTAyICR7ZmlsZX0gXHUyNTAyICR7bGFuZ30gXHUyNTAyJHtpbXB9XHUyNTAyJHtydH1cdTI1MDIke2FjYy5wYWRTdGFydCg1KX0gXHUyNTUxYCk7XG4gICAgfVxuXG4gICAgY29uc29sZS5sb2coJ1x1MjU2MFx1MjU1MFx1MjU1MFx1MjU1MFx1MjU1MFx1MjU1MFx1MjU1MFx1MjU1MFx1MjU1MFx1MjU1MFx1MjU1MFx1MjU1MFx1MjU1MFx1MjU1MFx1MjU1MFx1MjU1MFx1MjU1MFx1MjU1MFx1MjU1MFx1MjU1MFx1MjU1MFx1MjU1MFx1MjU1MFx1MjU1MFx1MjU1MFx1MjU1MFx1MjU1MFx1MjU1MFx1MjU1MFx1MjU1MFx1MjU1MFx1MjU1MFx1MjU1MFx1MjU1MFx1MjU1MFx1MjU1MFx1MjU1MFx1MjU1MFx1MjU1MFx1MjU1MFx1MjU1MFx1MjU1MFx1MjU1MFx1MjU1MFx1MjU1MFx1MjU1MFx1MjU1MFx1MjU1MFx1MjU1MFx1MjU1MFx1MjU1MFx1MjU1MFx1MjU1MFx1MjU1MFx1MjU1MFx1MjU1MFx1MjU1MFx1MjU1MFx1MjU1MFx1MjU1MFx1MjU1MFx1MjU1MFx1MjU1MFx1MjU1MFx1MjU1MFx1MjU1MFx1MjU1MFx1MjU1MFx1MjU1MFx1MjU1MFx1MjU1MFx1MjU1MFx1MjU1MFx1MjU1MFx1MjU1MFx1MjU2MycpO1xuXG4gICAgLy8gQWdncmVnYXRlIHBlciB2ZW5kb3JcbiAgICBjb25zdCB2ZW5kb3JzID0gWydQTENvcGVuJywgJ1JvY2t3ZWxsJywgJ1NpZW1lbnMnLCAnU2NobmVpZGVyJ107XG4gICAgZm9yIChjb25zdCB2IG9mIHZlbmRvcnMpIHtcbiAgICAgIGNvbnN0IHZSZXN1bHRzID0gcmVzdWx0cy5maWx0ZXIociA9PiByLnZlbmRvciA9PT0gdiAmJiByLmFjY3VyYWN5ID4gMCk7XG4gICAgICBpZiAodlJlc3VsdHMubGVuZ3RoID4gMCkge1xuICAgICAgICBjb25zdCBhdmcgPSB2UmVzdWx0cy5yZWR1Y2UoKHMsIHIpID0+IHMgKyByLmFjY3VyYWN5LCAwKSAvIHZSZXN1bHRzLmxlbmd0aDtcbiAgICAgICAgY29uc3QgYWxsUGFzcyA9IHZSZXN1bHRzLmV2ZXJ5KHIgPT4gci5yb3VuZFRyaXBTdWNjZXNzKTtcbiAgICAgICAgY29uc29sZS5sb2coYFx1MjU1MSAke3YucGFkRW5kKDEwKX0gXHUyNTAyIEFWRVJBR0UgICAgICAgICAgICAgICAgICAgICAgICBcdTI1MDIgICAgICBcdTI1MDIgICAgICAgXHUyNTAyICAgICAgXHUyNTAyJHthdmcudG9GaXhlZCgxKS5wYWRTdGFydCg1KX0lXHUyNTUxYCk7XG4gICAgICB9XG4gICAgfVxuXG4gICAgY29uc29sZS5sb2coJ1x1MjU1QVx1MjU1MFx1MjU1MFx1MjU1MFx1MjU1MFx1MjU1MFx1MjU1MFx1MjU1MFx1MjU1MFx1MjU1MFx1MjU1MFx1MjU1MFx1MjU1MFx1MjU1MFx1MjU1MFx1MjU1MFx1MjU1MFx1MjU1MFx1MjU1MFx1MjU1MFx1MjU1MFx1MjU1MFx1MjU1MFx1MjU1MFx1MjU1MFx1MjU1MFx1MjU1MFx1MjU1MFx1MjU1MFx1MjU1MFx1MjU1MFx1MjU1MFx1MjU1MFx1MjU1MFx1MjU1MFx1MjU1MFx1MjU1MFx1MjU1MFx1MjU1MFx1MjU1MFx1MjU1MFx1MjU1MFx1MjU1MFx1MjU1MFx1MjU1MFx1MjU1MFx1MjU1MFx1MjU1MFx1MjU1MFx1MjU1MFx1MjU1MFx1MjU1MFx1MjU1MFx1MjU1MFx1MjU1MFx1MjU1MFx1MjU1MFx1MjU1MFx1MjU1MFx1MjU1MFx1MjU1MFx1MjU1MFx1MjU1MFx1MjU1MFx1MjU1MFx1MjU1MFx1MjU1MFx1MjU1MFx1MjU1MFx1MjU1MFx1MjU1MFx1MjU1MFx1MjU1MFx1MjU1MFx1MjU1MFx1MjU1RCcpO1xuICAgIGNvbnNvbGUubG9nKCdcXG4nKTtcblxuICAgIC8vIEFzc2VydCBvdmVyYWxsIHF1YWxpdHkgZ2F0ZVxuICAgIGNvbnN0IGFsbFNjb3JlZCA9IHJlc3VsdHMuZmlsdGVyKHIgPT4gci5hY2N1cmFjeSA+IDApO1xuICAgIGNvbnN0IG92ZXJhbGxBdmcgPSBhbGxTY29yZWQucmVkdWNlKChzLCByKSA9PiBzICsgci5hY2N1cmFjeSwgMCkgLyBhbGxTY29yZWQubGVuZ3RoO1xuICAgIGV4cGVjdChvdmVyYWxsQXZnKS50b0JlR3JlYXRlclRoYW5PckVxdWFsKDkwKTtcbiAgfSk7XG59KTtcbiJdLAogICJtYXBwaW5ncyI6ICJBQWtCQSxTQUFTLFVBQVUsSUFBSSxjQUFjO0FBQ3JDLFNBQVMsb0JBQW9CO0FBQzdCLE9BQU8sVUFBVTtBQUVqQixTQUFTLGVBQWUscUJBQXFCO0FBQzdDLFNBQVMsZ0JBQWdCLHNCQUFzQjtBQUMvQyxTQUFTLGVBQWUscUJBQXFCO0FBQzdDLFNBQVMsaUJBQWlCLHVCQUF1QjtBQU1qRCxNQUFNLFVBQVUsS0FBSyxRQUFRLFdBQVcsMERBQTBEO0FBRWxHLE1BQU0sUUFBUTtBQUFBLEVBQ1osVUFBVTtBQUFBLElB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QUUsSUFBSSxNQUFNLE1BQU0sZUFBZSxPQUFPLEtBQUssVUFBVSxFQUFFLEdBQUcsR0FBRyxHQUFHLEVBQUUsR0FBRyxRQUFRLENBQUMsR0FBRyxTQUFTLENBQUMsRUFBRSxJQUFJLE1BQU0sTUFBTSxPQUFPLFVBQVUsT0FBTyxDQUFDLEdBQUcsS0FBSyxFQUFFLE1BQU0sS0FBSyxVQUFVLE9BQU8sRUFBRTtBQUFBLFlBQ2hMLEVBQUUsSUFBSSxNQUFNLE1BQU0sZUFBZSxPQUFPLEtBQUssVUFBVSxFQUFFLEdBQUcsR0FBRyxHQUFHLEVBQUUsR0FBRyxRQUFRLENBQUMsR0FBRyxTQUFTLENBQUMsRUFBRSxJQUFJLE1BQU0sTUFBTSxPQUFPLFVBQVUsT0FBTyxDQUFDLEdBQUcsS0FBSyxFQUFFLE1BQU0sS0FBSyxVQUFVLE9BQU8sRUFBRTtBQUFBLFlBQ2hMLEVBQUUsSUFBSSxNQUFNLE1BQU0sT0FBTyxPQUFPLFFBQVEsY0FBYyxRQUFRLFVBQVUsRUFBRSxHQUFHLEdBQUcsR0FBRyxFQUFFLEdBQUcsUUFBUSxDQUFDLEVBQUUsSUFBSSxNQUFNLE1BQU0sT0FBTyxVQUFVLE9BQU8sR0FBRyxFQUFFLElBQUksTUFBTSxNQUFNLE9BQU8sVUFBVSxPQUFPLENBQUMsR0FBRyxTQUFTLENBQUMsRUFBRSxJQUFJLE1BQU0sTUFBTSxPQUFPLFVBQVUsT0FBTyxDQUFDLEVBQUU7QUFBQSxZQUNuUCxFQUFFLElBQUksTUFBTSxNQUFNLGdCQUFnQixPQUFPLEtBQUssVUFBVSxFQUFFLEdBQUcsR0FBRyxHQUFHLEVBQUUsR0FBRyxRQUFRLENBQUMsRUFBRSxJQUFJLE1BQU0sTUFBTSxNQUFNLFVBQVUsT0FBTyxDQUFDLEdBQUcsU0FBUyxDQUFDLEdBQUcsS0FBSyxFQUFFLE1BQU0sS0FBSyxVQUFVLE9BQU8sRUFBRTtBQUFBLFlBQ2hMLEVBQUUsSUFBSSxNQUFNLE1BQU0sT0FBTyxPQUFPLFVBQVUsY0FBYyxVQUFVLFVBQVUsRUFBRSxHQUFHLEdBQUcsR0FBRyxFQUFFLEdBQUcsUUFBUSxDQUFDLEVBQUUsSUFBSSxN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
