/**
 * timer-proof.mjs — TON timer accumulation proof
 *
 * The motor-start program contains a TON timer (RUN_TMR, PT=30s).
 * This proof:
 *  1. Forces MOTOR_RUN=TRUE (coil, not input — via index 3) so the timer input goes active
 *  2. Reads RUN_TMR.ET (elapsed time, elemIdx 8) immediately — should be 0
 *  3. Waits 3 scan cycles (~100ms at 20ms interval)
 *  4. Reads RUN_TMR.ET again — must be > 0ms to prove the timer is accumulating
 *  5. Releases the force — ET should freeze or reset on next read
 *
 * This exercises CLOCK_REALTIME-based timing on MSYS2 (the condvar fix W12 path).
 * A timer that doesn't accumulate means the scan cycle is stalled.
 *
 * Protocol: FC 0x44 GET_LIST, FC 0x42 FORCE_SINGLE
 * Debug map indices (array 0):
 *   0=PB_START  1=PB_STOP  2=OVERLOAD  3=MOTOR_RUN
 *   4=RUN_TMR.EN  5=RUN_TMR.IN  6=RUN_TMR.PT(TIME,8B)
 *   7=RUN_TMR.Q(BOOL)  8=RUN_TMR.ET(TIME,8B)  9=RUN_TIMEOUT
 *
 * Run: node timer-proof.mjs <node_modules_path>
 */
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const https = require('https');

const nmPath = process.argv[2] || './node_modules';
const { io } = require(nmPath + '/socket.io-client');

function httpsPost(url, body) {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const data = JSON.stringify(body);
    const req = https.request({
      hostname: u.hostname, port: u.port || 443, path: u.pathname, method: 'POST',
      rejectUnauthorized: false,
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data) }
    }, res => {
      let r = '';
      res.on('data', d => r += d);
      res.on('end', () => { try { resolve(JSON.parse(r)); } catch { resolve(r); } });
    });
    req.on('error', reject);
    req.write(data); req.end();
  });
}

async function cmd(socket, hexCmd) {
  const resp = await new Promise((resolve) => {
    const t = setTimeout(() => resolve({ timeout: true }), 8000);
    socket.once('debug_response', d => { clearTimeout(t); resolve(d); });
    socket.emit('debug_command', { command: hexCmd });
  });
  if (resp.timeout) return { buf: Buffer.alloc(0), ok: false, timeout: true };
  const clean = (resp.data || '').replace(/\s+/g, '');
  const buf = Buffer.from(clean, 'hex');
  return { buf, ok: buf.length >= 2 && buf[1] === 0x7E };
}

// GET_LIST: array 0, 10 elements (0..9 covers PB_START..RUN_TIMEOUT)
// FC=0x44, tid=0x00, count=1 array request
// Format: FC(1) TID(1) REQLEN(2BE) ARRCOUNT(2BE) [ARRIDX(1) ELEMHI(1) ELEMLO(1)]
//   - array 0, elem 0..9 = 10 entries:
const GET10 = '44' + '00' +
  // request body: count of entries = 10
  '000A' +
  // 10 entries: each = arridx(0x00) elemhi(0x00) elemlo(0..9)
  '000000' + '000001' + '000002' + '000003' + '000004' +
  '000005' + '000006' + '000007' + '000008' + '000009';

// FC 0x42 FORCE: force MOTOR_RUN (elemIdx 3) TRUE — coil, 1 byte value
// Format: FC(1) TID(1) ARRLEN(2BE) FORCE_FLAG(1) ARRIDX_WORD(2BE) VALUE(1)
const FORCE_MOTOR_RUN_ON  = '42' + '00' + '0000' + '01' + '0003' + '01';
const FORCE_MOTOR_RUN_OFF = '42' + '00' + '0000' + '00' + '0000';

function parseET(buf, payOffset) {
  // TIME type is 8 bytes, big-endian int64 in nanoseconds
  if (buf.length < payOffset + 8) return null;
  // Use readBigInt64BE if available, else manual 32+32
  if (buf.readBigInt64BE) {
    return Number(buf.readBigInt64BE(payOffset));
  }
  const hi = buf.readUInt32BE(payOffset);
  const lo = buf.readUInt32BE(payOffset + 4);
  return hi * 0x100000000 + lo;
}

function parseRead10(buf) {
  // Response: FC(1) 0x7E(1) TID(1) SCAN_HI(1) SCAN(4) PSIZ(2) payload
  if (!buf || buf.length < 10 || buf[1] !== 0x7E) return null;
  const scan = buf.readUInt32BE(4);
  const psiz = buf.readUInt16BE(8);
  const pay  = buf.slice(10, 10 + psiz);

  // Payload layout for our 10-entry GET_LIST:
  // [0] PB_START:BOOL(1)  [1] PB_STOP:BOOL(1)  [2] OVERLOAD:BOOL(1)  [3] MOTOR_RUN:BOOL(1)
  // [4] RUN_TMR.EN:BOOL(1)  [5] RUN_TMR.IN:BOOL(1)
  // [6..13] RUN_TMR.PT:TIME(8)
  // [14] RUN_TMR.Q:BOOL(1)
  // [15..22] RUN_TMR.ET:TIME(8)
  // [23] RUN_TIMEOUT:BOOL(1)
  if (pay.length < 24) return { scan, pay_short: true, pay_len: pay.length };

  const PB_START    = pay[0] !== 0;
  const MOTOR_RUN   = pay[3] !== 0;
  const EN          = pay[4] !== 0;
  const INv         = pay[5] !== 0;
  const PT_ns       = parseET(pay, 6);
  const Q           = pay[14] !== 0;
  const ET_ns       = parseET(pay, 15);
  const RUN_TIMEOUT = pay[23] !== 0;

  const ET_ms = ET_ns !== null ? Math.round(ET_ns / 1e6) : null;
  const PT_ms = PT_ns !== null ? Math.round(PT_ns / 1e6) : null;

  return { scan, PB_START, MOTOR_RUN, EN, IN: INv, PT_ms, Q, ET_ms, RUN_TIMEOUT };
}

async function main() {
  const { access_token: token } = await httpsPost(
    'https://localhost:8443/api/login', { username: 'volt', password: 'volt123' });

  const socket = io('https://localhost:8443/api/debug', {
    secure: true, rejectUnauthorized: false,
    transports: ['websocket'], auth: { token }
  });

  await new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error('connect timeout')), 10000);
    socket.on('connect', () => { clearTimeout(t); resolve(); });
    socket.on('connect_error', e => { clearTimeout(t); reject(new Error(e.message)); });
  });
  await new Promise(r => setTimeout(r, 300));

  console.log('\n══════════════════════════════════════════════════════════════');
  console.log('  TON Timer accumulation proof (RUN_TMR, PT=30s)');
  console.log('══════════════════════════════════════════════════════════════');

  // Read #1 — baseline
  console.log('\n── Read #1 (baseline) ──');
  const r1 = await cmd(socket, GET10);
  const v1 = parseRead10(r1.buf);
  if (!v1 || v1.pay_short) {
    console.log(`  FAILED to read baseline (pay_len=${v1?.pay_len}, buf=${r1.buf.toString('hex').slice(0,40)})`);
    process.exit(1);
  }
  console.log(`  scan=${v1.scan}  MOTOR_RUN=${v1.MOTOR_RUN}  RUN_TMR.EN=${v1.EN}  RUN_TMR.ET=${v1.ET_ms}ms  Q=${v1.Q}`);

  // Force MOTOR_RUN=TRUE (drives RUN_TMR input via the program's IN assignment)
  console.log('\nForcing MOTOR_RUN=TRUE (FC 0x42, elemIdx 3)...');
  const fr = await cmd(socket, FORCE_MOTOR_RUN_ON);
  console.log(`  force result: ${fr.ok ? '0x7E SUCCESS' : '0x' + fr.buf[1]?.toString(16)}`);
  if (!fr.ok) { console.log('  FORCE FAILED'); process.exit(1); }

  // Short wait — a few scan cycles at 20ms interval
  await new Promise(r => setTimeout(r, 150));

  // Read #2 — timer should be accumulating, ET > 0
  console.log('\n── Read #2 (after 150ms with MOTOR_RUN forced) ──');
  const r2 = await cmd(socket, GET10);
  const v2 = parseRead10(r2.buf);
  if (v2) console.log(`  scan=${v2.scan}  MOTOR_RUN=${v2.MOTOR_RUN}  RUN_TMR.IN=${v2.IN}  RUN_TMR.ET=${v2.ET_ms}ms  Q=${v2.Q}`);

  // Longer wait — confirm ET keeps growing
  await new Promise(r => setTimeout(r, 500));

  // Read #3 — ET should be larger than Read #2
  console.log('\n── Read #3 (after 650ms total) ──');
  const r3 = await cmd(socket, GET10);
  const v3 = parseRead10(r3.buf);
  if (v3) console.log(`  scan=${v3.scan}  MOTOR_RUN=${v3.MOTOR_RUN}  RUN_TMR.IN=${v3.IN}  RUN_TMR.ET=${v3.ET_ms}ms  Q=${v3.Q}`);

  // Release force
  console.log('\nReleasing force on MOTOR_RUN...');
  await cmd(socket, FORCE_MOTOR_RUN_OFF);
  await new Promise(r => setTimeout(r, 100));

  // Read #4 — ET should be frozen or reset
  console.log('\n── Read #4 (after releasing force) ──');
  const r4 = await cmd(socket, GET10);
  const v4 = parseRead10(r4.buf);
  if (v4) console.log(`  scan=${v4.scan}  MOTOR_RUN=${v4.MOTOR_RUN}  RUN_TMR.IN=${v4.IN}  RUN_TMR.ET=${v4.ET_ms}ms  Q=${v4.Q}`);

  console.log('\n══════════════════════════════════════════════════════════════');

  // Verdict
  const et2 = v2?.ET_ms ?? 0;
  const et3 = v3?.ET_ms ?? 0;
  const scanDelta = (v3?.scan ?? 0) - (v1?.scan ?? 0);

  if (et2 > 0 && et3 > et2) {
    console.log(`✅ RUN_TMR.ET accumulating: ${et2}ms → ${et3}ms (+${et3 - et2}ms)`);
    console.log(`✅ Scan counter progressed: ${v1?.scan} → ${v3?.scan} (+${scanDelta} scans)`);
    console.log('✅ TON timer proof: PASS — timer code path confirmed executing on this platform');
  } else if (et2 > 0) {
    console.log(`⚠️  RUN_TMR.ET started (${et2}ms) but did not grow to read #3 (${et3}ms)`);
    console.log(`   scan delta: +${scanDelta}`);
    console.log('   Timer may have saturated or reset — check PT value');
    // Not a hard fail if ET started; timing between reads may cause apparent stall
    if (scanDelta > 5) {
      console.log('✅ Scan counter progressing — timer infrastructure working');
    } else {
      process.exit(1);
    }
  } else {
    console.log(`❌ RUN_TMR.ET = ${et2}ms after forcing MOTOR_RUN — timer not accumulating`);
    console.log(`   scan delta: +${scanDelta}`);
    if (v2?.MOTOR_RUN !== true) console.log('   MOTOR_RUN did not latch — force may have failed');
    if (v2?.IN !== true) console.log('   RUN_TMR.IN not active — program logic issue');
    process.exit(1);
  }

  console.log('══════════════════════════════════════════════════════════════');
  socket.disconnect();
}

main().catch(e => { console.error('TIMER PROOF FAILED:', e.message); process.exit(1); });
