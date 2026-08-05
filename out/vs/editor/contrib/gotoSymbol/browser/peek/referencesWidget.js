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
import * as dom from "../../../../../base/browser/dom.js";
import { Orientation } from "../../../../../base/browser/ui/sash/sash.js";
import { Sizing, SplitView } from "../../../../../base/browser/ui/splitview/splitview.js";
import { Color } from "../../../../../base/common/color.js";
import { Emitter, Event } from "../../../../../base/common/event.js";
import { KeyCode } from "../../../../../base/common/keyCodes.js";
import { DisposableStore, dispose } from "../../../../../base/common/lifecycle.js";
import { Schemas } from "../../../../../base/common/network.js";
import { basenameOrAuthority, dirname } from "../../../../../base/common/resources.js";
import "./referencesWidget.css";
import { EmbeddedCodeEditorWidget } from "../../../../browser/widget/codeEditor/embeddedCodeEditorWidget.js";
import { Range } from "../../../../common/core/range.js";
import { ScrollType } from "../../../../common/editorCommon.js";
import { TrackedRangeStickiness } from "../../../../common/model.js";
import { ModelDecorationOptions, TextModel } from "../../../../common/model/textModel.js";
import { PLAINTEXT_LANGUAGE_ID } from "../../../../common/languages/modesRegistry.js";
import { ITextModelService } from "../../../../common/services/resolverService.js";
import { AccessibilityProvider, DataSource, Delegate, FileReferencesRenderer, IdentityProvider, OneReferenceRenderer, StringRepresentationProvider } from "./referencesTree.js";
import * as peekView from "../../../peekView/browser/peekView.js";
import * as nls from "../../../../../nls.js";
import { IInstantiationService } from "../../../../../platform/instantiation/common/instantiation.js";
import { IKeybindingService } from "../../../../../platform/keybinding/common/keybinding.js";
import { ILabelService } from "../../../../../platform/label/common/label.js";
import { WorkbenchAsyncDataTree } from "../../../../../platform/list/browser/listService.js";
import { IThemeService } from "../../../../../platform/theme/common/themeService.js";
import { FileReferences, OneReference } from "../referencesModel.js";
import { DataTransfers } from "../../../../../base/browser/dnd.js";
import { withSelection } from "../../../../../platform/opener/common/opener.js";
const _DecorationsManager = class _DecorationsManager {
  constructor(_editor, _model) {
    this._editor = _editor;
    this._model = _model;
    this._decorations = /* @__PURE__ */ new Map();
    this._decorationIgnoreSet = /* @__PURE__ */ new Set();
    this._callOnDispose = new DisposableStore();
    this._callOnModelChange = new DisposableStore();
    this._callOnDispose.add(this._editor.onDidChangeModel(() => this._onModelChanged()));
    this._onModelChanged();
  }
  dispose() {
    this._callOnModelChange.dispose();
    this._callOnDispose.dispose();
    this.removeDecorations();
  }
  _onModelChanged() {
    this._callOnModelChange.clear();
    const model = this._editor.getModel();
    if (!model) {
      return;
    }
    for (const ref of this._model.references) {
      if (ref.uri.toString() === model.uri.toString()) {
        this._addDecorations(ref.parent);
        return;
      }
    }
  }
  _addDecorations(reference) {
    if (!this._editor.hasModel()) {
      return;
    }
    this._callOnModelChange.add(this._editor.getModel().onDidChangeDecorations(() => this._onDecorationChanged()));
    const newDecorations = [];
    const newDecorationsActualIndex = [];
    for (let i = 0, len = reference.children.length; i < len; i++) {
      const oneReference = reference.children[i];
      if (this._decorationIgnoreSet.has(oneReference.id)) {
        continue;
      }
      if (oneReference.uri.toString() !== this._editor.getModel().uri.toString()) {
        continue;
      }
      newDecorations.push({
        range: oneReference.range,
        options: _DecorationsManager.DecorationOptions
      });
      newDecorationsActualIndex.push(i);
    }
    this._editor.changeDecorations((changeAccessor) => {
      const decorations = changeAccessor.deltaDecorations([], newDecorations);
      for (let i = 0; i < decorations.length; i++) {
        this._decorations.set(decorations[i], reference.children[newDecorationsActualIndex[i]]);
      }
    });
  }
  _onDecorationChanged() {
    const toRemove = [];
    const model = this._editor.getModel();
    if (!model) {
      return;
    }
    for (const [decorationId, reference] of this._decorations) {
      const newRange = model.getDecorationRange(decorationId);
      if (!newRange) {
        continue;
      }
      let ignore = false;
      if (Range.equalsRange(newRange, reference.range)) {
        continue;
      }
      if (Range.spansMultipleLines(newRange)) {
        ignore = true;
      } else {
        const lineLength = reference.range.endColumn - reference.range.startColumn;
        const newLineLength = newRange.endColumn - newRange.startColumn;
        if (lineLength !== newLineLength) {
          ignore = true;
        }
      }
      if (ignore) {
        this._decorationIgnoreSet.add(reference.id);
        toRemove.push(decorationId);
      } else {
        reference.range = newRange;
      }
    }
    for (let i = 0, len = toRemove.length; i < len; i++) {
      this._decorations.delete(toRemove[i]);
    }
    this._editor.removeDecorations(toRemove);
  }
  removeDecorations() {
    this._editor.removeDecorations([...this._decorations.keys()]);
    this._decorations.clear();
  }
};
_DecorationsManager.DecorationOptions = ModelDecorationOptions.register({
  description: "reference-decoration",
  stickiness: TrackedRangeStickiness.NeverGrowsWhenTypingAtEdges,
  className: "reference-decoration"
});
let DecorationsManager = _DecorationsManager;
class LayoutData {
  constructor() {
    this.ratio = 0.7;
    this.heightInLines = 18;
  }
  static fromJSON(raw) {
    let ratio;
    let heightInLines;
    try {
      const data = JSON.parse(raw);
      ratio = data.ratio;
      heightInLines = data.heightInLines;
    } catch {
    }
    return {
      ratio: ratio || 0.7,
      heightInLines: heightInLines || 18
    };
  }
}
class ReferencesTree extends WorkbenchAsyncDataTree {
}
let ReferencesDragAndDrop = class {
  constructor(labelService) {
    this.labelService = labelService;
    this.disposables = new DisposableStore();
  }
  getDragURI(element) {
    if (element instanceof FileReferences) {
      return element.uri.toString();
    } else if (element instanceof OneReference) {
      return withSelection(element.uri, element.range).toString();
    }
    return null;
  }
  getDragLabel(elements) {
    if (elements.length === 0) {
      return void 0;
    }
    const labels = elements.map((e) => this.labelService.getUriBasenameLabel(e.uri));
    return labels.join(", ");
  }
  onDragStart(data, originalEvent) {
    if (!originalEvent.dataTransfer) {
      return;
    }
    const elements = data.elements;
    const resources = elements.map((e) => this.getDragURI(e)).filter(Boolean);
    if (resources.length) {
      originalEvent.dataTransfer.setData(DataTransfers.RESOURCES, JSON.stringify(resources));
      originalEvent.dataTransfer.setData(DataTransfers.TEXT, resources.join("\n"));
    }
  }
  onDragOver() {
    return false;
  }
  drop() {
  }
  dispose() {
    this.disposables.dispose();
  }
};
ReferencesDragAndDrop = __decorateClass([
  __decorateParam(0, ILabelService)
], ReferencesDragAndDrop);
let ReferenceWidget = class extends peekView.PeekViewWidget {
  // whether or not a dispose is already in progress
  constructor(editor, _defaultTreeKeyboardSupport, layoutData, themeService, _textModelResolverService, _instantiationService, _peekViewService, _uriLabel, _keybindingService) {
    super(editor, { showFrame: false, showArrow: true, isResizeable: true, isAccessible: true, supportOnTitleClick: true }, _instantiationService);
    this._defaultTreeKeyboardSupport = _defaultTreeKeyboardSupport;
    this.layoutData = layoutData;
    this._textModelResolverService = _textModelResolverService;
    this._instantiationService = _instantiationService;
    this._peekViewService = _peekViewService;
    this._uriLabel = _uriLabel;
    this._keybindingService = _keybindingService;
    this._disposeOnNewModel = new DisposableStore();
    this._callOnDispose = new DisposableStore();
    this._onDidSelectReference = new Emitter();
    this.onDidSelectReference = this._onDidSelectReference.event;
    this._dim = new dom.Dimension(0, 0);
    this._isClosing = false;
    this._applyTheme(themeService.getColorTheme());
    this._callOnDispose.add(themeService.onDidColorThemeChange(this._applyTheme.bind(this)));
    this._peekViewService.addExclusiveWidget(editor, this);
    this.create();
  }
  get isClosing() {
    return this._isClosing;
  }
  dispose() {
    this._isClosing = true;
    this.setModel(void 0);
    this._callOnDispose.dispose();
    this._disposeOnNewModel.dispose();
    dispose(this._preview);
    dispose(this._previewNotAvailableMessage);
    dispose(this._tree);
    dispose(this._previewModelReference);
    this._splitView.dispose();
    super.dispose();
  }
  _applyTheme(theme) {
    const borderColor = theme.getColor(peekView.peekViewBorder) || Color.transparent;
    this.style({
      arrowColor: borderColor,
      frameColor: borderColor,
      headerBackgroundColor: theme.getColor(peekView.peekViewTitleBackground) || Color.transparent,
      primaryHeadingColor: theme.getColor(peekView.peekViewTitleForeground),
      secondaryHeadingColor: theme.getColor(peekView.peekViewTitleInfoForeground)
    });
  }
  show(where) {
    super.show(where, this.layoutData.heightInLines || 18);
  }
  focusOnReferenceTree() {
    this._tree.domFocus();
  }
  focusOnPreviewEditor() {
    this._preview.focus();
  }
  isPreviewEditorFocused() {
    return this._preview.hasTextFocus();
  }
  _onTitleClick(e) {
    if (this._preview && this._preview.getModel()) {
      this._onDidSelectReference.fire({
        element: this._getFocusedReference(),
        kind: e.ctrlKey || e.metaKey || e.altKey ? "side" : "open",
        source: "title"
      });
    }
  }
  _fillBody(containerElement) {
    this.setCssClass("reference-zone-widget");
    this._messageContainer = dom.append(containerElement, dom.$("div.messages"));
    dom.hide(this._messageContainer);
    this._splitView = new SplitView(containerElement, { orientation: Orientation.HORIZONTAL });
    this._previewContainer = dom.append(containerElement, dom.$("div.preview.inline"));
    const options = {
      scrollBeyondLastLine: false,
      scrollbar: {
        verticalScrollbarSize: 14,
        horizontal: "auto",
        useShadows: true,
        verticalHasArrows: false,
        horizontalHasArrows: false,
        alwaysConsumeMouseWheel: true
      },
      overviewRulerLanes: 2,
      fixedOverflowWidgets: true,
      minimap: {
        enabled: false
      }
    };
    this._preview = this._instantiationService.createInstance(EmbeddedCodeEditorWidget, this._previewContainer, options, {}, this.editor);
    dom.hide(this._previewContainer);
    this._previewNotAvailableMessage = this._instantiationService.createInstance(TextModel, nls.localize("missingPreviewMessage", "no preview available"), PLAINTEXT_LANGUAGE_ID, TextModel.DEFAULT_CREATION_OPTIONS, null);
    this._treeContainer = dom.append(containerElement, dom.$("div.ref-tree.inline"));
    const treeOptions = {
      keyboardSupport: this._defaultTreeKeyboardSupport,
      accessibilityProvider: new AccessibilityProvider(),
      keyboardNavigationLabelProvider: this._instantiationService.createInstance(StringRepresentationProvider),
      identityProvider: new IdentityProvider(),
      openOnSingleClick: true,
      selectionNavigation: true,
      overrideStyles: {
        listBackground: peekView.peekViewResultsBackground
      },
      dnd: this._instantiationService.createInstance(ReferencesDragAndDrop)
    };
    if (this._defaultTreeKeyboardSupport) {
      this._callOnDispose.add(dom.addStandardDisposableListener(this._treeContainer, "keydown", (e) => {
        if (e.equals(KeyCode.Escape)) {
          this._keybindingService.dispatchEvent(e, e.target);
          e.stopPropagation();
        }
      }, true));
    }
    this._tree = this._instantiationService.createInstance(
      ReferencesTree,
      "ReferencesWidget",
      this._treeContainer,
      new Delegate(),
      [
        this._instantiationService.createInstance(FileReferencesRenderer),
        this._instantiationService.createInstance(OneReferenceRenderer)
      ],
      this._instantiationService.createInstance(DataSource),
      treeOptions
    );
    this._splitView.addView({
      onDidChange: Event.None,
      element: this._previewContainer,
      minimumSize: 200,
      maximumSize: Number.MAX_VALUE,
      layout: (width) => {
        this._preview.layout({ height: this._dim.height, width });
      }
    }, Sizing.Distribute);
    this._splitView.addView({
      onDidChange: Event.None,
      element: this._treeContainer,
      minimumSize: 100,
      maximumSize: Number.MAX_VALUE,
      layout: (width) => {
        this._treeContainer.style.height = `${this._dim.height}px`;
        this._treeContainer.style.width = `${width}px`;
        this._tree.layout(this._dim.height, width);
      }
    }, Sizing.Distribute);
    this._disposables.add(this._splitView.onDidSashChange(() => {
      if (this._dim.width) {
        this.layoutData.ratio = this._splitView.getViewSize(0) / this._dim.width;
      }
    }, void 0));
    const onEvent = (element, kind) => {
      if (element instanceof OneReference) {
        if (kind === "show") {
          this._revealReference(element, false);
        }
        this._onDidSelectReference.fire({ element, kind, source: "tree" });
      }
    };
    this._disposables.add(this._tree.onDidOpen((e) => {
      if (e.sideBySide) {
        onEvent(e.element, "side");
      } else if (e.editorOptions.pinned) {
        onEvent(e.element, "goto");
      } else {
        onEvent(e.element, "show");
      }
    }));
    dom.hide(this._treeContainer);
  }
  _onWidth(width) {
    if (this._dim) {
      this._doLayoutBody(this._dim.height, width);
    }
  }
  _doLayoutBody(heightInPixel, widthInPixel) {
    super._doLayoutBody(heightInPixel, widthInPixel);
    this._dim = new dom.Dimension(widthInPixel, heightInPixel);
    this.layoutData.heightInLines = this._viewZone ? this._viewZone.heightInLines : this.layoutData.heightInLines;
    this._splitView.layout(widthInPixel);
    this._splitView.resizeView(0, widthInPixel * this.layoutData.ratio);
  }
  setSelection(selection) {
    return this._revealReference(selection, true).then(() => {
      if (!this._model) {
        return;
      }
      this._tree.setSelection([selection]);
      this._tree.setFocus([selection]);
    });
  }
  setModel(newModel) {
    this._disposeOnNewModel.clear();
    this._model = newModel;
    if (this._model) {
      return this._onNewModel();
    }
    return Promise.resolve();
  }
  _onNewModel() {
    if (!this._model) {
      return Promise.resolve(void 0);
    }
    if (this._model.isEmpty) {
      this.setTitle("");
      this._messageContainer.innerText = nls.localize("noResults", "No results");
      dom.show(this._messageContainer);
      return Promise.resolve(void 0);
    }
    dom.hide(this._messageContainer);
    this._decorationsManager = new DecorationsManager(this._preview, this._model);
    this._disposeOnNewModel.add(this._decorationsManager);
    this._disposeOnNewModel.add(this._model.onDidChangeReferenceRange((reference) => this._tree.rerender(reference)));
    this._disposeOnNewModel.add(this._preview.onMouseDown((e) => {
      const { event, target } = e;
      if (event.detail !== 2) {
        return;
      }
      const element = this._getFocusedReference();
      if (!element) {
        return;
      }
      this._onDidSelectReference.fire({
        element: { uri: element.uri, range: target.range },
        kind: event.ctrlKey || event.metaKey || event.altKey ? "side" : "open",
        source: "editor"
      });
    }));
    this.container.classList.add("results-loaded");
    dom.show(this._treeContainer);
    dom.show(this._previewContainer);
    this._splitView.layout(this._dim.width);
    this.focusOnReferenceTree();
    return this._tree.setInput(this._model.groups.length === 1 ? this._model.groups[0] : this._model);
  }
  _getFocusedReference() {
    const [element] = this._tree.getFocus();
    if (element instanceof OneReference) {
      return element;
    } else if (element instanceof FileReferences) {
      if (element.children.length > 0) {
        return element.children[0];
      }
    }
    return void 0;
  }
  async revealReference(reference) {
    await this._revealReference(reference, false);
    this._onDidSelectReference.fire({ element: reference, kind: "goto", source: "tree" });
  }
  async _revealReference(reference, revealParent) {
    if (this._revealedReference === reference) {
      return;
    }
    this._revealedReference = reference;
    if (reference.uri.scheme !== Schemas.inMemory) {
      this.setTitle(basenameOrAuthority(reference.uri), this._uriLabel.getUriLabel(dirname(reference.uri)));
    } else {
      this.setTitle(nls.localize("peekView.alternateTitle", "References"));
    }
    const promise = this._textModelResolverService.createModelReference(reference.uri);
    if (this._tree.getInput() === reference.parent) {
      this._tree.reveal(reference);
    } else {
      if (revealParent) {
        this._tree.reveal(reference.parent);
      }
      await this._tree.expand(reference.parent);
      this._tree.reveal(reference);
    }
    const ref = await promise;
    if (!this._model) {
      ref.dispose();
      return;
    }
    dispose(this._previewModelReference);
    const model = ref.object;
    if (model) {
      const scrollType = this._preview.getModel() === model.textEditorModel ? ScrollType.Smooth : ScrollType.Immediate;
      const sel = Range.lift(reference.range).collapseToStart();
      this._previewModelReference = ref;
      this._preview.setModel(model.textEditorModel);
      this._preview.setSelection(sel);
      this._preview.revealRangeInCenter(sel, scrollType);
    } else {
      this._preview.setModel(this._previewNotAvailableMessage);
      ref.dispose();
    }
  }
};
ReferenceWidget = __decorateClass([
  __decorateParam(3, IThemeService),
  __decorateParam(4, ITextModelService),
  __decorateParam(5, IInstantiationService),
  __decorateParam(6, peekView.IPeekViewService),
  __decorateParam(7, ILabelService),
  __decorateParam(8, IKeybindingService)
], ReferenceWidget);
export {
  LayoutData,
  ReferenceWidget
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy9lZGl0b3IvY29udHJpYi9nb3RvU3ltYm9sL2Jyb3dzZXIvcGVlay9yZWZlcmVuY2VzV2lkZ2V0LnRzIl0sCiAgInNvdXJjZXNDb250ZW50IjogWyIvKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuICogIENvcHlyaWdodCAoYykgTWljcm9zb2Z0IENvcnBvcmF0aW9uLiBBbGwgcmlnaHRzIHJlc2VydmVkLlxuICogIExpY2Vuc2VkIHVuZGVyIHRoZSBNSVQgTGljZW5zZS4gU2VlIExpY2Vuc2UudHh0IGluIHRoZSBwcm9qZWN0IHJvb3QgZm9yIGxpY2Vuc2UgaW5mb3JtYXRpb24uXG4gKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tKi9cblxuaW1wb3J0ICogYXMgZG9tIGZyb20gJy4uLy4uLy4uLy4uLy4uL2Jhc2UvYnJvd3Nlci9kb20uanMnO1xuaW1wb3J0IHsgSU1vdXNlRXZlbnQgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9iYXNlL2Jyb3dzZXIvbW91c2VFdmVudC5qcyc7XG5pbXBvcnQgeyBPcmllbnRhdGlvbiB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL2Jhc2UvYnJvd3Nlci91aS9zYXNoL3Nhc2guanMnO1xuaW1wb3J0IHsgU2l6aW5nLCBTcGxpdFZpZXcgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9iYXNlL2Jyb3dzZXIvdWkvc3BsaXR2aWV3L3NwbGl0dmlldy5qcyc7XG5pbXBvcnQgeyBDb2xvciB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2NvbG9yLmpzJztcbmltcG9ydCB7IEVtaXR0ZXIsIEV2ZW50IH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vZXZlbnQuanMnO1xuaW1wb3J0IHsgRnV6enlTY29yZSB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2ZpbHRlcnMuanMnO1xuaW1wb3J0IHsgS2V5Q29kZSB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2tleUNvZGVzLmpzJztcbmltcG9ydCB7IERpc3Bvc2FibGVTdG9yZSwgZGlzcG9zZSwgSURpc3Bvc2FibGUsIElSZWZlcmVuY2UgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9saWZlY3ljbGUuanMnO1xuaW1wb3J0IHsgU2NoZW1hcyB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL25ldHdvcmsuanMnO1xuaW1wb3J0IHsgYmFzZW5hbWVPckF1dGhvcml0eSwgZGlybmFtZSB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL3Jlc291cmNlcy5qcyc7XG5pbXBvcnQgJy4vcmVmZXJlbmNlc1dpZGdldC5jc3MnO1xuaW1wb3J0IHsgSUNvZGVFZGl0b3IgfSBmcm9tICcuLi8uLi8uLi8uLi9icm93c2VyL2VkaXRvckJyb3dzZXIuanMnO1xuaW1wb3J0IHsgRW1iZWRkZWRDb2RlRWRpdG9yV2lkZ2V0IH0gZnJvbSAnLi4vLi4vLi4vLi4vYnJvd3Nlci93aWRnZXQvY29kZUVkaXRvci9lbWJlZGRlZENvZGVFZGl0b3JXaWRnZXQuanMnO1xuaW1wb3J0IHsgSUVkaXRvck9wdGlvbnMgfSBmcm9tICcuLi8uLi8uLi8uLi9jb21tb24vY29uZmlnL2VkaXRvck9wdGlvbnMuanMnO1xuaW1wb3J0IHsgSVJhbmdlLCBSYW5nZSB9IGZyb20gJy4uLy4uLy4uLy4uL2NvbW1vbi9jb3JlL3JhbmdlLmpzJztcbmltcG9ydCB7IFNjcm9sbFR5cGUgfSBmcm9tICcuLi8uLi8uLi8uLi9jb21tb24vZWRpdG9yQ29tbW9uLmpzJztcbmltcG9ydCB7IElNb2RlbERlbHRhRGVjb3JhdGlvbiwgVHJhY2tlZFJhbmdlU3RpY2tpbmVzcyB9IGZyb20gJy4uLy4uLy4uLy4uL2NvbW1vbi9tb2RlbC5qcyc7XG5pbXBvcnQgeyBNb2RlbERlY29yYXRpb25PcHRpb25zLCBUZXh0TW9kZWwgfSBmcm9tICcuLi8uLi8uLi8uLi9jb21tb24vbW9kZWwvdGV4dE1vZGVsLmpzJztcbmltcG9ydCB7IExvY2F0aW9uIH0gZnJvbSAnLi4vLi4vLi4vLi4vY29tbW9uL2xhbmd1YWdlcy5qcyc7XG5pbXBvcnQgeyBQTEFJTlRFWFRfTEFOR1VBR0VfSUQgfSBmcm9tICcuLi8uLi8uLi8uLi9jb21tb24vbGFuZ3VhZ2VzL21vZGVzUmVnaXN0cnkuanMnO1xuaW1wb3J0IHsgSVRleHRFZGl0b3JNb2RlbCwgSVRleHRNb2RlbFNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi9jb21tb24vc2VydmljZXMvcmVzb2x2ZXJTZXJ2aWNlLmpzJztcbmltcG9ydCB7IEFjY2Vzc2liaWxpdHlQcm92aWRlciwgRGF0YVNvdXJjZSwgRGVsZWdhdGUsIEZpbGVSZWZlcmVuY2VzUmVuZGVyZXIsIElkZW50aXR5UHJvdmlkZXIsIE9uZVJlZmVyZW5jZVJlbmRlcmVyLCBTdHJpbmdSZXByZXNlbnRhdGlvblByb3ZpZGVyLCBUcmVlRWxlbWVudCB9IGZyb20gJy4vcmVmZXJlbmNlc1RyZWUuanMnO1xuaW1wb3J0ICogYXMgcGVla1ZpZXcgZnJvbSAnLi4vLi4vLi4vcGVla1ZpZXcvYnJvd3Nlci9wZWVrVmlldy5qcyc7XG5pbXBvcnQgKiBhcyBubHMgZnJvbSAnLi4vLi4vLi4vLi4vLi4vbmxzLmpzJztcbmltcG9ydCB7IElJbnN0YW50aWF0aW9uU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL3BsYXRmb3JtL2luc3RhbnRpYXRpb24vY29tbW9uL2luc3RhbnRpYXRpb24uanMnO1xuaW1wb3J0IHsgSUtleWJpbmRpbmdTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vcGxhdGZvcm0va2V5YmluZGluZy9jb21tb24va2V5YmluZGluZy5qcyc7XG5pbXBvcnQgeyBJTGFiZWxTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vcGxhdGZvcm0vbGFiZWwvY29tbW9uL2xhYmVsLmpzJztcbmltcG9ydCB7IElXb3JrYmVuY2hBc3luY0RhdGFUcmVlT3B0aW9ucywgV29ya2JlbmNoQXN5bmNEYXRhVHJlZSB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL3BsYXRmb3JtL2xpc3QvYnJvd3Nlci9saXN0U2VydmljZS5qcyc7XG5pbXBvcnQgeyBJQ29sb3JUaGVtZSwgSVRoZW1lU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL3BsYXRmb3JtL3RoZW1lL2NvbW1vbi90aGVtZVNlcnZpY2UuanMnO1xuaW1wb3J0IHsgRmlsZVJlZmVyZW5jZXMsIE9uZVJlZmVyZW5jZSwgUmVmZXJlbmNlc01vZGVsIH0gZnJvbSAnLi4vcmVmZXJlbmNlc01vZGVsLmpzJztcbmltcG9ydCB7IElUcmVlRHJhZ0FuZERyb3AsIElUcmVlRHJhZ092ZXJSZWFjdGlvbiB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL2Jhc2UvYnJvd3Nlci91aS90cmVlL3RyZWUuanMnO1xuaW1wb3J0IHsgRGF0YVRyYW5zZmVycywgSURyYWdBbmREcm9wRGF0YSB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL2Jhc2UvYnJvd3Nlci9kbmQuanMnO1xuaW1wb3J0IHsgRWxlbWVudHNEcmFnQW5kRHJvcERhdGEgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9iYXNlL2Jyb3dzZXIvdWkvbGlzdC9saXN0Vmlldy5qcyc7XG5pbXBvcnQgeyB3aXRoU2VsZWN0aW9uIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vcGxhdGZvcm0vb3BlbmVyL2NvbW1vbi9vcGVuZXIuanMnO1xuXG5jbGFzcyBEZWNvcmF0aW9uc01hbmFnZXIgaW1wbGVtZW50cyBJRGlzcG9zYWJsZSB7XG5cblx0cHJpdmF0ZSBzdGF0aWMgcmVhZG9ubHkgRGVjb3JhdGlvbk9wdGlvbnMgPSBNb2RlbERlY29yYXRpb25PcHRpb25zLnJlZ2lzdGVyKHtcblx0XHRkZXNjcmlwdGlvbjogJ3JlZmVyZW5jZS1kZWNvcmF0aW9uJyxcblx0XHRzdGlja2luZXNzOiBUcmFja2VkUmFuZ2VTdGlja2luZXNzLk5ldmVyR3Jvd3NXaGVuVHlwaW5nQXRFZGdlcyxcblx0XHRjbGFzc05hbWU6ICdyZWZlcmVuY2UtZGVjb3JhdGlvbidcblx0fSk7XG5cblx0cHJpdmF0ZSBfZGVjb3JhdGlvbnMgPSBuZXcgTWFwPHN0cmluZywgT25lUmVmZXJlbmNlPigpO1xuXHRwcml2YXRlIF9kZWNvcmF0aW9uSWdub3JlU2V0ID0gbmV3IFNldDxzdHJpbmc+KCk7XG5cdHByaXZhdGUgcmVhZG9ubHkgX2NhbGxPbkRpc3Bvc2UgPSBuZXcgRGlzcG9zYWJsZVN0b3JlKCk7XG5cdHByaXZhdGUgcmVhZG9ubHkgX2NhbGxPbk1vZGVsQ2hhbmdlID0gbmV3IERpc3Bvc2FibGVTdG9yZSgpO1xuXG5cdGNvbnN0cnVjdG9yKHByaXZhdGUgX2VkaXRvcjogSUNvZGVFZGl0b3IsIHByaXZhdGUgX21vZGVsOiBSZWZlcmVuY2VzTW9kZWwpIHtcblx0XHR0aGlzLl9jYWxsT25EaXNwb3NlLmFkZCh0aGlzLl9lZGl0b3Iub25EaWRDaGFuZ2VNb2RlbCgoKSA9PiB0aGlzLl9vbk1vZGVsQ2hhbmdlZCgpKSk7XG5cdFx0dGhpcy5fb25Nb2RlbENoYW5nZWQoKTtcblx0fVxuXG5cdGRpc3Bvc2UoKTogdm9pZCB7XG5cdFx0dGhpcy5fY2FsbE9uTW9kZWxDaGFuZ2UuZGlzcG9zZSgpO1xuXHRcdHRoaXMuX2NhbGxPbkRpc3Bvc2UuZGlzcG9zZSgpO1xuXHRcdHRoaXMucmVtb3ZlRGVjb3JhdGlvbnMoKTtcblx0fVxuXG5cdHByaXZhdGUgX29uTW9kZWxDaGFuZ2VkKCk6IHZvaWQge1xuXHRcdHRoaXMuX2NhbGxPbk1vZGVsQ2hhbmdlLmNsZWFyKCk7XG5cdFx0Y29uc3QgbW9kZWwgPSB0aGlzLl9lZGl0b3IuZ2V0TW9kZWwoKTtcblx0XHRpZiAoIW1vZGVsKSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXHRcdGZvciAoY29uc3QgcmVmIG9mIHRoaXMuX21vZGVsLnJlZmVyZW5jZXMpIHtcblx0XHRcdGlmIChyZWYudXJpLnRvU3RyaW5nKCkgPT09IG1vZGVsLnVyaS50b1N0cmluZygpKSB7XG5cdFx0XHRcdHRoaXMuX2FkZERlY29yYXRpb25zKHJlZi5wYXJlbnQpO1xuXHRcdFx0XHRyZXR1cm47XG5cdFx0XHR9XG5cdFx0fVxuXHR9XG5cblx0cHJpdmF0ZSBfYWRkRGVjb3JhdGlvbnMocmVmZXJlbmNlOiBGaWxlUmVmZXJlbmNlcyk6IHZvaWQge1xuXHRcdGlmICghdGhpcy5fZWRpdG9yLmhhc01vZGVsKCkpIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cdFx0dGhpcy5fY2FsbE9uTW9kZWxDaGFuZ2UuYWRkKHRoaXMuX2VkaXRvci5nZXRNb2RlbCgpLm9uRGlkQ2hhbmdlRGVjb3JhdGlvbnMoKCkgPT4gdGhpcy5fb25EZWNvcmF0aW9uQ2hhbmdlZCgpKSk7XG5cblx0XHRjb25zdCBuZXdEZWNvcmF0aW9uczogSU1vZGVsRGVsdGFEZWNvcmF0aW9uW10gPSBbXTtcblx0XHRjb25zdCBuZXdEZWNvcmF0aW9uc0FjdHVhbEluZGV4OiBudW1iZXJbXSA9IFtdO1xuXG5cdFx0Zm9yIChsZXQgaSA9IDAsIGxlbiA9IHJlZmVyZW5jZS5jaGlsZHJlbi5sZW5ndGg7IGkgPCBsZW47IGkrKykge1xuXHRcdFx0Y29uc3Qgb25lUmVmZXJlbmNlID0gcmVmZXJlbmNlLmNoaWxkcmVuW2ldO1xuXHRcdFx0aWYgKHRoaXMuX2RlY29yYXRpb25JZ25vcmVTZXQuaGFzKG9uZVJlZmVyZW5jZS5pZCkpIHtcblx0XHRcdFx0Y29udGludWU7XG5cdFx0XHR9XG5cdFx0XHRpZiAob25lUmVmZXJlbmNlLnVyaS50b1N0cmluZygpICE9PSB0aGlzLl9lZGl0b3IuZ2V0TW9kZWwoKS51cmkudG9TdHJpbmcoKSkge1xuXHRcdFx0XHRjb250aW51ZTtcblx0XHRcdH1cblx0XHRcdG5ld0RlY29yYXRpb25zLnB1c2goe1xuXHRcdFx0XHRyYW5nZTogb25lUmVmZXJlbmNlLnJhbmdlLFxuXHRcdFx0XHRvcHRpb25zOiBEZWNvcmF0aW9uc01hbmFnZXIuRGVjb3JhdGlvbk9wdGlvbnNcblx0XHRcdH0pO1xuXHRcdFx0bmV3RGVjb3JhdGlvbnNBY3R1YWxJbmRleC5wdXNoKGkpO1xuXHRcdH1cblxuXHRcdHRoaXMuX2VkaXRvci5jaGFuZ2VEZWNvcmF0aW9ucygoY2hhbmdlQWNjZXNzb3IpID0+IHtcblx0XHRcdGNvbnN0IGRlY29yYXRpb25zID0gY2hhbmdlQWNjZXNzb3IuZGVsdGFEZWNvcmF0aW9ucyhbXSwgbmV3RGVjb3JhdGlvbnMpO1xuXHRcdFx0Zm9yIChsZXQgaSA9IDA7IGkgPCBkZWNvcmF0aW9ucy5sZW5ndGg7IGkrKykge1xuXHRcdFx0XHR0aGlzLl9kZWNvcmF0aW9ucy5zZXQoZGVjb3JhdGlvbnNbaV0sIHJlZmVyZW5jZS5jaGlsZHJlbltuZXdEZWNvcmF0aW9uc0FjdHVhbEluZGV4W2ldXSk7XG5cdFx0XHR9XG5cdFx0fSk7XG5cdH1cblxuXHRwcml2YXRlIF9vbkRlY29yYXRpb25DaGFuZ2VkKCk6IHZvaWQge1xuXHRcdGNvbnN0IHRvUmVtb3ZlOiBzdHJpbmdbXSA9IFtdO1xuXG5cdFx0Y29uc3QgbW9kZWwgPSB0aGlzLl9lZGl0b3IuZ2V0TW9kZWwoKTtcblx0XHRpZiAoIW1vZGVsKSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXG5cdFx0Zm9yIChjb25zdCBbZGVjb3JhdGlvbklkLCByZWZlcmVuY2VdIG9mIHRoaXMuX2RlY29yYXRpb25zKSB7XG5cblx0XHRcdGNvbnN0IG5ld1JhbmdlID0gbW9kZWwuZ2V0RGVjb3JhdGlvblJhbmdlKGRlY29yYXRpb25JZCk7XG5cblx0XHRcdGlmICghbmV3UmFuZ2UpIHtcblx0XHRcdFx0Y29udGludWU7XG5cdFx0XHR9XG5cblx0XHRcdGxldCBpZ25vcmUgPSBmYWxzZTtcblx0XHRcdGlmIChSYW5nZS5lcXVhbHNSYW5nZShuZXdSYW5nZSwgcmVmZXJlbmNlLnJhbmdlKSkge1xuXHRcdFx0XHRjb250aW51ZTtcblxuXHRcdFx0fVxuXG5cdFx0XHRpZiAoUmFuZ2Uuc3BhbnNNdWx0aXBsZUxpbmVzKG5ld1JhbmdlKSkge1xuXHRcdFx0XHRpZ25vcmUgPSB0cnVlO1xuXG5cdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRjb25zdCBsaW5lTGVuZ3RoID0gcmVmZXJlbmNlLnJhbmdlLmVuZENvbHVtbiAtIHJlZmVyZW5jZS5yYW5nZS5zdGFydENvbHVtbjtcblx0XHRcdFx0Y29uc3QgbmV3TGluZUxlbmd0aCA9IG5ld1JhbmdlLmVuZENvbHVtbiAtIG5ld1JhbmdlLnN0YXJ0Q29sdW1uO1xuXG5cdFx0XHRcdGlmIChsaW5lTGVuZ3RoICE9PSBuZXdMaW5lTGVuZ3RoKSB7XG5cdFx0XHRcdFx0aWdub3JlID0gdHJ1ZTtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXG5cdFx0XHRpZiAoaWdub3JlKSB7XG5cdFx0XHRcdHRoaXMuX2RlY29yYXRpb25JZ25vcmVTZXQuYWRkKHJlZmVyZW5jZS5pZCk7XG5cdFx0XHRcdHRvUmVtb3ZlLnB1c2goZGVjb3JhdGlvbklkKTtcblx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdHJlZmVyZW5jZS5yYW5nZSA9IG5ld1JhbmdlO1xuXHRcdFx0fVxuXHRcdH1cblxuXHRcdGZvciAobGV0IGkgPSAwLCBsZW4gPSB0b1JlbW92ZS5sZW5ndGg7IGkgPCBsZW47IGkrKykge1xuXHRcdFx0dGhpcy5fZGVjb3JhdGlvbnMuZGVsZXRlKHRvUmVtb3ZlW2ldKTtcblx0XHR9XG5cdFx0dGhpcy5fZWRpdG9yLnJlbW92ZURlY29yYXRpb25zKHRvUmVtb3ZlKTtcblx0fVxuXG5cdHJlbW92ZURlY29yYXRpb25zKCk6IHZvaWQge1xuXHRcdHRoaXMuX2VkaXRvci5yZW1vdmVEZWNvcmF0aW9ucyhbLi4udGhpcy5fZGVjb3JhdGlvbnMua2V5cygpXSk7XG5cdFx0dGhpcy5fZGVjb3JhdGlvbnMuY2xlYXIoKTtcblx0fVxufVxuXG5leHBvcnQgY2xhc3MgTGF5b3V0RGF0YSB7XG5cdHJhdGlvOiBudW1iZXIgPSAwLjc7XG5cdGhlaWdodEluTGluZXM6IG51bWJlciA9IDE4O1xuXG5cdHN0YXRpYyBmcm9tSlNPTihyYXc6IHN0cmluZyk6IExheW91dERhdGEge1xuXHRcdGxldCByYXRpbzogbnVtYmVyIHwgdW5kZWZpbmVkO1xuXHRcdGxldCBoZWlnaHRJbkxpbmVzOiBudW1iZXIgfCB1bmRlZmluZWQ7XG5cdFx0dHJ5IHtcblx0XHRcdGNvbnN0IGRhdGEgPSA8TGF5b3V0RGF0YT5KU09OLnBhcnNlKHJhdyk7XG5cdFx0XHRyYXRpbyA9IGRhdGEucmF0aW87XG5cdFx0XHRoZWlnaHRJbkxpbmVzID0gZGF0YS5oZWlnaHRJbkxpbmVzO1xuXHRcdH0gY2F0Y2gge1xuXHRcdFx0Ly9cblx0XHR9XG5cdFx0cmV0dXJuIHtcblx0XHRcdHJhdGlvOiByYXRpbyB8fCAwLjcsXG5cdFx0XHRoZWlnaHRJbkxpbmVzOiBoZWlnaHRJbkxpbmVzIHx8IDE4XG5cdFx0fTtcblx0fVxufVxuXG5leHBvcnQgaW50ZXJmYWNlIFNlbGVjdGlvbkV2ZW50IHtcblx0cmVhZG9ubHkga2luZDogJ2dvdG8nIHwgJ3Nob3cnIHwgJ3NpZGUnIHwgJ29wZW4nO1xuXHRyZWFkb25seSBzb3VyY2U6ICdlZGl0b3InIHwgJ3RyZWUnIHwgJ3RpdGxlJztcblx0cmVhZG9ubHkgZWxlbWVudD86IExvY2F0aW9uO1xufVxuXG5jbGFzcyBSZWZlcmVuY2VzVHJlZSBleHRlbmRzIFdvcmtiZW5jaEFzeW5jRGF0YVRyZWU8UmVmZXJlbmNlc01vZGVsIHwgRmlsZVJlZmVyZW5jZXMsIFRyZWVFbGVtZW50LCBGdXp6eVNjb3JlPiB7IH1cblxuY2xhc3MgUmVmZXJlbmNlc0RyYWdBbmREcm9wIGltcGxlbWVudHMgSVRyZWVEcmFnQW5kRHJvcDxUcmVlRWxlbWVudD4ge1xuXG5cdHByaXZhdGUgcmVhZG9ubHkgZGlzcG9zYWJsZXMgPSBuZXcgRGlzcG9zYWJsZVN0b3JlKCk7XG5cblx0Y29uc3RydWN0b3IoQElMYWJlbFNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBsYWJlbFNlcnZpY2U6IElMYWJlbFNlcnZpY2UpIHsgfVxuXG5cdGdldERyYWdVUkkoZWxlbWVudDogVHJlZUVsZW1lbnQpOiBzdHJpbmcgfCBudWxsIHtcblx0XHRpZiAoZWxlbWVudCBpbnN0YW5jZW9mIEZpbGVSZWZlcmVuY2VzKSB7XG5cdFx0XHRyZXR1cm4gZWxlbWVudC51cmkudG9TdHJpbmcoKTtcblx0XHR9IGVsc2UgaWYgKGVsZW1lbnQgaW5zdGFuY2VvZiBPbmVSZWZlcmVuY2UpIHtcblx0XHRcdHJldHVybiB3aXRoU2VsZWN0aW9uKGVsZW1lbnQudXJpLCBlbGVtZW50LnJhbmdlKS50b1N0cmluZygpO1xuXHRcdH1cblx0XHRyZXR1cm4gbnVsbDtcblx0fVxuXG5cdGdldERyYWdMYWJlbChlbGVtZW50czogVHJlZUVsZW1lbnRbXSk6IHN0cmluZyB8IHVuZGVmaW5lZCB7XG5cdFx0aWYgKGVsZW1lbnRzLmxlbmd0aCA9PT0gMCkge1xuXHRcdFx0cmV0dXJuIHVuZGVmaW5lZDtcblx0XHR9XG5cdFx0Y29uc3QgbGFiZWxzID0gZWxlbWVudHMubWFwKGUgPT4gdGhpcy5sYWJlbFNlcnZpY2UuZ2V0VXJpQmFzZW5hbWVMYWJlbChlLnVyaSkpO1xuXHRcdHJldHVybiBsYWJlbHMuam9pbignLCAnKTtcblx0fVxuXG5cdG9uRHJhZ1N0YXJ0KGRhdGE6IElEcmFnQW5kRHJvcERhdGEsIG9yaWdpbmFsRXZlbnQ6IERyYWdFdmVudCk6IHZvaWQge1xuXHRcdGlmICghb3JpZ2luYWxFdmVudC5kYXRhVHJhbnNmZXIpIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cblx0XHRjb25zdCBlbGVtZW50cyA9IChkYXRhIGFzIEVsZW1lbnRzRHJhZ0FuZERyb3BEYXRhPFRyZWVFbGVtZW50LCBUcmVlRWxlbWVudFtdPikuZWxlbWVudHM7XG5cdFx0Y29uc3QgcmVzb3VyY2VzID0gZWxlbWVudHMubWFwKGUgPT4gdGhpcy5nZXREcmFnVVJJKGUpKS5maWx0ZXIoQm9vbGVhbik7XG5cblx0XHRpZiAocmVzb3VyY2VzLmxlbmd0aCkge1xuXHRcdFx0Ly8gQXBwbHkgcmVzb3VyY2VzIGFzIHJlc291cmNlLWxpc3Rcblx0XHRcdG9yaWdpbmFsRXZlbnQuZGF0YVRyYW5zZmVyLnNldERhdGEoRGF0YVRyYW5zZmVycy5SRVNPVVJDRVMsIEpTT04uc3RyaW5naWZ5KHJlc291cmNlcykpO1xuXG5cdFx0XHQvLyBBbHNvIGFkZCBhcyBwbGFpbiB0ZXh0IGZvciBvdXRzaWRlIGNvbnN1bWVyc1xuXHRcdFx0b3JpZ2luYWxFdmVudC5kYXRhVHJhbnNmZXIuc2V0RGF0YShEYXRhVHJhbnNmZXJzLlRFWFQsIHJlc291cmNlcy5qb2luKCdcXG4nKSk7XG5cdFx0fVxuXHR9XG5cblx0b25EcmFnT3ZlcigpOiBib29sZWFuIHwgSVRyZWVEcmFnT3ZlclJlYWN0aW9uIHsgcmV0dXJuIGZhbHNlOyB9XG5cdGRyb3AoKTogdm9pZCB7IH1cblx0ZGlzcG9zZSgpOiB2b2lkIHsgdGhpcy5kaXNwb3NhYmxlcy5kaXNwb3NlKCk7IH1cbn1cblxuLyoqXG4gKiBab25lV2lkZ2V0IHRoYXQgaXMgc2hvd24gaW5zaWRlIHRoZSBlZGl0b3JcbiAqL1xuZXhwb3J0IGNsYXNzIFJlZmVyZW5jZVdpZGdldCBleHRlbmRzIHBlZWtWaWV3LlBlZWtWaWV3V2lkZ2V0IHtcblxuXHRwcml2YXRlIF9tb2RlbD86IFJlZmVyZW5jZXNNb2RlbDtcblx0cHJpdmF0ZSBfZGVjb3JhdGlvbnNNYW5hZ2VyPzogRGVjb3JhdGlvbnNNYW5hZ2VyO1xuXG5cdHByaXZhdGUgcmVhZG9ubHkgX2Rpc3Bvc2VPbk5ld01vZGVsID0gbmV3IERpc3Bvc2FibGVTdG9yZSgpO1xuXHRwcml2YXRlIHJlYWRvbmx5IF9jYWxsT25EaXNwb3NlID0gbmV3IERpc3Bvc2FibGVTdG9yZSgpO1xuXG5cdHByaXZhdGUgcmVhZG9ubHkgX29uRGlkU2VsZWN0UmVmZXJlbmNlID0gbmV3IEVtaXR0ZXI8U2VsZWN0aW9uRXZlbnQ+KCk7XG5cdHJlYWRvbmx5IG9uRGlkU2VsZWN0UmVmZXJlbmNlID0gdGhpcy5fb25EaWRTZWxlY3RSZWZlcmVuY2UuZXZlbnQ7XG5cblx0cHJpdmF0ZSBfdHJlZSE6IFJlZmVyZW5jZXNUcmVlO1xuXHRwcml2YXRlIF90cmVlQ29udGFpbmVyITogSFRNTEVsZW1lbnQ7XG5cdHByaXZhdGUgX3NwbGl0VmlldyE6IFNwbGl0Vmlldztcblx0cHJpdmF0ZSBfcHJldmlldyE6IElDb2RlRWRpdG9yO1xuXHRwcml2YXRlIF9wcmV2aWV3TW9kZWxSZWZlcmVuY2UhOiBJUmVmZXJlbmNlPElUZXh0RWRpdG9yTW9kZWw+O1xuXHRwcml2YXRlIF9wcmV2aWV3Tm90QXZhaWxhYmxlTWVzc2FnZSE6IFRleHRNb2RlbDtcblx0cHJpdmF0ZSBfcHJldmlld0NvbnRhaW5lciE6IEhUTUxFbGVtZW50O1xuXHRwcml2YXRlIF9tZXNzYWdlQ29udGFpbmVyITogSFRNTEVsZW1lbnQ7XG5cdHByaXZhdGUgX2RpbSA9IG5ldyBkb20uRGltZW5zaW9uKDAsIDApO1xuXHRwcml2YXRlIF9pc0Nsb3NpbmcgPSBmYWxzZTsgLy8gd2hldGhlciBvciBub3QgYSBkaXNwb3NlIGlzIGFscmVhZHkgaW4gcHJvZ3Jlc3NcblxuXHRjb25zdHJ1Y3Rvcihcblx0XHRlZGl0b3I6IElDb2RlRWRpdG9yLFxuXHRcdHByaXZhdGUgX2RlZmF1bHRUcmVlS2V5Ym9hcmRTdXBwb3J0OiBib29sZWFuLFxuXHRcdHB1YmxpYyBsYXlvdXREYXRhOiBMYXlvdXREYXRhLFxuXHRcdEBJVGhlbWVTZXJ2aWNlIHRoZW1lU2VydmljZTogSVRoZW1lU2VydmljZSxcblx0XHRASVRleHRNb2RlbFNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBfdGV4dE1vZGVsUmVzb2x2ZXJTZXJ2aWNlOiBJVGV4dE1vZGVsU2VydmljZSxcblx0XHRASUluc3RhbnRpYXRpb25TZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgX2luc3RhbnRpYXRpb25TZXJ2aWNlOiBJSW5zdGFudGlhdGlvblNlcnZpY2UsXG5cdFx0QHBlZWtWaWV3LklQZWVrVmlld1NlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBfcGVla1ZpZXdTZXJ2aWNlOiBwZWVrVmlldy5JUGVla1ZpZXdTZXJ2aWNlLFxuXHRcdEBJTGFiZWxTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgX3VyaUxhYmVsOiBJTGFiZWxTZXJ2aWNlLFxuXHRcdEBJS2V5YmluZGluZ1NlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBfa2V5YmluZGluZ1NlcnZpY2U6IElLZXliaW5kaW5nU2VydmljZSxcblx0KSB7XG5cdFx0c3VwZXIoZWRpdG9yLCB7IHNob3dGcmFtZTogZmFsc2UsIHNob3dBcnJvdzogdHJ1ZSwgaXNSZXNpemVhYmxlOiB0cnVlLCBpc0FjY2Vzc2libGU6IHRydWUsIHN1cHBvcnRPblRpdGxlQ2xpY2s6IHRydWUgfSwgX2luc3RhbnRpYXRpb25TZXJ2aWNlKTtcblxuXHRcdHRoaXMuX2FwcGx5VGhlbWUodGhlbWVTZXJ2aWNlLmdldENvbG9yVGhlbWUoKSk7XG5cdFx0dGhpcy5fY2FsbE9uRGlzcG9zZS5hZGQodGhlbWVTZXJ2aWNlLm9uRGlkQ29sb3JUaGVtZUNoYW5nZSh0aGlzLl9hcHBseVRoZW1lLmJpbmQodGhpcykpKTtcblx0XHR0aGlzLl9wZWVrVmlld1NlcnZpY2UuYWRkRXhjbHVzaXZlV2lkZ2V0KGVkaXRvciwgdGhpcyk7XG5cdFx0dGhpcy5jcmVhdGUoKTtcblx0fVxuXG5cdGdldCBpc0Nsb3NpbmcoKSB7XG5cdFx0cmV0dXJuIHRoaXMuX2lzQ2xvc2luZztcblx0fVxuXG5cdG92ZXJyaWRlIGRpc3Bvc2UoKTogdm9pZCB7XG5cdFx0dGhpcy5faXNDbG9zaW5nID0gdHJ1ZTtcblx0XHR0aGlzLnNldE1vZGVsKHVuZGVmaW5lZCk7XG5cdFx0dGhpcy5fY2FsbE9uRGlzcG9zZS5kaXNwb3NlKCk7XG5cdFx0dGhpcy5fZGlzcG9zZU9uTmV3TW9kZWwuZGlzcG9zZSgpO1xuXHRcdGRpc3Bvc2UodGhpcy5fcHJldmlldyk7XG5cdFx0ZGlzcG9zZSh0aGlzLl9wcmV2aWV3Tm90QXZhaWxhYmxlTWVzc2FnZSk7XG5cdFx0ZGlzcG9zZSh0aGlzLl90cmVlKTtcblx0XHRkaXNwb3NlKHRoaXMuX3ByZXZpZXdNb2RlbFJlZmVyZW5jZSk7XG5cdFx0dGhpcy5fc3BsaXRWaWV3LmRpc3Bvc2UoKTtcblx0XHRzdXBlci5kaXNwb3NlKCk7XG5cdH1cblxuXHRwcml2YXRlIF9hcHBseVRoZW1lKHRoZW1lOiBJQ29sb3JUaGVtZSkge1xuXHRcdGNvbnN0IGJvcmRlckNvbG9yID0gdGhlbWUuZ2V0Q29sb3IocGVla1ZpZXcucGVla1ZpZXdCb3JkZXIpIHx8IENvbG9yLnRyYW5zcGFyZW50O1xuXHRcdHRoaXMuc3R5bGUoe1xuXHRcdFx0YXJyb3dDb2xvcjogYm9yZGVyQ29sb3IsXG5cdFx0XHRmcmFtZUNvbG9yOiBib3JkZXJDb2xvcixcblx0XHRcdGhlYWRlckJhY2tncm91bmRDb2xvcjogdGhlbWUuZ2V0Q29sb3IocGVla1ZpZXcucGVla1ZpZXdUaXRsZUJhY2tncm91bmQpIHx8IENvbG9yLnRyYW5zcGFyZW50LFxuXHRcdFx0cHJpbWFyeUhlYWRpbmdDb2xvcjogdGhlbWUuZ2V0Q29sb3IocGVla1ZpZXcucGVla1ZpZXdUaXRsZUZvcmVncm91bmQpLFxuXHRcdFx0c2Vjb25kYXJ5SGVhZGluZ0NvbG9yOiB0aGVtZS5nZXRDb2xvcihwZWVrVmlldy5wZWVrVmlld1RpdGxlSW5mb0ZvcmVncm91bmQpXG5cdFx0fSk7XG5cdH1cblxuXHRvdmVycmlkZSBzaG93KHdoZXJlOiBJUmFuZ2UpIHtcblx0XHRzdXBlci5zaG93KHdoZXJlLCB0aGlzLmxheW91dERhdGEuaGVpZ2h0SW5MaW5lcyB8fCAxOCk7XG5cdH1cblxuXHRmb2N1c09uUmVmZXJlbmNlVHJlZSgpOiB2b2lkIHtcblx0XHR0aGlzLl90cmVlLmRvbUZvY3VzKCk7XG5cdH1cblxuXHRmb2N1c09uUHJldmlld0VkaXRvcigpOiB2b2lkIHtcblx0XHR0aGlzLl9wcmV2aWV3LmZvY3VzKCk7XG5cdH1cblxuXHRpc1ByZXZpZXdFZGl0b3JGb2N1c2VkKCk6IGJvb2xlYW4ge1xuXHRcdHJldHVybiB0aGlzLl9wcmV2aWV3Lmhhc1RleHRGb2N1cygpO1xuXHR9XG5cblx0cHJvdGVjdGVkIG92ZXJyaWRlIF9vblRpdGxlQ2xpY2soZTogSU1vdXNlRXZlbnQpOiB2b2lkIHtcblx0XHRpZiAodGhpcy5fcHJldmlldyAmJiB0aGlzLl9wcmV2aWV3LmdldE1vZGVsKCkpIHtcblx0XHRcdHRoaXMuX29uRGlkU2VsZWN0UmVmZXJlbmNlLmZpcmUoe1xuXHRcdFx0XHRlbGVtZW50OiB0aGlzLl9nZXRGb2N1c2VkUmVmZXJlbmNlKCksXG5cdFx0XHRcdGtpbmQ6IGUuY3RybEtleSB8fCBlLm1ldGFLZXkgfHwgZS5hbHRLZXkgPyAnc2lkZScgOiAnb3BlbicsXG5cdFx0XHRcdHNvdXJjZTogJ3RpdGxlJ1xuXHRcdFx0fSk7XG5cdFx0fVxuXHR9XG5cblx0cHJvdGVjdGVkIF9maWxsQm9keShjb250YWluZXJFbGVtZW50OiBIVE1MRWxlbWVudCk6IHZvaWQge1xuXHRcdHRoaXMuc2V0Q3NzQ2xhc3MoJ3JlZmVyZW5jZS16b25lLXdpZGdldCcpO1xuXG5cdFx0Ly8gbWVzc2FnZSBwYW5lXG5cdFx0dGhpcy5fbWVzc2FnZUNvbnRhaW5lciA9IGRvbS5hcHBlbmQoY29udGFpbmVyRWxlbWVudCwgZG9tLiQoJ2Rpdi5tZXNzYWdlcycpKTtcblx0XHRkb20uaGlkZSh0aGlzLl9tZXNzYWdlQ29udGFpbmVyKTtcblxuXHRcdHRoaXMuX3NwbGl0VmlldyA9IG5ldyBTcGxpdFZpZXcoY29udGFpbmVyRWxlbWVudCwgeyBvcmllbnRhdGlvbjogT3JpZW50YXRpb24uSE9SSVpPTlRBTCB9KTtcblxuXHRcdC8vIGVkaXRvclxuXHRcdHRoaXMuX3ByZXZpZXdDb250YWluZXIgPSBkb20uYXBwZW5kKGNvbnRhaW5lckVsZW1lbnQsIGRvbS4kKCdkaXYucHJldmlldy5pbmxpbmUnKSk7XG5cdFx0Y29uc3Qgb3B0aW9uczogSUVkaXRvck9wdGlvbnMgPSB7XG5cdFx0XHRzY3JvbGxCZXlvbmRMYXN0TGluZTogZmFsc2UsXG5cdFx0XHRzY3JvbGxiYXI6IHtcblx0XHRcdFx0dmVydGljYWxTY3JvbGxiYXJTaXplOiAxNCxcblx0XHRcdFx0aG9yaXpvbnRhbDogJ2F1dG8nLFxuXHRcdFx0XHR1c2VTaGFkb3dzOiB0cnVlLFxuXHRcdFx0XHR2ZXJ0aWNhbEhhc0Fycm93czogZmFsc2UsXG5cdFx0XHRcdGhvcml6b250YWxIYXNBcnJvd3M6IGZhbHNlLFxuXHRcdFx0XHRhbHdheXNDb25zdW1lTW91c2VXaGVlbDogdHJ1ZVxuXHRcdFx0fSxcblx0XHRcdG92ZXJ2aWV3UnVsZXJMYW5lczogMixcblx0XHRcdGZpeGVkT3ZlcmZsb3dXaWRnZXRzOiB0cnVlLFxuXHRcdFx0bWluaW1hcDoge1xuXHRcdFx0XHRlbmFibGVkOiBmYWxzZVxuXHRcdFx0fVxuXHRcdH07XG5cdFx0dGhpcy5fcHJldmlldyA9IHRoaXMuX2luc3RhbnRpYXRpb25TZXJ2aWNlLmNyZWF0ZUluc3RhbmNlKEVtYmVkZGVkQ29kZUVkaXRvcldpZGdldCwgdGhpcy5fcHJldmlld0NvbnRhaW5lciwgb3B0aW9ucywge30sIHRoaXMuZWRpdG9yKTtcblx0XHRkb20uaGlkZSh0aGlzLl9wcmV2aWV3Q29udGFpbmVyKTtcblx0XHR0aGlzLl9wcmV2aWV3Tm90QXZhaWxhYmxlTWVzc2FnZSA9IHRoaXMuX2luc3RhbnRpYXRpb25TZXJ2aWNlLmNyZWF0ZUluc3RhbmNlKFRleHRNb2RlbCwgbmxzLmxvY2FsaXplKCdtaXNzaW5nUHJldmlld01lc3NhZ2UnLCBcIm5vIHByZXZpZXcgYXZhaWxhYmxlXCIpLCBQTEFJTlRFWFRfTEFOR1VBR0VfSUQsIFRleHRNb2RlbC5ERUZBVUxUX0NSRUFUSU9OX09QVElPTlMsIG51bGwpO1xuXG5cdFx0Ly8gdHJlZVxuXHRcdHRoaXMuX3RyZWVDb250YWluZXIgPSBkb20uYXBwZW5kKGNvbnRhaW5lckVsZW1lbnQsIGRvbS4kKCdkaXYucmVmLXRyZWUuaW5saW5lJykpO1xuXHRcdGNvbnN0IHRyZWVPcHRpb25zOiBJV29ya2JlbmNoQXN5bmNEYXRhVHJlZU9wdGlvbnM8VHJlZUVsZW1lbnQsIEZ1enp5U2NvcmU+ID0ge1xuXHRcdFx0a2V5Ym9hcmRTdXBwb3J0OiB0aGlzLl9kZWZhdWx0VHJlZUtleWJvYXJkU3VwcG9ydCxcblx0XHRcdGFjY2Vzc2liaWxpdHlQcm92aWRlcjogbmV3IEFjY2Vzc2liaWxpdHlQcm92aWRlcigpLFxuXHRcdFx0a2V5Ym9hcmROYXZpZ2F0aW9uTGFiZWxQcm92aWRlcjogdGhpcy5faW5zdGFudGlhdGlvblNlcnZpY2UuY3JlYXRlSW5zdGFuY2UoU3RyaW5nUmVwcmVzZW50YXRpb25Qcm92aWRlciksXG5cdFx0XHRpZGVudGl0eVByb3ZpZGVyOiBuZXcgSWRlbnRpdHlQcm92aWRlcigpLFxuXHRcdFx0b3Blbk9uU2luZ2xlQ2xpY2s6IHRydWUsXG5cdFx0XHRzZWxlY3Rpb25OYXZpZ2F0aW9uOiB0cnVlLFxuXHRcdFx0b3ZlcnJpZGVTdHlsZXM6IHtcblx0XHRcdFx0bGlzdEJhY2tncm91bmQ6IHBlZWtWaWV3LnBlZWtWaWV3UmVzdWx0c0JhY2tncm91bmRcblx0XHRcdH0sXG5cdFx0XHRkbmQ6IHRoaXMuX2luc3RhbnRpYXRpb25TZXJ2aWNlLmNyZWF0ZUluc3RhbmNlKFJlZmVyZW5jZXNEcmFnQW5kRHJvcClcblx0XHR9O1xuXHRcdGlmICh0aGlzLl9kZWZhdWx0VHJlZUtleWJvYXJkU3VwcG9ydCkge1xuXHRcdFx0Ly8gdGhlIHRyZWUgd2lsbCBjb25zdW1lIGBFc2NhcGVgIGFuZCBwcmV2ZW50IHRoZSB3aWRnZXQgZnJvbSBjbG9zaW5nXG5cdFx0XHR0aGlzLl9jYWxsT25EaXNwb3NlLmFkZChkb20uYWRkU3RhbmRhcmREaXNwb3NhYmxlTGlzdGVuZXIodGhpcy5fdHJlZUNvbnRhaW5lciwgJ2tleWRvd24nLCAoZSkgPT4ge1xuXHRcdFx0XHRpZiAoZS5lcXVhbHMoS2V5Q29kZS5Fc2NhcGUpKSB7XG5cdFx0XHRcdFx0dGhpcy5fa2V5YmluZGluZ1NlcnZpY2UuZGlzcGF0Y2hFdmVudChlLCBlLnRhcmdldCk7XG5cdFx0XHRcdFx0ZS5zdG9wUHJvcGFnYXRpb24oKTtcblx0XHRcdFx0fVxuXHRcdFx0fSwgdHJ1ZSkpO1xuXHRcdH1cblx0XHR0aGlzLl90cmVlID0gdGhpcy5faW5zdGFudGlhdGlvblNlcnZpY2UuY3JlYXRlSW5zdGFuY2UoXG5cdFx0XHRSZWZlcmVuY2VzVHJlZSxcblx0XHRcdCdSZWZlcmVuY2VzV2lkZ2V0Jyxcblx0XHRcdHRoaXMuX3RyZWVDb250YWluZXIsXG5cdFx0XHRuZXcgRGVsZWdhdGUoKSxcblx0XHRcdFtcblx0XHRcdFx0dGhpcy5faW5zdGFudGlhdGlvblNlcnZpY2UuY3JlYXRlSW5zdGFuY2UoRmlsZVJlZmVyZW5jZXNSZW5kZXJlciksXG5cdFx0XHRcdHRoaXMuX2luc3RhbnRpYXRpb25TZXJ2aWNlLmNyZWF0ZUluc3RhbmNlKE9uZVJlZmVyZW5jZVJlbmRlcmVyKSxcblx0XHRcdF0sXG5cdFx0XHR0aGlzLl9pbnN0YW50aWF0aW9uU2VydmljZS5jcmVhdGVJbnN0YW5jZShEYXRhU291cmNlKSxcblx0XHRcdHRyZWVPcHRpb25zLFxuXHRcdCk7XG5cblx0XHQvLyBzcGxpdCBzdHVmZlxuXHRcdHRoaXMuX3NwbGl0Vmlldy5hZGRWaWV3KHtcblx0XHRcdG9uRGlkQ2hhbmdlOiBFdmVudC5Ob25lLFxuXHRcdFx0ZWxlbWVudDogdGhpcy5fcHJldmlld0NvbnRhaW5lcixcblx0XHRcdG1pbmltdW1TaXplOiAyMDAsXG5cdFx0XHRtYXhpbXVtU2l6ZTogTnVtYmVyLk1BWF9WQUxVRSxcblx0XHRcdGxheW91dDogKHdpZHRoKSA9PiB7XG5cdFx0XHRcdHRoaXMuX3ByZXZpZXcubGF5b3V0KHsgaGVpZ2h0OiB0aGlzLl9kaW0uaGVpZ2h0LCB3aWR0aCB9KTtcblx0XHRcdH1cblx0XHR9LCBTaXppbmcuRGlzdHJpYnV0ZSk7XG5cblx0XHR0aGlzLl9zcGxpdFZpZXcuYWRkVmlldyh7XG5cdFx0XHRvbkRpZENoYW5nZTogRXZlbnQuTm9uZSxcblx0XHRcdGVsZW1lbnQ6IHRoaXMuX3RyZWVDb250YWluZXIsXG5cdFx0XHRtaW5pbXVtU2l6ZTogMTAwLFxuXHRcdFx0bWF4aW11bVNpemU6IE51bWJlci5NQVhfVkFMVUUsXG5cdFx0XHRsYXlvdXQ6ICh3aWR0aCkgPT4ge1xuXHRcdFx0XHR0aGlzLl90cmVlQ29udGFpbmVyLnN0eWxlLmhlaWdodCA9IGAke3RoaXMuX2RpbS5oZWlnaHR9cHhgO1xuXHRcdFx0XHR0aGlzLl90cmVlQ29udGFpbmVyLnN0eWxlLndpZHRoID0gYCR7d2lkdGh9cHhgO1xuXHRcdFx0XHR0aGlzLl90cmVlLmxheW91dCh0aGlzLl9kaW0uaGVpZ2h0LCB3aWR0aCk7XG5cdFx0XHR9XG5cdFx0fSwgU2l6aW5nLkRpc3RyaWJ1dGUpO1xuXG5cdFx0dGhpcy5fZGlzcG9zYWJsZXMuYWRkKHRoaXMuX3NwbGl0Vmlldy5vbkRpZFNhc2hDaGFuZ2UoKCkgPT4ge1xuXHRcdFx0aWYgKHRoaXMuX2RpbS53aWR0aCkge1xuXHRcdFx0XHR0aGlzLmxheW91dERhdGEucmF0aW8gPSB0aGlzLl9zcGxpdFZpZXcuZ2V0Vmlld1NpemUoMCkgLyB0aGlzLl9kaW0ud2lkdGg7XG5cdFx0XHR9XG5cdFx0fSwgdW5kZWZpbmVkKSk7XG5cblx0XHQvLyBsaXN0ZW4gb24gc2VsZWN0aW9uIGFuZCBmb2N1c1xuXHRcdGNvbnN0IG9uRXZlbnQgPSAoZWxlbWVudDogYW55LCBraW5kOiAnc2hvdycgfCAnZ290bycgfCAnc2lkZScpID0+IHtcblx0XHRcdGlmIChlbGVtZW50IGluc3RhbmNlb2YgT25lUmVmZXJlbmNlKSB7XG5cdFx0XHRcdGlmIChraW5kID09PSAnc2hvdycpIHtcblx0XHRcdFx0XHR0aGlzLl9yZXZlYWxSZWZlcmVuY2UoZWxlbWVudCwgZmFsc2UpO1xuXHRcdFx0XHR9XG5cdFx0XHRcdHRoaXMuX29uRGlkU2VsZWN0UmVmZXJlbmNlLmZpcmUoeyBlbGVtZW50LCBraW5kLCBzb3VyY2U6ICd0cmVlJyB9KTtcblx0XHRcdH1cblx0XHR9O1xuXHRcdHRoaXMuX2Rpc3Bvc2FibGVzLmFkZCh0aGlzLl90cmVlLm9uRGlkT3BlbihlID0+IHtcblx0XHRcdGlmIChlLnNpZGVCeVNpZGUpIHtcblx0XHRcdFx0b25FdmVudChlLmVsZW1lbnQsICdzaWRlJyk7XG5cdFx0XHR9IGVsc2UgaWYgKGUuZWRpdG9yT3B0aW9ucy5waW5uZWQpIHtcblx0XHRcdFx0b25FdmVudChlLmVsZW1lbnQsICdnb3RvJyk7XG5cdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRvbkV2ZW50KGUuZWxlbWVudCwgJ3Nob3cnKTtcblx0XHRcdH1cblx0XHR9KSk7XG5cblx0XHRkb20uaGlkZSh0aGlzLl90cmVlQ29udGFpbmVyKTtcblx0fVxuXG5cdHByb3RlY3RlZCBvdmVycmlkZSBfb25XaWR0aCh3aWR0aDogbnVtYmVyKSB7XG5cdFx0aWYgKHRoaXMuX2RpbSkge1xuXHRcdFx0dGhpcy5fZG9MYXlvdXRCb2R5KHRoaXMuX2RpbS5oZWlnaHQsIHdpZHRoKTtcblx0XHR9XG5cdH1cblxuXHRwcm90ZWN0ZWQgb3ZlcnJpZGUgX2RvTGF5b3V0Qm9keShoZWlnaHRJblBpeGVsOiBudW1iZXIsIHdpZHRoSW5QaXhlbDogbnVtYmVyKTogdm9pZCB7XG5cdFx0c3VwZXIuX2RvTGF5b3V0Qm9keShoZWlnaHRJblBpeGVsLCB3aWR0aEluUGl4ZWwpO1xuXHRcdHRoaXMuX2RpbSA9IG5ldyBkb20uRGltZW5zaW9uKHdpZHRoSW5QaXhlbCwgaGVpZ2h0SW5QaXhlbCk7XG5cdFx0dGhpcy5sYXlvdXREYXRhLmhlaWdodEluTGluZXMgPSB0aGlzLl92aWV3Wm9uZSA/IHRoaXMuX3ZpZXdab25lLmhlaWdodEluTGluZXMgOiB0aGlzLmxheW91dERhdGEuaGVpZ2h0SW5MaW5lcztcblx0XHR0aGlzLl9zcGxpdFZpZXcubGF5b3V0KHdpZHRoSW5QaXhlbCk7XG5cdFx0dGhpcy5fc3BsaXRWaWV3LnJlc2l6ZVZpZXcoMCwgd2lkdGhJblBpeGVsICogdGhpcy5sYXlvdXREYXRhLnJhdGlvKTtcblx0fVxuXG5cdHNldFNlbGVjdGlvbihzZWxlY3Rpb246IE9uZVJlZmVyZW5jZSk6IFByb21pc2U8YW55PiB7XG5cdFx0cmV0dXJuIHRoaXMuX3JldmVhbFJlZmVyZW5jZShzZWxlY3Rpb24sIHRydWUpLnRoZW4oKCkgPT4ge1xuXHRcdFx0aWYgKCF0aGlzLl9tb2RlbCkge1xuXHRcdFx0XHQvLyBkaXNwb3NlZFxuXHRcdFx0XHRyZXR1cm47XG5cdFx0XHR9XG5cdFx0XHQvLyBzaG93IGluIHRyZWVcblx0XHRcdHRoaXMuX3RyZWUuc2V0U2VsZWN0aW9uKFtzZWxlY3Rpb25dKTtcblx0XHRcdHRoaXMuX3RyZWUuc2V0Rm9jdXMoW3NlbGVjdGlvbl0pO1xuXHRcdH0pO1xuXHR9XG5cblx0c2V0TW9kZWwobmV3TW9kZWw6IFJlZmVyZW5jZXNNb2RlbCB8IHVuZGVmaW5lZCk6IFByb21pc2U8YW55PiB7XG5cdFx0Ly8gY2xlYW4gdXBcblx0XHR0aGlzLl9kaXNwb3NlT25OZXdNb2RlbC5jbGVhcigpO1xuXHRcdHRoaXMuX21vZGVsID0gbmV3TW9kZWw7XG5cdFx0aWYgKHRoaXMuX21vZGVsKSB7XG5cdFx0XHRyZXR1cm4gdGhpcy5fb25OZXdNb2RlbCgpO1xuXHRcdH1cblx0XHRyZXR1cm4gUHJvbWlzZS5yZXNvbHZlKCk7XG5cdH1cblxuXHRwcml2YXRlIF9vbk5ld01vZGVsKCk6IFByb21pc2U8YW55PiB7XG5cdFx0aWYgKCF0aGlzLl9tb2RlbCkge1xuXHRcdFx0cmV0dXJuIFByb21pc2UucmVzb2x2ZSh1bmRlZmluZWQpO1xuXHRcdH1cblxuXHRcdGlmICh0aGlzLl9tb2RlbC5pc0VtcHR5KSB7XG5cdFx0XHR0aGlzLnNldFRpdGxlKCcnKTtcblx0XHRcdHRoaXMuX21lc3NhZ2VDb250YWluZXIuaW5uZXJUZXh0ID0gbmxzLmxvY2FsaXplKCdub1Jlc3VsdHMnLCBcIk5vIHJlc3VsdHNcIik7XG5cdFx0XHRkb20uc2hvdyh0aGlzLl9tZXNzYWdlQ29udGFpbmVyKTtcblx0XHRcdHJldHVybiBQcm9taXNlLnJlc29sdmUodW5kZWZpbmVkKTtcblx0XHR9XG5cblx0XHRkb20uaGlkZSh0aGlzLl9tZXNzYWdlQ29udGFpbmVyKTtcblx0XHR0aGlzLl9kZWNvcmF0aW9uc01hbmFnZXIgPSBuZXcgRGVjb3JhdGlvbnNNYW5hZ2VyKHRoaXMuX3ByZXZpZXcsIHRoaXMuX21vZGVsKTtcblx0XHR0aGlzLl9kaXNwb3NlT25OZXdNb2RlbC5hZGQodGhpcy5fZGVjb3JhdGlvbnNNYW5hZ2VyKTtcblxuXHRcdC8vIGxpc3RlbiBvbiBtb2RlbCBjaGFuZ2VzXG5cdFx0dGhpcy5fZGlzcG9zZU9uTmV3TW9kZWwuYWRkKHRoaXMuX21vZGVsLm9uRGlkQ2hhbmdlUmVmZXJlbmNlUmFuZ2UocmVmZXJlbmNlID0+IHRoaXMuX3RyZWUucmVyZW5kZXIocmVmZXJlbmNlKSkpO1xuXG5cdFx0Ly8gbGlzdGVuIG9uIGVkaXRvclxuXHRcdHRoaXMuX2Rpc3Bvc2VPbk5ld01vZGVsLmFkZCh0aGlzLl9wcmV2aWV3Lm9uTW91c2VEb3duKGUgPT4ge1xuXHRcdFx0Y29uc3QgeyBldmVudCwgdGFyZ2V0IH0gPSBlO1xuXHRcdFx0aWYgKGV2ZW50LmRldGFpbCAhPT0gMikge1xuXHRcdFx0XHRyZXR1cm47XG5cdFx0XHR9XG5cdFx0XHRjb25zdCBlbGVtZW50ID0gdGhpcy5fZ2V0Rm9jdXNlZFJlZmVyZW5jZSgpO1xuXHRcdFx0aWYgKCFlbGVtZW50KSB7XG5cdFx0XHRcdHJldHVybjtcblx0XHRcdH1cblx0XHRcdHRoaXMuX29uRGlkU2VsZWN0UmVmZXJlbmNlLmZpcmUoe1xuXHRcdFx0XHRlbGVtZW50OiB7IHVyaTogZWxlbWVudC51cmksIHJhbmdlOiB0YXJnZXQucmFuZ2UhIH0sXG5cdFx0XHRcdGtpbmQ6IChldmVudC5jdHJsS2V5IHx8IGV2ZW50Lm1ldGFLZXkgfHwgZXZlbnQuYWx0S2V5KSA/ICdzaWRlJyA6ICdvcGVuJyxcblx0XHRcdFx0c291cmNlOiAnZWRpdG9yJ1xuXHRcdFx0fSk7XG5cdFx0fSkpO1xuXG5cdFx0Ly8gbWFrZSBzdXJlIHRoaW5ncyBhcmUgcmVuZGVyZWRcblx0XHR0aGlzLmNvbnRhaW5lciEuY2xhc3NMaXN0LmFkZCgncmVzdWx0cy1sb2FkZWQnKTtcblx0XHRkb20uc2hvdyh0aGlzLl90cmVlQ29udGFpbmVyKTtcblx0XHRkb20uc2hvdyh0aGlzLl9wcmV2aWV3Q29udGFpbmVyKTtcblx0XHR0aGlzLl9zcGxpdFZpZXcubGF5b3V0KHRoaXMuX2RpbS53aWR0aCk7XG5cdFx0dGhpcy5mb2N1c09uUmVmZXJlbmNlVHJlZSgpO1xuXG5cdFx0Ly8gcGljayBpbnB1dCBhbmQgYSByZWZlcmVuY2UgdG8gYmVnaW4gd2l0aFxuXHRcdHJldHVybiB0aGlzLl90cmVlLnNldElucHV0KHRoaXMuX21vZGVsLmdyb3Vwcy5sZW5ndGggPT09IDEgPyB0aGlzLl9tb2RlbC5ncm91cHNbMF0gOiB0aGlzLl9tb2RlbCk7XG5cdH1cblxuXHRwcml2YXRlIF9nZXRGb2N1c2VkUmVmZXJlbmNlKCk6IE9uZVJlZmVyZW5jZSB8IHVuZGVmaW5lZCB7XG5cdFx0Y29uc3QgW2VsZW1lbnRdID0gdGhpcy5fdHJlZS5nZXRGb2N1cygpO1xuXHRcdGlmIChlbGVtZW50IGluc3RhbmNlb2YgT25lUmVmZXJlbmNlKSB7XG5cdFx0XHRyZXR1cm4gZWxlbWVudDtcblx0XHR9IGVsc2UgaWYgKGVsZW1lbnQgaW5zdGFuY2VvZiBGaWxlUmVmZXJlbmNlcykge1xuXHRcdFx0aWYgKGVsZW1lbnQuY2hpbGRyZW4ubGVuZ3RoID4gMCkge1xuXHRcdFx0XHRyZXR1cm4gZWxlbWVudC5jaGlsZHJlblswXTtcblx0XHRcdH1cblx0XHR9XG5cdFx0cmV0dXJuIHVuZGVmaW5lZDtcblx0fVxuXG5cdGFzeW5jIHJldmVhbFJlZmVyZW5jZShyZWZlcmVuY2U6IE9uZVJlZmVyZW5jZSk6IFByb21pc2U8dm9pZD4ge1xuXHRcdGF3YWl0IHRoaXMuX3JldmVhbFJlZmVyZW5jZShyZWZlcmVuY2UsIGZhbHNlKTtcblx0XHR0aGlzLl9vbkRpZFNlbGVjdFJlZmVyZW5jZS5maXJlKHsgZWxlbWVudDogcmVmZXJlbmNlLCBraW5kOiAnZ290bycsIHNvdXJjZTogJ3RyZWUnIH0pO1xuXHR9XG5cblx0cHJpdmF0ZSBfcmV2ZWFsZWRSZWZlcmVuY2U/OiBPbmVSZWZlcmVuY2U7XG5cblx0cHJpdmF0ZSBhc3luYyBfcmV2ZWFsUmVmZXJlbmNlKHJlZmVyZW5jZTogT25lUmVmZXJlbmNlLCByZXZlYWxQYXJlbnQ6IGJvb2xlYW4pOiBQcm9taXNlPHZvaWQ+IHtcblxuXHRcdC8vIGNoZWNrIGlmIHRoZXJlIGlzIGFueXRoaW5nIHRvIGRvLi4uXG5cdFx0aWYgKHRoaXMuX3JldmVhbGVkUmVmZXJlbmNlID09PSByZWZlcmVuY2UpIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cdFx0dGhpcy5fcmV2ZWFsZWRSZWZlcmVuY2UgPSByZWZlcmVuY2U7XG5cblx0XHQvLyBVcGRhdGUgd2lkZ2V0IGhlYWRlclxuXHRcdGlmIChyZWZlcmVuY2UudXJpLnNjaGVtZSAhPT0gU2NoZW1hcy5pbk1lbW9yeSkge1xuXHRcdFx0dGhpcy5zZXRUaXRsZShiYXNlbmFtZU9yQXV0aG9yaXR5KHJlZmVyZW5jZS51cmkpLCB0aGlzLl91cmlMYWJlbC5nZXRVcmlMYWJlbChkaXJuYW1lKHJlZmVyZW5jZS51cmkpKSk7XG5cdFx0fSBlbHNlIHtcblx0XHRcdHRoaXMuc2V0VGl0bGUobmxzLmxvY2FsaXplKCdwZWVrVmlldy5hbHRlcm5hdGVUaXRsZScsIFwiUmVmZXJlbmNlc1wiKSk7XG5cdFx0fVxuXG5cdFx0Y29uc3QgcHJvbWlzZSA9IHRoaXMuX3RleHRNb2RlbFJlc29sdmVyU2VydmljZS5jcmVhdGVNb2RlbFJlZmVyZW5jZShyZWZlcmVuY2UudXJpKTtcblxuXHRcdGlmICh0aGlzLl90cmVlLmdldElucHV0KCkgPT09IHJlZmVyZW5jZS5wYXJlbnQpIHtcblx0XHRcdHRoaXMuX3RyZWUucmV2ZWFsKHJlZmVyZW5jZSk7XG5cdFx0fSBlbHNlIHtcblx0XHRcdGlmIChyZXZlYWxQYXJlbnQpIHtcblx0XHRcdFx0dGhpcy5fdHJlZS5yZXZlYWwocmVmZXJlbmNlLnBhcmVudCk7XG5cdFx0XHR9XG5cdFx0XHRhd2FpdCB0aGlzLl90cmVlLmV4cGFuZChyZWZlcmVuY2UucGFyZW50KTtcblx0XHRcdHRoaXMuX3RyZWUucmV2ZWFsKHJlZmVyZW5jZSk7XG5cdFx0fVxuXG5cdFx0Y29uc3QgcmVmID0gYXdhaXQgcHJvbWlzZTtcblxuXHRcdGlmICghdGhpcy5fbW9kZWwpIHtcblx0XHRcdC8vIGRpc3Bvc2VkXG5cdFx0XHRyZWYuZGlzcG9zZSgpO1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblxuXHRcdGRpc3Bvc2UodGhpcy5fcHJldmlld01vZGVsUmVmZXJlbmNlKTtcblxuXHRcdC8vIHNob3cgaW4gZWRpdG9yXG5cdFx0Y29uc3QgbW9kZWwgPSByZWYub2JqZWN0O1xuXHRcdGlmIChtb2RlbCkge1xuXHRcdFx0Y29uc3Qgc2Nyb2xsVHlwZSA9IHRoaXMuX3ByZXZpZXcuZ2V0TW9kZWwoKSA9PT0gbW9kZWwudGV4dEVkaXRvck1vZGVsID8gU2Nyb2xsVHlwZS5TbW9vdGggOiBTY3JvbGxUeXBlLkltbWVkaWF0ZTtcblx0XHRcdGNvbnN0IHNlbCA9IFJhbmdlLmxpZnQocmVmZXJlbmNlLnJhbmdlKS5jb2xsYXBzZVRvU3RhcnQoKTtcblx0XHRcdHRoaXMuX3ByZXZpZXdNb2RlbFJlZmVyZW5jZSA9IHJlZjtcblx0XHRcdHRoaXMuX3ByZXZpZXcuc2V0TW9kZWwobW9kZWwudGV4dEVkaXRvck1vZGVsKTtcblx0XHRcdHRoaXMuX3ByZXZpZXcuc2V0U2VsZWN0aW9uKHNlbCk7XG5cdFx0XHR0aGlzLl9wcmV2aWV3LnJldmVhbFJhbmdlSW5DZW50ZXIoc2VsLCBzY3JvbGxUeXBlKTtcblx0XHR9IGVsc2Uge1xuXHRcdFx0dGhpcy5fcHJldmlldy5zZXRNb2RlbCh0aGlzLl9wcmV2aWV3Tm90QXZhaWxhYmxlTWVzc2FnZSk7XG5cdFx0XHRyZWYuZGlzcG9zZSgpO1xuXHRcdH1c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
