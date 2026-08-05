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
import { h } from "../../../../../../base/browser/dom.js";
import { Emitter, Event } from "../../../../../../base/common/event.js";
import { Disposable } from "../../../../../../base/common/lifecycle.js";
import { autorun, derived, observableFromEvent } from "../../../../../../base/common/observable.js";
import { EditorExtensionsRegistry } from "../../../../../../editor/browser/editorExtensions.js";
import { CodeEditorWidget } from "../../../../../../editor/browser/widget/codeEditor/codeEditorWidget.js";
import { Selection } from "../../../../../../editor/common/core/selection.js";
import { CodeLensContribution } from "../../../../../../editor/contrib/codelens/browser/codelensController.js";
import { FoldingController } from "../../../../../../editor/contrib/folding/browser/folding.js";
import { MenuWorkbenchToolBar } from "../../../../../../platform/actions/browser/toolbar.js";
import { IInstantiationService } from "../../../../../../platform/instantiation/common/instantiation.js";
import { DEFAULT_EDITOR_MAX_DIMENSIONS, DEFAULT_EDITOR_MIN_DIMENSIONS } from "../../../../../browser/parts/editor/editor.js";
import { setStyle } from "../../utils.js";
import { observableConfigValue } from "../../../../../../platform/observable/common/platformObservableUtils.js";
class CodeEditorView extends Disposable {
  constructor(instantiationService, viewModel, configurationService) {
    super();
    this.instantiationService = instantiationService;
    this.viewModel = viewModel;
    this.configurationService = configurationService;
    this.model = this.viewModel.map((m) => (
      /** @description model */
      m?.model
    ));
    this.htmlElements = h("div.code-view", [
      h("div.header@header", [
        h("span.title@title"),
        h("span.description@description"),
        h("span.detail@detail"),
        h("span.toolbar@toolbar")
      ]),
      h("div.container", [
        h("div.gutter@gutterDiv"),
        h("div@editor")
      ])
    ]);
    this._onDidViewChange = new Emitter();
    this.view = {
      element: this.htmlElements.root,
      minimumWidth: DEFAULT_EDITOR_MIN_DIMENSIONS.width,
      maximumWidth: DEFAULT_EDITOR_MAX_DIMENSIONS.width,
      minimumHeight: DEFAULT_EDITOR_MIN_DIMENSIONS.height,
      maximumHeight: DEFAULT_EDITOR_MAX_DIMENSIONS.height,
      onDidChange: this._onDidViewChange.event,
      layout: (width, height, top, left) => {
        setStyle(this.htmlElements.root, { width, height, top, left });
        this.editor.layout({
          width: width - this.htmlElements.gutterDiv.clientWidth,
          height: height - this.htmlElements.header.clientHeight
        });
      }
      // preferredWidth?: number | undefined;
      // preferredHeight?: number | undefined;
      // priority?: LayoutPriority | undefined;
      // snap?: boolean | undefined;
    };
    this.checkboxesVisible = observableConfigValue("mergeEditor.showCheckboxes", false, this.configurationService);
    this.showDeletionMarkers = observableConfigValue("mergeEditor.showDeletionMarkers", true, this.configurationService);
    this.useSimplifiedDecorations = observableConfigValue("mergeEditor.useSimplifiedDecorations", false, this.configurationService);
    this.editor = this.instantiationService.createInstance(
      CodeEditorWidget,
      this.htmlElements.editor,
      {},
      {
        contributions: this.getEditorContributions()
      }
    );
    this.isFocused = observableFromEvent(
      this,
      Event.any(this.editor.onDidBlurEditorWidget, this.editor.onDidFocusEditorWidget),
      () => (
        /** @description editor.hasWidgetFocus */
        this.editor.hasWidgetFocus()
      )
    );
    this.cursorPosition = observableFromEvent(
      this,
      this.editor.onDidChangeCursorPosition,
      () => (
        /** @description editor.getPosition */
        this.editor.getPosition()
      )
    );
    this.selection = observableFromEvent(
      this,
      this.editor.onDidChangeCursorSelection,
      () => (
        /** @description editor.getSelections */
        this.editor.getSelections()
      )
    );
    this.cursorLineNumber = this.cursorPosition.map((p) => (
      /** @description cursorPosition.lineNumber */
      p?.lineNumber
    ));
  }
  updateOptions(newOptions) {
    this.editor.updateOptions(newOptions);
  }
  getEditorContributions() {
    return EditorExtensionsRegistry.getEditorContributions().filter((c) => c.id !== FoldingController.ID && c.id !== CodeLensContribution.ID);
  }
}
function createSelectionsAutorun(codeEditorView, translateRange) {
  const selections = derived((reader) => {
    const viewModel = codeEditorView.viewModel.read(reader);
    if (!viewModel) {
      return [];
    }
    const baseRange = viewModel.selectionInBase.read(reader);
    if (!baseRange || baseRange.sourceEditor === codeEditorView) {
      return [];
    }
    return baseRange.rangesInBase.map((r) => translateRange(r, viewModel));
  });
  return autorun((reader) => {
    const ranges = selections.read(reader);
    if (ranges.length === 0) {
      return;
    }
    codeEditorView.editor.setSelections(ranges.map((r) => new Selection(r.startLineNumber, r.startColumn, r.endLineNumber, r.endColumn)));
  });
}
let TitleMenu = class extends Disposable {
  constructor(menuId, targetHtmlElement, instantiationService) {
    super();
    const toolbar = instantiationService.createInstance(MenuWorkbenchToolBar, targetHtmlElement, menuId, {
      menuOptions: { renderShortTitle: true },
      toolbarOptions: { primaryGroup: (g) => g === "primary" }
    });
    this._store.add(toolbar);
  }
};
TitleMenu = __decorateClass([
  __decorateParam(2, IInstantiationService)
], TitleMenu);
export {
  CodeEditorView,
  TitleMenu,
  createSelectionsAutorun
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvY29udHJpYi9tZXJnZUVkaXRvci9icm93c2VyL3ZpZXcvZWRpdG9ycy9jb2RlRWRpdG9yVmlldy50cyJdLAogICJzb3VyY2VzQ29udGVudCI6IFsiLyotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cbiAqICBDb3B5cmlnaHQgKGMpIE1pY3Jvc29mdCBDb3Jwb3JhdGlvbi4gQWxsIHJpZ2h0cyByZXNlcnZlZC5cbiAqICBMaWNlbnNlZCB1bmRlciB0aGUgTUlUIExpY2Vuc2UuIFNlZSBMaWNlbnNlLnR4dCBpbiB0aGUgcHJvamVjdCByb290IGZvciBsaWNlbnNlIGluZm9ybWF0aW9uLlxuICotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLSovXG5cbmltcG9ydCB7IGggfSBmcm9tICcuLi8uLi8uLi8uLi8uLi8uLi9iYXNlL2Jyb3dzZXIvZG9tLmpzJztcbmltcG9ydCB7IElWaWV3LCBJVmlld1NpemUgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi8uLi9iYXNlL2Jyb3dzZXIvdWkvZ3JpZC9ncmlkLmpzJztcbmltcG9ydCB7IEVtaXR0ZXIsIEV2ZW50IH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vZXZlbnQuanMnO1xuaW1wb3J0IHsgRGlzcG9zYWJsZSwgSURpc3Bvc2FibGUgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9saWZlY3ljbGUuanMnO1xuaW1wb3J0IHsgSU9ic2VydmFibGUsIGF1dG9ydW4sIGRlcml2ZWQsIG9ic2VydmFibGVGcm9tRXZlbnQgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9vYnNlcnZhYmxlLmpzJztcbmltcG9ydCB7IEVkaXRvckV4dGVuc2lvbnNSZWdpc3RyeSwgSUVkaXRvckNvbnRyaWJ1dGlvbkRlc2NyaXB0aW9uIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vLi4vZWRpdG9yL2Jyb3dzZXIvZWRpdG9yRXh0ZW5zaW9ucy5qcyc7XG5pbXBvcnQgeyBDb2RlRWRpdG9yV2lkZ2V0IH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vLi4vZWRpdG9yL2Jyb3dzZXIvd2lkZ2V0L2NvZGVFZGl0b3IvY29kZUVkaXRvcldpZGdldC5qcyc7XG5pbXBvcnQgeyBJRWRpdG9yT3B0aW9ucyB9IGZyb20gJy4uLy4uLy4uLy4uLy4uLy4uL2VkaXRvci9jb21tb24vY29uZmlnL2VkaXRvck9wdGlvbnMuanMnO1xuaW1wb3J0IHsgUmFuZ2UgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi8uLi9lZGl0b3IvY29tbW9uL2NvcmUvcmFuZ2UuanMnO1xuaW1wb3J0IHsgU2VsZWN0aW9uIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vLi4vZWRpdG9yL2NvbW1vbi9jb3JlL3NlbGVjdGlvbi5qcyc7XG5pbXBvcnQgeyBDb2RlTGVuc0NvbnRyaWJ1dGlvbiB9IGZyb20gJy4uLy4uLy4uLy4uLy4uLy4uL2VkaXRvci9jb250cmliL2NvZGVsZW5zL2Jyb3dzZXIvY29kZWxlbnNDb250cm9sbGVyLmpzJztcbmltcG9ydCB7IEZvbGRpbmdDb250cm9sbGVyIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vLi4vZWRpdG9yL2NvbnRyaWIvZm9sZGluZy9icm93c2VyL2ZvbGRpbmcuanMnO1xuaW1wb3J0IHsgTWVudVdvcmtiZW5jaFRvb2xCYXIgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi8uLi9wbGF0Zm9ybS9hY3Rpb25zL2Jyb3dzZXIvdG9vbGJhci5qcyc7XG5pbXBvcnQgeyBNZW51SWQgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi8uLi9wbGF0Zm9ybS9hY3Rpb25zL2NvbW1vbi9hY3Rpb25zLmpzJztcbmltcG9ydCB7IElDb25maWd1cmF0aW9uU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uLy4uLy4uL3BsYXRmb3JtL2NvbmZpZ3VyYXRpb24vY29tbW9uL2NvbmZpZ3VyYXRpb24uanMnO1xuaW1wb3J0IHsgSUluc3RhbnRpYXRpb25TZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vLi4vcGxhdGZvcm0vaW5zdGFudGlhdGlvbi9jb21tb24vaW5zdGFudGlhdGlvbi5qcyc7XG5pbXBvcnQgeyBERUZBVUxUX0VESVRPUl9NQVhfRElNRU5TSU9OUywgREVGQVVMVF9FRElUT1JfTUlOX0RJTUVOU0lPTlMgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9icm93c2VyL3BhcnRzL2VkaXRvci9lZGl0b3IuanMnO1xuaW1wb3J0IHsgc2V0U3R5bGUgfSBmcm9tICcuLi8uLi91dGlscy5qcyc7XG5pbXBvcnQgeyBvYnNlcnZhYmxlQ29uZmlnVmFsdWUgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi8uLi9wbGF0Zm9ybS9vYnNlcnZhYmxlL2NvbW1vbi9wbGF0Zm9ybU9ic2VydmFibGVVdGlscy5qcyc7XG5pbXBvcnQgeyBNZXJnZUVkaXRvclZpZXdNb2RlbCB9IGZyb20gJy4uL3ZpZXdNb2RlbC5qcyc7XG5cbmV4cG9ydCBhYnN0cmFjdCBjbGFzcyBDb2RlRWRpdG9yVmlldyBleHRlbmRzIERpc3Bvc2FibGUge1xuXHRyZWFkb25seSBtb2RlbCA9IHRoaXMudmlld01vZGVsLm1hcChtID0+IC8qKiBAZGVzY3JpcHRpb24gbW9kZWwgKi8gbT8ubW9kZWwpO1xuXG5cdHByb3RlY3RlZCByZWFkb25seSBodG1sRWxlbWVudHMgPSBoKCdkaXYuY29kZS12aWV3JywgW1xuXHRcdGgoJ2Rpdi5oZWFkZXJAaGVhZGVyJywgW1xuXHRcdFx0aCgnc3Bhbi50aXRsZUB0aXRsZScpLFxuXHRcdFx0aCgnc3Bhbi5kZXNjcmlwdGlvbkBkZXNjcmlwdGlvbicpLFxuXHRcdFx0aCgnc3Bhbi5kZXRhaWxAZGV0YWlsJyksXG5cdFx0XHRoKCdzcGFuLnRvb2xiYXJAdG9vbGJhcicpLFxuXHRcdF0pLFxuXHRcdGgoJ2Rpdi5jb250YWluZXInLCBbXG5cdFx0XHRoKCdkaXYuZ3V0dGVyQGd1dHRlckRpdicpLFxuXHRcdFx0aCgnZGl2QGVkaXRvcicpLFxuXHRcdF0pLFxuXHRdKTtcblxuXHRwcml2YXRlIHJlYWRvbmx5IF9vbkRpZFZpZXdDaGFuZ2UgPSBuZXcgRW1pdHRlcjxJVmlld1NpemUgfCB1bmRlZmluZWQ+KCk7XG5cblx0cHVibGljIHJlYWRvbmx5IHZpZXc6IElWaWV3ID0ge1xuXHRcdGVsZW1lbnQ6IHRoaXMuaHRtbEVsZW1lbnRzLnJvb3QsXG5cdFx0bWluaW11bVdpZHRoOiBERUZBVUxUX0VESVRPUl9NSU5fRElNRU5TSU9OUy53aWR0aCxcblx0XHRtYXhpbXVtV2lkdGg6IERFRkFVTFRfRURJVE9SX01BWF9ESU1FTlNJT05TLndpZHRoLFxuXHRcdG1pbmltdW1IZWlnaHQ6IERFRkFVTFRfRURJVE9SX01JTl9ESU1FTlNJT05TLmhlaWdodCxcblx0XHRtYXhpbXVtSGVpZ2h0OiBERUZBVUxUX0VESVRPUl9NQVhfRElNRU5TSU9OUy5oZWlnaHQsXG5cdFx0b25EaWRDaGFuZ2U6IHRoaXMuX29uRGlkVmlld0NoYW5nZS5ldmVudCxcblx0XHRsYXlvdXQ6ICh3aWR0aDogbnVtYmVyLCBoZWlnaHQ6IG51bWJlciwgdG9wOiBudW1iZXIsIGxlZnQ6IG51bWJlcikgPT4ge1xuXHRcdFx0c2V0U3R5bGUodGhpcy5odG1sRWxlbWVudHMucm9vdCwgeyB3aWR0aCwgaGVpZ2h0LCB0b3AsIGxlZnQgfSk7XG5cdFx0XHR0aGlzLmVkaXRvci5sYXlvdXQoe1xuXHRcdFx0XHR3aWR0aDogd2lkdGggLSB0aGlzLmh0bWxFbGVtZW50cy5ndXR0ZXJEaXYuY2xpZW50V2lkdGgsXG5cdFx0XHRcdGhlaWdodDogaGVpZ2h0IC0gdGhpcy5odG1sRWxlbWVudHMuaGVhZGVyLmNsaWVudEhlaWdodCxcblx0XHRcdH0pO1xuXHRcdH1cblx0XHQvLyBwcmVmZXJyZWRXaWR0aD86IG51bWJlciB8IHVuZGVmaW5lZDtcblx0XHQvLyBwcmVmZXJyZWRIZWlnaHQ/OiBudW1iZXIgfCB1bmRlZmluZWQ7XG5cdFx0Ly8gcHJpb3JpdHk/OiBMYXlvdXRQcmlvcml0eSB8IHVuZGVmaW5lZDtcblx0XHQvLyBzbmFwPzogYm9vbGVhbiB8IHVuZGVmaW5lZDtcblx0fTtcblxuXHRwcm90ZWN0ZWQgcmVhZG9ubHkgY2hlY2tib3hlc1Zpc2libGUgPSBvYnNlcnZhYmxlQ29uZmlnVmFsdWU8Ym9vbGVhbj4oJ21lcmdlRWRpdG9yLnNob3dDaGVja2JveGVzJywgZmFsc2UsIHRoaXMuY29uZmlndXJhdGlvblNlcnZpY2UpO1xuXHRwcm90ZWN0ZWQgcmVhZG9ubHkgc2hvd0RlbGV0aW9uTWFya2VycyA9IG9ic2VydmFibGVDb25maWdWYWx1ZTxib29sZWFuPignbWVyZ2VFZGl0b3Iuc2hvd0RlbGV0aW9uTWFya2VycycsIHRydWUsIHRoaXMuY29uZmlndXJhdGlvblNlcnZpY2UpO1xuXHRwcm90ZWN0ZWQgcmVhZG9ubHkgdXNlU2ltcGxpZmllZERlY29yYXRpb25zID0gb2JzZXJ2YWJsZUNvbmZpZ1ZhbHVlPGJvb2xlYW4+KCdtZXJnZUVkaXRvci51c2VTaW1wbGlmaWVkRGVjb3JhdGlvbnMnLCBmYWxzZSwgdGhpcy5jb25maWd1cmF0aW9uU2VydmljZSk7XG5cblx0cHVibGljIHJlYWRvbmx5IGVkaXRvciA9IHRoaXMuaW5zdGFudGlhdGlvblNlcnZpY2UuY3JlYXRlSW5zdGFuY2UoXG5cdFx0Q29kZUVkaXRvcldpZGdldCxcblx0XHR0aGlzLmh0bWxFbGVtZW50cy5lZGl0b3IsXG5cdFx0e30sXG5cdFx0e1xuXHRcdFx0Y29udHJpYnV0aW9uczogdGhpcy5nZXRFZGl0b3JDb250cmlidXRpb25zKCksXG5cdFx0fVxuXHQpO1xuXG5cdHB1YmxpYyB1cGRhdGVPcHRpb25zKG5ld09wdGlvbnM6IFJlYWRvbmx5PElFZGl0b3JPcHRpb25zPik6IHZvaWQge1xuXHRcdHRoaXMuZWRpdG9yLnVwZGF0ZU9wdGlvbnMobmV3T3B0aW9ucyk7XG5cdH1cblxuXHRwdWJsaWMgcmVhZG9ubHkgaXNGb2N1c2VkID0gb2JzZXJ2YWJsZUZyb21FdmVudCh0aGlzLFxuXHRcdEV2ZW50LmFueSh0aGlzLmVkaXRvci5vbkRpZEJsdXJFZGl0b3JXaWRnZXQsIHRoaXMuZWRpdG9yLm9uRGlkRm9jdXNFZGl0b3JXaWRnZXQpLFxuXHRcdCgpID0+IC8qKiBAZGVzY3JpcHRpb24gZWRpdG9yLmhhc1dpZGdldEZvY3VzICovIHRoaXMuZWRpdG9yLmhhc1dpZGdldEZvY3VzKClcblx0KTtcblxuXHRwdWJsaWMgcmVhZG9ubHkgY3Vyc29yUG9zaXRpb24gPSBvYnNlcnZhYmxlRnJvbUV2ZW50KHRoaXMsXG5cdFx0dGhpcy5lZGl0b3Iub25EaWRDaGFuZ2VDdXJzb3JQb3NpdGlvbixcblx0XHQoKSA9PiAvKiogQGRlc2NyaXB0aW9uIGVkaXRvci5nZXRQb3NpdGlvbiAqLyB0aGlzLmVkaXRvci5nZXRQb3NpdGlvbigpXG5cdCk7XG5cblx0cHVibGljIHJlYWRvbmx5IHNlbGVjdGlvbiA9IG9ic2VydmFibGVGcm9tRXZlbnQodGhpcyxcblx0XHR0aGlzLmVkaXRvci5vbkRpZENoYW5nZUN1cnNvclNlbGVjdGlvbixcblx0XHQoKSA9PiAvKiogQGRlc2NyaXB0aW9uIGVkaXRvci5nZXRTZWxlY3Rpb25zICovIHRoaXMuZWRpdG9yLmdldFNlbGVjdGlvbnMoKVxuXHQpO1xuXG5cdHB1YmxpYyByZWFkb25seSBjdXJzb3JMaW5lTnVtYmVyID0gdGhpcy5jdXJzb3JQb3NpdGlvbi5tYXAocCA9PiAvKiogQGRlc2NyaXB0aW9uIGN1cnNvclBvc2l0aW9uLmxpbmVOdW1iZXIgKi8gcD8ubGluZU51bWJlcik7XG5cblx0Y29uc3RydWN0b3IoXG5cdFx0cHJpdmF0ZSByZWFkb25seSBpbnN0YW50aWF0aW9uU2VydmljZTogSUluc3RhbnRpYXRpb25TZXJ2aWNlLFxuXHRcdHB1YmxpYyByZWFkb25seSB2aWV3TW9kZWw6IElPYnNlcnZhYmxlPHVuZGVmaW5lZCB8IE1lcmdlRWRpdG9yVmlld01vZGVsPixcblx0XHRwcml2YXRlIHJlYWRvbmx5IGNvbmZpZ3VyYXRpb25TZXJ2aWNlOiBJQ29uZmlndXJhdGlvblNlcnZpY2UsXG5cdCkge1xuXHRcdHN1cGVyKCk7XG5cblx0fVxuXG5cdHByb3RlY3RlZCBnZXRFZGl0b3JDb250cmlidXRpb25zKCk6IElFZGl0b3JDb250cmlidXRpb25EZXNjcmlwdGlvbltdIHtcblx0XHRyZXR1cm4gRWRpdG9yRXh0ZW5zaW9uc1JlZ2lzdHJ5LmdldEVkaXRvckNvbnRyaWJ1dGlvbnMoKS5maWx0ZXIoYyA9PiBjLmlkICE9PSBGb2xkaW5nQ29udHJvbGxlci5JRCAmJiBjLmlkICE9PSBDb2RlTGVuc0NvbnRyaWJ1dGlvbi5JRCk7XG5cdH1cbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGNyZWF0ZVNlbGVjdGlvbnNBdXRvcnVuKFxuXHRjb2RlRWRpdG9yVmlldzogQ29kZUVkaXRvclZpZXcsXG5cdHRyYW5zbGF0ZVJhbmdlOiAoYmFzZVJhbmdlOiBSYW5nZSwgdmlld01vZGVsOiBNZXJnZUVkaXRvclZpZXdNb2RlbCkgPT4gUmFuZ2Vcbik6IElEaXNwb3NhYmxlIHtcblx0Y29uc3Qgc2VsZWN0aW9ucyA9IGRlcml2ZWQocmVhZGVyID0+IHtcblx0XHQvKiogQGRlc2NyaXB0aW9uIHNlbGVjdGlvbnMgKi9cblx0XHRjb25zdCB2aWV3TW9kZWwgPSBjb2RlRWRpdG9yVmlldy52aWV3TW9kZWwucmVhZChyZWFkZXIpO1xuXHRcdGlmICghdmlld01vZGVsKSB7XG5cdFx0XHRyZXR1cm4gW107XG5cdFx0fVxuXHRcdGNvbnN0IGJhc2VSYW5nZSA9IHZpZXdNb2RlbC5zZWxlY3Rpb25JbkJhc2UucmVhZChyZWFkZXIpO1xuXHRcdGlmICghYmFzZVJhbmdlIHx8IGJhc2VSYW5nZS5zb3VyY2VFZGl0b3IgPT09IGNvZGVFZGl0b3JWaWV3KSB7XG5cdFx0XHRyZXR1cm4gW107XG5cdFx0fVxuXHRcdHJldHVybiBiYXNlUmFuZ2UucmFuZ2VzSW5CYXNlLm1hcChyID0+IHRyYW5zbGF0ZVJhbmdlKHIsIHZpZXdNb2RlbCkpO1xuXHR9KTtcblxuXHRyZXR1cm4gYXV0b3J1bihyZWFkZXIgPT4ge1xuXHRcdC8qKiBAZGVzY3JpcHRpb24gc2V0IHNlbGVjdGlvbnMgKi9cblx0XHRjb25zdCByYW5nZXMgPSBzZWxlY3Rpb25zLnJlYWQocmVhZGVyKTtcblx0XHRpZiAocmFuZ2VzLmxlbmd0aCA9PT0gMCkge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblx0XHRjb2RlRWRpdG9yVmlldy5lZGl0b3Iuc2V0U2VsZWN0aW9ucyhyYW5nZXMubWFwKHIgPT4gbmV3IFNlbGVjdGlvbihyLnN0YXJ0TGluZU51bWJlciwgci5zdGFydENvbHVtbiwgci5lbmRMaW5lTnVtYmVyLCByLmVuZENvbHVtbikpKTtcblx0fSk7XG59XG5cbmV4cG9ydCBjbGFzcyBUaXRsZU1lbnUgZXh0ZW5kcyBEaXNwb3NhYmxlIHtcblx0Y29uc3RydWN0b3IoXG5cdFx0bWVudUlkOiBNZW51SWQsXG5cdFx0dGFyZ2V0SHRtbEVsZW1lbnQ6IEhUTUxFbGVtZW50LFxuXHRcdEBJSW5zdGFudGlhdGlvblNlcnZpY2UgaW5zdGFudGlhdGlvblNlcnZpY2U6IElJbnN0YW50aWF0aW9uU2VydmljZSxcblx0KSB7XG5cdFx0c3VwZXIoKTtcblxuXHRcdGNvbnN0IHRvb2xiYXIgPSBpbnN0YW50aWF0aW9uU2VydmljZS5jcmVhdGVJbnN0YW5jZShNZW51V29ya2JlbmNoVG9vbEJhciwgdGFyZ2V0SHRtbEVsZW1lbnQsIG1lbnVJZCwge1xuXHRcdFx0bWVudU9wdGlvbnM6IHsgcmVuZGVyU2hvcnRUaXRsZTogdHJ1ZSB9LFxuXHRcdFx0dG9vbGJhck9wdGlvbnM6IHsgcHJpbWFyeUdyb3VwOiAoZykgPT4gZyA9PT0gJ3ByaW1hcnknIH1cblx0XHR9KTtcblx0XHR0aGlzLl9zdG9yZS5hZGQodG9vbGJhcik7XG5cdH1cbn1cbiJdLAogICJtYXBwaW5ncyI6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
