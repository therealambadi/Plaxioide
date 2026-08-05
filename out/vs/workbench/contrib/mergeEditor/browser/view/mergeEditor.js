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
import { reset } from "../../../../../base/browser/dom.js";
import { SerializableGrid } from "../../../../../base/browser/ui/grid/grid.js";
import { Orientation } from "../../../../../base/browser/ui/splitview/splitview.js";
import { Color } from "../../../../../base/common/color.js";
import { BugIndicatingError, onUnexpectedError } from "../../../../../base/common/errors.js";
import { Emitter } from "../../../../../base/common/event.js";
import { Disposable, DisposableStore, MutableDisposable, thenIfNotDisposed, toDisposable } from "../../../../../base/common/lifecycle.js";
import { autorun, autorunWithStore, observableValue, transaction } from "../../../../../base/common/observable.js";
import { basename, isEqual } from "../../../../../base/common/resources.js";
import { isDefined } from "../../../../../base/common/types.js";
import "./media/mergeEditor.css";
import { ICodeEditorService } from "../../../../../editor/browser/services/codeEditorService.js";
import { ScrollType } from "../../../../../editor/common/editorCommon.js";
import { ITextResourceConfigurationService } from "../../../../../editor/common/services/textResourceConfiguration.js";
import { localize } from "../../../../../nls.js";
import { IContextKeyService } from "../../../../../platform/contextkey/common/contextkey.js";
import { IFileService } from "../../../../../platform/files/common/files.js";
import { IInstantiationService } from "../../../../../platform/instantiation/common/instantiation.js";
import { IStorageService, StorageScope, StorageTarget } from "../../../../../platform/storage/common/storage.js";
import { ITelemetryService } from "../../../../../platform/telemetry/common/telemetry.js";
import { IThemeService } from "../../../../../platform/theme/common/themeService.js";
import { AbstractTextEditor } from "../../../../browser/parts/editor/textEditor.js";
import { DEFAULT_EDITOR_ASSOCIATION } from "../../../../common/editor.js";
import { applyTextEditorOptions } from "../../../../common/editor/editorOptions.js";
import { readTransientState, writeTransientState } from "../../../codeEditor/browser/toggleWordWrap.js";
import { MergeEditorInput } from "../mergeEditorInput.js";
import { deepMerge, PersistentStore } from "../utils.js";
import { BaseCodeEditorView } from "./editors/baseCodeEditorView.js";
import { ScrollSynchronizer } from "./scrollSynchronizer.js";
import { MergeEditorViewModel } from "./viewModel.js";
import { ViewZoneComputer } from "./viewZones.js";
import { ctxIsMergeEditor, ctxMergeBaseUri, ctxMergeEditorLayout, ctxMergeEditorShowBase, ctxMergeEditorShowBaseAtTop, ctxMergeEditorShowNonConflictingChanges, ctxMergeResultUri } from "../../common/mergeEditor.js";
import { settingsSashBorder } from "../../../preferences/common/settingsEditorColorRegistry.js";
import { IEditorGroupsService } from "../../../../services/editor/common/editorGroupsService.js";
import { IEditorResolverService, RegisteredEditorPriority } from "../../../../services/editor/common/editorResolverService.js";
import { IEditorService } from "../../../../services/editor/common/editorService.js";
import "./colors.js";
import { InputCodeEditorView } from "./editors/inputCodeEditorView.js";
import { ResultCodeEditorView } from "./editors/resultCodeEditorView.js";
let MergeEditor = class extends AbstractTextEditor {
  constructor(group, instantiation, contextKeyService, telemetryService, storageService, themeService, textResourceConfigurationService, editorService, editorGroupService, fileService, _codeEditorService) {
    super(MergeEditor.ID, group, telemetryService, instantiation, storageService, textResourceConfigurationService, themeService, editorService, editorGroupService, fileService);
    this.contextKeyService = contextKeyService;
    this._codeEditorService = _codeEditorService;
    this._sessionDisposables = new DisposableStore();
    this._viewModel = observableValue(this, void 0);
    this._grid = this._register(new MutableDisposable());
    this.input1View = this._register(this.instantiationService.createInstance(InputCodeEditorView, 1, this._viewModel));
    this.baseView = observableValue(this, void 0);
    this.baseViewOptions = observableValue(this, void 0);
    this.input2View = this._register(this.instantiationService.createInstance(InputCodeEditorView, 2, this._viewModel));
    this.inputResultView = this._register(this.instantiationService.createInstance(ResultCodeEditorView, this._viewModel));
    this._layoutMode = this.instantiationService.createInstance(MergeEditorLayoutStore);
    this._layoutModeObs = observableValue(this, this._layoutMode.value);
    this._ctxIsMergeEditor = ctxIsMergeEditor.bindTo(this.contextKeyService);
    this._ctxUsesColumnLayout = ctxMergeEditorLayout.bindTo(this.contextKeyService);
    this._ctxShowBase = ctxMergeEditorShowBase.bindTo(this.contextKeyService);
    this._ctxShowBaseAtTop = ctxMergeEditorShowBaseAtTop.bindTo(this.contextKeyService);
    this._ctxResultUri = ctxMergeResultUri.bindTo(this.contextKeyService);
    this._ctxBaseUri = ctxMergeBaseUri.bindTo(this.contextKeyService);
    this._ctxShowNonConflictingChanges = ctxMergeEditorShowNonConflictingChanges.bindTo(this.contextKeyService);
    this._inputModel = observableValue(this, void 0);
    this.viewZoneComputer = new ViewZoneComputer(
      this.input1View.editor,
      this.input2View.editor,
      this.inputResultView.editor
    );
    this.scrollSynchronizer = this._register(new ScrollSynchronizer(this._viewModel, this.input1View, this.input2View, this.baseView, this.inputResultView, this._layoutModeObs));
    // #region layout constraints
    this._onDidChangeSizeConstraints = new Emitter();
    this.onDidChangeSizeConstraints = this._onDidChangeSizeConstraints.event;
    this.baseViewDisposables = this._register(new DisposableStore());
    this.showNonConflictingChangesStore = this.instantiationService.createInstance(PersistentStore, "mergeEditor/showNonConflictingChanges");
    this.showNonConflictingChanges = observableValue(this, this.showNonConflictingChangesStore.get() ?? false);
  }
  get viewModel() {
    return this._viewModel;
  }
  get inputModel() {
    return this._inputModel;
  }
  get model() {
    return this.inputModel.get()?.model;
  }
  dispose() {
    this._sessionDisposables.dispose();
    this._ctxIsMergeEditor.reset();
    this._ctxUsesColumnLayout.reset();
    this._ctxShowNonConflictingChanges.reset();
    super.dispose();
  }
  get minimumWidth() {
    return this._layoutMode.value.kind === "mixed" ? this.input1View.view.minimumWidth + this.input2View.view.minimumWidth : this.input1View.view.minimumWidth + this.input2View.view.minimumWidth + this.inputResultView.view.minimumWidth;
  }
  // #endregion
  getTitle() {
    if (this.input) {
      return this.input.getName();
    }
    return localize("mergeEditor", "Text Merge Editor");
  }
  createEditorControl(parent, initialOptions) {
    this.rootHtmlElement = parent;
    parent.classList.add("merge-editor");
    this.applyLayout(this._layoutMode.value);
    this.applyOptions(initialOptions);
  }
  updateEditorControlOptions(options) {
    this.applyOptions(options);
  }
  applyOptions(options) {
    const inputOptions = deepMerge(options, {
      minimap: { enabled: false },
      glyphMargin: false,
      lineNumbersMinChars: 2
    });
    const readOnlyInputOptions = deepMerge(inputOptions, {
      readOnly: true,
      readOnlyMessage: void 0
    });
    this.input1View.updateOptions(readOnlyInputOptions);
    this.input2View.updateOptions(readOnlyInputOptions);
    this.baseViewOptions.set({ ...this.input2View.editor.getRawOptions() }, void 0);
    this.inputResultView.updateOptions(inputOptions);
  }
  getMainControl() {
    return this.inputResultView.editor;
  }
  layout(dimension) {
    this._grid.value?.layout(dimension.width, dimension.height);
  }
  async setInput(input, options, context, token) {
    if (!(input instanceof MergeEditorInput)) {
      throw new BugIndicatingError("ONLY MergeEditorInput is supported");
    }
    await super.setInput(input, options, context, token);
    this._sessionDisposables.clear();
    transaction((tx) => {
      this._viewModel.set(void 0, tx);
      this._inputModel.set(void 0, tx);
    });
    const inputModel = await input.resolve();
    const model = inputModel.model;
    const viewModel = this.instantiationService.createInstance(
      MergeEditorViewModel,
      model,
      this.input1View,
      this.input2View,
      this.inputResultView,
      this.baseView,
      this.showNonConflictingChanges
    );
    model.telemetry.reportMergeEditorOpened({
      combinableConflictCount: model.combinableConflictCount,
      conflictCount: model.conflictCount,
      baseTop: this._layoutModeObs.get().showBaseAtTop,
      baseVisible: this._layoutModeObs.get().showBase,
      isColumnView: this._layoutModeObs.get().kind === "columns"
    });
    transaction((tx) => {
      this._viewModel.set(viewModel, tx);
      this._inputModel.set(inputModel, tx);
    });
    this._sessionDisposables.add(viewModel);
    this._ctxResultUri.set(inputModel.resultUri.toString());
    this._ctxBaseUri.set(model.base.uri.toString());
    this._sessionDisposables.add(toDisposable(() => {
      this._ctxBaseUri.reset();
      this._ctxResultUri.reset();
    }));
    this._sessionDisposables.add(autorunWithStore((reader, store) => {
      const baseView = this.baseView.read(reader);
      this.inputResultView.editor.changeViewZones((resultViewZoneAccessor) => {
        const layout = this._layoutModeObs.read(reader);
        const shouldAlignResult = layout.kind === "columns";
        const shouldAlignBase = layout.kind === "mixed" && !layout.showBaseAtTop;
        this.input1View.editor.changeViewZones((input1ViewZoneAccessor) => {
          this.input2View.editor.changeViewZones((input2ViewZoneAccessor) => {
            if (baseView) {
              baseView.editor.changeViewZones((baseViewZoneAccessor) => {
                store.add(this.setViewZones(
                  reader,
                  viewModel,
                  this.input1View.editor,
                  input1ViewZoneAccessor,
                  this.input2View.editor,
                  input2ViewZoneAccessor,
                  baseView.editor,
                  baseViewZoneAccessor,
                  shouldAlignBase,
                  this.inputResultView.editor,
                  resultViewZoneAccessor,
                  shouldAlignResult
                ));
              });
            } else {
              store.add(this.setViewZones(
                reader,
                viewModel,
                this.input1View.editor,
                input1ViewZoneAccessor,
                this.input2View.editor,
                input2ViewZoneAccessor,
                void 0,
                void 0,
                false,
                this.inputResultView.editor,
                resultViewZoneAccessor,
                shouldAlignResult
              ));
            }
          });
        });
      });
      this.scrollSynchronizer.updateScrolling();
    }));
    const viewState = this.loadEditorViewState(input, context);
    if (viewState) {
      this._applyViewState(viewState);
    } else {
      this._sessionDisposables.add(thenIfNotDisposed(model.onInitialized, () => {
        const firstConflict = model.modifiedBaseRanges.get().find((r) => r.isConflicting);
        if (!firstConflict) {
          return;
        }
        this.input1View.editor.revealLineInCenter(firstConflict.input1Range.startLineNumber);
        transaction((tx) => {
          viewModel.setActiveModifiedBaseRange(firstConflict, tx);
        });
      }));
    }
    const mirrorWordWrapTransientState = (candidate) => {
      const candidateState = readTransientState(candidate, this._codeEditorService);
      writeTransientState(model.input2.textModel, candidateState, this._codeEditorService);
      writeTransientState(model.input1.textModel, candidateState, this._codeEditorService);
      writeTransientState(model.resultTextModel, candidateState, this._codeEditorService);
      const baseTextModel = this.baseView.get()?.editor.getModel();
      if (baseTextModel) {
        writeTransientState(baseTextModel, candidateState, this._codeEditorService);
      }
    };
    this._sessionDisposables.add(this._codeEditorService.onDidChangeTransientModelProperty((candidate) => {
      mirrorWordWrapTransientState(candidate);
    }));
    mirrorWordWrapTransientState(this.inputResultView.editor.getModel());
    const that = this;
    this._sessionDisposables.add(new class {
      constructor() {
        this._disposable = new DisposableStore();
        for (const model2 of this.baseInput1Input2()) {
          this._disposable.add(model2.onDidChangeContent(() => this._checkBaseInput1Input2AllEmpty()));
        }
      }
      dispose() {
        this._disposable.dispose();
      }
      *baseInput1Input2() {
        yield model.base;
        yield model.input1.textModel;
        yield model.input2.textModel;
      }
      _checkBaseInput1Input2AllEmpty() {
        for (const model2 of this.baseInput1Input2()) {
          if (model2.getValueLength() > 0) {
            return;
          }
        }
        that.editorService.replaceEditors(
          [{ editor: input, replacement: { resource: input.result, options: { preserveFocus: true } }, forceReplaceDirty: true }],
          that.group
        );
      }
    }());
  }
  setViewZones(reader, viewModel, input1Editor, input1ViewZoneAccessor, input2Editor, input2ViewZoneAccessor, baseEditor, baseViewZoneAccessor, shouldAlignBase, resultEditor, resultViewZoneAccessor, shouldAlignResult) {
    const input1ViewZoneIds = [];
    const input2ViewZoneIds = [];
    const baseViewZoneIds = [];
    const resultViewZoneIds = [];
    const viewZones = this.viewZoneComputer.computeViewZones(reader, viewModel, {
      codeLensesVisible: true,
      showNonConflictingChanges: this.showNonConflictingChanges.read(reader),
      shouldAlignBase,
      shouldAlignResult
    });
    const disposableStore = new DisposableStore();
    if (baseViewZoneAccessor) {
      for (const v of viewZones.baseViewZones) {
        v.create(baseViewZoneAccessor, baseViewZoneIds, disposableStore);
      }
    }
    for (const v of viewZones.resultViewZones) {
      v.create(resultViewZoneAccessor, resultViewZoneIds, disposableStore);
    }
    for (const v of viewZones.input1ViewZones) {
      v.create(input1ViewZoneAccessor, input1ViewZoneIds, disposableStore);
    }
    for (const v of viewZones.input2ViewZones) {
      v.create(input2ViewZoneAccessor, input2ViewZoneIds, disposableStore);
    }
    disposableStore.add({
      dispose: () => {
        input1Editor.changeViewZones((a) => {
          for (const zone of input1ViewZoneIds) {
            a.removeZone(zone);
          }
        });
        input2Editor.changeViewZones((a) => {
          for (const zone of input2ViewZoneIds) {
            a.removeZone(zone);
          }
        });
        baseEditor?.changeViewZones((a) => {
          for (const zone of baseViewZoneIds) {
            a.removeZone(zone);
          }
        });
        resultEditor.changeViewZones((a) => {
          for (const zone of resultViewZoneIds) {
            a.removeZone(zone);
          }
        });
      }
    });
    return disposableStore;
  }
  setOptions(options) {
    super.setOptions(options);
    if (options) {
      applyTextEditorOptions(options, this.inputResultView.editor, ScrollType.Smooth);
    }
  }
  clearInput() {
    super.clearInput();
    this._sessionDisposables.clear();
    for (const { editor } of [this.input1View, this.input2View, this.inputResultView]) {
      editor.setModel(null);
    }
  }
  focus() {
    super.focus();
    (this.getControl() ?? this.inputResultView.editor).focus();
  }
  hasFocus() {
    for (const { editor } of [this.input1View, this.input2View, this.inputResultView]) {
      if (editor.hasTextFocus()) {
        return true;
      }
    }
    return super.hasFocus();
  }
  setEditorVisible(visible) {
    super.setEditorVisible(visible);
    for (const { editor } of [this.input1View, this.input2View, this.inputResultView]) {
      if (visible) {
        editor.onVisible();
      } else {
        editor.onHide();
      }
    }
    this._ctxIsMergeEditor.set(visible);
  }
  // ---- interact with "outside world" via`getControl`, `scopedContextKeyService`: we only expose the result-editor keep the others internal
  getControl() {
    return this.inputResultView.editor;
  }
  get scopedContextKeyService() {
    const control = this.getControl();
    return control?.invokeWithinContext((accessor) => accessor.get(IContextKeyService));
  }
  // --- layout
  toggleBase() {
    this.setLayout({
      ...this._layoutMode.value,
      showBase: !this._layoutMode.value.showBase
    });
  }
  toggleShowBaseTop() {
    const showBaseTop = this._layoutMode.value.showBase && this._layoutMode.value.showBaseAtTop;
    this.setLayout({
      ...this._layoutMode.value,
      showBaseAtTop: true,
      showBase: !showBaseTop
    });
  }
  toggleShowBaseCenter() {
    const showBaseCenter = this._layoutMode.value.showBase && !this._layoutMode.value.showBaseAtTop;
    this.setLayout({
      ...this._layoutMode.value,
      showBaseAtTop: false,
      showBase: !showBaseCenter
    });
  }
  setLayoutKind(kind) {
    this.setLayout({
      ...this._layoutMode.value,
      kind
    });
  }
  setLayout(newLayout) {
    const value = this._layoutMode.value;
    if (JSON.stringify(value) === JSON.stringify(newLayout)) {
      return;
    }
    this.model?.telemetry.reportLayoutChange({
      baseTop: newLayout.showBaseAtTop,
      baseVisible: newLayout.showBase,
      isColumnView: newLayout.kind === "columns"
    });
    this.applyLayout(newLayout);
  }
  applyLayout(layout) {
    transaction((tx) => {
      if (layout.showBase && !this.baseView.get()) {
        this.baseViewDisposables.clear();
        const baseView = this.baseViewDisposables.add(
          this.instantiationService.createInstance(
            BaseCodeEditorView,
            this.viewModel
          )
        );
        this.baseViewDisposables.add(autorun((reader) => {
          const options = this.baseViewOptions.read(reader);
          if (options) {
            baseView.updateOptions(options);
          }
        }));
        this.baseView.set(baseView, tx);
      } else if (!layout.showBase && this.baseView.get()) {
        this.baseView.set(void 0, tx);
        this.baseViewDisposables.clear();
      }
      if (layout.kind === "mixed") {
        this.setGrid([
          layout.showBaseAtTop && layout.showBase ? {
            size: 38,
            data: this.baseView.get().view
          } : void 0,
          {
            size: 38,
            groups: [
              { data: this.input1View.view },
              !layout.showBaseAtTop && layout.showBase ? { data: this.baseView.get().view } : void 0,
              { data: this.input2View.view }
            ].filter(isDefined)
          },
          {
            size: 62,
            data: this.inputResultView.view
          }
        ].filter(isDefined));
      } else if (layout.kind === "columns") {
        this.setGrid([
          layout.showBase ? {
            size: 40,
            data: this.baseView.get().view
          } : void 0,
          {
            size: 60,
            groups: [{ data: this.input1View.view }, { data: this.inputResultView.view }, { data: this.input2View.view }]
          }
        ].filter(isDefined));
      }
      this._layoutMode.value = layout;
      this._ctxUsesColumnLayout.set(layout.kind);
      this._ctxShowBase.set(layout.showBase);
      this._ctxShowBaseAtTop.set(layout.showBaseAtTop);
      this._onDidChangeSizeConstraints.fire();
      this._layoutModeObs.set(layout, tx);
    });
  }
  setGrid(descriptor) {
    let width = -1;
    let height = -1;
    if (this._grid.value) {
      width = this._grid.value.width;
      height = this._grid.value.height;
    }
    this._grid.value = SerializableGrid.from({
      orientation: Orientation.VERTICAL,
      size: 100,
      groups: descriptor
    }, {
      styles: { separatorBorder: this.theme.getColor(settingsSashBorder) ?? Color.transparent },
      proportionalLayout: true
    });
    reset(this.rootHtmlElement, this._grid.value.element);
    if (width !== -1) {
      this._grid.value.layout(width, height);
    }
  }
  _applyViewState(state) {
    if (!state) {
      return;
    }
    this.inputResultView.editor.restoreViewState(state);
    if (state.input1State) {
      this.input1View.editor.restoreViewState(state.input1State);
    }
    if (state.input2State) {
      this.input2View.editor.restoreViewState(state.input2State);
    }
    if (state.focusIndex >= 0) {
      [this.input1View.editor, this.input2View.editor, this.inputResultView.editor][state.focusIndex].focus();
    }
  }
  computeEditorViewState(resource) {
    if (!isEqual(this.inputModel.get()?.resultUri, resource)) {
      return void 0;
    }
    const result = this.inputResultView.editor.saveViewState();
    if (!result) {
      return void 0;
    }
    const input1State = this.input1View.editor.saveViewState() ?? void 0;
    const input2State = this.input2View.editor.saveViewState() ?? void 0;
    const focusIndex = [this.input1View.editor, this.input2View.editor, this.inputResultView.editor].findIndex((editor) => editor.hasWidgetFocus());
    return { ...result, input1State, input2State, focusIndex };
  }
  tracksEditorViewState(input) {
    return input instanceof MergeEditorInput;
  }
  toggleShowNonConflictingChanges() {
    this.showNonConflictingChanges.set(!this.showNonConflictingChanges.get(), void 0);
    this.showNonConflictingChangesStore.set(this.showNonConflictingChanges.get());
    this._ctxShowNonConflictingChanges.set(this.showNonConflictingChanges.get());
  }
};
MergeEditor.ID = "mergeEditor";
MergeEditor = __decorateClass([
  __decorateParam(1, IInstantiationService),
  __decorateParam(2, IContextKeyService),
  __decorateParam(3, ITelemetryService),
  __decorateParam(4, IStorageService),
  __decorateParam(5, IThemeService),
  __decorateParam(6, ITextResourceConfigurationService),
  __decorateParam(7, IEditorService),
  __decorateParam(8, IEditorGroupsService),
  __decorateParam(9, IFileService),
  __decorateParam(10, ICodeEditorService)
], MergeEditor);
let MergeEditorLayoutStore = class {
  constructor(_storageService) {
    this._storageService = _storageService;
    this._value = { kind: "mixed", showBase: false, showBaseAtTop: true };
    const value = _storageService.get(MergeEditorLayoutStore._key, StorageScope.PROFILE, "mixed");
    if (value === "mixed" || value === "columns") {
      this._value = { kind: value, showBase: false, showBaseAtTop: true };
    } else if (value) {
      try {
        this._value = JSON.parse(value);
      } catch (e) {
        onUnexpectedError(e);
      }
    }
  }
  get value() {
    return this._value;
  }
  set value(value) {
    if (this._value !== value) {
      this._value = value;
      this._storageService.store(MergeEditorLayoutStore._key, JSON.stringify(this._value), StorageScope.PROFILE, StorageTarget.USER);
    }
  }
};
MergeEditorLayoutStore._key = "mergeEditor/layout";
MergeEditorLayoutStore = __decorateClass([
  __decorateParam(0, IStorageService)
], MergeEditorLayoutStore);
let MergeEditorOpenHandlerContribution = class extends Disposable {
  constructor(_editorService, codeEditorService) {
    super();
    this._editorService = _editorService;
    this._store.add(codeEditorService.registerCodeEditorOpenHandler(this.openCodeEditorFromMergeEditor.bind(this)));
  }
  async openCodeEditorFromMergeEditor(input, _source, sideBySide) {
    const activePane = this._editorService.activeEditorPane;
    if (!sideBySide && input.options && activePane instanceof MergeEditor && activePane.getControl() && activePane.input instanceof MergeEditorInput && isEqual(input.resource, activePane.input.result)) {
      const targetEditor = activePane.getControl();
      applyTextEditorOptions(input.options, targetEditor, ScrollType.Smooth);
      return targetEditor;
    }
    return null;
  }
};
MergeEditorOpenHandlerContribution = __decorateClass([
  __decorateParam(0, IEditorService),
  __decorateParam(1, ICodeEditorService)
], MergeEditorOpenHandlerContribution);
let MergeEditorResolverContribution = class extends Disposable {
  constructor(editorResolverService, instantiationService) {
    super();
    const mergeEditorInputFactory = (mergeEditor) => {
      return {
        editor: instantiationService.createInstance(
          MergeEditorInput,
          mergeEditor.base.resource,
          {
            uri: mergeEditor.input1.resource,
            title: mergeEditor.input1.label ?? basename(mergeEditor.input1.resource),
            description: mergeEditor.input1.description ?? "",
            detail: mergeEditor.input1.detail
          },
          {
            uri: mergeEditor.input2.resource,
            title: mergeEditor.input2.label ?? basename(mergeEditor.input2.resource),
            description: mergeEditor.input2.description ?? "",
            detail: mergeEditor.input2.detail
          },
          mergeEditor.result.resource
        )
      };
    };
    this._register(editorResolverService.registerEditor(
      `*`,
      {
        id: DEFAULT_EDITOR_ASSOCIATION.id,
        label: DEFAULT_EDITOR_ASSOCIATION.displayName,
        detail: DEFAULT_EDITOR_ASSOCIATION.providerDisplayName,
        priority: RegisteredEditorPriority.builtin
      },
      {},
      {
        createMergeEditorInput: mergeEditorInputFactory
      }
    ));
  }
};
MergeEditorResolverContribution.ID = "workbench.contrib.mergeEditorResolver";
MergeEditorResolverContribution = __decorateClass([
  __decorateParam(0, IEditorResolverService),
  __decorateParam(1, IInstantiationService)
], MergeEditorResolverContribution);
export {
  MergeEditor,
  MergeEditorOpenHandlerContribution,
  MergeEditorResolverContribution
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvY29udHJpYi9tZXJnZUVkaXRvci9icm93c2VyL3ZpZXcvbWVyZ2VFZGl0b3IudHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbIi8qLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG4gKiAgQ29weXJpZ2h0IChjKSBNaWNyb3NvZnQgQ29ycG9yYXRpb24uIEFsbCByaWdodHMgcmVzZXJ2ZWQuXG4gKiAgTGljZW5zZWQgdW5kZXIgdGhlIE1JVCBMaWNlbnNlLiBTZWUgTGljZW5zZS50eHQgaW4gdGhlIHByb2plY3Qgcm9vdCBmb3IgbGljZW5zZSBpbmZvcm1hdGlvbi5cbiAqLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0qL1xuXG5pbXBvcnQgeyBEaW1lbnNpb24sIHJlc2V0IH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vYmFzZS9icm93c2VyL2RvbS5qcyc7XG5pbXBvcnQgeyBHcmlkLCBHcmlkTm9kZURlc2NyaXB0b3IsIElWaWV3LCBTZXJpYWxpemFibGVHcmlkIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vYmFzZS9icm93c2VyL3VpL2dyaWQvZ3JpZC5qcyc7XG5pbXBvcnQgeyBPcmllbnRhdGlvbiB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL2Jhc2UvYnJvd3Nlci91aS9zcGxpdHZpZXcvc3BsaXR2aWV3LmpzJztcbmltcG9ydCB7IENhbmNlbGxhdGlvblRva2VuIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vY2FuY2VsbGF0aW9uLmpzJztcbmltcG9ydCB7IENvbG9yIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vY29sb3IuanMnO1xuaW1wb3J0IHsgQnVnSW5kaWNhdGluZ0Vycm9yLCBvblVuZXhwZWN0ZWRFcnJvciB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2Vycm9ycy5qcyc7XG5pbXBvcnQgeyBFbWl0dGVyLCBFdmVudCB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2V2ZW50LmpzJztcbmltcG9ydCB7IERpc3Bvc2FibGUsIERpc3Bvc2FibGVTdG9yZSwgSURpc3Bvc2FibGUsIE11dGFibGVEaXNwb3NhYmxlLCB0aGVuSWZOb3REaXNwb3NlZCwgdG9EaXNwb3NhYmxlIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vbGlmZWN5Y2xlLmpzJztcbmltcG9ydCB7IGF1dG9ydW4sIGF1dG9ydW5XaXRoU3RvcmUsIElPYnNlcnZhYmxlLCBJUmVhZGVyLCBvYnNlcnZhYmxlVmFsdWUsIHRyYW5zYWN0aW9uIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vb2JzZXJ2YWJsZS5qcyc7XG5pbXBvcnQgeyBiYXNlbmFtZSwgaXNFcXVhbCB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL3Jlc291cmNlcy5qcyc7XG5pbXBvcnQgeyBpc0RlZmluZWQgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi90eXBlcy5qcyc7XG5pbXBvcnQgeyBVUkkgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi91cmkuanMnO1xuaW1wb3J0ICcuL21lZGlhL21lcmdlRWRpdG9yLmNzcyc7XG5pbXBvcnQgeyBJQ29kZUVkaXRvciwgSVZpZXdab25lQ2hhbmdlQWNjZXNzb3IgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9lZGl0b3IvYnJvd3Nlci9lZGl0b3JCcm93c2VyLmpzJztcbmltcG9ydCB7IElDb2RlRWRpdG9yU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL2VkaXRvci9icm93c2VyL3NlcnZpY2VzL2NvZGVFZGl0b3JTZXJ2aWNlLmpzJztcbmltcG9ydCB7IElFZGl0b3JPcHRpb25zIGFzIElDb2RlRWRpdG9yT3B0aW9ucyB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL2VkaXRvci9jb21tb24vY29uZmlnL2VkaXRvck9wdGlvbnMuanMnO1xuaW1wb3J0IHsgSUNvZGVFZGl0b3JWaWV3U3RhdGUsIFNjcm9sbFR5cGUgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9lZGl0b3IvY29tbW9uL2VkaXRvckNvbW1vbi5qcyc7XG5pbXBvcnQgeyBJVGV4dE1vZGVsIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vZWRpdG9yL2NvbW1vbi9tb2RlbC5qcyc7XG5pbXBvcnQgeyBJVGV4dFJlc291cmNlQ29uZmlndXJhdGlvblNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9lZGl0b3IvY29tbW9uL3NlcnZpY2VzL3RleHRSZXNvdXJjZUNvbmZpZ3VyYXRpb24uanMnO1xuaW1wb3J0IHsgbG9jYWxpemUgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9ubHMuanMnO1xuaW1wb3J0IHsgSUNvbnRleHRLZXksIElDb250ZXh0S2V5U2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL3BsYXRmb3JtL2NvbnRleHRrZXkvY29tbW9uL2NvbnRleHRrZXkuanMnO1xuaW1wb3J0IHsgSUVkaXRvck9wdGlvbnMsIElUZXh0RWRpdG9yT3B0aW9ucywgSVRleHRSZXNvdXJjZUVkaXRvcklucHV0IH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vcGxhdGZvcm0vZWRpdG9yL2NvbW1vbi9lZGl0b3IuanMnO1xuaW1wb3J0IHsgSUZpbGVTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vcGxhdGZvcm0vZmlsZXMvY29tbW9uL2ZpbGVzLmpzJztcbmltcG9ydCB7IElJbnN0YW50aWF0aW9uU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL3BsYXRmb3JtL2luc3RhbnRpYXRpb24vY29tbW9uL2luc3RhbnRpYXRpb24uanMnO1xuaW1wb3J0IHsgSVN0b3JhZ2VTZXJ2aWNlLCBTdG9yYWdlU2NvcGUsIFN0b3JhZ2VUYXJnZXQgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9wbGF0Zm9ybS9zdG9yYWdlL2NvbW1vbi9zdG9yYWdlLmpzJztcbmltcG9ydCB7IElUZWxlbWV0cnlTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vcGxhdGZvcm0vdGVsZW1ldHJ5L2NvbW1vbi90ZWxlbWV0cnkuanMnO1xuaW1wb3J0IHsgSVRoZW1lU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL3BsYXRmb3JtL3RoZW1lL2NvbW1vbi90aGVtZVNlcnZpY2UuanMnO1xuaW1wb3J0IHsgQWJzdHJhY3RUZXh0RWRpdG9yIH0gZnJvbSAnLi4vLi4vLi4vLi4vYnJvd3Nlci9wYXJ0cy9lZGl0b3IvdGV4dEVkaXRvci5qcyc7XG5pbXBvcnQgeyBERUZBVUxUX0VESVRPUl9BU1NPQ0lBVElPTiwgRWRpdG9ySW5wdXRXaXRoT3B0aW9ucywgSUVkaXRvck9wZW5Db250ZXh0LCBJUmVzb3VyY2VNZXJnZUVkaXRvcklucHV0IH0gZnJvbSAnLi4vLi4vLi4vLi4vY29tbW9uL2VkaXRvci5qcyc7XG5pbXBvcnQgeyBFZGl0b3JJbnB1dCB9IGZyb20gJy4uLy4uLy4uLy4uL2NvbW1vbi9lZGl0b3IvZWRpdG9ySW5wdXQuanMnO1xuaW1wb3J0IHsgYXBwbHlUZXh0RWRpdG9yT3B0aW9ucyB9IGZyb20gJy4uLy4uLy4uLy4uL2NvbW1vbi9lZGl0b3IvZWRpdG9yT3B0aW9ucy5qcyc7XG5pbXBvcnQgeyByZWFkVHJhbnNpZW50U3RhdGUsIHdyaXRlVHJhbnNpZW50U3RhdGUgfSBmcm9tICcuLi8uLi8uLi9jb2RlRWRpdG9yL2Jyb3dzZXIvdG9nZ2xlV29yZFdyYXAuanMnO1xuaW1wb3J0IHsgTWVyZ2VFZGl0b3JJbnB1dCB9IGZyb20gJy4uL21lcmdlRWRpdG9ySW5wdXQuanMnO1xuaW1wb3J0IHsgSU1lcmdlRWRpdG9ySW5wdXRNb2RlbCB9IGZyb20gJy4uL21lcmdlRWRpdG9ySW5wdXRNb2RlbC5qcyc7XG5pbXBvcnQgeyBNZXJnZUVkaXRvck1vZGVsIH0gZnJvbSAnLi4vbW9kZWwvbWVyZ2VFZGl0b3JNb2RlbC5qcyc7XG5pbXBvcnQgeyBkZWVwTWVyZ2UsIFBlcnNpc3RlbnRTdG9yZSB9IGZyb20gJy4uL3V0aWxzLmpzJztcbmltcG9ydCB7IEJhc2VDb2RlRWRpdG9yVmlldyB9IGZyb20gJy4vZWRpdG9ycy9iYXNlQ29kZUVkaXRvclZpZXcuanMnO1xuaW1wb3J0IHsgU2Nyb2xsU3luY2hyb25pemVyIH0gZnJvbSAnLi9zY3JvbGxTeW5jaHJvbml6ZXIuanMnO1xuaW1wb3J0IHsgTWVyZ2VFZGl0b3JWaWV3TW9kZWwgfSBmcm9tICcuL3ZpZXdNb2RlbC5qcyc7XG5pbXBvcnQgeyBWaWV3Wm9uZUNvbXB1dGVyIH0gZnJvbSAnLi92aWV3Wm9uZXMuanMnO1xuaW1wb3J0IHsgY3R4SXNNZXJnZUVkaXRvciwgY3R4TWVyZ2VCYXNlVXJpLCBjdHhNZXJnZUVkaXRvckxheW91dCwgY3R4TWVyZ2VFZGl0b3JTaG93QmFzZSwgY3R4TWVyZ2VFZGl0b3JTaG93QmFzZUF0VG9wLCBjdHhNZXJnZUVkaXRvclNob3dOb25Db25mbGljdGluZ0NoYW5nZXMsIGN0eE1lcmdlUmVzdWx0VXJpLCBNZXJnZUVkaXRvckxheW91dEtpbmQgfSBmcm9tICcuLi8uLi9jb21tb24vbWVyZ2VFZGl0b3IuanMnO1xuaW1wb3J0IHsgc2V0dGluZ3NTYXNoQm9yZGVyIH0gZnJvbSAnLi4vLi4vLi4vcHJlZmVyZW5jZXMvY29tbW9uL3NldHRpbmdzRWRpdG9yQ29sb3JSZWdpc3RyeS5qcyc7XG5pbXBvcnQgeyBJRWRpdG9yR3JvdXAsIElFZGl0b3JHcm91cHNTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vc2VydmljZXMvZWRpdG9yL2NvbW1vbi9lZGl0b3JHcm91cHNTZXJ2aWNlLmpzJztcbmltcG9ydCB7IElFZGl0b3JSZXNvbHZlclNlcnZpY2UsIE1lcmdlRWRpdG9ySW5wdXRGYWN0b3J5RnVuY3Rpb24sIFJlZ2lzdGVyZWRFZGl0b3JQcmlvcml0eSB9IGZyb20gJy4uLy4uLy4uLy4uL3NlcnZpY2VzL2VkaXRvci9jb21tb24vZWRpdG9yUmVzb2x2ZXJTZXJ2aWNlLmpzJztcbmltcG9ydCB7IElFZGl0b3JTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vc2VydmljZXMvZWRpdG9yL2NvbW1vbi9lZGl0b3JTZXJ2aWNlLmpzJztcbmltcG9ydCAnLi9jb2xvcnMuanMnO1xuaW1wb3J0IHsgSW5wdXRDb2RlRWRpdG9yVmlldyB9IGZyb20gJy4vZWRpdG9ycy9pbnB1dENvZGVFZGl0b3JWaWV3LmpzJztcbmltcG9ydCB7IFJlc3VsdENvZGVFZGl0b3JWaWV3IH0gZnJvbSAnLi9lZGl0b3JzL3Jlc3VsdENvZGVFZGl0b3JWaWV3LmpzJztcblxuZXhwb3J0IGNsYXNzIE1lcmdlRWRpdG9yIGV4dGVuZHMgQWJzdHJhY3RUZXh0RWRpdG9yPElNZXJnZUVkaXRvclZpZXdTdGF0ZT4ge1xuXG5cdHN0YXRpYyByZWFkb25seSBJRCA9ICdtZXJnZUVkaXRvcic7XG5cblx0cHJpdmF0ZSByZWFkb25seSBfc2Vzc2lvbkRpc3Bvc2FibGVzID0gbmV3IERpc3Bvc2FibGVTdG9yZSgpO1xuXHRwcml2YXRlIHJlYWRvbmx5IF92aWV3TW9kZWwgPSBvYnNlcnZhYmxlVmFsdWU8TWVyZ2VFZGl0b3JWaWV3TW9kZWwgfCB1bmRlZmluZWQ+KHRoaXMsIHVuZGVmaW5lZCk7XG5cblx0cHVibGljIGdldCB2aWV3TW9kZWwoKTogSU9ic2VydmFibGU8TWVyZ2VFZGl0b3JWaWV3TW9kZWwgfCB1bmRlZmluZWQ+IHtcblx0XHRyZXR1cm4gdGhpcy5fdmlld01vZGVsO1xuXHR9XG5cblx0cHJpdmF0ZSByb290SHRtbEVsZW1lbnQ6IEhUTUxFbGVtZW50IHwgdW5kZWZpbmVkO1xuXHRwcml2YXRlIHJlYWRvbmx5IF9ncmlkID0gdGhpcy5fcmVnaXN0ZXIobmV3IE11dGFibGVEaXNwb3NhYmxlPEdyaWQ8SVZpZXc+PigpKTtcblx0cHJpdmF0ZSByZWFkb25seSBpbnB1dDFWaWV3ID0gdGhpcy5fcmVnaXN0ZXIodGhpcy5pbnN0YW50aWF0aW9uU2VydmljZS5jcmVhdGVJbnN0YW5jZShJbnB1dENvZGVFZGl0b3JWaWV3LCAxLCB0aGlzLl92aWV3TW9kZWwpKTtcblx0cHJpdmF0ZSByZWFkb25seSBiYXNlVmlldyA9IG9ic2VydmFibGVWYWx1ZTxCYXNlQ29kZUVkaXRvclZpZXcgfCB1bmRlZmluZWQ+KHRoaXMsIHVuZGVmaW5lZCk7XG5cdHByaXZhdGUgcmVhZG9ubHkgYmFzZVZpZXdPcHRpb25zID0gb2JzZXJ2YWJsZVZhbHVlPFJlYWRvbmx5PElDb2RlRWRpdG9yT3B0aW9ucz4gfCB1bmRlZmluZWQ+KHRoaXMsIHVuZGVmaW5lZCk7XG5cdHByaXZhdGUgcmVhZG9ubHkgaW5wdXQyVmlldyA9IHRoaXMuX3JlZ2lzdGVyKHRoaXMuaW5zdGFudGlhdGlvblNlcnZpY2UuY3JlYXRlSW5zdGFuY2UoSW5wdXRDb2RlRWRpdG9yVmlldywgMiwgdGhpcy5fdmlld01vZGVsKSk7XG5cblx0cHJpdmF0ZSByZWFkb25seSBpbnB1dFJlc3VsdFZpZXcgPSB0aGlzLl9yZWdpc3Rlcih0aGlzLmluc3RhbnRpYXRpb25TZXJ2aWNlLmNyZWF0ZUluc3RhbmNlKFJlc3VsdENvZGVFZGl0b3JWaWV3LCB0aGlzLl92aWV3TW9kZWwpKTtcblx0cHJpdmF0ZSByZWFkb25seSBfbGF5b3V0TW9kZSA9IHRoaXMuaW5zdGFudGlhdGlvblNlcnZpY2UuY3JlYXRlSW5zdGFuY2UoTWVyZ2VFZGl0b3JMYXlvdXRTdG9yZSk7XG5cdHByaXZhdGUgcmVhZG9ubHkgX2xheW91dE1vZGVPYnMgPSBvYnNlcnZhYmxlVmFsdWUodGhpcywgdGhpcy5fbGF5b3V0TW9kZS52YWx1ZSk7XG5cdHByaXZhdGUgcmVhZG9ubHkgX2N0eElzTWVyZ2VFZGl0b3I6IElDb250ZXh0S2V5PGJvb2xlYW4+ID0gY3R4SXNNZXJnZUVkaXRvci5iaW5kVG8odGhpcy5jb250ZXh0S2V5U2VydmljZSk7XG5cdHByaXZhdGUgcmVhZG9ubHkgX2N0eFVzZXNDb2x1bW5MYXlvdXQ6IElDb250ZXh0S2V5PHN0cmluZz4gPSBjdHhNZXJnZUVkaXRvckxheW91dC5iaW5kVG8odGhpcy5jb250ZXh0S2V5U2VydmljZSk7XG5cdHByaXZhdGUgcmVhZG9ubHkgX2N0eFNob3dCYXNlOiBJQ29udGV4dEtleTxib29sZWFuPiA9IGN0eE1lcmdlRWRpdG9yU2hvd0Jhc2UuYmluZFRvKHRoaXMuY29udGV4dEtleVNlcnZpY2UpO1xuXHRwcml2YXRlIHJlYWRvbmx5IF9jdHhTaG93QmFzZUF0VG9wID0gY3R4TWVyZ2VFZGl0b3JTaG93QmFzZUF0VG9wLmJpbmRUbyh0aGlzLmNvbnRleHRLZXlTZXJ2aWNlKTtcblx0cHJpdmF0ZSByZWFkb25seSBfY3R4UmVzdWx0VXJpOiBJQ29udGV4dEtleTxzdHJpbmc+ID0gY3R4TWVyZ2VSZXN1bHRVcmkuYmluZFRvKHRoaXMuY29udGV4dEtleVNlcnZpY2UpO1xuXHRwcml2YXRlIHJlYWRvbmx5IF9jdHhCYXNlVXJpOiBJQ29udGV4dEtleTxzdHJpbmc+ID0gY3R4TWVyZ2VCYXNlVXJpLmJpbmRUbyh0aGlzLmNvbnRleHRLZXlTZXJ2aWNlKTtcblx0cHJpdmF0ZSByZWFkb25seSBfY3R4U2hvd05vbkNvbmZsaWN0aW5nQ2hhbmdlczogSUNvbnRleHRLZXk8Ym9vbGVhbj4gPSBjdHhNZXJnZUVkaXRvclNob3dOb25Db25mbGljdGluZ0NoYW5nZXMuYmluZFRvKHRoaXMuY29udGV4dEtleVNlcnZpY2UpO1xuXHRwcml2YXRlIHJlYWRvbmx5IF9pbnB1dE1vZGVsID0gb2JzZXJ2YWJsZVZhbHVlPElNZXJnZUVkaXRvcklucHV0TW9kZWwgfCB1bmRlZmluZWQ+KHRoaXMsIHVuZGVmaW5lZCk7XG5cdHB1YmxpYyBnZXQgaW5wdXRNb2RlbCgpOiBJT2JzZXJ2YWJsZTxJTWVyZ2VFZGl0b3JJbnB1dE1vZGVsIHwgdW5kZWZpbmVkPiB7XG5cdFx0cmV0dXJuIHRoaXMuX2lucHV0TW9kZWw7XG5cdH1cblx0cHVibGljIGdldCBtb2RlbCgpOiBNZXJnZUVkaXRvck1vZGVsIHwgdW5kZWZpbmVkIHtcblx0XHRyZXR1cm4gdGhpcy5pbnB1dE1vZGVsLmdldCgpPy5tb2RlbDtcblx0fVxuXG5cdHByaXZhdGUgcmVhZG9ubHkgdmlld1pvbmVDb21wdXRlciA9IG5ldyBWaWV3Wm9uZUNvbXB1dGVyKFxuXHRcdHRoaXMuaW5wdXQxVmlldy5lZGl0b3IsXG5cdFx0dGhpcy5pbnB1dDJWaWV3LmVkaXRvcixcblx0XHR0aGlzLmlucHV0UmVzdWx0Vmlldy5lZGl0b3IsXG5cdCk7XG5cblx0cHJpdmF0ZSByZWFkb25seSBzY3JvbGxTeW5jaHJvbml6ZXIgPSB0aGlzLl9yZWdpc3RlcihuZXcgU2Nyb2xsU3luY2hyb25pemVyKHRoaXMuX3ZpZXdNb2RlbCwgdGhpcy5pbnB1dDFWaWV3LCB0aGlzLmlucHV0MlZpZXcsIHRoaXMuYmFzZVZpZXcsIHRoaXMuaW5wdXRSZXN1bHRWaWV3LCB0aGlzLl9sYXlvdXRNb2RlT2JzKSk7XG5cblx0Y29uc3RydWN0b3IoXG5cdFx0Z3JvdXA6IElFZGl0b3JHcm91cCxcblx0XHRASUluc3RhbnRpYXRpb25TZXJ2aWNlIGluc3RhbnRpYXRpb246IElJbnN0YW50aWF0aW9uU2VydmljZSxcblx0XHRASUNvbnRleHRLZXlTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgY29udGV4dEtleVNlcnZpY2U6IElDb250ZXh0S2V5U2VydmljZSxcblx0XHRASVRlbGVtZXRyeVNlcnZpY2UgdGVsZW1ldHJ5U2VydmljZTogSVRlbGVtZXRyeVNlcnZpY2UsXG5cdFx0QElTdG9yYWdlU2VydmljZSBzdG9yYWdlU2VydmljZTogSVN0b3JhZ2VTZXJ2aWNlLFxuXHRcdEBJVGhlbWVTZXJ2aWNlIHRoZW1lU2VydmljZTogSVRoZW1lU2VydmljZSxcblx0XHRASVRleHRSZXNvdXJjZUNvbmZpZ3VyYXRpb25TZXJ2aWNlIHRleHRSZXNvdXJjZUNvbmZpZ3VyYXRpb25TZXJ2aWNlOiBJVGV4dFJlc291cmNlQ29uZmlndXJhdGlvblNlcnZpY2UsXG5cdFx0QElFZGl0b3JTZXJ2aWNlIGVkaXRvclNlcnZpY2U6IElFZGl0b3JTZXJ2aWNlLFxuXHRcdEBJRWRpdG9yR3JvdXBzU2VydmljZSBlZGl0b3JHcm91cFNlcnZpY2U6IElFZGl0b3JHcm91cHNTZXJ2aWNlLFxuXHRcdEBJRmlsZVNlcnZpY2UgZmlsZVNlcnZpY2U6IElGaWxlU2VydmljZSxcblx0XHRASUNvZGVFZGl0b3JTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgX2NvZGVFZGl0b3JTZXJ2aWNlOiBJQ29kZUVkaXRvclNlcnZpY2Vcblx0KSB7XG5cdFx0c3VwZXIoTWVyZ2VFZGl0b3IuSUQsIGdyb3VwLCB0ZWxlbWV0cnlTZXJ2aWNlLCBpbnN0YW50aWF0aW9uLCBzdG9yYWdlU2VydmljZSwgdGV4dFJlc291cmNlQ29uZmlndXJhdGlvblNlcnZpY2UsIHRoZW1lU2VydmljZSwgZWRpdG9yU2VydmljZSwgZWRpdG9yR3JvdXBTZXJ2aWNlLCBmaWxlU2VydmljZSk7XG5cdH1cblxuXHRvdmVycmlkZSBkaXNwb3NlKCk6IHZvaWQge1xuXHRcdHRoaXMuX3Nlc3Npb25EaXNwb3NhYmxlcy5kaXNwb3NlKCk7XG5cdFx0dGhpcy5fY3R4SXNNZXJnZUVkaXRvci5yZXNldCgpO1xuXHRcdHRoaXMuX2N0eFVzZXNDb2x1bW5MYXlvdXQucmVzZXQoKTtcblx0XHR0aGlzLl9jdHhTaG93Tm9uQ29uZmxpY3RpbmdDaGFuZ2VzLnJlc2V0KCk7XG5cdFx0c3VwZXIuZGlzcG9zZSgpO1xuXHR9XG5cblx0Ly8gI3JlZ2lvbiBsYXlvdXQgY29uc3RyYWludHNcblxuXHRwcml2YXRlIHJlYWRvbmx5IF9vbkRpZENoYW5nZVNpemVDb25zdHJhaW50cyA9IG5ldyBFbWl0dGVyPHZvaWQ+KCk7XG5cdG92ZXJyaWRlIHJlYWRvbmx5IG9uRGlkQ2hhbmdlU2l6ZUNvbnN0cmFpbnRzOiBFdmVudDx2b2lkPiA9IHRoaXMuX29uRGlkQ2hhbmdlU2l6ZUNvbnN0cmFpbnRzLmV2ZW50O1xuXG5cdG92ZXJyaWRlIGdldCBtaW5pbXVtV2lkdGgoKSB7XG5cdFx0cmV0dXJuIHRoaXMuX2xheW91dE1vZGUudmFsdWUua2luZCA9PT0gJ21peGVkJ1xuXHRcdFx0PyB0aGlzLmlucHV0MVZpZXcudmlldy5taW5pbXVtV2lkdGggKyB0aGlzLmlucHV0MlZpZXcudmlldy5taW5pbXVtV2lkdGhcblx0XHRcdDogdGhpcy5pbnB1dDFWaWV3LnZpZXcubWluaW11bVdpZHRoICsgdGhpcy5pbnB1dDJWaWV3LnZpZXcubWluaW11bVdpZHRoICsgdGhpcy5pbnB1dFJlc3VsdFZpZXcudmlldy5taW5pbXVtV2lkdGg7XG5cdH1cblxuXHQvLyAjZW5kcmVnaW9uXG5cblx0b3ZlcnJpZGUgZ2V0VGl0bGUoKTogc3RyaW5nIHtcblx0XHRpZiAodGhpcy5pbnB1dCkge1xuXHRcdFx0cmV0dXJuIHRoaXMuaW5wdXQuZ2V0TmFtZSgpO1xuXHRcdH1cblxuXHRcdHJldHVybiBsb2NhbGl6ZSgnbWVyZ2VFZGl0b3InLCBcIlRleHQgTWVyZ2UgRWRpdG9yXCIpO1xuXHR9XG5cblx0cHJvdGVjdGVkIGNyZWF0ZUVkaXRvckNvbnRyb2wocGFyZW50OiBIVE1MRWxlbWVudCwgaW5pdGlhbE9wdGlvbnM6IElDb2RlRWRpdG9yT3B0aW9ucyk6IHZvaWQge1xuXHRcdHRoaXMucm9vdEh0bWxFbGVtZW50ID0gcGFyZW50O1xuXHRcdHBhcmVudC5jbGFzc0xpc3QuYWRkKCdtZXJnZS1lZGl0b3InKTtcblx0XHR0aGlzLmFwcGx5TGF5b3V0KHRoaXMuX2xheW91dE1vZGUudmFsdWUpO1xuXHRcdHRoaXMuYXBwbHlPcHRpb25zKGluaXRpYWxPcHRpb25zKTtcblx0fVxuXG5cdHByb3RlY3RlZCB1cGRhdGVFZGl0b3JDb250cm9sT3B0aW9ucyhvcHRpb25zOiBJQ29kZUVkaXRvck9wdGlvbnMpOiB2b2lkIHtcblx0XHR0aGlzLmFwcGx5T3B0aW9ucyhvcHRpb25zKTtcblx0fVxuXG5cdHByaXZhdGUgYXBwbHlPcHRpb25zKG9wdGlvbnM6IElDb2RlRWRpdG9yT3B0aW9ucyk6IHZvaWQge1xuXHRcdGNvbnN0IGlucHV0T3B0aW9uczogSUNvZGVFZGl0b3JPcHRpb25zID0gZGVlcE1lcmdlPElDb2RlRWRpdG9yT3B0aW9ucz4ob3B0aW9ucywge1xuXHRcdFx0bWluaW1hcDogeyBlbmFibGVkOiBmYWxzZSB9LFxuXHRcdFx0Z2x5cGhNYXJnaW46IGZhbHNlLFxuXHRcdFx0bGluZU51bWJlcnNNaW5DaGFyczogMlxuXHRcdH0pO1xuXG5cdFx0Y29uc3QgcmVhZE9ubHlJbnB1dE9wdGlvbnM6IElDb2RlRWRpdG9yT3B0aW9ucyA9IGRlZXBNZXJnZTxJQ29kZUVkaXRvck9wdGlvbnM+KGlucHV0T3B0aW9ucywge1xuXHRcdFx0cmVhZE9ubHk6IHRydWUsXG5cdFx0XHRyZWFkT25seU1lc3NhZ2U6IHVuZGVmaW5lZFxuXHRcdH0pO1xuXG5cdFx0dGhpcy5pbnB1dDFWaWV3LnVwZGF0ZU9wdGlvbnMocmVhZE9ubHlJbnB1dE9wdGlvbnMpO1xuXHRcdHRoaXMuaW5wdXQyVmlldy51cGRhdGVPcHRpb25zKHJlYWRPbmx5SW5wdXRPcHRpb25zKTtcblx0XHR0aGlzLmJhc2VWaWV3T3B0aW9ucy5zZXQoeyAuLi50aGlzLmlucHV0MlZpZXcuZWRpdG9yLmdldFJhd09wdGlvbnMoKSB9LCB1bmRlZmluZWQpO1xuXHRcdHRoaXMuaW5wdXRSZXN1bHRWaWV3LnVwZGF0ZU9wdGlvbnMoaW5wdXRPcHRpb25zKTtcblx0fVxuXG5cdHByb3RlY3RlZCBnZXRNYWluQ29udHJvbCgpOiBJQ29kZUVkaXRvciB8IHVuZGVmaW5lZCB7XG5cdFx0cmV0dXJuIHRoaXMuaW5wdXRSZXN1bHRWaWV3LmVkaXRvcjtcblx0fVxuXG5cdGxheW91dChkaW1lbnNpb246IERpbWVuc2lvbik6IHZvaWQge1xuXHRcdHRoaXMuX2dyaWQudmFsdWU/LmxheW91dChkaW1lbnNpb24ud2lkdGgsIGRpbWVuc2lvbi5oZWlnaHQpO1xuXHR9XG5cblx0b3ZlcnJpZGUgYXN5bmMgc2V0SW5wdXQoaW5wdXQ6IEVkaXRvcklucHV0LCBvcHRpb25zOiBJRWRpdG9yT3B0aW9ucyB8IHVuZGVmaW5lZCwgY29udGV4dDogSUVkaXRvck9wZW5Db250ZXh0LCB0b2tlbjogQ2FuY2VsbGF0aW9uVG9rZW4pOiBQcm9taXNlPHZvaWQ+IHtcblx0XHRpZiAoIShpbnB1dCBpbnN0YW5jZW9mIE1lcmdlRWRpdG9ySW5wdXQpKSB7XG5cdFx0XHR0aHJvdyBuZXcgQnVnSW5kaWNhdGluZ0Vycm9yKCdPTkxZIE1lcmdlRWRpdG9ySW5wdXQgaXMgc3VwcG9ydGVkJyk7XG5cdFx0fVxuXHRcdGF3YWl0IHN1cGVyLnNldElucHV0KGlucHV0LCBvcHRpb25zLCBjb250ZXh0LCB0b2tlbik7XG5cblx0XHR0aGlzLl9zZXNzaW9uRGlzcG9zYWJsZXMuY2xlYXIoKTtcblx0XHR0cmFuc2FjdGlvbih0eCA9PiB7XG5cdFx0XHR0aGlzLl92aWV3TW9kZWwuc2V0KHVuZGVmaW5lZCwgdHgpO1xuXHRcdFx0dGhpcy5faW5wdXRNb2RlbC5zZXQodW5kZWZpbmVkLCB0eCk7XG5cdFx0fSk7XG5cblx0XHRjb25zdCBpbnB1dE1vZGVsID0gYXdhaXQgaW5wdXQucmVzb2x2ZSgpO1xuXHRcdGNvbnN0IG1vZGVsID0gaW5wdXRNb2RlbC5tb2RlbDtcblxuXHRcdGNvbnN0IHZpZXdNb2RlbCA9IHRoaXMuaW5zdGFudGlhdGlvblNlcnZpY2UuY3JlYXRlSW5zdGFuY2UoXG5cdFx0XHRNZXJnZUVkaXRvclZpZXdNb2RlbCxcblx0XHRcdG1vZGVsLFxuXHRcdFx0dGhpcy5pbnB1dDFWaWV3LFxuXHRcdFx0dGhpcy5pbnB1dDJWaWV3LFxuXHRcdFx0dGhpcy5pbnB1dFJlc3VsdFZpZXcsXG5cdFx0XHR0aGlzLmJhc2VWaWV3LFxuXHRcdFx0dGhpcy5zaG93Tm9uQ29uZmxpY3RpbmdDaGFuZ2VzLFxuXHRcdCk7XG5cblx0XHRtb2RlbC50ZWxlbWV0cnkucmVwb3J0TWVyZ2VFZGl0b3JPcGVuZWQoe1xuXHRcdFx0Y29tYmluYWJsZUNvbmZsaWN0Q291bnQ6IG1vZGVsLmNvbWJpbmFibGVDb25mbGljdENvdW50LFxuXHRcdFx0Y29uZmxpY3RDb3VudDogbW9kZWwuY29uZmxpY3RDb3VudCxcblxuXHRcdFx0YmFzZVRvcDogdGhpcy5fbGF5b3V0TW9kZU9icy5nZXQoKS5zaG93QmFzZUF0VG9wLFxuXHRcdFx0YmFzZVZpc2libGU6IHRoaXMuX2xheW91dE1vZGVPYnMuZ2V0KCkuc2hvd0Jhc2UsXG5cdFx0XHRpc0NvbHVtblZpZXc6IHRoaXMuX2xheW91dE1vZGVPYnMuZ2V0KCkua2luZCA9PT0gJ2NvbHVtbnMnLFxuXHRcdH0pO1xuXG5cdFx0dHJhbnNhY3Rpb24odHggPT4ge1xuXHRcdFx0dGhpcy5fdmlld01vZGVsLnNldCh2aWV3TW9kZWwsIHR4KTtcblx0XHRcdHRoaXMuX2lucHV0TW9kZWwuc2V0KGlucHV0TW9kZWwsIHR4KTtcblx0XHR9KTtcblx0XHR0aGlzLl9zZXNzaW9uRGlzcG9zYWJsZXMuYWRkKHZpZXdNb2RlbCk7XG5cblx0XHQvLyBTZXQvdW5zZXQgY29udGV4dCBrZXlzIGJhc2VkIG9uIGlucHV0XG5cdFx0dGhpcy5fY3R4UmVzdWx0VXJpLnNldChpbnB1dE1vZGVsLnJlc3VsdFVyaS50b1N0cmluZygpKTtcblx0XHR0aGlzLl9jdHhCYXNlVXJpLnNldChtb2RlbC5iYXNlLnVyaS50b1N0cmluZygpKTtcblx0XHR0aGlzLl9zZXNzaW9uRGlzcG9zYWJsZXMuYWRkKHRvRGlzcG9zYWJsZSgoKSA9PiB7XG5cdFx0XHR0aGlzLl9jdHhCYXNlVXJpLnJlc2V0KCk7XG5cdFx0XHR0aGlzLl9jdHhSZXN1bHRVcmkucmVzZXQoKTtcblx0XHR9KSk7XG5cblx0XHQvLyBTZXQgdGhlIHZpZXcgem9uZXMgYmVmb3JlIHJlc3RvcmluZyB2aWV3IHN0YXRlIVxuXHRcdC8vIE90aGVyd2lzZSBzY3JvbGxpbmcgd2lsbCBiZSBvZmZcblx0XHR0aGlzLl9zZXNzaW9uRGlzcG9zYWJsZXMuYWRkKGF1dG9ydW5XaXRoU3RvcmUoKHJlYWRlciwgc3RvcmUpID0+IHtcblx0XHRcdC8qKiBAZGVzY3JpcHRpb24gdXBkYXRlIGFsaWdubWVudCB2aWV3IHpvbmVzICovXG5cdFx0XHRjb25zdCBiYXNlVmlldyA9IHRoaXMuYmFzZVZpZXcucmVhZChyZWFkZXIpO1xuXG5cdFx0XHR0aGlzLmlucHV0UmVzdWx0Vmlldy5lZGl0b3IuY2hhbmdlVmlld1pvbmVzKHJlc3VsdFZpZXdab25lQWNjZXNzb3IgPT4ge1xuXHRcdFx0XHRjb25zdCBsYXlvdXQgPSB0aGlzLl9sYXlvdXRNb2RlT2JzLnJlYWQocmVhZGVyKTtcblx0XHRcdFx0Y29uc3Qgc2hvdWxkQWxpZ25SZXN1bHQgPSBsYXlvdXQua2luZCA9PT0gJ2NvbHVtbnMnO1xuXHRcdFx0XHRjb25zdCBzaG91bGRBbGlnbkJhc2UgPSBsYXlvdXQua2luZCA9PT0gJ21peGVkJyAmJiAhbGF5b3V0LnNob3dCYXNlQXRUb3A7XG5cblx0XHRcdFx0dGhpcy5pbnB1dDFWaWV3LmVkaXRvci5jaGFuZ2VWaWV3Wm9uZXMoaW5wdXQxVmlld1pvbmVBY2Nlc3NvciA9PiB7XG5cdFx0XHRcdFx0dGhpcy5pbnB1dDJWaWV3LmVkaXRvci5jaGFuZ2VWaWV3Wm9uZXMoaW5wdXQyVmlld1pvbmVBY2Nlc3NvciA9PiB7XG5cdFx0XHRcdFx0XHRpZiAoYmFzZVZpZXcpIHtcblx0XHRcdFx0XHRcdFx0YmFzZVZpZXcuZWRpdG9yLmNoYW5nZVZpZXdab25lcyhiYXNlVmlld1pvbmVBY2Nlc3NvciA9PiB7XG5cdFx0XHRcdFx0XHRcdFx0c3RvcmUuYWRkKHRoaXMuc2V0Vmlld1pvbmVzKHJlYWRlcixcblx0XHRcdFx0XHRcdFx0XHRcdHZpZXdNb2RlbCxcblx0XHRcdFx0XHRcdFx0XHRcdHRoaXMuaW5wdXQxVmlldy5lZGl0b3IsXG5cdFx0XHRcdFx0XHRcdFx0XHRpbnB1dDFWaWV3Wm9uZUFjY2Vzc29yLFxuXHRcdFx0XHRcdFx0XHRcdFx0dGhpcy5pbnB1dDJWaWV3LmVkaXRvcixcblx0XHRcdFx0XHRcdFx0XHRcdGlucHV0MlZpZXdab25lQWNjZXNzb3IsXG5cdFx0XHRcdFx0XHRcdFx0XHRiYXNlVmlldy5lZGl0b3IsXG5cdFx0XHRcdFx0XHRcdFx0XHRiYXNlVmlld1pvbmVBY2Nlc3Nvcixcblx0XHRcdFx0XHRcdFx0XHRcdHNob3VsZEFsaWduQmFzZSxcblx0XHRcdFx0XHRcdFx0XHRcdHRoaXMuaW5wdXRSZXN1bHRWaWV3LmVkaXRvcixcblx0XHRcdFx0XHRcdFx0XHRcdHJlc3VsdFZpZXdab25lQWNjZXNzb3IsXG5cdFx0XHRcdFx0XHRcdFx0XHRzaG91bGRBbGlnblJlc3VsdFxuXHRcdFx0XHRcdFx0XHRcdCkpO1xuXHRcdFx0XHRcdFx0XHR9KTtcblx0XHRcdFx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdFx0XHRcdHN0b3JlLmFkZCh0aGlzLnNldFZpZXdab25lcyhyZWFkZXIsXG5cdFx0XHRcdFx0XHRcdFx0dmlld01vZGVsLFxuXHRcdFx0XHRcdFx0XHRcdHRoaXMuaW5wdXQxVmlldy5lZGl0b3IsXG5cdFx0XHRcdFx0XHRcdFx0aW5wdXQxVmlld1pvbmVBY2Nlc3Nvcixcblx0XHRcdFx0XHRcdFx0XHR0aGlzLmlucHV0MlZpZXcuZWRpdG9yLFxuXHRcdFx0XHRcdFx0XHRcdGlucHV0MlZpZXdab25lQWNjZXNzb3IsXG5cdFx0XHRcdFx0XHRcdFx0dW5kZWZpbmVkLFxuXHRcdFx0XHRcdFx0XHRcdHVuZGVmaW5lZCxcblx0XHRcdFx0XHRcdFx0XHRmYWxzZSxcblx0XHRcdFx0XHRcdFx0XHR0aGlzLmlucHV0UmVzdWx0Vmlldy5lZGl0b3IsXG5cdFx0XHRcdFx0XHRcdFx0cmVzdWx0Vmlld1pvbmVBY2Nlc3Nvcixcblx0XHRcdFx0XHRcdFx0XHRzaG91bGRBbGlnblJlc3VsdFxuXHRcdFx0XHRcdFx0XHQpKTtcblx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHR9KTtcblx0XHRcdFx0fSk7XG5cdFx0XHR9KTtcblxuXHRcdFx0dGhpcy5zY3JvbGxTeW5jaHJvbml6ZXIudXBkYXRlU2Nyb2xsaW5nKCk7XG5cdFx0fSkpO1xuXG5cdFx0Y29uc3Qgdmlld1N0YXRlID0gdGhpcy5sb2FkRWRpdG9yVmlld1N0YXRlKGlucHV0LCBjb250ZXh0KTtcblx0XHRpZiAodmlld1N0YXRlKSB7XG5cdFx0XHR0aGlzLl9hcHBseVZpZXdTdGF0ZSh2aWV3U3RhdGUpO1xuXHRcdH0gZWxzZSB7XG5cdFx0XHR0aGlzLl9zZXNzaW9uRGlzcG9zYWJsZXMuYWRkKHRoZW5JZk5vdERpc3Bvc2VkKG1vZGVsLm9uSW5pdGlhbGl6ZWQsICgpID0+IHtcblx0XHRcdFx0Y29uc3QgZmlyc3RDb25mbGljdCA9IG1vZGVsLm1vZGlmaWVkQmFzZVJhbmdlcy5nZXQoKS5maW5kKHIgPT4gci5pc0NvbmZsaWN0aW5nKTtcblx0XHRcdFx0aWYgKCFmaXJzdENvbmZsaWN0KSB7XG5cdFx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0XHR9XG5cdFx0XHRcdHRoaXMuaW5wdXQxVmlldy5lZGl0b3IucmV2ZWFsTGluZUluQ2VudGVyKGZpcnN0Q29uZmxpY3QuaW5wdXQxUmFuZ2Uuc3RhcnRMaW5lTnVtYmVyKTtcblx0XHRcdFx0dHJhbnNhY3Rpb24odHggPT4ge1xuXHRcdFx0XHRcdC8qKiBAZGVzY3JpcHRpb24gc2V0QWN0aXZlTW9kaWZpZWRCYXNlUmFuZ2UgKi9cblx0XHRcdFx0XHR2aWV3TW9kZWwuc2V0QWN0aXZlTW9kaWZpZWRCYXNlUmFuZ2UoZmlyc3RDb25mbGljdCwgdHgpO1xuXHRcdFx0XHR9KTtcblx0XHRcdH0pKTtcblx0XHR9XG5cblx0XHQvLyB3b3JkIHdyYXAgc3BlY2lhbCBjYXNlIC0gc3luYyB0cmFuc2llbnQgc3RhdGUgZnJvbSByZXN1bHQgbW9kZWwgdG8gaW5wdXRbMXwyXSBtb2RlbHNcblx0XHRjb25zdCBtaXJyb3JXb3JkV3JhcFRyYW5zaWVudFN0YXRlID0gKGNhbmRpZGF0ZTogSVRleHRNb2RlbCkgPT4ge1xuXHRcdFx0Y29uc3QgY2FuZGlkYXRlU3RhdGUgPSByZWFkVHJhbnNpZW50U3RhdGUoY2FuZGlkYXRlLCB0aGlzLl9jb2RlRWRpdG9yU2VydmljZSk7XG5cblx0XHRcdHdyaXRlVHJhbnNpZW50U3RhdGUobW9kZWwuaW5wdXQyLnRleHRNb2RlbCwgY2FuZGlkYXRlU3RhdGUsIHRoaXMuX2NvZGVFZGl0b3JTZXJ2aWNlKTtcblx0XHRcdHdyaXRlVHJhbnNpZW50U3RhdGUobW9kZWwuaW5wdXQxLnRleHRNb2RlbCwgY2FuZGlkYXRlU3RhdGUsIHRoaXMuX2NvZGVFZGl0b3JTZXJ2aWNlKTtcblx0XHRcdHdyaXRlVHJhbnNpZW50U3RhdGUobW9kZWwucmVzdWx0VGV4dE1vZGVsLCBjYW5kaWRhdGVTdGF0ZSwgdGhpcy5fY29kZUVkaXRvclNlcnZpY2UpO1xuXG5cdFx0XHRjb25zdCBiYXNlVGV4dE1vZGVsID0gdGhpcy5iYXNlVmlldy5nZXQoKT8uZWRpdG9yLmdldE1vZGVsKCk7XG5cdFx0XHRpZiAoYmFzZVRleHRNb2RlbCkge1xuXHRcdFx0XHR3cml0ZVRyYW5zaWVudFN0YXRlKGJhc2VUZXh0TW9kZWwsIGNhbmRpZGF0ZVN0YXRlLCB0aGlzLl9jb2RlRWRpdG9yU2VydmljZSk7XG5cdFx0XHR9XG5cdFx0fTtcblx0XHR0aGlzLl9zZXNzaW9uRGlzcG9zYWJsZXMuYWRkKHRoaXMuX2NvZGVFZGl0b3JTZXJ2aWNlLm9uRGlkQ2hhbmdlVHJhbnNpZW50TW9kZWxQcm9wZXJ0eShjYW5kaWRhdGUgPT4ge1xuXHRcdFx0bWlycm9yV29yZFdyYXBUcmFuc2llbnRTdGF0ZShjYW5kaWRhdGUpO1xuXHRcdH0pKTtcblx0XHRtaXJyb3JXb3JkV3JhcFRyYW5zaWVudFN0YXRlKHRoaXMuaW5wdXRSZXN1bHRWaWV3LmVkaXRvci5nZXRNb2RlbCgpISk7XG5cblx0XHQvLyBkZXRlY3Qgd2hlbiBiYXNlLCBpbnB1dDEsIGFuZCBpbnB1dDIgYmVjb21lIGVtcHR5IGFuZCByZXBsYWNlIFRISVMgZWRpdG9yIHdpdGggaXRzIHJlc3VsdCBlZGl0b3Jcblx0XHQvLyBUT0RPQGpyaWVrZW5AaGVkaWV0IHRoaXMgbmVlZHMgYSBiZXR0ZXIvY2xlYW5lciBzb2x1dGlvblxuXHRcdC8vIGh0dHBzOi8vZ2l0aHViLmNvbS9taWNyb3NvZnQvdnNjb2RlL2lzc3Vlcy8xNTU5NDBcblx0XHRjb25zdCB0aGF0ID0gdGhpcztcblx0XHR0aGlzLl9zZXNzaW9uRGlzcG9zYWJsZXMuYWRkKG5ldyBjbGFzcyB7XG5cblx0XHRcdHByaXZhdGUgcmVhZG9ubHkgX2Rpc3Bvc2FibGUgPSBuZXcgRGlzcG9zYWJsZVN0b3JlKCk7XG5cblx0XHRcdGNvbnN0cnVjdG9yKCkge1xuXHRcdFx0XHRmb3IgKGNvbnN0IG1vZGVsIG9mIHRoaXMuYmFzZUlucHV0MUlucHV0MigpKSB7XG5cdFx0XHRcdFx0dGhpcy5fZGlzcG9zYWJsZS5hZGQobW9kZWwub25EaWRDaGFuZ2VDb250ZW50KCgpID0+IHRoaXMuX2NoZWNrQmFzZUlucHV0MUlucHV0MkFsbEVtcHR5KCkpKTtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXG5cdFx0XHRkaXNwb3NlKCkge1xuXHRcdFx0XHR0aGlzLl9kaXNwb3NhYmxlLmRpc3Bvc2UoKTtcblx0XHRcdH1cblxuXHRcdFx0cHJpdmF0ZSAqYmFzZUlucHV0MUlucHV0MigpIHtcblx0XHRcdFx0eWllbGQgbW9kZWwuYmFzZTtcblx0XHRcdFx0eWllbGQgbW9kZWwuaW5wdXQxLnRleHRNb2RlbDtcblx0XHRcdFx0eWllbGQgbW9kZWwuaW5wdXQyLnRleHRNb2RlbDtcblx0XHRcdH1cblxuXHRcdFx0cHJpdmF0ZSBfY2hlY2tCYXNlSW5wdXQxSW5wdXQyQWxsRW1wdHkoKSB7XG5cdFx0XHRcdGZvciAoY29uc3QgbW9kZWwgb2YgdGhpcy5iYXNlSW5wdXQxSW5wdXQyKCkpIHtcblx0XHRcdFx0XHRpZiAobW9kZWwuZ2V0VmFsdWVMZW5ndGgoKSA+IDApIHtcblx0XHRcdFx0XHRcdHJldHVybjtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdH1cblx0XHRcdFx0Ly8gYWxsIGVtcHR5IC0+IHJlcGxhY2UgdGhpcyBlZGl0b3Igd2l0aCBhIG5vcm1hbCBlZGl0b3IgZm9yIHJlc3VsdFxuXHRcdFx0XHR0aGF0LmVkaXRvclNlcnZpY2UucmVwbGFjZUVkaXRvcnMoXG5cdFx0XHRcdFx0W3sgZWRpdG9yOiBpbnB1dCwgcmVwbGFjZW1lbnQ6IHsgcmVzb3VyY2U6IGlucHV0LnJlc3VsdCwgb3B0aW9uczogeyBwcmVzZXJ2ZUZvY3VzOiB0cnVlIH0gfSwgZm9yY2VSZXBsYWNlRGlydHk6IHRydWUgfV0sXG5cdFx0XHRcdFx0dGhhdC5ncm91cFxuXHRcdFx0XHQpO1xuXHRcdFx0fVxuXHRcdH0pO1xuXHR9XG5cblx0cHJpdmF0ZSBzZXRWaWV3Wm9uZXMoXG5cdFx0cmVhZGVyOiBJUmVhZGVyLFxuXHRcdHZpZXdNb2RlbDogTWVyZ2VFZGl0b3JWaWV3TW9kZWwsXG5cdFx0aW5wdXQxRWRpdG9yOiBJQ29kZUVkaXRvcixcblx0XHRpbnB1dDFWaWV3Wm9uZUFjY2Vzc29yOiBJVmlld1pvbmVDaGFuZ2VBY2Nlc3Nvcixcblx0XHRpbnB1dDJFZGl0b3I6IElDb2RlRWRpdG9yLFxuXHRcdGlucHV0MlZpZXdab25lQWNjZXNzb3I6IElWaWV3Wm9uZUNoYW5nZUFjY2Vzc29yLFxuXHRcdGJhc2VFZGl0b3I6IElDb2RlRWRpdG9yIHwgdW5kZWZpbmVkLFxuXHRcdGJhc2VWaWV3Wm9uZUFjY2Vzc29yOiBJVmlld1pvbmVDaGFuZ2VBY2Nlc3NvciB8IHVuZGVmaW5lZCxcblx0XHRzaG91bGRBbGlnbkJhc2U6IGJvb2xlYW4sXG5cdFx0cmVzdWx0RWRpdG9yOiBJQ29kZUVkaXRvcixcblx0XHRyZXN1bHRWaWV3Wm9uZUFjY2Vzc29yOiBJVmlld1pvbmVDaGFuZ2VBY2Nlc3Nvcixcblx0XHRzaG91bGRBbGlnblJlc3VsdDogYm9vbGVhbixcblx0KTogSURpc3Bvc2FibGUge1xuXHRcdGNvbnN0IGlucHV0MVZpZXdab25lSWRzOiBzdHJpbmdbXSA9IFtdO1xuXHRcdGNvbnN0IGlucHV0MlZpZXdab25lSWRzOiBzdHJpbmdbXSA9IFtdO1xuXHRcdGNvbnN0IGJhc2VWaWV3Wm9uZUlkczogc3RyaW5nW10gPSBbXTtcblx0XHRjb25zdCByZXN1bHRWaWV3Wm9uZUlkczogc3RyaW5nW10gPSBbXTtcblxuXHRcdGNvbnN0IHZpZXdab25lcyA9IHRoaXMudmlld1pvbmVDb21wdXRlci5jb21wdXRlVmlld1pvbmVzKHJlYWRlciwgdmlld01vZGVsLCB7XG5cdFx0XHRjb2RlTGVuc2VzVmlzaWJsZTogdHJ1ZSxcblx0XHRcdHNob3dOb25Db25mbGljdGluZ0NoYW5nZXM6IHRoaXMuc2hvd05vbkNvbmZsaWN0aW5nQ2hhbmdlcy5yZWFkKHJlYWRlciksXG5cdFx0XHRzaG91bGRBbGlnbkJhc2UsXG5cdFx0XHRzaG91bGRBbGlnblJlc3VsdCxcblx0XHR9KTtcblxuXHRcdGNvbnN0IGRpc3Bvc2FibGVTdG9yZSA9IG5ldyBEaXNwb3NhYmxlU3RvcmUoKTtcblxuXHRcdGlmIChiYXNlVmlld1pvbmVBY2Nlc3Nvcikge1xuXHRcdFx0Zm9yIChjb25zdCB2IG9mIHZpZXdab25lcy5iYXNlVmlld1pvbmVzKSB7XG5cdFx0XHRcdHYuY3JlYXRlKGJhc2VWaWV3Wm9uZUFjY2Vzc29yLCBiYXNlVmlld1pvbmVJZHMsIGRpc3Bvc2FibGVTdG9yZSk7XG5cdFx0XHR9XG5cdFx0fVxuXG5cdFx0Zm9yIChjb25zdCB2IG9mIHZpZXdab25lcy5yZXN1bHRWaWV3Wm9uZXMpIHtcblx0XHRcdHYuY3JlYXRlKHJlc3VsdFZpZXdab25lQWNjZXNzb3IsIHJlc3VsdFZpZXdab25lSWRzLCBkaXNwb3NhYmxlU3RvcmUpO1xuXHRcdH1cblxuXHRcdGZvciAoY29uc3QgdiBvZiB2aWV3Wm9uZXMuaW5wdXQxVmlld1pvbmVzKSB7XG5cdFx0XHR2LmNyZWF0ZShpbnB1dDFWaWV3Wm9uZUFjY2Vzc29yLCBpbnB1dDFWaWV3Wm9uZUlkcywgZGlzcG9zYWJsZVN0b3JlKTtcblx0XHR9XG5cblx0XHRmb3IgKGNvbnN0IHYgb2Ygdmlld1pvbmVzLmlucHV0MlZpZXdab25lcykge1xuXHRcdFx0di5jcmVhdGUoaW5wdXQyVmlld1pvbmVBY2Nlc3NvciwgaW5wdXQyVmlld1pvbmVJZHMsIGRpc3Bvc2FibGVTdG9yZSk7XG5cdFx0fVxuXG5cdFx0ZGlzcG9zYWJsZVN0b3JlLmFkZCh7XG5cdFx0XHRkaXNwb3NlOiAoKSA9PiB7XG5cdFx0XHRcdGlucHV0MUVkaXRvci5jaGFuZ2VWaWV3Wm9uZXMoYSA9PiB7XG5cdFx0XHRcdFx0Zm9yIChjb25zdCB6b25lIG9mIGlucHV0MVZpZXdab25lSWRzKSB7XG5cdFx0XHRcdFx0XHRhLnJlbW92ZVpvbmUoem9uZSk7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9KTtcblx0XHRcdFx0aW5wdXQyRWRpdG9yLmNoYW5nZVZpZXdab25lcyhhID0+IHtcblx0XHRcdFx0XHRmb3IgKGNvbnN0IHpvbmUgb2YgaW5wdXQyVmlld1pvbmVJZHMpIHtcblx0XHRcdFx0XHRcdGEucmVtb3ZlWm9uZSh6b25lKTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdH0pO1xuXHRcdFx0XHRiYXNlRWRpdG9yPy5jaGFuZ2VWaWV3Wm9uZXMoYSA9PiB7XG5cdFx0XHRcdFx0Zm9yIChjb25zdCB6b25lIG9mIGJhc2VWaWV3Wm9uZUlkcykge1xuXHRcdFx0XHRcdFx0YS5yZW1vdmVab25lKHpvbmUpO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0fSk7XG5cdFx0XHRcdHJlc3VsdEVkaXRvci5jaGFuZ2VWaWV3Wm9uZXMoYSA9PiB7XG5cdFx0XHRcdFx0Zm9yIChjb25zdCB6b25lIG9mIHJlc3VsdFZpZXdab25lSWRzKSB7XG5cdFx0XHRcdFx0XHRhLnJlbW92ZVpvbmUoem9uZSk7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9KTtcblx0XHRcdH1cblx0XHR9KTtcblxuXHRcdHJldHVybiBkaXNwb3NhYmxlU3RvcmU7XG5cdH1cblxuXHRvdmVycmlkZSBzZXRPcHRpb25zKG9wdGlvbnM6IElUZXh0RWRpdG9yT3B0aW9ucyB8IHVuZGVmaW5lZCk6IHZvaWQge1xuXHRcdHN1cGVyLnNldE9wdGlvbnMob3B0aW9ucyk7XG5cblx0XHRpZiAob3B0aW9ucykge1xuXHRcdFx0YXBwbHlUZXh0RWRpdG9yT3B0aW9ucyhvcHRpb25zLCB0aGlzLmlucHV0UmVzdWx0Vmlldy5lZGl0b3IsIFNjcm9sbFR5cGUuU21vb3RoKTtcblx0XHR9XG5cdH1cblxuXHRvdmVycmlkZSBjbGVhcklucHV0KCk6IHZvaWQge1xuXHRcdHN1cGVyLmNsZWFySW5wdXQoKTtcblxuXHRcdHRoaXMuX3Nlc3Npb25EaXNwb3NhYmxlcy5jbGVhcigpO1xuXG5cdFx0Zm9yIChjb25zdCB7IGVkaXRvciB9IG9mIFt0aGlzLmlucHV0MVZpZXcsIHRoaXMuaW5wdXQyVmlldywgdGhpcy5pbnB1dFJlc3VsdFZpZXddKSB7XG5cdFx0XHRlZGl0b3Iuc2V0TW9kZWwobnVsbCk7XG5cdFx0fVxuXHR9XG5cblx0b3ZlcnJpZGUgZm9jdXMoKTogdm9pZCB7XG5cdFx0c3VwZXIuZm9jdXMoKTtcblxuXHRcdCh0aGlzLmdldENvbnRyb2woKSA/PyB0aGlzLmlucHV0UmVzdWx0Vmlldy5lZGl0b3IpLmZvY3VzKCk7XG5cdH1cblxuXHRvdmVycmlkZSBoYXNGb2N1cygpOiBib29sZWFuIHtcblx0XHRmb3IgKGNvbnN0IHsgZWRpdG9yIH0gb2YgW3RoaXMuaW5wdXQxVmlldywgdGhpcy5pbnB1dDJWaWV3LCB0aGlzLmlucHV0UmVzdWx0Vmlld10pIHtcblx0XHRcdGlmIChlZGl0b3IuaGFzVGV4dEZvY3VzKCkpIHtcblx0XHRcdFx0cmV0dXJuIHRydWU7XG5cdFx0XHR9XG5cdFx0fVxuXHRcdHJldHVybiBzdXBlci5oYXNGb2N1cygpO1xuXHR9XG5cblx0cHJvdGVjdGVkIG92ZXJyaWRlIHNldEVkaXRvclZpc2libGUodmlzaWJsZTogYm9vbGVhbik6IHZvaWQge1xuXHRcdHN1cGVyLnNldEVkaXRvclZpc2libGUodmlzaWJsZSk7XG5cblx0XHRmb3IgKGNvbnN0IHsgZWRpdG9yIH0gb2YgW3RoaXMuaW5wdXQxVmlldywgdGhpcy5pbnB1dDJWaWV3LCB0aGlzLmlucHV0UmVzdWx0Vmlld10pIHtcblx0XHRcdGlmICh2aXNpYmxlKSB7XG5cdFx0XHRcdGVkaXRvci5vblZpc2libGUoKTtcblx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdGVkaXRvci5vbkhpZGUoKTtcblx0XHRcdH1cblx0XHR9XG5cblx0XHR0aGlzLl9jdHhJc01lcmdlRWRpdG9yLnNldCh2aXNpYmxlKTtcblx0fVxuXG5cdC8vIC0tLS0gaW50ZXJhY3Qgd2l0aCBcIm91dHNpZGUgd29ybGRcIiB2aWFgZ2V0Q29udHJvbGAsIGBzY29wZWRDb250ZXh0S2V5U2VydmljZWA6IHdlIG9ubHkgZXhwb3NlIHRoZSByZXN1bHQtZWRpdG9yIGtlZXAgdGhlIG90aGVycyBpbnRlcm5hbFxuXG5cdG92ZXJyaWRlIGdldENvbnRyb2woKTogSUNvZGVFZGl0b3IgfCB1bmRlZmluZWQge1xuXHRcdHJldHVybiB0aGlzLmlucHV0UmVzdWx0Vmlldy5lZGl0b3I7XG5cdH1cblxuXHRvdmVycmlkZSBnZXQgc2NvcGVkQ29udGV4dEtleVNlcnZpY2UoKTogSUNvbnRleHRLZXlTZXJ2aWNlIHwgdW5kZWZpbmVkIHtcblx0XHRjb25zdCBjb250cm9sID0gdGhpcy5nZXRDb250cm9sKCk7XG5cdFx0cmV0dXJuIGNvbnRyb2w/Lmludm9rZVdpdGhpbkNvbnRleHQoYWNjZXNzb3IgPT4gYWNjZXNzb3IuZ2V0KElDb250ZXh0S2V5U2VydmljZSkpO1xuXHR9XG5cblx0Ly8gLS0tIGxheW91dFxuXG5cdHB1YmxpYyB0b2dnbGVCYXNlKCk6IHZvaWQge1xuXHRcdHRoaXMuc2V0TGF5b3V0KHtcblx0XHRcdC4uLnRoaXMuX2xheW91dE1vZGUudmFsdWUsXG5cdFx0XHRzaG93QmFzZTogIXRoaXMuX2xheW91dE1vZGUudmFsdWUuc2hvd0Jhc2Vcblx0XHR9KTtcblx0fVxuXG5cdHB1YmxpYyB0b2dnbGVTaG93QmFzZVRvcCgpOiB2b2lkIHtcblx0XHRjb25zdCBzaG93QmFzZVRvcCA9IHRoaXMuX2xheW91dE1vZGUudmFsdWUuc2hvd0Jhc2UgJiYgdGhpcy5fbGF5b3V0TW9kZS52YWx1ZS5zaG93QmFzZUF0VG9wO1xuXHRcdHRoaXMuc2V0TGF5b3V0KHtcblx0XHRcdC4uLnRoaXMuX2xheW91dE1vZGUudmFsdWUsXG5cdFx0XHRzaG93QmFzZUF0VG9wOiB0cnVlLFxuXHRcdFx0c2hvd0Jhc2U6ICFzaG93QmFzZVRvcCxcblx0XHR9KTtcblx0fVxuXG5cdHB1YmxpYyB0b2dnbGVTaG93QmFzZUNlbnRlcigpOiB2b2lkIHtcblx0XHRjb25zdCBzaG93QmFzZUNlbnRlciA9IHRoaXMuX2xheW91dE1vZGUudmFsdWUuc2hvd0Jhc2UgJiYgIXRoaXMuX2xheW91dE1vZGUudmFsdWUuc2hvd0Jhc2VBdFRvcDtcblx0XHR0aGlzLnNldExheW91dCh7XG5cdFx0XHQuLi50aGlzLl9sYXlvdXRNb2RlLnZhbHVlLFxuXHRcdFx0c2hvd0Jhc2VBdFRvcDogZmFsc2UsXG5cdFx0XHRzaG93QmFzZTogIXNob3dCYXNlQ2VudGVyLFxuXHRcdH0pO1xuXHR9XG5cblx0cHVibGljIHNldExheW91dEtpbmQoa2luZDogTWVyZ2VFZGl0b3JMYXlvdXRLaW5kKTogdm9pZCB7XG5cdFx0dGhpcy5zZXRMYXlvdXQoe1xuXHRcdFx0Li4udGhpcy5fbGF5b3V0TW9kZS52YWx1ZSxcblx0XHRcdGtpbmRcblx0XHR9KTtcblx0fVxuXG5cdHB1YmxpYyBzZXRMYXlvdXQobmV3TGF5b3V0OiBJTWVyZ2VFZGl0b3JMYXlvdXQpOiB2b2lkIHtcblx0XHRjb25zdCB2YWx1ZSA9IHRoaXMuX2xheW91dE1vZGUudmFsdWU7XG5cdFx0aWYgKEpTT04uc3RyaW5naWZ5KHZhbHVlKSA9PT0gSlNPTi5zdHJpbmdpZnkobmV3TGF5b3V0KSkge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblx0XHR0aGlzLm1vZGVsPy50ZWxlbWV0cnkucmVwb3J0TGF5b3V0Q2hhbmdlKHtcblx0XHRcdGJhc2VUb3A6IG5ld0xheW91dC5zaG93QmFzZUF0VG9wLFxuXHRcdFx0YmFzZVZpc2libGU6IG5ld0xheW91dC5zaG93QmFzZSxcblx0XHRcdGlzQ29sdW1uVmlldzogbmV3TGF5b3V0LmtpbmQgPT09ICdjb2x1bW5zJyxcblx0XHR9KTtcblx0XHR0aGlzLmFwcGx5TGF5b3V0KG5ld0xheW91dCk7XG5cdH1cblxuXHRwcml2YXRlIHJlYWRvbmx5IGJhc2VWaWV3RGlzcG9zYWJsZXMgPSB0aGlzLl9yZWdpc3RlcihuZXcgRGlzcG9zYWJsZVN0b3JlKCkpO1xuXG5cdHByaXZhdGUgYXBwbHlMYXlvdXQobGF5b3V0OiBJTWVyZ2VFZGl0b3JMYXlvdXQpOiB2b2lkIHtcblx0XHR0cmFuc2FjdGlvbih0eCA9PiB7XG5cdFx0XHQvKiogQGRlc2NyaXB0aW9uIGFwcGx5TGF5b3V0ICovXG5cblx0XHRcdGlmIChsYXlvdXQuc2hvd0Jhc2UgJiYgIXRoaXMuYmFzZVZpZXcuZ2V0KCkpIHtcblx0XHRcdFx0dGhpcy5iYXNlVmlld0Rpc3Bvc2FibGVzLmNsZWFyKCk7XG5cdFx0XHRcdGNvbnN0IGJhc2VWaWV3ID0gdGhpcy5iYXNlVmlld0Rpc3Bvc2FibGVzLmFkZChcblx0XHRcdFx0XHR0aGlzLmluc3RhbnRpYXRpb25TZXJ2aWNlLmNyZWF0ZUluc3RhbmNlKFxuXHRcdFx0XHRcdFx0QmFzZUNvZGVFZGl0b3JWaWV3LFxuXHRcdFx0XHRcdFx0dGhpcy52aWV3TW9kZWxcblx0XHRcdFx0XHQpXG5cdFx0XHRcdCk7XG5cdFx0XHRcdHRoaXMuYmFzZVZpZXdEaXNwb3NhYmxlcy5hZGQoYXV0b3J1bihyZWFkZXIgPT4ge1xuXHRcdFx0XHRcdC8qKiBAZGVzY3JpcHRpb24gVXBkYXRlIGJhc2UgdmlldyBvcHRpb25zICovXG5cdFx0XHRcdFx0Y29uc3Qgb3B0aW9ucyA9IHRoaXMuYmFzZVZpZXdPcHRpb25zLnJlYWQocmVhZGVyKTtcblx0XHRcdFx0XHRpZiAob3B0aW9ucykge1xuXHRcdFx0XHRcdFx0YmFzZVZpZXcudXBkYXRlT3B0aW9ucyhvcHRpb25zKTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdH0pKTtcblx0XHRcdFx0dGhpcy5iYXNlVmlldy5zZXQoYmFzZVZpZXcsIHR4KTtcblx0XHRcdH0gZWxzZSBpZiAoIWxheW91dC5zaG93QmFzZSAmJiB0aGlzLmJhc2VWaWV3LmdldCgpKSB7XG5cdFx0XHRcdHRoaXMuYmFzZVZpZXcuc2V0KHVuZGVmaW5lZCwgdHgpO1xuXHRcdFx0XHR0aGlzLmJhc2VWaWV3RGlzcG9zYWJsZXMuY2xlYXIoKTtcblx0XHRcdH1cblxuXHRcdFx0aWYgKGxheW91dC5raW5kID09PSAnbWl4ZWQnKSB7XG5cdFx0XHRcdHRoaXMuc2V0R3JpZChbXG5cdFx0XHRcdFx0bGF5b3V0LnNob3dCYXNlQXRUb3AgJiYgbGF5b3V0LnNob3dCYXNlID8ge1xuXHRcdFx0XHRcdFx0c2l6ZTogMzgsXG5cdFx0XHRcdFx0XHRkYXRhOiB0aGlzLmJhc2VWaWV3LmdldCgpIS52aWV3XG5cdFx0XHRcdFx0fSA6IHVuZGVmaW5lZCxcblx0XHRcdFx0XHR7XG5cdFx0XHRcdFx0XHRzaXplOiAzOCxcblx0XHRcdFx0XHRcdGdyb3VwczogW1xuXHRcdFx0XHRcdFx0XHR7IGRhdGE6IHRoaXMuaW5wdXQxVmlldy52aWV3IH0sXG5cdFx0XHRcdFx0XHRcdCFsYXlvdXQuc2hvd0Jhc2VBdFRvcCAmJiBsYXlvdXQuc2hvd0Jhc2UgPyB7IGRhdGE6IHRoaXMuYmFzZVZpZXcuZ2V0KCkhLnZpZXcgfSA6IHVuZGVmaW5lZCxcblx0XHRcdFx0XHRcdFx0eyBkYXRhOiB0aGlzLmlucHV0MlZpZXcudmlldyB9XG5cdFx0XHRcdFx0XHRdLmZpbHRlcihpc0RlZmluZWQpXG5cdFx0XHRcdFx0fSxcblx0XHRcdFx0XHR7XG5cdFx0XHRcdFx0XHRzaXplOiA2Mixcblx0XHRcdFx0XHRcdGRhdGE6IHRoaXMuaW5wdXRSZXN1bHRWaWV3LnZpZXdcblx0XHRcdFx0XHR9LFxuXHRcdFx0XHRdLmZpbHRlcihpc0RlZmluZWQpKTtcblx0XHRcdH0gZWxzZSBpZiAobGF5b3V0LmtpbmQgPT09ICdjb2x1bW5zJykge1xuXHRcdFx0XHR0aGlzLnNldEdyaWQoW1xuXHRcdFx0XHRcdGxheW91dC5zaG93QmFzZSA/IHtcblx0XHRcdFx0XHRcdHNpemU6IDQwLFxuXHRcdFx0XHRcdFx0ZGF0YTogdGhpcy5iYXNlVmlldy5nZXQoKSEudmlld1xuXHRcdFx0XHRcdH0gOiB1bmRlZmluZWQsXG5cdFx0XHRcdFx0e1xuXHRcdFx0XHRcdFx0c2l6ZTogNjAsXG5cdFx0XHRcdFx0XHRncm91cHM6IFt7IGRhdGE6IHRoaXMuaW5wdXQxVmlldy52aWV3IH0sIHsgZGF0YTogdGhpcy5pbnB1dFJlc3VsdFZpZXcudmlldyB9LCB7IGRhdGE6IHRoaXMuaW5wdXQyVmlldy52aWV3IH1dXG5cdFx0XHRcdFx0fSxcblx0XHRcdFx0XS5maWx0ZXIoaXNEZWZpbmVkKSk7XG5cdFx0XHR9XG5cblx0XHRcdHRoaXMuX2xheW91dE1vZGUudmFsdWUgPSBsYXlvdXQ7XG5cdFx0XHR0aGlzLl9jdHhVc2VzQ29sdW1uTGF5b3V0LnNldChsYXlvdXQua2luZCk7XG5cdFx0XHR0aGlzLl9jdHhTaG93QmFzZS5zZXQobGF5b3V0LnNob3dCYXNlKTtcblx0XHRcdHRoaXMuX2N0eFNob3dCYXNlQXRUb3Auc2V0KGxheW91dC5zaG93QmFzZUF0VG9wKTtcblx0XHRcdHRoaXMuX29uRGlkQ2hhbmdlU2l6ZUNvbnN0cmFpbnRzLmZpcmUoKTtcblx0XHRcdHRoaXMuX2xheW91dE1vZGVPYnMuc2V0KGxheW91dCwgdHgpO1xuXHRcdH0pO1xuXHR9XG5cblx0cHJpdmF0ZSBzZXRHcmlkKGRlc2NyaXB0b3I6IEdyaWROb2RlRGVzY3JpcHRvcjxhbnk+W10pIHtcblx0XHRsZXQgd2lkdGggPSAtMTtcblx0XHRsZXQgaGVpZ2h0ID0gLTE7XG5cdFx0aWYgKHRoaXMuX2dyaWQudmFsdWUpIHtcblx0XHRcdHdpZHRoID0gdGhpcy5fZ3JpZC52YWx1ZS53aWR0aDtcblx0XHRcdGhlaWdodCA9IHRoaXMuX2dyaWQudmFsdWUuaGVpZ2h0O1xuXHRcdH1cblx0XHR0aGlzLl9ncmlkLnZhbHVlID0gU2VyaWFsaXphYmxlR3JpZC5mcm9tPGFueT4oe1xuXHRcdFx0b3JpZW50YXRpb246IE9yaWVudGF0aW9uLlZFUlRJQ0FMLFxuXHRcdFx0c2l6ZTogMTAwLFxuXHRcdFx0Z3JvdXBzOiBkZXNjcmlwdG9yLFxuXHRcdH0sIHtcblx0XHRcdHN0eWxlczogeyBzZXBhcmF0b3JCb3JkZXI6IHRoaXMudGhlbWUuZ2V0Q29sb3Ioc2V0dGluZ3NTYXNoQm9yZGVyKSA/PyBDb2xvci50cmFuc3BhcmVudCB9LFxuXHRcdFx0cHJvcG9ydGlvbmFsTGF5b3V0OiB0cnVlXG5cdFx0fSk7XG5cblx0XHRyZXNldCh0aGlzLnJvb3RIdG1sRWxlbWVudCEsIHRoaXMuX2dyaWQudmFsdWUuZWxlbWVudCk7XG5cdFx0Ly8gT25seSBjYWxsIGxheW91dCBhZnRlciB0aGUgZWxlbWVudHMgaGF2ZSBiZWVuIGFkZGVkIHRvIHRoZSBET00sXG5cdFx0Ly8gc28gdGhhdCB0aGV5IGhhdmUgYSBkZWZpbmVkIHNpemUuXG5cdFx0aWYgKHdpZHRoICE9PSAtMSkge1xuXHRcdFx0dGhpcy5fZ3JpZC52YWx1ZS5sYXlvdXQod2lkdGgsIGhlaWdodCk7XG5cdFx0fVxuXHR9XG5cblx0cHJpdmF0ZSBfYXBwbHlWaWV3U3RhdGUoc3RhdGU6IElNZXJnZUVkaXRvclZpZXdTdGF0ZSB8IHVuZGVmaW5lZCkge1xuXHRcdGlmICghc3RhdGUpIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cdFx0dGhpcy5pbnB1dFJlc3VsdFZpZXcuZWRpdG9yLnJlc3RvcmVWaWV3U3RhdGUoc3RhdGUpO1xuXHRcdGlmIChzdGF0ZS5pbnB1dDFTdGF0ZSkge1xuXHRcdFx0dGhpcy5pbnB1dDFWaWV3LmVkaXRvci5yZXN0b3JlVmlld1N0YXRlKHN0YXRlLmlucHV0MVN0YXRlKTtcblx0XHR9XG5cdFx0aWYgKHN0YXRlLmlucHV0MlN0YXRlKSB7XG5cdFx0XHR0aGlzLmlucHV0MlZpZXcuZWRpdG9yLnJlc3RvcmVWaWV3U3RhdGUoc3RhdGUuaW5wdXQyU3RhdGUpO1xuXHRcdH1cblx0XHRpZiAoc3RhdGUuZm9jdXNJbmRleCA+PSAwKSB7XG5cdFx0XHRbdGhpcy5pbnB1dDFWaWV3LmVkaXRvciwgdGhpcy5pbnB1dDJWaWV3LmVkaXRvciwgdGhpcy5pbnB1dFJlc3VsdFZpZXcuZWRpdG9yXVtzdGF0ZS5mb2N1c0luZGV4XS5mb2N1cygpO1xuXHRcdH1cblx0fVxuXG5cdHByb3RlY3RlZCBjb21wdXRlRWRpdG9yVmlld1N0YXRlKHJlc291cmNlOiBVUkkpOiBJTWVyZ2VFZGl0b3JWaWV3U3RhdGUgfCB1bmRlZmluZWQge1xuXHRcdGlmICghaXNFcXVhbCh0aGlzLmlucHV0TW9kZWwuZ2V0KCk/LnJlc3VsdFVyaSwgcmVzb3VyY2UpKSB7XG5cdFx0XHRyZXR1cm4gdW5kZWZpbmVkO1xuXHRcdH1cblx0XHRjb25zdCByZXN1bHQgPSB0aGlzLmlucHV0UmVzdWx0Vmlldy5lZGl0b3Iuc2F2ZVZpZXdTdGF0ZSgpO1xuXHRcdGlmICghcmVzdWx0KSB7XG5cdFx0XHRyZXR1cm4gdW5kZWZpbmVkO1xuXHRcdH1cblx0XHRjb25zdCBpbnB1dDFTdGF0ZSA9IHRoaXMuaW5wdXQxVmlldy5lZGl0b3Iuc2F2ZVZpZXdTdGF0ZSgpID8/IHVuZGVmaW5lZDtcblx0XHRjb25zdCBpbnB1dDJTdGF0ZSA9IHRoaXMuaW5wdXQyVmlldy5lZGl0b3Iuc2F2ZVZpZXdTdGF0ZSgpID8/IHVuZGVmaW5lZDtcblx0XHRjb25zdCBmb2N1c0luZGV4ID0gW3RoaXMuaW5wdXQxVmlldy5lZGl0b3IsIHRoaXMuaW5wdXQyVmlldy5lZGl0b3IsIHRoaXMuaW5wdXRSZXN1bHRWaWV3LmVkaXRvcl0uZmluZEluZGV4KGVkaXRvciA9PiBlZGl0b3IuaGFzV2lkZ2V0Rm9jdXMoKSk7XG5cdFx0cmV0dXJuIHsgLi4ucmVzdWx0LCBpbnB1dDFTdGF0ZSwgaW5wdXQyU3RhdGUsIGZvY3VzSW5kZXggfTtcblx0fVxuXG5cblx0cHJvdGVjdGVkIHRyYWNrc0VkaXRvclZpZXdTdGF0ZShpbnB1dDogRWRpdG9ySW5wdXQpOiBib29sZWFuIHtcblx0XHRyZXR1cm4gaW5wdXQgaW5zdGFuY2VvZiBNZXJnZUVkaXRvcklucHV0O1xuXHR9XG5cblx0cHJpdmF0ZSByZWFkb25seSBzaG93Tm9uQ29uZmxpY3RpbmdDaGFuZ2VzU3RvcmUgPSB0aGlzLmluc3RhbnRpYXRpb25TZXJ2aWNlLmNyZWF0ZUluc3RhbmNlKFBlcnNpc3RlbnRTdG9yZTxib29sZWFuPiwgJ21lcmdlRWRpdG9yL3Nob3dOb25Db25mbGljdGluZ0NoYW5nZXMnKTtcblx0cHJpdmF0ZSByZWFkb25seSBzaG93Tm9uQ29uZmxpY3RpbmdDaGFuZ2VzID0gb2JzZXJ2YWJsZVZhbHVlKHRoaXMsIHRoaXMuc2hvd05vbkNvbmZsaWN0aW5nQ2hhbmdlc1N0b3JlLmdldCgpID8/IGZhbHNlKTtcblxuXHRwdWJsaWMgdG9nZ2xlU2hvd05vbkNvbmZsaWN0aW5nQ2hhbmdlcygpOiB2b2lkIHtcblx0XHR0aGlzLnNob3dOb25Db25mbGljdGluZ0NoYW5nZXMuc2V0KCF0aGlzLnNob3dOb25Db25mbGljdGluZ0NoYW5nZXMuZ2V0KCksIHVuZGVmaW5lZCk7XG5cdFx0dGhpcy5zaG93Tm9uQ29uZmxpY3RpbmdDaGFuZ2VzU3RvcmUuc2V0KHRoaXMuc2hvd05vbkNvbmZsaWN0aW5nQ2hhbmdlcy5nZXQoKSk7XG5cdFx0dGhpcy5fY3R4U2hvd05vbkNvbmZsaWN0aW5nQ2hhbmdlcy5zZXQodGhpcy5zaG93Tm9uQ29uZmxpY3RpbmdDaGFuZ2VzLmdldCgpKTtcblx0fVxufVxuXG5leHBvcnQgaW50ZXJmYWNlIElNZXJnZUVkaXRvckxheW91dCB7XG5cdHJlYWRvbmx5IGtpbmQ6IE1lcmdlRWRpdG9yTGF5b3V0S2luZDtcblx0cmVhZG9ubHkgc2hvd0Jhc2U6IGJvb2xlYW47XG5cdHJlYWRvbmx5IHNob3dCYXNlQXRUb3A6IGJvb2xlYW47XG59XG5cbi8vIFRPRE8gdXNlIFBlcnNpc3RlbnRTdG9yZVxuY2xhc3MgTWVyZ2VFZGl0b3JMYXlvdXRTdG9yZSB7XG5cdHByaXZhdGUgc3RhdGljIHJlYWRvbmx5IF9rZXkgPSAnbWVyZ2VFZGl0b3IvbGF5b3V0Jztcblx0cHJpdmF0ZSBfdmFsdWU6IElNZXJnZUVkaXRvckxheW91dCA9IHsga2luZDogJ21peGVkJywgc2hvd0Jhc2U6IGZhbHNlLCBzaG93QmFzZUF0VG9wOiB0cnVlIH07XG5cblx0Y29uc3RydWN0b3IoQElTdG9yYWdlU2VydmljZSBwcml2YXRlIF9zdG9yYWdlU2VydmljZTogSVN0b3JhZ2VTZXJ2aWNlKSB7XG5cdFx0Y29uc3QgdmFsdWUgPSBfc3RvcmFnZVNlcnZpY2UuZ2V0KE1lcmdlRWRpdG9yTGF5b3V0U3RvcmUuX2tleSwgU3RvcmFnZVNjb3BlLlBST0ZJTEUsICdtaXhlZCcpO1xuXG5cdFx0aWYgKHZhbHVlID09PSAnbWl4ZWQnIHx8IHZhbHVlID09PSAnY29sdW1ucycpIHtcblx0XHRcdHRoaXMuX3ZhbHVlID0geyBraW5kOiB2YWx1ZSwgc2hvd0Jhc2U6IGZhbHNlLCBzaG93QmFzZUF0VG9wOiB0cnVlIH07XG5cdFx0fSBlbHNlIGlmICh2YWx1ZSkge1xuXHRcdFx0dHJ5IHtcblx0XHRcdFx0dGhpcy5fdmFsdWUgPSBKU09OLnBhcnNlKHZhbHVlKTtcblx0XHRcdH0gY2F0Y2ggKGUpIHtcblx0XHRcdFx0b25VbmV4cGVjdGVkRXJyb3IoZSk7XG5cdFx0XHR9XG5cdFx0fVxuXHR9XG5cblx0Z2V0IHZhbHVlKCkge1xuXHRcdHJldHVybiB0aGlzLl92YWx1ZTtcblx0fVxuXG5cdHNldCB2YWx1ZSh2YWx1ZTogSU1lcmdlRWRpdG9yTGF5b3V0KSB7XG5cdFx0aWYgKHRoaXMuX3ZhbHVlICE9PSB2YWx1ZSkge1xuXHRcdFx0dGhpcy5fdmFsdWUgPSB2YWx1ZTtcblx0XHRcdHRoaXMuX3N0b3JhZ2VTZXJ2aWNlLnN0b3JlKE1lcmdlRWRpdG9yTGF5b3V0U3RvcmUuX2tleSwgSlNPTi5zdHJpbmdpZnkodGhpcy5fdmFsdWUpLCBTdG9yYWdlU2NvcGUuUFJPRklMRSwgU3RvcmFnZVRhcmdldC5VU0VSKTtcblx0XHR9XG5cdH1cbn1cblxuZXhwb3J0IGNsYXNzIE1lcmdlRWRpdG9yT3BlbkhhbmRsZXJDb250cmlidXRpb24gZXh0ZW5kcyBEaXNwb3NhYmxlIHtcblxuXHRjb25zdHJ1Y3Rvcihcblx0XHRASUVkaXRvclNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBfZWRpdG9yU2VydmljZTogSUVkaXRvclNlcnZpY2UsXG5cdFx0QElDb2RlRWRpdG9yU2VydmljZSBjb2RlRWRpdG9yU2VydmljZTogSUNvZGVFZGl0b3JTZXJ2aWNlLFxuXHQpIHtcblx0XHRzdXBlcigpO1xuXHRcdHRoaXMuX3N0b3JlLmFkZChjb2RlRWRpdG9yU2VydmljZS5yZWdpc3RlckNvZGVFZGl0b3JPcGVuSGFuZGxlcih0aGlzLm9wZW5Db2RlRWRpdG9yRnJvbU1lcmdlRWRpdG9yLmJpbmQodGhpcykpKTtcblx0fVxuXG5cdHByaXZhdGUgYXN5bmMgb3BlbkNvZGVFZGl0b3JGcm9tTWVyZ2VFZGl0b3IoaW5wdXQ6IElUZXh0UmVzb3VyY2VFZGl0b3JJbnB1dCwgX3NvdXJjZTogSUNvZGVFZGl0b3IgfCBudWxsLCBzaWRlQnlTaWRlPzogYm9vbGVhbiB8IHVuZGVmaW5lZCk6IFByb21pc2U8SUNvZGVFZGl0b3IgfCBudWxsPiB7XG5cdFx0Y29uc3QgYWN0aXZlUGFuZSA9IHRoaXMuX2VkaXRvclNlcnZpY2UuYWN0aXZlRWRpdG9yUGFuZTtcblx0XHRpZiAoIXNpZGVCeVNpZGVcblx0XHRcdCYmIGlucHV0Lm9wdGlvbnNcblx0XHRcdCYmIGFjdGl2ZVBhbmUgaW5zdGFuY2VvZiBNZXJnZUVkaXRvclxuXHRcdFx0JiYgYWN0aXZlUGFuZS5nZXRDb250cm9sKClcblx0XHRcdCYmIGFjdGl2ZVBhbmUuaW5wdXQgaW5zdGFuY2VvZiBNZXJnZUVkaXRvcklucHV0XG5cdFx0XHQmJiBpc0VxdWFsKGlucHV0LnJlc291cmNlLCBhY3RpdmVQYW5lLmlucHV0LnJlc3VsdClcblx0XHQpIHtcblx0XHRcdC8vIFNwZWNpYWw6IHN0YXkgaW5zaWRlIHRoZSBtZXJnZSBlZGl0b3Igd2hlbiBpdCBpcyBhY3RpdmUgYW5kIHdoZW4gdGhlIGlucHV0XG5cdFx0XHQvLyB0YXJnZXRzIHRoZSByZXN1bHQgZWRpdG9yIG9mIHRoZSBtZXJnZSBlZGl0b3IuXG5cdFx0XHRjb25zdCB0YXJnZXRFZGl0b3IgPSA8SUNvZGVFZGl0b3I+YWN0aXZlUGFuZS5nZXRDb250cm9sKCkhO1xuXHRcdFx0YXBwbHlUZXh0RWRpdG9yT3B0aW9ucyhpbnB1dC5vcHRpb25zLCB0YXJnZXRFZGl0b3IsIFNjcm9sbFR5cGUuU21vb3RoKTtcblx0XHRcdHJldHVybiB0YXJnZXRFZGl0b3I7XG5cdFx0fVxuXG5cdFx0Ly8gY2Fubm90IGhhbmRsZSB0aGlzXG5cdFx0cmV0dXJuIG51bGw7XG5cdH1cbn1cblxuZXhwb3J0IGNsYXNzIE1lcmdlRWRpdG9yUmVzb2x2ZXJDb250cmlidXRpb24gZXh0ZW5kcyBEaXNwb3NhYmxlIHtcblxuXHRzdGF0aWMgcmVhZG9ubHkgSUQgPSAnd29ya2JlbmNoLmNvbnRyaWIubWVyZ2VFZGl0b3JSZXNvbHZlcic7XG5cblx0Y29uc3RydWN0b3IoXG5cdFx0QElFZGl0b3JSZXNvbHZlclNlcnZpY2UgZWRpdG9yUmVzb2x2ZXJTZXJ2aWNlOiBJRWRpdG9yUmVzb2x2ZXJTZXJ2aWNlLFxuXHRcdEBJSW5zdGFudGlhdGlvblNlcnZpY2UgaW5zdGFudGlhdGlvblNlcnZpY2U6IElJbnN0YW50aWF0aW9uU2VydmljZSxcblx0KSB7XG5cdFx0c3VwZXIoKTtcblxuXHRcdGNvbnN0IG1lcmdlRWRpdG9ySW5wdXRGYWN0b3J5OiBNZXJnZUVkaXRvcklucHV0RmFjdG9yeUZ1bmN0aW9uID0gKG1lcmdlRWRpdG9yOiBJUmVzb3VyY2VNZXJnZUVkaXRvcklucHV0KTogRWRpdG9ySW5wdXRXaXRoT3B0aW9ucyA9PiB7XG5cdFx0XHRyZXR1cm4ge1xuXHRcdFx0XHRlZGl0b3I6IGluc3RhbnRpYXRpb25TZXJ2aWNlLmNyZWF0ZUluc3RhbmNlKFxuXHRcdFx0XHRcdE1lcmdlRWRpdG9ySW5wdXQsXG5cdFx0XHRcdFx0bWVyZ2VFZGl0b3IuYmFzZS5yZXNvdXJjZSxcblx0XHRcdFx0XHR7XG5cdFx0XHRcdFx0XHR1cmk6IG1lcmdlRWRpdG9yLmlucHV0MS5yZXNvdXJjZSxcblx0XHRcdFx0XHRcdHRpdGxlOiBtZXJnZUVkaXRvci5pbnB1dDEubGFiZWwgPz8gYmFzZW5hbWUobWVyZ2VFZGl0b3IuaW5wdXQxLnJlc291cmNlKSxcblx0XHRcdFx0XHRcdGRlc2NyaXB0aW9uOiBtZXJnZUVkaXRvci5pbnB1dDEuZGVzY3JpcHRpb24gPz8gJycsXG5cdFx0XHRcdFx0XHRkZXRhaWw6IG1lcmdlRWRpdG9yLmlucHV0MS5kZXRhaWxcblx0XHRcdFx0XHR9LFxuXHRcdFx0XHRcdHtcblx0XHRcdFx0XHRcdHVyaTogbWVyZ2VFZGl0b3IuaW5wdXQyLnJlc291cmNlLFxuXHRcdFx0XHRcdFx0dGl0bGU6IG1lcmdlRWRpdG9yLmlucHV0Mi5sYWJlbCA/PyBiYXNlbmFtZShtZXJnZUVkaXRvci5pbnB1dDIucmVzb3VyY2UpLFxuXHRcdFx0XHRcdFx0ZGVzY3JpcHRpb246IG1lcmdlRWRpdG9yLmlucHV0Mi5kZXNjcmlwdGlvbiA/PyAnJyxcblx0XHRcdFx0XHRcdGRldGFpbDogbWVyZ2VFZGl0b3IuaW5wdXQyLmRldGFpbFxuXHRcdFx0XHRcdH0sXG5cdFx0XHRcdFx0bWVyZ2VFZGl0b3IucmVzdWx0LnJlc291cmNlXG5cdFx0XHRcdClcblx0XHRcdH07XG5cdFx0fTtcblxuXHRcdHRoaXMuX3JlZ2lzdGVyKGVkaXRvclJlc29sdmVyU2VydmljZS5yZWdpc3RlckVkaXRvcihcblx0XHRcdGAqYCxcblx0XHRcdHtcblx0XHRcdFx0aWQ6IERFRkFVTFRfRURJVE9SX0FTU09DSUFUSU9OLmlkLFxuXHRcdFx0XHRsYWJlbDogREVGQVVMVF9FRElUT1JfQVNTT0NJQVRJT04uZGlzcGxheU5hbWUsXG5cdFx0XHRcdGRldGFpbDogREVGQVVMVF9FRElUT1JfQVNTT0NJQVRJT04ucHJvdmlkZXJEaXNwbGF5TmFtZSxcblx0XHRcdFx0cHJpb3JpdHk6IFJlZ2lzdGVyZWRFZGl0b3JQcmlvcml0eS5idWlsdGluXG5cdFx0XHR9LFxuXHRcdFx0e30sXG5cdFx0XHR7XG5cdFx0XHRcdGNyZWF0ZU1lcmdlRWRpdG9ySW5wdXQ6IG1lcmdlRWRpdG9ySW5wdXRGYWN0b3J5XG5cdFx0XHR9XG5cdFx0KSk7XG5cdH1cbn1cblxudHlwZSBJTWVyZ2VFZGl0b3JWaWV3U3RhdGUgPSBJQ29kZUVkaXRvclZpZXdTdGF0ZSAmIHtcblx0cmVhZG9ubHkgaW5wdXQxU3RhdGU/OiBJQ29kZUVkaXRvclZpZXdTdGF0ZTtcblx0cmVhZG9ubHkgaW5wdXQyU3RhdGU/OiBJQ29kZUVkaXRvclZpZXdTdGF0ZTtcblx0cmVhZG9ubHkgZm9jdXNJbmRleDogbnVtYmVyO1xufTtcbiJdLAogICJtYXBwaW5ncyI6ICI7Ozs7Ozs7Ozs7O0FBS0EsU0FBb0IsYUFBYTtBQUNqQyxTQUEwQyx3QkFBd0I7QUFDbEUsU0FBUyxtQkFBbUI7QUFFNUIsU0FBUyxhQUFhO0FBQ3RCLFNBQVMsb0JBQW9CLHlCQUF5QjtBQUN0RCxTQUFTLGVBQXNCO0FBQy9CLFNBQVMsWUFBWSxpQkFBOEIsbUJBQW1CLG1CQUFtQixvQkFBb0I7QUFDN0csU0FBUyxTQUFTLGtCQUF3QyxpQkFBaUIsbUJBQW1CO0FBQzlGLFNBQVMsVUFBVSxlQUFlO0FBQ2xDLFNBQVMsaUJBQWlCO0FBRTFCLE9BQU87QUFFUCxTQUFTLDBCQUEwQjtBQUVuQyxTQUErQixrQkFBa0I7QUFFakQsU0FBUyx5Q0FBeUM7QUFDbEQsU0FBUyxnQkFBZ0I7QUFDekIsU0FBc0IsMEJBQTBCO0FBRWhELFNBQVMsb0JBQW9CO0FBQzdCLFNBQVMsNkJBQTZCO0FBQ3RDLFNBQVMsaUJBQWlCLGNBQWMscUJBQXFCO0FBQzdELFNBQVMseUJBQXlCO0FBQ2xDLFNBQVMscUJBQXFCO0FBQzlCLFNBQVMsMEJBQTBCO0FBQ25DLFNBQVMsa0NBQXlHO0FBRWxILFNBQVMsOEJBQThCO0FBQ3ZDLFNBQVMsb0JBQW9CLDJCQUEyQjtBQUN4RCxTQUFTLHdCQUF3QjtBQUdqQyxTQUFTLFdBQVcsdUJBQXVCO0FBQzNDLFNBQVMsMEJBQTBCO0FBQ25D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
