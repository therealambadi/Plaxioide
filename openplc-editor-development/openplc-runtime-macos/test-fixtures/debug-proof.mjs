/**
 * debug-proof.mjs — Windows CI motor-start latch proof
 * Identical protocol to /tmp/debug-final.mjs from macOS session.
 * Run: node debug-proof.mjs <node_modules_path>
 */
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const https = require('https');

// Accept node_modules path as argument (handles Windows backslash paths)
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
    req.write(data);
    req.end();
  });
}

async function cmd(socket, hexCmd) {
  const resp = await new Promise((resolve) => {
    const t = setTimeout(() => resolve({ timeout: true }), 6000);
    socket.once('debug_response', d => { clearTimeout(t); resolve(d); });
    socket.emit('debug_command', { command: hexCmd });
  });
  const clean = (resp.data || '').replace(/\s+/g, '');
  const buf = Buffer.from(clean, 'hex');
  return { buf, ok: buf.length >= 2 && buf[1] === 0x7E };
}

const GET_CMD  = '44000300000000000100000300';
const FORCE_ON = '42' + '00' + '0000' + '01' + '0001' + '01';
const FORCE_OFF = '42' + '00' + '0000' + '00' + '0000';

function parseGetList(buf) {
  if (!buf || buf.length < 10 || buf[1] !== 0x7E) return null;
  const scan = buf.readUInt32BE(4);
  const psz  = buf.readUInt16BE(8);
  const pay  = buf.slice(10, 10 + psz);
  return {
    scan,
    PB_START:  pay.length >= 1 ? pay[0] !== 0 : null,
    PB_STOP:   pay.length >= 2 ? pay[1] !== 0 : null,
    MOTOR_RUN: pay.length >= 3 ? pay[2] !== 0 : null,
  };
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

  console.log('\n── Read #1 (baseline) ──');
  const r1 = await cmd(socket, GET_CMD);
  const v1 = parseGetList(r1.buf);
  if (v1) console.log(`  scan=${v1.scan}  PB_START=${v1.PB_START}  PB_STOP=${v1.PB_STOP}  MOTOR_RUN=${v1.MOTOR_RUN}`);
  else { console.log('  FAILED to read baseline'); process.exit(1); }

  console.log('\nForcing PB_START=TRUE (FC 0x42)...');
  const fr = await cmd(socket, FORCE_ON);
  console.log(`  force result: ${fr.ok ? '0x7E SUCCESS' : '0x' + fr.buf[1]?.toString(16)}`);

  await new Promise(r => setTimeout(r, 400));

  console.log('\n── Read #2 (after forcing PB_START=TRUE) ──');
  const r2 = await cmd(socket, GET_CMD);
  const v2 = parseGetList(r2.buf);
  if (v2) console.log(`  scan=${v2.scan}  PB_START=${v2.PB_START}  PB_STOP=${v2.PB_STOP}  MOTOR_RUN=${v2.MOTOR_RUN}`);

  console.log('\nReleasing force on PB_START...');
  await cmd(socket, FORCE_OFF);
  await new Promise(r => setTimeout(r, 300));

  console.log('\n── Read #3 (after releasing force) ──');
  const r3 = await cmd(socket, GET_CMD);
  const v3 = parseGetList(r3.buf);
  if (v3) console.log(`  scan=${v3.scan}  PB_START=${v3.PB_START}  PB_STOP=${v3.PB_STOP}  MOTOR_RUN=${v3.MOTOR_RUN}`);

  console.log('\n══════════════════════════════════════════════════════════════');
  if (v2?.MOTOR_RUN === true) {
    console.log('✅ MOTOR_RUN = TRUE after forcing PB_START=TRUE');
    console.log('✅ Full round-trip confirmed: PB_START force → MOTOR_RUN coil latched');
    if (v3?.MOTOR_RUN === true)
      console.log('✅ MOTOR_RUN stays TRUE after releasing PB_START (seal-in working)');
  } else {
    console.log(`❌ MOTOR_RUN = ${v2?.MOTOR_RUN} (expected TRUE)`);
    process.exit(1);
  }
  console.log(`scan counter: #1=${v1.scan} → #2=${v2?.scan} → #3=${v3?.scan}`);
  console.log('══════════════════════════════════════════════════════════════');
  socket.disconnect();
}

main().catch(e => { console.error('FAILED:', e.message); process.exit(1); });
