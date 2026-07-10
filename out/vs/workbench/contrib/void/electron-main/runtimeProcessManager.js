/*--------------------------------------------------------------------------------------
 *  Volt Platform — Runtime Process Manager (Electron main process)
 *  Manages the lifecycle of the plc-webserver child process and the debug tag poller.
 *--------------------------------------------------------------------------------------*/

/* eslint-disable */
import * as fs from 'fs';
import * as path from 'path';
import * as child_process from 'child_process';
import * as https from 'https';
import * as crypto from 'crypto';
import { createRequire } from 'module';
/* eslint-enable */

// createRequire needs a file:// URL or absolute path.
// In Electron main, import.meta.url uses vscode-file:// protocol — we must
// use the already-resolved _repoRoot to construct a valid file path.
// _repoRoot is set a few lines below; we create the require lazily on first use.
let _cjsRequire = null;
function getCjsRequire() {
	if (!_cjsRequire) {
		// Use the absolute filesystem path directly (works regardless of URL protocol)
		_cjsRequire = createRequire(_repoRoot + '/package.json');
	}
	return _cjsRequire;
}

import { app, ipcMain, BrowserWindow, safeStorage } from 'electron';
import { io as socketIOClient } from 'socket.io-client';

import { PLC_IPC } from '../common/runtimeProcessManagerTypes.js';

// ─── Constants ────────────────────────────────────────────────────────────────

const WEBSERVER_URL   = 'https://localhost:8443';
const DEBUG_NAMESPACE = '/api/debug';
const INTERNAL_USER   = 'volt-internal';
const CREDS_FILENAME  = 'plc-runtime-creds.enc';

const STARTUP_POLL_INTERVAL_MS  = 500;
const STARTUP_TIMEOUT_MS        = 30_000;
const TAG_POLL_INTERVAL_MS      = 200;
const DEBUG_RECONNECT_DELAY_MS  = 1_000;
const STOP_SIGKILL_TIMEOUT_MS   = 3_000;
const CRASH_RESTART_DELAY_MS    = 2_000;
const CRASH_WINDOW_MS           = 30_000;
const CRASH_THRESHOLD           = 3;

// FC 0x43 READ request: arr=0, start=0x0000, end=0x000d (elements 0..13)
const DEBUG_READ_CMD = '43000000000d';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function httpsGet(url) {
	return new Promise((resolve, reject) => {
		const req = https.get(url, { rejectUnauthorized: false }, (res) => {
			let body = '';
			res.on('data', (chunk) => { body += chunk; });
			res.on('end', () => resolve({ status: res.statusCode ?? 0, body }));
		});
		req.on('error', reject);
		req.setTimeout(5000, () => { req.destroy(new Error('timeout')); });
	});
}

function httpsPost(url, payload, jwt) {
	return new Promise((resolve, reject) => {
		const data = JSON.stringify(payload);
		const headers = {
			'Content-Type': 'application/json',
			'Content-Length': Buffer.byteLength(data).toString(),
		};
		if (jwt) headers['Authorization'] = `Bearer ${jwt}`;

		const parsed = new URL(url);
		const req = https.request(
			{
				hostname: parsed.hostname,
				port: parsed.port,
				path: parsed.pathname,
				method: 'POST',
				headers,
				rejectUnauthorized: false,
			},
			(res) => {
				let body = '';
				res.on('data', (chunk) => { body += chunk; });
				res.on('end', () => resolve({ status: res.statusCode ?? 0, body }));
			}
		);
		req.on('error', reject);
		req.setTimeout(5000, () => { req.destroy(new Error('timeout')); });
		req.write(data);
		req.end();
	});
}

function sleep(ms) {
	return new Promise((resolve) => setTimeout(resolve, ms));
}

// ─── Credential storage ───────────────────────────────────────────────────────

function loadOrCreateCredentials() {
	// Use a stable dev password stored as plain text — this is an internal
	// service account, not user-facing. The webserver runs locally only.
	const credsPath = path.join(app.getPath('userData'), CREDS_FILENAME);
	if (fs.existsSync(credsPath)) {
		try {
			const stored = fs.readFileSync(credsPath, 'utf8').trim();
			if (stored && !stored.includes('\x00')) return stored;
		} catch {}
	}
	// First run or corrupted: generate and store as plain text
	const password = crypto.randomBytes(16).toString('hex');
	fs.writeFileSync(credsPath, password, 'utf8');
	return password;
}

// ─── Tag Poller ───────────────────────────────────────────────────────────────

class PlcDebugPoller {
	constructor(jwt, onTagFrame, onLog) {
		this.jwt = jwt;
		this.onTagFrame = onTagFrame;
		this.onLog = onLog;
		this.socket = null;
		this.intervalId = null;
		this.stopped = false;
	}

	start() {
		this.stopped = false;
		this._connect();
	}

	stop() {
		this.stopped = true;
		this._clearInterval();
		if (this.socket) {
			this.socket.disconnect();
			this.socket = null;
		}
	}

	_connect() {
		if (this.stopped) return;

		this.socket = socketIOClient(`${WEBSERVER_URL}${DEBUG_NAMESPACE}`, {
			auth: { token: this.jwt },
			rejectUnauthorized: false,
			secure: true,
			transports: ['websocket'],
		});

		this.socket.on('connect', () => {
			this.onLog('[debug-poller] connected');
			this._startInterval();
		});

		this.socket.on('debug_response', (data) => {
			if (!data.success || !data.data) return;
			try {
				const buf = Buffer.from(data.data, 'hex');
				// Header: [FC(1), STATUS(1), last_elem_u16be(2), tick_u32be(4), resp_size_u16be(2)] = 10 bytes
				if (buf.length < 10) return;
				const tick = buf.readUInt32BE(4);
				const respSize = buf.readUInt16BE(8);
				const tagBytes = Array.from(buf.subarray(10, 10 + respSize));
				this.onTagFrame({ tick, tagBytes });
			} catch (e) {
				this.onLog(`[debug-poller] parse error: ${e}`);
			}
		});

		this.socket.on('disconnect', (reason) => {
			this.onLog(`[debug-poller] disconnected: ${reason}`);
			this._clearInterval();
			if (!this.stopped) {
				setTimeout(() => this._connect(), DEBUG_RECONNECT_DELAY_MS);
			}
		});

		this.socket.on('connect_error', (err) => {
			this.onLog(`[debug-poller] connect_error: ${err.message}`);
			if (!this.stopped) {
				setTimeout(() => this._connect(), DEBUG_RECONNECT_DELAY_MS);
			}
		});
	}

	_startInterval() {
		this._clearInterval();
		this.intervalId = setInterval(() => {
			if (this.socket?.connected) {
				this.socket.emit('debug_command', { command: DEBUG_READ_CMD });
			}
		}, TAG_POLL_INTERVAL_MS);
	}

	_clearInterval() {
		if (this.intervalId !== null) {
			clearInterval(this.intervalId);
			this.intervalId = null;
		}
	}
}

// ─── Compiler helpers (run in main process — renderer cannot spawn) ───────────

const _repoRoot = path.resolve(path.dirname(new URL(import.meta.url).pathname), '../../../../../..');

// In packaged app: process.resourcesPath/plc-runtime/
// In dev: resources/plc-runtime/ inside the repo
function _plcRuntimeRoot() {
	if (app.isPackaged) return path.join(process.resourcesPath, 'plc-runtime');
	return path.join(_repoRoot, 'resources', 'plc-runtime');
}

function _findMatiec() {
	const rt = _plcRuntimeRoot();
	const isWin = process.platform === 'win32';
	const arch  = process.arch === 'arm64' ? 'darwin-arm64' : 'darwin-x64';

	const candidates = isWin
		? [ path.join(rt, 'matiec', 'win32-x64', 'iec2c.exe') ]
		: [
			path.join(rt, 'matiec', arch, 'iec2c'),
			path.join(rt, 'matiec', 'darwin-arm64', 'iec2c'),
			path.join(rt, 'matiec', 'darwin-x64',  'iec2c'),
			path.join(rt, 'matiec', 'linux-x64',   'iec2c'),
		];

	const libCandidates = [ path.join(rt, 'matiec', 'lib') ];
	const iec2c = candidates.find(p => { try { fs.accessSync(p); return true; } catch { return false; } });
	const lib   = libCandidates.find(p => { try { fs.accessSync(p); return true; } catch { return false; } });
	return { iec2c: iec2c ?? null, lib: lib ?? null };
}

async function runMatiec(stCode) {
	const os = await import('os');
	const { iec2c, lib } = _findMatiec();
	if (!iec2c || !lib) {
		return { success: false, errors: ['iec2c binary not found'] };
	}

	const tmpDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'volt-matiec-'));
	const stFile = path.join(tmpDir, 'program.st');
	await fs.promises.writeFile(stFile, stCode);

	// On Windows, iec2c.exe needs its DLLs (libgcc, libstdc++) in PATH
	const spawnEnv = process.platform === 'win32'
		? { ...process.env, PATH: `${path.dirname(iec2c)};${process.env.PATH ?? ''}` }
		: process.env;

	return new Promise(resolve => {
		const proc = child_process.spawn(iec2c, ['-I', lib, '-T', tmpDir, stFile], { env: spawnEnv });
		let output = '';
		proc.stdout?.on('data', d => { output += d; });
		proc.stderr?.on('data', d => { output += d; });
		proc.on('close', async code => {
			await fs.promises.rm(tmpDir, { recursive: true }).catch(() => {});
			if (code === 0) {
				resolve({ success: true, errors: [] });
			} else {
				const errors = output.split('\n')
					.filter(l => l.includes('error:') || l.includes('warning:'))
					.map(l => l.trim()).filter(Boolean);
				resolve({ success: false, errors: errors.length > 0 ? errors : [output.trim() || 'Unknown MatIEC error'] });
			}
		});
		proc.on('error', err => resolve({ success: false, errors: [`Failed to spawn iec2c: ${err.message}`] }));
	});
}

async function _findStrucpp() {
	const rt = _plcRuntimeRoot();
	const candidates = [
		path.join(rt, 'strucpp'),
		path.join(_repoRoot, 'node_modules', 'strucpp'),
	];
	for (const p of candidates) {
		try {
			const realP = fs.realpathSync(p);
			// strucpp is ESM ("type":"module") — must use dynamic import, not require
			const fileUrl = 'file://' + realP + '/dist/index.js';
			const mod = await import(fileUrl);
			return { mod: mod.default ?? mod, base: realP };
		} catch {}
	}
	return null;
}

function _findJszip() {
	const rt = _plcRuntimeRoot();
	const candidates = [
		path.join(rt, 'strucpp', 'node_modules', 'jszip'),
		path.join(_repoRoot, 'node_modules', 'jszip'),
		path.join(_repoRoot, 'node_modules', 'strucpp', 'node_modules', 'jszip'),
	];
	for (const p of candidates) {
		try {
			const realP = fs.realpathSync(p);
			return getCjsRequire()(realP);
		} catch {}
	}
	return null;
}

async function runStrucpp(stCode, programName) {
	const crypto = await import('crypto');

	const found = await _findStrucpp();
	if (!found) return { zipBase64: null, debugMapJson: '{}', errors: ['strucpp module not found'] };

	const JSZip = _findJszip();
	if (!JSZip) return { zipBase64: null, debugMapJson: '{}', errors: ['jszip not found'] };

	let generateDebugTable = null;
	try {
		const dbgMod = await import('file://' + path.join(found.base, 'dist', 'backend', 'debug-table-gen.js'));
		generateDebugTable = (dbgMod.default ?? dbgMod).generateDebugTable ?? dbgMod.generateDebugTable;
	} catch {}

	const md5 = crypto.createHash('md5').update(stCode).digest('hex');
	const compileResult = found.mod.compile(stCode, { debug: true, lineMapping: true, md5, fileName: `${programName}.st` });

	if (!compileResult.success) {
		const errors = (compileResult.errors ?? []).map(e => e.message ?? String(e));
		return { zipBase64: null, debugMapJson: '{}', errors };
	}

	let debugTableCpp = '// No debug table\n';
	let debugMap = { version: 2, md5, typeTags: {}, arrays: [], leaves: [] };
	if (generateDebugTable && compileResult.ast && compileResult.projectModel && compileResult.symbolTables) {
		try {
			const r = generateDebugTable(compileResult.ast, compileResult.projectModel, compileResult.symbolTables, { md5 });
			debugTableCpp = r.debugTableCpp;
			debugMap = r.debugMap;
		} catch {}
	}

	const zip = new JSZip();
	zip.file('generated.hpp', compileResult.headerCode);
	for (const f of compileResult.cppFiles) zip.file(f.name, f.content);
	zip.file('generated_debug.cpp', debugTableCpp);
	zip.file('debug-map.json', JSON.stringify(debugMap, null, 2));
	zip.file('program.st', stCode);
	zip.file('defines.h', `#pragma once\n#define PROGRAM_MD5 "${md5}"\n`);
	zip.file('c_blocks.h', '// Empty\n');

	// Runtime headers
	const headerDirs = [
		path.join(_plcRuntimeRoot(), 'strucpp-runtime-headers'),
	];
	for (const dir of headerDirs) {
		try {
			const files = await fs.promises.readdir(dir);
			for (const file of files) {
				if (file.endsWith('.hpp') || file.endsWith('.h')) {
					const content = await fs.promises.readFile(path.join(dir, file), 'utf-8');
					zip.file(`strucpp_runtime/include/${file}`, content);
				}
			}
			break;
		} catch {}
	}

	const zipBuffer = await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' });
	return {
		zipBase64: zipBuffer.toString('base64'),
		debugMapJson: JSON.stringify(debugMap),
		errors: [],
	};
}

// ─── Runtime Process Manager ──────────────────────────────────────────────────

export class RuntimeProcessManager {
	constructor() {
		this.status = 'stopped';
		this.statusSince = new Date().toISOString();
		this.terminalError = undefined;
		this.webserverProcess = null;
		this.debugPoller = null;
		this.jwt = null;
		this.crashTimestamps = [];
		this.currentProjectPath = null;

		this._registerIpcHandlers();

		app.on('before-quit', () => {
			this._killWebserver();
		});
	}

	// ─── IPC registration ─────────────────────────────────────────────────────

	_registerIpcHandlers() {
		ipcMain.handle(PLC_IPC.START, async (_event, params) => {
			console.log('[IPC] plc-start invoked, projectPath:', params?.projectPath);
			const result = await this.start(params.projectPath);
			console.log('[IPC] plc-start result:', JSON.stringify(result));
			return result;
		});

		ipcMain.handle(PLC_IPC.STOP, async () => {
			return this.stop();
		});

		ipcMain.handle(PLC_IPC.STATUS_REQ, async () => {
			return this.getStatus();
		});

		ipcMain.handle(PLC_IPC.MATIEC, async (_event, params) => {
			console.log('[IPC] plc-compile-matiec invoked, stCode length:', params?.stCode?.length);
			// Write ST to /tmp for debugging
			try { fs.writeFileSync('/tmp/plc-generated.st', params?.stCode ?? ''); } catch {}
			const result = await runMatiec(params.stCode);
			console.log('[IPC] plc-compile-matiec result:', JSON.stringify(result));
			return result;
		});

		ipcMain.handle(PLC_IPC.STRUCPP, async (_event, params) => {
			console.log('[IPC] plc-compile-strucpp invoked, programName:', params?.programName);
			const result = await runStrucpp(params.stCode, params.programName);
			console.log('[IPC] plc-compile-strucpp result errors:', result?.errors, 'zipBase64 len:', result?.zipBase64?.length ?? 'null');
			return result;
		});

		ipcMain.handle(PLC_IPC.FETCH, async (_event, params) => {
			// Use https.request (not fetch) — Node built-in fetch ignores the https.Agent option
			return new Promise((resolve) => {
				try {
					// https is imported at top of file as ESM import
					const url = new URL(params.url);
					const bodyBuf = params.body ? Buffer.from(params.body) : null;
					const reqOptions = {
						hostname: url.hostname,
						port: url.port || 443,
						path: url.pathname + url.search,
						method: params.method || 'GET',
						headers: { ...(params.headers || {}) },
						rejectUnauthorized: false,
					};
					if (bodyBuf) reqOptions.headers['Content-Length'] = String(bodyBuf.length);
					const req = https.request(reqOptions, (res) => {
						let data = '';
						res.on('data', (d) => { data += d; });
						res.on('end', () => {
							console.log('[IPC] plc-fetch', reqOptions.method, params.url, '->', res.statusCode);
							resolve({ ok: res.statusCode >= 200 && res.statusCode < 300, status: res.statusCode, body: data });
						});
					});
					req.on('error', (e) => {
						console.log('[IPC] plc-fetch error:', String(e));
						resolve({ ok: false, status: 0, body: '', error: String(e) });
					});
					if (bodyBuf) req.write(bodyBuf);
					req.end();
				} catch (e) {
					console.log('[IPC] plc-fetch error:', String(e));
					resolve({ ok: false, status: 0, body: '', error: String(e) });
				}
			});
		});

		ipcMain.handle(PLC_IPC.UPLOAD_ZIP, async (_event, params) => {
			// Build multipart/form-data and POST using https.request (not fetch)
			return new Promise((resolve) => {
				try {
					// https is imported at top of file as ESM import
					const zipBuf = Buffer.from(params.zipBase64, 'base64');
					const boundary = '----FormBoundary' + Date.now().toString(36);
					const CRLF = '\r\n';
					const header = Buffer.from(
						'--' + boundary + CRLF +
						`Content-Disposition: form-data; name="file"; filename="${params.filename}"` + CRLF +
						'Content-Type: application/zip' + CRLF + CRLF
					);
					const footer = Buffer.from(CRLF + '--' + boundary + '--' + CRLF);
					const body = Buffer.concat([header, zipBuf, footer]);
					const reqOptions = {
						hostname: 'localhost',
						port: 8443,
						path: '/api/upload-file',
						method: 'POST',
						headers: {
							'Authorization': `Bearer ${params.token}`,
							'Content-Type': `multipart/form-data; boundary=${boundary}`,
							'Content-Length': String(body.length),
						},
						rejectUnauthorized: false,
					};
					const req = https.request(reqOptions, (res) => {
						let data = '';
						res.on('data', (d) => { data += d; });
						res.on('end', () => {
							console.log('[IPC] plc-upload-zip ->', res.statusCode, data.slice(0, 120));
							resolve({ ok: res.statusCode >= 200 && res.statusCode < 300, status: res.statusCode, body: data });
						});
					});
					req.on('error', (e) => {
						console.log('[IPC] plc-upload-zip error:', String(e));
						resolve({ ok: false, status: 0, body: '', error: String(e) });
					});
					req.write(body);
					req.end();
				} catch (e) {
					console.log('[IPC] plc-upload-zip error:', String(e));
					resolve({ ok: false, status: 0, body: '', error: String(e) });
				}
			});
		});

		ipcMain.handle(PLC_IPC.GET_TOKEN, async () => {
			if (!this.jwt) {
				try { await this._authBootstrap(); } catch (e) {
					return { ok: false, error: String(e) };
				}
			}
			return { ok: true, token: this.jwt };
		});

		ipcMain.handle(PLC_IPC.START_DEBUG_POLLER, async () => {
			try {
				if (!this.jwt) {
					await this._authBootstrap();
				}
				if (!this.debugPoller) {
					this._startDebugPoller();
					console.log('[IPC] START_DEBUG_POLLER: poller started');
				} else {
					console.log('[IPC] START_DEBUG_POLLER: poller already running');
				}
				return { ok: true };
			} catch (e) {
				console.error('[IPC] START_DEBUG_POLLER error:', e);
				return { ok: false, error: String(e) };
			}
		});
	}

	// ─── Public API ───────────────────────────────────────────────────────────

	async start(projectPath) {
		if (this.status === 'running' || this.status === 'starting') {
			return { ok: false, error: `Already ${this.status}` };
		}

		this.crashTimestamps = [];
		this.terminalError = undefined;
		this.currentProjectPath = projectPath;

		this.setStatus('starting');

		try {
			await this._spawnWebserver(projectPath);
			await this._waitForWebserverReady();
			await this._authBootstrap();
			this._startDebugPoller();
			this.setStatus('running');
			return { ok: true };
		} catch (err) {
			const msg = err?.message ?? String(err);
			this.terminalError = msg;
			this.setStatus('crashed', msg);
			this._killWebserver();
			return { ok: false, error: msg };
		}
	}

	async stop() {
		if (this.status === 'stopped' || this.status === 'stopping') {
			return { ok: false, error: `Already ${this.status}` };
		}
		this.setStatus('stopping');
		this.debugPoller?.stop();
		this.debugPoller = null;
		await this._killWebserver();
		this.setStatus('stopped');
		return { ok: true };
	}

	getStatus() {
		return {
			status: this.status,
			since: this.statusSince,
			...(this.terminalError ? { terminalError: this.terminalError } : {}),
		};
	}

	// ─── Internal ─────────────────────────────────────────────────────────────

	_findBundledPython() {
		const rt = _plcRuntimeRoot();
		const isWin = process.platform === 'win32';
		const arch  = process.arch === 'arm64' ? 'darwin-arm64' : 'darwin-x64';

		const candidates = isWin
			? [
				path.join(rt, 'python', 'win32-x64', 'python.exe'),
			]
			: [
				path.join(rt, 'python', arch, 'bin', 'python3'),
				path.join(rt, 'python', 'darwin-arm64', 'bin', 'python3'),
				path.join(rt, 'python', 'darwin-x64', 'bin', 'python3'),
				'python3', // system fallback for Linux / dev
			];

		return candidates.find(p => {
			try { fs.accessSync(p); return true; } catch { return false; }
		}) ?? (isWin ? 'python.exe' : 'python3');
	}

	_findWebserverScript(projectPath) {
		const rt = _plcRuntimeRoot();
		const isWin = process.platform === 'win32';
		const v4Dir = path.join(rt, 'openplc-runtime-v4');
		const v4Script = path.join(v4Dir, 'webserver', 'app.py');

		if (!fs.existsSync(v4Script)) return null;

		if (isWin) {
			// On Windows: use StartOpenPLC.bat which launches MSYS2+Python,
			// OR use the bundled python.exe directly (preferred — no MSYS2 needed)
			const pythonExe = this._findBundledPython();
			const hasBundledPython = pythonExe.endsWith('.exe') && fs.existsSync(pythonExe);
			if (hasBundledPython) {
				return {
					type: 'python',
					module: 'webserver.app',
					cwd: v4Dir,
					projectPath,
					python: pythonExe,
				};
			}
			// Fallback: MSYS2 bat launcher (from OpenPLC Windows installer)
			const batPath = path.join(rt, 'openplc-runtime-v4', 'windows', 'StartOpenPLC.bat');
			if (fs.existsSync(batPath)) {
				return { type: 'bat', bat: batPath, cwd: v4Dir, projectPath };
			}
			return null;
		}

		// macOS / Linux — python module
		return {
			type: 'python',
			module: 'webserver.app',
			cwd: v4Dir,
			projectPath,
		};
	}

	async _spawnWebserver(projectPath) {
		const found = this._findWebserverScript(projectPath);
		if (!found) {
			throw new Error('OpenPLC v4 webserver not found. Expected resources/plc-runtime/openplc-runtime-v4/webserver/app.py');
		}

		let proc;

		if (found.type === 'python') {
			// Use explicit python from found.python (Windows) or resolve it now (mac/linux)
			const pythonBin = found.python ?? this._findBundledPython();
			console.log('[RuntimeProcessManager] Using Python:', pythonBin);
			const rt = _plcRuntimeRoot();
			const winSitePackages = path.join(rt, 'python', 'win32-x64', 'Lib', 'site-packages');
			const extraPythonPath = process.platform === 'win32' && fs.existsSync(winSitePackages)
				? `${found.cwd};${winSitePackages}`
				: found.cwd;
			proc = child_process.spawn(pythonBin, ['-m', found.module], {
				cwd: found.cwd,
				env: {
					...process.env,
					OPENPLC_RUNTIME_PATH: path.join(projectPath, 'build', 'plc_main'),
					PYTHONPATH: extraPythonPath,
				},
				stdio: ['ignore', 'pipe', 'pipe'],
			});
		} else if (found.type === 'bat') {
			// Windows MSYS2 batch launcher fallback
			console.log('[RuntimeProcessManager] Using StartOpenPLC.bat:', found.bat);
			proc = child_process.spawn('cmd.exe', ['/c', found.bat], {
				cwd: found.cwd,
				env: { ...process.env },
				stdio: ['ignore', 'pipe', 'pipe'],
			});
		} else {
			proc = child_process.spawn(found.bin, [], {
				cwd: found.cwd,
				env: { ...process.env },
				stdio: ['ignore', 'pipe', 'pipe'],
			});
		}

		this.webserverProcess = proc;

		proc.stdout?.on('data', (chunk) => {
			const lines = chunk.toString().split('\n');
			for (const line of lines) {
				if (line.trim()) this._pushLog('stdout', line);
			}
		});

		proc.stderr?.on('data', (chunk) => {
			const lines = chunk.toString().split('\n');
			for (const line of lines) {
				if (line.trim()) this._pushLog('stderr', line);
			}
		});

		proc.on('exit', (code) => {
			this._onChildExit(code);
		});
	}

	async _waitForWebserverReady() {
		const deadline = Date.now() + STARTUP_TIMEOUT_MS;

		while (Date.now() < deadline) {
			try {
				const { status } = await httpsGet(`${WEBSERVER_URL}/api/status`);
				if (status === 200) return;
			} catch {
				// not yet up
			}
			await sleep(STARTUP_POLL_INTERVAL_MS);
		}

		throw new Error(`Webserver did not become ready within ${STARTUP_TIMEOUT_MS / 1000}s`);
	}

	async _authBootstrap() {
		const password = loadOrCreateCredentials();

		const loginRes = await httpsPost(`${WEBSERVER_URL}/api/login`, {
			username: INTERNAL_USER,
			password,
		});

		if (loginRes.status === 200) {
			const parsed = JSON.parse(loginRes.body);
			this.jwt = parsed.access_token;
			return;
		}

		if (loginRes.status === 401) {
			const createRes = await httpsPost(`${WEBSERVER_URL}/api/create-user`, {
				username: INTERNAL_USER,
				password,
			});

			if (createRes.status !== 200 && createRes.status !== 201 && createRes.status !== 409 && createRes.status !== 401) {
				throw new Error(`create-user failed: ${createRes.status} ${createRes.body}`);
			}

			const loginRes2 = await httpsPost(`${WEBSERVER_URL}/api/login`, {
				username: INTERNAL_USER,
				password,
			});

			if (loginRes2.status !== 200) {
				throw new Error(`login after create-user failed: ${loginRes2.status} ${loginRes2.body}`);
			}

			const parsed = JSON.parse(loginRes2.body);
			this.jwt = parsed.access_token;
			return;
		}

		throw new Error(`auth bootstrap failed: ${loginRes.status} ${loginRes.body}`);
	}

	_startDebugPoller() {
		if (!this.jwt) return;
		this.debugPoller = new PlcDebugPoller(
			this.jwt,
			(frame) => this._pushTagFrame(frame),
			(line) => this._pushLog('stdout', line),
		);
		this.debugPoller.start();
	}

	_onChildExit(code) {
		if (this.status === 'stopping' || this.status === 'stopped') return;

		this.debugPoller?.stop();
		this.debugPoller = null;
		this.jwt = null;
		this.webserverProcess = null;

		const now = Date.now();
		this.crashTimestamps.push(now);
		this.crashTimestamps = this.crashTimestamps.filter((t) => now - t < CRASH_WINDOW_MS);

		if (this.crashTimestamps.length >= CRASH_THRESHOLD) {
			const msg = `Webserver crashed ${CRASH_THRESHOLD} times in ${CRASH_WINDOW_MS / 1000}s — giving up`;
			this.terminalError = msg;
			this.setStatus('crashed', msg);
			return;
		}

		this._pushLog('stderr', `[runtime-manager] webserver exited (code=${code}), restarting in ${CRASH_RESTART_DELAY_MS}ms…`);
		this.setStatus('starting');

		setTimeout(async () => {
			if (this.currentProjectPath && (this.status === 'starting')) {
				try {
					await this._spawnWebserver(this.currentProjectPath);
					await this._waitForWebserverReady();
					await this._authBootstrap();
					this._startDebugPoller();
					this.setStatus('running');
				} catch (err) {
					const msg = err?.message ?? String(err);
					this.terminalError = msg;
					this.setStatus('crashed', msg);
				}
			}
		}, CRASH_RESTART_DELAY_MS);
	}

	async _killWebserver() {
		const proc = this.webserverProcess;
		if (!proc || proc.killed) return;
		this.webserverProcess = null;

		proc.kill('SIGTERM');

		await new Promise((resolve) => {
			const timeout = setTimeout(() => {
				if (!proc.killed) proc.kill('SIGKILL');
				resolve();
			}, STOP_SIGKILL_TIMEOUT_MS);

			proc.on('exit', () => {
				clearTimeout(timeout);
				resolve();
			});
		});
	}

	// ─── Status broadcasting ─────────────────────────────────────────────────

	setStatus(s, terminalError) {
		this.status = s;
		this.statusSince = new Date().toISOString();
		if (terminalError) this.terminalError = terminalError;

		const push = {
			status: s,
			since: this.statusSince,
			...(this.terminalError ? { terminalError: this.terminalError } : {}),
		};

		for (const win of BrowserWindow.getAllWindows()) {
			if (!win.isDestroyed()) {
				win.webContents.send(PLC_IPC.STATUS_PUSH, push);
			}
		}
	}

	_pushLog(stream, line) {
		const payload = { stream, line, ts: Date.now() };
		for (const win of BrowserWindow.getAllWindows()) {
			if (!win.isDestroyed()) {
				win.webContents.send(PLC_IPC.LOG_LINE, payload);
			}
		}
	}

	_pushTagFrame(frame) {
		for (const win of BrowserWindow.getAllWindows()) {
			if (!win.isDestroyed()) {
				win.webContents.send(PLC_IPC.TAG_FRAME, frame);
			}
		}
	}
}
