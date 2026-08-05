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
import { $, addDisposableListener, getWindow, h, reset } from "../../../../../base/browser/dom.js";
import { renderIcon, renderLabelWithIcons } from "../../../../../base/browser/ui/iconLabel/iconLabels.js";
import { Codicon } from "../../../../../base/common/codicons.js";
import { MarkdownString } from "../../../../../base/common/htmlContent.js";
import { Disposable } from "../../../../../base/common/lifecycle.js";
import { autorun, derived, derivedDisposable, derivedWithStore, observableValue, transaction } from "../../../../../base/common/observable.js";
import { ThemeIcon } from "../../../../../base/common/themables.js";
import { isDefined } from "../../../../../base/common/types.js";
import { localize } from "../../../../../nls.js";
import { IInstantiationService } from "../../../../../platform/instantiation/common/instantiation.js";
import { EditorOption } from "../../../../common/config/editorOptions.js";
import { LineRange } from "../../../../common/core/lineRange.js";
import { Position } from "../../../../common/core/position.js";
import { Range } from "../../../../common/core/range.js";
import { CursorChangeReason } from "../../../../common/cursorEvents.js";
import { SymbolKinds } from "../../../../common/languages.js";
import { observableCodeEditor } from "../../../observableCodeEditor.js";
import { RevealPreference } from "../diffEditorViewModel.js";
import { PlaceholderViewZone, ViewZoneOverlayWidget, applyObservableDecorations, applyStyle } from "../utils.js";
let HideUnchangedRegionsFeature = class extends Disposable {
  constructor(_editors, _diffModel, _options, _instantiationService) {
    super();
    this._editors = _editors;
    this._diffModel = _diffModel;
    this._options = _options;
    this._instantiationService = _instantiationService;
    this._modifiedOutlineSource = derivedDisposable(this, (reader) => {
      const m = this._editors.modifiedModel.read(reader);
      const factory = HideUnchangedRegionsFeature._breadcrumbsSourceFactory.read(reader);
      return !m || !factory ? void 0 : factory(m, this._instantiationService);
    });
    this._isUpdatingHiddenAreas = false;
    this._register(this._editors.original.onDidChangeCursorPosition((e) => {
      if (e.reason === CursorChangeReason.ContentFlush) {
        return;
      }
      const m = this._diffModel.get();
      transaction((tx) => {
        for (const s of this._editors.original.getSelections() || []) {
          m?.ensureOriginalLineIsVisible(s.getStartPosition().lineNumber, RevealPreference.FromCloserSide, tx);
          m?.ensureOriginalLineIsVisible(s.getEndPosition().lineNumber, RevealPreference.FromCloserSide, tx);
        }
      });
    }));
    this._register(this._editors.modified.onDidChangeCursorPosition((e) => {
      if (e.reason === CursorChangeReason.ContentFlush) {
        return;
      }
      const m = this._diffModel.get();
      transaction((tx) => {
        for (const s of this._editors.modified.getSelections() || []) {
          m?.ensureModifiedLineIsVisible(s.getStartPosition().lineNumber, RevealPreference.FromCloserSide, tx);
          m?.ensureModifiedLineIsVisible(s.getEndPosition().lineNumber, RevealPreference.FromCloserSide, tx);
        }
      });
    }));
    const unchangedRegions = this._diffModel.map((m, reader) => {
      const regions = m?.unchangedRegions.read(reader) ?? [];
      if (regions.length === 1 && regions[0].modifiedLineNumber === 1 && regions[0].lineCount === this._editors.modifiedModel.read(reader)?.getLineCount()) {
        return [];
      }
      return regions;
    });
    this.viewZones = derivedWithStore(this, (reader, store) => {
      const modifiedOutlineSource = this._modifiedOutlineSource.read(reader);
      if (!modifiedOutlineSource) {
        return { origViewZones: [], modViewZones: [] };
      }
      const origViewZones = [];
      const modViewZones = [];
      const sideBySide = this._options.renderSideBySide.read(reader);
      const compactMode = this._options.compactMode.read(reader);
      const curUnchangedRegions = unchangedRegions.read(reader);
      for (let i = 0; i < curUnchangedRegions.length; i++) {
        const r = curUnchangedRegions[i];
        if (r.shouldHideControls(reader)) {
          continue;
        }
        if (compactMode && (i === 0 || i === curUnchangedRegions.length - 1)) {
          continue;
        }
        if (compactMode) {
          {
            const d = derived(this, (reader2) => (
              /** @description hiddenOriginalRangeStart */
              r.getHiddenOriginalRange(reader2).startLineNumber - 1
            ));
            const origVz = new PlaceholderViewZone(d, 12);
            origViewZones.push(origVz);
            store.add(new CompactCollapsedCodeOverlayWidget(
              this._editors.original,
              origVz,
              r,
              !sideBySide
            ));
          }
          {
            const d = derived(this, (reader2) => (
              /** @description hiddenModifiedRangeStart */
              r.getHiddenModifiedRange(reader2).startLineNumber - 1
            ));
            const modViewZone = new PlaceholderViewZone(d, 12);
            modViewZones.push(modViewZone);
            store.add(new CompactCollapsedCodeOverlayWidget(
              this._editors.modified,
              modViewZone,
              r
            ));
          }
        } else {
          {
            const d = derived(this, (reader2) => (
              /** @description hiddenOriginalRangeStart */
              r.getHiddenOriginalRange(reader2).startLineNumber - 1
            ));
            const origVz = new PlaceholderViewZone(d, 24);
            origViewZones.push(origVz);
            store.add(new CollapsedCodeOverlayWidget(
              this._editors.original,
              origVz,
              r,
              r.originalUnchangedRange,
              !sideBySide,
              modifiedOutlineSource,
              (l) => this._diffModel.get().ensureModifiedLineIsVisible(l, RevealPreference.FromBottom, void 0),
              this._options
            ));
          }
          {
            const d = derived(this, (reader2) => (
              /** @description hiddenModifiedRangeStart */
              r.getHiddenModifiedRange(reader2).startLineNumber - 1
            ));
            const modViewZone = new PlaceholderViewZone(d, 24);
            modViewZones.push(modViewZone);
            store.add(new CollapsedCodeOverlayWidget(
              this._editors.modified,
              modViewZone,
              r,
              r.modifiedUnchangedRange,
              false,
              modifiedOutlineSource,
              (l) => this._diffModel.get().ensureModifiedLineIsVisible(l, RevealPreference.FromBottom, void 0),
              this._options
            ));
          }
        }
      }
      return { origViewZones, modViewZones };
    });
    const unchangedLinesDecoration = {
      description: "unchanged lines",
      className: "diff-unchanged-lines",
      isWholeLine: true
    };
    const unchangedLinesDecorationShow = {
      description: "Fold Unchanged",
      glyphMarginHoverMessage: new MarkdownString(void 0, { isTrusted: true, supportThemeIcons: true }).appendMarkdown(localize("foldUnchanged", "Fold Unchanged Region")),
      glyphMarginClassName: "fold-unchanged " + ThemeIcon.asClassName(Codicon.fold),
      zIndex: 10001
    };
    this._register(applyObservableDecorations(this._editors.original, derived(this, (reader) => {
      const curUnchangedRegions = unchangedRegions.read(reader);
      const result = curUnchangedRegions.map((r) => ({
        range: r.originalUnchangedRange.toInclusiveRange(),
        options: unchangedLinesDecoration
      }));
      for (const r of curUnchangedRegions) {
        if (r.shouldHideControls(reader)) {
          result.push({
            range: Range.fromPositions(new Position(r.originalLineNumber, 1)),
            options: unchangedLinesDecorationShow
          });
        }
      }
      return result;
    })));
    this._register(applyObservableDecorations(this._editors.modified, derived(this, (reader) => {
      const curUnchangedRegions = unchangedRegions.read(reader);
      const result = curUnchangedRegions.map((r) => ({
        range: r.modifiedUnchangedRange.toInclusiveRange(),
        options: unchangedLinesDecoration
      }));
      for (const r of curUnchangedRegions) {
        if (r.shouldHideControls(reader)) {
          result.push({
            range: LineRange.ofLength(r.modifiedLineNumber, 1).toInclusiveRange(),
            options: unchangedLinesDecorationShow
          });
        }
      }
      return result;
    })));
    this._register(autorun((reader) => {
      const curUnchangedRegions = unchangedRegions.read(reader);
      this._isUpdatingHiddenAreas = true;
      try {
        this._editors.original.setHiddenAreas(curUnchangedRegions.map((r) => r.getHiddenOriginalRange(reader).toInclusiveRange()).filter(isDefined));
        this._editors.modified.setHiddenAreas(curUnchangedRegions.map((r) => r.getHiddenModifiedRange(reader).toInclusiveRange()).filter(isDefined));
      } finally {
        this._isUpdatingHiddenAreas = false;
      }
    }));
    this._register(this._editors.modified.onMouseUp((event) => {
      if (!event.event.rightButton && event.target.position && event.target.element?.className.includes("fold-unchanged")) {
        const lineNumber = event.target.position.lineNumber;
        const model = this._diffModel.get();
        if (!model) {
          return;
        }
        const region = model.unchangedRegions.get().find((r) => r.modifiedUnchangedRange.includes(lineNumber));
        if (!region) {
          return;
        }
        region.collapseAll(void 0);
        event.event.stopPropagation();
        event.event.preventDefault();
      }
    }));
    this._register(this._editors.original.onMouseUp((event) => {
      if (!event.event.rightButton && event.target.position && event.target.element?.className.includes("fold-unchanged")) {
        const lineNumber = event.target.position.lineNumber;
        const model = this._diffModel.get();
        if (!model) {
          return;
        }
        const region = model.unchangedRegions.get().find((r) => r.originalUnchangedRange.includes(lineNumber));
        if (!region) {
          return;
        }
        region.collapseAll(void 0);
        event.event.stopPropagation();
        event.event.preventDefault();
      }
    }));
  }
  static setBreadcrumbsSourceFactory(factory) {
    this._breadcrumbsSourceFactory.set(factory, void 0);
  }
  get isUpdatingHiddenAreas() {
    return this._isUpdatingHiddenAreas;
  }
};
HideUnchangedRegionsFeature._breadcrumbsSourceFactory = observableValue(
  HideUnchangedRegionsFeature,
  () => ({
    dispose() {
    },
    getBreadcrumbItems(startRange, reader) {
      return [];
    }
  })
);
HideUnchangedRegionsFeature = __decorateClass([
  __decorateParam(3, IInstantiationService)
], HideUnchangedRegionsFeature);
class CompactCollapsedCodeOverlayWidget extends ViewZoneOverlayWidget {
  constructor(editor, _viewZone, _unchangedRegion, _hide = false) {
    const root = h("div.diff-hidden-lines-widget");
    super(editor, _viewZone, root.root);
    this._unchangedRegion = _unchangedRegion;
    this._hide = _hide;
    this._nodes = h("div.diff-hidden-lines-compact", [
      h("div.line-left", []),
      h("div.text@text", []),
      h("div.line-right", [])
    ]);
    root.root.appendChild(this._nodes.root);
    if (this._hide) {
      this._nodes.root.replaceChildren();
    }
    this._register(autorun((reader) => {
      if (!this._hide) {
        const lineCount = this._unchangedRegion.getHiddenModifiedRange(reader).length;
        const linesHiddenText = localize("hiddenLines", "{0} hidden lines", lineCount);
        this._nodes.text.innerText = linesHiddenText;
      }
    }));
  }
}
class CollapsedCodeOverlayWidget extends ViewZoneOverlayWidget {
  constructor(_editor, _viewZone, _unchangedRegion, _unchangedRegionRange, _hide, _modifiedOutlineSource, _revealModifiedHiddenLine, _options) {
    const root = h("div.diff-hidden-lines-widget");
    super(_editor, _viewZone, root.root);
    this._editor = _editor;
    this._unchangedRegion = _unchangedRegion;
    this._unchangedRegionRange = _unchangedRegionRange;
    this._hide = _hide;
    this._modifiedOutlineSource = _modifiedOutlineSource;
    this._revealModifiedHiddenLine = _revealModifiedHiddenLine;
    this._options = _options;
    this._nodes = h("div.diff-hidden-lines", [
      h("div.top@top", { title: localize("diff.hiddenLines.top", "Click or drag to show more above") }),
      h("div.center@content", { style: { display: "flex" } }, [
        h(
          "div@first",
          { style: { display: "flex", justifyContent: "center", alignItems: "center", flexShrink: "0" } },
          [$(
            "a",
            { title: localize("showUnchangedRegion", "Show Unchanged Region"), role: "button", onclick: () => {
              this._unchangedRegion.showAll(void 0);
            } },
            ...renderLabelWithIcons("$(unfold)")
          )]
        ),
        h("div@others", { style: { display: "flex", justifyContent: "center", alignItems: "center" } })
      ]),
      h("div.bottom@bottom", { title: localize("diff.bottom", "Click or drag to show more below"), role: "button" })
    ]);
    root.root.appendChild(this._nodes.root);
    if (!this._hide) {
      this._register(applyStyle(this._nodes.first, { width: observableCodeEditor(this._editor).layoutInfoContentLeft }));
    } else {
      reset(this._nodes.first);
    }
    this._register(autorun((reader) => {
      const isFullyRevealed = this._unchangedRegion.visibleLineCountTop.read(reader) + this._unchangedRegion.visibleLineCountBottom.read(reader) === this._unchangedRegion.lineCount;
      this._nodes.bottom.classList.toggle("canMoveTop", !isFullyRevealed);
      this._nodes.bottom.classList.toggle("canMoveBottom", this._unchangedRegion.visibleLineCountBottom.read(reader) > 0);
      this._nodes.top.classList.toggle("canMoveTop", this._unchangedRegion.visibleLineCountTop.read(reader) > 0);
      this._nodes.top.classList.toggle("canMoveBottom", !isFullyRevealed);
      const isDragged = this._unchangedRegion.isDragged.read(reader);
      const domNode = this._editor.getDomNode();
      if (domNode) {
        domNode.classList.toggle("draggingUnchangedRegion", !!isDragged);
        if (isDragged === "top") {
          domNode.classList.toggle("canMoveTop", this._unchangedRegion.visibleLineCountTop.read(reader) > 0);
          domNode.classList.toggle("canMoveBottom", !isFullyRevealed);
        } else if (isDragged === "bottom") {
          domNode.classList.toggle("canMoveTop", !isFullyRevealed);
          domNode.classList.toggle("canMoveBottom", this._unchangedRegion.visibleLineCountBottom.read(reader) > 0);
        } else {
          domNode.classList.toggle("canMoveTop", false);
          domNode.classList.toggle("canMoveBottom", false);
        }
      }
    }));
    const editor = this._editor;
    this._register(addDisposableListener(this._nodes.top, "mousedown", (e) => {
      if (e.button !== 0) {
        return;
      }
      this._nodes.top.classList.toggle("dragging", true);
      this._nodes.root.classList.toggle("dragging", true);
      e.preventDefault();
      const startTop = e.clientY;
      let didMove = false;
      const cur = this._unchangedRegion.visibleLineCountTop.get();
      this._unchangedRegion.isDragged.set("top", void 0);
      const window = getWindow(this._nodes.top);
      const mouseMoveListener = addDisposableListener(window, "mousemove", (e2) => {
        const currentTop = e2.clientY;
        const delta = currentTop - startTop;
        didMove = didMove || Math.abs(delta) > 2;
        const lineDelta = Math.round(delta / editor.getOption(EditorOption.lineHeight));
        const newVal = Math.max(0, Math.min(cur + lineDelta, this._unchangedRegion.getMaxVisibleLineCountTop()));
        this._unchangedRegion.visibleLineCountTop.set(newVal, void 0);
      });
      const mouseUpListener = addDisposableListener(window, "mouseup", (e2) => {
        if (!didMove) {
          this._unchangedRegion.showMoreAbove(this._options.hideUnchangedRegionsRevealLineCount.get(), void 0);
        }
        this._nodes.top.classList.toggle("dragging", false);
        this._nodes.root.classList.toggle("dragging", false);
        this._unchangedRegion.isDragged.set(void 0, void 0);
        mouseMoveListener.dispose();
        mouseUpListener.dispose();
      });
    }));
    this._register(addDisposableListener(this._nodes.bottom, "mousedown", (e) => {
      if (e.button !== 0) {
        return;
      }
      this._nodes.bottom.classList.toggle("dragging", true);
      this._nodes.root.classList.toggle("dragging", true);
      e.preventDefault();
      const startTop = e.clientY;
      let didMove = false;
      const cur = this._unchangedRegion.visibleLineCountBottom.get();
      this._unchangedRegion.isDragged.set("bottom", void 0);
      const window = getWindow(this._nodes.bottom);
      const mouseMoveListener = addDisposableListener(window, "mousemove", (e2) => {
        const currentTop = e2.clientY;
        const delta = currentTop - startTop;
        didMove = didMove || Math.abs(delta) > 2;
        const lineDelta = Math.round(delta / editor.getOption(EditorOption.lineHeight));
        const newVal = Math.max(0, Math.min(cur - lineDelta, this._unchangedRegion.getMaxVisibleLineCountBottom()));
        const top = this._unchangedRegionRange.endLineNumberExclusive > editor.getModel().getLineCount() ? editor.getContentHeight() : editor.getTopForLineNumber(this._unchangedRegionRange.endLineNumberExclusive);
        this._unchangedRegion.visibleLineCountBottom.set(newVal, void 0);
        const top2 = this._unchangedRegionRange.endLineNumberExclusive > editor.getModel().getLineCount() ? editor.getContentHeight() : editor.getTopForLineNumber(this._unchangedRegionRange.endLineNumberExclusive);
        editor.setScrollTop(editor.getScrollTop() + (top2 - top));
      });
      const mouseUpListener = addDisposableListener(window, "mouseup", (e2) => {
        this._unchangedRegion.isDragged.set(void 0, void 0);
        if (!didMove) {
          const top = editor.getTopForLineNumber(this._unchangedRegionRange.endLineNumberExclusive);
          this._unchangedRegion.showMoreBelow(this._options.hideUnchangedRegionsRevealLineCount.get(), void 0);
          const top2 = editor.getTopForLineNumber(this._unchangedRegionRange.endLineNumberExclusive);
          editor.setScrollTop(editor.getScrollTop() + (top2 - top));
        }
        this._nodes.bottom.classList.toggle("dragging", false);
        this._nodes.root.classList.toggle("dragging", false);
        mouseMoveListener.dispose();
        mouseUpListener.dispose();
      });
    }));
    this._register(autorun((reader) => {
      const children = [];
      if (!this._hide) {
        const lineCount = _unchangedRegion.getHiddenModifiedRange(reader).length;
        const linesHiddenText = localize("hiddenLines", "{0} hidden lines", lineCount);
        const span = $("span", { title: localize("diff.hiddenLines.expandAll", "Double click to unfold") }, linesHiddenText);
        span.addEventListener("dblclick", (e) => {
          if (e.button !== 0) {
            return;
          }
          e.preventDefault();
          this._unchangedRegion.showAll(void 0);
        });
        children.push(span);
        const range = this._unchangedRegion.getHiddenModifiedRange(reader);
        const items = this._modifiedOutlineSource.getBreadcrumbItems(range, reader);
        if (items.length > 0) {
          children.push($("span", void 0, "\xA0\xA0|\xA0\xA0"));
          for (let i = 0; i < items.length; i++) {
            const item = items[i];
            const icon = SymbolKinds.toIcon(item.kind);
            const divItem = h("div.breadcrumb-item", {
              style: { display: "flex", alignItems: "center" }
            }, [
              renderIcon(icon),
              "\xA0",
              item.name,
              ...i === items.length - 1 ? [] : [renderIcon(Codicon.chevronRight)]
            ]).root;
            children.push(divItem);
            divItem.onclick = () => {
              this._revealModifiedHiddenLine(item.startLineNumber);
            };
          }
        }
      }
      reset(this._nodes.others, ...children);
    }));
  }
}
export {
  HideUnchangedRegionsFeature
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy9lZGl0b3IvYnJvd3Nlci93aWRnZXQvZGlmZkVkaXRvci9mZWF0dXJlcy9oaWRlVW5jaGFuZ2VkUmVnaW9uc0ZlYXR1cmUudHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbIi8qLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG4gKiAgQ29weXJpZ2h0IChjKSBNaWNyb3NvZnQgQ29ycG9yYXRpb24uIEFsbCByaWdodHMgcmVzZXJ2ZWQuXG4gKiAgTGljZW5zZWQgdW5kZXIgdGhlIE1JVCBMaWNlbnNlLiBTZWUgTGljZW5zZS50eHQgaW4gdGhlIHByb2plY3Qgcm9vdCBmb3IgbGljZW5zZSBpbmZvcm1hdGlvbi5cbiAqLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0qL1xuXG5pbXBvcnQgeyAkLCBhZGREaXNwb3NhYmxlTGlzdGVuZXIsIGdldFdpbmRvdywgaCwgcmVzZXQgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9iYXNlL2Jyb3dzZXIvZG9tLmpzJztcbmltcG9ydCB7IHJlbmRlckljb24sIHJlbmRlckxhYmVsV2l0aEljb25zIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vYmFzZS9icm93c2VyL3VpL2ljb25MYWJlbC9pY29uTGFiZWxzLmpzJztcbmltcG9ydCB7IENvZGljb24gfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9jb2RpY29ucy5qcyc7XG5pbXBvcnQgeyBNYXJrZG93blN0cmluZyB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2h0bWxDb250ZW50LmpzJztcbmltcG9ydCB7IERpc3Bvc2FibGUsIElEaXNwb3NhYmxlIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vbGlmZWN5Y2xlLmpzJztcbmltcG9ydCB7IElPYnNlcnZhYmxlLCBJUmVhZGVyLCBhdXRvcnVuLCBkZXJpdmVkLCBkZXJpdmVkRGlzcG9zYWJsZSwgZGVyaXZlZFdpdGhTdG9yZSwgb2JzZXJ2YWJsZVZhbHVlLCB0cmFuc2FjdGlvbiB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL29ic2VydmFibGUuanMnO1xuaW1wb3J0IHsgVGhlbWVJY29uIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vdGhlbWFibGVzLmpzJztcbmltcG9ydCB7IGlzRGVmaW5lZCB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL3R5cGVzLmpzJztcbmltcG9ydCB7IGxvY2FsaXplIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vbmxzLmpzJztcbmltcG9ydCB7IElJbnN0YW50aWF0aW9uU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL3BsYXRmb3JtL2luc3RhbnRpYXRpb24vY29tbW9uL2luc3RhbnRpYXRpb24uanMnO1xuaW1wb3J0IHsgRWRpdG9yT3B0aW9uIH0gZnJvbSAnLi4vLi4vLi4vLi4vY29tbW9uL2NvbmZpZy9lZGl0b3JPcHRpb25zLmpzJztcbmltcG9ydCB7IExpbmVSYW5nZSB9IGZyb20gJy4uLy4uLy4uLy4uL2NvbW1vbi9jb3JlL2xpbmVSYW5nZS5qcyc7XG5pbXBvcnQgeyBQb3NpdGlvbiB9IGZyb20gJy4uLy4uLy4uLy4uL2NvbW1vbi9jb3JlL3Bvc2l0aW9uLmpzJztcbmltcG9ydCB7IFJhbmdlIH0gZnJvbSAnLi4vLi4vLi4vLi4vY29tbW9uL2NvcmUvcmFuZ2UuanMnO1xuaW1wb3J0IHsgQ3Vyc29yQ2hhbmdlUmVhc29uIH0gZnJvbSAnLi4vLi4vLi4vLi4vY29tbW9uL2N1cnNvckV2ZW50cy5qcyc7XG5pbXBvcnQgeyBTeW1ib2xLaW5kLCBTeW1ib2xLaW5kcyB9IGZyb20gJy4uLy4uLy4uLy4uL2NvbW1vbi9sYW5ndWFnZXMuanMnO1xuaW1wb3J0IHsgSU1vZGVsRGVjb3JhdGlvbk9wdGlvbnMsIElNb2RlbERlbHRhRGVjb3JhdGlvbiwgSVRleHRNb2RlbCB9IGZyb20gJy4uLy4uLy4uLy4uL2NvbW1vbi9tb2RlbC5qcyc7XG5pbXBvcnQgeyBJQ29kZUVkaXRvciB9IGZyb20gJy4uLy4uLy4uL2VkaXRvckJyb3dzZXIuanMnO1xuaW1wb3J0IHsgb2JzZXJ2YWJsZUNvZGVFZGl0b3IgfSBmcm9tICcuLi8uLi8uLi9vYnNlcnZhYmxlQ29kZUVkaXRvci5qcyc7XG5pbXBvcnQgeyBEaWZmRWRpdG9yRWRpdG9ycyB9IGZyb20gJy4uL2NvbXBvbmVudHMvZGlmZkVkaXRvckVkaXRvcnMuanMnO1xuaW1wb3J0IHsgRGlmZkVkaXRvck9wdGlvbnMgfSBmcm9tICcuLi9kaWZmRWRpdG9yT3B0aW9ucy5qcyc7XG5pbXBvcnQgeyBEaWZmRWRpdG9yVmlld01vZGVsLCBSZXZlYWxQcmVmZXJlbmNlLCBVbmNoYW5nZWRSZWdpb24gfSBmcm9tICcuLi9kaWZmRWRpdG9yVmlld01vZGVsLmpzJztcbmltcG9ydCB7IElPYnNlcnZhYmxlVmlld1pvbmUsIFBsYWNlaG9sZGVyVmlld1pvbmUsIFZpZXdab25lT3ZlcmxheVdpZGdldCwgYXBwbHlPYnNlcnZhYmxlRGVjb3JhdGlvbnMsIGFwcGx5U3R5bGUgfSBmcm9tICcuLi91dGlscy5qcyc7XG5cbi8qKlxuICogTWFrZSBzdXJlIHRvIGFkZCB0aGUgdmlldyB6b25lcyB0byB0aGUgZWRpdG9yIVxuICovXG5leHBvcnQgY2xhc3MgSGlkZVVuY2hhbmdlZFJlZ2lvbnNGZWF0dXJlIGV4dGVuZHMgRGlzcG9zYWJsZSB7XG5cdHByaXZhdGUgc3RhdGljIHJlYWRvbmx5IF9icmVhZGNydW1ic1NvdXJjZUZhY3RvcnkgPSBvYnNlcnZhYmxlVmFsdWU8KCh0ZXh0TW9kZWw6IElUZXh0TW9kZWwsIGluc3RhbnRpYXRpb25TZXJ2aWNlOiBJSW5zdGFudGlhdGlvblNlcnZpY2UpID0+IElEaWZmRWRpdG9yQnJlYWRjcnVtYnNTb3VyY2UpPihcblx0XHRIaWRlVW5jaGFuZ2VkUmVnaW9uc0ZlYXR1cmUsICgpID0+ICh7XG5cdFx0XHRkaXNwb3NlKCkge1xuXHRcdFx0fSxcblx0XHRcdGdldEJyZWFkY3J1bWJJdGVtcyhzdGFydFJhbmdlLCByZWFkZXIpIHtcblx0XHRcdFx0cmV0dXJuIFtdO1xuXHRcdFx0fSxcblx0XHR9KSk7XG5cdHB1YmxpYyBzdGF0aWMgc2V0QnJlYWRjcnVtYnNTb3VyY2VGYWN0b3J5KGZhY3Rvcnk6ICh0ZXh0TW9kZWw6IElUZXh0TW9kZWwsIGluc3RhbnRpYXRpb25TZXJ2aWNlOiBJSW5zdGFudGlhdGlvblNlcnZpY2UpID0+IElEaWZmRWRpdG9yQnJlYWRjcnVtYnNTb3VyY2UpIHtcblx0XHR0aGlzLl9icmVhZGNydW1ic1NvdXJjZUZhY3Rvcnkuc2V0KGZhY3RvcnksIHVuZGVmaW5lZCk7XG5cdH1cblxuXHRwcml2YXRlIHJlYWRvbmx5IF9tb2RpZmllZE91dGxpbmVTb3VyY2UgPSBkZXJpdmVkRGlzcG9zYWJsZSh0aGlzLCAocmVhZGVyKSA9PiB7XG5cdFx0Y29uc3QgbSA9IHRoaXMuX2VkaXRvcnMubW9kaWZpZWRNb2RlbC5yZWFkKHJlYWRlcik7XG5cdFx0Y29uc3QgZmFjdG9yeSA9IEhpZGVVbmNoYW5nZWRSZWdpb25zRmVhdHVyZS5fYnJlYWRjcnVtYnNTb3VyY2VGYWN0b3J5LnJlYWQocmVhZGVyKTtcblx0XHRyZXR1cm4gKCFtIHx8ICFmYWN0b3J5KSA/IHVuZGVmaW5lZCA6IGZhY3RvcnkobSwgdGhpcy5faW5zdGFudGlhdGlvblNlcnZpY2UpO1xuXHR9KTtcblxuXHRwdWJsaWMgcmVhZG9ubHkgdmlld1pvbmVzOiBJT2JzZXJ2YWJsZTx7XG5cdFx0b3JpZ1ZpZXdab25lczogSU9ic2VydmFibGVWaWV3Wm9uZVtdO1xuXHRcdG1vZFZpZXdab25lczogSU9ic2VydmFibGVWaWV3Wm9uZVtdO1xuXHR9PjtcblxuXHRwcml2YXRlIF9pc1VwZGF0aW5nSGlkZGVuQXJlYXMgPSBmYWxzZTtcblx0cHVibGljIGdldCBpc1VwZGF0aW5nSGlkZGVuQXJlYXMoKSB7IHJldHVybiB0aGlzLl9pc1VwZGF0aW5nSGlkZGVuQXJlYXM7IH1cblxuXHRjb25zdHJ1Y3Rvcihcblx0XHRwcml2YXRlIHJlYWRvbmx5IF9lZGl0b3JzOiBEaWZmRWRpdG9yRWRpdG9ycyxcblx0XHRwcml2YXRlIHJlYWRvbmx5IF9kaWZmTW9kZWw6IElPYnNlcnZhYmxlPERpZmZFZGl0b3JWaWV3TW9kZWwgfCB1bmRlZmluZWQ+LFxuXHRcdHByaXZhdGUgcmVhZG9ubHkgX29wdGlvbnM6IERpZmZFZGl0b3JPcHRpb25zLFxuXHRcdEBJSW5zdGFudGlhdGlvblNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBfaW5zdGFudGlhdGlvblNlcnZpY2U6IElJbnN0YW50aWF0aW9uU2VydmljZSxcblx0KSB7XG5cdFx0c3VwZXIoKTtcblxuXHRcdHRoaXMuX3JlZ2lzdGVyKHRoaXMuX2VkaXRvcnMub3JpZ2luYWwub25EaWRDaGFuZ2VDdXJzb3JQb3NpdGlvbihlID0+IHtcblx0XHRcdGlmIChlLnJlYXNvbiA9PT0gQ3Vyc29yQ2hhbmdlUmVhc29uLkNvbnRlbnRGbHVzaCkgeyByZXR1cm47IH1cblx0XHRcdGNvbnN0IG0gPSB0aGlzLl9kaWZmTW9kZWwuZ2V0KCk7XG5cdFx0XHR0cmFuc2FjdGlvbih0eCA9PiB7XG5cdFx0XHRcdGZvciAoY29uc3QgcyBvZiB0aGlzLl9lZGl0b3JzLm9yaWdpbmFsLmdldFNlbGVjdGlvbnMoKSB8fCBbXSkge1xuXHRcdFx0XHRcdG0/LmVuc3VyZU9yaWdpbmFsTGluZUlzVmlzaWJsZShzLmdldFN0YXJ0UG9zaXRpb24oKS5saW5lTnVtYmVyLCBSZXZlYWxQcmVmZXJlbmNlLkZyb21DbG9zZXJTaWRlLCB0eCk7XG5cdFx0XHRcdFx0bT8uZW5zdXJlT3JpZ2luYWxMaW5lSXNWaXNpYmxlKHMuZ2V0RW5kUG9zaXRpb24oKS5saW5lTnVtYmVyLCBSZXZlYWxQcmVmZXJlbmNlLkZyb21DbG9zZXJTaWRlLCB0eCk7XG5cdFx0XHRcdH1cblx0XHRcdH0pO1xuXHRcdH0pKTtcblxuXHRcdHRoaXMuX3JlZ2lzdGVyKHRoaXMuX2VkaXRvcnMubW9kaWZpZWQub25EaWRDaGFuZ2VDdXJzb3JQb3NpdGlvbihlID0+IHtcblx0XHRcdGlmIChlLnJlYXNvbiA9PT0gQ3Vyc29yQ2hhbmdlUmVhc29uLkNvbnRlbnRGbHVzaCkgeyByZXR1cm47IH1cblx0XHRcdGNvbnN0IG0gPSB0aGlzLl9kaWZmTW9kZWwuZ2V0KCk7XG5cdFx0XHR0cmFuc2FjdGlvbih0eCA9PiB7XG5cdFx0XHRcdGZvciAoY29uc3QgcyBvZiB0aGlzLl9lZGl0b3JzLm1vZGlmaWVkLmdldFNlbGVjdGlvbnMoKSB8fCBbXSkge1xuXHRcdFx0XHRcdG0/LmVuc3VyZU1vZGlmaWVkTGluZUlzVmlzaWJsZShzLmdldFN0YXJ0UG9zaXRpb24oKS5saW5lTnVtYmVyLCBSZXZlYWxQcmVmZXJlbmNlLkZyb21DbG9zZXJTaWRlLCB0eCk7XG5cdFx0XHRcdFx0bT8uZW5zdXJlTW9kaWZpZWRMaW5lSXNWaXNpYmxlKHMuZ2V0RW5kUG9zaXRpb24oKS5saW5lTnVtYmVyLCBSZXZlYWxQcmVmZXJlbmNlLkZyb21DbG9zZXJTaWRlLCB0eCk7XG5cdFx0XHRcdH1cblx0XHRcdH0pO1xuXHRcdH0pKTtcblxuXHRcdGNvbnN0IHVuY2hhbmdlZFJlZ2lvbnMgPSB0aGlzLl9kaWZmTW9kZWwubWFwKChtLCByZWFkZXIpID0+IHtcblx0XHRcdGNvbnN0IHJlZ2lvbnMgPSBtPy51bmNoYW5nZWRSZWdpb25zLnJlYWQocmVhZGVyKSA/PyBbXTtcblx0XHRcdGlmIChyZWdpb25zLmxlbmd0aCA9PT0gMSAmJiByZWdpb25zWzBdLm1vZGlmaWVkTGluZU51bWJlciA9PT0gMSAmJiByZWdpb25zWzBdLmxpbmVDb3VudCA9PT0gdGhpcy5fZWRpdG9ycy5tb2RpZmllZE1vZGVsLnJlYWQocmVhZGVyKT8uZ2V0TGluZUNvdW50KCkpIHtcblx0XHRcdFx0cmV0dXJuIFtdO1xuXHRcdFx0fVxuXHRcdFx0cmV0dXJuIHJlZ2lvbnM7XG5cdFx0fSk7XG5cblx0XHR0aGlzLnZpZXdab25lcyA9IGRlcml2ZWRXaXRoU3RvcmUodGhpcywgKHJlYWRlciwgc3RvcmUpID0+IHtcblx0XHRcdC8qKiBAZGVzY3JpcHRpb24gdmlldyBab25lcyAqL1xuXHRcdFx0Y29uc3QgbW9kaWZpZWRPdXRsaW5lU291cmNlID0gdGhpcy5fbW9kaWZpZWRPdXRsaW5lU291cmNlLnJlYWQocmVhZGVyKTtcblx0XHRcdGlmICghbW9kaWZpZWRPdXRsaW5lU291cmNlKSB7IHJldHVybiB7IG9yaWdWaWV3Wm9uZXM6IFtdLCBtb2RWaWV3Wm9uZXM6IFtdIH07IH1cblxuXHRcdFx0Y29uc3Qgb3JpZ1ZpZXdab25lczogSU9ic2VydmFibGVWaWV3Wm9uZVtdID0gW107XG5cdFx0XHRjb25zdCBtb2RWaWV3Wm9uZXM6IElPYnNlcnZhYmxlVmlld1pvbmVbXSA9IFtdO1xuXHRcdFx0Y29uc3Qgc2lkZUJ5U2lkZSA9IHRoaXMuX29wdGlvbnMucmVuZGVyU2lkZUJ5U2lkZS5yZWFkKHJlYWRlcik7XG5cblx0XHRcdGNvbnN0IGNvbXBhY3RNb2RlID0gdGhpcy5fb3B0aW9ucy5jb21wYWN0TW9kZS5yZWFkKHJlYWRlcik7XG5cblx0XHRcdGNvbnN0IGN1clVuY2hhbmdlZFJlZ2lvbnMgPSB1bmNoYW5nZWRSZWdpb25zLnJlYWQocmVhZGVyKTtcblx0XHRcdGZvciAobGV0IGkgPSAwOyBpIDwgY3VyVW5jaGFuZ2VkUmVnaW9ucy5sZW5ndGg7IGkrKykge1xuXHRcdFx0XHRjb25zdCByID0gY3VyVW5jaGFuZ2VkUmVnaW9uc1tpXTtcblx0XHRcdFx0aWYgKHIuc2hvdWxkSGlkZUNvbnRyb2xzKHJlYWRlcikpIHtcblx0XHRcdFx0XHRjb250aW51ZTtcblx0XHRcdFx0fVxuXG5cdFx0XHRcdGlmIChjb21wYWN0TW9kZSAmJiAoaSA9PT0gMCB8fCBpID09PSBjdXJVbmNoYW5nZWRSZWdpb25zLmxlbmd0aCAtIDEpKSB7XG5cdFx0XHRcdFx0Y29udGludWU7XG5cdFx0XHRcdH1cblxuXHRcdFx0XHRpZiAoY29tcGFjdE1vZGUpIHtcblx0XHRcdFx0XHR7XG5cdFx0XHRcdFx0XHRjb25zdCBkID0gZGVyaXZlZCh0aGlzLCByZWFkZXIgPT4gLyoqIEBkZXNjcmlwdGlvbiBoaWRkZW5PcmlnaW5hbFJhbmdlU3RhcnQgKi8gci5nZXRIaWRkZW5PcmlnaW5hbFJhbmdlKHJlYWRlcikuc3RhcnRMaW5lTnVtYmVyIC0gMSk7XG5cdFx0XHRcdFx0XHRjb25zdCBvcmlnVnogPSBuZXcgUGxhY2Vob2xkZXJWaWV3Wm9uZShkLCAxMik7XG5cdFx0XHRcdFx0XHRvcmlnVmlld1pvbmVzLnB1c2gob3JpZ1Z6KTtcblx0XHRcdFx0XHRcdHN0b3JlLmFkZChuZXcgQ29tcGFjdENvbGxhcHNlZENvZGVPdmVybGF5V2lkZ2V0KFxuXHRcdFx0XHRcdFx0XHR0aGlzLl9lZGl0b3JzLm9yaWdpbmFsLFxuXHRcdFx0XHRcdFx0XHRvcmlnVnosXG5cdFx0XHRcdFx0XHRcdHIsXG5cdFx0XHRcdFx0XHRcdCFzaWRlQnlTaWRlLFxuXHRcdFx0XHRcdFx0KSk7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHRcdHtcblx0XHRcdFx0XHRcdGNvbnN0IGQgPSBkZXJpdmVkKHRoaXMsIHJlYWRlciA9PiAvKiogQGRlc2NyaXB0aW9uIGhpZGRlbk1vZGlmaWVkUmFuZ2VTdGFydCAqLyByLmdldEhpZGRlbk1vZGlmaWVkUmFuZ2UocmVhZGVyKS5zdGFydExpbmVOdW1iZXIgLSAxKTtcblx0XHRcdFx0XHRcdGNvbnN0IG1vZFZpZXdab25lID0gbmV3IFBsYWNlaG9sZGVyVmlld1pvbmUoZCwgMTIpO1xuXHRcdFx0XHRcdFx0bW9kVmlld1pvbmVzLnB1c2gobW9kVmlld1pvbmUpO1xuXHRcdFx0XHRcdFx0c3RvcmUuYWRkKG5ldyBDb21wYWN0Q29sbGFwc2VkQ29kZU92ZXJsYXlXaWRnZXQoXG5cdFx0XHRcdFx0XHRcdHRoaXMuX2VkaXRvcnMubW9kaWZpZWQsXG5cdFx0XHRcdFx0XHRcdG1vZFZpZXdab25lLFxuXHRcdFx0XHRcdFx0XHRyLFxuXHRcdFx0XHRcdFx0KSk7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRcdHtcblx0XHRcdFx0XHRcdGNvbnN0IGQgPSBkZXJpdmVkKHRoaXMsIHJlYWRlciA9PiAvKiogQGRlc2NyaXB0aW9uIGhpZGRlbk9yaWdpbmFsUmFuZ2VTdGFydCAqLyByLmdldEhpZGRlbk9yaWdpbmFsUmFuZ2UocmVhZGVyKS5zdGFydExpbmVOdW1iZXIgLSAxKTtcblx0XHRcdFx0XHRcdGNvbnN0IG9yaWdWeiA9IG5ldyBQbGFjZWhvbGRlclZpZXdab25lKGQsIDI0KTtcblx0XHRcdFx0XHRcdG9yaWdWaWV3Wm9uZXMucHVzaChvcmlnVnopO1xuXHRcdFx0XHRcdFx0c3RvcmUuYWRkKG5ldyBDb2xsYXBzZWRDb2RlT3ZlcmxheVdpZGdldChcblx0XHRcdFx0XHRcdFx0dGhpcy5fZWRpdG9ycy5vcmlnaW5hbCxcblx0XHRcdFx0XHRcdFx0b3JpZ1Z6LFxuXHRcdFx0XHRcdFx0XHRyLFxuXHRcdFx0XHRcdFx0XHRyLm9yaWdpbmFsVW5jaGFuZ2VkUmFuZ2UsXG5cdFx0XHRcdFx0XHRcdCFzaWRlQnlTaWRlLFxuXHRcdFx0XHRcdFx0XHRtb2RpZmllZE91dGxpbmVTb3VyY2UsXG5cdFx0XHRcdFx0XHRcdGwgPT4gdGhpcy5fZGlmZk1vZGVsLmdldCgpIS5lbnN1cmVNb2RpZmllZExpbmVJc1Zpc2libGUobCwgUmV2ZWFsUHJlZmVyZW5jZS5Gcm9tQm90dG9tLCB1bmRlZmluZWQpLFxuXHRcdFx0XHRcdFx0XHR0aGlzLl9vcHRpb25zLFxuXHRcdFx0XHRcdFx0KSk7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHRcdHtcblx0XHRcdFx0XHRcdGNvbnN0IGQgPSBkZXJpdmVkKHRoaXMsIHJlYWRlciA9PiAvKiogQGRlc2NyaXB0aW9uIGhpZGRlbk1vZGlmaWVkUmFuZ2VTdGFydCAqLyByLmdldEhpZGRlbk1vZGlmaWVkUmFuZ2UocmVhZGVyKS5zdGFydExpbmVOdW1iZXIgLSAxKTtcblx0XHRcdFx0XHRcdGNvbnN0IG1vZFZpZXdab25lID0gbmV3IFBsYWNlaG9sZGVyVmlld1pvbmUoZCwgMjQpO1xuXHRcdFx0XHRcdFx0bW9kVmlld1pvbmVzLnB1c2gobW9kVmlld1pvbmUpO1xuXHRcdFx0XHRcdFx0c3RvcmUuYWRkKG5ldyBDb2xsYXBzZWRDb2RlT3ZlcmxheVdpZGdldChcblx0XHRcdFx0XHRcdFx0dGhpcy5fZWRpdG9ycy5tb2RpZmllZCxcblx0XHRcdFx0XHRcdFx0bW9kVmlld1pvbmUsXG5cdFx0XHRcdFx0XHRcdHIsXG5cdFx0XHRcdFx0XHRcdHIubW9kaWZpZWRVbmNoYW5nZWRSYW5nZSxcblx0XHRcdFx0XHRcdFx0ZmFsc2UsXG5cdFx0XHRcdFx0XHRcdG1vZGlmaWVkT3V0bGluZVNvdXJjZSxcblx0XHRcdFx0XHRcdFx0bCA9PiB0aGlzLl9kaWZmTW9kZWwuZ2V0KCkhLmVuc3VyZU1vZGlmaWVkTGluZUlzVmlzaWJsZShsLCBSZXZlYWxQcmVmZXJlbmNlLkZyb21Cb3R0b20sIHVuZGVmaW5lZCksXG5cdFx0XHRcdFx0XHRcdHRoaXMuX29wdGlvbnMsXG5cdFx0XHRcdFx0XHQpKTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdH1cblx0XHRcdH1cblxuXHRcdFx0cmV0dXJuIHsgb3JpZ1ZpZXdab25lcywgbW9kVmlld1pvbmVzLCB9O1xuXHRcdH0pO1xuXG5cblx0XHRjb25zdCB1bmNoYW5nZWRMaW5lc0RlY29yYXRpb246IElNb2RlbERlY29yYXRpb25PcHRpb25zID0ge1xuXHRcdFx0ZGVzY3JpcHRpb246ICd1bmNoYW5nZWQgbGluZXMnLFxuXHRcdFx0Y2xhc3NOYW1lOiAnZGlmZi11bmNoYW5nZWQtbGluZXMnLFxuXHRcdFx0aXNXaG9sZUxpbmU6IHRydWUsXG5cdFx0fTtcblx0XHRjb25zdCB1bmNoYW5nZWRMaW5lc0RlY29yYXRpb25TaG93OiBJTW9kZWxEZWNvcmF0aW9uT3B0aW9ucyA9IHtcblx0XHRcdGRlc2NyaXB0aW9uOiAnRm9sZCBVbmNoYW5nZWQnLFxuXHRcdFx0Z2x5cGhNYXJnaW5Ib3Zlck1lc3NhZ2U6IG5ldyBNYXJrZG93blN0cmluZyh1bmRlZmluZWQsIHsgaXNUcnVzdGVkOiB0cnVlLCBzdXBwb3J0VGhlbWVJY29uczogdHJ1ZSB9KVxuXHRcdFx0XHQuYXBwZW5kTWFya2Rvd24obG9jYWxpemUoJ2ZvbGRVbmNoYW5nZWQnLCAnRm9sZCBVbmNoYW5nZWQgUmVnaW9uJykpLFxuXHRcdFx0Z2x5cGhNYXJnaW5DbGFzc05hbWU6ICdmb2xkLXVuY2hhbmdlZCAnICsgVGhlbWVJY29uLmFzQ2xhc3NOYW1lKENvZGljb24uZm9sZCksXG5cdFx0XHR6SW5kZXg6IDEwMDAxLFxuXHRcdH07XG5cblx0XHR0aGlzLl9yZWdpc3RlcihhcHBseU9ic2VydmFibGVEZWNvcmF0aW9ucyh0aGlzLl9lZGl0b3JzLm9yaWdpbmFsLCBkZXJpdmVkKHRoaXMsIHJlYWRlciA9PiB7XG5cdFx0XHQvKiogQGRlc2NyaXB0aW9uIGRlY29yYXRpb25zICovXG5cdFx0XHRjb25zdCBjdXJVbmNoYW5nZWRSZWdpb25zID0gdW5jaGFuZ2VkUmVnaW9ucy5yZWFkKHJlYWRlcik7XG5cdFx0XHRjb25zdCByZXN1bHQgPSBjdXJVbmNoYW5nZWRSZWdpb25zLm1hcDxJTW9kZWxEZWx0YURlY29yYXRpb24+KHIgPT4gKHtcblx0XHRcdFx0cmFuZ2U6IHIub3JpZ2luYWxVbmNoYW5nZWRSYW5nZS50b0luY2x1c2l2ZVJhbmdlKCkhLFxuXHRcdFx0XHRvcHRpb25zOiB1bmNoYW5nZWRMaW5lc0RlY29yYXRpb24sXG5cdFx0XHR9KSk7XG5cdFx0XHRmb3IgKGNvbnN0IHIgb2YgY3VyVW5jaGFuZ2VkUmVnaW9ucykge1xuXHRcdFx0XHRpZiAoci5zaG91bGRIaWRlQ29udHJvbHMocmVhZGVyKSkge1xuXHRcdFx0XHRcdHJlc3VsdC5wdXNoKHtcblx0XHRcdFx0XHRcdHJhbmdlOiBSYW5nZS5mcm9tUG9zaXRpb25zKG5ldyBQb3NpdGlvbihyLm9yaWdpbmFsTGluZU51bWJlciwgMSkpLFxuXHRcdFx0XHRcdFx0b3B0aW9uczogdW5jaGFuZ2VkTGluZXNEZWNvcmF0aW9uU2hvdyxcblx0XHRcdFx0XHR9KTtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdFx0cmV0dXJuIHJlc3VsdDtcblx0XHR9KSkpO1xuXG5cdFx0dGhpcy5fcmVnaXN0ZXIoYXBwbHlPYnNlcnZhYmxlRGVjb3JhdGlvbnModGhpcy5fZWRpdG9ycy5tb2RpZmllZCwgZGVyaXZlZCh0aGlzLCByZWFkZXIgPT4ge1xuXHRcdFx0LyoqIEBkZXNjcmlwdGlvbiBkZWNvcmF0aW9ucyAqL1xuXHRcdFx0Y29uc3QgY3VyVW5jaGFuZ2VkUmVnaW9ucyA9IHVuY2hhbmdlZFJlZ2lvbnMucmVhZChyZWFkZXIpO1xuXHRcdFx0Y29uc3QgcmVzdWx0ID0gY3VyVW5jaGFuZ2VkUmVnaW9ucy5tYXA8SU1vZGVsRGVsdGFEZWNvcmF0aW9uPihyID0+ICh7XG5cdFx0XHRcdHJhbmdlOiByLm1vZGlmaWVkVW5jaGFuZ2VkUmFuZ2UudG9JbmNsdXNpdmVSYW5nZSgpISxcblx0XHRcdFx0b3B0aW9uczogdW5jaGFuZ2VkTGluZXNEZWNvcmF0aW9uLFxuXHRcdFx0fSkpO1xuXHRcdFx0Zm9yIChjb25zdCByIG9mIGN1clVuY2hhbmdlZFJlZ2lvbnMpIHtcblx0XHRcdFx0aWYgKHIuc2hvdWxkSGlkZUNvbnRyb2xzKHJlYWRlcikpIHtcblx0XHRcdFx0XHRyZXN1bHQucHVzaCh7XG5cdFx0XHRcdFx0XHRyYW5nZTogTGluZVJhbmdlLm9mTGVuZ3RoKHIubW9kaWZpZWRMaW5lTnVtYmVyLCAxKS50b0luY2x1c2l2ZVJhbmdlKCkhLFxuXHRcdFx0XHRcdFx0b3B0aW9uczogdW5jaGFuZ2VkTGluZXNEZWNvcmF0aW9uU2hvdyxcblx0XHRcdFx0XHR9KTtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdFx0cmV0dXJuIHJlc3VsdDtcblx0XHR9KSkpO1xuXG5cdFx0dGhpcy5fcmVnaXN0ZXIoYXV0b3J1bigocmVhZGVyKSA9PiB7XG5cdFx0XHQvKiogQGRlc2NyaXB0aW9uIHVwZGF0ZSBmb2xkZWQgdW5jaGFuZ2VkIHJlZ2lvbnMgKi9cblx0XHRcdGNvbnN0IGN1clVuY2hhbmdlZFJlZ2lvbnMgPSB1bmNoYW5nZWRSZWdpb25zLnJlYWQocmVhZGVyKTtcblx0XHRcdHRoaXMuX2lzVXBkYXRpbmdIaWRkZW5BcmVhcyA9IHRydWU7XG5cdFx0XHR0cnkge1xuXHRcdFx0XHR0aGlzLl9lZGl0b3JzLm9yaWdpbmFsLnNldEhpZGRlbkFyZWFzKGN1clVuY2hhbmdlZFJlZ2lvbnMubWFwKHIgPT4gci5nZXRIaWRkZW5PcmlnaW5hbFJhbmdlKHJlYWRlcikudG9JbmNsdXNpdmVSYW5nZSgpKS5maWx0ZXIoaXNEZWZpbmVkKSk7XG5cdFx0XHRcdHRoaXMuX2VkaXRvcnMubW9kaWZpZWQuc2V0SGlkZGVuQXJlYXMoY3VyVW5jaGFuZ2VkUmVnaW9ucy5tYXAociA9PiByLmdldEhpZGRlbk1vZGlmaWVkUmFuZ2UocmVhZGVyKS50b0luY2x1c2l2ZVJhbmdlKCkpLmZpbHRlcihpc0RlZmluZWQpKTtcblx0XHRcdH0gZmluYWxseSB7XG5cdFx0XHRcdHRoaXMuX2lzVXBkYXRpbmdIaWRkZW5BcmVhcyA9IGZhbHNlO1xuXHRcdFx0fVxuXHRcdH0pKTtcblxuXHRcdHRoaXMuX3JlZ2lzdGVyKHRoaXMuX2VkaXRvcnMubW9kaWZpZWQub25Nb3VzZVVwKGV2ZW50ID0+IHtcblx0XHRcdGlmICghZXZlbnQuZXZlbnQucmlnaHRCdXR0b24gJiYgZXZlbnQudGFyZ2V0LnBvc2l0aW9uICYmIGV2ZW50LnRhcmdldC5lbGVtZW50Py5jbGFzc05hbWUuaW5jbHVkZXMoJ2ZvbGQtdW5jaGFuZ2VkJykpIHtcblx0XHRcdFx0Y29uc3QgbGluZU51bWJlciA9IGV2ZW50LnRhcmdldC5wb3NpdGlvbi5saW5lTnVtYmVyO1xuXHRcdFx0XHRjb25zdCBtb2RlbCA9IHRoaXMuX2RpZmZNb2RlbC5nZXQoKTtcblx0XHRcdFx0aWYgKCFtb2RlbCkgeyByZXR1cm47IH1cblx0XHRcdFx0Y29uc3QgcmVnaW9uID0gbW9kZWwudW5jaGFuZ2VkUmVnaW9ucy5nZXQoKS5maW5kKHIgPT4gci5tb2RpZmllZFVuY2hhbmdlZFJhbmdlLmluY2x1ZGVzKGxpbmVOdW1iZXIpKTtcblx0XHRcdFx0aWYgKCFyZWdpb24pIHsgcmV0dXJuOyB9XG5cdFx0XHRcdHJlZ2lvbi5jb2xsYXBzZUFsbCh1bmRlZmluZWQpO1xuXHRcdFx0XHRldmVudC5ldmVudC5zdG9wUHJvcGFnYXRpb24oKTtcblx0XHRcdFx0ZXZlbnQuZXZlbnQucHJldmVudERlZmF1bHQoKTtcblx0XHRcdH1cblx0XHR9KSk7XG5cblx0XHR0aGlzLl9yZWdpc3Rlcih0aGlzLl9lZGl0b3JzLm9yaWdpbmFsLm9uTW91c2VVcChldmVudCA9PiB7XG5cdFx0XHRpZiAoIWV2ZW50LmV2ZW50LnJpZ2h0QnV0dG9uICYmIGV2ZW50LnRhcmdldC5wb3NpdGlvbiAmJiBldmVudC50YXJnZXQuZWxlbWVudD8uY2xhc3NOYW1lLmluY2x1ZGVzKCdmb2xkLXVuY2hhbmdlZCcpKSB7XG5cdFx0XHRcdGNvbnN0IGxpbmVOdW1iZXIgPSBldmVudC50YXJnZXQucG9zaXRpb24ubGluZU51bWJlcjtcblx0XHRcdFx0Y29uc3QgbW9kZWwgPSB0aGlzLl9kaWZmTW9kZWwuZ2V0KCk7XG5cdFx0XHRcdGlmICghbW9kZWwpIHsgcmV0dXJuOyB9XG5cdFx0XHRcdGNvbnN0IHJlZ2lvbiA9IG1vZGVsLnVuY2hhbmdlZFJlZ2lvbnMuZ2V0KCkuZmluZChyID0+IHIub3JpZ2luYWxVbmNoYW5nZWRSYW5nZS5pbmNsdWRlcyhsaW5lTnVtYmVyKSk7XG5cdFx0XHRcdGlmICghcmVnaW9uKSB7IHJldHVybjsgfVxuXHRcdFx0XHRyZWdpb24uY29sbGFwc2VBbGwodW5kZWZpbmVkKTtcblx0XHRcdFx0ZXZlbnQuZXZlbnQuc3RvcFByb3BhZ2F0aW9uKCk7XG5cdFx0XHRcdGV2ZW50LmV2ZW50LnByZXZlbnREZWZhdWx0KCk7XG5cdFx0XHR9XG5cdFx0fSkpO1xuXHR9XG59XG5cbmNsYXNzIENvbXBhY3RDb2xsYXBzZWRDb2RlT3ZlcmxheVdpZGdldCBleHRlbmRzIFZpZXdab25lT3ZlcmxheVdpZGdldCB7XG5cdHByaXZhdGUgcmVhZG9ubHkgX25vZGVzID0gaCgnZGl2LmRpZmYtaGlkZGVuLWxpbmVzLWNvbXBhY3QnLCBbXG5cdFx0aCgnZGl2LmxpbmUtbGVmdCcsIFtdKSxcblx0XHRoKCdkaXYudGV4dEB0ZXh0JywgW10pLFxuXHRcdGgoJ2Rpdi5saW5lLXJpZ2h0JywgW10pXG5cdF0pO1xuXG5cdGNvbnN0cnVjdG9yKFxuXHRcdGVkaXRvcjogSUNvZGVFZGl0b3IsXG5cdFx0X3ZpZXdab25lOiBQbGFjZWhvbGRlclZpZXdab25lLFxuXHRcdHByaXZhdGUgcmVhZG9ubHkgX3VuY2hhbmdlZFJlZ2lvbjogVW5jaGFuZ2VkUmVnaW9uLFxuXHRcdHByaXZhdGUgcmVhZG9ubHkgX2hpZGU6IGJvb2xlYW4gPSBmYWxzZSxcblx0KSB7XG5cdFx0Y29uc3Qgcm9vdCA9IGgoJ2Rpdi5kaWZmLWhpZGRlbi1saW5lcy13aWRnZXQnKTtcblx0XHRzdXBlcihlZGl0b3IsIF92aWV3Wm9uZSwgcm9vdC5yb290KTtcblx0XHRyb290LnJvb3QuYXBwZW5kQ2hpbGQodGhpcy5fbm9kZXMucm9vdCk7XG5cblx0XHRpZiAodGhpcy5faGlkZSkge1xuXHRcdFx0dGhpcy5fbm9kZXMucm9vdC5yZXBsYWNlQ2hpbGRyZW4oKTtcblx0XHR9XG5cblx0XHR0aGlzLl9yZWdpc3RlcihhdXRvcnVuKHJlYWRlciA9PiB7XG5cdFx0XHQvKiogQGRlc2NyaXB0aW9uIHVwZGF0ZSBsYWJlbHMgKi9cblxuXHRcdFx0aWYgKCF0aGlzLl9oaWRlKSB7XG5cdFx0XHRcdGNvbnN0IGxpbmVDb3VudCA9IHRoaXMuX3VuY2hhbmdlZFJlZ2lvbi5nZXRIaWRkZW5Nb2RpZmllZFJhbmdlKHJlYWRlcikubGVuZ3RoO1xuXHRcdFx0XHRjb25zdCBsaW5lc0hpZGRlblRleHQgPSBsb2NhbGl6ZSgnaGlkZGVuTGluZXMnLCAnezB9IGhpZGRlbiBsaW5lcycsIGxpbmVDb3VudCk7XG5cdFx0XHRcdHRoaXMuX25vZGVzLnRleHQuaW5uZXJUZXh0ID0gbGluZXNIaWRkZW5UZXh0O1xuXHRcdFx0fVxuXHRcdH0pKTtcblx0fVxufVxuXG5jbGFzcyBDb2xsYXBzZWRDb2RlT3ZlcmxheVdpZGdldCBleHRlbmRzIFZpZXdab25lT3ZlcmxheVdpZGdldCB7XG5cdHByaXZhdGUgcmVhZG9ubHkgX25vZGVzID0gaCgnZGl2LmRpZmYtaGlkZGVuLWxpbmVzJywgW1xuXHRcdGgoJ2Rpdi50b3BAdG9wJywgeyB0aXRsZTogbG9jYWxpemUoJ2RpZmYuaGlkZGVuTGluZXMudG9wJywgJ0NsaWNrIG9yIGRyYWcgdG8gc2hvdyBtb3JlIGFib3ZlJykgfSksXG5cdFx0aCgnZGl2LmNlbnRlckBjb250ZW50JywgeyBzdHlsZTogeyBkaXNwbGF5OiAnZmxleCcgfSB9LCBbXG5cdFx0XHRoKCdkaXZAZmlyc3QnLCB7IHN0eWxlOiB7IGRpc3BsYXk6ICdmbGV4JywganVzdGlmeUNvbnRlbnQ6ICdjZW50ZXInLCBhbGlnbkl0ZW1zOiAnY2VudGVyJywgZmxleFNocmluazogJzAnIH0gfSxcblx0XHRcdFx0WyQoJ2EnLCB7IHRpdGxlOiBsb2NhbGl6ZSgnc2hvd1VuY2hhbmdlZFJlZ2lvbicsICdTaG93IFVuY2hhbmdlZCBSZWdpb24nKSwgcm9sZTogJ2J1dHRvbicsIG9uY2xpY2s6ICgpID0+IHsgdGhpcy5fdW5jaGFuZ2VkUmVnaW9uLnNob3dBbGwodW5kZWZpbmVkKTsgfSB9LFxuXHRcdFx0XHRcdC4uLnJlbmRlckxhYmVsV2l0aEljb25zKCckKHVuZm9sZCknKSldXG5cdFx0XHQpLFxuXHRcdFx0aCgnZGl2QG90aGVycycsIHsgc3R5bGU6IHsgZGlzcGxheTogJ2ZsZXgnLCBqdXN0aWZ5Q29udGVudDogJ2NlbnRlcicsIGFsaWduSXRlbXM6ICdjZW50ZXInIH0gfSksXG5cdFx0XSksXG5cdFx0aCgnZGl2LmJvdHRvbUBib3R0b20nLCB7IHRpdGxlOiBsb2NhbGl6ZSgnZGlmZi5ib3R0b20nLCAnQ2xpY2sgb3IgZHJhZyB0byBzaG93IG1vcmUgYmVsb3cnKSwgcm9sZTogJ2J1dHRvbicgfSksXG5cdF0pO1xuXG5cdGNvbnN0cnVjdG9yKFxuXHRcdHByaXZhdGUgcmVhZG9ubHkgX2VkaXRvcjogSUNvZGVFZGl0b3IsXG5cdFx0X3ZpZXdab25lOiBQbGFjZWhvbGRlclZpZXdab25lLFxuXHRcdHByaXZhdGUgcmVhZG9ubHkgX3VuY2hhbmdlZFJlZ2lvbjogVW5jaGFuZ2VkUmVnaW9uLFxuXHRcdHByaXZhdGUgcmVhZG9ubHkgX3VuY2hhbmdlZFJlZ2lvblJhbmdlOiBMaW5lUmFuZ2UsXG5cdFx0cHJpdmF0ZSByZWFkb25seSBfaGlkZTogYm9vbGVhbixcblx0XHRwcml2YXRlIHJlYWRvbmx5IF9tb2RpZmllZE91dGxpbmVTb3VyY2U6IElEaWZmRWRpdG9yQnJlYWRjcnVtYnNTb3VyY2UsXG5cdFx0cHJpdmF0ZSByZWFkb25seSBfcmV2ZWFsTW9kaWZpZWRIaWRkZW5MaW5lOiAobGluZU51bWJlcjogbnVtYmVyKSA9PiB2b2lkLFxuXHRcdHByaXZhdGUgcmVhZG9ubHkgX29wdGlvbnM6IERpZmZFZGl0b3JPcHRpb25zLFxuXHQpIHtcblx0XHRjb25zdCByb290ID0gaCgnZGl2LmRpZmYtaGlkZGVuLWxpbmVzLXdpZGdldCcpO1xuXHRcdHN1cGVyKF9lZGl0b3IsIF92aWV3Wm9uZSwgcm9vdC5yb290KTtcblx0XHRyb290LnJvb3QuYXBwZW5kQ2hpbGQodGhpcy5fbm9kZXMucm9vdCk7XG5cblx0XHRpZiAoIXRoaXMuX2hpZGUpIHtcblx0XHRcdHRoaXMuX3JlZ2lzdGVyKGFwcGx5U3R5bGUodGhpcy5fbm9kZXMuZmlyc3QsIHsgd2lkdGg6IG9ic2VydmFibGVDb2RlRWRpdG9yKHRoaXMuX2VkaXRvcikubGF5b3V0SW5mb0NvbnRlbnRMZWZ0IH0pKTtcblx0XHR9IGVsc2Uge1xuXHRcdFx0cmVzZXQodGhpcy5fbm9kZXMuZmlyc3QpO1xuXHRcdH1cblxuXHRcdHRoaXMuX3JlZ2lzdGVyKGF1dG9ydW4ocmVhZGVyID0+IHtcblx0XHRcdC8qKiBAZGVzY3JpcHRpb24gVXBkYXRlIENvbGxhcHNlZENvZGVPdmVybGF5V2lkZ2V0IGNhbk1vdmUqIGNzcyBjbGFzc2VzICovXG5cdFx0XHRjb25zdCBpc0Z1bGx5UmV2ZWFsZWQgPSB0aGlzLl91bmNoYW5nZWRSZWdpb24udmlzaWJsZUxpbmVDb3VudFRvcC5yZWFkKHJlYWRlcikgKyB0aGlzLl91bmNoYW5nZWRSZWdpb24udmlzaWJsZUxpbmVDb3VudEJvdHRvbS5yZWFkKHJlYWRlcikgPT09IHRoaXMuX3VuY2hhbmdlZFJlZ2lvbi5saW5lQ291bnQ7XG5cblx0XHRcdHRoaXMuX25vZGVzLmJvdHRvbS5jbGFzc0xpc3QudG9nZ2xlKCdjYW5Nb3ZlVG9wJywgIWlzRnVsbHlSZXZlYWxlZCk7XG5cdFx0XHR0aGlzLl9ub2Rlcy5ib3R0b20uY2xhc3NMaXN0LnRvZ2dsZSgnY2FuTW92ZUJvdHRvbScsIHRoaXMuX3VuY2hhbmdlZFJlZ2lvbi52aXNpYmxlTGluZUNvdW50Qm90dG9tLnJlYWQocmVhZGVyKSA+IDApO1xuXHRcdFx0dGhpcy5fbm9kZXMudG9wLmNsYXNzTGlzdC50b2dnbGUoJ2Nhbk1vdmVUb3AnLCB0aGlzLl91bmNoYW5nZWRSZWdpb24udmlzaWJsZUxpbmVDb3VudFRvcC5yZWFkKHJlYWRlcikgPiAwKTtcblx0XHRcdHRoaXMuX25vZGVzLnRvcC5jbGFzc0xpc3QudG9nZ2xlKCdjYW5Nb3ZlQm90dG9tJywgIWlzRnVsbHlSZXZlYWxlZCk7XG5cdFx0XHRjb25zdCBpc0RyYWdnZWQgPSB0aGlzLl91bmNoYW5nZWRSZWdpb24uaXNEcmFnZ2VkLnJlYWQocmVhZGVyKTtcblx0XHRcdGNvbnN0IGRvbU5vZGUgPSB0aGlzLl9lZGl0b3IuZ2V0RG9tTm9kZSgpO1xuXHRcdFx0aWYgKGRvbU5vZGUpIHtcblx0XHRcdFx0ZG9tTm9kZS5jbGFzc0xpc3QudG9nZ2xlKCdkcmFnZ2luZ1VuY2hhbmdlZFJlZ2lvbicsICEhaXNEcmFnZ2VkKTtcblx0XHRcdFx0aWYgKGlzRHJhZ2dlZCA9PT0gJ3RvcCcpIHtcblx0XHRcdFx0XHRkb21Ob2RlLmNsYXNzTGlzdC50b2dnbGUoJ2Nhbk1vdmVUb3AnLCB0aGlzLl91bmNoYW5nZWRSZWdpb24udmlzaWJsZUxpbmVDb3VudFRvcC5yZWFkKHJlYWRlcikgPiAwKTtcblx0XHRcdFx0XHRkb21Ob2RlLmNsYXNzTGlzdC50b2dnbGUoJ2Nhbk1vdmVCb3R0b20nLCAhaXNGdWxseVJldmVhbGVkKTtcblx0XHRcdFx0fSBlbHNlIGlmIChpc0RyYWdnZWQgPT09ICdib3R0b20nKSB7XG5cdFx0XHRcdFx0ZG9tTm9kZS5jbGFzc0xpc3QudG9nZ2xlKCdjYW5Nb3ZlVG9wJywgIWlzRnVsbHlSZXZlYWxlZCk7XG5cdFx0XHRcdFx0ZG9tTm9kZS5jbGFzc0xpc3QudG9nZ2xlKCdjYW5Nb3ZlQm90dG9tJywgdGhpcy5fdW5jaGFuZ2VkUmVnaW9uLnZpc2libGVMaW5lQ291bnRCb3R0b20ucmVhZChyZWFkZXIpID4gMCk7XG5cdFx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdFx0ZG9tTm9kZS5jbGFzc0xpc3QudG9nZ2xlKCdjYW5Nb3ZlVG9wJywgZmFsc2UpO1xuXHRcdFx0XHRcdGRvbU5vZGUuY2xhc3NMaXN0LnRvZ2dsZSgnY2FuTW92ZUJvdHRvbScsIGZhbHNlKTtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdH0pKTtcblxuXHRcdGNvbnN0IGVkaXRvciA9IHRoaXMuX2VkaXRvcjtcblxuXHRcdHRoaXMuX3JlZ2lzdGVyKGFkZERpc3Bvc2FibGVMaXN0ZW5lcih0aGlzLl9ub2Rlcy50b3AsICdtb3VzZWRvd24nLCBlID0+IHtcblx0XHRcdGlmIChlLmJ1dHRvbiAhPT0gMCkge1xuXHRcdFx0XHRyZXR1cm47XG5cdFx0XHR9XG5cdFx0XHR0aGlzLl9ub2Rlcy50b3AuY2xhc3NMaXN0LnRvZ2dsZSgnZHJhZ2dpbmcnLCB0cnVlKTtcblx0XHRcdHRoaXMuX25vZGVzLnJvb3QuY2xhc3NMaXN0LnRvZ2dsZSgnZHJhZ2dpbmcnLCB0cnVlKTtcblx0XHRcdGUucHJldmVudERlZmF1bHQoKTtcblx0XHRcdGNvbnN0IHN0YXJ0VG9wID0gZS5jbGllbnRZO1xuXHRcdFx0bGV0IGRpZE1vdmUgPSBmYWxzZTtcblx0XHRcdGNvbnN0IGN1ciA9IHRoaXMuX3VuY2hhbmdlZFJlZ2lvbi52aXNpYmxlTGluZUNvdW50VG9wLmdldCgpO1xuXHRcdFx0dGhpcy5fdW5jaGFuZ2VkUmVnaW9uLmlzRHJhZ2dlZC5zZXQoJ3RvcCcsIHVuZGVmaW5lZCk7XG5cblx0XHRcdGNvbnN0IHdpbmRvdyA9IGdldFdpbmRvdyh0aGlzLl9ub2Rlcy50b3ApO1xuXG5cdFx0XHRjb25zdCBtb3VzZU1vdmVMaXN0ZW5lciA9IGFkZERpc3Bvc2FibGVMaXN0ZW5lcih3aW5kb3csICdtb3VzZW1vdmUnLCBlID0+IHtcblx0XHRcdFx0Y29uc3QgY3VycmVudFRvcCA9IGUuY2xpZW50WTtcblx0XHRcdFx0Y29uc3QgZGVsdGEgPSBjdXJyZW50VG9wIC0gc3RhcnRUb3A7XG5cdFx0XHRcdGRpZE1vdmUgPSBkaWRNb3ZlIHx8IE1hdGguYWJzKGRlbHRhKSA+IDI7XG5cdFx0XHRcdGNvbnN0IGxpbmVEZWx0YSA9IE1hdGgucm91bmQoZGVsdGEgLyBlZGl0b3IuZ2V0T3B0aW9uKEVkaXRvck9wdGlvbi5saW5lSGVpZ2h0KSk7XG5cdFx0XHRcdGNvbnN0IG5ld1ZhbCA9IE1hdGgubWF4KDAsIE1hdGgubWluKGN1ciArIGxpbmVEZWx0YSwgdGhpcy5fdW5jaGFuZ2VkUmVnaW9uLmdldE1heFZpc2libGVMaW5lQ291bnRUb3AoKSkpO1xuXHRcdFx0XHR0aGlzLl91bmNoYW5nZWRSZWdpb24udmlzaWJsZUxpbmVDb3VudFRvcC5zZXQobmV3VmFsLCB1bmRlZmluZWQpO1xuXHRcdFx0fSk7XG5cblx0XHRcdGNvbnN0IG1vdXNlVXBMaXN0ZW5lciA9IGFkZERpc3Bvc2FibGVMaXN0ZW5lcih3aW5kb3csICdtb3VzZXVwJywgZSA9PiB7XG5cdFx0XHRcdGlmICghZGlkTW92ZSkge1xuXHRcdFx0XHRcdHRoaXMuX3VuY2hhbmdlZFJlZ2lvbi5zaG93TW9yZUFib3ZlKHRoaXMuX29wdGlvbnMuaGlkZVVuY2hhbmdlZFJlZ2lvbnNSZXZlYWxMaW5lQ291bnQuZ2V0KCksIHVuZGVmaW5lZCk7XG5cdFx0XHRcdH1cblx0XHRcdFx0dGhpcy5fbm9kZXMudG9wLmNsYXNzTGlzdC50b2dnbGUoJ2RyYWdnaW5nJywgZmFsc2UpO1xuXHRcdFx0XHR0aGlzLl9ub2Rlcy5yb290LmNsYXNzTGlzdC50b2dnbGUoJ2RyYWdnaW5nJywgZmFsc2UpO1xuXHRcdFx0XHR0aGlzLl91bmNoYW5nZWRSZWdpb24uaXNEcmFnZ2VkLnNldCh1bmRlZmluZWQsIHVuZGVmaW5lZCk7XG5cdFx0XHRcdG1vdXNlTW92ZUxpc3RlbmVyLmRpc3Bvc2UoKTtcblx0XHRcdFx0bW91c2VVcExpc3RlbmVyLmRpc3Bvc2UoKTtcblx0XHRcdH0pO1xuXHRcdH0pKTtcblxuXHRcdHRoaXMuX3JlZ2lzdGVyKGFkZERpc3Bvc2FibGVMaXN0ZW5lcih0aGlzLl9ub2Rlcy5ib3R0b20sICdtb3VzZWRvd24nLCBlID0+IHtcblx0XHRcdGlmIChlLmJ1dHRvbiAhPT0gMCkge1xuXHRcdFx0XHRyZXR1cm47XG5cdFx0XHR9XG5cdFx0XHR0aGlzLl9ub2Rlcy5ib3R0b20uY2xhc3NMaXN0LnRvZ2dsZSgnZHJhZ2dpbmcnLCB0cnVlKTtcblx0XHRcdHRoaXMuX25vZGVzLnJvb3QuY2xhc3NMaXN0LnRvZ2dsZSgnZHJhZ2dpbmcnLCB0cnVlKTtcblx0XHRcdGUucHJldmVudERlZmF1bHQoKTtcblx0XHRcdGNvbnN0IHN0YXJ0VG9wID0gZS5jbGllbnRZO1xuXHRcdFx0bGV0IGRpZE1vdmUgPSBmYWxzZTtcblx0XHRcdGNvbnN0IGN1ciA9IHRoaXMuX3VuY2hhbmdlZFJlZ2lvbi52aXNpYmxlTGluZUNvdW50Qm90dG9tLmdldCgpO1xuXHRcdFx0dGhpcy5fdW5jaGFuZ2VkUmVnaW9uLmlzRHJhZ2dlZC5zZXQoJ2JvdHRvbScsIHVuZGVmaW5lZCk7XG5cblx0XHRcdGNvbnN0IHdpbmRvdyA9IGdldFdpbmRvdyh0aGlzLl9ub2Rlcy5ib3R0b20pO1xuXG5cdFx0XHRjb25zdCBtb3VzZU1vdmVMaXN0ZW5lciA9IGFkZERpc3Bvc2FibGVMaXN0ZW5lcih3aW5kb3csICdtb3VzZW1vdmUnLCBlID0+IHtcblx0XHRcdFx0Y29uc3QgY3VycmVudFRvcCA9IGUuY2xpZW50WTtcblx0XHRcdFx0Y29uc3QgZGVsdGEgPSBjdXJyZW50VG9wIC0gc3RhcnRUb3A7XG5cdFx0XHRcdGRpZE1vdmUgPSBkaWRNb3ZlIHx8IE1hdGguYWJzKGRlbHRhKSA+IDI7XG5cdFx0XHRcdGNvbnN0IGxpbmVEZWx0YSA9IE1hdGgucm91bmQoZGVsdGEgLyBlZGl0b3IuZ2V0T3B0aW9uKEVkaXRvck9wdGlvbi5saW5lSGVpZ2h0KSk7XG5cdFx0XHRcdGNvbnN0IG5ld1ZhbCA9IE1hdGgubWF4KDAsIE1hdGgubWluKGN1ciAtIGxpbmVEZWx0YSwgdGhpcy5fdW5jaGFuZ2VkUmVnaW9uLmdldE1heFZpc2libGVMaW5lQ291bnRCb3R0b20oKSkpO1xuXHRcdFx0XHRjb25zdCB0b3AgPSB0aGlzLl91bmNoYW5nZWRSZWdpb25SYW5nZS5lbmRMaW5lTnVtYmVyRXhjbHVzaXZlID4gZWRpdG9yLmdldE1vZGVsKCkhLmdldExpbmVDb3VudCgpXG5cdFx0XHRcdFx0PyBlZGl0b3IuZ2V0Q29udGVudEhlaWdodCgpXG5cdFx0XHRcdFx0OiBlZGl0b3IuZ2V0VG9wRm9yTGluZU51bWJlcih0aGlzLl91bmNoYW5nZWRSZWdpb25SYW5nZS5lbmRMaW5lTnVtYmVyRXhjbHVzaXZlKTtcblx0XHRcdFx0dGhpcy5fdW5jaGFuZ2VkUmVnaW9uLnZpc2libGVMaW5lQ291bnRCb3R0b20uc2V0KG5ld1ZhbCwgdW5kZWZpbmVkKTtcblx0XHRcdFx0Y29uc3QgdG9wMiA9IHRoaXMuX3VuY2hhbmdlZFJlZ2lvblJhbmdlLmVuZExpbmVOdW1iZXJFeGNsdXNpdmUgPiBlZGl0b3IuZ2V0TW9kZWwoKSEuZ2V0TGluZUNvdW50KClcblx0XHRcdFx0XHQ/IGVkaXRvci5nZXRDb250ZW50SGVpZ2h0KClcblx0XHRcdFx0XHQ6IGVkaXRvci5nZXRUb3BGb3JMaW5lTnVtYmVyKHRoaXMuX3VuY2hhbmdlZFJlZ2lvblJhbmdlLmVuZExpbmVOdW1iZXJFeGNsdXNpdmUpO1xuXHRcdFx0XHRlZGl0b3Iuc2V0U2Nyb2xsVG9wKGVkaXRvci5nZXRTY3JvbGxUb3AoKSArICh0b3AyIC0gdG9wKSk7XG5cdFx0XHR9KTtcblxuXHRcdFx0Y29uc3QgbW91c2VVcExpc3RlbmVyID0gYWRkRGlzcG9zYWJsZUxpc3RlbmVyKHdpbmRvdywgJ21vdXNldXAnLCBlID0+IHtcblx0XHRcdFx0dGhpcy5fdW5jaGFuZ2VkUmVnaW9uLmlzRHJhZ2dlZC5zZXQodW5kZWZpbmVkLCB1bmRlZmluZWQpO1xuXG5cdFx0XHRcdGlmICghZGlkTW92ZSkge1xuXHRcdFx0XHRcdGNvbnN0IHRvcCA9IGVkaXRvci5nZXRUb3BGb3JMaW5lTnVtYmVyKHRoaXMuX3VuY2hhbmdlZFJlZ2lvblJhbmdlLmVuZExpbmVOdW1iZXJFeGNsdXNpdmUpO1xuXG5cdFx0XHRcdFx0dGhpcy5fdW5jaGFuZ2VkUmVnaW9uLnNob3dNb3JlQmVsb3codGhpcy5fb3B0aW9ucy5oaWRlVW5jaGFuZ2VkUmVnaW9uc1JldmVhbExpbmVDb3VudC5nZXQoKSwgdW5kZWZpbmVkKTtcblx0XHRcdFx0XHRjb25zdCB0b3AyID0gZWRpdG9yLmdldFRvcEZvckxpbmVOdW1iZXIodGhpcy5fdW5jaGFuZ2VkUmVnaW9uUmFuZ2UuZW5kTGluZU51bWJlckV4Y2x1c2l2ZSk7XG5cdFx0XHRcdFx0ZWRpdG9yLnNldFNjcm9sbFRvcChlZGl0b3IuZ2V0U2Nyb2xsVG9wKCkgKyAodG9wMiAtIHRvcCkpO1xuXHRcdFx0XHR9XG5cdFx0XHRcdHRoaXMuX25vZGVzLmJvdHRvbS5jbGFzc0xpc3QudG9nZ2xlKCdkcmFnZ2luZycsIGZhbHNlKTtcblx0XHRcdFx0dGhpcy5fbm9kZXMucm9vdC5jbGFzc0xpc3QudG9nZ2xlKCdkcmFnZ2luZycsIGZhbHNlKTtcblx0XHRcdFx0bW91c2VNb3ZlTGlzdGVuZXIuZGlzcG9zZSgpO1xuXHRcdFx0XHRtb3VzZVVwTGlzdGVuZXIuZGlzcG9zZSgpO1xuXHRcdFx0fSk7XG5cdFx0fSkpO1xuXG5cdFx0dGhpcy5fcmVnaXN0ZXIoYXV0b3J1bihyZWFkZXIgPT4ge1xuXHRcdFx0LyoqIEBkZXNjcmlwdGlvbiB1cGRhdGUgbGFiZWxzICovXG5cblx0XHRcdGNvbnN0IGNoaWxkcmVuOiBIVE1MRWxlbWVudFtdID0gW107XG5cdFx0XHRpZiAoIXRoaXMuX2hpZGUpIHtcblx0XHRcdFx0Y29uc3QgbGluZUNvdW50ID0gX3VuY2hhbmdlZFJlZ2lvbi5nZXRIaWRkZW5Nb2RpZmllZFJhbmdlKHJlYWRlcikubGVuZ3RoO1xuXHRcdFx0XHRjb25zdCBsaW5lc0hpZGRlblRleHQgPSBsb2NhbGl6ZSgnaGlkZGVuTGluZXMnLCAnezB9IGhpZGRlbiBsaW5lcycsIGxpbmVDb3VudCk7XG5cdFx0XHRcdGNvbnN0IHNwYW4gPSAkKCdzcGFuJywgeyB0aXRsZTogbG9jYWxpemUoJ2RpZmYuaGlkZGVuTGluZXMuZXhwYW5kQWxsJywgJ0RvdWJsZSBjbGljayB0byB1bmZvbGQnKSB9LCBsaW5lc0hpZGRlblRleHQpO1xuXHRcdFx0XHRzcGFuLmFkZEV2ZW50TGlzdGVuZXIoJ2RibGNsaWNrJywgZSA9PiB7XG5cdFx0XHRcdFx0aWYgKGUuYnV0dG9uICE9PSAwKSB7IHJldHVybjsgfVxuXHRcdFx0XHRcdGUucHJldmVudERlZmF1bHQoKTtcblx0XHRcdFx0XHR0aGlzLl91bmNoYW5nZWRSZWdpb24uc2hvd0FsbCh1bmRlZmluZWQpO1xuXHRcdFx0XHR9KTtcblx0XHRcdFx0Y2hpbGRyZW4ucHVzaChzcGFuKTtcblxuXHRcdFx0XHRjb25zdCByYW5nZSA9IHRoaXMuX3VuY2hhbmdlZFJlZ2lvbi5nZXRIaWRkZW5Nb2RpZmllZFJhbmdlKHJlYWRlcik7XG5cdFx0XHRcdGNvbnN0IGl0ZW1zID0gdGhpcy5fbW9kaWZpZWRPdXRsaW5lU291cmNlLmdldEJyZWFkY3J1bWJJdGVtcyhyYW5nZSwgcmVhZGVyKTtcblxuXHRcdFx0XHRpZiAoaXRlbXMubGVuZ3RoID4gMCkge1xuXHRcdFx0XHRcdGNoaWxkcmVuLnB1c2goJCgnc3BhbicsIHVuZGVmaW5lZCwgJ1xcdTAwYTBcXHUwMGEwfFxcdTAwYTBcXHUwMGEwJykpO1xuXG5cdFx0XHRcdFx0Zm9yIChsZXQgaSA9IDA7IGkgPCBpdGVtcy5sZW5ndGg7IGkrKykge1xuXHRcdFx0XHRcdFx0Y29uc3QgaXRlbSA9IGl0ZW1zW2ldO1xuXHRcdFx0XHRcdFx0Y29uc3QgaWNvbiA9IFN5bWJvbEtpbmRzLnRvSWNvbihpdGVtLmtpbmQpO1xuXHRcdFx0XHRcdFx0Y29uc3QgZGl2SXRlbSA9IGgoJ2Rpdi5icmVhZGNydW1iLWl0ZW0nLCB7XG5cdFx0XHRcdFx0XHRcdHN0eWxlOiB7IGRpc3BsYXk6ICdmbGV4JywgYWxpZ25JdGVtczogJ2NlbnRlcicgfSxcblx0XHRcdFx0XHRcdH0sIFtcblx0XHRcdFx0XHRcdFx0cmVuZGVySWNvbihpY29uKSxcblx0XHRcdFx0XHRcdFx0J1xcdTAwYTAnLFxuXHRcdFx0XHRcdFx0XHRpdGVtLm5hbWUsXG5cdFx0XHRcdFx0XHRcdC4uLihpID09PSBpdGVtcy5sZW5ndGggLSAxXG5cdFx0XHRcdFx0XHRcdFx0PyBbXVxuXHRcdFx0XHRcdFx0XHRcdDogW3JlbmRlckljb24oQ29kaWNvbi5jaGV2cm9uUmlnaHQpXVxuXHRcdFx0XHRcdFx0XHQpXG5cdFx0XHRcdFx0XHRdKS5yb290O1xuXHRcdFx0XHRcdFx0Y2hpbGRyZW4ucHVzaChkaXZJdGVtKTtcblx0XHRcdFx0XHRcdGRpdkl0ZW0ub25jbGljayA9ICgpID0+IHtcblx0XHRcdFx0XHRcdFx0dGhpcy5fcmV2ZWFsTW9kaWZpZWRIaWRkZW5MaW5lKGl0ZW0uc3RhcnRMaW5lTnVtYmVyKTtcblx0XHRcdFx0XHRcdH07XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9XG5cdFx0XHR9XG5cblx0XHRcdHJlc2V0KHRoaXMuX25vZGVzLm90aGVycywgLi4uY2hpbGRyZW4pO1xuXHRcdH0pKTtcblx0fVxufVxuXG5leHBvcnQgaW50ZXJmYWNlIElEaWZmRWRpdG9yQnJlYWRjcnVtYnNTb3VyY2UgZXh0ZW5kcyBJRGlzcG9zYWJsZSB7XG5cdGdldEJyZWFkY3J1bWJJdGVtcyhzdGFydFJhbmdlOiBMaW5lUmFuZ2UsIHJlYWRlcjogSVJlYWRlcik6IHsgbmFtZTogc3RyaW5nOyBraW5kOiBTeW1ib2xLaW5kOyBzdGFydExpbmVOdW1iZXI6IG51bWJlciB9W107XG59XG4iXSwKICAibWFwcGluZ3MiOiAiOzs7Ozs7Ozs7OztBQUtBLFNBQVMsR0FBRyx1QkFBdUIsV0FBVyxHQUFHLGFBQWE7QUFDOUQsU0FBUyxZQUFZLDRCQUE0QjtBQUNqRCxTQUFTLGVBQWU7QUFDeEIsU0FBUyxzQkFBc0I7QUFDL0IsU0FBUyxrQkFBK0I7QUFDeEMsU0FBK0IsU0FBUyxTQUFTLG1CQUFtQixrQkFBa0IsaUJBQWlCLG1CQUFtQjtBQUMxSCxTQUFTLGlCQUFpQjtBQUMxQixTQUFTLGlCQUFpQjtBQUMxQixTQUFTLGdCQUFnQjtBQUN6QixTQUFTLDZCQUE2QjtBQUN0QyxTQUFTLG9CQUFvQjtBQUM3QixTQUFTLGlCQUFpQjtBQUMxQixTQUFTLGdCQUFnQjtBQUN6QixTQUFTLGFBQWE7QUFDdEIsU0FBUywwQkFBMEI7QUFDbkMsU0FBcUIsbUJBQW1CO0FBR3hDLFNBQVMsNEJBQTRCO0FBR3JDLFNBQThCLHdCQUF5QztBQUN2RSxTQUE4QixxQkFBcUIsdUJBQXVCLDRCQUE0QixrQkFBa0I7QUFLakgsSUFBTSw4QkFBTixjQUEwQyxXQUFXO0FBQUEsRUEyQjNELFlBQ2tCLFVBQ0EsWUFDQSxVQUN1Qix1QkFDdkM7QUFDRCxVQUFNO0FBTFc7QUFDQTtBQUNBO0FBQ3VCO0FBbEJ6QyxTQUFpQix5QkFBeUIsa0JBQWtCLE1BQU0sQ0FBQyxXQUFXO0FB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
