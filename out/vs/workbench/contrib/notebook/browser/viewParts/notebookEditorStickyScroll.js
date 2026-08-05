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
import * as DOM from "../../../../../base/browser/dom.js";
import { EventType as TouchEventType } from "../../../../../base/browser/touch.js";
import { CancellationToken } from "../../../../../base/common/cancellation.js";
import { StandardMouseEvent } from "../../../../../base/browser/mouseEvent.js";
import { Emitter } from "../../../../../base/common/event.js";
import { Disposable, DisposableStore } from "../../../../../base/common/lifecycle.js";
import { MenuId } from "../../../../../platform/actions/common/actions.js";
import { IContextMenuService } from "../../../../../platform/contextview/browser/contextView.js";
import { CellFoldingState } from "../notebookBrowser.js";
import { CellKind } from "../../common/notebookCommon.js";
import { Delayer } from "../../../../../base/common/async.js";
import { ThemeIcon } from "../../../../../base/common/themables.js";
import { foldingCollapsedIcon, foldingExpandedIcon } from "../../../../../editor/contrib/folding/browser/foldingDecorations.js";
import { FoldingController } from "../controller/foldingController.js";
import { IInstantiationService } from "../../../../../platform/instantiation/common/instantiation.js";
import { INotebookCellOutlineDataSourceFactory } from "../viewModel/notebookOutlineDataSourceFactory.js";
class NotebookStickyLine extends Disposable {
  constructor(element, foldingIcon, header, entry, notebookEditor) {
    super();
    this.element = element;
    this.foldingIcon = foldingIcon;
    this.header = header;
    this.entry = entry;
    this.notebookEditor = notebookEditor;
    this._register(DOM.addDisposableListener(this.header, DOM.EventType.CLICK || TouchEventType.Tap, () => {
      this.focusCell();
    }));
    this._register(DOM.addDisposableListener(this.foldingIcon.domNode, DOM.EventType.CLICK || TouchEventType.Tap, () => {
      if (this.entry.cell.cellKind === CellKind.Markup) {
        const currentFoldingState = this.entry.cell.foldingState;
        this.toggleFoldRange(currentFoldingState);
      }
    }));
  }
  toggleFoldRange(currentState) {
    const foldingController = this.notebookEditor.getContribution(FoldingController.id);
    const index = this.entry.index;
    const headerLevel = this.entry.level;
    const newFoldingState = currentState === CellFoldingState.Collapsed ? CellFoldingState.Expanded : CellFoldingState.Collapsed;
    foldingController.setFoldingStateDown(index, newFoldingState, headerLevel);
    this.focusCell();
  }
  focusCell() {
    this.notebookEditor.focusNotebookCell(this.entry.cell, "container");
    const cellScrollTop = this.notebookEditor.getAbsoluteTopOfElement(this.entry.cell);
    const parentCount = NotebookStickyLine.getParentCount(this.entry);
    this.notebookEditor.setScrollTop(cellScrollTop - (parentCount + 1.1) * 22);
  }
  static getParentCount(entry) {
    let count = 0;
    while (entry.parent) {
      count++;
      entry = entry.parent;
    }
    return count;
  }
}
class StickyFoldingIcon {
  constructor(isCollapsed, dimension) {
    this.isCollapsed = isCollapsed;
    this.dimension = dimension;
    this.domNode = document.createElement("div");
    this.domNode.style.width = `${dimension}px`;
    this.domNode.style.height = `${dimension}px`;
    this.domNode.className = ThemeIcon.asClassName(isCollapsed ? foldingCollapsedIcon : foldingExpandedIcon);
  }
  setVisible(visible) {
    this.domNode.style.cursor = visible ? "pointer" : "default";
    this.domNode.style.opacity = visible ? "1" : "0";
  }
}
let NotebookStickyScroll = class extends Disposable {
  constructor(domNode, notebookEditor, notebookCellList, layoutFn, _contextMenuService, instantiationService) {
    super();
    this.domNode = domNode;
    this.notebookEditor = notebookEditor;
    this.notebookCellList = notebookCellList;
    this.layoutFn = layoutFn;
    this._contextMenuService = _contextMenuService;
    this.instantiationService = instantiationService;
    this._disposables = new DisposableStore();
    this.currentStickyLines = /* @__PURE__ */ new Map();
    this._onDidChangeNotebookStickyScroll = this._register(new Emitter());
    this.onDidChangeNotebookStickyScroll = this._onDidChangeNotebookStickyScroll.event;
    this._layoutDisposableStore = this._register(new DisposableStore());
    if (this.notebookEditor.notebookOptions.getDisplayOptions().stickyScrollEnabled) {
      this.init().catch(console.error);
    }
    this._register(this.notebookEditor.notebookOptions.onDidChangeOptions((e) => {
      if (e.stickyScrollEnabled || e.stickyScrollMode) {
        this.updateConfig(e);
      }
    }));
    this._register(DOM.addDisposableListener(this.domNode, DOM.EventType.CONTEXT_MENU, async (event) => {
      this.onContextMenu(event);
    }));
  }
  getDomNode() {
    return this.domNode;
  }
  getCurrentStickyHeight() {
    let height = 0;
    this.currentStickyLines.forEach((value) => {
      if (value.rendered) {
        height += 22;
      }
    });
    return height;
  }
  setCurrentStickyLines(newStickyLines) {
    this.currentStickyLines = newStickyLines;
  }
  compareStickyLineMaps(mapA, mapB) {
    if (mapA.size !== mapB.size) {
      return false;
    }
    for (const [key, value] of mapA) {
      const otherValue = mapB.get(key);
      if (!otherValue || value.rendered !== otherValue.rendered) {
        return false;
      }
    }
    return true;
  }
  onContextMenu(e) {
    const event = new StandardMouseEvent(DOM.getWindow(this.domNode), e);
    const selectedElement = event.target.parentElement;
    const selectedOutlineEntry = Array.from(this.currentStickyLines.values()).find((entry) => entry.line.element.contains(selectedElement))?.line.entry;
    if (!selectedOutlineEntry) {
      return;
    }
    const args = {
      outlineEntry: selectedOutlineEntry,
      notebookEditor: this.notebookEditor
    };
    this._contextMenuService.showContextMenu({
      menuId: MenuId.NotebookStickyScrollContext,
      getAnchor: () => event,
      menuActionOptions: { shouldForwardArgs: true, arg: args }
    });
  }
  updateConfig(e) {
    if (e.stickyScrollEnabled) {
      if (this.notebookEditor.notebookOptions.getDisplayOptions().stickyScrollEnabled) {
        this.init().catch(console.error);
      } else {
        this._disposables.clear();
        this.notebookCellOutlineReference?.dispose();
        this.disposeCurrentStickyLines();
        DOM.clearNode(this.domNode);
        this.updateDisplay();
      }
    } else if (e.stickyScrollMode && this.notebookEditor.notebookOptions.getDisplayOptions().stickyScrollEnabled && this.notebookCellOutlineReference?.object) {
      this.updateContent(computeContent(this.notebookEditor, this.notebookCellList, this.notebookCellOutlineReference?.object?.entries, this.getCurrentStickyHeight()));
    }
  }
  async init() {
    const { object: notebookCellOutline } = this.notebookCellOutlineReference = this.instantiationService.invokeFunction((accessor) => accessor.get(INotebookCellOutlineDataSourceFactory).getOrCreate(this.notebookEditor));
    this._register(this.notebookCellOutlineReference);
    await notebookCellOutline.computeFullSymbols(CancellationToken.None);
    const computed = computeContent(this.notebookEditor, this.notebookCellList, notebookCellOutline.entries, this.getCurrentStickyHeight());
    this.updateContent(computed);
    this._disposables.add(notebookCellOutline.onDidChange(() => {
      const computed2 = computeContent(this.notebookEditor, this.notebookCellList, notebookCellOutline.entries, this.getCurrentStickyHeight());
      if (!this.compareStickyLineMaps(computed2, this.currentStickyLines)) {
        this.updateContent(computed2);
      } else {
        this.disposeStickyLineMap(computed2);
      }
    }));
    this._disposables.add(this.notebookEditor.onDidAttachViewModel(async () => {
      await notebookCellOutline.computeFullSymbols(CancellationToken.None);
      const computed2 = computeContent(this.notebookEditor, this.notebookCellList, notebookCellOutline.entries, this.getCurrentStickyHeight());
      this.updateContent(computed2);
    }));
    this._disposables.add(this.notebookEditor.onDidScroll(() => {
      const d = new Delayer(100);
      d.trigger(() => {
        d.dispose();
        const computed2 = computeContent(this.notebookEditor, this.notebookCellList, notebookCellOutline.entries, this.getCurrentStickyHeight());
        if (!this.compareStickyLineMaps(computed2, this.currentStickyLines)) {
          this.updateContent(computed2);
        } else {
          this.disposeStickyLineMap(computed2);
        }
      });
    }));
  }
  // Add helper method to dispose a map of sticky lines
  disposeStickyLineMap(map) {
    map.forEach((value) => {
      if (value.line) {
        value.line.dispose();
      }
    });
  }
  // take in an cell index, and get the corresponding outline entry
  static getVisibleOutlineEntry(visibleIndex, notebookOutlineEntries) {
    let left = 0;
    let right = notebookOutlineEntries.length - 1;
    while (left <= right) {
      const mid = Math.floor((left + right) / 2);
      if (notebookOutlineEntries[mid].index === visibleIndex) {
        const rootEntry = notebookOutlineEntries[mid];
        const flatList = [];
        rootEntry.asFlatList(flatList);
        return flatList.find((entry) => entry.index === visibleIndex);
      } else if (notebookOutlineEntries[mid].index < visibleIndex) {
        left = mid + 1;
      } else {
        right = mid - 1;
      }
    }
    if (right >= 0) {
      const rootEntry = notebookOutlineEntries[right];
      const flatList = [];
      rootEntry.asFlatList(flatList);
      return flatList.find((entry) => entry.index === visibleIndex);
    }
    return void 0;
  }
  updateContent(newMap) {
    DOM.clearNode(this.domNode);
    this.disposeCurrentStickyLines();
    this.renderStickyLines(newMap, this.domNode);
    const oldStickyHeight = this.getCurrentStickyHeight();
    this.setCurrentStickyLines(newMap);
    const sizeDelta = this.getCurrentStickyHeight() - oldStickyHeight;
    if (sizeDelta !== 0) {
      this._onDidChangeNotebookStickyScroll.fire(sizeDelta);
      const d = this._layoutDisposableStore.add(DOM.scheduleAtNextAnimationFrame(DOM.getWindow(this.getDomNode()), () => {
        this.layoutFn(sizeDelta);
        this.updateDisplay();
        this._layoutDisposableStore.delete(d);
      }));
    } else {
      this.updateDisplay();
    }
  }
  updateDisplay() {
    const hasSticky = this.getCurrentStickyHeight() > 0;
    if (!hasSticky) {
      this.domNode.style.display = "none";
    } else {
      this.domNode.style.display = "block";
    }
  }
  static computeStickyHeight(entry) {
    let height = 0;
    if (entry.cell.cellKind === CellKind.Markup && entry.level < 7) {
      height += 22;
    }
    while (entry.parent) {
      height += 22;
      entry = entry.parent;
    }
    return height;
  }
  static checkCollapsedStickyLines(entry, numLinesToRender, notebookEditor) {
    let currentEntry = entry;
    const newMap = /* @__PURE__ */ new Map();
    const elementsToRender = [];
    while (currentEntry) {
      if (currentEntry.level >= 7) {
        currentEntry = currentEntry.parent;
        continue;
      }
      const lineToRender = NotebookStickyScroll.createStickyElement(currentEntry, notebookEditor);
      newMap.set(currentEntry, { line: lineToRender, rendered: false });
      elementsToRender.unshift(lineToRender);
      currentEntry = currentEntry.parent;
    }
    for (let i = 0; i < elementsToRender.length; i++) {
      if (i >= numLinesToRender) {
        break;
      }
      newMap.set(elementsToRender[i].entry, { line: elementsToRender[i], rendered: true });
    }
    return newMap;
  }
  renderStickyLines(stickyMap, containerElement) {
    const reversedEntries = Array.from(stickyMap.entries()).reverse();
    for (const [, value] of reversedEntries) {
      if (!value.rendered) {
        continue;
      }
      containerElement.append(value.line.element);
    }
  }
  static createStickyElement(entry, notebookEditor) {
    const stickyElement = document.createElement("div");
    stickyElement.classList.add("notebook-sticky-scroll-element");
    const indentMode = notebookEditor.notebookOptions.getLayoutConfiguration().stickyScrollMode;
    if (indentMode === "indented") {
      stickyElement.style.paddingLeft = NotebookStickyLine.getParentCount(entry) * 10 + "px";
    }
    let isCollapsed = false;
    if (entry.cell.cellKind === CellKind.Markup) {
      isCollapsed = entry.cell.foldingState === CellFoldingState.Collapsed;
    }
    const stickyFoldingIcon = new StickyFoldingIcon(isCollapsed, 16);
    stickyFoldingIcon.domNode.classList.add("notebook-sticky-scroll-folding-icon");
    stickyFoldingIcon.setVisible(true);
    const stickyHeader = document.createElement("div");
    stickyHeader.classList.add("notebook-sticky-scroll-header");
    stickyHeader.innerText = entry.label;
    stickyElement.append(stickyFoldingIcon.domNode, stickyHeader);
    return new NotebookStickyLine(stickyElement, stickyFoldingIcon, stickyHeader, entry, notebookEditor);
  }
  disposeCurrentStickyLines() {
    this.currentStickyLines.forEach((value) => {
      value.line.dispose();
    });
  }
  dispose() {
    this._disposables.dispose();
    this.disposeCurrentStickyLines();
    this.notebookCellOutlineReference?.dispose();
    super.dispose();
  }
};
NotebookStickyScroll = __decorateClass([
  __decorateParam(4, IContextMenuService),
  __decorateParam(5, IInstantiationService)
], NotebookStickyScroll);
function computeContent(notebookEditor, notebookCellList, notebookOutlineEntries, renderedStickyHeight) {
  const editorScrollTop = notebookEditor.scrollTop - renderedStickyHeight;
  const visibleRange = notebookEditor.visibleRanges[0];
  if (!visibleRange) {
    return /* @__PURE__ */ new Map();
  }
  if (visibleRange.start === 0) {
    const firstCell = notebookEditor.cellAt(0);
    const firstCellEntry = NotebookStickyScroll.getVisibleOutlineEntry(0, notebookOutlineEntries);
    if (firstCell && firstCellEntry && firstCell.cellKind === CellKind.Markup && firstCellEntry.level < 7) {
      if (notebookEditor.scrollTop > 22) {
        const newMap2 = NotebookStickyScroll.checkCollapsedStickyLines(firstCellEntry, 100, notebookEditor);
        return newMap2;
      }
    }
  }
  let cell;
  let cellEntry;
  const startIndex = visibleRange.start - 1;
  for (let currentIndex = startIndex; currentIndex < visibleRange.end; currentIndex++) {
    cell = notebookEditor.cellAt(currentIndex);
    if (!cell) {
      return /* @__PURE__ */ new Map();
    }
    cellEntry = NotebookStickyScroll.getVisibleOutlineEntry(currentIndex, notebookOutlineEntries);
    if (!cellEntry) {
      continue;
    }
    const nextCell = notebookEditor.cellAt(currentIndex + 1);
    if (!nextCell) {
      const sectionBottom2 = notebookEditor.getLayoutInfo().scrollHeight;
      const linesToRender2 = Math.floor(sectionBottom2 / 22);
      const newMap2 = NotebookStickyScroll.checkCollapsedStickyLines(cellEntry, linesToRender2, notebookEditor);
      return newMap2;
    }
    const nextCellEntry = NotebookStickyScroll.getVisibleOutlineEntry(currentIndex + 1, notebookOutlineEntries);
    if (!nextCellEntry) {
      continue;
    }
    if (nextCell.cellKind === CellKind.Markup && nextCellEntry.level < 7) {
      const sectionBottom2 = notebookCellList.getCellViewScrollTop(nextCell);
      const currentSectionStickyHeight = NotebookStickyScroll.computeStickyHeight(cellEntry);
      const nextSectionStickyHeight = NotebookStickyScroll.computeStickyHeight(nextCellEntry);
      if (editorScrollTop + currentSectionStickyHeight < sectionBottom2) {
        const linesToRender2 = Math.floor((sectionBottom2 - editorScrollTop) / 22);
        const newMap2 = NotebookStickyScroll.checkCollapsedStickyLines(cellEntry, linesToRender2, notebookEditor);
        return newMap2;
      } else if (nextSectionStickyHeight >= currentSectionStickyHeight) {
        const newMap2 = NotebookStickyScroll.checkCollapsedStickyLines(nextCellEntry, 100, notebookEditor);
        return newMap2;
      } else if (nextSectionStickyHeight < currentSectionStickyHeight) {
        const availableSpace = sectionBottom2 - editorScrollTop;
        if (availableSpace >= nextSectionStickyHeight) {
          const linesToRender2 = Math.floor(availableSpace / 22);
          const newMap2 = NotebookStickyScroll.checkCollapsedStickyLines(cellEntry, linesToRender2, notebookEditor);
          return newMap2;
        } else {
          const newMap2 = NotebookStickyScroll.checkCollapsedStickyLines(nextCellEntry, 100, notebookEditor);
          return newMap2;
        }
      }
    }
  }
  const sectionBottom = notebookEditor.getLayoutInfo().scrollHeight;
  const linesToRender = Math.floor((sectionBottom - editorScrollTop) / 22);
  const newMap = NotebookStickyScroll.checkCollapsedStickyLines(cellEntry, linesToRender, notebookEditor);
  return newMap;
}
export {
  NotebookStickyLine,
  NotebookStickyScroll,
  computeContent
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvY29udHJpYi9ub3RlYm9vay9icm93c2VyL3ZpZXdQYXJ0cy9ub3RlYm9va0VkaXRvclN0aWNreVNjcm9sbC50cyJdLAogICJzb3VyY2VzQ29udGVudCI6IFsiLyotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cbiAqICBDb3B5cmlnaHQgKGMpIE1pY3Jvc29mdCBDb3Jwb3JhdGlvbi4gQWxsIHJpZ2h0cyByZXNlcnZlZC5cbiAqICBMaWNlbnNlZCB1bmRlciB0aGUgTUlUIExpY2Vuc2UuIFNlZSBMaWNlbnNlLnR4dCBpbiB0aGUgcHJvamVjdCByb290IGZvciBsaWNlbnNlIGluZm9ybWF0aW9uLlxuICotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLSovXG5cbmltcG9ydCAqIGFzIERPTSBmcm9tICcuLi8uLi8uLi8uLi8uLi9iYXNlL2Jyb3dzZXIvZG9tLmpzJztcbmltcG9ydCB7IEV2ZW50VHlwZSBhcyBUb3VjaEV2ZW50VHlwZSB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL2Jhc2UvYnJvd3Nlci90b3VjaC5qcyc7XG5pbXBvcnQgeyBDYW5jZWxsYXRpb25Ub2tlbiB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2NhbmNlbGxhdGlvbi5qcyc7XG5pbXBvcnQgeyBTdGFuZGFyZE1vdXNlRXZlbnQgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9iYXNlL2Jyb3dzZXIvbW91c2VFdmVudC5qcyc7XG5pbXBvcnQgeyBFbWl0dGVyLCBFdmVudCB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2V2ZW50LmpzJztcbmltcG9ydCB7IERpc3Bvc2FibGUsIERpc3Bvc2FibGVTdG9yZSwgdHlwZSBJUmVmZXJlbmNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vbGlmZWN5Y2xlLmpzJztcbmltcG9ydCB7IE1lbnVJZCB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL3BsYXRmb3JtL2FjdGlvbnMvY29tbW9uL2FjdGlvbnMuanMnO1xuaW1wb3J0IHsgSUNvbnRleHRNZW51U2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL3BsYXRmb3JtL2NvbnRleHR2aWV3L2Jyb3dzZXIvY29udGV4dFZpZXcuanMnO1xuaW1wb3J0IHsgQ2VsbEZvbGRpbmdTdGF0ZSwgSU5vdGVib29rRWRpdG9yIH0gZnJvbSAnLi4vbm90ZWJvb2tCcm93c2VyLmpzJztcbmltcG9ydCB7IElOb3RlYm9va0NlbGxMaXN0IH0gZnJvbSAnLi4vdmlldy9ub3RlYm9va1JlbmRlcmluZ0NvbW1vbi5qcyc7XG5pbXBvcnQgeyBPdXRsaW5lRW50cnkgfSBmcm9tICcuLi92aWV3TW9kZWwvT3V0bGluZUVudHJ5LmpzJztcbmltcG9ydCB7IE5vdGVib29rQ2VsbE91dGxpbmVEYXRhU291cmNlIH0gZnJvbSAnLi4vdmlld01vZGVsL25vdGVib29rT3V0bGluZURhdGFTb3VyY2UuanMnO1xuaW1wb3J0IHsgQ2VsbEtpbmQgfSBmcm9tICcuLi8uLi9jb21tb24vbm90ZWJvb2tDb21tb24uanMnO1xuaW1wb3J0IHsgRGVsYXllciB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2FzeW5jLmpzJztcbmltcG9ydCB7IFRoZW1lSWNvbiB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL3RoZW1hYmxlcy5qcyc7XG5pbXBvcnQgeyBmb2xkaW5nQ29sbGFwc2VkSWNvbiwgZm9sZGluZ0V4cGFuZGVkSWNvbiB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL2VkaXRvci9jb250cmliL2ZvbGRpbmcvYnJvd3Nlci9mb2xkaW5nRGVjb3JhdGlvbnMuanMnO1xuaW1wb3J0IHsgTWFya3VwQ2VsbFZpZXdNb2RlbCB9IGZyb20gJy4uL3ZpZXdNb2RlbC9tYXJrdXBDZWxsVmlld01vZGVsLmpzJztcbmltcG9ydCB7IEZvbGRpbmdDb250cm9sbGVyIH0gZnJvbSAnLi4vY29udHJvbGxlci9mb2xkaW5nQ29udHJvbGxlci5qcyc7XG5pbXBvcnQgeyBOb3RlYm9va09wdGlvbnNDaGFuZ2VFdmVudCB9IGZyb20gJy4uL25vdGVib29rT3B0aW9ucy5qcyc7XG5pbXBvcnQgeyBOb3RlYm9va091dGxpbmVFbnRyeUFyZ3MgfSBmcm9tICcuLi9jb250cm9sbGVyL3NlY3Rpb25BY3Rpb25zLmpzJztcbmltcG9ydCB7IElJbnN0YW50aWF0aW9uU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL3BsYXRmb3JtL2luc3RhbnRpYXRpb24vY29tbW9uL2luc3RhbnRpYXRpb24uanMnO1xuaW1wb3J0IHsgSU5vdGVib29rQ2VsbE91dGxpbmVEYXRhU291cmNlRmFjdG9yeSB9IGZyb20gJy4uL3ZpZXdNb2RlbC9ub3RlYm9va091dGxpbmVEYXRhU291cmNlRmFjdG9yeS5qcyc7XG5cbmV4cG9ydCBjbGFzcyBOb3RlYm9va1N0aWNreUxpbmUgZXh0ZW5kcyBEaXNwb3NhYmxlIHtcblx0Y29uc3RydWN0b3IoXG5cdFx0cHVibGljIHJlYWRvbmx5IGVsZW1lbnQ6IEhUTUxFbGVtZW50LFxuXHRcdHB1YmxpYyByZWFkb25seSBmb2xkaW5nSWNvbjogU3RpY2t5Rm9sZGluZ0ljb24sXG5cdFx0cHVibGljIHJlYWRvbmx5IGhlYWRlcjogSFRNTEVsZW1lbnQsXG5cdFx0cHVibGljIHJlYWRvbmx5IGVudHJ5OiBPdXRsaW5lRW50cnksXG5cdFx0cHVibGljIHJlYWRvbmx5IG5vdGVib29rRWRpdG9yOiBJTm90ZWJvb2tFZGl0b3IsXG5cdCkge1xuXHRcdHN1cGVyKCk7XG5cdFx0Ly8gY2xpY2sgdGhlIGhlYWRlciB0byBmb2N1cyB0aGUgY2VsbFxuXHRcdHRoaXMuX3JlZ2lzdGVyKERPTS5hZGREaXNwb3NhYmxlTGlzdGVuZXIodGhpcy5oZWFkZXIsIERPTS5FdmVudFR5cGUuQ0xJQ0sgfHwgVG91Y2hFdmVudFR5cGUuVGFwLCAoKSA9PiB7XG5cdFx0XHR0aGlzLmZvY3VzQ2VsbCgpO1xuXHRcdH0pKTtcblxuXHRcdC8vIGNsaWNrIHRoZSBmb2xkaW5nIGljb24gdG8gZm9sZCB0aGUgcmFuZ2UgY292ZXJlZCBieSB0aGUgaGVhZGVyXG5cdFx0dGhpcy5fcmVnaXN0ZXIoRE9NLmFkZERpc3Bvc2FibGVMaXN0ZW5lcih0aGlzLmZvbGRpbmdJY29uLmRvbU5vZGUsIERPTS5FdmVudFR5cGUuQ0xJQ0sgfHwgVG91Y2hFdmVudFR5cGUuVGFwLCAoKSA9PiB7XG5cdFx0XHRpZiAodGhpcy5lbnRyeS5jZWxsLmNlbGxLaW5kID09PSBDZWxsS2luZC5NYXJrdXApIHtcblx0XHRcdFx0Y29uc3QgY3VycmVudEZvbGRpbmdTdGF0ZSA9ICh0aGlzLmVudHJ5LmNlbGwgYXMgTWFya3VwQ2VsbFZpZXdNb2RlbCkuZm9sZGluZ1N0YXRlO1xuXHRcdFx0XHR0aGlzLnRvZ2dsZUZvbGRSYW5nZShjdXJyZW50Rm9sZGluZ1N0YXRlKTtcblx0XHRcdH1cblx0XHR9KSk7XG5cdH1cblxuXHRwcml2YXRlIHRvZ2dsZUZvbGRSYW5nZShjdXJyZW50U3RhdGU6IENlbGxGb2xkaW5nU3RhdGUpIHtcblx0XHRjb25zdCBmb2xkaW5nQ29udHJvbGxlciA9IHRoaXMubm90ZWJvb2tFZGl0b3IuZ2V0Q29udHJpYnV0aW9uPEZvbGRpbmdDb250cm9sbGVyPihGb2xkaW5nQ29udHJvbGxlci5pZCk7XG5cblx0XHRjb25zdCBpbmRleCA9IHRoaXMuZW50cnkuaW5kZXg7XG5cdFx0Y29uc3QgaGVhZGVyTGV2ZWwgPSB0aGlzLmVudHJ5LmxldmVsO1xuXHRcdGNvbnN0IG5ld0ZvbGRpbmdTdGF0ZSA9IChjdXJyZW50U3RhdGUgPT09IENlbGxGb2xkaW5nU3RhdGUuQ29sbGFwc2VkKSA/IENlbGxGb2xkaW5nU3RhdGUuRXhwYW5kZWQgOiBDZWxsRm9sZGluZ1N0YXRlLkNvbGxhcHNlZDtcblxuXHRcdGZvbGRpbmdDb250cm9sbGVyLnNldEZvbGRpbmdTdGF0ZURvd24oaW5kZXgsIG5ld0ZvbGRpbmdTdGF0ZSwgaGVhZGVyTGV2ZWwpO1xuXHRcdHRoaXMuZm9jdXNDZWxsKCk7XG5cdH1cblxuXHRwcml2YXRlIGZvY3VzQ2VsbCgpIHtcblx0XHR0aGlzLm5vdGVib29rRWRpdG9yLmZvY3VzTm90ZWJvb2tDZWxsKHRoaXMuZW50cnkuY2VsbCwgJ2NvbnRhaW5lcicpO1xuXHRcdGNvbnN0IGNlbGxTY3JvbGxUb3AgPSB0aGlzLm5vdGVib29rRWRpdG9yLmdldEFic29sdXRlVG9wT2ZFbGVtZW50KHRoaXMuZW50cnkuY2VsbCk7XG5cdFx0Y29uc3QgcGFyZW50Q291bnQgPSBOb3RlYm9va1N0aWNreUxpbmUuZ2V0UGFyZW50Q291bnQodGhpcy5lbnRyeSk7XG5cdFx0Ly8gMS4xIGFkZHJlc3NlcyB2aXNpYmxlIGNlbGwgcGFkZGluZywgdG8gbWFrZSBzdXJlIHdlIGRvbid0IGZvY3VzIG1kIGNlbGwgYW5kIGFsc28gcmVuZGVyIGl0cyBzdGlja3kgbGluZVxuXHRcdHRoaXMubm90ZWJvb2tFZGl0b3Iuc2V0U2Nyb2xsVG9wKGNlbGxTY3JvbGxUb3AgLSAocGFyZW50Q291bnQgKyAxLjEpICogMjIpO1xuXHR9XG5cblx0c3RhdGljIGdldFBhcmVudENvdW50KGVudHJ5OiBPdXRsaW5lRW50cnkpIHtcblx0XHRsZXQgY291bnQgPSAwO1xuXHRcdHdoaWxlIChlbnRyeS5wYXJlbnQpIHtcblx0XHRcdGNvdW50Kys7XG5cdFx0XHRlbnRyeSA9IGVudHJ5LnBhcmVudDtcblx0XHR9XG5cdFx0cmV0dXJuIGNvdW50O1xuXHR9XG59XG5cbmNsYXNzIFN0aWNreUZvbGRpbmdJY29uIHtcblxuXHRwdWJsaWMgZG9tTm9kZTogSFRNTEVsZW1lbnQ7XG5cblx0Y29uc3RydWN0b3IoXG5cdFx0cHVibGljIGlzQ29sbGFwc2VkOiBib29sZWFuLFxuXHRcdHB1YmxpYyBkaW1lbnNpb246IG51bWJlclxuXHQpIHtcblx0XHR0aGlzLmRvbU5vZGUgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdkaXYnKTtcblx0XHR0aGlzLmRvbU5vZGUuc3R5bGUud2lkdGggPSBgJHtkaW1lbnNpb259cHhgO1xuXHRcdHRoaXMuZG9tTm9kZS5zdHlsZS5oZWlnaHQgPSBgJHtkaW1lbnNpb259cHhgO1xuXHRcdHRoaXMuZG9tTm9kZS5jbGFzc05hbWUgPSBUaGVtZUljb24uYXNDbGFzc05hbWUoaXNDb2xsYXBzZWQgPyBmb2xkaW5nQ29sbGFwc2VkSWNvbiA6IGZvbGRpbmdFeHBhbmRlZEljb24pO1xuXHR9XG5cblx0cHVibGljIHNldFZpc2libGUodmlzaWJsZTogYm9vbGVhbikge1xuXHRcdHRoaXMuZG9tTm9kZS5zdHlsZS5jdXJzb3IgPSB2aXNpYmxlID8gJ3BvaW50ZXInIDogJ2RlZmF1bHQnO1xuXHRcdHRoaXMuZG9tTm9kZS5zdHlsZS5vcGFjaXR5ID0gdmlzaWJsZSA/ICcxJyA6ICcwJztcblx0fVxufVxuXG5leHBvcnQgY2xhc3MgTm90ZWJvb2tTdGlja3lTY3JvbGwgZXh0ZW5kcyBEaXNwb3NhYmxlIHtcblx0cHJpdmF0ZSByZWFkb25seSBfZGlzcG9zYWJsZXMgPSBuZXcgRGlzcG9zYWJsZVN0b3JlKCk7XG5cdHByaXZhdGUgY3VycmVudFN0aWNreUxpbmVzID0gbmV3IE1hcDxPdXRsaW5lRW50cnksIHsgbGluZTogTm90ZWJvb2tTdGlja3lMaW5lOyByZW5kZXJlZDogYm9vbGVhbiB9PigpO1xuXG5cdHByaXZhdGUgcmVhZG9ubHkgX29uRGlkQ2hhbmdlTm90ZWJvb2tTdGlja3lTY3JvbGwgPSB0aGlzLl9yZWdpc3RlcihuZXcgRW1pdHRlcjxudW1iZXI+KCkpO1xuXHRyZWFkb25seSBvbkRpZENoYW5nZU5vdGVib29rU3RpY2t5U2Nyb2xsOiBFdmVudDxudW1iZXI+ID0gdGhpcy5fb25EaWRDaGFuZ2VOb3RlYm9va1N0aWNreVNjcm9sbC5ldmVudDtcblx0cHJpdmF0ZSBub3RlYm9va0NlbGxPdXRsaW5lUmVmZXJlbmNlPzogSVJlZmVyZW5jZTxOb3RlYm9va0NlbGxPdXRsaW5lRGF0YVNvdXJjZT47XG5cblx0cHJpdmF0ZSByZWFkb25seSBfbGF5b3V0RGlzcG9zYWJsZVN0b3JlID0gdGhpcy5fcmVnaXN0ZXIobmV3IERpc3Bvc2FibGVTdG9yZSgpKTtcblxuXHRnZXREb21Ob2RlKCk6IEhUTUxFbGVtZW50IHtcblx0XHRyZXR1cm4gdGhpcy5kb21Ob2RlO1xuXHR9XG5cblx0Z2V0Q3VycmVudFN0aWNreUhlaWdodCgpIHtcblx0XHRsZXQgaGVpZ2h0ID0gMDtcblx0XHR0aGlzLmN1cnJlbnRTdGlja3lMaW5lcy5mb3JFYWNoKCh2YWx1ZSkgPT4ge1xuXHRcdFx0aWYgKHZhbHVlLnJlbmRlcmVkKSB7XG5cdFx0XHRcdGhlaWdodCArPSAyMjtcblx0XHRcdH1cblx0XHR9KTtcblx0XHRyZXR1cm4gaGVpZ2h0O1xuXHR9XG5cblx0cHJpdmF0ZSBzZXRDdXJyZW50U3RpY2t5TGluZXMobmV3U3RpY2t5TGluZXM6IE1hcDxPdXRsaW5lRW50cnksIHsgbGluZTogTm90ZWJvb2tTdGlja3lMaW5lOyByZW5kZXJlZDogYm9vbGVhbiB9Pikge1xuXHRcdHRoaXMuY3VycmVudFN0aWNreUxpbmVzID0gbmV3U3RpY2t5TGluZXM7XG5cdH1cblxuXHRwcml2YXRlIGNvbXBhcmVTdGlja3lMaW5lTWFwcyhtYXBBOiBNYXA8T3V0bGluZUVudHJ5LCB7IGxpbmU6IE5vdGVib29rU3RpY2t5TGluZTsgcmVuZGVyZWQ6IGJvb2xlYW4gfT4sIG1hcEI6IE1hcDxPdXRsaW5lRW50cnksIHsgbGluZTogTm90ZWJvb2tTdGlja3lMaW5lOyByZW5kZXJlZDogYm9vbGVhbiB9Pik6IGJvb2xlYW4ge1xuXHRcdGlmIChtYXBBLnNpemUgIT09IG1hcEIuc2l6ZSkge1xuXHRcdFx0cmV0dXJuIGZhbHNlO1xuXHRcdH1cblxuXHRcdGZvciAoY29uc3QgW2tleSwgdmFsdWVdIG9mIG1hcEEpIHtcblx0XHRcdGNvbnN0IG90aGVyVmFsdWUgPSBtYXBCLmdldChrZXkpO1xuXHRcdFx0aWYgKCFvdGhlclZhbHVlIHx8IHZhbHVlLnJlbmRlcmVkICE9PSBvdGhlclZhbHVlLnJlbmRlcmVkKSB7XG5cdFx0XHRcdHJldHVybiBmYWxzZTtcblx0XHRcdH1cblx0XHR9XG5cblx0XHRyZXR1cm4gdHJ1ZTtcblx0fVxuXG5cdGNvbnN0cnVjdG9yKFxuXHRcdHByaXZhdGUgcmVhZG9ubHkgZG9tTm9kZTogSFRNTEVsZW1lbnQsXG5cdFx0cHJpdmF0ZSByZWFkb25seSBub3RlYm9va0VkaXRvcjogSU5vdGVib29rRWRpdG9yLFxuXHRcdHByaXZhdGUgcmVhZG9ubHkgbm90ZWJvb2tDZWxsTGlzdDogSU5vdGVib29rQ2VsbExpc3QsXG5cdFx0cHJpdmF0ZSByZWFkb25seSBsYXlvdXRGbjogKGRlbHRhOiBudW1iZXIpID0+IHZvaWQsXG5cdFx0QElDb250ZXh0TWVudVNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBfY29udGV4dE1lbnVTZXJ2aWNlOiBJQ29udGV4dE1lbnVTZXJ2aWNlLFxuXHRcdEBJSW5zdGFudGlhdGlvblNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBpbnN0YW50aWF0aW9uU2VydmljZTogSUluc3RhbnRpYXRpb25TZXJ2aWNlXG5cdCkge1xuXHRcdHN1cGVyKCk7XG5cblx0XHRpZiAodGhpcy5ub3RlYm9va0VkaXRvci5ub3RlYm9va09wdGlvbnMuZ2V0RGlzcGxheU9wdGlvbnMoKS5zdGlja3lTY3JvbGxFbmFibGVkKSB7XG5cdFx0XHR0aGlzLmluaXQoKS5jYXRjaChjb25zb2xlLmVycm9yKTtcblx0XHR9XG5cblx0XHR0aGlzLl9yZWdpc3Rlcih0aGlzLm5vdGVib29rRWRpdG9yLm5vdGVib29rT3B0aW9ucy5vbkRpZENoYW5nZU9wdGlvbnMoKGUpID0+IHtcblx0XHRcdGlmIChlLnN0aWNreVNjcm9sbEVuYWJsZWQgfHwgZS5zdGlja3lTY3JvbGxNb2RlKSB7XG5cdFx0XHRcdHRoaXMudXBkYXRlQ29uZmlnKGUpO1xuXHRcdFx0fVxuXHRcdH0pKTtcblxuXHRcdHRoaXMuX3JlZ2lzdGVyKERPTS5hZGREaXNwb3NhYmxlTGlzdGVuZXIodGhpcy5kb21Ob2RlLCBET00uRXZlbnRUeXBlLkNPTlRFWFRfTUVOVSwgYXN5bmMgKGV2ZW50OiBNb3VzZUV2ZW50KSA9PiB7XG5cdFx0XHR0aGlzLm9uQ29udGV4dE1lbnUoZXZlbnQpO1xuXHRcdH0pKTtcblx0fVxuXG5cdHByaXZhdGUgb25Db250ZXh0TWVudShlOiBNb3VzZUV2ZW50KSB7XG5cdFx0Y29uc3QgZXZlbnQgPSBuZXcgU3RhbmRhcmRNb3VzZUV2ZW50KERPTS5nZXRXaW5kb3codGhpcy5kb21Ob2RlKSwgZSk7XG5cblx0XHRjb25zdCBzZWxlY3RlZEVsZW1lbnQgPSBldmVudC50YXJnZXQucGFyZW50RWxlbWVudDtcblx0XHRjb25zdCBzZWxlY3RlZE91dGxpbmVFbnRyeSA9IEFycmF5LmZyb20odGhpcy5jdXJyZW50U3RpY2t5TGluZXMudmFsdWVzKCkpLmZpbmQoZW50cnkgPT4gZW50cnkubGluZS5lbGVtZW50LmNvbnRhaW5zKHNlbGVjdGVkRWxlbWVudCkpPy5saW5lLmVudHJ5O1xuXHRcdGlmICghc2VsZWN0ZWRPdXRsaW5lRW50cnkpIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cblx0XHRjb25zdCBhcmdzOiBOb3RlYm9va091dGxpbmVFbnRyeUFyZ3MgPSB7XG5cdFx0XHRvdXRsaW5lRW50cnk6IHNlbGVjdGVkT3V0bGluZUVudHJ5LFxuXHRcdFx0bm90ZWJvb2tFZGl0b3I6IHRoaXMubm90ZWJvb2tFZGl0b3IsXG5cdFx0fTtcblxuXHRcdHRoaXMuX2NvbnRleHRNZW51U2VydmljZS5zaG93Q29udGV4dE1lbnUoe1xuXHRcdFx0bWVudUlkOiBNZW51SWQuTm90ZWJvb2tTdGlja3lTY3JvbGxDb250ZXh0LFxuXHRcdFx0Z2V0QW5jaG9yOiAoKSA9PiBldmVudCxcblx0XHRcdG1lbnVBY3Rpb25PcHRpb25zOiB7IHNob3VsZEZvcndhcmRBcmdzOiB0cnVlLCBhcmc6IGFyZ3MgfSxcblx0XHR9KTtcblx0fVxuXG5cdHByaXZhdGUgdXBkYXRlQ29uZmlnKGU6IE5vdGVib29rT3B0aW9uc0NoYW5nZUV2ZW50KSB7XG5cdFx0aWYgKGUuc3RpY2t5U2Nyb2xsRW5hYmxlZCkge1xuXHRcdFx0aWYgKHRoaXMubm90ZWJvb2tFZGl0b3Iubm90ZWJvb2tPcHRpb25zLmdldERpc3BsYXlPcHRpb25zKCkuc3RpY2t5U2Nyb2xsRW5hYmxlZCkge1xuXHRcdFx0XHR0aGlzLmluaXQoKS5jYXRjaChjb25zb2xlLmVycm9yKTtcblx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdHRoaXMuX2Rpc3Bvc2FibGVzLmNsZWFyKCk7XG5cdFx0XHRcdHRoaXMubm90ZWJvb2tDZWxsT3V0bGluZVJlZmVyZW5jZT8uZGlzcG9zZSgpO1xuXHRcdFx0XHR0aGlzLmRpc3Bvc2VDdXJyZW50U3RpY2t5TGluZXMoKTtcblx0XHRcdFx0RE9NLmNsZWFyTm9kZSh0aGlzLmRvbU5vZGUpO1xuXHRcdFx0XHR0aGlzLnVwZGF0ZURpc3BsYXkoKTtcblx0XHRcdH1cblx0XHR9IGVsc2UgaWYgKGUuc3RpY2t5U2Nyb2xsTW9kZSAmJiB0aGlzLm5vdGVib29rRWRpdG9yLm5vdGVib29rT3B0aW9ucy5nZXREaXNwbGF5T3B0aW9ucygpLnN0aWNreVNjcm9sbEVuYWJsZWQgJiYgdGhpcy5ub3RlYm9va0NlbGxPdXRsaW5lUmVmZXJlbmNlPy5vYmplY3QpIHtcblx0XHRcdHRoaXMudXBkYXRlQ29udGVudChjb21wdXRlQ29udGVudCh0aGlzLm5vdGVib29rRWRpdG9yLCB0aGlzLm5vdGVib29rQ2VsbExpc3QsIHRoaXMubm90ZWJvb2tDZWxsT3V0bGluZVJlZmVyZW5jZT8ub2JqZWN0Py5lbnRyaWVzLCB0aGlzLmdldEN1cnJlbnRTdGlja3lIZWlnaHQoKSkpO1xuXHRcdH1cblx0fVxuXG5cdHByaXZhdGUgYXN5bmMgaW5pdCgpIHtcblx0XHRjb25zdCB7IG9iamVjdDogbm90ZWJvb2tDZWxsT3V0bGluZSB9ID0gdGhpcy5ub3RlYm9va0NlbGxPdXRsaW5lUmVmZXJlbmNlID0gdGhpcy5pbnN0YW50aWF0aW9uU2VydmljZS5pbnZva2VGdW5jdGlvbigoYWNjZXNzb3IpID0+IGFjY2Vzc29yLmdldChJTm90ZWJvb2tDZWxsT3V0bGluZURhdGFTb3VyY2VGYWN0b3J5KS5nZXRPckNyZWF0ZSh0aGlzLm5vdGVib29rRWRpdG9yKSk7XG5cdFx0dGhpcy5fcmVnaXN0ZXIodGhpcy5ub3RlYm9va0NlbGxPdXRsaW5lUmVmZXJlbmNlKTtcblxuXHRcdC8vIEVuc3VyZSBzeW1ib2xzIGFyZSBjb21wdXRlZCBmaXJzdFxuXHRcdGF3YWl0IG5vdGVib29rQ2VsbE91dGxpbmUuY29tcHV0ZUZ1bGxTeW1ib2xzKENhbmNlbGxhdGlvblRva2VuLk5vbmUpO1xuXG5cdFx0Ly8gSW5pdGlhbCBjb250ZW50IHVwZGF0ZVxuXHRcdGNvbnN0IGNvbXB1dGVkID0gY29tcHV0ZUNvbnRlbnQodGhpcy5ub3RlYm9va0VkaXRvciwgdGhpcy5ub3RlYm9va0NlbGxMaXN0LCBub3RlYm9va0NlbGxPdXRsaW5lLmVudHJpZXMsIHRoaXMuZ2V0Q3VycmVudFN0aWNreUhlaWdodCgpKTtcblx0XHR0aGlzLnVwZGF0ZUNvbnRlbnQoY29tcHV0ZWQpO1xuXG5cdFx0Ly8gU2V0IHVwIG91dGxpbmUgY2hhbmdlIGxpc3RlbmVyXG5cdFx0dGhpcy5fZGlzcG9zYWJsZXMuYWRkKG5vdGVib29rQ2VsbE91dGxpbmUub25EaWRDaGFuZ2UoKCkgPT4ge1xuXHRcdFx0Y29uc3QgY29tcHV0ZWQgPSBjb21wdXRlQ29udGVudCh0aGlzLm5vdGVib29rRWRpdG9yLCB0aGlzLm5vdGVib29rQ2VsbExpc3QsIG5vdGVib29rQ2VsbE91dGxpbmUuZW50cmllcywgdGhpcy5nZXRDdXJyZW50U3RpY2t5SGVpZ2h0KCkpO1xuXHRcdFx0aWYgKCF0aGlzLmNvbXBhcmVTdGlja3lMaW5lTWFwcyhjb21wdXRlZCwgdGhpcy5jdXJyZW50U3RpY2t5TGluZXMpKSB7XG5cdFx0XHRcdHRoaXMudXBkYXRlQ29udGVudChjb21wdXRlZCk7XG5cdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHQvLyBpZiB3ZSBkb24ndCBlbmQgdXAgdXBkYXRpbmcgdGhlIGNvbnRlbnQsIHdlIG5lZWQgdG8gYXZvaWQgbGVha2luZyB0aGUgbWFwXG5cdFx0XHRcdHRoaXMuZGlzcG9zZVN0aWNreUxpbmVNYXAoY29tcHV0ZWQpO1xuXHRcdFx0fVxuXHRcdH0pKTtcblxuXHRcdC8vIEhhbmRsZSB2aWV3IG1vZGVsIGNoYW5nZXNcblx0XHR0aGlzLl9kaXNwb3NhYmxlcy5hZGQodGhpcy5ub3RlYm9va0VkaXRvci5vbkRpZEF0dGFjaFZpZXdNb2RlbChhc3luYyAoKSA9PiB7XG5cdFx0XHQvLyBlbnN1cmUgcmVjb21wdXRlIHN5bWJvbHMgd2hlbiB2aWV3IG1vZGVsIGNoYW5nZXMgLS0gY291bGQgYmUgbWlzc2VkIGlmIG91dGxpbmUgaXMgY2xvc2VkXG5cdFx0XHRhd2FpdCBub3RlYm9va0NlbGxPdXRsaW5lLmNvbXB1dGVGdWxsU3ltYm9scyhDYW5jZWxsYXRpb25Ub2tlbi5Ob25lKTtcblxuXHRcdFx0Y29uc3QgY29tcHV0ZWQgPSBjb21wdXRlQ29udGVudCh0aGlzLm5vdGVib29rRWRpdG9yLCB0aGlzLm5vdGVib29rQ2VsbExpc3QsIG5vdGVib29rQ2VsbE91dGxpbmUuZW50cmllcywgdGhpcy5nZXRDdXJyZW50U3RpY2t5SGVpZ2h0KCkpO1xuXHRcdFx0dGhpcy51cGRhdGVDb250ZW50KGNvbXB1dGVkKTtcblx0XHR9KSk7XG5cblx0XHR0aGlzLl9kaXNwb3NhYmxlcy5hZGQodGhpcy5ub3RlYm9va0VkaXRvci5vbkRpZFNjcm9sbCgoKSA9PiB7XG5cdFx0XHRjb25zdCBkID0gbmV3IERlbGF5ZXIoMTAwKTtcblx0XHRcdGQudHJpZ2dlcigoKSA9PiB7XG5cdFx0XHRcdGQuZGlzcG9zZSgpO1xuXG5cdFx0XHRcdGNvbnN0IGNvbXB1dGVkID0gY29tcHV0ZUNvbnRlbnQodGhpcy5ub3RlYm9va0VkaXRvciwgdGhpcy5ub3RlYm9va0NlbGxMaXN0LCBub3RlYm9va0NlbGxPdXRsaW5lLmVudHJpZXMsIHRoaXMuZ2V0Q3VycmVudFN0aWNreUhlaWdodCgpKTtcblx0XHRcdFx0aWYgKCF0aGlzLmNvbXBhcmVTdGlja3lMaW5lTWFwcyhjb21wdXRlZCwgdGhpcy5jdXJyZW50U3RpY2t5TGluZXMpKSB7XG5cdFx0XHRcdFx0dGhpcy51cGRhdGVDb250ZW50KGNvbXB1dGVkKTtcblx0XHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0XHQvLyBpZiB3ZSBkb24ndCBlbmQgdXAgdXBkYXRpbmcgdGhlIGNvbnRlbnQsIHdlIG5lZWQgdG8gYXZvaWQgbGVha2luZyB0aGUgbWFwXG5cdFx0XHRcdFx0dGhpcy5kaXNwb3NlU3RpY2t5TGluZU1hcChjb21wdXRlZCk7XG5cdFx0XHRcdH1cblx0XHRcdH0pO1xuXHRcdH0pKTtcblx0fVxuXG5cdC8vIEFkZCBoZWxwZXIgbWV0aG9kIHRvIGRpc3Bvc2UgYSBtYXAgb2Ygc3RpY2t5IGxpbmVzXG5cdHByaXZhdGUgZGlzcG9zZVN0aWNreUxpbmVNYXAobWFwOiBNYXA8T3V0bGluZUVudHJ5LCB7IGxpbmU6IE5vdGVib29rU3RpY2t5TGluZTsgcmVuZGVyZWQ6IGJvb2xlYW4gfT4pIHtcblx0XHRtYXAuZm9yRWFjaCh2YWx1ZSA9PiB7XG5cdFx0XHRpZiAodmFsdWUubGluZSkge1xuXHRcdFx0XHR2YWx1ZS5saW5lLmRpc3Bvc2UoKTtcblx0XHRcdH1cblx0XHR9KTtcblx0fVxuXG5cdC8vIHRha2UgaW4gYW4gY2VsbCBpbmRleCwgYW5kIGdldCB0aGUgY29ycmVzcG9uZGluZyBvdXRsaW5lIGVudHJ5XG5cdHN0YXRpYyBnZXRWaXNpYmxlT3V0bGluZUVudHJ5KHZpc2libGVJbmRleDogbnVtYmVyLCBub3RlYm9va091dGxpbmVFbnRyaWVzOiBPdXRsaW5lRW50cnlbXSk6IE91dGxpbmVFbnRyeSB8IHVuZGVmaW5lZCB7XG5cdFx0bGV0IGxlZnQgPSAwO1xuXHRcdGxldCByaWdodCA9IG5vdGVib29rT3V0bGluZUVudHJpZXMubGVuZ3RoIC0gMTtcblxuXHRcdHdoaWxlIChsZWZ0IDw9IHJpZ2h0KSB7XG5cdFx0XHRjb25zdCBtaWQgPSBNYXRoLmZsb29yKChsZWZ0ICsgcmlnaHQpIC8gMik7XG5cdFx0XHRpZiAobm90ZWJvb2tPdXRsaW5lRW50cmllc1ttaWRdLmluZGV4ID09PSB2aXNpYmxlSW5kZXgpIHtcblx0XHRcdFx0Ly8gRXhhY3QgbWF0Y2ggZm91bmRcblx0XHRcdFx0Y29uc3Qgcm9vdEVudHJ5ID0gbm90ZWJvb2tPdXRsaW5lRW50cmllc1ttaWRdO1xuXHRcdFx0XHRjb25zdCBmbGF0TGlzdDogT3V0bGluZUVudHJ5W10gPSBbXTtcblx0XHRcdFx0cm9vdEVudHJ5LmFzRmxhdExpc3QoZmxhdExpc3QpO1xuXHRcdFx0XHRyZXR1cm4gZmxhdExpc3QuZmluZChlbnRyeSA9PiBlbnRyeS5pbmRleCA9PT0gdmlzaWJsZUluZGV4KTtcblx0XHRcdH0gZWxzZSBpZiAobm90ZWJvb2tPdXRsaW5lRW50cmllc1ttaWRdLmluZGV4IDwgdmlzaWJsZUluZGV4KSB7XG5cdFx0XHRcdGxlZnQgPSBtaWQgKyAxO1xuXHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0cmlnaHQgPSBtaWQgLSAxO1xuXHRcdFx0fVxuXHRcdH1cblxuXHRcdC8vIE5vIGV4YWN0IG1hdGNoIGZvdW5kIC0gZ2V0IHRoZSBjbG9zZXN0IHNtYWxsZXIgZW50cnlcblx0XHRpZiAocmlnaHQgPj0gMCkge1xuXHRcdFx0Y29uc3Qgcm9vdEVudHJ5ID0gbm90ZWJvb2tPdXRsaW5lRW50cmllc1tyaWdodF07XG5cdFx0XHRjb25zdCBmbGF0TGlzdDogT3V0bGluZUVudHJ5W10gPSBbXTtcblx0XHRcdHJvb3RFbnRyeS5hc0ZsYXRMaXN0KGZsYXRMaXN0KTtcblx0XHRcdHJldHVybiBmbGF0TGlzdC5maW5kKGVudHJ5ID0+IGVudHJ5LmluZGV4ID09PSB2aXNpYmxlSW5kZXgpO1xuXHRcdH1cblxuXHRcdHJldHVybiB1bmRlZmluZWQ7XG5cdH1cblxuXHRwcml2YXRlIHVwZGF0ZUNvbnRlbnQobmV3TWFwOiBNYXA8T3V0bGluZUVudHJ5LCB7IGxpbmU6IE5vdGVib29rU3RpY2t5TGluZTsgcmVuZGVyZWQ6IGJvb2xlYW4gfT4pIHtcblx0XHRET00uY2xlYXJOb2RlKHRoaXMuZG9tTm9kZSk7XG5cdFx0dGhpcy5kaXNwb3NlQ3VycmVudFN0aWNreUxpbmVzKCk7XG5cdFx0dGhpcy5yZW5kZXJTdGlja3lMaW5lcyhuZXdNYXAsIHRoaXMuZG9tTm9kZSk7XG5cblx0XHRjb25zdCBvbGRTdGlja3lIZWlnaHQgPSB0aGlzLmdldEN1cnJlbnRTdGlja3lIZWlnaHQoKTtcblx0XHR0aGlzLnNldEN1cnJlbnRTdGlja3lMaW5lcyhuZXdNYXApO1xuXG5cdFx0Ly8gKCspID0gc3RpY2t5IGhlaWdodCBpbmNyZWFzZWRcblx0XHQvLyAoLSkgPSBzdGlja3kgaGVpZ2h0IGRlY3JlYXNlZFxuXHRcdGNvbnN0IHNpemVEZWx0YSA9IHRoaXMuZ2V0Q3VycmVudFN0aWNreUhlaWdodCgpIC0gb2xkU3RpY2t5SGVpZ2h0O1xuXHRcdGlmIChzaXplRGVsdGEgIT09IDApIHtcblx0XHRcdHRoaXMuX29uRGlkQ2hhbmdlTm90ZWJvb2tTdGlja3lTY3JvbGwuZmlyZShzaXplRGVsdGEpO1xuXG5cdFx0XHRjb25zdCBkID0gdGhpcy5fbGF5b3V0RGlzcG9zYWJsZVN0b3JlLmFkZChET00uc2NoZWR1bGVBdE5leHRBbmltYXRpb25GcmFtZShET00uZ2V0V2luZG93KHRoaXMuZ2V0RG9tTm9kZSgpKSwgKCkgPT4ge1xuXHRcdFx0XHR0aGlzLmxheW91dEZuKHNpemVEZWx0YSk7XG5cdFx0XHRcdHRoaXMudXBkYXRlRGlzcGxheSgpO1xuXG5cdFx0XHRcdHRoaXMuX2xheW91dERpc3Bvc2FibGVTdG9yZS5kZWxldGUoZCk7XG5cdFx0XHR9KSk7XG5cdFx0fSBlbHNlIHtcblx0XHRcdHRoaXMudXBkYXRlRGlzcGxheSgpO1xuXHRcdH1cblx0fVxuXG5cdHByaXZhdGUgdXBkYXRlRGlzcGxheSgpIHtcblx0XHRjb25zdCBoYXNTdGlja3kgPSB0aGlzLmdldEN1cnJlbnRTdGlja3lIZWlnaHQoKSA+IDA7XG5cdFx0aWYgKCFoYXNTdGlja3kpIHtcblx0XHRcdHRoaXMuZG9tTm9kZS5zdHlsZS5kaXNwbGF5ID0gJ25vbmUnO1xuXHRcdH0gZWxzZSB7XG5cdFx0XHR0aGlzLmRvbU5vZGUuc3R5bGUuZGlzcGxheSA9ICdibG9jayc7XG5cdFx0fVxuXHR9XG5cblx0c3RhdGljIGNvbXB1dGVTdGlja3lIZWlnaHQoZW50cnk6IE91dGxpbmVFbnRyeSkge1xuXHRcdGxldCBoZWlnaHQgPSAwO1xuXHRcdGlmIChlbnRyeS5jZWxsLmNlbGxLaW5kID09PSBDZWxsS2luZC5NYXJrdXAgJiYgZW50cnkubGV2ZWwgPCA3KSB7XG5cdFx0XHRoZWlnaHQgKz0gMjI7XG5cdFx0fVxuXHRcdHdoaWxlIChlbnRyeS5wYXJlbnQpIHtcblx0XHRcdGhlaWdodCArPSAyMjtcblx0XHRcdGVudHJ5ID0gZW50cnkucGFyZW50O1xuXHRcdH1cblx0XHRyZXR1cm4gaGVpZ2h0O1xuXHR9XG5cblx0c3RhdGljIGNoZWNrQ29sbGFwc2VkU3RpY2t5TGluZXMoZW50cnk6IE91dGxpbmVFbnRyeSB8IHVuZGVmaW5lZCwgbnVtTGluZXNUb1JlbmRlcjogbnVtYmVyLCBub3RlYm9va0VkaXRvcjogSU5vdGVib29rRWRpdG9yKSB7XG5cdFx0bGV0IGN1cnJlbnRFbnRyeSA9IGVudHJ5O1xuXHRcdGNvbnN0IG5ld01hcCA9IG5ldyBNYXA8T3V0bGluZUVudHJ5LCB7IGxpbmU6IE5vdGVib29rU3RpY2t5TGluZTsgcmVuZGVyZWQ6IGJvb2xlYW4gfT4oKTtcblxuXHRcdGNvbnN0IGVsZW1lbnRzVG9SZW5kZXIgPSBbXTtcblx0XHR3aGlsZSAoY3VycmVudEVudHJ5KSB7XG5cdFx0XHRpZiAoY3VycmVudEVudHJ5LmxldmVsID49IDcpIHtcblx0XHRcdFx0Ly8gbGV2ZWwgNysgcmVwcmVzZW50cyBhIG5vbi1oZWFkZXIgZW50cnksIHdoaWNoIHdlIGRvbid0IHdhbnQgdG8gcmVuZGVyXG5cdFx0XHRcdGN1cnJlbnRFbnRyeSA9IGN1cnJlbnRFbnRyeS5wYXJlbnQ7XG5cdFx0XHRcdGNvbnRpbnVlO1xuXHRcdFx0fVxuXHRcdFx0Y29uc3QgbGluZVRvUmVuZGVyID0gTm90ZWJvb2tTdGlja3lTY3JvbGwuY3JlYXRlU3RpY2t5RWxlbWVudChjdXJyZW50RW50cnksIG5vdGVib29rRWRpdG9yKTtcblx0XHRcdG5ld01hcC5zZXQoY3VycmVudEVudHJ5LCB7IGxpbmU6IGxpbmVUb1JlbmRlciwgcmVuZGVyZWQ6IGZhbHNlIH0pO1xuXHRcdFx0ZWxlbWVudHNUb1JlbmRlci51bnNoaWZ0KGxpbmVUb1JlbmRlcik7XG5cdFx0XHRjdXJyZW50RW50cnkgPSBjdXJyZW50RW50cnkucGFyZW50O1xuXHRcdH1cblxuXHRcdC8vIGl0ZXJhdGUgb3ZlciBlbGVtZW50cyB0byByZW5kZXIsIGFuZCBhcHBlbmQgdG8gY29udGFpbmVyXG5cdFx0Ly8gYnJlYWsgd2hlbiB3ZSByZWFjaCBudW1MaW5lc1RvUmVuZGVyXG5cdFx0Zm9yIChsZXQgaSA9IDA7IGkgPCBlbGVtZW50c1RvUmVuZGVyLmxlbmd0aDsgaSsrKSB7XG5cdFx0XHRpZiAoaSA+PSBudW1MaW5lc1RvUmVuZGVyKSB7XG5cdFx0XHRcdGJyZWFrO1xuXHRcdFx0fVxuXHRcdFx0bmV3TWFwLnNldChlbGVtZW50c1RvUmVuZGVyW2ldLmVudHJ5LCB7IGxpbmU6IGVsZW1lbnRzVG9SZW5kZXJbaV0sIHJlbmRlcmVkOiB0cnVlIH0pO1xuXHRcdH1cblx0XHRyZXR1cm4gbmV3TWFwO1xuXHR9XG5cblx0cHJpdmF0ZSByZW5kZXJTdGlja3lMaW5lcyhzdGlja3lNYXA6IE1hcDxPdXRsaW5lRW50cnksIHsgbGluZTogTm90ZWJvb2tTdGlja3lMaW5lOyByZW5kZXJlZDogYm9vbGVhbiB9PiwgY29udGFpbmVyRWxlbWVudDogSFRNTEVsZW1lbnQpIHtcblx0XHRjb25zdCByZXZlcnNlZEVudHJpZXMgPSBBcnJheS5mcm9tKHN0aWNreU1hcC5lbnRyaWVzKCkpLnJldmVyc2UoKTtcblx0XHRmb3IgKGNvbnN0IFssIHZhbHVlXSBvZiByZXZlcnNlZEVudHJpZXMpIHtcblx0XHRcdGlmICghdmFsdWUucmVuZGVyZWQpIHtcblx0XHRcdFx0Y29udGludWU7XG5cdFx0XHR9XG5cdFx0XHRjb250YWluZXJFbGVtZW50LmFwcGVuZCh2YWx1ZS5saW5lLmVsZW1lbnQpO1xuXHRcdH1cblx0fVxuXG5cdHN0YXRpYyBjcmVhdGVTdGlja3lFbGVtZW50KGVudHJ5OiBPdXRsaW5lRW50cnksIG5vdGVib29rRWRpdG9yOiBJTm90ZWJvb2tFZGl0b3IpIHtcblx0XHRjb25zdCBzdGlja3lFbGVtZW50ID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnZGl2Jyk7XG5cdFx0c3RpY2t5RWxlbWVudC5jbGFzc0xpc3QuYWRkKCdub3RlYm9vay1zdGlja3ktc2Nyb2xsLWVsZW1lbnQnKTtcblxuXHRcdGNvbnN0IGluZGVudE1vZGUgPSBub3RlYm9va0VkaXRvci5ub3RlYm9va09wdGlvbnMuZ2V0TGF5b3V0Q29uZmlndXJhdGlvbigpLnN0aWNreVNjcm9sbE1vZGU7XG5cdFx0aWYgKGluZGVudE1vZGUgPT09ICdpbmRlbnRlZCcpIHtcblx0XHRcdHN0aWNreUVsZW1lbnQuc3R5bGUucGFkZGluZ0xlZnQgPSBOb3RlYm9va1N0aWNreUxpbmUuZ2V0UGFyZW50Q291bnQoZW50cnkpICogMTAgKyAncHgnO1xuXHRcdH1cblxuXHRcdGxldCBpc0NvbGxhcHNlZCA9IGZhbHNlO1xuXHRcdGlmIChlbnRyeS5jZWxsLmNlbGxLaW5kID09PSBDZWxsS2luZC5NYXJrdXApIHtcblx0XHRcdGlzQ29sbGFwc2VkID0gKGVudHJ5LmNlbGwgYXMgTWFya3VwQ2VsbFZpZXdNb2RlbCkuZm9sZGluZ1N0YXRlID09PSBDZWxsRm9sZGluZ1N0YXRlLkNvbGxhcHNlZDtcblx0XHR9XG5cblx0XHRjb25zdCBzdGlja3lGb2xkaW5nSWNvbiA9IG5ldyBTdGlja3lGb2xkaW5nSWNvbihpc0NvbGxhcHNlZCwgMTYpO1xuXHRcdHN0aWNreUZvbGRpbmdJY29uLmRvbU5vZGUuY2xhc3NMaXN0LmFkZCgnbm90ZWJvb2stc3RpY2t5LXNjcm9sbC1mb2xkaW5nLWljb24nKTtcblx0XHRzdGlja3lGb2xkaW5nSWNvbi5zZXRWaXNpYmxlKHRydWUpO1xuXG5cdFx0Y29uc3Qgc3RpY2t5SGVhZGVyID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnZGl2Jyk7XG5cdFx0c3RpY2t5SGVhZGVyLmNsYXNzTGlzdC5hZGQoJ25vdGVib29rLXN0aWNreS1zY3JvbGwtaGVhZGVyJyk7XG5cdFx0c3RpY2t5SGVhZGVyLmlubmVyVGV4dCA9IGVudHJ5LmxhYmVsO1xuXG5cdFx0c3RpY2t5RWxlbWVudC5hcHBlbmQoc3RpY2t5Rm9sZGluZ0ljb24uZG9tTm9kZSwgc3RpY2t5SGVhZGVyKTtcblxuXHRcdHJldHVybiBuZXcgTm90ZWJvb2tTdGlja3lMaW5lKHN0aWNreUVsZW1lbnQsIHN0aWNreUZvbGRpbmdJY29uLCBzdGlja3lIZWFkZXIsIGVudHJ5LCBub3RlYm9va0VkaXRvcik7XG5cdH1cblxuXHRwcml2YXRlIGRpc3Bvc2VDdXJyZW50U3RpY2t5TGluZXMoKSB7XG5cdFx0dGhpcy5jdXJyZW50U3RpY2t5TGluZXMuZm9yRWFjaCgodmFsdWUpID0+IHtcblx0XHRcdHZhbHVlLmxpbmUuZGlzcG9zZSgpO1xuXHRcdH0pO1xuXHR9XG5cblx0b3ZlcnJpZGUgZGlzcG9zZSgpIHtcblx0XHR0aGlzLl9kaXNwb3NhYmxlcy5kaXNwb3NlKCk7XG5cdFx0dGhpcy5kaXNwb3NlQ3VycmVudFN0aWNreUxpbmVzKCk7XG5cdFx0dGhpcy5ub3RlYm9va0NlbGxPdXRsaW5lUmVmZXJlbmNlPy5kaXNwb3NlKCk7XG5cdFx0c3VwZXIuZGlzcG9zZSgpO1xuXHR9XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBjb21wdXRlQ29udGVudChub3RlYm9va0VkaXRvcjogSU5vdGVib29rRWRpdG9yLCBub3RlYm9va0NlbGxMaXN0OiBJTm90ZWJvb2tDZWxsTGlzdCwgbm90ZWJvb2tPdXRsaW5lRW50cmllczogT3V0bGluZUVudHJ5W10sIHJlbmRlcmVkU3RpY2t5SGVpZ2h0OiBudW1iZXIpOiBNYXA8T3V0bGluZUVudHJ5LCB7IGxpbmU6IE5vdGVib29rU3RpY2t5TGluZTsgcmVuZGVyZWQ6IGJvb2xlYW4gfT4ge1xuXHQvLyBnZXQgZGF0YSBhYm91dCB0aGUgY2VsbCBsaXN0IHdpdGhpbiB2aWV3cG9ydCAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG5cdGNvbnN0IGVkaXRvclNjcm9sbFRvcCA9IG5vdGVib29rRWRpdG9yLnNjcm9sbFRvcCAtIHJlbmRlcmVkU3RpY2t5SGVpZ2h0O1xuXHRjb25zdCB2aXNpYmxlUmFuZ2UgPSBub3RlYm9va0VkaXRvci52aXNpYmxlUmFuZ2VzWzBdO1xuXHRpZiAoIXZpc2libGVSYW5nZSkge1xuXHRcdHJldHVybiBuZXcgTWFwKCk7XG5cdH1cblxuXHQvLyBlZGdlIGNhc2UgZm9yIGNlbGwgMCBpbiB0aGUgbm90ZWJvb2sgaXMgYSBoZWFkZXIgLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG5cdGlmICh2aXNpYmxlUmFuZ2Uuc3RhcnQgPT09IDApIHtcblx0XHRjb25zdCBmaXJzdENlbGwgPSBub3RlYm9va0VkaXRvci5jZWxsQXQoMCk7XG5cdFx0Y29uc3QgZmlyc3RDZWxsRW50cnkgPSBOb3RlYm9va1N0aWNreVNjcm9sbC5nZXRWaXNpYmxlT3V0bGluZUVudHJ5KDAsIG5vdGVib29rT3V0bGluZUVudHJpZXMpO1xuXHRcdGlmIChmaXJzdENlbGwgJiYgZmlyc3RDZWxsRW50cnkgJiYgZmlyc3RDZWxsLmNlbGxLaW5kID09PSBDZWxsS2luZC5NYXJrdXAgJiYgZmlyc3RDZWxsRW50cnkubGV2ZWwgPCA3KSB7XG5cdFx0XHRpZiAobm90ZWJvb2tFZGl0b3Iuc2Nyb2xsVG9wID4gMjIpIHtcblx0XHRcdFx0Y29uc3QgbmV3TWFwID0gTm90ZWJvb2tTdGlja3lTY3JvbGwuY2hlY2tDb2xsYXBzZWRTdGlja3lMaW5lcyhmaXJzdENlbGxFbnRyeSwgMTAwLCBub3RlYm9va0VkaXRvcik7XG5cdFx0XHRcdHJldHVybiBuZXdNYXA7XG5cdFx0XHR9XG5cdFx0fVxuXHR9XG5cblx0Ly8gaXRlcmF0ZSBvdmVyIGNlbGxzIGluIHZpZXdwb3J0IC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuXHRsZXQgY2VsbDtcblx0bGV0IGNlbGxFbnRyeTtcblx0Y29uc3Qgc3RhcnRJbmRleCA9IHZpc2libGVSYW5nZS5zdGFydCAtIDE7IC8vIC0xIHRvIGFjY291bnQgZm9yIGNlbGxzIGhpZGRlbiBcInVuZGVyXCIgc3RpY2t5IGxpbmVzLlxuXHRmb3IgKGxldCBjdXJyZW50SW5kZXggPSBzdGFydEluZGV4OyBjdXJyZW50SW5kZXggPCB2aXNpYmxlUmFuZ2UuZW5kOyBjdXJyZW50SW5kZXgrKykge1xuXHRcdC8vIHN0b3JlIGRhdGEgZm9yIGN1cnJlbnQgY2VsbCwgYW5kIG5leHQgY2VsbFxuXHRcdGNlbGwgPSBub3RlYm9va0VkaXRvci5jZWxsQXQoY3VycmVudEluZGV4KTtcblx0XHRpZiAoIWNlbGwpIHtcblx0XHRcdHJldHVybiBuZXcgTWFwKCk7XG5cdFx0fVxuXHRcdGNlbGxFbnRyeSA9IE5vdGVib29rU3RpY2t5U2Nyb2xsLmdldFZpc2libGVPdXRsaW5lRW50cnkoY3VycmVudEluZGV4LCBub3RlYm9va091dGxpbmVFbnRyaWVzKTtcblx0XHRpZiAoIWNlbGxFbnRyeSkge1xuXHRcdFx0Y29udGludWU7XG5cdFx0fVxuXG5cdFx0Y29uc3QgbmV4dENlbGwgPSBub3RlYm9va0VkaXRvci5jZWxsQXQoY3VycmVudEluZGV4ICsgMSk7XG5cdFx0aWYgKCFuZXh0Q2VsbCkge1xuXHRcdFx0Y29uc3Qgc2VjdGlvbkJvdHRvbSA9IG5vdGVib29rRWRpdG9yLmdldExheW91dEluZm8oKS5zY3JvbGxIZWlnaHQ7XG5cdFx0XHRjb25zdCBsaW5lc1RvUmVuZGVyID0gTWF0aC5mbG9vcigoc2VjdGlvbkJvdHRvbSkgLyAyMik7XG5cdFx0XHRjb25zdCBuZXdNYXAgPSBOb3RlYm9va1N0aWNreVNjcm9sbC5jaGVja0NvbGxhcHNlZFN0aWNreUxpbmVzKGNlbGxFbnRyeSwgbGluZXNUb1JlbmRlciwgbm90ZWJvb2tFZGl0b3IpO1xuXHRcdFx0cmV0dXJuIG5ld01hcDtcblx0XHR9XG5cdFx0Y29uc3QgbmV4dENlbGxFbnRyeSA9IE5vdGVib29rU3RpY2t5U2Nyb2xsLmdldFZpc2libGVPdXRsaW5lRW50cnkoY3VycmVudEluZGV4ICsgMSwgbm90ZWJvb2tPdXRsaW5lRW50cmllcyk7XG5cdFx0aWYgKCFuZXh0Q2VsbEVudHJ5KSB7XG5cdFx0XHRjb250aW51ZTtcblx0XHR9XG5cblx0XHQvLyBjaGVjayBuZXh0IGNlbGwsIGlmIG1hcmtkb3duIHdpdGggbm9uIGxldmVsIDcgZW50cnksIHRoYXQgbWVhbnMgdGhpcyBpcyB0aGUgZW5kIG9mIHRoZSBzZWN0aW9uIChuZXcgaGVhZGVyKSAtLS0tLS0tLS0tLS0tLS0tLS0tLS1cblx0XHRpZiAobmV4dENlbGwuY2VsbEtpbmQgPT09IENlbGxLaW5kLk1hcmt1cCAmJiBuZXh0Q2VsbEVudHJ5LmxldmVsIDwgNykge1xuXHRcdFx0Y29uc3Qgc2VjdGlvbkJvdHRvbSA9IG5vdGVib29rQ2VsbExpc3QuZ2V0Q2VsbFZpZXdTY3JvbGxUb3AobmV4dENlbGwpO1xuXHRcdFx0Y29uc3QgY3VycmVudFNlY3Rpb25TdGlja3lIZWlnaHQgPSBOb3RlYm9va1N0aWNreVNjcm9sbC5jb21wdXRlU3RpY2t5SGVpZ2h0KGNlbGxFbnRyeSk7XG5cdFx0XHRjb25zdCBuZXh0U2VjdGlvblN0aWNreUhlaWdodCA9IE5vdGVib29rU3RpY2t5U2Nyb2xsLmNvbXB1dGVTdGlja3lIZWlnaHQobmV4dENlbGxFbnRyeSk7XG5cblx0XHRcdC8vIGNhc2U6IHdlIGNhbiByZW5kZXIgdGhlIGFsbCBzdGlja3kgbGluZXMgZm9yIHRoZSBjdXJyZW50IHNlY3Rpb24gLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG5cdFx0XHRpZiAoZWRpdG9yU2Nyb2xsVG9wICsgY3VycmVudFNlY3Rpb25TdGlja3lIZWlnaHQgPCBzZWN0aW9uQm90dG9tKSB7XG5cdFx0XHRcdGNvbnN0IGxpbmVzVG9SZW5kZXIgPSBNYXRoLmZsb29yKChzZWN0aW9uQm90dG9tIC0gZWRpdG9yU2Nyb2xsVG9wKSAvIDIyKTtcblx0XHRcdFx0Y29uc3QgbmV3TWFwID0gTm90ZWJvb2tTdGlja3lTY3JvbGwuY2hlY2tDb2xsYXBzZWRTdGlja3lMaW5lcyhjZWxsRW50cnksIGxpbmVzVG9SZW5kZXIsIG5vdGVib29rRWRpdG9yKTtcblx0XHRcdFx0cmV0dXJuIG5ld01hcDtcblx0XHRcdH1cblxuXHRcdFx0Ly8gY2FzZTogbmV4dCBzZWN0aW9uIGlzIHRoZSBzYW1lIHNpemUgb3IgYmlnZ2VyLCByZW5kZXIgbmV4dCBlbnRyeSAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuXHRcdFx0ZWxzZSBpZiAobmV4dFNlY3Rpb25TdGlja3lIZWlnaHQgPj0gY3VycmVudFNlY3Rpb25TdGlja3lIZWlnaHQpIHtcblx0XHRcdFx0Y29uc3QgbmV3TWFwID0gTm90ZWJvb2tTdGlja3lTY3JvbGwuY2hlY2tDb2xsYXBzZWRTdGlja3lMaW5lcyhuZXh0Q2VsbEVudHJ5LCAxMDAsIG5vdGVib29rRWRpdG9yKTtcblx0XHRcdFx0cmV0dXJuIG5ld01hcDtcblx0XHRcdH1cblx0XHRcdC8vIGNhc2U6IG5leHQgc2VjdGlvbiBpcyB0aGUgc21hbGxlciwgc2hyaW5rIHVudGlsIG5leHQgc2VjdGlvbiBoZWlnaHQgaXMgZ3JlYXRlciB0aGFuIHRoZSBhdmFpbGFibGUgc3BhY2UgLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG5cdFx0XHRlbHNlIGlmIChuZXh0U2VjdGlvblN0aWNreUhlaWdodCA8IGN1cnJlbnRTZWN0aW9uU3RpY2t5SGVpZ2h0KSB7XG5cdFx0XHRcdGNvbnN0IGF2YWlsYWJsZVNwYWNlID0gc2VjdGlvbkJvdHRvbSAtIGVkaXRvclNjcm9sbFRvcDtcblxuXHRcdFx0XHRpZiAoYXZhaWxhYmxlU3BhY2UgPj0gbmV4dFNlY3Rpb25TdGlja3lIZWlnaHQpIHtcblx0XHRcdFx0XHRjb25zdCBsaW5lc1RvUmVuZGVyID0gTWF0aC5mbG9vcigoYXZhaWxhYmxlU3BhY2UpIC8gMjIpO1xuXHRcdFx0XHRcdGNvbnN0IG5ld01hcCA9IE5vdGVib29rU3RpY2t5U2Nyb2xsLmNoZWNrQ29sbGFwc2VkU3RpY2t5TGluZXMoY2VsbEVudHJ5LCBsaW5lc1RvUmVuZGVyLCBub3RlYm9va0VkaXRvcik7XG5cdFx0XHRcdFx0cmV0dXJuIG5ld01hcDtcblx0XHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0XHRjb25zdCBuZXdNYXAgPSBOb3RlYm9va1N0aWNreVNjcm9sbC5jaGVja0NvbGxhcHNlZFN0aWNreUxpbmVzKG5leHRDZWxsRW50cnksIDEwMCwgbm90ZWJvb2tFZGl0b3IpO1xuXHRcdFx0XHRcdHJldHVybiBuZXdNYXA7XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHR9XG5cdH0gLy8gdmlzaWJsZSByYW5nZSBsb29wIGNsb3NlXG5cblx0Ly8gY2FzZTogYWxsIHZpc2libGUgY2VsbHMgd2VyZSBub24taGVhZGVyIGNlbGxzLCBzbyByZW5kZXIgYW55IGhlYWRlcnMgcmVsZXZhbnQgdG8gdGhlaXIgc2VjdGlvbiAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuXHRjb25zdCBzZWN0aW9uQm90dG9tID0gbm90ZWJvb2tFZGl0b3IuZ2V0TGF5b3V0SW5mbygpLnNjcm9sbEhlaWdodDtcblx0Y29uc3QgbGluZXNUb1JlbmRlciA9IE1hdGguZmxvb3IoKHNlY3Rpb25Cb3R0b20gLSBlZGl0b3JTY3JvbGxUb3ApIC8gMjIpO1xuXHRjb25zdCBuZXdNYXAgPSBOb3RlYm9va1N0aWNreVNjcm9sbC5jaGVja0NvbGxhcHNlZFN0aWNreUxpbmVzKGNlbGxFbnRyeSwgbGluZXNUb1JlbmRlciwgbm90ZWJvb2tFZGl0b3IpO1xuXHRyZXR1cm4gbmV3TWFwO1xufVxuIl0sCiAgIm1hcHBpbmdzIjogIjs7Ozs7Ozs7Ozs7QUFLQSxZQUFZLFNBQVM7QUFDckIsU0FBUyxhQUFhLHNCQUFzQjtBQUM1QyxTQUFTLHlCQUF5QjtBQUNsQyxTQUFTLDBCQUEwQjtBQUNuQyxTQUFTLGVBQXNCO0FBQy9CLFNBQVMsWUFBWSx1QkFBd0M7QUFDN0QsU0FBUyxjQUFjO0FBQ3ZCLFNBQVMsMkJBQTJCO0FBQ3BDLFNBQVMsd0JBQXlDO0FBSWxELFNBQVMsZ0JBQWdCO0FBQ3pCLFNBQVMsZUFBZTtBQUN4QixTQUFTLGlCQUFpQjtBQUMxQixTQUFTLHNCQUFzQiwyQkFBMkI7QUFFMUQsU0FBUyx5QkFBeUI7QUFHbEMsU0FBUyw2QkFBNkI7QUFDdEMsU0FBUyw2Q0FBNkM7QUFFL0MsTUFBTSwyQkFBMkIsV0FBVztBQUFBLEVBQ2xELFlBQ2lCLFNBQ0EsYUFDQSxRQUNBLE9BQ0EsZ0JBQ2Y7QUFDRCxVQUFNO0FBTlU7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUloQixTQUFLLFVBQVUsSUFBSSxzQkFBc0IsS0FBSyxRQUFRLElBQUksVUFBVSxTQUFTLGVBQWUsS0FBSyxNQUFNO0FBQ3RHLFdBQUssVUFBVTtBQUFBLElBQ2hCLENBQUMsQ0FBQztBQUdGLFNBQUssVUFBVSxJQUFJLHNCQUFzQixLQUFLLFlBQVksU0FBUyxJQUFJ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
