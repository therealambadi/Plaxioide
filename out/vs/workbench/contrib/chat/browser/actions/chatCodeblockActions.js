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
import { AsyncIterableObject } from "../../../../../base/common/async.js";
import { CancellationToken } from "../../../../../base/common/cancellation.js";
import { Codicon } from "../../../../../base/common/codicons.js";
import { KeyCode, KeyMod } from "../../../../../base/common/keyCodes.js";
import { Disposable, markAsSingleton } from "../../../../../base/common/lifecycle.js";
import { ICodeEditorService } from "../../../../../editor/browser/services/codeEditorService.js";
import { EditorContextKeys } from "../../../../../editor/common/editorContextKeys.js";
import { CopyAction } from "../../../../../editor/contrib/clipboard/browser/clipboard.js";
import { localize, localize2 } from "../../../../../nls.js";
import { IActionViewItemService } from "../../../../../platform/actions/browser/actionViewItemService.js";
import { MenuEntryActionViewItem } from "../../../../../platform/actions/browser/menuEntryActionViewItem.js";
import { Action2, MenuId, MenuItemAction, registerAction2 } from "../../../../../platform/actions/common/actions.js";
import { IClipboardService } from "../../../../../platform/clipboard/common/clipboardService.js";
import { ContextKeyExpr } from "../../../../../platform/contextkey/common/contextkey.js";
import { IInstantiationService } from "../../../../../platform/instantiation/common/instantiation.js";
import { KeybindingWeight } from "../../../../../platform/keybinding/common/keybindingsRegistry.js";
import { ILabelService } from "../../../../../platform/label/common/label.js";
import { TerminalLocation } from "../../../../../platform/terminal/common/terminal.js";
import { IEditorService } from "../../../../services/editor/common/editorService.js";
import { accessibleViewInCodeBlock } from "../../../accessibility/browser/accessibilityConfiguration.js";
import { reviewEdits } from "../../../inlineChat/browser/inlineChatController.js";
import { ITerminalEditorService, ITerminalGroupService, ITerminalService } from "../../../terminal/browser/terminal.js";
import { ChatContextKeys } from "../../common/chatContextKeys.js";
import { ChatCopyKind, IChatService } from "../../common/chatService.js";
import { isResponseVM } from "../../common/chatViewModel.js";
import { ChatAgentLocation } from "../../common/constants.js";
import { IChatCodeBlockContextProviderService, IChatWidgetService } from "../chat.js";
import { DefaultChatTextEditor } from "../codeBlockPart.js";
import { CHAT_CATEGORY } from "./chatActions.js";
import { ApplyCodeBlockOperation, InsertCodeBlockOperation } from "./codeBlockOperations.js";
const shellLangIds = [
  "fish",
  "ps1",
  "pwsh",
  "powershell",
  "sh",
  "shellscript",
  "zsh"
];
function isCodeBlockActionContext(thing) {
  return typeof thing === "object" && thing !== null && "code" in thing && "element" in thing;
}
function isCodeCompareBlockActionContext(thing) {
  return typeof thing === "object" && thing !== null && "element" in thing;
}
function isResponseFiltered(context) {
  return isResponseVM(context.element) && context.element.errorDetails?.responseIsFiltered;
}
class ChatCodeBlockAction extends Action2 {
  run(accessor, ...args) {
    let context = args[0];
    if (!isCodeBlockActionContext(context)) {
      const codeEditorService = accessor.get(ICodeEditorService);
      const editor = codeEditorService.getFocusedCodeEditor() || codeEditorService.getActiveCodeEditor();
      if (!editor) {
        return;
      }
      context = getContextFromEditor(editor, accessor);
      if (!isCodeBlockActionContext(context)) {
        return;
      }
    }
    return this.runWithContext(accessor, context);
  }
}
const APPLY_IN_EDITOR_ID = "workbench.action.chat.applyInEditor";
let CodeBlockActionRendering = class extends Disposable {
  constructor(actionViewItemService, instantiationService, labelService) {
    super();
    const disposable = actionViewItemService.register(MenuId.ChatCodeBlock, APPLY_IN_EDITOR_ID, (action, options) => {
      if (!(action instanceof MenuItemAction)) {
        return void 0;
      }
      return instantiationService.createInstance(class extends MenuEntryActionViewItem {
        getTooltip() {
          const context = this._context;
          if (isCodeBlockActionContext(context) && context.codemapperUri) {
            const label = labelService.getUriLabel(context.codemapperUri, { relative: true });
            return localize("interactive.applyInEditorWithURL.label", "Apply to {0}", label);
          }
          return super.getTooltip();
        }
        setActionContext(newContext) {
          super.setActionContext(newContext);
          this.updateTooltip();
        }
      }, action, void 0);
    });
    markAsSingleton(disposable);
  }
};
CodeBlockActionRendering.ID = "chat.codeBlockActionRendering";
CodeBlockActionRendering = __decorateClass([
  __decorateParam(0, IActionViewItemService),
  __decorateParam(1, IInstantiationService),
  __decorateParam(2, ILabelService)
], CodeBlockActionRendering);
function registerChatCodeBlockActions() {
  registerAction2(class CopyCodeBlockAction extends Action2 {
    constructor() {
      super({
        id: "workbench.action.chat.copyCodeBlock",
        title: localize2("interactive.copyCodeBlock.label", "Copy"),
        f1: false,
        category: CHAT_CATEGORY,
        icon: Codicon.copy,
        menu: {
          id: MenuId.ChatCodeBlock,
          group: "navigation",
          order: 30
        }
      });
    }
    run(accessor, ...args) {
      const context = args[0];
      if (!isCodeBlockActionContext(context) || isResponseFiltered(context)) {
        return;
      }
      const clipboardService = accessor.get(IClipboardService);
      clipboardService.writeText(context.code);
      if (isResponseVM(context.element)) {
        const chatService = accessor.get(IChatService);
        chatService.notifyUserAction({
          agentId: context.element.agent?.id,
          command: context.element.slashCommand?.name,
          sessionId: context.element.sessionId,
          requestId: context.element.requestId,
          result: context.element.result,
          action: {
            kind: "copy",
            codeBlockIndex: context.codeBlockIndex,
            copyKind: ChatCopyKind.Toolbar,
            copiedCharacters: context.code.length,
            totalCharacters: context.code.length,
            copiedText: context.code
          }
        });
      }
    }
  });
  CopyAction?.addImplementation(5e4, "chat-codeblock", (accessor) => {
    const editor = accessor.get(ICodeEditorService).getFocusedCodeEditor();
    if (!editor) {
      return false;
    }
    const editorModel = editor.getModel();
    if (!editorModel) {
      return false;
    }
    const context = getContextFromEditor(editor, accessor);
    if (!context) {
      return false;
    }
    const noSelection = editor.getSelections()?.length === 1 && editor.getSelection()?.isEmpty();
    const copiedText = noSelection ? editorModel.getValue() : editor.getSelections()?.reduce((acc, selection) => acc + editorModel.getValueInRange(selection), "") ?? "";
    const totalCharacters = editorModel.getValueLength();
    const chatService = accessor.get(IChatService);
    const element = context.element;
    if (element) {
      chatService.notifyUserAction({
        agentId: element.agent?.id,
        command: element.slashCommand?.name,
        sessionId: element.sessionId,
        requestId: element.requestId,
        result: element.result,
        action: {
          kind: "copy",
          codeBlockIndex: context.codeBlockIndex,
          copyKind: ChatCopyKind.Action,
          copiedText,
          copiedCharacters: copiedText.length,
          totalCharacters
        }
      });
    }
    if (noSelection) {
      accessor.get(IClipboardService).writeText(context.code);
      return true;
    }
    return false;
  });
  registerAction2(class SmartApplyInEditorAction extends ChatCodeBlockAction {
    constructor() {
      super({
        id: APPLY_IN_EDITOR_ID,
        title: localize2("interactive.applyInEditor.label", "Apply in Editor"),
        precondition: ChatContextKeys.enabled,
        f1: true,
        category: CHAT_CATEGORY,
        icon: Codicon.gitPullRequestGoToChanges,
        menu: [
          {
            id: MenuId.ChatCodeBlock,
            group: "navigation",
            when: ContextKeyExpr.and(
              ...shellLangIds.map((e) => ContextKeyExpr.notEquals(EditorContextKeys.languageId.key, e))
            ),
            order: 10
          },
          {
            id: MenuId.ChatCodeBlock,
            when: ContextKeyExpr.or(
              ...shellLangIds.map((e) => ContextKeyExpr.equals(EditorContextKeys.languageId.key, e))
            )
          }
        ],
        keybinding: {
          when: ContextKeyExpr.or(ContextKeyExpr.and(ChatContextKeys.inChatSession, ChatContextKeys.inChatInput.negate()), accessibleViewInCodeBlock),
          primary: KeyMod.CtrlCmd | KeyCode.Enter,
          mac: { primary: KeyMod.WinCtrl | KeyCode.Enter },
          weight: KeybindingWeight.ExternalExtension + 1
        }
      });
    }
    runWithContext(accessor, context) {
      if (!this.operation) {
        this.operation = accessor.get(IInstantiationService).createInstance(ApplyCodeBlockOperation);
      }
      return this.operation.run(context);
    }
  });
  registerAction2(class InsertAtCursorAction extends ChatCodeBlockAction {
    constructor() {
      super({
        id: "workbench.action.chat.insertCodeBlock",
        title: localize2("interactive.insertCodeBlock.label", "Insert At Cursor"),
        precondition: ChatContextKeys.enabled,
        f1: true,
        category: CHAT_CATEGORY,
        icon: Codicon.insert,
        menu: [{
          id: MenuId.ChatCodeBlock,
          group: "navigation",
          when: ContextKeyExpr.and(ChatContextKeys.inChatSession, ChatContextKeys.location.notEqualsTo(ChatAgentLocation.Terminal)),
          order: 20
        }, {
          id: MenuId.ChatCodeBlock,
          group: "navigation",
          when: ContextKeyExpr.and(ChatContextKeys.inChatSession, ChatContextKeys.location.isEqualTo(ChatAgentLocation.Terminal)),
          isHiddenByDefault: true,
          order: 20
        }],
        keybinding: {
          when: ContextKeyExpr.or(ContextKeyExpr.and(ChatContextKeys.inChatSession, ChatContextKeys.inChatInput.negate()), accessibleViewInCodeBlock),
          primary: KeyMod.CtrlCmd | KeyCode.Enter,
          mac: { primary: KeyMod.WinCtrl | KeyCode.Enter },
          weight: KeybindingWeight.ExternalExtension + 1
        }
      });
    }
    runWithContext(accessor, context) {
      const operation = accessor.get(IInstantiationService).createInstance(InsertCodeBlockOperation);
      return operation.run(context);
    }
  });
  registerAction2(class InsertIntoNewFileAction extends ChatCodeBlockAction {
    constructor() {
      super({
        id: "workbench.action.chat.insertIntoNewFile",
        title: localize2("interactive.insertIntoNewFile.label", "Insert into New File"),
        precondition: ChatContextKeys.enabled,
        f1: true,
        category: CHAT_CATEGORY,
        icon: Codicon.newFile,
        menu: {
          id: MenuId.ChatCodeBlock,
          group: "navigation",
          isHiddenByDefault: true,
          order: 40
        }
      });
    }
    async runWithContext(accessor, context) {
      if (isResponseFiltered(context)) {
        return;
      }
      const editorService = accessor.get(IEditorService);
      const chatService = accessor.get(IChatService);
      editorService.openEditor({ contents: context.code, languageId: context.languageId, resource: void 0 });
      if (isResponseVM(context.element)) {
        chatService.notifyUserAction({
          agentId: context.element.agent?.id,
          command: context.element.slashCommand?.name,
          sessionId: context.element.sessionId,
          requestId: context.element.requestId,
          result: context.element.result,
          action: {
            kind: "insert",
            codeBlockIndex: context.codeBlockIndex,
            totalCharacters: context.code.length,
            newFile: true
          }
        });
      }
    }
  });
  registerAction2(class RunInTerminalAction extends ChatCodeBlockAction {
    constructor() {
      super({
        id: "workbench.action.chat.runInTerminal",
        title: localize2("interactive.runInTerminal.label", "Insert into Terminal"),
        precondition: ChatContextKeys.enabled,
        f1: true,
        category: CHAT_CATEGORY,
        icon: Codicon.terminal,
        menu: [
          {
            id: MenuId.ChatCodeBlock,
            group: "navigation",
            when: ContextKeyExpr.and(
              ChatContextKeys.inChatSession,
              ContextKeyExpr.or(...shellLangIds.map((e) => ContextKeyExpr.equals(EditorContextKeys.languageId.key, e)))
            )
          },
          {
            id: MenuId.ChatCodeBlock,
            group: "navigation",
            isHiddenByDefault: true,
            when: ContextKeyExpr.and(
              ChatContextKeys.inChatSession,
              ...shellLangIds.map((e) => ContextKeyExpr.notEquals(EditorContextKeys.languageId.key, e))
            )
          }
        ],
        keybinding: [{
          primary: KeyMod.CtrlCmd | KeyMod.Alt | KeyCode.Enter,
          mac: {
            primary: KeyMod.WinCtrl | KeyMod.Alt | KeyCode.Enter
          },
          weight: KeybindingWeight.EditorContrib,
          when: ContextKeyExpr.or(ChatContextKeys.inChatSession, accessibleViewInCodeBlock)
        }]
      });
    }
    async runWithContext(accessor, context) {
      if (isResponseFiltered(context)) {
        return;
      }
      const chatService = accessor.get(IChatService);
      const terminalService = accessor.get(ITerminalService);
      const editorService = accessor.get(IEditorService);
      const terminalEditorService = accessor.get(ITerminalEditorService);
      const terminalGroupService = accessor.get(ITerminalGroupService);
      let terminal = await terminalService.getActiveOrCreateInstance();
      const unusableTerminal = terminal.xterm?.isStdinDisabled || terminal.shellLaunchConfig.isFeatureTerminal;
      terminal = unusableTerminal ? await terminalService.createTerminal() : terminal;
      terminalService.setActiveInstance(terminal);
      await terminal.focusWhenReady(true);
      if (terminal.target === TerminalLocation.Editor) {
        const existingEditors = editorService.findEditors(terminal.resource);
        terminalEditorService.openEditor(terminal, { viewColumn: existingEditors?.[0].groupId });
      } else {
        terminalGroupService.showPanel(true);
      }
      terminal.runCommand(context.code, false);
      if (isResponseVM(context.element)) {
        chatService.notifyUserAction({
          agentId: context.element.agent?.id,
          command: context.element.slashCommand?.name,
          sessionId: context.element.sessionId,
          requestId: context.element.requestId,
          result: context.element.result,
          action: {
            kind: "runInTerminal",
            codeBlockIndex: context.codeBlockIndex,
            languageId: context.languageId
          }
        });
      }
    }
  });
  function navigateCodeBlocks(accessor, reverse) {
    const codeEditorService = accessor.get(ICodeEditorService);
    const chatWidgetService = accessor.get(IChatWidgetService);
    const widget = chatWidgetService.lastFocusedWidget;
    if (!widget) {
      return;
    }
    const editor = codeEditorService.getFocusedCodeEditor();
    const editorUri = editor?.getModel()?.uri;
    const curCodeBlockInfo = editorUri ? widget.getCodeBlockInfoForEditor(editorUri) : void 0;
    const focused = !widget.inputEditor.hasWidgetFocus() && widget.getFocus();
    const focusedResponse = isResponseVM(focused) ? focused : void 0;
    const elementId = curCodeBlockInfo?.elementId;
    const element = elementId ? widget.viewModel?.getItems().find((item) => item.id === elementId) : void 0;
    const currentResponse = element ?? (focusedResponse ?? widget.viewModel?.getItems().reverse().find((item) => isResponseVM(item)));
    if (!currentResponse || !isResponseVM(currentResponse)) {
      return;
    }
    widget.reveal(currentResponse);
    const responseCodeblocks = widget.getCodeBlockInfosForResponse(currentResponse);
    const focusIdx = curCodeBlockInfo ? (curCodeBlockInfo.codeBlockIndex + (reverse ? -1 : 1) + responseCodeblocks.length) % responseCodeblocks.length : reverse ? responseCodeblocks.length - 1 : 0;
    responseCodeblocks[focusIdx]?.focus();
  }
  registerAction2(class NextCodeBlockAction extends Action2 {
    constructor() {
      super({
        id: "workbench.action.chat.nextCodeBlock",
        title: localize2("interactive.nextCodeBlock.label", "Next Code Block"),
        keybinding: {
          primary: KeyMod.CtrlCmd | KeyMod.Alt | KeyCode.PageDown,
          mac: { primary: KeyMod.CtrlCmd | KeyMod.Alt | KeyCode.PageDown },
          weight: KeybindingWeight.WorkbenchContrib,
          when: ChatContextKeys.inChatSession
        },
        precondition: ChatContextKeys.enabled,
        f1: true,
        category: CHAT_CATEGORY
      });
    }
    run(accessor, ...args) {
      navigateCodeBlocks(accessor);
    }
  });
  registerAction2(class PreviousCodeBlockAction extends Action2 {
    constructor() {
      super({
        id: "workbench.action.chat.previousCodeBlock",
        title: localize2("interactive.previousCodeBlock.label", "Previous Code Block"),
        keybinding: {
          primary: KeyMod.CtrlCmd | KeyMod.Alt | KeyCode.PageUp,
          mac: { primary: KeyMod.CtrlCmd | KeyMod.Alt | KeyCode.PageUp },
          weight: KeybindingWeight.WorkbenchContrib,
          when: ChatContextKeys.inChatSession
        },
        precondition: ChatContextKeys.enabled,
        f1: true,
        category: CHAT_CATEGORY
      });
    }
    run(accessor, ...args) {
      navigateCodeBlocks(accessor, true);
    }
  });
}
function getContextFromEditor(editor, accessor) {
  const chatWidgetService = accessor.get(IChatWidgetService);
  const chatCodeBlockContextProviderService = accessor.get(IChatCodeBlockContextProviderService);
  const model = editor.getModel();
  if (!model) {
    return;
  }
  const widget = chatWidgetService.lastFocusedWidget;
  const codeBlockInfo = widget?.getCodeBlockInfoForEditor(model.uri);
  if (!codeBlockInfo) {
    for (const provider of chatCodeBlockContextProviderService.providers) {
      const context = provider.getCodeBlockContext(editor);
      if (context) {
        return context;
      }
    }
    return;
  }
  const element = widget?.viewModel?.getItems().find((item) => item.id === codeBlockInfo.elementId);
  return {
    element,
    codeBlockIndex: codeBlockInfo.codeBlockIndex,
    code: editor.getValue(),
    languageId: editor.getModel().getLanguageId(),
    codemapperUri: codeBlockInfo.codemapperUri
  };
}
function registerChatCodeCompareBlockActions() {
  class ChatCompareCodeBlockAction extends Action2 {
    run(accessor, ...args) {
      const context = args[0];
      if (!isCodeCompareBlockActionContext(context)) {
        return;
      }
      return this.runWithContext(accessor, context);
    }
  }
  registerAction2(class ApplyEditsCompareBlockAction extends ChatCompareCodeBlockAction {
    constructor() {
      super({
        id: "workbench.action.chat.applyCompareEdits",
        title: localize2("interactive.compare.apply", "Apply Edits"),
        f1: false,
        category: CHAT_CATEGORY,
        icon: Codicon.gitPullRequestGoToChanges,
        precondition: ContextKeyExpr.and(EditorContextKeys.hasChanges, ChatContextKeys.editApplied.negate()),
        menu: {
          id: MenuId.ChatCompareBlock,
          group: "navigation",
          order: 1
        }
      });
    }
    async runWithContext(accessor, context) {
      const instaService = accessor.get(IInstantiationService);
      const editorService = accessor.get(ICodeEditorService);
      const item = context.edit;
      const response = context.element;
      if (item.state?.applied) {
        return false;
      }
      if (!response.response.value.includes(item)) {
        return false;
      }
      const firstEdit = item.edits[0]?.[0];
      if (!firstEdit) {
        return false;
      }
      const textEdits = AsyncIterableObject.fromArray(item.edits);
      const editorToApply = await editorService.openCodeEditor({ resource: item.uri }, null);
      if (editorToApply) {
        editorToApply.revealLineInCenterIfOutsideViewport(firstEdit.range.startLineNumber);
        instaService.invokeFunction(reviewEdits, editorToApply, textEdits, CancellationToken.None);
        response.setEditApplied(item, 1);
        return true;
      }
      return false;
    }
  });
  registerAction2(class DiscardEditsCompareBlockAction extends ChatCompareCodeBlockAction {
    constructor() {
      super({
        id: "workbench.action.chat.discardCompareEdits",
        title: localize2("interactive.compare.discard", "Discard Edits"),
        f1: false,
        category: CHAT_CATEGORY,
        icon: Codicon.trash,
        precondition: ContextKeyExpr.and(EditorContextKeys.hasChanges, ChatContextKeys.editApplied.negate()),
        menu: {
          id: MenuId.ChatCompareBlock,
          group: "navigation",
          order: 2
        }
      });
    }
    async runWithContext(accessor, context) {
      const instaService = accessor.get(IInstantiationService);
      const editor = instaService.createInstance(DefaultChatTextEditor);
      editor.discard(context.element, context.edit);
    }
  });
}
export {
  CodeBlockActionRendering,
  isCodeBlockActionContext,
  isCodeCompareBlockActionContext,
  registerChatCodeBlockActions,
  registerChatCodeCompareBlockActions
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvY29udHJpYi9jaGF0L2Jyb3dzZXIvYWN0aW9ucy9jaGF0Q29kZWJsb2NrQWN0aW9ucy50cyJdLAogICJzb3VyY2VzQ29udGVudCI6IFsiLyotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cbiAqICBDb3B5cmlnaHQgKGMpIE1pY3Jvc29mdCBDb3Jwb3JhdGlvbi4gQWxsIHJpZ2h0cyByZXNlcnZlZC5cbiAqICBMaWNlbnNlZCB1bmRlciB0aGUgTUlUIExpY2Vuc2UuIFNlZSBMaWNlbnNlLnR4dCBpbiB0aGUgcHJvamVjdCByb290IGZvciBsaWNlbnNlIGluZm9ybWF0aW9uLlxuICotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLSovXG5cbmltcG9ydCB7IEFzeW5jSXRlcmFibGVPYmplY3QgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9hc3luYy5qcyc7XG5pbXBvcnQgeyBDYW5jZWxsYXRpb25Ub2tlbiB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2NhbmNlbGxhdGlvbi5qcyc7XG5pbXBvcnQgeyBDb2RpY29uIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vY29kaWNvbnMuanMnO1xuaW1wb3J0IHsgS2V5Q29kZSwgS2V5TW9kIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vYmFzZS9jb21tb24va2V5Q29kZXMuanMnO1xuaW1wb3J0IHsgRGlzcG9zYWJsZSwgbWFya0FzU2luZ2xldG9uIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vbGlmZWN5Y2xlLmpzJztcbmltcG9ydCB7IElDb2RlRWRpdG9yIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vZWRpdG9yL2Jyb3dzZXIvZWRpdG9yQnJvd3Nlci5qcyc7XG5pbXBvcnQgeyBTZXJ2aWNlc0FjY2Vzc29yIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vZWRpdG9yL2Jyb3dzZXIvZWRpdG9yRXh0ZW5zaW9ucy5qcyc7XG5pbXBvcnQgeyBJQ29kZUVkaXRvclNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9lZGl0b3IvYnJvd3Nlci9zZXJ2aWNlcy9jb2RlRWRpdG9yU2VydmljZS5qcyc7XG5pbXBvcnQgeyBFZGl0b3JDb250ZXh0S2V5cyB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL2VkaXRvci9jb21tb24vZWRpdG9yQ29udGV4dEtleXMuanMnO1xuaW1wb3J0IHsgQ29weUFjdGlvbiB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL2VkaXRvci9jb250cmliL2NsaXBib2FyZC9icm93c2VyL2NsaXBib2FyZC5qcyc7XG5pbXBvcnQgeyBsb2NhbGl6ZSwgbG9jYWxpemUyIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vbmxzLmpzJztcbmltcG9ydCB7IElBY3Rpb25WaWV3SXRlbVNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9wbGF0Zm9ybS9hY3Rpb25zL2Jyb3dzZXIvYWN0aW9uVmlld0l0ZW1TZXJ2aWNlLmpzJztcbmltcG9ydCB7IE1lbnVFbnRyeUFjdGlvblZpZXdJdGVtIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vcGxhdGZvcm0vYWN0aW9ucy9icm93c2VyL21lbnVFbnRyeUFjdGlvblZpZXdJdGVtLmpzJztcbmltcG9ydCB7IEFjdGlvbjIsIE1lbnVJZCwgTWVudUl0ZW1BY3Rpb24sIHJlZ2lzdGVyQWN0aW9uMiB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL3BsYXRmb3JtL2FjdGlvbnMvY29tbW9uL2FjdGlvbnMuanMnO1xuaW1wb3J0IHsgSUNsaXBib2FyZFNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9wbGF0Zm9ybS9jbGlwYm9hcmQvY29tbW9uL2NsaXBib2FyZFNlcnZpY2UuanMnO1xuaW1wb3J0IHsgQ29udGV4dEtleUV4cHIgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9wbGF0Zm9ybS9jb250ZXh0a2V5L2NvbW1vbi9jb250ZXh0a2V5LmpzJztcbmltcG9ydCB7IElJbnN0YW50aWF0aW9uU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL3BsYXRmb3JtL2luc3RhbnRpYXRpb24vY29tbW9uL2luc3RhbnRpYXRpb24uanMnO1xuaW1wb3J0IHsgS2V5YmluZGluZ1dlaWdodCB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL3BsYXRmb3JtL2tleWJpbmRpbmcvY29tbW9uL2tleWJpbmRpbmdzUmVnaXN0cnkuanMnO1xuaW1wb3J0IHsgSUxhYmVsU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL3BsYXRmb3JtL2xhYmVsL2NvbW1vbi9sYWJlbC5qcyc7XG5pbXBvcnQgeyBUZXJtaW5hbExvY2F0aW9uIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vcGxhdGZvcm0vdGVybWluYWwvY29tbW9uL3Rlcm1pbmFsLmpzJztcbmltcG9ydCB7IElXb3JrYmVuY2hDb250cmlidXRpb24gfSBmcm9tICcuLi8uLi8uLi8uLi9jb21tb24vY29udHJpYnV0aW9ucy5qcyc7XG5pbXBvcnQgeyBJVW50aXRsZWRUZXh0UmVzb3VyY2VFZGl0b3JJbnB1dCB9IGZyb20gJy4uLy4uLy4uLy4uL2NvbW1vbi9lZGl0b3IuanMnO1xuaW1wb3J0IHsgSUVkaXRvclNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi9zZXJ2aWNlcy9lZGl0b3IvY29tbW9uL2VkaXRvclNlcnZpY2UuanMnO1xuaW1wb3J0IHsgYWNjZXNzaWJsZVZpZXdJbkNvZGVCbG9jayB9IGZyb20gJy4uLy4uLy4uL2FjY2Vzc2liaWxpdHkvYnJvd3Nlci9hY2Nlc3NpYmlsaXR5Q29uZmlndXJhdGlvbi5qcyc7XG5pbXBvcnQgeyByZXZpZXdFZGl0cyB9IGZyb20gJy4uLy4uLy4uL2lubGluZUNoYXQvYnJvd3Nlci9pbmxpbmVDaGF0Q29udHJvbGxlci5qcyc7XG5pbXBvcnQgeyBJVGVybWluYWxFZGl0b3JTZXJ2aWNlLCBJVGVybWluYWxHcm91cFNlcnZpY2UsIElUZXJtaW5hbFNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi90ZXJtaW5hbC9icm93c2VyL3Rlcm1pbmFsLmpzJztcbmltcG9ydCB7IENoYXRDb250ZXh0S2V5cyB9IGZyb20gJy4uLy4uL2NvbW1vbi9jaGF0Q29udGV4dEtleXMuanMnO1xuaW1wb3J0IHsgQ2hhdENvcHlLaW5kLCBJQ2hhdFNlcnZpY2UgfSBmcm9tICcuLi8uLi9jb21tb24vY2hhdFNlcnZpY2UuanMnO1xuaW1wb3J0IHsgSUNoYXRSZXNwb25zZVZpZXdNb2RlbCwgaXNSZXNwb25zZVZNIH0gZnJvbSAnLi4vLi4vY29tbW9uL2NoYXRWaWV3TW9kZWwuanMnO1xuaW1wb3J0IHsgQ2hhdEFnZW50TG9jYXRpb24gfSBmcm9tICcuLi8uLi9jb21tb24vY29uc3RhbnRzLmpzJztcbmltcG9ydCB7IElDaGF0Q29kZUJsb2NrQ29udGV4dFByb3ZpZGVyU2VydmljZSwgSUNoYXRXaWRnZXRTZXJ2aWNlIH0gZnJvbSAnLi4vY2hhdC5qcyc7XG5pbXBvcnQgeyBEZWZhdWx0Q2hhdFRleHRFZGl0b3IsIElDb2RlQmxvY2tBY3Rpb25Db250ZXh0LCBJQ29kZUNvbXBhcmVCbG9ja0FjdGlvbkNvbnRleHQgfSBmcm9tICcuLi9jb2RlQmxvY2tQYXJ0LmpzJztcbmltcG9ydCB7IENIQVRfQ0FURUdPUlkgfSBmcm9tICcuL2NoYXRBY3Rpb25zLmpzJztcbmltcG9ydCB7IEFwcGx5Q29kZUJsb2NrT3BlcmF0aW9uLCBJbnNlcnRDb2RlQmxvY2tPcGVyYXRpb24gfSBmcm9tICcuL2NvZGVCbG9ja09wZXJhdGlvbnMuanMnO1xuXG5jb25zdCBzaGVsbExhbmdJZHMgPSBbXG5cdCdmaXNoJyxcblx0J3BzMScsXG5cdCdwd3NoJyxcblx0J3Bvd2Vyc2hlbGwnLFxuXHQnc2gnLFxuXHQnc2hlbGxzY3JpcHQnLFxuXHQnenNoJ1xuXTtcblxuZXhwb3J0IGludGVyZmFjZSBJQ2hhdENvZGVCbG9ja0FjdGlvbkNvbnRleHQgZXh0ZW5kcyBJQ29kZUJsb2NrQWN0aW9uQ29udGV4dCB7XG5cdGVsZW1lbnQ6IElDaGF0UmVzcG9uc2VWaWV3TW9kZWw7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBpc0NvZGVCbG9ja0FjdGlvbkNvbnRleHQodGhpbmc6IHVua25vd24pOiB0aGluZyBpcyBJQ29kZUJsb2NrQWN0aW9uQ29udGV4dCB7XG5cdHJldHVybiB0eXBlb2YgdGhpbmcgPT09ICdvYmplY3QnICYmIHRoaW5nICE9PSBudWxsICYmICdjb2RlJyBpbiB0aGluZyAmJiAnZWxlbWVudCcgaW4gdGhpbmc7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBpc0NvZGVDb21wYXJlQmxvY2tBY3Rpb25Db250ZXh0KHRoaW5nOiB1bmtub3duKTogdGhpbmcgaXMgSUNvZGVDb21wYXJlQmxvY2tBY3Rpb25Db250ZXh0IHtcblx0cmV0dXJuIHR5cGVvZiB0aGluZyA9PT0gJ29iamVjdCcgJiYgdGhpbmcgIT09IG51bGwgJiYgJ2VsZW1lbnQnIGluIHRoaW5nO1xufVxuXG5mdW5jdGlvbiBpc1Jlc3BvbnNlRmlsdGVyZWQoY29udGV4dDogSUNvZGVCbG9ja0FjdGlvbkNvbnRleHQpIHtcblx0cmV0dXJuIGlzUmVzcG9uc2VWTShjb250ZXh0LmVsZW1lbnQpICYmIGNvbnRleHQuZWxlbWVudC5lcnJvckRldGFpbHM/LnJlc3BvbnNlSXNGaWx0ZXJlZDtcbn1cblxuYWJzdHJhY3QgY2xhc3MgQ2hhdENvZGVCbG9ja0FjdGlvbiBleHRlbmRzIEFjdGlvbjIge1xuXHRydW4oYWNjZXNzb3I6IFNlcnZpY2VzQWNjZXNzb3IsIC4uLmFyZ3M6IGFueVtdKSB7XG5cdFx0bGV0IGNvbnRleHQgPSBhcmdzWzBdO1xuXHRcdGlmICghaXNDb2RlQmxvY2tBY3Rpb25Db250ZXh0KGNvbnRleHQpKSB7XG5cdFx0XHRjb25zdCBjb2RlRWRpdG9yU2VydmljZSA9IGFjY2Vzc29yLmdldChJQ29kZUVkaXRvclNlcnZpY2UpO1xuXHRcdFx0Y29uc3QgZWRpdG9yID0gY29kZUVkaXRvclNlcnZpY2UuZ2V0Rm9jdXNlZENvZGVFZGl0b3IoKSB8fCBjb2RlRWRpdG9yU2VydmljZS5nZXRBY3RpdmVDb2RlRWRpdG9yKCk7XG5cdFx0XHRpZiAoIWVkaXRvcikge1xuXHRcdFx0XHRyZXR1cm47XG5cdFx0XHR9XG5cblx0XHRcdGNvbnRleHQgPSBnZXRDb250ZXh0RnJvbUVkaXRvcihlZGl0b3IsIGFjY2Vzc29yKTtcblx0XHRcdGlmICghaXNDb2RlQmxvY2tBY3Rpb25Db250ZXh0KGNvbnRleHQpKSB7XG5cdFx0XHRcdHJldHVybjtcblx0XHRcdH1cblx0XHR9XG5cblx0XHRyZXR1cm4gdGhpcy5ydW5XaXRoQ29udGV4dChhY2Nlc3NvciwgY29udGV4dCk7XG5cdH1cblxuXHRhYnN0cmFjdCBydW5XaXRoQ29udGV4dChhY2Nlc3NvcjogU2VydmljZXNBY2Nlc3NvciwgY29udGV4dDogSUNvZGVCbG9ja0FjdGlvbkNvbnRleHQpOiBhbnk7XG59XG5cbmNvbnN0IEFQUExZX0lOX0VESVRPUl9JRCA9ICd3b3JrYmVuY2guYWN0aW9uLmNoYXQuYXBwbHlJbkVkaXRvcic7XG5cbmV4cG9ydCBjbGFzcyBDb2RlQmxvY2tBY3Rpb25SZW5kZXJpbmcgZXh0ZW5kcyBEaXNwb3NhYmxlIGltcGxlbWVudHMgSVdvcmtiZW5jaENvbnRyaWJ1dGlvbiB7XG5cblx0c3RhdGljIHJlYWRvbmx5IElEID0gJ2NoYXQuY29kZUJsb2NrQWN0aW9uUmVuZGVyaW5nJztcblxuXHRjb25zdHJ1Y3Rvcihcblx0XHRASUFjdGlvblZpZXdJdGVtU2VydmljZSBhY3Rpb25WaWV3SXRlbVNlcnZpY2U6IElBY3Rpb25WaWV3SXRlbVNlcnZpY2UsXG5cdFx0QElJbnN0YW50aWF0aW9uU2VydmljZSBpbnN0YW50aWF0aW9uU2VydmljZTogSUluc3RhbnRpYXRpb25TZXJ2aWNlLFxuXHRcdEBJTGFiZWxTZXJ2aWNlIGxhYmVsU2VydmljZTogSUxhYmVsU2VydmljZSxcblx0KSB7XG5cdFx0c3VwZXIoKTtcblxuXHRcdGNvbnN0IGRpc3Bvc2FibGUgPSBhY3Rpb25WaWV3SXRlbVNlcnZpY2UucmVnaXN0ZXIoTWVudUlkLkNoYXRDb2RlQmxvY2ssIEFQUExZX0lOX0VESVRPUl9JRCwgKGFjdGlvbiwgb3B0aW9ucykgPT4ge1xuXHRcdFx0aWYgKCEoYWN0aW9uIGluc3RhbmNlb2YgTWVudUl0ZW1BY3Rpb24pKSB7XG5cdFx0XHRcdHJldHVybiB1bmRlZmluZWQ7XG5cdFx0XHR9XG5cdFx0XHRyZXR1cm4gaW5zdGFudGlhdGlvblNlcnZpY2UuY3JlYXRlSW5zdGFuY2UoY2xhc3MgZXh0ZW5kcyBNZW51RW50cnlBY3Rpb25WaWV3SXRlbSB7XG5cdFx0XHRcdHByb3RlY3RlZCBvdmVycmlkZSBnZXRUb29sdGlwKCk6IHN0cmluZyB7XG5cdFx0XHRcdFx0Y29uc3QgY29udGV4dCA9IHRoaXMuX2NvbnRleHQ7XG5cdFx0XHRcdFx0aWYgKGlzQ29kZUJsb2NrQWN0aW9uQ29udGV4dChjb250ZXh0KSAmJiBjb250ZXh0LmNvZGVtYXBwZXJVcmkpIHtcblx0XHRcdFx0XHRcdGNvbnN0IGxhYmVsID0gbGFiZWxTZXJ2aWNlLmdldFVyaUxhYmVsKGNvbnRleHQuY29kZW1hcHBlclVyaSwgeyByZWxhdGl2ZTogdHJ1ZSB9KTtcblx0XHRcdFx0XHRcdHJldHVybiBsb2NhbGl6ZSgnaW50ZXJhY3RpdmUuYXBwbHlJbkVkaXRvcldpdGhVUkwubGFiZWwnLCBcIkFwcGx5IHRvIHswfVwiLCBsYWJlbCk7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHRcdHJldHVybiBzdXBlci5nZXRUb29sdGlwKCk7XG5cdFx0XHRcdH1cblx0XHRcdFx0b3ZlcnJpZGUgc2V0QWN0aW9uQ29udGV4dChuZXdDb250ZXh0OiB1bmtub3duKTogdm9pZCB7XG5cdFx0XHRcdFx0c3VwZXIuc2V0QWN0aW9uQ29udGV4dChuZXdDb250ZXh0KTtcblx0XHRcdFx0XHR0aGlzLnVwZGF0ZVRvb2x0aXAoKTtcblx0XHRcdFx0fVxuXHRcdFx0fSwgYWN0aW9uLCB1bmRlZmluZWQpO1xuXHRcdH0pO1xuXG5cdFx0Ly8gUmVkdWNlcyBmbGlja2VyIGEgYml0IG9uIHJlbG9hZC9yZXN0YXJ0XG5cdFx0bWFya0FzU2luZ2xldG9uKGRpc3Bvc2FibGUpO1xuXHR9XG59XG5cbmV4cG9ydCBmdW5jdGlvbiByZWdpc3RlckNoYXRDb2RlQmxvY2tBY3Rpb25zKCkge1xuXHRyZWdpc3RlckFjdGlvbjIoY2xhc3MgQ29weUNvZGVCbG9ja0FjdGlvbiBleHRlbmRzIEFjdGlvbjIge1xuXHRcdGNvbnN0cnVjdG9yKCkge1xuXHRcdFx0c3VwZXIoe1xuXHRcdFx0XHRpZDogJ3dvcmtiZW5jaC5hY3Rpb24uY2hhdC5jb3B5Q29kZUJsb2NrJyxcblx0XHRcdFx0dGl0bGU6IGxvY2FsaXplMignaW50ZXJhY3RpdmUuY29weUNvZGVCbG9jay5sYWJlbCcsIFwiQ29weVwiKSxcblx0XHRcdFx0ZjE6IGZhbHNlLFxuXHRcdFx0XHRjYXRlZ29yeTogQ0hBVF9DQVRFR09SWSxcblx0XHRcdFx0aWNvbjogQ29kaWNvbi5jb3B5LFxuXHRcdFx0XHRtZW51OiB7XG5cdFx0XHRcdFx0aWQ6IE1lbnVJZC5DaGF0Q29kZUJsb2NrLFxuXHRcdFx0XHRcdGdyb3VwOiAnbmF2aWdhdGlvbicsXG5cdFx0XHRcdFx0b3JkZXI6IDMwXG5cdFx0XHRcdH1cblx0XHRcdH0pO1xuXHRcdH1cblxuXHRcdHJ1bihhY2Nlc3NvcjogU2VydmljZXNBY2Nlc3NvciwgLi4uYXJnczogYW55W10pIHtcblx0XHRcdGNvbnN0IGNvbnRleHQgPSBhcmdzWzBdO1xuXHRcdFx0aWYgKCFpc0NvZGVCbG9ja0FjdGlvbkNvbnRleHQoY29udGV4dCkgfHwgaXNSZXNwb25zZUZpbHRlcmVkKGNvbnRleHQpKSB7XG5cdFx0XHRcdHJldHVybjtcblx0XHRcdH1cblxuXHRcdFx0Y29uc3QgY2xpcGJvYXJkU2VydmljZSA9IGFjY2Vzc29yLmdldChJQ2xpcGJvYXJkU2VydmljZSk7XG5cdFx0XHRjbGlwYm9hcmRTZXJ2aWNlLndyaXRlVGV4dChjb250ZXh0LmNvZGUpO1xuXG5cdFx0XHRpZiAoaXNSZXNwb25zZVZNKGNvbnRleHQuZWxlbWVudCkpIHtcblx0XHRcdFx0Y29uc3QgY2hhdFNlcnZpY2UgPSBhY2Nlc3Nvci5nZXQoSUNoYXRTZXJ2aWNlKTtcblx0XHRcdFx0Y2hhdFNlcnZpY2Uubm90aWZ5VXNlckFjdGlvbih7XG5cdFx0XHRcdFx0YWdlbnRJZDogY29udGV4dC5lbGVtZW50LmFnZW50Py5pZCxcblx0XHRcdFx0XHRjb21tYW5kOiBjb250ZXh0LmVsZW1lbnQuc2xhc2hDb21tYW5kPy5uYW1lLFxuXHRcdFx0XHRcdHNlc3Npb25JZDogY29udGV4dC5lbGVtZW50LnNlc3Npb25JZCxcblx0XHRcdFx0XHRyZXF1ZXN0SWQ6IGNvbnRleHQuZWxlbWVudC5yZXF1ZXN0SWQsXG5cdFx0XHRcdFx0cmVzdWx0OiBjb250ZXh0LmVsZW1lbnQucmVzdWx0LFxuXHRcdFx0XHRcdGFjdGlvbjoge1xuXHRcdFx0XHRcdFx0a2luZDogJ2NvcHknLFxuXHRcdFx0XHRcdFx0Y29kZUJsb2NrSW5kZXg6IGNvbnRleHQuY29kZUJsb2NrSW5kZXgsXG5cdFx0XHRcdFx0XHRjb3B5S2luZDogQ2hhdENvcHlLaW5kLlRvb2xiYXIsXG5cdFx0XHRcdFx0XHRjb3BpZWRDaGFyYWN0ZXJzOiBjb250ZXh0LmNvZGUubGVuZ3RoLFxuXHRcdFx0XHRcdFx0dG90YWxDaGFyYWN0ZXJzOiBjb250ZXh0LmNvZGUubGVuZ3RoLFxuXHRcdFx0XHRcdFx0Y29waWVkVGV4dDogY29udGV4dC5jb2RlLFxuXHRcdFx0XHRcdH1cblx0XHRcdFx0fSk7XG5cdFx0XHR9XG5cdFx0fVxuXHR9KTtcblxuXHRDb3B5QWN0aW9uPy5hZGRJbXBsZW1lbnRhdGlvbig1MDAwMCwgJ2NoYXQtY29kZWJsb2NrJywgKGFjY2Vzc29yKSA9PiB7XG5cdFx0Ly8gZ2V0IGFjdGl2ZSBjb2RlIGVkaXRvclxuXHRcdGNvbnN0IGVkaXRvciA9IGFjY2Vzc29yLmdldChJQ29kZUVkaXRvclNlcnZpY2UpLmdldEZvY3VzZWRDb2RlRWRpdG9yKCk7XG5cdFx0aWYgKCFlZGl0b3IpIHtcblx0XHRcdHJldHVybiBmYWxzZTtcblx0XHR9XG5cblx0XHRjb25zdCBlZGl0b3JNb2RlbCA9IGVkaXRvci5nZXRNb2RlbCgpO1xuXHRcdGlmICghZWRpdG9yTW9kZWwpIHtcblx0XHRcdHJldHVybiBmYWxzZTtcblx0XHR9XG5cblx0XHRjb25zdCBjb250ZXh0ID0gZ2V0Q29udGV4dEZyb21FZGl0b3IoZWRpdG9yLCBhY2Nlc3Nvcik7XG5cdFx0aWYgKCFjb250ZXh0KSB7XG5cdFx0XHRyZXR1cm4gZmFsc2U7XG5cdFx0fVxuXG5cdFx0Y29uc3Qgbm9TZWxlY3Rpb24gPSBlZGl0b3IuZ2V0U2VsZWN0aW9ucygpPy5sZW5ndGggPT09IDEgJiYgZWRpdG9yLmdldFNlbGVjdGlvbigpPy5pc0VtcHR5KCk7XG5cdFx0Y29uc3QgY29waWVkVGV4dCA9IG5vU2VsZWN0aW9uID9cblx0XHRcdGVkaXRvck1vZGVsLmdldFZhbHVlKCkgOlxuXHRcdFx0ZWRpdG9yLmdldFNlbGVjdGlvbnMoKT8ucmVkdWNlKChhY2MsIHNlbGVjdGlvbikgPT4gYWNjICsgZWRpdG9yTW9kZWwuZ2V0VmFsdWVJblJhbmdlKHNlbGVjdGlvbiksICcnKSA/PyAnJztcblx0XHRjb25zdCB0b3RhbENoYXJhY3RlcnMgPSBlZGl0b3JNb2RlbC5nZXRWYWx1ZUxlbmd0aCgpO1xuXG5cdFx0Ly8gUmVwb3J0IGNvcHkgdG8gZXh0ZW5zaW9uc1xuXHRcdGNvbnN0IGNoYXRTZXJ2aWNlID0gYWNjZXNzb3IuZ2V0KElDaGF0U2VydmljZSk7XG5cdFx0Y29uc3QgZWxlbWVudCA9IGNvbnRleHQuZWxlbWVudCBhcyBJQ2hhdFJlc3BvbnNlVmlld01vZGVsIHwgdW5kZWZpbmVkO1xuXHRcdGlmIChlbGVtZW50KSB7XG5cdFx0XHRjaGF0U2VydmljZS5ub3RpZnlVc2VyQWN0aW9uKHtcblx0XHRcdFx0YWdlbnRJZDogZWxlbWVudC5hZ2VudD8uaWQsXG5cdFx0XHRcdGNvbW1hbmQ6IGVsZW1lbnQuc2xhc2hDb21tYW5kPy5uYW1lLFxuXHRcdFx0XHRzZXNzaW9uSWQ6IGVsZW1lbnQuc2Vzc2lvbklkLFxuXHRcdFx0XHRyZXF1ZXN0SWQ6IGVsZW1lbnQucmVxdWVzdElkLFxuXHRcdFx0XHRyZXN1bHQ6IGVsZW1lbnQucmVzdWx0LFxuXHRcdFx0XHRhY3Rpb246IHtcblx0XHRcdFx0XHRraW5kOiAnY29weScsXG5cdFx0XHRcdFx0Y29kZUJsb2NrSW5kZXg6IGNvbnRleHQuY29kZUJsb2NrSW5kZXgsXG5cdFx0XHRcdFx0Y29weUtpbmQ6IENoYXRDb3B5S2luZC5BY3Rpb24sXG5cdFx0XHRcdFx0Y29waWVkVGV4dCxcblx0XHRcdFx0XHRjb3BpZWRDaGFyYWN0ZXJzOiBjb3BpZWRUZXh0Lmxlbmd0aCxcblx0XHRcdFx0XHR0b3RhbENoYXJhY3RlcnMsXG5cdFx0XHRcdH1cblx0XHRcdH0pO1xuXHRcdH1cblxuXHRcdC8vIENvcHkgZnVsbCBjZWxsIGlmIG5vIHNlbGVjdGlvbiwgb3RoZXJ3aXNlIGZhbGwgYmFjayBvbiBub3JtYWwgZWRpdG9yIGltcGxlbWVudGF0aW9uXG5cdFx0aWYgKG5vU2VsZWN0aW9uKSB7XG5cdFx0XHRhY2Nlc3Nvci5nZXQoSUNsaXBib2FyZFNlcnZpY2UpLndyaXRlVGV4dChjb250ZXh0LmNvZGUpO1xuXHRcdFx0cmV0dXJuIHRydWU7XG5cdFx0fVxuXG5cdFx0cmV0dXJuIGZhbHNlO1xuXHR9KTtcblxuXHRyZWdpc3RlckFjdGlvbjIoY2xhc3MgU21hcnRBcHBseUluRWRpdG9yQWN0aW9uIGV4dGVuZHMgQ2hhdENvZGVCbG9ja0FjdGlvbiB7XG5cblx0XHRwcml2YXRlIG9wZXJhdGlvbjogQXBwbHlDb2RlQmxvY2tPcGVyYXRpb24gfCB1bmRlZmluZWQ7XG5cblx0XHRjb25zdHJ1Y3RvcigpIHtcblx0XHRcdHN1cGVyKHtcblx0XHRcdFx0aWQ6IEFQUExZX0lOX0VESVRPUl9JRCxcblx0XHRcdFx0dGl0bGU6IGxvY2FsaXplMignaW50ZXJhY3RpdmUuYXBwbHlJbkVkaXRvci5sYWJlbCcsIFwiQXBwbHkgaW4gRWRpdG9yXCIpLFxuXHRcdFx0XHRwcmVjb25kaXRpb246IENoYXRDb250ZXh0S2V5cy5lbmFibGVkLFxuXHRcdFx0XHRmMTogdHJ1ZSxcblx0XHRcdFx0Y2F0ZWdvcnk6IENIQVRfQ0FURUdPUlksXG5cdFx0XHRcdGljb246IENvZGljb24uZ2l0UHVsbFJlcXVlc3RHb1RvQ2hhbmdlcyxcblxuXHRcdFx0XHRtZW51OiBbXG5cdFx0XHRcdFx0e1xuXHRcdFx0XHRcdFx0aWQ6IE1lbnVJZC5DaGF0Q29kZUJsb2NrLFxuXHRcdFx0XHRcdFx0Z3JvdXA6ICduYXZpZ2F0aW9uJyxcblx0XHRcdFx0XHRcdHdoZW46IENvbnRleHRLZXlFeHByLmFuZChcblx0XHRcdFx0XHRcdFx0Li4uc2hlbGxMYW5nSWRzLm1hcChlID0+IENvbnRleHRLZXlFeHByLm5vdEVxdWFscyhFZGl0b3JDb250ZXh0S2V5cy5sYW5ndWFnZUlkLmtleSwgZSkpXG5cdFx0XHRcdFx0XHQpLFxuXHRcdFx0XHRcdFx0b3JkZXI6IDEwXG5cdFx0XHRcdFx0fSxcblx0XHRcdFx0XHR7XG5cdFx0XHRcdFx0XHRpZDogTWVudUlkLkNoYXRDb2RlQmxvY2ssXG5cdFx0XHRcdFx0XHR3aGVuOiBDb250ZXh0S2V5RXhwci5vcihcblx0XHRcdFx0XHRcdFx0Li4uc2hlbGxMYW5nSWRzLm1hcChlID0+IENvbnRleHRLZXlFeHByLmVxdWFscyhFZGl0b3JDb250ZXh0S2V5cy5sYW5ndWFnZUlkLmtleSwgZSkpXG5cdFx0XHRcdFx0XHQpXG5cdFx0XHRcdFx0fSxcblx0XHRcdFx0XSxcblx0XHRcdFx0a2V5YmluZGluZzoge1xuXHRcdFx0XHRcdHdoZW46IENvbnRleHRLZXlFeHByLm9yKENvbnRleHRLZXlFeHByLmFuZChDaGF0Q29udGV4dEtleXMuaW5DaGF0U2Vzc2lvbiwgQ2hhdENvbnRleHRLZXlzLmluQ2hhdElucHV0Lm5lZ2F0ZSgpKSwgYWNjZXNzaWJsZVZpZXdJbkNvZGVCbG9jayksXG5cdFx0XHRcdFx0cHJpbWFyeTogS2V5TW9kLkN0cmxDbWQgfCBLZXlDb2RlLkVudGVyLFxuXHRcdFx0XHRcdG1hYzogeyBwcmltYXJ5OiBLZXlNb2QuV2luQ3RybCB8IEtleUNvZGUuRW50ZXIgfSxcblx0XHRcdFx0XHR3ZWlnaHQ6IEtleWJpbmRpbmdXZWlnaHQuRXh0ZXJuYWxFeHRlbnNpb24gKyAxXG5cdFx0XHRcdH0sXG5cdFx0XHR9KTtcblx0XHR9XG5cblx0XHRvdmVycmlkZSBydW5XaXRoQ29udGV4dChhY2Nlc3NvcjogU2VydmljZXNBY2Nlc3NvciwgY29udGV4dDogSUNvZGVCbG9ja0FjdGlvbkNvbnRleHQpIHtcblx0XHRcdGlmICghdGhpcy5vcGVyYXRpb24pIHtcblx0XHRcdFx0dGhpcy5vcGVyYXRpb24gPSBhY2Nlc3Nvci5nZXQoSUluc3RhbnRpYXRpb25TZXJ2aWNlKS5jcmVhdGVJbnN0YW5jZShBcHBseUNvZGVCbG9ja09wZXJhdGlvbik7XG5cdFx0XHR9XG5cdFx0XHRyZXR1cm4gdGhpcy5vcGVyYXRpb24ucnVuKGNvbnRleHQpO1xuXHRcdH1cblx0fSk7XG5cblx0cmVnaXN0ZXJBY3Rpb24yKGNsYXNzIEluc2VydEF0Q3Vyc29yQWN0aW9uIGV4dGVuZHMgQ2hhdENvZGVCbG9ja0FjdGlvbiB7XG5cdFx0Y29uc3RydWN0b3IoKSB7XG5cdFx0XHRzdXBlcih7XG5cdFx0XHRcdGlkOiAnd29ya2JlbmNoLmFjdGlvbi5jaGF0Lmluc2VydENvZGVCbG9jaycsXG5cdFx0XHRcdHRpdGxlOiBsb2NhbGl6ZTIoJ2ludGVyYWN0aXZlLmluc2VydENvZGVCbG9jay5sYWJlbCcsIFwiSW5zZXJ0IEF0IEN1cnNvclwiKSxcblx0XHRcdFx0cHJlY29uZGl0aW9uOiBDaGF0Q29udGV4dEtleXMuZW5hYmxlZCxcblx0XHRcdFx0ZjE6IHRydWUsXG5cdFx0XHRcdGNhdGVnb3J5OiBDSEFUX0NBVEVHT1JZLFxuXHRcdFx0XHRpY29uOiBDb2RpY29uLmluc2VydCxcblx0XHRcdFx0bWVudTogW3tcblx0XHRcdFx0XHRpZDogTWVudUlkLkNoYXRDb2RlQmxvY2ssXG5cdFx0XHRcdFx0Z3JvdXA6ICduYXZpZ2F0aW9uJyxcblx0XHRcdFx0XHR3aGVuOiBDb250ZXh0S2V5RXhwci5hbmQoQ2hhdENvbnRleHRLZXlzLmluQ2hhdFNlc3Npb24sIENoYXRDb250ZXh0S2V5cy5sb2NhdGlvbi5ub3RFcXVhbHNUbyhDaGF0QWdlbnRMb2NhdGlvbi5UZXJtaW5hbCkpLFxuXHRcdFx0XHRcdG9yZGVyOiAyMFxuXHRcdFx0XHR9LCB7XG5cdFx0XHRcdFx0aWQ6IE1lbnVJZC5DaGF0Q29kZUJsb2NrLFxuXHRcdFx0XHRcdGdyb3VwOiAnbmF2aWdhdGlvbicsXG5cdFx0XHRcdFx0d2hlbjogQ29udGV4dEtleUV4cHIuYW5kKENoYXRDb250ZXh0S2V5cy5pbkNoYXRTZXNzaW9uLCBDaGF0Q29udGV4dEtleXMubG9jYXRpb24uaXNFcXVhbFRvKENoYXRBZ2VudExvY2F0aW9uLlRlcm1pbmFsKSksXG5cdFx0XHRcdFx0aXNIaWRkZW5CeURlZmF1bHQ6IHRydWUsXG5cdFx0XHRcdFx0b3JkZXI6IDIwXG5cdFx0XHRcdH1dLFxuXHRcdFx0XHRrZXliaW5kaW5nOiB7XG5cdFx0XHRcdFx0d2hlbjogQ29udGV4dEtleUV4cHIub3IoQ29udGV4dEtleUV4cHIuYW5kKENoYXRDb250ZXh0S2V5cy5pbkNoYXRTZXNzaW9uLCBDaGF0Q29udGV4dEtleXMuaW5DaGF0SW5wdXQubmVnYXRlKCkpLCBhY2Nlc3NpYmxlVmlld0luQ29kZUJsb2NrKSxcblx0XHRcdFx0XHRwcmltYXJ5OiBLZXlNb2QuQ3RybENtZCB8IEtleUNvZGUuRW50ZXIsXG5cdFx0XHRcdFx0bWFjOiB7IHByaW1hcnk6IEtleU1vZC5XaW5DdHJsIHwgS2V5Q29kZS5FbnRlciB9LFxuXHRcdFx0XHRcdHdlaWdodDogS2V5YmluZGluZ1dlaWdodC5FeHRlcm5hbEV4dGVuc2lvbiArIDFcblx0XHRcdFx0fSxcblx0XHRcdH0pO1xuXHRcdH1cblxuXHRcdG92ZXJyaWRlIHJ1bldpdGhDb250ZXh0KGFjY2Vzc29yOiBTZXJ2aWNlc0FjY2Vzc29yLCBjb250ZXh0OiBJQ29kZUJsb2NrQWN0aW9uQ29udGV4dCkge1xuXHRcdFx0Y29uc3Qgb3BlcmF0aW9uID0gYWNjZXNzb3IuZ2V0KElJbnN0YW50aWF0aW9uU2VydmljZSkuY3JlYXRlSW5zdGFuY2UoSW5zZXJ0Q29kZUJsb2NrT3BlcmF0aW9uKTtcblx0XHRcdHJldHVybiBvcGVyYXRpb24ucnVuKGNvbnRleHQpO1xuXHRcdH1cblx0fSk7XG5cblx0cmVnaXN0ZXJBY3Rpb24yKGNsYXNzIEluc2VydEludG9OZXdGaWxlQWN0aW9uIGV4dGVuZHMgQ2hhdENvZGVCbG9ja0FjdGlvbiB7XG5cdFx0Y29uc3RydWN0b3IoKSB7XG5cdFx0XHRzdXBlcih7XG5cdFx0XHRcdGlkOiAnd29ya2JlbmNoLmFjdGlvbi5jaGF0Lmluc2VydEludG9OZXdGaWxlJyxcblx0XHRcdFx0dGl0bGU6IGxvY2FsaXplMignaW50ZXJhY3RpdmUuaW5zZXJ0SW50b05ld0ZpbGUubGFiZWwnLCBcIkluc2VydCBpbnRvIE5ldyBGaWxlXCIpLFxuXHRcdFx0XHRwcmVjb25kaXRpb246IENoYXRDb250ZXh0S2V5cy5lbmFibGVkLFxuXHRcdFx0XHRmMTogdHJ1ZSxcblx0XHRcdFx0Y2F0ZWdvcnk6IENIQVRfQ0FURUdPUlksXG5cdFx0XHRcdGljb246IENvZGljb24ubmV3RmlsZSxcblx0XHRcdFx0bWVudToge1xuXHRcdFx0XHRcdGlkOiBNZW51SWQuQ2hhdENvZGVCbG9jayxcblx0XHRcdFx0XHRncm91cDogJ25hdmlnYXRpb24nLFxuXHRcdFx0XHRcdGlzSGlkZGVuQnlEZWZhdWx0OiB0cnVlLFxuXHRcdFx0XHRcdG9yZGVyOiA0MCxcblx0XHRcdFx0fVxuXHRcdFx0fSk7XG5cdFx0fVxuXG5cdFx0b3ZlcnJpZGUgYXN5bmMgcnVuV2l0aENvbnRleHQoYWNjZXNzb3I6IFNlcnZpY2VzQWNjZXNzb3IsIGNvbnRleHQ6IElDb2RlQmxvY2tBY3Rpb25Db250ZXh0KSB7XG5cdFx0XHRpZiAoaXNSZXNwb25zZUZpbHRlcmVkKGNvbnRleHQpKSB7XG5cdFx0XHRcdC8vIFdoZW4gcnVuIGZyb20gY29tbWFuZCBwYWxldHRlXG5cdFx0XHRcdHJldHVybjtcblx0XHRcdH1cblxuXHRcdFx0Y29uc3QgZWRpdG9yU2VydmljZSA9IGFjY2Vzc29yLmdldChJRWRpdG9yU2VydmljZSk7XG5cdFx0XHRjb25zdCBjaGF0U2VydmljZSA9IGFjY2Vzc29yLmdldChJQ2hhdFNlcnZpY2UpO1xuXG5cdFx0XHRlZGl0b3JTZXJ2aWNlLm9wZW5FZGl0b3IoeyBjb250ZW50czogY29udGV4dC5jb2RlLCBsYW5ndWFnZUlkOiBjb250ZXh0Lmxhbmd1YWdlSWQsIHJlc291cmNlOiB1bmRlZmluZWQgfSBzYXRpc2ZpZXMgSVVudGl0bGVkVGV4dFJlc291cmNlRWRpdG9ySW5wdXQpO1xuXG5cdFx0XHRpZiAoaXNSZXNwb25zZVZNKGNvbnRleHQuZWxlbWVudCkpIHtcblx0XHRcdFx0Y2hhdFNlcnZpY2Uubm90aWZ5VXNlckFjdGlvbih7XG5cdFx0XHRcdFx0YWdlbnRJZDogY29udGV4dC5lbGVtZW50LmFnZW50Py5pZCxcblx0XHRcdFx0XHRjb21tYW5kOiBjb250ZXh0LmVsZW1lbnQuc2xhc2hDb21tYW5kPy5uYW1lLFxuXHRcdFx0XHRcdHNlc3Npb25JZDogY29udGV4dC5lbGVtZW50LnNlc3Npb25JZCxcblx0XHRcdFx0XHRyZXF1ZXN0SWQ6IGNvbnRleHQuZWxlbWVudC5yZXF1ZXN0SWQsXG5cdFx0XHRcdFx0cmVzdWx0OiBjb250ZXh0LmVsZW1lbnQucmVzdWx0LFxuXHRcdFx0XHRcdGFjdGlvbjoge1xuXHRcdFx0XHRcdFx0a2luZDogJ2luc2VydCcsXG5cdFx0XHRcdFx0XHRjb2RlQmxvY2tJbmRleDogY29udGV4dC5jb2RlQmxvY2tJbmRleCxcblx0XHRcdFx0XHRcdHRvdGFsQ2hhcmFjdGVyczogY29udGV4dC5jb2RlLmxlbmd0aCxcblx0XHRcdFx0XHRcdG5ld0ZpbGU6IHRydWVcblx0XHRcdFx0XHR9XG5cdFx0XHRcdH0pO1xuXHRcdFx0fVxuXHRcdH1cblx0fSk7XG5cblx0cmVnaXN0ZXJBY3Rpb24yKGNsYXNzIFJ1bkluVGVybWluYWxBY3Rpb24gZXh0ZW5kcyBDaGF0Q29kZUJsb2NrQWN0aW9uIHtcblx0XHRjb25zdHJ1Y3RvcigpIHtcblx0XHRcdHN1cGVyKHtcblx0XHRcdFx0aWQ6ICd3b3JrYmVuY2guYWN0aW9uLmNoYXQucnVuSW5UZXJtaW5hbCcsXG5cdFx0XHRcdHRpdGxlOiBsb2NhbGl6ZTIoJ2ludGVyYWN0aXZlLnJ1bkluVGVybWluYWwubGFiZWwnLCBcIkluc2VydCBpbnRvIFRlcm1pbmFsXCIpLFxuXHRcdFx0XHRwcmVjb25kaXRpb246IENoYXRDb250ZXh0S2V5cy5lbmFibGVkLFxuXHRcdFx0XHRmMTogdHJ1ZSxcblx0XHRcdFx0Y2F0ZWdvcnk6IENIQVRfQ0FURUdPUlksXG5cdFx0XHRcdGljb246IENvZGljb24udGVybWluYWwsXG5cdFx0XHRcdG1lbnU6IFt7XG5cdFx0XHRcdFx0aWQ6IE1lbnVJZC5DaGF0Q29kZUJsb2NrLFxuXHRcdFx0XHRcdGdyb3VwOiAnbmF2aWdhdGlvbicsXG5cdFx0XHRcdFx0d2hlbjogQ29udGV4dEtleUV4cHIuYW5kKFxuXHRcdFx0XHRcdFx0Q2hhdENvbnRleHRLZXlzLmluQ2hhdFNlc3Npb24sXG5cdFx0XHRcdFx0XHRDb250ZXh0S2V5RXhwci5vciguLi5zaGVsbExhbmdJZHMubWFwKGUgPT4gQ29udGV4dEtleUV4cHIuZXF1YWxzKEVkaXRvckNvbnRleHRLZXlzLmxhbmd1YWdlSWQua2V5LCBlKSkpXG5cdFx0XHRcdFx0KSxcblx0XHRcdFx0fSxcblx0XHRcdFx0e1xuXHRcdFx0XHRcdGlkOiBNZW51SWQuQ2hhdENvZGVCbG9jayxcblx0XHRcdFx0XHRncm91cDogJ25hdmlnYXRpb24nLFxuXHRcdFx0XHRcdGlzSGlkZGVuQnlEZWZhdWx0OiB0cnVlLFxuXHRcdFx0XHRcdHdoZW46IENvbnRleHRLZXlFeHByLmFuZChcblx0XHRcdFx0XHRcdENoYXRDb250ZXh0S2V5cy5pbkNoYXRTZXNzaW9uLFxuXHRcdFx0XHRcdFx0Li4uc2hlbGxMYW5nSWRzLm1hcChlID0+IENvbnRleHRLZXlFeHByLm5vdEVxdWFscyhFZGl0b3JDb250ZXh0S2V5cy5sYW5ndWFnZUlkLmtleSwgZSkpXG5cdFx0XHRcdFx0KVxuXHRcdFx0XHR9XSxcblx0XHRcdFx0a2V5YmluZGluZzogW3tcblx0XHRcdFx0XHRwcmltYXJ5OiBLZXlNb2QuQ3RybENtZCB8IEtleU1vZC5BbHQgfCBLZXlDb2RlLkVudGVyLFxuXHRcdFx0XHRcdG1hYzoge1xuXHRcdFx0XHRcdFx0cHJpbWFyeTogS2V5TW9kLldpbkN0cmwgfCBLZXlNb2QuQWx0IHwgS2V5Q29kZS5FbnRlclxuXHRcdFx0XHRcdH0sXG5cdFx0XHRcdFx0d2VpZ2h0OiBLZXliaW5kaW5nV2VpZ2h0LkVkaXRvckNvbnRyaWIsXG5cdFx0XHRcdFx0d2hlbjogQ29udGV4dEtleUV4cHIub3IoQ2hhdENvbnRleHRLZXlzLmluQ2hhdFNlc3Npb24sIGFjY2Vzc2libGVWaWV3SW5Db2RlQmxvY2spLFxuXHRcdFx0XHR9XVxuXHRcdFx0fSk7XG5cdFx0fVxuXG5cdFx0b3ZlcnJpZGUgYXN5bmMgcnVuV2l0aENvbnRleHQoYWNjZXNzb3I6IFNlcnZpY2VzQWNjZXNzb3IsIGNvbnRleHQ6IElDb2RlQmxvY2tBY3Rpb25Db250ZXh0KSB7XG5cdFx0XHRpZiAoaXNSZXNwb25zZUZpbHRlcmVkKGNvbnRleHQpKSB7XG5cdFx0XHRcdC8vIFdoZW4gcnVuIGZyb20gY29tbWFuZCBwYWxldHRlXG5cdFx0XHRcdHJldHVybjtcblx0XHRcdH1cblxuXHRcdFx0Y29uc3QgY2hhdFNlcnZpY2UgPSBhY2Nlc3Nvci5nZXQoSUNoYXRTZXJ2aWNlKTtcblx0XHRcdGNvbnN0IHRlcm1pbmFsU2VydmljZSA9IGFjY2Vzc29yLmdldChJVGVybWluYWxTZXJ2aWNlKTtcblx0XHRcdGNvbnN0IGVkaXRvclNlcnZpY2UgPSBhY2Nlc3Nvci5nZXQoSUVkaXRvclNlcnZpY2UpO1xuXHRcdFx0Y29uc3QgdGVybWluYWxFZGl0b3JTZXJ2aWNlID0gYWNjZXNzb3IuZ2V0KElUZXJtaW5hbEVkaXRvclNlcnZpY2UpO1xuXHRcdFx0Y29uc3QgdGVybWluYWxHcm91cFNlcnZpY2UgPSBhY2Nlc3Nvci5nZXQoSVRlcm1pbmFsR3JvdXBTZXJ2aWNlKTtcblxuXHRcdFx0bGV0IHRlcm1pbmFsID0gYXdhaXQgdGVybWluYWxTZXJ2aWNlLmdldEFjdGl2ZU9yQ3JlYXRlSW5zdGFuY2UoKTtcblxuXHRcdFx0Ly8gaXNGZWF0dXJlVGVybWluYWwgPSBkZWJ1ZyB0ZXJtaW5hbCBvciB0YXNrIHRlcm1pbmFsXG5cdFx0XHRjb25zdCB1bnVzYWJsZVRlcm1pbmFsID0gdGVybWluYWwueHRlcm0/LmlzU3RkaW5EaXNhYmxlZCB8fCB0ZXJtaW5hbC5zaGVsbExhdW5jaENvbmZpZy5pc0ZlYXR1cmVUZXJtaW5hbDtcblx0XHRcdHRlcm1pbmFsID0gdW51c2FibGVUZXJtaW5hbCA/IGF3YWl0IHRlcm1pbmFsU2VydmljZS5jcmVhdGVUZXJtaW5hbCgpIDogdGVybWluYWw7XG5cblx0XHRcdHRlcm1pbmFsU2VydmljZS5zZXRBY3RpdmVJbnN0YW5jZSh0ZXJtaW5hbCk7XG5cdFx0XHRhd2FpdCB0ZXJtaW5hbC5mb2N1c1doZW5SZWFkeSh0cnVlKTtcblx0XHRcdGlmICh0ZXJtaW5hbC50YXJnZXQgPT09IFRlcm1pbmFsTG9jYXRpb24uRWRpdG9yKSB7XG5cdFx0XHRcdGNvbnN0IGV4aXN0aW5nRWRpdG9ycyA9IGVkaXRvclNlcnZpY2UuZmluZEVkaXRvcnModGVybWluYWwucmVzb3VyY2UpO1xuXHRcdFx0XHR0ZXJtaW5hbEVkaXRvclNlcnZpY2Uub3BlbkVkaXRvcih0ZXJtaW5hbCwgeyB2aWV3Q29sdW1uOiBleGlzdGluZ0VkaXRvcnM/LlswXS5ncm91cElkIH0pO1xuXHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0dGVybWluYWxHcm91cFNlcnZpY2Uuc2hvd1BhbmVsKHRydWUpO1xuXHRcdFx0fVxuXG5cdFx0XHR0ZXJtaW5hbC5ydW5Db21tYW5kKGNvbnRleHQuY29kZSwgZmFsc2UpO1xuXG5cdFx0XHRpZiAoaXNSZXNwb25zZVZNKGNvbnRleHQuZWxlbWVudCkpIHtcblx0XHRcdFx0Y2hhdFNlcnZpY2Uubm90aWZ5VXNlckFjdGlvbih7XG5cdFx0XHRcdFx0YWdlbnRJZDogY29udGV4dC5lbGVtZW50LmFnZW50Py5pZCxcblx0XHRcdFx0XHRjb21tYW5kOiBjb250ZXh0LmVsZW1lbnQuc2xhc2hDb21tYW5kPy5uYW1lLFxuXHRcdFx0XHRcdHNlc3Npb25JZDogY29udGV4dC5lbGVtZW50LnNlc3Npb25JZCxcblx0XHRcdFx0XHRyZXF1ZXN0SWQ6IGNvbnRleHQuZWxlbWVudC5yZXF1ZXN0SWQsXG5cdFx0XHRcdFx0cmVzdWx0OiBjb250ZXh0LmVsZW1lbnQucmVzdWx0LFxuXHRcdFx0XHRcdGFjdGlvbjoge1xuXHRcdFx0XHRcdFx0a2luZDogJ3J1bkluVGVybWluYWwnLFxuXHRcdFx0XHRcdFx0Y29kZUJsb2NrSW5kZXg6IGNvbnRleHQuY29kZUJsb2NrSW5kZXgsXG5cdFx0XHRcdFx0XHRsYW5ndWFnZUlkOiBjb250ZXh0Lmxhbmd1YWdlSWQsXG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9KTtcblx0XHRcdH1cblx0XHR9XG5cdH0pO1xuXG5cdGZ1bmN0aW9uIG5hdmlnYXRlQ29kZUJsb2NrcyhhY2Nlc3NvcjogU2VydmljZXNBY2Nlc3NvciwgcmV2ZXJzZT86IGJvb2xlYW4pOiB2b2lkIHtcblx0XHRjb25zdCBjb2RlRWRpdG9yU2VydmljZSA9IGFjY2Vzc29yLmdldChJQ29kZUVkaXRvclNlcnZpY2UpO1xuXHRcdGNvbnN0IGNoYXRXaWRnZXRTZXJ2aWNlID0gYWNjZXNzb3IuZ2V0KElDaGF0V2lkZ2V0U2VydmljZSk7XG5cdFx0Y29uc3Qgd2lkZ2V0ID0gY2hhdFdpZGdldFNlcnZpY2UubGFzdEZvY3VzZWRXaWRnZXQ7XG5cdFx0aWYgKCF3aWRnZXQpIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cblx0XHRjb25zdCBlZGl0b3IgPSBjb2RlRWRpdG9yU2VydmljZS5nZXRGb2N1c2VkQ29kZUVkaXRvcigpO1xuXHRcdGNvbnN0IGVkaXRvclVyaSA9IGVkaXRvcj8uZ2V0TW9kZWwoKT8udXJpO1xuXHRcdGNvbnN0IGN1ckNvZGVCbG9ja0luZm8gPSBlZGl0b3JVcmkgPyB3aWRnZXQuZ2V0Q29kZUJsb2NrSW5mb0ZvckVkaXRvcihlZGl0b3JVcmkpIDogdW5kZWZpbmVkO1xuXHRcdGNvbnN0IGZvY3VzZWQgPSAhd2lkZ2V0LmlucHV0RWRpdG9yLmhhc1dpZGdldEZvY3VzKCkgJiYgd2lkZ2V0LmdldEZvY3VzKCk7XG5cdFx0Y29uc3QgZm9jdXNlZFJlc3BvbnNlID0gaXNSZXNwb25zZVZNKGZvY3VzZWQpID8gZm9jdXNlZCA6IHVuZGVmaW5lZDtcblxuXHRcdGNvbnN0IGVsZW1lbnRJZCA9IGN1ckNvZGVCbG9ja0luZm8/LmVsZW1lbnRJZDtcblx0XHRjb25zdCBlbGVtZW50ID0gZWxlbWVudElkID8gd2lkZ2V0LnZpZXdNb2RlbD8uZ2V0SXRlbXMoKS5maW5kKGl0ZW0gPT4gaXRlbS5pZCA9PT0gZWxlbWVudElkKSA6IHVuZGVmaW5lZDtcblx0XHRjb25zdCBjdXJyZW50UmVzcG9uc2UgPSBlbGVtZW50ID8/XG5cdFx0XHQoZm9jdXNlZFJlc3BvbnNlID8/IHdpZGdldC52aWV3TW9kZWw/LmdldEl0ZW1zKCkucmV2ZXJzZSgpLmZpbmQoKGl0ZW0pOiBpdGVtIGlzIElDaGF0UmVzcG9uc2VWaWV3TW9kZWwgPT4gaXNSZXNwb25zZVZNKGl0ZW0pKSk7XG5cdFx0aWYgKCFjdXJyZW50UmVzcG9uc2UgfHwgIWlzUmVzcG9uc2VWTShjdXJyZW50UmVzcG9uc2UpKSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXG5cdFx0d2lkZ2V0LnJldmVhbChjdXJyZW50UmVzcG9uc2UpO1xuXHRcdGNvbnN0IHJlc3BvbnNlQ29kZWJsb2NrcyA9IHdpZGdldC5nZXRDb2RlQmxvY2tJbmZvc0ZvclJlc3BvbnNlKGN1cnJlbnRSZXNwb25zZSk7XG5cdFx0Y29uc3QgZm9jdXNJZHggPSBjdXJDb2RlQmxvY2tJbmZvID9cblx0XHRcdChjdXJDb2RlQmxvY2tJbmZvLmNvZGVCbG9ja0luZGV4ICsgKHJldmVyc2UgPyAtMSA6IDEpICsgcmVzcG9uc2VDb2RlYmxvY2tzLmxlbmd0aCkgJSByZXNwb25zZUNvZGVibG9ja3MubGVuZ3RoIDpcblx0XHRcdHJldmVyc2UgPyByZXNwb25zZUNvZGVibG9ja3MubGVuZ3RoIC0gMSA6IDA7XG5cblx0XHRyZXNwb25zZUNvZGVibG9ja3NbZm9jdXNJZHhdPy5mb2N1cygpO1xuXHR9XG5cblx0cmVnaXN0ZXJBY3Rpb24yKGNsYXNzIE5leHRDb2RlQmxvY2tBY3Rpb24gZXh0ZW5kcyBBY3Rpb24yIHtcblx0XHRjb25zdHJ1Y3RvcigpIHtcblx0XHRcdHN1cGVyKHtcblx0XHRcdFx0aWQ6ICd3b3JrYmVuY2guYWN0aW9uLmNoYXQubmV4dENvZGVCbG9jaycsXG5cdFx0XHRcdHRpdGxlOiBsb2NhbGl6ZTIoJ2ludGVyYWN0aXZlLm5leHRDb2RlQmxvY2subGFiZWwnLCBcIk5leHQgQ29kZSBCbG9ja1wiKSxcblx0XHRcdFx0a2V5YmluZGluZzoge1xuXHRcdFx0XHRcdHByaW1hcnk6IEtleU1vZC5DdHJsQ21kIHwgS2V5TW9kLkFsdCB8IEtleUNvZGUuUGFnZURvd24sXG5cdFx0XHRcdFx0bWFjOiB7IHByaW1hcnk6IEtleU1vZC5DdHJsQ21kIHwgS2V5TW9kLkFsdCB8IEtleUNvZGUuUGFnZURvd24sIH0sXG5cdFx0XHRcdFx0d2VpZ2h0OiBLZXliaW5kaW5nV2VpZ2h0LldvcmtiZW5jaENvbnRyaWIsXG5cdFx0XHRcdFx0d2hlbjogQ2hhdENvbnRleHRLZXlzLmluQ2hhdFNlc3Npb24sXG5cdFx0XHRcdH0sXG5cdFx0XHRcdHByZWNvbmRpdGlvbjogQ2hhdENvbnRleHRLZXlzLmVuYWJsZWQsXG5cdFx0XHRcdGYxOiB0cnVlLFxuXHRcdFx0XHRjYXRlZ29yeTogQ0hBVF9DQVRFR09SWSxcblx0XHRcdH0pO1xuXHRcdH1cblxuXHRcdHJ1bihhY2Nlc3NvcjogU2VydmljZXNBY2Nlc3NvciwgLi4uYXJnczogYW55W10pIHtcblx0XHRcdG5hdmlnYXRlQ29kZUJsb2NrcyhhY2Nlc3Nvcik7XG5cdFx0fVxuXHR9KTtcblxuXHRyZWdpc3RlckFjdGlvbjIoY2xhc3MgUHJldmlvdXNDb2RlQmxvY2tBY3Rpb24gZXh0ZW5kcyBBY3Rpb24yIHtcblx0XHRjb25zdHJ1Y3RvcigpIHtcblx0XHRcdHN1cGVyKHtcblx0XHRcdFx0aWQ6ICd3b3JrYmVuY2guYWN0aW9uLmNoYXQucHJldmlvdXNDb2RlQmxvY2snLFxuXHRcdFx0XHR0aXRsZTogbG9jYWxpemUyKCdpbnRlcmFjdGl2ZS5wcmV2aW91c0NvZGVCbG9jay5sYWJlbCcsIFwiUHJldmlvdXMgQ29kZSBCbG9ja1wiKSxcblx0XHRcdFx0a2V5YmluZGluZzoge1xuXHRcdFx0XHRcdHByaW1hcnk6IEtleU1vZC5DdHJsQ21kIHwgS2V5TW9kLkFsdCB8IEtleUNvZGUuUGFnZVVwLFxuXHRcdFx0XHRcdG1hYzogeyBwcmltYXJ5OiBLZXlNb2QuQ3RybENtZCB8IEtleU1vZC5BbHQgfCBLZXlDb2RlLlBhZ2VVcCwgfSxcblx0XHRcdFx0XHR3ZWlnaHQ6IEtleWJpbmRpbmdXZWlnaHQuV29ya2JlbmNoQ29udHJpYixcblx0XHRcdFx0XHR3aGVuOiBDaGF0Q29udGV4dEtleXMuaW5DaGF0U2Vzc2lvbixcblx0XHRcdFx0fSxcblx0XHRcdFx0cHJlY29uZGl0aW9uOiBDaGF0Q29udGV4dEtleXMuZW5hYmxlZCxcblx0XHRcdFx0ZjE6IHRydWUsXG5cdFx0XHRcdGNhdGVnb3J5OiBDSEFUX0NBVEVHT1JZLFxuXHRcdFx0fSk7XG5cdFx0fVxuXG5cdFx0cnVuKGFjY2Vzc29yOiBTZXJ2aWNlc0FjY2Vzc29yLCAuLi5hcmdzOiBhbnlbXSkge1xuXHRcdFx0bmF2aWdhdGVDb2RlQmxvY2tzKGFjY2Vzc29yLCB0cnVlKTtcblx0XHR9XG5cdH0pO1xufVxuXG5mdW5jdGlvbiBnZXRDb250ZXh0RnJvbUVkaXRvcihlZGl0b3I6IElDb2RlRWRpdG9yLCBhY2Nlc3NvcjogU2VydmljZXNBY2Nlc3Nvcik6IElDb2RlQmxvY2tBY3Rpb25Db250ZXh0IHwgdW5kZWZpbmVkIHtcblx0Y29uc3QgY2hhdFdpZGdldFNlcnZpY2UgPSBhY2Nlc3Nvci5nZXQoSUNoYXRXaWRnZXRTZXJ2aWNlKTtcblx0Y29uc3QgY2hhdENvZGVCbG9ja0NvbnRleHRQcm92aWRlclNlcnZpY2UgPSBhY2Nlc3Nvci5nZXQoSUNoYXRDb2RlQmxvY2tDb250ZXh0UHJvdmlkZXJTZXJ2aWNlKTtcblx0Y29uc3QgbW9kZWwgPSBlZGl0b3IuZ2V0TW9kZWwoKTtcblx0aWYgKCFtb2RlbCkge1xuXHRcdHJldHVybjtcblx0fVxuXG5cdGNvbnN0IHdpZGdldCA9IGNoYXRXaWRnZXRTZXJ2aWNlLmxhc3RGb2N1c2VkV2lkZ2V0O1xuXHRjb25zdCBjb2RlQmxvY2tJbmZvID0gd2lkZ2V0Py5nZXRDb2RlQmxvY2tJbmZvRm9yRWRpdG9yKG1vZGVsLnVyaSk7XG5cdGlmICghY29kZUJsb2NrSW5mbykge1xuXHRcdGZvciAoY29uc3QgcHJvdmlkZXIgb2YgY2hhdENvZGVCbG9ja0NvbnRleHRQcm92aWRlclNlcnZpY2UucHJvdmlkZXJzKSB7XG5cdFx0XHRjb25zdCBjb250ZXh0ID0gcHJvdmlkZXIuZ2V0Q29kZUJsb2NrQ29udGV4dChlZGl0b3IpO1xuXHRcdFx0aWYgKGNvbnRleHQpIHtcblx0XHRcdFx0cmV0dXJuIGNvbnRleHQ7XG5cdFx0XHR9XG5cdFx0fVxuXHRcdHJldHVybjtcblx0fVxuXG5cdGNvbnN0IGVsZW1lbnQgPSB3aWRnZXQ/LnZpZXdNb2RlbD8uZ2V0SXRlbXMoKS5maW5kKGl0ZW0gPT4gaXRlbS5pZCA9PT0gY29kZUJsb2NrSW5mby5lbGVtZW50SWQpO1xuXHRyZXR1cm4ge1xuXHRcdGVsZW1lbnQsXG5cdFx0Y29kZUJsb2NrSW5kZXg6IGNvZGVCbG9ja0luZm8uY29kZUJsb2NrSW5kZXgsXG5cdFx0Y29kZTogZWRpdG9yLmdldFZhbHVlKCksXG5cdFx0bGFuZ3VhZ2VJZDogZWRpdG9yLmdldE1vZGVsKCkhLmdldExhbmd1YWdlSWQoKSxcblx0XHRjb2RlbWFwcGVyVXJpOiBjb2RlQmxvY2tJbmZvLmNvZGVtYXBwZXJVcmlcblx0fTtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIHJlZ2lzdGVyQ2hhdENvZGVDb21wYXJlQmxvY2tBY3Rpb25zKCkge1xuXG5cdGFic3RyYWN0IGNsYXNzIENoYXRDb21wYXJlQ29kZUJsb2NrQWN0aW9uIGV4dGVuZHMgQWN0aW9uMiB7XG5cdFx0cnVuKGFjY2Vzc29yOiBTZXJ2aWNlc0FjY2Vzc29yLCAuLi5hcmdzOiBhbnlbXSkge1xuXHRcdFx0Y29uc3QgY29udGV4dCA9IGFyZ3NbMF07XG5cdFx0XHRpZiAoIWlzQ29kZUNvbXBhcmVCbG9ja0FjdGlvbkNvbnRleHQoY29udGV4dCkpIHtcblx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0XHQvLyBUT0RPQGpyaWVrZW4gZGVyaXZlIGNvbnRleHRcblx0XHRcdH1cblxuXHRcdFx0cmV0dXJuIHRoaXMucnVuV2l0aENvbnRleHQoYWNjZXNzb3IsIGNvbnRleHQpO1xuXHRcdH1cblxuXHRcdGFic3RyYWN0IHJ1bldpdGhDb250ZXh0KGFjY2Vzc29yOiBTZXJ2aWNlc0FjY2Vzc29yLCBjb250ZXh0OiBJQ29kZUNvbXBhcmVCbG9ja0FjdGlvbkNvbnRleHQpOiBhbnk7XG5cdH1cblxuXHRyZWdpc3RlckFjdGlvbjIoY2xhc3MgQXBwbHlFZGl0c0NvbXBhcmVCbG9ja0FjdGlvbiBleHRlbmRzIENoYXRDb21wYXJlQ29kZUJsb2NrQWN0aW9uIHtcblx0XHRjb25zdHJ1Y3RvcigpIHtcblx0XHRcdHN1cGVyKHtcblx0XHRcdFx0aWQ6ICd3b3JrYmVuY2guYWN0aW9uLmNoYXQuYXBwbHlDb21wYXJlRWRpdHMnLFxuXHRcdFx0XHR0aXRsZTogbG9jYWxpemUyKCdpbnRlcmFjdGl2ZS5jb21wYXJlLmFwcGx5JywgXCJBcHBseSBFZGl0c1wiKSxcblx0XHRcdFx0ZjE6IGZhbHNlLFxuXHRcdFx0XHRjYXRlZ29yeTogQ0hBVF9DQVRFR09SWSxcblx0XHRcdFx0aWNvbjogQ29kaWNvbi5naXRQdWxsUmVxdWVzdEdvVG9DaGFuZ2VzLFxuXHRcdFx0XHRwcmVjb25kaXRpb246IENvbnRleHRLZXlFeHByLmFuZChFZGl0b3JDb250ZXh0S2V5cy5oYXNDaGFuZ2VzLCBDaGF0Q29udGV4dEtleXMuZWRpdEFwcGxpZWQubmVnYXRlKCkpLFxuXHRcdFx0XHRtZW51OiB7XG5cdFx0XHRcdFx0aWQ6IE1lbnVJZC5DaGF0Q29tcGFyZUJsb2NrLFxuXHRcdFx0XHRcdGdyb3VwOiAnbmF2aWdhdGlvbicsXG5cdFx0XHRcdFx0b3JkZXI6IDEsXG5cdFx0XHRcdH1cblx0XHRcdH0pO1xuXHRcdH1cblxuXHRcdGFzeW5jIHJ1bldpdGhDb250ZXh0KGFjY2Vzc29yOiBTZXJ2aWNlc0FjY2Vzc29yLCBjb250ZXh0OiBJQ29kZUNvbXBhcmVCbG9ja0FjdGlvbkNvbnRleHQpOiBQcm9taXNlPGFueT4ge1xuXG5cdFx0XHRjb25zdCBpbnN0YVNlcnZpY2UgPSBhY2Nlc3Nvci5nZXQoSUluc3RhbnRpYXRpb25TZXJ2aWNlKTtcblx0XHRcdGNvbnN0IGVkaXRvclNlcnZpY2UgPSBhY2Nlc3Nvci5nZXQoSUNvZGVFZGl0b3JTZXJ2aWNlKTtcblxuXHRcdFx0Y29uc3QgaXRlbSA9IGNvbnRleHQuZWRpdDtcblx0XHRcdGNvbnN0IHJlc3BvbnNlID0gY29udGV4dC5lbGVtZW50O1xuXG5cdFx0XHRpZiAoaXRlbS5zdGF0ZT8uYXBwbGllZCkge1xuXHRcdFx0XHQvLyBhbHJlYWR5IGFwcGxpZWRcblx0XHRcdFx0cmV0dXJuIGZhbHNlO1xuXHRcdFx0fVxuXG5cdFx0XHRpZiAoIXJlc3BvbnNlLnJlc3BvbnNlLnZhbHVlLmluY2x1ZGVzKGl0ZW0pKSB7XG5cdFx0XHRcdC8vIGJvZ291cyBpdGVtXG5cdFx0XHRcdHJldHVybiBmYWxzZTtcblx0XHRcdH1cblxuXHRcdFx0Y29uc3QgZmlyc3RFZGl0ID0gaXRlbS5lZGl0c1swXT8uWzBdO1xuXHRcdFx0aWYgKCFmaXJzdEVkaXQpIHtcblx0XHRcdFx0cmV0dXJuIGZhbHNlO1xuXHRcdFx0fVxuXHRcdFx0Y29uc3QgdGV4dEVkaXRzID0gQXN5bmNJdGVyYWJsZU9iamVjdC5mcm9tQXJyYXkoaXRlbS5lZGl0cyk7XG5cblx0XHRcdGNvbnN0IGVkaXRvclRvQXBwbHkgPSBhd2FpdCBlZGl0b3JTZXJ2aWNlLm9wZW5Db2RlRWRpdG9yKHsgcmVzb3VyY2U6IGl0ZW0udXJpIH0sIG51bGwpO1xuXHRcdFx0aWYgKGVkaXRvclRvQXBwbHkpIHtcblx0XHRcdFx0ZWRpdG9yVG9BcHBseS5yZXZlYWxMaW5lSW5DZW50ZXJJZk91dHNpZGVWaWV3cG9ydChmaXJzdEVkaXQucmFuZ2Uuc3RhcnRMaW5lTnVtYmVyKTtcblx0XHRcdFx0aW5zdGFTZXJ2aWNlLmludm9rZUZ1bmN0aW9uKHJldmlld0VkaXRzLCBlZGl0b3JUb0FwcGx5LCB0ZXh0RWRpdHMsIENhbmNlbGxhdGlvblRva2VuLk5vbmUpO1xuXHRcdFx0XHRyZXNwb25zZS5zZXRFZGl0QXBwbGllZChpdGVtLCAxKTtcblx0XHRcdFx0cmV0dXJuIHRydWU7XG5cdFx0XHR9XG5cdFx0XHRyZXR1cm4gZmFsc2U7XG5cdFx0fVxuXHR9KTtcblxuXHRyZWdpc3RlckFjdGlvbjIoY2xhc3MgRGlzY2FyZEVkaXRzQ29tcGFyZUJsb2NrQWN0aW9uIGV4dGVuZHMgQ2hhdENvbXBhcmVDb2RlQmxvY2tBY3Rpb24ge1xuXHRcdGNvbnN0cnVjdG9yKCkge1xuXHRcdFx0c3VwZXIoe1xuXHRcdFx0XHRpZDogJ3dvcmtiZW5jaC5hY3Rpb24uY2hhdC5kaXNjYXJkQ29tcGFyZUVkaXRzJyxcblx0XHRcdFx0dGl0bGU6IGxvY2FsaXplMignaW50ZXJhY3RpdmUuY29tcGFyZS5kaXNjYXJkJywgXCJEaXNjYXJkIEVkaXRzXCIpLFxuXHRcdFx0XHRmMTogZmFsc2UsXG5cdFx0XHRcdGNhdGVnb3J5OiBDSEFUX0NBVEVHT1JZLFxuXHRcdFx0XHRpY29uOiBDb2RpY29uLnRyYXNoLFxuXHRcdFx0XHRwcmVjb25kaXRpb246IENvbnRleHRLZXlFeHByLmFuZChFZGl0b3JDb250ZXh0S2V5cy5oYXNDaGFuZ2VzLCBDaGF0Q29udGV4dEtleXMuZWRpdEFwcGxpZWQubmVnYXRlKCkpLFxuXHRcdFx0XHRtZW51OiB7XG5cdFx0XHRcdFx0aWQ6IE1lbnVJZC5DaGF0Q29tcGFyZUJsb2NrLFxuXHRcdFx0XHRcdGdyb3VwOiAnbmF2aWdhdGlvbicsXG5cdFx0XHRcdFx0b3JkZXI6IDIsXG5cdFx0XHRcdH1cblx0XHRcdH0pO1xuXHRcdH1cblxuXHRcdGFzeW5jIHJ1bldpdGhDb250ZXh0KGFjY2Vzc29yOiBTZXJ2aWNlc0FjY2Vzc29yLCBjb250ZXh0OiBJQ29kZUNvbXBhcmVCbG9ja0FjdGlvbkNvbnRleHQpOiBQcm9taXNlPGFueT4ge1xuXHRcdFx0Y29uc3QgaW5zdGFTZXJ2aWNlID0gYWNjZXNzb3IuZ2V0KElJbnN0YW50aWF0aW9uU2VydmljZSk7XG5cdFx0XHRjb25zdCBlZGl0b3IgPSBpbnN0YVNlcnZpY2UuY3JlYXRlSW5zdGFuY2UoRGVmYXVsdENoYXRUZXh0RWRpdG9yKTtcblx0XHRcdGVkaXRvci5kaXNjYXJkKGNvbnRleHQuZWxlbWVudCwgY29udGV4dC5lZGl0KTtcblx0XHR9XG5cdH0pO1xufVxuIl0sCiAgIm1hcHBpbmdzIjogIjs7Ozs7Ozs7Ozs7QUFLQSxTQUFTLDJCQUEyQjtBQUNwQyxTQUFTLHlCQUF5QjtBQUNsQyxTQUFTLGVBQWU7QUFDeEIsU0FBUyxTQUFTLGNBQWM7QUFDaEMsU0FBUyxZQUFZLHVCQUF1QjtBQUc1QyxTQUFTLDBCQUEwQjtBQUNuQyxTQUFTLHlCQUF5QjtBQUNsQyxTQUFTLGtCQUFrQjtBQUMzQixTQUFTLFVBQVUsaUJB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
