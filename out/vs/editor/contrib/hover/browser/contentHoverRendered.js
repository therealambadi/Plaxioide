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
import { RenderedHoverParts } from "./hoverTypes.js";
import { Disposable, DisposableStore, toDisposable } from "../../../../base/common/lifecycle.js";
import { EditorHoverStatusBar } from "./contentHoverStatusBar.js";
import { IKeybindingService } from "../../../../platform/keybinding/common/keybinding.js";
import { ModelDecorationOptions } from "../../../common/model/textModel.js";
import { Position } from "../../../common/core/position.js";
import { Range } from "../../../common/core/range.js";
import * as dom from "../../../../base/browser/dom.js";
import { MarkdownHoverParticipant } from "./markdownHoverParticipant.js";
import { HoverColorPickerParticipant } from "../../colorPicker/browser/hoverColorPicker/hoverColorPickerParticipant.js";
import { localize } from "../../../../nls.js";
import { InlayHintsHover } from "../../inlayHints/browser/inlayHintsHover.js";
import { BugIndicatingError } from "../../../../base/common/errors.js";
import { IHoverService } from "../../../../platform/hover/browser/hover.js";
let RenderedContentHover = class extends Disposable {
  constructor(editor, hoverResult, participants, context, keybindingService, hoverService) {
    super();
    const parts = hoverResult.hoverParts;
    this._renderedHoverParts = this._register(new RenderedContentHoverParts(
      editor,
      participants,
      parts,
      context,
      keybindingService,
      hoverService
    ));
    const contentHoverComputerOptions = hoverResult.options;
    const anchor = contentHoverComputerOptions.anchor;
    const { showAtPosition, showAtSecondaryPosition } = RenderedContentHover.computeHoverPositions(editor, anchor.range, parts);
    this.shouldAppearBeforeContent = parts.some((m) => m.isBeforeContent);
    this.showAtPosition = showAtPosition;
    this.showAtSecondaryPosition = showAtSecondaryPosition;
    this.initialMousePosX = anchor.initialMousePosX;
    this.initialMousePosY = anchor.initialMousePosY;
    this.shouldFocus = contentHoverComputerOptions.shouldFocus;
    this.source = contentHoverComputerOptions.source;
  }
  get domNode() {
    return this._renderedHoverParts.domNode;
  }
  get domNodeHasChildren() {
    return this._renderedHoverParts.domNodeHasChildren;
  }
  get focusedHoverPartIndex() {
    return this._renderedHoverParts.focusedHoverPartIndex;
  }
  get hoverPartsCount() {
    return this._renderedHoverParts.hoverPartsCount;
  }
  focusHoverPartWithIndex(index) {
    this._renderedHoverParts.focusHoverPartWithIndex(index);
  }
  getAccessibleWidgetContent() {
    return this._renderedHoverParts.getAccessibleContent();
  }
  getAccessibleWidgetContentAtIndex(index) {
    return this._renderedHoverParts.getAccessibleHoverContentAtIndex(index);
  }
  async updateHoverVerbosityLevel(action, index, focus) {
    this._renderedHoverParts.updateHoverVerbosityLevel(action, index, focus);
  }
  doesHoverAtIndexSupportVerbosityAction(index, action) {
    return this._renderedHoverParts.doesHoverAtIndexSupportVerbosityAction(index, action);
  }
  isColorPickerVisible() {
    return this._renderedHoverParts.isColorPickerVisible();
  }
  static computeHoverPositions(editor, anchorRange, hoverParts) {
    let startColumnBoundary = 1;
    if (editor.hasModel()) {
      const viewModel = editor._getViewModel();
      const coordinatesConverter = viewModel.coordinatesConverter;
      const anchorViewRange = coordinatesConverter.convertModelRangeToViewRange(anchorRange);
      const anchorViewMinColumn = viewModel.getLineMinColumn(anchorViewRange.startLineNumber);
      const anchorViewRangeStart = new Position(anchorViewRange.startLineNumber, anchorViewMinColumn);
      startColumnBoundary = coordinatesConverter.convertViewPositionToModelPosition(anchorViewRangeStart).column;
    }
    const anchorStartLineNumber = anchorRange.startLineNumber;
    let secondaryPositionColumn = anchorRange.startColumn;
    let forceShowAtRange;
    for (const hoverPart of hoverParts) {
      const hoverPartRange = hoverPart.range;
      const hoverPartRangeOnAnchorStartLine = hoverPartRange.startLineNumber === anchorStartLineNumber;
      const hoverPartRangeOnAnchorEndLine = hoverPartRange.endLineNumber === anchorStartLineNumber;
      const hoverPartRangeIsOnAnchorLine = hoverPartRangeOnAnchorStartLine && hoverPartRangeOnAnchorEndLine;
      if (hoverPartRangeIsOnAnchorLine) {
        const hoverPartStartColumn = hoverPartRange.startColumn;
        const minSecondaryPositionColumn = Math.min(secondaryPositionColumn, hoverPartStartColumn);
        secondaryPositionColumn = Math.max(minSecondaryPositionColumn, startColumnBoundary);
      }
      if (hoverPart.forceShowAtRange) {
        forceShowAtRange = hoverPartRange;
      }
    }
    let showAtPosition;
    let showAtSecondaryPosition;
    if (forceShowAtRange) {
      const forceShowAtPosition = forceShowAtRange.getStartPosition();
      showAtPosition = forceShowAtPosition;
      showAtSecondaryPosition = forceShowAtPosition;
    } else {
      showAtPosition = anchorRange.getStartPosition();
      showAtSecondaryPosition = new Position(anchorStartLineNumber, secondaryPositionColumn);
    }
    return {
      showAtPosition,
      showAtSecondaryPosition
    };
  }
};
RenderedContentHover = __decorateClass([
  __decorateParam(4, IKeybindingService),
  __decorateParam(5, IHoverService)
], RenderedContentHover);
class RenderedStatusBar {
  constructor(fragment, _statusBar) {
    this._statusBar = _statusBar;
    fragment.appendChild(this._statusBar.hoverElement);
  }
  get hoverElement() {
    return this._statusBar.hoverElement;
  }
  get actions() {
    return this._statusBar.actions;
  }
  dispose() {
    this._statusBar.dispose();
  }
}
let RenderedContentHoverParts = class extends Disposable {
  constructor(editor, participants, hoverParts, context, keybindingService, hoverService) {
    super();
    this._renderedParts = [];
    this._focusedHoverPartIndex = -1;
    this._context = context;
    this._fragment = document.createDocumentFragment();
    this._register(this._renderParts(participants, hoverParts, context, keybindingService, hoverService));
    this._register(this._registerListenersOnRenderedParts());
    this._register(this._createEditorDecorations(editor, hoverParts));
    this._updateMarkdownAndColorParticipantInfo(participants);
  }
  _createEditorDecorations(editor, hoverParts) {
    if (hoverParts.length === 0) {
      return Disposable.None;
    }
    let highlightRange = hoverParts[0].range;
    for (const hoverPart of hoverParts) {
      const hoverPartRange = hoverPart.range;
      highlightRange = Range.plusRange(highlightRange, hoverPartRange);
    }
    const highlightDecoration = editor.createDecorationsCollection();
    highlightDecoration.set([{
      range: highlightRange,
      options: RenderedContentHoverParts._DECORATION_OPTIONS
    }]);
    return toDisposable(() => {
      highlightDecoration.clear();
    });
  }
  _renderParts(participants, hoverParts, hoverContext, keybindingService, hoverService) {
    const statusBar = new EditorHoverStatusBar(keybindingService, hoverService);
    const hoverRenderingContext = {
      fragment: this._fragment,
      statusBar,
      ...hoverContext
    };
    const disposables = new DisposableStore();
    disposables.add(statusBar);
    for (const participant of participants) {
      const renderedHoverParts = this._renderHoverPartsForParticipant(hoverParts, participant, hoverRenderingContext);
      disposables.add(renderedHoverParts);
      for (const renderedHoverPart of renderedHoverParts.renderedHoverParts) {
        this._renderedParts.push({
          type: "hoverPart",
          participant,
          hoverPart: renderedHoverPart.hoverPart,
          hoverElement: renderedHoverPart.hoverElement
        });
      }
    }
    const renderedStatusBar = this._renderStatusBar(this._fragment, statusBar);
    if (renderedStatusBar) {
      disposables.add(renderedStatusBar);
      this._renderedParts.push({
        type: "statusBar",
        hoverElement: renderedStatusBar.hoverElement,
        actions: renderedStatusBar.actions
      });
    }
    return disposables;
  }
  _renderHoverPartsForParticipant(hoverParts, participant, hoverRenderingContext) {
    const hoverPartsForParticipant = hoverParts.filter((hoverPart) => hoverPart.owner === participant);
    const hasHoverPartsForParticipant = hoverPartsForParticipant.length > 0;
    if (!hasHoverPartsForParticipant) {
      return new RenderedHoverParts([]);
    }
    return participant.renderHoverParts(hoverRenderingContext, hoverPartsForParticipant);
  }
  _renderStatusBar(fragment, statusBar) {
    if (!statusBar.hasContent) {
      return void 0;
    }
    return new RenderedStatusBar(fragment, statusBar);
  }
  _registerListenersOnRenderedParts() {
    const disposables = new DisposableStore();
    this._renderedParts.forEach((renderedPart, index) => {
      const element = renderedPart.hoverElement;
      element.tabIndex = 0;
      disposables.add(dom.addDisposableListener(element, dom.EventType.FOCUS_IN, (event) => {
        event.stopPropagation();
        this._focusedHoverPartIndex = index;
      }));
      disposables.add(dom.addDisposableListener(element, dom.EventType.FOCUS_OUT, (event) => {
        event.stopPropagation();
        this._focusedHoverPartIndex = -1;
      }));
    });
    return disposables;
  }
  _updateMarkdownAndColorParticipantInfo(participants) {
    const markdownHoverParticipant = participants.find((p) => {
      return p instanceof MarkdownHoverParticipant && !(p instanceof InlayHintsHover);
    });
    if (markdownHoverParticipant) {
      this._markdownHoverParticipant = markdownHoverParticipant;
    }
    this._colorHoverParticipant = participants.find((p) => p instanceof HoverColorPickerParticipant);
  }
  focusHoverPartWithIndex(index) {
    if (index < 0 || index >= this._renderedParts.length) {
      return;
    }
    this._renderedParts[index].hoverElement.focus();
  }
  getAccessibleContent() {
    const content = [];
    for (let i = 0; i < this._renderedParts.length; i++) {
      content.push(this.getAccessibleHoverContentAtIndex(i));
    }
    return content.join("\n\n");
  }
  getAccessibleHoverContentAtIndex(index) {
    const renderedPart = this._renderedParts[index];
    if (!renderedPart) {
      return "";
    }
    if (renderedPart.type === "statusBar") {
      const statusBarDescription = [localize("hoverAccessibilityStatusBar", "This is a hover status bar.")];
      for (const action of renderedPart.actions) {
        const keybinding = action.actionKeybindingLabel;
        if (keybinding) {
          statusBarDescription.push(localize("hoverAccessibilityStatusBarActionWithKeybinding", "It has an action with label {0} and keybinding {1}.", action.actionLabel, keybinding));
        } else {
          statusBarDescription.push(localize("hoverAccessibilityStatusBarActionWithoutKeybinding", "It has an action with label {0}.", action.actionLabel));
        }
      }
      return statusBarDescription.join("\n");
    }
    return renderedPart.participant.getAccessibleContent(renderedPart.hoverPart);
  }
  async updateHoverVerbosityLevel(action, index, focus) {
    if (!this._markdownHoverParticipant) {
      return;
    }
    let rangeOfIndicesToUpdate;
    if (index >= 0) {
      rangeOfIndicesToUpdate = { start: index, endExclusive: index + 1 };
    } else {
      rangeOfIndicesToUpdate = this._findRangeOfMarkdownHoverParts(this._markdownHoverParticipant);
    }
    for (let i = rangeOfIndicesToUpdate.start; i < rangeOfIndicesToUpdate.endExclusive; i++) {
      const normalizedMarkdownHoverIndex = this._normalizedIndexToMarkdownHoverIndexRange(this._markdownHoverParticipant, i);
      if (normalizedMarkdownHoverIndex === void 0) {
        continue;
      }
      const renderedPart = await this._markdownHoverParticipant.updateMarkdownHoverVerbosityLevel(action, normalizedMarkdownHoverIndex);
      if (!renderedPart) {
        continue;
      }
      this._renderedParts[i] = {
        type: "hoverPart",
        participant: this._markdownHoverParticipant,
        hoverPart: renderedPart.hoverPart,
        hoverElement: renderedPart.hoverElement
      };
    }
    if (focus) {
      if (index >= 0) {
        this.focusHoverPartWithIndex(index);
      } else {
        this._context.focus();
      }
    }
    this._context.onContentsChanged();
  }
  doesHoverAtIndexSupportVerbosityAction(index, action) {
    if (!this._markdownHoverParticipant) {
      return false;
    }
    const normalizedMarkdownHoverIndex = this._normalizedIndexToMarkdownHoverIndexRange(this._markdownHoverParticipant, index);
    if (normalizedMarkdownHoverIndex === void 0) {
      return false;
    }
    return this._markdownHoverParticipant.doesMarkdownHoverAtIndexSupportVerbosityAction(normalizedMarkdownHoverIndex, action);
  }
  isColorPickerVisible() {
    return this._colorHoverParticipant?.isColorPickerVisible() ?? false;
  }
  _normalizedIndexToMarkdownHoverIndexRange(markdownHoverParticipant, index) {
    const renderedPart = this._renderedParts[index];
    if (!renderedPart || renderedPart.type !== "hoverPart") {
      return void 0;
    }
    const isHoverPartMarkdownHover = renderedPart.participant === markdownHoverParticipant;
    if (!isHoverPartMarkdownHover) {
      return void 0;
    }
    const firstIndexOfMarkdownHovers = this._renderedParts.findIndex(
      (renderedPart2) => renderedPart2.type === "hoverPart" && renderedPart2.participant === markdownHoverParticipant
    );
    if (firstIndexOfMarkdownHovers === -1) {
      throw new BugIndicatingError();
    }
    return index - firstIndexOfMarkdownHovers;
  }
  _findRangeOfMarkdownHoverParts(markdownHoverParticipant) {
    const copiedRenderedParts = this._renderedParts.slice();
    const firstIndexOfMarkdownHovers = copiedRenderedParts.findIndex((renderedPart) => renderedPart.type === "hoverPart" && renderedPart.participant === markdownHoverParticipant);
    const inversedLastIndexOfMarkdownHovers = copiedRenderedParts.reverse().findIndex((renderedPart) => renderedPart.type === "hoverPart" && renderedPart.participant === markdownHoverParticipant);
    const lastIndexOfMarkdownHovers = inversedLastIndexOfMarkdownHovers >= 0 ? copiedRenderedParts.length - inversedLastIndexOfMarkdownHovers : inversedLastIndexOfMarkdownHovers;
    return { start: firstIndexOfMarkdownHovers, endExclusive: lastIndexOfMarkdownHovers + 1 };
  }
  get domNode() {
    return this._fragment;
  }
  get domNodeHasChildren() {
    return this._fragment.hasChildNodes();
  }
  get focusedHoverPartIndex() {
    return this._focusedHoverPartIndex;
  }
  get hoverPartsCount() {
    return this._renderedParts.length;
  }
};
RenderedContentHoverParts._DECORATION_OPTIONS = ModelDecorationOptions.register({
  description: "content-hover-highlight",
  className: "hoverHighlight"
});
RenderedContentHoverParts = __decorateClass([
  __decorateParam(4, IKeybindingService),
  __decorateParam(5, IHoverService)
], RenderedContentHoverParts);
export {
  RenderedContentHover
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy9lZGl0b3IvY29udHJpYi9ob3Zlci9icm93c2VyL2NvbnRlbnRIb3ZlclJlbmRlcmVkLnRzIl0sCiAgInNvdXJjZXNDb250ZW50IjogWyIvKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuICogIENvcHlyaWdodCAoYykgTWljcm9zb2Z0IENvcnBvcmF0aW9uLiBBbGwgcmlnaHRzIHJlc2VydmVkLlxuICogIExpY2Vuc2VkIHVuZGVyIHRoZSBNSVQgTGljZW5zZS4gU2VlIExpY2Vuc2UudHh0IGluIHRoZSBwcm9qZWN0IHJvb3QgZm9yIGxpY2Vuc2UgaW5mb3JtYXRpb24uXG4gKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tKi9cblxuaW1wb3J0IHsgSUVkaXRvckhvdmVyQ29udGV4dCwgSUVkaXRvckhvdmVyUGFydGljaXBhbnQsIElFZGl0b3JIb3ZlclJlbmRlckNvbnRleHQsIElIb3ZlclBhcnQsIElSZW5kZXJlZEhvdmVyUGFydHMsIFJlbmRlcmVkSG92ZXJQYXJ0cyB9IGZyb20gJy4vaG92ZXJUeXBlcy5qcyc7XG5pbXBvcnQgeyBEaXNwb3NhYmxlLCBEaXNwb3NhYmxlU3RvcmUsIElEaXNwb3NhYmxlLCB0b0Rpc3Bvc2FibGUgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9saWZlY3ljbGUuanMnO1xuaW1wb3J0IHsgRWRpdG9ySG92ZXJTdGF0dXNCYXIgfSBmcm9tICcuL2NvbnRlbnRIb3ZlclN0YXR1c0Jhci5qcyc7XG5pbXBvcnQgeyBIb3ZlclN0YXJ0U291cmNlIH0gZnJvbSAnLi9ob3Zlck9wZXJhdGlvbi5qcyc7XG5pbXBvcnQgeyBJS2V5YmluZGluZ1NlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9rZXliaW5kaW5nL2NvbW1vbi9rZXliaW5kaW5nLmpzJztcbmltcG9ydCB7IE1vZGVsRGVjb3JhdGlvbk9wdGlvbnMgfSBmcm9tICcuLi8uLi8uLi9jb21tb24vbW9kZWwvdGV4dE1vZGVsLmpzJztcbmltcG9ydCB7IElDb2RlRWRpdG9yIH0gZnJvbSAnLi4vLi4vLi4vYnJvd3Nlci9lZGl0b3JCcm93c2VyLmpzJztcbmltcG9ydCB7IFBvc2l0aW9uIH0gZnJvbSAnLi4vLi4vLi4vY29tbW9uL2NvcmUvcG9zaXRpb24uanMnO1xuaW1wb3J0IHsgUmFuZ2UgfSBmcm9tICcuLi8uLi8uLi9jb21tb24vY29yZS9yYW5nZS5qcyc7XG5pbXBvcnQgeyBDb250ZW50SG92ZXJSZXN1bHQgfSBmcm9tICcuL2NvbnRlbnRIb3ZlclR5cGVzLmpzJztcbmltcG9ydCAqIGFzIGRvbSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2Jyb3dzZXIvZG9tLmpzJztcbmltcG9ydCB7IEhvdmVyVmVyYm9zaXR5QWN0aW9uIH0gZnJvbSAnLi4vLi4vLi4vY29tbW9uL2xhbmd1YWdlcy5qcyc7XG5pbXBvcnQgeyBNYXJrZG93bkhvdmVyUGFydGljaXBhbnQgfSBmcm9tICcuL21hcmtkb3duSG92ZXJQYXJ0aWNpcGFudC5qcyc7XG5pbXBvcnQgeyBIb3ZlckNvbG9yUGlja2VyUGFydGljaXBhbnQgfSBmcm9tICcuLi8uLi9jb2xvclBpY2tlci9icm93c2VyL2hvdmVyQ29sb3JQaWNrZXIvaG92ZXJDb2xvclBpY2tlclBhcnRpY2lwYW50LmpzJztcbmltcG9ydCB7IGxvY2FsaXplIH0gZnJvbSAnLi4vLi4vLi4vLi4vbmxzLmpzJztcbmltcG9ydCB7IElubGF5SGludHNIb3ZlciB9IGZyb20gJy4uLy4uL2lubGF5SGludHMvYnJvd3Nlci9pbmxheUhpbnRzSG92ZXIuanMnO1xuaW1wb3J0IHsgQnVnSW5kaWNhdGluZ0Vycm9yIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vZXJyb3JzLmpzJztcbmltcG9ydCB7IEhvdmVyQWN0aW9uIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9icm93c2VyL3VpL2hvdmVyL2hvdmVyV2lkZ2V0LmpzJztcbmltcG9ydCB7IElIb3ZlclNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9ob3Zlci9icm93c2VyL2hvdmVyLmpzJztcbmltcG9ydCB7IElPZmZzZXRSYW5nZSB9IGZyb20gJy4uLy4uLy4uL2NvbW1vbi9jb3JlL29mZnNldFJhbmdlLmpzJztcblxuZXhwb3J0IGNsYXNzIFJlbmRlcmVkQ29udGVudEhvdmVyIGV4dGVuZHMgRGlzcG9zYWJsZSB7XG5cblx0cHVibGljIGNsb3Nlc3RNb3VzZURpc3RhbmNlOiBudW1iZXIgfCB1bmRlZmluZWQ7XG5cdHB1YmxpYyBpbml0aWFsTW91c2VQb3NYOiBudW1iZXIgfCB1bmRlZmluZWQ7XG5cdHB1YmxpYyBpbml0aWFsTW91c2VQb3NZOiBudW1iZXIgfCB1bmRlZmluZWQ7XG5cblx0cHVibGljIHJlYWRvbmx5IHNob3dBdFBvc2l0aW9uOiBQb3NpdGlvbjtcblx0cHVibGljIHJlYWRvbmx5IHNob3dBdFNlY29uZGFyeVBvc2l0aW9uOiBQb3NpdGlvbjtcblx0cHVibGljIHJlYWRvbmx5IHNob3VsZEZvY3VzOiBib29sZWFuO1xuXHRwdWJsaWMgcmVhZG9ubHkgc291cmNlOiBIb3ZlclN0YXJ0U291cmNlO1xuXHRwdWJsaWMgcmVhZG9ubHkgc2hvdWxkQXBwZWFyQmVmb3JlQ29udGVudDogYm9vbGVhbjtcblxuXHRwcml2YXRlIHJlYWRvbmx5IF9yZW5kZXJlZEhvdmVyUGFydHM6IFJlbmRlcmVkQ29udGVudEhvdmVyUGFydHM7XG5cblx0Y29uc3RydWN0b3IoXG5cdFx0ZWRpdG9yOiBJQ29kZUVkaXRvcixcblx0XHRob3ZlclJlc3VsdDogQ29udGVudEhvdmVyUmVzdWx0LFxuXHRcdHBhcnRpY2lwYW50czogSUVkaXRvckhvdmVyUGFydGljaXBhbnQ8SUhvdmVyUGFydD5bXSxcblx0XHRjb250ZXh0OiBJRWRpdG9ySG92ZXJDb250ZXh0LFxuXHRcdEBJS2V5YmluZGluZ1NlcnZpY2Uga2V5YmluZGluZ1NlcnZpY2U6IElLZXliaW5kaW5nU2VydmljZSxcblx0XHRASUhvdmVyU2VydmljZSBob3ZlclNlcnZpY2U6IElIb3ZlclNlcnZpY2Vcblx0KSB7XG5cdFx0c3VwZXIoKTtcblx0XHRjb25zdCBwYXJ0cyA9IGhvdmVyUmVzdWx0LmhvdmVyUGFydHM7XG5cdFx0dGhpcy5fcmVuZGVyZWRIb3ZlclBhcnRzID0gdGhpcy5fcmVnaXN0ZXIobmV3IFJlbmRlcmVkQ29udGVudEhvdmVyUGFydHMoXG5cdFx0XHRlZGl0b3IsXG5cdFx0XHRwYXJ0aWNpcGFudHMsXG5cdFx0XHRwYXJ0cyxcblx0XHRcdGNvbnRleHQsXG5cdFx0XHRrZXliaW5kaW5nU2VydmljZSxcblx0XHRcdGhvdmVyU2VydmljZVxuXHRcdCkpO1xuXHRcdGNvbnN0IGNvbnRlbnRIb3ZlckNvbXB1dGVyT3B0aW9ucyA9IGhvdmVyUmVzdWx0Lm9wdGlvbnM7XG5cdFx0Y29uc3QgYW5jaG9yID0gY29udGVudEhvdmVyQ29tcHV0ZXJPcHRpb25zLmFuY2hvcjtcblx0XHRjb25zdCB7IHNob3dBdFBvc2l0aW9uLCBzaG93QXRTZWNvbmRhcnlQb3NpdGlvbiB9ID0gUmVuZGVyZWRDb250ZW50SG92ZXIuY29tcHV0ZUhvdmVyUG9zaXRpb25zKGVkaXRvciwgYW5jaG9yLnJhbmdlLCBwYXJ0cyk7XG5cdFx0dGhpcy5zaG91bGRBcHBlYXJCZWZvcmVDb250ZW50ID0gcGFydHMuc29tZShtID0+IG0uaXNCZWZvcmVDb250ZW50KTtcblx0XHR0aGlzLnNob3dBdFBvc2l0aW9uID0gc2hvd0F0UG9zaXRpb247XG5cdFx0dGhpcy5zaG93QXRTZWNvbmRhcnlQb3NpdGlvbiA9IHNob3dBdFNlY29uZGFyeVBvc2l0aW9uO1xuXHRcdHRoaXMuaW5pdGlhbE1vdXNlUG9zWCA9IGFuY2hvci5pbml0aWFsTW91c2VQb3NYO1xuXHRcdHRoaXMuaW5pdGlhbE1vdXNlUG9zWSA9IGFuY2hvci5pbml0aWFsTW91c2VQb3NZO1xuXHRcdHRoaXMuc2hvdWxkRm9jdXMgPSBjb250ZW50SG92ZXJDb21wdXRlck9wdGlvbnMuc2hvdWxkRm9jdXM7XG5cdFx0dGhpcy5zb3VyY2UgPSBjb250ZW50SG92ZXJDb21wdXRlck9wdGlvbnMuc291cmNlO1xuXHR9XG5cblx0cHVibGljIGdldCBkb21Ob2RlKCk6IERvY3VtZW50RnJhZ21lbnQge1xuXHRcdHJldHVybiB0aGlzLl9yZW5kZXJlZEhvdmVyUGFydHMuZG9tTm9kZTtcblx0fVxuXG5cdHB1YmxpYyBnZXQgZG9tTm9kZUhhc0NoaWxkcmVuKCk6IGJvb2xlYW4ge1xuXHRcdHJldHVybiB0aGlzLl9yZW5kZXJlZEhvdmVyUGFydHMuZG9tTm9kZUhhc0NoaWxkcmVuO1xuXHR9XG5cblx0cHVibGljIGdldCBmb2N1c2VkSG92ZXJQYXJ0SW5kZXgoKTogbnVtYmVyIHtcblx0XHRyZXR1cm4gdGhpcy5fcmVuZGVyZWRIb3ZlclBhcnRzLmZvY3VzZWRIb3ZlclBhcnRJbmRleDtcblx0fVxuXG5cdHB1YmxpYyBnZXQgaG92ZXJQYXJ0c0NvdW50KCk6IG51bWJlciB7XG5cdFx0cmV0dXJuIHRoaXMuX3JlbmRlcmVkSG92ZXJQYXJ0cy5ob3ZlclBhcnRzQ291bnQ7XG5cdH1cblxuXHRwdWJsaWMgZm9jdXNIb3ZlclBhcnRXaXRoSW5kZXgoaW5kZXg6IG51bWJlcik6IHZvaWQge1xuXHRcdHRoaXMuX3JlbmRlcmVkSG92ZXJQYXJ0cy5mb2N1c0hvdmVyUGFydFdpdGhJbmRleChpbmRleCk7XG5cdH1cblxuXHRwdWJsaWMgZ2V0QWNjZXNzaWJsZVdpZGdldENvbnRlbnQoKTogc3RyaW5nIHtcblx0XHRyZXR1cm4gdGhpcy5fcmVuZGVyZWRIb3ZlclBhcnRzLmdldEFjY2Vzc2libGVDb250ZW50KCk7XG5cdH1cblxuXHRwdWJsaWMgZ2V0QWNjZXNzaWJsZVdpZGdldENvbnRlbnRBdEluZGV4KGluZGV4OiBudW1iZXIpOiBzdHJpbmcge1xuXHRcdHJldHVybiB0aGlzLl9yZW5kZXJlZEhvdmVyUGFydHMuZ2V0QWNjZXNzaWJsZUhvdmVyQ29udGVudEF0SW5kZXgoaW5kZXgpO1xuXHR9XG5cblx0cHVibGljIGFzeW5jIHVwZGF0ZUhvdmVyVmVyYm9zaXR5TGV2ZWwoYWN0aW9uOiBIb3ZlclZlcmJvc2l0eUFjdGlvbiwgaW5kZXg6IG51bWJlciwgZm9jdXM/OiBib29sZWFuKTogUHJvbWlzZTx2b2lkPiB7XG5cdFx0dGhpcy5fcmVuZGVyZWRIb3ZlclBhcnRzLnVwZGF0ZUhvdmVyVmVyYm9zaXR5TGV2ZWwoYWN0aW9uLCBpbmRleCwgZm9jdXMpO1xuXHR9XG5cblx0cHVibGljIGRvZXNIb3ZlckF0SW5kZXhTdXBwb3J0VmVyYm9zaXR5QWN0aW9uKGluZGV4OiBudW1iZXIsIGFjdGlvbjogSG92ZXJWZXJib3NpdHlBY3Rpb24pOiBib29sZWFuIHtcblx0XHRyZXR1cm4gdGhpcy5fcmVuZGVyZWRIb3ZlclBhcnRzLmRvZXNIb3ZlckF0SW5kZXhTdXBwb3J0VmVyYm9zaXR5QWN0aW9uKGluZGV4LCBhY3Rpb24pO1xuXHR9XG5cblx0cHVibGljIGlzQ29sb3JQaWNrZXJWaXNpYmxlKCk6IGJvb2xlYW4ge1xuXHRcdHJldHVybiB0aGlzLl9yZW5kZXJlZEhvdmVyUGFydHMuaXNDb2xvclBpY2tlclZpc2libGUoKTtcblx0fVxuXG5cdHB1YmxpYyBzdGF0aWMgY29tcHV0ZUhvdmVyUG9zaXRpb25zKGVkaXRvcjogSUNvZGVFZGl0b3IsIGFuY2hvclJhbmdlOiBSYW5nZSwgaG92ZXJQYXJ0czogSUhvdmVyUGFydFtdKTogeyBzaG93QXRQb3NpdGlvbjogUG9zaXRpb247IHNob3dBdFNlY29uZGFyeVBvc2l0aW9uOiBQb3NpdGlvbiB9IHtcblxuXHRcdGxldCBzdGFydENvbHVtbkJvdW5kYXJ5ID0gMTtcblx0XHRpZiAoZWRpdG9yLmhhc01vZGVsKCkpIHtcblx0XHRcdC8vIEVuc3VyZSB0aGUgcmFuZ2UgaXMgb24gdGhlIGN1cnJlbnQgdmlldyBsaW5lXG5cdFx0XHRjb25zdCB2aWV3TW9kZWwgPSBlZGl0b3IuX2dldFZpZXdNb2RlbCgpO1xuXHRcdFx0Y29uc3QgY29vcmRpbmF0ZXNDb252ZXJ0ZXIgPSB2aWV3TW9kZWwuY29vcmRpbmF0ZXNDb252ZXJ0ZXI7XG5cdFx0XHRjb25zdCBhbmNob3JWaWV3UmFuZ2UgPSBjb29yZGluYXRlc0NvbnZlcnRlci5jb252ZXJ0TW9kZWxSYW5nZVRvVmlld1JhbmdlKGFuY2hvclJhbmdlKTtcblx0XHRcdGNvbnN0IGFuY2hvclZpZXdNaW5Db2x1bW4gPSB2aWV3TW9kZWwuZ2V0TGluZU1pbkNvbHVtbihhbmNob3JWaWV3UmFuZ2Uuc3RhcnRMaW5lTnVtYmVyKTtcblx0XHRcdGNvbnN0IGFuY2hvclZpZXdSYW5nZVN0YXJ0ID0gbmV3IFBvc2l0aW9uKGFuY2hvclZpZXdSYW5nZS5zdGFydExpbmVOdW1iZXIsIGFuY2hvclZpZXdNaW5Db2x1bW4pO1xuXHRcdFx0c3RhcnRDb2x1bW5Cb3VuZGFyeSA9IGNvb3JkaW5hdGVzQ29udmVydGVyLmNvbnZlcnRWaWV3UG9zaXRpb25Ub01vZGVsUG9zaXRpb24oYW5jaG9yVmlld1JhbmdlU3RhcnQpLmNvbHVtbjtcblx0XHR9XG5cblx0XHQvLyBUaGUgYW5jaG9yIHJhbmdlIGlzIGFsd2F5cyBvbiBhIHNpbmdsZSBsaW5lXG5cdFx0Y29uc3QgYW5jaG9yU3RhcnRMaW5lTnVtYmVyID0gYW5jaG9yUmFuZ2Uuc3RhcnRMaW5lTnVtYmVyO1xuXHRcdGxldCBzZWNvbmRhcnlQb3NpdGlvbkNvbHVtbiA9IGFuY2hvclJhbmdlLnN0YXJ0Q29sdW1uO1xuXHRcdGxldCBmb3JjZVNob3dBdFJhbmdlOiBSYW5nZSB8IHVuZGVmaW5lZDtcblxuXHRcdGZvciAoY29uc3QgaG92ZXJQYXJ0IG9mIGhvdmVyUGFydHMpIHtcblx0XHRcdGNvbnN0IGhvdmVyUGFydFJhbmdlID0gaG92ZXJQYXJ0LnJhbmdlO1xuXHRcdFx0Y29uc3QgaG92ZXJQYXJ0UmFuZ2VPbkFuY2hvclN0YXJ0TGluZSA9IGhvdmVyUGFydFJhbmdlLnN0YXJ0TGluZU51bWJlciA9PT0gYW5jaG9yU3RhcnRMaW5lTnVtYmVyO1xuXHRcdFx0Y29uc3QgaG92ZXJQYXJ0UmFuZ2VPbkFuY2hvckVuZExpbmUgPSBob3ZlclBhcnRSYW5nZS5lbmRMaW5lTnVtYmVyID09PSBhbmNob3JTdGFydExpbmVOdW1iZXI7XG5cdFx0XHRjb25zdCBob3ZlclBhcnRSYW5nZUlzT25BbmNob3JMaW5lID0gaG92ZXJQYXJ0UmFuZ2VPbkFuY2hvclN0YXJ0TGluZSAmJiBob3ZlclBhcnRSYW5nZU9uQW5jaG9yRW5kTGluZTtcblx0XHRcdGlmIChob3ZlclBhcnRSYW5nZUlzT25BbmNob3JMaW5lKSB7XG5cdFx0XHRcdC8vIHRoaXMgbWVzc2FnZSBoYXMgYSByYW5nZSB0aGF0IGlzIGNvbXBsZXRlbHkgc2l0dGluZyBvbiB0aGUgbGluZSBvZiB0aGUgYW5jaG9yXG5cdFx0XHRcdGNvbnN0IGhvdmVyUGFydFN0YXJ0Q29sdW1uID0gaG92ZXJQYXJ0UmFuZ2Uuc3RhcnRDb2x1bW47XG5cdFx0XHRcdGNvbnN0IG1pblNlY29uZGFyeVBvc2l0aW9uQ29sdW1uID0gTWF0aC5taW4oc2Vjb25kYXJ5UG9zaXRpb25Db2x1bW4sIGhvdmVyUGFydFN0YXJ0Q29sdW1uKTtcblx0XHRcdFx0c2Vjb25kYXJ5UG9zaXRpb25Db2x1bW4gPSBNYXRoLm1heChtaW5TZWNvbmRhcnlQb3NpdGlvbkNvbHVtbiwgc3RhcnRDb2x1bW5Cb3VuZGFyeSk7XG5cdFx0XHR9XG5cdFx0XHRpZiAoaG92ZXJQYXJ0LmZvcmNlU2hvd0F0UmFuZ2UpIHtcblx0XHRcdFx0Zm9yY2VTaG93QXRSYW5nZSA9IGhvdmVyUGFydFJhbmdlO1xuXHRcdFx0fVxuXHRcdH1cblxuXHRcdGxldCBzaG93QXRQb3NpdGlvbjogUG9zaXRpb247XG5cdFx0bGV0IHNob3dBdFNlY29uZGFyeVBvc2l0aW9uOiBQb3NpdGlvbjtcblx0XHRpZiAoZm9yY2VTaG93QXRSYW5nZSkge1xuXHRcdFx0Y29uc3QgZm9yY2VTaG93QXRQb3NpdGlvbiA9IGZvcmNlU2hvd0F0UmFuZ2UuZ2V0U3RhcnRQb3NpdGlvbigpO1xuXHRcdFx0c2hvd0F0UG9zaXRpb24gPSBmb3JjZVNob3dBdFBvc2l0aW9uO1xuXHRcdFx0c2hvd0F0U2Vjb25kYXJ5UG9zaXRpb24gPSBmb3JjZVNob3dBdFBvc2l0aW9uO1xuXHRcdH0gZWxzZSB7XG5cdFx0XHRzaG93QXRQb3NpdGlvbiA9IGFuY2hvclJhbmdlLmdldFN0YXJ0UG9zaXRpb24oKTtcblx0XHRcdHNob3dBdFNlY29uZGFyeVBvc2l0aW9uID0gbmV3IFBvc2l0aW9uKGFuY2hvclN0YXJ0TGluZU51bWJlciwgc2Vjb25kYXJ5UG9zaXRpb25Db2x1bW4pO1xuXHRcdH1cblx0XHRyZXR1cm4ge1xuXHRcdFx0c2hvd0F0UG9zaXRpb24sXG5cdFx0XHRzaG93QXRTZWNvbmRhcnlQb3NpdGlvbixcblx0XHR9O1xuXHR9XG59XG5cbmludGVyZmFjZSBJUmVuZGVyZWRDb250ZW50SG92ZXJQYXJ0IHtcblx0LyoqXG5cdCAqIFR5cGUgb2YgcmVuZGVyZWQgcGFydFxuXHQgKi9cblx0dHlwZTogJ2hvdmVyUGFydCc7XG5cdC8qKlxuXHQgKiBQYXJ0aWNpcGFudCBvZiB0aGUgcmVuZGVyZWQgaG92ZXIgcGFydFxuXHQgKi9cblx0cGFydGljaXBhbnQ6IElFZGl0b3JIb3ZlclBhcnRpY2lwYW50PElIb3ZlclBhcnQ+O1xuXHQvKipcblx0ICogVGhlIHJlbmRlcmVkIGhvdmVyIHBhcnRcblx0ICovXG5cdGhvdmVyUGFydDogSUhvdmVyUGFydDtcblx0LyoqXG5cdCAqIFRoZSBIVE1MIGVsZW1lbnQgY29udGFpbmluZyB0aGUgaG92ZXIgc3RhdHVzIGJhci5cblx0ICovXG5cdGhvdmVyRWxlbWVudDogSFRNTEVsZW1lbnQ7XG59XG5cbmludGVyZmFjZSBJUmVuZGVyZWRDb250ZW50U3RhdHVzQmFyIHtcblx0LyoqXG5cdCAqIFR5cGUgb2YgcmVuZGVyZWQgcGFydFxuXHQgKi9cblx0dHlwZTogJ3N0YXR1c0Jhcic7XG5cdC8qKlxuXHQgKiBUaGUgSFRNTCBlbGVtZW50IGNvbnRhaW5pbmcgdGhlIGhvdmVyIHN0YXR1cyBiYXIuXG5cdCAqL1xuXHRob3ZlckVsZW1lbnQ6IEhUTUxFbGVtZW50O1xuXHQvKipcblx0ICogVGhlIGFjdGlvbnMgb2YgdGhlIGhvdmVyIHN0YXR1cyBiYXIuXG5cdCAqL1xuXHRhY3Rpb25zOiBIb3ZlckFjdGlvbltdO1xufVxuXG50eXBlIElSZW5kZXJlZENvbnRlbnRIb3ZlclBhcnRPclN0YXR1c0JhciA9IElSZW5kZXJlZENvbnRlbnRIb3ZlclBhcnQgfCBJUmVuZGVyZWRDb250ZW50U3RhdHVzQmFyO1xuXG5jbGFzcyBSZW5kZXJlZFN0YXR1c0JhciBpbXBsZW1lbnRzIElEaXNwb3NhYmxlIHtcblxuXHRjb25zdHJ1Y3RvcihmcmFnbWVudDogRG9jdW1lbnRGcmFnbWVudCwgcHJpdmF0ZSByZWFkb25seSBfc3RhdHVzQmFyOiBFZGl0b3JIb3ZlclN0YXR1c0Jhcikge1xuXHRcdGZyYWdtZW50LmFwcGVuZENoaWxkKHRoaXMuX3N0YXR1c0Jhci5ob3ZlckVsZW1lbnQpO1xuXHR9XG5cblx0Z2V0IGhvdmVyRWxlbWVudCgpOiBIVE1MRWxlbWVudCB7XG5cdFx0cmV0dXJuIHRoaXMuX3N0YXR1c0Jhci5ob3ZlckVsZW1lbnQ7XG5cdH1cblxuXHRnZXQgYWN0aW9ucygpOiBIb3ZlckFjdGlvbltdIHtcblx0XHRyZXR1cm4gdGhpcy5fc3RhdHVzQmFyLmFjdGlvbnM7XG5cdH1cblxuXHRkaXNwb3NlKCkge1xuXHRcdHRoaXMuX3N0YXR1c0Jhci5kaXNwb3NlKCk7XG5cdH1cbn1cblxuY2xhc3MgUmVuZGVyZWRDb250ZW50SG92ZXJQYXJ0cyBleHRlbmRzIERpc3Bvc2FibGUge1xuXG5cdHByaXZhdGUgc3RhdGljIHJlYWRvbmx5IF9ERUNPUkFUSU9OX09QVElPTlMgPSBNb2RlbERlY29yYXRpb25PcHRpb25zLnJlZ2lzdGVyKHtcblx0XHRkZXNjcmlwdGlvbjogJ2NvbnRlbnQtaG92ZXItaGlnaGxpZ2h0Jyxcblx0XHRjbGFzc05hbWU6ICdob3ZlckhpZ2hsaWdodCdcblx0fSk7XG5cblx0cHJpdmF0ZSByZWFkb25seSBfcmVuZGVyZWRQYXJ0czogSVJlbmRlcmVkQ29udGVudEhvdmVyUGFydE9yU3RhdHVzQmFyW10gPSBbXTtcblx0cHJpdmF0ZSByZWFkb25seSBfZnJhZ21lbnQ6IERvY3VtZW50RnJhZ21lbnQ7XG5cdHByaXZhdGUgcmVhZG9ubHkgX2NvbnRleHQ6IElFZGl0b3JIb3ZlckNvbnRleHQ7XG5cblx0cHJpdmF0ZSBfbWFya2Rvd25Ib3ZlclBhcnRpY2lwYW50OiBNYXJrZG93bkhvdmVyUGFydGljaXBhbnQgfCB1bmRlZmluZWQ7XG5cdHByaXZhdGUgX2NvbG9ySG92ZXJQYXJ0aWNpcGFudDogSG92ZXJDb2xvclBpY2tlclBhcnRpY2lwYW50IHwgdW5kZWZpbmVkO1xuXHRwcml2YXRlIF9mb2N1c2VkSG92ZXJQYXJ0SW5kZXg6IG51bWJlciA9IC0xO1xuXG5cdGNvbnN0cnVjdG9yKFxuXHRcdGVkaXRvcjogSUNvZGVFZGl0b3IsXG5cdFx0cGFydGljaXBhbnRzOiBJRWRpdG9ySG92ZXJQYXJ0aWNpcGFudDxJSG92ZXJQYXJ0PltdLFxuXHRcdGhvdmVyUGFydHM6IElIb3ZlclBhcnRbXSxcblx0XHRjb250ZXh0OiBJRWRpdG9ySG92ZXJDb250ZXh0LFxuXHRcdEBJS2V5YmluZGluZ1NlcnZpY2Uga2V5YmluZGluZ1NlcnZpY2U6IElLZXliaW5kaW5nU2VydmljZSxcblx0XHRASUhvdmVyU2VydmljZSBob3ZlclNlcnZpY2U6IElIb3ZlclNlcnZpY2Vcblx0KSB7XG5cdFx0c3VwZXIoKTtcblx0XHR0aGlzLl9jb250ZXh0ID0gY29udGV4dDtcblx0XHR0aGlzLl9mcmFnbWVudCA9IGRvY3VtZW50LmNyZWF0ZURvY3VtZW50RnJhZ21lbnQoKTtcblx0XHR0aGlzLl9yZWdpc3Rlcih0aGlzLl9yZW5kZXJQYXJ0cyhwYXJ0aWNpcGFudHMsIGhvdmVyUGFydHMsIGNvbnRleHQsIGtleWJpbmRpbmdTZXJ2aWNlLCBob3ZlclNlcnZpY2UpKTtcblx0XHR0aGlzLl9yZWdpc3Rlcih0aGlzLl9yZWdpc3Rlckxpc3RlbmVyc09uUmVuZGVyZWRQYXJ0cygpKTtcblx0XHR0aGlzLl9yZWdpc3Rlcih0aGlzLl9jcmVhdGVFZGl0b3JEZWNvcmF0aW9ucyhlZGl0b3IsIGhvdmVyUGFydHMpKTtcblx0XHR0aGlzLl91cGRhdGVNYXJrZG93bkFuZENvbG9yUGFydGljaXBhbnRJbmZvKHBhcnRpY2lwYW50cyk7XG5cdH1cblxuXHRwcml2YXRlIF9jcmVhdGVFZGl0b3JEZWNvcmF0aW9ucyhlZGl0b3I6IElDb2RlRWRpdG9yLCBob3ZlclBhcnRzOiBJSG92ZXJQYXJ0W10pOiBJRGlzcG9zYWJsZSB7XG5cdFx0aWYgKGhvdmVyUGFydHMubGVuZ3RoID09PSAwKSB7XG5cdFx0XHRyZXR1cm4gRGlzcG9zYWJsZS5Ob25lO1xuXHRcdH1cblx0XHRsZXQgaGlnaGxpZ2h0UmFuZ2UgPSBob3ZlclBhcnRzWzBdLnJhbmdlO1xuXHRcdGZvciAoY29uc3QgaG92ZXJQYXJ0IG9mIGhvdmVyUGFydHMpIHtcblx0XHRcdGNvbnN0IGhvdmVyUGFydFJhbmdlID0gaG92ZXJQYXJ0LnJhbmdlO1xuXHRcdFx0aGlnaGxpZ2h0UmFuZ2UgPSBSYW5nZS5wbHVzUmFuZ2UoaGlnaGxpZ2h0UmFuZ2UsIGhvdmVyUGFydFJhbmdlKTtcblx0XHR9XG5cdFx0Y29uc3QgaGlnaGxpZ2h0RGVjb3JhdGlvbiA9IGVkaXRvci5jcmVhdGVEZWNvcmF0aW9uc0NvbGxlY3Rpb24oKTtcblx0XHRoaWdobGlnaHREZWNvcmF0aW9uLnNldChbe1xuXHRcdFx0cmFuZ2U6IGhpZ2hsaWdodFJhbmdlLFxuXHRcdFx0b3B0aW9uczogUmVuZGVyZWRDb250ZW50SG92ZXJQYXJ0cy5fREVDT1JBVElPTl9PUFRJT05TXG5cdFx0fV0pO1xuXHRcdHJldHVybiB0b0Rpc3Bvc2FibGUoKCkgPT4ge1xuXHRcdFx0aGlnaGxpZ2h0RGVjb3JhdGlvbi5jbGVhcigpO1xuXHRcdH0pO1xuXHR9XG5cblx0cHJpdmF0ZSBfcmVuZGVyUGFydHMocGFydGljaXBhbnRzOiBJRWRpdG9ySG92ZXJQYXJ0aWNpcGFudDxJSG92ZXJQYXJ0PltdLCBob3ZlclBhcnRzOiBJSG92ZXJQYXJ0W10sIGhvdmVyQ29udGV4dDogSUVkaXRvckhvdmVyQ29udGV4dCwga2V5YmluZGluZ1NlcnZpY2U6IElLZXliaW5kaW5nU2VydmljZSwgaG92ZXJTZXJ2aWNlOiBJSG92ZXJTZXJ2aWNlKTogSURpc3Bvc2FibGUge1xuXHRcdGNvbnN0IHN0YXR1c0JhciA9IG5ldyBFZGl0b3JIb3ZlclN0YXR1c0JhcihrZXliaW5kaW5nU2VydmljZSwgaG92ZXJTZXJ2aWNlKTtcblx0XHRjb25zdCBob3ZlclJlbmRlcmluZ0NvbnRleHQ6IElFZGl0b3JIb3ZlclJlbmRlckNvbnRleHQgPSB7XG5cdFx0XHRmcmFnbWVudDogdGhpcy5fZnJhZ21lbnQsXG5cdFx0XHRzdGF0dXNCYXIsXG5cdFx0XHQuLi5ob3ZlckNvbnRleHRcblx0XHR9O1xuXHRcdGNvbnN0IGRpc3Bvc2FibGVzID0gbmV3IERpc3Bvc2FibGVTdG9yZSgpO1xuXHRcdGRpc3Bvc2FibGVzLmFkZChzdGF0dXNCYXIpO1xuXHRcdGZvciAoY29uc3QgcGFydGljaXBhbnQgb2YgcGFydGljaXBhbnRzKSB7XG5cdFx0XHRjb25zdCByZW5kZXJlZEhvdmVyUGFydHMgPSB0aGlzLl9yZW5kZXJIb3ZlclBhcnRzRm9yUGFydGljaXBhbnQoaG92ZXJQYXJ0cywgcGFydGljaXBhbnQsIGhvdmVyUmVuZGVyaW5nQ29udGV4dCk7XG5cdFx0XHRkaXNwb3NhYmxlcy5hZGQocmVuZGVyZWRIb3ZlclBhcnRzKTtcblx0XHRcdGZvciAoY29uc3QgcmVuZGVyZWRIb3ZlclBhcnQgb2YgcmVuZGVyZWRIb3ZlclBhcnRzLnJlbmRlcmVkSG92ZXJQYXJ0cykge1xuXHRcdFx0XHR0aGlzLl9yZW5kZXJlZFBhcnRzLnB1c2goe1xuXHRcdFx0XHRcdHR5cGU6ICdob3ZlclBhcnQnLFxuXHRcdFx0XHRcdHBhcnRpY2lwYW50LFxuXHRcdFx0XHRcdGhvdmVyUGFydDogcmVuZGVyZWRIb3ZlclBhcnQuaG92ZXJQYXJ0LFxuXHRcdFx0XHRcdGhvdmVyRWxlbWVudDogcmVuZGVyZWRIb3ZlclBhcnQuaG92ZXJFbGVtZW50LFxuXHRcdFx0XHR9KTtcblx0XHRcdH1cblx0XHR9XG5cdFx0Y29uc3QgcmVuZGVyZWRTdGF0dXNCYXIgPSB0aGlzLl9yZW5kZXJTdGF0dXNCYXIodGhpcy5fZnJhZ21lbnQsIHN0YXR1c0Jhcik7XG5cdFx0aWYgKHJlbmRlcmVkU3RhdHVzQmFyKSB7XG5cdFx0XHRkaXNwb3NhYmxlcy5hZGQocmVuZGVyZWRTdGF0dXNCYXIpO1xuXHRcdFx0dGhpcy5fcmVuZGVyZWRQYXJ0cy5wdXNoKHtcblx0XHRcdFx0dHlwZTogJ3N0YXR1c0JhcicsXG5cdFx0XHRcdGhvdmVyRWxlbWVudDogcmVuZGVyZWRTdGF0dXNCYXIuaG92ZXJFbGVtZW50LFxuXHRcdFx0XHRhY3Rpb25zOiByZW5kZXJlZFN0YXR1c0Jhci5hY3Rpb25zLFxuXHRcdFx0fSk7XG5cdFx0fVxuXHRcdHJldHVybiBkaXNwb3NhYmxlcztcblx0fVxuXG5cdHByaXZhdGUgX3JlbmRlckhvdmVyUGFydHNGb3JQYXJ0aWNpcGFudChob3ZlclBhcnRzOiBJSG92ZXJQYXJ0W10sIHBhcnRpY2lwYW50OiBJRWRpdG9ySG92ZXJQYXJ0aWNpcGFudDxJSG92ZXJQYXJ0PiwgaG92ZXJSZW5kZXJpbmdDb250ZXh0OiBJRWRpdG9ySG92ZXJSZW5kZXJDb250ZXh0KTogSVJlbmRlcmVkSG92ZXJQYXJ0czxJSG92ZXJQYXJ0PiB7XG5cdFx0Y29uc3QgaG92ZXJQYXJ0c0ZvclBhcnRpY2lwYW50ID0gaG92ZXJQYXJ0cy5maWx0ZXIoaG92ZXJQYXJ0ID0+IGhvdmVyUGFydC5vd25lciA9PT0gcGFydGljaXBhbnQpO1xuXHRcdGNvbnN0IGhhc0hvdmVyUGFydHNGb3JQYXJ0aWNpcGFudCA9IGhvdmVyUGFydHNGb3JQYXJ0aWNpcGFudC5sZW5ndGggPiAwO1xuXHRcdGlmICghaGFzSG92ZXJQYXJ0c0ZvclBhcnRpY2lwYW50KSB7XG5cdFx0XHRyZXR1cm4gbmV3IFJlbmRlcmVkSG92ZXJQYXJ0cyhbXSk7XG5cdFx0fVxuXHRcdHJldHVybiBwYXJ0aWNpcGFudC5yZW5kZXJIb3ZlclBhcnRzKGhvdmVyUmVuZGVyaW5nQ29udGV4dCwgaG92ZXJQYXJ0c0ZvclBhcnRpY2lwYW50KTtcblx0fVxuXG5cdHByaXZhdGUgX3JlbmRlclN0YXR1c0JhcihmcmFnbWVudDogRG9jdW1lbnRGcmFnbWVudCwgc3RhdHVzQmFyOiBFZGl0b3JIb3ZlclN0YXR1c0Jhcik6IFJlbmRlcmVkU3RhdHVzQmFyIHwgdW5kZWZpbmVkIHtcblx0XHRpZiAoIXN0YXR1c0Jhci5oYXNDb250ZW50KSB7XG5cdFx0XHRyZXR1cm4gdW5kZWZpbmVkO1xuXHRcdH1cblx0XHRyZXR1cm4gbmV3IFJlbmRlcmVkU3RhdHVzQmFyKGZyYWdtZW50LCBzdGF0dXNCYXIpO1xuXHR9XG5cblx0cHJpdmF0ZSBfcmVnaXN0ZXJMaXN0ZW5lcnNPblJlbmRlcmVkUGFydHMoKTogSURpc3Bvc2FibGUge1xuXHRcdGNvbnN0IGRpc3Bvc2FibGVzID0gbmV3IERpc3Bvc2FibGVTdG9yZSgpO1xuXHRcdHRoaXMuX3JlbmRlcmVkUGFydHMuZm9yRWFjaCgocmVuZGVyZWRQYXJ0OiBJUmVuZGVyZWRDb250ZW50SG92ZXJQYXJ0T3JTdGF0dXNCYXIsIGluZGV4OiBudW1iZXIpID0+IHtcblx0XHRcdGNvbnN0IGVsZW1lbnQgPSByZW5kZXJlZFBhcnQuaG92ZXJFbGVtZW50O1xuXHRcdFx0ZWxlbWVudC50YWJJbmRleCA9IDA7XG5cdFx0XHRkaXNwb3NhYmxlcy5hZGQoZG9tLmFkZERpc3Bvc2FibGVMaXN0ZW5lcihlbGVtZW50LCBkb20uRXZlbnRUeXBlLkZPQ1VTX0lOLCAoZXZlbnQ6IEV2ZW50KSA9PiB7XG5cdFx0XHRcdGV2ZW50LnN0b3BQcm9wYWdhdGlvbigpO1xuXHRcdFx0XHR0aGlzLl9mb2N1c2VkSG92ZXJQYXJ0SW5kZXggPSBpbmRleDtcblx0XHRcdH0pKTtcblx0XHRcdGRpc3Bvc2FibGVzLmFkZChkb20uYWRkRGlzcG9zYWJsZUxpc3RlbmVyKGVsZW1lbnQsIGRvbS5FdmVudFR5cGUuRk9DVVNfT1VULCAoZXZlbnQ6IEV2ZW50KSA9PiB7XG5cdFx0XHRcdGV2ZW50LnN0b3BQcm9wYWdhdGlvbigpO1xuXHRcdFx0XHR0aGlzLl9mb2N1c2VkSG92ZXJQYXJ0SW5kZXggPSAtMTtcblx0XHRcdH0pKTtcblx0XHR9KTtcblx0XHRyZXR1cm4gZGlzcG9zYWJsZXM7XG5cdH1cblxuXHRwcml2YXRlIF91cGRhdGVNYXJrZG93bkFuZENvbG9yUGFydGljaXBhbnRJbmZvKHBhcnRpY2lwYW50czogSUVkaXRvckhvdmVyUGFydGljaXBhbnQ8SUhvdmVyUGFydD5bXSkge1xuXHRcdGNvbnN0IG1hcmtkb3duSG92ZXJQYXJ0aWNpcGFudCA9IHBhcnRpY2lwYW50cy5maW5kKHAgPT4ge1xuXHRcdFx0cmV0dXJuIChwIGluc3RhbmNlb2YgTWFya2Rvd25Ib3ZlclBhcnRpY2lwYW50KSAmJiAhKHAgaW5zdGFuY2VvZiBJbmxheUhpbnRzSG92ZXIpO1xuXHRcdH0pO1xuXHRcdGlmIChtYXJrZG93bkhvdmVyUGFydGljaXBhbnQpIHtcblx0XHRcdHRoaXMuX21hcmtkb3duSG92ZXJQYXJ0aWNpcGFudCA9IG1hcmtkb3duSG92ZXJQYXJ0aWNpcGFudCBhcyBNYXJrZG93bkhvdmVyUGFydGljaXBhbnQ7XG5cdFx0fVxuXHRcdHRoaXMuX2NvbG9ySG92ZXJQYXJ0aWNpcGFudCA9IHBhcnRpY2lwYW50cy5maW5kKHAgPT4gcCBpbnN0YW5jZW9mIEhvdmVyQ29sb3JQaWNrZXJQYXJ0aWNpcGFudCk7XG5cdH1cblxuXHRwdWJsaWMgZm9jdXNIb3ZlclBhcnRXaXRoSW5kZXgoaW5kZXg6IG51bWJlcik6IHZvaWQge1xuXHRcdGlmIChpbmRleCA8IDAgfHwgaW5kZXggPj0gdGhpcy5fcmVuZGVyZWRQYXJ0cy5sZW5ndGgpIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cdFx0dGhpcy5fcmVuZGVyZWRQYXJ0c1tpbmRleF0uaG92ZXJFbGVtZW50LmZvY3VzKCk7XG5cdH1cblxuXHRwdWJsaWMgZ2V0QWNjZXNzaWJsZUNvbnRlbnQoKTogc3RyaW5nIHtcblx0XHRjb25zdCBjb250ZW50OiBzdHJpbmdbXSA9IFtdO1xuXHRcdGZvciAobGV0IGkgPSAwOyBpIDwgdGhpcy5fcmVuZGVyZWRQYXJ0cy5sZW5ndGg7IGkrKykge1xuXHRcdFx0Y29udGVudC5wdXNoKHRoaXMuZ2V0QWNjZXNzaWJsZUhvdmVyQ29udGVudEF0SW5kZXgoaSkpO1xuXHRcdH1cblx0XHRyZXR1cm4gY29udGVudC5qb2luKCdcXG5cXG4nKTtcblx0fVxuXG5cdHB1YmxpYyBnZXRBY2Nlc3NpYmxlSG92ZXJDb250ZW50QXRJbmRleChpbmRleDogbnVtYmVyKTogc3RyaW5nIHtcblx0XHRjb25zdCByZW5kZXJlZFBhcnQgPSB0aGlzLl9yZW5kZXJlZFBhcnRzW2luZGV4XTtcblx0XHRpZiAoIXJlbmRlcmVkUGFydCkge1xuXHRcdFx0cmV0dXJuICcnO1xuXHRcdH1cblx0XHRpZiAocmVuZGVyZWRQYXJ0LnR5cGUgPT09ICdzdGF0dXNCYXInKSB7XG5cdFx0XHRjb25zdCBzdGF0dXNCYXJEZXNjcmlwdGlvbiA9IFtsb2NhbGl6ZSgnaG92ZXJBY2Nlc3NpYmlsaXR5U3RhdHVzQmFyJywgXCJUaGlzIGlzIGEgaG92ZXIgc3RhdHVzIGJhci5cIildO1xuXHRcdFx0Zm9yIChjb25zdCBhY3Rpb24gb2YgcmVuZGVyZWRQYXJ0LmFjdGlvbnMpIHtcblx0XHRcdFx0Y29uc3Qga2V5YmluZGluZyA9IGFjdGlvbi5hY3Rpb25LZXliaW5kaW5nTGFiZWw7XG5cdFx0XHRcdGlmIChrZXliaW5kaW5nKSB7XG5cdFx0XHRcdFx0c3RhdHVzQmFyRGVzY3JpcHRpb24ucHVzaChsb2NhbGl6ZSgnaG92ZXJBY2Nlc3NpYmlsaXR5U3RhdHVzQmFyQWN0aW9uV2l0aEtleWJpbmRpbmcnLCBcIkl0IGhhcyBhbiBhY3Rpb24gd2l0aCBsYWJlbCB7MH0gYW5kIGtleWJpbmRpbmcgezF9LlwiLCBhY3Rpb24uYWN0aW9uTGFiZWwsIGtleWJpbmRpbmcpKTtcblx0XHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0XHRzdGF0dXNCYXJEZXNjcmlwdGlvbi5wdXNoKGxvY2FsaXplKCdob3ZlckFjY2Vzc2liaWxpdHlTdGF0dXNCYXJBY3Rpb25XaXRob3V0S2V5YmluZGluZycsIFwiSXQgaGFzIGFuIGFjdGlvbiB3aXRoIGxhYmVsIHswfS5cIiwgYWN0aW9uLmFjdGlvbkxhYmVsKSk7XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHRcdHJldHVybiBzdGF0dXNCYXJEZXNjcmlwdGlvbi5qb2luKCdcXG4nKTtcblx0XHR9XG5cdFx0cmV0dXJuIHJlbmRlcmVkUGFydC5wYXJ0aWNpcGFudC5nZXRBY2Nlc3NpYmxlQ29udGVudChyZW5kZXJlZFBhcnQuaG92ZXJQYXJ0KTtcblx0fVxuXG5cdHB1YmxpYyBhc3luYyB1cGRhdGVIb3ZlclZlcmJvc2l0eUxldmVsKGFjdGlvbjogSG92ZXJWZXJib3NpdHlBY3Rpb24sIGluZGV4OiBudW1iZXIsIGZvY3VzPzogYm9vbGVhbik6IFByb21pc2U8dm9pZD4ge1xuXHRcdGlmICghdGhpcy5fbWFya2Rvd25Ib3ZlclBhcnRpY2lwYW50KSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXHRcdGxldCByYW5nZU9mSW5kaWNlc1RvVXBkYXRlOiBJT2Zmc2V0UmFuZ2U7XG5cdFx0aWYgKGluZGV4ID49IDApIHtcblx0XHRcdHJhbmdlT2ZJbmRpY2VzVG9VcGRhdGUgPSB7IHN0YXJ0OiBpbmRleCwgZW5kRXhjbHVzaXZlOiBpbmRleCArIDEgfTtcblx0XHR9IGVsc2Uge1xuXHRcdFx0cmFuZ2VPZkluZGljZXNUb1VwZGF0ZSA9IHRoaXMuX2ZpbmRSYW5nZU9mTWFya2Rvd25Ib3ZlclBhcnRzKHRoaXMuX21hcmtkb3duSG92ZXJQYXJ0aWNpcGFudCk7XG5cdFx0fVxuXHRcdGZvciAobGV0IGkgPSByYW5nZU9mSW5kaWNlc1RvVXBkYXRlLnN0YXJ0OyBpIDwgcmFuZ2VPZkluZGljZXNUb1VwZGF0ZS5lbmRFeGNsdXNpdmU7IGkrKykge1xuXHRcdFx0Y29uc3Qgbm9ybWFsaXplZE1hcmtkb3duSG92ZXJJbmRleCA9IHRoaXMuX25vcm1hbGl6ZWRJbmRleFRvTWFya2Rvd25Ib3ZlckluZGV4UmFuZ2UodGhpcy5fbWFya2Rvd25Ib3ZlclBhcnRpY2lwYW50LCBpKTtcblx0XHRcdGlmIChub3JtYWxpemVkTWFya2Rvd25Ib3ZlckluZGV4ID09PSB1bmRlZmluZWQpIHtcblx0XHRcdFx0Y29udGludWU7XG5cdFx0XHR9XG5cdFx0XHRjb25zdCByZW5kZXJlZFBhcnQgPSBhd2FpdCB0aGlzLl9tYXJrZG93bkhvdmVyUGFydGljaXBhbnQudXBkYXRlTWFya2Rvd25Ib3ZlclZlcmJvc2l0eUxldmVsKGFjdGlvbiwgbm9ybWFsaXplZE1hcmtkb3duSG92ZXJJbmRleCk7XG5cdFx0XHRpZiAoIXJlbmRlcmVkUGFydCkge1xuXHRcdFx0XHRjb250aW51ZTtcblx0XHRcdH1cblx0XHRcdHRoaXMuX3JlbmRlcmVkUGFydHNbaV0gPSB7XG5cdFx0XHRcdHR5cGU6ICdob3ZlclBhcnQnLFxuXHRcdFx0XHRwYXJ0aWNpcGFudDogdGhpcy5fbWFya2Rvd25Ib3ZlclBhcnRpY2lwYW50LFxuXHRcdFx0XHRob3ZlclBhcnQ6IHJlbmRlcmVkUGFydC5ob3ZlclBhcnQsXG5cdFx0XHRcdGhvdmVyRWxlbWVudDogcmVuZGVyZWRQYXJ0LmhvdmVyRWxlbWVudCxcblx0XHRcdH07XG5cdFx0fVxuXHRcdGlmIChmb2N1cykge1xuXHRcdFx0aWYgKGluZGV4ID49IDApIHtcblx0XHRcdFx0dGhpcy5mb2N1c0hvdmVyUGFydFdpdGhJbmRleChpbmRleCk7XG5cdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHR0aGlzLl9jb250ZXh0LmZvY3VzKCk7XG5cdFx0XHR9XG5cdFx0fVxuXHRcdHRoaXMuX2NvbnRleHQub25Db250ZW50c0NoYW5nZWQoKTtcblx0fVxuXG5cdHB1YmxpYyBkb2VzSG92ZXJBdEluZGV4U3VwcG9ydFZlcmJvc2l0eUFjdGlvbihpbmRleDogbnVtYmVyLCBhY3Rpb246IEhvdmVyVmVyYm9zaXR5QWN0aW9uKTogYm9vbGVhbiB7XG5cdFx0aWYgKCF0aGlzLl9tYXJrZG93bkhvdmVyUGFydGljaXBhbnQpIHtcblx0XHRcdHJldHVybiBmYWxzZTtcblx0XHR9XG5cdFx0Y29uc3Qgbm9ybWFsaXplZE1hcmtkb3duSG92ZXJJbmRleCA9IHRoaXMuX25vcm1hbGl6ZWRJbmRleFRvTWFya2Rvd25Ib3ZlckluZGV4UmFuZ2UodGhpcy5fbWFya2Rvd25Ib3ZlclBhcnRpY2lwYW50LCBpbmRleCk7XG5cdFx0aWYgKG5vcm1hbGl6ZWRNYXJrZG93bkhvdmVySW5kZXggPT09IHVuZGVmaW5lZCkge1xuXHRcdFx0cmV0dXJuIGZhbHNlO1xuXHRcdH1cblx0XHRyZXR1cm4gdGhpcy5fbWFya2Rvd25Ib3ZlclBhcnRpY2lwYW50LmRvZXNNYXJrZG93bkhvdmVyQXRJbmRleFN1cHBvcnRWZXJib3NpdHlBY3Rpb24obm9ybWFsaXplZE1hcmtkb3duSG92ZXJJbmRleCwgYWN0aW9uKTtcblx0fVxuXG5cdHB1YmxpYyBpc0NvbG9yUGlja2VyVmlzaWJsZSgpOiBib29sZWFuIHtcblx0XHRyZXR1cm4gdGhpcy5fY29sb3JIb3ZlclBhcnRpY2lwYW50Py5pc0NvbG9yUGlja2VyVmlzaWJsZSgpID8/IGZhbHNlO1xuXHR9XG5cblx0cHJpdmF0ZSBfbm9ybWFsaXplZEluZGV4VG9NYXJrZG93bkhvdmVySW5kZXhSYW5nZShtYXJrZG93bkhvdmVyUGFydGljaXBhbnQ6IE1hcmtkb3duSG92ZXJQYXJ0aWNpcGFudCwgaW5kZXg6IG51bWJlcik6IG51bWJlciB8IHVuZGVmaW5lZCB7XG5cdFx0Y29uc3QgcmVuZGVyZWRQYXJ0ID0gdGhpcy5fcmVuZGVyZWRQYXJ0c1tpbmRleF07XG5cdFx0aWYgKCFyZW5kZXJlZFBhcnQgfHwgcmVuZGVyZWRQYXJ0LnR5cGUgIT09ICdob3ZlclBhcnQnKSB7XG5cdFx0XHRyZXR1cm4gdW5kZWZpbmVkO1xuXHRcdH1cblx0XHRjb25zdCBpc0hvdmVyUGFydE1hcmtkb3duSG92ZXIgPSByZW5kZXJlZFBhcnQucGFydGljaXBhbnQgPT09IG1hcmtkb3duSG92ZXJQYXJ0aWNpcGFudDtcblx0XHRpZiAoIWlzSG92ZXJQYXJ0TWFya2Rvd25Ib3Zlcikge1xuXHRcdFx0cmV0dXJuIHVuZGVmaW5lZDtcblx0XHR9XG5cdFx0Y29uc3QgZmlyc3RJbmRleE9mTWFya2Rvd25Ib3ZlcnMgPSB0aGlzLl9yZW5kZXJlZFBhcnRzLmZpbmRJbmRleChyZW5kZXJlZFBhcnQgPT5cblx0XHRcdHJlbmRlcmVkUGFydC50eXBlID09PSAnaG92ZXJQYXJ0J1xuXHRcdFx0JiYgcmVuZGVyZWRQYXJ0LnBhcnRpY2lwYW50ID09PSBtYXJrZG93bkhvdmVyUGFydGljaXBhbnRcblx0XHQpO1xuXHRcdGlmIChmaXJzdEluZGV4T2ZNYXJrZG93bkhvdmVycyA9PT0gLTEpIHtcblx0XHRcdHRocm93IG5ldyBCdWdJbmRpY2F0aW5nRXJyb3IoKTtcblx0XHR9XG5cdFx0cmV0dXJuIGluZGV4IC0gZmlyc3RJbmRleE9mTWFya2Rvd25Ib3ZlcnM7XG5cdH1cblxuXHRwcml2YXRlIF9maW5kUmFuZ2VPZk1hcmtkb3duSG92ZXJQYXJ0cyhtYXJrZG93bkhvdmVyUGFydGljaXBhbnQ6IE1hcmtkb3duSG92ZXJQYXJ0aWNpcGFudCk6IElPZmZzZXRSYW5nZSB7XG5cdFx0Y29uc3QgY29waWVkUmVuZGVyZWRQYXJ0cyA9IHRoaXMuX3JlbmRlcmVkUGFydHMuc2xpY2UoKTtcblx0XHRjb25zdCBmaXJzdEluZGV4T2ZNYXJrZG93bkhvdmVycyA9IGNvcGllZFJlbmRlcmVkUGFydHMuZmluZEluZGV4KHJlbmRlcmVkUGFydCA9PiByZW5kZXJlZFBhcnQudHlwZSA9PT0gJ2hvdmVyUGFydCcgJiYgcmVuZGVyZWRQYXJ0LnBhcnRpY2lwYW50ID09PSBtYXJrZG93bkhvdmVyUGFydGljaXBhbnQpO1xuXHRcdGNvbnN0IGludmVyc2VkTGFzdEluZGV4T2ZNYXJrZG93bkhvdmVycyA9IGNvcGllZFJlbmRlcmVkUGFydHMucmV2ZXJzZSgpLmZpbmRJbmRleChyZW5kZXJlZFBhcnQgPT4gcmVuZGVyZWRQYXJ0LnR5cGUgPT09ICdob3ZlclBhcnQnICYmIHJlbmRlcmVkUGFydC5wYXJ0aWNpcGFudCA9PT0gbWFya2Rvd25Ib3ZlclBhcnRpY2lwYW50KTtcblx0XHRjb25zdCBsYXN0SW5kZXhPZk1hcmtkb3duSG92ZXJzID0gaW52ZXJzZWRMYXN0SW5kZXhPZk1hcmtkb3duSG92ZXJzID49IDAgPyBjb3BpZWRSZW5kZXJlZFBhcnRzLmxlbmd0aCAtIGludmVyc2VkTGFzdEluZGV4T2ZNYXJrZG93bkhvdmVycyA6IGludmVyc2VkTGFzdEluZGV4T2ZNYXJrZG93bkhvdmVycztcblx0XHRyZXR1cm4geyBzdGFydDogZmlyc3RJbmRleE9mTWFya2Rvd25Ib3ZlcnMsIGVuZEV4Y2x1c2l2ZTogbGFzdEluZGV4T2ZNYXJrZG93bkhvdmVycyArIDEgfTtcblx0fVxuXG5cdHB1YmxpYyBnZXQgZG9tTm9kZSgpOiBEb2N1bWVudEZyYWdtZW50IHtcblx0XHRyZXR1cm4gdGhpcy5fZnJhZ21lbnQ7XG5cdH1cblxuXHRwdWJsaWMgZ2V0IGRvbU5vZGVIYXNDaGlsZHJlbigpOiBib29sZWFuIHtcblx0XHRyZXR1cm4gdGhpcy5fZnJhZ21lbnQuaGFzQ2hpbGROb2RlcygpO1xuXHR9XG5cblx0cHVibGljIGdldCBmb2N1c2VkSG92ZXJQYXJ0SW5kZXgoKTogbnVtYmVyIHtcblx0XHRyZXR1cm4gdGhpcy5fZm9jdXNlZEhvdmVyUGFydEluZGV4O1xuXHR9XG5cblx0cHVibGljIGdldCBob3ZlclBhcnRzQ291bnQoKTogbnVtYmVyIHtcblx0XHRyZXR1cm4gdGhpcy5fcmVuZGVyZWRQYXJ0cy5sZW5ndGg7XG5cdH1cbn1cbiJdLAogICJtYXBwaW5ncyI6ICI7Ozs7Ozs7Ozs7O0FBS0EsU0FBbUgsMEJBQTBCO0FBQzdJLFNBQVMsWUFBWSxpQkFBOEIsb0JBQW9CO0FBQ3ZFLFNBQVMsNEJBQTRCO0FBRXJDLFNBQVMsMEJBQTBCO0FBQ25DLFNBQVMsOEJBQThCO0FBRXZDLFNBQVMsZ0JBQWdCO0FBQ3pCLFNBQVMsYUFBYTtBQUV0QixZQUFZLFNBQVM7QUFFckIsU0FBUyxnQ0FBZ0M7QUFDekMsU0FBUyxtQ0FBbUM7QUFDNUMsU0FBUyxnQkFBZ0I7QUFDekIsU0FBUyx1QkFBdUI7QUFDaEMsU0FBUywwQkFBMEI7QUFFbkMsU0FBUyxxQkFBcUI7QUFHdkIsSUFBTSx1QkFBTixjQUFtQyxXQUFXO0FBQUEsRUFjcEQsWUFDQyxRQUNBLGFBQ0EsY0FDQSxTQUNvQixtQkFDTCxjQUNkO0FBQ0QsVUFBTTtBQUNOLFVBQU0sUUFBUSxZQUFZO0FBQzFCLFNBQUssc0JBQXNCLEtBQUssVUFBVSxJQUFJO0FBQUEsTUFDN0M7QUFBQSxNQUNBO0FBQUEsTUFDQTtBQUFBLE1BQ0E7QUFBQSxNQUNBO0FBQUEsTUFDQTtBQUFBLElBQ0QsQ0FBQztBQUNELFVBQU0sOEJBQThCLFlBQVk7QUFDaEQsVUFBTSxTQUFTLDRCQUE0QjtBQUMzQyxVQUFNLEVBQUUsZ0JBQWdCLHdCQUF3QixJQUFJLHFCQUFxQixzQkFBc0IsUUFBUSxPQUFPLE9BQU8sS0FBSztBQUMxSCxTQUFLLDRCQUE0QixNQUFNLEtBQUssT0FBSyxFQUFFLGVBQWU7QUFDbEUsU0FBSyxpQkFBaUI7QUFDdEIsU0FBSywwQkFBMEI7QUFDL0IsU0FBSyxtQkFBbUIsT0FBTztBQUMvQixTQUFLLG1CQUFtQixPQUFPO0FBQy9CLFNBQUssY0FBYyw0QkFBNEI7QUFDL0MsU0FBSyxTQUFTLDRCQUE0QjtBQUFBLEVBQzNDO0FBQUEsRUFFQSxJQUFXLFVBQTRCO0FBQ3RDLFdBQU8sS0FBSyxvQkFBb0I7QUFBQSxFQUNqQztBQUFBLEVBRUEsSUFBVyxxQkFBOEI7QUFDeEMsV0FBTyxLQUFLLG9CQUFvQjtBQUFBLEVBQ2pDO0FBQUEsRUFFQSxJQUFXLHdCQUFnQztBQUMxQyxXQUFPLEtBQUssb0JBQW9CO0FBQUEsRUFDakM7QUFBQSxFQUVBLElBQVcsa0JBQTBCO0FBQ3BDLFdBQU8sS0FBSyxvQkFBb0I7QUFBQSxFQUNqQztBQUFBLEVBRU8sd0JBQXdCLE9BQXFCO0FBQ25ELFNBQUssb0JBQW9CLHdCQUF3QixLQUFLO0FBQUEsRUFDdkQ7QUFBQSxFQUVPLDZCQUFxQztBQUMzQyxXQUFPLEtBQUssb0JBQW9CLHFCQUFxQjtBQUFBLEVBQ3REO0FBQUEsRUFFTyxrQ0FBa0MsT0FBdUI7QUFDL0QsV0FBTyxLQUFLLG9CQUFvQixpQ0FBaUMsS0FBSztBQUFBLEVBQ3ZFO0FBQUEsRUFFQSxNQUFhLDBCQUEwQixRQUE4QixPQUFlLE9BQWdDO0FBQ25ILFNBQUssb0JBQW9CLDBCQUEwQixRQUFRLE9BQU8sS0FBSztBQUFBLEVBQ3hFO0FBQUEsRUFFTyx1Q0FBdUMsT0FBZSxRQUF1QztBQUNuRyxXQUFPLEtBQUssb0JBQW9CLHVDQUF1QyxPQUFPLE1BQU07QUFBQSxFQUNyRjtBQUFBLEVBRU8sdUJBQWdDO0FBQ3RDLFdBQU8sS0FBSyxvQkFBb0IscUJBQXFCO0FBQUEsRUFDdEQ7QUFBQSxFQUVBLE9BQWMsc0JBQXNCLFFBQXFCLGFBQW9CLFlBQTJGO0FBRXZLLFFBQUksc0JBQXNCO0FBQzFCLFFBQUksT0FBTyxTQUFTLEdBQUc7QUFFdEIsWUFBTSxZQUFZLE9BQU8sY0FBYztBQUN2QyxZQUFNLHVCQUF1QixVQUFVO0FBQ3ZDLFlBQU0sa0JBQWtCLHFCQUFxQiw2QkFBNkIsV0FBVztBQUNyRixZQUFNLHNCQUFzQixVQUFVLGlCQUFpQixnQkFBZ0IsZUFBZTtBQUN0RixZQUFNLHVCQUF1QixJQUFJLFNBQVMsZ0JBQWdCLGlCQUFpQixtQkFBbUI7QUFDOUYsNEJBQXNCLHFCQUFxQixtQ0FBbUMsb0JBQW9CLEVBQUU7QUFBQSxJQUNyRztBQUdBLFVBQU0sd0JBQXdCLFlBQVk7QUFDMUMsUUFBSSwwQkFBMEIsWUFBWTtBQUMxQyxRQUFJO0FBRUosZUFBVyxhQUFhLFlBQVk7QUFDbkMsWUFBTSxpQkFBaUIsVUFBVTtBQUNqQyxZQUFNLGtDQUFrQyxlQUFlLG9CQUFvQjtBQUMzRSxZQUFNLGdDQUFnQyxlQUFlLGtCQUFrQjtBQUN2RSxZQUFNLCtCQUErQixtQ0FBbUM7QUFDeEUsVUFBSSw4QkFBOEI7QUFFakMsY0FBTSx1QkFBdUIsZUFBZTtBQUM1QyxjQUFNLDZCQUE2QixLQUFLLElBQUkseUJBQXlCLG9CQUFvQjtBQUN6RixrQ0FBMEIsS0FBSyxJQUFJLDRCQUE0QixtQkFBbUI7QUFBQSxNQUNuRjtBQUNBLFVBQUksVUFBVSxrQkFBa0I7QUFDL0IsMkJBQW1CO0FBQUEsTUFDcEI7QUFBQSxJQUNEO0FBRUEsUUFBSTtBQUNKLFFBQUk7QUFDSixRQUFJLGtCQUFrQjtBQUNyQixZQUFNLHNCQUFzQixpQkFBaUIsaUJBQWlCO0FBQzlELHVCQUFpQjtBQUNqQixnQ0FBMEI7QUFBQSxJQUMzQixPQUFPO0FBQ04sdUJBQWlCLFlBQVksaUJBQWlCO0FBQzlDLGdDQUEwQixJQUFJLFNBQVMsdUJBQXVCLHVCQUF1QjtBQUFBLElBQ3RGO0FBQ0EsV0FBTztBQUFBLE1BQ047QUFBQSxNQUNBO0FBQUEsSUFDRDtBQUFBLEVBQ0Q7QUFDRDtBQXJJYSx1QkFBTjtBQUFBLEVBbUJKO0FBQUEsRUFDQTtBQUFBLEdBcEJVO0FBMktiLE1BQU0sa0JBQXlDO0FBQUEsRUFFOUMsWUFBWSxVQUE2QyxZQUFrQztBQUFsQztBQUN4RCxhQUFTLFlBQVksS0FBSyxXQUFXLFlBQVk7QUFBQSxFQUNsRDtBQUFBLEVBRUEsSUFBSSxlQUE0QjtBQUMvQixXQUFPLEtBQUssV0FBVztBQUFBLEVBQ3hCO0FBQUEsRUFFQSxJQUFJLFVBQXlCO0FBQzVCLFdBQU8sS0FBSyxXQUFXO0FBQUEsRUFDeEI7QUFBQSxFQUVBLFVBQVU7QUFDVCxTQUFLLFdBQVcsUUFBUTtBQUFBLEVBQ3pCO0FBQ0Q7QUFFQSxJQUFNLDRCQUFOLGNBQXdDLFdBQVc7QUFBQSxFQWVsRCxZQUNDLFFBQ0EsY0FDQSxZQUNBLFNBQ29CLG1CQUNMLGNBQ2Q7QUFDRCxVQUFNO0FBaEJQLFNBQWlCLGlCQUF5RCxDQUFDO0FBTTNFLFNBQVEseUJBQWlDO0FBV3hDLFNBQUssV0FBVztBQUNoQixTQUFLLFlBQVksU0FBUyx1QkFBdUI7QUFDakQsU0FBSyxVQUFVLEtBQUssYUFBYSxjQUFjLFlBQVksU0FBUyxtQkFBbUIsWUFBWSxDQUFDO0FBQ3BHLFNBQUssVUFBVSxLQUFLLGtDQUFrQyxDQUFDO0FBQ3ZELFNBQUssVUFBVSxLQUFLLHlCQUF5QixRQUFRLFVBQVUsQ0FBQztBQUNoRSxTQUFLLHVDQUF1QyxZQUFZO0FBQUEsRUFDekQ7QUFBQSxFQUVRLHlCQUF5QixRQUFxQixZQUF1QztBQUM1RixRQUFJLFdBQVcsV0FBVyxHQUFHO0FBQzVCLGFBQU8sV0FBVztBQUFBLElBQ25CO0FBQ0EsUUFBSSxpQkFBaUIsV0FBVyxDQUFDLEVBQUU7QUFDbkMsZUFBVyxhQUFhLFlBQVk7QUFDbkMsWUFBTSxpQkFBaUIsVUFBVTtBQUNqQyx1QkFBaUIsTUFBTSxVQUFVLGdCQUFnQixjQUFjO0FBQUEsSUFDaEU7QUFDQSxVQUFNLHNCQUFzQixPQUFPLDRCQUE0QjtBQUMvRCx3QkFBb0IsSUFBSSxDQUFDO0FBQUEsTUFDeEIsT0FBTztBQUFBLE1BQ1AsU0FBUywwQkFBMEI7QUFBQSxJQUNwQyxDQUFDLENBQUM7QUFDRixXQUFPLGFBQWEsTUFBTTtBQUN6QiwwQkFBb0IsTUFBTTtBQUFBLElBQzNCLENBQUM7QUFBQSxFQUNGO0FBQUEsRUFFUSxhQUFhLGNBQXFELFlBQTBCLGNBQW1DLG1CQUF1QyxjQUEwQztBQUN2TixVQUFNLFlBQVksSUFBSSxxQkFBcUIsbUJBQW1CLFlBQVk7QUFDMUUsVUFBTSx3QkFBbUQ7QUFBQSxNQUN4RCxVQUFVLEtBQUs7QUFBQSxNQUNmO0FBQUEsTUFDQSxHQUFHO0FBQUEsSUFDSjtBQUNBLFVBQU0sY0FBYyxJQUFJLGdCQUFnQjtBQUN4QyxnQkFBWSxJQUFJLFNBQVM7QUFDekIsZUFBVyxlQUFlLGNBQWM7QUFDdkMsWUFBTSxxQkFBcUIsS0FBSyxnQ0FBZ0MsWUFBWSxhQUFhLHFCQUFxQjtBQUM5RyxrQkFBWSxJQUFJLGtCQUFrQjtBQUNsQyxpQkFBVyxxQkFBcUIsbUJBQW1CLG9CQUFvQjtBQUN0RSxhQUFLLGVBQWUsS0FBSztBQUFBLFVBQ3hCLE1BQU07QUFBQSxVQUNOO0FBQUEsVUFDQSxXQUFXLGtCQUFrQjtBQUFBLFVBQzdCLGNBQWMsa0JBQWtCO0FBQUEsUUFDakMsQ0FBQztBQUFBLE1BQ0Y7QUFBQSxJQUNEO0FBQ0EsVUFBTSxvQkFBb0IsS0FBSyxpQkFBaUIsS0FBSyxXQUFXLFNBQVM7QUFDekUsUUFBSSxtQkFBbUI7QUFDdEIsa0JBQVksSUFBSSxpQkFBaUI7QUFDakMsV0FBSyxlQUFlLEtBQUs7QUFBQSxRQUN4QixNQUFNO0FBQUEsUUFDTixjQUFjLGtCQUFrQjtBQUFBLFFBQ2hDLFNBQVMsa0JBQWtCO0FBQUEsTUFDNUIsQ0FBQztBQUFBLElBQ0Y7QUFDQSxXQUFPO0FBQUEsRUFDUjtBQUFBLEVBRVEsZ0NBQWdDLFlBQTBCLGFBQWtELHVCQUFtRjtBQUN0TSxVQUFNLDJCQUEyQixXQUFXLE9BQU8sZUFBYSxVQUFVLFVBQVUsV0FBVztBQUMvRixVQUFNLDhCQUE4Qix5QkFBeUIsU0FBUztBQUN0RSxRQUFJLENBQUMsNkJBQTZCO0FBQ2pDLGFBQU8sSUFBSSxtQkFBbUIsQ0FBQyxDQUFDO0FBQUEsSUFDakM7QUFDQSxXQUFPLFlBQVksaUJBQWlCLHVCQUF1Qix3QkFBd0I7QUFBQSxFQUNwRjtBQUFBLEVBRVEsaUJBQWlCLFVBQTRCLFdBQWdFO0FBQ3BILFFBQUksQ0FBQyxVQUFVLFlBQVk7QUFDMUIsYUFBTztBQUFBLElBQ1I7QUFDQSxXQUFPLElBQUksa0JBQWtCLFVBQVUsU0FBUztBQUFBLEVBQ2pEO0FBQUEsRUFFUSxvQ0FBaUQ7QUFDeEQsVUFBTSxjQUFjLElBQUksZ0JBQWdCO0FBQ3hDLFNBQUssZUFBZSxRQUFRLENBQUMsY0FBb0QsVUFBa0I7QUFDbEcsWUFBTSxVQUFVLGFBQWE7QUFDN0IsY0FBUSxXQUFXO0FBQ25CLGtCQUFZLElBQUksSUFBSSxzQkFBc0IsU0FBUyxJQUFJLFVBQVUsVUFBVSxDQUFDLFVBQWlCO0FBQzVGLGNBQU0sZ0JBQWdCO0FBQ3RCLGFBQUsseUJBQXlCO0FBQUEsTUFDL0IsQ0FBQyxDQUFDO0FBQ0Ysa0JBQVksSUFBSSxJQUFJLHNCQUFzQixTQUFTLElBQUksVUFBVSxXQUFXLENBQUMsVUFBaUI7QUFDN0YsY0FBTSxnQkFBZ0I7QUFDdEIsYUFBSyx5QkFBeUI7QUFBQSxNQUMvQixDQUFDLENBQUM7QUFBQSxJQUNILENBQUM7QUFDRCxXQUFPO0FBQUEsRUFDUjtBQUFBLEVBRVEsdUNBQXVDLGNBQXFEO0FBQ25HLFVBQU0sMkJBQTJCLGFBQWEsS0FBSyxPQUFLO0FBQ3ZELGFBQVEsYUFBYSw0QkFBNkIsRUFBRSxhQUFhO0FBQUEsSUFDbEUsQ0FBQztBQUNELFFBQUksMEJBQTBCO0FBQzdCLFdBQUssNEJBQTRCO0FBQUEsSUFDbEM7QUFDQSxTQUFLLHlCQUF5QixhQUFhLEtBQUssT0FBSyxhQUFhLDJCQUEyQjtBQUFBLEVBQzlGO0FBQUEsRUFFTyx3QkFBd0IsT0FBcUI7QUFDbkQsUUFBSSxRQUFRLEtBQUssU0FBUyxLQUFLLGVBQWUsUUFBUTtBQUNyRDtBQUFBLElBQ0Q7QUFDQSxTQUFLLGVBQWUsS0FBSyxFQUFFLGFBQWEsTUFBTTtBQUFBLEVBQy9DO0FBQUEsRUFFTyx1QkFBK0I7QUFDckMsVUFBTSxVQUFvQixDQUFDO0FBQzNCLGFBQVMsSUFBSSxHQUFHLElBQUksS0FBSyxlQUFlLFFBQVEsS0FBSztBQUNwRCxjQUFRLEtBQUssS0FBSyxpQ0FBaUMsQ0FBQyxDQUFDO0FBQUEsSUFDdEQ7QUFDQSxXQUFPLFFBQVEsS0FBSyxNQUFNO0FBQUEsRUFDM0I7QUFBQSxFQUVPLGlDQUFpQyxPQUF1QjtBQUM5RCxVQUFNLGVBQWUsS0FBSyxlQUFlLEtBQUs7QUFDOUMsUUFBSSxDQUFDLGNBQWM7QUFDbEIsYUFBTztBQUFBLElBQ1I7QUFDQSxRQUFJLGFBQWEsU0FBUyxhQUFhO0FBQ3RDLFlBQU0sdUJBQXVCLENBQUMsU0FBUywrQkFBK0IsNkJBQTZCLENBQUM7QUFDcEcsaUJBQVcsVUFBVSxhQUFhLFNBQVM7QUFDMUMsY0FBTSxhQUFhLE9BQU87QUFDMUIsWUFBSSxZQUFZO0FBQ2YsK0JBQXFCLEtBQUssU0FBUyxtREFBbUQsdURBQXVELE9BQU8sYUFBYSxVQUFVLENBQUM7QUFBQSxRQUM3SyxPQUFPO0FBQ04sK0JBQXFCLEtBQUssU0FBUyxzREFBc0Qsb0NBQW9DLE9BQU8sV0FBVyxDQUFDO0FBQUEsUUFDako7QUFBQSxNQUNEO0FBQ0EsYUFBTyxxQkFBcUIsS0FBSyxJQUFJO0FBQUEsSUFDdEM7QUFDQSxXQUFPLGFBQWEsWUFBWSxxQkFBcUIsYUFBYSxTQUFTO0FBQUEsRUFDNUU7QUFBQSxFQUVBLE1BQWEsMEJBQTBCLFFBQThCLE9BQWUsT0FBZ0M7QUFDbkgsUUFBSSxDQUFDLEtBQUssMkJBQTJCO0FBQ3BDO0FBQUEsSUFDRDtBQUNBLFFBQUk7QUFDSixRQUFJLFNBQVMsR0FBRztBQUNmLCtCQUF5QixFQUFFLE9BQU8sT0FBTyxjQUFjLFFBQVEsRUFBRTtBQUFBLElBQ2xFLE9BQU87QUFDTiwrQkFBeUIsS0FBSywrQkFBK0IsS0FBSyx5QkFBeUI7QUFBQSxJQUM1RjtBQUNBLGFBQVMsSUFBSSx1QkFBdUIsT0FBTyxJQUFJLHVCQUF1QixjQUFjLEtBQUs7QUFDeEYsWUFBTSwrQkFBK0IsS0FBSywwQ0FBMEMsS0FBSywyQkFBMkIsQ0FBQztBQUNySCxVQUFJLGlDQUFpQyxRQUFXO0FBQy9DO0FBQUEsTUFDRDtBQUNBLFlBQU0sZUFBZSxNQUFNLEtBQUssMEJBQTBCLGtDQUFrQyxRQUFRLDRCQUE0QjtBQUNoSSxVQUFJLENBQUMsY0FBYztBQUNsQjtBQUFBLE1BQ0Q7QUFDQSxXQUFLLGVBQWUsQ0FBQyxJQUFJO0FBQUEsUUFDeEIsTUFBTTtBQUFBLFFBQ04sYUFBYSxLQUFLO0FBQUEsUUFDbEIsV0FBVyxhQUFhO0FBQUEsUUFDeEIsY0FBYyxhQUFhO0FBQUEsTUFDNUI7QUFBQSxJQUNEO0FBQ0EsUUFBSSxPQUFPO0FBQ1YsVUFBSSxTQUFTLEdBQUc7QUFDZixhQUFLLHdCQUF3QixLQUFLO0FBQUEsTUFDbkMsT0FBTztBQUNOLGFBQUssU0FBUyxNQUFNO0FBQUEsTUFDckI7QUFBQSxJQUNEO0FBQ0EsU0FBSyxTQUFTLGtCQUFrQjtBQUFBLEVBQ2pDO0FBQUEsRUFFTyx1Q0FBdUMsT0FBZSxRQUF1QztBQUNuRyxRQUFJLENBQUMsS0FBSywyQkFBMkI7QUFDcEMsYUFBTztBQUFBLElBQ1I7QUFDQSxVQUFNLCtCQUErQixLQUFLLDBDQUEwQyxLQUFLLDJCQUEyQixLQUFLO0FBQ3pILFFBQUksaUNBQWlDLFFBQVc7QUFDL0MsYUFBTztBQUFBLElBQ1I7QUFDQSxXQUFPLEtBQUssMEJBQTBCLCtDQUErQyw4QkFBOEIsTUFBTTtBQUFBLEVBQzFIO0FBQUEsRUFFTyx1QkFBZ0M7QUFDdEMsV0FBTyxLQUFLLHdCQUF3QixxQkFBcUIsS0FBSztBQUFBLEVBQy9EO0FBQUEsRUFFUSwwQ0FBMEMsMEJBQW9ELE9BQW1DO0FBQ3hJLFVBQU0sZUFBZSxLQUFLLGVBQWUsS0FBSztBQUM5QyxRQUFJLENBQUMsZ0JBQWdCLGFBQWEsU0FBUyxhQUFhO0FBQ3ZELGFBQU87QUFBQSxJQUNSO0FBQ0EsVUFBTSwyQkFBMkIsYUFBYSxnQkFBZ0I7QUFDOUQsUUFBSSxDQUFDLDBCQUEwQjtBQUM5QixhQUFPO0FBQUEsSUFDUjtBQUNBLFVBQU0sNkJBQTZCLEtBQUssZUFBZTtBQUFBLE1BQVUsQ0FBQUEsa0JBQ2hFQSxjQUFhLFNBQVMsZUFDbkJBLGNBQWEsZ0JBQWdCO0FBQUEsSUFDakM7QUFDQSxRQUFJLCtCQUErQixJQUFJO0FBQ3RDLFlBQU0sSUFBSSxtQkFBbUI7QUFBQSxJQUM5QjtBQUNBLFdBQU8sUUFBUTtBQUFBLEVBQ2hCO0FBQUEsRUFFUSwrQkFBK0IsMEJBQWtFO0FBQ3hHLFVBQU0sc0JBQXNCLEtBQUssZUFBZSxNQUFNO0FBQ3RELFVBQU0sNkJBQTZCLG9CQUFvQixVQUFVLGtCQUFnQixhQUFhLFNBQVMsZUFBZSxhQUFhLGdCQUFnQix3QkFBd0I7QUFDM0ssVUFBTSxvQ0FBb0Msb0JBQW9CLFFBQVEsRUFBRSxVQUFVLGtCQUFnQixhQUFhLFNBQVMsZUFBZSxhQUFhLGdCQUFnQix3QkFBd0I7QUFDNUwsVUFBTSw0QkFBNEIscUNBQXFDLElBQUksb0JBQW9CLFNBQVMsb0NBQW9DO0FBQzVJLFdBQU8sRUFBRSxPQUFPLDRCQUE0QixjQUFjLDRCQUE0QixFQUFFO0FBQUEsRUFDekY7QUFBQSxFQUVBLElBQVcsVUFBNEI7QUFDdEMsV0FBTyxLQUFLO0FBQUEsRUFDYjtBQUFBLEVBRUEsSUFBVyxxQkFBOEI7QUFDeEMsV0FBTyxLQUFLLFVBQVUsY0FBYztBQUFBLEVBQ3JDO0FBQUEsRUFFQSxJQUFXLHdCQUFnQztBQUMxQyxXQUFPLEtBQUs7QUFBQSxFQUNiO0FBQUEsRUFFQSxJQUFXLGtCQUEwQjtBQUNwQyxXQUFPLEtBQUssZUFBZTtBQUFBLEVBQzVCO0FBQ0Q7QUEvUE0sMEJBRW1CLHNCQUFzQix1QkFBdUIsU0FBUztBQUFBLEVBQzdFLGFBQWE7QUFBQSxFQUNiLFdBQVc7QUFDWixDQUFDO0FBTEksNEJBQU47QUFBQSxFQW9CRztBQUFBLEVBQ0E7QUFBQSxHQXJCRzsiLAogICJuYW1lcyI6IFsicmVuZGVyZWRQYXJ0Il0KfQo=
