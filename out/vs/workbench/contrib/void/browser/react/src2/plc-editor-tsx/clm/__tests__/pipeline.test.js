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
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvY29udHJpYi92b2lkL2Jyb3dzZXIvcmVhY3Qvc3JjMi9wbGMtZWRpdG9yLXRzeC9jbG0vX190ZXN0c19fL3BpcGVsaW5lLnRlc3QudHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbIi8qKlxuICogQ0xNIFBpcGVsaW5lIEludGVncmF0aW9uIFRlc3RzXG4gKiBUZXN0cyBldmVyeSBmaXhlZCBwYXRoOlxuICogICAxLiBidWlsZGVyIFx1MjAxNCBtdWx0aS1QT1UsIEZCIG91dHB1dCBwaW4gaGV1cmlzdGljXG4gKiAgIDIuIHZhbGlkYXRvciBcdTIwMTQgZGVhZC1jb2RlIHJlbW92YWwsIFNGQyBzdHJ1Y3R1cmFsIHZhbGlkYXRpb25cbiAqICAgMy4gcHJvamVjdGlvbnMgXHUyMDE0IGVsZW1lbnQgb3JkZXIsIFNGQyBicmFuY2hlcywgdGFnIGZpZWxkc1xuICogICA0LiBjbG1Ub1NUIFx1MjAxNCBGQkQgZm9sZGluZywgU0ZDIHRpbWVkIHF1YWxpZmllcnMsIExEIGZiX2NhbGwgcGluc1xuICogICA1LiBjbG1TdG9yZSBcdTIwMTQgc3luYyBicmlkZ2UsIHJlbmFtZVRhZyBwcm9wYWdhdGlvbiwgYWRkU0ZDSnVtcC9kZWxldGVTRkNKdW1wXG4gKiAgIDYuIGdyYXBoIFx1MjAxNCBjbGVhciBvbiBpbXBvcnRcbiAqXG4gKiBSdW4gd2l0aDogbnB4IHRzeCBfX3Rlc3RzX18vcGlwZWxpbmUudGVzdC50c1xuICovXG5cbmltcG9ydCB7IGJ1aWxkQ0xNRnJvbVN0b3JlLCBpc0ZCT3V0cHV0UGluIH0gZnJvbSAnLi4vYnVpbGRlci5qcyc7XG5pbXBvcnQgeyB2YWxpZGF0ZUNMTSB9IGZyb20gJy4uL3ZhbGlkYXRvci5qcyc7XG5pbXBvcnQgeyBwcm9qZWN0TGFkZGVyUHJvZ3JhbSwgcHJvamVjdEZCRFByb2dyYW0sIHByb2plY3RTRkNQcm9ncmFtLCBwcm9qZWN0VGFnRGF0YWJhc2UgfSBmcm9tICcuLi9wcm9qZWN0aW9ucy5qcyc7XG5pbXBvcnQgeyBjbG1Ub1NUIH0gZnJvbSAnLi4vY2xtVG9TVC5qcyc7XG5pbXBvcnQgeyBjbG1TdG9yZSB9IGZyb20gJy4uL2NsbVN0b3JlLmpzJztcbmltcG9ydCB7IENMTUdyYXBoIH0gZnJvbSAnLi4vZ3JhcGguanMnO1xuaW1wb3J0IHR5cGUgeyBMYWRkZXJQcm9ncmFtLCBGQkRQcm9ncmFtLCBTRkNQcm9ncmFtLCBUYWdFbnRyeSB9IGZyb20gJy4uLy4uL2xvZ2ljU3RvcmUuanMnO1xuXG4vLyBcdTI1MDBcdTI1MDBcdTI1MDAgSGVscGVycyBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcblxuZnVuY3Rpb24gYXNzZXJ0KGNvbmQ6IGJvb2xlYW4sIG1zZzogc3RyaW5nKTogdm9pZCB7XG4gIGlmICghY29uZCkgdGhyb3cgbmV3IEVycm9yKGBGQUlMOiAke21zZ31gKTtcbiAgY29uc29sZS5sb2coYCAgXHUyNzEzICR7bXNnfWApO1xufVxuXG5mdW5jdGlvbiBzZWN0aW9uKG5hbWU6IHN0cmluZykge1xuICBjb25zb2xlLmxvZyhgXFxuXHUyNTAxXHUyNTAxXHUyNTAxICR7bmFtZX0gXHUyNTAxXHUyNTAxXHUyNTAxYCk7XG59XG5cbi8vIFx1MjUwMFx1MjUwMFx1MjUwMCBUZXN0IGRhdGEgZmFjdG9yaWVzIFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFxuXG5mdW5jdGlvbiBtYWtlU2ltcGxlTGFkZGVyKCk6IExhZGRlclByb2dyYW0ge1xuICByZXR1cm4ge1xuICAgIHJ1bmdzOiBbXG4gICAgICB7XG4gICAgICAgIGlkOiAncnVuZzEnLCBudW1iZXI6IDEsIGNvbW1lbnQ6ICdTdGFydCBsb2dpYycsXG4gICAgICAgIGVsZW1lbnRzOiBbXG4gICAgICAgICAgeyBraW5kOiAnY29udGFjdCcsIGlkOiAnZTEnLCB0eXBlOiAnTk8nLCB0YWc6IHsgbmFtZTogJ01vdG9yX1N0YXJ0JywgZGF0YVR5cGU6ICdCT09MJyB9LCBwb3NpdGlvbjogeyB4OiAxMDAsIHk6IDAgfSB9LFxuICAgICAgICAgIHsga2luZDogJ2NvbnRhY3QnLCBpZDogJ2UyJywgdHlwZTogJ05DJywgdGFnOiB7IG5hbWU6ICdFX1N0b3AnLCBkYXRhVHlwZTogJ0JPT0wnIH0sIHBvc2l0aW9uOiB7IHg6IDIwMCwgeTogMCB9IH0sXG4gICAgICAgICAgeyBraW5kOiAnY29pbCcsICAgaWQ6ICdlMycsIHR5cGU6ICdub3JtYWwnLCB0YWc6IHsgbmFtZTogJ01vdG9yX1J1bicsIGRhdGFUeXBlOiAnQk9PTCcgfSwgcG9zaXRpb246IHsgeDogNDAwLCB5OiAwIH0gfSxcbiAgICAgICAgXSxcbiAgICAgICAgYnJhbmNoZXM6IFtcbiAgICAgICAgICB7XG4gICAgICAgICAgICBpZDogJ2JyMScsIHN0YXJ0Tm9kZUlkOiAnZTEnLCBlbmROb2RlSWQ6ICdlMicsXG4gICAgICAgICAgICBlbGVtZW50czogW1xuICAgICAgICAgICAgICB7IGtpbmQ6ICdjb250YWN0JywgaWQ6ICdlNCcsIHR5cGU6ICdOTycsIHRhZzogeyBuYW1lOiAnTW90b3JfUnVuJywgZGF0YVR5cGU6ICdCT09MJyB9LCBwb3NpdGlvbjogeyB4OiAxNTAsIHk6IDUwIH0gfSxcbiAgICAgICAgICAgIF0sXG4gICAgICAgICAgfSxcbiAgICAgICAgXSxcbiAgICAgIH0sXG4gICAgICB7XG4gICAgICAgIGlkOiAncnVuZzInLCBudW1iZXI6IDIsIGNvbW1lbnQ6ICdUT04gdGltZXInLFxuICAgICAgICBlbGVtZW50czogW1xuICAgICAgICAgIHsga2luZDogJ2NvbnRhY3QnLCBpZDogJ2U1JywgdHlwZTogJ05PJywgdGFnOiB7IG5hbWU6ICdNb3Rvcl9SdW4nLCBkYXRhVHlwZTogJ0JPT0wnIH0sIHBvc2l0aW9uOiB7IHg6IDEwMCwgeTogMCB9IH0sXG4gICAgICAgICAge1xuICAgICAgICAgICAga2luZDogJ2Jsb2NrJywgaWQ6ICdlNicsIGZiVHlwZTogJ1RPTicsIGluc3RhbmNlTmFtZTogJ1J1blRpbWVyJyxcbiAgICAgICAgICAgIHBpbnM6IHsgSU46IHsgbmFtZTogJ01vdG9yX1J1bicsIGRhdGFUeXBlOiAnQk9PTCcgfSwgUFQ6IHsgbmFtZTogJ1J1bkRlbGF5JywgZGF0YVR5cGU6ICdUSU1FJyB9LCBROiB7IG5hbWU6ICdUaW1lckRvbmUnLCBkYXRhVHlwZTogJ0JPT0wnIH0sIEVUOiB7IG5hbWU6ICdFbGFwc2VkVGltZScsIGRhdGFUeXBlOiAnVElNRScgfSB9LFxuICAgICAgICAgICAgcG9zaXRpb246IHsgeDogMzAwLCB5OiAwIH0sXG4gICAgICAgICAgfSxcbiAgICAgICAgXSxcbiAgICAgICAgYnJhbmNoZXM6IFtdLFxuICAgICAgfSxcbiAgICBdLFxuICB9O1xufVxuXG5mdW5jdGlvbiBtYWtlU2ltcGxlRkJEKCk6IEZCRFByb2dyYW0ge1xuICByZXR1cm4ge1xuICAgIG5vZGVzOiBbXG4gICAgICB7XG4gICAgICAgIGlkOiAnbjEnLCB0eXBlOiAnSU5fVkFSSUFCTEUnLCBpbnN0YW5jZU5hbWU6ICcnLCBsYWJlbDogJycsIGNvbnRlbnQ6ICcnLFxuICAgICAgICBwb3NpdGlvbjogeyB4OiA1MCwgeTogMTAwIH0sIHNpemU6IHsgd2lkdGg6IDgwLCBoZWlnaHQ6IDQwIH0sXG4gICAgICAgIGlucHV0czogW10sIG91dHB1dHM6IFt7IGlkOiAnbjEtb3V0JywgbmFtZTogJ09VVCcsIGRhdGFUeXBlOiAnQk9PTCcsIG5lZ2F0ZWQ6IGZhbHNlIH1dLFxuICAgICAgICB0YWc6IHsgbmFtZTogJ1NlbnNvckEnLCBkYXRhVHlwZTogJ0JPT0wnIH0sXG4gICAgICB9LFxuICAgICAge1xuICAgICAgICBpZDogJ24yJywgdHlwZTogJ0lOX1ZBUklBQkxFJywgaW5zdGFuY2VOYW1lOiAnJywgbGFiZWw6ICcnLCBjb250ZW50OiAnJyxcbiAgICAgICAgcG9zaXRpb246IHsgeDogNTAsIHk6IDIwMCB9LCBzaXplOiB7IHdpZHRoOiA4MCwgaGVpZ2h0OiA0MCB9LFxuICAgICAgICBpbnB1dHM6IFtdLCBvdXRwdXRzOiBbeyBpZDogJ24yLW91dCcsIG5hbWU6ICdPVVQnLCBkYXRhVHlwZTogJ0JPT0wnLCBuZWdhdGVkOiBmYWxzZSB9XSxcbiAgICAgICAgdGFnOiB7IG5hbWU6ICdTZW5zb3JCJywgZGF0YVR5cGU6ICdCT09MJyB9LFxuICAgICAgfSxcbiAgICAgIHtcbiAgICAgICAgaWQ6ICduMycsIHR5cGU6ICdBTkQnLCBpbnN0YW5jZU5hbWU6ICcnLCBsYWJlbDogJycsIGNvbnRlbnQ6ICcnLFxuICAgICAgICBwb3NpdGlvbjogeyB4OiAyMDAsIHk6IDE1MCB9LCBzaXplOiB7IHdpZHRoOiA2MCwgaGVpZ2h0OiA2MCB9LFxuICAgICAgICBpbnB1dHM6IFtcbiAgICAgICAgICB7IGlkOiAnbjMtaW4xJywgbmFtZTogJ0lOMScsIGRhdGFUeXBlOiAnQk9PTCcsIG5lZ2F0ZWQ6IGZhbHNlIH0sXG4gICAgICAgICAgeyBpZDogJ24zLWluMicsIG5hbWU6ICdJTjInLCBkYXRhVHlwZTogJ0JPT0wnLCBuZWdhdGVkOiBmYWxzZSB9LFxuICAgICAgICBdLFxuICAgICAgICBvdXRwdXRzOiBbeyBpZDogJ24zLW91dCcsIG5hbWU6ICdPVVQnLCBkYXRhVHlwZTogJ0JPT0wnLCBuZWdhdGVkOiBmYWxzZSB9XSxcbiAgICAgIH0sXG4gICAgICB7XG4gICAgICAgIGlkOiAnbjQnLCB0eXBlOiAnT1VUX1ZBUklBQkxFJywgaW5zdGFuY2VOYW1lOiAnJywgbGFiZWw6ICcnLCBjb250ZW50OiAnJyxcbiAgICAgICAgcG9zaXRpb246IHsgeDogMzUwLCB5OiAxNTAgfSwgc2l6ZTogeyB3aWR0aDogODAsIGhlaWdodDogNDAgfSxcbiAgICAgICAgaW5wdXRzOiBbeyBpZDogJ240LWluJywgbmFtZTogJ0lOJywgZGF0YVR5cGU6ICdCT09MJywgbmVnYXRlZDogZmFsc2UgfV0sIG91dHB1dHM6IFtdLFxuICAgICAgICB0YWc6IHsgbmFtZTogJ091dHB1dFknLCBkYXRhVHlwZTogJ0JPT0wnIH0sXG4gICAgICB9LFxuICAgIF0sXG4gICAgd2lyZXM6IFtcbiAgICAgIHsgaWQ6ICd3MScsIGZyb206IHsgbm9kZUlkOiAnbjEnLCBwaW46ICdPVVQnIH0sIHRvOiB7IG5vZGVJZDogJ24zJywgcGluOiAnSU4xJyB9LCBuZWdhdGVkOiBmYWxzZSB9LFxuICAgICAgeyBpZDogJ3cyJywgZnJvbTogeyBub2RlSWQ6ICduMicsIHBpbjogJ09VVCcgfSwgdG86IHsgbm9kZUlkOiAnbjMnLCBwaW46ICdJTjInIH0sIG5lZ2F0ZWQ6IGZhbHNlIH0sXG4gICAgICB7IGlkOiAndzMnLCBmcm9tOiB7IG5vZGVJZDogJ24zJywgcGluOiAnT1VUJyB9LCB0bzogeyBub2RlSWQ6ICduNCcsIHBpbjogJ0lOJyB9LCBuZWdhdGVkOiBmYWxzZSB9LFxuICAgIF0sXG4gIH07XG59XG5cbmZ1bmN0aW9uIG1ha2VTaW1wbGVTRkMoKTogU0ZDUHJvZ3JhbSB7XG4gIHJldHVybiB7XG4gICAgc3RlcHM6IFtcbiAgICAgIHsgaWQ6ICdzMScsIG5hbWU6ICdJbml0JywgaXNJbml0aWFsOiB0cnVlLCBhY3Rpb25zOiBbXG4gICAgICAgIHsgaWQ6ICdhMScsIHF1YWxpZmllcjogJ04nLCB0YWc6IHsgbmFtZTogJ0luaXREb25lJywgZGF0YVR5cGU6ICdCT09MJyB9IH0sXG4gICAgICBdLCBwb3NpdGlvbjogeyB4OiAyMDAsIHk6IDEwMCB9IH0sXG4gICAgICB7IGlkOiAnczInLCBuYW1lOiAnUnVubmluZycsIGlzSW5pdGlhbDogZmFsc2UsIGFjdGlvbnM6IFtcbiAgICAgICAgeyBpZDogJ2EyJywgcXVhbGlmaWVyOiAnTCcsIHRhZzogeyBuYW1lOiAnTW90b3JPbicsIGRhdGFUeXBlOiAnQk9PTCcgfSwgZHVyYXRpb246ICc1cycgfSxcbiAgICAgICAgeyBpZDogJ2EzJywgcXVhbGlmaWVyOiAnRCcsIHRhZzogeyBuYW1lOiAnQWxhcm1PbicsIGRhdGFUeXBlOiAnQk9PTCcgfSwgZHVyYXRpb246ICcxMHMnIH0sXG4gICAgICBdLCBwb3NpdGlvbjogeyB4OiAyMDAsIHk6IDMwMCB9IH0sXG4gICAgICB7IGlkOiAnczMnLCBuYW1lOiAnU3RvcCcsIGlzSW5pdGlhbDogZmFsc2UsIGFjdGlvbnM6IFtcbiAgICAgICAgeyBpZDogJ2E0JywgcXVhbGlmaWVyOiAnUycsIHRhZzogeyBuYW1lOiAnU3RvcEZsYWcnLCBkYXRhVHlwZTogJ0JPT0wnIH0gfSxcbiAgICAgIF0sIHBvc2l0aW9uOiB7IHg6IDIwMCwgeTogNTAwIH0gfSxcbiAgICBdLFxuICAgIHRyYW5zaXRpb25zOiBbXG4gICAgICB7IGlkOiAndDEnLCBjb25kaXRpb246ICdTdGFydEJ1dHRvbiBBTkQgTk9UIEVfU3RvcCcsIHByaW9yaXR5OiAxLCBwb3NpdGlvbjogeyB4OiAyMDAsIHk6IDIwMCB9IH0sXG4gICAgICB7IGlkOiAndDInLCBjb25kaXRpb246ICdUaW1lckRvbmUnLCBwcmlvcml0eTogMSwgcG9zaXRpb246IHsgeDogMjAwLCB5OiA0MDAgfSB9LFxuICAgIF0sXG4gICAgbGlua3M6IFtcbiAgICAgIHsgaWQ6ICdsMScsIGZyb206ICdzMScsIHRvOiAndDEnLCB0eXBlOiAnc2ltcGxlJyB9LFxuICAgICAgeyBpZDogJ2wyJywgZnJvbTogJ3QxJywgdG86ICdzMicsIHR5cGU6ICdzaW1wbGUnIH0sXG4gICAgICB7IGlkOiAnbDMnLCBmcm9tOiAnczInLCB0bzogJ3QyJywgdHlwZTogJ3NpbXBsZScgfSxcbiAgICAgIHsgaWQ6ICdsNCcsIGZyb206ICd0MicsIHRvOiAnczMnLCB0eXBlOiAnc2ltcGxlJyB9LFxuICAgIF0sXG4gICAgYnJhbmNoZXM6IFtdLFxuICAgIGp1bXBzOiBbeyBpZDogJ2oxJywgdGFyZ2V0U3RlcE5hbWU6ICdJbml0JyB9XSxcbiAgfTtcbn1cblxuY29uc3QgYmFzZVRhZ3M6IFRhZ0VudHJ5W10gPSBbXG4gIHsgbmFtZTogJ01vdG9yX1N0YXJ0JywgZGF0YVR5cGU6ICdCT09MJywgYWRkcmVzczogJyVJMC4wJywgZGVzY3JpcHRpb246ICdTdGFydCBidXR0b24nIH0sXG4gIHsgbmFtZTogJ0VfU3RvcCcsICAgICAgZGF0YVR5cGU6ICdCT09MJywgYWRkcmVzczogJyVJMC4xJywgZGVzY3JpcHRpb246ICdFbWVyZ2VuY3kgc3RvcCcgfSxcbiAgeyBuYW1lOiAnTW90b3JfUnVuJywgICBkYXRhVHlwZTogJ0JPT0wnLCBhZGRyZXNzOiAnJVEwLjAnLCBkZXNjcmlwdGlvbjogJ01vdG9yIG91dHB1dCcgfSxcbiAgeyBuYW1lOiAnUnVuRGVsYXknLCAgICBkYXRhVHlwZTogJ1RJTUUnLCAgYWRkcmVzczogJycsIGRlc2NyaXB0aW9uOiAnJyB9LFxuICB7IG5hbWU6ICdUaW1lckRvbmUnLCAgIGRhdGFUeXBlOiAnQk9PTCcsICBhZGRyZXNzOiAnJywgZGVzY3JpcHRpb246ICcnIH0sXG4gIHsgbmFtZTogJ0VsYXBzZWRUaW1lJywgZGF0YVR5cGU6ICdUSU1FJywgIGFkZHJlc3M6ICcnLCBkZXNjcmlwdGlvbjogJycgfSxcbiAgeyBuYW1lOiAnU2Vuc29yQScsICAgICBkYXRhVHlwZTogJ0JPT0wnLCAgYWRkcmVzczogJycsIGRlc2NyaXB0aW9uOiAnJyB9LFxuICB7IG5hbWU6ICdTZW5zb3JCJywgICAgIGRhdGFUeXBlOiAnQk9PTCcsICBhZGRyZXNzOiAnJywgZGVzY3JpcHRpb246ICcnIH0sXG4gIHsgbmFtZTogJ091dHB1dFknLCAgICAgZGF0YVR5cGU6ICdCT09MJywgIGFkZHJlc3M6ICcnLCBkZXNjcmlwdGlvbjogJycgfSxcbiAgeyBuYW1lOiAnU3RhcnRCdXR0b24nLCBkYXRhVHlwZTogJ0JPT0wnLCAgYWRkcmVzczogJycsIGRlc2NyaXB0aW9uOiAnJyB9LFxuICB7IG5hbWU6ICdJbml0RG9uZScsICAgIGRhdGFUeXBlOiAnQk9PTCcsICBhZGRyZXNzOiAnJywgZGVzY3JpcHRpb246ICcnIH0sXG4gIHsgbmFtZTogJ01vdG9yT24nLCAgICAgZGF0YVR5cGU6ICdCT09MJywgIGFkZHJlc3M6ICcnLCBkZXNjcmlwdGlvbjogJycgfSxcbiAgeyBuYW1lOiAnQWxhcm1PbicsICAgICBkYXRhVHlwZTogJ0JPT0wnLCAgYWRkcmVzczogJycsIGRlc2NyaXB0aW9uOiAnJyB9LFxuICB7IG5hbWU6ICdTdG9wRmxhZycsICAgIGRhdGFUeXBlOiAnQk9PTCcsICBhZGRyZXNzOiAnJywgZGVzY3JpcHRpb246ICcnIH0sXG5dO1xuXG4vLyBcdTI1MDBcdTI1MDBcdTI1MDAgVGVzdCAxOiBpc0ZCT3V0cHV0UGluIFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFxuXG5zZWN0aW9uKCcxLiBpc0ZCT3V0cHV0UGluIFx1MjAxNCBGQiBvdXRwdXQgcGluIGhldXJpc3RpYycpO1xuYXNzZXJ0KGlzRkJPdXRwdXRQaW4oJ1RPTicsICdRJykgICA9PT0gdHJ1ZSwgICdUT04gUSBpcyBvdXRwdXQnKTtcbmFzc2VydChpc0ZCT3V0cHV0UGluKCdUT04nLCAnRVQnKSAgPT09IHRydWUsICAnVE9OIEVUIGlzIG91dHB1dCcpO1xuYXNzZXJ0KGlzRkJPdXRwdXRQaW4oJ1RPTicsICdJTicpICA9PT0gZmFsc2UsICdUT04gSU4gaXMgaW5wdXQnKTtcbmFzc2VydChpc0ZCT3V0cHV0UGluKCdUT04nLCAnUFQnKSAgPT09IGZhbHNlLCAnVE9OIFBUIGlzIGlucHV0Jyk7XG5hc3NlcnQoaXNGQk91dHB1dFBpbignQ1RVJywgJ1EnKSAgID09PSB0cnVlLCAgJ0NUVSBRIGlzIG91dHB1dCcpO1xuYXNzZXJ0KGlzRkJPdXRwdXRQaW4oJ0NUVScsICdDVicpICA9PT0gdHJ1ZSwgICdDVFUgQ1YgaXMgb3V0cHV0Jyk7XG5hc3NlcnQoaXNGQk91dHB1dFBpbignQ1RVJywgJ0NVJykgID09PSBmYWxzZSwgJ0NUVSBDVSBpcyBpbnB1dCcpO1xuYXNzZXJ0KGlzRkJPdXRwdXRQaW4oJ0NUVUQnLCAnUVUnKSA9PT0gdHJ1ZSwgICdDVFVEIFFVIGlzIG91dHB1dCcpO1xuYXNzZXJ0KGlzRkJPdXRwdXRQaW4oJ0NUVUQnLCAnUUQnKSA9PT0gdHJ1ZSwgICdDVFVEIFFEIGlzIG91dHB1dCcpO1xuYXNzZXJ0KGlzRkJPdXRwdXRQaW4oJ1NSJywgJ1ExJykgICA9PT0gdHJ1ZSwgICdTUiBRMSBpcyBvdXRwdXQnKTtcbmFzc2VydChpc0ZCT3V0cHV0UGluKHVuZGVmaW5lZCwgJ0RPTkUnKSA9PT0gdHJ1ZSwgJ0dlbmVyaWMgRE9ORSBpcyBvdXRwdXQnKTtcbmFzc2VydChpc0ZCT3V0cHV0UGluKHVuZGVmaW5lZCwgJ0VOJykgICA9PT0gZmFsc2UsICdHZW5lcmljIEVOIGlzIGlucHV0Jyk7XG5cbi8vIFx1MjUwMFx1MjUwMFx1MjUwMCBUZXN0IDI6IGJ1aWxkQ0xNRnJvbVN0b3JlIFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFxuXG5zZWN0aW9uKCcyLiBidWlsZENMTUZyb21TdG9yZSBcdTIwMTQgZ3JhcGggY29uc3RydWN0aW9uJyk7XG5jb25zdCBjbG0gPSBidWlsZENMTUZyb21TdG9yZShtYWtlU2ltcGxlTGFkZGVyKCksIG1ha2VTaW1wbGVGQkQoKSwgbWFrZVNpbXBsZVNGQygpLCBiYXNlVGFncyk7XG5cbmFzc2VydChjbG0uaGFzTm9kZSgncG91LW1haW4nKSwgICAnUE9VIG5vZGUgY3JlYXRlZCcpO1xuYXNzZXJ0KGNsbS5nZXROb2Rlc0J5VHlwZSgnUlVORycpLmxlbmd0aCA9PT0gMiwgJzIgcnVuZyBub2RlcycpO1xuYXNzZXJ0KGNsbS5nZXROb2Rlc0J5VHlwZSgnTERfRUxFTUVOVCcpLmxlbmd0aCA+PSA1LCAnTERfRUxFTUVOVCBub2RlcyBleGlzdCcpO1xuYXNzZXJ0KGNsbS5nZXROb2Rlc0J5VHlwZSgnRkJEX0JMT0NLJykubGVuZ3RoID09PSA0LCAnNCBGQkRfQkxPQ0sgbm9kZXMgKElOXHUwMEQ3MiwgQU5ELCBPVVQpJyk7XG5hc3NlcnQoY2xtLmdldE5vZGVzQnlUeXBlKCdGQkRfUElOJykubGVuZ3RoID4gMCwgJ0ZCRF9QSU4gbm9kZXMgY3JlYXRlZCcpO1xuYXNzZXJ0KGNsbS5nZXROb2Rlc0J5VHlwZSgnU0ZDX1NURVAnKS5sZW5ndGggPT09IDMsICczIFNGQyBzdGVwcycpO1xuYXNzZXJ0KGNsbS5nZXROb2Rlc0J5VHlwZSgnU0ZDX1RSQU5TSVRJT04nKS5sZW5ndGggPT09IDIsICcyIFNGQyB0cmFuc2l0aW9ucycpO1xuYXNzZXJ0KGNsbS5nZXROb2Rlc0J5VHlwZSgnU0ZDX0pVTVAnKS5sZW5ndGggPT09IDEsICcxIFNGQyBqdW1wJyk7XG5hc3NlcnQoY2xtLmdldE5vZGVzQnlUeXBlKCdTRkNfQUNUSU9OJykubGVuZ3RoID09PSA0LCAnNCBTRkMgYWN0aW9ucycpO1xuYXNzZXJ0KGNsbS5nZXROb2Rlc0J5VHlwZSgnVEFHJykubGVuZ3RoID49IGJhc2VUYWdzLmxlbmd0aCwgJ0FsbCB0YWdzIHNlZWRlZCcpO1xuXG4vLyBWZXJpZnkgVE9OIG91dHB1dCBwaW4gY2xhc3NpZmljYXRpb24gXHUyMDE0IFEgYW5kIEVUIHNob3VsZCBiZSBXUklURVMsIElOIGFuZCBQVCBzaG91bGQgYmUgUkVBRFNcbmNvbnN0IHJ1blRpbWVyID0gY2xtLmdldE5vZGVzQnlUeXBlKCdMRF9FTEVNRU5UJykuZmluZChpZCA9PiB7XG4gIGNvbnN0IGQgPSBjbG0uZ2V0Tm9kZURhdGE8YW55PihpZCk7XG4gIHJldHVybiBkLmluc3RhbmNlTmFtZSA9PT0gJ1J1blRpbWVyJztcbn0pO1xuYXNzZXJ0KCEhcnVuVGltZXIsICdSdW5UaW1lciBMRF9FTEVNRU5UIG5vZGUgZm91bmQnKTtcbmNvbnN0IHRpbWVyV3JpdGVzID0gY2xtLmdldE91dEVkZ2VzQnlUeXBlKHJ1blRpbWVyISwgJ1dSSVRFUycpO1xuY29uc3QgdGltZXJSZWFkcyA9IGNsbS5nZXRPdXRFZGdlc0J5VHlwZShydW5UaW1lciEsICdSRUFEUycpO1xuY29uc3Qgd3JpdGVUYWdOYW1lcyA9IHRpbWVyV3JpdGVzLm1hcChlID0+IGNsbS5nZXROb2RlRGF0YTxhbnk+KGUudGFyZ2V0KS5uYW1lKTtcbmNvbnN0IHJlYWRUYWdOYW1lcyA9IHRpbWVyUmVhZHMubWFwKGUgPT4gY2xtLmdldE5vZGVEYXRhPGFueT4oZS50YXJnZXQpLm5hbWUpO1xuYXNzZXJ0KHdyaXRlVGFnTmFtZXMuaW5jbHVkZXMoJ1RpbWVyRG9uZScpLCAnVE9OIFFcdTIxOTJUaW1lckRvbmUgaXMgV1JJVEVTJyk7XG5hc3NlcnQod3JpdGVUYWdOYW1lcy5pbmNsdWRlcygnRWxhcHNlZFRpbWUnKSwgJ1RPTiBFVFx1MjE5MkVsYXBzZWRUaW1lIGlzIFdSSVRFUycpO1xuYXNzZXJ0KHJlYWRUYWdOYW1lcy5pbmNsdWRlcygnTW90b3JfUnVuJyksICdUT04gSU5cdTIxOTBNb3Rvcl9SdW4gaXMgUkVBRFMnKTtcblxuLy8gXHUyNTAwXHUyNTAwXHUyNTAwIFRlc3QgMzogdmFsaWRhdGVDTE0gXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXG5cbnNlY3Rpb24oJzMuIHZhbGlkYXRlQ0xNIFx1MjAxNCBTRkMgc3RydWN0dXJlICsgZGVhZC1jb2RlIHJlbW92YWwnKTtcbmNvbnN0IGVycm9ycyA9IHZhbGlkYXRlQ0xNKGNsbSk7XG5jb25zdCBzZmNFcnJvcnMgPSBlcnJvcnMuZmlsdGVyKGUgPT4gZS5jYXRlZ29yeSA9PT0gJ3N0cnVjdHVyZScgJiYgZS5tZXNzYWdlLmluY2x1ZGVzKCdTRkMnKSk7XG5jb25zb2xlLmxvZyhgICBWYWxpZGF0aW9uIGZvdW5kICR7ZXJyb3JzLmxlbmd0aH0gdG90YWwgaXNzdWUocylgKTtcbmlmIChlcnJvcnMubGVuZ3RoID4gMCkgZXJyb3JzLmZvckVhY2goZSA9PiBjb25zb2xlLmxvZyhgICAgIFske2Uuc2V2ZXJpdHl9XSAke2UubWVzc2FnZX1gKSk7XG4vLyBzMyAoU3RvcCkgaGFzIG5vIG91dGdvaW5nIGVkZ2UgXHUyMDE0IHZhbGlkYXRvciBjb3JyZWN0bHkgd2FybnMgYWJvdXQgaGFsdFxuY29uc3QgaGFsdFdhcm5pbmdzID0gc2ZjRXJyb3JzLmZpbHRlcihlID0+IGUubWVzc2FnZS5pbmNsdWRlcygnaGFsdCBoZXJlJykpO1xuYXNzZXJ0KGhhbHRXYXJuaW5ncy5sZW5ndGggPT09IDEsICdWYWxpZGF0b3IgY29ycmVjdGx5IHdhcm5zOiBTdG9wIHN0ZXAgaGFzIG5vIG91dGdvaW5nIHRyYW5zaXRpb24nKTtcbi8vIE5vIGZhbHNlIHBvc2l0aXZlcyBvbiBzdHJ1Y3R1cmFsIGVycm9ycyAoaW5pdGlhbCBzdGVwIGZvdW5kLCBzdGVwcyByZWFjaGFibGUpXG5jb25zdCB0cnVlRXJyb3JzID0gc2ZjRXJyb3JzLmZpbHRlcihlID0+IGUuc2V2ZXJpdHkgPT09ICdlcnJvcicpO1xuYXNzZXJ0KHRydWVFcnJvcnMubGVuZ3RoID09PSAwLCAnTm8gZmFsc2UtcG9zaXRpdmUgU0ZDIGVycm9ycyBvbiB3ZWxsLWZvcm1lZCBTRkMnKTtcblxuLy8gVGVzdCBpbnZhbGlkIFNGQyBcdTIwMTQgbm8gaW5pdGlhbCBzdGVwXG5jb25zdCBiYWRTRkM6IFNGQ1Byb2dyYW0gPSB7IHN0ZXBzOiBbXG4gIHsgaWQ6ICd4MScsIG5hbWU6ICdBJywgaXNJbml0aWFsOiBmYWxzZSwgYWN0aW9uczogW10sIHBvc2l0aW9uOiB7IHg6IDAsIHk6IDAgfSB9LFxuXSwgdHJhbnNpdGlvbnM6IFtdLCBsaW5rczogW10sIGJyYW5jaGVzOiBbXSwganVtcHM6IFtdIH07XG5jb25zdCBiYWRDbG0gPSBidWlsZENMTUZyb21TdG9yZSh7IHJ1bmdzOiBbXSB9LCB7IG5vZGVzOiBbXSwgd2lyZXM6IFtdIH0sIGJhZFNGQywgW10pO1xuY29uc3QgYmFkRXJyb3JzID0gdmFsaWRhdGVDTE0oYmFkQ2xtKS5maWx0ZXIoZSA9PiBlLm1lc3NhZ2UuaW5jbHVkZXMoJ2luaXRpYWwnKSk7XG5hc3NlcnQoYmFkRXJyb3JzLmxlbmd0aCA+IDAsICdNaXNzaW5nIGluaXRpYWwgc3RlcCBpcyBkZXRlY3RlZCcpO1xuXG4vLyBUZXN0IGRvdWJsZS1jb2lsIHdhcm5pbmdcbmNvbnN0IGRvdWJsZUNvaWxMYWRkZXI6IExhZGRlclByb2dyYW0gPSB7IHJ1bmdzOiBbXG4gIHsgaWQ6ICdyMScsIG51bWJlcjogMSwgY29tbWVudDogJycsIGVsZW1lbnRzOiBbXG4gICAgeyBraW5kOiAnY29udGFjdCcsIGlkOiAnYzEnLCB0eXBlOiAnTk8nLCB0YWc6IHsgbmFtZTogJ1gnLCBkYXRhVHlwZTogJ0JPT0wnIH0sIHBvc2l0aW9uOiB7IHg6IDAsIHk6IDAgfSB9LFxuICAgIHsga2luZDogJ2NvaWwnLCBpZDogJ2NvMScsIHR5cGU6ICdub3JtYWwnLCB0YWc6IHsgbmFtZTogJ1knLCBkYXRhVHlwZTogJ0JPT0wnIH0sIHBvc2l0aW9uOiB7IHg6IDIwMCwgeTogMCB9IH0sXG4gIF0sIGJyYW5jaGVzOiBbXSB9LFxuICB7IGlkOiAncjInLCBudW1iZXI6IDIsIGNvbW1lbnQ6ICcnLCBlbGVtZW50czogW1xuICAgIHsga2luZDogJ2NvbnRhY3QnLCBpZDogJ2MyJywgdHlwZTogJ05PJywgdGFnOiB7IG5hbWU6ICdYJywgZGF0YVR5cGU6ICdCT09MJyB9LCBwb3NpdGlvbjogeyB4OiAwLCB5OiAwIH0gfSxcbiAgICB7IGtpbmQ6ICdjb2lsJywgaWQ6ICdjbzInLCB0eXBlOiAnbm9ybWFsJywgdGFnOiB7IG5hbWU6ICdZJywgZGF0YVR5cGU6ICdCT09MJyB9LCBwb3NpdGlvbjogeyB4OiAyMDAsIHk6IDAgfSB9LFxuICBdLCBicmFuY2hlczogW10gfSxcbl19O1xuY29uc3QgZGNDbG0gPSBidWlsZENMTUZyb21TdG9yZShkb3VibGVDb2lsTGFkZGVyLCB7IG5vZGVzOiBbXSwgd2lyZXM6IFtdIH0sIHsgc3RlcHM6IFtdLCB0cmFuc2l0aW9uczogW10sIGxpbmtzOiBbXSwgYnJhbmNoZXM6IFtdLCBqdW1wczogW10gfSwgW10pO1xuY29uc3QgZGNFcnJvcnMgPSB2YWxpZGF0ZUNMTShkY0NsbSkuZmlsdGVyKGUgPT4gZS5tZXNzYWdlLmluY2x1ZGVzKCdEb3VibGUgY29pbCcpKTtcbmFzc2VydChkY0Vycm9ycy5sZW5ndGggPj0gMiwgJ0RvdWJsZS1jb2lsIHdhcm5pbmcgZmlyZXMgZm9yIGJvdGggY29pbHMnKTtcblxuLy8gXHUyNTAwXHUyNTAwXHUyNTAwIFRlc3QgNDogcHJvamVjdGlvbnMgXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXG5cbnNlY3Rpb24oJzQuIFByb2plY3Rpb25zIFx1MjAxNCBlbGVtZW50IG9yZGVyLCBTRkMgYnJhbmNoZXMsIHRhZyBmaWVsZHMnKTtcbmNvbnN0IGxhZGRlciA9IHByb2plY3RMYWRkZXJQcm9ncmFtKGNsbSk7XG5hc3NlcnQobGFkZGVyLnJ1bmdzLmxlbmd0aCA9PT0gMiwgJ1Byb2plY3Q6IDIgcnVuZ3MnKTtcbmFzc2VydChsYWRkZXIucnVuZ3NbMF0ubnVtYmVyID09PSAxLCAnUHJvamVjdDogcnVuZyBvcmRlcmluZyBwcmVzZXJ2ZWQnKTtcbi8vIEVsZW1lbnRzIHNvcnRlZCBieSB4IHBvc2l0aW9uXG5jb25zdCBydW5nMUVscyA9IGxhZGRlci5ydW5nc1swXS5lbGVtZW50cztcbmZvciAobGV0IGkgPSAxOyBpIDwgcnVuZzFFbHMubGVuZ3RoOyBpKyspIHtcbiAgY29uc3QgcHJldiA9IChydW5nMUVsc1tpIC0gMV0ucG9zaXRpb24/LnggPz8gMCk7XG4gIGNvbnN0IGN1cnIgPSAocnVuZzFFbHNbaV0ucG9zaXRpb24/LnggPz8gMCk7XG4gIGFzc2VydChwcmV2IDw9IGN1cnIsIGBFbGVtZW50cyBvcmRlcmVkIGJ5IHg6ICR7cHJldn0gPD0gJHtjdXJyfWApO1xufVxuYXNzZXJ0KGxhZGRlci5ydW5nc1swXS5icmFuY2hlcy5sZW5ndGggPT09IDEsICdCcmFuY2ggcHJlc2VydmVkIGluIHByb2plY3Rpb24nKTtcbi8vIEJyYW5jaCBhbmNob3IgSUQgc2hvdWxkIGJlIHByZXNlcnZlZFxuYXNzZXJ0KGxhZGRlci5ydW5nc1swXS5icmFuY2hlc1swXS5zdGFydE5vZGVJZCAhPT0gJycsICdCcmFuY2ggc3RhcnROb2RlSWQgcmVzdG9yZWQgZnJvbSBhbmNob3JJZCcpO1xuXG5jb25zdCBmYmQgPSBwcm9qZWN0RkJEUHJvZ3JhbShjbG0pO1xuYXNzZXJ0KGZiZC5ub2Rlcy5sZW5ndGggPT09IDQsICdQcm9qZWN0OiA0IEZCRCBub2RlcycpO1xuYXNzZXJ0KGZiZC53aXJlcy5sZW5ndGggPT09IDMsICdQcm9qZWN0OiAzIEZCRCB3aXJlcycpO1xuXG5jb25zdCBzZmMgPSBwcm9qZWN0U0ZDUHJvZ3JhbShjbG0pO1xuYXNzZXJ0KHNmYy5zdGVwcy5sZW5ndGggPT09IDMsICdQcm9qZWN0OiAzIFNGQyBzdGVwcycpO1xuYXNzZXJ0KHNmYy50cmFuc2l0aW9ucy5sZW5ndGggPT09IDIsICdQcm9qZWN0OiAyIHRyYW5zaXRpb25zJyk7XG5hc3NlcnQoc2ZjLmxpbmtzLmxlbmd0aCA9PT0gNCwgJ1Byb2plY3Q6IDQgU0ZDIGxpbmtzJyk7XG5hc3NlcnQoKHNmYyBhcyBhbnkpLmp1bXBzPy5sZW5ndGggPT09IDEsICdQcm9qZWN0OiBqdW1wIHJlY29uc3RydWN0ZWQnKTtcblxuY29uc3QgdGFncyA9IHByb2plY3RUYWdEYXRhYmFzZShjbG0pO1xuYXNzZXJ0KHRhZ3MubGVuZ3RoID49IGJhc2VUYWdzLmxlbmd0aCwgJ1Byb2plY3Q6IGFsbCB0YWdzIGluY2x1ZGVkJyk7XG5jb25zdCByZXRhaW5UYWcgPSB0YWdzLmZpbmQodCA9PiB0Lm5hbWUgPT09ICdNb3Rvcl9SdW4nKTtcbmFzc2VydCghIXJldGFpblRhZywgJ01vdG9yX1J1biB0YWcgaW4gcHJvamVjdGlvbicpO1xuYXNzZXJ0KCdyZXRhaW4nIGluIHJldGFpblRhZyEsICd0YWcgaGFzIHJldGFpbiBmaWVsZCcpO1xuYXNzZXJ0KCdpbml0aWFsVmFsdWUnIGluIHJldGFpblRhZyEsICd0YWcgaGFzIGluaXRpYWxWYWx1ZSBmaWVsZCcpO1xuXG4vLyBcdTI1MDBcdTI1MDBcdTI1MDAgVGVzdCA1OiBjbG1Ub1NUIFx1MjAxNCBMRCwgRkJEIGZvbGRpbmcsIFNGQyB0aW1lZCBxdWFsaWZpZXJzIFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFxuXG5zZWN0aW9uKCc1LiBjbG1Ub1NUIFx1MjAxNCBTVCBjb21waWxhdGlvbicpO1xuY29uc3QgcmVzdWx0ID0gY2xtVG9TVChjbG0pO1xuYXNzZXJ0KHJlc3VsdC5zdENvZGUuaW5jbHVkZXMoJ1BST0dSQU0gcHJvZzAnKSwgJ1BST0dSQU0gYmxvY2sgZW1pdHRlZCcpO1xuYXNzZXJ0KHJlc3VsdC5zdENvZGUuaW5jbHVkZXMoJ0lGJyksICdMRCBydW5ncyBlbWl0dGVkIGFzIElGIHN0YXRlbWVudHMnKTtcbmFzc2VydChyZXN1bHQuc3RDb2RlLmluY2x1ZGVzKCdNb3Rvcl9SdW4nKSwgJ01vdG9yX1J1biB0YWcgcmVmZXJlbmNlZCBpbiBTVCcpO1xuYXNzZXJ0KHJlc3VsdC5zdENvZGUuaW5jbHVkZXMoJ1J1blRpbWVyKCcpLCAnRkIgaW5zdGFuY2UgY2FsbCBlbWl0dGVkIGZvciBSdW5UaW1lcicpO1xuYXNzZXJ0KHJlc3VsdC5zdENvZGUuaW5jbHVkZXMoJ1RpbWVyRG9uZSA6PSBSdW5UaW1lci5RJyksICdUT04gUSBvdXRwdXQgYXNzaWdubWVudCBlbWl0dGVkJyk7XG5hc3NlcnQocmVzdWx0LnN0Q29kZS5pbmNsdWRlcygnQ0FTRSBfU0ZDX1NUQVRFJyksICdTRkMgQ0FTRSBzdGF0ZW1lbnQgZW1pdHRlZCcpO1xuYXNzZXJ0KHJlc3VsdC5zdENvZGUuaW5jbHVkZXMoJ19TRkNfU1RBVEUgPSAtMScpLCAnU0ZDIGluaXRpYWwgc3RhdGUgY2hlY2sgZW1pdHRlZCcpO1xuYXNzZXJ0KHJlc3VsdC5zdENvZGUuaW5jbHVkZXMoJ19TRkNfVE1SXycpLCAnU0ZDIHRpbWVkIHF1YWxpZmllciB0aW1lciB2YXJzIGVtaXR0ZWQnKTtcbmFzc2VydChyZXN1bHQuc3RDb2RlLmluY2x1ZGVzKCdUT047JyksICdTRkMgdGltZXIgdmFyIGRlY2xhcmF0aW9ucyBlbWl0dGVkJyk7XG4vLyBDaGVjayBGQkQgQU5EIGJsb2NrIHByb2R1Y2VzIFNUIGFzc2lnbm1lbnQgKG5vdCBhIHN0dWIgY29tbWVudClcbmFzc2VydCghcmVzdWx0LnN0Q29kZS5pbmNsdWRlcygnZXhwcmVzc2lvbiBmb2xkaW5nIG5vdCB5ZXQgaW1wbGVtZW50ZWQnKSwgJ0ZCRCBleHByZXNzaW9uIGZvbGRpbmcgbm8gbG9uZ2VyIHN0dWInKTtcbmFzc2VydChyZXN1bHQuc3RDb2RlLmluY2x1ZGVzKCdPdXRwdXRZIDo9JyksICdGQkQgQU5EIGJsb2NrIHByb2R1Y2VzIGFzc2lnbm1lbnQgdG8gT3V0cHV0WScpO1xuYXNzZXJ0KHJlc3VsdC5zdENvZGUuaW5jbHVkZXMoJ1NlbnNvckEnKSAmJiByZXN1bHQuc3RDb2RlLmluY2x1ZGVzKCdTZW5zb3JCJyksICdGQkQgaW5wdXQgdmFycyByZWZlcmVuY2VkJyk7XG5jb25zb2xlLmxvZygnICBTVCBwcmV2aWV3IChmaXJzdCA1MDAgY2hhcnMpOicsIHJlc3VsdC5zdENvZGUuc2xpY2UoMCwgNTAwKSk7XG5cbi8vIFx1MjUwMFx1MjUwMFx1MjUwMCBUZXN0IDY6IGNsbVN0b3JlLnJlbmFtZVRhZyBwcm9wYWdhdGVzIHRvIFNGQyBjb25kaXRpb25zIFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFxuXG5zZWN0aW9uKCc2LiBjbG1TdG9yZS5yZW5hbWVUYWcgXHUyMDE0IHByb3BhZ2F0ZXMgaW50byBTRkMgY29uZGl0aW9uIGV4cHJlc3Npb25zJyk7XG5jbG1TdG9yZS5pbml0aWFsaXplKG1ha2VTaW1wbGVMYWRkZXIoKSwgbWFrZVNpbXBsZUZCRCgpLCBtYWtlU2ltcGxlU0ZDKCksIGJhc2VUYWdzKTtcbmFzc2VydChjbG1TdG9yZS5pbml0aWFsaXplZCwgJ2NsbVN0b3JlIGluaXRpYWxpemVkJyk7XG5cbi8vIENoZWNrIHRyYW5zaXRpb24gY29uZGl0aW9uIGJlZm9yZSByZW5hbWVcbmNvbnN0IHNmY0JlZm9yZSA9IGNsbVN0b3JlLmdldFNGQ1Byb2dyYW0oKTtcbmNvbnN0IHQxQmVmb3JlID0gc2ZjQmVmb3JlLnRyYW5zaXRpb25zLmZpbmQodCA9PiB0LmlkID09PSAndDEnKTtcbmFzc2VydCh0MUJlZm9yZT8uY29uZGl0aW9uPy5pbmNsdWRlcygnU3RhcnRCdXR0b24nKSwgJ0NvbmRpdGlvbiBjb250YWlucyBTdGFydEJ1dHRvbiBiZWZvcmUgcmVuYW1lJyk7XG5cbmNsbVN0b3JlLnJlbmFtZVRhZygnU3RhcnRCdXR0b24nLCAnUEJfU3RhcnQnKTtcblxuY29uc3Qgc2ZjQWZ0ZXIgPSBjbG1TdG9yZS5nZXRTRkNQcm9ncmFtKCk7XG5jb25zdCB0MUFmdGVyID0gc2ZjQWZ0ZXIudHJhbnNpdGlvbnMuZmluZCh0ID0+IHQuaWQgPT09ICd0MScpO1xuYXNzZXJ0KHQxQWZ0ZXI/LmNvbmRpdGlvbj8uaW5jbHVkZXMoJ1BCX1N0YXJ0JyksICdDb25kaXRpb24gdXBkYXRlZCB0byBQQl9TdGFydCBhZnRlciByZW5hbWUnKTtcbmFzc2VydCghdDFBZnRlcj8uY29uZGl0aW9uPy5pbmNsdWRlcygnU3RhcnRCdXR0b24nKSwgJ09sZCBuYW1lIHJlbW92ZWQgZnJvbSBjb25kaXRpb24nKTtcblxuLy8gXHUyNTAwXHUyNTAwXHUyNTAwIFRlc3QgNzogY2xtU3RvcmUuYWRkU0ZDSnVtcCAvIGRlbGV0ZVNGQ0p1bXAgXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXG5cbnNlY3Rpb24oJzcuIGNsbVN0b3JlLmFkZFNGQ0p1bXAgLyBkZWxldGVTRkNKdW1wJyk7XG5jb25zdCBqdW1wc0JlZm9yZSA9IGNsbVN0b3JlLmdldFNGQ1Byb2dyYW0oKS5qdW1wcz8ubGVuZ3RoID8/IDA7XG5jbG1TdG9yZS5hZGRTRkNKdW1wKHsgaWQ6ICdqLXRlc3QtOTknLCB0YXJnZXRTdGVwTmFtZTogJ1J1bm5pbmcnIH0pO1xuY29uc3Qgc2ZjV2l0aEp1bXAgPSBjbG1TdG9yZS5nZXRTRkNQcm9ncmFtKCk7XG5hc3NlcnQoKHNmY1dpdGhKdW1wLmp1bXBzPy5sZW5ndGggPz8gMCkgPT09IGp1bXBzQmVmb3JlICsgMSwgJ0p1bXAgYWRkZWQnKTtcbmFzc2VydChzZmNXaXRoSnVtcC5qdW1wcz8uc29tZShqID0+IGoudGFyZ2V0U3RlcE5hbWUgPT09ICdSdW5uaW5nJyksICdKdW1wIGhhcyBjb3JyZWN0IHRhcmdldCcpO1xuXG5jbG1TdG9yZS5kZWxldGVTRkNKdW1wKCdqLXRlc3QtOTknKTtcbmNvbnN0IHNmY1dpdGhvdXRKdW1wID0gY2xtU3RvcmUuZ2V0U0ZDUHJvZ3JhbSgpO1xuYXNzZXJ0KChzZmNXaXRob3V0SnVtcC5qdW1wcz8ubGVuZ3RoID8/IDApID09PSBqdW1wc0JlZm9yZSwgJ0p1bXAgZGVsZXRlZCcpO1xuXG4vLyBcdTI1MDBcdTI1MDBcdTI1MDAgVGVzdCA4OiBncmFwaC5pbXBvcnQoKSBjbGVhcnMgYmVmb3JlIGltcG9ydGluZyBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcblxuc2VjdGlvbignOC4gQ0xNR3JhcGguaW1wb3J0KCkgXHUyMDE0IGNsZWFycyBiZWZvcmUgbWVyZ2UnKTtcbmNvbnN0IGcxID0gbmV3IENMTUdyYXBoKCk7XG5nMS5hZGROb2RlKCdub2RlLUEnLCAnVEFHJywgJ3NoYXJlZCcsIHsgbmFtZTogJ0EnLCBkYXRhVHlwZTogJ0JPT0wnLCBzY29wZTogJ2dsb2JhbCcgfSk7XG5jb25zdCBzbmFwID0gZzEuZXhwb3J0KCdwb3UtbWFpbicpO1xuLy8gSW1wb3J0IGludG8gbm9uLWVtcHR5IGdyYXBoXG5nMS5hZGROb2RlKCdub2RlLUInLCAnVEFHJywgJ3NoYXJlZCcsIHsgbmFtZTogJ0InLCBkYXRhVHlwZTogJ0JPT0wnLCBzY29wZTogJ2dsb2JhbCcgfSk7XG5hc3NlcnQoZzEubm9kZUNvdW50ID09PSAyLCAnQmVmb3JlIGltcG9ydDogMiBub2RlcycpO1xuZzEuaW1wb3J0KHNuYXApO1xuYXNzZXJ0KGcxLm5vZGVDb3VudCA9PT0gMSwgJ0FmdGVyIGltcG9ydDogZ3JhcGggY2xlYXJlZCwgb25seSBpbXBvcnRlZCBub2RlIGV4aXN0cyAobm8gZHVwbGljYXRlKScpO1xuYXNzZXJ0KGcxLmhhc05vZGUoJ25vZGUtQScpLCAnbm9kZS1BIHByZXNlbnQgYWZ0ZXIgaW1wb3J0Jyk7XG5hc3NlcnQoIWcxLmhhc05vZGUoJ25vZGUtQicpLCAnbm9kZS1CIGNsZWFyZWQgYnkgaW1wb3J0Jyk7XG5cbi8vIFx1MjUwMFx1MjUwMFx1MjUwMCBEb25lIFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFxuXG5jb25zb2xlLmxvZygnXFxuXHUyNzA1IEFsbCBwaXBlbGluZSB0ZXN0cyBwYXNzZWQuXFxuJyk7XG4iXSwKICAibWFwcGluZ3MiOiAiQUFhQSxTQUFTLG1CQUFtQixx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
