/*--------------------------------------------------------------------------------------
 *  Volt Platform — Runtime Process Manager Service (renderer / browser context)
 *  Thin IPC client — delegates all work to the electron-main RuntimeProcessManager.
 *--------------------------------------------------------------------------------------*/

import {
	PLC_IPC,
	StartResult,
	StopResult,
	StatusResult,
	PLCStatusPush,
	PLCLogLine,
	PLCTagFrame,
} from '../common/runtimeProcessManagerTypes.js';

// VS Code preload exposes ipcRenderer on window.vscode (contextBridge.exposeInMainWorld('vscode', ...)).
// Channels must start with 'vscode:' to pass the preload's validateIPC check.
declare const window: Window & {
	vscode?: {
		ipcRenderer?: {
			invoke(channel: string, ...args: any[]): Promise<any>;
			on(channel: string, listener: (...args: any[]) => void): void;
			off(channel: string, listener: (...args: any[]) => void): void;
		};
	};
};

function getIpc() {
	const ipc = (window as any)?.vscode?.ipcRenderer
		?? (window as any)?.electron?.ipcRenderer
		?? (globalThis as any)?.require?.('electron')?.ipcRenderer;
	if (!ipc) throw new Error('[runtimeProcessManagerService] ipcRenderer is not available');
	return ipc;
}

// ─── Invoke wrappers ──────────────────────────────────────────────────────────

export async function plcStart(projectPath: string): Promise<StartResult> {
	return getIpc().invoke(PLC_IPC.START, { projectPath });
}

export async function plcStop(): Promise<StopResult> {
	return getIpc().invoke(PLC_IPC.STOP, {});
}

export async function plcGetStatus(): Promise<StatusResult> {
	return getIpc().invoke(PLC_IPC.STATUS_REQ, {});
}

export async function plcCompileMatiec(stCode: string): Promise<{ success: boolean; errors: string[] }> {
	return getIpc().invoke(PLC_IPC.MATIEC, { stCode });
}

export async function plcCompileStrucpp(stCode: string, programName: string): Promise<{ zipBase64: string | null; debugMapJson: string; errors: string[] }> {
	return getIpc().invoke(PLC_IPC.STRUCPP, { stCode, programName });
}

export async function plcFetch(url: string, method: string, headers?: Record<string, string>, body?: string): Promise<{ ok: boolean; status: number; body: string; error?: string }> {
	return getIpc().invoke(PLC_IPC.FETCH, { url, method, headers, body });
}

export async function plcUploadZip(zipBase64: string, filename: string, token: string): Promise<{ ok: boolean; status: number; body: string; error?: string }> {
	return getIpc().invoke(PLC_IPC.UPLOAD_ZIP, { zipBase64, filename, token });
}

export async function plcGetToken(): Promise<{ ok: boolean; token?: string; error?: string }> {
	return getIpc().invoke(PLC_IPC.GET_TOKEN, {});
}

export async function plcStartDebugPoller(): Promise<{ ok: boolean; error?: string }> {
	return getIpc().invoke(PLC_IPC.START_DEBUG_POLLER, {});
}

// ─── Event subscriptions ──────────────────────────────────────────────────────

type Unsubscribe = () => void;

export function onPLCStatusChange(cb: (push: PLCStatusPush) => void): Unsubscribe {
	const ipc = getIpc();
	const handler = (_event: any, payload: PLCStatusPush) => cb(payload);
	ipc.on(PLC_IPC.STATUS_PUSH, handler);
	return () => ipc.off(PLC_IPC.STATUS_PUSH, handler);
}

export function onPLCLogLine(cb: (line: PLCLogLine) => void): Unsubscribe {
	const ipc = getIpc();
	const handler = (_event: any, payload: PLCLogLine) => cb(payload);
	ipc.on(PLC_IPC.LOG_LINE, handler);
	return () => ipc.off(PLC_IPC.LOG_LINE, handler);
}

export function onPLCTagFrame(cb: (frame: PLCTagFrame) => void): Unsubscribe {
	const ipc = getIpc();
	const handler = (_event: any, payload: PLCTagFrame) => cb(payload);
	ipc.on(PLC_IPC.TAG_FRAME, handler);
	return () => ipc.off(PLC_IPC.TAG_FRAME, handler);
}

// ─── Class façade (optional — for callers who prefer OOP style) ───────────────

export class RuntimeProcessManagerService {
	start(projectPath: string): Promise<StartResult> { return plcStart(projectPath); }
	stop(): Promise<StopResult>                      { return plcStop(); }
	getStatus(): Promise<StatusResult>               { return plcGetStatus(); }

	onStatusChange(cb: (push: PLCStatusPush) => void): Unsubscribe { return onPLCStatusChange(cb); }
	onLogLine(cb: (line: PLCLogLine) => void): Unsubscribe         { return onPLCLogLine(cb); }
	onTagFrame(cb: (frame: PLCTagFrame) => void): Unsubscribe      { return onPLCTagFrame(cb); }
}
