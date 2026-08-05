var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __typeError = (msg) => {
  throw TypeError(msg);
};
var __decorateClass = (decorators, target, key, kind) => {
  var result = kind > 1 ? void 0 : kind ? __getOwnPropDesc(target, key) : target;
  for (var i = decorators.length - 1, decorator; i >= 0; i--)
    if (decorator = decorators[i])
      result = (kind ? decorator(target, key, result) : decorator(result)) || result;
  if (kind && result) __defProp(target, key, result);
  return result;
};
var __decorateParam = (index, decorator) => (target, key) => decorator(target, key, index);
var __accessCheck = (obj, member, msg) => member.has(obj) || __typeError("Cannot " + msg);
var __privateGet = (obj, member, getter) => (__accessCheck(obj, member, "read from private field"), getter ? getter.call(obj) : member.get(obj));
var __privateAdd = (obj, member, value) => member.has(obj) ? __typeError("Cannot add the same private member more than once") : member instanceof WeakSet ? member.add(obj) : member.set(obj, value);
var __privateSet = (obj, member, value, setter) => (__accessCheck(obj, member, "write to private field"), setter ? setter.call(obj, value) : member.set(obj, value), value);
var _proxy;
import { URI } from "../../../base/common/uri.js";
import { Event, Emitter } from "../../../base/common/event.js";
import { debounce } from "../../../base/common/decorators.js";
import { DisposableStore, MutableDisposable } from "../../../base/common/lifecycle.js";
import { asPromise } from "../../../base/common/async.js";
import { MainContext } from "./extHost.protocol.js";
import { sortedDiff, equals } from "../../../base/common/arrays.js";
import { comparePaths } from "../../../base/common/comparers.js";
import { ILogService } from "../../../platform/log/common/log.js";
import { ExtensionIdentifierMap } from "../../../platform/extensions/common/extensions.js";
import { MarshalledId } from "../../../base/common/marshallingIds.js";
import { ThemeIcon } from "../../../base/common/themables.js";
import { MarkdownString } from "./extHostTypeConverters.js";
import { checkProposedApiEnabled, isProposedApiEnabled } from "../../services/extensions/common/extensions.js";
import { Schemas } from "../../../base/common/network.js";
import { isLinux } from "../../../base/common/platform.js";
import { structuralEquals } from "../../../base/common/equals.js";
function isUri(thing) {
  return thing instanceof URI;
}
function uriEquals(a, b) {
  if (a.scheme === Schemas.file && b.scheme === Schemas.file && isLinux) {
    return a.toString() === b.toString();
  }
  return a.toString().toLowerCase() === b.toString().toLowerCase();
}
function getIconResource(decorations) {
  if (!decorations) {
    return void 0;
  } else if (typeof decorations.iconPath === "string") {
    return URI.file(decorations.iconPath);
  } else if (URI.isUri(decorations.iconPath)) {
    return decorations.iconPath;
  } else if (ThemeIcon.isThemeIcon(decorations.iconPath)) {
    return decorations.iconPath;
  } else {
    return void 0;
  }
}
function getHistoryItemIconDto(icon) {
  if (!icon) {
    return void 0;
  } else if (URI.isUri(icon)) {
    return icon;
  } else if (ThemeIcon.isThemeIcon(icon)) {
    return icon;
  } else {
    const iconDto = icon;
    return { light: iconDto.light, dark: iconDto.dark };
  }
}
function toSCMHistoryItemDto(historyItem) {
  const authorIcon = getHistoryItemIconDto(historyItem.authorIcon);
  const references = historyItem.references?.map((r) => ({
    ...r,
    icon: getHistoryItemIconDto(r.icon)
  }));
  return { ...historyItem, authorIcon, references };
}
function toSCMHistoryItemRefDto(historyItemRef) {
  return historyItemRef ? { ...historyItemRef, icon: getHistoryItemIconDto(historyItemRef.icon) } : void 0;
}
function compareResourceThemableDecorations(a, b) {
  if (!a.iconPath && !b.iconPath) {
    return 0;
  } else if (!a.iconPath) {
    return -1;
  } else if (!b.iconPath) {
    return 1;
  }
  const aPath = typeof a.iconPath === "string" ? a.iconPath : URI.isUri(a.iconPath) ? a.iconPath.fsPath : a.iconPath.id;
  const bPath = typeof b.iconPath === "string" ? b.iconPath : URI.isUri(b.iconPath) ? b.iconPath.fsPath : b.iconPath.id;
  return comparePaths(aPath, bPath);
}
function compareResourceStatesDecorations(a, b) {
  let result = 0;
  if (a.strikeThrough !== b.strikeThrough) {
    return a.strikeThrough ? 1 : -1;
  }
  if (a.faded !== b.faded) {
    return a.faded ? 1 : -1;
  }
  if (a.tooltip !== b.tooltip) {
    return (a.tooltip || "").localeCompare(b.tooltip || "");
  }
  result = compareResourceThemableDecorations(a, b);
  if (result !== 0) {
    return result;
  }
  if (a.light && b.light) {
    result = compareResourceThemableDecorations(a.light, b.light);
  } else if (a.light) {
    return 1;
  } else if (b.light) {
    return -1;
  }
  if (result !== 0) {
    return result;
  }
  if (a.dark && b.dark) {
    result = compareResourceThemableDecorations(a.dark, b.dark);
  } else if (a.dark) {
    return 1;
  } else if (b.dark) {
    return -1;
  }
  return result;
}
function compareCommands(a, b) {
  if (a.command !== b.command) {
    return a.command < b.command ? -1 : 1;
  }
  if (a.title !== b.title) {
    return a.title < b.title ? -1 : 1;
  }
  if (a.tooltip !== b.tooltip) {
    if (a.tooltip !== void 0 && b.tooltip !== void 0) {
      return a.tooltip < b.tooltip ? -1 : 1;
    } else if (a.tooltip !== void 0) {
      return 1;
    } else if (b.tooltip !== void 0) {
      return -1;
    }
  }
  if (a.arguments === b.arguments) {
    return 0;
  } else if (!a.arguments) {
    return -1;
  } else if (!b.arguments) {
    return 1;
  } else if (a.arguments.length !== b.arguments.length) {
    return a.arguments.length - b.arguments.length;
  }
  for (let i = 0; i < a.arguments.length; i++) {
    const aArg = a.arguments[i];
    const bArg = b.arguments[i];
    if (aArg === bArg) {
      continue;
    }
    if (isUri(aArg) && isUri(bArg) && uriEquals(aArg, bArg)) {
      continue;
    }
    return aArg < bArg ? -1 : 1;
  }
  return 0;
}
function compareResourceStates(a, b) {
  let result = comparePaths(a.resourceUri.fsPath, b.resourceUri.fsPath, true);
  if (result !== 0) {
    return result;
  }
  if (a.command && b.command) {
    result = compareCommands(a.command, b.command);
  } else if (a.command) {
    return 1;
  } else if (b.command) {
    return -1;
  }
  if (result !== 0) {
    return result;
  }
  if (a.decorations && b.decorations) {
    result = compareResourceStatesDecorations(a.decorations, b.decorations);
  } else if (a.decorations) {
    return 1;
  } else if (b.decorations) {
    return -1;
  }
  if (result !== 0) {
    return result;
  }
  if (a.multiFileDiffEditorModifiedUri && b.multiFileDiffEditorModifiedUri) {
    result = comparePaths(a.multiFileDiffEditorModifiedUri.fsPath, b.multiFileDiffEditorModifiedUri.fsPath, true);
  } else if (a.multiFileDiffEditorModifiedUri) {
    return 1;
  } else if (b.multiFileDiffEditorModifiedUri) {
    return -1;
  }
  if (result !== 0) {
    return result;
  }
  if (a.multiDiffEditorOriginalUri && b.multiDiffEditorOriginalUri) {
    result = comparePaths(a.multiDiffEditorOriginalUri.fsPath, b.multiDiffEditorOriginalUri.fsPath, true);
  } else if (a.multiDiffEditorOriginalUri) {
    return 1;
  } else if (b.multiDiffEditorOriginalUri) {
    return -1;
  }
  return result;
}
function compareArgs(a, b) {
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) {
      return false;
    }
  }
  return true;
}
function commandEquals(a, b) {
  return a.command === b.command && a.title === b.title && a.tooltip === b.tooltip && (a.arguments && b.arguments ? compareArgs(a.arguments, b.arguments) : a.arguments === b.arguments);
}
function commandListEquals(a, b) {
  return equals(a, b, commandEquals);
}
class ExtHostSCMInputBox {
  constructor(_extension, _extHostDocuments, proxy, _sourceControlHandle, _documentUri) {
    this._extension = _extension;
    this._sourceControlHandle = _sourceControlHandle;
    this._documentUri = _documentUri;
    this._value = "";
    this._onDidChange = new Emitter();
    this._placeholder = "";
    this._enabled = true;
    this._visible = true;
    this.#extHostDocuments = _extHostDocuments;
    this.#proxy = proxy;
  }
  #proxy;
  #extHostDocuments;
  get value() {
    return this._value;
  }
  set value(value) {
    value = value ?? "";
    this.#proxy.$setInputBoxValue(this._sourceControlHandle, value);
    this.updateValue(value);
  }
  get onDidChange() {
    return this._onDidChange.event;
  }
  get placeholder() {
    return this._placeholder;
  }
  set placeholder(placeholder) {
    this.#proxy.$setInputBoxPlaceholder(this._sourceControlHandle, placeholder);
    this._placeholder = placeholder;
  }
  get validateInput() {
    checkProposedApiEnabled(this._extension, "scmValidation");
    return this._validateInput;
  }
  set validateInput(fn) {
    checkProposedApiEnabled(this._extension, "scmValidation");
    if (fn && typeof fn !== "function") {
      throw new Error(`[${this._extension.identifier.value}]: Invalid SCM input box validation function`);
    }
    this._validateInput = fn;
    this.#proxy.$setValidationProviderIsEnabled(this._sourceControlHandle, !!fn);
  }
  get enabled() {
    return this._enabled;
  }
  set enabled(enabled) {
    enabled = !!enabled;
    if (this._enabled === enabled) {
      return;
    }
    this._enabled = enabled;
    this.#proxy.$setInputBoxEnablement(this._sourceControlHandle, enabled);
  }
  get visible() {
    return this._visible;
  }
  set visible(visible) {
    visible = !!visible;
    if (this._visible === visible) {
      return;
    }
    this._visible = visible;
    this.#proxy.$setInputBoxVisibility(this._sourceControlHandle, visible);
  }
  get document() {
    checkProposedApiEnabled(this._extension, "scmTextDocument");
    return this.#extHostDocuments.getDocument(this._documentUri);
  }
  showValidationMessage(message, type) {
    checkProposedApiEnabled(this._extension, "scmValidation");
    this.#proxy.$showValidationMessage(this._sourceControlHandle, message, type);
  }
  $onInputBoxValueChange(value) {
    this.updateValue(value);
  }
  updateValue(value) {
    this._value = value;
    this._onDidChange.fire(value);
  }
}
const _ExtHostSourceControlResourceGroup = class _ExtHostSourceControlResourceGroup {
  constructor(_proxy2, _commands, _sourceControlHandle, _id, _label, multiDiffEditorEnableViewChanges, _extension) {
    this._proxy = _proxy2;
    this._commands = _commands;
    this._sourceControlHandle = _sourceControlHandle;
    this._id = _id;
    this._label = _label;
    this.multiDiffEditorEnableViewChanges = multiDiffEditorEnableViewChanges;
    this._extension = _extension;
    this._resourceHandlePool = 0;
    this._resourceStates = [];
    this._resourceStatesMap = /* @__PURE__ */ new Map();
    this._resourceStatesCommandsMap = /* @__PURE__ */ new Map();
    this._resourceStatesDisposablesMap = /* @__PURE__ */ new Map();
    this._onDidUpdateResourceStates = new Emitter();
    this.onDidUpdateResourceStates = this._onDidUpdateResourceStates.event;
    this._disposed = false;
    this._onDidDispose = new Emitter();
    this.onDidDispose = this._onDidDispose.event;
    this._handlesSnapshot = [];
    this._resourceSnapshot = [];
    this._contextValue = void 0;
    this._hideWhenEmpty = void 0;
    this.handle = _ExtHostSourceControlResourceGroup._handlePool++;
  }
  get disposed() {
    return this._disposed;
  }
  get id() {
    return this._id;
  }
  get label() {
    return this._label;
  }
  set label(label) {
    this._label = label;
    this._proxy.$updateGroupLabel(this._sourceControlHandle, this.handle, label);
  }
  get contextValue() {
    return this._contextValue;
  }
  set contextValue(contextValue) {
    this._contextValue = contextValue;
    this._proxy.$updateGroup(this._sourceControlHandle, this.handle, this.features);
  }
  get hideWhenEmpty() {
    return this._hideWhenEmpty;
  }
  set hideWhenEmpty(hideWhenEmpty) {
    this._hideWhenEmpty = hideWhenEmpty;
    this._proxy.$updateGroup(this._sourceControlHandle, this.handle, this.features);
  }
  get features() {
    return {
      contextValue: this.contextValue,
      hideWhenEmpty: this.hideWhenEmpty
    };
  }
  get resourceStates() {
    return [...this._resourceStates];
  }
  set resourceStates(resources) {
    this._resourceStates = [...resources];
    this._onDidUpdateResourceStates.fire();
  }
  getResourceState(handle) {
    return this._resourceStatesMap.get(handle);
  }
  $executeResourceCommand(handle, preserveFocus) {
    const command = this._resourceStatesCommandsMap.get(handle);
    if (!command) {
      return Promise.resolve(void 0);
    }
    return asPromise(() => this._commands.executeCommand(command.command, ...command.arguments || [], preserveFocus));
  }
  _takeResourceStateSnapshot() {
    const snapshot = [...this._resourceStates].sort(compareResourceStates);
    const diffs = sortedDiff(this._resourceSnapshot, snapshot, compareResourceStates);
    const splices = diffs.map((diff) => {
      const toInsert = diff.toInsert.map((r) => {
        const handle = this._resourceHandlePool++;
        this._resourceStatesMap.set(handle, r);
        const sourceUri = r.resourceUri;
        let command;
        if (r.command) {
          if (r.command.command === "vscode.open" || r.command.command === "vscode.diff" || r.command.command === "vscode.changes") {
            const disposables = new DisposableStore();
            command = this._commands.converter.toInternal(r.command, disposables);
            this._resourceStatesDisposablesMap.set(handle, disposables);
          } else {
            this._resourceStatesCommandsMap.set(handle, r.command);
          }
        }
        const hasScmMultiDiffEditorProposalEnabled = isProposedApiEnabled(this._extension, "scmMultiDiffEditor");
        const multiFileDiffEditorOriginalUri = hasScmMultiDiffEditorProposalEnabled ? r.multiDiffEditorOriginalUri : void 0;
        const multiFileDiffEditorModifiedUri = hasScmMultiDiffEditorProposalEnabled ? r.multiFileDiffEditorModifiedUri : void 0;
        const icon = getIconResource(r.decorations);
        const lightIcon = r.decorations && getIconResource(r.decorations.light) || icon;
        const darkIcon = r.decorations && getIconResource(r.decorations.dark) || icon;
        const icons = [lightIcon, darkIcon];
        const tooltip = r.decorations && r.decorations.tooltip || "";
        const strikeThrough = r.decorations && !!r.decorations.strikeThrough;
        const faded = r.decorations && !!r.decorations.faded;
        const contextValue = r.contextValue || "";
        const rawResource = [handle, sourceUri, icons, tooltip, strikeThrough, faded, contextValue, command, multiFileDiffEditorOriginalUri, multiFileDiffEditorModifiedUri];
        return { rawResource, handle };
      });
      return { start: diff.start, deleteCount: diff.deleteCount, toInsert };
    });
    const rawResourceSplices = splices.map(({ start, deleteCount, toInsert }) => [start, deleteCount, toInsert.map((i) => i.rawResource)]);
    const reverseSplices = splices.reverse();
    for (const { start, deleteCount, toInsert } of reverseSplices) {
      const handles = toInsert.map((i) => i.handle);
      const handlesToDelete = this._handlesSnapshot.splice(start, deleteCount, ...handles);
      for (const handle of handlesToDelete) {
        this._resourceStatesMap.delete(handle);
        this._resourceStatesCommandsMap.delete(handle);
        this._resourceStatesDisposablesMap.get(handle)?.dispose();
        this._resourceStatesDisposablesMap.delete(handle);
      }
    }
    this._resourceSnapshot = snapshot;
    return rawResourceSplices;
  }
  dispose() {
    this._disposed = true;
    this._onDidDispose.fire();
  }
};
_ExtHostSourceControlResourceGroup._handlePool = 0;
let ExtHostSourceControlResourceGroup = _ExtHostSourceControlResourceGroup;
const _ExtHostSourceControl = class _ExtHostSourceControl {
  constructor(_extension, _extHostDocuments, proxy, _commands, _id, _label, _rootUri) {
    this._extension = _extension;
    this._commands = _commands;
    this._id = _id;
    this._label = _label;
    this._rootUri = _rootUri;
    __privateAdd(this, _proxy);
    this._groups = /* @__PURE__ */ new Map();
    this._count = void 0;
    this._quickDiffProvider = void 0;
    this._historyProviderDisposable = new MutableDisposable();
    this._commitTemplate = void 0;
    this._acceptInputDisposables = new MutableDisposable();
    this._acceptInputCommand = void 0;
    this._actionButtonDisposables = new MutableDisposable();
    this._statusBarDisposables = new MutableDisposable();
    this._statusBarCommands = void 0;
    this._selected = false;
    this._onDidChangeSelection = new Emitter();
    this.onDidChangeSelection = this._onDidChangeSelection.event;
    this.handle = _ExtHostSourceControl._handlePool++;
    this.createdResourceGroups = /* @__PURE__ */ new Map();
    this.updatedResourceGroups = /* @__PURE__ */ new Set();
    __privateSet(this, _proxy, proxy);
    const inputBoxDocumentUri = URI.from({
      scheme: Schemas.vscodeSourceControl,
      path: `${_id}/scm${this.handle}/input`,
      query: _rootUri ? `rootUri=${encodeURIComponent(_rootUri.toString())}` : void 0
    });
    this._inputBox = new ExtHostSCMInputBox(_extension, _extHostDocuments, __privateGet(this, _proxy), this.handle, inputBoxDocumentUri);
    __privateGet(this, _proxy).$registerSourceControl(this.handle, _id, _label, _rootUri, inputBoxDocumentUri);
  }
  get id() {
    return this._id;
  }
  get label() {
    return this._label;
  }
  get rootUri() {
    return this._rootUri;
  }
  get inputBox() {
    return this._inputBox;
  }
  get count() {
    return this._count;
  }
  set count(count) {
    if (this._count === count) {
      return;
    }
    this._count = count;
    __privateGet(this, _proxy).$updateSourceControl(this.handle, { count });
  }
  get quickDiffProvider() {
    return this._quickDiffProvider;
  }
  set quickDiffProvider(quickDiffProvider) {
    this._quickDiffProvider = quickDiffProvider;
    let quickDiffLabel = void 0;
    if (isProposedApiEnabled(this._extension, "quickDiffProvider")) {
      quickDiffLabel = quickDiffProvider?.label;
    }
    __privateGet(this, _proxy).$updateSourceControl(this.handle, { hasQuickDiffProvider: !!quickDiffProvider, quickDiffLabel });
  }
  get historyProvider() {
    checkProposedApiEnabled(this._extension, "scmHistoryProvider");
    return this._historyProvider;
  }
  set historyProvider(historyProvider) {
    checkProposedApiEnabled(this._extension, "scmHistoryProvider");
    this._historyProvider = historyProvider;
    this._historyProviderDisposable.value = new DisposableStore();
    __privateGet(this, _proxy).$updateSourceControl(this.handle, { hasHistoryProvider: !!historyProvider });
    if (historyProvider) {
      this._historyProviderDisposable.value.add(historyProvider.onDidChangeCurrentHistoryItemRefs(() => {
        const historyItemRef = toSCMHistoryItemRefDto(historyProvider?.currentHistoryItemRef);
        const historyItemRemoteRef = toSCMHistoryItemRefDto(historyProvider?.currentHistoryItemRemoteRef);
        const historyItemBaseRef = toSCMHistoryItemRefDto(historyProvider?.currentHistoryItemBaseRef);
        __privateGet(this, _proxy).$onDidChangeHistoryProviderCurrentHistoryItemRefs(this.handle, historyItemRef, historyItemRemoteRef, historyItemBaseRef);
      }));
      this._historyProviderDisposable.value.add(historyProvider.onDidChangeHistoryItemRefs((e) => {
        if (e.added.length === 0 && e.modified.length === 0 && e.removed.length === 0) {
          return;
        }
        const added = e.added.map((ref) => ({ ...ref, icon: getHistoryItemIconDto(ref.icon) }));
        const modified = e.modified.map((ref) => ({ ...ref, icon: getHistoryItemIconDto(ref.icon) }));
        const removed = e.removed.map((ref) => ({ ...ref, icon: getHistoryItemIconDto(ref.icon) }));
        __privateGet(this, _proxy).$onDidChangeHistoryProviderHistoryItemRefs(this.handle, { added, modified, removed, silent: e.silent });
      }));
    }
  }
  get commitTemplate() {
    return this._commitTemplate;
  }
  set commitTemplate(commitTemplate) {
    if (commitTemplate === this._commitTemplate) {
      return;
    }
    this._commitTemplate = commitTemplate;
    __privateGet(this, _proxy).$updateSourceControl(this.handle, { commitTemplate });
  }
  get acceptInputCommand() {
    return this._acceptInputCommand;
  }
  set acceptInputCommand(acceptInputCommand) {
    this._acceptInputDisposables.value = new DisposableStore();
    this._acceptInputCommand = acceptInputCommand;
    const internal = this._commands.converter.toInternal(acceptInputCommand, this._acceptInputDisposables.value);
    __privateGet(this, _proxy).$updateSourceControl(this.handle, { acceptInputCommand: internal });
  }
  get actionButton() {
    checkProposedApiEnabled(this._extension, "scmActionButton");
    return this._actionButton;
  }
  set actionButton(actionButton) {
    checkProposedApiEnabled(this._extension, "scmActionButton");
    if (structuralEquals(this._actionButton, actionButton)) {
      return;
    }
    this._actionButton = actionButton;
    this._actionButtonDisposables.value = new DisposableStore();
    const actionButtonDto = actionButton !== void 0 ? {
      command: {
        ...this._commands.converter.toInternal(actionButton.command, this._actionButtonDisposables.value),
        shortTitle: actionButton.command.shortTitle
      },
      secondaryCommands: actionButton.secondaryCommands?.map((commandGroup) => {
        return commandGroup.map((command) => this._commands.converter.toInternal(command, this._actionButtonDisposables.value));
      }),
      enabled: actionButton.enabled
    } : void 0;
    __privateGet(this, _proxy).$updateSourceControl(this.handle, { actionButton: actionButtonDto ?? null });
  }
  get statusBarCommands() {
    return this._statusBarCommands;
  }
  set statusBarCommands(statusBarCommands) {
    if (this._statusBarCommands && statusBarCommands && commandListEquals(this._statusBarCommands, statusBarCommands)) {
      return;
    }
    this._statusBarDisposables.value = new DisposableStore();
    this._statusBarCommands = statusBarCommands;
    const internal = (statusBarCommands || []).map((c) => this._commands.converter.toInternal(c, this._statusBarDisposables.value));
    __privateGet(this, _proxy).$updateSourceControl(this.handle, { statusBarCommands: internal });
  }
  get selected() {
    return this._selected;
  }
  createResourceGroup(id, label, options) {
    const multiDiffEditorEnableViewChanges = isProposedApiEnabled(this._extension, "scmMultiDiffEditor") && options?.multiDiffEditorEnableViewChanges === true;
    const group = new ExtHostSourceControlResourceGroup(__privateGet(this, _proxy), this._commands, this.handle, id, label, multiDiffEditorEnableViewChanges, this._extension);
    const disposable = Event.once(group.onDidDispose)(() => this.createdResourceGroups.delete(group));
    this.createdResourceGroups.set(group, disposable);
    this.eventuallyAddResourceGroups();
    return group;
  }
  eventuallyAddResourceGroups() {
    const groups = [];
    const splices = [];
    for (const [group, disposable] of this.createdResourceGroups) {
      disposable.dispose();
      const updateListener = group.onDidUpdateResourceStates(() => {
        this.updatedResourceGroups.add(group);
        this.eventuallyUpdateResourceStates();
      });
      Event.once(group.onDidDispose)(() => {
        this.updatedResourceGroups.delete(group);
        updateListener.dispose();
        this._groups.delete(group.handle);
        __privateGet(this, _proxy).$unregisterGroup(this.handle, group.handle);
      });
      groups.push([group.handle, group.id, group.label, group.features, group.multiDiffEditorEnableViewChanges]);
      const snapshot = group._takeResourceStateSnapshot();
      if (snapshot.length > 0) {
        splices.push([group.handle, snapshot]);
      }
      this._groups.set(group.handle, group);
    }
    __privateGet(this, _proxy).$registerGroups(this.handle, groups, splices);
    this.createdResourceGroups.clear();
  }
  eventuallyUpdateResourceStates() {
    const splices = [];
    this.updatedResourceGroups.forEach((group) => {
      const snapshot = group._takeResourceStateSnapshot();
      if (snapshot.length === 0) {
        return;
      }
      splices.push([group.handle, snapshot]);
    });
    if (splices.length > 0) {
      __privateGet(this, _proxy).$spliceResourceStates(this.handle, splices);
    }
    this.updatedResourceGroups.clear();
  }
  getResourceGroup(handle) {
    return this._groups.get(handle);
  }
  setSelectionState(selected) {
    this._selected = selected;
    this._onDidChangeSelection.fire(selected);
  }
  dispose() {
    this._acceptInputDisposables.dispose();
    this._actionButtonDisposables.dispose();
    this._statusBarDisposables.dispose();
    this._groups.forEach((group) => group.dispose());
    __privateGet(this, _proxy).$unregisterSourceControl(this.handle);
  }
};
_proxy = new WeakMap();
_ExtHostSourceControl._handlePool = 0;
__decorateClass([
  debounce(100)
], _ExtHostSourceControl.prototype, "eventuallyAddResourceGroups", 1);
__decorateClass([
  debounce(100)
], _ExtHostSourceControl.prototype, "eventuallyUpdateResourceStates", 1);
let ExtHostSourceControl = _ExtHostSourceControl;
let ExtHostSCM = class {
  constructor(mainContext, _commands, _extHostDocuments, logService) {
    this._commands = _commands;
    this._extHostDocuments = _extHostDocuments;
    this.logService = logService;
    this._sourceControls = /* @__PURE__ */ new Map();
    this._sourceControlsByExtension = new ExtensionIdentifierMap();
    this._onDidChangeActiveProvider = new Emitter();
    this._proxy = mainContext.getProxy(MainContext.MainThreadSCM);
    this._telemetry = mainContext.getProxy(MainContext.MainThreadTelemetry);
    _commands.registerArgumentProcessor({
      processArgument: (arg) => {
        if (arg && arg.$mid === MarshalledId.ScmResource) {
          const sourceControl = this._sourceControls.get(arg.sourceControlHandle);
          if (!sourceControl) {
            return arg;
          }
          const group = sourceControl.getResourceGroup(arg.groupHandle);
          if (!group) {
            return arg;
          }
          return group.getResourceState(arg.handle);
        } else if (arg && arg.$mid === MarshalledId.ScmResourceGroup) {
          const sourceControl = this._sourceControls.get(arg.sourceControlHandle);
          if (!sourceControl) {
            return arg;
          }
          return sourceControl.getResourceGroup(arg.groupHandle);
        } else if (arg && arg.$mid === MarshalledId.ScmProvider) {
          const sourceControl = this._sourceControls.get(arg.handle);
          if (!sourceControl) {
            return arg;
          }
          return sourceControl;
        }
        return arg;
      }
    });
  }
  get onDidChangeActiveProvider() {
    return this._onDidChangeActiveProvider.event;
  }
  createSourceControl(extension, id, label, rootUri) {
    this.logService.trace("ExtHostSCM#createSourceControl", extension.identifier.value, id, label, rootUri);
    this._telemetry.$publicLog2("api/scm/createSourceControl", {
      extensionId: extension.identifier.value
    });
    const handle = ExtHostSCM._handlePool++;
    const sourceControl = new ExtHostSourceControl(extension, this._extHostDocuments, this._proxy, this._commands, id, label, rootUri);
    this._sourceControls.set(handle, sourceControl);
    const sourceControls = this._sourceControlsByExtension.get(extension.identifier) || [];
    sourceControls.push(sourceControl);
    this._sourceControlsByExtension.set(extension.identifier, sourceControls);
    return sourceControl;
  }
  // Deprecated
  getLastInputBox(extension) {
    this.logService.trace("ExtHostSCM#getLastInputBox", extension.identifier.value);
    const sourceControls = this._sourceControlsByExtension.get(extension.identifier);
    const sourceControl = sourceControls && sourceControls[sourceControls.length - 1];
    return sourceControl && sourceControl.inputBox;
  }
  $provideOriginalResource(sourceControlHandle, uriComponents, token) {
    const uri = URI.revive(uriComponents);
    this.logService.trace("ExtHostSCM#$provideOriginalResource", sourceControlHandle, uri.toString());
    const sourceControl = this._sourceControls.get(sourceControlHandle);
    if (!sourceControl || !sourceControl.quickDiffProvider || !sourceControl.quickDiffProvider.provideOriginalResource) {
      return Promise.resolve(null);
    }
    return asPromise(() => sourceControl.quickDiffProvider.provideOriginalResource(uri, token)).then((r) => r || null);
  }
  $onInputBoxValueChange(sourceControlHandle, value) {
    this.logService.trace("ExtHostSCM#$onInputBoxValueChange", sourceControlHandle);
    const sourceControl = this._sourceControls.get(sourceControlHandle);
    if (!sourceControl) {
      return Promise.resolve(void 0);
    }
    sourceControl.inputBox.$onInputBoxValueChange(value);
    return Promise.resolve(void 0);
  }
  $executeResourceCommand(sourceControlHandle, groupHandle, handle, preserveFocus) {
    this.logService.trace("ExtHostSCM#$executeResourceCommand", sourceControlHandle, groupHandle, handle);
    const sourceControl = this._sourceControls.get(sourceControlHandle);
    if (!sourceControl) {
      return Promise.resolve(void 0);
    }
    const group = sourceControl.getResourceGroup(groupHandle);
    if (!group) {
      return Promise.resolve(void 0);
    }
    return group.$executeResourceCommand(handle, preserveFocus);
  }
  $validateInput(sourceControlHandle, value, cursorPosition) {
    this.logService.trace("ExtHostSCM#$validateInput", sourceControlHandle);
    const sourceControl = this._sourceControls.get(sourceControlHandle);
    if (!sourceControl) {
      return Promise.resolve(void 0);
    }
    if (!sourceControl.inputBox.validateInput) {
      return Promise.resolve(void 0);
    }
    return asPromise(() => sourceControl.inputBox.validateInput(value, cursorPosition)).then((result) => {
      if (!result) {
        return Promise.resolve(void 0);
      }
      const message = MarkdownString.fromStrict(result.message);
      if (!message) {
        return Promise.resolve(void 0);
      }
      return Promise.resolve([message, result.type]);
    });
  }
  $setSelectedSourceControl(selectedSourceControlHandle) {
    this.logService.trace("ExtHostSCM#$setSelectedSourceControl", selectedSourceControlHandle);
    if (selectedSourceControlHandle !== void 0) {
      this._sourceControls.get(selectedSourceControlHandle)?.setSelectionState(true);
    }
    if (this._selectedSourceControlHandle !== void 0) {
      this._sourceControls.get(this._selectedSourceControlHandle)?.setSelectionState(false);
    }
    this._selectedSourceControlHandle = selectedSourceControlHandle;
    return Promise.resolve(void 0);
  }
  async $resolveHistoryItemRefsCommonAncestor(sourceControlHandle, historyItemRefs, token) {
    try {
      const historyProvider = this._sourceControls.get(sourceControlHandle)?.historyProvider;
      const ancestor = await historyProvider?.resolveHistoryItemRefsCommonAncestor(historyItemRefs, token);
      return ancestor ?? void 0;
    } catch (err) {
      this.logService.error("ExtHostSCM#$resolveHistoryItemRefsCommonAncestor", err);
      return void 0;
    }
  }
  async $provideHistoryItemRefs(sourceControlHandle, historyItemRefs, token) {
    try {
      const historyProvider = this._sourceControls.get(sourceControlHandle)?.historyProvider;
      const refs = await historyProvider?.provideHistoryItemRefs(historyItemRefs, token);
      return refs?.map((ref) => ({ ...ref, icon: getHistoryItemIconDto(ref.icon) })) ?? void 0;
    } catch (err) {
      this.logService.error("ExtHostSCM#$provideHistoryItemRefs", err);
      return void 0;
    }
  }
  async $provideHistoryItems(sourceControlHandle, options, token) {
    try {
      const historyProvider = this._sourceControls.get(sourceControlHandle)?.historyProvider;
      const historyItems = await historyProvider?.provideHistoryItems(options, token);
      return historyItems?.map((item) => toSCMHistoryItemDto(item)) ?? void 0;
    } catch (err) {
      this.logService.error("ExtHostSCM#$provideHistoryItems", err);
      return void 0;
    }
  }
  async $provideHistoryItemChanges(sourceControlHandle, historyItemId, historyItemParentId, token) {
    try {
      const historyProvider = this._sourceControls.get(sourceControlHandle)?.historyProvider;
      const changes = await historyProvider?.provideHistoryItemChanges(historyItemId, historyItemParentId, token);
      return changes ?? void 0;
    } catch (err) {
      this.logService.error("ExtHostSCM#$provideHistoryItemChanges", err);
      return void 0;
    }
  }
};
ExtHostSCM._handlePool = 0;
ExtHostSCM = __decorateClass([
  __decorateParam(3, ILogService)
], ExtHostSCM);
export {
  ExtHostSCM,
  ExtHostSCMInputBox
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvYXBpL2NvbW1vbi9leHRIb3N0U0NNLnRzIl0sCiAgInNvdXJjZXNDb250ZW50IjogWyIvKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuICogIENvcHlyaWdodCAoYykgTWljcm9zb2Z0IENvcnBvcmF0aW9uLiBBbGwgcmlnaHRzIHJlc2VydmVkLlxuICogIExpY2Vuc2VkIHVuZGVyIHRoZSBNSVQgTGljZW5zZS4gU2VlIExpY2Vuc2UudHh0IGluIHRoZSBwcm9qZWN0IHJvb3QgZm9yIGxpY2Vuc2UgaW5mb3JtYXRpb24uXG4gKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tKi9cblxuLyogZXNsaW50LWRpc2FibGUgbG9jYWwvY29kZS1uby1uYXRpdmUtcHJpdmF0ZSAqL1xuXG5pbXBvcnQgeyBVUkksIFVyaUNvbXBvbmVudHMgfSBmcm9tICcuLi8uLi8uLi9iYXNlL2NvbW1vbi91cmkuanMnO1xuaW1wb3J0IHsgRXZlbnQsIEVtaXR0ZXIgfSBmcm9tICcuLi8uLi8uLi9iYXNlL2NvbW1vbi9ldmVudC5qcyc7XG5pbXBvcnQgeyBkZWJvdW5jZSB9IGZyb20gJy4uLy4uLy4uL2Jhc2UvY29tbW9uL2RlY29yYXRvcnMuanMnO1xuaW1wb3J0IHsgRGlzcG9zYWJsZVN0b3JlLCBJRGlzcG9zYWJsZSwgTXV0YWJsZURpc3Bvc2FibGUgfSBmcm9tICcuLi8uLi8uLi9iYXNlL2NvbW1vbi9saWZlY3ljbGUuanMnO1xuaW1wb3J0IHsgYXNQcm9taXNlIH0gZnJvbSAnLi4vLi4vLi4vYmFzZS9jb21tb24vYXN5bmMuanMnO1xuaW1wb3J0IHsgRXh0SG9zdENvbW1hbmRzIH0gZnJvbSAnLi9leHRIb3N0Q29tbWFuZHMuanMnO1xuaW1wb3J0IHsgTWFpbkNvbnRleHQsIE1haW5UaHJlYWRTQ01TaGFwZSwgU0NNUmF3UmVzb3VyY2UsIFNDTVJhd1Jlc291cmNlU3BsaWNlLCBTQ01SYXdSZXNvdXJjZVNwbGljZXMsIElNYWluQ29udGV4dCwgRXh0SG9zdFNDTVNoYXBlLCBJQ29tbWFuZER0bywgTWFpblRocmVhZFRlbGVtZXRyeVNoYXBlLCBTQ01Hcm91cEZlYXR1cmVzLCBTQ01IaXN0b3J5SXRlbUR0bywgU0NNSGlzdG9yeUl0ZW1DaGFuZ2VEdG8sIFNDTUhpc3RvcnlJdGVtUmVmRHRvLCBTQ01BY3Rpb25CdXR0b25EdG8gfSBmcm9tICcuL2V4dEhvc3QucHJvdG9jb2wuanMnO1xuaW1wb3J0IHsgc29ydGVkRGlmZiwgZXF1YWxzIH0gZnJvbSAnLi4vLi4vLi4vYmFzZS9jb21tb24vYXJyYXlzLmpzJztcbmltcG9ydCB7IGNvbXBhcmVQYXRocyB9IGZyb20gJy4uLy4uLy4uL2Jhc2UvY29tbW9uL2NvbXBhcmVycy5qcyc7XG5pbXBvcnQgdHlwZSAqIGFzIHZzY29kZSBmcm9tICd2c2NvZGUnO1xuaW1wb3J0IHsgSVNwbGljZSB9IGZyb20gJy4uLy4uLy4uL2Jhc2UvY29tbW9uL3NlcXVlbmNlLmpzJztcbmltcG9ydCB7IElMb2dTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vcGxhdGZvcm0vbG9nL2NvbW1vbi9sb2cuanMnO1xuaW1wb3J0IHsgQ2FuY2VsbGF0aW9uVG9rZW4gfSBmcm9tICcuLi8uLi8uLi9iYXNlL2NvbW1vbi9jYW5jZWxsYXRpb24uanMnO1xuaW1wb3J0IHsgRXh0ZW5zaW9uSWRlbnRpZmllck1hcCwgSUV4dGVuc2lvbkRlc2NyaXB0aW9uIH0gZnJvbSAnLi4vLi4vLi4vcGxhdGZvcm0vZXh0ZW5zaW9ucy9jb21tb24vZXh0ZW5zaW9ucy5qcyc7XG5pbXBvcnQgeyBNYXJzaGFsbGVkSWQgfSBmcm9tICcuLi8uLi8uLi9iYXNlL2NvbW1vbi9tYXJzaGFsbGluZ0lkcy5qcyc7XG5pbXBvcnQgeyBUaGVtZUljb24gfSBmcm9tICcuLi8uLi8uLi9iYXNlL2NvbW1vbi90aGVtYWJsZXMuanMnO1xuaW1wb3J0IHsgSU1hcmtkb3duU3RyaW5nIH0gZnJvbSAnLi4vLi4vLi4vYmFzZS9jb21tb24vaHRtbENvbnRlbnQuanMnO1xuaW1wb3J0IHsgTWFya2Rvd25TdHJpbmcgfSBmcm9tICcuL2V4dEhvc3RUeXBlQ29udmVydGVycy5qcyc7XG5pbXBvcnQgeyBjaGVja1Byb3Bvc2VkQXBpRW5hYmxlZCwgaXNQcm9wb3NlZEFwaUVuYWJsZWQgfSBmcm9tICcuLi8uLi9zZXJ2aWNlcy9leHRlbnNpb25zL2NvbW1vbi9leHRlbnNpb25zLmpzJztcbmltcG9ydCB7IEV4dEhvc3REb2N1bWVudHMgfSBmcm9tICcuL2V4dEhvc3REb2N1bWVudHMuanMnO1xuaW1wb3J0IHsgU2NoZW1hcyB9IGZyb20gJy4uLy4uLy4uL2Jhc2UvY29tbW9uL25ldHdvcmsuanMnO1xuaW1wb3J0IHsgaXNMaW51eCB9IGZyb20gJy4uLy4uLy4uL2Jhc2UvY29tbW9uL3BsYXRmb3JtLmpzJztcbmltcG9ydCB7IHN0cnVjdHVyYWxFcXVhbHMgfSBmcm9tICcuLi8uLi8uLi9iYXNlL2NvbW1vbi9lcXVhbHMuanMnO1xuXG50eXBlIFByb3ZpZGVySGFuZGxlID0gbnVtYmVyO1xudHlwZSBHcm91cEhhbmRsZSA9IG51bWJlcjtcbnR5cGUgUmVzb3VyY2VTdGF0ZUhhbmRsZSA9IG51bWJlcjtcblxuZnVuY3Rpb24gaXNVcmkodGhpbmc6IGFueSk6IHRoaW5nIGlzIHZzY29kZS5Vcmkge1xuXHRyZXR1cm4gdGhpbmcgaW5zdGFuY2VvZiBVUkk7XG59XG5cbmZ1bmN0aW9uIHVyaUVxdWFscyhhOiB2c2NvZGUuVXJpLCBiOiB2c2NvZGUuVXJpKTogYm9vbGVhbiB7XG5cdGlmIChhLnNjaGVtZSA9PT0gU2NoZW1hcy5maWxlICYmIGIuc2NoZW1lID09PSBTY2hlbWFzLmZpbGUgJiYgaXNMaW51eCkge1xuXHRcdHJldHVybiBhLnRvU3RyaW5nKCkgPT09IGIudG9TdHJpbmcoKTtcblx0fVxuXG5cdHJldHVybiBhLnRvU3RyaW5nKCkudG9Mb3dlckNhc2UoKSA9PT0gYi50b1N0cmluZygpLnRvTG93ZXJDYXNlKCk7XG59XG5cbmZ1bmN0aW9uIGdldEljb25SZXNvdXJjZShkZWNvcmF0aW9ucz86IHZzY29kZS5Tb3VyY2VDb250cm9sUmVzb3VyY2VUaGVtYWJsZURlY29yYXRpb25zKTogVXJpQ29tcG9uZW50cyB8IFRoZW1lSWNvbiB8IHVuZGVmaW5lZCB7XG5cdGlmICghZGVjb3JhdGlvbnMpIHtcblx0XHRyZXR1cm4gdW5kZWZpbmVkO1xuXHR9IGVsc2UgaWYgKHR5cGVvZiBkZWNvcmF0aW9ucy5pY29uUGF0aCA9PT0gJ3N0cmluZycpIHtcblx0XHRyZXR1cm4gVVJJLmZpbGUoZGVjb3JhdGlvbnMuaWNvblBhdGgpO1xuXHR9IGVsc2UgaWYgKFVSSS5pc1VyaShkZWNvcmF0aW9ucy5pY29uUGF0aCkpIHtcblx0XHRyZXR1cm4gZGVjb3JhdGlvbnMuaWNvblBhdGg7XG5cdH0gZWxzZSBpZiAoVGhlbWVJY29uLmlzVGhlbWVJY29uKGRlY29yYXRpb25zLmljb25QYXRoKSkge1xuXHRcdHJldHVybiBkZWNvcmF0aW9ucy5pY29uUGF0aDtcblx0fSBlbHNlIHtcblx0XHRyZXR1cm4gdW5kZWZpbmVkO1xuXHR9XG59XG5cbmZ1bmN0aW9uIGdldEhpc3RvcnlJdGVtSWNvbkR0byhpY29uOiB2c2NvZGUuVXJpIHwgeyBsaWdodDogdnNjb2RlLlVyaTsgZGFyazogdnNjb2RlLlVyaSB9IHwgdnNjb2RlLlRoZW1lSWNvbiB8IHVuZGVmaW5lZCk6IFVyaUNvbXBvbmVudHMgfCB7IGxpZ2h0OiBVcmlDb21wb25lbnRzOyBkYXJrOiBVcmlDb21wb25lbnRzIH0gfCBUaGVtZUljb24gfCB1bmRlZmluZWQge1xuXHRpZiAoIWljb24pIHtcblx0XHRyZXR1cm4gdW5kZWZpbmVkO1xuXHR9IGVsc2UgaWYgKFVSSS5pc1VyaShpY29uKSkge1xuXHRcdHJldHVybiBpY29uO1xuXHR9IGVsc2UgaWYgKFRoZW1lSWNvbi5pc1RoZW1lSWNvbihpY29uKSkge1xuXHRcdHJldHVybiBpY29uO1xuXHR9IGVsc2Uge1xuXHRcdGNvbnN0IGljb25EdG8gPSBpY29uIGFzIHsgbGlnaHQ6IFVSSTsgZGFyazogVVJJIH07XG5cdFx0cmV0dXJuIHsgbGlnaHQ6IGljb25EdG8ubGlnaHQsIGRhcms6IGljb25EdG8uZGFyayB9O1xuXHR9XG59XG5cbmZ1bmN0aW9uIHRvU0NNSGlzdG9yeUl0ZW1EdG8oaGlzdG9yeUl0ZW06IHZzY29kZS5Tb3VyY2VDb250cm9sSGlzdG9yeUl0ZW0pOiBTQ01IaXN0b3J5SXRlbUR0byB7XG5cdGNvbnN0IGF1dGhvckljb24gPSBnZXRIaXN0b3J5SXRlbUljb25EdG8oaGlzdG9yeUl0ZW0uYXV0aG9ySWNvbik7XG5cdGNvbnN0IHJlZmVyZW5jZXMgPSBoaXN0b3J5SXRlbS5yZWZlcmVuY2VzPy5tYXAociA9PiAoe1xuXHRcdC4uLnIsIGljb246IGdldEhpc3RvcnlJdGVtSWNvbkR0byhyLmljb24pXG5cdH0pKTtcblxuXHRyZXR1cm4geyAuLi5oaXN0b3J5SXRlbSwgYXV0aG9ySWNvbiwgcmVmZXJlbmNlcyB9O1xufVxuXG5mdW5jdGlvbiB0b1NDTUhpc3RvcnlJdGVtUmVmRHRvKGhpc3RvcnlJdGVtUmVmPzogdnNjb2RlLlNvdXJjZUNvbnRyb2xIaXN0b3J5SXRlbVJlZik6IFNDTUhpc3RvcnlJdGVtUmVmRHRvIHwgdW5kZWZpbmVkIHtcblx0cmV0dXJuIGhpc3RvcnlJdGVtUmVmID8geyAuLi5oaXN0b3J5SXRlbVJlZiwgaWNvbjogZ2V0SGlzdG9yeUl0ZW1JY29uRHRvKGhpc3RvcnlJdGVtUmVmLmljb24pIH0gOiB1bmRlZmluZWQ7XG59XG5cbmZ1bmN0aW9uIGNvbXBhcmVSZXNvdXJjZVRoZW1hYmxlRGVjb3JhdGlvbnMoYTogdnNjb2RlLlNvdXJjZUNvbnRyb2xSZXNvdXJjZVRoZW1hYmxlRGVjb3JhdGlvbnMsIGI6IHZzY29kZS5Tb3VyY2VDb250cm9sUmVzb3VyY2VUaGVtYWJsZURlY29yYXRpb25zKTogbnVtYmVyIHtcblx0aWYgKCFhLmljb25QYXRoICYmICFiLmljb25QYXRoKSB7XG5cdFx0cmV0dXJuIDA7XG5cdH0gZWxzZSBpZiAoIWEuaWNvblBhdGgpIHtcblx0XHRyZXR1cm4gLTE7XG5cdH0gZWxzZSBpZiAoIWIuaWNvblBhdGgpIHtcblx0XHRyZXR1cm4gMTtcblx0fVxuXG5cdGNvbnN0IGFQYXRoID0gdHlwZW9mIGEuaWNvblBhdGggPT09ICdzdHJpbmcnID8gYS5pY29uUGF0aCA6IFVSSS5pc1VyaShhLmljb25QYXRoKSA/IGEuaWNvblBhdGguZnNQYXRoIDogKGEuaWNvblBhdGggYXMgdnNjb2RlLlRoZW1lSWNvbikuaWQ7XG5cdGNvbnN0IGJQYXRoID0gdHlwZW9mIGIuaWNvblBhdGggPT09ICdzdHJpbmcnID8gYi5pY29uUGF0aCA6IFVSSS5pc1VyaShiLmljb25QYXRoKSA/IGIuaWNvblBhdGguZnNQYXRoIDogKGIuaWNvblBhdGggYXMgdnNjb2RlLlRoZW1lSWNvbikuaWQ7XG5cdHJldHVybiBjb21wYXJlUGF0aHMoYVBhdGgsIGJQYXRoKTtcbn1cblxuZnVuY3Rpb24gY29tcGFyZVJlc291cmNlU3RhdGVzRGVjb3JhdGlvbnMoYTogdnNjb2RlLlNvdXJjZUNvbnRyb2xSZXNvdXJjZURlY29yYXRpb25zLCBiOiB2c2NvZGUuU291cmNlQ29udHJvbFJlc291cmNlRGVjb3JhdGlvbnMpOiBudW1iZXIge1xuXHRsZXQgcmVzdWx0ID0gMDtcblxuXHRpZiAoYS5zdHJpa2VUaHJvdWdoICE9PSBiLnN0cmlrZVRocm91Z2gpIHtcblx0XHRyZXR1cm4gYS5zdHJpa2VUaHJvdWdoID8gMSA6IC0xO1xuXHR9XG5cblx0aWYgKGEuZmFkZWQgIT09IGIuZmFkZWQpIHtcblx0XHRyZXR1cm4gYS5mYWRlZCA/IDEgOiAtMTtcblx0fVxuXG5cdGlmIChhLnRvb2x0aXAgIT09IGIudG9vbHRpcCkge1xuXHRcdHJldHVybiAoYS50b29sdGlwIHx8ICcnKS5sb2NhbGVDb21wYXJlKGIudG9vbHRpcCB8fCAnJyk7XG5cdH1cblxuXHRyZXN1bHQgPSBjb21wYXJlUmVzb3VyY2VUaGVtYWJsZURlY29yYXRpb25zKGEsIGIpO1xuXG5cdGlmIChyZXN1bHQgIT09IDApIHtcblx0XHRyZXR1cm4gcmVzdWx0O1xuXHR9XG5cblx0aWYgKGEubGlnaHQgJiYgYi5saWdodCkge1xuXHRcdHJlc3VsdCA9IGNvbXBhcmVSZXNvdXJjZVRoZW1hYmxlRGVjb3JhdGlvbnMoYS5saWdodCwgYi5saWdodCk7XG5cdH0gZWxzZSBpZiAoYS5saWdodCkge1xuXHRcdHJldHVybiAxO1xuXHR9IGVsc2UgaWYgKGIubGlnaHQpIHtcblx0XHRyZXR1cm4gLTE7XG5cdH1cblxuXHRpZiAocmVzdWx0ICE9PSAwKSB7XG5cdFx0cmV0dXJuIHJlc3VsdDtcblx0fVxuXG5cdGlmIChhLmRhcmsgJiYgYi5kYXJrKSB7XG5cdFx0cmVzdWx0ID0gY29tcGFyZVJlc291cmNlVGhlbWFibGVEZWNvcmF0aW9ucyhhLmRhcmssIGIuZGFyayk7XG5cdH0gZWxzZSBpZiAoYS5kYXJrKSB7XG5cdFx0cmV0dXJuIDE7XG5cdH0gZWxzZSBpZiAoYi5kYXJrKSB7XG5cdFx0cmV0dXJuIC0xO1xuXHR9XG5cblx0cmV0dXJuIHJlc3VsdDtcbn1cblxuZnVuY3Rpb24gY29tcGFyZUNvbW1hbmRzKGE6IHZzY29kZS5Db21tYW5kLCBiOiB2c2NvZGUuQ29tbWFuZCk6IG51bWJlciB7XG5cdGlmIChhLmNvbW1hbmQgIT09IGIuY29tbWFuZCkge1xuXHRcdHJldHVybiBhLmNvbW1hbmQgPCBiLmNvbW1hbmQgPyAtMSA6IDE7XG5cdH1cblxuXHRpZiAoYS50aXRsZSAhPT0gYi50aXRsZSkge1xuXHRcdHJldHVybiBhLnRpdGxlIDwgYi50aXRsZSA/IC0xIDogMTtcblx0fVxuXG5cdGlmIChhLnRvb2x0aXAgIT09IGIudG9vbHRpcCkge1xuXHRcdGlmIChhLnRvb2x0aXAgIT09IHVuZGVmaW5lZCAmJiBiLnRvb2x0aXAgIT09IHVuZGVmaW5lZCkge1xuXHRcdFx0cmV0dXJuIGEudG9vbHRpcCA8IGIudG9vbHRpcCA/IC0xIDogMTtcblx0XHR9IGVsc2UgaWYgKGEudG9vbHRpcCAhPT0gdW5kZWZpbmVkKSB7XG5cdFx0XHRyZXR1cm4gMTtcblx0XHR9IGVsc2UgaWYgKGIudG9vbHRpcCAhPT0gdW5kZWZpbmVkKSB7XG5cdFx0XHRyZXR1cm4gLTE7XG5cdFx0fVxuXHR9XG5cblx0aWYgKGEuYXJndW1lbnRzID09PSBiLmFyZ3VtZW50cykge1xuXHRcdHJldHVybiAwO1xuXHR9IGVsc2UgaWYgKCFhLmFyZ3VtZW50cykge1xuXHRcdHJldHVybiAtMTtcblx0fSBlbHNlIGlmICghYi5hcmd1bWVudHMpIHtcblx0XHRyZXR1cm4gMTtcblx0fSBlbHNlIGlmIChhLmFyZ3VtZW50cy5sZW5ndGggIT09IGIuYXJndW1lbnRzLmxlbmd0aCkge1xuXHRcdHJldHVybiBhLmFyZ3VtZW50cy5sZW5ndGggLSBiLmFyZ3VtZW50cy5sZW5ndGg7XG5cdH1cblxuXHRmb3IgKGxldCBpID0gMDsgaSA8IGEuYXJndW1lbnRzLmxlbmd0aDsgaSsrKSB7XG5cdFx0Y29uc3QgYUFyZyA9IGEuYXJndW1lbnRzW2ldO1xuXHRcdGNvbnN0IGJBcmcgPSBiLmFyZ3VtZW50c1tpXTtcblxuXHRcdGlmIChhQXJnID09PSBiQXJnKSB7XG5cdFx0XHRjb250aW51ZTtcblx0XHR9XG5cblx0XHRpZiAoaXNVcmkoYUFyZykgJiYgaXNVcmkoYkFyZykgJiYgdXJpRXF1YWxzKGFBcmcsIGJBcmcpKSB7XG5cdFx0XHRjb250aW51ZTtcblx0XHR9XG5cblx0XHRyZXR1cm4gYUFyZyA8IGJBcmcgPyAtMSA6IDE7XG5cdH1cblxuXHRyZXR1cm4gMDtcbn1cblxuZnVuY3Rpb24gY29tcGFyZVJlc291cmNlU3RhdGVzKGE6IHZzY29kZS5Tb3VyY2VDb250cm9sUmVzb3VyY2VTdGF0ZSwgYjogdnNjb2RlLlNvdXJjZUNvbnRyb2xSZXNvdXJjZVN0YXRlKTogbnVtYmVyIHtcblx0bGV0IHJlc3VsdCA9IGNvbXBhcmVQYXRocyhhLnJlc291cmNlVXJpLmZzUGF0aCwgYi5yZXNvdXJjZVVyaS5mc1BhdGgsIHRydWUpO1xuXG5cdGlmIChyZXN1bHQgIT09IDApIHtcblx0XHRyZXR1cm4gcmVzdWx0O1xuXHR9XG5cblx0aWYgKGEuY29tbWFuZCAmJiBiLmNvbW1hbmQpIHtcblx0XHRyZXN1bHQgPSBjb21wYXJlQ29tbWFuZHMoYS5jb21tYW5kLCBiLmNvbW1hbmQpO1xuXHR9IGVsc2UgaWYgKGEuY29tbWFuZCkge1xuXHRcdHJldHVybiAxO1xuXHR9IGVsc2UgaWYgKGIuY29tbWFuZCkge1xuXHRcdHJldHVybiAtMTtcblx0fVxuXG5cdGlmIChyZXN1bHQgIT09IDApIHtcblx0XHRyZXR1cm4gcmVzdWx0O1xuXHR9XG5cblx0aWYgKGEuZGVjb3JhdGlvbnMgJiYgYi5kZWNvcmF0aW9ucykge1xuXHRcdHJlc3VsdCA9IGNvbXBhcmVSZXNvdXJjZVN0YXRlc0RlY29yYXRpb25zKGEuZGVjb3JhdGlvbnMsIGIuZGVjb3JhdGlvbnMpO1xuXHR9IGVsc2UgaWYgKGEuZGVjb3JhdGlvbnMpIHtcblx0XHRyZXR1cm4gMTtcblx0fSBlbHNlIGlmIChiLmRlY29yYXRpb25zKSB7XG5cdFx0cmV0dXJuIC0xO1xuXHR9XG5cblx0aWYgKHJlc3VsdCAhPT0gMCkge1xuXHRcdHJldHVybiByZXN1bHQ7XG5cdH1cblxuXHRpZiAoYS5tdWx0aUZpbGVEaWZmRWRpdG9yTW9kaWZpZWRVcmkgJiYgYi5tdWx0aUZpbGVEaWZmRWRpdG9yTW9kaWZpZWRVcmkpIHtcblx0XHRyZXN1bHQgPSBjb21wYXJlUGF0aHMoYS5tdWx0aUZpbGVEaWZmRWRpdG9yTW9kaWZpZWRVcmkuZnNQYXRoLCBiLm11bHRpRmlsZURpZmZFZGl0b3JNb2RpZmllZFVyaS5mc1BhdGgsIHRydWUpO1xuXHR9IGVsc2UgaWYgKGEubXVsdGlGaWxlRGlmZkVkaXRvck1vZGlmaWVkVXJpKSB7XG5cdFx0cmV0dXJuIDE7XG5cdH0gZWxzZSBpZiAoYi5tdWx0aUZpbGVEaWZmRWRpdG9yTW9kaWZpZWRVcmkpIHtcblx0XHRyZXR1cm4gLTE7XG5cdH1cblxuXHRpZiAocmVzdWx0ICE9PSAwKSB7XG5cdFx0cmV0dXJuIHJlc3VsdDtcblx0fVxuXG5cdGlmIChhLm11bHRpRGlmZkVkaXRvck9yaWdpbmFsVXJpICYmIGIubXVsdGlEaWZmRWRpdG9yT3JpZ2luYWxVcmkpIHtcblx0XHRyZXN1bHQgPSBjb21wYXJlUGF0aHMoYS5tdWx0aURpZmZFZGl0b3JPcmlnaW5hbFVyaS5mc1BhdGgsIGIubXVsdGlEaWZmRWRpdG9yT3JpZ2luYWxVcmkuZnNQYXRoLCB0cnVlKTtcblx0fSBlbHNlIGlmIChhLm11bHRpRGlmZkVkaXRvck9yaWdpbmFsVXJpKSB7XG5cdFx0cmV0dXJuIDE7XG5cdH0gZWxzZSBpZiAoYi5tdWx0aURpZmZFZGl0b3JPcmlnaW5hbFVyaSkge1xuXHRcdHJldHVybiAtMTtcblx0fVxuXG5cdHJldHVybiByZXN1bHQ7XG59XG5cbmZ1bmN0aW9uIGNvbXBhcmVBcmdzKGE6IGFueVtdLCBiOiBhbnlbXSk6IGJvb2xlYW4ge1xuXHRmb3IgKGxldCBpID0gMDsgaSA8IGEubGVuZ3RoOyBpKyspIHtcblx0XHRpZiAoYVtpXSAhPT0gYltpXSkge1xuXHRcdFx0cmV0dXJuIGZhbHNlO1xuXHRcdH1cblx0fVxuXG5cdHJldHVybiB0cnVlO1xufVxuXG5mdW5jdGlvbiBjb21tYW5kRXF1YWxzKGE6IHZzY29kZS5Db21tYW5kLCBiOiB2c2NvZGUuQ29tbWFuZCk6IGJvb2xlYW4ge1xuXHRyZXR1cm4gYS5jb21tYW5kID09PSBiLmNvbW1hbmRcblx0XHQmJiBhLnRpdGxlID09PSBiLnRpdGxlXG5cdFx0JiYgYS50b29sdGlwID09PSBiLnRvb2x0aXBcblx0XHQmJiAoYS5hcmd1bWVudHMgJiYgYi5hcmd1bWVudHMgPyBjb21wYXJlQXJncyhhLmFyZ3VtZW50cywgYi5hcmd1bWVudHMpIDogYS5hcmd1bWVudHMgPT09IGIuYXJndW1lbnRzKTtcbn1cblxuZnVuY3Rpb24gY29tbWFuZExpc3RFcXVhbHMoYTogcmVhZG9ubHkgdnNjb2RlLkNvbW1hbmRbXSwgYjogcmVhZG9ubHkgdnNjb2RlLkNvbW1hbmRbXSk6IGJvb2xlYW4ge1xuXHRyZXR1cm4gZXF1YWxzKGEsIGIsIGNvbW1hbmRFcXVhbHMpO1xufVxuXG5leHBvcnQgaW50ZXJmYWNlIElWYWxpZGF0ZUlucHV0IHtcblx0KHZhbHVlOiBzdHJpbmcsIGN1cnNvclBvc2l0aW9uOiBudW1iZXIpOiB2c2NvZGUuUHJvdmlkZXJSZXN1bHQ8dnNjb2RlLlNvdXJjZUNvbnRyb2xJbnB1dEJveFZhbGlkYXRpb24gfCB1bmRlZmluZWQgfCBudWxsPjtcbn1cblxuZXhwb3J0IGNsYXNzIEV4dEhvc3RTQ01JbnB1dEJveCBpbXBsZW1lbnRzIHZzY29kZS5Tb3VyY2VDb250cm9sSW5wdXRCb3gge1xuXG5cdCNwcm94eTogTWFpblRocmVhZFNDTVNoYXBlO1xuXHQjZXh0SG9zdERvY3VtZW50czogRXh0SG9zdERvY3VtZW50cztcblxuXHRwcml2YXRlIF92YWx1ZTogc3RyaW5nID0gJyc7XG5cblx0Z2V0IHZhbHVlKCk6IHN0cmluZyB7XG5cdFx0cmV0dXJuIHRoaXMuX3ZhbHVlO1xuXHR9XG5cblx0c2V0IHZhbHVlKHZhbHVlOiBzdHJpbmcpIHtcblx0XHR2YWx1ZSA9IHZhbHVlID8/ICcnO1xuXHRcdHRoaXMuI3Byb3h5LiRzZXRJbnB1dEJveFZhbHVlKHRoaXMuX3NvdXJjZUNvbnRyb2xIYW5kbGUsIHZhbHVlKTtcblx0XHR0aGlzLnVwZGF0ZVZhbHVlKHZhbHVlKTtcblx0fVxuXG5cdHByaXZhdGUgcmVhZG9ubHkgX29uRGlkQ2hhbmdlID0gbmV3IEVtaXR0ZXI8c3RyaW5nPigpO1xuXG5cdGdldCBvbkRpZENoYW5nZSgpOiBFdmVudDxzdHJpbmc+IHtcblx0XHRyZXR1cm4gdGhpcy5fb25EaWRDaGFuZ2UuZXZlbnQ7XG5cdH1cblxuXHRwcml2YXRlIF9wbGFjZWhvbGRlcjogc3RyaW5nID0gJyc7XG5cblx0Z2V0IHBsYWNlaG9sZGVyKCk6IHN0cmluZyB7XG5cdFx0cmV0dXJuIHRoaXMuX3BsYWNlaG9sZGVyO1xuXHR9XG5cblx0c2V0IHBsYWNlaG9sZGVyKHBsYWNlaG9sZGVyOiBzdHJpbmcpIHtcblx0XHR0aGlzLiNwcm94eS4kc2V0SW5wdXRCb3hQbGFjZWhvbGRlcih0aGlzLl9zb3VyY2VDb250cm9sSGFuZGxlLCBwbGFjZWhvbGRlcik7XG5cdFx0dGhpcy5fcGxhY2Vob2xkZXIgPSBwbGFjZWhvbGRlcjtcblx0fVxuXG5cdHByaXZhdGUgX3ZhbGlkYXRlSW5wdXQ6IElWYWxpZGF0ZUlucHV0IHwgdW5kZWZpbmVkO1xuXG5cdGdldCB2YWxpZGF0ZUlucHV0KCk6IElWYWxpZGF0ZUlucHV0IHwgdW5kZWZpbmVkIHtcblx0XHRjaGVja1Byb3Bvc2VkQXBpRW5hYmxlZCh0aGlzLl9leHRlbnNpb24sICdzY21WYWxpZGF0aW9uJyk7XG5cblx0XHRyZXR1cm4gdGhpcy5fdmFsaWRhdGVJbnB1dDtcblx0fVxuXG5cdHNldCB2YWxpZGF0ZUlucHV0KGZuOiBJVmFsaWRhdGVJbnB1dCB8IHVuZGVmaW5lZCkge1xuXHRcdGNoZWNrUHJvcG9zZWRBcGlFbmFibGVkKHRoaXMuX2V4dGVuc2lvbiwgJ3NjbVZhbGlkYXRpb24nKTtcblxuXHRcdGlmIChmbiAmJiB0eXBlb2YgZm4gIT09ICdmdW5jdGlvbicpIHtcblx0XHRcdHRocm93IG5ldyBFcnJvcihgWyR7dGhpcy5fZXh0ZW5zaW9uLmlkZW50aWZpZXIudmFsdWV9XTogSW52YWxpZCBTQ00gaW5wdXQgYm94IHZhbGlkYXRpb24gZnVuY3Rpb25gKTtcblx0XHR9XG5cblx0XHR0aGlzLl92YWxpZGF0ZUlucHV0ID0gZm47XG5cdFx0dGhpcy4jcHJveHkuJHNldFZhbGlkYXRpb25Qcm92aWRlcklzRW5hYmxlZCh0aGlzLl9zb3VyY2VDb250cm9sSGFuZGxlLCAhIWZuKTtcblx0fVxuXG5cdHByaXZhdGUgX2VuYWJsZWQ6IGJvb2xlYW4gPSB0cnVlO1xuXG5cdGdldCBlbmFibGVkKCk6IGJvb2xlYW4ge1xuXHRcdHJldHVybiB0aGlzLl9lbmFibGVkO1xuXHR9XG5cblx0c2V0IGVuYWJsZWQoZW5hYmxlZDogYm9vbGVhbikge1xuXHRcdGVuYWJsZWQgPSAhIWVuYWJsZWQ7XG5cblx0XHRpZiAodGhpcy5fZW5hYmxlZCA9PT0gZW5hYmxlZCkge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblxuXHRcdHRoaXMuX2VuYWJsZWQgPSBlbmFibGVkO1xuXHRcdHRoaXMuI3Byb3h5LiRzZXRJbnB1dEJveEVuYWJsZW1lbnQodGhpcy5fc291cmNlQ29udHJvbEhhbmRsZSwgZW5hYmxlZCk7XG5cdH1cblxuXHRwcml2YXRlIF92aXNpYmxlOiBib29sZWFuID0gdHJ1ZTtcblxuXHRnZXQgdmlzaWJsZSgpOiBib29sZWFuIHtcblx0XHRyZXR1cm4gdGhpcy5fdmlzaWJsZTtcblx0fVxuXG5cdHNldCB2aXNpYmxlKHZpc2libGU6IGJvb2xlYW4pIHtcblx0XHR2aXNpYmxlID0gISF2aXNpYmxlO1xuXG5cdFx0aWYgKHRoaXMuX3Zpc2libGUgPT09IHZpc2libGUpIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cblx0XHR0aGlzLl92aXNpYmxlID0gdmlzaWJsZTtcblx0XHR0aGlzLiNwcm94eS4kc2V0SW5wdXRCb3hWaXNpYmlsaXR5KHRoaXMuX3NvdXJjZUNvbnRyb2xIYW5kbGUsIHZpc2libGUpO1xuXHR9XG5cblx0Z2V0IGRvY3VtZW50KCk6IHZzY29kZS5UZXh0RG9jdW1lbnQge1xuXHRcdGNoZWNrUHJvcG9zZWRBcGlFbmFibGVkKHRoaXMuX2V4dGVuc2lvbiwgJ3NjbVRleHREb2N1bWVudCcpO1xuXG5cdFx0cmV0dXJuIHRoaXMuI2V4dEhvc3REb2N1bWVudHMuZ2V0RG9jdW1lbnQodGhpcy5fZG9jdW1lbnRVcmkpO1xuXHR9XG5cblx0Y29uc3RydWN0b3IocHJpdmF0ZSBfZXh0ZW5zaW9uOiBJRXh0ZW5zaW9uRGVzY3JpcHRpb24sIF9leHRIb3N0RG9jdW1lbnRzOiBFeHRIb3N0RG9jdW1lbnRzLCBwcm94eTogTWFpblRocmVhZFNDTVNoYXBlLCBwcml2YXRlIF9zb3VyY2VDb250cm9sSGFuZGxlOiBudW1iZXIsIHByaXZhdGUgX2RvY3VtZW50VXJpOiBVUkkpIHtcblx0XHR0aGlzLiNleHRIb3N0RG9jdW1lbnRzID0gX2V4dEhvc3REb2N1bWVudHM7XG5cdFx0dGhpcy4jcHJveHkgPSBwcm94eTtcblx0fVxuXG5cdHNob3dWYWxpZGF0aW9uTWVzc2FnZShtZXNzYWdlOiBzdHJpbmcgfCB2c2NvZGUuTWFya2Rvd25TdHJpbmcsIHR5cGU6IHZzY29kZS5Tb3VyY2VDb250cm9sSW5wdXRCb3hWYWxpZGF0aW9uVHlwZSkge1xuXHRcdGNoZWNrUHJvcG9zZWRBcGlFbmFibGVkKHRoaXMuX2V4dGVuc2lvbiwgJ3NjbVZhbGlkYXRpb24nKTtcblxuXHRcdHRoaXMuI3Byb3h5LiRzaG93VmFsaWRhdGlvbk1lc3NhZ2UodGhpcy5fc291cmNlQ29udHJvbEhhbmRsZSwgbWVzc2FnZSwgdHlwZSBhcyBhbnkpO1xuXHR9XG5cblx0JG9uSW5wdXRCb3hWYWx1ZUNoYW5nZSh2YWx1ZTogc3RyaW5nKTogdm9pZCB7XG5cdFx0dGhpcy51cGRhdGVWYWx1ZSh2YWx1ZSk7XG5cdH1cblxuXHRwcml2YXRlIHVwZGF0ZVZhbHVlKHZhbHVlOiBzdHJpbmcpOiB2b2lkIHtcblx0XHR0aGlzLl92YWx1ZSA9IHZhbHVlO1xuXHRcdHRoaXMuX29uRGlkQ2hhbmdlLmZpcmUodmFsdWUpO1xuXHR9XG59XG5cbmNsYXNzIEV4dEhvc3RTb3VyY2VDb250cm9sUmVzb3VyY2VHcm91cCBpbXBsZW1lbnRzIHZzY29kZS5Tb3VyY2VDb250cm9sUmVzb3VyY2VHcm91cCB7XG5cblx0cHJpdmF0ZSBzdGF0aWMgX2hhbmRsZVBvb2w6IG51bWJlciA9IDA7XG5cdHByaXZhdGUgX3Jlc291cmNlSGFuZGxlUG9vbDogbnVtYmVyID0gMDtcblx0cHJpdmF0ZSBfcmVzb3VyY2VTdGF0ZXM6IHZzY29kZS5Tb3VyY2VDb250cm9sUmVzb3VyY2VTdGF0ZVtdID0gW107XG5cblx0cHJpdmF0ZSBfcmVzb3VyY2VTdGF0ZXNNYXAgPSBuZXcgTWFwPFJlc291cmNlU3RhdGVIYW5kbGUsIHZzY29kZS5Tb3VyY2VDb250cm9sUmVzb3VyY2VTdGF0ZT4oKTtcblx0cHJpdmF0ZSBfcmVzb3VyY2VTdGF0ZXNDb21tYW5kc01hcCA9IG5ldyBNYXA8UmVzb3VyY2VTdGF0ZUhhbmRsZSwgdnNjb2RlLkNvbW1hbmQ+KCk7XG5cdHByaXZhdGUgX3Jlc291cmNlU3RhdGVzRGlzcG9zYWJsZXNNYXAgPSBuZXcgTWFwPFJlc291cmNlU3RhdGVIYW5kbGUsIElEaXNwb3NhYmxlPigpO1xuXG5cdHByaXZhdGUgcmVhZG9ubHkgX29uRGlkVXBkYXRlUmVzb3VyY2VTdGF0ZXMgPSBuZXcgRW1pdHRlcjx2b2lkPigpO1xuXHRyZWFkb25seSBvbkRpZFVwZGF0ZVJlc291cmNlU3RhdGVzID0gdGhpcy5fb25EaWRVcGRhdGVSZXNvdXJjZVN0YXRlcy5ldmVudDtcblxuXHRwcml2YXRlIF9kaXNwb3NlZCA9IGZhbHNlO1xuXHRnZXQgZGlzcG9zZWQoKTogYm9vbGVhbiB7IHJldHVybiB0aGlzLl9kaXNwb3NlZDsgfVxuXHRwcml2YXRlIHJlYWRvbmx5IF9vbkRpZERpc3Bvc2UgPSBuZXcgRW1pdHRlcjx2b2lkPigpO1xuXHRyZWFkb25seSBvbkRpZERpc3Bvc2UgPSB0aGlzLl9vbkRpZERpc3Bvc2UuZXZlbnQ7XG5cblx0cHJpdmF0ZSBfaGFuZGxlc1NuYXBzaG90OiBudW1iZXJbXSA9IFtdO1xuXHRwcml2YXRlIF9yZXNvdXJjZVNuYXBzaG90OiB2c2NvZGUuU291cmNlQ29udHJvbFJlc291cmNlU3RhdGVbXSA9IFtdO1xuXG5cdGdldCBpZCgpOiBzdHJpbmcgeyByZXR1cm4gdGhpcy5faWQ7IH1cblxuXHRnZXQgbGFiZWwoKTogc3RyaW5nIHsgcmV0dXJuIHRoaXMuX2xhYmVsOyB9XG5cdHNldCBsYWJlbChsYWJlbDogc3RyaW5nKSB7XG5cdFx0dGhpcy5fbGFiZWwgPSBsYWJlbDtcblx0XHR0aGlzLl9wcm94eS4kdXBkYXRlR3JvdXBMYWJlbCh0aGlzLl9zb3VyY2VDb250cm9sSGFuZGxlLCB0aGlzLmhhbmRsZSwgbGFiZWwpO1xuXHR9XG5cblx0cHJpdmF0ZSBfY29udGV4dFZhbHVlOiBzdHJpbmcgfCB1bmRlZmluZWQgPSB1bmRlZmluZWQ7XG5cdGdldCBjb250ZXh0VmFsdWUoKTogc3RyaW5nIHwgdW5kZWZpbmVkIHtcblx0XHRyZXR1cm4gdGhpcy5fY29udGV4dFZhbHVlO1xuXHR9XG5cdHNldCBjb250ZXh0VmFsdWUoY29udGV4dFZhbHVlOiBzdHJpbmcgfCB1bmRlZmluZWQpIHtcblx0XHR0aGlzLl9jb250ZXh0VmFsdWUgPSBjb250ZXh0VmFsdWU7XG5cdFx0dGhpcy5fcHJveHkuJHVwZGF0ZUdyb3VwKHRoaXMuX3NvdXJjZUNvbnRyb2xIYW5kbGUsIHRoaXMuaGFuZGxlLCB0aGlzLmZlYXR1cmVzKTtcblx0fVxuXG5cdHByaXZhdGUgX2hpZGVXaGVuRW1wdHk6IGJvb2xlYW4gfCB1bmRlZmluZWQgPSB1bmRlZmluZWQ7XG5cdGdldCBoaWRlV2hlbkVtcHR5KCk6IGJvb2xlYW4gfCB1bmRlZmluZWQgeyByZXR1cm4gdGhpcy5faGlkZVdoZW5FbXB0eTsgfVxuXHRzZXQgaGlkZVdoZW5FbXB0eShoaWRlV2hlbkVtcHR5OiBib29sZWFuIHwgdW5kZWZpbmVkKSB7XG5cdFx0dGhpcy5faGlkZVdoZW5FbXB0eSA9IGhpZGVXaGVuRW1wdHk7XG5cdFx0dGhpcy5fcHJveHkuJHVwZGF0ZUdyb3VwKHRoaXMuX3NvdXJjZUNvbnRyb2xIYW5kbGUsIHRoaXMuaGFuZGxlLCB0aGlzLmZlYXR1cmVzKTtcblx0fVxuXG5cdGdldCBmZWF0dXJlcygpOiBTQ01Hcm91cEZlYXR1cmVzIHtcblx0XHRyZXR1cm4ge1xuXHRcdFx0Y29udGV4dFZhbHVlOiB0aGlzLmNvbnRleHRWYWx1ZSxcblx0XHRcdGhpZGVXaGVuRW1wdHk6IHRoaXMuaGlkZVdoZW5FbXB0eVxuXHRcdH07XG5cdH1cblxuXHRnZXQgcmVzb3VyY2VTdGF0ZXMoKTogdnNjb2RlLlNvdXJjZUNvbnRyb2xSZXNvdXJjZVN0YXRlW10geyByZXR1cm4gWy4uLnRoaXMuX3Jlc291cmNlU3RhdGVzXTsgfVxuXHRzZXQgcmVzb3VyY2VTdGF0ZXMocmVzb3VyY2VzOiB2c2NvZGUuU291cmNlQ29udHJvbFJlc291cmNlU3RhdGVbXSkge1xuXHRcdHRoaXMuX3Jlc291cmNlU3RhdGVzID0gWy4uLnJlc291cmNlc107XG5cdFx0dGhpcy5fb25EaWRVcGRhdGVSZXNvdXJjZVN0YXRlcy5maXJlKCk7XG5cdH1cblxuXHRyZWFkb25seSBoYW5kbGUgPSBFeHRIb3N0U291cmNlQ29udHJvbFJlc291cmNlR3JvdXAuX2hhbmRsZVBvb2wrKztcblxuXHRjb25zdHJ1Y3Rvcihcblx0XHRwcml2YXRlIF9wcm94eTogTWFpblRocmVhZFNDTVNoYXBlLFxuXHRcdHByaXZhdGUgX2NvbW1hbmRzOiBFeHRIb3N0Q29tbWFuZHMsXG5cdFx0cHJpdmF0ZSBfc291cmNlQ29udHJvbEhhbmRsZTogbnVtYmVyLFxuXHRcdHByaXZhdGUgX2lkOiBzdHJpbmcsXG5cdFx0cHJpdmF0ZSBfbGFiZWw6IHN0cmluZyxcblx0XHRwdWJsaWMgcmVhZG9ubHkgbXVsdGlEaWZmRWRpdG9yRW5hYmxlVmlld0NoYW5nZXM6IGJvb2xlYW4sXG5cdFx0cHJpdmF0ZSByZWFkb25seSBfZXh0ZW5zaW9uOiBJRXh0ZW5zaW9uRGVzY3JpcHRpb24sXG5cdCkgeyB9XG5cblx0Z2V0UmVzb3VyY2VTdGF0ZShoYW5kbGU6IG51bWJlcik6IHZzY29kZS5Tb3VyY2VDb250cm9sUmVzb3VyY2VTdGF0ZSB8IHVuZGVmaW5lZCB7XG5cdFx0cmV0dXJuIHRoaXMuX3Jlc291cmNlU3RhdGVzTWFwLmdldChoYW5kbGUpO1xuXHR9XG5cblx0JGV4ZWN1dGVSZXNvdXJjZUNvbW1hbmQoaGFuZGxlOiBudW1iZXIsIHByZXNlcnZlRm9jdXM6IGJvb2xlYW4pOiBQcm9taXNlPHZvaWQ+IHtcblx0XHRjb25zdCBjb21tYW5kID0gdGhpcy5fcmVzb3VyY2VTdGF0ZXNDb21tYW5kc01hcC5nZXQoaGFuZGxlKTtcblxuXHRcdGlmICghY29tbWFuZCkge1xuXHRcdFx0cmV0dXJuIFByb21pc2UucmVzb2x2ZSh1bmRlZmluZWQpO1xuXHRcdH1cblxuXHRcdHJldHVybiBhc1Byb21pc2UoKCkgPT4gdGhpcy5fY29tbWFuZHMuZXhlY3V0ZUNvbW1hbmQoY29tbWFuZC5jb21tYW5kLCAuLi4oY29tbWFuZC5hcmd1bWVudHMgfHwgW10pLCBwcmVzZXJ2ZUZvY3VzKSk7XG5cdH1cblxuXHRfdGFrZVJlc291cmNlU3RhdGVTbmFwc2hvdCgpOiBTQ01SYXdSZXNvdXJjZVNwbGljZVtdIHtcblx0XHRjb25zdCBzbmFwc2hvdCA9IFsuLi50aGlzLl9yZXNvdXJjZVN0YXRlc10uc29ydChjb21wYXJlUmVzb3VyY2VTdGF0ZXMpO1xuXHRcdGNvbnN0IGRpZmZzID0gc29ydGVkRGlmZih0aGlzLl9yZXNvdXJjZVNuYXBzaG90LCBzbmFwc2hvdCwgY29tcGFyZVJlc291cmNlU3RhdGVzKTtcblxuXHRcdGNvbnN0IHNwbGljZXMgPSBkaWZmcy5tYXA8SVNwbGljZTx7IHJhd1Jlc291cmNlOiBTQ01SYXdSZXNvdXJjZTsgaGFuZGxlOiBudW1iZXIgfT4+KGRpZmYgPT4ge1xuXHRcdFx0Y29uc3QgdG9JbnNlcnQgPSBkaWZmLnRvSW5zZXJ0Lm1hcChyID0+IHtcblx0XHRcdFx0Y29uc3QgaGFuZGxlID0gdGhpcy5fcmVzb3VyY2VIYW5kbGVQb29sKys7XG5cdFx0XHRcdHRoaXMuX3Jlc291cmNlU3RhdGVzTWFwLnNldChoYW5kbGUsIHIpO1xuXG5cdFx0XHRcdGNvbnN0IHNvdXJjZVVyaSA9IHIucmVzb3VyY2VVcmk7XG5cblx0XHRcdFx0bGV0IGNvbW1hbmQ6IElDb21tYW5kRHRvIHwgdW5kZWZpbmVkO1xuXHRcdFx0XHRpZiAoci5jb21tYW5kKSB7XG5cdFx0XHRcdFx0aWYgKHIuY29tbWFuZC5jb21tYW5kID09PSAndnNjb2RlLm9wZW4nIHx8IHIuY29tbWFuZC5jb21tYW5kID09PSAndnNjb2RlLmRpZmYnIHx8IHIuY29tbWFuZC5jb21tYW5kID09PSAndnNjb2RlLmNoYW5nZXMnKSB7XG5cdFx0XHRcdFx0XHRjb25zdCBkaXNwb3NhYmxlcyA9IG5ldyBEaXNwb3NhYmxlU3RvcmUoKTtcblx0XHRcdFx0XHRcdGNvbW1hbmQgPSB0aGlzLl9jb21tYW5kcy5jb252ZXJ0ZXIudG9JbnRlcm5hbChyLmNvbW1hbmQsIGRpc3Bvc2FibGVzKTtcblx0XHRcdFx0XHRcdHRoaXMuX3Jlc291cmNlU3RhdGVzRGlzcG9zYWJsZXNNYXAuc2V0KGhhbmRsZSwgZGlzcG9zYWJsZXMpO1xuXHRcdFx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdFx0XHR0aGlzLl9yZXNvdXJjZVN0YXRlc0NvbW1hbmRzTWFwLnNldChoYW5kbGUsIHIuY29tbWFuZCk7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9XG5cblx0XHRcdFx0Y29uc3QgaGFzU2NtTXVsdGlEaWZmRWRpdG9yUHJvcG9zYWxFbmFibGVkID0gaXNQcm9wb3NlZEFwaUVuYWJsZWQodGhpcy5fZXh0ZW5zaW9uLCAnc2NtTXVsdGlEaWZmRWRpdG9yJyk7XG5cdFx0XHRcdGNvbnN0IG11bHRpRmlsZURpZmZFZGl0b3JPcmlnaW5hbFVyaSA9IGhhc1NjbU11bHRpRGlmZkVkaXRvclByb3Bvc2FsRW5hYmxlZCA/IHIubXVsdGlEaWZmRWRpdG9yT3JpZ2luYWxVcmkgOiB1bmRlZmluZWQ7XG5cdFx0XHRcdGNvbnN0IG11bHRpRmlsZURpZmZFZGl0b3JNb2RpZmllZFVyaSA9IGhhc1NjbU11bHRpRGlmZkVkaXRvclByb3Bvc2FsRW5hYmxlZCA/IHIubXVsdGlGaWxlRGlmZkVkaXRvck1vZGlmaWVkVXJpIDogdW5kZWZpbmVkO1xuXG5cdFx0XHRcdGNvbnN0IGljb24gPSBnZXRJY29uUmVzb3VyY2Uoci5kZWNvcmF0aW9ucyk7XG5cdFx0XHRcdGNvbnN0IGxpZ2h0SWNvbiA9IHIuZGVjb3JhdGlvbnMgJiYgZ2V0SWNvblJlc291cmNlKHIuZGVjb3JhdGlvbnMubGlnaHQpIHx8IGljb247XG5cdFx0XHRcdGNvbnN0IGRhcmtJY29uID0gci5kZWNvcmF0aW9ucyAmJiBnZXRJY29uUmVzb3VyY2Uoci5kZWNvcmF0aW9ucy5kYXJrKSB8fCBpY29uO1xuXHRcdFx0XHRjb25zdCBpY29uczogU0NNUmF3UmVzb3VyY2VbMl0gPSBbbGlnaHRJY29uLCBkYXJrSWNvbl07XG5cblx0XHRcdFx0Y29uc3QgdG9vbHRpcCA9IChyLmRlY29yYXRpb25zICYmIHIuZGVjb3JhdGlvbnMudG9vbHRpcCkgfHwgJyc7XG5cdFx0XHRcdGNvbnN0IHN0cmlrZVRocm91Z2ggPSByLmRlY29yYXRpb25zICYmICEhci5kZWNvcmF0aW9ucy5zdHJpa2VUaHJvdWdoO1xuXHRcdFx0XHRjb25zdCBmYWRlZCA9IHIuZGVjb3JhdGlvbnMgJiYgISFyLmRlY29yYXRpb25zLmZhZGVkO1xuXHRcdFx0XHRjb25zdCBjb250ZXh0VmFsdWUgPSByLmNvbnRleHRWYWx1ZSB8fCAnJztcblxuXHRcdFx0XHRjb25zdCByYXdSZXNvdXJjZSA9IFtoYW5kbGUsIHNvdXJjZVVyaSwgaWNvbnMsIHRvb2x0aXAsIHN0cmlrZVRocm91Z2gsIGZhZGVkLCBjb250ZXh0VmFsdWUsIGNvbW1hbmQsIG11bHRpRmlsZURpZmZFZGl0b3JPcmlnaW5hbFVyaSwgbXVsdGlGaWxlRGlmZkVkaXRvck1vZGlmaWVkVXJpXSBhcyBTQ01SYXdSZXNvdXJjZTtcblxuXHRcdFx0XHRyZXR1cm4geyByYXdSZXNvdXJjZSwgaGFuZGxlIH07XG5cdFx0XHR9KTtcblxuXHRcdFx0cmV0dXJuIHsgc3RhcnQ6IGRpZmYuc3RhcnQsIGRlbGV0ZUNvdW50OiBkaWZmLmRlbGV0ZUNvdW50LCB0b0luc2VydCB9O1xuXHRcdH0pO1xuXG5cdFx0Y29uc3QgcmF3UmVzb3VyY2VTcGxpY2VzID0gc3BsaWNlc1xuXHRcdFx0Lm1hcCgoeyBzdGFydCwgZGVsZXRlQ291bnQsIHRvSW5zZXJ0IH0pID0+IFtzdGFydCwgZGVsZXRlQ291bnQsIHRvSW5zZXJ0Lm1hcChpID0+IGkucmF3UmVzb3VyY2UpXSBhcyBTQ01SYXdSZXNvdXJjZVNwbGljZSk7XG5cblx0XHRjb25zdCByZXZlcnNlU3BsaWNlcyA9IHNwbGljZXMucmV2ZXJzZSgpO1xuXG5cdFx0Zm9yIChjb25zdCB7IHN0YXJ0LCBkZWxldGVDb3VudCwgdG9JbnNlcnQgfSBvZiByZXZlcnNlU3BsaWNlcykge1xuXHRcdFx0Y29uc3QgaGFuZGxlcyA9IHRvSW5zZXJ0Lm1hcChpID0+IGkuaGFuZGxlKTtcblx0XHRcdGNvbnN0IGhhbmRsZXNUb0RlbGV0ZSA9IHRoaXMuX2hhbmRsZXNTbmFwc2hvdC5zcGxpY2Uoc3RhcnQsIGRlbGV0ZUNvdW50LCAuLi5oYW5kbGVzKTtcblxuXHRcdFx0Zm9yIChjb25zdCBoYW5kbGUgb2YgaGFuZGxlc1RvRGVsZXRlKSB7XG5cdFx0XHRcdHRoaXMuX3Jlc291cmNlU3RhdGVzTWFwLmRlbGV0ZShoYW5kbGUpO1xuXHRcdFx0XHR0aGlzLl9yZXNvdXJjZVN0YXRlc0NvbW1hbmRzTWFwLmRlbGV0ZShoYW5kbGUpO1xuXHRcdFx0XHR0aGlzLl9yZXNvdXJjZVN0YXRlc0Rpc3Bvc2FibGVzTWFwLmdldChoYW5kbGUpPy5kaXNwb3NlKCk7XG5cdFx0XHRcdHRoaXMuX3Jlc291cmNlU3RhdGVzRGlzcG9zYWJsZXNNYXAuZGVsZXRlKGhhbmRsZSk7XG5cdFx0XHR9XG5cdFx0fVxuXG5cdFx0dGhpcy5fcmVzb3VyY2VTbmFwc2hvdCA9IHNuYXBzaG90O1xuXHRcdHJldHVybiByYXdSZXNvdXJjZVNwbGljZXM7XG5cdH1cblxuXHRkaXNwb3NlKCk6IHZvaWQge1xuXHRcdHRoaXMuX2Rpc3Bvc2VkID0gdHJ1ZTtcblx0XHR0aGlzLl9vbkRpZERpc3Bvc2UuZmlyZSgpO1xuXHR9XG59XG5cbmNsYXNzIEV4dEhvc3RTb3VyY2VDb250cm9sIGltcGxlbWVudHMgdnNjb2RlLlNvdXJjZUNvbnRyb2wge1xuXG5cdHByaXZhdGUgc3RhdGljIF9oYW5kbGVQb29sOiBudW1iZXIgPSAwO1xuXG5cdCNwcm94eTogTWFpblRocmVhZFNDTVNoYXBlO1xuXG5cdHByaXZhdGUgX2dyb3VwczogTWFwPEdyb3VwSGFuZGxlLCBFeHRIb3N0U291cmNlQ29udHJvbFJlc291cmNlR3JvdXA+ID0gbmV3IE1hcDxHcm91cEhhbmRsZSwgRXh0SG9zdFNvdXJjZUNvbnRyb2xSZXNvdXJjZUdyb3VwPigpO1xuXG5cdGdldCBpZCgpOiBzdHJpbmcge1xuXHRcdHJldHVybiB0aGlzLl9pZDtcblx0fVxuXG5cdGdldCBsYWJlbCgpOiBzdHJpbmcge1xuXHRcdHJldHVybiB0aGlzLl9sYWJlbDtcblx0fVxuXG5cdGdldCByb290VXJpKCk6IHZzY29kZS5VcmkgfCB1bmRlZmluZWQge1xuXHRcdHJldHVybiB0aGlzLl9yb290VXJpO1xuXHR9XG5cblx0cHJpdmF0ZSBfaW5wdXRCb3g6IEV4dEhvc3RTQ01JbnB1dEJveDtcblx0Z2V0IGlucHV0Qm94KCk6IEV4dEhvc3RTQ01JbnB1dEJveCB7IHJldHVybiB0aGlzLl9pbnB1dEJveDsgfVxuXG5cdHByaXZhdGUgX2NvdW50OiBudW1iZXIgfCB1bmRlZmluZWQgPSB1bmRlZmluZWQ7XG5cblx0Z2V0IGNvdW50KCk6IG51bWJlciB8IHVuZGVmaW5lZCB7XG5cdFx0cmV0dXJuIHRoaXMuX2NvdW50O1xuXHR9XG5cblx0c2V0IGNvdW50KGNvdW50OiBudW1iZXIgfCB1bmRlZmluZWQpIHtcblx0XHRpZiAodGhpcy5fY291bnQgPT09IGNvdW50KSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXG5cdFx0dGhpcy5fY291bnQgPSBjb3VudDtcblx0XHR0aGlzLiNwcm94eS4kdXBkYXRlU291cmNlQ29udHJvbCh0aGlzLmhhbmRsZSwgeyBjb3VudCB9KTtcblx0fVxuXG5cdHByaXZhdGUgX3F1aWNrRGlmZlByb3ZpZGVyOiB2c2NvZGUuUXVpY2tEaWZmUHJvdmlkZXIgfCB1bmRlZmluZWQgPSB1bmRlZmluZWQ7XG5cblx0Z2V0IHF1aWNrRGlmZlByb3ZpZGVyKCk6IHZzY29kZS5RdWlja0RpZmZQcm92aWRlciB8IHVuZGVmaW5lZCB7XG5cdFx0cmV0dXJuIHRoaXMuX3F1aWNrRGlmZlByb3ZpZGVyO1xuXHR9XG5cblx0c2V0IHF1aWNrRGlmZlByb3ZpZGVyKHF1aWNrRGlmZlByb3ZpZGVyOiB2c2NvZGUuUXVpY2tEaWZmUHJvdmlkZXIgfCB1bmRlZmluZWQpIHtcblx0XHR0aGlzLl9xdWlja0RpZmZQcm92aWRlciA9IHF1aWNrRGlmZlByb3ZpZGVyO1xuXHRcdGxldCBxdWlja0RpZmZMYWJlbCA9IHVuZGVmaW5lZDtcblx0XHRpZiAoaXNQcm9wb3NlZEFwaUVuYWJsZWQodGhpcy5fZXh0ZW5zaW9uLCAncXVpY2tEaWZmUHJvdmlkZXInKSkge1xuXHRcdFx0cXVpY2tEaWZmTGFiZWwgPSBxdWlja0RpZmZQcm92aWRlcj8ubGFiZWw7XG5cdFx0fVxuXHRcdHRoaXMuI3Byb3h5LiR1cGRhdGVTb3VyY2VDb250cm9sKHRoaXMuaGFuZGxlLCB7IGhhc1F1aWNrRGlmZlByb3ZpZGVyOiAhIXF1aWNrRGlmZlByb3ZpZGVyLCBxdWlja0RpZmZMYWJlbCB9KTtcblx0fVxuXG5cdHByaXZhdGUgX2hpc3RvcnlQcm92aWRlcjogdnNjb2RlLlNvdXJjZUNvbnRyb2xIaXN0b3J5UHJvdmlkZXIgfCB1bmRlZmluZWQ7XG5cdHByaXZhdGUgcmVhZG9ubHkgX2hpc3RvcnlQcm92aWRlckRpc3Bvc2FibGUgPSBuZXcgTXV0YWJsZURpc3Bvc2FibGU8RGlzcG9zYWJsZVN0b3JlPigpO1xuXG5cdGdldCBoaXN0b3J5UHJvdmlkZXIoKTogdnNjb2RlLlNvdXJjZUNvbnRyb2xIaXN0b3J5UHJvdmlkZXIgfCB1bmRlZmluZWQge1xuXHRcdGNoZWNrUHJvcG9zZWRBcGlFbmFibGVkKHRoaXMuX2V4dGVuc2lvbiwgJ3NjbUhpc3RvcnlQcm92aWRlcicpO1xuXHRcdHJldHVybiB0aGlzLl9oaXN0b3J5UHJvdmlkZXI7XG5cdH1cblxuXHRzZXQgaGlzdG9yeVByb3ZpZGVyKGhpc3RvcnlQcm92aWRlcjogdnNjb2RlLlNvdXJjZUNvbnRyb2xIaXN0b3J5UHJvdmlkZXIgfCB1bmRlZmluZWQpIHtcblx0XHRjaGVja1Byb3Bvc2VkQXBpRW5hYmxlZCh0aGlzLl9leHRlbnNpb24sICdzY21IaXN0b3J5UHJvdmlkZXInKTtcblxuXHRcdHRoaXMuX2hpc3RvcnlQcm92aWRlciA9IGhpc3RvcnlQcm92aWRlcjtcblx0XHR0aGlzLl9oaXN0b3J5UHJvdmlkZXJEaXNwb3NhYmxlLnZhbHVlID0gbmV3IERpc3Bvc2FibGVTdG9yZSgpO1xuXG5cdFx0dGhpcy4jcHJveHkuJHVwZGF0ZVNvdXJjZUNvbnRyb2wodGhpcy5oYW5kbGUsIHsgaGFzSGlzdG9yeVByb3ZpZGVyOiAhIWhpc3RvcnlQcm92aWRlciB9KTtcblxuXHRcdGlmIChoaXN0b3J5UHJvdmlkZXIpIHtcblx0XHRcdHRoaXMuX2hpc3RvcnlQcm92aWRlckRpc3Bvc2FibGUudmFsdWUuYWRkKGhpc3RvcnlQcm92aWRlci5vbkRpZENoYW5nZUN1cnJlbnRIaXN0b3J5SXRlbVJlZnMoKCkgPT4ge1xuXHRcdFx0XHRjb25zdCBoaXN0b3J5SXRlbVJlZiA9IHRvU0NNSGlzdG9yeUl0ZW1SZWZEdG8oaGlzdG9yeVByb3ZpZGVyPy5jdXJyZW50SGlzdG9yeUl0ZW1SZWYpO1xuXHRcdFx0XHRjb25zdCBoaXN0b3J5SXRlbVJlbW90ZVJlZiA9IHRvU0NNSGlzdG9yeUl0ZW1SZWZEdG8oaGlzdG9yeVByb3ZpZGVyPy5jdXJyZW50SGlzdG9yeUl0ZW1SZW1vdGVSZWYpO1xuXHRcdFx0XHRjb25zdCBoaXN0b3J5SXRlbUJhc2VSZWYgPSB0b1NDTUhpc3RvcnlJdGVtUmVmRHRvKGhpc3RvcnlQcm92aWRlcj8uY3VycmVudEhpc3RvcnlJdGVtQmFzZVJlZik7XG5cblx0XHRcdFx0dGhpcy4jcHJveHkuJG9uRGlkQ2hhbmdlSGlzdG9yeVByb3ZpZGVyQ3VycmVudEhpc3RvcnlJdGVtUmVmcyh0aGlzLmhhbmRsZSwgaGlzdG9yeUl0ZW1SZWYsIGhpc3RvcnlJdGVtUmVtb3RlUmVmLCBoaXN0b3J5SXRlbUJhc2VSZWYpO1xuXHRcdFx0fSkpO1xuXHRcdFx0dGhpcy5faGlzdG9yeVByb3ZpZGVyRGlzcG9zYWJsZS52YWx1ZS5hZGQoaGlzdG9yeVByb3ZpZGVyLm9uRGlkQ2hhbmdlSGlzdG9yeUl0ZW1SZWZzKChlKSA9PiB7XG5cdFx0XHRcdGlmIChlLmFkZGVkLmxlbmd0aCA9PT0gMCAmJiBlLm1vZGlmaWVkLmxlbmd0aCA9PT0gMCAmJiBlLnJlbW92ZWQubGVuZ3RoID09PSAwKSB7XG5cdFx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0XHR9XG5cblx0XHRcdFx0Y29uc3QgYWRkZWQgPSBlLmFkZGVkLm1hcChyZWYgPT4gKHsgLi4ucmVmLCBpY29uOiBnZXRIaXN0b3J5SXRlbUljb25EdG8ocmVmLmljb24pIH0pKTtcblx0XHRcdFx0Y29uc3QgbW9kaWZpZWQgPSBlLm1vZGlmaWVkLm1hcChyZWYgPT4gKHsgLi4ucmVmLCBpY29uOiBnZXRIaXN0b3J5SXRlbUljb25EdG8ocmVmLmljb24pIH0pKTtcblx0XHRcdFx0Y29uc3QgcmVtb3ZlZCA9IGUucmVtb3ZlZC5tYXAocmVmID0+ICh7IC4uLnJlZiwgaWNvbjogZ2V0SGlzdG9yeUl0ZW1JY29uRHRvKHJlZi5pY29uKSB9KSk7XG5cblx0XHRcdFx0dGhpcy4jcHJveHkuJG9uRGlkQ2hhbmdlSGlzdG9yeVByb3ZpZGVySGlzdG9yeUl0ZW1SZWZzKHRoaXMuaGFuZGxlLCB7IGFkZGVkLCBtb2RpZmllZCwgcmVtb3ZlZCwgc2lsZW50OiBlLnNpbGVudCB9KTtcblx0XHRcdH0pKTtcblx0XHR9XG5cdH1cblxuXHRwcml2YXRlIF9jb21taXRUZW1wbGF0ZTogc3RyaW5nIHwgdW5kZWZpbmVkID0gdW5kZWZpbmVkO1xuXG5cdGdldCBjb21taXRUZW1wbGF0ZSgpOiBzdHJpbmcgfCB1bmRlZmluZWQge1xuXHRcdHJldHVybiB0aGlzLl9jb21taXRUZW1wbGF0ZTtcblx0fVxuXG5cdHNldCBjb21taXRUZW1wbGF0ZShjb21taXRUZW1wbGF0ZTogc3RyaW5nIHwgdW5kZWZpbmVkKSB7XG5cdFx0aWYgKGNvbW1pdFRlbXBsYXRlID09PSB0aGlzLl9jb21taXRUZW1wbGF0ZSkge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblxuXHRcdHRoaXMuX2NvbW1pdFRlbXBsYXRlID0gY29tbWl0VGVtcGxhdGU7XG5cdFx0dGhpcy4jcHJveHkuJHVwZGF0ZVNvdXJjZUNvbnRyb2wodGhpcy5oYW5kbGUsIHsgY29tbWl0VGVtcGxhdGUgfSk7XG5cdH1cblxuXHRwcml2YXRlIHJlYWRvbmx5IF9hY2NlcHRJbnB1dERpc3Bvc2FibGVzID0gbmV3IE11dGFibGVEaXNwb3NhYmxlPERpc3Bvc2FibGVTdG9yZT4oKTtcblx0cHJpdmF0ZSBfYWNjZXB0SW5wdXRDb21tYW5kOiB2c2NvZGUuQ29tbWFuZCB8IHVuZGVmaW5lZCA9IHVuZGVmaW5lZDtcblxuXHRnZXQgYWNjZXB0SW5wdXRDb21tYW5kKCk6IHZzY29kZS5Db21tYW5kIHwgdW5kZWZpbmVkIHtcblx0XHRyZXR1cm4gdGhpcy5fYWNjZXB0SW5wdXRDb21tYW5kO1xuXHR9XG5cblx0c2V0IGFjY2VwdElucHV0Q29tbWFuZChhY2NlcHRJbnB1dENvbW1hbmQ6IHZzY29kZS5Db21tYW5kIHwgdW5kZWZpbmVkKSB7XG5cdFx0dGhpcy5fYWNjZXB0SW5wdXREaXNwb3NhYmxlcy52YWx1ZSA9IG5ldyBEaXNwb3NhYmxlU3RvcmUoKTtcblxuXHRcdHRoaXMuX2FjY2VwdElucHV0Q29tbWFuZCA9IGFjY2VwdElucHV0Q29tbWFuZDtcblxuXHRcdGNvbnN0IGludGVybmFsID0gdGhpcy5fY29tbWFuZHMuY29udmVydGVyLnRvSW50ZXJuYWwoYWNjZXB0SW5wdXRDb21tYW5kLCB0aGlzLl9hY2NlcHRJbnB1dERpc3Bvc2FibGVzLnZhbHVlKTtcblx0XHR0aGlzLiNwcm94eS4kdXBkYXRlU291cmNlQ29udHJvbCh0aGlzLmhhbmRsZSwgeyBhY2NlcHRJbnB1dENvbW1hbmQ6IGludGVybmFsIH0pO1xuXHR9XG5cblx0cHJpdmF0ZSByZWFkb25seSBfYWN0aW9uQnV0dG9uRGlzcG9zYWJsZXMgPSBuZXcgTXV0YWJsZURpc3Bvc2FibGU8RGlzcG9zYWJsZVN0b3JlPigpO1xuXHRwcml2YXRlIF9hY3Rpb25CdXR0b246IHZzY29kZS5Tb3VyY2VDb250cm9sQWN0aW9uQnV0dG9uIHwgdW5kZWZpbmVkO1xuXHRnZXQgYWN0aW9uQnV0dG9uKCk6IHZzY29kZS5Tb3VyY2VDb250cm9sQWN0aW9uQnV0dG9uIHwgdW5kZWZpbmVkIHtcblx0XHRjaGVja1Byb3Bvc2VkQXBpRW5hYmxlZCh0aGlzLl9leHRlbnNpb24sICdzY21BY3Rpb25CdXR0b24nKTtcblx0XHRyZXR1cm4gdGhpcy5fYWN0aW9uQnV0dG9uO1xuXHR9XG5cblx0c2V0IGFjdGlvbkJ1dHRvbihhY3Rpb25CdXR0b246IHZzY29kZS5Tb3VyY2VDb250cm9sQWN0aW9uQnV0dG9uIHwgdW5kZWZpbmVkKSB7XG5cdFx0Y2hlY2tQcm9wb3NlZEFwaUVuYWJsZWQodGhpcy5fZXh0ZW5zaW9uLCAnc2NtQWN0aW9uQnV0dG9uJyk7XG5cblx0XHQvLyBXZSBoYXZlIHRvIGRvIHRoaXMgY2hlY2sgYmVmb3JlIGNvbnZlcnRpbmcgdGhlIGNvbW1hbmQgdG8gaXQncyBpbnRlcm5hbFxuXHRcdC8vIHJlcHJlc2VudGF0aW9uIHNpbmNlIHRoYXQgd291bGQgYWx3YXlzIGNyZWF0ZSBhIGNvbW1hbmQgd2l0aCBhIHVuaXF1ZVxuXHRcdC8vIGlkZW50aWZpZXJcblx0XHRpZiAoc3RydWN0dXJhbEVxdWFscyh0aGlzLl9hY3Rpb25CdXR0b24sIGFjdGlvbkJ1dHRvbikpIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cblx0XHR0aGlzLl9hY3Rpb25CdXR0b24gPSBhY3Rpb25CdXR0b247XG5cdFx0dGhpcy5fYWN0aW9uQnV0dG9uRGlzcG9zYWJsZXMudmFsdWUgPSBuZXcgRGlzcG9zYWJsZVN0b3JlKCk7XG5cblx0XHRjb25zdCBhY3Rpb25CdXR0b25EdG8gPSBhY3Rpb25CdXR0b24gIT09IHVuZGVmaW5lZCA/XG5cdFx0XHR7XG5cdFx0XHRcdGNvbW1hbmQ6IHtcblx0XHRcdFx0XHQuLi50aGlzLl9jb21tYW5kcy5jb252ZXJ0ZXIudG9JbnRlcm5hbChhY3Rpb25CdXR0b24uY29tbWFuZCwgdGhpcy5fYWN0aW9uQnV0dG9uRGlzcG9zYWJsZXMudmFsdWUpLFxuXHRcdFx0XHRcdHNob3J0VGl0bGU6IGFjdGlvbkJ1dHRvbi5jb21tYW5kLnNob3J0VGl0bGVcblx0XHRcdFx0fSxcblx0XHRcdFx0c2Vjb25kYXJ5Q29tbWFuZHM6IGFjdGlvbkJ1dHRvbi5zZWNvbmRhcnlDb21tYW5kcz8ubWFwKGNvbW1hbmRHcm91cCA9PiB7XG5cdFx0XHRcdFx0cmV0dXJuIGNvbW1hbmRHcm91cC5tYXAoY29tbWFuZCA9PiB0aGlzLl9jb21tYW5kcy5jb252ZXJ0ZXIudG9JbnRlcm5hbChjb21tYW5kLCB0aGlzLl9hY3Rpb25CdXR0b25EaXNwb3NhYmxlcy52YWx1ZSEpKTtcblx0XHRcdFx0fSksXG5cdFx0XHRcdGVuYWJsZWQ6IGFjdGlvbkJ1dHRvbi5lbmFibGVkXG5cdFx0XHR9IHNhdGlzZmllcyBTQ01BY3Rpb25CdXR0b25EdG8gOiB1bmRlZmluZWQ7XG5cblx0XHR0aGlzLiNwcm94eS4kdXBkYXRlU291cmNlQ29udHJvbCh0aGlzLmhhbmRsZSwgeyBhY3Rpb25CdXR0b246IGFjdGlvbkJ1dHRvbkR0byA/PyBudWxsIH0pO1xuXHR9XG5cblxuXHRwcml2YXRlIHJlYWRvbmx5IF9zdGF0dXNCYXJEaXNwb3NhYmxlcyA9IG5ldyBNdXRhYmxlRGlzcG9zYWJsZTxEaXNwb3NhYmxlU3RvcmU+KCk7XG5cdHByaXZhdGUgX3N0YXR1c0JhckNvbW1hbmRzOiB2c2NvZGUuQ29tbWFuZFtdIHwgdW5kZWZpbmVkID0gdW5kZWZpbmVkO1xuXG5cdGdldCBzdGF0dXNCYXJDb21tYW5kcygpOiB2c2NvZGUuQ29tbWFuZFtdIHwgdW5kZWZpbmVkIHtcblx0XHRyZXR1cm4gdGhpcy5fc3RhdHVzQmFyQ29tbWFuZHM7XG5cdH1cblxuXHRzZXQgc3RhdHVzQmFyQ29tbWFuZHMoc3RhdHVzQmFyQ29tbWFuZHM6IHZzY29kZS5Db21tYW5kW10gfCB1bmRlZmluZWQpIHtcblx0XHRpZiAodGhpcy5fc3RhdHVzQmFyQ29tbWFuZHMgJiYgc3RhdHVzQmFyQ29tbWFuZHMgJiYgY29tbWFuZExpc3RFcXVhbHModGhpcy5fc3RhdHVzQmFyQ29tbWFuZHMsIHN0YXR1c0JhckNvbW1hbmRzKSkge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblxuXHRcdHRoaXMuX3N0YXR1c0JhckRpc3Bvc2FibGVzLnZhbHVlID0gbmV3IERpc3Bvc2FibGVTdG9yZSgpO1xuXG5cdFx0dGhpcy5fc3RhdHVzQmFyQ29tbWFuZHMgPSBzdGF0dXNCYXJDb21tYW5kcztcblxuXHRcdGNvbnN0IGludGVybmFsID0gKHN0YXR1c0JhckNvbW1hbmRzIHx8IFtdKS5tYXAoYyA9PiB0aGlzLl9jb21tYW5kcy5jb252ZXJ0ZXIudG9JbnRlcm5hbChjLCB0aGlzLl9zdGF0dXNCYXJEaXNwb3NhYmxlcy52YWx1ZSEpKSBhcyBJQ29tbWFuZER0b1tdO1xuXHRcdHRoaXMuI3Byb3h5LiR1cGRhdGVTb3VyY2VDb250cm9sKHRoaXMuaGFuZGxlLCB7IHN0YXR1c0JhckNvbW1hbmRzOiBpbnRlcm5hbCB9KTtcblx0fVxuXG5cdHByaXZhdGUgX3NlbGVjdGVkOiBib29sZWFuID0gZmFsc2U7XG5cblx0Z2V0IHNlbGVjdGVkKCk6IGJvb2xlYW4ge1xuXHRcdHJldHVybiB0aGlzLl9zZWxlY3RlZDtcblx0fVxuXG5cdHByaXZhdGUgcmVhZG9ubHkgX29uRGlkQ2hhbmdlU2VsZWN0aW9uID0gbmV3IEVtaXR0ZXI8Ym9vbGVhbj4oKTtcblx0cmVhZG9ubHkgb25EaWRDaGFuZ2VTZWxlY3Rpb24gPSB0aGlzLl9vbkRpZENoYW5nZVNlbGVjdGlvbi5ldmVudDtcblxuXHRwcml2YXRlIGhhbmRsZTogbnVtYmVyID0gRXh0SG9zdFNvdXJjZUNvbnRyb2wuX2hhbmRsZVBvb2wrKztcblxuXHRjb25zdHJ1Y3Rvcihcblx0XHRwcml2YXRlIHJlYWRvbmx5IF9leHRlbnNpb246IElFeHRlbnNpb25EZXNjcmlwdGlvbixcblx0XHRfZXh0SG9zdERvY3VtZW50czogRXh0SG9zdERvY3VtZW50cyxcblx0XHRwcm94eTogTWFpblRocmVhZFNDTVNoYXBlLFxuXHRcdHByaXZhdGUgX2NvbW1hbmRzOiBFeHRIb3N0Q29tbWFuZHMsXG5cdFx0cHJpdmF0ZSBfaWQ6IHN0cmluZyxcblx0XHRwcml2YXRlIF9sYWJlbDogc3RyaW5nLFxuXHRcdHByaXZhdGUgX3Jvb3RVcmk/OiB2c2NvZGUuVXJpXG5cdCkge1xuXHRcdHRoaXMuI3Byb3h5ID0gcHJveHk7XG5cblx0XHRjb25zdCBpbnB1dEJveERvY3VtZW50VXJpID0gVVJJLmZyb20oe1xuXHRcdFx0c2NoZW1lOiBTY2hlbWFzLnZzY29kZVNvdXJjZUNvbnRyb2wsXG5cdFx0XHRwYXRoOiBgJHtfaWR9L3NjbSR7dGhpcy5oYW5kbGV9L2lucHV0YCxcblx0XHRcdHF1ZXJ5OiBfcm9vdFVyaSA/IGByb290VXJpPSR7ZW5jb2RlVVJJQ29tcG9uZW50KF9yb290VXJpLnRvU3RyaW5nKCkpfWAgOiB1bmRlZmluZWRcblx0XHR9KTtcblxuXHRcdHRoaXMuX2lucHV0Qm94ID0gbmV3IEV4dEhvc3RTQ01JbnB1dEJveChfZXh0ZW5zaW9uLCBfZXh0SG9zdERvY3VtZW50cywgdGhpcy4jcHJveHksIHRoaXMuaGFuZGxlLCBpbnB1dEJveERvY3VtZW50VXJpKTtcblx0XHR0aGlzLiNwcm94eS4kcmVnaXN0ZXJTb3VyY2VDb250cm9sKHRoaXMuaGFuZGxlLCBfaWQsIF9sYWJlbCwgX3Jvb3RVcmksIGlucHV0Qm94RG9jdW1lbnRVcmkpO1xuXHR9XG5cblx0cHJpdmF0ZSBjcmVhdGVkUmVzb3VyY2VHcm91cHMgPSBuZXcgTWFwPEV4dEhvc3RTb3VyY2VDb250cm9sUmVzb3VyY2VHcm91cCwgSURpc3Bvc2FibGU+KCk7XG5cdHByaXZhdGUgdXBkYXRlZFJlc291cmNlR3JvdXBzID0gbmV3IFNldDxFeHRIb3N0U291cmNlQ29udHJvbFJlc291cmNlR3JvdXA+KCk7XG5cblx0Y3JlYXRlUmVzb3VyY2VHcm91cChpZDogc3RyaW5nLCBsYWJlbDogc3RyaW5nLCBvcHRpb25zPzogeyBtdWx0aURpZmZFZGl0b3JFbmFibGVWaWV3Q2hhbmdlcz86IGJvb2xlYW4gfSk6IEV4dEhvc3RTb3VyY2VDb250cm9sUmVzb3VyY2VHcm91cCB7XG5cdFx0Y29uc3QgbXVsdGlEaWZmRWRpdG9yRW5hYmxlVmlld0NoYW5nZXMgPSBpc1Byb3Bvc2VkQXBpRW5hYmxlZCh0aGlzLl9leHRlbnNpb24sICdzY21NdWx0aURpZmZFZGl0b3InKSAmJiBvcHRpb25zPy5tdWx0aURpZmZFZGl0b3JFbmFibGVWaWV3Q2hhbmdlcyA9PT0gdHJ1ZTtcblx0XHRjb25zdCBncm91cCA9IG5ldyBFeHRIb3N0U291cmNlQ29udHJvbFJlc291cmNlR3JvdXAodGhpcy4jcHJveHksIHRoaXMuX2NvbW1hbmRzLCB0aGlzLmhhbmRsZSwgaWQsIGxhYmVsLCBtdWx0aURpZmZFZGl0b3JFbmFibGVWaWV3Q2hhbmdlcywgdGhpcy5fZXh0ZW5zaW9uKTtcblx0XHRjb25zdCBkaXNwb3NhYmxlID0gRXZlbnQub25jZShncm91cC5vbkRpZERpc3Bvc2UpKCgpID0+IHRoaXMuY3JlYXRlZFJlc291cmNlR3JvdXBzLmRlbGV0ZShncm91cCkpO1xuXHRcdHRoaXMuY3JlYXRlZFJlc291cmNlR3JvdXBzLnNldChncm91cCwgZGlzcG9zYWJsZSk7XG5cdFx0dGhpcy5ldmVudHVhbGx5QWRkUmVzb3VyY2VHcm91cHMoKTtcblx0XHRyZXR1cm4gZ3JvdXA7XG5cdH1cblxuXHRAZGVib3VuY2UoMTAwKVxuXHRldmVudHVhbGx5QWRkUmVzb3VyY2VHcm91cHMoKTogdm9pZCB7XG5cdFx0Y29uc3QgZ3JvdXBzOiBbbnVtYmVyIC8qaGFuZGxlKi8sIHN0cmluZyAvKmlkKi8sIHN0cmluZyAvKmxhYmVsKi8sIFNDTUdyb3VwRmVhdHVyZXMsIC8qbXVsdGlEaWZmRWRpdG9yRW5hYmxlVmlld0NoYW5nZXMqLyBib29sZWFuXVtdID0gW107XG5cdFx0Y29uc3Qgc3BsaWNlczogU0NNUmF3UmVzb3VyY2VTcGxpY2VzW10gPSBbXTtcblxuXHRcdGZvciAoY29uc3QgW2dyb3VwLCBkaXNwb3NhYmxlXSBvZiB0aGlzLmNyZWF0ZWRSZXNvdXJjZUdyb3Vwcykge1xuXHRcdFx0ZGlzcG9zYWJsZS5kaXNwb3NlKCk7XG5cblx0XHRcdGNvbnN0IHVwZGF0ZUxpc3RlbmVyID0gZ3JvdXAub25EaWRVcGRhdGVSZXNvdXJjZVN0YXRlcygoKSA9PiB7XG5cdFx0XHRcdHRoaXMudXBkYXRlZFJlc291cmNlR3JvdXBzLmFkZChncm91cCk7XG5cdFx0XHRcdHRoaXMuZXZlbnR1YWxseVVwZGF0ZVJlc291cmNlU3RhdGVzKCk7XG5cdFx0XHR9KTtcblxuXHRcdFx0RXZlbnQub25jZShncm91cC5vbkRpZERpc3Bvc2UpKCgpID0+IHtcblx0XHRcdFx0dGhpcy51cGRhdGVkUmVzb3VyY2VHcm91cHMuZGVsZXRlKGdyb3VwKTtcblx0XHRcdFx0dXBkYXRlTGlzdGVuZXIuZGlzcG9zZSgpO1xuXHRcdFx0XHR0aGlzLl9ncm91cHMuZGVsZXRlKGdyb3VwLmhhbmRsZSk7XG5cdFx0XHRcdHRoaXMuI3Byb3h5LiR1bnJlZ2lzdGVyR3JvdXAodGhpcy5oYW5kbGUsIGdyb3VwLmhhbmRsZSk7XG5cdFx0XHR9KTtcblxuXHRcdFx0Z3JvdXBzLnB1c2goW2dyb3VwLmhhbmRsZSwgZ3JvdXAuaWQsIGdyb3VwLmxhYmVsLCBncm91cC5mZWF0dXJlcywgZ3JvdXAubXVsdGlEaWZmRWRpdG9yRW5hYmxlVmlld0NoYW5nZXNdKTtcblxuXHRcdFx0Y29uc3Qgc25hcHNob3QgPSBncm91cC5fdGFrZVJlc291cmNlU3RhdGVTbmFwc2hvdCgpO1xuXG5cdFx0XHRpZiAoc25hcHNob3QubGVuZ3RoID4gMCkge1xuXHRcdFx0XHRzcGxpY2VzLnB1c2goW2dyb3VwLmhhbmRsZSwgc25hcHNob3RdKTtcblx0XHRcdH1cblxuXHRcdFx0dGhpcy5fZ3JvdXBzLnNldChncm91cC5oYW5kbGUsIGdyb3VwKTtcblx0XHR9XG5cblx0XHR0aGlzLiNwcm94eS4kcmVnaXN0ZXJHcm91cHModGhpcy5oYW5kbGUsIGdyb3Vwcywgc3BsaWNlcyk7XG5cdFx0dGhpcy5jcmVhdGVkUmVzb3VyY2VHcm91cHMuY2xlYXIoKTtcblx0fVxuXG5cdEBkZWJvdW5jZSgxMDApXG5cdGV2ZW50dWFsbHlVcGRhdGVSZXNvdXJjZVN0YXRlcygpOiB2b2lkIHtcblx0XHRjb25zdCBzcGxpY2VzOiBTQ01SYXdSZXNvdXJjZVNwbGljZXNbXSA9IFtdO1xuXG5cdFx0dGhpcy51cGRhdGVkUmVzb3VyY2VHcm91cHMuZm9yRWFjaChncm91cCA9PiB7XG5cdFx0XHRjb25zdCBzbmFwc2hvdCA9IGdyb3VwLl90YWtlUmVzb3VyY2VTdGF0ZVNuYXBzaG90KCk7XG5cblx0XHRcdGlmIChzbmFwc2hvdC5sZW5ndGggPT09IDApIHtcblx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0fVxuXG5cdFx0XHRzcGxpY2VzLnB1c2goW2dyb3VwLmhhbmRsZSwgc25hcHNob3RdKTtcblx0XHR9KTtcblxuXHRcdGlmIChzcGxpY2VzLmxlbmd0aCA+IDApIHtcblx0XHRcdHRoaXMuI3Byb3h5LiRzcGxpY2VSZXNvdXJjZVN0YXRlcyh0aGlzLmhhbmRsZSwgc3BsaWNlcyk7XG5cdFx0fVxuXG5cdFx0dGhpcy51cGRhdGVkUmVzb3VyY2VHcm91cHMuY2xlYXIoKTtcblx0fVxuXG5cdGdldFJlc291cmNlR3JvdXAoaGFuZGxlOiBHcm91cEhhbmRsZSk6IEV4dEhvc3RTb3VyY2VDb250cm9sUmVzb3VyY2VHcm91cCB8IHVuZGVmaW5lZCB7XG5cdFx0cmV0dXJuIHRoaXMuX2dyb3Vwcy5nZXQoaGFuZGxlKTtcblx0fVxuXG5cdHNldFNlbGVjdGlvblN0YXRlKHNlbGVjdGVkOiBib29sZWFuKTogdm9pZCB7XG5cdFx0dGhpcy5fc2VsZWN0ZWQgPSBzZWxlY3RlZDtcblx0XHR0aGlzLl9vbkRpZENoYW5nZVNlbGVjdGlvbi5maXJlKHNlbGVjdGVkKTtcblx0fVxuXG5cdGRpc3Bvc2UoKTogdm9pZCB7XG5cdFx0dGhpcy5fYWNjZXB0SW5wdXREaXNwb3NhYmxlcy5kaXNwb3NlKCk7XG5cdFx0dGhpcy5fYWN0aW9uQnV0dG9uRGlzcG9zYWJsZXMuZGlzcG9zZSgpO1xuXHRcdHRoaXMuX3N0YXR1c0JhckRpc3Bvc2FibGVzLmRpc3Bvc2UoKTtcblxuXHRcdHRoaXMuX2dyb3Vwcy5mb3JFYWNoKGdyb3VwID0+IGdyb3VwLmRpc3Bvc2UoKSk7XG5cdFx0dGhpcy4jcHJveHkuJHVucmVnaXN0ZXJTb3VyY2VDb250cm9sKHRoaXMuaGFuZGxlKTtcblx0fVxufVxuXG5leHBvcnQgY2xhc3MgRXh0SG9zdFNDTSBpbXBsZW1lbnRzIEV4dEhvc3RTQ01TaGFwZSB7XG5cblx0cHJpdmF0ZSBzdGF0aWMgX2hhbmRsZVBvb2w6IG51bWJlciA9IDA7XG5cblx0cHJpdmF0ZSBfcHJveHk6IE1haW5UaHJlYWRTQ01TaGFwZTtcblx0cHJpdmF0ZSByZWFkb25seSBfdGVsZW1ldHJ5OiBNYWluVGhyZWFkVGVsZW1ldHJ5U2hhcGU7XG5cdHByaXZhdGUgX3NvdXJjZUNvbnRyb2xzOiBNYXA8UHJvdmlkZXJIYW5kbGUsIEV4dEhvc3RTb3VyY2VDb250cm9sPiA9IG5ldyBNYXA8UHJvdmlkZXJIYW5kbGUsIEV4dEhvc3RTb3VyY2VDb250cm9sPigpO1xuXHRwcml2YXRlIF9zb3VyY2VDb250cm9sc0J5RXh0ZW5zaW9uOiBFeHRlbnNpb25JZGVudGlmaWVyTWFwPEV4dEhvc3RTb3VyY2VDb250cm9sW10+ID0gbmV3IEV4dGVuc2lvbklkZW50aWZpZXJNYXA8RXh0SG9zdFNvdXJjZUNvbnRyb2xbXT4oKTtcblxuXHRwcml2YXRlIHJlYWRvbmx5IF9vbkRpZENoYW5nZUFjdGl2ZVByb3ZpZGVyID0gbmV3IEVtaXR0ZXI8dnNjb2RlLlNvdXJjZUNvbnRyb2w+KCk7XG5cdGdldCBvbkRpZENoYW5nZUFjdGl2ZVByb3ZpZGVyKCk6IEV2ZW50PHZzY29kZS5Tb3VyY2VDb250cm9sPiB7IHJldHVybiB0aGlzLl9vbkRpZENoYW5nZUFjdGl2ZVByb3ZpZGVyLmV2ZW50OyB9XG5cblx0cHJpdmF0ZSBfc2VsZWN0ZWRTb3VyY2VDb250cm9sSGFuZGxlOiBudW1iZXIgfCB1bmRlZmluZWQ7XG5cblx0Y29uc3RydWN0b3IoXG5cdFx0bWFpbkNvbnRleHQ6IElNYWluQ29udGV4dCxcblx0XHRwcml2YXRlIF9jb21tYW5kczogRXh0SG9zdENvbW1hbmRzLFxuXHRcdHByaXZhdGUgX2V4dEhvc3REb2N1bWVudHM6IEV4dEhvc3REb2N1bWVudHMsXG5cdFx0QElMb2dTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgbG9nU2VydmljZTogSUxvZ1NlcnZpY2Vcblx0KSB7XG5cdFx0dGhpcy5fcHJveHkgPSBtYWluQ29udGV4dC5nZXRQcm94eShNYWluQ29udGV4dC5NYWluVGhyZWFkU0NNKTtcblx0XHR0aGlzLl90ZWxlbWV0cnkgPSBtYWluQ29udGV4dC5nZXRQcm94eShNYWluQ29udGV4dC5NYWluVGhyZWFkVGVsZW1ldHJ5KTtcblxuXHRcdF9jb21tYW5kcy5yZWdpc3RlckFyZ3VtZW50UHJvY2Vzc29yKHtcblx0XHRcdHByb2Nlc3NBcmd1bWVudDogYXJnID0+IHtcblx0XHRcdFx0aWYgKGFyZyAmJiBhcmcuJG1pZCA9PT0gTWFyc2hhbGxlZElkLlNjbVJlc291cmNlKSB7XG5cdFx0XHRcdFx0Y29uc3Qgc291cmNlQ29udHJvbCA9IHRoaXMuX3NvdXJjZUNvbnRyb2xzLmdldChhcmcuc291cmNlQ29udHJvbEhhbmRsZSk7XG5cblx0XHRcdFx0XHRpZiAoIXNvdXJjZUNvbnRyb2wpIHtcblx0XHRcdFx0XHRcdHJldHVybiBhcmc7XG5cdFx0XHRcdFx0fVxuXG5cdFx0XHRcdFx0Y29uc3QgZ3JvdXAgPSBzb3VyY2VDb250cm9sLmdldFJlc291cmNlR3JvdXAoYXJnLmdyb3VwSGFuZGxlKTtcblxuXHRcdFx0XHRcdGlmICghZ3JvdXApIHtcblx0XHRcdFx0XHRcdHJldHVybiBhcmc7XG5cdFx0XHRcdFx0fVxuXG5cdFx0XHRcdFx0cmV0dXJuIGdyb3VwLmdldFJlc291cmNlU3RhdGUoYXJnLmhhbmRsZSk7XG5cdFx0XHRcdH0gZWxzZSBpZiAoYXJnICYmIGFyZy4kbWlkID09PSBNYXJzaGFsbGVkSWQuU2NtUmVzb3VyY2VHcm91cCkge1xuXHRcdFx0XHRcdGNvbnN0IHNvdXJjZUNvbnRyb2wgPSB0aGlzLl9zb3VyY2VDb250cm9scy5nZXQoYXJnLnNvdXJjZUNvbnRyb2xIYW5kbGUpO1xuXG5cdFx0XHRcdFx0aWYgKCFzb3VyY2VDb250cm9sKSB7XG5cdFx0XHRcdFx0XHRyZXR1cm4gYXJnO1xuXHRcdFx0XHRcdH1cblxuXHRcdFx0XHRcdHJldHVybiBzb3VyY2VDb250cm9sLmdldFJlc291cmNlR3JvdXAoYXJnLmdyb3VwSGFuZGxlKTtcblx0XHRcdFx0fSBlbHNlIGlmIChhcmcgJiYgYXJnLiRtaWQgPT09IE1hcnNoYWxsZWRJZC5TY21Qcm92aWRlcikge1xuXHRcdFx0XHRcdGNvbnN0IHNvdXJjZUNvbnRyb2wgPSB0aGlzLl9zb3VyY2VDb250cm9scy5nZXQoYXJnLmhhbmRsZSk7XG5cblx0XHRcdFx0XHRpZiAoIXNvdXJjZUNvbnRyb2wpIHtcblx0XHRcdFx0XHRcdHJldHVybiBhcmc7XG5cdFx0XHRcdFx0fVxuXG5cdFx0XHRcdFx0cmV0dXJuIHNvdXJjZUNvbnRyb2w7XG5cdFx0XHRcdH1cblxuXHRcdFx0XHRyZXR1cm4gYXJnO1xuXHRcdFx0fVxuXHRcdH0pO1xuXHR9XG5cblx0Y3JlYXRlU291cmNlQ29udHJvbChleHRlbnNpb246IElFeHRlbnNpb25EZXNjcmlwdGlvbiwgaWQ6IHN0cmluZywgbGFiZWw6IHN0cmluZywgcm9vdFVyaTogdnNjb2RlLlVyaSB8IHVuZGVmaW5lZCk6IHZzY29kZS5Tb3VyY2VDb250cm9sIHtcblx0XHR0aGlzLmxvZ1NlcnZpY2UudHJhY2UoJ0V4dEhvc3RTQ00jY3JlYXRlU291cmNlQ29udHJvbCcsIGV4dGVuc2lvbi5pZGVudGlmaWVyLnZhbHVlLCBpZCwgbGFiZWwsIHJvb3RVcmkpO1xuXG5cdFx0dHlwZSBURXZlbnQgPSB7IGV4dGVuc2lvbklkOiBzdHJpbmcgfTtcblx0XHR0eXBlIFRNZXRhID0ge1xuXHRcdFx0b3duZXI6ICdqb2FvbW9yZW5vJztcblx0XHRcdGV4dGVuc2lvbklkOiB7IGNsYXNzaWZpY2F0aW9uOiAnU3lzdGVtTWV0YURhdGEnOyBwdXJwb3NlOiAnRmVhdHVyZUluc2lnaHQnOyBjb21tZW50OiAnVGhlIElEIG9mIHRoZSBleHRlbnNpb24gY29udHJpYnV0aW5nIHRvIHRoZSBTb3VyY2UgQ29udHJvbCBBUEkuJyB9O1xuXHRcdFx0Y29tbWVudDogJ1RoaXMgaXMgdXNlZCB0byBrbm93IHdoYXQgZXh0ZW5zaW9ucyBjb250cmlidXRlIHRvIHRoZSBTb3VyY2UgQ29udHJvbCBBUEkuJztcblx0XHR9O1xuXHRcdHRoaXMuX3RlbGVtZXRyeS4kcHVibGljTG9nMjxURXZlbnQsIFRNZXRhPignYXBpL3NjbS9jcmVhdGVTb3VyY2VDb250cm9sJywge1xuXHRcdFx0ZXh0ZW5zaW9uSWQ6IGV4dGVuc2lvbi5pZGVudGlmaWVyLnZhbHVlLFxuXHRcdH0pO1xuXG5cdFx0Y29uc3QgaGFuZGxlID0gRXh0SG9zdFNDTS5faGFuZGxlUG9vbCsrO1xuXHRcdGNvbnN0IHNvdXJjZUNvbnRyb2wgPSBuZXcgRXh0SG9zdFNvdXJjZUNvbnRyb2woZXh0ZW5zaW9uLCB0aGlzLl9leHRIb3N0RG9jdW1lbnRzLCB0aGlzLl9wcm94eSwgdGhpcy5fY29tbWFuZHMsIGlkLCBsYWJlbCwgcm9vdFVyaSk7XG5cdFx0dGhpcy5fc291cmNlQ29udHJvbHMuc2V0KGhhbmRsZSwgc291cmNlQ29udHJvbCk7XG5cblx0XHRjb25zdCBzb3VyY2VDb250cm9scyA9IHRoaXMuX3NvdXJjZUNvbnRyb2xzQnlFeHRlbnNpb24uZ2V0KGV4dGVuc2lvbi5pZGVudGlmaWVyKSB8fCBbXTtcblx0XHRzb3VyY2VDb250cm9scy5wdXNoKHNvdXJjZUNvbnRyb2wpO1xuXHRcdHRoaXMuX3NvdXJjZUNvbnRyb2xzQnlFeHRlbnNpb24uc2V0KGV4dGVuc2lvbi5pZGVudGlmaWVyLCBzb3VyY2VDb250cm9scyk7XG5cblx0XHRyZXR1cm4gc291cmNlQ29udHJvbDtcblx0fVxuXG5cdC8vIERlcHJlY2F0ZWRcblx0Z2V0TGFzdElucHV0Qm94KGV4dGVuc2lvbjogSUV4dGVuc2lvbkRlc2NyaXB0aW9uKTogRXh0SG9zdFNDTUlucHV0Qm94IHwgdW5kZWZpbmVkIHtcblx0XHR0aGlzLmxvZ1NlcnZpY2UudHJhY2UoJ0V4dEhvc3RTQ00jZ2V0TGFzdElucHV0Qm94JywgZXh0ZW5zaW9uLmlkZW50aWZpZXIudmFsdWUpO1xuXG5cdFx0Y29uc3Qgc291cmNlQ29udHJvbHMgPSB0aGlzLl9zb3VyY2VDb250cm9sc0J5RXh0ZW5zaW9uLmdldChleHRlbnNpb24uaWRlbnRpZmllcik7XG5cdFx0Y29uc3Qgc291cmNlQ29udHJvbCA9IHNvdXJjZUNvbnRyb2xzICYmIHNvdXJjZUNvbnRyb2xzW3NvdXJjZUNvbnRyb2xzLmxlbmd0aCAtIDFdO1xuXHRcdHJldHVybiBzb3VyY2VDb250cm9sICYmIHNvdXJjZUNvbnRyb2wuaW5wdXRCb3g7XG5cdH1cblxuXHQkcHJvdmlkZU9yaWdpbmFsUmVzb3VyY2Uoc291cmNlQ29udHJvbEhhbmRsZTogbnVtYmVyLCB1cmlDb21wb25lbnRzOiBVcmlDb21wb25lbnRzLCB0b2tlbjogQ2FuY2VsbGF0aW9uVG9rZW4pOiBQcm9taXNlPFVyaUNvbXBvbmVudHMgfCBudWxsPiB7XG5cdFx0Y29uc3QgdXJpID0gVVJJLnJldml2ZSh1cmlDb21wb25lbnRzKTtcblx0XHR0aGlzLmxvZ1NlcnZpY2UudHJhY2UoJ0V4dEhvc3RTQ00jJHByb3ZpZGVPcmlnaW5hbFJlc291cmNlJywgc291cmNlQ29udHJvbEhhbmRsZSwgdXJpLnRvU3RyaW5nKCkpO1xuXG5cdFx0Y29uc3Qgc291cmNlQ29udHJvbCA9IHRoaXMuX3NvdXJjZUNvbnRyb2xzLmdldChzb3VyY2VDb250cm9sSGFuZGxlKTtcblxuXHRcdGlmICghc291cmNlQ29udHJvbCB8fCAhc291cmNlQ29udHJvbC5xdWlja0RpZmZQcm92aWRlciB8fCAhc291cmNlQ29udHJvbC5xdWlja0RpZmZQcm92aWRlci5wcm92aWRlT3JpZ2luYWxSZXNvdXJjZSkge1xuXHRcdFx0cmV0dXJuIFByb21pc2UucmVzb2x2ZShudWxsKTtcblx0XHR9XG5cblx0XHRyZXR1cm4gYXNQcm9taXNlKCgpID0+IHNvdXJjZUNvbnRyb2wucXVpY2tEaWZmUHJvdmlkZXIhLnByb3ZpZGVPcmlnaW5hbFJlc291cmNlISh1cmksIHRva2VuKSlcblx0XHRcdC50aGVuPFVyaUNvbXBvbmVudHMgfCBudWxsPihyID0+IHIgfHwgbnVsbCk7XG5cdH1cblxuXHQkb25JbnB1dEJveFZhbHVlQ2hhbmdlKHNvdXJjZUNvbnRyb2xIYW5kbGU6IG51bWJlciwgdmFsdWU6IHN0cmluZyk6IFByb21pc2U8dm9pZD4ge1xuXHRcdHRoaXMubG9nU2VydmljZS50cmFjZSgnRXh0SG9zdFNDTSMkb25JbnB1dEJveFZhbHVlQ2hhbmdlJywgc291cmNlQ29udHJvbEhhbmRsZSk7XG5cblx0XHRjb25zdCBzb3VyY2VDb250cm9sID0gdGhpcy5fc291cmNlQ29udHJvbHMuZ2V0KHNvdXJjZUNvbnRyb2xIYW5kbGUpO1xuXG5cdFx0aWYgKCFzb3VyY2VDb250cm9sKSB7XG5cdFx0XHRyZXR1cm4gUHJvbWlzZS5yZXNvbHZlKHVuZGVmaW5lZCk7XG5cdFx0fVxuXG5cdFx0c291cmNlQ29udHJvbC5pbnB1dEJveC4kb25JbnB1dEJveFZhbHVlQ2hhbmdlKHZhbHVlKTtcblx0XHRyZXR1cm4gUHJvbWlzZS5yZXNvbHZlKHVuZGVmaW5lZCk7XG5cdH1cblxuXHQkZXhlY3V0ZVJlc291cmNlQ29tbWFuZChzb3VyY2VDb250cm9sSGFuZGxlOiBudW1iZXIsIGdyb3VwSGFuZGxlOiBudW1iZXIsIGhhbmRsZTogbnVtYmVyLCBwcmVzZXJ2ZUZvY3VzOiBib29sZWFuKTogUHJvbWlzZTx2b2lkPiB7XG5cdFx0dGhpcy5sb2dTZXJ2aWNlLnRyYWNlKCdFeHRIb3N0U0NNIyRleGVjdXRlUmVzb3VyY2VDb21tYW5kJywgc291cmNlQ29udHJvbEhhbmRsZSwgZ3JvdXBIYW5kbGUsIGhhbmRsZSk7XG5cblx0XHRjb25zdCBzb3VyY2VDb250cm9sID0gdGhpcy5fc291cmNlQ29udHJvbHMuZ2V0KHNvdXJjZUNvbnRyb2xIYW5kbGUpO1xuXG5cdFx0aWYgKCFzb3VyY2VDb250cm9sKSB7XG5cdFx0XHRyZXR1cm4gUHJvbWlzZS5yZXNvbHZlKHVuZGVmaW5lZCk7XG5cdFx0fVxuXG5cdFx0Y29uc3QgZ3JvdXAgPSBzb3VyY2VDb250cm9sLmdldFJlc291cmNlR3JvdXAoZ3JvdXBIYW5kbGUpO1xuXG5cdFx0aWYgKCFncm91cCkge1xuXHRcdFx0cmV0dXJuIFByb21pc2UucmVzb2x2ZSh1bmRlZmluZWQpO1xuXHRcdH1cblxuXHRcdHJldHVybiBncm91cC4kZXhlY3V0ZVJlc291cmNlQ29tbWFuZChoYW5kbGUsIHByZXNlcnZlRm9jdXMpO1xuXHR9XG5cblx0JHZhbGlkYXRlSW5wdXQoc291cmNlQ29udHJvbEhhbmRsZTogbnVtYmVyLCB2YWx1ZTogc3RyaW5nLCBjdXJzb3JQb3NpdGlvbjogbnVtYmVyKTogUHJvbWlzZTxbc3RyaW5nIHwgSU1hcmtkb3duU3RyaW5nLCBudW1iZXJdIHwgdW5kZWZpbmVkPiB7XG5cdFx0dGhpcy5sb2dTZXJ2aWNlLnRyYWNlKCdFeHRIb3N0U0NNIyR2YWxpZGF0ZUlucHV0Jywgc291cmNlQ29udHJvbEhhbmRsZSk7XG5cblx0XHRjb25zdCBzb3VyY2VDb250cm9sID0gdGhpcy5fc291cmNlQ29udHJvbHMuZ2V0KHNvdXJjZUNvbnRyb2xIYW5kbGUpO1xuXG5cdFx0aWYgKCFzb3VyY2VDb250cm9sKSB7XG5cdFx0XHRyZXR1cm4gUHJvbWlzZS5yZXNvbHZlKHVuZGVmaW5lZCk7XG5cdFx0fVxuXG5cdFx0aWYgKCFzb3VyY2VDb250cm9sLmlucHV0Qm94LnZhbGlkYXRlSW5wdXQpIHtcblx0XHRcdHJldHVybiBQcm9taXNlLnJlc29sdmUodW5kZWZpbmVkKTtcblx0XHR9XG5cblx0XHRyZXR1cm4gYXNQcm9taXNlKCgpID0+IHNvdXJjZUNvbnRyb2wuaW5wdXRCb3gudmFsaWRhdGVJbnB1dCEodmFsdWUsIGN1cnNvclBvc2l0aW9uKSkudGhlbihyZXN1bHQgPT4ge1xuXHRcdFx0aWYgKCFyZXN1bHQpIHtcblx0XHRcdFx0cmV0dXJuIFByb21pc2UucmVzb2x2ZSh1bmRlZmluZWQpO1xuXHRcdFx0fVxuXG5cdFx0XHRjb25zdCBtZXNzYWdlID0gTWFya2Rvd25TdHJpbmcuZnJvbVN0cmljdChyZXN1bHQubWVzc2FnZSk7XG5cdFx0XHRpZiAoIW1lc3NhZ2UpIHtcblx0XHRcdFx0cmV0dXJuIFByb21pc2UucmVzb2x2ZSh1bmRlZmluZWQpO1xuXHRcdFx0fVxuXG5cdFx0XHRyZXR1cm4gUHJvbWlzZS5yZXNvbHZlPFtzdHJpbmcgfCBJTWFya2Rvd25TdHJpbmcsIG51bWJlcl0+KFttZXNzYWdlLCByZXN1bHQudHlwZV0pO1xuXHRcdH0pO1xuXHR9XG5cblx0JHNldFNlbGVjdGVkU291cmNlQ29udHJvbChzZWxlY3RlZFNvdXJjZUNvbnRyb2xIYW5kbGU6IG51bWJlciB8IHVuZGVmaW5lZCk6IFByb21pc2U8dm9pZD4ge1xuXHRcdHRoaXMubG9nU2VydmljZS50cmFjZSgnRXh0SG9zdFNDTSMkc2V0U2VsZWN0ZWRTb3VyY2VDb250cm9sJywgc2VsZWN0ZWRTb3VyY2VDb250cm9sSGFuZGxlKTtcblxuXHRcdGlmIChzZWxlY3RlZFNvdXJjZUNvbnRyb2xIYW5kbGUgIT09IHVuZGVmaW5lZCkge1xuXHRcdFx0dGhpcy5fc291cmNlQ29udHJvbHMuZ2V0KHNlbGVjdGVkU291cmNlQ29udHJvbEhhbmRsZSk/LnNldFNlbGVjdGlvblN0YXRlKHRydWUpO1xuXHRcdH1cblxuXHRcdGlmICh0aGlzLl9zZWxlY3RlZFNvdXJjZUNvbnRyb2xIYW5kbGUgIT09IHVuZGVmaW5lZCkge1xuXHRcdFx0dGhpcy5fc291cmNlQ29udHJvbHMuZ2V0KHRoaXMuX3NlbGVjdGVkU291cmNlQ29udHJvbEhhbmRsZSk/LnNldFNlbGVjdGlvblN0YXRlKGZhbHNlKTtcblx0XHR9XG5cblx0XHR0aGlzLl9zZWxlY3RlZFNvdXJjZUNvbnRyb2xIYW5kbGUgPSBzZWxlY3RlZFNvdXJjZUNvbnRyb2xIYW5kbGU7XG5cdFx0cmV0dXJuIFByb21pc2UucmVzb2x2ZSh1bmRlZmluZWQpO1xuXHR9XG5cblx0YXN5bmMgJHJlc29sdmVIaXN0b3J5SXRlbVJlZnNDb21tb25BbmNlc3Rvcihzb3VyY2VDb250cm9sSGFuZGxlOiBudW1iZXIsIGhpc3RvcnlJdGVtUmVmczogc3RyaW5nW10sIHRva2VuOiBDYW5jZWxsYXRpb25Ub2tlbik6IFByb21pc2U8c3RyaW5nIHwgdW5kZWZpbmVkPiB7XG5cdFx0dHJ5IHtcblx0XHRcdGNvbnN0IGhpc3RvcnlQcm92aWRlciA9IHRoaXMuX3NvdXJjZUNvbnRyb2xzLmdldChzb3VyY2VDb250cm9sSGFuZGxlKT8uaGlzdG9yeVByb3ZpZGVyO1xuXHRcdFx0Y29uc3QgYW5jZXN0b3IgPSBhd2FpdCBoaXN0b3J5UHJvdmlkZXI/LnJlc29sdmVIaXN0b3J5SXRlbVJlZnNDb21tb25BbmNlc3RvcihoaXN0b3J5SXRlbVJlZnMsIHRva2VuKTtcblxuXHRcdFx0cmV0dXJuIGFuY2VzdG9yID8/IHVuZGVmaW5lZDtcblx0XHR9XG5cdFx0Y2F0Y2ggKGVycikge1xuXHRcdFx0dGhpcy5sb2dTZXJ2aWNlLmVycm9yKCdFeHRIb3N0U0NNIyRyZXNvbHZlSGlzdG9yeUl0ZW1SZWZzQ29tbW9uQW5jZXN0b3InLCBlcnIpO1xuXHRcdFx0cmV0dXJuIHVuZGVmaW5lZDtcblx0XHR9XG5cdH1cblxuXHRhc3luYyAkcHJvdmlkZUhpc3RvcnlJdGVtUmVmcyhzb3VyY2VDb250cm9sSGFuZGxlOiBudW1iZXIsIGhpc3RvcnlJdGVtUmVmczogc3RyaW5nW10gfCB1bmRlZmluZWQsIHRva2VuOiBDYW5jZWxsYXRpb25Ub2tlbik6IFByb21pc2U8U0NNSGlzdG9yeUl0ZW1SZWZEdG9bXSB8IHVuZGVmaW5lZD4ge1xuXHRcdHRyeSB7XG5cdFx0XHRjb25zdCBoaXN0b3J5UHJvdmlkZXIgPSB0aGlzLl9zb3VyY2VDb250cm9scy5nZXQoc291cmNlQ29udHJvbEhhbmRsZSk/Lmhpc3RvcnlQcm92aWRlcjtcblx0XHRcdGNvbnN0IHJlZnMgPSBhd2FpdCBoaXN0b3J5UHJvdmlkZXI/LnByb3ZpZGVIaXN0b3J5SXRlbVJlZnMoaGlzdG9yeUl0ZW1SZWZzLCB0b2tlbik7XG5cblx0XHRcdHJldHVybiByZWZzPy5tYXAocmVmID0+ICh7IC4uLnJlZiwgaWNvbjogZ2V0SGlzdG9yeUl0ZW1JY29uRHRvKHJlZi5pY29uKSB9KSkgPz8gdW5kZWZpbmVkO1xuXHRcdH1cblx0XHRjYXRjaCAoZXJyKSB7XG5cdFx0XHR0aGlzLmxvZ1NlcnZpY2UuZXJyb3IoJ0V4dEhvc3RTQ00jJHByb3ZpZGVIaXN0b3J5SXRlbVJlZnMnLCBlcnIpO1xuXHRcdFx0cmV0dXJuIHVuZGVmaW5lZDtcblx0XHR9XG5cdH1cblxuXHRhc3luYyAkcHJvdmlkZUhpc3RvcnlJdGVtcyhzb3VyY2VDb250cm9sSGFuZGxlOiBudW1iZXIsIG9wdGlvbnM6IGFueSwgdG9rZW46IENhbmNlbGxhdGlvblRva2VuKTogUHJvbWlzZTxTQ01IaXN0b3J5SXRlbUR0b1tdIHwgdW5kZWZpbmVkPiB7XG5cdFx0dHJ5IHtcblx0XHRcdGNvbnN0IGhpc3RvcnlQcm92aWRlciA9IHRoaXMuX3NvdXJjZUNvbnRyb2xzLmdldChzb3VyY2VDb250cm9sSGFuZGxlKT8uaGlzdG9yeVByb3ZpZGVyO1xuXHRcdFx0Y29uc3QgaGlzdG9yeUl0ZW1zID0gYXdhaXQgaGlzdG9yeVByb3ZpZGVyPy5wcm92aWRlSGlzdG9yeUl0ZW1zKG9wdGlvbnMsIHRva2VuKTtcblxuXHRcdFx0cmV0dXJuIGhpc3RvcnlJdGVtcz8ubWFwKGl0ZW0gPT4gdG9TQ01IaXN0b3J5SXRlbUR0byhpdGVtKSkgPz8gdW5kZWZpbmVkO1xuXHRcdH1cblx0XHRjYXRjaCAoZXJyKSB7XG5cdFx0XHR0aGlzLmxvZ1NlcnZpY2UuZXJyb3IoJ0V4dEhvc3RTQ00jJHByb3ZpZGVIaXN0b3J5SXRlbXMnLCBlcnIpO1xuXHRcdFx0cmV0dXJuIHVuZGVmaW5lZDtcblx0XHR9XG5cdH1cblxuXHRhc3luYyAkcHJvdmlkZUhpc3RvcnlJdGVtQ2hhbmdlcyhzb3VyY2VDb250cm9sSGFuZGxlOiBudW1iZXIsIGhpc3RvcnlJdGVtSWQ6IHN0cmluZywgaGlzdG9yeUl0ZW1QYXJlbnRJZDogc3RyaW5nIHwgdW5kZWZpbmVkLCB0b2tlbjogQ2FuY2VsbGF0aW9uVG9rZW4pOiBQcm9taXNlPFNDTUhpc3RvcnlJdGVtQ2hhbmdlRHRvW10gfCB1bmRlZmluZWQ+IHtcblx0XHR0cnkge1xuXHRcdFx0Y29uc3QgaGlzdG9yeVByb3ZpZGVyID0gdGhpcy5fc291cmNlQ29udHJvbHMuZ2V0KHNvdXJjZUNvbnRyb2xIYW5kbGUpPy5oaXN0b3J5UHJvdmlkZXI7XG5cdFx0XHRjb25zdCBjaGFuZ2VzID0gYXdhaXQgaGlzdG9yeVByb3ZpZGVyPy5wcm92aWRlSGlzdG9yeUl0ZW1DaGFuZ2VzKGhpc3RvcnlJdGVtSWQsIGhpc3RvcnlJdGVtUGFyZW50SWQsIHRva2VuKTtcblxuXHRcdFx0cmV0dXJuIGNoYW5nZXMgPz8gdW5kZWZpbmVkO1xuXHRcdH1cblx0XHRjYXRjaCAoZXJyKSB7XG5cdFx0XHR0aGlzLmxvZ1NlcnZpY2UuZXJyb3IoJ0V4dEhvc3RTQ00jJHByb3ZpZGVIaXN0b3J5SXRlbUNoYW5nZXMnLCBlcnIpO1xuXHRcdFx0cmV0dXJuIHVuZGVmaW5lZDtcblx0XHR9XG5cdH1cbn1cbiJdLAogICJtYXBwaW5ncyI6ICI7Ozs7Ozs7Ozs7Ozs7Ozs7OztBQUFBO0FBT0EsU0FBUyxXQUEwQjtBQUNuQyxTQUFTLE9B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
