/*--------------------------------------------------------------------------------------
 *  Volt Platform — Runtime Process Manager Types
 *  Safe to import in both electron-main and browser contexts (no Electron imports).
 *--------------------------------------------------------------------------------------*/

// ─── Status ──────────────────────────────────────────────────────────────────

export type PLCStatus = 'stopped' | 'starting' | 'running' | 'stopping' | 'crashed';

// ─── IPC channel names ────────────────────────────────────────────────────────

export const PLC_IPC = {
	/** renderer → main: start the runtime */
	START:        'vscode:plc-start',
	/** renderer → main: stop the runtime */
	STOP:         'vscode:plc-stop',
	/** renderer → main: query current status */
	STATUS_REQ:   'vscode:plc-status-req',
	/** renderer → main: run matiec validation on ST code */
	MATIEC:       'vscode:plc-compile-matiec',
	/** renderer → main: run strucpp ST→C++ codegen + zip assembly */
	STRUCPP:      'vscode:plc-compile-strucpp',
	/** main → renderer (push): status changed */
	STATUS_PUSH:  'vscode:plc-status-push',
	/** main → renderer (push): stdout/stderr line from webserver */
	LOG_LINE:     'vscode:plc-log-line',
	/** main → renderer (push): decoded tag frame from debug poller */
	TAG_FRAME:    'vscode:plc-tag-frame',
	/** renderer → main: proxy HTTPS fetch (self-signed cert bypass) */
	FETCH:        'vscode:plc-fetch',
	/** renderer → main: upload zip as base64 multipart POST */
	UPLOAD_ZIP:   'vscode:plc-upload-zip',
	GET_TOKEN:           'vscode:plc-get-token',
	/** renderer → main: start debug poller only (no webserver spawn) */
	START_DEBUG_POLLER:  'vscode:plc-start-debug-poller',
} as const;

// ─── invoke/handle payloads ───────────────────────────────────────────────────

export interface StartParams {
	projectPath: string;
}

export interface StartResult {
	ok: boolean;
	error?: string;
}

export interface StopResult {
	ok: boolean;
	error?: string;
}

export interface StatusResult {
	status: PLCStatus;
	/** ISO timestamp of last status change */
	since: string;
	/** set when status === 'crashed' and circuit breaker tripped */
	terminalError?: string;
}

// ─── push event payloads ──────────────────────────────────────────────────────

export interface PLCStatusPush {
	status: PLCStatus;
	since: string;
	terminalError?: string;
}

export interface PLCLogLine {
	/** 'stdout' | 'stderr' */
	stream: 'stdout' | 'stderr';
	line: string;
	ts: number;
}

export interface MatiecParams {
	stCode: string;
}

export interface MatiecResult {
	success: boolean;
	errors: string[];
}

export interface StrucppParams {
	stCode: string;
	programName: string;
}

export interface StrucppResult {
	/** base64-encoded zip buffer, or null on failure */
	zipBase64: string | null;
	/** JSON-serialised DebugMap */
	debugMapJson: string;
	errors: string[];
}

export interface PLCTagFrame {
	/** PLC tick counter (u32, big-endian bytes 4-7 of debug response) */
	tick: number;
	/** Raw tag data bytes (everything after the 8-byte header) */
	tagBytes: number[];
}
