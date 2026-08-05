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
import "./media/sidebysideeditor.css";
import { localize } from "../../../../nls.js";
import { Dimension, $, clearNode, multibyteAwareBtoa } from "../../../../base/browser/dom.js";
import { Registry } from "../../../../platform/registry/common/platform.js";
import { EditorExtensions, SIDE_BY_SIDE_EDITOR_ID, SideBySideEditor as Side, isEditorPaneWithSelection, EditorPaneSelectionCompareResult } from "../../../common/editor.js";
import { SideBySideEditorInput } from "../../../common/editor/sideBySideEditorInput.js";
import { ITelemetryService } from "../../../../platform/telemetry/common/telemetry.js";
import { IInstantiationService } from "../../../../platform/instantiation/common/instantiation.js";
import { IThemeService } from "../../../../platform/theme/common/themeService.js";
import { IEditorGroupsService } from "../../../services/editor/common/editorGroupsService.js";
import { SplitView, Sizing, Orientation } from "../../../../base/browser/ui/splitview/splitview.js";
import { Event, Relay, Emitter } from "../../../../base/common/event.js";
import { IStorageService } from "../../../../platform/storage/common/storage.js";
import { assertIsDefined } from "../../../../base/common/types.js";
import { IConfigurationService } from "../../../../platform/configuration/common/configuration.js";
import { DEFAULT_EDITOR_MIN_DIMENSIONS } from "./editor.js";
import { DisposableStore } from "../../../../base/common/lifecycle.js";
import { SIDE_BY_SIDE_EDITOR_HORIZONTAL_BORDER, SIDE_BY_SIDE_EDITOR_VERTICAL_BORDER } from "../../../common/theme.js";
import { AbstractEditorWithViewState } from "./editorWithViewState.js";
import { ITextResourceConfigurationService } from "../../../../editor/common/services/textResourceConfiguration.js";
import { IEditorService } from "../../../services/editor/common/editorService.js";
import { isEqual } from "../../../../base/common/resources.js";
import { URI } from "../../../../base/common/uri.js";
function isSideBySideEditorViewState(thing) {
  const candidate = thing;
  return typeof candidate?.primary === "object" && typeof candidate.secondary === "object";
}
let SideBySideEditor = class extends AbstractEditorWithViewState {
  constructor(group, telemetryService, instantiationService, themeService, storageService, configurationService, textResourceConfigurationService, editorService, editorGroupService) {
    super(SideBySideEditor.ID, group, SideBySideEditor.VIEW_STATE_PREFERENCE_KEY, telemetryService, instantiationService, storageService, textResourceConfigurationService, themeService, editorService, editorGroupService);
    this.configurationService = configurationService;
    //#endregion
    //#region Events
    this.onDidCreateEditors = this._register(new Emitter());
    this._onDidChangeSizeConstraints = this._register(new Relay());
    this.onDidChangeSizeConstraints = Event.any(this.onDidCreateEditors.event, this._onDidChangeSizeConstraints.event);
    this._onDidChangeSelection = this._register(new Emitter());
    this.onDidChangeSelection = this._onDidChangeSelection.event;
    //#endregion
    this.primaryEditorPane = void 0;
    this.secondaryEditorPane = void 0;
    this.splitviewDisposables = this._register(new DisposableStore());
    this.editorDisposables = this._register(new DisposableStore());
    this.dimension = new Dimension(0, 0);
    this.lastFocusedSide = void 0;
    this.orientation = this.configurationService.getValue(SideBySideEditor.SIDE_BY_SIDE_LAYOUT_SETTING) === "vertical" ? Orientation.VERTICAL : Orientation.HORIZONTAL;
    this.registerListeners();
  }
  //#region Layout Constraints
  get minimumPrimaryWidth() {
    return this.primaryEditorPane ? this.primaryEditorPane.minimumWidth : 0;
  }
  get maximumPrimaryWidth() {
    return this.primaryEditorPane ? this.primaryEditorPane.maximumWidth : Number.POSITIVE_INFINITY;
  }
  get minimumPrimaryHeight() {
    return this.primaryEditorPane ? this.primaryEditorPane.minimumHeight : 0;
  }
  get maximumPrimaryHeight() {
    return this.primaryEditorPane ? this.primaryEditorPane.maximumHeight : Number.POSITIVE_INFINITY;
  }
  get minimumSecondaryWidth() {
    return this.secondaryEditorPane ? this.secondaryEditorPane.minimumWidth : 0;
  }
  get maximumSecondaryWidth() {
    return this.secondaryEditorPane ? this.secondaryEditorPane.maximumWidth : Number.POSITIVE_INFINITY;
  }
  get minimumSecondaryHeight() {
    return this.secondaryEditorPane ? this.secondaryEditorPane.minimumHeight : 0;
  }
  get maximumSecondaryHeight() {
    return this.secondaryEditorPane ? this.secondaryEditorPane.maximumHeight : Number.POSITIVE_INFINITY;
  }
  set minimumWidth(value) {
  }
  set maximumWidth(value) {
  }
  set minimumHeight(value) {
  }
  set maximumHeight(value) {
  }
  get minimumWidth() {
    return this.minimumPrimaryWidth + this.minimumSecondaryWidth;
  }
  get maximumWidth() {
    return this.maximumPrimaryWidth + this.maximumSecondaryWidth;
  }
  get minimumHeight() {
    return this.minimumPrimaryHeight + this.minimumSecondaryHeight;
  }
  get maximumHeight() {
    return this.maximumPrimaryHeight + this.maximumSecondaryHeight;
  }
  registerListeners() {
    this._register(this.configurationService.onDidChangeConfiguration((e) => this.onConfigurationUpdated(e)));
  }
  onConfigurationUpdated(event) {
    if (event.affectsConfiguration(SideBySideEditor.SIDE_BY_SIDE_LAYOUT_SETTING)) {
      this.orientation = this.configurationService.getValue(SideBySideEditor.SIDE_BY_SIDE_LAYOUT_SETTING) === "vertical" ? Orientation.VERTICAL : Orientation.HORIZONTAL;
      if (this.splitview) {
        this.recreateSplitview();
      }
    }
  }
  recreateSplitview() {
    const container = assertIsDefined(this.getContainer());
    const ratio = this.getSplitViewRatio();
    if (this.splitview) {
      this.splitview.el.remove();
      this.splitviewDisposables.clear();
    }
    this.createSplitView(container, ratio);
    this.layout(this.dimension);
  }
  getSplitViewRatio() {
    let ratio = void 0;
    if (this.splitview) {
      const leftViewSize = this.splitview.getViewSize(0);
      const rightViewSize = this.splitview.getViewSize(1);
      if (Math.abs(leftViewSize - rightViewSize) > 1) {
        const totalSize = this.splitview.orientation === Orientation.HORIZONTAL ? this.dimension.width : this.dimension.height;
        ratio = leftViewSize / totalSize;
      }
    }
    return ratio;
  }
  createEditor(parent) {
    parent.classList.add("side-by-side-editor");
    this.secondaryEditorContainer = $(".side-by-side-editor-container.editor-instance");
    this.primaryEditorContainer = $(".side-by-side-editor-container.editor-instance");
    this.createSplitView(parent);
  }
  createSplitView(parent, ratio) {
    this.splitview = this.splitviewDisposables.add(new SplitView(parent, { orientation: this.orientation }));
    this.splitviewDisposables.add(this.splitview.onDidSashReset(() => this.splitview?.distributeViewSizes()));
    if (this.orientation === Orientation.HORIZONTAL) {
      this.splitview.orthogonalEndSash = this._boundarySashes?.bottom;
    } else {
      this.splitview.orthogonalStartSash = this._boundarySashes?.left;
      this.splitview.orthogonalEndSash = this._boundarySashes?.right;
    }
    let leftSizing = Sizing.Distribute;
    let rightSizing = Sizing.Distribute;
    if (ratio) {
      const totalSize = this.splitview.orientation === Orientation.HORIZONTAL ? this.dimension.width : this.dimension.height;
      leftSizing = Math.round(totalSize * ratio);
      rightSizing = totalSize - leftSizing;
      this.splitview.layout(this.orientation === Orientation.HORIZONTAL ? this.dimension.width : this.dimension.height);
    }
    const secondaryEditorContainer = assertIsDefined(this.secondaryEditorContainer);
    this.splitview.addView({
      element: secondaryEditorContainer,
      layout: (size) => this.layoutPane(this.secondaryEditorPane, size),
      minimumSize: this.orientation === Orientation.HORIZONTAL ? DEFAULT_EDITOR_MIN_DIMENSIONS.width : DEFAULT_EDITOR_MIN_DIMENSIONS.height,
      maximumSize: Number.POSITIVE_INFINITY,
      onDidChange: Event.None
    }, leftSizing);
    const primaryEditorContainer = assertIsDefined(this.primaryEditorContainer);
    this.splitview.addView({
      element: primaryEditorContainer,
      layout: (size) => this.layoutPane(this.primaryEditorPane, size),
      minimumSize: this.orientation === Orientation.HORIZONTAL ? DEFAULT_EDITOR_MIN_DIMENSIONS.width : DEFAULT_EDITOR_MIN_DIMENSIONS.height,
      maximumSize: Number.POSITIVE_INFINITY,
      onDidChange: Event.None
    }, rightSizing);
    this.updateStyles();
  }
  getTitle() {
    if (this.input) {
      return this.input.getName();
    }
    return localize("sideBySideEditor", "Side by Side Editor");
  }
  async setInput(input, options, context, token) {
    const oldInput = this.input;
    await super.setInput(input, options, context, token);
    if (!oldInput || !input.matches(oldInput)) {
      if (oldInput) {
        this.disposeEditors();
      }
      this.createEditors(input);
    }
    const { primary, secondary, viewState } = this.loadViewState(input, options, context);
    this.lastFocusedSide = viewState?.focus;
    if (typeof viewState?.ratio === "number" && this.splitview) {
      const totalSize = this.splitview.orientation === Orientation.HORIZONTAL ? this.dimension.width : this.dimension.height;
      this.splitview.resizeView(0, Math.round(totalSize * viewState.ratio));
    } else {
      this.splitview?.distributeViewSizes();
    }
    await Promise.all([
      this.secondaryEditorPane?.setInput(input.secondary, secondary, context, token),
      this.primaryEditorPane?.setInput(input.primary, primary, context, token)
    ]);
    if (typeof options?.target === "number") {
      this.lastFocusedSide = options.target;
    }
  }
  loadViewState(input, options, context) {
    const viewState = isSideBySideEditorViewState(options?.viewState) ? options?.viewState : this.loadEditorViewState(input, context);
    let primaryOptions = /* @__PURE__ */ Object.create(null);
    let secondaryOptions = void 0;
    if (options?.target === Side.SECONDARY) {
      secondaryOptions = { ...options };
    } else {
      primaryOptions = { ...options };
    }
    primaryOptions.viewState = viewState?.primary;
    if (viewState?.secondary) {
      if (!secondaryOptions) {
        secondaryOptions = { viewState: viewState.secondary };
      } else {
        secondaryOptions.viewState = viewState?.secondary;
      }
    }
    return { primary: primaryOptions, secondary: secondaryOptions, viewState };
  }
  createEditors(newInput) {
    this.secondaryEditorPane = this.doCreateEditor(newInput.secondary, assertIsDefined(this.secondaryEditorContainer));
    this.primaryEditorPane = this.doCreateEditor(newInput.primary, assertIsDefined(this.primaryEditorContainer));
    this.layout(this.dimension);
    this._onDidChangeSizeConstraints.input = Event.any(
      Event.map(this.secondaryEditorPane.onDidChangeSizeConstraints, () => void 0),
      Event.map(this.primaryEditorPane.onDidChangeSizeConstraints, () => void 0)
    );
    this.onDidCreateEditors.fire(void 0);
    this.editorDisposables.add(this.primaryEditorPane.onDidFocus(() => this.onDidFocusChange(Side.PRIMARY)));
    this.editorDisposables.add(this.secondaryEditorPane.onDidFocus(() => this.onDidFocusChange(Side.SECONDARY)));
  }
  doCreateEditor(editorInput, container) {
    const editorPaneDescriptor = Registry.as(EditorExtensions.EditorPane).getEditorPane(editorInput);
    if (!editorPaneDescriptor) {
      throw new Error("No editor pane descriptor for editor found");
    }
    const editorPane = editorPaneDescriptor.instantiate(this.instantiationService, this.group);
    editorPane.create(container);
    editorPane.setVisible(this.isVisible());
    if (isEditorPaneWithSelection(editorPane)) {
      this.editorDisposables.add(editorPane.onDidChangeSelection((e) => this._onDidChangeSelection.fire(e)));
    }
    this.editorDisposables.add(editorPane);
    return editorPane;
  }
  onDidFocusChange(side) {
    this.lastFocusedSide = side;
    this._onDidChangeControl.fire();
  }
  getSelection() {
    const lastFocusedEditorPane = this.getLastFocusedEditorPane();
    if (isEditorPaneWithSelection(lastFocusedEditorPane)) {
      const selection = lastFocusedEditorPane.getSelection();
      if (selection) {
        return new SideBySideAwareEditorPaneSelection(selection, lastFocusedEditorPane === this.primaryEditorPane ? Side.PRIMARY : Side.SECONDARY);
      }
    }
    return void 0;
  }
  setOptions(options) {
    super.setOptions(options);
    if (typeof options?.target === "number") {
      this.lastFocusedSide = options.target;
    }
    this.getLastFocusedEditorPane()?.setOptions(options);
  }
  setEditorVisible(visible) {
    this.primaryEditorPane?.setVisible(visible);
    this.secondaryEditorPane?.setVisible(visible);
    super.setEditorVisible(visible);
  }
  clearInput() {
    super.clearInput();
    this.primaryEditorPane?.clearInput();
    this.secondaryEditorPane?.clearInput();
    this.disposeEditors();
  }
  focus() {
    super.focus();
    this.getLastFocusedEditorPane()?.focus();
  }
  getLastFocusedEditorPane() {
    if (this.lastFocusedSide === Side.SECONDARY) {
      return this.secondaryEditorPane;
    }
    return this.primaryEditorPane;
  }
  layout(dimension) {
    this.dimension = dimension;
    const splitview = assertIsDefined(this.splitview);
    splitview.layout(this.orientation === Orientation.HORIZONTAL ? dimension.width : dimension.height);
  }
  setBoundarySashes(sashes) {
    this._boundarySashes = sashes;
    if (this.splitview) {
      this.splitview.orthogonalEndSash = sashes.bottom;
    }
  }
  layoutPane(pane, size) {
    pane?.layout(this.orientation === Orientation.HORIZONTAL ? new Dimension(size, this.dimension.height) : new Dimension(this.dimension.width, size));
  }
  getControl() {
    return this.getLastFocusedEditorPane()?.getControl();
  }
  getPrimaryEditorPane() {
    return this.primaryEditorPane;
  }
  getSecondaryEditorPane() {
    return this.secondaryEditorPane;
  }
  tracksEditorViewState(input) {
    return input instanceof SideBySideEditorInput;
  }
  computeEditorViewState(resource) {
    if (!this.input || !isEqual(resource, this.toEditorViewStateResource(this.input))) {
      return;
    }
    const primarViewState = this.primaryEditorPane?.getViewState();
    const secondaryViewState = this.secondaryEditorPane?.getViewState();
    if (!primarViewState || !secondaryViewState) {
      return;
    }
    return {
      primary: primarViewState,
      secondary: secondaryViewState,
      focus: this.lastFocusedSide,
      ratio: this.getSplitViewRatio()
    };
  }
  toEditorViewStateResource(input) {
    let primary;
    let secondary;
    if (input instanceof SideBySideEditorInput) {
      primary = input.primary.resource;
      secondary = input.secondary.resource;
    }
    if (!secondary || !primary) {
      return void 0;
    }
    return URI.from({ scheme: "sideBySide", path: `${multibyteAwareBtoa(secondary.toString())}${multibyteAwareBtoa(primary.toString())}` });
  }
  updateStyles() {
    super.updateStyles();
    if (this.primaryEditorContainer) {
      if (this.orientation === Orientation.HORIZONTAL) {
        this.primaryEditorContainer.style.borderLeftWidth = "1px";
        this.primaryEditorContainer.style.borderLeftStyle = "solid";
        this.primaryEditorContainer.style.borderLeftColor = this.getColor(SIDE_BY_SIDE_EDITOR_VERTICAL_BORDER) ?? "";
        this.primaryEditorContainer.style.borderTopWidth = "0";
      } else {
        this.primaryEditorContainer.style.borderTopWidth = "1px";
        this.primaryEditorContainer.style.borderTopStyle = "solid";
        this.primaryEditorContainer.style.borderTopColor = this.getColor(SIDE_BY_SIDE_EDITOR_HORIZONTAL_BORDER) ?? "";
        this.primaryEditorContainer.style.borderLeftWidth = "0";
      }
    }
  }
  dispose() {
    this.disposeEditors();
    super.dispose();
  }
  disposeEditors() {
    this.editorDisposables.clear();
    this.secondaryEditorPane = void 0;
    this.primaryEditorPane = void 0;
    this.lastFocusedSide = void 0;
    if (this.secondaryEditorContainer) {
      clearNode(this.secondaryEditorContainer);
    }
    if (this.primaryEditorContainer) {
      clearNode(this.primaryEditorContainer);
    }
  }
};
SideBySideEditor.ID = SIDE_BY_SIDE_EDITOR_ID;
SideBySideEditor.SIDE_BY_SIDE_LAYOUT_SETTING = "workbench.editor.splitInGroupLayout";
SideBySideEditor.VIEW_STATE_PREFERENCE_KEY = "sideBySideEditorViewState";
SideBySideEditor = __decorateClass([
  __decorateParam(1, ITelemetryService),
  __decorateParam(2, IInstantiationService),
  __decorateParam(3, IThemeService),
  __decorateParam(4, IStorageService),
  __decorateParam(5, IConfigurationService),
  __decorateParam(6, ITextResourceConfigurationService),
  __decorateParam(7, IEditorService),
  __decorateParam(8, IEditorGroupsService)
], SideBySideEditor);
class SideBySideAwareEditorPaneSelection {
  constructor(selection, side) {
    this.selection = selection;
    this.side = side;
  }
  compare(other) {
    if (!(other instanceof SideBySideAwareEditorPaneSelection)) {
      return EditorPaneSelectionCompareResult.DIFFERENT;
    }
    if (this.side !== other.side) {
      return EditorPaneSelectionCompareResult.DIFFERENT;
    }
    return this.selection.compare(other.selection);
  }
  restore(options) {
    const sideBySideEditorOptions = {
      ...options,
      target: this.side
    };
    return this.selection.restore(sideBySideEditorOptions);
  }
}
export {
  SideBySideEditor
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvYnJvd3Nlci9wYXJ0cy9lZGl0b3Ivc2lkZUJ5U2lkZUVkaXRvci50cyJdLAogICJzb3VyY2VzQ29udGVudCI6IFsiLyotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cbiAqICBDb3B5cmlnaHQgKGMpIE1pY3Jvc29mdCBDb3Jwb3JhdGlvbi4gQWxsIHJpZ2h0cyByZXNlcnZlZC5cbiAqICBMaWNlbnNlZCB1bmRlciB0aGUgTUlUIExpY2Vuc2UuIFNlZSBMaWNlbnNlLnR4dCBpbiB0aGUgcHJvamVjdCByb290IGZvciBsaWNlbnNlIGluZm9ybWF0aW9uLlxuICotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLSovXG5cbmltcG9ydCAnLi9tZWRpYS9zaWRlYnlzaWRlZWRpdG9yLmNzcyc7XG5pbXBvcnQgeyBsb2NhbGl6ZSB9IGZyb20gJy4uLy4uLy4uLy4uL25scy5qcyc7XG5pbXBvcnQgeyBEaW1lbnNpb24sICQsIGNsZWFyTm9kZSwgbXVsdGlieXRlQXdhcmVCdG9hIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9icm93c2VyL2RvbS5qcyc7XG5pbXBvcnQgeyBSZWdpc3RyeSB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL3JlZ2lzdHJ5L2NvbW1vbi9wbGF0Zm9ybS5qcyc7XG5pbXBvcnQgeyBJRWRpdG9yQ29udHJvbCwgSUVkaXRvclBhbmUsIElFZGl0b3JPcGVuQ29udGV4dCwgRWRpdG9yRXh0ZW5zaW9ucywgU0lERV9CWV9TSURFX0VESVRPUl9JRCwgU2lkZUJ5U2lkZUVkaXRvciBhcyBTaWRlLCBJRWRpdG9yUGFuZVNlbGVjdGlvbiwgSUVkaXRvclBhbmVXaXRoU2VsZWN0aW9uLCBJRWRpdG9yUGFuZVNlbGVjdGlvbkNoYW5nZUV2ZW50LCBpc0VkaXRvclBhbmVXaXRoU2VsZWN0aW9uLCBFZGl0b3JQYW5lU2VsZWN0aW9uQ29tcGFyZVJlc3VsdCB9IGZyb20gJy4uLy4uLy4uL2NvbW1vbi9lZGl0b3IuanMnO1xuaW1wb3J0IHsgU2lkZUJ5U2lkZUVkaXRvcklucHV0IH0gZnJvbSAnLi4vLi4vLi4vY29tbW9uL2VkaXRvci9zaWRlQnlTaWRlRWRpdG9ySW5wdXQuanMnO1xuaW1wb3J0IHsgRWRpdG9ySW5wdXQgfSBmcm9tICcuLi8uLi8uLi9jb21tb24vZWRpdG9yL2VkaXRvcklucHV0LmpzJztcbmltcG9ydCB7IEVkaXRvclBhbmUgfSBmcm9tICcuL2VkaXRvclBhbmUuanMnO1xuaW1wb3J0IHsgSVRlbGVtZXRyeVNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS90ZWxlbWV0cnkvY29tbW9uL3RlbGVtZXRyeS5qcyc7XG5pbXBvcnQgeyBJSW5zdGFudGlhdGlvblNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9pbnN0YW50aWF0aW9uL2NvbW1vbi9pbnN0YW50aWF0aW9uLmpzJztcbmltcG9ydCB7IElUaGVtZVNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS90aGVtZS9jb21tb24vdGhlbWVTZXJ2aWNlLmpzJztcbmltcG9ydCB7IElFZGl0b3JQYW5lUmVnaXN0cnkgfSBmcm9tICcuLi8uLi9lZGl0b3IuanMnO1xuaW1wb3J0IHsgQ2FuY2VsbGF0aW9uVG9rZW4gfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9jYW5jZWxsYXRpb24uanMnO1xuaW1wb3J0IHsgSUVkaXRvckdyb3VwLCBJRWRpdG9yR3JvdXBzU2VydmljZSB9IGZyb20gJy4uLy4uLy4uL3NlcnZpY2VzL2VkaXRvci9jb21tb24vZWRpdG9yR3JvdXBzU2VydmljZS5qcyc7XG5pbXBvcnQgeyBTcGxpdFZpZXcsIFNpemluZywgT3JpZW50YXRpb24gfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2Jyb3dzZXIvdWkvc3BsaXR2aWV3L3NwbGl0dmlldy5qcyc7XG5pbXBvcnQgeyBFdmVudCwgUmVsYXksIEVtaXR0ZXIgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9ldmVudC5qcyc7XG5pbXBvcnQgeyBJU3RvcmFnZVNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9zdG9yYWdlL2NvbW1vbi9zdG9yYWdlLmpzJztcbmltcG9ydCB7IGFzc2VydElzRGVmaW5lZCB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL3R5cGVzLmpzJztcbmltcG9ydCB7IElFZGl0b3JPcHRpb25zIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vZWRpdG9yL2NvbW1vbi9lZGl0b3IuanMnO1xuaW1wb3J0IHsgSUNvbmZpZ3VyYXRpb25DaGFuZ2VFdmVudCwgSUNvbmZpZ3VyYXRpb25TZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vY29uZmlndXJhdGlvbi9jb21tb24vY29uZmlndXJhdGlvbi5qcyc7XG5pbXBvcnQgeyBERUZBVUxUX0VESVRPUl9NSU5fRElNRU5TSU9OUyB9IGZyb20gJy4vZWRpdG9yLmpzJztcbmltcG9ydCB7IERpc3Bvc2FibGVTdG9yZSB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2xpZmVjeWNsZS5qcyc7XG5pbXBvcnQgeyBTSURFX0JZX1NJREVfRURJVE9SX0hPUklaT05UQUxfQk9SREVSLCBTSURFX0JZX1NJREVfRURJVE9SX1ZFUlRJQ0FMX0JPUkRFUiB9IGZyb20gJy4uLy4uLy4uL2NvbW1vbi90aGVtZS5qcyc7XG5pbXBvcnQgeyBBYnN0cmFjdEVkaXRvcldpdGhWaWV3U3RhdGUgfSBmcm9tICcuL2VkaXRvcldpdGhWaWV3U3RhdGUuanMnO1xuaW1wb3J0IHsgSVRleHRSZXNvdXJjZUNvbmZpZ3VyYXRpb25TZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vZWRpdG9yL2NvbW1vbi9zZXJ2aWNlcy90ZXh0UmVzb3VyY2VDb25maWd1cmF0aW9uLmpzJztcbmltcG9ydCB7IElFZGl0b3JTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vc2VydmljZXMvZWRpdG9yL2NvbW1vbi9lZGl0b3JTZXJ2aWNlLmpzJztcbmltcG9ydCB7IGlzRXF1YWwgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9yZXNvdXJjZXMuanMnO1xuaW1wb3J0IHsgVVJJIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vdXJpLmpzJztcbmltcG9ydCB7IElCb3VuZGFyeVNhc2hlcyB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvYnJvd3Nlci91aS9zYXNoL3Nhc2guanMnO1xuXG5pbnRlcmZhY2UgSVNpZGVCeVNpZGVFZGl0b3JWaWV3U3RhdGUge1xuXHRwcmltYXJ5OiBvYmplY3Q7XG5cdHNlY29uZGFyeTogb2JqZWN0O1xuXHRmb2N1czogU2lkZS5QUklNQVJZIHwgU2lkZS5TRUNPTkRBUlkgfCB1bmRlZmluZWQ7XG5cdHJhdGlvOiBudW1iZXIgfCB1bmRlZmluZWQ7XG59XG5cbmZ1bmN0aW9uIGlzU2lkZUJ5U2lkZUVkaXRvclZpZXdTdGF0ZSh0aGluZzogdW5rbm93bik6IHRoaW5nIGlzIElTaWRlQnlTaWRlRWRpdG9yVmlld1N0YXRlIHtcblx0Y29uc3QgY2FuZGlkYXRlID0gdGhpbmcgYXMgSVNpZGVCeVNpZGVFZGl0b3JWaWV3U3RhdGUgfCB1bmRlZmluZWQ7XG5cblx0cmV0dXJuIHR5cGVvZiBjYW5kaWRhdGU/LnByaW1hcnkgPT09ICdvYmplY3QnICYmIHR5cGVvZiBjYW5kaWRhdGUuc2Vjb25kYXJ5ID09PSAnb2JqZWN0Jztcbn1cblxuaW50ZXJmYWNlIElTaWRlQnlTaWRlRWRpdG9yT3B0aW9ucyBleHRlbmRzIElFZGl0b3JPcHRpb25zIHtcblxuXHQvKipcblx0ICogV2hldGhlciB0aGUgZWRpdG9yIG9wdGlvbnMgc2hvdWxkIGFwcGx5IHRvXG5cdCAqIHRoZSBwcmltYXJ5IG9yIHNlY29uZGFyeSBzaWRlLlxuXHQgKlxuXHQgKiBJZiBhIHRhcmdldCBzaWRlIGlzIHByb3ZpZGVkLCB0aGF0IHNpZGUgd2lsbFxuXHQgKiBhbHNvIHJlY2VpdmUga2V5Ym9hcmQgZm9jdXMgdW5sZXNzIGZvY3VzIGlzXG5cdCAqIHRvIGJlIHByZXNlcnZlZC5cblx0ICovXG5cdHRhcmdldD86IFNpZGUuUFJJTUFSWSB8IFNpZGUuU0VDT05EQVJZO1xufVxuXG5leHBvcnQgY2xhc3MgU2lkZUJ5U2lkZUVkaXRvciBleHRlbmRzIEFic3RyYWN0RWRpdG9yV2l0aFZpZXdTdGF0ZTxJU2lkZUJ5U2lkZUVkaXRvclZpZXdTdGF0ZT4gaW1wbGVtZW50cyBJRWRpdG9yUGFuZVdpdGhTZWxlY3Rpb24ge1xuXG5cdHN0YXRpYyByZWFkb25seSBJRDogc3RyaW5nID0gU0lERV9CWV9TSURFX0VESVRPUl9JRDtcblxuXHRzdGF0aWMgU0lERV9CWV9TSURFX0xBWU9VVF9TRVRUSU5HID0gJ3dvcmtiZW5jaC5lZGl0b3Iuc3BsaXRJbkdyb3VwTGF5b3V0JztcblxuXHRwcml2YXRlIHN0YXRpYyByZWFkb25seSBWSUVXX1NUQVRFX1BSRUZFUkVOQ0VfS0VZID0gJ3NpZGVCeVNpZGVFZGl0b3JWaWV3U3RhdGUnO1xuXG5cdC8vI3JlZ2lvbiBMYXlvdXQgQ29uc3RyYWludHNcblxuXHRwcml2YXRlIGdldCBtaW5pbXVtUHJpbWFyeVdpZHRoKCkgeyByZXR1cm4gdGhpcy5wcmltYXJ5RWRpdG9yUGFuZSA/IHRoaXMucHJpbWFyeUVkaXRvclBhbmUubWluaW11bVdpZHRoIDogMDsgfVxuXHRwcml2YXRlIGdldCBtYXhpbXVtUHJpbWFyeVdpZHRoKCkgeyByZXR1cm4gdGhpcy5wcmltYXJ5RWRpdG9yUGFuZSA/IHRoaXMucHJpbWFyeUVkaXRvclBhbmUubWF4aW11bVdpZHRoIDogTnVtYmVyLlBPU0lUSVZFX0lORklOSVRZOyB9XG5cdHByaXZhdGUgZ2V0IG1pbmltdW1QcmltYXJ5SGVpZ2h0KCkgeyByZXR1cm4gdGhpcy5wcmltYXJ5RWRpdG9yUGFuZSA/IHRoaXMucHJpbWFyeUVkaXRvclBhbmUubWluaW11bUhlaWdodCA6IDA7IH1cblx0cHJpdmF0ZSBnZXQgbWF4aW11bVByaW1hcnlIZWlnaHQoKSB7IHJldHVybiB0aGlzLnByaW1hcnlFZGl0b3JQYW5lID8gdGhpcy5wcmltYXJ5RWRpdG9yUGFuZS5tYXhpbXVtSGVpZ2h0IDogTnVtYmVyLlBPU0lUSVZFX0lORklOSVRZOyB9XG5cblx0cHJpdmF0ZSBnZXQgbWluaW11bVNlY29uZGFyeVdpZHRoKCkgeyByZXR1cm4gdGhpcy5zZWNvbmRhcnlFZGl0b3JQYW5lID8gdGhpcy5zZWNvbmRhcnlFZGl0b3JQYW5lLm1pbmltdW1XaWR0aCA6IDA7IH1cblx0cHJpdmF0ZSBnZXQgbWF4aW11bVNlY29uZGFyeVdpZHRoKCkgeyByZXR1cm4gdGhpcy5zZWNvbmRhcnlFZGl0b3JQYW5lID8gdGhpcy5zZWNvbmRhcnlFZGl0b3JQYW5lLm1heGltdW1XaWR0aCA6IE51bWJlci5QT1NJVElWRV9JTkZJTklUWTsgfVxuXHRwcml2YXRlIGdldCBtaW5pbXVtU2Vjb25kYXJ5SGVpZ2h0KCkgeyByZXR1cm4gdGhpcy5zZWNvbmRhcnlFZGl0b3JQYW5lID8gdGhpcy5zZWNvbmRhcnlFZGl0b3JQYW5lLm1pbmltdW1IZWlnaHQgOiAwOyB9XG5cdHByaXZhdGUgZ2V0IG1heGltdW1TZWNvbmRhcnlIZWlnaHQoKSB7IHJldHVybiB0aGlzLnNlY29uZGFyeUVkaXRvclBhbmUgPyB0aGlzLnNlY29uZGFyeUVkaXRvclBhbmUubWF4aW11bUhlaWdodCA6IE51bWJlci5QT1NJVElWRV9JTkZJTklUWTsgfVxuXG5cdG92ZXJyaWRlIHNldCBtaW5pbXVtV2lkdGgodmFsdWU6IG51bWJlcikgeyAvKiBub29wICovIH1cblx0b3ZlcnJpZGUgc2V0IG1heGltdW1XaWR0aCh2YWx1ZTogbnVtYmVyKSB7IC8qIG5vb3AgKi8gfVxuXHRvdmVycmlkZSBzZXQgbWluaW11bUhlaWdodCh2YWx1ZTogbnVtYmVyKSB7IC8qIG5vb3AgKi8gfVxuXHRvdmVycmlkZSBzZXQgbWF4aW11bUhlaWdodCh2YWx1ZTogbnVtYmVyKSB7IC8qIG5vb3AgKi8gfVxuXG5cdG92ZXJyaWRlIGdldCBtaW5pbXVtV2lkdGgoKSB7IHJldHVybiB0aGlzLm1pbmltdW1QcmltYXJ5V2lkdGggKyB0aGlzLm1pbmltdW1TZWNvbmRhcnlXaWR0aDsgfVxuXHRvdmVycmlkZSBnZXQgbWF4aW11bVdpZHRoKCkgeyByZXR1cm4gdGhpcy5tYXhpbXVtUHJpbWFyeVdpZHRoICsgdGhpcy5tYXhpbXVtU2Vjb25kYXJ5V2lkdGg7IH1cblx0b3ZlcnJpZGUgZ2V0IG1pbmltdW1IZWlnaHQoKSB7IHJldHVybiB0aGlzLm1pbmltdW1QcmltYXJ5SGVpZ2h0ICsgdGhpcy5taW5pbXVtU2Vjb25kYXJ5SGVpZ2h0OyB9XG5cdG92ZXJyaWRlIGdldCBtYXhpbXVtSGVpZ2h0KCkgeyByZXR1cm4gdGhpcy5tYXhpbXVtUHJpbWFyeUhlaWdodCArIHRoaXMubWF4aW11bVNlY29uZGFyeUhlaWdodDsgfVxuXG5cdHByaXZhdGUgX2JvdW5kYXJ5U2FzaGVzOiBJQm91bmRhcnlTYXNoZXMgfCB1bmRlZmluZWQ7XG5cblx0Ly8jZW5kcmVnaW9uXG5cblx0Ly8jcmVnaW9uIEV2ZW50c1xuXG5cdHByaXZhdGUgb25EaWRDcmVhdGVFZGl0b3JzID0gdGhpcy5fcmVnaXN0ZXIobmV3IEVtaXR0ZXI8eyB3aWR0aDogbnVtYmVyOyBoZWlnaHQ6IG51bWJlciB9IHwgdW5kZWZpbmVkPigpKTtcblxuXHRwcml2YXRlIF9vbkRpZENoYW5nZVNpemVDb25zdHJhaW50cyA9IHRoaXMuX3JlZ2lzdGVyKG5ldyBSZWxheTx7IHdpZHRoOiBudW1iZXI7IGhlaWdodDogbnVtYmVyIH0gfCB1bmRlZmluZWQ+KCkpO1xuXHRvdmVycmlkZSByZWFkb25seSBvbkRpZENoYW5nZVNpemVDb25zdHJhaW50cyA9IEV2ZW50LmFueSh0aGlzLm9uRGlkQ3JlYXRlRWRpdG9ycy5ldmVudCwgdGhpcy5fb25EaWRDaGFuZ2VTaXplQ29uc3RyYWludHMuZXZlbnQpO1xuXG5cdHByaXZhdGUgcmVhZG9ubHkgX29uRGlkQ2hhbmdlU2VsZWN0aW9uID0gdGhpcy5fcmVnaXN0ZXIobmV3IEVtaXR0ZXI8SUVkaXRvclBhbmVTZWxlY3Rpb25DaGFuZ2VFdmVudD4oKSk7XG5cdHJlYWRvbmx5IG9uRGlkQ2hhbmdlU2VsZWN0aW9uID0gdGhpcy5fb25EaWRDaGFuZ2VTZWxlY3Rpb24uZXZlbnQ7XG5cblx0Ly8jZW5kcmVnaW9uXG5cblx0cHJpdmF0ZSBwcmltYXJ5RWRpdG9yUGFuZTogRWRpdG9yUGFuZSB8IHVuZGVmaW5lZCA9IHVuZGVmaW5lZDtcblx0cHJpdmF0ZSBzZWNvbmRhcnlFZGl0b3JQYW5lOiBFZGl0b3JQYW5lIHwgdW5kZWZpbmVkID0gdW5kZWZpbmVkO1xuXG5cdHByaXZhdGUgcHJpbWFyeUVkaXRvckNvbnRhaW5lcjogSFRNTEVsZW1lbnQgfCB1bmRlZmluZWQ7XG5cdHByaXZhdGUgc2Vjb25kYXJ5RWRpdG9yQ29udGFpbmVyOiBIVE1MRWxlbWVudCB8IHVuZGVmaW5lZDtcblxuXHRwcml2YXRlIHNwbGl0dmlldzogU3BsaXRWaWV3IHwgdW5kZWZpbmVkO1xuXG5cdHByaXZhdGUgcmVhZG9ubHkgc3BsaXR2aWV3RGlzcG9zYWJsZXMgPSB0aGlzLl9yZWdpc3RlcihuZXcgRGlzcG9zYWJsZVN0b3JlKCkpO1xuXHRwcml2YXRlIHJlYWRvbmx5IGVkaXRvckRpc3Bvc2FibGVzID0gdGhpcy5fcmVnaXN0ZXIobmV3IERpc3Bvc2FibGVTdG9yZSgpKTtcblxuXHRwcml2YXRlIG9yaWVudGF0aW9uOiBPcmllbnRhdGlvbjtcblx0cHJpdmF0ZSBkaW1lbnNpb24gPSBuZXcgRGltZW5zaW9uKDAsIDApO1xuXG5cdHByaXZhdGUgbGFzdEZvY3VzZWRTaWRlOiBTaWRlLlBSSU1BUlkgfCBTaWRlLlNFQ09OREFSWSB8IHVuZGVmaW5lZCA9IHVuZGVmaW5lZDtcblxuXHRjb25zdHJ1Y3Rvcihcblx0XHRncm91cDogSUVkaXRvckdyb3VwLFxuXHRcdEBJVGVsZW1ldHJ5U2VydmljZSB0ZWxlbWV0cnlTZXJ2aWNlOiBJVGVsZW1ldHJ5U2VydmljZSxcblx0XHRASUluc3RhbnRpYXRpb25TZXJ2aWNlIGluc3RhbnRpYXRpb25TZXJ2aWNlOiBJSW5zdGFudGlhdGlvblNlcnZpY2UsXG5cdFx0QElUaGVtZVNlcnZpY2UgdGhlbWVTZXJ2aWNlOiBJVGhlbWVTZXJ2aWNlLFxuXHRcdEBJU3RvcmFnZVNlcnZpY2Ugc3RvcmFnZVNlcnZpY2U6IElTdG9yYWdlU2VydmljZSxcblx0XHRASUNvbmZpZ3VyYXRpb25TZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgY29uZmlndXJhdGlvblNlcnZpY2U6IElDb25maWd1cmF0aW9uU2VydmljZSxcblx0XHRASVRleHRSZXNvdXJjZUNvbmZpZ3VyYXRpb25TZXJ2aWNlIHRleHRSZXNvdXJjZUNvbmZpZ3VyYXRpb25TZXJ2aWNlOiBJVGV4dFJlc291cmNlQ29uZmlndXJhdGlvblNlcnZpY2UsXG5cdFx0QElFZGl0b3JTZXJ2aWNlIGVkaXRvclNlcnZpY2U6IElFZGl0b3JTZXJ2aWNlLFxuXHRcdEBJRWRpdG9yR3JvdXBzU2VydmljZSBlZGl0b3JHcm91cFNlcnZpY2U6IElFZGl0b3JHcm91cHNTZXJ2aWNlXG5cdCkge1xuXHRcdHN1cGVyKFNpZGVCeVNpZGVFZGl0b3IuSUQsIGdyb3VwLCBTaWRlQnlTaWRlRWRpdG9yLlZJRVdfU1RBVEVfUFJFRkVSRU5DRV9LRVksIHRlbGVtZXRyeVNlcnZpY2UsIGluc3RhbnRpYXRpb25TZXJ2aWNlLCBzdG9yYWdlU2VydmljZSwgdGV4dFJlc291cmNlQ29uZmlndXJhdGlvblNlcnZpY2UsIHRoZW1lU2VydmljZSwgZWRpdG9yU2VydmljZSwgZWRpdG9yR3JvdXBTZXJ2aWNlKTtcblxuXHRcdHRoaXMub3JpZW50YXRpb24gPSB0aGlzLmNvbmZpZ3VyYXRpb25TZXJ2aWNlLmdldFZhbHVlPCd2ZXJ0aWNhbCcgfCAnaG9yaXpvbnRhbCc+KFNpZGVCeVNpZGVFZGl0b3IuU0lERV9CWV9TSURFX0xBWU9VVF9TRVRUSU5HKSA9PT0gJ3ZlcnRpY2FsJyA/IE9yaWVudGF0aW9uLlZFUlRJQ0FMIDogT3JpZW50YXRpb24uSE9SSVpPTlRBTDtcblxuXHRcdHRoaXMucmVnaXN0ZXJMaXN0ZW5lcnMoKTtcblx0fVxuXG5cdHByaXZhdGUgcmVnaXN0ZXJMaXN0ZW5lcnMoKTogdm9pZCB7XG5cdFx0dGhpcy5fcmVnaXN0ZXIodGhpcy5jb25maWd1cmF0aW9uU2VydmljZS5vbkRpZENoYW5nZUNvbmZpZ3VyYXRpb24oZSA9PiB0aGlzLm9uQ29uZmlndXJhdGlvblVwZGF0ZWQoZSkpKTtcblx0fVxuXG5cdHByaXZhdGUgb25Db25maWd1cmF0aW9uVXBkYXRlZChldmVudDogSUNvbmZpZ3VyYXRpb25DaGFuZ2VFdmVudCk6IHZvaWQge1xuXHRcdGlmIChldmVudC5hZmZlY3RzQ29uZmlndXJhdGlvbihTaWRlQnlTaWRlRWRpdG9yLlNJREVfQllfU0lERV9MQVlPVVRfU0VUVElORykpIHtcblx0XHRcdHRoaXMub3JpZW50YXRpb24gPSB0aGlzLmNvbmZpZ3VyYXRpb25TZXJ2aWNlLmdldFZhbHVlPCd2ZXJ0aWNhbCcgfCAnaG9yaXpvbnRhbCc+KFNpZGVCeVNpZGVFZGl0b3IuU0lERV9CWV9TSURFX0xBWU9VVF9TRVRUSU5HKSA9PT0gJ3ZlcnRpY2FsJyA/IE9yaWVudGF0aW9uLlZFUlRJQ0FMIDogT3JpZW50YXRpb24uSE9SSVpPTlRBTDtcblxuXHRcdFx0Ly8gSWYgY29uZmlnIHVwZGF0ZWQgZnJvbSBldmVudCwgcmUtY3JlYXRlIHRoZSBzcGxpdFxuXHRcdFx0Ly8gZWRpdG9yIHVzaW5nIHRoZSBuZXcgbGF5b3V0IG9yaWVudGF0aW9uIGlmIGl0IHdhc1xuXHRcdFx0Ly8gYWxyZWFkeSBjcmVhdGVkLlxuXHRcdFx0aWYgKHRoaXMuc3BsaXR2aWV3KSB7XG5cdFx0XHRcdHRoaXMucmVjcmVhdGVTcGxpdHZpZXcoKTtcblx0XHRcdH1cblx0XHR9XG5cdH1cblxuXHRwcml2YXRlIHJlY3JlYXRlU3BsaXR2aWV3KCk6IHZvaWQge1xuXHRcdGNvbnN0IGNvbnRhaW5lciA9IGFzc2VydElzRGVmaW5lZCh0aGlzLmdldENvbnRhaW5lcigpKTtcblxuXHRcdC8vIENsZWFyIG9sZCAoaWYgYW55KSBidXQgcmVtZW1iZXIgcmF0aW9cblx0XHRjb25zdCByYXRpbyA9IHRoaXMuZ2V0U3BsaXRWaWV3UmF0aW8oKTtcblx0XHRpZiAodGhpcy5zcGxpdHZpZXcpIHtcblx0XHRcdHRoaXMuc3BsaXR2aWV3LmVsLnJlbW92ZSgpO1xuXHRcdFx0dGhpcy5zcGxpdHZpZXdEaXNwb3NhYmxlcy5jbGVhcigpO1xuXHRcdH1cblxuXHRcdC8vIENyZWF0ZSBuZXdcblx0XHR0aGlzLmNyZWF0ZVNwbGl0Vmlldyhjb250YWluZXIsIHJhdGlvKTtcblxuXHRcdHRoaXMubGF5b3V0KHRoaXMuZGltZW5zaW9uKTtcblx0fVxuXG5cdHByaXZhdGUgZ2V0U3BsaXRWaWV3UmF0aW8oKTogbnVtYmVyIHwgdW5kZWZpbmVkIHtcblx0XHRsZXQgcmF0aW86IG51bWJlciB8IHVuZGVmaW5lZCA9IHVuZGVmaW5lZDtcblxuXHRcdGlmICh0aGlzLnNwbGl0dmlldykge1xuXHRcdFx0Y29uc3QgbGVmdFZpZXdTaXplID0gdGhpcy5zcGxpdHZpZXcuZ2V0Vmlld1NpemUoMCk7XG5cdFx0XHRjb25zdCByaWdodFZpZXdTaXplID0gdGhpcy5zcGxpdHZpZXcuZ2V0Vmlld1NpemUoMSk7XG5cblx0XHRcdC8vIE9ubHkgcmV0dXJuIGEgcmF0aW8gd2hlbiB0aGUgdmlldyBzaXplIGlzIHNpZ25pZmljYW50bHlcblx0XHRcdC8vIGVub3VnaCBkaWZmZXJlbnQgZm9yIGxlZnQgYW5kIHJpZ2h0IHZpZXcgc2l6ZXNcblx0XHRcdGlmIChNYXRoLmFicyhsZWZ0Vmlld1NpemUgLSByaWdodFZpZXdTaXplKSA+IDEpIHtcblx0XHRcdFx0Y29uc3QgdG90YWxTaXplID0gdGhpcy5zcGxpdHZpZXcub3JpZW50YXRpb24gPT09IE9yaWVudGF0aW9uLkhPUklaT05UQUwgPyB0aGlzLmRpbWVuc2lvbi53aWR0aCA6IHRoaXMuZGltZW5zaW9uLmhlaWdodDtcblx0XHRcdFx0cmF0aW8gPSBsZWZ0Vmlld1NpemUgLyB0b3RhbFNpemU7XG5cdFx0XHR9XG5cdFx0fVxuXG5cdFx0cmV0dXJuIHJhdGlvO1xuXHR9XG5cblx0cHJvdGVjdGVkIGNyZWF0ZUVkaXRvcihwYXJlbnQ6IEhUTUxFbGVtZW50KTogdm9pZCB7XG5cdFx0cGFyZW50LmNsYXNzTGlzdC5hZGQoJ3NpZGUtYnktc2lkZS1lZGl0b3InKTtcblxuXHRcdC8vIEVkaXRvciBwYW5lIGNvbnRhaW5lcnNcblx0XHR0aGlzLnNlY29uZGFyeUVkaXRvckNvbnRhaW5lciA9ICQoJy5zaWRlLWJ5LXNpZGUtZWRpdG9yLWNvbnRhaW5lci5lZGl0b3ItaW5zdGFuY2UnKTtcblx0XHR0aGlzLnByaW1hcnlFZGl0b3JDb250YWluZXIgPSAkKCcuc2lkZS1ieS1zaWRlLWVkaXRvci1jb250YWluZXIuZWRpdG9yLWluc3RhbmNlJyk7XG5cblx0XHQvLyBTcGxpdCB2aWV3XG5cdFx0dGhpcy5jcmVhdGVTcGxpdFZpZXcocGFyZW50KTtcblx0fVxuXG5cdHByaXZhdGUgY3JlYXRlU3BsaXRWaWV3KHBhcmVudDogSFRNTEVsZW1lbnQsIHJhdGlvPzogbnVtYmVyKTogdm9pZCB7XG5cblx0XHQvLyBTcGxpdHZpZXcgd2lkZ2V0XG5cdFx0dGhpcy5zcGxpdHZpZXcgPSB0aGlzLnNwbGl0dmlld0Rpc3Bvc2FibGVzLmFkZChuZXcgU3BsaXRWaWV3KHBhcmVudCwgeyBvcmllbnRhdGlvbjogdGhpcy5vcmllbnRhdGlvbiB9KSk7XG5cdFx0dGhpcy5zcGxpdHZpZXdEaXNwb3NhYmxlcy5hZGQodGhpcy5zcGxpdHZpZXcub25EaWRTYXNoUmVzZXQoKCkgPT4gdGhpcy5zcGxpdHZpZXc/LmRpc3RyaWJ1dGVWaWV3U2l6ZXMoKSkpO1xuXG5cdFx0aWYgKHRoaXMub3JpZW50YXRpb24gPT09IE9yaWVudGF0aW9uLkhPUklaT05UQUwpIHtcblx0XHRcdHRoaXMuc3BsaXR2aWV3Lm9ydGhvZ29uYWxFbmRTYXNoID0gdGhpcy5fYm91bmRhcnlTYXNoZXM/LmJvdHRvbTtcblx0XHR9IGVsc2Uge1xuXHRcdFx0dGhpcy5zcGxpdHZpZXcub3J0aG9nb25hbFN0YXJ0U2FzaCA9IHRoaXMuX2JvdW5kYXJ5U2FzaGVzPy5sZWZ0O1xuXHRcdFx0dGhpcy5zcGxpdHZpZXcub3J0aG9nb25hbEVuZFNhc2ggPSB0aGlzLl9ib3VuZGFyeVNhc2hlcz8ucmlnaHQ7XG5cdFx0fVxuXG5cdFx0Ly8gRmlndXJlIG91dCBzaXppbmdcblx0XHRsZXQgbGVmdFNpemluZzogbnVtYmVyIHwgU2l6aW5nID0gU2l6aW5nLkRpc3RyaWJ1dGU7XG5cdFx0bGV0IHJpZ2h0U2l6aW5nOiBudW1iZXIgfCBTaXppbmcgPSBTaXppbmcuRGlzdHJpYnV0ZTtcblx0XHRpZiAocmF0aW8pIHtcblx0XHRcdGNvbnN0IHRvdGFsU2l6ZSA9IHRoaXMuc3BsaXR2aWV3Lm9yaWVudGF0aW9uID09PSBPcmllbnRhdGlvbi5IT1JJWk9OVEFMID8gdGhpcy5kaW1lbnNpb24ud2lkdGggOiB0aGlzLmRpbWVuc2lvbi5oZWlnaHQ7XG5cblx0XHRcdGxlZnRTaXppbmcgPSBNYXRoLnJvdW5kKHRvdGFsU2l6ZSAqIHJhdGlvKTtcblx0XHRcdHJpZ2h0U2l6aW5nID0gdG90YWxTaXplIC0gbGVmdFNpemluZztcblxuXHRcdFx0Ly8gV2UgbmVlZCB0byBjYWxsIGBsYXlvdXRgIGZvciB0aGUgYHJhdGlvYCB0byBoYXZlIGFueSBlZmZlY3Rcblx0XHRcdHRoaXMuc3BsaXR2aWV3LmxheW91dCh0aGlzLm9yaWVudGF0aW9uID09PSBPcmllbnRhdGlvbi5IT1JJWk9OVEFMID8gdGhpcy5kaW1lbnNpb24ud2lkdGggOiB0aGlzLmRpbWVuc2lvbi5oZWlnaHQpO1xuXHRcdH1cblxuXHRcdC8vIFNlY29uZGFyeSAobGVmdClcblx0XHRjb25zdCBzZWNvbmRhcnlFZGl0b3JDb250YWluZXIgPSBhc3NlcnRJc0RlZmluZWQodGhpcy5zZWNvbmRhcnlFZGl0b3JDb250YWluZXIpO1xuXHRcdHRoaXMuc3BsaXR2aWV3LmFkZFZpZXcoe1xuXHRcdFx0ZWxlbWVudDogc2Vjb25kYXJ5RWRpdG9yQ29udGFpbmVyLFxuXHRcdFx0bGF5b3V0OiBzaXplID0+IHRoaXMubGF5b3V0UGFuZSh0aGlzLnNlY29uZGFyeUVkaXRvclBhbmUsIHNpemUpLFxuXHRcdFx0bWluaW11bVNpemU6IHRoaXMub3JpZW50YXRpb24gPT09IE9yaWVudGF0aW9uLkhPUklaT05UQUwgPyBERUZBVUxUX0VESVRPUl9NSU5fRElNRU5TSU9OUy53aWR0aCA6IERFRkFVTFRfRURJVE9SX01JTl9ESU1FTlNJT05TLmhlaWdodCxcblx0XHRcdG1heGltdW1TaXplOiBOdW1iZXIuUE9TSVRJVkVfSU5GSU5JVFksXG5cdFx0XHRvbkRpZENoYW5nZTogRXZlbnQuTm9uZVxuXHRcdH0sIGxlZnRTaXppbmcpO1xuXG5cdFx0Ly8gUHJpbWFyeSAocmlnaHQpXG5cdFx0Y29uc3QgcHJpbWFyeUVkaXRvckNvbnRhaW5lciA9IGFzc2VydElzRGVmaW5lZCh0aGlzLnByaW1hcnlFZGl0b3JDb250YWluZXIpO1xuXHRcdHRoaXMuc3BsaXR2aWV3LmFkZFZpZXcoe1xuXHRcdFx0ZWxlbWVudDogcHJpbWFyeUVkaXRvckNvbnRhaW5lcixcblx0XHRcdGxheW91dDogc2l6ZSA9PiB0aGlzLmxheW91dFBhbmUodGhpcy5wcmltYXJ5RWRpdG9yUGFuZSwgc2l6ZSksXG5cdFx0XHRtaW5pbXVtU2l6ZTogdGhpcy5vcmllbnRhdGlvbiA9PT0gT3JpZW50YXRpb24uSE9SSVpPTlRBTCA/IERFRkFVTFRfRURJVE9SX01JTl9ESU1FTlNJT05TLndpZHRoIDogREVGQVVMVF9FRElUT1JfTUlOX0RJTUVOU0lPTlMuaGVpZ2h0LFxuXHRcdFx0bWF4aW11bVNpemU6IE51bWJlci5QT1NJVElWRV9JTkZJTklUWSxcblx0XHRcdG9uRGlkQ2hhbmdlOiBFdmVudC5Ob25lXG5cdFx0fSwgcmlnaHRTaXppbmcpO1xuXG5cdFx0dGhpcy51cGRhdGVTdHlsZXMoKTtcblx0fVxuXG5cdG92ZXJyaWRlIGdldFRpdGxlKCk6IHN0cmluZyB7XG5cdFx0aWYgKHRoaXMuaW5wdXQpIHtcblx0XHRcdHJldHVybiB0aGlzLmlucHV0LmdldE5hbWUoKTtcblx0XHR9XG5cblx0XHRyZXR1cm4gbG9jYWxpemUoJ3NpZGVCeVNpZGVFZGl0b3InLCBcIlNpZGUgYnkgU2lkZSBFZGl0b3JcIik7XG5cdH1cblxuXHRvdmVycmlkZSBhc3luYyBzZXRJbnB1dChpbnB1dDogU2lkZUJ5U2lkZUVkaXRvcklucHV0LCBvcHRpb25zOiBJU2lkZUJ5U2lkZUVkaXRvck9wdGlvbnMgfCB1bmRlZmluZWQsIGNvbnRleHQ6IElFZGl0b3JPcGVuQ29udGV4dCwgdG9rZW46IENhbmNlbGxhdGlvblRva2VuKTogUHJvbWlzZTx2b2lkPiB7XG5cdFx0Y29uc3Qgb2xkSW5wdXQgPSB0aGlzLmlucHV0O1xuXHRcdGF3YWl0IHN1cGVyLnNldElucHV0KGlucHV0LCBvcHRpb25zLCBjb250ZXh0LCB0b2tlbik7XG5cblx0XHQvLyBDcmVhdGUgbmV3IHNpZGUgYnkgc2lkZSBlZGl0b3JzIGlmIGVpdGhlciB3ZSBoYXZlIG5vdFxuXHRcdC8vIGJlZW4gY3JlYXRlZCBiZWZvcmUgb3IgdGhlIGlucHV0IG5vIGxvbmdlciBtYXRjaGVzLlxuXHRcdGlmICghb2xkSW5wdXQgfHwgIWlucHV0Lm1hdGNoZXMob2xkSW5wdXQpKSB7XG5cdFx0XHRpZiAob2xkSW5wdXQpIHtcblx0XHRcdFx0dGhpcy5kaXNwb3NlRWRpdG9ycygpO1xuXHRcdFx0fVxuXG5cdFx0XHR0aGlzLmNyZWF0ZUVkaXRvcnMoaW5wdXQpO1xuXHRcdH1cblxuXHRcdC8vIFJlc3RvcmUgYW55IHByZXZpb3VzIHZpZXcgc3RhdGVcblx0XHRjb25zdCB7IHByaW1hcnksIHNlY29uZGFyeSwgdmlld1N0YXRlIH0gPSB0aGlzLmxvYWRWaWV3U3RhdGUoaW5wdXQsIG9wdGlvbnMsIGNvbnRleHQpO1xuXHRcdHRoaXMubGFzdEZvY3VzZWRTaWRlID0gdmlld1N0YXRlPy5mb2N1cztcblxuXHRcdGlmICh0eXBlb2Ygdmlld1N0YXRlPy5yYXRpbyA9PT0gJ251bWJlcicgJiYgdGhpcy5zcGxpdHZpZXcpIHtcblx0XHRcdGNvbnN0IHRvdGFsU2l6ZSA9IHRoaXMuc3BsaXR2aWV3Lm9yaWVudGF0aW9uID09PSBPcmllbnRhdGlvbi5IT1JJWk9OVEFMID8gdGhpcy5kaW1lbnNpb24ud2lkdGggOiB0aGlzLmRpbWVuc2lvbi5oZWlnaHQ7XG5cblx0XHRcdHRoaXMuc3BsaXR2aWV3LnJlc2l6ZVZpZXcoMCwgTWF0aC5yb3VuZCh0b3RhbFNpemUgKiB2aWV3U3RhdGUucmF0aW8pKTtcblx0XHR9IGVsc2Uge1xuXHRcdFx0dGhpcy5zcGxpdHZpZXc/LmRpc3RyaWJ1dGVWaWV3U2l6ZXMoKTtcblx0XHR9XG5cblx0XHQvLyBTZXQgaW5wdXQgdG8gYm90aCBzaWRlc1xuXHRcdGF3YWl0IFByb21pc2UuYWxsKFtcblx0XHRcdHRoaXMuc2Vjb25kYXJ5RWRpdG9yUGFuZT8uc2V0SW5wdXQoaW5wdXQuc2Vjb25kYXJ5LCBzZWNvbmRhcnksIGNvbnRleHQsIHRva2VuKSxcblx0XHRcdHRoaXMucHJpbWFyeUVkaXRvclBhbmU/LnNldElucHV0KGlucHV0LnByaW1hcnksIHByaW1hcnksIGNvbnRleHQsIHRva2VuKVxuXHRcdF0pO1xuXG5cdFx0Ly8gVXBkYXRlIGZvY3VzIGlmIHRhcmdldCBpcyBwcm92aWRlZFxuXHRcdGlmICh0eXBlb2Ygb3B0aW9ucz8udGFyZ2V0ID09PSAnbnVtYmVyJykge1xuXHRcdFx0dGhpcy5sYXN0Rm9jdXNlZFNpZGUgPSBvcHRpb25zLnRhcmdldDtcblx0XHR9XG5cdH1cblxuXHRwcml2YXRlIGxvYWRWaWV3U3RhdGUoaW5wdXQ6IFNpZGVCeVNpZGVFZGl0b3JJbnB1dCwgb3B0aW9uczogSVNpZGVCeVNpZGVFZGl0b3JPcHRpb25zIHwgdW5kZWZpbmVkLCBjb250ZXh0OiBJRWRpdG9yT3BlbkNvbnRleHQpOiB7IHByaW1hcnk6IElFZGl0b3JPcHRpb25zIHwgdW5kZWZpbmVkOyBzZWNvbmRhcnk6IElFZGl0b3JPcHRpb25zIHwgdW5kZWZpbmVkOyB2aWV3U3RhdGU6IElTaWRlQnlTaWRlRWRpdG9yVmlld1N0YXRlIHwgdW5kZWZpbmVkIH0ge1xuXHRcdGNvbnN0IHZpZXdTdGF0ZSA9IGlzU2lkZUJ5U2lkZUVkaXRvclZpZXdTdGF0ZShvcHRpb25zPy52aWV3U3RhdGUpID8gb3B0aW9ucz8udmlld1N0YXRlIDogdGhpcy5sb2FkRWRpdG9yVmlld1N0YXRlKGlucHV0LCBjb250ZXh0KTtcblxuXHRcdGxldCBwcmltYXJ5T3B0aW9uczogSUVkaXRvck9wdGlvbnMgPSBPYmplY3QuY3JlYXRlKG51bGwpO1xuXHRcdGxldCBzZWNvbmRhcnlPcHRpb25zOiBJRWRpdG9yT3B0aW9ucyB8IHVuZGVmaW5lZCA9IHVuZGVmaW5lZDtcblxuXHRcdC8vIERlcGVuZGluZyBvbiB0aGUgb3B0aW9uYWwgYHRhcmdldGAgcHJvcGVydHksIHdlIGFwcGx5XG5cdFx0Ly8gdGhlIHByb3ZpZGVkIG9wdGlvbnMgdG8gZWl0aGVyIHRoZSBwcmltYXJ5IG9yIHNlY29uZGFyeVxuXHRcdC8vIHNpZGVcblxuXHRcdGlmIChvcHRpb25zPy50YXJnZXQgPT09IFNpZGUuU0VDT05EQVJZKSB7XG5cdFx0XHRzZWNvbmRhcnlPcHRpb25zID0geyAuLi5vcHRpb25zIH07XG5cdFx0fSBlbHNlIHtcblx0XHRcdHByaW1hcnlPcHRpb25zID0geyAuLi5vcHRpb25zIH07XG5cdFx0fVxuXG5cdFx0cHJpbWFyeU9wdGlvbnMudmlld1N0YXRlID0gdmlld1N0YXRlPy5wcmltYXJ5O1xuXG5cdFx0aWYgKHZpZXdTdGF0ZT8uc2Vjb25kYXJ5KSB7XG5cdFx0XHRpZiAoIXNlY29uZGFyeU9wdGlvbnMpIHtcblx0XHRcdFx0c2Vjb25kYXJ5T3B0aW9ucyA9IHsgdmlld1N0YXRlOiB2aWV3U3RhdGUuc2Vjb25kYXJ5IH07XG5cdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRzZWNvbmRhcnlPcHRpb25zLnZpZXdTdGF0ZSA9IHZpZXdTdGF0ZT8uc2Vjb25kYXJ5O1xuXHRcdFx0fVxuXHRcdH1cblxuXHRcdHJldHVybiB7IHByaW1hcnk6IHByaW1hcnlPcHRpb25zLCBzZWNvbmRhcnk6IHNlY29uZGFyeU9wdGlvbnMsIHZpZXdTdGF0ZSB9O1xuXHR9XG5cblx0cHJpdmF0ZSBjcmVhdGVFZGl0b3JzKG5ld0lucHV0OiBTaWRlQnlTaWRlRWRpdG9ySW5wdXQpOiB2b2lkIHtcblxuXHRcdC8vIENyZWF0ZSBlZGl0b3JzXG5cdFx0dGhpcy5zZWNvbmRhcnlFZGl0b3JQYW5lID0gdGhpcy5kb0NyZWF0ZUVkaXRvcihuZXdJbnB1dC5zZWNvbmRhcnksIGFzc2VydElzRGVmaW5lZCh0aGlzLnNlY29uZGFyeUVkaXRvckNvbnRhaW5lcikpO1xuXHRcdHRoaXMucHJpbWFyeUVkaXRvclBhbmUgPSB0aGlzLmRvQ3JlYXRlRWRpdG9yKG5ld0lucHV0LnByaW1hcnksIGFzc2VydElzRGVmaW5lZCh0aGlzLnByaW1hcnlFZGl0b3JDb250YWluZXIpKTtcblxuXHRcdC8vIExheW91dFxuXHRcdHRoaXMubGF5b3V0KHRoaXMuZGltZW5zaW9uKTtcblxuXHRcdC8vIEV2ZW50aW5nXG5cdFx0dGhpcy5fb25EaWRDaGFuZ2VTaXplQ29uc3RyYWludHMuaW5wdXQgPSBFdmVudC5hbnkoXG5cdFx0XHRFdmVudC5tYXAodGhpcy5zZWNvbmRhcnlFZGl0b3JQYW5lLm9uRGlkQ2hhbmdlU2l6ZUNvbnN0cmFpbnRzLCAoKSA9PiB1bmRlZmluZWQpLFxuXHRcdFx0RXZlbnQubWFwKHRoaXMucHJpbWFyeUVkaXRvclBhbmUub25EaWRDaGFuZ2VTaXplQ29uc3RyYWludHMsICgpID0+IHVuZGVmaW5lZClcblx0XHQpO1xuXHRcdHRoaXMub25EaWRDcmVhdGVFZGl0b3JzLmZpcmUodW5kZWZpbmVkKTtcblxuXHRcdC8vIFRyYWNrIGZvY3VzIGFuZCBzaWduYWwgYWN0aXZlIGNvbnRyb2wgY2hhbmdlIHZpYSBldmVudFxuXHRcdHRoaXMuZWRpdG9yRGlzcG9zYWJsZXMuYWRkKHRoaXMucHJpbWFyeUVkaXRvclBhbmUub25EaWRGb2N1cygoKSA9PiB0aGlzLm9uRGlkRm9jdXNDaGFuZ2UoU2lkZS5QUklNQVJZKSkpO1xuXHRcdHRoaXMuZWRpdG9yRGlzcG9zYWJsZXMuYWRkKHRoaXMuc2Vjb25kYXJ5RWRpdG9yUGFuZS5vbkRpZEZvY3VzKCgpID0+IHRoaXMub25EaWRGb2N1c0NoYW5nZShTaWRlLlNFQ09OREFSWSkpKTtcblx0fVxuXG5cdHByaXZhdGUgZG9DcmVhdGVFZGl0b3IoZWRpdG9ySW5wdXQ6IEVkaXRvcklucHV0LCBjb250YWluZXI6IEhUTUxFbGVtZW50KTogRWRpdG9yUGFuZSB7XG5cdFx0Y29uc3QgZWRpdG9yUGFuZURlc2NyaXB0b3IgPSBSZWdpc3RyeS5hczxJRWRpdG9yUGFuZVJlZ2lzdHJ5PihFZGl0b3JFeHRlbnNpb25zLkVkaXRvclBhbmUpLmdldEVkaXRvclBhbmUoZWRpdG9ySW5wdXQpO1xuXHRcdGlmICghZWRpdG9yUGFuZURlc2NyaXB0b3IpIHtcblx0XHRcdHRocm93IG5ldyBFcnJvcignTm8gZWRpdG9yIHBhbmUgZGVzY3JpcHRvciBmb3IgZWRpdG9yIGZvdW5kJyk7XG5cdFx0fVxuXG5cdFx0Ly8gQ3JlYXRlIGVkaXRvciBwYW5lIGFuZCBtYWtlIHZpc2libGVcblx0XHRjb25zdCBlZGl0b3JQYW5lID0gZWRpdG9yUGFuZURlc2NyaXB0b3IuaW5zdGFudGlhdGUodGhpcy5pbnN0YW50aWF0aW9uU2VydmljZSwgdGhpcy5ncm91cCk7XG5cdFx0ZWRpdG9yUGFuZS5jcmVhdGUoY29udGFpbmVyKTtcblx0XHRlZGl0b3JQYW5lLnNldFZpc2libGUodGhpcy5pc1Zpc2libGUoKSk7XG5cblx0XHQvLyBUcmFjayBzZWxlY3Rpb25zIGlmIHN1cHBvcnRlZFxuXHRcdGlmIChpc0VkaXRvclBhbmVXaXRoU2VsZWN0aW9uKGVkaXRvclBhbmUpKSB7XG5cdFx0XHR0aGlzLmVkaXRvckRpc3Bvc2FibGVzLmFkZChlZGl0b3JQYW5lLm9uRGlkQ2hhbmdlU2VsZWN0aW9uKGUgPT4gdGhpcy5fb25EaWRDaGFuZ2VTZWxlY3Rpb24uZmlyZShlKSkpO1xuXHRcdH1cblxuXHRcdC8vIFRyYWNrIGZvciBkaXNwb3NhbFxuXHRcdHRoaXMuZWRpdG9yRGlzcG9zYWJsZXMuYWRkKGVkaXRvclBhbmUpO1xuXG5cdFx0cmV0dXJuIGVkaXRvclBhbmU7XG5cdH1cblxuXHRwcml2YXRlIG9uRGlkRm9jdXNDaGFuZ2Uoc2lkZTogU2lkZS5QUklNQVJZIHwgU2lkZS5TRUNPTkRBUlkpOiB2b2lkIHtcblx0XHR0aGlzLmxhc3RGb2N1c2VkU2lkZSA9IHNpZGU7XG5cblx0XHQvLyBTaWduYWwgdG8gb3V0c2lkZSB0aGF0IG91ciBhY3RpdmUgY29udHJvbCBjaGFuZ2VkXG5cdFx0dGhpcy5fb25EaWRDaGFuZ2VDb250cm9sLmZpcmUoKTtcblx0fVxuXG5cdGdldFNlbGVjdGlvbigpOiBJRWRpdG9yUGFuZVNlbGVjdGlvbiB8IHVuZGVmaW5lZCB7XG5cdFx0Y29uc3QgbGFzdEZvY3VzZWRFZGl0b3JQYW5lID0gdGhpcy5nZXRMYXN0Rm9jdXNlZEVkaXRvclBhbmUoKTtcblx0XHRpZiAoaXNFZGl0b3JQYW5lV2l0aFNlbGVjdGlvbihsYXN0Rm9jdXNlZEVkaXRvclBhbmUpKSB7XG5cdFx0XHRjb25zdCBzZWxlY3Rpb24gPSBsYXN0Rm9jdXNlZEVkaXRvclBhbmUuZ2V0U2VsZWN0aW9uKCk7XG5cdFx0XHRpZiAoc2VsZWN0aW9uKSB7XG5cdFx0XHRcdHJldHVybiBuZXcgU2lkZUJ5U2lkZUF3YXJlRWRpdG9yUGFuZVNlbGVjdGlvbihzZWxlY3Rpb24sIGxhc3RGb2N1c2VkRWRpdG9yUGFuZSA9PT0gdGhpcy5wcmltYXJ5RWRpdG9yUGFuZSA/IFNpZGUuUFJJTUFSWSA6IFNpZGUuU0VDT05EQVJZKTtcblx0XHRcdH1cblx0XHR9XG5cblx0XHRyZXR1cm4gdW5kZWZpbmVkO1xuXHR9XG5cblx0b3ZlcnJpZGUgc2V0T3B0aW9ucyhvcHRpb25zOiBJU2lkZUJ5U2lkZUVkaXRvck9wdGlvbnMgfCB1bmRlZmluZWQpOiB2b2lkIHtcblx0XHRzdXBlci5zZXRPcHRpb25zKG9wdGlvbnMpO1xuXG5cdFx0Ly8gVXBkYXRlIGZvY3VzIGlmIHRhcmdldCBpcyBwcm92aWRlZFxuXHRcdGlmICh0eXBlb2Ygb3B0aW9ucz8udGFyZ2V0ID09PSAnbnVtYmVyJykge1xuXHRcdFx0dGhpcy5sYXN0Rm9jdXNlZFNpZGUgPSBvcHRpb25zLnRhcmdldDtcblx0XHR9XG5cblx0XHQvLyBBcHBseSB0byBmb2N1c2VkIHNpZGVcblx0XHR0aGlzLmdldExhc3RGb2N1c2VkRWRpdG9yUGFuZSgpPy5zZXRPcHRpb25zKG9wdGlvbnMpO1xuXHR9XG5cblx0cHJvdGVjdGVkIG92ZXJyaWRlIHNldEVkaXRvclZpc2libGUodmlzaWJsZTogYm9vbGVhbik6IHZvaWQge1xuXG5cdFx0Ly8gRm9yd2FyZCB0byBib3RoIHNpZGVzXG5cdFx0dGhpcy5wcmltYXJ5RWRpdG9yUGFuZT8uc2V0VmlzaWJsZSh2aXNpYmxlKTtcblx0XHR0aGlzLnNlY29uZGFyeUVkaXRvclBhbmU/LnNldFZpc2libGUodmlzaWJsZSk7XG5cblx0XHRzdXBlci5zZXRFZGl0b3JWaXNpYmxlKHZpc2libGUpO1xuXHR9XG5cblx0b3ZlcnJpZGUgY2xlYXJJbnB1dCgpOiB2b2lkIHtcblx0XHRzdXBlci5jbGVhcklucHV0KCk7XG5cblx0XHQvLyBGb3J3YXJkIHRvIGJvdGggc2lkZXNcblx0XHR0aGlzLnByaW1hcnlFZGl0b3JQYW5lPy5jbGVhcklucHV0KCk7XG5cdFx0dGhpcy5zZWNvbmRhcnlFZGl0b3JQYW5lPy5jbGVhcklucHV0KCk7XG5cblx0XHQvLyBTaW5jZSB3ZSBkbyBub3Qga2VlcCBzaWRlIGVkaXRvcnMgYWxpdmVcblx0XHQvLyB3ZSBkaXNwb3NlIGFueSBlZGl0b3IgY3JlYXRlZCBmb3IgcmVjcmVhdGlvblxuXHRcdHRoaXMuZGlzcG9zZUVkaXRvcnMoKTtcblx0fVxuXG5cdG92ZXJyaWRlIGZvY3VzKCk6IHZvaWQge1xuXHRcdHN1cGVyLmZvY3VzKCk7XG5cblx0XHR0aGlzLmdldExhc3RGb2N1c2VkRWRpdG9yUGFuZSgpPy5mb2N1cygpO1xuXHR9XG5cblx0cHJpdmF0ZSBnZXRMYXN0Rm9jdXNlZEVkaXRvclBhbmUoKTogRWRpdG9yUGFuZSB8IHVuZGVmaW5lZCB7XG5cdFx0aWYgKHRoaXMubGFzdEZvY3VzZWRTaWRlID09PSBTaWRlLlNFQ09OREFSWSkge1xuXHRcdFx0cmV0dXJuIHRoaXMuc2Vjb25kYXJ5RWRpdG9yUGFuZTtcblx0XHR9XG5cblx0XHRyZXR1cm4gdGhpcy5wcmltYXJ5RWRpdG9yUGFuZTtcblx0fVxuXG5cdGxheW91dChkaW1lbnNpb246IERpbWVuc2lvbik6IHZvaWQge1xuXHRcdHRoaXMuZGltZW5zaW9uID0gZGltZW5zaW9uO1xuXG5cdFx0Y29uc3Qgc3BsaXR2aWV3ID0gYXNzZXJ0SXNEZWZpbmVkKHRoaXMuc3BsaXR2aWV3KTtcblx0XHRzcGxpdHZpZXcubGF5b3V0KHRoaXMub3JpZW50YXRpb24gPT09IE9yaWVudGF0aW9uLkhPUklaT05UQUwgPyBkaW1lbnNpb24ud2lkdGggOiBkaW1lbnNpb24uaGVpZ2h0KTtcblx0fVxuXG5cdG92ZXJyaWRlIHNldEJvdW5kYXJ5U2FzaGVzKHNhc2hlczogSUJvdW5kYXJ5U2FzaGVzKSB7XG5cdFx0dGhpcy5fYm91bmRhcnlTYXNoZXMgPSBzYXNoZXM7XG5cblx0XHRpZiAodGhpcy5zcGxpdHZpZXcpIHtcblx0XHRcdHRoaXMuc3BsaXR2aWV3Lm9ydGhvZ29uYWxFbmRTYXNoID0gc2FzaGVzLmJvdHRvbTtcblx0XHR9XG5cdH1cblxuXHRwcml2YXRlIGxheW91dFBhbmUocGFuZTogRWRpdG9yUGFuZSB8IHVuZGVmaW5lZCwgc2l6ZTogbnVtYmVyKTogdm9pZCB7XG5cdFx0cGFuZT8ubGF5b3V0KHRoaXMub3JpZW50YXRpb24gPT09IE9yaWVudGF0aW9uLkhPUklaT05UQUwgPyBuZXcgRGltZW5zaW9uKHNpemUsIHRoaXMuZGltZW5zaW9uLmhlaWdodCkgOiBuZXcgRGltZW5zaW9uKHRoaXMuZGltZW5zaW9uLndpZHRoLCBzaXplKSk7XG5cdH1cblxuXHRvdmVycmlkZSBnZXRDb250cm9sKCk6IElFZGl0b3JDb250cm9sIHwgdW5kZWZpbmVkIHtcblx0XHRyZXR1cm4gdGhpcy5nZXRMYXN0Rm9jdXNlZEVkaXRvclBhbmUoKT8uZ2V0Q29udHJvbCgpO1xuXHR9XG5cblx0Z2V0UHJpbWFyeUVkaXRvclBhbmUoKTogSUVkaXRvclBhbmUgfCB1bmRlZmluZWQge1xuXHRcdHJldHVybiB0aGlzLnByaW1hcnlFZGl0b3JQYW5lO1xuXHR9XG5cblx0Z2V0U2Vjb25kYXJ5RWRpdG9yUGFuZSgpOiBJRWRpdG9yUGFuZSB8IHVuZGVmaW5lZCB7XG5cdFx0cmV0dXJuIHRoaXMuc2Vjb25kYXJ5RWRpdG9yUGFuZTtcblx0fVxuXG5cdHByb3RlY3RlZCB0cmFja3NFZGl0b3JWaWV3U3RhdGUoaW5wdXQ6IEVkaXRvcklucHV0KTogYm9vbGVhbiB7XG5cdFx0cmV0dXJuIGlucHV0IGluc3RhbmNlb2YgU2lkZUJ5U2lkZUVkaXRvcklucHV0O1xuXHR9XG5cblx0cHJvdGVjdGVkIGNvbXB1dGVFZGl0b3JWaWV3U3RhdGUocmVzb3VyY2U6IFVSSSk6IElTaWRlQnlTaWRlRWRpdG9yVmlld1N0YXRlIHwgdW5kZWZpbmVkIHtcblx0XHRpZiAoIXRoaXMuaW5wdXQgfHwgIWlzRXF1YWwocmVzb3VyY2UsIHRoaXMudG9FZGl0b3JWaWV3U3RhdGVSZXNvdXJjZSh0aGlzLmlucHV0KSkpIHtcblx0XHRcdHJldHVybjsgLy8gdW5leHBlY3RlZCBzdGF0ZVxuXHRcdH1cblxuXHRcdGNvbnN0IHByaW1hclZpZXdTdGF0ZSA9IHRoaXMucHJpbWFyeUVkaXRvclBhbmU/LmdldFZpZXdTdGF0ZSgpO1xuXHRcdGNvbnN0IHNlY29uZGFyeVZpZXdTdGF0ZSA9IHRoaXMuc2Vjb25kYXJ5RWRpdG9yUGFuZT8uZ2V0Vmlld1N0YXRlKCk7XG5cblx0XHRpZiAoIXByaW1hclZpZXdTdGF0ZSB8fCAhc2Vjb25kYXJ5Vmlld1N0YXRlKSB7XG5cdFx0XHRyZXR1cm47IC8vIHdlIGFjdHVhbGx5IG5lZWQgdmlldyBzdGF0ZXNcblx0XHR9XG5cblx0XHRyZXR1cm4ge1xuXHRcdFx0cHJpbWFyeTogcHJpbWFyVmlld1N0YXRlLFxuXHRcdFx0c2Vjb25kYXJ5OiBzZWNvbmRhcnlWaWV3U3RhdGUsXG5cdFx0XHRmb2N1czogdGhpcy5sYXN0Rm9jdXNlZFNpZGUsXG5cdFx0XHRyYXRpbzogdGhpcy5nZXRTcGxpdFZpZXdSYXRpbygpXG5cdFx0fTtcblx0fVxuXG5cdHByb3RlY3RlZCB0b0VkaXRvclZpZXdTdGF0ZVJlc291cmNlKGlucHV0OiBFZGl0b3JJbnB1dCk6IFVSSSB8IHVuZGVmaW5lZCB7XG5cdFx0bGV0IHByaW1hcnk6IFVSSSB8IHVuZGVmaW5lZDtcblx0XHRsZXQgc2Vjb25kYXJ5OiBVUkkgfCB1bmRlZmluZWQ7XG5cblx0XHRpZiAoaW5wdXQgaW5zdGFuY2VvZiBTaWRlQnlTaWRlRWRpdG9ySW5wdXQpIHtcblx0XHRcdHByaW1hcnkgPSBpbnB1dC5wcmltYXJ5LnJlc291cmNlO1xuXHRcdFx0c2Vjb25kYXJ5ID0gaW5wdXQuc2Vjb25kYXJ5LnJlc291cmNlO1xuXHRcdH1cblxuXHRcdGlmICghc2Vjb25kYXJ5IHx8ICFwcmltYXJ5KSB7XG5cdFx0XHRyZXR1cm4gdW5kZWZpbmVkO1xuXHRcdH1cblxuXHRcdC8vIGNyZWF0ZSBhIFVSSSB0aGF0IGlzIHRoZSBCYXNlNjQgY29uY2F0ZW5hdGlvbiBvZiBvcmlnaW5hbCArIG1vZGlmaWVkIHJlc291cmNlXG5cdFx0cmV0dXJuIFVSSS5mcm9tKHsgc2NoZW1lOiAnc2lkZUJ5U2lkZScsIHBhdGg6IGAke211bHRpYnl0ZUF3YXJlQnRvYShzZWNvbmRhcnkudG9TdHJpbmcoKSl9JHttdWx0aWJ5dGVBd2FyZUJ0b2EocHJpbWFyeS50b1N0cmluZygpKX1gIH0pO1xuXHR9XG5cblx0b3ZlcnJpZGUgdXBkYXRlU3R5bGVzKCk6IHZvaWQge1xuXHRcdHN1cGVyLnVwZGF0ZVN0eWxlcygpO1xuXG5cdFx0aWYgKHRoaXMucHJpbWFyeUVkaXRvckNvbnRhaW5lcikge1xuXHRcdFx0aWYgKHRoaXMub3JpZW50YXRpb24gPT09IE9yaWVudGF0aW9uLkhPUklaT05UQUwpIHtcblx0XHRcdFx0dGhpcy5wcmltYXJ5RWRpdG9yQ29udGFpbmVyLnN0eWxlLmJvcmRlckxlZnRXaWR0aCA9ICcxcHgnO1xuXHRcdFx0XHR0aGlzLnByaW1hcnlFZGl0b3JDb250YWluZXIuc3R5bGUuYm9yZGVyTGVmdFN0eWxlID0gJ3NvbGlkJztcblx0XHRcdFx0dGhpcy5wcmltYXJ5RWRpdG9yQ29udGFpbmVyLnN0eWxlLmJvcmRlckxlZnRDb2xvciA9IHRoaXMuZ2V0Q29sb3IoU0lERV9CWV9TSURFX0VESVRPUl9WRVJUSUNBTF9CT1JERVIpID8/ICcnO1xuXG5cdFx0XHRcdHRoaXMucHJpbWFyeUVkaXRvckNvbnRhaW5lci5zdHlsZS5ib3JkZXJUb3BXaWR0aCA9ICcwJztcblx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdHRoaXMucHJpbWFyeUVkaXRvckNvbnRhaW5lci5zdHlsZS5ib3JkZXJUb3BXaWR0aCA9ICcxcHgnO1xuXHRcdFx0XHR0aGlzLnByaW1hcnlFZGl0b3JDb250YWluZXIuc3R5bGUuYm9yZGVyVG9wU3R5bGUgPSAnc29saWQnO1xuXHRcdFx0XHR0aGlzLnByaW1hcnlFZGl0b3JDb250YWluZXIuc3R5bGUuYm9yZGVyVG9wQ29sb3IgPSB0aGlzLmdldENvbG9yKFNJREVfQllfU0lERV9FRElUT1JfSE9SSVpPTlRBTF9CT1JERVIpID8/ICcnO1xuXG5cdFx0XHRcdHRoaXMucHJpbWFyeUVkaXRvckNvbnRhaW5lci5zdHlsZS5ib3JkZXJMZWZ0V2lkdGggPSAnMCc7XG5cdFx0XHR9XG5cdFx0fVxuXHR9XG5cblx0b3ZlcnJpZGUgZGlzcG9zZSgpOiB2b2lkIHtcblx0XHR0aGlzLmRpc3Bvc2VFZGl0b3JzKCk7XG5cblx0XHRzdXBlci5kaXNwb3NlKCk7XG5cdH1cblxuXHRwcml2YXRlIGRpc3Bvc2VFZGl0b3JzKCk6IHZvaWQge1xuXHRcdHRoaXMuZWRpdG9yRGlzcG9zYWJsZXMuY2xlYXIoKTtcblxuXHRcdHRoaXMuc2Vjb25kYXJ5RWRpdG9yUGFuZSA9IHVuZGVmaW5lZDtcblx0XHR0aGlzLnByaW1hcnlFZGl0b3JQYW5lID0gdW5kZWZpbmVkO1xuXG5cdFx0dGhpcy5sYXN0Rm9jdXNlZFNpZGUgPSB1bmRlZmluZWQ7XG5cblx0XHRpZiAodGhpcy5zZWNvbmRhcnlFZGl0b3JDb250YWluZXIpIHtcblx0XHRcdGNsZWFyTm9kZSh0aGlzLnNlY29uZGFyeUVkaXRvckNvbnRhaW5lcik7XG5cdFx0fVxuXG5cdFx0aWYgKHRoaXMucHJpbWFyeUVkaXRvckNvbnRhaW5lcikge1xuXHRcdFx0Y2xlYXJOb2RlKHRoaXMucHJpbWFyeUVkaXRvckNvbnRhaW5lcik7XG5cdFx0fVxuXHR9XG59XG5cbmNsYXNzIFNpZGVCeVNpZGVBd2FyZUVkaXRvclBhbmVTZWxlY3Rpb24gaW1wbGVtZW50cyBJRWRpdG9yUGFuZVNlbGVjdGlvbiB7XG5cblx0Y29uc3RydWN0b3IoXG5cdFx0cHJpdmF0ZSByZWFkb25seSBzZWxlY3Rpb246IElFZGl0b3JQYW5lU2VsZWN0aW9uLFxuXHRcdHByaXZhdGUgcmVhZG9ubHkgc2lkZTogU2lkZS5QUklNQVJZIHwgU2lkZS5TRUNPTkRBUllcblx0KSB7IH1cblxuXHRjb21wYXJlKG90aGVyOiBJRWRpdG9yUGFuZVNlbGVjdGlvbik6IEVkaXRvclBhbmVTZWxlY3Rpb25Db21wYXJlUmVzdWx0IHtcblx0XHRpZiAoIShvdGhlciBpbnN0YW5jZW9mIFNpZGVCeVNpZGVBd2FyZUVkaXRvclBhbmVTZWxlY3Rpb24pKSB7XG5cdFx0XHRyZXR1cm4gRWRpdG9yUGFuZVNlbGVjdGlvbkNvbXBhcmVSZXN1bHQuRElGRkVSRU5UO1xuXHRcdH1cblxuXHRcdGlmICh0aGlzLnNpZGUgIT09IG90aGVyLnNpZGUpIHtcblx0XHRcdHJldHVybiBFZGl0b3JQYW5lU2VsZWN0aW9uQ29tcGFyZVJlc3VsdC5ESUZGRVJFTlQ7XG5cdFx0fVxuXG5cdFx0cmV0dXJuIHRoaXMuc2VsZWN0aW9uLmNvbXBhcmUob3RoZXIuc2VsZWN0aW9uKTtcblx0fVxuXG5cdHJlc3RvcmUob3B0aW9uczogSUVkaXRvck9wdGlvbnMpOiBJU2lkZUJ5U2lkZUVkaXRvck9wdGlvbnMge1xuXHRcdGNvbnN0IHNpZGVCeVNpZGVFZGl0b3JPcHRpb25zOiBJU2lkZUJ5U2lkZUVkaXRvck9wdGlvbnMgPSB7XG5cdFx0XHQuLi5vcHRpb25zLFxuXHRcdFx0dGFyZ2V0OiB0aGlzLnNpZGVcblx0XHR9O1xuXG5cdFx0cmV0dXJuIHRoaXMuc2VsZWN0aW9uLnJlc3RvcmUoc2lkZUJ5U2lkZUVkaXRvck9wdGlvbnMpO1xuXHR9XG59XG4iXSwKICAibWFwcGluZ3MiOiAiOzs7Ozs7Ozs7OztBQUtBLE9BQU87QUFDUCxTQUFTLGdCQUFnQjtBQUN6QixTQUFTLFdBQVcsR0FBRyxXQUFXLDBCQUEwQjtBQUM1RCxTQUFTLGdCQUFnQjtBQUN6QixTQUEwRCxrQkFBa0Isd0JBQXdCLG9CQUFvQixNQUF1RiwyQkFBMkIsd0NBQXdDO0FBQ2xSLFNBQVMsNkJBQTZCO0FBR3RDLFNBQVMseUJBQXlCO0FBQ2xDLFNBQVMsNkJBQTZCO0FBQ3RDLFNBQVMscUJBQXFCO0FBRzlCLFNBQXVCLDRCQUE0QjtBQUNuRCxTQUFTLFdBQVcsUUFBUSxtQkFBbUI7QUFDL0MsU0FBUyxPQUFPLE9BQU8sZUFBZTtBQUN0QyxTQUFTLHVCQUF1QjtBQUNoQyxTQUFTLHVCQUF1QjtBQUVoQyxTQUFvQyw2QkFBNkI7QUFDakUsU0FBUyxxQ0FBcUM7QUFDOUMsU0FBUyx1QkFBdUI7QUFDaEMsU0FBUyx1Q0FBdUMsMkNBQTJDO0FBQzNGLFNBQVMsbUNBQW1DO0FBQzVDLFNBQVMseUNBQXlDO0FBQ2xELFNBQVMsc0JBQXNCO0FBQy9C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
