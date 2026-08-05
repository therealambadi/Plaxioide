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
import { Event, Emitter } from "../../../base/common/event.js";
import { EditorsOrder, EditorExtensions, SideBySideEditor, EditorCloseContext, GroupModelChangeKind } from "../editor.js";
import { EditorInput } from "./editorInput.js";
import { SideBySideEditorInput } from "./sideBySideEditorInput.js";
import { IInstantiationService } from "../../../platform/instantiation/common/instantiation.js";
import { IConfigurationService } from "../../../platform/configuration/common/configuration.js";
import { dispose, Disposable, DisposableStore } from "../../../base/common/lifecycle.js";
import { Registry } from "../../../platform/registry/common/platform.js";
import { coalesce } from "../../../base/common/arrays.js";
const EditorOpenPositioning = {
  LEFT: "left",
  RIGHT: "right",
  FIRST: "first",
  LAST: "last"
};
function isSerializedEditorGroupModel(group) {
  const candidate = group;
  return !!(candidate && typeof candidate === "object" && Array.isArray(candidate.editors) && Array.isArray(candidate.mru));
}
function isGroupEditorChangeEvent(e) {
  const candidate = e;
  return candidate.editor && candidate.editorIndex !== void 0;
}
function isGroupEditorOpenEvent(e) {
  const candidate = e;
  return candidate.kind === GroupModelChangeKind.EDITOR_OPEN && candidate.editorIndex !== void 0;
}
function isGroupEditorMoveEvent(e) {
  const candidate = e;
  return candidate.kind === GroupModelChangeKind.EDITOR_MOVE && candidate.editorIndex !== void 0 && candidate.oldEditorIndex !== void 0;
}
function isGroupEditorCloseEvent(e) {
  const candidate = e;
  return candidate.kind === GroupModelChangeKind.EDITOR_CLOSE && candidate.editorIndex !== void 0 && candidate.context !== void 0 && candidate.sticky !== void 0;
}
let EditorGroupModel = class extends Disposable {
  constructor(labelOrSerializedGroup, instantiationService, configurationService) {
    super();
    this.instantiationService = instantiationService;
    this.configurationService = configurationService;
    //#region events
    this._onDidModelChange = this._register(new Emitter({
      leakWarningThreshold: 500
      /* increased for users with hundreds of inputs opened */
    }));
    this.onDidModelChange = this._onDidModelChange.event;
    this.editors = [];
    this.mru = [];
    this.editorListeners = /* @__PURE__ */ new Set();
    this.locked = false;
    this.selection = [];
    this.preview = null;
    // editor in preview state
    this.sticky = -1;
    // index of first editor in sticky state
    this.transient = /* @__PURE__ */ new Set();
    if (isSerializedEditorGroupModel(labelOrSerializedGroup)) {
      this._id = this.deserialize(labelOrSerializedGroup);
    } else {
      this._id = EditorGroupModel.IDS++;
    }
    this.onConfigurationUpdated();
    this.registerListeners();
  }
  get id() {
    return this._id;
  }
  // editors in selected state, first one is active
  get active() {
    return this.selection[0] ?? null;
  }
  registerListeners() {
    this._register(this.configurationService.onDidChangeConfiguration((e) => this.onConfigurationUpdated(e)));
  }
  onConfigurationUpdated(e) {
    if (e && !e.affectsConfiguration("workbench.editor.openPositioning") && !e.affectsConfiguration("workbench.editor.focusRecentEditorAfterClose")) {
      return;
    }
    this.editorOpenPositioning = this.configurationService.getValue("workbench.editor.openPositioning");
    this.focusRecentEditorAfterClose = this.configurationService.getValue("workbench.editor.focusRecentEditorAfterClose");
  }
  get count() {
    return this.editors.length;
  }
  get stickyCount() {
    return this.sticky + 1;
  }
  getEditors(order, options) {
    const editors = order === EditorsOrder.MOST_RECENTLY_ACTIVE ? this.mru.slice(0) : this.editors.slice(0);
    if (options?.excludeSticky) {
      if (order === EditorsOrder.MOST_RECENTLY_ACTIVE) {
        return editors.filter((editor) => !this.isSticky(editor));
      }
      return editors.slice(this.sticky + 1);
    }
    return editors;
  }
  getEditorByIndex(index) {
    return this.editors[index];
  }
  get activeEditor() {
    return this.active;
  }
  isActive(candidate) {
    return this.matches(this.active, candidate);
  }
  get previewEditor() {
    return this.preview;
  }
  openEditor(candidate, options) {
    const makeSticky = options?.sticky || typeof options?.index === "number" && this.isSticky(options.index);
    const makePinned = options?.pinned || options?.sticky;
    const makeTransient = !!options?.transient;
    const makeActive = options?.active || !this.activeEditor || !makePinned && this.preview === this.activeEditor;
    const existingEditorAndIndex = this.findEditor(candidate, options);
    if (!existingEditorAndIndex) {
      const newEditor = candidate;
      const indexOfActive = this.indexOf(this.active);
      let targetIndex;
      if (options && typeof options.index === "number") {
        targetIndex = options.index;
      } else if (this.editorOpenPositioning === EditorOpenPositioning.FIRST) {
        targetIndex = 0;
        if (!makeSticky && this.isSticky(targetIndex)) {
          targetIndex = this.sticky + 1;
        }
      } else if (this.editorOpenPositioning === EditorOpenPositioning.LAST) {
        targetIndex = this.editors.length;
      } else {
        if (this.editorOpenPositioning === EditorOpenPositioning.LEFT) {
          if (indexOfActive === 0 || !this.editors.length) {
            targetIndex = 0;
          } else {
            targetIndex = indexOfActive;
          }
        } else {
          targetIndex = indexOfActive + 1;
        }
        if (!makeSticky && this.isSticky(targetIndex)) {
          targetIndex = this.sticky + 1;
        }
      }
      if (makeSticky) {
        this.sticky++;
        if (!this.isSticky(targetIndex)) {
          targetIndex = this.sticky;
        }
      }
      if (makePinned || !this.preview) {
        this.splice(targetIndex, false, newEditor);
      }
      if (makeTransient) {
        this.doSetTransient(newEditor, targetIndex, true);
      }
      if (!makePinned) {
        if (this.preview) {
          const indexOfPreview = this.indexOf(this.preview);
          if (targetIndex > indexOfPreview) {
            targetIndex--;
          }
          this.replaceEditor(this.preview, newEditor, targetIndex, !makeActive);
        }
        this.preview = newEditor;
      }
      this.registerEditorListeners(newEditor);
      const event = {
        kind: GroupModelChangeKind.EDITOR_OPEN,
        editor: newEditor,
        editorIndex: targetIndex
      };
      this._onDidModelChange.fire(event);
      this.setSelection(makeActive ? newEditor : this.activeEditor, options?.inactiveSelection ?? []);
      return {
        editor: newEditor,
        isNew: true
      };
    } else {
      const [existingEditor, existingEditorIndex] = existingEditorAndIndex;
      this.doSetTransient(existingEditor, existingEditorIndex, makeTransient === false ? false : this.isTransient(existingEditor));
      if (makePinned) {
        this.doPin(existingEditor, existingEditorIndex);
      }
      this.setSelection(makeActive ? existingEditor : this.activeEditor, options?.inactiveSelection ?? []);
      if (options && typeof options.index === "number") {
        this.moveEditor(existingEditor, options.index);
      }
      if (makeSticky) {
        this.doStick(existingEditor, this.indexOf(existingEditor));
      }
      return {
        editor: existingEditor,
        isNew: false
      };
    }
  }
  registerEditorListeners(editor) {
    const listeners = new DisposableStore();
    this.editorListeners.add(listeners);
    listeners.add(Event.once(editor.onWillDispose)(() => {
      const editorIndex = this.editors.indexOf(editor);
      if (editorIndex >= 0) {
        const event = {
          kind: GroupModelChangeKind.EDITOR_WILL_DISPOSE,
          editor,
          editorIndex
        };
        this._onDidModelChange.fire(event);
      }
    }));
    listeners.add(editor.onDidChangeDirty(() => {
      const event = {
        kind: GroupModelChangeKind.EDITOR_DIRTY,
        editor,
        editorIndex: this.editors.indexOf(editor)
      };
      this._onDidModelChange.fire(event);
    }));
    listeners.add(editor.onDidChangeLabel(() => {
      const event = {
        kind: GroupModelChangeKind.EDITOR_LABEL,
        editor,
        editorIndex: this.editors.indexOf(editor)
      };
      this._onDidModelChange.fire(event);
    }));
    listeners.add(editor.onDidChangeCapabilities(() => {
      const event = {
        kind: GroupModelChangeKind.EDITOR_CAPABILITIES,
        editor,
        editorIndex: this.editors.indexOf(editor)
      };
      this._onDidModelChange.fire(event);
    }));
    listeners.add(this.onDidModelChange((event) => {
      if (event.kind === GroupModelChangeKind.EDITOR_CLOSE && event.editor?.matches(editor)) {
        dispose(listeners);
        this.editorListeners.delete(listeners);
      }
    }));
  }
  replaceEditor(toReplace, replaceWith, replaceIndex, openNext = true) {
    const closeResult = this.doCloseEditor(toReplace, EditorCloseContext.REPLACE, openNext);
    this.splice(replaceIndex, false, replaceWith);
    if (closeResult) {
      const event = {
        kind: GroupModelChangeKind.EDITOR_CLOSE,
        ...closeResult
      };
      this._onDidModelChange.fire(event);
    }
  }
  closeEditor(candidate, context = EditorCloseContext.UNKNOWN, openNext = true) {
    const closeResult = this.doCloseEditor(candidate, context, openNext);
    if (closeResult) {
      const event = {
        kind: GroupModelChangeKind.EDITOR_CLOSE,
        ...closeResult
      };
      this._onDidModelChange.fire(event);
      return closeResult;
    }
    return void 0;
  }
  doCloseEditor(candidate, context, openNext) {
    const index = this.indexOf(candidate);
    if (index === -1) {
      return void 0;
    }
    const editor = this.editors[index];
    const sticky = this.isSticky(index);
    const isActiveEditor = this.active === editor;
    if (openNext && isActiveEditor) {
      if (this.mru.length > 1) {
        let newActive;
        if (this.focusRecentEditorAfterClose) {
          newActive = this.mru[1];
        } else {
          if (index === this.editors.length - 1) {
            newActive = this.editors[index - 1];
          } else {
            newActive = this.editors[index + 1];
          }
        }
        const newInactiveSelectedEditors = this.selection.filter((selected) => selected !== editor && selected !== newActive);
        this.doSetSelection(newActive, this.editors.indexOf(newActive), newInactiveSelectedEditors);
      } else {
        this.doSetSelection(null, void 0, []);
      }
    } else if (!isActiveEditor) {
      if (this.doIsSelected(editor)) {
        const newInactiveSelectedEditors = this.selection.filter((selected) => selected !== editor && selected !== this.activeEditor);
        this.doSetSelection(this.activeEditor, this.indexOf(this.activeEditor), newInactiveSelectedEditors);
      }
    }
    if (this.preview === editor) {
      this.preview = null;
    }
    this.transient.delete(editor);
    this.splice(index, true);
    return { editor, sticky, editorIndex: index, context };
  }
  moveEditor(candidate, toIndex) {
    if (toIndex >= this.editors.length) {
      toIndex = this.editors.length - 1;
    } else if (toIndex < 0) {
      toIndex = 0;
    }
    const index = this.indexOf(candidate);
    if (index < 0 || toIndex === index) {
      return;
    }
    const editor = this.editors[index];
    const sticky = this.sticky;
    if (this.isSticky(index) && toIndex > this.sticky) {
      this.sticky--;
    } else if (!this.isSticky(index) && toIndex <= this.sticky) {
      this.sticky++;
    }
    this.editors.splice(index, 1);
    this.editors.splice(toIndex, 0, editor);
    const event = {
      kind: GroupModelChangeKind.EDITOR_MOVE,
      editor,
      oldEditorIndex: index,
      editorIndex: toIndex
    };
    this._onDidModelChange.fire(event);
    if (sticky !== this.sticky) {
      const event2 = {
        kind: GroupModelChangeKind.EDITOR_STICKY,
        editor,
        editorIndex: toIndex
      };
      this._onDidModelChange.fire(event2);
    }
    return editor;
  }
  setActive(candidate) {
    let result = void 0;
    if (!candidate) {
      this.setGroupActive();
    } else {
      result = this.setEditorActive(candidate);
    }
    return result;
  }
  setGroupActive() {
    this._onDidModelChange.fire({ kind: GroupModelChangeKind.GROUP_ACTIVE });
  }
  setEditorActive(candidate) {
    const res = this.findEditor(candidate);
    if (!res) {
      return;
    }
    const [editor, editorIndex] = res;
    this.doSetSelection(editor, editorIndex, []);
    return editor;
  }
  get selectedEditors() {
    return this.editors.filter((editor) => this.doIsSelected(editor));
  }
  isSelected(editorCandidateOrIndex) {
    let editor;
    if (typeof editorCandidateOrIndex === "number") {
      editor = this.editors[editorCandidateOrIndex];
    } else {
      editor = this.findEditor(editorCandidateOrIndex)?.[0];
    }
    return !!editor && this.doIsSelected(editor);
  }
  doIsSelected(editor) {
    return this.selection.includes(editor);
  }
  setSelection(activeSelectedEditorCandidate, inactiveSelectedEditorCandidates) {
    const res = this.findEditor(activeSelectedEditorCandidate);
    if (!res) {
      return;
    }
    const [activeSelectedEditor, activeSelectedEditorIndex] = res;
    const inactiveSelectedEditors = /* @__PURE__ */ new Set();
    for (const inactiveSelectedEditorCandidate of inactiveSelectedEditorCandidates) {
      const res2 = this.findEditor(inactiveSelectedEditorCandidate);
      if (!res2) {
        return;
      }
      const [inactiveSelectedEditor] = res2;
      if (inactiveSelectedEditor === activeSelectedEditor) {
        continue;
      }
      inactiveSelectedEditors.add(inactiveSelectedEditor);
    }
    this.doSetSelection(activeSelectedEditor, activeSelectedEditorIndex, Array.from(inactiveSelectedEditors));
  }
  doSetSelection(activeSelectedEditor, activeSelectedEditorIndex, inactiveSelectedEditors) {
    const previousActiveEditor = this.activeEditor;
    const previousSelection = this.selection;
    let newSelection;
    if (activeSelectedEditor) {
      newSelection = [activeSelectedEditor, ...inactiveSelectedEditors];
    } else {
      newSelection = [];
    }
    this.selection = newSelection;
    const activeEditorChanged = activeSelectedEditor && typeof activeSelectedEditorIndex === "number" && previousActiveEditor !== activeSelectedEditor;
    if (activeEditorChanged) {
      const mruIndex = this.indexOf(activeSelectedEditor, this.mru);
      this.mru.splice(mruIndex, 1);
      this.mru.unshift(activeSelectedEditor);
      const event = {
        kind: GroupModelChangeKind.EDITOR_ACTIVE,
        editor: activeSelectedEditor,
        editorIndex: activeSelectedEditorIndex
      };
      this._onDidModelChange.fire(event);
    }
    if (activeEditorChanged || previousSelection.length !== newSelection.length || previousSelection.some((editor) => !newSelection.includes(editor))) {
      const event = {
        kind: GroupModelChangeKind.EDITORS_SELECTION
      };
      this._onDidModelChange.fire(event);
    }
  }
  setIndex(index) {
    this._onDidModelChange.fire({ kind: GroupModelChangeKind.GROUP_INDEX });
  }
  setLabel(label) {
    this._onDidModelChange.fire({ kind: GroupModelChangeKind.GROUP_LABEL });
  }
  pin(candidate) {
    const res = this.findEditor(candidate);
    if (!res) {
      return;
    }
    const [editor, editorIndex] = res;
    this.doPin(editor, editorIndex);
    return editor;
  }
  doPin(editor, editorIndex) {
    if (this.isPinned(editor)) {
      return;
    }
    this.setTransient(editor, false);
    this.preview = null;
    const event = {
      kind: GroupModelChangeKind.EDITOR_PIN,
      editor,
      editorIndex
    };
    this._onDidModelChange.fire(event);
  }
  unpin(candidate) {
    const res = this.findEditor(candidate);
    if (!res) {
      return;
    }
    const [editor, editorIndex] = res;
    this.doUnpin(editor, editorIndex);
    return editor;
  }
  doUnpin(editor, editorIndex) {
    if (!this.isPinned(editor)) {
      return;
    }
    const oldPreview = this.preview;
    this.preview = editor;
    const event = {
      kind: GroupModelChangeKind.EDITOR_PIN,
      editor,
      editorIndex
    };
    this._onDidModelChange.fire(event);
    if (oldPreview) {
      this.closeEditor(oldPreview, EditorCloseContext.UNPIN);
    }
  }
  isPinned(editorCandidateOrIndex) {
    let editor;
    if (typeof editorCandidateOrIndex === "number") {
      editor = this.editors[editorCandidateOrIndex];
    } else {
      editor = editorCandidateOrIndex;
    }
    return !this.matches(this.preview, editor);
  }
  stick(candidate) {
    const res = this.findEditor(candidate);
    if (!res) {
      return;
    }
    const [editor, editorIndex] = res;
    this.doStick(editor, editorIndex);
    return editor;
  }
  doStick(editor, editorIndex) {
    if (this.isSticky(editorIndex)) {
      return;
    }
    this.pin(editor);
    const newEditorIndex = this.sticky + 1;
    this.moveEditor(editor, newEditorIndex);
    this.sticky++;
    const event = {
      kind: GroupModelChangeKind.EDITOR_STICKY,
      editor,
      editorIndex: newEditorIndex
    };
    this._onDidModelChange.fire(event);
  }
  unstick(candidate) {
    const res = this.findEditor(candidate);
    if (!res) {
      return;
    }
    const [editor, editorIndex] = res;
    this.doUnstick(editor, editorIndex);
    return editor;
  }
  doUnstick(editor, editorIndex) {
    if (!this.isSticky(editorIndex)) {
      return;
    }
    const newEditorIndex = this.sticky;
    this.moveEditor(editor, newEditorIndex);
    this.sticky--;
    const event = {
      kind: GroupModelChangeKind.EDITOR_STICKY,
      editor,
      editorIndex: newEditorIndex
    };
    this._onDidModelChange.fire(event);
  }
  isSticky(candidateOrIndex) {
    if (this.sticky < 0) {
      return false;
    }
    let index;
    if (typeof candidateOrIndex === "number") {
      index = candidateOrIndex;
    } else {
      index = this.indexOf(candidateOrIndex);
    }
    if (index < 0) {
      return false;
    }
    return index <= this.sticky;
  }
  setTransient(candidate, transient) {
    if (!transient && this.transient.size === 0) {
      return;
    }
    const res = this.findEditor(candidate);
    if (!res) {
      return;
    }
    const [editor, editorIndex] = res;
    this.doSetTransient(editor, editorIndex, transient);
    return editor;
  }
  doSetTransient(editor, editorIndex, transient) {
    if (transient) {
      if (this.transient.has(editor)) {
        return;
      }
      this.transient.add(editor);
    } else {
      if (!this.transient.has(editor)) {
        return;
      }
      this.transient.delete(editor);
    }
    const event = {
      kind: GroupModelChangeKind.EDITOR_TRANSIENT,
      editor,
      editorIndex
    };
    this._onDidModelChange.fire(event);
  }
  isTransient(editorCandidateOrIndex) {
    if (this.transient.size === 0) {
      return false;
    }
    let editor;
    if (typeof editorCandidateOrIndex === "number") {
      editor = this.editors[editorCandidateOrIndex];
    } else {
      editor = this.findEditor(editorCandidateOrIndex)?.[0];
    }
    return !!editor && this.transient.has(editor);
  }
  splice(index, del, editor) {
    const editorToDeleteOrReplace = this.editors[index];
    if (del && this.isSticky(index)) {
      this.sticky--;
    }
    if (editor) {
      this.editors.splice(index, del ? 1 : 0, editor);
    } else {
      this.editors.splice(index, del ? 1 : 0);
    }
    {
      if (!del && editor) {
        if (this.mru.length === 0) {
          this.mru.push(editor);
        } else {
          this.mru.splice(1, 0, editor);
        }
      } else {
        const indexInMRU = this.indexOf(editorToDeleteOrReplace, this.mru);
        if (del && !editor) {
          this.mru.splice(indexInMRU, 1);
        } else if (del && editor) {
          this.mru.splice(indexInMRU, 1, editor);
        }
      }
    }
  }
  indexOf(candidate, editors = this.editors, options) {
    let index = -1;
    if (!candidate) {
      return index;
    }
    for (let i = 0; i < editors.length; i++) {
      const editor = editors[i];
      if (this.matches(editor, candidate, options)) {
        if (options?.supportSideBySide && editor instanceof SideBySideEditorInput && !(candidate instanceof SideBySideEditorInput)) {
          index = i;
        } else {
          index = i;
          break;
        }
      }
    }
    return index;
  }
  findEditor(candidate, options) {
    const index = this.indexOf(candidate, this.editors, options);
    if (index === -1) {
      return void 0;
    }
    return [this.editors[index], index];
  }
  isFirst(candidate, editors = this.editors) {
    return this.matches(editors[0], candidate);
  }
  isLast(candidate, editors = this.editors) {
    return this.matches(editors[editors.length - 1], candidate);
  }
  contains(candidate, options) {
    return this.indexOf(candidate, this.editors, options) !== -1;
  }
  matches(editor, candidate, options) {
    if (!editor || !candidate) {
      return false;
    }
    if (options?.supportSideBySide && editor instanceof SideBySideEditorInput && !(candidate instanceof SideBySideEditorInput)) {
      switch (options.supportSideBySide) {
        case SideBySideEditor.ANY:
          if (this.matches(editor.primary, candidate, options) || this.matches(editor.secondary, candidate, options)) {
            return true;
          }
          break;
        case SideBySideEditor.BOTH:
          if (this.matches(editor.primary, candidate, options) && this.matches(editor.secondary, candidate, options)) {
            return true;
          }
          break;
      }
    }
    const strictEquals = editor === candidate;
    if (options?.strictEquals) {
      return strictEquals;
    }
    return strictEquals || editor.matches(candidate);
  }
  get isLocked() {
    return this.locked;
  }
  lock(locked) {
    if (this.isLocked !== locked) {
      this.locked = locked;
      this._onDidModelChange.fire({ kind: GroupModelChangeKind.GROUP_LOCKED });
    }
  }
  clone() {
    const clone = this.instantiationService.createInstance(EditorGroupModel, void 0);
    clone.editors = this.editors.slice(0);
    clone.mru = this.mru.slice(0);
    clone.preview = this.preview;
    clone.selection = this.selection.slice(0);
    clone.sticky = this.sticky;
    for (const editor of clone.editors) {
      clone.registerEditorListeners(editor);
    }
    return clone;
  }
  serialize() {
    const registry = Registry.as(EditorExtensions.EditorFactory);
    const serializableEditors = [];
    const serializedEditors = [];
    let serializablePreviewIndex;
    let serializableSticky = this.sticky;
    for (let i = 0; i < this.editors.length; i++) {
      const editor = this.editors[i];
      let canSerializeEditor = false;
      const editorSerializer = registry.getEditorSerializer(editor);
      if (editorSerializer) {
        const value = editorSerializer.canSerialize(editor) ? editorSerializer.serialize(editor) : void 0;
        if (typeof value === "string") {
          canSerializeEditor = true;
          serializedEditors.push({ id: editor.typeId, value });
          serializableEditors.push(editor);
          if (this.preview === editor) {
            serializablePreviewIndex = serializableEditors.length - 1;
          }
        } else {
          canSerializeEditor = false;
        }
      }
      if (!canSerializeEditor && this.isSticky(i)) {
        serializableSticky--;
      }
    }
    const serializableMru = this.mru.map((editor) => this.indexOf(editor, serializableEditors)).filter((i) => i >= 0);
    return {
      id: this.id,
      locked: this.locked ? true : void 0,
      editors: serializedEditors,
      mru: serializableMru,
      preview: serializablePreviewIndex,
      sticky: serializableSticky >= 0 ? serializableSticky : void 0
    };
  }
  deserialize(data) {
    const registry = Registry.as(EditorExtensions.EditorFactory);
    if (typeof data.id === "number") {
      this._id = data.id;
      EditorGroupModel.IDS = Math.max(data.id + 1, EditorGroupModel.IDS);
    } else {
      this._id = EditorGroupModel.IDS++;
    }
    if (data.locked) {
      this.locked = true;
    }
    this.editors = coalesce(data.editors.map((e, index) => {
      let editor = void 0;
      const editorSerializer = registry.getEditorSerializer(e.id);
      if (editorSerializer) {
        const deserializedEditor = editorSerializer.deserialize(this.instantiationService, e.value);
        if (deserializedEditor instanceof EditorInput) {
          editor = deserializedEditor;
          this.registerEditorListeners(editor);
        }
      }
      if (!editor && typeof data.sticky === "number" && index <= data.sticky) {
        data.sticky--;
      }
      return editor;
    }));
    this.mru = coalesce(data.mru.map((i) => this.editors[i]));
    this.selection = this.mru.length > 0 ? [this.mru[0]] : [];
    if (typeof data.preview === "number") {
      this.preview = this.editors[data.preview];
    }
    if (typeof data.sticky === "number") {
      this.sticky = data.sticky;
    }
    return this._id;
  }
  dispose() {
    dispose(Array.from(this.editorListeners));
    this.editorListeners.clear();
    this.transient.clear();
    super.dispose();
  }
};
EditorGroupModel.IDS = 0;
EditorGroupModel = __decorateClass([
  __decorateParam(1, IInstantiationService),
  __decorateParam(2, IConfigurationService)
], EditorGroupModel);
export {
  EditorGroupModel,
  isGroupEditorChangeEvent,
  isGroupEditorCloseEvent,
  isGroupEditorMoveEvent,
  isGroupEditorOpenEvent,
  isSerializedEditorGroupModel
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvY29tbW9uL2VkaXRvci9lZGl0b3JHcm91cE1vZGVsLnRzIl0sCiAgInNvdXJjZXNDb250ZW50IjogWyIvKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuICogIENvcHlyaWdodCAoYykgTWljcm9zb2Z0IENvcnBvcmF0aW9uLiBBbGwgcmlnaHRzIHJlc2VydmVkLlxuICogIExpY2Vuc2VkIHVuZGVyIHRoZSBNSVQgTGljZW5zZS4gU2VlIExpY2Vuc2UudHh0IGluIHRoZSBwcm9qZWN0IHJvb3QgZm9yIGxpY2Vuc2UgaW5mb3JtYXRpb24uXG4gKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tKi9cblxuaW1wb3J0IHsgRXZlbnQsIEVtaXR0ZXIgfSBmcm9tICcuLi8uLi8uLi9iYXNlL2NvbW1vbi9ldmVudC5qcyc7XG5pbXBvcnQgeyBJRWRpdG9yRmFjdG9yeVJlZ2lzdHJ5LCBHcm91cElkZW50aWZpZXIsIEVkaXRvcnNPcmRlciwgRWRpdG9yRXh0ZW5zaW9ucywgSVVudHlwZWRFZGl0b3JJbnB1dCwgU2lkZUJ5U2lkZUVkaXRvciwgRWRpdG9yQ2xvc2VDb250ZXh0LCBJTWF0Y2hFZGl0b3JPcHRpb25zLCBHcm91cE1vZGVsQ2hhbmdlS2luZCB9IGZyb20gJy4uL2VkaXRvci5qcyc7XG5pbXBvcnQgeyBFZGl0b3JJbnB1dCB9IGZyb20gJy4vZWRpdG9ySW5wdXQuanMnO1xuaW1wb3J0IHsgU2lkZUJ5U2lkZUVkaXRvcklucHV0IH0gZnJvbSAnLi9zaWRlQnlTaWRlRWRpdG9ySW5wdXQuanMnO1xuaW1wb3J0IHsgSUluc3RhbnRpYXRpb25TZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vcGxhdGZvcm0vaW5zdGFudGlhdGlvbi9jb21tb24vaW5zdGFudGlhdGlvbi5qcyc7XG5pbXBvcnQgeyBJQ29uZmlndXJhdGlvbkNoYW5nZUV2ZW50LCBJQ29uZmlndXJhdGlvblNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi9wbGF0Zm9ybS9jb25maWd1cmF0aW9uL2NvbW1vbi9jb25maWd1cmF0aW9uLmpzJztcbmltcG9ydCB7IGRpc3Bvc2UsIERpc3Bvc2FibGUsIERpc3Bvc2FibGVTdG9yZSB9IGZyb20gJy4uLy4uLy4uL2Jhc2UvY29tbW9uL2xpZmVjeWNsZS5qcyc7XG5pbXBvcnQgeyBSZWdpc3RyeSB9IGZyb20gJy4uLy4uLy4uL3BsYXRmb3JtL3JlZ2lzdHJ5L2NvbW1vbi9wbGF0Zm9ybS5qcyc7XG5pbXBvcnQgeyBjb2FsZXNjZSB9IGZyb20gJy4uLy4uLy4uL2Jhc2UvY29tbW9uL2FycmF5cy5qcyc7XG5cbmNvbnN0IEVkaXRvck9wZW5Qb3NpdGlvbmluZyA9IHtcblx0TEVGVDogJ2xlZnQnLFxuXHRSSUdIVDogJ3JpZ2h0Jyxcblx0RklSU1Q6ICdmaXJzdCcsXG5cdExBU1Q6ICdsYXN0J1xufTtcblxuZXhwb3J0IGludGVyZmFjZSBJRWRpdG9yT3Blbk9wdGlvbnMge1xuXHRyZWFkb25seSBwaW5uZWQ/OiBib29sZWFuO1xuXHRyZWFkb25seSBzdGlja3k/OiBib29sZWFuO1xuXHRyZWFkb25seSB0cmFuc2llbnQ/OiBib29sZWFuO1xuXHRhY3RpdmU/OiBib29sZWFuO1xuXHRyZWFkb25seSBpbmFjdGl2ZVNlbGVjdGlvbj86IEVkaXRvcklucHV0W107XG5cdHJlYWRvbmx5IGluZGV4PzogbnVtYmVyO1xuXHRyZWFkb25seSBzdXBwb3J0U2lkZUJ5U2lkZT86IFNpZGVCeVNpZGVFZGl0b3IuQU5ZIHwgU2lkZUJ5U2lkZUVkaXRvci5CT1RIO1xufVxuXG5leHBvcnQgaW50ZXJmYWNlIElFZGl0b3JPcGVuUmVzdWx0IHtcblx0cmVhZG9ubHkgZWRpdG9yOiBFZGl0b3JJbnB1dDtcblx0cmVhZG9ubHkgaXNOZXc6IGJvb2xlYW47XG59XG5cbmV4cG9ydCBpbnRlcmZhY2UgSVNlcmlhbGl6ZWRFZGl0b3JJbnB1dCB7XG5cdHJlYWRvbmx5IGlkOiBzdHJpbmc7XG5cdHJlYWRvbmx5IHZhbHVlOiBzdHJpbmc7XG59XG5cbmV4cG9ydCBpbnRlcmZhY2UgSVNlcmlhbGl6ZWRFZGl0b3JHcm91cE1vZGVsIHtcblx0cmVhZG9ubHkgaWQ6IG51bWJlcjtcblx0cmVhZG9ubHkgbG9ja2VkPzogYm9vbGVhbjtcblx0cmVhZG9ubHkgZWRpdG9yczogSVNlcmlhbGl6ZWRFZGl0b3JJbnB1dFtdO1xuXHRyZWFkb25seSBtcnU6IG51bWJlcltdO1xuXHRyZWFkb25seSBwcmV2aWV3PzogbnVtYmVyO1xuXHRzdGlja3k/OiBudW1iZXI7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBpc1NlcmlhbGl6ZWRFZGl0b3JHcm91cE1vZGVsKGdyb3VwPzogdW5rbm93bik6IGdyb3VwIGlzIElTZXJpYWxpemVkRWRpdG9yR3JvdXBNb2RlbCB7XG5cdGNvbnN0IGNhbmRpZGF0ZSA9IGdyb3VwIGFzIElTZXJpYWxpemVkRWRpdG9yR3JvdXBNb2RlbCB8IHVuZGVmaW5lZDtcblxuXHRyZXR1cm4gISEoY2FuZGlkYXRlICYmIHR5cGVvZiBjYW5kaWRhdGUgPT09ICdvYmplY3QnICYmIEFycmF5LmlzQXJyYXkoY2FuZGlkYXRlLmVkaXRvcnMpICYmIEFycmF5LmlzQXJyYXkoY2FuZGlkYXRlLm1ydSkpO1xufVxuXG5leHBvcnQgaW50ZXJmYWNlIElNYXRjaE9wdGlvbnMge1xuXG5cdC8qKlxuXHQgKiBXaGV0aGVyIHRvIGNvbnNpZGVyIGEgc2lkZSBieSBzaWRlIGVkaXRvciBhcyBtYXRjaGluZy5cblx0ICogQnkgZGVmYXVsdCwgc2lkZSBieSBzaWRlIGVkaXRvcnMgd2lsbCBub3QgYmUgY29uc2lkZXJlZFxuXHQgKiBhcyBtYXRjaGluZywgZXZlbiBpZiB0aGUgZWRpdG9yIGlzIG9wZW5lZCBpbiBvbmUgb2YgdGhlIHNpZGVzLlxuXHQgKi9cblx0cmVhZG9ubHkgc3VwcG9ydFNpZGVCeVNpZGU/OiBTaWRlQnlTaWRlRWRpdG9yLkFOWSB8IFNpZGVCeVNpZGVFZGl0b3IuQk9USDtcblxuXHQvKipcblx0ICogT25seSBjb25zaWRlciBhbiBlZGl0b3IgdG8gbWF0Y2ggd2hlbiB0aGVcblx0ICogYGNhbmRpZGF0ZSA9PT0gZWRpdG9yYCBidXQgbm90IHdoZW5cblx0ICogYGNhbmRpZGF0ZS5tYXRjaGVzKGVkaXRvcilgLlxuXHQgKi9cblx0cmVhZG9ubHkgc3RyaWN0RXF1YWxzPzogYm9vbGVhbjtcbn1cblxuZXhwb3J0IGludGVyZmFjZSBJR3JvdXBNb2RlbENoYW5nZUV2ZW50IHtcblxuXHQvKipcblx0ICogVGhlIGtpbmQgb2YgY2hhbmdlIHRoYXQgb2NjdXJyZWQgaW4gdGhlIGdyb3VwIG1vZGVsLlxuXHQgKi9cblx0cmVhZG9ubHkga2luZDogR3JvdXBNb2RlbENoYW5nZUtpbmQ7XG5cblx0LyoqXG5cdCAqIE9ubHkgYXBwbGllcyB3aGVuIGVkaXRvcnMgY2hhbmdlIHByb3ZpZGluZ1xuXHQgKiBhY2Nlc3MgdG8gdGhlIGVkaXRvciB0aGUgZXZlbnQgaXMgYWJvdXQuXG5cdCAqL1xuXHRyZWFkb25seSBlZGl0b3I/OiBFZGl0b3JJbnB1dDtcblxuXHQvKipcblx0ICogT25seSBhcHBsaWVzIHdoZW4gZWRpdG9ycyBjaGFuZ2UgcHJvdmlkaW5nXG5cdCAqIGFjY2VzcyB0byB0aGUgaW5kZXggb2YgdGhlIGVkaXRvciB0aGUgZXZlbnRcblx0ICogaXMgYWJvdXQuXG5cdCAqL1xuXHRyZWFkb25seSBlZGl0b3JJbmRleD86IG51bWJlcjtcbn1cblxuZXhwb3J0IGludGVyZmFjZSBJR3JvdXBFZGl0b3JDaGFuZ2VFdmVudCBleHRlbmRzIElHcm91cE1vZGVsQ2hhbmdlRXZlbnQge1xuXHRyZWFkb25seSBlZGl0b3I6IEVkaXRvcklucHV0O1xuXHRyZWFkb25seSBlZGl0b3JJbmRleDogbnVtYmVyO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gaXNHcm91cEVkaXRvckNoYW5nZUV2ZW50KGU6IElHcm91cE1vZGVsQ2hhbmdlRXZlbnQpOiBlIGlzIElHcm91cEVkaXRvckNoYW5nZUV2ZW50IHtcblx0Y29uc3QgY2FuZGlkYXRlID0gZSBhcyBJR3JvdXBFZGl0b3JPcGVuRXZlbnQ7XG5cblx0cmV0dXJuIGNhbmRpZGF0ZS5lZGl0b3IgJiYgY2FuZGlkYXRlLmVkaXRvckluZGV4ICE9PSB1bmRlZmluZWQ7XG59XG5cbmV4cG9ydCBpbnRlcmZhY2UgSUdyb3VwRWRpdG9yT3BlbkV2ZW50IGV4dGVuZHMgSUdyb3VwRWRpdG9yQ2hhbmdlRXZlbnQge1xuXG5cdHJlYWRvbmx5IGtpbmQ6IEdyb3VwTW9kZWxDaGFuZ2VLaW5kLkVESVRPUl9PUEVOO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gaXNHcm91cEVkaXRvck9wZW5FdmVudChlOiBJR3JvdXBNb2RlbENoYW5nZUV2ZW50KTogZSBpcyBJR3JvdXBFZGl0b3JPcGVuRXZlbnQge1xuXHRjb25zdCBjYW5kaWRhdGUgPSBlIGFzIElHcm91cEVkaXRvck9wZW5FdmVudDtcblxuXHRyZXR1cm4gY2FuZGlkYXRlLmtpbmQgPT09IEdyb3VwTW9kZWxDaGFuZ2VLaW5kLkVESVRPUl9PUEVOICYmIGNhbmRpZGF0ZS5lZGl0b3JJbmRleCAhPT0gdW5kZWZpbmVkO1xufVxuXG5leHBvcnQgaW50ZXJmYWNlIElHcm91cEVkaXRvck1vdmVFdmVudCBleHRlbmRzIElHcm91cEVkaXRvckNoYW5nZUV2ZW50IHtcblxuXHRyZWFkb25seSBraW5kOiBHcm91cE1vZGVsQ2hhbmdlS2luZC5FRElUT1JfTU9WRTtcblxuXHQvKipcblx0ICogU2lnbmlmaWVzIHRoZSBpbmRleCB0aGUgZWRpdG9yIGlzIG1vdmluZyBmcm9tLlxuXHQgKiBgZWRpdG9ySW5kZXhgIHdpbGwgY29udGFpbiB0aGUgaW5kZXggdGhlIGVkaXRvclxuXHQgKiBpcyBtb3ZpbmcgdG8uXG5cdCAqL1xuXHRyZWFkb25seSBvbGRFZGl0b3JJbmRleDogbnVtYmVyO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gaXNHcm91cEVkaXRvck1vdmVFdmVudChlOiBJR3JvdXBNb2RlbENoYW5nZUV2ZW50KTogZSBpcyBJR3JvdXBFZGl0b3JNb3ZlRXZlbnQge1xuXHRjb25zdCBjYW5kaWRhdGUgPSBlIGFzIElHcm91cEVkaXRvck1vdmVFdmVudDtcblxuXHRyZXR1cm4gY2FuZGlkYXRlLmtpbmQgPT09IEdyb3VwTW9kZWxDaGFuZ2VLaW5kLkVESVRPUl9NT1ZFICYmIGNhbmRpZGF0ZS5lZGl0b3JJbmRleCAhPT0gdW5kZWZpbmVkICYmIGNhbmRpZGF0ZS5vbGRFZGl0b3JJbmRleCAhPT0gdW5kZWZpbmVkO1xufVxuXG5leHBvcnQgaW50ZXJmYWNlIElHcm91cEVkaXRvckNsb3NlRXZlbnQgZXh0ZW5kcyBJR3JvdXBFZGl0b3JDaGFuZ2VFdmVudCB7XG5cblx0cmVhZG9ubHkga2luZDogR3JvdXBNb2RlbENoYW5nZUtpbmQuRURJVE9SX0NMT1NFO1xuXG5cdC8qKlxuXHQgKiBTaWduaWZpZXMgdGhlIGNvbnRleHQgaW4gd2hpY2ggdGhlIGVkaXRvclxuXHQgKiBpcyBiZWluZyBjbG9zZWQuIFRoaXMgYWxsb3dzIGZvciB1bmRlcnN0YW5kaW5nXG5cdCAqIGlmIGEgcmVwbGFjZSBvciByZW9wZW4gaXMgb2NjdXJyaW5nXG5cdCAqL1xuXHRyZWFkb25seSBjb250ZXh0OiBFZGl0b3JDbG9zZUNvbnRleHQ7XG5cblx0LyoqXG5cdCAqIFNpZ25pZmllcyB3aGV0aGVyIG9yIG5vdCB0aGUgY2xvc2VkIGVkaXRvciB3YXNcblx0ICogc3RpY2t5LiBUaGlzIGlzIG5lY2Vzc2FyeSBiZWNhc3VlIHN0YXRlIGlzIGxvc3Rcblx0ICogYWZ0ZXIgY2xvc2luZy5cblx0ICovXG5cdHJlYWRvbmx5IHN0aWNreTogYm9vbGVhbjtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGlzR3JvdXBFZGl0b3JDbG9zZUV2ZW50KGU6IElHcm91cE1vZGVsQ2hhbmdlRXZlbnQpOiBlIGlzIElHcm91cEVkaXRvckNsb3NlRXZlbnQge1xuXHRjb25zdCBjYW5kaWRhdGUgPSBlIGFzIElHcm91cEVkaXRvckNsb3NlRXZlbnQ7XG5cblx0cmV0dXJuIGNhbmRpZGF0ZS5raW5kID09PSBHcm91cE1vZGVsQ2hhbmdlS2luZC5FRElUT1JfQ0xPU0UgJiYgY2FuZGlkYXRlLmVkaXRvckluZGV4ICE9PSB1bmRlZmluZWQgJiYgY2FuZGlkYXRlLmNvbnRleHQgIT09IHVuZGVmaW5lZCAmJiBjYW5kaWRhdGUuc3RpY2t5ICE9PSB1bmRlZmluZWQ7XG59XG5cbmludGVyZmFjZSBJRWRpdG9yQ2xvc2VSZXN1bHQge1xuXHRyZWFkb25seSBlZGl0b3I6IEVkaXRvcklucHV0O1xuXHRyZWFkb25seSBjb250ZXh0OiBFZGl0b3JDbG9zZUNvbnRleHQ7XG5cdHJlYWRvbmx5IGVkaXRvckluZGV4OiBudW1iZXI7XG5cdHJlYWRvbmx5IHN0aWNreTogYm9vbGVhbjtcbn1cblxuZXhwb3J0IGludGVyZmFjZSBJUmVhZG9ubHlFZGl0b3JHcm91cE1vZGVsIHtcblxuXHRyZWFkb25seSBvbkRpZE1vZGVsQ2hhbmdlOiBFdmVudDxJR3JvdXBNb2RlbENoYW5nZUV2ZW50PjtcblxuXHRyZWFkb25seSBpZDogR3JvdXBJZGVudGlmaWVyO1xuXHRyZWFkb25seSBjb3VudDogbnVtYmVyO1xuXHRyZWFkb25seSBzdGlja3lDb3VudDogbnVtYmVyO1xuXHRyZWFkb25seSBpc0xvY2tlZDogYm9vbGVhbjtcblx0cmVhZG9ubHkgYWN0aXZlRWRpdG9yOiBFZGl0b3JJbnB1dCB8IG51bGw7XG5cdHJlYWRvbmx5IHByZXZpZXdFZGl0b3I6IEVkaXRvcklucHV0IHwgbnVsbDtcblx0cmVhZG9ubHkgc2VsZWN0ZWRFZGl0b3JzOiBFZGl0b3JJbnB1dFtdO1xuXG5cdGdldEVkaXRvcnMob3JkZXI6IEVkaXRvcnNPcmRlciwgb3B0aW9ucz86IHsgZXhjbHVkZVN0aWNreT86IGJvb2xlYW4gfSk6IEVkaXRvcklucHV0W107XG5cdGdldEVkaXRvckJ5SW5kZXgoaW5kZXg6IG51bWJlcik6IEVkaXRvcklucHV0IHwgdW5kZWZpbmVkO1xuXHRpbmRleE9mKGVkaXRvcjogRWRpdG9ySW5wdXQgfCBJVW50eXBlZEVkaXRvcklucHV0IHwgbnVsbCwgZWRpdG9ycz86IEVkaXRvcklucHV0W10sIG9wdGlvbnM/OiBJTWF0Y2hFZGl0b3JPcHRpb25zKTogbnVtYmVyO1xuXHRpc0FjdGl2ZShlZGl0b3I6IEVkaXRvcklucHV0IHwgSVVudHlwZWRFZGl0b3JJbnB1dCk6IGJvb2xlYW47XG5cdGlzUGlubmVkKGVkaXRvck9ySW5kZXg6IEVkaXRvcklucHV0IHwgbnVtYmVyKTogYm9vbGVhbjtcblx0aXNTdGlja3koZWRpdG9yT3JJbmRleDogRWRpdG9ySW5wdXQgfCBudW1iZXIpOiBib29sZWFuO1xuXHRpc1NlbGVjdGVkKGVkaXRvck9ySW5kZXg6IEVkaXRvcklucHV0IHwgbnVtYmVyKTogYm9vbGVhbjtcblx0aXNUcmFuc2llbnQoZWRpdG9yT3JJbmRleDogRWRpdG9ySW5wdXQgfCBudW1iZXIpOiBib29sZWFuO1xuXHRpc0ZpcnN0KGVkaXRvcjogRWRpdG9ySW5wdXQsIGVkaXRvcnM/OiBFZGl0b3JJbnB1dFtdKTogYm9vbGVhbjtcblx0aXNMYXN0KGVkaXRvcjogRWRpdG9ySW5wdXQsIGVkaXRvcnM/OiBFZGl0b3JJbnB1dFtdKTogYm9vbGVhbjtcblx0ZmluZEVkaXRvcihlZGl0b3I6IEVkaXRvcklucHV0IHwgbnVsbCwgb3B0aW9ucz86IElNYXRjaEVkaXRvck9wdGlvbnMpOiBbRWRpdG9ySW5wdXQsIG51bWJlciAvKiBpbmRleCAqL10gfCB1bmRlZmluZWQ7XG5cdGNvbnRhaW5zKGVkaXRvcjogRWRpdG9ySW5wdXQgfCBJVW50eXBlZEVkaXRvcklucHV0LCBvcHRpb25zPzogSU1hdGNoRWRpdG9yT3B0aW9ucyk6IGJvb2xlYW47XG59XG5cbmludGVyZmFjZSBJRWRpdG9yR3JvdXBNb2RlbCBleHRlbmRzIElSZWFkb25seUVkaXRvckdyb3VwTW9kZWwge1xuXHRvcGVuRWRpdG9yKGVkaXRvcjogRWRpdG9ySW5wdXQsIG9wdGlvbnM/OiBJRWRpdG9yT3Blbk9wdGlvbnMpOiBJRWRpdG9yT3BlblJlc3VsdDtcblx0Y2xvc2VFZGl0b3IoZWRpdG9yOiBFZGl0b3JJbnB1dCwgY29udGV4dD86IEVkaXRvckNsb3NlQ29udGV4dCwgb3Blbk5leHQ/OiBib29sZWFuKTogSUVkaXRvckNsb3NlUmVzdWx0IHwgdW5kZWZpbmVkO1xuXHRtb3ZlRWRpdG9yKGVkaXRvcjogRWRpdG9ySW5wdXQsIHRvSW5kZXg6IG51bWJlcik6IEVkaXRvcklucHV0IHwgdW5kZWZpbmVkO1xuXHRzZXRBY3RpdmUoZWRpdG9yOiBFZGl0b3JJbnB1dCB8IHVuZGVmaW5lZCk6IEVkaXRvcklucHV0IHwgdW5kZWZpbmVkO1xuXHRzZXRTZWxlY3Rpb24oYWN0aXZlU2VsZWN0ZWRFZGl0b3I6IEVkaXRvcklucHV0LCBpbmFjdGl2ZVNlbGVjdGVkRWRpdG9yczogRWRpdG9ySW5wdXRbXSk6IHZvaWQ7XG59XG5cbmV4cG9ydCBjbGFzcyBFZGl0b3JHcm91cE1vZGVsIGV4dGVuZHMgRGlzcG9zYWJsZSBpbXBsZW1lbnRzIElFZGl0b3JHcm91cE1vZGVsIHtcblxuXHRwcml2YXRlIHN0YXRpYyBJRFMgPSAwO1xuXG5cdC8vI3JlZ2lvbiBldmVudHNcblxuXHRwcml2YXRlIHJlYWRvbmx5IF9vbkRpZE1vZGVsQ2hhbmdlID0gdGhpcy5fcmVnaXN0ZXIobmV3IEVtaXR0ZXI8SUdyb3VwTW9kZWxDaGFuZ2VFdmVudD4oeyBsZWFrV2FybmluZ1RocmVzaG9sZDogNTAwIC8qIGluY3JlYXNlZCBmb3IgdXNlcnMgd2l0aCBodW5kcmVkcyBvZiBpbnB1dHMgb3BlbmVkICovIH0pKTtcblx0cmVhZG9ubHkgb25EaWRNb2RlbENoYW5nZSA9IHRoaXMuX29uRGlkTW9kZWxDaGFuZ2UuZXZlbnQ7XG5cblx0Ly8jZW5kcmVnaW9uXG5cblx0cHJpdmF0ZSBfaWQ6IEdyb3VwSWRlbnRpZmllcjtcblx0Z2V0IGlkKCk6IEdyb3VwSWRlbnRpZmllciB7IHJldHVybiB0aGlzLl9pZDsgfVxuXG5cdHByaXZhdGUgZWRpdG9yczogRWRpdG9ySW5wdXRbXSA9IFtdO1xuXHRwcml2YXRlIG1ydTogRWRpdG9ySW5wdXRbXSA9IFtdO1xuXG5cdHByaXZhdGUgcmVhZG9ubHkgZWRpdG9yTGlzdGVuZXJzID0gbmV3IFNldDxEaXNwb3NhYmxlU3RvcmU+KCk7XG5cblx0cHJpdmF0ZSBsb2NrZWQgPSBmYWxzZTtcblxuXHRwcml2YXRlIHNlbGVjdGlvbjogRWRpdG9ySW5wdXRbXSA9IFtdO1x0XHRcdFx0XHQvLyBlZGl0b3JzIGluIHNlbGVjdGVkIHN0YXRlLCBmaXJzdCBvbmUgaXMgYWN0aXZlXG5cblx0cHJpdmF0ZSBnZXQgYWN0aXZlKCk6IEVkaXRvcklucHV0IHwgbnVsbCB7XG5cdFx0cmV0dXJuIHRoaXMuc2VsZWN0aW9uWzBdID8/IG51bGw7XG5cdH1cblxuXHRwcml2YXRlIHByZXZpZXc6IEVkaXRvcklucHV0IHwgbnVsbCA9IG51bGw7IFx0XHRcdC8vIGVkaXRvciBpbiBwcmV2aWV3IHN0YXRlXG5cdHByaXZhdGUgc3RpY2t5ID0gLTE7XHRcdFx0XHRcdFx0XHRcdFx0Ly8gaW5kZXggb2YgZmlyc3QgZWRpdG9yIGluIHN0aWNreSBzdGF0ZVxuXHRwcml2YXRlIHJlYWRvbmx5IHRyYW5zaWVudCA9IG5ldyBTZXQ8RWRpdG9ySW5wdXQ+KCk7IFx0Ly8gZWRpdG9ycyBpbiB0cmFuc2llbnQgc3RhdGVcblxuXHRwcml2YXRlIGVkaXRvck9wZW5Qb3NpdGlvbmluZzogKCdsZWZ0JyB8ICdyaWdodCcgfCAnZmlyc3QnIHwgJ2xhc3QnKSB8IHVuZGVmaW5lZDtcblx0cHJpdmF0ZSBmb2N1c1JlY2VudEVkaXRvckFmdGVyQ2xvc2U6IGJvb2xlYW4gfCB1bmRlZmluZWQ7XG5cblx0Y29uc3RydWN0b3IoXG5cdFx0bGFiZWxPclNlcmlhbGl6ZWRHcm91cDogSVNlcmlhbGl6ZWRFZGl0b3JHcm91cE1vZGVsIHwgdW5kZWZpbmVkLFxuXHRcdEBJSW5zdGFudGlhdGlvblNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBpbnN0YW50aWF0aW9uU2VydmljZTogSUluc3RhbnRpYXRpb25TZXJ2aWNlLFxuXHRcdEBJQ29uZmlndXJhdGlvblNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBjb25maWd1cmF0aW9uU2VydmljZTogSUNvbmZpZ3VyYXRpb25TZXJ2aWNlXG5cdCkge1xuXHRcdHN1cGVyKCk7XG5cblx0XHRpZiAoaXNTZXJpYWxpemVkRWRpdG9yR3JvdXBNb2RlbChsYWJlbE9yU2VyaWFsaXplZEdyb3VwKSkge1xuXHRcdFx0dGhpcy5faWQgPSB0aGlzLmRlc2VyaWFsaXplKGxhYmVsT3JTZXJpYWxpemVkR3JvdXApO1xuXHRcdH0gZWxzZSB7XG5cdFx0XHR0aGlzLl9pZCA9IEVkaXRvckdyb3VwTW9kZWwuSURTKys7XG5cdFx0fVxuXG5cdFx0dGhpcy5vbkNvbmZpZ3VyYXRpb25VcGRhdGVkKCk7XG5cdFx0dGhpcy5yZWdpc3Rlckxpc3RlbmVycygpO1xuXHR9XG5cblx0cHJpdmF0ZSByZWdpc3Rlckxpc3RlbmVycygpOiB2b2lkIHtcblx0XHR0aGlzLl9yZWdpc3Rlcih0aGlzLmNvbmZpZ3VyYXRpb25TZXJ2aWNlLm9uRGlkQ2hhbmdlQ29uZmlndXJhdGlvbihlID0+IHRoaXMub25Db25maWd1cmF0aW9uVXBkYXRlZChlKSkpO1xuXHR9XG5cblx0cHJpdmF0ZSBvbkNvbmZpZ3VyYXRpb25VcGRhdGVkKGU/OiBJQ29uZmlndXJhdGlvbkNoYW5nZUV2ZW50KTogdm9pZCB7XG5cdFx0aWYgKGUgJiYgIWUuYWZmZWN0c0NvbmZpZ3VyYXRpb24oJ3dvcmtiZW5jaC5lZGl0b3Iub3BlblBvc2l0aW9uaW5nJykgJiYgIWUuYWZmZWN0c0NvbmZpZ3VyYXRpb24oJ3dvcmtiZW5jaC5lZGl0b3IuZm9jdXNSZWNlbnRFZGl0b3JBZnRlckNsb3NlJykpIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cblx0XHR0aGlzLmVkaXRvck9wZW5Qb3NpdGlvbmluZyA9IHRoaXMuY29uZmlndXJhdGlvblNlcnZpY2UuZ2V0VmFsdWUoJ3dvcmtiZW5jaC5lZGl0b3Iub3BlblBvc2l0aW9uaW5nJyk7XG5cdFx0dGhpcy5mb2N1c1JlY2VudEVkaXRvckFmdGVyQ2xvc2UgPSB0aGlzLmNvbmZpZ3VyYXRpb25TZXJ2aWNlLmdldFZhbHVlKCd3b3JrYmVuY2guZWRpdG9yLmZvY3VzUmVjZW50RWRpdG9yQWZ0ZXJDbG9zZScpO1xuXHR9XG5cblx0Z2V0IGNvdW50KCk6IG51bWJlciB7XG5cdFx0cmV0dXJuIHRoaXMuZWRpdG9ycy5sZW5ndGg7XG5cdH1cblxuXHRnZXQgc3RpY2t5Q291bnQoKTogbnVtYmVyIHtcblx0XHRyZXR1cm4gdGhpcy5zdGlja3kgKyAxO1xuXHR9XG5cblx0Z2V0RWRpdG9ycyhvcmRlcjogRWRpdG9yc09yZGVyLCBvcHRpb25zPzogeyBleGNsdWRlU3RpY2t5PzogYm9vbGVhbiB9KTogRWRpdG9ySW5wdXRbXSB7XG5cdFx0Y29uc3QgZWRpdG9ycyA9IG9yZGVyID09PSBFZGl0b3JzT3JkZXIuTU9TVF9SRUNFTlRMWV9BQ1RJVkUgPyB0aGlzLm1ydS5zbGljZSgwKSA6IHRoaXMuZWRpdG9ycy5zbGljZSgwKTtcblxuXHRcdGlmIChvcHRpb25zPy5leGNsdWRlU3RpY2t5KSB7XG5cblx0XHRcdC8vIE1SVTogbmVlZCB0byBjaGVjayBmb3IgaW5kZXggb24gZWFjaFxuXHRcdFx0aWYgKG9yZGVyID09PSBFZGl0b3JzT3JkZXIuTU9TVF9SRUNFTlRMWV9BQ1RJVkUpIHtcblx0XHRcdFx0cmV0dXJuIGVkaXRvcnMuZmlsdGVyKGVkaXRvciA9PiAhdGhpcy5pc1N0aWNreShlZGl0b3IpKTtcblx0XHRcdH1cblxuXHRcdFx0Ly8gU2VxdWVudGlhbDogc2ltcGx5IHN0YXJ0IGFmdGVyIHN0aWNreSBpbmRleFxuXHRcdFx0cmV0dXJuIGVkaXRvcnMuc2xpY2UodGhpcy5zdGlja3kgKyAxKTtcblx0XHR9XG5cblx0XHRyZXR1cm4gZWRpdG9ycztcblx0fVxuXG5cdGdldEVkaXRvckJ5SW5kZXgoaW5kZXg6IG51bWJlcik6IEVkaXRvcklucHV0IHwgdW5kZWZpbmVkIHtcblx0XHRyZXR1cm4gdGhpcy5lZGl0b3JzW2luZGV4XTtcblx0fVxuXG5cdGdldCBhY3RpdmVFZGl0b3IoKTogRWRpdG9ySW5wdXQgfCBudWxsIHtcblx0XHRyZXR1cm4gdGhpcy5hY3RpdmU7XG5cdH1cblxuXHRpc0FjdGl2ZShjYW5kaWRhdGU6IEVkaXRvcklucHV0IHwgSVVudHlwZWRFZGl0b3JJbnB1dCk6IGJvb2xlYW4ge1xuXHRcdHJldHVybiB0aGlzLm1hdGNoZXModGhpcy5hY3RpdmUsIGNhbmRpZGF0ZSk7XG5cdH1cblxuXHRnZXQgcHJldmlld0VkaXRvcigpOiBFZGl0b3JJbnB1dCB8IG51bGwge1xuXHRcdHJldHVybiB0aGlzLnByZXZpZXc7XG5cdH1cblxuXHRvcGVuRWRpdG9yKGNhbmRpZGF0ZTogRWRpdG9ySW5wdXQsIG9wdGlvbnM/OiBJRWRpdG9yT3Blbk9wdGlvbnMpOiBJRWRpdG9yT3BlblJlc3VsdCB7XG5cdFx0Y29uc3QgbWFrZVN0aWNreSA9IG9wdGlvbnM/LnN0aWNreSB8fCAodHlwZW9mIG9wdGlvbnM/LmluZGV4ID09PSAnbnVtYmVyJyAmJiB0aGlzLmlzU3RpY2t5KG9wdGlvbnMuaW5kZXgpKTtcblx0XHRjb25zdCBtYWtlUGlubmVkID0gb3B0aW9ucz8ucGlubmVkIHx8IG9wdGlvbnM/LnN0aWNreTtcblx0XHRjb25zdCBtYWtlVHJhbnNpZW50ID0gISFvcHRpb25zPy50cmFuc2llbnQ7XG5cdFx0Y29uc3QgbWFrZUFjdGl2ZSA9IG9wdGlvbnM/LmFjdGl2ZSB8fCAhdGhpcy5hY3RpdmVFZGl0b3IgfHwgKCFtYWtlUGlubmVkICYmIHRoaXMucHJldmlldyA9PT0gdGhpcy5hY3RpdmVFZGl0b3IpO1xuXG5cdFx0Y29uc3QgZXhpc3RpbmdFZGl0b3JBbmRJbmRleCA9IHRoaXMuZmluZEVkaXRvcihjYW5kaWRhdGUsIG9wdGlvbnMpO1xuXG5cdFx0Ly8gTmV3IGVkaXRvclxuXHRcdGlmICghZXhpc3RpbmdFZGl0b3JBbmRJbmRleCkge1xuXHRcdFx0Y29uc3QgbmV3RWRpdG9yID0gY2FuZGlkYXRlO1xuXHRcdFx0Y29uc3QgaW5kZXhPZkFjdGl2ZSA9IHRoaXMuaW5kZXhPZih0aGlzLmFjdGl2ZSk7XG5cblx0XHRcdC8vIEluc2VydCBpbnRvIHNwZWNpZmljIHBvc2l0aW9uXG5cdFx0XHRsZXQgdGFyZ2V0SW5kZXg6IG51bWJlcjtcblx0XHRcdGlmIChvcHRpb25zICYmIHR5cGVvZiBvcHRpb25zLmluZGV4ID09PSAnbnVtYmVyJykge1xuXHRcdFx0XHR0YXJnZXRJbmRleCA9IG9wdGlvbnMuaW5kZXg7XG5cdFx0XHR9XG5cblx0XHRcdC8vIEluc2VydCB0byB0aGUgQkVHSU5OSU5HXG5cdFx0XHRlbHNlIGlmICh0aGlzLmVkaXRvck9wZW5Qb3NpdGlvbmluZyA9PT0gRWRpdG9yT3BlblBvc2l0aW9uaW5nLkZJUlNUKSB7XG5cdFx0XHRcdHRhcmdldEluZGV4ID0gMDtcblxuXHRcdFx0XHQvLyBBbHdheXMgbWFrZSBzdXJlIHRhcmdldEluZGV4IGlzIGFmdGVyIHN0aWNreSBlZGl0b3JzXG5cdFx0XHRcdC8vIHVubGVzcyB3ZSBhcmUgZXhwbGljaXRseSB0b2xkIHRvIG1ha2UgdGhlIGVkaXRvciBzdGlja3lcblx0XHRcdFx0aWYgKCFtYWtlU3RpY2t5ICYmIHRoaXMuaXNTdGlja3kodGFyZ2V0SW5kZXgpKSB7XG5cdFx0XHRcdFx0dGFyZ2V0SW5kZXggPSB0aGlzLnN0aWNreSArIDE7XG5cdFx0XHRcdH1cblx0XHRcdH1cblxuXHRcdFx0Ly8gSW5zZXJ0IHRvIHRoZSBFTkRcblx0XHRcdGVsc2UgaWYgKHRoaXMuZWRpdG9yT3BlblBvc2l0aW9uaW5nID09PSBFZGl0b3JPcGVuUG9zaXRpb25pbmcuTEFTVCkge1xuXHRcdFx0XHR0YXJnZXRJbmRleCA9IHRoaXMuZWRpdG9ycy5sZW5ndGg7XG5cdFx0XHR9XG5cblx0XHRcdC8vIEluc2VydCB0byBMRUZUIG9yIFJJR0hUIG9mIGFjdGl2ZSBlZGl0b3Jcblx0XHRcdGVsc2Uge1xuXG5cdFx0XHRcdC8vIEluc2VydCB0byB0aGUgTEVGVCBvZiBhY3RpdmUgZWRpdG9yXG5cdFx0XHRcdGlmICh0aGlzLmVkaXRvck9wZW5Qb3NpdGlvbmluZyA9PT0gRWRpdG9yT3BlblBvc2l0aW9uaW5nLkxFRlQpIHtcblx0XHRcdFx0XHRpZiAoaW5kZXhPZkFjdGl2ZSA9PT0gMCB8fCAhdGhpcy5lZGl0b3JzLmxlbmd0aCkge1xuXHRcdFx0XHRcdFx0dGFyZ2V0SW5kZXggPSAwOyAvLyB0byB0aGUgbGVmdCBiZWNvbWluZyBmaXJzdCBlZGl0b3IgaW4gbGlzdFxuXHRcdFx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdFx0XHR0YXJnZXRJbmRleCA9IGluZGV4T2ZBY3RpdmU7IC8vIHRvIHRoZSBsZWZ0IG9mIGFjdGl2ZSBlZGl0b3Jcblx0XHRcdFx0XHR9XG5cdFx0XHRcdH1cblxuXHRcdFx0XHQvLyBJbnNlcnQgdG8gdGhlIFJJR0hUIG9mIGFjdGl2ZSBlZGl0b3Jcblx0XHRcdFx0ZWxzZSB7XG5cdFx0XHRcdFx0dGFyZ2V0SW5kZXggPSBpbmRleE9mQWN0aXZlICsgMTtcblx0XHRcdFx0fVxuXG5cdFx0XHRcdC8vIEFsd2F5cyBtYWtlIHN1cmUgdGFyZ2V0SW5kZXggaXMgYWZ0ZXIgc3RpY2t5IGVkaXRvcnNcblx0XHRcdFx0Ly8gdW5sZXNzIHdlIGFyZSBleHBsaWNpdGx5IHRvbGQgdG8gbWFrZSB0aGUgZWRpdG9yIHN0aWNreVxuXHRcdFx0XHRpZiAoIW1ha2VTdGlja3kgJiYgdGhpcy5pc1N0aWNreSh0YXJnZXRJbmRleCkpIHtcblx0XHRcdFx0XHR0YXJnZXRJbmRleCA9IHRoaXMuc3RpY2t5ICsgMTtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXG5cdFx0XHQvLyBJZiB0aGUgZWRpdG9yIGJlY29tZXMgc3RpY2t5LCBpbmNyZW1lbnQgdGhlIHN0aWNreSBpbmRleCBhbmQgYWRqdXN0XG5cdFx0XHQvLyB0aGUgdGFyZ2V0SW5kZXggdG8gYmUgYXQgdGhlIGVuZCBvZiBzdGlja3kgZWRpdG9ycyB1bmxlc3MgYWxyZWFkeS5cblx0XHRcdGlmIChtYWtlU3RpY2t5KSB7XG5cdFx0XHRcdHRoaXMuc3RpY2t5Kys7XG5cblx0XHRcdFx0aWYgKCF0aGlzLmlzU3RpY2t5KHRhcmdldEluZGV4KSkge1xuXHRcdFx0XHRcdHRhcmdldEluZGV4ID0gdGhpcy5zdGlja3k7XG5cdFx0XHRcdH1cblx0XHRcdH1cblxuXHRcdFx0Ly8gSW5zZXJ0IGludG8gb3VyIGxpc3Qgb2YgZWRpdG9ycyBpZiBwaW5uZWQgb3Igd2UgaGF2ZSBubyBwcmV2aWV3IGVkaXRvclxuXHRcdFx0aWYgKG1ha2VQaW5uZWQgfHwgIXRoaXMucHJldmlldykge1xuXHRcdFx0XHR0aGlzLnNwbGljZSh0YXJnZXRJbmRleCwgZmFsc2UsIG5ld0VkaXRvcik7XG5cdFx0XHR9XG5cblx0XHRcdC8vIEhhbmRsZSB0cmFuc2llbnRcblx0XHRcdGlmIChtYWtlVHJhbnNpZW50KSB7XG5cdFx0XHRcdHRoaXMuZG9TZXRUcmFuc2llbnQobmV3RWRpdG9yLCB0YXJnZXRJbmRleCwgdHJ1ZSk7XG5cdFx0XHR9XG5cblx0XHRcdC8vIEhhbmRsZSBwcmV2aWV3XG5cdFx0XHRpZiAoIW1ha2VQaW5uZWQpIHtcblxuXHRcdFx0XHQvLyBSZXBsYWNlIGV4aXN0aW5nIHByZXZpZXcgd2l0aCB0aGlzIGVkaXRvciBpZiB3ZSBoYXZlIGEgcHJldmlld1xuXHRcdFx0XHRpZiAodGhpcy5wcmV2aWV3KSB7XG5cdFx0XHRcdFx0Y29uc3QgaW5kZXhPZlByZXZpZXcgPSB0aGlzLmluZGV4T2YodGhpcy5wcmV2aWV3KTtcblx0XHRcdFx0XHRpZiAodGFyZ2V0SW5kZXggPiBpbmRleE9mUHJldmlldykge1xuXHRcdFx0XHRcdFx0dGFyZ2V0SW5kZXgtLTsgLy8gYWNjb21vZGF0ZSBmb3IgdGhlIGZhY3QgdGhhdCB0aGUgcHJldmlldyBlZGl0b3IgY2xvc2VzXG5cdFx0XHRcdFx0fVxuXG5cdFx0XHRcdFx0dGhpcy5yZXBsYWNlRWRpdG9yKHRoaXMucHJldmlldywgbmV3RWRpdG9yLCB0YXJnZXRJbmRleCwgIW1ha2VBY3RpdmUpO1xuXHRcdFx0XHR9XG5cblx0XHRcdFx0dGhpcy5wcmV2aWV3ID0gbmV3RWRpdG9yO1xuXHRcdFx0fVxuXG5cdFx0XHQvLyBMaXN0ZW5lcnNcblx0XHRcdHRoaXMucmVnaXN0ZXJFZGl0b3JMaXN0ZW5lcnMobmV3RWRpdG9yKTtcblxuXHRcdFx0Ly8gRXZlbnRcblx0XHRcdGNvbnN0IGV2ZW50OiBJR3JvdXBFZGl0b3JPcGVuRXZlbnQgPSB7XG5cdFx0XHRcdGtpbmQ6IEdyb3VwTW9kZWxDaGFuZ2VLaW5kLkVESVRPUl9PUEVOLFxuXHRcdFx0XHRlZGl0b3I6IG5ld0VkaXRvcixcblx0XHRcdFx0ZWRpdG9ySW5kZXg6IHRhcmdldEluZGV4XG5cdFx0XHR9O1xuXHRcdFx0dGhpcy5fb25EaWRNb2RlbENoYW5nZS5maXJlKGV2ZW50KTtcblxuXHRcdFx0Ly8gSGFuZGxlIGFjdGl2ZSBlZGl0b3IgLyBzZWxlY3RlZCBlZGl0b3JzXG5cdFx0XHR0aGlzLnNldFNlbGVjdGlvbihtYWtlQWN0aXZlID8gbmV3RWRpdG9yIDogdGhpcy5hY3RpdmVFZGl0b3IsIG9wdGlvbnM/LmluYWN0aXZlU2VsZWN0aW9uID8/IFtdKTtcblxuXHRcdFx0cmV0dXJuIHtcblx0XHRcdFx0ZWRpdG9yOiBuZXdFZGl0b3IsXG5cdFx0XHRcdGlzTmV3OiB0cnVlXG5cdFx0XHR9O1xuXHRcdH1cblxuXHRcdC8vIEV4aXN0aW5nIGVkaXRvclxuXHRcdGVsc2Uge1xuXHRcdFx0Y29uc3QgW2V4aXN0aW5nRWRpdG9yLCBleGlzdGluZ0VkaXRvckluZGV4XSA9IGV4aXN0aW5nRWRpdG9yQW5kSW5kZXg7XG5cblx0XHRcdC8vIFVwZGF0ZSB0cmFuc2llbnQgKGV4aXN0aW5nIGVkaXRvcnMgZG8gbm90IHR1cm4gdHJhbnNpZW50IGlmIHRoZXkgd2VyZSBub3QgYmVmb3JlKVxuXHRcdFx0dGhpcy5kb1NldFRyYW5zaWVudChleGlzdGluZ0VkaXRvciwgZXhpc3RpbmdFZGl0b3JJbmRleCwgbWFrZVRyYW5zaWVudCA9PT0gZmFsc2UgPyBmYWxzZSA6IHRoaXMuaXNUcmFuc2llbnQoZXhpc3RpbmdFZGl0b3IpKTtcblxuXHRcdFx0Ly8gUGluIGl0XG5cdFx0XHRpZiAobWFrZVBpbm5lZCkge1xuXHRcdFx0XHR0aGlzLmRvUGluKGV4aXN0aW5nRWRpdG9yLCBleGlzdGluZ0VkaXRvckluZGV4KTtcblx0XHRcdH1cblxuXHRcdFx0Ly8gSGFuZGxlIGFjdGl2ZSBlZGl0b3IgLyBzZWxlY3RlZCBlZGl0b3JzXG5cdFx0XHR0aGlzLnNldFNlbGVjdGlvbihtYWtlQWN0aXZlID8gZXhpc3RpbmdFZGl0b3IgOiB0aGlzLmFjdGl2ZUVkaXRvciwgb3B0aW9ucz8uaW5hY3RpdmVTZWxlY3Rpb24gPz8gW10pO1xuXG5cdFx0XHQvLyBSZXNwZWN0IGluZGV4XG5cdFx0XHRpZiAob3B0aW9ucyAmJiB0eXBlb2Ygb3B0aW9ucy5pbmRleCA9PT0gJ251bWJlcicpIHtcblx0XHRcdFx0dGhpcy5tb3ZlRWRpdG9yKGV4aXN0aW5nRWRpdG9yLCBvcHRpb25zLmluZGV4KTtcblx0XHRcdH1cblxuXHRcdFx0Ly8gU3RpY2sgaXQgKGludGVudGlvbmFsbHkgYWZ0ZXIgdGhlIG1vdmVFZGl0b3IgY2FsbCBpbiBjYXNlXG5cdFx0XHQvLyB0aGUgZWRpdG9yIHdhcyBhbHJlYWR5IG1vdmVkIGludG8gdGhlIHN0aWNreSByYW5nZSlcblx0XHRcdGlmIChtYWtlU3RpY2t5KSB7XG5cdFx0XHRcdHRoaXMuZG9TdGljayhleGlzdGluZ0VkaXRvciwgdGhpcy5pbmRleE9mKGV4aXN0aW5nRWRpdG9yKSk7XG5cdFx0XHR9XG5cblx0XHRcdHJldHVybiB7XG5cdFx0XHRcdGVkaXRvcjogZXhpc3RpbmdFZGl0b3IsXG5cdFx0XHRcdGlzTmV3OiBmYWxzZVxuXHRcdFx0fTtcblx0XHR9XG5cdH1cblxuXHRwcml2YXRlIHJlZ2lzdGVyRWRpdG9yTGlzdGVuZXJzKGVkaXRvcjogRWRpdG9ySW5wdXQpOiB2b2lkIHtcblx0XHRjb25zdCBsaXN0ZW5lcnMgPSBuZXcgRGlzcG9zYWJsZVN0b3JlKCk7XG5cdFx0dGhpcy5lZGl0b3JMaXN0ZW5lcnMuYWRkKGxpc3RlbmVycyk7XG5cblx0XHQvLyBSZS1lbWl0IGRpc3Bvc2FsIG9mIGVkaXRvciBpbnB1dCBhcyBvdXIgb3duIGV2ZW50XG5cdFx0bGlzdGVuZXJzLmFkZChFdmVudC5vbmNlKGVkaXRvci5vbldpbGxEaXNwb3NlKSgoKSA9PiB7XG5cdFx0XHRjb25zdCBlZGl0b3JJbmRleCA9IHRoaXMuZWRpdG9ycy5pbmRleE9mKGVkaXRvcik7XG5cdFx0XHRpZiAoZWRpdG9ySW5kZXggPj0gMCkge1xuXHRcdFx0XHRjb25zdCBldmVudDogSUdyb3VwRWRpdG9yQ2hhbmdlRXZlbnQgPSB7XG5cdFx0XHRcdFx0a2luZDogR3JvdXBNb2RlbENoYW5nZUtpbmQuRURJVE9SX1dJTExfRElTUE9TRSxcblx0XHRcdFx0XHRlZGl0b3IsXG5cdFx0XHRcdFx0ZWRpdG9ySW5kZXhcblx0XHRcdFx0fTtcblx0XHRcdFx0dGhpcy5fb25EaWRNb2RlbENoYW5nZS5maXJlKGV2ZW50KTtcblx0XHRcdH1cblx0XHR9KSk7XG5cblx0XHQvLyBSZS1FbWl0IGRpcnR5IHN0YXRlIGNoYW5nZXNcblx0XHRsaXN0ZW5lcnMuYWRkKGVkaXRvci5vbkRpZENoYW5nZURpcnR5KCgpID0+IHtcblx0XHRcdGNvbnN0IGV2ZW50OiBJR3JvdXBFZGl0b3JDaGFuZ2VFdmVudCA9IHtcblx0XHRcdFx0a2luZDogR3JvdXBNb2RlbENoYW5nZUtpbmQuRURJVE9SX0RJUlRZLFxuXHRcdFx0XHRlZGl0b3IsXG5cdFx0XHRcdGVkaXRvckluZGV4OiB0aGlzLmVkaXRvcnMuaW5kZXhPZihlZGl0b3IpXG5cdFx0XHR9O1xuXHRcdFx0dGhpcy5fb25EaWRNb2RlbENoYW5nZS5maXJlKGV2ZW50KTtcblx0XHR9KSk7XG5cblx0XHQvLyBSZS1FbWl0IGxhYmVsIGNoYW5nZXNcblx0XHRsaXN0ZW5lcnMuYWRkKGVkaXRvci5vbkRpZENoYW5nZUxhYmVsKCgpID0+IHtcblx0XHRcdGNvbnN0IGV2ZW50OiBJR3JvdXBFZGl0b3JDaGFuZ2VFdmVudCA9IHtcblx0XHRcdFx0a2luZDogR3JvdXBNb2RlbENoYW5nZUtpbmQuRURJVE9SX0xBQkVMLFxuXHRcdFx0XHRlZGl0b3IsXG5cdFx0XHRcdGVkaXRvckluZGV4OiB0aGlzLmVkaXRvcnMuaW5kZXhPZihlZGl0b3IpXG5cdFx0XHR9O1xuXHRcdFx0dGhpcy5fb25EaWRNb2RlbENoYW5nZS5maXJlKGV2ZW50KTtcblx0XHR9KSk7XG5cblx0XHQvLyBSZS1FbWl0IGNhcGFiaWxpdHkgY2hhbmdlc1xuXHRcdGxpc3RlbmVycy5hZGQoZWRpdG9yLm9uRGlkQ2hhbmdlQ2FwYWJpbGl0aWVzKCgpID0+IHtcblx0XHRcdGNvbnN0IGV2ZW50OiBJR3JvdXBFZGl0b3JDaGFuZ2VFdmVudCA9IHtcblx0XHRcdFx0a2luZDogR3JvdXBNb2RlbENoYW5nZUtpbmQuRURJVE9SX0NBUEFCSUxJVElFUyxcblx0XHRcdFx0ZWRpdG9yLFxuXHRcdFx0XHRlZGl0b3JJbmRleDogdGhpcy5lZGl0b3JzLmluZGV4T2YoZWRpdG9yKVxuXHRcdFx0fTtcblx0XHRcdHRoaXMuX29uRGlkTW9kZWxDaGFuZ2UuZmlyZShldmVudCk7XG5cdFx0fSkpO1xuXG5cdFx0Ly8gQ2xlYW4gdXAgZGlzcG9zZSBsaXN0ZW5lcnMgb25jZSB0aGUgZWRpdG9yIGdldHMgY2xvc2VkXG5cdFx0bGlzdGVuZXJzLmFkZCh0aGlzLm9uRGlkTW9kZWxDaGFuZ2UoZXZlbnQgPT4ge1xuXHRcdFx0aWYgKGV2ZW50LmtpbmQgPT09IEdyb3VwTW9kZWxDaGFuZ2VLaW5kLkVESVRPUl9DTE9TRSAmJiBldmVudC5lZGl0b3I/Lm1hdGNoZXMoZWRpdG9yKSkge1xuXHRcdFx0XHRkaXNwb3NlKGxpc3RlbmVycyk7XG5cdFx0XHRcdHRoaXMuZWRpdG9yTGlzdGVuZXJzLmRlbGV0ZShsaXN0ZW5lcnMpO1xuXHRcdFx0fVxuXHRcdH0pKTtcblx0fVxuXG5cdHByaXZhdGUgcmVwbGFjZUVkaXRvcih0b1JlcGxhY2U6IEVkaXRvcklucHV0LCByZXBsYWNlV2l0aDogRWRpdG9ySW5wdXQsIHJlcGxhY2VJbmRleDogbnVtYmVyLCBvcGVuTmV4dCA9IHRydWUpOiB2b2lkIHtcblx0XHRjb25zdCBjbG9zZVJlc3VsdCA9IHRoaXMuZG9DbG9zZUVkaXRvcih0b1JlcGxhY2UsIEVkaXRvckNsb3NlQ29udGV4dC5SRVBMQUNFLCBvcGVuTmV4dCk7IC8vIG9wdGltaXphdGlvbiB0byBwcmV2ZW50IG11bHRpcGxlIHNldEFjdGl2ZSgpIGluIG9uZSBjYWxsXG5cblx0XHQvLyBXZSB3YW50IHRvIGZpcnN0IGFkZCB0aGUgbmV3IGVkaXRvciBpbnRvIG91ciBtb2RlbCBiZWZvcmUgZW1pdHRpbmcgdGhlIGNsb3NlIGV2ZW50IGJlY2F1c2Vcblx0XHQvLyBmaXJpbmcgdGhlIGNsb3NlIGV2ZW50IGNhbiB0cmlnZ2VyIGEgZGlzcG9zZSBvbiB0aGUgc2FtZSBlZGl0b3IgdGhhdCBpcyBub3cgYmVpbmcgYWRkZWQuXG5cdFx0Ly8gVGhpcyBjYW4gbGVhZCBpbnRvIG9wZW5pbmcgYSBkaXNwb3NlZCBlZGl0b3Igd2hpY2ggaXMgbm90IHdoYXQgd2Ugd2FudC5cblx0XHR0aGlzLnNwbGljZShyZXBsYWNlSW5kZXgsIGZhbHNlLCByZXBsYWNlV2l0aCk7XG5cblx0XHRpZiAoY2xvc2VSZXN1bHQpIHtcblx0XHRcdGNvbnN0IGV2ZW50OiBJR3JvdXBFZGl0b3JDbG9zZUV2ZW50ID0ge1xuXHRcdFx0XHRraW5kOiBHcm91cE1vZGVsQ2hhbmdlS2luZC5FRElUT1JfQ0xPU0UsXG5cdFx0XHRcdC4uLmNsb3NlUmVzdWx0XG5cdFx0XHR9O1xuXHRcdFx0dGhpcy5fb25EaWRNb2RlbENoYW5nZS5maXJlKGV2ZW50KTtcblx0XHR9XG5cdH1cblxuXHRjbG9zZUVkaXRvcihjYW5kaWRhdGU6IEVkaXRvcklucHV0LCBjb250ZXh0ID0gRWRpdG9yQ2xvc2VDb250ZXh0LlVOS05PV04sIG9wZW5OZXh0ID0gdHJ1ZSk6IElFZGl0b3JDbG9zZVJlc3VsdCB8IHVuZGVmaW5lZCB7XG5cdFx0Y29uc3QgY2xvc2VSZXN1bHQgPSB0aGlzLmRvQ2xvc2VFZGl0b3IoY2FuZGlkYXRlLCBjb250ZXh0LCBvcGVuTmV4dCk7XG5cblx0XHRpZiAoY2xvc2VSZXN1bHQpIHtcblx0XHRcdGNvbnN0IGV2ZW50OiBJR3JvdXBFZGl0b3JDbG9zZUV2ZW50ID0ge1xuXHRcdFx0XHRraW5kOiBHcm91cE1vZGVsQ2hhbmdlS2luZC5FRElUT1JfQ0xPU0UsXG5cdFx0XHRcdC4uLmNsb3NlUmVzdWx0XG5cdFx0XHR9O1xuXHRcdFx0dGhpcy5fb25EaWRNb2RlbENoYW5nZS5maXJlKGV2ZW50KTtcblxuXHRcdFx0cmV0dXJuIGNsb3NlUmVzdWx0O1xuXHRcdH1cblxuXHRcdHJldHVybiB1bmRlZmluZWQ7XG5cdH1cblxuXHRwcml2YXRlIGRvQ2xvc2VFZGl0b3IoY2FuZGlkYXRlOiBFZGl0b3JJbnB1dCwgY29udGV4dDogRWRpdG9yQ2xvc2VDb250ZXh0LCBvcGVuTmV4dDogYm9vbGVhbik6IElFZGl0b3JDbG9zZVJlc3VsdCB8IHVuZGVmaW5lZCB7XG5cdFx0Y29uc3QgaW5kZXggPSB0aGlzLmluZGV4T2YoY2FuZGlkYXRlKTtcblx0XHRpZiAoaW5kZXggPT09IC0xKSB7XG5cdFx0XHRyZXR1cm4gdW5kZWZpbmVkOyAvLyBub3QgZm91bmRcblx0XHR9XG5cblx0XHRjb25zdCBlZGl0b3IgPSB0aGlzLmVkaXRvcnNbaW5kZXhdO1xuXHRcdGNvbnN0IHN0aWNreSA9IHRoaXMuaXNTdGlja3koaW5kZXgpO1xuXG5cdFx0Ly8gQWN0aXZlIGVkaXRvciBjbG9zZWRcblx0XHRjb25zdCBpc0FjdGl2ZUVkaXRvciA9IHRoaXMuYWN0aXZlID09PSBlZGl0b3I7XG5cdFx0aWYgKG9wZW5OZXh0ICYmIGlzQWN0aXZlRWRpdG9yKSB7XG5cblx0XHRcdC8vIE1vcmUgdGhhbiBvbmUgZWRpdG9yXG5cdFx0XHRpZiAodGhpcy5tcnUubGVuZ3RoID4gMSkge1xuXHRcdFx0XHRsZXQgbmV3QWN0aXZlOiBFZGl0b3JJbnB1dDtcblx0XHRcdFx0aWYgKHRoaXMuZm9jdXNSZWNlbnRFZGl0b3JBZnRlckNsb3NlKSB7XG5cdFx0XHRcdFx0bmV3QWN0aXZlID0gdGhpcy5tcnVbMV07IC8vIGFjdGl2ZSBlZGl0b3IgaXMgYWx3YXlzIGZpcnN0IGluIE1SVSwgc28gcGljayBzZWNvbmQgZWRpdG9yIGFmdGVyIGFzIG5ldyBhY3RpdmVcblx0XHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0XHRpZiAoaW5kZXggPT09IHRoaXMuZWRpdG9ycy5sZW5ndGggLSAxKSB7XG5cdFx0XHRcdFx0XHRuZXdBY3RpdmUgPSB0aGlzLmVkaXRvcnNbaW5kZXggLSAxXTsgLy8gbGFzdCBlZGl0b3IgaXMgY2xvc2VkLCBwaWNrIHByZXZpb3VzIGFzIG5ldyBhY3RpdmVcblx0XHRcdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRcdFx0bmV3QWN0aXZlID0gdGhpcy5lZGl0b3JzW2luZGV4ICsgMV07IC8vIHBpY2sgbmV4dCBlZGl0b3IgYXMgbmV3IGFjdGl2ZVxuXHRcdFx0XHRcdH1cblx0XHRcdFx0fVxuXG5cdFx0XHRcdC8vIFNlbGVjdCBlZGl0b3IgYXMgYWN0aXZlXG5cdFx0XHRcdGNvbnN0IG5ld0luYWN0aXZlU2VsZWN0ZWRFZGl0b3JzID0gdGhpcy5zZWxlY3Rpb24uZmlsdGVyKHNlbGVjdGVkID0+IHNlbGVjdGVkICE9PSBlZGl0b3IgJiYgc2VsZWN0ZWQgIT09IG5ld0FjdGl2ZSk7XG5cdFx0XHRcdHRoaXMuZG9TZXRTZWxlY3Rpb24obmV3QWN0aXZlLCB0aGlzLmVkaXRvcnMuaW5kZXhPZihuZXdBY3RpdmUpLCBuZXdJbmFjdGl2ZVNlbGVjdGVkRWRpdG9ycyk7XG5cdFx0XHR9XG5cblx0XHRcdC8vIExhc3QgZWRpdG9yIGNsb3NlZDogY2xlYXIgc2VsZWN0aW9uXG5cdFx0XHRlbHNlIHtcblx0XHRcdFx0dGhpcy5kb1NldFNlbGVjdGlvbihudWxsLCB1bmRlZmluZWQsIFtdKTtcblx0XHRcdH1cblx0XHR9XG5cblx0XHQvLyBJbmFjdGl2ZSBlZGl0b3IgY2xvc2VkXG5cdFx0ZWxzZSBpZiAoIWlzQWN0aXZlRWRpdG9yKSB7XG5cblx0XHRcdC8vIFJlbW92ZSBlZGl0b3IgZnJvbSBpbmFjdGl2ZSBzZWxlY3Rpb25cblx0XHRcdGlmICh0aGlzLmRvSXNTZWxlY3RlZChlZGl0b3IpKSB7XG5cdFx0XHRcdGNvbnN0IG5ld0luYWN0aXZlU2VsZWN0ZWRFZGl0b3JzID0gdGhpcy5zZWxlY3Rpb24uZmlsdGVyKHNlbGVjdGVkID0+IHNlbGVjdGVkICE9PSBlZGl0b3IgJiYgc2VsZWN0ZWQgIT09IHRoaXMuYWN0aXZlRWRpdG9yKTtcblx0XHRcdFx0dGhpcy5kb1NldFNlbGVjdGlvbih0aGlzLmFjdGl2ZUVkaXRvciwgdGhpcy5pbmRleE9mKHRoaXMuYWN0aXZlRWRpdG9yKSwgbmV3SW5hY3RpdmVTZWxlY3RlZEVkaXRvcnMpO1xuXHRcdFx0fVxuXHRcdH1cblxuXHRcdC8vIFByZXZpZXcgRWRpdG9yIGNsb3NlZFxuXHRcdGlmICh0aGlzLnByZXZpZXcgPT09IGVkaXRvcikge1xuXHRcdFx0dGhpcy5wcmV2aWV3ID0gbnVsbDtcblx0XHR9XG5cblx0XHQvLyBSZW1vdmUgZnJvbSB0cmFuc2llbnRcblx0XHR0aGlzLnRyYW5zaWVudC5kZWxldGUoZWRpdG9yKTtcblxuXHRcdC8vIFJlbW92ZSBmcm9tIGFycmF5c1xuXHRcdHRoaXMuc3BsaWNlKGluZGV4LCB0cnVlKTtcblxuXHRcdC8vIEV2ZW50XG5cdFx0cmV0dXJuIHsgZWRpdG9yLCBzdGlja3ksIGVkaXRvckluZGV4OiBpbmRleCwgY29udGV4dCB9O1xuXHR9XG5cblx0bW92ZUVkaXRvcihjYW5kaWRhdGU6IEVkaXRvcklucHV0LCB0b0luZGV4OiBudW1iZXIpOiBFZGl0b3JJbnB1dCB8IHVuZGVmaW5lZCB7XG5cblx0XHQvLyBFbnN1cmUgdG9JbmRleCBpcyBpbiBib3VuZHMgb2Ygb3VyIG1vZGVsXG5cdFx0aWYgKHRvSW5kZXggPj0gdGhpcy5lZGl0b3JzLmxlbmd0aCkge1xuXHRcdFx0dG9JbmRleCA9IHRoaXMuZWRpdG9ycy5sZW5ndGggLSAxO1xuXHRcdH0gZWxzZSBpZiAodG9JbmRleCA8IDApIHtcblx0XHRcdHRvSW5kZXggPSAwO1xuXHRcdH1cblxuXHRcdGNvbnN0IGluZGV4ID0gdGhpcy5pbmRleE9mKGNhbmRpZGF0ZSk7XG5cdFx0aWYgKGluZGV4IDwgMCB8fCB0b0luZGV4ID09PSBpbmRleCkge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblxuXHRcdGNvbnN0IGVkaXRvciA9IHRoaXMuZWRpdG9yc1tpbmRleF07XG5cdFx0Y29uc3Qgc3RpY2t5ID0gdGhpcy5zdGlja3k7XG5cblx0XHQvLyBBZGp1c3Qgc3RpY2t5IGluZGV4OiBlZGl0b3IgbW92ZWQgb3V0IG9mIHN0aWNreSBzdGF0ZSBpbnRvIHVuc3RpY2t5IHN0YXRlXG5cdFx0aWYgKHRoaXMuaXNTdGlja3koaW5kZXgpICYmIHRvSW5kZXggPiB0aGlzLnN0aWNreSkge1xuXHRcdFx0dGhpcy5zdGlja3ktLTtcblx0XHR9XG5cblx0XHQvLyAuLi5vciBlZGl0b3IgbW92ZWQgaW50byBzdGlja3kgc3RhdGUgZnJvbSB1bnN0aWNreSBzdGF0ZVxuXHRcdGVsc2UgaWYgKCF0aGlzLmlzU3RpY2t5KGluZGV4KSAmJiB0b0luZGV4IDw9IHRoaXMuc3RpY2t5KSB7XG5cdFx0XHR0aGlzLnN0aWNreSsrO1xuXHRcdH1cblxuXHRcdC8vIE1vdmVcblx0XHR0aGlzLmVkaXRvcnMuc3BsaWNlKGluZGV4LCAxKTtcblx0XHR0aGlzLmVkaXRvcnMuc3BsaWNlKHRvSW5kZXgsIDAsIGVkaXRvcik7XG5cblx0XHQvLyBNb3ZlIEV2ZW50XG5cdFx0Y29uc3QgZXZlbnQ6IElHcm91cEVkaXRvck1vdmVFdmVudCA9IHtcblx0XHRcdGtpbmQ6IEdyb3VwTW9kZWxDaGFuZ2VLaW5kLkVESVRPUl9NT1ZFLFxuXHRcdFx0ZWRpdG9yLFxuXHRcdFx0b2xkRWRpdG9ySW5kZXg6IGluZGV4LFxuXHRcdFx0ZWRpdG9ySW5kZXg6IHRvSW5kZXhcblx0XHR9O1xuXHRcdHRoaXMuX29uRGlkTW9kZWxDaGFuZ2UuZmlyZShldmVudCk7XG5cblx0XHQvLyBTdGlja3kgRXZlbnQgKGlmIHN0aWNreSBjaGFuZ2VkIGFzIHBhcnQgb2YgdGhlIG1vdmUpXG5cdFx0aWYgKHN0aWNreSAhPT0gdGhpcy5zdGlja3kpIHtcblx0XHRcdGNvbnN0IGV2ZW50OiBJR3JvdXBFZGl0b3JDaGFuZ2VFdmVudCA9IHtcblx0XHRcdFx0a2luZDogR3JvdXBNb2RlbENoYW5nZUtpbmQuRURJVE9SX1NUSUNLWSxcblx0XHRcdFx0ZWRpdG9yLFxuXHRcdFx0XHRlZGl0b3JJbmRleDogdG9JbmRleFxuXHRcdFx0fTtcblx0XHRcdHRoaXMuX29uRGlkTW9kZWxDaGFuZ2UuZmlyZShldmVudCk7XG5cdFx0fVxuXG5cdFx0cmV0dXJuIGVkaXRvcjtcblx0fVxuXG5cdHNldEFjdGl2ZShjYW5kaWRhdGU6IEVkaXRvcklucHV0IHwgdW5kZWZpbmVkKTogRWRpdG9ySW5wdXQgfCB1bmRlZmluZWQge1xuXHRcdGxldCByZXN1bHQ6IEVkaXRvcklucHV0IHwgdW5kZWZpbmVkID0gdW5kZWZpbmVkO1xuXG5cdFx0aWYgKCFjYW5kaWRhdGUpIHtcblx0XHRcdHRoaXMuc2V0R3JvdXBBY3RpdmUoKTtcblx0XHR9IGVsc2Uge1xuXHRcdFx0cmVzdWx0ID0gdGhpcy5zZXRFZGl0b3JBY3RpdmUoY2FuZGlkYXRlKTtcblx0XHR9XG5cblx0XHRyZXR1cm4gcmVzdWx0O1xuXHR9XG5cblx0cHJpdmF0ZSBzZXRHcm91cEFjdGl2ZSgpOiB2b2lkIHtcblx0XHQvLyBXZSBkbyBub3QgcmVhbGx5IGtlZXAgdGhlIGBhY3RpdmVgIHN0YXRlIGluIG91ciBtb2RlbCBiZWNhdXNlXG5cdFx0Ly8gaXQgaGFzIG5vIHNwZWNpYWwgbWVhbmluZyB0byB1cyBoZXJlLiBCdXQgZm9yIGNvbnNpc3RlbmN5XG5cdFx0Ly8gd2UgZW1pdCBhIGBvbkRpZE1vZGVsQ2hhbmdlYCBldmVudCBzbyB0aGF0IGNvbXBvbmVudHMgY2FuXG5cdFx0Ly8gcmVhY3QuXG5cdFx0dGhpcy5fb25EaWRNb2RlbENoYW5nZS5maXJlKHsga2luZDogR3JvdXBNb2RlbENoYW5nZUtpbmQuR1JPVVBfQUNUSVZFIH0pO1xuXHR9XG5cblx0cHJpdmF0ZSBzZXRFZGl0b3JBY3RpdmUoY2FuZGlkYXRlOiBFZGl0b3JJbnB1dCk6IEVkaXRvcklucHV0IHwgdW5kZWZpbmVkIHtcblx0XHRjb25zdCByZXMgPSB0aGlzLmZpbmRFZGl0b3IoY2FuZGlkYXRlKTtcblx0XHRpZiAoIXJlcykge1xuXHRcdFx0cmV0dXJuOyAvLyBub3QgZm91bmRcblx0XHR9XG5cblx0XHRjb25zdCBbZWRpdG9yLCBlZGl0b3JJbmRleF0gPSByZXM7XG5cblx0XHR0aGlzLmRvU2V0U2VsZWN0aW9uKGVkaXRvciwgZWRpdG9ySW5kZXgsIFtdKTtcblxuXHRcdHJldHVybiBlZGl0b3I7XG5cdH1cblxuXHRnZXQgc2VsZWN0ZWRFZGl0b3JzKCk6IEVkaXRvcklucHV0W10ge1xuXHRcdHJldHVybiB0aGlzLmVkaXRvcnMuZmlsdGVyKGVkaXRvciA9PiB0aGlzLmRvSXNTZWxlY3RlZChlZGl0b3IpKTsgLy8gcmV0dXJuIGluIHNlcXVlbnRpYWwgb3JkZXJcblx0fVxuXG5cdGlzU2VsZWN0ZWQoZWRpdG9yQ2FuZGlkYXRlT3JJbmRleDogRWRpdG9ySW5wdXQgfCBudW1iZXIpOiBib29sZWFuIHtcblx0XHRsZXQgZWRpdG9yOiBFZGl0b3JJbnB1dCB8IHVuZGVmaW5lZDtcblx0XHRpZiAodHlwZW9mIGVkaXRvckNhbmRpZGF0ZU9ySW5kZXggPT09ICdudW1iZXInKSB7XG5cdFx0XHRlZGl0b3IgPSB0aGlzLmVkaXRvcnNbZWRpdG9yQ2FuZGlkYXRlT3JJbmRleF07XG5cdFx0fSBlbHNlIHtcblx0XHRcdGVkaXRvciA9IHRoaXMuZmluZEVkaXRvcihlZGl0b3JDYW5kaWRhdGVPckluZGV4KT8uWzBdO1xuXHRcdH1cblxuXHRcdHJldHVybiAhIWVkaXRvciAmJiB0aGlzLmRvSXNTZWxlY3RlZChlZGl0b3IpO1xuXHR9XG5cblx0cHJpdmF0ZSBkb0lzU2VsZWN0ZWQoZWRpdG9yOiBFZGl0b3JJbnB1dCk6IGJvb2xlYW4ge1xuXHRcdHJldHVybiB0aGlzLnNlbGVjdGlvbi5pbmNsdWRlcyhlZGl0b3IpO1xuXHR9XG5cblx0c2V0U2VsZWN0aW9uKGFjdGl2ZVNlbGVjdGVkRWRpdG9yQ2FuZGlkYXRlOiBFZGl0b3JJbnB1dCwgaW5hY3RpdmVTZWxlY3RlZEVkaXRvckNhbmRpZGF0ZXM6IEVkaXRvcklucHV0W10pOiB2b2lkIHtcblx0XHRjb25zdCByZXMgPSB0aGlzLmZpbmRFZGl0b3IoYWN0aXZlU2VsZWN0ZWRFZGl0b3JDYW5kaWRhdGUpO1xuXHRcdGlmICghcmVzKSB7XG5cdFx0XHRyZXR1cm47IC8vIG5vdCBmb3VuZFxuXHRcdH1cblxuXHRcdGNvbnN0IFthY3RpdmVTZWxlY3RlZEVkaXRvciwgYWN0aXZlU2VsZWN0ZWRFZGl0b3JJbmRleF0gPSByZXM7XG5cblx0XHRjb25zdCBpbmFjdGl2ZVNlbGVjdGVkRWRpdG9ycyA9IG5ldyBTZXQ8RWRpdG9ySW5wdXQ+KCk7XG5cdFx0Zm9yIChjb25zdCBpbmFjdGl2ZVNlbGVjdGVkRWRpdG9yQ2FuZGlkYXRlIG9mIGluYWN0aXZlU2VsZWN0ZWRFZGl0b3JDYW5kaWRhdGVzKSB7XG5cdFx0XHRjb25zdCByZXMgPSB0aGlzLmZpbmRFZGl0b3IoaW5hY3RpdmVTZWxlY3RlZEVkaXRvckNhbmRpZGF0ZSk7XG5cdFx0XHRpZiAoIXJlcykge1xuXHRcdFx0XHRyZXR1cm47IC8vIG5vdCBmb3VuZFxuXHRcdFx0fVxuXG5cdFx0XHRjb25zdCBbaW5hY3RpdmVTZWxlY3RlZEVkaXRvcl0gPSByZXM7XG5cdFx0XHRpZiAoaW5hY3RpdmVTZWxlY3RlZEVkaXRvciA9PT0gYWN0aXZlU2VsZWN0ZWRFZGl0b3IpIHtcblx0XHRcdFx0Y29udGludWU7IC8vIGFscmVhZHkgc2VsZWN0ZWRcblx0XHRcdH1cblxuXHRcdFx0aW5hY3RpdmVTZWxlY3RlZEVkaXRvcnMuYWRkKGluYWN0aXZlU2VsZWN0ZWRFZGl0b3IpO1xuXHRcdH1cblxuXHRcdHRoaXMuZG9TZXRTZWxlY3Rpb24oYWN0aXZlU2VsZWN0ZWRFZGl0b3IsIGFjdGl2ZVNlbGVjdGVkRWRpdG9ySW5kZXgsIEFycmF5LmZyb20oaW5hY3RpdmVTZWxlY3RlZEVkaXRvcnMpKTtcblx0fVxuXG5cdHByaXZhdGUgZG9TZXRTZWxlY3Rpb24oYWN0aXZlU2VsZWN0ZWRFZGl0b3I6IEVkaXRvcklucHV0IHwgbnVsbCwgYWN0aXZlU2VsZWN0ZWRFZGl0b3JJbmRleDogbnVtYmVyIHwgdW5kZWZpbmVkLCBpbmFjdGl2ZVNlbGVjdGVkRWRpdG9yczogRWRpdG9ySW5wdXRbXSk6IHZvaWQge1xuXHRcdGNvbnN0IHByZXZpb3VzQWN0aXZlRWRpdG9yID0gdGhpcy5hY3RpdmVFZGl0b3I7XG5cdFx0Y29uc3QgcHJldmlvdXNTZWxlY3Rpb24gPSB0aGlzLnNlbGVjdGlvbjtcblxuXHRcdGxldCBuZXdTZWxlY3Rpb246IEVkaXRvcklucHV0W107XG5cdFx0aWYgKGFjdGl2ZVNlbGVjdGVkRWRpdG9yKSB7XG5cdFx0XHRuZXdTZWxlY3Rpb24gPSBbYWN0aXZlU2VsZWN0ZWRFZGl0b3IsIC4uLmluYWN0aXZlU2VsZWN0ZWRFZGl0b3JzXTtcblx0XHR9IGVsc2Uge1xuXHRcdFx0bmV3U2VsZWN0aW9uID0gW107XG5cdFx0fVxuXG5cdFx0Ly8gVXBkYXRlIHNlbGVjdGlvblxuXHRcdHRoaXMuc2VsZWN0aW9uID0gbmV3U2VsZWN0aW9uO1xuXG5cdFx0Ly8gVXBkYXRlIGFjdGl2ZSBlZGl0b3IgaWYgaXQgaGFzIGNoYW5nZWRcblx0XHRjb25zdCBhY3RpdmVFZGl0b3JDaGFuZ2VkID0gYWN0aXZlU2VsZWN0ZWRFZGl0b3IgJiYgdHlwZW9mIGFjdGl2ZVNlbGVjdGVkRWRpdG9ySW5kZXggPT09ICdudW1iZXInICYmIHByZXZpb3VzQWN0aXZlRWRpdG9yICE9PSBhY3RpdmVTZWxlY3RlZEVkaXRvcjtcblx0XHRpZiAoYWN0aXZlRWRpdG9yQ2hhbmdlZCkge1xuXG5cdFx0XHQvLyBCcmluZyB0byBmcm9udCBpbiBNUlUgbGlzdFxuXHRcdFx0Y29uc3QgbXJ1SW5kZXggPSB0aGlzLmluZGV4T2YoYWN0aXZlU2VsZWN0ZWRFZGl0b3IsIHRoaXMubXJ1KTtcblx0XHRcdHRoaXMubXJ1LnNwbGljZShtcnVJbmRleCwgMSk7XG5cdFx0XHR0aGlzLm1ydS51bnNoaWZ0KGFjdGl2ZVNlbGVjdGVkRWRpdG9yKTtcblxuXHRcdFx0Ly8gRXZlbnRcblx0XHRcdGNvbnN0IGV2ZW50OiBJR3JvdXBFZGl0b3JDaGFuZ2VFdmVudCA9IHtcblx0XHRcdFx0a2luZDogR3JvdXBNb2RlbENoYW5nZUtpbmQuRURJVE9SX0FDVElWRSxcblx0XHRcdFx0ZWRpdG9yOiBhY3RpdmVTZWxlY3RlZEVkaXRvcixcblx0XHRcdFx0ZWRpdG9ySW5kZXg6IGFjdGl2ZVNlbGVjdGVkRWRpdG9ySW5kZXhcblx0XHRcdH07XG5cdFx0XHR0aGlzLl9vbkRpZE1vZGVsQ2hhbmdlLmZpcmUoZXZlbnQpO1xuXHRcdH1cblxuXHRcdC8vIEZpcmUgZXZlbnQgaWYgdGhlIHNlbGVjdGlvbiBoYXMgY2hhbmdlZFxuXHRcdGlmIChcblx0XHRcdGFjdGl2ZUVkaXRvckNoYW5nZWQgfHxcblx0XHRcdHByZXZpb3VzU2VsZWN0aW9uLmxlbmd0aCAhPT0gbmV3U2VsZWN0aW9uLmxlbmd0aCB8fFxuXHRcdFx0cHJldmlvdXNTZWxlY3Rpb24uc29tZShlZGl0b3IgPT4gIW5ld1NlbGVjdGlvbi5pbmNsdWRlcyhlZGl0b3IpKVxuXHRcdCkge1xuXHRcdFx0Y29uc3QgZXZlbnQ6IElHcm91cE1vZGVsQ2hhbmdlRXZlbnQgPSB7XG5cdFx0XHRcdGtpbmQ6IEdyb3VwTW9kZWxDaGFuZ2VLaW5kLkVESVRPUlNfU0VMRUNUSU9OXG5cdFx0XHR9O1xuXHRcdFx0dGhpcy5fb25EaWRNb2RlbENoYW5nZS5maXJlKGV2ZW50KTtcblx0XHR9XG5cdH1cblxuXHRzZXRJbmRleChpbmRleDogbnVtYmVyKSB7XG5cdFx0Ly8gV2UgZG8gbm90IHJlYWxseSBrZWVwIHRoZSBgaW5kZXhgIGluIG91ciBtb2RlbCBiZWNhdXNlXG5cdFx0Ly8gaXQgaGFzIG5vIHNwZWNpYWwgbWVhbmluZyB0byB1cyBoZXJlLiBCdXQgZm9yIGNvbnNpc3RlbmN5XG5cdFx0Ly8gd2UgZW1pdCBhIGBvbkRpZE1vZGVsQ2hhbmdlYCBldmVudCBzbyB0aGF0IGNvbXBvbmVudHMgY2FuXG5cdFx0Ly8gcmVhY3QuXG5cdFx0dGhpcy5fb25EaWRNb2RlbENoYW5nZS5maXJlKHsga2luZDogR3JvdXBNb2RlbENoYW5nZUtpbmQuR1JPVVBfSU5ERVggfSk7XG5cdH1cblxuXHRzZXRMYWJlbChsYWJlbDogc3RyaW5nKSB7XG5cdFx0Ly8gV2UgZG8gbm90IHJlYWxseSBrZWVwIHRoZSBgbGFiZWxgIGluIG91ciBtb2RlbCBiZWNhdXNlXG5cdFx0Ly8gaXQgaGFzIG5vIHNwZWNpYWwgbWVhbmluZyB0byB1cyBoZXJlLiBCdXQgZm9yIGNvbnNpc3RlbmN5XG5cdFx0Ly8gd2UgZW1pdCBhIGBvbkRpZE1vZGVsQ2hhbmdlYCBldmVudCBzbyB0aGF0IGNvbXBvbmVudHMgY2FuXG5cdFx0Ly8gcmVhY3QuXG5cdFx0dGhpcy5fb25EaWRNb2RlbENoYW5nZS5maXJlKHsga2luZDogR3JvdXBNb2RlbENoYW5nZUtpbmQuR1JPVVBfTEFCRUwgfSk7XG5cdH1cblxuXHRwaW4oY2FuZGlkYXRlOiBFZGl0b3JJbnB1dCk6IEVkaXRvcklucHV0IHwgdW5kZWZpbmVkIHtcblx0XHRjb25zdCByZXMgPSB0aGlzLmZpbmRFZGl0b3IoY2FuZGlkYXRlKTtcblx0XHRpZiAoIXJlcykge1xuXHRcdFx0cmV0dXJuOyAvLyBub3QgZm91bmRcblx0XHR9XG5cblx0XHRjb25zdCBbZWRpdG9yLCBlZGl0b3JJbmRleF0gPSByZXM7XG5cblx0XHR0aGlzLmRvUGluKGVkaXRvciwgZWRpdG9ySW5kZXgpO1xuXG5cdFx0cmV0dXJuIGVkaXRvcjtcblx0fVxuXG5cdHByaXZhdGUgZG9QaW4oZWRpdG9yOiBFZGl0b3JJbnB1dCwgZWRpdG9ySW5kZXg6IG51bWJlcik6IHZvaWQge1xuXHRcdGlmICh0aGlzLmlzUGlubmVkKGVkaXRvcikpIHtcblx0XHRcdHJldHVybjsgLy8gY2FuIG9ubHkgcGluIGEgcHJldmlldyBlZGl0b3Jcblx0XHR9XG5cblx0XHQvLyBDbGVhciBUcmFuc2llbnRcblx0XHR0aGlzLnNldFRyYW5zaWVudChlZGl0b3IsIGZhbHNlKTtcblxuXHRcdC8vIENvbnZlcnQgdGhlIHByZXZpZXcgZWRpdG9yIHRvIGJlIGEgcGlubmVkIGVkaXRvclxuXHRcdHRoaXMucHJldmlldyA9IG51bGw7XG5cblx0XHQvLyBFdmVudFxuXHRcdGNvbnN0IGV2ZW50OiBJR3JvdXBFZGl0b3JDaGFuZ2VFdmVudCA9IHtcblx0XHRcdGtpbmQ6IEdyb3VwTW9kZWxDaGFuZ2VLaW5kLkVESVRPUl9QSU4sXG5cdFx0XHRlZGl0b3IsXG5cdFx0XHRlZGl0b3JJbmRleFxuXHRcdH07XG5cdFx0dGhpcy5fb25EaWRNb2RlbENoYW5nZS5maXJlKGV2ZW50KTtcblx0fVxuXG5cdHVucGluKGNhbmRpZGF0ZTogRWRpdG9ySW5wdXQpOiBFZGl0b3JJbnB1dCB8IHVuZGVmaW5lZCB7XG5cdFx0Y29uc3QgcmVzID0gdGhpcy5maW5kRWRpdG9yKGNhbmRpZGF0ZSk7XG5cdFx0aWYgKCFyZXMpIHtcblx0XHRcdHJldHVybjsgLy8gbm90IGZvdW5kXG5cdFx0fVxuXG5cdFx0Y29uc3QgW2VkaXRvciwgZWRpdG9ySW5kZXhdID0gcmVzO1xuXG5cdFx0dGhpcy5kb1VucGluKGVkaXRvciwgZWRpdG9ySW5kZXgpO1xuXG5cdFx0cmV0dXJuIGVkaXRvcjtcblx0fVxuXG5cdHByaXZhdGUgZG9VbnBpbihlZGl0b3I6IEVkaXRvcklucHV0LCBlZGl0b3JJbmRleDogbnVtYmVyKTogdm9pZCB7XG5cdFx0aWYgKCF0aGlzLmlzUGlubmVkKGVkaXRvcikpIHtcblx0XHRcdHJldHVybjsgLy8gY2FuIG9ubHkgdW5waW4gYSBwaW5uZWQgZWRpdG9yXG5cdFx0fVxuXG5cdFx0Ly8gU2V0IG5ld1xuXHRcdGNvbnN0IG9sZFByZXZpZXcgPSB0aGlzLnByZXZpZXc7XG5cdFx0dGhpcy5wcmV2aWV3ID0gZWRpdG9yO1xuXG5cdFx0Ly8gRXZlbnRcblx0XHRjb25zdCBldmVudDogSUdyb3VwRWRpdG9yQ2hhbmdlRXZlbnQgPSB7XG5cdFx0XHRraW5kOiBHcm91cE1vZGVsQ2hhbmdlS2luZC5FRElUT1JfUElOLFxuXHRcdFx0ZWRpdG9yLFxuXHRcdFx0ZWRpdG9ySW5kZXhcblx0XHR9O1xuXHRcdHRoaXMuX29uRGlkTW9kZWxDaGFuZ2UuZmlyZShldmVudCk7XG5cblx0XHQvLyBDbG9zZSBvbGQgcHJldmlldyBlZGl0b3IgaWYgYW55XG5cdFx0aWYgKG9sZFByZXZpZXcpIHtcblx0XHRcdHRoaXMuY2xvc2VFZGl0b3Iob2xkUHJldmlldywgRWRpdG9yQ2xvc2VDb250ZXh0LlVOUElOKTtcblx0XHR9XG5cdH1cblxuXHRpc1Bpbm5lZChlZGl0b3JDYW5kaWRhdGVPckluZGV4OiBFZGl0b3JJbnB1dCB8IG51bWJlcik6IGJvb2xlYW4ge1xuXHRcdGxldCBlZGl0b3I6IEVkaXRvcklucHV0O1xuXHRcdGlmICh0eXBlb2YgZWRpdG9yQ2FuZGlkYXRlT3JJbmRleCA9PT0gJ251bWJlcicpIHtcblx0XHRcdGVkaXRvciA9IHRoaXMuZWRpdG9yc1tlZGl0b3JDYW5kaWRhdGVPckluZGV4XTtcblx0XHR9IGVsc2Uge1xuXHRcdFx0ZWRpdG9yID0gZWRpdG9yQ2FuZGlkYXRlT3JJbmRleDtcblx0XHR9XG5cblx0XHRyZXR1cm4gIXRoaXMubWF0Y2hlcyh0aGlzLnByZXZpZXcsIGVkaXRvcik7XG5cdH1cblxuXHRzdGljayhjYW5kaWRhdGU6IEVkaXRvcklucHV0KTogRWRpdG9ySW5wdXQgfCB1bmRlZmluZWQge1xuXHRcdGNvbnN0IHJlcyA9IHRoaXMuZmluZEVkaXRvcihjYW5kaWRhdGUpO1xuXHRcdGlmICghcmVzKSB7XG5cdFx0XHRyZXR1cm47IC8vIG5vdCBmb3VuZFxuXHRcdH1cblxuXHRcdGNvbnN0IFtlZGl0b3IsIGVkaXRvckluZGV4XSA9IHJlcztcblxuXHRcdHRoaXMuZG9TdGljayhlZGl0b3IsIGVkaXRvckluZGV4KTtcblxuXHRcdHJldHVybiBlZGl0b3I7XG5cdH1cblxuXHRwcml2YXRlIGRvU3RpY2soZWRpdG9yOiBFZGl0b3JJbnB1dCwgZWRpdG9ySW5kZXg6IG51bWJlcik6IHZvaWQge1xuXHRcdGlmICh0aGlzLmlzU3RpY2t5KGVkaXRvckluZGV4KSkge1xuXHRcdFx0cmV0dXJuOyAvLyBjYW4gb25seSBzdGljayBhIG5vbi1zdGlja3kgZWRpdG9yXG5cdFx0fVxuXG5cdFx0Ly8gUGluIGVkaXRvclxuXHRcdHRoaXMucGluKGVkaXRvcik7XG5cblx0XHQvLyBNb3ZlIGVkaXRvciB0byBiZSB0aGUgbGFzdCBzdGlja3kgZWRpdG9yXG5cdFx0Y29uc3QgbmV3RWRpdG9ySW5kZXggPSB0aGlzLnN0aWNreSArIDE7XG5cdFx0dGhpcy5tb3ZlRWRpdG9yKGVkaXRvciwgbmV3RWRpdG9ySW5kZXgpO1xuXG5cdFx0Ly8gQWRqdXN0IHN0aWNreSBpbmRleFxuXHRcdHRoaXMuc3RpY2t5Kys7XG5cblx0XHQvLyBFdmVudFxuXHRcdGNvbnN0IGV2ZW50OiBJR3JvdXBFZGl0b3JDaGFuZ2VFdmVudCA9IHtcblx0XHRcdGtpbmQ6IEdyb3VwTW9kZWxDaGFuZ2VLaW5kLkVESVRPUl9TVElDS1ksXG5cdFx0XHRlZGl0b3IsXG5cdFx0XHRlZGl0b3JJbmRleDogbmV3RWRpdG9ySW5kZXhcblx0XHR9O1xuXHRcdHRoaXMuX29uRGlkTW9kZWxDaGFuZ2UuZmlyZShldmVudCk7XG5cdH1cblxuXHR1bnN0aWNrKGNhbmRpZGF0ZTogRWRpdG9ySW5wdXQpOiBFZGl0b3JJbnB1dCB8IHVuZGVmaW5lZCB7XG5cdFx0Y29uc3QgcmVzID0gdGhpcy5maW5kRWRpdG9yKGNhbmRpZGF0ZSk7XG5cdFx0aWYgKCFyZXMpIHtcblx0XHRcdHJldHVybjsgLy8gbm90IGZvdW5kXG5cdFx0fVxuXG5cdFx0Y29uc3QgW2VkaXRvciwgZWRpdG9ySW5kZXhdID0gcmVzO1xuXG5cdFx0dGhpcy5kb1Vuc3RpY2soZWRpdG9yLCBlZGl0b3JJbmRleCk7XG5cblx0XHRyZXR1cm4gZWRpdG9yO1xuXHR9XG5cblx0cHJpdmF0ZSBkb1Vuc3RpY2soZWRpdG9yOiBFZGl0b3JJbnB1dCwgZWRpdG9ySW5kZXg6IG51bWJlcik6IHZvaWQge1xuXHRcdGlmICghdGhpcy5pc1N0aWNreShlZGl0b3JJbmRleCkpIHtcblx0XHRcdHJldHVybjsgLy8gY2FuIG9ubHkgdW5zdGljayBhIHN0aWNreSBlZGl0b3Jcblx0XHR9XG5cblx0XHQvLyBNb3ZlIGVkaXRvciB0byBiZSB0aGUgZmlyc3Qgbm9uLXN0aWNreSBlZGl0b3Jcblx0XHRjb25zdCBuZXdFZGl0b3JJbmRleCA9IHRoaXMuc3RpY2t5O1xuXHRcdHRoaXMubW92ZUVkaXRvcihlZGl0b3IsIG5ld0VkaXRvckluZGV4KTtcblxuXHRcdC8vIEFkanVzdCBzdGlja3kgaW5kZXhcblx0XHR0aGlzLnN0aWNreS0tO1xuXG5cdFx0Ly8gRXZlbnRcblx0XHRjb25zdCBldmVudDogSUdyb3VwRWRpdG9yQ2hhbmdlRXZlbnQgPSB7XG5cdFx0XHRraW5kOiBHcm91cE1vZGVsQ2hhbmdlS2luZC5FRElUT1JfU1RJQ0tZLFxuXHRcdFx0ZWRpdG9yLFxuXHRcdFx0ZWRpdG9ySW5kZXg6IG5ld0VkaXRvckluZGV4XG5cdFx0fTtcblx0XHR0aGlzLl9vbkRpZE1vZGVsQ2hhbmdlLmZpcmUoZXZlbnQpO1xuXHR9XG5cblx0aXNTdGlja3koY2FuZGlkYXRlT3JJbmRleDogRWRpdG9ySW5wdXQgfCBudW1iZXIpOiBib29sZWFuIHtcblx0XHRpZiAodGhpcy5zdGlja3kgPCAwKSB7XG5cdFx0XHRyZXR1cm4gZmFsc2U7IC8vIG5vIHN0aWNreSBlZGl0b3Jcblx0XHR9XG5cblx0XHRsZXQgaW5kZXg6IG51bWJlcjtcblx0XHRpZiAodHlwZW9mIGNhbmRpZGF0ZU9ySW5kZXggPT09ICdudW1iZXInKSB7XG5cdFx0XHRpbmRleCA9IGNhbmRpZGF0ZU9ySW5kZXg7XG5cdFx0fSBlbHNlIHtcblx0XHRcdGluZGV4ID0gdGhpcy5pbmRleE9mKGNhbmRpZGF0ZU9ySW5kZXgpO1xuXHRcdH1cblxuXHRcdGlmIChpbmRleCA8IDApIHtcblx0XHRcdHJldHVybiBmYWxzZTtcblx0XHR9XG5cblx0XHRyZXR1cm4gaW5kZXggPD0gdGhpcy5zdGlja3k7XG5cdH1cblxuXHRzZXRUcmFuc2llbnQoY2FuZGlkYXRlOiBFZGl0b3JJbnB1dCwgdHJhbnNpZW50OiBib29sZWFuKTogRWRpdG9ySW5wdXQgfCB1bmRlZmluZWQge1xuXHRcdGlmICghdHJhbnNpZW50ICYmIHRoaXMudHJhbnNpZW50LnNpemUgPT09IDApIHtcblx0XHRcdHJldHVybjsgLy8gbm8gdHJhbnNpZW50IGVkaXRvclxuXHRcdH1cblxuXHRcdGNvbnN0IHJlcyA9IHRoaXMuZmluZEVkaXRvcihjYW5kaWRhdGUpO1xuXHRcdGlmICghcmVzKSB7XG5cdFx0XHRyZXR1cm47IC8vIG5vdCBmb3VuZFxuXHRcdH1cblxuXHRcdGNvbnN0IFtlZGl0b3IsIGVkaXRvckluZGV4XSA9IHJlcztcblxuXHRcdHRoaXMuZG9TZXRUcmFuc2llbnQoZWRpdG9yLCBlZGl0b3JJbmRleCwgdHJhbnNpZW50KTtcblxuXHRcdHJldHVybiBlZGl0b3I7XG5cdH1cblxuXHRwcml2YXRlIGRvU2V0VHJhbnNpZW50KGVkaXRvcjogRWRpdG9ySW5wdXQsIGVkaXRvckluZGV4OiBudW1iZXIsIHRyYW5zaWVudDogYm9vbGVhbik6IHZvaWQge1xuXHRcdGlmICh0cmFuc2llbnQpIHtcblx0XHRcdGlmICh0aGlzLnRyYW5zaWVudC5oYXMoZWRpdG9yKSkge1xuXHRcdFx0XHRyZXR1cm47XG5cdFx0XHR9XG5cblx0XHRcdHRoaXMudHJhbnNpZW50LmFkZChlZGl0b3IpO1xuXHRcdH0gZWxzZSB7XG5cdFx0XHRpZiAoIXRoaXMudHJhbnNpZW50LmhhcyhlZGl0b3IpKSB7XG5cdFx0XHRcdHJldHVybjtcblx0XHRcdH1cblxuXHRcdFx0dGhpcy50cmFuc2llbnQuZGVsZXRlKGVkaXRvcik7XG5cdFx0fVxuXG5cdFx0Ly8gRXZlbnRcblx0XHRjb25zdCBldmVudDogSUdyb3VwRWRpdG9yQ2hhbmdlRXZlbnQgPSB7XG5cdFx0XHRraW5kOiBHcm91cE1vZGVsQ2hhbmdlS2luZC5FRElUT1JfVFJBTlNJRU5ULFxuXHRcdFx0ZWRpdG9yLFxuXHRcdFx0ZWRpdG9ySW5kZXhcblx0XHR9O1xuXHRcdHRoaXMuX29uRGlkTW9kZWxDaGFuZ2UuZmlyZShldmVudCk7XG5cdH1cblxuXHRpc1RyYW5zaWVudChlZGl0b3JDYW5kaWRhdGVPckluZGV4OiBFZGl0b3JJbnB1dCB8IG51bWJlcik6IGJvb2xlYW4ge1xuXHRcdGlmICh0aGlzLnRyYW5zaWVudC5zaXplID09PSAwKSB7XG5cdFx0XHRyZXR1cm4gZmFsc2U7IC8vIG5vIHRyYW5zaWVudCBlZGl0b3Jcblx0XHR9XG5cblx0XHRsZXQgZWRpdG9yOiBFZGl0b3JJbnB1dCB8IHVuZGVmaW5lZDtcblx0XHRpZiAodHlwZW9mIGVkaXRvckNhbmRpZGF0ZU9ySW5kZXggPT09ICdudW1iZXInKSB7XG5cdFx0XHRlZGl0b3IgPSB0aGlzLmVkaXRvcnNbZWRpdG9yQ2FuZGlkYXRlT3JJbmRleF07XG5cdFx0fSBlbHNlIHtcblx0XHRcdGVkaXRvciA9IHRoaXMuZmluZEVkaXRvcihlZGl0b3JDYW5kaWRhdGVPckluZGV4KT8uWzBdO1xuXHRcdH1cblxuXHRcdHJldHVybiAhIWVkaXRvciAmJiB0aGlzLnRyYW5zaWVudC5oYXMoZWRpdG9yKTtcblx0fVxuXG5cdHByaXZhdGUgc3BsaWNlKGluZGV4OiBudW1iZXIsIGRlbDogYm9vbGVhbiwgZWRpdG9yPzogRWRpdG9ySW5wdXQpOiB2b2lkIHtcblx0XHRjb25zdCBlZGl0b3JUb0RlbGV0ZU9yUmVwbGFjZSA9IHRoaXMuZWRpdG9yc1tpbmRleF07XG5cblx0XHQvLyBQZXJmb3JtIG9uIHN0aWNreSBpbmRleFxuXHRcdGlmIChkZWwgJiYgdGhpcy5pc1N0aWNreShpbmRleCkpIHtcblx0XHRcdHRoaXMuc3RpY2t5LS07XG5cdFx0fVxuXG5cdFx0Ly8gUGVyZm9ybSBvbiBlZGl0b3JzIGFycmF5XG5cdFx0aWYgKGVkaXRvcikge1xuXHRcdFx0dGhpcy5lZGl0b3JzLnNwbGljZShpbmRleCwgZGVsID8gMSA6IDAsIGVkaXRvcik7XG5cdFx0fSBlbHNlIHtcblx0XHRcdHRoaXMuZWRpdG9ycy5zcGxpY2UoaW5kZXgsIGRlbCA/IDEgOiAwKTtcblx0XHR9XG5cblx0XHQvLyBQZXJmb3JtIG9uIE1SVVxuXHRcdHtcblx0XHRcdC8vIEFkZFxuXHRcdFx0aWYgKCFkZWwgJiYgZWRpdG9yKSB7XG5cdFx0XHRcdGlmICh0aGlzLm1ydS5sZW5ndGggPT09IDApIHtcblx0XHRcdFx0XHQvLyB0aGUgbGlzdCBvZiBtb3N0IHJlY2VudCBlZGl0b3JzIGlzIGVtcHR5XG5cdFx0XHRcdFx0Ly8gc28gdGhpcyBlZGl0b3IgY2FuIG9ubHkgYmUgdGhlIG1vc3QgcmVjZW50XG5cdFx0XHRcdFx0dGhpcy5tcnUucHVzaChlZGl0b3IpO1xuXHRcdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRcdC8vIHdlIGhhdmUgbW9zdCByZWNlbnQgZWRpdG9ycy4gYXMgc3VjaCB3ZVxuXHRcdFx0XHRcdC8vIHB1dCB0aGlzIG5ld2x5IG9wZW5lZCBlZGl0b3IgcmlnaHQgYWZ0ZXJcblx0XHRcdFx0XHQvLyB0aGUgY3VycmVudCBtb3N0IHJlY2VudCBvbmUgYmVjYXVzZSBpdCBjYW5ub3Rcblx0XHRcdFx0XHQvLyBiZSB0aGUgbW9zdCByZWNlbnRseSBhY3RpdmUgb25lIHVubGVzc1xuXHRcdFx0XHRcdC8vIGl0IGJlY29tZXMgYWN0aXZlLiBidXQgaXQgaXMgc3RpbGwgbW9yZVxuXHRcdFx0XHRcdC8vIGFjdGl2ZSB0aGVuIGFueSBvdGhlciBlZGl0b3IgaW4gdGhlIGxpc3QuXG5cdFx0XHRcdFx0dGhpcy5tcnUuc3BsaWNlKDEsIDAsIGVkaXRvcik7XG5cdFx0XHRcdH1cblx0XHRcdH1cblxuXHRcdFx0Ly8gUmVtb3ZlIC8gUmVwbGFjZVxuXHRcdFx0ZWxzZSB7XG5cdFx0XHRcdGNvbnN0IGluZGV4SW5NUlUgPSB0aGlzLmluZGV4T2YoZWRpdG9yVG9EZWxldGVPclJlcGxhY2UsIHRoaXMubXJ1KTtcblxuXHRcdFx0XHQvLyBSZW1vdmVcblx0XHRcdFx0aWYgKGRlbCAmJiAhZWRpdG9yKSB7XG5cdFx0XHRcdFx0dGhpcy5tcnUuc3BsaWNlKGluZGV4SW5NUlUsIDEpOyAvLyByZW1vdmUgZnJvbSBNUlVcblx0XHRcdFx0fVxuXG5cdFx0XHRcdC8vIFJlcGxhY2Vcblx0XHRcdFx0ZWxzZSBpZiAoZGVsICYmIGVkaXRvcikge1xuXHRcdFx0XHRcdHRoaXMubXJ1LnNwbGljZShpbmRleEluTVJVLCAxLCBlZGl0b3IpOyAvLyByZXBsYWNlIE1SVSBhdCBsb2NhdGlvblxuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0fVxuXHR9XG5cblx0aW5kZXhPZihjYW5kaWRhdGU6IEVkaXRvcklucHV0IHwgSVVudHlwZWRFZGl0b3JJbnB1dCB8IG51bGwsIGVkaXRvcnMgPSB0aGlzLmVkaXRvcnMsIG9wdGlvbnM/OiBJTWF0Y2hFZGl0b3JPcHRpb25zKTogbnVtYmVyIHtcblx0XHRsZXQgaW5kZXggPSAtMTtcblx0XHRpZiAoIWNhbmRpZGF0ZSkge1xuXHRcdFx0cmV0dXJuIGluZGV4O1xuXHRcdH1cblxuXHRcdGZvciAobGV0IGkgPSAwOyBpIDwgZWRpdG9ycy5sZW5ndGg7IGkrKykge1xuXHRcdFx0Y29uc3QgZWRpdG9yID0gZWRpdG9yc1tpXTtcblxuXHRcdFx0aWYgKHRoaXMubWF0Y2hlcyhlZGl0b3IsIGNhbmRpZGF0ZSwgb3B0aW9ucykpIHtcblx0XHRcdFx0Ly8gSWYgd2UgYXJlIHRvIHN1cHBvcnQgc2lkZSBieSBzaWRlIG1hdGNoaW5nLCBpdCBpcyBwb3NzaWJsZSB0aGF0XG5cdFx0XHRcdC8vIGEgYmV0dGVyIGRpcmVjdCBtYXRjaCBpcyBmb3VuZCBsYXRlci4gQXMgc3VjaCwgd2UgY29udGludWUgZmluZGluZ1xuXHRcdFx0XHQvLyBhIG1hdGNoaW5nIGVkaXRvciBhbmQgcHJlZmVyIHRoYXQgbWF0Y2ggb3ZlciB0aGUgc2lkZSBieSBzaWRlIG9uZS5cblx0XHRcdFx0aWYgKG9wdGlvbnM/LnN1cHBvcnRTaWRlQnlTaWRlICYmIGVkaXRvciBpbnN0YW5jZW9mIFNpZGVCeVNpZGVFZGl0b3JJbnB1dCAmJiAhKGNhbmRpZGF0ZSBpbnN0YW5jZW9mIFNpZGVCeVNpZGVFZGl0b3JJbnB1dCkpIHtcblx0XHRcdFx0XHRpbmRleCA9IGk7XG5cdFx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdFx0aW5kZXggPSBpO1xuXHRcdFx0XHRcdGJyZWFrO1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0fVxuXG5cdFx0cmV0dXJuIGluZGV4O1xuXHR9XG5cblx0ZmluZEVkaXRvcihjYW5kaWRhdGU6IEVkaXRvcklucHV0IHwgbnVsbCwgb3B0aW9ucz86IElNYXRjaEVkaXRvck9wdGlvbnMpOiBbRWRpdG9ySW5wdXQsIG51bWJlciAvKiBpbmRleCAqL10gfCB1bmRlZmluZWQge1xuXHRcdGNvbnN0IGluZGV4ID0gdGhpcy5pbmRleE9mKGNhbmRpZGF0ZSwgdGhpcy5lZGl0b3JzLCBvcHRpb25zKTtcblx0XHRpZiAoaW5kZXggPT09IC0xKSB7XG5cdFx0XHRyZXR1cm4gdW5kZWZpbmVkO1xuXHRcdH1cblxuXHRcdHJldHVybiBbdGhpcy5lZGl0b3JzW2luZGV4XSwgaW5kZXhdO1xuXHR9XG5cblx0aXNGaXJzdChjYW5kaWRhdGU6IEVkaXRvcklucHV0IHwgbnVsbCwgZWRpdG9ycyA9IHRoaXMuZWRpdG9ycyk6IGJvb2xlYW4ge1xuXHRcdHJldHVybiB0aGlzLm1hdGNoZXMoZWRpdG9yc1swXSwgY2FuZGlkYXRlKTtcblx0fVxuXG5cdGlzTGFzdChjYW5kaWRhdGU6IEVkaXRvcklucHV0IHwgbnVsbCwgZWRpdG9ycyA9IHRoaXMuZWRpdG9ycyk6IGJvb2xlYW4ge1xuXHRcdHJldHVybiB0aGlzLm1hdGNoZXMoZWRpdG9yc1tlZGl0b3JzLmxlbmd0aCAtIDFdLCBjYW5kaWRhdGUpO1xuXHR9XG5cblx0Y29udGFpbnMoY2FuZGlkYXRlOiBFZGl0b3JJbnB1dCB8IElVbnR5cGVkRWRpdG9ySW5wdXQsIG9wdGlvbnM/OiBJTWF0Y2hFZGl0b3JPcHRpb25zKTogYm9vbGVhbiB7XG5cdFx0cmV0dXJuIHRoaXMuaW5kZXhPZihjYW5kaWRhdGUsIHRoaXMuZWRpdG9ycywgb3B0aW9ucykgIT09IC0xO1xuXHR9XG5cblx0cHJpdmF0ZSBtYXRjaGVzKGVkaXRvcjogRWRpdG9ySW5wdXQgfCBudWxsIHwgdW5kZWZpbmVkLCBjYW5kaWRhdGU6IEVkaXRvcklucHV0IHwgSVVudHlwZWRFZGl0b3JJbnB1dCB8IG51bGwsIG9wdGlvbnM/OiBJTWF0Y2hFZGl0b3JPcHRpb25zKTogYm9vbGVhbiB7XG5cdFx0aWYgKCFlZGl0b3IgfHwgIWNhbmRpZGF0ZSkge1xuXHRcdFx0cmV0dXJuIGZhbHNlO1xuXHRcdH1cblxuXHRcdGlmIChvcHRpb25zPy5zdXBwb3J0U2lkZUJ5U2lkZSAmJiBlZGl0b3IgaW5zdGFuY2VvZiBTaWRlQnlTaWRlRWRpdG9ySW5wdXQgJiYgIShjYW5kaWRhdGUgaW5zdGFuY2VvZiBTaWRlQnlTaWRlRWRpdG9ySW5wdXQpKSB7XG5cdFx0XHRzd2l0Y2ggKG9wdGlvbnMuc3VwcG9ydFNpZGVCeVNpZGUpIHtcblx0XHRcdFx0Y2FzZSBTaWRlQnlTaWRlRWRpdG9yLkFOWTpcblx0XHRcdFx0XHRpZiAodGhpcy5tYXRjaGVzKGVkaXRvci5wcmltYXJ5LCBjYW5kaWRhdGUsIG9wdGlvbnMpIHx8IHRoaXMubWF0Y2hlcyhlZGl0b3Iuc2Vjb25kYXJ5LCBjYW5kaWRhdGUsIG9wdGlvbnMpKSB7XG5cdFx0XHRcdFx0XHRyZXR1cm4gdHJ1ZTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0YnJlYWs7XG5cdFx0XHRcdGNhc2UgU2lkZUJ5U2lkZUVkaXRvci5CT1RIOlxuXHRcdFx0XHRcdGlmICh0aGlzLm1hdGNoZXMoZWRpdG9yLnByaW1hcnksIGNhbmRpZGF0ZSwgb3B0aW9ucykgJiYgdGhpcy5tYXRjaGVzKGVkaXRvci5zZWNvbmRhcnksIGNhbmRpZGF0ZSwgb3B0aW9ucykpIHtcblx0XHRcdFx0XHRcdHJldHVybiB0cnVlO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0XHRicmVhaztcblx0XHRcdH1cblx0XHR9XG5cblx0XHRjb25zdCBzdHJpY3RFcXVhbHMgPSBlZGl0b3IgPT09IGNhbmRpZGF0ZTtcblxuXHRcdGlmIChvcHRpb25zPy5zdHJpY3RFcXVhbHMpIHtcblx0XHRcdHJldHVybiBzdHJpY3RFcXVhbHM7XG5cdFx0fVxuXG5cdFx0cmV0dXJuIHN0cmljdEVxdWFscyB8fCBlZGl0b3IubWF0Y2hlcyhjYW5kaWRhdGUpO1xuXHR9XG5cblx0Z2V0IGlzTG9ja2VkKCk6IGJvb2xlYW4ge1xuXHRcdHJldHVybiB0aGlzLmxvY2tlZDtcblx0fVxuXG5cdGxvY2sobG9ja2VkOiBib29sZWFuKTogdm9pZCB7XG5cdFx0aWYgKHRoaXMuaXNMb2NrZWQgIT09IGxvY2tlZCkge1xuXHRcdFx0dGhpcy5sb2NrZWQgPSBsb2NrZWQ7XG5cblx0XHRcdHRoaXMuX29uRGlkTW9kZWxDaGFuZ2UuZmlyZSh7IGtpbmQ6IEdyb3VwTW9kZWxDaGFuZ2VLaW5kLkdST1VQX0xPQ0tFRCB9KTtcblx0XHR9XG5cdH1cblxuXHRjbG9uZSgpOiBFZGl0b3JHcm91cE1vZGVsIHtcblx0XHRjb25zdCBjbG9uZSA9IHRoaXMuaW5zdGFudGlhdGlvblNlcnZpY2UuY3JlYXRlSW5zdGFuY2UoRWRpdG9yR3JvdXBNb2RlbCwgdW5kZWZpbmVkKTtcblxuXHRcdC8vIENvcHkgb3ZlciBncm91cCBwcm9wZXJ0aWVzXG5cdFx0Y2xvbmUuZWRpdG9ycyA9IHRoaXMuZWRpdG9ycy5zbGljZSgwKTtcblx0XHRjbG9uZS5tcnUgPSB0aGlzLm1ydS5zbGljZSgwKTtcblx0XHRjbG9uZS5wcmV2aWV3ID0gdGhpcy5wcmV2aWV3O1xuXHRcdGNsb25lLnNlbGVjdGlvbiA9IHRoaXMuc2VsZWN0aW9uLnNsaWNlKDApO1xuXHRcdGNsb25lLnN0aWNreSA9IHRoaXMuc3RpY2t5O1xuXG5cdFx0Ly8gRW5zdXJlIHRvIHJlZ2lzdGVyIGxpc3RlbmVycyBmb3IgZWFjaCBlZGl0b3Jcblx0XHRmb3IgKGNvbnN0IGVkaXRvciBvZiBjbG9uZS5lZGl0b3JzKSB7XG5cdFx0XHRjbG9uZS5yZWdpc3RlckVkaXRvckxpc3RlbmVycyhlZGl0b3IpO1xuXHRcdH1cblxuXHRcdHJldHVybiBjbG9uZTtcblx0fVxuXG5cdHNlcmlhbGl6ZSgpOiBJU2VyaWFsaXplZEVkaXRvckdyb3VwTW9kZWwge1xuXHRcdGNvbnN0IHJlZ2lzdHJ5ID0gUmVnaXN0cnkuYXM8SUVkaXRvckZhY3RvcnlSZWdpc3RyeT4oRWRpdG9yRXh0ZW5zaW9ucy5FZGl0b3JGYWN0b3J5KTtcblxuXHRcdC8vIFNlcmlhbGl6ZSBhbGwgZWRpdG9yIGlucHV0cyBzbyB0aGF0IHdlIGNhbiBzdG9yZSB0aGVtLlxuXHRcdC8vIEVkaXRvcnMgdGhhdCBjYW5ub3QgYmUgc2VyaWFsaXplZCBuZWVkIHRvIGJlIGlnbm9yZWRcblx0XHQvLyBmcm9tIG1ydSwgYWN0aXZlLCBwcmV2aWV3IGFuZCBzdGlja3kgaWYgYW55LlxuXHRcdGNvbnN0IHNlcmlhbGl6YWJsZUVkaXRvcnM6IEVkaXRvcklucHV0W10gPSBbXTtcblx0XHRjb25zdCBzZXJpYWxpemVkRWRpdG9yczogSVNlcmlhbGl6ZWRFZGl0b3JJbnB1dFtdID0gW107XG5cdFx0bGV0IHNlcmlhbGl6YWJsZVByZXZpZXdJbmRleDogbnVtYmVyIHwgdW5kZWZpbmVkO1xuXHRcdGxldCBzZXJpYWxpemFibGVTdGlja3kgPSB0aGlzLnN0aWNreTtcblxuXHRcdGZvciAobGV0IGkgPSAwOyBpIDwgdGhpcy5lZGl0b3JzLmxlbmd0aDsgaSsrKSB7XG5cdFx0XHRjb25zdCBlZGl0b3IgPSB0aGlzLmVkaXRvcnNbaV07XG5cdFx0XHRsZXQgY2FuU2VyaWFsaXplRWRpdG9yID0gZmFsc2U7XG5cblx0XHRcdGNvbnN0IGVkaXRvclNlcmlhbGl6ZXIgPSByZWdpc3RyeS5nZXRFZGl0b3JTZXJpYWxpemVyKGVkaXRvcik7XG5cdFx0XHRpZiAoZWRpdG9yU2VyaWFsaXplcikge1xuXHRcdFx0XHRjb25zdCB2YWx1ZSA9IGVkaXRvclNlcmlhbGl6ZXIuY2FuU2VyaWFsaXplKGVkaXRvcikgPyBlZGl0b3JTZXJpYWxpemVyLnNlcmlhbGl6ZShlZGl0b3IpIDogdW5kZWZpbmVkO1xuXG5cdFx0XHRcdC8vIEVkaXRvciBjYW4gYmUgc2VyaWFsaXplZFxuXHRcdFx0XHRpZiAodHlwZW9mIHZhbHVlID09PSAnc3RyaW5nJykge1xuXHRcdFx0XHRcdGNhblNlcmlhbGl6ZUVkaXRvciA9IHRydWU7XG5cblx0XHRcdFx0XHRzZXJpYWxpemVkRWRpdG9ycy5wdXNoKHsgaWQ6IGVkaXRvci50eXBlSWQsIHZhbHVlIH0pO1xuXHRcdFx0XHRcdHNlcmlhbGl6YWJsZUVkaXRvcnMucHVzaChlZGl0b3IpO1xuXG5cdFx0XHRcdFx0aWYgKHRoaXMucHJldmlldyA9PT0gZWRpdG9yKSB7XG5cdFx0XHRcdFx0XHRzZXJpYWxpemFibGVQcmV2aWV3SW5kZXggPSBzZXJpYWxpemFibGVFZGl0b3JzLmxlbmd0aCAtIDE7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9XG5cblx0XHRcdFx0Ly8gRWRpdG9yIGNhbm5vdCBiZSBzZXJpYWxpemVkXG5cdFx0XHRcdGVsc2Uge1xuXHRcdFx0XHRcdGNhblNlcmlhbGl6ZUVkaXRvciA9IGZhbHNlO1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cblx0XHRcdC8vIEFkanVzdCBpbmRleCBvZiBzdGlja3kgZWRpdG9ycyBpZiB0aGUgZWRpdG9yIGNhbm5vdCBiZSBzZXJpYWxpemVkIGFuZCBpcyBwaW5uZWRcblx0XHRcdGlmICghY2FuU2VyaWFsaXplRWRpdG9yICYmIHRoaXMuaXNTdGlja3koaSkpIHtcblx0XHRcdFx0c2VyaWFsaXphYmxlU3RpY2t5LS07XG5cdFx0XHR9XG5cdFx0fVxuXG5cdFx0Y29uc3Qgc2VyaWFsaXphYmxlTXJ1ID0gdGhpcy5tcnUubWFwKGVkaXRvciA9PiB0aGlzLmluZGV4T2YoZWRpdG9yLCBzZXJpYWxpemFibGVFZGl0b3JzKSkuZmlsdGVyKGkgPT4gaSA+PSAwKTtcblxuXHRcdHJldHVybiB7XG5cdFx0XHRpZDogdGhpcy5pZCxcblx0XHRcdGxvY2tlZDogdGhpcy5sb2NrZWQgPyB0cnVlIDogdW5kZWZpbmVkLFxuXHRcdFx0ZWRpdG9yczogc2VyaWFsaXplZEVkaXRvcnMsXG5cdFx0XHRtcnU6IHNlcmlhbGl6YWJsZU1ydSxcblx0XHRcdHByZXZpZXc6IHNlcmlhbGl6YWJsZVByZXZpZXdJbmRleCxcblx0XHRcdHN0aWNreTogc2VyaWFsaXphYmxlU3RpY2t5ID49IDAgPyBzZXJpYWxpemFibGVTdGlja3kgOiB1bmRlZmluZWRcblx0XHR9O1xuXHR9XG5cblx0cHJpdmF0ZSBkZXNlcmlhbGl6ZShkYXRhOiBJU2VyaWFsaXplZEVkaXRvckdyb3VwTW9kZWwpOiBudW1iZXIge1xuXHRcdGNvbnN0IHJlZ2lzdHJ5ID0gUmVnaXN0cnkuYXM8SUVkaXRvckZhY3RvcnlSZWdpc3RyeT4oRWRpdG9yRXh0ZW5zaW9ucy5FZGl0b3JGYWN0b3J5KTtcblxuXHRcdGlmICh0eXBlb2YgZGF0YS5pZCA9PT0gJ251bWJlcicpIHtcblx0XHRcdHRoaXMuX2lkID0gZGF0YS5pZDtcblxuXHRcdFx0RWRpdG9yR3JvdXBNb2RlbC5JRFMgPSBNYXRoLm1heChkYXRhLmlkICsgMSwgRWRpdG9yR3JvdXBNb2RlbC5JRFMpOyAvLyBtYWtlIHN1cmUgb3VyIElEIGdlbmVyYXRvciBpcyBhbHdheXMgbGFyZ2VyXG5cdFx0fSBlbHNlIHtcblx0XHRcdHRoaXMuX2lkID0gRWRpdG9yR3JvdXBNb2RlbC5JRFMrKzsgLy8gYmFja3dhcmRzIGNvbXBhdGliaWxpdHlcblx0XHR9XG5cblx0XHRpZiAoZGF0YS5sb2NrZWQpIHtcblx0XHRcdHRoaXMubG9ja2VkID0gdHJ1ZTtcblx0XHR9XG5cblx0XHR0aGlzLmVkaXRvcnMgPSBjb2FsZXNjZShkYXRhLmVkaXRvcnMubWFwKChlLCBpbmRleCkgPT4ge1xuXHRcdFx0bGV0IGVkaXRvcjogRWRpdG9ySW5wdXQgfCB1bmRlZmluZWQgPSB1bmRlZmluZWQ7XG5cblx0XHRcdGNvbnN0IGVkaXRvclNlcmlhbGl6ZXIgPSByZWdpc3RyeS5nZXRFZGl0b3JTZXJpYWxpemVyKGUuaWQpO1xuXHRcdFx0aWYgKGVkaXRvclNlcmlhbGl6ZXIpIHtcblx0XHRcdFx0Y29uc3QgZGVzZXJpYWxpemVkRWRpdG9yID0gZWRpdG9yU2VyaWFsaXplci5kZXNlcmlhbGl6ZSh0aGlzLmluc3RhbnRpYXRpb25TZXJ2aWNlLCBlLnZhbHVlKTtcblx0XHRcdFx0aWYgKGRlc2VyaWFsaXplZEVkaXRvciBpbnN0YW5jZW9mIEVkaXRvcklucHV0KSB7XG5cdFx0XHRcdFx0ZWRpdG9yID0gZGVzZXJpYWxpemVkRWRpdG9yO1xuXHRcdFx0XHRcdHRoaXMucmVnaXN0ZXJFZGl0b3JMaXN0ZW5lcnMoZWRpdG9yKTtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXG5cdFx0XHRpZiAoIWVkaXRvciAmJiB0eXBlb2YgZGF0YS5zdGlja3kgPT09ICdudW1iZXInICYmIGluZGV4IDw9IGRhdGEuc3RpY2t5KSB7XG5cdFx0XHRcdGRhdGEuc3RpY2t5LS07IC8vIGlmIGVkaXRvciBjYW5ub3QgYmUgZGVzZXJpYWxpemVkIGJ1dCB3YXMgc3RpY2t5LCB3ZSBuZWVkIHRvIGRlY3JlYXNlIHN0aWNreSBpbmRleFxuXHRcdFx0fVxuXG5cdFx0XHRyZXR1cm4gZWRpdG9yO1xuXHRcdH0pKTtcblxuXHRcdHRoaXMubXJ1ID0gY29hbGVzY2UoZGF0YS5tcnUubWFwKGkgPT4gdGhpcy5lZGl0b3JzW2ldKSk7XG5cblx0XHR0aGlzLnNlbGVjdGlvbiA9IHRoaXMubXJ1Lmxlbmd0aCA+IDAgPyBbdGhpcy5tcnVbMF1dIDogW107XG5cblx0XHRpZiAodHlwZW9mIGRhdGEucHJldmlldyA9PT0gJ251bWJlcicpIHtcblx0XHRcdHRoaXMucHJldmlldyA9IHRoaXMuZWRpdG9yc1tkYXRhLnByZXZpZXddO1xuXHRcdH1cblxuXHRcdGlmICh0eXBlb2YgZGF0YS5zdGlja3kgPT09ICdudW1iZXInKSB7XG5cdFx0XHR0aGlzLnN0aWNreSA9IGRhdGEuc3RpY2t5O1xuXHRcdH1cblxuXHRcdHJldHVybiB0aGlzLl9pZDtcblx0fVxuXG5cdG92ZXJyaWRlIGRpc3Bvc2UoKTogdm9pZCB7XG5cdFx0ZGlzcG9zZShBcnJheS5mcm9tKHRoaXMuZWRpdG9yTGlzdGVuZXJzKSk7XG5cdFx0dGhpcy5lZGl0b3JMaXN0ZW5lcnMuY2xlYXIoKTtcblxuXHRcdHRoaXMudHJhbnNpZW50LmNsZWFyKCk7XG5cblx0XHRzdXBlci5kaXNwb3NlKCk7XG5cdH1cbn1cbiJdLAogICJtYXBwaW5ncyI6ICI7Ozs7Ozs7Ozs7O0FBS0EsU0FBUyxPQUFPLGVBQWU7QUFDL0IsU0FBa0QsY0FBYyxrQkFBdUMsa0JBQWtCLG9CQUF5Qyw0QkFBNEI7QUFDOUwsU0FBUyxtQkFBbUI7QUFDNUIsU0FBUyw2QkFBNkI7QUFDdEMsU0FBUyw2QkFBNkI7QUFDdEMsU0FBb0MsNkJBQTZCO0FBQ2pFLFNBQVMsU0FBUyxZQUFZLHVCQUF1QjtBQUNyRCxTQUFTLGdCQUFnQjtBQUN6QixTQUFTLGdCQUFnQjtBQUV6QixNQUFNLHdCQUF3QjtBQUFBLEVBQzdCLE1BQU07QUFBQSxFQUNOLE9BQU87QUFBQSxFQUNQLE9BQU87QUFBQSxFQUNQLE1BQU07QUFDUDtBQStCTyxTQUFTLDZCQUE2QixPQUF1RDtBQUNuRyxRQUFNLFlBQVk7QUFFbEIsU0FBTyxDQUFDLEVBQUUsYUFBYSxPQUFPLGNBQWMsWUFBWSxNQUFNLFFBQVEsVUFBVSxPQUFPLEtBQUssTUFBTSxRQUFRLFVBQVUsR0FBRztBQUN4SDtBQTZDTyxTQUFTLHlCQUF5QixH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
