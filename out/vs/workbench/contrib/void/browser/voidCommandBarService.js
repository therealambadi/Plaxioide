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
import { Disposable, toDisposable } from "../../../../base/common/lifecycle.js";
import { createDecorator, IInstantiationService } from "../../../../platform/instantiation/common/instantiation.js";
import * as dom from "../../../../base/browser/dom.js";
import { Widget } from "../../../../base/browser/ui/widget.js";
import { OverlayWidgetPositionPreference } from "../../../../editor/browser/editorBrowser.js";
import { Emitter } from "../../../../base/common/event.js";
import { ICodeEditorService } from "../../../../editor/browser/services/codeEditorService.js";
import { mountVoidCommandBar } from "./react/out/void-editor-widgets-tsx/index.js";
import { deepClone } from "../../../../base/common/objects.js";
import { InstantiationType, registerSingleton } from "../../../../platform/instantiation/common/extensions.js";
import { IEditCodeService } from "./editCodeServiceInterface.js";
import { IModelService } from "../../../../editor/common/services/model.js";
import { generateUuid } from "../../../../base/common/uuid.js";
import { Action2, registerAction2 } from "../../../../platform/actions/common/actions.js";
import { VOID_ACCEPT_DIFF_ACTION_ID, VOID_REJECT_DIFF_ACTION_ID, VOID_GOTO_NEXT_DIFF_ACTION_ID, VOID_GOTO_PREV_DIFF_ACTION_ID, VOID_GOTO_NEXT_URI_ACTION_ID, VOID_GOTO_PREV_URI_ACTION_ID, VOID_ACCEPT_FILE_ACTION_ID, VOID_REJECT_FILE_ACTION_ID, VOID_ACCEPT_ALL_DIFFS_ACTION_ID, VOID_REJECT_ALL_DIFFS_ACTION_ID } from "./actionIDs.js";
import { localize2 } from "../../../../nls.js";
import { KeybindingWeight } from "../../../../platform/keybinding/common/keybindingsRegistry.js";
import { IMetricsService } from "../common/metricsService.js";
import { KeyMod } from "../../../../editor/common/services/editorBaseApi.js";
import { KeyCode } from "../../../../base/common/keyCodes.js";
import { ScrollType } from "../../../../editor/common/editorCommon.js";
import { IVoidModelService } from "../common/voidModelService.js";
const IVoidCommandBarService = createDecorator("VoidCommandBarService");
const defaultState = {
  sortedDiffZoneIds: [],
  sortedDiffIds: [],
  isStreaming: false,
  diffIdx: null
};
let VoidCommandBarService = class extends Disposable {
  constructor(_instantiationService, _codeEditorService, _modelService, _editCodeService, _voidModelService) {
    super();
    this._instantiationService = _instantiationService;
    this._codeEditorService = _codeEditorService;
    this._modelService = _modelService;
    this._editCodeService = _editCodeService;
    this._voidModelService = _voidModelService;
    // depends on uri -> diffZone -> {streaming, diffs}
    this.stateOfURI = {};
    this.sortedURIs = [];
    // keys of state (depends on diffZones in the uri)
    this._listenToTheseURIs = /* @__PURE__ */ new Set();
    // uriFsPaths
    // Emits when a URI's stream state changes between idle, streaming, and acceptRejectAll
    this._onDidChangeState = new Emitter();
    this.onDidChangeState = this._onDidChangeState.event;
    // active URI
    this.activeURI = null;
    this._onDidChangeActiveURI = new Emitter();
    this.onDidChangeActiveURI = this._onDidChangeActiveURI.event;
    const registeredModelURIs = /* @__PURE__ */ new Set();
    const initializeModel = async (model) => {
      if (registeredModelURIs.has(model.uri.fsPath)) return;
      registeredModelURIs.add(model.uri.fsPath);
      this._listenToTheseURIs.add(model.uri);
    };
    this._modelService.getModels().forEach((model) => {
      initializeModel(model);
    });
    this._register(this._modelService.onModelAdded((model) => {
      initializeModel(model);
    }));
    const disposablesOfEditorId = {};
    const onCodeEditorAdd = (editor) => {
      const id = editor.getId();
      disposablesOfEditorId[id] = [];
      const d1 = this._instantiationService.createInstance(AcceptRejectAllFloatingWidget, { editor });
      disposablesOfEditorId[id].push(d1);
      const d2 = editor.onDidChangeModel((e) => {
        if (e.newModelUrl?.scheme !== "file") return;
        this.activeURI = e.newModelUrl;
        this._onDidChangeActiveURI.fire({ uri: e.newModelUrl });
      });
      disposablesOfEditorId[id].push(d2);
    };
    const onCodeEditorRemove = (editor) => {
      const id = editor.getId();
      if (disposablesOfEditorId[id]) {
        disposablesOfEditorId[id].forEach((d) => d.dispose());
        delete disposablesOfEditorId[id];
      }
    };
    this._register(this._codeEditorService.onCodeEditorAdd((editor) => {
      onCodeEditorAdd(editor);
    }));
    this._register(this._codeEditorService.onCodeEditorRemove((editor) => {
      onCodeEditorRemove(editor);
    }));
    this._codeEditorService.listCodeEditors().forEach((editor) => {
      onCodeEditorAdd(editor);
    });
    this._register(this._editCodeService.onDidAddOrDeleteDiffZones((e) => {
      for (const uri of this._listenToTheseURIs) {
        if (e.uri.fsPath !== uri.fsPath) continue;
        const diffZones = this._getDiffZonesOnURI(uri);
        if (diffZones.length === 0) {
          this._deleteURIEntryFromState(uri);
          this._onDidChangeState.fire({ uri });
          continue;
        }
        if (!this.sortedURIs.find((uri2) => uri2.fsPath === uri.fsPath)) {
          this._addURIEntryToState(uri);
        }
        const currState = this.stateOfURI[uri.fsPath];
        if (!currState) continue;
        const oldDiffZones = currState.sortedDiffZoneIds;
        const currentDiffZones = this._editCodeService.diffAreasOfURI[uri.fsPath] || [];
        const { addedDiffZones, deletedDiffZones } = this._getDiffZoneChanges(oldDiffZones, currentDiffZones || []);
        const diffZonesWithoutDeleted = oldDiffZones.filter((olddiffareaid) => !deletedDiffZones.has(olddiffareaid));
        const newSortedDiffZoneIds = [
          ...diffZonesWithoutDeleted,
          ...addedDiffZones
        ];
        const newSortedDiffIds = this._computeSortedDiffs(newSortedDiffZoneIds);
        const isStreaming = this._isAnyDiffZoneStreaming(currentDiffZones);
        const newDiffIdx = newSortedDiffIds.length > 0 ? 0 : null;
        this._setState(uri, {
          sortedDiffZoneIds: newSortedDiffZoneIds,
          sortedDiffIds: newSortedDiffIds,
          isStreaming,
          diffIdx: newDiffIdx
        });
        this._onDidChangeState.fire({ uri });
      }
    }));
    this._register(this._editCodeService.onDidChangeDiffsInDiffZoneNotStreaming((e) => {
      for (const uri of this._listenToTheseURIs) {
        if (e.uri.fsPath !== uri.fsPath) continue;
        const currState = this.stateOfURI[uri.fsPath];
        if (!currState) continue;
        const { sortedDiffZoneIds } = currState;
        const oldSortedDiffIds = currState.sortedDiffIds;
        const newSortedDiffIds = this._computeSortedDiffs(sortedDiffZoneIds);
        let newDiffIdx = currState.diffIdx;
        if (oldSortedDiffIds.length > newSortedDiffIds.length && currState.diffIdx !== null) {
          if (currState.diffIdx >= newSortedDiffIds.length) {
            newDiffIdx = newSortedDiffIds.length > 0 ? newSortedDiffIds.length - 1 : null;
          }
        }
        this._setState(uri, {
          sortedDiffIds: newSortedDiffIds,
          diffIdx: newDiffIdx
          // sortedDiffZoneIds, // no change
          // isStreaming, // no change
        });
        this._onDidChangeState.fire({ uri });
      }
    }));
    this._register(this._editCodeService.onDidChangeStreamingInDiffZone((e) => {
      for (const uri of this._listenToTheseURIs) {
        if (e.uri.fsPath !== uri.fsPath) continue;
        const currState = this.stateOfURI[uri.fsPath];
        if (!currState) continue;
        const { sortedDiffZoneIds } = currState;
        this._setState(uri, {
          isStreaming: this._isAnyDiffZoneStreaming(sortedDiffZoneIds)
          // sortedDiffIds, // no change
          // sortedDiffZoneIds, // no change
        });
        this._onDidChangeState.fire({ uri });
      }
    }));
  }
  setDiffIdx(uri, newIdx) {
    this._setState(uri, { diffIdx: newIdx });
    this._onDidChangeState.fire({ uri });
  }
  getStreamState(uri) {
    const { isStreaming, sortedDiffZoneIds } = this.stateOfURI[uri.fsPath] ?? {};
    if (isStreaming) {
      return "streaming";
    }
    if ((sortedDiffZoneIds?.length ?? 0) > 0) {
      return "idle-has-changes";
    }
    return "idle-no-changes";
  }
  _computeSortedDiffs(diffareaids) {
    const sortedDiffIds = [];
    for (const diffareaid of diffareaids) {
      const diffZone = this._editCodeService.diffAreaOfId[diffareaid];
      if (!diffZone || diffZone.type !== "DiffZone") {
        continue;
      }
      const diffIds = Object.keys(diffZone._diffOfId);
      sortedDiffIds.push(...diffIds);
    }
    return sortedDiffIds;
  }
  _getDiffZoneChanges(oldDiffZones, currentDiffZones) {
    const addedDiffZoneIds = /* @__PURE__ */ new Set();
    const deletedDiffZoneIds = /* @__PURE__ */ new Set();
    const currentDiffZoneIdSet = new Set(currentDiffZones);
    for (const oldDiffZoneId of oldDiffZones) {
      if (!currentDiffZoneIdSet.has(oldDiffZoneId)) {
        const diffZone = this._editCodeService.diffAreaOfId[oldDiffZoneId];
        if (diffZone && diffZone.type === "DiffZone") {
          deletedDiffZoneIds.add(oldDiffZoneId);
        }
      }
    }
    const oldDiffZoneIdSet = new Set(oldDiffZones);
    for (const currentDiffZoneId of currentDiffZones) {
      if (!oldDiffZoneIdSet.has(currentDiffZoneId)) {
        const diffZone = this._editCodeService.diffAreaOfId[currentDiffZoneId];
        if (diffZone && diffZone.type === "DiffZone") {
          addedDiffZoneIds.add(currentDiffZoneId);
        }
      }
    }
    return { addedDiffZones: addedDiffZoneIds, deletedDiffZones: deletedDiffZoneIds };
  }
  _isAnyDiffZoneStreaming(diffareaids) {
    for (const diffareaid of diffareaids) {
      const diffZone = this._editCodeService.diffAreaOfId[diffareaid];
      if (!diffZone || diffZone.type !== "DiffZone") {
        continue;
      }
      if (diffZone._streamState.isStreaming) {
        return true;
      }
    }
    return false;
  }
  _setState(uri, opts) {
    const newState = {
      ...this.stateOfURI[uri.fsPath] ?? deepClone(defaultState),
      ...opts
    };
    if (newState.diffIdx !== null && newState.diffIdx > newState.sortedDiffIds.length) {
      newState.diffIdx = newState.sortedDiffIds.length;
      if (newState.diffIdx <= 0) newState.diffIdx = null;
    }
    this.stateOfURI = {
      ...this.stateOfURI,
      [uri.fsPath]: newState
    };
  }
  _addURIEntryToState(uri) {
    this.sortedURIs = [
      ...this.sortedURIs,
      uri
    ];
    this.stateOfURI[uri.fsPath] = deepClone(defaultState);
  }
  _deleteURIEntryFromState(uri) {
    const i = this.sortedURIs.findIndex((uri2) => uri2.fsPath === uri.fsPath);
    if (i === -1) return;
    this.sortedURIs = [
      ...this.sortedURIs.slice(0, i),
      ...this.sortedURIs.slice(i + 1, Infinity)
    ];
    delete this.stateOfURI[uri.fsPath];
  }
  _getDiffZonesOnURI(uri) {
    const diffZones = [...this._editCodeService.diffAreasOfURI[uri.fsPath]?.values() ?? []].map((diffareaid) => this._editCodeService.diffAreaOfId[diffareaid]).filter((diffArea) => !!diffArea && diffArea.type === "DiffZone");
    return diffZones;
  }
  anyFileIsStreaming() {
    return this.sortedURIs.some((uri) => this.getStreamState(uri) === "streaming");
  }
  getNextDiffIdx(step) {
    if (!this.activeURI) return null;
    const state = this.stateOfURI[this.activeURI.fsPath];
    if (!state) return null;
    const { diffIdx, sortedDiffIds } = state;
    if (sortedDiffIds.length === 0) return null;
    const nextIdx = ((diffIdx ?? 0) + step + sortedDiffIds.length) % sortedDiffIds.length;
    return nextIdx;
  }
  getNextUriIdx(step) {
    if (this.sortedURIs.length === 0) return null;
    if (!this.activeURI) {
      return step === 1 ? 0 : this.sortedURIs.length - 1;
    }
    const currentIdx = this.sortedURIs.findIndex((uri) => uri.fsPath === this.activeURI?.fsPath);
    if (currentIdx === -1) {
      return step === 1 ? 0 : this.sortedURIs.length - 1;
    }
    const nextIdx = (currentIdx + step + this.sortedURIs.length) % this.sortedURIs.length;
    return nextIdx;
  }
  goToDiffIdx(idx) {
    if (idx === null || !this.activeURI) return;
    const state = this.stateOfURI[this.activeURI.fsPath];
    if (!state) return;
    const { sortedDiffIds } = state;
    const diffid = sortedDiffIds[idx];
    if (diffid === void 0) return;
    const diff = this._editCodeService.diffOfId[diffid];
    if (!diff) return;
    const editor = this._codeEditorService.getFocusedCodeEditor() || this._codeEditorService.getActiveCodeEditor();
    if (!editor) return;
    editor.revealLineNearTop(diff.startLine - 1, ScrollType.Immediate);
    this.setDiffIdx(this.activeURI, idx);
  }
  async goToURIIdx(idx) {
    if (idx === null || this.sortedURIs.length === 0) return;
    const nextURI = this.sortedURIs[idx];
    if (!nextURI) return;
    const { model } = await this._voidModelService.getModelSafe(nextURI);
    if (!model) return;
    const editor = this._codeEditorService.getFocusedCodeEditor() || this._codeEditorService.getActiveCodeEditor();
    if (!editor) return;
    await this._codeEditorService.openCodeEditor(
      { resource: model.uri, options: { revealIfVisible: true } },
      editor
    );
  }
  acceptOrRejectAllFiles(opts) {
    const { behavior } = opts;
    const anyIsStreaming = this.anyFileIsStreaming();
    if (anyIsStreaming) return;
    for (const uri of this.sortedURIs) {
      this._editCodeService.acceptOrRejectAllDiffAreas({ uri, behavior, removeCtrlKs: false });
    }
  }
};
VoidCommandBarService = __decorateClass([
  __decorateParam(0, IInstantiationService),
  __decorateParam(1, ICodeEditorService),
  __decorateParam(2, IModelService),
  __decorateParam(3, IEditCodeService),
  __decorateParam(4, IVoidModelService)
], VoidCommandBarService);
registerSingleton(IVoidCommandBarService, VoidCommandBarService, InstantiationType.Delayed);
let AcceptRejectAllFloatingWidget = class extends Widget {
  constructor({ editor }, instantiationService) {
    super();
    this.instantiationService = instantiationService;
    this._height = 0;
    this.ID = generateUuid();
    this.editor = editor;
    const { root } = dom.h("div@root");
    root.style.height = "256px";
    root.style.width = "100%";
    root.style.flexDirection = "column";
    root.style.justifyContent = "flex-end";
    root.style.alignItems = "flex-end";
    root.style.zIndex = "2";
    root.style.padding = "4px";
    root.style.pointerEvents = "none";
    root.style.display = "flex";
    root.style.overflow = "hidden";
    this._domNode = root;
    editor.addOverlayWidget(this);
    this.instantiationService.invokeFunction((accessor) => {
      const uri = editor.getModel()?.uri || null;
      const res = mountVoidCommandBar(root, accessor, { uri, editor });
      if (!res) return;
      this._register(toDisposable(() => res.dispose?.()));
      this._register(editor.onWillChangeModel((model) => {
        const uri2 = model.newModelUrl;
        res.rerender({ uri: uri2, editor });
      }));
    });
  }
  getId() {
    return this.ID;
  }
  getDomNode() {
    return this._domNode;
  }
  getPosition() {
    return {
      preference: OverlayWidgetPositionPreference.BOTTOM_RIGHT_CORNER
    };
  }
  dispose() {
    this.editor.removeOverlayWidget(this);
    super.dispose();
  }
};
AcceptRejectAllFloatingWidget = __decorateClass([
  __decorateParam(1, IInstantiationService)
], AcceptRejectAllFloatingWidget);
registerAction2(class extends Action2 {
  constructor() {
    super({
      id: VOID_ACCEPT_DIFF_ACTION_ID,
      f1: true,
      title: localize2("voidAcceptDiffAction", "Plaxio: Accept Diff"),
      keybinding: {
        primary: KeyMod.CtrlCmd | KeyMod.Alt | KeyMod.Shift | KeyCode.Enter,
        mac: { primary: KeyMod.WinCtrl | KeyMod.Alt | KeyCode.Enter },
        weight: KeybindingWeight.VoidExtension
      }
    });
  }
  async run(accessor) {
    const editCodeService = accessor.get(IEditCodeService);
    const commandBarService = accessor.get(IVoidCommandBarService);
    const metricsService = accessor.get(IMetricsService);
    const activeURI = commandBarService.activeURI;
    if (!activeURI) return;
    const commandBarState = commandBarService.stateOfURI[activeURI.fsPath];
    if (!commandBarState) return;
    const diffIdx = commandBarState.diffIdx ?? 0;
    const diffid = commandBarState.sortedDiffIds[diffIdx];
    if (!diffid) return;
    metricsService.capture("Accept Diff", { diffid, keyboard: true });
    editCodeService.acceptDiff({ diffid: parseInt(diffid) });
    const nextDiffIdx = commandBarService.getNextDiffIdx(1);
    if (nextDiffIdx !== null) {
      commandBarService.goToDiffIdx(nextDiffIdx);
    }
  }
});
registerAction2(class extends Action2 {
  constructor() {
    super({
      id: VOID_REJECT_DIFF_ACTION_ID,
      f1: true,
      title: localize2("voidRejectDiffAction", "Plaxio: Reject Diff"),
      keybinding: {
        primary: KeyMod.CtrlCmd | KeyMod.Alt | KeyMod.Shift | KeyCode.Backspace,
        mac: { primary: KeyMod.WinCtrl | KeyMod.Alt | KeyCode.Backspace },
        weight: KeybindingWeight.VoidExtension
      }
    });
  }
  async run(accessor) {
    const editCodeService = accessor.get(IEditCodeService);
    const commandBarService = accessor.get(IVoidCommandBarService);
    const metricsService = accessor.get(IMetricsService);
    const activeURI = commandBarService.activeURI;
    if (!activeURI) return;
    const commandBarState = commandBarService.stateOfURI[activeURI.fsPath];
    if (!commandBarState) return;
    const diffIdx = commandBarState.diffIdx ?? 0;
    const diffid = commandBarState.sortedDiffIds[diffIdx];
    if (!diffid) return;
    metricsService.capture("Reject Diff", { diffid, keyboard: true });
    editCodeService.rejectDiff({ diffid: parseInt(diffid) });
    const nextDiffIdx = commandBarService.getNextDiffIdx(1);
    if (nextDiffIdx !== null) {
      commandBarService.goToDiffIdx(nextDiffIdx);
    }
  }
});
registerAction2(class extends Action2 {
  constructor() {
    super({
      id: VOID_GOTO_NEXT_DIFF_ACTION_ID,
      f1: true,
      title: localize2("voidGoToNextDiffAction", "Plaxio: Go to Next Diff"),
      keybinding: {
        primary: KeyMod.CtrlCmd | KeyMod.Alt | KeyMod.Shift | KeyCode.DownArrow,
        mac: { primary: KeyMod.WinCtrl | KeyMod.Alt | KeyCode.DownArrow },
        weight: KeybindingWeight.VoidExtension
      }
    });
  }
  async run(accessor) {
    const commandBarService = accessor.get(IVoidCommandBarService);
    const metricsService = accessor.get(IMetricsService);
    const nextDiffIdx = commandBarService.getNextDiffIdx(1);
    if (nextDiffIdx === null) return;
    metricsService.capture("Navigate Diff", { direction: "next", keyboard: true });
    commandBarService.goToDiffIdx(nextDiffIdx);
  }
});
registerAction2(class extends Action2 {
  constructor() {
    super({
      id: VOID_GOTO_PREV_DIFF_ACTION_ID,
      f1: true,
      title: localize2("voidGoToPrevDiffAction", "Plaxio: Go to Previous Diff"),
      keybinding: {
        primary: KeyMod.CtrlCmd | KeyMod.Alt | KeyMod.Shift | KeyCode.UpArrow,
        mac: { primary: KeyMod.WinCtrl | KeyMod.Alt | KeyCode.UpArrow },
        weight: KeybindingWeight.VoidExtension
      }
    });
  }
  async run(accessor) {
    const commandBarService = accessor.get(IVoidCommandBarService);
    const metricsService = accessor.get(IMetricsService);
    const prevDiffIdx = commandBarService.getNextDiffIdx(-1);
    if (prevDiffIdx === null) return;
    metricsService.capture("Navigate Diff", { direction: "previous", keyboard: true });
    commandBarService.goToDiffIdx(prevDiffIdx);
  }
});
registerAction2(class extends Action2 {
  constructor() {
    super({
      id: VOID_GOTO_NEXT_URI_ACTION_ID,
      f1: true,
      title: localize2("voidGoToNextUriAction", "Plaxio: Go to Next File with Diffs"),
      keybinding: {
        primary: KeyMod.CtrlCmd | KeyMod.Alt | KeyMod.Shift | KeyCode.RightArrow,
        mac: { primary: KeyMod.WinCtrl | KeyMod.Alt | KeyCode.RightArrow },
        weight: KeybindingWeight.VoidExtension
      }
    });
  }
  async run(accessor) {
    const commandBarService = accessor.get(IVoidCommandBarService);
    const metricsService = accessor.get(IMetricsService);
    const nextUriIdx = commandBarService.getNextUriIdx(1);
    if (nextUriIdx === null) return;
    metricsService.capture("Navigate URI", { direction: "next", keyboard: true });
    await commandBarService.goToURIIdx(nextUriIdx);
  }
});
registerAction2(class extends Action2 {
  constructor() {
    super({
      id: VOID_GOTO_PREV_URI_ACTION_ID,
      f1: true,
      title: localize2("voidGoToPrevUriAction", "Plaxio: Go to Previous File with Diffs"),
      keybinding: {
        primary: KeyMod.CtrlCmd | KeyMod.Alt | KeyMod.Shift | KeyCode.LeftArrow,
        mac: { primary: KeyMod.WinCtrl | KeyMod.Alt | KeyCode.LeftArrow },
        weight: KeybindingWeight.VoidExtension
      }
    });
  }
  async run(accessor) {
    const commandBarService = accessor.get(IVoidCommandBarService);
    const metricsService = accessor.get(IMetricsService);
    const prevUriIdx = commandBarService.getNextUriIdx(-1);
    if (prevUriIdx === null) return;
    metricsService.capture("Navigate URI", { direction: "previous", keyboard: true });
    await commandBarService.goToURIIdx(prevUriIdx);
  }
});
registerAction2(class extends Action2 {
  constructor() {
    super({
      id: VOID_ACCEPT_FILE_ACTION_ID,
      f1: true,
      title: localize2("voidAcceptFileAction", "Plaxio: Accept All Diffs in Current File"),
      keybinding: {
        primary: KeyMod.Alt | KeyMod.Shift | KeyCode.Enter,
        weight: KeybindingWeight.VoidExtension
      }
    });
  }
  async run(accessor) {
    const commandBarService = accessor.get(IVoidCommandBarService);
    const editCodeService = accessor.get(IEditCodeService);
    const metricsService = accessor.get(IMetricsService);
    const activeURI = commandBarService.activeURI;
    if (!activeURI) return;
    metricsService.capture("Accept File", { keyboard: true });
    editCodeService.acceptOrRejectAllDiffAreas({
      uri: activeURI,
      behavior: "accept",
      removeCtrlKs: true
    });
  }
});
registerAction2(class extends Action2 {
  constructor() {
    super({
      id: VOID_REJECT_FILE_ACTION_ID,
      f1: true,
      title: localize2("voidRejectFileAction", "Plaxio: Reject All Diffs in Current File"),
      keybinding: {
        primary: KeyMod.Alt | KeyMod.Shift | KeyCode.Backspace,
        weight: KeybindingWeight.VoidExtension
      }
    });
  }
  async run(accessor) {
    const commandBarService = accessor.get(IVoidCommandBarService);
    const editCodeService = accessor.get(IEditCodeService);
    const metricsService = accessor.get(IMetricsService);
    const activeURI = commandBarService.activeURI;
    if (!activeURI) return;
    metricsService.capture("Reject File", { keyboard: true });
    editCodeService.acceptOrRejectAllDiffAreas({
      uri: activeURI,
      behavior: "reject",
      removeCtrlKs: true
    });
  }
});
registerAction2(class extends Action2 {
  constructor() {
    super({
      id: VOID_ACCEPT_ALL_DIFFS_ACTION_ID,
      f1: true,
      title: localize2("voidAcceptAllDiffsAction", "Plaxio: Accept All Diffs in All Files"),
      keybinding: {
        primary: KeyMod.CtrlCmd | KeyMod.Shift | KeyCode.Enter,
        weight: KeybindingWeight.VoidExtension
      }
    });
  }
  async run(accessor) {
    const commandBarService = accessor.get(IVoidCommandBarService);
    const metricsService = accessor.get(IMetricsService);
    if (commandBarService.anyFileIsStreaming()) return;
    metricsService.capture("Accept All Files", { keyboard: true });
    commandBarService.acceptOrRejectAllFiles({ behavior: "accept" });
  }
});
registerAction2(class extends Action2 {
  constructor() {
    super({
      id: VOID_REJECT_ALL_DIFFS_ACTION_ID,
      f1: true,
      title: localize2("voidRejectAllDiffsAction", "Plaxio: Reject All Diffs in All Files"),
      keybinding: {
        primary: KeyMod.CtrlCmd | KeyMod.Shift | KeyCode.Backspace,
        weight: KeybindingWeight.VoidExtension
      }
    });
  }
  async run(accessor) {
    const commandBarService = accessor.get(IVoidCommandBarService);
    const metricsService = accessor.get(IMetricsService);
    if (commandBarService.anyFileIsStreaming()) return;
    metricsService.capture("Reject All Files", { keyboard: true });
    commandBarService.acceptOrRejectAllFiles({ behavior: "reject" });
  }
});
export {
  IVoidCommandBarService,
  VoidCommandBarService
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvY29udHJpYi92b2lkL2Jyb3dzZXIvdm9pZENvbW1hbmRCYXJTZXJ2aWNlLnRzIl0sCiAgInNvdXJjZXNDb250ZW50IjogWyIvKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG4gKiAgQ29weXJpZ2h0IDIwMjUgR2xhc3MgRGV2dG9vbHMsIEluYy4gQWxsIHJpZ2h0cyByZXNlcnZlZC5cbiAqICBMaWNlbnNlZCB1bmRlciB0aGUgQXBhY2hlIExpY2Vuc2UsIFZlcnNpb24gMi4wLiBTZWUgTElDRU5TRS50eHQgZm9yIG1vcmUgaW5mb3JtYXRpb24uXG4gKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tKi9cblxuaW1wb3J0IHsgRGlzcG9zYWJsZSwgSURpc3Bvc2FibGUsIHRvRGlzcG9zYWJsZSB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2xpZmVjeWNsZS5qcyc7XG5pbXBvcnQgeyBjcmVhdGVEZWNvcmF0b3IsIElJbnN0YW50aWF0aW9uU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL2luc3RhbnRpYXRpb24vY29tbW9uL2luc3RhbnRpYXRpb24uanMnO1xuaW1wb3J0IHsgVVJJIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vdXJpLmpzJztcbmltcG9ydCAqIGFzIGRvbSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2Jyb3dzZXIvZG9tLmpzJztcbmltcG9ydCB7IFdpZGdldCB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvYnJvd3Nlci91aS93aWRnZXQuanMnO1xuaW1wb3J0IHsgSU92ZXJsYXlXaWRnZXQsIElDb2RlRWRpdG9yLCBPdmVybGF5V2lkZ2V0UG9zaXRpb25QcmVmZXJlbmNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vZWRpdG9yL2Jyb3dzZXIvZWRpdG9yQnJvd3Nlci5qcyc7XG5pbXBvcnQgeyBFbWl0dGVyLCBFdmVudCB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2V2ZW50LmpzJztcbmltcG9ydCB7IElDb2RlRWRpdG9yU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uL2VkaXRvci9icm93c2VyL3NlcnZpY2VzL2NvZGVFZGl0b3JTZXJ2aWNlLmpzJztcbmltcG9ydCB7IG1vdW50Vm9pZENvbW1hbmRCYXIgfSBmcm9tICcuL3JlYWN0L291dC92b2lkLWVkaXRvci13aWRnZXRzLXRzeC9pbmRleC5qcydcbmltcG9ydCB7IGRlZXBDbG9uZSB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL29iamVjdHMuanMnO1xuaW1wb3J0IHsgSW5zdGFudGlhdGlvblR5cGUsIHJlZ2lzdGVyU2luZ2xldG9uIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vaW5zdGFudGlhdGlvbi9jb21tb24vZXh0ZW5zaW9ucy5qcyc7XG5pbXBvcnQgeyBJRWRpdENvZGVTZXJ2aWNlIH0gZnJvbSAnLi9lZGl0Q29kZVNlcnZpY2VJbnRlcmZhY2UuanMnO1xuaW1wb3J0IHsgSVRleHRNb2RlbCB9IGZyb20gJy4uLy4uLy4uLy4uL2VkaXRvci9jb21tb24vbW9kZWwuanMnO1xuaW1wb3J0IHsgSU1vZGVsU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uL2VkaXRvci9jb21tb24vc2VydmljZXMvbW9kZWwuanMnO1xuaW1wb3J0IHsgZ2VuZXJhdGVVdWlkIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vdXVpZC5qcyc7XG5pbXBvcnQgeyBBY3Rpb24yLCByZWdpc3RlckFjdGlvbjIgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9hY3Rpb25zL2NvbW1vbi9hY3Rpb25zLmpzJztcbmltcG9ydCB7IFZPSURfQUNDRVBUX0RJRkZfQUNUSU9OX0lELCBWT0lEX1JFSkVDVF9ESUZGX0FDVElPTl9JRCwgVk9JRF9HT1RPX05FWFRfRElGRl9BQ1RJT05fSUQsIFZPSURfR09UT19QUkVWX0RJRkZfQUNUSU9OX0lELCBWT0lEX0dPVE9fTkVYVF9VUklfQUNUSU9OX0lELCBWT0lEX0dPVE9fUFJFVl9VUklfQUNUSU9OX0lELCBWT0lEX0FDQ0VQVF9GSUxFX0FDVElPTl9JRCwgVk9JRF9SRUpFQ1RfRklMRV9BQ1RJT05fSUQsIFZPSURfQUNDRVBUX0FMTF9ESUZGU19BQ1RJT05fSUQsIFZPSURfUkVKRUNUX0FMTF9ESUZGU19BQ1RJT05fSUQgfSBmcm9tICcuL2FjdGlvbklEcy5qcyc7XG5pbXBvcnQgeyBsb2NhbGl6ZTIgfSBmcm9tICcuLi8uLi8uLi8uLi9ubHMuanMnO1xuaW1wb3J0IHsgS2V5YmluZGluZ1dlaWdodCB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL2tleWJpbmRpbmcvY29tbW9uL2tleWJpbmRpbmdzUmVnaXN0cnkuanMnO1xuaW1wb3J0IHsgU2VydmljZXNBY2Nlc3NvciB9IGZyb20gJy4uLy4uLy4uLy4uL2VkaXRvci9icm93c2VyL2VkaXRvckV4dGVuc2lvbnMuanMnO1xuaW1wb3J0IHsgSU1ldHJpY3NTZXJ2aWNlIH0gZnJvbSAnLi4vY29tbW9uL21ldHJpY3NTZXJ2aWNlLmpzJztcbmltcG9ydCB7IEtleU1vZCB9IGZyb20gJy4uLy4uLy4uLy4uL2VkaXRvci9jb21tb24vc2VydmljZXMvZWRpdG9yQmFzZUFwaS5qcyc7XG5pbXBvcnQgeyBLZXlDb2RlIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24va2V5Q29kZXMuanMnO1xuaW1wb3J0IHsgU2Nyb2xsVHlwZSB9IGZyb20gJy4uLy4uLy4uLy4uL2VkaXRvci9jb21tb24vZWRpdG9yQ29tbW9uLmpzJztcbmltcG9ydCB7IElWb2lkTW9kZWxTZXJ2aWNlIH0gZnJvbSAnLi4vY29tbW9uL3ZvaWRNb2RlbFNlcnZpY2UuanMnO1xuXG5cblxuZXhwb3J0IGludGVyZmFjZSBJVm9pZENvbW1hbmRCYXJTZXJ2aWNlIHtcblx0cmVhZG9ubHkgX3NlcnZpY2VCcmFuZDogdW5kZWZpbmVkO1xuXHRzdGF0ZU9mVVJJOiB7IFt1cmk6IHN0cmluZ106IENvbW1hbmRCYXJTdGF0ZVR5cGUgfTtcblx0c29ydGVkVVJJczogVVJJW107XG5cdGFjdGl2ZVVSSTogVVJJIHwgbnVsbDtcblxuXHRvbkRpZENoYW5nZVN0YXRlOiBFdmVudDx7IHVyaTogVVJJIH0+O1xuXHRvbkRpZENoYW5nZUFjdGl2ZVVSSTogRXZlbnQ8eyB1cmk6IFVSSSB8IG51bGwgfT47XG5cblx0Z2V0U3RyZWFtU3RhdGU6ICh1cmk6IFVSSSkgPT4gJ3N0cmVhbWluZycgfCAnaWRsZS1oYXMtY2hhbmdlcycgfCAnaWRsZS1uby1jaGFuZ2VzJztcblx0c2V0RGlmZklkeCh1cmk6IFVSSSwgbmV3SWR4OiBudW1iZXIgfCBudWxsKTogdm9pZDtcblxuXHRnZXROZXh0RGlmZklkeChzdGVwOiAxIHwgLTEpOiBudW1iZXIgfCBudWxsO1xuXHRnZXROZXh0VXJpSWR4KHN0ZXA6IDEgfCAtMSk6IG51bWJlciB8IG51bGw7XG5cdGdvVG9EaWZmSWR4KGlkeDogbnVtYmVyIHwgbnVsbCk6IHZvaWQ7XG5cdGdvVG9VUklJZHgoaWR4OiBudW1iZXIgfCBudWxsKTogUHJvbWlzZTx2b2lkPjtcblxuXHRhY2NlcHRPclJlamVjdEFsbEZpbGVzKG9wdHM6IHsgYmVoYXZpb3I6ICdyZWplY3QnIHwgJ2FjY2VwdCcgfSk6IHZvaWQ7XG5cdGFueUZpbGVJc1N0cmVhbWluZygpOiBib29sZWFuO1xuXG59XG5cblxuZXhwb3J0IGNvbnN0IElWb2lkQ29tbWFuZEJhclNlcnZpY2UgPSBjcmVhdGVEZWNvcmF0b3I8SVZvaWRDb21tYW5kQmFyU2VydmljZT4oJ1ZvaWRDb21tYW5kQmFyU2VydmljZScpO1xuXG5cbmV4cG9ydCB0eXBlIENvbW1hbmRCYXJTdGF0ZVR5cGUgPSB1bmRlZmluZWQgfCB7XG5cdHNvcnRlZERpZmZab25lSWRzOiBzdHJpbmdbXTsgLy8gc29ydGVkIGJ5IGxpbmUgbnVtYmVyXG5cdHNvcnRlZERpZmZJZHM6IHN0cmluZ1tdOyAvLyBzb3J0ZWQgYnkgbGluZSBudW1iZXIgKGNvbXB1dGVkKVxuXHRpc1N0cmVhbWluZzogYm9vbGVhbjsgLy8gaXMgYW55IGRpZmZab25lIHN0cmVhbWluZyBpbiB0aGlzIFVSSVxuXG5cdGRpZmZJZHg6IG51bWJlciB8IG51bGw7IC8vIG11c3QgcmVmcmVzaCB3aGVuZXZlciBzb3J0ZWREaWZmSWRzIGRvZXMgc28gaXQncyB2YWxpZFxufVxuXG5cblxuY29uc3QgZGVmYXVsdFN0YXRlOiBOb25OdWxsYWJsZTxDb21tYW5kQmFyU3RhdGVUeXBlPiA9IHtcblx0c29ydGVkRGlmZlpvbmVJZHM6IFtdLFxuXHRzb3J0ZWREaWZmSWRzOiBbXSxcblx0aXNTdHJlYW1pbmc6IGZhbHNlLFxuXHRkaWZmSWR4OiBudWxsLFxufVxuXG5cbmV4cG9ydCBjbGFzcyBWb2lkQ29tbWFuZEJhclNlcnZpY2UgZXh0ZW5kcyBEaXNwb3NhYmxlIGltcGxlbWVudHMgSVZvaWRDb21tYW5kQmFyU2VydmljZSB7XG5cdF9zZXJ2aWNlQnJhbmQ6IHVuZGVmaW5lZDtcblxuXHRzdGF0aWMgcmVhZG9ubHkgSUQ6ICd2b2lkLlZvaWRDb21tYW5kQmFyU2VydmljZSdcblxuXHQvLyBkZXBlbmRzIG9uIHVyaSAtPiBkaWZmWm9uZSAtPiB7c3RyZWFtaW5nLCBkaWZmc31cblx0cHVibGljIHN0YXRlT2ZVUkk6IHsgW3VyaTogc3RyaW5nXTogQ29tbWFuZEJhclN0YXRlVHlwZSB9ID0ge31cblx0cHVibGljIHNvcnRlZFVSSXM6IFVSSVtdID0gW10gLy8ga2V5cyBvZiBzdGF0ZSAoZGVwZW5kcyBvbiBkaWZmWm9uZXMgaW4gdGhlIHVyaSlcblx0cHJpdmF0ZSByZWFkb25seSBfbGlzdGVuVG9UaGVzZVVSSXMgPSBuZXcgU2V0PFVSST4oKSAvLyB1cmlGc1BhdGhzXG5cblx0Ly8gRW1pdHMgd2hlbiBhIFVSSSdzIHN0cmVhbSBzdGF0ZSBjaGFuZ2VzIGJldHdlZW4gaWRsZSwgc3RyZWFtaW5nLCBhbmQgYWNjZXB0UmVqZWN0QWxsXG5cdHByaXZhdGUgcmVhZG9ubHkgX29uRGlkQ2hhbmdlU3RhdGUgPSBuZXcgRW1pdHRlcjx7IHVyaTogVVJJIH0+KCk7XG5cdHJlYWRvbmx5IG9uRGlkQ2hhbmdlU3RhdGUgPSB0aGlzLl9vbkRpZENoYW5nZVN0YXRlLmV2ZW50O1xuXG5cblx0Ly8gYWN0aXZlIFVSSVxuXHRhY3RpdmVVUkk6IFVSSSB8IG51bGwgPSBudWxsO1xuXHRwcml2YXRlIHJlYWRvbmx5IF9vbkRpZENoYW5nZUFjdGl2ZVVSSSA9IG5ldyBFbWl0dGVyPHsgdXJpOiBVUkkgfCBudWxsIH0+KCk7XG5cdHJlYWRvbmx5IG9uRGlkQ2hhbmdlQWN0aXZlVVJJID0gdGhpcy5fb25EaWRDaGFuZ2VBY3RpdmVVUkkuZXZlbnQ7XG5cblx0Y29uc3RydWN0b3IoXG5cdFx0QElJbnN0YW50aWF0aW9uU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IF9pbnN0YW50aWF0aW9uU2VydmljZTogSUluc3RhbnRpYXRpb25TZXJ2aWNlLFxuXHRcdEBJQ29kZUVkaXRvclNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBfY29kZUVkaXRvclNlcnZpY2U6IElDb2RlRWRpdG9yU2VydmljZSxcblx0XHRASU1vZGVsU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IF9tb2RlbFNlcnZpY2U6IElNb2RlbFNlcnZpY2UsXG5cdFx0QElFZGl0Q29kZVNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBfZWRpdENvZGVTZXJ2aWNlOiBJRWRpdENvZGVTZXJ2aWNlLFxuXHRcdEBJVm9pZE1vZGVsU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IF92b2lkTW9kZWxTZXJ2aWNlOiBJVm9pZE1vZGVsU2VydmljZSxcblx0KSB7XG5cdFx0c3VwZXIoKTtcblxuXG5cdFx0Y29uc3QgcmVnaXN0ZXJlZE1vZGVsVVJJcyA9IG5ldyBTZXQ8c3RyaW5nPigpXG5cdFx0Y29uc3QgaW5pdGlhbGl6ZU1vZGVsID0gYXN5bmMgKG1vZGVsOiBJVGV4dE1vZGVsKSA9PiB7XG5cdFx0XHQvLyBkbyBub3QgYWRkIGxpc3RlbmVycyB0byB0aGUgc2FtZSBtb2RlbCB0d2ljZSAtIGltcG9ydGFudCwgb3Igd2lsbCBzZWUgZHVwbGljYXRlc1xuXHRcdFx0aWYgKHJlZ2lzdGVyZWRNb2RlbFVSSXMuaGFzKG1vZGVsLnVyaS5mc1BhdGgpKSByZXR1cm5cblx0XHRcdHJlZ2lzdGVyZWRNb2RlbFVSSXMuYWRkKG1vZGVsLnVyaS5mc1BhdGgpXG5cdFx0XHR0aGlzLl9saXN0ZW5Ub1RoZXNlVVJJcy5hZGQobW9kZWwudXJpKVxuXHRcdH1cblx0XHQvLyBpbml0aWFsaXplIGFsbCBleGlzdGluZyBtb2RlbHMgKyBpbml0aWFsaXplIHdoZW4gYSBuZXcgbW9kZWwgbW91bnRzXG5cdFx0dGhpcy5fbW9kZWxTZXJ2aWNlLmdldE1vZGVscygpLmZvckVhY2gobW9kZWwgPT4geyBpbml0aWFsaXplTW9kZWwobW9kZWwpIH0pXG5cdFx0dGhpcy5fcmVnaXN0ZXIodGhpcy5fbW9kZWxTZXJ2aWNlLm9uTW9kZWxBZGRlZChtb2RlbCA9PiB7IGluaXRpYWxpemVNb2RlbChtb2RlbCkgfSkpO1xuXG5cblxuXG5cblxuXHRcdC8vIGZvciBldmVyeSBuZXcgZWRpdG9yLCBhZGQgdGhlIGZsb2F0aW5nIHdpZGdldCBhbmQgdXBkYXRlIGFjdGl2ZSBVUklcblx0XHRjb25zdCBkaXNwb3NhYmxlc09mRWRpdG9ySWQ6IHsgW2VkaXRvcklkOiBzdHJpbmddOiBJRGlzcG9zYWJsZVtdIH0gPSB7fTtcblx0XHRjb25zdCBvbkNvZGVFZGl0b3JBZGQgPSAoZWRpdG9yOiBJQ29kZUVkaXRvcikgPT4ge1xuXHRcdFx0Y29uc3QgaWQgPSBlZGl0b3IuZ2V0SWQoKTtcblx0XHRcdGRpc3Bvc2FibGVzT2ZFZGl0b3JJZFtpZF0gPSBbXTtcblxuXHRcdFx0Ly8gbW91bnQgdGhlIGNvbW1hbmQgYmFyXG5cdFx0XHRjb25zdCBkMSA9IHRoaXMuX2luc3RhbnRpYXRpb25TZXJ2aWNlLmNyZWF0ZUluc3RhbmNlKEFjY2VwdFJlamVjdEFsbEZsb2F0aW5nV2lkZ2V0LCB7IGVkaXRvciB9KTtcblx0XHRcdGRpc3Bvc2FibGVzT2ZFZGl0b3JJZFtpZF0ucHVzaChkMSk7XG5cdFx0XHRjb25zdCBkMiA9IGVkaXRvci5vbkRpZENoYW5nZU1vZGVsKChlKSA9PiB7XG5cdFx0XHRcdGlmIChlLm5ld01vZGVsVXJsPy5zY2hlbWUgIT09ICdmaWxlJykgcmV0dXJuXG5cdFx0XHRcdHRoaXMuYWN0aXZlVVJJID0gZS5uZXdNb2RlbFVybDtcblx0XHRcdFx0dGhpcy5fb25EaWRDaGFuZ2VBY3RpdmVVUkkuZmlyZSh7IHVyaTogZS5uZXdNb2RlbFVybCB9KVxuXHRcdFx0fSlcblx0XHRcdGRpc3Bvc2FibGVzT2ZFZGl0b3JJZFtpZF0ucHVzaChkMik7XG5cdFx0fVxuXHRcdGNvbnN0IG9uQ29kZUVkaXRvclJlbW92ZSA9IChlZGl0b3I6IElDb2RlRWRpdG9yKSA9PiB7XG5cdFx0XHRjb25zdCBpZCA9IGVkaXRvci5nZXRJZCgpO1xuXHRcdFx0aWYgKGRpc3Bvc2FibGVzT2ZFZGl0b3JJZFtpZF0pIHtcblx0XHRcdFx0ZGlzcG9zYWJsZXNPZkVkaXRvcklkW2lkXS5mb3JFYWNoKGQgPT4gZC5kaXNwb3NlKCkpO1xuXHRcdFx0XHRkZWxldGUgZGlzcG9zYWJsZXNPZkVkaXRvcklkW2lkXTtcblx0XHRcdH1cblx0XHR9XG5cdFx0dGhpcy5fcmVnaXN0ZXIodGhpcy5fY29kZUVkaXRvclNlcnZpY2Uub25Db2RlRWRpdG9yQWRkKChlZGl0b3IpID0+IHsgb25Db2RlRWRpdG9yQWRkKGVkaXRvcikgfSkpXG5cdFx0dGhpcy5fcmVnaXN0ZXIodGhpcy5fY29kZUVkaXRvclNlcnZpY2Uub25Db2RlRWRpdG9yUmVtb3ZlKChlZGl0b3IpID0+IHsgb25Db2RlRWRpdG9yUmVtb3ZlKGVkaXRvcikgfSkpXG5cdFx0dGhpcy5fY29kZUVkaXRvclNlcnZpY2UubGlzdENvZGVFZGl0b3JzKCkuZm9yRWFjaChlZGl0b3IgPT4geyBvbkNvZGVFZGl0b3JBZGQoZWRpdG9yKSB9KVxuXG5cdFx0Ly8gc3RhdGUgdXBkYXRlcnNcblx0XHR0aGlzLl9yZWdpc3Rlcih0aGlzLl9lZGl0Q29kZVNlcnZpY2Uub25EaWRBZGRPckRlbGV0ZURpZmZab25lcyhlID0+IHtcblx0XHRcdGZvciAoY29uc3QgdXJpIG9mIHRoaXMuX2xpc3RlblRvVGhlc2VVUklzKSB7XG5cdFx0XHRcdGlmIChlLnVyaS5mc1BhdGggIT09IHVyaS5mc1BhdGgpIGNvbnRpbnVlXG5cdFx0XHRcdC8vIC0tLSBzb3J0ZWRVUklzOiBkZWxldGUgaWYgZW1wdHksIGFkZCBpZiBub3QgaW4gc3RhdGUgeWV0XG5cdFx0XHRcdGNvbnN0IGRpZmZab25lcyA9IHRoaXMuX2dldERpZmZab25lc09uVVJJKHVyaSlcblx0XHRcdFx0aWYgKGRpZmZab25lcy5sZW5ndGggPT09IDApIHtcblx0XHRcdFx0XHR0aGlzLl9kZWxldGVVUklFbnRyeUZyb21TdGF0ZSh1cmkpXG5cdFx0XHRcdFx0dGhpcy5fb25EaWRDaGFuZ2VTdGF0ZS5maXJlKHsgdXJpIH0pXG5cdFx0XHRcdFx0Y29udGludWUgLy8gZGVsZXRlZCwgc28gZG9uZVxuXHRcdFx0XHR9XG5cdFx0XHRcdGlmICghdGhpcy5zb3J0ZWRVUklzLmZpbmQodXJpMiA9PiB1cmkyLmZzUGF0aCA9PT0gdXJpLmZzUGF0aCkpIHtcblx0XHRcdFx0XHR0aGlzLl9hZGRVUklFbnRyeVRvU3RhdGUodXJpKVxuXHRcdFx0XHR9XG5cblx0XHRcdFx0Y29uc3QgY3VyclN0YXRlID0gdGhpcy5zdGF0ZU9mVVJJW3VyaS5mc1BhdGhdXG5cdFx0XHRcdGlmICghY3VyclN0YXRlKSBjb250aW51ZSAvLyBzaG91bGQgbmV2ZXIgaGFwcGVuXG5cdFx0XHRcdC8vIHVwZGF0ZSBzdGF0ZSBvZiB0aGUgZGlmZlpvbmVzIG9uIHRoaXMgVVJJXG5cdFx0XHRcdGNvbnN0IG9sZERpZmZab25lcyA9IGN1cnJTdGF0ZS5zb3J0ZWREaWZmWm9uZUlkc1xuXHRcdFx0XHRjb25zdCBjdXJyZW50RGlmZlpvbmVzID0gdGhpcy5fZWRpdENvZGVTZXJ2aWNlLmRpZmZBcmVhc09mVVJJW3VyaS5mc1BhdGhdIHx8IFtdIC8vIGEgU2V0XG5cdFx0XHRcdGNvbnN0IHsgYWRkZWREaWZmWm9uZXMsIGRlbGV0ZWREaWZmWm9uZXMgfSA9IHRoaXMuX2dldERpZmZab25lQ2hhbmdlcyhvbGREaWZmWm9uZXMsIGN1cnJlbnREaWZmWm9uZXMgfHwgW10pXG5cblx0XHRcdFx0Y29uc3QgZGlmZlpvbmVzV2l0aG91dERlbGV0ZWQgPSBvbGREaWZmWm9uZXMuZmlsdGVyKG9sZGRpZmZhcmVhaWQgPT4gIWRlbGV0ZWREaWZmWm9uZXMuaGFzKG9sZGRpZmZhcmVhaWQpKVxuXG5cdFx0XHRcdC8vIC0tLSBuZXcgc3RhdGU6XG5cdFx0XHRcdGNvbnN0IG5ld1NvcnRlZERpZmZab25lSWRzID0gW1xuXHRcdFx0XHRcdC4uLmRpZmZab25lc1dpdGhvdXREZWxldGVkLFxuXHRcdFx0XHRcdC4uLmFkZGVkRGlmZlpvbmVzLFxuXHRcdFx0XHRdXG5cdFx0XHRcdGNvbnN0IG5ld1NvcnRlZERpZmZJZHMgPSB0aGlzLl9jb21wdXRlU29ydGVkRGlmZnMobmV3U29ydGVkRGlmZlpvbmVJZHMpXG5cdFx0XHRcdGNvbnN0IGlzU3RyZWFtaW5nID0gdGhpcy5faXNBbnlEaWZmWm9uZVN0cmVhbWluZyhjdXJyZW50RGlmZlpvbmVzKVxuXG5cdFx0XHRcdC8vIFdoZW4gZGlmZlpvbmVzIGFyZSBhZGRlZC9yZW1vdmVkLCByZXNldCB0aGUgZGlmZklkeCB0byAwIGlmIHdlIGhhdmUgZGlmZnNcblx0XHRcdFx0Y29uc3QgbmV3RGlmZklkeCA9IG5ld1NvcnRlZERpZmZJZHMubGVuZ3RoID4gMCA/IDAgOiBudWxsO1xuXG5cdFx0XHRcdHRoaXMuX3NldFN0YXRlKHVyaSwge1xuXHRcdFx0XHRcdHNvcnRlZERpZmZab25lSWRzOiBuZXdTb3J0ZWREaWZmWm9uZUlkcyxcblx0XHRcdFx0XHRzb3J0ZWREaWZmSWRzOiBuZXdTb3J0ZWREaWZmSWRzLFxuXHRcdFx0XHRcdGlzU3RyZWFtaW5nOiBpc1N0cmVhbWluZyxcblx0XHRcdFx0XHRkaWZmSWR4OiBuZXdEaWZmSWR4XG5cdFx0XHRcdH0pXG5cdFx0XHRcdHRoaXMuX29uRGlkQ2hhbmdlU3RhdGUuZmlyZSh7IHVyaSB9KVxuXHRcdFx0fVxuXG5cdFx0fSkpXG5cdFx0dGhpcy5fcmVnaXN0ZXIodGhpcy5fZWRpdENvZGVTZXJ2aWNlLm9uRGlkQ2hhbmdlRGlmZnNJbkRpZmZab25lTm90U3RyZWFtaW5nKGUgPT4ge1xuXHRcdFx0Zm9yIChjb25zdCB1cmkgb2YgdGhpcy5fbGlzdGVuVG9UaGVzZVVSSXMpIHtcblx0XHRcdFx0aWYgKGUudXJpLmZzUGF0aCAhPT0gdXJpLmZzUGF0aCkgY29udGludWVcblx0XHRcdFx0Ly8gLS0tIHNvcnRlZFVSSXM6IG5vIGNoYW5nZVxuXHRcdFx0XHQvLyAtLS0gc3RhdGU6XG5cdFx0XHRcdC8vIHNvcnRlZERpZmZJZHMgZ2V0cyBhIGNoYW5nZSB0byBpdCwgc28gZ2V0cyByZWNvbXB1dGVkXG5cdFx0XHRcdGNvbnN0IGN1cnJTdGF0ZSA9IHRoaXMuc3RhdGVPZlVSSVt1cmkuZnNQYXRoXVxuXHRcdFx0XHRpZiAoIWN1cnJTdGF0ZSkgY29udGludWUgLy8gc2hvdWxkIG5ldmVyIGhhcHBlblxuXHRcdFx0XHRjb25zdCB7IHNvcnRlZERpZmZab25lSWRzIH0gPSBjdXJyU3RhdGVcblx0XHRcdFx0Y29uc3Qgb2xkU29ydGVkRGlmZklkcyA9IGN1cnJTdGF0ZS5zb3J0ZWREaWZmSWRzO1xuXHRcdFx0XHRjb25zdCBuZXdTb3J0ZWREaWZmSWRzID0gdGhpcy5fY29tcHV0ZVNvcnRlZERpZmZzKHNvcnRlZERpZmZab25lSWRzKVxuXG5cdFx0XHRcdC8vIEhhbmRsZSBkaWZmSWR4IGFkanVzdG1lbnQgd2hlbiBkaWZmcyBjaGFuZ2Vcblx0XHRcdFx0bGV0IG5ld0RpZmZJZHggPSBjdXJyU3RhdGUuZGlmZklkeDtcblxuXHRcdFx0XHQvLyBDaGVjayBpZiBkaWZmcyB3ZXJlIHJlbW92ZWRcblx0XHRcdFx0aWYgKG9sZFNvcnRlZERpZmZJZHMubGVuZ3RoID4gbmV3U29ydGVkRGlmZklkcy5sZW5ndGggJiYgY3VyclN0YXRlLmRpZmZJZHggIT09IG51bGwpIHtcblx0XHRcdFx0XHQvLyBJZiBjdXJyZW50bHkgc2VsZWN0ZWQgZGlmZiB3YXMgcmVtb3ZlZCBvciB3ZSBoYXZlIGZld2VyIGRpZmZzIHRoYW4gdGhlIGN1cnJlbnQgaW5kZXhcblx0XHRcdFx0XHRpZiAoY3VyclN0YXRlLmRpZmZJZHggPj0gbmV3U29ydGVkRGlmZklkcy5sZW5ndGgpIHtcblx0XHRcdFx0XHRcdC8vIFNlbGVjdCB0aGUgbGFzdCBkaWZmIGlmIGF2YWlsYWJsZSwgb3RoZXJ3aXNlIG51bGxcblx0XHRcdFx0XHRcdG5ld0RpZmZJZHggPSBuZXdTb3J0ZWREaWZmSWRzLmxlbmd0aCA+IDAgPyBuZXdTb3J0ZWREaWZmSWRzLmxlbmd0aCAtIDEgOiBudWxsO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0fVxuXG5cdFx0XHRcdHRoaXMuX3NldFN0YXRlKHVyaSwge1xuXHRcdFx0XHRcdHNvcnRlZERpZmZJZHM6IG5ld1NvcnRlZERpZmZJZHMsXG5cdFx0XHRcdFx0ZGlmZklkeDogbmV3RGlmZklkeFxuXHRcdFx0XHRcdC8vIHNvcnRlZERpZmZab25lSWRzLCAvLyBubyBjaGFuZ2Vcblx0XHRcdFx0XHQvLyBpc1N0cmVhbWluZywgLy8gbm8gY2hhbmdlXG5cdFx0XHRcdH0pXG5cdFx0XHRcdHRoaXMuX29uRGlkQ2hhbmdlU3RhdGUuZmlyZSh7IHVyaSB9KVxuXHRcdFx0fVxuXHRcdH0pKVxuXHRcdHRoaXMuX3JlZ2lzdGVyKHRoaXMuX2VkaXRDb2RlU2VydmljZS5vbkRpZENoYW5nZVN0cmVhbWluZ0luRGlmZlpvbmUoZSA9PiB7XG5cdFx0XHRmb3IgKGNvbnN0IHVyaSBvZiB0aGlzLl9saXN0ZW5Ub1RoZXNlVVJJcykge1xuXHRcdFx0XHRpZiAoZS51cmkuZnNQYXRoICE9PSB1cmkuZnNQYXRoKSBjb250aW51ZVxuXHRcdFx0XHQvLyAtLS0gc29ydGVkVVJJczogbm8gY2hhbmdlXG5cdFx0XHRcdC8vIC0tLSBzdGF0ZTpcblx0XHRcdFx0Y29uc3QgY3VyclN0YXRlID0gdGhpcy5zdGF0ZU9mVVJJW3VyaS5mc1BhdGhdXG5cdFx0XHRcdGlmICghY3VyclN0YXRlKSBjb250aW51ZSAvLyBzaG91bGQgbmV2ZXIgaGFwcGVuXG5cdFx0XHRcdGNvbnN0IHsgc29ydGVkRGlmZlpvbmVJZHMgfSA9IGN1cnJTdGF0ZVxuXHRcdFx0XHR0aGlzLl9zZXRTdGF0ZSh1cmksIHtcblx0XHRcdFx0XHRpc1N0cmVhbWluZzogdGhpcy5faXNBbnlEaWZmWm9uZVN0cmVhbWluZyhzb3J0ZWREaWZmWm9uZUlkcyksXG5cdFx0XHRcdFx0Ly8gc29ydGVkRGlmZklkcywgLy8gbm8gY2hhbmdlXG5cdFx0XHRcdFx0Ly8gc29ydGVkRGlmZlpvbmVJZHMsIC8vIG5vIGNoYW5nZVxuXHRcdFx0XHR9KVxuXHRcdFx0XHR0aGlzLl9vbkRpZENoYW5nZVN0YXRlLmZpcmUoeyB1cmkgfSlcblx0XHRcdH1cblx0XHR9KSlcblxuXHR9XG5cblxuXHRzZXREaWZmSWR4KHVyaTogVVJJLCBuZXdJZHg6IG51bWJlciB8IG51bGwpOiB2b2lkIHtcblx0XHR0aGlzLl9zZXRTdGF0ZSh1cmksIHsgZGlmZklkeDogbmV3SWR4IH0pO1xuXHRcdHRoaXMuX29uRGlkQ2hhbmdlU3RhdGUuZmlyZSh7IHVyaSB9KTtcblx0fVxuXG5cblx0Z2V0U3RyZWFtU3RhdGUodXJpOiBVUkkpIHtcblx0XHRjb25zdCB7IGlzU3RyZWFtaW5nLCBzb3J0ZWREaWZmWm9uZUlkcyB9ID0gdGhpcy5zdGF0ZU9mVVJJW3VyaS5mc1BhdGhdID8/IHt9XG5cdFx0aWYgKGlzU3RyZWFtaW5nKSB7XG5cdFx0XHRyZXR1cm4gJ3N0cmVhbWluZydcblx0XHR9XG5cdFx0aWYgKChzb3J0ZWREaWZmWm9uZUlkcz8ubGVuZ3RoID8/IDApID4gMCkge1xuXHRcdFx0cmV0dXJuICdpZGxlLWhhcy1jaGFuZ2VzJ1xuXHRcdH1cblx0XHRyZXR1cm4gJ2lkbGUtbm8tY2hhbmdlcydcblx0fVxuXG5cblx0X2NvbXB1dGVTb3J0ZWREaWZmcyhkaWZmYXJlYWlkczogc3RyaW5nW10pIHtcblx0XHRjb25zdCBzb3J0ZWREaWZmSWRzID0gW107XG5cdFx0Zm9yIChjb25zdCBkaWZmYXJlYWlkIG9mIGRpZmZhcmVhaWRzKSB7XG5cdFx0XHRjb25zdCBkaWZmWm9uZSA9IHRoaXMuX2VkaXRDb2RlU2VydmljZS5kaWZmQXJlYU9mSWRbZGlmZmFyZWFpZF07XG5cdFx0XHRpZiAoIWRpZmZab25lIHx8IGRpZmZab25lLnR5cGUgIT09ICdEaWZmWm9uZScpIHtcblx0XHRcdFx0Y29udGludWU7XG5cdFx0XHR9XG5cblx0XHRcdC8vIEFkZCBhbGwgZGlmZiBpZHMgZnJvbSB0aGlzIGRpZmZ6b25lXG5cdFx0XHRjb25zdCBkaWZmSWRzID0gT2JqZWN0LmtleXMoZGlmZlpvbmUuX2RpZmZPZklkKTtcblx0XHRcdHNvcnRlZERpZmZJZHMucHVzaCguLi5kaWZmSWRzKTtcblx0XHR9XG5cblx0XHRyZXR1cm4gc29ydGVkRGlmZklkcztcblx0fVxuXG5cdF9nZXREaWZmWm9uZUNoYW5nZXMob2xkRGlmZlpvbmVzOiBJdGVyYWJsZTxzdHJpbmc+LCBjdXJyZW50RGlmZlpvbmVzOiBJdGVyYWJsZTxzdHJpbmc+KSB7XG5cdFx0Ly8gRmluZCB0aGUgYWRkZWQgb3IgZGVsZXRlZCBkaWZmWm9uZXMgYnkgY29tcGFyaW5nIGRpZmZhcmVhaWRzXG5cdFx0Y29uc3QgYWRkZWREaWZmWm9uZUlkcyA9IG5ldyBTZXQ8c3RyaW5nPigpO1xuXHRcdGNvbnN0IGRlbGV0ZWREaWZmWm9uZUlkcyA9IG5ldyBTZXQ8c3RyaW5nPigpO1xuXG5cdFx0Ly8gQ29udmVydCB0aGUgY3VycmVudCBkaWZmWm9uZXMgdG8gYSBzZXQgb2YgaWRzIGZvciBlYXN5IGxvb2t1cFxuXHRcdGNvbnN0IGN1cnJlbnREaWZmWm9uZUlkU2V0ID0gbmV3IFNldChjdXJyZW50RGlmZlpvbmVzKTtcblxuXHRcdC8vIEZpbmQgZGVsZXRlZCBkaWZmWm9uZXMgKGluIG9sZCBidXQgbm90IGluIGN1cnJlbnQpXG5cdFx0Zm9yIChjb25zdCBvbGREaWZmWm9uZUlkIG9mIG9sZERpZmZab25lcykge1xuXHRcdFx0aWYgKCFjdXJyZW50RGlmZlpvbmVJZFNldC5oYXMob2xkRGlmZlpvbmVJZCkpIHtcblx0XHRcdFx0Y29uc3QgZGlmZlpvbmUgPSB0aGlzLl9lZGl0Q29kZVNlcnZpY2UuZGlmZkFyZWFPZklkW29sZERpZmZab25lSWRdO1xuXHRcdFx0XHRpZiAoZGlmZlpvbmUgJiYgZGlmZlpvbmUudHlwZSA9PT0gJ0RpZmZab25lJykge1xuXHRcdFx0XHRcdGRlbGV0ZWREaWZmWm9uZUlkcy5hZGQob2xkRGlmZlpvbmVJZCk7XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHR9XG5cblx0XHQvLyBGaW5kIGFkZGVkIGRpZmZab25lcyAoaW4gY3VycmVudCBidXQgbm90IGluIG9sZClcblx0XHRjb25zdCBvbGREaWZmWm9uZUlkU2V0ID0gbmV3IFNldChvbGREaWZmWm9uZXMpO1xuXHRcdGZvciAoY29uc3QgY3VycmVudERpZmZab25lSWQgb2YgY3VycmVudERpZmZab25lcykge1xuXHRcdFx0aWYgKCFvbGREaWZmWm9uZUlkU2V0LmhhcyhjdXJyZW50RGlmZlpvbmVJZCkpIHtcblx0XHRcdFx0Y29uc3QgZGlmZlpvbmUgPSB0aGlzLl9lZGl0Q29kZVNlcnZpY2UuZGlmZkFyZWFPZklkW2N1cnJlbnREaWZmWm9uZUlkXTtcblx0XHRcdFx0aWYgKGRpZmZab25lICYmIGRpZmZab25lLnR5cGUgPT09ICdEaWZmWm9uZScpIHtcblx0XHRcdFx0XHRhZGRlZERpZmZab25lSWRzLmFkZChjdXJyZW50RGlmZlpvbmVJZCk7XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHR9XG5cblx0XHRyZXR1cm4geyBhZGRlZERpZmZab25lczogYWRkZWREaWZmWm9uZUlkcywgZGVsZXRlZERpZmZab25lczogZGVsZXRlZERpZmZab25lSWRzIH1cblx0fVxuXG5cdF9pc0FueURpZmZab25lU3RyZWFtaW5nKGRpZmZhcmVhaWRzOiBJdGVyYWJsZTxzdHJpbmc+KSB7XG5cdFx0Zm9yIChjb25zdCBkaWZmYXJlYWlkIG9mIGRpZmZhcmVhaWRzKSB7XG5cdFx0XHRjb25zdCBkaWZmWm9uZSA9IHRoaXMuX2VkaXRDb2RlU2VydmljZS5kaWZmQXJlYU9mSWRbZGlmZmFyZWFpZF07XG5cdFx0XHRpZiAoIWRpZmZab25lIHx8IGRpZmZab25lLnR5cGUgIT09ICdEaWZmWm9uZScpIHtcblx0XHRcdFx0Y29udGludWU7XG5cdFx0XHR9XG5cdFx0XHRpZiAoZGlmZlpvbmUuX3N0cmVhbVN0YXRlLmlzU3RyZWFtaW5nKSB7XG5cdFx0XHRcdHJldHVybiB0cnVlO1xuXHRcdFx0fVxuXHRcdH1cblx0XHRyZXR1cm4gZmFsc2Vcblx0fVxuXG5cblx0X3NldFN0YXRlKHVyaTogVVJJLCBvcHRzOiBQYXJ0aWFsPENvbW1hbmRCYXJTdGF0ZVR5cGU+KSB7XG5cdFx0Y29uc3QgbmV3U3RhdGUgPSB7XG5cdFx0XHQuLi50aGlzLnN0YXRlT2ZVUklbdXJpLmZzUGF0aF0gPz8gZGVlcENsb25lKGRlZmF1bHRTdGF0ZSksXG5cdFx0XHQuLi5vcHRzXG5cdFx0fVxuXG5cdFx0Ly8gbWFrZSBzdXJlIGRpZmZJZHggaXMgYWx3YXlzIGNvcnJlY3Rcblx0XHRpZiAobmV3U3RhdGUuZGlmZklkeCAhPT0gbnVsbCAmJiBuZXdTdGF0ZS5kaWZmSWR4ID4gbmV3U3RhdGUuc29ydGVkRGlmZklkcy5sZW5ndGgpIHtcblx0XHRcdG5ld1N0YXRlLmRpZmZJZHggPSBuZXdTdGF0ZS5zb3J0ZWREaWZmSWRzLmxlbmd0aFxuXHRcdFx0aWYgKG5ld1N0YXRlLmRpZmZJZHggPD0gMCkgbmV3U3RhdGUuZGlmZklkeCA9IG51bGxcblx0XHR9XG5cblx0XHR0aGlzLnN0YXRlT2ZVUkkgPSB7XG5cdFx0XHQuLi50aGlzLnN0YXRlT2ZVUkksXG5cdFx0XHRbdXJpLmZzUGF0aF06IG5ld1N0YXRlXG5cdFx0fVxuXHR9XG5cblxuXHRfYWRkVVJJRW50cnlUb1N0YXRlKHVyaTogVVJJKSB7XG5cdFx0Ly8gYWRkIHRvIHNvcnRlZFVSSXNcblx0XHR0aGlzLnNvcnRlZFVSSXMgPSBbXG5cdFx0XHQuLi50aGlzLnNvcnRlZFVSSXMsXG5cdFx0XHR1cmlcblx0XHRdXG5cblx0XHQvLyBhZGQgdG8gc3RhdGVcblx0XHR0aGlzLnN0YXRlT2ZVUklbdXJpLmZzUGF0aF0gPSBkZWVwQ2xvbmUoZGVmYXVsdFN0YXRlKVxuXHR9XG5cblx0X2RlbGV0ZVVSSUVudHJ5RnJvbVN0YXRlKHVyaTogVVJJKSB7XG5cdFx0Ly8gZGVsZXRlIHRoaXMgZnJvbSBzb3J0ZWRVUklzXG5cdFx0Y29uc3QgaSA9IHRoaXMuc29ydGVkVVJJcy5maW5kSW5kZXgodXJpMiA9PiB1cmkyLmZzUGF0aCA9PT0gdXJpLmZzUGF0aClcblx0XHRpZiAoaSA9PT0gLTEpIHJldHVyblxuXHRcdHRoaXMuc29ydGVkVVJJcyA9IFtcblx0XHRcdC4uLnRoaXMuc29ydGVkVVJJcy5zbGljZSgwLCBpKSxcblx0XHRcdC4uLnRoaXMuc29ydGVkVVJJcy5zbGljZShpICsgMSwgSW5maW5pdHkpLFxuXHRcdF1cblx0XHQvLyBkZWxldGUgZnJvbSBzdGF0ZVxuXHRcdGRlbGV0ZSB0aGlzLnN0YXRlT2ZVUklbdXJpLmZzUGF0aF1cblx0fVxuXG5cblxuXHRwcml2YXRlIF9nZXREaWZmWm9uZXNPblVSSSh1cmk6IFVSSSkge1xuXHRcdGNvbnN0IGRpZmZab25lcyA9IFsuLi50aGlzLl9lZGl0Q29kZVNlcnZpY2UuZGlmZkFyZWFzT2ZVUklbdXJpLmZzUGF0aF0/LnZhbHVlcygpID8/IFtdXVxuXHRcdFx0Lm1hcChkaWZmYXJlYWlkID0+IHRoaXMuX2VkaXRDb2RlU2VydmljZS5kaWZmQXJlYU9mSWRbZGlmZmFyZWFpZF0pXG5cdFx0XHQuZmlsdGVyKGRpZmZBcmVhID0+ICEhZGlmZkFyZWEgJiYgZGlmZkFyZWEudHlwZSA9PT0gJ0RpZmZab25lJylcblx0XHRyZXR1cm4gZGlmZlpvbmVzXG5cdH1cblxuXG5cdGFueUZpbGVJc1N0cmVhbWluZygpIHtcblx0XHRyZXR1cm4gdGhpcy5zb3J0ZWRVUklzLnNvbWUodXJpID0+IHRoaXMuZ2V0U3RyZWFtU3RhdGUodXJpKSA9PT0gJ3N0cmVhbWluZycpXG5cdH1cblxuXHRnZXROZXh0RGlmZklkeChzdGVwOiAxIHwgLTEpOiBudW1iZXIgfCBudWxsIHtcblx0XHQvLyBJZiBubyBhY3RpdmUgVVJJLCByZXR1cm4gbnVsbFxuXHRcdGlmICghdGhpcy5hY3RpdmVVUkkpIHJldHVybiBudWxsO1xuXG5cdFx0Y29uc3Qgc3RhdGUgPSB0aGlzLnN0YXRlT2ZVUklbdGhpcy5hY3RpdmVVUkkuZnNQYXRoXTtcblx0XHRpZiAoIXN0YXRlKSByZXR1cm4gbnVsbDtcblxuXHRcdGNvbnN0IHsgZGlmZklkeCwgc29ydGVkRGlmZklkcyB9ID0gc3RhdGU7XG5cblx0XHQvLyBJZiBubyBkaWZmcywgcmV0dXJuIG51bGxcblx0XHRpZiAoc29ydGVkRGlmZklkcy5sZW5ndGggPT09IDApIHJldHVybiBudWxsO1xuXG5cdFx0Ly8gQ2FsY3VsYXRlIG5leHQgaW5kZXggd2l0aCB3cmFwcGluZ1xuXHRcdGNvbnN0IG5leHRJZHggPSAoKGRpZmZJZHggPz8gMCkgKyBzdGVwICsgc29ydGVkRGlmZklkcy5sZW5ndGgpICUgc29ydGVkRGlmZklkcy5sZW5ndGg7XG5cdFx0cmV0dXJuIG5leHRJZHg7XG5cdH1cblxuXHRnZXROZXh0VXJpSWR4KHN0ZXA6IDEgfCAtMSk6IG51bWJlciB8IG51bGwge1xuXHRcdC8vIElmIG5vIFVSSXMgd2l0aCBjaGFuZ2VzLCByZXR1cm4gbnVsbFxuXHRcdGlmICh0aGlzLnNvcnRlZFVSSXMubGVuZ3RoID09PSAwKSByZXR1cm4gbnVsbDtcblxuXHRcdC8vIElmIG5vIGFjdGl2ZSBVUkksIHJldHVybiBmaXJzdCBvciBsYXN0IGJhc2VkIG9uIHN0ZXBcblx0XHRpZiAoIXRoaXMuYWN0aXZlVVJJKSB7XG5cdFx0XHRyZXR1cm4gc3RlcCA9PT0gMSA/IDAgOiB0aGlzLnNvcnRlZFVSSXMubGVuZ3RoIC0gMTtcblx0XHR9XG5cblx0XHQvLyBGaW5kIGN1cnJlbnQgaW5kZXhcblx0XHRjb25zdCBjdXJyZW50SWR4ID0gdGhpcy5zb3J0ZWRVUklzLmZpbmRJbmRleCh1cmkgPT4gdXJpLmZzUGF0aCA9PT0gdGhpcy5hY3RpdmVVUkk/LmZzUGF0aCk7XG5cblx0XHQvLyBJZiBub3QgZm91bmQsIHJldHVybiBmaXJzdCBvciBsYXN0IGJhc2VkIG9uIHN0ZXBcblx0XHRpZiAoY3VycmVudElkeCA9PT0gLTEpIHtcblx0XHRcdHJldHVybiBzdGVwID09PSAxID8gMCA6IHRoaXMuc29ydGVkVVJJcy5sZW5ndGggLSAxO1xuXHRcdH1cblxuXHRcdC8vIENhbGN1bGF0ZSBuZXh0IGluZGV4IHdpdGggd3JhcHBpbmdcblx0XHRjb25zdCBuZXh0SWR4ID0gKGN1cnJlbnRJZHggKyBzdGVwICsgdGhpcy5zb3J0ZWRVUklzLmxlbmd0aCkgJSB0aGlzLnNvcnRlZFVSSXMubGVuZ3RoO1xuXHRcdHJldHVybiBuZXh0SWR4O1xuXHR9XG5cblx0Z29Ub0RpZmZJZHgoaWR4OiBudW1iZXIgfCBudWxsKTogdm9pZCB7XG5cdFx0Ly8gSWYgbnVsbCBvciBubyBhY3RpdmUgVVJJLCByZXR1cm5cblx0XHRpZiAoaWR4ID09PSBudWxsIHx8ICF0aGlzLmFjdGl2ZVVSSSkgcmV0dXJuO1xuXG5cdFx0Ly8gR2V0IHN0YXRlIGZvciB0aGUgY3VycmVudCBVUklcblx0XHRjb25zdCBzdGF0ZSA9IHRoaXMuc3RhdGVPZlVSSVt0aGlzLmFjdGl2ZVVSSS5mc1BhdGhdO1xuXHRcdGlmICghc3RhdGUpIHJldHVybjtcblxuXHRcdGNvbnN0IHsgc29ydGVkRGlmZklkcyB9ID0gc3RhdGU7XG5cblx0XHQvLyBGaW5kIHRoZSBkaWZmIGF0IHRoZSBzcGVjaWZpZWQgaW5kZXhcblx0XHRjb25zdCBkaWZmaWQgPSBzb3J0ZWREaWZmSWRzW2lkeF07XG5cdFx0aWYgKGRpZmZpZCA9PT0gdW5kZWZpbmVkKSByZXR1cm47XG5cblx0XHQvLyBHZXQgdGhlIGRpZmYgb2JqZWN0XG5cdFx0Y29uc3QgZGlmZiA9IHRoaXMuX2VkaXRDb2RlU2VydmljZS5kaWZmT2ZJZFtkaWZmaWRdO1xuXHRcdGlmICghZGlmZikgcmV0dXJuO1xuXG5cdFx0Ly8gRmluZCBhbiBhY3RpdmUgZWRpdG9yIHRvIGZvY3VzXG5cdFx0Y29uc3QgZWRpdG9yID0gdGhpcy5fY29kZUVkaXRvclNlcnZpY2UuZ2V0Rm9jdXNlZENvZGVFZGl0b3IoKSB8fFxuXHRcdFx0dGhpcy5fY29kZUVkaXRvclNlcnZpY2UuZ2V0QWN0aXZlQ29kZUVkaXRvcigpO1xuXHRcdGlmICghZWRpdG9yKSByZXR1cm47XG5cblx0XHQvLyBSZXZlYWwgdGhlIGxpbmUgaW4gdGhlIGVkaXRvclxuXHRcdGVkaXRvci5yZXZlYWxMaW5lTmVhclRvcChkaWZmLnN0YXJ0TGluZSAtIDEsIFNjcm9sbFR5cGUuSW1tZWRpYXRlKTtcblxuXHRcdC8vIFVwZGF0ZSB0aGUgY3VycmVudCBkaWZmIGluZGV4XG5cdFx0dGhpcy5zZXREaWZmSWR4KHRoaXMuYWN0aXZlVVJJLCBpZHgpO1xuXHR9XG5cblx0YXN5bmMgZ29Ub1VSSUlkeChpZHg6IG51bWJlciB8IG51bGwpOiBQcm9taXNlPHZvaWQ+IHtcblx0XHQvLyBJZiBudWxsIG9yIG5vIFVSSXMsIHJldHVyblxuXHRcdGlmIChpZHggPT09IG51bGwgfHwgdGhpcy5zb3J0ZWRVUklzLmxlbmd0aCA9PT0gMCkgcmV0dXJuO1xuXG5cdFx0Ly8gR2V0IHRoZSBVUkkgYXQgdGhlIHNwZWNpZmllZCBpbmRleFxuXHRcdGNvbnN0IG5leHRVUkkgPSB0aGlzLnNvcnRlZFVSSXNbaWR4XTtcblx0XHRpZiAoIW5leHRVUkkpIHJldHVybjtcblxuXHRcdC8vIEdldCB0aGUgbW9kZWwgZm9yIHRoaXMgVVJJXG5cdFx0Y29uc3QgeyBtb2RlbCB9ID0gYXdhaXQgdGhpcy5fdm9pZE1vZGVsU2VydmljZS5nZXRNb2RlbFNhZmUobmV4dFVSSSk7XG5cdFx0aWYgKCFtb2RlbCkgcmV0dXJuO1xuXG5cdFx0Ly8gRmluZCBhbiBlZGl0b3IgdG8gdXNlXG5cdFx0Y29uc3QgZWRpdG9yID0gdGhpcy5fY29kZUVkaXRvclNlcnZpY2UuZ2V0Rm9jdXNlZENvZGVFZGl0b3IoKSB8fFxuXHRcdFx0dGhpcy5fY29kZUVkaXRvclNlcnZpY2UuZ2V0QWN0aXZlQ29kZUVkaXRvcigpO1xuXHRcdGlmICghZWRpdG9yKSByZXR1cm47XG5cblx0XHQvLyBPcGVuIHRoZSBVUkkgaW4gdGhlIGVkaXRvclxuXHRcdGF3YWl0IHRoaXMuX2NvZGVFZGl0b3JTZXJ2aWNlLm9wZW5Db2RlRWRpdG9yKFxuXHRcdFx0eyByZXNvdXJjZTogbW9kZWwudXJpLCBvcHRpb25zOiB7IHJldmVhbElmVmlzaWJsZTogdHJ1ZSB9IH0sXG5cdFx0XHRlZGl0b3Jcblx0XHQpO1xuXHR9XG5cblx0YWNjZXB0T3JSZWplY3RBbGxGaWxlcyhvcHRzOiB7IGJlaGF2aW9yOiAncmVqZWN0JyB8ICdhY2NlcHQnIH0pIHtcblx0XHRjb25zdCB7IGJlaGF2aW9yIH0gPSBvcHRzXG5cdFx0Ly8gaWYgYW55dGhpbmcgaXMgc3RyZWFtaW5nLCBkbyBub3RoaW5nXG5cdFx0Y29uc3QgYW55SXNTdHJlYW1pbmcgPSB0aGlzLmFueUZpbGVJc1N0cmVhbWluZygpXG5cdFx0aWYgKGFueUlzU3RyZWFtaW5nKSByZXR1cm5cblx0XHRmb3IgKGNvbnN0IHVyaSBvZiB0aGlzLnNvcnRlZFVSSXMpIHtcblx0XHRcdHRoaXMuX2VkaXRDb2RlU2VydmljZS5hY2NlcHRPclJlamVjdEFsbERpZmZBcmVhcyh7IHVyaSwgYmVoYXZpb3IsIHJlbW92ZUN0cmxLczogZmFsc2UgfSlcblx0XHR9XG5cdH1cblxuXG59XG5cbnJlZ2lzdGVyU2luZ2xldG9uKElWb2lkQ29tbWFuZEJhclNlcnZpY2UsIFZvaWRDb21tYW5kQmFyU2VydmljZSwgSW5zdGFudGlhdGlvblR5cGUuRGVsYXllZCk7IC8vIGRlbGF5ZWQgaXMgbmVlZGVkIGhlcmUgOihcblxuXG5leHBvcnQgdHlwZSBWb2lkQ29tbWFuZEJhclByb3BzID0ge1xuXHR1cmk6IFVSSSB8IG51bGw7XG5cdGVkaXRvcjogSUNvZGVFZGl0b3I7XG59XG5cblxuXG5cbmNsYXNzIEFjY2VwdFJlamVjdEFsbEZsb2F0aW5nV2lkZ2V0IGV4dGVuZHMgV2lkZ2V0IGltcGxlbWVudHMgSU92ZXJsYXlXaWRnZXQge1xuXHRwcml2YXRlIHJlYWRvbmx5IF9kb21Ob2RlOiBIVE1MRWxlbWVudDtcblx0cHJpdmF0ZSByZWFkb25seSBlZGl0b3I6IElDb2RlRWRpdG9yO1xuXHRwcml2YXRlIHJlYWRvbmx5IElEOiBzdHJpbmc7XG5cblx0X2hlaWdodCA9IDBcblxuXHRjb25zdHJ1Y3Rvcih7IGVkaXRvciB9OiB7IGVkaXRvcjogSUNvZGVFZGl0b3IsIH0sXG5cdFx0QElJbnN0YW50aWF0aW9uU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IGluc3RhbnRpYXRpb25TZXJ2aWNlOiBJSW5zdGFudGlhdGlvblNlcnZpY2UsXG5cdCkge1xuXHRcdHN1cGVyKCk7XG5cblx0XHR0aGlzLklEID0gZ2VuZXJhdGVVdWlkKCk7XG5cdFx0dGhpcy5lZGl0b3IgPSBlZGl0b3I7XG5cdFx0Ly8gQ3JlYXRlIGNvbnRhaW5lciBkaXZcblx0XHRjb25zdCB7IHJvb3QgfSA9IGRvbS5oKCdkaXZAcm9vdCcpO1xuXG5cdFx0Ly8gU3R5bGUgdGhlIGNvbnRhaW5lclxuXHRcdC8vIHJvb3Quc3R5bGUuYmFja2dyb3VuZENvbG9yID0gJ3JnYigyNDggMTEzIDExMyknO1xuXHRcdHJvb3Quc3R5bGUuaGVpZ2h0ID0gJzI1NnB4JzsgLy8gbWFrZSBhIGZpeGVkIHNpemUsIGFuZCBhbGwgY29udGVudHMgZ28gb24gdGhlIGJvdHRvbSByaWdodC4gdGhpcyBmaXhlcyBhbm5veWluZyBWUyBDb2RlIG1vdW50aW5nIGlzc3Vlc1xuXHRcdHJvb3Quc3R5bGUud2lkdGggPSAnMTAwJSc7XG5cdFx0cm9vdC5zdHlsZS5mbGV4RGlyZWN0aW9uID0gJ2NvbHVtbic7XG5cdFx0cm9vdC5zdHlsZS5qdXN0aWZ5Q29udGVudCA9ICdmbGV4LWVuZCc7XG5cdFx0cm9vdC5zdHlsZS5hbGlnbkl0ZW1zID0gJ2ZsZXgtZW5kJztcblx0XHRyb290LnN0eWxlLnpJbmRleCA9ICcyJztcblx0XHRyb290LnN0eWxlLnBhZGRpbmcgPSAnNHB4Jztcblx0XHRyb290LnN0eWxlLnBvaW50ZXJFdmVudHMgPSAnbm9uZSc7XG5cdFx0cm9vdC5zdHlsZS5kaXNwbGF5ID0gJ2ZsZXgnO1xuXHRcdHJvb3Quc3R5bGUub3ZlcmZsb3cgPSAnaGlkZGVuJztcblxuXG5cdFx0dGhpcy5fZG9tTm9kZSA9IHJvb3Q7XG5cdFx0ZWRpdG9yLmFkZE92ZXJsYXlXaWRnZXQodGhpcyk7XG5cblx0XHR0aGlzLmluc3RhbnRpYXRpb25TZXJ2aWNlLmludm9rZUZ1bmN0aW9uKGFjY2Vzc29yID0+IHtcblx0XHRcdGNvbnN0IHVyaSA9IGVkaXRvci5nZXRNb2RlbCgpPy51cmkgfHwgbnVsbFxuXHRcdFx0Y29uc3QgcmVzID0gbW91bnRWb2lkQ29tbWFuZEJhcihyb290LCBhY2Nlc3NvciwgeyB1cmksIGVkaXRvciB9IHNhdGlzZmllcyBWb2lkQ29tbWFuZEJhclByb3BzKVxuXHRcdFx0aWYgKCFyZXMpIHJldHVyblxuXHRcdFx0dGhpcy5fcmVnaXN0ZXIodG9EaXNwb3NhYmxlKCgpID0+IHJlcy5kaXNwb3NlPy4oKSkpXG5cdFx0XHR0aGlzLl9yZWdpc3RlcihlZGl0b3Iub25XaWxsQ2hhbmdlTW9kZWwoKG1vZGVsKSA9PiB7XG5cdFx0XHRcdGNvbnN0IHVyaSA9IG1vZGVsLm5ld01vZGVsVXJsXG5cdFx0XHRcdHJlcy5yZXJlbmRlcih7IHVyaSwgZWRpdG9yIH0gc2F0aXNmaWVzIFZvaWRDb21tYW5kQmFyUHJvcHMpXG5cdFx0XHR9KSlcblx0XHR9KVxuXHR9XG5cblxuXHRwdWJsaWMgZ2V0SWQoKTogc3RyaW5nIHtcblx0XHRyZXR1cm4gdGhpcy5JRDtcblx0fVxuXG5cdHB1YmxpYyBnZXREb21Ob2RlKCk6IEhUTUxFbGVtZW50IHtcblx0XHRyZXR1cm4gdGhpcy5fZG9tTm9kZTtcblx0fVxuXG5cdHB1YmxpYyBnZXRQb3NpdGlvbigpIHtcblx0XHRyZXR1cm4ge1xuXHRcdFx0cHJlZmVyZW5jZTogT3ZlcmxheVdpZGdldFBvc2l0aW9uUHJlZmVyZW5jZS5CT1RUT01fUklHSFRfQ09STkVSXG5cdFx0fVxuXHR9XG5cblx0cHVibGljIG92ZXJyaWRlIGRpc3Bvc2UoKTogdm9pZCB7XG5cdFx0dGhpcy5lZGl0b3IucmVtb3ZlT3ZlcmxheVdpZGdldCh0aGlzKTtcblx0XHRzdXBlci5kaXNwb3NlKCk7XG5cdH1cbn1cblxuXG5yZWdpc3RlckFjdGlvbjIoY2xhc3MgZXh0ZW5kcyBBY3Rpb24yIHtcblx0Y29uc3RydWN0b3IoKSB7XG5cdFx0c3VwZXIoe1xuXHRcdFx0aWQ6IFZPSURfQUNDRVBUX0RJRkZfQUNUSU9OX0lELFxuXHRcdFx0ZjE6IHRydWUsXG5cdFx0XHR0aXRsZTogbG9jYWxpemUyKCd2b2lkQWNjZXB0RGlmZkFjdGlvbicsICdWb2lkOiBBY2NlcHQgRGlmZicpLFxuXHRcdFx0a2V5YmluZGluZzoge1xuXHRcdFx0XHRwcmltYXJ5OiBLZXlNb2QuQ3RybENtZCB8IEtleU1vZC5BbHQgfCBLZXlNb2QuU2hpZnQgfCBLZXlDb2RlLkVudGVyLFxuXHRcdFx0XHRtYWM6IHsgcHJpbWFyeTogS2V5TW9kLldpbkN0cmwgfCBLZXlNb2QuQWx0IHwgS2V5Q29kZS5FbnRlciB9LFxuXHRcdFx0XHR3ZWlnaHQ6IEtleWJpbmRpbmdXZWlnaHQuVm9pZEV4dGVuc2lvbixcblx0XHRcdH1cblx0XHR9KTtcblx0fVxuXG5cdGFzeW5jIHJ1bihhY2Nlc3NvcjogU2VydmljZXNBY2Nlc3Nvcik6IFByb21pc2U8dm9pZD4ge1xuXHRcdGNvbnN0IGVkaXRDb2RlU2VydmljZSA9IGFjY2Vzc29yLmdldChJRWRpdENvZGVTZXJ2aWNlKTtcblx0XHRjb25zdCBjb21tYW5kQmFyU2VydmljZSA9IGFjY2Vzc29yLmdldChJVm9pZENvbW1hbmRCYXJTZXJ2aWNlKTtcblx0XHRjb25zdCBtZXRyaWNzU2VydmljZSA9IGFjY2Vzc29yLmdldChJTWV0cmljc1NlcnZpY2UpO1xuXG5cblx0XHRjb25zdCBhY3RpdmVVUkkgPSBjb21tYW5kQmFyU2VydmljZS5hY3RpdmVVUkk7XG5cdFx0aWYgKCFhY3RpdmVVUkkpIHJldHVybjtcblxuXHRcdGNvbnN0IGNvbW1hbmRCYXJTdGF0ZSA9IGNvbW1hbmRCYXJTZXJ2aWNlLnN0YXRlT2ZVUklbYWN0aXZlVVJJLmZzUGF0aF07XG5cdFx0aWYgKCFjb21tYW5kQmFyU3RhdGUpIHJldHVybjtcblx0XHRjb25zdCBkaWZmSWR4ID0gY29tbWFuZEJhclN0YXRlLmRpZmZJZHggPz8gMDtcblxuXHRcdGNvbnN0IGRpZmZpZCA9IGNvbW1hbmRCYXJTdGF0ZS5zb3J0ZWREaWZmSWRzW2RpZmZJZHhdO1xuXHRcdGlmICghZGlmZmlkKSByZXR1cm47XG5cblx0XHRtZXRyaWNzU2VydmljZS5jYXB0dXJlKCdBY2NlcHQgRGlmZicsIHsgZGlmZmlkLCBrZXlib2FyZDogdHJ1ZSB9KTtcblx0XHRlZGl0Q29kZVNlcnZpY2UuYWNjZXB0RGlmZih7IGRpZmZpZDogcGFyc2VJbnQoZGlmZmlkKSB9KTtcblxuXHRcdC8vIEFmdGVyIGFjY2VwdGluZyB0aGUgZGlmZiwgbmF2aWdhdGUgdG8gdGhlIG5leHQgZGlmZlxuXHRcdGNvbnN0IG5leHREaWZmSWR4ID0gY29tbWFuZEJhclNlcnZpY2UuZ2V0TmV4dERpZmZJZHgoMSk7XG5cdFx0aWYgKG5leHREaWZmSWR4ICE9PSBudWxsKSB7XG5cdFx0XHRjb21tYW5kQmFyU2VydmljZS5nb1RvRGlmZklkeChuZXh0RGlmZklkeCk7XG5cdFx0fVxuXHR9XG59KTtcblxuXG5cbnJlZ2lzdGVyQWN0aW9uMihjbGFzcyBleHRlbmRzIEFjdGlvbjIge1xuXHRjb25zdHJ1Y3RvcigpIHtcblx0XHRzdXBlcih7XG5cdFx0XHRpZDogVk9JRF9SRUpFQ1RfRElGRl9BQ1RJT05fSUQsXG5cdFx0XHRmMTogdHJ1ZSxcblx0XHRcdHRpdGxlOiBsb2NhbGl6ZTIoJ3ZvaWRSZWplY3REaWZmQWN0aW9uJywgJ1ZvaWQ6IFJlamVjdCBEaWZmJyksXG5cdFx0XHRrZXliaW5kaW5nOiB7XG5cdFx0XHRcdHByaW1hcnk6IEtleU1vZC5DdHJsQ21kIHwgS2V5TW9kLkFsdCB8IEtleU1vZC5TaGlmdCB8IEtleUNvZGUuQmFja3NwYWNlLFxuXHRcdFx0XHRtYWM6IHsgcHJpbWFyeTogS2V5TW9kLldpbkN0cmwgfCBLZXlNb2QuQWx0IHwgS2V5Q29kZS5CYWNrc3BhY2UgfSxcblx0XHRcdFx0d2VpZ2h0OiBLZXliaW5kaW5nV2VpZ2h0LlZvaWRFeHRlbnNpb24sXG5cdFx0XHR9XG5cdFx0fSk7XG5cdH1cblxuXHRhc3luYyBydW4oYWNjZXNzb3I6IFNlcnZpY2VzQWNjZXNzb3IpOiBQcm9taXNlPHZvaWQ+IHtcblx0XHRjb25zdCBlZGl0Q29kZVNlcnZpY2UgPSBhY2Nlc3Nvci5nZXQoSUVkaXRDb2RlU2VydmljZSk7XG5cdFx0Y29uc3QgY29tbWFuZEJhclNlcnZpY2UgPSBhY2Nlc3Nvci5nZXQoSVZvaWRDb21tYW5kQmFyU2VydmljZSk7XG5cdFx0Y29uc3QgbWV0cmljc1NlcnZpY2UgPSBhY2Nlc3Nvci5nZXQoSU1ldHJpY3NTZXJ2aWNlKTtcblxuXHRcdGNvbnN0IGFjdGl2ZVVSSSA9IGNvbW1hbmRCYXJTZXJ2aWNlLmFjdGl2ZVVSSTtcblx0XHRpZiAoIWFjdGl2ZVVSSSkgcmV0dXJuO1xuXG5cdFx0Y29uc3QgY29tbWFuZEJhclN0YXRlID0gY29tbWFuZEJhclNlcnZpY2Uuc3RhdGVPZlVSSVthY3RpdmVVUkkuZnNQYXRoXTtcblx0XHRpZiAoIWNvbW1hbmRCYXJTdGF0ZSkgcmV0dXJuO1xuXHRcdGNvbnN0IGRpZmZJZHggPSBjb21tYW5kQmFyU3RhdGUuZGlmZklkeCA/PyAwO1xuXG5cdFx0Y29uc3QgZGlmZmlkID0gY29tbWFuZEJhclN0YXRlLnNvcnRlZERpZmZJZHNbZGlmZklkeF07XG5cdFx0aWYgKCFkaWZmaWQpIHJldHVybjtcblxuXHRcdG1ldHJpY3NTZXJ2aWNlLmNhcHR1cmUoJ1JlamVjdCBEaWZmJywgeyBkaWZmaWQsIGtleWJvYXJkOiB0cnVlIH0pO1xuXHRcdGVkaXRDb2RlU2VydmljZS5yZWplY3REaWZmKHsgZGlmZmlkOiBwYXJzZUludChkaWZmaWQpIH0pO1xuXG5cdFx0Ly8gQWZ0ZXIgcmVqZWN0aW5nIHRoZSBkaWZmLCBuYXZpZ2F0ZSB0byB0aGUgbmV4dCBkaWZmXG5cdFx0Y29uc3QgbmV4dERpZmZJZHggPSBjb21tYW5kQmFyU2VydmljZS5nZXROZXh0RGlmZklkeCgxKTtcblx0XHRpZiAobmV4dERpZmZJZHggIT09IG51bGwpIHtcblx0XHRcdGNvbW1hbmRCYXJTZXJ2aWNlLmdvVG9EaWZmSWR4KG5leHREaWZmSWR4KTtcblx0XHR9XG5cdH1cbn0pO1xuXG4vLyBHbyB0byBuZXh0IGRpZmYgYWN0aW9uXG5yZWdpc3RlckFjdGlvbjIoY2xhc3MgZXh0ZW5kcyBBY3Rpb24yIHtcblx0Y29uc3RydWN0b3IoKSB7XG5cdFx0c3VwZXIoe1xuXHRcdFx0aWQ6IFZPSURfR09UT19ORVhUX0RJRkZfQUNUSU9OX0lELFxuXHRcdFx0ZjE6IHRydWUsXG5cdFx0XHR0aXRsZTogbG9jYWxpemUyKCd2b2lkR29Ub05leHREaWZmQWN0aW9uJywgJ1ZvaWQ6IEdvIHRvIE5leHQgRGlmZicpLFxuXHRcdFx0a2V5YmluZGluZzoge1xuXHRcdFx0XHRwcmltYXJ5OiBLZXlNb2QuQ3RybENtZCB8IEtleU1vZC5BbHQgfCBLZXlNb2QuU2hpZnQgfCBLZXlDb2RlLkRvd25BcnJvdyxcblx0XHRcdFx0bWFjOiB7IHByaW1hcnk6IEtleU1vZC5XaW5DdHJsIHwgS2V5TW9kLkFsdCB8IEtleUNvZGUuRG93bkFycm93IH0sXG5cdFx0XHRcdHdlaWdodDogS2V5YmluZGluZ1dlaWdodC5Wb2lkRXh0ZW5zaW9uLFxuXHRcdFx0fVxuXHRcdH0pO1xuXHR9XG5cblx0YXN5bmMgcnVuKGFjY2Vzc29yOiBTZXJ2aWNlc0FjY2Vzc29yKTogUHJvbWlzZTx2b2lkPiB7XG5cdFx0Y29uc3QgY29tbWFuZEJhclNlcnZpY2UgPSBhY2Nlc3Nvci5nZXQoSVZvaWRDb21tYW5kQmFyU2VydmljZSk7XG5cdFx0Y29uc3QgbWV0cmljc1NlcnZpY2UgPSBhY2Nlc3Nvci5nZXQoSU1ldHJpY3NTZXJ2aWNlKTtcblxuXHRcdGNvbnN0IG5leHREaWZmSWR4ID0gY29tbWFuZEJhclNlcnZpY2UuZ2V0TmV4dERpZmZJZHgoMSk7XG5cdFx0aWYgKG5leHREaWZmSWR4ID09PSBudWxsKSByZXR1cm47XG5cblx0XHRtZXRyaWNzU2VydmljZS5jYXB0dXJlKCdOYXZpZ2F0ZSBEaWZmJywgeyBkaXJlY3Rpb246ICduZXh0Jywga2V5Ym9hcmQ6IHRydWUgfSk7XG5cdFx0Y29tbWFuZEJhclNlcnZpY2UuZ29Ub0RpZmZJZHgobmV4dERpZmZJZHgpO1xuXHR9XG59KTtcblxuLy8gR28gdG8gcHJldmlvdXMgZGlmZiBhY3Rpb25cbnJlZ2lzdGVyQWN0aW9uMihjbGFzcyBleHRlbmRzIEFjdGlvbjIge1xuXHRjb25zdHJ1Y3RvcigpIHtcblx0XHRzdXBlcih7XG5cdFx0XHRpZDogVk9JRF9HT1RPX1BSRVZfRElGRl9BQ1RJT05fSUQsXG5cdFx0XHRmMTogdHJ1ZSxcblx0XHRcdHRpdGxlOiBsb2NhbGl6ZTIoJ3ZvaWRHb1RvUHJldkRpZmZBY3Rpb24nLCAnVm9pZDogR28gdG8gUHJldmlvdXMgRGlmZicpLFxuXHRcdFx0a2V5YmluZGluZzoge1xuXHRcdFx0XHRwcmltYXJ5OiBLZXlNb2QuQ3RybENtZCB8IEtleU1vZC5BbHQgfCBLZXlNb2QuU2hpZnQgfCBLZXlDb2RlLlVwQXJyb3csXG5cdFx0XHRcdG1hYzogeyBwcmltYXJ5OiBLZXlNb2QuV2luQ3RybCB8IEtleU1vZC5BbHQgfCBLZXlDb2RlLlVwQXJyb3cgfSxcblx0XHRcdFx0d2VpZ2h0OiBLZXliaW5kaW5nV2VpZ2h0LlZvaWRFeHRlbnNpb24sXG5cdFx0XHR9XG5cdFx0fSk7XG5cdH1cblxuXHRhc3luYyBydW4oYWNjZXNzb3I6IFNlcnZpY2VzQWNjZXNzb3IpOiBQcm9taXNlPHZvaWQ+IHtcblx0XHRjb25zdCBjb21tYW5kQmFyU2VydmljZSA9IGFjY2Vzc29yLmdldChJVm9pZENvbW1hbmRCYXJTZXJ2aWNlKTtcblx0XHRjb25zdCBtZXRyaWNzU2VydmljZSA9IGFjY2Vzc29yLmdldChJTWV0cmljc1NlcnZpY2UpO1xuXG5cdFx0Y29uc3QgcHJldkRpZmZJZHggPSBjb21tYW5kQmFyU2VydmljZS5nZXROZXh0RGlmZklkeCgtMSk7XG5cdFx0aWYgKHByZXZEaWZmSWR4ID09PSBudWxsKSByZXR1cm47XG5cblx0XHRtZXRyaWNzU2VydmljZS5jYXB0dXJlKCdOYXZpZ2F0ZSBEaWZmJywgeyBkaXJlY3Rpb246ICdwcmV2aW91cycsIGtleWJvYXJkOiB0cnVlIH0pO1xuXHRcdGNvbW1hbmRCYXJTZXJ2aWNlLmdvVG9EaWZmSWR4KHByZXZEaWZmSWR4KTtcblx0fVxufSk7XG5cbi8vIEdvIHRvIG5leHQgVVJJIGFjdGlvblxucmVnaXN0ZXJBY3Rpb24yKGNsYXNzIGV4dGVuZHMgQWN0aW9uMiB7XG5cdGNvbnN0cnVjdG9yKCkge1xuXHRcdHN1cGVyKHtcblx0XHRcdGlkOiBWT0lEX0dPVE9fTkVYVF9VUklfQUNUSU9OX0lELFxuXHRcdFx0ZjE6IHRydWUsXG5cdFx0XHR0aXRsZTogbG9jYWxpemUyKCd2b2lkR29Ub05leHRVcmlBY3Rpb24nLCAnVm9pZDogR28gdG8gTmV4dCBGaWxlIHdpdGggRGlmZnMnKSxcblx0XHRcdGtleWJpbmRpbmc6IHtcblx0XHRcdFx0cHJpbWFyeTogS2V5TW9kLkN0cmxDbWQgfCBLZXlNb2QuQWx0IHwgS2V5TW9kLlNoaWZ0IHwgS2V5Q29kZS5SaWdodEFycm93LFxuXHRcdFx0XHRtYWM6IHsgcHJpbWFyeTogS2V5TW9kLldpbkN0cmwgfCBLZXlNb2QuQWx0IHwgS2V5Q29kZS5SaWdodEFycm93IH0sXG5cdFx0XHRcdHdlaWdodDogS2V5YmluZGluZ1dlaWdodC5Wb2lkRXh0ZW5zaW9uLFxuXHRcdFx0fVxuXHRcdH0pO1xuXHR9XG5cblx0YXN5bmMgcnVuKGFjY2Vzc29yOiBTZXJ2aWNlc0FjY2Vzc29yKTogUHJvbWlzZTx2b2lkPiB7XG5cdFx0Y29uc3QgY29tbWFuZEJhclNlcnZpY2UgPSBhY2Nlc3Nvci5nZXQoSVZvaWRDb21tYW5kQmFyU2VydmljZSk7XG5cdFx0Y29uc3QgbWV0cmljc1NlcnZpY2UgPSBhY2Nlc3Nvci5nZXQoSU1ldHJpY3NTZXJ2aWNlKTtcblxuXHRcdGNvbnN0IG5leHRVcmlJZHggPSBjb21tYW5kQmFyU2VydmljZS5nZXROZXh0VXJpSWR4KDEpO1xuXHRcdGlmIChuZXh0VXJpSWR4ID09PSBudWxsKSByZXR1cm47XG5cblx0XHRtZXRyaWNzU2VydmljZS5jYXB0dXJlKCdOYXZpZ2F0ZSBVUkknLCB7IGRpcmVjdGlvbjogJ25leHQnLCBrZXlib2FyZDogdHJ1ZSB9KTtcblx0XHRhd2FpdCBjb21tYW5kQmFyU2VydmljZS5nb1RvVVJJSWR4KG5leHRVcmlJZHgpO1xuXHR9XG59KTtcblxuLy8gR28gdG8gcHJldmlvdXMgVVJJIGFjdGlvblxucmVnaXN0ZXJBY3Rpb24yKGNsYXNzIGV4dGVuZHMgQWN0aW9uMiB7XG5cdGNvbnN0cnVjdG9yKCkge1xuXHRcdHN1cGVyKHtcblx0XHRcdGlkOiBWT0lEX0dPVE9fUFJFVl9VUklfQUNUSU9OX0lELFxuXHRcdFx0ZjE6IHRydWUsXG5cdFx0XHR0aXRsZTogbG9jYWxpemUyKCd2b2lkR29Ub1ByZXZVcmlBY3Rpb24nLCAnVm9pZDogR28gdG8gUHJldmlvdXMgRmlsZSB3aXRoIERpZmZzJyksXG5cdFx0XHRrZXliaW5kaW5nOiB7XG5cdFx0XHRcdHByaW1hcnk6IEtleU1vZC5DdHJsQ21kIHwgS2V5TW9kLkFsdCB8IEtleU1vZC5TaGlmdCB8IEtleUNvZGUuTGVmdEFycm93LFxuXHRcdFx0XHRtYWM6IHsgcHJpbWFyeTogS2V5TW9kLldpbkN0cmwgfCBLZXlNb2QuQWx0IHwgS2V5Q29kZS5MZWZ0QXJyb3cgfSxcblx0XHRcdFx0d2VpZ2h0OiBLZXliaW5kaW5nV2VpZ2h0LlZvaWRFeHRlbnNpb24sXG5cdFx0XHR9XG5cdFx0fSk7XG5cdH1cblxuXHRhc3luYyBydW4oYWNjZXNzb3I6IFNlcnZpY2VzQWNjZXNzb3IpOiBQcm9taXNlPHZvaWQ+IHtcblx0XHRjb25zdCBjb21tYW5kQmFyU2VydmljZSA9IGFjY2Vzc29yLmdldChJVm9pZENvbW1hbmRCYXJTZXJ2aWNlKTtcblx0XHRjb25zdCBtZXRyaWNzU2VydmljZSA9IGFjY2Vzc29yLmdldChJTWV0cmljc1NlcnZpY2UpO1xuXG5cdFx0Y29uc3QgcHJldlVyaUlkeCA9IGNvbW1hbmRCYXJTZXJ2aWNlLmdldE5leHRVcmlJZHgoLTEpO1xuXHRcdGlmIChwcmV2VXJpSWR4ID09PSBudWxsKSByZXR1cm47XG5cblx0XHRtZXRyaWNzU2VydmljZS5jYXB0dXJlKCdOYXZpZ2F0ZSBVUkknLCB7IGRpcmVjdGlvbjogJ3ByZXZpb3VzJywga2V5Ym9hcmQ6IHRydWUgfSk7XG5cdFx0YXdhaXQgY29tbWFuZEJhclNlcnZpY2UuZ29Ub1VSSUlkeChwcmV2VXJpSWR4KTtcblx0fVxufSk7XG5cbi8vIEFjY2VwdCBjdXJyZW50IGZpbGUgYWN0aW9uXG5yZWdpc3RlckFjdGlvbjIoY2xhc3MgZXh0ZW5kcyBBY3Rpb24yIHtcblx0Y29uc3RydWN0b3IoKSB7XG5cdFx0c3VwZXIoe1xuXHRcdFx0aWQ6IFZPSURfQUNDRVBUX0ZJTEVfQUNUSU9OX0lELFxuXHRcdFx0ZjE6IHRydWUsXG5cdFx0XHR0aXRsZTogbG9jYWxpemUyKCd2b2lkQWNjZXB0RmlsZUFjdGlvbicsICdWb2lkOiBBY2NlcHQgQWxsIERpZmZzIGluIEN1cnJlbnQgRmlsZScpLFxuXHRcdFx0a2V5YmluZGluZzoge1xuXHRcdFx0XHRwcmltYXJ5OiBLZXlNb2QuQWx0IHwgS2V5TW9kLlNoaWZ0IHwgS2V5Q29kZS5FbnRlcixcblx0XHRcdFx0d2VpZ2h0OiBLZXliaW5kaW5nV2VpZ2h0LlZvaWRFeHRlbnNpb24sXG5cdFx0XHR9XG5cdFx0fSk7XG5cdH1cblxuXHRhc3luYyBydW4oYWNjZXNzb3I6IFNlcnZpY2VzQWNjZXNzb3IpOiBQcm9taXNlPHZvaWQ+IHtcblx0XHRjb25zdCBjb21tYW5kQmFyU2VydmljZSA9IGFjY2Vzc29yLmdldChJVm9pZENvbW1hbmRCYXJTZXJ2aWNlKTtcblx0XHRjb25zdCBlZGl0Q29kZVNlcnZpY2UgPSBhY2Nlc3Nvci5nZXQoSUVkaXRDb2RlU2VydmljZSk7XG5cdFx0Y29uc3QgbWV0cmljc1NlcnZpY2UgPSBhY2Nlc3Nvci5nZXQoSU1ldHJpY3NTZXJ2aWNlKTtcblxuXHRcdGNvbnN0IGFjdGl2ZVVSSSA9IGNvbW1hbmRCYXJTZXJ2aWNlLmFjdGl2ZVVSSTtcblx0XHRpZiAoIWFjdGl2ZVVSSSkgcmV0dXJuO1xuXG5cdFx0bWV0cmljc1NlcnZpY2UuY2FwdHVyZSgnQWNjZXB0IEZpbGUnLCB7IGtleWJvYXJkOiB0cnVlIH0pO1xuXHRcdGVkaXRDb2RlU2VydmljZS5hY2NlcHRPclJlamVjdEFsbERpZmZBcmVhcyh7XG5cdFx0XHR1cmk6IGFjdGl2ZVVSSSxcblx0XHRcdGJlaGF2aW9yOiAnYWNjZXB0Jyxcblx0XHRcdHJlbW92ZUN0cmxLczogdHJ1ZVxuXHRcdH0pO1xuXHR9XG59KTtcblxuLy8gUmVqZWN0IGN1cnJlbnQgZmlsZSBhY3Rpb25cbnJlZ2lzdGVyQWN0aW9uMihjbGFzcyBleHRlbmRzIEFjdGlvbjIge1xuXHRjb25zdHJ1Y3RvcigpIHtcblx0XHRzdXBlcih7XG5cdFx0XHRpZDogVk9JRF9SRUpFQ1RfRklMRV9BQ1RJT05fSUQsXG5cdFx0XHRmMTogdHJ1ZSxcblx0XHRcdHRpdGxlOiBsb2NhbGl6ZTIoJ3ZvaWRSZWplY3RGaWxlQWN0aW9uJywgJ1ZvaWQ6IFJlamVjdCBBbGwgRGlmZnMgaW4gQ3VycmVudCBGaWxlJyksXG5cdFx0XHRrZXliaW5kaW5nOiB7XG5cdFx0XHRcdHByaW1hcnk6IEtleU1vZC5BbHQgfCBLZXlNb2QuU2hpZnQgfCBLZXlDb2RlLkJhY2tzcGFjZSxcblx0XHRcdFx0d2VpZ2h0OiBLZXliaW5kaW5nV2VpZ2h0LlZvaWRFeHRlbnNpb24sXG5cdFx0XHR9XG5cdFx0fSk7XG5cdH1cblxuXHRhc3luYyBydW4oYWNjZXNzb3I6IFNlcnZpY2VzQWNjZXNzb3IpOiBQcm9taXNlPHZvaWQ+IHtcblx0XHRjb25zdCBjb21tYW5kQmFyU2VydmljZSA9IGFjY2Vzc29yLmdldChJVm9pZENvbW1hbmRCYXJTZXJ2aWNlKTtcblx0XHRjb25zdCBlZGl0Q29kZVNlcnZpY2UgPSBhY2Nlc3Nvci5nZXQoSUVkaXRDb2RlU2VydmljZSk7XG5cdFx0Y29uc3QgbWV0cmljc1NlcnZpY2UgPSBhY2Nlc3Nvci5nZXQoSU1ldHJpY3NTZXJ2aWNlKTtcblxuXHRcdGNvbnN0IGFjdGl2ZVVSSSA9IGNvbW1hbmRCYXJTZXJ2aWNlLmFjdGl2ZVVSSTtcblx0XHRpZiAoIWFjdGl2ZVVSSSkgcmV0dXJuO1xuXG5cdFx0bWV0cmljc1NlcnZpY2UuY2FwdHVyZSgnUmVqZWN0IEZpbGUnLCB7IGtleWJvYXJkOiB0cnVlIH0pO1xuXHRcdGVkaXRDb2RlU2VydmljZS5hY2NlcHRPclJlamVjdEFsbERpZmZBcmVhcyh7XG5cdFx0XHR1cmk6IGFjdGl2ZVVSSSxcblx0XHRcdGJlaGF2aW9yOiAncmVqZWN0Jyxcblx0XHRcdHJlbW92ZUN0cmxLczogdHJ1ZVxuXHRcdH0pO1xuXHR9XG59KTtcblxuLy8gQWNjZXB0IGFsbCBkaWZmcyBpbiBhbGwgZmlsZXMgYWN0aW9uXG5yZWdpc3RlckFjdGlvbjIoY2xhc3MgZXh0ZW5kcyBBY3Rpb24yIHtcblx0Y29uc3RydWN0b3IoKSB7XG5cdFx0c3VwZXIoe1xuXHRcdFx0aWQ6IFZPSURfQUNDRVBUX0FMTF9ESUZGU19BQ1RJT05fSUQsXG5cdFx0XHRmMTogdHJ1ZSxcblx0XHRcdHRpdGxlOiBsb2NhbGl6ZTIoJ3ZvaWRBY2NlcHRBbGxEaWZmc0FjdGlvbicsICdWb2lkOiBBY2NlcHQgQWxsIERpZmZzIGluIEFsbCBGaWxlcycpLFxuXHRcdFx0a2V5YmluZGluZzoge1xuXHRcdFx0XHRwcmltYXJ5OiBLZXlNb2QuQ3RybENtZCB8IEtleU1vZC5TaGlmdCB8IEtleUNvZGUuRW50ZXIsXG5cdFx0XHRcdHdlaWdodDogS2V5YmluZGluZ1dlaWdodC5Wb2lkRXh0ZW5zaW9uLFxuXHRcdFx0fVxuXHRcdH0pO1xuXHR9XG5cblx0YXN5bmMgcnVuKGFjY2Vzc29yOiBTZXJ2aWNlc0FjY2Vzc29yKTogUHJvbWlzZTx2b2lkPiB7XG5cdFx0Y29uc3QgY29tbWFuZEJhclNlcnZpY2UgPSBhY2Nlc3Nvci5nZXQoSVZvaWRDb21tYW5kQmFyU2VydmljZSk7XG5cdFx0Y29uc3QgbWV0cmljc1NlcnZpY2UgPSBhY2Nlc3Nvci5nZXQoSU1ldHJpY3NTZXJ2aWNlKTtcblxuXHRcdGlmIChjb21tYW5kQmFyU2VydmljZS5hbnlGaWxlSXNTdHJlYW1pbmcoKSkgcmV0dXJuO1xuXG5cdFx0bWV0cmljc1NlcnZpY2UuY2FwdHVyZSgnQWNjZXB0IEFsbCBGaWxlcycsIHsga2V5Ym9hcmQ6IHRydWUgfSk7XG5cdFx0Y29tbWFuZEJhclNlcnZpY2UuYWNjZXB0T3JSZWplY3RBbGxGaWxlcyh7IGJlaGF2aW9yOiAnYWNjZXB0JyB9KTtcblx0fVxufSk7XG5cbi8vIFJlamVjdCBhbGwgZGlmZnMgaW4gYWxsIGZpbGVzIGFjdGlvblxucmVnaXN0ZXJBY3Rpb24yKGNsYXNzIGV4dGVuZHMgQWN0aW9uMiB7XG5cdGNvbnN0cnVjdG9yKCkge1xuXHRcdHN1cGVyKHtcblx0XHRcdGlkOiBWT0lEX1JFSkVDVF9BTExfRElGRlNfQUNUSU9OX0lELFxuXHRcdFx0ZjE6IHRydWUsXG5cdFx0XHR0aXRsZTogbG9jYWxpemUyKCd2b2lkUmVqZWN0QWxsRGlmZnNBY3Rpb24nLCAnVm9pZDogUmVqZWN0IEFsbCBEaWZmcyBpbiBBbGwgRmlsZXMnKSxcblx0XHRcdGtleWJpbmRpbmc6IHtcblx0XHRcdFx0cHJpbWFyeTogS2V5TW9kLkN0cmxDbWQgfCBLZXlNb2QuU2hpZnQgfCBLZXlDb2RlLkJhY2tzcGFjZSxcblx0XHRcdFx0d2VpZ2h0OiBLZXliaW5kaW5nV2VpZ2h0LlZvaWRFeHRlbnNpb24sXG5cdFx0XHR9XG5cdFx0fSk7XG5cdH1cblxuXHRhc3luYyBydW4oYWNjZXNzb3I6IFNlcnZpY2VzQWNjZXNzb3IpOiBQcm9taXNlPHZvaWQ+IHtcblx0XHRjb25zdCBjb21tYW5kQmFyU2VydmljZSA9IGFjY2Vzc29yLmdldChJVm9pZENvbW1hbmRCYXJTZXJ2aWNlKTtcblx0XHRjb25zdCBtZXRyaWNzU2VydmljZSA9IGFjY2Vzc29yLmdldChJTWV0cmljc1NlcnZpY2UpO1xuXG5cdFx0aWYgKGNvbW1hbmRCYXJTZXJ2aWNlLmFueUZpbGVJc1N0cmVhbWluZygpKSByZXR1cm47XG5cblx0XHRtZXRyaWNzU2VydmljZS5jYXB0dXJlKCdSZWplY3QgQWxsIEZpbGVzJywgeyBrZXlib2FyZDogdHJ1ZSB9KTtcblx0XHRjb21tYW5kQmFyU2VydmljZS5hY2NlcHRPclJlamVjdEFsbEZpbGVzKHsgYmVoYXZpb3I6ICdyZWplY3QnIH0pO1xuXHR9XG59KTtcbiJdLAogICJtYXBwaW5ncyI6ICI7Ozs7Ozs7Ozs7O0FBS0EsU0FBUyxZQUF5QixvQkFBb0I7QUFDdEQsU0FBUyxpQkFBaUIsNkJBQTZCO0FBRXZELFlBQVksU0FBUztBQUNyQixTQUFTLGNBQWM7QUFDdkIsU0FBc0MsdUNBQXVDO0FBQzdFLFNBQVMsZUFBc0I7QUFDL0IsU0FBUywwQkFBMEI7QUFDbkMsU0FBUywyQkFBMkI7QUFDcEMsU0FBUyxpQkFBaUI7QUFDMUIsU0FBUyxtQkFBbUIseUJBQXlCO0FBQ3JELFNBQVMsd0JBQXdCO0FBRWpDLFNBQVMscUJBQXFCO0FBQzlCLFNBQVMsb0JBQW9CO0FBQzdCLFNBQVMsU0FBUyx1QkFBdUI7QUFDekMsU0FB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
