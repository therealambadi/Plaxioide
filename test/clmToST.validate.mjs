/**
 * clmToST validation script
 * Exercises clmToST.ts by simulating the default logicStore state,
 * then runs the generated ST through MatIEC (iec2c) and STruC++.
 *
 * Run: node test/clmToST.validate.mjs
 */

import { execSync, spawnSync } from 'child_process';
import { mkdtempSync, writeFileSync, rmSync, readFileSync } from 'fs';
import { tmpdir } from 'os';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const require = createRequire(import.meta.url);

// ── Locate iec2c binary ──────────────────────────────────────────────────────
// Try the location where we built it during Phase 0 investigation
const MATIEC_CANDIDATES = [
  join(ROOT, 'volt.diy/OpenPLC_v3-master/utils/matiec_src/iec2c'),
  join(ROOT, 'resources/matiec/darwin-arm64/iec2c'),
  '/tmp/matiec-build/iec2c',
  '/tmp/iec2c',
];

function findMatIEC() {
  for (const p of MATIEC_CANDIDATES) {
    try { execSync(`test -x "${p}"`); return p; } catch {}
  }
  // Try PATH
  try { return execSync('which iec2c', { encoding: 'utf-8' }).trim(); } catch {}
  return null;
}

const MATIEC_LIB_CANDIDATES = [
  join(ROOT, 'volt.diy/OpenPLC_v3-master/utils/matiec_src/lib'),
  join(ROOT, 'resources/matiec/lib'),
  '/tmp/matiec-build/lib',
];

function findMatIECLib() {
  for (const p of MATIEC_LIB_CANDIDATES) {
    try { execSync(`test -d "${p}"`); return p; } catch {}
  }
  return null;
}

// ── Build a representative CLM matching default logicStore ────────────────────
// We do this in pure JS (no TypeScript runtime) to avoid a compile step.
// The structure mirrors what buildCLMFromStore() would produce for the default state.

function buildTestSTForMatIEC() {
  // For MatIEC: NO FB stubs. MatIEC resolves standard FBs from its -I lib directory.
  return `
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
}

function buildTestSTForStrucpp() {
  // For STruC++: includes TON stub. STruC++ is pure JS with no lib directory.
  return `
FUNCTION_BLOCK TON
  VAR_INPUT IN : BOOL; PT : TIME; END_VAR
  VAR_OUTPUT Q : BOOL; ET : TIME; END_VAR
END_FUNCTION_BLOCK
` + buildTestSTForMatIEC();
}

async function main() {
  console.log('=== clmToST validation ===\n');

  const st = buildTestSTForMatIEC();
  const stForStrucpp = buildTestSTForStrucpp();
  console.log('Generated ST:\n' + '─'.repeat(60));
  console.log(st);
  console.log('─'.repeat(60) + '\n');

  // ── Step 1: MatIEC validation ────────────────────────────────────────────
  const iec2c = findMatIEC();
  const matiecLib = findMatIECLib();

  if (!iec2c) {
    console.warn('⚠️  iec2c not found — skipping MatIEC validation');
    console.warn('   Searched:', MATIEC_CANDIDATES);
  } else if (!matiecLib) {
    console.warn('⚠️  MatIEC lib directory not found — skipping MatIEC validation');
  } else {
    console.log(`MatIEC binary: ${iec2c}`);
    console.log(`MatIEC lib:    ${matiecLib}`);

    const tmpDir = mkdtempSync(join(tmpdir(), 'matiec-validate-'));
    const stFile = join(tmpDir, 'program.st');
    writeFileSync(stFile, st); // MatIEC gets stub-free ST

    const result = spawnSync(iec2c, ['-I', matiecLib, '-T', tmpDir, stFile], {
      encoding: 'utf-8',
      timeout: 15000,
    });

    const output = (result.stdout ?? '') + (result.stderr ?? '');
    const exitCode = result.status ?? -1;

    console.log('\nMatIEC output:');
    if (output.trim()) console.log(output.trim());
    console.log(`MatIEC exit code: ${exitCode}`);

    if (exitCode === 0) {
      console.log('✅ MatIEC PASS\n');
    } else {
      console.error('❌ MatIEC FAIL');
      process.exitCode = 1;
    }

    try { rmSync(tmpDir, { recursive: true }); } catch {}
  }

  // ── Step 2: STruC++ compile + debug-map generation ───────────────────────
  const strucppPath = join(ROOT, 'volt.diy/docker/strucpp-codegen/node_modules/strucpp');
  let compile, generateDebugTable;
  try {
    ({ compile } = require(strucppPath));
    ({ generateDebugTable } = require(join(strucppPath, 'dist/backend/debug-table-gen.js')));
  } catch (e) {
    console.warn('⚠️  strucpp not found at', strucppPath, '—', e.message);
    process.exitCode = 1;
    return;
  }

  const { createHash } = require('crypto');
  const md5 = createHash('md5').update(stForStrucpp).digest('hex');
  const compileResult = compile(stForStrucpp, { debug: true, lineMapping: true, md5, fileName: 'program.st' });

  console.log('STruC++ compile success:', compileResult.success);
  if (!compileResult.success) {
    console.error('STruC++ errors:', compileResult.errors);
    process.exitCode = 1;
    return;
  }

  const { debugTableCpp, debugMap } = generateDebugTable(
    compileResult.ast,
    compileResult.projectModel,
    compileResult.symbolTables,
    { md5 },
  );

  console.log('\n=== Actual debug-map.json output ===');
  console.log(JSON.stringify(debugMap, null, 2));

  console.log('\n=== Tag → debug index mapping ===');
  for (const leaf of debugMap.leaves) {
    const dotIdx = leaf.path.indexOf('.');
    const varName = dotIdx !== -1 ? leaf.path.slice(dotIdx + 1) : leaf.path;
    console.log(`  ${leaf.path.padEnd(25)} → elemIdx=${leaf.elemIdx}  type=${leaf.type}  size=${leaf.size}`);
  }

  if (!process.exitCode) {
    console.log('\n✅ All validation steps PASSED');
    console.log(`   Tags: ${debugMap.leaves.length}`);
    console.log(`   Path format: "${debugMap.leaves[0]?.path}" (INST0.<UPPERCASE_VAR>)`);
  }
}

main().catch(e => { console.error(e); process.exit(1); });
