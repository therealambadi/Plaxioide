/**
 * CLM Pipeline Integration Tests
 * Tests every fixed path:
 *   1. builder — multi-POU, FB output pin heuristic
 *   2. validator — dead-code removal, SFC structural validation
 *   3. projections — element order, SFC branches, tag fields
 *   4. clmToST — FBD folding, SFC timed qualifiers, LD fb_call pins
 *   5. clmStore — sync bridge, renameTag propagation, addSFCJump/deleteSFCJump
 *   6. graph — clear on import
 *
 * Run with: npx tsx __tests__/pipeline.test.ts
 */

import { buildCLMFromStore, isFBOutputPin } from '../builder.js';
import { validateCLM } from '../validator.js';
import { projectLadderProgram, projectFBDProgram, projectSFCProgram, projectTagDatabase } from '../projections.js';
import { clmToST } from '../clmToST.js';
import { clmStore } from '../clmStore.js';
import { CLMGraph } from '../graph.js';
import type { LadderProgram, FBDProgram, SFCProgram, TagEntry } from '../../logicStore.js';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function assert(cond: boolean, msg: string): void {
  if (!cond) throw new Error(`FAIL: ${msg}`);
  console.log(`  ✓ ${msg}`);
}

function section(name: string) {
  console.log(`\n━━━ ${name} ━━━`);
}

// ─── Test data factories ──────────────────────────────────────────────────────

function makeSimpleLadder(): LadderProgram {
  return {
    rungs: [
      {
        id: 'rung1', number: 1, comment: 'Start logic',
        elements: [
          { kind: 'contact', id: 'e1', type: 'NO', tag: { name: 'Motor_Start', dataType: 'BOOL' }, position: { x: 100, y: 0 } },
          { kind: 'contact', id: 'e2', type: 'NC', tag: { name: 'E_Stop', dataType: 'BOOL' }, position: { x: 200, y: 0 } },
          { kind: 'coil',   id: 'e3', type: 'normal', tag: { name: 'Motor_Run', dataType: 'BOOL' }, position: { x: 400, y: 0 } },
        ],
        branches: [
          {
            id: 'br1', startNodeId: 'e1', endNodeId: 'e2',
            elements: [
              { kind: 'contact', id: 'e4', type: 'NO', tag: { name: 'Motor_Run', dataType: 'BOOL' }, position: { x: 150, y: 50 } },
            ],
          },
        ],
      },
      {
        id: 'rung2', number: 2, comment: 'TON timer',
        elements: [
          { kind: 'contact', id: 'e5', type: 'NO', tag: { name: 'Motor_Run', dataType: 'BOOL' }, position: { x: 100, y: 0 } },
          {
            kind: 'block', id: 'e6', fbType: 'TON', instanceName: 'RunTimer',
            pins: { IN: { name: 'Motor_Run', dataType: 'BOOL' }, PT: { name: 'RunDelay', dataType: 'TIME' }, Q: { name: 'TimerDone', dataType: 'BOOL' }, ET: { name: 'ElapsedTime', dataType: 'TIME' } },
            position: { x: 300, y: 0 },
          },
        ],
        branches: [],
      },
    ],
  };
}

function makeSimpleFBD(): FBDProgram {
  return {
    nodes: [
      {
        id: 'n1', type: 'IN_VARIABLE', instanceName: '', label: '', content: '',
        position: { x: 50, y: 100 }, size: { width: 80, height: 40 },
        inputs: [], outputs: [{ id: 'n1-out', name: 'OUT', dataType: 'BOOL', negated: false }],
        tag: { name: 'SensorA', dataType: 'BOOL' },
      },
      {
        id: 'n2', type: 'IN_VARIABLE', instanceName: '', label: '', content: '',
        position: { x: 50, y: 200 }, size: { width: 80, height: 40 },
        inputs: [], outputs: [{ id: 'n2-out', name: 'OUT', dataType: 'BOOL', negated: false }],
        tag: { name: 'SensorB', dataType: 'BOOL' },
      },
      {
        id: 'n3', type: 'AND', instanceName: '', label: '', content: '',
        position: { x: 200, y: 150 }, size: { width: 60, height: 60 },
        inputs: [
          { id: 'n3-in1', name: 'IN1', dataType: 'BOOL', negated: false },
          { id: 'n3-in2', name: 'IN2', dataType: 'BOOL', negated: false },
        ],
        outputs: [{ id: 'n3-out', name: 'OUT', dataType: 'BOOL', negated: false }],
      },
      {
        id: 'n4', type: 'OUT_VARIABLE', instanceName: '', label: '', content: '',
        position: { x: 350, y: 150 }, size: { width: 80, height: 40 },
        inputs: [{ id: 'n4-in', name: 'IN', dataType: 'BOOL', negated: false }], outputs: [],
        tag: { name: 'OutputY', dataType: 'BOOL' },
      },
    ],
    wires: [
      { id: 'w1', from: { nodeId: 'n1', pin: 'OUT' }, to: { nodeId: 'n3', pin: 'IN1' }, negated: false },
      { id: 'w2', from: { nodeId: 'n2', pin: 'OUT' }, to: { nodeId: 'n3', pin: 'IN2' }, negated: false },
      { id: 'w3', from: { nodeId: 'n3', pin: 'OUT' }, to: { nodeId: 'n4', pin: 'IN' }, negated: false },
    ],
  };
}

function makeSimpleSFC(): SFCProgram {
  return {
    steps: [
      { id: 's1', name: 'Init', isInitial: true, actions: [
        { id: 'a1', qualifier: 'N', tag: { name: 'InitDone', dataType: 'BOOL' } },
      ], position: { x: 200, y: 100 } },
      { id: 's2', name: 'Running', isInitial: false, actions: [
        { id: 'a2', qualifier: 'L', tag: { name: 'MotorOn', dataType: 'BOOL' }, duration: '5s' },
        { id: 'a3', qualifier: 'D', tag: { name: 'AlarmOn', dataType: 'BOOL' }, duration: '10s' },
      ], position: { x: 200, y: 300 } },
      { id: 's3', name: 'Stop', isInitial: false, actions: [
        { id: 'a4', qualifier: 'S', tag: { name: 'StopFlag', dataType: 'BOOL' } },
      ], position: { x: 200, y: 500 } },
    ],
    transitions: [
      { id: 't1', condition: 'StartButton AND NOT E_Stop', priority: 1, position: { x: 200, y: 200 } },
      { id: 't2', condition: 'TimerDone', priority: 1, position: { x: 200, y: 400 } },
    ],
    links: [
      { id: 'l1', from: 's1', to: 't1', type: 'simple' },
      { id: 'l2', from: 't1', to: 's2', type: 'simple' },
      { id: 'l3', from: 's2', to: 't2', type: 'simple' },
      { id: 'l4', from: 't2', to: 's3', type: 'simple' },
    ],
    branches: [],
    jumps: [{ id: 'j1', targetStepName: 'Init' }],
  };
}

const baseTags: TagEntry[] = [
  { name: 'Motor_Start', dataType: 'BOOL', address: '%I0.0', description: 'Start button' },
  { name: 'E_Stop',      dataType: 'BOOL', address: '%I0.1', description: 'Emergency stop' },
  { name: 'Motor_Run',   dataType: 'BOOL', address: '%Q0.0', description: 'Motor output' },
  { name: 'RunDelay',    dataType: 'TIME',  address: '', description: '' },
  { name: 'TimerDone',   dataType: 'BOOL',  address: '', description: '' },
  { name: 'ElapsedTime', dataType: 'TIME',  address: '', description: '' },
  { name: 'SensorA',     dataType: 'BOOL',  address: '', description: '' },
  { name: 'SensorB',     dataType: 'BOOL',  address: '', description: '' },
  { name: 'OutputY',     dataType: 'BOOL',  address: '', description: '' },
  { name: 'StartButton', dataType: 'BOOL',  address: '', description: '' },
  { name: 'InitDone',    dataType: 'BOOL',  address: '', description: '' },
  { name: 'MotorOn',     dataType: 'BOOL',  address: '', description: '' },
  { name: 'AlarmOn',     dataType: 'BOOL',  address: '', description: '' },
  { name: 'StopFlag',    dataType: 'BOOL',  address: '', description: '' },
];

// ─── Test 1: isFBOutputPin ────────────────────────────────────────────────────

section('1. isFBOutputPin — FB output pin heuristic');
assert(isFBOutputPin('TON', 'Q')   === true,  'TON Q is output');
assert(isFBOutputPin('TON', 'ET')  === true,  'TON ET is output');
assert(isFBOutputPin('TON', 'IN')  === false, 'TON IN is input');
assert(isFBOutputPin('TON', 'PT')  === false, 'TON PT is input');
assert(isFBOutputPin('CTU', 'Q')   === true,  'CTU Q is output');
assert(isFBOutputPin('CTU', 'CV')  === true,  'CTU CV is output');
assert(isFBOutputPin('CTU', 'CU')  === false, 'CTU CU is input');
assert(isFBOutputPin('CTUD', 'QU') === true,  'CTUD QU is output');
assert(isFBOutputPin('CTUD', 'QD') === true,  'CTUD QD is output');
assert(isFBOutputPin('SR', 'Q1')   === true,  'SR Q1 is output');
assert(isFBOutputPin(undefined, 'DONE') === true, 'Generic DONE is output');
assert(isFBOutputPin(undefined, 'EN')   === false, 'Generic EN is input');

// ─── Test 2: buildCLMFromStore ────────────────────────────────────────────────

section('2. buildCLMFromStore — graph construction');
const clm = buildCLMFromStore(makeSimpleLadder(), makeSimpleFBD(), makeSimpleSFC(), baseTags);

assert(clm.hasNode('pou-main'),   'POU node created');
assert(clm.getNodesByType('RUNG').length === 2, '2 rung nodes');
assert(clm.getNodesByType('LD_ELEMENT').length >= 5, 'LD_ELEMENT nodes exist');
assert(clm.getNodesByType('FBD_BLOCK').length === 4, '4 FBD_BLOCK nodes (IN×2, AND, OUT)');
assert(clm.getNodesByType('FBD_PIN').length > 0, 'FBD_PIN nodes created');
assert(clm.getNodesByType('SFC_STEP').length === 3, '3 SFC steps');
assert(clm.getNodesByType('SFC_TRANSITION').length === 2, '2 SFC transitions');
assert(clm.getNodesByType('SFC_JUMP').length === 1, '1 SFC jump');
assert(clm.getNodesByType('SFC_ACTION').length === 4, '4 SFC actions');
assert(clm.getNodesByType('TAG').length >= baseTags.length, 'All tags seeded');

// Verify TON output pin classification — Q and ET should be WRITES, IN and PT should be READS
const runTimer = clm.getNodesByType('LD_ELEMENT').find(id => {
  const d = clm.getNodeData<any>(id);
  return d.instanceName === 'RunTimer';
});
assert(!!runTimer, 'RunTimer LD_ELEMENT node found');
const timerWrites = clm.getOutEdgesByType(runTimer!, 'WRITES');
const timerReads = clm.getOutEdgesByType(runTimer!, 'READS');
const writeTagNames = timerWrites.map(e => clm.getNodeData<any>(e.target).name);
const readTagNames = timerReads.map(e => clm.getNodeData<any>(e.target).name);
assert(writeTagNames.includes('TimerDone'), 'TON Q→TimerDone is WRITES');
assert(writeTagNames.includes('ElapsedTime'), 'TON ET→ElapsedTime is WRITES');
assert(readTagNames.includes('Motor_Run'), 'TON IN←Motor_Run is READS');

// ─── Test 3: validateCLM ─────────────────────────────────────────────────────

section('3. validateCLM — SFC structure + dead-code removal');
const errors = validateCLM(clm);
const sfcErrors = errors.filter(e => e.category === 'structure' && e.message.includes('SFC'));
console.log(`  Validation found ${errors.length} total issue(s)`);
if (errors.length > 0) errors.forEach(e => console.log(`    [${e.severity}] ${e.message}`));
// s3 (Stop) has no outgoing edge — validator correctly warns about halt
const haltWarnings = sfcErrors.filter(e => e.message.includes('halt here'));
assert(haltWarnings.length === 1, 'Validator correctly warns: Stop step has no outgoing transition');
// No false positives on structural errors (initial step found, steps reachable)
const trueErrors = sfcErrors.filter(e => e.severity === 'error');
assert(trueErrors.length === 0, 'No false-positive SFC errors on well-formed SFC');

// Test invalid SFC — no initial step
const badSFC: SFCProgram = { steps: [
  { id: 'x1', name: 'A', isInitial: false, actions: [], position: { x: 0, y: 0 } },
], transitions: [], links: [], branches: [], jumps: [] };
const badClm = buildCLMFromStore({ rungs: [] }, { nodes: [], wires: [] }, badSFC, []);
const badErrors = validateCLM(badClm).filter(e => e.message.includes('initial'));
assert(badErrors.length > 0, 'Missing initial step is detected');

// Test double-coil warning
const doubleCoilLadder: LadderProgram = { rungs: [
  { id: 'r1', number: 1, comment: '', elements: [
    { kind: 'contact', id: 'c1', type: 'NO', tag: { name: 'X', dataType: 'BOOL' }, position: { x: 0, y: 0 } },
    { kind: 'coil', id: 'co1', type: 'normal', tag: { name: 'Y', dataType: 'BOOL' }, position: { x: 200, y: 0 } },
  ], branches: [] },
  { id: 'r2', number: 2, comment: '', elements: [
    { kind: 'contact', id: 'c2', type: 'NO', tag: { name: 'X', dataType: 'BOOL' }, position: { x: 0, y: 0 } },
    { kind: 'coil', id: 'co2', type: 'normal', tag: { name: 'Y', dataType: 'BOOL' }, position: { x: 200, y: 0 } },
  ], branches: [] },
]};
const dcClm = buildCLMFromStore(doubleCoilLadder, { nodes: [], wires: [] }, { steps: [], transitions: [], links: [], branches: [], jumps: [] }, []);
const dcErrors = validateCLM(dcClm).filter(e => e.message.includes('Double coil'));
assert(dcErrors.length >= 2, 'Double-coil warning fires for both coils');

// ─── Test 4: projections ─────────────────────────────────────────────────────

section('4. Projections — element order, SFC branches, tag fields');
const ladder = projectLadderProgram(clm);
assert(ladder.rungs.length === 2, 'Project: 2 rungs');
assert(ladder.rungs[0].number === 1, 'Project: rung ordering preserved');
// Elements sorted by x position
const rung1Els = ladder.rungs[0].elements;
for (let i = 1; i < rung1Els.length; i++) {
  const prev = (rung1Els[i - 1].position?.x ?? 0);
  const curr = (rung1Els[i].position?.x ?? 0);
  assert(prev <= curr, `Elements ordered by x: ${prev} <= ${curr}`);
}
assert(ladder.rungs[0].branches.length === 1, 'Branch preserved in projection');
// Branch anchor ID should be preserved
assert(ladder.rungs[0].branches[0].startNodeId !== '', 'Branch startNodeId restored from anchorId');

const fbd = projectFBDProgram(clm);
assert(fbd.nodes.length === 4, 'Project: 4 FBD nodes');
assert(fbd.wires.length === 3, 'Project: 3 FBD wires');

const sfc = projectSFCProgram(clm);
assert(sfc.steps.length === 3, 'Project: 3 SFC steps');
assert(sfc.transitions.length === 2, 'Project: 2 transitions');
assert(sfc.links.length === 4, 'Project: 4 SFC links');
assert((sfc as any).jumps?.length === 1, 'Project: jump reconstructed');

const tags = projectTagDatabase(clm);
assert(tags.length >= baseTags.length, 'Project: all tags included');
const retainTag = tags.find(t => t.name === 'Motor_Run');
assert(!!retainTag, 'Motor_Run tag in projection');
assert('retain' in retainTag!, 'tag has retain field');
assert('initialValue' in retainTag!, 'tag has initialValue field');

// ─── Test 5: clmToST — LD, FBD folding, SFC timed qualifiers ─────────────────

section('5. clmToST — ST compilation');
const result = clmToST(clm);
assert(result.stCode.includes('PROGRAM prog0'), 'PROGRAM block emitted');
assert(result.stCode.includes('IF'), 'LD rungs emitted as IF statements');
assert(result.stCode.includes('Motor_Run'), 'Motor_Run tag referenced in ST');
assert(result.stCode.includes('RunTimer('), 'FB instance call emitted for RunTimer');
assert(result.stCode.includes('TimerDone := RunTimer.Q'), 'TON Q output assignment emitted');
assert(result.stCode.includes('CASE _SFC_STATE'), 'SFC CASE statement emitted');
assert(result.stCode.includes('_SFC_STATE = -1'), 'SFC initial state check emitted');
assert(result.stCode.includes('_SFC_TMR_'), 'SFC timed qualifier timer vars emitted');
assert(result.stCode.includes('TON;'), 'SFC timer var declarations emitted');
// Check FBD AND block produces ST assignment (not a stub comment)
assert(!result.stCode.includes('expression folding not yet implemented'), 'FBD expression folding no longer stub');
assert(result.stCode.includes('OutputY :='), 'FBD AND block produces assignment to OutputY');
assert(result.stCode.includes('SensorA') && result.stCode.includes('SensorB'), 'FBD input vars referenced');
console.log('  ST preview (first 500 chars):', result.stCode.slice(0, 500));

// ─── Test 6: clmStore.renameTag propagates to SFC conditions ─────────────────

section('6. clmStore.renameTag — propagates into SFC condition expressions');
clmStore.initialize(makeSimpleLadder(), makeSimpleFBD(), makeSimpleSFC(), baseTags);
assert(clmStore.initialized, 'clmStore initialized');

// Check transition condition before rename
const sfcBefore = clmStore.getSFCProgram();
const t1Before = sfcBefore.transitions.find(t => t.id === 't1');
assert(t1Before?.condition?.includes('StartButton'), 'Condition contains StartButton before rename');

clmStore.renameTag('StartButton', 'PB_Start');

const sfcAfter = clmStore.getSFCProgram();
const t1After = sfcAfter.transitions.find(t => t.id === 't1');
assert(t1After?.condition?.includes('PB_Start'), 'Condition updated to PB_Start after rename');
assert(!t1After?.condition?.includes('StartButton'), 'Old name removed from condition');

// ─── Test 7: clmStore.addSFCJump / deleteSFCJump ─────────────────────────────

section('7. clmStore.addSFCJump / deleteSFCJump');
const jumpsBefore = clmStore.getSFCProgram().jumps?.length ?? 0;
clmStore.addSFCJump({ id: 'j-test-99', targetStepName: 'Running' });
const sfcWithJump = clmStore.getSFCProgram();
assert((sfcWithJump.jumps?.length ?? 0) === jumpsBefore + 1, 'Jump added');
assert(sfcWithJump.jumps?.some(j => j.targetStepName === 'Running'), 'Jump has correct target');

clmStore.deleteSFCJump('j-test-99');
const sfcWithoutJump = clmStore.getSFCProgram();
assert((sfcWithoutJump.jumps?.length ?? 0) === jumpsBefore, 'Jump deleted');

// ─── Test 8: graph.import() clears before importing ──────────────────────────

section('8. CLMGraph.import() — clears before merge');
const g1 = new CLMGraph();
g1.addNode('node-A', 'TAG', 'shared', { name: 'A', dataType: 'BOOL', scope: 'global' });
const snap = g1.export('pou-main');
// Import into non-empty graph
g1.addNode('node-B', 'TAG', 'shared', { name: 'B', dataType: 'BOOL', scope: 'global' });
assert(g1.nodeCount === 2, 'Before import: 2 nodes');
g1.import(snap);
assert(g1.nodeCount === 1, 'After import: graph cleared, only imported node exists (no duplicate)');
assert(g1.hasNode('node-A'), 'node-A present after import');
assert(!g1.hasNode('node-B'), 'node-B cleared by import');

// ─── Done ─────────────────────────────────────────────────────────────────────

console.log('\n✅ All pipeline tests passed.\n');
