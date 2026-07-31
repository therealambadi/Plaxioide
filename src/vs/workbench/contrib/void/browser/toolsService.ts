// @ts-nocheck
import { CancellationToken } from '../../../../base/common/cancellation.js'
import { URI } from '../../../../base/common/uri.js'
import { VSBuffer } from '../../../../base/common/buffer.js'
import { IFileService } from '../../../../platform/files/common/files.js'
import { registerSingleton, InstantiationType } from '../../../../platform/instantiation/common/extensions.js'
import { createDecorator, IInstantiationService } from '../../../../platform/instantiation/common/instantiation.js'
import { IWorkspaceContextService } from '../../../../platform/workspace/common/workspace.js'
import { QueryBuilder } from '../../../services/search/common/queryBuilder.js'
import { ISearchService } from '../../../services/search/common/search.js'
import { IEditCodeService } from './editCodeServiceInterface.js'
import { ITerminalToolService } from './terminalToolService.js'
import { LintErrorItem, BuiltinToolCallParams, BuiltinToolResultType, BuiltinToolName } from '../common/toolsServiceTypes.js'
import { IVoidModelService } from '../common/voidModelService.js'
import { EndOfLinePreference } from '../../../../editor/common/model.js'
import { IVoidCommandBarService } from './voidCommandBarService.js'
import { computeDirectoryTree1Deep, IDirectoryStrService, stringifyDirectoryTree1Deep } from '../common/directoryStrService.js'
import { IMarkerService, MarkerSeverity } from '../../../../platform/markers/common/markers.js'
import { timeout } from '../../../../base/common/async.js'
import { RawToolParamsObj } from '../common/sendLLMMessageTypes.js'
import { MAX_CHILDREN_URIs_PAGE, MAX_FILE_CHARS_PAGE, MAX_TERMINAL_BG_COMMAND_TIME, MAX_TERMINAL_INACTIVE_TIME } from '../common/prompt/prompts.js'
import { IVoidSettingsService } from '../common/voidSettingsService.js'
import { IEditorService } from '../../../services/editor/common/editorService.js'
import { generateUuid } from '../../../../base/common/uuid.js'
import { logicStore, importVendorFile, exportVendorFile, clmToST, buildCLMFromStore } from './react/out/plc-editor-tsx/index.js'


// tool use for AI
type ValidateBuiltinParams = { [T in BuiltinToolName]: (p: RawToolParamsObj) => BuiltinToolCallParams[T] }
type CallBuiltinTool = { [T in BuiltinToolName]: (p: BuiltinToolCallParams[T]) => Promise<{ result: BuiltinToolResultType[T] | Promise<BuiltinToolResultType[T]>, interruptTool?: () => void }> }
type BuiltinToolResultToString = { [T in BuiltinToolName]: (p: BuiltinToolCallParams[T], result: Awaited<BuiltinToolResultType[T]>) => string }


const isFalsy = (u: unknown) => {
	return !u || u === 'null' || u === 'undefined'
}

const validateStr = (argName: string, value: unknown) => {
	if (value === null) throw new Error(`Invalid LLM output: ${argName} was null.`)
	if (typeof value !== 'string') throw new Error(`Invalid LLM output format: ${argName} must be a string, but its type is "${typeof value}". Full value: ${JSON.stringify(value)}.`)
	return value
}


// We are NOT checking to make sure in workspace
const validateURI = (uriStr: unknown) => {
	if (uriStr === null) throw new Error(`Invalid LLM output: uri was null.`)
	if (typeof uriStr !== 'string') throw new Error(`Invalid LLM output format: Provided uri must be a string, but it's a(n) ${typeof uriStr}. Full value: ${JSON.stringify(uriStr)}.`)

	// Check if it's already a full URI with scheme (e.g., vscode-remote://, file://, etc.)
	// Look for :// pattern which indicates a scheme is present
	// Examples of supported URIs:
	// - vscode-remote://wsl+Ubuntu/home/user/file.txt (WSL)
	// - vscode-remote://ssh-remote+myserver/home/user/file.txt (SSH)
	// - file:///home/user/file.txt (local file with scheme)
	// - /home/user/file.txt (local file path, will be converted to file://)
	// - C:\Users\file.txt (Windows local path, will be converted to file://)
	if (uriStr.includes('://')) {
		try {
			const uri = URI.parse(uriStr)
			return uri
		} catch (e) {
			// If parsing fails, it's a malformed URI
			throw new Error(`Invalid URI format: ${uriStr}. Error: ${e}`)
		}
	} else {
		// No scheme present, treat as file path
		// This handles regular file paths like /home/user/file.txt or C:\Users\file.txt
		const uri = URI.file(uriStr)
		return uri
	}
}

const validateOptionalURI = (uriStr: unknown) => {
	if (isFalsy(uriStr)) return null
	return validateURI(uriStr)
}

const validateOptionalStr = (argName: string, str: unknown) => {
	if (isFalsy(str)) return null
	return validateStr(argName, str)
}


const validatePageNum = (pageNumberUnknown: unknown) => {
	if (!pageNumberUnknown) return 1
	const parsedInt = Number.parseInt(pageNumberUnknown + '')
	if (!Number.isInteger(parsedInt)) throw new Error(`Page number was not an integer: "${pageNumberUnknown}".`)
	if (parsedInt < 1) throw new Error(`Invalid LLM output format: Specified page number must be 1 or greater: "${pageNumberUnknown}".`)
	return parsedInt
}

const validateNumber = (numStr: unknown, opts: { default: number | null }) => {
	if (typeof numStr === 'number')
		return numStr
	if (isFalsy(numStr)) return opts.default

	if (typeof numStr === 'string') {
		const parsedInt = Number.parseInt(numStr + '')
		if (!Number.isInteger(parsedInt)) return opts.default
		return parsedInt
	}

	return opts.default
}

const validateProposedTerminalId = (terminalIdUnknown: unknown) => {
	if (!terminalIdUnknown) throw new Error(`A value for terminalID must be specified, but the value was "${terminalIdUnknown}"`)
	const terminalId = terminalIdUnknown + ''
	return terminalId
}

const validateBoolean = (b: unknown, opts: { default: boolean }) => {
	if (typeof b === 'string') {
		if (b === 'true') return true
		if (b === 'false') return false
	}
	if (typeof b === 'boolean') {
		return b
	}
	return opts.default
}


const checkIfIsFolder = (uriStr: string) => {
	uriStr = uriStr.trim()
	if (uriStr.endsWith('/') || uriStr.endsWith('\\')) return true
	return false
}

export interface IToolsService {
	readonly _serviceBrand: undefined;
	validateParams: ValidateBuiltinParams;
	callTool: CallBuiltinTool;
	stringOfResult: BuiltinToolResultToString;
}

export const IToolsService = createDecorator<IToolsService>('ToolsService');

export class ToolsService implements IToolsService {

	readonly _serviceBrand: undefined;

	public validateParams: ValidateBuiltinParams;
	public callTool: CallBuiltinTool;
	public stringOfResult: BuiltinToolResultToString;

	constructor(
		@IFileService fileService: IFileService,
		@IWorkspaceContextService workspaceContextService: IWorkspaceContextService,
		@ISearchService searchService: ISearchService,
		@IInstantiationService instantiationService: IInstantiationService,
		@IVoidModelService voidModelService: IVoidModelService,
		@IEditCodeService editCodeService: IEditCodeService,
		@ITerminalToolService private readonly terminalToolService: ITerminalToolService,
		@IVoidCommandBarService private readonly commandBarService: IVoidCommandBarService,
		@IDirectoryStrService private readonly directoryStrService: IDirectoryStrService,
		@IMarkerService private readonly markerService: IMarkerService,
		@IVoidSettingsService private readonly voidSettingsService: IVoidSettingsService,
		@IEditorService private readonly editorService: IEditorService,
	) {
		const queryBuilder = instantiationService.createInstance(QueryBuilder);

		this.validateParams = {
			read_file: (params: RawToolParamsObj) => {
				const { uri: uriStr, start_line: startLineUnknown, end_line: endLineUnknown, page_number: pageNumberUnknown } = params
				const uri = validateURI(uriStr)
				const pageNumber = validatePageNum(pageNumberUnknown)

				let startLine = validateNumber(startLineUnknown, { default: null })
				let endLine = validateNumber(endLineUnknown, { default: null })

				if (startLine !== null && startLine < 1) startLine = null
				if (endLine !== null && endLine < 1) endLine = null

				return { uri, startLine, endLine, pageNumber }
			},
			ls_dir: (params: RawToolParamsObj) => {
				const { uri: uriStr, page_number: pageNumberUnknown } = params

				const uri = validateURI(uriStr)
				const pageNumber = validatePageNum(pageNumberUnknown)
				return { uri, pageNumber }
			},
			get_dir_tree: (params: RawToolParamsObj) => {
				const { uri: uriStr, } = params
				const uri = validateURI(uriStr)
				return { uri }
			},
			search_pathnames_only: (params: RawToolParamsObj) => {
				const {
					query: queryUnknown,
					search_in_folder: includeUnknown,
					page_number: pageNumberUnknown
				} = params

				const queryStr = validateStr('query', queryUnknown)
				const pageNumber = validatePageNum(pageNumberUnknown)
				const includePattern = validateOptionalStr('include_pattern', includeUnknown)

				return { query: queryStr, includePattern, pageNumber }

			},
			search_for_files: (params: RawToolParamsObj) => {
				const {
					query: queryUnknown,
					search_in_folder: searchInFolderUnknown,
					is_regex: isRegexUnknown,
					page_number: pageNumberUnknown
				} = params
				const queryStr = validateStr('query', queryUnknown)
				const pageNumber = validatePageNum(pageNumberUnknown)
				const searchInFolder = validateOptionalURI(searchInFolderUnknown)
				const isRegex = validateBoolean(isRegexUnknown, { default: false })
				return {
					query: queryStr,
					isRegex,
					searchInFolder,
					pageNumber
				}
			},
			search_in_file: (params: RawToolParamsObj) => {
				const { uri: uriStr, query: queryUnknown, is_regex: isRegexUnknown } = params;
				const uri = validateURI(uriStr);
				const query = validateStr('query', queryUnknown);
				const isRegex = validateBoolean(isRegexUnknown, { default: false });
				return { uri, query, isRegex };
			},

			read_lint_errors: (params: RawToolParamsObj) => {
				const {
					uri: uriUnknown,
				} = params
				const uri = validateURI(uriUnknown)
				return { uri }
			},

			// ---

			create_file_or_folder: (params: RawToolParamsObj) => {
				const { uri: uriUnknown } = params
				const uri = validateURI(uriUnknown)
				const uriStr = validateStr('uri', uriUnknown)
				const isFolder = checkIfIsFolder(uriStr)
				return { uri, isFolder }
			},

			delete_file_or_folder: (params: RawToolParamsObj) => {
				const { uri: uriUnknown, is_recursive: isRecursiveUnknown } = params
				const uri = validateURI(uriUnknown)
				const isRecursive = validateBoolean(isRecursiveUnknown, { default: false })
				const uriStr = validateStr('uri', uriUnknown)
				const isFolder = checkIfIsFolder(uriStr)
				return { uri, isRecursive, isFolder }
			},

			rewrite_file: (params: RawToolParamsObj) => {
				const { uri: uriStr, new_content: newContentUnknown } = params
				const uri = validateURI(uriStr)
				const newContent = validateStr('newContent', newContentUnknown)
				if (!newContent.trim()) throw new Error(`Invalid LLM output: new_content is empty. You must provide the full file content.`)
				return { uri, newContent }
			},

			edit_file: (params: RawToolParamsObj) => {
				const { uri: uriStr, search_replace_blocks: searchReplaceBlocksUnknown } = params
				const uri = validateURI(uriStr)
				const searchReplaceBlocks = validateStr('searchReplaceBlocks', searchReplaceBlocksUnknown)
				return { uri, searchReplaceBlocks }
			},

			// ---

			run_command: (params: RawToolParamsObj) => {
				const { command: commandUnknown, cwd: cwdUnknown } = params
				const command = validateStr('command', commandUnknown)
				const cwd = validateOptionalStr('cwd', cwdUnknown)
				const terminalId = generateUuid()
				return { command, cwd, terminalId }
			},
			run_persistent_command: (params: RawToolParamsObj) => {
				const { command: commandUnknown, persistent_terminal_id: persistentTerminalIdUnknown } = params;
				const command = validateStr('command', commandUnknown);
				const persistentTerminalId = validateProposedTerminalId(persistentTerminalIdUnknown)
				return { command, persistentTerminalId };
			},
			open_persistent_terminal: (params: RawToolParamsObj) => {
				const { cwd: cwdUnknown } = params;
				const cwd = validateOptionalStr('cwd', cwdUnknown)
				// No parameters needed; will open a new background terminal
				return { cwd };
			},
			kill_persistent_terminal: (params: RawToolParamsObj) => {
				const { persistent_terminal_id: terminalIdUnknown } = params;
				const persistentTerminalId = validateProposedTerminalId(terminalIdUnknown);
				return { persistentTerminalId };
			},
			import_vendor_file: (params: RawToolParamsObj) => {
				const { uri: uriStr, xmlContent, filename } = params
				if (xmlContent) {
					return { xmlContent: String(xmlContent), filename: String(filename ?? 'imported.xml') }
				}
				const uri = validateURI(uriStr)
				return { uri }
			},
			plc_get_program: (_params: RawToolParamsObj) => {
				return {}
			},
			plc_validate: (_params: RawToolParamsObj) => {
				return {}
			},
			plc_write_program: (params: RawToolParamsObj) => {
				const { programJson: pj } = params
				if (typeof pj !== 'string' || !pj.trim()) throw new Error('programJson must be a non-empty JSON string')
				JSON.parse(pj) // validate before sending
				return { programJson: pj }
			},
			plc_set_tag_database: (params: RawToolParamsObj) => {
				const { tagsJson: tj } = params
				if (typeof tj !== 'string' || !tj.trim()) throw new Error('tagsJson must be a non-empty JSON string')
				JSON.parse(tj) // validate before sending
				return { tagsJson: tj }
			},
			plc_export_vendor: (params: RawToolParamsObj) => {
				const { format: formatUnknown } = params
				const format = (typeof formatUnknown === 'string' && ['PLCopen', 'L5X', 'SimaticML', 'XEF'].includes(formatUnknown))
					? formatUnknown as 'PLCopen' | 'L5X' | 'SimaticML' | 'XEF'
					: 'PLCopen'
				return { format }
			},
			plc_export_st: (_params: RawToolParamsObj) => {
				return {}
			},
			plc_convert_language: (params: RawToolParamsObj) => {
				const { from: fromUnknown, to: toUnknown } = params
				const validLangs = ['LD', 'FBD', 'SFC', 'ST']
				const from = (typeof fromUnknown === 'string' && ['LD', 'FBD', 'SFC'].includes(fromUnknown))
					? fromUnknown as 'LD' | 'FBD' | 'SFC'
					: 'LD'
				const to = (typeof toUnknown === 'string' && validLangs.includes(toUnknown))
					? toUnknown as 'LD' | 'FBD' | 'SFC' | 'ST'
					: 'FBD'
				return { from, to }
			},
			plaxio_get_project: (_params: RawToolParamsObj) => {
				return {}
			},
			plaxio_generate_view: (params: RawToolParamsObj) => {
				const pouName = typeof params.pouName === 'string' ? params.pouName.trim() : undefined
				return { pouName }
			},
			plaxio_save_view: (params: RawToolParamsObj) => {
				let viewObj: any
				if (typeof params.viewJson === 'object' && params.viewJson !== null) {
					viewObj = params.viewJson
				} else if (typeof params.viewJson === 'string' && (params.viewJson as string).trim()) {
					try { viewObj = JSON.parse(params.viewJson as string) }
					catch (_e) {
						const repaired = (params.viewJson as string).replace(/[\x00-\x1f]/g, (c) => '\\u' + c.charCodeAt(0).toString(16).padStart(4, '0'))
						try { viewObj = JSON.parse(repaired) }
						catch (_e2) {
							const nameMatch = (params.viewJson as string).match(/"name"\s*:\s*"([^"]+)"/)
							if (nameMatch) {
								viewObj = { name: nameMatch[1], profile: { width: 1024, height: 768, bkcolor: '#ffffff' }, items: [], svgcontent: '<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="768"><rect width="100%" height="100%" fill="#fff"/></svg>' }
							} else {
								throw new Error('viewJson could not be parsed. Pass viewJson as an object, not a string.')
							}
						}
					}
				} else if ((params as any).name || (params as any).svgcontent || (params as any).hmi) {
					const { viewJson: _vj, ...rest } = params
					viewObj = rest
				} else {
					throw new Error('viewJson must be a JSON object or string with at least "name"')
				}
				return { viewJson: JSON.stringify(viewObj) }
			},
			plaxio_set_tag_value: (params: RawToolParamsObj) => {
				const raw = params.tags
				const arr = Array.isArray(raw) ? raw : (typeof raw === 'string' ? JSON.parse(raw) : null)
				if (!Array.isArray(arr) || arr.length === 0) throw new Error('tags must be a non-empty array of {tagName, value}')
				const tags = arr.map((t: any) => {
					if (typeof t.tagName !== 'string' || !t.tagName.trim()) throw new Error('each tag must have a tagName string')
					const value = typeof t.value === 'boolean' || typeof t.value === 'number' ? t.value
						: typeof t.value === 'string' ? t.value : String(t.value)
					return { tagName: t.tagName.trim(), value }
				})
				return { tags }
			},
			plc_add_verify_property: (params: RawToolParamsObj) => {
				const { propertiesJson: pj } = params
				if (typeof pj !== 'string' || !pj.trim()) throw new Error('propertiesJson must be a non-empty JSON string')
				const parsed = JSON.parse(pj)
				if (!Array.isArray(parsed)) throw new Error('propertiesJson must be a JSON array of property objects')
				return { propertiesJson: pj }
			},

		}


		this.callTool = {
			read_file: async ({ uri, startLine, endLine, pageNumber }) => {
				await voidModelService.initializeModel(uri)
				const { model } = await voidModelService.getModelSafe(uri)
				if (model === null) { throw new Error(`No contents; File does not exist.`) }

				let contents: string
				if (startLine === null && endLine === null) {
					contents = model.getValue(EndOfLinePreference.LF)
				}
				else {
					const startLineNumber = startLine === null ? 1 : startLine
					const endLineNumber = endLine === null ? model.getLineCount() : endLine
					contents = model.getValueInRange({ startLineNumber, startColumn: 1, endLineNumber, endColumn: Number.MAX_SAFE_INTEGER }, EndOfLinePreference.LF)
				}

				const totalNumLines = model.getLineCount()

				const fromIdx = MAX_FILE_CHARS_PAGE * (pageNumber - 1)
				const toIdx = MAX_FILE_CHARS_PAGE * pageNumber - 1
				const fileContents = contents.slice(fromIdx, toIdx + 1) // paginate
				const hasNextPage = (contents.length - 1) - toIdx >= 1
				const totalFileLen = contents.length
				return { result: { fileContents, totalFileLen, hasNextPage, totalNumLines } }
			},

			ls_dir: async ({ uri, pageNumber }) => {
				const dirResult = await computeDirectoryTree1Deep(fileService, uri, pageNumber)
				return { result: dirResult }
			},

			get_dir_tree: async ({ uri }) => {
				const str = await this.directoryStrService.getDirectoryStrTool(uri)
				return { result: { str } }
			},

			search_pathnames_only: async ({ query: queryStr, includePattern, pageNumber }) => {

				const query = queryBuilder.file(workspaceContextService.getWorkspace().folders.map(f => f.uri), {
					filePattern: queryStr,
					includePattern: includePattern ?? undefined,
					sortByScore: true, // makes results 10x better
				})
				const data = await searchService.fileSearch(query, CancellationToken.None)

				const fromIdx = MAX_CHILDREN_URIs_PAGE * (pageNumber - 1)
				const toIdx = MAX_CHILDREN_URIs_PAGE * pageNumber - 1
				const uris = data.results
					.slice(fromIdx, toIdx + 1) // paginate
					.map(({ resource, results }) => resource)

				const hasNextPage = (data.results.length - 1) - toIdx >= 1
				return { result: { uris, hasNextPage } }
			},

			search_for_files: async ({ query: queryStr, isRegex, searchInFolder, pageNumber }) => {
				const searchFolders = searchInFolder === null ?
					workspaceContextService.getWorkspace().folders.map(f => f.uri)
					: [searchInFolder]

				const query = queryBuilder.text({
					pattern: queryStr,
					isRegExp: isRegex,
				}, searchFolders)

				const data = await searchService.textSearch(query, CancellationToken.None)

				const fromIdx = MAX_CHILDREN_URIs_PAGE * (pageNumber - 1)
				const toIdx = MAX_CHILDREN_URIs_PAGE * pageNumber - 1
				const uris = data.results
					.slice(fromIdx, toIdx + 1) // paginate
					.map(({ resource, results }) => resource)

				const hasNextPage = (data.results.length - 1) - toIdx >= 1
				return { result: { queryStr, uris, hasNextPage } }
			},
			search_in_file: async ({ uri, query, isRegex }) => {
				await voidModelService.initializeModel(uri);
				const { model } = await voidModelService.getModelSafe(uri);
				if (model === null) { throw new Error(`No contents; File does not exist.`); }
				const contents = model.getValue(EndOfLinePreference.LF);
				const contentOfLine = contents.split('\n');
				const totalLines = contentOfLine.length;
				const regex = isRegex ? new RegExp(query) : null;
				const lines: number[] = []
				for (let i = 0; i < totalLines; i++) {
					const line = contentOfLine[i];
					if ((isRegex && regex!.test(line)) || (!isRegex && line.includes(query))) {
						const matchLine = i + 1;
						lines.push(matchLine);
					}
				}
				return { result: { lines } };
			},

			read_lint_errors: async ({ uri }) => {
				await timeout(1000)
				const { lintErrors } = this._getLintErrors(uri)
				return { result: { lintErrors } }
			},

			// ---

			create_file_or_folder: async ({ uri, isFolder }) => {
				if (isFolder)
					await fileService.createFolder(uri)
				else {
					await fileService.createFile(uri)
				}
				return { result: {} }
			},

			delete_file_or_folder: async ({ uri, isRecursive }) => {
				await fileService.del(uri, { recursive: isRecursive })
				return { result: {} }
			},

			rewrite_file: async ({ uri, newContent }) => {
				if (this.commandBarService.getStreamState(uri) === 'streaming') {
					throw new Error(`Another LLM is currently making changes to this file. Please stop streaming for now and ask the user to resume later.`)
				}
				// Always write directly to disk first — this physically creates/updates the file
				// regardless of whether an in-memory model exists
				await fileService.writeFile(uri, VSBuffer.fromString(newContent))
				// Then sync the in-memory model if one already exists (for editor diff/undo UI)
				await voidModelService.initializeModel(uri)
				const { model } = voidModelService.getModel(uri)
				if (model) {
					await editCodeService.callBeforeApplyOrEdit(uri)
					editCodeService.instantlyRewriteFile({ uri, newContent })
				}
				// Auto-open graphical PLC files in the editor after creation/write
				const uriPath = uri.path.toLowerCase()
				if (uriPath.endsWith('.ld.json') || uriPath.endsWith('.fbd.json') || uriPath.endsWith('.sfc.json')) {
					this.editorService.openEditor({ resource: uri }).catch(() => { /* non-fatal */ })
				}
				// at end, get lint errors
				const lintErrorsPromise = Promise.resolve().then(async () => {
					await timeout(2000)
					const { lintErrors } = this._getLintErrors(uri)
					return { lintErrors }
				})
				return { result: lintErrorsPromise }
			},

			edit_file: async ({ uri, searchReplaceBlocks }) => {
				await voidModelService.initializeModel(uri)
				if (this.commandBarService.getStreamState(uri) === 'streaming') {
					throw new Error(`Another LLM is currently making changes to this file. Please stop streaming for now and ask the user to resume later.`)
				}
				await editCodeService.callBeforeApplyOrEdit(uri)
				editCodeService.instantlyApplySearchReplaceBlocks({ uri, searchReplaceBlocks })

				// at end, get lint errors
				const lintErrorsPromise = Promise.resolve().then(async () => {
					await timeout(2000)
					const { lintErrors } = this._getLintErrors(uri)
					return { lintErrors }
				})

				return { result: lintErrorsPromise }
			},
			// ---
			run_command: async ({ command, cwd, terminalId }) => {
				const { resPromise, interrupt } = await this.terminalToolService.runCommand(command, { type: 'temporary', cwd, terminalId })
				return { result: resPromise, interruptTool: interrupt }
			},
			run_persistent_command: async ({ command, persistentTerminalId }) => {
				const { resPromise, interrupt } = await this.terminalToolService.runCommand(command, { type: 'persistent', persistentTerminalId })
				return { result: resPromise, interruptTool: interrupt }
			},
			open_persistent_terminal: async ({ cwd }) => {
				const persistentTerminalId = await this.terminalToolService.createPersistentTerminal({ cwd })
				return { result: { persistentTerminalId } }
			},
			kill_persistent_terminal: async ({ persistentTerminalId }) => {
				// Close the background terminal by sending exit
				await this.terminalToolService.killPersistentTerminal(persistentTerminalId)
				return { result: {} }
			},
			// ---
			plc_get_program: async () => {
				const tToolStart = performance.now()
				const s = logicStore.getState()
				const snapshot = {
					ladderProgram: s.ladderProgram,
					fbdProgram: s.fbdProgram,
					sfcProgram: s.sfcProgram,
					tagDatabase: s.tagDatabase,
					activePouId: s.activePouId,
				}
				const json = JSON.stringify(snapshot)
				// If program is large, return a summary + truncated JSON to avoid blowing up context
				const MAX_TOOL_RESULT = 8000
				let result: string
				if (json.length > MAX_TOOL_RESULT) {
					const summary = `Program summary: ${s.ladderProgram.rungs.length} LD rungs, ${s.fbdProgram.nodes.length} FBD nodes, ${s.sfcProgram.steps.length} SFC steps, ${s.tagDatabase.length} tags. Active POU: ${s.activePouId}. Full JSON (${json.length} chars, truncated):\n`
					result = summary + json.substring(0, MAX_TOOL_RESULT - summary.length)
				} else {
					result = json
				}
				console.log(`[Plaxio Perf] Tool plc_get_program: ${(performance.now() - tToolStart).toFixed(0)}ms, payload: ${json.length} chars, returned: ${result.length} chars`)
				return { result: { program: result } }
			},
			plc_validate: async () => {
				const tToolStart = performance.now()
				const s = logicStore.getState()
				const issues: Array<{ message: string; severity: 'error' | 'warn'; location: string }> = []

				for (const rung of s.ladderProgram.rungs) {
					const hasOutput = rung.elements.some((e: any) => e.kind === 'coil' || e.kind === 'block')
					if (rung.elements.length > 0 && !hasOutput) {
						issues.push({ message: `Rung #${rung.number} "${rung.comment || rung.id}" has no output coil`, severity: 'warn', location: `LD rung-${rung.number}` })
					}
				}

				const initSteps = s.sfcProgram.steps.filter((st: any) => st.isInitial)
				if (s.sfcProgram.steps.length > 0 && initSteps.length === 0) {
					issues.push({ message: 'SFC: No initial step defined (IEC §6.5.4.2)', severity: 'error', location: 'SFC' })
				}
				if (initSteps.length > 1) {
					issues.push({ message: `SFC: Multiple initial steps: ${initSteps.map((st: any) => st.name).join(', ')}`, severity: 'error', location: 'SFC' })
				}

				for (const t of s.sfcProgram.transitions) {
					if (!(t as any).condition?.trim()) {
						issues.push({ message: `SFC transition ${t.id} has empty condition`, severity: 'warn', location: `SFC transition-${t.id}` })
					}
				}

				for (const l of s.sfcProgram.links) {
					const fromIsStep = s.sfcProgram.steps.some((st: any) => st.id === l.from)
					const toIsStep = s.sfcProgram.steps.some((st: any) => st.id === l.to)
					if (fromIsStep && toIsStep) {
						issues.push({ message: `SFC: Direct step→step link ${l.id} (transition required between)`, severity: 'error', location: `SFC link-${l.id}` })
					}
				}

				const jumpTargets = new Set((s.sfcProgram.jumps ?? []).map((j: any) => j.targetStepName))
				for (const step of s.sfcProgram.steps.filter((st: any) => !st.isInitial)) {
					const hasIncoming = s.sfcProgram.links.some((l: any) => l.to === step.id)
					if (!hasIncoming && !jumpTargets.has((step as any).name)) {
						issues.push({ message: `SFC: Step "${(step as any).name}" is unreachable`, severity: 'warn', location: `SFC step-${step.id}` })
					}
				}

				for (const node of s.fbdProgram.nodes) {
					if (node.type === 'OUT_VARIABLE') {
						const tag = (node as any).tag?.name ?? node.instanceName ?? node.id
						const hasWire = s.fbdProgram.wires.some((w: any) => w.to.nodeId === node.id)
						if (!hasWire) {
							issues.push({ message: `FBD: OUT_VARIABLE "${tag}" has no incoming wire`, severity: 'warn', location: `FBD node-${node.id}` })
						}
					}
				}

				console.log(`[Plaxio Perf] Tool plc_validate: ${(performance.now() - tToolStart).toFixed(0)}ms`)
				return { result: { issues } }
			},
			plc_write_program: async ({ programJson }) => {
				const tToolStart = performance.now()
				let parsed: any = {}
				try { parsed = JSON.parse(programJson) } catch { throw new Error('programJson is not valid JSON') }

				const pouName: string = (typeof parsed.pouName === 'string' && parsed.pouName.trim())
					? parsed.pouName.trim()
					: 'main'

				// Load into logicStore directly (works regardless of panel state)
				if (parsed.ladderProgram) logicStore.loadLadderProgram(parsed.ladderProgram)
				if (parsed.fbdProgram) logicStore.loadFBDProgram(parsed.fbdProgram)
				if (parsed.sfcProgram) logicStore.loadSFCProgram(parsed.sfcProgram)

				// Validate inline
				const s = logicStore.getState()
				const validationIssues: Array<{ message: string; severity: 'error' | 'warn'; location: string }> = []
				for (const rung of s.ladderProgram.rungs) {
					const hasOutput = rung.elements.some((e: any) => e.kind === 'coil' || e.kind === 'block')
					if (rung.elements.length > 0 && !hasOutput)
						validationIssues.push({ message: `Rung #${rung.number} has no output coil`, severity: 'warn', location: `LD rung-${rung.number}` })
				}
				const initSteps = s.sfcProgram.steps.filter((st: any) => st.isInitial)
				if (s.sfcProgram.steps.length > 0 && initSteps.length === 0)
					validationIssues.push({ message: 'SFC: No initial step defined', severity: 'error', location: 'SFC' })
				for (const t of s.sfcProgram.transitions) {
					if (!(t as any).condition?.trim())
						validationIssues.push({ message: `SFC transition ${t.id} has empty condition`, severity: 'warn', location: `SFC transition-${t.id}` })
				}
				for (const node of s.fbdProgram.nodes) {
					if (node.type === 'OUT_VARIABLE' && !s.fbdProgram.wires.some((w: any) => w.to.nodeId === node.id)) {
						const tag = (node as any).tag?.name ?? node.instanceName ?? node.id
						validationIssues.push({ message: `FBD: OUT_VARIABLE "${tag}" has no incoming wire`, severity: 'warn', location: `FBD node-${node.id}` })
					}
				}

				// Persist graphical files to workspace (ST is only written via plc_export_st)
				const folders = workspaceContextService.getWorkspace().folders
				if (folders.length > 0) {
					const base = folders[0].uri
					const writeIfNonempty = async (subPath: string, obj: unknown) => {
						const content = obj ? JSON.stringify(obj) : ''
						if (!content || content === '{}' || content === 'null') return
						await fileService.writeFile(URI.joinPath(base, subPath), VSBuffer.fromString(content))
					}
					await Promise.all([
						writeIfNonempty(`${pouName}.ld.json`, s.ladderProgram),
						writeIfNonempty(`${pouName}.fbd.json`, s.fbdProgram),
						writeIfNonempty(`${pouName}.sfc.json`, s.sfcProgram),
					])
				}

				console.log(`[Plaxio Perf] Tool plc_write_program: ${(performance.now() - tToolStart).toFixed(0)}ms`)
				return { result: { ok: true, validationIssues, pouName } }
			},
			plc_set_tag_database: async ({ tagsJson }) => {
				const tToolStart = performance.now()
				const tags = JSON.parse(tagsJson)
				logicStore.setTagDatabase(tags)
				console.log(`[Plaxio Perf] Tool plc_set_tag_database: ${(performance.now() - tToolStart).toFixed(0)}ms`)
				return { result: { ok: true, tagCount: tags.length } }
			},
			plc_export_st: async () => {
				const tToolStart = performance.now()
				const s = logicStore.getState()
				const clm = buildCLMFromStore(s.ladderProgram, s.fbdProgram, s.sfcProgram, s.tagDatabase as any)
				const compiled = clmToST(clm)
				const pouName = s.pous?.find((p: any) => p.id === s.activePouId)?.name || 'main'
				const fileName = `${pouName}.st`

				// Persist to workspace
				const folders = workspaceContextService.getWorkspace().folders
				if (folders.length > 0 && compiled.stCode) {
					const uri = URI.joinPath(folders[0].uri, fileName)
					await fileService.writeFile(uri, VSBuffer.fromString(compiled.stCode))
				}

				console.log(`[Plaxio Perf] Tool plc_export_st: ${(performance.now() - tToolStart).toFixed(0)}ms`)
				return { result: { stCode: compiled.stCode, stCodeForStrucpp: compiled.stCodeForStrucpp, pouName, fileName } }
			},
			plc_export_vendor: async ({ format }) => {
				const tToolStart = performance.now()
				const formatMap: Record<string, string> = {
					PLCopen: 'plcopen_xml', L5X: 'rockwell_l5x', SimaticML: 'siemens_simatic_ml',
				}
				const vendorFormat = (formatMap[format] ?? 'plcopen_xml') as any
				const result = await exportVendorFile({ format: vendorFormat })
				if (result.ok && result.xmlContent) {
					const ext = vendorFormat === 'rockwell_l5x' ? 'l5x' : vendorFormat === 'siemens_simatic_ml' ? 'xml' : 'xml'
					console.log(`[Plaxio Perf] Tool plc_export_vendor: ${(performance.now() - tToolStart).toFixed(0)}ms`)
					return { result: { content: result.xmlContent, format, fileName: `program.${ext}` } }
				} else {
					throw new Error(result.errors?.join('; ') ?? 'Export failed')
				}
			},
			plc_convert_language: async ({ from, to }) => {
				if (to === 'ST') {
					const s = logicStore.getState()
					const clm = buildCLMFromStore(s.ladderProgram, s.fbdProgram, s.sfcProgram, s.tagDatabase as any)
					const compiled = clmToST(clm)
					const pouName = s.pous?.find((p: any) => p.id === s.activePouId)?.name || 'main'
					// Persist .st file
					const folders = workspaceContextService.getWorkspace().folders
					if (folders.length > 0 && compiled.stCode) {
						await fileService.writeFile(URI.joinPath(folders[0].uri, `${pouName}.st`), VSBuffer.fromString(compiled.stCode))
					}
					const guidance = `The ${from} program has been compiled to IEC 61131-3 Structured Text and saved as ${pouName}.st. ` +
						`Review the ST code above. You can edit it directly using rewrite_file if changes are needed. ` +
						`To deploy to a PLC runtime, use the .st file directly — it is valid MatIEC/OpenPLC ST.`
					return { result: { sourceProgram: compiled.stCode, targetLanguage: 'ST', guidance } }
				}

				// For graphical-to-graphical conversions: read source program and guide AI to rewrite
				const s = logicStore.getState()
				const snapshot = {
					ladderProgram: s.ladderProgram,
					fbdProgram: s.fbdProgram,
					sfcProgram: s.sfcProgram,
					tagDatabase: s.tagDatabase,
				}
				const program = JSON.stringify(snapshot)
				const guidance = `Convert the ${from} program above to ${to} format using the Plaxio schema rules. ` +
					`Preserve all tag names exactly. Call plc_write_program with the converted ${to} program.`
				return { result: { sourceProgram: program, targetLanguage: to, guidance } }
			},
			// ---
			import_vendor_file: async ({ uri, xmlContent: inlineContent, filename: inlineFilename }: { uri?: any, xmlContent?: string, filename?: string }) => {
				const tToolStart = performance.now()
				let xmlContent: string
				let filename: string
				if (inlineContent) {
					xmlContent = inlineContent
					filename = inlineFilename ?? 'imported.xml'
				} else {
					const fileContent = await fileService.readFile(uri)
					xmlContent = fileContent.value.toString()
					filename = uri.path.split('/').pop() ?? ''
				}
				const result = await importVendorFile(xmlContent, filename, uri?.fsPath ?? filename)
				console.log(`[Plaxio Perf] Tool import_vendor_file: ${(performance.now() - tToolStart).toFixed(0)}ms`)
				if (result.ok) {
					return {
						result: {
							projectName: (result as any).projectName ?? filename,
							pouCount: (result as any).pouCount ?? 0,
							tagCount: (result as any).tagCount ?? 0,
							unmappedCount: (result as any).unmappedCount ?? 0,
							warnings: (result as any).warnings ?? [],
						}
					}
				} else {
					throw new Error((result as any).errors?.join('; ') ?? 'Import failed')
				}
			},

			plaxio_generate_view: async ({ pouName }) => {
				const viewName = pouName || 'main'
				const viewId = 'view-' + viewName.replace(/[^a-zA-Z0-9_]/g, '')
				const projRes = await fetch('http://127.0.0.1:1881/api/project')
				if (!projRes.ok) throw new Error(`GET /api/project → ${projRes.status}`)
				const project = await projRes.json()
				if (!project.hmi) project.hmi = {}
				if (!project.hmi.views) project.hmi.views = []
				if (!project.hmi.layout) project.hmi.layout = {}
				project.hmi.layout.navigation = { mode: 'void', items: [], logo: false, title: '' }
				const existing = project.hmi.views.find((v: any) => v.name === viewName)
				if (existing) {
					return { result: { ok: true, viewName, message: 'View already exists' } }
				}
				const newView = {
					id: viewId,
					name: viewName,
					profile: { width: 1024, height: 768, bkcolor: '#ffffff' },
					items: [],
					svgcontent: `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="768"><rect width="100%" height="100%" fill="#ffffff"/><text x="512" y="384" text-anchor="middle" font-size="24" fill="#333">${viewName}</text></svg>`
				}
				project.hmi.views.push(newView)
				const saveRes = await fetch('http://127.0.0.1:1881/api/project', {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify(project)
				})
				if (!saveRes.ok) throw new Error(`POST /api/project → ${saveRes.status}`)
				return { result: { ok: true, viewName } }
			},
			plaxio_get_project: async () => {
				const res = await fetch('http://127.0.0.1:1881/api/project')
				if (!res.ok) throw new Error(`Plaxio Simulator GET /api/project → ${res.status}`)
				const project = await res.json()
				return { result: { project: JSON.stringify(project) } }
			},

			plaxio_save_view: async ({ viewJson }) => {
				const incoming = JSON.parse(viewJson)
				// Detect if the AI passed a full project JSON (has devices/hmi) vs a bare view object.
				// A bare view always has svgcontent; a project JSON never does at the top level.
				const isFullProject = (incoming.hmi !== undefined || incoming.devices !== undefined) && incoming.svgcontent === undefined
				const view = isFullProject
					? (Array.isArray(incoming.hmi?.views) && incoming.hmi.views.length > 0 ? incoming.hmi.views[0] : incoming.hmi ?? incoming)
					: incoming
				if (!view.id) view.id = 'view_' + Math.random().toString(36).slice(2, 10)
				if (!view.name) throw new Error('view.name is required')
				// Always white background
				if (!view.profile) view.profile = {}
				view.profile.bkcolor = '#ffffff'
				// Normalize items — strip nulls, add property:{} — FUXA crashes on null items
				const normalizeItems = (v: any) => {
					if (Array.isArray(v.items)) {
						v.items = v.items.filter((item: any) => item !== null && item !== undefined)
						for (const item of v.items) {
							if (typeof item === 'object' && !item.property) item.property = {}
						}
					} else if (v.items && typeof v.items === 'object') {
						for (const k of Object.keys(v.items)) {
							if (!v.items[k]) { delete v.items[k]; continue }
							if (!v.items[k].property) v.items[k].property = {}
						}
					}
				}
				normalizeItems(view)
				if (isFullProject && Array.isArray((incoming as any).hmi?.views)) {
					for (const v of (incoming as any).hmi.views) normalizeItems(v)
				}
				// GET current project, merge devices + upsert view, POST back
				const getRes = await fetch('http://127.0.0.1:1881/api/project')
				if (!getRes.ok) throw new Error(`Plaxio Simulator GET /api/project → ${getRes.status}`)
				const project = await getRes.json()
				// Merge devices from incoming so tags are registered and setTagValue works
				if (isFullProject && incoming.devices && typeof incoming.devices === 'object') {
					project.devices = { ...(project.devices ?? {}), ...incoming.devices }
				}
				const hmi = project.hmi ?? project
				if (!hmi.views) hmi.views = []
				const existingIdx = hmi.views.findIndex((v: any) => v.id === view.id || v.name === view.name)
				if (existingIdx >= 0) {
					hmi.views[existingIdx] = view
				} else {
					hmi.views.push(view)
				}
				// Set this view as the start/home view so it shows immediately
				if (hmi.layout) hmi.layout.start = view.id
				const postRes = await fetch('http://127.0.0.1:1881/api/project', {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify(project),
				})
				if (!postRes.ok) throw new Error(`Plaxio Simulator POST /api/project → ${postRes.status}`)
				return { result: { viewId: view.id, viewName: view.name } }
			},

			plaxio_set_tag_value: async ({ tags }) => {
				// Fetch current project
				const projRes = await fetch('http://127.0.0.1:1881/api/project')
				if (!projRes.ok) throw new Error(`Plaxio Simulator GET /api/project → ${projRes.status}`)
				const project = await projRes.json()
				// Ensure FuxaServer device exists
				if (!project.devices) project.devices = {}
				if (!project.devices['0']) project.devices['0'] = { id: '0', name: 'FuxaServer', type: 'FuxaServer', enabled: true, property: { address: '' }, tags: {} }
				const fuxaDevice = project.devices['0']
				if (!fuxaDevice.tags) fuxaDevice.tags = {}
				// Build name→id map from all devices
				const nameToId: Record<string, string> = {}
				for (const device of Object.values(project.devices) as any[]) {
					for (const [id, tag] of Object.entries(device.tags ?? {}) as [string, any][]) {
						if (tag.name) {
							nameToId[tag.name] = id
							nameToId[id] = id
						}
					}
				}
				// Auto-register any unknown tags into FuxaServer so FUXA can set their values
				let registeredNew = false
				for (const { tagName } of tags) {
					const tagId = `FuxaServer^~^${tagName}`
					if (!nameToId[tagName] && !nameToId[tagId]) {
						fuxaDevice.tags[tagId] = { id: tagId, name: tagName, type: 'number', init: 0, format: '' }
						nameToId[tagName] = tagId
						nameToId[tagId] = tagId
						registeredNew = true
					}
				}
				// If new tags were registered, POST project to persist them before setting values
				if (registeredNew) {
					const saveRes = await fetch('http://127.0.0.1:1881/api/project', {
						method: 'POST',
						headers: { 'Content-Type': 'application/json' },
						body: JSON.stringify(project),
					})
					if (!saveRes.ok) throw new Error(`Plaxio Simulator POST /api/project (tag registration) → ${saveRes.status}`)
					// Wait for FUXA runtime to restart after project update
					await new Promise(r => setTimeout(r, 600))
				}
				// Build payload and set values
				const payload: Array<{ id: string; value: any }> = []
				for (const { tagName, value } of tags) {
					const id = nameToId[tagName] ?? nameToId[`FuxaServer^~^${tagName}`] ?? `FuxaServer^~^${tagName}`
					payload.push({ id, value })
				}
				const setRes = await fetch('http://127.0.0.1:1881/api/setTagValue', {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({ tags: payload }),
				})
				if (!setRes.ok) throw new Error(`Plaxio Simulator POST /api/setTagValue → ${setRes.status}`)
				return { result: { set: payload.length } }
			},
			plc_add_verify_property: async ({ propertiesJson }) => {
				const properties = JSON.parse(propertiesJson as string) as Array<{
					kind: string; label: string; tags?: string[]; expression?: string;
					trigger?: string; response?: string; withinScans?: number;
				}>
				// Post to the React VerifyPanel via window.postMessage
				const requestId = `verify_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`
				const added: string[] = []
				for (const prop of properties) {
					const id = `prop_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`
					const fullProp = { ...prop, id }
					window.postMessage({ type: 'plaxio:verify-add-property', property: fullProp }, '*')
					added.push(`${prop.kind}: "${prop.label}"`)
				}
				return { result: { added, count: added.length } }
			},
		}


		const nextPageStr = (hasNextPage: boolean) => hasNextPage ? '\n\n(more on next page...)' : ''

		const stringifyLintErrors = (lintErrors: LintErrorItem[]) => {
			return lintErrors
				.map((e, i) => `Error ${i + 1}:\nLines Affected: ${e.startLineNumber}-${e.endLineNumber}\nError message:${e.message}`)
				.join('\n\n')
				.substring(0, MAX_FILE_CHARS_PAGE)
		}

		// given to the LLM after the call for successful tool calls
		this.stringOfResult = {
			read_file: (params, result) => {
				return `${params.uri.fsPath}\n\`\`\`\n${result.fileContents}\n\`\`\`${nextPageStr(result.hasNextPage)}${result.hasNextPage ? `\nMore info because truncated: this file has ${result.totalNumLines} lines, or ${result.totalFileLen} characters.` : ''}`
			},
			ls_dir: (params, result) => {
				const dirTreeStr = stringifyDirectoryTree1Deep(params, result)
				return dirTreeStr // + nextPageStr(result.hasNextPage) // already handles num results remaining
			},
			get_dir_tree: (params, result) => {
				return result.str
			},
			search_pathnames_only: (params, result) => {
				return result.uris.map(uri => uri.fsPath).join('\n') + nextPageStr(result.hasNextPage)
			},
			search_for_files: (params, result) => {
				return result.uris.map(uri => uri.fsPath).join('\n') + nextPageStr(result.hasNextPage)
			},
			search_in_file: (params, result) => {
				const { model } = voidModelService.getModel(params.uri)
				if (!model) return '<Error getting string of result>'
				const lines = result.lines.map(n => {
					const lineContent = model.getValueInRange({ startLineNumber: n, startColumn: 1, endLineNumber: n, endColumn: Number.MAX_SAFE_INTEGER }, EndOfLinePreference.LF)
					return `Line ${n}:\n\`\`\`\n${lineContent}\n\`\`\``
				}).join('\n\n');
				return lines;
			},
			read_lint_errors: (params, result) => {
				return result.lintErrors ?
					stringifyLintErrors(result.lintErrors)
					: 'No lint errors found.'
			},
			// ---
			create_file_or_folder: (params, result) => {
				return `URI ${params.uri.fsPath} successfully created.`
			},
			delete_file_or_folder: (params, result) => {
				return `URI ${params.uri.fsPath} successfully deleted.`
			},
			edit_file: (params, result) => {
				const lintErrsString = (
					this.voidSettingsService.state.globalSettings.includeToolLintErrors ?
						(result.lintErrors ? ` Lint errors found after change:\n${stringifyLintErrors(result.lintErrors)}.\nIf this is related to a change made while calling this tool, you might want to fix the error.`
							: ` No lint errors found.`)
						: '')

				return `Change successfully made to ${params.uri.fsPath}.${lintErrsString}`
			},
			rewrite_file: (params, result) => {
				const lintErrsString = (
					this.voidSettingsService.state.globalSettings.includeToolLintErrors ?
						(result.lintErrors ? ` Lint errors found after change:\n${stringifyLintErrors(result.lintErrors)}.\nIf this is related to a change made while calling this tool, you might want to fix the error.`
							: ` No lint errors found.`)
						: '')

				return `Change successfully made to ${params.uri.fsPath}.${lintErrsString}`
			},
			run_command: (params, result) => {
				const { resolveReason, result: result_, } = result
				// success
				if (resolveReason.type === 'done') {
					return `${result_}\n(exit code ${resolveReason.exitCode})`
				}
				// normal command
				if (resolveReason.type === 'timeout') {
					return `${result_}\nTerminal command ran, but was automatically killed by Void after ${MAX_TERMINAL_INACTIVE_TIME}s of inactivity and did not finish successfully. To try with more time, open a persistent terminal and run the command there.`
				}
				throw new Error(`Unexpected internal error: Terminal command did not resolve with a valid reason.`)
			},

			run_persistent_command: (params, result) => {
				const { resolveReason, result: result_, } = result
				const { persistentTerminalId } = params
				// success
				if (resolveReason.type === 'done') {
					return `${result_}\n(exit code ${resolveReason.exitCode})`
				}
				// bg command
				if (resolveReason.type === 'timeout') {
					return `${result_}\nTerminal command is running in terminal ${persistentTerminalId}. The given outputs are the results after ${MAX_TERMINAL_BG_COMMAND_TIME} seconds.`
				}
				throw new Error(`Unexpected internal error: Terminal command did not resolve with a valid reason.`)
			},

			open_persistent_terminal: (_params, result) => {
				const { persistentTerminalId } = result;
				return `Successfully created persistent terminal. persistentTerminalId="${persistentTerminalId}"`;
			},
			kill_persistent_terminal: (params, _result) => {
				return `Successfully closed terminal "${params.persistentTerminalId}".`;
			},
			import_vendor_file: (params, result) => {
				const { projectName, pouCount, tagCount, unmappedCount, warnings } = result
				const source = params.uri?.fsPath ?? params.filename ?? 'inline content'
				let msg = `Successfully imported "${projectName}" from ${source}. ${pouCount} POU(s), ${tagCount} tag(s) loaded into the PLC editor.`
				if (unmappedCount > 0) msg += ` ${unmappedCount} element(s) could not be mapped and were preserved in sidecar metadata.`
				if (warnings.length > 0) msg += `\nWarnings:\n${warnings.map(w => `- ${w}`).join('\n')}`
				return msg
			},
			plc_get_program: (_params, result) => {
				return `Current PLC program state:\n${result.program}`
			},
			plc_validate: (_params, result) => {
				if (result.issues.length === 0) return `Validation passed — no issues found.`
				const lines = result.issues.map((iss, i) => `${i + 1}. [${iss.severity.toUpperCase()}] ${iss.location}: ${iss.message}`)
				return `Validation found ${result.issues.length} issue(s):\n${lines.join('\n')}`
			},
			plc_write_program: (_params, result) => {
				if (!result.ok) return `plc_write_program failed.`
				const fileMsg = `Files saved: ${result.pouName}.ld.json, ${result.pouName}.fbd.json, ${result.pouName}.sfc.json`
				if (result.validationIssues.length === 0) return `Program written and loaded into editor. ${fileMsg}. Validation: no issues.`
				const lines = result.validationIssues.map((iss, i) => `${i + 1}. [${iss.severity.toUpperCase()}] ${iss.location}: ${iss.message}`)
				return `Program written and loaded into editor. ${fileMsg}.\nValidation found ${result.validationIssues.length} issue(s):\n${lines.join('\n')}`
			},
			plc_set_tag_database: (_params, result) => {
				return result.ok ? `Tag database updated — ${result.tagCount} tag(s) now active.` : `plc_set_tag_database failed.`
			},
			plc_export_st: (_params, result) => {
				return `ST export complete. File saved as "${result.fileName}" in workspace.\n\nStructured Text code:\n${result.stCode}`
			},
			plc_export_vendor: (_params, result) => {
				return `Exported as ${result.format}. Suggested filename: ${result.fileName}\n\nContent:\n${result.content}`
			},
			plc_convert_language: (_params, result) => {
				return `Source program (${result.targetLanguage} conversion requested):\n${result.sourceProgram}\n\nGuidance: ${result.guidance}`
			},
			plaxio_get_project: (_params, result) => {
				return `Plaxio Simulator project loaded. Full project JSON:\n${result.project}`
			},
			plaxio_generate_view: (_params, result) => {
				return result.ok
					? `Plaxio Simulator HMI view "${result.viewName}" auto-generated from current tag database. Open the Simulator tab to preview it.`
					: `Plaxio Simulator view generation failed.`
			},
			plaxio_save_view: (_params, result) => {
				return `View "${result.viewName}" (id: ${result.viewId}) saved to Plaxio Simulator. Open the Simulator tab to see the result.`
			},
			plaxio_set_tag_value: (_params, result) => {
				const count = (result as any)?.set ?? (result as any)?.result?.set ?? 0
				return `Set ${count} tags in Plaxio Simulator.`
			},
			plc_add_verify_property: (_params, result) => {
				return `Added ${result.count} verification propert${result.count === 1 ? 'y' : 'ies'}: ${result.added.join('; ')}. Open the Verify tab in the bottom panel to run formal verification.`
			},
		}



	}


	private _getLintErrors(uri: URI): { lintErrors: LintErrorItem[] | null } {
		const lintErrors = this.markerService
			.read({ resource: uri })
			.filter(l => l.severity === MarkerSeverity.Error || l.severity === MarkerSeverity.Warning)
			.slice(0, 100)
			.map(l => ({
				code: typeof l.code === 'string' ? l.code : l.code?.value || '',
				message: (l.severity === MarkerSeverity.Error ? '(error) ' : '(warning) ') + l.message,
				startLineNumber: l.startLineNumber,
				endLineNumber: l.endLineNumber,
			} satisfies LintErrorItem))

		if (!lintErrors.length) return { lintErrors: null }
		return { lintErrors, }
	}


}

registerSingleton(IToolsService, ToolsService, InstantiationType.Eager);
