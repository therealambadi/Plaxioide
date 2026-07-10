/*--------------------------------------------------------------------------------------
 *  Volt Platform — Runtime Process Manager Service (renderer / browser context)
 *  Thin IPC client — delegates all work to the electron-main RuntimeProcessManager.
 *--------------------------------------------------------------------------------------*/

import { PLC_IPC } from '../common/runtimeProcessManagerTypes.js';

function getIpc() {
	const ipc = window?.vscode?.ipcRenderer
		?? window?.electron?.ipcRenderer
		?? globalThis?.require?.('electron')?.ipcRenderer;
	if (!ipc) throw new Error('[runtimeProcessManagerService] ipcRenderer is not available');
	return ipc;
}

// ─── Invoke wrappers ──────────────────────────────────────────────────────────

export async function plcStart(projectPath) {
	return getIpc().invoke(PLC_IPC.START, { projectPath });
}

export async function plcStop() {
	return getIpc().invoke(PLC_IPC.STOP, {});
}

export async function plcGetStatus() {
	return getIpc().invoke(PLC_IPC.STATUS_REQ, {});
}

export async function plcCompileMatiec(stCode) {
	return getIpc().invoke(PLC_IPC.MATIEC, { stCode });
}

export async function plcCompileStrucpp(stCode, programName) {
	return getIpc().invoke(PLC_IPC.STRUCPP, { stCode, programName });
}

export async function plcFetch(url, method, headers, body) {
	return getIpc().invoke(PLC_IPC.FETCH, { url, method, headers, body });
}

export async function plcUploadZip(zipBase64, filename, token) {
	return getIpc().invoke(PLC_IPC.UPLOAD_ZIP, { zipBase64, filename, token });
}

export async function plcGetToken() {
	return getIpc().invoke(PLC_IPC.GET_TOKEN, {});
}

export async function plcStartDebugPoller() {
	return getIpc().invoke(PLC_IPC.START_DEBUG_POLLER, {});
}

// ─── Event subscriptions ──────────────────────────────────────────────────────

export function onPLCStatusChange(cb) {
	const ipc = getIpc();
	const handler = (_event, payload) => cb(payload);
	ipc.on(PLC_IPC.STATUS_PUSH, handler);
	return () => ipc.off(PLC_IPC.STATUS_PUSH, handler);
}

export function onPLCLogLine(cb) {
	const ipc = getIpc();
	const handler = (_event, payload) => cb(payload);
	ipc.on(PLC_IPC.LOG_LINE, handler);
	return () => ipc.off(PLC_IPC.LOG_LINE, handler);
}

export function onPLCTagFrame(cb) {
	const ipc = getIpc();
	const handler = (_event, payload) => cb(payload);
	ipc.on(PLC_IPC.TAG_FRAME, handler);
	return () => ipc.off(PLC_IPC.TAG_FRAME, handler);
}

// ─── Class façade (optional — for callers who prefer OOP style) ───────────────

export class RuntimeProcessManagerService {
	start(projectPath) { return plcStart(projectPath); }
	stop()             { return plcStop(); }
	getStatus()        { return plcGetStatus(); }

	onStatusChange(cb) { return onPLCStatusChange(cb); }
	onLogLine(cb)      { return onPLCLogLine(cb); }
	onTagFrame(cb)     { return onPLCTagFrame(cb); }
}
