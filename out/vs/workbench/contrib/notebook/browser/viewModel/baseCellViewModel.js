import { Emitter } from "../../../../../base/common/event.js";
import { Disposable, MutableDisposable, dispose } from "../../../../../base/common/lifecycle.js";
import { Mimes } from "../../../../../base/common/mime.js";
import { Range } from "../../../../../editor/common/core/range.js";
import { Selection } from "../../../../../editor/common/core/selection.js";
import * as editorCommon from "../../../../../editor/common/editorCommon.js";
import { SearchParams } from "../../../../../editor/common/model/textModelSearch.js";
import { readTransientState, writeTransientState } from "../../../codeEditor/browser/toggleWordWrap.js";
import { CellEditState, CellFocusMode, CursorAtBoundary, CursorAtLineBoundary } from "../notebookBrowser.js";
class BaseCellViewModel extends Disposable {
  constructor(viewType, model2, id, _viewContext, _configurationService, _modelService, _undoRedoService, _codeEditorService, _inlineChatSessionService) {
    super();
    this.viewType = viewType;
    this.model = model2;
    this.id = id;
    this._viewContext = _viewContext;
    this._configurationService = _configurationService;
    this._modelService = _modelService;
    this._undoRedoService = _undoRedoService;
    this._codeEditorService = _codeEditorService;
    this._inlineChatSessionService = _inlineChatSessionService;
    this._onDidChangeEditorAttachState = this._register(new Emitter());
    // Do not merge this event with `onDidChangeState` as we are using `Event.once(onDidChangeEditorAttachState)` elsewhere.
    this.onDidChangeEditorAttachState = this._onDidChangeEditorAttachState.event;
    this._onDidChangeState = this._register(new Emitter());
    this.onDidChangeState = this._onDidChangeState.event;
    this._editState = CellEditState.Preview;
    this._lineNumbers = "inherit";
    this._focusMode = CellFocusMode.Container;
    this._editorListeners = [];
    this._editorViewStates = null;
    this._editorTransientState = null;
    this._resolvedCellDecorations = /* @__PURE__ */ new Map();
    this._textModelRefChangeDisposable = this._register(new MutableDisposable());
    this._cellDecorationsChanged = this._register(new Emitter());
    this.onCellDecorationsChanged = this._cellDecorationsChanged.event;
    this._resolvedDecorations = /* @__PURE__ */ new Map();
    this._lastDecorationId = 0;
    this._cellStatusBarItems = /* @__PURE__ */ new Map();
    this._onDidChangeCellStatusBarItems = this._register(new Emitter());
    this.onDidChangeCellStatusBarItems = this._onDidChangeCellStatusBarItems.event;
    this._lastStatusBarId = 0;
    this._dragging = false;
    this._inputCollapsed = false;
    this._outputCollapsed = false;
    this._commentHeight = 0;
    this._isDisposed = false;
    this._isReadonly = false;
    this._editStateSource = "";
    this._register(model2.onDidChangeMetadata(() => {
      this._onDidChangeState.fire({ metadataChanged: true });
    }));
    this._register(model2.onDidChangeInternalMetadata((e) => {
      this._onDidChangeState.fire({ internalMetadataChanged: true });
      if (e.lastRunSuccessChanged) {
        this.layoutChange({});
      }
    }));
    this._register(this._configurationService.onDidChangeConfiguration((e) => {
      if (e.affectsConfiguration("notebook.lineNumbers")) {
        this.lineNumbers = "inherit";
      }
    }));
    if (this.model.collapseState?.inputCollapsed) {
      this._inputCollapsed = true;
    }
    if (this.model.collapseState?.outputCollapsed) {
      this._outputCollapsed = true;
    }
    this._commentOptions = this._configurationService.getValue("editor.comments", { overrideIdentifier: this.language });
    this._register(this._configurationService.onDidChangeConfiguration((e) => {
      if (e.affectsConfiguration("editor.comments")) {
        this._commentOptions = this._configurationService.getValue("editor.comments", { overrideIdentifier: this.language });
      }
    }));
  }
  get handle() {
    return this.model.handle;
  }
  get uri() {
    return this.model.uri;
  }
  get lineCount() {
    return this.model.textBuffer.getLineCount();
  }
  get metadata() {
    return this.model.metadata;
  }
  get internalMetadata() {
    return this.model.internalMetadata;
  }
  get language() {
    return this.model.language;
  }
  get mime() {
    if (typeof this.model.mime === "string") {
      return this.model.mime;
    }
    switch (this.language) {
      case "markdown":
        return Mimes.markdown;
      default:
        return Mimes.text;
    }
  }
  get lineNumbers() {
    return this._lineNumbers;
  }
  set lineNumbers(lineNumbers) {
    if (lineNumbers === this._lineNumbers) {
      return;
    }
    this._lineNumbers = lineNumbers;
    this._onDidChangeState.fire({ cellLineNumberChanged: true });
  }
  get commentOptions() {
    return this._commentOptions;
  }
  set commentOptions(newOptions) {
    this._commentOptions = newOptions;
  }
  get focusMode() {
    return this._focusMode;
  }
  set focusMode(newMode) {
    if (this._focusMode !== newMode) {
      this._focusMode = newMode;
      this._onDidChangeState.fire({ focusModeChanged: true });
    }
  }
  get editorAttached() {
    return !!this._textEditor;
  }
  get textModel() {
    return this.model.textModel;
  }
  hasModel() {
    return !!this.textModel;
  }
  get dragging() {
    return this._dragging;
  }
  set dragging(v) {
    this._dragging = v;
    this._onDidChangeState.fire({ dragStateChanged: true });
  }
  get isInputCollapsed() {
    return this._inputCollapsed;
  }
  set isInputCollapsed(v) {
    this._inputCollapsed = v;
    this._onDidChangeState.fire({ inputCollapsedChanged: true });
  }
  get isOutputCollapsed() {
    return this._outputCollapsed;
  }
  set isOutputCollapsed(v) {
    this._outputCollapsed = v;
    this._onDidChangeState.fire({ outputCollapsedChanged: true });
  }
  set commentHeight(height) {
    if (this._commentHeight === height) {
      return;
    }
    this._commentHeight = height;
    this.layoutChange({ commentHeight: true }, "BaseCellViewModel#commentHeight");
  }
  updateOptions(e) {
    if (this._textEditor && typeof e.readonly === "boolean") {
      this._textEditor.updateOptions({ readOnly: e.readonly });
    }
    if (typeof e.readonly === "boolean") {
      this._isReadonly = e.readonly;
    }
  }
  assertTextModelAttached() {
    if (this.textModel && this._textEditor && this._textEditor.getModel() === this.textModel) {
      return true;
    }
    return false;
  }
  // private handleKeyDown(e: IKeyboardEvent) {
  // 	if (this.viewType === IPYNB_VIEW_TYPE && isWindows && e.ctrlKey && e.keyCode === KeyCode.Enter) {
  // 		this._keymapService.promptKeymapRecommendation();
  // 	}
  // }
  attachTextEditor(editor, estimatedHasHorizontalScrolling) {
    if (!editor.hasModel()) {
      throw new Error("Invalid editor: model is missing");
    }
    if (this._textEditor === editor) {
      if (this._editorListeners.length === 0) {
        this._editorListeners.push(this._textEditor.onDidChangeCursorSelection(() => {
          this._onDidChangeState.fire({ selectionChanged: true });
        }));
        this._onDidChangeState.fire({ selectionChanged: true });
      }
      return;
    }
    this._textEditor = editor;
    if (this._isReadonly) {
      editor.updateOptions({ readOnly: this._isReadonly });
    }
    if (this._editorViewStates) {
      this._restoreViewState(this._editorViewStates);
    } else {
      if (estimatedHasHorizontalScrolling) {
        this._restoreViewState({
          contributionsState: {},
          cursorState: [],
          viewState: {
            scrollLeft: 0,
            firstPosition: { lineNumber: 1, column: 1 },
            firstPositionDeltaTop: this._viewContext.notebookOptions.getLayoutConfiguration().editorTopPadding
          }
        });
      }
    }
    if (this._editorTransientState) {
      writeTransientState(editor.getModel(), this._editorTransientState, this._codeEditorService);
    }
    if (this._isDisposed) {
      return;
    }
    editor.changeDecorations((accessor) => {
      this._resolvedDecorations.forEach((value, key) => {
        if (key.startsWith("_lazy_")) {
          const ret = accessor.addDecoration(value.options.range, value.options.options);
          this._resolvedDecorations.get(key).id = ret;
        } else {
          const ret = accessor.addDecoration(value.options.range, value.options.options);
          this._resolvedDecorations.get(key).id = ret;
        }
      });
    });
    this._editorListeners.push(editor.onDidChangeCursorSelection(() => {
      this._onDidChangeState.fire({ selectionChanged: true });
    }));
    this._editorListeners.push(this._inlineChatSessionService.onWillStartSession((e) => {
      if (e === this._textEditor && this.textBuffer.getLength() === 0) {
        this.enableAutoLanguageDetection();
      }
    }));
    this._onDidChangeState.fire({ selectionChanged: true });
    this._onDidChangeEditorAttachState.fire();
  }
  detachTextEditor() {
    this.saveViewState();
    this.saveTransientState();
    this._textEditor?.changeDecorations((accessor) => {
      this._resolvedDecorations.forEach((value) => {
        const resolvedid = value.id;
        if (resolvedid) {
          accessor.removeDecoration(resolvedid);
        }
      });
    });
    this._textEditor = void 0;
    dispose(this._editorListeners);
    this._editorListeners = [];
    this._onDidChangeEditorAttachState.fire();
    if (this._textModelRef) {
      this._textModelRef.dispose();
      this._textModelRef = void 0;
    }
    this._textModelRefChangeDisposable.clear();
  }
  getText() {
    return this.model.getValue();
  }
  getAlternativeId() {
    return this.model.alternativeId;
  }
  getTextLength() {
    return this.model.getTextLength();
  }
  enableAutoLanguageDetection() {
    this.model.enableAutoLanguageDetection();
  }
  saveViewState() {
    if (!this._textEditor) {
      return;
    }
    this._editorViewStates = this._textEditor.saveViewState();
  }
  saveTransientState() {
    if (!this._textEditor || !this._textEditor.hasModel()) {
      return;
    }
    this._editorTransientState = readTransientState(this._textEditor.getModel(), this._codeEditorService);
  }
  saveEditorViewState() {
    if (this._textEditor) {
      this._editorViewStates = this._textEditor.saveViewState();
    }
    return this._editorViewStates;
  }
  restoreEditorViewState(editorViewStates, totalHeight) {
    this._editorViewStates = editorViewStates;
  }
  _restoreViewState(state) {
    if (state) {
      this._textEditor?.restoreViewState(state);
    }
  }
  addModelDecoration(decoration) {
    if (!this._textEditor) {
      const id2 = ++this._lastDecorationId;
      const decorationId = `_lazy_${this.id};${id2}`;
      this._resolvedDecorations.set(decorationId, { options: decoration });
      return decorationId;
    }
    let id;
    this._textEditor.changeDecorations((accessor) => {
      id = accessor.addDecoration(decoration.range, decoration.options);
      this._resolvedDecorations.set(id, { id, options: decoration });
    });
    return id;
  }
  removeModelDecoration(decorationId) {
    const realDecorationId = this._resolvedDecorations.get(decorationId);
    if (this._textEditor && realDecorationId && realDecorationId.id !== void 0) {
      this._textEditor.changeDecorations((accessor) => {
        accessor.removeDecoration(realDecorationId.id);
      });
    }
    this._resolvedDecorations.delete(decorationId);
  }
  deltaModelDecorations(oldDecorations, newDecorations) {
    oldDecorations.forEach((id) => {
      this.removeModelDecoration(id);
    });
    const ret = newDecorations.map((option) => {
      return this.addModelDecoration(option);
    });
    return ret;
  }
  _removeCellDecoration(decorationId) {
    const options = this._resolvedCellDecorations.get(decorationId);
    this._resolvedCellDecorations.delete(decorationId);
    if (options) {
      for (const existingOptions of this._resolvedCellDecorations.values()) {
        if (options.className === existingOptions.className) {
          options.className = void 0;
        }
        if (options.outputClassName === existingOptions.outputClassName) {
          options.outputClassName = void 0;
        }
        if (options.gutterClassName === existingOptions.gutterClassName) {
          options.gutterClassName = void 0;
        }
        if (options.topClassName === existingOptions.topClassName) {
          options.topClassName = void 0;
        }
      }
      this._cellDecorationsChanged.fire({ added: [], removed: [options] });
    }
  }
  _addCellDecoration(options) {
    const id = ++this._lastDecorationId;
    const decorationId = `_cell_${this.id};${id}`;
    this._resolvedCellDecorations.set(decorationId, options);
    this._cellDecorationsChanged.fire({ added: [options], removed: [] });
    return decorationId;
  }
  getCellDecorations() {
    return [...this._resolvedCellDecorations.values()];
  }
  getCellDecorationRange(decorationId) {
    if (this._textEditor) {
      return this._textEditor.getModel()?.getDecorationRange(decorationId) ?? null;
    }
    return null;
  }
  deltaCellDecorations(oldDecorations, newDecorations) {
    oldDecorations.forEach((id) => {
      this._removeCellDecoration(id);
    });
    const ret = newDecorations.map((option) => {
      return this._addCellDecoration(option);
    });
    return ret;
  }
  deltaCellStatusBarItems(oldItems, newItems) {
    oldItems.forEach((id) => {
      const item = this._cellStatusBarItems.get(id);
      if (item) {
        this._cellStatusBarItems.delete(id);
      }
    });
    const newIds = newItems.map((item) => {
      const id = ++this._lastStatusBarId;
      const itemId = `_cell_${this.id};${id}`;
      this._cellStatusBarItems.set(itemId, item);
      return itemId;
    });
    this._onDidChangeCellStatusBarItems.fire();
    return newIds;
  }
  getCellStatusBarItems() {
    return Array.from(this._cellStatusBarItems.values());
  }
  revealRangeInCenter(range) {
    this._textEditor?.revealRangeInCenter(range, editorCommon.ScrollType.Immediate);
  }
  setSelection(range) {
    this._textEditor?.setSelection(range);
  }
  setSelections(selections) {
    if (selections.length) {
      if (this._textEditor) {
        this._textEditor?.setSelections(selections);
      } else if (this._editorViewStates) {
        this._editorViewStates.cursorState = selections.map((selection) => {
          return {
            inSelectionMode: !selection.isEmpty(),
            selectionStart: selection.getStartPosition(),
            position: selection.getEndPosition()
          };
        });
      }
    }
  }
  getSelections() {
    return this._textEditor?.getSelections() ?? this._editorViewStates?.cursorState.map((state) => new Selection(state.selectionStart.lineNumber, state.selectionStart.column, state.position.lineNumber, state.position.column)) ?? [];
  }
  getSelectionsStartPosition() {
    if (this._textEditor) {
      const selections = this._textEditor.getSelections();
      return selections?.map((s) => s.getStartPosition());
    } else {
      const selections = this._editorViewStates?.cursorState;
      return selections?.map((s) => s.selectionStart);
    }
  }
  getLineScrollTopOffset(line) {
    if (!this._textEditor) {
      return 0;
    }
    const editorPadding = this._viewContext.notebookOptions.computeEditorPadding(this.internalMetadata, this.uri);
    return this._textEditor.getTopForLineNumber(line) + editorPadding.top;
  }
  getPositionScrollTopOffset(range) {
    if (!this._textEditor) {
      return 0;
    }
    const position = range instanceof Selection ? range.getPosition() : range.getStartPosition();
    const editorPadding = this._viewContext.notebookOptions.computeEditorPadding(this.internalMetadata, this.uri);
    return this._textEditor.getTopForPosition(position.lineNumber, position.column) + editorPadding.top;
  }
  cursorAtLineBoundary() {
    if (!this._textEditor || !this.textModel || !this._textEditor.hasTextFocus()) {
      return CursorAtLineBoundary.None;
    }
    const selection = this._textEditor.getSelection();
    if (!selection || !selection.isEmpty()) {
      return CursorAtLineBoundary.None;
    }
    const currentLineLength = this.textModel.getLineLength(selection.startLineNumber);
    if (currentLineLength === 0) {
      return CursorAtLineBoundary.Both;
    }
    switch (selection.startColumn) {
      case 1:
        return CursorAtLineBoundary.Start;
      case currentLineLength + 1:
        return CursorAtLineBoundary.End;
      default:
        return CursorAtLineBoundary.None;
    }
  }
  cursorAtBoundary() {
    if (!this._textEditor) {
      return CursorAtBoundary.None;
    }
    if (!this.textModel) {
      return CursorAtBoundary.None;
    }
    const selection = this._textEditor.getSelection();
    if (!selection || !selection.isEmpty()) {
      return CursorAtBoundary.None;
    }
    const firstViewLineTop = this._textEditor.getTopForPosition(1, 1);
    const lastViewLineTop = this._textEditor.getTopForPosition(this.textModel.getLineCount(), this.textModel.getLineLength(this.textModel.getLineCount()));
    const selectionTop = this._textEditor.getTopForPosition(selection.startLineNumber, selection.startColumn);
    if (selectionTop === lastViewLineTop) {
      if (selectionTop === firstViewLineTop) {
        return CursorAtBoundary.Both;
      } else {
        return CursorAtBoundary.Bottom;
      }
    } else {
      if (selectionTop === firstViewLineTop) {
        return CursorAtBoundary.Top;
      } else {
        return CursorAtBoundary.None;
      }
    }
  }
  get editStateSource() {
    return this._editStateSource;
  }
  updateEditState(newState, source) {
    this._editStateSource = source;
    if (newState === this._editState) {
      return;
    }
    this._editState = newState;
    this._onDidChangeState.fire({ editStateChanged: true });
    if (this._editState === CellEditState.Preview) {
      this.focusMode = CellFocusMode.Container;
    }
  }
  getEditState() {
    return this._editState;
  }
  get textBuffer() {
    return this.model.textBuffer;
  }
  /**
   * Text model is used for editing.
   */
  async resolveTextModel() {
    if (!this._textModelRef || !this.textModel) {
      this._textModelRef = await this._modelService.createModelReference(this.uri);
      if (this._isDisposed) {
        return this.textModel;
      }
      if (!this._textModelRef) {
        throw new Error(`Cannot resolve text model for ${this.uri}`);
      }
      this._textModelRefChangeDisposable.value = this.textModel.onDidChangeContent(() => this.onDidChangeTextModelContent());
    }
    return this.textModel;
  }
  cellStartFind(value, options) {
    let cellMatches = [];
    const lineCount = this.textBuffer.getLineCount();
    const findRange = options.findScope?.selectedTextRanges ?? [new Range(1, 1, lineCount, this.textBuffer.getLineLength(lineCount) + 1)];
    if (this.assertTextModelAttached()) {
      cellMatches = this.textModel.findMatches(
        value,
        findRange,
        options.regex || false,
        options.caseSensitive || false,
        options.wholeWord ? options.wordSeparators || null : null,
        options.regex || false
      );
    } else {
      const searchParams = new SearchParams(value, options.regex || false, options.caseSensitive || false, options.wholeWord ? options.wordSeparators || null : null);
      const searchData = searchParams.parseSearchRequest();
      if (!searchData) {
        return null;
      }
      findRange.forEach((range) => {
        cellMatches.push(...this.textBuffer.findMatchesLineByLine(new Range(range.startLineNumber, range.startColumn, range.endLineNumber, range.endColumn), searchData, options.regex || false, 1e3));
      });
    }
    return cellMatches;
  }
  dispose() {
    this._isDisposed = true;
    super.dispose();
    dispose(this._editorListeners);
    if (this._undoRedoService.getUriComparisonKey(this.uri) === this.uri.toString()) {
      this._undoRedoService.removeElements(this.uri);
    }
    this._textModelRef?.dispose();
  }
  toJSON() {
    return {
      handle: this.handle
    };
  }
}
export {
  BaseCellViewModel
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvY29udHJpYi9ub3RlYm9vay9icm93c2VyL3ZpZXdNb2RlbC9iYXNlQ2VsbFZpZXdNb2RlbC50cyJdLAogICJzb3VyY2VzQ29udGVudCI6IFsiLyotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cbiAqICBDb3B5cmlnaHQgKGMpIE1pY3Jvc29mdCBDb3Jwb3JhdGlvbi4gQWxsIHJpZ2h0cyByZXNlcnZlZC5cbiAqICBMaWNlbnNlZCB1bmRlciB0aGUgTUlUIExpY2Vuc2UuIFNlZSBMaWNlbnNlLnR4dCBpbiB0aGUgcHJvamVjdCByb290IGZvciBsaWNlbnNlIGluZm9ybWF0aW9uLlxuICotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLSovXG5cbmltcG9ydCB7IEVtaXR0ZXIsIEV2ZW50IH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vZXZlbnQuanMnO1xuaW1wb3J0IHsgRGlzcG9zYWJsZSwgSURpc3Bvc2FibGUsIElSZWZlcmVuY2UsIE11dGFibGVEaXNwb3NhYmxlLCBkaXNwb3NlIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vbGlmZWN5Y2xlLmpzJztcbmltcG9ydCB7IE1pbWVzIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vbWltZS5qcyc7XG5pbXBvcnQgeyBJQ29kZUVkaXRvciB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL2VkaXRvci9icm93c2VyL2VkaXRvckJyb3dzZXIuanMnO1xuaW1wb3J0IHsgSUNvZGVFZGl0b3JTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vZWRpdG9yL2Jyb3dzZXIvc2VydmljZXMvY29kZUVkaXRvclNlcnZpY2UuanMnO1xuaW1wb3J0IHsgSUVkaXRvckNvbW1lbnRzT3B0aW9ucyB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL2VkaXRvci9jb21tb24vY29uZmlnL2VkaXRvck9wdGlvbnMuanMnO1xuaW1wb3J0IHsgSVBvc2l0aW9uIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vZWRpdG9yL2NvbW1vbi9jb3JlL3Bvc2l0aW9uLmpzJztcbmltcG9ydCB7IElSYW5nZSwgUmFuZ2UgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9lZGl0b3IvY29tbW9uL2NvcmUvcmFuZ2UuanMnO1xuaW1wb3J0IHsgU2VsZWN0aW9uIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vZWRpdG9yL2NvbW1vbi9jb3JlL3NlbGVjdGlvbi5qcyc7XG5pbXBvcnQgKiBhcyBlZGl0b3JDb21tb24gZnJvbSAnLi4vLi4vLi4vLi4vLi4vZWRpdG9yL2NvbW1vbi9lZGl0b3JDb21tb24uanMnO1xuaW1wb3J0ICogYXMgbW9kZWwgZnJvbSAnLi4vLi4vLi4vLi4vLi4vZWRpdG9yL2NvbW1vbi9tb2RlbC5qcyc7XG5pbXBvcnQgeyBTZWFyY2hQYXJhbXMgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9lZGl0b3IvY29tbW9uL21vZGVsL3RleHRNb2RlbFNlYXJjaC5qcyc7XG5pbXBvcnQgeyBJUmVzb2x2ZWRUZXh0RWRpdG9yTW9kZWwsIElUZXh0TW9kZWxTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vZWRpdG9yL2NvbW1vbi9zZXJ2aWNlcy9yZXNvbHZlclNlcnZpY2UuanMnO1xuaW1wb3J0IHsgSUNvbmZpZ3VyYXRpb25TZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vcGxhdGZvcm0vY29uZmlndXJhdGlvbi9jb21tb24vY29uZmlndXJhdGlvbi5qcyc7XG5pbXBvcnQgeyBJVW5kb1JlZG9TZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vcGxhdGZvcm0vdW5kb1JlZG8vY29tbW9uL3VuZG9SZWRvLmpzJztcbmltcG9ydCB7IElXb3JkV3JhcFRyYW5zaWVudFN0YXRlLCByZWFkVHJhbnNpZW50U3RhdGUsIHdyaXRlVHJhbnNpZW50U3RhdGUgfSBmcm9tICcuLi8uLi8uLi9jb2RlRWRpdG9yL2Jyb3dzZXIvdG9nZ2xlV29yZFdyYXAuanMnO1xuaW1wb3J0IHsgQ2VsbEVkaXRTdGF0ZSwgQ2VsbEZvY3VzTW9kZSwgQ2VsbExheW91dENoYW5nZUV2ZW50LCBDdXJzb3JBdEJvdW5kYXJ5LCBDdXJzb3JBdExpbmVCb3VuZGFyeSwgSUVkaXRhYmxlQ2VsbFZpZXdNb2RlbCwgSU5vdGVib29rQ2VsbERlY29yYXRpb25PcHRpb25zIH0gZnJvbSAnLi4vbm90ZWJvb2tCcm93c2VyLmpzJztcbmltcG9ydCB7IE5vdGVib29rT3B0aW9uc0NoYW5nZUV2ZW50IH0gZnJvbSAnLi4vbm90ZWJvb2tPcHRpb25zLmpzJztcbmltcG9ydCB7IENlbGxWaWV3TW9kZWxTdGF0ZUNoYW5nZUV2ZW50IH0gZnJvbSAnLi4vbm90ZWJvb2tWaWV3RXZlbnRzLmpzJztcbmltcG9ydCB7IFZpZXdDb250ZXh0IH0gZnJvbSAnLi92aWV3Q29udGV4dC5qcyc7XG5pbXBvcnQgeyBOb3RlYm9va0NlbGxUZXh0TW9kZWwgfSBmcm9tICcuLi8uLi9jb21tb24vbW9kZWwvbm90ZWJvb2tDZWxsVGV4dE1vZGVsLmpzJztcbmltcG9ydCB7IENlbGxLaW5kLCBJTm90ZWJvb2tDZWxsU3RhdHVzQmFySXRlbSwgSU5vdGVib29rRmluZE9wdGlvbnMgfSBmcm9tICcuLi8uLi9jb21tb24vbm90ZWJvb2tDb21tb24uanMnO1xuaW1wb3J0IHsgSUlubGluZUNoYXRTZXNzaW9uU2VydmljZSB9IGZyb20gJy4uLy4uLy4uL2lubGluZUNoYXQvYnJvd3Nlci9pbmxpbmVDaGF0U2Vzc2lvblNlcnZpY2UuanMnO1xuXG5leHBvcnQgYWJzdHJhY3QgY2xhc3MgQmFzZUNlbGxWaWV3TW9kZWwgZXh0ZW5kcyBEaXNwb3NhYmxlIHtcblxuXHRwcm90ZWN0ZWQgcmVhZG9ubHkgX29uRGlkQ2hhbmdlRWRpdG9yQXR0YWNoU3RhdGUgPSB0aGlzLl9yZWdpc3RlcihuZXcgRW1pdHRlcjx2b2lkPigpKTtcblx0Ly8gRG8gbm90IG1lcmdlIHRoaXMgZXZlbnQgd2l0aCBgb25EaWRDaGFuZ2VTdGF0ZWAgYXMgd2UgYXJlIHVzaW5nIGBFdmVudC5vbmNlKG9uRGlkQ2hhbmdlRWRpdG9yQXR0YWNoU3RhdGUpYCBlbHNld2hlcmUuXG5cdHJlYWRvbmx5IG9uRGlkQ2hhbmdlRWRpdG9yQXR0YWNoU3RhdGUgPSB0aGlzLl9vbkRpZENoYW5nZUVkaXRvckF0dGFjaFN0YXRlLmV2ZW50O1xuXHRwcm90ZWN0ZWQgcmVhZG9ubHkgX29uRGlkQ2hhbmdlU3RhdGUgPSB0aGlzLl9yZWdpc3RlcihuZXcgRW1pdHRlcjxDZWxsVmlld01vZGVsU3RhdGVDaGFuZ2VFdmVudD4oKSk7XG5cdHB1YmxpYyByZWFkb25seSBvbkRpZENoYW5nZVN0YXRlOiBFdmVudDxDZWxsVmlld01vZGVsU3RhdGVDaGFuZ2VFdmVudD4gPSB0aGlzLl9vbkRpZENoYW5nZVN0YXRlLmV2ZW50O1xuXG5cdGdldCBoYW5kbGUoKSB7XG5cdFx0cmV0dXJuIHRoaXMubW9kZWwuaGFuZGxlO1xuXHR9XG5cdGdldCB1cmkoKSB7XG5cdFx0cmV0dXJuIHRoaXMubW9kZWwudXJpO1xuXHR9XG5cdGdldCBsaW5lQ291bnQoKSB7XG5cdFx0cmV0dXJuIHRoaXMubW9kZWwudGV4dEJ1ZmZlci5nZXRMaW5lQ291bnQoKTtcblx0fVxuXHRnZXQgbWV0YWRhdGEoKSB7XG5cdFx0cmV0dXJuIHRoaXMubW9kZWwubWV0YWRhdGE7XG5cdH1cblx0Z2V0IGludGVybmFsTWV0YWRhdGEoKSB7XG5cdFx0cmV0dXJuIHRoaXMubW9kZWwuaW50ZXJuYWxNZXRhZGF0YTtcblx0fVxuXHRnZXQgbGFuZ3VhZ2UoKSB7XG5cdFx0cmV0dXJuIHRoaXMubW9kZWwubGFuZ3VhZ2U7XG5cdH1cblxuXHRnZXQgbWltZSgpOiBzdHJpbmcge1xuXHRcdGlmICh0eXBlb2YgdGhpcy5tb2RlbC5taW1lID09PSAnc3RyaW5nJykge1xuXHRcdFx0cmV0dXJuIHRoaXMubW9kZWwubWltZTtcblx0XHR9XG5cblx0XHRzd2l0Y2ggKHRoaXMubGFuZ3VhZ2UpIHtcblx0XHRcdGNhc2UgJ21hcmtkb3duJzpcblx0XHRcdFx0cmV0dXJuIE1pbWVzLm1hcmtkb3duO1xuXG5cdFx0XHRkZWZhdWx0OlxuXHRcdFx0XHRyZXR1cm4gTWltZXMudGV4dDtcblx0XHR9XG5cdH1cblxuXHRhYnN0cmFjdCBjZWxsS2luZDogQ2VsbEtpbmQ7XG5cblx0cHJpdmF0ZSBfZWRpdFN0YXRlOiBDZWxsRWRpdFN0YXRlID0gQ2VsbEVkaXRTdGF0ZS5QcmV2aWV3O1xuXG5cdHByaXZhdGUgX2xpbmVOdW1iZXJzOiAnb24nIHwgJ29mZicgfCAnaW5oZXJpdCcgPSAnaW5oZXJpdCc7XG5cdGdldCBsaW5lTnVtYmVycygpOiAnb24nIHwgJ29mZicgfCAnaW5oZXJpdCcge1xuXHRcdHJldHVybiB0aGlzLl9saW5lTnVtYmVycztcblx0fVxuXG5cdHNldCBsaW5lTnVtYmVycyhsaW5lTnVtYmVyczogJ29uJyB8ICdvZmYnIHwgJ2luaGVyaXQnKSB7XG5cdFx0aWYgKGxpbmVOdW1iZXJzID09PSB0aGlzLl9saW5lTnVtYmVycykge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblxuXHRcdHRoaXMuX2xpbmVOdW1iZXJzID0gbGluZU51bWJlcnM7XG5cdFx0dGhpcy5fb25EaWRDaGFuZ2VTdGF0ZS5maXJlKHsgY2VsbExpbmVOdW1iZXJDaGFuZ2VkOiB0cnVlIH0pO1xuXHR9XG5cblx0cHJpdmF0ZSBfY29tbWVudE9wdGlvbnM6IElFZGl0b3JDb21tZW50c09wdGlvbnM7XG5cdHB1YmxpYyBnZXQgY29tbWVudE9wdGlvbnMoKTogSUVkaXRvckNvbW1lbnRzT3B0aW9ucyB7XG5cdFx0cmV0dXJuIHRoaXMuX2NvbW1lbnRPcHRpb25zO1xuXHR9XG5cblx0cHVibGljIHNldCBjb21tZW50T3B0aW9ucyhuZXdPcHRpb25zOiBJRWRpdG9yQ29tbWVudHNPcHRpb25zKSB7XG5cdFx0dGhpcy5fY29tbWVudE9wdGlvbnMgPSBuZXdPcHRpb25zO1xuXHR9XG5cblx0cHJpdmF0ZSBfZm9jdXNNb2RlOiBDZWxsRm9jdXNNb2RlID0gQ2VsbEZvY3VzTW9kZS5Db250YWluZXI7XG5cdGdldCBmb2N1c01vZGUoKSB7XG5cdFx0cmV0dXJuIHRoaXMuX2ZvY3VzTW9kZTtcblx0fVxuXHRzZXQgZm9jdXNNb2RlKG5ld01vZGU6IENlbGxGb2N1c01vZGUpIHtcblx0XHRpZiAodGhpcy5fZm9jdXNNb2RlICE9PSBuZXdNb2RlKSB7XG5cdFx0XHR0aGlzLl9mb2N1c01vZGUgPSBuZXdNb2RlO1xuXHRcdFx0dGhpcy5fb25EaWRDaGFuZ2VTdGF0ZS5maXJlKHsgZm9jdXNNb2RlQ2hhbmdlZDogdHJ1ZSB9KTtcblx0XHR9XG5cdH1cblxuXHRwcm90ZWN0ZWQgX3RleHRFZGl0b3I/OiBJQ29kZUVkaXRvcjtcblx0Z2V0IGVkaXRvckF0dGFjaGVkKCk6IGJvb2xlYW4ge1xuXHRcdHJldHVybiAhIXRoaXMuX3RleHRFZGl0b3I7XG5cdH1cblx0cHJpdmF0ZSBfZWRpdG9yTGlzdGVuZXJzOiBJRGlzcG9zYWJsZVtdID0gW107XG5cdHByaXZhdGUgX2VkaXRvclZpZXdTdGF0ZXM6IGVkaXRvckNvbW1vbi5JQ29kZUVkaXRvclZpZXdTdGF0ZSB8IG51bGwgPSBudWxsO1xuXHRwcml2YXRlIF9lZGl0b3JUcmFuc2llbnRTdGF0ZTogSVdvcmRXcmFwVHJhbnNpZW50U3RhdGUgfCBudWxsID0gbnVsbDtcblx0cHJpdmF0ZSBfcmVzb2x2ZWRDZWxsRGVjb3JhdGlvbnMgPSBuZXcgTWFwPHN0cmluZywgSU5vdGVib29rQ2VsbERlY29yYXRpb25PcHRpb25zPigpO1xuXHRwcml2YXRlIHJlYWRvbmx5IF90ZXh0TW9kZWxSZWZDaGFuZ2VEaXNwb3NhYmxlID0gdGhpcy5fcmVnaXN0ZXIobmV3IE11dGFibGVEaXNwb3NhYmxlKCkpO1xuXG5cdHByaXZhdGUgcmVhZG9ubHkgX2NlbGxEZWNvcmF0aW9uc0NoYW5nZWQgPSB0aGlzLl9yZWdpc3RlcihuZXcgRW1pdHRlcjx7IGFkZGVkOiBJTm90ZWJvb2tDZWxsRGVjb3JhdGlvbk9wdGlvbnNbXTsgcmVtb3ZlZDogSU5vdGVib29rQ2VsbERlY29yYXRpb25PcHRpb25zW10gfT4oKSk7XG5cdG9uQ2VsbERlY29yYXRpb25zQ2hhbmdlZDogRXZlbnQ8eyBhZGRlZDogSU5vdGVib29rQ2VsbERlY29yYXRpb25PcHRpb25zW107IHJlbW92ZWQ6IElOb3RlYm9va0NlbGxEZWNvcmF0aW9uT3B0aW9uc1tdIH0+ID0gdGhpcy5fY2VsbERlY29yYXRpb25zQ2hhbmdlZC5ldmVudDtcblxuXHRwcml2YXRlIF9yZXNvbHZlZERlY29yYXRpb25zID0gbmV3IE1hcDxzdHJpbmcsIHtcblx0XHRpZD86IHN0cmluZztcblx0XHRvcHRpb25zOiBtb2RlbC5JTW9kZWxEZWx0YURlY29yYXRpb247XG5cdH0+KCk7XG5cdHByaXZhdGUgX2xhc3REZWNvcmF0aW9uSWQ6IG51bWJlciA9IDA7XG5cblx0cHJpdmF0ZSBfY2VsbFN0YXR1c0Jhckl0ZW1zID0gbmV3IE1hcDxzdHJpbmcsIElOb3RlYm9va0NlbGxTdGF0dXNCYXJJdGVtPigpO1xuXHRwcml2YXRlIHJlYWRvbmx5IF9vbkRpZENoYW5nZUNlbGxTdGF0dXNCYXJJdGVtcyA9IHRoaXMuX3JlZ2lzdGVyKG5ldyBFbWl0dGVyPHZvaWQ+KCkpO1xuXHRyZWFkb25seSBvbkRpZENoYW5nZUNlbGxTdGF0dXNCYXJJdGVtczogRXZlbnQ8dm9pZD4gPSB0aGlzLl9vbkRpZENoYW5nZUNlbGxTdGF0dXNCYXJJdGVtcy5ldmVudDtcblx0cHJpdmF0ZSBfbGFzdFN0YXR1c0JhcklkOiBudW1iZXIgPSAwO1xuXG5cdGdldCB0ZXh0TW9kZWwoKTogbW9kZWwuSVRleHRNb2RlbCB8IHVuZGVmaW5lZCB7XG5cdFx0cmV0dXJuIHRoaXMubW9kZWwudGV4dE1vZGVsO1xuXHR9XG5cblx0aGFzTW9kZWwoKTogdGhpcyBpcyBJRWRpdGFibGVDZWxsVmlld01vZGVsIHtcblx0XHRyZXR1cm4gISF0aGlzLnRleHRNb2RlbDtcblx0fVxuXG5cdHByaXZhdGUgX2RyYWdnaW5nOiBib29sZWFuID0gZmFsc2U7XG5cdGdldCBkcmFnZ2luZygpOiBib29sZWFuIHtcblx0XHRyZXR1cm4gdGhpcy5fZHJhZ2dpbmc7XG5cdH1cblxuXHRzZXQgZHJhZ2dpbmcodjogYm9vbGVhbikge1xuXHRcdHRoaXMuX2RyYWdnaW5nID0gdjtcblx0XHR0aGlzLl9vbkRpZENoYW5nZVN0YXRlLmZpcmUoeyBkcmFnU3RhdGVDaGFuZ2VkOiB0cnVlIH0pO1xuXHR9XG5cblx0cHJvdGVjdGVkIF90ZXh0TW9kZWxSZWY6IElSZWZlcmVuY2U8SVJlc29sdmVkVGV4dEVkaXRvck1vZGVsPiB8IHVuZGVmaW5lZDtcblxuXHRwcml2YXRlIF9pbnB1dENvbGxhcHNlZDogYm9vbGVhbiA9IGZhbHNlO1xuXHRnZXQgaXNJbnB1dENvbGxhcHNlZCgpOiBib29sZWFuIHtcblx0XHRyZXR1cm4gdGhpcy5faW5wdXRDb2xsYXBzZWQ7XG5cdH1cblx0c2V0IGlzSW5wdXRDb2xsYXBzZWQodjogYm9vbGVhbikge1xuXHRcdHRoaXMuX2lucHV0Q29sbGFwc2VkID0gdjtcblx0XHR0aGlzLl9vbkRpZENoYW5nZVN0YXRlLmZpcmUoeyBpbnB1dENvbGxhcHNlZENoYW5nZWQ6IHRydWUgfSk7XG5cdH1cblxuXHRwcml2YXRlIF9vdXRwdXRDb2xsYXBzZWQ6IGJvb2xlYW4gPSBmYWxzZTtcblx0Z2V0IGlzT3V0cHV0Q29sbGFwc2VkKCk6IGJvb2xlYW4ge1xuXHRcdHJldHVybiB0aGlzLl9vdXRwdXRDb2xsYXBzZWQ7XG5cdH1cblx0c2V0IGlzT3V0cHV0Q29sbGFwc2VkKHY6IGJvb2xlYW4pIHtcblx0XHR0aGlzLl9vdXRwdXRDb2xsYXBzZWQgPSB2O1xuXHRcdHRoaXMuX29uRGlkQ2hhbmdlU3RhdGUuZmlyZSh7IG91dHB1dENvbGxhcHNlZENoYW5nZWQ6IHRydWUgfSk7XG5cdH1cblxuXHRwcm90ZWN0ZWQgX2NvbW1lbnRIZWlnaHQgPSAwO1xuXG5cdHNldCBjb21tZW50SGVpZ2h0KGhlaWdodDogbnVtYmVyKSB7XG5cdFx0aWYgKHRoaXMuX2NvbW1lbnRIZWlnaHQgPT09IGhlaWdodCkge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblx0XHR0aGlzLl9jb21tZW50SGVpZ2h0ID0gaGVpZ2h0O1xuXHRcdHRoaXMubGF5b3V0Q2hhbmdlKHsgY29tbWVudEhlaWdodDogdHJ1ZSB9LCAnQmFzZUNlbGxWaWV3TW9kZWwjY29tbWVudEhlaWdodCcpO1xuXHR9XG5cblx0cHJpdmF0ZSBfaXNEaXNwb3NlZCA9IGZhbHNlO1xuXHRwcml2YXRlIF9pc1JlYWRvbmx5ID0gZmFsc2U7XG5cblx0Y29uc3RydWN0b3IoXG5cdFx0cmVhZG9ubHkgdmlld1R5cGU6IHN0cmluZyxcblx0XHRyZWFkb25seSBtb2RlbDogTm90ZWJvb2tDZWxsVGV4dE1vZGVsLFxuXHRcdHB1YmxpYyBpZDogc3RyaW5nLFxuXHRcdHByaXZhdGUgcmVhZG9ubHkgX3ZpZXdDb250ZXh0OiBWaWV3Q29udGV4dCxcblx0XHRwcml2YXRlIHJlYWRvbmx5IF9jb25maWd1cmF0aW9uU2VydmljZTogSUNvbmZpZ3VyYXRpb25TZXJ2aWNlLFxuXHRcdHByaXZhdGUgcmVhZG9ubHkgX21vZGVsU2VydmljZTogSVRleHRNb2RlbFNlcnZpY2UsXG5cdFx0cHJpdmF0ZSByZWFkb25seSBfdW5kb1JlZG9TZXJ2aWNlOiBJVW5kb1JlZG9TZXJ2aWNlLFxuXHRcdHByaXZhdGUgcmVhZG9ubHkgX2NvZGVFZGl0b3JTZXJ2aWNlOiBJQ29kZUVkaXRvclNlcnZpY2UsXG5cdFx0cHJpdmF0ZSByZWFkb25seSBfaW5saW5lQ2hhdFNlc3Npb25TZXJ2aWNlOiBJSW5saW5lQ2hhdFNlc3Npb25TZXJ2aWNlXG5cdFx0Ly8gcHJpdmF0ZSByZWFkb25seSBfa2V5bWFwU2VydmljZTogSU5vdGVib29rS2V5bWFwU2VydmljZVxuXHQpIHtcblx0XHRzdXBlcigpO1xuXG5cdFx0dGhpcy5fcmVnaXN0ZXIobW9kZWwub25EaWRDaGFuZ2VNZXRhZGF0YSgoKSA9PiB7XG5cdFx0XHR0aGlzLl9vbkRpZENoYW5nZVN0YXRlLmZpcmUoeyBtZXRhZGF0YUNoYW5nZWQ6IHRydWUgfSk7XG5cdFx0fSkpO1xuXG5cdFx0dGhpcy5fcmVnaXN0ZXIobW9kZWwub25EaWRDaGFuZ2VJbnRlcm5hbE1ldGFkYXRhKGUgPT4ge1xuXHRcdFx0dGhpcy5fb25EaWRDaGFuZ2VTdGF0ZS5maXJlKHsgaW50ZXJuYWxNZXRhZGF0YUNoYW5nZWQ6IHRydWUgfSk7XG5cdFx0XHRpZiAoZS5sYXN0UnVuU3VjY2Vzc0NoYW5nZWQpIHtcblx0XHRcdFx0Ly8gU3RhdHVzYmFyIHZpc2liaWxpdHkgbWF5IGNoYW5nZVxuXHRcdFx0XHR0aGlzLmxheW91dENoYW5nZSh7fSk7XG5cdFx0XHR9XG5cdFx0fSkpO1xuXG5cdFx0dGhpcy5fcmVnaXN0ZXIodGhpcy5fY29uZmlndXJhdGlvblNlcnZpY2Uub25EaWRDaGFuZ2VDb25maWd1cmF0aW9uKGUgPT4ge1xuXHRcdFx0aWYgKGUuYWZmZWN0c0NvbmZpZ3VyYXRpb24oJ25vdGVib29rLmxpbmVOdW1iZXJzJykpIHtcblx0XHRcdFx0dGhpcy5saW5lTnVtYmVycyA9ICdpbmhlcml0Jztcblx0XHRcdH1cblx0XHR9KSk7XG5cblx0XHRpZiAodGhpcy5tb2RlbC5jb2xsYXBzZVN0YXRlPy5pbnB1dENvbGxhcHNlZCkge1xuXHRcdFx0dGhpcy5faW5wdXRDb2xsYXBzZWQgPSB0cnVlO1xuXHRcdH1cblxuXHRcdGlmICh0aGlzLm1vZGVsLmNvbGxhcHNlU3RhdGU/Lm91dHB1dENvbGxhcHNlZCkge1xuXHRcdFx0dGhpcy5fb3V0cHV0Q29sbGFwc2VkID0gdHJ1ZTtcblx0XHR9XG5cblx0XHR0aGlzLl9jb21tZW50T3B0aW9ucyA9IHRoaXMuX2NvbmZpZ3VyYXRpb25TZXJ2aWNlLmdldFZhbHVlPElFZGl0b3JDb21tZW50c09wdGlvbnM+KCdlZGl0b3IuY29tbWVudHMnLCB7IG92ZXJyaWRlSWRlbnRpZmllcjogdGhpcy5sYW5ndWFnZSB9KTtcblx0XHR0aGlzLl9yZWdpc3Rlcih0aGlzLl9jb25maWd1cmF0aW9uU2VydmljZS5vbkRpZENoYW5nZUNvbmZpZ3VyYXRpb24oZSA9PiB7XG5cdFx0XHRpZiAoZS5hZmZlY3RzQ29uZmlndXJhdGlvbignZWRpdG9yLmNvbW1lbnRzJykpIHtcblx0XHRcdFx0dGhpcy5fY29tbWVudE9wdGlvbnMgPSB0aGlzLl9jb25maWd1cmF0aW9uU2VydmljZS5nZXRWYWx1ZTxJRWRpdG9yQ29tbWVudHNPcHRpb25zPignZWRpdG9yLmNvbW1lbnRzJywgeyBvdmVycmlkZUlkZW50aWZpZXI6IHRoaXMubGFuZ3VhZ2UgfSk7XG5cdFx0XHR9XG5cdFx0fSkpO1xuXHR9XG5cblxuXHR1cGRhdGVPcHRpb25zKGU6IE5vdGVib29rT3B0aW9uc0NoYW5nZUV2ZW50KTogdm9pZCB7XG5cdFx0aWYgKHRoaXMuX3RleHRFZGl0b3IgJiYgdHlwZW9mIGUucmVhZG9ubHkgPT09ICdib29sZWFuJykge1xuXHRcdFx0dGhpcy5fdGV4dEVkaXRvci51cGRhdGVPcHRpb25zKHsgcmVhZE9ubHk6IGUucmVhZG9ubHkgfSk7XG5cdFx0fVxuXHRcdGlmICh0eXBlb2YgZS5yZWFkb25seSA9PT0gJ2Jvb2xlYW4nKSB7XG5cdFx0XHR0aGlzLl9pc1JlYWRvbmx5ID0gZS5yZWFkb25seTtcblx0XHR9XG5cdH1cblx0YWJzdHJhY3QgZ2V0SGVpZ2h0KGxpbmVIZWlnaHQ6IG51bWJlcik6IG51bWJlcjtcblx0YWJzdHJhY3Qgb25EZXNlbGVjdCgpOiB2b2lkO1xuXHRhYnN0cmFjdCBsYXlvdXRDaGFuZ2UoY2hhbmdlOiBDZWxsTGF5b3V0Q2hhbmdlRXZlbnQsIHNvdXJjZT86IHN0cmluZyk6IHZvaWQ7XG5cblx0YXNzZXJ0VGV4dE1vZGVsQXR0YWNoZWQoKTogYm9vbGVhbiB7XG5cdFx0aWYgKHRoaXMudGV4dE1vZGVsICYmIHRoaXMuX3RleHRFZGl0b3IgJiYgdGhpcy5fdGV4dEVkaXRvci5nZXRNb2RlbCgpID09PSB0aGlzLnRleHRNb2RlbCkge1xuXHRcdFx0cmV0dXJuIHRydWU7XG5cdFx0fVxuXG5cdFx0cmV0dXJuIGZhbHNlO1xuXHR9XG5cblx0Ly8gcHJpdmF0ZSBoYW5kbGVLZXlEb3duKGU6IElLZXlib2FyZEV2ZW50KSB7XG5cdC8vIFx0aWYgKHRoaXMudmlld1R5cGUgPT09IElQWU5CX1ZJRVdfVFlQRSAmJiBpc1dpbmRvd3MgJiYgZS5jdHJsS2V5ICYmIGUua2V5Q29kZSA9PT0gS2V5Q29kZS5FbnRlcikge1xuXHQvLyBcdFx0dGhpcy5fa2V5bWFwU2VydmljZS5wcm9tcHRLZXltYXBSZWNvbW1lbmRhdGlvbigpO1xuXHQvLyBcdH1cblx0Ly8gfVxuXG5cdGF0dGFjaFRleHRFZGl0b3IoZWRpdG9yOiBJQ29kZUVkaXRvciwgZXN0aW1hdGVkSGFzSG9yaXpvbnRhbFNjcm9sbGluZz86IGJvb2xlYW4pIHtcblx0XHRpZiAoIWVkaXRvci5oYXNNb2RlbCgpKSB7XG5cdFx0XHR0aHJvdyBuZXcgRXJyb3IoJ0ludmFsaWQgZWRpdG9yOiBtb2RlbCBpcyBtaXNzaW5nJyk7XG5cdFx0fVxuXG5cdFx0aWYgKHRoaXMuX3RleHRFZGl0b3IgPT09IGVkaXRvcikge1xuXHRcdFx0aWYgKHRoaXMuX2VkaXRvckxpc3RlbmVycy5sZW5ndGggPT09IDApIHtcblx0XHRcdFx0dGhpcy5fZWRpdG9yTGlzdGVuZXJzLnB1c2godGhpcy5fdGV4dEVkaXRvci5vbkRpZENoYW5nZUN1cnNvclNlbGVjdGlvbigoKSA9PiB7IHRoaXMuX29uRGlkQ2hhbmdlU3RhdGUuZmlyZSh7IHNlbGVjdGlvbkNoYW5nZWQ6IHRydWUgfSk7IH0pKTtcblx0XHRcdFx0Ly8gdGhpcy5fZWRpdG9yTGlzdGVuZXJzLnB1c2godGhpcy5fdGV4dEVkaXRvci5vbktleURvd24oZSA9PiB0aGlzLmhhbmRsZUtleURvd24oZSkpKTtcblx0XHRcdFx0dGhpcy5fb25EaWRDaGFuZ2VTdGF0ZS5maXJlKHsgc2VsZWN0aW9uQ2hhbmdlZDogdHJ1ZSB9KTtcblx0XHRcdH1cblx0XHRcdHJldHVybjtcblx0XHR9XG5cblx0XHR0aGlzLl90ZXh0RWRpdG9yID0gZWRpdG9yO1xuXHRcdGlmICh0aGlzLl9pc1JlYWRvbmx5KSB7XG5cdFx0XHRlZGl0b3IudXBkYXRlT3B0aW9ucyh7IHJlYWRPbmx5OiB0aGlzLl9pc1JlYWRvbmx5IH0pO1xuXHRcdH1cblx0XHRpZiAodGhpcy5fZWRpdG9yVmlld1N0YXRlcykge1xuXHRcdFx0dGhpcy5fcmVzdG9yZVZpZXdTdGF0ZSh0aGlzLl9lZGl0b3JWaWV3U3RhdGVzKTtcblx0XHR9IGVsc2Uge1xuXHRcdFx0Ly8gSWYgbm8gcmVhbCBlZGl0b3IgdmlldyBzdGF0ZSB3YXMgcGVyc2lzdGVkLCByZXN0b3JlIGEgZGVmYXVsdCBzdGF0ZS5cblx0XHRcdC8vIFRoaXMgZm9yY2VzIHRoZSBlZGl0b3IgdG8gbWVhc3VyZSBpdHMgY29udGVudCB3aWR0aCBpbW1lZGlhdGVseS5cblx0XHRcdGlmIChlc3RpbWF0ZWRIYXNIb3Jpem9udGFsU2Nyb2xsaW5nKSB7XG5cdFx0XHRcdHRoaXMuX3Jlc3RvcmVWaWV3U3RhdGUoe1xuXHRcdFx0XHRcdGNvbnRyaWJ1dGlvbnNTdGF0ZToge30sXG5cdFx0XHRcdFx0Y3Vyc29yU3RhdGU6IFtdLFxuXHRcdFx0XHRcdHZpZXdTdGF0ZToge1xuXHRcdFx0XHRcdFx0c2Nyb2xsTGVmdDogMCxcblx0XHRcdFx0XHRcdGZpcnN0UG9zaXRpb246IHsgbGluZU51bWJlcjogMSwgY29sdW1uOiAxIH0sXG5cdFx0XHRcdFx0XHRmaXJzdFBvc2l0aW9uRGVsdGFUb3A6IHRoaXMuX3ZpZXdDb250ZXh0Lm5vdGVib29rT3B0aW9ucy5nZXRMYXlvdXRDb25maWd1cmF0aW9uKCkuZWRpdG9yVG9wUGFkZGluZ1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0fSk7XG5cdFx0XHR9XG5cdFx0fVxuXG5cdFx0aWYgKHRoaXMuX2VkaXRvclRyYW5zaWVudFN0YXRlKSB7XG5cdFx0XHR3cml0ZVRyYW5zaWVudFN0YXRlKGVkaXRvci5nZXRNb2RlbCgpLCB0aGlzLl9lZGl0b3JUcmFuc2llbnRTdGF0ZSwgdGhpcy5fY29kZUVkaXRvclNlcnZpY2UpO1xuXHRcdH1cblxuXHRcdGlmICh0aGlzLl9pc0Rpc3Bvc2VkKSB7XG5cdFx0XHQvLyBSZXN0b3JlIFZpZXcgU3RhdGUgY291bGQgYWRqdXN0IHRoZSBlZGl0b3IgbGF5b3V0IGFuZCB0cmlnZ2VyIGEgbGlzdCB2aWV3IHVwZGF0ZS4gVGhlIGxpc3QgdmlldyB1cGRhdGUgbWlnaHQgdGhlbiBkaXNwb3NlIHRoaXMgdmlldyBtb2RlbC5cblx0XHRcdHJldHVybjtcblx0XHR9XG5cblx0XHRlZGl0b3IuY2hhbmdlRGVjb3JhdGlvbnMoKGFjY2Vzc29yKSA9PiB7XG5cdFx0XHR0aGlzLl9yZXNvbHZlZERlY29yYXRpb25zLmZvckVhY2goKHZhbHVlLCBrZXkpID0+IHtcblx0XHRcdFx0aWYgKGtleS5zdGFydHNXaXRoKCdfbGF6eV8nKSkge1xuXHRcdFx0XHRcdC8vIGxhenkgb25lc1xuXHRcdFx0XHRcdGNvbnN0IHJldCA9IGFjY2Vzc29yLmFkZERlY29yYXRpb24odmFsdWUub3B0aW9ucy5yYW5nZSwgdmFsdWUub3B0aW9ucy5vcHRpb25zKTtcblx0XHRcdFx0XHR0aGlzLl9yZXNvbHZlZERlY29yYXRpb25zLmdldChrZXkpIS5pZCA9IHJldDtcblx0XHRcdFx0fVxuXHRcdFx0XHRlbHNlIHtcblx0XHRcdFx0XHRjb25zdCByZXQgPSBhY2Nlc3Nvci5hZGREZWNvcmF0aW9uKHZhbHVlLm9wdGlvbnMucmFuZ2UsIHZhbHVlLm9wdGlvbnMub3B0aW9ucyk7XG5cdFx0XHRcdFx0dGhpcy5fcmVzb2x2ZWREZWNvcmF0aW9ucy5nZXQoa2V5KSEuaWQgPSByZXQ7XG5cdFx0XHRcdH1cblx0XHRcdH0pO1xuXHRcdH0pO1xuXG5cdFx0dGhpcy5fZWRpdG9yTGlzdGVuZXJzLnB1c2goZWRpdG9yLm9uRGlkQ2hhbmdlQ3Vyc29yU2VsZWN0aW9uKCgpID0+IHsgdGhpcy5fb25EaWRDaGFuZ2VTdGF0ZS5maXJlKHsgc2VsZWN0aW9uQ2hhbmdlZDogdHJ1ZSB9KTsgfSkpO1xuXHRcdHRoaXMuX2VkaXRvckxpc3RlbmVycy5wdXNoKHRoaXMuX2lubGluZUNoYXRTZXNzaW9uU2VydmljZS5vbldpbGxTdGFydFNlc3Npb24oKGUpID0+IHtcblx0XHRcdGlmIChlID09PSB0aGlzLl90ZXh0RWRpdG9yICYmIHRoaXMudGV4dEJ1ZmZlci5nZXRMZW5ndGgoKSA9PT0gMCkge1xuXHRcdFx0XHR0aGlzLmVuYWJsZUF1dG9MYW5ndWFnZURldGVjdGlvbigpO1xuXHRcdFx0fVxuXHRcdH0pKTtcblxuXHRcdHRoaXMuX29uRGlkQ2hhbmdlU3RhdGUuZmlyZSh7IHNlbGVjdGlvbkNoYW5nZWQ6IHRydWUgfSk7XG5cdFx0dGhpcy5fb25EaWRDaGFuZ2VFZGl0b3JBdHRhY2hTdGF0ZS5maXJlKCk7XG5cdH1cblxuXHRkZXRhY2hUZXh0RWRpdG9yKCkge1xuXHRcdHRoaXMuc2F2ZVZpZXdTdGF0ZSgpO1xuXHRcdHRoaXMuc2F2ZVRyYW5zaWVudFN0YXRlKCk7XG5cdFx0Ly8gZGVjb3JhdGlvbnMgbmVlZCB0byBiZSBjbGVhcmVkIGZpcnN0IGFzIGVkaXRvcnMgY2FuIGJlIHJlc3VlZC5cblx0XHR0aGlzLl90ZXh0RWRpdG9yPy5jaGFuZ2VEZWNvcmF0aW9ucygoYWNjZXNzb3IpID0+IHtcblx0XHRcdHRoaXMuX3Jlc29sdmVkRGVjb3JhdGlvbnMuZm9yRWFjaCh2YWx1ZSA9PiB7XG5cdFx0XHRcdGNvbnN0IHJlc29sdmVkaWQgPSB2YWx1ZS5pZDtcblxuXHRcdFx0XHRpZiAocmVzb2x2ZWRpZCkge1xuXHRcdFx0XHRcdGFjY2Vzc29yLnJlbW92ZURlY29yYXRpb24ocmVzb2x2ZWRpZCk7XG5cdFx0XHRcdH1cblx0XHRcdH0pO1xuXHRcdH0pO1xuXG5cdFx0dGhpcy5fdGV4dEVkaXRvciA9IHVuZGVmaW5lZDtcblx0XHRkaXNwb3NlKHRoaXMuX2VkaXRvckxpc3RlbmVycyk7XG5cdFx0dGhpcy5fZWRpdG9yTGlzdGVuZXJzID0gW107XG5cdFx0dGhpcy5fb25EaWRDaGFuZ2VFZGl0b3JBdHRhY2hTdGF0ZS5maXJlKCk7XG5cblx0XHRpZiAodGhpcy5fdGV4dE1vZGVsUmVmKSB7XG5cdFx0XHR0aGlzLl90ZXh0TW9kZWxSZWYuZGlzcG9zZSgpO1xuXHRcdFx0dGhpcy5fdGV4dE1vZGVsUmVmID0gdW5kZWZpbmVkO1xuXHRcdH1cblx0XHR0aGlzLl90ZXh0TW9kZWxSZWZDaGFuZ2VEaXNwb3NhYmxlLmNsZWFyKCk7XG5cdH1cblxuXHRnZXRUZXh0KCk6IHN0cmluZyB7XG5cdFx0cmV0dXJuIHRoaXMubW9kZWwuZ2V0VmFsdWUoKTtcblx0fVxuXG5cdGdldEFsdGVybmF0aXZlSWQoKTogbnVtYmVyIHtcblx0XHRyZXR1cm4gdGhpcy5tb2RlbC5hbHRlcm5hdGl2ZUlkO1xuXHR9XG5cblx0Z2V0VGV4dExlbmd0aCgpOiBudW1iZXIge1xuXHRcdHJldHVybiB0aGlzLm1vZGVsLmdldFRleHRMZW5ndGgoKTtcblx0fVxuXG5cdGVuYWJsZUF1dG9MYW5ndWFnZURldGVjdGlvbigpIHtcblx0XHR0aGlzLm1vZGVsLmVuYWJsZUF1dG9MYW5ndWFnZURldGVjdGlvbigpO1xuXHR9XG5cblx0cHJpdmF0ZSBzYXZlVmlld1N0YXRlKCk6IHZvaWQge1xuXHRcdGlmICghdGhpcy5fdGV4dEVkaXRvcikge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblxuXHRcdHRoaXMuX2VkaXRvclZpZXdTdGF0ZXMgPSB0aGlzLl90ZXh0RWRpdG9yLnNhdmVWaWV3U3RhdGUoKTtcblx0fVxuXG5cdHByaXZhdGUgc2F2ZVRyYW5zaWVudFN0YXRlKCkge1xuXHRcdGlmICghdGhpcy5fdGV4dEVkaXRvciB8fCAhdGhpcy5fdGV4dEVkaXRvci5oYXNNb2RlbCgpKSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXG5cdFx0dGhpcy5fZWRpdG9yVHJhbnNpZW50U3RhdGUgPSByZWFkVHJhbnNpZW50U3RhdGUodGhpcy5fdGV4dEVkaXRvci5nZXRNb2RlbCgpLCB0aGlzLl9jb2RlRWRpdG9yU2VydmljZSk7XG5cdH1cblxuXHRzYXZlRWRpdG9yVmlld1N0YXRlKCkge1xuXHRcdGlmICh0aGlzLl90ZXh0RWRpdG9yKSB7XG5cdFx0XHR0aGlzLl9lZGl0b3JWaWV3U3RhdGVzID0gdGhpcy5fdGV4dEVkaXRvci5zYXZlVmlld1N0YXRlKCk7XG5cdFx0fVxuXG5cdFx0cmV0dXJuIHRoaXMuX2VkaXRvclZpZXdTdGF0ZXM7XG5cdH1cblxuXHRyZXN0b3JlRWRpdG9yVmlld1N0YXRlKGVkaXRvclZpZXdTdGF0ZXM6IGVkaXRvckNvbW1vbi5JQ29kZUVkaXRvclZpZXdTdGF0ZSB8IG51bGwsIHRvdGFsSGVpZ2h0PzogbnVtYmVyKSB7XG5cdFx0dGhpcy5fZWRpdG9yVmlld1N0YXRlcyA9IGVkaXRvclZpZXdTdGF0ZXM7XG5cdH1cblxuXHRwcml2YXRlIF9yZXN0b3JlVmlld1N0YXRlKHN0YXRlOiBlZGl0b3JDb21tb24uSUNvZGVFZGl0b3JWaWV3U3RhdGUgfCBudWxsKTogdm9pZCB7XG5cdFx0aWYgKHN0YXRlKSB7XG5cdFx0XHR0aGlzLl90ZXh0RWRpdG9yPy5yZXN0b3JlVmlld1N0YXRlKHN0YXRlKTtcblx0XHR9XG5cdH1cblxuXHRhZGRNb2RlbERlY29yYXRpb24oZGVjb3JhdGlvbjogbW9kZWwuSU1vZGVsRGVsdGFEZWNvcmF0aW9uKTogc3RyaW5nIHtcblx0XHRpZiAoIXRoaXMuX3RleHRFZGl0b3IpIHtcblx0XHRcdGNvbnN0IGlkID0gKyt0aGlzLl9sYXN0RGVjb3JhdGlvbklkO1xuXHRcdFx0Y29uc3QgZGVjb3JhdGlvbklkID0gYF9sYXp5XyR7dGhpcy5pZH07JHtpZH1gO1xuXHRcdFx0dGhpcy5fcmVzb2x2ZWREZWNvcmF0aW9ucy5zZXQoZGVjb3JhdGlvbklkLCB7IG9wdGlvbnM6IGRlY29yYXRpb24gfSk7XG5cdFx0XHRyZXR1cm4gZGVjb3JhdGlvbklkO1xuXHRcdH1cblxuXHRcdGxldCBpZDogc3RyaW5nO1xuXHRcdHRoaXMuX3RleHRFZGl0b3IuY2hhbmdlRGVjb3JhdGlvbnMoKGFjY2Vzc29yKSA9PiB7XG5cdFx0XHRpZCA9IGFjY2Vzc29yLmFkZERlY29yYXRpb24oZGVjb3JhdGlvbi5yYW5nZSwgZGVjb3JhdGlvbi5vcHRpb25zKTtcblx0XHRcdHRoaXMuX3Jlc29sdmVkRGVjb3JhdGlvbnMuc2V0KGlkLCB7IGlkLCBvcHRpb25zOiBkZWNvcmF0aW9uIH0pO1xuXHRcdH0pO1xuXHRcdHJldHVybiBpZCE7XG5cdH1cblxuXHRyZW1vdmVNb2RlbERlY29yYXRpb24oZGVjb3JhdGlvbklkOiBzdHJpbmcpIHtcblx0XHRjb25zdCByZWFsRGVjb3JhdGlvbklkID0gdGhpcy5fcmVzb2x2ZWREZWNvcmF0aW9ucy5nZXQoZGVjb3JhdGlvbklkKTtcblxuXHRcdGlmICh0aGlzLl90ZXh0RWRpdG9yICYmIHJlYWxEZWNvcmF0aW9uSWQgJiYgcmVhbERlY29yYXRpb25JZC5pZCAhPT0gdW5kZWZpbmVkKSB7XG5cdFx0XHR0aGlzLl90ZXh0RWRpdG9yLmNoYW5nZURlY29yYXRpb25zKChhY2Nlc3NvcikgPT4ge1xuXHRcdFx0XHRhY2Nlc3Nvci5yZW1vdmVEZWNvcmF0aW9uKHJlYWxEZWNvcmF0aW9uSWQuaWQhKTtcblx0XHRcdH0pO1xuXHRcdH1cblxuXHRcdC8vIGxhc3RseSwgcmVtb3ZlIGFsbCB0aGUgY2FjaGVcblx0XHR0aGlzLl9yZXNvbHZlZERlY29yYXRpb25zLmRlbGV0ZShkZWNvcmF0aW9uSWQpO1xuXHR9XG5cblx0ZGVsdGFNb2RlbERlY29yYXRpb25zKG9sZERlY29yYXRpb25zOiByZWFkb25seSBzdHJpbmdbXSwgbmV3RGVjb3JhdGlvbnM6IHJlYWRvbmx5IG1vZGVsLklNb2RlbERlbHRhRGVjb3JhdGlvbltdKTogc3RyaW5nW10ge1xuXHRcdG9sZERlY29yYXRpb25zLmZvckVhY2goaWQgPT4ge1xuXHRcdFx0dGhpcy5yZW1vdmVNb2RlbERlY29yYXRpb24oaWQpO1xuXHRcdH0pO1xuXG5cdFx0Y29uc3QgcmV0ID0gbmV3RGVjb3JhdGlvbnMubWFwKG9wdGlvbiA9PiB7XG5cdFx0XHRyZXR1cm4gdGhpcy5hZGRNb2RlbERlY29yYXRpb24ob3B0aW9uKTtcblx0XHR9KTtcblxuXHRcdHJldHVybiByZXQ7XG5cdH1cblxuXHRwcml2YXRlIF9yZW1vdmVDZWxsRGVjb3JhdGlvbihkZWNvcmF0aW9uSWQ6IHN0cmluZykge1xuXHRcdGNvbnN0IG9wdGlvbnMgPSB0aGlzLl9yZXNvbHZlZENlbGxEZWNvcmF0aW9ucy5nZXQoZGVjb3JhdGlvbklkKTtcblx0XHR0aGlzLl9yZXNvbHZlZENlbGxEZWNvcmF0aW9ucy5kZWxldGUoZGVjb3JhdGlvbklkKTtcblxuXHRcdGlmIChvcHRpb25zKSB7XG5cdFx0XHRmb3IgKGNvbnN0IGV4aXN0aW5nT3B0aW9ucyBvZiB0aGlzLl9yZXNvbHZlZENlbGxEZWNvcmF0aW9ucy52YWx1ZXMoKSkge1xuXHRcdFx0XHQvLyBkb24ndCByZW1vdmUgZGVjb3JhdGlvbnMgdGhhdCBhcmUgYXBwbGllZCBmcm9tIG90aGVyIGVudHJpZXNcblx0XHRcdFx0aWYgKG9wdGlvbnMuY2xhc3NOYW1lID09PSBleGlzdGluZ09wdGlvbnMuY2xhc3NOYW1lKSB7XG5cdFx0XHRcdFx0b3B0aW9ucy5jbGFzc05hbWUgPSB1bmRlZmluZWQ7XG5cdFx0XHRcdH1cblx0XHRcdFx0aWYgKG9wdGlvbnMub3V0cHV0Q2xhc3NOYW1lID09PSBleGlzdGluZ09wdGlvbnMub3V0cHV0Q2xhc3NOYW1lKSB7XG5cdFx0XHRcdFx0b3B0aW9ucy5vdXRwdXRDbGFzc05hbWUgPSB1bmRlZmluZWQ7XG5cdFx0XHRcdH1cblx0XHRcdFx0aWYgKG9wdGlvbnMuZ3V0dGVyQ2xhc3NOYW1lID09PSBleGlzdGluZ09wdGlvbnMuZ3V0dGVyQ2xhc3NOYW1lKSB7XG5cdFx0XHRcdFx0b3B0aW9ucy5ndXR0ZXJDbGFzc05hbWUgPSB1bmRlZmluZWQ7XG5cdFx0XHRcdH1cblx0XHRcdFx0aWYgKG9wdGlvbnMudG9wQ2xhc3NOYW1lID09PSBleGlzdGluZ09wdGlvbnMudG9wQ2xhc3NOYW1lKSB7XG5cdFx0XHRcdFx0b3B0aW9ucy50b3BDbGFzc05hbWUgPSB1bmRlZmluZWQ7XG5cdFx0XHRcdH1cblx0XHRcdH1cblxuXHRcdFx0dGhpcy5fY2VsbERlY29yYXRpb25zQ2hhbmdlZC5maXJlKHsgYWRkZWQ6IFtdLCByZW1vdmVkOiBbb3B0aW9uc10gfSk7XG5cdFx0fVxuXHR9XG5cblx0cHJpdmF0ZSBfYWRkQ2VsbERlY29yYXRpb24ob3B0aW9uczogSU5vdGVib29rQ2VsbERlY29yYXRpb25PcHRpb25zKTogc3RyaW5nIHtcblx0XHRjb25zdCBpZCA9ICsrdGhpcy5fbGFzdERlY29yYXRpb25JZDtcblx0XHRjb25zdCBkZWNvcmF0aW9uSWQgPSBgX2NlbGxfJHt0aGlzLmlkfTske2lkfWA7XG5cdFx0dGhpcy5fcmVzb2x2ZWRDZWxsRGVjb3JhdGlvbnMuc2V0KGRlY29yYXRpb25JZCwgb3B0aW9ucyk7XG5cdFx0dGhpcy5fY2VsbERlY29yYXRpb25zQ2hhbmdlZC5maXJlKHsgYWRkZWQ6IFtvcHRpb25zXSwgcmVtb3ZlZDogW10gfSk7XG5cdFx0cmV0dXJuIGRlY29yYXRpb25JZDtcblx0fVxuXG5cdGdldENlbGxEZWNvcmF0aW9ucygpIHtcblx0XHRyZXR1cm4gWy4uLnRoaXMuX3Jlc29sdmVkQ2VsbERlY29yYXRpb25zLnZhbHVlcygpXTtcblx0fVxuXG5cdGdldENlbGxEZWNvcmF0aW9uUmFuZ2UoZGVjb3JhdGlvbklkOiBzdHJpbmcpOiBSYW5nZSB8IG51bGwge1xuXHRcdGlmICh0aGlzLl90ZXh0RWRpdG9yKSB7XG5cdFx0XHQvLyAodGhpcy5fdGV4dEVkaXRvciBhcyBDb2RlRWRpdG9yV2lkZ2V0KS5kZWNvcmFcblx0XHRcdHJldHVybiB0aGlzLl90ZXh0RWRpdG9yLmdldE1vZGVsKCk/LmdldERlY29yYXRpb25SYW5nZShkZWNvcmF0aW9uSWQpID8/IG51bGw7XG5cdFx0fVxuXG5cdFx0cmV0dXJuIG51bGw7XG5cdH1cblxuXHRkZWx0YUNlbGxEZWNvcmF0aW9ucyhvbGREZWNvcmF0aW9uczogc3RyaW5nW10sIG5ld0RlY29yYXRpb25zOiBJTm90ZWJvb2tDZWxsRGVjb3JhdGlvbk9wdGlvbnNbXSk6IHN0cmluZ1tdIHtcblx0XHRvbGREZWNvcmF0aW9ucy5mb3JFYWNoKGlkID0+IHtcblx0XHRcdHRoaXMuX3JlbW92ZUNlbGxEZWNvcmF0aW9uKGlkKTtcblx0XHR9KTtcblxuXHRcdGNvbnN0IHJldCA9IG5ld0RlY29yYXRpb25zLm1hcChvcHRpb24gPT4ge1xuXHRcdFx0cmV0dXJuIHRoaXMuX2FkZENlbGxEZWNvcmF0aW9uKG9wdGlvbik7XG5cdFx0fSk7XG5cblx0XHRyZXR1cm4gcmV0O1xuXHR9XG5cblx0ZGVsdGFDZWxsU3RhdHVzQmFySXRlbXMob2xkSXRlbXM6IHJlYWRvbmx5IHN0cmluZ1tdLCBuZXdJdGVtczogcmVhZG9ubHkgSU5vdGVib29rQ2VsbFN0YXR1c0Jhckl0ZW1bXSk6IHN0cmluZ1tdIHtcblx0XHRvbGRJdGVtcy5mb3JFYWNoKGlkID0+IHtcblx0XHRcdGNvbnN0IGl0ZW0gPSB0aGlzLl9jZWxsU3RhdHVzQmFySXRlbXMuZ2V0KGlkKTtcblx0XHRcdGlmIChpdGVtKSB7XG5cdFx0XHRcdHRoaXMuX2NlbGxTdGF0dXNCYXJJdGVtcy5kZWxldGUoaWQpO1xuXHRcdFx0fVxuXHRcdH0pO1xuXG5cdFx0Y29uc3QgbmV3SWRzID0gbmV3SXRlbXMubWFwKGl0ZW0gPT4ge1xuXHRcdFx0Y29uc3QgaWQgPSArK3RoaXMuX2xhc3RTdGF0dXNCYXJJZDtcblx0XHRcdGNvbnN0IGl0ZW1JZCA9IGBfY2VsbF8ke3RoaXMuaWR9OyR7aWR9YDtcblx0XHRcdHRoaXMuX2NlbGxTdGF0dXNCYXJJdGVtcy5zZXQoaXRlbUlkLCBpdGVtKTtcblx0XHRcdHJldHVybiBpdGVtSWQ7XG5cdFx0fSk7XG5cblx0XHR0aGlzLl9vbkRpZENoYW5nZUNlbGxTdGF0dXNCYXJJdGVtcy5maXJlKCk7XG5cblx0XHRyZXR1cm4gbmV3SWRzO1xuXHR9XG5cblx0Z2V0Q2VsbFN0YXR1c0Jhckl0ZW1zKCk6IElOb3RlYm9va0NlbGxTdGF0dXNCYXJJdGVtW10ge1xuXHRcdHJldHVybiBBcnJheS5mcm9tKHRoaXMuX2NlbGxTdGF0dXNCYXJJdGVtcy52YWx1ZXMoKSk7XG5cdH1cblxuXHRyZXZlYWxSYW5nZUluQ2VudGVyKHJhbmdlOiBSYW5nZSkge1xuXHRcdHRoaXMuX3RleHRFZGl0b3I/LnJldmVhbFJhbmdlSW5DZW50ZXIocmFuZ2UsIGVkaXRvckNvbW1vbi5TY3JvbGxUeXBlLkltbWVkaWF0ZSk7XG5cdH1cblxuXHRzZXRTZWxlY3Rpb24ocmFuZ2U6IFJhbmdlKSB7XG5cdFx0dGhpcy5fdGV4dEVkaXRvcj8uc2V0U2VsZWN0aW9uKHJhbmdlKTtcblx0fVxuXG5cdHNldFNlbGVjdGlvbnMoc2VsZWN0aW9uczogU2VsZWN0aW9uW10pIHtcblx0XHRpZiAoc2VsZWN0aW9ucy5sZW5ndGgpIHtcblx0XHRcdGlmICh0aGlzLl90ZXh0RWRpdG9yKSB7XG5cdFx0XHRcdHRoaXMuX3RleHRFZGl0b3I/LnNldFNlbGVjdGlvbnMoc2VsZWN0aW9ucyk7XG5cdFx0XHR9IGVsc2UgaWYgKHRoaXMuX2VkaXRvclZpZXdTdGF0ZXMpIHtcblx0XHRcdFx0dGhpcy5fZWRpdG9yVmlld1N0YXRlcy5jdXJzb3JTdGF0ZSA9IHNlbGVjdGlvbnMubWFwKHNlbGVjdGlvbiA9PiB7XG5cdFx0XHRcdFx0cmV0dXJuIHtcblx0XHRcdFx0XHRcdGluU2VsZWN0aW9uTW9kZTogIXNlbGVjdGlvbi5pc0VtcHR5KCksXG5cdFx0XHRcdFx0XHRzZWxlY3Rpb25TdGFydDogc2VsZWN0aW9uLmdldFN0YXJ0UG9zaXRpb24oKSxcblx0XHRcdFx0XHRcdHBvc2l0aW9uOiBzZWxlY3Rpb24uZ2V0RW5kUG9zaXRpb24oKSxcblx0XHRcdFx0XHR9O1xuXHRcdFx0XHR9KTtcblx0XHRcdH1cblx0XHR9XG5cdH1cblxuXHRnZXRTZWxlY3Rpb25zKCkge1xuXHRcdHJldHVybiB0aGlzLl90ZXh0RWRpdG9yPy5nZXRTZWxlY3Rpb25zKClcblx0XHRcdD8/IHRoaXMuX2VkaXRvclZpZXdTdGF0ZXM/LmN1cnNvclN0YXRlLm1hcChzdGF0ZSA9PiBuZXcgU2VsZWN0aW9uKHN0YXRlLnNlbGVjdGlvblN0YXJ0LmxpbmVOdW1iZXIsIHN0YXRlLnNlbGVjdGlvblN0YXJ0LmNvbHVtbiwgc3RhdGUucG9zaXRpb24ubGluZU51bWJlciwgc3RhdGUucG9zaXRpb24uY29sdW1uKSlcblx0XHRcdD8/IFtdO1xuXHR9XG5cblx0Z2V0U2VsZWN0aW9uc1N0YXJ0UG9zaXRpb24oKTogSVBvc2l0aW9uW10gfCB1bmRlZmluZWQge1xuXHRcdGlmICh0aGlzLl90ZXh0RWRpdG9yKSB7XG5cdFx0XHRjb25zdCBzZWxlY3Rpb25zID0gdGhpcy5fdGV4dEVkaXRvci5nZXRTZWxlY3Rpb25zKCk7XG5cdFx0XHRyZXR1cm4gc2VsZWN0aW9ucz8ubWFwKHMgPT4gcy5nZXRTdGFydFBvc2l0aW9uKCkpO1xuXHRcdH0gZWxzZSB7XG5cdFx0XHRjb25zdCBzZWxlY3Rpb25zID0gdGhpcy5fZWRpdG9yVmlld1N0YXRlcz8uY3Vyc29yU3RhdGU7XG5cdFx0XHRyZXR1cm4gc2VsZWN0aW9ucz8ubWFwKHMgPT4gcy5zZWxlY3Rpb25TdGFydCk7XG5cdFx0fVxuXHR9XG5cblx0Z2V0TGluZVNjcm9sbFRvcE9mZnNldChsaW5lOiBudW1iZXIpOiBudW1iZXIge1xuXHRcdGlmICghdGhpcy5fdGV4dEVkaXRvcikge1xuXHRcdFx0cmV0dXJuIDA7XG5cdFx0fVxuXG5cdFx0Y29uc3QgZWRpdG9yUGFkZGluZyA9IHRoaXMuX3ZpZXdDb250ZXh0Lm5vdGVib29rT3B0aW9ucy5jb21wdXRlRWRpdG9yUGFkZGluZyh0aGlzLmludGVybmFsTWV0YWRhdGEsIHRoaXMudXJpKTtcblx0XHRyZXR1cm4gdGhpcy5fdGV4dEVkaXRvci5nZXRUb3BGb3JMaW5lTnVtYmVyKGxpbmUpICsgZWRpdG9yUGFkZGluZy50b3A7XG5cdH1cblxuXHRnZXRQb3NpdGlvblNjcm9sbFRvcE9mZnNldChyYW5nZTogU2VsZWN0aW9uIHwgUmFuZ2UpOiBudW1iZXIge1xuXHRcdGlmICghdGhpcy5fdGV4dEVkaXRvcikge1xuXHRcdFx0cmV0dXJuIDA7XG5cdFx0fVxuXG5cblx0XHRjb25zdCBwb3NpdGlvbiA9IHJhbmdlIGluc3RhbmNlb2YgU2VsZWN0aW9uID8gcmFuZ2UuZ2V0UG9zaXRpb24oKSA6IHJhbmdlLmdldFN0YXJ0UG9zaXRpb24oKTtcblxuXHRcdGNvbnN0IGVkaXRvclBhZGRpbmcgPSB0aGlzLl92aWV3Q29udGV4dC5ub3RlYm9va09wdGlvbnMuY29tcHV0ZUVkaXRvclBhZGRpbmcodGhpcy5pbnRlcm5hbE1ldGFkYXRhLCB0aGlzLnVyaSk7XG5cdFx0cmV0dXJuIHRoaXMuX3RleHRFZGl0b3IuZ2V0VG9wRm9yUG9zaXRpb24ocG9zaXRpb24ubGluZU51bWJlciwgcG9zaXRpb24uY29sdW1uKSArIGVkaXRvclBhZGRpbmcudG9wO1xuXHR9XG5cblx0Y3Vyc29yQXRMaW5lQm91bmRhcnkoKTogQ3Vyc29yQXRMaW5lQm91bmRhcnkge1xuXHRcdGlmICghdGhpcy5fdGV4dEVkaXRvciB8fCAhdGhpcy50ZXh0TW9kZWwgfHwgIXRoaXMuX3RleHRFZGl0b3IuaGFzVGV4dEZvY3VzKCkpIHtcblx0XHRcdHJldHVybiBDdXJzb3JBdExpbmVCb3VuZGFyeS5Ob25lO1xuXHRcdH1cblxuXHRcdGNvbnN0IHNlbGVjdGlvbiA9IHRoaXMuX3RleHRFZGl0b3IuZ2V0U2VsZWN0aW9uKCk7XG5cblx0XHRpZiAoIXNlbGVjdGlvbiB8fCAhc2VsZWN0aW9uLmlzRW1wdHkoKSkge1xuXHRcdFx0cmV0dXJuIEN1cnNvckF0TGluZUJvdW5kYXJ5Lk5vbmU7XG5cdFx0fVxuXG5cdFx0Y29uc3QgY3VycmVudExpbmVMZW5ndGggPSB0aGlzLnRleHRNb2RlbC5nZXRMaW5lTGVuZ3RoKHNlbGVjdGlvbi5zdGFydExpbmVOdW1iZXIpO1xuXG5cdFx0aWYgKGN1cnJlbnRMaW5lTGVuZ3RoID09PSAwKSB7XG5cdFx0XHRyZXR1cm4gQ3Vyc29yQXRMaW5lQm91bmRhcnkuQm90aDtcblx0XHR9XG5cblx0XHRzd2l0Y2ggKHNlbGVjdGlvbi5zdGFydENvbHVtbikge1xuXHRcdFx0Y2FzZSAxOlxuXHRcdFx0XHRyZXR1cm4gQ3Vyc29yQXRMaW5lQm91bmRhcnkuU3RhcnQ7XG5cdFx0XHRjYXNlIGN1cnJlbnRMaW5lTGVuZ3RoICsgMTpcblx0XHRcdFx0cmV0dXJuIEN1cnNvckF0TGluZUJvdW5kYXJ5LkVuZDtcblx0XHRcdGRlZmF1bHQ6XG5cdFx0XHRcdHJldHVybiBDdXJzb3JBdExpbmVCb3VuZGFyeS5Ob25lO1xuXHRcdH1cblx0fVxuXG5cdGN1cnNvckF0Qm91bmRhcnkoKTogQ3Vyc29yQXRCb3VuZGFyeSB7XG5cdFx0aWYgKCF0aGlzLl90ZXh0RWRpdG9yKSB7XG5cdFx0XHRyZXR1cm4gQ3Vyc29yQXRCb3VuZGFyeS5Ob25lO1xuXHRcdH1cblxuXHRcdGlmICghdGhpcy50ZXh0TW9kZWwpIHtcblx0XHRcdHJldHVybiBDdXJzb3JBdEJvdW5kYXJ5Lk5vbmU7XG5cdFx0fVxuXG5cdFx0Ly8gb25seSB2YWxpZGF0ZSBwcmltYXJ5IGN1cnNvclxuXHRcdGNvbnN0IHNlbGVjdGlvbiA9IHRoaXMuX3RleHRFZGl0b3IuZ2V0U2VsZWN0aW9uKCk7XG5cblx0XHQvLyBvbmx5IHZhbGlkYXRlIGVtcHR5IGN1cnNvclxuXHRcdGlmICghc2VsZWN0aW9uIHx8ICFzZWxlY3Rpb24uaXNFbXB0eSgpKSB7XG5cdFx0XHRyZXR1cm4gQ3Vyc29yQXRCb3VuZGFyeS5Ob25lO1xuXHRcdH1cblxuXHRcdGNvbnN0IGZpcnN0Vmlld0xpbmVUb3AgPSB0aGlzLl90ZXh0RWRpdG9yLmdldFRvcEZvclBvc2l0aW9uKDEsIDEpO1xuXHRcdGNvbnN0IGxhc3RWaWV3TGluZVRvcCA9IHRoaXMuX3RleHRFZGl0b3IuZ2V0VG9wRm9yUG9zaXRpb24odGhpcy50ZXh0TW9kZWwuZ2V0TGluZUNvdW50KCksIHRoaXMudGV4dE1vZGVsLmdldExpbmVMZW5ndGgodGhpcy50ZXh0TW9kZWwuZ2V0TGluZUNvdW50KCkpKTtcblx0XHRjb25zdCBzZWxlY3Rpb25Ub3AgPSB0aGlzLl90ZXh0RWRpdG9yLmdldFRvcEZvclBvc2l0aW9uKHNlbGVjdGlvbi5zdGFydExpbmVOdW1iZXIsIHNlbGVjdGlvbi5zdGFydENvbHVtbik7XG5cblx0XHRpZiAoc2VsZWN0aW9uVG9wID09PSBsYXN0Vmlld0xpbmVUb3ApIHtcblx0XHRcdGlmIChzZWxlY3Rpb25Ub3AgPT09IGZpcnN0Vmlld0xpbmVUb3ApIHtcblx0XHRcdFx0cmV0dXJuIEN1cnNvckF0Qm91bmRhcnkuQm90aDtcblx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdHJldHVybiBDdXJzb3JBdEJvdW5kYXJ5LkJvdHRvbTtcblx0XHRcdH1cblx0XHR9IGVsc2Uge1xuXHRcdFx0aWYgKHNlbGVjdGlvblRvcCA9PT0gZmlyc3RWaWV3TGluZVRvcCkge1xuXHRcdFx0XHRyZXR1cm4gQ3Vyc29yQXRCb3VuZGFyeS5Ub3A7XG5cdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRyZXR1cm4gQ3Vyc29yQXRCb3VuZGFyeS5Ob25lO1xuXHRcdFx0fVxuXHRcdH1cblx0fVxuXG5cdHByaXZhdGUgX2VkaXRTdGF0ZVNvdXJjZTogc3RyaW5nID0gJyc7XG5cblx0Z2V0IGVkaXRTdGF0ZVNvdXJjZSgpOiBzdHJpbmcge1xuXHRcdHJldHVybiB0aGlzLl9lZGl0U3RhdGVTb3VyY2U7XG5cdH1cblxuXHR1cGRhdGVFZGl0U3RhdGUobmV3U3RhdGU6IENlbGxFZGl0U3RhdGUsIHNvdXJjZTogc3RyaW5nKSB7XG5cdFx0dGhpcy5fZWRpdFN0YXRlU291cmNlID0gc291cmNlO1xuXHRcdGlmIChuZXdTdGF0ZSA9PT0gdGhpcy5fZWRpdFN0YXRlKSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXG5cdFx0dGhpcy5fZWRpdFN0YXRlID0gbmV3U3RhdGU7XG5cdFx0dGhpcy5fb25EaWRDaGFuZ2VTdGF0ZS5maXJlKHsgZWRpdFN0YXRlQ2hhbmdlZDogdHJ1ZSB9KTtcblx0XHRpZiAodGhpcy5fZWRpdFN0YXRlID09PSBDZWxsRWRpdFN0YXRlLlByZXZpZXcpIHtcblx0XHRcdHRoaXMuZm9jdXNNb2RlID0gQ2VsbEZvY3VzTW9kZS5Db250YWluZXI7XG5cdFx0fVxuXHR9XG5cblx0Z2V0RWRpdFN0YXRlKCkge1xuXHRcdHJldHVybiB0aGlzLl9lZGl0U3RhdGU7XG5cdH1cblxuXHRnZXQgdGV4dEJ1ZmZlcigpIHtcblx0XHRyZXR1cm4gdGhpcy5tb2RlbC50ZXh0QnVmZmVyO1xuXHR9XG5cblx0LyoqXG5cdCAqIFRleHQgbW9kZWwgaXMgdXNlZCBmb3IgZWRpdGluZy5cblx0ICovXG5cdGFzeW5jIHJlc29sdmVUZXh0TW9kZWwoKTogUHJvbWlzZTxtb2RlbC5JVGV4dE1vZGVsPiB7XG5cdFx0aWYgKCF0aGlzLl90ZXh0TW9kZWxSZWYgfHwgIXRoaXMudGV4dE1vZGVsKSB7XG5cdFx0XHR0aGlzLl90ZXh0TW9kZWxSZWYgPSBhd2FpdCB0aGlzLl9tb2RlbFNlcnZpY2UuY3JlYXRlTW9kZWxSZWZlcmVuY2UodGhpcy51cmkpO1xuXHRcdFx0aWYgKHRoaXMuX2lzRGlzcG9zZWQpIHtcblx0XHRcdFx0cmV0dXJuIHRoaXMudGV4dE1vZGVsITtcblx0XHRcdH1cblxuXHRcdFx0aWYgKCF0aGlzLl90ZXh0TW9kZWxSZWYpIHtcblx0XHRcdFx0dGhyb3cgbmV3IEVycm9yKGBDYW5ub3QgcmVzb2x2ZSB0ZXh0IG1vZGVsIGZvciAke3RoaXMudXJpfWApO1xuXHRcdFx0fVxuXHRcdFx0dGhpcy5fdGV4dE1vZGVsUmVmQ2hhbmdlRGlzcG9zYWJsZS52YWx1ZSA9IHRoaXMudGV4dE1vZGVsIS5vbkRpZENoYW5nZUNvbnRlbnQoKCkgPT4gdGhpcy5vbkRpZENoYW5nZVRleHRNb2RlbENvbnRlbnQoKSk7XG5cdFx0fVxuXG5cdFx0cmV0dXJuIHRoaXMudGV4dE1vZGVsITtcblx0fVxuXG5cdHByb3RlY3RlZCBhYnN0cmFjdCBvbkRpZENoYW5nZVRleHRNb2RlbENvbnRlbnQoKTogdm9pZDtcblxuXHRwcm90ZWN0ZWQgY2VsbFN0YXJ0RmluZCh2YWx1ZTogc3RyaW5nLCBvcHRpb25zOiBJTm90ZWJvb2tGaW5kT3B0aW9ucyk6IG1vZGVsLkZpbmRNYXRjaFtdIHwgbnVsbCB7XG5cdFx0bGV0IGNlbGxNYXRjaGVzOiBtb2RlbC5GaW5kTWF0Y2hbXSA9IFtdO1xuXG5cdFx0Y29uc3QgbGluZUNvdW50ID0gdGhpcy50ZXh0QnVmZmVyLmdldExpbmVDb3VudCgpO1xuXHRcdGNvbnN0IGZpbmRSYW5nZTogSVJhbmdlW10gPSBvcHRpb25zLmZpbmRTY29wZT8uc2VsZWN0ZWRUZXh0UmFuZ2VzID8/IFtuZXcgUmFuZ2UoMSwgMSwgbGluZUNvdW50LCB0aGlzLnRleHRCdWZmZXIuZ2V0TGluZUxlbmd0aChsaW5lQ291bnQpICsgMSldO1xuXG5cdFx0aWYgKHRoaXMuYXNzZXJ0VGV4dE1vZGVsQXR0YWNoZWQoKSkge1xuXHRcdFx0Y2VsbE1hdGNoZXMgPSB0aGlzLnRleHRNb2RlbCEuZmluZE1hdGNoZXMoXG5cdFx0XHRcdHZhbHVlLFxuXHRcdFx0XHRmaW5kUmFuZ2UsXG5cdFx0XHRcdG9wdGlvbnMucmVnZXggfHwgZmFsc2UsXG5cdFx0XHRcdG9wdGlvbnMuY2FzZVNlbnNpdGl2ZSB8fCBmYWxzZSxcblx0XHRcdFx0b3B0aW9ucy53aG9sZVdvcmQgPyBvcHRpb25zLndvcmRTZXBhcmF0b3JzIHx8IG51bGwgOiBudWxsLFxuXHRcdFx0XHRvcHRpb25zLnJlZ2V4IHx8IGZhbHNlKTtcblx0XHR9IGVsc2Uge1xuXHRcdFx0Y29uc3Qgc2VhcmNoUGFyYW1zID0gbmV3IFNlYXJjaFBhcmFtcyh2YWx1ZSwgb3B0aW9ucy5yZWdleCB8fCBmYWxzZSwgb3B0aW9ucy5jYXNlU2Vuc2l0aXZlIHx8IGZhbHNlLCBvcHRpb25zLndob2xlV29yZCA/IG9wdGlvbnMud29yZFNlcGFyYXRvcnMgfHwgbnVsbCA6IG51bGwsKTtcblx0XHRcdGNvbnN0IHNlYXJjaERhdGEgPSBzZWFyY2hQYXJhbXMucGFyc2VTZWFyY2hSZXF1ZXN0KCk7XG5cblx0XHRcdGlmICghc2VhcmNoRGF0YSkge1xuXHRcdFx0XHRyZXR1cm4gbnVsbDtcblx0XHRcdH1cblxuXHRcdFx0ZmluZFJhbmdlLmZvckVhY2gocmFuZ2UgPT4ge1xuXHRcdFx0XHRjZWxsTWF0Y2hlcy5wdXNoKC4uLnRoaXMudGV4dEJ1ZmZlci5maW5kTWF0Y2hlc0xpbmVCeUxpbmUobmV3IFJhbmdlKHJhbmdlLnN0YXJ0TGluZU51bWJlciwgcmFuZ2Uuc3RhcnRDb2x1bW4sIHJhbmdlLmVuZExpbmVOdW1iZXIsIHJhbmdlLmVuZENvbHVtbiksIHNlYXJjaERhdGEsIG9wdGlvbnMucmVnZXggfHwgZmFsc2UsIDEwMDApKTtcblx0XHRcdH0pO1xuXHRcdH1cblxuXHRcdHJldHVybiBjZWxsTWF0Y2hlcztcblx0fVxuXG5cdG92ZXJyaWRlIGRpc3Bvc2UoKSB7XG5cdFx0dGhpcy5faXNEaXNwb3NlZCA9IHRydWU7XG5cdFx0c3VwZXIuZGlzcG9zZSgpO1xuXG5cdFx0ZGlzcG9zZSh0aGlzLl9lZGl0b3JMaXN0ZW5lcnMpO1xuXG5cdFx0Ly8gT25seSByZW1vdmUgdGhlIHVuZG8gcmVkbyBzdGFjayBpZiB3ZSBtYXAgdGhpcyBjZWxsIHVyaSB0byBpdHNlbGZcblx0XHQvLyBJZiB3ZSBhcmUgbm90IGluIHBlckNlbGwgbW9kZSwgaXQgd2lsbCBtYXAgdG8gdGhlIGZ1bGwgTm90ZWJvb2tEb2N1bWVudCBhbmRcblx0XHQvLyB3ZSBkb24ndCB3YW50IHRvIHJlbW92ZSB0aGF0IGVudGlyZSBkb2N1bWVudCB1bmRvIC8gcmVkbyBzdGFjayB3aGVuIGEgY2VsbCBpcyBkZWxldGVkXG5cdFx0aWYgKHRoaXMuX3VuZG9SZWRvU2VydmljZS5nZXRVcmlDb21wYXJpc29uS2V5KHRoaXMudXJpKSA9PT0gdGhpcy51cmkudG9TdHJpbmcoKSkge1xuXHRcdFx0dGhpcy5fdW5kb1JlZG9TZXJ2aWNlLnJlbW92ZUVsZW1lbnRzKHRoaXMudXJpKTtcblx0XHR9XG5cblx0XHR0aGlzLl90ZXh0TW9kZWxSZWY/LmRpc3Bvc2UoKTtcblx0fVxuXG5cdHRvSlNPTigpOiBvYmplY3Qge1xuXHRcdHJldHVybiB7XG5cdFx0XHRoYW5kbGU6IHRoaXMuaGFuZGxlXG5cdFx0fTtcblx0fVxufVxuIl0sCiAgIm1hcHBpbmdzIjogIkFBS0EsU0FBUyxlQUFzQjtBQUMvQixTQUFTLFlBQXFDLG1CQUFtQixlQUFlO0FBQ2hGLFNBQVMsYUFBYTtBQUt0QixTQUFpQixhQUFhO0FBQzlCLFNBQVMsaUJBQWlCO0FBQzFCLFlBQVksa0JBQWtCO0FBRTlCLFNBQVMsb0JBQW9CO0FBSTdCLFNBQWtDLG9CQUFvQiwyQkFBMkI7QUFDakYsU0FBUyxlQUFlLGVBQXNDLGtCQUFrQiw0QkFBb0Y7QUFRN0osTUFBZSwwQkFBMEIsV0FBVztBQUFBLEVBMEoxRCxZQUNVLFVBQ0FBLFFBQ0YsSUFDVSxjQUNBLHVCQUNBLGVBQ0Esa0JBQ0Esb0JBQ0EsMkJBRWhCO0FBQ0QsVUFBTTtBQVhHO0FBQ0EsaUJBQUFBO0FBQ0Y7QUFDVTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFqS2xCLFNBQW1CLGdDQUFnQyxLQUFLLFVBQVUsSUFBSSxRQUFjLENBQUM7QUFFckY7QUFBQSxTQUFTLCtCQUErQixLQUFLLDhCQUE4QjtBQUMzRSxTQUFtQixvQkFBb0IsS0FBSyxVQUFVLElBQUksUUFBdUMsQ0FBQztBQUNsRyxTQUFnQixtQkFBeUQsS0FBSyxrQkFBa0I7QUFxQ2hHLFNBQVEsYUFBNEIsY0FBYztBQUVsRCxTQUFRLGVBQXlDO0FBdUJqRCxTQUFRLGFBQTRCLGNBQWM7QUFlbEQsU0FBUSxtQkFBa0MsQ0FBQztBQUMzQyxTQUFRLG9CQUE4RDtBQUN0RSxTQUFRLHdCQUF3RDtBQUNoRSxTQUFRLDJCQUEyQixvQkFBSSxJQUE0QztBQUNuRixTQUFpQixnQ0FBZ0MsS0FBSyxVQUFVLElBQUksa0JBQWtCLENBQUM7QUFFdkYsU0FBaUIsMEJBQTBCLEtBQUssVUFB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
