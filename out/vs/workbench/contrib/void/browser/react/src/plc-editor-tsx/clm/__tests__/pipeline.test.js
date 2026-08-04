import { buildCLMFromStore, isFBOutputPin } from "../builder.js";
import { validateCLM } from "../validator.js";
import { projectLadderProgram, projectFBDProgram, projectSFCProgram, projectTagDatabase } from "../projections.js";
import { clmToST } from "../clmToST.js";
import { clmStore } from "../clmStore.js";
import { CLMGraph } from "../graph.js";
function assert(cond, msg) {
  if (!cond) throw new Error(`FAIL: ${msg}`);
  console.log(`  \u2713 ${msg}`);
}
function section(name) {
  console.log(`
\u2501\u2501\u2501 ${name} \u2501\u2501\u2501`);
}
function makeSimpleLadder() {
  return {
    rungs: [
      {
        id: "rung1",
        number: 1,
        comment: "Start logic",
        elements: [
          { kind: "contact", id: "e1", type: "NO", tag: { name: "Motor_Start", dataType: "BOOL" }, position: { x: 100, y: 0 } },
          { kind: "contact", id: "e2", type: "NC", tag: { name: "E_Stop", dataType: "BOOL" }, position: { x: 200, y: 0 } },
          { kind: "coil", id: "e3", type: "normal", tag: { name: "Motor_Run", dataType: "BOOL" }, position: { x: 400, y: 0 } }
        ],
        branches: [
          {
            id: "br1",
            startNodeId: "e1",
            endNodeId: "e2",
            elements: [
              { kind: "contact", id: "e4", type: "NO", tag: { name: "Motor_Run", dataType: "BOOL" }, position: { x: 150, y: 50 } }
            ]
          }
        ]
      },
      {
        id: "rung2",
        number: 2,
        comment: "TON timer",
        elements: [
          { kind: "contact", id: "e5", type: "NO", tag: { name: "Motor_Run", dataType: "BOOL" }, position: { x: 100, y: 0 } },
          {
            kind: "block",
            id: "e6",
            fbType: "TON",
            instanceName: "RunTimer",
            pins: { IN: { name: "Motor_Run", dataType: "BOOL" }, PT: { name: "RunDelay", dataType: "TIME" }, Q: { name: "TimerDone", dataType: "BOOL" }, ET: { name: "ElapsedTime", dataType: "TIME" } },
            position: { x: 300, y: 0 }
          }
        ],
        branches: []
      }
    ]
  };
}
function makeSimpleFBD() {
  return {
    nodes: [
      {
        id: "n1",
        type: "IN_VARIABLE",
        instanceName: "",
        label: "",
        content: "",
        position: { x: 50, y: 100 },
        size: { width: 80, height: 40 },
        inputs: [],
        outputs: [{ id: "n1-out", name: "OUT", dataType: "BOOL", negated: false }],
        tag: { name: "SensorA", dataType: "BOOL" }
      },
      {
        id: "n2",
        type: "IN_VARIABLE",
        instanceName: "",
        label: "",
        content: "",
        position: { x: 50, y: 200 },
        size: { width: 80, height: 40 },
        inputs: [],
        outputs: [{ id: "n2-out", name: "OUT", dataType: "BOOL", negated: false }],
        tag: { name: "SensorB", dataType: "BOOL" }
      },
      {
        id: "n3",
        type: "AND",
        instanceName: "",
        label: "",
        content: "",
        position: { x: 200, y: 150 },
        size: { width: 60, height: 60 },
        inputs: [
          { id: "n3-in1", name: "IN1", dataType: "BOOL", negated: false },
          { id: "n3-in2", name: "IN2", dataType: "BOOL", negated: false }
        ],
        outputs: [{ id: "n3-out", name: "OUT", dataType: "BOOL", negated: false }]
      },
      {
        id: "n4",
        type: "OUT_VARIABLE",
        instanceName: "",
        label: "",
        content: "",
        position: { x: 350, y: 150 },
        size: { width: 80, height: 40 },
        inputs: [{ id: "n4-in", name: "IN", dataType: "BOOL", negated: false }],
        outputs: [],
        tag: { name: "OutputY", dataType: "BOOL" }
      }
    ],
    wires: [
      { id: "w1", from: { nodeId: "n1", pin: "OUT" }, to: { nodeId: "n3", pin: "IN1" }, negated: false },
      { id: "w2", from: { nodeId: "n2", pin: "OUT" }, to: { nodeId: "n3", pin: "IN2" }, negated: false },
      { id: "w3", from: { nodeId: "n3", pin: "OUT" }, to: { nodeId: "n4", pin: "IN" }, negated: false }
    ]
  };
}
function makeSimpleSFC() {
  return {
    steps: [
      { id: "s1", name: "Init", isInitial: true, actions: [
        { id: "a1", qualifier: "N", tag: { name: "InitDone", dataType: "BOOL" } }
      ], position: { x: 200, y: 100 } },
      { id: "s2", name: "Running", isInitial: false, actions: [
        { id: "a2", qualifier: "L", tag: { name: "MotorOn", dataType: "BOOL" }, duration: "5s" },
        { id: "a3", qualifier: "D", tag: { name: "AlarmOn", dataType: "BOOL" }, duration: "10s" }
      ], position: { x: 200, y: 300 } },
      { id: "s3", name: "Stop", isInitial: false, actions: [
        { id: "a4", qualifier: "S", tag: { name: "StopFlag", dataType: "BOOL" } }
      ], position: { x: 200, y: 500 } }
    ],
    transitions: [
      { id: "t1", condition: "StartButton AND NOT E_Stop", priority: 1, position: { x: 200, y: 200 } },
      { id: "t2", condition: "TimerDone", priority: 1, position: { x: 200, y: 400 } }
    ],
    links: [
      { id: "l1", from: "s1", to: "t1", type: "simple" },
      { id: "l2", from: "t1", to: "s2", type: "simple" },
      { id: "l3", from: "s2", to: "t2", type: "simple" },
      { id: "l4", from: "t2", to: "s3", type: "simple" }
    ],
    branches: [],
    jumps: [{ id: "j1", targetStepName: "Init" }]
  };
}
const baseTags = [
  { name: "Motor_Start", dataType: "BOOL", address: "%I0.0", description: "Start button" },
  { name: "E_Stop", dataType: "BOOL", address: "%I0.1", description: "Emergency stop" },
  { name: "Motor_Run", dataType: "BOOL", address: "%Q0.0", description: "Motor output" },
  { name: "RunDelay", dataType: "TIME", address: "", description: "" },
  { name: "TimerDone", dataType: "BOOL", address: "", description: "" },
  { name: "ElapsedTime", dataType: "TIME", address: "", description: "" },
  { name: "SensorA", dataType: "BOOL", address: "", description: "" },
  { name: "SensorB", dataType: "BOOL", address: "", description: "" },
  { name: "OutputY", dataType: "BOOL", address: "", description: "" },
  { name: "StartButton", dataType: "BOOL", address: "", description: "" },
  { name: "InitDone", dataType: "BOOL", address: "", description: "" },
  { name: "MotorOn", dataType: "BOOL", address: "", description: "" },
  { name: "AlarmOn", dataType: "BOOL", address: "", description: "" },
  { name: "StopFlag", dataType: "BOOL", address: "", description: "" }
];
section("1. isFBOutputPin \u2014 FB output pin heuristic");
assert(isFBOutputPin("TON", "Q") === true, "TON Q is output");
assert(isFBOutputPin("TON", "ET") === true, "TON ET is output");
assert(isFBOutputPin("TON", "IN") === false, "TON IN is input");
assert(isFBOutputPin("TON", "PT") === false, "TON PT is input");
assert(isFBOutputPin("CTU", "Q") === true, "CTU Q is output");
assert(isFBOutputPin("CTU", "CV") === true, "CTU CV is output");
assert(isFBOutputPin("CTU", "CU") === false, "CTU CU is input");
assert(isFBOutputPin("CTUD", "QU") === true, "CTUD QU is output");
assert(isFBOutputPin("CTUD", "QD") === true, "CTUD QD is output");
assert(isFBOutputPin("SR", "Q1") === true, "SR Q1 is output");
assert(isFBOutputPin(void 0, "DONE") === true, "Generic DONE is output");
assert(isFBOutputPin(void 0, "EN") === false, "Generic EN is input");
section("2. buildCLMFromStore \u2014 graph construction");
const clm = buildCLMFromStore(makeSimpleLadder(), makeSimpleFBD(), makeSimpleSFC(), baseTags);
assert(clm.hasNode("pou-main"), "POU node created");
assert(clm.getNodesByType("RUNG").length === 2, "2 rung nodes");
assert(clm.getNodesByType("LD_ELEMENT").length >= 5, "LD_ELEMENT nodes exist");
assert(clm.getNodesByType("FBD_BLOCK").length === 4, "4 FBD_BLOCK nodes (IN\xD72, AND, OUT)");
assert(clm.getNodesByType("FBD_PIN").length > 0, "FBD_PIN nodes created");
assert(clm.getNodesByType("SFC_STEP").length === 3, "3 SFC steps");
assert(clm.getNodesByType("SFC_TRANSITION").length === 2, "2 SFC transitions");
assert(clm.getNodesByType("SFC_JUMP").length === 1, "1 SFC jump");
assert(clm.getNodesByType("SFC_ACTION").length === 4, "4 SFC actions");
assert(clm.getNodesByType("TAG").length >= baseTags.length, "All tags seeded");
const runTimer = clm.getNodesByType("LD_ELEMENT").find((id) => {
  const d = clm.getNodeData(id);
  return d.instanceName === "RunTimer";
});
assert(!!runTimer, "RunTimer LD_ELEMENT node found");
const timerWrites = clm.getOutEdgesByType(runTimer, "WRITES");
const timerReads = clm.getOutEdgesByType(runTimer, "READS");
const writeTagNames = timerWrites.map((e) => clm.getNodeData(e.target).name);
const readTagNames = timerReads.map((e) => clm.getNodeData(e.target).name);
assert(writeTagNames.includes("TimerDone"), "TON Q\u2192TimerDone is WRITES");
assert(writeTagNames.includes("ElapsedTime"), "TON ET\u2192ElapsedTime is WRITES");
assert(readTagNames.includes("Motor_Run"), "TON IN\u2190Motor_Run is READS");
section("3. validateCLM \u2014 SFC structure + dead-code removal");
const errors = validateCLM(clm);
const sfcErrors = errors.filter((e) => e.category === "structure" && e.message.includes("SFC"));
console.log(`  Validation found ${errors.length} total issue(s)`);
if (errors.length > 0) errors.forEach((e) => console.log(`    [${e.severity}] ${e.message}`));
const haltWarnings = sfcErrors.filter((e) => e.message.includes("halt here"));
assert(haltWarnings.length === 1, "Validator correctly warns: Stop step has no outgoing transition");
const trueErrors = sfcErrors.filter((e) => e.severity === "error");
assert(trueErrors.length === 0, "No false-positive SFC errors on well-formed SFC");
const badSFC = { steps: [
  { id: "x1", name: "A", isInitial: false, actions: [], position: { x: 0, y: 0 } }
], transitions: [], links: [], branches: [], jumps: [] };
const badClm = buildCLMFromStore({ rungs: [] }, { nodes: [], wires: [] }, badSFC, []);
const badErrors = validateCLM(badClm).filter((e) => e.message.includes("initial"));
assert(badErrors.length > 0, "Missing initial step is detected");
const doubleCoilLadder = { rungs: [
  { id: "r1", number: 1, comment: "", elements: [
    { kind: "contact", id: "c1", type: "NO", tag: { name: "X", dataType: "BOOL" }, position: { x: 0, y: 0 } },
    { kind: "coil", id: "co1", type: "normal", tag: { name: "Y", dataType: "BOOL" }, position: { x: 200, y: 0 } }
  ], branches: [] },
  { id: "r2", number: 2, comment: "", elements: [
    { kind: "contact", id: "c2", type: "NO", tag: { name: "X", dataType: "BOOL" }, position: { x: 0, y: 0 } },
    { kind: "coil", id: "co2", type: "normal", tag: { name: "Y", dataType: "BOOL" }, position: { x: 200, y: 0 } }
  ], branches: [] }
] };
const dcClm = buildCLMFromStore(doubleCoilLadder, { nodes: [], wires: [] }, { steps: [], transitions: [], links: [], branches: [], jumps: [] }, []);
const dcErrors = validateCLM(dcClm).filter((e) => e.message.includes("Double coil"));
assert(dcErrors.length >= 2, "Double-coil warning fires for both coils");
section("4. Projections \u2014 element order, SFC branches, tag fields");
const ladder = projectLadderProgram(clm);
assert(ladder.rungs.length === 2, "Project: 2 rungs");
assert(ladder.rungs[0].number === 1, "Project: rung ordering preserved");
const rung1Els = ladder.rungs[0].elements;
for (let i = 1; i < rung1Els.length; i++) {
  const prev = rung1Els[i - 1].position?.x ?? 0;
  const curr = rung1Els[i].position?.x ?? 0;
  assert(prev <= curr, `Elements ordered by x: ${prev} <= ${curr}`);
}
assert(ladder.rungs[0].branches.length === 1, "Branch preserved in projection");
assert(ladder.rungs[0].branches[0].startNodeId !== "", "Branch startNodeId restored from anchorId");
const fbd = projectFBDProgram(clm);
assert(fbd.nodes.length === 4, "Project: 4 FBD nodes");
assert(fbd.wires.length === 3, "Project: 3 FBD wires");
const sfc = projectSFCProgram(clm);
assert(sfc.steps.length === 3, "Project: 3 SFC steps");
assert(sfc.transitions.length === 2, "Project: 2 transitions");
assert(sfc.links.length === 4, "Project: 4 SFC links");
assert(sfc.jumps?.length === 1, "Project: jump reconstructed");
const tags = projectTagDatabase(clm);
assert(tags.length >= baseTags.length, "Project: all tags included");
const retainTag = tags.find((t) => t.name === "Motor_Run");
assert(!!retainTag, "Motor_Run tag in projection");
assert("retain" in retainTag, "tag has retain field");
assert("initialValue" in retainTag, "tag has initialValue field");
section("5. clmToST \u2014 ST compilation");
const result = clmToST(clm);
assert(result.stCode.includes("PROGRAM prog0"), "PROGRAM block emitted");
assert(result.stCode.includes("IF"), "LD rungs emitted as IF statements");
assert(result.stCode.includes("Motor_Run"), "Motor_Run tag referenced in ST");
assert(result.stCode.includes("RunTimer("), "FB instance call emitted for RunTimer");
assert(result.stCode.includes("TimerDone := RunTimer.Q"), "TON Q output assignment emitted");
assert(result.stCode.includes("CASE _SFC_STATE"), "SFC CASE statement emitted");
assert(result.stCode.includes("_SFC_STATE = -1"), "SFC initial state check emitted");
assert(result.stCode.includes("_SFC_TMR_"), "SFC timed qualifier timer vars emitted");
assert(result.stCode.includes("TON;"), "SFC timer var declarations emitted");
assert(!result.stCode.includes("expression folding not yet implemented"), "FBD expression folding no longer stub");
assert(result.stCode.includes("OutputY :="), "FBD AND block produces assignment to OutputY");
assert(result.stCode.includes("SensorA") && result.stCode.includes("SensorB"), "FBD input vars referenced");
console.log("  ST preview (first 500 chars):", result.stCode.slice(0, 500));
section("6. clmStore.renameTag \u2014 propagates into SFC condition expressions");
clmStore.initialize(makeSimpleLadder(), makeSimpleFBD(), makeSimpleSFC(), baseTags);
assert(clmStore.initialized, "clmStore initialized");
const sfcBefore = clmStore.getSFCProgram();
const t1Before = sfcBefore.transitions.find((t) => t.id === "t1");
assert(t1Before?.condition?.includes("StartButton"), "Condition contains StartButton before rename");
clmStore.renameTag("StartButton", "PB_Start");
const sfcAfter = clmStore.getSFCProgram();
const t1After = sfcAfter.transitions.find((t) => t.id === "t1");
assert(t1After?.condition?.includes("PB_Start"), "Condition updated to PB_Start after rename");
assert(!t1After?.condition?.includes("StartButton"), "Old name removed from condition");
section("7. clmStore.addSFCJump / deleteSFCJump");
const jumpsBefore = clmStore.getSFCProgram().jumps?.length ?? 0;
clmStore.addSFCJump({ id: "j-test-99", targetStepName: "Running" });
const sfcWithJump = clmStore.getSFCProgram();
assert((sfcWithJump.jumps?.length ?? 0) === jumpsBefore + 1, "Jump added");
assert(sfcWithJump.jumps?.some((j) => j.targetStepName === "Running"), "Jump has correct target");
clmStore.deleteSFCJump("j-test-99");
const sfcWithoutJump = clmStore.getSFCProgram();
assert((sfcWithoutJump.jumps?.length ?? 0) === jumpsBefore, "Jump deleted");
section("8. CLMGraph.import() \u2014 clears before merge");
const g1 = new CLMGraph();
g1.addNode("node-A", "TAG", "shared", { name: "A", dataType: "BOOL", scope: "global" });
const snap = g1.export("pou-main");
g1.addNode("node-B", "TAG", "shared", { name: "B", dataType: "BOOL", scope: "global" });
assert(g1.nodeCount === 2, "Before import: 2 nodes");
g1.import(snap);
assert(g1.nodeCount === 1, "After import: graph cleared, only imported node exists (no duplicate)");
assert(g1.hasNode("node-A"), "node-A present after import");
assert(!g1.hasNode("node-B"), "node-B cleared by import");
console.log("\n\u2705 All pipeline tests passed.\n");
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvY29udHJpYi92b2lkL2Jyb3dzZXIvcmVhY3Qvc3JjL3BsYy1lZGl0b3ItdHN4L2NsbS9fX3Rlc3RzX18vcGlwZWxpbmUudGVzdC50cyJdLAogICJzb3VyY2VzQ29udGVudCI6IFsiLyoqXG4gKiBDTE0gUGlwZWxpbmUgSW50ZWdyYXRpb24gVGVzdHNcbiAqIFRlc3RzIGV2ZXJ5IGZpeGVkIHBhdGg6XG4gKiAgIDEuIGJ1aWxkZXIgXHUyMDE0IG11bHRpLVBPVSwgRkIgb3V0cHV0IHBpbiBoZXVyaXN0aWNcbiAqICAgMi4gdmFsaWRhdG9yIFx1MjAxNCBkZWFkLWNvZGUgcmVtb3ZhbCwgU0ZDIHN0cnVjdHVyYWwgdmFsaWRhdGlvblxuICogICAzLiBwcm9qZWN0aW9ucyBcdTIwMTQgZWxlbWVudCBvcmRlciwgU0ZDIGJyYW5jaGVzLCB0YWcgZmllbGRzXG4gKiAgIDQuIGNsbVRvU1QgXHUyMDE0IEZCRCBmb2xkaW5nLCBTRkMgdGltZWQgcXVhbGlmaWVycywgTEQgZmJfY2FsbCBwaW5zXG4gKiAgIDUuIGNsbVN0b3JlIFx1MjAxNCBzeW5jIGJyaWRnZSwgcmVuYW1lVGFnIHByb3BhZ2F0aW9uLCBhZGRTRkNKdW1wL2RlbGV0ZVNGQ0p1bXBcbiAqICAgNi4gZ3JhcGggXHUyMDE0IGNsZWFyIG9uIGltcG9ydFxuICpcbiAqIFJ1biB3aXRoOiBucHggdHN4IF9fdGVzdHNfXy9waXBlbGluZS50ZXN0LnRzXG4gKi9cblxuaW1wb3J0IHsgYnVpbGRDTE1Gcm9tU3RvcmUsIGlzRkJPdXRwdXRQaW4gfSBmcm9tICcuLi9idWlsZGVyLmpzJztcbmltcG9ydCB7IHZhbGlkYXRlQ0xNIH0gZnJvbSAnLi4vdmFsaWRhdG9yLmpzJztcbmltcG9ydCB7IHByb2plY3RMYWRkZXJQcm9ncmFtLCBwcm9qZWN0RkJEUHJvZ3JhbSwgcHJvamVjdFNGQ1Byb2dyYW0sIHByb2plY3RUYWdEYXRhYmFzZSB9IGZyb20gJy4uL3Byb2plY3Rpb25zLmpzJztcbmltcG9ydCB7IGNsbVRvU1QgfSBmcm9tICcuLi9jbG1Ub1NULmpzJztcbmltcG9ydCB7IGNsbVN0b3JlIH0gZnJvbSAnLi4vY2xtU3RvcmUuanMnO1xuaW1wb3J0IHsgQ0xNR3JhcGggfSBmcm9tICcuLi9ncmFwaC5qcyc7XG5pbXBvcnQgdHlwZSB7IExhZGRlclByb2dyYW0sIEZCRFByb2dyYW0sIFNGQ1Byb2dyYW0sIFRhZ0VudHJ5IH0gZnJvbSAnLi4vLi4vbG9naWNTdG9yZS5qcyc7XG5cbi8vIFx1MjUwMFx1MjUwMFx1MjUwMCBIZWxwZXJzIFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFxuXG5mdW5jdGlvbiBhc3NlcnQoY29uZDogYm9vbGVhbiwgbXNnOiBzdHJpbmcpOiB2b2lkIHtcbiAgaWYgKCFjb25kKSB0aHJvdyBuZXcgRXJyb3IoYEZBSUw6ICR7bXNnfWApO1xuICBjb25zb2xlLmxvZyhgICBcdTI3MTMgJHttc2d9YCk7XG59XG5cbmZ1bmN0aW9uIHNlY3Rpb24obmFtZTogc3RyaW5nKSB7XG4gIGNvbnNvbGUubG9nKGBcXG5cdTI1MDFcdTI1MDFcdTI1MDEgJHtuYW1lfSBcdTI1MDFcdTI1MDFcdTI1MDFgKTtcbn1cblxuLy8gXHUyNTAwXHUyNTAwXHUyNTAwIFRlc3QgZGF0YSBmYWN0b3JpZXMgXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXG5cbmZ1bmN0aW9uIG1ha2VTaW1wbGVMYWRkZXIoKTogTGFkZGVyUHJvZ3JhbSB7XG4gIHJldHVybiB7XG4gICAgcnVuZ3M6IFtcbiAgICAgIHtcbiAgICAgICAgaWQ6ICdydW5nMScsIG51bWJlcjogMSwgY29tbWVudDogJ1N0YXJ0IGxvZ2ljJyxcbiAgICAgICAgZWxlbWVudHM6IFtcbiAgICAgICAgICB7IGtpbmQ6ICdjb250YWN0JywgaWQ6ICdlMScsIHR5cGU6ICdOTycsIHRhZzogeyBuYW1lOiAnTW90b3JfU3RhcnQnLCBkYXRhVHlwZTogJ0JPT0wnIH0sIHBvc2l0aW9uOiB7IHg6IDEwMCwgeTogMCB9IH0sXG4gICAgICAgICAgeyBraW5kOiAnY29udGFjdCcsIGlkOiAnZTInLCB0eXBlOiAnTkMnLCB0YWc6IHsgbmFtZTogJ0VfU3RvcCcsIGRhdGFUeXBlOiAnQk9PTCcgfSwgcG9zaXRpb246IHsgeDogMjAwLCB5OiAwIH0gfSxcbiAgICAgICAgICB7IGtpbmQ6ICdjb2lsJywgICBpZDogJ2UzJywgdHlwZTogJ25vcm1hbCcsIHRhZzogeyBuYW1lOiAnTW90b3JfUnVuJywgZGF0YVR5cGU6ICdCT09MJyB9LCBwb3NpdGlvbjogeyB4OiA0MDAsIHk6IDAgfSB9LFxuICAgICAgICBdLFxuICAgICAgICBicmFuY2hlczogW1xuICAgICAgICAgIHtcbiAgICAgICAgICAgIGlkOiAnYnIxJywgc3RhcnROb2RlSWQ6ICdlMScsIGVuZE5vZGVJZDogJ2UyJyxcbiAgICAgICAgICAgIGVsZW1lbnRzOiBbXG4gICAgICAgICAgICAgIHsga2luZDogJ2NvbnRhY3QnLCBpZDogJ2U0JywgdHlwZTogJ05PJywgdGFnOiB7IG5hbWU6ICdNb3Rvcl9SdW4nLCBkYXRhVHlwZTogJ0JPT0wnIH0sIHBvc2l0aW9uOiB7IHg6IDE1MCwgeTogNTAgfSB9LFxuICAgICAgICAgICAgXSxcbiAgICAgICAgICB9LFxuICAgICAgICBdLFxuICAgICAgfSxcbiAgICAgIHtcbiAgICAgICAgaWQ6ICdydW5nMicsIG51bWJlcjogMiwgY29tbWVudDogJ1RPTiB0aW1lcicsXG4gICAgICAgIGVsZW1lbnRzOiBbXG4gICAgICAgICAgeyBraW5kOiAnY29udGFjdCcsIGlkOiAnZTUnLCB0eXBlOiAnTk8nLCB0YWc6IHsgbmFtZTogJ01vdG9yX1J1bicsIGRhdGFUeXBlOiAnQk9PTCcgfSwgcG9zaXRpb246IHsgeDogMTAwLCB5OiAwIH0gfSxcbiAgICAgICAgICB7XG4gICAgICAgICAgICBraW5kOiAnYmxvY2snLCBpZDogJ2U2JywgZmJUeXBlOiAnVE9OJywgaW5zdGFuY2VOYW1lOiAnUnVuVGltZXInLFxuICAgICAgICAgICAgcGluczogeyBJTjogeyBuYW1lOiAnTW90b3JfUnVuJywgZGF0YVR5cGU6ICdCT09MJyB9LCBQVDogeyBuYW1lOiAnUnVuRGVsYXknLCBkYXRhVHlwZTogJ1RJTUUnIH0sIFE6IHsgbmFtZTogJ1RpbWVyRG9uZScsIGRhdGFUeXBlOiAnQk9PTCcgfSwgRVQ6IHsgbmFtZTogJ0VsYXBzZWRUaW1lJywgZGF0YVR5cGU6ICdUSU1FJyB9IH0sXG4gICAgICAgICAgICBwb3NpdGlvbjogeyB4OiAzMDAsIHk6IDAgfSxcbiAgICAgICAgICB9LFxuICAgICAgICBdLFxuICAgICAgICBicmFuY2hlczogW10sXG4gICAgICB9LFxuICAgIF0sXG4gIH07XG59XG5cbmZ1bmN0aW9uIG1ha2VTaW1wbGVGQkQoKTogRkJEUHJvZ3JhbSB7XG4gIHJldHVybiB7XG4gICAgbm9kZXM6IFtcbiAgICAgIHtcbiAgICAgICAgaWQ6ICduMScsIHR5cGU6ICdJTl9WQVJJQUJMRScsIGluc3RhbmNlTmFtZTogJycsIGxhYmVsOiAnJywgY29udGVudDogJycsXG4gICAgICAgIHBvc2l0aW9uOiB7IHg6IDUwLCB5OiAxMDAgfSwgc2l6ZTogeyB3aWR0aDogODAsIGhlaWdodDogNDAgfSxcbiAgICAgICAgaW5wdXRzOiBbXSwgb3V0cHV0czogW3sgaWQ6ICduMS1vdXQnLCBuYW1lOiAnT1VUJywgZGF0YVR5cGU6ICdCT09MJywgbmVnYXRlZDogZmFsc2UgfV0sXG4gICAgICAgIHRhZzogeyBuYW1lOiAnU2Vuc29yQScsIGRhdGFUeXBlOiAnQk9PTCcgfSxcbiAgICAgIH0sXG4gICAgICB7XG4gICAgICAgIGlkOiAnbjInLCB0eXBlOiAnSU5fVkFSSUFCTEUnLCBpbnN0YW5jZU5hbWU6ICcnLCBsYWJlbDogJycsIGNvbnRlbnQ6ICcnLFxuICAgICAgICBwb3NpdGlvbjogeyB4OiA1MCwgeTogMjAwIH0sIHNpemU6IHsgd2lkdGg6IDgwLCBoZWlnaHQ6IDQwIH0sXG4gICAgICAgIGlucHV0czogW10sIG91dHB1dHM6IFt7IGlkOiAnbjItb3V0JywgbmFtZTogJ09VVCcsIGRhdGFUeXBlOiAnQk9PTCcsIG5lZ2F0ZWQ6IGZhbHNlIH1dLFxuICAgICAgICB0YWc6IHsgbmFtZTogJ1NlbnNvckInLCBkYXRhVHlwZTogJ0JPT0wnIH0sXG4gICAgICB9LFxuICAgICAge1xuICAgICAgICBpZDogJ24zJywgdHlwZTogJ0FORCcsIGluc3RhbmNlTmFtZTogJycsIGxhYmVsOiAnJywgY29udGVudDogJycsXG4gICAgICAgIHBvc2l0aW9uOiB7IHg6IDIwMCwgeTogMTUwIH0sIHNpemU6IHsgd2lkdGg6IDYwLCBoZWlnaHQ6IDYwIH0sXG4gICAgICAgIGlucHV0czogW1xuICAgICAgICAgIHsgaWQ6ICduMy1pbjEnLCBuYW1lOiAnSU4xJywgZGF0YVR5cGU6ICdCT09MJywgbmVnYXRlZDogZmFsc2UgfSxcbiAgICAgICAgICB7IGlkOiAnbjMtaW4yJywgbmFtZTogJ0lOMicsIGRhdGFUeXBlOiAnQk9PTCcsIG5lZ2F0ZWQ6IGZhbHNlIH0sXG4gICAgICAgIF0sXG4gICAgICAgIG91dHB1dHM6IFt7IGlkOiAnbjMtb3V0JywgbmFtZTogJ09VVCcsIGRhdGFUeXBlOiAnQk9PTCcsIG5lZ2F0ZWQ6IGZhbHNlIH1dLFxuICAgICAgfSxcbiAgICAgIHtcbiAgICAgICAgaWQ6ICduNCcsIHR5cGU6ICdPVVRfVkFSSUFCTEUnLCBpbnN0YW5jZU5hbWU6ICcnLCBsYWJlbDogJycsIGNvbnRlbnQ6ICcnLFxuICAgICAgICBwb3NpdGlvbjogeyB4OiAzNTAsIHk6IDE1MCB9LCBzaXplOiB7IHdpZHRoOiA4MCwgaGVpZ2h0OiA0MCB9LFxuICAgICAgICBpbnB1dHM6IFt7IGlkOiAnbjQtaW4nLCBuYW1lOiAnSU4nLCBkYXRhVHlwZTogJ0JPT0wnLCBuZWdhdGVkOiBmYWxzZSB9XSwgb3V0cHV0czogW10sXG4gICAgICAgIHRhZzogeyBuYW1lOiAnT3V0cHV0WScsIGRhdGFUeXBlOiAnQk9PTCcgfSxcbiAgICAgIH0sXG4gICAgXSxcbiAgICB3aXJlczogW1xuICAgICAgeyBpZDogJ3cxJywgZnJvbTogeyBub2RlSWQ6ICduMScsIHBpbjogJ09VVCcgfSwgdG86IHsgbm9kZUlkOiAnbjMnLCBwaW46ICdJTjEnIH0sIG5lZ2F0ZWQ6IGZhbHNlIH0sXG4gICAgICB7IGlkOiAndzInLCBmcm9tOiB7IG5vZGVJZDogJ24yJywgcGluOiAnT1VUJyB9LCB0bzogeyBub2RlSWQ6ICduMycsIHBpbjogJ0lOMicgfSwgbmVnYXRlZDogZmFsc2UgfSxcbiAgICAgIHsgaWQ6ICd3MycsIGZyb206IHsgbm9kZUlkOiAnbjMnLCBwaW46ICdPVVQnIH0sIHRvOiB7IG5vZGVJZDogJ240JywgcGluOiAnSU4nIH0sIG5lZ2F0ZWQ6IGZhbHNlIH0sXG4gICAgXSxcbiAgfTtcbn1cblxuZnVuY3Rpb24gbWFrZVNpbXBsZVNGQygpOiBTRkNQcm9ncmFtIHtcbiAgcmV0dXJuIHtcbiAgICBzdGVwczogW1xuICAgICAgeyBpZDogJ3MxJywgbmFtZTogJ0luaXQnLCBpc0luaXRpYWw6IHRydWUsIGFjdGlvbnM6IFtcbiAgICAgICAgeyBpZDogJ2ExJywgcXVhbGlmaWVyOiAnTicsIHRhZzogeyBuYW1lOiAnSW5pdERvbmUnLCBkYXRhVHlwZTogJ0JPT0wnIH0gfSxcbiAgICAgIF0sIHBvc2l0aW9uOiB7IHg6IDIwMCwgeTogMTAwIH0gfSxcbiAgICAgIHsgaWQ6ICdzMicsIG5hbWU6ICdSdW5uaW5nJywgaXNJbml0aWFsOiBmYWxzZSwgYWN0aW9uczogW1xuICAgICAgICB7IGlkOiAnYTInLCBxdWFsaWZpZXI6ICdMJywgdGFnOiB7IG5hbWU6ICdNb3Rvck9uJywgZGF0YVR5cGU6ICdCT09MJyB9LCBkdXJhdGlvbjogJzVzJyB9LFxuICAgICAgICB7IGlkOiAnYTMnLCBxdWFsaWZpZXI6ICdEJywgdGFnOiB7IG5hbWU6ICdBbGFybU9uJywgZGF0YVR5cGU6ICdCT09MJyB9LCBkdXJhdGlvbjogJzEwcycgfSxcbiAgICAgIF0sIHBvc2l0aW9uOiB7IHg6IDIwMCwgeTogMzAwIH0gfSxcbiAgICAgIHsgaWQ6ICdzMycsIG5hbWU6ICdTdG9wJywgaXNJbml0aWFsOiBmYWxzZSwgYWN0aW9uczogW1xuICAgICAgICB7IGlkOiAnYTQnLCBxdWFsaWZpZXI6ICdTJywgdGFnOiB7IG5hbWU6ICdTdG9wRmxhZycsIGRhdGFUeXBlOiAnQk9PTCcgfSB9LFxuICAgICAgXSwgcG9zaXRpb246IHsgeDogMjAwLCB5OiA1MDAgfSB9LFxuICAgIF0sXG4gICAgdHJhbnNpdGlvbnM6IFtcbiAgICAgIHsgaWQ6ICd0MScsIGNvbmRpdGlvbjogJ1N0YXJ0QnV0dG9uIEFORCBOT1QgRV9TdG9wJywgcHJpb3JpdHk6IDEsIHBvc2l0aW9uOiB7IHg6IDIwMCwgeTogMjAwIH0gfSxcbiAgICAgIHsgaWQ6ICd0MicsIGNvbmRpdGlvbjogJ1RpbWVyRG9uZScsIHByaW9yaXR5OiAxLCBwb3NpdGlvbjogeyB4OiAyMDAsIHk6IDQwMCB9IH0sXG4gICAgXSxcbiAgICBsaW5rczogW1xuICAgICAgeyBpZDogJ2wxJywgZnJvbTogJ3MxJywgdG86ICd0MScsIHR5cGU6ICdzaW1wbGUnIH0sXG4gICAgICB7IGlkOiAnbDInLCBmcm9tOiAndDEnLCB0bzogJ3MyJywgdHlwZTogJ3NpbXBsZScgfSxcbiAgICAgIHsgaWQ6ICdsMycsIGZyb206ICdzMicsIHRvOiAndDInLCB0eXBlOiAnc2ltcGxlJyB9LFxuICAgICAgeyBpZDogJ2w0JywgZnJvbTogJ3QyJywgdG86ICdzMycsIHR5cGU6ICdzaW1wbGUnIH0sXG4gICAgXSxcbiAgICBicmFuY2hlczogW10sXG4gICAganVtcHM6IFt7IGlkOiAnajEnLCB0YXJnZXRTdGVwTmFtZTogJ0luaXQnIH1dLFxuICB9O1xufVxuXG5jb25zdCBiYXNlVGFnczogVGFnRW50cnlbXSA9IFtcbiAgeyBuYW1lOiAnTW90b3JfU3RhcnQnLCBkYXRhVHlwZTogJ0JPT0wnLCBhZGRyZXNzOiAnJUkwLjAnLCBkZXNjcmlwdGlvbjogJ1N0YXJ0IGJ1dHRvbicgfSxcbiAgeyBuYW1lOiAnRV9TdG9wJywgICAgICBkYXRhVHlwZTogJ0JPT0wnLCBhZGRyZXNzOiAnJUkwLjEnLCBkZXNjcmlwdGlvbjogJ0VtZXJnZW5jeSBzdG9wJyB9LFxuICB7IG5hbWU6ICdNb3Rvcl9SdW4nLCAgIGRhdGFUeXBlOiAnQk9PTCcsIGFkZHJlc3M6ICclUTAuMCcsIGRlc2NyaXB0aW9uOiAnTW90b3Igb3V0cHV0JyB9LFxuICB7IG5hbWU6ICdSdW5EZWxheScsICAgIGRhdGFUeXBlOiAnVElNRScsICBhZGRyZXNzOiAnJywgZGVzY3JpcHRpb246ICcnIH0sXG4gIHsgbmFtZTogJ1RpbWVyRG9uZScsICAgZGF0YVR5cGU6ICdCT09MJywgIGFkZHJlc3M6ICcnLCBkZXNjcmlwdGlvbjogJycgfSxcbiAgeyBuYW1lOiAnRWxhcHNlZFRpbWUnLCBkYXRhVHlwZTogJ1RJTUUnLCAgYWRkcmVzczogJycsIGRlc2NyaXB0aW9uOiAnJyB9LFxuICB7IG5hbWU6ICdTZW5zb3JBJywgICAgIGRhdGFUeXBlOiAnQk9PTCcsICBhZGRyZXNzOiAnJywgZGVzY3JpcHRpb246ICcnIH0sXG4gIHsgbmFtZTogJ1NlbnNvckInLCAgICAgZGF0YVR5cGU6ICdCT09MJywgIGFkZHJlc3M6ICcnLCBkZXNjcmlwdGlvbjogJycgfSxcbiAgeyBuYW1lOiAnT3V0cHV0WScsICAgICBkYXRhVHlwZTogJ0JPT0wnLCAgYWRkcmVzczogJycsIGRlc2NyaXB0aW9uOiAnJyB9LFxuICB7IG5hbWU6ICdTdGFydEJ1dHRvbicsIGRhdGFUeXBlOiAnQk9PTCcsICBhZGRyZXNzOiAnJywgZGVzY3JpcHRpb246ICcnIH0sXG4gIHsgbmFtZTogJ0luaXREb25lJywgICAgZGF0YVR5cGU6ICdCT09MJywgIGFkZHJlc3M6ICcnLCBkZXNjcmlwdGlvbjogJycgfSxcbiAgeyBuYW1lOiAnTW90b3JPbicsICAgICBkYXRhVHlwZTogJ0JPT0wnLCAgYWRkcmVzczogJycsIGRlc2NyaXB0aW9uOiAnJyB9LFxuICB7IG5hbWU6ICdBbGFybU9uJywgICAgIGRhdGFUeXBlOiAnQk9PTCcsICBhZGRyZXNzOiAnJywgZGVzY3JpcHRpb246ICcnIH0sXG4gIHsgbmFtZTogJ1N0b3BGbGFnJywgICAgZGF0YVR5cGU6ICdCT09MJywgIGFkZHJlc3M6ICcnLCBkZXNjcmlwdGlvbjogJycgfSxcbl07XG5cbi8vIFx1MjUwMFx1MjUwMFx1MjUwMCBUZXN0IDE6IGlzRkJPdXRwdXRQaW4gXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXG5cbnNlY3Rpb24oJzEuIGlzRkJPdXRwdXRQaW4gXHUyMDE0IEZCIG91dHB1dCBwaW4gaGV1cmlzdGljJyk7XG5hc3NlcnQoaXNGQk91dHB1dFBpbignVE9OJywgJ1EnKSAgID09PSB0cnVlLCAgJ1RPTiBRIGlzIG91dHB1dCcpO1xuYXNzZXJ0KGlzRkJPdXRwdXRQaW4oJ1RPTicsICdFVCcpICA9PT0gdHJ1ZSwgICdUT04gRVQgaXMgb3V0cHV0Jyk7XG5hc3NlcnQoaXNGQk91dHB1dFBpbignVE9OJywgJ0lOJykgID09PSBmYWxzZSwgJ1RPTiBJTiBpcyBpbnB1dCcpO1xuYXNzZXJ0KGlzRkJPdXRwdXRQaW4oJ1RPTicsICdQVCcpICA9PT0gZmFsc2UsICdUT04gUFQgaXMgaW5wdXQnKTtcbmFzc2VydChpc0ZCT3V0cHV0UGluKCdDVFUnLCAnUScpICAgPT09IHRydWUsICAnQ1RVIFEgaXMgb3V0cHV0Jyk7XG5hc3NlcnQoaXNGQk91dHB1dFBpbignQ1RVJywgJ0NWJykgID09PSB0cnVlLCAgJ0NUVSBDViBpcyBvdXRwdXQnKTtcbmFzc2VydChpc0ZCT3V0cHV0UGluKCdDVFUnLCAnQ1UnKSAgPT09IGZhbHNlLCAnQ1RVIENVIGlzIGlucHV0Jyk7XG5hc3NlcnQoaXNGQk91dHB1dFBpbignQ1RVRCcsICdRVScpID09PSB0cnVlLCAgJ0NUVUQgUVUgaXMgb3V0cHV0Jyk7XG5hc3NlcnQoaXNGQk91dHB1dFBpbignQ1RVRCcsICdRRCcpID09PSB0cnVlLCAgJ0NUVUQgUUQgaXMgb3V0cHV0Jyk7XG5hc3NlcnQoaXNGQk91dHB1dFBpbignU1InLCAnUTEnKSAgID09PSB0cnVlLCAgJ1NSIFExIGlzIG91dHB1dCcpO1xuYXNzZXJ0KGlzRkJPdXRwdXRQaW4odW5kZWZpbmVkLCAnRE9ORScpID09PSB0cnVlLCAnR2VuZXJpYyBET05FIGlzIG91dHB1dCcpO1xuYXNzZXJ0KGlzRkJPdXRwdXRQaW4odW5kZWZpbmVkLCAnRU4nKSAgID09PSBmYWxzZSwgJ0dlbmVyaWMgRU4gaXMgaW5wdXQnKTtcblxuLy8gXHUyNTAwXHUyNTAwXHUyNTAwIFRlc3QgMjogYnVpbGRDTE1Gcm9tU3RvcmUgXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXG5cbnNlY3Rpb24oJzIuIGJ1aWxkQ0xNRnJvbVN0b3JlIFx1MjAxNCBncmFwaCBjb25zdHJ1Y3Rpb24nKTtcbmNvbnN0IGNsbSA9IGJ1aWxkQ0xNRnJvbVN0b3JlKG1ha2VTaW1wbGVMYWRkZXIoKSwgbWFrZVNpbXBsZUZCRCgpLCBtYWtlU2ltcGxlU0ZDKCksIGJhc2VUYWdzKTtcblxuYXNzZXJ0KGNsbS5oYXNOb2RlKCdwb3UtbWFpbicpLCAgICdQT1Ugbm9kZSBjcmVhdGVkJyk7XG5hc3NlcnQoY2xtLmdldE5vZGVzQnlUeXBlKCdSVU5HJykubGVuZ3RoID09PSAyLCAnMiBydW5nIG5vZGVzJyk7XG5hc3NlcnQoY2xtLmdldE5vZGVzQnlUeXBlKCdMRF9FTEVNRU5UJykubGVuZ3RoID49IDUsICdMRF9FTEVNRU5UIG5vZGVzIGV4aXN0Jyk7XG5hc3NlcnQoY2xtLmdldE5vZGVzQnlUeXBlKCdGQkRfQkxPQ0snKS5sZW5ndGggPT09IDQsICc0IEZCRF9CTE9DSyBub2RlcyAoSU5cdTAwRDcyLCBBTkQsIE9VVCknKTtcbmFzc2VydChjbG0uZ2V0Tm9kZXNCeVR5cGUoJ0ZCRF9QSU4nKS5sZW5ndGggPiAwLCAnRkJEX1BJTiBub2RlcyBjcmVhdGVkJyk7XG5hc3NlcnQoY2xtLmdldE5vZGVzQnlUeXBlKCdTRkNfU1RFUCcpLmxlbmd0aCA9PT0gMywgJzMgU0ZDIHN0ZXBzJyk7XG5hc3NlcnQoY2xtLmdldE5vZGVzQnlUeXBlKCdTRkNfVFJBTlNJVElPTicpLmxlbmd0aCA9PT0gMiwgJzIgU0ZDIHRyYW5zaXRpb25zJyk7XG5hc3NlcnQoY2xtLmdldE5vZGVzQnlUeXBlKCdTRkNfSlVNUCcpLmxlbmd0aCA9PT0gMSwgJzEgU0ZDIGp1bXAnKTtcbmFzc2VydChjbG0uZ2V0Tm9kZXNCeVR5cGUoJ1NGQ19BQ1RJT04nKS5sZW5ndGggPT09IDQsICc0IFNGQyBhY3Rpb25zJyk7XG5hc3NlcnQoY2xtLmdldE5vZGVzQnlUeXBlKCdUQUcnKS5sZW5ndGggPj0gYmFzZVRhZ3MubGVuZ3RoLCAnQWxsIHRhZ3Mgc2VlZGVkJyk7XG5cbi8vIFZlcmlmeSBUT04gb3V0cHV0IHBpbiBjbGFzc2lmaWNhdGlvbiBcdTIwMTQgUSBhbmQgRVQgc2hvdWxkIGJlIFdSSVRFUywgSU4gYW5kIFBUIHNob3VsZCBiZSBSRUFEU1xuY29uc3QgcnVuVGltZXIgPSBjbG0uZ2V0Tm9kZXNCeVR5cGUoJ0xEX0VMRU1FTlQnKS5maW5kKGlkID0+IHtcbiAgY29uc3QgZCA9IGNsbS5nZXROb2RlRGF0YTxhbnk+KGlkKTtcbiAgcmV0dXJuIGQuaW5zdGFuY2VOYW1lID09PSAnUnVuVGltZXInO1xufSk7XG5hc3NlcnQoISFydW5UaW1lciwgJ1J1blRpbWVyIExEX0VMRU1FTlQgbm9kZSBmb3VuZCcpO1xuY29uc3QgdGltZXJXcml0ZXMgPSBjbG0uZ2V0T3V0RWRnZXNCeVR5cGUocnVuVGltZXIhLCAnV1JJVEVTJyk7XG5jb25zdCB0aW1lclJlYWRzID0gY2xtLmdldE91dEVkZ2VzQnlUeXBlKHJ1blRpbWVyISwgJ1JFQURTJyk7XG5jb25zdCB3cml0ZVRhZ05hbWVzID0gdGltZXJXcml0ZXMubWFwKGUgPT4gY2xtLmdldE5vZGVEYXRhPGFueT4oZS50YXJnZXQpLm5hbWUpO1xuY29uc3QgcmVhZFRhZ05hbWVzID0gdGltZXJSZWFkcy5tYXAoZSA9PiBjbG0uZ2V0Tm9kZURhdGE8YW55PihlLnRhcmdldCkubmFtZSk7XG5hc3NlcnQod3JpdGVUYWdOYW1lcy5pbmNsdWRlcygnVGltZXJEb25lJyksICdUT04gUVx1MjE5MlRpbWVyRG9uZSBpcyBXUklURVMnKTtcbmFzc2VydCh3cml0ZVRhZ05hbWVzLmluY2x1ZGVzKCdFbGFwc2VkVGltZScpLCAnVE9OIEVUXHUyMTkyRWxhcHNlZFRpbWUgaXMgV1JJVEVTJyk7XG5hc3NlcnQocmVhZFRhZ05hbWVzLmluY2x1ZGVzKCdNb3Rvcl9SdW4nKSwgJ1RPTiBJTlx1MjE5ME1vdG9yX1J1biBpcyBSRUFEUycpO1xuXG4vLyBcdTI1MDBcdTI1MDBcdTI1MDAgVGVzdCAzOiB2YWxpZGF0ZUNMTSBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcblxuc2VjdGlvbignMy4gdmFsaWRhdGVDTE0gXHUyMDE0IFNGQyBzdHJ1Y3R1cmUgKyBkZWFkLWNvZGUgcmVtb3ZhbCcpO1xuY29uc3QgZXJyb3JzID0gdmFsaWRhdGVDTE0oY2xtKTtcbmNvbnN0IHNmY0Vycm9ycyA9IGVycm9ycy5maWx0ZXIoZSA9PiBlLmNhdGVnb3J5ID09PSAnc3RydWN0dXJlJyAmJiBlLm1lc3NhZ2UuaW5jbHVkZXMoJ1NGQycpKTtcbmNvbnNvbGUubG9nKGAgIFZhbGlkYXRpb24gZm91bmQgJHtlcnJvcnMubGVuZ3RofSB0b3RhbCBpc3N1ZShzKWApO1xuaWYgKGVycm9ycy5sZW5ndGggPiAwKSBlcnJvcnMuZm9yRWFjaChlID0+IGNvbnNvbGUubG9nKGAgICAgWyR7ZS5zZXZlcml0eX1dICR7ZS5tZXNzYWdlfWApKTtcbi8vIHMzIChTdG9wKSBoYXMgbm8gb3V0Z29pbmcgZWRnZSBcdTIwMTQgdmFsaWRhdG9yIGNvcnJlY3RseSB3YXJucyBhYm91dCBoYWx0XG5jb25zdCBoYWx0V2FybmluZ3MgPSBzZmNFcnJvcnMuZmlsdGVyKGUgPT4gZS5tZXNzYWdlLmluY2x1ZGVzKCdoYWx0IGhlcmUnKSk7XG5hc3NlcnQoaGFsdFdhcm5pbmdzLmxlbmd0aCA9PT0gMSwgJ1ZhbGlkYXRvciBjb3JyZWN0bHkgd2FybnM6IFN0b3Agc3RlcCBoYXMgbm8gb3V0Z29pbmcgdHJhbnNpdGlvbicpO1xuLy8gTm8gZmFsc2UgcG9zaXRpdmVzIG9uIHN0cnVjdHVyYWwgZXJyb3JzIChpbml0aWFsIHN0ZXAgZm91bmQsIHN0ZXBzIHJlYWNoYWJsZSlcbmNvbnN0IHRydWVFcnJvcnMgPSBzZmNFcnJvcnMuZmlsdGVyKGUgPT4gZS5zZXZlcml0eSA9PT0gJ2Vycm9yJyk7XG5hc3NlcnQodHJ1ZUVycm9ycy5sZW5ndGggPT09IDAsICdObyBmYWxzZS1wb3NpdGl2ZSBTRkMgZXJyb3JzIG9uIHdlbGwtZm9ybWVkIFNGQycpO1xuXG4vLyBUZXN0IGludmFsaWQgU0ZDIFx1MjAxNCBubyBpbml0aWFsIHN0ZXBcbmNvbnN0IGJhZFNGQzogU0ZDUHJvZ3JhbSA9IHsgc3RlcHM6IFtcbiAgeyBpZDogJ3gxJywgbmFtZTogJ0EnLCBpc0luaXRpYWw6IGZhbHNlLCBhY3Rpb25zOiBbXSwgcG9zaXRpb246IHsgeDogMCwgeTogMCB9IH0sXG5dLCB0cmFuc2l0aW9uczogW10sIGxpbmtzOiBbXSwgYnJhbmNoZXM6IFtdLCBqdW1wczogW10gfTtcbmNvbnN0IGJhZENsbSA9IGJ1aWxkQ0xNRnJvbVN0b3JlKHsgcnVuZ3M6IFtdIH0sIHsgbm9kZXM6IFtdLCB3aXJlczogW10gfSwgYmFkU0ZDLCBbXSk7XG5jb25zdCBiYWRFcnJvcnMgPSB2YWxpZGF0ZUNMTShiYWRDbG0pLmZpbHRlcihlID0+IGUubWVzc2FnZS5pbmNsdWRlcygnaW5pdGlhbCcpKTtcbmFzc2VydChiYWRFcnJvcnMubGVuZ3RoID4gMCwgJ01pc3NpbmcgaW5pdGlhbCBzdGVwIGlzIGRldGVjdGVkJyk7XG5cbi8vIFRlc3QgZG91YmxlLWNvaWwgd2FybmluZ1xuY29uc3QgZG91YmxlQ29pbExhZGRlcjogTGFkZGVyUHJvZ3JhbSA9IHsgcnVuZ3M6IFtcbiAgeyBpZDogJ3IxJywgbnVtYmVyOiAxLCBjb21tZW50OiAnJywgZWxlbWVudHM6IFtcbiAgICB7IGtpbmQ6ICdjb250YWN0JywgaWQ6ICdjMScsIHR5cGU6ICdOTycsIHRhZzogeyBuYW1lOiAnWCcsIGRhdGFUeXBlOiAnQk9PTCcgfSwgcG9zaXRpb246IHsgeDogMCwgeTogMCB9IH0sXG4gICAgeyBraW5kOiAnY29pbCcsIGlkOiAnY28xJywgdHlwZTogJ25vcm1hbCcsIHRhZzogeyBuYW1lOiAnWScsIGRhdGFUeXBlOiAnQk9PTCcgfSwgcG9zaXRpb246IHsgeDogMjAwLCB5OiAwIH0gfSxcbiAgXSwgYnJhbmNoZXM6IFtdIH0sXG4gIHsgaWQ6ICdyMicsIG51bWJlcjogMiwgY29tbWVudDogJycsIGVsZW1lbnRzOiBbXG4gICAgeyBraW5kOiAnY29udGFjdCcsIGlkOiAnYzInLCB0eXBlOiAnTk8nLCB0YWc6IHsgbmFtZTogJ1gnLCBkYXRhVHlwZTogJ0JPT0wnIH0sIHBvc2l0aW9uOiB7IHg6IDAsIHk6IDAgfSB9LFxuICAgIHsga2luZDogJ2NvaWwnLCBpZDogJ2NvMicsIHR5cGU6ICdub3JtYWwnLCB0YWc6IHsgbmFtZTogJ1knLCBkYXRhVHlwZTogJ0JPT0wnIH0sIHBvc2l0aW9uOiB7IHg6IDIwMCwgeTogMCB9IH0sXG4gIF0sIGJyYW5jaGVzOiBbXSB9LFxuXX07XG5jb25zdCBkY0NsbSA9IGJ1aWxkQ0xNRnJvbVN0b3JlKGRvdWJsZUNvaWxMYWRkZXIsIHsgbm9kZXM6IFtdLCB3aXJlczogW10gfSwgeyBzdGVwczogW10sIHRyYW5zaXRpb25zOiBbXSwgbGlua3M6IFtdLCBicmFuY2hlczogW10sIGp1bXBzOiBbXSB9LCBbXSk7XG5jb25zdCBkY0Vycm9ycyA9IHZhbGlkYXRlQ0xNKGRjQ2xtKS5maWx0ZXIoZSA9PiBlLm1lc3NhZ2UuaW5jbHVkZXMoJ0RvdWJsZSBjb2lsJykpO1xuYXNzZXJ0KGRjRXJyb3JzLmxlbmd0aCA+PSAyLCAnRG91YmxlLWNvaWwgd2FybmluZyBmaXJlcyBmb3IgYm90aCBjb2lscycpO1xuXG4vLyBcdTI1MDBcdTI1MDBcdTI1MDAgVGVzdCA0OiBwcm9qZWN0aW9ucyBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcblxuc2VjdGlvbignNC4gUHJvamVjdGlvbnMgXHUyMDE0IGVsZW1lbnQgb3JkZXIsIFNGQyBicmFuY2hlcywgdGFnIGZpZWxkcycpO1xuY29uc3QgbGFkZGVyID0gcHJvamVjdExhZGRlclByb2dyYW0oY2xtKTtcbmFzc2VydChsYWRkZXIucnVuZ3MubGVuZ3RoID09PSAyLCAnUHJvamVjdDogMiBydW5ncycpO1xuYXNzZXJ0KGxhZGRlci5ydW5nc1swXS5udW1iZXIgPT09IDEsICdQcm9qZWN0OiBydW5nIG9yZGVyaW5nIHByZXNlcnZlZCcpO1xuLy8gRWxlbWVudHMgc29ydGVkIGJ5IHggcG9zaXRpb25cbmNvbnN0IHJ1bmcxRWxzID0gbGFkZGVyLnJ1bmdzWzBdLmVsZW1lbnRzO1xuZm9yIChsZXQgaSA9IDE7IGkgPCBydW5nMUVscy5sZW5ndGg7IGkrKykge1xuICBjb25zdCBwcmV2ID0gKHJ1bmcxRWxzW2kgLSAxXS5wb3NpdGlvbj8ueCA/PyAwKTtcbiAgY29uc3QgY3VyciA9IChydW5nMUVsc1tpXS5wb3NpdGlvbj8ueCA/PyAwKTtcbiAgYXNzZXJ0KHByZXYgPD0gY3VyciwgYEVsZW1lbnRzIG9yZGVyZWQgYnkgeDogJHtwcmV2fSA8PSAke2N1cnJ9YCk7XG59XG5hc3NlcnQobGFkZGVyLnJ1bmdzWzBdLmJyYW5jaGVzLmxlbmd0aCA9PT0gMSwgJ0JyYW5jaCBwcmVzZXJ2ZWQgaW4gcHJvamVjdGlvbicpO1xuLy8gQnJhbmNoIGFuY2hvciBJRCBzaG91bGQgYmUgcHJlc2VydmVkXG5hc3NlcnQobGFkZGVyLnJ1bmdzWzBdLmJyYW5jaGVzWzBdLnN0YXJ0Tm9kZUlkICE9PSAnJywgJ0JyYW5jaCBzdGFydE5vZGVJZCByZXN0b3JlZCBmcm9tIGFuY2hvcklkJyk7XG5cbmNvbnN0IGZiZCA9IHByb2plY3RGQkRQcm9ncmFtKGNsbSk7XG5hc3NlcnQoZmJkLm5vZGVzLmxlbmd0aCA9PT0gNCwgJ1Byb2plY3Q6IDQgRkJEIG5vZGVzJyk7XG5hc3NlcnQoZmJkLndpcmVzLmxlbmd0aCA9PT0gMywgJ1Byb2plY3Q6IDMgRkJEIHdpcmVzJyk7XG5cbmNvbnN0IHNmYyA9IHByb2plY3RTRkNQcm9ncmFtKGNsbSk7XG5hc3NlcnQoc2ZjLnN0ZXBzLmxlbmd0aCA9PT0gMywgJ1Byb2plY3Q6IDMgU0ZDIHN0ZXBzJyk7XG5hc3NlcnQoc2ZjLnRyYW5zaXRpb25zLmxlbmd0aCA9PT0gMiwgJ1Byb2plY3Q6IDIgdHJhbnNpdGlvbnMnKTtcbmFzc2VydChzZmMubGlua3MubGVuZ3RoID09PSA0LCAnUHJvamVjdDogNCBTRkMgbGlua3MnKTtcbmFzc2VydCgoc2ZjIGFzIGFueSkuanVtcHM/Lmxlbmd0aCA9PT0gMSwgJ1Byb2plY3Q6IGp1bXAgcmVjb25zdHJ1Y3RlZCcpO1xuXG5jb25zdCB0YWdzID0gcHJvamVjdFRhZ0RhdGFiYXNlKGNsbSk7XG5hc3NlcnQodGFncy5sZW5ndGggPj0gYmFzZVRhZ3MubGVuZ3RoLCAnUHJvamVjdDogYWxsIHRhZ3MgaW5jbHVkZWQnKTtcbmNvbnN0IHJldGFpblRhZyA9IHRhZ3MuZmluZCh0ID0+IHQubmFtZSA9PT0gJ01vdG9yX1J1bicpO1xuYXNzZXJ0KCEhcmV0YWluVGFnLCAnTW90b3JfUnVuIHRhZyBpbiBwcm9qZWN0aW9uJyk7XG5hc3NlcnQoJ3JldGFpbicgaW4gcmV0YWluVGFnISwgJ3RhZyBoYXMgcmV0YWluIGZpZWxkJyk7XG5hc3NlcnQoJ2luaXRpYWxWYWx1ZScgaW4gcmV0YWluVGFnISwgJ3RhZyBoYXMgaW5pdGlhbFZhbHVlIGZpZWxkJyk7XG5cbi8vIFx1MjUwMFx1MjUwMFx1MjUwMCBUZXN0IDU6IGNsbVRvU1QgXHUyMDE0IExELCBGQkQgZm9sZGluZywgU0ZDIHRpbWVkIHF1YWxpZmllcnMgXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXG5cbnNlY3Rpb24oJzUuIGNsbVRvU1QgXHUyMDE0IFNUIGNvbXBpbGF0aW9uJyk7XG5jb25zdCByZXN1bHQgPSBjbG1Ub1NUKGNsbSk7XG5hc3NlcnQocmVzdWx0LnN0Q29kZS5pbmNsdWRlcygnUFJPR1JBTSBwcm9nMCcpLCAnUFJPR1JBTSBibG9jayBlbWl0dGVkJyk7XG5hc3NlcnQocmVzdWx0LnN0Q29kZS5pbmNsdWRlcygnSUYnKSwgJ0xEIHJ1bmdzIGVtaXR0ZWQgYXMgSUYgc3RhdGVtZW50cycpO1xuYXNzZXJ0KHJlc3VsdC5zdENvZGUuaW5jbHVkZXMoJ01vdG9yX1J1bicpLCAnTW90b3JfUnVuIHRhZyByZWZlcmVuY2VkIGluIFNUJyk7XG5hc3NlcnQocmVzdWx0LnN0Q29kZS5pbmNsdWRlcygnUnVuVGltZXIoJyksICdGQiBpbnN0YW5jZSBjYWxsIGVtaXR0ZWQgZm9yIFJ1blRpbWVyJyk7XG5hc3NlcnQocmVzdWx0LnN0Q29kZS5pbmNsdWRlcygnVGltZXJEb25lIDo9IFJ1blRpbWVyLlEnKSwgJ1RPTiBRIG91dHB1dCBhc3NpZ25tZW50IGVtaXR0ZWQnKTtcbmFzc2VydChyZXN1bHQuc3RDb2RlLmluY2x1ZGVzKCdDQVNFIF9TRkNfU1RBVEUnKSwgJ1NGQyBDQVNFIHN0YXRlbWVudCBlbWl0dGVkJyk7XG5hc3NlcnQocmVzdWx0LnN0Q29kZS5pbmNsdWRlcygnX1NGQ19TVEFURSA9IC0xJyksICdTRkMgaW5pdGlhbCBzdGF0ZSBjaGVjayBlbWl0dGVkJyk7XG5hc3NlcnQocmVzdWx0LnN0Q29kZS5pbmNsdWRlcygnX1NGQ19UTVJfJyksICdTRkMgdGltZWQgcXVhbGlmaWVyIHRpbWVyIHZhcnMgZW1pdHRlZCcpO1xuYXNzZXJ0KHJlc3VsdC5zdENvZGUuaW5jbHVkZXMoJ1RPTjsnKSwgJ1NGQyB0aW1lciB2YXIgZGVjbGFyYXRpb25zIGVtaXR0ZWQnKTtcbi8vIENoZWNrIEZCRCBBTkQgYmxvY2sgcHJvZHVjZXMgU1QgYXNzaWdubWVudCAobm90IGEgc3R1YiBjb21tZW50KVxuYXNzZXJ0KCFyZXN1bHQuc3RDb2RlLmluY2x1ZGVzKCdleHByZXNzaW9uIGZvbGRpbmcgbm90IHlldCBpbXBsZW1lbnRlZCcpLCAnRkJEIGV4cHJlc3Npb24gZm9sZGluZyBubyBsb25nZXIgc3R1YicpO1xuYXNzZXJ0KHJlc3VsdC5zdENvZGUuaW5jbHVkZXMoJ091dHB1dFkgOj0nKSwgJ0ZCRCBBTkQgYmxvY2sgcHJvZHVjZXMgYXNzaWdubWVudCB0byBPdXRwdXRZJyk7XG5hc3NlcnQocmVzdWx0LnN0Q29kZS5pbmNsdWRlcygnU2Vuc29yQScpICYmIHJlc3VsdC5zdENvZGUuaW5jbHVkZXMoJ1NlbnNvckInKSwgJ0ZCRCBpbnB1dCB2YXJzIHJlZmVyZW5jZWQnKTtcbmNvbnNvbGUubG9nKCcgIFNUIHByZXZpZXcgKGZpcnN0IDUwMCBjaGFycyk6JywgcmVzdWx0LnN0Q29kZS5zbGljZSgwLCA1MDApKTtcblxuLy8gXHUyNTAwXHUyNTAwXHUyNTAwIFRlc3QgNjogY2xtU3RvcmUucmVuYW1lVGFnIHByb3BhZ2F0ZXMgdG8gU0ZDIGNvbmRpdGlvbnMgXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXG5cbnNlY3Rpb24oJzYuIGNsbVN0b3JlLnJlbmFtZVRhZyBcdTIwMTQgcHJvcGFnYXRlcyBpbnRvIFNGQyBjb25kaXRpb24gZXhwcmVzc2lvbnMnKTtcbmNsbVN0b3JlLmluaXRpYWxpemUobWFrZVNpbXBsZUxhZGRlcigpLCBtYWtlU2ltcGxlRkJEKCksIG1ha2VTaW1wbGVTRkMoKSwgYmFzZVRhZ3MpO1xuYXNzZXJ0KGNsbVN0b3JlLmluaXRpYWxpemVkLCAnY2xtU3RvcmUgaW5pdGlhbGl6ZWQnKTtcblxuLy8gQ2hlY2sgdHJhbnNpdGlvbiBjb25kaXRpb24gYmVmb3JlIHJlbmFtZVxuY29uc3Qgc2ZjQmVmb3JlID0gY2xtU3RvcmUuZ2V0U0ZDUHJvZ3JhbSgpO1xuY29uc3QgdDFCZWZvcmUgPSBzZmNCZWZvcmUudHJhbnNpdGlvbnMuZmluZCh0ID0+IHQuaWQgPT09ICd0MScpO1xuYXNzZXJ0KHQxQmVmb3JlPy5jb25kaXRpb24/LmluY2x1ZGVzKCdTdGFydEJ1dHRvbicpLCAnQ29uZGl0aW9uIGNvbnRhaW5zIFN0YXJ0QnV0dG9uIGJlZm9yZSByZW5hbWUnKTtcblxuY2xtU3RvcmUucmVuYW1lVGFnKCdTdGFydEJ1dHRvbicsICdQQl9TdGFydCcpO1xuXG5jb25zdCBzZmNBZnRlciA9IGNsbVN0b3JlLmdldFNGQ1Byb2dyYW0oKTtcbmNvbnN0IHQxQWZ0ZXIgPSBzZmNBZnRlci50cmFuc2l0aW9ucy5maW5kKHQgPT4gdC5pZCA9PT0gJ3QxJyk7XG5hc3NlcnQodDFBZnRlcj8uY29uZGl0aW9uPy5pbmNsdWRlcygnUEJfU3RhcnQnKSwgJ0NvbmRpdGlvbiB1cGRhdGVkIHRvIFBCX1N0YXJ0IGFmdGVyIHJlbmFtZScpO1xuYXNzZXJ0KCF0MUFmdGVyPy5jb25kaXRpb24/LmluY2x1ZGVzKCdTdGFydEJ1dHRvbicpLCAnT2xkIG5hbWUgcmVtb3ZlZCBmcm9tIGNvbmRpdGlvbicpO1xuXG4vLyBcdTI1MDBcdTI1MDBcdTI1MDAgVGVzdCA3OiBjbG1TdG9yZS5hZGRTRkNKdW1wIC8gZGVsZXRlU0ZDSnVtcCBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcblxuc2VjdGlvbignNy4gY2xtU3RvcmUuYWRkU0ZDSnVtcCAvIGRlbGV0ZVNGQ0p1bXAnKTtcbmNvbnN0IGp1bXBzQmVmb3JlID0gY2xtU3RvcmUuZ2V0U0ZDUHJvZ3JhbSgpLmp1bXBzPy5sZW5ndGggPz8gMDtcbmNsbVN0b3JlLmFkZFNGQ0p1bXAoeyBpZDogJ2otdGVzdC05OScsIHRhcmdldFN0ZXBOYW1lOiAnUnVubmluZycgfSk7XG5jb25zdCBzZmNXaXRoSnVtcCA9IGNsbVN0b3JlLmdldFNGQ1Byb2dyYW0oKTtcbmFzc2VydCgoc2ZjV2l0aEp1bXAuanVtcHM/Lmxlbmd0aCA/PyAwKSA9PT0ganVtcHNCZWZvcmUgKyAxLCAnSnVtcCBhZGRlZCcpO1xuYXNzZXJ0KHNmY1dpdGhKdW1wLmp1bXBzPy5zb21lKGogPT4gai50YXJnZXRTdGVwTmFtZSA9PT0gJ1J1bm5pbmcnKSwgJ0p1bXAgaGFzIGNvcnJlY3QgdGFyZ2V0Jyk7XG5cbmNsbVN0b3JlLmRlbGV0ZVNGQ0p1bXAoJ2otdGVzdC05OScpO1xuY29uc3Qgc2ZjV2l0aG91dEp1bXAgPSBjbG1TdG9yZS5nZXRTRkNQcm9ncmFtKCk7XG5hc3NlcnQoKHNmY1dpdGhvdXRKdW1wLmp1bXBzPy5sZW5ndGggPz8gMCkgPT09IGp1bXBzQmVmb3JlLCAnSnVtcCBkZWxldGVkJyk7XG5cbi8vIFx1MjUwMFx1MjUwMFx1MjUwMCBUZXN0IDg6IGdyYXBoLmltcG9ydCgpIGNsZWFycyBiZWZvcmUgaW1wb3J0aW5nIFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFxuXG5zZWN0aW9uKCc4LiBDTE1HcmFwaC5pbXBvcnQoKSBcdTIwMTQgY2xlYXJzIGJlZm9yZSBtZXJnZScpO1xuY29uc3QgZzEgPSBuZXcgQ0xNR3JhcGgoKTtcbmcxLmFkZE5vZGUoJ25vZGUtQScsICdUQUcnLCAnc2hhcmVkJywgeyBuYW1lOiAnQScsIGRhdGFUeXBlOiAnQk9PTCcsIHNjb3BlOiAnZ2xvYmFsJyB9KTtcbmNvbnN0IHNuYXAgPSBnMS5leHBvcnQoJ3BvdS1tYWluJyk7XG4vLyBJbXBvcnQgaW50byBub24tZW1wdHkgZ3JhcGhcbmcxLmFkZE5vZGUoJ25vZGUtQicsICdUQUcnLCAnc2hhcmVkJywgeyBuYW1lOiAnQicsIGRhdGFUeXBlOiAnQk9PTCcsIHNjb3BlOiAnZ2xvYmFsJyB9KTtcbmFzc2VydChnMS5ub2RlQ291bnQgPT09IDIsICdCZWZvcmUgaW1wb3J0OiAyIG5vZGVzJyk7XG5nMS5pbXBvcnQoc25hcCk7XG5hc3NlcnQoZzEubm9kZUNvdW50ID09PSAxLCAnQWZ0ZXIgaW1wb3J0OiBncmFwaCBjbGVhcmVkLCBvbmx5IGltcG9ydGVkIG5vZGUgZXhpc3RzIChubyBkdXBsaWNhdGUpJyk7XG5hc3NlcnQoZzEuaGFzTm9kZSgnbm9kZS1BJyksICdub2RlLUEgcHJlc2VudCBhZnRlciBpbXBvcnQnKTtcbmFzc2VydCghZzEuaGFzTm9kZSgnbm9kZS1CJyksICdub2RlLUIgY2xlYXJlZCBieSBpbXBvcnQnKTtcblxuLy8gXHUyNTAwXHUyNTAwXHUyNTAwIERvbmUgXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXG5cbmNvbnNvbGUubG9nKCdcXG5cdTI3MDUgQWxsIHBpcGVsaW5lIHRlc3RzIHBhc3NlZC5cXG4nKTtcbiJdLAogICJtYXBwaW5ncyI6ICJBQWFBLFNBQVMsbUJBQW1CLHFC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SSxVQUFVLE1BQU0sT0FBTyxVQUFVLFFBQVEsU0FBUyxNQUFNLENBQUM7QUFBQSxRQUNyRixLQUFLLEVBQUUsTUFBTSxXQUFXLFVBQVUsT0FBTztBQUFBLE1BQzNDO0FBQUEsTUFDQTtBQUFBLFFBQ0UsSUFBSTtBQUFBLFFBQU0sTUFBTTtBQUFBLFFBQWUsY0FBYztBQUFBLFFBQUksT0FBTztBQUFBLFFBQUksU0FBUztBQUFBLFFBQ3JFLFVBQVUsRUFBRSxHQUFHLElBQUksR0FBRyxJQUFJO0FBQUEsUUFBRyxNQUFNLEVBQUUsT0FBTyxJQUFJLFFBQVEsR0FBRztBQUFBLFFBQzNELFFBQVEsQ0FBQztBQUFBLFFBQUcsU0FBUyxDQUFDLEVBQUUsSUFBSSxVQUFVLE1BQU0sT0FBTyxVQUFVLFFBQVEsU0FBUyxNQUFNLENBQUM7QUFBQSxRQUNyRixLQUFLLEVBQUUsTUFBTSxXQUFXLFVBQVUsT0FBTztBQUFBLE1BQzNDO0FBQUEsTUFDQTtBQUFBLFFBQ0UsSUFBSTtBQUFBLFFBQU0sTUFBTTtBQUFBLFFBQU8sY0FBYztBQUFBLFFBQUksT0FBTztBQUFBLFFBQUksU0FBUztBQUFBLFFBQzdELFVBQVUsRUFBRSxHQUFHLEtBQUssR0FBRyxJQUFJO0FBQUEsUUFBRyxNQUFNLEVBQUUsT0FBTyxJQUFJLFFBQVEsR0FBRztBQUFBLFFBQzVELFFBQVE7QUFBQSxVQUNOLEVBQUUsSUFBSSxVQUFVLE1BQU0sT0FBTyxVQUFVLFFBQVEsU0FBUyxNQUFNO0FBQUEsVUFDOUQsRUFBRSxJQUFJLFVBQVUsTUFBTSxPQUFPLFVBQVUsUUFBUSxTQUFTLE1BQU07QUFBQSxRQUNoRTtBQUFBLFFBQ0EsU0FBUyxDQUFDLEVBQUUsSUFBSSxVQUFVLE1BQU0sT0FBTyxVQUFVLFFBQVEsU0FBUyxNQUFNLENBQUM7QUFBQSxNQUMzRTtBQUFBLE1BQ0E7QUFBQSxRQUNFLElBQUk7QUFBQSxRQUFNLE1BQU07QUFBQSxRQUFnQixjQUFjO0FBQUEsUUFBSSxPQUFPO0FBQUEsUUFBSSxTQUFTO0FBQUEsUUFDdEUsVUFBVSxFQUFFLEdBQUcsS0FBSyxHQUFHLElBQUk7QUFBQSxRQUFHLE1BQU0sRUFBRSxPQUFPLElBQUksUUFBUSxHQUFHO0FBQUEsUUFDNUQsUUFBUSxDQUFDLEVBQUUsSUFBSSxTQUFTLE1BQU0sTUFBTSxVQUFVLFFBQVEsU0FBUyxNQUFNLENBQUM7QUFBQSxRQUFHLFNBQVMsQ0FBQztBQUFBLFFBQ25GLEtBQUssRUFBRSxNQUFNLFdBQVcsVUFBVSxPQUFPO0FBQUEsTUFDM0M7QUFBQSxJQUNGO0FBQUEsSUFDQSxPQUFPO0FBQUEsTUFDTCxFQUFFLElBQUksTUFBTSxNQUFNLEVBQUUsUUFBUSxNQUFNLEtBQUssTUFBTSxHQUFHLElBQUksRUFBRSxRQUFRLE1BQU0sS0FBSyxNQUFNLEdBQUcsU0FBUyxNQUFNO0FBQUEsTUFDakcsRUFBRSxJQUFJLE1BQU0sTUFBTSxFQUFFLFFBQVEsTUFBTSxLQUFLLE1BQU0sR0FBRyxJQUFJLEVBQUUsUUFBUSxNQUFNLEtBQUssTUFBTSxHQUFHLFNBQVMsTUFBTTtBQUFBLE1BQ2pHLEVBQUUsSUFBSSxNQUFNLE1BQU0sRUFBRSxRQUFRLE1BQU0sS0FBSyxNQUFNLEdBQUcsSUFBSSxFQUFFLFFBQVEsTUFBTSxLQUFLLEtBQUssR0FBRyxTQUFTLE1BQU07QUFBQSxJQUNsRztBQUFBLEVBQ0Y7QUFDRjtBQUVBLFNBQVMsZ0JBQTRCO0FBQ25DLFNBQU87QUFBQSxJQUNMLE9BQU87QUFBQSxNQUNMLEVBQUUsSUFBSSxNQUFNLE1BQU0sUUFBUSxXQUFXLE1BQU0sU0FBUztBQUFBLFFBQ2xELEVBQUUsSUFBSSxNQUFNLFdBQVcsS0FBSyxLQUFLLEVBQUUsTUFBTSxZQUFZLFVBQVUsT0FBTyxFQUFFO0FBQUEsTUFDMUUsR0FBRyxVQUFVLEVBQUUsR0FBRyxLQUFLLEdBQUcsSUFBSSxFQUFFO0FBQUEsTUFDaEMsRUFBRSxJQUFJLE1BQU0sTUFBTSxXQUFXLFdBQVcsT0FBTyxTQUFTO0FBQUEsUUFDdEQsRUFBRSxJQUFJLE1BQU0sV0FBVyxLQUFLLEtBQUssRUFBRSxNQUFNLFdBQVcsVUFBVSxPQUFPLEdBQUcsVUFBVSxLQUFLO0FBQUEsUUFDdkYsRUFBRSxJQUFJLE1BQU0sV0FBVyxLQUFLLEtBQUssRUFBRSxNQUFNLFdBQVcsVUFBVSxPQUFPLEdBQUcsVUFBVSxNQUFNO0FBQUEsTUFDMUYsR0FBRyxVQUFVLEVBQUUsR0FBRyxLQUFLLEdBQUcsSUFBSSxFQUFFO0FBQUEsTUFDaEMsRUFBRSxJQUFJLE1BQU0sTUFBTSxRQUFRLFdBQVcsT0FBTyxTQUFTO0FBQUEsUUFDbkQsRUFBRSxJQUFJLE1BQU0sV0FBVyxLQUFLLEtBQUssRUFBRSxNQUFNLFlBQVksVUFBVSxPQUFPLEVBQUU7QUFBQSxNQUMxRSxHQUFHLFVBQVUsRUFBRSxHQUFHLEtBQUssR0FBRyxJQUFJLEVBQUU7QUFBQSxJQUNsQztBQUFBLElBQ0EsYUFBYTtBQUFBLE1BQ1gsRUFBRSxJQUFJLE1BQU0sV0FBVyw4QkFBOEIsVUFBVSxHQUFHLFVBQVUsRUFBRSxHQUFHLEtBQUssR0FBRyxJQUFJLEVBQUU7QUFBQSxNQUMvRixFQUFFLElBQUksTUFBTSxXQUFXLGFBQWEsVUFBVSxHQUFHLFVBQVUsRUFBRSxHQUFHLEtBQUssR0FBRyxJQUFJLEVBQUU7QUFBQSxJQUNoRjtBQUFBLElBQ0EsT0FBTztBQUFBLE1BQ0wsRUFBRSxJQUFJLE1BQU0sTUFBTSxNQUFNLElBQUksTUFBTSxNQUFNLFNBQVM7QUFBQSxNQUNqRCxFQUFFLElBQUksTUFBTSxNQUFNLE1BQU0sSUFBSSxNQUFNLE1BQU0sU0FBUztBQUFBLE1BQ2pELEVBQUUsSUFBSSxNQUFNLE1BQU0sTUFBTSxJQUFJLE1BQU0sTUFBTSxTQUFTO0FBQUEsTUFDakQsRUFBRSxJQUFJLE1BQU0sTUFBTSxNQUFNLElBQUksTUFBTSxNQUFNLFNBQVM7QUFBQSxJQUNuRDtBQUFBLElBQ0EsVUFBVSxDQUFDO0FBQUEsSUFDWCxPQUFPLENBQUMsRUFBRSxJQUFJLE1BQU0sZ0JBQWdCLE9BQU8sQ0FBQztBQUFBLEVBQzlDO0FBQ0Y7QUFFQSxNQUFNLFdBQXVCO0FBQUEsRUFDM0IsRUFBRSxNQUFNLGVBQWUsVUFBVSxRQUFRLFNBQVMsU0FBUyxhQUFhLGVBQWU7QUFBQSxFQUN2RixFQUFFLE1BQU0sVUFBZSxVQUFVLFFBQVEsU0FBUyxTQUFTLGFBQWEsaUJBQWlCO0FBQUEsRUFDekYsRUFBRSxNQUFNLGFBQWUsVUFBVSxRQUFRLFNBQVMsU0FBUyxhQUFhLGVBQWU7QUFBQSxFQUN2RixFQUFFLE1BQU0sWUFBZSxVQUFVLFFBQVMsU0FBUyxJQUFJLGFBQWEsR0FBRztBQUFBLEVBQ3ZFLEVBQUUsTUFBTSxhQUFlLFVBQVUsUUFBUyxTQUFTLElBQUksYUFBYSxHQUFHO0FBQUEsRUFDdkUsRUFBRSxNQUFNLGVBQWUsVUFBVSxRQUFTLFNBQVMsSUFBSSxhQUFhLEdBQUc7QUFBQSxFQUN2RSxFQUFFLE1BQU0sV0FBZSxVQUFVLFFBQVMsU0FBUyxJQUFJLGFBQWEsR0FBRztBQUFBLEVBQ3ZFLEVBQUUsTUFBTSxXQUFlLFVBQVUsUUFBUyxTQUFTLElBQUksYUFBYSxHQUFHO0FBQUEsRUFDdkUsRUFBRSxNQUFNLFdBQWUsVUFBVSxRQUFTLFNBQVMsSUFBSSxhQUFhLEdBQUc7QUFBQSxFQUN2RSxFQUFFLE1BQU0sZUFBZSxVQUFVLFFBQVMsU0FBUyxJQUFJLGFBQWEsR0FBRztBQUFBLEVBQ3ZFLEVBQUUsTUFBTSxZQUFlLFVBQVUsUUFBUyxTQUFTLElBQUksYUFBYSxHQUFHO0FBQUEsRUFDdkUsRUFBRSxNQUFNLFdBQWUsVUFBVSxRQUFTLFNBQVMsSUFBSSxhQUFhLEdBQUc7QUFBQSxFQUN2RSxFQUFFLE1BQU0sV0FBZSxVQUFVLFFBQVMsU0FBUyxJQUFJLGFBQWEsR0FBRztBQUFBLEVBQ3ZFLEVBQUUsTUFBTSxZQUFlLFVBQVUsUUFBUyxTQUFTLElBQUksYUFBYSxHQUFHO0FBQ3pFO0FBSUEsUUFBUSxpREFBNEM7QUFDcEQsT0FBTyxjQUFjLE9BQU8sR0FBRyxNQUFRLE1BQU8saUJBQWlCO0FBQy9ELE9BQU8sY0FBYyxPQUFPLElBQUksTUFBTyxNQUFPLGtCQUFrQjtBQUNoRSxPQUFPLGNBQWMsT0FBTyxJQUFJLE1BQU8sT0FBTyxpQkFBaUI7QUFDL0QsT0FBTyxjQUFjLE9BQU8sSUFBSSxNQUFPLE9BQU8saUJBQWlCO0FBQy9ELE9BQU8sY0FBYyxPQUFPLEdBQUcsTUFBUSxNQUFPLGlCQUFpQjtBQUMvRCxPQUFPLGNBQWMsT0FBTyxJQUFJLE1BQU8sTUFBTyxrQkFBa0I7QUFDaEUsT0FBTyxjQUFjLE9BQU8sSUFBSSxNQUFPLE9BQU8saUJBQWlCO0FBQy9ELE9BQU8sY0FBYyxRQUFRLElBQUksTUFBTSxNQUFPLG1CQUFtQjtBQUNqRSxPQUFPLGNBQWMsUUFBUSxJQUFJLE1BQU0sTUFBTyxtQkFBbUI7QUFDakUsT0FBTyxjQUFjLE1BQU0sSUFBSSxNQUFRLE1BQU8saUJBQWlCO0FBQy9ELE9BQU8sY0FBYyxRQUFXLE1BQU0sTUFBTSxNQUFNLHdCQUF3QjtBQUMxRSxPQUFPLGNBQWMsUUFBVyxJQUFJLE1BQVEsT0FBTyxxQkFBcUI7QUFJeEUsUUFBUSxnREFBMkM7QUFDbkQsTUFBTSxNQUFNLGtCQUFrQixpQkFBaUIsR0FBRyxjQUFjLEdBQUcsY0FBYyxHQUFHLFFBQVE7QUFFNUYsT0FBTyxJQUFJLFFBQVEsVUFBVSxHQUFLLGtCQUFrQjtBQUNwRCxPQUFPLElBQUksZUFBZSxNQUFNLEVBQUUsV0FBVyxHQUFHLGNBQWM7QUFDOUQsT0FBTyxJQUFJLGVBQWUsWUFBWSxFQUFFLFVBQVUsR0FBRyx3QkFBd0I7QUFDN0UsT0FBTyxJQUFJLGVBQWUsV0FBVyxFQUFFLFdBQVcsR0FBRyx1Q0FBb0M7QUFDekYsT0FBTyxJQUFJLGVBQWUsU0FBUyxFQUFFLFNBQVMsR0FBRyx1QkFBdUI7QUFDeEUsT0FBTyxJQUFJLGVBQWUsVUFBVSxFQUFFLFdBQVcsR0FBRyxhQUFhO0FBQ2pFLE9BQU8sSUFBSSxlQUFlLGdCQUFnQixFQUFFLFdBQVcsR0FBRyxtQkFBbUI7QUFDN0UsT0FBTyxJQUFJLGVBQWUsVUFBVSxFQUFFLFdBQVcsR0FBRyxZQUFZO0FBQ2hFLE9BQU8sSUFBSSxlQUFlLFlBQVksRUFBRSxXQUFXLEdBQUcsZUFBZTtBQUNyRSxPQUFPLElBQUksZUFBZSxLQUFLLEVBQUUsVUFBVSxTQUFTLFFBQVEsaUJBQWlCO0FBRzdFLE1BQU0sV0FBVyxJQUFJLGVBQWUsWUFBWSxFQUFFLEtBQUssUUFBTTtBQUMzRCxRQUFNLElBQUksSUFBSSxZQUFpQixFQUFFO0FBQ2pDLFNBQU8sRUFBRSxpQkFBaUI7QUFDNUIsQ0FBQztBQUNELE9BQU8sQ0FBQyxDQUFDLFVBQVUsZ0NBQWdDO0FBQ25ELE1BQU0sY0FBYyxJQUFJLGtCQUFrQixVQUFXLFFBQVE7QUFDN0QsTUFBTSxhQUFhLElBQUksa0JBQWtCLFVBQVcsT0FBTztBQUMzRCxNQUFNLGdCQUFnQixZQUFZLElBQUksT0FBSyxJQUFJLFlBQWlCLEVBQUUsTUFBTSxFQUFFLElBQUk7QUFDOUUsTUFBTSxlQUFlLFdBQVcsSUFBSSxPQUFLLElBQUksWUFBaUIsRUFBRSxNQUFNLEVBQUUsSUFBSTtBQUM1RSxPQUFPLGNBQWMsU0FBUyxXQUFXLEdBQUcsZ0NBQTJCO0FBQ3ZFLE9BQU8sY0FBYyxTQUFTLGFBQWEsR0FBRyxtQ0FBOEI7QUFDNUUsT0FBTyxhQUFhLFNBQVMsV0FBVyxHQUFHLGdDQUEyQjtBQUl0RSxRQUFRLHlEQUFvRDtBQUM1RCxNQUFNLFNBQVMsWUFBWSxHQUFHO0FBQzlCLE1BQU0sWUFBWSxPQUFPLE9BQU8sT0FBSyxFQUFFLGFBQWEsZUFBZSxFQUFFLFFBQVEsU0FBUyxLQUFLLENBQUM7QUFDNUYsUUFBUSxJQUFJLHNCQUFzQixPQUFPLE1BQU0saUJBQWlCO0FBQ2hFLElBQUksT0FBTyxTQUFTLEVBQUcsUUFBTyxRQUFRLE9BQUssUUFBUSxJQUFJLFFBQVEsRUFBRSxRQUFRLEtBQUssRUFBRSxPQUFPLEVBQUUsQ0FBQztBQUUxRixNQUFNLGVBQWUsVUFBVSxPQUFPLE9BQUssRUFBRSxRQUFRLFNBQVMsV0FBVyxDQUFDO0FBQzFFLE9BQU8sYUFBYSxXQUFXLEdBQUcsaUVBQWlFO0FBRW5HLE1BQU0sYUFBYSxVQUFVLE9BQU8sT0FBSyxFQUFFLGFBQWEsT0FBTztBQUMvRCxPQUFPLFdBQVcsV0FBVyxHQUFHLGlEQUFpRDtBQUdqRixNQUFNLFNBQXFCLEVBQUUsT0FBTztBQUFBLEVBQ2xDLEVBQUUsSUFBSSxNQUFNLE1BQU0sS0FBSyxXQUFXLE9BQU8sU0FBUyxDQUFDLEdBQUcsVUFBVSxFQUFFLEdBQUcsR0FBRyxHQUFHLEVBQUUsRUFBRTtBQUNqRixHQUFHLGFBQWEsQ0FBQyxHQUFHLE9BQU8sQ0FBQyxHQUFHLFVBQVUsQ0FBQyxHQUFHLE9BQU8sQ0FBQyxFQUFFO0FBQ3ZELE1BQU0sU0FBUyxrQkFBa0IsRUFBRSxPQUFPLENBQUMsRUFBRSxHQUFHLEVBQUUsT0FBTyxDQUFDLEdBQUcsT0FBTyxDQUFDLEVBQUUsR0FBRyxRQUFRLENBQUMsQ0FBQztBQUNwRixNQUFNLFlBQVksWUFBWSxNQUFNLEVBQUUsT0FBTyxPQUFLLEVBQUUsUUFBUSxTQUFTLFNBQVMsQ0FBQztBQUMvRSxPQUFPLFVBQVUsU0FBUyxHQUFHLGtDQUFrQztBQUcvRCxNQUFNLG1CQUFrQyxFQUFFLE9BQU87QUFBQSxFQUMvQyxFQUFFLElBQUksTUFBTSxRQUFRLEdBQUcsU0FBUyxJQUFJLFVBQVU7QUFBQSxJQUM1QyxFQUFFLE1BQU0sV0FBVyxJQUFJLE1BQU0sTUFBTSxNQUFNLEtBQUssRUFBRSxNQUFNLEtBQUssVUFBVSxPQUFPLEdBQUcsVUFBVSxFQUFFLEdBQUcsR0FBRyxHQUFHLEVBQUUsRUFBRTtBQUFBLElBQ3hHLEVBQUUsTUFBTSxRQUFRLElBQUksT0FBTyxNQUFNLFVBQVUsS0FBSyxFQUFFLE1BQU0sS0FBSyxVQUFVLE9BQU8sR0FBRyxVQUFVLEVBQUUsR0FBRyxLQUFLLEdBQUcsRUFBRSxFQUFFO0FBQUEsRUFDOUcsR0FBRyxVQUFVLENBQUMsRUFBRTtBQUFBLEVBQ2hCLEVBQUUsSUFBSSxNQUFNLFFBQVEsR0FBRyxTQUFTLElBQUksVUFBVTtBQUFBLElBQzVDLEVBQUUsTUFBTSxXQUFXLElBQUksTUFBTSxNQUFNLE1BQU0sS0FBSyxFQUFFLE1BQU0sS0FBSyxVQUFVLE9BQU8sR0FBRyxVQUFVLEVBQUUsR0FBRyxHQUFHLEdBQUcsRUFBRSxFQUFFO0FBQUEsSUFDeEcsRUFBRSxNQUFNLFFBQVEsSUFBSSxPQUFPLE1BQU0sVUFBVSxLQUFLLEVBQUUsTUFBTSxLQUFLLFVBQVUsT0FBTyxHQUFHLFVBQVUsRUFBRSxHQUFHLEtBQUssR0FBRyxFQUFFLEVBQUU7QUFBQSxFQUM5RyxHQUFHLFVBQVUsQ0FBQyxFQUFFO0FBQ2xCLEVBQUM7QUFDRCxNQUFNLFFBQVEsa0JBQWtCLGtCQUFrQixFQUFFLE9BQU8sQ0FBQyxHQUFHLE9BQU8sQ0FBQyxFQUFFLEdBQUcsRUFBRSxPQUFPLENBQUMsR0FBRyxhQUFhLENBQUMsR0FBRyxPQUFPLENBQUMsR0FBRyxVQUFVLENBQUMsR0FBRyxPQUFPLENBQUMsRUFBRSxHQUFHLENBQUMsQ0FBQztBQUNsSixNQUFNLFdBQVcsWUFBWSxLQUFLLEVBQUUsT0FBTyxPQUFLLEVBQUUsUUFBUSxTQUFTLGFBQWEsQ0FBQztBQUNqRixPQUFPLFNBQVMsVUFBVSxHQUFHLDBDQUEwQztBQUl2RSxRQUFRLCtEQUEwRDtBQUNsRSxNQUFNLFNBQVMscUJBQXFCLEdBQUc7QUFDdkMsT0FBTyxPQUFPLE1BQU0sV0FBVyxHQUFHLGtCQUFrQjtBQUNwRCxPQUFPLE9BQU8sTUFBTSxDQUFDLEVBQUUsV0FBVyxHQUFHLGtDQUFrQztBQUV2RSxNQUFNLFdBQVcsT0FBTyxNQUFNLENBQUMsRUFBRTtBQUNqQyxTQUFTLElBQUksR0FBRyxJQUFJLFNBQVMsUUFBUSxLQUFLO0FBQ3hDLFFBQU0sT0FBUSxTQUFTLElBQUksQ0FBQyxFQUFFLFVBQVUsS0FBSztBQUM3QyxRQUFNLE9BQVEsU0FBUyxDQUFDLEVBQUUsVUFBVSxLQUFLO0FBQ3pDLFNBQU8sUUFBUSxNQUFNLDBCQUEwQixJQUFJLE9BQU8sSUFBSSxFQUFFO0FBQ2xFO0FBQ0EsT0FBTyxPQUFPLE1BQU0sQ0FBQyxFQUFFLFNBQVMsV0FBVyxHQUFHLGdDQUFnQztBQUU5RSxPQUFPLE9BQU8sTUFBTSxDQUFDLEVBQUUsU0FBUyxDQUFDLEVBQUUsZ0JBQWdCLElBQUksMkNBQTJDO0FBRWxHLE1BQU0sTUFBTSxrQkFBa0IsR0FBRztBQUNqQyxPQUFPLElBQUksTUFBTSxXQUFXLEdBQUcsc0JBQXNCO0FBQ3JELE9BQU8sSUFBSSxNQUFNLFdBQVcsR0FBRyxzQkFBc0I7QUFFckQsTUFBTSxNQUFNLGtCQUFrQixHQUFHO0FBQ2pDLE9BQU8sSUFBSSxNQUFNLFdBQVcsR0FBRyxzQkFBc0I7QUFDckQsT0FBTyxJQUFJLFlBQVksV0FBVyxHQUFHLHdCQUF3QjtBQUM3RCxPQUFPLElBQUksTUFBTSxXQUFXLEdBQUcsc0JBQXNCO0FBQ3JELE9BQVEsSUFBWSxPQUFPLFdBQVcsR0FBRyw2QkFBNkI7QUFFdEUsTUFBTSxPQUFPLG1CQUFtQixHQUFHO0FBQ25DLE9BQU8sS0FBSyxVQUFVLFNBQVMsUUFBUSw0QkFBNEI7QUFDbkUsTUFBTSxZQUFZLEtBQUssS0FBSyxPQUFLLEVBQUUsU0FBUyxXQUFXO0FBQ3ZELE9BQU8sQ0FBQyxDQUFDLFdBQVcsNkJBQTZCO0FBQ2pELE9BQU8sWUFBWSxXQUFZLHNCQUFzQjtBQUNyRCxPQUFPLGtCQUFrQixXQUFZLDRCQUE0QjtBQUlqRSxRQUFRLGtDQUE2QjtBQUNyQyxNQUFNLFNBQVMsUUFBUSxHQUFHO0FBQzFCLE9BQU8sT0FBTyxPQUFPLFNBQVMsZUFBZSxHQUFHLHVCQUF1QjtBQUN2RSxPQUFPLE9BQU8sT0FBTyxTQUFTLElBQUksR0FBRyxtQ0FBbUM7QUFDeEUsT0FBTyxPQUFPLE9BQU8sU0FBUyxXQUFXLEdBQUcsZ0NBQWdDO0FBQzVFLE9BQU8sT0FBTyxPQUFPLFNBQVMsV0FBVyxHQUFHLHVDQUF1QztBQUNuRixPQUFPLE9BQU8sT0FBTyxTQUFTLHlCQUF5QixHQUFHLGlDQUFpQztBQUMzRixPQUFPLE9BQU8sT0FBTyxTQUFTLGlCQUFpQixHQUFHLDRCQUE0QjtBQUM5RSxPQUFPLE9BQU8sT0FBTyxTQUFTLGlCQUFpQixHQUFHLGlDQUFpQztBQUNuRixPQUFPLE9BQU8sT0FBTyxTQUFTLFdBQVcsR0FBRyx3Q0FBd0M7QUFDcEYsT0FBTyxPQUFPLE9BQU8sU0FBUyxNQUFNLEdBQUcsb0NBQW9DO0FBRTNFLE9BQU8sQ0FBQyxPQUFPLE9BQU8sU0FBUyx3Q0FBd0MsR0FBRyx1Q0FBdUM7QUFDakgsT0FBTyxPQUFPLE9BQU8sU0FBUyxZQUFZLEdBQUcsOENBQThDO0FBQzNGLE9BQU8sT0FBTyxPQUFPLFNBQVMsU0FBUyxLQUFLLE9BQU8sT0FBTyxTQUFTLFNBQVMsR0FBRywyQkFBMkI7QUFDMUcsUUFBUSxJQUFJLG1DQUFtQyxPQUFPLE9BQU8sTUFBTSxHQUFHLEdBQUcsQ0FBQztBQUkxRSxRQUFRLHdFQUFtRTtBQUMzRSxTQUFTLFdBQVcsaUJBQWlCLEdBQUcsY0FBYyxHQUFHLGNBQWMsR0FBRyxRQUFRO0FBQ2xGLE9BQU8sU0FBUyxhQUFhLHNCQUFzQjtBQUduRCxNQUFNLFlBQVksU0FBUyxjQUFjO0FBQ3pDLE1BQU0sV0FBVyxVQUFVLFlBQVksS0FBSyxPQUFLLEVBQUUsT0FBTyxJQUFJO0FBQzlELE9BQU8sVUFBVSxXQUFXLFNBQVMsYUFBYSxHQUFHLDhDQUE4QztBQUVuRyxTQUFTLFVBQVUsZUFBZSxVQUFVO0FBRTVDLE1BQU0sV0FBVyxTQUFTLGNBQWM7QUFDeEMsTUFBTSxVQUFVLFNBQVMsWUFBWSxLQUFLLE9BQUssRUFBRSxPQUFPLElBQUk7QUFDNUQsT0FBTyxTQUFTLFdBQVcsU0FBUyxVQUFVLEdBQUcsNENBQTRDO0FBQzdGLE9BQU8sQ0FBQyxTQUFTLFdBQVcsU0FBUyxhQUFhLEdBQUcsaUNBQWlDO0FBSXRGLFFBQVEsd0NBQXdDO0FBQ2hELE1BQU0sY0FBYyxTQUFTLGNBQWMsRUFBRSxPQUFPLFVBQVU7QUFDOUQsU0FBUyxXQUFXLEVBQUUsSUFBSSxhQUFhLGdCQUFnQixVQUFVLENBQUM7QUFDbEUsTUFBTSxjQUFjLFNBQVMsY0FBYztBQUMzQyxRQUFRLFlBQVksT0FBTyxVQUFVLE9BQU8sY0FBYyxHQUFHLFlBQVk7QUFDekUsT0FBTyxZQUFZLE9BQU8sS0FBSyxPQUFLLEVBQUUsbUJBQW1CLFNBQVMsR0FBRyx5QkFBeUI7QUFFOUYsU0FBUyxjQUFjLFdBQVc7QUFDbEMsTUFBTSxpQkFBaUIsU0FBUyxjQUFjO0FBQzlDLFFBQVEsZUFBZSxPQUFPLFVBQVUsT0FBTyxhQUFhLGNBQWM7QUFJMUUsUUFBUSxpREFBNEM7QUFDcEQsTUFBTSxLQUFLLElBQUksU0FBUztBQUN4QixHQUFHLFFBQVEsVUFBVSxPQUFPLFVBQVUsRUFBRSxNQUFNLEtBQUssVUFBVSxRQUFRLE9BQU8sU0FBUyxDQUFDO0FBQ3RGLE1BQU0sT0FBTyxHQUFHLE9BQU8sVUFBVTtBQUVqQyxHQUFHLFFBQVEsVUFBVSxPQUFPLFVBQVUsRUFBRSxNQUFNLEtBQUssVUFBVSxRQUFRLE9BQU8sU0FBUyxDQUFDO0FBQ3RGLE9BQU8sR0FBRyxjQUFjLEdBQUcsd0JBQXdCO0FBQ25ELEdBQUcsT0FBTyxJQUFJO0FBQ2QsT0FBTyxHQUFHLGNBQWMsR0FBRyx1RUFBdUU7QUFDbEcsT0FBTyxHQUFHLFFBQVEsUUFBUSxHQUFHLDZCQUE2QjtBQUMxRCxPQUFPLENBQUMsR0FBRyxRQUFRLFFBQVEsR0FBRywwQkFBMEI7QUFJeEQsUUFBUSxJQUFJLHVDQUFrQzsiLAogICJuYW1lcyI6IFtdCn0K
