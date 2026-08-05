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
import { createTrustedTypesPolicy } from "../../../../../../base/browser/trustedTypes.js";
import { renderIcon } from "../../../../../../base/browser/ui/iconLabel/iconLabels.js";
import { Codicon } from "../../../../../../base/common/codicons.js";
import { Emitter, Event } from "../../../../../../base/common/event.js";
import { createHotClass } from "../../../../../../base/common/hotReloadHelpers.js";
import { Disposable, DisposableStore, MutableDisposable, toDisposable } from "../../../../../../base/common/lifecycle.js";
import { autorun, autorunWithStore, constObservable, derived, observableSignalFromEvent, observableValue } from "../../../../../../base/common/observable.js";
import * as strings from "../../../../../../base/common/strings.js";
import { applyFontInfo } from "../../../../../browser/config/domFontInfo.js";
import { ContentWidgetPositionPreference, MouseTargetType } from "../../../../../browser/editorBrowser.js";
import { observableCodeEditor } from "../../../../../browser/observableCodeEditor.js";
import { EditorFontLigatures, EditorOption } from "../../../../../common/config/editorOptions.js";
import { OffsetEdit, SingleOffsetEdit } from "../../../../../common/core/offsetEdit.js";
import { Position } from "../../../../../common/core/position.js";
import { Range } from "../../../../../common/core/range.js";
import { StringBuilder } from "../../../../../common/core/stringBuilder.js";
import { ILanguageService } from "../../../../../common/languages/language.js";
import { InjectedTextCursorStops, PositionAffinity } from "../../../../../common/model.js";
import { LineTokens } from "../../../../../common/tokens/lineTokens.js";
import { LineDecoration } from "../../../../../common/viewLayout/lineDecorations.js";
import { RenderLineInput, renderViewLine } from "../../../../../common/viewLayout/viewLineRenderer.js";
import { InlineDecorationType } from "../../../../../common/viewModel.js";
import { GhostTextReplacement } from "../../model/ghostText.js";
import { ColumnRange } from "../../utils.js";
import { addDisposableListener, getWindow, isHTMLElement, n } from "../../../../../../base/browser/dom.js";
import "./ghostTextView.css";
import { StandardMouseEvent } from "../../../../../../base/browser/mouseEvent.js";
import { CodeEditorWidget } from "../../../../../browser/widget/codeEditor/codeEditorWidget.js";
const USE_SQUIGGLES_FOR_WARNING = true;
const GHOST_TEXT_CLASS_NAME = "ghost-text";
let GhostTextView = class extends Disposable {
  constructor(_editor, _model, _options, _shouldKeepCursorStable, _isClickable, _languageService) {
    super();
    this._editor = _editor;
    this._model = _model;
    this._options = _options;
    this._shouldKeepCursorStable = _shouldKeepCursorStable;
    this._isClickable = _isClickable;
    this._languageService = _languageService;
    this._isDisposed = observableValue(this, false);
    this._editorObs = observableCodeEditor(this._editor);
    this._warningState = derived((reader) => {
      const gt = this._model.ghostText.read(reader);
      if (!gt) {
        return void 0;
      }
      const warning = this._model.warning.read(reader);
      if (!warning) {
        return void 0;
      }
      return { lineNumber: gt.lineNumber, position: new Position(gt.lineNumber, gt.parts[0].column), icon: warning.icon };
    });
    this._onDidClick = this._register(new Emitter());
    this.onDidClick = this._onDidClick.event;
    this._useSyntaxHighlighting = this._options.map((o) => o.syntaxHighlightingEnabled);
    this._extraClassNames = derived(this, (reader) => {
      const extraClasses = [...this._options.read(reader).extraClasses ?? []];
      if (this._useSyntaxHighlighting.read(reader)) {
        extraClasses.push("syntax-highlighted");
      }
      if (USE_SQUIGGLES_FOR_WARNING && this._warningState.read(reader)) {
        extraClasses.push("warning");
      }
      const extraClassNames = extraClasses.map((c) => ` ${c}`).join("");
      return extraClassNames;
    });
    this.uiState = derived(this, (reader) => {
      if (this._isDisposed.read(reader)) {
        return void 0;
      }
      const textModel = this._editorObs.model.read(reader);
      if (textModel !== this._model.targetTextModel.read(reader)) {
        return void 0;
      }
      const ghostText = this._model.ghostText.read(reader);
      if (!ghostText) {
        return void 0;
      }
      const replacedRange = ghostText instanceof GhostTextReplacement ? ghostText.columnRange : void 0;
      const syntaxHighlightingEnabled = this._useSyntaxHighlighting.read(reader);
      const extraClassNames = this._extraClassNames.read(reader);
      const { inlineTexts, additionalLines, hiddenRange } = computeGhostTextViewData(ghostText, textModel, GHOST_TEXT_CLASS_NAME + extraClassNames);
      const currentLine = textModel.getLineContent(ghostText.lineNumber);
      const edit = new OffsetEdit(inlineTexts.map((t) => SingleOffsetEdit.insert(t.column - 1, t.text)));
      const tokens = syntaxHighlightingEnabled ? textModel.tokenization.tokenizeLinesAt(ghostText.lineNumber, [edit.apply(currentLine), ...additionalLines.map((l) => l.content)]) : void 0;
      const newRanges = edit.getNewTextRanges();
      const inlineTextsWithTokens = inlineTexts.map((t, idx) => ({ ...t, tokens: tokens?.[0]?.getTokensInRange(newRanges[idx]) }));
      const tokenizedAdditionalLines = additionalLines.map((l, idx) => ({
        content: tokens?.[idx + 1] ?? LineTokens.createEmpty(l.content, this._languageService.languageIdCodec),
        decorations: l.decorations
      }));
      return {
        replacedRange,
        inlineTexts: inlineTextsWithTokens,
        additionalLines: tokenizedAdditionalLines,
        hiddenRange,
        lineNumber: ghostText.lineNumber,
        additionalReservedLineCount: this._model.minReservedLineCount.read(reader),
        targetTextModel: textModel,
        syntaxHighlightingEnabled
      };
    });
    this.decorations = derived(this, (reader) => {
      const uiState = this.uiState.read(reader);
      if (!uiState) {
        return [];
      }
      const decorations = [];
      const extraClassNames = this._extraClassNames.read(reader);
      if (uiState.replacedRange) {
        decorations.push({
          range: uiState.replacedRange.toRange(uiState.lineNumber),
          options: { inlineClassName: "inline-completion-text-to-replace" + extraClassNames, description: "GhostTextReplacement" }
        });
      }
      if (uiState.hiddenRange) {
        decorations.push({
          range: uiState.hiddenRange.toRange(uiState.lineNumber),
          options: { inlineClassName: "ghost-text-hidden", description: "ghost-text-hidden" }
        });
      }
      for (const p of uiState.inlineTexts) {
        decorations.push({
          range: Range.fromPositions(new Position(uiState.lineNumber, p.column)),
          options: {
            description: "ghost-text-decoration",
            after: {
              content: p.text,
              tokens: p.tokens,
              inlineClassName: (p.preview ? "ghost-text-decoration-preview" : "ghost-text-decoration") + (this._isClickable ? " clickable" : "") + extraClassNames + p.lineDecorations.map((d) => " " + d.className).join(" "),
              // TODO: take the ranges into account for line decorations
              cursorStops: InjectedTextCursorStops.Left,
              attachedData: new GhostTextAttachedData(this)
            },
            showIfCollapsed: true
          }
        });
      }
      return decorations;
    });
    this._additionalLinesWidget = this._register(
      new AdditionalLinesWidget(
        this._editor,
        derived((reader) => {
          const uiState = this.uiState.read(reader);
          return uiState ? {
            lineNumber: uiState.lineNumber,
            additionalLines: uiState.additionalLines,
            minReservedLineCount: uiState.additionalReservedLineCount,
            targetTextModel: uiState.targetTextModel
          } : void 0;
        }),
        this._shouldKeepCursorStable,
        this._isClickable
      )
    );
    this._isInlineTextHovered = this._editorObs.isTargetHovered(
      (p) => p.target.type === MouseTargetType.CONTENT_TEXT && p.target.detail.injectedText?.options.attachedData instanceof GhostTextAttachedData && p.target.detail.injectedText.options.attachedData.owner === this,
      this._store
    );
    this.isHovered = derived(this, (reader) => {
      if (this._isDisposed.read(reader)) {
        return false;
      }
      return this._isInlineTextHovered.read(reader) || this._additionalLinesWidget.isHovered.read(reader);
    });
    this.height = derived(this, (reader) => {
      const lineHeight = this._editorObs.getOption(EditorOption.lineHeight).read(reader);
      return lineHeight + (this._additionalLinesWidget.viewZoneHeight.read(reader) ?? 0);
    });
    this._register(toDisposable(() => {
      this._isDisposed.set(true, void 0);
    }));
    this._register(this._editorObs.setDecorations(this.decorations));
    if (this._isClickable) {
      this._register(this._additionalLinesWidget.onDidClick((e) => this._onDidClick.fire(e)));
      this._register(this._editor.onMouseUp((e) => {
        if (e.target.type !== MouseTargetType.CONTENT_TEXT) {
          return;
        }
        const a = e.target.detail.injectedText?.options.attachedData;
        if (a instanceof GhostTextAttachedData && a.owner === this) {
          this._onDidClick.fire(e.event);
        }
      }));
    }
    this._register(autorunWithStore((reader, store) => {
      if (USE_SQUIGGLES_FOR_WARNING) {
        return;
      }
      const state = this._warningState.read(reader);
      if (!state) {
        return;
      }
      const lineHeight = this._editorObs.getOption(EditorOption.lineHeight);
      store.add(this._editorObs.createContentWidget({
        position: constObservable({
          position: new Position(state.lineNumber, Number.MAX_SAFE_INTEGER),
          preference: [ContentWidgetPositionPreference.EXACT],
          positionAffinity: PositionAffinity.Right
        }),
        allowEditorOverflow: false,
        domNode: n.div({
          class: "ghost-text-view-warning-widget",
          style: {
            width: lineHeight,
            height: lineHeight,
            marginLeft: 4,
            color: "orange"
          },
          ref: (dom) => {
            dom.ghostTextViewWarningWidgetData = { range: Range.fromPositions(state.position) };
          }
        }, [
          n.div({
            class: "ghost-text-view-warning-widget-icon",
            style: {
              width: "100%",
              height: "100%",
              display: "flex",
              alignContent: "center",
              alignItems: "center"
            }
          }, [
            renderIcon(state.icon && "id" in state.icon ? state.icon : Codicon.warning)
          ])
        ]).keepUpdated(store).element
      }));
    }));
  }
  static getWarningWidgetContext(domNode) {
    const data = domNode.ghostTextViewWarningWidgetData;
    if (data) {
      return data;
    } else if (domNode.parentElement) {
      return this.getWarningWidgetContext(domNode.parentElement);
    }
    return void 0;
  }
  ownsViewZone(viewZoneId) {
    return this._additionalLinesWidget.viewZoneId === viewZoneId;
  }
};
GhostTextView.hot = createHotClass(GhostTextView);
GhostTextView = __decorateClass([
  __decorateParam(5, ILanguageService)
], GhostTextView);
class GhostTextAttachedData {
  constructor(owner) {
    this.owner = owner;
  }
}
function computeGhostTextViewData(ghostText, textModel, ghostTextClassName) {
  const inlineTexts = [];
  const additionalLines = [];
  function addToAdditionalLines(ghLines, className) {
    if (additionalLines.length > 0) {
      const lastLine = additionalLines[additionalLines.length - 1];
      if (className) {
        lastLine.decorations.push(new LineDecoration(
          lastLine.content.length + 1,
          lastLine.content.length + 1 + ghLines[0].line.length,
          className,
          InlineDecorationType.Regular
        ));
      }
      lastLine.content += ghLines[0].line;
      ghLines = ghLines.slice(1);
    }
    for (const ghLine of ghLines) {
      additionalLines.push({
        content: ghLine.line,
        decorations: className ? [new LineDecoration(
          1,
          ghLine.line.length + 1,
          className,
          InlineDecorationType.Regular
        ), ...ghLine.lineDecorations] : [...ghLine.lineDecorations]
      });
    }
  }
  const textBufferLine = textModel.getLineContent(ghostText.lineNumber);
  let hiddenTextStartColumn = void 0;
  let lastIdx = 0;
  for (const part of ghostText.parts) {
    let ghLines = part.lines;
    if (hiddenTextStartColumn === void 0) {
      inlineTexts.push({ column: part.column, text: ghLines[0].line, preview: part.preview, lineDecorations: ghLines[0].lineDecorations });
      ghLines = ghLines.slice(1);
    } else {
      addToAdditionalLines([{ line: textBufferLine.substring(lastIdx, part.column - 1), lineDecorations: [] }], void 0);
    }
    if (ghLines.length > 0) {
      addToAdditionalLines(ghLines, ghostTextClassName);
      if (hiddenTextStartColumn === void 0 && part.column <= textBufferLine.length) {
        hiddenTextStartColumn = part.column;
      }
    }
    lastIdx = part.column - 1;
  }
  if (hiddenTextStartColumn !== void 0) {
    addToAdditionalLines([{ line: textBufferLine.substring(lastIdx), lineDecorations: [] }], void 0);
  }
  const hiddenRange = hiddenTextStartColumn !== void 0 ? new ColumnRange(hiddenTextStartColumn, textBufferLine.length + 1) : void 0;
  return {
    inlineTexts,
    additionalLines,
    hiddenRange
  };
}
class AdditionalLinesWidget extends Disposable {
  constructor(_editor, _lines, _shouldKeepCursorStable, _isClickable) {
    super();
    this._editor = _editor;
    this._lines = _lines;
    this._shouldKeepCursorStable = _shouldKeepCursorStable;
    this._isClickable = _isClickable;
    this._viewZoneHeight = observableValue("viewZoneHeight", void 0);
    this.editorOptionsChanged = observableSignalFromEvent("editorOptionChanged", Event.filter(
      this._editor.onDidChangeConfiguration,
      (e) => e.hasChanged(EditorOption.disableMonospaceOptimizations) || e.hasChanged(EditorOption.stopRenderingLineAfter) || e.hasChanged(EditorOption.renderWhitespace) || e.hasChanged(EditorOption.renderControlCharacters) || e.hasChanged(EditorOption.fontLigatures) || e.hasChanged(EditorOption.fontInfo) || e.hasChanged(EditorOption.lineHeight)
    ));
    this._onDidClick = this._register(new Emitter());
    this.onDidClick = this._onDidClick.event;
    this._viewZoneListener = this._register(new MutableDisposable());
    this.isHovered = observableCodeEditor(this._editor).isTargetHovered(
      (p) => isTargetGhostText(p.target.element),
      this._store
    );
    this.hasBeenAccepted = false;
    if (this._editor instanceof CodeEditorWidget && this._shouldKeepCursorStable) {
      this._register(this._editor.onBeforeExecuteEdit((e) => this.hasBeenAccepted = e.source === "inlineSuggestion.accept"));
    }
    this._register(autorun((reader) => {
      const lines = this._lines.read(reader);
      this.editorOptionsChanged.read(reader);
      if (lines) {
        this.hasBeenAccepted = false;
        this.updateLines(lines.lineNumber, lines.additionalLines, lines.minReservedLineCount);
      } else {
        this.clear();
      }
    }));
  }
  get viewZoneId() {
    return this._viewZoneInfo?.viewZoneId;
  }
  get viewZoneHeight() {
    return this._viewZoneHeight;
  }
  dispose() {
    super.dispose();
    this.clear();
  }
  clear() {
    this._viewZoneListener.clear();
    this._editor.changeViewZones((changeAccessor) => {
      this.removeActiveViewZone(changeAccessor);
    });
  }
  updateLines(lineNumber, additionalLines, minReservedLineCount) {
    const textModel = this._editor.getModel();
    if (!textModel) {
      return;
    }
    const { tabSize } = textModel.getOptions();
    this._editor.changeViewZones((changeAccessor) => {
      const store = new DisposableStore();
      this.removeActiveViewZone(changeAccessor);
      const heightInLines = Math.max(additionalLines.length, minReservedLineCount);
      if (heightInLines > 0) {
        const domNode = document.createElement("div");
        renderLines(domNode, tabSize, additionalLines, this._editor.getOptions(), this._isClickable);
        if (this._isClickable) {
          store.add(addDisposableListener(domNode, "mousedown", (e) => {
            e.preventDefault();
          }));
          store.add(addDisposableListener(domNode, "click", (e) => {
            if (isTargetGhostText(e.target)) {
              this._onDidClick.fire(new StandardMouseEvent(getWindow(e), e));
            }
          }));
        }
        this.addViewZone(changeAccessor, lineNumber, heightInLines, domNode);
      }
      this._viewZoneListener.value = store;
    });
  }
  addViewZone(changeAccessor, afterLineNumber, heightInLines, domNode) {
    const id = changeAccessor.addZone({
      afterLineNumber,
      heightInLines,
      domNode,
      afterColumnAffinity: PositionAffinity.Right,
      onComputedHeight: (height) => {
        this._viewZoneHeight.set(height, void 0);
      }
    });
    this.keepCursorStable(afterLineNumber, heightInLines);
    this._viewZoneInfo = { viewZoneId: id, heightInLines, lineNumber: afterLineNumber };
  }
  removeActiveViewZone(changeAccessor) {
    if (this._viewZoneInfo) {
      changeAccessor.removeZone(this._viewZoneInfo.viewZoneId);
      if (!this.hasBeenAccepted) {
        this.keepCursorStable(this._viewZoneInfo.lineNumber, -this._viewZoneInfo.heightInLines);
      }
      this._viewZoneInfo = void 0;
      this._viewZoneHeight.set(void 0, void 0);
    }
  }
  keepCursorStable(lineNumber, heightInLines) {
    if (!this._shouldKeepCursorStable) {
      return;
    }
    const cursorLineNumber = this._editor.getSelection()?.getStartPosition()?.lineNumber;
    if (cursorLineNumber !== void 0 && lineNumber < cursorLineNumber) {
      this._editor.setScrollTop(this._editor.getScrollTop() + heightInLines * this._editor.getOption(EditorOption.lineHeight));
    }
  }
}
function isTargetGhostText(target) {
  return isHTMLElement(target) && target.classList.contains(GHOST_TEXT_CLASS_NAME);
}
function renderLines(domNode, tabSize, lines, opts, isClickable) {
  const disableMonospaceOptimizations = opts.get(EditorOption.disableMonospaceOptimizations);
  const stopRenderingLineAfter = opts.get(EditorOption.stopRenderingLineAfter);
  const renderWhitespace = "none";
  const renderControlCharacters = opts.get(EditorOption.renderControlCharacters);
  const fontLigatures = opts.get(EditorOption.fontLigatures);
  const fontInfo = opts.get(EditorOption.fontInfo);
  const lineHeight = opts.get(EditorOption.lineHeight);
  let classNames = "suggest-preview-text";
  if (isClickable) {
    classNames += " clickable";
  }
  const sb = new StringBuilder(1e4);
  sb.appendString(`<div class="${classNames}">`);
  for (let i = 0, len = lines.length; i < len; i++) {
    const lineData = lines[i];
    const lineTokens = lineData.content;
    sb.appendString('<div class="view-line');
    sb.appendString('" style="top:');
    sb.appendString(String(i * lineHeight));
    sb.appendString('px;width:1000000px;">');
    const line = lineTokens.getLineContent();
    const isBasicASCII = strings.isBasicASCII(line);
    const containsRTL = strings.containsRTL(line);
    renderViewLine(new RenderLineInput(
      fontInfo.isMonospace && !disableMonospaceOptimizations,
      fontInfo.canUseHalfwidthRightwardsArrow,
      line,
      false,
      isBasicASCII,
      containsRTL,
      0,
      lineTokens,
      lineData.decorations,
      tabSize,
      0,
      fontInfo.spaceWidth,
      fontInfo.middotWidth,
      fontInfo.wsmiddotWidth,
      stopRenderingLineAfter,
      renderWhitespace,
      renderControlCharacters,
      fontLigatures !== EditorFontLigatures.OFF,
      null
    ), sb);
    sb.appendString("</div>");
  }
  sb.appendString("</div>");
  applyFontInfo(domNode, fontInfo);
  const html = sb.build();
  const trustedhtml = ttPolicy ? ttPolicy.createHTML(html) : html;
  domNode.innerHTML = trustedhtml;
}
const ttPolicy = createTrustedTypesPolicy("editorGhostText", { createHTML: (value) => value });
export {
  AdditionalLinesWidget,
  GhostTextView,
  ttPolicy
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy9lZGl0b3IvY29udHJpYi9pbmxpbmVDb21wbGV0aW9ucy9icm93c2VyL3ZpZXcvZ2hvc3RUZXh0L2dob3N0VGV4dFZpZXcudHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbIi8qLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG4gKiAgQ29weXJpZ2h0IChjKSBNaWNyb3NvZnQgQ29ycG9yYXRpb24uIEFsbCByaWdodHMgcmVzZXJ2ZWQuXG4gKiAgTGljZW5zZWQgdW5kZXIgdGhlIE1JVCBMaWNlbnNlLiBTZWUgTGljZW5zZS50eHQgaW4gdGhlIHByb2plY3Qgcm9vdCBmb3IgbGljZW5zZSBpbmZvcm1hdGlvbi5cbiAqLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0qL1xuXG5pbXBvcnQgeyBjcmVhdGVUcnVzdGVkVHlwZXNQb2xpY3kgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi8uLi9iYXNlL2Jyb3dzZXIvdHJ1c3RlZFR5cGVzLmpzJztcbmltcG9ydCB7IHJlbmRlckljb24gfSBmcm9tICcuLi8uLi8uLi8uLi8uLi8uLi9iYXNlL2Jyb3dzZXIvdWkvaWNvbkxhYmVsL2ljb25MYWJlbHMuanMnO1xuaW1wb3J0IHsgQ29kaWNvbiB9IGZyb20gJy4uLy4uLy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2NvZGljb25zLmpzJztcbmltcG9ydCB7IEVtaXR0ZXIsIEV2ZW50IH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vZXZlbnQuanMnO1xuaW1wb3J0IHsgY3JlYXRlSG90Q2xhc3MgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9ob3RSZWxvYWRIZWxwZXJzLmpzJztcbmltcG9ydCB7IERpc3Bvc2FibGUsIERpc3Bvc2FibGVTdG9yZSwgTXV0YWJsZURpc3Bvc2FibGUsIHRvRGlzcG9zYWJsZSB9IGZyb20gJy4uLy4uLy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2xpZmVjeWNsZS5qcyc7XG5pbXBvcnQgeyBJT2JzZXJ2YWJsZSwgYXV0b3J1biwgYXV0b3J1bldpdGhTdG9yZSwgY29uc3RPYnNlcnZhYmxlLCBkZXJpdmVkLCBvYnNlcnZhYmxlU2lnbmFsRnJvbUV2ZW50LCBvYnNlcnZhYmxlVmFsdWUgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9vYnNlcnZhYmxlLmpzJztcbmltcG9ydCAqIGFzIHN0cmluZ3MgZnJvbSAnLi4vLi4vLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vc3RyaW5ncy5qcyc7XG5pbXBvcnQgeyBhcHBseUZvbnRJbmZvIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vYnJvd3Nlci9jb25maWcvZG9tRm9udEluZm8uanMnO1xuaW1wb3J0IHsgQ29udGVudFdpZGdldFBvc2l0aW9uUHJlZmVyZW5jZSwgSUNvZGVFZGl0b3IsIElDb250ZW50V2lkZ2V0UG9zaXRpb24sIElWaWV3Wm9uZUNoYW5nZUFjY2Vzc29yLCBNb3VzZVRhcmdldFR5cGUgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9icm93c2VyL2VkaXRvckJyb3dzZXIuanMnO1xuaW1wb3J0IHsgb2JzZXJ2YWJsZUNvZGVFZGl0b3IgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9icm93c2VyL29ic2VydmFibGVDb2RlRWRpdG9yLmpzJztcbmltcG9ydCB7IEVkaXRvckZvbnRMaWdhdHVyZXMsIEVkaXRvck9wdGlvbiwgSUNvbXB1dGVkRWRpdG9yT3B0aW9ucyB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL2NvbW1vbi9jb25maWcvZWRpdG9yT3B0aW9ucy5qcyc7XG5pbXBvcnQgeyBPZmZzZXRFZGl0LCBTaW5nbGVPZmZzZXRFZGl0IH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vY29tbW9uL2NvcmUvb2Zmc2V0RWRpdC5qcyc7XG5pbXBvcnQgeyBQb3NpdGlvbiB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL2NvbW1vbi9jb3JlL3Bvc2l0aW9uLmpzJztcbmltcG9ydCB7IFJhbmdlIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vY29tbW9uL2NvcmUvcmFuZ2UuanMnO1xuaW1wb3J0IHsgU3RyaW5nQnVpbGRlciB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL2NvbW1vbi9jb3JlL3N0cmluZ0J1aWxkZXIuanMnO1xuaW1wb3J0IHsgSWNvblBhdGggfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9jb21tb24vbGFuZ3VhZ2VzLmpzJztcbmltcG9ydCB7IElMYW5ndWFnZVNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9jb21tb24vbGFuZ3VhZ2VzL2xhbmd1YWdlLmpzJztcbmltcG9ydCB7IElNb2RlbERlbHRhRGVjb3JhdGlvbiwgSVRleHRNb2RlbCwgSW5qZWN0ZWRUZXh0Q3Vyc29yU3RvcHMsIFBvc2l0aW9uQWZmaW5pdHkgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9jb21tb24vbW9kZWwuanMnO1xuaW1wb3J0IHsgTGluZVRva2VucyB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL2NvbW1vbi90b2tlbnMvbGluZVRva2Vucy5qcyc7XG5pbXBvcnQgeyBMaW5lRGVjb3JhdGlvbiB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL2NvbW1vbi92aWV3TGF5b3V0L2xpbmVEZWNvcmF0aW9ucy5qcyc7XG5pbXBvcnQgeyBSZW5kZXJMaW5lSW5wdXQsIHJlbmRlclZpZXdMaW5lIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vY29tbW9uL3ZpZXdMYXlvdXQvdmlld0xpbmVSZW5kZXJlci5qcyc7XG5pbXBvcnQgeyBJbmxpbmVEZWNvcmF0aW9uVHlwZSB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL2NvbW1vbi92aWV3TW9kZWwuanMnO1xuaW1wb3J0IHsgR2hvc3RUZXh0LCBHaG9zdFRleHRSZXBsYWNlbWVudCwgSUdob3N0VGV4dExpbmUgfSBmcm9tICcuLi8uLi9tb2RlbC9naG9zdFRleHQuanMnO1xuaW1wb3J0IHsgQ29sdW1uUmFuZ2UgfSBmcm9tICcuLi8uLi91dGlscy5qcyc7XG5pbXBvcnQgeyBhZGREaXNwb3NhYmxlTGlzdGVuZXIsIGdldFdpbmRvdywgaXNIVE1MRWxlbWVudCwgbiB9IGZyb20gJy4uLy4uLy4uLy4uLy4uLy4uL2Jhc2UvYnJvd3Nlci9kb20uanMnO1xuaW1wb3J0ICcuL2dob3N0VGV4dFZpZXcuY3NzJztcbmltcG9ydCB7IElNb3VzZUV2ZW50LCBTdGFuZGFyZE1vdXNlRXZlbnQgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi8uLi9iYXNlL2Jyb3dzZXIvbW91c2VFdmVudC5qcyc7XG5pbXBvcnQgeyBDb2RlRWRpdG9yV2lkZ2V0IH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vYnJvd3Nlci93aWRnZXQvY29kZUVkaXRvci9jb2RlRWRpdG9yV2lkZ2V0LmpzJztcblxuZXhwb3J0IGludGVyZmFjZSBJR2hvc3RUZXh0V2lkZ2V0TW9kZWwge1xuXHRyZWFkb25seSB0YXJnZXRUZXh0TW9kZWw6IElPYnNlcnZhYmxlPElUZXh0TW9kZWwgfCB1bmRlZmluZWQ+O1xuXHRyZWFkb25seSBnaG9zdFRleHQ6IElPYnNlcnZhYmxlPEdob3N0VGV4dCB8IEdob3N0VGV4dFJlcGxhY2VtZW50IHwgdW5kZWZpbmVkPjtcblx0cmVhZG9ubHkgd2FybmluZzogSU9ic2VydmFibGU8eyBpY29uOiBJY29uUGF0aCB8IHVuZGVmaW5lZCB9IHwgdW5kZWZpbmVkPjtcblx0cmVhZG9ubHkgbWluUmVzZXJ2ZWRMaW5lQ291bnQ6IElPYnNlcnZhYmxlPG51bWJlcj47XG59XG5cbmNvbnN0IFVTRV9TUVVJR0dMRVNfRk9SX1dBUk5JTkcgPSB0cnVlO1xuY29uc3QgR0hPU1RfVEVYVF9DTEFTU19OQU1FID0gJ2dob3N0LXRleHQnO1xuXG5leHBvcnQgY2xhc3MgR2hvc3RUZXh0VmlldyBleHRlbmRzIERpc3Bvc2FibGUge1xuXHRwcml2YXRlIHJlYWRvbmx5IF9pc0Rpc3Bvc2VkID0gb2JzZXJ2YWJsZVZhbHVlKHRoaXMsIGZhbHNlKTtcblx0cHJpdmF0ZSByZWFkb25seSBfZWRpdG9yT2JzID0gb2JzZXJ2YWJsZUNvZGVFZGl0b3IodGhpcy5fZWRpdG9yKTtcblx0cHVibGljIHN0YXRpYyBob3QgPSBjcmVhdGVIb3RDbGFzcyhHaG9zdFRleHRWaWV3KTtcblxuXHRwcml2YXRlIF93YXJuaW5nU3RhdGUgPSBkZXJpdmVkKHJlYWRlciA9PiB7XG5cdFx0Y29uc3QgZ3QgPSB0aGlzLl9tb2RlbC5naG9zdFRleHQucmVhZChyZWFkZXIpO1xuXHRcdGlmICghZ3QpIHsgcmV0dXJuIHVuZGVmaW5lZDsgfVxuXHRcdGNvbnN0IHdhcm5pbmcgPSB0aGlzLl9tb2RlbC53YXJuaW5nLnJlYWQocmVhZGVyKTtcblx0XHRpZiAoIXdhcm5pbmcpIHsgcmV0dXJuIHVuZGVmaW5lZDsgfVxuXHRcdHJldHVybiB7IGxpbmVOdW1iZXI6IGd0LmxpbmVOdW1iZXIsIHBvc2l0aW9uOiBuZXcgUG9zaXRpb24oZ3QubGluZU51bWJlciwgZ3QucGFydHNbMF0uY29sdW1uKSwgaWNvbjogd2FybmluZy5pY29uIH07XG5cdH0pO1xuXG5cdHByaXZhdGUgcmVhZG9ubHkgX29uRGlkQ2xpY2sgPSB0aGlzLl9yZWdpc3RlcihuZXcgRW1pdHRlcjxJTW91c2VFdmVudD4oKSk7XG5cdHB1YmxpYyByZWFkb25seSBvbkRpZENsaWNrID0gdGhpcy5fb25EaWRDbGljay5ldmVudDtcblxuXHRjb25zdHJ1Y3Rvcihcblx0XHRwcml2YXRlIHJlYWRvbmx5IF9lZGl0b3I6IElDb2RlRWRpdG9yLFxuXHRcdHByaXZhdGUgcmVhZG9ubHkgX21vZGVsOiBJR2hvc3RUZXh0V2lkZ2V0TW9kZWwsXG5cdFx0cHJpdmF0ZSByZWFkb25seSBfb3B0aW9uczogSU9ic2VydmFibGU8e1xuXHRcdFx0ZXh0cmFDbGFzc2VzPzogc3RyaW5nW107XG5cdFx0XHRzeW50YXhIaWdobGlnaHRpbmdFbmFibGVkOiBib29sZWFuO1xuXHRcdH0+LFxuXHRcdHByaXZhdGUgcmVhZG9ubHkgX3Nob3VsZEtlZXBDdXJzb3JTdGFibGU6IGJvb2xlYW4sXG5cdFx0cHJpdmF0ZSByZWFkb25seSBfaXNDbGlja2FibGU6IGJvb2xlYW4sXG5cdFx0QElMYW5ndWFnZVNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBfbGFuZ3VhZ2VTZXJ2aWNlOiBJTGFuZ3VhZ2VTZXJ2aWNlLFxuXHQpIHtcblx0XHRzdXBlcigpO1xuXG5cdFx0dGhpcy5fcmVnaXN0ZXIodG9EaXNwb3NhYmxlKCgpID0+IHsgdGhpcy5faXNEaXNwb3NlZC5zZXQodHJ1ZSwgdW5kZWZpbmVkKTsgfSkpO1xuXHRcdHRoaXMuX3JlZ2lzdGVyKHRoaXMuX2VkaXRvck9icy5zZXREZWNvcmF0aW9ucyh0aGlzLmRlY29yYXRpb25zKSk7XG5cblx0XHRpZiAodGhpcy5faXNDbGlja2FibGUpIHtcblx0XHRcdHRoaXMuX3JlZ2lzdGVyKHRoaXMuX2FkZGl0aW9uYWxMaW5lc1dpZGdldC5vbkRpZENsaWNrKChlKSA9PiB0aGlzLl9vbkRpZENsaWNrLmZpcmUoZSkpKTtcblx0XHRcdHRoaXMuX3JlZ2lzdGVyKHRoaXMuX2VkaXRvci5vbk1vdXNlVXAoZSA9PiB7XG5cdFx0XHRcdGlmIChlLnRhcmdldC50eXBlICE9PSBNb3VzZVRhcmdldFR5cGUuQ09OVEVOVF9URVhUKSB7XG5cdFx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0XHR9XG5cdFx0XHRcdGNvbnN0IGEgPSBlLnRhcmdldC5kZXRhaWwuaW5qZWN0ZWRUZXh0Py5vcHRpb25zLmF0dGFjaGVkRGF0YTtcblx0XHRcdFx0aWYgKGEgaW5zdGFuY2VvZiBHaG9zdFRleHRBdHRhY2hlZERhdGEgJiYgYS5vd25lciA9PT0gdGhpcykge1xuXHRcdFx0XHRcdHRoaXMuX29uRGlkQ2xpY2suZmlyZShlLmV2ZW50KTtcblx0XHRcdFx0fVxuXHRcdFx0fSkpO1xuXHRcdH1cblxuXHRcdHRoaXMuX3JlZ2lzdGVyKGF1dG9ydW5XaXRoU3RvcmUoKHJlYWRlciwgc3RvcmUpID0+IHtcblx0XHRcdGlmIChVU0VfU1FVSUdHTEVTX0ZPUl9XQVJOSU5HKSB7XG5cdFx0XHRcdHJldHVybjtcblx0XHRcdH1cblxuXHRcdFx0Y29uc3Qgc3RhdGUgPSB0aGlzLl93YXJuaW5nU3RhdGUucmVhZChyZWFkZXIpO1xuXHRcdFx0aWYgKCFzdGF0ZSkge1xuXHRcdFx0XHRyZXR1cm47XG5cdFx0XHR9XG5cblx0XHRcdGNvbnN0IGxpbmVIZWlnaHQgPSB0aGlzLl9lZGl0b3JPYnMuZ2V0T3B0aW9uKEVkaXRvck9wdGlvbi5saW5lSGVpZ2h0KTtcblx0XHRcdHN0b3JlLmFkZCh0aGlzLl9lZGl0b3JPYnMuY3JlYXRlQ29udGVudFdpZGdldCh7XG5cdFx0XHRcdHBvc2l0aW9uOiBjb25zdE9ic2VydmFibGU8SUNvbnRlbnRXaWRnZXRQb3NpdGlvbj4oe1xuXHRcdFx0XHRcdHBvc2l0aW9uOiBuZXcgUG9zaXRpb24oc3RhdGUubGluZU51bWJlciwgTnVtYmVyLk1BWF9TQUZFX0lOVEVHRVIpLFxuXHRcdFx0XHRcdHByZWZlcmVuY2U6IFtDb250ZW50V2lkZ2V0UG9zaXRpb25QcmVmZXJlbmNlLkVYQUNUXSxcblx0XHRcdFx0XHRwb3NpdGlvbkFmZmluaXR5OiBQb3NpdGlvbkFmZmluaXR5LlJpZ2h0LFxuXHRcdFx0XHR9KSxcblx0XHRcdFx0YWxsb3dFZGl0b3JPdmVyZmxvdzogZmFsc2UsXG5cdFx0XHRcdGRvbU5vZGU6IG4uZGl2KHtcblx0XHRcdFx0XHRjbGFzczogJ2dob3N0LXRleHQtdmlldy13YXJuaW5nLXdpZGdldCcsXG5cdFx0XHRcdFx0c3R5bGU6IHtcblx0XHRcdFx0XHRcdHdpZHRoOiBsaW5lSGVpZ2h0LFxuXHRcdFx0XHRcdFx0aGVpZ2h0OiBsaW5lSGVpZ2h0LFxuXHRcdFx0XHRcdFx0bWFyZ2luTGVmdDogNCxcblx0XHRcdFx0XHRcdGNvbG9yOiAnb3JhbmdlJyxcblx0XHRcdFx0XHR9LFxuXHRcdFx0XHRcdHJlZjogKGRvbSkgPT4ge1xuXHRcdFx0XHRcdFx0KGRvbSBhcyBhbnkgYXMgV2lkZ2V0RG9tRWxlbWVudCkuZ2hvc3RUZXh0Vmlld1dhcm5pbmdXaWRnZXREYXRhID0geyByYW5nZTogUmFuZ2UuZnJvbVBvc2l0aW9ucyhzdGF0ZS5wb3NpdGlvbikgfTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdH0sIFtcblx0XHRcdFx0XHRuLmRpdih7XG5cdFx0XHRcdFx0XHRjbGFzczogJ2dob3N0LXRleHQtdmlldy13YXJuaW5nLXdpZGdldC1pY29uJyxcblx0XHRcdFx0XHRcdHN0eWxlOiB7XG5cdFx0XHRcdFx0XHRcdHdpZHRoOiAnMTAwJScsXG5cdFx0XHRcdFx0XHRcdGhlaWdodDogJzEwMCUnLFxuXHRcdFx0XHRcdFx0XHRkaXNwbGF5OiAnZmxleCcsXG5cdFx0XHRcdFx0XHRcdGFsaWduQ29udGVudDogJ2NlbnRlcicsXG5cdFx0XHRcdFx0XHRcdGFsaWduSXRlbXM6ICdjZW50ZXInLFxuXHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdH0sIFtcblx0XHRcdFx0XHRcdHJlbmRlckljb24oKHN0YXRlLmljb24gJiYgJ2lkJyBpbiBzdGF0ZS5pY29uKSA/IHN0YXRlLmljb24gOiBDb2RpY29uLndhcm5pbmcpLFxuXHRcdFx0XHRcdF0pXG5cdFx0XHRcdF0pLmtlZXBVcGRhdGVkKHN0b3JlKS5lbGVtZW50LFxuXHRcdFx0fSkpO1xuXHRcdH0pKTtcblx0fVxuXG5cdHB1YmxpYyBzdGF0aWMgZ2V0V2FybmluZ1dpZGdldENvbnRleHQoZG9tTm9kZTogSFRNTEVsZW1lbnQpOiB7IHJhbmdlOiBSYW5nZSB9IHwgdW5kZWZpbmVkIHtcblx0XHRjb25zdCBkYXRhID0gKGRvbU5vZGUgYXMgYW55IGFzIFdpZGdldERvbUVsZW1lbnQpLmdob3N0VGV4dFZpZXdXYXJuaW5nV2lkZ2V0RGF0YTtcblx0XHRpZiAoZGF0YSkge1xuXHRcdFx0cmV0dXJuIGRhdGE7XG5cdFx0fSBlbHNlIGlmIChkb21Ob2RlLnBhcmVudEVsZW1lbnQpIHtcblx0XHRcdHJldHVybiB0aGlzLmdldFdhcm5pbmdXaWRnZXRDb250ZXh0KGRvbU5vZGUucGFyZW50RWxlbWVudCk7XG5cdFx0fVxuXHRcdHJldHVybiB1bmRlZmluZWQ7XG5cdH1cblxuXHRwcml2YXRlIHJlYWRvbmx5IF91c2VTeW50YXhIaWdobGlnaHRpbmcgPSB0aGlzLl9vcHRpb25zLm1hcChvID0+IG8uc3ludGF4SGlnaGxpZ2h0aW5nRW5hYmxlZCk7XG5cblx0cHJpdmF0ZSByZWFkb25seSBfZXh0cmFDbGFzc05hbWVzID0gZGVyaXZlZCh0aGlzLCByZWFkZXIgPT4ge1xuXHRcdGNvbnN0IGV4dHJhQ2xhc3NlcyA9IFsuLi50aGlzLl9vcHRpb25zLnJlYWQocmVhZGVyKS5leHRyYUNsYXNzZXMgPz8gW11dO1xuXHRcdGlmICh0aGlzLl91c2VTeW50YXhIaWdobGlnaHRpbmcucmVhZChyZWFkZXIpKSB7XG5cdFx0XHRleHRyYUNsYXNzZXMucHVzaCgnc3ludGF4LWhpZ2hsaWdodGVkJyk7XG5cdFx0fVxuXHRcdGlmIChVU0VfU1FVSUdHTEVTX0ZPUl9XQVJOSU5HICYmIHRoaXMuX3dhcm5pbmdTdGF0ZS5yZWFkKHJlYWRlcikpIHtcblx0XHRcdGV4dHJhQ2xhc3Nlcy5wdXNoKCd3YXJuaW5nJyk7XG5cdFx0fVxuXHRcdGNvbnN0IGV4dHJhQ2xhc3NOYW1lcyA9IGV4dHJhQ2xhc3Nlcy5tYXAoYyA9PiBgICR7Y31gKS5qb2luKCcnKTtcblx0XHRyZXR1cm4gZXh0cmFDbGFzc05hbWVzO1xuXHR9KTtcblxuXHRwcml2YXRlIHJlYWRvbmx5IHVpU3RhdGUgPSBkZXJpdmVkKHRoaXMsIHJlYWRlciA9PiB7XG5cdFx0aWYgKHRoaXMuX2lzRGlzcG9zZWQucmVhZChyZWFkZXIpKSB7IHJldHVybiB1bmRlZmluZWQ7IH1cblx0XHRjb25zdCB0ZXh0TW9kZWwgPSB0aGlzLl9lZGl0b3JPYnMubW9kZWwucmVhZChyZWFkZXIpO1xuXHRcdGlmICh0ZXh0TW9kZWwgIT09IHRoaXMuX21vZGVsLnRhcmdldFRleHRNb2RlbC5yZWFkKHJlYWRlcikpIHsgcmV0dXJuIHVuZGVmaW5lZDsgfVxuXHRcdGNvbnN0IGdob3N0VGV4dCA9IHRoaXMuX21vZGVsLmdob3N0VGV4dC5yZWFkKHJlYWRlcik7XG5cdFx0aWYgKCFnaG9zdFRleHQpIHsgcmV0dXJuIHVuZGVmaW5lZDsgfVxuXG5cdFx0Y29uc3QgcmVwbGFjZWRSYW5nZSA9IGdob3N0VGV4dCBpbnN0YW5jZW9mIEdob3N0VGV4dFJlcGxhY2VtZW50ID8gZ2hvc3RUZXh0LmNvbHVtblJhbmdlIDogdW5kZWZpbmVkO1xuXG5cdFx0Y29uc3Qgc3ludGF4SGlnaGxpZ2h0aW5nRW5hYmxlZCA9IHRoaXMuX3VzZVN5bnRheEhpZ2hsaWdodGluZy5yZWFkKHJlYWRlcik7XG5cdFx0Y29uc3QgZXh0cmFDbGFzc05hbWVzID0gdGhpcy5fZXh0cmFDbGFzc05hbWVzLnJlYWQocmVhZGVyKTtcblx0XHRjb25zdCB7IGlubGluZVRleHRzLCBhZGRpdGlvbmFsTGluZXMsIGhpZGRlblJhbmdlIH0gPSBjb21wdXRlR2hvc3RUZXh0Vmlld0RhdGEoZ2hvc3RUZXh0LCB0ZXh0TW9kZWwsIEdIT1NUX1RFWFRfQ0xBU1NfTkFNRSArIGV4dHJhQ2xhc3NOYW1lcyk7XG5cblx0XHRjb25zdCBjdXJyZW50TGluZSA9IHRleHRNb2RlbC5nZXRMaW5lQ29udGVudChnaG9zdFRleHQubGluZU51bWJlcik7XG5cdFx0Y29uc3QgZWRpdCA9IG5ldyBPZmZzZXRFZGl0KGlubGluZVRleHRzLm1hcCh0ID0+IFNpbmdsZU9mZnNldEVkaXQuaW5zZXJ0KHQuY29sdW1uIC0gMSwgdC50ZXh0KSkpO1xuXHRcdGNvbnN0IHRva2VucyA9IHN5bnRheEhpZ2hsaWdodGluZ0VuYWJsZWQgPyB0ZXh0TW9kZWwudG9rZW5pemF0aW9uLnRva2VuaXplTGluZXNBdChnaG9zdFRleHQubGluZU51bWJlciwgW2VkaXQuYXBwbHkoY3VycmVudExpbmUpLCAuLi5hZGRpdGlvbmFsTGluZXMubWFwKGwgPT4gbC5jb250ZW50KV0pIDogdW5kZWZpbmVkO1xuXHRcdGNvbnN0IG5ld1JhbmdlcyA9IGVkaXQuZ2V0TmV3VGV4dFJhbmdlcygpO1xuXHRcdGNvbnN0IGlubGluZVRleHRzV2l0aFRva2VucyA9IGlubGluZVRleHRzLm1hcCgodCwgaWR4KSA9PiAoeyAuLi50LCB0b2tlbnM6IHRva2Vucz8uWzBdPy5nZXRUb2tlbnNJblJhbmdlKG5ld1Jhbmdlc1tpZHhdKSB9KSk7XG5cblx0XHRjb25zdCB0b2tlbml6ZWRBZGRpdGlvbmFsTGluZXM6IExpbmVEYXRhW10gPSBhZGRpdGlvbmFsTGluZXMubWFwKChsLCBpZHgpID0+ICh7XG5cdFx0XHRjb250ZW50OiB0b2tlbnM/LltpZHggKyAxXSA/PyBMaW5lVG9rZW5zLmNyZWF0ZUVtcHR5KGwuY29udGVudCwgdGhpcy5fbGFuZ3VhZ2VTZXJ2aWNlLmxhbmd1YWdlSWRDb2RlYyksXG5cdFx0XHRkZWNvcmF0aW9uczogbC5kZWNvcmF0aW9ucyxcblx0XHR9KSk7XG5cblx0XHRyZXR1cm4ge1xuXHRcdFx0cmVwbGFjZWRSYW5nZSxcblx0XHRcdGlubGluZVRleHRzOiBpbmxpbmVUZXh0c1dpdGhUb2tlbnMsXG5cdFx0XHRhZGRpdGlvbmFsTGluZXM6IHRva2VuaXplZEFkZGl0aW9uYWxMaW5lcyxcblx0XHRcdGhpZGRlblJhbmdlLFxuXHRcdFx0bGluZU51bWJlcjogZ2hvc3RUZXh0LmxpbmVOdW1iZXIsXG5cdFx0XHRhZGRpdGlvbmFsUmVzZXJ2ZWRMaW5lQ291bnQ6IHRoaXMuX21vZGVsLm1pblJlc2VydmVkTGluZUNvdW50LnJlYWQocmVhZGVyKSxcblx0XHRcdHRhcmdldFRleHRNb2RlbDogdGV4dE1vZGVsLFxuXHRcdFx0c3ludGF4SGlnaGxpZ2h0aW5nRW5hYmxlZCxcblx0XHR9O1xuXHR9KTtcblxuXHRwcml2YXRlIHJlYWRvbmx5IGRlY29yYXRpb25zID0gZGVyaXZlZCh0aGlzLCByZWFkZXIgPT4ge1xuXHRcdGNvbnN0IHVpU3RhdGUgPSB0aGlzLnVpU3RhdGUucmVhZChyZWFkZXIpO1xuXHRcdGlmICghdWlTdGF0ZSkgeyByZXR1cm4gW107IH1cblxuXHRcdGNvbnN0IGRlY29yYXRpb25zOiBJTW9kZWxEZWx0YURlY29yYXRpb25bXSA9IFtdO1xuXG5cdFx0Y29uc3QgZXh0cmFDbGFzc05hbWVzID0gdGhpcy5fZXh0cmFDbGFzc05hbWVzLnJlYWQocmVhZGVyKTtcblxuXHRcdGlmICh1aVN0YXRlLnJlcGxhY2VkUmFuZ2UpIHtcblx0XHRcdGRlY29yYXRpb25zLnB1c2goe1xuXHRcdFx0XHRyYW5nZTogdWlTdGF0ZS5yZXBsYWNlZFJhbmdlLnRvUmFuZ2UodWlTdGF0ZS5saW5lTnVtYmVyKSxcblx0XHRcdFx0b3B0aW9uczogeyBpbmxpbmVDbGFzc05hbWU6ICdpbmxpbmUtY29tcGxldGlvbi10ZXh0LXRvLXJlcGxhY2UnICsgZXh0cmFDbGFzc05hbWVzLCBkZXNjcmlwdGlvbjogJ0dob3N0VGV4dFJlcGxhY2VtZW50JyB9XG5cdFx0XHR9KTtcblx0XHR9XG5cblx0XHRpZiAodWlTdGF0ZS5oaWRkZW5SYW5nZSkge1xuXHRcdFx0ZGVjb3JhdGlvbnMucHVzaCh7XG5cdFx0XHRcdHJhbmdlOiB1aVN0YXRlLmhpZGRlblJhbmdlLnRvUmFuZ2UodWlTdGF0ZS5saW5lTnVtYmVyKSxcblx0XHRcdFx0b3B0aW9uczogeyBpbmxpbmVDbGFzc05hbWU6ICdnaG9zdC10ZXh0LWhpZGRlbicsIGRlc2NyaXB0aW9uOiAnZ2hvc3QtdGV4dC1oaWRkZW4nLCB9XG5cdFx0XHR9KTtcblx0XHR9XG5cblx0XHRmb3IgKGNvbnN0IHAgb2YgdWlTdGF0ZS5pbmxpbmVUZXh0cykge1xuXHRcdFx0ZGVjb3JhdGlvbnMucHVzaCh7XG5cdFx0XHRcdHJhbmdlOiBSYW5nZS5mcm9tUG9zaXRpb25zKG5ldyBQb3NpdGlvbih1aVN0YXRlLmxpbmVOdW1iZXIsIHAuY29sdW1uKSksXG5cdFx0XHRcdG9wdGlvbnM6IHtcblx0XHRcdFx0XHRkZXNjcmlwdGlvbjogJ2dob3N0LXRleHQtZGVjb3JhdGlvbicsXG5cdFx0XHRcdFx0YWZ0ZXI6IHtcblx0XHRcdFx0XHRcdGNvbnRlbnQ6IHAudGV4dCxcblx0XHRcdFx0XHRcdHRva2VuczogcC50b2tlbnMsXG5cdFx0XHRcdFx0XHRpbmxpbmVDbGFzc05hbWU6IChwLnByZXZpZXcgPyAnZ2hvc3QtdGV4dC1kZWNvcmF0aW9uLXByZXZpZXcnIDogJ2dob3N0LXRleHQtZGVjb3JhdGlvbicpXG5cdFx0XHRcdFx0XHRcdCsgKHRoaXMuX2lzQ2xpY2thYmxlID8gJyBjbGlja2FibGUnIDogJycpXG5cdFx0XHRcdFx0XHRcdCsgZXh0cmFDbGFzc05hbWVzXG5cdFx0XHRcdFx0XHRcdCsgcC5saW5lRGVjb3JhdGlvbnMubWFwKGQgPT4gJyAnICsgZC5jbGFzc05hbWUpLmpvaW4oJyAnKSwgLy8gVE9ETzogdGFrZSB0aGUgcmFuZ2VzIGludG8gYWNjb3VudCBmb3IgbGluZSBkZWNvcmF0aW9uc1xuXHRcdFx0XHRcdFx0Y3Vyc29yU3RvcHM6IEluamVjdGVkVGV4dEN1cnNvclN0b3BzLkxlZnQsXG5cdFx0XHRcdFx0XHRhdHRhY2hlZERhdGE6IG5ldyBHaG9zdFRleHRBdHRhY2hlZERhdGEodGhpcyksXG5cdFx0XHRcdFx0fSxcblx0XHRcdFx0XHRzaG93SWZDb2xsYXBzZWQ6IHRydWUsXG5cdFx0XHRcdH1cblx0XHRcdH0pO1xuXHRcdH1cblxuXHRcdHJldHVybiBkZWNvcmF0aW9ucztcblx0fSk7XG5cblx0cHJpdmF0ZSByZWFkb25seSBfYWRkaXRpb25hbExpbmVzV2lkZ2V0ID0gdGhpcy5fcmVnaXN0ZXIoXG5cdFx0bmV3IEFkZGl0aW9uYWxMaW5lc1dpZGdldChcblx0XHRcdHRoaXMuX2VkaXRvcixcblx0XHRcdGRlcml2ZWQocmVhZGVyID0+IHtcblx0XHRcdFx0LyoqIEBkZXNjcmlwdGlvbiBsaW5lcyAqL1xuXHRcdFx0XHRjb25zdCB1aVN0YXRlID0gdGhpcy51aVN0YXRlLnJlYWQocmVhZGVyKTtcblx0XHRcdFx0cmV0dXJuIHVpU3RhdGUgPyB7XG5cdFx0XHRcdFx0bGluZU51bWJlcjogdWlTdGF0ZS5saW5lTnVtYmVyLFxuXHRcdFx0XHRcdGFkZGl0aW9uYWxMaW5lczogdWlTdGF0ZS5hZGRpdGlvbmFsTGluZXMsXG5cdFx0XHRcdFx0bWluUmVzZXJ2ZWRMaW5lQ291bnQ6IHVpU3RhdGUuYWRkaXRpb25hbFJlc2VydmVkTGluZUNvdW50LFxuXHRcdFx0XHRcdHRhcmdldFRleHRNb2RlbDogdWlTdGF0ZS50YXJnZXRUZXh0TW9kZWwsXG5cdFx0XHRcdH0gOiB1bmRlZmluZWQ7XG5cdFx0XHR9KSxcblx0XHRcdHRoaXMuX3Nob3VsZEtlZXBDdXJzb3JTdGFibGUsXG5cdFx0XHR0aGlzLl9pc0NsaWNrYWJsZVxuXHRcdClcblx0KTtcblxuXHRwcml2YXRlIHJlYWRvbmx5IF9pc0lubGluZVRleHRIb3ZlcmVkID0gdGhpcy5fZWRpdG9yT2JzLmlzVGFyZ2V0SG92ZXJlZChcblx0XHRwID0+IHAudGFyZ2V0LnR5cGUgPT09IE1vdXNlVGFyZ2V0VHlwZS5DT05URU5UX1RFWFQgJiZcblx0XHRcdHAudGFyZ2V0LmRldGFpbC5pbmplY3RlZFRleHQ/Lm9wdGlvbnMuYXR0YWNoZWREYXRhIGluc3RhbmNlb2YgR2hvc3RUZXh0QXR0YWNoZWREYXRhICYmXG5cdFx0XHRwLnRhcmdldC5kZXRhaWwuaW5qZWN0ZWRUZXh0Lm9wdGlvbnMuYXR0YWNoZWREYXRhLm93bmVyID09PSB0aGlzLFxuXHRcdHRoaXMuX3N0b3JlXG5cdCk7XG5cblx0cHVibGljIHJlYWRvbmx5IGlzSG92ZXJlZCA9IGRlcml2ZWQodGhpcywgcmVhZGVyID0+IHtcblx0XHRpZiAodGhpcy5faXNEaXNwb3NlZC5yZWFkKHJlYWRlcikpIHsgcmV0dXJuIGZhbHNlOyB9XG5cdFx0cmV0dXJuIHRoaXMuX2lzSW5saW5lVGV4dEhvdmVyZWQucmVhZChyZWFkZXIpIHx8IHRoaXMuX2FkZGl0aW9uYWxMaW5lc1dpZGdldC5pc0hvdmVyZWQucmVhZChyZWFkZXIpO1xuXHR9KTtcblxuXHRwdWJsaWMgcmVhZG9ubHkgaGVpZ2h0ID0gZGVyaXZlZCh0aGlzLCByZWFkZXIgPT4ge1xuXHRcdGNvbnN0IGxpbmVIZWlnaHQgPSB0aGlzLl9lZGl0b3JPYnMuZ2V0T3B0aW9uKEVkaXRvck9wdGlvbi5saW5lSGVpZ2h0KS5yZWFkKHJlYWRlcik7XG5cdFx0cmV0dXJuIGxpbmVIZWlnaHQgKyAodGhpcy5fYWRkaXRpb25hbExpbmVzV2lkZ2V0LnZpZXdab25lSGVpZ2h0LnJlYWQocmVhZGVyKSA/PyAwKTtcblx0fSk7XG5cblx0cHVibGljIG93bnNWaWV3Wm9uZSh2aWV3Wm9uZUlkOiBzdHJpbmcpOiBib29sZWFuIHtcblx0XHRyZXR1cm4gdGhpcy5fYWRkaXRpb25hbExpbmVzV2lkZ2V0LnZpZXdab25lSWQgPT09IHZpZXdab25lSWQ7XG5cdH1cbn1cblxuY2xhc3MgR2hvc3RUZXh0QXR0YWNoZWREYXRhIHtcblx0Y29uc3RydWN0b3IocHVibGljIHJlYWRvbmx5IG93bmVyOiBHaG9zdFRleHRWaWV3KSB7IH1cbn1cblxuaW50ZXJmYWNlIFdpZGdldERvbUVsZW1lbnQge1xuXHRnaG9zdFRleHRWaWV3V2FybmluZ1dpZGdldERhdGE/OiB7XG5cdFx0cmFuZ2U6IFJhbmdlO1xuXHR9O1xufVxuXG5mdW5jdGlvbiBjb21wdXRlR2hvc3RUZXh0Vmlld0RhdGEoZ2hvc3RUZXh0OiBHaG9zdFRleHQgfCBHaG9zdFRleHRSZXBsYWNlbWVudCwgdGV4dE1vZGVsOiBJVGV4dE1vZGVsLCBnaG9zdFRleHRDbGFzc05hbWU6IHN0cmluZykge1xuXHRjb25zdCBpbmxpbmVUZXh0czogeyBjb2x1bW46IG51bWJlcjsgdGV4dDogc3RyaW5nOyBwcmV2aWV3OiBib29sZWFuOyBsaW5lRGVjb3JhdGlvbnM6IExpbmVEZWNvcmF0aW9uW10gfVtdID0gW107XG5cdGNvbnN0IGFkZGl0aW9uYWxMaW5lczogeyBjb250ZW50OiBzdHJpbmc7IGRlY29yYXRpb25zOiBMaW5lRGVjb3JhdGlvbltdIH1bXSA9IFtdO1xuXG5cdGZ1bmN0aW9uIGFkZFRvQWRkaXRpb25hbExpbmVzKGdoTGluZXM6IHJlYWRvbmx5IElHaG9zdFRleHRMaW5lW10sIGNsYXNzTmFtZTogc3RyaW5nIHwgdW5kZWZpbmVkKSB7XG5cdFx0aWYgKGFkZGl0aW9uYWxMaW5lcy5sZW5ndGggPiAwKSB7XG5cdFx0XHRjb25zdCBsYXN0TGluZSA9IGFkZGl0aW9uYWxMaW5lc1thZGRpdGlvbmFsTGluZXMubGVuZ3RoIC0gMV07XG5cdFx0XHRpZiAoY2xhc3NOYW1lKSB7XG5cdFx0XHRcdGxhc3RMaW5lLmRlY29yYXRpb25zLnB1c2gobmV3IExpbmVEZWNvcmF0aW9uKFxuXHRcdFx0XHRcdGxhc3RMaW5lLmNvbnRlbnQubGVuZ3RoICsgMSxcblx0XHRcdFx0XHRsYXN0TGluZS5jb250ZW50Lmxlbmd0aCArIDEgKyBnaExpbmVzWzBdLmxpbmUubGVuZ3RoLFxuXHRcdFx0XHRcdGNsYXNzTmFtZSxcblx0XHRcdFx0XHRJbmxpbmVEZWNvcmF0aW9uVHlwZS5SZWd1bGFyXG5cdFx0XHRcdCkpO1xuXHRcdFx0fVxuXHRcdFx0bGFzdExpbmUuY29udGVudCArPSBnaExpbmVzWzBdLmxpbmU7XG5cblx0XHRcdGdoTGluZXMgPSBnaExpbmVzLnNsaWNlKDEpO1xuXHRcdH1cblx0XHRmb3IgKGNvbnN0IGdoTGluZSBvZiBnaExpbmVzKSB7XG5cdFx0XHRhZGRpdGlvbmFsTGluZXMucHVzaCh7XG5cdFx0XHRcdGNvbnRlbnQ6IGdoTGluZS5saW5lLFxuXHRcdFx0XHRkZWNvcmF0aW9uczogY2xhc3NOYW1lID8gW25ldyBMaW5lRGVjb3JhdGlvbihcblx0XHRcdFx0XHQxLFxuXHRcdFx0XHRcdGdoTGluZS5saW5lLmxlbmd0aCArIDEsXG5cdFx0XHRcdFx0Y2xhc3NOYW1lLFxuXHRcdFx0XHRcdElubGluZURlY29yYXRpb25UeXBlLlJlZ3VsYXJcblx0XHRcdFx0KSwgLi4uZ2hMaW5lLmxpbmVEZWNvcmF0aW9uc10gOiBbLi4uZ2hMaW5lLmxpbmVEZWNvcmF0aW9uc11cblx0XHRcdH0pO1xuXHRcdH1cblx0fVxuXG5cdGNvbnN0IHRleHRCdWZmZXJMaW5lID0gdGV4dE1vZGVsLmdldExpbmVDb250ZW50KGdob3N0VGV4dC5saW5lTnVtYmVyKTtcblxuXHRsZXQgaGlkZGVuVGV4dFN0YXJ0Q29sdW1uOiBudW1iZXIgfCB1bmRlZmluZWQgPSB1bmRlZmluZWQ7XG5cdGxldCBsYXN0SWR4ID0gMDtcblx0Zm9yIChjb25zdCBwYXJ0IG9mIGdob3N0VGV4dC5wYXJ0cykge1xuXHRcdGxldCBnaExpbmVzID0gcGFydC5saW5lcztcblx0XHRpZiAoaGlkZGVuVGV4dFN0YXJ0Q29sdW1uID09PSB1bmRlZmluZWQpIHtcblx0XHRcdGlubGluZVRleHRzLnB1c2goeyBjb2x1bW46IHBhcnQuY29sdW1uLCB0ZXh0OiBnaExpbmVzWzBdLmxpbmUsIHByZXZpZXc6IHBhcnQucHJldmlldywgbGluZURlY29yYXRpb25zOiBnaExpbmVzWzBdLmxpbmVEZWNvcmF0aW9ucyB9KTtcblx0XHRcdGdoTGluZXMgPSBnaExpbmVzLnNsaWNlKDEpO1xuXHRcdH0gZWxzZSB7XG5cdFx0XHRhZGRUb0FkZGl0aW9uYWxMaW5lcyhbeyBsaW5lOiB0ZXh0QnVmZmVyTGluZS5zdWJzdHJpbmcobGFzdElkeCwgcGFydC5jb2x1bW4gLSAxKSwgbGluZURlY29yYXRpb25zOiBbXSB9XSwgdW5kZWZpbmVkKTtcblx0XHR9XG5cblx0XHRpZiAoZ2hMaW5lcy5sZW5ndGggPiAwKSB7XG5cdFx0XHRhZGRUb0FkZGl0aW9uYWxMaW5lcyhnaExpbmVzLCBnaG9zdFRleHRDbGFzc05hbWUpO1xuXHRcdFx0aWYgKGhpZGRlblRleHRTdGFydENvbHVtbiA9PT0gdW5kZWZpbmVkICYmIHBhcnQuY29sdW1uIDw9IHRleHRCdWZmZXJMaW5lLmxlbmd0aCkge1xuXHRcdFx0XHRoaWRkZW5UZXh0U3RhcnRDb2x1bW4gPSBwYXJ0LmNvbHVtbjtcblx0XHRcdH1cblx0XHR9XG5cblx0XHRsYXN0SWR4ID0gcGFydC5jb2x1bW4gLSAxO1xuXHR9XG5cdGlmIChoaWRkZW5UZXh0U3RhcnRDb2x1bW4gIT09IHVuZGVmaW5lZCkge1xuXHRcdGFkZFRvQWRkaXRpb25hbExpbmVzKFt7IGxpbmU6IHRleHRCdWZmZXJMaW5lLnN1YnN0cmluZyhsYXN0SWR4KSwgbGluZURlY29yYXRpb25zOiBbXSB9XSwgdW5kZWZpbmVkKTtcblx0fVxuXG5cdGNvbnN0IGhpZGRlblJhbmdlID0gaGlkZGVuVGV4dFN0YXJ0Q29sdW1uICE9PSB1bmRlZmluZWQgPyBuZXcgQ29sdW1uUmFuZ2UoaGlkZGVuVGV4dFN0YXJ0Q29sdW1uLCB0ZXh0QnVmZmVyTGluZS5sZW5ndGggKyAxKSA6IHVuZGVmaW5lZDtcblxuXHRyZXR1cm4ge1xuXHRcdGlubGluZVRleHRzLFxuXHRcdGFkZGl0aW9uYWxMaW5lcyxcblx0XHRoaWRkZW5SYW5nZSxcblx0fTtcbn1cblxuZXhwb3J0IGNsYXNzIEFkZGl0aW9uYWxMaW5lc1dpZGdldCBleHRlbmRzIERpc3Bvc2FibGUge1xuXHRwcml2YXRlIF92aWV3Wm9uZUluZm86IHsgdmlld1pvbmVJZDogc3RyaW5nOyBoZWlnaHRJbkxpbmVzOiBudW1iZXI7IGxpbmVOdW1iZXI6IG51bWJlciB9IHwgdW5kZWZpbmVkO1xuXHRwdWJsaWMgZ2V0IHZpZXdab25lSWQoKTogc3RyaW5nIHwgdW5kZWZpbmVkIHsgcmV0dXJuIHRoaXMuX3ZpZXdab25lSW5mbz8udmlld1pvbmVJZDsgfVxuXG5cdHByaXZhdGUgX3ZpZXdab25lSGVpZ2h0ID0gb2JzZXJ2YWJsZVZhbHVlPHVuZGVmaW5lZCB8IG51bWJlcj4oJ3ZpZXdab25lSGVpZ2h0JywgdW5kZWZpbmVkKTtcblx0cHVibGljIGdldCB2aWV3Wm9uZUhlaWdodCgpOiBJT2JzZXJ2YWJsZTxudW1iZXIgfCB1bmRlZmluZWQ+IHsgcmV0dXJuIHRoaXMuX3ZpZXdab25lSGVpZ2h0OyB9XG5cblx0cHJpdmF0ZSByZWFkb25seSBlZGl0b3JPcHRpb25zQ2hhbmdlZCA9IG9ic2VydmFibGVTaWduYWxGcm9tRXZlbnQoJ2VkaXRvck9wdGlvbkNoYW5nZWQnLCBFdmVudC5maWx0ZXIoXG5cdFx0dGhpcy5fZWRpdG9yLm9uRGlkQ2hhbmdlQ29uZmlndXJhdGlvbixcblx0XHRlID0+IGUuaGFzQ2hhbmdlZChFZGl0b3JPcHRpb24uZGlzYWJsZU1vbm9zcGFjZU9wdGltaXphdGlvbnMpXG5cdFx0XHR8fCBlLmhhc0NoYW5nZWQoRWRpdG9yT3B0aW9uLnN0b3BSZW5kZXJpbmdMaW5lQWZ0ZXIpXG5cdFx0XHR8fCBlLmhhc0NoYW5nZWQoRWRpdG9yT3B0aW9uLnJlbmRlcldoaXRlc3BhY2UpXG5cdFx0XHR8fCBlLmhhc0NoYW5nZWQoRWRpdG9yT3B0aW9uLnJlbmRlckNvbnRyb2xDaGFyYWN0ZXJzKVxuXHRcdFx0fHwgZS5oYXNDaGFuZ2VkKEVkaXRvck9wdGlvbi5mb250TGlnYXR1cmVzKVxuXHRcdFx0fHwgZS5oYXNDaGFuZ2VkKEVkaXRvck9wdGlvbi5mb250SW5mbylcblx0XHRcdHx8IGUuaGFzQ2hhbmdlZChFZGl0b3JPcHRpb24ubGluZUhlaWdodClcblx0KSk7XG5cblx0cHJpdmF0ZSByZWFkb25seSBfb25EaWRDbGljayA9IHRoaXMuX3JlZ2lzdGVyKG5ldyBFbWl0dGVyPElNb3VzZUV2ZW50PigpKTtcblx0cHVibGljIHJlYWRvbmx5IG9uRGlkQ2xpY2sgPSB0aGlzLl9vbkRpZENsaWNrLmV2ZW50O1xuXG5cdHByaXZhdGUgcmVhZG9ubHkgX3ZpZXdab25lTGlzdGVuZXIgPSB0aGlzLl9yZWdpc3RlcihuZXcgTXV0YWJsZURpc3Bvc2FibGUoKSk7XG5cblx0cmVhZG9ubHkgaXNIb3ZlcmVkID0gb2JzZXJ2YWJsZUNvZGVFZGl0b3IodGhpcy5fZWRpdG9yKS5pc1RhcmdldEhvdmVyZWQoXG5cdFx0cCA9PiBpc1RhcmdldEdob3N0VGV4dChwLnRhcmdldC5lbGVtZW50KSxcblx0XHR0aGlzLl9zdG9yZVxuXHQpO1xuXG5cdHByaXZhdGUgaGFzQmVlbkFjY2VwdGVkID0gZmFsc2U7XG5cblx0Y29uc3RydWN0b3IoXG5cdFx0cHJpdmF0ZSByZWFkb25seSBfZWRpdG9yOiBJQ29kZUVkaXRvcixcblx0XHRwcml2YXRlIHJlYWRvbmx5IF9saW5lczogSU9ic2VydmFibGU8e1xuXHRcdFx0dGFyZ2V0VGV4dE1vZGVsOiBJVGV4dE1vZGVsO1xuXHRcdFx0bGluZU51bWJlcjogbnVtYmVyO1xuXHRcdFx0YWRkaXRpb25hbExpbmVzOiBMaW5lRGF0YVtdO1xuXHRcdFx0bWluUmVzZXJ2ZWRMaW5lQ291bnQ6IG51bWJlcjtcblx0XHR9IHwgdW5kZWZpbmVkPixcblx0XHRwcml2YXRlIHJlYWRvbmx5IF9zaG91bGRLZWVwQ3Vyc29yU3RhYmxlOiBib29sZWFuLFxuXHRcdHByaXZhdGUgcmVhZG9ubHkgX2lzQ2xpY2thYmxlOiBib29sZWFuLFxuXHQpIHtcblx0XHRzdXBlcigpO1xuXG5cdFx0aWYgKHRoaXMuX2VkaXRvciBpbnN0YW5jZW9mIENvZGVFZGl0b3JXaWRnZXQgJiYgdGhpcy5fc2hvdWxkS2VlcEN1cnNvclN0YWJsZSkge1xuXHRcdFx0dGhpcy5fcmVnaXN0ZXIodGhpcy5fZWRpdG9yLm9uQmVmb3JlRXhlY3V0ZUVkaXQoZSA9PiB0aGlzLmhhc0JlZW5BY2NlcHRlZCA9IGUuc291cmNlID09PSAnaW5saW5lU3VnZ2VzdGlvbi5hY2NlcHQnKSk7XG5cdFx0fVxuXG5cdFx0dGhpcy5fcmVnaXN0ZXIoYXV0b3J1bihyZWFkZXIgPT4ge1xuXHRcdFx0LyoqIEBkZXNjcmlwdGlvbiB1cGRhdGUgdmlldyB6b25lICovXG5cdFx0XHRjb25zdCBsaW5lcyA9IHRoaXMuX2xpbmVzLnJlYWQocmVhZGVyKTtcblx0XHRcdHRoaXMuZWRpdG9yT3B0aW9uc0NoYW5nZWQucmVhZChyZWFkZXIpO1xuXG5cdFx0XHRpZiAobGluZXMpIHtcblx0XHRcdFx0dGhpcy5oYXNCZWVuQWNjZXB0ZWQgPSBmYWxzZTtcblx0XHRcdFx0dGhpcy51cGRhdGVMaW5lcyhsaW5lcy5saW5lTnVtYmVyLCBsaW5lcy5hZGRpdGlvbmFsTGluZXMsIGxpbmVzLm1pblJlc2VydmVkTGluZUNvdW50KTtcblx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdHRoaXMuY2xlYXIoKTtcblx0XHRcdH1cblx0XHR9KSk7XG5cdH1cblxuXHRwdWJsaWMgb3ZlcnJpZGUgZGlzcG9zZSgpOiB2b2lkIHtcblx0XHRzdXBlci5kaXNwb3NlKCk7XG5cdFx0dGhpcy5jbGVhcigpO1xuXHR9XG5cblx0cHJpdmF0ZSBjbGVhcigpOiB2b2lkIHtcblx0XHR0aGlzLl92aWV3Wm9uZUxpc3RlbmVyLmNsZWFyKCk7XG5cblx0XHR0aGlzLl9lZGl0b3IuY2hhbmdlVmlld1pvbmVzKChjaGFuZ2VBY2Nlc3NvcikgPT4ge1xuXHRcdFx0dGhpcy5yZW1vdmVBY3RpdmVWaWV3Wm9uZShjaGFuZ2VBY2Nlc3Nvcik7XG5cdFx0fSk7XG5cdH1cblxuXHRwcml2YXRlIHVwZGF0ZUxpbmVzKGxpbmVOdW1iZXI6IG51bWJlciwgYWRkaXRpb25hbExpbmVzOiBMaW5lRGF0YVtdLCBtaW5SZXNlcnZlZExpbmVDb3VudDogbnVtYmVyKTogdm9pZCB7XG5cdFx0Y29uc3QgdGV4dE1vZGVsID0gdGhpcy5fZWRpdG9yLmdldE1vZGVsKCk7XG5cdFx0aWYgKCF0ZXh0TW9kZWwpIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cblx0XHRjb25zdCB7IHRhYlNpemUgfSA9IHRleHRNb2RlbC5nZXRPcHRpb25zKCk7XG5cblx0XHR0aGlzLl9lZGl0b3IuY2hhbmdlVmlld1pvbmVzKChjaGFuZ2VBY2Nlc3NvcikgPT4ge1xuXHRcdFx0Y29uc3Qgc3RvcmUgPSBuZXcgRGlzcG9zYWJsZVN0b3JlKCk7XG5cblx0XHRcdHRoaXMucmVtb3ZlQWN0aXZlVmlld1pvbmUoY2hhbmdlQWNjZXNzb3IpO1xuXG5cdFx0XHRjb25zdCBoZWlnaHRJbkxpbmVzID0gTWF0aC5tYXgoYWRkaXRpb25hbExpbmVzLmxlbmd0aCwgbWluUmVzZXJ2ZWRMaW5lQ291bnQpO1xuXHRcdFx0aWYgKGhlaWdodEluTGluZXMgPiAwKSB7XG5cdFx0XHRcdGNvbnN0IGRvbU5vZGUgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdkaXYnKTtcblx0XHRcdFx0cmVuZGVyTGluZXMoZG9tTm9kZSwgdGFiU2l6ZSwgYWRkaXRpb25hbExpbmVzLCB0aGlzLl9lZGl0b3IuZ2V0T3B0aW9ucygpLCB0aGlzLl9pc0NsaWNrYWJsZSk7XG5cblx0XHRcdFx0aWYgKHRoaXMuX2lzQ2xpY2thYmxlKSB7XG5cdFx0XHRcdFx0c3RvcmUuYWRkKGFkZERpc3Bvc2FibGVMaXN0ZW5lcihkb21Ob2RlLCAnbW91c2Vkb3duJywgKGUpID0+IHtcblx0XHRcdFx0XHRcdGUucHJldmVudERlZmF1bHQoKTsgLy8gVGhpcyBwcmV2ZW50cyB0aGF0IHRoZSBlZGl0b3IgbG9zZXMgZm9jdXNcblx0XHRcdFx0XHR9KSk7XG5cdFx0XHRcdFx0c3RvcmUuYWRkKGFkZERpc3Bvc2FibGVMaXN0ZW5lcihkb21Ob2RlLCAnY2xpY2snLCAoZSkgPT4ge1xuXHRcdFx0XHRcdFx0aWYgKGlzVGFyZ2V0R2hvc3RUZXh0KGUudGFyZ2V0KSkge1xuXHRcdFx0XHRcdFx0XHR0aGlzLl9vbkRpZENsaWNrLmZpcmUobmV3IFN0YW5kYXJkTW91c2VFdmVudChnZXRXaW5kb3coZSksIGUpKTtcblx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHR9KSk7XG5cdFx0XHRcdH1cblxuXHRcdFx0XHR0aGlzLmFkZFZpZXdab25lKGNoYW5nZUFjY2Vzc29yLCBsaW5lTnVtYmVyLCBoZWlnaHRJbkxpbmVzLCBkb21Ob2RlKTtcblx0XHRcdH1cblxuXHRcdFx0dGhpcy5fdmlld1pvbmVMaXN0ZW5lci52YWx1ZSA9IHN0b3JlO1xuXHRcdH0pO1xuXHR9XG5cblx0cHJpdmF0ZSBhZGRWaWV3Wm9uZShjaGFuZ2VBY2Nlc3NvcjogSVZpZXdab25lQ2hhbmdlQWNjZXNzb3IsIGFmdGVyTGluZU51bWJlcjogbnVtYmVyLCBoZWlnaHRJbkxpbmVzOiBudW1iZXIsIGRvbU5vZGU6IEhUTUxFbGVtZW50KTogdm9pZCB7XG5cdFx0Y29uc3QgaWQgPSBjaGFuZ2VBY2Nlc3Nvci5hZGRab25lKHtcblx0XHRcdGFmdGVyTGluZU51bWJlcjogYWZ0ZXJMaW5lTnVtYmVyLFxuXHRcdFx0aGVpZ2h0SW5MaW5lczogaGVpZ2h0SW5MaW5lcyxcblx0XHRcdGRvbU5vZGUsXG5cdFx0XHRhZnRlckNvbHVtbkFmZmluaXR5OiBQb3NpdGlvbkFmZmluaXR5LlJpZ2h0LFxuXHRcdFx0b25Db21wdXRlZEhlaWdodDogKGhlaWdodDogbnVtYmVyKSA9PiB7XG5cdFx0XHRcdHRoaXMuX3ZpZXdab25lSGVpZ2h0LnNldChoZWlnaHQsIHVuZGVmaW5lZCk7IC8vIFRPRE86IGNhbiBhIHRyYW5zYWN0aW9uIGJlIHVzZWQgdG8gYXZvaWQgZmxpY2tlcmluZz9cblx0XHRcdH1cblx0XHR9KTtcblxuXHRcdHRoaXMua2VlcEN1cnNvclN0YWJsZShhZnRlckxpbmVOdW1iZXIsIGhlaWdodEluTGluZXMpO1xuXG5cdFx0dGhpcy5fdmlld1pvbmVJbmZvID0geyB2aWV3Wm9uZUlkOiBpZCwgaGVpZ2h0SW5MaW5lcywgbGluZU51bWJlcjogYWZ0ZXJMaW5lTnVtYmVyIH07XG5cdH1cblxuXHRwcml2YXRlIHJlbW92ZUFjdGl2ZVZpZXdab25lKGNoYW5nZUFjY2Vzc29yOiBJVmlld1pvbmVDaGFuZ2VBY2Nlc3Nvcik6IHZvaWQge1xuXHRcdGlmICh0aGlzLl92aWV3Wm9uZUluZm8pIHtcblx0XHRcdGNoYW5nZUFjY2Vzc29yLnJlbW92ZVpvbmUodGhpcy5fdmlld1pvbmVJbmZvLnZpZXdab25lSWQpO1xuXG5cdFx0XHRpZiAoIXRoaXMuaGFzQmVlbkFjY2VwdGVkKSB7XG5cdFx0XHRcdHRoaXMua2VlcEN1cnNvclN0YWJsZSh0aGlzLl92aWV3Wm9uZUluZm8ubGluZU51bWJlciwgLXRoaXMuX3ZpZXdab25lSW5mby5oZWlnaHRJbkxpbmVzKTtcblx0XHRcdH1cblxuXHRcdFx0dGhpcy5fdmlld1pvbmVJbmZvID0gdW5kZWZpbmVkO1xuXHRcdFx0dGhpcy5fdmlld1pvbmVIZWlnaHQuc2V0KHVuZGVmaW5lZCwgdW5kZWZpbmVkKTtcblx0XHR9XG5cdH1cblxuXHRwcml2YXRlIGtlZXBDdXJzb3JTdGFibGUobGluZU51bWJlcjogbnVtYmVyLCBoZWlnaHRJbkxpbmVzOiBudW1iZXIpOiB2b2lkIHtcblx0XHRpZiAoIXRoaXMuX3Nob3VsZEtlZXBDdXJzb3JTdGFibGUpIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cblx0XHRjb25zdCBjdXJzb3JMaW5lTnVtYmVyID0gdGhpcy5fZWRpdG9yLmdldFNlbGVjdGlvbigpPy5nZXRTdGFydFBvc2l0aW9uKCk/LmxpbmVOdW1iZXI7XG5cdFx0aWYgKGN1cnNvckxpbmVOdW1iZXIgIT09IHVuZGVmaW5lZCAmJiBsaW5lTnVtYmVyIDwgY3Vyc29yTGluZU51bWJlcikge1xuXHRcdFx0dGhpcy5fZWRpdG9yLnNldFNjcm9sbFRvcCh0aGlzLl9lZGl0b3IuZ2V0U2Nyb2xsVG9wKCkgKyBoZWlnaHRJbkxpbmVzICogdGhpcy5fZWRpdG9yLmdldE9wdGlvbihFZGl0b3JPcHRpb24ubGluZUhlaWdodCkpO1xuXHRcdH1cblx0fVxufVxuXG5mdW5jdGlvbiBpc1RhcmdldEdob3N0VGV4dCh0YXJnZXQ6IEV2ZW50VGFyZ2V0IHwgbnVsbCk6IGJvb2xlYW4ge1xuXHRyZXR1cm4gaXNIVE1MRWxlbWVudCh0YXJnZXQpICYmIHRhcmdldC5jbGFzc0xpc3QuY29udGFpbnMoR0hPU1RfVEVYVF9DTEFTU19OQU1FKTtcbn1cblxuZXhwb3J0IGludGVyZmFjZSBMaW5lRGF0YSB7XG5cdGNvbnRlbnQ6IExpbmVUb2tlbnM7IC8vIE11c3Qgbm90IGNvbnRhaW4gYSBsaW5lYnJlYWshXG5cdGRlY29yYXRpb25zOiBMaW5lRGVjb3JhdGlvbltdO1xufVxuXG5mdW5jdGlvbiByZW5kZXJMaW5lcyhkb21Ob2RlOiBIVE1MRWxlbWVudCwgdGFiU2l6ZTogbnVtYmVyLCBsaW5lczogTGluZURhdGFbXSwgb3B0czogSUNvbXB1dGVkRWRpdG9yT3B0aW9ucywgaXNDbGlja2FibGU6IGJvb2xlYW4pOiB2b2lkIHtcblx0Y29uc3QgZGlzYWJsZU1vbm9zcGFjZU9wdGltaXphdGlvbnMgPSBvcHRzLmdldChFZGl0b3JPcHRpb24uZGlzYWJsZU1vbm9zcGFjZU9wdGltaXphdGlvbnMpO1xuXHRjb25zdCBzdG9wUmVuZGVyaW5nTGluZUFmdGVyID0gb3B0cy5nZXQoRWRpdG9yT3B0aW9uLnN0b3BSZW5kZXJpbmdMaW5lQWZ0ZXIpO1xuXHQvLyBUbyBhdm9pZCB2aXN1YWwgY29uZnVzaW9uLCB3ZSBkb24ndCB3YW50IHRvIHJlbmRlciB2aXNpYmxlIHdoaXRlc3BhY2Vcblx0Y29uc3QgcmVuZGVyV2hpdGVzcGFjZSA9ICdub25lJztcblx0Y29uc3QgcmVuZGVyQ29udHJvbENoYXJhY3RlcnMgPSBvcHRzLmdldChFZGl0b3JPcHRpb24ucmVuZGVyQ29udHJvbENoYXJhY3RlcnMpO1xuXHRjb25zdCBmb250TGlnYXR1cmVzID0gb3B0cy5nZXQoRWRpdG9yT3B0aW9uLmZvbnRMaWdhdHVyZXMpO1xuXHRjb25zdCBmb250SW5mbyA9IG9wdHMuZ2V0KEVkaXRvck9wdGlvbi5mb250SW5mbyk7XG5cdGNvbnN0IGxpbmVIZWlnaHQgPSBvcHRzLmdldChFZGl0b3JPcHRpb24ubGluZUhlaWdodCk7XG5cblx0bGV0IGNsYXNzTmFtZXMgPSAnc3VnZ2VzdC1wcmV2aWV3LXRleHQnO1xuXHRpZiAoaXNDbGlja2FibGUpIHtcblx0XHRjbGFzc05hbWVzICs9ICcgY2xpY2thYmxlJztcblx0fVxuXG5cdGNvbnN0IHNiID0gbmV3IFN0cmluZ0J1aWxkZXIoMTAwMDApO1xuXHRzYi5hcHBlbmRTdHJpbmcoYDxkaXYgY2xhc3M9XCIke2NsYXNzTmFtZXN9XCI+YCk7XG5cblx0Zm9yIChsZXQgaSA9IDAsIGxlbiA9IGxpbmVzLmxlbmd0aDsgaSA8IGxlbjsgaSsrKSB7XG5cdFx0Y29uc3QgbGluZURhdGEgPSBsaW5lc1tpXTtcblx0XHRjb25zdCBsaW5lVG9rZW5zID0gbGluZURhdGEuY29udGVudDtcblx0XHRzYi5hcHBlbmRTdHJpbmcoJzxkaXYgY2xhc3M9XCJ2aWV3LWxpbmUnKTtcblx0XHRzYi5hcHBlbmRTdHJpbmcoJ1wiIHN0eWxlPVwidG9wOicpO1xuXHRcdHNiLmFwcGVuZFN0cmluZyhTdHJpbmcoaSAqIGxpbmVIZWlnaHQpKTtcblx0XHRzYi5hcHBlbmRTdHJpbmcoJ3B4O3dpZHRoOjEwMDAwMDBweDtcIj4nKTtcblxuXHRcdGNvbnN0IGxpbmUgPSBsaW5lVG9rZW5zLmdldExpbmVDb250ZW50KCk7XG5cdFx0Y29uc3QgaXNCYXNpY0FTQ0lJID0gc3RyaW5ncy5pc0Jhc2ljQVNDSUkobGluZSk7XG5cdFx0Y29uc3QgY29udGFpbnNSVEwgPSBzdHJpbmdzLmNvbnRhaW5zUlRMKGxpbmUpO1xuXG5cdFx0cmVuZGVyVmlld0xpbmUobmV3IFJlbmRlckxpbmVJbnB1dChcblx0XHRcdChmb250SW5mby5pc01vbm9zcGFjZSAmJiAhZGlzYWJsZU1vbm9zcGFjZU9wdGltaXphdGlvbnMpLFxuXHRcdFx0Zm9udEluZm8uY2FuVXNlSGFsZndpZHRoUmlnaHR3YXJkc0Fycm93LFxuXHRcdFx0bGluZSxcblx0XHRcdGZhbHNlLFxuXHRcdFx0aXNCYXNpY0FTQ0lJLFxuXHRcdFx0Y29udGFpbnNSVEwsXG5cdFx0XHQwLFxuXHRcdFx0bGluZVRva2Vucyxcblx0XHRcdGxpbmVEYXRhLmRlY29yYXRpb25zLFxuXHRcdFx0dGFiU2l6ZSxcblx0XHRcdDAsXG5cdFx0XHRmb250SW5mby5zcGFjZVdpZHRoLFxuXHRcdFx0Zm9udEluZm8ubWlkZG90V2lkdGgsXG5cdFx0XHRmb250SW5mby53c21pZGRvdFdpZHRoLFxuXHRcdFx0c3RvcFJlbmRlcmluZ0xpbmVBZnRlcixcblx0XHRcdHJlbmRlcldoaXRlc3BhY2UsXG5cdFx0XHRyZW5kZXJDb250cm9sQ2hhcmFjdGVycyxcblx0XHRcdGZvbnRMaWdhdHVyZXMgIT09IEVkaXRvckZvbnRMaWdhdHVyZXMuT0ZGLFxuXHRcdFx0bnVsbFxuXHRcdCksIHNiKTtcblxuXHRcdHNiLmFwcGVuZFN0cmluZygnPC9kaXY+Jyk7XG5cdH1cblx0c2IuYXBwZW5kU3RyaW5nKCc8L2Rpdj4nKTtcblxuXHRhcHBseUZvbnRJbmZvKGRvbU5vZGUsIGZvbnRJbmZvKTtcblx0Y29uc3QgaHRtbCA9IHNiLmJ1aWxkKCk7XG5cdGNvbnN0IHRydXN0ZWRodG1sID0gdHRQb2xpY3kgPyB0dFBvbGljeS5jcmVhdGVIVE1MKGh0bWwpIDogaHRtbDtcblx0ZG9tTm9kZS5pbm5lckhUTUwgPSB0cnVzdGVkaHRtbCBhcyBzdHJpbmc7XG59XG5cbmV4cG9ydCBjb25zdCB0dFBvbGljeSA9IGNyZWF0ZVRydXN0ZWRUeXBlc1BvbGljeSgnZWRpdG9yR2hvc3RUZXh0JywgeyBjcmVhdGVIVE1MOiB2YWx1ZSA9PiB2YWx1ZSB9KTtcbiJdLAogICJtYXBwaW5ncyI6ICI7Ozs7Ozs7Ozs7O0FBS0EsU0FBUyxnQ0FBZ0M7QUFDekMsU0FBUyxrQkFBa0I7QUFDM0IsU0FBUyxlQUFlO0FBQ3hCLFNBQVMsU0FBUyxhQUFhO0FBQy9CLFNBQVMsc0JBQXNCO0FBQy9CLFNBQVMsWUFBWSxpQkFBaUIsbUJBQW1CLG9CQUFvQjtBQUM3RSxTQUFzQixTQUFTLGtCQUFrQixpQkFBaUIsU0FBUywyQkFBMkIsdUJBQXVCO0FBQzdILFlBQVksYUFBYTtBQUN6QixTQUFTLHFCQUFxQjtBQUM5QixTQUFTLGlDQUErRix1QkFBdUI7QUFDL0gsU0FBUyw0QkFBNEI7QUFDckMsU0FBUyxxQkFBcUIsb0JBQTRDO0FBQzFFLFNBQVMsWUFBWSx3QkFBd0I7QUFDN0MsU0FBUyxnQkFBZ0I7QUFDekIsU0FBUyxhQUFhO0FBQ3RCLFNBQVMscUJBQXFCO0FBRTlCLFNBQVMsd0JBQXdCO0FBQ2pDLFNBQTRDLHlCQUF5Qix3QkFBd0I7QUFDN0YsU0FBUyxrQkFBa0I7QUFDM0IsU0FBUyxzQkFBc0I7QUFDL0IsU0FBUyxpQkFBaUIsc0JBQXNCO0FBQ2hELFNBQVMsNEJBQTRCO0FBQ3JDLFNBQW9CLDRCQUE0QztBQUNoRSxTQUFTLG1CQUFtQjtBQUM1QixT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
