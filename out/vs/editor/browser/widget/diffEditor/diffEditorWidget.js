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
import { getWindow, h } from "../../../../base/browser/dom.js";
import { findLast } from "../../../../base/common/arraysFind.js";
import { BugIndicatingError, onUnexpectedError } from "../../../../base/common/errors.js";
import { Event } from "../../../../base/common/event.js";
import { readHotReloadableExport } from "../../../../base/common/hotReloadHelpers.js";
import { toDisposable } from "../../../../base/common/lifecycle.js";
import { autorun, autorunWithStore, derived, derivedDisposable, disposableObservableValue, observableFromEvent, observableValue, recomputeInitiallyAndOnChange, subtransaction, transaction } from "../../../../base/common/observable.js";
import { AccessibilitySignal, IAccessibilitySignalService } from "../../../../platform/accessibilitySignal/browser/accessibilitySignalService.js";
import { IContextKeyService } from "../../../../platform/contextkey/common/contextkey.js";
import { IInstantiationService } from "../../../../platform/instantiation/common/instantiation.js";
import { ServiceCollection } from "../../../../platform/instantiation/common/serviceCollection.js";
import { bindContextKey } from "../../../../platform/observable/common/platformObservableUtils.js";
import { IEditorProgressService } from "../../../../platform/progress/common/progress.js";
import { Position } from "../../../common/core/position.js";
import { Range } from "../../../common/core/range.js";
import { CursorChangeReason } from "../../../common/cursorEvents.js";
import { EditorType } from "../../../common/editorCommon.js";
import { EditorContextKeys } from "../../../common/editorContextKeys.js";
import { EditorExtensionsRegistry } from "../../editorExtensions.js";
import { ICodeEditorService } from "../../services/codeEditorService.js";
import { StableEditorScrollState } from "../../stableEditorScroll.js";
import { CodeEditorWidget } from "../codeEditor/codeEditorWidget.js";
import { AccessibleDiffViewer, AccessibleDiffViewerModelFromEditors } from "./components/accessibleDiffViewer.js";
import { DiffEditorDecorations } from "./components/diffEditorDecorations.js";
import { DiffEditorEditors } from "./components/diffEditorEditors.js";
import { DiffEditorSash, SashLayout } from "./components/diffEditorSash.js";
import { DiffEditorViewZones } from "./components/diffEditorViewZones/diffEditorViewZones.js";
import { DelegatingEditor } from "./delegatingEditorImpl.js";
import { DiffEditorOptions } from "./diffEditorOptions.js";
import { DiffEditorViewModel } from "./diffEditorViewModel.js";
import { DiffEditorGutter } from "./features/gutterFeature.js";
import { HideUnchangedRegionsFeature } from "./features/hideUnchangedRegionsFeature.js";
import { MovedBlocksLinesFeature } from "./features/movedBlocksLinesFeature.js";
import { OverviewRulerFeature } from "./features/overviewRulerFeature.js";
import { RevertButtonsFeature } from "./features/revertButtonsFeature.js";
import "./style.css";
import { ObservableElementSizeObserver, RefCounted, applyStyle, applyViewZones, translatePosition } from "./utils.js";
let DiffEditorWidget = class extends DelegatingEditor {
  constructor(_domElement, options, codeEditorWidgetOptions, _parentContextKeyService, _parentInstantiationService, codeEditorService, _accessibilitySignalService, _editorProgressService) {
    super();
    this._domElement = _domElement;
    this._parentContextKeyService = _parentContextKeyService;
    this._parentInstantiationService = _parentInstantiationService;
    this._accessibilitySignalService = _accessibilitySignalService;
    this._editorProgressService = _editorProgressService;
    this.elements = h("div.monaco-diff-editor.side-by-side", { style: { position: "relative", height: "100%" } }, [
      h("div.editor.original@original", { style: { position: "absolute", height: "100%" } }),
      h("div.editor.modified@modified", { style: { position: "absolute", height: "100%" } }),
      h("div.accessibleDiffViewer@accessibleDiffViewer", { style: { position: "absolute", height: "100%" } })
    ]);
    this._diffModelSrc = this._register(disposableObservableValue(this, void 0));
    this._diffModel = derived(this, (reader) => this._diffModelSrc.read(reader)?.object);
    this.onDidChangeModel = Event.fromObservableLight(this._diffModel);
    this._contextKeyService = this._register(this._parentContextKeyService.createScoped(this._domElement));
    this._instantiationService = this._register(this._parentInstantiationService.createChild(
      new ServiceCollection([IContextKeyService, this._contextKeyService])
    ));
    this._boundarySashes = observableValue(this, void 0);
    this._accessibleDiffViewerShouldBeVisible = observableValue(this, false);
    this._accessibleDiffViewerVisible = derived(
      this,
      (reader) => this._options.onlyShowAccessibleDiffViewer.read(reader) ? true : this._accessibleDiffViewerShouldBeVisible.read(reader)
    );
    this._movedBlocksLinesPart = observableValue(this, void 0);
    this._layoutInfo = derived(this, (reader) => {
      const fullWidth = this._rootSizeObserver.width.read(reader);
      const fullHeight = this._rootSizeObserver.height.read(reader);
      if (this._rootSizeObserver.automaticLayout) {
        this.elements.root.style.height = "100%";
      } else {
        this.elements.root.style.height = fullHeight + "px";
      }
      const sash = this._sash.read(reader);
      const gutter = this._gutter.read(reader);
      const gutterWidth = gutter?.width.read(reader) ?? 0;
      const overviewRulerPartWidth = this._overviewRulerPart.read(reader)?.width ?? 0;
      let originalLeft, originalWidth, modifiedLeft, modifiedWidth, gutterLeft;
      const sideBySide = !!sash;
      if (sideBySide) {
        const sashLeft = sash.sashLeft.read(reader);
        const movedBlocksLinesWidth = this._movedBlocksLinesPart.read(reader)?.width.read(reader) ?? 0;
        originalLeft = 0;
        originalWidth = sashLeft - gutterWidth - movedBlocksLinesWidth;
        gutterLeft = sashLeft - gutterWidth;
        modifiedLeft = sashLeft;
        modifiedWidth = fullWidth - modifiedLeft - overviewRulerPartWidth;
      } else {
        gutterLeft = 0;
        const shouldHideOriginalLineNumbers = this._options.inlineViewHideOriginalLineNumbers.read(reader);
        originalLeft = gutterWidth;
        if (shouldHideOriginalLineNumbers) {
          originalWidth = 0;
        } else {
          originalWidth = Math.max(5, this._editors.originalObs.layoutInfoDecorationsLeft.read(reader));
        }
        modifiedLeft = gutterWidth + originalWidth;
        modifiedWidth = fullWidth - modifiedLeft - overviewRulerPartWidth;
      }
      this.elements.original.style.left = originalLeft + "px";
      this.elements.original.style.width = originalWidth + "px";
      this._editors.original.layout({ width: originalWidth, height: fullHeight }, true);
      gutter?.layout(gutterLeft);
      this.elements.modified.style.left = modifiedLeft + "px";
      this.elements.modified.style.width = modifiedWidth + "px";
      this._editors.modified.layout({ width: modifiedWidth, height: fullHeight }, true);
      return {
        modifiedEditor: this._editors.modified.getLayoutInfo(),
        originalEditor: this._editors.original.getLayoutInfo()
      };
    });
    this._diffValue = this._diffModel.map((m, r) => m?.diff.read(r));
    this.onDidUpdateDiff = Event.fromObservableLight(this._diffValue);
    codeEditorService.willCreateDiffEditor();
    this._contextKeyService.createKey("isInDiffEditor", true);
    this._domElement.appendChild(this.elements.root);
    this._register(toDisposable(() => this.elements.root.remove()));
    this._rootSizeObserver = this._register(new ObservableElementSizeObserver(this.elements.root, options.dimension));
    this._rootSizeObserver.setAutomaticLayout(options.automaticLayout ?? false);
    this._options = this._instantiationService.createInstance(DiffEditorOptions, options);
    this._register(autorun((reader) => {
      this._options.setWidth(this._rootSizeObserver.width.read(reader));
    }));
    this._contextKeyService.createKey(EditorContextKeys.isEmbeddedDiffEditor.key, false);
    this._register(bindContextKey(
      EditorContextKeys.isEmbeddedDiffEditor,
      this._contextKeyService,
      (reader) => this._options.isInEmbeddedEditor.read(reader)
    ));
    this._register(bindContextKey(
      EditorContextKeys.comparingMovedCode,
      this._contextKeyService,
      (reader) => !!this._diffModel.read(reader)?.movedTextToCompare.read(reader)
    ));
    this._register(bindContextKey(
      EditorContextKeys.diffEditorRenderSideBySideInlineBreakpointReached,
      this._contextKeyService,
      (reader) => this._options.couldShowInlineViewBecauseOfSize.read(reader)
    ));
    this._register(bindContextKey(
      EditorContextKeys.diffEditorInlineMode,
      this._contextKeyService,
      (reader) => !this._options.renderSideBySide.read(reader)
    ));
    this._register(bindContextKey(
      EditorContextKeys.hasChanges,
      this._contextKeyService,
      (reader) => (this._diffModel.read(reader)?.diff.read(reader)?.mappings.length ?? 0) > 0
    ));
    this._editors = this._register(this._instantiationService.createInstance(
      DiffEditorEditors,
      this.elements.original,
      this.elements.modified,
      this._options,
      codeEditorWidgetOptions,
      (i, c, o, o2) => this._createInnerEditor(i, c, o, o2)
    ));
    this._register(bindContextKey(
      EditorContextKeys.diffEditorOriginalWritable,
      this._contextKeyService,
      (reader) => this._options.originalEditable.read(reader)
    ));
    this._register(bindContextKey(
      EditorContextKeys.diffEditorModifiedWritable,
      this._contextKeyService,
      (reader) => !this._options.readOnly.read(reader)
    ));
    this._register(bindContextKey(
      EditorContextKeys.diffEditorOriginalUri,
      this._contextKeyService,
      (reader) => this._diffModel.read(reader)?.model.original.uri.toString() ?? ""
    ));
    this._register(bindContextKey(
      EditorContextKeys.diffEditorModifiedUri,
      this._contextKeyService,
      (reader) => this._diffModel.read(reader)?.model.modified.uri.toString() ?? ""
    ));
    this._overviewRulerPart = derivedDisposable(
      this,
      (reader) => !this._options.renderOverviewRuler.read(reader) ? void 0 : this._instantiationService.createInstance(
        readHotReloadableExport(OverviewRulerFeature, reader),
        this._editors,
        this.elements.root,
        this._diffModel,
        this._rootSizeObserver.width,
        this._rootSizeObserver.height,
        this._layoutInfo.map((i) => i.modifiedEditor)
      )
    ).recomputeInitiallyAndOnChange(this._store);
    const dimensions = {
      height: this._rootSizeObserver.height,
      width: this._rootSizeObserver.width.map((w, reader) => w - (this._overviewRulerPart.read(reader)?.width ?? 0))
    };
    this._sashLayout = new SashLayout(this._options, dimensions);
    this._sash = derivedDisposable(this, (reader) => {
      const showSash = this._options.renderSideBySide.read(reader);
      this.elements.root.classList.toggle("side-by-side", showSash);
      return !showSash ? void 0 : new DiffEditorSash(
        this.elements.root,
        dimensions,
        this._options.enableSplitViewResizing,
        this._boundarySashes,
        this._sashLayout.sashLeft,
        () => this._sashLayout.resetSash()
      );
    }).recomputeInitiallyAndOnChange(this._store);
    const unchangedRangesFeature = derivedDisposable(
      this,
      (reader) => (
        /** @description UnchangedRangesFeature */
        this._instantiationService.createInstance(
          readHotReloadableExport(HideUnchangedRegionsFeature, reader),
          this._editors,
          this._diffModel,
          this._options
        )
      )
    ).recomputeInitiallyAndOnChange(this._store);
    derivedDisposable(
      this,
      (reader) => (
        /** @description DiffEditorDecorations */
        this._instantiationService.createInstance(
          readHotReloadableExport(DiffEditorDecorations, reader),
          this._editors,
          this._diffModel,
          this._options,
          this
        )
      )
    ).recomputeInitiallyAndOnChange(this._store);
    const origViewZoneIdsToIgnore = /* @__PURE__ */ new Set();
    const modViewZoneIdsToIgnore = /* @__PURE__ */ new Set();
    let isUpdatingViewZones = false;
    const viewZoneManager = derivedDisposable(
      this,
      (reader) => (
        /** @description ViewZoneManager */
        this._instantiationService.createInstance(
          readHotReloadableExport(DiffEditorViewZones, reader),
          getWindow(this._domElement),
          this._editors,
          this._diffModel,
          this._options,
          this,
          () => isUpdatingViewZones || unchangedRangesFeature.get().isUpdatingHiddenAreas,
          origViewZoneIdsToIgnore,
          modViewZoneIdsToIgnore
        )
      )
    ).recomputeInitiallyAndOnChange(this._store);
    const originalViewZones = derived(this, (reader) => {
      const orig = viewZoneManager.read(reader).viewZones.read(reader).orig;
      const orig2 = unchangedRangesFeature.read(reader).viewZones.read(reader).origViewZones;
      return orig.concat(orig2);
    });
    const modifiedViewZones = derived(this, (reader) => {
      const mod = viewZoneManager.read(reader).viewZones.read(reader).mod;
      const mod2 = unchangedRangesFeature.read(reader).viewZones.read(reader).modViewZones;
      return mod.concat(mod2);
    });
    this._register(applyViewZones(this._editors.original, originalViewZones, (isUpdatingOrigViewZones) => {
      isUpdatingViewZones = isUpdatingOrigViewZones;
    }, origViewZoneIdsToIgnore));
    let scrollState;
    this._register(applyViewZones(this._editors.modified, modifiedViewZones, (isUpdatingModViewZones) => {
      isUpdatingViewZones = isUpdatingModViewZones;
      if (isUpdatingViewZones) {
        scrollState = StableEditorScrollState.capture(this._editors.modified);
      } else {
        scrollState?.restore(this._editors.modified);
        scrollState = void 0;
      }
    }, modViewZoneIdsToIgnore));
    this._accessibleDiffViewer = derivedDisposable(
      this,
      (reader) => this._instantiationService.createInstance(
        readHotReloadableExport(AccessibleDiffViewer, reader),
        this.elements.accessibleDiffViewer,
        this._accessibleDiffViewerVisible,
        (visible, tx) => this._accessibleDiffViewerShouldBeVisible.set(visible, tx),
        this._options.onlyShowAccessibleDiffViewer.map((v) => !v),
        this._rootSizeObserver.width,
        this._rootSizeObserver.height,
        this._diffModel.map((m, r) => m?.diff.read(r)?.mappings.map((m2) => m2.lineRangeMapping)),
        new AccessibleDiffViewerModelFromEditors(this._editors)
      )
    ).recomputeInitiallyAndOnChange(this._store);
    const visibility = this._accessibleDiffViewerVisible.map((v) => v ? "hidden" : "visible");
    this._register(applyStyle(this.elements.modified, { visibility }));
    this._register(applyStyle(this.elements.original, { visibility }));
    this._createDiffEditorContributions();
    codeEditorService.addDiffEditor(this);
    this._gutter = derivedDisposable(this, (reader) => {
      return this._options.shouldRenderGutterMenu.read(reader) ? this._instantiationService.createInstance(
        readHotReloadableExport(DiffEditorGutter, reader),
        this.elements.root,
        this._diffModel,
        this._editors,
        this._options,
        this._sashLayout,
        this._boundarySashes
      ) : void 0;
    });
    this._register(recomputeInitiallyAndOnChange(this._layoutInfo));
    derivedDisposable(
      this,
      (reader) => (
        /** @description MovedBlocksLinesPart */
        new (readHotReloadableExport(MovedBlocksLinesFeature, reader))(
          this.elements.root,
          this._diffModel,
          this._layoutInfo.map((i) => i.originalEditor),
          this._layoutInfo.map((i) => i.modifiedEditor),
          this._editors
        )
      )
    ).recomputeInitiallyAndOnChange(this._store, (value) => {
      this._movedBlocksLinesPart.set(value, void 0);
    });
    this._register(Event.runAndSubscribe(this._editors.modified.onDidChangeCursorPosition, (e) => this._handleCursorPositionChange(e, true)));
    this._register(Event.runAndSubscribe(this._editors.original.onDidChangeCursorPosition, (e) => this._handleCursorPositionChange(e, false)));
    const isInitializingDiff = this._diffModel.map(this, (m, reader) => {
      if (!m) {
        return void 0;
      }
      return m.diff.read(reader) === void 0 && !m.isDiffUpToDate.read(reader);
    });
    this._register(autorunWithStore((reader, store) => {
      if (isInitializingDiff.read(reader) === true) {
        const r = this._editorProgressService.show(true, 1e3);
        store.add(toDisposable(() => r.done()));
      }
    }));
    this._register(autorunWithStore((reader, store) => {
      store.add(new (readHotReloadableExport(RevertButtonsFeature, reader))(this._editors, this._diffModel, this._options, this));
    }));
    this._register(autorunWithStore((reader, store) => {
      const model = this._diffModel.read(reader);
      if (!model) {
        return;
      }
      for (const m of [model.model.original, model.model.modified]) {
        store.add(m.onWillDispose((e) => {
          onUnexpectedError(new BugIndicatingError("TextModel got disposed before DiffEditorWidget model got reset"));
          this.setModel(null);
        }));
      }
    }));
    this._register(autorun((reader) => {
      this._options.setModel(this._diffModel.read(reader));
    }));
  }
  get onDidContentSizeChange() {
    return this._editors.onDidContentSizeChange;
  }
  get collapseUnchangedRegions() {
    return this._options.hideUnchangedRegions.get();
  }
  getViewWidth() {
    return this._rootSizeObserver.width.get();
  }
  getContentHeight() {
    return this._editors.modified.getContentHeight();
  }
  _createInnerEditor(instantiationService, container, options, editorWidgetOptions) {
    const editor = instantiationService.createInstance(CodeEditorWidget, container, options, editorWidgetOptions);
    return editor;
  }
  _createDiffEditorContributions() {
    const contributions = EditorExtensionsRegistry.getDiffEditorContributions();
    for (const desc of contributions) {
      try {
        this._register(this._instantiationService.createInstance(desc.ctor, this));
      } catch (err) {
        onUnexpectedError(err);
      }
    }
  }
  get _targetEditor() {
    return this._editors.modified;
  }
  getEditorType() {
    return EditorType.IDiffEditor;
  }
  onVisible() {
    this._editors.original.onVisible();
    this._editors.modified.onVisible();
  }
  onHide() {
    this._editors.original.onHide();
    this._editors.modified.onHide();
  }
  layout(dimension) {
    this._rootSizeObserver.observe(dimension);
  }
  hasTextFocus() {
    return this._editors.original.hasTextFocus() || this._editors.modified.hasTextFocus();
  }
  saveViewState() {
    const originalViewState = this._editors.original.saveViewState();
    const modifiedViewState = this._editors.modified.saveViewState();
    return {
      original: originalViewState,
      modified: modifiedViewState,
      modelState: this._diffModel.get()?.serializeState()
    };
  }
  restoreViewState(s) {
    if (s && s.original && s.modified) {
      const diffEditorState = s;
      this._editors.original.restoreViewState(diffEditorState.original);
      this._editors.modified.restoreViewState(diffEditorState.modified);
      if (diffEditorState.modelState) {
        this._diffModel.get()?.restoreSerializedState(diffEditorState.modelState);
      }
    }
  }
  handleInitialized() {
    this._editors.original.handleInitialized();
    this._editors.modified.handleInitialized();
  }
  createViewModel(model) {
    return this._instantiationService.createInstance(DiffEditorViewModel, model, this._options);
  }
  getModel() {
    return this._diffModel.get()?.model ?? null;
  }
  setModel(model) {
    const vm = !model ? null : "model" in model ? RefCounted.create(model).createNewRef(this) : RefCounted.create(this.createViewModel(model), this);
    this.setDiffModel(vm);
  }
  setDiffModel(viewModel, tx) {
    const currentModel = this._diffModel.get();
    if (!viewModel && currentModel) {
      this._accessibleDiffViewer.get().close();
    }
    if (this._diffModel.get() !== viewModel?.object) {
      subtransaction(tx, (tx2) => {
        const vm = viewModel?.object;
        observableFromEvent.batchEventsGlobally(tx2, () => {
          this._editors.original.setModel(vm ? vm.model.original : null);
          this._editors.modified.setModel(vm ? vm.model.modified : null);
        });
        const prevValueRef = this._diffModelSrc.get()?.createNewRef(this);
        this._diffModelSrc.set(viewModel?.createNewRef(this), tx2);
        setTimeout(() => {
          prevValueRef?.dispose();
        }, 0);
      });
    }
  }
  /**
   * @param changedOptions Only has values for top-level options that have actually changed.
   */
  updateOptions(changedOptions) {
    this._options.updateOptions(changedOptions);
  }
  getDomNode() {
    return this.elements.root;
  }
  getContainerDomNode() {
    return this._domElement;
  }
  getOriginalEditor() {
    return this._editors.original;
  }
  getModifiedEditor() {
    return this._editors.modified;
  }
  setBoundarySashes(sashes) {
    this._boundarySashes.set(sashes, void 0);
  }
  get ignoreTrimWhitespace() {
    return this._options.ignoreTrimWhitespace.get();
  }
  get maxComputationTime() {
    return this._options.maxComputationTimeMs.get();
  }
  get renderSideBySide() {
    return this._options.renderSideBySide.get();
  }
  /**
   * @deprecated Use `this.getDiffComputationResult().changes2` instead.
   */
  getLineChanges() {
    const diffState = this._diffModel.get()?.diff.get();
    if (!diffState) {
      return null;
    }
    return toLineChanges(diffState);
  }
  getDiffComputationResult() {
    const diffState = this._diffModel.get()?.diff.get();
    if (!diffState) {
      return null;
    }
    return {
      changes: this.getLineChanges(),
      changes2: diffState.mappings.map((m) => m.lineRangeMapping),
      identical: diffState.identical,
      quitEarly: diffState.quitEarly
    };
  }
  revert(diff) {
    const model = this._diffModel.get();
    if (!model || !model.isDiffUpToDate.get()) {
      return;
    }
    this._editors.modified.executeEdits("diffEditor", [
      {
        range: diff.modified.toExclusiveRange(),
        text: model.model.original.getValueInRange(diff.original.toExclusiveRange())
      }
    ]);
  }
  revertRangeMappings(diffs) {
    const model = this._diffModel.get();
    if (!model || !model.isDiffUpToDate.get()) {
      return;
    }
    const changes = diffs.map((c) => ({
      range: c.modifiedRange,
      text: model.model.original.getValueInRange(c.originalRange)
    }));
    this._editors.modified.executeEdits("diffEditor", changes);
  }
  _goTo(diff) {
    this._editors.modified.setPosition(new Position(diff.lineRangeMapping.modified.startLineNumber, 1));
    this._editors.modified.revealRangeInCenter(diff.lineRangeMapping.modified.toExclusiveRange());
  }
  goToDiff(target) {
    const diffs = this._diffModel.get()?.diff.get()?.mappings;
    if (!diffs || diffs.length === 0) {
      return;
    }
    const curLineNumber = this._editors.modified.getPosition().lineNumber;
    let diff;
    if (target === "next") {
      diff = diffs.find((d) => d.lineRangeMapping.modified.startLineNumber > curLineNumber) ?? diffs[0];
    } else {
      diff = findLast(diffs, (d) => d.lineRangeMapping.modified.startLineNumber < curLineNumber) ?? diffs[diffs.length - 1];
    }
    this._goTo(diff);
    if (diff.lineRangeMapping.modified.isEmpty) {
      this._accessibilitySignalService.playSignal(AccessibilitySignal.diffLineDeleted, { source: "diffEditor.goToDiff" });
    } else if (diff.lineRangeMapping.original.isEmpty) {
      this._accessibilitySignalService.playSignal(AccessibilitySignal.diffLineInserted, { source: "diffEditor.goToDiff" });
    } else if (diff) {
      this._accessibilitySignalService.playSignal(AccessibilitySignal.diffLineModified, { source: "diffEditor.goToDiff" });
    }
  }
  revealFirstDiff() {
    const diffModel = this._diffModel.get();
    if (!diffModel) {
      return;
    }
    this.waitForDiff().then(() => {
      const diffs = diffModel.diff.get()?.mappings;
      if (!diffs || diffs.length === 0) {
        return;
      }
      this._goTo(diffs[0]);
    });
  }
  accessibleDiffViewerNext() {
    this._accessibleDiffViewer.get().next();
  }
  accessibleDiffViewerPrev() {
    this._accessibleDiffViewer.get().prev();
  }
  async waitForDiff() {
    const diffModel = this._diffModel.get();
    if (!diffModel) {
      return;
    }
    await diffModel.waitForDiff();
  }
  mapToOtherSide() {
    const isModifiedFocus = this._editors.modified.hasWidgetFocus();
    const source = isModifiedFocus ? this._editors.modified : this._editors.original;
    const destination = isModifiedFocus ? this._editors.original : this._editors.modified;
    let destinationSelection;
    const sourceSelection = source.getSelection();
    if (sourceSelection) {
      const mappings = this._diffModel.get()?.diff.get()?.mappings.map((m) => isModifiedFocus ? m.lineRangeMapping.flip() : m.lineRangeMapping);
      if (mappings) {
        const newRange1 = translatePosition(sourceSelection.getStartPosition(), mappings);
        const newRange2 = translatePosition(sourceSelection.getEndPosition(), mappings);
        destinationSelection = Range.plusRange(newRange1, newRange2);
      }
    }
    return { destination, destinationSelection };
  }
  switchSide() {
    const { destination, destinationSelection } = this.mapToOtherSide();
    destination.focus();
    if (destinationSelection) {
      destination.setSelection(destinationSelection);
    }
  }
  exitCompareMove() {
    const model = this._diffModel.get();
    if (!model) {
      return;
    }
    model.movedTextToCompare.set(void 0, void 0);
  }
  collapseAllUnchangedRegions() {
    const unchangedRegions = this._diffModel.get()?.unchangedRegions.get();
    if (!unchangedRegions) {
      return;
    }
    transaction((tx) => {
      for (const region of unchangedRegions) {
        region.collapseAll(tx);
      }
    });
  }
  showAllUnchangedRegions() {
    const unchangedRegions = this._diffModel.get()?.unchangedRegions.get();
    if (!unchangedRegions) {
      return;
    }
    transaction((tx) => {
      for (const region of unchangedRegions) {
        region.showAll(tx);
      }
    });
  }
  _handleCursorPositionChange(e, isModifiedEditor) {
    if (e?.reason === CursorChangeReason.Explicit) {
      const diff = this._diffModel.get()?.diff.get()?.mappings.find((m) => isModifiedEditor ? m.lineRangeMapping.modified.contains(e.position.lineNumber) : m.lineRangeMapping.original.contains(e.position.lineNumber));
      if (diff?.lineRangeMapping.modified.isEmpty) {
        this._accessibilitySignalService.playSignal(AccessibilitySignal.diffLineDeleted, { source: "diffEditor.cursorPositionChanged" });
      } else if (diff?.lineRangeMapping.original.isEmpty) {
        this._accessibilitySignalService.playSignal(AccessibilitySignal.diffLineInserted, { source: "diffEditor.cursorPositionChanged" });
      } else if (diff) {
        this._accessibilitySignalService.playSignal(AccessibilitySignal.diffLineModified, { source: "diffEditor.cursorPositionChanged" });
      }
    }
  }
};
DiffEditorWidget.ENTIRE_DIFF_OVERVIEW_WIDTH = OverviewRulerFeature.ENTIRE_DIFF_OVERVIEW_WIDTH;
DiffEditorWidget = __decorateClass([
  __decorateParam(3, IContextKeyService),
  __decorateParam(4, IInstantiationService),
  __decorateParam(5, ICodeEditorService),
  __decorateParam(6, IAccessibilitySignalService),
  __decorateParam(7, IEditorProgressService)
], DiffEditorWidget);
function toLineChanges(state) {
  return state.mappings.map((x) => {
    const m = x.lineRangeMapping;
    let originalStartLineNumber;
    let originalEndLineNumber;
    let modifiedStartLineNumber;
    let modifiedEndLineNumber;
    let innerChanges = m.innerChanges;
    if (m.original.isEmpty) {
      originalStartLineNumber = m.original.startLineNumber - 1;
      originalEndLineNumber = 0;
      innerChanges = void 0;
    } else {
      originalStartLineNumber = m.original.startLineNumber;
      originalEndLineNumber = m.original.endLineNumberExclusive - 1;
    }
    if (m.modified.isEmpty) {
      modifiedStartLineNumber = m.modified.startLineNumber - 1;
      modifiedEndLineNumber = 0;
      innerChanges = void 0;
    } else {
      modifiedStartLineNumber = m.modified.startLineNumber;
      modifiedEndLineNumber = m.modified.endLineNumberExclusive - 1;
    }
    return {
      originalStartLineNumber,
      originalEndLineNumber,
      modifiedStartLineNumber,
      modifiedEndLineNumber,
      charChanges: innerChanges?.map((m2) => ({
        originalStartLineNumber: m2.originalRange.startLineNumber,
        originalStartColumn: m2.originalRange.startColumn,
        originalEndLineNumber: m2.originalRange.endLineNumber,
        originalEndColumn: m2.originalRange.endColumn,
        modifiedStartLineNumber: m2.modifiedRange.startLineNumber,
        modifiedStartColumn: m2.modifiedRange.startColumn,
        modifiedEndLineNumber: m2.modifiedRange.endLineNumber,
        modifiedEndColumn: m2.modifiedRange.endColumn
      }))
    };
  });
}
export {
  DiffEditorWidget,
  toLineChanges
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy9lZGl0b3IvYnJvd3Nlci93aWRnZXQvZGlmZkVkaXRvci9kaWZmRWRpdG9yV2lkZ2V0LnRzIl0sCiAgInNvdXJjZXNDb250ZW50IjogWyIvKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuICogIENvcHlyaWdodCAoYykgTWljcm9zb2Z0IENvcnBvcmF0aW9uLiBBbGwgcmlnaHRzIHJlc2VydmVkLlxuICogIExpY2Vuc2VkIHVuZGVyIHRoZSBNSVQgTGljZW5zZS4gU2VlIExpY2Vuc2UudHh0IGluIHRoZSBwcm9qZWN0IHJvb3QgZm9yIGxpY2Vuc2UgaW5mb3JtYXRpb24uXG4gKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tKi9cbmltcG9ydCB7IGdldFdpbmRvdywgaCB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvYnJvd3Nlci9kb20uanMnO1xuaW1wb3J0IHsgSUJvdW5kYXJ5U2FzaGVzIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9icm93c2VyL3VpL3Nhc2gvc2FzaC5qcyc7XG5pbXBvcnQgeyBmaW5kTGFzdCB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2FycmF5c0ZpbmQuanMnO1xuaW1wb3J0IHsgQnVnSW5kaWNhdGluZ0Vycm9yLCBvblVuZXhwZWN0ZWRFcnJvciB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2Vycm9ycy5qcyc7XG5pbXBvcnQgeyBFdmVudCB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2V2ZW50LmpzJztcbmltcG9ydCB7IHJlYWRIb3RSZWxvYWRhYmxlRXhwb3J0IH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vaG90UmVsb2FkSGVscGVycy5qcyc7XG5pbXBvcnQgeyB0b0Rpc3Bvc2FibGUgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9saWZlY3ljbGUuanMnO1xuaW1wb3J0IHsgSU9ic2VydmFibGUsIElUcmFuc2FjdGlvbiwgYXV0b3J1biwgYXV0b3J1bldpdGhTdG9yZSwgZGVyaXZlZCwgZGVyaXZlZERpc3Bvc2FibGUsIGRpc3Bvc2FibGVPYnNlcnZhYmxlVmFsdWUsIG9ic2VydmFibGVGcm9tRXZlbnQsIG9ic2VydmFibGVWYWx1ZSwgcmVjb21wdXRlSW5pdGlhbGx5QW5kT25DaGFuZ2UsIHN1YnRyYW5zYWN0aW9uLCB0cmFuc2FjdGlvbiB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL29ic2VydmFibGUuanMnO1xuaW1wb3J0IHsgQWNjZXNzaWJpbGl0eVNpZ25hbCwgSUFjY2Vzc2liaWxpdHlTaWduYWxTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vYWNjZXNzaWJpbGl0eVNpZ25hbC9icm93c2VyL2FjY2Vzc2liaWxpdHlTaWduYWxTZXJ2aWNlLmpzJztcbmltcG9ydCB7IElDb250ZXh0S2V5U2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL2NvbnRleHRrZXkvY29tbW9uL2NvbnRleHRrZXkuanMnO1xuaW1wb3J0IHsgSUluc3RhbnRpYXRpb25TZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vaW5zdGFudGlhdGlvbi9jb21tb24vaW5zdGFudGlhdGlvbi5qcyc7XG5pbXBvcnQgeyBTZXJ2aWNlQ29sbGVjdGlvbiB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL2luc3RhbnRpYXRpb24vY29tbW9uL3NlcnZpY2VDb2xsZWN0aW9uLmpzJztcbmltcG9ydCB7IGJpbmRDb250ZXh0S2V5IH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vb2JzZXJ2YWJsZS9jb21tb24vcGxhdGZvcm1PYnNlcnZhYmxlVXRpbHMuanMnO1xuaW1wb3J0IHsgSUVkaXRvclByb2dyZXNzU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL3Byb2dyZXNzL2NvbW1vbi9wcm9ncmVzcy5qcyc7XG5pbXBvcnQgeyBJRGlmZkVkaXRvck9wdGlvbnMgfSBmcm9tICcuLi8uLi8uLi9jb21tb24vY29uZmlnL2VkaXRvck9wdGlvbnMuanMnO1xuaW1wb3J0IHsgSURpbWVuc2lvbiB9IGZyb20gJy4uLy4uLy4uL2NvbW1vbi9jb3JlL2RpbWVuc2lvbi5qcyc7XG5pbXBvcnQgeyBQb3NpdGlvbiB9IGZyb20gJy4uLy4uLy4uL2NvbW1vbi9jb3JlL3Bvc2l0aW9uLmpzJztcbmltcG9ydCB7IFJhbmdlIH0gZnJvbSAnLi4vLi4vLi4vY29tbW9uL2NvcmUvcmFuZ2UuanMnO1xuaW1wb3J0IHsgQ3Vyc29yQ2hhbmdlUmVhc29uLCBJQ3Vyc29yUG9zaXRpb25DaGFuZ2VkRXZlbnQgfSBmcm9tICcuLi8uLi8uLi9jb21tb24vY3Vyc29yRXZlbnRzLmpzJztcbmltcG9ydCB7IElEaWZmQ29tcHV0YXRpb25SZXN1bHQsIElMaW5lQ2hhbmdlIH0gZnJvbSAnLi4vLi4vLi4vY29tbW9uL2RpZmYvbGVnYWN5TGluZXNEaWZmQ29tcHV0ZXIuanMnO1xuaW1wb3J0IHsgTGluZVJhbmdlTWFwcGluZywgUmFuZ2VNYXBwaW5nIH0gZnJvbSAnLi4vLi4vLi4vY29tbW9uL2RpZmYvcmFuZ2VNYXBwaW5nLmpzJztcbmltcG9ydCB7IEVkaXRvclR5cGUsIElEaWZmRWRpdG9yTW9kZWwsIElEaWZmRWRpdG9yVmlld01vZGVsLCBJRGlmZkVkaXRvclZpZXdTdGF0ZSB9IGZyb20gJy4uLy4uLy4uL2NvbW1vbi9lZGl0b3JDb21tb24uanMnO1xuaW1wb3J0IHsgRWRpdG9yQ29udGV4dEtleXMgfSBmcm9tICcuLi8uLi8uLi9jb21tb24vZWRpdG9yQ29udGV4dEtleXMuanMnO1xuaW1wb3J0IHsgSUlkZW50aWZpZWRTaW5nbGVFZGl0T3BlcmF0aW9uIH0gZnJvbSAnLi4vLi4vLi4vY29tbW9uL21vZGVsLmpzJztcbmltcG9ydCB7IElFZGl0b3JDb25zdHJ1Y3Rpb25PcHRpb25zIH0gZnJvbSAnLi4vLi4vY29uZmlnL2VkaXRvckNvbmZpZ3VyYXRpb24uanMnO1xuaW1wb3J0IHsgSUNvZGVFZGl0b3IsIElEaWZmRWRpdG9yLCBJRGlmZkVkaXRvckNvbnN0cnVjdGlvbk9wdGlvbnMgfSBmcm9tICcuLi8uLi9lZGl0b3JCcm93c2VyLmpzJztcbmltcG9ydCB7IEVkaXRvckV4dGVuc2lvbnNSZWdpc3RyeSwgSURpZmZFZGl0b3JDb250cmlidXRpb25EZXNjcmlwdGlvbiB9IGZyb20gJy4uLy4uL2VkaXRvckV4dGVuc2lvbnMuanMnO1xuaW1wb3J0IHsgSUNvZGVFZGl0b3JTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vc2VydmljZXMvY29kZUVkaXRvclNlcnZpY2UuanMnO1xuaW1wb3J0IHsgU3RhYmxlRWRpdG9yU2Nyb2xsU3RhdGUgfSBmcm9tICcuLi8uLi9zdGFibGVFZGl0b3JTY3JvbGwuanMnO1xuaW1wb3J0IHsgQ29kZUVkaXRvcldpZGdldCwgSUNvZGVFZGl0b3JXaWRnZXRPcHRpb25zIH0gZnJvbSAnLi4vY29kZUVkaXRvci9jb2RlRWRpdG9yV2lkZ2V0LmpzJztcbmltcG9ydCB7IEFjY2Vzc2libGVEaWZmVmlld2VyLCBBY2Nlc3NpYmxlRGlmZlZpZXdlck1vZGVsRnJvbUVkaXRvcnMgfSBmcm9tICcuL2NvbXBvbmVudHMvYWNjZXNzaWJsZURpZmZWaWV3ZXIuanMnO1xuaW1wb3J0IHsgRGlmZkVkaXRvckRlY29yYXRpb25zIH0gZnJvbSAnLi9jb21wb25lbnRzL2RpZmZFZGl0b3JEZWNvcmF0aW9ucy5qcyc7XG5pbXBvcnQgeyBEaWZmRWRpdG9yRWRpdG9ycyB9IGZyb20gJy4vY29tcG9uZW50cy9kaWZmRWRpdG9yRWRpdG9ycy5qcyc7XG5pbXBvcnQgeyBEaWZmRWRpdG9yU2FzaCwgU2FzaExheW91dCB9IGZyb20gJy4vY29tcG9uZW50cy9kaWZmRWRpdG9yU2FzaC5qcyc7XG5pbXBvcnQgeyBEaWZmRWRpdG9yVmlld1pvbmVzIH0gZnJvbSAnLi9jb21wb25lbnRzL2RpZmZFZGl0b3JWaWV3Wm9uZXMvZGlmZkVkaXRvclZpZXdab25lcy5qcyc7XG5pbXBvcnQgeyBEZWxlZ2F0aW5nRWRpdG9yIH0gZnJvbSAnLi9kZWxlZ2F0aW5nRWRpdG9ySW1wbC5qcyc7XG5pbXBvcnQgeyBEaWZmRWRpdG9yT3B0aW9ucyB9IGZyb20gJy4vZGlmZkVkaXRvck9wdGlvbnMuanMnO1xuaW1wb3J0IHsgRGlmZkVkaXRvclZpZXdNb2RlbCwgRGlmZk1hcHBpbmcsIERpZmZTdGF0ZSB9IGZyb20gJy4vZGlmZkVkaXRvclZpZXdNb2RlbC5qcyc7XG5pbXBvcnQgeyBEaWZmRWRpdG9yR3V0dGVyIH0gZnJvbSAnLi9mZWF0dXJlcy9ndXR0ZXJGZWF0dXJlLmpzJztcbmltcG9ydCB7IEhpZGVVbmNoYW5nZWRSZWdpb25zRmVhdHVyZSB9IGZyb20gJy4vZmVhdHVyZXMvaGlkZVVuY2hhbmdlZFJlZ2lvbnNGZWF0dXJlLmpzJztcbmltcG9ydCB7IE1vdmVkQmxvY2tzTGluZXNGZWF0dXJlIH0gZnJvbSAnLi9mZWF0dXJlcy9tb3ZlZEJsb2Nrc0xpbmVzRmVhdHVyZS5qcyc7XG5pbXBvcnQgeyBPdmVydmlld1J1bGVyRmVhdHVyZSB9IGZyb20gJy4vZmVhdHVyZXMvb3ZlcnZpZXdSdWxlckZlYXR1cmUuanMnO1xuaW1wb3J0IHsgUmV2ZXJ0QnV0dG9uc0ZlYXR1cmUgfSBmcm9tICcuL2ZlYXR1cmVzL3JldmVydEJ1dHRvbnNGZWF0dXJlLmpzJztcbmltcG9ydCAnLi9zdHlsZS5jc3MnO1xuaW1wb3J0IHsgQ1NTU3R5bGUsIE9ic2VydmFibGVFbGVtZW50U2l6ZU9ic2VydmVyLCBSZWZDb3VudGVkLCBhcHBseVN0eWxlLCBhcHBseVZpZXdab25lcywgdHJhbnNsYXRlUG9zaXRpb24gfSBmcm9tICcuL3V0aWxzLmpzJztcblxuZXhwb3J0IGludGVyZmFjZSBJRGlmZkNvZGVFZGl0b3JXaWRnZXRPcHRpb25zIHtcblx0b3JpZ2luYWxFZGl0b3I/OiBJQ29kZUVkaXRvcldpZGdldE9wdGlvbnM7XG5cdG1vZGlmaWVkRWRpdG9yPzogSUNvZGVFZGl0b3JXaWRnZXRPcHRpb25zO1xufVxuXG5leHBvcnQgY2xhc3MgRGlmZkVkaXRvcldpZGdldCBleHRlbmRzIERlbGVnYXRpbmdFZGl0b3IgaW1wbGVtZW50cyBJRGlmZkVkaXRvciB7XG5cdHB1YmxpYyBzdGF0aWMgRU5USVJFX0RJRkZfT1ZFUlZJRVdfV0lEVEggPSBPdmVydmlld1J1bGVyRmVhdHVyZS5FTlRJUkVfRElGRl9PVkVSVklFV19XSURUSDtcblxuXHRwcml2YXRlIHJlYWRvbmx5IGVsZW1lbnRzID0gaCgnZGl2Lm1vbmFjby1kaWZmLWVkaXRvci5zaWRlLWJ5LXNpZGUnLCB7IHN0eWxlOiB7IHBvc2l0aW9uOiAncmVsYXRpdmUnLCBoZWlnaHQ6ICcxMDAlJyB9IH0sIFtcblx0XHRoKCdkaXYuZWRpdG9yLm9yaWdpbmFsQG9yaWdpbmFsJywgeyBzdHlsZTogeyBwb3NpdGlvbjogJ2Fic29sdXRlJywgaGVpZ2h0OiAnMTAwJScsIH0gfSksXG5cdFx0aCgnZGl2LmVkaXRvci5tb2RpZmllZEBtb2RpZmllZCcsIHsgc3R5bGU6IHsgcG9zaXRpb246ICdhYnNvbHV0ZScsIGhlaWdodDogJzEwMCUnLCB9IH0pLFxuXHRcdGgoJ2Rpdi5hY2Nlc3NpYmxlRGlmZlZpZXdlckBhY2Nlc3NpYmxlRGlmZlZpZXdlcicsIHsgc3R5bGU6IHsgcG9zaXRpb246ICdhYnNvbHV0ZScsIGhlaWdodDogJzEwMCUnIH0gfSksXG5cdF0pO1xuXHRwcml2YXRlIHJlYWRvbmx5IF9kaWZmTW9kZWxTcmMgPSB0aGlzLl9yZWdpc3RlcihkaXNwb3NhYmxlT2JzZXJ2YWJsZVZhbHVlPFJlZkNvdW50ZWQ8RGlmZkVkaXRvclZpZXdNb2RlbD4gfCB1bmRlZmluZWQ+KHRoaXMsIHVuZGVmaW5lZCkpO1xuXHRwcml2YXRlIHJlYWRvbmx5IF9kaWZmTW9kZWwgPSBkZXJpdmVkPERpZmZFZGl0b3JWaWV3TW9kZWwgfCB1bmRlZmluZWQ+KHRoaXMsIHJlYWRlciA9PiB0aGlzLl9kaWZmTW9kZWxTcmMucmVhZChyZWFkZXIpPy5vYmplY3QpO1xuXHRwdWJsaWMgcmVhZG9ubHkgb25EaWRDaGFuZ2VNb2RlbCA9IEV2ZW50LmZyb21PYnNlcnZhYmxlTGlnaHQodGhpcy5fZGlmZk1vZGVsKTtcblxuXHRwdWJsaWMgZ2V0IG9uRGlkQ29udGVudFNpemVDaGFuZ2UoKSB7IHJldHVybiB0aGlzLl9lZGl0b3JzLm9uRGlkQ29udGVudFNpemVDaGFuZ2U7IH1cblxuXHRwcml2YXRlIHJlYWRvbmx5IF9jb250ZXh0S2V5U2VydmljZSA9IHRoaXMuX3JlZ2lzdGVyKHRoaXMuX3BhcmVudENvbnRleHRLZXlTZXJ2aWNlLmNyZWF0ZVNjb3BlZCh0aGlzLl9kb21FbGVtZW50KSk7XG5cdHByaXZhdGUgcmVhZG9ubHkgX2luc3RhbnRpYXRpb25TZXJ2aWNlID0gdGhpcy5fcmVnaXN0ZXIodGhpcy5fcGFyZW50SW5zdGFudGlhdGlvblNlcnZpY2UuY3JlYXRlQ2hpbGQoXG5cdFx0bmV3IFNlcnZpY2VDb2xsZWN0aW9uKFtJQ29udGV4dEtleVNlcnZpY2UsIHRoaXMuX2NvbnRleHRLZXlTZXJ2aWNlXSlcblx0KSk7XG5cdHByaXZhdGUgcmVhZG9ubHkgX3Jvb3RTaXplT2JzZXJ2ZXI6IE9ic2VydmFibGVFbGVtZW50U2l6ZU9ic2VydmVyO1xuXG5cblx0cHJpdmF0ZSByZWFkb25seSBfc2FzaExheW91dDogU2FzaExheW91dDtcblx0cHJpdmF0ZSByZWFkb25seSBfc2FzaDogSU9ic2VydmFibGU8RGlmZkVkaXRvclNhc2ggfCB1bmRlZmluZWQ+O1xuXHRwcml2YXRlIHJlYWRvbmx5IF9ib3VuZGFyeVNhc2hlcyA9IG9ic2VydmFibGVWYWx1ZTxJQm91bmRhcnlTYXNoZXMgfCB1bmRlZmluZWQ+KHRoaXMsIHVuZGVmaW5lZCk7XG5cblx0cHJpdmF0ZSBfYWNjZXNzaWJsZURpZmZWaWV3ZXJTaG91bGRCZVZpc2libGUgPSBvYnNlcnZhYmxlVmFsdWUodGhpcywgZmFsc2UpO1xuXHRwcml2YXRlIF9hY2Nlc3NpYmxlRGlmZlZpZXdlclZpc2libGUgPSBkZXJpdmVkKHRoaXMsIHJlYWRlciA9PlxuXHRcdHRoaXMuX29wdGlvbnMub25seVNob3dBY2Nlc3NpYmxlRGlmZlZpZXdlci5yZWFkKHJlYWRlcilcblx0XHRcdD8gdHJ1ZVxuXHRcdFx0OiB0aGlzLl9hY2Nlc3NpYmxlRGlmZlZpZXdlclNob3VsZEJlVmlzaWJsZS5yZWFkKHJlYWRlcilcblx0KTtcblx0cHJpdmF0ZSByZWFkb25seSBfYWNjZXNzaWJsZURpZmZWaWV3ZXI6IElPYnNlcnZhYmxlPEFjY2Vzc2libGVEaWZmVmlld2VyPjtcblx0cHJpdmF0ZSByZWFkb25seSBfb3B0aW9uczogRGlmZkVkaXRvck9wdGlvbnM7XG5cdHByaXZhdGUgcmVhZG9ubHkgX2VkaXRvcnM6IERpZmZFZGl0b3JFZGl0b3JzO1xuXG5cdHByaXZhdGUgcmVhZG9ubHkgX292ZXJ2aWV3UnVsZXJQYXJ0OiBJT2JzZXJ2YWJsZTxPdmVydmlld1J1bGVyRmVhdHVyZSB8IHVuZGVmaW5lZD47XG5cdHByaXZhdGUgcmVhZG9ubHkgX21vdmVkQmxvY2tzTGluZXNQYXJ0ID0gb2JzZXJ2YWJsZVZhbHVlPE1vdmVkQmxvY2tzTGluZXNGZWF0dXJlIHwgdW5kZWZpbmVkPih0aGlzLCB1bmRlZmluZWQpO1xuXG5cdHByaXZhdGUgcmVhZG9ubHkgX2d1dHRlcjogSU9ic2VydmFibGU8RGlmZkVkaXRvckd1dHRlciB8IHVuZGVmaW5lZD47XG5cblx0cHVibGljIGdldCBjb2xsYXBzZVVuY2hhbmdlZFJlZ2lvbnMoKSB7IHJldHVybiB0aGlzLl9vcHRpb25zLmhpZGVVbmNoYW5nZWRSZWdpb25zLmdldCgpOyB9XG5cblx0Y29uc3RydWN0b3IoXG5cdFx0cHJpdmF0ZSByZWFkb25seSBfZG9tRWxlbWVudDogSFRNTEVsZW1lbnQsXG5cdFx0b3B0aW9uczogUmVhZG9ubHk8SURpZmZFZGl0b3JDb25zdHJ1Y3Rpb25PcHRpb25zPixcblx0XHRjb2RlRWRpdG9yV2lkZ2V0T3B0aW9uczogSURpZmZDb2RlRWRpdG9yV2lkZ2V0T3B0aW9ucyxcblx0XHRASUNvbnRleHRLZXlTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgX3BhcmVudENvbnRleHRLZXlTZXJ2aWNlOiBJQ29udGV4dEtleVNlcnZpY2UsXG5cdFx0QElJbnN0YW50aWF0aW9uU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IF9wYXJlbnRJbnN0YW50aWF0aW9uU2VydmljZTogSUluc3RhbnRpYXRpb25TZXJ2aWNlLFxuXHRcdEBJQ29kZUVkaXRvclNlcnZpY2UgY29kZUVkaXRvclNlcnZpY2U6IElDb2RlRWRpdG9yU2VydmljZSxcblx0XHRASUFjY2Vzc2liaWxpdHlTaWduYWxTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgX2FjY2Vzc2liaWxpdHlTaWduYWxTZXJ2aWNlOiBJQWNjZXNzaWJpbGl0eVNpZ25hbFNlcnZpY2UsXG5cdFx0QElFZGl0b3JQcm9ncmVzc1NlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBfZWRpdG9yUHJvZ3Jlc3NTZXJ2aWNlOiBJRWRpdG9yUHJvZ3Jlc3NTZXJ2aWNlLFxuXHQpIHtcblx0XHRzdXBlcigpO1xuXHRcdGNvZGVFZGl0b3JTZXJ2aWNlLndpbGxDcmVhdGVEaWZmRWRpdG9yKCk7XG5cblx0XHR0aGlzLl9jb250ZXh0S2V5U2VydmljZS5jcmVhdGVLZXkoJ2lzSW5EaWZmRWRpdG9yJywgdHJ1ZSk7XG5cblx0XHR0aGlzLl9kb21FbGVtZW50LmFwcGVuZENoaWxkKHRoaXMuZWxlbWVudHMucm9vdCk7XG5cdFx0dGhpcy5fcmVnaXN0ZXIodG9EaXNwb3NhYmxlKCgpID0+IHRoaXMuZWxlbWVudHMucm9vdC5yZW1vdmUoKSkpO1xuXG5cdFx0dGhpcy5fcm9vdFNpemVPYnNlcnZlciA9IHRoaXMuX3JlZ2lzdGVyKG5ldyBPYnNlcnZhYmxlRWxlbWVudFNpemVPYnNlcnZlcih0aGlzLmVsZW1lbnRzLnJvb3QsIG9wdGlvbnMuZGltZW5zaW9uKSk7XG5cdFx0dGhpcy5fcm9vdFNpemVPYnNlcnZlci5zZXRBdXRvbWF0aWNMYXlvdXQob3B0aW9ucy5hdXRvbWF0aWNMYXlvdXQgPz8gZmFsc2UpO1xuXG5cdFx0dGhpcy5fb3B0aW9ucyA9IHRoaXMuX2luc3RhbnRpYXRpb25TZXJ2aWNlLmNyZWF0ZUluc3RhbmNlKERpZmZFZGl0b3JPcHRpb25zLCBvcHRpb25zKTtcblx0XHR0aGlzLl9yZWdpc3RlcihhdXRvcnVuKHJlYWRlciA9PiB7XG5cdFx0XHR0aGlzLl9vcHRpb25zLnNldFdpZHRoKHRoaXMuX3Jvb3RTaXplT2JzZXJ2ZXIud2lkdGgucmVhZChyZWFkZXIpKTtcblx0XHR9KSk7XG5cblx0XHR0aGlzLl9jb250ZXh0S2V5U2VydmljZS5jcmVhdGVLZXkoRWRpdG9yQ29udGV4dEtleXMuaXNFbWJlZGRlZERpZmZFZGl0b3Iua2V5LCBmYWxzZSk7XG5cdFx0dGhpcy5fcmVnaXN0ZXIoYmluZENvbnRleHRLZXkoRWRpdG9yQ29udGV4dEtleXMuaXNFbWJlZGRlZERpZmZFZGl0b3IsIHRoaXMuX2NvbnRleHRLZXlTZXJ2aWNlLFxuXHRcdFx0cmVhZGVyID0+IHRoaXMuX29wdGlvbnMuaXNJbkVtYmVkZGVkRWRpdG9yLnJlYWQocmVhZGVyKVxuXHRcdCkpO1xuXHRcdHRoaXMuX3JlZ2lzdGVyKGJpbmRDb250ZXh0S2V5KEVkaXRvckNvbnRleHRLZXlzLmNvbXBhcmluZ01vdmVkQ29kZSwgdGhpcy5fY29udGV4dEtleVNlcnZpY2UsXG5cdFx0XHRyZWFkZXIgPT4gISF0aGlzLl9kaWZmTW9kZWwucmVhZChyZWFkZXIpPy5tb3ZlZFRleHRUb0NvbXBhcmUucmVhZChyZWFkZXIpXG5cdFx0KSk7XG5cdFx0dGhpcy5fcmVnaXN0ZXIoYmluZENvbnRleHRLZXkoRWRpdG9yQ29udGV4dEtleXMuZGlmZkVkaXRvclJlbmRlclNpZGVCeVNpZGVJbmxpbmVCcmVha3BvaW50UmVhY2hlZCwgdGhpcy5fY29udGV4dEtleVNlcnZpY2UsXG5cdFx0XHRyZWFkZXIgPT4gdGhpcy5fb3B0aW9ucy5jb3VsZFNob3dJbmxpbmVWaWV3QmVjYXVzZU9mU2l6ZS5yZWFkKHJlYWRlcilcblx0XHQpKTtcblx0XHR0aGlzLl9yZWdpc3RlcihiaW5kQ29udGV4dEtleShFZGl0b3JDb250ZXh0S2V5cy5kaWZmRWRpdG9ySW5saW5lTW9kZSwgdGhpcy5fY29udGV4dEtleVNlcnZpY2UsXG5cdFx0XHRyZWFkZXIgPT4gIXRoaXMuX29wdGlvbnMucmVuZGVyU2lkZUJ5U2lkZS5yZWFkKHJlYWRlcilcblx0XHQpKTtcblxuXHRcdHRoaXMuX3JlZ2lzdGVyKGJpbmRDb250ZXh0S2V5KEVkaXRvckNvbnRleHRLZXlzLmhhc0NoYW5nZXMsIHRoaXMuX2NvbnRleHRLZXlTZXJ2aWNlLFxuXHRcdFx0cmVhZGVyID0+ICh0aGlzLl9kaWZmTW9kZWwucmVhZChyZWFkZXIpPy5kaWZmLnJlYWQocmVhZGVyKT8ubWFwcGluZ3MubGVuZ3RoID8/IDApID4gMFxuXHRcdCkpO1xuXG5cdFx0dGhpcy5fZWRpdG9ycyA9IHRoaXMuX3JlZ2lzdGVyKHRoaXMuX2luc3RhbnRpYXRpb25TZXJ2aWNlLmNyZWF0ZUluc3RhbmNlKFxuXHRcdFx0RGlmZkVkaXRvckVkaXRvcnMsXG5cdFx0XHR0aGlzLmVsZW1lbnRzLm9yaWdpbmFsLFxuXHRcdFx0dGhpcy5lbGVtZW50cy5tb2RpZmllZCxcblx0XHRcdHRoaXMuX29wdGlvbnMsXG5cdFx0XHRjb2RlRWRpdG9yV2lkZ2V0T3B0aW9ucyxcblx0XHRcdChpLCBjLCBvLCBvMikgPT4gdGhpcy5fY3JlYXRlSW5uZXJFZGl0b3IoaSwgYywgbywgbzIpLFxuXHRcdCkpO1xuXG5cdFx0dGhpcy5fcmVnaXN0ZXIoYmluZENvbnRleHRLZXkoRWRpdG9yQ29udGV4dEtleXMuZGlmZkVkaXRvck9yaWdpbmFsV3JpdGFibGUsIHRoaXMuX2NvbnRleHRLZXlTZXJ2aWNlLFxuXHRcdFx0cmVhZGVyID0+IHRoaXMuX29wdGlvbnMub3JpZ2luYWxFZGl0YWJsZS5yZWFkKHJlYWRlcilcblx0XHQpKTtcblx0XHR0aGlzLl9yZWdpc3RlcihiaW5kQ29udGV4dEtleShFZGl0b3JDb250ZXh0S2V5cy5kaWZmRWRpdG9yTW9kaWZpZWRXcml0YWJsZSwgdGhpcy5fY29udGV4dEtleVNlcnZpY2UsXG5cdFx0XHRyZWFkZXIgPT4gIXRoaXMuX29wdGlvbnMucmVhZE9ubHkucmVhZChyZWFkZXIpXG5cdFx0KSk7XG5cdFx0dGhpcy5fcmVnaXN0ZXIoYmluZENvbnRleHRLZXkoRWRpdG9yQ29udGV4dEtleXMuZGlmZkVkaXRvck9yaWdpbmFsVXJpLCB0aGlzLl9jb250ZXh0S2V5U2VydmljZSxcblx0XHRcdHJlYWRlciA9PiB0aGlzLl9kaWZmTW9kZWwucmVhZChyZWFkZXIpPy5tb2RlbC5vcmlnaW5hbC51cmkudG9TdHJpbmcoKSA/PyAnJ1xuXHRcdCkpO1xuXHRcdHRoaXMuX3JlZ2lzdGVyKGJpbmRDb250ZXh0S2V5KEVkaXRvckNvbnRleHRLZXlzLmRpZmZFZGl0b3JNb2RpZmllZFVyaSwgdGhpcy5fY29udGV4dEtleVNlcnZpY2UsXG5cdFx0XHRyZWFkZXIgPT4gdGhpcy5fZGlmZk1vZGVsLnJlYWQocmVhZGVyKT8ubW9kZWwubW9kaWZpZWQudXJpLnRvU3RyaW5nKCkgPz8gJydcblx0XHQpKTtcblxuXHRcdHRoaXMuX292ZXJ2aWV3UnVsZXJQYXJ0ID0gZGVyaXZlZERpc3Bvc2FibGUodGhpcywgcmVhZGVyID0+XG5cdFx0XHQhdGhpcy5fb3B0aW9ucy5yZW5kZXJPdmVydmlld1J1bGVyLnJlYWQocmVhZGVyKVxuXHRcdFx0XHQ/IHVuZGVmaW5lZFxuXHRcdFx0XHQ6IHRoaXMuX2luc3RhbnRpYXRpb25TZXJ2aWNlLmNyZWF0ZUluc3RhbmNlKFxuXHRcdFx0XHRcdHJlYWRIb3RSZWxvYWRhYmxlRXhwb3J0KE92ZXJ2aWV3UnVsZXJGZWF0dXJlLCByZWFkZXIpLFxuXHRcdFx0XHRcdHRoaXMuX2VkaXRvcnMsXG5cdFx0XHRcdFx0dGhpcy5lbGVtZW50cy5yb290LFxuXHRcdFx0XHRcdHRoaXMuX2RpZmZNb2RlbCxcblx0XHRcdFx0XHR0aGlzLl9yb290U2l6ZU9ic2VydmVyLndpZHRoLFxuXHRcdFx0XHRcdHRoaXMuX3Jvb3RTaXplT2JzZXJ2ZXIuaGVpZ2h0LFxuXHRcdFx0XHRcdHRoaXMuX2xheW91dEluZm8ubWFwKGkgPT4gaS5tb2RpZmllZEVkaXRvciksXG5cdFx0XHRcdClcblx0XHQpLnJlY29tcHV0ZUluaXRpYWxseUFuZE9uQ2hhbmdlKHRoaXMuX3N0b3JlKTtcblxuXHRcdGNvbnN0IGRpbWVuc2lvbnMgPSB7XG5cdFx0XHRoZWlnaHQ6IHRoaXMuX3Jvb3RTaXplT2JzZXJ2ZXIuaGVpZ2h0LFxuXHRcdFx0d2lkdGg6IHRoaXMuX3Jvb3RTaXplT2JzZXJ2ZXIud2lkdGgubWFwKCh3LCByZWFkZXIpID0+IHcgLSAodGhpcy5fb3ZlcnZpZXdSdWxlclBhcnQucmVhZChyZWFkZXIpPy53aWR0aCA/PyAwKSksXG5cdFx0fTtcblxuXHRcdHRoaXMuX3Nhc2hMYXlvdXQgPSBuZXcgU2FzaExheW91dCh0aGlzLl9vcHRpb25zLCBkaW1lbnNpb25zKTtcblxuXHRcdHRoaXMuX3Nhc2ggPSBkZXJpdmVkRGlzcG9zYWJsZSh0aGlzLCByZWFkZXIgPT4ge1xuXHRcdFx0Y29uc3Qgc2hvd1Nhc2ggPSB0aGlzLl9vcHRpb25zLnJlbmRlclNpZGVCeVNpZGUucmVhZChyZWFkZXIpO1xuXHRcdFx0dGhpcy5lbGVtZW50cy5yb290LmNsYXNzTGlzdC50b2dnbGUoJ3NpZGUtYnktc2lkZScsIHNob3dTYXNoKTtcblx0XHRcdHJldHVybiAhc2hvd1Nhc2ggPyB1bmRlZmluZWQgOiBuZXcgRGlmZkVkaXRvclNhc2goXG5cdFx0XHRcdHRoaXMuZWxlbWVudHMucm9vdCxcblx0XHRcdFx0ZGltZW5zaW9ucyxcblx0XHRcdFx0dGhpcy5fb3B0aW9ucy5lbmFibGVTcGxpdFZpZXdSZXNpemluZyxcblx0XHRcdFx0dGhpcy5fYm91bmRhcnlTYXNoZXMsXG5cdFx0XHRcdHRoaXMuX3Nhc2hMYXlvdXQuc2FzaExlZnQsXG5cdFx0XHRcdCgpID0+IHRoaXMuX3Nhc2hMYXlvdXQucmVzZXRTYXNoKCksXG5cdFx0XHQpO1xuXHRcdH0pLnJlY29tcHV0ZUluaXRpYWxseUFuZE9uQ2hhbmdlKHRoaXMuX3N0b3JlKTtcblxuXHRcdGNvbnN0IHVuY2hhbmdlZFJhbmdlc0ZlYXR1cmUgPSBkZXJpdmVkRGlzcG9zYWJsZSh0aGlzLCByZWFkZXIgPT4gLyoqIEBkZXNjcmlwdGlvbiBVbmNoYW5nZWRSYW5nZXNGZWF0dXJlICovXG5cdFx0XHR0aGlzLl9pbnN0YW50aWF0aW9uU2VydmljZS5jcmVhdGVJbnN0YW5jZShcblx0XHRcdFx0cmVhZEhvdFJlbG9hZGFibGVFeHBvcnQoSGlkZVVuY2hhbmdlZFJlZ2lvbnNGZWF0dXJlLCByZWFkZXIpLFxuXHRcdFx0XHR0aGlzLl9lZGl0b3JzLCB0aGlzLl9kaWZmTW9kZWwsIHRoaXMuX29wdGlvbnNcblx0XHRcdClcblx0XHQpLnJlY29tcHV0ZUluaXRpYWxseUFuZE9uQ2hhbmdlKHRoaXMuX3N0b3JlKTtcblxuXHRcdGRlcml2ZWREaXNwb3NhYmxlKHRoaXMsIHJlYWRlciA9PiAvKiogQGRlc2NyaXB0aW9uIERpZmZFZGl0b3JEZWNvcmF0aW9ucyAqL1xuXHRcdFx0dGhpcy5faW5zdGFudGlhdGlvblNlcnZpY2UuY3JlYXRlSW5zdGFuY2UoXG5cdFx0XHRcdHJlYWRIb3RSZWxvYWRhYmxlRXhwb3J0KERpZmZFZGl0b3JEZWNvcmF0aW9ucywgcmVhZGVyKSxcblx0XHRcdFx0dGhpcy5fZWRpdG9ycywgdGhpcy5fZGlmZk1vZGVsLCB0aGlzLl9vcHRpb25zLCB0aGlzLFxuXHRcdFx0KVxuXHRcdCkucmVjb21wdXRlSW5pdGlhbGx5QW5kT25DaGFuZ2UodGhpcy5fc3RvcmUpO1xuXG5cdFx0Y29uc3Qgb3JpZ1ZpZXdab25lSWRzVG9JZ25vcmUgPSBuZXcgU2V0PHN0cmluZz4oKTtcblx0XHRjb25zdCBtb2RWaWV3Wm9uZUlkc1RvSWdub3JlID0gbmV3IFNldDxzdHJpbmc+KCk7XG5cdFx0bGV0IGlzVXBkYXRpbmdWaWV3Wm9uZXMgPSBmYWxzZTtcblx0XHRjb25zdCB2aWV3Wm9uZU1hbmFnZXIgPSBkZXJpdmVkRGlzcG9zYWJsZSh0aGlzLCByZWFkZXIgPT4gLyoqIEBkZXNjcmlwdGlvbiBWaWV3Wm9uZU1hbmFnZXIgKi9cblx0XHRcdHRoaXMuX2luc3RhbnRpYXRpb25TZXJ2aWNlLmNyZWF0ZUluc3RhbmNlKFxuXHRcdFx0XHRyZWFkSG90UmVsb2FkYWJsZUV4cG9ydChEaWZmRWRpdG9yVmlld1pvbmVzLCByZWFkZXIpLFxuXHRcdFx0XHRnZXRXaW5kb3codGhpcy5fZG9tRWxlbWVudCksXG5cdFx0XHRcdHRoaXMuX2VkaXRvcnMsXG5cdFx0XHRcdHRoaXMuX2RpZmZNb2RlbCxcblx0XHRcdFx0dGhpcy5fb3B0aW9ucyxcblx0XHRcdFx0dGhpcyxcblx0XHRcdFx0KCkgPT4gaXNVcGRhdGluZ1ZpZXdab25lcyB8fCB1bmNoYW5nZWRSYW5nZXNGZWF0dXJlLmdldCgpLmlzVXBkYXRpbmdIaWRkZW5BcmVhcyxcblx0XHRcdFx0b3JpZ1ZpZXdab25lSWRzVG9JZ25vcmUsXG5cdFx0XHRcdG1vZFZpZXdab25lSWRzVG9JZ25vcmVcblx0XHRcdClcblx0XHQpLnJlY29tcHV0ZUluaXRpYWxseUFuZE9uQ2hhbmdlKHRoaXMuX3N0b3JlKTtcblxuXHRcdGNvbnN0IG9yaWdpbmFsVmlld1pvbmVzID0gZGVyaXZlZCh0aGlzLCAocmVhZGVyKSA9PiB7IC8qKiBAZGVzY3JpcHRpb24gb3JpZ2luYWxWaWV3Wm9uZXMgKi9cblx0XHRcdGNvbnN0IG9yaWcgPSB2aWV3Wm9uZU1hbmFnZXIucmVhZChyZWFkZXIpLnZpZXdab25lcy5yZWFkKHJlYWRlcikub3JpZztcblx0XHRcdGNvbnN0IG9yaWcyID0gdW5jaGFuZ2VkUmFuZ2VzRmVhdHVyZS5yZWFkKHJlYWRlcikudmlld1pvbmVzLnJlYWQocmVhZGVyKS5vcmlnVmlld1pvbmVzO1xuXHRcdFx0cmV0dXJuIG9yaWcuY29uY2F0KG9yaWcyKTtcblx0XHR9KTtcblx0XHRjb25zdCBtb2RpZmllZFZpZXdab25lcyA9IGRlcml2ZWQodGhpcywgKHJlYWRlcikgPT4geyAvKiogQGRlc2NyaXB0aW9uIG1vZGlmaWVkVmlld1pvbmVzICovXG5cdFx0XHRjb25zdCBtb2QgPSB2aWV3Wm9uZU1hbmFnZXIucmVhZChyZWFkZXIpLnZpZXdab25lcy5yZWFkKHJlYWRlcikubW9kO1xuXHRcdFx0Y29uc3QgbW9kMiA9IHVuY2hhbmdlZFJhbmdlc0ZlYXR1cmUucmVhZChyZWFkZXIpLnZpZXdab25lcy5yZWFkKHJlYWRlcikubW9kVmlld1pvbmVzO1xuXHRcdFx0cmV0dXJuIG1vZC5jb25jYXQobW9kMik7XG5cdFx0fSk7XG5cdFx0dGhpcy5fcmVnaXN0ZXIoYXBwbHlWaWV3Wm9uZXModGhpcy5fZWRpdG9ycy5vcmlnaW5hbCwgb3JpZ2luYWxWaWV3Wm9uZXMsIGlzVXBkYXRpbmdPcmlnVmlld1pvbmVzID0+IHtcblx0XHRcdGlzVXBkYXRpbmdWaWV3Wm9uZXMgPSBpc1VwZGF0aW5nT3JpZ1ZpZXdab25lcztcblx0XHR9LCBvcmlnVmlld1pvbmVJZHNUb0lnbm9yZSkpO1xuXHRcdGxldCBzY3JvbGxTdGF0ZTogU3RhYmxlRWRpdG9yU2Nyb2xsU3RhdGUgfCB1bmRlZmluZWQ7XG5cdFx0dGhpcy5fcmVnaXN0ZXIoYXBwbHlWaWV3Wm9uZXModGhpcy5fZWRpdG9ycy5tb2RpZmllZCwgbW9kaWZpZWRWaWV3Wm9uZXMsIGlzVXBkYXRpbmdNb2RWaWV3Wm9uZXMgPT4ge1xuXHRcdFx0aXNVcGRhdGluZ1ZpZXdab25lcyA9IGlzVXBkYXRpbmdNb2RWaWV3Wm9uZXM7XG5cdFx0XHRpZiAoaXNVcGRhdGluZ1ZpZXdab25lcykge1xuXHRcdFx0XHRzY3JvbGxTdGF0ZSA9IFN0YWJsZUVkaXRvclNjcm9sbFN0YXRlLmNhcHR1cmUodGhpcy5fZWRpdG9ycy5tb2RpZmllZCk7XG5cdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRzY3JvbGxTdGF0ZT8ucmVzdG9yZSh0aGlzLl9lZGl0b3JzLm1vZGlmaWVkKTtcblx0XHRcdFx0c2Nyb2xsU3RhdGUgPSB1bmRlZmluZWQ7XG5cdFx0XHR9XG5cdFx0fSwgbW9kVmlld1pvbmVJZHNUb0lnbm9yZSkpO1xuXG5cdFx0dGhpcy5fYWNjZXNzaWJsZURpZmZWaWV3ZXIgPSBkZXJpdmVkRGlzcG9zYWJsZSh0aGlzLCByZWFkZXIgPT5cblx0XHRcdHRoaXMuX2luc3RhbnRpYXRpb25TZXJ2aWNlLmNyZWF0ZUluc3RhbmNlKFxuXHRcdFx0XHRyZWFkSG90UmVsb2FkYWJsZUV4cG9ydChBY2Nlc3NpYmxlRGlmZlZpZXdlciwgcmVhZGVyKSxcblx0XHRcdFx0dGhpcy5lbGVtZW50cy5hY2Nlc3NpYmxlRGlmZlZpZXdlcixcblx0XHRcdFx0dGhpcy5fYWNjZXNzaWJsZURpZmZWaWV3ZXJWaXNpYmxlLFxuXHRcdFx0XHQodmlzaWJsZSwgdHgpID0+IHRoaXMuX2FjY2Vzc2libGVEaWZmVmlld2VyU2hvdWxkQmVWaXNpYmxlLnNldCh2aXNpYmxlLCB0eCksXG5cdFx0XHRcdHRoaXMuX29wdGlvbnMub25seVNob3dBY2Nlc3NpYmxlRGlmZlZpZXdlci5tYXAodiA9PiAhdiksXG5cdFx0XHRcdHRoaXMuX3Jvb3RTaXplT2JzZXJ2ZXIud2lkdGgsXG5cdFx0XHRcdHRoaXMuX3Jvb3RTaXplT2JzZXJ2ZXIuaGVpZ2h0LFxuXHRcdFx0XHR0aGlzLl9kaWZmTW9kZWwubWFwKChtLCByKSA9PiBtPy5kaWZmLnJlYWQocik/Lm1hcHBpbmdzLm1hcChtID0+IG0ubGluZVJhbmdlTWFwcGluZykpLFxuXHRcdFx0XHRuZXcgQWNjZXNzaWJsZURpZmZWaWV3ZXJNb2RlbEZyb21FZGl0b3JzKHRoaXMuX2VkaXRvcnMpLFxuXHRcdFx0KVxuXHRcdCkucmVjb21wdXRlSW5pdGlhbGx5QW5kT25DaGFuZ2UodGhpcy5fc3RvcmUpO1xuXG5cdFx0Y29uc3QgdmlzaWJpbGl0eSA9IHRoaXMuX2FjY2Vzc2libGVEaWZmVmlld2VyVmlzaWJsZS5tYXA8Q1NTU3R5bGVbJ3Zpc2liaWxpdHknXT4odiA9PiB2ID8gJ2hpZGRlbicgOiAndmlzaWJsZScpO1xuXHRcdHRoaXMuX3JlZ2lzdGVyKGFwcGx5U3R5bGUodGhpcy5lbGVtZW50cy5tb2RpZmllZCwgeyB2aXNpYmlsaXR5IH0pKTtcblx0XHR0aGlzLl9yZWdpc3RlcihhcHBseVN0eWxlKHRoaXMuZWxlbWVudHMub3JpZ2luYWwsIHsgdmlzaWJpbGl0eSB9KSk7XG5cblx0XHR0aGlzLl9jcmVhdGVEaWZmRWRpdG9yQ29udHJpYnV0aW9ucygpO1xuXG5cdFx0Y29kZUVkaXRvclNlcnZpY2UuYWRkRGlmZkVkaXRvcih0aGlzKTtcblxuXHRcdHRoaXMuX2d1dHRlciA9IGRlcml2ZWREaXNwb3NhYmxlKHRoaXMsIHJlYWRlciA9PiB7XG5cdFx0XHRyZXR1cm4gdGhpcy5fb3B0aW9ucy5zaG91bGRSZW5kZXJHdXR0ZXJNZW51LnJlYWQocmVhZGVyKVxuXHRcdFx0XHQ/IHRoaXMuX2luc3RhbnRpYXRpb25TZXJ2aWNlLmNyZWF0ZUluc3RhbmNlKFxuXHRcdFx0XHRcdHJlYWRIb3RSZWxvYWRhYmxlRXhwb3J0KERpZmZFZGl0b3JHdXR0ZXIsIHJlYWRlciksXG5cdFx0XHRcdFx0dGhpcy5lbGVtZW50cy5yb290LFxuXHRcdFx0XHRcdHRoaXMuX2RpZmZNb2RlbCxcblx0XHRcdFx0XHR0aGlzLl9lZGl0b3JzLFxuXHRcdFx0XHRcdHRoaXMuX29wdGlvbnMsXG5cdFx0XHRcdFx0dGhpcy5fc2FzaExheW91dCxcblx0XHRcdFx0XHR0aGlzLl9ib3VuZGFyeVNhc2hlcyxcblx0XHRcdFx0KVxuXHRcdFx0XHQ6IHVuZGVmaW5lZDtcblx0XHR9KTtcblxuXHRcdHRoaXMuX3JlZ2lzdGVyKHJlY29tcHV0ZUluaXRpYWxseUFuZE9uQ2hhbmdlKHRoaXMuX2xheW91dEluZm8pKTtcblxuXHRcdGRlcml2ZWREaXNwb3NhYmxlKHRoaXMsIHJlYWRlciA9PiAvKiogQGRlc2NyaXB0aW9uIE1vdmVkQmxvY2tzTGluZXNQYXJ0ICovXG5cdFx0XHRuZXcgKHJlYWRIb3RSZWxvYWRhYmxlRXhwb3J0KE1vdmVkQmxvY2tzTGluZXNGZWF0dXJlLCByZWFkZXIpKShcblx0XHRcdFx0dGhpcy5lbGVtZW50cy5yb290LFxuXHRcdFx0XHR0aGlzLl9kaWZmTW9kZWwsXG5cdFx0XHRcdHRoaXMuX2xheW91dEluZm8ubWFwKGkgPT4gaS5vcmlnaW5hbEVkaXRvciksXG5cdFx0XHRcdHRoaXMuX2xheW91dEluZm8ubWFwKGkgPT4gaS5tb2RpZmllZEVkaXRvciksXG5cdFx0XHRcdHRoaXMuX2VkaXRvcnMsXG5cdFx0XHQpXG5cdFx0KS5yZWNvbXB1dGVJbml0aWFsbHlBbmRPbkNoYW5nZSh0aGlzLl9zdG9yZSwgdmFsdWUgPT4ge1xuXHRcdFx0Ly8gVGhpcyBpcyB0byBicmVhayB0aGUgbGF5b3V0IGluZm8gPC0+IG1vdmVkIGJsb2NrcyBsaW5lcyBwYXJ0IGRlcGVuZGVuY3kgY3ljbGUuXG5cdFx0XHR0aGlzLl9tb3ZlZEJsb2Nrc0xpbmVzUGFydC5zZXQodmFsdWUsIHVuZGVmaW5lZCk7XG5cdFx0fSk7XG5cblx0XHR0aGlzLl9yZWdpc3RlcihFdmVudC5ydW5BbmRTdWJzY3JpYmUodGhpcy5fZWRpdG9ycy5tb2RpZmllZC5vbkRpZENoYW5nZUN1cnNvclBvc2l0aW9uLCBlID0+IHRoaXMuX2hhbmRsZUN1cnNvclBvc2l0aW9uQ2hhbmdlKGUsIHRydWUpKSk7XG5cdFx0dGhpcy5fcmVnaXN0ZXIoRXZlbnQucnVuQW5kU3Vic2NyaWJlKHRoaXMuX2VkaXRvcnMub3JpZ2luYWwub25EaWRDaGFuZ2VDdXJzb3JQb3NpdGlvbiwgZSA9PiB0aGlzLl9oYW5kbGVDdXJzb3JQb3NpdGlvbkNoYW5nZShlLCBmYWxzZSkpKTtcblxuXHRcdGNvbnN0IGlzSW5pdGlhbGl6aW5nRGlmZiA9IHRoaXMuX2RpZmZNb2RlbC5tYXAodGhpcywgKG0sIHJlYWRlcikgPT4ge1xuXHRcdFx0LyoqIEBpc0luaXRpYWxpemluZ0RpZmYgaXNEaWZmVXBUb0RhdGUgKi9cblx0XHRcdGlmICghbSkgeyByZXR1cm4gdW5kZWZpbmVkOyB9XG5cdFx0XHRyZXR1cm4gbS5kaWZmLnJlYWQocmVhZGVyKSA9PT0gdW5kZWZpbmVkICYmICFtLmlzRGlmZlVwVG9EYXRlLnJlYWQocmVhZGVyKTtcblx0XHR9KTtcblx0XHR0aGlzLl9yZWdpc3RlcihhdXRvcnVuV2l0aFN0b3JlKChyZWFkZXIsIHN0b3JlKSA9PiB7XG5cdFx0XHQvKiogQGRlc2NyaXB0aW9uIERpZmZFZGl0b3JXaWRnZXRIZWxwZXIuU2hvd1Byb2dyZXNzICovXG5cdFx0XHRpZiAoaXNJbml0aWFsaXppbmdEaWZmLnJlYWQocmVhZGVyKSA9PT0gdHJ1ZSkge1xuXHRcdFx0XHRjb25zdCByID0gdGhpcy5fZWRpdG9yUHJvZ3Jlc3NTZXJ2aWNlLnNob3codHJ1ZSwgMTAwMCk7XG5cdFx0XHRcdHN0b3JlLmFkZCh0b0Rpc3Bvc2FibGUoKCkgPT4gci5kb25lKCkpKTtcblx0XHRcdH1cblx0XHR9KSk7XG5cblx0XHR0aGlzLl9yZWdpc3RlcihhdXRvcnVuV2l0aFN0b3JlKChyZWFkZXIsIHN0b3JlKSA9PiB7XG5cdFx0XHRzdG9yZS5hZGQobmV3IChyZWFkSG90UmVsb2FkYWJsZUV4cG9ydChSZXZlcnRCdXR0b25zRmVhdHVyZSwgcmVhZGVyKSkodGhpcy5fZWRpdG9ycywgdGhpcy5fZGlmZk1vZGVsLCB0aGlzLl9vcHRpb25zLCB0aGlzKSk7XG5cdFx0fSkpO1xuXG5cdFx0dGhpcy5fcmVnaXN0ZXIoYXV0b3J1bldpdGhTdG9yZSgocmVhZGVyLCBzdG9yZSkgPT4ge1xuXHRcdFx0Y29uc3QgbW9kZWwgPSB0aGlzLl9kaWZmTW9kZWwucmVhZChyZWFkZXIpO1xuXHRcdFx0aWYgKCFtb2RlbCkgeyByZXR1cm47IH1cblx0XHRcdGZvciAoY29uc3QgbSBvZiBbbW9kZWwubW9kZWwub3JpZ2luYWwsIG1vZGVsLm1vZGVsLm1vZGlmaWVkXSkge1xuXHRcdFx0XHRzdG9yZS5hZGQobS5vbldpbGxEaXNwb3NlKGUgPT4ge1xuXHRcdFx0XHRcdG9uVW5leHBlY3RlZEVycm9yKG5ldyBCdWdJbmRpY2F0aW5nRXJyb3IoJ1RleHRNb2RlbCBnb3QgZGlzcG9zZWQgYmVmb3JlIERpZmZFZGl0b3JXaWRnZXQgbW9kZWwgZ290IHJlc2V0JykpO1xuXHRcdFx0XHRcdHRoaXMuc2V0TW9kZWwobnVsbCk7XG5cdFx0XHRcdH0pKTtcblx0XHRcdH1cblx0XHR9KSk7XG5cblx0XHR0aGlzLl9yZWdpc3RlcihhdXRvcnVuKHJlYWRlciA9PiB7XG5cdFx0XHR0aGlzLl9vcHRpb25zLnNldE1vZGVsKHRoaXMuX2RpZmZNb2RlbC5yZWFkKHJlYWRlcikpO1xuXHRcdH0pKTtcblx0fVxuXG5cdHB1YmxpYyBnZXRWaWV3V2lkdGgoKTogbnVtYmVyIHtcblx0XHRyZXR1cm4gdGhpcy5fcm9vdFNpemVPYnNlcnZlci53aWR0aC5nZXQoKTtcblx0fVxuXG5cdHB1YmxpYyBnZXRDb250ZW50SGVpZ2h0KCkge1xuXHRcdHJldHVybiB0aGlzLl9lZGl0b3JzLm1vZGlmaWVkLmdldENvbnRlbnRIZWlnaHQoKTtcblx0fVxuXG5cdHByb3RlY3RlZCBfY3JlYXRlSW5uZXJFZGl0b3IoaW5zdGFudGlhdGlvblNlcnZpY2U6IElJbnN0YW50aWF0aW9uU2VydmljZSwgY29udGFpbmVyOiBIVE1MRWxlbWVudCwgb3B0aW9uczogUmVhZG9ubHk8SUVkaXRvckNvbnN0cnVjdGlvbk9wdGlvbnM+LCBlZGl0b3JXaWRnZXRPcHRpb25zOiBJQ29kZUVkaXRvcldpZGdldE9wdGlvbnMpOiBDb2RlRWRpdG9yV2lkZ2V0IHtcblx0XHRjb25zdCBlZGl0b3IgPSBpbnN0YW50aWF0aW9uU2VydmljZS5jcmVhdGVJbnN0YW5jZShDb2RlRWRpdG9yV2lkZ2V0LCBjb250YWluZXIsIG9wdGlvbnMsIGVkaXRvcldpZGdldE9wdGlvbnMpO1xuXHRcdHJldHVybiBlZGl0b3I7XG5cdH1cblxuXHRwcml2YXRlIHJlYWRvbmx5IF9sYXlvdXRJbmZvID0gZGVyaXZlZCh0aGlzLCByZWFkZXIgPT4ge1xuXHRcdGNvbnN0IGZ1bGxXaWR0aCA9IHRoaXMuX3Jvb3RTaXplT2JzZXJ2ZXIud2lkdGgucmVhZChyZWFkZXIpO1xuXHRcdGNvbnN0IGZ1bGxIZWlnaHQgPSB0aGlzLl9yb290U2l6ZU9ic2VydmVyLmhlaWdodC5yZWFkKHJlYWRlcik7XG5cblx0XHRpZiAodGhpcy5fcm9vdFNpemVPYnNlcnZlci5hdXRvbWF0aWNMYXlvdXQpIHtcblx0XHRcdHRoaXMuZWxlbWVudHMucm9vdC5zdHlsZS5oZWlnaHQgPSAnMTAwJSc7XG5cdFx0fSBlbHNlIHtcblx0XHRcdHRoaXMuZWxlbWVudHMucm9vdC5zdHlsZS5oZWlnaHQgPSBmdWxsSGVpZ2h0ICsgJ3B4Jztcblx0XHR9XG5cblx0XHRjb25zdCBzYXNoID0gdGhpcy5fc2FzaC5yZWFkKHJlYWRlcik7XG5cblx0XHRjb25zdCBndXR0ZXIgPSB0aGlzLl9ndXR0ZXIucmVhZChyZWFkZXIpO1xuXHRcdGNvbnN0IGd1dHRlcldpZHRoID0gZ3V0dGVyPy53aWR0aC5yZWFkKHJlYWRlcikgPz8gMDtcblxuXHRcdGNvbnN0IG92ZXJ2aWV3UnVsZXJQYXJ0V2lkdGggPSB0aGlzLl9vdmVydmlld1J1bGVyUGFydC5yZWFkKHJlYWRlcik/LndpZHRoID8/IDA7XG5cblx0XHRsZXQgb3JpZ2luYWxMZWZ0OiBudW1iZXIsIG9yaWdpbmFsV2lkdGg6IG51bWJlciwgbW9kaWZpZWRMZWZ0OiBudW1iZXIsIG1vZGlmaWVkV2lkdGg6IG51bWJlciwgZ3V0dGVyTGVmdDogbnVtYmVyO1xuXG5cdFx0Y29uc3Qgc2lkZUJ5U2lkZSA9ICEhc2FzaDtcblx0XHRpZiAoc2lkZUJ5U2lkZSkge1xuXHRcdFx0Y29uc3Qgc2FzaExlZnQgPSBzYXNoLnNhc2hMZWZ0LnJlYWQocmVhZGVyKTtcblx0XHRcdGNvbnN0IG1vdmVkQmxvY2tzTGluZXNXaWR0aCA9IHRoaXMuX21vdmVkQmxvY2tzTGluZXNQYXJ0LnJlYWQocmVhZGVyKT8ud2lkdGgucmVhZChyZWFkZXIpID8/IDA7XG5cblx0XHRcdG9yaWdpbmFsTGVmdCA9IDA7XG5cdFx0XHRvcmlnaW5hbFdpZHRoID0gc2FzaExlZnQgLSBndXR0ZXJXaWR0aCAtIG1vdmVkQmxvY2tzTGluZXNXaWR0aDtcblxuXHRcdFx0Z3V0dGVyTGVmdCA9IHNhc2hMZWZ0IC0gZ3V0dGVyV2lkdGg7XG5cblx0XHRcdG1vZGlmaWVkTGVmdCA9IHNhc2hMZWZ0O1xuXHRcdFx0bW9kaWZpZWRXaWR0aCA9IGZ1bGxXaWR0aCAtIG1vZGlmaWVkTGVmdCAtIG92ZXJ2aWV3UnVsZXJQYXJ0V2lkdGg7XG5cdFx0fSBlbHNlIHtcblx0XHRcdGd1dHRlckxlZnQgPSAwO1xuXG5cdFx0XHRjb25zdCBzaG91bGRIaWRlT3JpZ2luYWxMaW5lTnVtYmVycyA9IHRoaXMuX29wdGlvbnMuaW5saW5lVmlld0hpZGVPcmlnaW5hbExpbmVOdW1iZXJzLnJlYWQocmVhZGVyKTtcblx0XHRcdG9yaWdpbmFsTGVmdCA9IGd1dHRlcldpZHRoO1xuXHRcdFx0aWYgKHNob3VsZEhpZGVPcmlnaW5hbExpbmVOdW1iZXJzKSB7XG5cdFx0XHRcdG9yaWdpbmFsV2lkdGggPSAwO1xuXHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0b3JpZ2luYWxXaWR0aCA9IE1hdGgubWF4KDUsIHRoaXMuX2VkaXRvcnMub3JpZ2luYWxPYnMubGF5b3V0SW5mb0RlY29yYXRpb25zTGVmdC5yZWFkKHJlYWRlcikpO1xuXHRcdFx0fVxuXG5cdFx0XHRtb2RpZmllZExlZnQgPSBndXR0ZXJXaWR0aCArIG9yaWdpbmFsV2lkdGg7XG5cdFx0XHRtb2RpZmllZFdpZHRoID0gZnVsbFdpZHRoIC0gbW9kaWZpZWRMZWZ0IC0gb3ZlcnZpZXdSdWxlclBhcnRXaWR0aDtcblx0XHR9XG5cblx0XHR0aGlzLmVsZW1lbnRzLm9yaWdpbmFsLnN0eWxlLmxlZnQgPSBvcmlnaW5hbExlZnQgKyAncHgnO1xuXHRcdHRoaXMuZWxlbWVudHMub3JpZ2luYWwuc3R5bGUud2lkdGggPSBvcmlnaW5hbFdpZHRoICsgJ3B4Jztcblx0XHR0aGlzLl9lZGl0b3JzLm9yaWdpbmFsLmxheW91dCh7IHdpZHRoOiBvcmlnaW5hbFdpZHRoLCBoZWlnaHQ6IGZ1bGxIZWlnaHQgfSwgdHJ1ZSk7XG5cblx0XHRndXR0ZXI/LmxheW91dChndXR0ZXJMZWZ0KTtcblxuXHRcdHRoaXMuZWxlbWVudHMubW9kaWZpZWQuc3R5bGUubGVmdCA9IG1vZGlmaWVkTGVmdCArICdweCc7XG5cdFx0dGhpcy5lbGVtZW50cy5tb2RpZmllZC5zdHlsZS53aWR0aCA9IG1vZGlmaWVkV2lkdGggKyAncHgnO1xuXHRcdHRoaXMuX2VkaXRvcnMubW9kaWZpZWQubGF5b3V0KHsgd2lkdGg6IG1vZGlmaWVkV2lkdGgsIGhlaWdodDogZnVsbEhlaWdodCB9LCB0cnVlKTtcblxuXHRcdHJldHVybiB7XG5cdFx0XHRtb2RpZmllZEVkaXRvcjogdGhpcy5fZWRpdG9ycy5tb2RpZmllZC5nZXRMYXlvdXRJbmZvKCksXG5cdFx0XHRvcmlnaW5hbEVkaXRvcjogdGhpcy5fZWRpdG9ycy5vcmlnaW5hbC5nZXRMYXlvdXRJbmZvKCksXG5cdFx0fTtcblx0fSk7XG5cblx0cHJpdmF0ZSBfY3JlYXRlRGlmZkVkaXRvckNvbnRyaWJ1dGlvbnMoKSB7XG5cdFx0Y29uc3QgY29udHJpYnV0aW9uczogSURpZmZFZGl0b3JDb250cmlidXRpb25EZXNjcmlwdGlvbltdID0gRWRpdG9yRXh0ZW5zaW9uc1JlZ2lzdHJ5LmdldERpZmZFZGl0b3JDb250cmlidXRpb25zKCk7XG5cdFx0Zm9yIChjb25zdCBkZXNjIG9mIGNvbnRyaWJ1dGlvbnMpIHtcblx0XHRcdHRyeSB7XG5cdFx0XHRcdHRoaXMuX3JlZ2lzdGVyKHRoaXMuX2luc3RhbnRpYXRpb25TZXJ2aWNlLmNyZWF0ZUluc3RhbmNlKGRlc2MuY3RvciwgdGhpcykpO1xuXHRcdFx0fSBjYXRjaCAoZXJyKSB7XG5cdFx0XHRcdG9uVW5leHBlY3RlZEVycm9yKGVycik7XG5cdFx0XHR9XG5cdFx0fVxuXHR9XG5cblx0cHJvdGVjdGVkIG92ZXJyaWRlIGdldCBfdGFyZ2V0RWRpdG9yKCk6IENvZGVFZGl0b3JXaWRnZXQgeyByZXR1cm4gdGhpcy5fZWRpdG9ycy5tb2RpZmllZDsgfVxuXG5cdG92ZXJyaWRlIGdldEVkaXRvclR5cGUoKTogc3RyaW5nIHsgcmV0dXJuIEVkaXRvclR5cGUuSURpZmZFZGl0b3I7IH1cblxuXHRvdmVycmlkZSBvblZpc2libGUoKTogdm9pZCB7XG5cdFx0Ly8gVE9ETzogT25seSBjb21wdXRlIGRpZmZzIHdoZW4gZGlmZiBlZGl0b3IgaXMgdmlzaWJsZVxuXHRcdHRoaXMuX2VkaXRvcnMub3JpZ2luYWwub25WaXNpYmxlKCk7XG5cdFx0dGhpcy5fZWRpdG9ycy5tb2RpZmllZC5vblZpc2libGUoKTtcblx0fVxuXG5cdG92ZXJyaWRlIG9uSGlkZSgpOiB2b2lkIHtcblx0XHR0aGlzLl9lZGl0b3JzLm9yaWdpbmFsLm9uSGlkZSgpO1xuXHRcdHRoaXMuX2VkaXRvcnMubW9kaWZpZWQub25IaWRlKCk7XG5cdH1cblxuXHRvdmVycmlkZSBsYXlvdXQoZGltZW5zaW9uPzogSURpbWVuc2lvbiB8IHVuZGVmaW5lZCk6IHZvaWQge1xuXHRcdHRoaXMuX3Jvb3RTaXplT2JzZXJ2ZXIub2JzZXJ2ZShkaW1lbnNpb24pO1xuXHR9XG5cblx0b3ZlcnJpZGUgaGFzVGV4dEZvY3VzKCk6IGJvb2xlYW4geyByZXR1cm4gdGhpcy5fZWRpdG9ycy5vcmlnaW5hbC5oYXNUZXh0Rm9jdXMoKSB8fCB0aGlzLl9lZGl0b3JzLm1vZGlmaWVkLmhhc1RleHRGb2N1cygpOyB9XG5cblx0cHVibGljIG92ZXJyaWRlIHNhdmVWaWV3U3RhdGUoKTogSURpZmZFZGl0b3JWaWV3U3RhdGUge1xuXHRcdGNvbnN0IG9yaWdpbmFsVmlld1N0YXRlID0gdGhpcy5fZWRpdG9ycy5vcmlnaW5hbC5zYXZlVmlld1N0YXRlKCk7XG5cdFx0Y29uc3QgbW9kaWZpZWRWaWV3U3RhdGUgPSB0aGlzLl9lZGl0b3JzLm1vZGlmaWVkLnNhdmVWaWV3U3RhdGUoKTtcblx0XHRyZXR1cm4ge1xuXHRcdFx0b3JpZ2luYWw6IG9yaWdpbmFsVmlld1N0YXRlLFxuXHRcdFx0bW9kaWZpZWQ6IG1vZGlmaWVkVmlld1N0YXRlLFxuXHRcdFx0bW9kZWxTdGF0ZTogdGhpcy5fZGlmZk1vZGVsLmdldCgpPy5zZXJpYWxpemVTdGF0ZSgpLFxuXHRcdH07XG5cdH1cblxuXHRwdWJsaWMgb3ZlcnJpZGUgcmVzdG9yZVZpZXdTdGF0ZShzOiBJRGlmZkVkaXRvclZpZXdTdGF0ZSk6IHZvaWQge1xuXHRcdGlmIChzICYmIHMub3JpZ2luYWwgJiYgcy5tb2RpZmllZCkge1xuXHRcdFx0Y29uc3QgZGlmZkVkaXRvclN0YXRlID0gcyBhcyBJRGlmZkVkaXRvclZpZXdTdGF0ZTtcblx0XHRcdHRoaXMuX2VkaXRvcnMub3JpZ2luYWwucmVzdG9yZVZpZXdTdGF0ZShkaWZmRWRpdG9yU3RhdGUub3JpZ2luYWwpO1xuXHRcdFx0dGhpcy5fZWRpdG9ycy5tb2RpZmllZC5yZXN0b3JlVmlld1N0YXRlKGRpZmZFZGl0b3JTdGF0ZS5tb2RpZmllZCk7XG5cdFx0XHRpZiAoZGlmZkVkaXRvclN0YXRlLm1vZGVsU3RhdGUpIHtcblx0XHRcdFx0dGhpcy5fZGlmZk1vZGVsLmdldCgpPy5yZXN0b3JlU2VyaWFsaXplZFN0YXRlKGRpZmZFZGl0b3JTdGF0ZS5tb2RlbFN0YXRlIGFzIGFueSk7XG5cdFx0XHR9XG5cdFx0fVxuXHR9XG5cblx0cHVibGljIGhhbmRsZUluaXRpYWxpemVkKCk6IHZvaWQge1xuXHRcdHRoaXMuX2VkaXRvcnMub3JpZ2luYWwuaGFuZGxlSW5pdGlhbGl6ZWQoKTtcblx0XHR0aGlzLl9lZGl0b3JzLm1vZGlmaWVkLmhhbmRsZUluaXRpYWxpemVkKCk7XG5cdH1cblxuXHRwdWJsaWMgY3JlYXRlVmlld01vZGVsKG1vZGVsOiBJRGlmZkVkaXRvck1vZGVsKTogSURpZmZFZGl0b3JWaWV3TW9kZWwge1xuXHRcdHJldHVybiB0aGlzLl9pbnN0YW50aWF0aW9uU2VydmljZS5jcmVhdGVJbnN0YW5jZShEaWZmRWRpdG9yVmlld01vZGVsLCBtb2RlbCwgdGhpcy5fb3B0aW9ucyk7XG5cdH1cblxuXHRvdmVycmlkZSBnZXRNb2RlbCgpOiBJRGlmZkVkaXRvck1vZGVsIHwgbnVsbCB7IHJldHVybiB0aGlzLl9kaWZmTW9kZWwuZ2V0KCk/Lm1vZGVsID8/IG51bGw7IH1cblxuXHRvdmVycmlkZSBzZXRNb2RlbChtb2RlbDogSURpZmZFZGl0b3JNb2RlbCB8IG51bGwgfCBJRGlmZkVkaXRvclZpZXdNb2RlbCk6IHZvaWQge1xuXHRcdGNvbnN0IHZtID0gIW1vZGVsID8gbnVsbFxuXHRcdFx0OiAoJ21vZGVsJyBpbiBtb2RlbCkgPyBSZWZDb3VudGVkLmNyZWF0ZShtb2RlbCkuY3JlYXRlTmV3UmVmKHRoaXMpXG5cdFx0XHRcdDogUmVmQ291bnRlZC5jcmVhdGUodGhpcy5jcmVhdGVWaWV3TW9kZWwobW9kZWwpLCB0aGlzKTtcblx0XHR0aGlzLnNldERpZmZNb2RlbCh2bSk7XG5cdH1cblxuXHRzZXREaWZmTW9kZWwodmlld01vZGVsOiBSZWZDb3VudGVkPElEaWZmRWRpdG9yVmlld01vZGVsPiB8IG51bGwsIHR4PzogSVRyYW5zYWN0aW9uKTogdm9pZCB7XG5cdFx0Y29uc3QgY3VycmVudE1vZGVsID0gdGhpcy5fZGlmZk1vZGVsLmdldCgpO1xuXG5cdFx0aWYgKCF2aWV3TW9kZWwgJiYgY3VycmVudE1vZGVsKSB7XG5cdFx0XHQvLyBUcmFuc2l0aW9uaW5nIGZyb20gYSBtb2RlbCB0byBuby1tb2RlbFxuXHRcdFx0dGhpcy5fYWNjZXNzaWJsZURpZmZWaWV3ZXIuZ2V0KCkuY2xvc2UoKTtcblx0XHR9XG5cblx0XHRpZiAodGhpcy5fZGlmZk1vZGVsLmdldCgpICE9PSB2aWV3TW9kZWw/Lm9iamVjdCkge1xuXHRcdFx0c3VidHJhbnNhY3Rpb24odHgsIHR4ID0+IHtcblx0XHRcdFx0Y29uc3Qgdm0gPSB2aWV3TW9kZWw/Lm9iamVjdDtcblx0XHRcdFx0LyoqIEBkZXNjcmlwdGlvbiBEaWZmRWRpdG9yV2lkZ2V0LnNldE1vZGVsICovXG5cdFx0XHRcdG9ic2VydmFibGVGcm9tRXZlbnQuYmF0Y2hFdmVudHNHbG9iYWxseSh0eCwgKCkgPT4ge1xuXHRcdFx0XHRcdHRoaXMuX2VkaXRvcnMub3JpZ2luYWwuc2V0TW9kZWwodm0gPyB2bS5tb2RlbC5vcmlnaW5hbCA6IG51bGwpO1xuXHRcdFx0XHRcdHRoaXMuX2VkaXRvcnMubW9kaWZpZWQuc2V0TW9kZWwodm0gPyB2bS5tb2RlbC5tb2RpZmllZCA6IG51bGwpO1xuXHRcdFx0XHR9KTtcblx0XHRcdFx0Y29uc3QgcHJldlZhbHVlUmVmID0gdGhpcy5fZGlmZk1vZGVsU3JjLmdldCgpPy5jcmVhdGVOZXdSZWYodGhpcyk7XG5cdFx0XHRcdHRoaXMuX2RpZmZNb2RlbFNyYy5zZXQodmlld01vZGVsPy5jcmVhdGVOZXdSZWYodGhpcykgYXMgUmVmQ291bnRlZDxEaWZmRWRpdG9yVmlld01vZGVsPiB8IHVuZGVmaW5lZCwgdHgpO1xuXHRcdFx0XHRzZXRUaW1lb3V0KCgpID0+IHtcblx0XHRcdFx0XHQvLyBhc3luYywgc28gdGhhdCB0aGlzIHJ1bnMgYWZ0ZXIgdGhlIHRyYW5zYWN0aW9uIGZpbmlzaGVkLlxuXHRcdFx0XHRcdC8vIFRPRE86IHVzZSB0aGUgdHJhbnNhY3Rpb24gdG8gc2NoZWR1bGUgZGlzcG9zYWxcblx0XHRcdFx0XHRwcmV2VmFsdWVSZWY/LmRpc3Bvc2UoKTtcblx0XHRcdFx0fSwgMCk7XG5cdFx0XHR9KTtcblx0XHR9XG5cdH1cblxuXHQvKipcblx0ICogQHBhcmFtIGNoYW5nZWRPcHRpb25zIE9ubHkgaGFzIHZhbHVlcyBmb3IgdG9wLWxldmVsIG9wdGlvbnMgdGhhdCBoYXZlIGFjdHVhbGx5IGNoYW5nZWQuXG5cdCAqL1xuXHRvdmVycmlkZSB1cGRhdGVPcHRpb25zKGNoYW5nZWRPcHRpb25zOiBJRGlmZkVkaXRvck9wdGlvbnMpOiB2b2lkIHtcblx0XHR0aGlzLl9vcHRpb25zLnVwZGF0ZU9wdGlvbnMoY2hhbmdlZE9wdGlvbnMpO1xuXHR9XG5cblx0Z2V0RG9tTm9kZSgpOiBIVE1MRWxlbWVudCB7IHJldHVybiB0aGlzLmVsZW1lbnRzLnJvb3Q7IH1cblx0Z2V0Q29udGFpbmVyRG9tTm9kZSgpOiBIVE1MRWxlbWVudCB7IHJldHVybiB0aGlzLl9kb21FbGVtZW50OyB9XG5cdGdldE9yaWdpbmFsRWRpdG9yKCk6IElDb2RlRWRpdG9yIHsgcmV0dXJuIHRoaXMuX2VkaXRvcnMub3JpZ2luYWw7IH1cblx0Z2V0TW9kaWZpZWRFZGl0b3IoKTogSUNvZGVFZGl0b3IgeyByZXR1cm4gdGhpcy5fZWRpdG9ycy5tb2RpZmllZDsgfVxuXG5cdHNldEJvdW5kYXJ5U2FzaGVzKHNhc2hlczogSUJvdW5kYXJ5U2FzaGVzKTogdm9pZCB7XG5cdFx0dGhpcy5fYm91bmRhcnlTYXNoZXMuc2V0KHNhc2hlcywgdW5kZWZpbmVkKTtcblx0fVxuXG5cdHByaXZhdGUgcmVhZG9ubHkgX2RpZmZWYWx1ZSA9IHRoaXMuX2RpZmZNb2RlbC5tYXAoKG0sIHIpID0+IG0/LmRpZmYucmVhZChyKSk7XG5cdHJlYWRvbmx5IG9uRGlkVXBkYXRlRGlmZjogRXZlbnQ8dm9pZD4gPSBFdmVudC5mcm9tT2JzZXJ2YWJsZUxpZ2h0KHRoaXMuX2RpZmZWYWx1ZSk7XG5cblx0Z2V0IGlnbm9yZVRyaW1XaGl0ZXNwYWNlKCk6IGJvb2xlYW4geyByZXR1cm4gdGhpcy5fb3B0aW9ucy5pZ25vcmVUcmltV2hpdGVzcGFjZS5nZXQoKTsgfVxuXG5cdGdldCBtYXhDb21wdXRhdGlvblRpbWUoKTogbnVtYmVyIHsgcmV0dXJuIHRoaXMuX29wdGlvbnMubWF4Q29tcHV0YXRpb25UaW1lTXMuZ2V0KCk7IH1cblxuXHRnZXQgcmVuZGVyU2lkZUJ5U2lkZSgpOiBib29sZWFuIHsgcmV0dXJuIHRoaXMuX29wdGlvbnMucmVuZGVyU2lkZUJ5U2lkZS5nZXQoKTsgfVxuXG5cdC8qKlxuXHQgKiBAZGVwcmVjYXRlZCBVc2UgYHRoaXMuZ2V0RGlmZkNvbXB1dGF0aW9uUmVzdWx0KCkuY2hhbmdlczJgIGluc3RlYWQuXG5cdCAqL1xuXHRnZXRMaW5lQ2hhbmdlcygpOiBJTGluZUNoYW5nZVtdIHwgbnVsbCB7XG5cdFx0Y29uc3QgZGlmZlN0YXRlID0gdGhpcy5fZGlmZk1vZGVsLmdldCgpPy5kaWZmLmdldCgpO1xuXHRcdGlmICghZGlmZlN0YXRlKSB7IHJldHVybiBudWxsOyB9XG5cdFx0cmV0dXJuIHRvTGluZUNoYW5nZXMoZGlmZlN0YXRlKTtcblx0fVxuXG5cdGdldERpZmZDb21wdXRhdGlvblJlc3VsdCgpOiBJRGlmZkNvbXB1dGF0aW9uUmVzdWx0IHwgbnVsbCB7XG5cdFx0Y29uc3QgZGlmZlN0YXRlID0gdGhpcy5fZGlmZk1vZGVsLmdldCgpPy5kaWZmLmdldCgpO1xuXHRcdGlmICghZGlmZlN0YXRlKSB7IHJldHVybiBudWxsOyB9XG5cblx0XHRyZXR1cm4ge1xuXHRcdFx0Y2hhbmdlczogdGhpcy5nZXRMaW5lQ2hhbmdlcygpISxcblx0XHRcdGNoYW5nZXMyOiBkaWZmU3RhdGUubWFwcGluZ3MubWFwKG0gPT4gbS5saW5lUmFuZ2VNYXBwaW5nKSxcblx0XHRcdGlkZW50aWNhbDogZGlmZlN0YXRlLmlkZW50aWNhbCxcblx0XHRcdHF1aXRFYXJseTogZGlmZlN0YXRlLnF1aXRFYXJseSxcblx0XHR9O1xuXHR9XG5cblx0cmV2ZXJ0KGRpZmY6IExpbmVSYW5nZU1hcHBpbmcpOiB2b2lkIHtcblx0XHRjb25zdCBtb2RlbCA9IHRoaXMuX2RpZmZNb2RlbC5nZXQoKTtcblx0XHRpZiAoIW1vZGVsIHx8ICFtb2RlbC5pc0RpZmZVcFRvRGF0ZS5nZXQoKSkgeyByZXR1cm47IH1cblxuXHRcdHRoaXMuX2VkaXRvcnMubW9kaWZpZWQuZXhlY3V0ZUVkaXRzKCdkaWZmRWRpdG9yJywgW1xuXHRcdFx0e1xuXHRcdFx0XHRyYW5nZTogZGlmZi5tb2RpZmllZC50b0V4Y2x1c2l2ZVJhbmdlKCksXG5cdFx0XHRcdHRleHQ6IG1vZGVsLm1vZGVsLm9yaWdpbmFsLmdldFZhbHVlSW5SYW5nZShkaWZmLm9yaWdpbmFsLnRvRXhjbHVzaXZlUmFuZ2UoKSlcblx0XHRcdH1cblx0XHRdKTtcblx0fVxuXG5cdHJldmVydFJhbmdlTWFwcGluZ3MoZGlmZnM6IFJhbmdlTWFwcGluZ1tdKTogdm9pZCB7XG5cdFx0Y29uc3QgbW9kZWwgPSB0aGlzLl9kaWZmTW9kZWwuZ2V0KCk7XG5cdFx0aWYgKCFtb2RlbCB8fCAhbW9kZWwuaXNEaWZmVXBUb0RhdGUuZ2V0KCkpIHsgcmV0dXJuOyB9XG5cblx0XHRjb25zdCBjaGFuZ2VzOiBJSWRlbnRpZmllZFNpbmdsZUVkaXRPcGVyYXRpb25bXSA9IGRpZmZzLm1hcDxJSWRlbnRpZmllZFNpbmdsZUVkaXRPcGVyYXRpb24+KGMgPT4gKHtcblx0XHRcdHJhbmdlOiBjLm1vZGlmaWVkUmFuZ2UsXG5cdFx0XHR0ZXh0OiBtb2RlbC5tb2RlbC5vcmlnaW5hbC5nZXRWYWx1ZUluUmFuZ2UoYy5vcmlnaW5hbFJhbmdlKVxuXHRcdH0pKTtcblxuXHRcdHRoaXMuX2VkaXRvcnMubW9kaWZpZWQuZXhlY3V0ZUVkaXRzKCdkaWZmRWRpdG9yJywgY2hhbmdlcyk7XG5cdH1cblxuXHRwcml2YXRlIF9nb1RvKGRpZmY6IERpZmZNYXBwaW5nKTogdm9pZCB7XG5cdFx0dGhpcy5fZWRpdG9ycy5tb2RpZmllZC5zZXRQb3NpdGlvbihuZXcgUG9zaXRpb24oZGlmZi5saW5lUmFuZ2VNYXBwaW5nLm1vZGlmaWVkLnN0YXJ0TGluZU51bWJlciwgMSkpO1xuXHRcdHRoaXMuX2VkaXRvcnMubW9kaWZpZWQucmV2ZWFsUmFuZ2VJbkNlbnRlcihkaWZmLmxpbmVSYW5nZU1hcHBpbmcubW9kaWZpZWQudG9FeGNsdXNpdmVSYW5nZSgpKTtcblx0fVxuXG5cdGdvVG9EaWZmKHRhcmdldDogJ3ByZXZpb3VzJyB8ICduZXh0Jyk6IHZvaWQge1xuXHRcdGNvbnN0IGRpZmZzID0gdGhpcy5fZGlmZk1vZGVsLmdldCgpPy5kaWZmLmdldCgpPy5tYXBwaW5ncztcblx0XHRpZiAoIWRpZmZzIHx8IGRpZmZzLmxlbmd0aCA9PT0gMCkge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblxuXHRcdGNvbnN0IGN1ckxpbmVOdW1iZXIgPSB0aGlzLl9lZGl0b3JzLm1vZGlmaWVkLmdldFBvc2l0aW9uKCkhLmxpbmVOdW1iZXI7XG5cblx0XHRsZXQgZGlmZjogRGlmZk1hcHBpbmcgfCB1bmRlZmluZWQ7XG5cdFx0aWYgKHRhcmdldCA9PT0gJ25leHQnKSB7XG5cdFx0XHRkaWZmID0gZGlmZnMuZmluZChkID0+IGQubGluZVJhbmdlTWFwcGluZy5tb2RpZmllZC5zdGFydExpbmVOdW1iZXIgPiBjdXJMaW5lTnVtYmVyKSA/PyBkaWZmc1swXTtcblx0XHR9IGVsc2Uge1xuXHRcdFx0ZGlmZiA9IGZpbmRMYXN0KGRpZmZzLCBkID0+IGQubGluZVJhbmdlTWFwcGluZy5tb2RpZmllZC5zdGFydExpbmVOdW1iZXIgPCBjdXJMaW5lTnVtYmVyKSA/PyBkaWZmc1tkaWZmcy5sZW5ndGggLSAxXTtcblx0XHR9XG5cdFx0dGhpcy5fZ29UbyhkaWZmKTtcblxuXHRcdGlmIChkaWZmLmxpbmVSYW5nZU1hcHBpbmcubW9kaWZpZWQuaXNFbXB0eSkge1xuXHRcdFx0dGhpcy5fYWNjZXNzaWJpbGl0eVNpZ25hbFNlcnZpY2UucGxheVNpZ25hbChBY2Nlc3NpYmlsaXR5U2lnbmFsLmRpZmZMaW5lRGVsZXRlZCwgeyBzb3VyY2U6ICdkaWZmRWRpdG9yLmdvVG9EaWZmJyB9KTtcblx0XHR9IGVsc2UgaWYgKGRpZmYubGluZVJhbmdlTWFwcGluZy5vcmlnaW5hbC5pc0VtcHR5KSB7XG5cdFx0XHR0aGlzLl9hY2Nlc3NpYmlsaXR5U2lnbmFsU2VydmljZS5wbGF5U2lnbmFsKEFjY2Vzc2liaWxpdHlTaWduYWwuZGlmZkxpbmVJbnNlcnRlZCwgeyBzb3VyY2U6ICdkaWZmRWRpdG9yLmdvVG9EaWZmJyB9KTtcblx0XHR9IGVsc2UgaWYgKGRpZmYpIHtcblx0XHRcdHRoaXMuX2FjY2Vzc2liaWxpdHlTaWduYWxTZXJ2aWNlLnBsYXlTaWduYWwoQWNjZXNzaWJpbGl0eVNpZ25hbC5kaWZmTGluZU1vZGlmaWVkLCB7IHNvdXJjZTogJ2RpZmZFZGl0b3IuZ29Ub0RpZmYnIH0pO1xuXHRcdH1cblx0fVxuXG5cdHJldmVhbEZpcnN0RGlmZigpOiB2b2lkIHtcblx0XHRjb25zdCBkaWZmTW9kZWwgPSB0aGlzLl9kaWZmTW9kZWwuZ2V0KCk7XG5cdFx0aWYgKCFkaWZmTW9kZWwpIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cdFx0Ly8gd2FpdCBmb3IgdGhlIGRpZmYgY29tcHV0YXRpb24gdG8gZmluaXNoXG5cdFx0dGhpcy53YWl0Rm9yRGlmZigpLnRoZW4oKCkgPT4ge1xuXHRcdFx0Y29uc3QgZGlmZnMgPSBkaWZmTW9kZWwuZGlmZi5nZXQoKT8ubWFwcGluZ3M7XG5cdFx0XHRpZiAoIWRpZmZzIHx8IGRpZmZzLmxlbmd0aCA9PT0gMCkge1xuXHRcdFx0XHRyZXR1cm47XG5cdFx0XHR9XG5cdFx0XHR0aGlzLl9nb1RvKGRpZmZzWzBdKTtcblx0XHR9KTtcblx0fVxuXG5cdGFjY2Vzc2libGVEaWZmVmlld2VyTmV4dCgpOiB2b2lkIHsgdGhpcy5fYWNjZXNzaWJsZURpZmZWaWV3ZXIuZ2V0KCkubmV4dCgpOyB9XG5cblx0YWNjZXNzaWJsZURpZmZWaWV3ZXJQcmV2KCk6IHZvaWQgeyB0aGlzLl9hY2Nlc3NpYmxlRGlmZlZpZXdlci5nZXQoKS5wcmV2KCk7IH1cblxuXHRhc3luYyB3YWl0Rm9yRGlmZigpOiBQcm9taXNlPHZvaWQ+IHtcblx0XHRjb25zdCBkaWZmTW9kZWwgPSB0aGlzLl9kaWZmTW9kZWwuZ2V0KCk7XG5cdFx0aWYgKCFkaWZmTW9kZWwpIHsgcmV0dXJuOyB9XG5cdFx0YXdhaXQgZGlmZk1vZGVsLndhaXRGb3JEaWZmKCk7XG5cdH1cblxuXHRtYXBUb090aGVyU2lkZSgpOiB7IGRlc3RpbmF0aW9uOiBDb2RlRWRpdG9yV2lkZ2V0OyBkZXN0aW5hdGlvblNlbGVjdGlvbjogUmFuZ2UgfCB1bmRlZmluZWQgfSB7XG5cdFx0Y29uc3QgaXNNb2RpZmllZEZvY3VzID0gdGhpcy5fZWRpdG9ycy5tb2RpZmllZC5oYXNXaWRnZXRGb2N1cygpO1xuXHRcdGNvbnN0IHNvdXJjZSA9IGlzTW9kaWZpZWRGb2N1cyA/IHRoaXMuX2VkaXRvcnMubW9kaWZpZWQgOiB0aGlzLl9lZGl0b3JzLm9yaWdpbmFsO1xuXHRcdGNvbnN0IGRlc3RpbmF0aW9uID0gaXNNb2RpZmllZEZvY3VzID8gdGhpcy5fZWRpdG9ycy5vcmlnaW5hbCA6IHRoaXMuX2VkaXRvcnMubW9kaWZpZWQ7XG5cblx0XHRsZXQgZGVzdGluYXRpb25TZWxlY3Rpb246IFJhbmdlIHwgdW5kZWZpbmVkO1xuXG5cdFx0Y29uc3Qgc291cmNlU2VsZWN0aW9uID0gc291cmNlLmdldFNlbGVjdGlvbigpO1xuXHRcdGlmIChzb3VyY2VTZWxlY3Rpb24pIHtcblx0XHRcdGNvbnN0IG1hcHBpbmdzID0gdGhpcy5fZGlmZk1vZGVsLmdldCgpPy5kaWZmLmdldCgpPy5tYXBwaW5ncy5tYXAobSA9PiBpc01vZGlmaWVkRm9jdXMgPyBtLmxpbmVSYW5nZU1hcHBpbmcuZmxpcCgpIDogbS5saW5lUmFuZ2VNYXBwaW5nKTtcblx0XHRcdGlmIChtYXBwaW5ncykge1xuXHRcdFx0XHRjb25zdCBuZXdSYW5nZTEgPSB0cmFuc2xhdGVQb3NpdGlvbihzb3VyY2VTZWxlY3Rpb24uZ2V0U3RhcnRQb3NpdGlvbigpLCBtYXBwaW5ncyk7XG5cdFx0XHRcdGNvbnN0IG5ld1JhbmdlMiA9IHRyYW5zbGF0ZVBvc2l0aW9uKHNvdXJjZVNlbGVjdGlvbi5nZXRFbmRQb3NpdGlvbigpLCBtYXBwaW5ncyk7XG5cdFx0XHRcdGRlc3RpbmF0aW9uU2VsZWN0aW9uID0gUmFuZ2UucGx1c1JhbmdlKG5ld1JhbmdlMSwgbmV3UmFuZ2UyKTtcblx0XHRcdH1cblx0XHR9XG5cdFx0cmV0dXJuIHsgZGVzdGluYXRpb24sIGRlc3RpbmF0aW9uU2VsZWN0aW9uIH07XG5cdH1cblxuXHRzd2l0Y2hTaWRlKCk6IHZvaWQge1xuXHRcdGNvbnN0IHsgZGVzdGluYXRpb24sIGRlc3RpbmF0aW9uU2VsZWN0aW9uIH0gPSB0aGlzLm1hcFRvT3RoZXJTaWRlKCk7XG5cdFx0ZGVzdGluYXRpb24uZm9jdXMoKTtcblx0XHRpZiAoZGVzdGluYXRpb25TZWxlY3Rpb24pIHtcblx0XHRcdGRlc3RpbmF0aW9uLnNldFNlbGVjdGlvbihkZXN0aW5hdGlvblNlbGVjdGlvbik7XG5cdFx0fVxuXHR9XG5cblx0ZXhpdENvbXBhcmVNb3ZlKCk6IHZvaWQge1xuXHRcdGNvbnN0IG1vZGVsID0gdGhpcy5fZGlmZk1vZGVsLmdldCgpO1xuXHRcdGlmICghbW9kZWwpIHsgcmV0dXJuOyB9XG5cdFx0bW9kZWwubW92ZWRUZXh0VG9Db21wYXJlLnNldCh1bmRlZmluZWQsIHVuZGVmaW5lZCk7XG5cdH1cblxuXHRjb2xsYXBzZUFsbFVuY2hhbmdlZFJlZ2lvbnMoKTogdm9pZCB7XG5cdFx0Y29uc3QgdW5jaGFuZ2VkUmVnaW9ucyA9IHRoaXMuX2RpZmZNb2RlbC5nZXQoKT8udW5jaGFuZ2VkUmVnaW9ucy5nZXQoKTtcblx0XHRpZiAoIXVuY2hhbmdlZFJlZ2lvbnMpIHsgcmV0dXJuOyB9XG5cdFx0dHJhbnNhY3Rpb24odHggPT4ge1xuXHRcdFx0Zm9yIChjb25zdCByZWdpb24gb2YgdW5jaGFuZ2VkUmVnaW9ucykge1xuXHRcdFx0XHRyZWdpb24uY29sbGFwc2VBbGwodHgpO1xuXHRcdFx0fVxuXHRcdH0pO1xuXHR9XG5cblx0c2hvd0FsbFVuY2hhbmdlZFJlZ2lvbnMoKTogdm9pZCB7XG5cdFx0Y29uc3QgdW5jaGFuZ2VkUmVnaW9ucyA9IHRoaXMuX2RpZmZNb2RlbC5nZXQoKT8udW5jaGFuZ2VkUmVnaW9ucy5nZXQoKTtcblx0XHRpZiAoIXVuY2hhbmdlZFJlZ2lvbnMpIHsgcmV0dXJuOyB9XG5cdFx0dHJhbnNhY3Rpb24odHggPT4ge1xuXHRcdFx0Zm9yIChjb25zdCByZWdpb24gb2YgdW5jaGFuZ2VkUmVnaW9ucykge1xuXHRcdFx0XHRyZWdpb24uc2hvd0FsbCh0eCk7XG5cdFx0XHR9XG5cdFx0fSk7XG5cdH1cblxuXHRwcml2YXRlIF9oYW5kbGVDdXJzb3JQb3NpdGlvbkNoYW5nZShlOiBJQ3Vyc29yUG9zaXRpb25DaGFuZ2VkRXZlbnQgfCB1bmRlZmluZWQsIGlzTW9kaWZpZWRFZGl0b3I6IGJvb2xlYW4pOiB2b2lkIHtcblx0XHRpZiAoZT8ucmVhc29uID09PSBDdXJzb3JDaGFuZ2VSZWFzb24uRXhwbGljaXQpIHtcblx0XHRcdGNvbnN0IGRpZmYgPSB0aGlzLl9kaWZmTW9kZWwuZ2V0KCk/LmRpZmYuZ2V0KCk/Lm1hcHBpbmdzLmZpbmQobSA9PiBpc01vZGlmaWVkRWRpdG9yID8gbS5saW5lUmFuZ2VNYXBwaW5nLm1vZGlmaWVkLmNvbnRhaW5zKGUucG9zaXRpb24ubGluZU51bWJlcikgOiBtLmxpbmVSYW5nZU1hcHBpbmcub3JpZ2luYWwuY29udGFpbnMoZS5wb3NpdGlvbi5saW5lTnVtYmVyKSk7XG5cdFx0XHRpZiAoZGlmZj8ubGluZVJhbmdlTWFwcGluZy5tb2RpZmllZC5pc0VtcHR5KSB7XG5cdFx0XHRcdHRoaXMuX2FjY2Vzc2liaWxpdHlTaWduYWxTZXJ2aWNlLnBsYXlTaWduYWwoQWNjZXNzaWJpbGl0eVNpZ25hbC5kaWZmTGluZURlbGV0ZWQsIHsgc291cmNlOiAnZGlmZkVkaXRvci5jdXJzb3JQb3NpdGlvbkNoYW5nZWQnIH0pO1xuXHRcdFx0fSBlbHNlIGlmIChkaWZmPy5saW5lUmFuZ2VNYXBwaW5nLm9yaWdpbmFsLmlzRW1wdHkpIHtcblx0XHRcdFx0dGhpcy5fYWNjZXNzaWJpbGl0eVNpZ25hbFNlcnZpY2UucGxheVNpZ25hbChBY2Nlc3NpYmlsaXR5U2lnbmFsLmRpZmZMaW5lSW5zZXJ0ZWQsIHsgc291cmNlOiAnZGlmZkVkaXRvci5jdXJzb3JQb3NpdGlvbkNoYW5nZWQnIH0pO1xuXHRcdFx0fSBlbHNlIGlmIChkaWZmKSB7XG5cdFx0XHRcdHRoaXMuX2FjY2Vzc2liaWxpdHlTaWduYWxTZXJ2aWNlLnBsYXlTaWduYWwoQWNjZXNzaWJpbGl0eVNpZ25hbC5kaWZmTGluZU1vZGlmaWVkLCB7IHNvdXJjZTogJ2RpZmZFZGl0b3IuY3Vyc29yUG9zaXRpb25DaGFuZ2VkJyB9KTtcblx0XHRcdH1cblx0XHR9XG5cdH1cbn1cblxuZXhwb3J0IGZ1bmN0aW9uIHRvTGluZUNoYW5nZXMoc3RhdGU6IERpZmZTdGF0ZSk6IElMaW5lQ2hhbmdlW10ge1xuXHRyZXR1cm4gc3RhdGUubWFwcGluZ3MubWFwKHggPT4ge1xuXHRcdGNvbnN0IG0gPSB4LmxpbmVSYW5nZU1hcHBpbmc7XG5cdFx0bGV0IG9yaWdpbmFsU3RhcnRMaW5lTnVtYmVyOiBudW1iZXI7XG5cdFx0bGV0IG9yaWdpbmFsRW5kTGluZU51bWJlcjogbnVtYmVyO1xuXHRcdGxldCBtb2RpZmllZFN0YXJ0TGluZU51bWJlcjogbnVtYmVyO1xuXHRcdGxldCBtb2RpZmllZEVuZExpbmVOdW1iZXI6IG51bWJlcjtcblx0XHRsZXQgaW5uZXJDaGFuZ2VzID0gbS5pbm5lckNoYW5nZXM7XG5cblx0XHRpZiAobS5vcmlnaW5hbC5pc0VtcHR5KSB7XG5cdFx0XHQvLyBJbnNlcnRpb25cblx0XHRcdG9yaWdpbmFsU3RhcnRMaW5lTnVtYmVyID0gbS5vcmlnaW5hbC5zdGFydExpbmVOdW1iZXIgLSAxO1xuXHRcdFx0b3JpZ2luYWxFbmRMaW5lTnVtYmVyID0gMDtcblx0XHRcdGlubmVyQ2hhbmdlcyA9IHVuZGVmaW5lZDtcblx0XHR9IGVsc2Uge1xuXHRcdFx0b3JpZ2luYWxTdGFydExpbmVOdW1iZXIgPSBtLm9yaWdpbmFsLnN0YXJ0TGluZU51bWJlcjtcblx0XHRcdG9yaWdpbmFsRW5kTGluZU51bWJlciA9IG0ub3JpZ2luYWwuZW5kTGluZU51bWJlckV4Y2x1c2l2ZSAtIDE7XG5cdFx0fVxuXG5cdFx0aWYgKG0ubW9kaWZpZWQuaXNFbXB0eSkge1xuXHRcdFx0Ly8gRGVsZXRpb25cblx0XHRcdG1vZGlmaWVkU3RhcnRMaW5lTnVtYmVyID0gbS5tb2RpZmllZC5zdGFydExpbmVOdW1iZXIgLSAxO1xuXHRcdFx0bW9kaWZpZWRFbmRMaW5lTnVtYmVyID0gMDtcblx0XHRcdGlubmVyQ2hhbmdlcyA9IHVuZGVmaW5lZDtcblx0XHR9IGVsc2Uge1xuXHRcdFx0bW9kaWZpZWRTdGFydExpbmVOdW1iZXIgPSBtLm1vZGlmaWVkLnN0YXJ0TGluZU51bWJlcjtcblx0XHRcdG1vZGlmaWVkRW5kTGluZU51bWJlciA9IG0ubW9kaWZpZWQuZW5kTGluZU51bWJlckV4Y2x1c2l2ZSAtIDE7XG5cdFx0fVxuXG5cdFx0cmV0dXJuIHtcblx0XHRcdG9yaWdpbmFsU3RhcnRMaW5lTnVtYmVyLFxuXHRcdFx0b3JpZ2luYWxFbmRMaW5lTnVtYmVyLFxuXHRcdFx0bW9kaWZpZWRTdGFydExpbmVOdW1iZXIsXG5cdFx0XHRtb2RpZmllZEVuZExpbmVOdW1iZXIsXG5cdFx0XHRjaGFyQ2hhbmdlczogaW5uZXJDaGFuZ2VzPy5tYXAobSA9PiAoe1xuXHRcdFx0XHRvcmlnaW5hbFN0YXJ0TGluZU51bWJlcjogbS5vcmlnaW5hbFJhbmdlLnN0YXJ0TGluZU51bWJlcixcblx0XHRcdFx0b3JpZ2luYWxTdGFydENvbHVtbjogbS5vcmlnaW5hbFJhbmdlLnN0YXJ0Q29sdW1uLFxuXHRcdFx0XHRvcmlnaW5hbEVuZExpbmVOdW1iZXI6IG0ub3JpZ2luYWxSYW5nZS5lbmRMaW5lTnVtYmVyLFxuXHRcdFx0XHRvcmlnaW5hbEVuZENvbHVtbjogbS5vcmlnaW5hbFJhbmdlLmVuZENvbHVtbixcblx0XHRcdFx0bW9kaWZpZWRTdGFydExpbmVOdW1iZXI6IG0ubW9kaWZpZWRSYW5nZS5zdGFydExpbmVOdW1iZXIsXG5cdFx0XHRcdG1vZGlmaWVkU3RhcnRDb2x1bW46IG0ubW9kaWZpZWRSYW5nZS5zdGFydENvbHVtbixcblx0XHRcdFx0bW9kaWZpZWRFbmRMaW5lTnVtYmVyOiBtLm1vZGlmaWVkUmFuZ2UuZW5kTGluZU51bWJlcixcblx0XHRcdFx0bW9kaWZpZWRFbmRDb2x1bW46IG0ubW9kaWZpZWRSYW5nZS5lbmRDb2x1bW4sXG5cdFx0XHR9KSlcblx0XHR9O1xuXHR9KTtcbn1cbiJdLAogICJtYXBw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LE1BQ2hJLFdBQVcsTUFBTSxpQkFBaUIsU0FBUyxTQUFTO0FBQ25ELGFBQUssNEJBQTRCLFdBQVcsb0JBQW9CLGtCQUFrQixFQUFFLFFBQVEsbUNBQW1DLENBQUM7QUFBQSxNQUNqSSxXQUFXLE1BQU07QUFDaEIsYUFBSyw0QkFBNEIsV0FBVyxvQkFBb0Isa0JBQWtCLEVBQUUsUUFBUSxtQ0FBbUMsQ0FBQztBQUFBLE1BQ2pJO0FBQUEsSUFDRDtBQUFBLEVBQ0Q7QUFDRDtBQXZvQmEsaUJBQ0UsNkJBQTZCLHFCQUFxQjtBQURwRCxtQkFBTjtBQUFBLEVBOENKO0FBQUEsRUFDQTtBQUFBLEVBQ0E7QUFBQSxFQUNBO0FBQUEsRUFDQTtBQUFBLEdBbERVO0FBeW9CTixTQUFTLGNBQWMsT0FBaUM7QUFDOUQsU0FBTyxNQUFNLFNBQVMsSUFBSSxPQUFLO0FBQzlCLFVBQU0sSUFBSSxFQUFFO0FBQ1osUUFBSTtBQUNKLFFBQUk7QUFDSixRQUFJO0FBQ0osUUFBSTtBQUNKLFFBQUksZUFBZSxFQUFFO0FBRXJCLFFBQUksRUFBRSxTQUFTLFNBQVM7QUFFdkIsZ0NBQTBCLEVBQUUsU0FBUyxrQkFBa0I7QUFDdkQsOEJBQXdCO0FBQ3hCLHFCQUFlO0FBQUEsSUFDaEIsT0FBTztBQUNOLGdDQUEwQixFQUFFLFNBQVM7QUFDckMsOEJBQXdCLEVBQUUsU0FBUyx5QkFBeUI7QUFBQSxJQUM3RDtBQUVBLFFBQUksRUFBRSxTQUFTLFNBQVM7QUFFdkIsZ0NBQTBCLEVBQUUsU0FBUyxrQkFBa0I7QUFDdkQsOEJBQXdCO0FBQ3hCLHFCQUFlO0FBQUEsSUFDaEIsT0FBTztBQUNOLGdDQUEwQixFQUFFLFNBQVM7QUFDckMsOEJBQXdCLEVBQUUsU0FBUyx5QkFBeUI7QUFBQSxJQUM3RDtBQUVBLFdBQU87QUFBQSxNQUNOO0FBQUEsTUFDQTtBQUFBLE1BQ0E7QUFBQSxNQUNBO0FBQUEsTUFDQSxhQUFhLGNBQWMsSUFBSSxDQUFBRCxRQUFNO0FBQUEsUUFDcEMseUJBQXlCQSxHQUFFLGNBQWM7QUFBQSxRQUN6QyxxQkFBcUJBLEdBQUUsY0FBYztBQUFBLFFBQ3JDLHVCQUF1QkEsR0FBRSxjQUFjO0FBQUEsUUFDdkMsbUJBQW1CQSxHQUFFLGNBQWM7QUFBQSxRQUNuQyx5QkFBeUJBLEdBQUUsY0FBYztBQUFBLFFBQ3pDLHFCQUFxQkEsR0FBRSxjQUFjO0FBQUEsUUFDckMsdUJBQXVCQSxHQUFFLGNBQWM7QUFBQSxRQUN2QyxtQkFBbUJBLEdBQUUsY0FBYztBQUFBLE1BQ3BDLEVBQUU7QUFBQSxJQUNIO0FBQUEsRUFDRCxDQUFDO0FBQ0Y7IiwKICAibmFtZXMiOiBbIm0iLCAidHgiXQp9Cg==
