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
import "./inspectTokens.css";
import { $, append, reset } from "../../../../base/browser/dom.js";
import { CharCode } from "../../../../base/common/charCode.js";
import { Color } from "../../../../base/common/color.js";
import { KeyCode } from "../../../../base/common/keyCodes.js";
import { Disposable } from "../../../../base/common/lifecycle.js";
import { ContentWidgetPositionPreference } from "../../../browser/editorBrowser.js";
import { EditorAction, registerEditorAction, registerEditorContribution, EditorContributionInstantiation } from "../../../browser/editorExtensions.js";
import { TokenizationRegistry } from "../../../common/languages.js";
import { FontStyle, StandardTokenType, TokenMetadata } from "../../../common/encodedTokenAttributes.js";
import { NullState, nullTokenize, nullTokenizeEncoded } from "../../../common/languages/nullTokenize.js";
import { ILanguageService } from "../../../common/languages/language.js";
import { IStandaloneThemeService } from "../../common/standaloneTheme.js";
import { InspectTokensNLS } from "../../../common/standaloneStrings.js";
let InspectTokensController = class extends Disposable {
  static get(editor) {
    return editor.getContribution(InspectTokensController.ID);
  }
  constructor(editor, standaloneColorService, languageService) {
    super();
    this._editor = editor;
    this._languageService = languageService;
    this._widget = null;
    this._register(this._editor.onDidChangeModel((e) => this.stop()));
    this._register(this._editor.onDidChangeModelLanguage((e) => this.stop()));
    this._register(TokenizationRegistry.onDidChange((e) => this.stop()));
    this._register(this._editor.onKeyUp((e) => e.keyCode === KeyCode.Escape && this.stop()));
  }
  dispose() {
    this.stop();
    super.dispose();
  }
  launch() {
    if (this._widget) {
      return;
    }
    if (!this._editor.hasModel()) {
      return;
    }
    this._widget = new InspectTokensWidget(this._editor, this._languageService);
  }
  stop() {
    if (this._widget) {
      this._widget.dispose();
      this._widget = null;
    }
  }
};
InspectTokensController.ID = "editor.contrib.inspectTokens";
InspectTokensController = __decorateClass([
  __decorateParam(1, IStandaloneThemeService),
  __decorateParam(2, ILanguageService)
], InspectTokensController);
class InspectTokens extends EditorAction {
  constructor() {
    super({
      id: "editor.action.inspectTokens",
      label: InspectTokensNLS.inspectTokensAction,
      alias: "Developer: Inspect Tokens",
      precondition: void 0
    });
  }
  run(accessor, editor) {
    const controller = InspectTokensController.get(editor);
    controller?.launch();
  }
}
function renderTokenText(tokenText) {
  let result = "";
  for (let charIndex = 0, len = tokenText.length; charIndex < len; charIndex++) {
    const charCode = tokenText.charCodeAt(charIndex);
    switch (charCode) {
      case CharCode.Tab:
        result += "\u2192";
        break;
      case CharCode.Space:
        result += "\xB7";
        break;
      default:
        result += String.fromCharCode(charCode);
    }
  }
  return result;
}
function getSafeTokenizationSupport(languageIdCodec, languageId) {
  const tokenizationSupport = TokenizationRegistry.get(languageId);
  if (tokenizationSupport) {
    return tokenizationSupport;
  }
  const encodedLanguageId = languageIdCodec.encodeLanguageId(languageId);
  return {
    getInitialState: () => NullState,
    tokenize: (line, hasEOL, state) => nullTokenize(languageId, state),
    tokenizeEncoded: (line, hasEOL, state) => nullTokenizeEncoded(encodedLanguageId, state)
  };
}
const _InspectTokensWidget = class _InspectTokensWidget extends Disposable {
  constructor(editor, languageService) {
    super();
    // Editor.IContentWidget.allowEditorOverflow
    this.allowEditorOverflow = true;
    this._editor = editor;
    this._languageService = languageService;
    this._model = this._editor.getModel();
    this._domNode = document.createElement("div");
    this._domNode.className = "tokens-inspect-widget";
    this._tokenizationSupport = getSafeTokenizationSupport(this._languageService.languageIdCodec, this._model.getLanguageId());
    this._compute(this._editor.getPosition());
    this._register(this._editor.onDidChangeCursorPosition((e) => this._compute(this._editor.getPosition())));
    this._editor.addContentWidget(this);
  }
  dispose() {
    this._editor.removeContentWidget(this);
    super.dispose();
  }
  getId() {
    return _InspectTokensWidget._ID;
  }
  _compute(position) {
    const data = this._getTokensAtLine(position.lineNumber);
    let token1Index = 0;
    for (let i = data.tokens1.length - 1; i >= 0; i--) {
      const t = data.tokens1[i];
      if (position.column - 1 >= t.offset) {
        token1Index = i;
        break;
      }
    }
    let token2Index = 0;
    for (let i = data.tokens2.length >>> 1; i >= 0; i--) {
      if (position.column - 1 >= data.tokens2[i << 1]) {
        token2Index = i;
        break;
      }
    }
    const lineContent = this._model.getLineContent(position.lineNumber);
    let tokenText = "";
    if (token1Index < data.tokens1.length) {
      const tokenStartIndex = data.tokens1[token1Index].offset;
      const tokenEndIndex = token1Index + 1 < data.tokens1.length ? data.tokens1[token1Index + 1].offset : lineContent.length;
      tokenText = lineContent.substring(tokenStartIndex, tokenEndIndex);
    }
    reset(
      this._domNode,
      $(
        "h2.tm-token",
        void 0,
        renderTokenText(tokenText),
        $("span.tm-token-length", void 0, `${tokenText.length} ${tokenText.length === 1 ? "char" : "chars"}`)
      )
    );
    append(this._domNode, $("hr.tokens-inspect-separator", { "style": "clear:both" }));
    const metadata = (token2Index << 1) + 1 < data.tokens2.length ? this._decodeMetadata(data.tokens2[(token2Index << 1) + 1]) : null;
    append(this._domNode, $(
      "table.tm-metadata-table",
      void 0,
      $(
        "tbody",
        void 0,
        $(
          "tr",
          void 0,
          $("td.tm-metadata-key", void 0, "language"),
          $("td.tm-metadata-value", void 0, `${metadata ? metadata.languageId : "-?-"}`)
        ),
        $(
          "tr",
          void 0,
          $("td.tm-metadata-key", void 0, "token type"),
          $("td.tm-metadata-value", void 0, `${metadata ? this._tokenTypeToString(metadata.tokenType) : "-?-"}`)
        ),
        $(
          "tr",
          void 0,
          $("td.tm-metadata-key", void 0, "font style"),
          $("td.tm-metadata-value", void 0, `${metadata ? this._fontStyleToString(metadata.fontStyle) : "-?-"}`)
        ),
        $(
          "tr",
          void 0,
          $("td.tm-metadata-key", void 0, "foreground"),
          $("td.tm-metadata-value", void 0, `${metadata ? Color.Format.CSS.formatHex(metadata.foreground) : "-?-"}`)
        ),
        $(
          "tr",
          void 0,
          $("td.tm-metadata-key", void 0, "background"),
          $("td.tm-metadata-value", void 0, `${metadata ? Color.Format.CSS.formatHex(metadata.background) : "-?-"}`)
        )
      )
    ));
    append(this._domNode, $("hr.tokens-inspect-separator"));
    if (token1Index < data.tokens1.length) {
      append(this._domNode, $("span.tm-token-type", void 0, data.tokens1[token1Index].type));
    }
    this._editor.layoutContentWidget(this);
  }
  _decodeMetadata(metadata) {
    const colorMap = TokenizationRegistry.getColorMap();
    const languageId = TokenMetadata.getLanguageId(metadata);
    const tokenType = TokenMetadata.getTokenType(metadata);
    const fontStyle = TokenMetadata.getFontStyle(metadata);
    const foreground = TokenMetadata.getForeground(metadata);
    const background = TokenMetadata.getBackground(metadata);
    return {
      languageId: this._languageService.languageIdCodec.decodeLanguageId(languageId),
      tokenType,
      fontStyle,
      foreground: colorMap[foreground],
      background: colorMap[background]
    };
  }
  _tokenTypeToString(tokenType) {
    switch (tokenType) {
      case StandardTokenType.Other:
        return "Other";
      case StandardTokenType.Comment:
        return "Comment";
      case StandardTokenType.String:
        return "String";
      case StandardTokenType.RegEx:
        return "RegEx";
      default:
        return "??";
    }
  }
  _fontStyleToString(fontStyle) {
    let r = "";
    if (fontStyle & FontStyle.Italic) {
      r += "italic ";
    }
    if (fontStyle & FontStyle.Bold) {
      r += "bold ";
    }
    if (fontStyle & FontStyle.Underline) {
      r += "underline ";
    }
    if (fontStyle & FontStyle.Strikethrough) {
      r += "strikethrough ";
    }
    if (r.length === 0) {
      r = "---";
    }
    return r;
  }
  _getTokensAtLine(lineNumber) {
    const stateBeforeLine = this._getStateBeforeLine(lineNumber);
    const tokenizationResult1 = this._tokenizationSupport.tokenize(this._model.getLineContent(lineNumber), true, stateBeforeLine);
    const tokenizationResult2 = this._tokenizationSupport.tokenizeEncoded(this._model.getLineContent(lineNumber), true, stateBeforeLine);
    return {
      startState: stateBeforeLine,
      tokens1: tokenizationResult1.tokens,
      tokens2: tokenizationResult2.tokens,
      endState: tokenizationResult1.endState
    };
  }
  _getStateBeforeLine(lineNumber) {
    let state = this._tokenizationSupport.getInitialState();
    for (let i = 1; i < lineNumber; i++) {
      const tokenizationResult = this._tokenizationSupport.tokenize(this._model.getLineContent(i), true, state);
      state = tokenizationResult.endState;
    }
    return state;
  }
  getDomNode() {
    return this._domNode;
  }
  getPosition() {
    return {
      position: this._editor.getPosition(),
      preference: [ContentWidgetPositionPreference.BELOW, ContentWidgetPositionPreference.ABOVE]
    };
  }
};
_InspectTokensWidget._ID = "editor.contrib.inspectTokensWidget";
let InspectTokensWidget = _InspectTokensWidget;
registerEditorContribution(InspectTokensController.ID, InspectTokensController, EditorContributionInstantiation.Lazy);
registerEditorAction(InspectTokens);
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy9lZGl0b3Ivc3RhbmRhbG9uZS9icm93c2VyL2luc3BlY3RUb2tlbnMvaW5zcGVjdFRva2Vucy50cyJdLAogICJzb3VyY2VzQ29udGVudCI6IFsiLyotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cbiAqICBDb3B5cmlnaHQgKGMpIE1pY3Jvc29mdCBDb3Jwb3JhdGlvbi4gQWxsIHJpZ2h0cyByZXNlcnZlZC5cbiAqICBMaWNlbnNlZCB1bmRlciB0aGUgTUlUIExpY2Vuc2UuIFNlZSBMaWNlbnNlLnR4dCBpbiB0aGUgcHJvamVjdCByb290IGZvciBsaWNlbnNlIGluZm9ybWF0aW9uLlxuICotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLSovXG5cbmltcG9ydCAnLi9pbnNwZWN0VG9rZW5zLmNzcyc7XG5pbXBvcnQgeyAkLCBhcHBlbmQsIHJlc2V0IH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9icm93c2VyL2RvbS5qcyc7XG5pbXBvcnQgeyBDaGFyQ29kZSB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2NoYXJDb2RlLmpzJztcbmltcG9ydCB7IENvbG9yIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vY29sb3IuanMnO1xuaW1wb3J0IHsgS2V5Q29kZSB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2tleUNvZGVzLmpzJztcbmltcG9ydCB7IERpc3Bvc2FibGUgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9saWZlY3ljbGUuanMnO1xuaW1wb3J0IHsgQ29udGVudFdpZGdldFBvc2l0aW9uUHJlZmVyZW5jZSwgSUFjdGl2ZUNvZGVFZGl0b3IsIElDb2RlRWRpdG9yLCBJQ29udGVudFdpZGdldCwgSUNvbnRlbnRXaWRnZXRQb3NpdGlvbiB9IGZyb20gJy4uLy4uLy4uL2Jyb3dzZXIvZWRpdG9yQnJvd3Nlci5qcyc7XG5pbXBvcnQgeyBFZGl0b3JBY3Rpb24sIFNlcnZpY2VzQWNjZXNzb3IsIHJlZ2lzdGVyRWRpdG9yQWN0aW9uLCByZWdpc3RlckVkaXRvckNvbnRyaWJ1dGlvbiwgRWRpdG9yQ29udHJpYnV0aW9uSW5zdGFudGlhdGlvbiB9IGZyb20gJy4uLy4uLy4uL2Jyb3dzZXIvZWRpdG9yRXh0ZW5zaW9ucy5qcyc7XG5pbXBvcnQgeyBQb3NpdGlvbiB9IGZyb20gJy4uLy4uLy4uL2NvbW1vbi9jb3JlL3Bvc2l0aW9uLmpzJztcbmltcG9ydCB7IElFZGl0b3JDb250cmlidXRpb24gfSBmcm9tICcuLi8uLi8uLi9jb21tb24vZWRpdG9yQ29tbW9uLmpzJztcbmltcG9ydCB7IElUZXh0TW9kZWwgfSBmcm9tICcuLi8uLi8uLi9jb21tb24vbW9kZWwuanMnO1xuaW1wb3J0IHsgSVN0YXRlLCBJVG9rZW5pemF0aW9uU3VwcG9ydCwgVG9rZW5pemF0aW9uUmVnaXN0cnksIElMYW5ndWFnZUlkQ29kZWMsIFRva2VuIH0gZnJvbSAnLi4vLi4vLi4vY29tbW9uL2xhbmd1YWdlcy5qcyc7XG5pbXBvcnQgeyBGb250U3R5bGUsIFN0YW5kYXJkVG9rZW5UeXBlLCBUb2tlbk1ldGFkYXRhIH0gZnJvbSAnLi4vLi4vLi4vY29tbW9uL2VuY29kZWRUb2tlbkF0dHJpYnV0ZXMuanMnO1xuaW1wb3J0IHsgTnVsbFN0YXRlLCBudWxsVG9rZW5pemUsIG51bGxUb2tlbml6ZUVuY29kZWQgfSBmcm9tICcuLi8uLi8uLi9jb21tb24vbGFuZ3VhZ2VzL251bGxUb2tlbml6ZS5qcyc7XG5pbXBvcnQgeyBJTGFuZ3VhZ2VTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vY29tbW9uL2xhbmd1YWdlcy9sYW5ndWFnZS5qcyc7XG5pbXBvcnQgeyBJU3RhbmRhbG9uZVRoZW1lU2VydmljZSB9IGZyb20gJy4uLy4uL2NvbW1vbi9zdGFuZGFsb25lVGhlbWUuanMnO1xuaW1wb3J0IHsgSW5zcGVjdFRva2Vuc05MUyB9IGZyb20gJy4uLy4uLy4uL2NvbW1vbi9zdGFuZGFsb25lU3RyaW5ncy5qcyc7XG5cblxuY2xhc3MgSW5zcGVjdFRva2Vuc0NvbnRyb2xsZXIgZXh0ZW5kcyBEaXNwb3NhYmxlIGltcGxlbWVudHMgSUVkaXRvckNvbnRyaWJ1dGlvbiB7XG5cblx0cHVibGljIHN0YXRpYyByZWFkb25seSBJRCA9ICdlZGl0b3IuY29udHJpYi5pbnNwZWN0VG9rZW5zJztcblxuXHRwdWJsaWMgc3RhdGljIGdldChlZGl0b3I6IElDb2RlRWRpdG9yKTogSW5zcGVjdFRva2Vuc0NvbnRyb2xsZXIgfCBudWxsIHtcblx0XHRyZXR1cm4gZWRpdG9yLmdldENvbnRyaWJ1dGlvbjxJbnNwZWN0VG9rZW5zQ29udHJvbGxlcj4oSW5zcGVjdFRva2Vuc0NvbnRyb2xsZXIuSUQpO1xuXHR9XG5cblx0cHJpdmF0ZSByZWFkb25seSBfZWRpdG9yOiBJQ29kZUVkaXRvcjtcblx0cHJpdmF0ZSByZWFkb25seSBfbGFuZ3VhZ2VTZXJ2aWNlOiBJTGFuZ3VhZ2VTZXJ2aWNlO1xuXHRwcml2YXRlIF93aWRnZXQ6IEluc3BlY3RUb2tlbnNXaWRnZXQgfCBudWxsO1xuXG5cdGNvbnN0cnVjdG9yKFxuXHRcdGVkaXRvcjogSUNvZGVFZGl0b3IsXG5cdFx0QElTdGFuZGFsb25lVGhlbWVTZXJ2aWNlIHN0YW5kYWxvbmVDb2xvclNlcnZpY2U6IElTdGFuZGFsb25lVGhlbWVTZXJ2aWNlLFxuXHRcdEBJTGFuZ3VhZ2VTZXJ2aWNlIGxhbmd1YWdlU2VydmljZTogSUxhbmd1YWdlU2VydmljZVxuXHQpIHtcblx0XHRzdXBlcigpO1xuXHRcdHRoaXMuX2VkaXRvciA9IGVkaXRvcjtcblx0XHR0aGlzLl9sYW5ndWFnZVNlcnZpY2UgPSBsYW5ndWFnZVNlcnZpY2U7XG5cdFx0dGhpcy5fd2lkZ2V0ID0gbnVsbDtcblxuXHRcdHRoaXMuX3JlZ2lzdGVyKHRoaXMuX2VkaXRvci5vbkRpZENoYW5nZU1vZGVsKChlKSA9PiB0aGlzLnN0b3AoKSkpO1xuXHRcdHRoaXMuX3JlZ2lzdGVyKHRoaXMuX2VkaXRvci5vbkRpZENoYW5nZU1vZGVsTGFuZ3VhZ2UoKGUpID0+IHRoaXMuc3RvcCgpKSk7XG5cdFx0dGhpcy5fcmVnaXN0ZXIoVG9rZW5pemF0aW9uUmVnaXN0cnkub25EaWRDaGFuZ2UoKGUpID0+IHRoaXMuc3RvcCgpKSk7XG5cdFx0dGhpcy5fcmVnaXN0ZXIodGhpcy5fZWRpdG9yLm9uS2V5VXAoKGUpID0+IGUua2V5Q29kZSA9PT0gS2V5Q29kZS5Fc2NhcGUgJiYgdGhpcy5zdG9wKCkpKTtcblx0fVxuXG5cdHB1YmxpYyBvdmVycmlkZSBkaXNwb3NlKCk6IHZvaWQge1xuXHRcdHRoaXMuc3RvcCgpO1xuXHRcdHN1cGVyLmRpc3Bvc2UoKTtcblx0fVxuXG5cdHB1YmxpYyBsYXVuY2goKTogdm9pZCB7XG5cdFx0aWYgKHRoaXMuX3dpZGdldCkge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblx0XHRpZiAoIXRoaXMuX2VkaXRvci5oYXNNb2RlbCgpKSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXHRcdHRoaXMuX3dpZGdldCA9IG5ldyBJbnNwZWN0VG9rZW5zV2lkZ2V0KHRoaXMuX2VkaXRvciwgdGhpcy5fbGFuZ3VhZ2VTZXJ2aWNlKTtcblx0fVxuXG5cdHB1YmxpYyBzdG9wKCk6IHZvaWQge1xuXHRcdGlmICh0aGlzLl93aWRnZXQpIHtcblx0XHRcdHRoaXMuX3dpZGdldC5kaXNwb3NlKCk7XG5cdFx0XHR0aGlzLl93aWRnZXQgPSBudWxsO1xuXHRcdH1cblx0fVxufVxuXG5jbGFzcyBJbnNwZWN0VG9rZW5zIGV4dGVuZHMgRWRpdG9yQWN0aW9uIHtcblxuXHRjb25zdHJ1Y3RvcigpIHtcblx0XHRzdXBlcih7XG5cdFx0XHRpZDogJ2VkaXRvci5hY3Rpb24uaW5zcGVjdFRva2VucycsXG5cdFx0XHRsYWJlbDogSW5zcGVjdFRva2Vuc05MUy5pbnNwZWN0VG9rZW5zQWN0aW9uLFxuXHRcdFx0YWxpYXM6ICdEZXZlbG9wZXI6IEluc3BlY3QgVG9rZW5zJyxcblx0XHRcdHByZWNvbmRpdGlvbjogdW5kZWZpbmVkXG5cdFx0fSk7XG5cdH1cblxuXHRwdWJsaWMgcnVuKGFjY2Vzc29yOiBTZXJ2aWNlc0FjY2Vzc29yLCBlZGl0b3I6IElDb2RlRWRpdG9yKTogdm9pZCB7XG5cdFx0Y29uc3QgY29udHJvbGxlciA9IEluc3BlY3RUb2tlbnNDb250cm9sbGVyLmdldChlZGl0b3IpO1xuXHRcdGNvbnRyb2xsZXI/LmxhdW5jaCgpO1xuXHR9XG59XG5cbmludGVyZmFjZSBJQ29tcGxldGVMaW5lVG9rZW5pemF0aW9uIHtcblx0c3RhcnRTdGF0ZTogSVN0YXRlO1xuXHR0b2tlbnMxOiBUb2tlbltdO1xuXHR0b2tlbnMyOiBVaW50MzJBcnJheTtcblx0ZW5kU3RhdGU6IElTdGF0ZTtcbn1cblxuaW50ZXJmYWNlIElEZWNvZGVkTWV0YWRhdGEge1xuXHRsYW5ndWFnZUlkOiBzdHJpbmc7XG5cdHRva2VuVHlwZTogU3RhbmRhcmRUb2tlblR5cGU7XG5cdGZvbnRTdHlsZTogRm9udFN0eWxlO1xuXHRmb3JlZ3JvdW5kOiBDb2xvcjtcblx0YmFja2dyb3VuZDogQ29sb3I7XG59XG5cbmZ1bmN0aW9uIHJlbmRlclRva2VuVGV4dCh0b2tlblRleHQ6IHN0cmluZyk6IHN0cmluZyB7XG5cdGxldCByZXN1bHQ6IHN0cmluZyA9ICcnO1xuXHRmb3IgKGxldCBjaGFySW5kZXggPSAwLCBsZW4gPSB0b2tlblRleHQubGVuZ3RoOyBjaGFySW5kZXggPCBsZW47IGNoYXJJbmRleCsrKSB7XG5cdFx0Y29uc3QgY2hhckNvZGUgPSB0b2tlblRleHQuY2hhckNvZGVBdChjaGFySW5kZXgpO1xuXHRcdHN3aXRjaCAoY2hhckNvZGUpIHtcblx0XHRcdGNhc2UgQ2hhckNvZGUuVGFiOlxuXHRcdFx0XHRyZXN1bHQgKz0gJ1xcdTIxOTInOyAvLyAmcmFycjtcblx0XHRcdFx0YnJlYWs7XG5cblx0XHRcdGNhc2UgQ2hhckNvZGUuU3BhY2U6XG5cdFx0XHRcdHJlc3VsdCArPSAnXFx1MDBCNyc7IC8vICZtaWRkb3Q7XG5cdFx0XHRcdGJyZWFrO1xuXG5cdFx0XHRkZWZhdWx0OlxuXHRcdFx0XHRyZXN1bHQgKz0gU3RyaW5nLmZyb21DaGFyQ29kZShjaGFyQ29kZSk7XG5cdFx0fVxuXHR9XG5cdHJldHVybiByZXN1bHQ7XG59XG5cbmZ1bmN0aW9uIGdldFNhZmVUb2tlbml6YXRpb25TdXBwb3J0KGxhbmd1YWdlSWRDb2RlYzogSUxhbmd1YWdlSWRDb2RlYywgbGFuZ3VhZ2VJZDogc3RyaW5nKTogSVRva2VuaXphdGlvblN1cHBvcnQge1xuXHRjb25zdCB0b2tlbml6YXRpb25TdXBwb3J0ID0gVG9rZW5pemF0aW9uUmVnaXN0cnkuZ2V0KGxhbmd1YWdlSWQpO1xuXHRpZiAodG9rZW5pemF0aW9uU3VwcG9ydCkge1xuXHRcdHJldHVybiB0b2tlbml6YXRpb25TdXBwb3J0O1xuXHR9XG5cdGNvbnN0IGVuY29kZWRMYW5ndWFnZUlkID0gbGFuZ3VhZ2VJZENvZGVjLmVuY29kZUxhbmd1YWdlSWQobGFuZ3VhZ2VJZCk7XG5cdHJldHVybiB7XG5cdFx0Z2V0SW5pdGlhbFN0YXRlOiAoKSA9PiBOdWxsU3RhdGUsXG5cdFx0dG9rZW5pemU6IChsaW5lOiBzdHJpbmcsIGhhc0VPTDogYm9vbGVhbiwgc3RhdGU6IElTdGF0ZSkgPT4gbnVsbFRva2VuaXplKGxhbmd1YWdlSWQsIHN0YXRlKSxcblx0XHR0b2tlbml6ZUVuY29kZWQ6IChsaW5lOiBzdHJpbmcsIGhhc0VPTDogYm9vbGVhbiwgc3RhdGU6IElTdGF0ZSkgPT4gbnVsbFRva2VuaXplRW5jb2RlZChlbmNvZGVkTGFuZ3VhZ2VJZCwgc3RhdGUpXG5cdH07XG59XG5cbmNsYXNzIEluc3BlY3RUb2tlbnNXaWRnZXQgZXh0ZW5kcyBEaXNwb3NhYmxlIGltcGxlbWVudHMgSUNvbnRlbnRXaWRnZXQge1xuXG5cdHByaXZhdGUgc3RhdGljIHJlYWRvbmx5IF9JRCA9ICdlZGl0b3IuY29udHJpYi5pbnNwZWN0VG9rZW5zV2lkZ2V0JztcblxuXHQvLyBFZGl0b3IuSUNvbnRlbnRXaWRnZXQuYWxsb3dFZGl0b3JPdmVyZmxvd1xuXHRwdWJsaWMgYWxsb3dFZGl0b3JPdmVyZmxvdyA9IHRydWU7XG5cblx0cHJpdmF0ZSByZWFkb25seSBfZWRpdG9yOiBJQWN0aXZlQ29kZUVkaXRvcjtcblx0cHJpdmF0ZSByZWFkb25seSBfbGFuZ3VhZ2VTZXJ2aWNlOiBJTGFuZ3VhZ2VTZXJ2aWNlO1xuXHRwcml2YXRlIHJlYWRvbmx5IF90b2tlbml6YXRpb25TdXBwb3J0OiBJVG9rZW5pemF0aW9uU3VwcG9ydDtcblx0cHJpdmF0ZSByZWFkb25seSBfbW9kZWw6IElUZXh0TW9kZWw7XG5cdHByaXZhdGUgcmVhZG9ubHkgX2RvbU5vZGU6IEhUTUxFbGVtZW50O1xuXG5cdGNvbnN0cnVjdG9yKFxuXHRcdGVkaXRvcjogSUFjdGl2ZUNvZGVFZGl0b3IsXG5cdFx0bGFuZ3VhZ2VTZXJ2aWNlOiBJTGFuZ3VhZ2VTZXJ2aWNlXG5cdCkge1xuXHRcdHN1cGVyKCk7XG5cdFx0dGhpcy5fZWRpdG9yID0gZWRpdG9yO1xuXHRcdHRoaXMuX2xhbmd1YWdlU2VydmljZSA9IGxhbmd1YWdlU2VydmljZTtcblx0XHR0aGlzLl9tb2RlbCA9IHRoaXMuX2VkaXRvci5nZXRNb2RlbCgpO1xuXHRcdHRoaXMuX2RvbU5vZGUgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdkaXYnKTtcblx0XHR0aGlzLl9kb21Ob2RlLmNsYXNzTmFtZSA9ICd0b2tlbnMtaW5zcGVjdC13aWRnZXQnO1xuXHRcdHRoaXMuX3Rva2VuaXphdGlvblN1cHBvcnQgPSBnZXRTYWZlVG9rZW5pemF0aW9uU3VwcG9ydCh0aGlzLl9sYW5ndWFnZVNlcnZpY2UubGFuZ3VhZ2VJZENvZGVjLCB0aGlzLl9tb2RlbC5nZXRMYW5ndWFnZUlkKCkpO1xuXHRcdHRoaXMuX2NvbXB1dGUodGhpcy5fZWRpdG9yLmdldFBvc2l0aW9uKCkpO1xuXHRcdHRoaXMuX3JlZ2lzdGVyKHRoaXMuX2VkaXRvci5vbkRpZENoYW5nZUN1cnNvclBvc2l0aW9uKChlKSA9PiB0aGlzLl9jb21wdXRlKHRoaXMuX2VkaXRvci5nZXRQb3NpdGlvbigpKSkpO1xuXHRcdHRoaXMuX2VkaXRvci5hZGRDb250ZW50V2lkZ2V0KHRoaXMpO1xuXHR9XG5cblx0cHVibGljIG92ZXJyaWRlIGRpc3Bvc2UoKTogdm9pZCB7XG5cdFx0dGhpcy5fZWRpdG9yLnJlbW92ZUNvbnRlbnRXaWRnZXQodGhpcyk7XG5cdFx0c3VwZXIuZGlzcG9zZSgpO1xuXHR9XG5cblx0cHVibGljIGdldElkKCk6IHN0cmluZyB7XG5cdFx0cmV0dXJuIEluc3BlY3RUb2tlbnNXaWRnZXQuX0lEO1xuXHR9XG5cblx0cHJpdmF0ZSBfY29tcHV0ZShwb3NpdGlvbjogUG9zaXRpb24pOiB2b2lkIHtcblx0XHRjb25zdCBkYXRhID0gdGhpcy5fZ2V0VG9rZW5zQXRMaW5lKHBvc2l0aW9uLmxpbmVOdW1iZXIpO1xuXG5cdFx0bGV0IHRva2VuMUluZGV4ID0gMDtcblx0XHRmb3IgKGxldCBpID0gZGF0YS50b2tlbnMxLmxlbmd0aCAtIDE7IGkgPj0gMDsgaS0tKSB7XG5cdFx0XHRjb25zdCB0ID0gZGF0YS50b2tlbnMxW2ldO1xuXHRcdFx0aWYgKHBvc2l0aW9uLmNvbHVtbiAtIDEgPj0gdC5vZmZzZXQpIHtcblx0XHRcdFx0dG9rZW4xSW5kZXggPSBpO1xuXHRcdFx0XHRicmVhaztcblx0XHRcdH1cblx0XHR9XG5cblx0XHRsZXQgdG9rZW4ySW5kZXggPSAwO1xuXHRcdGZvciAobGV0IGkgPSAoZGF0YS50b2tlbnMyLmxlbmd0aCA+Pj4gMSk7IGkgPj0gMDsgaS0tKSB7XG5cdFx0XHRpZiAocG9zaXRpb24uY29sdW1uIC0gMSA+PSBkYXRhLnRva2VuczJbKGkgPDwgMSldKSB7XG5cdFx0XHRcdHRva2VuMkluZGV4ID0gaTtcblx0XHRcdFx0YnJlYWs7XG5cdFx0XHR9XG5cdFx0fVxuXG5cdFx0Y29uc3QgbGluZUNvbnRlbnQgPSB0aGlzLl9tb2RlbC5nZXRMaW5lQ29udGVudChwb3NpdGlvbi5saW5lTnVtYmVyKTtcblx0XHRsZXQgdG9rZW5UZXh0ID0gJyc7XG5cdFx0aWYgKHRva2VuMUluZGV4IDwgZGF0YS50b2tlbnMxLmxlbmd0aCkge1xuXHRcdFx0Y29uc3QgdG9rZW5TdGFydEluZGV4ID0gZGF0YS50b2tlbnMxW3Rva2VuMUluZGV4XS5vZmZzZXQ7XG5cdFx0XHRjb25zdCB0b2tlbkVuZEluZGV4ID0gdG9rZW4xSW5kZXggKyAxIDwgZGF0YS50b2tlbnMxLmxlbmd0aCA/IGRhdGEudG9rZW5zMVt0b2tlbjFJbmRleCArIDFdLm9mZnNldCA6IGxpbmVDb250ZW50Lmxlbmd0aDtcblx0XHRcdHRva2VuVGV4dCA9IGxpbmVDb250ZW50LnN1YnN0cmluZyh0b2tlblN0YXJ0SW5kZXgsIHRva2VuRW5kSW5kZXgpO1xuXHRcdH1cblx0XHRyZXNldCh0aGlzLl9kb21Ob2RlLFxuXHRcdFx0JCgnaDIudG0tdG9rZW4nLCB1bmRlZmluZWQsIHJlbmRlclRva2VuVGV4dCh0b2tlblRleHQpLFxuXHRcdFx0XHQkKCdzcGFuLnRtLXRva2VuLWxlbmd0aCcsIHVuZGVmaW5lZCwgYCR7dG9rZW5UZXh0Lmxlbmd0aH0gJHt0b2tlblRleHQubGVuZ3RoID09PSAxID8gJ2NoYXInIDogJ2NoYXJzJ31gKSkpO1xuXG5cdFx0YXBwZW5kKHRoaXMuX2RvbU5vZGUsICQoJ2hyLnRva2Vucy1pbnNwZWN0LXNlcGFyYXRvcicsIHsgJ3N0eWxlJzogJ2NsZWFyOmJvdGgnIH0pKTtcblxuXHRcdGNvbnN0IG1ldGFkYXRhID0gKHRva2VuMkluZGV4IDw8IDEpICsgMSA8IGRhdGEudG9rZW5zMi5sZW5ndGggPyB0aGlzLl9kZWNvZGVNZXRhZGF0YShkYXRhLnRva2VuczJbKHRva2VuMkluZGV4IDw8IDEpICsgMV0pIDogbnVsbDtcblx0XHRhcHBlbmQodGhpcy5fZG9tTm9kZSwgJCgndGFibGUudG0tbWV0YWRhdGEtdGFibGUnLCB1bmRlZmluZWQsXG5cdFx0XHQkKCd0Ym9keScsIHVuZGVmaW5lZCxcblx0XHRcdFx0JCgndHInLCB1bmRlZmluZWQsXG5cdFx0XHRcdFx0JCgndGQudG0tbWV0YWRhdGEta2V5JywgdW5kZWZpbmVkLCAnbGFuZ3VhZ2UnKSxcblx0XHRcdFx0XHQkKCd0ZC50bS1tZXRhZGF0YS12YWx1ZScsIHVuZGVmaW5lZCwgYCR7bWV0YWRhdGEgPyBtZXRhZGF0YS5sYW5ndWFnZUlkIDogJy0/LSd9YClcblx0XHRcdFx0KSxcblx0XHRcdFx0JCgndHInLCB1bmRlZmluZWQsXG5cdFx0XHRcdFx0JCgndGQudG0tbWV0YWRhdGEta2V5JywgdW5kZWZpbmVkLCAndG9rZW4gdHlwZScgYXMgc3RyaW5nKSxcblx0XHRcdFx0XHQkKCd0ZC50bS1tZXRhZGF0YS12YWx1ZScsIHVuZGVmaW5lZCwgYCR7bWV0YWRhdGEgPyB0aGlzLl90b2tlblR5cGVUb1N0cmluZyhtZXRhZGF0YS50b2tlblR5cGUpIDogJy0/LSd9YClcblx0XHRcdFx0KSxcblx0XHRcdFx0JCgndHInLCB1bmRlZmluZWQsXG5cdFx0XHRcdFx0JCgndGQudG0tbWV0YWRhdGEta2V5JywgdW5kZWZpbmVkLCAnZm9udCBzdHlsZScgYXMgc3RyaW5nKSxcblx0XHRcdFx0XHQkKCd0ZC50bS1tZXRhZGF0YS12YWx1ZScsIHVuZGVmaW5lZCwgYCR7bWV0YWRhdGEgPyB0aGlzLl9mb250U3R5bGVUb1N0cmluZyhtZXRhZGF0YS5mb250U3R5bGUpIDogJy0/LSd9YClcblx0XHRcdFx0KSxcblx0XHRcdFx0JCgndHInLCB1bmRlZmluZWQsXG5cdFx0XHRcdFx0JCgndGQudG0tbWV0YWRhdGEta2V5JywgdW5kZWZpbmVkLCAnZm9yZWdyb3VuZCcpLFxuXHRcdFx0XHRcdCQoJ3RkLnRtLW1ldGFkYXRhLXZhbHVlJywgdW5kZWZpbmVkLCBgJHttZXRhZGF0YSA/IENvbG9yLkZvcm1hdC5DU1MuZm9ybWF0SGV4KG1ldGFkYXRhLmZvcmVncm91bmQpIDogJy0/LSd9YClcblx0XHRcdFx0KSxcblx0XHRcdFx0JCgndHInLCB1bmRlZmluZWQsXG5cdFx0XHRcdFx0JCgndGQudG0tbWV0YWRhdGEta2V5JywgdW5kZWZpbmVkLCAnYmFja2dyb3VuZCcpLFxuXHRcdFx0XHRcdCQoJ3RkLnRtLW1ldGFkYXRhLXZhbHVlJywgdW5kZWZpbmVkLCBgJHttZXRhZGF0YSA/IENvbG9yLkZvcm1hdC5DU1MuZm9ybWF0SGV4KG1ldGFkYXRhLmJhY2tncm91bmQpIDogJy0/LSd9YClcblx0XHRcdFx0KVxuXHRcdFx0KVxuXHRcdCkpO1xuXHRcdGFwcGVuZCh0aGlzLl9kb21Ob2RlLCAkKCdoci50b2tlbnMtaW5zcGVjdC1zZXBhcmF0b3InKSk7XG5cblx0XHRpZiAodG9rZW4xSW5kZXggPCBkYXRhLnRva2VuczEubGVuZ3RoKSB7XG5cdFx0XHRhcHBlbmQodGhpcy5fZG9tTm9kZSwgJCgnc3Bhbi50bS10b2tlbi10eXBlJywgdW5kZWZpbmVkLCBkYXRhLnRva2VuczFbdG9rZW4xSW5kZXhdLnR5cGUpKTtcblx0XHR9XG5cblx0XHR0aGlzLl9lZGl0b3IubGF5b3V0Q29udGVudFdpZGdldCh0aGlzKTtcblx0fVxuXG5cdHByaXZhdGUgX2RlY29kZU1ldGFkYXRhKG1ldGFkYXRhOiBudW1iZXIpOiBJRGVjb2RlZE1ldGFkYXRhIHtcblx0XHRjb25zdCBjb2xvck1hcCA9IFRva2VuaXphdGlvblJlZ2lzdHJ5LmdldENvbG9yTWFwKCkhO1xuXHRcdGNvbnN0IGxhbmd1YWdlSWQgPSBUb2tlbk1ldGFkYXRhLmdldExhbmd1YWdlSWQobWV0YWRhdGEpO1xuXHRcdGNvbnN0IHRva2VuVHlwZSA9IFRva2VuTWV0YWRhdGEuZ2V0VG9rZW5UeXBlKG1ldGFkYXRhKTtcblx0XHRjb25zdCBmb250U3R5bGUgPSBUb2tlbk1ldGFkYXRhLmdldEZvbnRTdHlsZShtZXRhZGF0YSk7XG5cdFx0Y29uc3QgZm9yZWdyb3VuZCA9IFRva2VuTWV0YWRhdGEuZ2V0Rm9yZWdyb3VuZChtZXRhZGF0YSk7XG5cdFx0Y29uc3QgYmFja2dyb3VuZCA9IFRva2VuTWV0YWRhdGEuZ2V0QmFja2dyb3VuZChtZXRhZGF0YSk7XG5cdFx0cmV0dXJuIHtcblx0XHRcdGxhbmd1YWdlSWQ6IHRoaXMuX2xhbmd1YWdlU2VydmljZS5sYW5ndWFnZUlkQ29kZWMuZGVjb2RlTGFuZ3VhZ2VJZChsYW5ndWFnZUlkKSxcblx0XHRcdHRva2VuVHlwZTogdG9rZW5UeXBlLFxuXHRcdFx0Zm9udFN0eWxlOiBmb250U3R5bGUsXG5cdFx0XHRmb3JlZ3JvdW5kOiBjb2xvck1hcFtmb3JlZ3JvdW5kXSxcblx0XHRcdGJhY2tncm91bmQ6IGNvbG9yTWFwW2JhY2tncm91bmRdXG5cdFx0fTtcblx0fVxuXG5cdHByaXZhdGUgX3Rva2VuVHlwZVRvU3RyaW5nKHRva2VuVHlwZTogU3RhbmRhcmRUb2tlblR5cGUpOiBzdHJpbmcge1xuXHRcdHN3aXRjaCAodG9rZW5UeXBlKSB7XG5cdFx0XHRjYXNlIFN0YW5kYXJkVG9rZW5UeXBlLk90aGVyOiByZXR1cm4gJ090aGVyJztcblx0XHRcdGNhc2UgU3RhbmRhcmRUb2tlblR5cGUuQ29tbWVudDogcmV0dXJuICdDb21tZW50Jztcblx0XHRcdGNhc2UgU3RhbmRhcmRUb2tlblR5cGUuU3RyaW5nOiByZXR1cm4gJ1N0cmluZyc7XG5cdFx0XHRjYXNlIFN0YW5kYXJkVG9rZW5UeXBlLlJlZ0V4OiByZXR1cm4gJ1JlZ0V4Jztcblx0XHRcdGRlZmF1bHQ6IHJldHVybiAnPz8nO1xuXHRcdH1cblx0fVxuXG5cdHByaXZhdGUgX2ZvbnRTdHlsZVRvU3RyaW5nKGZvbnRTdHlsZTogRm9udFN0eWxlKTogc3RyaW5nIHtcblx0XHRsZXQgciA9ICcnO1xuXHRcdGlmIChmb250U3R5bGUgJiBGb250U3R5bGUuSXRhbGljKSB7XG5cdFx0XHRyICs9ICdpdGFsaWMgJztcblx0XHR9XG5cdFx0aWYgKGZvbnRTdHlsZSAmIEZvbnRTdHlsZS5Cb2xkKSB7XG5cdFx0XHRyICs9ICdib2xkICc7XG5cdFx0fVxuXHRcdGlmIChmb250U3R5bGUgJiBGb250U3R5bGUuVW5kZXJsaW5lKSB7XG5cdFx0XHRyICs9ICd1bmRlcmxpbmUgJztcblx0XHR9XG5cdFx0aWYgKGZvbnRTdHlsZSAmIEZvbnRTdHlsZS5TdHJpa2V0aHJvdWdoKSB7XG5cdFx0XHRyICs9ICdzdHJpa2V0aHJvdWdoICc7XG5cdFx0fVxuXHRcdGlmIChyLmxlbmd0aCA9PT0gMCkge1xuXHRcdFx0ciA9ICctLS0nO1xuXHRcdH1cblx0XHRyZXR1cm4gcjtcblx0fVxuXG5cdHByaXZhdGUgX2dldFRva2Vuc0F0TGluZShsaW5lTnVtYmVyOiBudW1iZXIpOiBJQ29tcGxldGVMaW5lVG9rZW5pemF0aW9uIHtcblx0XHRjb25zdCBzdGF0ZUJlZm9yZUxpbmUgPSB0aGlzLl9nZXRTdGF0ZUJlZm9yZUxpbmUobGluZU51bWJlcik7XG5cblx0XHRjb25zdCB0b2tlbml6YXRpb25SZXN1bHQxID0gdGhpcy5fdG9rZW5pemF0aW9uU3VwcG9ydC50b2tlbml6ZSh0aGlzLl9tb2RlbC5nZXRMaW5lQ29udGVudChsaW5lTnVtYmVyKSwgdHJ1ZSwgc3RhdGVCZWZvcmVMaW5lKTtcblx0XHRjb25zdCB0b2tlbml6YXRpb25SZXN1bHQyID0gdGhpcy5fdG9rZW5pemF0aW9uU3VwcG9ydC50b2tlbml6ZUVuY29kZWQodGhpcy5fbW9kZWwuZ2V0TGluZUNvbnRlbnQobGluZU51bWJlciksIHRydWUsIHN0YXRlQmVmb3JlTGluZSk7XG5cblx0XHRyZXR1cm4ge1xuXHRcdFx0c3RhcnRTdGF0ZTogc3RhdGVCZWZvcmVMaW5lLFxuXHRcdFx0dG9rZW5zMTogdG9rZW5pemF0aW9uUmVzdWx0MS50b2tlbnMsXG5cdFx0XHR0b2tlbnMyOiB0b2tlbml6YXRpb25SZXN1bHQyLnRva2Vucyxcblx0XHRcdGVuZFN0YXRlOiB0b2tlbml6YXRpb25SZXN1bHQxLmVuZFN0YXRlXG5cdFx0fTtcblx0fVxuXG5cdHByaXZhdGUgX2dldFN0YXRlQmVmb3JlTGluZShsaW5lTnVtYmVyOiBudW1iZXIpOiBJU3RhdGUge1xuXHRcdGxldCBzdGF0ZTogSVN0YXRlID0gdGhpcy5fdG9rZW5pemF0aW9uU3VwcG9ydC5nZXRJbml0aWFsU3RhdGUoKTtcblxuXHRcdGZvciAobGV0IGkgPSAxOyBpIDwgbGluZU51bWJlcjsgaSsrKSB7XG5cdFx0XHRjb25zdCB0b2tlbml6YXRpb25SZXN1bHQgPSB0aGlzLl90b2tlbml6YXRpb25TdXBwb3J0LnRva2VuaXplKHRoaXMuX21vZGVsLmdldExpbmVDb250ZW50KGkpLCB0cnVlLCBzdGF0ZSk7XG5cdFx0XHRzdGF0ZSA9IHRva2VuaXphdGlvblJlc3VsdC5lbmRTdGF0ZTtcblx0XHR9XG5cblx0XHRyZXR1cm4gc3RhdGU7XG5cdH1cblxuXHRwdWJsaWMgZ2V0RG9tTm9kZSgpOiBIVE1MRWxlbWVudCB7XG5cdFx0cmV0dXJuIHRoaXMuX2RvbU5vZGU7XG5cdH1cblxuXHRwdWJsaWMgZ2V0UG9zaXRpb24oKTogSUNvbnRlbnRXaWRnZXRQb3NpdGlvbiB7XG5cdFx0cmV0dXJuIHtcblx0XHRcdHBvc2l0aW9uOiB0aGlzLl9lZGl0b3IuZ2V0UG9zaXRpb24oKSxcblx0XHRcdHByZWZlcmVuY2U6IFtDb250ZW50V2lkZ2V0UG9zaXRpb25QcmVmZXJlbmNlLkJFTE9XLCBDb250ZW50V2lkZ2V0UG9zaXRpb25QcmVmZXJlbmNlLkFCT1ZFXVxuXHRcdH07XG5cdH1cbn1cblxucmVnaXN0ZXJFZGl0b3JDb250cmlidXRpb24oSW5zcGVjdFRva2Vuc0NvbnRyb2xsZXIuSUQsIEluc3BlY3RUb2tlbnNDb250cm9sbGVyLCBFZGl0b3JDb250cmlidXRpb25JbnN0YW50aWF0aW9uLkxhenkpO1xucmVnaXN0ZXJFZGl0b3JBY3Rpb24oSW5zcGVjdFRva2Vucyk7XG4iXSwKICAibWFwcGluZ3MiOiAiOzs7Ozs7Ozs7OztBQUtBLE9BQU87QUFDUCxTQUFTLEdBQUcsUUFBUSxhQUFhO0FBQ2pDLFNBQVMsZ0JBQWdCO0FBQ3pCLFNBQVMsYUFBYTtBQUN0QixT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
