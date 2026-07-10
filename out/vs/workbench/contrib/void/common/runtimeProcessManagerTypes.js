/*--------------------------------------------------------------------------------------
 *  Volt Platform — Runtime Process Manager Types
 *--------------------------------------------------------------------------------------*/

export const PLC_IPC = {
	START:        'vscode:plc-start',
	STOP:         'vscode:plc-stop',
	STATUS_REQ:   'vscode:plc-status-req',
	MATIEC:       'vscode:plc-compile-matiec',
	STRUCPP:      'vscode:plc-compile-strucpp',
	STATUS_PUSH:  'vscode:plc-status-push',
	LOG_LINE:     'vscode:plc-log-line',
	TAG_FRAME:    'vscode:plc-tag-frame',
	FETCH:        'vscode:plc-fetch',
	UPLOAD_ZIP:   'vscode:plc-upload-zip',
	GET_TOKEN:           'vscode:plc-get-token',
	START_DEBUG_POLLER:  'vscode:plc-start-debug-poller',
};
