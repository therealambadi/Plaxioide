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
import { Emitter } from "../../../../../base/common/event.js";
import { Disposable, DisposableStore, toDisposable } from "../../../../../base/common/lifecycle.js";
import { OutlineConfigCollapseItemsValues, IOutlineService, OutlineConfigKeys, OutlineTarget } from "../../../../services/outline/browser/outline.js";
import { Extensions as WorkbenchExtensions } from "../../../../common/contributions.js";
import { Registry } from "../../../../../platform/registry/common/platform.js";
import { LifecyclePhase } from "../../../../services/lifecycle/common/lifecycle.js";
import { DocumentSymbolComparator, DocumentSymbolAccessibilityProvider, DocumentSymbolRenderer, DocumentSymbolFilter, DocumentSymbolGroupRenderer, DocumentSymbolIdentityProvider, DocumentSymbolNavigationLabelProvider, DocumentSymbolVirtualDelegate, DocumentSymbolDragAndDrop } from "./documentSymbolsTree.js";
import { isCodeEditor, isDiffEditor } from "../../../../../editor/browser/editorBrowser.js";
import { OutlineGroup, OutlineElement, OutlineModel, TreeElement, IOutlineModelService } from "../../../../../editor/contrib/documentSymbols/browser/outlineModel.js";
import { CancellationTokenSource } from "../../../../../base/common/cancellation.js";
import { raceCancellation, TimeoutTimer, timeout, Barrier } from "../../../../../base/common/async.js";
import { onUnexpectedError } from "../../../../../base/common/errors.js";
import { ITextResourceConfigurationService } from "../../../../../editor/common/services/textResourceConfiguration.js";
import { IInstantiationService } from "../../../../../platform/instantiation/common/instantiation.js";
import { ScrollType } from "../../../../../editor/common/editorCommon.js";
import { Range } from "../../../../../editor/common/core/range.js";
import { TextEditorSelectionRevealType } from "../../../../../platform/editor/common/editor.js";
import { ICodeEditorService } from "../../../../../editor/browser/services/codeEditorService.js";
import { IConfigurationService } from "../../../../../platform/configuration/common/configuration.js";
import { localize } from "../../../../../nls.js";
import { IMarkerDecorationsService } from "../../../../../editor/common/services/markerDecorations.js";
import { MarkerSeverity } from "../../../../../platform/markers/common/markers.js";
import { isEqual } from "../../../../../base/common/resources.js";
import { ILanguageFeaturesService } from "../../../../../editor/common/services/languageFeatures.js";
let DocumentSymbolBreadcrumbsSource = class {
  constructor(_editor, _textResourceConfigurationService) {
    this._editor = _editor;
    this._textResourceConfigurationService = _textResourceConfigurationService;
    this._breadcrumbs = [];
  }
  getBreadcrumbElements() {
    return this._breadcrumbs;
  }
  clear() {
    this._breadcrumbs = [];
  }
  update(model, position) {
    const newElements = this._computeBreadcrumbs(model, position);
    this._breadcrumbs = newElements;
  }
  _computeBreadcrumbs(model, position) {
    let item = model.getItemEnclosingPosition(position);
    if (!item) {
      return [];
    }
    const chain = [];
    while (item) {
      chain.push(item);
      const parent = item.parent;
      if (parent instanceof OutlineModel) {
        break;
      }
      if (parent instanceof OutlineGroup && parent.parent && parent.parent.children.size === 1) {
        break;
      }
      item = parent;
    }
    const result = [];
    for (let i = chain.length - 1; i >= 0; i--) {
      const element = chain[i];
      if (this._isFiltered(element)) {
        break;
      }
      result.push(element);
    }
    if (result.length === 0) {
      return [];
    }
    return result;
  }
  _isFiltered(element) {
    if (!(element instanceof OutlineElement)) {
      return false;
    }
    const key = `breadcrumbs.${DocumentSymbolFilter.kindToConfigName[element.symbol.kind]}`;
    let uri;
    if (this._editor && this._editor.getModel()) {
      const model = this._editor.getModel();
      uri = model.uri;
    }
    return !this._textResourceConfigurationService.getValue(uri, key);
  }
};
DocumentSymbolBreadcrumbsSource = __decorateClass([
  __decorateParam(1, ITextResourceConfigurationService)
], DocumentSymbolBreadcrumbsSource);
let DocumentSymbolsOutline = class {
  constructor(_editor, target, firstLoadBarrier, _languageFeaturesService, _codeEditorService, _outlineModelService, _configurationService, _markerDecorationsService, textResourceConfigurationService, instantiationService) {
    this._editor = _editor;
    this._languageFeaturesService = _languageFeaturesService;
    this._codeEditorService = _codeEditorService;
    this._outlineModelService = _outlineModelService;
    this._configurationService = _configurationService;
    this._markerDecorationsService = _markerDecorationsService;
    this._disposables = new DisposableStore();
    this._onDidChange = new Emitter();
    this.onDidChange = this._onDidChange.event;
    this._outlineDisposables = new DisposableStore();
    this.outlineKind = "documentSymbols";
    this._breadcrumbsDataSource = new DocumentSymbolBreadcrumbsSource(_editor, textResourceConfigurationService);
    const delegate = new DocumentSymbolVirtualDelegate();
    const renderers = [new DocumentSymbolGroupRenderer(), instantiationService.createInstance(DocumentSymbolRenderer, true, target)];
    const treeDataSource = {
      getChildren: (parent) => {
        if (parent instanceof OutlineElement || parent instanceof OutlineGroup) {
          return parent.children.values();
        }
        if (parent === this && this._outlineModel) {
          return this._outlineModel.children.values();
        }
        return [];
      }
    };
    const comparator = new DocumentSymbolComparator();
    const initialState = textResourceConfigurationService.getValue(_editor.getModel()?.uri, OutlineConfigKeys.collapseItems);
    const options = {
      collapseByDefault: target === OutlineTarget.Breadcrumbs || target === OutlineTarget.OutlinePane && initialState === OutlineConfigCollapseItemsValues.Collapsed,
      expandOnlyOnTwistieClick: true,
      multipleSelectionSupport: false,
      identityProvider: new DocumentSymbolIdentityProvider(),
      keyboardNavigationLabelProvider: new DocumentSymbolNavigationLabelProvider(),
      accessibilityProvider: new DocumentSymbolAccessibilityProvider(localize("document", "Document Symbols")),
      filter: target === OutlineTarget.OutlinePane ? instantiationService.createInstance(DocumentSymbolFilter, "outline") : target === OutlineTarget.Breadcrumbs ? instantiationService.createInstance(DocumentSymbolFilter, "breadcrumbs") : void 0,
      dnd: instantiationService.createInstance(DocumentSymbolDragAndDrop)
    };
    this.config = {
      breadcrumbsDataSource: this._breadcrumbsDataSource,
      delegate,
      renderers,
      treeDataSource,
      comparator,
      options,
      quickPickDataSource: { getQuickPickElements: () => {
        throw new Error("not implemented");
      } }
    };
    this._disposables.add(_languageFeaturesService.documentSymbolProvider.onDidChange((_) => this._createOutline()));
    this._disposables.add(this._editor.onDidChangeModel((_) => this._createOutline()));
    this._disposables.add(this._editor.onDidChangeModelLanguage((_) => this._createOutline()));
    const updateSoon = new TimeoutTimer();
    this._disposables.add(updateSoon);
    this._disposables.add(this._editor.onDidChangeModelContent((event) => {
      const model = this._editor.getModel();
      if (model) {
        const timeout2 = _outlineModelService.getDebounceValue(model);
        updateSoon.cancelAndSet(() => this._createOutline(event), timeout2);
      }
    }));
    this._disposables.add(this._editor.onDidDispose(() => this._outlineDisposables.clear()));
    this._createOutline().finally(() => firstLoadBarrier.open());
  }
  get activeElement() {
    const posistion = this._editor.getPosition();
    if (!posistion || !this._outlineModel) {
      return void 0;
    } else {
      return this._outlineModel.getItemEnclosingPosition(posistion);
    }
  }
  dispose() {
    this._disposables.dispose();
    this._outlineDisposables.dispose();
  }
  get isEmpty() {
    return !this._outlineModel || TreeElement.empty(this._outlineModel);
  }
  get uri() {
    return this._outlineModel?.uri;
  }
  async reveal(entry, options, sideBySide, select) {
    const model = OutlineModel.get(entry);
    if (!model || !(entry instanceof OutlineElement)) {
      return;
    }
    await this._codeEditorService.openCodeEditor({
      resource: model.uri,
      options: {
        ...options,
        selection: select ? entry.symbol.range : Range.collapseToStart(entry.symbol.selectionRange),
        selectionRevealType: TextEditorSelectionRevealType.NearTopIfOutsideViewport
      }
    }, this._editor, sideBySide);
  }
  preview(entry) {
    if (!(entry instanceof OutlineElement)) {
      return Disposable.None;
    }
    const { symbol } = entry;
    this._editor.revealRangeInCenterIfOutsideViewport(symbol.range, ScrollType.Smooth);
    const decorationsCollection = this._editor.createDecorationsCollection([{
      range: symbol.range,
      options: {
        description: "document-symbols-outline-range-highlight",
        className: "rangeHighlight",
        isWholeLine: true
      }
    }]);
    return toDisposable(() => decorationsCollection.clear());
  }
  captureViewState() {
    const viewState = this._editor.saveViewState();
    return toDisposable(() => {
      if (viewState) {
        this._editor.restoreViewState(viewState);
      }
    });
  }
  async _createOutline(contentChangeEvent) {
    this._outlineDisposables.clear();
    if (!contentChangeEvent) {
      this._setOutlineModel(void 0);
    }
    if (!this._editor.hasModel()) {
      return;
    }
    const buffer = this._editor.getModel();
    if (!this._languageFeaturesService.documentSymbolProvider.has(buffer)) {
      return;
    }
    const cts = new CancellationTokenSource();
    const versionIdThen = buffer.getVersionId();
    const timeoutTimer = new TimeoutTimer();
    this._outlineDisposables.add(timeoutTimer);
    this._outlineDisposables.add(toDisposable(() => cts.dispose(true)));
    try {
      const model = await this._outlineModelService.getOrCreate(buffer, cts.token);
      if (cts.token.isCancellationRequested) {
        return;
      }
      if (TreeElement.empty(model) || !this._editor.hasModel()) {
        this._setOutlineModel(model);
        return;
      }
      if (contentChangeEvent && this._outlineModel && buffer.getLineCount() >= 25) {
        const newSize = TreeElement.size(model);
        const newLength = buffer.getValueLength();
        const newRatio = newSize / newLength;
        const oldSize = TreeElement.size(this._outlineModel);
        const oldLength = newLength - contentChangeEvent.changes.reduce((prev, value) => prev + value.rangeLength, 0);
        const oldRatio = oldSize / oldLength;
        if (newRatio <= oldRatio * 0.5 || newRatio >= oldRatio * 1.5) {
          const value = await raceCancellation(timeout(2e3).then(() => true), cts.token, false);
          if (!value) {
            return;
          }
        }
      }
      this._applyMarkersToOutline(model);
      this._outlineDisposables.add(this._markerDecorationsService.onDidChangeMarker((textModel) => {
        if (isEqual(model.uri, textModel.uri)) {
          this._applyMarkersToOutline(model);
          this._onDidChange.fire({});
        }
      }));
      this._outlineDisposables.add(this._configurationService.onDidChangeConfiguration((e) => {
        if (e.affectsConfiguration(OutlineConfigKeys.problemsEnabled) || e.affectsConfiguration("problems.visibility")) {
          const problem = this._configurationService.getValue("problems.visibility");
          const config = this._configurationService.getValue(OutlineConfigKeys.problemsEnabled);
          if (!problem || !config) {
            model.updateMarker([]);
          } else {
            this._applyMarkersToOutline(model);
          }
          this._onDidChange.fire({});
        }
        if (e.affectsConfiguration("outline")) {
          this._onDidChange.fire({});
        }
        if (e.affectsConfiguration("breadcrumbs") && this._editor.hasModel()) {
          this._breadcrumbsDataSource.update(model, this._editor.getPosition());
          this._onDidChange.fire({});
        }
      }));
      this._outlineDisposables.add(this._configurationService.onDidChangeConfiguration((e) => {
        if (e.affectsConfiguration(OutlineConfigKeys.icons)) {
          this._onDidChange.fire({});
        }
        if (e.affectsConfiguration("outline")) {
          this._onDidChange.fire({});
        }
      }));
      this._outlineDisposables.add(this._editor.onDidChangeCursorPosition((_) => {
        timeoutTimer.cancelAndSet(() => {
          if (!buffer.isDisposed() && versionIdThen === buffer.getVersionId() && this._editor.hasModel()) {
            this._breadcrumbsDataSource.update(model, this._editor.getPosition());
            this._onDidChange.fire({ affectOnlyActiveElement: true });
          }
        }, 150);
      }));
      this._setOutlineModel(model);
    } catch (err) {
      this._setOutlineModel(void 0);
      onUnexpectedError(err);
    }
  }
  _applyMarkersToOutline(model) {
    const problem = this._configurationService.getValue("problems.visibility");
    const config = this._configurationService.getValue(OutlineConfigKeys.problemsEnabled);
    if (!model || !problem || !config) {
      return;
    }
    const markers = [];
    for (const [range, marker] of this._markerDecorationsService.getLiveMarkers(model.uri)) {
      if (marker.severity === MarkerSeverity.Error || marker.severity === MarkerSeverity.Warning) {
        markers.push({ ...range, severity: marker.severity });
      }
    }
    model.updateMarker(markers);
  }
  _setOutlineModel(model) {
    const position = this._editor.getPosition();
    if (!position || !model) {
      this._outlineModel = void 0;
      this._breadcrumbsDataSource.clear();
    } else {
      if (!this._outlineModel?.merge(model)) {
        this._outlineModel = model;
      }
      this._breadcrumbsDataSource.update(model, position);
    }
    this._onDidChange.fire({});
  }
};
DocumentSymbolsOutline = __decorateClass([
  __decorateParam(3, ILanguageFeaturesService),
  __decorateParam(4, ICodeEditorService),
  __decorateParam(5, IOutlineModelService),
  __decorateParam(6, IConfigurationService),
  __decorateParam(7, IMarkerDecorationsService),
  __decorateParam(8, ITextResourceConfigurationService),
  __decorateParam(9, IInstantiationService)
], DocumentSymbolsOutline);
let DocumentSymbolsOutlineCreator = class {
  constructor(outlineService) {
    const reg = outlineService.registerOutlineCreator(this);
    this.dispose = () => reg.dispose();
  }
  matches(candidate) {
    const ctrl = candidate.getControl();
    return isCodeEditor(ctrl) || isDiffEditor(ctrl);
  }
  async createOutline(pane, target, _token) {
    const control = pane.getControl();
    let editor;
    if (isCodeEditor(control)) {
      editor = control;
    } else if (isDiffEditor(control)) {
      editor = control.getModifiedEditor();
    }
    if (!editor) {
      return void 0;
    }
    const firstLoadBarrier = new Barrier();
    const result = editor.invokeWithinContext((accessor) => accessor.get(IInstantiationService).createInstance(DocumentSymbolsOutline, editor, target, firstLoadBarrier));
    await firstLoadBarrier.wait();
    return result;
  }
};
DocumentSymbolsOutlineCreator = __decorateClass([
  __decorateParam(0, IOutlineService)
], DocumentSymbolsOutlineCreator);
Registry.as(WorkbenchExtensions.Workbench).registerWorkbenchContribution(DocumentSymbolsOutlineCreator, LifecyclePhase.Eventually);
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvY29udHJpYi9jb2RlRWRpdG9yL2Jyb3dzZXIvb3V0bGluZS9kb2N1bWVudFN5bWJvbHNPdXRsaW5lLnRzIl0sCiAgInNvdXJjZXNDb250ZW50IjogWyIvKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuICogIENvcHlyaWdodCAoYykgTWljcm9zb2Z0IENvcnBvcmF0aW9uLiBBbGwgcmlnaHRzIHJlc2VydmVkLlxuICogIExpY2Vuc2VkIHVuZGVyIHRoZSBNSVQgTGljZW5zZS4gU2VlIExpY2Vuc2UudHh0IGluIHRoZSBwcm9qZWN0IHJvb3QgZm9yIGxpY2Vuc2UgaW5mb3JtYXRpb24uXG4gKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tKi9cblxuaW1wb3J0IHsgRW1pdHRlciwgRXZlbnQgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9ldmVudC5qcyc7XG5pbXBvcnQgeyBEaXNwb3NhYmxlLCBEaXNwb3NhYmxlU3RvcmUsIElEaXNwb3NhYmxlLCB0b0Rpc3Bvc2FibGUgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9saWZlY3ljbGUuanMnO1xuaW1wb3J0IHsgT3V0bGluZUNvbmZpZ0NvbGxhcHNlSXRlbXNWYWx1ZXMsIElCcmVhZGNydW1ic0RhdGFTb3VyY2UsIElPdXRsaW5lLCBJT3V0bGluZUNyZWF0b3IsIElPdXRsaW5lTGlzdENvbmZpZywgSU91dGxpbmVTZXJ2aWNlLCBPdXRsaW5lQ2hhbmdlRXZlbnQsIE91dGxpbmVDb25maWdLZXlzLCBPdXRsaW5lVGFyZ2V0LCB9IGZyb20gJy4uLy4uLy4uLy4uL3NlcnZpY2VzL291dGxpbmUvYnJvd3Nlci9vdXRsaW5lLmpzJztcbmltcG9ydCB7IElXb3JrYmVuY2hDb250cmlidXRpb25zUmVnaXN0cnksIEV4dGVuc2lvbnMgYXMgV29ya2JlbmNoRXh0ZW5zaW9ucyB9IGZyb20gJy4uLy4uLy4uLy4uL2NvbW1vbi9jb250cmlidXRpb25zLmpzJztcbmltcG9ydCB7IFJlZ2lzdHJ5IH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vcGxhdGZvcm0vcmVnaXN0cnkvY29tbW9uL3BsYXRmb3JtLmpzJztcbmltcG9ydCB7IExpZmVjeWNsZVBoYXNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vc2VydmljZXMvbGlmZWN5Y2xlL2NvbW1vbi9saWZlY3ljbGUuanMnO1xuaW1wb3J0IHsgSUVkaXRvclBhbmUgfSBmcm9tICcuLi8uLi8uLi8uLi9jb21tb24vZWRpdG9yLmpzJztcbmltcG9ydCB7IERvY3VtZW50U3ltYm9sQ29tcGFyYXRvciwgRG9jdW1lbnRTeW1ib2xBY2Nlc3NpYmlsaXR5UHJvdmlkZXIsIERvY3VtZW50U3ltYm9sUmVuZGVyZXIsIERvY3VtZW50U3ltYm9sRmlsdGVyLCBEb2N1bWVudFN5bWJvbEdyb3VwUmVuZGVyZXIsIERvY3VtZW50U3ltYm9sSWRlbnRpdHlQcm92aWRlciwgRG9jdW1lbnRTeW1ib2xOYXZpZ2F0aW9uTGFiZWxQcm92aWRlciwgRG9jdW1lbnRTeW1ib2xWaXJ0dWFsRGVsZWdhdGUsIERvY3VtZW50U3ltYm9sRHJhZ0FuZERyb3AgfSBmcm9tICcuL2RvY3VtZW50U3ltYm9sc1RyZWUuanMnO1xuaW1wb3J0IHsgSUNvZGVFZGl0b3IsIGlzQ29kZUVkaXRvciwgaXNEaWZmRWRpdG9yIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vZWRpdG9yL2Jyb3dzZXIvZWRpdG9yQnJvd3Nlci5qcyc7XG5pbXBvcnQgeyBPdXRsaW5lR3JvdXAsIE91dGxpbmVFbGVtZW50LCBPdXRsaW5lTW9kZWwsIFRyZWVFbGVtZW50LCBJT3V0bGluZU1hcmtlciwgSU91dGxpbmVNb2RlbFNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9lZGl0b3IvY29udHJpYi9kb2N1bWVudFN5bWJvbHMvYnJvd3Nlci9vdXRsaW5lTW9kZWwuanMnO1xuaW1wb3J0IHsgQ2FuY2VsbGF0aW9uVG9rZW4sIENhbmNlbGxhdGlvblRva2VuU291cmNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vY2FuY2VsbGF0aW9uLmpzJztcbmltcG9ydCB7IHJhY2VDYW5jZWxsYXRpb24sIFRpbWVvdXRUaW1lciwgdGltZW91dCwgQmFycmllciB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2FzeW5jLmpzJztcbmltcG9ydCB7IG9uVW5leHBlY3RlZEVycm9yIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vZXJyb3JzLmpzJztcbmltcG9ydCB7IFVSSSB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL3VyaS5qcyc7XG5pbXBvcnQgeyBJVGV4dE1vZGVsIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vZWRpdG9yL2NvbW1vbi9tb2RlbC5qcyc7XG5pbXBvcnQgeyBJVGV4dFJlc291cmNlQ29uZmlndXJhdGlvblNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9lZGl0b3IvY29tbW9uL3NlcnZpY2VzL3RleHRSZXNvdXJjZUNvbmZpZ3VyYXRpb24uanMnO1xuaW1wb3J0IHsgSUluc3RhbnRpYXRpb25TZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vcGxhdGZvcm0vaW5zdGFudGlhdGlvbi9jb21tb24vaW5zdGFudGlhdGlvbi5qcyc7XG5pbXBvcnQgeyBJUG9zaXRpb24gfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9lZGl0b3IvY29tbW9uL2NvcmUvcG9zaXRpb24uanMnO1xuaW1wb3J0IHsgU2Nyb2xsVHlwZSB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL2VkaXRvci9jb21tb24vZWRpdG9yQ29tbW9uLmpzJztcbmltcG9ydCB7IFJhbmdlIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vZWRpdG9yL2NvbW1vbi9jb3JlL3JhbmdlLmpzJztcbmltcG9ydCB7IElFZGl0b3JPcHRpb25zLCBUZXh0RWRpdG9yU2VsZWN0aW9uUmV2ZWFsVHlwZSB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL3BsYXRmb3JtL2VkaXRvci9jb21tb24vZWRpdG9yLmpzJztcbmltcG9ydCB7IElDb2RlRWRpdG9yU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL2VkaXRvci9icm93c2VyL3NlcnZpY2VzL2NvZGVFZGl0b3JTZXJ2aWNlLmpzJztcbmltcG9ydCB7IElNb2RlbENvbnRlbnRDaGFuZ2VkRXZlbnQgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9lZGl0b3IvY29tbW9uL3RleHRNb2RlbEV2ZW50cy5qcyc7XG5pbXBvcnQgeyBJRGF0YVNvdXJjZSB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL2Jhc2UvYnJvd3Nlci91aS90cmVlL3RyZWUuanMnO1xuaW1wb3J0IHsgSUNvbmZpZ3VyYXRpb25TZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vcGxhdGZvcm0vY29uZmlndXJhdGlvbi9jb21tb24vY29uZmlndXJhdGlvbi5qcyc7XG5pbXBvcnQgeyBsb2NhbGl6ZSB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL25scy5qcyc7XG5pbXBvcnQgeyBJTWFya2VyRGVjb3JhdGlvbnNTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vZWRpdG9yL2NvbW1vbi9zZXJ2aWNlcy9tYXJrZXJEZWNvcmF0aW9ucy5qcyc7XG5pbXBvcnQgeyBNYXJrZXJTZXZlcml0eSB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL3BsYXRmb3JtL21hcmtlcnMvY29tbW9uL21hcmtlcnMuanMnO1xuaW1wb3J0IHsgaXNFcXVhbCB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL3Jlc291cmNlcy5qcyc7XG5pbXBvcnQgeyBJTGFuZ3VhZ2VGZWF0dXJlc1NlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9lZGl0b3IvY29tbW9uL3NlcnZpY2VzL2xhbmd1YWdlRmVhdHVyZXMuanMnO1xuXG50eXBlIERvY3VtZW50U3ltYm9sSXRlbSA9IE91dGxpbmVHcm91cCB8IE91dGxpbmVFbGVtZW50O1xuXG5jbGFzcyBEb2N1bWVudFN5bWJvbEJyZWFkY3J1bWJzU291cmNlIGltcGxlbWVudHMgSUJyZWFkY3J1bWJzRGF0YVNvdXJjZTxEb2N1bWVudFN5bWJvbEl0ZW0+IHtcblxuXHRwcml2YXRlIF9icmVhZGNydW1iczogKE91dGxpbmVHcm91cCB8IE91dGxpbmVFbGVtZW50KVtdID0gW107XG5cblx0Y29uc3RydWN0b3IoXG5cdFx0cHJpdmF0ZSByZWFkb25seSBfZWRpdG9yOiBJQ29kZUVkaXRvcixcblx0XHRASVRleHRSZXNvdXJjZUNvbmZpZ3VyYXRpb25TZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgX3RleHRSZXNvdXJjZUNvbmZpZ3VyYXRpb25TZXJ2aWNlOiBJVGV4dFJlc291cmNlQ29uZmlndXJhdGlvblNlcnZpY2UsXG5cdCkgeyB9XG5cblx0Z2V0QnJlYWRjcnVtYkVsZW1lbnRzKCk6IHJlYWRvbmx5IERvY3VtZW50U3ltYm9sSXRlbVtdIHtcblx0XHRyZXR1cm4gdGhpcy5fYnJlYWRjcnVtYnM7XG5cdH1cblxuXHRjbGVhcigpOiB2b2lkIHtcblx0XHR0aGlzLl9icmVhZGNydW1icyA9IFtdO1xuXHR9XG5cblx0dXBkYXRlKG1vZGVsOiBPdXRsaW5lTW9kZWwsIHBvc2l0aW9uOiBJUG9zaXRpb24pOiB2b2lkIHtcblx0XHRjb25zdCBuZXdFbGVtZW50cyA9IHRoaXMuX2NvbXB1dGVCcmVhZGNydW1icyhtb2RlbCwgcG9zaXRpb24pO1xuXHRcdHRoaXMuX2JyZWFkY3J1bWJzID0gbmV3RWxlbWVudHM7XG5cdH1cblxuXHRwcml2YXRlIF9jb21wdXRlQnJlYWRjcnVtYnMobW9kZWw6IE91dGxpbmVNb2RlbCwgcG9zaXRpb246IElQb3NpdGlvbik6IEFycmF5PE91dGxpbmVHcm91cCB8IE91dGxpbmVFbGVtZW50PiB7XG5cdFx0bGV0IGl0ZW06IE91dGxpbmVHcm91cCB8IE91dGxpbmVFbGVtZW50IHwgdW5kZWZpbmVkID0gbW9kZWwuZ2V0SXRlbUVuY2xvc2luZ1Bvc2l0aW9uKHBvc2l0aW9uKTtcblx0XHRpZiAoIWl0ZW0pIHtcblx0XHRcdHJldHVybiBbXTtcblx0XHR9XG5cdFx0Y29uc3QgY2hhaW46IEFycmF5PE91dGxpbmVHcm91cCB8IE91dGxpbmVFbGVtZW50PiA9IFtdO1xuXHRcdHdoaWxlIChpdGVtKSB7XG5cdFx0XHRjaGFpbi5wdXNoKGl0ZW0pO1xuXHRcdFx0Y29uc3QgcGFyZW50OiBhbnkgPSBpdGVtLnBhcmVudDtcblx0XHRcdGlmIChwYXJlbnQgaW5zdGFuY2VvZiBPdXRsaW5lTW9kZWwpIHtcblx0XHRcdFx0YnJlYWs7XG5cdFx0XHR9XG5cdFx0XHRpZiAocGFyZW50IGluc3RhbmNlb2YgT3V0bGluZUdyb3VwICYmIHBhcmVudC5wYXJlbnQgJiYgcGFyZW50LnBhcmVudC5jaGlsZHJlbi5zaXplID09PSAxKSB7XG5cdFx0XHRcdGJyZWFrO1xuXHRcdFx0fVxuXHRcdFx0aXRlbSA9IHBhcmVudDtcblx0XHR9XG5cdFx0Y29uc3QgcmVzdWx0OiBBcnJheTxPdXRsaW5lR3JvdXAgfCBPdXRsaW5lRWxlbWVudD4gPSBbXTtcblx0XHRmb3IgKGxldCBpID0gY2hhaW4ubGVuZ3RoIC0gMTsgaSA+PSAwOyBpLS0pIHtcblx0XHRcdGNvbnN0IGVsZW1lbnQgPSBjaGFpbltpXTtcblx0XHRcdGlmICh0aGlzLl9pc0ZpbHRlcmVkKGVsZW1lbnQpKSB7XG5cdFx0XHRcdGJyZWFrO1xuXHRcdFx0fVxuXHRcdFx0cmVzdWx0LnB1c2goZWxlbWVudCk7XG5cdFx0fVxuXHRcdGlmIChyZXN1bHQubGVuZ3RoID09PSAwKSB7XG5cdFx0XHRyZXR1cm4gW107XG5cdFx0fVxuXHRcdHJldHVybiByZXN1bHQ7XG5cdH1cblxuXHRwcml2YXRlIF9pc0ZpbHRlcmVkKGVsZW1lbnQ6IFRyZWVFbGVtZW50KTogYm9vbGVhbiB7XG5cdFx0aWYgKCEoZWxlbWVudCBpbnN0YW5jZW9mIE91dGxpbmVFbGVtZW50KSkge1xuXHRcdFx0cmV0dXJuIGZhbHNlO1xuXHRcdH1cblx0XHRjb25zdCBrZXkgPSBgYnJlYWRjcnVtYnMuJHtEb2N1bWVudFN5bWJvbEZpbHRlci5raW5kVG9Db25maWdOYW1lW2VsZW1lbnQuc3ltYm9sLmtpbmRdfWA7XG5cdFx0bGV0IHVyaTogVVJJIHwgdW5kZWZpbmVkO1xuXHRcdGlmICh0aGlzLl9lZGl0b3IgJiYgdGhpcy5fZWRpdG9yLmdldE1vZGVsKCkpIHtcblx0XHRcdGNvbnN0IG1vZGVsID0gdGhpcy5fZWRpdG9yLmdldE1vZGVsKCkgYXMgSVRleHRNb2RlbDtcblx0XHRcdHVyaSA9IG1vZGVsLnVyaTtcblx0XHR9XG5cdFx0cmV0dXJuICF0aGlzLl90ZXh0UmVzb3VyY2VDb25maWd1cmF0aW9uU2VydmljZS5nZXRWYWx1ZTxib29sZWFuPih1cmksIGtleSk7XG5cdH1cbn1cblxuXG5jbGFzcyBEb2N1bWVudFN5bWJvbHNPdXRsaW5lIGltcGxlbWVudHMgSU91dGxpbmU8RG9jdW1lbnRTeW1ib2xJdGVtPiB7XG5cblx0cHJpdmF0ZSByZWFkb25seSBfZGlzcG9zYWJsZXMgPSBuZXcgRGlzcG9zYWJsZVN0b3JlKCk7XG5cdHByaXZhdGUgcmVhZG9ubHkgX29uRGlkQ2hhbmdlID0gbmV3IEVtaXR0ZXI8T3V0bGluZUNoYW5nZUV2ZW50PigpO1xuXG5cdHJlYWRvbmx5IG9uRGlkQ2hhbmdlOiBFdmVudDxPdXRsaW5lQ2hhbmdlRXZlbnQ+ID0gdGhpcy5fb25EaWRDaGFuZ2UuZXZlbnQ7XG5cblx0cHJpdmF0ZSBfb3V0bGluZU1vZGVsPzogT3V0bGluZU1vZGVsO1xuXHRwcml2YXRlIHJlYWRvbmx5IF9vdXRsaW5lRGlzcG9zYWJsZXMgPSBuZXcgRGlzcG9zYWJsZVN0b3JlKCk7XG5cblx0cHJpdmF0ZSByZWFkb25seSBfYnJlYWRjcnVtYnNEYXRhU291cmNlOiBEb2N1bWVudFN5bWJvbEJyZWFkY3J1bWJzU291cmNlO1xuXG5cdHJlYWRvbmx5IGNvbmZpZzogSU91dGxpbmVMaXN0Q29uZmlnPERvY3VtZW50U3ltYm9sSXRlbT47XG5cblx0cmVhZG9ubHkgb3V0bGluZUtpbmQgPSAnZG9jdW1lbnRTeW1ib2xzJztcblxuXHRnZXQgYWN0aXZlRWxlbWVudCgpOiBEb2N1bWVudFN5bWJvbEl0ZW0gfCB1bmRlZmluZWQge1xuXHRcdGNvbnN0IHBvc2lzdGlvbiA9IHRoaXMuX2VkaXRvci5nZXRQb3NpdGlvbigpO1xuXHRcdGlmICghcG9zaXN0aW9uIHx8ICF0aGlzLl9vdXRsaW5lTW9kZWwpIHtcblx0XHRcdHJldHVybiB1bmRlZmluZWQ7XG5cdFx0fSBlbHNlIHtcblx0XHRcdHJldHVybiB0aGlzLl9vdXRsaW5lTW9kZWwuZ2V0SXRlbUVuY2xvc2luZ1Bvc2l0aW9uKHBvc2lzdGlvbik7XG5cdFx0fVxuXHR9XG5cblx0Y29uc3RydWN0b3IoXG5cdFx0cHJpdmF0ZSByZWFkb25seSBfZWRpdG9yOiBJQ29kZUVkaXRvcixcblx0XHR0YXJnZXQ6IE91dGxpbmVUYXJnZXQsXG5cdFx0Zmlyc3RMb2FkQmFycmllcjogQmFycmllcixcblx0XHRASUxhbmd1YWdlRmVhdHVyZXNTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgX2xhbmd1YWdlRmVhdHVyZXNTZXJ2aWNlOiBJTGFuZ3VhZ2VGZWF0dXJlc1NlcnZpY2UsXG5cdFx0QElDb2RlRWRpdG9yU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IF9jb2RlRWRpdG9yU2VydmljZTogSUNvZGVFZGl0b3JTZXJ2aWNlLFxuXHRcdEBJT3V0bGluZU1vZGVsU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IF9vdXRsaW5lTW9kZWxTZXJ2aWNlOiBJT3V0bGluZU1vZGVsU2VydmljZSxcblx0XHRASUNvbmZpZ3VyYXRpb25TZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgX2NvbmZpZ3VyYXRpb25TZXJ2aWNlOiBJQ29uZmlndXJhdGlvblNlcnZpY2UsXG5cdFx0QElNYXJrZXJEZWNvcmF0aW9uc1NlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBfbWFya2VyRGVjb3JhdGlvbnNTZXJ2aWNlOiBJTWFya2VyRGVjb3JhdGlvbnNTZXJ2aWNlLFxuXHRcdEBJVGV4dFJlc291cmNlQ29uZmlndXJhdGlvblNlcnZpY2UgdGV4dFJlc291cmNlQ29uZmlndXJhdGlvblNlcnZpY2U6IElUZXh0UmVzb3VyY2VDb25maWd1cmF0aW9uU2VydmljZSxcblx0XHRASUluc3RhbnRpYXRpb25TZXJ2aWNlIGluc3RhbnRpYXRpb25TZXJ2aWNlOiBJSW5zdGFudGlhdGlvblNlcnZpY2UsXG5cdCkge1xuXG5cdFx0dGhpcy5fYnJlYWRjcnVtYnNEYXRhU291cmNlID0gbmV3IERvY3VtZW50U3ltYm9sQnJlYWRjcnVtYnNTb3VyY2UoX2VkaXRvciwgdGV4dFJlc291cmNlQ29uZmlndXJhdGlvblNlcnZpY2UpO1xuXHRcdGNvbnN0IGRlbGVnYXRlID0gbmV3IERvY3VtZW50U3ltYm9sVmlydHVhbERlbGVnYXRlKCk7XG5cdFx0Y29uc3QgcmVuZGVyZXJzID0gW25ldyBEb2N1bWVudFN5bWJvbEdyb3VwUmVuZGVyZXIoKSwgaW5zdGFudGlhdGlvblNlcnZpY2UuY3JlYXRlSW5zdGFuY2UoRG9jdW1lbnRTeW1ib2xSZW5kZXJlciwgdHJ1ZSwgdGFyZ2V0KV07XG5cdFx0Y29uc3QgdHJlZURhdGFTb3VyY2U6IElEYXRhU291cmNlPHRoaXMsIERvY3VtZW50U3ltYm9sSXRlbT4gPSB7XG5cdFx0XHRnZXRDaGlsZHJlbjogKHBhcmVudCkgPT4ge1xuXHRcdFx0XHRpZiAocGFyZW50IGluc3RhbmNlb2YgT3V0bGluZUVsZW1lbnQgfHwgcGFyZW50IGluc3RhbmNlb2YgT3V0bGluZUdyb3VwKSB7XG5cdFx0XHRcdFx0cmV0dXJuIHBhcmVudC5jaGlsZHJlbi52YWx1ZXMoKTtcblx0XHRcdFx0fVxuXHRcdFx0XHRpZiAocGFyZW50ID09PSB0aGlzICYmIHRoaXMuX291dGxpbmVNb2RlbCkge1xuXHRcdFx0XHRcdHJldHVybiB0aGlzLl9vdXRsaW5lTW9kZWwuY2hpbGRyZW4udmFsdWVzKCk7XG5cdFx0XHRcdH1cblx0XHRcdFx0cmV0dXJuIFtdO1xuXHRcdFx0fVxuXHRcdH07XG5cdFx0Y29uc3QgY29tcGFyYXRvciA9IG5ldyBEb2N1bWVudFN5bWJvbENvbXBhcmF0b3IoKTtcblx0XHRjb25zdCBpbml0aWFsU3RhdGUgPSB0ZXh0UmVzb3VyY2VDb25maWd1cmF0aW9uU2VydmljZS5nZXRWYWx1ZTxPdXRsaW5lQ29uZmlnQ29sbGFwc2VJdGVtc1ZhbHVlcz4oX2VkaXRvci5nZXRNb2RlbCgpPy51cmksIE91dGxpbmVDb25maWdLZXlzLmNvbGxhcHNlSXRlbXMpO1xuXHRcdGNvbnN0IG9wdGlvbnMgPSB7XG5cdFx0XHRjb2xsYXBzZUJ5RGVmYXVsdDogdGFyZ2V0ID09PSBPdXRsaW5lVGFyZ2V0LkJyZWFkY3J1bWJzIHx8ICh0YXJnZXQgPT09IE91dGxpbmVUYXJnZXQuT3V0bGluZVBhbmUgJiYgaW5pdGlhbFN0YXRlID09PSBPdXRsaW5lQ29uZmlnQ29sbGFwc2VJdGVtc1ZhbHVlcy5Db2xsYXBzZWQpLFxuXHRcdFx0ZXhwYW5kT25seU9uVHdpc3RpZUNsaWNrOiB0cnVlLFxuXHRcdFx0bXVsdGlwbGVTZWxlY3Rpb25TdXBwb3J0OiBmYWxzZSxcblx0XHRcdGlkZW50aXR5UHJvdmlkZXI6IG5ldyBEb2N1bWVudFN5bWJvbElkZW50aXR5UHJvdmlkZXIoKSxcblx0XHRcdGtleWJvYXJkTmF2aWdhdGlvbkxhYmVsUHJvdmlkZXI6IG5ldyBEb2N1bWVudFN5bWJvbE5hdmlnYXRpb25MYWJlbFByb3ZpZGVyKCksXG5cdFx0XHRhY2Nlc3NpYmlsaXR5UHJvdmlkZXI6IG5ldyBEb2N1bWVudFN5bWJvbEFjY2Vzc2liaWxpdHlQcm92aWRlcihsb2NhbGl6ZSgnZG9jdW1lbnQnLCBcIkRvY3VtZW50IFN5bWJvbHNcIikpLFxuXHRcdFx0ZmlsdGVyOiB0YXJnZXQgPT09IE91dGxpbmVUYXJnZXQuT3V0bGluZVBhbmVcblx0XHRcdFx0PyBpbnN0YW50aWF0aW9uU2VydmljZS5jcmVhdGVJbnN0YW5jZShEb2N1bWVudFN5bWJvbEZpbHRlciwgJ291dGxpbmUnKVxuXHRcdFx0XHQ6IHRhcmdldCA9PT0gT3V0bGluZVRhcmdldC5CcmVhZGNydW1ic1xuXHRcdFx0XHRcdD8gaW5zdGFudGlhdGlvblNlcnZpY2UuY3JlYXRlSW5zdGFuY2UoRG9jdW1lbnRTeW1ib2xGaWx0ZXIsICdicmVhZGNydW1icycpXG5cdFx0XHRcdFx0OiB1bmRlZmluZWQsXG5cdFx0XHRkbmQ6IGluc3RhbnRpYXRpb25TZXJ2aWNlLmNyZWF0ZUluc3RhbmNlKERvY3VtZW50U3ltYm9sRHJhZ0FuZERyb3ApLFxuXHRcdH07XG5cblx0XHR0aGlzLmNvbmZpZyA9IHtcblx0XHRcdGJyZWFkY3J1bWJzRGF0YVNvdXJjZTogdGhpcy5fYnJlYWRjcnVtYnNEYXRhU291cmNlLFxuXHRcdFx0ZGVsZWdhdGUsXG5cdFx0XHRyZW5kZXJlcnMsXG5cdFx0XHR0cmVlRGF0YVNvdXJjZSxcblx0XHRcdGNvbXBhcmF0b3IsXG5cdFx0XHRvcHRpb25zLFxuXHRcdFx0cXVpY2tQaWNrRGF0YVNvdXJjZTogeyBnZXRRdWlja1BpY2tFbGVtZW50czogKCkgPT4geyB0aHJvdyBuZXcgRXJyb3IoJ25vdCBpbXBsZW1lbnRlZCcpOyB9IH1cblx0XHR9O1xuXG5cblx0XHQvLyB1cGRhdGUgYXMgbGFuZ3VhZ2UsIG1vZGVsLCBwcm92aWRlcnMgY2hhbmdlc1xuXHRcdHRoaXMuX2Rpc3Bvc2FibGVzLmFkZChfbGFuZ3VhZ2VGZWF0dXJlc1NlcnZpY2UuZG9jdW1lbnRTeW1ib2xQcm92aWRlci5vbkRpZENoYW5nZShfID0+IHRoaXMuX2NyZWF0ZU91dGxpbmUoKSkpO1xuXHRcdHRoaXMuX2Rpc3Bvc2FibGVzLmFkZCh0aGlzLl9lZGl0b3Iub25EaWRDaGFuZ2VNb2RlbChfID0+IHRoaXMuX2NyZWF0ZU91dGxpbmUoKSkpO1xuXHRcdHRoaXMuX2Rpc3Bvc2FibGVzLmFkZCh0aGlzLl9lZGl0b3Iub25EaWRDaGFuZ2VNb2RlbExhbmd1YWdlKF8gPT4gdGhpcy5fY3JlYXRlT3V0bGluZSgpKSk7XG5cblx0XHQvLyB1cGRhdGUgc29vbidpc2ggYXMgbW9kZWwgY29udGVudCBjaGFuZ2Vcblx0XHRjb25zdCB1cGRhdGVTb29uID0gbmV3IFRpbWVvdXRUaW1lcigpO1xuXHRcdHRoaXMuX2Rpc3Bvc2FibGVzLmFkZCh1cGRhdGVTb29uKTtcblx0XHR0aGlzLl9kaXNwb3NhYmxlcy5hZGQodGhpcy5fZWRpdG9yLm9uRGlkQ2hhbmdlTW9kZWxDb250ZW50KGV2ZW50ID0+IHtcblx0XHRcdGNvbnN0IG1vZGVsID0gdGhpcy5fZWRpdG9yLmdldE1vZGVsKCk7XG5cdFx0XHRpZiAobW9kZWwpIHtcblx0XHRcdFx0Y29uc3QgdGltZW91dCA9IF9vdXRsaW5lTW9kZWxTZXJ2aWNlLmdldERlYm91bmNlVmFsdWUobW9kZWwpO1xuXHRcdFx0XHR1cGRhdGVTb29uLmNhbmNlbEFuZFNldCgoKSA9PiB0aGlzLl9jcmVhdGVPdXRsaW5lKGV2ZW50KSwgdGltZW91dCk7XG5cdFx0XHR9XG5cdFx0fSkpO1xuXG5cdFx0Ly8gc3RvcCB3aGVuIGVkaXRvciBkaWVzXG5cdFx0dGhpcy5fZGlzcG9zYWJsZXMuYWRkKHRoaXMuX2VkaXRvci5vbkRpZERpc3Bvc2UoKCkgPT4gdGhpcy5fb3V0bGluZURpc3Bvc2FibGVzLmNsZWFyKCkpKTtcblxuXHRcdC8vIGluaXRpYWwgbG9hZFxuXHRcdHRoaXMuX2NyZWF0ZU91dGxpbmUoKS5maW5hbGx5KCgpID0+IGZpcnN0TG9hZEJhcnJpZXIub3BlbigpKTtcblx0fVxuXG5cdGRpc3Bvc2UoKTogdm9pZCB7XG5cdFx0dGhpcy5fZGlzcG9zYWJsZXMuZGlzcG9zZSgpO1xuXHRcdHRoaXMuX291dGxpbmVEaXNwb3NhYmxlcy5kaXNwb3NlKCk7XG5cdH1cblxuXHRnZXQgaXNFbXB0eSgpOiBib29sZWFuIHtcblx0XHRyZXR1cm4gIXRoaXMuX291dGxpbmVNb2RlbCB8fCBUcmVlRWxlbWVudC5lbXB0eSh0aGlzLl9vdXRsaW5lTW9kZWwpO1xuXHR9XG5cblx0Z2V0IHVyaSgpIHtcblx0XHRyZXR1cm4gdGhpcy5fb3V0bGluZU1vZGVsPy51cmk7XG5cdH1cblxuXHRhc3luYyByZXZlYWwoZW50cnk6IERvY3VtZW50U3ltYm9sSXRlbSwgb3B0aW9uczogSUVkaXRvck9wdGlvbnMsIHNpZGVCeVNpZGU6IGJvb2xlYW4sIHNlbGVjdDogYm9vbGVhbik6IFByb21pc2U8dm9pZD4ge1xuXHRcdGNvbnN0IG1vZGVsID0gT3V0bGluZU1vZGVsLmdldChlbnRyeSk7XG5cdFx0aWYgKCFtb2RlbCB8fCAhKGVudHJ5IGluc3RhbmNlb2YgT3V0bGluZUVsZW1lbnQpKSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXHRcdGF3YWl0IHRoaXMuX2NvZGVFZGl0b3JTZXJ2aWNlLm9wZW5Db2RlRWRpdG9yKHtcblx0XHRcdHJlc291cmNlOiBtb2RlbC51cmksXG5cdFx0XHRvcHRpb25zOiB7XG5cdFx0XHRcdC4uLm9wdGlvbnMsXG5cdFx0XHRcdHNlbGVjdGlvbjogc2VsZWN0ID8gZW50cnkuc3ltYm9sLnJhbmdlIDogUmFuZ2UuY29sbGFwc2VUb1N0YXJ0KGVudHJ5LnN5bWJvbC5zZWxlY3Rpb25SYW5nZSksXG5cdFx0XHRcdHNlbGVjdGlvblJldmVhbFR5cGU6IFRleHRFZGl0b3JTZWxlY3Rpb25SZXZlYWxUeXBlLk5lYXJUb3BJZk91dHNpZGVWaWV3cG9ydCxcblx0XHRcdH1cblx0XHR9LCB0aGlzLl9lZGl0b3IsIHNpZGVCeVNpZGUpO1xuXHR9XG5cblx0cHJldmlldyhlbnRyeTogRG9jdW1lbnRTeW1ib2xJdGVtKTogSURpc3Bvc2FibGUge1xuXHRcdGlmICghKGVudHJ5IGluc3RhbmNlb2YgT3V0bGluZUVsZW1lbnQpKSB7XG5cdFx0XHRyZXR1cm4gRGlzcG9zYWJsZS5Ob25lO1xuXHRcdH1cblxuXHRcdGNvbnN0IHsgc3ltYm9sIH0gPSBlbnRyeTtcblx0XHR0aGlzLl9lZGl0b3IucmV2ZWFsUmFuZ2VJbkNlbnRlcklmT3V0c2lkZVZpZXdwb3J0KHN5bWJvbC5yYW5nZSwgU2Nyb2xsVHlwZS5TbW9vdGgpO1xuXHRcdGNvbnN0IGRlY29yYXRpb25zQ29sbGVjdGlvbiA9IHRoaXMuX2VkaXRvci5jcmVhdGVEZWNvcmF0aW9uc0NvbGxlY3Rpb24oW3tcblx0XHRcdHJhbmdlOiBzeW1ib2wucmFuZ2UsXG5cdFx0XHRvcHRpb25zOiB7XG5cdFx0XHRcdGRlc2NyaXB0aW9uOiAnZG9jdW1lbnQtc3ltYm9scy1vdXRsaW5lLXJhbmdlLWhpZ2hsaWdodCcsXG5cdFx0XHRcdGNsYXNzTmFtZTogJ3JhbmdlSGlnaGxpZ2h0Jyxcblx0XHRcdFx0aXNXaG9sZUxpbmU6IHRydWVcblx0XHRcdH1cblx0XHR9XSk7XG5cdFx0cmV0dXJuIHRvRGlzcG9zYWJsZSgoKSA9PiBkZWNvcmF0aW9uc0NvbGxlY3Rpb24uY2xlYXIoKSk7XG5cdH1cblxuXHRjYXB0dXJlVmlld1N0YXRlKCk6IElEaXNwb3NhYmxlIHtcblx0XHRjb25zdCB2aWV3U3RhdGUgPSB0aGlzLl9lZGl0b3Iuc2F2ZVZpZXdTdGF0ZSgpO1xuXHRcdHJldHVybiB0b0Rpc3Bvc2FibGUoKCkgPT4ge1xuXHRcdFx0aWYgKHZpZXdTdGF0ZSkge1xuXHRcdFx0XHR0aGlzLl9lZGl0b3IucmVzdG9yZVZpZXdTdGF0ZSh2aWV3U3RhdGUpO1xuXHRcdFx0fVxuXHRcdH0pO1xuXHR9XG5cblx0cHJpdmF0ZSBhc3luYyBfY3JlYXRlT3V0bGluZShjb250ZW50Q2hhbmdlRXZlbnQ/OiBJTW9kZWxDb250ZW50Q2hhbmdlZEV2ZW50KTogUHJvbWlzZTx2b2lkPiB7XG5cblx0XHR0aGlzLl9vdXRsaW5lRGlzcG9zYWJsZXMuY2xlYXIoKTtcblx0XHRpZiAoIWNvbnRlbnRDaGFuZ2VFdmVudCkge1xuXHRcdFx0dGhpcy5fc2V0T3V0bGluZU1vZGVsKHVuZGVmaW5lZCk7XG5cdFx0fVxuXG5cdFx0aWYgKCF0aGlzLl9lZGl0b3IuaGFzTW9kZWwoKSkge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblx0XHRjb25zdCBidWZmZXIgPSB0aGlzLl9lZGl0b3IuZ2V0TW9kZWwoKTtcblx0XHRpZiAoIXRoaXMuX2xhbmd1YWdlRmVhdHVyZXNTZXJ2aWNlLmRvY3VtZW50U3ltYm9sUHJvdmlkZXIuaGFzKGJ1ZmZlcikpIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cblx0XHRjb25zdCBjdHMgPSBuZXcgQ2FuY2VsbGF0aW9uVG9rZW5Tb3VyY2UoKTtcblx0XHRjb25zdCB2ZXJzaW9uSWRUaGVuID0gYnVmZmVyLmdldFZlcnNpb25JZCgpO1xuXHRcdGNvbnN0IHRpbWVvdXRUaW1lciA9IG5ldyBUaW1lb3V0VGltZXIoKTtcblxuXHRcdHRoaXMuX291dGxpbmVEaXNwb3NhYmxlcy5hZGQodGltZW91dFRpbWVyKTtcblx0XHR0aGlzLl9vdXRsaW5lRGlzcG9zYWJsZXMuYWRkKHRvRGlzcG9zYWJsZSgoKSA9PiBjdHMuZGlzcG9zZSh0cnVlKSkpO1xuXG5cdFx0dHJ5IHtcblx0XHRcdGNvbnN0IG1vZGVsID0gYXdhaXQgdGhpcy5fb3V0bGluZU1vZGVsU2VydmljZS5nZXRPckNyZWF0ZShidWZmZXIsIGN0cy50b2tlbik7XG5cdFx0XHRpZiAoY3RzLnRva2VuLmlzQ2FuY2VsbGF0aW9uUmVxdWVzdGVkKSB7XG5cdFx0XHRcdC8vIGNhbmNlbGxlZCAtPiBkbyBub3RoaW5nXG5cdFx0XHRcdHJldHVybjtcblx0XHRcdH1cblxuXHRcdFx0aWYgKFRyZWVFbGVtZW50LmVtcHR5KG1vZGVsKSB8fCAhdGhpcy5fZWRpdG9yLmhhc01vZGVsKCkpIHtcblx0XHRcdFx0Ly8gZW1wdHkgLT4gbm8gb3V0bGluZSBlbGVtZW50c1xuXHRcdFx0XHR0aGlzLl9zZXRPdXRsaW5lTW9kZWwobW9kZWwpO1xuXHRcdFx0XHRyZXR1cm47XG5cdFx0XHR9XG5cblx0XHRcdC8vIGhldXJpc3RpYzogd2hlbiB0aGUgc3ltYm9scy10by1saW5lcyByYXRpbyBjaGFuZ2VzIGJ5IDUwJSBiZXR3ZWVuIGVkaXRzXG5cdFx0XHQvLyB3YWl0IGEgbGl0dGxlIChhbmQgaG9wZSB0aGF0IHRoZSBuZXh0IGNoYW5nZSBpc24ndCBhcyBkcmFzdGljKS5cblx0XHRcdGlmIChjb250ZW50Q2hhbmdlRXZlbnQgJiYgdGhpcy5fb3V0bGluZU1vZGVsICYmIGJ1ZmZlci5nZXRMaW5lQ291bnQoKSA+PSAyNSkge1xuXHRcdFx0XHRjb25zdCBuZXdTaXplID0gVHJlZUVsZW1lbnQuc2l6ZShtb2RlbCk7XG5cdFx0XHRcdGNvbnN0IG5ld0xlbmd0aCA9IGJ1ZmZlci5nZXRWYWx1ZUxlbmd0aCgpO1xuXHRcdFx0XHRjb25zdCBuZXdSYXRpbyA9IG5ld1NpemUgLyBuZXdMZW5ndGg7XG5cdFx0XHRcdGNvbnN0IG9sZFNpemUgPSBUcmVlRWxlbWVudC5zaXplKHRoaXMuX291dGxpbmVNb2RlbCk7XG5cdFx0XHRcdGNvbnN0IG9sZExlbmd0aCA9IG5ld0xlbmd0aCAtIGNvbnRlbnRDaGFuZ2VFdmVudC5jaGFuZ2VzLnJlZHVjZSgocHJldiwgdmFsdWUpID0+IHByZXYgKyB2YWx1ZS5yYW5nZUxlbmd0aCwgMCk7XG5cdFx0XHRcdGNvbnN0IG9sZFJhdGlvID0gb2xkU2l6ZSAvIG9sZExlbmd0aDtcblx0XHRcdFx0aWYgKG5ld1JhdGlvIDw9IG9sZFJhdGlvICogMC41IHx8IG5ld1JhdGlvID49IG9sZFJhdGlvICogMS41KSB7XG5cdFx0XHRcdFx0Ly8gd2FpdCBmb3IgYSBiZXR0ZXIgc3RhdGUgYW5kIGlnbm9yZSBjdXJyZW50IG1vZGVsIHdoZW4gbW9yZVxuXHRcdFx0XHRcdC8vIHR5cGluZyBoYXMgaGFwcGVuZWRcblx0XHRcdFx0XHRjb25zdCB2YWx1ZSA9IGF3YWl0IHJhY2VDYW5jZWxsYXRpb24odGltZW91dCgyMDAwKS50aGVuKCgpID0+IHRydWUpLCBjdHMudG9rZW4sIGZhbHNlKTtcblx0XHRcdFx0XHRpZiAoIXZhbHVlKSB7XG5cdFx0XHRcdFx0XHRyZXR1cm47XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9XG5cdFx0XHR9XG5cblx0XHRcdC8vIGZlYXR1cmU6IHNob3cgbWFya2VycyB3aXRoIG91dGxpbmUgZWxlbWVudFxuXHRcdFx0dGhpcy5fYXBwbHlNYXJrZXJzVG9PdXRsaW5lKG1vZGVsKTtcblx0XHRcdHRoaXMuX291dGxpbmVEaXNwb3NhYmxlcy5hZGQodGhpcy5fbWFya2VyRGVjb3JhdGlvbnNTZXJ2aWNlLm9uRGlkQ2hhbmdlTWFya2VyKHRleHRNb2RlbCA9PiB7XG5cdFx0XHRcdGlmIChpc0VxdWFsKG1vZGVsLnVyaSwgdGV4dE1vZGVsLnVyaSkpIHtcblx0XHRcdFx0XHR0aGlzLl9hcHBseU1hcmtlcnNUb091dGxpbmUobW9kZWwpO1xuXHRcdFx0XHRcdHRoaXMuX29uRGlkQ2hhbmdlLmZpcmUoe30pO1xuXHRcdFx0XHR9XG5cdFx0XHR9KSk7XG5cdFx0XHR0aGlzLl9vdXRsaW5lRGlzcG9zYWJsZXMuYWRkKHRoaXMuX2NvbmZpZ3VyYXRpb25TZXJ2aWNlLm9uRGlkQ2hhbmdlQ29uZmlndXJhdGlvbihlID0+IHtcblx0XHRcdFx0aWYgKGUuYWZmZWN0c0NvbmZpZ3VyYXRpb24oT3V0bGluZUNvbmZpZ0tleXMucHJvYmxlbXNFbmFibGVkKSB8fCBlLmFmZmVjdHNDb25maWd1cmF0aW9uKCdwcm9ibGVtcy52aXNpYmlsaXR5JykpIHtcblx0XHRcdFx0XHRjb25zdCBwcm9ibGVtID0gdGhpcy5fY29uZmlndXJhdGlvblNlcnZpY2UuZ2V0VmFsdWUoJ3Byb2JsZW1zLnZpc2liaWxpdHknKTtcblx0XHRcdFx0XHRjb25zdCBjb25maWcgPSB0aGlzLl9jb25maWd1cmF0aW9uU2VydmljZS5nZXRWYWx1ZShPdXRsaW5lQ29uZmlnS2V5cy5wcm9ibGVtc0VuYWJsZWQpO1xuXG5cdFx0XHRcdFx0aWYgKCFwcm9ibGVtIHx8ICFjb25maWcpIHtcblx0XHRcdFx0XHRcdG1vZGVsLnVwZGF0ZU1hcmtlcihbXSk7XG5cdFx0XHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0XHRcdHRoaXMuX2FwcGx5TWFya2Vyc1RvT3V0bGluZShtb2RlbCk7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHRcdHRoaXMuX29uRGlkQ2hhbmdlLmZpcmUoe30pO1xuXHRcdFx0XHR9XG5cdFx0XHRcdGlmIChlLmFmZmVjdHNDb25maWd1cmF0aW9uKCdvdXRsaW5lJykpIHtcblx0XHRcdFx0XHQvLyBvdXRsaW5lIGZpbHRlcmluZywgcHJvYmxlbXMgb24vb2ZmXG5cdFx0XHRcdFx0dGhpcy5fb25EaWRDaGFuZ2UuZmlyZSh7fSk7XG5cdFx0XHRcdH1cblx0XHRcdFx0aWYgKGUuYWZmZWN0c0NvbmZpZ3VyYXRpb24oJ2JyZWFkY3J1bWJzJykgJiYgdGhpcy5fZWRpdG9yLmhhc01vZGVsKCkpIHtcblx0XHRcdFx0XHQvLyBicmVhZGNydW1icyBmaWx0ZXJpbmdcblx0XHRcdFx0XHR0aGlzLl9icmVhZGNydW1ic0RhdGFTb3VyY2UudXBkYXRlKG1vZGVsLCB0aGlzLl9lZGl0b3IuZ2V0UG9zaXRpb24oKSk7XG5cdFx0XHRcdFx0dGhpcy5fb25EaWRDaGFuZ2UuZmlyZSh7fSk7XG5cdFx0XHRcdH1cblx0XHRcdH0pKTtcblxuXHRcdFx0Ly8gZmVhdHVyZTogdG9nZ2xlIGljb25zXG5cdFx0XHR0aGlzLl9vdXRsaW5lRGlzcG9zYWJsZXMuYWRkKHRoaXMuX2NvbmZpZ3VyYXRpb25TZXJ2aWNlLm9uRGlkQ2hhbmdlQ29uZmlndXJhdGlvbihlID0+IHtcblx0XHRcdFx0aWYgKGUuYWZmZWN0c0NvbmZpZ3VyYXRpb24oT3V0bGluZUNvbmZpZ0tleXMuaWNvbnMpKSB7XG5cdFx0XHRcdFx0dGhpcy5fb25EaWRDaGFuZ2UuZmlyZSh7fSk7XG5cdFx0XHRcdH1cblx0XHRcdFx0aWYgKGUuYWZmZWN0c0NvbmZpZ3VyYXRpb24oJ291dGxpbmUnKSkge1xuXHRcdFx0XHRcdHRoaXMuX29uRGlkQ2hhbmdlLmZpcmUoe30pO1xuXHRcdFx0XHR9XG5cdFx0XHR9KSk7XG5cblx0XHRcdC8vIGZlYXR1cmU6IHVwZGF0ZSBhY3RpdmUgd2hlbiBjdXJzb3IgY2hhbmdlc1xuXHRcdFx0dGhpcy5fb3V0bGluZURpc3Bvc2FibGVzLmFkZCh0aGlzLl9lZGl0b3Iub25EaWRDaGFuZ2VDdXJzb3JQb3NpdGlvbihfID0+IHtcblx0XHRcdFx0dGltZW91dFRpbWVyLmNhbmNlbEFuZFNldCgoKSA9PiB7XG5cdFx0XHRcdFx0aWYgKCFidWZmZXIuaXNEaXNwb3NlZCgpICYmIHZlcnNpb25JZFRoZW4gPT09IGJ1ZmZlci5nZXRWZXJzaW9uSWQoKSAmJiB0aGlzLl9lZGl0b3IuaGFzTW9kZWwoKSkge1xuXHRcdFx0XHRcdFx0dGhpcy5fYnJlYWRjcnVtYnNEYXRhU291cmNlLnVwZGF0ZShtb2RlbCwgdGhpcy5fZWRpdG9yLmdldFBvc2l0aW9uKCkpO1xuXHRcdFx0XHRcdFx0dGhpcy5fb25EaWRDaGFuZ2UuZmlyZSh7IGFmZmVjdE9ubHlBY3RpdmVFbGVtZW50OiB0cnVlIH0pO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0fSwgMTUwKTtcblx0XHRcdH0pKTtcblxuXHRcdFx0Ly8gdXBkYXRlIHByb3BlcnRpZXMsIHNlbmQgZXZlbnRcblx0XHRcdHRoaXMuX3NldE91dGxpbmVNb2RlbChtb2RlbCk7XG5cblx0XHR9IGNhdGNoIChlcnIpIHtcblx0XHRcdHRoaXMuX3NldE91dGxpbmVNb2RlbCh1bmRlZmluZWQpO1xuXHRcdFx0b25VbmV4cGVjdGVkRXJyb3IoZXJyKTtcblx0XHR9XG5cdH1cblxuXHRwcml2YXRlIF9hcHBseU1hcmtlcnNUb091dGxpbmUobW9kZWw6IE91dGxpbmVNb2RlbCB8IHVuZGVmaW5lZCk6IHZvaWQge1xuXHRcdGNvbnN0IHByb2JsZW0gPSB0aGlzLl9jb25maWd1cmF0aW9uU2VydmljZS5nZXRWYWx1ZSgncHJvYmxlbXMudmlzaWJpbGl0eScpO1xuXHRcdGNvbnN0IGNvbmZpZyA9IHRoaXMuX2NvbmZpZ3VyYXRpb25TZXJ2aWNlLmdldFZhbHVlKE91dGxpbmVDb25maWdLZXlzLnByb2JsZW1zRW5hYmxlZCk7XG5cdFx0aWYgKCFtb2RlbCB8fCAhcHJvYmxlbSB8fCAhY29uZmlnKSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXHRcdGNvbnN0IG1hcmtlcnM6IElPdXRsaW5lTWFya2VyW10gPSBbXTtcblx0XHRmb3IgKGNvbnN0IFtyYW5nZSwgbWFya2VyXSBvZiB0aGlzLl9tYXJrZXJEZWNvcmF0aW9uc1NlcnZpY2UuZ2V0TGl2ZU1hcmtlcnMobW9kZWwudXJpKSkge1xuXHRcdFx0aWYgKG1hcmtlci5zZXZlcml0eSA9PT0gTWFya2VyU2V2ZXJpdHkuRXJyb3IgfHwgbWFya2VyLnNldmVyaXR5ID09PSBNYXJrZXJTZXZlcml0eS5XYXJuaW5nKSB7XG5cdFx0XHRcdG1hcmtlcnMucHVzaCh7IC4uLnJhbmdlLCBzZXZlcml0eTogbWFya2VyLnNldmVyaXR5IH0pO1xuXHRcdFx0fVxuXHRcdH1cblx0XHRtb2RlbC51cGRhdGVNYXJrZXIobWFya2Vycyk7XG5cdH1cblxuXHRwcml2YXRlIF9zZXRPdXRsaW5lTW9kZWwobW9kZWw6IE91dGxpbmVNb2RlbCB8IHVuZGVmaW5lZCkge1xuXHRcdGNvbnN0IHBvc2l0aW9uID0gdGhpcy5fZWRpdG9yLmdldFBvc2l0aW9uKCk7XG5cdFx0aWYgKCFwb3NpdGlvbiB8fCAhbW9kZWwpIHtcblx0XHRcdHRoaXMuX291dGxpbmVNb2RlbCA9IHVuZGVmaW5lZDtcblx0XHRcdHRoaXMuX2JyZWFkY3J1bWJzRGF0YVNvdXJjZS5jbGVhcigpO1xuXHRcdH0gZWxzZSB7XG5cdFx0XHRpZiAoIXRoaXMuX291dGxpbmVNb2RlbD8ubWVyZ2UobW9kZWwpKSB7XG5cdFx0XHRcdHRoaXMuX291dGxpbmVNb2RlbCA9IG1vZGVsO1xuXHRcdFx0fVxuXHRcdFx0dGhpcy5fYnJlYWRjcnVtYnNEYXRhU291cmNlLnVwZGF0ZShtb2RlbCwgcG9zaXRpb24pO1xuXHRcdH1cblx0XHR0aGlzLl9vbkRpZENoYW5nZS5maXJlKHt9KTtcblx0fVxufVxuXG5jbGFzcyBEb2N1bWVudFN5bWJvbHNPdXRsaW5lQ3JlYXRvciBpbXBsZW1lbnRzIElPdXRsaW5lQ3JlYXRvcjxJRWRpdG9yUGFuZSwgRG9jdW1lbnRTeW1ib2xJdGVtPiB7XG5cblx0cmVhZG9ubHkgZGlzcG9zZTogKCkgPT4gdm9pZDtcblxuXHRjb25zdHJ1Y3Rvcihcblx0XHRASU91dGxpbmVTZXJ2aWNlIG91dGxpbmVTZXJ2aWNlOiBJT3V0bGluZVNlcnZpY2Vcblx0KSB7XG5cdFx0Y29uc3QgcmVnID0gb3V0bGluZVNlcnZpY2UucmVnaXN0ZXJPdXRsaW5lQ3JlYXRvcih0aGlzKTtcblx0XHR0aGlzLmRpc3Bvc2UgPSAoKSA9PiByZWcuZGlzcG9zZSgpO1xuXHR9XG5cblx0bWF0Y2hlcyhjYW5kaWRhdGU6IElFZGl0b3JQYW5lKTogY2FuZGlkYXRlIGlzIElFZGl0b3JQYW5lIHtcblx0XHRjb25zdCBjdHJsID0gY2FuZGlkYXRlLmdldENvbnRyb2woKTtcblx0XHRyZXR1cm4gaXNDb2RlRWRpdG9yKGN0cmwpIHx8IGlzRGlmZkVkaXRvcihjdHJsKTtcblx0fVxuXG5cdGFzeW5jIGNyZWF0ZU91dGxpbmUocGFuZTogSUVkaXRvclBhbmUsIHRhcmdldDogT3V0bGluZVRhcmdldCwgX3Rva2VuOiBDYW5jZWxsYXRpb25Ub2tlbik6IFByb21pc2U8SU91dGxpbmU8RG9jdW1lbnRTeW1ib2xJdGVtPiB8IHVuZGVmaW5lZD4ge1xuXHRcdGNvbnN0IGNvbnRyb2wgPSBwYW5lLmdldENvbnRyb2woKTtcblx0XHRsZXQgZWRpdG9yOiBJQ29kZUVkaXRvciB8IHVuZGVmaW5lZDtcblx0XHRpZiAoaXNDb2RlRWRpdG9yKGNvbnRyb2wpKSB7XG5cdFx0XHRlZGl0b3IgPSBjb250cm9sO1xuXHRcdH0gZWxzZSBpZiAoaXNEaWZmRWRpdG9yKGNvbnRyb2wpKSB7XG5cdFx0XHRlZGl0b3IgPSBjb250cm9sLmdldE1vZGlmaWVkRWRpdG9yKCk7XG5cdFx0fVxuXHRcdGlmICghZWRpdG9yKSB7XG5cdFx0XHRyZXR1cm4gdW5kZWZpbmVkO1xuXHRcdH1cblx0XHRjb25zdCBmaXJzdExvYWRCYXJyaWVyID0gbmV3IEJhcnJpZXIoKTtcblx0XHRjb25zdCByZXN1bHQgPSBlZGl0b3IuaW52b2tlV2l0aGluQ29udGV4dChhY2Nlc3NvciA9PiBhY2Nlc3Nvci5nZXQoSUluc3RhbnRpYXRpb25TZXJ2aWNlKS5jcmVhdGVJbnN0YW5jZShEb2N1bWVudFN5bWJvbHNPdXRsaW5lLCBlZGl0b3IsIHRhcmdldCwgZmlyc3RMb2FkQmFycmllcikpO1xuXHRcdGF3YWl0IGZpcnN0TG9hZEJhcnJpZXIud2FpdCgpO1xuXHRcdHJldHVybiByZXN1bHQ7XG5cdH1cbn1cblxuUmVnaXN0cnkuYXM8SVdvcmtiZW5jaENvbnRyaWJ1dGlvbnNSZWdpc3RyeT4oV29ya2JlbmNoRXh0ZW5zaW9ucy5Xb3JrYmVuY2gpLnJlZ2lzdGVyV29ya2JlbmNoQ29udHJpYnV0aW9uKERvY3VtZW50U3ltYm9sc091dGxpbmVDcmVhdG9yLCBMaWZlY3ljbGVQaGFzZS5FdmVudHVhbGx5KTtcbiJdLAogICJtYXBwaW5ncyI6ICI7Ozs7Ozs7Ozs7O0FBS0EsU0FBUyxlQUFzQjtBQUMvQixTQUFTLFlBQVksaUJBQThCLG9CQUFvQjtBQUN2RSxTQUFTLGtDQUF5RyxpQkFBcUMsbUJBQW1CLHFCQUFzQjtBQUNoTSxTQUEwQyxjQUFjLDJCQUEyQjtBQUNuRixTQUFTLGdCQUFnQjtBQUN6QixTQUFTLHNCQUFzQjtBQUUvQixTQUFTLDBCQUEwQixxQ0FBcUMsd0JBQXdCLHNCQUFzQiw2QkFBNkIsZ0NBQWdDLHVDQUF1QywrQkFBK0IsaUNBQWlDO0FBQzFSLFNBQXNCLGNBQWMsb0JBQW9CO0FBQ3hELFNBQVMsY0FBYyxnQkFBZ0IsY0FBYyxhQUE2Qiw0QkFBNEI7QUFDOUcsU0FBNEIsK0JBQStCO0FBQzNELFNBQVMsa0JBQWtCLGNBQWMsU0FBUyxlQUFlO0FBQ2pFLFNBQVMseUJBQXlCO0FBR2xDLFNBQVMseUNBQXlDO0FBQ2xELFNBQVMsNkJBQTZCO0FBRXRDLFNBQVMsa0JBQWtCO0FBQzNCLFNBQVMsYUFBYTtBQUN0QixTQUF5QixxQ0FBcUM7QUFDOUQsU0FBUywwQkFBMEI7QUFHbkMsU0FBUyw2QkFB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QUFXLEtBQUssUUFBUSxZQUFZO0FBQzFDLFFBQUksQ0FBQyxZQUFZLENBQUMsT0FBTztBQUN4QixXQUFLLGdCQUFnQjtBQUNyQixXQUFLLHVCQUF1QixNQUFNO0FBQUEsSUFDbkMsT0FBTztBQUNOLFVBQUksQ0FBQyxLQUFLLGVBQWUsTUFBTSxLQUFLLEdBQUc7QUFDdEMsYUFBSyxnQkFBZ0I7QUFBQSxNQUN0QjtBQUNBLFdBQUssdUJBQXVCLE9BQU8sT0FBTyxRQUFRO0FBQUEsSUFDbkQ7QUFDQSxTQUFLLGFBQWEsS0FBSyxDQUFDLENBQUM7QUFBQSxFQUMxQjtBQUNEO0FBNVNNLHlCQUFOO0FBQUEsRUE2Qkc7QUFBQSxFQUNBO0FBQUEsRUFDQTtBQUFBLEVBQ0E7QUFBQSxFQUNBO0FBQUEsRUFDQTtBQUFBLEVBQ0E7QUFBQSxHQW5DRztBQThTTixJQUFNLGdDQUFOLE1BQWdHO0FBQUEsRUFJL0YsWUFDa0IsZ0JBQ2hCO0FBQ0QsVUFBTSxNQUFNLGVBQWUsdUJBQXVCLElBQUk7QUFDdEQsU0FBSyxVQUFVLE1BQU0sSUFBSSxRQUFRO0FBQUEsRUFDbEM7QUFBQSxFQUVBLFFBQVEsV0FBa0Q7QUFDekQsVUFBTSxPQUFPLFVBQVUsV0FBVztBQUNsQyxXQUFPLGFBQWEsSUFBSSxLQUFLLGFBQWEsSUFBSTtBQUFBLEVBQy9DO0FBQUEsRUFFQSxNQUFNLGNBQWMsTUFBbUIsUUFBdUIsUUFBOEU7QUFDM0ksVUFBTSxVQUFVLEtBQUssV0FBVztBQUNoQyxRQUFJO0FBQ0osUUFBSSxhQUFhLE9BQU8sR0FBRztBQUMxQixlQUFTO0FBQUEsSUFDVixXQUFXLGFBQWEsT0FBTyxHQUFHO0FBQ2pDLGVBQVMsUUFBUSxrQkFBa0I7QUFBQSxJQUNwQztBQUNBLFFBQUksQ0FBQyxRQUFRO0FBQ1osYUFBTztBQUFBLElBQ1I7QUFDQSxVQUFNLG1CQUFtQixJQUFJLFFBQVE7QUFDckMsVUFBTSxTQUFTLE9BQU8sb0JBQW9CLGNBQVksU0FBUyxJQUFJLHFCQUFxQixFQUFFLGVBQWUsd0JBQXdCLFFBQVEsUUFBUSxnQkFBZ0IsQ0FBQztBQUNsSyxVQUFNLGlCQUFpQixLQUFLO0FBQzVCLFdBQU87QUFBQSxFQUNSO0FBQ0Q7QUFoQ00sZ0NBQU47QUFBQSxFQUtHO0FBQUEsR0FMRztBQWtDTixTQUFTLEdBQW9DLG9CQUFvQixTQUFTLEVBQUUsOEJBQThCLCtCQUErQixlQUFlLFVBQVU7IiwKICAibmFtZXMiOiBbInRpbWVvdXQiXQp9Cg==
