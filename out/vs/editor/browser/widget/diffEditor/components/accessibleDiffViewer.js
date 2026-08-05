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
import { addDisposableListener, addStandardDisposableListener, reset } from "../../../../../base/browser/dom.js";
import { createTrustedTypesPolicy } from "../../../../../base/browser/trustedTypes.js";
import { ActionBar } from "../../../../../base/browser/ui/actionbar/actionbar.js";
import { DomScrollableElement } from "../../../../../base/browser/ui/scrollbar/scrollableElement.js";
import { forEachAdjacent, groupAdjacentBy } from "../../../../../base/common/arrays.js";
import { Codicon } from "../../../../../base/common/codicons.js";
import { KeyCode, KeyMod } from "../../../../../base/common/keyCodes.js";
import { Disposable, toDisposable } from "../../../../../base/common/lifecycle.js";
import { autorun, autorunWithStore, derived, derivedWithStore, observableValue, subtransaction, transaction } from "../../../../../base/common/observable.js";
import { ThemeIcon } from "../../../../../base/common/themables.js";
import { applyFontInfo } from "../../../config/domFontInfo.js";
import { applyStyle } from "../utils.js";
import { EditorFontLigatures, EditorOption } from "../../../../common/config/editorOptions.js";
import { LineRange } from "../../../../common/core/lineRange.js";
import { OffsetRange } from "../../../../common/core/offsetRange.js";
import { Position } from "../../../../common/core/position.js";
import { Range } from "../../../../common/core/range.js";
import { LineRangeMapping } from "../../../../common/diff/rangeMapping.js";
import { ILanguageService } from "../../../../common/languages/language.js";
import { LineTokens } from "../../../../common/tokens/lineTokens.js";
import { RenderLineInput, renderViewLine2 } from "../../../../common/viewLayout/viewLineRenderer.js";
import { ViewLineRenderingData } from "../../../../common/viewModel.js";
import { localize } from "../../../../../nls.js";
import { AccessibilitySignal, IAccessibilitySignalService } from "../../../../../platform/accessibilitySignal/browser/accessibilitySignalService.js";
import { IInstantiationService } from "../../../../../platform/instantiation/common/instantiation.js";
import { registerIcon } from "../../../../../platform/theme/common/iconRegistry.js";
import "./accessibleDiffViewer.css";
import { toAction } from "../../../../../base/common/actions.js";
const accessibleDiffViewerInsertIcon = registerIcon("diff-review-insert", Codicon.add, localize("accessibleDiffViewerInsertIcon", "Icon for 'Insert' in accessible diff viewer."));
const accessibleDiffViewerRemoveIcon = registerIcon("diff-review-remove", Codicon.remove, localize("accessibleDiffViewerRemoveIcon", "Icon for 'Remove' in accessible diff viewer."));
const accessibleDiffViewerCloseIcon = registerIcon("diff-review-close", Codicon.close, localize("accessibleDiffViewerCloseIcon", "Icon for 'Close' in accessible diff viewer."));
let AccessibleDiffViewer = class extends Disposable {
  constructor(_parentNode, _visible, _setVisible, _canClose, _width, _height, _diffs, _models, _instantiationService) {
    super();
    this._parentNode = _parentNode;
    this._visible = _visible;
    this._setVisible = _setVisible;
    this._canClose = _canClose;
    this._width = _width;
    this._height = _height;
    this._diffs = _diffs;
    this._models = _models;
    this._instantiationService = _instantiationService;
    this._state = derivedWithStore(this, (reader, store) => {
      const visible = this._visible.read(reader);
      this._parentNode.style.visibility = visible ? "visible" : "hidden";
      if (!visible) {
        return null;
      }
      const model = store.add(this._instantiationService.createInstance(ViewModel, this._diffs, this._models, this._setVisible, this._canClose));
      const view = store.add(this._instantiationService.createInstance(View, this._parentNode, model, this._width, this._height, this._models));
      return { model, view };
    }).recomputeInitiallyAndOnChange(this._store);
  }
  next() {
    transaction((tx) => {
      const isVisible = this._visible.get();
      this._setVisible(true, tx);
      if (isVisible) {
        this._state.get().model.nextGroup(tx);
      }
    });
  }
  prev() {
    transaction((tx) => {
      this._setVisible(true, tx);
      this._state.get().model.previousGroup(tx);
    });
  }
  close() {
    transaction((tx) => {
      this._setVisible(false, tx);
    });
  }
};
AccessibleDiffViewer._ttPolicy = createTrustedTypesPolicy("diffReview", { createHTML: (value) => value });
AccessibleDiffViewer = __decorateClass([
  __decorateParam(8, IInstantiationService)
], AccessibleDiffViewer);
let ViewModel = class extends Disposable {
  constructor(_diffs, _models, _setVisible, canClose, _accessibilitySignalService) {
    super();
    this._diffs = _diffs;
    this._models = _models;
    this._setVisible = _setVisible;
    this.canClose = canClose;
    this._accessibilitySignalService = _accessibilitySignalService;
    this._groups = observableValue(this, []);
    this._currentGroupIdx = observableValue(this, 0);
    this._currentElementIdx = observableValue(this, 0);
    this.groups = this._groups;
    this.currentGroup = this._currentGroupIdx.map((idx, r) => this._groups.read(r)[idx]);
    this.currentGroupIndex = this._currentGroupIdx;
    this.currentElement = this._currentElementIdx.map((idx, r) => this.currentGroup.read(r)?.lines[idx]);
    this._register(autorun((reader) => {
      const diffs = this._diffs.read(reader);
      if (!diffs) {
        this._groups.set([], void 0);
        return;
      }
      const groups = computeViewElementGroups(
        diffs,
        this._models.getOriginalModel().getLineCount(),
        this._models.getModifiedModel().getLineCount()
      );
      transaction((tx) => {
        const p = this._models.getModifiedPosition();
        if (p) {
          const nextGroup = groups.findIndex((g) => p?.lineNumber < g.range.modified.endLineNumberExclusive);
          if (nextGroup !== -1) {
            this._currentGroupIdx.set(nextGroup, tx);
          }
        }
        this._groups.set(groups, tx);
      });
    }));
    this._register(autorun((reader) => {
      const currentViewItem = this.currentElement.read(reader);
      if (currentViewItem?.type === 2 /* Deleted */) {
        this._accessibilitySignalService.playSignal(AccessibilitySignal.diffLineDeleted, { source: "accessibleDiffViewer.currentElementChanged" });
      } else if (currentViewItem?.type === 3 /* Added */) {
        this._accessibilitySignalService.playSignal(AccessibilitySignal.diffLineInserted, { source: "accessibleDiffViewer.currentElementChanged" });
      }
    }));
    this._register(autorun((reader) => {
      const currentViewItem = this.currentElement.read(reader);
      if (currentViewItem && currentViewItem.type !== 0 /* Header */) {
        const lineNumber = currentViewItem.modifiedLineNumber ?? currentViewItem.diff.modified.startLineNumber;
        this._models.modifiedSetSelection(Range.fromPositions(new Position(lineNumber, 1)));
      }
    }));
  }
  _goToGroupDelta(delta, tx) {
    const groups = this.groups.get();
    if (!groups || groups.length <= 1) {
      return;
    }
    subtransaction(tx, (tx2) => {
      this._currentGroupIdx.set(OffsetRange.ofLength(groups.length).clipCyclic(this._currentGroupIdx.get() + delta), tx2);
      this._currentElementIdx.set(0, tx2);
    });
  }
  nextGroup(tx) {
    this._goToGroupDelta(1, tx);
  }
  previousGroup(tx) {
    this._goToGroupDelta(-1, tx);
  }
  _goToLineDelta(delta) {
    const group = this.currentGroup.get();
    if (!group || group.lines.length <= 1) {
      return;
    }
    transaction((tx) => {
      this._currentElementIdx.set(OffsetRange.ofLength(group.lines.length).clip(this._currentElementIdx.get() + delta), tx);
    });
  }
  goToNextLine() {
    this._goToLineDelta(1);
  }
  goToPreviousLine() {
    this._goToLineDelta(-1);
  }
  goToLine(line) {
    const group = this.currentGroup.get();
    if (!group) {
      return;
    }
    const idx = group.lines.indexOf(line);
    if (idx === -1) {
      return;
    }
    transaction((tx) => {
      this._currentElementIdx.set(idx, tx);
    });
  }
  revealCurrentElementInEditor() {
    if (!this.canClose.get()) {
      return;
    }
    this._setVisible(false, void 0);
    const curElem = this.currentElement.get();
    if (curElem) {
      if (curElem.type === 2 /* Deleted */) {
        this._models.originalReveal(Range.fromPositions(new Position(curElem.originalLineNumber, 1)));
      } else {
        this._models.modifiedReveal(
          curElem.type !== 0 /* Header */ ? Range.fromPositions(new Position(curElem.modifiedLineNumber, 1)) : void 0
        );
      }
    }
  }
  close() {
    if (!this.canClose.get()) {
      return;
    }
    this._setVisible(false, void 0);
    this._models.modifiedFocus();
  }
};
ViewModel = __decorateClass([
  __decorateParam(4, IAccessibilitySignalService)
], ViewModel);
const viewElementGroupLineMargin = 3;
function computeViewElementGroups(diffs, originalLineCount, modifiedLineCount) {
  const result = [];
  for (const g of groupAdjacentBy(diffs, (a, b) => b.modified.startLineNumber - a.modified.endLineNumberExclusive < 2 * viewElementGroupLineMargin)) {
    const viewElements = [];
    viewElements.push(new HeaderViewElement());
    const origFullRange = new LineRange(
      Math.max(1, g[0].original.startLineNumber - viewElementGroupLineMargin),
      Math.min(g[g.length - 1].original.endLineNumberExclusive + viewElementGroupLineMargin, originalLineCount + 1)
    );
    const modifiedFullRange = new LineRange(
      Math.max(1, g[0].modified.startLineNumber - viewElementGroupLineMargin),
      Math.min(g[g.length - 1].modified.endLineNumberExclusive + viewElementGroupLineMargin, modifiedLineCount + 1)
    );
    forEachAdjacent(g, (a, b) => {
      const origRange = new LineRange(a ? a.original.endLineNumberExclusive : origFullRange.startLineNumber, b ? b.original.startLineNumber : origFullRange.endLineNumberExclusive);
      const modifiedRange2 = new LineRange(a ? a.modified.endLineNumberExclusive : modifiedFullRange.startLineNumber, b ? b.modified.startLineNumber : modifiedFullRange.endLineNumberExclusive);
      origRange.forEach((origLineNumber) => {
        viewElements.push(new UnchangedLineViewElement(origLineNumber, modifiedRange2.startLineNumber + (origLineNumber - origRange.startLineNumber)));
      });
      if (b) {
        b.original.forEach((origLineNumber) => {
          viewElements.push(new DeletedLineViewElement(b, origLineNumber));
        });
        b.modified.forEach((modifiedLineNumber) => {
          viewElements.push(new AddedLineViewElement(b, modifiedLineNumber));
        });
      }
    });
    const modifiedRange = g[0].modified.join(g[g.length - 1].modified);
    const originalRange = g[0].original.join(g[g.length - 1].original);
    result.push(new ViewElementGroup(new LineRangeMapping(modifiedRange, originalRange), viewElements));
  }
  return result;
}
var LineType = /* @__PURE__ */ ((LineType2) => {
  LineType2[LineType2["Header"] = 0] = "Header";
  LineType2[LineType2["Unchanged"] = 1] = "Unchanged";
  LineType2[LineType2["Deleted"] = 2] = "Deleted";
  LineType2[LineType2["Added"] = 3] = "Added";
  return LineType2;
})(LineType || {});
class ViewElementGroup {
  constructor(range, lines) {
    this.range = range;
    this.lines = lines;
  }
}
class HeaderViewElement {
  constructor() {
    this.type = 0 /* Header */;
  }
}
class DeletedLineViewElement {
  constructor(diff, originalLineNumber) {
    this.diff = diff;
    this.originalLineNumber = originalLineNumber;
    this.type = 2 /* Deleted */;
    this.modifiedLineNumber = void 0;
  }
}
class AddedLineViewElement {
  constructor(diff, modifiedLineNumber) {
    this.diff = diff;
    this.modifiedLineNumber = modifiedLineNumber;
    this.type = 3 /* Added */;
    this.originalLineNumber = void 0;
  }
}
class UnchangedLineViewElement {
  constructor(originalLineNumber, modifiedLineNumber) {
    this.originalLineNumber = originalLineNumber;
    this.modifiedLineNumber = modifiedLineNumber;
    this.type = 1 /* Unchanged */;
  }
}
let View = class extends Disposable {
  constructor(_element, _model, _width, _height, _models, _languageService) {
    super();
    this._element = _element;
    this._model = _model;
    this._width = _width;
    this._height = _height;
    this._models = _models;
    this._languageService = _languageService;
    this.domNode = this._element;
    this.domNode.className = "monaco-component diff-review monaco-editor-background";
    const actionBarContainer = document.createElement("div");
    actionBarContainer.className = "diff-review-actions";
    this._actionBar = this._register(new ActionBar(
      actionBarContainer
    ));
    this._register(autorun((reader) => {
      this._actionBar.clear();
      if (this._model.canClose.read(reader)) {
        this._actionBar.push(toAction({
          id: "diffreview.close",
          label: localize("label.close", "Close"),
          class: "close-diff-review " + ThemeIcon.asClassName(accessibleDiffViewerCloseIcon),
          enabled: true,
          run: async () => _model.close()
        }), { label: false, icon: true });
      }
    }));
    this._content = document.createElement("div");
    this._content.className = "diff-review-content";
    this._content.setAttribute("role", "code");
    this._scrollbar = this._register(new DomScrollableElement(this._content, {}));
    reset(this.domNode, this._scrollbar.getDomNode(), actionBarContainer);
    this._register(autorun((r) => {
      this._height.read(r);
      this._width.read(r);
      this._scrollbar.scanDomNode();
    }));
    this._register(toDisposable(() => {
      reset(this.domNode);
    }));
    this._register(applyStyle(this.domNode, { width: this._width, height: this._height }));
    this._register(applyStyle(this._content, { width: this._width, height: this._height }));
    this._register(autorunWithStore((reader, store) => {
      this._model.currentGroup.read(reader);
      this._render(store);
    }));
    this._register(addStandardDisposableListener(this.domNode, "keydown", (e) => {
      if (e.equals(KeyCode.DownArrow) || e.equals(KeyMod.CtrlCmd | KeyCode.DownArrow) || e.equals(KeyMod.Alt | KeyCode.DownArrow)) {
        e.preventDefault();
        this._model.goToNextLine();
      }
      if (e.equals(KeyCode.UpArrow) || e.equals(KeyMod.CtrlCmd | KeyCode.UpArrow) || e.equals(KeyMod.Alt | KeyCode.UpArrow)) {
        e.preventDefault();
        this._model.goToPreviousLine();
      }
      if (e.equals(KeyCode.Escape) || e.equals(KeyMod.CtrlCmd | KeyCode.Escape) || e.equals(KeyMod.Alt | KeyCode.Escape) || e.equals(KeyMod.Shift | KeyCode.Escape)) {
        e.preventDefault();
        this._model.close();
      }
      if (e.equals(KeyCode.Space) || e.equals(KeyCode.Enter)) {
        e.preventDefault();
        this._model.revealCurrentElementInEditor();
      }
    }));
  }
  _render(store) {
    const originalOptions = this._models.getOriginalOptions();
    const modifiedOptions = this._models.getModifiedOptions();
    const container = document.createElement("div");
    container.className = "diff-review-table";
    container.setAttribute("role", "list");
    container.setAttribute("aria-label", localize("ariaLabel", "Accessible Diff Viewer. Use arrow up and down to navigate."));
    applyFontInfo(container, modifiedOptions.get(EditorOption.fontInfo));
    reset(this._content, container);
    const originalModel = this._models.getOriginalModel();
    const modifiedModel = this._models.getModifiedModel();
    if (!originalModel || !modifiedModel) {
      return;
    }
    const originalModelOpts = originalModel.getOptions();
    const modifiedModelOpts = modifiedModel.getOptions();
    const lineHeight = modifiedOptions.get(EditorOption.lineHeight);
    const group = this._model.currentGroup.get();
    for (const viewItem of group?.lines || []) {
      if (!group) {
        break;
      }
      let row;
      if (viewItem.type === 0 /* Header */) {
        const header = document.createElement("div");
        header.className = "diff-review-row";
        header.setAttribute("role", "listitem");
        const r = group.range;
        const diffIndex = this._model.currentGroupIndex.get();
        const diffsLength = this._model.groups.get().length;
        const getAriaLines = (lines) => lines === 0 ? localize("no_lines_changed", "no lines changed") : lines === 1 ? localize("one_line_changed", "1 line changed") : localize("more_lines_changed", "{0} lines changed", lines);
        const originalChangedLinesCntAria = getAriaLines(r.original.length);
        const modifiedChangedLinesCntAria = getAriaLines(r.modified.length);
        header.setAttribute("aria-label", localize(
          {
            key: "header",
            comment: [
              "This is the ARIA label for a git diff header.",
              "A git diff header looks like this: @@ -154,12 +159,39 @@.",
              "That encodes that at original line 154 (which is now line 159), 12 lines were removed/changed with 39 lines.",
              "Variables 0 and 1 refer to the diff index out of total number of diffs.",
              "Variables 2 and 4 will be numbers (a line number).",
              'Variables 3 and 5 will be "no lines changed", "1 line changed" or "X lines changed", localized separately.'
            ]
          },
          "Difference {0} of {1}: original line {2}, {3}, modified line {4}, {5}",
          diffIndex + 1,
          diffsLength,
          r.original.startLineNumber,
          originalChangedLinesCntAria,
          r.modified.startLineNumber,
          modifiedChangedLinesCntAria
        ));
        const cell = document.createElement("div");
        cell.className = "diff-review-cell diff-review-summary";
        cell.appendChild(document.createTextNode(`${diffIndex + 1}/${diffsLength}: @@ -${r.original.startLineNumber},${r.original.length} +${r.modified.startLineNumber},${r.modified.length} @@`));
        header.appendChild(cell);
        row = header;
      } else {
        row = this._createRow(
          viewItem,
          lineHeight,
          this._width.get(),
          originalOptions,
          originalModel,
          originalModelOpts,
          modifiedOptions,
          modifiedModel,
          modifiedModelOpts
        );
      }
      container.appendChild(row);
      const isSelectedObs = derived((reader) => (
        /** @description isSelected */
        this._model.currentElement.read(reader) === viewItem
      ));
      store.add(autorun((reader) => {
        const isSelected = isSelectedObs.read(reader);
        row.tabIndex = isSelected ? 0 : -1;
        if (isSelected) {
          row.focus();
        }
      }));
      store.add(addDisposableListener(row, "focus", () => {
        this._model.goToLine(viewItem);
      }));
    }
    this._scrollbar.scanDomNode();
  }
  _createRow(item, lineHeight, width, originalOptions, originalModel, originalModelOpts, modifiedOptions, modifiedModel, modifiedModelOpts) {
    const originalLayoutInfo = originalOptions.get(EditorOption.layoutInfo);
    const originalLineNumbersWidth = originalLayoutInfo.glyphMarginWidth + originalLayoutInfo.lineNumbersWidth;
    const modifiedLayoutInfo = modifiedOptions.get(EditorOption.layoutInfo);
    const modifiedLineNumbersWidth = 10 + modifiedLayoutInfo.glyphMarginWidth + modifiedLayoutInfo.lineNumbersWidth;
    let rowClassName = "diff-review-row";
    let lineNumbersExtraClassName = "";
    const spacerClassName = "diff-review-spacer";
    let spacerIcon = null;
    switch (item.type) {
      case 3 /* Added */:
        rowClassName = "diff-review-row line-insert";
        lineNumbersExtraClassName = " char-insert";
        spacerIcon = accessibleDiffViewerInsertIcon;
        break;
      case 2 /* Deleted */:
        rowClassName = "diff-review-row line-delete";
        lineNumbersExtraClassName = " char-delete";
        spacerIcon = accessibleDiffViewerRemoveIcon;
        break;
    }
    const row = document.createElement("div");
    row.style.minWidth = width + "px";
    row.className = rowClassName;
    row.setAttribute("role", "listitem");
    row.ariaLevel = "";
    const cell = document.createElement("div");
    cell.className = "diff-review-cell";
    cell.style.height = `${lineHeight}px`;
    row.appendChild(cell);
    const originalLineNumber = document.createElement("span");
    originalLineNumber.style.width = originalLineNumbersWidth + "px";
    originalLineNumber.style.minWidth = originalLineNumbersWidth + "px";
    originalLineNumber.className = "diff-review-line-number" + lineNumbersExtraClassName;
    if (item.originalLineNumber !== void 0) {
      originalLineNumber.appendChild(document.createTextNode(String(item.originalLineNumber)));
    } else {
      originalLineNumber.innerText = "\xA0";
    }
    cell.appendChild(originalLineNumber);
    const modifiedLineNumber = document.createElement("span");
    modifiedLineNumber.style.width = modifiedLineNumbersWidth + "px";
    modifiedLineNumber.style.minWidth = modifiedLineNumbersWidth + "px";
    modifiedLineNumber.style.paddingRight = "10px";
    modifiedLineNumber.className = "diff-review-line-number" + lineNumbersExtraClassName;
    if (item.modifiedLineNumber !== void 0) {
      modifiedLineNumber.appendChild(document.createTextNode(String(item.modifiedLineNumber)));
    } else {
      modifiedLineNumber.innerText = "\xA0";
    }
    cell.appendChild(modifiedLineNumber);
    const spacer = document.createElement("span");
    spacer.className = spacerClassName;
    if (spacerIcon) {
      const spacerCodicon = document.createElement("span");
      spacerCodicon.className = ThemeIcon.asClassName(spacerIcon);
      spacerCodicon.innerText = "\xA0\xA0";
      spacer.appendChild(spacerCodicon);
    } else {
      spacer.innerText = "\xA0\xA0";
    }
    cell.appendChild(spacer);
    let lineContent;
    if (item.modifiedLineNumber !== void 0) {
      let html = this._getLineHtml(modifiedModel, modifiedOptions, modifiedModelOpts.tabSize, item.modifiedLineNumber, this._languageService.languageIdCodec);
      if (AccessibleDiffViewer._ttPolicy) {
        html = AccessibleDiffViewer._ttPolicy.createHTML(html);
      }
      cell.insertAdjacentHTML("beforeend", html);
      lineContent = modifiedModel.getLineContent(item.modifiedLineNumber);
    } else {
      let html = this._getLineHtml(originalModel, originalOptions, originalModelOpts.tabSize, item.originalLineNumber, this._languageService.languageIdCodec);
      if (AccessibleDiffViewer._ttPolicy) {
        html = AccessibleDiffViewer._ttPolicy.createHTML(html);
      }
      cell.insertAdjacentHTML("beforeend", html);
      lineContent = originalModel.getLineContent(item.originalLineNumber);
    }
    if (lineContent.length === 0) {
      lineContent = localize("blankLine", "blank");
    }
    let ariaLabel = "";
    switch (item.type) {
      case 1 /* Unchanged */:
        if (item.originalLineNumber === item.modifiedLineNumber) {
          ariaLabel = localize({ key: "unchangedLine", comment: ["The placeholders are contents of the line and should not be translated."] }, "{0} unchanged line {1}", lineContent, item.originalLineNumber);
        } else {
          ariaLabel = localize("equalLine", "{0} original line {1} modified line {2}", lineContent, item.originalLineNumber, item.modifiedLineNumber);
        }
        break;
      case 3 /* Added */:
        ariaLabel = localize("insertLine", "+ {0} modified line {1}", lineContent, item.modifiedLineNumber);
        break;
      case 2 /* Deleted */:
        ariaLabel = localize("deleteLine", "- {0} original line {1}", lineContent, item.originalLineNumber);
        break;
    }
    row.setAttribute("aria-label", ariaLabel);
    return row;
  }
  _getLineHtml(model, options, tabSize, lineNumber, languageIdCodec) {
    const lineContent = model.getLineContent(lineNumber);
    const fontInfo = options.get(EditorOption.fontInfo);
    const lineTokens = LineTokens.createEmpty(lineContent, languageIdCodec);
    const isBasicASCII = ViewLineRenderingData.isBasicASCII(lineContent, model.mightContainNonBasicASCII());
    const containsRTL = ViewLineRenderingData.containsRTL(lineContent, isBasicASCII, model.mightContainRTL());
    const r = renderViewLine2(new RenderLineInput(
      fontInfo.isMonospace && !options.get(EditorOption.disableMonospaceOptimizations),
      fontInfo.canUseHalfwidthRightwardsArrow,
      lineContent,
      false,
      isBasicASCII,
      containsRTL,
      0,
      lineTokens,
      [],
      tabSize,
      0,
      fontInfo.spaceWidth,
      fontInfo.middotWidth,
      fontInfo.wsmiddotWidth,
      options.get(EditorOption.stopRenderingLineAfter),
      options.get(EditorOption.renderWhitespace),
      options.get(EditorOption.renderControlCharacters),
      options.get(EditorOption.fontLigatures) !== EditorFontLigatures.OFF,
      null
    ));
    return r.html;
  }
};
View = __decorateClass([
  __decorateParam(5, ILanguageService)
], View);
class AccessibleDiffViewerModelFromEditors {
  constructor(editors) {
    this.editors = editors;
  }
  getOriginalModel() {
    return this.editors.original.getModel();
  }
  getOriginalOptions() {
    return this.editors.original.getOptions();
  }
  originalReveal(range) {
    this.editors.original.revealRange(range);
    this.editors.original.setSelection(range);
    this.editors.original.focus();
  }
  getModifiedModel() {
    return this.editors.modified.getModel();
  }
  getModifiedOptions() {
    return this.editors.modified.getOptions();
  }
  modifiedReveal(range) {
    if (range) {
      this.editors.modified.revealRange(range);
      this.editors.modified.setSelection(range);
    }
    this.editors.modified.focus();
  }
  modifiedSetSelection(range) {
    this.editors.modified.setSelection(range);
  }
  modifiedFocus() {
    this.editors.modified.focus();
  }
  getModifiedPosition() {
    return this.editors.modified.getPosition() ?? void 0;
  }
}
export {
  AccessibleDiffViewer,
  AccessibleDiffViewerModelFromEditors
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy9lZGl0b3IvYnJvd3Nlci93aWRnZXQvZGlmZkVkaXRvci9jb21wb25lbnRzL2FjY2Vzc2libGVEaWZmVmlld2VyLnRzIl0sCiAgInNvdXJjZXNDb250ZW50IjogWyIvKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuICogIENvcHlyaWdodCAoYykgTWljcm9zb2Z0IENvcnBvcmF0aW9uLiBBbGwgcmlnaHRzIHJlc2VydmVkLlxuICogIExpY2Vuc2VkIHVuZGVyIHRoZSBNSVQgTGljZW5zZS4gU2VlIExpY2Vuc2UudHh0IGluIHRoZSBwcm9qZWN0IHJvb3QgZm9yIGxpY2Vuc2UgaW5mb3JtYXRpb24uXG4gKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tKi9cblxuaW1wb3J0IHsgYWRkRGlzcG9zYWJsZUxpc3RlbmVyLCBhZGRTdGFuZGFyZERpc3Bvc2FibGVMaXN0ZW5lciwgcmVzZXQgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9iYXNlL2Jyb3dzZXIvZG9tLmpzJztcbmltcG9ydCB7IGNyZWF0ZVRydXN0ZWRUeXBlc1BvbGljeSB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL2Jhc2UvYnJvd3Nlci90cnVzdGVkVHlwZXMuanMnO1xuaW1wb3J0IHsgQWN0aW9uQmFyIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vYmFzZS9icm93c2VyL3VpL2FjdGlvbmJhci9hY3Rpb25iYXIuanMnO1xuaW1wb3J0IHsgRG9tU2Nyb2xsYWJsZUVsZW1lbnQgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9iYXNlL2Jyb3dzZXIvdWkvc2Nyb2xsYmFyL3Njcm9sbGFibGVFbGVtZW50LmpzJztcbmltcG9ydCB7IGZvckVhY2hBZGphY2VudCwgZ3JvdXBBZGphY2VudEJ5IH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vYXJyYXlzLmpzJztcbmltcG9ydCB7IENvZGljb24gfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9jb2RpY29ucy5qcyc7XG5pbXBvcnQgeyBLZXlDb2RlLCBLZXlNb2QgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9rZXlDb2Rlcy5qcyc7XG5pbXBvcnQgeyBEaXNwb3NhYmxlLCBEaXNwb3NhYmxlU3RvcmUsIHRvRGlzcG9zYWJsZSB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2xpZmVjeWNsZS5qcyc7XG5pbXBvcnQgeyBJT2JzZXJ2YWJsZSwgSVRyYW5zYWN0aW9uLCBhdXRvcnVuLCBhdXRvcnVuV2l0aFN0b3JlLCBkZXJpdmVkLCBkZXJpdmVkV2l0aFN0b3JlLCBvYnNlcnZhYmxlVmFsdWUsIHN1YnRyYW5zYWN0aW9uLCB0cmFuc2FjdGlvbiB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL29ic2VydmFibGUuanMnO1xuaW1wb3J0IHsgVGhlbWVJY29uIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vdGhlbWFibGVzLmpzJztcbmltcG9ydCB7IGFwcGx5Rm9udEluZm8gfSBmcm9tICcuLi8uLi8uLi9jb25maWcvZG9tRm9udEluZm8uanMnO1xuaW1wb3J0IHsgYXBwbHlTdHlsZSB9IGZyb20gJy4uL3V0aWxzLmpzJztcbmltcG9ydCB7IEVkaXRvckZvbnRMaWdhdHVyZXMsIEVkaXRvck9wdGlvbiwgSUNvbXB1dGVkRWRpdG9yT3B0aW9ucyB9IGZyb20gJy4uLy4uLy4uLy4uL2NvbW1vbi9jb25maWcvZWRpdG9yT3B0aW9ucy5qcyc7XG5pbXBvcnQgeyBMaW5lUmFuZ2UgfSBmcm9tICcuLi8uLi8uLi8uLi9jb21tb24vY29yZS9saW5lUmFuZ2UuanMnO1xuaW1wb3J0IHsgT2Zmc2V0UmFuZ2UgfSBmcm9tICcuLi8uLi8uLi8uLi9jb21tb24vY29yZS9vZmZzZXRSYW5nZS5qcyc7XG5pbXBvcnQgeyBQb3NpdGlvbiB9IGZyb20gJy4uLy4uLy4uLy4uL2NvbW1vbi9jb3JlL3Bvc2l0aW9uLmpzJztcbmltcG9ydCB7IFJhbmdlIH0gZnJvbSAnLi4vLi4vLi4vLi4vY29tbW9uL2NvcmUvcmFuZ2UuanMnO1xuaW1wb3J0IHsgRGV0YWlsZWRMaW5lUmFuZ2VNYXBwaW5nLCBMaW5lUmFuZ2VNYXBwaW5nIH0gZnJvbSAnLi4vLi4vLi4vLi4vY29tbW9uL2RpZmYvcmFuZ2VNYXBwaW5nLmpzJztcbmltcG9ydCB7IElMYW5ndWFnZUlkQ29kZWMgfSBmcm9tICcuLi8uLi8uLi8uLi9jb21tb24vbGFuZ3VhZ2VzLmpzJztcbmltcG9ydCB7IElMYW5ndWFnZVNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi9jb21tb24vbGFuZ3VhZ2VzL2xhbmd1YWdlLmpzJztcbmltcG9ydCB7IElUZXh0TW9kZWwsIFRleHRNb2RlbFJlc29sdmVkT3B0aW9ucyB9IGZyb20gJy4uLy4uLy4uLy4uL2NvbW1vbi9tb2RlbC5qcyc7XG5pbXBvcnQgeyBMaW5lVG9rZW5zIH0gZnJvbSAnLi4vLi4vLi4vLi4vY29tbW9uL3Rva2Vucy9saW5lVG9rZW5zLmpzJztcbmltcG9ydCB7IFJlbmRlckxpbmVJbnB1dCwgcmVuZGVyVmlld0xpbmUyIH0gZnJvbSAnLi4vLi4vLi4vLi4vY29tbW9uL3ZpZXdMYXlvdXQvdmlld0xpbmVSZW5kZXJlci5qcyc7XG5pbXBvcnQgeyBWaWV3TGluZVJlbmRlcmluZ0RhdGEgfSBmcm9tICcuLi8uLi8uLi8uLi9jb21tb24vdmlld01vZGVsLmpzJztcbmltcG9ydCB7IGxvY2FsaXplIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vbmxzLmpzJztcbmltcG9ydCB7IEFjY2Vzc2liaWxpdHlTaWduYWwsIElBY2Nlc3NpYmlsaXR5U2lnbmFsU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL3BsYXRmb3JtL2FjY2Vzc2liaWxpdHlTaWduYWwvYnJvd3Nlci9hY2Nlc3NpYmlsaXR5U2lnbmFsU2VydmljZS5qcyc7XG5pbXBvcnQgeyBJSW5zdGFudGlhdGlvblNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9wbGF0Zm9ybS9pbnN0YW50aWF0aW9uL2NvbW1vbi9pbnN0YW50aWF0aW9uLmpzJztcbmltcG9ydCB7IHJlZ2lzdGVySWNvbiB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL3BsYXRmb3JtL3RoZW1lL2NvbW1vbi9pY29uUmVnaXN0cnkuanMnO1xuaW1wb3J0ICcuL2FjY2Vzc2libGVEaWZmVmlld2VyLmNzcyc7XG5pbXBvcnQgeyBEaWZmRWRpdG9yRWRpdG9ycyB9IGZyb20gJy4vZGlmZkVkaXRvckVkaXRvcnMuanMnO1xuaW1wb3J0IHsgdG9BY3Rpb24gfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9hY3Rpb25zLmpzJztcblxuY29uc3QgYWNjZXNzaWJsZURpZmZWaWV3ZXJJbnNlcnRJY29uID0gcmVnaXN0ZXJJY29uKCdkaWZmLXJldmlldy1pbnNlcnQnLCBDb2RpY29uLmFkZCwgbG9jYWxpemUoJ2FjY2Vzc2libGVEaWZmVmlld2VySW5zZXJ0SWNvbicsICdJY29uIGZvciBcXCdJbnNlcnRcXCcgaW4gYWNjZXNzaWJsZSBkaWZmIHZpZXdlci4nKSk7XG5jb25zdCBhY2Nlc3NpYmxlRGlmZlZpZXdlclJlbW92ZUljb24gPSByZWdpc3Rlckljb24oJ2RpZmYtcmV2aWV3LXJlbW92ZScsIENvZGljb24ucmVtb3ZlLCBsb2NhbGl6ZSgnYWNjZXNzaWJsZURpZmZWaWV3ZXJSZW1vdmVJY29uJywgJ0ljb24gZm9yIFxcJ1JlbW92ZVxcJyBpbiBhY2Nlc3NpYmxlIGRpZmYgdmlld2VyLicpKTtcbmNvbnN0IGFjY2Vzc2libGVEaWZmVmlld2VyQ2xvc2VJY29uID0gcmVnaXN0ZXJJY29uKCdkaWZmLXJldmlldy1jbG9zZScsIENvZGljb24uY2xvc2UsIGxvY2FsaXplKCdhY2Nlc3NpYmxlRGlmZlZpZXdlckNsb3NlSWNvbicsICdJY29uIGZvciBcXCdDbG9zZVxcJyBpbiBhY2Nlc3NpYmxlIGRpZmYgdmlld2VyLicpKTtcblxuZXhwb3J0IGludGVyZmFjZSBJQWNjZXNzaWJsZURpZmZWaWV3ZXJNb2RlbCB7XG5cdGdldE9yaWdpbmFsTW9kZWwoKTogSVRleHRNb2RlbDtcblx0Z2V0T3JpZ2luYWxPcHRpb25zKCk6IElDb21wdXRlZEVkaXRvck9wdGlvbnM7XG5cblx0LyoqXG5cdCAqIFNob3VsZCBkbzogYHNldFNlbGVjdGlvbmAsIGByZXZlYWxMaW5lYCBhbmQgYGZvY3VzYFxuXHQgKi9cblx0b3JpZ2luYWxSZXZlYWwocmFuZ2U6IFJhbmdlKTogdm9pZDtcblxuXHRnZXRNb2RpZmllZE1vZGVsKCk6IElUZXh0TW9kZWw7XG5cdGdldE1vZGlmaWVkT3B0aW9ucygpOiBJQ29tcHV0ZWRFZGl0b3JPcHRpb25zO1xuXHQvKipcblx0ICogU2hvdWxkIGRvOiBgc2V0U2VsZWN0aW9uYCwgYHJldmVhbExpbmVgIGFuZCBgZm9jdXNgXG5cdCAqL1xuXHRtb2RpZmllZFJldmVhbChyYW5nZT86IFJhbmdlKTogdm9pZDtcblx0bW9kaWZpZWRTZXRTZWxlY3Rpb24ocmFuZ2U6IFJhbmdlKTogdm9pZDtcblx0bW9kaWZpZWRGb2N1cygpOiB2b2lkO1xuXG5cdGdldE1vZGlmaWVkUG9zaXRpb24oKTogUG9zaXRpb24gfCB1bmRlZmluZWQ7XG59XG5cbmV4cG9ydCBjbGFzcyBBY2Nlc3NpYmxlRGlmZlZpZXdlciBleHRlbmRzIERpc3Bvc2FibGUge1xuXHRwdWJsaWMgc3RhdGljIF90dFBvbGljeSA9IGNyZWF0ZVRydXN0ZWRUeXBlc1BvbGljeSgnZGlmZlJldmlldycsIHsgY3JlYXRlSFRNTDogdmFsdWUgPT4gdmFsdWUgfSk7XG5cblx0Y29uc3RydWN0b3IoXG5cdFx0cHJpdmF0ZSByZWFkb25seSBfcGFyZW50Tm9kZTogSFRNTEVsZW1lbnQsXG5cdFx0cHJpdmF0ZSByZWFkb25seSBfdmlzaWJsZTogSU9ic2VydmFibGU8Ym9vbGVhbj4sXG5cdFx0cHJpdmF0ZSByZWFkb25seSBfc2V0VmlzaWJsZTogKHZpc2libGU6IGJvb2xlYW4sIHR4OiBJVHJhbnNhY3Rpb24gfCB1bmRlZmluZWQpID0+IHZvaWQsXG5cdFx0cHJpdmF0ZSByZWFkb25seSBfY2FuQ2xvc2U6IElPYnNlcnZhYmxlPGJvb2xlYW4+LFxuXHRcdHByaXZhdGUgcmVhZG9ubHkgX3dpZHRoOiBJT2JzZXJ2YWJsZTxudW1iZXI+LFxuXHRcdHByaXZhdGUgcmVhZG9ubHkgX2hlaWdodDogSU9ic2VydmFibGU8bnVtYmVyPixcblx0XHRwcml2YXRlIHJlYWRvbmx5IF9kaWZmczogSU9ic2VydmFibGU8RGV0YWlsZWRMaW5lUmFuZ2VNYXBwaW5nW10gfCB1bmRlZmluZWQ+LFxuXHRcdHByaXZhdGUgcmVhZG9ubHkgX21vZGVsczogSUFjY2Vzc2libGVEaWZmVmlld2VyTW9kZWwsXG5cdFx0QElJbnN0YW50aWF0aW9uU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IF9pbnN0YW50aWF0aW9uU2VydmljZTogSUluc3RhbnRpYXRpb25TZXJ2aWNlLFxuXHQpIHtcblx0XHRzdXBlcigpO1xuXHR9XG5cblx0cHJpdmF0ZSByZWFkb25seSBfc3RhdGUgPSBkZXJpdmVkV2l0aFN0b3JlKHRoaXMsIChyZWFkZXIsIHN0b3JlKSA9PiB7XG5cdFx0Y29uc3QgdmlzaWJsZSA9IHRoaXMuX3Zpc2libGUucmVhZChyZWFkZXIpO1xuXHRcdHRoaXMuX3BhcmVudE5vZGUuc3R5bGUudmlzaWJpbGl0eSA9IHZpc2libGUgPyAndmlzaWJsZScgOiAnaGlkZGVuJztcblx0XHRpZiAoIXZpc2libGUpIHtcblx0XHRcdHJldHVybiBudWxsO1xuXHRcdH1cblx0XHRjb25zdCBtb2RlbCA9IHN0b3JlLmFkZCh0aGlzLl9pbnN0YW50aWF0aW9uU2VydmljZS5jcmVhdGVJbnN0YW5jZShWaWV3TW9kZWwsIHRoaXMuX2RpZmZzLCB0aGlzLl9tb2RlbHMsIHRoaXMuX3NldFZpc2libGUsIHRoaXMuX2NhbkNsb3NlKSk7XG5cdFx0Y29uc3QgdmlldyA9IHN0b3JlLmFkZCh0aGlzLl9pbnN0YW50aWF0aW9uU2VydmljZS5jcmVhdGVJbnN0YW5jZShWaWV3LCB0aGlzLl9wYXJlbnROb2RlLCBtb2RlbCwgdGhpcy5fd2lkdGgsIHRoaXMuX2hlaWdodCwgdGhpcy5fbW9kZWxzKSk7XG5cdFx0cmV0dXJuIHsgbW9kZWwsIHZpZXcsIH07XG5cdH0pLnJlY29tcHV0ZUluaXRpYWxseUFuZE9uQ2hhbmdlKHRoaXMuX3N0b3JlKTtcblxuXHRuZXh0KCk6IHZvaWQge1xuXHRcdHRyYW5zYWN0aW9uKHR4ID0+IHtcblx0XHRcdGNvbnN0IGlzVmlzaWJsZSA9IHRoaXMuX3Zpc2libGUuZ2V0KCk7XG5cdFx0XHR0aGlzLl9zZXRWaXNpYmxlKHRydWUsIHR4KTtcblx0XHRcdGlmIChpc1Zpc2libGUpIHtcblx0XHRcdFx0dGhpcy5fc3RhdGUuZ2V0KCkhLm1vZGVsLm5leHRHcm91cCh0eCk7XG5cdFx0XHR9XG5cdFx0fSk7XG5cdH1cblxuXHRwcmV2KCk6IHZvaWQge1xuXHRcdHRyYW5zYWN0aW9uKHR4ID0+IHtcblx0XHRcdHRoaXMuX3NldFZpc2libGUodHJ1ZSwgdHgpO1xuXHRcdFx0dGhpcy5fc3RhdGUuZ2V0KCkhLm1vZGVsLnByZXZpb3VzR3JvdXAodHgpO1xuXHRcdH0pO1xuXHR9XG5cblx0Y2xvc2UoKTogdm9pZCB7XG5cdFx0dHJhbnNhY3Rpb24odHggPT4ge1xuXHRcdFx0dGhpcy5fc2V0VmlzaWJsZShmYWxzZSwgdHgpO1xuXHRcdH0pO1xuXHR9XG59XG5cbmNsYXNzIFZpZXdNb2RlbCBleHRlbmRzIERpc3Bvc2FibGUge1xuXHRwcml2YXRlIHJlYWRvbmx5IF9ncm91cHMgPSBvYnNlcnZhYmxlVmFsdWU8Vmlld0VsZW1lbnRHcm91cFtdPih0aGlzLCBbXSk7XG5cdHByaXZhdGUgcmVhZG9ubHkgX2N1cnJlbnRHcm91cElkeCA9IG9ic2VydmFibGVWYWx1ZSh0aGlzLCAwKTtcblx0cHJpdmF0ZSByZWFkb25seSBfY3VycmVudEVsZW1lbnRJZHggPSBvYnNlcnZhYmxlVmFsdWUodGhpcywgMCk7XG5cblx0cHVibGljIHJlYWRvbmx5IGdyb3VwczogSU9ic2VydmFibGU8Vmlld0VsZW1lbnRHcm91cFtdPiA9IHRoaXMuX2dyb3Vwcztcblx0cHVibGljIHJlYWRvbmx5IGN1cnJlbnRHcm91cDogSU9ic2VydmFibGU8Vmlld0VsZW1lbnRHcm91cCB8IHVuZGVmaW5lZD5cblx0XHQ9IHRoaXMuX2N1cnJlbnRHcm91cElkeC5tYXAoKGlkeCwgcikgPT4gdGhpcy5fZ3JvdXBzLnJlYWQocilbaWR4XSk7XG5cdHB1YmxpYyByZWFkb25seSBjdXJyZW50R3JvdXBJbmRleDogSU9ic2VydmFibGU8bnVtYmVyPiA9IHRoaXMuX2N1cnJlbnRHcm91cElkeDtcblxuXHRwdWJsaWMgcmVhZG9ubHkgY3VycmVudEVsZW1lbnQ6IElPYnNlcnZhYmxlPFZpZXdFbGVtZW50IHwgdW5kZWZpbmVkPlxuXHRcdD0gdGhpcy5fY3VycmVudEVsZW1lbnRJZHgubWFwKChpZHgsIHIpID0+IHRoaXMuY3VycmVudEdyb3VwLnJlYWQocik/LmxpbmVzW2lkeF0pO1xuXG5cdGNvbnN0cnVjdG9yKFxuXHRcdHByaXZhdGUgcmVhZG9ubHkgX2RpZmZzOiBJT2JzZXJ2YWJsZTxEZXRhaWxlZExpbmVSYW5nZU1hcHBpbmdbXSB8IHVuZGVmaW5lZD4sXG5cdFx0cHJpdmF0ZSByZWFkb25seSBfbW9kZWxzOiBJQWNjZXNzaWJsZURpZmZWaWV3ZXJNb2RlbCxcblx0XHRwcml2YXRlIHJlYWRvbmx5IF9zZXRWaXNpYmxlOiAodmlzaWJsZTogYm9vbGVhbiwgdHg6IElUcmFuc2FjdGlvbiB8IHVuZGVmaW5lZCkgPT4gdm9pZCxcblx0XHRwdWJsaWMgcmVhZG9ubHkgY2FuQ2xvc2U6IElPYnNlcnZhYmxlPGJvb2xlYW4+LFxuXHRcdEBJQWNjZXNzaWJpbGl0eVNpZ25hbFNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBfYWNjZXNzaWJpbGl0eVNpZ25hbFNlcnZpY2U6IElBY2Nlc3NpYmlsaXR5U2lnbmFsU2VydmljZSxcblx0KSB7XG5cdFx0c3VwZXIoKTtcblxuXHRcdHRoaXMuX3JlZ2lzdGVyKGF1dG9ydW4ocmVhZGVyID0+IHtcblx0XHRcdC8qKiBAZGVzY3JpcHRpb24gdXBkYXRlIGdyb3VwcyAqL1xuXHRcdFx0Y29uc3QgZGlmZnMgPSB0aGlzLl9kaWZmcy5yZWFkKHJlYWRlcik7XG5cdFx0XHRpZiAoIWRpZmZzKSB7XG5cdFx0XHRcdHRoaXMuX2dyb3Vwcy5zZXQoW10sIHVuZGVmaW5lZCk7XG5cdFx0XHRcdHJldHVybjtcblx0XHRcdH1cblxuXHRcdFx0Y29uc3QgZ3JvdXBzID0gY29tcHV0ZVZpZXdFbGVtZW50R3JvdXBzKFxuXHRcdFx0XHRkaWZmcyxcblx0XHRcdFx0dGhpcy5fbW9kZWxzLmdldE9yaWdpbmFsTW9kZWwoKS5nZXRMaW5lQ291bnQoKSxcblx0XHRcdFx0dGhpcy5fbW9kZWxzLmdldE1vZGlmaWVkTW9kZWwoKS5nZXRMaW5lQ291bnQoKVxuXHRcdFx0KTtcblxuXHRcdFx0dHJhbnNhY3Rpb24odHggPT4ge1xuXHRcdFx0XHRjb25zdCBwID0gdGhpcy5fbW9kZWxzLmdldE1vZGlmaWVkUG9zaXRpb24oKTtcblx0XHRcdFx0aWYgKHApIHtcblx0XHRcdFx0XHRjb25zdCBuZXh0R3JvdXAgPSBncm91cHMuZmluZEluZGV4KGcgPT4gcD8ubGluZU51bWJlciA8IGcucmFuZ2UubW9kaWZpZWQuZW5kTGluZU51bWJlckV4Y2x1c2l2ZSk7XG5cdFx0XHRcdFx0aWYgKG5leHRHcm91cCAhPT0gLTEpIHtcblx0XHRcdFx0XHRcdHRoaXMuX2N1cnJlbnRHcm91cElkeC5zZXQobmV4dEdyb3VwLCB0eCk7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9XG5cdFx0XHRcdHRoaXMuX2dyb3Vwcy5zZXQoZ3JvdXBzLCB0eCk7XG5cdFx0XHR9KTtcblx0XHR9KSk7XG5cblx0XHR0aGlzLl9yZWdpc3RlcihhdXRvcnVuKHJlYWRlciA9PiB7XG5cdFx0XHQvKiogQGRlc2NyaXB0aW9uIHBsYXkgYXVkaW8tY3VlIGZvciBkaWZmICovXG5cdFx0XHRjb25zdCBjdXJyZW50Vmlld0l0ZW0gPSB0aGlzLmN1cnJlbnRFbGVtZW50LnJlYWQocmVhZGVyKTtcblx0XHRcdGlmIChjdXJyZW50Vmlld0l0ZW0/LnR5cGUgPT09IExpbmVUeXBlLkRlbGV0ZWQpIHtcblx0XHRcdFx0dGhpcy5fYWNjZXNzaWJpbGl0eVNpZ25hbFNlcnZpY2UucGxheVNpZ25hbChBY2Nlc3NpYmlsaXR5U2lnbmFsLmRpZmZMaW5lRGVsZXRlZCwgeyBzb3VyY2U6ICdhY2Nlc3NpYmxlRGlmZlZpZXdlci5jdXJyZW50RWxlbWVudENoYW5nZWQnIH0pO1xuXHRcdFx0fSBlbHNlIGlmIChjdXJyZW50Vmlld0l0ZW0/LnR5cGUgPT09IExpbmVUeXBlLkFkZGVkKSB7XG5cdFx0XHRcdHRoaXMuX2FjY2Vzc2liaWxpdHlTaWduYWxTZXJ2aWNlLnBsYXlTaWduYWwoQWNjZXNzaWJpbGl0eVNpZ25hbC5kaWZmTGluZUluc2VydGVkLCB7IHNvdXJjZTogJ2FjY2Vzc2libGVEaWZmVmlld2VyLmN1cnJlbnRFbGVtZW50Q2hhbmdlZCcgfSk7XG5cdFx0XHR9XG5cdFx0fSkpO1xuXG5cdFx0dGhpcy5fcmVnaXN0ZXIoYXV0b3J1bihyZWFkZXIgPT4ge1xuXHRcdFx0LyoqIEBkZXNjcmlwdGlvbiBzZWxlY3QgbGluZXMgaW4gZWRpdG9yICovXG5cdFx0XHQvLyBUaGlzIGVuc3VyZXMgZWRpdG9yIGNvbW1hbmRzIChsaWtlIHJldmVydC9zdGFnZSkgd29ya1xuXHRcdFx0Y29uc3QgY3VycmVudFZpZXdJdGVtID0gdGhpcy5jdXJyZW50RWxlbWVudC5yZWFkKHJlYWRlcik7XG5cdFx0XHRpZiAoY3VycmVudFZpZXdJdGVtICYmIGN1cnJlbnRWaWV3SXRlbS50eXBlICE9PSBMaW5lVHlwZS5IZWFkZXIpIHtcblx0XHRcdFx0Y29uc3QgbGluZU51bWJlciA9IGN1cnJlbnRWaWV3SXRlbS5tb2RpZmllZExpbmVOdW1iZXIgPz8gY3VycmVudFZpZXdJdGVtLmRpZmYubW9kaWZpZWQuc3RhcnRMaW5lTnVtYmVyO1xuXHRcdFx0XHR0aGlzLl9tb2RlbHMubW9kaWZpZWRTZXRTZWxlY3Rpb24oUmFuZ2UuZnJvbVBvc2l0aW9ucyhuZXcgUG9zaXRpb24obGluZU51bWJlciwgMSkpKTtcblx0XHRcdH1cblx0XHR9KSk7XG5cdH1cblxuXHRwcml2YXRlIF9nb1RvR3JvdXBEZWx0YShkZWx0YTogbnVtYmVyLCB0eD86IElUcmFuc2FjdGlvbik6IHZvaWQge1xuXHRcdGNvbnN0IGdyb3VwcyA9IHRoaXMuZ3JvdXBzLmdldCgpO1xuXHRcdGlmICghZ3JvdXBzIHx8IGdyb3Vwcy5sZW5ndGggPD0gMSkgeyByZXR1cm47IH1cblx0XHRzdWJ0cmFuc2FjdGlvbih0eCwgdHggPT4ge1xuXHRcdFx0dGhpcy5fY3VycmVudEdyb3VwSWR4LnNldChPZmZzZXRSYW5nZS5vZkxlbmd0aChncm91cHMubGVuZ3RoKS5jbGlwQ3ljbGljKHRoaXMuX2N1cnJlbnRHcm91cElkeC5nZXQoKSArIGRlbHRhKSwgdHgpO1xuXHRcdFx0dGhpcy5fY3VycmVudEVsZW1lbnRJZHguc2V0KDAsIHR4KTtcblx0XHR9KTtcblx0fVxuXG5cdG5leHRHcm91cCh0eD86IElUcmFuc2FjdGlvbik6IHZvaWQgeyB0aGlzLl9nb1RvR3JvdXBEZWx0YSgxLCB0eCk7IH1cblx0cHJldmlvdXNHcm91cCh0eD86IElUcmFuc2FjdGlvbik6IHZvaWQgeyB0aGlzLl9nb1RvR3JvdXBEZWx0YSgtMSwgdHgpOyB9XG5cblx0cHJpdmF0ZSBfZ29Ub0xpbmVEZWx0YShkZWx0YTogbnVtYmVyKTogdm9pZCB7XG5cdFx0Y29uc3QgZ3JvdXAgPSB0aGlzLmN1cnJlbnRHcm91cC5nZXQoKTtcblx0XHRpZiAoIWdyb3VwIHx8IGdyb3VwLmxpbmVzLmxlbmd0aCA8PSAxKSB7IHJldHVybjsgfVxuXHRcdHRyYW5zYWN0aW9uKHR4ID0+IHtcblx0XHRcdHRoaXMuX2N1cnJlbnRFbGVtZW50SWR4LnNldChPZmZzZXRSYW5nZS5vZkxlbmd0aChncm91cC5saW5lcy5sZW5ndGgpLmNsaXAodGhpcy5fY3VycmVudEVsZW1lbnRJZHguZ2V0KCkgKyBkZWx0YSksIHR4KTtcblx0XHR9KTtcblx0fVxuXG5cdGdvVG9OZXh0TGluZSgpOiB2b2lkIHsgdGhpcy5fZ29Ub0xpbmVEZWx0YSgxKTsgfVxuXHRnb1RvUHJldmlvdXNMaW5lKCk6IHZvaWQgeyB0aGlzLl9nb1RvTGluZURlbHRhKC0xKTsgfVxuXG5cdGdvVG9MaW5lKGxpbmU6IFZpZXdFbGVtZW50KTogdm9pZCB7XG5cdFx0Y29uc3QgZ3JvdXAgPSB0aGlzLmN1cnJlbnRHcm91cC5nZXQoKTtcblx0XHRpZiAoIWdyb3VwKSB7IHJldHVybjsgfVxuXHRcdGNvbnN0IGlkeCA9IGdyb3VwLmxpbmVzLmluZGV4T2YobGluZSk7XG5cdFx0aWYgKGlkeCA9PT0gLTEpIHsgcmV0dXJuOyB9XG5cdFx0dHJhbnNhY3Rpb24odHggPT4ge1xuXHRcdFx0dGhpcy5fY3VycmVudEVsZW1lbnRJZHguc2V0KGlkeCwgdHgpO1xuXHRcdH0pO1xuXHR9XG5cblx0cmV2ZWFsQ3VycmVudEVsZW1lbnRJbkVkaXRvcigpOiB2b2lkIHtcblx0XHRpZiAoIXRoaXMuY2FuQ2xvc2UuZ2V0KCkpIHsgcmV0dXJuOyB9XG5cdFx0dGhpcy5fc2V0VmlzaWJsZShmYWxzZSwgdW5kZWZpbmVkKTtcblxuXHRcdGNvbnN0IGN1ckVsZW0gPSB0aGlzLmN1cnJlbnRFbGVtZW50LmdldCgpO1xuXHRcdGlmIChjdXJFbGVtKSB7XG5cdFx0XHRpZiAoY3VyRWxlbS50eXBlID09PSBMaW5lVHlwZS5EZWxldGVkKSB7XG5cdFx0XHRcdHRoaXMuX21vZGVscy5vcmlnaW5hbFJldmVhbChSYW5nZS5mcm9tUG9zaXRpb25zKG5ldyBQb3NpdGlvbihjdXJFbGVtLm9yaWdpbmFsTGluZU51bWJlciwgMSkpKTtcblx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdHRoaXMuX21vZGVscy5tb2RpZmllZFJldmVhbChcblx0XHRcdFx0XHRjdXJFbGVtLnR5cGUgIT09IExpbmVUeXBlLkhlYWRlclxuXHRcdFx0XHRcdFx0PyBSYW5nZS5mcm9tUG9zaXRpb25zKG5ldyBQb3NpdGlvbihjdXJFbGVtLm1vZGlmaWVkTGluZU51bWJlciwgMSkpXG5cdFx0XHRcdFx0XHQ6IHVuZGVmaW5lZFxuXHRcdFx0XHQpO1xuXHRcdFx0fVxuXHRcdH1cblx0fVxuXG5cdGNsb3NlKCk6IHZvaWQge1xuXHRcdGlmICghdGhpcy5jYW5DbG9zZS5nZXQoKSkgeyByZXR1cm47IH1cblx0XHR0aGlzLl9zZXRWaXNpYmxlKGZhbHNlLCB1bmRlZmluZWQpO1xuXHRcdHRoaXMuX21vZGVscy5tb2RpZmllZEZvY3VzKCk7XG5cdH1cbn1cblxuXG5jb25zdCB2aWV3RWxlbWVudEdyb3VwTGluZU1hcmdpbiA9IDM7XG5cbmZ1bmN0aW9uIGNvbXB1dGVWaWV3RWxlbWVudEdyb3VwcyhkaWZmczogRGV0YWlsZWRMaW5lUmFuZ2VNYXBwaW5nW10sIG9yaWdpbmFsTGluZUNvdW50OiBudW1iZXIsIG1vZGlmaWVkTGluZUNvdW50OiBudW1iZXIpOiBWaWV3RWxlbWVudEdyb3VwW10ge1xuXHRjb25zdCByZXN1bHQ6IFZpZXdFbGVtZW50R3JvdXBbXSA9IFtdO1xuXG5cdGZvciAoY29uc3QgZyBvZiBncm91cEFkamFjZW50QnkoZGlmZnMsIChhLCBiKSA9PiAoYi5tb2RpZmllZC5zdGFydExpbmVOdW1iZXIgLSBhLm1vZGlmaWVkLmVuZExpbmVOdW1iZXJFeGNsdXNpdmUgPCAyICogdmlld0VsZW1lbnRHcm91cExpbmVNYXJnaW4pKSkge1xuXHRcdGNvbnN0IHZpZXdFbGVtZW50czogVmlld0VsZW1lbnRbXSA9IFtdO1xuXHRcdHZpZXdFbGVtZW50cy5wdXNoKG5ldyBIZWFkZXJWaWV3RWxlbWVudCgpKTtcblxuXHRcdGNvbnN0IG9yaWdGdWxsUmFuZ2UgPSBuZXcgTGluZVJhbmdlKFxuXHRcdFx0TWF0aC5tYXgoMSwgZ1swXS5vcmlnaW5hbC5zdGFydExpbmVOdW1iZXIgLSB2aWV3RWxlbWVudEdyb3VwTGluZU1hcmdpbiksXG5cdFx0XHRNYXRoLm1pbihnW2cubGVuZ3RoIC0gMV0ub3JpZ2luYWwuZW5kTGluZU51bWJlckV4Y2x1c2l2ZSArIHZpZXdFbGVtZW50R3JvdXBMaW5lTWFyZ2luLCBvcmlnaW5hbExpbmVDb3VudCArIDEpXG5cdFx0KTtcblx0XHRjb25zdCBtb2RpZmllZEZ1bGxSYW5nZSA9IG5ldyBMaW5lUmFuZ2UoXG5cdFx0XHRNYXRoLm1heCgxLCBnWzBdLm1vZGlmaWVkLnN0YXJ0TGluZU51bWJlciAtIHZpZXdFbGVtZW50R3JvdXBMaW5lTWFyZ2luKSxcblx0XHRcdE1hdGgubWluKGdbZy5sZW5ndGggLSAxXS5tb2RpZmllZC5lbmRMaW5lTnVtYmVyRXhjbHVzaXZlICsgdmlld0VsZW1lbnRHcm91cExpbmVNYXJnaW4sIG1vZGlmaWVkTGluZUNvdW50ICsgMSlcblx0XHQpO1xuXG5cdFx0Zm9yRWFjaEFkamFjZW50KGcsIChhLCBiKSA9PiB7XG5cdFx0XHRjb25zdCBvcmlnUmFuZ2UgPSBuZXcgTGluZVJhbmdlKGEgPyBhLm9yaWdpbmFsLmVuZExpbmVOdW1iZXJFeGNsdXNpdmUgOiBvcmlnRnVsbFJhbmdlLnN0YXJ0TGluZU51bWJlciwgYiA/IGIub3JpZ2luYWwuc3RhcnRMaW5lTnVtYmVyIDogb3JpZ0Z1bGxSYW5nZS5lbmRMaW5lTnVtYmVyRXhjbHVzaXZlKTtcblx0XHRcdGNvbnN0IG1vZGlmaWVkUmFuZ2UgPSBuZXcgTGluZVJhbmdlKGEgPyBhLm1vZGlmaWVkLmVuZExpbmVOdW1iZXJFeGNsdXNpdmUgOiBtb2RpZmllZEZ1bGxSYW5nZS5zdGFydExpbmVOdW1iZXIsIGIgPyBiLm1vZGlmaWVkLnN0YXJ0TGluZU51bWJlciA6IG1vZGlmaWVkRnVsbFJhbmdlLmVuZExpbmVOdW1iZXJFeGNsdXNpdmUpO1xuXG5cdFx0XHRvcmlnUmFuZ2UuZm9yRWFjaChvcmlnTGluZU51bWJlciA9PiB7XG5cdFx0XHRcdHZpZXdFbGVtZW50cy5wdXNoKG5ldyBVbmNoYW5nZWRMaW5lVmlld0VsZW1lbnQob3JpZ0xpbmVOdW1iZXIsIG1vZGlmaWVkUmFuZ2Uuc3RhcnRMaW5lTnVtYmVyICsgKG9yaWdMaW5lTnVtYmVyIC0gb3JpZ1JhbmdlLnN0YXJ0TGluZU51bWJlcikpKTtcblx0XHRcdH0pO1xuXG5cdFx0XHRpZiAoYikge1xuXHRcdFx0XHRiLm9yaWdpbmFsLmZvckVhY2gob3JpZ0xpbmVOdW1iZXIgPT4ge1xuXHRcdFx0XHRcdHZpZXdFbGVtZW50cy5wdXNoKG5ldyBEZWxldGVkTGluZVZpZXdFbGVtZW50KGIsIG9yaWdMaW5lTnVtYmVyKSk7XG5cdFx0XHRcdH0pO1xuXHRcdFx0XHRiLm1vZGlmaWVkLmZvckVhY2gobW9kaWZpZWRMaW5lTnVtYmVyID0+IHtcblx0XHRcdFx0XHR2aWV3RWxlbWVudHMucHVzaChuZXcgQWRkZWRMaW5lVmlld0VsZW1lbnQoYiwgbW9kaWZpZWRMaW5lTnVtYmVyKSk7XG5cdFx0XHRcdH0pO1xuXHRcdFx0fVxuXHRcdH0pO1xuXG5cdFx0Y29uc3QgbW9kaWZpZWRSYW5nZSA9IGdbMF0ubW9kaWZpZWQuam9pbihnW2cubGVuZ3RoIC0gMV0ubW9kaWZpZWQpO1xuXHRcdGNvbnN0IG9yaWdpbmFsUmFuZ2UgPSBnWzBdLm9yaWdpbmFsLmpvaW4oZ1tnLmxlbmd0aCAtIDFdLm9yaWdpbmFsKTtcblxuXHRcdHJlc3VsdC5wdXNoKG5ldyBWaWV3RWxlbWVudEdyb3VwKG5ldyBMaW5lUmFuZ2VNYXBwaW5nKG1vZGlmaWVkUmFuZ2UsIG9yaWdpbmFsUmFuZ2UpLCB2aWV3RWxlbWVudHMpKTtcblx0fVxuXHRyZXR1cm4gcmVzdWx0O1xufVxuXG5lbnVtIExpbmVUeXBlIHtcblx0SGVhZGVyLFxuXHRVbmNoYW5nZWQsXG5cdERlbGV0ZWQsXG5cdEFkZGVkLFxufVxuXG5jbGFzcyBWaWV3RWxlbWVudEdyb3VwIHtcblx0Y29uc3RydWN0b3IoXG5cdFx0cHVibGljIHJlYWRvbmx5IHJhbmdlOiBMaW5lUmFuZ2VNYXBwaW5nLFxuXHRcdHB1YmxpYyByZWFkb25seSBsaW5lczogcmVhZG9ubHkgVmlld0VsZW1lbnRbXSxcblx0KSB7IH1cbn1cblxudHlwZSBWaWV3RWxlbWVudCA9IEhlYWRlclZpZXdFbGVtZW50IHwgVW5jaGFuZ2VkTGluZVZpZXdFbGVtZW50IHwgRGVsZXRlZExpbmVWaWV3RWxlbWVudCB8IEFkZGVkTGluZVZpZXdFbGVtZW50O1xuXG5jbGFzcyBIZWFkZXJWaWV3RWxlbWVudCB7XG5cdHB1YmxpYyByZWFkb25seSB0eXBlID0gTGluZVR5cGUuSGVhZGVyO1xufVxuXG5jbGFzcyBEZWxldGVkTGluZVZpZXdFbGVtZW50IHtcblx0cHVibGljIHJlYWRvbmx5IHR5cGUgPSBMaW5lVHlwZS5EZWxldGVkO1xuXG5cdHB1YmxpYyByZWFkb25seSBtb2RpZmllZExpbmVOdW1iZXIgPSB1bmRlZmluZWQ7XG5cblx0Y29uc3RydWN0b3IoXG5cdFx0cHVibGljIHJlYWRvbmx5IGRpZmY6IERldGFpbGVkTGluZVJhbmdlTWFwcGluZyxcblx0XHRwdWJsaWMgcmVhZG9ubHkgb3JpZ2luYWxMaW5lTnVtYmVyOiBudW1iZXIsXG5cdCkge1xuXHR9XG59XG5cbmNsYXNzIEFkZGVkTGluZVZpZXdFbGVtZW50IHtcblx0cHVibGljIHJlYWRvbmx5IHR5cGUgPSBMaW5lVHlwZS5BZGRlZDtcblxuXHRwdWJsaWMgcmVhZG9ubHkgb3JpZ2luYWxMaW5lTnVtYmVyID0gdW5kZWZpbmVkO1xuXG5cdGNvbnN0cnVjdG9yKFxuXHRcdHB1YmxpYyByZWFkb25seSBkaWZmOiBEZXRhaWxlZExpbmVSYW5nZU1hcHBpbmcsXG5cdFx0cHVibGljIHJlYWRvbmx5IG1vZGlmaWVkTGluZU51bWJlcjogbnVtYmVyLFxuXHQpIHtcblx0fVxufVxuXG5jbGFzcyBVbmNoYW5nZWRMaW5lVmlld0VsZW1lbnQge1xuXHRwdWJsaWMgcmVhZG9ubHkgdHlwZSA9IExpbmVUeXBlLlVuY2hhbmdlZDtcblx0Y29uc3RydWN0b3IoXG5cdFx0cHVibGljIHJlYWRvbmx5IG9yaWdpbmFsTGluZU51bWJlcjogbnVtYmVyLFxuXHRcdHB1YmxpYyByZWFkb25seSBtb2RpZmllZExpbmVOdW1iZXI6IG51bWJlcixcblx0KSB7XG5cdH1cbn1cblxuY2xhc3MgVmlldyBleHRlbmRzIERpc3Bvc2FibGUge1xuXHRwdWJsaWMgcmVhZG9ubHkgZG9tTm9kZTogSFRNTEVsZW1lbnQ7XG5cdHByaXZhdGUgcmVhZG9ubHkgX2NvbnRlbnQ6IEhUTUxFbGVtZW50O1xuXHRwcml2YXRlIHJlYWRvbmx5IF9zY3JvbGxiYXI6IERvbVNjcm9sbGFibGVFbGVtZW50O1xuXHRwcml2YXRlIHJlYWRvbmx5IF9hY3Rpb25CYXI6IEFjdGlvbkJhcjtcblxuXHRjb25zdHJ1Y3Rvcihcblx0XHRwcml2YXRlIHJlYWRvbmx5IF9lbGVtZW50OiBIVE1MRWxlbWVudCxcblx0XHRwcml2YXRlIHJlYWRvbmx5IF9tb2RlbDogVmlld01vZGVsLFxuXHRcdHByaXZhdGUgcmVhZG9ubHkgX3dpZHRoOiBJT2JzZXJ2YWJsZTxudW1iZXI+LFxuXHRcdHByaXZhdGUgcmVhZG9ubHkgX2hlaWdodDogSU9ic2VydmFibGU8bnVtYmVyPixcblx0XHRwcml2YXRlIHJlYWRvbmx5IF9tb2RlbHM6IElBY2Nlc3NpYmxlRGlmZlZpZXdlck1vZGVsLFxuXHRcdEBJTGFuZ3VhZ2VTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgX2xhbmd1YWdlU2VydmljZTogSUxhbmd1YWdlU2VydmljZSxcblx0KSB7XG5cdFx0c3VwZXIoKTtcblxuXHRcdHRoaXMuZG9tTm9kZSA9IHRoaXMuX2VsZW1lbnQ7XG5cdFx0dGhpcy5kb21Ob2RlLmNsYXNzTmFtZSA9ICdtb25hY28tY29tcG9uZW50IGRpZmYtcmV2aWV3IG1vbmFjby1lZGl0b3ItYmFja2dyb3VuZCc7XG5cblx0XHRjb25zdCBhY3Rpb25CYXJDb250YWluZXIgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdkaXYnKTtcblx0XHRhY3Rpb25CYXJDb250YWluZXIuY2xhc3NOYW1lID0gJ2RpZmYtcmV2aWV3LWFjdGlvbnMnO1xuXHRcdHRoaXMuX2FjdGlvbkJhciA9IHRoaXMuX3JlZ2lzdGVyKG5ldyBBY3Rpb25CYXIoXG5cdFx0XHRhY3Rpb25CYXJDb250YWluZXJcblx0XHQpKTtcblx0XHR0aGlzLl9yZWdpc3RlcihhdXRvcnVuKHJlYWRlciA9PiB7XG5cdFx0XHQvKiogQGRlc2NyaXB0aW9uIHVwZGF0ZSBhY3Rpb25zICovXG5cdFx0XHR0aGlzLl9hY3Rpb25CYXIuY2xlYXIoKTtcblx0XHRcdGlmICh0aGlzLl9tb2RlbC5jYW5DbG9zZS5yZWFkKHJlYWRlcikpIHtcblx0XHRcdFx0dGhpcy5fYWN0aW9uQmFyLnB1c2godG9BY3Rpb24oe1xuXHRcdFx0XHRcdGlkOiAnZGlmZnJldmlldy5jbG9zZScsXG5cdFx0XHRcdFx0bGFiZWw6IGxvY2FsaXplKCdsYWJlbC5jbG9zZScsIFwiQ2xvc2VcIiksXG5cdFx0XHRcdFx0Y2xhc3M6ICdjbG9zZS1kaWZmLXJldmlldyAnICsgVGhlbWVJY29uLmFzQ2xhc3NOYW1lKGFjY2Vzc2libGVEaWZmVmlld2VyQ2xvc2VJY29uKSxcblx0XHRcdFx0XHRlbmFibGVkOiB0cnVlLFxuXHRcdFx0XHRcdHJ1bjogYXN5bmMgKCkgPT4gX21vZGVsLmNsb3NlKClcblx0XHRcdFx0fSksIHsgbGFiZWw6IGZhbHNlLCBpY29uOiB0cnVlIH0pO1xuXHRcdFx0fVxuXHRcdH0pKTtcblxuXHRcdHRoaXMuX2NvbnRlbnQgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdkaXYnKTtcblx0XHR0aGlzLl9jb250ZW50LmNsYXNzTmFtZSA9ICdkaWZmLXJldmlldy1jb250ZW50Jztcblx0XHR0aGlzLl9jb250ZW50LnNldEF0dHJpYnV0ZSgncm9sZScsICdjb2RlJyk7XG5cdFx0dGhpcy5fc2Nyb2xsYmFyID0gdGhpcy5fcmVnaXN0ZXIobmV3IERvbVNjcm9sbGFibGVFbGVtZW50KHRoaXMuX2NvbnRlbnQsIHt9KSk7XG5cdFx0cmVzZXQodGhpcy5kb21Ob2RlLCB0aGlzLl9zY3JvbGxiYXIuZ2V0RG9tTm9kZSgpLCBhY3Rpb25CYXJDb250YWluZXIpO1xuXG5cdFx0dGhpcy5fcmVnaXN0ZXIoYXV0b3J1bihyID0+IHtcblx0XHRcdHRoaXMuX2hlaWdodC5yZWFkKHIpO1xuXHRcdFx0dGhpcy5fd2lkdGgucmVhZChyKTtcblx0XHRcdHRoaXMuX3Njcm9sbGJhci5zY2FuRG9tTm9kZSgpO1xuXHRcdH0pKTtcblxuXHRcdHRoaXMuX3JlZ2lzdGVyKHRvRGlzcG9zYWJsZSgoKSA9PiB7IHJlc2V0KHRoaXMuZG9tTm9kZSk7IH0pKTtcblxuXHRcdHRoaXMuX3JlZ2lzdGVyKGFwcGx5U3R5bGUodGhpcy5kb21Ob2RlLCB7IHdpZHRoOiB0aGlzLl93aWR0aCwgaGVpZ2h0OiB0aGlzLl9oZWlnaHQgfSkpO1xuXHRcdHRoaXMuX3JlZ2lzdGVyKGFwcGx5U3R5bGUodGhpcy5fY29udGVudCwgeyB3aWR0aDogdGhpcy5fd2lkdGgsIGhlaWdodDogdGhpcy5faGVpZ2h0IH0pKTtcblxuXHRcdHRoaXMuX3JlZ2lzdGVyKGF1dG9ydW5XaXRoU3RvcmUoKHJlYWRlciwgc3RvcmUpID0+IHtcblx0XHRcdC8qKiBAZGVzY3JpcHRpb24gcmVuZGVyICovXG5cdFx0XHR0aGlzLl9tb2RlbC5jdXJyZW50R3JvdXAucmVhZChyZWFkZXIpO1xuXHRcdFx0dGhpcy5fcmVuZGVyKHN0b3JlKTtcblx0XHR9KSk7XG5cblx0XHQvLyBUT0RPQGhlZGlldCB1c2UgY29tbWFuZHNcblx0XHR0aGlzLl9yZWdpc3RlcihhZGRTdGFuZGFyZERpc3Bvc2FibGVMaXN0ZW5lcih0aGlzLmRvbU5vZGUsICdrZXlkb3duJywgKGUpID0+IHtcblx0XHRcdGlmIChcblx0XHRcdFx0ZS5lcXVhbHMoS2V5Q29kZS5Eb3duQXJyb3cpXG5cdFx0XHRcdHx8IGUuZXF1YWxzKEtleU1vZC5DdHJsQ21kIHwgS2V5Q29kZS5Eb3duQXJyb3cpXG5cdFx0XHRcdHx8IGUuZXF1YWxzKEtleU1vZC5BbHQgfCBLZXlDb2RlLkRvd25BcnJvdylcblx0XHRcdCkge1xuXHRcdFx0XHRlLnByZXZlbnREZWZhdWx0KCk7XG5cdFx0XHRcdHRoaXMuX21vZGVsLmdvVG9OZXh0TGluZSgpO1xuXHRcdFx0fVxuXG5cdFx0XHRpZiAoXG5cdFx0XHRcdGUuZXF1YWxzKEtleUNvZGUuVXBBcnJvdylcblx0XHRcdFx0fHwgZS5lcXVhbHMoS2V5TW9kLkN0cmxDbWQgfCBLZXlDb2RlLlVwQXJyb3cpXG5cdFx0XHRcdHx8IGUuZXF1YWxzKEtleU1vZC5BbHQgfCBLZXlDb2RlLlVwQXJyb3cpXG5cdFx0XHQpIHtcblx0XHRcdFx0ZS5wcmV2ZW50RGVmYXVsdCgpO1xuXHRcdFx0XHR0aGlzLl9tb2RlbC5nb1RvUHJldmlvdXNMaW5lKCk7XG5cdFx0XHR9XG5cblx0XHRcdGlmIChcblx0XHRcdFx0ZS5lcXVhbHMoS2V5Q29kZS5Fc2NhcGUpXG5cdFx0XHRcdHx8IGUuZXF1YWxzKEtleU1vZC5DdHJsQ21kIHwgS2V5Q29kZS5Fc2NhcGUpXG5cdFx0XHRcdHx8IGUuZXF1YWxzKEtleU1vZC5BbHQgfCBLZXlDb2RlLkVzY2FwZSlcblx0XHRcdFx0fHwgZS5lcXVhbHMoS2V5TW9kLlNoaWZ0IHwgS2V5Q29kZS5Fc2NhcGUpXG5cdFx0XHQpIHtcblx0XHRcdFx0ZS5wcmV2ZW50RGVmYXVsdCgpO1xuXHRcdFx0XHR0aGlzLl9tb2RlbC5jbG9zZSgpO1xuXHRcdFx0fVxuXG5cdFx0XHRpZiAoXG5cdFx0XHRcdGUuZXF1YWxzKEtleUNvZGUuU3BhY2UpXG5cdFx0XHRcdHx8IGUuZXF1YWxzKEtleUNvZGUuRW50ZXIpXG5cdFx0XHQpIHtcblx0XHRcdFx0ZS5wcmV2ZW50RGVmYXVsdCgpO1xuXHRcdFx0XHR0aGlzLl9tb2RlbC5yZXZlYWxDdXJyZW50RWxlbWVudEluRWRpdG9yKCk7XG5cdFx0XHR9XG5cdFx0fSkpO1xuXHR9XG5cblx0cHJpdmF0ZSBfcmVuZGVyKHN0b3JlOiBEaXNwb3NhYmxlU3RvcmUpOiB2b2lkIHtcblx0XHRjb25zdCBvcmlnaW5hbE9wdGlvbnMgPSB0aGlzLl9tb2RlbHMuZ2V0T3JpZ2luYWxPcHRpb25zKCk7XG5cdFx0Y29uc3QgbW9kaWZpZWRPcHRpb25zID0gdGhpcy5fbW9kZWxzLmdldE1vZGlmaWVkT3B0aW9ucygpO1xuXG5cdFx0Y29uc3QgY29udGFpbmVyID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnZGl2Jyk7XG5cdFx0Y29udGFpbmVyLmNsYXNzTmFtZSA9ICdkaWZmLXJldmlldy10YWJsZSc7XG5cdFx0Y29udGFpbmVyLnNldEF0dHJpYnV0ZSgncm9sZScsICdsaXN0Jyk7XG5cdFx0Y29udGFpbmVyLnNldEF0dHJpYnV0ZSgnYXJpYS1sYWJlbCcsIGxvY2FsaXplKCdhcmlhTGFiZWwnLCAnQWNjZXNzaWJsZSBEaWZmIFZpZXdlci4gVXNlIGFycm93IHVwIGFuZCBkb3duIHRvIG5hdmlnYXRlLicpKTtcblx0XHRhcHBseUZvbnRJbmZvKGNvbnRhaW5lciwgbW9kaWZpZWRPcHRpb25zLmdldChFZGl0b3JPcHRpb24uZm9udEluZm8pKTtcblxuXHRcdHJlc2V0KHRoaXMuX2NvbnRlbnQsIGNvbnRhaW5lcik7XG5cblx0XHRjb25zdCBvcmlnaW5hbE1vZGVsID0gdGhpcy5fbW9kZWxzLmdldE9yaWdpbmFsTW9kZWwoKTtcblx0XHRjb25zdCBtb2RpZmllZE1vZGVsID0gdGhpcy5fbW9kZWxzLmdldE1vZGlmaWVkTW9kZWwoKTtcblx0XHRpZiAoIW9yaWdpbmFsTW9kZWwgfHwgIW1vZGlmaWVkTW9kZWwpIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cblx0XHRjb25zdCBvcmlnaW5hbE1vZGVsT3B0cyA9IG9yaWdpbmFsTW9kZWwuZ2V0T3B0aW9ucygpO1xuXHRcdGNvbnN0IG1vZGlmaWVkTW9kZWxPcHRzID0gbW9kaWZpZWRNb2RlbC5nZXRPcHRpb25zKCk7XG5cblx0XHRjb25zdCBsaW5lSGVpZ2h0ID0gbW9kaWZpZWRPcHRpb25zLmdldChFZGl0b3JPcHRpb24ubGluZUhlaWdodCk7XG5cdFx0Y29uc3QgZ3JvdXAgPSB0aGlzLl9tb2RlbC5jdXJyZW50R3JvdXAuZ2V0KCk7XG5cdFx0Zm9yIChjb25zdCB2aWV3SXRlbSBvZiBncm91cD8ubGluZXMgfHwgW10pIHtcblx0XHRcdGlmICghZ3JvdXApIHtcblx0XHRcdFx0YnJlYWs7XG5cdFx0XHR9XG5cdFx0XHRsZXQgcm93OiBIVE1MRGl2RWxlbWVudDtcblxuXHRcdFx0aWYgKHZpZXdJdGVtLnR5cGUgPT09IExpbmVUeXBlLkhlYWRlcikge1xuXG5cdFx0XHRcdGNvbnN0IGhlYWRlciA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2RpdicpO1xuXHRcdFx0XHRoZWFkZXIuY2xhc3NOYW1lID0gJ2RpZmYtcmV2aWV3LXJvdyc7XG5cdFx0XHRcdGhlYWRlci5zZXRBdHRyaWJ1dGUoJ3JvbGUnLCAnbGlzdGl0ZW0nKTtcblxuXHRcdFx0XHRjb25zdCByID0gZ3JvdXAucmFuZ2U7XG5cdFx0XHRcdGNvbnN0IGRpZmZJbmRleCA9IHRoaXMuX21vZGVsLmN1cnJlbnRHcm91cEluZGV4LmdldCgpO1xuXHRcdFx0XHRjb25zdCBkaWZmc0xlbmd0aCA9IHRoaXMuX21vZGVsLmdyb3Vwcy5nZXQoKS5sZW5ndGg7XG5cdFx0XHRcdGNvbnN0IGdldEFyaWFMaW5lcyA9IChsaW5lczogbnVtYmVyKSA9PlxuXHRcdFx0XHRcdGxpbmVzID09PSAwID8gbG9jYWxpemUoJ25vX2xpbmVzX2NoYW5nZWQnLCBcIm5vIGxpbmVzIGNoYW5nZWRcIilcblx0XHRcdFx0XHRcdDogbGluZXMgPT09IDEgPyBsb2NhbGl6ZSgnb25lX2xpbmVfY2hhbmdlZCcsIFwiMSBsaW5lIGNoYW5nZWRcIilcblx0XHRcdFx0XHRcdFx0OiBsb2NhbGl6ZSgnbW9yZV9saW5lc19jaGFuZ2VkJywgXCJ7MH0gbGluZXMgY2hhbmdlZFwiLCBsaW5lcyk7XG5cblx0XHRcdFx0Y29uc3Qgb3JpZ2luYWxDaGFuZ2VkTGluZXNDbnRBcmlhID0gZ2V0QXJpYUxpbmVzKHIub3JpZ2luYWwubGVuZ3RoKTtcblx0XHRcdFx0Y29uc3QgbW9kaWZpZWRDaGFuZ2VkTGluZXNDbnRBcmlhID0gZ2V0QXJpYUxpbmVzKHIubW9kaWZpZWQubGVuZ3RoKTtcblx0XHRcdFx0aGVhZGVyLnNldEF0dHJpYnV0ZSgnYXJpYS1sYWJlbCcsIGxvY2FsaXplKHtcblx0XHRcdFx0XHRrZXk6ICdoZWFkZXInLFxuXHRcdFx0XHRcdGNvbW1lbnQ6IFtcblx0XHRcdFx0XHRcdCdUaGlzIGlzIHRoZSBBUklBIGxhYmVsIGZvciBhIGdpdCBkaWZmIGhlYWRlci4nLFxuXHRcdFx0XHRcdFx0J0EgZ2l0IGRpZmYgaGVhZGVyIGxvb2tzIGxpa2UgdGhpczogQEAgLTE1NCwxMiArMTU5LDM5IEBALicsXG5cdFx0XHRcdFx0XHQnVGhhdCBlbmNvZGVzIHRoYXQgYXQgb3JpZ2luYWwgbGluZSAxNTQgKHdoaWNoIGlzIG5vdyBsaW5lIDE1OSksIDEyIGxpbmVzIHdlcmUgcmVtb3ZlZC9jaGFuZ2VkIHdpdGggMzkgbGluZXMuJyxcblx0XHRcdFx0XHRcdCdWYXJpYWJsZXMgMCBhbmQgMSByZWZlciB0byB0aGUgZGlmZiBpbmRleCBvdXQgb2YgdG90YWwgbnVtYmVyIG9mIGRpZmZzLicsXG5cdFx0XHRcdFx0XHQnVmFyaWFibGVzIDIgYW5kIDQgd2lsbCBiZSBudW1iZXJzIChhIGxpbmUgbnVtYmVyKS4nLFxuXHRcdFx0XHRcdFx0J1ZhcmlhYmxlcyAzIGFuZCA1IHdpbGwgYmUgXCJubyBsaW5lcyBjaGFuZ2VkXCIsIFwiMSBsaW5lIGNoYW5nZWRcIiBvciBcIlggbGluZXMgY2hhbmdlZFwiLCBsb2NhbGl6ZWQgc2VwYXJhdGVseS4nXG5cdFx0XHRcdFx0XVxuXHRcdFx0XHR9LCBcIkRpZmZlcmVuY2UgezB9IG9mIHsxfTogb3JpZ2luYWwgbGluZSB7Mn0sIHszfSwgbW9kaWZpZWQgbGluZSB7NH0sIHs1fVwiLFxuXHRcdFx0XHRcdChkaWZmSW5kZXggKyAxKSxcblx0XHRcdFx0XHRkaWZmc0xlbmd0aCxcblx0XHRcdFx0XHRyLm9yaWdpbmFsLnN0YXJ0TGluZU51bWJlcixcblx0XHRcdFx0XHRvcmlnaW5hbENoYW5nZWRMaW5lc0NudEFyaWEsXG5cdFx0XHRcdFx0ci5tb2RpZmllZC5zdGFydExpbmVOdW1iZXIsXG5cdFx0XHRcdFx0bW9kaWZpZWRDaGFuZ2VkTGluZXNDbnRBcmlhXG5cdFx0XHRcdCkpO1xuXG5cdFx0XHRcdGNvbnN0IGNlbGwgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdkaXYnKTtcblx0XHRcdFx0Y2VsbC5jbGFzc05hbWUgPSAnZGlmZi1yZXZpZXctY2VsbCBkaWZmLXJldmlldy1zdW1tYXJ5Jztcblx0XHRcdFx0Ly8gZS5nLjogYDEvMTA6IEBAIC01MDQsNyArNTE3LDcgQEBgXG5cdFx0XHRcdGNlbGwuYXBwZW5kQ2hpbGQoZG9jdW1lbnQuY3JlYXRlVGV4dE5vZGUoYCR7ZGlmZkluZGV4ICsgMX0vJHtkaWZmc0xlbmd0aH06IEBAIC0ke3Iub3JpZ2luYWwuc3RhcnRMaW5lTnVtYmVyfSwke3Iub3JpZ2luYWwubGVuZ3RofSArJHtyLm1vZGlmaWVkLnN0YXJ0TGluZU51bWJlcn0sJHtyLm1vZGlmaWVkLmxlbmd0aH0gQEBgKSk7XG5cdFx0XHRcdGhlYWRlci5hcHBlbmRDaGlsZChjZWxsKTtcblxuXHRcdFx0XHRyb3cgPSBoZWFkZXI7XG5cdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRyb3cgPSB0aGlzLl9jcmVhdGVSb3codmlld0l0ZW0sIGxpbmVIZWlnaHQsXG5cdFx0XHRcdFx0dGhpcy5fd2lkdGguZ2V0KCksIG9yaWdpbmFsT3B0aW9ucywgb3JpZ2luYWxNb2RlbCwgb3JpZ2luYWxNb2RlbE9wdHMsIG1vZGlmaWVkT3B0aW9ucywgbW9kaWZpZWRNb2RlbCwgbW9kaWZpZWRNb2RlbE9wdHMsXG5cdFx0XHRcdCk7XG5cdFx0XHR9XG5cblx0XHRcdGNvbnRhaW5lci5hcHBlbmRDaGlsZChyb3cpO1xuXG5cdFx0XHRjb25zdCBpc1NlbGVjdGVkT2JzID0gZGVyaXZlZChyZWFkZXIgPT4gLyoqIEBkZXNjcmlwdGlvbiBpc1NlbGVjdGVkICovIHRoaXMuX21vZGVsLmN1cnJlbnRFbGVtZW50LnJlYWQocmVhZGVyKSA9PT0gdmlld0l0ZW0pO1xuXG5cdFx0XHRzdG9yZS5hZGQoYXV0b3J1bihyZWFkZXIgPT4ge1xuXHRcdFx0XHQvKiogQGRlc2NyaXB0aW9uIHVwZGF0ZSB0YWIgaW5kZXggKi9cblx0XHRcdFx0Y29uc3QgaXNTZWxlY3RlZCA9IGlzU2VsZWN0ZWRPYnMucmVhZChyZWFkZXIpO1xuXHRcdFx0XHRyb3cudGFiSW5kZXggPSBpc1NlbGVjdGVkID8gMCA6IC0xO1xuXHRcdFx0XHRpZiAoaXNTZWxlY3RlZCkge1xuXHRcdFx0XHRcdHJvdy5mb2N1cygpO1xuXHRcdFx0XHR9XG5cdFx0XHR9KSk7XG5cblx0XHRcdHN0b3JlLmFkZChhZGREaXNwb3NhYmxlTGlzdGVuZXIocm93LCAnZm9jdXMnLCAoKSA9PiB7XG5cdFx0XHRcdHRoaXMuX21vZGVsLmdvVG9MaW5lKHZpZXdJdGVtKTtcblx0XHRcdH0pKTtcblx0XHR9XG5cblx0XHR0aGlzLl9zY3JvbGxiYXIuc2NhbkRvbU5vZGUoKTtcblx0fVxuXG5cdHByaXZhdGUgX2NyZWF0ZVJvdyhcblx0XHRpdGVtOiBEZWxldGVkTGluZVZpZXdFbGVtZW50IHwgQWRkZWRMaW5lVmlld0VsZW1lbnQgfCBVbmNoYW5nZWRMaW5lVmlld0VsZW1lbnQsXG5cdFx0bGluZUhlaWdodDogbnVtYmVyLFxuXHRcdHdpZHRoOiBudW1iZXIsXG5cdFx0b3JpZ2luYWxPcHRpb25zOiBJQ29tcHV0ZWRFZGl0b3JPcHRpb25zLCBvcmlnaW5hbE1vZGVsOiBJVGV4dE1vZGVsLCBvcmlnaW5hbE1vZGVsT3B0czogVGV4dE1vZGVsUmVzb2x2ZWRPcHRpb25zLFxuXHRcdG1vZGlmaWVkT3B0aW9uczogSUNvbXB1dGVkRWRpdG9yT3B0aW9ucywgbW9kaWZpZWRNb2RlbDogSVRleHRNb2RlbCwgbW9kaWZpZWRNb2RlbE9wdHM6IFRleHRNb2RlbFJlc29sdmVkT3B0aW9ucyxcblx0KTogSFRNTERpdkVsZW1lbnQge1xuXHRcdGNvbnN0IG9yaWdpbmFsTGF5b3V0SW5mbyA9IG9yaWdpbmFsT3B0aW9ucy5nZXQoRWRpdG9yT3B0aW9uLmxheW91dEluZm8pO1xuXHRcdGNvbnN0IG9yaWdpbmFsTGluZU51bWJlcnNXaWR0aCA9IG9yaWdpbmFsTGF5b3V0SW5mby5nbHlwaE1hcmdpbldpZHRoICsgb3JpZ2luYWxMYXlvdXRJbmZvLmxpbmVOdW1iZXJzV2lkdGg7XG5cblx0XHRjb25zdCBtb2RpZmllZExheW91dEluZm8gPSBtb2RpZmllZE9wdGlvbnMuZ2V0KEVkaXRvck9wdGlvbi5sYXlvdXRJbmZvKTtcblx0XHRjb25zdCBtb2RpZmllZExpbmVOdW1iZXJzV2lkdGggPSAxMCArIG1vZGlmaWVkTGF5b3V0SW5mby5nbHlwaE1hcmdpbldpZHRoICsgbW9kaWZpZWRMYXlvdXRJbmZvLmxpbmVOdW1iZXJzV2lkdGg7XG5cblx0XHRsZXQgcm93Q2xhc3NOYW1lOiBzdHJpbmcgPSAnZGlmZi1yZXZpZXctcm93Jztcblx0XHRsZXQgbGluZU51bWJlcnNFeHRyYUNsYXNzTmFtZTogc3RyaW5nID0gJyc7XG5cdFx0Y29uc3Qgc3BhY2VyQ2xhc3NOYW1lOiBzdHJpbmcgPSAnZGlmZi1yZXZpZXctc3BhY2VyJztcblx0XHRsZXQgc3BhY2VySWNvbjogVGhlbWVJY29uIHwgbnVsbCA9IG51bGw7XG5cdFx0c3dpdGNoIChpdGVtLnR5cGUpIHtcblx0XHRcdGNhc2UgTGluZVR5cGUuQWRkZWQ6XG5cdFx0XHRcdHJvd0NsYXNzTmFtZSA9ICdkaWZmLXJldmlldy1yb3cgbGluZS1pbnNlcnQnO1xuXHRcdFx0XHRsaW5lTnVtYmVyc0V4dHJhQ2xhc3NOYW1lID0gJyBjaGFyLWluc2VydCc7XG5cdFx0XHRcdHNwYWNlckljb24gPSBhY2Nlc3NpYmxlRGlmZlZpZXdlckluc2VydEljb247XG5cdFx0XHRcdGJyZWFrO1xuXHRcdFx0Y2FzZSBMaW5lVHlwZS5EZWxldGVkOlxuXHRcdFx0XHRyb3dDbGFzc05hbWUgPSAnZGlmZi1yZXZpZXctcm93IGxpbmUtZGVsZXRlJztcblx0XHRcdFx0bGluZU51bWJlcnNFeHRyYUNsYXNzTmFtZSA9ICcgY2hhci1kZWxldGUnO1xuXHRcdFx0XHRzcGFjZXJJY29uID0gYWNjZXNzaWJsZURpZmZWaWV3ZXJSZW1vdmVJY29uO1xuXHRcdFx0XHRicmVhaztcblx0XHR9XG5cblx0XHRjb25zdCByb3cgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdkaXYnKTtcblx0XHRyb3cuc3R5bGUubWluV2lkdGggPSB3aWR0aCArICdweCc7XG5cdFx0cm93LmNsYXNzTmFtZSA9IHJvd0NsYXNzTmFtZTtcblx0XHRyb3cuc2V0QXR0cmlidXRlKCdyb2xlJywgJ2xpc3RpdGVtJyk7XG5cdFx0cm93LmFyaWFMZXZlbCA9ICcnO1xuXG5cdFx0Y29uc3QgY2VsbCA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2RpdicpO1xuXHRcdGNlbGwuY2xhc3NOYW1lID0gJ2RpZmYtcmV2aWV3LWNlbGwnO1xuXHRcdGNlbGwuc3R5bGUuaGVpZ2h0ID0gYCR7bGluZUhlaWdodH1weGA7XG5cdFx0cm93LmFwcGVuZENoaWxkKGNlbGwpO1xuXG5cdFx0Y29uc3Qgb3JpZ2luYWxMaW5lTnVtYmVyID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnc3BhbicpO1xuXHRcdG9yaWdpbmFsTGluZU51bWJlci5zdHlsZS53aWR0aCA9IChvcmlnaW5hbExpbmVOdW1iZXJzV2lkdGggKyAncHgnKTtcblx0XHRvcmlnaW5hbExpbmVOdW1iZXIuc3R5bGUubWluV2lkdGggPSAob3JpZ2luYWxMaW5lTnVtYmVyc1dpZHRoICsgJ3B4Jyk7XG5cdFx0b3JpZ2luYWxMaW5lTnVtYmVyLmNsYXNzTmFtZSA9ICdkaWZmLXJldmlldy1saW5lLW51bWJlcicgKyBsaW5lTnVtYmVyc0V4dHJhQ2xhc3NOYW1lO1xuXHRcdGlmIChpdGVtLm9yaWdpbmFsTGluZU51bWJlciAhPT0gdW5kZWZpbmVkKSB7XG5cdFx0XHRvcmlnaW5hbExpbmVOdW1iZXIuYXBwZW5kQ2hpbGQoZG9jdW1lbnQuY3JlYXRlVGV4dE5vZGUoU3RyaW5nKGl0ZW0ub3JpZ2luYWxMaW5lTnVtYmVyKSkpO1xuXHRcdH0gZWxzZSB7XG5cdFx0XHRvcmlnaW5hbExpbmVOdW1iZXIuaW5uZXJUZXh0ID0gJ1xcdTAwYTAnO1xuXHRcdH1cblx0XHRjZWxsLmFwcGVuZENoaWxkKG9yaWdpbmFsTGluZU51bWJlcik7XG5cblx0XHRjb25zdCBtb2RpZmllZExpbmVOdW1iZXIgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdzcGFuJyk7XG5cdFx0bW9kaWZpZWRMaW5lTnVtYmVyLnN0eWxlLndpZHRoID0gKG1vZGlmaWVkTGluZU51bWJlcnNXaWR0aCArICdweCcpO1xuXHRcdG1vZGlmaWVkTGluZU51bWJlci5zdHlsZS5taW5XaWR0aCA9IChtb2RpZmllZExpbmVOdW1iZXJzV2lkdGggKyAncHgnKTtcblx0XHRtb2RpZmllZExpbmVOdW1iZXIuc3R5bGUucGFkZGluZ1JpZ2h0ID0gJzEwcHgnO1xuXHRcdG1vZGlmaWVkTGluZU51bWJlci5jbGFzc05hbWUgPSAnZGlmZi1yZXZpZXctbGluZS1udW1iZXInICsgbGluZU51bWJlcnNFeHRyYUNsYXNzTmFtZTtcblx0XHRpZiAoaXRlbS5tb2RpZmllZExpbmVOdW1iZXIgIT09IHVuZGVmaW5lZCkge1xuXHRcdFx0bW9kaWZpZWRMaW5lTnVtYmVyLmFwcGVuZENoaWxkKGRvY3VtZW50LmNyZWF0ZVRleHROb2RlKFN0cmluZyhpdGVtLm1vZGlmaWVkTGluZU51bWJlcikpKTtcblx0XHR9IGVsc2Uge1xuXHRcdFx0bW9kaWZpZWRMaW5lTnVtYmVyLmlubmVyVGV4dCA9ICdcXHUwMGEwJztcblx0XHR9XG5cdFx0Y2VsbC5hcHBlbmRDaGlsZChtb2RpZmllZExpbmVOdW1iZXIpO1xuXG5cdFx0Y29uc3Qgc3BhY2VyID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnc3BhbicpO1xuXHRcdHNwYWNlci5jbGFzc05hbWUgPSBzcGFjZXJDbGFzc05hbWU7XG5cblx0XHRpZiAoc3BhY2VySWNvbikge1xuXHRcdFx0Y29uc3Qgc3BhY2VyQ29kaWNvbiA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ3NwYW4nKTtcblx0XHRcdHNwYWNlckNvZGljb24uY2xhc3NOYW1lID0gVGhlbWVJY29uLmFzQ2xhc3NOYW1lKHNwYWNlckljb24pO1xuXHRcdFx0c3BhY2VyQ29kaWNvbi5pbm5lclRleHQgPSAnXFx1MDBhMFxcdTAwYTAnO1xuXHRcdFx0c3BhY2VyLmFwcGVuZENoaWxkKHNwYWNlckNvZGljb24pO1xuXHRcdH0gZWxzZSB7XG5cdFx0XHRzcGFjZXIuaW5uZXJUZXh0ID0gJ1xcdTAwYTBcXHUwMGEwJztcblx0XHR9XG5cdFx0Y2VsbC5hcHBlbmRDaGlsZChzcGFjZXIpO1xuXG5cdFx0bGV0IGxpbmVDb250ZW50OiBzdHJpbmc7XG5cdFx0aWYgKGl0ZW0ubW9kaWZpZWRMaW5lTnVtYmVyICE9PSB1bmRlZmluZWQpIHtcblx0XHRcdGxldCBodG1sOiBzdHJpbmcgfCBUcnVzdGVkSFRNTCA9IHRoaXMuX2dldExpbmVIdG1sKG1vZGlmaWVkTW9kZWwsIG1vZGlmaWVkT3B0aW9ucywgbW9kaWZpZWRNb2RlbE9wdHMudGFiU2l6ZSwgaXRlbS5tb2RpZmllZExpbmVOdW1iZXIsIHRoaXMuX2xhbmd1YWdlU2VydmljZS5sYW5ndWFnZUlkQ29kZWMpO1xuXHRcdFx0aWYgKEFjY2Vzc2libGVEaWZmVmlld2VyLl90dFBvbGljeSkge1xuXHRcdFx0XHRodG1sID0gQWNjZXNzaWJsZURpZmZWaWV3ZXIuX3R0UG9saWN5LmNyZWF0ZUhUTUwoaHRtbCBhcyBzdHJpbmcpO1xuXHRcdFx0fVxuXHRcdFx0Y2VsbC5pbnNlcnRBZGphY2VudEhUTUwoJ2JlZm9yZWVuZCcsIGh0bWwgYXMgc3RyaW5nKTtcblx0XHRcdGxpbmVDb250ZW50ID0gbW9kaWZpZWRNb2RlbC5nZXRMaW5lQ29udGVudChpdGVtLm1vZGlmaWVkTGluZU51bWJlcik7XG5cdFx0fSBlbHNlIHtcblx0XHRcdGxldCBodG1sOiBzdHJpbmcgfCBUcnVzdGVkSFRNTCA9IHRoaXMuX2dldExpbmVIdG1sKG9yaWdpbmFsTW9kZWwsIG9yaWdpbmFsT3B0aW9ucywgb3JpZ2luYWxNb2RlbE9wdHMudGFiU2l6ZSwgaXRlbS5vcmlnaW5hbExpbmVOdW1iZXIsIHRoaXMuX2xhbmd1YWdlU2VydmljZS5sYW5ndWFnZUlkQ29kZWMpO1xuXHRcdFx0aWYgKEFjY2Vzc2libGVEaWZmVmlld2VyLl90dFBvbGljeSkge1xuXHRcdFx0XHRodG1sID0gQWNjZXNzaWJsZURpZmZWaWV3ZXIuX3R0UG9saWN5LmNyZWF0ZUhUTUwoaHRtbCBhcyBzdHJpbmcpO1xuXHRcdFx0fVxuXHRcdFx0Y2VsbC5pbnNlcnRBZGphY2VudEhUTUwoJ2JlZm9yZWVuZCcsIGh0bWwgYXMgc3RyaW5nKTtcblx0XHRcdGxpbmVDb250ZW50ID0gb3JpZ2luYWxNb2RlbC5nZXRMaW5lQ29udGVudChpdGVtLm9yaWdpbmFsTGluZU51bWJlcik7XG5cdFx0fVxuXG5cdFx0aWYgKGxpbmVDb250ZW50Lmxlbmd0aCA9PT0gMCkge1xuXHRcdFx0bGluZUNvbnRlbnQgPSBsb2NhbGl6ZSgnYmxhbmtMaW5lJywgXCJibGFua1wiKTtcblx0XHR9XG5cblx0XHRsZXQgYXJpYUxhYmVsOiBzdHJpbmcgPSAnJztcblx0XHRzd2l0Y2ggKGl0ZW0udHlwZSkge1xuXHRcdFx0Y2FzZSBMaW5lVHlwZS5VbmNoYW5nZWQ6XG5cdFx0XHRcdGlmIChpdGVtLm9yaWdpbmFsTGluZU51bWJlciA9PT0gaXRlbS5tb2RpZmllZExpbmVOdW1iZXIpIHtcblx0XHRcdFx0XHRhcmlhTGFiZWwgPSBsb2NhbGl6ZSh7IGtleTogJ3VuY2hhbmdlZExpbmUnLCBjb21tZW50OiBbJ1RoZSBwbGFjZWhvbGRlcnMgYXJlIGNvbnRlbnRzIG9mIHRoZSBsaW5lIGFuZCBzaG91bGQgbm90IGJlIHRyYW5zbGF0ZWQuJ10gfSwgXCJ7MH0gdW5jaGFuZ2VkIGxpbmUgezF9XCIsIGxpbmVDb250ZW50LCBpdGVtLm9yaWdpbmFsTGluZU51bWJlcik7XG5cdFx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdFx0YXJpYUxhYmVsID0gbG9jYWxpemUoJ2VxdWFsTGluZScsIFwiezB9IG9yaWdpbmFsIGxpbmUgezF9IG1vZGlmaWVkIGxpbmUgezJ9XCIsIGxpbmVDb250ZW50LCBpdGVtLm9yaWdpbmFsTGluZU51bWJlciwgaXRlbS5tb2RpZmllZExpbmVOdW1iZXIpO1xuXHRcdFx0XHR9XG5cdFx0XHRcdGJyZWFrO1xuXHRcdFx0Y2FzZSBMaW5lVHlwZS5BZGRlZDpcblx0XHRcdFx0YXJpYUxhYmVsID0gbG9jYWxpemUoJ2luc2VydExpbmUnLCBcIisgezB9IG1vZGlmaWVkIGxpbmUgezF9XCIsIGxpbmVDb250ZW50LCBpdGVtLm1vZGlmaWVkTGluZU51bWJlcik7XG5cdFx0XHRcdGJyZWFrO1xuXHRcdFx0Y2FzZSBMaW5lVHlwZS5EZWxldGVkOlxuXHRcdFx0XHRhcmlhTGFiZWwgPSBsb2NhbGl6ZSgnZGVsZXRlTGluZScsIFwiLSB7MH0gb3JpZ2luYWwgbGluZSB7MX1cIiwgbGluZUNvbnRlbnQsIGl0ZW0ub3JpZ2luYWxMaW5lTnVtYmVyKTtcblx0XHRcdFx0YnJlYWs7XG5cdFx0fVxuXHRcdHJvdy5zZXRBdHRyaWJ1dGUoJ2FyaWEtbGFiZWwnLCBhcmlhTGFiZWwpO1xuXG5cdFx0cmV0dXJuIHJvdztcblx0fVxuXG5cdHByaXZhdGUgX2dldExpbmVIdG1sKG1vZGVsOiBJVGV4dE1vZGVsLCBvcHRpb25zOiBJQ29tcHV0ZWRFZGl0b3JPcHRpb25zLCB0YWJTaXplOiBudW1iZXIsIGxpbmVOdW1iZXI6IG51bWJlciwgbGFuZ3VhZ2VJZENvZGVjOiBJTGFuZ3VhZ2VJZENvZGVjKTogc3RyaW5nIHtcblx0XHRjb25zdCBsaW5lQ29udGVudCA9IG1vZGVsLmdldExpbmVDb250ZW50KGxpbmVOdW1iZXIpO1xuXHRcdGNvbnN0IGZvbnRJbmZvID0gb3B0aW9ucy5nZXQoRWRpdG9yT3B0aW9uLmZvbnRJbmZvKTtcblx0XHRjb25zdCBsaW5lVG9rZW5zID0gTGluZVRva2Vucy5jcmVhdGVFbXB0eShsaW5lQ29udGVudCwgbGFuZ3VhZ2VJZENvZGVjKTtcblx0XHRjb25zdCBpc0Jhc2ljQVNDSUkgPSBWaWV3TGluZVJlbmRlcmluZ0RhdGEuaXNCYXNpY0FTQ0lJKGxpbmVDb250ZW50LCBtb2RlbC5taWdodENvbnRhaW5Ob25CYXNpY0FTQ0lJKCkpO1xuXHRcdGNvbnN0IGNvbnRhaW5zUlRMID0gVmlld0xpbmVSZW5kZXJpbmdEYXRhLmNvbnRhaW5zUlRMKGxpbmVDb250ZW50LCBpc0Jhc2ljQVNDSUksIG1vZGVsLm1pZ2h0Q29udGFpblJUTCgpKTtcblx0XHRjb25zdCByID0gcmVuZGVyVmlld0xpbmUyKG5ldyBSZW5kZXJMaW5lSW5wdXQoXG5cdFx0XHQoZm9udEluZm8uaXNNb25vc3BhY2UgJiYgIW9wdGlvbnMuZ2V0KEVkaXRvck9wdGlvbi5kaXNhYmxlTW9ub3NwYWNlT3B0aW1pemF0aW9ucykpLFxuXHRcdFx0Zm9udEluZm8uY2FuVXNlSGFsZndpZHRoUmlnaHR3YXJkc0Fycm93LFxuXHRcdFx0bGluZUNvbnRlbnQsXG5cdFx0XHRmYWxzZSxcblx0XHRcdGlzQmFzaWNBU0NJSSxcblx0XHRcdGNvbnRhaW5zUlRMLFxuXHRcdFx0MCxcblx0XHRcdGxpbmVUb2tlbnMsXG5cdFx0XHRbXSxcblx0XHRcdHRhYlNpemUsXG5cdFx0XHQwLFxuXHRcdFx0Zm9udEluZm8uc3BhY2VXaWR0aCxcblx0XHRcdGZvbnRJbmZvLm1pZGRvdFdpZHRoLFxuXHRcdFx0Zm9udEluZm8ud3NtaWRkb3RXaWR0aCxcblx0XHRcdG9wdGlvbnMuZ2V0KEVkaXRvck9wdGlvbi5zdG9wUmVuZGVyaW5nTGluZUFmdGVyKSxcblx0XHRcdG9wdGlvbnMuZ2V0KEVkaXRvck9wdGlvbi5yZW5kZXJXaGl0ZXNwYWNlKSxcblx0XHRcdG9wdGlvbnMuZ2V0KEVkaXRvck9wdGlvbi5yZW5kZXJDb250cm9sQ2hhcmFjdGVycyksXG5cdFx0XHRvcHRpb25zLmdldChFZGl0b3JPcHRpb24uZm9udExpZ2F0dXJlcykgIT09IEVkaXRvckZvbnRMaWdhdHVyZXMuT0ZGLFxuXHRcdFx0bnVsbFxuXHRcdCkpO1xuXG5cdFx0cmV0dXJuIHIuaHRtbDtcblx0fVxufVxuXG5leHBvcnQgY2xhc3MgQWNjZXNzaWJsZURpZmZWaWV3ZXJNb2RlbEZyb21FZGl0b3JzIGltcGxlbWVudHMgSUFjY2Vzc2libGVEaWZmVmlld2VyTW9kZWwge1xuXHRjb25zdHJ1Y3Rvcihwcml2YXRlIHJlYWRvbmx5IGVkaXRvcnM6IERpZmZFZGl0b3JFZGl0b3JzKSB7IH1cblxuXHRnZXRPcmlnaW5hbE1vZGVsKCk6IElUZXh0TW9kZWwge1xuXHRcdHJldHVybiB0aGlzLmVkaXRvcnMub3JpZ2luYWwuZ2V0TW9kZWwoKSE7XG5cdH1cblxuXHRnZXRPcmlnaW5hbE9wdGlvbnMoKTogSUNvbXB1dGVkRWRpdG9yT3B0aW9ucyB7XG5cdFx0cmV0dXJuIHRoaXMuZWRpdG9ycy5vcmlnaW5hbC5nZXRPcHRpb25zKCk7XG5cdH1cblxuXHRvcmlnaW5hbFJldmVhbChyYW5nZTogUmFuZ2UpOiB2b2lkIHtcblx0XHR0aGlzLmVkaXRvcnMub3JpZ2luYWwucmV2ZWFsUmFuZ2UocmFuZ2UpO1xuXHRcdHRoaXMuZWRpdG9ycy5vcmlnaW5hbC5zZXRTZWxlY3Rpb24ocmFuZ2UpO1xuXHRcdHRoaXMuZWRpdG9ycy5vcmlnaW5hbC5mb2N1cygpO1xuXHR9XG5cblx0Z2V0TW9kaWZpZWRNb2RlbCgpOiBJVGV4dE1vZGVsIHtcblx0XHRyZXR1cm4gdGhpcy5lZGl0b3JzLm1vZGlmaWVkLmdldE1vZGVsKCkhO1xuXHR9XG5cblx0Z2V0TW9kaWZpZWRPcHRpb25zKCk6IElDb21wdXRlZEVkaXRvck9wdGlvbnMge1xuXHRcdHJldHVybiB0aGlzLmVkaXRvcnMubW9kaWZpZWQuZ2V0T3B0aW9ucygpO1xuXHR9XG5cblx0bW9kaWZpZWRSZXZlYWwocmFuZ2U/OiBSYW5nZSB8IHVuZGVmaW5lZCk6IHZvaWQge1xuXHRcdGlmIChyYW5nZSkge1xuXHRcdFx0dGhpcy5lZGl0b3JzLm1vZGlmaWVkLnJldmVhbFJhbmdlKHJhbmdlKTtcblx0XHRcdHRoaXMuZWRpdG9ycy5tb2RpZmllZC5zZXRTZWxlY3Rpb24ocmFuZ2UpO1xuXHRcdH1cblx0XHR0aGlzLmVkaXRvcnMubW9kaWZpZWQuZm9jdXMoKTtcblx0fVxuXG5cdG1vZGlmaWVkU2V0U2VsZWN0aW9uKHJhbmdlOiBSYW5nZSk6IHZvaWQge1xuXHRcdHRoaXMuZWRpdG9ycy5tb2RpZmllZC5zZXRTZWxlY3Rpb24ocmFuZ2UpO1xuXHR9XG5cblx0bW9kaWZpZWRGb2N1cygpOiB2b2lkIHtcblx0XHR0aGlzLmVkaXRvcnMubW9kaWZpZWQuZm9jdXMoKTtcblx0fVxuXG5cdGdldE1vZGlmaWVkUG9zaXRpb24oKTogUG9zaXRpb24gfCB1bmRlZmluZWQge1xuXHRcdHJldHVybiB0aGlzLmVkaXRvcnMubW9kaWZpZWQuZ2V0UG9zaXRpb24oKSA/PyB1bmRlZmluZWQ7XG5cdH1cbn1cbiJdLAogICJtYXBwaW5ncyI6ICI7Ozs7Ozs7Ozs7O0FBS0EsU0FBUyx1QkFBdUIsK0JBQStCLGFBQWE7QUFDNUUsU0FBUyxnQ0FBZ0M7QUFDekMsU0FBUyxpQkFBaUI7QUFDMUIsU0FBUyw0QkFBNEI7QUFDckMsU0FBUyxpQkFBaUIsdUJBQXVCO0FBQ2pELFNBQVMsZUFBZTtBQUN4QixTQUFTLFNBQVMsY0FBYztBQUNoQyxTQUFTLFlBQTZCLG9CQUFvQjtBQUMxRCxTQUFvQyxTQUFTLGtCQUFrQixTQUFTLGtCQUFrQixpQkFBaUIsZ0JBQWdCLG1CQUFtQjtBQUM5SSxTQUFTLGlCQUFpQjtBQUMxQixTQUFTLHFCQUFxQjtBQUM5QixTQUFTLGtCQUFrQjtBQUMzQixTQUFTLHFCQUFxQixvQkFBNEM7QUFDMUUsU0FBUyxpQkFBaUI7QUFDMUIsU0FBUyxtQkFBbUI7QUFDNUIsU0FBUyxnQkFBZ0I7QUFDekIsU0FBUyxhQUFhO0FBQ3RCLFNBQW1DLHdCQUF3QjtBQUUzRCxTQUFTLHdCQUF3QjtBQUVqQyxTQUFTLGtCQUFrQjtBQUMzQixTQUFTLGlCQUFpQix1QkFB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
