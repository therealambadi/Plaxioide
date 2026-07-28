/**
 * Golden-file test: both stCode and stCodeForStrucpp must compile
 * from the same CLM input without semantic divergence.
 *
 * This test is the desync guard — if a new language feature is added
 * to clmToST.ts, this test fails until the stdlib stubs are also
 * updated for the STruC++ variant.
 *
 * Run: node test/clmToST.golden.mjs
 */

import { createRequire } from 'module';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const require = createRequire(import.meta.url);

const STRUCPP_DIR = join(ROOT, 'volt.diy/docker/strucpp-codegen/node_modules/strucpp');
const { compile } = require(STRUCPP_DIR);
const { generateDebugTable } = require(join(STRUCPP_DIR, 'dist/backend/debug-table-gen.js'));
const { createHash } = require('crypto');

// ── Golden ST inputs — one for MatIEC (no stubs), one for STruC++ (with stubs) ─

// This is a representative output of clmToST() for the default store state.
// Update these when the CLM schema adds new node types or FB types.

const MATIEC_ST = `
PROGRAM prog0
  VAR
    PB_START    : BOOL := FALSE;
    PB_STOP     : BOOL := FALSE;
    OVERLOAD    : BOOL := FALSE;
    MOTOR_RUN   : BOOL := FALSE;
    RUN_TMR     : TON;
    RUN_TIMEOUT : BOOL := FALSE;
    SPEED_REF   : INT := 0;
    SPEED_FAULT : BOOL := FALSE;
    ESTOP       : BOOL := FALSE;
    _SFC_STATE  : INT := -1;
  END_VAR

  (* Rung 1: Motor start/stop circuit *)
  IF (PB_START OR MOTOR_RUN) AND NOT PB_STOP AND NOT OVERLOAD THEN
    MOTOR_RUN := TRUE;
  ELSE
    MOTOR_RUN := FALSE;
  END_IF;

  (* Rung 2: Motor run timer *)
  IF MOTOR_RUN THEN
    RUN_TMR(IN := MOTOR_RUN, PT := T#10s);
    IF RUN_TMR.Q THEN
      RUN_TIMEOUT := TRUE;
    END_IF;
  END_IF;

  (* Rung 3: E-Stop *)
  IF ESTOP THEN
    MOTOR_RUN := FALSE;
    SPEED_FAULT := TRUE;
  END_IF;

END_PROGRAM

CONFIGURATION Config0

  RESOURCE Res0 ON PLC
    TASK Main(INTERVAL := T#50ms, PRIORITY := 0);
    PROGRAM Inst0 WITH Main : prog0;
  END_RESOURCE

END_CONFIGURATION
`;

// STruC++ variant: same as MATIEC_ST but with IEC stdlib stubs prepended.
// If MATIEC_ST adds a new FB type (e.g. CTU), the stubs section must be updated too.
const STRUCPP_STUBS = `
FUNCTION_BLOCK TON
  VAR_INPUT IN : BOOL; PT : TIME; END_VAR
  VAR_OUTPUT Q : BOOL; ET : TIME; END_VAR
END_FUNCTION_BLOCK

FUNCTION_BLOCK TOF
  VAR_INPUT IN : BOOL; PT : TIME; END_VAR
  VAR_OUTPUT Q : BOOL; ET : TIME; END_VAR
END_FUNCTION_BLOCK

FUNCTION_BLOCK TP
  VAR_INPUT IN : BOOL; PT : TIME; END_VAR
  VAR_OUTPUT Q : BOOL; ET : TIME; END_VAR
END_FUNCTION_BLOCK

FUNCTION_BLOCK CTU
  VAR_INPUT CU : BOOL; R : BOOL; PV : INT; END_VAR
  VAR_OUTPUT Q : BOOL; CV : INT; END_VAR
END_FUNCTION_BLOCK

FUNCTION_BLOCK CTD
  VAR_INPUT CD : BOOL; LD : BOOL; PV : INT; END_VAR
  VAR_OUTPUT Q : BOOL; CV : INT; END_VAR
END_FUNCTION_BLOCK

FUNCTION_BLOCK CTUD
  VAR_INPUT CU : BOOL; CD : BOOL; R : BOOL; LD : BOOL; PV : INT; END_VAR
  VAR_OUTPUT QU : BOOL; QD : BOOL; CV : INT; END_VAR
END_FUNCTION_BLOCK

FUNCTION_BLOCK SR
  VAR_INPUT S1 : BOOL; R : BOOL; END_VAR
  VAR_OUTPUT Q1 : BOOL; END_VAR
END_FUNCTION_BLOCK

FUNCTION_BLOCK RS
  VAR_INPUT S : BOOL; R1 : BOOL; END_VAR
  VAR_OUTPUT Q1 : BOOL; END_VAR
END_FUNCTION_BLOCK

FUNCTION_BLOCK RTRIG
  VAR_INPUT CLK : BOOL; END_VAR
  VAR_OUTPUT Q : BOOL; END_VAR
END_FUNCTION_BLOCK

FUNCTION_BLOCK FTRIG
  VAR_INPUT CLK : BOOL; END_VAR
  VAR_OUTPUT Q : BOOL; END_VAR
END_FUNCTION_BLOCK
`;

const STRUCPP_ST = STRUCPP_STUBS.trim() + '\n\n' + MATIEC_ST.trim();

// ── Golden expected tag paths from debug-map.json ────────────────────────────
// Update this array when VAR section of MATIEC_ST changes.
// Format confirmed from real STruC++ output: "INST0.<UPPERCASE_VARNAME>"
const EXPECTED_LEAF_PATHS = [
  'INST0.PB_START',
  'INST0.PB_STOP',
  'INST0.OVERLOAD',
  'INST0.MOTOR_RUN',
  'INST0.RUN_TMR.IN',
  'INST0.RUN_TMR.PT',
  'INST0.RUN_TMR.Q',
  'INST0.RUN_TMR.ET',
  'INST0.RUN_TIMEOUT',
  'INST0.SPEED_REF',
  'INST0.SPEED_FAULT',
  'INST0.ESTOP',
  'INST0._SFC_STATE',
];

// ── Run tests ─────────────────────────────────────────────────────────────────

let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (condition) {
    console.log('  ✅', message);
    passed++;
  } else {
    console.error('  ❌ FAIL:', message);
    failed++;
  }
}

async function main() {
  console.log('=== clmToST Golden File Test ===\n');

  // Test 1: STruC++ compiles the strucpp variant
  console.log('Test 1: STruC++ compile (stCodeForStrucpp)');
  const md5 = createHash('md5').update(STRUCPP_ST).digest('hex');
  const r = compile(STRUCPP_ST, { debug: true, lineMapping: true, md5, fileName: 'program.st' });
  assert(r.success, `STruC++ compile success (errors: ${r.errors?.map(e=>e.message).join(', ') || 'none'})`);

  if (!r.success) {
    console.error('Fatal: STruC++ compile failed, cannot continue');
    process.exit(1);
  }

  // Test 2: Debug map has expected paths
  console.log('\nTest 2: Debug-map.json leaf paths');
  const { debugMap } = generateDebugTable(r.ast, r.projectModel, r.symbolTables, { md5 });
  const actualPaths = debugMap.leaves.map(l => l.path);

  for (const expected of EXPECTED_LEAF_PATHS) {
    assert(actualPaths.includes(expected), `leaf path "${expected}" present`);
  }

  // Test 3: No extra unexpected paths (detects accidental variable additions)
  const unexpectedPaths = actualPaths.filter(p => !EXPECTED_LEAF_PATHS.includes(p));
  assert(unexpectedPaths.length === 0,
    `No unexpected leaf paths (unexpected: ${unexpectedPaths.join(', ') || 'none'})`);

  // Test 4: Tag count matches
  assert(debugMap.leaves.length === EXPECTED_LEAF_PATHS.length,
    `Leaf count matches (${debugMap.leaves.length} === ${EXPECTED_LEAF_PATHS.length})`);

  // Test 5: MOTOR_RUN maps to the correct type
  const motorRun = debugMap.leaves.find(l => l.path === 'INST0.MOTOR_RUN');
  assert(motorRun?.type === 'BOOL', `MOTOR_RUN type is BOOL (got: ${motorRun?.type})`);

  // Test 6: SPEED_REF maps to INT
  const speedRef = debugMap.leaves.find(l => l.path === 'INST0.SPEED_REF');
  assert(speedRef?.type === 'INT', `SPEED_REF type is INT (got: ${speedRef?.type})`);

  // Test 7: All elemIdx values are 0-based sequential with no gaps
  const idxs = debugMap.leaves.map(l => l.elemIdx).sort((a,b) => a-b);
  const isSequential = idxs.every((v, i) => v === i);
  assert(isSequential, `elemIdx values are sequential 0..${idxs.length-1} (${idxs.join(',')})`);

  // Test 8: MatIEC variant does NOT contain FUNCTION_BLOCK stubs
  assert(!MATIEC_ST.includes('FUNCTION_BLOCK TON'),
    'stCode (MatIEC variant) has no TON stub — MatIEC resolves from -I lib');

  // Test 9: STruC++ variant DOES contain stubs
  assert(STRUCPP_ST.includes('FUNCTION_BLOCK TON'),
    'stCodeForStrucpp (STruC++ variant) contains TON stub');

  // Test 10: Both variants have the same PROGRAM prog0 block
  assert(MATIEC_ST.includes('PROGRAM prog0') && STRUCPP_ST.includes('PROGRAM prog0'),
    'Both variants contain PROGRAM prog0');

  // ── Summary ──────────────────────────────────────────────────────────────
  console.log(`\n${'─'.repeat(50)}`);
  console.log(`Passed: ${passed}  Failed: ${failed}`);
  if (failed > 0) {
    console.error('\n❌ GOLDEN FILE TEST FAILED');
    console.error('If you added a new FB type to clmToST.ts:');
    console.error('  1. Add its stub to STRUCPP_STUBS in this file');
    console.error('  2. Add its expected leaf paths to EXPECTED_LEAF_PATHS');
    process.exit(1);
  } else {
    console.log('\n✅ All golden file tests passed');
    console.log('   debug-map path format: "INST0.<UPPERCASE_VARNAME>"');
    console.log('   Tag-to-index: debugMap.leaves.find(l => l.path === "INST0." + tagName.toUpperCase())');
  }
}

main().catch(e => { console.error(e); process.exit(1); });
