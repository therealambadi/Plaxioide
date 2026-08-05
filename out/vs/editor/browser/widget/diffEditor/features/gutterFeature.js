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
import { EventType, addDisposableListener, h } from "../../../../../base/browser/dom.js";
import { ActionsOrientation } from "../../../../../base/browser/ui/actionbar/actionbar.js";
import { HoverPosition } from "../../../../../base/browser/ui/hover/hoverWidget.js";
import { Disposable } from "../../../../../base/common/lifecycle.js";
import { autorun, autorunWithStore, derived, derivedDisposable, derivedWithSetter, observableFromEvent, observableValue } from "../../../../../base/common/observable.js";
import { HiddenItemStrategy, MenuWorkbenchToolBar } from "../../../../../platform/actions/browser/toolbar.js";
import { IMenuService, MenuId } from "../../../../../platform/actions/common/actions.js";
import { IContextKeyService } from "../../../../../platform/contextkey/common/contextkey.js";
import { WorkbenchHoverDelegate } from "../../../../../platform/hover/browser/hover.js";
import { IInstantiationService } from "../../../../../platform/instantiation/common/instantiation.js";
import { EditorOption } from "../../../../common/config/editorOptions.js";
import { LineRange, LineRangeSet } from "../../../../common/core/lineRange.js";
import { OffsetRange } from "../../../../common/core/offsetRange.js";
import { Range } from "../../../../common/core/range.js";
import { TextEdit } from "../../../../common/core/textEdit.js";
import { DetailedLineRangeMapping } from "../../../../common/diff/rangeMapping.js";
import { TextModelText } from "../../../../common/model/textModelText.js";
import { ActionRunnerWithContext } from "../../multiDiffEditor/utils.js";
import { DiffEditorSash } from "../components/diffEditorSash.js";
import { appendRemoveOnDispose, applyStyle, prependRemoveOnDispose } from "../utils.js";
import { EditorGutter } from "../utils/editorGutter.js";
const emptyArr = [];
const width = 35;
let DiffEditorGutter = class extends Disposable {
  constructor(diffEditorRoot, _diffModel, _editors, _options, _sashLayout, _boundarySashes, _instantiationService, _contextKeyService, _menuService) {
    super();
    this._diffModel = _diffModel;
    this._editors = _editors;
    this._options = _options;
    this._sashLayout = _sashLayout;
    this._boundarySashes = _boundarySashes;
    this._instantiationService = _instantiationService;
    this._contextKeyService = _contextKeyService;
    this._menuService = _menuService;
    this._menu = this._register(this._menuService.createMenu(MenuId.DiffEditorHunkToolbar, this._contextKeyService));
    this._actions = observableFromEvent(this, this._menu.onDidChange, () => this._menu.getActions());
    this._hasActions = this._actions.map((a) => a.length > 0);
    this._showSash = derived(this, (reader) => this._options.renderSideBySide.read(reader) && this._hasActions.read(reader));
    this.width = derived(this, (reader) => this._hasActions.read(reader) ? width : 0);
    this.elements = h("div.gutter@gutter", { style: { position: "absolute", height: "100%", width: width + "px" } }, []);
    this._currentDiff = derived(this, (reader) => {
      const model = this._diffModel.read(reader);
      if (!model) {
        return void 0;
      }
      const mappings = model.diff.read(reader)?.mappings;
      const cursorPosition = this._editors.modifiedCursor.read(reader);
      if (!cursorPosition) {
        return void 0;
      }
      return mappings?.find((m) => m.lineRangeMapping.modified.contains(cursorPosition.lineNumber));
    });
    this._selectedDiffs = derived(this, (reader) => {
      const model = this._diffModel.read(reader);
      const diff = model?.diff.read(reader);
      if (!diff) {
        return emptyArr;
      }
      const selections = this._editors.modifiedSelections.read(reader);
      if (selections.every((s) => s.isEmpty())) {
        return emptyArr;
      }
      const selectedLineNumbers = new LineRangeSet(selections.map((s) => LineRange.fromRangeInclusive(s)));
      const selectedMappings = diff.mappings.filter(
        (m) => m.lineRangeMapping.innerChanges && selectedLineNumbers.intersects(m.lineRangeMapping.modified)
      );
      const result = selectedMappings.map((mapping) => ({
        mapping,
        rangeMappings: mapping.lineRangeMapping.innerChanges.filter(
          (c) => selections.some((s) => Range.areIntersecting(c.modifiedRange, s))
        )
      }));
      if (result.length === 0 || result.every((r) => r.rangeMappings.length === 0)) {
        return emptyArr;
      }
      return result;
    });
    this._register(prependRemoveOnDispose(diffEditorRoot, this.elements.root));
    this._register(addDisposableListener(this.elements.root, "click", () => {
      this._editors.modified.focus();
    }));
    this._register(applyStyle(this.elements.root, { display: this._hasActions.map((a) => a ? "block" : "none") }));
    derivedDisposable(this, (reader) => {
      const showSash = this._showSash.read(reader);
      return !showSash ? void 0 : new DiffEditorSash(
        diffEditorRoot,
        this._sashLayout.dimensions,
        this._options.enableSplitViewResizing,
        this._boundarySashes,
        derivedWithSetter(
          this,
          (reader2) => this._sashLayout.sashLeft.read(reader2) - width,
          (v, tx) => this._sashLayout.sashLeft.set(v + width, tx)
        ),
        () => this._sashLayout.resetSash()
      );
    }).recomputeInitiallyAndOnChange(this._store);
    const gutterItems = derived(this, (reader) => {
      const model = this._diffModel.read(reader);
      if (!model) {
        return [];
      }
      const diffs = model.diff.read(reader);
      if (!diffs) {
        return [];
      }
      const selection = this._selectedDiffs.read(reader);
      if (selection.length > 0) {
        const m = DetailedLineRangeMapping.fromRangeMappings(selection.flatMap((s) => s.rangeMappings));
        return [
          new DiffGutterItem(
            m,
            true,
            MenuId.DiffEditorSelectionToolbar,
            void 0,
            model.model.original.uri,
            model.model.modified.uri
          )
        ];
      }
      const currentDiff = this._currentDiff.read(reader);
      return diffs.mappings.map((m) => new DiffGutterItem(
        m.lineRangeMapping.withInnerChangesFromLineRanges(),
        m.lineRangeMapping === currentDiff?.lineRangeMapping,
        MenuId.DiffEditorHunkToolbar,
        void 0,
        model.model.original.uri,
        model.model.modified.uri
      ));
    });
    this._register(new EditorGutter(this._editors.modified, this.elements.root, {
      getIntersectingGutterItems: (range, reader) => gutterItems.read(reader),
      createView: (item, target) => {
        return this._instantiationService.createInstance(DiffToolBar, item, target, this);
      }
    }));
    this._register(addDisposableListener(this.elements.gutter, EventType.MOUSE_WHEEL, (e) => {
      if (this._editors.modified.getOption(EditorOption.scrollbar).handleMouseWheel) {
        this._editors.modified.delegateScrollFromMouseWheelEvent(e);
      }
    }, { passive: false }));
  }
  computeStagedValue(mapping) {
    const c = mapping.innerChanges ?? [];
    const modified = new TextModelText(this._editors.modifiedModel.get());
    const original = new TextModelText(this._editors.original.getModel());
    const edit = new TextEdit(c.map((c2) => c2.toTextEdit(modified)));
    const value = edit.apply(original);
    return value;
  }
  layout(left) {
    this.elements.gutter.style.left = left + "px";
  }
};
DiffEditorGutter = __decorateClass([
  __decorateParam(6, IInstantiationService),
  __decorateParam(7, IContextKeyService),
  __decorateParam(8, IMenuService)
], DiffEditorGutter);
class DiffGutterItem {
  constructor(mapping, showAlways, menuId, rangeOverride, originalUri, modifiedUri) {
    this.mapping = mapping;
    this.showAlways = showAlways;
    this.menuId = menuId;
    this.rangeOverride = rangeOverride;
    this.originalUri = originalUri;
    this.modifiedUri = modifiedUri;
  }
  get id() {
    return this.mapping.modified.toString();
  }
  get range() {
    return this.rangeOverride ?? this.mapping.modified;
  }
}
let DiffToolBar = class extends Disposable {
  constructor(_item, target, gutter, instantiationService) {
    super();
    this._item = _item;
    this._elements = h("div.gutterItem", { style: { height: "20px", width: "34px" } }, [
      h("div.background@background", {}, []),
      h("div.buttons@buttons", {}, [])
    ]);
    this._showAlways = this._item.map(this, (item) => item.showAlways);
    this._menuId = this._item.map(this, (item) => item.menuId);
    this._isSmall = observableValue(this, false);
    this._lastItemRange = void 0;
    this._lastViewRange = void 0;
    const hoverDelegate = this._register(instantiationService.createInstance(
      WorkbenchHoverDelegate,
      "element",
      { instantHover: true },
      { position: { hoverPosition: HoverPosition.RIGHT } }
    ));
    this._register(appendRemoveOnDispose(target, this._elements.root));
    this._register(autorun((reader) => {
      const showAlways = this._showAlways.read(reader);
      this._elements.root.classList.toggle("noTransition", true);
      this._elements.root.classList.toggle("showAlways", showAlways);
      setTimeout(() => {
        this._elements.root.classList.toggle("noTransition", false);
      }, 0);
    }));
    this._register(autorunWithStore((reader, store) => {
      this._elements.buttons.replaceChildren();
      const i = store.add(instantiationService.createInstance(MenuWorkbenchToolBar, this._elements.buttons, this._menuId.read(reader), {
        orientation: ActionsOrientation.VERTICAL,
        hoverDelegate,
        toolbarOptions: {
          primaryGroup: (g) => g.startsWith("primary")
        },
        overflowBehavior: { maxItems: this._isSmall.read(reader) ? 1 : 3 },
        hiddenItemStrategy: HiddenItemStrategy.Ignore,
        actionRunner: store.add(new ActionRunnerWithContext(() => {
          const item = this._item.get();
          const mapping = item.mapping;
          return {
            mapping,
            originalWithModifiedChanges: gutter.computeStagedValue(mapping),
            originalUri: item.originalUri,
            modifiedUri: item.modifiedUri
          };
        })),
        menuOptions: {
          shouldForwardArgs: true
        }
      }));
      store.add(i.onDidChangeMenuItems(() => {
        if (this._lastItemRange) {
          this.layout(this._lastItemRange, this._lastViewRange);
        }
      }));
    }));
  }
  layout(itemRange, viewRange) {
    this._lastItemRange = itemRange;
    this._lastViewRange = viewRange;
    let itemHeight = this._elements.buttons.clientHeight;
    this._isSmall.set(this._item.get().mapping.original.startLineNumber === 1 && itemRange.length < 30, void 0);
    itemHeight = this._elements.buttons.clientHeight;
    const middleHeight = itemRange.length / 2 - itemHeight / 2;
    const margin = itemHeight;
    let effectiveCheckboxTop = itemRange.start + middleHeight;
    const preferredViewPortRange = OffsetRange.tryCreate(
      margin,
      viewRange.endExclusive - margin - itemHeight
    );
    const preferredParentRange = OffsetRange.tryCreate(
      itemRange.start + margin,
      itemRange.endExclusive - itemHeight - margin
    );
    if (preferredParentRange && preferredViewPortRange && preferredParentRange.start < preferredParentRange.endExclusive) {
      effectiveCheckboxTop = preferredViewPortRange.clip(effectiveCheckboxTop);
      effectiveCheckboxTop = preferredParentRange.clip(effectiveCheckboxTop);
    }
    this._elements.buttons.style.top = `${effectiveCheckboxTop - itemRange.start}px`;
  }
};
DiffToolBar = __decorateClass([
  __decorateParam(3, IInstantiationService)
], DiffToolBar);
export {
  DiffEditorGutter
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy9lZGl0b3IvYnJvd3Nlci93aWRnZXQvZGlmZkVkaXRvci9mZWF0dXJlcy9ndXR0ZXJGZWF0dXJlLnRzIl0sCiAgInNvdXJjZXNDb250ZW50IjogWyIvKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuICogIENvcHlyaWdodCAoYykgTWljcm9zb2Z0IENvcnBvcmF0aW9uLiBBbGwgcmlnaHRzIHJlc2VydmVkLlxuICogIExpY2Vuc2VkIHVuZGVyIHRoZSBNSVQgTGljZW5zZS4gU2VlIExpY2Vuc2UudHh0IGluIHRoZSBwcm9qZWN0IHJvb3QgZm9yIGxpY2Vuc2UgaW5mb3JtYXRpb24uXG4gKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tKi9cblxuaW1wb3J0IHsgRXZlbnRUeXBlLCBhZGREaXNwb3NhYmxlTGlzdGVuZXIsIGggfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9iYXNlL2Jyb3dzZXIvZG9tLmpzJztcbmltcG9ydCB7IElNb3VzZVdoZWVsRXZlbnQgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9iYXNlL2Jyb3dzZXIvbW91c2VFdmVudC5qcyc7XG5pbXBvcnQgeyBBY3Rpb25zT3JpZW50YXRpb24gfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9iYXNlL2Jyb3dzZXIvdWkvYWN0aW9uYmFyL2FjdGlvbmJhci5qcyc7XG5pbXBvcnQgeyBIb3ZlclBvc2l0aW9uIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vYmFzZS9icm93c2VyL3VpL2hvdmVyL2hvdmVyV2lkZ2V0LmpzJztcbmltcG9ydCB7IElCb3VuZGFyeVNhc2hlcyB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL2Jhc2UvYnJvd3Nlci91aS9zYXNoL3Nhc2guanMnO1xuaW1wb3J0IHsgRGlzcG9zYWJsZSB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2xpZmVjeWNsZS5qcyc7XG5pbXBvcnQgeyBJT2JzZXJ2YWJsZSwgYXV0b3J1biwgYXV0b3J1bldpdGhTdG9yZSwgZGVyaXZlZCwgZGVyaXZlZERpc3Bvc2FibGUsIGRlcml2ZWRXaXRoU2V0dGVyLCBvYnNlcnZhYmxlRnJvbUV2ZW50LCBvYnNlcnZhYmxlVmFsdWUgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9vYnNlcnZhYmxlLmpzJztcbmltcG9ydCB7IFVSSSB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL3VyaS5qcyc7XG5pbXBvcnQgeyBIaWRkZW5JdGVtU3RyYXRlZ3ksIE1lbnVXb3JrYmVuY2hUb29sQmFyIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vcGxhdGZvcm0vYWN0aW9ucy9icm93c2VyL3Rvb2xiYXIuanMnO1xuaW1wb3J0IHsgSU1lbnVTZXJ2aWNlLCBNZW51SWQgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9wbGF0Zm9ybS9hY3Rpb25zL2NvbW1vbi9hY3Rpb25zLmpzJztcbmltcG9ydCB7IElDb250ZXh0S2V5U2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL3BsYXRmb3JtL2NvbnRleHRrZXkvY29tbW9uL2NvbnRleHRrZXkuanMnO1xuaW1wb3J0IHsgV29ya2JlbmNoSG92ZXJEZWxlZ2F0ZSB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL3BsYXRmb3JtL2hvdmVyL2Jyb3dzZXIvaG92ZXIuanMnO1xuaW1wb3J0IHsgSUluc3RhbnRpYXRpb25TZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vcGxhdGZvcm0vaW5zdGFudGlhdGlvbi9jb21tb24vaW5zdGFudGlhdGlvbi5qcyc7XG5pbXBvcnQgeyBFZGl0b3JPcHRpb24gfSBmcm9tICcuLi8uLi8uLi8uLi9jb21tb24vY29uZmlnL2VkaXRvck9wdGlvbnMuanMnO1xuaW1wb3J0IHsgTGluZVJhbmdlLCBMaW5lUmFuZ2VTZXQgfSBmcm9tICcuLi8uLi8uLi8uLi9jb21tb24vY29yZS9saW5lUmFuZ2UuanMnO1xuaW1wb3J0IHsgT2Zmc2V0UmFuZ2UgfSBmcm9tICcuLi8uLi8uLi8uLi9jb21tb24vY29yZS9vZmZzZXRSYW5nZS5qcyc7XG5pbXBvcnQgeyBSYW5nZSB9IGZyb20gJy4uLy4uLy4uLy4uL2NvbW1vbi9jb3JlL3JhbmdlLmpzJztcbmltcG9ydCB7IFRleHRFZGl0IH0gZnJvbSAnLi4vLi4vLi4vLi4vY29tbW9uL2NvcmUvdGV4dEVkaXQuanMnO1xuaW1wb3J0IHsgRGV0YWlsZWRMaW5lUmFuZ2VNYXBwaW5nIH0gZnJvbSAnLi4vLi4vLi4vLi4vY29tbW9uL2RpZmYvcmFuZ2VNYXBwaW5nLmpzJztcbmltcG9ydCB7IFRleHRNb2RlbFRleHQgfSBmcm9tICcuLi8uLi8uLi8uLi9jb21tb24vbW9kZWwvdGV4dE1vZGVsVGV4dC5qcyc7XG5pbXBvcnQgeyBBY3Rpb25SdW5uZXJXaXRoQ29udGV4dCB9IGZyb20gJy4uLy4uL211bHRpRGlmZkVkaXRvci91dGlscy5qcyc7XG5pbXBvcnQgeyBEaWZmRWRpdG9yRWRpdG9ycyB9IGZyb20gJy4uL2NvbXBvbmVudHMvZGlmZkVkaXRvckVkaXRvcnMuanMnO1xuaW1wb3J0IHsgRGlmZkVkaXRvclNhc2gsIFNhc2hMYXlvdXQgfSBmcm9tICcuLi9jb21wb25lbnRzL2RpZmZFZGl0b3JTYXNoLmpzJztcbmltcG9ydCB7IERpZmZFZGl0b3JPcHRpb25zIH0gZnJvbSAnLi4vZGlmZkVkaXRvck9wdGlvbnMuanMnO1xuaW1wb3J0IHsgRGlmZkVkaXRvclZpZXdNb2RlbCB9IGZyb20gJy4uL2RpZmZFZGl0b3JWaWV3TW9kZWwuanMnO1xuaW1wb3J0IHsgYXBwZW5kUmVtb3ZlT25EaXNwb3NlLCBhcHBseVN0eWxlLCBwcmVwZW5kUmVtb3ZlT25EaXNwb3NlIH0gZnJvbSAnLi4vdXRpbHMuanMnO1xuaW1wb3J0IHsgRWRpdG9yR3V0dGVyLCBJR3V0dGVySXRlbUluZm8sIElHdXR0ZXJJdGVtVmlldyB9IGZyb20gJy4uL3V0aWxzL2VkaXRvckd1dHRlci5qcyc7XG5cbmNvbnN0IGVtcHR5QXJyOiBuZXZlcltdID0gW107XG5jb25zdCB3aWR0aCA9IDM1O1xuXG5leHBvcnQgY2xhc3MgRGlmZkVkaXRvckd1dHRlciBleHRlbmRzIERpc3Bvc2FibGUge1xuXHRwcml2YXRlIHJlYWRvbmx5IF9tZW51ID0gdGhpcy5fcmVnaXN0ZXIodGhpcy5fbWVudVNlcnZpY2UuY3JlYXRlTWVudShNZW51SWQuRGlmZkVkaXRvckh1bmtUb29sYmFyLCB0aGlzLl9jb250ZXh0S2V5U2VydmljZSkpO1xuXHRwcml2YXRlIHJlYWRvbmx5IF9hY3Rpb25zID0gb2JzZXJ2YWJsZUZyb21FdmVudCh0aGlzLCB0aGlzLl9tZW51Lm9uRGlkQ2hhbmdlLCAoKSA9PiB0aGlzLl9tZW51LmdldEFjdGlvbnMoKSk7XG5cdHByaXZhdGUgcmVhZG9ubHkgX2hhc0FjdGlvbnMgPSB0aGlzLl9hY3Rpb25zLm1hcChhID0+IGEubGVuZ3RoID4gMCk7XG5cdHByaXZhdGUgcmVhZG9ubHkgX3Nob3dTYXNoID0gZGVyaXZlZCh0aGlzLCByZWFkZXIgPT4gdGhpcy5fb3B0aW9ucy5yZW5kZXJTaWRlQnlTaWRlLnJlYWQocmVhZGVyKSAmJiB0aGlzLl9oYXNBY3Rpb25zLnJlYWQocmVhZGVyKSk7XG5cblx0cHVibGljIHJlYWRvbmx5IHdpZHRoID0gZGVyaXZlZCh0aGlzLCByZWFkZXIgPT4gdGhpcy5faGFzQWN0aW9ucy5yZWFkKHJlYWRlcikgPyB3aWR0aCA6IDApO1xuXG5cdHByaXZhdGUgcmVhZG9ubHkgZWxlbWVudHMgPSBoKCdkaXYuZ3V0dGVyQGd1dHRlcicsIHsgc3R5bGU6IHsgcG9zaXRpb246ICdhYnNvbHV0ZScsIGhlaWdodDogJzEwMCUnLCB3aWR0aDogd2lkdGggKyAncHgnIH0gfSwgW10pO1xuXG5cdGNvbnN0cnVjdG9yKFxuXHRcdGRpZmZFZGl0b3JSb290OiBIVE1MRGl2RWxlbWVudCxcblx0XHRwcml2YXRlIHJlYWRvbmx5IF9kaWZmTW9kZWw6IElPYnNlcnZhYmxlPERpZmZFZGl0b3JWaWV3TW9kZWwgfCB1bmRlZmluZWQ+LFxuXHRcdHByaXZhdGUgcmVhZG9ubHkgX2VkaXRvcnM6IERpZmZFZGl0b3JFZGl0b3JzLFxuXHRcdHByaXZhdGUgcmVhZG9ubHkgX29wdGlvbnM6IERpZmZFZGl0b3JPcHRpb25zLFxuXHRcdHByaXZhdGUgcmVhZG9ubHkgX3Nhc2hMYXlvdXQ6IFNhc2hMYXlvdXQsXG5cdFx0cHJpdmF0ZSByZWFkb25seSBfYm91bmRhcnlTYXNoZXM6IElPYnNlcnZhYmxlPElCb3VuZGFyeVNhc2hlcyB8IHVuZGVmaW5lZD4sXG5cdFx0QElJbnN0YW50aWF0aW9uU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IF9pbnN0YW50aWF0aW9uU2VydmljZTogSUluc3RhbnRpYXRpb25TZXJ2aWNlLFxuXHRcdEBJQ29udGV4dEtleVNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBfY29udGV4dEtleVNlcnZpY2U6IElDb250ZXh0S2V5U2VydmljZSxcblx0XHRASU1lbnVTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgX21lbnVTZXJ2aWNlOiBJTWVudVNlcnZpY2UsXG5cdCkge1xuXHRcdHN1cGVyKCk7XG5cblx0XHR0aGlzLl9yZWdpc3RlcihwcmVwZW5kUmVtb3ZlT25EaXNwb3NlKGRpZmZFZGl0b3JSb290LCB0aGlzLmVsZW1lbnRzLnJvb3QpKTtcblxuXHRcdHRoaXMuX3JlZ2lzdGVyKGFkZERpc3Bvc2FibGVMaXN0ZW5lcih0aGlzLmVsZW1lbnRzLnJvb3QsICdjbGljaycsICgpID0+IHtcblx0XHRcdHRoaXMuX2VkaXRvcnMubW9kaWZpZWQuZm9jdXMoKTtcblx0XHR9KSk7XG5cblx0XHR0aGlzLl9yZWdpc3RlcihhcHBseVN0eWxlKHRoaXMuZWxlbWVudHMucm9vdCwgeyBkaXNwbGF5OiB0aGlzLl9oYXNBY3Rpb25zLm1hcChhID0+IGEgPyAnYmxvY2snIDogJ25vbmUnKSB9KSk7XG5cblx0XHRkZXJpdmVkRGlzcG9zYWJsZSh0aGlzLCByZWFkZXIgPT4ge1xuXHRcdFx0Y29uc3Qgc2hvd1Nhc2ggPSB0aGlzLl9zaG93U2FzaC5yZWFkKHJlYWRlcik7XG5cdFx0XHRyZXR1cm4gIXNob3dTYXNoID8gdW5kZWZpbmVkIDogbmV3IERpZmZFZGl0b3JTYXNoKFxuXHRcdFx0XHRkaWZmRWRpdG9yUm9vdCxcblx0XHRcdFx0dGhpcy5fc2FzaExheW91dC5kaW1lbnNpb25zLFxuXHRcdFx0XHR0aGlzLl9vcHRpb25zLmVuYWJsZVNwbGl0Vmlld1Jlc2l6aW5nLFxuXHRcdFx0XHR0aGlzLl9ib3VuZGFyeVNhc2hlcyxcblx0XHRcdFx0ZGVyaXZlZFdpdGhTZXR0ZXIoXG5cdFx0XHRcdFx0dGhpcywgcmVhZGVyID0+IHRoaXMuX3Nhc2hMYXlvdXQuc2FzaExlZnQucmVhZChyZWFkZXIpIC0gd2lkdGgsXG5cdFx0XHRcdFx0KHYsIHR4KSA9PiB0aGlzLl9zYXNoTGF5b3V0LnNhc2hMZWZ0LnNldCh2ICsgd2lkdGgsIHR4KVxuXHRcdFx0XHQpLFxuXHRcdFx0XHQoKSA9PiB0aGlzLl9zYXNoTGF5b3V0LnJlc2V0U2FzaCgpLFxuXHRcdFx0KTtcblx0XHR9KS5yZWNvbXB1dGVJbml0aWFsbHlBbmRPbkNoYW5nZSh0aGlzLl9zdG9yZSk7XG5cblx0XHRjb25zdCBndXR0ZXJJdGVtcyA9IGRlcml2ZWQodGhpcywgcmVhZGVyID0+IHtcblx0XHRcdGNvbnN0IG1vZGVsID0gdGhpcy5fZGlmZk1vZGVsLnJlYWQocmVhZGVyKTtcblx0XHRcdGlmICghbW9kZWwpIHtcblx0XHRcdFx0cmV0dXJuIFtdO1xuXHRcdFx0fVxuXHRcdFx0Y29uc3QgZGlmZnMgPSBtb2RlbC5kaWZmLnJlYWQocmVhZGVyKTtcblx0XHRcdGlmICghZGlmZnMpIHsgcmV0dXJuIFtdOyB9XG5cblx0XHRcdGNvbnN0IHNlbGVjdGlvbiA9IHRoaXMuX3NlbGVjdGVkRGlmZnMucmVhZChyZWFkZXIpO1xuXHRcdFx0aWYgKHNlbGVjdGlvbi5sZW5ndGggPiAwKSB7XG5cdFx0XHRcdGNvbnN0IG0gPSBEZXRhaWxlZExpbmVSYW5nZU1hcHBpbmcuZnJvbVJhbmdlTWFwcGluZ3Moc2VsZWN0aW9uLmZsYXRNYXAocyA9PiBzLnJhbmdlTWFwcGluZ3MpKTtcblx0XHRcdFx0cmV0dXJuIFtcblx0XHRcdFx0XHRuZXcgRGlmZkd1dHRlckl0ZW0oXG5cdFx0XHRcdFx0XHRtLFxuXHRcdFx0XHRcdFx0dHJ1ZSxcblx0XHRcdFx0XHRcdE1lbnVJZC5EaWZmRWRpdG9yU2VsZWN0aW9uVG9vbGJhcixcblx0XHRcdFx0XHRcdHVuZGVmaW5lZCxcblx0XHRcdFx0XHRcdG1vZGVsLm1vZGVsLm9yaWdpbmFsLnVyaSxcblx0XHRcdFx0XHRcdG1vZGVsLm1vZGVsLm1vZGlmaWVkLnVyaSxcblx0XHRcdFx0XHQpXTtcblx0XHRcdH1cblxuXHRcdFx0Y29uc3QgY3VycmVudERpZmYgPSB0aGlzLl9jdXJyZW50RGlmZi5yZWFkKHJlYWRlcik7XG5cblx0XHRcdHJldHVybiBkaWZmcy5tYXBwaW5ncy5tYXAobSA9PiBuZXcgRGlmZkd1dHRlckl0ZW0oXG5cdFx0XHRcdG0ubGluZVJhbmdlTWFwcGluZy53aXRoSW5uZXJDaGFuZ2VzRnJvbUxpbmVSYW5nZXMoKSxcblx0XHRcdFx0bS5saW5lUmFuZ2VNYXBwaW5nID09PSBjdXJyZW50RGlmZj8ubGluZVJhbmdlTWFwcGluZyxcblx0XHRcdFx0TWVudUlkLkRpZmZFZGl0b3JIdW5rVG9vbGJhcixcblx0XHRcdFx0dW5kZWZpbmVkLFxuXHRcdFx0XHRtb2RlbC5tb2RlbC5vcmlnaW5hbC51cmksXG5cdFx0XHRcdG1vZGVsLm1vZGVsLm1vZGlmaWVkLnVyaSxcblx0XHRcdCkpO1xuXHRcdH0pO1xuXG5cdFx0dGhpcy5fcmVnaXN0ZXIobmV3IEVkaXRvckd1dHRlcjxEaWZmR3V0dGVySXRlbT4odGhpcy5fZWRpdG9ycy5tb2RpZmllZCwgdGhpcy5lbGVtZW50cy5yb290LCB7XG5cdFx0XHRnZXRJbnRlcnNlY3RpbmdHdXR0ZXJJdGVtczogKHJhbmdlLCByZWFkZXIpID0+IGd1dHRlckl0ZW1zLnJlYWQocmVhZGVyKSxcblx0XHRcdGNyZWF0ZVZpZXc6IChpdGVtLCB0YXJnZXQpID0+IHtcblx0XHRcdFx0cmV0dXJuIHRoaXMuX2luc3RhbnRpYXRpb25TZXJ2aWNlLmNyZWF0ZUluc3RhbmNlKERpZmZUb29sQmFyLCBpdGVtLCB0YXJnZXQsIHRoaXMpO1xuXHRcdFx0fSxcblx0XHR9KSk7XG5cblx0XHR0aGlzLl9yZWdpc3RlcihhZGREaXNwb3NhYmxlTGlzdGVuZXIodGhpcy5lbGVtZW50cy5ndXR0ZXIsIEV2ZW50VHlwZS5NT1VTRV9XSEVFTCwgKGU6IElNb3VzZVdoZWVsRXZlbnQpID0+IHtcblx0XHRcdGlmICh0aGlzLl9lZGl0b3JzLm1vZGlmaWVkLmdldE9wdGlvbihFZGl0b3JPcHRpb24uc2Nyb2xsYmFyKS5oYW5kbGVNb3VzZVdoZWVsKSB7XG5cdFx0XHRcdHRoaXMuX2VkaXRvcnMubW9kaWZpZWQuZGVsZWdhdGVTY3JvbGxGcm9tTW91c2VXaGVlbEV2ZW50KGUpO1xuXHRcdFx0fVxuXHRcdH0sIHsgcGFzc2l2ZTogZmFsc2UgfSkpO1xuXHR9XG5cblx0cHVibGljIGNvbXB1dGVTdGFnZWRWYWx1ZShtYXBwaW5nOiBEZXRhaWxlZExpbmVSYW5nZU1hcHBpbmcpOiBzdHJpbmcge1xuXHRcdGNvbnN0IGMgPSBtYXBwaW5nLmlubmVyQ2hhbmdlcyA/PyBbXTtcblx0XHRjb25zdCBtb2RpZmllZCA9IG5ldyBUZXh0TW9kZWxUZXh0KHRoaXMuX2VkaXRvcnMubW9kaWZpZWRNb2RlbC5nZXQoKSEpO1xuXHRcdGNvbnN0IG9yaWdpbmFsID0gbmV3IFRleHRNb2RlbFRleHQodGhpcy5fZWRpdG9ycy5vcmlnaW5hbC5nZXRNb2RlbCgpISk7XG5cblx0XHRjb25zdCBlZGl0ID0gbmV3IFRleHRFZGl0KGMubWFwKGMgPT4gYy50b1RleHRFZGl0KG1vZGlmaWVkKSkpO1xuXHRcdGNvbnN0IHZhbHVlID0gZWRpdC5hcHBseShvcmlnaW5hbCk7XG5cdFx0cmV0dXJuIHZhbHVlO1xuXHR9XG5cblx0cHJpdmF0ZSByZWFkb25seSBfY3VycmVudERpZmYgPSBkZXJpdmVkKHRoaXMsIChyZWFkZXIpID0+IHtcblx0XHRjb25zdCBtb2RlbCA9IHRoaXMuX2RpZmZNb2RlbC5yZWFkKHJlYWRlcik7XG5cdFx0aWYgKCFtb2RlbCkge1xuXHRcdFx0cmV0dXJuIHVuZGVmaW5lZDtcblx0XHR9XG5cdFx0Y29uc3QgbWFwcGluZ3MgPSBtb2RlbC5kaWZmLnJlYWQocmVhZGVyKT8ubWFwcGluZ3M7XG5cblx0XHRjb25zdCBjdXJzb3JQb3NpdGlvbiA9IHRoaXMuX2VkaXRvcnMubW9kaWZpZWRDdXJzb3IucmVhZChyZWFkZXIpO1xuXHRcdGlmICghY3Vyc29yUG9zaXRpb24pIHsgcmV0dXJuIHVuZGVmaW5lZDsgfVxuXG5cdFx0cmV0dXJuIG1hcHBpbmdzPy5maW5kKG0gPT4gbS5saW5lUmFuZ2VNYXBwaW5nLm1vZGlmaWVkLmNvbnRhaW5zKGN1cnNvclBvc2l0aW9uLmxpbmVOdW1iZXIpKTtcblx0fSk7XG5cblx0cHJpdmF0ZSByZWFkb25seSBfc2VsZWN0ZWREaWZmcyA9IGRlcml2ZWQodGhpcywgKHJlYWRlcikgPT4ge1xuXHRcdC8qKiBAZGVzY3JpcHRpb24gc2VsZWN0ZWREaWZmcyAqL1xuXHRcdGNvbnN0IG1vZGVsID0gdGhpcy5fZGlmZk1vZGVsLnJlYWQocmVhZGVyKTtcblx0XHRjb25zdCBkaWZmID0gbW9kZWw/LmRpZmYucmVhZChyZWFkZXIpO1xuXHRcdC8vIFJldHVybiBgZW1wdHlBcnJgIGJlY2F1c2UgaXQgaXMgYSBjb25zdGFudC4gW10gaXMgYWx3YXlzIGEgbmV3IGFycmF5IGFuZCB3b3VsZCB0cmlnZ2VyIGEgY2hhbmdlLlxuXHRcdGlmICghZGlmZikgeyByZXR1cm4gZW1wdHlBcnI7IH1cblxuXHRcdGNvbnN0IHNlbGVjdGlvbnMgPSB0aGlzLl9lZGl0b3JzLm1vZGlmaWVkU2VsZWN0aW9ucy5yZWFkKHJlYWRlcik7XG5cdFx0aWYgKHNlbGVjdGlvbnMuZXZlcnkocyA9PiBzLmlzRW1wdHkoKSkpIHsgcmV0dXJuIGVtcHR5QXJyOyB9XG5cblx0XHRjb25zdCBzZWxlY3RlZExpbmVOdW1iZXJzID0gbmV3IExpbmVSYW5nZVNldChzZWxlY3Rpb25zLm1hcChzID0+IExpbmVSYW5nZS5mcm9tUmFuZ2VJbmNsdXNpdmUocykpKTtcblxuXHRcdGNvbnN0IHNlbGVjdGVkTWFwcGluZ3MgPSBkaWZmLm1hcHBpbmdzLmZpbHRlcihtID0+XG5cdFx0XHRtLmxpbmVSYW5nZU1hcHBpbmcuaW5uZXJDaGFuZ2VzICYmIHNlbGVjdGVkTGluZU51bWJlcnMuaW50ZXJzZWN0cyhtLmxpbmVSYW5nZU1hcHBpbmcubW9kaWZpZWQpXG5cdFx0KTtcblx0XHRjb25zdCByZXN1bHQgPSBzZWxlY3RlZE1hcHBpbmdzLm1hcChtYXBwaW5nID0+ICh7XG5cdFx0XHRtYXBwaW5nLFxuXHRcdFx0cmFuZ2VNYXBwaW5nczogbWFwcGluZy5saW5lUmFuZ2VNYXBwaW5nLmlubmVyQ2hhbmdlcyEuZmlsdGVyKFxuXHRcdFx0XHRjID0+IHNlbGVjdGlvbnMuc29tZShzID0+IFJhbmdlLmFyZUludGVyc2VjdGluZyhjLm1vZGlmaWVkUmFuZ2UsIHMpKVxuXHRcdFx0KVxuXHRcdH0pKTtcblx0XHRpZiAocmVzdWx0Lmxlbmd0aCA9PT0gMCB8fCByZXN1bHQuZXZlcnkociA9PiByLnJhbmdlTWFwcGluZ3MubGVuZ3RoID09PSAwKSkgeyByZXR1cm4gZW1wdHlBcnI7IH1cblx0XHRyZXR1cm4gcmVzdWx0O1xuXHR9KTtcblxuXHRsYXlvdXQobGVmdDogbnVtYmVyKSB7XG5cdFx0dGhpcy5lbGVtZW50cy5ndXR0ZXIuc3R5bGUubGVmdCA9IGxlZnQgKyAncHgnO1xuXHR9XG59XG5cbmNsYXNzIERpZmZHdXR0ZXJJdGVtIGltcGxlbWVudHMgSUd1dHRlckl0ZW1JbmZvIHtcblx0Y29uc3RydWN0b3IoXG5cdFx0cHVibGljIHJlYWRvbmx5IG1hcHBpbmc6IERldGFpbGVkTGluZVJhbmdlTWFwcGluZyxcblx0XHRwdWJsaWMgcmVhZG9ubHkgc2hvd0Fsd2F5czogYm9vbGVhbixcblx0XHRwdWJsaWMgcmVhZG9ubHkgbWVudUlkOiBNZW51SWQsXG5cdFx0cHVibGljIHJlYWRvbmx5IHJhbmdlT3ZlcnJpZGU6IExpbmVSYW5nZSB8IHVuZGVmaW5lZCxcblx0XHRwdWJsaWMgcmVhZG9ubHkgb3JpZ2luYWxVcmk6IFVSSSxcblx0XHRwdWJsaWMgcmVhZG9ubHkgbW9kaWZpZWRVcmk6IFVSSSxcblx0KSB7XG5cdH1cblx0Z2V0IGlkKCk6IHN0cmluZyB7IHJldHVybiB0aGlzLm1hcHBpbmcubW9kaWZpZWQudG9TdHJpbmcoKTsgfVxuXHRnZXQgcmFuZ2UoKTogTGluZVJhbmdlIHsgcmV0dXJuIHRoaXMucmFuZ2VPdmVycmlkZSA/PyB0aGlzLm1hcHBpbmcubW9kaWZpZWQ7IH1cbn1cblxuXG5jbGFzcyBEaWZmVG9vbEJhciBleHRlbmRzIERpc3Bvc2FibGUgaW1wbGVtZW50cyBJR3V0dGVySXRlbVZpZXcge1xuXHRwcml2YXRlIHJlYWRvbmx5IF9lbGVtZW50cyA9IGgoJ2Rpdi5ndXR0ZXJJdGVtJywgeyBzdHlsZTogeyBoZWlnaHQ6ICcyMHB4Jywgd2lkdGg6ICczNHB4JyB9IH0sIFtcblx0XHRoKCdkaXYuYmFja2dyb3VuZEBiYWNrZ3JvdW5kJywge30sIFtdKSxcblx0XHRoKCdkaXYuYnV0dG9uc0BidXR0b25zJywge30sIFtdKSxcblx0XSk7XG5cblx0cHJpdmF0ZSByZWFkb25seSBfc2hvd0Fsd2F5cyA9IHRoaXMuX2l0ZW0ubWFwKHRoaXMsIGl0ZW0gPT4gaXRlbS5zaG93QWx3YXlzKTtcblx0cHJpdmF0ZSByZWFkb25seSBfbWVudUlkID0gdGhpcy5faXRlbS5tYXAodGhpcywgaXRlbSA9PiBpdGVtLm1lbnVJZCk7XG5cblx0cHJpdmF0ZSByZWFkb25seSBfaXNTbWFsbCA9IG9ic2VydmFibGVWYWx1ZSh0aGlzLCBmYWxzZSk7XG5cblx0Y29uc3RydWN0b3IoXG5cdFx0cHJpdmF0ZSByZWFkb25seSBfaXRlbTogSU9ic2VydmFibGU8RGlmZkd1dHRlckl0ZW0+LFxuXHRcdHRhcmdldDogSFRNTEVsZW1lbnQsXG5cdFx0Z3V0dGVyOiBEaWZmRWRpdG9yR3V0dGVyLFxuXHRcdEBJSW5zdGFudGlhdGlvblNlcnZpY2UgaW5zdGFudGlhdGlvblNlcnZpY2U6IElJbnN0YW50aWF0aW9uU2VydmljZVxuXHQpIHtcblx0XHRzdXBlcigpO1xuXG5cdFx0Y29uc3QgaG92ZXJEZWxlZ2F0ZSA9IHRoaXMuX3JlZ2lzdGVyKGluc3RhbnRpYXRpb25TZXJ2aWNlLmNyZWF0ZUluc3RhbmNlKFxuXHRcdFx0V29ya2JlbmNoSG92ZXJEZWxlZ2F0ZSxcblx0XHRcdCdlbGVtZW50Jyxcblx0XHRcdHsgaW5zdGFudEhvdmVyOiB0cnVlIH0sXG5cdFx0XHR7IHBvc2l0aW9uOiB7IGhvdmVyUG9zaXRpb246IEhvdmVyUG9zaXRpb24uUklHSFQgfSB9XG5cdFx0KSk7XG5cblx0XHR0aGlzLl9yZWdpc3RlcihhcHBlbmRSZW1vdmVPbkRpc3Bvc2UodGFyZ2V0LCB0aGlzLl9lbGVtZW50cy5yb290KSk7XG5cblx0XHR0aGlzLl9yZWdpc3RlcihhdXRvcnVuKHJlYWRlciA9PiB7XG5cdFx0XHQvKiogQGRlc2NyaXB0aW9uIHVwZGF0ZSBzaG93QWx3YXlzICovXG5cdFx0XHRjb25zdCBzaG93QWx3YXlzID0gdGhpcy5fc2hvd0Fsd2F5cy5yZWFkKHJlYWRlcik7XG5cdFx0XHR0aGlzLl9lbGVtZW50cy5yb290LmNsYXNzTGlzdC50b2dnbGUoJ25vVHJhbnNpdGlvbicsIHRydWUpO1xuXHRcdFx0dGhpcy5fZWxlbWVudHMucm9vdC5jbGFzc0xpc3QudG9nZ2xlKCdzaG93QWx3YXlzJywgc2hvd0Fsd2F5cyk7XG5cdFx0XHRzZXRUaW1lb3V0KCgpID0+IHtcblx0XHRcdFx0dGhpcy5fZWxlbWVudHMucm9vdC5jbGFzc0xpc3QudG9nZ2xlKCdub1RyYW5zaXRpb24nLCBmYWxzZSk7XG5cdFx0XHR9LCAwKTtcblx0XHR9KSk7XG5cblxuXHRcdHRoaXMuX3JlZ2lzdGVyKGF1dG9ydW5XaXRoU3RvcmUoKHJlYWRlciwgc3RvcmUpID0+IHtcblx0XHRcdHRoaXMuX2VsZW1lbnRzLmJ1dHRvbnMucmVwbGFjZUNoaWxkcmVuKCk7XG5cdFx0XHRjb25zdCBpID0gc3RvcmUuYWRkKGluc3RhbnRpYXRpb25TZXJ2aWNlLmNyZWF0ZUluc3RhbmNlKE1lbnVXb3JrYmVuY2hUb29sQmFyLCB0aGlzLl9lbGVtZW50cy5idXR0b25zLCB0aGlzLl9tZW51SWQucmVhZChyZWFkZXIpLCB7XG5cdFx0XHRcdG9yaWVudGF0aW9uOiBBY3Rpb25zT3JpZW50YXRpb24uVkVSVElDQUwsXG5cdFx0XHRcdGhvdmVyRGVsZWdhdGUsXG5cdFx0XHRcdHRvb2xiYXJPcHRpb25zOiB7XG5cdFx0XHRcdFx0cHJpbWFyeUdyb3VwOiBnID0+IGcuc3RhcnRzV2l0aCgncHJpbWFyeScpLFxuXHRcdFx0XHR9LFxuXHRcdFx0XHRvdmVyZmxvd0JlaGF2aW9yOiB7IG1heEl0ZW1zOiB0aGlzLl9pc1NtYWxsLnJlYWQocmVhZGVyKSA/IDEgOiAzIH0sXG5cdFx0XHRcdGhpZGRlbkl0ZW1TdHJhdGVneTogSGlkZGVuSXRlbVN0cmF0ZWd5Lklnbm9yZSxcblx0XHRcdFx0YWN0aW9uUnVubmVyOiBzdG9yZS5hZGQobmV3IEFjdGlvblJ1bm5lcldpdGhDb250ZXh0KCgpID0+IHtcblx0XHRcdFx0XHRjb25zdCBpdGVtID0gdGhpcy5faXRlbS5nZXQoKTtcblx0XHRcdFx0XHRjb25zdCBtYXBwaW5nID0gaXRlbS5tYXBwaW5nO1xuXHRcdFx0XHRcdHJldHVybiB7XG5cdFx0XHRcdFx0XHRtYXBwaW5nLFxuXHRcdFx0XHRcdFx0b3JpZ2luYWxXaXRoTW9kaWZpZWRDaGFuZ2VzOiBndXR0ZXIuY29tcHV0ZVN0YWdlZFZhbHVlKG1hcHBpbmcpLFxuXHRcdFx0XHRcdFx0b3JpZ2luYWxVcmk6IGl0ZW0ub3JpZ2luYWxVcmksXG5cdFx0XHRcdFx0XHRtb2RpZmllZFVyaTogaXRlbS5tb2RpZmllZFVyaSxcblx0XHRcdFx0XHR9IHNhdGlzZmllcyBEaWZmRWRpdG9yU2VsZWN0aW9uSHVua1Rvb2xiYXJDb250ZXh0O1xuXHRcdFx0XHR9KSksXG5cdFx0XHRcdG1lbnVPcHRpb25zOiB7XG5cdFx0XHRcdFx0c2hvdWxkRm9yd2FyZEFyZ3M6IHRydWUsXG5cdFx0XHRcdH0sXG5cdFx0XHR9KSk7XG5cdFx0XHRzdG9yZS5hZGQoaS5vbkRpZENoYW5nZU1lbnVJdGVtcygoKSA9PiB7XG5cdFx0XHRcdGlmICh0aGlzLl9sYXN0SXRlbVJhbmdlKSB7XG5cdFx0XHRcdFx0dGhpcy5sYXlvdXQodGhpcy5fbGFzdEl0ZW1SYW5nZSwgdGhpcy5fbGFzdFZpZXdSYW5nZSEpO1xuXHRcdFx0XHR9XG5cdFx0XHR9KSk7XG5cdFx0fSkpO1xuXHR9XG5cblx0cHJpdmF0ZSBfbGFzdEl0ZW1SYW5nZTogT2Zmc2V0UmFuZ2UgfCB1bmRlZmluZWQgPSB1bmRlZmluZWQ7XG5cdHByaXZhdGUgX2xhc3RWaWV3UmFuZ2U6IE9mZnNldFJhbmdlIHwgdW5kZWZpbmVkID0gdW5kZWZpbmVkO1xuXG5cdGxheW91dChpdGVtUmFuZ2U6IE9mZnNldFJhbmdlLCB2aWV3UmFuZ2U6IE9mZnNldFJhbmdlKTogdm9pZCB7XG5cdFx0dGhpcy5fbGFzdEl0ZW1SYW5nZSA9IGl0ZW1SYW5nZTtcblx0XHR0aGlzLl9sYXN0Vmlld1JhbmdlID0gdmlld1JhbmdlO1xuXG5cdFx0bGV0IGl0ZW1IZWlnaHQgPSB0aGlzLl9lbGVtZW50cy5idXR0b25zLmNsaWVudEhlaWdodDtcblx0XHR0aGlzLl9pc1NtYWxsLnNldCh0aGlzLl9pdGVtLmdldCgpLm1hcHBpbmcub3JpZ2luYWwuc3RhcnRMaW5lTnVtYmVyID09PSAxICYmIGl0ZW1SYW5nZS5sZW5ndGggPCAzMCwgdW5kZWZpbmVkKTtcblx0XHQvLyBJdGVtIG1pZ2h0IGhhdmUgY2hhbmdlZFxuXHRcdGl0ZW1IZWlnaHQgPSB0aGlzLl9lbGVtZW50cy5idXR0b25zLmNsaWVudEhlaWdodDtcblxuXHRcdGNvbnN0IG1pZGRsZUhlaWdodCA9IGl0ZW1SYW5nZS5sZW5ndGggLyAyIC0gaXRlbUhlaWdodCAvIDI7XG5cblx0XHRjb25zdCBtYXJnaW4gPSBpdGVtSGVpZ2h0O1xuXG5cdFx0bGV0IGVmZmVjdGl2ZUNoZWNrYm94VG9wID0gaXRlbVJhbmdlLnN0YXJ0ICsgbWlkZGxlSGVpZ2h0O1xuXG5cdFx0Y29uc3QgcHJlZmVycmVkVmlld1BvcnRSYW5nZSA9IE9mZnNldFJhbmdlLnRyeUNyZWF0ZShcblx0XHRcdG1hcmdpbixcblx0XHRcdHZpZXdSYW5nZS5lbmRFeGNsdXNpdmUgLSBtYXJnaW4gLSBpdGVtSGVpZ2h0XG5cdFx0KTtcblxuXHRcdGNvbnN0IHByZWZlcnJlZFBhcmVudFJhbmdlID0gT2Zmc2V0UmFuZ2UudHJ5Q3JlYXRlKFxuXHRcdFx0aXRlbVJhbmdlLnN0YXJ0ICsgbWFyZ2luLFxuXHRcdFx0aXRlbVJhbmdlLmVuZEV4Y2x1c2l2ZSAtIGl0ZW1IZWlnaHQgLSBtYXJnaW5cblx0XHQpO1xuXG5cdFx0aWYgKHByZWZlcnJlZFBhcmVudFJhbmdlICYmIHByZWZlcnJlZFZpZXdQb3J0UmFuZ2UgJiYgcHJlZmVycmVkUGFyZW50UmFuZ2Uuc3RhcnQgPCBwcmVmZXJyZWRQYXJlbnRSYW5nZS5lbmRFeGNsdXNpdmUpIHtcblx0XHRcdGVmZmVjdGl2ZUNoZWNrYm94VG9wID0gcHJlZmVycmVkVmlld1BvcnRSYW5nZSEuY2xpcChlZmZlY3RpdmVDaGVja2JveFRvcCk7XG5cdFx0XHRlZmZlY3RpdmVDaGVja2JveFRvcCA9IHByZWZlcnJlZFBhcmVudFJhbmdlIS5jbGlwKGVmZmVjdGl2ZUNoZWNrYm94VG9wKTtcblx0XHR9XG5cblx0XHR0aGlzLl9lbGVtZW50cy5idXR0b25zLnN0eWxlLnRvcCA9IGAke2VmZmVjdGl2ZUNoZWNrYm94VG9wIC0gaXRlbVJhbmdlLnN0YXJ0fXB4YDtcblx0fVxufVxuXG5leHBvcnQgaW50ZXJmYWNlIERpZmZFZGl0b3JTZWxlY3Rpb25IdW5rVG9vbGJhckNvbnRleHQge1xuXHRtYXBwaW5nOiBEZXRhaWxlZExpbmVSYW5nZU1hcHBpbmc7XG5cblx0LyoqXG5cdCAqIFRoZSBvcmlnaW5hbCB0ZXh0IHdpdGggdGhlIHNlbGVjdGVkIG1vZGlmaWVkIGNoYW5nZXMgYXBwbGllZC5cblx0Ki9cblx0b3JpZ2luYWxXaXRoTW9kaWZpZWRDaGFuZ2VzOiBzdHJpbmc7XG5cblx0bW9kaWZpZWRVcmk6IFVSSTtcblx0b3JpZ2luYWxVcmk6IFVSSTtcbn1cbiJdLAogICJtYXBwaW5ncyI6ICI7Ozs7Ozs7Ozs7O0FBS0EsU0FBUyxXQUFXLHVCQUF1QixTQUFTO0FBRXBELFNBQVMsMEJBQTBCO0FBQ25DLFNBQVMscUJBQXFCO0FBRTlCLFNBQVMsa0JBQWtCO0FBQzNCLFNBQXNCLFNBQVMsa0JBQWtCLFNBQVMsbUJBQW1CLG1CQUFtQixxQkFBcUIsdUJBQXVCO0FBRTVJLFNBQVMsb0JBQW9CLDRCQUE0QjtBQUN6RCxTQUFTLGNBQWMsY0FBYztBQUNyQyxTQUFTLDBCQUEwQjtBQUNuQyxTQUFTLDhCQUE4QjtBQUN2QyxTQUFTLDZCQUE2QjtBQUN0QyxTQUFTLG9CQUFvQjtBQUM3QixTQUFTLFdBQVcsb0JBQW9CO0FBQ3hDLFNBQVMsbUJBQW1CO0FBQzVCLFNBQVMsYUFBYTtBQUN0QixTQUFTLGdCQUFnQjtBQUN6QixTQUFTLGdDQUFnQztBQUN6QyxTQUFTLHFCQUFxQjtBQUM5QixTQUFTLCtCQUErQjtBQUV4QyxTQUFTLHNCQUFrQztBQUczQyxTQUFTLHVCQUF1QixZQUFZLDhCQUE4QjtBQUMxRSxTQUFTLG9CQUFzRDtBQUUvRCxNQUFNLFdBQW9CLENBQUM7QUFDM0IsTUFBTSxRQUFRO0FBRVAsSUFBTSxtQkFBTixjQUErQixXQUFXO0FBQUEsRUFVaEQsWUFDQyxnQkFDaUIsWUFDQSxVQUNBLFVBQ0EsYUFDQSxpQkFDdUIsdUJBQ0gsb0JBQ04sY0FDOUI7QUFDRCxVQUFNO0FBVFc7QUFDQTtBQUNBO0FB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
