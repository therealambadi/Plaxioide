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
import { coalesce, groupBy } from "../../../../../base/common/arrays.js";
import { assertNever } from "../../../../../base/common/assert.js";
import { Codicon } from "../../../../../base/common/codicons.js";
import { isCancellationError } from "../../../../../base/common/errors.js";
import * as glob from "../../../../../base/common/glob.js";
import { MarkdownString } from "../../../../../base/common/htmlContent.js";
import { Disposable, DisposableStore } from "../../../../../base/common/lifecycle.js";
import { ResourceSet } from "../../../../../base/common/map.js";
import { basename, dirname, joinPath, relativePath } from "../../../../../base/common/resources.js";
import { ThemeIcon } from "../../../../../base/common/themables.js";
import { URI } from "../../../../../base/common/uri.js";
import { Range } from "../../../../../editor/common/core/range.js";
import { isLocation } from "../../../../../editor/common/languages.js";
import { ITextModelService } from "../../../../../editor/common/services/resolverService.js";
import { localize } from "../../../../../nls.js";
import { Action2, registerAction2 } from "../../../../../platform/actions/common/actions.js";
import { ICommandService } from "../../../../../platform/commands/common/commands.js";
import { IConfigurationService } from "../../../../../platform/configuration/common/configuration.js";
import { FileType, IFileService } from "../../../../../platform/files/common/files.js";
import { IInstantiationService } from "../../../../../platform/instantiation/common/instantiation.js";
import { ILabelService } from "../../../../../platform/label/common/label.js";
import { ILogService } from "../../../../../platform/log/common/log.js";
import { IMarkerService, MarkerSeverity } from "../../../../../platform/markers/common/markers.js";
import { PromptsConfig } from "../../../../../platform/prompts/common/config.js";
import { IQuickInputService } from "../../../../../platform/quickinput/common/quickInput.js";
import { IUriIdentityService } from "../../../../../platform/uriIdentity/common/uriIdentity.js";
import { IWorkspaceContextService } from "../../../../../platform/workspace/common/workspace.js";
import { getExcludes, ISearchService, QueryType } from "../../../../services/search/common/search.js";
import { IDiagnosticVariableEntryFilterData } from "../../common/chatModel.js";
import { ChatWidget } from "../chatWidget.js";
import { ChatFileReference } from "./chatDynamicVariables/chatFileReference.js";
const dynamicVariableDecorationType = "chat-dynamic-variable";
let ChatDynamicVariableModel = class extends Disposable {
  constructor(widget, labelService, configService, instantiationService) {
    super();
    this.widget = widget;
    this.labelService = labelService;
    this.configService = configService;
    this.instantiationService = instantiationService;
    this._variables = [];
    this._register(widget.inputEditor.onDidChangeModelContent((e) => {
      e.changes.forEach((c) => {
        this._variables = coalesce(this._variables.map((ref) => {
          const intersection = Range.intersectRanges(ref.range, c.range);
          if (intersection && !intersection.isEmpty()) {
            if (!Range.containsRange(c.range, ref.range)) {
              const rangeToDelete = new Range(ref.range.startLineNumber, ref.range.startColumn, ref.range.endLineNumber, ref.range.endColumn - 1);
              this.widget.inputEditor.executeEdits(this.id, [{
                range: rangeToDelete,
                text: ""
              }]);
              this.widget.refreshParsedInput();
            }
            if ("dispose" in ref && typeof ref.dispose === "function") {
              ref.dispose();
            }
            return null;
          } else if (Range.compareRangesUsingStarts(ref.range, c.range) > 0) {
            const delta = c.text.length - c.rangeLength;
            ref.range = {
              startLineNumber: ref.range.startLineNumber,
              startColumn: ref.range.startColumn + delta,
              endLineNumber: ref.range.endLineNumber,
              endColumn: ref.range.endColumn + delta
            };
            return ref;
          }
          return ref;
        }));
      });
      this.updateDecorations();
    }));
  }
  get variables() {
    return [...this._variables];
  }
  get id() {
    return ChatDynamicVariableModel.ID;
  }
  getInputState() {
    return this.variables.map((variable) => {
      if (variable instanceof ChatFileReference) {
        return variable.reference;
      }
      return variable;
    });
  }
  setInputState(s) {
    if (!Array.isArray(s)) {
      s = [];
    }
    this.disposeVariables();
    this._variables = [];
    for (const variable of s) {
      if (!isDynamicVariable(variable)) {
        continue;
      }
      this.addReference(variable);
    }
  }
  addReference(ref) {
    const promptSnippetsEnabled = PromptsConfig.enabled(this.configService);
    const variable = ref.id === "vscode.file" && promptSnippetsEnabled ? this.instantiationService.createInstance(ChatFileReference, ref) : ref;
    this._variables.push(variable);
    this.updateDecorations();
    this.widget.refreshParsedInput();
    if (variable instanceof ChatFileReference && variable.isPromptFile) {
      variable.onUpdate(() => {
        this.updateDecorations();
      });
      variable.start();
    }
  }
  updateDecorations() {
    this.widget.inputEditor.setDecorationsByType("chat", dynamicVariableDecorationType, this._variables.map((r) => ({
      range: r.range,
      hoverMessage: this.getHoverForReference(r)
    })));
  }
  getHoverForReference(ref) {
    const value = ref.data;
    if (URI.isUri(value)) {
      return new MarkdownString(this.labelService.getUriLabel(value, { relative: true }));
    } else if (isLocation(value)) {
      const prefix = ref.fullName ? ` ${ref.fullName}` : "";
      const rangeString = `#${value.range.startLineNumber}-${value.range.endLineNumber}`;
      return new MarkdownString(prefix + this.labelService.getUriLabel(value.uri, { relative: true }) + rangeString);
    } else {
      return void 0;
    }
  }
  /**
   * Dispose all existing variables.
   */
  disposeVariables() {
    for (const variable of this._variables) {
      if ("dispose" in variable && typeof variable.dispose === "function") {
        variable.dispose();
      }
    }
  }
  dispose() {
    this.disposeVariables();
    super.dispose();
  }
};
ChatDynamicVariableModel.ID = "chatDynamicVariableModel";
ChatDynamicVariableModel = __decorateClass([
  __decorateParam(1, ILabelService),
  __decorateParam(2, IConfigurationService),
  __decorateParam(3, IInstantiationService)
], ChatDynamicVariableModel);
function isDynamicVariable(obj) {
  return obj && typeof obj.id === "string" && Range.isIRange(obj.range) && "data" in obj;
}
ChatWidget.CONTRIBS.push(ChatDynamicVariableModel);
function isSelectAndInsertActionContext(context) {
  return "widget" in context && "range" in context;
}
const _SelectAndInsertFileAction = class _SelectAndInsertFileAction extends Action2 {
  constructor() {
    super({
      id: _SelectAndInsertFileAction.ID,
      title: ""
      // not displayed
    });
  }
  async run(accessor, ...args) {
    const textModelService = accessor.get(ITextModelService);
    const logService = accessor.get(ILogService);
    const quickInputService = accessor.get(IQuickInputService);
    const context = args[0];
    if (!isSelectAndInsertActionContext(context)) {
      return;
    }
    const doCleanup = () => {
      context.widget.inputEditor.executeEdits("chatInsertFile", [{ range: context.range, text: `` }]);
    };
    let options;
    const picks = await quickInputService.quickAccess.pick("", options);
    if (!picks?.length) {
      logService.trace("SelectAndInsertFileAction: no file selected");
      doCleanup();
      return;
    }
    const editor = context.widget.inputEditor;
    const range = context.range;
    if (picks[0] === _SelectAndInsertFileAction.Item) {
      const text2 = `#${_SelectAndInsertFileAction.Name}`;
      const success2 = editor.executeEdits("chatInsertFile", [{ range, text: text2 + " " }]);
      if (!success2) {
        logService.trace(`SelectAndInsertFileAction: failed to insert "${text2}"`);
        doCleanup();
      }
      return;
    }
    const resource = picks[0].resource;
    if (!textModelService.canHandleResource(resource)) {
      logService.trace("SelectAndInsertFileAction: non-text resource selected");
      doCleanup();
      return;
    }
    const fileName = basename(resource);
    const text = `#file:${fileName}`;
    const success = editor.executeEdits("chatInsertFile", [{ range, text: text + " " }]);
    if (!success) {
      logService.trace(`SelectAndInsertFileAction: failed to insert "${text}"`);
      doCleanup();
      return;
    }
    context.widget.getContrib(ChatDynamicVariableModel.ID)?.addReference({
      id: "vscode.file",
      isFile: true,
      prefix: "file",
      range: { startLineNumber: range.startLineNumber, startColumn: range.startColumn, endLineNumber: range.endLineNumber, endColumn: range.startColumn + text.length },
      data: resource
    });
  }
};
_SelectAndInsertFileAction.Name = "files";
_SelectAndInsertFileAction.Item = {
  label: localize("allFiles", "All Files"),
  description: localize("allFilesDescription", "Search for relevant files in the workspace and provide context from them")
};
_SelectAndInsertFileAction.ID = "workbench.action.chat.selectAndInsertFile";
let SelectAndInsertFileAction = _SelectAndInsertFileAction;
registerAction2(SelectAndInsertFileAction);
const _SelectAndInsertFolderAction = class _SelectAndInsertFolderAction extends Action2 {
  constructor() {
    super({
      id: _SelectAndInsertFolderAction.ID,
      title: ""
      // not displayed
    });
  }
  async run(accessor, ...args) {
    const logService = accessor.get(ILogService);
    const context = args[0];
    if (!isSelectAndInsertActionContext(context)) {
      return;
    }
    const doCleanup = () => {
      context.widget.inputEditor.executeEdits("chatInsertFolder", [{ range: context.range, text: `` }]);
    };
    const folder = await createFolderQuickPick(accessor);
    if (!folder) {
      logService.trace("SelectAndInsertFolderAction: no folder selected");
      doCleanup();
      return;
    }
    const editor = context.widget.inputEditor;
    const range = context.range;
    const folderName = basename(folder);
    const text = `#folder:${folderName}`;
    const success = editor.executeEdits("chatInsertFolder", [{ range, text: text + " " }]);
    if (!success) {
      logService.trace(`SelectAndInsertFolderAction: failed to insert "${text}"`);
      doCleanup();
      return;
    }
    context.widget.getContrib(ChatDynamicVariableModel.ID)?.addReference({
      id: "vscode.folder",
      isFile: false,
      isDirectory: true,
      prefix: "folder",
      range: { startLineNumber: range.startLineNumber, startColumn: range.startColumn, endLineNumber: range.endLineNumber, endColumn: range.startColumn + text.length },
      data: folder
    });
  }
};
_SelectAndInsertFolderAction.Name = "folder";
_SelectAndInsertFolderAction.ID = "workbench.action.chat.selectAndInsertFolder";
let SelectAndInsertFolderAction = _SelectAndInsertFolderAction;
registerAction2(SelectAndInsertFolderAction);
async function createFolderQuickPick(accessor) {
  const quickInputService = accessor.get(IQuickInputService);
  const searchService = accessor.get(ISearchService);
  const configurationService = accessor.get(IConfigurationService);
  const workspaceService = accessor.get(IWorkspaceContextService);
  const fileService = accessor.get(IFileService);
  const labelService = accessor.get(ILabelService);
  const workspaces = workspaceService.getWorkspace().folders.map((folder) => folder.uri);
  const topLevelFolderItems = (await getTopLevelFolders(workspaces, fileService)).map(createQuickPickItem);
  const quickPick = quickInputService.createQuickPick();
  quickPick.placeholder = "Search folder by name";
  quickPick.items = topLevelFolderItems;
  return await new Promise((_resolve) => {
    const disposables = new DisposableStore();
    const resolve = (res) => {
      _resolve(res);
      disposables.dispose();
      quickPick.dispose();
    };
    disposables.add(quickPick.onDidChangeValue(async (value) => {
      if (value === "") {
        quickPick.items = topLevelFolderItems;
        return;
      }
      const workspaceFolders = await Promise.all(
        workspaces.map(
          (workspace) => searchFolders(
            workspace,
            value,
            true,
            void 0,
            void 0,
            configurationService,
            searchService
          )
        )
      );
      quickPick.items = workspaceFolders.flat().map(createQuickPickItem);
    }));
    disposables.add(quickPick.onDidAccept((e) => {
      const value = quickPick.selectedItems[0]?.resource;
      resolve(value);
    }));
    disposables.add(quickPick.onDidHide(() => {
      resolve(void 0);
    }));
    quickPick.show();
  });
  function createQuickPickItem(folder) {
    return {
      type: "item",
      id: folder.toString(),
      resource: folder,
      alwaysShow: true,
      label: basename(folder),
      description: labelService.getUriLabel(dirname(folder), { relative: true }),
      iconClass: ThemeIcon.asClassName(Codicon.folder)
    };
  }
}
async function getTopLevelFolders(workspaces, fileService) {
  const folders = [];
  for (const workspace of workspaces) {
    const fileSystemProvider = fileService.getProvider(workspace.scheme);
    if (!fileSystemProvider) {
      continue;
    }
    const entries = await fileSystemProvider.readdir(workspace);
    for (const [name, type] of entries) {
      const entryResource = joinPath(workspace, name);
      if (type === FileType.Directory) {
        folders.push(entryResource);
      }
    }
  }
  return folders;
}
async function searchFolders(workspace, pattern, fuzzyMatch, token, cacheKey, configurationService, searchService) {
  const segmentMatchPattern = caseInsensitiveGlobPattern(fuzzyMatch ? fuzzyMatchingGlobPattern(pattern) : continousMatchingGlobPattern(pattern));
  const searchExcludePattern = getExcludes(configurationService.getValue({ resource: workspace })) || {};
  const searchOptions = {
    folderQueries: [{
      folder: workspace,
      disregardIgnoreFiles: configurationService.getValue("explorer.excludeGitIgnore")
    }],
    type: QueryType.File,
    shouldGlobMatchFilePattern: true,
    cacheKey,
    excludePattern: searchExcludePattern
  };
  let folderResults;
  try {
    folderResults = await searchService.fileSearch({ ...searchOptions, filePattern: `**/${segmentMatchPattern}/**` }, token);
  } catch (e) {
    if (!isCancellationError(e)) {
      throw e;
    }
  }
  if (!folderResults || token?.isCancellationRequested) {
    return [];
  }
  const folderResources = getMatchingFoldersFromFiles(folderResults.results.map((result) => result.resource), workspace, segmentMatchPattern);
  return folderResources;
}
function fuzzyMatchingGlobPattern(pattern) {
  if (!pattern) {
    return "*";
  }
  return "*" + pattern.split("").join("*") + "*";
}
function continousMatchingGlobPattern(pattern) {
  if (!pattern) {
    return "*";
  }
  return "*" + pattern + "*";
}
function caseInsensitiveGlobPattern(pattern) {
  let caseInsensitiveFilePattern = "";
  for (let i = 0; i < pattern.length; i++) {
    const char = pattern[i];
    if (/[a-zA-Z]/.test(char)) {
      caseInsensitiveFilePattern += `[${char.toLowerCase()}${char.toUpperCase()}]`;
    } else {
      caseInsensitiveFilePattern += char;
    }
  }
  return caseInsensitiveFilePattern;
}
function getMatchingFoldersFromFiles(resources, workspace, segmentMatchPattern) {
  const uniqueFolders = new ResourceSet();
  for (const resource of resources) {
    const relativePathToRoot = relativePath(workspace, resource);
    if (!relativePathToRoot) {
      throw new Error("Resource is not a child of the workspace");
    }
    let dirResource = workspace;
    const stats = relativePathToRoot.split("/").slice(0, -1);
    for (const stat of stats) {
      dirResource = dirResource.with({ path: `${dirResource.path}/${stat}` });
      uniqueFolders.add(dirResource);
    }
  }
  const matchingFolders = [];
  for (const folderResource of uniqueFolders) {
    const stats = folderResource.path.split("/");
    const dirStat = stats[stats.length - 1];
    if (!dirStat || !glob.match(segmentMatchPattern, dirStat)) {
      continue;
    }
    matchingFolders.push(folderResource);
  }
  return matchingFolders;
}
const _SelectAndInsertSymAction = class _SelectAndInsertSymAction extends Action2 {
  constructor() {
    super({
      id: _SelectAndInsertSymAction.ID,
      title: ""
      // not displayed
    });
  }
  async run(accessor, ...args) {
    const textModelService = accessor.get(ITextModelService);
    const logService = accessor.get(ILogService);
    const quickInputService = accessor.get(IQuickInputService);
    const context = args[0];
    if (!isSelectAndInsertActionContext(context)) {
      return;
    }
    const doCleanup = () => {
      context.widget.inputEditor.executeEdits("chatInsertSym", [{ range: context.range, text: `` }]);
    };
    const picks = await quickInputService.quickAccess.pick("#", { enabledProviderPrefixes: ["#"] });
    if (!picks?.length) {
      logService.trace("SelectAndInsertSymAction: no symbol selected");
      doCleanup();
      return;
    }
    const editor = context.widget.inputEditor;
    const range = context.range;
    const symbol = picks[0].symbol;
    if (!symbol || !textModelService.canHandleResource(symbol.location.uri)) {
      logService.trace("SelectAndInsertSymAction: non-text resource selected");
      doCleanup();
      return;
    }
    const text = `#sym:${symbol.name}`;
    const success = editor.executeEdits("chatInsertSym", [{ range, text: text + " " }]);
    if (!success) {
      logService.trace(`SelectAndInsertSymAction: failed to insert "${text}"`);
      doCleanup();
      return;
    }
    context.widget.getContrib(ChatDynamicVariableModel.ID)?.addReference({
      id: "vscode.symbol",
      prefix: "symbol",
      range: { startLineNumber: range.startLineNumber, startColumn: range.startColumn, endLineNumber: range.endLineNumber, endColumn: range.startColumn + text.length },
      data: symbol.location
    });
  }
};
_SelectAndInsertSymAction.Name = "symbols";
_SelectAndInsertSymAction.ID = "workbench.action.chat.selectAndInsertSym";
let SelectAndInsertSymAction = _SelectAndInsertSymAction;
registerAction2(SelectAndInsertSymAction);
function isAddDynamicVariableContext(context) {
  return "widget" in context && "range" in context && "variableData" in context;
}
const _AddDynamicVariableAction = class _AddDynamicVariableAction extends Action2 {
  constructor() {
    super({
      id: _AddDynamicVariableAction.ID,
      title: ""
      // not displayed
    });
  }
  async run(accessor, ...args) {
    const context = args[0];
    if (!isAddDynamicVariableContext(context)) {
      return;
    }
    let range = context.range;
    const variableData = context.variableData;
    const doCleanup = () => {
      context.widget.inputEditor.executeEdits("chatInsertDynamicVariableWithArguments", [{ range: context.range, text: `` }]);
    };
    if (context.command) {
      const commandService = accessor.get(ICommandService);
      const selection = await commandService.executeCommand(context.command.id, ...context.command.arguments ?? []);
      if (!selection) {
        doCleanup();
        return;
      }
      const insertText = ":" + selection;
      const insertRange = new Range(range.startLineNumber, range.endColumn, range.endLineNumber, range.endColumn + insertText.length);
      range = new Range(range.startLineNumber, range.startColumn, range.endLineNumber, range.endColumn + insertText.length);
      const editor = context.widget.inputEditor;
      const success = editor.executeEdits("chatInsertDynamicVariableWithArguments", [{ range: insertRange, text: insertText + " " }]);
      if (!success) {
        doCleanup();
        return;
      }
    }
    context.widget.getContrib(ChatDynamicVariableModel.ID)?.addReference({
      id: context.id,
      range,
      isFile: true,
      prefix: "file",
      data: variableData
    });
  }
};
_AddDynamicVariableAction.ID = "workbench.action.chat.addDynamicVariable";
let AddDynamicVariableAction = _AddDynamicVariableAction;
registerAction2(AddDynamicVariableAction);
async function createMarkersQuickPick(accessor, level, onBackgroundAccept) {
  const markers = accessor.get(IMarkerService).read({ severities: MarkerSeverity.Error | MarkerSeverity.Warning | MarkerSeverity.Info });
  if (!markers.length) {
    return;
  }
  const uriIdentityService = accessor.get(IUriIdentityService);
  const labelService = accessor.get(ILabelService);
  const grouped = groupBy(markers, (a, b) => uriIdentityService.extUri.compare(a.resource, b.resource));
  const severities = /* @__PURE__ */ new Set();
  const items = [];
  let pickCount = 0;
  for (const group of grouped) {
    const resource = group[0].resource;
    if (level === "problem") {
      items.push({ type: "separator", label: labelService.getUriLabel(resource, { relative: true }) });
      for (const marker of group) {
        pickCount++;
        severities.add(marker.severity);
        items.push({
          type: "item",
          resource: marker.resource,
          label: marker.message,
          description: localize("markers.panel.at.ln.col.number", "[Ln {0}, Col {1}]", "" + marker.startLineNumber, "" + marker.startColumn),
          entry: IDiagnosticVariableEntryFilterData.fromMarker(marker)
        });
      }
    } else if (level === "file") {
      const entry = { filterUri: resource };
      pickCount++;
      items.push({
        type: "item",
        resource,
        label: IDiagnosticVariableEntryFilterData.label(entry),
        description: group[0].message + (group.length > 1 ? localize("problemsMore", "+ {0} more", group.length - 1) : ""),
        entry
      });
      for (const marker of group) {
        severities.add(marker.severity);
      }
    } else {
      assertNever(level);
    }
  }
  if (pickCount < 2) {
    return items.find((i) => i.type === "item")?.entry;
  }
  if (level === "file") {
    items.unshift({ type: "separator", label: localize("markers.panel.files", "Files") });
  }
  items.unshift({ type: "item", label: localize("markers.panel.allErrors", "All Problems"), entry: { filterSeverity: MarkerSeverity.Info } });
  const quickInputService = accessor.get(IQuickInputService);
  const store = new DisposableStore();
  const quickPick = store.add(quickInputService.createQuickPick({ useSeparators: true }));
  quickPick.canAcceptInBackground = !onBackgroundAccept;
  quickPick.placeholder = localize("pickAProblem", "Pick a problem to attach...");
  quickPick.items = items;
  return new Promise((resolve) => {
    store.add(quickPick.onDidHide(() => resolve(void 0)));
    store.add(quickPick.onDidAccept((ev) => {
      if (ev.inBackground) {
        onBackgroundAccept?.(quickPick.selectedItems.map((i) => i.entry));
      } else {
        resolve(quickPick.selectedItems[0]?.entry);
        quickPick.dispose();
      }
    }));
    quickPick.show();
  }).finally(() => store.dispose());
}
const _SelectAndInsertProblemAction = class _SelectAndInsertProblemAction extends Action2 {
  constructor() {
    super({
      id: _SelectAndInsertProblemAction.ID,
      title: ""
      // not displayed
    });
  }
  async run(accessor, ...args) {
    const logService = accessor.get(ILogService);
    const context = args[0];
    if (!isSelectAndInsertActionContext(context)) {
      return;
    }
    const doCleanup = () => {
      context.widget.inputEditor.executeEdits("chatInsertProblems", [{ range: context.range, text: `` }]);
    };
    const pick = await createMarkersQuickPick(accessor, "file");
    if (!pick) {
      doCleanup();
      return;
    }
    const editor = context.widget.inputEditor;
    const originalRange = context.range;
    const insertText = `#${_SelectAndInsertProblemAction.Name}:${pick.filterUri ? basename(pick.filterUri) : MarkerSeverity.toString(pick.filterSeverity)}`;
    const varRange = new Range(originalRange.startLineNumber, originalRange.startColumn, originalRange.endLineNumber, originalRange.startColumn + insertText.length);
    const success = editor.executeEdits("chatInsertProblems", [{ range: varRange, text: insertText + " " }]);
    if (!success) {
      logService.trace(`SelectAndInsertProblemsAction: failed to insert "${insertText}"`);
      doCleanup();
      return;
    }
    context.widget.getContrib(ChatDynamicVariableModel.ID)?.addReference({
      id: "vscode.problems",
      prefix: _SelectAndInsertProblemAction.Name,
      range: varRange,
      data: { id: "vscode.problems", filter: pick }
    });
  }
};
_SelectAndInsertProblemAction.Name = "problems";
_SelectAndInsertProblemAction.ID = "workbench.action.chat.selectAndInsertProblems";
let SelectAndInsertProblemAction = _SelectAndInsertProblemAction;
registerAction2(SelectAndInsertProblemAction);
export {
  AddDynamicVariableAction,
  ChatDynamicVariableModel,
  SelectAndInsertFileAction,
  SelectAndInsertFolderAction,
  SelectAndInsertProblemAction,
  SelectAndInsertSymAction,
  createFolderQuickPick,
  createMarkersQuickPick,
  dynamicVariableDecorationType,
  getTopLevelFolders,
  searchFolders
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvY29udHJpYi9jaGF0L2Jyb3dzZXIvY29udHJpYi9jaGF0RHluYW1pY1ZhcmlhYmxlcy50cyJdLAogICJzb3VyY2VzQ29udGVudCI6IFsiLyotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cbiAqICBDb3B5cmlnaHQgKGMpIE1pY3Jvc29mdCBDb3Jwb3JhdGlvbi4gQWxsIHJpZ2h0cyByZXNlcnZlZC5cbiAqICBMaWNlbnNlZCB1bmRlciB0aGUgTUlUIExpY2Vuc2UuIFNlZSBMaWNlbnNlLnR4dCBpbiB0aGUgcHJvamVjdCByb290IGZvciBsaWNlbnNlIGluZm9ybWF0aW9uLlxuICotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLSovXG5cbmltcG9ydCB7IGNvYWxlc2NlLCBncm91cEJ5IH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vYXJyYXlzLmpzJztcbmltcG9ydCB7IGFzc2VydE5ldmVyIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vYXNzZXJ0LmpzJztcbmltcG9ydCB7IENhbmNlbGxhdGlvblRva2VuIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vY2FuY2VsbGF0aW9uLmpzJztcbmltcG9ydCB7IENvZGljb24gfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9jb2RpY29ucy5qcyc7XG5pbXBvcnQgeyBpc0NhbmNlbGxhdGlvbkVycm9yIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vZXJyb3JzLmpzJztcbmltcG9ydCAqIGFzIGdsb2IgZnJvbSAnLi4vLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vZ2xvYi5qcyc7XG5pbXBvcnQgeyBJTWFya2Rvd25TdHJpbmcsIE1hcmtkb3duU3RyaW5nIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vaHRtbENvbnRlbnQuanMnO1xuaW1wb3J0IHsgRGlzcG9zYWJsZSwgRGlzcG9zYWJsZVN0b3JlIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vbGlmZWN5Y2xlLmpzJztcbmltcG9ydCB7IFJlc291cmNlU2V0IH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vbWFwLmpzJztcbmltcG9ydCB7IGJhc2VuYW1lLCBkaXJuYW1lLCBqb2luUGF0aCwgcmVsYXRpdmVQYXRoIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vcmVzb3VyY2VzLmpzJztcbmltcG9ydCB7IFRoZW1lSWNvbiB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL3RoZW1hYmxlcy5qcyc7XG5pbXBvcnQgeyBVUkkgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi91cmkuanMnO1xuaW1wb3J0IHsgSVJhbmdlLCBSYW5nZSB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL2VkaXRvci9jb21tb24vY29yZS9yYW5nZS5qcyc7XG5pbXBvcnQgeyBJRGVjb3JhdGlvbk9wdGlvbnMgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9lZGl0b3IvY29tbW9uL2VkaXRvckNvbW1vbi5qcyc7XG5pbXBvcnQgeyBDb21tYW5kLCBpc0xvY2F0aW9uIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vZWRpdG9yL2NvbW1vbi9sYW5ndWFnZXMuanMnO1xuaW1wb3J0IHsgSVRleHRNb2RlbFNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9lZGl0b3IvY29tbW9uL3NlcnZpY2VzL3Jlc29sdmVyU2VydmljZS5qcyc7XG5pbXBvcnQgeyBsb2NhbGl6ZSB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL25scy5qcyc7XG5pbXBvcnQgeyBBY3Rpb24yLCByZWdpc3RlckFjdGlvbjIgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9wbGF0Zm9ybS9hY3Rpb25zL2NvbW1vbi9hY3Rpb25zLmpzJztcbmltcG9ydCB7IElDb21tYW5kU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL3BsYXRmb3JtL2NvbW1hbmRzL2NvbW1vbi9jb21tYW5kcy5qcyc7XG5pbXBvcnQgeyBJQ29uZmlndXJhdGlvblNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9wbGF0Zm9ybS9jb25maWd1cmF0aW9uL2NvbW1vbi9jb25maWd1cmF0aW9uLmpzJztcbmltcG9ydCB7IEZpbGVUeXBlLCBJRmlsZVNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9wbGF0Zm9ybS9maWxlcy9jb21tb24vZmlsZXMuanMnO1xuaW1wb3J0IHsgSUluc3RhbnRpYXRpb25TZXJ2aWNlLCBTZXJ2aWNlc0FjY2Vzc29yIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vcGxhdGZvcm0vaW5zdGFudGlhdGlvbi9jb21tb24vaW5zdGFudGlhdGlvbi5qcyc7XG5pbXBvcnQgeyBJTGFiZWxTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vcGxhdGZvcm0vbGFiZWwvY29tbW9uL2xhYmVsLmpzJztcbmltcG9ydCB7IElMb2dTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vcGxhdGZvcm0vbG9nL2NvbW1vbi9sb2cuanMnO1xuaW1wb3J0IHsgSU1hcmtlclNlcnZpY2UsIE1hcmtlclNldmVyaXR5IH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vcGxhdGZvcm0vbWFya2Vycy9jb21tb24vbWFya2Vycy5qcyc7XG5pbXBvcnQgeyBQcm9tcHRzQ29uZmlnIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vcGxhdGZvcm0vcHJvbXB0cy9jb21tb24vY29uZmlnLmpzJztcbmltcG9ydCB7IElRdWlja0FjY2Vzc09wdGlvbnMgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9wbGF0Zm9ybS9xdWlja2lucHV0L2NvbW1vbi9xdWlja0FjY2Vzcy5qcyc7XG5pbXBvcnQgeyBJUXVpY2tJbnB1dFNlcnZpY2UsIElRdWlja1BpY2tJdGVtLCBJUXVpY2tQaWNrU2VwYXJhdG9yIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vcGxhdGZvcm0vcXVpY2tpbnB1dC9jb21tb24vcXVpY2tJbnB1dC5qcyc7XG5pbXBvcnQgeyBJVXJpSWRlbnRpdHlTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vcGxhdGZvcm0vdXJpSWRlbnRpdHkvY29tbW9uL3VyaUlkZW50aXR5LmpzJztcbmltcG9ydCB7IElXb3Jrc3BhY2VDb250ZXh0U2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL3BsYXRmb3JtL3dvcmtzcGFjZS9jb21tb24vd29ya3NwYWNlLmpzJztcbmltcG9ydCB7IGdldEV4Y2x1ZGVzLCBJRmlsZVF1ZXJ5LCBJU2VhcmNoQ29tcGxldGUsIElTZWFyY2hDb25maWd1cmF0aW9uLCBJU2VhcmNoU2VydmljZSwgUXVlcnlUeXBlIH0gZnJvbSAnLi4vLi4vLi4vLi4vc2VydmljZXMvc2VhcmNoL2NvbW1vbi9zZWFyY2guanMnO1xuaW1wb3J0IHsgSVN5bWJvbFF1aWNrUGlja0l0ZW0gfSBmcm9tICcuLi8uLi8uLi9zZWFyY2gvYnJvd3Nlci9zeW1ib2xzUXVpY2tBY2Nlc3MuanMnO1xuaW1wb3J0IHsgSURpYWdub3N0aWNWYXJpYWJsZUVudHJ5RmlsdGVyRGF0YSB9IGZyb20gJy4uLy4uL2NvbW1vbi9jaGF0TW9kZWwuanMnO1xuaW1wb3J0IHsgSUNoYXRSZXF1ZXN0UHJvYmxlbXNWYXJpYWJsZSwgSUNoYXRSZXF1ZXN0VmFyaWFibGVWYWx1ZSwgSUR5bmFtaWNWYXJpYWJsZSB9IGZyb20gJy4uLy4uL2NvbW1vbi9jaGF0VmFyaWFibGVzLmpzJztcbmltcG9ydCB7IElDaGF0V2lkZ2V0IH0gZnJvbSAnLi4vY2hhdC5qcyc7XG5pbXBvcnQgeyBDaGF0V2lkZ2V0LCBJQ2hhdFdpZGdldENvbnRyaWIgfSBmcm9tICcuLi9jaGF0V2lkZ2V0LmpzJztcbmltcG9ydCB7IENoYXRGaWxlUmVmZXJlbmNlIH0gZnJvbSAnLi9jaGF0RHluYW1pY1ZhcmlhYmxlcy9jaGF0RmlsZVJlZmVyZW5jZS5qcyc7XG5cbmV4cG9ydCBjb25zdCBkeW5hbWljVmFyaWFibGVEZWNvcmF0aW9uVHlwZSA9ICdjaGF0LWR5bmFtaWMtdmFyaWFibGUnO1xuXG4vKipcbiAqIFR5cGUgb2YgZHluYW1pYyB2YXJpYWJsZXMuIENhbiBiZSBlaXRoZXIgYSBmaWxlIHJlZmVyZW5jZSBvclxuICogYW5vdGhlciBkeW5hbWljIHZhcmlhYmxlIChlLmcuLCBhIGAjc3ltYCwgYCNrYmAsIGV0Yy4pLlxuICovXG50eXBlIFREeW5hbWljVmFyaWFibGUgPSBJRHluYW1pY1ZhcmlhYmxlIHwgQ2hhdEZpbGVSZWZlcmVuY2U7XG5cbmV4cG9ydCBjbGFzcyBDaGF0RHluYW1pY1ZhcmlhYmxlTW9kZWwgZXh0ZW5kcyBEaXNwb3NhYmxlIGltcGxlbWVudHMgSUNoYXRXaWRnZXRDb250cmliIHtcblx0cHVibGljIHN0YXRpYyByZWFkb25seSBJRCA9ICdjaGF0RHluYW1pY1ZhcmlhYmxlTW9kZWwnO1xuXG5cdHByaXZhdGUgX3ZhcmlhYmxlczogVER5bmFtaWNWYXJpYWJsZVtdID0gW107XG5cdGdldCB2YXJpYWJsZXMoKTogUmVhZG9ubHlBcnJheTxURHluYW1pY1ZhcmlhYmxlPiB7XG5cdFx0cmV0dXJuIFsuLi50aGlzLl92YXJpYWJsZXNdO1xuXHR9XG5cblx0Z2V0IGlkKCkge1xuXHRcdHJldHVybiBDaGF0RHluYW1pY1ZhcmlhYmxlTW9kZWwuSUQ7XG5cdH1cblxuXHRjb25zdHJ1Y3Rvcihcblx0XHRwcml2YXRlIHJlYWRvbmx5IHdpZGdldDogSUNoYXRXaWRnZXQsXG5cdFx0QElMYWJlbFNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBsYWJlbFNlcnZpY2U6IElMYWJlbFNlcnZpY2UsXG5cdFx0QElDb25maWd1cmF0aW9uU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IGNvbmZpZ1NlcnZpY2U6IElDb25maWd1cmF0aW9uU2VydmljZSxcblx0XHRASUluc3RhbnRpYXRpb25TZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgaW5zdGFudGlhdGlvblNlcnZpY2U6IElJbnN0YW50aWF0aW9uU2VydmljZSxcblx0KSB7XG5cdFx0c3VwZXIoKTtcblxuXHRcdHRoaXMuX3JlZ2lzdGVyKHdpZGdldC5pbnB1dEVkaXRvci5vbkRpZENoYW5nZU1vZGVsQ29udGVudChlID0+IHtcblx0XHRcdGUuY2hhbmdlcy5mb3JFYWNoKGMgPT4ge1xuXHRcdFx0XHQvLyBEb24ndCBtdXRhdGUgZW50cmllcyBpbiBfdmFyaWFibGVzLCBzaW5jZSB0aGV5IHdpbGwgYmUgcmV0dXJuZWQgZnJvbSB0aGUgZ2V0dGVyXG5cdFx0XHRcdHRoaXMuX3ZhcmlhYmxlcyA9IGNvYWxlc2NlKHRoaXMuX3ZhcmlhYmxlcy5tYXAocmVmID0+IHtcblx0XHRcdFx0XHRjb25zdCBpbnRlcnNlY3Rpb24gPSBSYW5nZS5pbnRlcnNlY3RSYW5nZXMocmVmLnJhbmdlLCBjLnJhbmdlKTtcblx0XHRcdFx0XHRpZiAoaW50ZXJzZWN0aW9uICYmICFpbnRlcnNlY3Rpb24uaXNFbXB0eSgpKSB7XG5cdFx0XHRcdFx0XHQvLyBUaGUgcmVmZXJlbmNlIHRleHQgd2FzIGNoYW5nZWQsIGl0J3MgYnJva2VuLlxuXHRcdFx0XHRcdFx0Ly8gQnV0IGlmIHRoZSB3aG9sZSByZWZlcmVuY2UgcmFuZ2Ugd2FzIGRlbGV0ZWQgKGVnIGhpc3RvcnkgbmF2aWdhdGlvbikgdGhlbiBkb24ndCB0cnkgdG8gY2hhbmdlIHRoZSBlZGl0b3IuXG5cdFx0XHRcdFx0XHRpZiAoIVJhbmdlLmNvbnRhaW5zUmFuZ2UoYy5yYW5nZSwgcmVmLnJhbmdlKSkge1xuXHRcdFx0XHRcdFx0XHRjb25zdCByYW5nZVRvRGVsZXRlID0gbmV3IFJhbmdlKHJlZi5yYW5nZS5zdGFydExpbmVOdW1iZXIsIHJlZi5yYW5nZS5zdGFydENvbHVtbiwgcmVmLnJhbmdlLmVuZExpbmVOdW1iZXIsIHJlZi5yYW5nZS5lbmRDb2x1bW4gLSAxKTtcblx0XHRcdFx0XHRcdFx0dGhpcy53aWRnZXQuaW5wdXRFZGl0b3IuZXhlY3V0ZUVkaXRzKHRoaXMuaWQsIFt7XG5cdFx0XHRcdFx0XHRcdFx0cmFuZ2U6IHJhbmdlVG9EZWxldGUsXG5cdFx0XHRcdFx0XHRcdFx0dGV4dDogJycsXG5cdFx0XHRcdFx0XHRcdH1dKTtcblx0XHRcdFx0XHRcdFx0dGhpcy53aWRnZXQucmVmcmVzaFBhcnNlZElucHV0KCk7XG5cdFx0XHRcdFx0XHR9XG5cblx0XHRcdFx0XHRcdC8vIGRpc3Bvc2UgdGhlIHJlZmVyZW5jZSBpZiBwb3NzaWJsZSBiZWZvcmUgZHJvcHBpbmcgaXQgb2ZmXG5cdFx0XHRcdFx0XHRpZiAoJ2Rpc3Bvc2UnIGluIHJlZiAmJiB0eXBlb2YgcmVmLmRpc3Bvc2UgPT09ICdmdW5jdGlvbicpIHtcblx0XHRcdFx0XHRcdFx0cmVmLmRpc3Bvc2UoKTtcblx0XHRcdFx0XHRcdH1cblxuXHRcdFx0XHRcdFx0cmV0dXJuIG51bGw7XG5cdFx0XHRcdFx0fSBlbHNlIGlmIChSYW5nZS5jb21wYXJlUmFuZ2VzVXNpbmdTdGFydHMocmVmLnJhbmdlLCBjLnJhbmdlKSA+IDApIHtcblx0XHRcdFx0XHRcdGNvbnN0IGRlbHRhID0gYy50ZXh0Lmxlbmd0aCAtIGMucmFuZ2VMZW5ndGg7XG5cdFx0XHRcdFx0XHRyZWYucmFuZ2UgPSB7XG5cdFx0XHRcdFx0XHRcdHN0YXJ0TGluZU51bWJlcjogcmVmLnJhbmdlLnN0YXJ0TGluZU51bWJlcixcblx0XHRcdFx0XHRcdFx0c3RhcnRDb2x1bW46IHJlZi5yYW5nZS5zdGFydENvbHVtbiArIGRlbHRhLFxuXHRcdFx0XHRcdFx0XHRlbmRMaW5lTnVtYmVyOiByZWYucmFuZ2UuZW5kTGluZU51bWJlcixcblx0XHRcdFx0XHRcdFx0ZW5kQ29sdW1uOiByZWYucmFuZ2UuZW5kQ29sdW1uICsgZGVsdGEsXG5cdFx0XHRcdFx0XHR9O1xuXG5cdFx0XHRcdFx0XHRyZXR1cm4gcmVmO1xuXHRcdFx0XHRcdH1cblxuXHRcdFx0XHRcdHJldHVybiByZWY7XG5cdFx0XHRcdH0pKTtcblx0XHRcdH0pO1xuXG5cdFx0XHR0aGlzLnVwZGF0ZURlY29yYXRpb25zKCk7XG5cdFx0fSkpO1xuXHR9XG5cblx0Z2V0SW5wdXRTdGF0ZSgpOiBhbnkge1xuXHRcdHJldHVybiB0aGlzLnZhcmlhYmxlc1xuXHRcdFx0Lm1hcCgodmFyaWFibGU6IFREeW5hbWljVmFyaWFibGUpID0+IHtcblx0XHRcdFx0Ly8gcmV0dXJuIHVuZGVybHlpbmcgYElEeW5hbWljVmFyaWFibGVgIG9iamVjdCBmb3IgZmlsZSByZWZlcmVuY2VzXG5cdFx0XHRcdGlmICh2YXJpYWJsZSBpbnN0YW5jZW9mIENoYXRGaWxlUmVmZXJlbmNlKSB7XG5cdFx0XHRcdFx0cmV0dXJuIHZhcmlhYmxlLnJlZmVyZW5jZTtcblx0XHRcdFx0fVxuXG5cdFx0XHRcdHJldHVybiB2YXJpYWJsZTtcblx0XHRcdH0pO1xuXHR9XG5cblx0c2V0SW5wdXRTdGF0ZShzOiBhbnkpOiB2b2lkIHtcblx0XHRpZiAoIUFycmF5LmlzQXJyYXkocykpIHtcblx0XHRcdHMgPSBbXTtcblx0XHR9XG5cblx0XHR0aGlzLmRpc3Bvc2VWYXJpYWJsZXMoKTtcblx0XHR0aGlzLl92YXJpYWJsZXMgPSBbXTtcblxuXHRcdGZvciAoY29uc3QgdmFyaWFibGUgb2Ygcykge1xuXHRcdFx0aWYgKCFpc0R5bmFtaWNWYXJpYWJsZSh2YXJpYWJsZSkpIHtcblx0XHRcdFx0Y29udGludWU7XG5cdFx0XHR9XG5cblx0XHRcdHRoaXMuYWRkUmVmZXJlbmNlKHZhcmlhYmxlKTtcblx0XHR9XG5cdH1cblxuXHRhZGRSZWZlcmVuY2UocmVmOiBJRHluYW1pY1ZhcmlhYmxlKTogdm9pZCB7XG5cdFx0Ly8gdXNlIGBDaGF0RmlsZVJlZmVyZW5jZWAgZm9yIGZpbGUgcmVmZXJlbmNlcyBhbmQgYElEeW5hbWljVmFyaWFibGVgIGZvciBvdGhlciB2YXJpYWJsZXNcblx0XHRjb25zdCBwcm9tcHRTbmlwcGV0c0VuYWJsZWQgPSBQcm9tcHRzQ29uZmlnLmVuYWJsZWQodGhpcy5jb25maWdTZXJ2aWNlKTtcblx0XHRjb25zdCB2YXJpYWJsZSA9IChyZWYuaWQgPT09ICd2c2NvZGUuZmlsZScgJiYgcHJvbXB0U25pcHBldHNFbmFibGVkKVxuXHRcdFx0PyB0aGlzLmluc3RhbnRpYXRpb25TZXJ2aWNlLmNyZWF0ZUluc3RhbmNlKENoYXRGaWxlUmVmZXJlbmNlLCByZWYpXG5cdFx0XHQ6IHJlZjtcblxuXHRcdHRoaXMuX3ZhcmlhYmxlcy5wdXNoKHZhcmlhYmxlKTtcblx0XHR0aGlzLnVwZGF0ZURlY29yYXRpb25zKCk7XG5cdFx0dGhpcy53aWRnZXQucmVmcmVzaFBhcnNlZElucHV0KCk7XG5cblx0XHQvLyBpZiB0aGUgYHByb21wdCBzbmlwcGV0c2AgZmVhdHVyZSBpcyBlbmFibGVkLCBhbmQgZmlsZSBpcyBhIGBwcm9tcHQgc25pcHBldGAsXG5cdFx0Ly8gc3RhcnQgcmVzb2x2aW5nIG5lc3RlZCBmaWxlIHJlZmVyZW5jZXMgaW1tZWRpYXRlbHkgYW5kIHN1YnNjcmliZSB0byB1cGRhdGVzXG5cdFx0aWYgKHZhcmlhYmxlIGluc3RhbmNlb2YgQ2hhdEZpbGVSZWZlcmVuY2UgJiYgdmFyaWFibGUuaXNQcm9tcHRGaWxlKSB7XG5cdFx0XHQvLyBzdWJzY3JpYmUgdG8gdmFyaWFibGUgY2hhbmdlc1xuXHRcdFx0dmFyaWFibGUub25VcGRhdGUoKCkgPT4ge1xuXHRcdFx0XHR0aGlzLnVwZGF0ZURlY29yYXRpb25zKCk7XG5cdFx0XHR9KTtcblx0XHRcdC8vIHN0YXJ0IHJlc29sdmluZyB0aGUgZmlsZSByZWZlcmVuY2VzXG5cdFx0XHR2YXJpYWJsZS5zdGFydCgpO1xuXHRcdH1cblx0fVxuXG5cdHByaXZhdGUgdXBkYXRlRGVjb3JhdGlvbnMoKTogdm9pZCB7XG5cdFx0dGhpcy53aWRnZXQuaW5wdXRFZGl0b3Iuc2V0RGVjb3JhdGlvbnNCeVR5cGUoJ2NoYXQnLCBkeW5hbWljVmFyaWFibGVEZWNvcmF0aW9uVHlwZSwgdGhpcy5fdmFyaWFibGVzLm1hcCgocik6IElEZWNvcmF0aW9uT3B0aW9ucyA9PiAoe1xuXHRcdFx0cmFuZ2U6IHIucmFuZ2UsXG5cdFx0XHRob3Zlck1lc3NhZ2U6IHRoaXMuZ2V0SG92ZXJGb3JSZWZlcmVuY2Uocilcblx0XHR9KSkpO1xuXHR9XG5cblx0cHJpdmF0ZSBnZXRIb3ZlckZvclJlZmVyZW5jZShyZWY6IElEeW5hbWljVmFyaWFibGUpOiBJTWFya2Rvd25TdHJpbmcgfCB1bmRlZmluZWQge1xuXHRcdGNvbnN0IHZhbHVlID0gcmVmLmRhdGE7XG5cdFx0aWYgKFVSSS5pc1VyaSh2YWx1ZSkpIHtcblx0XHRcdHJldHVybiBuZXcgTWFya2Rvd25TdHJpbmcodGhpcy5sYWJlbFNlcnZpY2UuZ2V0VXJpTGFiZWwodmFsdWUsIHsgcmVsYXRpdmU6IHRydWUgfSkpO1xuXHRcdH0gZWxzZSBpZiAoaXNMb2NhdGlvbih2YWx1ZSkpIHtcblx0XHRcdGNvbnN0IHByZWZpeCA9IHJlZi5mdWxsTmFtZSA/IGAgJHtyZWYuZnVsbE5hbWV9YCA6ICcnO1xuXHRcdFx0Y29uc3QgcmFuZ2VTdHJpbmcgPSBgIyR7dmFsdWUucmFuZ2Uuc3RhcnRMaW5lTnVtYmVyfS0ke3ZhbHVlLnJhbmdlLmVuZExpbmVOdW1iZXJ9YDtcblx0XHRcdHJldHVybiBuZXcgTWFya2Rvd25TdHJpbmcocHJlZml4ICsgdGhpcy5sYWJlbFNlcnZpY2UuZ2V0VXJpTGFiZWwodmFsdWUudXJpLCB7IHJlbGF0aXZlOiB0cnVlIH0pICsgcmFuZ2VTdHJpbmcpO1xuXHRcdH0gZWxzZSB7XG5cdFx0XHRyZXR1cm4gdW5kZWZpbmVkO1xuXHRcdH1cblx0fVxuXG5cdC8qKlxuXHQgKiBEaXNwb3NlIGFsbCBleGlzdGluZyB2YXJpYWJsZXMuXG5cdCAqL1xuXHRwcml2YXRlIGRpc3Bvc2VWYXJpYWJsZXMoKTogdm9pZCB7XG5cdFx0Zm9yIChjb25zdCB2YXJpYWJsZSBvZiB0aGlzLl92YXJpYWJsZXMpIHtcblx0XHRcdGlmICgnZGlzcG9zZScgaW4gdmFyaWFibGUgJiYgdHlwZW9mIHZhcmlhYmxlLmRpc3Bvc2UgPT09ICdmdW5jdGlvbicpIHtcblx0XHRcdFx0dmFyaWFibGUuZGlzcG9zZSgpO1xuXHRcdFx0fVxuXHRcdH1cblx0fVxuXG5cdHB1YmxpYyBvdmVycmlkZSBkaXNwb3NlKCkge1xuXHRcdHRoaXMuZGlzcG9zZVZhcmlhYmxlcygpO1xuXHRcdHN1cGVyLmRpc3Bvc2UoKTtcblx0fVxufVxuXG4vKipcbiAqIExvb3NlIGNoZWNrIHRvIGZpbHRlciBvYmplY3RzIHRoYXQgYXJlIG9idmlvdXNseSBtaXNzaW5nIGRhdGFcbiAqL1xuZnVuY3Rpb24gaXNEeW5hbWljVmFyaWFibGUob2JqOiBhbnkpOiBvYmogaXMgSUR5bmFtaWNWYXJpYWJsZSB7XG5cdHJldHVybiBvYmogJiZcblx0XHR0eXBlb2Ygb2JqLmlkID09PSAnc3RyaW5nJyAmJlxuXHRcdFJhbmdlLmlzSVJhbmdlKG9iai5yYW5nZSkgJiZcblx0XHQnZGF0YScgaW4gb2JqO1xufVxuXG5DaGF0V2lkZ2V0LkNPTlRSSUJTLnB1c2goQ2hhdER5bmFtaWNWYXJpYWJsZU1vZGVsKTtcblxuaW50ZXJmYWNlIFNlbGVjdEFuZEluc2VydEFjdGlvbkNvbnRleHQge1xuXHR3aWRnZXQ6IElDaGF0V2lkZ2V0O1xuXHRyYW5nZTogSVJhbmdlO1xufVxuXG5mdW5jdGlvbiBpc1NlbGVjdEFuZEluc2VydEFjdGlvbkNvbnRleHQoY29udGV4dDogYW55KTogY29udGV4dCBpcyBTZWxlY3RBbmRJbnNlcnRBY3Rpb25Db250ZXh0IHtcblx0cmV0dXJuICd3aWRnZXQnIGluIGNvbnRleHQgJiYgJ3JhbmdlJyBpbiBjb250ZXh0O1xufVxuXG5leHBvcnQgY2xhc3MgU2VsZWN0QW5kSW5zZXJ0RmlsZUFjdGlvbiBleHRlbmRzIEFjdGlvbjIge1xuXHRzdGF0aWMgcmVhZG9ubHkgTmFtZSA9ICdmaWxlcyc7XG5cdHN0YXRpYyByZWFkb25seSBJdGVtID0ge1xuXHRcdGxhYmVsOiBsb2NhbGl6ZSgnYWxsRmlsZXMnLCAnQWxsIEZpbGVzJyksXG5cdFx0ZGVzY3JpcHRpb246IGxvY2FsaXplKCdhbGxGaWxlc0Rlc2NyaXB0aW9uJywgJ1NlYXJjaCBmb3IgcmVsZXZhbnQgZmlsZXMgaW4gdGhlIHdvcmtzcGFjZSBhbmQgcHJvdmlkZSBjb250ZXh0IGZyb20gdGhlbScpLFxuXHR9O1xuXHRzdGF0aWMgcmVhZG9ubHkgSUQgPSAnd29ya2JlbmNoLmFjdGlvbi5jaGF0LnNlbGVjdEFuZEluc2VydEZpbGUnO1xuXG5cdGNvbnN0cnVjdG9yKCkge1xuXHRcdHN1cGVyKHtcblx0XHRcdGlkOiBTZWxlY3RBbmRJbnNlcnRGaWxlQWN0aW9uLklELFxuXHRcdFx0dGl0bGU6ICcnIC8vIG5vdCBkaXNwbGF5ZWRcblx0XHR9KTtcblx0fVxuXG5cdGFzeW5jIHJ1bihhY2Nlc3NvcjogU2VydmljZXNBY2Nlc3NvciwgLi4uYXJnczogYW55W10pIHtcblx0XHRjb25zdCB0ZXh0TW9kZWxTZXJ2aWNlID0gYWNjZXNzb3IuZ2V0KElUZXh0TW9kZWxTZXJ2aWNlKTtcblx0XHRjb25zdCBsb2dTZXJ2aWNlID0gYWNjZXNzb3IuZ2V0KElMb2dTZXJ2aWNlKTtcblx0XHRjb25zdCBxdWlja0lucHV0U2VydmljZSA9IGFjY2Vzc29yLmdldChJUXVpY2tJbnB1dFNlcnZpY2UpO1xuXG5cdFx0Y29uc3QgY29udGV4dCA9IGFyZ3NbMF07XG5cdFx0aWYgKCFpc1NlbGVjdEFuZEluc2VydEFjdGlvbkNvbnRleHQoY29udGV4dCkpIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cblx0XHRjb25zdCBkb0NsZWFudXAgPSAoKSA9PiB7XG5cdFx0XHQvLyBGYWlsZWQsIHJlbW92ZSB0aGUgZGFuZ2xpbmcgYGZpbGVgXG5cdFx0XHRjb250ZXh0LndpZGdldC5pbnB1dEVkaXRvci5leGVjdXRlRWRpdHMoJ2NoYXRJbnNlcnRGaWxlJywgW3sgcmFuZ2U6IGNvbnRleHQucmFuZ2UsIHRleHQ6IGBgIH1dKTtcblx0XHR9O1xuXG5cdFx0bGV0IG9wdGlvbnM6IElRdWlja0FjY2Vzc09wdGlvbnMgfCB1bmRlZmluZWQ7XG5cdFx0Ly8gVE9ETzogaGF2ZSBkZWRpY2F0ZWQgVVggZm9yIHRoaXMgaW5zdGVhZCBvZiB1c2luZyB0aGUgcXVpY2sgYWNjZXNzIHBpY2tlclxuXHRcdGNvbnN0IHBpY2tzID0gYXdhaXQgcXVpY2tJbnB1dFNlcnZpY2UucXVpY2tBY2Nlc3MucGljaygnJywgb3B0aW9ucyk7XG5cdFx0aWYgKCFwaWNrcz8ubGVuZ3RoKSB7XG5cdFx0XHRsb2dTZXJ2aWNlLnRyYWNlKCdTZWxlY3RBbmRJbnNlcnRGaWxlQWN0aW9uOiBubyBmaWxlIHNlbGVjdGVkJyk7XG5cdFx0XHRkb0NsZWFudXAoKTtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cblx0XHRjb25zdCBlZGl0b3IgPSBjb250ZXh0LndpZGdldC5pbnB1dEVkaXRvcjtcblx0XHRjb25zdCByYW5nZSA9IGNvbnRleHQucmFuZ2U7XG5cblx0XHQvLyBIYW5kbGUgdGhlIHNwZWNpYWwgY2FzZSBvZiBzZWxlY3RpbmcgYWxsIGZpbGVzXG5cdFx0aWYgKHBpY2tzWzBdID09PSBTZWxlY3RBbmRJbnNlcnRGaWxlQWN0aW9uLkl0ZW0pIHtcblx0XHRcdGNvbnN0IHRleHQgPSBgIyR7U2VsZWN0QW5kSW5zZXJ0RmlsZUFjdGlvbi5OYW1lfWA7XG5cdFx0XHRjb25zdCBzdWNjZXNzID0gZWRpdG9yLmV4ZWN1dGVFZGl0cygnY2hhdEluc2VydEZpbGUnLCBbeyByYW5nZSwgdGV4dDogdGV4dCArICcgJyB9XSk7XG5cdFx0XHRpZiAoIXN1Y2Nlc3MpIHtcblx0XHRcdFx0bG9nU2VydmljZS50cmFjZShgU2VsZWN0QW5kSW5zZXJ0RmlsZUFjdGlvbjogZmFpbGVkIHRvIGluc2VydCBcIiR7dGV4dH1cImApO1xuXHRcdFx0XHRkb0NsZWFudXAoKTtcblx0XHRcdH1cblx0XHRcdHJldHVybjtcblx0XHR9XG5cblx0XHQvLyBIYW5kbGUgdGhlIGNhc2Ugb2Ygc2VsZWN0aW5nIGEgc3BlY2lmaWMgZmlsZVxuXHRcdGNvbnN0IHJlc291cmNlID0gKHBpY2tzWzBdIGFzIHVua25vd24gYXMgeyByZXNvdXJjZTogdW5rbm93biB9KS5yZXNvdXJjZSBhcyBVUkk7XG5cdFx0aWYgKCF0ZXh0TW9kZWxTZXJ2aWNlLmNhbkhhbmRsZVJlc291cmNlKHJlc291cmNlKSkge1xuXHRcdFx0bG9nU2VydmljZS50cmFjZSgnU2VsZWN0QW5kSW5zZXJ0RmlsZUFjdGlvbjogbm9uLXRleHQgcmVzb3VyY2Ugc2VsZWN0ZWQnKTtcblx0XHRcdGRvQ2xlYW51cCgpO1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblxuXHRcdGNvbnN0IGZpbGVOYW1lID0gYmFzZW5hbWUocmVzb3VyY2UpO1xuXHRcdGNvbnN0IHRleHQgPSBgI2ZpbGU6JHtmaWxlTmFtZX1gO1xuXHRcdGNvbnN0IHN1Y2Nlc3MgPSBlZGl0b3IuZXhlY3V0ZUVkaXRzKCdjaGF0SW5zZXJ0RmlsZScsIFt7IHJhbmdlLCB0ZXh0OiB0ZXh0ICsgJyAnIH1dKTtcblx0XHRpZiAoIXN1Y2Nlc3MpIHtcblx0XHRcdGxvZ1NlcnZpY2UudHJhY2UoYFNlbGVjdEFuZEluc2VydEZpbGVBY3Rpb246IGZhaWxlZCB0byBpbnNlcnQgXCIke3RleHR9XCJgKTtcblx0XHRcdGRvQ2xlYW51cCgpO1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblxuXHRcdGNvbnRleHQud2lkZ2V0LmdldENvbnRyaWI8Q2hhdER5bmFtaWNWYXJpYWJsZU1vZGVsPihDaGF0RHluYW1pY1ZhcmlhYmxlTW9kZWwuSUQpPy5hZGRSZWZlcmVuY2Uoe1xuXHRcdFx0aWQ6ICd2c2NvZGUuZmlsZScsXG5cdFx0XHRpc0ZpbGU6IHRydWUsXG5cdFx0XHRwcmVmaXg6ICdmaWxlJyxcblx0XHRcdHJhbmdlOiB7IHN0YXJ0TGluZU51bWJlcjogcmFuZ2Uuc3RhcnRMaW5lTnVtYmVyLCBzdGFydENvbHVtbjogcmFuZ2Uuc3RhcnRDb2x1bW4sIGVuZExpbmVOdW1iZXI6IHJhbmdlLmVuZExpbmVOdW1iZXIsIGVuZENvbHVtbjogcmFuZ2Uuc3RhcnRDb2x1bW4gKyB0ZXh0Lmxlbmd0aCB9LFxuXHRcdFx0ZGF0YTogcmVzb3VyY2Vcblx0XHR9KTtcblx0fVxufVxucmVnaXN0ZXJBY3Rpb24yKFNlbGVjdEFuZEluc2VydEZpbGVBY3Rpb24pO1xuXG5leHBvcnQgY2xhc3MgU2VsZWN0QW5kSW5zZXJ0Rm9sZGVyQWN0aW9uIGV4dGVuZHMgQWN0aW9uMiB7XG5cdHN0YXRpYyByZWFkb25seSBOYW1lID0gJ2ZvbGRlcic7XG5cdHN0YXRpYyByZWFkb25seSBJRCA9ICd3b3JrYmVuY2guYWN0aW9uLmNoYXQuc2VsZWN0QW5kSW5zZXJ0Rm9sZGVyJztcblxuXHRjb25zdHJ1Y3RvcigpIHtcblx0XHRzdXBlcih7XG5cdFx0XHRpZDogU2VsZWN0QW5kSW5zZXJ0Rm9sZGVyQWN0aW9uLklELFxuXHRcdFx0dGl0bGU6ICcnIC8vIG5vdCBkaXNwbGF5ZWRcblx0XHR9KTtcblx0fVxuXG5cdGFzeW5jIHJ1bihhY2Nlc3NvcjogU2VydmljZXNBY2Nlc3NvciwgLi4uYXJnczogYW55W10pIHtcblx0XHRjb25zdCBsb2dTZXJ2aWNlID0gYWNjZXNzb3IuZ2V0KElMb2dTZXJ2aWNlKTtcblxuXHRcdGNvbnN0IGNvbnRleHQgPSBhcmdzWzBdO1xuXHRcdGlmICghaXNTZWxlY3RBbmRJbnNlcnRBY3Rpb25Db250ZXh0KGNvbnRleHQpKSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXG5cdFx0Y29uc3QgZG9DbGVhbnVwID0gKCkgPT4ge1xuXHRcdFx0Ly8gRmFpbGVkLCByZW1vdmUgdGhlIGRhbmdsaW5nIGBmb2xkZXJgXG5cdFx0XHRjb250ZXh0LndpZGdldC5pbnB1dEVkaXRvci5leGVjdXRlRWRpdHMoJ2NoYXRJbnNlcnRGb2xkZXInLCBbeyByYW5nZTogY29udGV4dC5yYW5nZSwgdGV4dDogYGAgfV0pO1xuXHRcdH07XG5cblx0XHRjb25zdCBmb2xkZXIgPSBhd2FpdCBjcmVhdGVGb2xkZXJRdWlja1BpY2soYWNjZXNzb3IpO1xuXHRcdGlmICghZm9sZGVyKSB7XG5cdFx0XHRsb2dTZXJ2aWNlLnRyYWNlKCdTZWxlY3RBbmRJbnNlcnRGb2xkZXJBY3Rpb246IG5vIGZvbGRlciBzZWxlY3RlZCcpO1xuXHRcdFx0ZG9DbGVhbnVwKCk7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXG5cdFx0Y29uc3QgZWRpdG9yID0gY29udGV4dC53aWRnZXQuaW5wdXRFZGl0b3I7XG5cdFx0Y29uc3QgcmFuZ2UgPSBjb250ZXh0LnJhbmdlO1xuXG5cdFx0Y29uc3QgZm9sZGVyTmFtZSA9IGJhc2VuYW1lKGZvbGRlcik7XG5cdFx0Y29uc3QgdGV4dCA9IGAjZm9sZGVyOiR7Zm9sZGVyTmFtZX1gO1xuXHRcdGNvbnN0IHN1Y2Nlc3MgPSBlZGl0b3IuZXhlY3V0ZUVkaXRzKCdjaGF0SW5zZXJ0Rm9sZGVyJywgW3sgcmFuZ2UsIHRleHQ6IHRleHQgKyAnICcgfV0pO1xuXHRcdGlmICghc3VjY2Vzcykge1xuXHRcdFx0bG9nU2VydmljZS50cmFjZShgU2VsZWN0QW5kSW5zZXJ0Rm9sZGVyQWN0aW9uOiBmYWlsZWQgdG8gaW5zZXJ0IFwiJHt0ZXh0fVwiYCk7XG5cdFx0XHRkb0NsZWFudXAoKTtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cblx0XHRjb250ZXh0LndpZGdldC5nZXRDb250cmliPENoYXREeW5hbWljVmFyaWFibGVNb2RlbD4oQ2hhdER5bmFtaWNWYXJpYWJsZU1vZGVsLklEKT8uYWRkUmVmZXJlbmNlKHtcblx0XHRcdGlkOiAndnNjb2RlLmZvbGRlcicsXG5cdFx0XHRpc0ZpbGU6IGZhbHNlLFxuXHRcdFx0aXNEaXJlY3Rvcnk6IHRydWUsXG5cdFx0XHRwcmVmaXg6ICdmb2xkZXInLFxuXHRcdFx0cmFuZ2U6IHsgc3RhcnRMaW5lTnVtYmVyOiByYW5nZS5zdGFydExpbmVOdW1iZXIsIHN0YXJ0Q29sdW1uOiByYW5nZS5zdGFydENvbHVtbiwgZW5kTGluZU51bWJlcjogcmFuZ2UuZW5kTGluZU51bWJlciwgZW5kQ29sdW1uOiByYW5nZS5zdGFydENvbHVtbiArIHRleHQubGVuZ3RoIH0sXG5cdFx0XHRkYXRhOiBmb2xkZXJcblx0XHR9KTtcblx0fVxuXG59XG5yZWdpc3RlckFjdGlvbjIoU2VsZWN0QW5kSW5zZXJ0Rm9sZGVyQWN0aW9uKTtcblxuZXhwb3J0IGFzeW5jIGZ1bmN0aW9uIGNyZWF0ZUZvbGRlclF1aWNrUGljayhhY2Nlc3NvcjogU2VydmljZXNBY2Nlc3Nvcik6IFByb21pc2U8VVJJIHwgdW5kZWZpbmVkPiB7XG5cdGNvbnN0IHF1aWNrSW5wdXRTZXJ2aWNlID0gYWNjZXNzb3IuZ2V0KElRdWlja0lucHV0U2VydmljZSk7XG5cdGNvbnN0IHNlYXJjaFNlcnZpY2UgPSBhY2Nlc3Nvci5nZXQoSVNlYXJjaFNlcnZpY2UpO1xuXHRjb25zdCBjb25maWd1cmF0aW9uU2VydmljZSA9IGFjY2Vzc29yLmdldChJQ29uZmlndXJhdGlvblNlcnZpY2UpO1xuXHRjb25zdCB3b3Jrc3BhY2VTZXJ2aWNlID0gYWNjZXNzb3IuZ2V0KElXb3Jrc3BhY2VDb250ZXh0U2VydmljZSk7XG5cdGNvbnN0IGZpbGVTZXJ2aWNlID0gYWNjZXNzb3IuZ2V0KElGaWxlU2VydmljZSk7XG5cdGNvbnN0IGxhYmVsU2VydmljZSA9IGFjY2Vzc29yLmdldChJTGFiZWxTZXJ2aWNlKTtcblxuXHRjb25zdCB3b3Jrc3BhY2VzID0gd29ya3NwYWNlU2VydmljZS5nZXRXb3Jrc3BhY2UoKS5mb2xkZXJzLm1hcChmb2xkZXIgPT4gZm9sZGVyLnVyaSk7XG5cdGNvbnN0IHRvcExldmVsRm9sZGVySXRlbXMgPSAoYXdhaXQgZ2V0VG9wTGV2ZWxGb2xkZXJzKHdvcmtzcGFjZXMsIGZpbGVTZXJ2aWNlKSkubWFwKGNyZWF0ZVF1aWNrUGlja0l0ZW0pO1xuXG5cdGNvbnN0IHF1aWNrUGljayA9IHF1aWNrSW5wdXRTZXJ2aWNlLmNyZWF0ZVF1aWNrUGljaygpO1xuXHRxdWlja1BpY2sucGxhY2Vob2xkZXIgPSAnU2VhcmNoIGZvbGRlciBieSBuYW1lJztcblx0cXVpY2tQaWNrLml0ZW1zID0gdG9wTGV2ZWxGb2xkZXJJdGVtcztcblxuXHRyZXR1cm4gYXdhaXQgbmV3IFByb21pc2U8VVJJIHwgdW5kZWZpbmVkPihfcmVzb2x2ZSA9PiB7XG5cblx0XHRjb25zdCBkaXNwb3NhYmxlcyA9IG5ldyBEaXNwb3NhYmxlU3RvcmUoKTtcblx0XHRjb25zdCByZXNvbHZlID0gKHJlczogVVJJIHwgdW5kZWZpbmVkKSA9PiB7XG5cdFx0XHRfcmVzb2x2ZShyZXMpO1xuXHRcdFx0ZGlzcG9zYWJsZXMuZGlzcG9zZSgpO1xuXHRcdFx0cXVpY2tQaWNrLmRpc3Bvc2UoKTtcblx0XHR9O1xuXG5cdFx0ZGlzcG9zYWJsZXMuYWRkKHF1aWNrUGljay5vbkRpZENoYW5nZVZhbHVlKGFzeW5jIHZhbHVlID0+IHtcblx0XHRcdGlmICh2YWx1ZSA9PT0gJycpIHtcblx0XHRcdFx0cXVpY2tQaWNrLml0ZW1zID0gdG9wTGV2ZWxGb2xkZXJJdGVtcztcblx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0fVxuXG5cdFx0XHRjb25zdCB3b3Jrc3BhY2VGb2xkZXJzID0gYXdhaXQgUHJvbWlzZS5hbGwoXG5cdFx0XHRcdHdvcmtzcGFjZXMubWFwKHdvcmtzcGFjZSA9PlxuXHRcdFx0XHRcdHNlYXJjaEZvbGRlcnMoXG5cdFx0XHRcdFx0XHR3b3Jrc3BhY2UsXG5cdFx0XHRcdFx0XHR2YWx1ZSxcblx0XHRcdFx0XHRcdHRydWUsXG5cdFx0XHRcdFx0XHR1bmRlZmluZWQsXG5cdFx0XHRcdFx0XHR1bmRlZmluZWQsXG5cdFx0XHRcdFx0XHRjb25maWd1cmF0aW9uU2VydmljZSxcblx0XHRcdFx0XHRcdHNlYXJjaFNlcnZpY2Vcblx0XHRcdFx0XHQpXG5cdFx0XHRcdCkpO1xuXG5cdFx0XHRxdWlja1BpY2suaXRlbXMgPSB3b3Jrc3BhY2VGb2xkZXJzLmZsYXQoKS5tYXAoY3JlYXRlUXVpY2tQaWNrSXRlbSk7XG5cdFx0fSkpO1xuXG5cdFx0ZGlzcG9zYWJsZXMuYWRkKHF1aWNrUGljay5vbkRpZEFjY2VwdCgoZSkgPT4ge1xuXHRcdFx0Y29uc3QgdmFsdWUgPSAocXVpY2tQaWNrLnNlbGVjdGVkSXRlbXNbMF0gYXMgYW55KT8ucmVzb3VyY2U7XG5cdFx0XHRyZXNvbHZlKHZhbHVlKTtcblx0XHR9KSk7XG5cblx0XHRkaXNwb3NhYmxlcy5hZGQocXVpY2tQaWNrLm9uRGlkSGlkZSgoKSA9PiB7XG5cdFx0XHRyZXNvbHZlKHVuZGVmaW5lZCk7XG5cdFx0fSkpO1xuXG5cdFx0cXVpY2tQaWNrLnNob3coKTtcblx0fSk7XG5cblx0ZnVuY3Rpb24gY3JlYXRlUXVpY2tQaWNrSXRlbShmb2xkZXI6IFVSSSk6IElRdWlja1BpY2tJdGVtICYgeyByZXNvdXJjZTogVVJJIH0ge1xuXHRcdHJldHVybiB7XG5cdFx0XHR0eXBlOiAnaXRlbScsXG5cdFx0XHRpZDogZm9sZGVyLnRvU3RyaW5nKCksXG5cdFx0XHRyZXNvdXJjZTogZm9sZGVyLFxuXHRcdFx0YWx3YXlzU2hvdzogdHJ1ZSxcblx0XHRcdGxhYmVsOiBiYXNlbmFtZShmb2xkZXIpLFxuXHRcdFx0ZGVzY3JpcHRpb246IGxhYmVsU2VydmljZS5nZXRVcmlMYWJlbChkaXJuYW1lKGZvbGRlciksIHsgcmVsYXRpdmU6IHRydWUgfSksXG5cdFx0XHRpY29uQ2xhc3M6IFRoZW1lSWNvbi5hc0NsYXNzTmFtZShDb2RpY29uLmZvbGRlciksXG5cdFx0fTtcblx0fVxufVxuXG5leHBvcnQgYXN5bmMgZnVuY3Rpb24gZ2V0VG9wTGV2ZWxGb2xkZXJzKHdvcmtzcGFjZXM6IFVSSVtdLCBmaWxlU2VydmljZTogSUZpbGVTZXJ2aWNlKTogUHJvbWlzZTxVUklbXT4ge1xuXHRjb25zdCBmb2xkZXJzOiBVUklbXSA9IFtdO1xuXHRmb3IgKGNvbnN0IHdvcmtzcGFjZSBvZiB3b3Jrc3BhY2VzKSB7XG5cdFx0Y29uc3QgZmlsZVN5c3RlbVByb3ZpZGVyID0gZmlsZVNlcnZpY2UuZ2V0UHJvdmlkZXIod29ya3NwYWNlLnNjaGVtZSk7XG5cdFx0aWYgKCFmaWxlU3lzdGVtUHJvdmlkZXIpIHtcblx0XHRcdGNvbnRpbnVlO1xuXHRcdH1cblxuXHRcdGNvbnN0IGVudHJpZXMgPSBhd2FpdCBmaWxlU3lzdGVtUHJvdmlkZXIucmVhZGRpcih3b3Jrc3BhY2UpO1xuXHRcdGZvciAoY29uc3QgW25hbWUsIHR5cGVdIG9mIGVudHJpZXMpIHtcblx0XHRcdGNvbnN0IGVudHJ5UmVzb3VyY2UgPSBqb2luUGF0aCh3b3Jrc3BhY2UsIG5hbWUpO1xuXHRcdFx0aWYgKHR5cGUgPT09IEZpbGVUeXBlLkRpcmVjdG9yeSkge1xuXHRcdFx0XHRmb2xkZXJzLnB1c2goZW50cnlSZXNvdXJjZSk7XG5cdFx0XHR9XG5cdFx0fVxuXHR9XG5cblx0cmV0dXJuIGZvbGRlcnM7XG59XG5cbmV4cG9ydCBhc3luYyBmdW5jdGlvbiBzZWFyY2hGb2xkZXJzKFxuXHR3b3Jrc3BhY2U6IFVSSSxcblx0cGF0dGVybjogc3RyaW5nLFxuXHRmdXp6eU1hdGNoOiBib29sZWFuLFxuXHR0b2tlbjogQ2FuY2VsbGF0aW9uVG9rZW4gfCB1bmRlZmluZWQsXG5cdGNhY2hlS2V5OiBzdHJpbmcgfCB1bmRlZmluZWQsXG5cdGNvbmZpZ3VyYXRpb25TZXJ2aWNlOiBJQ29uZmlndXJhdGlvblNlcnZpY2UsXG5cdHNlYXJjaFNlcnZpY2U6IElTZWFyY2hTZXJ2aWNlXG4pOiBQcm9taXNlPFVSSVtdPiB7XG5cdGNvbnN0IHNlZ21lbnRNYXRjaFBhdHRlcm4gPSBjYXNlSW5zZW5zaXRpdmVHbG9iUGF0dGVybihmdXp6eU1hdGNoID8gZnV6enlNYXRjaGluZ0dsb2JQYXR0ZXJuKHBhdHRlcm4pIDogY29udGlub3VzTWF0Y2hpbmdHbG9iUGF0dGVybihwYXR0ZXJuKSk7XG5cblx0Y29uc3Qgc2VhcmNoRXhjbHVkZVBhdHRlcm4gPSBnZXRFeGNsdWRlcyhjb25maWd1cmF0aW9uU2VydmljZS5nZXRWYWx1ZTxJU2VhcmNoQ29uZmlndXJhdGlvbj4oeyByZXNvdXJjZTogd29ya3NwYWNlIH0pKSB8fCB7fTtcblx0Y29uc3Qgc2VhcmNoT3B0aW9uczogSUZpbGVRdWVyeSA9IHtcblx0XHRmb2xkZXJRdWVyaWVzOiBbe1xuXHRcdFx0Zm9sZGVyOiB3b3Jrc3BhY2UsXG5cdFx0XHRkaXNyZWdhcmRJZ25vcmVGaWxlczogY29uZmlndXJhdGlvblNlcnZpY2UuZ2V0VmFsdWU8Ym9vbGVhbj4oJ2V4cGxvcmVyLmV4Y2x1ZGVHaXRJZ25vcmUnKSxcblx0XHR9XSxcblx0XHR0eXBlOiBRdWVyeVR5cGUuRmlsZSxcblx0XHRzaG91bGRHbG9iTWF0Y2hGaWxlUGF0dGVybjogdHJ1ZSxcblx0XHRjYWNoZUtleSxcblx0XHRleGNsdWRlUGF0dGVybjogc2VhcmNoRXhjbHVkZVBhdHRlcm4sXG5cdH07XG5cblx0bGV0IGZvbGRlclJlc3VsdHM6IElTZWFyY2hDb21wbGV0ZSB8IHVuZGVmaW5lZDtcblx0dHJ5IHtcblx0XHRmb2xkZXJSZXN1bHRzID0gYXdhaXQgc2VhcmNoU2VydmljZS5maWxlU2VhcmNoKHsgLi4uc2VhcmNoT3B0aW9ucywgZmlsZVBhdHRlcm46IGAqKi8ke3NlZ21lbnRNYXRjaFBhdHRlcm59LyoqYCB9LCB0b2tlbik7XG5cdH0gY2F0Y2ggKGUpIHtcblx0XHRpZiAoIWlzQ2FuY2VsbGF0aW9uRXJyb3IoZSkpIHtcblx0XHRcdHRocm93IGU7XG5cdFx0fVxuXHR9XG5cblx0aWYgKCFmb2xkZXJSZXN1bHRzIHx8IHRva2VuPy5pc0NhbmNlbGxhdGlvblJlcXVlc3RlZCkge1xuXHRcdHJldHVybiBbXTtcblx0fVxuXG5cdGNvbnN0IGZvbGRlclJlc291cmNlcyA9IGdldE1hdGNoaW5nRm9sZGVyc0Zyb21GaWxlcyhmb2xkZXJSZXN1bHRzLnJlc3VsdHMubWFwKHJlc3VsdCA9PiByZXN1bHQucmVzb3VyY2UpLCB3b3Jrc3BhY2UsIHNlZ21lbnRNYXRjaFBhdHRlcm4pO1xuXHRyZXR1cm4gZm9sZGVyUmVzb3VyY2VzO1xufVxuXG5mdW5jdGlvbiBmdXp6eU1hdGNoaW5nR2xvYlBhdHRlcm4ocGF0dGVybjogc3RyaW5nKTogc3RyaW5nIHtcblx0aWYgKCFwYXR0ZXJuKSB7XG5cdFx0cmV0dXJuICcqJztcblx0fVxuXHRyZXR1cm4gJyonICsgcGF0dGVybi5zcGxpdCgnJykuam9pbignKicpICsgJyonO1xufVxuXG5mdW5jdGlvbiBjb250aW5vdXNNYXRjaGluZ0dsb2JQYXR0ZXJuKHBhdHRlcm46IHN0cmluZyk6IHN0cmluZyB7XG5cdGlmICghcGF0dGVybikge1xuXHRcdHJldHVybiAnKic7XG5cdH1cblx0cmV0dXJuICcqJyArIHBhdHRlcm4gKyAnKic7XG59XG5cbmZ1bmN0aW9uIGNhc2VJbnNlbnNpdGl2ZUdsb2JQYXR0ZXJuKHBhdHRlcm46IHN0cmluZyk6IHN0cmluZyB7XG5cdGxldCBjYXNlSW5zZW5zaXRpdmVGaWxlUGF0dGVybiA9ICcnO1xuXHRmb3IgKGxldCBpID0gMDsgaSA8IHBhdHRlcm4ubGVuZ3RoOyBpKyspIHtcblx0XHRjb25zdCBjaGFyID0gcGF0dGVybltpXTtcblx0XHRpZiAoL1thLXpBLVpdLy50ZXN0KGNoYXIpKSB7XG5cdFx0XHRjYXNlSW5zZW5zaXRpdmVGaWxlUGF0dGVybiArPSBgWyR7Y2hhci50b0xvd2VyQ2FzZSgpfSR7Y2hhci50b1VwcGVyQ2FzZSgpfV1gO1xuXHRcdH0gZWxzZSB7XG5cdFx0XHRjYXNlSW5zZW5zaXRpdmVGaWxlUGF0dGVybiArPSBjaGFyO1xuXHRcdH1cblx0fVxuXHRyZXR1cm4gY2FzZUluc2Vuc2l0aXZlRmlsZVBhdHRlcm47XG59XG5cblxuLy8gVE9ETzogcmVtb3ZlIHRoaXMgYW5kIGhhdmUgc3VwcG9ydCBmcm9tIHRoZSBzZWFyY2ggc2VydmljZVxuZnVuY3Rpb24gZ2V0TWF0Y2hpbmdGb2xkZXJzRnJvbUZpbGVzKHJlc291cmNlczogVVJJW10sIHdvcmtzcGFjZTogVVJJLCBzZWdtZW50TWF0Y2hQYXR0ZXJuOiBzdHJpbmcpOiBVUklbXSB7XG5cdGNvbnN0IHVuaXF1ZUZvbGRlcnMgPSBuZXcgUmVzb3VyY2VTZXQoKTtcblx0Zm9yIChjb25zdCByZXNvdXJjZSBvZiByZXNvdXJjZXMpIHtcblx0XHRjb25zdCByZWxhdGl2ZVBhdGhUb1Jvb3QgPSByZWxhdGl2ZVBhdGgod29ya3NwYWNlLCByZXNvdXJjZSk7XG5cdFx0aWYgKCFyZWxhdGl2ZVBhdGhUb1Jvb3QpIHtcblx0XHRcdHRocm93IG5ldyBFcnJvcignUmVzb3VyY2UgaXMgbm90IGEgY2hpbGQgb2YgdGhlIHdvcmtzcGFjZScpO1xuXHRcdH1cblxuXHRcdGxldCBkaXJSZXNvdXJjZSA9IHdvcmtzcGFjZTtcblx0XHRjb25zdCBzdGF0cyA9IHJlbGF0aXZlUGF0aFRvUm9vdC5zcGxpdCgnLycpLnNsaWNlKDAsIC0xKTtcblx0XHRmb3IgKGNvbnN0IHN0YXQgb2Ygc3RhdHMpIHtcblx0XHRcdGRpclJlc291cmNlID0gZGlyUmVzb3VyY2Uud2l0aCh7IHBhdGg6IGAke2RpclJlc291cmNlLnBhdGh9LyR7c3RhdH1gIH0pO1xuXHRcdFx0dW5pcXVlRm9sZGVycy5hZGQoZGlyUmVzb3VyY2UpO1xuXHRcdH1cblx0fVxuXG5cdGNvbnN0IG1hdGNoaW5nRm9sZGVyczogVVJJW10gPSBbXTtcblx0Zm9yIChjb25zdCBmb2xkZXJSZXNvdXJjZSBvZiB1bmlxdWVGb2xkZXJzKSB7XG5cdFx0Y29uc3Qgc3RhdHMgPSBmb2xkZXJSZXNvdXJjZS5wYXRoLnNwbGl0KCcvJyk7XG5cdFx0Y29uc3QgZGlyU3RhdCA9IHN0YXRzW3N0YXRzLmxlbmd0aCAtIDFdO1xuXHRcdGlmICghZGlyU3RhdCB8fCAhZ2xvYi5tYXRjaChzZWdtZW50TWF0Y2hQYXR0ZXJuLCBkaXJTdGF0KSkge1xuXHRcdFx0Y29udGludWU7XG5cdFx0fVxuXG5cdFx0bWF0Y2hpbmdGb2xkZXJzLnB1c2goZm9sZGVyUmVzb3VyY2UpO1xuXHR9XG5cblx0cmV0dXJuIG1hdGNoaW5nRm9sZGVycztcbn1cblxuZXhwb3J0IGNsYXNzIFNlbGVjdEFuZEluc2VydFN5bUFjdGlvbiBleHRlbmRzIEFjdGlvbjIge1xuXHRzdGF0aWMgcmVhZG9ubHkgTmFtZSA9ICdzeW1ib2xzJztcblx0c3RhdGljIHJlYWRvbmx5IElEID0gJ3dvcmtiZW5jaC5hY3Rpb24uY2hhdC5zZWxlY3RBbmRJbnNlcnRTeW0nO1xuXG5cdGNvbnN0cnVjdG9yKCkge1xuXHRcdHN1cGVyKHtcblx0XHRcdGlkOiBTZWxlY3RBbmRJbnNlcnRTeW1BY3Rpb24uSUQsXG5cdFx0XHR0aXRsZTogJycgLy8gbm90IGRpc3BsYXllZFxuXHRcdH0pO1xuXHR9XG5cblx0YXN5bmMgcnVuKGFjY2Vzc29yOiBTZXJ2aWNlc0FjY2Vzc29yLCAuLi5hcmdzOiBhbnlbXSkge1xuXHRcdGNvbnN0IHRleHRNb2RlbFNlcnZpY2UgPSBhY2Nlc3Nvci5nZXQoSVRleHRNb2RlbFNlcnZpY2UpO1xuXHRcdGNvbnN0IGxvZ1NlcnZpY2UgPSBhY2Nlc3Nvci5nZXQoSUxvZ1NlcnZpY2UpO1xuXHRcdGNvbnN0IHF1aWNrSW5wdXRTZXJ2aWNlID0gYWNjZXNzb3IuZ2V0KElRdWlja0lucHV0U2VydmljZSk7XG5cblx0XHRjb25zdCBjb250ZXh0ID0gYXJnc1swXTtcblx0XHRpZiAoIWlzU2VsZWN0QW5kSW5zZXJ0QWN0aW9uQ29udGV4dChjb250ZXh0KSkge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblxuXHRcdGNvbnN0IGRvQ2xlYW51cCA9ICgpID0+IHtcblx0XHRcdC8vIEZhaWxlZCwgcmVtb3ZlIHRoZSBkYW5nbGluZyBgc3ltYFxuXHRcdFx0Y29udGV4dC53aWRnZXQuaW5wdXRFZGl0b3IuZXhlY3V0ZUVkaXRzKCdjaGF0SW5zZXJ0U3ltJywgW3sgcmFuZ2U6IGNvbnRleHQucmFuZ2UsIHRleHQ6IGBgIH1dKTtcblx0XHR9O1xuXG5cdFx0Ly8gVE9ETzogaGF2ZSBkZWRpY2F0ZWQgVVggZm9yIHRoaXMgaW5zdGVhZCBvZiB1c2luZyB0aGUgcXVpY2sgYWNjZXNzIHBpY2tlclxuXHRcdGNvbnN0IHBpY2tzID0gYXdhaXQgcXVpY2tJbnB1dFNlcnZpY2UucXVpY2tBY2Nlc3MucGljaygnIycsIHsgZW5hYmxlZFByb3ZpZGVyUHJlZml4ZXM6IFsnIyddIH0pO1xuXHRcdGlmICghcGlja3M/Lmxlbmd0aCkge1xuXHRcdFx0bG9nU2VydmljZS50cmFjZSgnU2VsZWN0QW5kSW5zZXJ0U3ltQWN0aW9uOiBubyBzeW1ib2wgc2VsZWN0ZWQnKTtcblx0XHRcdGRvQ2xlYW51cCgpO1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblxuXHRcdGNvbnN0IGVkaXRvciA9IGNvbnRleHQud2lkZ2V0LmlucHV0RWRpdG9yO1xuXHRcdGNvbnN0IHJhbmdlID0gY29udGV4dC5yYW5nZTtcblxuXHRcdC8vIEhhbmRsZSB0aGUgY2FzZSBvZiBzZWxlY3RpbmcgYSBzcGVjaWZpYyBmaWxlXG5cdFx0Y29uc3Qgc3ltYm9sID0gKHBpY2tzWzBdIGFzIElTeW1ib2xRdWlja1BpY2tJdGVtKS5zeW1ib2w7XG5cdFx0aWYgKCFzeW1ib2wgfHwgIXRleHRNb2RlbFNlcnZpY2UuY2FuSGFuZGxlUmVzb3VyY2Uoc3ltYm9sLmxvY2F0aW9uLnVyaSkpIHtcblx0XHRcdGxvZ1NlcnZpY2UudHJhY2UoJ1NlbGVjdEFuZEluc2VydFN5bUFjdGlvbjogbm9uLXRleHQgcmVzb3VyY2Ugc2VsZWN0ZWQnKTtcblx0XHRcdGRvQ2xlYW51cCgpO1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblxuXHRcdGNvbnN0IHRleHQgPSBgI3N5bToke3N5bWJvbC5uYW1lfWA7XG5cdFx0Y29uc3Qgc3VjY2VzcyA9IGVkaXRvci5leGVjdXRlRWRpdHMoJ2NoYXRJbnNlcnRTeW0nLCBbeyByYW5nZSwgdGV4dDogdGV4dCArICcgJyB9XSk7XG5cdFx0aWYgKCFzdWNjZXNzKSB7XG5cdFx0XHRsb2dTZXJ2aWNlLnRyYWNlKGBTZWxlY3RBbmRJbnNlcnRTeW1BY3Rpb246IGZhaWxlZCB0byBpbnNlcnQgXCIke3RleHR9XCJgKTtcblx0XHRcdGRvQ2xlYW51cCgpO1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblxuXHRcdGNvbnRleHQud2lkZ2V0LmdldENvbnRyaWI8Q2hhdER5bmFtaWNWYXJpYWJsZU1vZGVsPihDaGF0RHluYW1pY1ZhcmlhYmxlTW9kZWwuSUQpPy5hZGRSZWZlcmVuY2Uoe1xuXHRcdFx0aWQ6ICd2c2NvZGUuc3ltYm9sJyxcblx0XHRcdHByZWZpeDogJ3N5bWJvbCcsXG5cdFx0XHRyYW5nZTogeyBzdGFydExpbmVOdW1iZXI6IHJhbmdlLnN0YXJ0TGluZU51bWJlciwgc3RhcnRDb2x1bW46IHJhbmdlLnN0YXJ0Q29sdW1uLCBlbmRMaW5lTnVtYmVyOiByYW5nZS5lbmRMaW5lTnVtYmVyLCBlbmRDb2x1bW46IHJhbmdlLnN0YXJ0Q29sdW1uICsgdGV4dC5sZW5ndGggfSxcblx0XHRcdGRhdGE6IHN5bWJvbC5sb2NhdGlvblxuXHRcdH0pO1xuXHR9XG59XG5yZWdpc3RlckFjdGlvbjIoU2VsZWN0QW5kSW5zZXJ0U3ltQWN0aW9uKTtcblxuZXhwb3J0IGludGVyZmFjZSBJQWRkRHluYW1pY1ZhcmlhYmxlQ29udGV4dCB7XG5cdGlkOiBzdHJpbmc7XG5cdHdpZGdldDogSUNoYXRXaWRnZXQ7XG5cdHJhbmdlOiBJUmFuZ2U7XG5cdHZhcmlhYmxlRGF0YTogSUNoYXRSZXF1ZXN0VmFyaWFibGVWYWx1ZTtcblx0Y29tbWFuZD86IENvbW1hbmQ7XG59XG5cbmZ1bmN0aW9uIGlzQWRkRHluYW1pY1ZhcmlhYmxlQ29udGV4dChjb250ZXh0OiBhbnkpOiBjb250ZXh0IGlzIElBZGREeW5hbWljVmFyaWFibGVDb250ZXh0IHtcblx0cmV0dXJuICd3aWRnZXQnIGluIGNvbnRleHQgJiZcblx0XHQncmFuZ2UnIGluIGNvbnRleHQgJiZcblx0XHQndmFyaWFibGVEYXRhJyBpbiBjb250ZXh0O1xufVxuXG5leHBvcnQgY2xhc3MgQWRkRHluYW1pY1ZhcmlhYmxlQWN0aW9uIGV4dGVuZHMgQWN0aW9uMiB7XG5cdHN0YXRpYyByZWFkb25seSBJRCA9ICd3b3JrYmVuY2guYWN0aW9uLmNoYXQuYWRkRHluYW1pY1ZhcmlhYmxlJztcblxuXHRjb25zdHJ1Y3RvcigpIHtcblx0XHRzdXBlcih7XG5cdFx0XHRpZDogQWRkRHluYW1pY1ZhcmlhYmxlQWN0aW9uLklELFxuXHRcdFx0dGl0bGU6ICcnIC8vIG5vdCBkaXNwbGF5ZWRcblx0XHR9KTtcblx0fVxuXG5cdGFzeW5jIHJ1bihhY2Nlc3NvcjogU2VydmljZXNBY2Nlc3NvciwgLi4uYXJnczogYW55W10pIHtcblx0XHRjb25zdCBjb250ZXh0ID0gYXJnc1swXTtcblx0XHRpZiAoIWlzQWRkRHluYW1pY1ZhcmlhYmxlQ29udGV4dChjb250ZXh0KSkge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblxuXHRcdGxldCByYW5nZSA9IGNvbnRleHQucmFuZ2U7XG5cdFx0Y29uc3QgdmFyaWFibGVEYXRhID0gY29udGV4dC52YXJpYWJsZURhdGE7XG5cblx0XHRjb25zdCBkb0NsZWFudXAgPSAoKSA9PiB7XG5cdFx0XHQvLyBGYWlsZWQsIHJlbW92ZSB0aGUgZGFuZ2xpbmcgdmFyaWFibGUgcHJlZml4XG5cdFx0XHRjb250ZXh0LndpZGdldC5pbnB1dEVkaXRvci5leGVjdXRlRWRpdHMoJ2NoYXRJbnNlcnREeW5hbWljVmFyaWFibGVXaXRoQXJndW1lbnRzJywgW3sgcmFuZ2U6IGNvbnRleHQucmFuZ2UsIHRleHQ6IGBgIH1dKTtcblx0XHR9O1xuXG5cdFx0Ly8gSWYgdGhpcyBjb21wbGV0aW9uIGl0ZW0gaGFzIG5vIGNvbW1hbmQsIHJldHVybiBpdCBkaXJlY3RseVxuXHRcdGlmIChjb250ZXh0LmNvbW1hbmQpIHtcblx0XHRcdC8vIEludm9rZSB0aGUgY29tbWFuZCBvbiB0aGlzIGNvbXBsZXRpb24gaXRlbSBhbG9uZyB3aXRoIGl0cyBhcmdzIGFuZCByZXR1cm4gdGhlIHJlc3VsdFxuXHRcdFx0Y29uc3QgY29tbWFuZFNlcnZpY2UgPSBhY2Nlc3Nvci5nZXQoSUNvbW1hbmRTZXJ2aWNlKTtcblx0XHRcdGNvbnN0IHNlbGVjdGlvbjogc3RyaW5nIHwgdW5kZWZpbmVkID0gYXdhaXQgY29tbWFuZFNlcnZpY2UuZXhlY3V0ZUNvbW1hbmQoY29udGV4dC5jb21tYW5kLmlkLCAuLi4oY29udGV4dC5jb21tYW5kLmFyZ3VtZW50cyA/PyBbXSkpO1xuXHRcdFx0aWYgKCFzZWxlY3Rpb24pIHtcblx0XHRcdFx0ZG9DbGVhbnVwKCk7XG5cdFx0XHRcdHJldHVybjtcblx0XHRcdH1cblxuXHRcdFx0Ly8gQ29tcHV0ZSBuZXcgcmFuZ2UgYW5kIHZhcmlhYmxlRGF0YVxuXHRcdFx0Y29uc3QgaW5zZXJ0VGV4dCA9ICc6JyArIHNlbGVjdGlvbjtcblx0XHRcdGNvbnN0IGluc2VydFJhbmdlID0gbmV3IFJhbmdlKHJhbmdlLnN0YXJ0TGluZU51bWJlciwgcmFuZ2UuZW5kQ29sdW1uLCByYW5nZS5lbmRMaW5lTnVtYmVyLCByYW5nZS5lbmRDb2x1bW4gKyBpbnNlcnRUZXh0Lmxlbmd0aCk7XG5cdFx0XHRyYW5nZSA9IG5ldyBSYW5nZShyYW5nZS5zdGFydExpbmVOdW1iZXIsIHJhbmdlLnN0YXJ0Q29sdW1uLCByYW5nZS5lbmRMaW5lTnVtYmVyLCByYW5nZS5lbmRDb2x1bW4gKyBpbnNlcnRUZXh0Lmxlbmd0aCk7XG5cdFx0XHRjb25zdCBlZGl0b3IgPSBjb250ZXh0LndpZGdldC5pbnB1dEVkaXRvcjtcblx0XHRcdGNvbnN0IHN1Y2Nlc3MgPSBlZGl0b3IuZXhlY3V0ZUVkaXRzKCdjaGF0SW5zZXJ0RHluYW1pY1ZhcmlhYmxlV2l0aEFyZ3VtZW50cycsIFt7IHJhbmdlOiBpbnNlcnRSYW5nZSwgdGV4dDogaW5zZXJ0VGV4dCArICcgJyB9XSk7XG5cdFx0XHRpZiAoIXN1Y2Nlc3MpIHtcblx0XHRcdFx0ZG9DbGVhbnVwKCk7XG5cdFx0XHRcdHJldHVybjtcblx0XHRcdH1cblx0XHR9XG5cblx0XHRjb250ZXh0LndpZGdldC5nZXRDb250cmliPENoYXREeW5hbWljVmFyaWFibGVNb2RlbD4oQ2hhdER5bmFtaWNWYXJpYWJsZU1vZGVsLklEKT8uYWRkUmVmZXJlbmNlKHtcblx0XHRcdGlkOiBjb250ZXh0LmlkLFxuXHRcdFx0cmFuZ2U6IHJhbmdlLFxuXHRcdFx0aXNGaWxlOiB0cnVlLFxuXHRcdFx0cHJlZml4OiAnZmlsZScsXG5cdFx0XHRkYXRhOiB2YXJpYWJsZURhdGFcblx0XHR9KTtcblx0fVxufVxucmVnaXN0ZXJBY3Rpb24yKEFkZER5bmFtaWNWYXJpYWJsZUFjdGlvbik7XG5cbmV4cG9ydCBhc3luYyBmdW5jdGlvbiBjcmVhdGVNYXJrZXJzUXVpY2tQaWNrKGFjY2Vzc29yOiBTZXJ2aWNlc0FjY2Vzc29yLCBsZXZlbDogJ3Byb2JsZW0nIHwgJ2ZpbGUnLCBvbkJhY2tncm91bmRBY2NlcHQ/OiAoaXRlbTogSURpYWdub3N0aWNWYXJpYWJsZUVudHJ5RmlsdGVyRGF0YVtdKSA9PiB2b2lkKTogUHJvbWlzZTxJRGlhZ25vc3RpY1ZhcmlhYmxlRW50cnlGaWx0ZXJEYXRhIHwgdW5kZWZpbmVkPiB7XG5cdGNvbnN0IG1hcmtlcnMgPSBhY2Nlc3Nvci5nZXQoSU1hcmtlclNlcnZpY2UpLnJlYWQoeyBzZXZlcml0aWVzOiBNYXJrZXJTZXZlcml0eS5FcnJvciB8IE1hcmtlclNldmVyaXR5Lldhcm5pbmcgfCBNYXJrZXJTZXZlcml0eS5JbmZvIH0pO1xuXHRpZiAoIW1hcmtlcnMubGVuZ3RoKSB7XG5cdFx0cmV0dXJuO1xuXHR9XG5cblx0Y29uc3QgdXJpSWRlbnRpdHlTZXJ2aWNlID0gYWNjZXNzb3IuZ2V0KElVcmlJZGVudGl0eVNlcnZpY2UpO1xuXHRjb25zdCBsYWJlbFNlcnZpY2UgPSBhY2Nlc3Nvci5nZXQoSUxhYmVsU2VydmljZSk7XG5cdGNvbnN0IGdyb3VwZWQgPSBncm91cEJ5KG1hcmtlcnMsIChhLCBiKSA9PiB1cmlJZGVudGl0eVNlcnZpY2UuZXh0VXJpLmNvbXBhcmUoYS5yZXNvdXJjZSwgYi5yZXNvdXJjZSkpO1xuXG5cdGNvbnN0IHNldmVyaXRpZXMgPSBuZXcgU2V0PE1hcmtlclNldmVyaXR5PigpO1xuXHR0eXBlIE1hcmtlclBpY2tJdGVtID0gSVF1aWNrUGlja0l0ZW0gJiB7IHJlc291cmNlPzogVVJJOyBlbnRyeTogSURpYWdub3N0aWNWYXJpYWJsZUVudHJ5RmlsdGVyRGF0YSB9O1xuXHRjb25zdCBpdGVtczogKE1hcmtlclBpY2tJdGVtIHwgSVF1aWNrUGlja1NlcGFyYXRvcilbXSA9IFtdO1xuXG5cdGxldCBwaWNrQ291bnQgPSAwO1xuXHRmb3IgKGNvbnN0IGdyb3VwIG9mIGdyb3VwZWQpIHtcblx0XHRjb25zdCByZXNvdXJjZSA9IGdyb3VwWzBdLnJlc291cmNlO1xuXHRcdGlmIChsZXZlbCA9PT0gJ3Byb2JsZW0nKSB7XG5cdFx0XHRpdGVtcy5wdXNoKHsgdHlwZTogJ3NlcGFyYXRvcicsIGxhYmVsOiBsYWJlbFNlcnZpY2UuZ2V0VXJpTGFiZWwocmVzb3VyY2UsIHsgcmVsYXRpdmU6IHRydWUgfSkgfSk7XG5cdFx0XHRmb3IgKGNvbnN0IG1hcmtlciBvZiBncm91cCkge1xuXHRcdFx0XHRwaWNrQ291bnQrKztcblx0XHRcdFx0c2V2ZXJpdGllcy5hZGQobWFya2VyLnNldmVyaXR5KTtcblx0XHRcdFx0aXRlbXMucHVzaCh7XG5cdFx0XHRcdFx0dHlwZTogJ2l0ZW0nLFxuXHRcdFx0XHRcdHJlc291cmNlOiBtYXJrZXIucmVzb3VyY2UsXG5cdFx0XHRcdFx0bGFiZWw6IG1hcmtlci5tZXNzYWdlLFxuXHRcdFx0XHRcdGRlc2NyaXB0aW9uOiBsb2NhbGl6ZSgnbWFya2Vycy5wYW5lbC5hdC5sbi5jb2wubnVtYmVyJywgXCJbTG4gezB9LCBDb2wgezF9XVwiLCAnJyArIG1hcmtlci5zdGFydExpbmVOdW1iZXIsICcnICsgbWFya2VyLnN0YXJ0Q29sdW1uKSxcblx0XHRcdFx0XHRlbnRyeTogSURpYWdub3N0aWNWYXJpYWJsZUVudHJ5RmlsdGVyRGF0YS5mcm9tTWFya2VyKG1hcmtlciksXG5cdFx0XHRcdH0pO1xuXHRcdFx0fVxuXHRcdH0gZWxzZSBpZiAobGV2ZWwgPT09ICdmaWxlJykge1xuXHRcdFx0Y29uc3QgZW50cnkgPSB7IGZpbHRlclVyaTogcmVzb3VyY2UgfTtcblx0XHRcdHBpY2tDb3VudCsrO1xuXHRcdFx0aXRlbXMucHVzaCh7XG5cdFx0XHRcdHR5cGU6ICdpdGVtJyxcblx0XHRcdFx0cmVzb3VyY2UsXG5cdFx0XHRcdGxhYmVsOiBJRGlhZ25vc3RpY1ZhcmlhYmxlRW50cnlGaWx0ZXJEYXRhLmxhYmVsKGVudHJ5KSxcblx0XHRcdFx0ZGVzY3JpcHRpb246IGdyb3VwWzBdLm1lc3NhZ2UgKyAoZ3JvdXAubGVuZ3RoID4gMSA/IGxvY2FsaXplKCdwcm9ibGVtc01vcmUnLCAnKyB7MH0gbW9yZScsIGdyb3VwLmxlbmd0aCAtIDEpIDogJycpLFxuXHRcdFx0XHRlbnRyeSxcblx0XHRcdH0pO1xuXHRcdFx0Zm9yIChjb25zdCBtYXJrZXIgb2YgZ3JvdXApIHtcblx0XHRcdFx0c2V2ZXJpdGllcy5hZGQobWFya2VyLnNldmVyaXR5KTtcblx0XHRcdH1cblx0XHR9IGVsc2Uge1xuXHRcdFx0YXNzZXJ0TmV2ZXIobGV2ZWwpO1xuXHRcdH1cblx0fVxuXG5cdGlmIChwaWNrQ291bnQgPCAyKSB7IC8vIHNpbmdsZSBlcnJvciBpbiBhIFVSSVxuXHRcdHJldHVybiBpdGVtcy5maW5kKChpKTogaSBpcyBNYXJrZXJQaWNrSXRlbSA9PiBpLnR5cGUgPT09ICdpdGVtJyk/LmVudHJ5O1xuXHR9XG5cblx0aWYgKGxldmVsID09PSAnZmlsZScpIHtcblx0XHRpdGVtcy51bnNoaWZ0KHsgdHlwZTogJ3NlcGFyYXRvcicsIGxhYmVsOiBsb2NhbGl6ZSgnbWFya2Vycy5wYW5lbC5maWxlcycsICdGaWxlcycpIH0pO1xuXHR9XG5cblx0aXRlbXMudW5zaGlmdCh7IHR5cGU6ICdpdGVtJywgbGFiZWw6IGxvY2FsaXplKCdtYXJrZXJzLnBhbmVsLmFsbEVycm9ycycsICdBbGwgUHJvYmxlbXMnKSwgZW50cnk6IHsgZmlsdGVyU2V2ZXJpdHk6IE1hcmtlclNldmVyaXR5LkluZm8gfSB9KTtcblxuXHRjb25zdCBxdWlja0lucHV0U2VydmljZSA9IGFjY2Vzc29yLmdldChJUXVpY2tJbnB1dFNlcnZpY2UpO1xuXHRjb25zdCBzdG9yZSA9IG5ldyBEaXNwb3NhYmxlU3RvcmUoKTtcblx0Y29uc3QgcXVpY2tQaWNrID0gc3RvcmUuYWRkKHF1aWNrSW5wdXRTZXJ2aWNlLmNyZWF0ZVF1aWNrUGljazxNYXJrZXJQaWNrSXRlbT4oeyB1c2VTZXBhcmF0b3JzOiB0cnVlIH0pKTtcblx0cXVpY2tQaWNrLmNhbkFjY2VwdEluQmFja2dyb3VuZCA9ICFvbkJhY2tncm91bmRBY2NlcHQ7XG5cdHF1aWNrUGljay5wbGFjZWhvbGRlciA9IGxvY2FsaXplKCdwaWNrQVByb2JsZW0nLCAnUGljayBhIHByb2JsZW0gdG8gYXR0YWNoLi4uJyk7XG5cdHF1aWNrUGljay5pdGVtcyA9IGl0ZW1zO1xuXG5cdHJldHVybiBuZXcgUHJvbWlzZTxJRGlhZ25vc3RpY1ZhcmlhYmxlRW50cnlGaWx0ZXJEYXRhIHwgdW5kZWZpbmVkPihyZXNvbHZlID0+IHtcblx0XHRzdG9yZS5hZGQocXVpY2tQaWNrLm9uRGlkSGlkZSgoKSA9PiByZXNvbHZlKHVuZGVmaW5lZCkpKTtcblx0XHRzdG9yZS5hZGQocXVpY2tQaWNrLm9uRGlkQWNjZXB0KGV2ID0+IHtcblx0XHRcdGlmIChldi5pbkJhY2tncm91bmQpIHtcblx0XHRcdFx0b25CYWNrZ3JvdW5kQWNjZXB0Py4ocXVpY2tQaWNrLnNlbGVjdGVkSXRlbXMubWFwKGkgPT4gaS5lbnRyeSkpO1xuXHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0cmVzb2x2ZShxdWlja1BpY2suc2VsZWN0ZWRJdGVtc1swXT8uZW50cnkpO1xuXHRcdFx0XHRxdWlja1BpY2suZGlzcG9zZSgpO1xuXHRcdFx0fVxuXHRcdH0pKTtcblx0XHRxdWlja1BpY2suc2hvdygpO1xuXHR9KS5maW5hbGx5KCgpID0+IHN0b3JlLmRpc3Bvc2UoKSk7XG59XG5cbmV4cG9ydCBjbGFzcyBTZWxlY3RBbmRJbnNlcnRQcm9ibGVtQWN0aW9uIGV4dGVuZHMgQWN0aW9uMiB7XG5cdHN0YXRpYyByZWFkb25seSBOYW1lID0gJ3Byb2JsZW1zJztcblx0c3RhdGljIHJlYWRvbmx5IElEID0gJ3dvcmtiZW5jaC5hY3Rpb24uY2hhdC5zZWxlY3RBbmRJbnNlcnRQcm9ibGVtcyc7XG5cblx0Y29uc3RydWN0b3IoKSB7XG5cdFx0c3VwZXIoe1xuXHRcdFx0aWQ6IFNlbGVjdEFuZEluc2VydFByb2JsZW1BY3Rpb24uSUQsXG5cdFx0XHR0aXRsZTogJycgLy8gbm90IGRpc3BsYXllZFxuXHRcdH0pO1xuXHR9XG5cblx0YXN5bmMgcnVuKGFjY2Vzc29yOiBTZXJ2aWNlc0FjY2Vzc29yLCAuLi5hcmdzOiBhbnlbXSkge1xuXHRcdGNvbnN0IGxvZ1NlcnZpY2UgPSBhY2Nlc3Nvci5nZXQoSUxvZ1NlcnZpY2UpO1xuXHRcdGNvbnN0IGNvbnRleHQgPSBhcmdzWzBdO1xuXHRcdGlmICghaXNTZWxlY3RBbmRJbnNlcnRBY3Rpb25Db250ZXh0KGNvbnRleHQpKSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXG5cdFx0Y29uc3QgZG9DbGVhbnVwID0gKCkgPT4ge1xuXHRcdFx0Ly8gRmFpbGVkLCByZW1vdmUgdGhlIGRhbmdsaW5nIGBwcm9ibGVtYFxuXHRcdFx0Y29udGV4dC53aWRnZXQuaW5wdXRFZGl0b3IuZXhlY3V0ZUVkaXRzKCdjaGF0SW5zZXJ0UHJvYmxlbXMnLCBbeyByYW5nZTogY29udGV4dC5yYW5nZSwgdGV4dDogYGAgfV0pO1xuXHRcdH07XG5cblx0XHRjb25zdCBwaWNrID0gYXdhaXQgY3JlYXRlTWFya2Vyc1F1aWNrUGljayhhY2Nlc3NvciwgJ2ZpbGUnKTtcblx0XHRpZiAoIXBpY2spIHtcblx0XHRcdGRvQ2xlYW51cCgpO1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblxuXHRcdGNvbnN0IGVkaXRvciA9IGNvbnRleHQud2lkZ2V0LmlucHV0RWRpdG9yO1xuXHRcdGNvbnN0IG9yaWdpbmFsUmFuZ2UgPSBjb250ZXh0LnJhbmdlO1xuXHRcdGNvbnN0IGluc2VydFRleHQgPSBgIyR7U2VsZWN0QW5kSW5zZXJ0UHJvYmxlbUFjdGlvbi5OYW1lfToke3BpY2suZmlsdGVyVXJpID8gYmFzZW5hbWUocGljay5maWx0ZXJVcmkpIDogTWFya2VyU2V2ZXJpdHkudG9TdHJpbmcocGljay5maWx0ZXJTZXZlcml0eSEpfWA7XG5cblx0XHRjb25zdCB2YXJSYW5nZSA9IG5ldyBSYW5nZShvcmlnaW5hbFJhbmdlLnN0YXJ0TGluZU51bWJlciwgb3JpZ2luYWxSYW5nZS5zdGFydENvbHVtbiwgb3JpZ2luYWxSYW5nZS5lbmRMaW5lTnVtYmVyLCBvcmlnaW5hbFJhbmdlLnN0YXJ0Q29sdW1uICsgaW5zZXJ0VGV4dC5sZW5ndGgpO1xuXHRcdGNvbnN0IHN1Y2Nlc3MgPSBlZGl0b3IuZXhlY3V0ZUVkaXRzKCdjaGF0SW5zZXJ0UHJvYmxlbXMnLCBbeyByYW5nZTogdmFyUmFuZ2UsIHRleHQ6IGluc2VydFRleHQgKyAnICcgfV0pO1xuXHRcdGlmICghc3VjY2Vzcykge1xuXHRcdFx0bG9nU2VydmljZS50cmFjZShgU2VsZWN0QW5kSW5zZXJ0UHJvYmxlbXNBY3Rpb246IGZhaWxlZCB0byBpbnNlcnQgXCIke2luc2VydFRleHR9XCJgKTtcblx0XHRcdGRvQ2xlYW51cCgpO1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblxuXHRcdGNvbnRleHQud2lkZ2V0LmdldENvbnRyaWI8Q2hhdER5bmFtaWNWYXJpYWJsZU1vZGVsPihDaGF0RHluYW1pY1ZhcmlhYmxlTW9kZWwuSUQpPy5hZGRSZWZlcmVuY2Uoe1xuXHRcdFx0aWQ6ICd2c2NvZGUucHJvYmxlbXMnLFxuXHRcdFx0cHJlZml4OiBTZWxlY3RBbmRJbnNlcnRQcm9ibGVtQWN0aW9uLk5hbWUsXG5cdFx0XHRyYW5nZTogdmFyUmFuZ2UsXG5cdFx0XHRkYXRhOiB7IGlkOiAndnNjb2RlLnByb2JsZW1zJywgZmlsdGVyOiBwaWNrIH0gc2F0aXNmaWVzIElDaGF0UmVxdWVzdFByb2JsZW1zVmFyaWFibGUsXG5cdFx0fSk7XG5cdH1cbn1cbnJlZ2lzdGVyQWN0aW9uMihTZWxlY3RBbmRJbnNlcnRQcm9ibGVtQWN0aW9uKTtcbiJdLAogICJtYXBwaW5ncyI6ICI7Ozs7Ozs7Ozs7O0FBS0EsU0FBUyxVQUFVLGVBQWU7QUFDbEMsU0FB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
