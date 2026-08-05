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
import { Disposable, MutableDisposable } from "../../../../base/common/lifecycle.js";
import { MouseTargetType } from "../../../../editor/browser/editorBrowser.js";
import { localize, localize2 } from "../../../../nls.js";
import { ContextKeyExpr, IContextKeyService, RawContextKey } from "../../../../platform/contextkey/common/contextkey.js";
import { InlineChatController } from "./inlineChatController.js";
import { ACTION_START, CTX_INLINE_CHAT_HAS_AGENT, CTX_INLINE_CHAT_VISIBLE, InlineChatConfigKeys } from "../common/inlineChat.js";
import { EditorAction2 } from "../../../../editor/browser/editorExtensions.js";
import { EditOperation } from "../../../../editor/common/core/editOperation.js";
import { Range } from "../../../../editor/common/core/range.js";
import { Position } from "../../../../editor/common/core/position.js";
import { AbstractInline1ChatAction } from "./inlineChatActions.js";
import { EditorContextKeys } from "../../../../editor/common/editorContextKeys.js";
import { TrackedRangeStickiness } from "../../../../editor/common/model.js";
import { URI } from "../../../../base/common/uri.js";
import { isEqual } from "../../../../base/common/resources.js";
import { StandardTokenType } from "../../../../editor/common/encodedTokenAttributes.js";
import { autorun, derivedWithStore, observableFromEvent, observableValue } from "../../../../base/common/observable.js";
import { KeyChord, KeyCode, KeyMod } from "../../../../base/common/keyCodes.js";
import { KeybindingWeight } from "../../../../platform/keybinding/common/keybindingsRegistry.js";
import "./media/inlineChat.css";
import { IKeybindingService } from "../../../../platform/keybinding/common/keybinding.js";
import { ICommandService } from "../../../../platform/commands/common/commands.js";
import { InlineCompletionsController } from "../../../../editor/contrib/inlineCompletions/browser/controller/inlineCompletionsController.js";
import { IChatAgentService } from "../../chat/common/chatAgents.js";
import { IMarkerDecorationsService } from "../../../../editor/common/services/markerDecorations.js";
import { IContextMenuService } from "../../../../platform/contextview/browser/contextView.js";
import { toAction } from "../../../../base/common/actions.js";
import { IConfigurationService } from "../../../../platform/configuration/common/configuration.js";
import { observableCodeEditor } from "../../../../editor/browser/observableCodeEditor.js";
import { PLAINTEXT_LANGUAGE_ID } from "../../../../editor/common/languages/modesRegistry.js";
import { createStyleSheet2 } from "../../../../base/browser/domStylesheets.js";
import { stringValue } from "../../../../base/browser/cssValue.js";
import { observableConfigValue } from "../../../../platform/observable/common/platformObservableUtils.js";
import { Emitter } from "../../../../base/common/event.js";
import { ChatAgentLocation } from "../../chat/common/constants.js";
const CTX_INLINE_CHAT_SHOWING_HINT = new RawContextKey("inlineChatShowingHint", false, localize("inlineChatShowingHint", "Whether inline chat shows a contextual hint"));
const _inlineChatActionId = "inlineChat.startWithCurrentLine";
class InlineChatExpandLineAction extends EditorAction2 {
  constructor() {
    super({
      id: _inlineChatActionId,
      category: AbstractInline1ChatAction.category,
      title: localize2("startWithCurrentLine", "Start in Editor with Current Line"),
      f1: true,
      precondition: ContextKeyExpr.and(CTX_INLINE_CHAT_VISIBLE.negate(), CTX_INLINE_CHAT_HAS_AGENT, EditorContextKeys.writable),
      keybinding: [{
        when: CTX_INLINE_CHAT_SHOWING_HINT,
        weight: KeybindingWeight.WorkbenchContrib + 1,
        primary: KeyMod.CtrlCmd | KeyCode.KeyI
      }, {
        weight: KeybindingWeight.WorkbenchContrib,
        primary: KeyChord(KeyMod.CtrlCmd | KeyCode.KeyK, KeyCode.KeyI)
      }]
    });
  }
  async runEditorCommand(_accessor, editor) {
    const ctrl = InlineChatController.get(editor);
    if (!ctrl || !editor.hasModel()) {
      return;
    }
    const model = editor.getModel();
    const lineNumber = editor.getSelection().positionLineNumber;
    const lineContent = model.getLineContent(lineNumber);
    const startColumn = model.getLineFirstNonWhitespaceColumn(lineNumber);
    const endColumn = model.getLineMaxColumn(lineNumber);
    let undoEdits = [];
    model.pushEditOperations(null, [EditOperation.replace(new Range(lineNumber, startColumn, lineNumber, endColumn), "")], (edits) => {
      undoEdits = edits;
      return null;
    });
    const accepted = await ctrl.run({
      autoSend: true,
      message: lineContent.trim(),
      position: new Position(lineNumber, startColumn)
    });
    if (!accepted) {
      model.pushEditOperations(null, undoEdits, () => null);
    }
  }
}
class ShowInlineChatHintAction extends EditorAction2 {
  constructor() {
    super({
      id: "inlineChat.showHint",
      category: AbstractInline1ChatAction.category,
      title: localize2("showHint", "Show Inline Chat Hint"),
      f1: false,
      precondition: ContextKeyExpr.and(CTX_INLINE_CHAT_VISIBLE.negate(), CTX_INLINE_CHAT_HAS_AGENT, EditorContextKeys.writable)
    });
  }
  async runEditorCommand(_accessor, editor, ...args) {
    if (!editor.hasModel()) {
      return;
    }
    const ctrl = InlineChatHintsController.get(editor);
    if (!ctrl) {
      return;
    }
    const [uri, position] = args;
    if (!URI.isUri(uri) || !Position.isIPosition(position)) {
      ctrl.hide();
      return;
    }
    const model = editor.getModel();
    if (!isEqual(model.uri, uri)) {
      ctrl.hide();
      return;
    }
    model.tokenization.forceTokenization(position.lineNumber);
    const tokens = model.tokenization.getLineTokens(position.lineNumber);
    let totalLength = 0;
    let specialLength = 0;
    let lastTokenType;
    tokens.forEach((idx) => {
      const tokenType = tokens.getStandardTokenType(idx);
      const startOffset = tokens.getStartOffset(idx);
      const endOffset = tokens.getEndOffset(idx);
      totalLength += endOffset - startOffset;
      if (tokenType !== StandardTokenType.Other) {
        specialLength += endOffset - startOffset;
      }
      lastTokenType = tokenType;
    });
    if (specialLength / totalLength > 0.25) {
      ctrl.hide();
      return;
    }
    if (lastTokenType === StandardTokenType.Comment) {
      ctrl.hide();
      return;
    }
    ctrl.show();
  }
}
let InlineChatHintsController = class extends Disposable {
  constructor(editor, contextKeyService, commandService, keybindingService, chatAgentService, markerDecorationService, _contextMenuService, _configurationService) {
    super();
    this._contextMenuService = _contextMenuService;
    this._configurationService = _configurationService;
    this._visibilityObs = observableValue(this, false);
    this._editor = editor;
    this._ctxShowingHint = CTX_INLINE_CHAT_SHOWING_HINT.bindTo(contextKeyService);
    const ghostCtrl = InlineCompletionsController.get(editor);
    this._store.add(commandService.onWillExecuteCommand((e) => {
      if (e.commandId === _inlineChatActionId || e.commandId === ACTION_START) {
        this.hide();
      }
    }));
    this._store.add(this._editor.onMouseDown((e) => {
      if (e.target.type !== MouseTargetType.CONTENT_TEXT) {
        return;
      }
      if (!e.target.element?.classList.contains("inline-chat-hint-text")) {
        return;
      }
      if (e.event.leftButton) {
        commandService.executeCommand(_inlineChatActionId);
        this.hide();
      } else if (e.event.rightButton) {
        e.event.preventDefault();
        this._showContextMenu(
          e.event,
          e.target.element?.classList.contains("whitespace") ? InlineChatConfigKeys.LineEmptyHint : InlineChatConfigKeys.LineNLHint
        );
      }
    }));
    const markerSuppression = this._store.add(new MutableDisposable());
    const decos = this._editor.createDecorationsCollection();
    const editorObs = observableCodeEditor(editor);
    const keyObs = observableFromEvent(keybindingService.onDidUpdateKeybindings, (_) => keybindingService.lookupKeybinding(ACTION_START)?.getLabel());
    const configHintEmpty = observableConfigValue(InlineChatConfigKeys.LineEmptyHint, false, this._configurationService);
    const configHintNL = observableConfigValue(InlineChatConfigKeys.LineNLHint, false, this._configurationService);
    const showDataObs = derivedWithStore((r, store) => {
      const ghostState = ghostCtrl?.model.read(r)?.state.read(r);
      const textFocus = editorObs.isTextFocused.read(r);
      let position = editorObs.cursorPosition.read(r);
      const model = editorObs.model.read(r);
      const kb = keyObs.read(r);
      if (ghostState !== void 0 || !kb || !position || !model || !textFocus) {
        return void 0;
      }
      if (model.getLanguageId() === PLAINTEXT_LANGUAGE_ID || model.getLanguageId() === "markdown") {
        return void 0;
      }
      const emitter = store.add(new Emitter());
      store.add(model.onDidChangeContent(() => emitter.fire()));
      observableFromEvent(emitter.event, () => model.getVersionId()).read(r);
      position = model.validatePosition(position);
      const visible = this._visibilityObs.read(r);
      const isEol = model.getLineMaxColumn(position.lineNumber) === position.column;
      const isWhitespace = model.getLineLastNonWhitespaceColumn(position.lineNumber) === 0 && model.getValueLength() > 0 && position.column > 1;
      if (isWhitespace) {
        return configHintEmpty.read(r) ? { isEol, isWhitespace, kb, position, model } : void 0;
      }
      if (visible && isEol && configHintNL.read(r)) {
        return { isEol, isWhitespace, kb, position, model };
      }
      return void 0;
    });
    const style = createStyleSheet2();
    this._store.add(style);
    this._store.add(autorun((r) => {
      const showData = showDataObs.read(r);
      if (!showData) {
        decos.clear();
        markerSuppression.clear();
        this._ctxShowingHint.reset();
        return;
      }
      const agentName = chatAgentService.getDefaultAgent(ChatAgentLocation.Editor)?.name ?? localize("defaultTitle", "Chat");
      const { position, isEol, isWhitespace, kb, model } = showData;
      const inlineClassName = ["a", "inline-chat-hint", "inline-chat-hint-text"];
      let content;
      if (isWhitespace) {
        content = "\xA0" + localize("title2", "{0} to edit with {1}", kb, agentName);
      } else if (isEol) {
        content = "\xA0" + localize("title1", "{0} to continue with {1}", kb, agentName);
      } else {
        content = "\u200A" + kb + "\u200A";
        inlineClassName.push("embedded");
      }
      style.setStyle(`.inline-chat-hint-text::after { content: ${stringValue(content)} }`);
      if (isWhitespace) {
        inlineClassName.push("whitespace");
      }
      this._ctxShowingHint.set(true);
      decos.set([{
        range: Range.fromPositions(position),
        options: {
          description: "inline-chat-hint-line",
          showIfCollapsed: true,
          stickiness: TrackedRangeStickiness.NeverGrowsWhenTypingAtEdges,
          afterContentClassName: inlineClassName.join(" ")
        }
      }]);
      markerSuppression.value = markerDecorationService.addMarkerSuppression(model.uri, model.validateRange(new Range(position.lineNumber, 1, position.lineNumber, Number.MAX_SAFE_INTEGER)));
    }));
  }
  static get(editor) {
    return editor.getContribution(InlineChatHintsController.ID);
  }
  _showContextMenu(event, setting) {
    this._contextMenuService.showContextMenu({
      getAnchor: () => ({ x: event.posx, y: event.posy }),
      getActions: () => [
        toAction({
          id: "inlineChat.disableHint",
          label: localize("disableHint", "Disable Inline Chat Hint"),
          run: async () => {
            await this._configurationService.updateValue(setting, false);
          }
        })
      ]
    });
  }
  show() {
    this._visibilityObs.set(true, void 0);
  }
  hide() {
    this._visibilityObs.set(false, void 0);
  }
};
InlineChatHintsController.ID = "editor.contrib.inlineChatHints";
InlineChatHintsController = __decorateClass([
  __decorateParam(1, IContextKeyService),
  __decorateParam(2, ICommandService),
  __decorateParam(3, IKeybindingService),
  __decorateParam(4, IChatAgentService),
  __decorateParam(5, IMarkerDecorationsService),
  __decorateParam(6, IContextMenuService),
  __decorateParam(7, IConfigurationService)
], InlineChatHintsController);
class HideInlineChatHintAction extends EditorAction2 {
  constructor() {
    super({
      id: "inlineChat.hideHint",
      title: localize2("hideHint", "Hide Inline Chat Hint"),
      precondition: CTX_INLINE_CHAT_SHOWING_HINT,
      keybinding: {
        weight: KeybindingWeight.EditorContrib - 10,
        primary: KeyCode.Escape
      }
    });
  }
  async runEditorCommand(_accessor, editor) {
    InlineChatHintsController.get(editor)?.hide();
  }
}
export {
  CTX_INLINE_CHAT_SHOWING_HINT,
  HideInlineChatHintAction,
  InlineChatExpandLineAction,
  InlineChatHintsController,
  ShowInlineChatHintAction
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvY29udHJpYi9pbmxpbmVDaGF0L2Jyb3dzZXIvaW5saW5lQ2hhdEN1cnJlbnRMaW5lLnRzIl0sCiAgInNvdXJjZXNDb250ZW50IjogWyIvKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuICogIENvcHlyaWdodCAoYykgTWljcm9zb2Z0IENvcnBvcmF0aW9uLiBBbGwgcmlnaHRzIHJlc2VydmVkLlxuICogIExpY2Vuc2VkIHVuZGVyIHRoZSBNSVQgTGljZW5zZS4gU2VlIExpY2Vuc2UudHh0IGluIHRoZSBwcm9qZWN0IHJvb3QgZm9yIGxpY2Vuc2UgaW5mb3JtYXRpb24uXG4gKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tKi9cblxuaW1wb3J0IHsgRGlzcG9zYWJsZSwgTXV0YWJsZURpc3Bvc2FibGUgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9saWZlY3ljbGUuanMnO1xuaW1wb3J0IHsgSUNvZGVFZGl0b3IsIE1vdXNlVGFyZ2V0VHlwZSB9IGZyb20gJy4uLy4uLy4uLy4uL2VkaXRvci9icm93c2VyL2VkaXRvckJyb3dzZXIuanMnO1xuaW1wb3J0IHsgSUVkaXRvckNvbnRyaWJ1dGlvbiB9IGZyb20gJy4uLy4uLy4uLy4uL2VkaXRvci9jb21tb24vZWRpdG9yQ29tbW9uLmpzJztcbmltcG9ydCB7IGxvY2FsaXplLCBsb2NhbGl6ZTIgfSBmcm9tICcuLi8uLi8uLi8uLi9ubHMuanMnO1xuaW1wb3J0IHsgQ29udGV4dEtleUV4cHIsIElDb250ZXh0S2V5LCBJQ29udGV4dEtleVNlcnZpY2UsIFJhd0NvbnRleHRLZXkgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9jb250ZXh0a2V5L2NvbW1vbi9jb250ZXh0a2V5LmpzJztcbmltcG9ydCB7IElubGluZUNoYXRDb250cm9sbGVyIH0gZnJvbSAnLi9pbmxpbmVDaGF0Q29udHJvbGxlci5qcyc7XG5pbXBvcnQgeyBBQ1RJT05fU1RBUlQsIENUWF9JTkxJTkVfQ0hBVF9IQVNfQUdFTlQsIENUWF9JTkxJTkVfQ0hBVF9WSVNJQkxFLCBJbmxpbmVDaGF0Q29uZmlnS2V5cyB9IGZyb20gJy4uL2NvbW1vbi9pbmxpbmVDaGF0LmpzJztcbmltcG9ydCB7IEVkaXRvckFjdGlvbjIsIFNlcnZpY2VzQWNjZXNzb3IgfSBmcm9tICcuLi8uLi8uLi8uLi9lZGl0b3IvYnJvd3Nlci9lZGl0b3JFeHRlbnNpb25zLmpzJztcbmltcG9ydCB7IEVkaXRPcGVyYXRpb24gfSBmcm9tICcuLi8uLi8uLi8uLi9lZGl0b3IvY29tbW9uL2NvcmUvZWRpdE9wZXJhdGlvbi5qcyc7XG5pbXBvcnQgeyBSYW5nZSB9IGZyb20gJy4uLy4uLy4uLy4uL2VkaXRvci9jb21tb24vY29yZS9yYW5nZS5qcyc7XG5pbXBvcnQgeyBJUG9zaXRpb24sIFBvc2l0aW9uIH0gZnJvbSAnLi4vLi4vLi4vLi4vZWRpdG9yL2NvbW1vbi9jb3JlL3Bvc2l0aW9uLmpzJztcbmltcG9ydCB7IEFic3RyYWN0SW5saW5lMUNoYXRBY3Rpb24gfSBmcm9tICcuL2lubGluZUNoYXRBY3Rpb25zLmpzJztcbmltcG9ydCB7IEVkaXRvckNvbnRleHRLZXlzIH0gZnJvbSAnLi4vLi4vLi4vLi4vZWRpdG9yL2NvbW1vbi9lZGl0b3JDb250ZXh0S2V5cy5qcyc7XG5pbXBvcnQgeyBJVmFsaWRFZGl0T3BlcmF0aW9uLCBUcmFja2VkUmFuZ2VTdGlja2luZXNzIH0gZnJvbSAnLi4vLi4vLi4vLi4vZWRpdG9yL2NvbW1vbi9tb2RlbC5qcyc7XG5pbXBvcnQgeyBVUkkgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi91cmkuanMnO1xuaW1wb3J0IHsgaXNFcXVhbCB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL3Jlc291cmNlcy5qcyc7XG5pbXBvcnQgeyBTdGFuZGFyZFRva2VuVHlwZSB9IGZyb20gJy4uLy4uLy4uLy4uL2VkaXRvci9jb21tb24vZW5jb2RlZFRva2VuQXR0cmlidXRlcy5qcyc7XG5pbXBvcnQgeyBhdXRvcnVuLCBkZXJpdmVkV2l0aFN0b3JlLCBvYnNlcnZhYmxlRnJvbUV2ZW50LCBvYnNlcnZhYmxlVmFsdWUgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9vYnNlcnZhYmxlLmpzJztcbmltcG9ydCB7IEtleUNob3JkLCBLZXlDb2RlLCBLZXlNb2QgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9rZXlDb2Rlcy5qcyc7XG5pbXBvcnQgeyBLZXliaW5kaW5nV2VpZ2h0IH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0va2V5YmluZGluZy9jb21tb24va2V5YmluZGluZ3NSZWdpc3RyeS5qcyc7XG5pbXBvcnQgJy4vbWVkaWEvaW5saW5lQ2hhdC5jc3MnO1xuaW1wb3J0IHsgSUtleWJpbmRpbmdTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0va2V5YmluZGluZy9jb21tb24va2V5YmluZGluZy5qcyc7XG5pbXBvcnQgeyBJQ29tbWFuZFNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9jb21tYW5kcy9jb21tb24vY29tbWFuZHMuanMnO1xuaW1wb3J0IHsgSW5saW5lQ29tcGxldGlvbnNDb250cm9sbGVyIH0gZnJvbSAnLi4vLi4vLi4vLi4vZWRpdG9yL2NvbnRyaWIvaW5saW5lQ29tcGxldGlvbnMvYnJvd3Nlci9jb250cm9sbGVyL2lubGluZUNvbXBsZXRpb25zQ29udHJvbGxlci5qcyc7XG5pbXBvcnQgeyBJQ2hhdEFnZW50U2VydmljZSB9IGZyb20gJy4uLy4uL2NoYXQvY29tbW9uL2NoYXRBZ2VudHMuanMnO1xuaW1wb3J0IHsgSU1hcmtlckRlY29yYXRpb25zU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uL2VkaXRvci9jb21tb24vc2VydmljZXMvbWFya2VyRGVjb3JhdGlvbnMuanMnO1xuaW1wb3J0IHsgSUNvbnRleHRNZW51U2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL2NvbnRleHR2aWV3L2Jyb3dzZXIvY29udGV4dFZpZXcuanMnO1xuaW1wb3J0IHsgdG9BY3Rpb24gfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9hY3Rpb25zLmpzJztcbmltcG9ydCB7IElNb3VzZUV2ZW50IH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9icm93c2VyL21vdXNlRXZlbnQuanMnO1xuaW1wb3J0IHsgSUNvbmZpZ3VyYXRpb25TZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vY29uZmlndXJhdGlvbi9jb21tb24vY29uZmlndXJhdGlvbi5qcyc7XG5pbXBvcnQgeyBvYnNlcnZhYmxlQ29kZUVkaXRvciB9IGZyb20gJy4uLy4uLy4uLy4uL2VkaXRvci9icm93c2VyL29ic2VydmFibGVDb2RlRWRpdG9yLmpzJztcbmltcG9ydCB7IFBMQUlOVEVYVF9MQU5HVUFHRV9JRCB9IGZyb20gJy4uLy4uLy4uLy4uL2VkaXRvci9jb21tb24vbGFuZ3VhZ2VzL21vZGVzUmVnaXN0cnkuanMnO1xuaW1wb3J0IHsgY3JlYXRlU3R5bGVTaGVldDIgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2Jyb3dzZXIvZG9tU3R5bGVzaGVldHMuanMnO1xuaW1wb3J0IHsgc3RyaW5nVmFsdWUgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2Jyb3dzZXIvY3NzVmFsdWUuanMnO1xuaW1wb3J0IHsgb2JzZXJ2YWJsZUNvbmZpZ1ZhbHVlIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vb2JzZXJ2YWJsZS9jb21tb24vcGxhdGZvcm1PYnNlcnZhYmxlVXRpbHMuanMnO1xuaW1wb3J0IHsgRW1pdHRlciB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2V2ZW50LmpzJztcbmltcG9ydCB7IENoYXRBZ2VudExvY2F0aW9uIH0gZnJvbSAnLi4vLi4vY2hhdC9jb21tb24vY29uc3RhbnRzLmpzJztcblxuZXhwb3J0IGNvbnN0IENUWF9JTkxJTkVfQ0hBVF9TSE9XSU5HX0hJTlQgPSBuZXcgUmF3Q29udGV4dEtleTxib29sZWFuPignaW5saW5lQ2hhdFNob3dpbmdIaW50JywgZmFsc2UsIGxvY2FsaXplKCdpbmxpbmVDaGF0U2hvd2luZ0hpbnQnLCBcIldoZXRoZXIgaW5saW5lIGNoYXQgc2hvd3MgYSBjb250ZXh0dWFsIGhpbnRcIikpO1xuXG5jb25zdCBfaW5saW5lQ2hhdEFjdGlvbklkID0gJ2lubGluZUNoYXQuc3RhcnRXaXRoQ3VycmVudExpbmUnO1xuXG5leHBvcnQgY2xhc3MgSW5saW5lQ2hhdEV4cGFuZExpbmVBY3Rpb24gZXh0ZW5kcyBFZGl0b3JBY3Rpb24yIHtcblxuXHRjb25zdHJ1Y3RvcigpIHtcblx0XHRzdXBlcih7XG5cdFx0XHRpZDogX2lubGluZUNoYXRBY3Rpb25JZCxcblx0XHRcdGNhdGVnb3J5OiBBYnN0cmFjdElubGluZTFDaGF0QWN0aW9uLmNhdGVnb3J5LFxuXHRcdFx0dGl0bGU6IGxvY2FsaXplMignc3RhcnRXaXRoQ3VycmVudExpbmUnLCBcIlN0YXJ0IGluIEVkaXRvciB3aXRoIEN1cnJlbnQgTGluZVwiKSxcblx0XHRcdGYxOiB0cnVlLFxuXHRcdFx0cHJlY29uZGl0aW9uOiBDb250ZXh0S2V5RXhwci5hbmQoQ1RYX0lOTElORV9DSEFUX1ZJU0lCTEUubmVnYXRlKCksIENUWF9JTkxJTkVfQ0hBVF9IQVNfQUdFTlQsIEVkaXRvckNvbnRleHRLZXlzLndyaXRhYmxlKSxcblx0XHRcdGtleWJpbmRpbmc6IFt7XG5cdFx0XHRcdHdoZW46IENUWF9JTkxJTkVfQ0hBVF9TSE9XSU5HX0hJTlQsXG5cdFx0XHRcdHdlaWdodDogS2V5YmluZGluZ1dlaWdodC5Xb3JrYmVuY2hDb250cmliICsgMSxcblx0XHRcdFx0cHJpbWFyeTogS2V5TW9kLkN0cmxDbWQgfCBLZXlDb2RlLktleUlcblx0XHRcdH0sIHtcblx0XHRcdFx0d2VpZ2h0OiBLZXliaW5kaW5nV2VpZ2h0LldvcmtiZW5jaENvbnRyaWIsXG5cdFx0XHRcdHByaW1hcnk6IEtleUNob3JkKEtleU1vZC5DdHJsQ21kIHwgS2V5Q29kZS5LZXlLLCBLZXlDb2RlLktleUkpLFxuXHRcdFx0fV1cblx0XHR9KTtcblx0fVxuXG5cdG92ZXJyaWRlIGFzeW5jIHJ1bkVkaXRvckNvbW1hbmQoX2FjY2Vzc29yOiBTZXJ2aWNlc0FjY2Vzc29yLCBlZGl0b3I6IElDb2RlRWRpdG9yKSB7XG5cdFx0Y29uc3QgY3RybCA9IElubGluZUNoYXRDb250cm9sbGVyLmdldChlZGl0b3IpO1xuXHRcdGlmICghY3RybCB8fCAhZWRpdG9yLmhhc01vZGVsKCkpIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cblx0XHRjb25zdCBtb2RlbCA9IGVkaXRvci5nZXRNb2RlbCgpO1xuXHRcdGNvbnN0IGxpbmVOdW1iZXIgPSBlZGl0b3IuZ2V0U2VsZWN0aW9uKCkucG9zaXRpb25MaW5lTnVtYmVyO1xuXHRcdGNvbnN0IGxpbmVDb250ZW50ID0gbW9kZWwuZ2V0TGluZUNvbnRlbnQobGluZU51bWJlcik7XG5cblx0XHRjb25zdCBzdGFydENvbHVtbiA9IG1vZGVsLmdldExpbmVGaXJzdE5vbldoaXRlc3BhY2VDb2x1bW4obGluZU51bWJlcik7XG5cdFx0Y29uc3QgZW5kQ29sdW1uID0gbW9kZWwuZ2V0TGluZU1heENvbHVtbihsaW5lTnVtYmVyKTtcblxuXHRcdC8vIGNsZWFyIHRoZSBsaW5lXG5cdFx0bGV0IHVuZG9FZGl0czogSVZhbGlkRWRpdE9wZXJhdGlvbltdID0gW107XG5cdFx0bW9kZWwucHVzaEVkaXRPcGVyYXRpb25zKG51bGwsIFtFZGl0T3BlcmF0aW9uLnJlcGxhY2UobmV3IFJhbmdlKGxpbmVOdW1iZXIsIHN0YXJ0Q29sdW1uLCBsaW5lTnVtYmVyLCBlbmRDb2x1bW4pLCAnJyldLCAoZWRpdHMpID0+IHtcblx0XHRcdHVuZG9FZGl0cyA9IGVkaXRzO1xuXHRcdFx0cmV0dXJuIG51bGw7XG5cdFx0fSk7XG5cblx0XHQvLyB0cmlnZ2VyIGNoYXRcblx0XHRjb25zdCBhY2NlcHRlZCA9IGF3YWl0IGN0cmwucnVuKHtcblx0XHRcdGF1dG9TZW5kOiB0cnVlLFxuXHRcdFx0bWVzc2FnZTogbGluZUNvbnRlbnQudHJpbSgpLFxuXHRcdFx0cG9zaXRpb246IG5ldyBQb3NpdGlvbihsaW5lTnVtYmVyLCBzdGFydENvbHVtbilcblx0XHR9KTtcblxuXHRcdGlmICghYWNjZXB0ZWQpIHtcblx0XHRcdG1vZGVsLnB1c2hFZGl0T3BlcmF0aW9ucyhudWxsLCB1bmRvRWRpdHMsICgpID0+IG51bGwpO1xuXHRcdH1cblx0fVxufVxuXG5leHBvcnQgY2xhc3MgU2hvd0lubGluZUNoYXRIaW50QWN0aW9uIGV4dGVuZHMgRWRpdG9yQWN0aW9uMiB7XG5cblx0Y29uc3RydWN0b3IoKSB7XG5cdFx0c3VwZXIoe1xuXHRcdFx0aWQ6ICdpbmxpbmVDaGF0LnNob3dIaW50Jyxcblx0XHRcdGNhdGVnb3J5OiBBYnN0cmFjdElubGluZTFDaGF0QWN0aW9uLmNhdGVnb3J5LFxuXHRcdFx0dGl0bGU6IGxvY2FsaXplMignc2hvd0hpbnQnLCBcIlNob3cgSW5saW5lIENoYXQgSGludFwiKSxcblx0XHRcdGYxOiBmYWxzZSxcblx0XHRcdHByZWNvbmRpdGlvbjogQ29udGV4dEtleUV4cHIuYW5kKENUWF9JTkxJTkVfQ0hBVF9WSVNJQkxFLm5lZ2F0ZSgpLCBDVFhfSU5MSU5FX0NIQVRfSEFTX0FHRU5ULCBFZGl0b3JDb250ZXh0S2V5cy53cml0YWJsZSksXG5cdFx0fSk7XG5cdH1cblxuXHRvdmVycmlkZSBhc3luYyBydW5FZGl0b3JDb21tYW5kKF9hY2Nlc3NvcjogU2VydmljZXNBY2Nlc3NvciwgZWRpdG9yOiBJQ29kZUVkaXRvciwgLi4uYXJnczogW3VyaTogVVJJLCBwb3NpdGlvbjogSVBvc2l0aW9uLCAuLi5yZXN0OiBhbnlbXV0pIHtcblx0XHRpZiAoIWVkaXRvci5oYXNNb2RlbCgpKSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXG5cdFx0Y29uc3QgY3RybCA9IElubGluZUNoYXRIaW50c0NvbnRyb2xsZXIuZ2V0KGVkaXRvcik7XG5cdFx0aWYgKCFjdHJsKSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXG5cdFx0Y29uc3QgW3VyaSwgcG9zaXRpb25dID0gYXJncztcblx0XHRpZiAoIVVSSS5pc1VyaSh1cmkpIHx8ICFQb3NpdGlvbi5pc0lQb3NpdGlvbihwb3NpdGlvbikpIHtcblx0XHRcdGN0cmwuaGlkZSgpO1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblxuXHRcdGNvbnN0IG1vZGVsID0gZWRpdG9yLmdldE1vZGVsKCk7XG5cdFx0aWYgKCFpc0VxdWFsKG1vZGVsLnVyaSwgdXJpKSkge1xuXHRcdFx0Y3RybC5oaWRlKCk7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXG5cdFx0bW9kZWwudG9rZW5pemF0aW9uLmZvcmNlVG9rZW5pemF0aW9uKHBvc2l0aW9uLmxpbmVOdW1iZXIpO1xuXHRcdGNvbnN0IHRva2VucyA9IG1vZGVsLnRva2VuaXphdGlvbi5nZXRMaW5lVG9rZW5zKHBvc2l0aW9uLmxpbmVOdW1iZXIpO1xuXG5cdFx0bGV0IHRvdGFsTGVuZ3RoID0gMDtcblx0XHRsZXQgc3BlY2lhbExlbmd0aCA9IDA7XG5cdFx0bGV0IGxhc3RUb2tlblR5cGU6IFN0YW5kYXJkVG9rZW5UeXBlIHwgdW5kZWZpbmVkO1xuXG5cdFx0dG9rZW5zLmZvckVhY2goaWR4ID0+IHtcblx0XHRcdGNvbnN0IHRva2VuVHlwZSA9IHRva2Vucy5nZXRTdGFuZGFyZFRva2VuVHlwZShpZHgpO1xuXHRcdFx0Y29uc3Qgc3RhcnRPZmZzZXQgPSB0b2tlbnMuZ2V0U3RhcnRPZmZzZXQoaWR4KTtcblx0XHRcdGNvbnN0IGVuZE9mZnNldCA9IHRva2Vucy5nZXRFbmRPZmZzZXQoaWR4KTtcblx0XHRcdHRvdGFsTGVuZ3RoICs9IGVuZE9mZnNldCAtIHN0YXJ0T2Zmc2V0O1xuXG5cdFx0XHRpZiAodG9rZW5UeXBlICE9PSBTdGFuZGFyZFRva2VuVHlwZS5PdGhlcikge1xuXHRcdFx0XHRzcGVjaWFsTGVuZ3RoICs9IGVuZE9mZnNldCAtIHN0YXJ0T2Zmc2V0O1xuXHRcdFx0fVxuXHRcdFx0bGFzdFRva2VuVHlwZSA9IHRva2VuVHlwZTtcblx0XHR9KTtcblxuXHRcdGlmIChzcGVjaWFsTGVuZ3RoIC8gdG90YWxMZW5ndGggPiAwLjI1KSB7XG5cdFx0XHRjdHJsLmhpZGUoKTtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cdFx0aWYgKGxhc3RUb2tlblR5cGUgPT09IFN0YW5kYXJkVG9rZW5UeXBlLkNvbW1lbnQpIHtcblx0XHRcdGN0cmwuaGlkZSgpO1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblx0XHRjdHJsLnNob3coKTtcblx0fVxufVxuXG5leHBvcnQgY2xhc3MgSW5saW5lQ2hhdEhpbnRzQ29udHJvbGxlciBleHRlbmRzIERpc3Bvc2FibGUgaW1wbGVtZW50cyBJRWRpdG9yQ29udHJpYnV0aW9uIHtcblxuXHRwdWJsaWMgc3RhdGljIHJlYWRvbmx5IElEID0gJ2VkaXRvci5jb250cmliLmlubGluZUNoYXRIaW50cyc7XG5cblx0c3RhdGljIGdldChlZGl0b3I6IElDb2RlRWRpdG9yKTogSW5saW5lQ2hhdEhpbnRzQ29udHJvbGxlciB8IG51bGwge1xuXHRcdHJldHVybiBlZGl0b3IuZ2V0Q29udHJpYnV0aW9uPElubGluZUNoYXRIaW50c0NvbnRyb2xsZXI+KElubGluZUNoYXRIaW50c0NvbnRyb2xsZXIuSUQpO1xuXHR9XG5cblx0cHJpdmF0ZSByZWFkb25seSBfZWRpdG9yOiBJQ29kZUVkaXRvcjtcblx0cHJpdmF0ZSByZWFkb25seSBfY3R4U2hvd2luZ0hpbnQ6IElDb250ZXh0S2V5PGJvb2xlYW4+O1xuXHRwcml2YXRlIHJlYWRvbmx5IF92aXNpYmlsaXR5T2JzID0gb2JzZXJ2YWJsZVZhbHVlPGJvb2xlYW4+KHRoaXMsIGZhbHNlKTtcblxuXHRjb25zdHJ1Y3Rvcihcblx0XHRlZGl0b3I6IElDb2RlRWRpdG9yLFxuXHRcdEBJQ29udGV4dEtleVNlcnZpY2UgY29udGV4dEtleVNlcnZpY2U6IElDb250ZXh0S2V5U2VydmljZSxcblx0XHRASUNvbW1hbmRTZXJ2aWNlIGNvbW1hbmRTZXJ2aWNlOiBJQ29tbWFuZFNlcnZpY2UsXG5cdFx0QElLZXliaW5kaW5nU2VydmljZSBrZXliaW5kaW5nU2VydmljZTogSUtleWJpbmRpbmdTZXJ2aWNlLFxuXHRcdEBJQ2hhdEFnZW50U2VydmljZSBjaGF0QWdlbnRTZXJ2aWNlOiBJQ2hhdEFnZW50U2VydmljZSxcblx0XHRASU1hcmtlckRlY29yYXRpb25zU2VydmljZSBtYXJrZXJEZWNvcmF0aW9uU2VydmljZTogSU1hcmtlckRlY29yYXRpb25zU2VydmljZSxcblx0XHRASUNvbnRleHRNZW51U2VydmljZSBwcml2YXRlIHJlYWRvbmx5IF9jb250ZXh0TWVudVNlcnZpY2U6IElDb250ZXh0TWVudVNlcnZpY2UsXG5cdFx0QElDb25maWd1cmF0aW9uU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IF9jb25maWd1cmF0aW9uU2VydmljZTogSUNvbmZpZ3VyYXRpb25TZXJ2aWNlXG5cdCkge1xuXHRcdHN1cGVyKCk7XG5cdFx0dGhpcy5fZWRpdG9yID0gZWRpdG9yO1xuXHRcdHRoaXMuX2N0eFNob3dpbmdIaW50ID0gQ1RYX0lOTElORV9DSEFUX1NIT1dJTkdfSElOVC5iaW5kVG8oY29udGV4dEtleVNlcnZpY2UpO1xuXG5cdFx0Y29uc3QgZ2hvc3RDdHJsID0gSW5saW5lQ29tcGxldGlvbnNDb250cm9sbGVyLmdldChlZGl0b3IpO1xuXG5cdFx0dGhpcy5fc3RvcmUuYWRkKGNvbW1hbmRTZXJ2aWNlLm9uV2lsbEV4ZWN1dGVDb21tYW5kKGUgPT4ge1xuXHRcdFx0aWYgKGUuY29tbWFuZElkID09PSBfaW5saW5lQ2hhdEFjdGlvbklkIHx8IGUuY29tbWFuZElkID09PSBBQ1RJT05fU1RBUlQpIHtcblx0XHRcdFx0dGhpcy5oaWRlKCk7XG5cdFx0XHR9XG5cdFx0fSkpO1xuXG5cdFx0dGhpcy5fc3RvcmUuYWRkKHRoaXMuX2VkaXRvci5vbk1vdXNlRG93bihlID0+IHtcblx0XHRcdGlmIChlLnRhcmdldC50eXBlICE9PSBNb3VzZVRhcmdldFR5cGUuQ09OVEVOVF9URVhUKSB7XG5cdFx0XHRcdHJldHVybjtcblx0XHRcdH1cblx0XHRcdGlmICghZS50YXJnZXQuZWxlbWVudD8uY2xhc3NMaXN0LmNvbnRhaW5zKCdpbmxpbmUtY2hhdC1oaW50LXRleHQnKSkge1xuXHRcdFx0XHRyZXR1cm47XG5cdFx0XHR9XG5cdFx0XHRpZiAoZS5ldmVudC5sZWZ0QnV0dG9uKSB7XG5cdFx0XHRcdGNvbW1hbmRTZXJ2aWNlLmV4ZWN1dGVDb21tYW5kKF9pbmxpbmVDaGF0QWN0aW9uSWQpO1xuXHRcdFx0XHR0aGlzLmhpZGUoKTtcblx0XHRcdH0gZWxzZSBpZiAoZS5ldmVudC5yaWdodEJ1dHRvbikge1xuXHRcdFx0XHRlLmV2ZW50LnByZXZlbnREZWZhdWx0KCk7XG5cdFx0XHRcdHRoaXMuX3Nob3dDb250ZXh0TWVudShlLmV2ZW50LCBlLnRhcmdldC5lbGVtZW50Py5jbGFzc0xpc3QuY29udGFpbnMoJ3doaXRlc3BhY2UnKVxuXHRcdFx0XHRcdD8gSW5saW5lQ2hhdENvbmZpZ0tleXMuTGluZUVtcHR5SGludFxuXHRcdFx0XHRcdDogSW5saW5lQ2hhdENvbmZpZ0tleXMuTGluZU5MSGludFxuXHRcdFx0XHQpO1xuXHRcdFx0fVxuXHRcdH0pKTtcblxuXHRcdGNvbnN0IG1hcmtlclN1cHByZXNzaW9uID0gdGhpcy5fc3RvcmUuYWRkKG5ldyBNdXRhYmxlRGlzcG9zYWJsZSgpKTtcblx0XHRjb25zdCBkZWNvcyA9IHRoaXMuX2VkaXRvci5jcmVhdGVEZWNvcmF0aW9uc0NvbGxlY3Rpb24oKTtcblxuXHRcdGNvbnN0IGVkaXRvck9icyA9IG9ic2VydmFibGVDb2RlRWRpdG9yKGVkaXRvcik7XG5cdFx0Y29uc3Qga2V5T2JzID0gb2JzZXJ2YWJsZUZyb21FdmVudChrZXliaW5kaW5nU2VydmljZS5vbkRpZFVwZGF0ZUtleWJpbmRpbmdzLCBfID0+IGtleWJpbmRpbmdTZXJ2aWNlLmxvb2t1cEtleWJpbmRpbmcoQUNUSU9OX1NUQVJUKT8uZ2V0TGFiZWwoKSk7XG5cdFx0Y29uc3QgY29uZmlnSGludEVtcHR5ID0gb2JzZXJ2YWJsZUNvbmZpZ1ZhbHVlKElubGluZUNoYXRDb25maWdLZXlzLkxpbmVFbXB0eUhpbnQsIGZhbHNlLCB0aGlzLl9jb25maWd1cmF0aW9uU2VydmljZSk7XG5cdFx0Y29uc3QgY29uZmlnSGludE5MID0gb2JzZXJ2YWJsZUNvbmZpZ1ZhbHVlKElubGluZUNoYXRDb25maWdLZXlzLkxpbmVOTEhpbnQsIGZhbHNlLCB0aGlzLl9jb25maWd1cmF0aW9uU2VydmljZSk7XG5cblx0XHRjb25zdCBzaG93RGF0YU9icyA9IGRlcml2ZWRXaXRoU3RvcmUoKHIsIHN0b3JlKSA9PiB7XG5cdFx0XHRjb25zdCBnaG9zdFN0YXRlID0gZ2hvc3RDdHJsPy5tb2RlbC5yZWFkKHIpPy5zdGF0ZS5yZWFkKHIpO1xuXG5cdFx0XHRjb25zdCB0ZXh0Rm9jdXMgPSBlZGl0b3JPYnMuaXNUZXh0Rm9jdXNlZC5yZWFkKHIpO1xuXHRcdFx0bGV0IHBvc2l0aW9uID0gZWRpdG9yT2JzLmN1cnNvclBvc2l0aW9uLnJlYWQocik7XG5cdFx0XHRjb25zdCBtb2RlbCA9IGVkaXRvck9icy5tb2RlbC5yZWFkKHIpO1xuXG5cdFx0XHRjb25zdCBrYiA9IGtleU9icy5yZWFkKHIpO1xuXG5cdFx0XHRpZiAoZ2hvc3RTdGF0ZSAhPT0gdW5kZWZpbmVkIHx8ICFrYiB8fCAhcG9zaXRpb24gfHwgIW1vZGVsIHx8ICF0ZXh0Rm9jdXMpIHtcblx0XHRcdFx0cmV0dXJuIHVuZGVmaW5lZDtcblx0XHRcdH1cblxuXHRcdFx0aWYgKG1vZGVsLmdldExhbmd1YWdlSWQoKSA9PT0gUExBSU5URVhUX0xBTkdVQUdFX0lEIHx8IG1vZGVsLmdldExhbmd1YWdlSWQoKSA9PT0gJ21hcmtkb3duJykge1xuXHRcdFx0XHRyZXR1cm4gdW5kZWZpbmVkO1xuXHRcdFx0fVxuXG5cblx0XHRcdC8vIERFQlQgLSBJIGNhbm5vdCB1c2UgYG1vZGVsLm9uRGlkQ2hhbmdlQ29udGVudGAgZGlyZWN0bHkgaGVyZVxuXHRcdFx0Ly8gaHR0cHM6Ly9naXRodWIuY29tL21pY3Jvc29mdC92c2NvZGUvaXNzdWVzLzI0MjA1OVxuXHRcdFx0Y29uc3QgZW1pdHRlciA9IHN0b3JlLmFkZChuZXcgRW1pdHRlcjx2b2lkPigpKTtcblx0XHRcdHN0b3JlLmFkZChtb2RlbC5vbkRpZENoYW5nZUNvbnRlbnQoKCkgPT4gZW1pdHRlci5maXJlKCkpKTtcblx0XHRcdG9ic2VydmFibGVGcm9tRXZlbnQoZW1pdHRlci5ldmVudCwgKCkgPT4gbW9kZWwuZ2V0VmVyc2lvbklkKCkpLnJlYWQocik7XG5cblx0XHRcdC8vIHBvc2l0aW9uIGNhbiBiZSB3cm9uZ1xuXHRcdFx0cG9zaXRpb24gPSBtb2RlbC52YWxpZGF0ZVBvc2l0aW9uKHBvc2l0aW9uKTtcblxuXHRcdFx0Y29uc3QgdmlzaWJsZSA9IHRoaXMuX3Zpc2liaWxpdHlPYnMucmVhZChyKTtcblx0XHRcdGNvbnN0IGlzRW9sID0gbW9kZWwuZ2V0TGluZU1heENvbHVtbihwb3NpdGlvbi5saW5lTnVtYmVyKSA9PT0gcG9zaXRpb24uY29sdW1uO1xuXHRcdFx0Y29uc3QgaXNXaGl0ZXNwYWNlID0gbW9kZWwuZ2V0TGluZUxhc3ROb25XaGl0ZXNwYWNlQ29sdW1uKHBvc2l0aW9uLmxpbmVOdW1iZXIpID09PSAwICYmIG1vZGVsLmdldFZhbHVlTGVuZ3RoKCkgPiAwICYmIHBvc2l0aW9uLmNvbHVtbiA+IDE7XG5cblx0XHRcdGlmIChpc1doaXRlc3BhY2UpIHtcblx0XHRcdFx0cmV0dXJuIGNvbmZpZ0hpbnRFbXB0eS5yZWFkKHIpXG5cdFx0XHRcdFx0PyB7IGlzRW9sLCBpc1doaXRlc3BhY2UsIGtiLCBwb3NpdGlvbiwgbW9kZWwgfVxuXHRcdFx0XHRcdDogdW5kZWZpbmVkO1xuXHRcdFx0fVxuXG5cdFx0XHRpZiAodmlzaWJsZSAmJiBpc0VvbCAmJiBjb25maWdIaW50TkwucmVhZChyKSkge1xuXHRcdFx0XHRyZXR1cm4geyBpc0VvbCwgaXNXaGl0ZXNwYWNlLCBrYiwgcG9zaXRpb24sIG1vZGVsIH07XG5cdFx0XHR9XG5cblx0XHRcdHJldHVybiB1bmRlZmluZWQ7XG5cdFx0fSk7XG5cblx0XHRjb25zdCBzdHlsZSA9IGNyZWF0ZVN0eWxlU2hlZXQyKCk7XG5cdFx0dGhpcy5fc3RvcmUuYWRkKHN0eWxlKTtcblxuXHRcdHRoaXMuX3N0b3JlLmFkZChhdXRvcnVuKHIgPT4ge1xuXG5cdFx0XHRjb25zdCBzaG93RGF0YSA9IHNob3dEYXRhT2JzLnJlYWQocik7XG5cdFx0XHRpZiAoIXNob3dEYXRhKSB7XG5cdFx0XHRcdGRlY29zLmNsZWFyKCk7XG5cdFx0XHRcdG1hcmtlclN1cHByZXNzaW9uLmNsZWFyKCk7XG5cdFx0XHRcdHRoaXMuX2N0eFNob3dpbmdIaW50LnJlc2V0KCk7XG5cdFx0XHRcdHJldHVybjtcblx0XHRcdH1cblxuXHRcdFx0Y29uc3QgYWdlbnROYW1lID0gY2hhdEFnZW50U2VydmljZS5nZXREZWZhdWx0QWdlbnQoQ2hhdEFnZW50TG9jYXRpb24uRWRpdG9yKT8ubmFtZSA/PyBsb2NhbGl6ZSgnZGVmYXVsdFRpdGxlJywgXCJDaGF0XCIpO1xuXHRcdFx0Y29uc3QgeyBwb3NpdGlvbiwgaXNFb2wsIGlzV2hpdGVzcGFjZSwga2IsIG1vZGVsIH0gPSBzaG93RGF0YTtcblxuXHRcdFx0Y29uc3QgaW5saW5lQ2xhc3NOYW1lOiBzdHJpbmdbXSA9IFsnYScgLypIQUNLIGJ1dCBzb3J0cyBhcyB3ZSB3YW50Ki8sICdpbmxpbmUtY2hhdC1oaW50JywgJ2lubGluZS1jaGF0LWhpbnQtdGV4dCddO1xuXHRcdFx0bGV0IGNvbnRlbnQ6IHN0cmluZztcblx0XHRcdGlmIChpc1doaXRlc3BhY2UpIHtcblx0XHRcdFx0Y29udGVudCA9ICdcXHUwMGEwJyArIGxvY2FsaXplKCd0aXRsZTInLCBcInswfSB0byBlZGl0IHdpdGggezF9XCIsIGtiLCBhZ2VudE5hbWUpO1xuXHRcdFx0fSBlbHNlIGlmIChpc0VvbCkge1xuXHRcdFx0XHRjb250ZW50ID0gJ1xcdTAwYTAnICsgbG9jYWxpemUoJ3RpdGxlMScsIFwiezB9IHRvIGNvbnRpbnVlIHdpdGggezF9XCIsIGtiLCBhZ2VudE5hbWUpO1xuXHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0Y29udGVudCA9ICdcXHUyMDBhJyArIGtiICsgJ1xcdTIwMGEnO1xuXHRcdFx0XHRpbmxpbmVDbGFzc05hbWUucHVzaCgnZW1iZWRkZWQnKTtcblx0XHRcdH1cblxuXHRcdFx0c3R5bGUuc2V0U3R5bGUoYC5pbmxpbmUtY2hhdC1oaW50LXRleHQ6OmFmdGVyIHsgY29udGVudDogJHtzdHJpbmdWYWx1ZShjb250ZW50KX0gfWApO1xuXHRcdFx0aWYgKGlzV2hpdGVzcGFjZSkge1xuXHRcdFx0XHRpbmxpbmVDbGFzc05hbWUucHVzaCgnd2hpdGVzcGFjZScpO1xuXHRcdFx0fVxuXG5cdFx0XHR0aGlzLl9jdHhTaG93aW5nSGludC5zZXQodHJ1ZSk7XG5cblx0XHRcdGRlY29zLnNldChbe1xuXHRcdFx0XHRyYW5nZTogUmFuZ2UuZnJvbVBvc2l0aW9ucyhwb3NpdGlvbiksXG5cdFx0XHRcdG9wdGlvbnM6IHtcblx0XHRcdFx0XHRkZXNjcmlwdGlvbjogJ2lubGluZS1jaGF0LWhpbnQtbGluZScsXG5cdFx0XHRcdFx0c2hvd0lmQ29sbGFwc2VkOiB0cnVlLFxuXHRcdFx0XHRcdHN0aWNraW5lc3M6IFRyYWNrZWRSYW5nZVN0aWNraW5lc3MuTmV2ZXJHcm93c1doZW5UeXBpbmdBdEVkZ2VzLFxuXHRcdFx0XHRcdGFmdGVyQ29udGVudENsYXNzTmFtZTogaW5saW5lQ2xhc3NOYW1lLmpvaW4oJyAnKSxcblx0XHRcdFx0fVxuXHRcdFx0fV0pO1xuXG5cdFx0XHRtYXJrZXJTdXBwcmVzc2lvbi52YWx1ZSA9IG1hcmtlckRlY29yYXRpb25TZXJ2aWNlLmFkZE1hcmtlclN1cHByZXNzaW9uKG1vZGVsLnVyaSwgbW9kZWwudmFsaWRhdGVSYW5nZShuZXcgUmFuZ2UocG9zaXRpb24ubGluZU51bWJlciwgMSwgcG9zaXRpb24ubGluZU51bWJlciwgTnVtYmVyLk1BWF9TQUZFX0lOVEVHRVIpKSk7XG5cdFx0fSkpO1xuXHR9XG5cblx0cHJpdmF0ZSBfc2hvd0NvbnRleHRNZW51KGV2ZW50OiBJTW91c2VFdmVudCwgc2V0dGluZzogc3RyaW5nKTogdm9pZCB7XG5cdFx0dGhpcy5fY29udGV4dE1lbnVTZXJ2aWNlLnNob3dDb250ZXh0TWVudSh7XG5cdFx0XHRnZXRBbmNob3I6ICgpID0+ICh7IHg6IGV2ZW50LnBvc3gsIHk6IGV2ZW50LnBvc3kgfSksXG5cdFx0XHRnZXRBY3Rpb25zOiAoKSA9PiBbXG5cdFx0XHRcdHRvQWN0aW9uKHtcblx0XHRcdFx0XHRpZDogJ2lubGluZUNoYXQuZGlzYWJsZUhpbnQnLFxuXHRcdFx0XHRcdGxhYmVsOiBsb2NhbGl6ZSgnZGlzYWJsZUhpbnQnLCBcIkRpc2FibGUgSW5saW5lIENoYXQgSGludFwiKSxcblx0XHRcdFx0XHRydW46IGFzeW5jICgpID0+IHtcblx0XHRcdFx0XHRcdGF3YWl0IHRoaXMuX2NvbmZpZ3VyYXRpb25TZXJ2aWNlLnVwZGF0ZVZhbHVlKHNldHRpbmcsIGZhbHNlKTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdH0pXG5cdFx0XHRdXG5cdFx0fSk7XG5cdH1cblxuXHRzaG93KCk6IHZvaWQge1xuXHRcdHRoaXMuX3Zpc2liaWxpdHlPYnMuc2V0KHRydWUsIHVuZGVmaW5lZCk7XG5cdH1cblxuXHRoaWRlKCk6IHZvaWQge1xuXHRcdHRoaXMuX3Zpc2liaWxpdHlPYnMuc2V0KGZhbHNlLCB1bmRlZmluZWQpO1xuXHR9XG59XG5cbmV4cG9ydCBjbGFzcyBIaWRlSW5saW5lQ2hhdEhpbnRBY3Rpb24gZXh0ZW5kcyBFZGl0b3JBY3Rpb24yIHtcblxuXHRjb25zdHJ1Y3RvcigpIHtcblx0XHRzdXBlcih7XG5cdFx0XHRpZDogJ2lubGluZUNoYXQuaGlkZUhpbnQnLFxuXHRcdFx0dGl0bGU6IGxvY2FsaXplMignaGlkZUhpbnQnLCBcIkhpZGUgSW5saW5lIENoYXQgSGludFwiKSxcblx0XHRcdHByZWNvbmRpdGlvbjogQ1RYX0lOTElORV9DSEFUX1NIT1dJTkdfSElOVCxcblx0XHRcdGtleWJpbmRpbmc6IHtcblx0XHRcdFx0d2VpZ2h0OiBLZXliaW5kaW5nV2VpZ2h0LkVkaXRvckNvbnRyaWIgLSAxMCxcblx0XHRcdFx0cHJpbWFyeTogS2V5Q29kZS5Fc2NhcGVcblx0XHRcdH1cblx0XHR9KTtcblx0fVxuXG5cdG92ZXJyaWRlIGFzeW5jIHJ1bkVkaXRvckNvbW1hbmQoX2FjY2Vzc29yOiBTZXJ2aWNlc0FjY2Vzc29yLCBlZGl0b3I6IElDb2RlRWRpdG9yKTogUHJvbWlzZTx2b2lkPiB7XG5cdFx0SW5saW5lQ2hhdEhpbnRzQ29udHJvbGxlci5nZXQoZWRpdG9yKT8uaGlkZSgpO1xuXHR9XG59XG4iXSwKICAibWFwcGluZ3MiOiAiOzs7Ozs7Ozs7OztBQUtBLFNBQVMsWUFBWSx5QkFBeUI7QUFDOUMsU0FBc0IsdUJBQXVCO0FBRTdDLFNBQVMsVUFBVSxpQkFBaUI7QUFDcEMsU0FBUyxnQkFBNkIsb0JBQW9CLHFCQUFxQjtBQUMvRSxTQUFTLDRCQUE0QjtBQUNyQyxTQUFTLGNBQWMsMkJBQTJCLHlCQUF5Qiw0QkFBNEI7QUFDdkcsU0FBUyxxQkFBdUM7QUFDaEQsU0FBUyxxQkFBcUI7QUFDOUIsU0FBUyxhQUFhO0FBQ3RCLFNBQW9CLGdCQUFnQjtBQUNwQyxTQUFTLGlDQUFpQztBQUMxQyxTQUFTLHlCQUF5QjtBQUNsQyxTQUE4Qiw4QkFBOEI7QUFDNUQsU0FBUyxXQUFXO0FBQ3BCLFNBQVMsZUFBZTtBQUN4QixTQUFTLHlCQUF5QjtBQUNsQyxTQUFTLFNBQVMsa0JBQWtCLHFCQUFxQix1QkFBdUI7QUFDaEYsU0FBUyxVQUFVLFNBQVMsY0FBYztBQUMxQyxTQUFTLHdCQUF3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QUFRLHdCQUF3QixxQkFBcUIsTUFBTSxLQUFLLE1BQU0sY0FBYyxJQUFJLE1BQU0sU0FBUyxZQUFZLEdBQUcsU0FBUyxZQUFZLE9BQU8sZ0JBQWdCLENBQUMsQ0FBQztBQUFBLElBQ3ZMLENBQUMsQ0FBQztBQUFBLEVBQ0g7QUFBQSxFQW5KQSxPQUFPLElBQUksUUFBdUQ7QUFDakUsV0FBTyxPQUFPLGdCQUEyQywwQkFBMEIsRUFBRTtBQUFBLEVBQ3RGO0FBQUEsRUFtSlEsaUJBQWlCLE9BQW9CLFNBQXVCO0FBQ25FLFNBQUssb0JBQW9CLGdCQUFnQjtBQUFBLE1BQ3hDLFdBQVcsT0FBTyxFQUFFLEdBQUcsTUFBTSxNQUFNLEdBQUcsTUFBTSxLQUFLO0FBQUEsTUFDakQsWUFBWSxNQUFNO0FBQUEsUUFDakIsU0FBUztBQUFBLFVBQ1IsSUFBSTtBQUFBLFVBQ0osT0FBTyxTQUFTLGVBQWUsMEJBQTBCO0FBQUEsVUFDekQsS0FBSyxZQUFZO0FBQ2hCLGtCQUFNLEtBQUssc0JBQXNCLFlBQVksU0FBUyxLQUFLO0FBQUEsVUFDNUQ7QUFBQSxRQUNELENBQUM7QUFBQSxNQUNGO0FBQUEsSUFDRCxDQUFDO0FBQUEsRUFDRjtBQUFBLEVBRUEsT0FBYTtBQUNaLFNBQUssZUFBZSxJQUFJLE1BQU0sTUFBUztBQUFBLEVBQ3hDO0FBQUEsRUFFQSxPQUFhO0FBQ1osU0FBSyxlQUFlLElBQUksT0FBTyxNQUFTO0FBQUEsRUFDekM7QUFDRDtBQS9LYSwwQkFFVyxLQUFLO0FBRmhCLDRCQUFOO0FBQUEsRUFjSjtBQUFBLEVBQ0E7QUFBQSxFQUNBO0FBQUEsRUFDQTtBQUFBLEVBQ0E7QUFBQSxFQUNBO0FBQUEsRUFDQTtBQUFBLEdBcEJVO0FBaUxOLE1BQU0saUNBQWlDLGNBQWM7QUFBQSxFQUUzRCxjQUFjO0FBQ2IsVUFBTTtBQUFBLE1BQ0wsSUFBSTtBQUFBLE1BQ0osT0FBTyxVQUFVLFlBQVksdUJBQXVCO0FBQUEsTUFDcEQsY0FBYztBQUFBLE1BQ2QsWUFBWTtBQUFBLFFBQ1gsUUFBUSxpQkFBaUIsZ0JBQWdCO0FBQUEsUUFDekMsU0FBUyxRQUFRO0FBQUEsTUFDbEI7QUFBQSxJQUNELENBQUM7QUFBQSxFQUNGO0FBQUEsRUFFQSxNQUFlLGlCQUFpQixXQUE2QixRQUFvQztBQUNoRyw4QkFBMEIsSUFBSSxNQUFNLEdBQUcsS0FBSztBQUFBLEVBQzdDO0FBQ0Q7IiwKICAibmFtZXMiOiBbXQp9Cg==
