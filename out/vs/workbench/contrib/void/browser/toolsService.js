var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __decorateClass = (decorators, target, key, kind) => {
  var result = kind > 1 ? void 0 : kind ? __getOwnPropDesc(target, key) : target;
  for (var i = decorators.length - 1, decorator; i >= 0; i--)
    if (decorator = decorators[i])
      result = (kind ? decorator(target, key, result) : decorator(result)) || result;
  if (kind && result) __defProp(target, key, result);
  return result;
};
var __decorateParam = (index, decorator) => (target, key) => decorator(target, key, index);
import { CancellationToken } from "../../../../base/common/cancellation.js";
import { URI } from "../../../../base/common/uri.js";
import { VSBuffer } from "../../../../base/common/buffer.js";
import { IFileService } from "../../../../platform/files/common/files.js";
import { registerSingleton, InstantiationType } from "../../../../platform/instantiation/common/extensions.js";
import { createDecorator, IInstantiationService } from "../../../../platform/instantiation/common/instantiation.js";
import { IWorkspaceContextService } from "../../../../platform/workspace/common/workspace.js";
import { QueryBuilder } from "../../../services/search/common/queryBuilder.js";
import { ISearchService } from "../../../services/search/common/search.js";
import { IEditCodeService } from "./editCodeServiceInterface.js";
import { ITerminalToolService } from "./terminalToolService.js";
import { IVoidModelService } from "../common/voidModelService.js";
import { EndOfLinePreference } from "../../../../editor/common/model.js";
import { IVoidCommandBarService } from "./voidCommandBarService.js";
import { computeDirectoryTree1Deep, IDirectoryStrService, stringifyDirectoryTree1Deep } from "../common/directoryStrService.js";
import { IMarkerService, MarkerSeverity } from "../../../../platform/markers/common/markers.js";
import { timeout } from "../../../../base/common/async.js";
import { MAX_CHILDREN_URIs_PAGE, MAX_FILE_CHARS_PAGE, MAX_TERMINAL_BG_COMMAND_TIME, MAX_TERMINAL_INACTIVE_TIME } from "../common/prompt/prompts.js";
import { IVoidSettingsService } from "../common/voidSettingsService.js";
import { IEditorService } from "../../../services/editor/common/editorService.js";
import { generateUuid } from "../../../../base/common/uuid.js";
import { logicStore, importVendorFile, exportVendorFile, clmToST, buildCLMFromStore } from "./react/out/plc-editor-tsx/index.js";
const isFalsy = (u) => {
  return !u || u === "null" || u === "undefined";
};
const validateStr = (argName, value) => {
  if (value === null) throw new Error(`Invalid LLM output: ${argName} was null.`);
  if (typeof value !== "string") throw new Error(`Invalid LLM output format: ${argName} must be a string, but its type is "${typeof value}". Full value: ${JSON.stringify(value)}.`);
  return value;
};
const validateURI = (uriStr) => {
  if (uriStr === null) throw new Error(`Invalid LLM output: uri was null.`);
  if (typeof uriStr !== "string") throw new Error(`Invalid LLM output format: Provided uri must be a string, but it's a(n) ${typeof uriStr}. Full value: ${JSON.stringify(uriStr)}.`);
  if (uriStr.includes("://")) {
    try {
      const uri = URI.parse(uriStr);
      return uri;
    } catch (e) {
      throw new Error(`Invalid URI format: ${uriStr}. Error: ${e}`);
    }
  } else {
    const uri = URI.file(uriStr);
    return uri;
  }
};
const validateOptionalURI = (uriStr) => {
  if (isFalsy(uriStr)) return null;
  return validateURI(uriStr);
};
const validateOptionalStr = (argName, str) => {
  if (isFalsy(str)) return null;
  return validateStr(argName, str);
};
const validatePageNum = (pageNumberUnknown) => {
  if (!pageNumberUnknown) return 1;
  const parsedInt = Number.parseInt(pageNumberUnknown + "");
  if (!Number.isInteger(parsedInt)) throw new Error(`Page number was not an integer: "${pageNumberUnknown}".`);
  if (parsedInt < 1) throw new Error(`Invalid LLM output format: Specified page number must be 1 or greater: "${pageNumberUnknown}".`);
  return parsedInt;
};
const validateNumber = (numStr, opts) => {
  if (typeof numStr === "number")
    return numStr;
  if (isFalsy(numStr)) return opts.default;
  if (typeof numStr === "string") {
    const parsedInt = Number.parseInt(numStr + "");
    if (!Number.isInteger(parsedInt)) return opts.default;
    return parsedInt;
  }
  return opts.default;
};
const validateProposedTerminalId = (terminalIdUnknown) => {
  if (!terminalIdUnknown) throw new Error(`A value for terminalID must be specified, but the value was "${terminalIdUnknown}"`);
  const terminalId = terminalIdUnknown + "";
  return terminalId;
};
const validateBoolean = (b, opts) => {
  if (typeof b === "string") {
    if (b === "true") return true;
    if (b === "false") return false;
  }
  if (typeof b === "boolean") {
    return b;
  }
  return opts.default;
};
const checkIfIsFolder = (uriStr) => {
  uriStr = uriStr.trim();
  if (uriStr.endsWith("/") || uriStr.endsWith("\\")) return true;
  return false;
};
const IToolsService = createDecorator("ToolsService");
let ToolsService = class {
  constructor(fileService, workspaceContextService, searchService, instantiationService, voidModelService, editCodeService, terminalToolService, commandBarService, directoryStrService, markerService, voidSettingsService, editorService) {
    this.terminalToolService = terminalToolService;
    this.commandBarService = commandBarService;
    this.directoryStrService = directoryStrService;
    this.markerService = markerService;
    this.voidSettingsService = voidSettingsService;
    this.editorService = editorService;
    const queryBuilder = instantiationService.createInstance(QueryBuilder);
    window.addEventListener('message', async (event) => {
      if (event.data?.type === 'volt:plc-persist-after-import') {
        const folders = workspaceContextService.getWorkspace().folders;
        if (folders.length === 0) return;
        const s = logicStore.getState();
        const pouName = s.pous?.[0]?.name || event.data.projectName?.replace(/[^a-zA-Z0-9_]/g, '_') || 'main';
        const base = folders[0].uri;
        const writeIfNonempty = async (subPath, obj) => {
          const content = obj ? JSON.stringify(obj) : '';
          if (!content || content === '{}' || content === 'null' || content === '{"rungs":[]}') return;
          await fileService.writeFile(URI.joinPath(base, subPath), VSBuffer.fromString(content));
        };
        await Promise.all([
          writeIfNonempty(`${pouName}.ld.json`, s.ladderProgram),
          writeIfNonempty(`${pouName}.fbd.json`, s.fbdProgram),
          writeIfNonempty(`${pouName}.sfc.json`, s.sfcProgram),
        ]);
        try {
          const clm = buildCLMFromStore(s.ladderProgram, s.fbdProgram, s.sfcProgram, s.tagDatabase);
          const compiled = clmToST(clm);
          if (compiled.stCode) {
            await fileService.writeFile(URI.joinPath(base, `${pouName}.st`), VSBuffer.fromString(compiled.stCode));
          }
        } catch {}
        console.log(`[Plaxio] Auto-persisted imported program files for: ${pouName}`);
      }
    });
    this.validateParams = {
      read_file: (params) => {
        const { uri: uriStr, start_line: startLineUnknown, end_line: endLineUnknown, page_number: pageNumberUnknown } = params;
        const uri = validateURI(uriStr);
        const pageNumber = validatePageNum(pageNumberUnknown);
        let startLine = validateNumber(startLineUnknown, { default: null });
        let endLine = validateNumber(endLineUnknown, { default: null });
        if (startLine !== null && startLine < 1) startLine = null;
        if (endLine !== null && endLine < 1) endLine = null;
        return { uri, startLine, endLine, pageNumber };
      },
      ls_dir: (params) => {
        const { uri: uriStr, page_number: pageNumberUnknown } = params;
        const uri = validateURI(uriStr);
        const pageNumber = validatePageNum(pageNumberUnknown);
        return { uri, pageNumber };
      },
      get_dir_tree: (params) => {
        const { uri: uriStr } = params;
        const uri = validateURI(uriStr);
        return { uri };
      },
      search_pathnames_only: (params) => {
        const {
          query: queryUnknown,
          search_in_folder: includeUnknown,
          page_number: pageNumberUnknown
        } = params;
        const queryStr = validateStr("query", queryUnknown);
        const pageNumber = validatePageNum(pageNumberUnknown);
        const includePattern = validateOptionalStr("include_pattern", includeUnknown);
        return { query: queryStr, includePattern, pageNumber };
      },
      search_for_files: (params) => {
        const {
          query: queryUnknown,
          search_in_folder: searchInFolderUnknown,
          is_regex: isRegexUnknown,
          page_number: pageNumberUnknown
        } = params;
        const queryStr = validateStr("query", queryUnknown);
        const pageNumber = validatePageNum(pageNumberUnknown);
        const searchInFolder = validateOptionalURI(searchInFolderUnknown);
        const isRegex = validateBoolean(isRegexUnknown, { default: false });
        return {
          query: queryStr,
          isRegex,
          searchInFolder,
          pageNumber
        };
      },
      search_in_file: (params) => {
        const { uri: uriStr, query: queryUnknown, is_regex: isRegexUnknown } = params;
        const uri = validateURI(uriStr);
        const query = validateStr("query", queryUnknown);
        const isRegex = validateBoolean(isRegexUnknown, { default: false });
        return { uri, query, isRegex };
      },
      read_lint_errors: (params) => {
        const {
          uri: uriUnknown
        } = params;
        const uri = validateURI(uriUnknown);
        return { uri };
      },
      // ---
      create_file_or_folder: (params) => {
        const { uri: uriUnknown } = params;
        const uri = validateURI(uriUnknown);
        const uriStr = validateStr("uri", uriUnknown);
        const isFolder = checkIfIsFolder(uriStr);
        return { uri, isFolder };
      },
      delete_file_or_folder: (params) => {
        const { uri: uriUnknown, is_recursive: isRecursiveUnknown } = params;
        const uri = validateURI(uriUnknown);
        const isRecursive = validateBoolean(isRecursiveUnknown, { default: false });
        const uriStr = validateStr("uri", uriUnknown);
        const isFolder = checkIfIsFolder(uriStr);
        return { uri, isRecursive, isFolder };
      },
      rewrite_file: (params) => {
        const { uri: uriStr, new_content: newContentUnknown } = params;
        const uri = validateURI(uriStr);
        const newContent = validateStr("newContent", newContentUnknown);
        if (!newContent.trim()) throw new Error(`Invalid LLM output: new_content is empty. You must provide the full file content.`);
        return { uri, newContent };
      },
      edit_file: (params) => {
        const { uri: uriStr, search_replace_blocks: searchReplaceBlocksUnknown } = params;
        const uri = validateURI(uriStr);
        const searchReplaceBlocks = validateStr("searchReplaceBlocks", searchReplaceBlocksUnknown);
        return { uri, searchReplaceBlocks };
      },
      // ---
      run_command: (params) => {
        const { command: commandUnknown, cwd: cwdUnknown } = params;
        const command = validateStr("command", commandUnknown);
        const cwd = validateOptionalStr("cwd", cwdUnknown);
        const terminalId = generateUuid();
        return { command, cwd, terminalId };
      },
      run_persistent_command: (params) => {
        const { command: commandUnknown, persistent_terminal_id: persistentTerminalIdUnknown } = params;
        const command = validateStr("command", commandUnknown);
        const persistentTerminalId = validateProposedTerminalId(persistentTerminalIdUnknown);
        return { command, persistentTerminalId };
      },
      open_persistent_terminal: (params) => {
        const { cwd: cwdUnknown } = params;
        const cwd = validateOptionalStr("cwd", cwdUnknown);
        return { cwd };
      },
      kill_persistent_terminal: (params) => {
        const { persistent_terminal_id: terminalIdUnknown } = params;
        const persistentTerminalId = validateProposedTerminalId(terminalIdUnknown);
        return { persistentTerminalId };
      },
      import_vendor_file: (params) => {
        const { uri: uriStr, xmlContent, filename } = params;
        if (xmlContent) {
          return { xmlContent: String(xmlContent), filename: String(filename ?? 'imported.xml') };
        }
        const uri = validateURI(uriStr);
        return { uri };
      },
      plc_get_program: (_params) => {
        return {};
      },
      plc_validate: (_params) => {
        return {};
      },
      plc_write_program: (params) => {
        const { programJson: pj } = params;
        if (typeof pj !== "string" || !pj.trim()) throw new Error("programJson must be a non-empty JSON string");
        JSON.parse(pj);
        return { programJson: pj };
      },
      plc_set_tag_database: (params) => {
        const { tagsJson: tj } = params;
        if (typeof tj !== "string" || !tj.trim()) throw new Error("tagsJson must be a non-empty JSON string");
        JSON.parse(tj);
        return { tagsJson: tj };
      },
      plc_export_vendor: (params) => {
        const { format: formatUnknown } = params;
        const format = typeof formatUnknown === "string" && ["PLCopen", "L5X", "SimaticML", "XEF"].includes(formatUnknown) ? formatUnknown : "PLCopen";
        return { format };
      },
      plc_export_st: (_params) => {
        return {};
      },
      plc_convert_language: (params) => {
        const { from: fromUnknown, to: toUnknown } = params;
        const validLangs = ["LD", "FBD", "SFC", "ST"];
        const from = typeof fromUnknown === "string" && ["LD", "FBD", "SFC"].includes(fromUnknown) ? fromUnknown : "LD";
        const to = typeof toUnknown === "string" && validLangs.includes(toUnknown) ? toUnknown : "FBD";
        return { from, to };
      },
      plaxio_get_project: (_params) => {
        return {};
      },
      plaxio_generate_view: (params) => {
        const pouName = typeof params.pouName === "string" ? params.pouName.trim() : void 0;
        return { pouName };
      },
      plaxio_save_view: (params) => {
        let viewObj;
        // Priority 1: viewJson is already a parsed object
        if (typeof params.viewJson === "object" && params.viewJson !== null) {
          viewObj = params.viewJson;
        }
        // Priority 2: viewJson is a valid JSON string
        else if (typeof params.viewJson === "string" && params.viewJson.trim()) {
          try { viewObj = JSON.parse(params.viewJson); }
          catch (_e) {
            // Try repair: escape control chars
            const repaired = params.viewJson.replace(/[\x00-\x1f]/g, (c) => "\\u" + c.charCodeAt(0).toString(16).padStart(4, "0"));
            try { viewObj = JSON.parse(repaired); }
            catch (_e2) {
              // Last resort: strip svgcontent (the usual culprit) and rebuild minimal view
              const nameMatch = params.viewJson.match(/"name"\s*:\s*"([^"]+)"/);
              if (nameMatch) {
                viewObj = { name: nameMatch[1], profile: { width: 1024, height: 768, bkcolor: "#ffffff" }, items: [], svgcontent: '<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="768"><rect width="100%" height="100%" fill="#fff"/></svg>' };
              } else {
                throw new Error("viewJson could not be parsed. Pass viewJson as an object, not a string.");
              }
            }
          }
        }
        // Priority 3: params itself has view fields
        else if (params.name || params.svgcontent || params.hmi) {
          const { viewJson: _vj, ...rest } = params;
          viewObj = rest;
        } else {
          throw new Error("viewJson must be a JSON object or string with at least 'name'");
        }
        return { viewJson: JSON.stringify(viewObj) };
      },
      plaxio_set_tag_value: (params) => {
        const raw = params.tags;
        const arr = Array.isArray(raw) ? raw : (typeof raw === "string" ? JSON.parse(raw) : null);
        if (!Array.isArray(arr) || arr.length === 0) throw new Error("tags must be a non-empty array of {tagName, value}");
        const tags = arr.map((t) => {
          if (typeof t.tagName !== "string" || !t.tagName.trim()) throw new Error("each tag must have a tagName string");
          const value = typeof t.value === "boolean" || typeof t.value === "number" ? t.value : typeof t.value === "string" ? t.value : String(t.value);
          return { tagName: t.tagName.trim(), value };
        });
        return { tags };
      },
      plc_add_verify_property: (params) => {
        const { propertiesJson: pj } = params;
        if (typeof pj !== "string" || !pj.trim()) throw new Error("propertiesJson must be a non-empty JSON string");
        const parsed = JSON.parse(pj);
        if (!Array.isArray(parsed)) throw new Error("propertiesJson must be a JSON array of property objects");
        return { propertiesJson: pj };
      }
    };
    this.callTool = {
      read_file: async ({ uri, startLine, endLine, pageNumber }) => {
        await voidModelService.initializeModel(uri);
        const { model } = await voidModelService.getModelSafe(uri);
        if (model === null) {
          throw new Error(`No contents; File does not exist.`);
        }
        let contents;
        if (startLine === null && endLine === null) {
          contents = model.getValue(EndOfLinePreference.LF);
        } else {
          const startLineNumber = startLine === null ? 1 : startLine;
          const endLineNumber = endLine === null ? model.getLineCount() : endLine;
          contents = model.getValueInRange({ startLineNumber, startColumn: 1, endLineNumber, endColumn: Number.MAX_SAFE_INTEGER }, EndOfLinePreference.LF);
        }
        const totalNumLines = model.getLineCount();
        const fromIdx = MAX_FILE_CHARS_PAGE * (pageNumber - 1);
        const toIdx = MAX_FILE_CHARS_PAGE * pageNumber - 1;
        const fileContents = contents.slice(fromIdx, toIdx + 1);
        const hasNextPage = contents.length - 1 - toIdx >= 1;
        const totalFileLen = contents.length;
        return { result: { fileContents, totalFileLen, hasNextPage, totalNumLines } };
      },
      ls_dir: async ({ uri, pageNumber }) => {
        const dirResult = await computeDirectoryTree1Deep(fileService, uri, pageNumber);
        return { result: dirResult };
      },
      get_dir_tree: async ({ uri }) => {
        const str = await this.directoryStrService.getDirectoryStrTool(uri);
        return { result: { str } };
      },
      search_pathnames_only: async ({ query: queryStr, includePattern, pageNumber }) => {
        const query = queryBuilder.file(workspaceContextService.getWorkspace().folders.map((f) => f.uri), {
          filePattern: queryStr,
          includePattern: includePattern ?? void 0,
          sortByScore: true
          // makes results 10x better
        });
        const data = await searchService.fileSearch(query, CancellationToken.None);
        const fromIdx = MAX_CHILDREN_URIs_PAGE * (pageNumber - 1);
        const toIdx = MAX_CHILDREN_URIs_PAGE * pageNumber - 1;
        const uris = data.results.slice(fromIdx, toIdx + 1).map(({ resource, results }) => resource);
        const hasNextPage = data.results.length - 1 - toIdx >= 1;
        return { result: { uris, hasNextPage } };
      },
      search_for_files: async ({ query: queryStr, isRegex, searchInFolder, pageNumber }) => {
        const searchFolders = searchInFolder === null ? workspaceContextService.getWorkspace().folders.map((f) => f.uri) : [searchInFolder];
        const query = queryBuilder.text({
          pattern: queryStr,
          isRegExp: isRegex
        }, searchFolders);
        const data = await searchService.textSearch(query, CancellationToken.None);
        const fromIdx = MAX_CHILDREN_URIs_PAGE * (pageNumber - 1);
        const toIdx = MAX_CHILDREN_URIs_PAGE * pageNumber - 1;
        const uris = data.results.slice(fromIdx, toIdx + 1).map(({ resource, results }) => resource);
        const hasNextPage = data.results.length - 1 - toIdx >= 1;
        return { result: { queryStr, uris, hasNextPage } };
      },
      search_in_file: async ({ uri, query, isRegex }) => {
        await voidModelService.initializeModel(uri);
        const { model } = await voidModelService.getModelSafe(uri);
        if (model === null) {
          throw new Error(`No contents; File does not exist.`);
        }
        const contents = model.getValue(EndOfLinePreference.LF);
        const contentOfLine = contents.split("\n");
        const totalLines = contentOfLine.length;
        const regex = isRegex ? new RegExp(query) : null;
        const lines = [];
        for (let i = 0; i < totalLines; i++) {
          const line = contentOfLine[i];
          if (isRegex && regex.test(line) || !isRegex && line.includes(query)) {
            const matchLine = i + 1;
            lines.push(matchLine);
          }
        }
        return { result: { lines } };
      },
      read_lint_errors: async ({ uri }) => {
        await timeout(1e3);
        const { lintErrors } = this._getLintErrors(uri);
        return { result: { lintErrors } };
      },
      // ---
      create_file_or_folder: async ({ uri, isFolder }) => {
        if (isFolder)
          await fileService.createFolder(uri);
        else {
          await fileService.createFile(uri);
        }
        return { result: {} };
      },
      delete_file_or_folder: async ({ uri, isRecursive }) => {
        await fileService.del(uri, { recursive: isRecursive });
        return { result: {} };
      },
      rewrite_file: async ({ uri, newContent }) => {
        if (this.commandBarService.getStreamState(uri) === "streaming") {
          throw new Error(`Another LLM is currently making changes to this file. Please stop streaming for now and ask the user to resume later.`);
        }
        // Always write directly to disk first — physically creates/updates the file
        await fileService.writeFile(uri, VSBuffer.fromString(newContent));
        // Sync in-memory model if one already exists (for editor diff/undo UI)
        await voidModelService.initializeModel(uri);
        const { model } = voidModelService.getModel(uri);
        if (model) {
          await editCodeService.callBeforeApplyOrEdit(uri);
          editCodeService.instantlyRewriteFile({ uri, newContent });
        }
        // Auto-open graphical PLC files in the editor after creation/write
        const uriPath = uri.path.toLowerCase();
        if (uriPath.endsWith(".ld.json") || uriPath.endsWith(".fbd.json") || uriPath.endsWith(".sfc.json")) {
          this.editorService.openEditor({ resource: uri }).catch(() => {});
        }
        const lintErrorsPromise = Promise.resolve().then(async () => {
          await timeout(2e3);
          const { lintErrors } = this._getLintErrors(uri);
          return { lintErrors };
        });
        return { result: lintErrorsPromise };
      },
      edit_file: async ({ uri, searchReplaceBlocks }) => {
        await voidModelService.initializeModel(uri);
        if (this.commandBarService.getStreamState(uri) === "streaming") {
          throw new Error(`Another LLM is currently making changes to this file. Please stop streaming for now and ask the user to resume later.`);
        }
        await editCodeService.callBeforeApplyOrEdit(uri);
        editCodeService.instantlyApplySearchReplaceBlocks({ uri, searchReplaceBlocks });
        const lintErrorsPromise = Promise.resolve().then(async () => {
          await timeout(2e3);
          const { lintErrors } = this._getLintErrors(uri);
          return { lintErrors };
        });
        return { result: lintErrorsPromise };
      },
      // ---
      run_command: async ({ command, cwd, terminalId }) => {
        const { resPromise, interrupt } = await this.terminalToolService.runCommand(command, { type: "temporary", cwd, terminalId });
        return { result: resPromise, interruptTool: interrupt };
      },
      run_persistent_command: async ({ command, persistentTerminalId }) => {
        const { resPromise, interrupt } = await this.terminalToolService.runCommand(command, { type: "persistent", persistentTerminalId });
        return { result: resPromise, interruptTool: interrupt };
      },
      open_persistent_terminal: async ({ cwd }) => {
        const persistentTerminalId = await this.terminalToolService.createPersistentTerminal({ cwd });
        return { result: { persistentTerminalId } };
      },
      kill_persistent_terminal: async ({ persistentTerminalId }) => {
        await this.terminalToolService.killPersistentTerminal(persistentTerminalId);
        return { result: {} };
      },
      // ---
      plc_get_program: async () => {
        const tToolStart = performance.now();
        const s = logicStore.getState();
        const snapshot = {
          ladderProgram: s.ladderProgram,
          fbdProgram: s.fbdProgram,
          sfcProgram: s.sfcProgram,
          tagDatabase: s.tagDatabase,
          activePouId: s.activePouId,
        };
        const json = JSON.stringify(snapshot);
        const MAX_TOOL_RESULT = 8000;
        let result;
        if (json.length > MAX_TOOL_RESULT) {
          const fbdEmpty = s.fbdProgram.nodes.length === 0;
          const sfcEmpty = s.sfcProgram.steps.length === 0;
          const hint = '';
          const summary = `Program summary: ${s.ladderProgram.rungs.length} LD rungs, ${s.fbdProgram.nodes.length} FBD nodes, ${s.sfcProgram.steps.length} SFC steps, ${s.tagDatabase.length} tags. Active POU: ${s.activePouId}.${hint} Full JSON (${json.length} chars, truncated):\n`;
          result = summary + json.substring(0, MAX_TOOL_RESULT - summary.length);
        } else {
          result = json;
        }
        console.log(`[Plaxio Perf] Tool plc_get_program: ${(performance.now() - tToolStart).toFixed(0)}ms, payload: ${json.length} chars, returned: ${result.length} chars`);
        return { result: { program: result } };
      },
      plc_validate: async () => {
        const tToolStart = performance.now();
        const s = logicStore.getState();
        const issues = [];
        for (const rung of s.ladderProgram.rungs) {
          const hasOutput = rung.elements.some(e => e.kind === "coil" || e.kind === "block");
          if (rung.elements.length > 0 && !hasOutput) {
            issues.push({ message: `Rung #${rung.number} "${rung.comment || rung.id}" has no output coil`, severity: "warn", location: `LD rung-${rung.number}` });
          }
        }
        const initSteps = s.sfcProgram.steps.filter(st => st.isInitial);
        if (s.sfcProgram.steps.length > 0 && initSteps.length === 0) {
          issues.push({ message: "SFC: No initial step defined (IEC \u00a76.5.4.2)", severity: "error", location: "SFC" });
        }
        if (initSteps.length > 1) {
          issues.push({ message: `SFC: Multiple initial steps: ${initSteps.map(st => st.name).join(", ")}`, severity: "error", location: "SFC" });
        }
        for (const t of s.sfcProgram.transitions) {
          if (!t.condition?.trim()) {
            issues.push({ message: `SFC transition ${t.id} has empty condition`, severity: "warn", location: `SFC transition-${t.id}` });
          }
        }
        for (const l of s.sfcProgram.links) {
          const fromIsStep = s.sfcProgram.steps.some(st => st.id === l.from);
          const toIsStep = s.sfcProgram.steps.some(st => st.id === l.to);
          if (fromIsStep && toIsStep) {
            issues.push({ message: `SFC: Direct step\u2192step link ${l.id} (transition required between)`, severity: "error", location: `SFC link-${l.id}` });
          }
        }
        const jumpTargets = new Set((s.sfcProgram.jumps ?? []).map(j => j.targetStepName));
        for (const step of s.sfcProgram.steps.filter(st => !st.isInitial)) {
          const hasIncoming = s.sfcProgram.links.some(l => l.to === step.id);
          if (!hasIncoming && !jumpTargets.has(step.name)) {
            issues.push({ message: `SFC: Step "${step.name}" is unreachable`, severity: "warn", location: `SFC step-${step.id}` });
          }
        }
        for (const node of s.fbdProgram.nodes) {
          if (node.type === "OUT_VARIABLE") {
            const tag = node.tag?.name ?? node.instanceName ?? node.id;
            const hasWire = s.fbdProgram.wires.some(w => w.to.nodeId === node.id);
            if (!hasWire) {
              issues.push({ message: `FBD: OUT_VARIABLE "${tag}" has no incoming wire`, severity: "warn", location: `FBD node-${node.id}` });
            }
          }
        }
        console.log(`[Plaxio Perf] Tool plc_validate: ${(performance.now() - tToolStart).toFixed(0)}ms`);
        return { result: { issues } };
      },
      plc_write_program: async ({ programJson }) => {
        const tToolStart = performance.now();
        let parsed = {};
        try { parsed = JSON.parse(programJson); } catch { throw new Error("programJson is not valid JSON"); }
        const pouName = (typeof parsed.pouName === "string" && parsed.pouName.trim()) ? parsed.pouName.trim() : "main";

        if (parsed.ladderProgram) logicStore.loadLadderProgram(parsed.ladderProgram);
        if (parsed.fbdProgram) logicStore.loadFBDProgram(parsed.fbdProgram);
        if (parsed.sfcProgram) logicStore.loadSFCProgram(parsed.sfcProgram);

        const s = logicStore.getState();
        const validationIssues = [];
        for (const rung of s.ladderProgram.rungs) {
          const hasOutput = rung.elements.some(e => e.kind === "coil" || e.kind === "block");
          if (rung.elements.length > 0 && !hasOutput)
            validationIssues.push({ message: `Rung #${rung.number} has no output coil`, severity: "warn", location: `LD rung-${rung.number}` });
        }
        const initSteps = s.sfcProgram.steps.filter(st => st.isInitial);
        if (s.sfcProgram.steps.length > 0 && initSteps.length === 0)
          validationIssues.push({ message: "SFC: No initial step defined", severity: "error", location: "SFC" });
        for (const t of s.sfcProgram.transitions) {
          if (!t.condition?.trim())
            validationIssues.push({ message: `SFC transition ${t.id} has empty condition`, severity: "warn", location: `SFC transition-${t.id}` });
        }
        for (const node of s.fbdProgram.nodes) {
          if (node.type === "OUT_VARIABLE" && !s.fbdProgram.wires.some(w => w.to.nodeId === node.id)) {
            const tag = node.tag?.name ?? node.instanceName ?? node.id;
            validationIssues.push({ message: `FBD: OUT_VARIABLE "${tag}" has no incoming wire`, severity: "warn", location: `FBD node-${node.id}` });
          }
        }

        // Persist graphical files to workspace (ST is only written via plc_export_st)
        const folders = workspaceContextService.getWorkspace().folders;
        if (folders.length > 0) {
          const base = folders[0].uri;
          const writeIfNonempty = async (subPath, obj) => {
            const content = obj ? JSON.stringify(obj) : "";
            if (!content || content === "{}" || content === "null") return;
            await fileService.writeFile(URI.joinPath(base, subPath), VSBuffer.fromString(content));
          };
          await Promise.all([
            writeIfNonempty(`${pouName}.ld.json`, s.ladderProgram),
            writeIfNonempty(`${pouName}.fbd.json`, s.fbdProgram),
            writeIfNonempty(`${pouName}.sfc.json`, s.sfcProgram),
          ]);
        }

        console.log(`[Plaxio Perf] Tool plc_write_program: ${(performance.now() - tToolStart).toFixed(0)}ms`);
        return { result: { ok: true, validationIssues, pouName } };
      },
      plc_set_tag_database: async ({ tagsJson }) => {
        const tToolStart = performance.now();
        const tags = JSON.parse(tagsJson);
        logicStore.setTagDatabase(tags);
        console.log(`[Plaxio Perf] Tool plc_set_tag_database: ${(performance.now() - tToolStart).toFixed(0)}ms`);
        return { result: { ok: true, tagCount: tags.length } };
      },
      plc_export_st: async () => {
        const tToolStart = performance.now();
        const s = logicStore.getState();
        const clm = buildCLMFromStore(s.ladderProgram, s.fbdProgram, s.sfcProgram, s.tagDatabase);
        const compiled = clmToST(clm);
        const pouName = s.pous?.find(p => p.id === s.activePouId)?.name || "main";
        const fileName = `${pouName}.st`;
        const folders = workspaceContextService.getWorkspace().folders;
        if (folders.length > 0 && compiled.stCode) {
          const uri = URI.joinPath(folders[0].uri, fileName);
          await fileService.writeFile(uri, VSBuffer.fromString(compiled.stCode));
        }
        console.log(`[Plaxio Perf] Tool plc_export_st: ${(performance.now() - tToolStart).toFixed(0)}ms`);
        return { result: { stCode: compiled.stCode, stCodeForStrucpp: compiled.stCodeForStrucpp, pouName, fileName } };
      },
      plc_export_vendor: async ({ format }) => {
        const tToolStart = performance.now();
        const formatMap = { PLCopen: "plcopen_xml", L5X: "rockwell_l5x", SimaticML: "siemens_simatic_ml" };
        const vendorFormat = formatMap[format] ?? "plcopen_xml";
        const result = await exportVendorFile({ format: vendorFormat });
        if (result.ok && result.xmlContent) {
          const ext = vendorFormat === "rockwell_l5x" ? "l5x" : "xml";
          console.log(`[Plaxio Perf] Tool plc_export_vendor: ${(performance.now() - tToolStart).toFixed(0)}ms`);
          return { result: { content: result.xmlContent, format, fileName: `program.${ext}` } };
        } else {
          throw new Error(result.errors?.join("; ") ?? "Export failed");
        }
      },
      plc_convert_language: async ({ from, to }) => {
        if (to === "ST") {
          const s = logicStore.getState();
          const clm = buildCLMFromStore(s.ladderProgram, s.fbdProgram, s.sfcProgram, s.tagDatabase);
          const compiled = clmToST(clm);
          const pouName = s.pous?.find(p => p.id === s.activePouId)?.name || "main";
          const folders = workspaceContextService.getWorkspace().folders;
          if (folders.length > 0 && compiled.stCode) {
            await fileService.writeFile(URI.joinPath(folders[0].uri, `${pouName}.st`), VSBuffer.fromString(compiled.stCode));
          }
          const guidance = `The ${from} program has been compiled to IEC 61131-3 Structured Text and saved as ${pouName}.st. Review the ST code above. You can edit it directly using rewrite_file if changes are needed. To deploy to a PLC runtime, use the .st file directly \u2014 it is valid MatIEC/OpenPLC ST.`;
          return { result: { sourceProgram: compiled.stCode, targetLanguage: "ST", guidance } };
        }
        const s = logicStore.getState();
        const snapshot = { ladderProgram: s.ladderProgram, fbdProgram: s.fbdProgram, sfcProgram: s.sfcProgram, tagDatabase: s.tagDatabase };
        const program = JSON.stringify(snapshot);
        const guidance = `Convert the ${from} program above to ${to} format using the Plaxio schema rules. Preserve all tag names exactly. Call plc_write_program with the converted ${to} program.`;
        return { result: { sourceProgram: program, targetLanguage: to, guidance } };
      },
      // ---
      import_vendor_file: async ({ uri, xmlContent: inlineContent, filename: inlineFilename }) => {
        const tToolStart = performance.now();
        let xmlContent;
        let filename;
        if (inlineContent) {
          xmlContent = inlineContent;
          filename = inlineFilename ?? "imported.xml";
        } else {
          const fileContent = await fileService.readFile(uri);
          xmlContent = fileContent.value.toString();
          filename = uri.path.split("/").pop() ?? "";
        }
        const result = await importVendorFile(xmlContent, filename, uri?.fsPath ?? filename);
        console.log(`[Plaxio Perf] Tool import_vendor_file: ${(performance.now() - tToolStart).toFixed(0)}ms`);
        if (result.ok) {
          const folders = workspaceContextService.getWorkspace().folders;
          if (folders.length > 0) {
            const s = logicStore.getState();
            const pouName = s.pous?.[0]?.name || result.projectName?.replace(/[^a-zA-Z0-9_]/g, '_') || 'main';
            const base = folders[0].uri;
            const writeIfNonempty = async (subPath, obj) => {
              const content = obj ? JSON.stringify(obj) : '';
              if (!content || content === '{}' || content === 'null' || content === '{"rungs":[]}') return;
              await fileService.writeFile(URI.joinPath(base, subPath), VSBuffer.fromString(content));
            };
            await Promise.all([
              writeIfNonempty(`${pouName}.ld.json`, s.ladderProgram),
              writeIfNonempty(`${pouName}.fbd.json`, s.fbdProgram),
              writeIfNonempty(`${pouName}.sfc.json`, s.sfcProgram),
            ]);
            try {
              const clm = buildCLMFromStore(s.ladderProgram, s.fbdProgram, s.sfcProgram, s.tagDatabase);
              const compiled = clmToST(clm);
              if (compiled.stCode) {
                await fileService.writeFile(URI.joinPath(base, `${pouName}.st`), VSBuffer.fromString(compiled.stCode));
              }
            } catch {}
          }
          return { result: { projectName: result.projectName ?? filename, pouCount: result.pouCount ?? 0, tagCount: result.tagCount ?? 0, unmappedCount: result.unmappedCount ?? 0, warnings: result.warnings ?? [], filesSaved: true } };
        } else {
          throw new Error(result.errors?.join("; ") ?? "Import failed");
        }
      },
      plaxio_generate_view: async ({ pouName }) => {
        const viewName = pouName || "main";
        const viewId = "view-" + viewName.replace(/[^a-zA-Z0-9_]/g, "");
        // Get current project
        const projRes = await fetch("http://127.0.0.1:1881/api/project");
        if (!projRes.ok) throw new Error(`GET /api/project → ${projRes.status}`);
        const project = await projRes.json();
        if (!project.hmi) project.hmi = {};
        if (!project.hmi.views) project.hmi.views = [];
        if (!project.hmi.layout) project.hmi.layout = {};
        project.hmi.layout.navigation = { mode: "void", items: [], logo: false, title: "" };
        // Check if view already exists
        const existing = project.hmi.views.find(v => v.name === viewName);
        if (existing) {
          return { result: { ok: true, viewName, message: "View already exists" } };
        }
        // Create a new empty view
        const newView = {
          id: viewId,
          name: viewName,
          profile: { width: 1024, height: 768, bkcolor: "#ffffff" },
          items: [],
          svgcontent: `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="768"><rect width="100%" height="100%" fill="#ffffff"/><text x="512" y="384" text-anchor="middle" font-size="24" fill="#333">${viewName}</text></svg>`
        };
        project.hmi.views.push(newView);
        // Save project
        const saveRes = await fetch("http://127.0.0.1:1881/api/project", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(project)
        });
        if (!saveRes.ok) throw new Error(`POST /api/project → ${saveRes.status}`);
        return { result: { ok: true, viewName } };
      },
      plaxio_get_project: async () => {
        const res = await fetch("http://127.0.0.1:1881/api/project");
        if (!res.ok) throw new Error(`Plaxio Simulator GET /api/project \u2192 ${res.status}`);
        const project = await res.json();
        return { result: { project: JSON.stringify(project) } };
      },
      plaxio_save_view: async ({ viewJson }) => {
        const incoming = JSON.parse(viewJson);
        const isFullProject = (incoming.hmi !== void 0 || incoming.devices !== void 0) && incoming.svgcontent === void 0;
        const view = isFullProject
          ? (Array.isArray(incoming.hmi?.views) && incoming.hmi.views.length > 0 ? incoming.hmi.views[0] : incoming.hmi ?? incoming)
          : incoming;
        if (!view.id) view.id = "view_" + Math.random().toString(36).slice(2, 10);
        if (!view.name) throw new Error("view.name is required");
        // Always white background
        if (!view.profile) view.profile = {};
        view.profile.bkcolor = "#ffffff";
        // Normalize items — strip nulls, add property:{} — FUXA crashes on null items
        const normalizeItems = (v) => {
          if (Array.isArray(v.items)) {
            v.items = v.items.filter(item => item !== null && item !== undefined);
            for (const item of v.items) {
              if (typeof item === "object" && !item.property) item.property = {};
            }
          } else if (v.items && typeof v.items === "object") {
            for (const k of Object.keys(v.items)) {
              if (!v.items[k]) { delete v.items[k]; continue; }
              if (!v.items[k].property) v.items[k].property = {};
            }
          }
        };
        normalizeItems(view);
        if (isFullProject && Array.isArray(incoming.hmi?.views)) {
          for (const v of incoming.hmi.views) normalizeItems(v);
        }
        const getRes = await fetch("http://127.0.0.1:1881/api/project");
        if (!getRes.ok) throw new Error(`Plaxio Simulator GET /api/project \u2192 ${getRes.status}`);
        const project = await getRes.json();
        if (isFullProject && incoming.devices && typeof incoming.devices === "object") {
          project.devices = { ...(project.devices ?? {}), ...incoming.devices };
        }
        const hmi = project.hmi ?? project;
        if (!hmi.views) hmi.views = [];
        const existingIdx = hmi.views.findIndex((v) => v.id === view.id || v.name === view.name);
        if (existingIdx >= 0) {
          hmi.views[existingIdx] = view;
        } else {
          hmi.views.push(view);
        }
        if (hmi.layout) hmi.layout.start = view.id;
        const postRes = await fetch("http://127.0.0.1:1881/api/project", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(project)
        });
        if (!postRes.ok) throw new Error(`Plaxio Simulator POST /api/project \u2192 ${postRes.status}`);
        return { result: { viewId: view.id, viewName: view.name } };
      },
      plaxio_set_tag_value: async ({ tags }) => {
        const projRes = await fetch("http://127.0.0.1:1881/api/project");
        if (!projRes.ok) throw new Error(`Plaxio Simulator GET /api/project \u2192 ${projRes.status}`);
        const project = await projRes.json();
        if (!project.devices) project.devices = {};
        if (!project.devices["0"]) project.devices["0"] = { id: "0", name: "FuxaServer", type: "FuxaServer", enabled: true, property: { address: "" }, tags: {} };
        const fuxaDevice = project.devices["0"];
        if (!fuxaDevice.tags) fuxaDevice.tags = {};
        const nameToId = {};
        for (const device of Object.values(project.devices)) {
          for (const [id, tag] of Object.entries(device.tags ?? {})) {
            if (tag.name) { nameToId[tag.name] = id; nameToId[id] = id; }
          }
        }
        let registeredNew = false;
        for (const { tagName } of tags) {
          const tagId = "FuxaServer^~^" + tagName;
          if (!nameToId[tagName] && !nameToId[tagId]) {
            fuxaDevice.tags[tagId] = { id: tagId, name: tagName, type: "number", init: 0, format: "" };
            nameToId[tagName] = tagId; nameToId[tagId] = tagId; registeredNew = true;
          }
        }
        if (registeredNew) {
          // Save new tags to DB via set-device \u2014 this also reloads the device runtime via devices.updateDevice()
          const setDevRes = await fetch("http://127.0.0.1:1881/api/projectData", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ cmd: "set-device", data: fuxaDevice }),
          });
          if (!setDevRes.ok) throw new Error(`Plaxio Simulator POST /api/projectData set-device \u2192 ${setDevRes.status}`);
          // Brief wait for devices.updateDevice() async stop/start cycle to complete
          await new Promise(r => setTimeout(r, 300));
        }
        const payload = [];
        for (const { tagName, value } of tags) {
          const id = nameToId[tagName] ?? nameToId["FuxaServer^~^" + tagName] ?? "FuxaServer^~^" + tagName;
          payload.push({ id, value });
        }
        const setRes = await fetch("http://127.0.0.1:1881/api/setTagValue", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ tags: payload })
        });
        if (!setRes.ok) throw new Error(`Plaxio Simulator POST /api/setTagValue \u2192 ${setRes.status}`);
        return { result: { set: payload.length } };
      },
      plc_add_verify_property: async ({ propertiesJson }) => {
        const properties = JSON.parse(propertiesJson);
        const added = [];
        for (const prop of properties) {
          const id = `prop_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
          const fullProp = { ...prop, id };
          window.postMessage({ type: "plaxio:verify-add-property", property: fullProp }, "*");
          added.push(`${prop.kind}: "${prop.label}"`);
        }
        return { result: { added, count: added.length } };
      }
    };
    const nextPageStr = (hasNextPage) => hasNextPage ? "\n\n(more on next page...)" : "";
    const stringifyLintErrors = (lintErrors) => {
      return lintErrors.map((e, i) => `Error ${i + 1}:
Lines Affected: ${e.startLineNumber}-${e.endLineNumber}
Error message:${e.message}`).join("\n\n").substring(0, MAX_FILE_CHARS_PAGE);
    };
    this.stringOfResult = {
      read_file: (params, result) => {
        return `${params.uri.fsPath}
\`\`\`
${result.fileContents}
\`\`\`${nextPageStr(result.hasNextPage)}${result.hasNextPage ? `
More info because truncated: this file has ${result.totalNumLines} lines, or ${result.totalFileLen} characters.` : ""}`;
      },
      ls_dir: (params, result) => {
        const dirTreeStr = stringifyDirectoryTree1Deep(params, result);
        return dirTreeStr;
      },
      get_dir_tree: (params, result) => {
        return result.str;
      },
      search_pathnames_only: (params, result) => {
        return result.uris.map((uri) => uri.fsPath).join("\n") + nextPageStr(result.hasNextPage);
      },
      search_for_files: (params, result) => {
        return result.uris.map((uri) => uri.fsPath).join("\n") + nextPageStr(result.hasNextPage);
      },
      search_in_file: (params, result) => {
        const { model } = voidModelService.getModel(params.uri);
        if (!model) return "<Error getting string of result>";
        const lines = result.lines.map((n) => {
          const lineContent = model.getValueInRange({ startLineNumber: n, startColumn: 1, endLineNumber: n, endColumn: Number.MAX_SAFE_INTEGER }, EndOfLinePreference.LF);
          return `Line ${n}:
\`\`\`
${lineContent}
\`\`\``;
        }).join("\n\n");
        return lines;
      },
      read_lint_errors: (params, result) => {
        return result.lintErrors ? stringifyLintErrors(result.lintErrors) : "No lint errors found.";
      },
      // ---
      create_file_or_folder: (params, result) => {
        return `URI ${params.uri.fsPath} successfully created.`;
      },
      delete_file_or_folder: (params, result) => {
        return `URI ${params.uri.fsPath} successfully deleted.`;
      },
      edit_file: (params, result) => {
        const lintErrsString = this.voidSettingsService.state.globalSettings.includeToolLintErrors ? result.lintErrors ? ` Lint errors found after change:
${stringifyLintErrors(result.lintErrors)}.
If this is related to a change made while calling this tool, you might want to fix the error.` : ` No lint errors found.` : "";
        return `Change successfully made to ${params.uri.fsPath}.${lintErrsString}`;
      },
      rewrite_file: (params, result) => {
        const lintErrsString = this.voidSettingsService.state.globalSettings.includeToolLintErrors ? result.lintErrors ? ` Lint errors found after change:
${stringifyLintErrors(result.lintErrors)}.
If this is related to a change made while calling this tool, you might want to fix the error.` : ` No lint errors found.` : "";
        return `Change successfully made to ${params.uri.fsPath}.${lintErrsString}`;
      },
      run_command: (params, result) => {
        const { resolveReason, result: result_ } = result;
        if (resolveReason.type === "done") {
          return `${result_}
(exit code ${resolveReason.exitCode})`;
        }
        if (resolveReason.type === "timeout") {
          return `${result_}
Terminal command ran, but was automatically killed by Void after ${MAX_TERMINAL_INACTIVE_TIME}s of inactivity and did not finish successfully. To try with more time, open a persistent terminal and run the command there.`;
        }
        throw new Error(`Unexpected internal error: Terminal command did not resolve with a valid reason.`);
      },
      run_persistent_command: (params, result) => {
        const { resolveReason, result: result_ } = result;
        const { persistentTerminalId } = params;
        if (resolveReason.type === "done") {
          return `${result_}
(exit code ${resolveReason.exitCode})`;
        }
        if (resolveReason.type === "timeout") {
          return `${result_}
Terminal command is running in terminal ${persistentTerminalId}. The given outputs are the results after ${MAX_TERMINAL_BG_COMMAND_TIME} seconds.`;
        }
        throw new Error(`Unexpected internal error: Terminal command did not resolve with a valid reason.`);
      },
      open_persistent_terminal: (_params, result) => {
        const { persistentTerminalId } = result;
        return `Successfully created persistent terminal. persistentTerminalId="${persistentTerminalId}"`;
      },
      kill_persistent_terminal: (params, _result) => {
        return `Successfully closed terminal "${params.persistentTerminalId}".`;
      },
      import_vendor_file: (params, result) => {
        const { projectName, pouCount, tagCount, unmappedCount, warnings } = result;
        const source = params.uri?.fsPath ?? params.filename ?? 'inline content';
        let msg = `Successfully imported "${projectName}" from ${source}. ${pouCount} POU(s), ${tagCount} tag(s) loaded into the PLC editor.`;
        if (unmappedCount > 0) msg += ` ${unmappedCount} element(s) could not be mapped and were preserved in sidecar metadata.`;
        if (warnings.length > 0) msg += `
Warnings:
${warnings.map((w) => `- ${w}`).join("\n")}`;
        return msg;
      },
      plc_get_program: (_params, result) => {
        return `Current PLC program state:
${result.program}`;
      },
      plc_validate: (_params, result) => {
        if (result.issues.length === 0) return `Validation passed \u2014 no issues found.`;
        const lines = result.issues.map((iss, i) => `${i + 1}. [${iss.severity.toUpperCase()}] ${iss.location}: ${iss.message}`);
        return `Validation found ${result.issues.length} issue(s):
${lines.join("\n")}`;
      },
      plc_write_program: (_params, result) => {
        if (!result.ok) return `plc_write_program failed.`;
        const fileMsg = `Files saved: ${result.pouName}.ld.json, ${result.pouName}.fbd.json, ${result.pouName}.sfc.json`;
        if (result.validationIssues.length === 0) return `Program written and loaded into editor. ${fileMsg}. Validation: no issues.`;
        const lines = result.validationIssues.map((iss, i) => `${i + 1}. [${iss.severity.toUpperCase()}] ${iss.location}: ${iss.message}`);
        return `Program written and loaded into editor. ${fileMsg}.
Validation found ${result.validationIssues.length} issue(s):
${lines.join("\n")}`;
      },
      plc_set_tag_database: (_params, result) => {
        return result.ok ? `Tag database updated \u2014 ${result.tagCount} tag(s) now active.` : `plc_set_tag_database failed.`;
      },
      plc_export_st: (_params, result) => {
        return `ST export complete. File saved as "${result.fileName}" in workspace.

Structured Text code:
${result.stCode}`;
      },
      plc_export_vendor: (_params, result) => {
        return `Exported as ${result.format}. Suggested filename: ${result.fileName}

Content:
${result.content}`;
      },
      plc_convert_language: (_params, result) => {
        return `Source program (${result.targetLanguage} conversion requested):
${result.sourceProgram}

Guidance: ${result.guidance}`;
      },
      plaxio_get_project: (_params, result) => {
        return `Plaxio Simulator project loaded. Full project JSON:
${result.project}`;
      },
      plaxio_generate_view: (_params, result) => {
        return result.ok ? `Plaxio Simulator HMI view "${result.viewName}" auto-generated from current tag database. Open the Simulator tab to preview it.` : `Plaxio Simulator view generation failed.`;
      },
      plaxio_save_view: (_params, result) => {
        return `View "${result.viewName}" (id: ${result.viewId}) saved to Plaxio Simulator. Open the Simulator tab to see the result.`;
      },
      plaxio_set_tag_value: (_params, result) => {
        const count = result?.set ?? result?.result?.set ?? 0;
        return `Set ${count} tags in Plaxio Simulator.`;
      },
      plc_add_verify_property: (_params, result) => {
        return `Added ${result.count} verification propert${result.count === 1 ? 'y' : 'ies'}: ${result.added.join('; ')}. Open the Verify tab in the bottom panel to run formal verification.`;
      }
    };
  }
  _getLintErrors(uri) {
    const lintErrors = this.markerService.read({ resource: uri }).filter((l) => l.severity === MarkerSeverity.Error || l.severity === MarkerSeverity.Warning).slice(0, 100).map((l) => ({
      code: typeof l.code === "string" ? l.code : l.code?.value || "",
      message: (l.severity === MarkerSeverity.Error ? "(error) " : "(warning) ") + l.message,
      startLineNumber: l.startLineNumber,
      endLineNumber: l.endLineNumber
    }));
    if (!lintErrors.length) return { lintErrors: null };
    return { lintErrors };
  }
};
ToolsService = __decorateClass([
  __decorateParam(0, IFileService),
  __decorateParam(1, IWorkspaceContextService),
  __decorateParam(2, ISearchService),
  __decorateParam(3, IInstantiationService),
  __decorateParam(4, IVoidModelService),
  __decorateParam(5, IEditCodeService),
  __decorateParam(6, ITerminalToolService),
  __decorateParam(7, IVoidCommandBarService),
  __decorateParam(8, IDirectoryStrService),
  __decorateParam(9, IMarkerService),
  __decorateParam(10, IVoidSettingsService),
  __decorateParam(11, IEditorService)
], ToolsService);
registerSingleton(IToolsService, ToolsService, InstantiationType.Eager);
export {
  IToolsService,
  ToolsService
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvY29udHJpYi92b2lkL2Jyb3dzZXIvdG9vbHNTZXJ2aWNlLnRzIl0sCiAgInNvdXJjZXNDb250ZW50IjogWyJpbXBvcnQgeyBDYW5jZWxsYXRpb25Ub2tlbiB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2NhbmNlbGxhdGlvbi5qcydcbmltcG9ydCB7IFVSSSB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL3VyaS5qcydcbmltcG9ydCB7IElGaWxlU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL2ZpbGVzL2NvbW1vbi9maWxlcy5qcydcbmltcG9ydCB7IHJlZ2lzdGVyU2luZ2xldG9uLCBJbnN0YW50aWF0aW9uVHlwZSB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL2luc3RhbnRpYXRpb24vY29tbW9uL2V4dGVuc2lvbnMuanMnXG5pbXBvcnQgeyBjcmVhdGVEZWNvcmF0b3IsIElJbnN0YW50aWF0aW9uU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL2luc3RhbnRpYXRpb24vY29tbW9uL2luc3RhbnRpYXRpb24uanMnXG5pbXBvcnQgeyBJV29ya3NwYWNlQ29udGV4dFNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS93b3Jrc3BhY2UvY29tbW9uL3dvcmtzcGFjZS5qcydcbmltcG9ydCB7IFF1ZXJ5QnVpbGRlciB9IGZyb20gJy4uLy4uLy4uL3NlcnZpY2VzL3NlYXJjaC9jb21tb24vcXVlcnlCdWlsZGVyLmpzJ1xuaW1wb3J0IHsgSVNlYXJjaFNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi9zZXJ2aWNlcy9zZWFyY2gvY29tbW9uL3NlYXJjaC5qcydcbmltcG9ydCB7IElFZGl0Q29kZVNlcnZpY2UgfSBmcm9tICcuL2VkaXRDb2RlU2VydmljZUludGVyZmFjZS5qcydcbmltcG9ydCB7IElUZXJtaW5hbFRvb2xTZXJ2aWNlIH0gZnJvbSAnLi90ZXJtaW5hbFRvb2xTZXJ2aWNlLmpzJ1xuaW1wb3J0IHsgTGludEVycm9ySXRlbSwgQnVpbHRpblRvb2xDYWxsUGFyYW1zLCBCdWlsdGluVG9vbFJlc3VsdFR5cGUsIEJ1aWx0aW5Ub29sTmFtZSB9IGZyb20gJy4uL2NvbW1vbi90b29sc1NlcnZpY2VUeXBlcy5qcydcbmltcG9ydCB7IElWb2lkTW9kZWxTZXJ2aWNlIH0gZnJvbSAnLi4vY29tbW9uL3ZvaWRNb2RlbFNlcnZpY2UuanMnXG5pbXBvcnQgeyBFbmRPZkxpbmVQcmVmZXJlbmNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vZWRpdG9yL2NvbW1vbi9tb2RlbC5qcydcbmltcG9ydCB7IElWb2lkQ29tbWFuZEJhclNlcnZpY2UgfSBmcm9tICcuL3ZvaWRDb21tYW5kQmFyU2VydmljZS5qcydcbmltcG9ydCB7IGNvbXB1dGVEaXJlY3RvcnlUcmVlMURlZXAsIElEaXJlY3RvcnlTdHJTZXJ2aWNlLCBzdHJpbmdpZnlEaXJlY3RvcnlUcmVlMURlZXAgfSBmcm9tICcuLi9jb21tb24vZGlyZWN0b3J5U3RyU2VydmljZS5qcydcbmltcG9ydCB7IElNYXJrZXJTZXJ2aWNlLCBNYXJrZXJTZXZlcml0eSB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL21hcmtlcnMvY29tbW9uL21hcmtlcnMuanMnXG5pbXBvcnQgeyB0aW1lb3V0IH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vYXN5bmMuanMnXG5pbXBvcnQgeyBSYXdUb29sUGFyYW1zT2JqIH0gZnJvbSAnLi4vY29tbW9uL3NlbmRMTE1NZXNzYWdlVHlwZXMuanMnXG5pbXBvcnQgeyBNQVhfQ0hJTERSRU5fVVJJc19QQUdFLCBNQVhfRklMRV9DSEFSU19QQUdFLCBNQVhfVEVSTUlOQUxfQkdfQ09NTUFORF9USU1FLCBNQVhfVEVSTUlOQUxfSU5BQ1RJVkVfVElNRSB9IGZyb20gJy4uL2NvbW1vbi9wcm9tcHQvcHJvbXB0cy5qcydcbmltcG9ydCB7IElWb2lkU2V0dGluZ3NTZXJ2aWNlIH0gZnJvbSAnLi4vY29tbW9uL3ZvaWRTZXR0aW5nc1NlcnZpY2UuanMnXG5pbXBvcnQgeyBnZW5lcmF0ZVV1aWQgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi91dWlkLmpzJ1xuXG5cbi8vIHRvb2wgdXNlIGZvciBBSVxudHlwZSBWYWxpZGF0ZUJ1aWx0aW5QYXJhbXMgPSB7IFtUIGluIEJ1aWx0aW5Ub29sTmFtZV06IChwOiBSYXdUb29sUGFyYW1zT2JqKSA9PiBCdWlsdGluVG9vbENhbGxQYXJhbXNbVF0gfVxudHlwZSBDYWxsQnVpbHRpblRvb2wgPSB7IFtUIGluIEJ1aWx0aW5Ub29sTmFtZV06IChwOiBCdWlsdGluVG9vbENhbGxQYXJhbXNbVF0pID0+IFByb21pc2U8eyByZXN1bHQ6IEJ1aWx0aW5Ub29sUmVzdWx0VHlwZVtUXSB8IFByb21pc2U8QnVpbHRpblRvb2xSZXN1bHRUeXBlW1RdPiwgaW50ZXJydXB0VG9vbD86ICgpID0+IHZvaWQgfT4gfVxudHlwZSBCdWlsdGluVG9vbFJlc3VsdFRvU3RyaW5nID0geyBbVCBpbiBCdWlsdGluVG9vbE5hbWVdOiAocDogQnVpbHRpblRvb2xDYWxsUGFyYW1zW1RdLCByZXN1bHQ6IEF3YWl0ZWQ8QnVpbHRpblRvb2xSZXN1bHRUeXBlW1RdPikgPT4gc3RyaW5nIH1cblxuXG5jb25zdCBpc0ZhbHN5ID0gKHU6IHVua25vd24pID0+IHtcblx0cmV0dXJuICF1IHx8IHUgPT09ICdudWxsJyB8fCB1ID09PSAndW5kZWZpbmVkJ1xufVxuXG5jb25zdCB2YWxpZGF0ZVN0ciA9IChhcmdOYW1lOiBzdHJpbmcsIHZhbHVlOiB1bmtub3duKSA9PiB7XG5cdGlmICh2YWx1ZSA9PT0gbnVsbCkgdGhyb3cgbmV3IEVycm9yKGBJbnZhbGlkIExMTSBvdXRwdXQ6ICR7YXJnTmFtZX0gd2FzIG51bGwuYClcblx0aWYgKHR5cGVvZiB2YWx1ZSAhPT0gJ3N0cmluZycpIHRocm93IG5ldyBFcnJvcihgSW52YWxpZCBMTE0gb3V0cHV0IGZvcm1hdDogJHthcmdOYW1lfSBtdXN0IGJlIGEgc3RyaW5nLCBidXQgaXRzIHR5cGUgaXMgXCIke3R5cGVvZiB2YWx1ZX1cIi4gRnVsbCB2YWx1ZTogJHtKU09OLnN0cmluZ2lmeSh2YWx1ZSl9LmApXG5cdHJldHVybiB2YWx1ZVxufVxuXG5cbi8vIFdlIGFyZSBOT1QgY2hlY2tpbmcgdG8gbWFrZSBzdXJlIGluIHdvcmtzcGFjZVxuY29uc3QgdmFsaWRhdGVVUkkgPSAodXJpU3RyOiB1bmtub3duKSA9PiB7XG5cdGlmICh1cmlTdHIgPT09IG51bGwpIHRocm93IG5ldyBFcnJvcihgSW52YWxpZCBMTE0gb3V0cHV0OiB1cmkgd2FzIG51bGwuYClcblx0aWYgKHR5cGVvZiB1cmlTdHIgIT09ICdzdHJpbmcnKSB0aHJvdyBuZXcgRXJyb3IoYEludmFsaWQgTExNIG91dHB1dCBmb3JtYXQ6IFByb3ZpZGVkIHVyaSBtdXN0IGJlIGEgc3RyaW5nLCBidXQgaXQncyBhKG4pICR7dHlwZW9mIHVyaVN0cn0uIEZ1bGwgdmFsdWU6ICR7SlNPTi5zdHJpbmdpZnkodXJpU3RyKX0uYClcblxuXHQvLyBDaGVjayBpZiBpdCdzIGFscmVhZHkgYSBmdWxsIFVSSSB3aXRoIHNjaGVtZSAoZS5nLiwgdnNjb2RlLXJlbW90ZTovLywgZmlsZTovLywgZXRjLilcblx0Ly8gTG9vayBmb3IgOi8vIHBhdHRlcm4gd2hpY2ggaW5kaWNhdGVzIGEgc2NoZW1lIGlzIHByZXNlbnRcblx0Ly8gRXhhbXBsZXMgb2Ygc3VwcG9ydGVkIFVSSXM6XG5cdC8vIC0gdnNjb2RlLXJlbW90ZTovL3dzbCtVYnVudHUvaG9tZS91c2VyL2ZpbGUudHh0IChXU0wpXG5cdC8vIC0gdnNjb2RlLXJlbW90ZTovL3NzaC1yZW1vdGUrbXlzZXJ2ZXIvaG9tZS91c2VyL2ZpbGUudHh0IChTU0gpXG5cdC8vIC0gZmlsZTovLy9ob21lL3VzZXIvZmlsZS50eHQgKGxvY2FsIGZpbGUgd2l0aCBzY2hlbWUpXG5cdC8vIC0gL2hvbWUvdXNlci9maWxlLnR4dCAobG9jYWwgZmlsZSBwYXRoLCB3aWxsIGJlIGNvbnZlcnRlZCB0byBmaWxlOi8vKVxuXHQvLyAtIEM6XFxVc2Vyc1xcZmlsZS50eHQgKFdpbmRvd3MgbG9jYWwgcGF0aCwgd2lsbCBiZSBjb252ZXJ0ZWQgdG8gZmlsZTovLylcblx0aWYgKHVyaVN0ci5pbmNsdWRlcygnOi8vJykpIHtcblx0XHR0cnkge1xuXHRcdFx0Y29uc3QgdXJpID0gVVJJLnBhcnNlKHVyaVN0cilcblx0XHRcdHJldHVybiB1cmlcblx0XHR9IGNhdGNoIChlKSB7XG5cdFx0XHQvLyBJZiBwYXJzaW5nIGZhaWxzLCBpdCdzIGEgbWFsZm9ybWVkIFVSSVxuXHRcdFx0dGhyb3cgbmV3IEVycm9yKGBJbnZhbGlkIFVSSSBmb3JtYXQ6ICR7dXJpU3RyfS4gRXJyb3I6ICR7ZX1gKVxuXHRcdH1cblx0fSBlbHNlIHtcblx0XHQvLyBObyBzY2hlbWUgcHJlc2VudCwgdHJlYXQgYXMgZmlsZSBwYXRoXG5cdFx0Ly8gVGhpcyBoYW5kbGVzIHJlZ3VsYXIgZmlsZSBwYXRocyBsaWtlIC9ob21lL3VzZXIvZmlsZS50eHQgb3IgQzpcXFVzZXJzXFxmaWxlLnR4dFxuXHRcdGNvbnN0IHVyaSA9IFVSSS5maWxlKHVyaVN0cilcblx0XHRyZXR1cm4gdXJpXG5cdH1cbn1cblxuY29uc3QgdmFsaWRhdGVPcHRpb25hbFVSSSA9ICh1cmlTdHI6IHVua25vd24pID0+IHtcblx0aWYgKGlzRmFsc3kodXJpU3RyKSkgcmV0dXJuIG51bGxcblx0cmV0dXJuIHZhbGlkYXRlVVJJKHVyaVN0cilcbn1cblxuY29uc3QgdmFsaWRhdGVPcHRpb25hbFN0ciA9IChhcmdOYW1lOiBzdHJpbmcsIHN0cjogdW5rbm93bikgPT4ge1xuXHRpZiAoaXNGYWxzeShzdHIpKSByZXR1cm4gbnVsbFxuXHRyZXR1cm4gdmFsaWRhdGVTdHIoYXJnTmFtZSwgc3RyKVxufVxuXG5cbmNvbnN0IHZhbGlkYXRlUGFnZU51bSA9IChwYWdlTnVtYmVyVW5rbm93bjogdW5rbm93bikgPT4ge1xuXHRpZiAoIXBhZ2VOdW1iZXJVbmtub3duKSByZXR1cm4gMVxuXHRjb25zdCBwYXJzZWRJbnQgPSBOdW1iZXIucGFyc2VJbnQocGFnZU51bWJlclVua25vd24gKyAnJylcblx0aWYgKCFOdW1iZXIuaXNJbnRlZ2VyKHBhcnNlZEludCkpIHRocm93IG5ldyBFcnJvcihgUGFnZSBudW1iZXIgd2FzIG5vdCBhbiBpbnRlZ2VyOiBcIiR7cGFnZU51bWJlclVua25vd259XCIuYClcblx0aWYgKHBhcnNlZEludCA8IDEpIHRocm93IG5ldyBFcnJvcihgSW52YWxpZCBMTE0gb3V0cHV0IGZvcm1hdDogU3BlY2lmaWVkIHBhZ2UgbnVtYmVyIG11c3QgYmUgMSBvciBncmVhdGVyOiBcIiR7cGFnZU51bWJlclVua25vd259XCIuYClcblx0cmV0dXJuIHBhcnNlZEludFxufVxuXG5jb25zdCB2YWxpZGF0ZU51bWJlciA9IChudW1TdHI6IHVua25vd24sIG9wdHM6IHsgZGVmYXVsdDogbnVtYmVyIHwgbnVsbCB9KSA9PiB7XG5cdGlmICh0eXBlb2YgbnVtU3RyID09PSAnbnVtYmVyJylcblx0XHRyZXR1cm4gbnVtU3RyXG5cdGlmIChpc0ZhbHN5KG51bVN0cikpIHJldHVybiBvcHRzLmRlZmF1bHRcblxuXHRpZiAodHlwZW9mIG51bVN0ciA9PT0gJ3N0cmluZycpIHtcblx0XHRjb25zdCBwYXJzZWRJbnQgPSBOdW1iZXIucGFyc2VJbnQobnVtU3RyICsgJycpXG5cdFx0aWYgKCFOdW1iZXIuaXNJbnRlZ2VyKHBhcnNlZEludCkpIHJldHVybiBvcHRzLmRlZmF1bHRcblx0XHRyZXR1cm4gcGFyc2VkSW50XG5cdH1cblxuXHRyZXR1cm4gb3B0cy5kZWZhdWx0XG59XG5cbmNvbnN0IHZhbGlkYXRlUHJvcG9zZWRUZXJtaW5hbElkID0gKHRlcm1pbmFsSWRVbmtub3duOiB1bmtub3duKSA9PiB7XG5cdGlmICghdGVybWluYWxJZFVua25vd24pIHRocm93IG5ldyBFcnJvcihgQSB2YWx1ZSBmb3IgdGVybWluYWxJRCBtdXN0IGJlIHNwZWNpZmllZCwgYnV0IHRoZSB2YWx1ZSB3YXMgXCIke3Rlcm1pbmFsSWRVbmtub3dufVwiYClcblx0Y29uc3QgdGVybWluYWxJZCA9IHRlcm1pbmFsSWRVbmtub3duICsgJydcblx0cmV0dXJuIHRlcm1pbmFsSWRcbn1cblxuY29uc3QgdmFsaWRhdGVCb29sZWFuID0gKGI6IHVua25vd24sIG9wdHM6IHsgZGVmYXVsdDogYm9vbGVhbiB9KSA9PiB7XG5cdGlmICh0eXBlb2YgYiA9PT0gJ3N0cmluZycpIHtcblx0XHRpZiAoYiA9PT0gJ3RydWUnKSByZXR1cm4gdHJ1ZVxuXHRcdGlmIChiID09PSAnZmFsc2UnKSByZXR1cm4gZmFsc2Vcblx0fVxuXHRpZiAodHlwZW9mIGIgPT09ICdib29sZWFuJykge1xuXHRcdHJldHVybiBiXG5cdH1cblx0cmV0dXJuIG9wdHMuZGVmYXVsdFxufVxuXG5cbmNvbnN0IGNoZWNrSWZJc0ZvbGRlciA9ICh1cmlTdHI6IHN0cmluZykgPT4ge1xuXHR1cmlTdHIgPSB1cmlTdHIudHJpbSgpXG5cdGlmICh1cmlTdHIuZW5kc1dpdGgoJy8nKSB8fCB1cmlTdHIuZW5kc1dpdGgoJ1xcXFwnKSkgcmV0dXJuIHRydWVcblx0cmV0dXJuIGZhbHNlXG59XG5cbmV4cG9ydCBpbnRlcmZhY2UgSVRvb2xzU2VydmljZSB7XG5cdHJlYWRvbmx5IF9zZXJ2aWNlQnJhbmQ6IHVuZGVmaW5lZDtcblx0dmFsaWRhdGVQYXJhbXM6IFZhbGlkYXRlQnVpbHRpblBhcmFtcztcblx0Y2FsbFRvb2w6IENhbGxCdWlsdGluVG9vbDtcblx0c3RyaW5nT2ZSZXN1bHQ6IEJ1aWx0aW5Ub29sUmVzdWx0VG9TdHJpbmc7XG59XG5cbmV4cG9ydCBjb25zdCBJVG9vbHNTZXJ2aWNlID0gY3JlYXRlRGVjb3JhdG9yPElUb29sc1NlcnZpY2U+KCdUb29sc1NlcnZpY2UnKTtcblxuZXhwb3J0IGNsYXNzIFRvb2xzU2VydmljZSBpbXBsZW1lbnRzIElUb29sc1NlcnZpY2Uge1xuXG5cdHJlYWRvbmx5IF9zZXJ2aWNlQnJhbmQ6IHVuZGVmaW5lZDtcblxuXHRwdWJsaWMgdmFsaWRhdGVQYXJhbXM6IFZhbGlkYXRlQnVpbHRpblBhcmFtcztcblx0cHVibGljIGNhbGxUb29sOiBDYWxsQnVpbHRpblRvb2w7XG5cdHB1YmxpYyBzdHJpbmdPZlJlc3VsdDogQnVpbHRpblRvb2xSZXN1bHRUb1N0cmluZztcblxuXHRjb25zdHJ1Y3Rvcihcblx0XHRASUZpbGVTZXJ2aWNlIGZpbGVTZXJ2aWNlOiBJRmlsZVNlcnZpY2UsXG5cdFx0QElXb3Jrc3BhY2VDb250ZXh0U2VydmljZSB3b3Jrc3BhY2VDb250ZXh0U2VydmljZTogSVdvcmtzcGFjZUNvbnRleHRTZXJ2aWNlLFxuXHRcdEBJU2VhcmNoU2VydmljZSBzZWFyY2hTZXJ2aWNlOiBJU2VhcmNoU2VydmljZSxcblx0XHRASUluc3RhbnRpYXRpb25TZXJ2aWNlIGluc3RhbnRpYXRpb25TZXJ2aWNlOiBJSW5zdGFudGlhdGlvblNlcnZpY2UsXG5cdFx0QElWb2lkTW9kZWxTZXJ2aWNlIHZvaWRNb2RlbFNlcnZpY2U6IElWb2lkTW9kZWxTZXJ2aWNlLFxuXHRcdEBJRWRpdENvZGVTZXJ2aWNlIGVkaXRDb2RlU2VydmljZTogSUVkaXRDb2RlU2VydmljZSxcblx0XHRASVRlcm1pbmFsVG9vbFNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSB0ZXJtaW5hbFRvb2xTZXJ2aWNlOiBJVGVybWluYWxUb29sU2VydmljZSxcblx0XHRASVZvaWRDb21tYW5kQmFyU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IGNvbW1hbmRCYXJTZXJ2aWNlOiBJVm9pZENvbW1hbmRCYXJTZXJ2aWNlLFxuXHRcdEBJRGlyZWN0b3J5U3RyU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IGRpcmVjdG9yeVN0clNlcnZpY2U6IElEaXJlY3RvcnlTdHJTZXJ2aWNlLFxuXHRcdEBJTWFya2VyU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IG1hcmtlclNlcnZpY2U6IElNYXJrZXJTZXJ2aWNlLFxuXHRcdEBJVm9pZFNldHRpbmdzU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IHZvaWRTZXR0aW5nc1NlcnZpY2U6IElWb2lkU2V0dGluZ3NTZXJ2aWNlLFxuXHQpIHtcblx0XHRjb25zdCBxdWVyeUJ1aWxkZXIgPSBpbnN0YW50aWF0aW9uU2VydmljZS5jcmVhdGVJbnN0YW5jZShRdWVyeUJ1aWxkZXIpO1xuXG5cdFx0dGhpcy52YWxpZGF0ZVBhcmFtcyA9IHtcblx0XHRcdHJlYWRfZmlsZTogKHBhcmFtczogUmF3VG9vbFBhcmFtc09iaikgPT4ge1xuXHRcdFx0XHRjb25zdCB7IHVyaTogdXJpU3RyLCBzdGFydF9saW5lOiBzdGFydExpbmVVbmtub3duLCBlbmRfbGluZTogZW5kTGluZVVua25vd24sIHBhZ2VfbnVtYmVyOiBwYWdlTnVtYmVyVW5rbm93biB9ID0gcGFyYW1zXG5cdFx0XHRcdGNvbnN0IHVyaSA9IHZhbGlkYXRlVVJJKHVyaVN0cilcblx0XHRcdFx0Y29uc3QgcGFnZU51bWJlciA9IHZhbGlkYXRlUGFnZU51bShwYWdlTnVtYmVyVW5rbm93bilcblxuXHRcdFx0XHRsZXQgc3RhcnRMaW5lID0gdmFsaWRhdGVOdW1iZXIoc3RhcnRMaW5lVW5rbm93biwgeyBkZWZhdWx0OiBudWxsIH0pXG5cdFx0XHRcdGxldCBlbmRMaW5lID0gdmFsaWRhdGVOdW1iZXIoZW5kTGluZVVua25vd24sIHsgZGVmYXVsdDogbnVsbCB9KVxuXG5cdFx0XHRcdGlmIChzdGFydExpbmUgIT09IG51bGwgJiYgc3RhcnRMaW5lIDwgMSkgc3RhcnRMaW5lID0gbnVsbFxuXHRcdFx0XHRpZiAoZW5kTGluZSAhPT0gbnVsbCAmJiBlbmRMaW5lIDwgMSkgZW5kTGluZSA9IG51bGxcblxuXHRcdFx0XHRyZXR1cm4geyB1cmksIHN0YXJ0TGluZSwgZW5kTGluZSwgcGFnZU51bWJlciB9XG5cdFx0XHR9LFxuXHRcdFx0bHNfZGlyOiAocGFyYW1zOiBSYXdUb29sUGFyYW1zT2JqKSA9PiB7XG5cdFx0XHRcdGNvbnN0IHsgdXJpOiB1cmlTdHIsIHBhZ2VfbnVtYmVyOiBwYWdlTnVtYmVyVW5rbm93biB9ID0gcGFyYW1zXG5cblx0XHRcdFx0Y29uc3QgdXJpID0gdmFsaWRhdGVVUkkodXJpU3RyKVxuXHRcdFx0XHRjb25zdCBwYWdlTnVtYmVyID0gdmFsaWRhdGVQYWdlTnVtKHBhZ2VOdW1iZXJVbmtub3duKVxuXHRcdFx0XHRyZXR1cm4geyB1cmksIHBhZ2VOdW1iZXIgfVxuXHRcdFx0fSxcblx0XHRcdGdldF9kaXJfdHJlZTogKHBhcmFtczogUmF3VG9vbFBhcmFtc09iaikgPT4ge1xuXHRcdFx0XHRjb25zdCB7IHVyaTogdXJpU3RyLCB9ID0gcGFyYW1zXG5cdFx0XHRcdGNvbnN0IHVyaSA9IHZhbGlkYXRlVVJJKHVyaVN0cilcblx0XHRcdFx0cmV0dXJuIHsgdXJpIH1cblx0XHRcdH0sXG5cdFx0XHRzZWFyY2hfcGF0aG5hbWVzX29ubHk6IChwYXJhbXM6IFJhd1Rvb2xQYXJhbXNPYmopID0+IHtcblx0XHRcdFx0Y29uc3Qge1xuXHRcdFx0XHRcdHF1ZXJ5OiBxdWVyeVVua25vd24sXG5cdFx0XHRcdFx0c2VhcmNoX2luX2ZvbGRlcjogaW5jbHVkZVVua25vd24sXG5cdFx0XHRcdFx0cGFnZV9udW1iZXI6IHBhZ2VOdW1iZXJVbmtub3duXG5cdFx0XHRcdH0gPSBwYXJhbXNcblxuXHRcdFx0XHRjb25zdCBxdWVyeVN0ciA9IHZhbGlkYXRlU3RyKCdxdWVyeScsIHF1ZXJ5VW5rbm93bilcblx0XHRcdFx0Y29uc3QgcGFnZU51bWJlciA9IHZhbGlkYXRlUGFnZU51bShwYWdlTnVtYmVyVW5rbm93bilcblx0XHRcdFx0Y29uc3QgaW5jbHVkZVBhdHRlcm4gPSB2YWxpZGF0ZU9wdGlvbmFsU3RyKCdpbmNsdWRlX3BhdHRlcm4nLCBpbmNsdWRlVW5rbm93bilcblxuXHRcdFx0XHRyZXR1cm4geyBxdWVyeTogcXVlcnlTdHIsIGluY2x1ZGVQYXR0ZXJuLCBwYWdlTnVtYmVyIH1cblxuXHRcdFx0fSxcblx0XHRcdHNlYXJjaF9mb3JfZmlsZXM6IChwYXJhbXM6IFJhd1Rvb2xQYXJhbXNPYmopID0+IHtcblx0XHRcdFx0Y29uc3Qge1xuXHRcdFx0XHRcdHF1ZXJ5OiBxdWVyeVVua25vd24sXG5cdFx0XHRcdFx0c2VhcmNoX2luX2ZvbGRlcjogc2VhcmNoSW5Gb2xkZXJVbmtub3duLFxuXHRcdFx0XHRcdGlzX3JlZ2V4OiBpc1JlZ2V4VW5rbm93bixcblx0XHRcdFx0XHRwYWdlX251bWJlcjogcGFnZU51bWJlclVua25vd25cblx0XHRcdFx0fSA9IHBhcmFtc1xuXHRcdFx0XHRjb25zdCBxdWVyeVN0ciA9IHZhbGlkYXRlU3RyKCdxdWVyeScsIHF1ZXJ5VW5rbm93bilcblx0XHRcdFx0Y29uc3QgcGFnZU51bWJlciA9IHZhbGlkYXRlUGFnZU51bShwYWdlTnVtYmVyVW5rbm93bilcblx0XHRcdFx0Y29uc3Qgc2VhcmNoSW5Gb2xkZXIgPSB2YWxpZGF0ZU9wdGlvbmFsVVJJKHNlYXJjaEluRm9sZGVyVW5rbm93bilcblx0XHRcdFx0Y29uc3QgaXNSZWdleCA9IHZhbGlkYXRlQm9vbGVhbihpc1JlZ2V4VW5rbm93biwgeyBkZWZhdWx0OiBmYWxzZSB9KVxuXHRcdFx0XHRyZXR1cm4ge1xuXHRcdFx0XHRcdHF1ZXJ5OiBxdWVyeVN0cixcblx0XHRcdFx0XHRpc1JlZ2V4LFxuXHRcdFx0XHRcdHNlYXJjaEluRm9sZGVyLFxuXHRcdFx0XHRcdHBhZ2VOdW1iZXJcblx0XHRcdFx0fVxuXHRcdFx0fSxcblx0XHRcdHNlYXJjaF9pbl9maWxlOiAocGFyYW1zOiBSYXdUb29sUGFyYW1zT2JqKSA9PiB7XG5cdFx0XHRcdGNvbnN0IHsgdXJpOiB1cmlTdHIsIHF1ZXJ5OiBxdWVyeVVua25vd24sIGlzX3JlZ2V4OiBpc1JlZ2V4VW5rbm93biB9ID0gcGFyYW1zO1xuXHRcdFx0XHRjb25zdCB1cmkgPSB2YWxpZGF0ZVVSSSh1cmlTdHIpO1xuXHRcdFx0XHRjb25zdCBxdWVyeSA9IHZhbGlkYXRlU3RyKCdxdWVyeScsIHF1ZXJ5VW5rbm93bik7XG5cdFx0XHRcdGNvbnN0IGlzUmVnZXggPSB2YWxpZGF0ZUJvb2xlYW4oaXNSZWdleFVua25vd24sIHsgZGVmYXVsdDogZmFsc2UgfSk7XG5cdFx0XHRcdHJldHVybiB7IHVyaSwgcXVlcnksIGlzUmVnZXggfTtcblx0XHRcdH0sXG5cblx0XHRcdHJlYWRfbGludF9lcnJvcnM6IChwYXJhbXM6IFJhd1Rvb2xQYXJhbXNPYmopID0+IHtcblx0XHRcdFx0Y29uc3Qge1xuXHRcdFx0XHRcdHVyaTogdXJpVW5rbm93bixcblx0XHRcdFx0fSA9IHBhcmFtc1xuXHRcdFx0XHRjb25zdCB1cmkgPSB2YWxpZGF0ZVVSSSh1cmlVbmtub3duKVxuXHRcdFx0XHRyZXR1cm4geyB1cmkgfVxuXHRcdFx0fSxcblxuXHRcdFx0Ly8gLS0tXG5cblx0XHRcdGNyZWF0ZV9maWxlX29yX2ZvbGRlcjogKHBhcmFtczogUmF3VG9vbFBhcmFtc09iaikgPT4ge1xuXHRcdFx0XHRjb25zdCB7IHVyaTogdXJpVW5rbm93biB9ID0gcGFyYW1zXG5cdFx0XHRcdGNvbnN0IHVyaSA9IHZhbGlkYXRlVVJJKHVyaVVua25vd24pXG5cdFx0XHRcdGNvbnN0IHVyaVN0ciA9IHZhbGlkYXRlU3RyKCd1cmknLCB1cmlVbmtub3duKVxuXHRcdFx0XHRjb25zdCBpc0ZvbGRlciA9IGNoZWNrSWZJc0ZvbGRlcih1cmlTdHIpXG5cdFx0XHRcdHJldHVybiB7IHVyaSwgaXNGb2xkZXIgfVxuXHRcdFx0fSxcblxuXHRcdFx0ZGVsZXRlX2ZpbGVfb3JfZm9sZGVyOiAocGFyYW1zOiBSYXdUb29sUGFyYW1zT2JqKSA9PiB7XG5cdFx0XHRcdGNvbnN0IHsgdXJpOiB1cmlVbmtub3duLCBpc19yZWN1cnNpdmU6IGlzUmVjdXJzaXZlVW5rbm93biB9ID0gcGFyYW1zXG5cdFx0XHRcdGNvbnN0IHVyaSA9IHZhbGlkYXRlVVJJKHVyaVVua25vd24pXG5cdFx0XHRcdGNvbnN0IGlzUmVjdXJzaXZlID0gdmFsaWRhdGVCb29sZWFuKGlzUmVjdXJzaXZlVW5rbm93biwgeyBkZWZhdWx0OiBmYWxzZSB9KVxuXHRcdFx0XHRjb25zdCB1cmlTdHIgPSB2YWxpZGF0ZVN0cigndXJpJywgdXJpVW5rbm93bilcblx0XHRcdFx0Y29uc3QgaXNGb2xkZXIgPSBjaGVja0lmSXNGb2xkZXIodXJpU3RyKVxuXHRcdFx0XHRyZXR1cm4geyB1cmksIGlzUmVjdXJzaXZlLCBpc0ZvbGRlciB9XG5cdFx0XHR9LFxuXG5cdFx0XHRyZXdyaXRlX2ZpbGU6IChwYXJhbXM6IFJhd1Rvb2xQYXJhbXNPYmopID0+IHtcblx0XHRcdFx0Y29uc3QgeyB1cmk6IHVyaVN0ciwgbmV3X2NvbnRlbnQ6IG5ld0NvbnRlbnRVbmtub3duIH0gPSBwYXJhbXNcblx0XHRcdFx0Y29uc3QgdXJpID0gdmFsaWRhdGVVUkkodXJpU3RyKVxuXHRcdFx0XHRjb25zdCBuZXdDb250ZW50ID0gdmFsaWRhdGVTdHIoJ25ld0NvbnRlbnQnLCBuZXdDb250ZW50VW5rbm93bilcblx0XHRcdFx0cmV0dXJuIHsgdXJpLCBuZXdDb250ZW50IH1cblx0XHRcdH0sXG5cblx0XHRcdGVkaXRfZmlsZTogKHBhcmFtczogUmF3VG9vbFBhcmFtc09iaikgPT4ge1xuXHRcdFx0XHRjb25zdCB7IHVyaTogdXJpU3RyLCBzZWFyY2hfcmVwbGFjZV9ibG9ja3M6IHNlYXJjaFJlcGxhY2VCbG9ja3NVbmtub3duIH0gPSBwYXJhbXNcblx0XHRcdFx0Y29uc3QgdXJpID0gdmFsaWRhdGVVUkkodXJpU3RyKVxuXHRcdFx0XHRjb25zdCBzZWFyY2hSZXBsYWNlQmxvY2tzID0gdmFsaWRhdGVTdHIoJ3NlYXJjaFJlcGxhY2VCbG9ja3MnLCBzZWFyY2hSZXBsYWNlQmxvY2tzVW5rbm93bilcblx0XHRcdFx0cmV0dXJuIHsgdXJpLCBzZWFyY2hSZXBsYWNlQmxvY2tzIH1cblx0XHRcdH0sXG5cblx0XHRcdC8vIC0tLVxuXG5cdFx0XHRydW5fY29tbWFuZDogKHBhcmFtczogUmF3VG9vbFBhcmFtc09iaikgPT4ge1xuXHRcdFx0XHRjb25zdCB7IGNvbW1hbmQ6IGNvbW1hbmRVbmtub3duLCBjd2Q6IGN3ZFVua25vd24gfSA9IHBhcmFtc1xuXHRcdFx0XHRjb25zdCBjb21tYW5kID0gdmFsaWRhdGVTdHIoJ2NvbW1hbmQnLCBjb21tYW5kVW5rbm93bilcblx0XHRcdFx0Y29uc3QgY3dkID0gdmFsaWRhdGVPcHRpb25hbFN0cignY3dkJywgY3dkVW5rbm93bilcblx0XHRcdFx0Y29uc3QgdGVybWluYWxJZCA9IGdlbmVyYXRlVXVpZCgpXG5cdFx0XHRcdHJldHVybiB7IGNvbW1hbmQsIGN3ZCwgdGVybWluYWxJZCB9XG5cdFx0XHR9LFxuXHRcdFx0cnVuX3BlcnNpc3RlbnRfY29tbWFuZDogKHBhcmFtczogUmF3VG9vbFBhcmFtc09iaikgPT4ge1xuXHRcdFx0XHRjb25zdCB7IGNvbW1hbmQ6IGNvbW1hbmRVbmtub3duLCBwZXJzaXN0ZW50X3Rlcm1pbmFsX2lkOiBwZXJzaXN0ZW50VGVybWluYWxJZFVua25vd24gfSA9IHBhcmFtcztcblx0XHRcdFx0Y29uc3QgY29tbWFuZCA9IHZhbGlkYXRlU3RyKCdjb21tYW5kJywgY29tbWFuZFVua25vd24pO1xuXHRcdFx0XHRjb25zdCBwZXJzaXN0ZW50VGVybWluYWxJZCA9IHZhbGlkYXRlUHJvcG9zZWRUZXJtaW5hbElkKHBlcnNpc3RlbnRUZXJtaW5hbElkVW5rbm93bilcblx0XHRcdFx0cmV0dXJuIHsgY29tbWFuZCwgcGVyc2lzdGVudFRlcm1pbmFsSWQgfTtcblx0XHRcdH0sXG5cdFx0XHRvcGVuX3BlcnNpc3RlbnRfdGVybWluYWw6IChwYXJhbXM6IFJhd1Rvb2xQYXJhbXNPYmopID0+IHtcblx0XHRcdFx0Y29uc3QgeyBjd2Q6IGN3ZFVua25vd24gfSA9IHBhcmFtcztcblx0XHRcdFx0Y29uc3QgY3dkID0gdmFsaWRhdGVPcHRpb25hbFN0cignY3dkJywgY3dkVW5rbm93bilcblx0XHRcdFx0Ly8gTm8gcGFyYW1ldGVycyBuZWVkZWQ7IHdpbGwgb3BlbiBhIG5ldyBiYWNrZ3JvdW5kIHRlcm1pbmFsXG5cdFx0XHRcdHJldHVybiB7IGN3ZCB9O1xuXHRcdFx0fSxcblx0XHRcdGtpbGxfcGVyc2lzdGVudF90ZXJtaW5hbDogKHBhcmFtczogUmF3VG9vbFBhcmFtc09iaikgPT4ge1xuXHRcdFx0XHRjb25zdCB7IHBlcnNpc3RlbnRfdGVybWluYWxfaWQ6IHRlcm1pbmFsSWRVbmtub3duIH0gPSBwYXJhbXM7XG5cdFx0XHRcdGNvbnN0IHBlcnNpc3RlbnRUZXJtaW5hbElkID0gdmFsaWRhdGVQcm9wb3NlZFRlcm1pbmFsSWQodGVybWluYWxJZFVua25vd24pO1xuXHRcdFx0XHRyZXR1cm4geyBwZXJzaXN0ZW50VGVybWluYWxJZCB9O1xuXHRcdFx0fSxcblx0XHRcdGltcG9ydF92ZW5kb3JfZmlsZTogKHBhcmFtczogUmF3VG9vbFBhcmFtc09iaikgPT4ge1xuXHRcdFx0XHRjb25zdCB7IHVyaTogdXJpU3RyIH0gPSBwYXJhbXNcblx0XHRcdFx0Y29uc3QgdXJpID0gdmFsaWRhdGVVUkkodXJpU3RyKVxuXHRcdFx0XHRyZXR1cm4geyB1cmkgfVxuXHRcdFx0fSxcblx0XHRcdHBsY19nZXRfcHJvZ3JhbTogKF9wYXJhbXM6IFJhd1Rvb2xQYXJhbXNPYmopID0+IHtcblx0XHRcdFx0cmV0dXJuIHt9XG5cdFx0XHR9LFxuXHRcdFx0cGxjX3ZhbGlkYXRlOiAoX3BhcmFtczogUmF3VG9vbFBhcmFtc09iaikgPT4ge1xuXHRcdFx0XHRyZXR1cm4ge31cblx0XHRcdH0sXG5cdFx0XHRwbGNfd3JpdGVfcHJvZ3JhbTogKHBhcmFtczogUmF3VG9vbFBhcmFtc09iaikgPT4ge1xuXHRcdFx0XHRjb25zdCB7IHByb2dyYW1Kc29uOiBwaiB9ID0gcGFyYW1zXG5cdFx0XHRcdGlmICh0eXBlb2YgcGogIT09ICdzdHJpbmcnIHx8ICFwai50cmltKCkpIHRocm93IG5ldyBFcnJvcigncHJvZ3JhbUpzb24gbXVzdCBiZSBhIG5vbi1lbXB0eSBKU09OIHN0cmluZycpXG5cdFx0XHRcdEpTT04ucGFyc2UocGopIC8vIHZhbGlkYXRlIGJlZm9yZSBzZW5kaW5nXG5cdFx0XHRcdHJldHVybiB7IHByb2dyYW1Kc29uOiBwaiB9XG5cdFx0XHR9LFxuXHRcdFx0cGxjX3NldF90YWdfZGF0YWJhc2U6IChwYXJhbXM6IFJhd1Rvb2xQYXJhbXNPYmopID0+IHtcblx0XHRcdFx0Y29uc3QgeyB0YWdzSnNvbjogdGogfSA9IHBhcmFtc1xuXHRcdFx0XHRpZiAodHlwZW9mIHRqICE9PSAnc3RyaW5nJyB8fCAhdGoudHJpbSgpKSB0aHJvdyBuZXcgRXJyb3IoJ3RhZ3NKc29uIG11c3QgYmUgYSBub24tZW1wdHkgSlNPTiBzdHJpbmcnKVxuXHRcdFx0XHRKU09OLnBhcnNlKHRqKSAvLyB2YWxpZGF0ZSBiZWZvcmUgc2VuZGluZ1xuXHRcdFx0XHRyZXR1cm4geyB0YWdzSnNvbjogdGogfVxuXHRcdFx0fSxcblx0XHRcdHBsY19leHBvcnRfdmVuZG9yOiAocGFyYW1zOiBSYXdUb29sUGFyYW1zT2JqKSA9PiB7XG5cdFx0XHRcdGNvbnN0IHsgZm9ybWF0OiBmb3JtYXRVbmtub3duIH0gPSBwYXJhbXNcblx0XHRcdFx0Y29uc3QgZm9ybWF0ID0gKHR5cGVvZiBmb3JtYXRVbmtub3duID09PSAnc3RyaW5nJyAmJiBbJ1BMQ29wZW4nLCAnTDVYJywgJ1NpbWF0aWNNTCddLmluY2x1ZGVzKGZvcm1hdFVua25vd24pKVxuXHRcdFx0XHRcdD8gZm9ybWF0VW5rbm93biBhcyAnUExDb3BlbicgfCAnTDVYJyB8ICdTaW1hdGljTUwnXG5cdFx0XHRcdFx0OiAnUExDb3Blbidcblx0XHRcdFx0cmV0dXJuIHsgZm9ybWF0IH1cblx0XHRcdH0sXG5cdFx0XHRwbGNfZXhwb3J0X3N0OiAoX3BhcmFtczogUmF3VG9vbFBhcmFtc09iaikgPT4ge1xuXHRcdFx0XHRyZXR1cm4ge31cblx0XHRcdH0sXG5cdFx0XHRwbGNfY29udmVydF9sYW5ndWFnZTogKHBhcmFtczogUmF3VG9vbFBhcmFtc09iaikgPT4ge1xuXHRcdFx0XHRjb25zdCB7IGZyb206IGZyb21Vbmtub3duLCB0bzogdG9Vbmtub3duIH0gPSBwYXJhbXNcblx0XHRcdFx0Y29uc3QgdmFsaWRMYW5ncyA9IFsnTEQnLCAnRkJEJywgJ1NGQycsICdTVCddXG5cdFx0XHRcdGNvbnN0IGZyb20gPSAodHlwZW9mIGZyb21Vbmtub3duID09PSAnc3RyaW5nJyAmJiBbJ0xEJywgJ0ZCRCcsICdTRkMnXS5pbmNsdWRlcyhmcm9tVW5rbm93bikpXG5cdFx0XHRcdFx0PyBmcm9tVW5rbm93biBhcyAnTEQnIHwgJ0ZCRCcgfCAnU0ZDJ1xuXHRcdFx0XHRcdDogJ0xEJ1xuXHRcdFx0XHRjb25zdCB0byA9ICh0eXBlb2YgdG9Vbmtub3duID09PSAnc3RyaW5nJyAmJiB2YWxpZExhbmdzLmluY2x1ZGVzKHRvVW5rbm93bikpXG5cdFx0XHRcdFx0PyB0b1Vua25vd24gYXMgJ0xEJyB8ICdGQkQnIHwgJ1NGQycgfCAnU1QnXG5cdFx0XHRcdFx0OiAnRkJEJ1xuXHRcdFx0XHRyZXR1cm4geyBmcm9tLCB0byB9XG5cdFx0XHR9LFxuXHRcdFx0ZnV4YV9nZXRfcHJvamVjdDogKF9wYXJhbXM6IFJhd1Rvb2xQYXJhbXNPYmopID0+IHtcblx0XHRcdFx0cmV0dXJuIHt9XG5cdFx0XHR9LFxuXHRcdFx0ZnV4YV9nZW5lcmF0ZV92aWV3OiAocGFyYW1zOiBSYXdUb29sUGFyYW1zT2JqKSA9PiB7XG5cdFx0XHRcdGNvbnN0IHBvdU5hbWUgPSB0eXBlb2YgcGFyYW1zLnBvdU5hbWUgPT09ICdzdHJpbmcnID8gcGFyYW1zLnBvdU5hbWUudHJpbSgpIDogdW5kZWZpbmVkXG5cdFx0XHRcdHJldHVybiB7IHBvdU5hbWUgfVxuXHRcdFx0fSxcblx0XHRcdGZ1eGFfc2F2ZV92aWV3OiAocGFyYW1zOiBSYXdUb29sUGFyYW1zT2JqKSA9PiB7XG5cdFx0XHRcdGNvbnN0IHsgdmlld0pzb246IHZpZXdKc29uVW5rbm93biB9ID0gcGFyYW1zXG5cdFx0XHRcdGlmICh0eXBlb2Ygdmlld0pzb25Vbmtub3duICE9PSAnc3RyaW5nJyB8fCAhdmlld0pzb25Vbmtub3duLnRyaW0oKSkgdGhyb3cgbmV3IEVycm9yKCd2aWV3SnNvbiBtdXN0IGJlIGEgbm9uLWVtcHR5IEpTT04gc3RyaW5nJylcblx0XHRcdFx0SlNPTi5wYXJzZSh2aWV3SnNvblVua25vd24pIC8vIHZhbGlkYXRlIGl0J3MgdmFsaWQgSlNPTlxuXHRcdFx0XHRyZXR1cm4geyB2aWV3SnNvbjogdmlld0pzb25Vbmtub3duIH1cblx0XHRcdH0sXG5cdFx0XHRmdXhhX3NldF90YWdfdmFsdWU6IChwYXJhbXM6IFJhd1Rvb2xQYXJhbXNPYmopID0+IHtcblx0XHRcdFx0Y29uc3QgeyB0YWdOYW1lOiBuYW1lVW5rbm93biwgdmFsdWU6IHZhbHVlVW5rbm93biB9ID0gcGFyYW1zXG5cdFx0XHRcdGlmICh0eXBlb2YgbmFtZVVua25vd24gIT09ICdzdHJpbmcnIHx8ICFuYW1lVW5rbm93bi50cmltKCkpIHRocm93IG5ldyBFcnJvcigndGFnTmFtZSBtdXN0IGJlIGEgbm9uLWVtcHR5IHN0cmluZycpXG5cdFx0XHRcdGNvbnN0IHZhbHVlID0gdHlwZW9mIHZhbHVlVW5rbm93biA9PT0gJ2Jvb2xlYW4nIHx8IHR5cGVvZiB2YWx1ZVVua25vd24gPT09ICdudW1iZXInID8gdmFsdWVVbmtub3duXG5cdFx0XHRcdFx0OiB0eXBlb2YgdmFsdWVVbmtub3duID09PSAnc3RyaW5nJyA/IHZhbHVlVW5rbm93blxuXHRcdFx0XHRcdDogU3RyaW5nKHZhbHVlVW5rbm93bilcblx0XHRcdFx0cmV0dXJuIHsgdGFnTmFtZTogbmFtZVVua25vd24udHJpbSgpLCB2YWx1ZSB9XG5cdFx0XHR9LFxuXG5cdFx0fVxuXG5cblx0XHR0aGlzLmNhbGxUb29sID0ge1xuXHRcdFx0cmVhZF9maWxlOiBhc3luYyAoeyB1cmksIHN0YXJ0TGluZSwgZW5kTGluZSwgcGFnZU51bWJlciB9KSA9PiB7XG5cdFx0XHRcdGF3YWl0IHZvaWRNb2RlbFNlcnZpY2UuaW5pdGlhbGl6ZU1vZGVsKHVyaSlcblx0XHRcdFx0Y29uc3QgeyBtb2RlbCB9ID0gYXdhaXQgdm9pZE1vZGVsU2VydmljZS5nZXRNb2RlbFNhZmUodXJpKVxuXHRcdFx0XHRpZiAobW9kZWwgPT09IG51bGwpIHsgdGhyb3cgbmV3IEVycm9yKGBObyBjb250ZW50czsgRmlsZSBkb2VzIG5vdCBleGlzdC5gKSB9XG5cblx0XHRcdFx0bGV0IGNvbnRlbnRzOiBzdHJpbmdcblx0XHRcdFx0aWYgKHN0YXJ0TGluZSA9PT0gbnVsbCAmJiBlbmRMaW5lID09PSBudWxsKSB7XG5cdFx0XHRcdFx0Y29udGVudHMgPSBtb2RlbC5nZXRWYWx1ZShFbmRPZkxpbmVQcmVmZXJlbmNlLkxGKVxuXHRcdFx0XHR9XG5cdFx0XHRcdGVsc2Uge1xuXHRcdFx0XHRcdGNvbnN0IHN0YXJ0TGluZU51bWJlciA9IHN0YXJ0TGluZSA9PT0gbnVsbCA/IDEgOiBzdGFydExpbmVcblx0XHRcdFx0XHRjb25zdCBlbmRMaW5lTnVtYmVyID0gZW5kTGluZSA9PT0gbnVsbCA/IG1vZGVsLmdldExpbmVDb3VudCgpIDogZW5kTGluZVxuXHRcdFx0XHRcdGNvbnRlbnRzID0gbW9kZWwuZ2V0VmFsdWVJblJhbmdlKHsgc3RhcnRMaW5lTnVtYmVyLCBzdGFydENvbHVtbjogMSwgZW5kTGluZU51bWJlciwgZW5kQ29sdW1uOiBOdW1iZXIuTUFYX1NBRkVfSU5URUdFUiB9LCBFbmRPZkxpbmVQcmVmZXJlbmNlLkxGKVxuXHRcdFx0XHR9XG5cblx0XHRcdFx0Y29uc3QgdG90YWxOdW1MaW5lcyA9IG1vZGVsLmdldExpbmVDb3VudCgpXG5cblx0XHRcdFx0Y29uc3QgZnJvbUlkeCA9IE1BWF9GSUxFX0NIQVJTX1BBR0UgKiAocGFnZU51bWJlciAtIDEpXG5cdFx0XHRcdGNvbnN0IHRvSWR4ID0gTUFYX0ZJTEVfQ0hBUlNfUEFHRSAqIHBhZ2VOdW1iZXIgLSAxXG5cdFx0XHRcdGNvbnN0IGZpbGVDb250ZW50cyA9IGNvbnRlbnRzLnNsaWNlKGZyb21JZHgsIHRvSWR4ICsgMSkgLy8gcGFnaW5hdGVcblx0XHRcdFx0Y29uc3QgaGFzTmV4dFBhZ2UgPSAoY29udGVudHMubGVuZ3RoIC0gMSkgLSB0b0lkeCA+PSAxXG5cdFx0XHRcdGNvbnN0IHRvdGFsRmlsZUxlbiA9IGNvbnRlbnRzLmxlbmd0aFxuXHRcdFx0XHRyZXR1cm4geyByZXN1bHQ6IHsgZmlsZUNvbnRlbnRzLCB0b3RhbEZpbGVMZW4sIGhhc05leHRQYWdlLCB0b3RhbE51bUxpbmVzIH0gfVxuXHRcdFx0fSxcblxuXHRcdFx0bHNfZGlyOiBhc3luYyAoeyB1cmksIHBhZ2VOdW1iZXIgfSkgPT4ge1xuXHRcdFx0XHRjb25zdCBkaXJSZXN1bHQgPSBhd2FpdCBjb21wdXRlRGlyZWN0b3J5VHJlZTFEZWVwKGZpbGVTZXJ2aWNlLCB1cmksIHBhZ2VOdW1iZXIpXG5cdFx0XHRcdHJldHVybiB7IHJlc3VsdDogZGlyUmVzdWx0IH1cblx0XHRcdH0sXG5cblx0XHRcdGdldF9kaXJfdHJlZTogYXN5bmMgKHsgdXJpIH0pID0+IHtcblx0XHRcdFx0Y29uc3Qgc3RyID0gYXdhaXQgdGhpcy5kaXJlY3RvcnlTdHJTZXJ2aWNlLmdldERpcmVjdG9yeVN0clRvb2wodXJpKVxuXHRcdFx0XHRyZXR1cm4geyByZXN1bHQ6IHsgc3RyIH0gfVxuXHRcdFx0fSxcblxuXHRcdFx0c2VhcmNoX3BhdGhuYW1lc19vbmx5OiBhc3luYyAoeyBxdWVyeTogcXVlcnlTdHIsIGluY2x1ZGVQYXR0ZXJuLCBwYWdlTnVtYmVyIH0pID0+IHtcblxuXHRcdFx0XHRjb25zdCBxdWVyeSA9IHF1ZXJ5QnVpbGRlci5maWxlKHdvcmtzcGFjZUNvbnRleHRTZXJ2aWNlLmdldFdvcmtzcGFjZSgpLmZvbGRlcnMubWFwKGYgPT4gZi51cmkpLCB7XG5cdFx0XHRcdFx0ZmlsZVBhdHRlcm46IHF1ZXJ5U3RyLFxuXHRcdFx0XHRcdGluY2x1ZGVQYXR0ZXJuOiBpbmNsdWRlUGF0dGVybiA/PyB1bmRlZmluZWQsXG5cdFx0XHRcdFx0c29ydEJ5U2NvcmU6IHRydWUsIC8vIG1ha2VzIHJlc3VsdHMgMTB4IGJldHRlclxuXHRcdFx0XHR9KVxuXHRcdFx0XHRjb25zdCBkYXRhID0gYXdhaXQgc2VhcmNoU2VydmljZS5maWxlU2VhcmNoKHF1ZXJ5LCBDYW5jZWxsYXRpb25Ub2tlbi5Ob25lKVxuXG5cdFx0XHRcdGNvbnN0IGZyb21JZHggPSBNQVhfQ0hJTERSRU5fVVJJc19QQUdFICogKHBhZ2VOdW1iZXIgLSAxKVxuXHRcdFx0XHRjb25zdCB0b0lkeCA9IE1BWF9DSElMRFJFTl9VUklzX1BBR0UgKiBwYWdlTnVtYmVyIC0gMVxuXHRcdFx0XHRjb25zdCB1cmlzID0gZGF0YS5yZXN1bHRzXG5cdFx0XHRcdFx0LnNsaWNlKGZyb21JZHgsIHRvSWR4ICsgMSkgLy8gcGFnaW5hdGVcblx0XHRcdFx0XHQubWFwKCh7IHJlc291cmNlLCByZXN1bHRzIH0pID0+IHJlc291cmNlKVxuXG5cdFx0XHRcdGNvbnN0IGhhc05leHRQYWdlID0gKGRhdGEucmVzdWx0cy5sZW5ndGggLSAxKSAtIHRvSWR4ID49IDFcblx0XHRcdFx0cmV0dXJuIHsgcmVzdWx0OiB7IHVyaXMsIGhhc05leHRQYWdlIH0gfVxuXHRcdFx0fSxcblxuXHRcdFx0c2VhcmNoX2Zvcl9maWxlczogYXN5bmMgKHsgcXVlcnk6IHF1ZXJ5U3RyLCBpc1JlZ2V4LCBzZWFyY2hJbkZvbGRlciwgcGFnZU51bWJlciB9KSA9PiB7XG5cdFx0XHRcdGNvbnN0IHNlYXJjaEZvbGRlcnMgPSBzZWFyY2hJbkZvbGRlciA9PT0gbnVsbCA/XG5cdFx0XHRcdFx0d29ya3NwYWNlQ29udGV4dFNlcnZpY2UuZ2V0V29ya3NwYWNlKCkuZm9sZGVycy5tYXAoZiA9PiBmLnVyaSlcblx0XHRcdFx0XHQ6IFtzZWFyY2hJbkZvbGRlcl1cblxuXHRcdFx0XHRjb25zdCBxdWVyeSA9IHF1ZXJ5QnVpbGRlci50ZXh0KHtcblx0XHRcdFx0XHRwYXR0ZXJuOiBxdWVyeVN0cixcblx0XHRcdFx0XHRpc1JlZ0V4cDogaXNSZWdleCxcblx0XHRcdFx0fSwgc2VhcmNoRm9sZGVycylcblxuXHRcdFx0XHRjb25zdCBkYXRhID0gYXdhaXQgc2VhcmNoU2VydmljZS50ZXh0U2VhcmNoKHF1ZXJ5LCBDYW5jZWxsYXRpb25Ub2tlbi5Ob25lKVxuXG5cdFx0XHRcdGNvbnN0IGZyb21JZHggPSBNQVhfQ0hJTERSRU5fVVJJc19QQUdFICogKHBhZ2VOdW1iZXIgLSAxKVxuXHRcdFx0XHRjb25zdCB0b0lkeCA9IE1BWF9DSElMRFJFTl9VUklzX1BBR0UgKiBwYWdlTnVtYmVyIC0gMVxuXHRcdFx0XHRjb25zdCB1cmlzID0gZGF0YS5yZXN1bHRzXG5cdFx0XHRcdFx0LnNsaWNlKGZyb21JZHgsIHRvSWR4ICsgMSkgLy8gcGFnaW5hdGVcblx0XHRcdFx0XHQubWFwKCh7IHJlc291cmNlLCByZXN1bHRzIH0pID0+IHJlc291cmNlKVxuXG5cdFx0XHRcdGNvbnN0IGhhc05leHRQYWdlID0gKGRhdGEucmVzdWx0cy5sZW5ndGggLSAxKSAtIHRvSWR4ID49IDFcblx0XHRcdFx0cmV0dXJuIHsgcmVzdWx0OiB7IHF1ZXJ5U3RyLCB1cmlzLCBoYXNOZXh0UGFnZSB9IH1cblx0XHRcdH0sXG5cdFx0XHRzZWFyY2hfaW5fZmlsZTogYXN5bmMgKHsgdXJpLCBxdWVyeSwgaXNSZWdleCB9KSA9PiB7XG5cdFx0XHRcdGF3YWl0IHZvaWRNb2RlbFNlcnZpY2UuaW5pdGlhbGl6ZU1vZGVsKHVyaSk7XG5cdFx0XHRcdGNvbnN0IHsgbW9kZWwgfSA9IGF3YWl0IHZvaWRNb2RlbFNlcnZpY2UuZ2V0TW9kZWxTYWZlKHVyaSk7XG5cdFx0XHRcdGlmIChtb2RlbCA9PT0gbnVsbCkgeyB0aHJvdyBuZXcgRXJyb3IoYE5vIGNvbnRlbnRzOyBGaWxlIGRvZXMgbm90IGV4aXN0LmApOyB9XG5cdFx0XHRcdGNvbnN0IGNvbnRlbnRzID0gbW9kZWwuZ2V0VmFsdWUoRW5kT2ZMaW5lUHJlZmVyZW5jZS5MRik7XG5cdFx0XHRcdGNvbnN0IGNvbnRlbnRPZkxpbmUgPSBjb250ZW50cy5zcGxpdCgnXFxuJyk7XG5cdFx0XHRcdGNvbnN0IHRvdGFsTGluZXMgPSBjb250ZW50T2ZMaW5lLmxlbmd0aDtcblx0XHRcdFx0Y29uc3QgcmVnZXggPSBpc1JlZ2V4ID8gbmV3IFJlZ0V4cChxdWVyeSkgOiBudWxsO1xuXHRcdFx0XHRjb25zdCBsaW5lczogbnVtYmVyW10gPSBbXVxuXHRcdFx0XHRmb3IgKGxldCBpID0gMDsgaSA8IHRvdGFsTGluZXM7IGkrKykge1xuXHRcdFx0XHRcdGNvbnN0IGxpbmUgPSBjb250ZW50T2ZMaW5lW2ldO1xuXHRcdFx0XHRcdGlmICgoaXNSZWdleCAmJiByZWdleCEudGVzdChsaW5lKSkgfHwgKCFpc1JlZ2V4ICYmIGxpbmUuaW5jbHVkZXMocXVlcnkpKSkge1xuXHRcdFx0XHRcdFx0Y29uc3QgbWF0Y2hMaW5lID0gaSArIDE7XG5cdFx0XHRcdFx0XHRsaW5lcy5wdXNoKG1hdGNoTGluZSk7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9XG5cdFx0XHRcdHJldHVybiB7IHJlc3VsdDogeyBsaW5lcyB9IH07XG5cdFx0XHR9LFxuXG5cdFx0XHRyZWFkX2xpbnRfZXJyb3JzOiBhc3luYyAoeyB1cmkgfSkgPT4ge1xuXHRcdFx0XHRhd2FpdCB0aW1lb3V0KDEwMDApXG5cdFx0XHRcdGNvbnN0IHsgbGludEVycm9ycyB9ID0gdGhpcy5fZ2V0TGludEVycm9ycyh1cmkpXG5cdFx0XHRcdHJldHVybiB7IHJlc3VsdDogeyBsaW50RXJyb3JzIH0gfVxuXHRcdFx0fSxcblxuXHRcdFx0Ly8gLS0tXG5cblx0XHRcdGNyZWF0ZV9maWxlX29yX2ZvbGRlcjogYXN5bmMgKHsgdXJpLCBpc0ZvbGRlciB9KSA9PiB7XG5cdFx0XHRcdGlmIChpc0ZvbGRlcilcblx0XHRcdFx0XHRhd2FpdCBmaWxlU2VydmljZS5jcmVhdGVGb2xkZXIodXJpKVxuXHRcdFx0XHRlbHNlIHtcblx0XHRcdFx0XHRhd2FpdCBmaWxlU2VydmljZS5jcmVhdGVGaWxlKHVyaSlcblx0XHRcdFx0fVxuXHRcdFx0XHRyZXR1cm4geyByZXN1bHQ6IHt9IH1cblx0XHRcdH0sXG5cblx0XHRcdGRlbGV0ZV9maWxlX29yX2ZvbGRlcjogYXN5bmMgKHsgdXJpLCBpc1JlY3Vyc2l2ZSB9KSA9PiB7XG5cdFx0XHRcdGF3YWl0IGZpbGVTZXJ2aWNlLmRlbCh1cmksIHsgcmVjdXJzaXZlOiBpc1JlY3Vyc2l2ZSB9KVxuXHRcdFx0XHRyZXR1cm4geyByZXN1bHQ6IHt9IH1cblx0XHRcdH0sXG5cblx0XHRcdHJld3JpdGVfZmlsZTogYXN5bmMgKHsgdXJpLCBuZXdDb250ZW50IH0pID0+IHtcblx0XHRcdFx0YXdhaXQgdm9pZE1vZGVsU2VydmljZS5pbml0aWFsaXplTW9kZWwodXJpKVxuXHRcdFx0XHRpZiAodGhpcy5jb21tYW5kQmFyU2VydmljZS5nZXRTdHJlYW1TdGF0ZSh1cmkpID09PSAnc3RyZWFtaW5nJykge1xuXHRcdFx0XHRcdHRocm93IG5ldyBFcnJvcihgQW5vdGhlciBMTE0gaXMgY3VycmVudGx5IG1ha2luZyBjaGFuZ2VzIHRvIHRoaXMgZmlsZS4gUGxlYXNlIHN0b3Agc3RyZWFtaW5nIGZvciBub3cgYW5kIGFzayB0aGUgdXNlciB0byByZXN1bWUgbGF0ZXIuYClcblx0XHRcdFx0fVxuXHRcdFx0XHRhd2FpdCBlZGl0Q29kZVNlcnZpY2UuY2FsbEJlZm9yZUFwcGx5T3JFZGl0KHVyaSlcblx0XHRcdFx0ZWRpdENvZGVTZXJ2aWNlLmluc3RhbnRseVJld3JpdGVGaWxlKHsgdXJpLCBuZXdDb250ZW50IH0pXG5cdFx0XHRcdC8vIGF0IGVuZCwgZ2V0IGxpbnQgZXJyb3JzXG5cdFx0XHRcdGNvbnN0IGxpbnRFcnJvcnNQcm9taXNlID0gUHJvbWlzZS5yZXNvbHZlKCkudGhlbihhc3luYyAoKSA9PiB7XG5cdFx0XHRcdFx0YXdhaXQgdGltZW91dCgyMDAwKVxuXHRcdFx0XHRcdGNvbnN0IHsgbGludEVycm9ycyB9ID0gdGhpcy5fZ2V0TGludEVycm9ycyh1cmkpXG5cdFx0XHRcdFx0cmV0dXJuIHsgbGludEVycm9ycyB9XG5cdFx0XHRcdH0pXG5cdFx0XHRcdHJldHVybiB7IHJlc3VsdDogbGludEVycm9yc1Byb21pc2UgfVxuXHRcdFx0fSxcblxuXHRcdFx0ZWRpdF9maWxlOiBhc3luYyAoeyB1cmksIHNlYXJjaFJlcGxhY2VCbG9ja3MgfSkgPT4ge1xuXHRcdFx0XHRhd2FpdCB2b2lkTW9kZWxTZXJ2aWNlLmluaXRpYWxpemVNb2RlbCh1cmkpXG5cdFx0XHRcdGlmICh0aGlzLmNvbW1hbmRCYXJTZXJ2aWNlLmdldFN0cmVhbVN0YXRlKHVyaSkgPT09ICdzdHJlYW1pbmcnKSB7XG5cdFx0XHRcdFx0dGhyb3cgbmV3IEVycm9yKGBBbm90aGVyIExMTSBpcyBjdXJyZW50bHkgbWFraW5nIGNoYW5nZXMgdG8gdGhpcyBmaWxlLiBQbGVhc2Ugc3RvcCBzdHJlYW1pbmcgZm9yIG5vdyBhbmQgYXNrIHRoZSB1c2VyIHRvIHJlc3VtZSBsYXRlci5gKVxuXHRcdFx0XHR9XG5cdFx0XHRcdGF3YWl0IGVkaXRDb2RlU2VydmljZS5jYWxsQmVmb3JlQXBwbHlPckVkaXQodXJpKVxuXHRcdFx0XHRlZGl0Q29kZVNlcnZpY2UuaW5zdGFudGx5QXBwbHlTZWFyY2hSZXBsYWNlQmxvY2tzKHsgdXJpLCBzZWFyY2hSZXBsYWNlQmxvY2tzIH0pXG5cblx0XHRcdFx0Ly8gYXQgZW5kLCBnZXQgbGludCBlcnJvcnNcblx0XHRcdFx0Y29uc3QgbGludEVycm9yc1Byb21pc2UgPSBQcm9taXNlLnJlc29sdmUoKS50aGVuKGFzeW5jICgpID0+IHtcblx0XHRcdFx0XHRhd2FpdCB0aW1lb3V0KDIwMDApXG5cdFx0XHRcdFx0Y29uc3QgeyBsaW50RXJyb3JzIH0gPSB0aGlzLl9nZXRMaW50RXJyb3JzKHVyaSlcblx0XHRcdFx0XHRyZXR1cm4geyBsaW50RXJyb3JzIH1cblx0XHRcdFx0fSlcblxuXHRcdFx0XHRyZXR1cm4geyByZXN1bHQ6IGxpbnRFcnJvcnNQcm9taXNlIH1cblx0XHRcdH0sXG5cdFx0XHQvLyAtLS1cblx0XHRcdHJ1bl9jb21tYW5kOiBhc3luYyAoeyBjb21tYW5kLCBjd2QsIHRlcm1pbmFsSWQgfSkgPT4ge1xuXHRcdFx0XHRjb25zdCB7IHJlc1Byb21pc2UsIGludGVycnVwdCB9ID0gYXdhaXQgdGhpcy50ZXJtaW5hbFRvb2xTZXJ2aWNlLnJ1bkNvbW1hbmQoY29tbWFuZCwgeyB0eXBlOiAndGVtcG9yYXJ5JywgY3dkLCB0ZXJtaW5hbElkIH0pXG5cdFx0XHRcdHJldHVybiB7IHJlc3VsdDogcmVzUHJvbWlzZSwgaW50ZXJydXB0VG9vbDogaW50ZXJydXB0IH1cblx0XHRcdH0sXG5cdFx0XHRydW5fcGVyc2lzdGVudF9jb21tYW5kOiBhc3luYyAoeyBjb21tYW5kLCBwZXJzaXN0ZW50VGVybWluYWxJZCB9KSA9PiB7XG5cdFx0XHRcdGNvbnN0IHsgcmVzUHJvbWlzZSwgaW50ZXJydXB0IH0gPSBhd2FpdCB0aGlzLnRlcm1pbmFsVG9vbFNlcnZpY2UucnVuQ29tbWFuZChjb21tYW5kLCB7IHR5cGU6ICdwZXJzaXN0ZW50JywgcGVyc2lzdGVudFRlcm1pbmFsSWQgfSlcblx0XHRcdFx0cmV0dXJuIHsgcmVzdWx0OiByZXNQcm9taXNlLCBpbnRlcnJ1cHRUb29sOiBpbnRlcnJ1cHQgfVxuXHRcdFx0fSxcblx0XHRcdG9wZW5fcGVyc2lzdGVudF90ZXJtaW5hbDogYXN5bmMgKHsgY3dkIH0pID0+IHtcblx0XHRcdFx0Y29uc3QgcGVyc2lzdGVudFRlcm1pbmFsSWQgPSBhd2FpdCB0aGlzLnRlcm1pbmFsVG9vbFNlcnZpY2UuY3JlYXRlUGVyc2lzdGVudFRlcm1pbmFsKHsgY3dkIH0pXG5cdFx0XHRcdHJldHVybiB7IHJlc3VsdDogeyBwZXJzaXN0ZW50VGVybWluYWxJZCB9IH1cblx0XHRcdH0sXG5cdFx0XHRraWxsX3BlcnNpc3RlbnRfdGVybWluYWw6IGFzeW5jICh7IHBlcnNpc3RlbnRUZXJtaW5hbElkIH0pID0+IHtcblx0XHRcdFx0Ly8gQ2xvc2UgdGhlIGJhY2tncm91bmQgdGVybWluYWwgYnkgc2VuZGluZyBleGl0XG5cdFx0XHRcdGF3YWl0IHRoaXMudGVybWluYWxUb29sU2VydmljZS5raWxsUGVyc2lzdGVudFRlcm1pbmFsKHBlcnNpc3RlbnRUZXJtaW5hbElkKVxuXHRcdFx0XHRyZXR1cm4geyByZXN1bHQ6IHt9IH1cblx0XHRcdH0sXG5cdFx0XHQvLyAtLS1cblx0XHRcdHBsY19nZXRfcHJvZ3JhbTogYXN5bmMgKCkgPT4ge1xuXHRcdFx0XHRjb25zdCByZXF1ZXN0SWQgPSBnZW5lcmF0ZVV1aWQoKVxuXHRcdFx0XHRjb25zdCByZXN1bHRQcm9taXNlID0gbmV3IFByb21pc2U8QnVpbHRpblRvb2xSZXN1bHRUeXBlWydwbGNfZ2V0X3Byb2dyYW0nXT4oKHJlc29sdmUsIHJlamVjdCkgPT4ge1xuXHRcdFx0XHRcdGNvbnN0IGhhbmRsZXIgPSAoZXZlbnQ6IE1lc3NhZ2VFdmVudCkgPT4ge1xuXHRcdFx0XHRcdFx0aWYgKGV2ZW50LmRhdGE/LnR5cGUgIT09ICd2b2x0OnBsYy1nZXQtcHJvZ3JhbS1yZXN1bHQnIHx8IGV2ZW50LmRhdGEucmVxdWVzdElkICE9PSByZXF1ZXN0SWQpIHJldHVyblxuXHRcdFx0XHRcdFx0d2luZG93LnJlbW92ZUV2ZW50TGlzdGVuZXIoJ21lc3NhZ2UnLCBoYW5kbGVyKVxuXHRcdFx0XHRcdFx0aWYgKGV2ZW50LmRhdGEub2spIHtcblx0XHRcdFx0XHRcdFx0cmVzb2x2ZSh7IHByb2dyYW06IGV2ZW50LmRhdGEucHJvZ3JhbSA/PyAne30nIH0pXG5cdFx0XHRcdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRcdFx0XHRyZWplY3QobmV3IEVycm9yKGV2ZW50LmRhdGEuZXJyb3IgPz8gJ3BsY19nZXRfcHJvZ3JhbSBmYWlsZWQnKSlcblx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0d2luZG93LmFkZEV2ZW50TGlzdGVuZXIoJ21lc3NhZ2UnLCBoYW5kbGVyKVxuXHRcdFx0XHRcdHNldFRpbWVvdXQoKCkgPT4ge1xuXHRcdFx0XHRcdFx0d2luZG93LnJlbW92ZUV2ZW50TGlzdGVuZXIoJ21lc3NhZ2UnLCBoYW5kbGVyKVxuXHRcdFx0XHRcdFx0cmVqZWN0KG5ldyBFcnJvcigncGxjX2dldF9wcm9ncmFtIHRpbWVkIG91dCBcdTIwMTQgUExDIGVkaXRvciBwYW5lbCBtYXkgbm90IGJlIG9wZW4nKSlcblx0XHRcdFx0XHR9LCAxMDAwMClcblx0XHRcdFx0fSlcblx0XHRcdFx0d2luZG93LnBvc3RNZXNzYWdlKHsgdHlwZTogJ3ZvbHQ6cGxjLWdldC1wcm9ncmFtJywgcmVxdWVzdElkIH0sICcqJylcblx0XHRcdFx0cmV0dXJuIHsgcmVzdWx0OiByZXN1bHRQcm9taXNlIH1cblx0XHRcdH0sXG5cdFx0XHRwbGNfdmFsaWRhdGU6IGFzeW5jICgpID0+IHtcblx0XHRcdFx0Y29uc3QgcmVxdWVzdElkID0gZ2VuZXJhdGVVdWlkKClcblx0XHRcdFx0Y29uc3QgcmVzdWx0UHJvbWlzZSA9IG5ldyBQcm9taXNlPEJ1aWx0aW5Ub29sUmVzdWx0VHlwZVsncGxjX3ZhbGlkYXRlJ10+KChyZXNvbHZlLCByZWplY3QpID0+IHtcblx0XHRcdFx0XHRjb25zdCBoYW5kbGVyID0gKGV2ZW50OiBNZXNzYWdlRXZlbnQpID0+IHtcblx0XHRcdFx0XHRcdGlmIChldmVudC5kYXRhPy50eXBlICE9PSAndm9sdDpwbGMtdmFsaWRhdGUtcmVzdWx0JyB8fCBldmVudC5kYXRhLnJlcXVlc3RJZCAhPT0gcmVxdWVzdElkKSByZXR1cm5cblx0XHRcdFx0XHRcdHdpbmRvdy5yZW1vdmVFdmVudExpc3RlbmVyKCdtZXNzYWdlJywgaGFuZGxlcilcblx0XHRcdFx0XHRcdGlmIChldmVudC5kYXRhLm9rKSB7XG5cdFx0XHRcdFx0XHRcdHJlc29sdmUoeyBpc3N1ZXM6IGV2ZW50LmRhdGEuaXNzdWVzID8/IFtdIH0pXG5cdFx0XHRcdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRcdFx0XHRyZWplY3QobmV3IEVycm9yKGV2ZW50LmRhdGEuZXJyb3IgPz8gJ3BsY192YWxpZGF0ZSBmYWlsZWQnKSlcblx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0d2luZG93LmFkZEV2ZW50TGlzdGVuZXIoJ21lc3NhZ2UnLCBoYW5kbGVyKVxuXHRcdFx0XHRcdHNldFRpbWVvdXQoKCkgPT4ge1xuXHRcdFx0XHRcdFx0d2luZG93LnJlbW92ZUV2ZW50TGlzdGVuZXIoJ21lc3NhZ2UnLCBoYW5kbGVyKVxuXHRcdFx0XHRcdFx0cmVqZWN0KG5ldyBFcnJvcigncGxjX3ZhbGlkYXRlIHRpbWVkIG91dCBcdTIwMTQgUExDIGVkaXRvciBwYW5lbCBtYXkgbm90IGJlIG9wZW4nKSlcblx0XHRcdFx0XHR9LCAxMDAwMClcblx0XHRcdFx0fSlcblx0XHRcdFx0d2luZG93LnBvc3RNZXNzYWdlKHsgdHlwZTogJ3ZvbHQ6cGxjLXZhbGlkYXRlJywgcmVxdWVzdElkIH0sICcqJylcblx0XHRcdFx0cmV0dXJuIHsgcmVzdWx0OiByZXN1bHRQcm9taXNlIH1cblx0XHRcdH0sXG5cdFx0XHRwbGNfd3JpdGVfcHJvZ3JhbTogYXN5bmMgKHsgcHJvZ3JhbUpzb24gfSkgPT4ge1xuXHRcdFx0XHRjb25zdCByZXF1ZXN0SWQgPSBnZW5lcmF0ZVV1aWQoKVxuXHRcdFx0XHRjb25zdCByZXN1bHRQcm9taXNlID0gbmV3IFByb21pc2U8QnVpbHRpblRvb2xSZXN1bHRUeXBlWydwbGNfd3JpdGVfcHJvZ3JhbSddPigocmVzb2x2ZSwgcmVqZWN0KSA9PiB7XG5cdFx0XHRcdFx0Y29uc3QgaGFuZGxlciA9IChldmVudDogTWVzc2FnZUV2ZW50KSA9PiB7XG5cdFx0XHRcdFx0XHRpZiAoZXZlbnQuZGF0YT8udHlwZSAhPT0gJ3ZvbHQ6cGxjLXdyaXRlLXByb2dyYW0tcmVzdWx0JyB8fCBldmVudC5kYXRhLnJlcXVlc3RJZCAhPT0gcmVxdWVzdElkKSByZXR1cm5cblx0XHRcdFx0XHRcdHdpbmRvdy5yZW1vdmVFdmVudExpc3RlbmVyKCdtZXNzYWdlJywgaGFuZGxlcilcblx0XHRcdFx0XHRcdGlmIChldmVudC5kYXRhLm9rKSB7XG5cdFx0XHRcdFx0XHRcdGNvbnN0IHBvdU5hbWU6IHN0cmluZyA9IGV2ZW50LmRhdGEucG91TmFtZSA/PyAnbWFpbidcblx0XHRcdFx0XHRcdFx0Y29uc3Qgc3RDb2RlOiBzdHJpbmcgPSBldmVudC5kYXRhLnN0Q29kZSA/PyAnJ1xuXHRcdFx0XHRcdFx0XHRjb25zdCBzdENvZGVGb3JTdHJ1Y3BwOiBzdHJpbmcgPSBldmVudC5kYXRhLnN0Q29kZUZvclN0cnVjcHAgPz8gJydcblxuXHRcdFx0XHRcdFx0XHQvLyBEZXRlcm1pbmUgcHJpbWFyeSBsYW5ndWFnZSBmcm9tIHdoYXQgd2FzIHByb3ZpZGVkIGluIHByb2dyYW1Kc29uXG5cdFx0XHRcdFx0XHRcdGxldCBwYXJzZWQ6IGFueSA9IHt9XG5cdFx0XHRcdFx0XHRcdHRyeSB7IHBhcnNlZCA9IEpTT04ucGFyc2UocHJvZ3JhbUpzb24pIH0gY2F0Y2ggeyAvKiBpZ25vcmUgKi8gfVxuXHRcdFx0XHRcdFx0XHRjb25zdCBoYXNGQkQgPSAhIXBhcnNlZC5mYmRQcm9ncmFtPy5ub2Rlcz8ubGVuZ3RoXG5cdFx0XHRcdFx0XHRcdGNvbnN0IGhhc1NGQyA9ICEhcGFyc2VkLnNmY1Byb2dyYW0/LnN0ZXBzPy5sZW5ndGhcblx0XHRcdFx0XHRcdFx0Y29uc3QgaGFzTEQgPSAhIXBhcnNlZC5sYWRkZXJQcm9ncmFtPy5ydW5ncz8ubGVuZ3RoXG5cblx0XHRcdFx0XHRcdFx0Ly8gUGVyc2lzdCBncmFwaGljYWwgc291cmNlIGZpbGVzIHRvIHdvcmtzcGFjZVxuXHRcdFx0XHRcdFx0XHRjb25zdCBmb2xkZXJzID0gd29ya3NwYWNlQ29udGV4dFNlcnZpY2UuZ2V0V29ya3NwYWNlKCkuZm9sZGVyc1xuXHRcdFx0XHRcdFx0XHRpZiAoZm9sZGVycy5sZW5ndGggPiAwKSB7XG5cdFx0XHRcdFx0XHRcdFx0Y29uc3QgYmFzZSA9IGZvbGRlcnNbMF0udXJpXG5cdFx0XHRcdFx0XHRcdFx0Y29uc3QgZW5jID0gbmV3IFRleHRFbmNvZGVyKClcblxuXHRcdFx0XHRcdFx0XHRcdGNvbnN0IHdyaXRlSWZOb25lbXB0eSA9IGFzeW5jIChzdWJQYXRoOiBzdHJpbmcsIGNvbnRlbnQ6IHN0cmluZykgPT4ge1xuXHRcdFx0XHRcdFx0XHRcdFx0aWYgKCFjb250ZW50IHx8IGNvbnRlbnQgPT09ICd7fScpIHJldHVyblxuXHRcdFx0XHRcdFx0XHRcdFx0Y29uc3QgdXJpID0gVVJJLmpvaW5QYXRoKGJhc2UsIHN1YlBhdGgpXG5cdFx0XHRcdFx0XHRcdFx0XHRhd2FpdCBmaWxlU2VydmljZS53cml0ZUZpbGUodXJpLCBlbmMuZW5jb2RlKGNvbnRlbnQpKVxuXHRcdFx0XHRcdFx0XHRcdH1cblxuXHRcdFx0XHRcdFx0XHRcdC8vIEFsd2F5cyB3cml0ZSBhbGwgdGhyZWUgZ3JhcGhpY2FsIGZvcm1hdHMgc28gdGhlIEV4cGxvcmVyIHNob3dzIHRoZW1cblx0XHRcdFx0XHRcdFx0XHRjb25zdCBsZEpzb24gPSBldmVudC5kYXRhLmxhZGRlclByb2dyYW1Kc29uID8/ICd7fSdcblx0XHRcdFx0XHRcdFx0XHRjb25zdCBmYmRKc29uID0gZXZlbnQuZGF0YS5mYmRQcm9ncmFtSnNvbiA/PyAne30nXG5cdFx0XHRcdFx0XHRcdFx0Y29uc3Qgc2ZjSnNvbiA9IGV2ZW50LmRhdGEuc2ZjUHJvZ3JhbUpzb24gPz8gJ3t9J1xuXHRcdFx0XHRcdFx0XHRcdHdyaXRlSWZOb25lbXB0eShgJHtwb3VOYW1lfS5sZC5qc29uYCwgbGRKc29uKVxuXHRcdFx0XHRcdFx0XHRcdHdyaXRlSWZOb25lbXB0eShgJHtwb3VOYW1lfS5mYmQuanNvbmAsIGZiZEpzb24pXG5cdFx0XHRcdFx0XHRcdFx0d3JpdGVJZk5vbmVtcHR5KGAke3BvdU5hbWV9LnNmYy5qc29uYCwgc2ZjSnNvbilcblxuXHRcdFx0XHRcdFx0XHRcdC8vIEFsd2F5cyB3cml0ZSB0aGUgY29tcGlsZWQgU1QgZmlsZSBcdTIwMTQgZXZlcnkgcHJvZ3JhbSBnZXRzIGEgLnN0IGV4cG9ydFxuXHRcdFx0XHRcdFx0XHRcdGlmIChzdENvZGUpIHtcblx0XHRcdFx0XHRcdFx0XHRcdGNvbnN0IHVyaSA9IFVSSS5qb2luUGF0aChiYXNlLCBgJHtwb3VOYW1lfS5zdGApXG5cdFx0XHRcdFx0XHRcdFx0XHRmaWxlU2VydmljZS53cml0ZUZpbGUodXJpLCBlbmMuZW5jb2RlKHN0Q29kZSkpLmNhdGNoKCgpID0+IHsgLyogbm9uLWZhdGFsICovIH0pXG5cdFx0XHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdFx0XHR9XG5cblx0XHRcdFx0XHRcdFx0cmVzb2x2ZSh7IG9rOiB0cnVlLCB2YWxpZGF0aW9uSXNzdWVzOiBldmVudC5kYXRhLnZhbGlkYXRpb25Jc3N1ZXMgPz8gW10sIHN0Q29kZSwgc3RDb2RlRm9yU3RydWNwcCwgcG91TmFtZSB9KVxuXHRcdFx0XHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0XHRcdFx0cmVqZWN0KG5ldyBFcnJvcihldmVudC5kYXRhLmVycm9yID8/ICdwbGNfd3JpdGVfcHJvZ3JhbSBmYWlsZWQnKSlcblx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0d2luZG93LmFkZEV2ZW50TGlzdGVuZXIoJ21lc3NhZ2UnLCBoYW5kbGVyKVxuXHRcdFx0XHRcdHNldFRpbWVvdXQoKCkgPT4ge1xuXHRcdFx0XHRcdFx0d2luZG93LnJlbW92ZUV2ZW50TGlzdGVuZXIoJ21lc3NhZ2UnLCBoYW5kbGVyKVxuXHRcdFx0XHRcdFx0cmVqZWN0KG5ldyBFcnJvcigncGxjX3dyaXRlX3Byb2dyYW0gdGltZWQgb3V0IFx1MjAxNCBQTEMgZWRpdG9yIHBhbmVsIG1heSBub3QgYmUgb3BlbicpKVxuXHRcdFx0XHRcdH0sIDE1MDAwKVxuXHRcdFx0XHR9KVxuXHRcdFx0XHR3aW5kb3cucG9zdE1lc3NhZ2UoeyB0eXBlOiAndm9sdDpwbGMtd3JpdGUtcHJvZ3JhbScsIHJlcXVlc3RJZCwgcHJvZ3JhbUpzb24gfSwgJyonKVxuXHRcdFx0XHRyZXR1cm4geyByZXN1bHQ6IHJlc3VsdFByb21pc2UgfVxuXHRcdFx0fSxcblx0XHRcdHBsY19zZXRfdGFnX2RhdGFiYXNlOiBhc3luYyAoeyB0YWdzSnNvbiB9KSA9PiB7XG5cdFx0XHRcdGNvbnN0IHJlcXVlc3RJZCA9IGdlbmVyYXRlVXVpZCgpXG5cdFx0XHRcdGNvbnN0IHJlc3VsdFByb21pc2UgPSBuZXcgUHJvbWlzZTxCdWlsdGluVG9vbFJlc3VsdFR5cGVbJ3BsY19zZXRfdGFnX2RhdGFiYXNlJ10+KChyZXNvbHZlLCByZWplY3QpID0+IHtcblx0XHRcdFx0XHRjb25zdCBoYW5kbGVyID0gKGV2ZW50OiBNZXNzYWdlRXZlbnQpID0+IHtcblx0XHRcdFx0XHRcdGlmIChldmVudC5kYXRhPy50eXBlICE9PSAndm9sdDpwbGMtc2V0LXRhZy1kYXRhYmFzZS1yZXN1bHQnIHx8IGV2ZW50LmRhdGEucmVxdWVzdElkICE9PSByZXF1ZXN0SWQpIHJldHVyblxuXHRcdFx0XHRcdFx0d2luZG93LnJlbW92ZUV2ZW50TGlzdGVuZXIoJ21lc3NhZ2UnLCBoYW5kbGVyKVxuXHRcdFx0XHRcdFx0aWYgKGV2ZW50LmRhdGEub2spIHtcblx0XHRcdFx0XHRcdFx0cmVzb2x2ZSh7IG9rOiB0cnVlLCB0YWdDb3VudDogZXZlbnQuZGF0YS50YWdDb3VudCA/PyAwIH0pXG5cdFx0XHRcdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRcdFx0XHRyZWplY3QobmV3IEVycm9yKGV2ZW50LmRhdGEuZXJyb3IgPz8gJ3BsY19zZXRfdGFnX2RhdGFiYXNlIGZhaWxlZCcpKVxuXHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdH1cblx0XHRcdFx0XHR3aW5kb3cuYWRkRXZlbnRMaXN0ZW5lcignbWVzc2FnZScsIGhhbmRsZXIpXG5cdFx0XHRcdFx0c2V0VGltZW91dCgoKSA9PiB7XG5cdFx0XHRcdFx0XHR3aW5kb3cucmVtb3ZlRXZlbnRMaXN0ZW5lcignbWVzc2FnZScsIGhhbmRsZXIpXG5cdFx0XHRcdFx0XHRyZWplY3QobmV3IEVycm9yKCdwbGNfc2V0X3RhZ19kYXRhYmFzZSB0aW1lZCBvdXQgXHUyMDE0IFBMQyBlZGl0b3IgcGFuZWwgbWF5IG5vdCBiZSBvcGVuJykpXG5cdFx0XHRcdFx0fSwgMTAwMDApXG5cdFx0XHRcdH0pXG5cdFx0XHRcdHdpbmRvdy5wb3N0TWVzc2FnZSh7IHR5cGU6ICd2b2x0OnBsYy1zZXQtdGFnLWRhdGFiYXNlJywgcmVxdWVzdElkLCB0YWdzSnNvbiB9LCAnKicpXG5cdFx0XHRcdHJldHVybiB7IHJlc3VsdDogcmVzdWx0UHJvbWlzZSB9XG5cdFx0XHR9LFxuXHRcdFx0cGxjX2V4cG9ydF9zdDogYXN5bmMgKCkgPT4ge1xuXHRcdFx0XHRjb25zdCByZXF1ZXN0SWQgPSBnZW5lcmF0ZVV1aWQoKVxuXHRcdFx0XHRjb25zdCByZXN1bHRQcm9taXNlID0gbmV3IFByb21pc2U8QnVpbHRpblRvb2xSZXN1bHRUeXBlWydwbGNfZXhwb3J0X3N0J10+KChyZXNvbHZlLCByZWplY3QpID0+IHtcblx0XHRcdFx0XHRjb25zdCBoYW5kbGVyID0gKGV2ZW50OiBNZXNzYWdlRXZlbnQpID0+IHtcblx0XHRcdFx0XHRcdGlmIChldmVudC5kYXRhPy50eXBlICE9PSAndm9sdDpwbGMtZXhwb3J0LXN0LXJlc3VsdCcgfHwgZXZlbnQuZGF0YS5yZXF1ZXN0SWQgIT09IHJlcXVlc3RJZCkgcmV0dXJuXG5cdFx0XHRcdFx0XHR3aW5kb3cucmVtb3ZlRXZlbnRMaXN0ZW5lcignbWVzc2FnZScsIGhhbmRsZXIpXG5cdFx0XHRcdFx0XHRpZiAoZXZlbnQuZGF0YS5vaykge1xuXHRcdFx0XHRcdFx0XHRjb25zdCBwb3VOYW1lOiBzdHJpbmcgPSBldmVudC5kYXRhLnBvdU5hbWUgPz8gJ21haW4nXG5cdFx0XHRcdFx0XHRcdGNvbnN0IHN0Q29kZTogc3RyaW5nID0gZXZlbnQuZGF0YS5zdENvZGUgPz8gJydcblx0XHRcdFx0XHRcdFx0Y29uc3Qgc3RDb2RlRm9yU3RydWNwcDogc3RyaW5nID0gZXZlbnQuZGF0YS5zdENvZGVGb3JTdHJ1Y3BwID8/ICcnXG5cdFx0XHRcdFx0XHRcdGNvbnN0IGZpbGVOYW1lID0gYCR7cG91TmFtZX0uc3RgXG5cblx0XHRcdFx0XHRcdFx0Ly8gUGVyc2lzdCB0byB3b3Jrc3BhY2Vcblx0XHRcdFx0XHRcdFx0Y29uc3QgZm9sZGVycyA9IHdvcmtzcGFjZUNvbnRleHRTZXJ2aWNlLmdldFdvcmtzcGFjZSgpLmZvbGRlcnNcblx0XHRcdFx0XHRcdFx0aWYgKGZvbGRlcnMubGVuZ3RoID4gMCAmJiBzdENvZGUpIHtcblx0XHRcdFx0XHRcdFx0XHRjb25zdCB1cmkgPSBVUkkuam9pblBhdGgoZm9sZGVyc1swXS51cmksIGZpbGVOYW1lKVxuXHRcdFx0XHRcdFx0XHRcdGNvbnN0IGVuYyA9IG5ldyBUZXh0RW5jb2RlcigpXG5cdFx0XHRcdFx0XHRcdFx0ZmlsZVNlcnZpY2Uud3JpdGVGaWxlKHVyaSwgZW5jLmVuY29kZShzdENvZGUpKS5jYXRjaCgoKSA9PiB7IC8qIG5vbi1mYXRhbCAqLyB9KVxuXHRcdFx0XHRcdFx0XHR9XG5cblx0XHRcdFx0XHRcdFx0cmVzb2x2ZSh7IHN0Q29kZSwgc3RDb2RlRm9yU3RydWNwcCwgcG91TmFtZSwgZmlsZU5hbWUgfSlcblx0XHRcdFx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdFx0XHRcdHJlamVjdChuZXcgRXJyb3IoZXZlbnQuZGF0YS5lcnJvciA/PyAncGxjX2V4cG9ydF9zdCBmYWlsZWQnKSlcblx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0d2luZG93LmFkZEV2ZW50TGlzdGVuZXIoJ21lc3NhZ2UnLCBoYW5kbGVyKVxuXHRcdFx0XHRcdHNldFRpbWVvdXQoKCkgPT4ge1xuXHRcdFx0XHRcdFx0d2luZG93LnJlbW92ZUV2ZW50TGlzdGVuZXIoJ21lc3NhZ2UnLCBoYW5kbGVyKVxuXHRcdFx0XHRcdFx0cmVqZWN0KG5ldyBFcnJvcigncGxjX2V4cG9ydF9zdCB0aW1lZCBvdXQgXHUyMDE0IFBMQyBlZGl0b3IgcGFuZWwgbWF5IG5vdCBiZSBvcGVuJykpXG5cdFx0XHRcdFx0fSwgMTUwMDApXG5cdFx0XHRcdH0pXG5cdFx0XHRcdHdpbmRvdy5wb3N0TWVzc2FnZSh7IHR5cGU6ICd2b2x0OnBsYy1leHBvcnQtc3QnLCByZXF1ZXN0SWQgfSwgJyonKVxuXHRcdFx0XHRyZXR1cm4geyByZXN1bHQ6IHJlc3VsdFByb21pc2UgfVxuXHRcdFx0fSxcblx0XHRcdHBsY19leHBvcnRfdmVuZG9yOiBhc3luYyAoeyBmb3JtYXQgfSkgPT4ge1xuXHRcdFx0XHRjb25zdCByZXF1ZXN0SWQgPSBnZW5lcmF0ZVV1aWQoKVxuXHRcdFx0XHRjb25zdCByZXN1bHRQcm9taXNlID0gbmV3IFByb21pc2U8QnVpbHRpblRvb2xSZXN1bHRUeXBlWydwbGNfZXhwb3J0X3ZlbmRvciddPigocmVzb2x2ZSwgcmVqZWN0KSA9PiB7XG5cdFx0XHRcdFx0Y29uc3QgaGFuZGxlciA9IChldmVudDogTWVzc2FnZUV2ZW50KSA9PiB7XG5cdFx0XHRcdFx0XHRpZiAoZXZlbnQuZGF0YT8udHlwZSAhPT0gJ3ZvbHQ6cGxjLWV4cG9ydC12ZW5kb3ItcmVzdWx0JyB8fCBldmVudC5kYXRhLnJlcXVlc3RJZCAhPT0gcmVxdWVzdElkKSByZXR1cm5cblx0XHRcdFx0XHRcdHdpbmRvdy5yZW1vdmVFdmVudExpc3RlbmVyKCdtZXNzYWdlJywgaGFuZGxlcilcblx0XHRcdFx0XHRcdGlmIChldmVudC5kYXRhLm9rKSB7XG5cdFx0XHRcdFx0XHRcdHJlc29sdmUoe1xuXHRcdFx0XHRcdFx0XHRcdGNvbnRlbnQ6IGV2ZW50LmRhdGEuY29udGVudCA/PyAnJyxcblx0XHRcdFx0XHRcdFx0XHRmb3JtYXQ6IGV2ZW50LmRhdGEuZm9ybWF0ID8/IGZvcm1hdCxcblx0XHRcdFx0XHRcdFx0XHRmaWxlTmFtZTogZXZlbnQuZGF0YS5maWxlTmFtZSA/PyBgcHJvZ3JhbS4ke2Zvcm1hdC50b0xvd2VyQ2FzZSgpfS54bWxgLFxuXHRcdFx0XHRcdFx0XHR9KVxuXHRcdFx0XHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0XHRcdFx0cmVqZWN0KG5ldyBFcnJvcihldmVudC5kYXRhLmVycm9yID8/ICdwbGNfZXhwb3J0X3ZlbmRvciBmYWlsZWQnKSlcblx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0d2luZG93LmFkZEV2ZW50TGlzdGVuZXIoJ21lc3NhZ2UnLCBoYW5kbGVyKVxuXHRcdFx0XHRcdHNldFRpbWVvdXQoKCkgPT4ge1xuXHRcdFx0XHRcdFx0d2luZG93LnJlbW92ZUV2ZW50TGlzdGVuZXIoJ21lc3NhZ2UnLCBoYW5kbGVyKVxuXHRcdFx0XHRcdFx0cmVqZWN0KG5ldyBFcnJvcigncGxjX2V4cG9ydF92ZW5kb3IgdGltZWQgb3V0IFx1MjAxNCBQTEMgZWRpdG9yIHBhbmVsIG1heSBub3QgYmUgb3BlbicpKVxuXHRcdFx0XHRcdH0sIDE1MDAwKVxuXHRcdFx0XHR9KVxuXHRcdFx0XHR3aW5kb3cucG9zdE1lc3NhZ2UoeyB0eXBlOiAndm9sdDpwbGMtZXhwb3J0LXZlbmRvcicsIHJlcXVlc3RJZCwgZm9ybWF0IH0sICcqJylcblx0XHRcdFx0cmV0dXJuIHsgcmVzdWx0OiByZXN1bHRQcm9taXNlIH1cblx0XHRcdH0sXG5cdFx0XHRwbGNfY29udmVydF9sYW5ndWFnZTogYXN5bmMgKHsgZnJvbSwgdG8gfSkgPT4ge1xuXHRcdFx0XHQvLyBJZiB0YXJnZXQgaXMgU1QsIHVzZSB0aGUgZGVkaWNhdGVkIGV4cG9ydC1zdCBwYXRoXG5cdFx0XHRcdGlmICh0byA9PT0gJ1NUJykge1xuXHRcdFx0XHRcdGNvbnN0IGV4cG9ydFJlcXVlc3RJZCA9IGdlbmVyYXRlVXVpZCgpXG5cdFx0XHRcdFx0Y29uc3QgZXhwb3J0UHJvbWlzZSA9IG5ldyBQcm9taXNlPEJ1aWx0aW5Ub29sUmVzdWx0VHlwZVsncGxjX2NvbnZlcnRfbGFuZ3VhZ2UnXT4oKHJlc29sdmUsIHJlamVjdCkgPT4ge1xuXHRcdFx0XHRcdFx0Y29uc3QgaGFuZGxlciA9IChldmVudDogTWVzc2FnZUV2ZW50KSA9PiB7XG5cdFx0XHRcdFx0XHRcdGlmIChldmVudC5kYXRhPy50eXBlICE9PSAndm9sdDpwbGMtZXhwb3J0LXN0LXJlc3VsdCcgfHwgZXZlbnQuZGF0YS5yZXF1ZXN0SWQgIT09IGV4cG9ydFJlcXVlc3RJZCkgcmV0dXJuXG5cdFx0XHRcdFx0XHRcdHdpbmRvdy5yZW1vdmVFdmVudExpc3RlbmVyKCdtZXNzYWdlJywgaGFuZGxlcilcblx0XHRcdFx0XHRcdFx0aWYgKGV2ZW50LmRhdGEub2spIHtcblx0XHRcdFx0XHRcdFx0XHRjb25zdCBwb3VOYW1lOiBzdHJpbmcgPSBldmVudC5kYXRhLnBvdU5hbWUgPz8gJ21haW4nXG5cdFx0XHRcdFx0XHRcdFx0Y29uc3Qgc3RDb2RlOiBzdHJpbmcgPSBldmVudC5kYXRhLnN0Q29kZSA/PyAnJ1xuXHRcdFx0XHRcdFx0XHRcdC8vIFBlcnNpc3QgLnN0IGZpbGUgdG8gd29ya3NwYWNlXG5cdFx0XHRcdFx0XHRcdFx0Y29uc3QgZm9sZGVycyA9IHdvcmtzcGFjZUNvbnRleHRTZXJ2aWNlLmdldFdvcmtzcGFjZSgpLmZvbGRlcnNcblx0XHRcdFx0XHRcdFx0XHRpZiAoZm9sZGVycy5sZW5ndGggPiAwICYmIHN0Q29kZSkge1xuXHRcdFx0XHRcdFx0XHRcdFx0Y29uc3QgdXJpID0gVVJJLmpvaW5QYXRoKGZvbGRlcnNbMF0udXJpLCBgJHtwb3VOYW1lfS5zdGApXG5cdFx0XHRcdFx0XHRcdFx0XHRjb25zdCBlbmMgPSBuZXcgVGV4dEVuY29kZXIoKVxuXHRcdFx0XHRcdFx0XHRcdFx0ZmlsZVNlcnZpY2Uud3JpdGVGaWxlKHVyaSwgZW5jLmVuY29kZShzdENvZGUpKS5jYXRjaCgoKSA9PiB7IC8qIG5vbi1mYXRhbCAqLyB9KVxuXHRcdFx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHRcdFx0XHRjb25zdCBndWlkYW5jZSA9IGBUaGUgJHtmcm9tfSBwcm9ncmFtIGhhcyBiZWVuIGNvbXBpbGVkIHRvIElFQyA2MTEzMS0zIFN0cnVjdHVyZWQgVGV4dCBhbmQgc2F2ZWQgYXMgJHtwb3VOYW1lfS5zdC4gYCArXG5cdFx0XHRcdFx0XHRcdFx0XHRgUmV2aWV3IHRoZSBTVCBjb2RlIGFib3ZlLiBZb3UgY2FuIGVkaXQgaXQgZGlyZWN0bHkgdXNpbmcgcmV3cml0ZV9maWxlIGlmIGNoYW5nZXMgYXJlIG5lZWRlZC4gYCArXG5cdFx0XHRcdFx0XHRcdFx0XHRgVG8gZGVwbG95IHRvIGEgUExDIHJ1bnRpbWUsIHVzZSB0aGUgLnN0IGZpbGUgZGlyZWN0bHkgXHUyMDE0IGl0IGlzIHZhbGlkIE1hdElFQy9PcGVuUExDIFNULmBcblx0XHRcdFx0XHRcdFx0XHRyZXNvbHZlKHsgc291cmNlUHJvZ3JhbTogc3RDb2RlLCB0YXJnZXRMYW5ndWFnZTogJ1NUJywgZ3VpZGFuY2UgfSlcblx0XHRcdFx0XHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0XHRcdFx0XHRyZWplY3QobmV3IEVycm9yKGV2ZW50LmRhdGEuZXJyb3IgPz8gJ3BsY19jb252ZXJ0X2xhbmd1YWdlIHRvIFNUIGZhaWxlZCcpKVxuXHRcdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0XHR3aW5kb3cuYWRkRXZlbnRMaXN0ZW5lcignbWVzc2FnZScsIGhhbmRsZXIpXG5cdFx0XHRcdFx0XHRzZXRUaW1lb3V0KCgpID0+IHtcblx0XHRcdFx0XHRcdFx0d2luZG93LnJlbW92ZUV2ZW50TGlzdGVuZXIoJ21lc3NhZ2UnLCBoYW5kbGVyKVxuXHRcdFx0XHRcdFx0XHRyZWplY3QobmV3IEVycm9yKCdwbGNfY29udmVydF9sYW5ndWFnZSAoU1QpIHRpbWVkIG91dCBcdTIwMTQgUExDIGVkaXRvciBwYW5lbCBtYXkgbm90IGJlIG9wZW4nKSlcblx0XHRcdFx0XHRcdH0sIDE1MDAwKVxuXHRcdFx0XHRcdH0pXG5cdFx0XHRcdFx0d2luZG93LnBvc3RNZXNzYWdlKHsgdHlwZTogJ3ZvbHQ6cGxjLWV4cG9ydC1zdCcsIHJlcXVlc3RJZDogZXhwb3J0UmVxdWVzdElkIH0sICcqJylcblx0XHRcdFx0XHRyZXR1cm4geyByZXN1bHQ6IGV4cG9ydFByb21pc2UgfVxuXHRcdFx0XHR9XG5cblx0XHRcdFx0Ly8gRm9yIGdyYXBoaWNhbC10by1ncmFwaGljYWwgY29udmVyc2lvbnM6IHJlYWQgc291cmNlIHByb2dyYW0gYW5kIGd1aWRlIEFJIHRvIHJld3JpdGVcblx0XHRcdFx0Y29uc3QgcmVxdWVzdElkID0gZ2VuZXJhdGVVdWlkKClcblx0XHRcdFx0Y29uc3QgcmVzdWx0UHJvbWlzZSA9IG5ldyBQcm9taXNlPEJ1aWx0aW5Ub29sUmVzdWx0VHlwZVsncGxjX2NvbnZlcnRfbGFuZ3VhZ2UnXT4oKHJlc29sdmUsIHJlamVjdCkgPT4ge1xuXHRcdFx0XHRcdGNvbnN0IGhhbmRsZXIgPSAoZXZlbnQ6IE1lc3NhZ2VFdmVudCkgPT4ge1xuXHRcdFx0XHRcdFx0aWYgKGV2ZW50LmRhdGE/LnR5cGUgIT09ICd2b2x0OnBsYy1nZXQtcHJvZ3JhbS1yZXN1bHQnIHx8IGV2ZW50LmRhdGEucmVxdWVzdElkICE9PSByZXF1ZXN0SWQpIHJldHVyblxuXHRcdFx0XHRcdFx0d2luZG93LnJlbW92ZUV2ZW50TGlzdGVuZXIoJ21lc3NhZ2UnLCBoYW5kbGVyKVxuXHRcdFx0XHRcdFx0aWYgKGV2ZW50LmRhdGEub2spIHtcblx0XHRcdFx0XHRcdFx0Y29uc3QgcHJvZ3JhbSA9IGV2ZW50LmRhdGEucHJvZ3JhbSA/PyAne30nXG5cdFx0XHRcdFx0XHRcdGNvbnN0IGd1aWRhbmNlID0gYENvbnZlcnQgdGhlICR7ZnJvbX0gcHJvZ3JhbSBhYm92ZSB0byAke3RvfSBmb3JtYXQgdXNpbmcgdGhlIFBsYXhpbyBzY2hlbWEgcnVsZXMuIGAgK1xuXHRcdFx0XHRcdFx0XHRcdGBQcmVzZXJ2ZSBhbGwgdGFnIG5hbWVzIGV4YWN0bHkuIENhbGwgcGxjX3dyaXRlX3Byb2dyYW0gd2l0aCB0aGUgY29udmVydGVkICR7dG99IHByb2dyYW0sIGAgK1xuXHRcdFx0XHRcdFx0XHRcdGB0aGVuIHNhdmUgaXQgYXMgYSAuJHt0by50b0xvd2VyQ2FzZSgpfS5qc29uIGZpbGUgdXNpbmcgcmV3cml0ZV9maWxlLmBcblx0XHRcdFx0XHRcdFx0cmVzb2x2ZSh7IHNvdXJjZVByb2dyYW06IHByb2dyYW0sIHRhcmdldExhbmd1YWdlOiB0bywgZ3VpZGFuY2UgfSlcblx0XHRcdFx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdFx0XHRcdHJlamVjdChuZXcgRXJyb3IoZXZlbnQuZGF0YS5lcnJvciA/PyAncGxjX2NvbnZlcnRfbGFuZ3VhZ2UgZmFpbGVkJykpXG5cdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHRcdHdpbmRvdy5hZGRFdmVudExpc3RlbmVyKCdtZXNzYWdlJywgaGFuZGxlcilcblx0XHRcdFx0XHRzZXRUaW1lb3V0KCgpID0+IHtcblx0XHRcdFx0XHRcdHdpbmRvdy5yZW1vdmVFdmVudExpc3RlbmVyKCdtZXNzYWdlJywgaGFuZGxlcilcblx0XHRcdFx0XHRcdHJlamVjdChuZXcgRXJyb3IoJ3BsY19jb252ZXJ0X2xhbmd1YWdlIHRpbWVkIG91dCBcdTIwMTQgUExDIGVkaXRvciBwYW5lbCBtYXkgbm90IGJlIG9wZW4nKSlcblx0XHRcdFx0XHR9LCAxMDAwMClcblx0XHRcdFx0fSlcblx0XHRcdFx0d2luZG93LnBvc3RNZXNzYWdlKHsgdHlwZTogJ3ZvbHQ6cGxjLWdldC1wcm9ncmFtJywgcmVxdWVzdElkIH0sICcqJylcblx0XHRcdFx0cmV0dXJuIHsgcmVzdWx0OiByZXN1bHRQcm9taXNlIH1cblx0XHRcdH0sXG5cdFx0XHQvLyAtLS1cblx0XHRcdGltcG9ydF92ZW5kb3JfZmlsZTogYXN5bmMgKHsgdXJpIH0pID0+IHtcblx0XHRcdFx0Y29uc3QgZmlsZUNvbnRlbnQgPSBhd2FpdCBmaWxlU2VydmljZS5yZWFkRmlsZSh1cmkpXG5cdFx0XHRcdGNvbnN0IHhtbENvbnRlbnQgPSBmaWxlQ29udGVudC52YWx1ZS50b1N0cmluZygpXG5cdFx0XHRcdGNvbnN0IGZpbGVuYW1lID0gdXJpLnBhdGguc3BsaXQoJy8nKS5wb3AoKSA/PyAnJ1xuXHRcdFx0XHRjb25zdCByZXF1ZXN0SWQgPSBnZW5lcmF0ZVV1aWQoKVxuXHRcdFx0XHRjb25zdCByZXN1bHRQcm9taXNlID0gbmV3IFByb21pc2U8QnVpbHRpblRvb2xSZXN1bHRUeXBlWydpbXBvcnRfdmVuZG9yX2ZpbGUnXT4oKHJlc29sdmUsIHJlamVjdCkgPT4ge1xuXHRcdFx0XHRcdGNvbnN0IGhhbmRsZXIgPSAoZXZlbnQ6IE1lc3NhZ2VFdmVudCkgPT4ge1xuXHRcdFx0XHRcdFx0aWYgKGV2ZW50LmRhdGE/LnR5cGUgIT09ICd2b2x0OmltcG9ydC12ZW5kb3ItZmlsZS1yZXN1bHQnIHx8IGV2ZW50LmRhdGEucmVxdWVzdElkICE9PSByZXF1ZXN0SWQpIHJldHVyblxuXHRcdFx0XHRcdFx0d2luZG93LnJlbW92ZUV2ZW50TGlzdGVuZXIoJ21lc3NhZ2UnLCBoYW5kbGVyKVxuXHRcdFx0XHRcdFx0aWYgKGV2ZW50LmRhdGEub2sgJiYgZXZlbnQuZGF0YS5yZXN1bHQpIHtcblx0XHRcdFx0XHRcdFx0Y29uc3QgciA9IGV2ZW50LmRhdGEucmVzdWx0XG5cdFx0XHRcdFx0XHRcdHJlc29sdmUoe1xuXHRcdFx0XHRcdFx0XHRcdHByb2plY3ROYW1lOiByLnByb2plY3ROYW1lID8/IGZpbGVuYW1lLFxuXHRcdFx0XHRcdFx0XHRcdHBvdUNvdW50OiByLnBvdUNvdW50ID8/IDAsXG5cdFx0XHRcdFx0XHRcdFx0dGFnQ291bnQ6IHIudGFnQ291bnQgPz8gMCxcblx0XHRcdFx0XHRcdFx0XHR1bm1hcHBlZENvdW50OiByLnVubWFwcGVkQ291bnQgPz8gMCxcblx0XHRcdFx0XHRcdFx0XHR3YXJuaW5nczogci53YXJuaW5ncyA/PyBbXSxcblx0XHRcdFx0XHRcdFx0fSlcblx0XHRcdFx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdFx0XHRcdHJlamVjdChuZXcgRXJyb3IoZXZlbnQuZGF0YS5lcnJvciA/PyAnSW1wb3J0IGZhaWxlZCcpKVxuXHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdH1cblx0XHRcdFx0XHR3aW5kb3cuYWRkRXZlbnRMaXN0ZW5lcignbWVzc2FnZScsIGhhbmRsZXIpXG5cdFx0XHRcdFx0c2V0VGltZW91dCgoKSA9PiB7XG5cdFx0XHRcdFx0XHR3aW5kb3cucmVtb3ZlRXZlbnRMaXN0ZW5lcignbWVzc2FnZScsIGhhbmRsZXIpXG5cdFx0XHRcdFx0XHRyZWplY3QobmV3IEVycm9yKCdJbXBvcnQgdGltZWQgb3V0IFx1MjAxNCBQTEMgZWRpdG9yIHBhbmVsIG1heSBub3QgYmUgb3BlbicpKVxuXHRcdFx0XHRcdH0sIDMwMDAwKVxuXHRcdFx0XHR9KVxuXHRcdFx0XHR3aW5kb3cucG9zdE1lc3NhZ2UoeyB0eXBlOiAndm9sdDppbXBvcnQtdmVuZG9yLWZpbGUnLCByZXF1ZXN0SWQsIHhtbENvbnRlbnQsIGZpbGVuYW1lLCBmaWxlUGF0aDogdXJpLmZzUGF0aCB9LCAnKicpXG5cdFx0XHRcdHJldHVybiB7IHJlc3VsdDogcmVzdWx0UHJvbWlzZSB9XG5cdFx0XHR9LFxuXG5cdFx0XHRmdXhhX2dlbmVyYXRlX3ZpZXc6IGFzeW5jICh7IHBvdU5hbWUgfSkgPT4ge1xuXHRcdFx0XHRjb25zdCByZXF1ZXN0SWQgPSBnZW5lcmF0ZVV1aWQoKVxuXHRcdFx0XHRjb25zdCByZXN1bHRQcm9taXNlID0gbmV3IFByb21pc2U8QnVpbHRpblRvb2xSZXN1bHRUeXBlWydmdXhhX2dlbmVyYXRlX3ZpZXcnXT4oKHJlc29sdmUsIHJlamVjdCkgPT4ge1xuXHRcdFx0XHRcdGNvbnN0IGhhbmRsZXIgPSAoZXZlbnQ6IE1lc3NhZ2VFdmVudCkgPT4ge1xuXHRcdFx0XHRcdFx0aWYgKGV2ZW50LmRhdGE/LnR5cGUgIT09ICd2b2x0OmZ1eGEtZ2VuZXJhdGUtdmlldy1yZXN1bHQnIHx8IGV2ZW50LmRhdGEucmVxdWVzdElkICE9PSByZXF1ZXN0SWQpIHJldHVyblxuXHRcdFx0XHRcdFx0d2luZG93LnJlbW92ZUV2ZW50TGlzdGVuZXIoJ21lc3NhZ2UnLCBoYW5kbGVyKVxuXHRcdFx0XHRcdFx0aWYgKGV2ZW50LmRhdGEub2spIHtcblx0XHRcdFx0XHRcdFx0cmVzb2x2ZSh7IG9rOiB0cnVlLCB2aWV3TmFtZTogZXZlbnQuZGF0YS52aWV3TmFtZSA/PyBwb3VOYW1lID8/ICdtYWluJyB9KVxuXHRcdFx0XHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0XHRcdFx0cmVqZWN0KG5ldyBFcnJvcihldmVudC5kYXRhLmVycm9yID8/ICdmdXhhX2dlbmVyYXRlX3ZpZXcgZmFpbGVkJykpXG5cdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHRcdHdpbmRvdy5hZGRFdmVudExpc3RlbmVyKCdtZXNzYWdlJywgaGFuZGxlcilcblx0XHRcdFx0XHRzZXRUaW1lb3V0KCgpID0+IHtcblx0XHRcdFx0XHRcdHdpbmRvdy5yZW1vdmVFdmVudExpc3RlbmVyKCdtZXNzYWdlJywgaGFuZGxlcilcblx0XHRcdFx0XHRcdHJlamVjdChuZXcgRXJyb3IoJ2Z1eGFfZ2VuZXJhdGVfdmlldyB0aW1lZCBvdXQnKSlcblx0XHRcdFx0XHR9LCAzMDAwMClcblx0XHRcdFx0fSlcblx0XHRcdFx0d2luZG93LnBvc3RNZXNzYWdlKHsgdHlwZTogJ3ZvbHQ6ZnV4YS1nZW5lcmF0ZS12aWV3JywgcmVxdWVzdElkLCBwb3VOYW1lIH0sICcqJylcblx0XHRcdFx0cmV0dXJuIHsgcmVzdWx0OiByZXN1bHRQcm9taXNlIH1cblx0XHRcdH0sXG5cdFx0XHRmdXhhX2dldF9wcm9qZWN0OiBhc3luYyAoKSA9PiB7XG5cdFx0XHRcdGNvbnN0IHJlcyA9IGF3YWl0IGZldGNoKCdodHRwOi8vMTI3LjAuMC4xOjE4ODEvYXBpL3Byb2plY3QnKVxuXHRcdFx0XHRpZiAoIXJlcy5vaykgdGhyb3cgbmV3IEVycm9yKGBGVVhBIEdFVCAvYXBpL3Byb2plY3QgXHUyMTkyICR7cmVzLnN0YXR1c31gKVxuXHRcdFx0XHRjb25zdCBwcm9qZWN0ID0gYXdhaXQgcmVzLmpzb24oKVxuXHRcdFx0XHRyZXR1cm4geyByZXN1bHQ6IHsgcHJvamVjdDogSlNPTi5zdHJpbmdpZnkocHJvamVjdCkgfSB9XG5cdFx0XHR9LFxuXG5cdFx0XHRmdXhhX3NhdmVfdmlldzogYXN5bmMgKHsgdmlld0pzb24gfSkgPT4ge1xuXHRcdFx0XHRjb25zdCB2aWV3ID0gSlNPTi5wYXJzZSh2aWV3SnNvbilcblx0XHRcdFx0aWYgKCF2aWV3LmlkKSB2aWV3LmlkID0gJ3ZpZXdfJyArIE1hdGgucmFuZG9tKCkudG9TdHJpbmcoMzYpLnNsaWNlKDIsIDEwKVxuXHRcdFx0XHRpZiAoIXZpZXcubmFtZSkgdGhyb3cgbmV3IEVycm9yKCd2aWV3Lm5hbWUgaXMgcmVxdWlyZWQnKVxuXHRcdFx0XHQvLyBHRVQgY3VycmVudCBwcm9qZWN0LCB1cHNlcnQgdmlldywgUE9TVCBiYWNrXG5cdFx0XHRcdGNvbnN0IGdldFJlcyA9IGF3YWl0IGZldGNoKCdodHRwOi8vMTI3LjAuMC4xOjE4ODEvYXBpL3Byb2plY3QnKVxuXHRcdFx0XHRpZiAoIWdldFJlcy5vaykgdGhyb3cgbmV3IEVycm9yKGBGVVhBIEdFVCAvYXBpL3Byb2plY3QgXHUyMTkyICR7Z2V0UmVzLnN0YXR1c31gKVxuXHRcdFx0XHRjb25zdCBwcm9qZWN0ID0gYXdhaXQgZ2V0UmVzLmpzb24oKVxuXHRcdFx0XHRjb25zdCBobWkgPSBwcm9qZWN0LmhtaSA/PyBwcm9qZWN0XG5cdFx0XHRcdGlmICghaG1pLnZpZXdzKSBobWkudmlld3MgPSBbXVxuXHRcdFx0XHRjb25zdCBleGlzdGluZ0lkeCA9IGhtaS52aWV3cy5maW5kSW5kZXgoKHY6IGFueSkgPT4gdi5pZCA9PT0gdmlldy5pZCB8fCB2Lm5hbWUgPT09IHZpZXcubmFtZSlcblx0XHRcdFx0aWYgKGV4aXN0aW5nSWR4ID49IDApIHtcblx0XHRcdFx0XHRobWkudmlld3NbZXhpc3RpbmdJZHhdID0gdmlld1xuXHRcdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRcdGhtaS52aWV3cy5wdXNoKHZpZXcpXG5cdFx0XHRcdH1cblx0XHRcdFx0Ly8gU2V0IHRoaXMgdmlldyBhcyB0aGUgc3RhcnQvaG9tZSB2aWV3IHNvIGl0IHNob3dzIGltbWVkaWF0ZWx5XG5cdFx0XHRcdGlmIChobWkubGF5b3V0KSBobWkubGF5b3V0LnN0YXJ0ID0gdmlldy5pZFxuXHRcdFx0XHRjb25zdCBwb3N0UmVzID0gYXdhaXQgZmV0Y2goJ2h0dHA6Ly8xMjcuMC4wLjE6MTg4MS9hcGkvcHJvamVjdCcsIHtcblx0XHRcdFx0XHRtZXRob2Q6ICdQT1NUJyxcblx0XHRcdFx0XHRoZWFkZXJzOiB7ICdDb250ZW50LVR5cGUnOiAnYXBwbGljYXRpb24vanNvbicgfSxcblx0XHRcdFx0XHRib2R5OiBKU09OLnN0cmluZ2lmeShwcm9qZWN0KSxcblx0XHRcdFx0fSlcblx0XHRcdFx0aWYgKCFwb3N0UmVzLm9rKSB0aHJvdyBuZXcgRXJyb3IoYEZVWEEgUE9TVCAvYXBpL3Byb2plY3QgXHUyMTkyICR7cG9zdFJlcy5zdGF0dXN9YClcblx0XHRcdFx0cmV0dXJuIHsgcmVzdWx0OiB7IHZpZXdJZDogdmlldy5pZCwgdmlld05hbWU6IHZpZXcubmFtZSB9IH1cblx0XHRcdH0sXG5cblx0XHRcdGZ1eGFfc2V0X3RhZ192YWx1ZTogYXN5bmMgKHsgdGFnTmFtZSwgdmFsdWUgfSkgPT4ge1xuXHRcdFx0XHQvLyBSZWFkIGN1cnJlbnQgdGFnIHZhbHVlIGZpcnN0IGZvciB0aGUgcmVzdWx0IG1lc3NhZ2Vcblx0XHRcdFx0bGV0IHByZXZpb3VzVmFsdWUgPSAnJ1xuXHRcdFx0XHR0cnkge1xuXHRcdFx0XHRcdGNvbnN0IGdldFJlcyA9IGF3YWl0IGZldGNoKGBodHRwOi8vMTI3LjAuMC4xOjE4ODEvYXBpL2dldFRhZ1ZhbHVlP25hbWU9JHtlbmNvZGVVUklDb21wb25lbnQodGFnTmFtZSl9YClcblx0XHRcdFx0XHRpZiAoZ2V0UmVzLm9rKSB7XG5cdFx0XHRcdFx0XHRjb25zdCBkYXRhID0gYXdhaXQgZ2V0UmVzLmpzb24oKVxuXHRcdFx0XHRcdFx0cHJldmlvdXNWYWx1ZSA9IFN0cmluZyhkYXRhPy52YWx1ZSA/PyAnJylcblx0XHRcdFx0XHR9XG5cdFx0XHRcdH0gY2F0Y2ggKF8pIHt9XG5cdFx0XHRcdGNvbnN0IHNldFJlcyA9IGF3YWl0IGZldGNoKCdodHRwOi8vMTI3LjAuMC4xOjE4ODEvYXBpL3NldFRhZ1ZhbHVlJywge1xuXHRcdFx0XHRcdG1ldGhvZDogJ1BPU1QnLFxuXHRcdFx0XHRcdGhlYWRlcnM6IHsgJ0NvbnRlbnQtVHlwZSc6ICdhcHBsaWNhdGlvbi9qc29uJyB9LFxuXHRcdFx0XHRcdGJvZHk6IEpTT04uc3RyaW5naWZ5KHsgbmFtZTogdGFnTmFtZSwgdmFsdWUgfSksXG5cdFx0XHRcdH0pXG5cdFx0XHRcdGlmICghc2V0UmVzLm9rKSB0aHJvdyBuZXcgRXJyb3IoYEZVWEEgUE9TVCAvYXBpL3NldFRhZ1ZhbHVlIFx1MjE5MiAke3NldFJlcy5zdGF0dXN9YClcblx0XHRcdFx0cmV0dXJuIHsgcmVzdWx0OiB7IHRhZ05hbWUsIHByZXZpb3VzVmFsdWUgfSB9XG5cdFx0XHR9LFxuXHRcdH1cblxuXG5cdFx0Y29uc3QgbmV4dFBhZ2VTdHIgPSAoaGFzTmV4dFBhZ2U6IGJvb2xlYW4pID0+IGhhc05leHRQYWdlID8gJ1xcblxcbihtb3JlIG9uIG5leHQgcGFnZS4uLiknIDogJydcblxuXHRcdGNvbnN0IHN0cmluZ2lmeUxpbnRFcnJvcnMgPSAobGludEVycm9yczogTGludEVycm9ySXRlbVtdKSA9PiB7XG5cdFx0XHRyZXR1cm4gbGludEVycm9yc1xuXHRcdFx0XHQubWFwKChlLCBpKSA9PiBgRXJyb3IgJHtpICsgMX06XFxuTGluZXMgQWZmZWN0ZWQ6ICR7ZS5zdGFydExpbmVOdW1iZXJ9LSR7ZS5lbmRMaW5lTnVtYmVyfVxcbkVycm9yIG1lc3NhZ2U6JHtlLm1lc3NhZ2V9YClcblx0XHRcdFx0LmpvaW4oJ1xcblxcbicpXG5cdFx0XHRcdC5zdWJzdHJpbmcoMCwgTUFYX0ZJTEVfQ0hBUlNfUEFHRSlcblx0XHR9XG5cblx0XHQvLyBnaXZlbiB0byB0aGUgTExNIGFmdGVyIHRoZSBjYWxsIGZvciBzdWNjZXNzZnVsIHRvb2wgY2FsbHNcblx0XHR0aGlzLnN0cmluZ09mUmVzdWx0ID0ge1xuXHRcdFx0cmVhZF9maWxlOiAocGFyYW1zLCByZXN1bHQpID0+IHtcblx0XHRcdFx0cmV0dXJuIGAke3BhcmFtcy51cmkuZnNQYXRofVxcblxcYFxcYFxcYFxcbiR7cmVzdWx0LmZpbGVDb250ZW50c31cXG5cXGBcXGBcXGAke25leHRQYWdlU3RyKHJlc3VsdC5oYXNOZXh0UGFnZSl9JHtyZXN1bHQuaGFzTmV4dFBhZ2UgPyBgXFxuTW9yZSBpbmZvIGJlY2F1c2UgdHJ1bmNhdGVkOiB0aGlzIGZpbGUgaGFzICR7cmVzdWx0LnRvdGFsTnVtTGluZXN9IGxpbmVzLCBvciAke3Jlc3VsdC50b3RhbEZpbGVMZW59IGNoYXJhY3RlcnMuYCA6ICcnfWBcblx0XHRcdH0sXG5cdFx0XHRsc19kaXI6IChwYXJhbXMsIHJlc3VsdCkgPT4ge1xuXHRcdFx0XHRjb25zdCBkaXJUcmVlU3RyID0gc3RyaW5naWZ5RGlyZWN0b3J5VHJlZTFEZWVwKHBhcmFtcywgcmVzdWx0KVxuXHRcdFx0XHRyZXR1cm4gZGlyVHJlZVN0ciAvLyArIG5leHRQYWdlU3RyKHJlc3VsdC5oYXNOZXh0UGFnZSkgLy8gYWxyZWFkeSBoYW5kbGVzIG51bSByZXN1bHRzIHJlbWFpbmluZ1xuXHRcdFx0fSxcblx0XHRcdGdldF9kaXJfdHJlZTogKHBhcmFtcywgcmVzdWx0KSA9PiB7XG5cdFx0XHRcdHJldHVybiByZXN1bHQuc3RyXG5cdFx0XHR9LFxuXHRcdFx0c2VhcmNoX3BhdGhuYW1lc19vbmx5OiAocGFyYW1zLCByZXN1bHQpID0+IHtcblx0XHRcdFx0cmV0dXJuIHJlc3VsdC51cmlzLm1hcCh1cmkgPT4gdXJpLmZzUGF0aCkuam9pbignXFxuJykgKyBuZXh0UGFnZVN0cihyZXN1bHQuaGFzTmV4dFBhZ2UpXG5cdFx0XHR9LFxuXHRcdFx0c2VhcmNoX2Zvcl9maWxlczogKHBhcmFtcywgcmVzdWx0KSA9PiB7XG5cdFx0XHRcdHJldHVybiByZXN1bHQudXJpcy5tYXAodXJpID0+IHVyaS5mc1BhdGgpLmpvaW4oJ1xcbicpICsgbmV4dFBhZ2VTdHIocmVzdWx0Lmhhc05leHRQYWdlKVxuXHRcdFx0fSxcblx0XHRcdHNlYXJjaF9pbl9maWxlOiAocGFyYW1zLCByZXN1bHQpID0+IHtcblx0XHRcdFx0Y29uc3QgeyBtb2RlbCB9ID0gdm9pZE1vZGVsU2VydmljZS5nZXRNb2RlbChwYXJhbXMudXJpKVxuXHRcdFx0XHRpZiAoIW1vZGVsKSByZXR1cm4gJzxFcnJvciBnZXR0aW5nIHN0cmluZyBvZiByZXN1bHQ+J1xuXHRcdFx0XHRjb25zdCBsaW5lcyA9IHJlc3VsdC5saW5lcy5tYXAobiA9PiB7XG5cdFx0XHRcdFx0Y29uc3QgbGluZUNvbnRlbnQgPSBtb2RlbC5nZXRWYWx1ZUluUmFuZ2UoeyBzdGFydExpbmVOdW1iZXI6IG4sIHN0YXJ0Q29sdW1uOiAxLCBlbmRMaW5lTnVtYmVyOiBuLCBlbmRDb2x1bW46IE51bWJlci5NQVhfU0FGRV9JTlRFR0VSIH0sIEVuZE9mTGluZVByZWZlcmVuY2UuTEYpXG5cdFx0XHRcdFx0cmV0dXJuIGBMaW5lICR7bn06XFxuXFxgXFxgXFxgXFxuJHtsaW5lQ29udGVudH1cXG5cXGBcXGBcXGBgXG5cdFx0XHRcdH0pLmpvaW4oJ1xcblxcbicpO1xuXHRcdFx0XHRyZXR1cm4gbGluZXM7XG5cdFx0XHR9LFxuXHRcdFx0cmVhZF9saW50X2Vycm9yczogKHBhcmFtcywgcmVzdWx0KSA9PiB7XG5cdFx0XHRcdHJldHVybiByZXN1bHQubGludEVycm9ycyA/XG5cdFx0XHRcdFx0c3RyaW5naWZ5TGludEVycm9ycyhyZXN1bHQubGludEVycm9ycylcblx0XHRcdFx0XHQ6ICdObyBsaW50IGVycm9ycyBmb3VuZC4nXG5cdFx0XHR9LFxuXHRcdFx0Ly8gLS0tXG5cdFx0XHRjcmVhdGVfZmlsZV9vcl9mb2xkZXI6IChwYXJhbXMsIHJlc3VsdCkgPT4ge1xuXHRcdFx0XHRyZXR1cm4gYFVSSSAke3BhcmFtcy51cmkuZnNQYXRofSBzdWNjZXNzZnVsbHkgY3JlYXRlZC5gXG5cdFx0XHR9LFxuXHRcdFx0ZGVsZXRlX2ZpbGVfb3JfZm9sZGVyOiAocGFyYW1zLCByZXN1bHQpID0+IHtcblx0XHRcdFx0cmV0dXJuIGBVUkkgJHtwYXJhbXMudXJpLmZzUGF0aH0gc3VjY2Vzc2Z1bGx5IGRlbGV0ZWQuYFxuXHRcdFx0fSxcblx0XHRcdGVkaXRfZmlsZTogKHBhcmFtcywgcmVzdWx0KSA9PiB7XG5cdFx0XHRcdGNvbnN0IGxpbnRFcnJzU3RyaW5nID0gKFxuXHRcdFx0XHRcdHRoaXMudm9pZFNldHRpbmdzU2VydmljZS5zdGF0ZS5nbG9iYWxTZXR0aW5ncy5pbmNsdWRlVG9vbExpbnRFcnJvcnMgP1xuXHRcdFx0XHRcdFx0KHJlc3VsdC5saW50RXJyb3JzID8gYCBMaW50IGVycm9ycyBmb3VuZCBhZnRlciBjaGFuZ2U6XFxuJHtzdHJpbmdpZnlMaW50RXJyb3JzKHJlc3VsdC5saW50RXJyb3JzKX0uXFxuSWYgdGhpcyBpcyByZWxhdGVkIHRvIGEgY2hhbmdlIG1hZGUgd2hpbGUgY2FsbGluZyB0aGlzIHRvb2wsIHlvdSBtaWdodCB3YW50IHRvIGZpeCB0aGUgZXJyb3IuYFxuXHRcdFx0XHRcdFx0XHQ6IGAgTm8gbGludCBlcnJvcnMgZm91bmQuYClcblx0XHRcdFx0XHRcdDogJycpXG5cblx0XHRcdFx0cmV0dXJuIGBDaGFuZ2Ugc3VjY2Vzc2Z1bGx5IG1hZGUgdG8gJHtwYXJhbXMudXJpLmZzUGF0aH0uJHtsaW50RXJyc1N0cmluZ31gXG5cdFx0XHR9LFxuXHRcdFx0cmV3cml0ZV9maWxlOiAocGFyYW1zLCByZXN1bHQpID0+IHtcblx0XHRcdFx0Y29uc3QgbGludEVycnNTdHJpbmcgPSAoXG5cdFx0XHRcdFx0dGhpcy52b2lkU2V0dGluZ3NTZXJ2aWNlLnN0YXRlLmdsb2JhbFNldHRpbmdzLmluY2x1ZGVUb29sTGludEVycm9ycyA/XG5cdFx0XHRcdFx0XHQocmVzdWx0LmxpbnRFcnJvcnMgPyBgIExpbnQgZXJyb3JzIGZvdW5kIGFmdGVyIGNoYW5nZTpcXG4ke3N0cmluZ2lmeUxpbnRFcnJvcnMocmVzdWx0LmxpbnRFcnJvcnMpfS5cXG5JZiB0aGlzIGlzIHJlbGF0ZWQgdG8gYSBjaGFuZ2UgbWFkZSB3aGlsZSBjYWxsaW5nIHRoaXMgdG9vbCwgeW91IG1pZ2h0IHdhbnQgdG8gZml4IHRoZSBlcnJvci5gXG5cdFx0XHRcdFx0XHRcdDogYCBObyBsaW50IGVycm9ycyBmb3VuZC5gKVxuXHRcdFx0XHRcdFx0OiAnJylcblxuXHRcdFx0XHRyZXR1cm4gYENoYW5nZSBzdWNjZXNzZnVsbHkgbWFkZSB0byAke3BhcmFtcy51cmkuZnNQYXRofS4ke2xpbnRFcnJzU3RyaW5nfWBcblx0XHRcdH0sXG5cdFx0XHRydW5fY29tbWFuZDogKHBhcmFtcywgcmVzdWx0KSA9PiB7XG5cdFx0XHRcdGNvbnN0IHsgcmVzb2x2ZVJlYXNvbiwgcmVzdWx0OiByZXN1bHRfLCB9ID0gcmVzdWx0XG5cdFx0XHRcdC8vIHN1Y2Nlc3Ncblx0XHRcdFx0aWYgKHJlc29sdmVSZWFzb24udHlwZSA9PT0gJ2RvbmUnKSB7XG5cdFx0XHRcdFx0cmV0dXJuIGAke3Jlc3VsdF99XFxuKGV4aXQgY29kZSAke3Jlc29sdmVSZWFzb24uZXhpdENvZGV9KWBcblx0XHRcdFx0fVxuXHRcdFx0XHQvLyBub3JtYWwgY29tbWFuZFxuXHRcdFx0XHRpZiAocmVzb2x2ZVJlYXNvbi50eXBlID09PSAndGltZW91dCcpIHtcblx0XHRcdFx0XHRyZXR1cm4gYCR7cmVzdWx0X31cXG5UZXJtaW5hbCBjb21tYW5kIHJhbiwgYnV0IHdhcyBhdXRvbWF0aWNhbGx5IGtpbGxlZCBieSBWb2lkIGFmdGVyICR7TUFYX1RFUk1JTkFMX0lOQUNUSVZFX1RJTUV9cyBvZiBpbmFjdGl2aXR5IGFuZCBkaWQgbm90IGZpbmlzaCBzdWNjZXNzZnVsbHkuIFRvIHRyeSB3aXRoIG1vcmUgdGltZSwgb3BlbiBhIHBlcnNpc3RlbnQgdGVybWluYWwgYW5kIHJ1biB0aGUgY29tbWFuZCB0aGVyZS5gXG5cdFx0XHRcdH1cblx0XHRcdFx0dGhyb3cgbmV3IEVycm9yKGBVbmV4cGVjdGVkIGludGVybmFsIGVycm9yOiBUZXJtaW5hbCBjb21tYW5kIGRpZCBub3QgcmVzb2x2ZSB3aXRoIGEgdmFsaWQgcmVhc29uLmApXG5cdFx0XHR9LFxuXG5cdFx0XHRydW5fcGVyc2lzdGVudF9jb21tYW5kOiAocGFyYW1zLCByZXN1bHQpID0+IHtcblx0XHRcdFx0Y29uc3QgeyByZXNvbHZlUmVhc29uLCByZXN1bHQ6IHJlc3VsdF8sIH0gPSByZXN1bHRcblx0XHRcdFx0Y29uc3QgeyBwZXJzaXN0ZW50VGVybWluYWxJZCB9ID0gcGFyYW1zXG5cdFx0XHRcdC8vIHN1Y2Nlc3Ncblx0XHRcdFx0aWYgKHJlc29sdmVSZWFzb24udHlwZSA9PT0gJ2RvbmUnKSB7XG5cdFx0XHRcdFx0cmV0dXJuIGAke3Jlc3VsdF99XFxuKGV4aXQgY29kZSAke3Jlc29sdmVSZWFzb24uZXhpdENvZGV9KWBcblx0XHRcdFx0fVxuXHRcdFx0XHQvLyBiZyBjb21tYW5kXG5cdFx0XHRcdGlmIChyZXNvbHZlUmVhc29uLnR5cGUgPT09ICd0aW1lb3V0Jykge1xuXHRcdFx0XHRcdHJldHVybiBgJHtyZXN1bHRffVxcblRlcm1pbmFsIGNvbW1hbmQgaXMgcnVubmluZyBpbiB0ZXJtaW5hbCAke3BlcnNpc3RlbnRUZXJtaW5hbElkfS4gVGhlIGdpdmVuIG91dHB1dHMgYXJlIHRoZSByZXN1bHRzIGFmdGVyICR7TUFYX1RFUk1JTkFMX0JHX0NPTU1BTkRfVElNRX0gc2Vjb25kcy5gXG5cdFx0XHRcdH1cblx0XHRcdFx0dGhyb3cgbmV3IEVycm9yKGBVbmV4cGVjdGVkIGludGVybmFsIGVycm9yOiBUZXJtaW5hbCBjb21tYW5kIGRpZCBub3QgcmVzb2x2ZSB3aXRoIGEgdmFsaWQgcmVhc29uLmApXG5cdFx0XHR9LFxuXG5cdFx0XHRvcGVuX3BlcnNpc3RlbnRfdGVybWluYWw6IChfcGFyYW1zLCByZXN1bHQpID0+IHtcblx0XHRcdFx0Y29uc3QgeyBwZXJzaXN0ZW50VGVybWluYWxJZCB9ID0gcmVzdWx0O1xuXHRcdFx0XHRyZXR1cm4gYFN1Y2Nlc3NmdWxseSBjcmVhdGVkIHBlcnNpc3RlbnQgdGVybWluYWwuIHBlcnNpc3RlbnRUZXJtaW5hbElkPVwiJHtwZXJzaXN0ZW50VGVybWluYWxJZH1cImA7XG5cdFx0XHR9LFxuXHRcdFx0a2lsbF9wZXJzaXN0ZW50X3Rlcm1pbmFsOiAocGFyYW1zLCBfcmVzdWx0KSA9PiB7XG5cdFx0XHRcdHJldHVybiBgU3VjY2Vzc2Z1bGx5IGNsb3NlZCB0ZXJtaW5hbCBcIiR7cGFyYW1zLnBlcnNpc3RlbnRUZXJtaW5hbElkfVwiLmA7XG5cdFx0XHR9LFxuXHRcdFx0aW1wb3J0X3ZlbmRvcl9maWxlOiAocGFyYW1zLCByZXN1bHQpID0+IHtcblx0XHRcdFx0Y29uc3QgeyBwcm9qZWN0TmFtZSwgcG91Q291bnQsIHRhZ0NvdW50LCB1bm1hcHBlZENvdW50LCB3YXJuaW5ncyB9ID0gcmVzdWx0XG5cdFx0XHRcdGxldCBtc2cgPSBgU3VjY2Vzc2Z1bGx5IGltcG9ydGVkIFwiJHtwcm9qZWN0TmFtZX1cIiBmcm9tICR7cGFyYW1zLnVyaS5mc1BhdGh9LiAke3BvdUNvdW50fSBQT1UocyksICR7dGFnQ291bnR9IHRhZyhzKSBsb2FkZWQgaW50byB0aGUgUExDIGVkaXRvci5gXG5cdFx0XHRcdGlmICh1bm1hcHBlZENvdW50ID4gMCkgbXNnICs9IGAgJHt1bm1hcHBlZENvdW50fSBlbGVtZW50KHMpIGNvdWxkIG5vdCBiZSBtYXBwZWQgYW5kIHdlcmUgcHJlc2VydmVkIGluIHNpZGVjYXIgbWV0YWRhdGEuYFxuXHRcdFx0XHRpZiAod2FybmluZ3MubGVuZ3RoID4gMCkgbXNnICs9IGBcXG5XYXJuaW5nczpcXG4ke3dhcm5pbmdzLm1hcCh3ID0+IGAtICR7d31gKS5qb2luKCdcXG4nKX1gXG5cdFx0XHRcdHJldHVybiBtc2dcblx0XHRcdH0sXG5cdFx0XHRwbGNfZ2V0X3Byb2dyYW06IChfcGFyYW1zLCByZXN1bHQpID0+IHtcblx0XHRcdFx0cmV0dXJuIGBDdXJyZW50IFBMQyBwcm9ncmFtIHN0YXRlOlxcbiR7cmVzdWx0LnByb2dyYW19YFxuXHRcdFx0fSxcblx0XHRcdHBsY192YWxpZGF0ZTogKF9wYXJhbXMsIHJlc3VsdCkgPT4ge1xuXHRcdFx0XHRpZiAocmVzdWx0Lmlzc3Vlcy5sZW5ndGggPT09IDApIHJldHVybiBgVmFsaWRhdGlvbiBwYXNzZWQgXHUyMDE0IG5vIGlzc3VlcyBmb3VuZC5gXG5cdFx0XHRcdGNvbnN0IGxpbmVzID0gcmVzdWx0Lmlzc3Vlcy5tYXAoKGlzcywgaSkgPT4gYCR7aSArIDF9LiBbJHtpc3Muc2V2ZXJpdHkudG9VcHBlckNhc2UoKX1dICR7aXNzLmxvY2F0aW9ufTogJHtpc3MubWVzc2FnZX1gKVxuXHRcdFx0XHRyZXR1cm4gYFZhbGlkYXRpb24gZm91bmQgJHtyZXN1bHQuaXNzdWVzLmxlbmd0aH0gaXNzdWUocyk6XFxuJHtsaW5lcy5qb2luKCdcXG4nKX1gXG5cdFx0XHR9LFxuXHRcdFx0cGxjX3dyaXRlX3Byb2dyYW06IChfcGFyYW1zLCByZXN1bHQpID0+IHtcblx0XHRcdFx0aWYgKCFyZXN1bHQub2spIHJldHVybiBgcGxjX3dyaXRlX3Byb2dyYW0gZmFpbGVkLmBcblx0XHRcdFx0Y29uc3QgZmlsZU1zZyA9IGBGaWxlcyBzYXZlZDogJHtyZXN1bHQucG91TmFtZX0ubGQuanNvbiwgJHtyZXN1bHQucG91TmFtZX0uZmJkLmpzb24sICR7cmVzdWx0LnBvdU5hbWV9LnNmYy5qc29uLCAke3Jlc3VsdC5wb3VOYW1lfS5zdGBcblx0XHRcdFx0aWYgKHJlc3VsdC52YWxpZGF0aW9uSXNzdWVzLmxlbmd0aCA9PT0gMCkgcmV0dXJuIGBQcm9ncmFtIHdyaXR0ZW4gYW5kIGxvYWRlZCBpbnRvIGVkaXRvci4gJHtmaWxlTXNnfS4gVmFsaWRhdGlvbjogbm8gaXNzdWVzLmBcblx0XHRcdFx0Y29uc3QgbGluZXMgPSByZXN1bHQudmFsaWRhdGlvbklzc3Vlcy5tYXAoKGlzcywgaSkgPT4gYCR7aSArIDF9LiBbJHtpc3Muc2V2ZXJpdHkudG9VcHBlckNhc2UoKX1dICR7aXNzLmxvY2F0aW9ufTogJHtpc3MubWVzc2FnZX1gKVxuXHRcdFx0XHRyZXR1cm4gYFByb2dyYW0gd3JpdHRlbiBhbmQgbG9hZGVkIGludG8gZWRpdG9yLiAke2ZpbGVNc2d9LlxcblZhbGlkYXRpb24gZm91bmQgJHtyZXN1bHQudmFsaWRhdGlvbklzc3Vlcy5sZW5ndGh9IGlzc3VlKHMpOlxcbiR7bGluZXMuam9pbignXFxuJyl9YFxuXHRcdFx0fSxcblx0XHRcdHBsY19zZXRfdGFnX2RhdGFiYXNlOiAoX3BhcmFtcywgcmVzdWx0KSA9PiB7XG5cdFx0XHRcdHJldHVybiByZXN1bHQub2sgPyBgVGFnIGRhdGFiYXNlIHVwZGF0ZWQgXHUyMDE0ICR7cmVzdWx0LnRhZ0NvdW50fSB0YWcocykgbm93IGFjdGl2ZS5gIDogYHBsY19zZXRfdGFnX2RhdGFiYXNlIGZhaWxlZC5gXG5cdFx0XHR9LFxuXHRcdFx0cGxjX2V4cG9ydF9zdDogKF9wYXJhbXMsIHJlc3VsdCkgPT4ge1xuXHRcdFx0XHRyZXR1cm4gYFNUIGV4cG9ydCBjb21wbGV0ZS4gRmlsZSBzYXZlZCBhcyBcIiR7cmVzdWx0LmZpbGVOYW1lfVwiIGluIHdvcmtzcGFjZS5cXG5cXG5TdHJ1Y3R1cmVkIFRleHQgY29kZTpcXG4ke3Jlc3VsdC5zdENvZGV9YFxuXHRcdFx0fSxcblx0XHRcdHBsY19leHBvcnRfdmVuZG9yOiAoX3BhcmFtcywgcmVzdWx0KSA9PiB7XG5cdFx0XHRcdHJldHVybiBgRXhwb3J0ZWQgYXMgJHtyZXN1bHQuZm9ybWF0fS4gU3VnZ2VzdGVkIGZpbGVuYW1lOiAke3Jlc3VsdC5maWxlTmFtZX1cXG5cXG5Db250ZW50OlxcbiR7cmVzdWx0LmNvbnRlbnR9YFxuXHRcdFx0fSxcblx0XHRcdHBsY19jb252ZXJ0X2xhbmd1YWdlOiAoX3BhcmFtcywgcmVzdWx0KSA9PiB7XG5cdFx0XHRcdHJldHVybiBgU291cmNlIHByb2dyYW0gKCR7cmVzdWx0LnRhcmdldExhbmd1YWdlfSBjb252ZXJzaW9uIHJlcXVlc3RlZCk6XFxuJHtyZXN1bHQuc291cmNlUHJvZ3JhbX1cXG5cXG5HdWlkYW5jZTogJHtyZXN1bHQuZ3VpZGFuY2V9YFxuXHRcdFx0fSxcblx0XHRcdGZ1eGFfZ2V0X3Byb2plY3Q6IChfcGFyYW1zLCByZXN1bHQpID0+IHtcblx0XHRcdFx0cmV0dXJuIGBGVVhBIHByb2plY3QgbG9hZGVkLiBGdWxsIHByb2plY3QgSlNPTjpcXG4ke3Jlc3VsdC5wcm9qZWN0fWBcblx0XHRcdH0sXG5cdFx0XHRmdXhhX2dlbmVyYXRlX3ZpZXc6IChfcGFyYW1zLCByZXN1bHQpID0+IHtcblx0XHRcdFx0cmV0dXJuIHJlc3VsdC5va1xuXHRcdFx0XHRcdD8gYEZVWEEgSE1JIHZpZXcgXCIke3Jlc3VsdC52aWV3TmFtZX1cIiBhdXRvLWdlbmVyYXRlZCBmcm9tIGN1cnJlbnQgdGFnIGRhdGFiYXNlLiBPcGVuIHRoZSBTaW11bGF0b3IgdGFiIHRvIHByZXZpZXcgaXQuYFxuXHRcdFx0XHRcdDogYGZ1eGFfZ2VuZXJhdGVfdmlldyBmYWlsZWQuYFxuXHRcdFx0fSxcblx0XHRcdGZ1eGFfc2F2ZV92aWV3OiAoX3BhcmFtcywgcmVzdWx0KSA9PiB7XG5cdFx0XHRcdHJldHVybiBgVmlldyBcIiR7cmVzdWx0LnZpZXdOYW1lfVwiIChpZDogJHtyZXN1bHQudmlld0lkfSkgc2F2ZWQgdG8gRlVYQS4gT3BlbiB0aGUgU2ltdWxhdG9yIHRhYiB0byBzZWUgdGhlIHJlc3VsdC5gXG5cdFx0XHR9LFxuXHRcdFx0ZnV4YV9zZXRfdGFnX3ZhbHVlOiAocGFyYW1zLCBfcmVzdWx0KSA9PiB7XG5cdFx0XHRcdHJldHVybiBgVGFnIFwiJHtwYXJhbXMudGFnTmFtZX1cIiBzZXQgdG8gJHtKU09OLnN0cmluZ2lmeShwYXJhbXMudmFsdWUpfS5gXG5cdFx0XHR9LFxuXHRcdH1cblxuXG5cblx0fVxuXG5cblx0cHJpdmF0ZSBfZ2V0TGludEVycm9ycyh1cmk6IFVSSSk6IHsgbGludEVycm9yczogTGludEVycm9ySXRlbVtdIHwgbnVsbCB9IHtcblx0XHRjb25zdCBsaW50RXJyb3JzID0gdGhpcy5tYXJrZXJTZXJ2aWNlXG5cdFx0XHQucmVhZCh7IHJlc291cmNlOiB1cmkgfSlcblx0XHRcdC5maWx0ZXIobCA9PiBsLnNldmVyaXR5ID09PSBNYXJrZXJTZXZlcml0eS5FcnJvciB8fCBsLnNldmVyaXR5ID09PSBNYXJrZXJTZXZlcml0eS5XYXJuaW5nKVxuXHRcdFx0LnNsaWNlKDAsIDEwMClcblx0XHRcdC5tYXAobCA9PiAoe1xuXHRcdFx0XHRjb2RlOiB0eXBlb2YgbC5jb2RlID09PSAnc3RyaW5nJyA/IGwuY29kZSA6IGwuY29kZT8udmFsdWUgfHwgJycsXG5cdFx0XHRcdG1lc3NhZ2U6IChsLnNldmVyaXR5ID09PSBNYXJrZXJTZXZlcml0eS5FcnJvciA/ICcoZXJyb3IpICcgOiAnKHdhcm5pbmcpICcpICsgbC5tZXNzYWdlLFxuXHRcdFx0XHRzdGFydExpbmVOdW1iZXI6IGwuc3RhcnRMaW5lTnVtYmVyLFxuXHRcdFx0XHRlbmRMaW5lTnVtYmVyOiBsLmVuZExpbmVOdW1iZXIsXG5cdFx0XHR9IHNhdGlzZmllcyBMaW50RXJyb3JJdGVtKSlcblxuXHRcdGlmICghbGludEVycm9ycy5sZW5ndGgpIHJldHVybiB7IGxpbnRFcnJvcnM6IG51bGwgfVxuXHRcdHJldHVybiB7IGxpbnRFcnJvcnMsIH1cblx0fVxuXG5cbn1cblxucmVnaXN0ZXJTaW5nbGV0b24oSVRvb2xzU2VydmljZSwgVG9vbHNTZXJ2aWNlLCBJbnN0YW50aWF0aW9uVHlwZS5FYWdlcik7XG4iXSwKICAibWFwcGluZ3MiOiAiOzs7Ozs7Ozs7OztBQUFBLFNBQVMseUJBQXlCO0FBQ2xDLFNBQVMsV0FBVztBQUNwQixTQUFTLG9CQUFvQjtBQUM3QixTQUFTLG1CQUFtQix5QkFBeUI7QUFDckQsU0FBUyxpQkFBaUIsNkJBQTZCO0FBQ3ZELFNBQVMsZ0NBQWdDO0FBQ3pDLFNBQVMsb0JBQW9CO0FBQzdCLFNBQVMsc0JBQXNCO0FBQy9CLFNBQVMsd0JBQXdCO0FBQ2pDLFNBQVMsNEJBQTRCO0FBRXJDLFNBQVMseUJBQXlCO0FBQ2xDLFNBQVMsMkJBQTJCO0FBQ3BDLFNBQVMsOEJBQThCO0FBQ3ZDLFNBQVMsMkJBQTJCLHNCQUFzQixtQ0FBbUM7QUFDN0YsU0FBUyxnQkFBZ0Isc0JBQXNCO0FBQy9DLFNBQVMsZUFBZTtBQUV4QixTQUFTLHdCQUF3QixxQkFBcUIsOEJBQThCLGtDQUFrQztBQUN0SCxT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
