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
import { getWindow, h, scheduleAtNextAnimationFrame } from "../../../../base/browser/dom.js";
import { SmoothScrollableElement } from "../../../../base/browser/ui/scrollbar/scrollableElement.js";
import { compareBy, numberComparator } from "../../../../base/common/arrays.js";
import { findFirstMax } from "../../../../base/common/arraysFind.js";
import { BugIndicatingError } from "../../../../base/common/errors.js";
import { Disposable, toDisposable } from "../../../../base/common/lifecycle.js";
import { autorun, autorunWithStore, derived, derivedWithStore, disposableObservableValue, globalTransaction, observableFromEvent, observableValue, transaction } from "../../../../base/common/observable.js";
import { Scrollable, ScrollbarVisibility } from "../../../../base/common/scrollable.js";
import { localize } from "../../../../nls.js";
import { IContextKeyService } from "../../../../platform/contextkey/common/contextkey.js";
import { IInstantiationService } from "../../../../platform/instantiation/common/instantiation.js";
import { ServiceCollection } from "../../../../platform/instantiation/common/serviceCollection.js";
import { OffsetRange } from "../../../common/core/offsetRange.js";
import { Selection } from "../../../common/core/selection.js";
import { EditorContextKeys } from "../../../common/editorContextKeys.js";
import { ObservableElementSizeObserver } from "../diffEditor/utils.js";
import { DiffEditorItemTemplate, TemplateData } from "./diffEditorItemTemplate.js";
import { ObjectPool } from "./objectPool.js";
import "./style.css";
let MultiDiffEditorWidgetImpl = class extends Disposable {
  constructor(_element, _dimension, _viewModel, _workbenchUIElementFactory, _parentContextKeyService, _parentInstantiationService) {
    super();
    this._element = _element;
    this._dimension = _dimension;
    this._viewModel = _viewModel;
    this._workbenchUIElementFactory = _workbenchUIElementFactory;
    this._parentContextKeyService = _parentContextKeyService;
    this._parentInstantiationService = _parentInstantiationService;
    this._scrollableElements = h("div.scrollContent", [
      h("div@content", {
        style: {
          overflow: "hidden"
        }
      }),
      h("div.monaco-editor@overflowWidgetsDomNode", {})
    ]);
    this._scrollable = this._register(new Scrollable({
      forceIntegerValues: false,
      scheduleAtNextAnimationFrame: (cb) => scheduleAtNextAnimationFrame(getWindow(this._element), cb),
      smoothScrollDuration: 100
    }));
    this._scrollableElement = this._register(new SmoothScrollableElement(this._scrollableElements.root, {
      vertical: ScrollbarVisibility.Auto,
      horizontal: ScrollbarVisibility.Auto,
      useShadows: false
    }, this._scrollable));
    this._elements = h("div.monaco-component.multiDiffEditor", {}, [
      h("div", {}, [this._scrollableElement.getDomNode()]),
      h("div.placeholder@placeholder", {}, [h("div")])
    ]);
    this._sizeObserver = this._register(new ObservableElementSizeObserver(this._element, void 0));
    this._objectPool = this._register(new ObjectPool((data) => {
      const template = this._instantiationService.createInstance(
        DiffEditorItemTemplate,
        this._scrollableElements.content,
        this._scrollableElements.overflowWidgetsDomNode,
        this._workbenchUIElementFactory
      );
      template.setData(data);
      return template;
    }));
    this.scrollTop = observableFromEvent(this, this._scrollableElement.onScroll, () => (
      /** @description scrollTop */
      this._scrollableElement.getScrollPosition().scrollTop
    ));
    this.scrollLeft = observableFromEvent(this, this._scrollableElement.onScroll, () => (
      /** @description scrollLeft */
      this._scrollableElement.getScrollPosition().scrollLeft
    ));
    this._viewItemsInfo = derivedWithStore(
      this,
      (reader, store) => {
        const vm = this._viewModel.read(reader);
        if (!vm) {
          return { items: [], getItem: (_d) => {
            throw new BugIndicatingError();
          } };
        }
        const viewModels = vm.items.read(reader);
        const map = /* @__PURE__ */ new Map();
        const items = viewModels.map((d) => {
          const item = store.add(new VirtualizedViewItem(d, this._objectPool, this.scrollLeft, (delta) => {
            this._scrollableElement.setScrollPosition({ scrollTop: this._scrollableElement.getScrollPosition().scrollTop + delta });
          }));
          const data = this._lastDocStates?.[item.getKey()];
          if (data) {
            transaction((tx) => {
              item.setViewState(data, tx);
            });
          }
          map.set(d, item);
          return item;
        });
        return { items, getItem: (d) => map.get(d) };
      }
    );
    this._viewItems = this._viewItemsInfo.map(this, (items) => items.items);
    this._spaceBetweenPx = 0;
    this._totalHeight = this._viewItems.map(this, (items, reader) => items.reduce((r, i) => r + i.contentHeight.read(reader) + this._spaceBetweenPx, 0));
    this.activeControl = derived(this, (reader) => {
      const activeDiffItem = this._viewModel.read(reader)?.activeDiffItem.read(reader);
      if (!activeDiffItem) {
        return void 0;
      }
      const viewItem = this._viewItemsInfo.read(reader).getItem(activeDiffItem);
      return viewItem.template.read(reader)?.editor;
    });
    this._contextKeyService = this._register(this._parentContextKeyService.createScoped(this._element));
    this._instantiationService = this._register(this._parentInstantiationService.createChild(
      new ServiceCollection([IContextKeyService, this._contextKeyService])
    ));
    /** This accounts for documents that are not loaded yet. */
    this._lastDocStates = {};
    this._register(autorunWithStore((reader, store) => {
      const viewModel = this._viewModel.read(reader);
      if (viewModel && viewModel.contextKeys) {
        for (const [key, value] of Object.entries(viewModel.contextKeys)) {
          const contextKey = this._contextKeyService.createKey(key, void 0);
          contextKey.set(value);
          store.add(toDisposable(() => contextKey.reset()));
        }
      }
    }));
    const ctxAllCollapsed = this._parentContextKeyService.createKey(EditorContextKeys.multiDiffEditorAllCollapsed.key, false);
    this._register(autorun((reader) => {
      const viewModel = this._viewModel.read(reader);
      if (viewModel) {
        const allCollapsed = viewModel.items.read(reader).every((item) => item.collapsed.read(reader));
        ctxAllCollapsed.set(allCollapsed);
      }
    }));
    this._register(autorun((reader) => {
      const dimension = this._dimension.read(reader);
      this._sizeObserver.observe(dimension);
    }));
    const placeholderMessage = derived((reader) => {
      const items = this._viewItems.read(reader);
      if (items.length > 0) {
        return void 0;
      }
      const vm = this._viewModel.read(reader);
      return !vm || vm.isLoading.read(reader) ? localize("loading", "Loading...") : localize("noChangedFiles", "No Changed Files");
    });
    this._register(autorun((reader) => {
      const message = placeholderMessage.read(reader);
      this._elements.placeholder.innerText = message ?? "";
      this._elements.placeholder.classList.toggle("visible", !!message);
    }));
    this._scrollableElements.content.style.position = "relative";
    this._register(autorun((reader) => {
      const height = this._sizeObserver.height.read(reader);
      this._scrollableElements.root.style.height = `${height}px`;
      const totalHeight = this._totalHeight.read(reader);
      this._scrollableElements.content.style.height = `${totalHeight}px`;
      const width = this._sizeObserver.width.read(reader);
      let scrollWidth = width;
      const viewItems = this._viewItems.read(reader);
      const max = findFirstMax(viewItems, compareBy((i) => i.maxScroll.read(reader).maxScroll, numberComparator));
      if (max) {
        const maxScroll = max.maxScroll.read(reader);
        scrollWidth = width + maxScroll.maxScroll;
      }
      this._scrollableElement.setScrollDimensions({
        width,
        height,
        scrollHeight: totalHeight,
        scrollWidth
      });
    }));
    _element.replaceChildren(this._elements.root);
    this._register(toDisposable(() => {
      _element.replaceChildren();
    }));
    this._register(this._register(autorun((reader) => {
      globalTransaction((tx) => {
        this.render(reader);
      });
    })));
  }
  setScrollState(scrollState) {
    this._scrollableElement.setScrollPosition({ scrollLeft: scrollState.left, scrollTop: scrollState.top });
  }
  reveal(resource, options) {
    const viewItems = this._viewItems.get();
    const index = viewItems.findIndex(
      (item) => item.viewModel.originalUri?.toString() === resource.original?.toString() && item.viewModel.modifiedUri?.toString() === resource.modified?.toString()
    );
    if (index === -1) {
      throw new BugIndicatingError("Resource not found in diff editor");
    }
    const viewItem = viewItems[index];
    this._viewModel.get().activeDiffItem.setCache(viewItem.viewModel, void 0);
    let scrollTop = 0;
    for (let i = 0; i < index; i++) {
      scrollTop += viewItems[i].contentHeight.get() + this._spaceBetweenPx;
    }
    this._scrollableElement.setScrollPosition({ scrollTop });
    const diffEditor = viewItem.template.get()?.editor;
    const editor = "original" in resource ? diffEditor?.getOriginalEditor() : diffEditor?.getModifiedEditor();
    if (editor && options?.range) {
      editor.revealRangeInCenter(options.range);
      highlightRange(editor, options.range);
    }
  }
  getViewState() {
    return {
      scrollState: {
        top: this.scrollTop.get(),
        left: this.scrollLeft.get()
      },
      docStates: Object.fromEntries(this._viewItems.get().map((i) => [i.getKey(), i.getViewState()]))
    };
  }
  setViewState(viewState) {
    this.setScrollState(viewState.scrollState);
    this._lastDocStates = viewState.docStates;
    transaction((tx) => {
      if (viewState.docStates) {
        for (const i of this._viewItems.get()) {
          const state = viewState.docStates[i.getKey()];
          if (state) {
            i.setViewState(state, tx);
          }
        }
      }
    });
  }
  findDocumentDiffItem(resource) {
    const item = this._viewItems.get().find(
      (v) => v.viewModel.diffEditorViewModel.model.modified.uri.toString() === resource.toString() || v.viewModel.diffEditorViewModel.model.original.uri.toString() === resource.toString()
    );
    return item?.viewModel.documentDiffItem;
  }
  tryGetCodeEditor(resource) {
    const item = this._viewItems.get().find(
      (v) => v.viewModel.diffEditorViewModel.model.modified.uri.toString() === resource.toString() || v.viewModel.diffEditorViewModel.model.original.uri.toString() === resource.toString()
    );
    const editor = item?.template.get()?.editor;
    if (!editor) {
      return void 0;
    }
    if (item.viewModel.diffEditorViewModel.model.modified.uri.toString() === resource.toString()) {
      return { diffEditor: editor, editor: editor.getModifiedEditor() };
    } else {
      return { diffEditor: editor, editor: editor.getOriginalEditor() };
    }
  }
  render(reader) {
    const scrollTop = this.scrollTop.read(reader);
    let contentScrollOffsetToScrollOffset = 0;
    let itemHeightSumBefore = 0;
    let itemContentHeightSumBefore = 0;
    const viewPortHeight = this._sizeObserver.height.read(reader);
    const contentViewPort = OffsetRange.ofStartAndLength(scrollTop, viewPortHeight);
    const width = this._sizeObserver.width.read(reader);
    for (const v of this._viewItems.read(reader)) {
      const itemContentHeight = v.contentHeight.read(reader);
      const itemHeight = Math.min(itemContentHeight, viewPortHeight);
      const itemRange = OffsetRange.ofStartAndLength(itemHeightSumBefore, itemHeight);
      const itemContentRange = OffsetRange.ofStartAndLength(itemContentHeightSumBefore, itemContentHeight);
      if (itemContentRange.isBefore(contentViewPort)) {
        contentScrollOffsetToScrollOffset -= itemContentHeight - itemHeight;
        v.hide();
      } else if (itemContentRange.isAfter(contentViewPort)) {
        v.hide();
      } else {
        const scroll = Math.max(0, Math.min(contentViewPort.start - itemContentRange.start, itemContentHeight - itemHeight));
        contentScrollOffsetToScrollOffset -= scroll;
        const viewPort = OffsetRange.ofStartAndLength(scrollTop + contentScrollOffsetToScrollOffset, viewPortHeight);
        v.render(itemRange, scroll, width, viewPort);
      }
      itemHeightSumBefore += itemHeight + this._spaceBetweenPx;
      itemContentHeightSumBefore += itemContentHeight + this._spaceBetweenPx;
    }
    this._scrollableElements.content.style.transform = `translateY(${-(scrollTop + contentScrollOffsetToScrollOffset)}px)`;
  }
};
MultiDiffEditorWidgetImpl = __decorateClass([
  __decorateParam(4, IContextKeyService),
  __decorateParam(5, IInstantiationService)
], MultiDiffEditorWidgetImpl);
function highlightRange(targetEditor, range) {
  const modelNow = targetEditor.getModel();
  const decorations = targetEditor.createDecorationsCollection([{ range, options: { description: "symbol-navigate-action-highlight", className: "symbolHighlight" } }]);
  setTimeout(() => {
    if (targetEditor.getModel() === modelNow) {
      decorations.clear();
    }
  }, 350);
}
class VirtualizedViewItem extends Disposable {
  constructor(viewModel, _objectPool, _scrollLeft, _deltaScrollVertical) {
    super();
    this.viewModel = viewModel;
    this._objectPool = _objectPool;
    this._scrollLeft = _scrollLeft;
    this._deltaScrollVertical = _deltaScrollVertical;
    this._templateRef = this._register(disposableObservableValue(this, void 0));
    this.contentHeight = derived(
      this,
      (reader) => this._templateRef.read(reader)?.object.contentHeight?.read(reader) ?? this.viewModel.lastTemplateData.read(reader).contentHeight
    );
    this.maxScroll = derived(this, (reader) => this._templateRef.read(reader)?.object.maxScroll.read(reader) ?? { maxScroll: 0, scrollWidth: 0 });
    this.template = derived(this, (reader) => this._templateRef.read(reader)?.object);
    this._isHidden = observableValue(this, false);
    this._isFocused = derived(this, (reader) => this.template.read(reader)?.isFocused.read(reader) ?? false);
    this.viewModel.setIsFocused(this._isFocused, void 0);
    this._register(autorun((reader) => {
      const scrollLeft = this._scrollLeft.read(reader);
      this._templateRef.read(reader)?.object.setScrollLeft(scrollLeft);
    }));
    this._register(autorun((reader) => {
      const ref = this._templateRef.read(reader);
      if (!ref) {
        return;
      }
      const isHidden = this._isHidden.read(reader);
      if (!isHidden) {
        return;
      }
      const isFocused = ref.object.isFocused.read(reader);
      if (isFocused) {
        return;
      }
      this._clear();
    }));
  }
  dispose() {
    this._clear();
    super.dispose();
  }
  toString() {
    return `VirtualViewItem(${this.viewModel.documentDiffItem.modified?.uri.toString()})`;
  }
  getKey() {
    return this.viewModel.getKey();
  }
  getViewState() {
    transaction((tx) => {
      this._updateTemplateData(tx);
    });
    return {
      collapsed: this.viewModel.collapsed.get(),
      selections: this.viewModel.lastTemplateData.get().selections
    };
  }
  setViewState(viewState, tx) {
    this.viewModel.collapsed.set(viewState.collapsed, tx);
    this._updateTemplateData(tx);
    const data = this.viewModel.lastTemplateData.get();
    const selections = viewState.selections?.map(Selection.liftSelection);
    this.viewModel.lastTemplateData.set({
      ...data,
      selections
    }, tx);
    const ref = this._templateRef.get();
    if (ref) {
      if (selections) {
        ref.object.editor.setSelections(selections);
      }
    }
  }
  _updateTemplateData(tx) {
    const ref = this._templateRef.get();
    if (!ref) {
      return;
    }
    this.viewModel.lastTemplateData.set({
      contentHeight: ref.object.contentHeight.get(),
      selections: ref.object.editor.getSelections() ?? void 0
    }, tx);
  }
  _clear() {
    const ref = this._templateRef.get();
    if (!ref) {
      return;
    }
    transaction((tx) => {
      this._updateTemplateData(tx);
      ref.object.hide();
      this._templateRef.set(void 0, tx);
    });
  }
  hide() {
    this._isHidden.set(true, void 0);
  }
  render(verticalSpace, offset, width, viewPort) {
    this._isHidden.set(false, void 0);
    let ref = this._templateRef.get();
    if (!ref) {
      ref = this._objectPool.getUnusedObj(new TemplateData(this.viewModel, this._deltaScrollVertical));
      this._templateRef.set(ref, void 0);
      const selections = this.viewModel.lastTemplateData.get().selections;
      if (selections) {
        ref.object.editor.setSelections(selections);
      }
    }
    ref.object.render(verticalSpace, width, offset, viewPort);
  }
}
export {
  MultiDiffEditorWidgetImpl
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy9lZGl0b3IvYnJvd3Nlci93aWRnZXQvbXVsdGlEaWZmRWRpdG9yL211bHRpRGlmZkVkaXRvcldpZGdldEltcGwudHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbIi8qLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG4gKiAgQ29weXJpZ2h0IChjKSBNaWNyb3NvZnQgQ29ycG9yYXRpb24uIEFsbCByaWdodHMgcmVzZXJ2ZWQuXG4gKiAgTGljZW5zZWQgdW5kZXIgdGhlIE1JVCBMaWNlbnNlLiBTZWUgTGljZW5zZS50eHQgaW4gdGhlIHByb2plY3Qgcm9vdCBmb3IgbGljZW5zZSBpbmZvcm1hdGlvbi5cbiAqLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0qL1xuXG5pbXBvcnQgeyBEaW1lbnNpb24sIGdldFdpbmRvdywgaCwgc2NoZWR1bGVBdE5leHRBbmltYXRpb25GcmFtZSB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvYnJvd3Nlci9kb20uanMnO1xuaW1wb3J0IHsgU21vb3RoU2Nyb2xsYWJsZUVsZW1lbnQgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2Jyb3dzZXIvdWkvc2Nyb2xsYmFyL3Njcm9sbGFibGVFbGVtZW50LmpzJztcbmltcG9ydCB7IGNvbXBhcmVCeSwgbnVtYmVyQ29tcGFyYXRvciB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2FycmF5cy5qcyc7XG5pbXBvcnQgeyBmaW5kRmlyc3RNYXggfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9hcnJheXNGaW5kLmpzJztcbmltcG9ydCB7IEJ1Z0luZGljYXRpbmdFcnJvciB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2Vycm9ycy5qcyc7XG5pbXBvcnQgeyBEaXNwb3NhYmxlLCBJUmVmZXJlbmNlLCB0b0Rpc3Bvc2FibGUgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9saWZlY3ljbGUuanMnO1xuaW1wb3J0IHsgSU9ic2VydmFibGUsIElSZWFkZXIsIElUcmFuc2FjdGlvbiwgYXV0b3J1biwgYXV0b3J1bldpdGhTdG9yZSwgZGVyaXZlZCwgZGVyaXZlZFdpdGhTdG9yZSwgZGlzcG9zYWJsZU9ic2VydmFibGVWYWx1ZSwgZ2xvYmFsVHJhbnNhY3Rpb24sIG9ic2VydmFibGVGcm9tRXZlbnQsIG9ic2VydmFibGVWYWx1ZSwgdHJhbnNhY3Rpb24gfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9vYnNlcnZhYmxlLmpzJztcbmltcG9ydCB7IFNjcm9sbGFibGUsIFNjcm9sbGJhclZpc2liaWxpdHkgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9zY3JvbGxhYmxlLmpzJztcbmltcG9ydCB7IFVSSSB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL3VyaS5qcyc7XG5pbXBvcnQgeyBsb2NhbGl6ZSB9IGZyb20gJy4uLy4uLy4uLy4uL25scy5qcyc7XG5pbXBvcnQgeyBDb250ZXh0S2V5VmFsdWUsIElDb250ZXh0S2V5U2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL2NvbnRleHRrZXkvY29tbW9uL2NvbnRleHRrZXkuanMnO1xuaW1wb3J0IHsgSVRleHRFZGl0b3JPcHRpb25zIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vZWRpdG9yL2NvbW1vbi9lZGl0b3IuanMnO1xuaW1wb3J0IHsgSUluc3RhbnRpYXRpb25TZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vaW5zdGFudGlhdGlvbi9jb21tb24vaW5zdGFudGlhdGlvbi5qcyc7XG5pbXBvcnQgeyBTZXJ2aWNlQ29sbGVjdGlvbiB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL2luc3RhbnRpYXRpb24vY29tbW9uL3NlcnZpY2VDb2xsZWN0aW9uLmpzJztcbmltcG9ydCB7IE9mZnNldFJhbmdlIH0gZnJvbSAnLi4vLi4vLi4vY29tbW9uL2NvcmUvb2Zmc2V0UmFuZ2UuanMnO1xuaW1wb3J0IHsgSVJhbmdlIH0gZnJvbSAnLi4vLi4vLi4vY29tbW9uL2NvcmUvcmFuZ2UuanMnO1xuaW1wb3J0IHsgSVNlbGVjdGlvbiwgU2VsZWN0aW9uIH0gZnJvbSAnLi4vLi4vLi4vY29tbW9uL2NvcmUvc2VsZWN0aW9uLmpzJztcbmltcG9ydCB7IElEaWZmRWRpdG9yIH0gZnJvbSAnLi4vLi4vLi4vY29tbW9uL2VkaXRvckNvbW1vbi5qcyc7XG5pbXBvcnQgeyBFZGl0b3JDb250ZXh0S2V5cyB9IGZyb20gJy4uLy4uLy4uL2NvbW1vbi9lZGl0b3JDb250ZXh0S2V5cy5qcyc7XG5pbXBvcnQgeyBJQ29kZUVkaXRvciB9IGZyb20gJy4uLy4uL2VkaXRvckJyb3dzZXIuanMnO1xuaW1wb3J0IHsgT2JzZXJ2YWJsZUVsZW1lbnRTaXplT2JzZXJ2ZXIgfSBmcm9tICcuLi9kaWZmRWRpdG9yL3V0aWxzLmpzJztcbmltcG9ydCB7IERpZmZFZGl0b3JJdGVtVGVtcGxhdGUsIFRlbXBsYXRlRGF0YSB9IGZyb20gJy4vZGlmZkVkaXRvckl0ZW1UZW1wbGF0ZS5qcyc7XG5pbXBvcnQgeyBJRG9jdW1lbnREaWZmSXRlbSB9IGZyb20gJy4vbW9kZWwuanMnO1xuaW1wb3J0IHsgRG9jdW1lbnREaWZmSXRlbVZpZXdNb2RlbCwgTXVsdGlEaWZmRWRpdG9yVmlld01vZGVsIH0gZnJvbSAnLi9tdWx0aURpZmZFZGl0b3JWaWV3TW9kZWwuanMnO1xuaW1wb3J0IHsgUmV2ZWFsT3B0aW9ucyB9IGZyb20gJy4vbXVsdGlEaWZmRWRpdG9yV2lkZ2V0LmpzJztcbmltcG9ydCB7IE9iamVjdFBvb2wgfSBmcm9tICcuL29iamVjdFBvb2wuanMnO1xuaW1wb3J0ICcuL3N0eWxlLmNzcyc7XG5pbXBvcnQgeyBJV29ya2JlbmNoVUlFbGVtZW50RmFjdG9yeSB9IGZyb20gJy4vd29ya2JlbmNoVUlFbGVtZW50RmFjdG9yeS5qcyc7XG5cbmV4cG9ydCBjbGFzcyBNdWx0aURpZmZFZGl0b3JXaWRnZXRJbXBsIGV4dGVuZHMgRGlzcG9zYWJsZSB7XG5cdHByaXZhdGUgcmVhZG9ubHkgX3Njcm9sbGFibGVFbGVtZW50cyA9IGgoJ2Rpdi5zY3JvbGxDb250ZW50JywgW1xuXHRcdGgoJ2RpdkBjb250ZW50Jywge1xuXHRcdFx0c3R5bGU6IHtcblx0XHRcdFx0b3ZlcmZsb3c6ICdoaWRkZW4nLFxuXHRcdFx0fVxuXHRcdH0pLFxuXHRcdGgoJ2Rpdi5tb25hY28tZWRpdG9yQG92ZXJmbG93V2lkZ2V0c0RvbU5vZGUnLCB7XG5cdFx0fSksXG5cdF0pO1xuXG5cdHByaXZhdGUgcmVhZG9ubHkgX3Njcm9sbGFibGUgPSB0aGlzLl9yZWdpc3RlcihuZXcgU2Nyb2xsYWJsZSh7XG5cdFx0Zm9yY2VJbnRlZ2VyVmFsdWVzOiBmYWxzZSxcblx0XHRzY2hlZHVsZUF0TmV4dEFuaW1hdGlvbkZyYW1lOiAoY2IpID0+IHNjaGVkdWxlQXROZXh0QW5pbWF0aW9uRnJhbWUoZ2V0V2luZG93KHRoaXMuX2VsZW1lbnQpLCBjYiksXG5cdFx0c21vb3RoU2Nyb2xsRHVyYXRpb246IDEwMCxcblx0fSkpO1xuXG5cdHByaXZhdGUgcmVhZG9ubHkgX3Njcm9sbGFibGVFbGVtZW50ID0gdGhpcy5fcmVnaXN0ZXIobmV3IFNtb290aFNjcm9sbGFibGVFbGVtZW50KHRoaXMuX3Njcm9sbGFibGVFbGVtZW50cy5yb290LCB7XG5cdFx0dmVydGljYWw6IFNjcm9sbGJhclZpc2liaWxpdHkuQXV0byxcblx0XHRob3Jpem9udGFsOiBTY3JvbGxiYXJWaXNpYmlsaXR5LkF1dG8sXG5cdFx0dXNlU2hhZG93czogZmFsc2UsXG5cdH0sIHRoaXMuX3Njcm9sbGFibGUpKTtcblxuXHRwcml2YXRlIHJlYWRvbmx5IF9lbGVtZW50cyA9IGgoJ2Rpdi5tb25hY28tY29tcG9uZW50Lm11bHRpRGlmZkVkaXRvcicsIHt9LCBbXG5cdFx0aCgnZGl2Jywge30sIFt0aGlzLl9zY3JvbGxhYmxlRWxlbWVudC5nZXREb21Ob2RlKCldKSxcblx0XHRoKCdkaXYucGxhY2Vob2xkZXJAcGxhY2Vob2xkZXInLCB7fSwgW2goJ2RpdicpXSksXG5cdF0pO1xuXG5cdHByaXZhdGUgcmVhZG9ubHkgX3NpemVPYnNlcnZlciA9IHRoaXMuX3JlZ2lzdGVyKG5ldyBPYnNlcnZhYmxlRWxlbWVudFNpemVPYnNlcnZlcih0aGlzLl9lbGVtZW50LCB1bmRlZmluZWQpKTtcblxuXHRwcml2YXRlIHJlYWRvbmx5IF9vYmplY3RQb29sID0gdGhpcy5fcmVnaXN0ZXIobmV3IE9iamVjdFBvb2w8VGVtcGxhdGVEYXRhLCBEaWZmRWRpdG9ySXRlbVRlbXBsYXRlPigoZGF0YSkgPT4ge1xuXHRcdGNvbnN0IHRlbXBsYXRlID0gdGhpcy5faW5zdGFudGlhdGlvblNlcnZpY2UuY3JlYXRlSW5zdGFuY2UoXG5cdFx0XHREaWZmRWRpdG9ySXRlbVRlbXBsYXRlLFxuXHRcdFx0dGhpcy5fc2Nyb2xsYWJsZUVsZW1lbnRzLmNvbnRlbnQsXG5cdFx0XHR0aGlzLl9zY3JvbGxhYmxlRWxlbWVudHMub3ZlcmZsb3dXaWRnZXRzRG9tTm9kZSxcblx0XHRcdHRoaXMuX3dvcmtiZW5jaFVJRWxlbWVudEZhY3Rvcnlcblx0XHQpO1xuXHRcdHRlbXBsYXRlLnNldERhdGEoZGF0YSk7XG5cdFx0cmV0dXJuIHRlbXBsYXRlO1xuXHR9KSk7XG5cblx0cHVibGljIHJlYWRvbmx5IHNjcm9sbFRvcCA9IG9ic2VydmFibGVGcm9tRXZlbnQodGhpcywgdGhpcy5fc2Nyb2xsYWJsZUVsZW1lbnQub25TY3JvbGwsICgpID0+IC8qKiBAZGVzY3JpcHRpb24gc2Nyb2xsVG9wICovIHRoaXMuX3Njcm9sbGFibGVFbGVtZW50LmdldFNjcm9sbFBvc2l0aW9uKCkuc2Nyb2xsVG9wKTtcblx0cHVibGljIHJlYWRvbmx5IHNjcm9sbExlZnQgPSBvYnNlcnZhYmxlRnJvbUV2ZW50KHRoaXMsIHRoaXMuX3Njcm9sbGFibGVFbGVtZW50Lm9uU2Nyb2xsLCAoKSA9PiAvKiogQGRlc2NyaXB0aW9uIHNjcm9sbExlZnQgKi8gdGhpcy5fc2Nyb2xsYWJsZUVsZW1lbnQuZ2V0U2Nyb2xsUG9zaXRpb24oKS5zY3JvbGxMZWZ0KTtcblxuXHRwcml2YXRlIHJlYWRvbmx5IF92aWV3SXRlbXNJbmZvID0gZGVyaXZlZFdpdGhTdG9yZTx7IGl0ZW1zOiByZWFkb25seSBWaXJ0dWFsaXplZFZpZXdJdGVtW107IGdldEl0ZW06ICh2aWV3TW9kZWw6IERvY3VtZW50RGlmZkl0ZW1WaWV3TW9kZWwpID0+IFZpcnR1YWxpemVkVmlld0l0ZW0gfT4odGhpcyxcblx0XHQocmVhZGVyLCBzdG9yZSkgPT4ge1xuXHRcdFx0Y29uc3Qgdm0gPSB0aGlzLl92aWV3TW9kZWwucmVhZChyZWFkZXIpO1xuXHRcdFx0aWYgKCF2bSkge1xuXHRcdFx0XHRyZXR1cm4geyBpdGVtczogW10sIGdldEl0ZW06IF9kID0+IHsgdGhyb3cgbmV3IEJ1Z0luZGljYXRpbmdFcnJvcigpOyB9IH07XG5cdFx0XHR9XG5cdFx0XHRjb25zdCB2aWV3TW9kZWxzID0gdm0uaXRlbXMucmVhZChyZWFkZXIpO1xuXHRcdFx0Y29uc3QgbWFwID0gbmV3IE1hcDxEb2N1bWVudERpZmZJdGVtVmlld01vZGVsLCBWaXJ0dWFsaXplZFZpZXdJdGVtPigpO1xuXHRcdFx0Y29uc3QgaXRlbXMgPSB2aWV3TW9kZWxzLm1hcChkID0+IHtcblx0XHRcdFx0Y29uc3QgaXRlbSA9IHN0b3JlLmFkZChuZXcgVmlydHVhbGl6ZWRWaWV3SXRlbShkLCB0aGlzLl9vYmplY3RQb29sLCB0aGlzLnNjcm9sbExlZnQsIGRlbHRhID0+IHtcblx0XHRcdFx0XHR0aGlzLl9zY3JvbGxhYmxlRWxlbWVudC5zZXRTY3JvbGxQb3NpdGlvbih7IHNjcm9sbFRvcDogdGhpcy5fc2Nyb2xsYWJsZUVsZW1lbnQuZ2V0U2Nyb2xsUG9zaXRpb24oKS5zY3JvbGxUb3AgKyBkZWx0YSB9KTtcblx0XHRcdFx0fSkpO1xuXHRcdFx0XHRjb25zdCBkYXRhID0gdGhpcy5fbGFzdERvY1N0YXRlcz8uW2l0ZW0uZ2V0S2V5KCldO1xuXHRcdFx0XHRpZiAoZGF0YSkge1xuXHRcdFx0XHRcdHRyYW5zYWN0aW9uKHR4ID0+IHtcblx0XHRcdFx0XHRcdGl0ZW0uc2V0Vmlld1N0YXRlKGRhdGEsIHR4KTtcblx0XHRcdFx0XHR9KTtcblx0XHRcdFx0fVxuXHRcdFx0XHRtYXAuc2V0KGQsIGl0ZW0pO1xuXHRcdFx0XHRyZXR1cm4gaXRlbTtcblx0XHRcdH0pO1xuXHRcdFx0cmV0dXJuIHsgaXRlbXMsIGdldEl0ZW06IGQgPT4gbWFwLmdldChkKSEgfTtcblx0XHR9XG5cdCk7XG5cblx0cHJpdmF0ZSByZWFkb25seSBfdmlld0l0ZW1zID0gdGhpcy5fdmlld0l0ZW1zSW5mby5tYXAodGhpcywgaXRlbXMgPT4gaXRlbXMuaXRlbXMpO1xuXG5cdHByaXZhdGUgcmVhZG9ubHkgX3NwYWNlQmV0d2VlblB4ID0gMDtcblxuXHRwcml2YXRlIHJlYWRvbmx5IF90b3RhbEhlaWdodCA9IHRoaXMuX3ZpZXdJdGVtcy5tYXAodGhpcywgKGl0ZW1zLCByZWFkZXIpID0+IGl0ZW1zLnJlZHVjZSgociwgaSkgPT4gciArIGkuY29udGVudEhlaWdodC5yZWFkKHJlYWRlcikgKyB0aGlzLl9zcGFjZUJldHdlZW5QeCwgMCkpO1xuXHRwdWJsaWMgcmVhZG9ubHkgYWN0aXZlQ29udHJvbCA9IGRlcml2ZWQodGhpcywgcmVhZGVyID0+IHtcblx0XHRjb25zdCBhY3RpdmVEaWZmSXRlbSA9IHRoaXMuX3ZpZXdNb2RlbC5yZWFkKHJlYWRlcik/LmFjdGl2ZURpZmZJdGVtLnJlYWQocmVhZGVyKTtcblx0XHRpZiAoIWFjdGl2ZURpZmZJdGVtKSB7IHJldHVybiB1bmRlZmluZWQ7IH1cblx0XHRjb25zdCB2aWV3SXRlbSA9IHRoaXMuX3ZpZXdJdGVtc0luZm8ucmVhZChyZWFkZXIpLmdldEl0ZW0oYWN0aXZlRGlmZkl0ZW0pO1xuXHRcdHJldHVybiB2aWV3SXRlbS50ZW1wbGF0ZS5yZWFkKHJlYWRlcik/LmVkaXRvcjtcblx0fSk7XG5cblx0cHJpdmF0ZSByZWFkb25seSBfY29udGV4dEtleVNlcnZpY2UgPSB0aGlzLl9yZWdpc3Rlcih0aGlzLl9wYXJlbnRDb250ZXh0S2V5U2VydmljZS5jcmVhdGVTY29wZWQodGhpcy5fZWxlbWVudCkpO1xuXHRwcml2YXRlIHJlYWRvbmx5IF9pbnN0YW50aWF0aW9uU2VydmljZSA9IHRoaXMuX3JlZ2lzdGVyKHRoaXMuX3BhcmVudEluc3RhbnRpYXRpb25TZXJ2aWNlLmNyZWF0ZUNoaWxkKFxuXHRcdG5ldyBTZXJ2aWNlQ29sbGVjdGlvbihbSUNvbnRleHRLZXlTZXJ2aWNlLCB0aGlzLl9jb250ZXh0S2V5U2VydmljZV0pXG5cdCkpO1xuXG5cdGNvbnN0cnVjdG9yKFxuXHRcdHByaXZhdGUgcmVhZG9ubHkgX2VsZW1lbnQ6IEhUTUxFbGVtZW50LFxuXHRcdHByaXZhdGUgcmVhZG9ubHkgX2RpbWVuc2lvbjogSU9ic2VydmFibGU8RGltZW5zaW9uIHwgdW5kZWZpbmVkPixcblx0XHRwcml2YXRlIHJlYWRvbmx5IF92aWV3TW9kZWw6IElPYnNlcnZhYmxlPE11bHRpRGlmZkVkaXRvclZpZXdNb2RlbCB8IHVuZGVmaW5lZD4sXG5cdFx0cHJpdmF0ZSByZWFkb25seSBfd29ya2JlbmNoVUlFbGVtZW50RmFjdG9yeTogSVdvcmtiZW5jaFVJRWxlbWVudEZhY3RvcnksXG5cdFx0QElDb250ZXh0S2V5U2VydmljZSBwcml2YXRlIHJlYWRvbmx5IF9wYXJlbnRDb250ZXh0S2V5U2VydmljZTogSUNvbnRleHRLZXlTZXJ2aWNlLFxuXHRcdEBJSW5zdGFudGlhdGlvblNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBfcGFyZW50SW5zdGFudGlhdGlvblNlcnZpY2U6IElJbnN0YW50aWF0aW9uU2VydmljZSxcblx0KSB7XG5cdFx0c3VwZXIoKTtcblxuXHRcdHRoaXMuX3JlZ2lzdGVyKGF1dG9ydW5XaXRoU3RvcmUoKHJlYWRlciwgc3RvcmUpID0+IHtcblx0XHRcdGNvbnN0IHZpZXdNb2RlbCA9IHRoaXMuX3ZpZXdNb2RlbC5yZWFkKHJlYWRlcik7XG5cdFx0XHRpZiAodmlld01vZGVsICYmIHZpZXdNb2RlbC5jb250ZXh0S2V5cykge1xuXHRcdFx0XHRmb3IgKGNvbnN0IFtrZXksIHZhbHVlXSBvZiBPYmplY3QuZW50cmllcyh2aWV3TW9kZWwuY29udGV4dEtleXMpKSB7XG5cdFx0XHRcdFx0Y29uc3QgY29udGV4dEtleSA9IHRoaXMuX2NvbnRleHRLZXlTZXJ2aWNlLmNyZWF0ZUtleTxDb250ZXh0S2V5VmFsdWU+KGtleSwgdW5kZWZpbmVkKTtcblx0XHRcdFx0XHRjb250ZXh0S2V5LnNldCh2YWx1ZSk7XG5cdFx0XHRcdFx0c3RvcmUuYWRkKHRvRGlzcG9zYWJsZSgoKSA9PiBjb250ZXh0S2V5LnJlc2V0KCkpKTtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdH0pKTtcblxuXHRcdGNvbnN0IGN0eEFsbENvbGxhcHNlZCA9IHRoaXMuX3BhcmVudENvbnRleHRLZXlTZXJ2aWNlLmNyZWF0ZUtleTxib29sZWFuPihFZGl0b3JDb250ZXh0S2V5cy5tdWx0aURpZmZFZGl0b3JBbGxDb2xsYXBzZWQua2V5LCBmYWxzZSk7XG5cdFx0dGhpcy5fcmVnaXN0ZXIoYXV0b3J1bigocmVhZGVyKSA9PiB7XG5cdFx0XHRjb25zdCB2aWV3TW9kZWwgPSB0aGlzLl92aWV3TW9kZWwucmVhZChyZWFkZXIpO1xuXHRcdFx0aWYgKHZpZXdNb2RlbCkge1xuXHRcdFx0XHRjb25zdCBhbGxDb2xsYXBzZWQgPSB2aWV3TW9kZWwuaXRlbXMucmVhZChyZWFkZXIpLmV2ZXJ5KGl0ZW0gPT4gaXRlbS5jb2xsYXBzZWQucmVhZChyZWFkZXIpKTtcblx0XHRcdFx0Y3R4QWxsQ29sbGFwc2VkLnNldChhbGxDb2xsYXBzZWQpO1xuXHRcdFx0fVxuXHRcdH0pKTtcblxuXHRcdHRoaXMuX3JlZ2lzdGVyKGF1dG9ydW4oKHJlYWRlcikgPT4ge1xuXHRcdFx0LyoqIEBkZXNjcmlwdGlvbiBVcGRhdGUgd2lkZ2V0IGRpbWVuc2lvbiAqL1xuXHRcdFx0Y29uc3QgZGltZW5zaW9uID0gdGhpcy5fZGltZW5zaW9uLnJlYWQocmVhZGVyKTtcblx0XHRcdHRoaXMuX3NpemVPYnNlcnZlci5vYnNlcnZlKGRpbWVuc2lvbik7XG5cdFx0fSkpO1xuXG5cdFx0Y29uc3QgcGxhY2Vob2xkZXJNZXNzYWdlID0gZGVyaXZlZChyZWFkZXIgPT4ge1xuXHRcdFx0Y29uc3QgaXRlbXMgPSB0aGlzLl92aWV3SXRlbXMucmVhZChyZWFkZXIpO1xuXHRcdFx0aWYgKGl0ZW1zLmxlbmd0aCA+IDApIHsgcmV0dXJuIHVuZGVmaW5lZDsgfVxuXG5cdFx0XHRjb25zdCB2bSA9IHRoaXMuX3ZpZXdNb2RlbC5yZWFkKHJlYWRlcik7XG5cdFx0XHRyZXR1cm4gKCF2bSB8fCB2bS5pc0xvYWRpbmcucmVhZChyZWFkZXIpKVxuXHRcdFx0XHQ/IGxvY2FsaXplKCdsb2FkaW5nJywgJ0xvYWRpbmcuLi4nKVxuXHRcdFx0XHQ6IGxvY2FsaXplKCdub0NoYW5nZWRGaWxlcycsICdObyBDaGFuZ2VkIEZpbGVzJyk7XG5cdFx0fSk7XG5cblx0XHR0aGlzLl9yZWdpc3RlcihhdXRvcnVuKChyZWFkZXIpID0+IHtcblx0XHRcdGNvbnN0IG1lc3NhZ2UgPSBwbGFjZWhvbGRlck1lc3NhZ2UucmVhZChyZWFkZXIpO1xuXHRcdFx0dGhpcy5fZWxlbWVudHMucGxhY2Vob2xkZXIuaW5uZXJUZXh0ID0gbWVzc2FnZSA/PyAnJztcblx0XHRcdHRoaXMuX2VsZW1lbnRzLnBsYWNlaG9sZGVyLmNsYXNzTGlzdC50b2dnbGUoJ3Zpc2libGUnLCAhIW1lc3NhZ2UpO1xuXHRcdH0pKTtcblxuXHRcdHRoaXMuX3Njcm9sbGFibGVFbGVtZW50cy5jb250ZW50LnN0eWxlLnBvc2l0aW9uID0gJ3JlbGF0aXZlJztcblxuXHRcdHRoaXMuX3JlZ2lzdGVyKGF1dG9ydW4oKHJlYWRlcikgPT4ge1xuXHRcdFx0LyoqIEBkZXNjcmlwdGlvbiBVcGRhdGUgc2Nyb2xsIGRpbWVuc2lvbnMgKi9cblx0XHRcdGNvbnN0IGhlaWdodCA9IHRoaXMuX3NpemVPYnNlcnZlci5oZWlnaHQucmVhZChyZWFkZXIpO1xuXHRcdFx0dGhpcy5fc2Nyb2xsYWJsZUVsZW1lbnRzLnJvb3Quc3R5bGUuaGVpZ2h0ID0gYCR7aGVpZ2h0fXB4YDtcblx0XHRcdGNvbnN0IHRvdGFsSGVpZ2h0ID0gdGhpcy5fdG90YWxIZWlnaHQucmVhZChyZWFkZXIpO1xuXHRcdFx0dGhpcy5fc2Nyb2xsYWJsZUVsZW1lbnRzLmNvbnRlbnQuc3R5bGUuaGVpZ2h0ID0gYCR7dG90YWxIZWlnaHR9cHhgO1xuXG5cdFx0XHRjb25zdCB3aWR0aCA9IHRoaXMuX3NpemVPYnNlcnZlci53aWR0aC5yZWFkKHJlYWRlcik7XG5cblx0XHRcdGxldCBzY3JvbGxXaWR0aCA9IHdpZHRoO1xuXHRcdFx0Y29uc3Qgdmlld0l0ZW1zID0gdGhpcy5fdmlld0l0ZW1zLnJlYWQocmVhZGVyKTtcblx0XHRcdGNvbnN0IG1heCA9IGZpbmRGaXJzdE1heCh2aWV3SXRlbXMsIGNvbXBhcmVCeShpID0+IGkubWF4U2Nyb2xsLnJlYWQocmVhZGVyKS5tYXhTY3JvbGwsIG51bWJlckNvbXBhcmF0b3IpKTtcblx0XHRcdGlmIChtYXgpIHtcblx0XHRcdFx0Y29uc3QgbWF4U2Nyb2xsID0gbWF4Lm1heFNjcm9sbC5yZWFkKHJlYWRlcik7XG5cdFx0XHRcdHNjcm9sbFdpZHRoID0gd2lkdGggKyBtYXhTY3JvbGwubWF4U2Nyb2xsO1xuXHRcdFx0fVxuXG5cdFx0XHR0aGlzLl9zY3JvbGxhYmxlRWxlbWVudC5zZXRTY3JvbGxEaW1lbnNpb25zKHtcblx0XHRcdFx0d2lkdGg6IHdpZHRoLFxuXHRcdFx0XHRoZWlnaHQ6IGhlaWdodCxcblx0XHRcdFx0c2Nyb2xsSGVpZ2h0OiB0b3RhbEhlaWdodCxcblx0XHRcdFx0c2Nyb2xsV2lkdGgsXG5cdFx0XHR9KTtcblx0XHR9KSk7XG5cblx0XHRfZWxlbWVudC5yZXBsYWNlQ2hpbGRyZW4odGhpcy5fZWxlbWVudHMucm9vdCk7XG5cdFx0dGhpcy5fcmVnaXN0ZXIodG9EaXNwb3NhYmxlKCgpID0+IHtcblx0XHRcdF9lbGVtZW50LnJlcGxhY2VDaGlsZHJlbigpO1xuXHRcdH0pKTtcblxuXHRcdHRoaXMuX3JlZ2lzdGVyKHRoaXMuX3JlZ2lzdGVyKGF1dG9ydW4ocmVhZGVyID0+IHtcblx0XHRcdC8qKiBAZGVzY3JpcHRpb24gUmVuZGVyIGFsbCAqL1xuXHRcdFx0Z2xvYmFsVHJhbnNhY3Rpb24odHggPT4ge1xuXHRcdFx0XHR0aGlzLnJlbmRlcihyZWFkZXIpO1xuXHRcdFx0fSk7XG5cdFx0fSkpKTtcblx0fVxuXG5cdHB1YmxpYyBzZXRTY3JvbGxTdGF0ZShzY3JvbGxTdGF0ZTogeyB0b3A/OiBudW1iZXI7IGxlZnQ/OiBudW1iZXIgfSk6IHZvaWQge1xuXHRcdHRoaXMuX3Njcm9sbGFibGVFbGVtZW50LnNldFNjcm9sbFBvc2l0aW9uKHsgc2Nyb2xsTGVmdDogc2Nyb2xsU3RhdGUubGVmdCwgc2Nyb2xsVG9wOiBzY3JvbGxTdGF0ZS50b3AgfSk7XG5cdH1cblxuXHRwdWJsaWMgcmV2ZWFsKHJlc291cmNlOiBJTXVsdGlEaWZmUmVzb3VyY2VJZCwgb3B0aW9ucz86IFJldmVhbE9wdGlvbnMpOiB2b2lkIHtcblx0XHRjb25zdCB2aWV3SXRlbXMgPSB0aGlzLl92aWV3SXRlbXMuZ2V0KCk7XG5cdFx0Y29uc3QgaW5kZXggPSB2aWV3SXRlbXMuZmluZEluZGV4KFxuXHRcdFx0KGl0ZW0pID0+IGl0ZW0udmlld01vZGVsLm9yaWdpbmFsVXJpPy50b1N0cmluZygpID09PSByZXNvdXJjZS5vcmlnaW5hbD8udG9TdHJpbmcoKVxuXHRcdFx0XHQmJiBpdGVtLnZpZXdNb2RlbC5tb2RpZmllZFVyaT8udG9TdHJpbmcoKSA9PT0gcmVzb3VyY2UubW9kaWZpZWQ/LnRvU3RyaW5nKClcblx0XHQpO1xuXHRcdGlmIChpbmRleCA9PT0gLTEpIHtcblx0XHRcdHRocm93IG5ldyBCdWdJbmRpY2F0aW5nRXJyb3IoJ1Jlc291cmNlIG5vdCBmb3VuZCBpbiBkaWZmIGVkaXRvcicpO1xuXHRcdH1cblx0XHRjb25zdCB2aWV3SXRlbSA9IHZpZXdJdGVtc1tpbmRleF07XG5cdFx0dGhpcy5fdmlld01vZGVsLmdldCgpIS5hY3RpdmVEaWZmSXRlbS5zZXRDYWNoZSh2aWV3SXRlbS52aWV3TW9kZWwsIHVuZGVmaW5lZCk7XG5cblx0XHRsZXQgc2Nyb2xsVG9wID0gMDtcblx0XHRmb3IgKGxldCBpID0gMDsgaSA8IGluZGV4OyBpKyspIHtcblx0XHRcdHNjcm9sbFRvcCArPSB2aWV3SXRlbXNbaV0uY29udGVudEhlaWdodC5nZXQoKSArIHRoaXMuX3NwYWNlQmV0d2VlblB4O1xuXHRcdH1cblx0XHR0aGlzLl9zY3JvbGxhYmxlRWxlbWVudC5zZXRTY3JvbGxQb3NpdGlvbih7IHNjcm9sbFRvcCB9KTtcblxuXHRcdGNvbnN0IGRpZmZFZGl0b3IgPSB2aWV3SXRlbS50ZW1wbGF0ZS5nZXQoKT8uZWRpdG9yO1xuXHRcdGNvbnN0IGVkaXRvciA9ICdvcmlnaW5hbCcgaW4gcmVzb3VyY2UgPyBkaWZmRWRpdG9yPy5nZXRPcmlnaW5hbEVkaXRvcigpIDogZGlmZkVkaXRvcj8uZ2V0TW9kaWZpZWRFZGl0b3IoKTtcblx0XHRpZiAoZWRpdG9yICYmIG9wdGlvbnM/LnJhbmdlKSB7XG5cdFx0XHRlZGl0b3IucmV2ZWFsUmFuZ2VJbkNlbnRlcihvcHRpb25zLnJhbmdlKTtcblx0XHRcdGhpZ2hsaWdodFJhbmdlKGVkaXRvciwgb3B0aW9ucy5yYW5nZSk7XG5cdFx0fVxuXHR9XG5cblx0cHVibGljIGdldFZpZXdTdGF0ZSgpOiBJTXVsdGlEaWZmRWRpdG9yVmlld1N0YXRlIHtcblx0XHRyZXR1cm4ge1xuXHRcdFx0c2Nyb2xsU3RhdGU6IHtcblx0XHRcdFx0dG9wOiB0aGlzLnNjcm9sbFRvcC5nZXQoKSxcblx0XHRcdFx0bGVmdDogdGhpcy5zY3JvbGxMZWZ0LmdldCgpLFxuXHRcdFx0fSxcblx0XHRcdGRvY1N0YXRlczogT2JqZWN0LmZyb21FbnRyaWVzKHRoaXMuX3ZpZXdJdGVtcy5nZXQoKS5tYXAoaSA9PiBbaS5nZXRLZXkoKSwgaS5nZXRWaWV3U3RhdGUoKV0pKSxcblx0XHR9O1xuXHR9XG5cblx0LyoqIFRoaXMgYWNjb3VudHMgZm9yIGRvY3VtZW50cyB0aGF0IGFyZSBub3QgbG9hZGVkIHlldC4gKi9cblx0cHJpdmF0ZSBfbGFzdERvY1N0YXRlczogSU11bHRpRGlmZkVkaXRvclZpZXdTdGF0ZVsnZG9jU3RhdGVzJ10gPSB7fTtcblxuXHRwdWJsaWMgc2V0Vmlld1N0YXRlKHZpZXdTdGF0ZTogSU11bHRpRGlmZkVkaXRvclZpZXdTdGF0ZSk6IHZvaWQge1xuXHRcdHRoaXMuc2V0U2Nyb2xsU3RhdGUodmlld1N0YXRlLnNjcm9sbFN0YXRlKTtcblxuXHRcdHRoaXMuX2xhc3REb2NTdGF0ZXMgPSB2aWV3U3RhdGUuZG9jU3RhdGVzO1xuXG5cdFx0dHJhbnNhY3Rpb24odHggPT4ge1xuXHRcdFx0LyoqIHNldFZpZXdTdGF0ZSAqL1xuXHRcdFx0aWYgKHZpZXdTdGF0ZS5kb2NTdGF0ZXMpIHtcblx0XHRcdFx0Zm9yIChjb25zdCBpIG9mIHRoaXMuX3ZpZXdJdGVtcy5nZXQoKSkge1xuXHRcdFx0XHRcdGNvbnN0IHN0YXRlID0gdmlld1N0YXRlLmRvY1N0YXRlc1tpLmdldEtleSgpXTtcblx0XHRcdFx0XHRpZiAoc3RhdGUpIHtcblx0XHRcdFx0XHRcdGkuc2V0Vmlld1N0YXRlKHN0YXRlLCB0eCk7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0fSk7XG5cdH1cblxuXHRwdWJsaWMgZmluZERvY3VtZW50RGlmZkl0ZW0ocmVzb3VyY2U6IFVSSSk6IElEb2N1bWVudERpZmZJdGVtIHwgdW5kZWZpbmVkIHtcblx0XHRjb25zdCBpdGVtID0gdGhpcy5fdmlld0l0ZW1zLmdldCgpLmZpbmQodiA9PlxuXHRcdFx0di52aWV3TW9kZWwuZGlmZkVkaXRvclZpZXdNb2RlbC5tb2RlbC5tb2RpZmllZC51cmkudG9TdHJpbmcoKSA9PT0gcmVzb3VyY2UudG9TdHJpbmcoKVxuXHRcdFx0fHwgdi52aWV3TW9kZWwuZGlmZkVkaXRvclZpZXdNb2RlbC5tb2RlbC5vcmlnaW5hbC51cmkudG9TdHJpbmcoKSA9PT0gcmVzb3VyY2UudG9TdHJpbmcoKVxuXHRcdCk7XG5cdFx0cmV0dXJuIGl0ZW0/LnZpZXdNb2RlbC5kb2N1bWVudERpZmZJdGVtO1xuXHR9XG5cblx0cHVibGljIHRyeUdldENvZGVFZGl0b3IocmVzb3VyY2U6IFVSSSk6IHsgZGlmZkVkaXRvcjogSURpZmZFZGl0b3I7IGVkaXRvcjogSUNvZGVFZGl0b3IgfSB8IHVuZGVmaW5lZCB7XG5cdFx0Y29uc3QgaXRlbSA9IHRoaXMuX3ZpZXdJdGVtcy5nZXQoKS5maW5kKHYgPT5cblx0XHRcdHYudmlld01vZGVsLmRpZmZFZGl0b3JWaWV3TW9kZWwubW9kZWwubW9kaWZpZWQudXJpLnRvU3RyaW5nKCkgPT09IHJlc291cmNlLnRvU3RyaW5nKClcblx0XHRcdHx8IHYudmlld01vZGVsLmRpZmZFZGl0b3JWaWV3TW9kZWwubW9kZWwub3JpZ2luYWwudXJpLnRvU3RyaW5nKCkgPT09IHJlc291cmNlLnRvU3RyaW5nKClcblx0XHQpO1xuXHRcdGNvbnN0IGVkaXRvciA9IGl0ZW0/LnRlbXBsYXRlLmdldCgpPy5lZGl0b3I7XG5cdFx0aWYgKCFlZGl0b3IpIHtcblx0XHRcdHJldHVybiB1bmRlZmluZWQ7XG5cdFx0fVxuXG5cdFx0aWYgKGl0ZW0udmlld01vZGVsLmRpZmZFZGl0b3JWaWV3TW9kZWwubW9kZWwubW9kaWZpZWQudXJpLnRvU3RyaW5nKCkgPT09IHJlc291cmNlLnRvU3RyaW5nKCkpIHtcblx0XHRcdHJldHVybiB7IGRpZmZFZGl0b3I6IGVkaXRvciwgZWRpdG9yOiBlZGl0b3IuZ2V0TW9kaWZpZWRFZGl0b3IoKSB9O1xuXHRcdH0gZWxzZSB7XG5cdFx0XHRyZXR1cm4geyBkaWZmRWRpdG9yOiBlZGl0b3IsIGVkaXRvcjogZWRpdG9yLmdldE9yaWdpbmFsRWRpdG9yKCkgfTtcblx0XHR9XG5cdH1cblxuXHRwcml2YXRlIHJlbmRlcihyZWFkZXI6IElSZWFkZXIgfCB1bmRlZmluZWQpIHtcblx0XHRjb25zdCBzY3JvbGxUb3AgPSB0aGlzLnNjcm9sbFRvcC5yZWFkKHJlYWRlcik7XG5cdFx0bGV0IGNvbnRlbnRTY3JvbGxPZmZzZXRUb1Njcm9sbE9mZnNldCA9IDA7XG5cdFx0bGV0IGl0ZW1IZWlnaHRTdW1CZWZvcmUgPSAwO1xuXHRcdGxldCBpdGVtQ29udGVudEhlaWdodFN1bUJlZm9yZSA9IDA7XG5cdFx0Y29uc3Qgdmlld1BvcnRIZWlnaHQgPSB0aGlzLl9zaXplT2JzZXJ2ZXIuaGVpZ2h0LnJlYWQocmVhZGVyKTtcblx0XHRjb25zdCBjb250ZW50Vmlld1BvcnQgPSBPZmZzZXRSYW5nZS5vZlN0YXJ0QW5kTGVuZ3RoKHNjcm9sbFRvcCwgdmlld1BvcnRIZWlnaHQpO1xuXG5cdFx0Y29uc3Qgd2lkdGggPSB0aGlzLl9zaXplT2JzZXJ2ZXIud2lkdGgucmVhZChyZWFkZXIpO1xuXG5cdFx0Zm9yIChjb25zdCB2IG9mIHRoaXMuX3ZpZXdJdGVtcy5yZWFkKHJlYWRlcikpIHtcblx0XHRcdGNvbnN0IGl0ZW1Db250ZW50SGVpZ2h0ID0gdi5jb250ZW50SGVpZ2h0LnJlYWQocmVhZGVyKTtcblx0XHRcdGNvbnN0IGl0ZW1IZWlnaHQgPSBNYXRoLm1pbihpdGVtQ29udGVudEhlaWdodCwgdmlld1BvcnRIZWlnaHQpO1xuXHRcdFx0Y29uc3QgaXRlbVJhbmdlID0gT2Zmc2V0UmFuZ2Uub2ZTdGFydEFuZExlbmd0aChpdGVtSGVpZ2h0U3VtQmVmb3JlLCBpdGVtSGVpZ2h0KTtcblx0XHRcdGNvbnN0IGl0ZW1Db250ZW50UmFuZ2UgPSBPZmZzZXRSYW5nZS5vZlN0YXJ0QW5kTGVuZ3RoKGl0ZW1Db250ZW50SGVpZ2h0U3VtQmVmb3JlLCBpdGVtQ29udGVudEhlaWdodCk7XG5cblx0XHRcdGlmIChpdGVtQ29udGVudFJhbmdlLmlzQmVmb3JlKGNvbnRlbnRWaWV3UG9ydCkpIHtcblx0XHRcdFx0Y29udGVudFNjcm9sbE9mZnNldFRvU2Nyb2xsT2Zmc2V0IC09IGl0ZW1Db250ZW50SGVpZ2h0IC0gaXRlbUhlaWdodDtcblx0XHRcdFx0di5oaWRlKCk7XG5cdFx0XHR9IGVsc2UgaWYgKGl0ZW1Db250ZW50UmFuZ2UuaXNBZnRlcihjb250ZW50Vmlld1BvcnQpKSB7XG5cdFx0XHRcdHYuaGlkZSgpO1xuXHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0Y29uc3Qgc2Nyb2xsID0gTWF0aC5tYXgoMCwgTWF0aC5taW4oY29udGVudFZpZXdQb3J0LnN0YXJ0IC0gaXRlbUNvbnRlbnRSYW5nZS5zdGFydCwgaXRlbUNvbnRlbnRIZWlnaHQgLSBpdGVtSGVpZ2h0KSk7XG5cdFx0XHRcdGNvbnRlbnRTY3JvbGxPZmZzZXRUb1Njcm9sbE9mZnNldCAtPSBzY3JvbGw7XG5cdFx0XHRcdGNvbnN0IHZpZXdQb3J0ID0gT2Zmc2V0UmFuZ2Uub2ZTdGFydEFuZExlbmd0aChzY3JvbGxUb3AgKyBjb250ZW50U2Nyb2xsT2Zmc2V0VG9TY3JvbGxPZmZzZXQsIHZpZXdQb3J0SGVpZ2h0KTtcblx0XHRcdFx0di5yZW5kZXIoaXRlbVJhbmdlLCBzY3JvbGwsIHdpZHRoLCB2aWV3UG9ydCk7XG5cdFx0XHR9XG5cblx0XHRcdGl0ZW1IZWlnaHRTdW1CZWZvcmUgKz0gaXRlbUhlaWdodCArIHRoaXMuX3NwYWNlQmV0d2VlblB4O1xuXHRcdFx0aXRlbUNvbnRlbnRIZWlnaHRTdW1CZWZvcmUgKz0gaXRlbUNvbnRlbnRIZWlnaHQgKyB0aGlzLl9zcGFjZUJldHdlZW5QeDtcblx0XHR9XG5cblx0XHR0aGlzLl9zY3JvbGxhYmxlRWxlbWVudHMuY29udGVudC5zdHlsZS50cmFuc2Zvcm0gPSBgdHJhbnNsYXRlWSgkey0oc2Nyb2xsVG9wICsgY29udGVudFNjcm9sbE9mZnNldFRvU2Nyb2xsT2Zmc2V0KX1weClgO1xuXHR9XG59XG5cbmZ1bmN0aW9uIGhpZ2hsaWdodFJhbmdlKHRhcmdldEVkaXRvcjogSUNvZGVFZGl0b3IsIHJhbmdlOiBJUmFuZ2UpIHtcblx0Y29uc3QgbW9kZWxOb3cgPSB0YXJnZXRFZGl0b3IuZ2V0TW9kZWwoKTtcblx0Y29uc3QgZGVjb3JhdGlvbnMgPSB0YXJnZXRFZGl0b3IuY3JlYXRlRGVjb3JhdGlvbnNDb2xsZWN0aW9uKFt7IHJhbmdlLCBvcHRpb25zOiB7IGRlc2NyaXB0aW9uOiAnc3ltYm9sLW5hdmlnYXRlLWFjdGlvbi1oaWdobGlnaHQnLCBjbGFzc05hbWU6ICdzeW1ib2xIaWdobGlnaHQnIH0gfV0pO1xuXHRzZXRUaW1lb3V0KCgpID0+IHtcblx0XHRpZiAodGFyZ2V0RWRpdG9yLmdldE1vZGVsKCkgPT09IG1vZGVsTm93KSB7XG5cdFx0XHRkZWNvcmF0aW9ucy5jbGVhcigpO1xuXHRcdH1cblx0fSwgMzUwKTtcbn1cblxuZXhwb3J0IGludGVyZmFjZSBJTXVsdGlEaWZmRWRpdG9yVmlld1N0YXRlIHtcblx0c2Nyb2xsU3RhdGU6IHsgdG9wOiBudW1iZXI7IGxlZnQ6IG51bWJlciB9O1xuXHRkb2NTdGF0ZXM/OiBSZWNvcmQ8c3RyaW5nLCBJTXVsdGlEaWZmRG9jU3RhdGU+O1xufVxuXG5pbnRlcmZhY2UgSU11bHRpRGlmZkRvY1N0YXRlIHtcblx0Y29sbGFwc2VkOiBib29sZWFuO1xuXHRzZWxlY3Rpb25zPzogSVNlbGVjdGlvbltdO1xufVxuXG5leHBvcnQgaW50ZXJmYWNlIElNdWx0aURpZmZFZGl0b3JPcHRpb25zIGV4dGVuZHMgSVRleHRFZGl0b3JPcHRpb25zIHtcblx0dmlld1N0YXRlPzogSU11bHRpRGlmZkVkaXRvck9wdGlvbnNWaWV3U3RhdGU7XG59XG5cbmV4cG9ydCBpbnRlcmZhY2UgSU11bHRpRGlmZkVkaXRvck9wdGlvbnNWaWV3U3RhdGUge1xuXHRyZXZlYWxEYXRhPzoge1xuXHRcdHJlc291cmNlOiBJTXVsdGlEaWZmUmVzb3VyY2VJZDtcblx0XHRyYW5nZT86IElSYW5nZTtcblx0fTtcbn1cblxuZXhwb3J0IHR5cGUgSU11bHRpRGlmZlJlc291cmNlSWQgPSB7IG9yaWdpbmFsOiBVUkkgfCB1bmRlZmluZWQ7IG1vZGlmaWVkOiBVUkkgfCB1bmRlZmluZWQgfTtcblxuY2xhc3MgVmlydHVhbGl6ZWRWaWV3SXRlbSBleHRlbmRzIERpc3Bvc2FibGUge1xuXHRwcml2YXRlIHJlYWRvbmx5IF90ZW1wbGF0ZVJlZiA9IHRoaXMuX3JlZ2lzdGVyKGRpc3Bvc2FibGVPYnNlcnZhYmxlVmFsdWU8SVJlZmVyZW5jZTxEaWZmRWRpdG9ySXRlbVRlbXBsYXRlPiB8IHVuZGVmaW5lZD4odGhpcywgdW5kZWZpbmVkKSk7XG5cblx0cHVibGljIHJlYWRvbmx5IGNvbnRlbnRIZWlnaHQgPSBkZXJpdmVkKHRoaXMsIHJlYWRlciA9PlxuXHRcdHRoaXMuX3RlbXBsYXRlUmVmLnJlYWQocmVhZGVyKT8ub2JqZWN0LmNvbnRlbnRIZWlnaHQ/LnJlYWQocmVhZGVyKSA/PyB0aGlzLnZpZXdNb2RlbC5sYXN0VGVtcGxhdGVEYXRhLnJlYWQocmVhZGVyKS5jb250ZW50SGVpZ2h0XG5cdCk7XG5cblx0cHVibGljIHJlYWRvbmx5IG1heFNjcm9sbCA9IGRlcml2ZWQodGhpcywgcmVhZGVyID0+IHRoaXMuX3RlbXBsYXRlUmVmLnJlYWQocmVhZGVyKT8ub2JqZWN0Lm1heFNjcm9sbC5yZWFkKHJlYWRlcikgPz8geyBtYXhTY3JvbGw6IDAsIHNjcm9sbFdpZHRoOiAwIH0pO1xuXG5cdHB1YmxpYyByZWFkb25seSB0ZW1wbGF0ZSA9IGRlcml2ZWQodGhpcywgcmVhZGVyID0+IHRoaXMuX3RlbXBsYXRlUmVmLnJlYWQocmVhZGVyKT8ub2JqZWN0KTtcblx0cHJpdmF0ZSBfaXNIaWRkZW4gPSBvYnNlcnZhYmxlVmFsdWUodGhpcywgZmFsc2UpO1xuXG5cdHByaXZhdGUgcmVhZG9ubHkgX2lzRm9jdXNlZCA9IGRlcml2ZWQodGhpcywgcmVhZGVyID0+IHRoaXMudGVtcGxhdGUucmVhZChyZWFkZXIpPy5pc0ZvY3VzZWQucmVhZChyZWFkZXIpID8/IGZhbHNlKTtcblxuXHRjb25zdHJ1Y3Rvcihcblx0XHRwdWJsaWMgcmVhZG9ubHkgdmlld01vZGVsOiBEb2N1bWVudERpZmZJdGVtVmlld01vZGVsLFxuXHRcdHByaXZhdGUgcmVhZG9ubHkgX29iamVjdFBvb2w6IE9iamVjdFBvb2w8VGVtcGxhdGVEYXRhLCBEaWZmRWRpdG9ySXRlbVRlbXBsYXRlPixcblx0XHRwcml2YXRlIHJlYWRvbmx5IF9zY3JvbGxMZWZ0OiBJT2JzZXJ2YWJsZTxudW1iZXI+LFxuXHRcdHByaXZhdGUgcmVhZG9ubHkgX2RlbHRhU2Nyb2xsVmVydGljYWw6IChkZWx0YTogbnVtYmVyKSA9PiB2b2lkLFxuXHQpIHtcblx0XHRzdXBlcigpO1xuXG5cdFx0dGhpcy52aWV3TW9kZWwuc2V0SXNGb2N1c2VkKHRoaXMuX2lzRm9jdXNlZCwgdW5kZWZpbmVkKTtcblxuXHRcdHRoaXMuX3JlZ2lzdGVyKGF1dG9ydW4oKHJlYWRlcikgPT4ge1xuXHRcdFx0Y29uc3Qgc2Nyb2xsTGVmdCA9IHRoaXMuX3Njcm9sbExlZnQucmVhZChyZWFkZXIpO1xuXHRcdFx0dGhpcy5fdGVtcGxhdGVSZWYucmVhZChyZWFkZXIpPy5vYmplY3Quc2V0U2Nyb2xsTGVmdChzY3JvbGxMZWZ0KTtcblx0XHR9KSk7XG5cblx0XHR0aGlzLl9yZWdpc3RlcihhdXRvcnVuKHJlYWRlciA9PiB7XG5cdFx0XHRjb25zdCByZWYgPSB0aGlzLl90ZW1wbGF0ZVJlZi5yZWFkKHJlYWRlcik7XG5cdFx0XHRpZiAoIXJlZikgeyByZXR1cm47IH1cblx0XHRcdGNvbnN0IGlzSGlkZGVuID0gdGhpcy5faXNIaWRkZW4ucmVhZChyZWFkZXIpO1xuXHRcdFx0aWYgKCFpc0hpZGRlbikgeyByZXR1cm47IH1cblxuXHRcdFx0Y29uc3QgaXNGb2N1c2VkID0gcmVmLm9iamVjdC5pc0ZvY3VzZWQucmVhZChyZWFkZXIpO1xuXHRcdFx0aWYgKGlzRm9jdXNlZCkgeyByZXR1cm47IH1cblxuXHRcdFx0dGhpcy5fY2xlYXIoKTtcblx0XHR9KSk7XG5cdH1cblxuXHRvdmVycmlkZSBkaXNwb3NlKCk6IHZvaWQge1xuXHRcdHRoaXMuX2NsZWFyKCk7XG5cdFx0c3VwZXIuZGlzcG9zZSgpO1xuXHR9XG5cblx0cHVibGljIG92ZXJyaWRlIHRvU3RyaW5nKCk6IHN0cmluZyB7XG5cdFx0cmV0dXJuIGBWaXJ0dWFsVmlld0l0ZW0oJHt0aGlzLnZpZXdNb2RlbC5kb2N1bWVudERpZmZJdGVtLm1vZGlmaWVkPy51cmkudG9TdHJpbmcoKX0pYDtcblx0fVxuXG5cdHB1YmxpYyBnZXRLZXkoKTogc3RyaW5nIHtcblx0XHRyZXR1cm4gdGhpcy52aWV3TW9kZWwuZ2V0S2V5KCk7XG5cdH1cblxuXHRwdWJsaWMgZ2V0Vmlld1N0YXRlKCk6IElNdWx0aURpZmZEb2NTdGF0ZSB7XG5cdFx0dHJhbnNhY3Rpb24odHggPT4ge1xuXHRcdFx0dGhpcy5fdXBkYXRlVGVtcGxhdGVEYXRhKHR4KTtcblx0XHR9KTtcblx0XHRyZXR1cm4ge1xuXHRcdFx0Y29sbGFwc2VkOiB0aGlzLnZpZXdNb2RlbC5jb2xsYXBzZWQuZ2V0KCksXG5cdFx0XHRzZWxlY3Rpb25zOiB0aGlzLnZpZXdNb2RlbC5sYXN0VGVtcGxhdGVEYXRhLmdldCgpLnNlbGVjdGlvbnMsXG5cdFx0fTtcblx0fVxuXG5cdHB1YmxpYyBzZXRWaWV3U3RhdGUodmlld1N0YXRlOiBJTXVsdGlEaWZmRG9jU3RhdGUsIHR4OiBJVHJhbnNhY3Rpb24pOiB2b2lkIHtcblx0XHR0aGlzLnZpZXdNb2RlbC5jb2xsYXBzZWQuc2V0KHZpZXdTdGF0ZS5jb2xsYXBzZWQsIHR4KTtcblxuXHRcdHRoaXMuX3VwZGF0ZVRlbXBsYXRlRGF0YSh0eCk7XG5cdFx0Y29uc3QgZGF0YSA9IHRoaXMudmlld01vZGVsLmxhc3RUZW1wbGF0ZURhdGEuZ2V0KCk7XG5cdFx0Y29uc3Qgc2VsZWN0aW9ucyA9IHZpZXdTdGF0ZS5zZWxlY3Rpb25zPy5tYXAoU2VsZWN0aW9uLmxpZnRTZWxlY3Rpb24pO1xuXHRcdHRoaXMudmlld01vZGVsLmxhc3RUZW1wbGF0ZURhdGEuc2V0KHtcblx0XHRcdC4uLmRhdGEsXG5cdFx0XHRzZWxlY3Rpb25zLFxuXHRcdH0sIHR4KTtcblx0XHRjb25zdCByZWYgPSB0aGlzLl90ZW1wbGF0ZVJlZi5nZXQoKTtcblx0XHRpZiAocmVmKSB7XG5cdFx0XHRpZiAoc2VsZWN0aW9ucykge1xuXHRcdFx0XHRyZWYub2JqZWN0LmVkaXRvci5zZXRTZWxlY3Rpb25zKHNlbGVjdGlvbnMpO1xuXHRcdFx0fVxuXHRcdH1cblx0fVxuXG5cdHByaXZhdGUgX3VwZGF0ZVRlbXBsYXRlRGF0YSh0eDogSVRyYW5zYWN0aW9uKTogdm9pZCB7XG5cdFx0Y29uc3QgcmVmID0gdGhpcy5fdGVtcGxhdGVSZWYuZ2V0KCk7XG5cdFx0aWYgKCFyZWYpIHsgcmV0dXJuOyB9XG5cdFx0dGhpcy52aWV3TW9kZWwubGFzdFRlbXBsYXRlRGF0YS5zZXQoe1xuXHRcdFx0Y29udGVudEhlaWdodDogcmVmLm9iamVjdC5jb250ZW50SGVpZ2h0LmdldCgpLFxuXHRcdFx0c2VsZWN0aW9uczogcmVmLm9iamVjdC5lZGl0b3IuZ2V0U2VsZWN0aW9ucygpID8/IHVuZGVmaW5lZCxcblx0XHR9LCB0eCk7XG5cdH1cblxuXHRwcml2YXRlIF9jbGVhcigpOiB2b2lkIHtcblx0XHRjb25zdCByZWYgPSB0aGlzLl90ZW1wbGF0ZVJlZi5nZXQoKTtcblx0XHRpZiAoIXJlZikgeyByZXR1cm47IH1cblx0XHR0cmFuc2FjdGlvbih0eCA9PiB7XG5cdFx0XHR0aGlzLl91cGRhdGVUZW1wbGF0ZURhdGEodHgpO1xuXHRcdFx0cmVmLm9iamVjdC5oaWRlKCk7XG5cdFx0XHR0aGlzLl90ZW1wbGF0ZVJlZi5zZXQodW5kZWZpbmVkLCB0eCk7XG5cdFx0fSk7XG5cdH1cblxuXHRwdWJsaWMgaGlkZSgpOiB2b2lkIHtcblx0XHR0aGlzLl9pc0hpZGRlbi5zZXQodHJ1ZSwgdW5kZWZpbmVkKTtcblx0fVxuXG5cdHB1YmxpYyByZW5kZXIodmVydGljYWxTcGFjZTogT2Zmc2V0UmFuZ2UsIG9mZnNldDogbnVtYmVyLCB3aWR0aDogbnVtYmVyLCB2aWV3UG9ydDogT2Zmc2V0UmFuZ2UpOiB2b2lkIHtcblx0XHR0aGlzLl9pc0hpZGRlbi5zZXQoZmFsc2UsIHVuZGVmaW5lZCk7XG5cblx0XHRsZXQgcmVmID0gdGhpcy5fdGVtcGxhdGVSZWYuZ2V0KCk7XG5cdFx0aWYgKCFyZWYpIHtcblx0XHRcdHJlZiA9IHRoaXMuX29iamVjdFBvb2wuZ2V0VW51c2VkT2JqKG5ldyBUZW1wbGF0ZURhdGEodGhpcy52aWV3TW9kZWwsIHRoaXMuX2RlbHRhU2Nyb2xsVmVydGljYWwpKTtcblx0XHRcdHRoaXMuX3RlbXBsYXRlUmVmLnNldChyZWYsIHVuZGVmaW5lZCk7XG5cblx0XHRcdGNvbnN0IHNlbGVjdGlvbnMgPSB0aGlzLnZpZXdNb2RlbC5sYXN0VGVtcGxhdGVEYXRhLmdldCgpLnNlbGVjdGlvbnM7XG5cdFx0XHRpZiAoc2VsZWN0aW9ucykge1xuXHRcdFx0XHRyZWYub2JqZWN0LmVkaXRvci5zZXRTZWxlY3Rpb25zKHNlbGVjdGlvbnMpO1xuXHRcdFx0fVxuXHRcdH1cblx0XHRyZWYub2JqZWN0LnJlbmRlcih2ZXJ0aWNhbFNwYWNlLCB3aWR0aCwgb2Zmc2V0LCB2aWV3UG9ydCk7XG5cdH1cbn1cbiJdLAogICJtYXBwaW5ncyI6ICI7Ozs7Ozs7Ozs7O0FBS0EsU0FBb0IsV0FBVyxHQUFHLG9DQUFvQztBQUN0RSxTQUFTLCtCQUErQjtBQUN4QyxTQUFTLFdBQVcsd0JBQXdCO0FBQzVDLFNBQVMsb0JBQW9CO0FBQzdCLFNBQVMsMEJBQTBCO0FBQ25DLFNBQVMsWUFBd0Isb0JBQW9CO0FBQ3JELFNBQTZDLFNBQVMsa0JBQWtCLFNBQVMsa0JBQWtCLDJCQUEyQixtQkFBbUIscUJBQXFCLGlCQUFpQixtQkFBbUI7QUFDMU0sU0FBUyxZQUFZLDJCQUEyQjtBQUVoRCxTQUFTLGdCQUFnQjtBQUN6QixTQUEwQiwwQkFBMEI7QUFFcEQsU0FBUyw2QkFBNkI7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
